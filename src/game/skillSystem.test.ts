import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStars,
  calculateXpAward,
  formatTimeMMSS,
  getSkillRank,
  sortLeaderboard,
} from './skillSystem';

test('getSkillRank maps XP to correct Kurdish mastery ranks and progress', () => {
  const novice = getSkillRank(0);
  assert.equal(novice.current.nameKu, 'سەرەتایی');
  assert.equal(novice.next?.nameKu, 'پێشکەوتوو');
  assert.equal(novice.progressPercent, 0);

  const skilled = getSkillRank(650);
  assert.equal(skilled.current.nameKu, 'شارەزا');

  const legend = getSkillRank(3200);
  assert.equal(legend.current.nameKu, 'ئەفسانە');
  assert.equal(legend.next, null);
  assert.equal(legend.progressPercent, 100);
});

test('calculateStars rewards optimal no-hint solves with 3 stars', () => {
  assert.equal(calculateStars(5, 5, 0), 3);
  assert.equal(calculateStars(7, 5, 0), 3);
  assert.equal(calculateStars(8, 5, 1), 2);
  assert.equal(calculateStars(20, 5, 2), 1);
});

test('calculateXpAward scales by difficulty, stars, streak, speed, and first global clear', () => {
  const easyBasic = calculateXpAward({
    difficulty: 'easy',
    stars: 1,
    timeSec: 90,
    streak: 0,
    isFirstGlobalClear: false,
  });
  assert.equal(easyBasic, 100);

  const hardPerfectFirst = calculateXpAward({
    difficulty: 'hard',
    stars: 3,
    timeSec: 80,
    streak: 4,
    isFirstGlobalClear: true,
  });
  // 400 * 1.5 (600) + streak 60 + speed 35 + firstClear 75 = 770
  assert.equal(hardPerfectFirst, 770);
});

test('sortLeaderboard ranks most completed levels #1, then highest XP, then earliest completion', () => {
  const ranked = sortLeaderboard([
    {
      userId: 'u1',
      username: 'playerA',
      role: 'player',
      completedCount: 3,
      easyCount: 2,
      mediumCount: 1,
      hardCount: 0,
      skillXp: 700,
      totalStars: 8,
      firstClears: 0,
      totalBestTimeSec: 120,
      lastCompletedAt: '2026-11-19T12:10:00.000Z',
    },
    {
      userId: 'u2',
      username: 'playerB',
      role: 'player',
      completedCount: 5,
      easyCount: 3,
      mediumCount: 2,
      hardCount: 0,
      skillXp: 650,
      totalStars: 11,
      firstClears: 1,
      totalBestTimeSec: 210,
      lastCompletedAt: '2026-11-19T12:15:00.000Z',
    },
    {
      userId: 'u3',
      username: 'playerC',
      role: 'player',
      completedCount: 3,
      easyCount: 2,
      mediumCount: 1,
      hardCount: 0,
      skillXp: 700,
      totalStars: 8,
      firstClears: 0,
      totalBestTimeSec: 95,
      lastCompletedAt: '2026-11-19T12:05:00.000Z',
    },
  ]);

  assert.equal(ranked[0].username, 'playerB');
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].username, 'playerC');
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].username, 'playerA');
  assert.equal(ranked[2].rank, 3);
  assert.equal(formatTimeMMSS(125), '02:05');
});
