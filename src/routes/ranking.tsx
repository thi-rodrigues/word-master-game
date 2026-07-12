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

function Ranking() {
  const { scores } = useScores();

  const agg = new Map<
    string,
    { user: string; right: number; total: number; games: number; bestDuration: number | null }
  >();

  for (const s of scores) {
    const cur = agg.get(s.user) ?? {
      user: s.user,
      right: 0,
      total: 0,
      games: 0,
      bestDuration: null,
    };

    cur.right += s.right;
    cur.total += s.total;
    cur.games += 1;
    cur.bestDuration =
      cur.bestDuration === null || s.durationSeconds < cur.bestDuration
        ? s.durationSeconds
        : cur.bestDuration;
    agg.set(s.user, cur);
  }

  const rows = [...agg.values()]
    .map((r) => ({
      ...r,
      pct: r.total ? Math.round((r.right / r.total) * 100) : 0,
    }))
    .sort(
      (a, b) =>
        b.pct - a.pct ||
        (a.bestDuration ?? Number.POSITIVE_INFINITY) - (b.bestDuration ?? Number.POSITIVE_INFINITY),
    );

  return (
    <div className="min-h-screen bg-background py-10 px-4 pb-28">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold">Ranking</h1>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Jogadores</CardTitle>
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
                {rows.map((r, i) => (
                  <li key={r.user} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold w-6 text-center text-muted-foreground">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium">{r.user}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.games} {r.games === 1 ? "partida" : "partidas"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{r.pct}%</p>
                      <p className="text-xs text-muted-foreground">
                        {r.right}/{r.total} acertos
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Melhor tempo:{" "}
                        {r.bestDuration === null ? "--:--" : formatDuration(r.bestDuration)}
                      </p>
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
