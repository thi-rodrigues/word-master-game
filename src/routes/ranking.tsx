import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScores } from "@/lib/user-store";

export const Route = createFileRoute("/ranking")({
  component: Ranking,
  head: () => ({ meta: [{ title: "Ranking — Vocabulário" }] }),
});

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeRange(startedAt: number, finishedAt: number): string {
  const startDate = new Date(startedAt);
  const endDate = new Date(finishedAt);
  const sameDay = startDate.toDateString() === endDate.toDateString();

  if (sameDay) {
    return `${formatDate(startedAt)} · ${formatTime(startedAt)} - ${formatTime(finishedAt)}`;
  }

  return `${formatDate(startedAt)} ${formatTime(startedAt)} - ${formatDate(finishedAt)} ${formatTime(finishedAt)}`;
}

function Ranking() {
  const { scores } = useScores();

  const rows = [...scores]
    .sort((a, b) => b.at - a.at)
    .map((score) => ({
      ...score,
      pct: score.total ? Math.round((score.right / score.total) * 100) : 0,
    }));

  return (
    <div className="min-h-screen bg-background py-10 px-4 pb-28">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold">Ranking</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Jogadas</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">Nenhuma partida registrada ainda.</p>
                <Button asChild>
                  <Link to="/play">Jogar agora</Link>
                </Button>
              </div>
            ) : (
              <ol className="divide-y">
                {rows.map((score, i) => (
                  <li key={score.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold w-6 text-center text-muted-foreground">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{score.user}</p>
                        <p className="text-xs text-muted-foreground">
                          {score.lang === "pt" ? "Português" : "Inglês"} ·{" "}
                          {formatDuration(score.durationSeconds)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTimeRange(score.startedAt, score.finishedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{score.pct}%</p>
                      <p className="text-xs text-muted-foreground">
                        {score.right}/{score.total} acertos
                      </p>
                      <p className="text-xs text-muted-foreground">{score.wrong} erros</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
