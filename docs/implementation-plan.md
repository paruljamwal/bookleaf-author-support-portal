# BookLeaf Author Support — Implementation Plan

This plan tracks the assignment in `docs/reference` and the supplied dataset of 10 authors and 18 books. No seed records are invented. Books still in production (`BK013`, `BK015`) and zero or pending royalty values are preserved as supplied.

## Architecture

One npm-workspace repository:

- `frontend` — React, TypeScript, Vite, Tailwind, TanStack Query, React Hook Form, Zod, CASL, Pusher client.
- `backend` — Express, TypeScript, MongoDB/Mongoose, Zod, CASL, Pusher server SDK, OpenAI-compatible AI adapter.
- `shared` — enums, labels, request schemas, DTO types, and the CASL ability factory.

Authentication uses short-lived JWT access tokens and rotating-session refresh tokens in HttpOnly cookies, plus a double-submit CSRF cookie. Authors are scoped by the authenticated account. The client never supplies a trusted author id or role.

Tickets are saved before AI enrichment. Classification, priority, and a draft are stored once. Admin overrides are not replaced by later processing. Drafts are sent only when an admin explicitly sends a reply.

## Data model

- `User` — email, bcrypt hash, role, token version, optional author link.
- `Author` — `AUTH00x` id, name, email, phone, city, joined date.
- `Book` — `BK00x` id, author link, and every supplied commercial and distribution field, including null production values.
- `Ticket` — classification, original AI values, decision source, priority, status, assignee, AI state, stored draft.
- `Message` — author-visible replies and internal notes, distinguished by `visibility`.
- `AiUsage` — model, token counts, latency, and success. Prompt text is not stored.

Royalty totals are copied from the dataset and are not recalculated.

## API

Versioned under `/api/v1`: auth, author dashboard/books/tickets, admin queue and ticket mutations, AI classify/draft, realtime auth, and health. Admin lists are paginated and filtered on the server.

## AI workflow

1. Classify into the six assignment categories and score Critical / High / Medium / Low with a documented rubric.
2. Draft a reply using only the policy sections relevant to that category, plus the matching sample scenario.
3. Validate JSON, strip HTML, and reject operational claims the system has not confirmed.
4. If the provider is missing, times out, or returns invalid JSON, keep the ticket and apply a labeled fallback suggestion. Admins can classify and reply manually.

The default model is `gpt-4o-mini` through an OpenAI-compatible base URL so the provider can change without rewriting ticket code.

## Realtime

Pusher private channels: `private-author-{id}`, `private-admin`, and `private-ticket-{id}`. Internal notes are published only to the admin channel. Without Pusher credentials the UI polls and shows that live delivery is not active.

## Security

Password hashes, HttpOnly cookies, CSRF, helmet, CORS allow-list, login and AI rate limits, Zod validation, resource checks on the server, and redacted logs. Demo passwords are documented for local evaluation and are not treated as production secrets.

## Testing

API tests cover login, author isolation, ticket creation, admin mutations, internal-note privacy, and AI failure. Unit tests cover the seven sample scenarios, malformed model output, the draft guard, and channel authorization.

## Acceptance checklist

- [x] Seed imports 10 authors and 18 books idempotently.
- [x] Author and admin login, with author isolation.
- [x] Books show the required fields, including zeros and in-production titles.
- [x] Authors can submit book and account-level tickets and read replies.
- [x] Admin queue filters by status, category, priority, and date.
- [x] AI classification, priority, and drafts can be overridden or edited before send.
- [x] Internal notes stay off author responses.
- [x] Ticket creation and manual replies work when AI is unavailable.
- [x] Pusher subscriptions are authorized in code, with an 8-second polling fallback. Live delivery was not verified without credentials.
- [x] Tests, typecheck, lint, and production builds pass.
- [x] README, architecture, API, AI notes, and a one-page approach write-up exist.
- [ ] The application has not been deployed. Steps are in the README.
