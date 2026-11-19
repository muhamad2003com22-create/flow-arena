import type { ColorPair, Difficulty, FlowBoardStats, FlowLevel, FlowPaths, Point } from './types';

export function pointsEqual(a: Point, b: Point): boolean {
  return a.r === b.r && a.c === b.c;
}

export function isAdjacent(a: Point, b: Point): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

export function pointKey(p: Point): string {
  return `${p.r},${p.c}`;
}

export function inBounds(p: Point, gridSize: number): boolean {
  return p.r >= 0 && p.r < gridSize && p.c >= 0 && p.c < gridSize;
}

export function clonePaths(paths: FlowPaths): FlowPaths {
  const next: FlowPaths = {};
  for (const key of Object.keys(paths)) {
    const id = Number(key);
    next[id] = paths[id].map((p) => ({ r: p.r, c: p.c }));
  }
  return next;
}

export function getEndpointAt(pairs: ColorPair[], p: Point): ColorPair | null {
  for (const pair of pairs) {
    if (pointsEqual(pair.start, p) || pointsEqual(pair.end, p)) {
      return pair;
    }
  }
  return null;
}

export function getPairByColor(pairs: ColorPair[], colorId: number): ColorPair | undefined {
  return pairs.find((p) => p.colorId === colorId);
}

export function isPairConnected(pair: ColorPair, path: Point[] | undefined): boolean {
  if (!path || path.length < 2) return false;
  const first = path[0];
  const last = path[path.length - 1];
  return (
    (pointsEqual(first, pair.start) && pointsEqual(last, pair.end)) ||
    (pointsEqual(first, pair.end) && pointsEqual(last, pair.start))
  );
}

export function buildCellOwnerMap(paths: FlowPaths): Map<string, number> {
  const map = new Map<string, number>();
  for (const key of Object.keys(paths)) {
    const colorId = Number(key);
    for (const pt of paths[colorId]) {
      map.set(pointKey(pt), colorId);
    }
  }
  return map;
}

export interface PathActionResult {
  paths: FlowPaths;
  activeColorId: number | null;
  changed: boolean;
  justConnected: boolean;
  cutColorId: number | null;
}

/**
 * Begins drawing or resumes drawing from an existing pipe segment or endpoint.
 */
export function startDrawingAt(
  level: Pick<FlowLevel, 'gridSize' | 'pairs'>,
  paths: FlowPaths,
  cell: Point
): PathActionResult {
  if (!inBounds(cell, level.gridSize)) {
    return { paths, activeColorId: null, changed: false, justConnected: false, cutColorId: null };
  }

  const endpoint = getEndpointAt(level.pairs, cell);
  if (endpoint) {
    const next = clonePaths(paths);
    next[endpoint.colorId] = [{ r: cell.r, c: cell.c }];
    return {
      paths: next,
      activeColorId: endpoint.colorId,
      changed: true,
      justConnected: false,
      cutColorId: null,
    };
  }

  const ownerMap = buildCellOwnerMap(paths);
  const owner = ownerMap.get(pointKey(cell));
  if (owner !== undefined) {
    const existing = paths[owner] ?? [];
    const idx = existing.findIndex((p) => pointsEqual(p, cell));
    if (idx >= 0) {
      const next = clonePaths(paths);
      next[owner] = existing.slice(0, idx + 1).map((p) => ({ r: p.r, c: p.c }));
      return {
        paths: next,
        activeColorId: owner,
        changed: idx < existing.length - 1,
        justConnected: false,
        cutColorId: null,
      };
    }
  }

  return { paths, activeColorId: null, changed: false, justConnected: false, cutColorId: null };
}

/**
 * Steps the active color pipe to an orthogonally adjacent cell.
 * Handles backtracking, self-truncation, endpoint snapping, and cutting other pipes.
 */
export function stepDrawingTo(
  level: Pick<FlowLevel, 'gridSize' | 'pairs'>,
  paths: FlowPaths,
  activeColorId: number,
  target: Point
): PathActionResult {
  if (!inBounds(target, level.gridSize)) {
    return { paths, activeColorId, changed: false, justConnected: false, cutColorId: null };
  }

  const pair = getPairByColor(level.pairs, activeColorId);
  const current = paths[activeColorId];
  if (!pair || !current || current.length === 0) {
    return { paths, activeColorId, changed: false, justConnected: false, cutColorId: null };
  }

  const head = current[current.length - 1];
  if (pointsEqual(head, target)) {
    return { paths, activeColorId, changed: false, justConnected: false, cutColorId: null };
  }

  if (!isAdjacent(head, target)) {
    return { paths, activeColorId, changed: false, justConnected: false, cutColorId: null };
  }

  // Check if target is already in the current color's own path -> backtrack / truncate
  const selfIdx = current.findIndex((p) => pointsEqual(p, target));
  if (selfIdx >= 0) {
    const next = clonePaths(paths);
    next[activeColorId] = current.slice(0, selfIdx + 1).map((p) => ({ r: p.r, c: p.c }));
    return {
      paths: next,
      activeColorId,
      changed: true,
      justConnected: false,
      cutColorId: null,
    };
  }

  // If this color is already completed at its destination endpoint, do not extend beyond it
  if (isPairConnected(pair, current)) {
    return { paths, activeColorId, changed: false, justConnected: false, cutColorId: null };
  }

  // Cannot pass through another color's fixed endpoint
  const targetEndpoint = getEndpointAt(level.pairs, target);
  if (targetEndpoint && targetEndpoint.colorId !== activeColorId) {
    return { paths, activeColorId, changed: false, justConnected: false, cutColorId: null };
  }

  const next = clonePaths(paths);
  let cutColorId: number | null = null;

  // Check if target belongs to another color's pipe -> cleanly cut that pipe before target
  const ownerMap = buildCellOwnerMap(next);
  const existingOwner = ownerMap.get(pointKey(target));
  if (existingOwner !== undefined && existingOwner !== activeColorId) {
    const otherPath = next[existingOwner] ?? [];
    const cutIdx = otherPath.findIndex((p) => pointsEqual(p, target));
    if (cutIdx >= 0) {
      next[existingOwner] = otherPath.slice(0, cutIdx);
      cutColorId = existingOwner;
    }
  }

  next[activeColorId] = [...current.map((p) => ({ r: p.r, c: p.c })), { r: target.r, c: target.c }];
  const justConnected = isPairConnected(pair, next[activeColorId]);

  return {
    paths: next,
    activeColorId,
    changed: true,
    justConnected,
    cutColorId,
  };
}

export function clearColorPath(paths: FlowPaths, colorId: number): FlowPaths {
  const next = clonePaths(paths);
  delete next[colorId];
  return next;
}

export function getFlowStats(level: Pick<FlowLevel, 'gridSize' | 'pairs'>, paths: FlowPaths): FlowBoardStats {
  const totalPairs = level.pairs.length;
  let connectedPairs = 0;

  for (const pair of level.pairs) {
    if (isPairConnected(pair, paths[pair.colorId])) {
      connectedPairs++;
    }
  }

  // Count distinct occupied cells: endpoints + all active path segments
  const occupied = new Set<string>();
  for (const pair of level.pairs) {
    occupied.add(pointKey(pair.start));
    occupied.add(pointKey(pair.end));
  }
  for (const key of Object.keys(paths)) {
    const colorId = Number(key);
    for (const pt of paths[colorId]) {
      occupied.add(pointKey(pt));
    }
  }

  const totalCells = level.gridSize * level.gridSize;
  const filledCells = occupied.size;
  const fillPercent = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
  const isWon = totalPairs > 0 && connectedPairs === totalPairs && filledCells === totalCells;

  return {
    connectedPairs,
    totalPairs,
    filledCells,
    totalCells,
    fillPercent,
    isWon,
  };
}

// ============================================================
// Deterministic Seeded PRNG + Guaranteed-Solvable Generator
// ============================================================

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getGridNeighbors(p: Point, gridSize: number): Point[] {
  const res: Point[] = [];
  if (p.r > 0) res.push({ r: p.r - 1, c: p.c });
  if (p.r < gridSize - 1) res.push({ r: p.r + 1, c: p.c });
  if (p.c > 0) res.push({ r: p.r, c: p.c - 1 });
  if (p.c < gridSize - 1) res.push({ r: p.r, c: p.c + 1 });
  return res;
}

function generateHamiltonianPath(gridSize: number, rng: () => number): Point[] {
  const path: Point[] = [];
  for (let r = 0; r < gridSize; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < gridSize; c++) path.push({ r, c });
    } else {
      for (let c = gridSize - 1; c >= 0; c--) path.push({ r, c });
    }
  }

  const indexOf = (p: Point) => path.findIndex((q) => q.r === p.r && q.c === p.c);
  const iterations = gridSize * gridSize * 14;

  for (let iter = 0; iter < iterations; iter++) {
    const fromEnd = rng() < 0.5;
    if (fromEnd) {
      const tail = path[path.length - 1];
      const neighbors = getGridNeighbors(tail, gridSize);
      const valid = neighbors
        .map((n) => indexOf(n))
        .filter((idx) => idx >= 0 && idx < path.length - 2);
      if (valid.length === 0) continue;
      const k = valid[Math.floor(rng() * valid.length)];
      // Reverse path[k + 1 .. end]
      let lo = k + 1;
      let hi = path.length - 1;
      while (lo < hi) {
        const tmp = path[lo];
        path[lo] = path[hi];
        path[hi] = tmp;
        lo++;
        hi--;
      }
    } else {
      const head = path[0];
      const neighbors = getGridNeighbors(head, gridSize);
      const valid = neighbors
        .map((n) => indexOf(n))
        .filter((idx) => idx > 1);
      if (valid.length === 0) continue;
      const k = valid[Math.floor(rng() * valid.length)];
      // Reverse path[0 .. k - 1]
      let lo = 0;
      let hi = k - 1;
      while (lo < hi) {
        const tmp = path[lo];
        path[lo] = path[hi];
        path[hi] = tmp;
        lo++;
        hi--;
      }
    }
  }

  return path;
}

export function recommendedPairsForGrid(gridSize: number): number {
  if (gridSize <= 5) return 5;
  if (gridSize === 6) return 6;
  if (gridSize === 7) return 7;
  if (gridSize === 8) return 8;
  if (gridSize === 9) return 9;
  return 10;
}

/**
 * Generates a 100% space-filling, mathematically guaranteed solvable Flow Free level.
 */
export function generateSolvableLevel(options: {
  id: string;
  title: string;
  difficulty: Difficulty;
  gridSize: number;
  numPairs?: number;
  seed?: number;
  isCustom?: boolean;
  createdBy?: string;
}): FlowLevel {
  const gridSize = Math.max(5, Math.min(10, Math.round(options.gridSize)));
  const totalCells = gridSize * gridSize;
  const maxPossiblePairs = Math.min(10, Math.floor(totalCells / 3));
  const numPairs = Math.max(
    3,
    Math.min(maxPossiblePairs, options.numPairs ?? recommendedPairsForGrid(gridSize))
  );
  const baseSeed = options.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const rng = createRng(baseSeed);

  let bestPairs: ColorPair[] = [];
  let bestSolution: FlowPaths = {};
  let bestScore = -1;

  for (let attempt = 0; attempt < 16; attempt++) {
    const ham = generateHamiltonianPath(gridSize, rng);

    // Partition ham (length totalCells) into numPairs segments each of length >= 3
    const minLen = 3;
    let remaining = totalCells - numPairs * minLen;
    const lengths = new Array<number>(numPairs).fill(minLen);

    for (let i = 0; i < numPairs - 1; i++) {
      if (remaining <= 0) break;
      // Distribute extra length smoothly so pipes feel varied and natural
      const avg = remaining / (numPairs - i);
      const maxGrant = Math.min(remaining, Math.max(1, Math.round(avg * 1.9)));
      const grant = Math.floor(rng() * (maxGrant + 1));
      lengths[i] += grant;
      remaining -= grant;
    }
    lengths[numPairs - 1] += remaining;

    // Shuffle segment lengths so the longest pipe isn't always last
    for (let i = lengths.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = lengths[i];
      lengths[i] = lengths[j];
      lengths[j] = tmp;
    }

    const pairs: ColorPair[] = [];
    const solutionPaths: FlowPaths = {};
    let cursor = 0;
    let adjacentPenalty = 0;
    let bendsScore = 0;

    for (let i = 0; i < numPairs; i++) {
      const seg = ham.slice(cursor, cursor + lengths[i]);
      cursor += lengths[i];
      const start = seg[0];
      const end = seg[seg.length - 1];
      pairs.push({ colorId: i, start, end });
      solutionPaths[i] = seg;

      if (isAdjacent(start, end)) {
        adjacentPenalty += 10;
      }
      // Count turns inside segment for richer puzzle geometry
      for (let k = 1; k < seg.length - 1; k++) {
        const dr1 = seg[k].r - seg[k - 1].r;
        const dc1 = seg[k].c - seg[k - 1].c;
        const dr2 = seg[k + 1].r - seg[k].r;
        const dc2 = seg[k + 1].c - seg[k].c;
        if (dr1 !== dr2 || dc1 !== dc2) bendsScore += 1;
      }
    }

    const quality = bendsScore - adjacentPenalty;
    if (quality > bestScore) {
      bestScore = quality;
      bestPairs = pairs;
      bestSolution = solutionPaths;
      if (adjacentPenalty === 0 && bendsScore >= numPairs * 2) {
        break;
      }
    }
  }

  return {
    id: options.id,
    title: options.title,
    difficulty: options.difficulty,
    gridSize,
    pairs: bestPairs,
    solutionPaths: bestSolution,
    isCustom: options.isCustom ?? false,
    isActive: true,
    createdBy: options.createdBy ?? 'system',
    createdAt: new Date().toISOString(),
  };
}

// ============================================================
// Admin Custom Level Validation & Backtracking Solver
// ============================================================

export interface LevelValidationResult {
  valid: boolean;
  errorKu?: string;
}

export function validateCustomLevel(gridSize: number, pairs: ColorPair[]): LevelValidationResult {
  if (!Number.isInteger(gridSize) || gridSize < 5 || gridSize > 10) {
    return { valid: false, errorKu: 'قەبارەی تۆڕ دەبێت لە نێوان ٥×٥ بۆ ١٠×١٠ بێت.' };
  }
  if (!Array.isArray(pairs) || pairs.length < 2) {
    return { valid: false, errorKu: 'لانیکەم دوو جووت ڕەنگ دابنێ بۆ دروستکردنی قۆناغ.' };
  }
  if (pairs.length > 10) {
    return { valid: false, errorKu: 'زۆرترین ژمارەی ڕەنگەکان ١٠ جووتە.' };
  }

  const seenColors = new Set<number>();
  const seenCells = new Set<string>();

  for (const pair of pairs) {
    if (seenColors.has(pair.colorId)) {
      return { valid: false, errorKu: 'نابێت یەک ڕەنگ دووجار دووبارە ببێتەوە.' };
    }
    seenColors.add(pair.colorId);

    if (!inBounds(pair.start, gridSize) || !inBounds(pair.end, gridSize)) {
      return { valid: false, errorKu: 'هەموو خاڵەکان دەبێت لە ناو سنووری تۆڕەکەدا بن.' };
    }
    if (pointsEqual(pair.start, pair.end)) {
      return { valid: false, errorKu: 'خاڵی سەرەتا و کۆتایی هەمان ڕەنگ نابێت لە هەمان خانەدا بن.' };
    }

    const k1 = pointKey(pair.start);
    const k2 = pointKey(pair.end);
    if (seenCells.has(k1) || seenCells.has(k2)) {
      return { valid: false, errorKu: 'دوو خاڵ لەسەر یەک خانە دانراون.' };
    }
    seenCells.add(k1);
    seenCells.add(k2);
  }

  return { valid: true };
}

/**
 * Bounded backtracking solver to verify custom Admin puzzles (especially 5x5–7x7).
 * Returns solutionPaths if found within node budget, or null if unsolvable / budget exceeded.
 */
export function solveCustomLevel(
  gridSize: number,
  pairs: ColorPair[],
  maxSteps = 45000
): { solvable: boolean; timedOut: boolean; solutionPaths?: FlowPaths } {
  const check = validateCustomLevel(gridSize, pairs);
  if (!check.valid) return { solvable: false, timedOut: false };

  const totalCells = gridSize * gridSize;
  const grid = new Int8Array(totalCells).fill(-1);
  const idx = (r: number, c: number) => r * gridSize + c;

  // Order pairs by Manhattan distance ascending for faster pruning
  const ordered = [...pairs].sort(
    (a, b) =>
      Math.abs(a.start.r - a.end.r) +
      Math.abs(a.start.c - a.end.c) -
      (Math.abs(b.start.r - b.end.r) + Math.abs(b.start.c - b.end.c))
  );

  for (const p of ordered) {
    grid[idx(p.start.r, p.start.c)] = p.colorId;
    grid[idx(p.end.r, p.end.c)] = p.colorId;
  }

  const paths: FlowPaths = {};
  for (const p of ordered) {
    paths[p.colorId] = [{ r: p.start.r, c: p.start.c }];
  }

  let steps = 0;
  let timedOut = false;

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  function dfs(pairIdx: number, curR: number, curC: number, filled: number): boolean {
    steps++;
    if (steps > maxSteps) {
      timedOut = true;
      return false;
    }

    const pair = ordered[pairIdx];
    const target = pair.end;

    // Check if adjacent to target
    if (Math.abs(curR - target.r) + Math.abs(curC - target.c) === 1) {
      paths[pair.colorId].push({ r: target.r, c: target.c });
      if (pairIdx === ordered.length - 1) {
        if (filled === totalCells) return true;
        paths[pair.colorId].pop();
        return false;
      }
      const nextPair = ordered[pairIdx + 1];
      if (dfs(pairIdx + 1, nextPair.start.r, nextPair.start.c, filled)) {
        return true;
      }
      paths[pair.colorId].pop();
      // Do not immediately return false — in Flow Free, a longer detour might be needed to fill cells!
    }

    // Order moves closer to target first
    const candidates: Array<{ nr: number; nc: number; dist: number }> = [];
    for (const [dr, dc] of dirs) {
      const nr = curR + dr;
      const nc = curC + dc;
      if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
      if (grid[idx(nr, nc)] !== -1) continue;
      const dist = Math.abs(nr - target.r) + Math.abs(nc - target.c);
      candidates.push({ nr, nc, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);

    for (const cand of candidates) {
      grid[idx(cand.nr, cand.nc)] = pair.colorId;
      paths[pair.colorId].push({ r: cand.nr, c: cand.nc });
      if (dfs(pairIdx, cand.nr, cand.nc, filled + 1)) {
        return true;
      }
      paths[pair.colorId].pop();
      grid[idx(cand.nr, cand.nc)] = -1;
      if (timedOut) return false;
    }

    return false;
  }

  const initialFilled = ordered.length * 2;
  const ok = dfs(0, ordered[0].start.r, ordered[0].start.c, initialFilled);
  if (ok) {
    return { solvable: true, timedOut: false, solutionPaths: clonePaths(paths) };
  }
  return { solvable: false, timedOut };
}
