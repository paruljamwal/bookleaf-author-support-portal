import { useQuery } from "@tanstack/react-query";
import type { AuthorBook } from "@bookleaf/shared";
import { isInProductionStatus, isPublishedStatus } from "@bookleaf/shared";
import { useMemo, useState } from "react";
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { formatDateOnly, formatInr } from "../../lib/format";
import { usePageTitle } from "../../lib/title";

type Filter = "all" | "published" | "production";

export default function BooksPage() {
  usePageTitle("My Books");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["author", "books"],
    queryFn: async () => (await api.get<{ items: AuthorBook[] }>("/author/books")).data.items,
    staleTime: 60_000,
  });

  const books = useMemo(() => {
    const items = query.data ?? [];
    return items.filter((book) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "published" && isPublishedStatus(book.status)) ||
        (filter === "production" && isInProductionStatus(book.status));
      const haystack = `${book.title} ${book.isbn ?? ""} ${book.genre ?? ""}`.toLowerCase();
      return matchesFilter && haystack.includes(search.trim().toLowerCase());
    });
  }, [filter, query.data, search]);

  return (
    <div>
      <PageHeader title="My Books" description="Titles on your account, including books still in production and royalty figures as supplied." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="book-search">
          Search books
        </label>
        <input
          id="book-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search title, ISBN, or genre"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm sm:max-w-xs"
        />
        {(
          [
            ["all", "All"],
            ["published", "Published"],
            ["production", "In production"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? "rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground"
                : "rounded-full border border-border bg-surface px-3 py-1 text-sm font-semibold"
            }
            aria-pressed={filter === value}
          >
            {label}
          </button>
        ))}
      </div>
      {query.isLoading ? <Skeleton className="h-64" /> : null}
      {query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data && books.length === 0 ? (
        <EmptyState
          title={search.trim() || filter !== "all" ? "No books match" : "No books yet"}
          body={
            search.trim() || filter !== "all"
              ? "Try a different search or status filter."
              : "Books linked to your account will appear here."
          }
        />
      ) : null}
      {books.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="min-w-[56rem] w-full text-left text-sm">
            <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
              <tr>
                {["Title", "ISBN", "Genre", "Published", "Status", "MRP", "Sold", "Earned", "Paid", "Pending", "Channels"].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.bookId} className="border-b border-border last:border-0">
                  <td className="px-3 py-3 font-semibold">{book.title}</td>
                  <td className="px-3 py-3">{book.isbn ?? "—"}</td>
                  <td className="px-3 py-3">{book.genre ?? "—"}</td>
                  <td className="px-3 py-3">{formatDateOnly(book.publicationDate)}</td>
                  <td className="px-3 py-3">
                    <Badge tone={isInProductionStatus(book.status) ? "progress" : "resolved"}>{book.status}</Badge>
                  </td>
                  <td className="px-3 py-3">{formatInr(book.mrp)}</td>
                  <td className="px-3 py-3">{book.totalCopiesSold}</td>
                  <td className="px-3 py-3">{formatInr(book.totalRoyaltyEarned)}</td>
                  <td className="px-3 py-3">{formatInr(book.royaltyPaid)}</td>
                  <td className="px-3 py-3">{formatInr(book.royaltyPending)}</td>
                  <td className="px-3 py-3">{book.availableOn.length > 0 ? book.availableOn.join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
