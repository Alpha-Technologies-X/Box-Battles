// ═══════════════════════════════════════════════════════════
//  main.js  — App bootstrap, wires everything together
// ═══════════════════════════════════════════════════════════

(async function init() {
  // 1) Fake loading progress for polish
  const bar  = document.getElementById('loading-bar');
  const text = document.getElementById('loading-text');
  const steps = [
    [20,  'Loading shaders…'],
    [45,  'Building arena…'],
    [70,  'Connecting to servers…'],
    [90,  'Spawning boxes…'],
    [100, 'Ready! 🥊'],
  ];
  for (const [pct, msg] of steps) {
    await delay(320);
    bar.style.width  = pct + '%';
    text.textContent = msg;
  }
  await delay(500);

  // 2) Auth event listeners
  document.getElementById('btn-login').addEventListener('click', async () => {
    const u = document.getElementById('auth-username').value.trim();
    const pw = document.getElementById('auth-password').value;
    const err = await Auth.login(u, pw);
    if (err) {
      document.getElementById('auth-error').textContent = err;
    } else {
      enterMenu();
    }
  });

  document.getElementById('btn-register').addEventListener('click', async () => {
    const u = document.getElementById('auth-username').value.trim();
    const pw = document.getElementById('auth-password').value;
    const err = await Auth.register(u, pw);
    if (err) {
      document.getElementById('auth-error').textContent = err;
    } else {
      enterMenu();
    }
  });

  // Enter key on password field
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
  });

  // 3) Check for saved session
  const saved = Auth.loadSession();
  if (saved) {
    // Refresh from DB in case stats changed
    const fresh = await dbGetProfile(saved.username);
    if (fresh) { Auth.saveSession(fresh); }
    enterMenu();
  } else {
    UI.showScreen('auth');
  }

  // 4) Menu buttons
  document.getElementById('btn-logout').addEventListener('click', () => {
    Auth.logout();
    UI.showScreen('auth');
  });

  document.getElementById('btn-shop').addEventListener('click', () => {
    Shop.open();
  });

  document.getElementById('btn-shop-back').addEventListener('click', () => {
    UI.showScreen('menu');
  });

  document.getElementById('btn-results-menu').addEventListener('click', () => {
    UI.showScreen('menu');
    UI.refreshMenuStrip();
  });

  // 5) Init modules
  UI.initTabs();
  GameLobby.init();
  Social.init();

})();

// ── Helper: go to the main menu ──────────────────────────
function enterMenu() {
  UI.refreshMenuStrip();
  UI.refreshProfile();
  UI.showScreen('menu');
  Social.pollInvites();
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
