export type Difficulty = 'easy' | 'medium' | 'hard';

export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export interface Point {
  r: number;
  c: number;
}

export interface ColorPair {
  colorId: number;
  start: Point;
  end: Point;
}

export type FlowPaths = Record<number, Point[]>;

export interface FlowLevel {
  id: string;
  title: string;
  difficulty: Difficulty;
  gridSize: number;
  pairs: ColorPair[];
  solutionPaths?: FlowPaths;
  isCustom?: boolean;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: string;
  firstClearedBy?: string | null;
  firstClearedAt?: string | null;
  clearCount?: number;
}

export interface CompletionRecord {
  levelId: string;
  difficulty: Difficulty;
  bestMoves: number;
  bestTimeSec: number;
  stars: number;
  xpEarned: number;
  completedAt: string;
  isFirstGlobalClear?: boolean;
}

export interface AccessCodeRecord {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  role: 'player' | 'admin';
  joinedWithCode?: string;
  skillXp: number;
  streak: number;
  hintCharges: number;
  completedCount: number;
  totalStars: number;
  completions: Record<string, CompletionRecord>;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  role: 'player' | 'admin';
  completedCount: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  skillXp: number;
  totalStars: number;
  firstClears: number;
  totalBestTimeSec: number;
  lastCompletedAt: string | null;
  rank: number;
}

export interface FlowBoardStats {
  connectedPairs: number;
  totalPairs: number;
  filledCells: number;
  totalCells: number;
  fillPercent: number;
  isWon: boolean;
}

export interface VictorySnapshot {
  levelId: string;
  levelTitle: string;
  difficulty: Difficulty;
  moves: number;
  optimalMoves: number;
  timeSec: number;
  stars: number;
  xpAwarded: number;
  isNewCompletion: boolean;
  isFirstGlobalClear: boolean;
  newTotalCompleted: number;
  newRankName: string;
  streak: number;
  savedToAccount: boolean;
}
