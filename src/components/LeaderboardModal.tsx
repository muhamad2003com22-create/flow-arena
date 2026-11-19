import React from 'react';
import { getSkillRank } from '../game/skillSystem';
import type { LeaderboardEntry, UserProfile } from '../game/types';
import { CrownIcon, StarIcon, TrophyIcon } from './GameIcons';

interface LeaderboardModalProps {
  open: boolean;
  entries: LeaderboardEntry[];
  currentUser: UserProfile | null;
  onClose: () => void;
}

export function LeaderboardModal({
  open,
  entries,
  currentUser,
  onClose,
}: LeaderboardModalProps) {
  if (!open) return null;

  const champion = entries[0] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[680px] max-h-[86vh] flex flex-col rounded-2xl bg-[#161C26] border border-white/12 text-[#F5F3EE] shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <TrophyIcon className="w-5 h-5 text-[#E5A93C]" />
            <h2 id="leaderboard-title" className="text-lg font-bold">
              لیستی یەکەمینەکان و تۆمارەکان
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="داخستنی لیستی یەکەمینەکان"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F3EE] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* #1 Champion Spotlight */}
        {champion && (
          <div className="px-6 py-5 bg-[#121821] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#241E14] border border-[#E5A93C]/45 flex items-center justify-center shrink-0">
                <CrownIcon className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs text-[#E5A93C] font-semibold">یەکەمینی یاری (پلەی ١)</div>
                <div className="text-xl font-extrabold text-[#F5F3EE] mt-0.5">{champion.username}</div>
                <div className="text-xs text-[#9CA3AF] mt-0.5">
                  سکیل: {getSkillRank(champion.skillXp).current.nameKu} · یەکەم تەواوکردنی جیهانی: {champion.firstClears}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-extrabold font-mono-num text-[#10B981]">
                  {champion.completedCount}
                </div>
                <div className="text-xs text-[#8E98A8]">تەواوکراو</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-extrabold font-mono-num text-[#E5A93C]">
                  {champion.skillXp}
                </div>
                <div className="text-xs text-[#8E98A8]">سکیل XP</div>
              </div>
            </div>
          </div>
        )}

        {/* Rankings Table */}
        <div className="overflow-y-auto px-6 py-4">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#8E98A8]">
              هێشتا هیچ تۆمارێک نییە. یەکەم قۆناغ تەواو بکە بۆ ئەوەی ببیتە یەکەمین!
            </div>
          ) : (
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-[#8E98A8]">
                  <th className="py-2.5 font-medium">پلە</th>
                  <th className="py-2.5 font-medium">یاریزان</th>
                  <th className="py-2.5 font-medium">سکیل</th>
                  <th className="py-2.5 font-medium text-center">تەواوکراو</th>
                  <th className="py-2.5 font-medium text-center">ئەستێرە</th>
                  <th className="py-2.5 font-medium text-left">XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                {entries.map((entry) => {
                  const isMe = currentUser?.id === entry.userId;
                  const rankInfo = getSkillRank(entry.skillXp);
                  return (
                    <tr
                      key={entry.userId}
                      className={isMe ? 'bg-[#E5A93C]/10' : 'hover:bg-white/[0.025]'}
                    >
                      <td className="py-3 font-mono-num font-bold">
                        {entry.rank === 1 ? (
                          <span className="inline-flex items-center gap-1 text-[#E5A93C]">
                            <CrownIcon className="w-4 h-4" />
                            <span>1</span>
                          </span>
                        ) : (
                          <span className="text-[#9CA3AF]">#{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-3 font-semibold text-[#F5F3EE]">
                        {entry.username}
                        {isMe && <span className="mr-2 text-xs text-[#E5A93C]">(تۆ)</span>}
                      </td>
                      <td className="py-3 text-xs" style={{ color: rankInfo.current.color }}>
                        {rankInfo.current.nameKu}
                      </td>
                      <td className="py-3 text-center font-mono-num font-bold text-[#10B981]">
                        {entry.completedCount}
                      </td>
                      <td className="py-3 text-center font-mono-num text-[#E5A93C]">
                        <span className="inline-flex items-center justify-center gap-1">
                          <StarIcon className="w-3.5 h-3.5" />
                          <span>{entry.totalStars}</span>
                        </span>
                      </td>
                      <td className="py-3 text-left font-mono-num font-semibold text-[#F5F3EE]">
                        {entry.skillXp}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
