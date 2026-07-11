import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, Play, Trophy, Home as HomeIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-store";

export function FloatingMenu() {
  const [open, setOpen] = useState(false);
  const { user, clearUser } = useUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!user) return null;

  const items = [
    { to: "/", label: "Início", icon: HomeIcon },
    { to: "/play", label: "Jogar", icon: Play },
    { to: "/ranking", label: "Ranking", icon: Trophy },
  ] as const;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open &&
        items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to;
          return (
            <Button
              key={item.to}
              asChild
              variant={active ? "default" : "secondary"}
              className="shadow-lg animate-in fade-in slide-in-from-bottom-2"
            >
              <Link to={item.to} onClick={() => setOpen(false)}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          );
        })}

      {open && (
        <Button
          variant="ghost"
          className="shadow-lg animate-in fade-in slide-in-from-bottom-2"
          onClick={() => {
            clearUser();
            setOpen(false);
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair ({user})
        </Button>
      )}

      <Button
        size="icon"
        className="h-14 w-14 rounded-full shadow-xl"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>
    </div>
  );
}
