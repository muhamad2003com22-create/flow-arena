import type { Difficulty, LeaderboardEntry } from './types';

export interface SkillRank {
  id: string;
  nameKu: string;
  minXp: number;
  color: string;
}

export const SKILL_RANKS: SkillRank[] = [
  { id: 'novice', nameKu: 'سەرەتایی', minXp: 0, color: '#94A3B8' },
  { id: 'apprentice', nameKu: 'پێشکەوتوو', minXp: 250, color: '#10B981' },
  { id: 'skilled', nameKu: 'شارەزا', minXp: 650, color: '#3B82F6' },
  { id: 'master', nameKu: 'مامۆستا', minXp: 1300, color: '#A855F7' },
  { id: 'legend', nameKu: 'ئەفسانە', minXp: 2400, color: '#E5A93C' },
];

export interface SkillRankProgress {
  current: SkillRank;
  next: SkillRank | null;
  progressPercent: number;
  xpToNext: number;
}

export function getSkillRank(xp: number): SkillRankProgress {
  const safeXp = Math.max(0, Math.round(xp));
  let currentIndex = 0;
  for (let i = 0; i < SKILL_RANKS.length; i++) {
    if (safeXp >= SKILL_RANKS[i].minXp) {
      currentIndex = i;
    }
  }
  const current = SKILL_RANKS[currentIndex];
  const next = currentIndex < SKILL_RANKS.length - 1 ? SKILL_RANKS[currentIndex + 1] : null;

  if (!next) {
    return {
      current,
      next: null,
      progressPercent: 100,
      xpToNext: 0,
    };
  }

  const span = next.minXp - current.minXp;
  const gained = safeXp - current.minXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((gained / span) * 100)));

  return {
    current,
    next,
    progressPercent,
    xpToNext: Math.max(0, next.minXp - safeXp),
  };
}

export function calculateStars(moves: number, pairCount: number, hintsUsed: number): number {
  const optimal = Math.max(1, pairCount);
  if (hintsUsed === 0 && moves <= optimal + 2) {
    return 3;
  }
  if (hintsUsed <= 1 && moves <= optimal * 2 + 2) {
    return 2;
  }
  return 1;
}

const BASE_XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 100,
  medium: 220,
  hard: 400,
};

export function calculateXpAward(params: {
  difficulty: Difficulty;
  stars: number;
  timeSec: number;
  streak: number;
  isFirstGlobalClear: boolean;
}): number {
  const base = BASE_XP_BY_DIFFICULTY[params.difficulty];
  const starMultiplier = params.stars === 3 ? 1.5 : params.stars === 2 ? 1.2 : 1.0;
  const streakBonus = Math.min(100, Math.max(0, params.streak) * 15);
  const speedTarget = params.difficulty === 'easy' ? 35 : params.difficulty === 'medium' ? 75 : 140;
  const speedBonus = params.timeSec > 0 && params.timeSec <= speedTarget ? 35 : 0;
  const firstClearBonus = params.isFirstGlobalClear ? 75 : 0;

  return Math.round(base * starMultiplier + streakBonus + speedBonus + firstClearBonus);
}

/**
 * Ranks players so whoever completes the most levels is #1 ("ئەوەی زۆر تەواو بۆ یەکەم جار").
 * Tie-breakers:
 * 1. Highest completedCount
 * 2. Highest skillXp
 * 3. Highest totalStars
 * 4. Most firstClears
 * 5. Fastest totalBestTimeSec (when > 0)
 * 6. Earliest lastCompletedAt (first to reach that milestone!)
 */
export function sortLeaderboard(entries: Omit<LeaderboardEntry, 'rank'>[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
    if (b.skillXp !== a.skillXp) return b.skillXp - a.skillXp;
    if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
    if (b.firstClears !== a.firstClears) return b.firstClears - a.firstClears;
    if (a.totalBestTimeSec !== b.totalBestTimeSec) {
      if (a.totalBestTimeSec === 0) return 1;
      if (b.totalBestTimeSec === 0) return -1;
      return a.totalBestTimeSec - b.totalBestTimeSec;
    }
    if (a.lastCompletedAt && b.lastCompletedAt && a.lastCompletedAt !== b.lastCompletedAt) {
      return a.lastCompletedAt.localeCompare(b.lastCompletedAt);
    }
    return a.username.localeCompare(b.username);
  });

  return sorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

export function formatTimeMMSS(totalSec: number): string {
  const clamped = Math.max(0, Math.floor(totalSec));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
