import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWords } from "@/lib/words-store";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Vocabulário — Inglês & Português" },
      { name: "description", content: "Cadastre palavras e treine seu vocabulário em inglês ou português." },
    ],
  }),
});

function Home() {
  const { words, add, remove } = useWords();
  const [en, setEn] = useState("");
  const [pt, setPt] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!en.trim() || !pt.trim()) return;
    add(en, pt);
    setEn("");
    setPt("");
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Vocabulário</h1>
          <p className="text-muted-foreground">
            Cadastre palavras e treine em inglês ou português.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Cadastrar palavra</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="en">Inglês</Label>
                  <Input
                    id="en"
                    value={en}
                    onChange={(e) => setEn(e.target.value)}
                    placeholder="apple"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt">Português</Label>
                  <Input
                    id="pt"
                    value={pt}
                    onChange={(e) => setPt(e.target.value)}
                    placeholder="maçã"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">Adicionar</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jogar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1" disabled={words.length === 0}>
              <Link to="/quiz" search={{ lang: "pt" }}>
                Responder em Português
              </Link>
            </Button>
            <Button asChild variant="secondary" className="flex-1" disabled={words.length === 0}>
              <Link to="/quiz" search={{ lang: "en" }}>
                Responder em Inglês
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Palavras cadastradas ({words.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {words.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma palavra ainda. Adicione a primeira acima.
              </p>
            ) : (
              <ul className="divide-y">
                {words.map((w) => (
                  <li key={w.id} className="flex items-center justify-between py-2 gap-2">
                    <span className="text-sm">
                      <strong>{w.en}</strong>
                      <span className="text-muted-foreground"> — {w.pt}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => remove(w.id)}>
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
