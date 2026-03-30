// ═══════════════════════════════════════════════════════════
//  game.js  — Box Battles 3D game engine (Three.js)
// ═══════════════════════════════════════════════════════════

const GameEngine = (() => {

  // ── Three.js scene objects ────────────────────────────────
  let scene, camera, renderer, clock;
  let animFrame = null;

  // ── Game state ────────────────────────────────────────────
  let _players    = {};   // { username: { mesh, hp, shield, pos, vel, kills, alive, team } }
  let _myUsername = '';
  let _mode       = 'ffa';
  let _isHost     = false;
  let _paused     = false;
  let _chatOpen   = false;

  // Abilities state
  const _cooldowns = { punch: 0, shield: 0, dash: 0, special: 0 };
  let _shieldActive   = false;
  let _shieldTimer    = 0;
  let _specialCharge  = 100;

  // Health packs
  let _healthPacks = [];
  let _hpSpawnTimer = 0;

  // Input
  const _keys = {};

  // ── Arena constants ───────────────────────────────────────
  const ARENA  = CONFIG.ARENA_SIZE;
  const SPEED  = 0.18;
  const GRAVITY= -0.012;
  const JUMP_F = 0.25;

  // ── Start ─────────────────────────────────────────────────
  function start(lobbyPlayers, mode, isHost) {
    _mode    = mode;
    _isHost  = isHost;
    _players = {};
    _healthPacks = [];
    _hpSpawnTimer = CONFIG.HEALTH_PACK_TIME;
    _paused  = false;
    _chatOpen = false;

    const p = Auth.getPlayer();
    _myUsername = p.username;

    // Build player entries
    lobbyPlayers.forEach(lp => {
      _players[lp.username] = {
        username: lp.username,
        color:    lp.color || '#5b8cff',
        team:     lp.team  || null,
        hp:       100,
        shield:   0,
        kills:    0,
        alive:    true,
        pos:      { x: (Math.random() - 0.5) * ARENA, y: 1, z: (Math.random() - 0.5) * ARENA },
        vel:      { x: 0, y: 0, z: 0 },
        onGround: true,
        mesh:     null,
        label:    null,
        isMe:     lp.username === p.username,
      };
    });

    initThree();
    buildArena();
    spawnAllPlayers();
    setupHUD();
    setupNetwork();
    setupInput();

    UI.showScreen('game');
    // Start loop
    if (animFrame) cancelAnimationFrame(animFrame);
    clock = new THREE.Clock();
    loop();
  }

  // ── Three.js setup ────────────────────────────────────────
  function initThree() {
    const canvas = document.getElementById('game-canvas');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0d14);
    scene.fog = new THREE.Fog(0x0d0d14, 30, 100);

    // Camera (3rd-person behind player)
    camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 500);
    camera.position.set(0, 10, 14);

    // Renderer
    if (renderer) renderer.dispose();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffd7a0, 1.2);
    sun.position.set(20, 40, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width  = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    // Resize handler
    window.addEventListener('resize', onResize);
  }

  function onResize() {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  }

  // ── Build arena ───────────────────────────────────────────
  function buildArena() {
    // Floor
    const floorGeo = new THREE.BoxGeometry(ARENA * 2, 1, ARENA * 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
    const floor    = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid lines
    const grid = new THREE.GridHelper(ARENA * 2, 20, 0x2e2e4a, 0x2e2e4a);
    grid.position.y = 0.01;
    scene.add(grid);

    // Arena boundary walls (visual only, collision handled in JS)
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x5b8cff, transparent: true, opacity: 0.18 });
    [
      { w: ARENA * 2, h: 6, d: 0.5, x: 0,     z: ARENA  },
      { w: ARENA * 2, h: 6, d: 0.5, x: 0,     z: -ARENA },
      { w: 0.5,       h: 6, d: ARENA * 2, x: ARENA,  z: 0 },
      { w: 0.5,       h: 6, d: ARENA * 2, x: -ARENA, z: 0 },
    ].forEach(w => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
      mesh.position.set(w.x, 3, w.z);
      scene.add(mesh);
    });

    // Platforms for vertical gameplay
    const platMat = new THREE.MeshLambertMaterial({ color: 0x3a3a5a });
    const platforms = [
      { x:  8, y: 2.5, z:  0, w: 8, d: 4 },
      { x: -8, y: 2.5, z:  0, w: 8, d: 4 },
      { x:  0, y: 5,   z:  8, w: 6, d: 6 },
      { x:  0, y: 5,   z: -8, w: 6, d: 6 },
      { x:  0, y: 8,   z:  0, w: 5, d: 5 }, // center high platform
    ];
    platforms.forEach(pl => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pl.w, 0.6, pl.d), platMat);
      mesh.position.set(pl.x, pl.y, pl.z);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.isPlatform = true;
      mesh.userData.bounds = {
        minX: pl.x - pl.w / 2, maxX: pl.x + pl.w / 2,
        minZ: pl.z - pl.d / 2, maxZ: pl.z + pl.d / 2,
        top:  pl.y + 0.3,
      };
      scene.add(mesh);
    });

    // Stars / particles in background
    const starGeo = new THREE.BufferGeometry();
    const starVerts = [];
    for (let i = 0; i < 400; i++) {
      starVerts.push((Math.random() - 0.5) * 200, Math.random() * 60 + 5, (Math.random() - 0.5) * 200);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3 }));
    scene.add(stars);
  }

  // ── Spawn a player's box mesh ─────────────────────────────
  function spawnAllPlayers() {
    Object.values(_players).forEach(pl => spawnPlayer(pl));
  }

  function spawnPlayer(pl) {
    if (pl.mesh) { scene.remove(pl.mesh); }

    // Box body
    const geo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(pl.color) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.position.set(pl.pos.x, pl.pos.y, pl.pos.z);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.28, 0.28].forEach(xOff => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
      eye.position.set(xOff, 0.18, 0.71);
      mesh.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      pupil.position.set(0, 0, 0.07);
      eye.add(pupil);
    });

    // Outline (slightly bigger box in accent color)
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    const outline    = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), outlineMat);
    mesh.add(outline);

    // Floating name label (canvas texture)
    pl.label = makeNameLabel(pl.username, pl.color);
    mesh.add(pl.label);
    pl.label.position.set(0, 1.2, 0);

    scene.add(mesh);
    pl.mesh = mesh;
  }

  // Canvas-based text label above player
  function makeNameLabel(name, color) {
    const canvas = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font      = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3, 0.75, 1);
    return sprite;
  }

  // ── Input ──────────────────────────────────────────────────
  function setupInput() {
    document.addEventListener('keydown', e => {
      if (_chatOpen) return;
      _keys[e.code] = true;

      if (e.code === 'Escape') { _paused = !_paused; document.getElementById('pause-menu').classList.toggle('hidden', !_paused); }
      if (e.code === 'KeyT')   { openGameChat(); }
      if (e.code === 'KeyF')   { doAbility('punch'); }
      if (e.code === 'KeyG')   { doAbility('shield'); }
      if (e.code === 'KeyQ')   { doAbility('dash'); }
      if (e.code === 'KeyE')   { doAbility('special'); }
    });
    document.addEventListener('keyup', e => { _keys[e.code] = false; });

    // Ability slots click
    document.getElementById('slot-1').addEventListener('click', () => doAbility('punch'));
    document.getElementById('slot-2').addEventListener('click', () => doAbility('shield'));
    document.getElementById('slot-3').addEventListener('click', () => doAbility('dash'));
    document.getElementById('slot-4').addEventListener('click', () => doAbility('special'));

    // Pause menu
    document.getElementById('btn-resume').addEventListener('click', () => {
      _paused = false;
      document.getElementById('pause-menu').classList.add('hidden');
    });
    document.getElementById('btn-quit-game').addEventListener('click', endGame);

    // In-game chat
    document.getElementById('btn-game-chat-send').addEventListener('click', sendGameChat);
    document.getElementById('game-chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendGameChat();
      if (e.key === 'Escape') closeGameChat();
    });
  }

  function openGameChat() {
    _chatOpen = true;
    document.getElementById('game-chat-input-row').style.display = 'flex';
    document.getElementById('game-chat-input').focus();
  }
  function closeGameChat() {
    _chatOpen = false;
    document.getElementById('game-chat-input-row').style.display = 'none';
    document.getElementById('game-chat-input').blur();
  }
  function sendGameChat() {
    const input = document.getElementById('game-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    Network.broadcast({ type: 'chat', username: _myUsername, msg });
    addGameChatMsg(_myUsername, msg);
    closeGameChat();
  }
  function addGameChatMsg(name, msg) {
    const el = document.createElement('div');
    el.className = 'chat-msg';
    el.innerHTML = `<span class="chat-name">${name}:</span> ${msg}`;
    const container = document.getElementById('game-chat-messages');
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // ── Abilities ──────────────────────────────────────────────
  function doAbility(name) {
    if (_paused) return;
    const me = _players[_myUsername];
    if (!me || !me.alive) return;
    const now = Date.now();

    if (name === 'punch' && now > _cooldowns.punch) {
      _cooldowns.punch = now + 800;
      doPunch();
    } else if (name === 'shield' && now > _cooldowns.shield) {
      _cooldowns.shield   = now + 5000;
      _shieldActive       = true;
      _shieldTimer        = now + 2000;
      me.shield           = 50;
      updateHUD();
      UI.toast('🛡️ Shield active!', '#4a8fff');
    } else if (name === 'dash' && now > _cooldowns.dash) {
      _cooldowns.dash = now + 2000;
      doDash();
    } else if (name === 'special' && now > _cooldowns.special && _specialCharge >= 100) {
      _cooldowns.special = now + 8000;
      _specialCharge     = 0;
      doSpecial();
    }
    updateAbilitySlots();
  }

  function doPunch() {
    const me = _players[_myUsername];
    const range = 3.5;
    const damage = 18;
    // Check nearby players
    Object.values(_players).forEach(target => {
      if (target.username === _myUsername || !target.alive) return;
      // Team check
      if (_mode !== 'ffa' && target.team && target.team === me.team) return;

      const dx = target.pos.x - me.pos.x;
      const dz = target.pos.z - me.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < range) {
        applyDamage(target, damage, _myUsername);
        // knockback
        target.vel.x += (dx / dist) * 0.4;
        target.vel.z += (dz / dist) * 0.4;
        target.vel.y += 0.15;
      }
    });
    // Punch animation
    if (me.mesh) {
      me.mesh.scale.set(1.3, 0.8, 1.3);
      setTimeout(() => { if (me.mesh) me.mesh.scale.set(1, 1, 1); }, 150);
    }
    Network.broadcast({ type: 'attack', attacker: _myUsername, ability: 'punch' });
    addKillFeedMsg(`${_myUsername} 👊`);
  }

  function doDash() {
    const me = _players[_myUsername];
    // Dash in movement direction
    const dir = { x: 0, z: 0 };
    if (_keys['KeyW'] || _keys['ArrowUp'])    dir.z -= 1;
    if (_keys['KeyS'] || _keys['ArrowDown'])  dir.z += 1;
    if (_keys['KeyA'] || _keys['ArrowLeft'])  dir.x -= 1;
    if (_keys['KeyD'] || _keys['ArrowRight']) dir.x += 1;
    const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z) || 1;
    me.vel.x += (dir.x / len) * 0.8;
    me.vel.z += (dir.z / len) * 0.8;
    me.vel.y  = 0.1;
    addKillFeedMsg(`${_myUsername} 💨`);
  }

  function doSpecial() {
    const me = _players[_myUsername];
    // Shockwave: damage all nearby
    Object.values(_players).forEach(target => {
      if (target.username === _myUsername || !target.alive) return;
      if (_mode !== 'ffa' && target.team && target.team === me.team) return;
      const dx = target.pos.x - me.pos.x;
      const dz = target.pos.z - me.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 7) {
        const dmg = Math.round(35 * (1 - dist / 7));
        applyDamage(target, dmg, _myUsername);
        target.vel.x += (dx / (dist || 1)) * 0.6;
        target.vel.z += (dz / (dist || 1)) * 0.6;
        target.vel.y  = 0.3;
      }
    });
    addKillFeedMsg(`${_myUsername} ⚡ SPECIAL!`);
    Network.broadcast({ type: 'attack', attacker: _myUsername, ability: 'special' });
  }

  // ── Damage system ──────────────────────────────────────────
  function applyDamage(target, amount, attackerUsername) {
    if (!target.alive) return;
    if (target.username === _myUsername && _shieldActive) {
      target.shield -= amount;
      if (target.shield < 0) {
        target.hp += target.shield;
        target.shield = 0;
        _shieldActive = false;
      }
    } else {
      target.hp -= amount;
    }
    if (target.hp <= 0) {
      target.hp    = 0;
      target.alive = false;
      killPlayer(target, attackerUsername);
    }
    // Flash mesh red
    if (target.mesh) {
      target.mesh.material.color.set(0xff0000);
      setTimeout(() => { if (target.mesh) target.mesh.material.color.set(new THREE.Color(target.color)); }, 200);
    }
    // Broadcast if I caused the damage
    if (attackerUsername === _myUsername) {
      Network.broadcast({ type: 'health_update', username: target.username, hp: target.hp, shield: target.shield });
    }
    updateHUD();
  }

  function killPlayer(pl, killerUsername) {
    if (pl.mesh) {
      // Death animation: spin and fade
      pl.mesh.userData.dying = true;
      pl.alive = false;
    }
    if (killerUsername && _players[killerUsername]) {
      _players[killerUsername].kills++;
      if (killerUsername === _myUsername) {
        // Reward coins/XP locally (will sync on game end)
      }
    }
    addKillFeedMsg(`💀 ${pl.username} was eliminated by ${killerUsername || '???'}`);
    Network.broadcast({ type: 'player_died', username: pl.username });
    checkWinCondition();
  }

  function checkWinCondition() {
    const alive = Object.values(_players).filter(p => p.alive);
    if (_mode === 'ffa') {
      if (alive.length <= 1) {
        const winner = alive[0];
        endGame(winner ? winner.username : null);
      }
    } else {
      // Team mode
      const aliveTeams = [...new Set(alive.map(p => p.team))];
      if (aliveTeams.length <= 1) {
        endGame(aliveTeams[0] || null);
      }
    }
  }

  // ── Health packs ───────────────────────────────────────────
  function spawnHealthPack() {
    const pos = {
      x: (Math.random() - 0.5) * ARENA * 1.4,
      y: 0.5,
      z: (Math.random() - 0.5) * ARENA * 1.4,
    };
    const geo  = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const mat  = new THREE.MeshLambertMaterial({ color: 0x3dff8f });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y, pos.z);
    scene.add(mesh);
    const pack = { mesh, pos, active: true };
    _healthPacks.push(pack);

    if (_isHost) {
      Network.broadcast({ type: 'health_pack_spawn', pos });
    }
    return pack;
  }

  function checkHealthPackCollision(pl) {
    _healthPacks.forEach(pack => {
      if (!pack.active) return;
      const dx = pl.pos.x - pack.pos.x;
      const dz = pl.pos.z - pack.pos.z;
      if (Math.sqrt(dx * dx + dz * dz) < 1.2) {
        pack.active = false;
        scene.remove(pack.mesh);
        pl.hp = Math.min(100, pl.hp + 30);
        addKillFeedMsg(`${pl.username} picked up ❤️ +30 HP`);
        updateHUD();
        if (_isHost) Network.broadcast({ type: 'health_pack_taken', username: pl.username });
      }
    });
  }

  // ── HUD ────────────────────────────────────────────────────
  function setupHUD() {
    updateHUD();
    updatePlayerList();
  }

  function updateHUD() {
    const me = _players[_myUsername];
    if (!me) return;
    const hp = Math.max(0, me.hp);
    const sh = Math.max(0, me.shield);
    document.getElementById('hud-health-bar').style.width  = hp + '%';
    document.getElementById('hud-hp-text').textContent     = hp;
    document.getElementById('hud-shield-bar').style.width  = sh + '%';
    document.getElementById('hud-shield-text').textContent = sh;
  }

  function updatePlayerList() {
    const el = document.getElementById('hud-player-list');
    el.innerHTML = '';
    Object.values(_players).forEach(pl => {
      const div = document.createElement('div');
      div.className = 'hud-player';
      div.style.borderLeft = `3px solid ${pl.color}`;
      div.innerHTML = `${pl.username} <span class="hp-mini">❤️ ${Math.max(0, pl.hp)}</span> ${pl.alive ? '' : '💀'}`;
      el.appendChild(div);
    });
  }

  function updateAbilitySlots() {
    const now = Date.now();
    const slots = [
      { id: 'slot-1', cd: _cooldowns.punch,   total: 800  },
      { id: 'slot-2', cd: _cooldowns.shield,  total: 5000 },
      { id: 'slot-3', cd: _cooldowns.dash,    total: 2000 },
      { id: 'slot-4', cd: _cooldowns.special, total: 8000 },
    ];
    slots.forEach(s => {
      const el = document.getElementById(s.id);
      if (now < s.cd) {
        el.classList.add('on-cooldown');
      } else {
        el.classList.remove('on-cooldown');
      }
    });
  }

  function addKillFeedMsg(msg) {
    const el = document.getElementById('hud-kill-feed');
    el.textContent = msg;
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.textContent = ''; }, 3000);
  }

  // ── Network game callbacks ─────────────────────────────────
  function setupNetwork() {
    Network.setGameCallbacks({
      onPlayerState: (data) => {
        const pl = _players[data.username];
        if (!pl || data.username === _myUsername) return;
        pl.pos.x = data.x; pl.pos.y = data.y; pl.pos.z = data.z;
        if (pl.mesh) pl.mesh.position.set(data.x, data.y, data.z);
      },
      onHealthUpdate: (data) => {
        const pl = _players[data.username];
        if (!pl) return;
        pl.hp     = data.hp;
        pl.shield = data.shield;
        updateHUD();
        updatePlayerList();
      },
      onPlayerDied: (username) => {
        const pl = _players[username];
        if (pl) { pl.alive = false; pl.hp = 0; }
        updatePlayerList();
        checkWinCondition();
      },
      onHealthPackSpawn: (pos) => {
        const geo  = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const mat  = new THREE.MeshLambertMaterial({ color: 0x3dff8f });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        scene.add(mesh);
        _healthPacks.push({ mesh, pos, active: true });
      },
      onHealthPackTaken: (username) => {
        const pl = _players[username];
        if (pl) { pl.hp = Math.min(100, pl.hp + 30); updateHUD(); }
      },
      onGameChat: (name, msg) => addGameChatMsg(name, msg),
    });
  }

  // ── Main game loop ────────────────────────────────────────
  let _netTick = 0;
  function loop() {
    animFrame = requestAnimationFrame(loop);
    const dt = clock.getDelta();
    if (_paused || _chatOpen) return;

    updateMyPlayer(dt);
    animateOtherPlayers(dt);
    animateHealthPacks(dt);
    updateCamera();
    updateHUD();
    updatePlayerList();
    updateAbilitySlots();
    checkShieldExpiry();
    handleHealthPackSpawn(dt);

    // Network send every TICK_RATE ms
    _netTick += dt * 1000;
    if (_netTick >= CONFIG.TICK_RATE) {
      _netTick = 0;
      const me = _players[_myUsername];
      if (me) {
        Network.sendPlayerState({ x: me.pos.x, y: me.pos.y, z: me.pos.z });
      }
    }

    renderer.render(scene, camera);
  }

  // ── Update my player ──────────────────────────────────────
  function updateMyPlayer(dt) {
    const me = _players[_myUsername];
    if (!me || !me.alive || !me.mesh) return;

    // Movement
    const moveSpeed = SPEED;
    if (_keys['KeyW'] || _keys['ArrowUp'])    { me.vel.z -= moveSpeed; }
    if (_keys['KeyS'] || _keys['ArrowDown'])  { me.vel.z += moveSpeed; }
    if (_keys['KeyA'] || _keys['ArrowLeft'])  { me.vel.x -= moveSpeed; }
    if (_keys['KeyD'] || _keys['ArrowRight']) { me.vel.x += moveSpeed; }
    if ((_keys['Space'] || _keys['KeyW'] && _keys['Space']) && me.onGround) {
      me.vel.y = JUMP_F;
      me.onGround = false;
    }

    // Gravity
    me.vel.y += GRAVITY;

    // Friction
    me.vel.x *= 0.75;
    me.vel.z *= 0.75;

    // Apply velocity
    me.pos.x += me.vel.x;
    me.pos.y += me.vel.y;
    me.pos.z += me.vel.z;

    // Floor
    if (me.pos.y <= 1) {
      me.pos.y    = 1;
      me.vel.y    = 0;
      me.onGround = true;
    }

    // Arena bounds (clamp + bounce)
    if (me.pos.x >  ARENA) { me.pos.x =  ARENA; me.vel.x *= -0.4; }
    if (me.pos.x < -ARENA) { me.pos.x = -ARENA; me.vel.x *= -0.4; }
    if (me.pos.z >  ARENA) { me.pos.z =  ARENA; me.vel.z *= -0.4; }
    if (me.pos.z < -ARENA) { me.pos.z = -ARENA; me.vel.z *= -0.4; }

    // Platform collision
    scene.children.forEach(obj => {
      if (!obj.userData.isPlatform) return;
      const b = obj.userData.bounds;
      if (me.pos.x > b.minX && me.pos.x < b.maxX && me.pos.z > b.minZ && me.pos.z < b.maxZ) {
        if (me.pos.y <= b.top + 1.5 && me.pos.y > b.top - 0.5 && me.vel.y <= 0) {
          me.pos.y    = b.top + 1;
          me.vel.y    = 0;
          me.onGround = true;
        }
      }
    });

    // Spinning animation when moving
    if (Math.abs(me.vel.x) > 0.03 || Math.abs(me.vel.z) > 0.03) {
      me.mesh.rotation.y += 0.1;
    }

    me.mesh.position.set(me.pos.x, me.pos.y, me.pos.z);

    // Health pack check
    checkHealthPackCollision(me);
    _specialCharge = Math.min(100, _specialCharge + 0.04);
  }

  // ── Animate other players ─────────────────────────────────
  function animateOtherPlayers(dt) {
    Object.values(_players).forEach(pl => {
      if (pl.username === _myUsername || !pl.mesh) return;
      if (pl.mesh.userData.dying) {
        pl.mesh.rotation.y += 0.15;
        pl.mesh.scale.multiplyScalar(0.97);
        if (pl.mesh.scale.x < 0.05) { scene.remove(pl.mesh); pl.mesh = null; }
      }
    });
  }

  // ── Animate health packs ──────────────────────────────────
  function animateHealthPacks(dt) {
    _healthPacks.forEach(pack => {
      if (!pack.active) return;
      pack.mesh.rotation.y += 0.04;
      pack.mesh.position.y  = 0.5 + Math.sin(Date.now() / 600) * 0.2;
    });
  }

  // ── Health pack spawn (host only) ─────────────────────────
  function handleHealthPackSpawn(dt) {
    if (!_isHost) return;
    _hpSpawnTimer -= dt * 1000;
    if (_hpSpawnTimer <= 0) {
      _hpSpawnTimer = CONFIG.HEALTH_PACK_TIME;
      if (_healthPacks.filter(h => h.active).length < 3) spawnHealthPack();
    }
  }

  // ── Shield expiry ─────────────────────────────────────────
  function checkShieldExpiry() {
    if (_shieldActive && Date.now() > _shieldTimer) {
      _shieldActive = false;
      const me = _players[_myUsername];
      if (me) me.shield = 0;
    }
  }

  // ── Camera follows my player ──────────────────────────────
  function updateCamera() {
    const me = _players[_myUsername];
    if (!me) return;
    const target = new THREE.Vector3(me.pos.x, me.pos.y + 6, me.pos.z + 12);
    camera.position.lerp(target, 0.1);
    camera.lookAt(me.pos.x, me.pos.y, me.pos.z);
  }

  // ── End game ──────────────────────────────────────────────
  async function endGame(winnerOrTeam) {
    cancelAnimationFrame(animFrame);
    animFrame = null;

    const p   = Auth.getPlayer();
    const me  = _players[_myUsername] || {};

    // Calculate rewards
    const isWinner = _mode === 'ffa' ? winnerOrTeam === _myUsername : winnerOrTeam === me.team;
    const xpGain    = (isWinner ? CONFIG.XP_PER_WIN : 0) + (me.kills || 0) * CONFIG.XP_PER_KILL;
    const coinGain  = (isWinner ? CONFIG.COINS_PER_WIN : 0) + (me.kills || 0) * CONFIG.COINS_PER_KILL;

    await dbUpdateProfile(p.username, {
      xp:     (p.xp     || 0) + xpGain,
      coins:  (p.coins  || 0) + coinGain,
      wins:   (p.wins   || 0) + (isWinner ? 1 : 0),
      losses: (p.losses || 0) + (isWinner ? 0 : 1),
      kills:  (p.kills  || 0) + (me.kills || 0),
    });
    Auth.updatePlayer({
      xp:     (p.xp     || 0) + xpGain,
      coins:  (p.coins  || 0) + coinGain,
      wins:   (p.wins   || 0) + (isWinner ? 1 : 0),
      losses: (p.losses || 0) + (isWinner ? 0 : 1),
      kills:  (p.kills  || 0) + (me.kills || 0),
    });

    // Build results screen
    const sorted = Object.values(_players).sort((a, b) => b.kills - a.kills);
    const title  = _mode === 'ffa'
      ? (winnerOrTeam ? `🏆 ${winnerOrTeam} Wins!` : 'Draw!')
      : (winnerOrTeam ? `🏆 Team ${winnerOrTeam.toUpperCase()} Wins!` : 'Draw!');

    document.getElementById('results-title').textContent = title;
    document.getElementById('results-xp').textContent    = `+${xpGain} XP`;
    document.getElementById('results-coins').textContent = `+${coinGain} 🪙`;

    const list = document.getElementById('results-list');
    list.innerHTML = '';
    const medals = ['🥇','🥈','🥉'];
    sorted.forEach((pl, i) => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `
        <div class="result-rank">${medals[i] || '#' + (i + 1)}</div>
        <div style="width:14px;height:14px;border-radius:3px;background:${pl.color}"></div>
        <div class="result-name">${pl.username}</div>
        <div class="result-kills">⚔️ ${pl.kills} kills</div>
        <div>${pl.alive ? '✅' : '💀'}</div>
      `;
      list.appendChild(row);
    });

    Network.disconnect();
    UI.showScreen('results');
  }

  return { start, endGame };
})();
