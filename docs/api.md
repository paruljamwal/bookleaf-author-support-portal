# API

All JSON routes live under `/api/v1`. Errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted fields.",
    "details": [{ "path": "description", "message": "Description must be at least 20 characters." }]
  }
}
```

Mutating requests need the `bookleaf_csrf` cookie and the same value in `X-CSRF-Token`. Authenticated requests need the `bookleaf_access` cookie. The browser receives that cookie from login. Tokens are not returned in the JSON body.

The full contract is [openapi.yaml](openapi.yaml).

## Auth

| Method | Path            | Auth                     | Purpose                                                                   |
| ------ | --------------- | ------------------------ | ------------------------------------------------------------------------- |
| GET    | `/auth/csrf`    | Public                   | Sets the CSRF cookie and returns `csrfToken`                              |
| POST   | `/auth/login`    | Public, rate limited     | Email and password. Sets access and refresh cookies                       |
| POST   | `/auth/register` | Public, rate limited     | Author name, email, and password. Role is always AUTHOR. Sets the same cookies |
| POST   | `/auth/refresh` | Refresh cookie           | Issues a new access cookie                                                |
| POST   | `/auth/logout`  | Access or refresh cookie | Increments the token version for the presented session and clears cookies |
| GET    | `/auth/me`      | Access cookie            | Current user                                                              |

## Author

The authenticated user must be an author. Book and ticket ids that belong to someone else return 404.

| Method | Path                        | Purpose                                 |
| ------ | --------------------------- | --------------------------------------- |
| GET    | `/author/dashboard`         | Counts and recent tickets               |
| GET    | `/author/books`             | That author's books                     |
| GET    | `/author/books/:bookId`     | One book                                |
| GET    | `/author/tickets`           | That author's tickets                   |
| POST   | `/author/tickets`           | Create a ticket. `bookId` may be null   |
| GET    | `/author/tickets/:ticketId` | Ticket plus author-visible replies only |

## Admin

| Method | Path                                | Purpose                                                                                                                         |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/dashboard`                  | Queue counts and the oldest urgent tickets                                                                                      |
| GET    | `/admin/tickets`                    | Paginated queue. Filters: `status`, `category`, `priority`, `dateFrom`, `dateTo` (Asia/Kolkata calendar dates), `page`, `limit` |
| GET    | `/admin/tickets/:ticketId`          | Full ticket, draft, replies, and internal notes                                                                                 |
| PATCH  | `/admin/tickets/:ticketId`          | Set category, priority, or status. Manual values are marked `ADMIN`                                                             |
| POST   | `/admin/tickets/:ticketId/assign`   | Assign the ticket to the signed-in admin                                                                                        |
| POST   | `/admin/tickets/:ticketId/notes`    | Add an internal note                                                                                                            |
| POST   | `/admin/tickets/:ticketId/replies`  | Send the edited reply to the author                                                                                             |
| POST   | `/admin/tickets/:ticketId/draft`    | Generate or replace the draft                                                                                                   |
| PATCH  | `/admin/tickets/:ticketId/draft`    | Save an edited draft without sending it                                                                                         |
| POST   | `/admin/tickets/:ticketId/classify` | Run classification again. Admin overrides are kept                                                                              |

## Realtime and health

| Method | Path               | Purpose                                                   |
| ------ | ------------------ | --------------------------------------------------------- |
| GET    | `/health`          | Database connectivity                                     |
| GET    | `/realtime/status` | Whether Pusher credentials are configured                 |
| POST   | `/realtime/auth`   | Authorize a private Pusher channel for the signed-in user |

Channel names must be `private-admin`, `private-author-AUTH###`, or `private-ticket-TKT-####`. The server checks the authenticated author or loads the ticket. A channel name alone is not trusted.
