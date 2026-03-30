// ═══════════════════════════════════════════════════════════
//  shop.js  — In-game cosmetics shop
// ═══════════════════════════════════════════════════════════

const Shop = (() => {
  // All available shop items
  const ITEMS = [
    { id: 'trail_fire',    name: 'Fire Trail',     icon: '🔥', price: 200, type: 'trail',  desc: 'Leave a fire trail as you move' },
    { id: 'trail_ice',     name: 'Ice Trail',      icon: '❄️',  price: 200, type: 'trail',  desc: 'Leave an icy trail as you move' },
    { id: 'trail_star',    name: 'Star Trail',     icon: '⭐',  price: 300, type: 'trail',  desc: 'Sparkle wherever you go' },
    { id: 'skin_crown',    name: 'Crown Hat',      icon: '👑',  price: 350, type: 'hat',    desc: 'Wear a golden crown on your box' },
    { id: 'skin_glasses',  name: 'Cool Glasses',   icon: '😎',  price: 150, type: 'hat',    desc: 'Look cool in battle' },
    { id: 'skin_bow',      name: 'Bow Tie',        icon: '🎀',  price: 150, type: 'hat',    desc: 'Stay classy' },
    { id: 'ability_rocket',name: 'Rocket Punch',   icon: '🚀',  price: 500, type: 'ability',desc: 'Launch your punch like a rocket' },
    { id: 'ability_ghost', name: 'Ghost Mode',     icon: '👻',  price: 500, type: 'ability',desc: 'Become briefly invisible' },
    { id: 'win_anim_flip', name: 'Flip Victory',   icon: '🤸',  price: 250, type: 'emote',  desc: 'Do a backflip when you win' },
    { id: 'win_anim_spin', name: 'Spin Victory',   icon: '🌀',  price: 250, type: 'emote',  desc: 'Spin wildly on victory' },
    { id: 'chat_heart',    name: 'Heart Spray',    icon: '💝',  price: 100, type: 'emote',  desc: 'Spray hearts in chat' },
    { id: 'chat_boom',     name: 'Boom Emote',     icon: '💥',  price: 100, type: 'emote',  desc: 'Drop a boom in chat' },
  ];

  function open() {
    const p = Auth.getPlayer();
    document.getElementById('shop-coins').textContent = `🪙 ${p.coins || 0}`;
    const grid = document.getElementById('shop-grid');
    grid.innerHTML = '';
    const owned = p.owned_items || [];

    ITEMS.forEach(item => {
      const isOwned = owned.includes(item.id);
      const card = document.createElement('div');
      card.className = 'shop-item' + (isOwned ? ' owned' : '');
      card.innerHTML = `
        <div class="item-icon">${item.icon}</div>
        <div class="item-name">${item.name}</div>
        <small style="color:var(--text2);font-size:11px">${item.desc}</small>
        ${isOwned
          ? '<div class="item-owned">✅ Owned</div>'
          : `<div class="item-price">🪙 ${item.price}</div>
             <button class="btn primary small" data-id="${item.id}" data-price="${item.price}">Buy</button>`}
      `;
      if (!isOwned) {
        card.querySelector('button').addEventListener('click', () => buyItem(item));
      }
      grid.appendChild(card);
    });

    UI.showScreen('shop');
  }

  async function buyItem(item) {
    const p = Auth.getPlayer();
    if ((p.coins || 0) < item.price) {
      UI.toast('Not enough coins! 🪙', '#ff5b5b');
      return;
    }
    const confirmed = await UI.modal(`Buy ${item.icon} ${item.name}?`, `Cost: 🪙 ${item.price}`, { confirmText: 'Buy!' });
    if (!confirmed) return;

    const newCoins = (p.coins || 0) - item.price;
    const newOwned = [...(p.owned_items || []), item.id];
    await dbUpdateProfile(p.username, { coins: newCoins, owned_items: newOwned });
    Auth.updatePlayer({ coins: newCoins, owned_items: newOwned });
    UI.toast(`Bought ${item.icon} ${item.name}!`, '#3dff8f');
    open(); // refresh shop
  }

  return { open };
})();
