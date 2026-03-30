// ═══════════════════════════════════════════════════════════
//  network.js  — PeerJS P2P networking (host ↔ up to 5 clients)
//  Host keeps a connection to every client.
//  Clients connect only to the host.
// ═══════════════════════════════════════════════════════════

const Network = (() => {
  let _peer      = null;   // Our PeerJS peer
  let _conns     = {};     // { peerId: DataConnection }
  let _hostConn  = null;   // Client's connection to host
  let _isHost    = false;
  let _callbacks = {};

  // ── Create a PeerJS peer with a given ID ──────────────────
  function _createPeer(id) {
    return new Promise((resolve, reject) => {
      const peer = new Peer('bb-' + id, {
        debug: 0,
      });
      peer.on('open', () => resolve(peer));
      peer.on('error', e => {
        // If ID is taken (host role taken), try generic peer
        if (e.type === 'unavailable-id') {
          const fallback = new Peer({ debug: 0 });
          fallback.on('open', () => resolve(fallback));
          fallback.on('error', reject);
        } else {
          reject(e);
        }
      });
    });
  }

  // ── Handle incoming data from any connection ───────────────
  function _handleData(data) {
    if (!data || !data.type) return;
    const cb = _callbacks;

    switch (data.type) {
      // ─ Lobby ─
      case 'player_join':
        if (cb.onPlayerJoin) cb.onPlayerJoin(data);
        break;
      case 'player_leave':
        if (cb.onPlayerLeave) cb.onPlayerLeave(data.username);
        break;
      case 'lobby_state':
        if (cb.onLobbyState) cb.onLobbyState(data.players);
        break;
      case 'chat':
        if (cb.onChatMessage) cb.onChatMessage(data.username, data.msg);
        if (cb.onGameChat)    cb.onGameChat(data.username, data.msg);
        break;
      case 'team_change':
        if (cb.onTeamChange) cb.onTeamChange(data.username, data.team);
        break;
      case 'game_start':
        if (cb.onGameStart) cb.onGameStart(data.mode, data.players);
        break;

      // ─ Game sync ─
      case 'player_state':
        if (cb.onPlayerState) cb.onPlayerState(data);
        break;
      case 'attack':
        if (cb.onAttack) cb.onAttack(data);
        break;
      case 'health_update':
        if (cb.onHealthUpdate) cb.onHealthUpdate(data);
        break;
      case 'player_died':
        if (cb.onPlayerDied) cb.onPlayerDied(data.username);
        break;
      case 'health_pack_spawn':
        if (cb.onHealthPackSpawn) cb.onHealthPackSpawn(data.pos);
        break;
      case 'health_pack_taken':
        if (cb.onHealthPackTaken) cb.onHealthPackTaken(data.username);
        break;
    }

    // If host: relay message to all other clients (acts as relay)
    if (_isHost && data.type !== 'lobby_state') {
      broadcastExcept(data, null); // will be called from conn context
    }
  }

  // ── HOST: open a listening peer ────────────────────────────
  async function initAsHost(lobbyCode, callbacks) {
    _callbacks = callbacks;
    _isHost    = true;
    _conns     = {};

    try {
      _peer = await _createPeer(lobbyCode);
    } catch (e) {
      UI.toast('PeerJS connection failed. Check network.', '#ff5b5b');
      return;
    }

    _peer.on('connection', conn => {
      _conns[conn.peer] = conn;
      conn.on('data', data => {
        // Relay to all other clients
        Object.values(_conns).forEach(c => {
          if (c !== conn && c.open) c.send(data);
        });
        _handleData(data);
      });
      conn.on('close', () => {
        delete _conns[conn.peer];
      });
    });
  }

  // ── CLIENT: connect to host ────────────────────────────────
  async function initAsClient(lobbyCode, callbacks) {
    _callbacks = callbacks;
    _isHost    = false;

    try {
      _peer = await _createPeer(Math.random().toString(36).substring(2, 8));
    } catch (e) {
      UI.toast('PeerJS connection failed.', '#ff5b5b');
      return;
    }

    _hostConn = _peer.connect('bb-' + lobbyCode);
    _hostConn.on('open', () => {
      UI.toast('Connected to lobby! 🔗', '#3dff8f');
    });
    _hostConn.on('data', data => _handleData(data));
    _hostConn.on('close', () => {
      UI.toast('Disconnected from host.', '#ff5b5b');
    });
    _hostConn.on('error', () => {
      UI.toast('Failed to reach host. Check the code.', '#ff5b5b');
    });
  }

  // ── Send to host (client only) ─────────────────────────────
  function sendToHost(data) {
    if (_isHost) return; // Host doesn't send to itself
    if (_hostConn && _hostConn.open) _hostConn.send(data);
  }

  // ── Broadcast to all connected peers ──────────────────────
  function broadcast(data) {
    if (_isHost) {
      Object.values(_conns).forEach(c => { if (c.open) c.send(data); });
    } else {
      sendToHost(data); // clients send to host who relays
    }
  }

  // ── Broadcast except one conn (relay helper) ───────────────
  function broadcastExcept(data, exceptConn) {
    Object.values(_conns).forEach(c => {
      if (c !== exceptConn && c.open) c.send(data);
    });
  }

  // ── Send game state update ─────────────────────────────────
  function sendPlayerState(state) {
    const p = Auth.getPlayer();
    const msg = { type: 'player_state', username: p.username, ...state };
    if (_isHost) {
      broadcastExcept(msg, null);
    } else {
      sendToHost(msg);
    }
  }

  // ── Set game callbacks (called from game.js) ───────────────
  function setGameCallbacks(callbacks) {
    Object.assign(_callbacks, callbacks);
  }

  // ── Disconnect ────────────────────────────────────────────
  function disconnect() {
    if (_peer) { _peer.destroy(); _peer = null; }
    _conns    = {};
    _hostConn = null;
    _isHost   = false;
  }

  return { initAsHost, initAsClient, sendToHost, broadcast, sendPlayerState, setGameCallbacks, disconnect };
})();
