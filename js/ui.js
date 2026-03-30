// ═══════════════════════════════════════════════════════════
//  ui.js  — Screen management & common UI helpers
// ═══════════════════════════════════════════════════════════

const UI = (() => {
  // ── Screen switching ────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + id);
    if (target) target.classList.add('active');
  }

  // ── Modal helper ────────────────────────────────────────
  function modal(title, body, { input = false, placeholder = '', confirmText = 'OK', cancelText = 'Cancel' } = {}) {
    return new Promise(resolve => {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').textContent  = body;
      const inp = document.getElementById('modal-input');
      if (input) {
        inp.style.display = 'block';
        inp.placeholder   = placeholder;
        inp.value         = '';
      } else {
        inp.style.display = 'none';
      }
      document.getElementById('modal-confirm').textContent = confirmText;
      document.getElementById('modal-cancel').textContent  = cancelText;
      document.getElementById('modal-overlay').classList.remove('hidden');

      const cleanup = (val) => {
        document.getElementById('modal-overlay').classList.add('hidden');
        resolve(val);
      };

      document.getElementById('modal-confirm').onclick = () => cleanup(input ? inp.value.trim() : true);
      document.getElementById('modal-cancel').onclick  = () => cleanup(null);
    });
  }

  // ── Toast notification (simple) ─────────────────────────
  function toast(msg, color = '#5b8cff') {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      background: ${color}; color: #fff; padding: 10px 22px; border-radius: 8px;
      font-weight: 700; font-size: 14px; z-index: 9999; pointer-events: none;
      animation: fadeUp .3s ease;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  // ── Tab switching ────────────────────────────────────────
  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById('tab-' + tab);
        if (panel) panel.classList.add('active');
        if (tab === 'leaderboard') Social.loadLeaderboard();
        if (tab === 'alliances')   Social.refreshAlliance();
        if (tab === 'parties')     Social.refreshParty();
        if (tab === 'profile')     UI.refreshProfile();
      });
    });
  }

  // ── Refresh menu player strip ────────────────────────────
  function refreshMenuStrip() {
    const p = Auth.getPlayer();
    if (!p) return;
    document.getElementById('menu-username').textContent = p.username;
    document.getElementById('menu-xp').textContent = `⭐ ${p.xp} XP  |  🪙 ${p.coins} Coins`;
    // avatar color
    const colorObj = CONFIG.PLAYER_COLORS.find(c => c.hex === p.color) || CONFIG.PLAYER_COLORS[0];
    document.getElementById('menu-avatar').textContent = colorObj.emoji;
  }

  // ── Refresh profile tab ──────────────────────────────────
  function refreshProfile() {
    const p = Auth.getPlayer();
    if (!p) return;
    document.getElementById('profile-name').textContent  = p.username;
    document.getElementById('stat-wins').textContent     = p.wins   || 0;
    document.getElementById('stat-losses').textContent   = p.losses || 0;
    document.getElementById('stat-xp').textContent       = p.xp     || 0;
    document.getElementById('stat-coins').textContent    = p.coins  || 0;
    document.getElementById('stat-kills').textContent    = p.kills  || 0;
    document.getElementById('stat-level').textContent    = Math.floor((p.xp || 0) / 500) + 1;

    const colorObj = CONFIG.PLAYER_COLORS.find(c => c.hex === p.color) || CONFIG.PLAYER_COLORS[0];
    document.getElementById('profile-avatar').textContent = colorObj.emoji;

    // Color picker
    const picker = document.getElementById('color-picker');
    picker.innerHTML = '';
    CONFIG.PLAYER_COLORS.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'color-swatch' + (c.hex === p.color ? ' selected' : '');
      sw.style.background = c.hex;
      sw.title = c.name;
      sw.addEventListener('click', async () => {
        await dbUpdateProfile(p.username, { color: c.hex });
        Auth.updatePlayer({ color: c.hex });
        refreshProfile();
        refreshMenuStrip();
      });
      picker.appendChild(sw);
    });
  }

  return { showScreen, modal, toast, initTabs, refreshMenuStrip, refreshProfile };
})();

// Inject CSS keyframe for toast
const s = document.createElement('style');
s.textContent = `@keyframes fadeUp { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }`;
document.head.appendChild(s);
