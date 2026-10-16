import { useQuery } from "@tanstack/react-query";
import type { AuthorTicketDetail } from "@bookleaf/shared";
import { Link, useParams } from "react-router-dom";
import { CategoryBadge, ErrorState, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { usePageTitle } from "../../lib/title";

export default function AuthorTicketPage() {
  const { ticketId = "" } = useParams();
  usePageTitle(ticketId || "Ticket");
  const query = useQuery({
    queryKey: ["author", "tickets", ticketId],
    queryFn: async () => (await api.get<AuthorTicketDetail>(`/author/tickets/${ticketId}`)).data,
    enabled: Boolean(ticketId),
  });

  if (query.isLoading) return <Skeleton className="h-80" />;
  if (query.isError || !query.data) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  const ticket = query.data;

  return (
    <div>
      <PageHeader
        title={ticket.subject}
        description={`${ticket.ticketId} · ${ticket.bookTitle ?? "General / Account Level"} · Opened ${formatDateTime(ticket.createdAt)}`}
        action={
          <Link to="/author/tickets" className="text-sm font-semibold text-primary">
            Back to tickets
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <CategoryBadge category={ticket.category} />
        <PriorityBadge priority={ticket.priority} />
        <StatusBadge status={ticket.status} />
      </div>
      <article className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Your query</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>
      </article>
      <section className="mt-6 grid gap-3">
        <h2 className="text-xl font-semibold">Replies</h2>
        {ticket.messages.length === 0 ? (
          <p className="text-sm text-muted">The support team has not replied yet. This page updates when a reply is sent.</p>
        ) : (
          ticket.messages.map((message) => (
            <article key={message.id} className="rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm font-semibold">
                {message.senderName} <span className="font-normal text-muted">· {message.senderRole === "ADMIN" ? "Support" : "Author"} · {formatDateTime(message.createdAt)}</span>
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
