// ═══════════════════════════════════════════════════════════
//  config.js  — Box Battles configuration
//  ➡ REPLACE the values below with YOUR Supabase project info
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // ── Supabase ──────────────────────────────────────────────
  // Get these from: https://app.supabase.com → Project Settings → API
  SUPABASE_URL:  'https://mdxeyyokenincbbbraux.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1keGV5eW9rZW5pbmNiYmJyYXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDUzMTMsImV4cCI6MjA5MDQ4MTMxM30.wnd3jFZDPcW89whedcEeTFAw7dMqrxfIJKBI8wh9lfo',

  // ── Game constants ────────────────────────────────────────
  MAX_PLAYERS:      6,       // max 6 per match
  ARENA_SIZE:       40,      // half-width of the arena (units)
  TICK_RATE:        50,      // ms between network updates
  HEALTH_PACK_TIME: 15000,   // ms between health pack spawns

  // ── Economy ───────────────────────────────────────────────
  XP_PER_WIN:       150,
  XP_PER_KILL:      40,
  COINS_PER_WIN:    80,
  COINS_PER_KILL:   20,
  COINS_START:      0,

  // ── Colors players can choose ─────────────────────────────
  PLAYER_COLORS: [
    { name: 'Blue',    hex: '#5b8cff', emoji: '🟦' },
    { name: 'Red',     hex: '#ff5b5b', emoji: '🟥' },
    { name: 'Green',   hex: '#3dff8f', emoji: '🟩' },
    { name: 'Yellow',  hex: '#ffe95b', emoji: '🟨' },
    { name: 'Purple',  hex: '#b45bff', emoji: '🟪' },
    { name: 'Orange',  hex: '#ff9f3d', emoji: '🟧' },
  ],

  // ── Game modes ────────────────────────────────────────────
  MODES: {
    ffa:  { label: 'Free-for-All', teams: false, teamSize: 1 },
    '2v2':{ label: '2v2 Teams',   teams: true,  teamSize: 2 },
    '3v3':{ label: '3v3 Teams',   teams: true,  teamSize: 3 },
  },
};
