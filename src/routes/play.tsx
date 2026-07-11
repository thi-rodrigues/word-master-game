import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWords } from "@/lib/words-store";
import { useUser } from "@/lib/user-store";

export const Route = createFileRoute("/play")({
  component: Play,
  head: () => ({ meta: [{ title: "Jogar — Vocabulário" }] }),
});

function Play() {
  const { words } = useWords();
  const { user } = useUser();

  if (!user) {
    return (
      <Centered>
        <p className="mb-4">Cadastre seu nome primeiro.</p>
        <Button asChild><Link to="/">Ir para o início</Link></Button>
      </Centered>
    );
  }

  if (words.length === 0) {
    return (
      <Centered>
        <p className="mb-4">Cadastre pelo menos uma palavra para jogar.</p>
        <Button asChild><Link to="/">Cadastrar palavras</Link></Button>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 pb-28">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Escolha o modo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link to="/quiz" search={{ lang: "pt" }}>Responder em Português</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/quiz" search={{ lang: "en" }}>Responder em Inglês</Link>
          </Button>
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
