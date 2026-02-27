-- ============================================================
-- AI Agency Platform — Initial Database Schema
-- Migration: 001_initial_schema.sql
--
-- Tables:
--   1. clients       - Business clients we manage agents for
--   2. agents        - Deployed agent instances (one client → many agents)
--   3. conversations - Session-level conversation tracking
--   4. messages      - Individual messages within a conversation
--   5. token_usage   - LLM API call cost tracking (per API call)
--   6. escalations   - Flagged conversations requiring human review
--
-- Security:
--   Row Level Security is enabled on all tables.
--   The anon key has zero access to any table.
--   The backend always uses the service_role key which bypasses RLS.
-- ============================================================

-- Required for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- TABLE 1: clients
-- One row per business client (dental clinic, law firm, etc.)
-- This is the top-level entity everything else belongs to.
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                 TEXT        NOT NULL,
    slug                 TEXT        UNIQUE NOT NULL,        -- URL-safe identifier e.g. "smilecare"
    industry             TEXT        NOT NULL,               -- dental | legal | salon | real_estate | restaurant | other
    contact_email        TEXT        NOT NULL,
    tier                 TEXT        NOT NULL DEFAULT 'basic'
                                     CHECK (tier IN ('basic', 'professional', 'enterprise')),
    monthly_retainer_zar NUMERIC(10,2) NOT NULL DEFAULT 0,  -- What they pay us per month in ZAR
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,  -- Toggle off to pause without deleting
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE clients IS 'Business clients whose agents we manage';
COMMENT ON COLUMN clients.slug IS 'URL-safe unique identifier, used as folder name in /config/clients/';
COMMENT ON COLUMN clients.tier IS 'Service tier determines feature set and retainer band';


-- ============================================================
-- TABLE 2: agents
-- One row per deployed agent instance.
-- A single client can have multiple agents across different channels.
-- e.g. SmileCare Web Chat + SmileCare WhatsApp are two separate agents.
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id     UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,                      -- e.g. "SmileCare WhatsApp Bot"
    channel       TEXT        NOT NULL
                              CHECK (channel IN ('web', 'whatsapp', 'email')),
    model         TEXT        NOT NULL DEFAULT 'claude-haiku-4-5-20251001', -- Default to cheapest model
    system_prompt TEXT        NOT NULL,                      -- The agent's full persona + instructions
    config        JSONB       NOT NULL DEFAULT '{}',         -- Flexible per-agent settings (hours, services, etc.)
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'Deployed agent instances — one client can have many agents across channels';
COMMENT ON COLUMN agents.config IS 'JSONB blob for channel-specific and client-specific settings';
COMMENT ON COLUMN agents.system_prompt IS 'Full system prompt sent to Claude on every conversation';


-- ============================================================
-- TABLE 3: conversations
-- One row per conversation session (NOT per message).
-- Tracks session-level metadata: who, when, which channel, final status.
-- Messages live in the messages table to keep this table fast to query.
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID        NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    client_id       UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE, -- Denormalized for fast dashboard queries
    channel         TEXT        NOT NULL,
    user_identifier TEXT,                                    -- Phone number, session token, or email (anonymised where possible)
    status          TEXT        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'completed', 'escalated', 'abandoned')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,                             -- NULL while session is still active
    metadata        JSONB       NOT NULL DEFAULT '{}'        -- Channel-specific extras: Twilio SID, browser UA, etc.
);

COMMENT ON TABLE conversations IS 'One row per conversation session — not per message';
COMMENT ON COLUMN conversations.client_id IS 'Denormalized from agents.client_id for fast per-client dashboard aggregations';
COMMENT ON COLUMN conversations.user_identifier IS 'Anonymised user reference — phone, token, or email depending on channel';
COMMENT ON COLUMN conversations.status IS 'escalated = flagged for human review; abandoned = no response from user';


-- ============================================================
-- TABLE 4: messages
-- One row per message within a conversation.
-- This is the actual conversation log — every turn stored here.
-- Load with ORDER BY created_at ASC to reconstruct the conversation.
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE messages IS 'Individual messages — the actual conversation log';
COMMENT ON COLUMN messages.role IS 'user | assistant | system — mirrors Anthropic API message roles';


-- ============================================================
-- TABLE 5: token_usage
-- One row per LLM API call.
-- Tracks cost at the finest granularity for accurate client billing
-- and monitoring. client_id and agent_id are denormalized so the
-- dashboard can aggregate without joins on every load.
--
-- Cost calculation:
--   cost_usd = (input_tokens * input_price + output_tokens * output_price) / 1,000,000
--   cost_zar = cost_usd * USD_ZAR_EXCHANGE_RATE (set in .env)
-- ============================================================

CREATE TABLE IF NOT EXISTS token_usage (
    id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID           NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id        UUID           NOT NULL REFERENCES agents(id),
    client_id       UUID           NOT NULL REFERENCES clients(id),
    model           TEXT           NOT NULL,                -- Exact model string e.g. "claude-haiku-4-5-20251001"
    input_tokens    INTEGER        NOT NULL DEFAULT 0,
    output_tokens   INTEGER        NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10,6)  NOT NULL DEFAULT 0,      -- Calculated at write time
    cost_zar        NUMERIC(10,4)  NOT NULL DEFAULT 0,      -- Converted at write time using env rate
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE token_usage IS 'One row per LLM API call — used for cost monitoring and client billing';
COMMENT ON COLUMN token_usage.cost_zar IS 'ZAR cost calculated at write time using USD_ZAR_EXCHANGE_RATE from env';


-- ============================================================
-- TABLE 6: escalations
-- One row per flagged conversation requiring human review.
-- Powers the alert panel on the admin dashboard.
-- Summary is AI-generated at the moment of escalation.
-- ============================================================

CREATE TABLE IF NOT EXISTS escalations (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    client_id       UUID        NOT NULL REFERENCES clients(id),  -- Denormalized for fast dashboard queries
    reason          TEXT        NOT NULL
                                CHECK (reason IN (
                                    'complaint',
                                    'appointment_failed',
                                    'out_of_scope',
                                    'explicit_request',
                                    'other'
                                )),
    summary         TEXT        NOT NULL,                   -- AI-generated 1-2 sentence explanation of why escalated
    status          TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'reviewed', 'resolved')),
    flagged_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,                            -- NULL until you review it in the dashboard
    notes           TEXT                                    -- Your internal notes after review (optional)
);

COMMENT ON TABLE escalations IS 'Flagged conversations requiring human review — feeds the dashboard alert panel';
COMMENT ON COLUMN escalations.summary IS 'AI-generated at escalation time — 1-2 sentences explaining why';
COMMENT ON COLUMN escalations.reason IS 'complaint | appointment_failed | out_of_scope | explicit_request | other';


-- ============================================================
-- INDEXES
-- Designed for the dashboard's most common query patterns:
--   - Per-client conversation counts (daily / weekly / monthly)
--   - Per-client token cost aggregation
--   - Per-agent metrics
--   - Pending escalation queue
--   - Loading a conversation's message history
-- ============================================================

-- All agents belonging to a client
CREATE INDEX IF NOT EXISTS idx_agents_client_id
    ON agents(client_id);

-- Dashboard: conversation volume per client over time (most frequent query)
CREATE INDEX IF NOT EXISTS idx_conversations_client_time
    ON conversations(client_id, started_at DESC);

-- Find all conversations handled by a specific agent
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id
    ON conversations(agent_id);

-- Filter conversations by status (e.g. all escalated sessions for a client)
CREATE INDEX IF NOT EXISTS idx_conversations_status
    ON conversations(status);

-- Load full message history for a conversation in order
CREATE INDEX IF NOT EXISTS idx_messages_conversation_time
    ON messages(conversation_id, created_at ASC);

-- Billing: total cost per client over time
CREATE INDEX IF NOT EXISTS idx_token_usage_client_time
    ON token_usage(client_id, created_at DESC);

-- Per-agent cost breakdown
CREATE INDEX IF NOT EXISTS idx_token_usage_agent_time
    ON token_usage(agent_id, created_at DESC);

-- Dashboard alert panel: pending escalations per client
CREATE INDEX IF NOT EXISTS idx_escalations_client_status
    ON escalations(client_id, status);

-- Dashboard alert panel: all pending escalations sorted newest first
CREATE INDEX IF NOT EXISTS idx_escalations_status_time
    ON escalations(status, flagged_at DESC);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
--
-- Strategy: enable RLS on every table, create ZERO anon policies.
-- Result: the anon key (safe to expose in frontend) cannot read
--         or write anything in our database.
--
-- Our backend exclusively uses the service_role key, which
-- bypasses RLS entirely — no policy needed for it.
--
-- This means: if our API keys ever leak, the anon key is useless.
-- The service_role key must never be exposed publicly. 
-- ============================================================

ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations   ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated role policies are intentionally created here.
-- All access is via service_role key from our backend only.
