-- migrate:up

-- The 7-day trial becomes a self-serve 30-day free plan (one per account).
UPDATE plans
SET code = 'free_30d',
    name = 'Free plan',
    duration_days = 30,
    entitlements = entitlements - 'admin_grant_only',
    updated_at = now()
WHERE code = 'trial_7d';

-- migrate:down

UPDATE plans
SET code = 'trial_7d',
    name = 'Free trial',
    duration_days = 7,
    entitlements = entitlements || '{"admin_grant_only": true}'::jsonb,
    updated_at = now()
WHERE code = 'free_30d';
