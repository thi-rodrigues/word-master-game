import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clearQuizSnapshot, readQuizSnapshot, saveQuizSnapshot } from "@/lib/quiz-state";
import { useVocabularyMode, useWordsByMode, type Word } from "@/lib/words-store";
import { addScore, useUser } from "@/lib/user-store";

const searchSchema = z.object({
  lang: z.enum(["pt", "en"]).default("pt"),
});

export const Route = createFileRoute("/quiz")({
  validateSearch: searchSchema,
  component: Quiz,
  head: () => ({
    meta: [{ title: "Teste — Vocabulário" }],
  }),
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function Quiz() {
  const { lang } = Route.useSearch();
  const { mode } = useVocabularyMode();
  const { words } = useWordsByMode(mode);
  const { user } = useUser();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<Word[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<null | { correct: boolean; expected: string }>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [saved, setSaved] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  useEffect(() => {
    if (words === null) return;

    const snapshot = readQuizSnapshot();

    if (
      words.length > 0 &&
      snapshot &&
      snapshot.mode === mode &&
      snapshot.lang === lang &&
      snapshot.queue.length > 0 &&
      !snapshot.finished
    ) {
      setQueue(snapshot.queue);
      setIdx(snapshot.idx);
      setAnswer(snapshot.answer);
      setResult(snapshot.result);
      setScore(snapshot.score);
      setElapsedSeconds(snapshot.elapsedSeconds);
      setPaused(snapshot.paused);
      setFinished(snapshot.finished);
      setSaved(snapshot.saved);
      setStartedAt(snapshot.startedAt);
      return;
    }

    setQueue(shuffle(words));
    setIdx(0);
    setAnswer("");
    setResult(null);
    setScore({ right: 0, wrong: 0 });
    setElapsedSeconds(0);
    setPaused(false);
    setFinished(false);
    setSaved(false);
    setStartedAt(Date.now());
  }, [words, lang, mode]);

  useEffect(() => {
    if (paused || finished) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, finished]);

  useEffect(() => {
    if (queue.length === 0) return;

    saveQuizSnapshot({
      mode,
      lang,
      queue,
      idx,
      answer,
      result,
      score,
      elapsedSeconds,
      paused,
      finished,
      saved,
      startedAt,
    });
  }, [
    mode,
    lang,
    queue,
    idx,
    answer,
    result,
    score,
    elapsedSeconds,
    paused,
    finished,
    saved,
    startedAt,
  ]);

  const completed = idx >= queue.length;

  useEffect(() => {
    if (completed && !finished) {
      setFinished(true);
    }
  }, [completed, finished]);

  useEffect(() => {
    if ((!finished && !completed) || !user || saved) return;
    setSaved(true);
    clearQuizSnapshot();
    addScore({
      user,
      lang,
      right: score.right,
      wrong: score.wrong,
      total: queue.length,
      durationSeconds: elapsedSeconds,
    });
  }, [
    finished,
    completed,
    user,
    saved,
    lang,
    score.right,
    score.wrong,
    queue.length,
    elapsedSeconds,
  ]);

  const current = queue[idx];
  const { prompt, expected, promptLabel, answerLabel } = useMemo(() => {
    if (!current) return { prompt: "", expected: "", promptLabel: "", answerLabel: "" };
    if (lang === "pt") {
      return {
        prompt: current.en,
        expected: current.pt,
        promptLabel: "Palavra em inglês",
        answerLabel: "Escreva em português",
      };
    }
    return {
      prompt: current.pt,
      expected: current.en,
      promptLabel: "Palavra em português",
      answerLabel: "Escreva em inglês",
    };
  }, [current, lang]);

  if (words === null) {
    return <Loading>Carregando vocabulário...</Loading>;
  }

  if (words.length === 0) {
    return <Empty>Nenhuma palavra cadastrada. Volte e cadastre algumas primeiro.</Empty>;
  }

  function submit(e: FormEvent) {
    e.preventDefault();

    if (result) {
      next();
      return;
    }

    if (!current || paused || finished) return;
    if (!answer.trim()) return;

    const correct = normalize(answer) === normalize(expected);
    setResult({ correct, expected });
    setScore((s) => ({
      right: s.right + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
    }));
  }

  function next() {
    setIdx((i) => i + 1);
    setAnswer("");
    setResult(null);
  }

  function skipWord() {
    if (!current || paused || finished) return;
    setIdx((i) => i + 1);
    setAnswer("");
    setResult(null);
  }

  function finishGame() {
    setFinished(true);
    setPaused(false);
    setResult(null);
    clearQuizSnapshot();
  }

  function restart() {
    setQueue(shuffle(words));
    setIdx(0);
    setAnswer("");
    setResult(null);
    setScore({ right: 0, wrong: 0 });
    setElapsedSeconds(0);
    setPaused(false);
    setFinished(false);
    setSaved(false);
    setStartedAt(Date.now());
    clearQuizSnapshot();
  }

  const finishedView = finished || completed;

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
            ← Voltar
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{lang === "pt" ? "Modo: Português" : "Modo: Inglês"}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
              ⏱️ {formatDuration(elapsedSeconds)}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Teste</span>
              <span className="text-sm font-normal text-muted-foreground">
                {Math.min(idx + (finishedView ? 0 : 1), queue.length)} / {queue.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {finishedView ? (
              <div className="space-y-4 text-center">
                <h2 className="text-2xl font-semibold">Fim!</h2>
                <p className="text-muted-foreground">
                  Acertos: {score.right} · Erros: {score.wrong} · Tempo:{" "}
                  {formatDuration(elapsedSeconds)}
                </p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button onClick={restart}>Jogar de novo</Button>
                  <Button asChild variant="secondary">
                    <Link to="/">Início</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">{promptLabel}</p>
                  <p className="text-4xl font-bold">{prompt}</p>
                </div>

                {paused ? (
                  <div className="rounded-md border border-dashed p-4 text-center space-y-3">
                    <p className="font-medium">Jogo pausado</p>
                    <p className="text-sm text-muted-foreground">
                      Você pode continuar depois sem perder seu progresso.
                    </p>
                    <Button onClick={() => setPaused(false)} className="w-full">
                      Continuar
                    </Button>
                  </div>
                ) : (
                  <>
                    <form onSubmit={submit} className="space-y-3">
                      <Input
                        autoFocus
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder={answerLabel}
                      />
                      {!result ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button type="submit" className="w-full" disabled={!answer.trim()}>
                            Verificar
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full"
                            onClick={skipWord}
                          >
                            Pular palavra
                          </Button>
                        </div>
                      ) : (
                        <Button type="submit" className="w-full">
                          Próxima
                        </Button>
                      )}
                    </form>

                    {result && (
                      <div
                        className={`rounded-md p-3 text-sm ${
                          result.correct
                            ? "bg-primary/10 text-foreground"
                            : "bg-destructive/10 text-foreground"
                        }`}
                      >
                        {result.correct ? (
                          <p>✅ Correto!</p>
                        ) : (
                          <p>
                            ❌ Resposta correta: <strong>{result.expected}</strong>
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Acertos: {score.right}</span>
                      <span>Erros: {score.wrong}</span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button type="button" variant="secondary" onClick={() => setPaused(true)}>
                        Pausar
                      </Button>
                      <Button type="button" variant="destructive" onClick={finishGame}>
                        Finalizar jogo
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center space-y-4">
          <p>{children}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center space-y-4">
          <p>{children}</p>
          <Button asChild>
            <Link to="/">Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
