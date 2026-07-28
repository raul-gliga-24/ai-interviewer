import { describe, expect, it } from "vitest";

import { MAX_QUESTIONS, MIN_QUESTIONS } from "./prompts";
import {
  atQuestionCap,
  readQuestion,
  readUnexplored,
  shouldFinish,
} from "./question";

const withEvidence = {
  unexplored: "two people left over it",
  question: "Why did they leave?",
  done: false,
};

const withoutEvidence = { unexplored: null, question: null, done: true };

describe("shouldFinish", () => {
  it("never finishes below the minimum, whatever the model says", () => {
    for (let asked = 0; asked < MIN_QUESTIONS; asked++) {
      expect(shouldFinish(asked, withoutEvidence)).toBe(false);
      expect(shouldFinish(asked, { question: null, done: true })).toBe(false);
    }
  });

  it("always finishes at the cap, whatever the model says", () => {
    expect(shouldFinish(MAX_QUESTIONS, withEvidence)).toBe(true);
    expect(shouldFinish(MAX_QUESTIONS + 1, withEvidence)).toBe(true);
  });

  it("between the bounds, follows the evidence rather than the done flag", () => {
    expect(shouldFinish(MIN_QUESTIONS, withEvidence)).toBe(false);
    expect(shouldFinish(MIN_QUESTIONS, withoutEvidence)).toBe(true);

    // A quote but a contradictory flag: the quote wins.
    expect(shouldFinish(MIN_QUESTIONS, { ...withEvidence, done: true })).toBe(false);
    // A flag but no quote: still finished.
    expect(
      shouldFinish(MIN_QUESTIONS, { unexplored: null, question: "?", done: false }),
    ).toBe(true);
  });

  it("finishes when the model returns something unusable", () => {
    expect(shouldFinish(MIN_QUESTIONS, null)).toBe(true);
    expect(shouldFinish(MIN_QUESTIONS, "not an object")).toBe(true);
    expect(shouldFinish(MIN_QUESTIONS, {})).toBe(true);
  });
});

describe("atQuestionCap", () => {
  it("is only true from the cap upwards", () => {
    expect(atQuestionCap(MAX_QUESTIONS - 1)).toBe(false);
    expect(atQuestionCap(MAX_QUESTIONS)).toBe(true);
  });
});

describe("reading model fields", () => {
  it("trims and rejects anything that isn't a usable string", () => {
    expect(readQuestion({ question: "  What changed?  " })).toBe("What changed?");
    expect(readQuestion({ question: null })).toBe("");
    expect(readQuestion({ question: 42 })).toBe("");
    expect(readQuestion(undefined)).toBe("");
  });

  it("treats the word null as no value", () => {
    expect(readUnexplored({ unexplored: "null" })).toBe("");
    expect(readUnexplored({ unexplored: "NULL" })).toBe("");
    expect(readUnexplored({ unexplored: "a real quote" })).toBe("a real quote");
  });
});
