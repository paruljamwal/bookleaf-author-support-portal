import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@bookleaf/shared";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  ref?: Ref<HTMLButtonElement>;
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-surface text-foreground hover:bg-accent",
    ghost: "text-foreground hover:bg-accent",
    danger: "bg-danger text-white hover:opacity-90",
  }[variant];
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl border border-border bg-surface p-5 shadow-sm", className)}>{children}</section>;
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-primary/30 focus:ring-2";

const badgeTone = {
  open: "bg-info-soft text-info",
  progress: "bg-warning-soft text-warning",
  resolved: "bg-success-soft text-success",
  closed: "bg-background text-muted",
  critical: "bg-danger-soft text-danger",
  high: "bg-warning-soft text-warning",
  medium: "bg-info-soft text-info",
  low: "bg-success-soft text-success",
  neutral: "bg-background text-muted",
};

export function Badge({ tone, children }: { tone: keyof typeof badgeTone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", badgeTone[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const tone = { OPEN: "open", IN_PROGRESS: "progress", RESOLVED: "resolved", CLOSED: "closed" } as const;
  return <Badge tone={tone[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority | null }) {
  if (!priority) return <Badge tone="neutral">Unset</Badge>;
  const tone = { CRITICAL: "critical", HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;
  return <Badge tone={tone[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function CategoryBadge({ category }: { category: TicketCategory | null }) {
  return <Badge tone="neutral">{category ? CATEGORY_LABELS[category] : "Pending review"}</Badge>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-danger/30 bg-danger-soft px-6 py-8" role="alert">
      <h2 className="text-lg font-semibold text-danger">We could not load this page</h2>
      <p className="mt-1 text-sm text-danger">{message}</p>
      <Button className="mt-4" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-border/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4 p-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
