import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWords, type Word } from "@/lib/words-store";
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

function Quiz() {
  const { lang } = Route.useSearch();
  const { words } = useWords();
  const { user } = useUser();
  const navigate = useNavigate();

  const [queue, setQueue] = useState<Word[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<null | { correct: boolean; expected: string }>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const savedRef = useRef(false);

  useEffect(() => {
    setQueue(shuffle(words));
    setIdx(0);
    setAnswer("");
    setResult(null);
    setScore({ right: 0, wrong: 0 });
    savedRef.current = false;
  }, [words, lang]);

  const finishedNow = queue.length > 0 && idx >= queue.length;
  useEffect(() => {
    if (finishedNow && user && !savedRef.current) {
      savedRef.current = true;
      addScore({
        user,
        lang,
        right: score.right,
        wrong: score.wrong,
        total: queue.length,
      });
    }
  }, [finishedNow, user, lang, score.right, score.wrong, queue.length]);


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

  if (words.length === 0) {
    return (
      <Empty>
        Nenhuma palavra cadastrada. Volte e cadastre algumas primeiro.
      </Empty>
    );
  }

  const finished = idx >= queue.length;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!current || result) return;
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

  function restart() {
    setQueue(shuffle(words));
    setIdx(0);
    setAnswer("");
    setResult(null);
    setScore({ right: 0, wrong: 0 });
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
            ← Voltar
          </Button>
          <span className="text-sm text-muted-foreground">
            {lang === "pt" ? "Modo: Português" : "Modo: Inglês"}
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Teste</span>
              <span className="text-sm font-normal text-muted-foreground">
                {Math.min(idx + (finished ? 0 : 1), queue.length)} / {queue.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {finished ? (
              <div className="space-y-4 text-center">
                <h2 className="text-2xl font-semibold">Fim!</h2>
                <p className="text-muted-foreground">
                  Acertos: {score.right} · Erros: {score.wrong}
                </p>
                <div className="flex gap-3 justify-center">
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

                <form onSubmit={submit} className="space-y-3">
                  <Input
                    autoFocus
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder={answerLabel}
                    disabled={!!result}
                  />
                  {!result ? (
                    <Button type="submit" className="w-full" disabled={!answer.trim()}>
                      Verificar
                    </Button>
                  ) : (
                    <Button type="button" className="w-full" onClick={next}>
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
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
