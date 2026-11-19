export interface MineralColor {
  id: number;
  nameKu: string;
  hex: string;
  trackHex: string;
  strokeHex: string;
  symbol: 'circle' | 'diamond' | 'triangle' | 'square' | 'cross' | 'ring' | 'hex' | 'star' | 'bar' | 'dot';
}

export const MINERAL_PALETTE: MineralColor[] = [
  {
    id: 0,
    nameKu: 'سوور',
    hex: '#E5484D',
    trackHex: 'rgba(229, 72, 77, 0.16)',
    strokeHex: '#FF8589',
    symbol: 'circle',
  },
  {
    id: 1,
    nameKu: 'شین',
    hex: '#3B82F6',
    trackHex: 'rgba(59, 130, 246, 0.16)',
    strokeHex: '#93C5FD',
    symbol: 'diamond',
  },
  {
    id: 2,
    nameKu: 'سەوز',
    hex: '#10B981',
    trackHex: 'rgba(16, 185, 129, 0.16)',
    strokeHex: '#6EE7B7',
    symbol: 'triangle',
  },
  {
    id: 3,
    nameKu: 'زەرد',
    hex: '#F59E0B',
    trackHex: 'rgba(245, 158, 11, 0.16)',
    strokeHex: '#FCD34D',
    symbol: 'square',
  },
  {
    id: 4,
    nameKu: 'مۆر',
    hex: '#A855F7',
    trackHex: 'rgba(168, 85, 247, 0.16)',
    strokeHex: '#D8B4FE',
    symbol: 'cross',
  },
  {
    id: 5,
    nameKu: 'فیروزەیی',
    hex: '#06B6D4',
    trackHex: 'rgba(6, 182, 212, 0.16)',
    strokeHex: '#67E8F9',
    symbol: 'ring',
  },
  {
    id: 6,
    nameKu: 'پەمەیی',
    hex: '#F43F5E',
    trackHex: 'rgba(244, 63, 94, 0.16)',
    strokeHex: '#FDA4AF',
    symbol: 'hex',
  },
  {
    id: 7,
    nameKu: 'لیمۆیی',
    hex: '#84CC16',
    trackHex: 'rgba(132, 204, 22, 0.16)',
    strokeHex: '#BEF264',
    symbol: 'star',
  },
  {
    id: 8,
    nameKu: 'پرتەقاڵی',
    hex: '#F97316',
    trackHex: 'rgba(249, 115, 22, 0.16)',
    strokeHex: '#FDBA74',
    symbol: 'bar',
  },
  {
    id: 9,
    nameKu: 'زیوی',
    hex: '#CBD5E1',
    trackHex: 'rgba(203, 213, 225, 0.16)',
    strokeHex: '#F8FAFC',
    symbol: 'dot',
  },
];

export function getMineralColor(colorId: number): MineralColor {
  return MINERAL_PALETTE[((colorId % MINERAL_PALETTE.length) + MINERAL_PALETTE.length) % MINERAL_PALETTE.length];
}

export const DIFFICULTY_LABELS: Record<'easy' | 'medium' | 'hard', { ku: string; descKu: string; accent: string }> = {
  easy: {
    ku: 'ئاسان',
    descKu: 'تۆڕی ٥×٥ و ٦×٦ — گونجاو بۆ دەستپێک و خێرایی',
    accent: '#10B981',
  },
  medium: {
    ku: 'مامناوەند',
    descKu: 'تۆڕی ٧×٧ و ٨×٨ — بیرکردنەوەی قووڵتر و ڕێڕەوی ئاڵۆز',
    accent: '#E5A93C',
  },
  hard: {
    ku: 'قورس',
    descKu: 'تۆڕی ٩×٩ و ١٠×١٠ — بۆ شارەزایان و پێشبڕکێی یەکەمینی',
    accent: '#E5484D',
  },
};
