import { useQuery } from "@tanstack/react-query";
import type { AdminDashboard } from "@bookleaf/shared";
import { Link } from "react-router-dom";
import { CategoryBadge, ErrorState, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { usePageTitle } from "../../lib/title";

export default function AdminDashboardPage() {
  usePageTitle("Admin dashboard");
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => (await api.get<AdminDashboard>("/admin/dashboard")).data,
  });

  if (query.isLoading) return <Skeleton className="h-64" />;
  if (query.isError || !query.data) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  const stats = [
    ["Total", data.totalTickets, ""],
    ["Open", data.openTickets, "status=OPEN"],
    ["In progress", data.inProgressTickets, "status=IN_PROGRESS"],
    ["High or critical", data.highOrCriticalTickets, ""],
    ["Resolved", data.resolvedTickets, "status=RESOLVED"],
  ];

  return (
    <div>
      <PageHeader title="Support dashboard" description="Counts come from the current ticket queue." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map(([label, value, filter]) => (
          <Link key={String(label)} to={`/admin/tickets${filter ? `?${filter}` : ""}`} className="rounded-2xl border border-border bg-surface p-4 hover:bg-accent">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </Link>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Needs attention</h2>
        {data.urgentTickets.length === 0 ? (
          <p className="mt-3 text-sm text-muted">There are no open tickets.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface">
            {data.urgentTickets.map((ticket) => (
              <li key={ticket.ticketId}>
                <Link to={`/admin/tickets/${ticket.ticketId}`} className="grid gap-2 px-4 py-3 hover:bg-accent md:grid-cols-[1fr_auto] md:items-center">
                  <span>
                    <span className="font-semibold">{ticket.subject}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {ticket.ticketId} · {ticket.authorName} · {formatDateTime(ticket.createdAt)}
                    </span>
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
