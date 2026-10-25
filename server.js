/*
  Étincelle — serveur de rencontres asexuelles & peu sexuelles
  Node.js pur (>= 22.5), AUCUNE dépendance. Base : SQLite (node:sqlite).
  Lancer : node server.js
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;   // monter ce dossier comme disque persistant
const DB_FILE = path.join(DATA_DIR, 'etincelle.db');
const PUBLIC = path.join(__dirname, 'public');
const UPLOADS = path.join(PUBLIC, 'uploads');

/* ---------------- Base de données SQLite ---------------- */
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL;');
db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, name TEXT UNIQUE, pass TEXT, salt TEXT,
  emoji TEXT, age INTEGER, location TEXT, job TEXT, bio TEXT,
  tags TEXT, spectrum TEXT, lookingFor TEXT, icebreakers TEXT,
  photos TEXT, photoSeq INTEGER DEFAULT 0,
  lat REAL, lon REAL,
  admin INTEGER DEFAULT 0, banned INTEGER DEFAULT 0,
  created INTEGER
);
CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, a TEXT, b TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, matchId TEXT, sender TEXT, text TEXT, time TEXT);
CREATE TABLE IF NOT EXISTS likes(src TEXT, tgt TEXT, time INTEGER, PRIMARY KEY(src,tgt));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, userId TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, by TEXT, against TEXT, reason TEXT, details TEXT, time INTEGER,
  status TEXT DEFAULT 'open', action TEXT);
CREATE TABLE IF NOT EXISTS blocks(src TEXT, tgt TEXT, time INTEGER, PRIMARY KEY(src,tgt));
`);

/* ------- Migration depuis l'ancien data.json (si présent) ------- */
const OLD = path.join(DATA_DIR, 'data.json');
if (fs.existsSync(OLD)) {
  try {
    const old = JSON.parse(fs.readFileSync(OLD, 'utf8'));
    const iu = db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    for (const u of (old.users || [])) {
      iu.run(u.id, u.name, u.pass, u.salt, u.emoji, u.age, u.location, u.job, u.bio,
        JSON.stringify(u.tags || []), u.spectrum || '', JSON.stringify(u.lookingFor || []),
        JSON.stringify(u.icebreakers || []), JSON.stringify(u.photos || (u.photo ? [u.photo] : [])),
        u.photoSeq || 0, u.lat ?? null, u.lon ?? null, u.admin ? 1 : 0, u.banned ? 1 : 0, u.created || Date.now());
    }
    const im = db.prepare('INSERT OR IGNORE INTO matches VALUES (?,?,?,?)');
    const imsg = db.prepare('INSERT INTO messages(matchId,sender,text,time) VALUES (?,?,?,?)');
    for (const m of (old.matches || [])) {
      im.run(m.id, m.users[0], m.users[1], m.created || Date.now());
      for (const msg of (m.messages || [])) imsg.run(m.id, msg.from, msg.text, msg.time);
    }
    const il = db.prepare('INSERT OR IGNORE INTO likes VALUES (?,?,?)');
    for (const [k, t] of Object.entries(old.likes || {})) {
      const [src, tgt] = k.split('->'); il.run(src, tgt, t || Date.now());
    }
    const is = db.prepare('INSERT OR IGNORE INTO sessions VALUES (?,?,?)');
    for (const [token, userId] of Object.entries(old.sessions || {})) is.run(token, userId, Date.now());
    fs.renameSync(OLD, OLD + '.imported');
    console.log('→ Migration data.json → SQLite terminée (' + (old.users || []).length + ' comptes)');
  } catch (e) { console.error('Migration impossible :', e.message); }
}

/* ------- Seed initial ------- */
function hashPass(pass, salt) { return crypto.scryptSync(pass, salt, 64).toString('hex'); }
function ensureModo() {
  if (db.prepare('SELECT COUNT(*) c FROM users WHERE admin = 1').get().c > 0) return;
  const salt = crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
    crypto.randomBytes(6).toString('hex'), 'Modo', hashPass('modo1234', salt), salt,
    '🛡️', 99, 'Belgique', 'Équipe modération', 'Compte de modération — ne pas swiper 😄',
    '[]', 'modérateur·rice', '[]', '[]', '[]', 0, null, null, 1, 0, Date.now());
  console.log('→ Compte de modération créé : Modo / modo1234 (change ce mot de passe !)');
}
if (db.prepare('SELECT COUNT(*) c FROM users').get().c === 0) {
  const mk = (name, emoji, age, location, job, bio, tags, spectrum, lookingFor, icebreakers, admin = 0) => {
    const salt = crypto.randomBytes(8).toString('hex');
    db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      crypto.randomBytes(6).toString('hex'), name, hashPass(admin ? 'modo1234' : 'demo1234', salt), salt,
      emoji, age, location, job, bio, JSON.stringify(tags), spectrum, JSON.stringify(lookingFor),
      JSON.stringify(icebreakers), '[]', 0, null, null, admin, 0, Date.now());
  };
  mk('Léa', '👩‍🦰', 26, 'Bruxelles', 'Graphiste 🎨', 'Amoureuse des brocantes, des thés de soirée et des longues discussions qui durent jusqu\u2019à 2h du matin. Connexion émotionnelle avant tout.', ['🎨 Art', '☕ Café', '📚 BD'], 'asexuel·le', ['relation romantique sans sexe', 'amitiés'], ['Ton objet de brocante le plus bizarre trouvé jusqu\u2019ici ? 😄', 'Salut ! Thé ou chocolat chaud pour une discussion qui dure ? ☕', 'Salut Léa ! Dessin sur commande possible ? 🎨']);
  mk('Thomas', '🧑‍💻', 31, 'Louvain-la-Neuve', 'Développeur 💻', 'Asexuel et romantique. Fan de randos, de jeux de société et de pâtes maison. Je cherche une connexion profonde, sans pression.', ['🥾 Rando', '🎲 Jeux de société', '🍝 Cuisine'], 'asexuel·le', ['relation romantique sans sexe', 'amitiés'], ['Salut Thomas ! Jeu de société préféré entre tous ? 🎲', 'Salut ! Rando du dimanche, tu connais un beau coin ? 🥾', 'Un dev qui cuisine ? Prouve-le 😄']);
  mk('Sofia', '👩‍🎨', 24, 'Bruxelles', 'Photographe 📸', 'Sur le spectre ace, je collectionne les couchers de soleil et les discussions sincères. Les câlins platoniques, oui ; le reste, non merci.', ['📷 Photo', '🐱 Chats', '🎶 Vinyles'], 'gris-A', ['relation queerplatonique', 'amitiés'], ['Salut Sofia ! Ton plus beau coucher de soleil photographié ? 📷', '« Hôtel California » en boucle, respect 😄', 'Salut ! Chats errants ou chats de salon ? 🐱']);
  mk('Maxime', '🧔', 29, 'Namur', 'Infirmier 🏥', 'Démisexuel : j\u2019ai besoin de vraie connexion avant tout le reste. Nuits de garde, journées sport et blagues nulles garanties.', ['🏋️ Sport', '🎬 Films', '🐕 Chien'], 'démisexuel·le', ['amitiés', 'relation romantique sans sexe'], ['Salut Maxime ! Ta blague la plus nulle, tu la donnes gratis ? 😂', 'Salut ! Chien ou chat, le grand débat ? 🐕', 'Rien ne t\u2019effraie au boulot ? Raconte 😮']);
  mk('Camille', '👩‍🏫', 27, 'Gand', 'Prof de yoga 🧘', 'Ace-flux et très tactile-platonique : gros fan de câlins amicaux, de thés et de concerts metal. Le paradoxe est mon sport favori.', ['🧘 Yoga', '🤘 Metal', '🍵 Thé'], 'ace-flux', ['amitiés', 'relation queerplatonique'], ['Yoga + metal, le duo le plus paradoxal que je connaisse 😄', 'Salut Camille ! Cours pour débutants raides comme des piquets ? 🧘', 'Salut ! Thé ou concert ce week-end ? 🍵🤘']);
  mk('Nadia', '👩‍⚕️', 30, 'Anvers', 'Vétérinaire 🐾', 'Asexuelle aromantique — je cherche juste des gens chouettes pour des balades, des escape games et des sessions câlins-aux-chats.', ['🐾 Animaux', '🧩 Escape games', '🏔️ Montagne'], 'asexuel·le aromantique', ['amitiés'], ['Salut Nadia ! Escape game : ton record ? 🧩', '12 kg de câlins aux chats gratuits, je postule 🐱', 'Salut ! Ton patient le plus exotique ? 🐾']);
  mk('Karim', '👨‍🍳', 32, 'Liège', 'Chef cuisinier 👨‍🍳', 'Asexuel. Je nourris tout le monde sauf que ma propre vie affective a besoin d\u2019un coup de frais. Discussions autour d\u2019un tajine bienvenues.', ['🍳 Cuisine', '⚽ Foot', '🌊 Plage'], 'asexuel·le', ['relation romantique sans sexe', 'amitiés'], ['Salut Karim ! Le tajine de ta grand-mère, tu livres ? 😄', 'Salut ! Un dîner qui raconte ton enfance ? 🍲', 'Chef + foot : équipe favorite ? ⚽']);
  mk('Julie', '👩‍🚀', 25, 'Bruxelles', 'Ingénieure 🚀', 'Questioning / sur le spectre ace. Rêve de Mars, explore les bars à cocktails sans alcool et les escape games. Ouverte à toute belle rencontre platonique ou romantique.', ['🚀 Espace', '🍹 Cocktails sans alcool', '🧩 Escape games'], 'questioning', ['amitiés', 'relation queerplatonique', 'relation romantique sans sexe'], ['Salut Julie ! Mars ou escape game ce week-end ? 🚀', 'Ton meilleur cocktail sans alcool ? 🍹', 'Salut ! L\u2019espace, c\u2019est le plus beau plan de l\u2019univers, non ? ✨']);
  mk('Modo', '🛡️', 99, 'Belgique', 'Équipe modération', 'Compte de modération — ne pas swiper 😄', [], 'modérateur·rice', [], [], 1);
  console.log('→ Base créée : 8 profils de démo (demo1234) + 1 compte modération (Modo / modo1234)');
}
ensureModo();

/* ---------------- Coordonnées de villes (fallback sans GPS) ---------------- */
const CITY_COORDS = [
  ['bruxelles', 'brussel', 'bruss', 'bxl', 50.8503, 4.3517],
  ['louvain', 'leuven', 50.6680, 4.6110],
  ['gand', 'gent', 51.0543, 3.7174],
  ['namur', 50.4674, 4.8718],
  ['anvers', 'antwerp', 'antwerpen', 51.2194, 4.4025],
  ['liège', 'liege', 50.6326, 5.5797],
  ['charleroi', 50.4108, 4.4446],
  ['bruges', 'brugge', 51.2093, 3.2247],
  ['mons', 50.4542, 3.9563],
  ['paris', 48.8566, 2.3522], ['lille', 50.6292, 3.0573], ['lyon', 45.7640, 4.8357],
  ['montréal', 45.5019, -73.5674]
];
function geocode(location) {
  if (!location) return null;
  const c = String(location).toLowerCase();
  for (const row of CITY_COORDS) {
    if (row.slice(0, row.length - 2).some(n => c.includes(n))) return { lat: row[row.length - 2], lon: row[row.length - 1] };
  }
  return null;
}

/* ---------------- Helpers ---------------- */
function rowToUser(r) {
  return {
    id: r.id, name: r.name, pass: r.pass, salt: r.salt, emoji: r.emoji, age: r.age,
    location: r.location, job: r.job, bio: r.bio,
    tags: JSON.parse(r.tags || '[]'), spectrum: r.spectrum,
    lookingFor: JSON.parse(r.lookingFor || '[]'), icebreakers: JSON.parse(r.icebreakers || '[]'),
    photos: JSON.parse(r.photos || '[]'), photoSeq: r.photoSeq || 0,
    lat: r.lat, lon: r.lon, admin: !!r.admin, banned: !!r.banned, created: r.created
  };
}
function getUser(id) {
  const r = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return r ? rowToUser(r) : null;
}
function userByName(name) {
  const r = db.prepare('SELECT * FROM users WHERE name = ? COLLATE NOCASE').get(String(name || ''));
  return r ? rowToUser(r) : null;
}
function publicUser(u) {
  return { id: u.id, name: u.name, emoji: u.emoji, age: u.age, location: u.location,
    job: u.job, bio: u.bio, tags: u.tags, spectrum: u.spectrum, lookingFor: u.lookingFor,
    icebreakers: u.icebreakers, photos: u.photos, lat: u.lat, lon: u.lon, admin: u.admin };
}
function matchesOf(userId) {
  return db.prepare('SELECT * FROM matches WHERE a = ? OR b = ? ORDER BY created DESC').all(userId, userId)
    .map(m => ({ id: m.id, users: [m.a, m.b], created: m.created }));
}
function matchView(m, userId) {
  const otherId = m.users.find(id => id !== userId);
  const other = getUser(otherId);
  const messages = db.prepare('SELECT sender, text, time FROM messages WHERE matchId = ? ORDER BY id').all(m.id)
    .map(msg => ({ from: msg.sender, text: msg.text, time: msg.time }));
  return { id: m.id, other: other ? publicUser(other) : null, messages };
}
function blockedBetween(a, b) {
  return db.prepare('SELECT 1 FROM blocks WHERE (src=? AND tgt=?) OR (src=? AND tgt=?)').get(a, b, b, a);
}
function readBody(req) {
  return new Promise(resolve => {
    let b = ''; req.on('data', c => { if (b.length < 9e6) b += c; });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}
function auth(req, url) {
  const token = (req.headers.authorization || '').replace('Bearer ', '') || url.searchParams.get('token');
  if (!token) return null;
  const s = db.prepare('SELECT userId FROM sessions WHERE token = ?').get(token);
  return s ? s.userId : null;
}

/* ---------------- SSE (temps réel) ---------------- */
const sseClients = new Map();
function sseSend(userId, event, data) {
  const set = sseClients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) { try { res.write(payload); } catch {} }
}
function sseSendAdmins(event, data) {
  for (const admin of db.prepare('SELECT id FROM users WHERE admin = 1').all()) sseSend(admin.id, event, data);
}

/* ---------------- API ---------------- */
async function api(req, res, url) {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(obj));
  };
  const p = url.pathname;
  const body = ['POST'].includes(req.method) ? await readBody(req) : {};
  const uid = auth(req, url);
  const me = uid ? getUser(uid) : null;

  /* --- Comptes --- */
  if (p === '/api/register' && req.method === 'POST') {
    const { name, password, profile } = body;
    if (!name || name.trim().length < 2) return send(400, { error: 'Pseudo trop court (2 caractères min)' });
    if (!password || password.length < 6) return send(400, { error: 'Mot de passe : 6 caractères minimum' });
    if (userByName(name.trim())) return send(400, { error: 'Ce pseudo est déjà pris' });
    const salt = crypto.randomBytes(8).toString('hex');
    const pf = profile || {};
    const id = crypto.randomBytes(6).toString('hex');
    db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      id, name.trim(), hashPass(password, salt), salt,
      pf.emoji || '😊', pf.age || 25, pf.location || 'Belgique', pf.job || '', pf.bio || '',
      JSON.stringify(pf.tags || []), pf.spectrum || 'asexuel·le', JSON.stringify(pf.lookingFor || ['amitiés']),
      JSON.stringify(pf.icebreakers || []), '[]', 0, pf.lat ?? null, pf.lon ?? null, 0, 0, Date.now());
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, id, Date.now());
    sseSendAdmins('profiles', {});
    for (const cid of sseClients.keys()) if (cid !== id) sseSend(cid, 'profiles', {});
    return send(200, { token, user: publicUser(getUser(id)) });
  }

  if (p === '/api/login' && req.method === 'POST') {
    const user = userByName(body.name);
    if (!user || user.pass !== hashPass(String(body.password || ''), user.salt))
      return send(401, { error: 'Pseudo ou mot de passe incorrect' });
    if (user.banned) return send(403, { error: '🚫 Ce compte a été suspendu par la modération.' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, user.id, Date.now());
    return send(200, { token, user: publicUser(user) });
  }

  if (!me) return send(401, { error: 'Non connecté' });

  if (p === '/api/me' && req.method === 'GET') {
    const blocked = db.prepare('SELECT tgt FROM blocks WHERE src = ?').all(me.id).map(r => r.tgt);
    return send(200, { user: publicUser(me), blocked });
  }

  if (p === '/api/profile' && req.method === 'POST') {
    const allowed = ['emoji', 'age', 'location', 'job', 'bio', 'tags', 'spectrum', 'lookingFor', 'icebreakers', 'lat', 'lon'];
    for (const k of allowed) if (body[k] !== undefined) me[k] = body[k];
    const g = geocode(me.location);
    if (g && body.location) { me.lat = g.lat; me.lon = g.lon; }
    db.prepare(`UPDATE users SET emoji=?, age=?, location=?, job=?, bio=?, tags=?, spectrum=?, lookingFor=?, icebreakers=?, lat=?, lon=? WHERE id=?`)
      .run(me.emoji, me.age, me.location, me.job, me.bio, JSON.stringify(me.tags), me.spectrum,
        JSON.stringify(me.lookingFor), JSON.stringify(me.icebreakers), me.lat, me.lon, me.id);
    for (const cid of sseClients.keys()) if (cid !== me.id) sseSend(cid, 'profiles', {});
    return send(200, { user: publicUser(me) });
  }

  /* --- Changement de mot de passe --- */
  if (p === '/api/password' && req.method === 'POST') {
    const { current, next } = body;
    if (me.pass !== hashPass(String(current || ''), me.salt))
      return send(401, { error: 'Mot de passe actuel incorrect' });
    if (!next || String(next).length < 6)
      return send(400, { error: 'Nouveau mot de passe : 6 caractères minimum' });
    const salt = crypto.randomBytes(8).toString('hex');
    db.prepare('UPDATE users SET pass = ?, salt = ? WHERE id = ?').run(hashPass(String(next), salt), salt, me.id);
    return send(200, { ok: true });
  }

  /* --- Photos (galerie, 6 max) --- */
  function photoBroadcast() {
    for (const cid of sseClients.keys()) if (cid !== me.id) sseSend(cid, 'profiles', {});
  }
  if (p === '/api/photo' && req.method === 'POST') {
    const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(String(body.data || ''));
    if (!m) return send(400, { error: 'Format invalide (jpg, png ou webp attendu)' });
    if (me.photos.length >= 6) return send(400, { error: '6 photos maximum' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 4 * 1024 * 1024) return send(400, { error: 'Image trop lourde (4 Mo max)' });
    fs.mkdirSync(UPLOADS, { recursive: true });
    me.photoSeq += 1;
    const fname = `${me.id}_${me.photoSeq}.jpg`;
    fs.writeFileSync(path.join(UPLOADS, fname), buf);
    me.photos.push('/uploads/' + fname);
    db.prepare('UPDATE users SET photos=?, photoSeq=? WHERE id=?').run(JSON.stringify(me.photos), me.photoSeq, me.id);
    photoBroadcast();
    return send(200, { user: publicUser(me) });
  }
  if (p === '/api/photoDelete' && req.method === 'POST') {
    const i = parseInt(body.index);
    if (!me.photos[i]) return send(400, { error: 'Photo introuvable' });
    try { fs.unlinkSync(path.join(UPLOADS, path.basename(me.photos[i]))); } catch {}
    me.photos.splice(i, 1);
    db.prepare('UPDATE users SET photos=? WHERE id=?').run(JSON.stringify(me.photos), me.id);
    photoBroadcast();
    return send(200, { user: publicUser(me) });
  }
  if (p === '/api/photoMain' && req.method === 'POST') {
    const i = parseInt(body.index);
    if (!me.photos[i]) return send(400, { error: 'Photo introuvable' });
    const [ph] = me.photos.splice(i, 1);
    me.photos.unshift(ph);
    db.prepare('UPDATE users SET photos=? WHERE id=?').run(JSON.stringify(me.photos), me.id);
    photoBroadcast();
    return send(200, { user: publicUser(me) });
  }

  /* --- Découverte --- */
  if (p === '/api/profiles' && req.method === 'GET') {
    const liked = new Set(db.prepare('SELECT tgt FROM likes WHERE src = ?').all(me.id).map(r => r.tgt));
    const matched = new Set(matchesOf(me.id).flatMap(m => m.users));
    const iBlocked = new Set(db.prepare('SELECT tgt FROM blocks WHERE src = ?').all(me.id).map(r => r.tgt));
    const blockedMe = new Set(db.prepare('SELECT src FROM blocks WHERE tgt = ?').all(me.id).map(r => r.src));
    const list = db.prepare('SELECT * FROM users WHERE banned = 0 AND admin = 0').all().map(rowToUser)
      .filter(u => u.id !== me.id && !liked.has(u.id) && !matched.has(u.id) && !iBlocked.has(u.id) && !blockedMe.has(u.id))
      .map(publicUser);
    return send(200, { profiles: list });
  }

  if (p === '/api/swipe' && req.method === 'POST') {
    const { targetId, liked } = body;
    const target = getUser(targetId);
    if (!target || target.admin) return send(400, { error: 'Profil introuvable' });
    if (blockedBetween(me.id, targetId)) return send(403, { error: 'Action impossible' });
    if (liked) {
      db.prepare('INSERT OR REPLACE INTO likes VALUES (?,?,?)').run(me.id, targetId, Date.now());
      const recip = db.prepare('SELECT 1 FROM likes WHERE src = ? AND tgt = ?').get(targetId, me.id);
      const existing = matchesOf(me.id).find(m => m.users.includes(targetId));
      if (recip && !existing) {
        const match = { id: crypto.randomBytes(6).toString('hex'), users: [me.id, targetId], created: Date.now() };
        db.prepare('INSERT INTO matches VALUES (?,?,?,?)').run(match.id, me.id, targetId, match.created);
        sseSend(me.id, 'match', { match: matchView(match, me.id), user: publicUser(target) });
        sseSend(targetId, 'match', { match: matchView(match, targetId), user: publicUser(me) });
        return send(200, { matched: true, matchId: match.id });
      }
      return send(200, { matched: false });
    }
    return send(200, { matched: false });
  }

  /* --- Matchs & messages --- */
  if (p === '/api/matches' && req.method === 'GET') {
    return send(200, { matches: matchesOf(me.id).map(m => matchView(m, me.id)) });
  }

  if (p === '/api/send' && req.method === 'POST') {
    const { matchId, text } = body;
    const match = db.prepare('SELECT * FROM matches WHERE id = ? AND (a = ? OR b = ?)').get(matchId, me.id, me.id);
    if (!match) return send(400, { error: 'Match introuvable' });
    const otherId = match.a === me.id ? match.b : match.a;
    if (blockedBetween(me.id, otherId)) return send(403, { error: 'Conversation bloquée' });
    if (!text || !String(text).trim()) return send(400, { error: 'Message vide' });
    const msg = { from: me.id, text: String(text).trim().slice(0, 2000), time: new Date().toISOString() };
    db.prepare('INSERT INTO messages(matchId,sender,text,time) VALUES (?,?,?,?)').run(matchId, me.id, msg.text, msg.time);
    for (const u of [me.id, otherId]) sseSend(u, 'message', { matchId, message: msg });
    return send(200, { ok: true });
  }

  /* --- Signalement & blocage --- */
  if (p === '/api/report' && req.method === 'POST') {
    const target = getUser(body.targetId);
    if (!target) return send(400, { error: 'Profil introuvable' });
    const report = {
      id: crypto.randomBytes(6).toString('hex'), by: me.id, against: target.id,
      reason: String(body.reason || 'Autre').slice(0, 80),
      details: String(body.details || '').slice(0, 1000),
      time: Date.now(), status: 'open', action: null
    };
    db.prepare('INSERT INTO reports VALUES (?,?,?,?,?,?,?,?)').run(
      report.id, report.by, report.against, report.reason, report.details, report.time, 'open', null);
    sseSendAdmins('report', { report: { ...report, byName: me.name, againstName: target.name } });
    return send(200, { ok: true });
  }

  if (p === '/api/block' && req.method === 'POST') {
    const target = getUser(body.targetId);
    if (!target) return send(400, { error: 'Profil introuvable' });
    db.prepare('INSERT OR REPLACE INTO blocks VALUES (?,?,?)').run(me.id, target.id, Date.now());
    // supprime matchs + likes réciproques avec cette personne
    for (const m of matchesOf(me.id).filter(m => m.users.includes(target.id))) {
      db.prepare('DELETE FROM messages WHERE matchId = ?').run(m.id);
      db.prepare('DELETE FROM matches WHERE id = ?').run(m.id);
    }
    db.prepare('DELETE FROM likes WHERE (src=? AND tgt=?) OR (src=? AND tgt=?)').run(me.id, target.id, target.id, me.id);
    return send(200, { ok: true });
  }
  if (p === '/api/unblock' && req.method === 'POST') {
    db.prepare('DELETE FROM blocks WHERE src = ? AND tgt = ?').run(me.id, body.targetId);
    return send(200, { ok: true });
  }
  if (p === '/api/blocked' && req.method === 'GET') {
    const list = db.prepare('SELECT tgt FROM blocks WHERE src = ?').all(me.id)
      .map(r => getUser(r.tgt)).filter(Boolean).map(publicUser);
    return send(200, { blocked: list });
  }

  /* --- Modération (admin) --- */
  if (p.startsWith('/api/admin')) {
    if (!me.admin) return send(403, { error: 'Réservé à la modération' });
    if (p === '/api/admin/reports' && req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM reports ORDER BY time DESC').all();
      const reports = rows.map(r => {
        const by = getUser(r.by), against = getUser(r.against);
        return { ...r, byName: by ? by.name : '?', againstName: against ? against.name : '?',
          againstUser: against ? publicUser(against) : null };
      });
      return send(200, { reports });
    }
    if (p === '/api/admin/action' && req.method === 'POST') {
      const rep = db.prepare('SELECT * FROM reports WHERE id = ?').get(body.reportId);
      if (!rep) return send(400, { error: 'Signalement introuvable' });
      const action = body.action;
      if (action === 'ban') {
        db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(rep.against);
        db.prepare('UPDATE reports SET status = ?, action = ? WHERE id = ?').run('resolved', 'ban', rep.id);
      } else if (action === 'clearPhotos') {
        const target = getUser(rep.against);
        if (target) {
          for (const ph of target.photos) { try { fs.unlinkSync(path.join(UPLOADS, path.basename(ph))); } catch {} }
          db.prepare('UPDATE users SET photos = ? WHERE id = ?').run('[]', rep.against);
        }
        db.prepare('UPDATE reports SET status = ?, action = ? WHERE id = ?').run('resolved', 'clearPhotos', rep.id);
      } else {
        db.prepare('UPDATE reports SET status = ?, action = ? WHERE id = ?').run('resolved', 'dismiss', rep.id);
      }
      return send(200, { ok: true });
    }
    if (p === '/api/admin/users' && req.method === 'GET') {
      const users = db.prepare('SELECT * FROM users ORDER BY created DESC').all().map(rowToUser)
        .map(u => ({ ...publicUser(u), banned: u.banned, admin: u.admin }));
      return send(200, { users });
    }
    if (p === '/api/admin/ban' && req.method === 'POST') {
      const target = getUser(body.userId);
      if (!target || target.admin) return send(400, { error: 'Cible invalide' });
      db.prepare('UPDATE users SET banned = ? WHERE id = ?').run(body.banned ? 1 : 0, body.userId);
      if (body.banned) {
        // déconnecte toutes les sessions du banni
        db.prepare('DELETE FROM sessions WHERE userId = ?').run(body.userId);
      }
      return send(200, { ok: true });
    }
  }

  return send(404, { error: 'Route inconnue' });
}

/* ---------------- Serveur HTTP ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/events') {
      const uid = auth(req, url);
      if (!uid) { res.writeHead(401); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(':ok\n\n');
      if (!sseClients.has(uid)) sseClients.set(uid, new Set());
      sseClients.get(uid).add(res);
      const ping = setInterval(() => { try { res.write(':ping\n\n'); } catch { clearInterval(ping); } }, 25000);
      req.on('close', () => { clearInterval(ping); sseClients.get(uid)?.delete(res); });
      return;
    }
    try { return await api(req, res, url); }
    catch (e) {
      console.error(e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Erreur serveur' }));
    }
  }

  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const full = path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[\/\\])+/, ''));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  💜 Étincelle — rencontres asexuelles & peu sexuelles');
  console.log(`  → http://localhost:${PORT}`);
  console.log('  Démo : Léa, Thomas… (demo1234) · Modération : Modo (modo1234)');
  console.log('  Données persistantes : ' + DB_FILE);
  console.log('');
});
