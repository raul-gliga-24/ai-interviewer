# AI Interviewer

A small web app that interviews you about a topic you choose, one question at a
time, and then summarises what you said.

Each question is written from your previous answers rather than picked from a
list, the interview ends when there is nothing worth following up on, and the
whole transcript plus the analysis is written to disk as JSON.

## What it does

1. You pick a topic — from a preset or free text — and an interviewer tier.
2. The app asks between three and five questions, one at a time. Every question
   after the first is written from the answers so far.
3. When the interview ends it produces a structured analysis: a summary,
   recurring themes, a sentiment label with a score from -1 to 1, the key points
   you made, and extracted keywords.
4. Everything is stored in `data/interviews/<id>.json`. Unfinished interviews
   can be resumed from the home page; finished ones link to their results.

## Run locally

Requires Node 20.9 or newer.

```bash
npm ci                         # npm install also works; ci matches the lockfile exactly
cp .env.example .env.local     # then fill in at least one key
npm run dev
```

The app runs at http://localhost:3000.

`.env.local` holds the keys and is never committed. Fill in the ones you have
and leave the rest empty:

```
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=sk-...
```

Only one key is needed. A tier whose key is empty is shown as unavailable in
the UI rather than failing when you try to use it — so leave it empty rather
than filling in a placeholder.

## Run with Docker

```bash
docker compose up --build
```

Needs Docker Compose v2 (the `docker compose` subcommand, not `docker-compose`).
The first build installs dependencies and compiles from scratch, so expect a
few minutes; later builds reuse the cached layers.

Also at http://localhost:3000. Keys are read from `.env.local` at run time —
the same file the dev server uses, and nothing secret is copied into the image.
`./data` is mounted as a volume, so interviews written inside the container
appear on the host and survive rebuilds.

The image is a three-stage build on Next's standalone output: dependencies,
build, then a runtime stage carrying only the compiled server. It runs as the
non-root `node` user and contains no source files and no dev dependencies.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests (vitest) |
| `npm run lint` | ESLint |

`npm start` is deliberately not listed: `next start` is not supported alongside
`output: "standalone"` and says so when you run it. Docker is the way to run
this in production — see above.

## Interviewer tiers

Two tiers are offered in the UI, described by what they cost rather than by
model name:

| Tier | Provider |
|---|---|
| Quality | Claude, via `@anthropic-ai/sdk` |
| Fast & cheap | DeepSeek, via the `openai` package pointed at DeepSeek's endpoint |

**Both tiers are implemented behind the same interface, but only one has been
exercised.** The app was developed and tested end to end against DeepSeek. The
Claude tier is wired up through the same `LLMProvider` interface and degrades
honestly when no key is configured, but it has not been run end to end, and the
timings quoted below come from DeepSeek only.

## Architecture

```
app/
  page.tsx                  home: start a new interview, list past ones
  interview/[id]/page.tsx   the chat
  results/[id]/page.tsx     summary, sentiment, themes, transcript
  api/interview/
    start/                  POST  create an interview, ask question 1
    answer/                 POST  record an answer, ask the next or finish
    summary/                POST  generate the analysis (idempotent)
lib/
  llm/                      provider abstraction; the only place vendor SDKs appear
  prompts.ts                every prompt in the app, in one file
  question.ts               reading the model's reply; when to stop
  analysis.ts               generating and validating the analysis
  storage.ts                JSON file persistence
  upstream.ts               telling permanent upstream failures from transient ones
components/                 UI; only the chat and the start form are client components
```

Pages are server components and read storage directly. Only the parts that need
interactivity — the chat, the start form, the collapsible transcript — run on
the client, and they receive plain data as props. No API key or vendor SDK
reaches the browser bundle.

Routes are thin: validate input, load state, build a prompt, call the model,
save, respond. Errors share one shape, `{"error": "..."}`, with 400 for invalid
input, 404 for a missing interview, 409 for a state conflict, 502 for a model
call that failed, and 503 for a tier that cannot work as configured.

## Design decisions

### Questions are generated one at a time

The interview would be much simpler to build if it asked for five questions up
front and then played them back. It does not, because the interesting part of an
interview is the follow-up. Each request sends the transcript so far and asks
for exactly one more question, which is what lets question three pick up a
detail from answer two. The cost is one model call per turn instead of one per
interview.

### Stopping is driven by evidence, not by judgement

The interview may end anywhere between three and five questions, and deciding
when turned out to be the hardest part of the prompt design.

Asking the model to judge whether to continue does not work. It follows whichever
option the prompt frames as the default. Two wordings were measured against two
fixed transcripts — one deliberately seeded with unexplored threads, one where
nothing was left to ask — with eight samples each:

| Wording at the decision point | Seeded transcript | Exhausted transcript |
|---|---|---|
| "You may either ask one more question… or end the interview." | continue 8/8 | **continue 8/8** |
| "End it now unless something was left genuinely unexplored." | **end 8/8** | end 8/8 |
| Quote the unexplored thing first, then decide from whether you found one | **continue 8/8** | **end 8/8** |

The first two wordings do not discriminate at all — they are constant regardless
of the transcript, just at opposite fixed points. The third asks the model to
quote, word for word, something specific the interviewee left unexplained, and
to return `null` when there is nothing. The decision then follows from whether a
quote exists rather than from a judgement call, and the app derives the outcome
from the quote rather than trusting the model's own `done` flag. Four real
interviews with that wording produced lengths of 5, 3, 3 and 3.

The bounds themselves are enforced in code, not left to the prompt:
`MIN_QUESTIONS` cannot be undercut and `MAX_QUESTIONS` always wins. At the cap
the model is not consulted at all, since nothing it could say would change the
outcome — that saves a call and about 1.3 seconds on the slowest request in the
app, which is the same one that has to write the analysis.

### The provider abstraction

Everything outside `lib/llm` depends on an `LLMProvider` interface —
`complete(messages)` — and never on a vendor SDK. Two things fall out of that.
Offering a quality/cost choice in the UI is a one-line factory call rather than
a branch through the codebase, and the tier stored on an interview is enough to
resume it later with the same provider. It also keeps the SDKs on the server:
client components import types with `import type`, so the imports are erased at
compile time, and the built bundle was checked for vendor hostnames and key
names to confirm it.

### Retrying malformed JSON

Every model call in the app asks for JSON. `completeJSON` strips markdown
fences, falls back to extracting the first `{...}` block from surrounding prose,
and if it still cannot parse, sends the reply back with a corrective message and
tries once more before giving up.

In practice DeepSeek never needed it: across roughly a hundred calls during
development, every reply parsed on the first attempt. The logic stays because
"has not happened yet" is not the same as "cannot happen", and a single malformed
reply would otherwise end an interview the user is halfway through. It is covered
by unit tests that feed it deliberately malformed strings, so there is evidence
it works rather than only evidence it was never needed.

### Storage is written every turn

Interviews are plain JSON files, one per interview, rewritten after every turn.
There is no database because there is nothing relational here and no concurrent
access to coordinate.

Writing every turn is what makes the app recoverable. The answer route saves the
answer **before** calling the model, so a failed call never costs the user
anything they typed, and retrying the same request resumes from where it stopped
instead of rejecting it. Completing an interview saves the finished state before
attempting the analysis, so a failed summary leaves a completed interview with
its analysis missing rather than an interview stuck halfway — and the results
page asks for the missing analysis when you land on it.

### Permanent and transient failures are different

A missing API key and an unpaid account fail exactly like a network blip if you
only look at "the call threw". They need opposite advice, so upstream failures
carrying 401, 402 or 403 — or a missing key — are answered with 503 and the UI
marks the tier unavailable, while anything else is a 502 with a retry button.
This came out of a real incident during development: an empty DeepSeek account
returned 402, and the app cheerfully invited the user to try again forever.

## Tests

```bash
npm test
```

Fourteen unit tests over the two pieces of logic worth isolating: the stopping
rule, and the JSON cleaning and retry path. The stopping tests cover the bounds
holding regardless of what the model says and the evidence winning over a
contradictory flag; the parsing tests feed clean, fenced, prose-wrapped and
truncated replies through a scripted provider and assert how many calls each
costs.

The API routes and the UI were verified by hand against the running app rather
than by automated tests — including the failure paths, by forcing real 502 and
503 responses and by interrupting requests mid-interview. Two things are worth
being explicit about: the Claude tier has never been run end to end, and one
branch of the results page — a transient failure showing a retry button — was
verified only through the identical code path in the chat, not on its own.

One note on the lint setup: it is doing more than style checking. Three separate
rules caught three real bugs during the UI work — two cases of `setState` inside
an effect that would have cascaded renders, and JSX built inside a `try/catch`
whose errors it could never have caught. Each rejection produced a better
implementation than the one it blocked.
