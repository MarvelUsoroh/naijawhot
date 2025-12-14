-- Migration: Create analytics tables for game tracking
-- Created: 2024-12-14

-- ==========================================
-- Table: game_sessions
-- Tracks each game session with timing and outcome data
-- ==========================================
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,           -- When game actually started (cards dealt)
  ended_at TIMESTAMPTZ,             -- When winner declared
  duration_seconds INTEGER,         -- Calculated: ended_at - started_at
  player_count INTEGER NOT NULL DEFAULT 0,
  winner_id TEXT,                   -- Player ID of winner
  winner_name TEXT,                 -- Player name of winner
  played_again BOOLEAN DEFAULT FALSE,  -- Did they start a new game in same room?
  total_turns INTEGER DEFAULT 0,    -- Number of turns played
  
  CONSTRAINT fk_room FOREIGN KEY (room_code) REFERENCES rooms(room_code) ON DELETE CASCADE
);

-- Index for querying sessions by room
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_code ON game_sessions(room_code);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at);

-- ==========================================
-- Table: player_events
-- Tracks individual player actions and timing
-- ==========================================
CREATE TABLE IF NOT EXISTS player_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT,
  event_type TEXT NOT NULL,         -- 'join', 'leave', 'reconnect', 'play_card', 'draw', 'win', 'ready'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  latency_ms INTEGER,               -- Server-client round-trip time (optional)
  metadata JSONB,                   -- Extra data (card played, shape selected, etc.)
  
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_player_events_session ON player_events(session_id);
CREATE INDEX IF NOT EXISTS idx_player_events_player ON player_events(player_id);
CREATE INDEX IF NOT EXISTS idx_player_events_type ON player_events(event_type);
CREATE INDEX IF NOT EXISTS idx_player_events_timestamp ON player_events(timestamp);

-- ==========================================
-- Row Level Security
-- ==========================================
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_events ENABLE ROW LEVEL SECURITY;

-- Allow public read access (Edge Function uses Service Role which bypasses RLS)
DROP POLICY IF EXISTS "Enable read access for all users" ON game_sessions;
CREATE POLICY "Enable read access for all users" ON game_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON player_events;
CREATE POLICY "Enable read access for all users" ON player_events FOR SELECT USING (true);

-- ==========================================
-- Helper View: Session Summary
-- ==========================================
CREATE OR REPLACE VIEW session_summary AS
SELECT 
  gs.id,
  gs.room_code,
  gs.created_at,
  gs.started_at,
  gs.ended_at,
  gs.duration_seconds,
  gs.player_count,
  gs.winner_name,
  gs.played_again,
  gs.total_turns,
  COUNT(DISTINCT pe.player_id) FILTER (WHERE pe.event_type = 'join') as unique_joins,
  COUNT(*) FILTER (WHERE pe.event_type = 'reconnect') as reconnect_count,
  AVG(pe.latency_ms) FILTER (WHERE pe.latency_ms IS NOT NULL) as avg_latency_ms
FROM game_sessions gs
LEFT JOIN player_events pe ON gs.id = pe.session_id
GROUP BY gs.id;
