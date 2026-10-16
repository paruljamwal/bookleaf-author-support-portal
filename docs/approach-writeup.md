# Approach

I put the working ticket path ahead of extra product surface. An author can sign in, see the supplied books, and create a ticket that survives an AI outage. An admin can correct the category and priority, keep a private note, edit a draft, and send a reply the author can read. Those are the pieces an evaluator can exercise, and they are the pieces the scoring weights the most.

The main trade-off is where AI runs. A background job inside the API process is simpler than a queue, and it still saves the ticket first. The cost is that a crash can leave classification pending until someone runs it again. I would move that follow-up to a durable worker before running more than one API instance. Rate limits have the same single-process limit.

I kept the model behind a small completion interface and split classification from drafting so a category decision does not drag the whole Knowledge Base along. The fallback rubric is explicit and tested against the seven sample queries. It is there so the demo still classifies with no API key. It is labeled as a fallback in the admin UI, because keyword scoring is not the production classifier.

I left out file upload, email, password reset, and a platform-wise royalty report. The sample data has no per-platform sales feed, and inventing one would misstate the books. Attachments are visibly disabled. Public signup creates an author account only; the admin account stays in the seed. Pusher is wired for both seeded and self-registered author ids, and the screen polls when those credentials are absent, which is the state of this workspace. This copy has not been deployed.

In a production version I would add a job queue, refresh-token storage, shared rate limits, and audited admin actions. I would also keep the same rule: never tell an author that a payment, reprint, or stock sync happened until a person or a system of record confirms it.
