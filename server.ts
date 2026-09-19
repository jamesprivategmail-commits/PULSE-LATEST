import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  writeBatch,
  readDocument,
  writeDocument,
  listDocuments
} from './serverDb';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// LiveKit Server Credentials
const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

app.use(cookieParser());
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));

// Ensure uploads directory exists and is statically served
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// -------------------------------------------------------------
// TELEGRAM BOT CONFIGURATION & CONTROLLER
// -------------------------------------------------------------
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_HANDLE = process.env.TELEGRAM_ADMIN_HANDLE || '@nova_tech_1';
// Numeric Telegram chat/user id of the platform owner. This is what actually
// gates admin commands — Telegram usernames are optional and can be unset,
// so we also accept a username match as a fallback when this isn't configured.
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
let lastAdminChatId: number | string | null = null;
let botPollingActive = true;
let lastUpdateId = 0;

// Every /command and every inline-button tap (verify, ban, give_coins,
// delete_user, ...) routed through this bot previously ran for *any*
// Telegram user who messaged it — there was no check that the sender was
// actually the platform owner. TELEGRAM_ADMIN_HANDLE was only ever used to
// print the admin's name in the help text, never to authorize anything.
// This is what let the "verified badge" (and every other admin power) be
// granted by someone other than an admin. isAuthorizedAdmin() is the fix:
// require the sender's numeric id to match TELEGRAM_ADMIN_CHAT_ID, falling
// back to a case-insensitive @handle match when no chat id is configured.
function isAuthorizedAdmin(chatId: number | string, fromUser: any): boolean {
  if (TELEGRAM_ADMIN_CHAT_ID) {
    return String(chatId) === String(TELEGRAM_ADMIN_CHAT_ID) || String(fromUser?.id) === String(TELEGRAM_ADMIN_CHAT_ID);
  }
  const senderHandle = fromUser?.username ? `@${fromUser.username}`.toLowerCase() : '';
  return !!senderHandle && senderHandle === TELEGRAM_ADMIN_HANDLE.toLowerCase();
}

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error('Error sending Telegram message:', err);
  }
}

async function notifyTelegramAdmin(text: string, replyMarkup?: any) {
  if (lastAdminChatId) {
    return sendTelegramMessage(lastAdminChatId, text, replyMarkup);
  }
  console.log('[Telegram Admin Notification]:', text);
}

// Helper to find a user by @handle, username, or UID
async function findUserByQuery(term: string) {
  const clean = term.trim().replace(/^@/, '').toLowerCase();
  if (!clean) return null;

  // Direct UID
  try {
    const directDoc = await getDoc(doc(db, 'users', term.trim()));
    if (directDoc.exists()) {
      return { uid: directDoc.id, ...directDoc.data() } as any;
    }
  } catch (e) {}

  // Query by handle or username
  try {
    const snap = await getDocs(collection(db, 'users'));
    let found: any = null;
    snap.forEach((d) => {
      const data = d.data();
      const h = (data.handle || '').replace(/^@/, '').toLowerCase();
      const u = (data.username || '').toLowerCase();
      if (h === clean || u === clean || d.id.toLowerCase() === clean) {
        found = { uid: d.id, ...data };
      }
    });
    return found;
  } catch (e) {
    console.error('Find user error:', e);
    return null;
  }
}

// Helper to extract clean video ID
function parseVideoId(input: string) {
  let clean = input.trim();
  const match = clean.match(/videos?\/([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) return match[1];
  if (clean.includes('/')) {
    return clean.split('/').pop()?.split('?')[0] || clean;
  }
  return clean;
}

// -------------------------------------------------------------
// PULSE BACKEND API (server-owned persistence and sessions)
// -------------------------------------------------------------
function publicUser(user: any) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}
function verificationUrl(token: string, requestOrigin?: string) {
  const base = process.env.PUBLIC_APP_URL || requestOrigin || `http://localhost:${PORT}`;
  return `${base}/?mode=verifyEmail&oobCode=${encodeURIComponent(token)}`;
}
async function deliverVerificationEmail(email: string, token: string, requestOrigin?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const url = verificationUrl(token, requestOrigin);
  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[Auth] Email delivery is not configured; local verification URL created for ${email}.`);
      return url;
    }
    throw Object.assign(new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM before enabling account verification.'), { statusCode: 503 });
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Verify your Pulse account',
      html: `<p>Welcome to Pulse.</p><p><a href="${url}">Verify your email address</a></p><p>This link expires in 24 hours.</p>`
    })
  });
  if (!response.ok) throw new Error(`Verification email could not be sent (${response.status}).`);
  return url;
}
function sessionUser(req: express.Request) {
  const sessionId = req.cookies?.pulse_session;
  if (!sessionId) return null;
  const session = readDocument(['sessions', sessionId]);
  if (!session || Number(session.expiresAt || 0) < Date.now()) return null;
  return readDocument(['users', session.uid]);
}
function issueSession(res: express.Response, uid: string) {
  const sessionId = crypto.randomUUID();
  writeDocument(['sessions', sessionId], { uid, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 });
  res.cookie('pulse_session', sessionId, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 1000 * 60 * 60 * 24 * 30 });
}
app.get('/api/auth/me', (req, res) => res.json({ user: publicUser(sessionUser(req)) }));
app.post('/api/auth/signup', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || password.length < 6) return res.status(400).json({ error: 'Email and a password of at least 6 characters are required.' });
    const existing = listDocuments(['users']).find((row: any) => String(row.data?.email || '').toLowerCase() === email);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
    const uid = crypto.randomUUID();
    const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 24) || `user_${uid.slice(0, 6)}`;
    const user = { uid, email, username, handle: `@${username}`, displayName: username, emailVerified: false, createdAt: Date.now(), passwordHash: await bcrypt.hash(password, 10), isAnonymous: false };
    writeDocument(['users', uid], user);
    issueSession(res, uid);
    res.json({ user: publicUser(user) });
  } catch (error: any) { res.status(500).json({ error: error.message || 'Unable to create account.' }); }
});
app.post('/api/auth/signin', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const row = listDocuments(['users']).find((item: any) => String(item.data?.email || '').toLowerCase() === email);
  if (!row || !row.data?.passwordHash || !(await bcrypt.compare(password, row.data.passwordHash))) return res.status(401).json({ error: 'Incorrect email or password.' });
  issueSession(res, row.id); res.json({ user: publicUser(row.data) });
});
app.post('/api/auth/anonymous', (req, res) => {
  const uid = `guest_${crypto.randomUUID()}`;
  const user = { uid, username: 'guest', handle: '@guest', displayName: 'Guest', createdAt: Date.now(), isAnonymous: true };
  writeDocument(['users', uid], user); issueSession(res, uid); res.json({ user });
});
app.post('/api/auth/demo', async (_req, res) => {
  try {
    const demoEmail = 'demo@pulse.test';
    const existing = listDocuments(['users']).find((row: any) => row.data?.email === demoEmail);
    let user = existing?.data;
    if (!user) {
      user = {
        uid: 'pulse_demo_account',
        email: demoEmail,
        username: 'pulse_demo',
        handle: '@pulse_demo',
        displayName: 'Pulse Demo',
        photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=pulse-demo',
        bio: 'Persistent Pulse demo account for testing real features.',
        followers: 0,
        following: 0,
        likesReceived: 0,
        emailVerified: true,
        verified: true,
        verificationStatus: 'verified',
        role: 'user',
        isDemo: true,
        isAnonymous: false,
        createdAt: Date.now(),
        passwordHash: await bcrypt.hash(crypto.randomUUID(), 10)
      };
      await writeDocument(['users', user.uid], user);
    }
    issueSession(res, user.uid);
    res.json({ user: publicUser(user) });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unable to start the demo session.' });
  }
});
app.post('/api/auth/verify/request', async (req, res) => {
  const user = sessionUser(req);
  if (!user?.email) return res.status(401).json({ error: 'Not signed in.' });
  const token = crypto.randomBytes(32).toString('hex');
  await writeDocument(['emailVerificationTokens', token], { uid: user.uid, expiresAt: Date.now() + 1000 * 60 * 60 * 24 });
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const url = await deliverVerificationEmail(user.email, token, origin);
    return res.json({ success: true, verificationUrl: url });
  } catch (error: any) {
    await writeDocument(['emailVerificationTokens', token], {}, 'delete');
    return res.status(error.statusCode || 500).json({ error: error.message || 'Unable to send verification email.' });
  }
});
app.post('/api/auth/verify', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const record = token ? readDocument(['emailVerificationTokens', token]) : null;
  if (!record || Number(record.expiresAt || 0) < Date.now()) return res.status(400).json({ error: 'This verification link is invalid or expired.' });
  const user = readDocument(['users', record.uid]);
  if (!user) return res.status(404).json({ error: 'Account not found.' });
  await writeDocument(['users', record.uid], { emailVerified: true }, 'update');
  await writeDocument(['emailVerificationTokens', token], {}, 'delete');
  issueSession(res, record.uid);
  res.json({ user: publicUser(readDocument(['users', record.uid])) });
});
app.post('/api/auth/signout', (req, res) => { const sessionId = req.cookies?.pulse_session; if (sessionId) writeDocument(['sessions', sessionId], {}, 'delete'); res.clearCookie('pulse_session'); res.json({ success: true }); });
app.patch('/api/auth/profile', (req, res) => {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  const allowed = ['displayName', 'username', 'handle', 'bio', 'photoURL', 'coverUrl', 'websiteLink', 'instagramLink', 'youtubeLink'];
  const updates = Object.fromEntries(allowed.filter((key) => Object.prototype.hasOwnProperty.call(req.body || {}, key)).map((key) => [key, req.body[key]]));
  if (updates.username !== undefined && !String(updates.username).trim()) return res.status(400).json({ error: 'Username cannot be empty.' });
  writeDocument(['users', user.uid], updates, 'update');
  res.json({ user: publicUser(readDocument(['users', user.uid])) });
});
app.post('/api/db/query', (req, res) => {
  const pathParts = Array.isArray(req.body?.path) ? req.body.path : [];
  const rows = listDocuments(pathParts, Array.isArray(req.body?.constraints) ? req.body.constraints : []);
  res.json({ docs: rows.map((row: any) => ({ id: row.id, exists: true, data: row.data })), size: rows.length, empty: rows.length === 0 });
});
app.post('/api/db/doc', async (req, res) => {
  const pathParts = Array.isArray(req.body?.path) ? req.body.path : [];
  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'data')) {
    const id = crypto.randomUUID();
    await writeDocument([...pathParts, id], req.body.data || {});
    return res.json({ id });
  }
  const data = readDocument(pathParts);
  res.json({ id: pathParts[pathParts.length - 1], exists: !!data, data: data || null });
});
app.put('/api/db/doc', async (req, res) => { const pathParts = Array.isArray(req.body?.path) ? req.body.path : []; await writeDocument(pathParts, req.body?.data || {}, req.body?.mode === 'update' ? 'update' : 'set'); res.json({ success: true }); });
app.delete('/api/db/doc', async (req, res) => { const pathParts = Array.isArray(req.body?.path) ? req.body.path : []; await writeDocument(pathParts, {}, 'delete'); res.json({ success: true }); });

// -------------------------------------------------------------
// TELEGRAM BOT COMMAND HANDLER
// -------------------------------------------------------------
async function handleTelegramCommand(chatId: number, text: string, fromUser: any) {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Reject every command from anyone who isn't the configured admin, before
  // any Firestore access. /start and /help still work for an unauthorized
  // sender (so the bot doesn't look broken/silent) but tell them plainly
  // this isn't their console instead of dumping the full admin command list.
  if (!isAuthorizedAdmin(chatId, fromUser)) {
    if (command === '/start' || command === '/help') {
      await sendTelegramMessage(chatId, "This bot is a private admin console for Pulse and isn't available for general use.");
    }
    return;
  }

  // Record admin chat ID
  lastAdminChatId = chatId;

  if (command === '/start' || command === '/help') {
    const helpMsg = `
⚡️ <b>Pulse Platform Central Administration Bot</b> ⚡️
Connected live to Pulse Video Platform & Firestore.

👑 <b>Admin:</b> ${TELEGRAM_ADMIN_HANDLE}
🤖 <b>Status:</b> Active & Controlling Platform

📋 <b>Moderation & Management Commands:</b>
━━━━━━━━━━━━━━━━━━━━
📊 <b>/stats</b> - Platform statistics & metrics
🔍 <b>/lookup &lt;@user | UID&gt;</b> - Complete user inspection & quick actions
🪙 <b>/give_coins &lt;@user&gt; &lt;amount&gt;</b> - Grant Pulse Coins to user wallet
💎 <b>/give_diamonds &lt;@user&gt; &lt;amount&gt;</b> - Grant Diamonds/Earnings to creator
🔻 <b>/deduct_coins &lt;@user&gt; &lt;amount&gt;</b> - Deduct Pulse Coins from user
💳 <b>/topups</b> - View recent OPay & coin top-up orders
💵 <b>/withdrawals</b> - View creator cashout & withdrawal requests
🚫 <b>/ban &lt;@user&gt; [reason] [hours]</b> - Ban or suspend user (e.g. 24h)
✅ <b>/unban &lt;@user&gt;</b> - Unban & restore user account
⚠️ <b>/warn &lt;@user&gt; &lt;reason&gt;</b> - Issue official moderation warning
💎 <b>/verify &lt;@user&gt;</b> - Grant official verified badge
❌ <b>/unverify &lt;@user&gt;</b> - Remove verified badge
💀 <b>/delete_user &lt;@user | UID&gt;</b> - Completely delete user and all their content
📢 <b>/broadcast &lt;message&gt;</b> - Send platform-wide announcement
🛠 <b>/maintenance &lt;on|off&gt; [msg]</b> - Toggle maintenance mode
🚀 <b>/boost_followers &lt;@user&gt; &lt;amount&gt;</b> - Boost follower count
❤️ <b>/boost_likes &lt;video_id&gt; &lt;amount&gt;</b> - Boost video likes
📜 <b>/appeals</b> - List pending unban appeals
⚡️ <b>/approve_appeal &lt;appeal_id&gt;</b> - Unban & approve appeal
❌ <b>/reject_appeal &lt;appeal_id&gt; [reason]</b> - Reject appeal
🚩 <b>/reports</b> - List open user/video reports
✅ <b>/resolve_report &lt;report_id&gt;</b> - Resolve open report
👥 <b>/users [query]</b> - Search/list creators
🎬 <b>/videos</b> - List recent uploaded videos
🌟 <b>/feature_video &lt;video_id&gt;</b> - Feature/highlight video
💬 <b>/comments &lt;video_id&gt;</b> - View recent video comments
🗑 <b>/delete_comment &lt;video_id&gt; &lt;comment_id&gt;</b> - Delete comment
🗑 <b>/delete_video &lt;video_id&gt;</b> - Delete video
🧹 <b>/clean_database</b> - Clean test data & audit follow counts
━━━━━━━━━━━━━━━━━━━━
<i>Appeals and reports submitted on Pulse are dispatched here in real-time.</i>
    `;
    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // 1. STATS
  if (command === '/stats') {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const videosSnap = await getDocs(collection(db, 'videos'));
      const streamsSnap = await getDocs(collection(db, 'livestreams'));
      const storiesSnap = await getDocs(collection(db, 'stories'));
      const appealsSnap = await getDocs(query(collection(db, 'appeals'), where('status', '==', 'pending')));
      const reportsSnap = await getDocs(query(collection(db, 'reports'), where('status', '==', 'open')));

      let totalUsers = 0;
      let verifiedUsers = 0;
      let bannedUsers = 0;
      let totalViews = 0;

      usersSnap.forEach((d) => {
        totalUsers++;
        const data = d.data();
        if (data.verified) verifiedUsers++;
        if (data.banned) bannedUsers++;
      });

      videosSnap.forEach((d) => {
        const v = d.data();
        totalViews += (v.views || 0);
      });

      const statsMsg = `
📊 <b>Pulse Platform Live Statistics:</b>
━━━━━━━━━━━━━━━━━━━━
👥 <b>Total Creators:</b> ${totalUsers.toLocaleString()}
💎 <b>Verified Accounts:</b> ${verifiedUsers.toLocaleString()}
🚫 <b>Banned/Suspended:</b> ${bannedUsers.toLocaleString()}
🎬 <b>Total Videos:</b> ${videosSnap.size.toLocaleString()}
👁 <b>Total Video Views:</b> ${totalViews.toLocaleString()}
🔴 <b>Active Live Streams:</b> ${streamsSnap.size}
⚡️ <b>Active Stories:</b> ${storiesSnap.size}
📜 <b>Pending Appeals:</b> ${appealsSnap.size}
🚩 <b>Open Reports:</b> ${reportsSnap.size}
🌐 <b>Platform Status:</b> Operational & Healthy
      `;
      await sendTelegramMessage(chatId, statsMsg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error fetching statistics: ${e.message}`);
    }
    return;
  }

  // 2. USER LOOKUP (/lookup)
  if (command === '/lookup') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/lookup &lt;@username | UID&gt;</code>');
      return;
    }
    const targetQuery = args[0];
    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> not found.`);
        return;
      }

      // Fetch user's videos
      const vSnap = await getDocs(query(collection(db, 'videos'), where('ownerUid', '==', user.uid)));
      const warningsCount = (user.warningHistory || []).length;
      const statusStr = user.banned 
        ? `🚫 <b>BANNED</b> (${user.banReason || 'Policy violation'})` 
        : user.suspendedUntil && user.suspendedUntil > Date.now()
        ? `⏳ <b>SUSPENDED</b> (Expires in ${Math.round((user.suspendedUntil - Date.now()) / 3600000)}h)`
        : '✅ <b>ACTIVE</b>';

      const lookupMsg = `
🔍 <b>CREATOR DOSSIER: ${user.handle || '@' + user.username}</b>
━━━━━━━━━━━━━━━━━━━━
📛 <b>Name:</b> ${user.username}
🆔 <b>UID:</b> <code>${user.uid}</code>
📧 <b>Email:</b> ${user.email || 'N/A'}
💎 <b>Verified:</b> ${user.verified ? 'YES (Blue Badge)' : 'No'}
📊 <b>Status:</b> ${statusStr}
👥 <b>Followers:</b> ${(user.followers || 0).toLocaleString()}
❤️ <b>Likes Received:</b> ${(user.likesReceived || 0).toLocaleString()}
🎬 <b>Total Videos:</b> ${vSnap.size}
⚠️ <b>Warning Strikes:</b> ${warningsCount}
📝 <b>Bio:</b> "${user.bio || 'No bio'}"
━━━━━━━━━━━━━━━━━━━━
⚡️ <b>Quick Commands:</b>
• <code>/ban ${user.handle}</code>
• <code>/unban ${user.handle}</code>
• <code>/warn ${user.handle} Guideline warning</code>
• <code>/verify ${user.handle}</code>
• <code>/boost_followers ${user.handle} 1000</code>
      `;

      const inlineMarkup = {
        inline_keyboard: [
          [
            { text: user.banned ? '🔓 Unban' : '🚫 Ban', callback_data: user.banned ? `unban_${user.uid}` : `ban_${user.uid}` },
            { text: user.verified ? '❌ Unverify' : '💎 Verify', callback_data: user.verified ? `unverify_${user.uid}` : `verify_${user.uid}` }
          ],
          [
            { text: '🪙 +500 Coins', callback_data: `give_coins_${user.uid}_500` },
            { text: '🪙 +1,000 Coins', callback_data: `give_coins_${user.uid}_1000` }
          ],
          [
            { text: '🚀 +1,000 Followers', callback_data: `boost_fol_${user.uid}_1000` }
          ]
        ]
      };

      await sendTelegramMessage(chatId, lookupMsg, inlineMarkup);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Lookup failed: ${e.message}`);
    }
    return;
  }

  // 3. BAN / SUSPEND USER
  if (command === '/ban') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/ban &lt;@username | UID&gt; [reason] [hours]</code>\nExample: <code>/ban @alex Spamming 24</code>');
      return;
    }
    const targetQuery = args[0];
    let hours = 0;
    let reason = 'Violation of community safety guidelines';

    const lastArg = args[args.length - 1];
    if (args.length > 1 && !isNaN(Number(lastArg)) && Number(lastArg) > 0) {
      hours = Number(lastArg);
      reason = args.slice(1, -1).join(' ') || reason;
    } else {
      reason = args.slice(1).join(' ') || reason;
    }

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found on Pulse.`);
        return;
      }

      const updateData: any = {
        banned: true,
        banReason: reason,
        bannedAt: Date.now()
      };

      if (hours > 0) {
        updateData.suspendedUntil = Date.now() + (hours * 3600 * 1000);
      } else {
        updateData.suspendedUntil = 0;
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);

      const banTypeStr = hours > 0 ? `Temporary Suspension (${hours} hours)` : 'Permanent Ban';

      await sendTelegramMessage(chatId, `
🚨 <b>USER SUSPENDED / BANNED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Handle:</b> ${user.handle || '@' + user.username}
📛 <b>Name:</b> ${user.username}
🆔 <b>UID:</b> <code>${user.uid}</code>
⏱ <b>Type:</b> ${banTypeStr}
📝 <b>Reason:</b> ${reason}
🔒 <b>Action:</b> User cannot post, comment, or broadcast.
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to ban user: ${e.message}`);
    }
    return;
  }

  // 4. UNBAN USER
  if (command === '/unban') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/unban &lt;@username | UID&gt;</code>');
      return;
    }
    const targetQuery = args[0];

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      await updateDoc(doc(db, 'users', user.uid), {
        banned: false,
        banReason: '',
        bannedAt: 0,
        suspendedUntil: 0
      });

      // Approve pending appeals
      const q = query(collection(db, 'appeals'), where('uid', '==', user.uid), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach((d) => {
        batch.update(d.ref, {
          status: 'approved',
          reviewedAt: Date.now(),
          reviewedBy: `Telegram Bot (${fromUser.username ? '@' + fromUser.username : 'Admin'})`
        });
      });
      await batch.commit();

      await sendTelegramMessage(chatId, `
✅ <b>USER UNBANNED & RESTORED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Handle:</b> ${user.handle || '@' + user.username}
🆔 <b>UID:</b> <code>${user.uid}</code>
🎉 <b>Status:</b> Account active & restored on Pulse!
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to unban user: ${e.message}`);
    }
    return;
  }

  // 5. WARN USER (/warn)
  if (command === '/warn') {
    if (!args[0] || args.length < 2) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/warn &lt;@username | UID&gt; &lt;reason&gt;</code>');
      return;
    }
    const targetQuery = args[0];
    const reason = args.slice(1).join(' ');

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      const warnings = user.warningHistory || [];
      const newWarning = {
        id: 'warn_' + Date.now(),
        reason: reason.trim(),
        issuedAt: Date.now(),
        adminNote: `Warning issued via Telegram Bot by ${fromUser.username ? '@' + fromUser.username : 'Admin'}`
      };
      warnings.push(newWarning);

      await updateDoc(doc(db, 'users', user.uid), {
        warningHistory: warnings,
        warningMessage: `Community Guidelines Warning: ${reason}`
      });

      // Send system notification to user
      const notifRef = collection(db, 'users', user.uid, 'notifications');
      await addDoc(notifRef, {
        kind: 'warning',
        who: 'Pulse Safety Team',
        avatar: null,
        text: `Official Warning: ${reason}`,
        time: 'Just now',
        createdAt: Date.now(),
        read: false
      });

      await sendTelegramMessage(chatId, `
⚠️ <b>OFFICIAL WARNING ISSUED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>User:</b> ${user.handle || '@' + user.username}
📝 <b>Reason:</b> ${reason}
📊 <b>Total Strikes:</b> ${warnings.length}
🔔 <b>Notice:</b> In-app warning banner and notification dispatched to user.
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to warn user: ${e.message}`);
    }
    return;
  }

  // 6. BROADCAST ANNOUNCEMENT (/broadcast)
  if (command === '/broadcast') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/broadcast &lt;message&gt;</code>');
      return;
    }
    const message = args.join(' ');
    try {
      const annRef = collection(db, 'announcements');
      await addDoc(annRef, {
        title: 'Platform Announcement',
        message: message.trim(),
        type: 'broadcast',
        isActive: true,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000 * 3
      });

      await sendTelegramMessage(chatId, `
📢 <b>SYSTEM BROADCAST PUBLISHED</b>
━━━━━━━━━━━━━━━━━━━━
💬 <b>Message:</b> "${message}"
🌐 <b>Distribution:</b> Active on all user clients & feeds.
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Broadcast error: ${e.message}`);
    }
    return;
  }

  // 7. MAINTENANCE MODE (/maintenance)
  if (command === '/maintenance') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/maintenance &lt;on | off&gt; [message]</code>');
      return;
    }
    const mode = args[0].toLowerCase();
    const customMsg = args.slice(1).join(' ') || 'Pulse is currently undergoing scheduled platform upgrades. We will be back online shortly!';

    try {
      const maintDocRef = doc(db, 'announcements', 'maintenance_mode');
      if (mode === 'on') {
        await setDoc(maintDocRef, {
          title: 'Scheduled Maintenance',
          message: customMsg,
          type: 'maintenance',
          isActive: true,
          createdAt: Date.now()
        });
        await sendTelegramMessage(chatId, `🛠 <b>MAINTENANCE MODE ACTIVATED</b>\nUsers will see the maintenance overlay banner.\n\nMessage: "${customMsg}"`);
      } else {
        await setDoc(maintDocRef, {
          title: 'Maintenance Ended',
          message: '',
          type: 'maintenance',
          isActive: false,
          createdAt: Date.now()
        });
        await sendTelegramMessage(chatId, `✅ <b>MAINTENANCE MODE DEACTIVATED</b>\nPulse platform is fully open to all creators.`);
      }
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to update maintenance mode: ${e.message}`);
    }
    return;
  }

  // 8. VERIFY USER
  if (command === '/verify') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/verify &lt;@username | UID&gt;</code>');
      return;
    }
    const targetQuery = args[0];

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      await updateDoc(doc(db, 'users', user.uid), {
        verified: true,
        verificationStatus: 'verified'
      });

      // Update videos
      const vidsQuery = query(collection(db, 'videos'), where('ownerUid', '==', user.uid));
      const vidsSnap = await getDocs(vidsQuery);
      const batch = writeBatch(db);
      vidsSnap.forEach((d) => batch.update(d.ref, { verified: true }));
      await batch.commit();

      await sendTelegramMessage(chatId, `
💎 <b>OFFICIAL VERIFIED BADGE GRANTED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Handle:</b> ${user.handle || '@' + user.username}
📛 <b>Name:</b> ${user.username}
✨ <b>Badge:</b> Authentic verified checkmark active across profile, feed, comments & search!
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to verify user: ${e.message}`);
    }
    return;
  }

  // 9. UNVERIFY USER
  if (command === '/unverify') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/unverify &lt;@username | UID&gt;</code>');
      return;
    }
    const targetQuery = args[0];

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      await updateDoc(doc(db, 'users', user.uid), {
        verified: false,
        verificationStatus: 'unverified'
      });

      const vidsQuery = query(collection(db, 'videos'), where('ownerUid', '==', user.uid));
      const vidsSnap = await getDocs(vidsQuery);
      const batch = writeBatch(db);
      vidsSnap.forEach((d) => batch.update(d.ref, { verified: false }));
      await batch.commit();

      await sendTelegramMessage(chatId, `❌ Verified badge removed from <b>${user.handle || user.username}</b>.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
    return;
  }

  // 10. REPORTS LIST (/reports)
  if (command === '/reports') {
    try {
      const q = query(collection(db, 'reports'), where('status', '==', 'open'), limit(15));
      const snap = await getDocs(q);

      if (snap.empty) {
        await sendTelegramMessage(chatId, '🎉 <b>No open user or video reports!</b>');
        return;
      }

      let msg = `🚩 <b>Open Safety Reports (${snap.size}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      snap.forEach((d) => {
        const r = d.data();
        msg += `\n🆔 <b>Report ID:</b> <code>${d.id}</code>\n📂 <b>Target Type:</b> ${r.type.toUpperCase()}\n🎯 <b>Target ID / Handle:</b> ${r.targetHandle || r.targetId}\n⚠️ <b>Reason:</b> ${r.reason}\n💬 <b>Details:</b> ${r.details || 'None'}\n👤 <b>Reporter:</b> ${r.reporterHandle}\n👉 <b>Resolve:</b> <code>/resolve_report ${d.id}</code>\n────────────────────`;
      });

      await sendTelegramMessage(chatId, msg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error fetching reports: ${e.message}`);
    }
    return;
  }

  // 11. RESOLVE REPORT (/resolve_report)
  if (command === '/resolve_report') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/resolve_report &lt;report_id&gt;</code>');
      return;
    }
    const reportId = args[0];
    try {
      const rRef = doc(db, 'reports', reportId);
      await updateDoc(rRef, {
        status: 'resolved',
        resolvedAt: Date.now(),
        resolvedBy: `Telegram Bot (${fromUser.username ? '@' + fromUser.username : 'Admin'})`
      });
      await sendTelegramMessage(chatId, `✅ Report <code>${reportId}</code> marked as RESOLVED.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to resolve report: ${e.message}`);
    }
    return;
  }

  // 6. BOOST FOLLOWERS
  if (command === '/boost_followers') {
    if (!args[0] || !args[1]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/boost_followers &lt;@username&gt; &lt;amount&gt;</code>\nExample: <code>/boost_followers @alex 1000</code>');
      return;
    }
    const targetQuery = args[0];
    const amount = parseInt(args[1], 10);

    if (isNaN(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, '❌ Please specify a valid positive number for follower boost amount.');
      return;
    }

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { followers: increment(amount) });
      const updatedSnap = await getDoc(userRef);
      const newCount = updatedSnap.data()?.followers || ((user.followers || 0) + amount);

      await sendTelegramMessage(chatId, `
🚀 <b>FOLLOWER BOOST APPLIED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Creator:</b> ${user.handle || '@' + user.username}
➕ <b>Added:</b> +${amount.toLocaleString()} followers
📈 <b>New Total:</b> ${newCount.toLocaleString()} followers
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to boost followers: ${e.message}`);
    }
    return;
  }

  // GRANT COINS TO USER WALLET (/give_coins, /grant_coins)
  if (command === '/give_coins' || command === '/grant_coins') {
    if (!args[0] || !args[1]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/give_coins &lt;@username | UID&gt; &lt;amount&gt;</code>\nExample: <code>/give_coins @alex 1000</code>');
      return;
    }
    const targetQuery = args[0];
    const amount = parseInt(args[1], 10);

    if (isNaN(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, '❌ Please enter a valid positive number of coins to grant.');
      return;
    }

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { walletCoins: increment(amount) });
      const updatedSnap = await getDoc(userRef);
      const newBalance = updatedSnap.data()?.walletCoins || ((user.walletCoins || 0) + amount);

      // Record wallet transaction
      const txRef = collection(db, 'users', user.uid, 'wallet_transactions');
      await addDoc(txRef, {
        type: 'admin_grant',
        coinsAdded: amount,
        grantedBy: `Telegram Bot (${fromUser.username ? '@' + fromUser.username : 'Admin'})`,
        timestamp: Date.now(),
        status: 'completed'
      });

      // Send in-app notification to the user
      const notifRef = collection(db, 'users', user.uid, 'notifications');
      await addDoc(notifRef, {
        kind: 'system',
        who: 'Pulse Administration',
        avatar: null,
        text: `You have received 🪙 ${amount.toLocaleString()} Pulse Coins in your wallet! 🎉`,
        time: 'Just now',
        createdAt: Date.now(),
        read: false
      });

      await sendTelegramMessage(chatId, `
🪙 <b>PULSE COINS GRANTED SUCCESSFULLY</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Recipient:</b> ${user.handle || '@' + user.username}
🆔 <b>UID:</b> <code>${user.uid}</code>
➕ <b>Granted:</b> +${amount.toLocaleString()} Coins
💰 <b>New Coin Balance:</b> ${newBalance.toLocaleString()} Coins
🔔 <b>Notice:</b> Wallet credited and in-app alert dispatched.
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to grant coins: ${e.message}`);
    }
    return;
  }

  // DEDUCT COINS FROM USER WALLET (/deduct_coins)
  if (command === '/deduct_coins') {
    if (!args[0] || !args[1]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/deduct_coins &lt;@username | UID&gt; &lt;amount&gt;</code>');
      return;
    }
    const targetQuery = args[0];
    const amount = parseInt(args[1], 10);

    if (isNaN(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, '❌ Please enter a valid positive number of coins to deduct.');
      return;
    }

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      const currentCoins = user.walletCoins || 0;
      const nextCoins = Math.max(0, currentCoins - amount);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { walletCoins: nextCoins });

      await sendTelegramMessage(chatId, `
🔻 <b>PULSE COINS DEDUCTED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>User:</b> ${user.handle || '@' + user.username}
➖ <b>Deducted:</b> -${amount.toLocaleString()} Coins
💰 <b>Remaining Balance:</b> ${nextCoins.toLocaleString()} Coins
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to deduct coins: ${e.message}`);
    }
    return;
  }

  // GRANT DIAMONDS / REVENUE TO CREATOR (/give_diamonds)
  if (command === '/give_diamonds') {
    if (!args[0] || !args[1]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/give_diamonds &lt;@username | UID&gt; &lt;amount&gt;</code>\nExample: <code>/give_diamonds @alex 2000</code>');
      return;
    }
    const targetQuery = args[0];
    const amount = parseInt(args[1], 10);

    if (isNaN(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, '❌ Please enter a valid number of diamonds.');
      return;
    }

    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ Creator <b>${targetQuery}</b> was not found.`);
        return;
      }

      const usdValue = Number((amount * 0.005).toFixed(2));
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        walletDiamonds: increment(amount),
        totalEarningsUSD: increment(usdValue)
      });
      const updatedSnap = await getDoc(userRef);
      const newDiamonds = updatedSnap.data()?.walletDiamonds || ((user.walletDiamonds || 0) + amount);

      await sendTelegramMessage(chatId, `
💎 <b>CREATOR DIAMONDS GRANTED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Creator:</b> ${user.handle || '@' + user.username}
➕ <b>Granted:</b> +${amount.toLocaleString()} Diamonds (≈ $${usdValue} USD / ₦${(amount * 7.5).toLocaleString()})
💎 <b>New Diamond Balance:</b> ${newDiamonds.toLocaleString()} Diamonds
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to grant diamonds: ${e.message}`);
    }
    return;
  }

  // VIEW TOPUP ORDERS (/topups)
  if (command === '/topups') {
    try {
      const q = query(collection(db, 'opay_topups'), orderBy('timestamp', 'desc'), limit(15));
      const snap = await getDocs(q);

      if (snap.empty) {
        await sendTelegramMessage(chatId, '💳 <b>No coin top-ups recorded yet.</b>');
        return;
      }

      let msg = `💳 <b>Recent Coin Top-Up Orders (${snap.size}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      snap.forEach((d) => {
        const t = d.data();
        const timeStr = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const ngn = t.amountNGN ? `₦${t.amountNGN.toLocaleString()}` : 'N/A';
        msg += `\n🪙 <b>+${(t.coinsAdded || 0).toLocaleString()} Coins</b> (${ngn})\n👤 <b>Sender:</b> ${t.senderName || 'Anonymous'}\n🆔 <b>Ref:</b> <code>${t.reference || d.id}</code>\n🕒 <b>Time:</b> ${timeStr}\n────────────────────`;
      });
      await sendTelegramMessage(chatId, msg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error fetching topups: ${e.message}`);
    }
    return;
  }

  // VIEW WITHDRAWAL REQUESTS (/withdrawals)
  if (command === '/withdrawals') {
    try {
      const q = query(collection(db, 'payout_requests'), orderBy('requestedAt', 'desc'), limit(15));
      const snap = await getDocs(q);

      if (snap.empty) {
        await sendTelegramMessage(chatId, '💵 <b>No creator cashout / withdrawal requests found.</b>');
        return;
      }

      let msg = `💵 <b>Creator Cashout & Withdrawal Requests (${snap.size}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      snap.forEach((d) => {
        const p = d.data();
        const timeStr = new Date(p.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const ngnVal = (p.diamondsDeducted || 0) * 7.5;
        msg += `\n👤 <b>Creator:</b> @${p.handle || 'User'}\n💎 <b>${(p.diamondsDeducted || 0).toLocaleString()} Diamonds</b> ($${p.usdAmount || 0} USD / ₦${ngnVal.toLocaleString()})\n🏦 <b>Method:</b> ${(p.payoutMethod || 'OPay').toUpperCase()}\n📍 <b>Destination:</b> <code>${p.payoutAddress}</code>\n🕒 <b>Requested:</b> ${timeStr}\n────────────────────`;
      });
      await sendTelegramMessage(chatId, msg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error fetching withdrawals: ${e.message}`);
    }
    return;
  }

  // 7. BOOST LIKES
  if (command === '/boost_likes') {
    if (!args[0] || !args[1]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/boost_likes &lt;video_id_or_link&gt; &lt;amount&gt;</code>\nExample: <code>/boost_likes vid123 500</code>');
      return;
    }
    const videoInput = args[0];
    const amount = parseInt(args[1], 10);

    if (isNaN(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, '❌ Please specify a valid positive number for like boost.');
      return;
    }

    const videoId = parseVideoId(videoInput);

    try {
      const videoRef = doc(db, 'videos', videoId);
      const snap = await getDoc(videoRef);
      if (!snap.exists()) {
        await sendTelegramMessage(chatId, `❌ Video with ID <code>${videoId}</code> was not found.`);
        return;
      }

      const vData = snap.data();
      await updateDoc(videoRef, { likeCount: increment(amount) });

      if (vData.ownerUid) {
        try {
          await updateDoc(doc(db, 'users', vData.ownerUid), { likesReceived: increment(amount) });
        } catch (e) {}
      }

      const newLikes = (vData.likeCount || 0) + amount;

      await sendTelegramMessage(chatId, `
❤️ <b>VIDEO LIKES BOOSTED</b>
━━━━━━━━━━━━━━━━━━━━
🎬 <b>Video ID:</b> <code>${videoId}</code>
👤 <b>Creator:</b> ${vData.ownerHandle}
📝 <b>Caption:</b> "${vData.caption || 'Video'}"
➕ <b>Added:</b> +${amount.toLocaleString()} Likes
🔥 <b>New Like Total:</b> ${newLikes.toLocaleString()} Likes
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to boost likes: ${e.message}`);
    }
    return;
  }

  // 8. APPEALS LIST
  if (command === '/appeals') {
    try {
      const q = query(collection(db, 'appeals'), where('status', '==', 'pending'), limit(15));
      const snap = await getDocs(q);

      if (snap.empty) {
        await sendTelegramMessage(chatId, '🎉 <b>No pending ban appeals at the moment!</b>');
        return;
      }

      let msg = `📜 <b>Pending Ban Appeals (${snap.size}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      snap.forEach((d) => {
        const a = d.data();
        msg += `\n🆔 <b>Appeal ID:</b> <code>${d.id}</code>\n👤 <b>User:</b> ${a.handle} (${a.username})\n⚠️ <b>Ban Reason:</b> ${a.reason || 'N/A'}\n💬 <b>Appeal:</b> "${a.appealText}"\n📞 <b>Contact:</b> ${a.contactInfo || a.email}\n👉 <b>Approve:</b> <code>/approve_appeal ${d.id}</code>\n👉 <b>Reject:</b> <code>/reject_appeal ${d.id}</code>\n────────────────────`;
      });

      await sendTelegramMessage(chatId, msg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error fetching appeals: ${e.message}`);
    }
    return;
  }

  // 9. APPROVE APPEAL
  if (command === '/approve_appeal') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/approve_appeal &lt;appeal_id | @username&gt;</code>');
      return;
    }
    const target = args[0];

    try {
      let appealDocSnap = await getDoc(doc(db, 'appeals', target));
      let appealId = target;
      let appealData: any = null;

      if (appealDocSnap.exists()) {
        appealData = appealDocSnap.data();
      } else {
        // Query by username/handle
        const user = await findUserByQuery(target);
        if (user) {
          const q = query(collection(db, 'appeals'), where('uid', '==', user.uid), where('status', '==', 'pending'));
          const snap = await getDocs(q);
          if (!snap.empty) {
            appealDocSnap = snap.docs[0];
            appealId = appealDocSnap.id;
            appealData = appealDocSnap.data();
          }
        }
      }

      if (!appealData) {
        await sendTelegramMessage(chatId, `❌ Pending appeal for <b>${target}</b> not found.`);
        return;
      }

      await updateDoc(doc(db, 'appeals', appealId), {
        status: 'approved',
        reviewedAt: Date.now(),
        reviewedBy: `Telegram Bot (${fromUser.username ? '@' + fromUser.username : 'Admin'})`
      });

      // Unban user
      if (appealData.uid) {
        await updateDoc(doc(db, 'users', appealData.uid), {
          banned: false,
          banReason: '',
          bannedAt: 0
        });
      }

      await sendTelegramMessage(chatId, `
✅ <b>APPEAL APPROVED & USER UNBANNED</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Creator:</b> ${appealData.handle}
🆔 <b>Appeal:</b> <code>${appealId}</code>
🎉 <b>Result:</b> Account fully reinstated on Pulse!
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to approve appeal: ${e.message}`);
    }
    return;
  }

  // 10. REJECT APPEAL
  if (command === '/reject_appeal') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/reject_appeal &lt;appeal_id&gt; [reason]</code>');
      return;
    }
    const appealId = args[0];
    const reason = args.slice(1).join(' ') || 'Appeal rejected after review';

    try {
      const appealRef = doc(db, 'appeals', appealId);
      const snap = await getDoc(appealRef);
      if (!snap.exists()) {
        await sendTelegramMessage(chatId, `❌ Appeal <code>${appealId}</code> not found.`);
        return;
      }

      await updateDoc(appealRef, {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: Date.now(),
        reviewedBy: `Telegram Bot (${fromUser.username ? '@' + fromUser.username : 'Admin'})`
      });

      await sendTelegramMessage(chatId, `❌ Appeal <code>${appealId}</code> was rejected.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
    return;
  }

  // 11. USERS LIST
  if (command === '/users') {
    try {
      const queryTerm = args.join(' ').toLowerCase();
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(30)));
      let count = 0;
      let msg = `👥 <b>Pulse Creators:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;

      usersSnap.forEach((d) => {
        const u = d.data();
        if (
          !queryTerm ||
          (u.handle && u.handle.toLowerCase().includes(queryTerm)) ||
          (u.username && u.username.toLowerCase().includes(queryTerm))
        ) {
          count++;
          const badge = u.verified ? ' 💎' : '';
          const banned = u.banned ? ' 🚫[BANNED]' : '';
          msg += `\n• <b>${u.handle || '@' + u.username}</b>${badge}${banned}\n  UID: <code>${d.id}</code> | Followers: ${(u.followers || 0).toLocaleString()}\n`;
        }
      });

      if (count === 0) {
        msg = `❌ No users found matching "${queryTerm}".`;
      }
      await sendTelegramMessage(chatId, msg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
    return;
  }

  // 12. VIDEOS LIST
  if (command === '/videos') {
    try {
      const vidsSnap = await getDocs(query(collection(db, 'videos'), orderBy('createdAt', 'desc'), limit(10)));
      if (vidsSnap.empty) {
        await sendTelegramMessage(chatId, '🎬 No videos currently found on the platform.');
        return;
      }

      let msg = `🎬 <b>Recent Platform Videos:</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      vidsSnap.forEach((d) => {
        const v = d.data();
        msg += `\n🆔 <code>${d.id}</code>\n👤 <b>${v.ownerHandle}</b>\n📝 "${(v.caption || '').slice(0, 35)}..."\n❤️ ${v.likeCount || 0} Likes | 💬 ${v.commentCount || 0} Comments\n`;
      });
      await sendTelegramMessage(chatId, msg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
    return;
  }

  // 13. DELETE VIDEO
  if (command === '/delete_video') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/delete_video &lt;video_id&gt;</code>');
      return;
    }
    const videoId = parseVideoId(args[0]);
    try {
      await deleteDoc(doc(db, 'videos', videoId));
      await sendTelegramMessage(chatId, `🗑 Video <code>${videoId}</code> was deleted from Pulse.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to delete video: ${e.message}`);
    }
    return;
  }

  // 14. DELETE USER & ALL USER CONTENT
  if (command === '/delete_user') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/delete_user &lt;@username | UID&gt;</code>');
      return;
    }
    const targetQuery = args[0];
    try {
      const user = await findUserByQuery(targetQuery);
      if (!user) {
        await sendTelegramMessage(chatId, `❌ User <b>${targetQuery}</b> not found.`);
        return;
      }

      // Delete user document
      await deleteDoc(doc(db, 'users', user.uid));

      // Delete user videos
      const vidsSnap = await getDocs(query(collection(db, 'videos'), where('ownerUid', '==', user.uid)));
      let vidsCount = 0;
      for (const d of vidsSnap.docs) {
        await deleteDoc(d.ref);
        vidsCount++;
      }

      // Delete user stories
      const storiesSnap = await getDocs(query(collection(db, 'stories'), where('ownerUid', '==', user.uid)));
      for (const d of storiesSnap.docs) {
        await deleteDoc(d.ref);
      }

      await sendTelegramMessage(chatId, `
💀 <b>USER PURGED FROM PLATFORM</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>User:</b> ${user.handle || user.username}
🆔 <b>UID:</b> <code>${user.uid}</code>
🎬 <b>Videos Removed:</b> ${vidsCount}
🧹 <b>Status:</b> Account and all associated media wiped cleanly.
      `);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error deleting user: ${e.message}`);
    }
    return;
  }

  // 15. FEATURE / UNFEATURE VIDEO
  if (command === '/feature_video') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/feature_video &lt;video_id&gt;</code>');
      return;
    }
    const videoId = parseVideoId(args[0]);
    try {
      const vRef = doc(db, 'videos', videoId);
      const snap = await getDoc(vRef);
      if (!snap.exists()) {
        await sendTelegramMessage(chatId, `❌ Video <code>${videoId}</code> not found.`);
        return;
      }
      const data = snap.data();
      const nextFeatured = !data.isFeatured;
      await updateDoc(vRef, { isFeatured: nextFeatured });
      await sendTelegramMessage(chatId, `🌟 Video <code>${videoId}</code> is now <b>${nextFeatured ? 'FEATURED' : 'UNFEATURED'}</b>!`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
    return;
  }

  // 16. VIEW COMMENTS ON A VIDEO
  if (command === '/comments') {
    if (!args[0]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/comments &lt;video_id&gt;</code>');
      return;
    }
    const videoId = parseVideoId(args[0]);
    try {
      const cSnap = await getDocs(query(collection(db, 'videos', videoId, 'comments'), limit(15)));
      if (cSnap.empty) {
        await sendTelegramMessage(chatId, `💬 No comments found for video <code>${videoId}</code>.`);
        return;
      }

      let msg = `💬 <b>Comments on Video <code>${videoId}</code> (${cSnap.size}):</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      cSnap.forEach((d) => {
        const c = d.data();
        msg += `\n🆔 <code>${d.id}</code> | 👤 <b>${c.who}</b>\n📝 "${c.txt}"\n👉 Delete: <code>/delete_comment ${videoId} ${d.id}</code>\n`;
      });
      await sendTelegramMessage(chatId, msg);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error fetching comments: ${e.message}`);
    }
    return;
  }

  // 17. DELETE A COMMENT
  if (command === '/delete_comment') {
    if (!args[0] || !args[1]) {
      await sendTelegramMessage(chatId, '⚠️ Usage: <code>/delete_comment &lt;video_id&gt; &lt;comment_id&gt;</code>');
      return;
    }
    const videoId = parseVideoId(args[0]);
    const commentId = args[1].trim();
    try {
      await deleteDoc(doc(db, 'videos', videoId, 'comments', commentId));
      await updateDoc(doc(db, 'videos', videoId), { commentCount: increment(-1) });
      await sendTelegramMessage(chatId, `🗑 Comment <code>${commentId}</code> deleted from video <code>${videoId}</code>.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error deleting comment: ${e.message}`);
    }
    return;
  }

  // 18. CLEAN DATABASE
  if (command === '/clean_database') {
    try {
      await cleanDatabaseOfFakeAccounts();
      await sendTelegramMessage(chatId, `🧹 <b>Database audit and cleanup complete!</b> Fake accounts removed and follow metrics recalculated.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Cleanup error: ${e.message}`);
    }
    return;
  }
}

// Telegram Callback Query Handler (for inline buttons)
async function handleTelegramCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data;
  const message = callbackQuery.message;
  const chatId = message.chat.id;

  // Same authorization gate as handleTelegramCommand — inline buttons
  // (Verify/Unverify, Ban/Unban, etc.) carry the same admin power as the
  // slash commands and must be checked against the same sender identity.
  if (!isAuthorizedAdmin(chatId, callbackQuery.from)) {
    return;
  }

  if (data?.startsWith('ban_')) {
    const uid = data.replace('ban_', '');
    try {
      await updateDoc(doc(db, 'users', uid), {
        banned: true,
        banReason: 'Banned by Admin via Telegram',
        bannedAt: Date.now()
      });
      await sendTelegramMessage(chatId, `🚫 User <code>${uid}</code> has been <b>BANNED</b>.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to ban: ${e.message}`);
    }
  } else if (data?.startsWith('unban_')) {
    const uid = data.replace('unban_', '');
    try {
      await updateDoc(doc(db, 'users', uid), {
        banned: false,
        banReason: '',
        bannedAt: 0
      });
      await sendTelegramMessage(chatId, `✅ User <code>${uid}</code> has been <b>UNBANNED</b>.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to unban: ${e.message}`);
    }
  } else if (data?.startsWith('verify_')) {
    const uid = data.replace('verify_', '');
    try {
      await updateDoc(doc(db, 'users', uid), {
        verified: true,
        verificationStatus: 'verified'
      });
      const vidsQuery = query(collection(db, 'videos'), where('ownerUid', '==', uid));
      const vidsSnap = await getDocs(vidsQuery);
      const batch = writeBatch(db);
      vidsSnap.forEach((d) => batch.update(d.ref, { verified: true }));
      await batch.commit();
      await sendTelegramMessage(chatId, `💎 User <code>${uid}</code> is now <b>VERIFIED</b> with blue badge!`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to verify: ${e.message}`);
    }
  } else if (data?.startsWith('unverify_')) {
    const uid = data.replace('unverify_', '');
    try {
      await updateDoc(doc(db, 'users', uid), {
        verified: false,
        verificationStatus: 'unverified'
      });
      const vidsQuery = query(collection(db, 'videos'), where('ownerUid', '==', uid));
      const vidsSnap = await getDocs(vidsQuery);
      const batch = writeBatch(db);
      vidsSnap.forEach((d) => batch.update(d.ref, { verified: false }));
      await batch.commit();
      await sendTelegramMessage(chatId, `❌ Verified badge removed from user <code>${uid}</code>.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Failed to unverify: ${e.message}`);
    }
  } else if (data?.startsWith('boost_fol_')) {
    const parts = data.replace('boost_fol_', '').split('_');
    const uid = parts[0];
    const amount = parseInt(parts[1] || '1000', 10);
    try {
      await updateDoc(doc(db, 'users', uid), { followers: increment(amount) });
      await sendTelegramMessage(chatId, `🚀 Boosted <b>+${amount.toLocaleString()} followers</b> for user <code>${uid}</code>!`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Boost failed: ${e.message}`);
    }
  } else if (data?.startsWith('give_coins_')) {
    const parts = data.replace('give_coins_', '').split('_');
    const uid = parts[0];
    const amount = parseInt(parts[1] || '500', 10);
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { walletCoins: increment(amount) });
      const snap = await getDoc(userRef);
      const newBal = snap.data()?.walletCoins || 0;

      // Add tx & notification
      await addDoc(collection(db, 'users', uid, 'wallet_transactions'), {
        type: 'admin_grant',
        coinsAdded: amount,
        grantedBy: 'Telegram Bot (Inline Button)',
        timestamp: Date.now(),
        status: 'completed'
      });

      await sendTelegramMessage(chatId, `🪙 Granted <b>+${amount.toLocaleString()} Coins</b> to user <code>${uid}</code>! (New Balance: ${newBal.toLocaleString()} Coins)`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Coin grant failed: ${e.message}`);
    }
  } else if (data?.startsWith('approve_appeal_')) {
    const appealId = data.replace('approve_appeal_', '');
    try {
      const appealRef = doc(db, 'appeals', appealId);
      const snap = await getDoc(appealRef);
      if (snap.exists()) {
        const aData = snap.data();
        await updateDoc(appealRef, {
          status: 'approved',
          reviewedAt: Date.now(),
          reviewedBy: 'Telegram Bot Admin'
        });
        if (aData.uid) {
          await updateDoc(doc(db, 'users', aData.uid), {
            banned: false,
            banReason: '',
            bannedAt: 0
          });
        }
        await sendTelegramMessage(chatId, `✅ Appeal <code>${appealId}</code> APPROVED! User <b>${aData.handle}</b> is now unbanned.`);
      }
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
  } else if (data?.startsWith('reject_appeal_')) {
    const appealId = data.replace('reject_appeal_', '');
    try {
      await updateDoc(doc(db, 'appeals', appealId), {
        status: 'rejected',
        rejectionReason: 'Rejected via Telegram inline button',
        reviewedAt: Date.now(),
        reviewedBy: 'Telegram Bot Admin'
      });
      await sendTelegramMessage(chatId, `❌ Appeal <code>${appealId}</code> marked as REJECTED.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
  } else if (data?.startsWith('resolve_report_')) {
    const reportId = data.replace('resolve_report_', '');
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: 'resolved',
        resolvedAt: Date.now(),
        resolvedBy: 'Telegram Bot Admin'
      });
      await sendTelegramMessage(chatId, `✅ Report <code>${reportId}</code> marked as RESOLVED.`);
    } catch (e: any) {
      await sendTelegramMessage(chatId, `❌ Error: ${e.message}`);
    }
  }
}

// Telegram Polling Loop
async function pollTelegramUpdates() {
  while (botPollingActive) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=20`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = update.update_id;
            if (update.message?.text) {
              await handleTelegramCommand(update.message.chat.id, update.message.text, update.message.from);
            } else if (update.callback_query) {
              await handleTelegramCallbackQuery(update.callback_query);
            }
          }
        }
      }
    } catch (err) {
      // transient network error, wait a bit
      await new Promise((r) => setTimeout(r, 4000));
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// Start bot background polling only when a real token is configured.
if (TELEGRAM_BOT_TOKEN) {
  pollTelegramUpdates().catch((e) => console.error('Telegram polling error:', e));
} else {
  console.warn('Telegram polling disabled: TELEGRAM_BOT_TOKEN is not configured.');
}

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    telegramBot: !!TELEGRAM_BOT_TOKEN,
    adminHandle: TELEGRAM_ADMIN_HANDLE,
    botActive: botPollingActive && !!TELEGRAM_BOT_TOKEN
  });
});

// Media upload endpoint (supports large video, photo, audio uploads)
app.post('/api/upload', async (req, res) => {
  try {
    const { data, dataUrl, file, filename, type } = req.body;
    const mediaPayload = data || dataUrl || file;
    if (!mediaPayload) {
      return res.status(400).json({ error: 'No media data provided' });
    }

    let buffer: Buffer;
    let ext = 'mp4';

    if (typeof mediaPayload === 'string' && mediaPayload.startsWith('data:')) {
      const matches = mediaPayload.match(/^data:([A-Za-z0-9\-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mime = matches[1].toLowerCase();
        if (mime.includes('image/png')) ext = 'png';
        else if (mime.includes('image/jpeg') || mime.includes('image/jpg')) ext = 'jpg';
        else if (mime.includes('image/webp')) ext = 'webp';
        else if (mime.includes('image/gif')) ext = 'gif';
        else if (mime.includes('audio/webm')) ext = 'webm';
        else if (mime.includes('audio/mp3') || mime.includes('audio/mpeg')) ext = 'mp3';
        else if (mime.includes('video/webm')) ext = 'webm';
        else if (mime.includes('video/quicktime')) ext = 'mov';
        else if (mime.includes('video/ogg')) ext = 'ogv';
        else ext = 'mp4';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(mediaPayload, 'base64');
      }
    } else if (typeof mediaPayload === 'string') {
      buffer = Buffer.from(mediaPayload, 'base64');
    } else {
      buffer = Buffer.from(mediaPayload);
    }

    const uniqueName = `pulse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${uniqueName}`;
    console.log(`✅ Uploaded media saved: ${publicUrl} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    res.json({ success: true, url: publicUrl, size: buffer.length });
  } catch (err: any) {
    console.error('Upload processing error:', err);
    res.status(500).json({ error: err.message || 'Failed to process media upload' });
  }
});

// LiveKit WebRTC Real-Time Token Generation Endpoint
app.post('/api/livekit/token', async (req, res) => {
  try {
    const { roomName, participantIdentity, participantName, isPublisher } = req.body;
    if (!roomName || !participantIdentity) {
      return res.status(400).json({ error: 'roomName and participantIdentity are required' });
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(participantIdentity),
      name: String(participantName || participantIdentity),
    });

    at.addGrant({
      room: String(roomName),
      roomJoin: true,
      canPublish: isPublisher !== false,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();
    res.json({
      success: true,
      token,
      url: LIVEKIT_URL,
      roomName,
      participantIdentity
    });
  } catch (err: any) {
    console.error('LiveKit token error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate LiveKit token' });
  }
});

// Groq & Gemini AI Clients
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
let groqClient: Groq | null = null;
function getGroqClient(): Groq | null {
  if (!groqClient && GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: GROQ_API_KEY });
  }
  return groqClient;
}

let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Handler for AI Caption Generation (Using Groq Ultra-Fast Inference)
async function handleGenerateCaption(req: express.Request, res: express.Response) {
  try {
    const { topic, style, mediaType, tags } = req.body;
    const groq = getGroqClient();

    if (groq) {
      try {
        const prompt = `You are an elite viral social video creator and copywriter for a high-engagement short-form video platform (Pulse/TikTok/Reels).
Generate a punchy, viral caption (1-2 sentences maximum), with an engaging hook, high-energy emojis, and 3-5 trending hashtags.
Topic / Draft idea: "${topic || 'Exciting lifestyle moment'}"
Style: "${style || 'viral & engaging'}"
Media type: "${mediaType || 'video'}"
Included tags: ${Array.isArray(tags) ? tags.join(', ') : 'none'}

Return ONLY the caption text and hashtags formatted ready to post without quotes or preamble.`;

        const completion = await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: 'You are a master viral TikTok/Reels caption copywriter. Reply only with the caption and hashtags.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.85,
          max_tokens: 250
        });

        const generatedText = completion.choices[0]?.message?.content?.trim() || '';
        if (generatedText) {
          return res.json({ success: true, caption: generatedText, provider: 'groq' });
        }
      } catch (groqErr) {
        console.warn('Groq primary attempt failed, trying fallback model:', groqErr);
        try {
          const fallbackComp = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
              { role: 'user', content: `Generate a punchy viral 1-sentence TikTok caption with hashtags about: "${topic || 'viral moment'}"` }
            ],
            temperature: 0.8,
            max_tokens: 150
          });
          const text = fallbackComp.choices[0]?.message?.content?.trim() || '';
          if (text) {
            return res.json({ success: true, caption: text, provider: 'groq' });
          }
        } catch (e) {}
      }
    }

    // Gemini fallback if Groq not available
    const gemini = getGeminiClient();
    if (gemini) {
      const response = await gemini.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: `Generate a punchy, viral caption (1-2 sentences) with emojis and hashtags for: "${topic || 'lifestyle moment'}"`,
        config: { temperature: 0.85, maxOutputTokens: 200 }
      });
      const generatedText = response.text?.trim() || '';
      if (generatedText) {
        return res.json({ success: true, caption: generatedText, provider: 'gemini' });
      }
    }

    // Dynamic smart fallback
    const topicText = topic ? topic.trim() : 'vibes';
    const fallbackCaptions = [
      `Wait until the end for this one! 🤯✨ Best moment of the week. #${topicText.replace(/\s+/g, '')} #viral #fyp #pulse #trending`,
      `Couldn't keep this to myself 👀⚡️ Who else relates to this? #${topicText.replace(/\s+/g, '')} #explore #aesthetic #pulse #foryou`,
      `POV: You unlocked the next level 🚀 Drop a 🔥 if you agree! #${topicText.replace(/\s+/g, '')} #creator #viralvideo #pulse`
    ];
    const picked = fallbackCaptions[Math.floor(Math.random() * fallbackCaptions.length)];
    return res.json({ success: true, caption: picked, isFallback: true });
  } catch (err: any) {
    console.error('Caption generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate caption' });
  }
}

// Handler for AI Hashtag Suggestions (Using Groq)
async function handleSuggestTags(req: express.Request, res: express.Response) {
  try {
    const { caption, category } = req.body;
    const groq = getGroqClient();

    if (groq && caption) {
      try {
        const completion = await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: 'You are a viral social media assistant. Return ONLY a valid JSON array of 6 lowercase viral hashtag strings without the # symbol, e.g. ["viral", "dance", "tech", "fyp", "trending", "explore"]. No explanations or markdown.'
            },
            {
              role: 'user',
              content: `Suggest 6 viral hashtags for this video caption: "${caption}"`
            }
          ],
          temperature: 0.7,
          max_tokens: 150
        });

        const raw = completion.choices[0]?.message?.content?.trim() || '';
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.json({ success: true, tags: parsed.map((t: string) => String(t).replace(/^#/, '').toLowerCase().trim()), provider: 'groq' });
        }
      } catch (e) {
        console.warn('Groq tag parsing error, falling back:', e);
      }
    }

    const defaults = ['fyp', 'viral', 'pulse', 'trending', 'creator', 'aesthetic'];
    res.json({ success: true, tags: defaults });
  } catch (err: any) {
    console.error('Tag suggestions error:', err);
    res.json({ success: true, tags: ['fyp', 'viral', 'trending'] });
  }
}

// AI Endpoints with Groq Support and backward compatibility
app.post('/api/groq/generate-caption', handleGenerateCaption);
app.post('/api/gemini/generate-caption', handleGenerateCaption);
app.post('/api/ai/generate-caption', handleGenerateCaption);

app.post('/api/groq/suggest-tags', handleSuggestTags);
app.post('/api/gemini/suggest-tags', handleSuggestTags);
app.post('/api/ai/suggest-tags', handleSuggestTags);

// Telegram Appeal Notification API (Triggered when user submits appeal on web app)
app.post('/api/telegram/appeal', async (req, res) => {
  try {
    const { appealId, uid, username, handle, email, reason, appealText, contactInfo } = req.body;

    const appealAlert = `
🚨 <b>NEW BAN APPEAL SUBMITTED ON PULSE</b>
━━━━━━━━━━━━━━━━━━━━
👤 <b>Creator:</b> ${handle || '@' + username} (${username})
📧 <b>Email:</b> ${email || 'N/A'}
🆔 <b>User UID:</b> <code>${uid}</code>
📜 <b>Appeal ID:</b> <code>${appealId}</code>
📞 <b>Contact / Telegram:</b> ${contactInfo || 'N/A'}

⚠️ <b>Original Ban Reason:</b>
"${reason || 'Suspended by admin'}"

📝 <b>Appeal Statement:</b>
<i>"${appealText}"</i>
━━━━━━━━━━━━━━━━━━━━
⚡️ <b>Quick Admin Commands:</b>
• Approve & Unban: <code>/approve_appeal ${appealId}</code>
• Reject Appeal: <code>/reject_appeal ${appealId}</code>
• Direct Unban: <code>/unban ${handle || uid}</code>
    `;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve & Unban', callback_data: `approve_appeal_${appealId}` },
          { text: '🔓 Direct Unban', callback_data: `unban_${uid}` }
        ]
      ]
    };

    await notifyTelegramAdmin(appealAlert, inlineKeyboard);
    res.json({ success: true, message: 'Appeal dispatched to Telegram bot' });
  } catch (err: any) {
    console.error('Error handling appeal webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// Telegram Report Notification API (Triggered when user reports video/user/comment)
app.post('/api/telegram/report', async (req, res) => {
  try {
    const { reportId, type, targetId, targetHandle, reason, details, reporterHandle } = req.body;

    const reportAlert = `
🚨 <b>NEW SAFETY REPORT SUBMITTED ON PULSE</b>
━━━━━━━━━━━━━━━━━━━━
📂 <b>Type:</b> ${type.toUpperCase()}
🎯 <b>Target:</b> ${targetHandle || targetId}
🆔 <b>Report ID:</b> <code>${reportId}</code>
👤 <b>Reporter:</b> ${reporterHandle}
⚠️ <b>Reason:</b> ${reason}
💬 <b>Details:</b> <i>"${details || 'No additional details provided'}"</i>
━━━━━━━━━━━━━━━━━━━━
⚡️ <b>Quick Admin Action:</b>
• Resolve: <code>/resolve_report ${reportId}</code>
• Lookup User: <code>/lookup ${targetHandle || targetId}</code>
• Ban: <code>/ban ${targetHandle || targetId}</code>
    `;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Resolve Report', callback_data: `resolve_report_${reportId}` },
          { text: '🚫 Ban Target', callback_data: `ban_${targetId}` }
        ]
      ]
    };

    await notifyTelegramAdmin(reportAlert, inlineKeyboard);
    res.json({ success: true, message: 'Report dispatched to Telegram bot' });
  } catch (err: any) {
    console.error('Error handling report webhook:', err);
    res.status(500).json({ error: err.message });
  }
});

// Purge / Clean fake accounts endpoint & startup routine
async function cleanDatabaseOfFakeAccounts() {
  try {
    const FAKE_SEED_DOC_IDS = [
      'uid_elena_vance', 'uid_alex_dance', 'uid_chef_marco', 'uid_travel_maya',
      'uid_tech_sophia', 'uid_fitness_kai', 'uid_dj_neon', 'uid_alex_rivera',
      'uid_maya_dance', 'the_amala_joint', 'pulse_official', 'sug_1', 'sug_2', 'sug_3',
      'seed_skate_1', 'seed_dance_2', 'seed_food_3', 'seed_travel_4', 'seed_tech_5',
      'seed_fitness_6', 'seed_dj_7', 'seed_comedy_8', 'upcoming_1', 'upcoming_2', 'upcoming_3',
      'replay_1', 'replay_2', 'replay_3', 'live_active_demo_1', 'live_active_demo_2'
    ];

    for (const id of FAKE_SEED_DOC_IDS) {
      try { await deleteDoc(doc(db, 'users', id)); } catch (e) {}
      try { await deleteDoc(doc(db, 'videos', id)); } catch (e) {}
    }

    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
      const u = d.data();
      const isOwnerAccount = (u.email && u.email.toLowerCase() === 'mrnovatech4@gmail.com') ||
                             (u.handle && u.handle.toLowerCase() === '@mrnovatech') ||
                             d.id === 'uid_owner_mrnovatech' ||
                             d.id === 'owner_mrnovatech';
      const isFakeEmail = [
        'elena@pulse.social', 'alex@pulse.social', 'marco@pulse.social', 
        'maya@pulse.social', 'sophia@pulse.social', 'kai@pulse.social', 'djneon@pulse.social',
        'elena@pulse.video', 'alex@pulse.video', 'marco@pulse.video', 'maya@pulse.video'
      ].includes(u.email || '');

      if (!isOwnerAccount && isFakeEmail) {
        await deleteDoc(doc(db, 'users', d.id));
      }
    }

    // Clean up any remaining legacy fake accounts
    try {
      await deleteDoc(doc(db, 'users', 'uid_owner_mrnovatech'));
      await deleteDoc(doc(db, 'users', 'owner_mrnovatech'));
    } catch (e) {}

    console.log('⚡️ Database purge completed: Only real Firebase users active.');
  } catch (err) {
    console.warn('Database cleanup notice:', err);
  }
}

app.post('/api/admin/clean-database', async (req, res) => {
  try {
    await cleanDatabaseOfFakeAccounts();
    res.json({ success: true, message: 'Database cleaned. All fake accounts removed and admin account preserved.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin stats endpoint
app.get('/api/admin/stats', async (req, res) => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const videosSnap = await getDocs(collection(db, 'videos'));
    const appealsSnap = await getDocs(query(collection(db, 'appeals'), where('status', '==', 'pending')));

    let totalUsers = 0;
    let verifiedUsers = 0;
    let bannedUsers = 0;

    usersSnap.forEach((d) => {
      totalUsers++;
      const data = d.data();
      if (data.verified) verifiedUsers++;
      if (data.banned) bannedUsers++;
    });

    res.json({
      totalUsers,
      totalVideos: videosSnap.size,
      verifiedUsers,
      bannedUsers,
      pendingAppeals: appealsSnap.size,
      telegramBotActive: true
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// VITE / STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  // Purge any seed/fake documents and verify admin account
  cleanDatabaseOfFakeAccounts().catch((e) => console.warn('Purge warning:', e));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡️ Pulse server running on http://0.0.0.0:${PORT}`);
    console.log(`🤖 Telegram Central Admin Bot initialized: @nova_tech_1`);
  });
}

startServer();
