import { useEffect, useState } from "react";

export type Word = {
  id: string;
  en: string;
  pt: string;
};

const KEY = "vocab-words-v1";

function read(): Word[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Word[]) : [];
  } catch {
    return [];
  }
}

function write(words: Word[]) {
  window.localStorage.setItem(KEY, JSON.stringify(words));
  window.dispatchEvent(new Event("vocab-words-changed"));
}

export function useWords() {
  const [words, setWords] = useState<Word[]>([]);

  useEffect(() => {
    setWords(read());
    const onChange = () => setWords(read());
    window.addEventListener("vocab-words-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("vocab-words-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return {
    words,
    add(en: string, pt: string) {
      const next = [
        ...read(),
        { id: crypto.randomUUID(), en: en.trim(), pt: pt.trim() },
      ];
      write(next);
    },
    remove(id: string) {
      write(read().filter((w) => w.id !== id));
    },
  };
}

export function getWords() {
  return read();
}
