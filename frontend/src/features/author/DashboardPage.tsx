import { useQuery } from "@tanstack/react-query";
import type { AuthorDashboard } from "@bookleaf/shared";
import { Link } from "react-router-dom";
import { CategoryBadge, ErrorState, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateOnly, formatDateTime, formatInr } from "../../lib/format";
import { usePageTitle } from "../../lib/title";

export default function AuthorDashboardPage() {
  usePageTitle("Dashboard");
  const query = useQuery({
    queryKey: ["author", "dashboard"],
    queryFn: async () => (await api.get<AuthorDashboard>("/author/dashboard")).data,
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }

  const data = query.data;
  const stats = [
    ["Books", String(data.totalBooks)],
    ["Published", String(data.publishedBooks)],
    ["In production", String(data.booksInProduction)],
    ["Open tickets", String(data.openTickets)],
    ["Pending royalties", formatInr(data.pendingRoyalties)],
  ];

  return (
    <div>
      <PageHeader
        title={`Hello, ${data.author.name.split(" ")[0]}`}
        description={[data.author.city, `joined ${formatDateOnly(data.author.joinedDate)}`].filter(Boolean).join(" · ")}
        action={
          <Link to="/author/tickets/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            New query
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([label, value]) => (
          <article key={label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Recent tickets</h2>
        {data.recentTickets.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You have not submitted a query yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {data.recentTickets.map((ticket) => (
              <li key={ticket.ticketId}>
                <Link to={`/author/tickets/${ticket.ticketId}`} className="grid gap-2 px-4 py-3 hover:bg-accent sm:grid-cols-[1fr_auto] sm:items-center">
                  <span>
                    <span className="block font-semibold">{ticket.subject}</span>
                    <span className="text-xs text-muted">{ticket.ticketId} · {formatDateTime(ticket.updatedAt)}</span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <CategoryBadge category={ticket.category} />
                    <PriorityBadge priority={ticket.priority} />
                    <StatusBadge status={ticket.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
