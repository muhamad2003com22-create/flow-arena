import React, { useState } from 'react';
import { DIFFICULTY_LABELS } from '../game/palette';
import { formatTimeMMSS, getSkillRank } from '../game/skillSystem';
import type { Difficulty, FlowLevel, UserProfile } from '../game/types';
import { CheckStampIcon, GridIcon, StarIcon } from './GameIcons';

interface LevelDrawerProps {
  open: boolean;
  levels: FlowLevel[];
  currentLevelId: string;
  initialDifficulty: Difficulty;
  user: UserProfile | null;
  onSelectLevel: (level: FlowLevel) => void;
  onClose: () => void;
}

type StatusFilter = 'all' | 'todo' | 'done';

export function LevelDrawer({
  open,
  levels,
  currentLevelId,
  initialDifficulty,
  user,
  onSelectLevel,
  onClose,
}: LevelDrawerProps) {
  const [tab, setTab] = useState<Difficulty>(initialDifficulty);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  React.useEffect(() => {
    if (open) {
      setTab(initialDifficulty);
      setStatusFilter('all');
    }
  }, [open, initialDifficulty]);

  if (!open) return null;

  const sectionLevels = levels.filter((l) => l.difficulty === tab && l.isActive !== false);
  const completedInTab = sectionLevels.filter((l) => Boolean(user?.completions[l.id])).length;
  const todoInTab = sectionLevels.length - completedInTab;
  const firstUnsolved = sectionLevels.find((l) => !user?.completions[l.id]);
  const visibleLevels = sectionLevels.filter((l) => {
    const done = Boolean(user?.completions[l.id]);
    if (statusFilter === 'done') return done;
    if (statusFilter === 'todo') return !done;
    return true;
  });
  const rankInfo = user ? getSkillRank(user.skillXp) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-drawer-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 sm:p-4 flex items-start sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[760px] max-h-[90dvh] my-auto flex flex-col rounded-2xl bg-[#161C26] border border-white/12 text-[#F5F3EE] shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <GridIcon className="w-5 h-5 text-[#E5A93C]" />
            <h2 id="level-drawer-title" className="text-lg font-bold">
              بەشەکانی یاری و قۆناغەکان
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="داخستنی لیستی قۆناغەکان"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F3EE] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Difficulty Section Tabs + Status Filter */}
        <div className="shrink-0 px-6 pt-4 pb-3 border-b border-white/[0.06] space-y-3">
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-[#11161F] border border-white/[0.07]">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
              const active = tab === diff;
              const count = levels.filter((l) => l.difficulty === diff && l.isActive !== false).length;
              return (
                <button
                  key={diff}
                  type="button"
                  onClick={() => {
                    setTab(diff);
                    setStatusFilter('all');
                  }}
                  className={`py-2.5 px-3 rounded-lg text-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#222B3B] text-[#F5F3EE] border border-[#E5A93C]/45'
                      : 'text-[#8E98A8] hover:text-[#F5F3EE] border border-transparent'
                  }`}
                >
                  <span>{DIFFICULTY_LABELS[diff].ku}</span>
                  <span className="mr-1.5 text-xs font-mono-num opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'هەمووی', count: sectionLevels.length },
                  { id: 'todo', label: 'تەواونەکراو', count: todoInTab },
                  { id: 'done', label: 'تەواوکراو', count: completedInTab },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStatusFilter(item.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === item.id
                      ? 'bg-[#222B3B] text-[#F5F3EE] border border-[#E5A93C]/45'
                      : 'bg-[#11161F] text-[#8E98A8] hover:text-[#F5F3EE] border border-white/[0.06]'
                  }`}
                >
                  <span>{item.label}</span>{' '}
                  <span className="font-mono-num opacity-75">({item.count})</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[#9CA3AF]">
              {firstUnsolved && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectLevel(firstUnsolved);
                    onClose();
                  }}
                  className="text-[#F2BE5C] hover:underline font-bold cursor-pointer whitespace-nowrap"
                >
                  یەکەم قۆناغی تەواونەکراو
                </button>
              )}
              <span>
                تەواوکراو: <span className="font-mono-num">{completedInTab}/{sectionLevels.length}</span>
                {rankInfo ? (
                  <>
                    {' · '}سکیل: {rankInfo.current.nameKu}{' '}
                    <span className="font-mono-num">({user?.skillXp} XP)</span>
                  </>
                ) : null}
              </span>
            </div>
          </div>
        </div>

        {/* Levels Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {visibleLevels.length === 0 ? (
            <div className="col-span-full py-12 text-center text-sm text-[#8E98A8]">
              {sectionLevels.length === 0
                ? 'هیچ قۆناغێک لەم بەشەدا نییە. ئەدمین دەتوانێت قۆناغی نوێ زیاد بکات.'
                : statusFilter === 'todo'
                  ? 'هەموو قۆناغەکانی ئەم بەشەت تەواو کردووە! دەستت خۆش.'
                  : 'هێشتا هیچ قۆناغێکت لەم بەشەدا تەواو نەکردووە.'}
            </div>
          ) : (
            visibleLevels.map((level) => {
              const orderIndex = sectionLevels.findIndex((item) => item.id === level.id);
              const rec = user?.completions[level.id];
              const isCurrent = level.id === currentLevelId;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => {
                    onSelectLevel(level);
                    onClose();
                  }}
                  className={`text-right rounded-xl p-4 border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#202939] border-[#E5A93C]/70'
                      : rec
                        ? 'bg-[#131B24] border-[#10B981]/35 hover:border-[#10B981]/70'
                        : 'bg-[#121720] border-white/[0.08] hover:border-white/25 hover:bg-[#19202D]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-[#F5F3EE]">
                        <span className="font-mono-num">{String(orderIndex + 1).padStart(2, '0')}</span>. {level.title}
                      </div>
                      <div className="mt-1 text-xs text-[#8E98A8] flex items-center gap-2">
                        <span className="font-mono-num">{level.gridSize}×{level.gridSize}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <span className="font-mono-num">{level.pairs.length}</span> ڕەنگ
                        </span>
                        {level.isCustom && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#E5A93C]">دروستکراوی ئەدمین</span>
                          </>
                        )}
                      </div>
                    </div>

                    {rec ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#10B981] shrink-0">
                        <CheckStampIcon className="w-4 h-4" />
                        <span>تەواوە</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#6E7889] shrink-0">ئامادە</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-xs">
                    {rec ? (
                      <div className="flex items-center gap-2 text-[#A1AAB8]">
                        <span className="inline-flex items-center gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <StarIcon key={s} filled={s <= rec.stars} className="w-3.5 h-3.5" />
                          ))}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <span className="font-mono-num">{rec.bestMoves}</span> جوڵە
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{formatTimeMMSS(rec.bestTimeSec)}</span>
                      </div>
                    ) : (
                      <span className="text-[#7B8698]">
                        {level.firstClearedBy
                          ? `یەکەم کەس: ${level.firstClearedBy}`
                          : 'هێشتا کەس تەواوی نەکردووە — ببە بە یەکەم!'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
