# Architecture

BookLeaf Author Support is one repository with three npm workspaces. The browser talks only to the Express API. The API talks to MongoDB, and optionally to an OpenAI-compatible model and Pusher.

## Request path

1. Vite proxies `/api` to the API during development, so the session cookie is same-origin.
2. Mutating requests send the CSRF cookie value in `X-CSRF-Token`.
3. `requireAuth` reads the access cookie, checks the JWT, and loads the user. The role and author id come from that record.
4. CASL decides whether the role may perform the action. Author queries also filter on `authorPublicId`.
5. Zod parses params, query strings, and bodies. Controllers pass the parsed value into a service.
6. Services write MongoDB documents and publish a realtime event. AI work is a follow-up, not part of the insert.

## Collections

- `authors` — `AUTH001` through `AUTH010`, with the supplied contact fields.
- `books` — `BK001` through `BK018`. Royalty totals, null production fields, print partner, and `availableOn` are stored as supplied.
- `users` — login identity. Authors point at an author document. The admin does not.
- `tickets` — query, classification, original suggestion, decision source, status, assignee, AI state, and the current draft.
- `messages` — `AUTHOR_VISIBLE` replies and `INTERNAL` notes.
- `aiusages` — model name, token counts, latency, and success. Prompt text is not stored.
- `counters` — ticket id sequence.

Indexes cover author ownership, ticket status, category, priority, creation date, and assignee.

## Authentication

The access JWT lasts 15 minutes and the refresh JWT lasts 7 days. Both are HttpOnly. Logout bumps `tokenVersion`, which invalidates cookies that were already issued. The CSRF cookie is readable by the frontend and is compared with `crypto.timingSafeEqual`.

## Authorization

`shared/src/ability.ts` is the only definition of role rules. Admins can manage the support area. Authors can read their own books and tickets, create a ticket, and read author-visible replies. A missing or mismatched owner returns 404 for records and 403 for admin routes, so another author's book id is not confirmed.

## AI boundary

`backend/src/ai` owns prompts, the Knowledge Base, provider calls, output validation, the fallback rubric, and the draft guard. Routes call `processTicketAi`. React never sees the provider key or the raw model payload.

## Realtime boundary

`backend/src/realtime` decides the channel list before anything is sent. `ticket.note.added` is delivered only to `private-admin`. Other ticket events go to the author's private channel, the admin channel, and the ticket channel. The payload is identifiers and status fields. The client refetches the ticket, so note text is not broadcast.

## Process model

The API is one Node process. Rate limits and the AI follow-up live in that process. A production deployment should keep MongoDB outside the process and can later move AI work to a queue without changing the ticket contract.

## What is intentionally local

Development can run MongoDB from `mongodb-memory-server` with a data directory on disk. Production requires `MONGODB_URI` and will not start that embedded server.
