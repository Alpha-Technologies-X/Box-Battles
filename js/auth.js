// ═══════════════════════════════════════════════════════════
//  auth.js  — Login / Register logic
// ═══════════════════════════════════════════════════════════

const Auth = (() => {
  // Current logged-in player data (kept in memory + localStorage)
  let _player = null;

  // ── Load saved session ──────────────────────────────────
  function loadSession() {
    const saved = localStorage.getItem('bb_player');
    if (saved) {
      try { _player = JSON.parse(saved); } catch { _player = null; }
    }
    return _player;
  }

  function saveSession(player) {
    _player = player;
    localStorage.setItem('bb_player', JSON.stringify(player));
  }

  function clearSession() {
    _player = null;
    localStorage.removeItem('bb_player');
  }

  function getPlayer() { return _player; }

  // ── Update local player data and save ──────────────────
  function updatePlayer(fields) {
    if (!_player) return;
    Object.assign(_player, fields);
    saveSession(_player);
  }

  // ── Register ────────────────────────────────────────────
  async function register(username, password) {
    if (!username || username.length < 3) return 'Username must be 3+ characters.';
    if (!password || password.length < 4) return 'Password must be 4+ characters.';

    // Check if already taken
    const existing = await dbGetProfile(username);
    if (existing) return 'Username is already taken!';

    const result = await dbCreateProfile(username, password);
    if (result.error) return 'Registration failed. Try again.';

    saveSession(result.data);
    return null; // null = success
  }

  // ── Login ───────────────────────────────────────────────
  async function login(username, password) {
    if (!username || !password) return 'Enter username and password.';

    const profile = await dbGetProfile(username);
    if (!profile) return 'Username not found.';
    if (profile.password !== password) return 'Wrong password.';

    saveSession(profile);
    return null;
  }

  // ── Logout ──────────────────────────────────────────────
  function logout() {
    clearSession();
  }

  return { loadSession, saveSession, clearSession, getPlayer, updatePlayer, register, login, logout };
})();
