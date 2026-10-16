# AI integration

## Model

The provider is an OpenAI-compatible `POST /chat/completions` client. The default model is `gpt-4o-mini` and the default base URL is `https://api.openai.com/v1`. A different host can be selected with `AI_BASE_URL` and `AI_MODEL`. The API key stays in `AI_API_KEY` on the server.

`gpt-4o-mini` is a reasonable default because each call is a short JSON task. The integration does not depend on a vendor SDK, so the same client can target another compatible endpoint. No live price is recorded here. The cost control is the size of the prompt, not a guessed dollar amount.

This environment did not call a live model. Tests use the fallback rubric and a fake provider.

## Two calls, not one

Classification and drafting are separate. Classification receives the subject, description, optional book status, the category list, the priority rubric, and labeled calibration examples for the seven assignment queries plus the six-month and author-bio contrasts. It does not receive the full Knowledge Base or the ticket thread.

Drafting receives the company overview, the tone rules, the policy sections for the chosen category, the sample whose wording matches the ticket, and the account facts that are actually on file. A royalty amount question uses the net-profit sample. A four-month unpaid question uses the payout-window sample. A royalty ticket does not receive the printing policy.

Drafts are stored on the ticket. Opening the ticket does not call the model again. An admin regenerates a draft only with the Generate draft button.

## Output

Classification must return `category`, `priority`, and `reasoningSummary`. Drafting must return `draftResponse`, `policyBasis`, and `requiresHumanVerification`. Zod rejects unknown categories, unknown priorities, and oversized strings. HTML tags are stripped. Sentences that claim a payment, reprint approval, completed re-sync, finished investigation, or metadata change are removed and replaced with a verification sentence.

The model is not allowed to invent a payout date. The Knowledge Base says royalties are paid within 45 days of quarter-end. The draft may explain that rule. It may not calculate a date unless that date is already a field on the book, such as `lastRoyaltyPayoutDate`.

## Priority rubric

- `CRITICAL` — royalties unpaid for about six months or more, or a payment failure already outside the quarterly cycle plus the 45-day window.
- `HIGH` — ISBN mismatch, print defect, a live book showing unavailable, or royalties unpaid for roughly three to five months.
- `MEDIUM` — royalty calculation questions, production-status questions, and issues that need investigation without blocking sales today.
- `LOW` — routine how-to requests such as an author bio or a simple description update.

The seven assignment scenarios are covered by tests of this rubric and by the calibration lines in the classification prompt. The rubric is the outage path. The model is asked to use the same scale when a key is configured.

## Failure behavior

1. The ticket insert commits first.
2. The provider is called with a timeout. A 429 or a 5xx response is retried once. A 400 caused by JSON mode is retried once without JSON mode. Other client errors and timeouts are not retried.
3. Invalid JSON or an unsupported enum becomes a provider error.
4. The service then applies the rubric and a template draft grounded in the relevant policy and the stored book facts.
5. The ticket state becomes `FALLBACK` or `FAILED`, with a short message for the admin.
6. There is no automatic retry loop. An admin can click Run classification or Generate draft.
7. If `categorySource` or `prioritySource` is `ADMIN`, that field is left alone. The first AI suggestion is kept in `aiCategory` and `aiPriority`.

Usage rows store the operation, model, token counts, latency, and whether the call succeeded. They do not store the prompt or the author message.

## What the draft may say

It may quote title, status, ISBN, royalty paid, royalty pending, and the last payout date when those fields exist. Zero is shown as zero. A null payout date is described as none on file. It must ask the team to verify anything that has not been done, including a stock re-sync or a reprint.
