import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchLeaderboard,
  fetchLevels,
  fetchMe,
  getStoredToken,
  recordCompletion,
  setStoredToken,
} from './api/client';
import { AdminStudioModal } from './components/AdminStudioModal';
import { AuthModal } from './components/AuthModal';
import { FlowBoard } from './components/FlowBoard';
import {
  AdminShieldIcon,
  CheckStampIcon,
  GridIcon,
  HintIcon,
  PauseIcon,
  ResetIcon,
  SoundIcon,
  TrophyIcon,
  UndoIcon,
  UserIcon,
} from './components/GameIcons';
import { LeaderboardModal } from './components/LeaderboardModal';
import { LevelDrawer } from './components/LevelDrawer';
import { PauseModal, VictoryModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { createStarterLevels } from './game/curatedLevels';
import { clonePaths, getFlowStats, isPairConnected, pointKey } from './game/flowEngine';
import { DIFFICULTY_LABELS } from './game/palette';
import { calculateStars, calculateXpAward, formatTimeMMSS, getSkillRank } from './game/skillSystem';
import { soundEngine } from './game/soundEngine';
import type {
  Difficulty,
  FlowLevel,
  FlowPaths,
  GameScreenState,
  LeaderboardEntry,
  UserProfile,
  VictorySnapshot,
} from './game/types';

export default function App() {
  const starterFallback = useMemo(() => createStarterLevels(), []);

  const [screen, setScreen] = useState<GameScreenState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [levels, setLevels] = useState<FlowLevel[]>(starterFallback);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('easy');
  const [currentLevelId, setCurrentLevelId] = useState<string>(starterFallback[0].id);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Active Gameplay State
  const [paths, setPaths] = useState<FlowPaths>({});
  const [history, setHistory] = useState<FlowPaths[]>([]);
  const [moves, setMoves] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [justWon, setJustWon] = useState(false);
  const [victorySnapshot, setVictorySnapshot] = useState<VictorySnapshot | null>(null);
  const [pendingGuestCompletion, setPendingGuestCompletion] = useState<{
    levelId: string;
    moves: number;
    timeSec: number;
    hintsUsed: number;
  } | null>(null);

  // Utility Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'code' | 'admin'>('code');
  const [startAfterAuth, setStartAfterAuth] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [liveNotice, setLiveNotice] = useState<{
    text: string;
    targetLevelId: string | null;
  } | null>(null);

  const openAuthModal = useCallback((mode: 'code' | 'admin' = 'code', autoStart = false) => {
    setAuthMode(mode);
    setStartAfterAuth(autoStart);
    setAuthOpen(true);
  }, []);

  const winLockRef = useRef(false);
  const lastStrokeColorRef = useRef<number | null>(null);
  const adminOpenRef = useRef(false);
  adminOpenRef.current = adminOpen;
  const userRef = useRef<UserProfile | null>(null);
  userRef.current = user;
  const noticeTimerRef = useRef<number | null>(null);

  // Sync body dataset state for Game Shell observability
  useEffect(() => {
    document.body.dataset.state = screen;
  }, [screen]);

  // Initial Hydration from Express backend
  useEffect(() => {
    let active = true;

    async function hydrate() {
      try {
        const [lvlRes, lbRes] = await Promise.all([fetchLevels(), fetchLeaderboard()]);
        if (!active) return;
        if (lvlRes.levels.length > 0) {
          setLevels(lvlRes.levels);
          setCurrentLevelId((prev) =>
            lvlRes.levels.some((l) => l.id === prev) ? prev : lvlRes.levels[0].id
          );
        }
        setLeaderboard(lbRes.leaderboard);
      } catch {
        // Keep starter levels if backend momentarily unavailable
      }

      if (getStoredToken()) {
        try {
          const meRes = await fetchMe();
          if (!active) return;
          setUser(meRes.user);
          // Re-fetch levels in case user is admin (includes inactive levels)
          if (meRes.user.role === 'admin') {
            const adminLvls = await fetchLevels();
            if (active && adminLvls.levels.length > 0) {
              setLevels(adminLvls.levels);
            }
          }
        } catch {
          setStoredToken(null);
          if (active) setScreen('title');
        }
      } else if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1') {
          // Enforce access code gate even on ?autostart=1 when unauthenticated
          setScreen('title');
          setAuthMode('code');
          setStartAfterAuth(true);
          setAuthOpen(true);
        }
      }
    }

    hydrate();
    return () => {
      active = false;
    };
  }, []);

  // Real-time Server-Sent Events sync: new puzzles & leaderboard changes appear immediately for all players
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    let active = true;
    let hasConnectedOnce = false;

    const syncLevels = async () => {
      try {
        const res = await fetchLevels();
        if (active && res.levels.length > 0) {
          setLevels(res.levels);
        }
      } catch {
        // Ignore transient sync errors
      }
    };

    const syncLeaderboard = async () => {
      try {
        const res = await fetchLeaderboard();
        if (active) {
          setLeaderboard(res.leaderboard);
        }
      } catch {
        // Ignore transient sync errors
      }
    };

    const es = new EventSource('/api/events');

    es.addEventListener('connected', () => {
      if (hasConnectedOnce) {
        // Reconcile state automatically after any reconnect
        syncLevels();
        syncLeaderboard();
      }
      hasConnectedOnce = true;
    });

    es.addEventListener('levels:created', (evt) => {
      syncLevels();
      // Notify connected players immediately (skip if this client is the Admin currently in Studio)
      if (adminOpenRef.current) return;
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as {
          count?: number;
          levelId?: string | null;
          title?: string;
        };
        const count = Number(payload.count) || 1;
        const text =
          count > 1
            ? `${count} قۆناغی نوێ لەلایەن ئەدمینەوە زیادکرا!`
            : payload.title
              ? `قۆناغی نوێ زیادکرا: «${payload.title}»`
              : 'قۆناغێکی نوێ لەلایەن ئەدمینەوە زیادکرا!';

        if (active) {
          setLiveNotice({ text, targetLevelId: payload.levelId ?? null });
          if (noticeTimerRef.current !== null) {
            window.clearTimeout(noticeTimerRef.current);
          }
          noticeTimerRef.current = window.setTimeout(() => {
            if (active) setLiveNotice(null);
          }, 9000);
        }
      } catch {
        // Ignore malformed event data
      }
    });

    es.addEventListener('levels:updated', () => {
      syncLevels();
    });

    es.addEventListener('levels:deleted', () => {
      syncLevels();
    });

    es.addEventListener('leaderboard:updated', () => {
      syncLeaderboard();
    });

    const onWindowFocus = () => {
      syncLevels();
      syncLeaderboard();
    };
    window.addEventListener('focus', onWindowFocus);

    return () => {
      active = false;
      es.close();
      window.removeEventListener('focus', onWindowFocus);
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const activeLevels = useMemo(() => levels.filter((l) => l.isActive !== false), [levels]);

  const levelCounts = useMemo<Record<Difficulty, number>>(() => {
    return {
      easy: activeLevels.filter((l) => l.difficulty === 'easy').length,
      medium: activeLevels.filter((l) => l.difficulty === 'medium').length,
      hard: activeLevels.filter((l) => l.difficulty === 'hard').length,
    };
  }, [activeLevels]);

  const currentLevel = useMemo<FlowLevel>(() => {
    return (
      activeLevels.find((l) => l.id === currentLevelId) ??
      activeLevels.find((l) => l.difficulty === selectedDifficulty) ??
      activeLevels[0] ??
      starterFallback[0]
    );
  }, [activeLevels, currentLevelId, selectedDifficulty, starterFallback]);

  const showcaseLevel = useMemo<FlowLevel>(() => {
    return activeLevels.find((l) => l.difficulty === 'easy' && l.gridSize === 5) ?? activeLevels[0] ?? starterFallback[0];
  }, [activeLevels, starterFallback]);

  const boardStats = useMemo(() => getFlowStats(currentLevel, paths), [currentLevel, paths]);

  const resetBoardForLevel = useCallback((level: FlowLevel) => {
    winLockRef.current = false;
    lastStrokeColorRef.current = null;
    setCurrentLevelId(level.id);
    setSelectedDifficulty(level.difficulty);
    setPaths({});
    setHistory([]);
    setMoves(0);
    setHintsUsed(0);
    setElapsedSec(0);
    setJustWon(false);
    setVictorySnapshot(null);
  }, []);

  const handleStartFromTitle = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (!user) {
      openAuthModal('code', true);
      return;
    }
    const sectionLevels = activeLevels.filter((l) => l.difficulty === selectedDifficulty);
    // Pick first uncompleted level in selected difficulty, or first level in section
    const nextUnfinished =
      sectionLevels.find((l) => !user.completions[l.id]) ?? sectionLevels[0] ?? activeLevels[0];
    if (nextUnfinished) {
      resetBoardForLevel(nextUnfinished);
    }
    setScreen('playing');
  }, [activeLevels, selectedDifficulty, user, openAuthModal, resetBoardForLevel]);

  const handleSwitchDifficulty = useCallback(
    (diff: Difficulty) => {
      setSelectedDifficulty(diff);
      const sectionLevels = activeLevels.filter((l) => l.difficulty === diff);
      const target = sectionLevels.find((l) => !user?.completions[l.id]) ?? sectionLevels[0];
      if (target) {
        resetBoardForLevel(target);
      }
    },
    [activeLevels, user, resetBoardForLevel]
  );

  // Active gameplay timer (freezes when paused, modal open, or won)
  const anyOverlayOpen = authOpen || levelsOpen || leaderboardOpen || adminOpen;
  useEffect(() => {
    if (screen !== 'playing' || anyOverlayOpen || justWon) return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, anyOverlayOpen, justWon]);

  // Trigger Victory flow
  const triggerVictory = useCallback(
    async (finalMoves: number, finalTimeSec: number, finalHintsUsed: number) => {
      if (winLockRef.current) return;
      winLockRef.current = true;
      setJustWon(true);
      soundEngine.playWin();

      const safeMoves = Math.max(1, finalMoves);
      const safeTime = Math.max(1, finalTimeSec);
      const localStars = calculateStars(safeMoves, currentLevel.pairs.length, finalHintsUsed);

      if (user) {
        try {
          const res = await recordCompletion({
            levelId: currentLevel.id,
            moves: safeMoves,
            timeSec: safeTime,
            hintsUsed: finalHintsUsed,
          });
          setUser(res.user);
          setLevels(res.levels);
          setLeaderboard(res.leaderboard);
          const rankInfo = getSkillRank(res.user.skillXp);

          window.setTimeout(() => {
            setVictorySnapshot({
              levelId: currentLevel.id,
              levelTitle: currentLevel.title,
              difficulty: currentLevel.difficulty,
              moves: safeMoves,
              optimalMoves: currentLevel.pairs.length,
              timeSec: safeTime,
              stars: res.award.stars,
              xpAwarded: res.award.xpAwarded,
              isNewCompletion: res.award.isNewCompletion,
              isFirstGlobalClear: res.award.isFirstGlobalClear,
              newTotalCompleted: res.user.completedCount,
              newRankName: rankInfo.current.nameKu,
              streak: res.award.streak,
              savedToAccount: true,
            });
            setScreen('gameover');
          }, 420);
          return;
        } catch {
          // Fallback to local snapshot if network drops
        }
      }

      // Guest completion (prompts to sign in to save to leaderboard)
      const guestXp = calculateXpAward({
        difficulty: currentLevel.difficulty,
        stars: localStars,
        timeSec: safeTime,
        streak: 1,
        isFirstGlobalClear: !currentLevel.firstClearedBy,
      });
      setPendingGuestCompletion({
        levelId: currentLevel.id,
        moves: safeMoves,
        timeSec: safeTime,
        hintsUsed: finalHintsUsed,
      });
      window.setTimeout(() => {
        setVictorySnapshot({
          levelId: currentLevel.id,
          levelTitle: currentLevel.title,
          difficulty: currentLevel.difficulty,
          moves: safeMoves,
          optimalMoves: currentLevel.pairs.length,
          timeSec: safeTime,
          stars: localStars,
          xpAwarded: guestXp,
          isNewCompletion: true,
          isFirstGlobalClear: false,
          newTotalCompleted: 1,
          newRankName: getSkillRank(guestXp).current.nameKu,
          streak: 1,
          savedToAccount: false,
        });
        setScreen('gameover');
      }, 420);
    },
    [currentLevel, user]
  );

  const handlePathsChange = useCallback(
    (
      nextPaths: FlowPaths,
      meta: { action: 'start' | 'step' | 'connect' | 'cut'; colorId: number; newStroke?: boolean }
    ) => {
      if (winLockRef.current) return;

      let nextMoveCount = moves;
      if (meta.newStroke) {
        setHistory((prev) => [...prev.slice(-29), clonePaths(paths)]);
        if (lastStrokeColorRef.current !== meta.colorId) {
          nextMoveCount = moves + 1;
          setMoves(nextMoveCount);
          lastStrokeColorRef.current = meta.colorId;
        }
      }

      setPaths(nextPaths);
      const nextStats = getFlowStats(currentLevel, nextPaths);

      if (meta.action === 'connect') {
        soundEngine.playConnect(nextStats.connectedPairs);
      } else if (meta.action === 'cut') {
        soundEngine.playCut();
      } else if (meta.action === 'step') {
        soundEngine.playStep(nextPaths[meta.colorId]?.length ?? 1);
      }

      if (nextStats.isWon) {
        triggerVictory(Math.max(nextMoveCount, currentLevel.pairs.length), elapsedSec, hintsUsed);
      }
    },
    [currentLevel, elapsedSec, hintsUsed, moves, paths, triggerVictory]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0 || winLockRef.current) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPaths(prev);
    lastStrokeColorRef.current = null;
    soundEngine.playUndo();
  }, [history]);

  const handleReset = useCallback(() => {
    if (winLockRef.current) return;
    setHistory((h) => [...h.slice(-29), clonePaths(paths)]);
    setPaths({});
    setMoves(0);
    setElapsedSec(0);
    lastStrokeColorRef.current = null;
    soundEngine.playUndo();
  }, [paths]);

  const handleHint = useCallback(() => {
    if (winLockRef.current || !currentLevel.solutionPaths) return;

    // Pick first pair that is not yet solved identically to the solution path
    const targetPair = currentLevel.pairs.find((pair) => {
      const cur = paths[pair.colorId];
      const sol = currentLevel.solutionPaths?.[pair.colorId];
      if (!sol) return false;
      if (!isPairConnected(pair, cur)) return true;
      if (!cur || cur.length !== sol.length) return true;
      return false;
    });

    if (!targetPair) return;
    const solPath = currentLevel.solutionPaths[targetPair.colorId];
    if (!solPath) return;

    setHistory((h) => [...h.slice(-29), clonePaths(paths)]);
    const solKeys = new Set(solPath.map((p) => pointKey(p)));
    const next = clonePaths(paths);

    // Clear any other color pipes that collide with this solution path
    for (const k of Object.keys(next)) {
      const cid = Number(k);
      if (cid === targetPair.colorId) continue;
      if (next[cid].some((pt) => solKeys.has(pointKey(pt)))) {
        delete next[cid];
      }
    }

    next[targetPair.colorId] = solPath.map((p) => ({ r: p.r, c: p.c }));
    const nextHints = hintsUsed + 1;
    const nextMoves = moves + 1;

    setPaths(next);
    setHintsUsed(nextHints);
    setMoves(nextMoves);

    const nextStats = getFlowStats(currentLevel, next);
    soundEngine.playConnect(nextStats.connectedPairs);

    if (nextStats.isWon) {
      triggerVictory(nextMoves, elapsedSec, nextHints);
    }
  }, [currentLevel, elapsedSec, hintsUsed, moves, paths, triggerVictory]);

  const nextLevelInOrder = useMemo<FlowLevel | null>(() => {
    const sameDiff = activeLevels.filter((l) => l.difficulty === currentLevel.difficulty);
    const idx = sameDiff.findIndex((l) => l.id === currentLevel.id);
    if (idx >= 0 && idx < sameDiff.length - 1) {
      return sameDiff[idx + 1];
    }
    const order: Difficulty[] = ['easy', 'medium', 'hard'];
    const diffIdx = order.indexOf(currentLevel.difficulty);
    for (let i = diffIdx + 1; i < order.length; i++) {
      const nextGroup = activeLevels.filter((l) => l.difficulty === order[i]);
      if (nextGroup.length > 0) return nextGroup[0];
    }
    return null;
  }, [activeLevels, currentLevel]);

  const handleNextLevel = useCallback(() => {
    if (nextLevelInOrder) {
      resetBoardForLevel(nextLevelInOrder);
      setScreen('playing');
    } else {
      resetBoardForLevel(currentLevel);
      setScreen('playing');
    }
  }, [currentLevel, nextLevelInOrder, resetBoardForLevel]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = soundEngine.toggleMute();
    setMuted(nextMuted);
  }, []);

  // Global keyboard shortcuts matching Game Shell contract
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (inInput) return;

      if (anyOverlayOpen) {
        if (e.key === 'Escape') {
          setAuthOpen(false);
          setLevelsOpen(false);
          setLeaderboardOpen(false);
          setAdminOpen(false);
        }
        return;
      }

      if (screen === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartFromTitle();
        }
        return;
      }

      if (screen === 'paused') {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
          e.preventDefault();
          setScreen('playing');
        }
        return;
      }

      if (screen === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNextLevel();
        }
        return;
      }

      // Playing state shortcuts
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setScreen('paused');
      } else if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReset();
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleHint();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    anyOverlayOpen,
    screen,
    handleStartFromTitle,
    handleNextLevel,
    handleUndo,
    handleReset,
    handleHint,
    handleToggleMute,
  ]);

  const handleAuthSuccess = useCallback(
    async (authedUser: UserProfile, updatedLeaderboard?: LeaderboardEntry[]) => {
      setUser(authedUser);
      if (updatedLeaderboard) setLeaderboard(updatedLeaderboard);

      // Refresh levels if admin logged in
      let loadedLevels = activeLevels;
      try {
        const lvlRes = await fetchLevels();
        if (lvlRes.levels.length > 0) {
          setLevels(lvlRes.levels);
          loadedLevels = lvlRes.levels.filter((l) => l.isActive !== false);
        }
      } catch {
        // Ignore
      }

      // Auto-enter playing if player clicked Start Game before entering their access code
      if (startAfterAuth) {
        setStartAfterAuth(false);
        const sectionLevels = loadedLevels.filter((l) => l.difficulty === selectedDifficulty);
        const nextUnfinished =
          sectionLevels.find((l) => !authedUser.completions[l.id]) ?? sectionLevels[0] ?? loadedLevels[0];
        if (nextUnfinished) {
          resetBoardForLevel(nextUnfinished);
        }
        setScreen('playing');
      }

      // If guest just finished a level right before registering/logging in, save it now!
      if (pendingGuestCompletion) {
        const pending = pendingGuestCompletion;
        setPendingGuestCompletion(null);
        try {
          const compRes = await recordCompletion(pending);
          setUser(compRes.user);
          setLevels(compRes.levels);
          setLeaderboard(compRes.leaderboard);
          setVictorySnapshot((prev) =>
            prev
              ? {
                  ...prev,
                  savedToAccount: true,
                  xpAwarded: compRes.award.xpAwarded,
                  isFirstGlobalClear: compRes.award.isFirstGlobalClear,
                  newTotalCompleted: compRes.user.completedCount,
                  newRankName: getSkillRank(compRes.user.skillXp).current.nameKu,
                }
              : prev
          );
        } catch {
          // Ignore
        }
      }
    },
    [activeLevels, pendingGuestCompletion, resetBoardForLevel, selectedDifficulty, startAfterAuth]
  );

  const handleLogout = useCallback(async () => {
    setStoredToken(null);
    setUser(null);
    setAdminOpen(false);
    setScreen('title');
    try {
      const lvlRes = await fetchLevels();
      if (lvlRes.levels.length > 0) setLevels(lvlRes.levels);
    } catch {
      // Ignore
    }
  }, []);

  const currentCompletedRecord = user?.completions[currentLevel.id] ?? null;
  const userRankInfo = user ? getSkillRank(user.skillXp) : null;

  return (
    <div className="min-h-screen w-full bg-[#0E1218] text-[#F5F3EE]">
      {screen === 'title' ? (
        <TitleScreen
          selectedDifficulty={selectedDifficulty}
          onSelectDifficulty={setSelectedDifficulty}
          onStartGame={handleStartFromTitle}
          onOpenAuth={(mode) => openAuthModal(mode ?? 'code', mode !== 'admin')}
          onOpenLeaderboard={() => {
            fetchLeaderboard().then((r) => setLeaderboard(r.leaderboard)).catch(() => {});
            setLeaderboardOpen(true);
          }}
          onOpenAdmin={() => setAdminOpen(true)}
          user={user}
          topChampion={leaderboard[0] ?? null}
          showcaseLevel={showcaseLevel}
          levelCounts={levelCounts}
        />
      ) : (
        /* Full-Viewport Playing Game Shell (Unified Perimeter Dock + Unobstructed Board) */
        <main className="min-h-screen w-full flex flex-col justify-between bg-[#0E1218] px-3 sm:px-6 py-3 sm:py-4">
          {/* Top Unified Perimeter HUD Dock */}
          <div className="w-full max-w-[1140px] mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3 pb-2.5 sm:pb-3 border-b border-white/[0.07]">
            {/* Section Switcher & Level Picker */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div
                role="tablist"
                aria-label="گۆڕینی بەشی قورسی"
                className="flex items-center gap-1 p-1 rounded-xl bg-[#141923] border border-white/[0.08]"
              >
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => {
                  const active = currentLevel.difficulty === diff;
                  return (
                    <button
                      key={diff}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        handleSwitchDifficulty(diff);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#222B3B] text-[#F5F3EE]'
                          : 'text-[#8E98A8] hover:text-[#F5F3EE]'
                      }`}
                    >
                      {DIFFICULTY_LABELS[diff].ku}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setLevelsOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#161C26] hover:bg-[#1E2634] border border-white/10 text-xs font-semibold text-[#F5F3EE] transition-colors whitespace-nowrap cursor-pointer"
              >
                <GridIcon className="w-4 h-4 text-[#E5A93C]" />
                <span>قۆناغەکان</span>
              </button>
            </div>

            {/* Center Level Title & Completion State */}
            <div className="flex items-center gap-2.5 text-sm">
              <span className="font-extrabold text-[#F5F3EE]">{currentLevel.title}</span>
              <span aria-hidden="true" className="text-[#5B6575]">·</span>
              <span className="font-mono-num text-xs text-[#9CA3AF]">
                {currentLevel.gridSize}×{currentLevel.gridSize}
              </span>
              {currentCompletedRecord && (
                <>
                  <span aria-hidden="true" className="text-[#5B6575]">·</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#10B981]">
                    <CheckStampIcon className="w-3.5 h-3.5" />
                    <span>تەواوە</span>
                  </span>
                </>
              )}
            </div>

            {/* Right Utility Controls: Account, Leaderboard, Admin, Mute, Pause */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  fetchLeaderboard().then((r) => setLeaderboard(r.leaderboard)).catch(() => {});
                  setLeaderboardOpen(true);
                }}
                aria-label="لیستی یەکەمینەکان"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#161C26] hover:bg-[#1E2634] border border-white/10 text-xs font-semibold text-[#E5A93C] transition-colors whitespace-nowrap cursor-pointer"
              >
                <TrophyIcon className="w-4 h-4" />
                <span className="hidden sm:inline">یەکەمینەکان</span>
              </button>

              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setAdminOpen(true);
                  }}
                  aria-label="ستۆدیۆی ئەدمین"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#241E14] hover:bg-[#2F2617] border border-[#E5A93C]/40 text-xs font-bold text-[#F2BE5C] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <AdminShieldIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">ئەدمین</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  openAuthModal('code', false);
                }}
                aria-label={user ? `پڕۆفایلی ${user.username}` : 'چوونەژوورەوە بە کۆد'}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#161C26] hover:bg-[#1E2634] border border-white/10 text-xs font-semibold text-[#F5F3EE] transition-colors whitespace-nowrap cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-[#A1AAB8]" />
                <span>{user ? user.username : 'چوونەژوورەوە'}</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleMute();
                }}
                aria-label={muted ? 'کردنەوەی دەنگ' : 'بێدەنگکردن'}
                title="دەنگ [M]"
                className="w-9 h-9 rounded-xl bg-[#161C26] hover:bg-[#1E2634] border border-white/10 flex items-center justify-center text-[#B5BECB] hover:text-[#F5F3EE] transition-colors cursor-pointer"
              >
                <SoundIcon muted={muted} className="w-4 h-4" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setScreen('paused');
                }}
                aria-label="وەستان"
                title="وەستان [Esc]"
                className="w-9 h-9 rounded-xl bg-[#161C26] hover:bg-[#1E2634] border border-white/10 flex items-center justify-center text-[#B5BECB] hover:text-[#F5F3EE] transition-colors cursor-pointer"
              >
                <PauseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Central Unobstructed Playfield Area (>= 85% clear space) */}
          <div className="flex-1 w-full max-w-[1140px] mx-auto py-4 sm:py-5 flex flex-col items-center justify-center gap-4">
            {/* Compact Tabular Telemetry Strip right above the board */}
            <div className="w-full max-w-[560px] flex items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-5 sm:gap-7">
                <div>
                  <div className="text-[11px] text-[#8E98A8]">ڕێڕەوەکان</div>
                  <div
                    data-testid="hud-pairs"
                    className="text-xl sm:text-2xl font-extrabold font-mono-num text-[#F5F3EE] leading-tight"
                  >
                    {boardStats.connectedPairs}/{boardStats.totalPairs}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8E98A8]">پڕکردنەوە</div>
                  <div
                    data-testid="hud-fill"
                    className={`text-xl sm:text-2xl font-extrabold font-mono-num leading-tight ${
                      boardStats.fillPercent === 100 ? 'text-[#10B981]' : 'text-[#E5A93C]'
                    }`}
                  >
                    {boardStats.fillPercent}%
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#8E98A8]">جوڵە</div>
                  <div
                    data-testid="hud-moves"
                    className="text-xl sm:text-2xl font-extrabold font-mono-num text-[#F5F3EE] leading-tight"
                  >
                    {moves}
                  </div>
                </div>
              </div>

              <div className="text-left">
                <div className="text-[11px] text-[#8E98A8]">کات</div>
                <div
                  data-testid="hud-timer"
                  className="text-xl sm:text-2xl font-extrabold font-mono-num text-[#D8DEE9] leading-tight"
                >
                  {formatTimeMMSS(elapsedSec)}
                </div>
              </div>
            </div>

            {/* Interactive Flow Free Board */}
            <FlowBoard
              level={currentLevel}
              paths={paths}
              onPathsChange={handlePathsChange}
              disabled={screen !== 'playing' || justWon}
              justWon={justWon}
            />

            {/* Bottom Unified Tool Strip (Undo, Hint, Reset) */}
            <div className="w-full max-w-[560px] flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleUndo();
                  }}
                  disabled={history.length === 0}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#161C26] hover:bg-[#1E2634] disabled:opacity-40 border border-white/10 text-xs font-semibold text-[#F5F3EE] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <UndoIcon className="w-4 h-4" />
                  <span>گەڕانەوە</span>
                  <span className="font-mono-num text-[10px] text-[#8E98A8]">[Z]</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleHint();
                  }}
                  disabled={!currentLevel.solutionPaths}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#161C26] hover:bg-[#1E2634] disabled:opacity-40 border border-[#E5A93C]/35 text-xs font-semibold text-[#F2BE5C] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <HintIcon className="w-4 h-4" />
                  <span>یارمەتی</span>
                  <span className="font-mono-num text-[10px] opacity-75">[H]</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleReset();
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#161C26] hover:bg-[#1E2634] border border-white/10 text-xs font-semibold text-[#B5BECB] hover:text-[#F5F3EE] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ResetIcon className="w-4 h-4" />
                  <span>سەرلەنوێ</span>
                  <span className="font-mono-num text-[10px] text-[#8E98A8]">[R]</span>
                </button>
              </div>

              {/* Subtle Skill Rank Progress Readout */}
              <div className="text-xs text-[#8E98A8]">
                {user && userRankInfo ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span style={{ color: userRankInfo.current.color }} className="font-semibold">
                      {userRankInfo.current.nameKu}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{user.skillXp} XP</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      <span className="font-mono-num">{user.completedCount}</span> تەواو
                    </span>
                  </span>
                ) : (
                  <span>بۆ تۆمارکردنی سکیل و پێشەنگی، هەژمار بکەرەوە</span>
                )}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Status Modals (Pause & Victory) */}
      <PauseModal
        open={screen === 'paused'}
        levelTitle={currentLevel.title}
        onResume={() => setScreen('playing')}
        onRestart={() => {
          resetBoardForLevel(currentLevel);
          setScreen('playing');
        }}
        onTitle={() => setScreen('title')}
      />

      <VictoryModal
        snapshot={screen === 'gameover' ? victorySnapshot : null}
        hasNextLevel={Boolean(nextLevelInOrder)}
        onNextLevel={handleNextLevel}
        onReplay={() => {
          resetBoardForLevel(currentLevel);
          setScreen('playing');
        }}
        onOpenLeaderboard={() => {
          fetchLeaderboard().then((r) => setLeaderboard(r.leaderboard)).catch(() => {});
          setLeaderboardOpen(true);
        }}
        onOpenAuth={() => openAuthModal('code', false)}
      />

      {/* Utility Modals */}
      <AuthModal
        open={authOpen}
        initialMode={authMode}
        user={user}
        onClose={() => {
          setAuthOpen(false);
          setStartAfterAuth(false);
        }}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onOpenAdmin={() => setAdminOpen(true)}
      />

      <LevelDrawer
        open={levelsOpen}
        levels={levels}
        currentLevelId={currentLevel.id}
        initialDifficulty={currentLevel.difficulty}
        user={user}
        onSelectLevel={(lvl) => {
          resetBoardForLevel(lvl);
          setScreen('playing');
        }}
        onClose={() => setLevelsOpen(false)}
      />

      <LeaderboardModal
        open={leaderboardOpen}
        entries={leaderboard}
        currentUser={user}
        onClose={() => setLeaderboardOpen(false)}
      />

      <AdminStudioModal
        open={adminOpen}
        levels={levels}
        onLevelsUpdated={(updatedLevels, playLevel) => {
          setLevels(updatedLevels);
          if (playLevel) {
            resetBoardForLevel(playLevel);
            setScreen('playing');
          }
        }}
        onClose={() => setAdminOpen(false)}
      />

      {/* Live Notification Toast when Admin publishes new puzzles in real time */}
      {liveNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-[420px] z-40 rounded-2xl bg-[#161C26] border border-[#E5A93C]/50 px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.6)] flex items-center justify-between gap-3"
        >
          <span className="text-xs sm:text-sm font-bold text-[#F5F3EE] leading-snug">
            {liveNotice.text}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const found = liveNotice.targetLevelId
                  ? activeLevels.find((l) => l.id === liveNotice.targetLevelId)
                  : null;
                setLiveNotice(null);
                if (!userRef.current) {
                  openAuthModal('code', true);
                  return;
                }
                if (found) {
                  resetBoardForLevel(found);
                  setScreen('playing');
                } else {
                  setLevelsOpen(true);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#E5A93C] hover:bg-[#F2BE5C] text-[#10141B] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap"
            >
              یاری بکە
            </button>
            <button
              type="button"
              onClick={() => setLiveNotice(null)}
              aria-label="داخستنی ئاگادارکردنەوە"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F3EE] hover:bg-white/[0.06] cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
