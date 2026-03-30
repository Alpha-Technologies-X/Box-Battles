// ═══════════════════════════════════════════════════════════
//  social.js  — Parties, Alliances, Leaderboard
// ═══════════════════════════════════════════════════════════

const Social = (() => {

  // ════════════════════ LEADERBOARD ═══════════════════════
  async function loadLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '<p>Loading…</p>';
    const rows = await dbGetLeaderboard(20);
    if (!rows.length) { list.innerHTML = '<p>No players yet!</p>'; return; }
    list.innerHTML = '';
    rows.forEach((row, i) => {
      const medals = ['🥇','🥈','🥉'];
      const colorObj = CONFIG.PLAYER_COLORS.find(c => c.hex === row.color) || CONFIG.PLAYER_COLORS[0];
      const div = document.createElement('div');
      div.className = 'lb-row';
      div.innerHTML = `
        <div class="lb-rank">${medals[i] || '#' + (i + 1)}</div>
        <div style="font-size:22px">${colorObj.emoji}</div>
        <div class="lb-name">${row.username}</div>
        <div class="lb-xp">⭐ ${row.xp} XP</div>
        <div class="lb-xp" style="color:var(--text2)">🏆 ${row.wins} wins</div>
      `;
      list.appendChild(div);
    });
  }

  // ════════════════════ PARTIES ════════════════════════════
  async function refreshParty() {
    const p = Auth.getPlayer();
    const noneMsg  = document.getElementById('party-none-msg');
    const membersEl= document.getElementById('party-members');
    const leaveBtn = document.getElementById('btn-leave-party');

    if (!p.party_id) {
      noneMsg.style.display   = '';
      membersEl.classList.add('hidden');
      leaveBtn.style.display  = 'none';
      return;
    }

    const party = await dbGetParty(p.party_id);
    if (!party) {
      Auth.updatePlayer({ party_id: null });
      refreshParty();
      return;
    }

    noneMsg.style.display  = 'none';
    leaveBtn.style.display = '';
    membersEl.classList.remove('hidden');
    membersEl.innerHTML    = '';

    (party.members || []).forEach(m => {
      const isHost = m === party.host;
      const div = document.createElement('div');
      div.className = 'member-item';
      div.innerHTML = `
        <span class="member-emoji">🎮</span>
        <span style="flex:1">${m}</span>
        ${isHost ? '<span style="color:var(--yellow);font-size:12px">👑 Host</span>' : ''}
      `;
      membersEl.appendChild(div);
    });
  }

  async function createParty() {
    const p = Auth.getPlayer();
    if (p.party_id) { UI.toast('You are already in a party!'); return; }
    const party = await dbCreateParty(p.username, GameLobby.getMode());
    if (!party) { UI.toast('Failed to create party. Check Supabase!', '#ff5b5b'); return; }
    Auth.updatePlayer({ party_id: party.id });
    UI.toast(`Party created! ID: ${party.id}`, '#3dff8f');
    refreshParty();
  }

  async function inviteToParty(friendName) {
    const p = Auth.getPlayer();
    if (!p.party_id) { UI.toast('Create a party first!'); return; }
    // In a real app you'd send a real-time notification via Supabase Realtime.
    // Here we write a pending invite to the invites table.
    await DB.from('invites').insert([{
      to_user: friendName,
      from_user: p.username,
      party_id: p.party_id,
      type: 'party',
    }]);
    UI.toast(`Invite sent to ${friendName}! 📨`, '#5b8cff');
  }

  async function leaveParty() {
    const p = Auth.getPlayer();
    if (!p.party_id) return;
    await dbLeaveParty(p.party_id, p.username);
    Auth.updatePlayer({ party_id: null });
    UI.toast('Left party.');
    refreshParty();
  }

  // Poll for party invites every 10s
  async function pollInvites() {
    const p = Auth.getPlayer();
    if (!p) return;
    const { data } = await DB.from('invites')
      .select('*')
      .eq('to_user', p.username)
      .eq('type', 'party');
    const container = document.getElementById('incoming-invites');
    container.innerHTML = '';
    (data || []).forEach(inv => {
      const card = document.createElement('div');
      card.className = 'invite-card';
      card.innerHTML = `
        <span>🎉</span>
        <span style="flex:1"><b>${inv.from_user}</b> invited you to their party!</span>
        <button class="btn primary small" data-id="${inv.id}" data-party="${inv.party_id}">Accept</button>
        <button class="btn danger small" data-id="${inv.id}">Decline</button>
      `;
      card.querySelectorAll('button')[0].addEventListener('click', () => acceptInvite(inv));
      card.querySelectorAll('button')[1].addEventListener('click', () => declineInvite(inv.id));
      container.appendChild(card);
    });
  }

  async function acceptInvite(inv) {
    const p = Auth.getPlayer();
    if (p.party_id) await leaveParty();
    const party = await dbGetParty(inv.party_id);
    if (!party) { UI.toast('Party no longer exists.', '#ff5b5b'); return; }
    const members = party.members || [];
    if (!members.includes(p.username)) members.push(p.username);
    await dbUpdateParty(inv.party_id, { members });
    await dbUpdateProfile(p.username, { party_id: inv.party_id });
    Auth.updatePlayer({ party_id: inv.party_id });
    await DB.from('invites').delete().eq('id', inv.id);
    UI.toast(`Joined ${inv.from_user}'s party! 🎉`, '#3dff8f');
    refreshParty();
  }

  async function declineInvite(id) {
    await DB.from('invites').delete().eq('id', id);
    pollInvites();
  }

  // ════════════════════ ALLIANCES ══════════════════════════
  async function refreshAlliance() {
    const p = Auth.getPlayer();
    const noneMsg     = document.getElementById('alliance-none-msg');
    const myAllianceEl= document.getElementById('my-alliance');
    const leaveBtn    = document.getElementById('btn-leave-alliance');

    if (!p.alliance_id) {
      noneMsg.style.display     = '';
      myAllianceEl.classList.add('hidden');
      leaveBtn.style.display    = 'none';
      return;
    }

    const alliance = await dbGetAlliance(p.alliance_id);
    if (!alliance) {
      Auth.updatePlayer({ alliance_id: null });
      await dbUpdateProfile(p.username, { alliance_id: null });
      refreshAlliance();
      return;
    }

    noneMsg.style.display  = 'none';
    leaveBtn.style.display = '';
    myAllianceEl.classList.remove('hidden');

    document.getElementById('alliance-banner').innerHTML =
      `🤝 ${alliance.name} &nbsp; <small style="opacity:.7;font-size:14px">${(alliance.members||[]).length} members</small>`;

    const membersList = document.getElementById('alliance-members-list');
    membersList.innerHTML = '';
    (alliance.members || []).slice(0, 10).forEach(m => {
      const div = document.createElement('div');
      div.className = 'member-item';
      div.innerHTML = `<span>👤</span><span>${m}</span>${m === alliance.owner ? ' <span style="color:var(--yellow);font-size:11px">👑 Owner</span>' : ''}`;
      membersList.appendChild(div);
    });
  }

  async function createAlliance() {
    const p = Auth.getPlayer();
    if (p.alliance_id) { UI.toast('Leave your current alliance first.'); return; }
    const name = await UI.modal('Create Alliance', 'Choose an alliance name:', { input: true, placeholder: 'Alliance name…', confirmText: 'Create' });
    if (!name || name.length < 3) return;
    const alliance = await dbCreateAlliance(name, p.username);
    if (!alliance) { UI.toast('Failed — name might be taken.', '#ff5b5b'); return; }
    await dbUpdateProfile(p.username, { alliance_id: alliance.id });
    Auth.updatePlayer({ alliance_id: alliance.id });
    UI.toast(`Alliance "${name}" created! 🤝`, '#3dff8f');
    refreshAlliance();
  }

  async function searchAlliances(query) {
    const results = await dbSearchAlliances(query);
    const container = document.getElementById('alliance-results');
    container.innerHTML = '';
    if (!results.length) { container.innerHTML = '<p style="color:var(--text2)">No alliances found.</p>'; return; }
    results.forEach(a => {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `
        <span style="flex:1"><b>${a.name}</b> — ${(a.members||[]).length} members</span>
        <button class="btn small primary" data-id="${a.id}">Join</button>
      `;
      div.querySelector('button').addEventListener('click', () => joinAlliance(a.id));
      container.appendChild(div);
    });
  }

  async function joinAlliance(id) {
    const p = Auth.getPlayer();
    if (p.alliance_id) {
      const confirmed = await UI.modal('Switch Alliance?', 'You will leave your current alliance.', { confirmText: 'Switch' });
      if (!confirmed) return;
      await dbLeaveAlliance(p.alliance_id, p.username);
    }
    const ok = await dbJoinAlliance(id, p.username);
    if (!ok) { UI.toast('Failed to join.', '#ff5b5b'); return; }
    Auth.updatePlayer({ alliance_id: id });
    UI.toast('Joined the alliance! 🤝', '#3dff8f');
    document.getElementById('alliance-search-panel').classList.add('hidden');
    refreshAlliance();
  }

  async function leaveAlliance() {
    const p = Auth.getPlayer();
    if (!p.alliance_id) return;
    const confirmed = await UI.modal('Leave Alliance?', 'Are you sure?', { confirmText: 'Leave', cancelText: 'Stay' });
    if (!confirmed) return;
    await dbLeaveAlliance(p.alliance_id, p.username);
    Auth.updatePlayer({ alliance_id: null });
    UI.toast('Left the alliance.');
    refreshAlliance();
  }

  // ── Init event listeners ──────────────────────────────────
  function init() {
    // Party
    document.getElementById('btn-create-party').addEventListener('click', createParty);
    document.getElementById('btn-leave-party').addEventListener('click', leaveParty);
    document.getElementById('btn-invite-party').addEventListener('click', () => {
      document.getElementById('party-invite-panel').classList.toggle('hidden');
    });
    document.getElementById('btn-send-invite').addEventListener('click', () => {
      const name = document.getElementById('party-invite-name').value.trim();
      if (name) inviteToParty(name);
    });

    // Alliance
    document.getElementById('btn-create-alliance').addEventListener('click', createAlliance);
    document.getElementById('btn-leave-alliance').addEventListener('click', leaveAlliance);
    document.getElementById('btn-search-alliance').addEventListener('click', () => {
      document.getElementById('alliance-search-panel').classList.toggle('hidden');
    });
    document.getElementById('btn-alliance-search-go').addEventListener('click', () => {
      const q = document.getElementById('alliance-search-input').value.trim();
      if (q) searchAlliances(q);
    });

    // Poll invites every 10s
    setInterval(pollInvites, 10000);
  }

  return { init, loadLeaderboard, refreshParty, refreshAlliance, pollInvites };
})();
