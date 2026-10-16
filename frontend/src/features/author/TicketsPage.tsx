import { useQuery } from "@tanstack/react-query";
import type { TicketSummary } from "@bookleaf/shared";
import { Link } from "react-router-dom";
import { CategoryBadge, EmptyState, ErrorState, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { usePageTitle } from "../../lib/title";

export default function TicketsPage() {
  usePageTitle("My Tickets");
  const query = useQuery({
    queryKey: ["author", "tickets"],
    queryFn: async () => (await api.get<{ items: TicketSummary[] }>("/author/tickets")).data.items,
  });

  return (
    <div>
      <PageHeader
        title="My Tickets"
        description="Queries you have sent, with the current status and any reply from the support team."
        action={
          <Link to="/author/tickets/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            New query
          </Link>
        }
      />
      {query.isLoading ? <Skeleton className="h-48" /> : null}
      {query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data && query.data.length === 0 ? (
        <EmptyState title="No tickets yet" body="When you submit a query, it will appear here." />
      ) : null}
      {query.data && query.data.length > 0 ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {query.data.map((ticket) => (
            <li key={ticket.ticketId}>
              <Link to={`/author/tickets/${ticket.ticketId}`} className="grid gap-3 px-4 py-4 hover:bg-accent md:grid-cols-[8rem_1fr_auto] md:items-center">
                <span className="text-sm font-semibold text-primary">{ticket.ticketId}</span>
                <span>
                  <span className="block font-semibold">{ticket.subject}</span>
                  <span className="text-sm text-muted">{ticket.bookTitle ?? "General / Account Level"} · Updated {formatDateTime(ticket.updatedAt)}</span>
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
      ) : null}
    </div>
  );
}
