# Lookit database schema

All IDs are UUID (`uuidv7()`). Timestamps are `timestamptz` (UTC). Display in IST in the UI.

## Tables

| Table | Purpose |
|-------|---------|
| `users` | Photographers + admins (`role`, `status`, `studio_name`, `logo_key`) |
| `plans` | Data-driven catalog (monthly / season / topup / trial) + `entitlements` jsonb |
| `payment_orders` | Manual UPI orders (`ref_code`, unique `utr`, status machine) |
| `plan_purchases` | Active quota buckets (`photos_used` / `photos_reserved` / `photo_quota`) |
| `events` | Per-owner events; `slug` unique; `theme` jsonb; Rekognition `face_collection_id` |
| `upload_sessions` | Quota reservation window for multipart uploads |
| `photos` | Per-event media + status machine; unique `(event_id, content_hash)` when hashed |
| `faces` | Rekognition face ids scoped to `event_id` |
| `guest_consents` | Consent version + hashed IP |
| `share_links` | Unguessable personal results links |
| `analytics_events` | view / search / download |
| `audit_logs` | Admin and sensitive actions |
| `settings` | Key/value jsonb (UPI, face threshold, consent text, admin emails) |
| `face_api_usage` | Daily face-API call counters (global + per event) |
| `files` | Boilerplate local file registry (keep for small uploads) |

## Quota reservation (atomic)

```sql
UPDATE plan_purchases
SET photos_reserved = photos_reserved + $n
WHERE id = $id
  AND status = 'active'
  AND upload_window_end > now()
  AND photos_used + photos_reserved + $n <= photo_quota
RETURNING *;
```

On complete: move reserved → used. On abort/timeout: release reserved.

## Seeds

- Plans: Base / Pro / Studio monthly, top-up 1k, season passes, trial 7d 500 photos
- Settings: `upi`, `face`, `consent`, `admin.bootstrap_emails`
- Admin user: `yashchauhan1775@gmail.com` (role `admin`)

## Migrations

- `20260213214937_init.sql` — boilerplate `users` + `files`
- `20261018234500_lookit_core_schema.sql` — Lookit core
