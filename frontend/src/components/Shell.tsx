import type { AuthUser } from "@bookleaf/shared";
import { BookOpen, LayoutDashboard, LifeBuoy, LogOut, Menu, Plus, RefreshCw, Ticket, UserRound, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSupportRealtime, type RealtimeMode } from "../hooks/useRealtime";
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
              "flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold",
              isActive
                ? "bg-accent text-primary shadow-[inset_3px_0_0_0_var(--color-primary)]"
                : "text-foreground hover:bg-background",
            )
          }
        >
          <span className="grid size-5 shrink-0 place-items-center">
            <link.icon aria-hidden="true" size={18} />
          </span>
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
      <aside className="hidden border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto lg:px-3 lg:py-4">
        <div className="px-1.5">
          <Brand />
        </div>
        <div className="mt-5 flex-1">
          <NavItems />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="sm"
              className="w-8 px-0"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <Brand compact />
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <ConnectionStatus mode={mode} />
            <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border bg-surface py-1 pr-1 pl-1.5">
              <UserChip user={user} />
              <Button variant="secondary" size="sm" aria-label="Log out" onClick={() => void logout()}>
                <LogOut size={14} aria-hidden="true" />
                <span className="hidden md:inline">Log out</span>
              </Button>
            </div>
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
    <div className="flex h-10 items-center gap-2.5 text-primary">
      <span className={cx("grid shrink-0 place-items-center", compact ? "size-8" : "size-10")}>
        <Logo className={compact ? "size-8" : "size-10"} />
      </span>
      <div className="min-w-0 leading-none">
        <p className={cx("truncate font-serif font-semibold text-foreground", compact ? "text-sm" : "text-base")}>BookLeaf</p>
        {compact ? null : <p className="mt-1 text-xs text-muted">Author Support</p>}
      </div>
    </div>
  );
}

function ConnectionStatus({ mode }: { mode: RealtimeMode }) {
  if (mode === "live") {
    return (
      <p className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground" aria-live="polite">
        <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
        Live
      </p>
    );
  }
  const reconnecting = mode === "reconnecting";
  return (
    <p className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-xs font-medium text-muted" aria-live="polite">
      <RefreshCw size={14} aria-hidden="true" />
      <span className="hidden sm:inline">Auto-refresh · 8s</span>
      <span className="sr-only sm:hidden">Auto-refresh every 8 seconds.</span>
      {reconnecting ? <span className="sr-only">Reconnecting.</span> : null}
    </p>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (!first) return "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return `${first[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function UserChip({ user }: { user: AuthUser | null }) {
  if (!user) return null;
  const role = user.role === "ADMIN" ? "Admin" : "Author";
  const mark = initials(user.name);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground" aria-hidden="true">
        {mark || <UserRound size={14} />}
      </span>
      <div className="hidden min-w-0 max-w-36 sm:block">
        <p className="truncate text-sm leading-4 font-semibold">{user.name}</p>
        <p className="text-xs leading-4 text-muted">{role}</p>
      </div>
      <span className="sr-only sm:hidden">
        {user.name}, {role}
      </span>
    </div>
  );
}
