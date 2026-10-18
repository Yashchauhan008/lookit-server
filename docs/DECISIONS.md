# Lookit decisions

## Locked (2026-10-18)

1. **Repos:** `Yashchauhan008/lookit-server`, `Yashchauhan008/Lookit-client`
2. **Auth:** Boilerplate flow — register → email OTP → verify → login (password). No Google/SMS in MVP.
3. **Admin bootstrap:** `yashchauhan1775@gmail.com` is admin (seed / promote on migrate).
4. **Local DB:** Existing Docker `postgres-18` (host port **5433**). Database name: `lookit`. Do not add Postgres to docker-compose for now.
5. **Local Redis:** Host Redis on `6379` (already running).
6. **Production domains:** `lookit.studio` (SPA), `api.lookit.studio` (API), `media.lookit.studio` (R2 CDN).
7. **HEIC:** Deferred — later step after JPEG/PNG pipeline works.
8. **UI direction:** Marketing/app visual language inspired by [Web Angles](https://webangles.framer.website/) — dark minimal agency aesthetic (true black, thin rules, bold display type, motion). Not a clone of copy/branding; Lookit identity on top.
9. **Event face search:** Always scoped to one event. Never cross-event.
10. **Payments MVP:** Manual UPI + admin approve (no Razorpay).
11. **Face engine Phase 1:** AWS Rekognition behind `FaceEngine` interface.

## Open

- Host password for `postgres-18` on port 5433 (needed in `.env` `DATABASE_URL`)
- SMTP credentials for OTP mail
- Docker Hub image namespace for deploy (`yashchauhan008/lookit-…`?)
- R2 + AWS keys when we hit uploads/faces
