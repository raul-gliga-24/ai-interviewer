import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the real provider so we can hand completeJSON exactly the
// malformed output we want to test against. Without this the retry path has
// only ever been "never needed", which is not the same as "works".
const scripted: string[] = [];
let calls = 0;

vi.mock("./deepseek", () => ({
  DeepSeekProvider: class {
    readonly label = "scripted";
    async complete(): Promise<string> {
      calls += 1;
      const next = scripted.shift();
      if (next === undefined) throw new Error("ran out of scripted replies");
      return next;
    }
  },
}));

const { completeJSON } = await import("./index");

const MESSAGES = [{ role: "user" as const, content: "irrelevant" }];

beforeEach(() => {
  scripted.length = 0;
  calls = 0;
});

describe("completeJSON cleaning", () => {
  it("parses a clean object", async () => {
    scripted.push('{"question":"Why?","done":false}');
    await expect(completeJSON("fast", MESSAGES)).resolves.toEqual({
      question: "Why?",
      done: false,
    });
    expect(calls).toBe(1);
  });

  it("strips markdown fences", async () => {
    scripted.push('```json\n{"done":true}\n```');
    await expect(completeJSON("fast", MESSAGES)).resolves.toEqual({ done: true });
    expect(calls).toBe(1);
  });

  it("strips bare fences without a language tag", async () => {
    scripted.push('```\n{"done":true}\n```');
    await expect(completeJSON("fast", MESSAGES)).resolves.toEqual({ done: true });
  });

  it("digs the object out of surrounding prose", async () => {
    scripted.push('Sure! Here is the JSON you asked for:\n{"done":false}\nHope that helps.');
    await expect(completeJSON("fast", MESSAGES)).resolves.toEqual({ done: false });
    expect(calls).toBe(1);
  });
});

describe("completeJSON retry", () => {
  it("asks again when the first reply cannot be parsed at all", async () => {
    scripted.push("I'm afraid I can't do that.");
    scripted.push('{"question":"Second time lucky?","done":false}');

    await expect(completeJSON("fast", MESSAGES)).resolves.toEqual({
      question: "Second time lucky?",
      done: false,
    });
    expect(calls).toBe(2);
  });

  it("gives up after the second failure rather than looping", async () => {
    scripted.push("nonsense");
    scripted.push("still nonsense");

    await expect(completeJSON("fast", MESSAGES)).rejects.toThrow(/invalid JSON twice/);
    expect(calls).toBe(2);
  });

  it("retries JSON truncated mid-string, which no amount of cleaning can fix", async () => {
    scripted.push('{"question":"unterminated');
    scripted.push('{"done":true}');

    await expect(completeJSON("fast", MESSAGES)).resolves.toEqual({ done: true });
    expect(calls).toBe(2);
  });
});
