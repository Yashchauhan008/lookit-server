# Lookit — Peak Season Ops: Bottlenecks, Workers & Home PCs

**Product:** Lookit (face-search for event photos)  
**Stack:** VPS (KVM2) + AWS Rekognition + S3 now / R2 in production  
**Revenue model:** Prepaid photo quota only (no photo sales)  
**Date:** 2026-10-19

---

## 1. Can home computers run workers?

**Yes — with conditions.** Workers only need:

1. Same `lookit-server` code + `.env`
2. Reachable **Redis** (job queue) — usually on the VPS
3. Reachable **Postgres** — usually on the VPS
4. Internet to **S3/R2** and **AWS Rekognition**
5. Machine **left on** while jobs run

| Machine | Role | Works? |
|---------|------|--------|
| VPS KVM2 | API + Redis + Postgres (+ optional worker) | Yes — primary |
| Your PC | Extra `npm run start:worker` / `dev:worker` | Yes for bursts |
| Other PCs (8 GB RAM) | Extra workers | Yes |

**Home PC is good for:** peak weekends, clearing backlog, cheap extra capacity.  
**Home PC is bad as only production worker:** sleep/shutdown, power cuts, home IP changes, unstable Wi‑Fi.

**Recommended layout**

```
VPS KVM2  →  API + Redis + Postgres + 1 light worker (always on)
Your PC / 8GB PCs  →  extra workers when backlog is big (optional)
```

All workers must point `REDIS_URL` and `DATABASE_URL` at the **VPS**, not `127.0.0.1` on the laptop.

---

## 2. How to run a home / office PC as a worker

1. On VPS: expose Redis (and Postgres) only to trusted IPs, with password. Prefer VPN/Tailscale/WireGuard over opening Redis to the whole internet.
2. On the PC: clone `lookit-server`, copy production-like `.env`:
   - `REDIS_URL=redis://:PASSWORD@VPS_IP:6379`
   - `DATABASE_URL=postgres://...@VPS_IP:5432/lookit`
   - Same `AWS_*` keys, same `MEDIA_STORAGE_*` / R2 or S3
3. Run: `npm ci && npm run build && npm run start:worker`  
   (or `npm run dev:worker` while developing)
4. Leave the machine awake (disable sleep).
5. When done: stop worker — VPS worker continues alone.

**Security:** Never expose Redis without a password. Prefer Tailscale so Redis stays private.

---

## 3. Concurrency (BullMQ “threads”)

These are **parallel jobs**, not OS threads.

### VPS KVM2 (~6 vCPU / 16 GB) — API + Redis + DB on same box

| Worker | Safe mean | Max try |
|--------|-----------|---------|
| process-photo (sharp / CPU) | 3–4 | 6 |
| index-faces (network → AWS) | 6–8 | 10–12 |
| **Total both** | ~8–12 | ~15 |

Leave headroom for API + Postgres.

### 8 GB RAM home PC (worker-only)

| Worker | Safe mean | Max try |
|--------|-----------|---------|
| process-photo | 2–3 | 4 |
| index-faces | 4–6 | 8 |
| **Total** | ~6–8 | ~10 |

Sharp + Chrome + OS on 8 GB: stay conservative. Close browsers if indexing hard.

### Your main computer (if 16 GB+)

Similar to KVM2 worker-only: process **3–4**, index **6–10**.

**Tune rule:** CPU pegged → cut `process-photo`. Rekognition throttle errors → cut `index-faces`.

---

## 4. Bottlenecks and cures

| # | Problem | Symptom | Cure (budget-friendly) |
|---|---------|---------|------------------------|
| 1 | `DAILY_FACE_CALL_CAP=5000` | Index stops | Raise cap; AWS Budget alerts |
| 2 | index-faces concurrency = 1 | Multi-hour backlog | Raise to 5–10 (code config) |
| 3 | process-photo concurrency = 2 | Thumbs lag | Raise to 3–6 |
| 4 | Everything on one VPS | API slow under load | Keep API on VPS; add home/2nd VPS workers |
| 5 | AWS Rekognition TPS | Throttle errors | Lower concurrency or request quota raise |
| 6 | Redis / RAM | OOM, stalled jobs | Cap concurrency; monitor RAM |
| 7 | Postgres on same box | Slow queries | OK early; split DB later if needed |
| 8 | S3 egress | High bill | Move media to **R2** before peak |
| 9 | Session max 500 files | Awkward big dumps | Multiple upload sessions (already supported) |
| 10 | Manual UPI activation | Paid users wait | Faster admin / daily batch |
| 11 | Guest search before indexed | Empty results | UI: “Indexed X/Y” |
| 12 | Reindex storms | Double AWS cost | Reindex only failed; fix IAM first |
| 13 | Trial abuse | Free cost burn | One trial per user; watch alts |
| 14 | Unlimited guest search | Rekognition $ | Rate limit per event / IP / day |
| 15 | Collections never deleted | Storage drip | Delete collection after retention |
| 16 | Disk full | Crash | Log rotate; clean tmp; monitor disk |
| 17 | No backups | Data loss | Nightly PG dump → R2 |
| 18 | No alerts | Late discovery | Uptime ping + AWS Budget + queue depth |

---

## 5. Cost reminders (SaaS only)

- **IndexFaces** ≈ $0.001 / photo (~₹0.09)
- **SearchFacesByImage** ≈ $0.001 / search
- Face storage ≈ $0.01 / 1,000 faces / month
- Plan revenue ≈ ₹0.25–0.30 / photo quota → healthy margin if you don’t reindex constantly
- `DAILY_FACE_CALL_CAP` is a **budget brake** (~$5/day at 5000 × $0.001)

---

## 6. Peak weekend playbook

1. VPS always on: API + Redis + Postgres + small worker.
2. Friday: raise daily face cap; check AWS Budget.
3. Big uploads: start workers on your PC + 8 GB PCs (Tailscale → VPS Redis).
4. Watch: queue waiting count, worker logs (`index-faces done`), VPS CPU/RAM.
5. Monday: stop home workers; leave VPS worker on.
6. After retention: delete Rekognition collections for expired events.

---

## 7. Quick answers

**Is KVM2 enough for API?** Yes for early–mid season.  
**Is KVM2 enough alone for huge peak index?** Tight — add home workers or a 2nd VPS.  
**Do 8 GB PCs work as workers?** Yes, mean concurrency ~6–8 total jobs.  
**Must photos be on S3 for Rekognition?** No — worker downloads from S3/R2 and sends **bytes** to Rekognition.

---

*Internal ops note for Lookit. Update concurrency numbers in worker source when you change defaults.*
