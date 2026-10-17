import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AdminTicketSummary,
  type Paginated,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@bookleaf/shared";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CategoryBadge, EmptyState, ErrorState, PageHeader, PriorityBadge, Skeleton, StatusBadge } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { agingLabel, formatDateTime } from "../../lib/format";
import { usePageTitle } from "../../lib/title";

export default function QueuePage() {
  usePageTitle("Ticket queue");
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    status: (searchParams.get("status") ?? "") as TicketStatus | "",
    category: (searchParams.get("category") ?? "") as TicketCategory | "",
    priority: (searchParams.get("priority") ?? "") as TicketPriority | "",
    dateFrom: "",
    dateTo: "",
    page: 1,
  });
  const query = useQuery({
    queryKey: ["admin", "tickets", filters],
    queryFn: async () =>
      (
        await api.get<Paginated<AdminTicketSummary>>("/admin/tickets", {
          params: filters,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.items ?? [];
  const pages = useMemo(() => Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.limit ?? 20))), [query.data]);

  function update(partial: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...partial, page: partial.page ?? 1 }));
  }

  return (
    <div>
      <PageHeader title="Ticket queue" description="Unresolved tickets are listed first, with higher priority and older tickets ahead of newer ones." />
      <form className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 xl:grid-cols-5">
        <Select label="Status" value={filters.status} onChange={(value) => update({ status: value as TicketStatus | "" })} options={TICKET_STATUSES.map((status) => [status, STATUS_LABELS[status]])} />
        <Select label="Category" value={filters.category} onChange={(value) => update({ category: value as TicketCategory | "" })} options={TICKET_CATEGORIES.map((category) => [category, CATEGORY_LABELS[category]])} />
        <Select label="Priority" value={filters.priority} onChange={(value) => update({ priority: value as TicketPriority | "" })} options={TICKET_PRIORITIES.map((priority) => [priority, PRIORITY_LABELS[priority]])} />
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          From
          <input type="date" value={filters.dateFrom} onChange={(event) => update({ dateFrom: event.target.value })} className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 font-normal" />
        </label>
        <label className="grid min-w-0 gap-1 text-sm font-semibold">
          To
          <input type="date" value={filters.dateTo} onChange={(event) => update({ dateTo: event.target.value })} className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 font-normal" />
        </label>
      </form>
      {query.isLoading ? <Skeleton className="h-64" /> : null}
      {query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data && rows.length === 0 ? <EmptyState title="No tickets" body="Nothing matches these filters." /> : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="min-w-[72rem] w-full text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
              <tr>
                {["Ticket", "Author", "Subject", "Book", "Category", "Priority", "Status", "Assignee", "Opened", "Updated"].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((ticket) => {
                const aging = agingLabel(ticket.createdAt, ticket.status);
                const urgent = ticket.priority === "CRITICAL" || ticket.priority === "HIGH";
                return (
                  <tr key={ticket.ticketId} className={urgent && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" ? "bg-warning-soft/40" : undefined}>
                    <td className="px-3 py-3 font-semibold">
                      <Link className="text-primary" to={`/admin/tickets/${ticket.ticketId}`}>{ticket.ticketId}</Link>
                      {aging ? <span className="mt-1 block text-xs font-semibold text-warning">Aging · {aging}</span> : null}
                      {ticket.priority === "CRITICAL" ? <span className="mt-1 block text-xs font-semibold text-danger">Urgent</span> : null}
                    </td>
                    <td className="px-3 py-3">{ticket.authorName}</td>
                    <td className="px-3 py-3">{ticket.subject}</td>
                    <td className="px-3 py-3">{ticket.bookTitle ?? "General"}</td>
                    <td className="px-3 py-3"><CategoryBadge category={ticket.category} /></td>
                    <td className="px-3 py-3"><PriorityBadge priority={ticket.priority} /></td>
                    <td className="px-3 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="px-3 py-3">{ticket.assigneeName ?? "Unassigned"}</td>
                    <td className="px-3 py-3">{formatDateTime(ticket.createdAt)}</td>
                    <td className="px-3 py-3">{formatDateTime(ticket.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {query.data && query.data.total > query.data.limit ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p>
            Page {query.data.page} of {pages}
          </p>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-border px-3 py-1" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>
              Previous
            </button>
            <button type="button" className="rounded-lg border border-border px-3 py-1" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })}>
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (readonly [string, string])[];
}) {
  return (
    <label className="grid min-w-0 gap-1 text-sm font-semibold">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 font-normal">
        <option value="">Any</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
