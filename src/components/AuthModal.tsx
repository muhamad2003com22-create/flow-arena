import React, { useEffect, useState } from 'react';
import { joinWithCode, loginAdmin } from '../api/client';
import { getSkillRank } from '../game/skillSystem';
import type { LeaderboardEntry, UserProfile } from '../game/types';
import { AdminShieldIcon, CheckStampIcon, StarIcon, UserIcon } from './GameIcons';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'code' | 'admin';
  user: UserProfile | null;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile, leaderboard?: LeaderboardEntry[]) => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
}

export function AuthModal({
  open,
  initialMode = 'code',
  user,
  onClose,
  onAuthSuccess,
  onLogout,
  onOpenAdmin,
}: AuthModalProps) {
  const [mode, setMode] = useState<'code' | 'admin'>(initialMode);
  const [accessCode, setAccessCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
    }
  }, [open, initialMode]);

  if (!open) return null;

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedCode = accessCode.trim();
    const trimmedName = playerName.trim();
    if (trimmedCode.length < 4) {
      setError('تکایە کۆدی چوونەژوورەوە بە تەواوی بنووسە.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('تکایە ناوی خۆت بنووسە (لانیکەم ٢ پیت) بۆ لیستی یەکەمینەکان.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await joinWithCode(trimmedCode, trimmedName);
      setAccessCode('');
      setPlayerName('');
      onAuthSuccess(res.user, res.leaderboard);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'هەڵەیەک ڕوویدا.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUser = adminUsername.trim();
    if (!trimmedUser || !adminPassword) {
      setError('تکایە ناوی بەکارهێنەر و وشەی نهێنی ئەدمین بنووسە.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAdmin(trimmedUser, adminPassword);
      setAdminUsername('');
      setAdminPassword('');
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'هەڵەیەک ڕوویدا.');
    } finally {
      setSubmitting(false);
    }
  };

  const rankProgress = user ? getSkillRank(user.skillXp) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 sm:p-4 flex items-start sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[440px] my-auto rounded-2xl bg-[#161C26] border border-white/12 p-6 text-[#F5F3EE] shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            {mode === 'admin' && !user ? (
              <AdminShieldIcon className="w-5 h-5 text-[#E5A93C]" />
            ) : (
              <UserIcon className="w-5 h-5 text-[#E5A93C]" />
            )}
            <h2 id="auth-modal-title" className="text-lg font-bold">
              {user
                ? 'پڕۆفایلی یاریزان'
                : mode === 'code'
                  ? 'چوونەژوورەوە بە کۆد'
                  : 'چوونەژوورەوەی تایبەت بە ئەدمین'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="داخستن"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F3EE] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {user && rankProgress ? (
          <div className="pt-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xl font-extrabold text-[#F5F3EE]">{user.username}</div>
                <div className="text-xs text-[#A1AAB8] mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{user.role === 'admin' ? 'ئەدمینی سیستەم' : 'یاریزان'}</span>
                  {user.joinedWithCode && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        کۆد: <span className="font-mono-num text-[#D8DEE9]">{user.joinedWithCode}</span>
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span style={{ color: rankProgress.current.color }} className="font-semibold">
                    پلەی سکیل: {rankProgress.current.nameKu}
                  </span>
                </div>
              </div>
              <div className="text-left">
                <div className="text-2xl font-extrabold font-mono-num text-[#E5A93C]">{user.skillXp}</div>
                <div className="text-xs text-[#8E98A8]">خاڵی سکیل XP</div>
              </div>
            </div>

            {/* Skill Progression Bar */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-1.5">
                <span>پێشکەوتنی سکیل</span>
                <span>
                  {rankProgress.next ? (
                    <>
                      <span className="font-mono-num">{rankProgress.xpToNext} XP</span> ماوە بۆ{' '}
                      {rankProgress.next.nameKu}
                    </>
                  ) : (
                    'بەرزترین پلە'
                  )}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[#0E1218] overflow-hidden border border-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${rankProgress.progressPercent}%`,
                    backgroundColor: rankProgress.current.color,
                  }}
                />
              </div>
            </div>

            {/* 3 Clean Tabular Stats */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="rounded-xl bg-[#11161F] border border-white/[0.07] p-3 text-center">
                <div className="text-xl font-bold font-mono-num text-[#10B981] flex items-center justify-center gap-1">
                  <CheckStampIcon className="w-4 h-4" />
                  <span>{user.completedCount}</span>
                </div>
                <div className="text-xs text-[#8E98A8] mt-0.5">تەواوکراو</div>
              </div>
              <div className="rounded-xl bg-[#11161F] border border-white/[0.07] p-3 text-center">
                <div className="text-xl font-bold font-mono-num text-[#E5A93C] flex items-center justify-center gap-1">
                  <StarIcon className="w-4 h-4" />
                  <span>{user.totalStars}</span>
                </div>
                <div className="text-xs text-[#8E98A8] mt-0.5">ئەستێرە</div>
              </div>
              <div className="rounded-xl bg-[#11161F] border border-white/[0.07] p-3 text-center">
                <div className="text-xl font-bold font-mono-num text-[#F5F3EE]">{user.streak}</div>
                <div className="text-xs text-[#8E98A8] mt-0.5">زنجیرە</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {user.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdmin();
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] text-[#10141B] font-bold text-sm transition-colors cursor-pointer"
                >
                  <AdminShieldIcon className="w-4 h-4" />
                  <span>ستۆدیۆی ئەدمین</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#1E2634] hover:bg-[#273245] border border-white/10 text-[#F5F3EE] font-semibold text-sm transition-colors cursor-pointer"
              >
                چوونەدەرەوە
              </button>
            </div>
          </div>
        ) : mode === 'code' ? (
          <div className="pt-5">
            <p className="text-xs text-[#A1AAB8] leading-relaxed mb-4">
              کۆدی چوونەژوورەوەی کە لەلایەن ئەدمینەوە پێت دراوە بنووسە و ناوی خۆت دیاری بکە بۆ ئەوەی لە لیستی یەکەمینەکاندا تۆمار بکرێیت.
            </p>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label htmlFor="player-access-code" className="block text-xs font-medium text-[#B5BECB] mb-1.5">
                  کۆدی چوونەژوورەوە
                </label>
                <input
                  id="player-access-code"
                  type="text"
                  dir="ltr"
                  autoComplete="off"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="FLOW-XXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] font-mono-num tracking-wider text-sm text-center focus:outline-none focus:border-[#E5A93C]"
                  required
                />
              </div>

              <div>
                <label htmlFor="player-display-name" className="block text-xs font-medium text-[#B5BECB] mb-1.5">
                  ناوی تۆ (بۆ لیستی یەکەمینەکان)
                </label>
                <input
                  id="player-display-name"
                  type="text"
                  autoComplete="nickname"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="نموونە: دیار یان هێلین"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] text-sm focus:outline-none focus:border-[#E5A93C]"
                  required
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="px-3.5 py-2.5 rounded-xl bg-[#E5484D]/15 border border-[#E5484D]/40 text-xs text-[#FCA5A5]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] disabled:opacity-60 text-[#10141B] font-extrabold text-sm transition-colors cursor-pointer"
              >
                {submitting ? 'پشکنینی کۆد...' : 'چوونەژوورەوە و دەستپێکردنی یاری'}
              </button>
            </form>

            {/* Quiet Admin-Only Login Switch (No password exposed) */}
            <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between gap-2 text-xs text-[#8E98A8]">
              <span>بەڕێوەبەری یارییت؟</span>
              <button
                type="button"
                onClick={() => {
                  setMode('admin');
                  setError(null);
                }}
                className="inline-flex items-center gap-1.5 text-[#E5A93C] hover:underline font-semibold cursor-pointer"
              >
                <AdminShieldIcon className="w-3.5 h-3.5" />
                <span>چوونەژوورەوەی ئەدمین</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-5">
            <p className="text-xs text-[#A1AAB8] leading-relaxed mb-4">
              ئەم بەشە تەنها بۆ چوونەژوورەوەی ئەدمینە بۆ دروستکردنی کۆد و قۆناغەکانی Flow Free.
            </p>

            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-username" className="block text-xs font-medium text-[#B5BECB] mb-1.5">
                  ناوی ئەدمین (Username)
                </label>
                <input
                  id="admin-username"
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] text-sm focus:outline-none focus:border-[#E5A93C]"
                  required
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-xs font-medium text-[#B5BECB] mb-1.5">
                  وشەی نهێنی (Password)
                </label>
                <input
                  id="admin-password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] text-sm focus:outline-none focus:border-[#E5A93C]"
                  required
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="px-3.5 py-2.5 rounded-xl bg-[#E5484D]/15 border border-[#E5484D]/40 text-xs text-[#FCA5A5]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] disabled:opacity-60 text-[#10141B] font-extrabold text-sm transition-colors cursor-pointer"
              >
                {submitting ? 'چاوەڕوان بە...' : 'چوونەژوورەوەی ئەدمین'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between gap-2 text-xs text-[#8E98A8]">
              <span>یاریزانیت و کۆدت هەیە؟</span>
              <button
                type="button"
                onClick={() => {
                  setMode('code');
                  setError(null);
                }}
                className="text-[#D8DEE9] hover:text-[#E5A93C] font-semibold cursor-pointer"
              >
                گەڕانەوە بۆ چوونەژوورەوە بە کۆد
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
