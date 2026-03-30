// ═══════════════════════════════════════════════════════════
//  supabase-client.js  — Supabase connection + DB helpers
// ═══════════════════════════════════════════════════════════

// Initialize Supabase (uses config.js values)
const { createClient } = supabase;
const DB = createClient(CONFIG.mdxeyyokenincbbbraux.supabase.co, CONFIG.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1keGV5eW9rZW5pbmNiYmJyYXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDUzMTMsImV4cCI6MjA5MDQ4MTMxM30.wnd3jFZDPcW89whedcEeTFAw7dMqrxfIJKBI8wh9lfo);

// ── Helper: get a profile row ──────────────────────────────
async function dbGetProfile(username) {
  const { data, error } = await DB
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  if (error) return null;
  return data;
}

// ── Helper: create a new profile ──────────────────────────
async function dbCreateProfile(username, password) {
  const { data, error } = await DB
    .from('profiles')
    .insert([{
      username,
      password,           // NOTE: hashing recommended for production!
      xp: 0,
      coins: CONFIG.COINS_START,
      wins: 0,
      losses: 0,
      kills: 0,
      color: CONFIG.PLAYER_COLORS[0].hex,
      owned_items: [],
      party_id: null,
      alliance_id: null,
    }])
    .select()
    .single();
  if (error) return { error };
  return { data };
}

// ── Helper: update profile fields ─────────────────────────
async function dbUpdateProfile(username, fields) {
  const { error } = await DB
    .from('profiles')
    .update(fields)
    .eq('username', username);
  return !error;
}

// ── Helper: get leaderboard ───────────────────────────────
async function dbGetLeaderboard(limit = 20) {
  const { data } = await DB
    .from('profiles')
    .select('username, xp, wins, color')
    .order('xp', { ascending: false })
    .limit(limit);
  return data || [];
}

// ── Alliances ─────────────────────────────────────────────
async function dbGetAlliance(id) {
  const { data } = await DB.from('alliances').select('*').eq('id', id).single();
  return data;
}

async function dbCreateAlliance(name, ownerUsername) {
  const { data, error } = await DB
    .from('alliances')
    .insert([{ name, owner: ownerUsername, members: [ownerUsername] }])
    .select()
    .single();
  if (error) return null;
  return data;
}

async function dbSearchAlliances(query) {
  const { data } = await DB
    .from('alliances')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(10);
  return data || [];
}

async function dbJoinAlliance(allianceId, username) {
  // fetch current members
  const { data } = await DB.from('alliances').select('members').eq('id', allianceId).single();
  if (!data) return false;
  const members = data.members || [];
  if (!members.includes(username)) members.push(username);
  await DB.from('alliances').update({ members }).eq('id', allianceId);
  await dbUpdateProfile(username, { alliance_id: allianceId });
  return true;
}

async function dbLeaveAlliance(allianceId, username) {
  const { data } = await DB.from('alliances').select('members').eq('id', allianceId).single();
  if (!data) return;
  const members = (data.members || []).filter(m => m !== username);
  await DB.from('alliances').update({ members }).eq('id', allianceId);
  await dbUpdateProfile(username, { alliance_id: null });
}

// ── Parties (stored in-memory via PeerJS; only metadata in DB) ──
// Party doc: { id, host, members:[], mode }
async function dbCreateParty(hostUsername, mode) {
  const partyId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { data, error } = await DB
    .from('parties')
    .insert([{ id: partyId, host: hostUsername, members: [hostUsername], mode }])
    .select()
    .single();
  if (error) return null;
  await dbUpdateProfile(hostUsername, { party_id: partyId });
  return data;
}

async function dbGetParty(id) {
  const { data } = await DB.from('parties').select('*').eq('id', id).single();
  return data;
}

async function dbUpdateParty(id, fields) {
  await DB.from('parties').update(fields).eq('id', id);
}

async function dbLeaveParty(partyId, username) {
  const party = await dbGetParty(partyId);
  if (!party) return;
  const members = (party.members || []).filter(m => m !== username);
  if (members.length === 0) {
    await DB.from('parties').delete().eq('id', partyId);
  } else {
    const newHost = party.host === username ? members[0] : party.host;
    await DB.from('parties').update({ members, host: newHost }).eq('id', partyId);
  }
  await dbUpdateProfile(username, { party_id: null });
}
