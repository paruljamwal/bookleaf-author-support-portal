# BookLeaf Author Support

Author support portal for BookLeaf Publishing. Authors review their books and royalties and raise support tickets. The operations team classifies those tickets, reviews an AI draft, and sends a reply. Internal notes stay on the admin side.

The supplied dataset has 10 authors and 18 books, including titles still in production and royalty figures of zero. Those values are stored as given and are not recalculated.

## Features

- Email and password login for authors and one admin, with HttpOnly cookies.
- Public author registration. The server assigns the AUTHOR role. Signup cannot create an admin.
- Author dashboard, book list, ticket submission, and ticket conversation.
- Admin dashboard, filterable ticket queue, classification overrides, assignment, internal notes, and editable drafts.
- AI classification, priority, and Knowledge Base drafts, with a labeled fallback when the model is unavailable.
- Pusher private channels when credentials are set, and 8-second polling otherwise.
- Role rules shared through CASL. The API still enforces ownership in the database query.

## Architecture

The repository is an npm workspace:

- `frontend` serves the React application.
- `backend` serves the REST API and owns MongoDB, authentication, AI, and Pusher.
- `shared` holds enums, request schemas, DTO types, and the CASL ability factory.

A ticket is saved before any model call. Classification and a draft are stored on the ticket. An admin override is not replaced by a later model run. A draft is never sent until an admin clicks Send reply.

See [docs/architecture.md](docs/architecture.md), [docs/ai-integration.md](docs/ai-integration.md), and [docs/api.md](docs/api.md).

## Technology stack

| Area | Choice | Why |
| --- | --- | --- |
| UI | React, TypeScript, Vite, Tailwind | Fast local UI with strict types and a small design system |
| Server state | TanStack Query | Cache, invalidation, and the polling fallback |
| Forms | React Hook Form and Zod | Shared validation with the API |
| API | Express and Zod | Small, explicit HTTP surface |
| Data | MongoDB and Mongoose | Document shape matches authors, nested books, and ticket messages |
| Auth | JWT in HttpOnly cookies, bcrypt | Short access token, refresh cookie, CSRF double-submit |
| Authorization | CASL | One rule set for the interface and the API |
| AI | OpenAI-compatible chat completions | `gpt-4o-mini` by default, base URL can point at another provider |
| Realtime | Pusher | Managed private channels, with polling when it is not configured |
| Tests | Vitest, Supertest, Testing Library | API isolation, AI fallback, and formatting |

## Monorepo layout

```text
frontend/     React application
backend/      Express API, models, seed, AI, tests
shared/       Types, Zod schemas, CASL rules
docs/         Architecture, API, AI notes, approach write-up
docs/reference/  Assignment PDF and sample JSON
scripts/      Local env bootstrap
.github/      CI workflow
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- No separate MongoDB install is required for local development. Set `MONGODB_URI` when you want an external database.

## Environment variables

Run `npm run setup` to create `backend/.env` and `frontend/.env` with generated JWT secrets. The templates are `backend/.env.example` and `frontend/.env.example`. `frontend/.env.local` is not required.

Backend:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, default `4000` |
| `MONGODB_URI` | External MongoDB. Empty in development starts a persistent local database under `backend/.data` |
| `JWT_ACCESS_SECRET` | Access token secret, at least 32 characters |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `JWT_ACCESS_TTL` | Access token lifetime, default `15m` |
| `JWT_REFRESH_TTL` | Refresh token lifetime, default `7d` |
| `COOKIE_SECURE` | `true` in production HTTPS |
| `COOKIE_SAMESITE` | `lax` for local proxying. Use `none` with `COOKIE_SECURE=true` for cross-site production cookies |
| `CORS_ORIGIN` | Frontend origin. Comma-separate more than one |
| `AI_BASE_URL` | OpenAI-compatible base URL, default `https://api.openai.com/v1` |
| `AI_API_KEY` | Model key. Empty enables the labeled fallback |
| `AI_MODEL` | Default `gpt-4o-mini` |
| `AI_TIMEOUT_MS` | Provider timeout, default `12000` |
| `AI_AUTO_PROCESS` | `true` classifies a new ticket after it is saved |
| `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` | Realtime. All four are required |
| `DEMO_ADMIN_EMAIL` | Default `ops@bookleaf.demo` |
| `DEMO_ADMIN_PASSWORD` | Default `BookLeaf#Admin1`. The loader keeps the `#` |
| `DEMO_AUTHOR_PASSWORD` | Default `BookLeaf#Author1`. The loader keeps the `#` |
| `SEED_DATA_PATH` | Optional override for the sample JSON |
| `LOG_LEVEL` | `info` by default |

Frontend:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Leave empty. The dev server and Netlify both serve `/api` on the page origin |
| `VITE_PUSHER_KEY` | Public Pusher key |
| `VITE_PUSHER_CLUSTER` | Pusher cluster |

Do not commit `.env` files. `npm run setup` writes them locally.

## Local setup

```bash
npm install
npm run setup
npm run seed
npm run dev
```

- App: http://localhost:5173
- API health: http://localhost:4000/api/v1/health

`npm run dev` rebuilds `shared`, then runs the shared watcher, the API, and Vite. The Vite server proxies `/api` to port 4000 so cookies stay on one origin.

## MongoDB

Development with an empty `MONGODB_URI` downloads a MongoDB binary through `mongodb-memory-server` and stores data in `backend/.data/mongo`. That directory is gitignored. The process must be stopped before another process opens the same files.

Production must set `MONGODB_URI`. The API refuses to boot a local database when `NODE_ENV=production`.

## Seed

```bash
npm run seed
```

The script reads `docs/reference/FULLSTACK-SAMPLEDATA (1).json` unless `SEED_DATA_PATH` points somewhere else. It upserts 10 authors and 18 books, creates login users, and checks those counts. Running it again updates the same records and resets the demo passwords. It does not delete tickets.

## Demo logins

These passwords are for local evaluation. Change them before any shared deployment. Quote them in `backend/.env` because an unquoted `#` is a comment in many env parsers. The API also reads those two assignments itself so the `#` is kept. JWT secrets and provider keys are not written here.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `ops@bookleaf.demo` | `BookLeaf#Admin1` |
| Author | `priya.sharma@email.com` | `BookLeaf#Author1` |
| Every other author | The email in the sample file | `BookLeaf#Author1` |

The admin account is created by the seed. It is not in the sample dataset, and a client cannot choose its own role.

## Tests, lint, and types

```bash
npm test
npm run lint
npm run typecheck
```

Backend tests use an in-memory MongoDB. They cover login, author isolation, ticket creation, admin updates, private notes, AI fallback, and admin overrides. `backend/src/ai/heuristic.test.ts` checks the seven sample scenarios, and `backend/src/ai/regression.test.ts` checks the Knowledge Base fallback drafts. Frontend tests cover currency formatting, status text, and the polling timer.

## Production build

```bash
npm run build
npm start
```

`npm run build` typechecks and bundles the API with esbuild, and builds the frontend with Vite. `npm start` runs `backend/dist/server.js`. Serve `frontend/dist` separately and set `VITE_API_URL` at build time.

The frontend production server can be previewed with `npm run preview -w frontend` after the build.

## AI provider

The default model is `gpt-4o-mini` because classification and short support drafts fit a small structured prompt. The client calls `${AI_BASE_URL}/chat/completions`, so another OpenAI-compatible host can be used without changing ticket code.

Set `AI_API_KEY` to call the model. With no key, or when the provider times out, returns a rate limit, or returns invalid JSON, the ticket remains saved. The API applies a documented rubric, marks the result `FALLBACK`, and still lets an admin classify and reply by hand.

Prompt strategy, the Knowledge Base split, and the claim guard are described in [docs/ai-integration.md](docs/ai-integration.md).

This workspace was verified with the fallback path and with a mocked provider. A live model call was not made, because no API key is configured here.

## Realtime

When all Pusher variables are set, the API signs private-channel subscriptions and publishes `ticket.created`, `ticket.updated`, `ticket.reply.added`, and `ticket.note.added`. Internal notes go only to `private-admin`. An author can subscribe to `private-author-{their id}`. Seeded ids look like `AUTH001`. Accounts created through public signup look like `A12B34C5D` (`A` plus 8 hex characters). Both are accepted. An author cannot subscribe to another author's channel.

Without Pusher, the header says “Polling every 8 seconds”. That refresh covers ticket and dashboard queries and leaves the book list alone. A refresh already in flight is not started again, and leaving the page clears the timer. Live Pusher delivery was not verified in this environment. The header says “Live updates” only after a Pusher connection.

If the socket drops after it had connected, the UI switches to polling until Pusher reports `connected` again.

## Authentication and CASL

Access and refresh tokens are HttpOnly cookies. The refresh cookie is limited to `/api/v1/auth`. A non-HttpOnly CSRF cookie must be echoed in `X-CSRF-Token` on mutating requests. Logout increments a token version so older cookies stop working.

CASL allows admins to manage the support area. An author can read books and tickets whose `authorPublicId` matches the account, create a ticket, and read author-visible replies. Services still query by the authenticated author id, so a URL or body cannot select another author. Passwords are hashed with bcrypt cost 12. Logs redact fields whose names look like passwords, tokens, or cookies.

## API documentation

The HTTP contract is in [docs/openapi.yaml](docs/openapi.yaml) and summarized in [docs/api.md](docs/api.md). There is no Swagger UI server in this project. The spec file is the reference.

## Deployment

This copy has not been deployed.

1. Create a MongoDB database and set `MONGODB_URI`.
2. Set unique `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
3. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, and `CORS_ORIGIN` to the frontend origin.
4. Leave `COOKIE_SAMESITE=lax`. The browser calls the API through the frontend host.
5. Build and start the API: `npm run build && npm start`.
6. Use `GET /api/v1/health` as the health check.
7. Run `npm run seed` once against that database.
8. Leave `VITE_API_URL` empty. The site proxies `/api/v1` to the API.
9. Put the same Pusher key in `VITE_PUSHER_KEY` and the secret only on the API.

Suitable hosts are Render, Railway, or Fly for the API, and any static host for the Vite build. Do not use the embedded local database in production.

Netlify can publish the frontend from the repository root. `netlify.toml` builds `@bookleaf/shared`, then the frontend, and publishes `frontend/dist`. `frontend/public/_redirects` is copied into that folder on every Vite build. Application paths rewrite to `index.html` with status 200. `/api/*` is proxied to the Render API, so the browser stores the session cookie on the Netlify host. Leave `VITE_API_URL` empty in the Netlify UI, then redeploy the site.

## Known limitations

- File attachments are a disabled control labeled “Attachment (not saved)”. Nothing is uploaded, previewed, or stored. There is no attachment API.
- AI follow-up runs in the API process. A restart can leave a ticket in `PENDING` until an admin clicks Run classification.
- Rate limits are in memory and apply to one process.
- There is no password reset, email notification, or multi-admin assignment directory.
- The fallback classifier is a rubric for outages. It is not a substitute for the model.
- Live OpenAI and Pusher calls were not executed here.
- The app is not deployed.

## Future improvements

- A durable job queue for classification and draft generation.
- Shared rate-limit storage and refresh-token rotation in a database.
- Real attachment storage with virus scanning.
- Password reset and optional email when a reply is sent.
- Platform-wise royalty statements if BookLeaf adds that feed. The sample file does not include one, so the UI does not invent it.

## Security notes

- Keep the repository private. The assignment says not to publish it.
- Demo passwords are printed here on purpose for evaluation. They are reset on every seed.
- Do not put `AI_API_KEY` or `PUSHER_SECRET` in frontend environment variables.
- Author responses never include messages with `visibility: INTERNAL`.
- Model output is stored as plain text. The draft guard removes sentences that claim a payment, reprint, re-sync, or metadata change already happened.

## Troubleshooting

- `Invalid environment configuration`: run `npm run setup` or fill the secrets in `backend/.env`.
- Port already in use: stop the other API or change `PORT`.
- Local Mongo lock: stop the previous `npm run dev` before starting another one. Both use `backend/.data/mongo`.
- Login returns a CSRF error: refresh the page so `/api/v1/auth/csrf` can set the cookie, and confirm the request URL is the Netlify host, not the Render host.
- Cookies fail in production: redeploy Netlify so `/api` is proxied. `CORS_ORIGIN` stays the Netlify origin and `COOKIE_SECURE=true`.
- Classification stays on the fallback: `AI_API_KEY` is empty or the provider returned an error. The admin can still set the category and send a reply.
