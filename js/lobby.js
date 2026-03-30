// ═══════════════════════════════════════════════════════════
//  lobby.js  — Lobby creation, joining, teams, chat
// ═══════════════════════════════════════════════════════════

const GameLobby = (() => {
  let _mode      = 'ffa';
  let _lobbyCode = null;
  let _isHost    = false;
  let _players   = [];   // array of { username, color, team, ready, isHost }
  let _myTeam    = null;

  function getMode()      { return _mode; }
  function getLobbyCode() { return _lobbyCode; }
  function getPlayers()   { return _players; }
  function isHost()       { return _isHost; }

  // ── Mode buttons ─────────────────────────────────────────
  function initModeButtons() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _mode = btn.dataset.mode;
      });
    });
  }

  // ── Generate a random 6-char lobby code ──────────────────
  function makeCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // ── Open the lobby screen ─────────────────────────────────
  function openLobby(code, host) {
    _lobbyCode = code;
    _isHost    = host;
    document.getElementById('lobby-code-display').textContent = code;
    document.getElementById('lobby-mode-label').textContent   = CONFIG.MODES[_mode]?.label || _mode;

    // Show team panel if team mode
    const teamsPanel = document.getElementById('lobby-teams');
    teamsPanel.style.display = CONFIG.MODES[_mode]?.teams ? 'flex' : 'none';

    // Start button only visible to host
    document.getElementById('btn-start-game').style.display = host ? '' : 'none';

    UI.showScreen('lobby');
    renderLobbyPlayers();
  }

  // ── Render player slots ───────────────────────────────────
  function renderLobbyPlayers() {
    const container = document.getElementById('lobby-players');
    container.innerHTML = '';

    for (let i = 0; i < CONFIG.MAX_PLAYERS; i++) {
      const card = document.createElement('div');
      if (_players[i]) {
        const pl   = _players[i];
        const colObj = CONFIG.PLAYER_COLORS.find(c => c.hex === pl.color) || CONFIG.PLAYER_COLORS[0];
        card.className = 'lobby-player-card';
        card.innerHTML = `
          <div class="lp-avatar">${colObj.emoji}</div>
          <div class="lp-name">${pl.username}</div>
          ${pl.isHost ? '<div class="lp-host">👑 Host</div>' : '<div class="lp-ready">✅ Ready</div>'}
          ${CONFIG.MODES[_mode]?.teams && pl.team ? `<div style="font-size:11px;color:var(--text2)">Team: ${pl.team}</div>` : ''}
        `;
      } else {
        card.className = 'lobby-player-card empty';
        card.innerHTML = '<div style="color:var(--text2);font-size:13px">Empty</div>';
      }
      container.appendChild(card);
    }

    // Update team lists
    if (CONFIG.MODES[_mode]?.teams) {
      ['red','blue'].forEach(t => {
        const el = document.getElementById(`team-${t}-list`);
        el.innerHTML = '';
        _players.filter(p => p.team === t).forEach(p => {
          const d = document.createElement('div');
          d.className = 'member-item';
          d.textContent = p.username;
          el.appendChild(d);
        });
      });
    }
  }

  // ── Add / update a player in the lobby ───────────────────
  function addPlayer(playerData) {
    const idx = _players.findIndex(p => p.username === playerData.username);
    if (idx >= 0) {
      _players[idx] = { ..._players[idx], ...playerData };
    } else {
      _players.push(playerData);
    }
    renderLobbyPlayers();
  }

  function removePlayer(username) {
    _players = _players.filter(p => p.username !== username);
    renderLobbyPlayers();
  }

  // ── Join a team ───────────────────────────────────────────
  function joinTeam(team) {
    _myTeam = team;
    const p = Auth.getPlayer();
    // Broadcast team change via network
    Network.broadcast({ type: 'team_change', username: p.username, team });
    const me = _players.find(pl => pl.username === p.username);
    if (me) me.team = team;
    renderLobbyPlayers();
  }

  // ── Lobby chat ────────────────────────────────────────────
  function addChatMsg(name, msg) {
    const container = document.getElementById('lobby-chat-messages');
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<span class="chat-name">${name}:</span> ${msg}`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // ── Create lobby (host) ───────────────────────────────────
  function createLobby() {
    const code = makeCode();
    const p    = Auth.getPlayer();
    _players   = [{ username: p.username, color: p.color, isHost: true, team: null }];

    // Initialize PeerJS as host
    Network.initAsHost(code, {
      onPlayerJoin:   (data) => { addPlayer(data); Network.broadcast({ type: 'lobby_state', players: _players }); },
      onPlayerLeave:  (un)   => removePlayer(un),
      onChatMessage:  (name, msg) => addChatMsg(name, msg),
      onTeamChange:   (un, team)  => { const pl = _players.find(x => x.username === un); if (pl) pl.team = team; renderLobbyPlayers(); },
    });

    openLobby(code, true);
    UI.toast(`Lobby created! Code: ${code} 🏟️`, '#3dff8f');
  }

  // ── Join lobby (client) ───────────────────────────────────
  function joinLobby(code) {
    if (!code || code.length < 4) { UI.toast('Enter a valid lobby code.', '#ff5b5b'); return; }
    const p = Auth.getPlayer();

    Network.initAsClient(code, {
      onLobbyState: (players) => { _players = players; renderLobbyPlayers(); },
      onPlayerJoin: (data)    => addPlayer(data),
      onPlayerLeave:(un)      => removePlayer(un),
      onChatMessage:(name, msg) => addChatMsg(name, msg),
      onGameStart:  ()        => GameEngine.start(_players, _mode, false),
    });

    // Tell host I joined
    const colorObj = CONFIG.PLAYER_COLORS.find(c => c.hex === p.color) || CONFIG.PLAYER_COLORS[0];
    Network.sendToHost({ type: 'player_join', username: p.username, color: p.color, emoji: colorObj.emoji });

    addPlayer({ username: p.username, color: p.color, isHost: false });
    openLobby(code, false);
  }

  // ── Quick match (join random or create) ──────────────────
  async function quickMatch() {
    UI.toast('Searching for a match… ⚡');
    // For GitHub Pages we store open lobbies in Supabase
    const { data } = await DB.from('open_lobbies')
      .select('*')
      .eq('mode', _mode)
      .lt('player_count', CONFIG.MAX_PLAYERS)
      .order('created_at', { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      const lobby = data[0];
      // Update count
      await DB.from('open_lobbies').update({ player_count: lobby.player_count + 1 }).eq('id', lobby.id);
      joinLobby(lobby.id);
    } else {
      // No open lobby: create one
      const code = makeCode();
      await DB.from('open_lobbies').insert([{ id: code, mode: _mode, player_count: 1 }]);
      createLobbyWithCode(code);
    }
  }

  function createLobbyWithCode(code) {
    const p  = Auth.getPlayer();
    _players = [{ username: p.username, color: p.color, isHost: true, team: null }];
    Network.initAsHost(code, {
      onPlayerJoin:  (data) => { addPlayer(data); Network.broadcast({ type: 'lobby_state', players: _players }); },
      onPlayerLeave: (un)   => removePlayer(un),
      onChatMessage: (name, msg) => addChatMsg(name, msg),
      onTeamChange:  (un, team) => { const pl = _players.find(x => x.username === un); if (pl) pl.team = team; renderLobbyPlayers(); },
    });
    openLobby(code, true);
  }

  // ── Start game (host only) ────────────────────────────────
  function startGame() {
    if (!_isHost) return;
    Network.broadcast({ type: 'game_start', mode: _mode, players: _players });
    // Remove from open lobbies
    DB.from('open_lobbies').delete().eq('id', _lobbyCode);
    GameEngine.start(_players, _mode, true);
  }

  // ── Leave lobby ───────────────────────────────────────────
  function leaveLobby() {
    Network.disconnect();
    _players = [];
    _isHost  = false;
    _lobbyCode = null;
    UI.showScreen('menu');
  }

  // ── Chat send ─────────────────────────────────────────────
  function sendChat() {
    const input = document.getElementById('lobby-chat-input');
    const msg   = input.value.trim();
    if (!msg) return;
    input.value = '';
    const p = Auth.getPlayer();
    Network.broadcast({ type: 'chat', username: p.username, msg });
    addChatMsg(p.username, msg);
  }

  // ── Init event listeners ──────────────────────────────────
  function init() {
    initModeButtons();
    document.getElementById('btn-quickmatch').addEventListener('click', quickMatch);
    document.getElementById('btn-create-lobby').addEventListener('click', createLobby);
    document.getElementById('btn-join-lobby').addEventListener('click', () => {
      const code = document.getElementById('join-code-input').value.trim().toUpperCase();
      joinLobby(code);
    });
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(_lobbyCode || '');
      UI.toast('Code copied! 📋');
    });
    document.getElementById('btn-start-game').addEventListener('click', startGame);
    document.getElementById('btn-leave-lobby').addEventListener('click', leaveLobby);
    document.getElementById('btn-lobby-chat-send').addEventListener('click', sendChat);
    document.getElementById('lobby-chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChat();
    });
  }

  return { init, getMode, getLobbyCode, getPlayers, isHost, addPlayer, removePlayer, joinTeam, addChatMsg, startGame, leaveLobby };
})();
