-- Add target_concurso to draw_sessions
-- This stores the specific Loteria Federal concurso number that will determine the winner.
-- Locking to a future concurso prevents users from pre-calculating results.
ALTER TABLE draw_sessions
  ADD COLUMN IF NOT EXISTS target_concurso integer;

COMMENT ON COLUMN draw_sessions.target_concurso IS
  'The specific Loteria Federal concurso number to use for this draw. Set to current+1 when session is created.';
