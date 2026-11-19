import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import {
  findMatchingActiveCode,
  generateAccessCode,
  validateAccessCodeFormat,
  validatePlayerDisplayName,
} from './src/game/accessCodes';
import { createStarterLevels, generateReadyMadeBatch } from './src/game/curatedLevels';
import { solveCustomLevel, validateCustomLevel } from './src/game/flowEngine';
import { calculateStars, calculateXpAward, sortLeaderboard } from './src/game/skillSystem';
import type {
  AccessCodeRecord,
  ColorPair,
  CompletionRecord,
  Difficulty,
  FlowLevel,
  FlowPaths,
  LeaderboardEntry,
  UserProfile,
} from './src/game/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDbPaths() {
  const isVercel = Boolean(process.env.VERCEL || process.env.LAMBDA_TASK_ROOT);
  const dataDir = isVercel ? '/tmp' : path.resolve(__dirname, 'data');
  const dbPath = path.join(dataDir, 'game-db.json');

  if (isVercel && !fs.existsSync(dbPath)) {
    const seedCandidates = [
      path.join(process.cwd(), 'data', 'game-db.json'),
      path.join(__dirname, 'data', 'game-db.json'),
      path.join(__dirname, '..', 'data', 'game-db.json'),
    ];
    for (const seed of seedCandidates) {
      if (fs.existsSync(seed)) {
        try {
          fs.copyFileSync(seed, dbPath);
          break;
        } catch {}
      }
    }
  }

  return { dataDir, dbPath };
}

interface StoredUser {
  id: string;
  username: string;
  usernameLower: string;
  passwordSalt: string;
  passwordHash: string;
  role: 'player' | 'admin';
  joinedWithCode?: string;
  skillXp: number;
  streak: number;
  hintCharges: number;
  completions: Record<string, CompletionRecord>;
  createdAt: string;
}

interface DatabaseSchema {
  sessionSecret: string;
  users: StoredUser[];
  levels: FlowLevel[];
  accessCodes: AccessCodeRecord[];
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

function createInitialDatabase(): DatabaseSchema {
  const levels = createStarterLevels().map((lvl) => ({
    ...lvl,
    isActive: true,
    firstClearedBy: null as string | null,
    firstClearedAt: null as string | null,
    clearCount: 0,
  }));

  const adminCreds = hashPassword('admin123');
  const demoCreds = hashPassword('123456');
  const now = Date.now();

  const saraCompletions: Record<string, CompletionRecord> = {
    'easy-1': {
      levelId: 'easy-1',
      difficulty: 'easy',
      bestMoves: 4,
      bestTimeSec: 18,
      stars: 3,
      xpEarned: 185,
      completedAt: new Date(now - 3600_000 * 6).toISOString(),
      isFirstGlobalClear: true,
    },
    'easy-2': {
      levelId: 'easy-2',
      difficulty: 'easy',
      bestMoves: 6,
      bestTimeSec: 26,
      stars: 3,
      xpEarned: 200,
      completedAt: new Date(now - 3600_000 * 5).toISOString(),
      isFirstGlobalClear: true,
    },
    'medium-1': {
      levelId: 'medium-1',
      difficulty: 'medium',
      bestMoves: 8,
      bestTimeSec: 54,
      stars: 3,
      xpEarned: 395,
      completedAt: new Date(now - 3600_000 * 4).toISOString(),
      isFirstGlobalClear: true,
    },
  };

  const aramCompletions: Record<string, CompletionRecord> = {
    'easy-1': {
      levelId: 'easy-1',
      difficulty: 'easy',
      bestMoves: 5,
      bestTimeSec: 22,
      stars: 3,
      xpEarned: 185,
      completedAt: new Date(now - 3600_000 * 3).toISOString(),
    },
    'easy-3': {
      levelId: 'easy-3',
      difficulty: 'easy',
      bestMoves: 7,
      bestTimeSec: 34,
      stars: 2,
      xpEarned: 170,
      completedAt: new Date(now - 3600_000 * 2).toISOString(),
      isFirstGlobalClear: true,
    },
  };

  const karzanCompletions: Record<string, CompletionRecord> = {
    'easy-2': {
      levelId: 'easy-2',
      difficulty: 'easy',
      bestMoves: 7,
      bestTimeSec: 31,
      stars: 2,
      xpEarned: 155,
      completedAt: new Date(now - 3600_000 * 1).toISOString(),
    },
  };

  // Mark seeded first-clear records on levels
  const setFirst = (id: string, username: string, at: string, count: number) => {
    const found = levels.find((l) => l.id === id);
    if (found) {
      found.firstClearedBy = username;
      found.firstClearedAt = at;
      found.clearCount = count;
    }
  };
  setFirst('easy-1', 'سارا', saraCompletions['easy-1'].completedAt, 2);
  setFirst('easy-2', 'سارا', saraCompletions['easy-2'].completedAt, 2);
  setFirst('easy-3', 'ئارام', aramCompletions['easy-3'].completedAt, 1);
  setFirst('medium-1', 'سارا', saraCompletions['medium-1'].completedAt, 1);

  const users: StoredUser[] = [
    {
      id: 'user-admin',
      username: 'admin',
      usernameLower: 'admin',
      passwordSalt: adminCreds.salt,
      passwordHash: adminCreds.hash,
      role: 'admin',
      skillXp: 420,
      streak: 2,
      hintCharges: 9,
      completions: {},
      createdAt: new Date(now - 86400_000 * 7).toISOString(),
    },
    {
      id: 'user-sara',
      username: 'سارا',
      usernameLower: 'سارا',
      passwordSalt: demoCreds.salt,
      passwordHash: demoCreds.hash,
      role: 'player',
      skillXp: 780,
      streak: 3,
      hintCharges: 5,
      completions: saraCompletions,
      createdAt: new Date(now - 86400_000 * 3).toISOString(),
    },
    {
      id: 'user-aram',
      username: 'ئارام',
      usernameLower: 'ئارام',
      passwordSalt: demoCreds.salt,
      passwordHash: demoCreds.hash,
      role: 'player',
      skillXp: 355,
      streak: 2,
      hintCharges: 4,
      completions: aramCompletions,
      createdAt: new Date(now - 86400_000 * 2).toISOString(),
    },
    {
      id: 'user-karzan',
      username: 'کارزان',
      usernameLower: 'کارزان',
      passwordSalt: demoCreds.salt,
      passwordHash: demoCreds.hash,
      role: 'player',
      skillXp: 155,
      streak: 1,
      hintCharges: 3,
      completions: karzanCompletions,
      createdAt: new Date(now - 86400_000 * 1).toISOString(),
    },
  ];

  const accessCodes: AccessCodeRecord[] = [
    {
      id: 'code-default',
      code: 'FLOW-2026',
      label: 'کۆدی گشتی سەرەتایی',
      isActive: true,
      usageCount: 3,
      createdAt: new Date(now - 86400_000 * 7).toISOString(),
    },
  ];

  return {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    users,
    levels,
    accessCodes,
  };
}

let dbCache: DatabaseSchema | null = null;

function loadDb(): DatabaseSchema {
  if (dbCache) return dbCache;
  const { dataDir, dbPath } = getDbPaths();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.levels) && parsed.sessionSecret) {
        let migrated = false;
        if (!Array.isArray(parsed.accessCodes) || parsed.accessCodes.length === 0) {
          parsed.accessCodes = [
            {
              id: 'code-default',
              code: 'FLOW-2026',
              label: 'کۆدی گشتی سەرەتایی',
              isActive: true,
              usageCount: 0,
              createdAt: new Date().toISOString(),
            },
          ];
          migrated = true;
        }
        // Merge any newly added starter levels into existing DB without overwriting user progress
        const existingIds = new Set(parsed.levels.map((l) => l.id));
        const starterPack = createStarterLevels();
        for (const lvl of starterPack) {
          if (!existingIds.has(lvl.id)) {
            parsed.levels.push({
              ...lvl,
              isActive: true,
              firstClearedBy: null,
              firstClearedAt: null,
              clearCount: 0,
            });
            migrated = true;
          }
        }
        if (migrated) {
          saveDb(parsed as DatabaseSchema);
        }
        dbCache = parsed as DatabaseSchema;
        return dbCache;
      }
    } catch {
      // Fall through to seed fresh DB
    }
  }
  dbCache = createInitialDatabase();
  saveDb(dbCache);
  return dbCache;
}

function saveDb(db: DatabaseSchema): void {
  const { dataDir, dbPath } = getDbPaths();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const suffix = crypto.randomBytes(4).toString('hex');
  const tmpPath = `${dbPath}.${process.pid}.${suffix}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, dbPath);
}

interface TokenPayload {
  userId: string;
  username: string;
  role: 'player' | 'admin';
  iat: number;
}

function signToken(payload: TokenPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string, secret: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as TokenPayload;
  } catch {
    return null;
  }
}

function toPublicUser(user: StoredUser): UserProfile {
  const records = Object.values(user.completions);
  const totalStars = records.reduce((sum, r) => sum + r.stars, 0);
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    joinedWithCode: user.joinedWithCode,
    skillXp: user.skillXp,
    streak: user.streak,
    hintCharges: user.hintCharges,
    completedCount: records.length,
    totalStars,
    completions: user.completions,
    createdAt: user.createdAt,
  };
}

function buildLeaderboard(db: DatabaseSchema): LeaderboardEntry[] {
  const raw = db.users
    .filter((u) => u.role === 'player' || Object.keys(u.completions).length > 0)
    .map((u) => {
      const records = Object.values(u.completions);
      let easyCount = 0;
      let mediumCount = 0;
      let hardCount = 0;
      let totalStars = 0;
      let firstClears = 0;
      let totalBestTimeSec = 0;
      let lastCompletedAt: string | null = null;

      for (const r of records) {
        if (r.difficulty === 'easy') easyCount++;
        else if (r.difficulty === 'medium') mediumCount++;
        else if (r.difficulty === 'hard') hardCount++;
        totalStars += r.stars;
        if (r.isFirstGlobalClear) firstClears++;
        totalBestTimeSec += r.bestTimeSec;
        if (!lastCompletedAt || r.completedAt > lastCompletedAt) {
          lastCompletedAt = r.completedAt;
        }
      }

      return {
        userId: u.id,
        username: u.username,
        role: u.role,
        completedCount: records.length,
        easyCount,
        mediumCount,
        hardCount,
        skillXp: u.skillXp,
        totalStars,
        firstClears,
        totalBestTimeSec,
        lastCompletedAt,
      };
    });

  return sortLeaderboard(raw);
}

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

function attachAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    const db = loadDb();
    const payload = verifyToken(token, db.sessionSecret);
    if (payload) {
      const user = db.users.find((u) => u.id === payload.userId);
      if (user) {
        req.authUser = user;
      }
    }
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'تکایە سەرەتا بچۆ ژوورەوە.' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.role !== 'admin') {
    res.status(403).json({ error: 'تەنها ئەدمین دەسەڵاتی ئەم کارەی هەیە.' });
    return;
  }
  next();
}

export async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(attachAuth);

  // Real-time Server-Sent Events (SSE) subscribers for instant live sync across all connected players
  const sseClients = new Set<Response>();
  const broadcastEvent = (eventName: string, payload: Record<string, unknown>) => {
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  const heartbeatInterval = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': ping\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 25000);
  heartbeatInterval.unref?.();

  // Health
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Real-time SSE stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Public registration disabled: players must enter using an Admin access code
  app.post('/api/auth/register', (_req, res) => {
    res.status(403).json({
      error: 'تۆمارکردن بە وشەی نهێنی داخراوە. تکایە بە کۆدی چوونەژوورەوە و ناوی خۆت بچۆ ژوورەوە.',
    });
  });

  // Player entry via Access Code + Display Name
  app.post('/api/auth/join-code', (req, res) => {
    const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
    const rawName = typeof req.body?.playerName === 'string' ? req.body.playerName : '';

    const nameCheck = validatePlayerDisplayName(rawName);
    if (!nameCheck.valid) {
      res.status(400).json({ error: nameCheck.errorKu });
      return;
    }

    const db = loadDb();
    const matchedCode = findMatchingActiveCode(db.accessCodes, rawCode);
    if (!matchedCode) {
      res.status(401).json({ error: 'کۆدی چوونەژوورەوە هەڵەیە یان ناچالاک کراوە.' });
      return;
    }

    const lower = nameCheck.name.toLowerCase();
    if (db.users.some((u) => u.usernameLower === lower)) {
      res.status(409).json({
        error: 'ئەم ناوە پێشتر تۆمارکراوە لە لیستی یەکەمینەکان. تکایە ناوێکی جیاواز هەڵبژێرە.',
      });
      return;
    }

    // Random unguessable secret stored so code-only players can never use Admin password login
    const lockedCreds = hashPassword(crypto.randomBytes(24).toString('hex'));
    const newPlayer: StoredUser = {
      id: `user-${crypto.randomUUID().slice(0, 8)}`,
      username: nameCheck.name,
      usernameLower: lower,
      passwordSalt: lockedCreds.salt,
      passwordHash: lockedCreds.hash,
      role: 'player',
      joinedWithCode: matchedCode.code,
      skillXp: 0,
      streak: 0,
      hintCharges: 3,
      completions: {},
      createdAt: new Date().toISOString(),
    };

    matchedCode.usageCount += 1;
    db.users.push(newPlayer);
    saveDb(db);

    const token = signToken(
      { userId: newPlayer.id, username: newPlayer.username, role: newPlayer.role, iat: Date.now() },
      db.sessionSecret
    );

    const leaderboard = buildLeaderboard(db);
    broadcastEvent('leaderboard:updated', { username: newPlayer.username });

    res.status(201).json({
      token,
      user: toPublicUser(newPlayer),
      leaderboard,
    });
  });

  // Admin-Only Login (Username & Password)
  app.post('/api/auth/login', (req, res) => {
    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawUsername || !password) {
      res.status(400).json({ error: 'تکایە ناوی بەکارهێنەر و وشەی نهێنی ئەدمین بنووسە.' });
      return;
    }

    const db = loadDb();
    const user = db.users.find((u) => u.usernameLower === rawUsername.toLowerCase());
    if (!user || user.role !== 'admin') {
      res.status(403).json({
        error: 'تەنها ئەدمین دەتوانێت لێرەوە بچێتە ژوورەوە. یاریزانان تکایە بە کۆد بچنە ژوورەوە.',
      });
      return;
    }

    if (!verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      res.status(401).json({ error: 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە.' });
      return;
    }

    const token = signToken(
      { userId: user.id, username: user.username, role: user.role, iat: Date.now() },
      db.sessionSecret
    );

    res.json({
      token,
      user: toPublicUser(user),
    });
  });

  // Current user profile
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: toPublicUser(req.authUser!) });
  });

  // Get levels
  app.get('/api/levels', (req: AuthedRequest, res) => {
    const db = loadDb();
    const isAdmin = req.authUser?.role === 'admin';
    const levels = isAdmin ? db.levels : db.levels.filter((l) => l.isActive !== false);
    res.json({ levels });
  });

  // Record a completed Flow Free level
  app.post('/api/completions', requireAuth, (req: AuthedRequest, res) => {
    const levelId = typeof req.body?.levelId === 'string' ? req.body.levelId : '';
    const moves = Number(req.body?.moves);
    const timeSec = Math.max(1, Math.round(Number(req.body?.timeSec) || 1));
    const hintsUsed = Math.max(0, Math.round(Number(req.body?.hintsUsed) || 0));

    const db = loadDb();
    const level = db.levels.find((l) => l.id === levelId);
    if (!level) {
      res.status(404).json({ error: 'قۆناغەکە نەدۆزرایەوە.' });
      return;
    }
    if (!Number.isFinite(moves) || moves < 1) {
      res.status(400).json({ error: 'ژمارەی جوڵەکان دروست نییە.' });
      return;
    }

    const user = req.authUser!;
    const stars = calculateStars(moves, level.pairs.length, hintsUsed);
    const existing = user.completions[level.id];
    const isNewCompletion = !existing;
    let isFirstGlobalClear = false;

    if (!level.firstClearedBy) {
      level.firstClearedBy = user.username;
      level.firstClearedAt = new Date().toISOString();
      isFirstGlobalClear = true;
    }
    if (isNewCompletion) {
      level.clearCount = (level.clearCount ?? 0) + 1;
      user.streak += 1;
    }

    const rawXp = calculateXpAward({
      difficulty: level.difficulty,
      stars,
      timeSec,
      streak: user.streak,
      isFirstGlobalClear,
    });

    let xpDelta = 0;
    if (isNewCompletion) {
      xpDelta = rawXp;
      user.completions[level.id] = {
        levelId: level.id,
        difficulty: level.difficulty,
        bestMoves: moves,
        bestTimeSec: timeSec,
        stars,
        xpEarned: rawXp,
        completedAt: new Date().toISOString(),
        isFirstGlobalClear,
      };
    } else {
      const improvedStars = Math.max(existing.stars, stars);
      const improvedMoves = Math.min(existing.bestMoves, moves);
      const improvedTime = Math.min(existing.bestTimeSec, timeSec);
      if (rawXp > existing.xpEarned) {
        xpDelta = rawXp - existing.xpEarned;
      } else {
        xpDelta = 20; // Small practice mastery XP on replay
      }
      user.completions[level.id] = {
        ...existing,
        bestMoves: improvedMoves,
        bestTimeSec: improvedTime,
        stars: improvedStars,
        xpEarned: Math.max(existing.xpEarned, rawXp),
      };
    }

    user.skillXp += xpDelta;
    if (hintsUsed === 0 && user.hintCharges < 9) {
      user.hintCharges += 1;
    } else if (hintsUsed > 0) {
      user.hintCharges = Math.max(1, user.hintCharges - hintsUsed);
    }

    saveDb(db);

    const leaderboard = buildLeaderboard(db);
    broadcastEvent('leaderboard:updated', { username: user.username, levelId: level.id });

    res.json({
      user: toPublicUser(user),
      levels: user.role === 'admin' ? db.levels : db.levels.filter((l) => l.isActive !== false),
      leaderboard,
      award: {
        stars,
        xpAwarded: xpDelta,
        isNewCompletion,
        isFirstGlobalClear,
        streak: user.streak,
      },
    });
  });

  // Leaderboard
  app.get('/api/leaderboard', (_req, res) => {
    const db = loadDb();
    res.json({ leaderboard: buildLeaderboard(db) });
  });

  // Admin: Create custom Flow Free level
  app.post('/api/admin/levels', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const difficulty = req.body?.difficulty as Difficulty;
    const gridSize = Number(req.body?.gridSize);
    const pairs = req.body?.pairs as ColorPair[];
    let solutionPaths = req.body?.solutionPaths as FlowPaths | undefined;

    if (!title || title.length < 2 || title.length > 48) {
      res.status(400).json({ error: 'ناونیشانی قۆناغ دەبێت لە نێوان ٢ بۆ ٤٨ پیت بێت.' });
      return;
    }
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      res.status(400).json({ error: 'ئاستی قورسی دروست هەڵبژێرە (ئاسان، مامناوەند، قورس).' });
      return;
    }

    if (!Array.isArray(pairs)) {
      res.status(400).json({ error: 'خاڵەکانی قۆناغەکە دروست نین.' });
      return;
    }

    const validation = validateCustomLevel(gridSize, pairs);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errorKu ?? 'قۆناغەکە دروست نییە.' });
      return;
    }

    // If Admin manually placed nodes without solutionPaths, attempt quick solver for hints
    if (!solutionPaths && gridSize <= 7) {
      const solved = solveCustomLevel(gridSize, pairs, 30000);
      if (solved.solvable && solved.solutionPaths) {
        solutionPaths = solved.solutionPaths;
      }
    }

    const db = loadDb();
    const newLevel: FlowLevel = {
      id: `custom-${crypto.randomUUID().slice(0, 8)}`,
      title,
      difficulty,
      gridSize,
      pairs,
      solutionPaths,
      isCustom: true,
      isActive: true,
      createdBy: req.authUser!.username,
      createdAt: new Date().toISOString(),
      firstClearedBy: null,
      firstClearedAt: null,
      clearCount: 0,
    };

    db.levels.push(newLevel);
    saveDb(db);
    broadcastEvent('levels:created', {
      count: 1,
      levelId: newLevel.id,
      title: newLevel.title,
      difficulty: newLevel.difficulty,
    });

    res.status(201).json({
      level: newLevel,
      levels: db.levels,
    });
  });

  // Admin: One-click Ready-Made Batch Pack Generator (+5 / +10 / +20 / +30 puzzles)
  app.post('/api/admin/levels/batch', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const difficulty = req.body?.difficulty as Difficulty | 'mixed';
    const count = Math.max(1, Math.min(30, Math.round(Number(req.body?.count) || 10)));

    if (!['easy', 'medium', 'hard', 'mixed'].includes(difficulty)) {
      res.status(400).json({ error: 'ئاستی قورسی دروست هەڵبژێرە.' });
      return;
    }

    const db = loadDb();
    const existingCountByDifficulty: Record<Difficulty, number> = {
      easy: db.levels.filter((l) => l.difficulty === 'easy').length,
      medium: db.levels.filter((l) => l.difficulty === 'medium').length,
      hard: db.levels.filter((l) => l.difficulty === 'hard').length,
    };

    const addedLevels = generateReadyMadeBatch({
      difficulty,
      count,
      existingCountByDifficulty,
      createdBy: req.authUser!.username,
    });

    db.levels.push(...addedLevels);
    saveDb(db);
    broadcastEvent('levels:created', {
      count: addedLevels.length,
      levelId: addedLevels[0]?.id ?? null,
      title: addedLevels[0]?.title ?? '',
      difficulty,
    });

    res.status(201).json({
      addedCount: addedLevels.length,
      addedLevels,
      levels: db.levels,
    });
  });

  // Admin: Update level difficulty / title / active state
  app.patch('/api/admin/levels/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDb();
    const level = db.levels.find((l) => l.id === req.params.id);
    if (!level) {
      res.status(404).json({ error: 'قۆناغەکە نەدۆزرایەوە.' });
      return;
    }

    if (typeof req.body?.title === 'string' && req.body.title.trim().length >= 2) {
      level.title = req.body.title.trim().slice(0, 48);
    }
    if (['easy', 'medium', 'hard'].includes(req.body?.difficulty)) {
      level.difficulty = req.body.difficulty as Difficulty;
    }
    if (typeof req.body?.isActive === 'boolean') {
      if (!req.body.isActive && level.isActive !== false) {
        const remainingActive = db.levels.filter((l) => l.id !== level.id && l.isActive !== false).length;
        if (remainingActive < 1) {
          res.status(400).json({ error: 'دەبێت لانیکەم یەک قۆناغی چالاک بمێنێتەوە.' });
          return;
        }
      }
      level.isActive = req.body.isActive;
    }

    saveDb(db);
    broadcastEvent('levels:updated', { levelId: level.id });
    res.json({ level, levels: db.levels });
  });

  // Admin: Delete level
  app.delete('/api/admin/levels/:id', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const db = loadDb();
    const idx = db.levels.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'قۆناغەکە نەدۆزرایەوە.' });
      return;
    }
    const target = db.levels[idx];
    const remainingActive = db.levels.filter((l) => l.id !== target.id && l.isActive !== false).length;
    if (db.levels.length <= 1 || remainingActive < 1) {
      res.status(400).json({ error: 'نابێت دوایین قۆناغی چالاک بسڕیتەوە.' });
      return;
    }

    db.levels.splice(idx, 1);
    saveDb(db);
    broadcastEvent('levels:deleted', { levelId: target.id });
    res.json({ levels: db.levels });
  });

  // Admin: List access codes
  app.get('/api/admin/codes', requireAuth, requireAdmin, (_req, res) => {
    const db = loadDb();
    res.json({ codes: db.accessCodes });
  });

  // Admin: Create new access code (custom or auto-generated)
  app.post('/api/admin/codes', requireAuth, requireAdmin, (req, res) => {
    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const rawLabel = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 48) : '';
    const db = loadDb();

    let finalCode = '';
    if (rawCode) {
      const check = validateAccessCodeFormat(rawCode);
      if (!check.valid) {
        res.status(400).json({ error: check.errorKu });
        return;
      }
      finalCode = check.normalized;
    } else {
      for (let i = 0; i < 10; i++) {
        const candidate = generateAccessCode('FLOW');
        if (!db.accessCodes.some((c) => c.code === candidate)) {
          finalCode = candidate;
          break;
        }
      }
    }

    if (!finalCode || db.accessCodes.some((c) => c.code === finalCode)) {
      res.status(409).json({ error: 'ئەم کۆدە پێشتر دروستکراوە؛ کۆدێکی تر بنووسە.' });
      return;
    }

    const record: AccessCodeRecord = {
      id: `code-${crypto.randomUUID().slice(0, 8)}`,
      code: finalCode,
      label: rawLabel || 'کۆدی یاریزانان',
      isActive: true,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };

    db.accessCodes.unshift(record);
    saveDb(db);
    res.status(201).json({ codeRecord: record, codes: db.accessCodes });
  });

  // Admin: Toggle or rename access code
  app.patch('/api/admin/codes/:id', requireAuth, requireAdmin, (req, res) => {
    const db = loadDb();
    const record = db.accessCodes.find((c) => c.id === req.params.id);
    if (!record) {
      res.status(404).json({ error: 'کۆدەکە نەدۆزرایەوە.' });
      return;
    }
    if (typeof req.body?.isActive === 'boolean') {
      record.isActive = req.body.isActive;
    }
    if (typeof req.body?.label === 'string') {
      record.label = req.body.label.trim().slice(0, 48) || record.label;
    }
    saveDb(db);
    res.json({ codeRecord: record, codes: db.accessCodes });
  });

  // Admin: Delete access code
  app.delete('/api/admin/codes/:id', requireAuth, requireAdmin, (req, res) => {
    const db = loadDb();
    const idx = db.accessCodes.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'کۆدەکە نەدۆزرایەوە.' });
      return;
    }
    db.accessCodes.splice(idx, 1);
    saveDb(db);
    res.json({ codes: db.accessCodes });
  });

  // Admin: Change own password
  app.post('/api/admin/change-password', requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (newPassword.length < 4 || newPassword.length > 64) {
      res.status(400).json({ error: 'وشەی نهێنی نوێ دەبێت لانیکەم ٤ پیت یان ژمارە بێت.' });
      return;
    }

    const db = loadDb();
    const admin = req.authUser!;
    if (!verifyPassword(currentPassword, admin.passwordSalt, admin.passwordHash)) {
      res.status(401).json({ error: 'وشەی نهێنی ئێستا هەڵەیە.' });
      return;
    }

    const updated = hashPassword(newPassword);
    admin.passwordSalt = updated.salt;
    admin.passwordHash = updated.hash;
    saveDb(db);
    res.json({ ok: true });
  });

  // JSON 404 for unknown API paths
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'داواکارییەکە نەدۆزرایەوە.' });
  });

  // Express error middleware (handles malformed JSON & unexpected server exceptions cleanly)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isSyntaxErr = err instanceof SyntaxError && 'status' in err;
    if (isSyntaxErr) {
      res.status(400).json({ error: 'داتای نێردراو دروست نییە.' });
      return;
    }
    console.error('Unhandled API error:', err);
    res.status(500).json({ error: 'هەڵەیەکی کاتی لە سێرڤەر ڕوویدا، تکایە دووبارە هەوڵبدەرەوە.' });
  });

  // Frontend serving (Vite dev middleware vs production dist)
  if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(__dirname, 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return app;
}

export async function startServer() {
  const app = await createApp();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Flow Free Arena server running at http://localhost:${port}`);
  });
}

if (!process.env.VERCEL && !process.env.LAMBDA_TASK_ROOT) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
