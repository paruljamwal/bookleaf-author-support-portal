import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AdminTicketDetail,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@bookleaf/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useToast } from "../../components/toast";
import { Button, CategoryBadge, ErrorState, PageHeader, PriorityBadge, Skeleton, StatusBadge, inputClass } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateOnly, formatDateTime, formatInr } from "../../lib/format";
import { usePageTitle } from "../../lib/title";

function sourceLabel(source: string | null): string {
  if (source === "AI") return "language model";
  if (source === "FALLBACK") return "local fallback, not a live model";
  if (source === "ADMIN") return "admin";
  return "unset";
}

export default function AdminTicketPage() {
  const { ticketId = "" } = useParams();
  usePageTitle(ticketId || "Ticket");
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({
    queryKey: ["admin", "tickets", ticketId],
    queryFn: async () => (await api.get<AdminTicketDetail>(`/admin/tickets/${ticketId}`)).data,
    enabled: Boolean(ticketId),
  });
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data || loadedId === query.data.ticketId) return;
    setDraft(query.data.draft?.response ?? "");
    setLoadedId(query.data.ticketId);
  }, [loadedId, query.data]);

  function refresh(message: string, next?: AdminTicketDetail) {
    toast(message);
    if (next) queryClient.setQueryData(["admin", "tickets", ticketId], next);
    void queryClient.invalidateQueries({
      queryKey: ["admin"],
      predicate: (query) => query.queryKey[1] !== "tickets" || query.queryKey[2] !== ticketId,
    });
  }

  const update = useMutation({
    mutationFn: (body: { category?: TicketCategory; priority?: TicketPriority; status?: TicketStatus }) =>
      api.patch<AdminTicketDetail>(`/admin/tickets/${ticketId}`, body),
    onSuccess: (response) => refresh("Ticket updated.", response.data),
    onError: (error) => toast(errorMessage(error), "error"),
  });
  const assign = useMutation({
    mutationFn: () => api.post<AdminTicketDetail>(`/admin/tickets/${ticketId}/assign`),
    onSuccess: (response) => refresh("Ticket assigned to you.", response.data),
    onError: (error) => toast(errorMessage(error), "error"),
  });
  const classify = useMutation({
    mutationFn: () => api.post<AdminTicketDetail>(`/admin/tickets/${ticketId}/classify`),
    onSuccess: (response) => refresh("Classification updated.", response.data),
    onError: (error) => toast(errorMessage(error), "error"),
  });
  const regenerate = useMutation({
    mutationFn: () => api.post<AdminTicketDetail>(`/admin/tickets/${ticketId}/draft`),
    onSuccess: (response) => {
      setDraft(response.data.draft?.response ?? "");
      refresh("A new draft is ready to review.", response.data);
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });
  const saveDraft = useMutation({
    mutationFn: () => api.patch<AdminTicketDetail>(`/admin/tickets/${ticketId}/draft`, { response: draft }),
    onSuccess: (response) => refresh("Draft saved. It has not been sent.", response.data),
    onError: (error) => toast(errorMessage(error), "error"),
  });
  const send = useMutation({
    mutationFn: () => api.post<AdminTicketDetail>(`/admin/tickets/${ticketId}/replies`, { body: draft }),
    onSuccess: (response) => refresh("Reply sent to the author.", response.data),
    onError: (error) => toast(errorMessage(error), "error"),
  });
  const addNote = useMutation({
    mutationFn: () => api.post<AdminTicketDetail>(`/admin/tickets/${ticketId}/notes`, { body: note }),
    onSuccess: (response) => {
      setNote("");
      refresh("Internal note added.", response.data);
    },
    onError: (error) => toast(errorMessage(error), "error"),
  });

  if (query.isLoading) return <Skeleton className="h-96" />;
  if (query.isError || !query.data) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  }
  const ticket = query.data;

  return (
    <div>
      <PageHeader
        title={ticket.subject}
        description={[ticket.ticketId, ticket.authorName, ticket.authorCity].filter(Boolean).join(" · ")}
        action={
          <Link to="/admin/tickets" className="text-sm font-semibold text-primary">
            Back to queue
          </Link>
        }
      />
      {ticket.aiProcessingState === "FAILED" || ticket.aiProcessingState === "FALLBACK" ? (
        <p className="mb-4 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          {ticket.aiFailureMessage ?? "Automatic classification is unavailable. Set the category and priority manually."}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-4">
          <article className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Original query</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>
            <p className="mt-3 text-xs text-muted">Opened {formatDateTime(ticket.createdAt)}</p>
          </article>
          <BookFacts ticket={ticket} />
          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Conversation</h2>
            {ticket.replies.length === 0 ? <p className="text-sm text-muted">No author-visible reply has been sent.</p> : null}
            {ticket.replies.map((message) => (
              <article key={message.id} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs font-semibold tracking-wide text-success uppercase">Sent reply</p>
                <p className="mt-1 text-sm font-semibold">{message.senderName} · {formatDateTime(message.createdAt)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
              </article>
            ))}
          </section>
          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg font-semibold">Response draft</h2>
            <p className="mt-1 text-sm text-muted">
              {ticket.draft?.source === "AI" ? "AI suggestion" : ticket.draft?.source === "FALLBACK" ? "Fallback suggestion" : "Draft"}{" "}
              {ticket.draft?.editedByAdmin ? "· edited by an admin" : ""}
              {ticket.draft?.requiresHumanVerification ? " · needs verification before you rely on operational claims" : ""}
            </p>
            <p className="mt-2 text-sm">This draft is not sent until you click Send reply.</p>
            <textarea className={`${inputClass} mt-3 min-h-48`} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Response draft" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
                {regenerate.isPending ? "Drafting…" : "Generate draft"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending || draft.trim().length < 20}>
                Save draft
              </Button>
              <Button type="button" onClick={() => send.mutate()} disabled={send.isPending || draft.trim().length < 2}>
                {send.isPending ? "Sending…" : "Send reply"}
              </Button>
            </div>
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Classification</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <CategoryBadge category={ticket.category} />
              <PriorityBadge priority={ticket.priority} />
              <StatusBadge status={ticket.status} />
            </div>
            <p className="mt-3 text-sm text-muted">
              Category source: {sourceLabel(ticket.categorySource)}. Priority source: {sourceLabel(ticket.prioritySource)}.
            </p>
            {ticket.aiCategory && ticket.categorySource === "ADMIN" ? (
              <p className="mt-2 text-sm">Original suggestion: {CATEGORY_LABELS[ticket.aiCategory]} / {ticket.aiPriority ? PRIORITY_LABELS[ticket.aiPriority] : "unset"}.</p>
            ) : null}
            {ticket.reasoningSummary ? <p className="mt-2 text-sm">{ticket.reasoningSummary}</p> : null}
            <label className="mt-3 grid gap-1 text-sm font-semibold">
              Category
              <select className={inputClass} value={ticket.category ?? ""} onChange={(event) => update.mutate({ category: event.target.value as TicketCategory })}>
                <option value="" disabled>Select</option>
                {TICKET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-sm font-semibold">
              Priority
              <select className={inputClass} value={ticket.priority ?? ""} onChange={(event) => update.mutate({ priority: event.target.value as TicketPriority })}>
                <option value="" disabled>Select</option>
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-sm font-semibold">
              Status
              <select className={inputClass} value={ticket.status} onChange={(event) => update.mutate({ status: event.target.value as TicketStatus })}>
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => assign.mutate()} disabled={assign.isPending}>
                {ticket.assigneeName ? `Assigned: ${ticket.assigneeName}` : "Assign to me"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => classify.mutate()} disabled={classify.isPending}>
                Run classification
              </Button>
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">Internal notes</h2>
            <p className="mt-1 text-sm text-muted">Visible to admins only.</p>
            <ul className="mt-3 grid gap-2">
              {ticket.internalNotes.map((item) => (
                <li key={item.id} className="rounded-lg bg-background px-3 py-2 text-sm">
                  <span className="font-semibold">{item.senderName}</span>
                  <span className="text-muted"> · {formatDateTime(item.createdAt)}</span>
                  <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
                </li>
              ))}
            </ul>
            <label className="mt-3 grid gap-1 text-sm font-semibold" htmlFor="internal-note">
              Add a note
              <textarea id="internal-note" className={inputClass} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <Button className="mt-3" type="button" variant="secondary" disabled={note.trim().length < 2 || addNote.isPending} onClick={() => addNote.mutate()}>
              Add internal note
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

function BookFacts({ ticket }: { ticket: AdminTicketDetail }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Account</h2>
      <p className="mt-2 text-sm">{ticket.authorEmail}</p>
      {ticket.book ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Book</dt><dd className="font-semibold">{ticket.book.title}</dd></div>
          <div><dt className="text-muted">Status</dt><dd>{ticket.book.status}</dd></div>
          <div><dt className="text-muted">ISBN</dt><dd>{ticket.book.isbn ?? "—"}</dd></div>
          <div><dt className="text-muted">Published</dt><dd>{formatDateOnly(ticket.book.publicationDate)}</dd></div>
          <div><dt className="text-muted">Royalty pending</dt><dd>{formatInr(ticket.book.royaltyPending)}</dd></div>
          <div><dt className="text-muted">Last payout</dt><dd>{formatDateOnly(ticket.book.lastRoyaltyPayoutDate)}</dd></div>
        </dl>
      ) : (
        <p className="mt-2 text-sm">General / Account Level</p>
      )}
    </article>
  );
}
