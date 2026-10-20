# Lookit decisions

## Locked (2026-10-18 / 19)

1. **Repos:** `Yashchauhan008/lookit-server`, `Yashchauhan008/Lookit-client`
2. **Auth:** Boilerplate flow — register → email OTP → verify → login (password). No Google/SMS in MVP.
3. **Admin bootstrap:** `yashchauhan1775@gmail.com` is admin (seed / promote on migrate).
4. **Local DB:** Existing Docker `postgres-18` (host port **5433**). Database: `lookit`. Same instance as orbit. Password aligned with orbit `.env`. Do not add Postgres to lookit docker-compose.
5. **Local Redis:** Host Redis on `6379`.
6. **Production domains:** `lookit.studio` (SPA), `api.lookit.studio` (API), `media.lookit.studio` (R2 CDN).
7. **HEIC:** Deferred — later step after JPEG/PNG pipeline works.
8. **UI direction:** Dark minimal agency aesthetic inspired by [Web Angles](https://webangles.framer.website/) — Lookit brand, not a clone.
9. **Event face search:** Always scoped to one event. Never cross-event.
10. **Payments MVP:** Manual UPI + admin approve (no Razorpay).
11. **Face engine Phase 1:** AWS Rekognition behind `FaceEngine` interface.
12. **SMTP:** Real credentials later via `.env`; local uses dummy SMTP so the API boots.
13. **Docker Hub images:** `yashchauhan008/lookit-server`, `yashchauhan008/lookit-client` (worker may share server image with different CMD).

14. **Admin seed password (local):** `LookitAdmin!change-me` for `yashchauhan1775@gmail.com` — change after first login. Registering that email later also forces `role=admin`.

## Open

- Real SMTP when OTP mail must deliver
- Real AWS S3 media credentials in local `.env` (uploads blocked until set)
- Flip to R2 when Cloudflare account is available (`MEDIA_STORAGE_PROVIDER=r2`)
- AWS Rekognition keys when face indexing lands

15. **Events API (2026-10-19):** Photographer CRUD under `/events` with ownership → 404. Public `GET /e/:slug` returns needs_pin + studio name only. Soft-delete via `status=deleted`. QR PNG at `/events/:id/qr`.

16. **Media storage (2026-10-19):** Presigned multipart uploads via S3-compatible API. Provider switch: `MEDIA_STORAGE_PROVIDER=s3|r2` (default **s3** until R2 account is ready). Same upload code path; only env/client endpoint changes. No MinIO. First upload session auto-grants `trial_7d` (500 photos) once per user when no active purchase exists.

17. **Guest selfie search (2026-10-19):** Rekognition FaceEngine (`FACE_ENGINE=rekognition`). After `process-photo`, worker enqueues `index-faces` into collection `lookit_evt_{eventId}`. Guest flow: `POST /e/:slug/unlock` → consent → multipart selfie search (never stored). PIN lockout 5 tries / 15 min (Redis). IAM on the AWS key needs Rekognition in `ap-south-1`: `CreateCollection`, `IndexFaces`, `SearchFacesByImage`, `DeleteFaces`, `DeleteCollection`.

18. **Billing + admin (2026-10-20):** `/billing/*` (plans, summary, request an order) and `/admin/*` (overview, customers, grants, order review, revoke), admin-only via `requireAdmin`. Admin "grant" is instant: one transaction writes an `approved` payment order + a `plan_purchases` bucket + an audit log row. Customer requests (optionally with a UTR) sit in the admin queue until approved/rejected. Each plan or top-up is its own bucket; `ensureActivePurchase` spends the oldest live bucket first. Customer top-ups require an active non-top-up plan; admins can grant anything, including the trial. Remaining = sum of live buckets (active/exhausted, upload window open) of quota − used − reserved. Revoke sets the bucket to `revoked`.

19. **Event dates + banner (2026-10-20):** events have `event_date` (start) and `end_date` (migration `20261020150000`, `end_date >= event_date`). Dates are advisory against the subscription: the UI warns when an event ends after the plan's upload window, nothing is blocked. Banner = one image per event, `POST/DELETE /events/:id/banner` (multipart `banner`, ≤8 MB, re-encoded to 2000×900 WebP via sharp into media storage, stored in `cover_desktop_key`/`cover_mobile_key`), returned as a 1 h signed `banner_url` on studio and public event JSON. Current plan = paid plan over trial, then latest expiry; top-ups are reported separately. Expired open upload sessions are swept lazily (`releaseExpiredSessions`) so abandoned uploads give their reserved photos back.

20. **Free plan (2026-10-20):** the 7-day trial is now `free_30d` ("Free plan", 500 photos, 30 days), one per account. New accounts see an "Activate free plan" button on the dashboard (`POST /billing/free-plan`, no admin needed); the first upload still auto-grants it as a fallback. `free_plan_available` in `/billing/summary` is true until the account has ever had one. Existing 7-day trials keep their original expiry. Admins can still grant it (e.g. after a revoke) via the grants endpoint.

21. **Guest scans + saved selfies (2026-10-21)** — supersedes the "selfies are never stored" part of #17. Every face search writes a `guest_scans` row (random per-device `guest_id`, matched photo ids, status, consent version) and saves a small WebP copy of the selfie to media storage (`selfies/{eventId}/{scanId}.webp`), visible only to the event owner (`GET /events/:id/scans`: totals, Rekognition calls used, calls saved, one selfie per guest). Consent text is now version `2026-10-21` and says the selfie is saved and shown to the photographer. A guest keeps one selfie per event (a rescan deletes the earlier file) and can erase their selfie and matches from the results page (`POST /e/:slug/my-scan/delete`); aggregate counts survive, personal data does not. To save Rekognition calls, the search response includes a signed `scan_token` (120 days) that the device keeps in localStorage; `POST /e/:slug/my-results` reopens the stored matches with no face search and reports `new_photos` added since, so a rescan is only offered when it can change the answer. Reopens are logged as `cache_hit` analytics events. A consent-version change forces a fresh consent before saved results are shown.
