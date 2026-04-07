// Duração padrão da contagem regressiva em minutos.
// Pode ser sobrescrito por NEXT_PUBLIC_DRAW_COUNTDOWN_MINUTES no .env
export const DRAW_COUNTDOWN_MINUTES =
  Number(process.env.NEXT_PUBLIC_DRAW_COUNTDOWN_MINUTES ?? '5');
