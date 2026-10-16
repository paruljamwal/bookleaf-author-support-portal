import type { AuthUser } from "@bookleaf/shared";
import { BookOpen, LayoutDashboard, LifeBuoy, LogOut, Menu, Plus, Ticket, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSupportRealtime } from "../hooks/useRealtime";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Logo } from "./Logo";
import { useToast } from "./toast";
import { Button, PageSkeleton, cx } from "./ui";

const authorLinks = [
  { to: "/author", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/author/books", label: "My Books", icon: BookOpen, end: false },
  { to: "/author/tickets", label: "My Tickets", icon: Ticket, end: false },
  { to: "/author/tickets/new", label: "New query", icon: Plus, end: false },
];

const adminLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/tickets", label: "Ticket queue", icon: LifeBuoy, end: false },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const links = user?.role === "ADMIN" ? adminLinks : authorLinks;
  return (
    <nav className="grid gap-1" aria-label="Primary">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/author/tickets" ? pathname.startsWith("/author/tickets/new") : link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold",
              isActive ? "bg-accent text-primary" : "text-foreground hover:bg-background",
            )
          }
        >
          <link.icon aria-hidden="true" size={18} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Shell() {
  const { user, refetch } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const mode = useSupportRealtime(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const status =
    mode === "live"
      ? "Live updates"
      : mode === "reconnecting"
        ? "Polling while reconnecting"
        : "Polling every 8 seconds";
  const shortStatus = mode === "live" ? "Live" : "Polling";

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
      menuButton?.focus();
    };
  }, [menuOpen]);

  async function logout() {
    await api.post("/auth/logout");
    refetch();
    toast("You have signed out.");
    navigate("/login");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="hidden border-r border-border bg-surface lg:flex lg:flex-col lg:px-4 lg:py-5">
        <Brand />
        <div className="mt-8 flex-1">
          <NavItems />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              className="px-2 lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <div className="lg:hidden">
              <Brand compact />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase" aria-live="polite">
              <span className="sm:hidden">{shortStatus}</span>
              <span className="hidden sm:inline">{status}</span>
            </p>
            <UserChip user={user} />
            <Button variant="secondary" className="px-2 sm:px-4" onClick={() => void logout()}>
              <LogOut size={16} aria-hidden="true" />
              <span className="max-sm:sr-only">Log out</span>
            </Button>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="presentation">
          <button className="absolute inset-0 bg-foreground/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div
            ref={dialogRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface p-4 shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <Button ref={closeButtonRef} variant="ghost" className="px-2" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <X size={18} />
              </Button>
            </div>
            <NavItems onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-primary">
      <Logo className="h-9 w-9" />
      {compact ? null : (
        <div>
          <p className="font-serif text-base font-semibold text-foreground">BookLeaf</p>
          <p className="text-xs text-muted">Author Support</p>
        </div>
      )}
    </div>
  );
}

function UserChip({ user }: { user: AuthUser | null }) {
  if (!user) return null;
  return (
    <div className="hidden text-right sm:block">
      <p className="text-sm font-semibold">{user.name}</p>
      <p className="text-xs text-muted">{user.role === "ADMIN" ? "Admin" : "Author"}</p>
    </div>
  );
}
