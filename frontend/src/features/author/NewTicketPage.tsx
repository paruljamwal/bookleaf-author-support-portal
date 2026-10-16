import { zodResolver } from "@hookform/resolvers/zod";
import { createTicketSchema, type AuthorBook } from "@bookleaf/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button, ErrorState, Field, PageHeader, Skeleton, inputClass } from "../../components/ui";
import { useToast } from "../../components/toast";
import { api, errorMessage } from "../../lib/api";
import { usePageTitle } from "../../lib/title";

const formSchema = z.object({
  bookId: z.string(),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters.").max(140),
  description: z.string().trim().min(20, "Description must be at least 20 characters.").max(5000),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTicketPage() {
  usePageTitle("New query");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const books = useQuery({
    queryKey: ["author", "books"],
    queryFn: async () => (await api.get<{ items: AuthorBook[] }>("/author/books")).data.items,
    staleTime: 60_000,
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { bookId: "", subject: "", description: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const payload = createTicketSchema.parse({ ...values, bookId: values.bookId || null });
      const response = await api.post<{ ticketId: string }>("/author/tickets", payload);
      await queryClient.invalidateQueries({
        queryKey: ["author"],
        predicate: (query) => query.queryKey[1] !== "books",
      });
      toast("Your query has been submitted.");
      navigate(`/author/tickets/${response.data.ticketId}`);
    } catch (error) {
      form.setError("root", { message: errorMessage(error) });
    }
  }

  return (
    <div>
      <PageHeader
        title="Submit a support query"
        description="Choose a book or send an account-level question. The ticket is saved even if classification is delayed."
      />
      {books.isLoading ? <Skeleton className="h-64" /> : null}
      {books.isError ? <ErrorState message={errorMessage(books.error)} onRetry={() => void books.refetch()} /> : null}
      {books.data ? (
        <form
          className="grid max-w-2xl gap-4 rounded-2xl border border-border bg-surface p-5"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >
          <Field id="bookId" label="Book" error={form.formState.errors.bookId?.message}>
            <select
              id="bookId"
              className={inputClass}
              aria-invalid={Boolean(form.formState.errors.bookId)}
              {...form.register("bookId")}
            >
              <option value="">General / Account Level</option>
              {books.data.map((book) => (
                <option key={book.bookId} value={book.bookId}>
                  {book.title}
                </option>
              ))}
            </select>
          </Field>
          <Field id="subject" label="Subject" error={form.formState.errors.subject?.message}>
            <input id="subject" className={inputClass} aria-invalid={Boolean(form.formState.errors.subject)} aria-describedby={form.formState.errors.subject ? "subject-error" : undefined} {...form.register("subject")} />
          </Field>
          <Field id="description" label="Description" error={form.formState.errors.description?.message}>
            <textarea
              id="description"
              rows={6}
              className={inputClass}
              aria-invalid={Boolean(form.formState.errors.description)}
              aria-describedby={form.formState.errors.description ? "description-error" : undefined}
              {...form.register("description")}
            />
          </Field>
          <Field id="attachment" label="Attachment (not saved)">
            <input id="attachment" type="file" disabled className={inputClass} aria-describedby="attachment-note" />
            <p id="attachment-note" className="text-xs text-muted">
              This control does not upload, preview, or store a file. Attachments are not part of the ticket.
            </p>
          </Field>
          {form.formState.errors.root ? <p className="text-sm text-danger">{form.formState.errors.root.message}</p> : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Submitting…" : "Submit query"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
