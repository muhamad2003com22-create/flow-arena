import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSolvableLevel,
  getFlowStats,
  isPairConnected,
  solveCustomLevel,
  startDrawingAt,
  stepDrawingTo,
  validateCustomLevel,
} from './flowEngine';
import { createStarterLevels, generateReadyMadeBatch } from './curatedLevels';
import type { FlowLevel, FlowPaths } from './types';

test('starter levels include 45 ready-made puzzles across Easy, Medium, Hard and every solution wins 100%', () => {
  const levels = createStarterLevels();
  const easy = levels.filter((l) => l.difficulty === 'easy');
  const medium = levels.filter((l) => l.difficulty === 'medium');
  const hard = levels.filter((l) => l.difficulty === 'hard');

  assert.equal(easy.length, 15);
  assert.equal(medium.length, 15);
  assert.equal(hard.length, 15);

  for (const level of levels) {
    assert.ok(level.solutionPaths, `Level ${level.id} must have solutionPaths`);
    const stats = getFlowStats(level, level.solutionPaths!);
    assert.equal(stats.isWon, true, `Level ${level.id} solution must win`);
    assert.equal(stats.fillPercent, 100, `Level ${level.id} must fill 100% of grid`);
    assert.equal(stats.connectedPairs, level.pairs.length);
  }
});

test('generateReadyMadeBatch creates mixed and single-difficulty 100%-solvable batches', () => {
  const batch = generateReadyMadeBatch({
    difficulty: 'mixed',
    count: 12,
    existingCountByDifficulty: { easy: 15, medium: 15, hard: 15 },
    createdBy: 'admin',
    baseSeed: 77777,
  });
  assert.equal(batch.length, 12);
  assert.equal(batch.filter((l) => l.difficulty === 'easy').length, 4);
  assert.equal(batch.filter((l) => l.difficulty === 'medium').length, 4);
  assert.equal(batch.filter((l) => l.difficulty === 'hard').length, 4);
  for (const level of batch) {
    assert.equal(getFlowStats(level, level.solutionPaths!).isWon, true);
  }
});

test('path drawing handles stepping, backtracking, cutting other pipes, and endpoint protection', () => {
  const miniLevel: Pick<FlowLevel, 'gridSize' | 'pairs'> = {
    gridSize: 3,
    pairs: [
      { colorId: 0, start: { r: 0, c: 0 }, end: { r: 0, c: 2 } },
      { colorId: 1, start: { r: 2, c: 0 }, end: { r: 2, c: 2 } },
    ],
  };

  let paths: FlowPaths = {};
  const s0 = startDrawingAt(miniLevel, paths, { r: 0, c: 0 });
  assert.equal(s0.activeColorId, 0);
  paths = s0.paths;

  // Step right to (0,1)
  const step1 = stepDrawingTo(miniLevel, paths, 0, { r: 0, c: 1 });
  assert.equal(step1.changed, true);
  assert.equal(step1.justConnected, false);
  paths = step1.paths;

  // Step down to (1,1)
  const step2 = stepDrawingTo(miniLevel, paths, 0, { r: 1, c: 1 });
  paths = step2.paths;
  assert.equal(paths[0].length, 3);

  // Backtrack to (0,1)
  const back = stepDrawingTo(miniLevel, paths, 0, { r: 0, c: 1 });
  paths = back.paths;
  assert.equal(paths[0].length, 2);

  // Connect to (0,2)
  const finish0 = stepDrawingTo(miniLevel, paths, 0, { r: 0, c: 2 });
  paths = finish0.paths;
  assert.equal(finish0.justConnected, true);
  assert.equal(isPairConnected(miniLevel.pairs[0], paths[0]), true);

  // Start color 1 at (2,0) and cross into color 0's path at (0,1)
  paths = startDrawingAt(miniLevel, paths, { r: 2, c: 0 }).paths;
  paths = stepDrawingTo(miniLevel, paths, 1, { r: 1, c: 0 }).paths;
  paths = stepDrawingTo(miniLevel, paths, 1, { r: 1, c: 1 }).paths;
  const cutRes = stepDrawingTo(miniLevel, paths, 1, { r: 0, c: 1 });
  assert.equal(cutRes.cutColorId, 0);
  assert.equal(cutRes.paths[0].length, 1); // color 0 trimmed back to start (0,0)

  // Trying to enter color 0's fixed endpoint (0,0) must be blocked
  const blocked = stepDrawingTo(miniLevel, cutRes.paths, 1, { r: 0, c: 0 });
  assert.equal(blocked.changed, false);
});

test('generateSolvableLevel creates valid 100%-filled puzzles for 5x5, 7x7, and 10x10', () => {
  for (const size of [5, 7, 10]) {
    const level = generateSolvableLevel({
      id: `gen-${size}`,
      title: `Test ${size}`,
      difficulty: size <= 6 ? 'easy' : size <= 8 ? 'medium' : 'hard',
      gridSize: size,
      seed: 4242 + size,
    });
    const validation = validateCustomLevel(level.gridSize, level.pairs);
    assert.equal(validation.valid, true);
    const stats = getFlowStats(level, level.solutionPaths!);
    assert.equal(stats.isWon, true);
    assert.equal(stats.filledCells, size * size);
  }
});

test('validateCustomLevel rejects invalid puzzles and solveCustomLevel solves valid 5x5', () => {
  assert.equal(validateCustomLevel(4, []).valid, false);
  assert.equal(
    validateCustomLevel(5, [
      { colorId: 0, start: { r: 0, c: 0 }, end: { r: 0, c: 0 } },
      { colorId: 1, start: { r: 1, c: 1 }, end: { r: 2, c: 2 } },
    ]).valid,
    false
  );

  const generated = generateSolvableLevel({
    id: 'solve-test',
    title: 'Solve Test',
    difficulty: 'easy',
    gridSize: 5,
    numPairs: 4,
    seed: 98765,
  });
  const solved = solveCustomLevel(generated.gridSize, generated.pairs);
  assert.equal(solved.solvable, true);
  assert.ok(solved.solutionPaths);
  assert.equal(getFlowStats(generated, solved.solutionPaths!).isWon, true);
});
