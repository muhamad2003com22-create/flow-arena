import React from 'react';
import { DIFFICULTY_LABELS } from '../game/palette';
import { formatTimeMMSS } from '../game/skillSystem';
import type { VictorySnapshot } from '../game/types';
import { CheckStampIcon, CrownIcon, StarIcon } from './GameIcons';

interface PauseModalProps {
  open: boolean;
  levelTitle: string;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export function PauseModal({
  open,
  levelTitle,
  onResume,
  onRestart,
  onTitle,
}: PauseModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
    >
      <div className="w-full max-w-[380px] rounded-2xl bg-[#161C26] border border-white/12 p-6 text-center text-[#F5F3EE] shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
        <h2 id="pause-modal-title" className="text-2xl font-extrabold">
          یاری وەستاوە
        </h2>
        <p className="text-sm text-[#9CA3AF] mt-1">{levelTitle}</p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] text-[#10141B] font-extrabold text-sm transition-colors cursor-pointer"
          >
            بەردەوامبوون
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-3 rounded-xl bg-[#1E2634] hover:bg-[#273245] border border-white/10 text-[#F5F3EE] font-semibold text-sm transition-colors cursor-pointer"
          >
            دووبارەکردنەوەی قۆناغ
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="w-full py-2.5 rounded-xl text-[#9CA3AF] hover:text-[#F5F3EE] text-sm transition-colors cursor-pointer"
          >
            گەڕانەوە بۆ پەڕەی سەرەکی
          </button>
        </div>
      </div>
    </div>
  );
}

interface VictoryModalProps {
  snapshot: VictorySnapshot | null;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onReplay: () => void;
  onOpenLeaderboard: () => void;
  onOpenAuth: () => void;
}

export function VictoryModal({
  snapshot,
  hasNextLevel,
  onNextLevel,
  onReplay,
  onOpenLeaderboard,
  onOpenAuth,
}: VictoryModalProps) {
  if (!snapshot) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="victory-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
    >
      <div className="w-full max-w-[440px] rounded-2xl bg-[#161C26] border border-[#E5A93C]/35 p-6 text-center text-[#F5F3EE] shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
        {/* Completed Stamp & Stars */}
        <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#10B981] mb-2">
          <CheckStampIcon className="w-5 h-5" />
          <span>تەواوە — ١٠٠٪ پڕکرایەوە</span>
        </div>

        <h2 id="victory-modal-title" className="text-2xl font-extrabold">
          {snapshot.levelTitle}
        </h2>
        <p className="text-xs text-[#9CA3AF] mt-1">
          بەشی {DIFFICULTY_LABELS[snapshot.difficulty].ku}
          {snapshot.savedToAccount ? ` · پلەی سکیل: ${snapshot.newRankName}` : ''}
        </p>

        {/* 3-Star Display */}
        <div className="flex items-center justify-center gap-2 my-5" aria-label={`${snapshot.stars} لە ٣ ئەستێرە`}>
          {[1, 2, 3].map((s) => (
            <StarIcon
              key={s}
              filled={s <= snapshot.stars}
              className="w-9 h-9"
            />
          ))}
        </div>

        {/* First Global Clear Highlight */}
        {snapshot.isFirstGlobalClear && (
          <div className="mb-4 px-3.5 py-2 rounded-xl bg-[#E5A93C]/12 border border-[#E5A93C]/35 inline-flex items-center gap-2 text-xs font-bold text-[#F2BE5C]">
            <CrownIcon className="w-4 h-4" />
            <span>تۆ یەکەم کەس بوویت ئەم قۆناغەت تەواو کرد! (+75 XP)</span>
          </div>
        )}

        {/* 3 Tabular Mastery Metric Tiles */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-[#11161F] border border-white/[0.07] p-3">
            <div className="text-lg font-extrabold font-mono-num text-[#F5F3EE]">
              {snapshot.moves}
            </div>
            <div className="text-xs text-[#8E98A8] mt-0.5">جوڵە</div>
          </div>
          <div className="rounded-xl bg-[#11161F] border border-white/[0.07] p-3">
            <div className="text-lg font-extrabold font-mono-num text-[#F5F3EE]">
              {formatTimeMMSS(snapshot.timeSec)}
            </div>
            <div className="text-xs text-[#8E98A8] mt-0.5">کات</div>
          </div>
          <div className="rounded-xl bg-[#11161F] border border-white/[0.07] p-3">
            <div className="text-lg font-extrabold font-mono-num text-[#E5A93C]">
              +{snapshot.xpAwarded}
            </div>
            <div className="text-xs text-[#8E98A8] mt-0.5">سکیل XP</div>
          </div>
        </div>

        {/* Prompt guest to sign in to save completions to Leaderboard */}
        {!snapshot.savedToAccount && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-[#11161F] border border-white/10 text-xs text-[#B5BECB]">
            بۆ تۆمارکردنی ئەنجامەکەت لە لیستی یەکەمینەکاندا،{' '}
            <button
              type="button"
              onClick={onOpenAuth}
              className="text-[#E5A93C] font-bold hover:underline cursor-pointer"
            >
              هەژمار دروست بکە یان بچۆ ژوورەوە
            </button>
            .
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={hasNextLevel ? onNextLevel : onReplay}
            className="w-full py-3.5 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] text-[#10141B] font-extrabold text-sm transition-colors cursor-pointer"
          >
            {hasNextLevel ? 'قۆناغی دواتر' : 'دووبارەکردنەوەی قۆناغ'}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onReplay}
              className="py-2.5 rounded-xl bg-[#1E2634] hover:bg-[#273245] border border-white/10 text-[#F5F3EE] font-semibold text-xs transition-colors cursor-pointer"
            >
              دووبارەکردنەوە
            </button>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-2.5 rounded-xl bg-[#1E2634] hover:bg-[#273245] border border-white/10 text-[#E5A93C] font-semibold text-xs transition-colors cursor-pointer"
            >
              لیستی یەکەمینەکان
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
