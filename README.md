# 📦 Box Battles

A **3D online multiplayer fighting game** built for GitHub Pages using Three.js, PeerJS, and Supabase.

---

## 🚀 Features

- **3D Arena** — Three.js-powered 3D boxing arena with platforms, lighting, and shadows
- **Up to 6 players** per match via PeerJS P2P
- **3 Game Modes** — Free-for-All, 2v2 Teams, 3v3 Teams
- **Quick Match** — Auto-join random open lobbies
- **Private Lobbies** — Create a lobby and share the code with friends
- **Parties** — Group up with friends before a match
- **Alliances** — Create or join an alliance (like a clan)
- **4 Abilities** — Punch, Shield, Dash, Special (shockwave)
- **Health Packs** — Spawn in the arena over time
- **Coin & XP Economy** — Earn rewards per kill and win
- **Shop** — Buy cosmetic items with your coins
- **Player Colors** — Choose your box color from 6 options
- **Leaderboard** — Global rankings by XP
- **Lobby Chat + In-Game Chat**
- **Kill Feed & HUD**

---

## 🛠️ Setup Instructions

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a **New Project**
3. Go to **SQL Editor** → **New Query**
4. Paste the contents of `supabase-setup.sql` and click **Run**
5. Go to **Project Settings** → **API**
6. Copy your **Project URL** and **anon public** key

### Step 2 — Add your Supabase keys

Open `js/config.js` and replace:

```js
SUPABASE_URL:  'https://YOUR_PROJECT.supabase.co',
SUPABASE_ANON: 'YOUR_ANON_KEY',
```

with your real values.

### Step 3 — Deploy to GitHub Pages

1. Create a new GitHub repository (e.g., `box-battles`)
2. Upload all these files keeping the folder structure:
   ```
   box-battles/
   ├── index.html
   ├── css/
   │   └── style.css
   ├── js/
   │   ├── config.js
   │   ├── supabase-client.js
   │   ├── auth.js
   │   ├── ui.js
   │   ├── shop.js
   │   ├── social.js
   │   ├── lobby.js
   │   ├── network.js
   │   ├── game.js
   │   └── main.js
   └── supabase-setup.sql  (you can delete this after running it)
   ```
3. Go to your repo **Settings** → **Pages** → Source: **main branch / root**
4. Your game will be live at `https://YOUR_USERNAME.github.io/box-battles`

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| WASD / Arrow Keys | Move |
| Space | Jump |
| F | Punch (attack nearby players) |
| G | Shield (block damage for 2s) |
| Q | Dash (quick burst in move direction) |
| E | Special (shockwave when charged) |
| T | Open chat |
| Esc | Pause |

---

## 📁 File Overview

| File | What it does |
|------|-------------|
| `index.html` | All screens: loading, auth, menu, lobby, game, shop, results |
| `css/style.css` | Dark neon theme, all styles |
| `js/config.js` | Game settings + your Supabase keys |
| `js/supabase-client.js` | Database helpers (profiles, parties, alliances) |
| `js/auth.js` | Login/register with localStorage session |
| `js/ui.js` | Screen switching, modals, toasts, tabs |
| `js/shop.js` | In-game cosmetics shop |
| `js/social.js` | Parties, alliances, leaderboard, invites |
| `js/lobby.js` | Lobby creation, joining, team selection, chat |
| `js/network.js` | PeerJS P2P networking (host relays to clients) |
| `js/game.js` | Three.js 3D game engine, physics, abilities, HUD |
| `js/main.js` | App bootstrap, ties everything together |

---

## 💡 Tips

- The **host** of the lobby acts as a P2P relay server — all clients connect through the host
- Quick Match uses Supabase to find open lobbies automatically
- Passwords are stored plain in this version — good enough for a school/fun project, but for a real app you'd want hashing
- PeerJS uses a free public server by default — for serious use, host your own PeerJS server

---

Made with ❤️ by **Alpha Technologies**

**Please DO NOT Steal Code**
