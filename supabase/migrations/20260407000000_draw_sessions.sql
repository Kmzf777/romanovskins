-- Tabela para sessões de sorteio ao vivo
CREATE TABLE IF NOT EXISTS draw_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id            uuid NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  draw_at              timestamptz NOT NULL,
  countdown_minutes    integer NOT NULL DEFAULT 5,
  status               text NOT NULL DEFAULT 'waiting'
                         CHECK (status IN ('waiting', 'drawing', 'drawn')),
  winner_ticket_number integer,
  winner_name          text,
  concurso             integer,
  primeiro_premio      text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Apenas uma sessão ativa por rifa
CREATE UNIQUE INDEX IF NOT EXISTS draw_sessions_raffle_active
  ON draw_sessions (raffle_id)
  WHERE status IN ('waiting', 'drawing');

-- RLS: leitura pública, escrita apenas via service_role
ALTER TABLE draw_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read draw_sessions"
  ON draw_sessions FOR SELECT
  USING (true);

-- Habilitar Realtime nesta tabela
ALTER PUBLICATION supabase_realtime ADD TABLE draw_sessions;
