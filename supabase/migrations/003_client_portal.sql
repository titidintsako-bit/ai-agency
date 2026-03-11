-- ============================================================
-- Migration 003: Client Portal credentials
-- ============================================================
--
-- Adds portal login support to the clients table.
-- Each client can be given a portal_password_hash so they can
-- log into the client portal and view their own data.
--
-- To set a password for a client:
--   1. Call GET /portal/auth/hash-helper?password=<pw>&slug=<slug>
--   2. Copy the returned hash into the UPDATE below and run it in
--      the Supabase SQL editor:
--
--      UPDATE clients
--      SET portal_password_hash = '<hash>'
--      WHERE slug = 'smilecare';
--
-- ============================================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_password_hash TEXT DEFAULT NULL;

-- Optional: index for fast slug lookups during portal login
-- (slug already has a UNIQUE constraint from migration 001, so it is indexed)

COMMENT ON COLUMN clients.portal_password_hash IS
  'SHA-256 hash of (password + '':'' + slug). NULL = portal access disabled for this client.';
