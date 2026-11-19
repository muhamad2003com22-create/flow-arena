import { generateSolvableLevel, recommendedPairsForGrid } from './flowEngine';
import type { Difficulty, FlowLevel } from './types';

const EASY_TITLES = [
  'هەنگاوی یەکەم',
  'چوارگۆشەی زێڕین',
  'ڕێڕەوی ئارام',
  'باخچەی ڕەنگەکان',
  'سەرەتای گەشت',
  'دەروازەی سەوز',
  'خەتی ڕوون',
  'پەنجەرەی خۆر',
  'دووڕیانی شین',
  'کانی ئاشتی',
  'تۆڕی سادە',
  'گەشەی بیر',
  'پلی یەکەم',
  'ڕێگای ئاسان',
  'کۆتایی دەستپێک',
];

const MEDIUM_TITLES = [
  'تۆڕی بەردین',
  'پێچاوپێچی شین',
  'گرێی سەوزایی',
  'کەناڵی مامۆستا',
  'ئاوازی ڕەنگەکان',
  'پردی زەرد',
  'دۆڵی پێچاوپێچ',
  'خەونی شارەزا',
  'ڕێڕەوی شاراوە',
  'چوارڕیانی قووڵ',
  'بازنەی بیرکردنەوە',
  'تەڵەی مۆر',
  'دەربەندی فیروزەیی',
  'تاقیکردنەوەی ناوەند',
  'تاجی مامناوەند',
];

const HARD_TITLES = [
  'تاقیکردنەوەی گەورە',
  'لابیرینتی ئەفسانە',
  'قەڵای ڕەنگەکان',
  'تاجی یەکەمینی',
  'ئاڵۆزی بێ کۆتایی',
  'دیواری بەردین',
  'پێشبڕکێی پاڵەوانان',
  'ڕێڕەوی ئەستەم',
  'کۆشکی زیرەکی',
  'بەرزترین لوتکە',
  'ئەفسانەی تۆڕ',
  'چالێنجی مامۆستا',
  'مەتەڵی کۆتایی',
  'ڕێگای سەرکەوتن',
  'پاڵەوانی ڕێڕەوی ڕەنگ',
];

const BATCH_THEMES: Record<Difficulty, string[]> = {
  easy: ['گەشتی ئاسان', 'ڕێڕەوی سووک', 'تۆڕی خێرا', 'باخچەی ڕوون', 'چوارگۆشەی ئارام'],
  medium: ['پێچاوپێچی ناوەند', 'تۆڕی شارەزا', 'گرێی زیرەک', 'کەناڵی هاوسەنگ', 'ڕێگای قووڵ'],
  hard: ['لابیرینتی قورس', 'قەڵای ئەفسانە', 'چالێنجی گەورە', 'تۆڕی مامۆستا', 'لوتکەی پاڵەوان'],
};

/**
 * Deterministic curated starter pack of 45 ready-made, 100%-solvable Flow Free puzzles:
 * - 15 ئاسان (Easy): 5x5 & 6x6
 * - 15 مامناوەند (Medium): 7x7 & 8x8
 * - 15 قورس (Hard): 9x9 & 10x10
 */
export function createStarterLevels(): FlowLevel[] {
  const levels: FlowLevel[] = [];

  EASY_TITLES.forEach((title, i) => {
    const gridSize = i < 8 ? 5 : 6;
    const numPairs = gridSize === 5 ? (i < 3 ? 4 : 5) : i < 11 ? 5 : 6;
    levels.push(
      generateSolvableLevel({
        id: `easy-${i + 1}`,
        title,
        difficulty: 'easy',
        gridSize,
        numPairs,
        seed: 10111 + i * 10112,
        createdBy: 'admin',
      })
    );
  });

  MEDIUM_TITLES.forEach((title, i) => {
    const gridSize = i < 8 ? 7 : 8;
    const numPairs = gridSize === 7 ? (i < 3 ? 6 : 7) : i < 11 ? 7 : 8;
    levels.push(
      generateSolvableLevel({
        id: `medium-${i + 1}`,
        title,
        difficulty: 'medium',
        gridSize,
        numPairs,
        seed: 50567 + i * 10112,
        createdBy: 'admin',
      })
    );
  });

  HARD_TITLES.forEach((title, i) => {
    const gridSize = i < 8 ? 9 : 10;
    const numPairs = gridSize === 9 ? (i < 3 ? 8 : 9) : i < 11 ? 9 : 10;
    levels.push(
      generateSolvableLevel({
        id: `hard-${i + 1}`,
        title,
        difficulty: 'hard',
        gridSize,
        numPairs,
        seed: 90917 + i * 10112,
        createdBy: 'admin',
      })
    );
  });

  return levels;
}

/**
 * Generates a batch of fresh, unique, 100%-solvable ready-made Flow Free puzzles
 * so Admin can add 5, 10, 20, or 30 puzzles in one click without manual design.
 */
export function generateReadyMadeBatch(options: {
  difficulty: Difficulty | 'mixed';
  count: number;
  existingCountByDifficulty: Record<Difficulty, number>;
  createdBy: string;
  baseSeed?: number;
}): FlowLevel[] {
  const safeCount = Math.max(1, Math.min(30, Math.round(options.count)));
  const seedBase = options.baseSeed ?? Math.floor(Date.now() % 1_000_000_000);
  const runningCounts: Record<Difficulty, number> = { ...options.existingCountByDifficulty };
  const order: Difficulty[] = ['easy', 'medium', 'hard'];
  const result: FlowLevel[] = [];

  for (let i = 0; i < safeCount; i++) {
    const diff: Difficulty =
      options.difficulty === 'mixed' ? order[i % 3] : options.difficulty;
    runningCounts[diff] += 1;
    const numInSection = runningCounts[diff];

    const gridSize =
      diff === 'easy'
        ? i % 2 === 0
          ? 5
          : 6
        : diff === 'medium'
          ? i % 2 === 0
            ? 7
            : 8
          : i % 2 === 0
            ? 9
            : 10;

    const themes = BATCH_THEMES[diff];
    const theme = themes[(numInSection - 1) % themes.length];
    const title = `${theme} #${numInSection}`;

    const level = generateSolvableLevel({
      id: `pack-${diff}-${seedBase}-${i + 1}`,
      title,
      difficulty: diff,
      gridSize,
      numPairs: recommendedPairsForGrid(gridSize),
      seed: seedBase + i * 7919 + numInSection * 31,
      isCustom: true,
      createdBy: options.createdBy,
    });

    result.push({
      ...level,
      firstClearedBy: null,
      firstClearedAt: null,
      clearCount: 0,
    });
  }

  return result;
}
