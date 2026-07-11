import { useEffect, useState } from "react";

const USER_KEY = "vocab-user-v1";
const SCORES_KEY = "vocab-scores-v1";

export type Score = {
  id: string;
  user: string;
  lang: "pt" | "en";
  right: number;
  wrong: number;
  total: number;
  at: number;
};

function readUser(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_KEY);
}

function readScores(): Score[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCORES_KEY);
    return raw ? (JSON.parse(raw) as Score[]) : [];
  } catch {
    return [];
  }
}

export function useUser() {
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    setUser(readUser());
    const onChange = () => setUser(readUser());
    window.addEventListener("vocab-user-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("vocab-user-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return {
    user,
    setUser(name: string) {
      window.localStorage.setItem(USER_KEY, name.trim());
      window.dispatchEvent(new Event("vocab-user-changed"));
    },
    clearUser() {
      window.localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new Event("vocab-user-changed"));
    },
  };
}

export function useScores() {
  const [scores, setScores] = useState<Score[]>([]);

  useEffect(() => {
    setScores(readScores());
    const onChange = () => setScores(readScores());
    window.addEventListener("vocab-scores-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("vocab-scores-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return { scores };
}

export function addScore(entry: Omit<Score, "id" | "at">) {
  const next: Score = {
    ...entry,
    id: crypto.randomUUID(),
    at: Date.now(),
  };
  const all = [...readScores(), next];
  window.localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("vocab-scores-changed"));
}
