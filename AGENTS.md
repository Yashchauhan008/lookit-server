# lookit-server — agent notes

- Express 5 + TypeScript ESM, raw SQL with `pg`, dbmate, zod, winston, Bruno. **No ORM.**
- Follow boilerplate module layout: `src/modules/<feature>/`.
- Entry points: `src/index.ts` (API), `src/index.worker.ts` (worker).
- Never hardcode secrets; update `.env.example` when adding env vars.
- Record decisions in `docs/DECISIONS.md`.
- One feature per branch/PR.
