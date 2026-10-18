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
- Real R2 API token values in local `.env` (placeholders block uploads until set)
- AWS Rekognition keys when face indexing lands

15. **Events API (2026-10-19):** Photographer CRUD under `/events` with ownership → 404. Public `GET /e/:slug` returns needs_pin + studio name only. Soft-delete via `status=deleted`. QR PNG at `/events/:id/qr`.

16. **Media storage (2026-10-19):** Cloudflare R2 only for event photos (presigned multipart). No MinIO / AWS S3 for media. AWS_* kept for Rekognition + backup bucket. First upload session auto-grants `trial_7d` (500 photos) once per user when no active purchase exists.
