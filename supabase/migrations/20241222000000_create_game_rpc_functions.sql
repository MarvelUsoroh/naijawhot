-- Migration: Create RPC functions for atomic game state updates
-- Created: 2025-12-22
-- Purpose: Reduce latency by performing atomic updates in database

-- ==========================================
-- Function: Advance Turn (Atomic)
-- ==========================================
CREATE OR REPLACE FUNCTION advance_turn(
  p_room_code TEXT,
  p_next_player_index INTEGER,
  p_turn_start_time BIGINT
)
RETURNS JSONB AS $$
DECLARE
  v_state JSONB;
BEGIN
  UPDATE rooms
  SET game_state = jsonb_set(
    jsonb_set(
      game_state,
      '{currentPlayerIndex}',
      to_jsonb(p_next_player_index)
    ),
    '{turnStartTime}',
    to_jsonb(p_turn_start_time)
  )
  WHERE room_code = p_room_code
  RETURNING game_state INTO v_state;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Function: Update Player Card Count (Atomic)
-- ==========================================
CREATE OR REPLACE FUNCTION update_player_card_count(
  p_room_code TEXT,
  p_player_id TEXT,
  p_card_count INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_state JSONB;
  v_player_index INTEGER;
BEGIN
  -- Find player index
  SELECT idx - 1 INTO v_player_index
  FROM rooms,
       jsonb_array_elements(game_state->'players') WITH ORDINALITY arr(player, idx)
  WHERE room_code = p_room_code
    AND player->>'id' = p_player_id;
  
  IF v_player_index IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;
  
  -- Update card count
  UPDATE rooms
  SET game_state = jsonb_set(
    game_state,
    array['players', v_player_index::text, 'cardCount'],
    to_jsonb(p_card_count)
  )
  WHERE room_code = p_room_code
  RETURNING game_state INTO v_state;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Function: Update Deck Count (Atomic)
-- ==========================================
CREATE OR REPLACE FUNCTION update_deck_count(
  p_room_code TEXT,
  p_deck_count INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_state JSONB;
BEGIN
  UPDATE rooms
  SET game_state = jsonb_set(
    game_state,
    '{deckCount}',
    to_jsonb(p_deck_count)
  )
  WHERE room_code = p_room_code
  RETURNING game_state INTO v_state;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Function: Batch Update Game State Fields (Atomic)
-- ==========================================
CREATE OR REPLACE FUNCTION batch_update_game_state(
  p_room_code TEXT,
  p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_state JSONB;
  v_key TEXT;
  v_value JSONB;
BEGIN
  -- Get current state
  SELECT game_state INTO v_state
  FROM rooms
  WHERE room_code = p_room_code;
  
  -- Apply all updates
  FOR v_key, v_value IN SELECT * FROM jsonb_each(p_updates)
  LOOP
    v_state = jsonb_set(v_state, array[v_key], v_value);
  END LOOP;
  
  -- Save updated state
  UPDATE rooms
  SET game_state = v_state
  WHERE room_code = p_room_code;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Function: Get Game State (Read-only, optimized)
-- ==========================================
CREATE OR REPLACE FUNCTION get_game_state_fast(
  p_room_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_state JSONB;
BEGIN
  SELECT game_state INTO v_state
  FROM rooms
  WHERE room_code = p_room_code;
  
  RETURN v_state;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==========================================
-- Indexes for Performance
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);

-- ==========================================
-- Grant Permissions
-- ==========================================
GRANT EXECUTE ON FUNCTION advance_turn TO service_role;
GRANT EXECUTE ON FUNCTION update_player_card_count TO service_role;
GRANT EXECUTE ON FUNCTION update_deck_count TO service_role;
GRANT EXECUTE ON FUNCTION batch_update_game_state TO service_role;
GRANT EXECUTE ON FUNCTION get_game_state_fast TO service_role;
