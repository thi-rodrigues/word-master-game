import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVocabularyMode, useWords, uniqueCategories, wordCategory, type VocabularyMode } from "@/lib/words-store";
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

function PageSizeSelector({
  pageSize,
  onChange,
}: {
  pageSize: number;
  onChange: (nextSize: number) => void;
}) {
  const options = [5, 10, 25];

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Itens por página</span>
      <div className="flex gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={pageSize === option ? "default" : "secondary"}
            onClick={() => onChange(option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

function WordManager({ user }: { user: string }) {
  const { words, add, remove } = useWords();
  const [en, setEn] = useState("");
  const [pt, setPt] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const existingCategories = useMemo(() => uniqueCategories(words), [words]);

  const filteredWords = useMemo(() => {
    if (!categoryFilter) return words;
    return words.filter((w) => wordCategory(w) === categoryFilter);
  }, [words, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const visibleWords = useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredWords.slice(from, from + pageSize);
  }, [page, pageSize, filteredWords]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const cleanEn = en.trim();
    const cleanPt = pt.trim();
    const cleanCategory = category.trim();
    if (!cleanEn || !cleanPt) return;

    const added = await add(cleanEn, cleanPt, cleanCategory);
    if (!added) {
      setSuccess("");
      setError("Essa palavra já está cadastrada.");
      return;
    }

    setError("");
    setSuccess("Palavra adicionada com sucesso.");
    setEn("");
    setPt("");
    setCategory("");
    setPage(1);
  }

  function clearFeedback() {
    if (error) setError("");
    if (success) setSuccess("");
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
                      clearFeedback();
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
                      clearFeedback();
                    }}
                    placeholder="maçã"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria (tópico)</Label>
                <Input
                  id="category"
                  list="category-suggestions"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    clearFeedback();
                  }}
                  placeholder="Ex.: Cores, Animais, Itens da cozinha"
                />
                <datalist id="category-suggestions">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">
                  Opcional. Palavras sem categoria ficam em "Sem categoria".
                </p>
              </div>

              {error ? (
                <p className="text-sm text-destructive" aria-live="polite">
                  {error}
                </p>
              ) : null}

              {success ? (
                <p className="text-sm text-emerald-600" aria-live="polite">
                  {success}
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
          <CardContent className="space-y-4">
            {existingCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Filtrar:</span>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("");
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    categoryFilter === ""
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  }`}
                >
                  Todas
                </button>
                {existingCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategoryFilter(cat);
                      setPage(1);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      categoryFilter === cat
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <PageSizeSelector
              pageSize={pageSize}
              onChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
            />

            {filteredWords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {words.length === 0
                  ? "Nenhuma palavra ainda. Adicione a primeira acima."
                  : "Nenhuma palavra nesta categoria."}
              </p>
            ) : (
              <>
                <ul className="divide-y">
                  {visibleWords.map((w) => (
                    <li key={w.id} className="flex items-center justify-between py-2 gap-2">
                      <span className="text-sm">
                        <strong>{w.en}</strong>
                        <span className="text-muted-foreground"> — {w.pt}</span>
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {wordCategory(w)}
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void remove(w.id);
                        }}
                      >
                        Remover
                      </Button>
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((curr) => Math.max(1, curr - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => setPage((curr) => Math.min(totalPages, curr + 1))}
                  >
                    Próxima
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
