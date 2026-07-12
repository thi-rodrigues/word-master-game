import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVocabularyMode, useWordsByMode, uniqueCategories, wordCategory } from "@/lib/words-store";
import { useUser } from "@/lib/user-store";

export const Route = createFileRoute("/play")({
  component: Play,
  head: () => ({ meta: [{ title: "Jogar — Vocabulário" }] }),
});

type Selection = { kind: "random" } | { kind: "categories"; values: string[] };

function Play() {
  const { mode } = useVocabularyMode();
  const { words } = useWordsByMode(mode);
  const { user } = useUser();
  const navigate = useNavigate();
  const [selection, setSelection] = useState<Selection>({ kind: "random" });

  const categories = useMemo(() => (words ? uniqueCategories(words) : []), [words]);

  const countsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    (words ?? []).forEach((w) => {
      const key = wordCategory(w);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [words]);

  if (!user) {
    return (
      <Centered>
        <p className="mb-4">Cadastre seu nome primeiro.</p>
        <Button asChild>
          <Link to="/">Ir para o início</Link>
        </Button>
      </Centered>
    );
  }

  if (words === null) {
    return (
      <Centered>
        <p className="mb-4">Carregando vocabulário...</p>
      </Centered>
    );
  }

  if (words.length === 0) {
    return (
      <Centered>
        <p className="mb-4">
          {mode === "shared"
            ? "O vocabulário compartilhado está vazio no momento."
            : "Cadastre pelo menos uma palavra para jogar."}
        </p>
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      </Centered>
    );
  }

  const selectedCategories = selection.kind === "categories" ? selection.values : [];
  const categoriesParam = selectedCategories.length > 0 ? selectedCategories.join(",") : undefined;

  const filteredCount =
    selection.kind === "random"
      ? words.length
      : (words ?? []).filter((w) => selectedCategories.includes(wordCategory(w))).length;

  const canStart =
    selection.kind === "random" ||
    (selection.kind === "categories" && selectedCategories.length > 0 && filteredCount > 0);

  function toggleCategory(cat: string) {
    setSelection((current) => {
      const values = current.kind === "categories" ? current.values : [];
      const next = values.includes(cat) ? values.filter((v) => v !== cat) : [...values, cat];
      return { kind: "categories", values: next };
    });
  }

  function start(lang: "pt" | "en") {
    navigate({
      to: "/quiz",
      search: categoriesParam ? { lang, categories: categoriesParam } : { lang },
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10 pb-28">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Escolha o modo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-center text-sm text-muted-foreground">
            Vocabulário atual: {mode === "shared" ? "Compartilhado" : "Próprio"}
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Palavras</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={selection.kind === "random" ? "default" : "secondary"}
                onClick={() => setSelection({ kind: "random" })}
              >
                Aleatórias (todas)
              </Button>
              <Button
                type="button"
                variant={selection.kind === "categories" ? "default" : "secondary"}
                onClick={() =>
                  setSelection((s) =>
                    s.kind === "categories" ? s : { kind: "categories", values: [] },
                  )
                }
              >
                Escolher categorias
              </Button>
            </div>
          </div>

          {selection.kind === "categories" && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs text-muted-foreground">
                Selecione uma ou mais categorias ({filteredCount} palavra
                {filteredCount === 1 ? "" : "s"})
              </p>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma categoria disponível.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const active = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        {cat} ({countsByCategory.get(cat) ?? 0})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Button size="lg" disabled={!canStart} onClick={() => start("pt")}>
              Responder em Português
            </Button>
            <Button
              size="lg"
              variant="secondary"
              disabled={!canStart}
              onClick={() => start("en")}
            >
              Responder em Inglês
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">{children}</CardContent>
      </Card>
    </div>
  );
}
