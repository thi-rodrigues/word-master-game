import { useEffect, useState } from "react";
import sharedBaseWords from "../../public/words-base.json";

export type Word = {
  id: string;
  en: string;
  pt: string;
};

export type VocabularyMode = "shared" | "custom";

const CUSTOM_KEY = "vocab-words-v1";
const MODE_KEY = "vocab-mode-v1";
const SHARED_WORDS = sharedBaseWords as Word[];

function normalizeWordValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function readCustomWords(): Word[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as Word[]) : [];
  } catch {
    return [];
  }
}

function writeCustomWords(words: Word[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(words));
  window.dispatchEvent(new Event("vocab-words-changed"));
}

function readMode(): VocabularyMode {
  if (typeof window === "undefined") return "custom";
  const raw = window.localStorage.getItem(MODE_KEY);
  return raw === "shared" ? "shared" : "custom";
}

export async function getSharedWords(): Promise<Word[]> {
  return SHARED_WORDS;
}

export function useVocabularyMode() {
  const [mode, setModeState] = useState<VocabularyMode>(readMode());

  useEffect(() => {
    setModeState(readMode());
    const onChange = () => setModeState(readMode());
    window.addEventListener("vocab-mode-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("vocab-mode-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return {
    mode,
    setMode(next: VocabularyMode) {
      window.localStorage.setItem(MODE_KEY, next);
      window.dispatchEvent(new Event("vocab-mode-changed"));
    },
  };
}

export function useWords() {
  const [words, setWords] = useState<Word[]>([]);

  useEffect(() => {
    setWords(readCustomWords());
    const onChange = () => setWords(readCustomWords());
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
      const nextWord = {
        id: crypto.randomUUID(),
        en: en.trim(),
        pt: pt.trim(),
      };
      const exists = readCustomWords().some(
        (word) =>
          normalizeWordValue(word.en) === normalizeWordValue(nextWord.en) &&
          normalizeWordValue(word.pt) === normalizeWordValue(nextWord.pt),
      );

      if (exists) {
        return false;
      }

      const next = [...readCustomWords(), nextWord];
      writeCustomWords(next);
      return true;
    },
    remove(id: string) {
      writeCustomWords(readCustomWords().filter((w) => w.id !== id));
    },
  };
}

export function useWordsByMode(mode: VocabularyMode) {
  const [words, setWords] = useState<Word[] | null>(null);

  useEffect(() => {
    let ignore = false;

    async function sync() {
      const nextWords = mode === "shared" ? await getSharedWords() : readCustomWords();
      if (!ignore) {
        setWords(nextWords);
      }
    }

    void sync();

    const onChange = () => {
      void sync();
    };

    window.addEventListener("vocab-words-changed", onChange);
    window.addEventListener("vocab-mode-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      ignore = true;
      window.removeEventListener("vocab-words-changed", onChange);
      window.removeEventListener("vocab-mode-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [mode]);

  return { words };
}

export function getWords() {
  return readCustomWords();
}
