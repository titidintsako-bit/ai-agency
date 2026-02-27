-- ============================================================
-- AI Agency Platform — Appointments Table
-- Migration: 002_appointments.sql
--
-- Stores appointment requests collected by the SmileCare agent
-- (and any future agents that handle booking).
--
-- Design notes:
--   - preferred_date and preferred_time are stored as TEXT (free text),
--     not as timestamps. The agent collects natural language like "Monday
--     morning" or "3 March at 10am". The clinic's human staff confirm the
--     exact slot when they call the patient back.
--   - status starts as 'pending'. The dashboard lets you move it to
--     'confirmed', 'cancelled', or 'completed'.
--   - The table is linked to both conversations (for context) and clients
--     (for fast per-client dashboard queries).
-- ============================================================

CREATE TABLE IF NOT EXISTS appointments (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id           UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    conversation_id     UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    patient_name        TEXT        NOT NULL,
    contact_number      TEXT        NOT NULL,
    preferred_date      TEXT        NOT NULL,                -- Free text e.g. "Monday 3 March"
    preferred_time      TEXT        NOT NULL,                -- Free text e.g. "10:00" or "morning"
    service_type        TEXT        NOT NULL,                -- e.g. "General Checkup & Clean"
    is_existing_patient BOOLEAN,                             -- NULL = unknown
    notes               TEXT,                               -- Additional patient notes
    status              TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE appointments IS 'Appointment requests collected by agents — staff confirm the exact slot by phone';
COMMENT ON COLUMN appointments.preferred_date IS 'Free text as captured by the agent — not a timestamp';
COMMENT ON COLUMN appointments.preferred_time IS 'Free text as captured by the agent — not a timestamp';
COMMENT ON COLUMN appointments.status IS 'pending (default) → confirmed / cancelled / completed by staff via dashboard';


-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_appointments_client_status
    ON appointments(client_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_client_time
    ON appointments(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_conversation
    ON appointments(conversation_id);


-- Row Level Security — same pattern as all other tables
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- No anon policies. Backend uses service_role key (bypasses RLS).
