import React, { useEffect, useState } from 'react';
import { DIFFICULTY_LABELS } from '../game/palette';
import { getSkillRank } from '../game/skillSystem';
import type { Difficulty, FlowLevel, FlowPaths, LeaderboardEntry, UserProfile } from '../game/types';
import { FlowBoard } from './FlowBoard';
import {
  AdminShieldIcon,
  CrownIcon,
  TitleLockupSvg,
  TrophyIcon,
  UserIcon,
} from './GameIcons';

interface TitleScreenProps {
  selectedDifficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  onStartGame: () => void;
  onOpenAuth: (mode?: 'code' | 'admin') => void;
  onOpenLeaderboard: () => void;
  onOpenAdmin: () => void;
  user: UserProfile | null;
  topChampion: LeaderboardEntry | null;
  showcaseLevel: FlowLevel;
  levelCounts: Record<Difficulty, number>;
}

const TITLE_BG_URL = '/src/assets/images/title_bg_1795121816192.jpg';

export function TitleScreen({
  selectedDifficulty,
  onSelectDifficulty,
  onStartGame,
  onOpenAuth,
  onOpenLeaderboard,
  onOpenAdmin,
  user,
  topChampion,
  showcaseLevel,
  levelCounts,
}: TitleScreenProps) {
  const [demoPaths, setDemoPaths] = useState<FlowPaths>({});
  const [userTouchedDemo, setUserTouchedDemo] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);

  // Subtle ambient showcase animation: draws two mineral pipes progressively unless the player drags on it
  useEffect(() => {
    if (userTouchedDemo || !showcaseLevel.solutionPaths) return;

    const solutionEntries = Object.entries(showcaseLevel.solutionPaths).slice(0, 3);
    let stepCursor = 0;
    const totalSteps = solutionEntries.reduce((acc, [, pts]) => acc + pts.length, 0);

    const timer = window.setInterval(() => {
      stepCursor = (stepCursor + 1) % (totalSteps + 6);
      let rem = stepCursor;
      const next: FlowPaths = {};

      for (const [k, pts] of solutionEntries) {
        const cid = Number(k);
        if (rem <= 0) break;
        const take = Math.min(pts.length, rem);
        if (take >= 1) {
          next[cid] = pts.slice(0, take);
        }
        rem -= pts.length;
      }
      setDemoPaths(next);
    }, 260);

    return () => window.clearInterval(timer);
  }, [showcaseLevel, userTouchedDemo]);

  const rankInfo = user ? getSkillRank(user.skillXp) : null;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0E1218] text-[#F5F3EE] flex flex-col justify-between">
      {/* Illustrated Key-Art Backdrop with edge-to-edge scale & measured contrast scrim */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {!bgFailed ? (
          <img
            src={TITLE_BG_URL}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBgFailed(true)}
            className="w-full h-full object-cover scale-[1.07] opacity-40"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#141A24] via-[#0E1218] to-[#0B0E14]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-l from-[#0E1218]/92 via-[#0E1218]/78 to-[#0E1218]/55" />
      </div>

      {/* Top Safe Margin: Minimal Account & Champion Status Line (No website navbar) */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 sm:px-10 pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-[#A1AAB8]">
          {user ? (
            <button
              type="button"
              onClick={() => onOpenAuth('code')}
              className="inline-flex items-center gap-2 text-[#F5F3EE] hover:text-[#E5A93C] transition-colors cursor-pointer"
            >
              <UserIcon className="w-4 h-4 text-[#E5A93C]" />
              <span className="font-semibold">{user.username}</span>
              <span aria-hidden="true" className="text-[#6E7889]">·</span>
              <span className="text-[#A1AAB8]">{rankInfo?.current.nameKu}</span>
              <span aria-hidden="true" className="text-[#6E7889]">·</span>
              <span className="text-[#E5A93C]">
                <span className="font-mono-num">{user.completedCount}</span> تەواو
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuth('code')}
              className="inline-flex items-center gap-2 text-[#F5F3EE] hover:text-[#E5A93C] transition-colors cursor-pointer"
            >
              <UserIcon className="w-4 h-4 text-[#E5A93C]" />
              <span>چوونەژوورەوە بە کۆد</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-5 text-sm">
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="inline-flex items-center gap-2 text-[#D8DEE9] hover:text-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <TrophyIcon className="w-4 h-4 text-[#E5A93C]" />
            <span>لیستی یەکەمینەکان</span>
          </button>

          {user?.role === 'admin' ? (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-2 text-[#E5A93C] hover:text-[#F2BE5C] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AdminShieldIcon className="w-4 h-4" />
              <span>ستۆدیۆی ئەدمین</span>
            </button>
          ) : !user ? (
            <button
              type="button"
              onClick={() => onOpenAuth('admin')}
              className="inline-flex items-center gap-1.5 text-[#8E98A8] hover:text-[#E5A93C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <AdminShieldIcon className="w-4 h-4" />
              <span>چوونەژوورەوەی ئەدمین</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Split Stage: Right Calm Negative Space (Title + CTA) / Left Interactive Showcase Board */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 sm:px-10 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        {/* Title & Primary Controls (Right column in RTL, over calm slate negative space) */}
        <section className="lg:col-span-6 flex flex-col items-start text-right">
          <TitleLockupSvg className="mb-6" />

          <p className="text-base sm:text-lg text-[#B5BECB] leading-relaxed max-w-[46ch] mb-7">
            ڕەنگە هاوشێوەکان بەیەکەوە ببەستەوە بەبێ یەکتربڕین و هەموو خانەکانی تۆڕەکە پڕ بکەرەوە. هەرچەند قۆناغ زیاتر تەواو بکەیت، سکیلەکەت بەرز دەبێتەوە و دەبیتە یەکەمین.
          </p>

          {/* Interactive Difficulty Section Selector (Functional Segmented Buttons) */}
          <div className="w-full max-w-[420px] mb-6">
            <div className="text-xs text-[#9CA3AF] mb-2">هەڵبژاردنی بەشی قورسی</div>
            <div
              role="radiogroup"
              aria-label="بەشەکانی قورسی"
              className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-[#141923] border border-white/10"
            >
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
                const active = selectedDifficulty === diff;
                const meta = DIFFICULTY_LABELS[diff];
                return (
                  <button
                    key={diff}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onSelectDifficulty(diff)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#222B3B] text-[#F5F3EE] shadow-sm border border-[#E5A93C]/50'
                        : 'text-[#9CA3AF] hover:text-[#F5F3EE] border border-transparent'
                    }`}
                  >
                    <span>{meta.ku}</span>
                    <span className="mr-1.5 text-xs font-mono-num opacity-75">
                      ({levelCounts[diff]})
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-[#8E98A8]">{DIFFICULTY_LABELS[selectedDifficulty].descKu}</p>
          </div>

          {/* Primary Start CTA + Code Gate CTA */}
          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              data-start="true"
              onClick={onStartGame}
              className="px-8 py-3.5 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] active:scale-[0.98] text-[#10141B] font-extrabold text-base tracking-tight transition-all duration-150 shadow-[0_10px_28px_rgba(229,169,60,0.28)] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? 'دەستپێکردنی یاری' : 'چوونەژوورەوە بە کۆد و یاری'}
            </button>
          </div>
        </section>

        {/* Interactive Live Centerpiece Showcase Board (Left column in RTL) */}
        <section className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-[360px]">
            <FlowBoard
              level={showcaseLevel}
              paths={demoPaths}
              onPathsChange={(next) => setDemoPaths(next)}
              onInteractStart={() => setUserTouchedDemo(true)}
              compact
            />

            {/* Quiet Unboxed #1 Champion Proof Line adjacent to centerpiece */}
            <div className="mt-4 flex items-center justify-between text-xs text-[#A1AAB8] px-1">
              {topChampion ? (
                <div className="flex items-center gap-2">
                  <CrownIcon className="w-4 h-4 shrink-0" />
                  <span className="text-[#F5F3EE] font-semibold">یەکەمین: {topChampion.username}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <span className="font-mono-num">{topChampion.completedCount}</span> تەواوکراو
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-[#E5A93C]">{topChampion.skillXp} XP</span>
                </div>
              ) : (
                <span>تاقیبکەرەوە و ببە بە یەکەمین پاڵەوان</span>
              )}
              {userTouchedDemo && (
                <button
                  type="button"
                  onClick={() => {
                    setUserTouchedDemo(false);
                    setDemoPaths({});
                  }}
                  className="text-[#E5A93C] hover:underline cursor-pointer"
                >
                  سەرلەنوێ
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Safe Margin: Single Flat Borderless Control-Hint Line */}
      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 sm:px-10 pb-5 pt-2 text-center lg:text-right">
        <p className="text-xs text-[#7B8698]">
          ڕاکێشان بە ماوس یان پەنجە بۆ گرێدان · Enter دەستپێکردن · Z گەڕانەوە · H یارمەتی · Esc وەستان
        </p>
      </div>
    </main>
  );
}
