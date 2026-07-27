// Simple JSON-file persistence: one file per interview in data/interviews/.
// Written after every turn so a browser refresh never loses progress.

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Tier } from "./llm";
import type { Analysis } from "./prompts";

const DATA_DIR = path.join(process.cwd(), "data", "interviews");

export type QA = {
  question: string;
  answer: string | null; // null while waiting for the user's answer
  askedAt: string;
  answeredAt: string | null;
};

export type Interview = {
  id: string;
  topic: string;
  tier: Tier;
  status: "in_progress" | "completed";
  createdAt: string;
  completedAt: string | null;
  transcript: QA[];
  analysis: Analysis | null;
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function fileFor(id: string) {
  // ids are always our own UUIDs, but sanitize anyway (defense in depth
  // against path traversal if an id ever comes from a URL).
  if (!/^[a-z0-9-]+$/i.test(id)) throw new Error("Invalid interview id");
  return path.join(DATA_DIR, `${id}.json`);
}

export async function createInterview(topic: string, tier: Tier): Promise<Interview> {
  const interview: Interview = {
    id: randomUUID(),
    topic,
    tier,
    status: "in_progress",
    createdAt: new Date().toISOString(),
    completedAt: null,
    transcript: [],
    analysis: null,
  };
  await saveInterview(interview);
  return interview;
}

export async function saveInterview(interview: Interview): Promise<void> {
  await ensureDir();
  await fs.writeFile(fileFor(interview.id), JSON.stringify(interview, null, 2), "utf8");
}

export async function getInterview(id: string): Promise<Interview | null> {
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as Interview;
  } catch {
    return null;
  }
}

export async function listInterviews(): Promise<Interview[]> {
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const interviews = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
        return JSON.parse(raw) as Interview;
      }),
  );
  return interviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
