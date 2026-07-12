import type { VocabularyMode, Word } from "@/lib/words-store";

export type QuizResult = {
  correct: boolean;
  expected: string;
};

export type QuizSnapshot = {
  mode: VocabularyMode;
  lang: "pt" | "en";
  queue: Word[];
  idx: number;
  answer: string;
  result: QuizResult | null;
  score: {
    right: number;
    wrong: number;
  };
  elapsedSeconds: number;
  paused: boolean;
  finished: boolean;
  saved: boolean;
  startedAt: number | null;
};

const STORAGE_KEY = "vocab-quiz-progress-v1";

export function readQuizSnapshot(): QuizSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QuizSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveQuizSnapshot(snapshot: QuizSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearQuizSnapshot() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function hasQuizSnapshot() {
  return readQuizSnapshot() !== null;
}
