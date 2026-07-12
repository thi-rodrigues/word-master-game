import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVocabularyMode, useWords, type VocabularyMode } from "@/lib/words-store";
import { useUser } from "@/lib/user-store";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "Vocabulário — Inglês & Português" },
      {
        name: "description",
        content: "Cadastre palavras e treine seu vocabulário em inglês ou português.",
      },
    ],
  }),
});

function Home() {
  const { user, setUser, isReady } = useUser();
  const { setMode } = useVocabularyMode();
  const [name, setName] = useState("");
  const [mode, setSelectedMode] = useState<VocabularyMode>("shared");
  const navigate = useNavigate();

  function onRegister(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setUser(name);
    setMode(mode);

    if (mode === "shared") {
      navigate({ to: "/play" });
    }
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Carregando...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Bem-vindo!</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite seu nome"
                />
              </div>

              <div className="space-y-2">
                <Label>Escolha o vocabulário</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={mode === "shared" ? "default" : "secondary"}
                    onClick={() => setSelectedMode("shared")}
                  >
                    Compartilhado
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "custom" ? "default" : "secondary"}
                    onClick={() => setSelectedMode("custom")}
                  >
                    Meu próprio
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === "shared"
                    ? "Usar o vocabulário compartilhado pelos usuários."
                    : "Criar e editar o seu próprio vocabulário."}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={!name.trim()}>
                Começar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <WordManager user={user} />;
}

function WordManager({ user }: { user: string }) {
  const { words, add, remove } = useWords();
  const [en, setEn] = useState("");
  const [pt, setPt] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const cleanEn = en.trim();
    const cleanPt = pt.trim();
    if (!cleanEn || !cleanPt) return;

    const added = await add(cleanEn, cleanPt);
    if (!added) {
      setError("Essa palavra já está cadastrada.");
      return;
    }

    setError("");
    setEn("");
    setPt("");
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4 pb-28">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Vocabulário</h1>
          <p className="text-muted-foreground">Olá, {user}! Cadastre palavras para treinar.</p>
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
                    onChange={(e) => {
                      setEn(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="apple"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt">Português</Label>
                  <Input
                    id="pt"
                    value={pt}
                    onChange={(e) => {
                      setPt(e.target.value);
                      if (error) setError("");
                    }}
                    placeholder="maçã"
                  />
                </div>
              </div>

              {error ? (
                <p className="text-sm text-destructive" aria-live="polite">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full">
                Adicionar
              </Button>
            </form>
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
