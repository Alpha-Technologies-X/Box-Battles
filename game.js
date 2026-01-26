var game = (function() {
    var scene, camera, renderer;
    var camera2, renderer2;
    var players = [];
    var gameMode = null;
    var peer, connections = [];
    var isHost = false;
    var myPlayerId = 0;
    var animationId = null;
    var roomCode = '';
    var playersInRoom = [];
    var currentUser = null;
    var isGuest = false;
    var playerCameras = [];
    
    var characterSkins = [
        { name: 'Classic Red', color: 0xff0000, cost: 0, owned: true },
        { name: 'Ocean Blue', color: 0x0000ff, cost: 0, owned: true },
        { name: 'Forest Green', color: 0x00ff00, cost: 0, owned: true },
        { name: 'Solar Yellow', color: 0xffff00, cost: 0, owned: true },
        { name: 'Purple Haze', color: 0x9b59b6, cost: 100, owned: false },
        { name: 'Orange Crush', color: 0xff8c00, cost: 100, owned: false },
        { name: 'Pink Power', color: 0xff69b4, cost: 150, owned: false },
        { name: 'Cyan Dream', color: 0x00ffff, cost: 150, owned: false },
        { name: 'Gold Rush', color: 0xffd700, cost: 300, owned: false },
        { name: 'Silver Strike', color: 0xc0c0c0, cost: 300, owned: false }
    ];
    
    var playerColors = [0xff0000, 0x0000ff, 0x00ff00, 0xffff00];
    var playerNames = ['Red', 'Blue', 'Green', 'Yellow'];
    
    var gameState = {
        players: [
            { health: 100, jumping: false, velocity: { x: 0, y: 0, z: 0 }, position: { x: -4, y: 1, z: 0 } },
            { health: 100, jumping: false, velocity: { x: 0, y: 0, z: 0 }, position: { x: 4, y: 1, z: 0 } },
            { health: 100, jumping: false, velocity: { x: 0, y: 0, z: 0 }, position: { x: -4, y: 1, z: 4 } },
            { health: 100, jumping: false, velocity: { x: 0, y: 0, z: 0 }, position: { x: 4, y: 1, z: 4 } }
        ]
    };
    
    var keys = {};
    var moveSpeed = 0.2;
    var jumpPower = 0.4;
    var gravity = 0.015;
    var attackRange = 3;
    var attackCooldowns = [0, 0, 0, 0];
    var mouseSensitivity = 0.002;
    var rotationX = [0, 0, 0, 0];
    var rotationY = [0, 0, 0, 0];
    var mouseMovement = { x: 0, y: 0 };
    
    function saveToStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
    
    function getFromStorage(key) {
        var item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }
    
    function showLogin() {
        hideAllScreens();
        document.getElementById('loginScreen').classList.add('active');
    }
    
    function showRegister() {
        hideAllScreens();
        document.getElementById('registerScreen').classList.add('active');
    }
    
    function register() {
        var username = document.getElementById('regUsername').value.trim();
        var password = document.getElementById('regPassword').value;
        var confirm = document.getElementById('regConfirmPassword').value;
        
        if (!username || !password) {
            alert('Please fill in all fields!');
            return;
        }
        
        if (password !== confirm) {
            alert('Passwords do not match!');
            return;
        }
        
        var users = getFromStorage('users') || {};
        
        if (users[username]) {
            alert('Username already exists!');
            return;
        }
        
        users[username] = {
            password: password,
            coins: 0,
            ownedSkins: [0, 1, 2, 3],
            selectedSkin: 0
        };
        
        saveToStorage('users', users);
        alert('Account created successfully!');
        showLogin();
    }
    
    function login() {
        var username = document.getElementById('loginUsername').value.trim();
        var password = document.getElementById('loginPassword').value;
        
        var users = getFromStorage('users') || {};
        
        if (!users[username]) {
            alert('User not found!');
            return;
        }
        
        if (users[username].password !== password) {
            alert('Incorrect password!');
            return;
        }
        
        currentUser = username;
        isGuest = false;
        document.getElementById('shopBtn').style.display = 'block';
        loadUserData();
        showStart();
    }
    
    function playAsGuest() {
        currentUser = 'Guest';
        isGuest = true;
        document.getElementById('shopBtn').style.display = 'none';
        document.getElementById('userInfo').style.display = 'none';
        showStart();
    }
    
    function logout() {
        currentUser = null;
        isGuest = false;
        document.getElementById('userInfo').style.display = 'none';
        showLogin();
    }
    
    function loadUserData() {
        if (isGuest) {
            return;
        }
        
        var users = getFromStorage('users') || {};
        var userData = users[currentUser];
        
        document.getElementById('username').textContent = currentUser;
        document.getElementById('coinCount').textContent = userData.coins || 0;
        document.getElementById('userInfo').style.display = 'block';
        
        for (var i = 0; i < characterSkins.length; i++) {
            characterSkins[i].owned = userData.ownedSkins.indexOf(i) !== -1;
        }
    }
    
    function addCoins(amount) {
        if (isGuest) return;
        
        var users = getFromStorage('users') || {};
        users[currentUser].coins += amount;
        saveToStorage('users', users);
        document.getElementById('coinCount').textContent = users[currentUser].coins;
    }
    
    function showShop() {
        hideAllScreens();
        document.getElementById('shopScreen').classList.add('active');
        renderShop();
    }
    
    function renderShop() {
        var grid = document.getElementById('shopGrid');
        grid.innerHTML = '';
        
        var users = getFromStorage('users') || {};
        var userData = users[currentUser];
        
        for (var i = 0; i < characterSkins.length; i++) {
            var skin = characterSkins[i];
            var item = document.createElement('div');
            item.className = 'shop-item' + (skin.owned ? ' owned' : '');
            
            var preview = document.createElement('div');
            preview.className = 'character-preview';
            preview.style.background = '#' + skin.color.toString(16).padStart(6, '0');
            
            var title = document.createElement('h3');
            title.textContent = skin.name;
            title.style.marginBottom = '10px';
            
            item.appendChild(title);
            item.appendChild(preview);
            
            if (skin.owned) {
                var ownedText = document.createElement('p');
                ownedText.textContent = 'OWNED';
                ownedText.style.color = '#4CAF50';
                ownedText.style.fontWeight = 'bold';
                item.appendChild(ownedText);
            } else {
                var costText = document.createElement('p');
                costText.textContent = '💰 ' + skin.cost + ' Coins';
                item.appendChild(costText);
                item.onclick = (function(index) {
                    return function() {
                        buySkin(index);
                    };
                })(i);
            }
            
            grid.appendChild(item);
        }
    }
    
    function buySkin(index) {
        var users = getFromStorage('users') || {};
        var userData = users[currentUser];
        var skin = characterSkins[index];
        
        if (userData.coins < skin.cost) {
            alert('Not enough coins! Play more games to earn coins.');
            return;
        }
        
        userData.coins -= skin.cost;
        userData.ownedSkins.push(index);
        skin.owned = true;
        
        saveToStorage('users', users);
        loadUserData();
        renderShop();
        alert('Skin purchased successfully!');
    }
    
    function showSettings() {
        hideAllScreens();
        document.getElementById('settingsScreen').classList.add('active');
    }
    
    function generateRoomCode() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        var code = '';
        for (var i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
    
    function initPeer() {
        roomCode = generateRoomCode();
        peer = new Peer(roomCode);
        
        peer.on('open', function(id) {
            document.getElementById('roomCode').textContent = roomCode;
            isHost = true;
            myPlayerId = 0;
            playersInRoom = [{ id: roomCode, name: 'Player 1 (You)' }];
            updatePlayersList();
            document.getElementById('startBtn').style.display = 'block';
        });
        
        peer.on('connection', function(conn) {
            if (playersInRoom.length < 4) {
                connections.push(conn);
                setupConnection(conn);
                var playerNum = playersInRoom.length + 1;
                playersInRoom.push({ id: conn.peer, name: 'Player ' + playerNum });
                updatePlayersList();
                broadcastPlayersList();
            } else {
                conn.close();
            }
        });
        
        peer.on('error', function(err) {
            console.error('PeerJS Error:', err);
            alert('Connection error. Trying to reconnect...');
        });
    }
    
    function join() {
        var code = document.getElementById('codeInput').value.trim().toUpperCase();
        if (code.length !== 8) {
            document.getElementById('joinStatus').textContent = '❌ Room code must be 8 characters!';
            document.getElementById('joinStatus').style.color = '#ff6b6b';
            return;
        }
        
        document.getElementById('joinStatus').textContent = '🔄 Connecting...';
        document.getElementById('joinStatus').style.color = '#ffd700';
        
        roomCode = code;
        
        if (!peer || peer.destroyed) {
            peer = new Peer();
        }
        
        peer.on('open', function(id) {
            var conn = peer.connect(roomCode);
            if (!conn) {
                document.getElementById('joinStatus').textContent = '❌ Failed to connect to room!';
                document.getElementById('joinStatus').style.color = '#ff6b6b';
                return;
            }
            
            conn.on('open', function() {
                document.getElementById('joinStatus').textContent = '✅ Connected! Waiting for host to start...';
                document.getElementById('joinStatus').style.color = '#4CAF50';
            });
            
            conn.on('error', function(err) {
                document.getElementById('joinStatus').textContent = '❌ Connection error!';
                document.getElementById('joinStatus').style.color = '#ff6b6b';
                console.error('Connection Error:', err);
            });
            
            connections.push(conn);
            setupConnection(conn);
            isHost = false;
        });
        
        peer.on('error', function(err) {
            console.error('PeerJS Error:', err);
            document.getElementById('joinStatus').textContent = '❌ Could not find room. Check the code!';
            document.getElementById('joinStatus').style.color = '#ff6b6b';
        });
    }
    
    function setupConnection(conn) {
        conn.on('open', function() {
            if (!isHost) {
                conn.send({ type: 'requestJoin' });
            }
        });
        
        conn.on('data', function(data) {
            if (data.type === 'requestJoin' && isHost) {
                var newPlayerId = playersInRoom.length;
                conn.send({ 
                    type: 'joinAccepted', 
                    playerId: newPlayerId,
                    players: playersInRoom
                });
                broadcastPlayersList();
            } else if (data.type === 'joinAccepted') {
                myPlayerId = data.playerId;
                playersInRoom = data.players;
                var myName = 'Player ' + (myPlayerId + 1) + ' (You)';
                playersInRoom.push({ id: conn.peer, name: myName });
                updatePlayersList();
            } else if (data.type === 'playersList') {
                playersInRoom = data.players;
                var found = false;
                for (var i = 0; i < playersInRoom.length; i++) {
                    if (playersInRoom[i].name.indexOf('(You)') !== -1) {
                        found = true;
                        break;
                    }
                }
                if (!found && myPlayerId < playersInRoom.length) {
                    playersInRoom[myPlayerId].name += ' (You)';
                }
                updatePlayersList();
            } else if (data.type === 'startGame') {
                start('online');
            } else if (data.type === 'gameState' && !isHost) {
                gameState = data.state;
                updateVisuals();
            } else if (data.type === 'input' && isHost) {
                processPlayerInput(data.playerId, data.keys);
            }
        });
        
        conn.on('error', function(err) {
            console.error('Connection Error:', err);
        });
    }
    
    function broadcastPlayersList() {
        for (var i = 0; i < connections.length; i++) {
            if (connections[i] && connections[i].open) {
                connections[i].send({ type: 'playersList', players: playersInRoom });
            }
        }
    }
    
    function updatePlayersList() {
        var html = '';
        for (var i = 0; i < playersInRoom.length; i++) {
            html += '<div class="player-item">' + playersInRoom[i].name + '</div>';
        }
        document.getElementById('playersList').innerHTML = html;
    }
    
    function startOnline() {
        if (!isHost) return;
        
        for (var i = 0; i < connections.length; i++) {
            if (connections[i] && connections[i].open) {
                connections[i].send({ type: 'startGame' });
            }
        }
        start('online');
    }
    
    function sendGameState() {
        if (!isHost) return;
        for (var i = 0; i < connections.length; i++) {
            if (connections[i] && connections[i].open) {
                connections[i].send({ type: 'gameState', state: gameState });
            }
        }
    }
    
    function sendInput() {
        if (isHost || connections.length === 0) return;
        if (connections[0] && connections[0].open) {
            connections[0].send({ type: 'input', playerId: myPlayerId, keys: keys });
        }
    }
    
    function hideAllScreens() {
        var screens = document.querySelectorAll('.screen');
        for (var i = 0; i < screens.length; i++) {
            screens[i].classList.remove('active');
        }
    }
    
    function showStart() {
        hideAllScreens();
        document.getElementById('startScreen').classList.add('active');
        document.getElementById('hud').classList.remove('active');
        
        var canvas2 = document.getElementById('gameCanvas2');
        if (canvas2) {
            document.body.removeChild(canvas2);
        }
        
        var canvas = document.getElementById('gameCanvas');
        canvas.style.width = '100%';
        canvas.style.float = 'none';
        
        for (var i = 0; i < players.length; i++) {
            if (players[i]) {
                scene.remove(players[i]);
            }
        }
        players = [];
        playerCameras = [];
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (peer) {
            peer.destroy();
            peer = null;
        }
        connections = [];
        playersInRoom = [];
        gameMode = null;
        
        if (renderer2) {
            renderer2 = null;
        }
    }
    
    function showBotSelect() {
        hideAllScreens();
        document.getElementById('botSelectScreen').classList.add('active');
    }
    
    function showLocal() {
        start('local');
    }
    
    function showMultiplayer() {
        hideAllScreens();
        document.getElementById('multiplayerScreen').classList.add('active');
    }
    
    function hostGame() {
        hideAllScreens();
        document.getElementById('hostScreen').classList.add('active');
        if (!peer) initPeer();
    }
    
    function showJoinGame() {
        hideAllScreens();
        document.getElementById('joinScreen').classList.add('active');
        if (!peer) {
            peer = new Peer();
        }
    }
    
    function initThreeJS() {
        var canvas = document.getElementById('gameCanvas');
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        
        var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        
        var directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);
        
        var floorGeometry = new THREE.BoxGeometry(30, 0.5, 30);
        var floorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
        var floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.y = -0.25;
        floor.receiveShadow = true;
        scene.add(floor);
        
        var wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8b4513, 
            transparent: false, 
            opacity: 1
        });
        
        var backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 0.5), wallMaterial);
        backWall.position.set(0, 4, -15);
        backWall.receiveShadow = true;
        scene.add(backWall);
        
        var frontWall = new THREE.Mesh(new THREE.BoxGeometry(30, 8, 0.5), wallMaterial);
        frontWall.position.set(0, 4, 15);
        frontWall.receiveShadow = true;
        scene.add(frontWall);
        
        var leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 30), wallMaterial);
        leftWall.position.set(-15, 4, 0);
        leftWall.receiveShadow = true;
        scene.add(leftWall);
        
        var rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 30), wallMaterial);
        rightWall.position.set(15, 4, 0);
        rightWall.receiveShadow = true;
        scene.add(rightWall);
        
        canvas.addEventListener('click', function() {
            canvas.requestPointerLock();
        });
        
        document.addEventListener('mousemove', function(e) {
            if (document.pointerLockElement === canvas) {
                mouseMovement.x = e.movementX;
                mouseMovement.y = e.movementY;
            }
        });
        
        window.addEventListener('resize', function() {
            if (gameMode === 'local') {
                camera.aspect = (window.innerWidth / 2) / window.innerHeight;
                camera2.aspect = (window.innerWidth / 2) / window.innerHeight;
                camera.updateProjectionMatrix();
                camera2.updateProjectionMatrix();
                renderer.setSize(window.innerWidth / 2, window.innerHeight);
                renderer2.setSize(window.innerWidth / 2, window.innerHeight);
            } else {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });
    }
    
    function start(mode) {
        gameMode = mode;
        hideAllScreens();
        document.getElementById('hud').classList.add('active');
        
        var numPlayers = 2;
        if (mode === 'online') {
            numPlayers = playersInRoom.length;
        }
        
        for (var i = 0; i < players.length; i++) {
            if (players[i]) {
                scene.remove(players[i]);
            }
        }
        players = [];
        playerCameras = [];
        
        for (var i = 0; i < numPlayers; i++) {
            gameState.players[i].health = 100;
            gameState.players[i].jumping = false;
            gameState.players[i].velocity = { x: 0, y: 0, z: 0 };
            attackCooldowns[i] = 0;
            rotationX[i] = 0;
            rotationY[i] = 0;
            
            var playerGeometry = new THREE.BoxGeometry(1, 2, 1);
            var playerMaterial = new THREE.MeshStandardMaterial({ color: playerColors[i] });
            var player = new THREE.Mesh(playerGeometry, playerMaterial);
            player.castShadow = true;
            players.push(player);
            scene.add(player);
            
            var cam = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            playerCameras.push(cam);
        }
        
        if (gameMode === 'local') {
            var canvas = document.getElementById('gameCanvas');
            canvas.style.width = '50%';
            canvas.style.float = 'left';
            
            var canvas2 = document.createElement('canvas');
            canvas2.id = 'gameCanvas2';
            canvas2.style.width = '50%';
            canvas2.style.float = 'right';
            document.body.appendChild(canvas2);
            
            camera = playerCameras[0];
            camera2 = playerCameras[1];
            
            camera.aspect = (window.innerWidth / 2) / window.innerHeight;
            camera2.aspect = (window.innerWidth / 2) / window.innerHeight;
            camera.updateProjectionMatrix();
            camera2.updateProjectionMatrix();
            
            renderer.setSize(window.innerWidth / 2, window.innerHeight);
            renderer2 = new THREE.WebGLRenderer({ canvas: canvas2, antialias: true });
            renderer2.setSize(window.innerWidth / 2, window.innerHeight);
            renderer2.shadowMap.enabled = true;
        } else {
            camera = playerCameras[myPlayerId] || playerCameras[0];
            var canvas = document.getElementById('gameCanvas');
            canvas.style.width = '100%';
            canvas.style.float = 'none';
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        if (!renderer) {
            initThreeJS();
        }
        
        updateHUD(numPlayers);
        updateVisuals();
        animate();
    }
    
    function updateHUD(numPlayers) {
        var html = '';
        for (var i = 0; i < numPlayers; i++) {
            var colorHex = playerColors[i].toString(16).padStart(6, '0');
            html += '<div class="health-container">';
            html += '<div style="color:#' + colorHex + '">' + playerNames[i] + '</div>';
            html += '<div class="health-bar-bg">';
            html += '<div id="h' + i + '" class="health-bar" style="background:#' + colorHex + ';width:120px"></div>';
            html += '</div></div>';
        }
        document.getElementById('hud').innerHTML = html;
    }
    
    function updateHealthBars() {
        for (var i = 0; i < players.length; i++) {
            var elem = document.getElementById('h' + i);
            if (elem) {
                elem.style.width = (gameState.players[i].health * 1.2) + 'px';
            }
        }
    }
    
    function updateVisuals() {
        for (var i = 0; i < players.length; i++) {
            if (players[i]) {
                players[i].position.set(
                    gameState.players[i].position.x, 
                    gameState.players[i].position.y, 
                    gameState.players[i].position.z
                );
                
                if (playerCameras[i]) {
                    playerCameras[i].position.set(
                        gameState.players[i].position.x,
                        gameState.players[i].position.y + 1.6,
                        gameState.players[i].position.z
                    );
                    
                    playerCameras[i].rotation.order = 'YXZ';
                    playerCameras[i].rotation.y = rotationY[i];
                    playerCameras[i].rotation.x = rotationX[i];
                }
            }
        }
        updateHealthBars();
    }
    
    function createAttackEffect(position, color) {
        var effect = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 16),
            new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 })
        );
        effect.position.copy(position);
        scene.add(effect);
        
        setTimeout(function() {
            scene.remove(effect);
        }, 200);
    }
    
    function botAI() {
        var botKeys = {};
        var p1Pos = gameState.players[0].position;
        var p2Pos = gameState.players[1].position;
        var distance = Math.sqrt(
            Math.pow(p1Pos.x - p2Pos.x, 2) + 
            Math.pow(p1Pos.z - p2Pos.z, 2)
        );
        
        var reactionThreshold = 0.95;
        var jumpThreshold = 0.98;
        var chaseDistance = 3;
        
        if (gameMode === 'bot-easy') {
            reactionThreshold = 0.90;
            jumpThreshold = 0.99;
            chaseDistance = 4;
        } else if (gameMode === 'bot-medium') {
            reactionThreshold = 0.95;
            jumpThreshold = 0.98;
            chaseDistance = 3;
        } else if (gameMode === 'bot-hard') {
            reactionThreshold = 0.97;
            jumpThreshold = 0.96;
            chaseDistance = 2;
        }
        
        if (distance > chaseDistance) {
            if (p1Pos.x < p2Pos.x) {
                botKeys['arrowleft'] = true;
            } else {
                botKeys['arrowright'] = true;
            }
            
            if (p1Pos.z < p2Pos.z) {
                botKeys['arrowup'] = true;
            } else {
                botKeys['arrowdown'] = true;
            }
        }
        
        if (distance < attackRange && Math.random() > reactionThreshold) {
            botKeys['enter'] = true;
        }
        
        if (Math.random() > jumpThreshold && !gameState.players[1].jumping) {
            botKeys['shift'] = true;
        }
        
        return botKeys;
    }
    
    function processPlayerInput(playerNum, inputKeys) {
        if (playerNum >= players.length) return;
        
        var state = gameState.players[playerNum];
        var controls;
        
        if (gameMode === 'online') {
            controls = { up: 'w', down: 's', left: 'a', right: 'd', jump: 'q', attack: 'e', lookUp: 'arrowup', lookDown: 'arrowdown', lookLeft: 'arrowleft', lookRight: 'arrowright' };
        } else if (gameMode === 'local') {
            controls = (playerNum === 0) ? 
                { up: 'w', down: 's', left: 'a', right: 'd', jump: 'q', attack: 'e', lookUp: 'arrowup', lookDown: 'arrowdown', lookLeft: 'arrowleft', lookRight: 'arrowright' } :
                { up: 'i', down: 'k', left: 'j', right: 'l', jump: 'u', attack: 'o', lookUp: 't', lookDown: 'g', lookLeft: 'f', lookRight: 'h' };
        } else {
            controls = (playerNum === 0) ? 
                { up: 'w', down: 's', left: 'a', right: 'd', jump: 'q', attack: 'e', lookUp: 'arrowup', lookDown: 'arrowdown', lookLeft: 'arrowleft', lookRight: 'arrowright' } :
                { up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', jump: 'shift', attack: 'enter', lookUp: 't', lookDown: 'g', lookLeft: 'f', lookRight: 'h' };
        }
        
        var cam = playerCameras[playerNum];
        if (!cam) return;
        
        if (gameMode !== 'local' && playerNum === myPlayerId && document.pointerLockElement) {
            rotationY[playerNum] -= mouseMovement.x * mouseSensitivity;
            rotationX[playerNum] -= mouseMovement.y * mouseSensitivity;
            rotationX[playerNum] = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX[playerNum]));
            mouseMovement.x = 0;
            mouseMovement.y = 0;
        } else {
            if (inputKeys[controls.lookLeft]) rotationY[playerNum] += 0.05;
            if (inputKeys[controls.lookRight]) rotationY[playerNum] -= 0.05;
            if (inputKeys[controls.lookUp]) rotationX[playerNum] += 0.05;
            if (inputKeys[controls.lookDown]) rotationX[playerNum] -= 0.05;
            rotationX[playerNum] = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX[playerNum]));
        }
        
        var forward = new THREE.Vector3(
            Math.sin(rotationY[playerNum]),
            0,
            Math.cos(rotationY[playerNum])
        );
        var right = new THREE.Vector3(
            Math.sin(rotationY[playerNum] + Math.PI / 2),
            0,
            Math.cos(rotationY[playerNum] + Math.PI / 2)
        );
        
        state.velocity.x = 0;
        state.velocity.z = 0;
        
        if (inputKeys[controls.up]) {
            state.velocity.x += forward.x * moveSpeed;
            state.velocity.z += forward.z * moveSpeed;
        }
        if (inputKeys[controls.down]) {
            state.velocity.x -= forward.x * moveSpeed;
            state.velocity.z -= forward.z * moveSpeed;
        }
        if (inputKeys[controls.left]) {
            state.velocity.x -= right.x * moveSpeed;
            state.velocity.z -= right.z * moveSpeed;
        }
        if (inputKeys[controls.right]) {
            state.velocity.x += right.x * moveSpeed;
            state.velocity.z += right.z * moveSpeed;
        }
        
        if (inputKeys[controls.jump] && !state.jumping) {
            state.velocity.y = jumpPower;
            state.jumping = true;
        }
        
        if (inputKeys[controls.attack] && attackCooldowns[playerNum] <= 0) {
            for (var i = 0; i < players.length; i++) {
                if (i === playerNum) continue;
                
                var opponent = gameState.players[i];
                var distance = Math.sqrt(
                    Math.pow(state.position.x - opponent.position.x, 2) +
                    Math.pow(state.position.y - opponent.position.y, 2) +
                    Math.pow(state.position.z - opponent.position.z, 2)
                );
                
                if (distance < attackRange) {
                    opponent.health -= 5;
                    createAttackEffect(
                        new THREE.Vector3(opponent.position.x, opponent.position.y, opponent.position.z),
                        playerColors[playerNum]
                    );
                    
                    var dx = opponent.position.x - state.position.x;
                    var dz = opponent.position.z - state.position.z;
                    var len = Math.sqrt(dx * dx + dz * dz);
                    if (len > 0) {
                        opponent.velocity.x += (dx / len) * 0.6;
                        opponent.velocity.y += 0.3;
                        opponent.velocity.z += (dz / len) * 0.6;
                    }
                    
                    if (opponent.health <= 0) {
                        checkWinner();
                    }
                }
            }
            attackCooldowns[playerNum] = 30;
        }
    }
    
    function checkWinner() {
        var alive = [];
        for (var i = 0; i < players.length; i++) {
            if (gameState.players[i].health > 0) {
                alive.push(i);
            }
        }
        
        if (alive.length === 1) {
            endGame(playerNames[alive[0]] + ' Wins!');
        } else if (alive.length === 0) {
            endGame('Draw!');
        }
    }
    
    function animate() {
        var aliveCount = 0;
        for (var i = 0; i < players.length; i++) {
            if (gameState.players[i].health > 0) {
                aliveCount++;
            }
        }
        
        if (aliveCount <= 1) {
            if (renderer) renderer.render(scene, camera);
            return;
        }
        
        animationId = requestAnimationFrame(animate);
        
        if (gameMode === 'local') {
            processPlayerInput(0, keys);
            processPlayerInput(1, keys);
        } else if (gameMode === 'bot-easy' || gameMode === 'bot-medium' || gameMode === 'bot-hard') {
            processPlayerInput(0, keys);
            var botKeys = botAI();
            processPlayerInput(1, botKeys);
        } else if (gameMode === 'online') {
            if (isHost) {
                processPlayerInput(myPlayerId, keys);
                sendGameState();
            } else {
                processPlayerInput(myPlayerId, keys);
                sendInput();
            }
        }
        
        for (var i = 0; i < players.length; i++) {
            gameState.players[i].velocity.y -= gravity;
            
            gameState.players[i].position.x += gameState.players[i].velocity.x;
            gameState.players[i].position.y += gameState.players[i].velocity.y;
            gameState.players[i].position.z += gameState.players[i].velocity.z;
            
            if (gameState.players[i].position.y <= 1) {
                gameState.players[i].position.y = 1;
                gameState.players[i].velocity.y = 0;
                gameState.players[i].jumping = false;
            }
            
            var maxPos = 14.5;
            gameState.players[i].position.x = Math.max(-maxPos, Math.min(maxPos, gameState.players[i].position.x));
            gameState.players[i].position.z = Math.max(-maxPos, Math.min(maxPos, gameState.players[i].position.z));
            
            if (attackCooldowns[i] > 0) attackCooldowns[i]--;
        }
        
        updateVisuals();
        
        if (gameMode === 'local') {
            renderer.render(scene, camera);
            renderer2.render(scene, camera2);
        } else {
            renderer.render(scene, camera);
        }
    }
    
    function endGame(winnerText) {
        document.getElementById('winnerText').textContent = winnerText;
        
        var coinsEarned = Math.floor(Math.random() * 20) + 10;
        if (!isGuest) {
            addCoins(coinsEarned);
            document.getElementById('coinsEarned').textContent = '+ ' + coinsEarned + ' Coins Earned!';
        } else {
            document.getElementById('coinsEarned').textContent = 'Login to earn coins!';
        }
        
        hideAllScreens();
        document.getElementById('winnerScreen').classList.add('active');
        document.getElementById('hud').classList.remove('active');
    }
    
    function reset() {
        document.getElementById('winnerScreen').classList.remove('active');
        
        var canvas2 = document.getElementById('gameCanvas2');
        if (canvas2) {
            document.body.removeChild(canvas2);
        }
        
        var canvas = document.getElementById('gameCanvas');
        canvas.style.width = '100%';
        canvas.style.float = 'none';
        
        for (var i = 0; i < players.length; i++) {
            if (players[i]) {
                scene.remove(players[i]);
            }
        }
        players = [];
        playerCameras = [];
        
        for (var i = 0; i < 4; i++) {
            gameState.players[i].health = 100;
            gameState.players[i].jumping = false;
            gameState.players[i].velocity = { x: 0, y: 0, z: 0 };
            attackCooldowns[i] = 0;
            rotationX[i] = 0;
            rotationY[i] = 0;
        }
        
        if (renderer2) {
            renderer2 = null;
        }
        
        start(gameMode);
    }
    
    window.addEventListener('keydown', function(e) {
        keys[e.key.toLowerCase()] = true;
    });
    
    window.addEventListener('keyup', function(e) {
        keys[e.key.toLowerCase()] = false;
    });
    
    initThreeJS();
    
    return {
        showLogin: showLogin,
        showRegister: showRegister,
        register: register,
        login: login,
        playAsGuest: playAsGuest,
        logout: logout,
        showStart: showStart,
        showLocal: showLocal,
        showBotSelect: showBotSelect,
        showMultiplayer: showMultiplayer,
        hostGame: hostGame,
        showJoinGame: showJoinGame,
        showShop: showShop,
        showSettings: showSettings,
        start: start,
        join: join,
        startOnline: startOnline,
        reset: reset
    };
})();
