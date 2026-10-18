# lookit-server

API + BullMQ worker for [lookit.studio](https://lookit.studio).

Forked from [node-backend-boilerplate](https://github.com/RajRaiyani/node-backend-boilerplate).

## Quick start

```bash
cp .env.example .env
# set DATABASE_URL to your local postgres-18 (host port 5433) database `lookit`
npm install
npx dbmate up
npm run dev:api
```

## Scripts

- `npm run dev:api` — API + sockets
- `npm run dev:worker` — background worker (Phase 1)
- `npm run build` / `npm start`

## Docs

See `docs/DECISIONS.md` and the master Lookit context.
