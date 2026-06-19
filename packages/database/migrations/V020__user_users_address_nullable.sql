-- JIT user provisioning: a user provisioned on first OIDC sign-in has no
-- address yet (only email + Zitadel subject are known). Drop NOT NULL on the
-- three address columns so an address-less user row is valid. Existing rows
-- (e.g. the seeded admin's 'N/A' placeholders) are unaffected.
ALTER TABLE "user".users ALTER COLUMN country DROP NOT NULL;
ALTER TABLE "user".users ALTER COLUMN street DROP NOT NULL;
ALTER TABLE "user".users ALTER COLUMN postal_code DROP NOT NULL;
