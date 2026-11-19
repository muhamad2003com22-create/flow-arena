import React, { useEffect, useMemo, useState } from 'react';
import {
  changeAdminPassword,
  createAdminCode,
  createAdminLevel,
  createAdminLevelBatch,
  deleteAdminCode,
  deleteAdminLevel,
  fetchAdminCodes,
  updateAdminCode,
  updateAdminLevel,
} from '../api/client';
import {
  generateSolvableLevel,
  recommendedPairsForGrid,
  solveCustomLevel,
  validateCustomLevel,
} from '../game/flowEngine';
import { DIFFICULTY_LABELS, getMineralColor, MINERAL_PALETTE } from '../game/palette';
import type { AccessCodeRecord, ColorPair, Difficulty, FlowLevel, FlowPaths, Point } from '../game/types';
import { AdminShieldIcon, CheckStampIcon, NodeSymbolSvg } from './GameIcons';

interface AdminStudioModalProps {
  open: boolean;
  levels: FlowLevel[];
  onLevelsUpdated: (levels: FlowLevel[], playLevel?: FlowLevel) => void;
  onClose: () => void;
}

type BatchDifficulty = Difficulty | 'mixed';

const BATCH_DIFFICULTY_LABELS: Record<BatchDifficulty, string> = {
  mixed: 'تێکەڵ (هەموو بەشەکان)',
  easy: 'ئاسان',
  medium: 'مامناوەند',
  hard: 'قورس',
};

export function AdminStudioModal({
  open,
  levels,
  onLevelsUpdated,
  onClose,
}: AdminStudioModalProps) {
  const [activeTab, setActiveTab] = useState<'packs' | 'create' | 'manage' | 'codes'>('packs');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gridSize, setGridSize] = useState<number>(5);
  const [selectedColorId, setSelectedColorId] = useState<number>(0);
  const [draftPoints, setDraftPoints] = useState<Record<number, Point[]>>({});
  const [solutionPreview, setSolutionPreview] = useState<FlowPaths | null>(null);
  const [showSolution, setShowSolution] = useState<boolean>(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Ready-Made Packs state
  const [packDiff, setPackDiff] = useState<BatchDifficulty>('mixed');
  const [packCount, setPackCount] = useState<number>(15);
  const [packMsg, setPackMsg] = useState<{ type: 'ok' | 'err'; text: string; firstNew?: FlowLevel } | null>(null);

  // Manage tab filter & error banner
  const [manageFilter, setManageFilter] = useState<'all' | Difficulty>('all');
  const [manageMsg, setManageMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Access Codes & Admin Password State
  const [codes, setCodes] = useState<AccessCodeRecord[]>([]);
  const [newCodeInput, setNewCodeInput] = useState('');
  const [newCodeLabel, setNewCodeLabel] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [codeMsg, setCodeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setManageMsg(null);
    fetchAdminCodes()
      .then((res) => setCodes(res.codes))
      .catch(() => {});
  }, [open]);

  const completedPairs = useMemo<ColorPair[]>(() => {
    const res: ColorPair[] = [];
    for (const key of Object.keys(draftPoints)) {
      const cid = Number(key);
      const pts = draftPoints[cid];
      if (pts && pts.length === 2) {
        res.push({ colorId: cid, start: pts[0], end: pts[1] });
      }
    }
    return res.sort((a, b) => a.colorId - b.colorId);
  }, [draftPoints]);

  const levelCounts = useMemo(() => {
    const active = levels.filter((l) => l.isActive !== false);
    return {
      total: active.length,
      easy: active.filter((l) => l.difficulty === 'easy').length,
      medium: active.filter((l) => l.difficulty === 'medium').length,
      hard: active.filter((l) => l.difficulty === 'hard').length,
    };
  }, [levels]);

  const managedLevels = useMemo(() => {
    if (manageFilter === 'all') return levels;
    return levels.filter((l) => l.difficulty === manageFilter);
  }, [levels, manageFilter]);

  if (!open) return null;

  const handleAddReadyMadePack = async (targetDiff: BatchDifficulty, count: number) => {
    setBusy(true);
    setPackMsg(null);
    try {
      const res = await createAdminLevelBatch({ difficulty: targetDiff, count });
      onLevelsUpdated(res.levels);
      const firstNew = res.addedLevels[0];
      const label =
        targetDiff === 'mixed'
          ? 'لە هەموو بەشەکاندا (ئاسان، مامناوەند، قورس)'
          : `لە بەشی ${DIFFICULTY_LABELS[targetDiff].ku}`;
      setPackMsg({
        type: 'ok',
        text: `${res.addedCount} قۆناغی حازر و ١٠٠٪ شیکارکراو ${label} زیادکرا! کۆی گشتی ئێستا ${res.levels.length} قۆناغە.`,
        firstNew,
      });
    } catch (err) {
      setPackMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە دروستکردنی پاکێجی قۆناغەکان.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDifficultyPreset = (nextDiff: Difficulty) => {
    setDifficulty(nextDiff);
    const suggestedGrid = nextDiff === 'easy' ? 5 : nextDiff === 'medium' ? 7 : 9;
    setGridSize(suggestedGrid);
    setDraftPoints({});
    setSolutionPreview(null);
    setStatusMsg(null);
  };

  const handleGridSizeChange = (nextSize: number) => {
    setGridSize(nextSize);
    setDraftPoints({});
    setSolutionPreview(null);
    setStatusMsg(null);
  };

  const handleAutoGenerate = () => {
    const countInDiff = levels.filter((l) => l.difficulty === difficulty).length;
    const generated = generateSolvableLevel({
      id: 'preview',
      title: title.trim() || `قۆناغی ${DIFFICULTY_LABELS[difficulty].ku} #${countInDiff + 1}`,
      difficulty,
      gridSize,
      numPairs: recommendedPairsForGrid(gridSize),
    });

    const nextDraft: Record<number, Point[]> = {};
    for (const p of generated.pairs) {
      nextDraft[p.colorId] = [p.start, p.end];
    }
    setDraftPoints(nextDraft);
    setSolutionPreview(generated.solutionPaths ?? null);
    setShowSolution(true);
    setStatusMsg({
      type: 'ok',
      text: `قۆناغی ${gridSize}×${gridSize} بە ${generated.pairs.length} ڕەنگ بە شێوەی ١٠٠٪ شیکارکراو دروستکرا.`,
    });
  };

  const handleCellClick = (r: number, c: number) => {
    setSolutionPreview(null);
    setStatusMsg(null);
    setDraftPoints((prev) => {
      const next: Record<number, Point[]> = {};
      for (const k of Object.keys(prev)) {
        const cid = Number(k);
        // Remove any point currently occupying (r, c)
        const filtered = prev[cid].filter((pt) => !(pt.r === r && pt.c === c));
        if (filtered.length > 0) next[cid] = filtered;
      }

      // If cell already belonged to selectedColorId, clicking again simply removed it above
      const wasSelectedHere = (prev[selectedColorId] ?? []).some((pt) => pt.r === r && pt.c === c);
      if (wasSelectedHere) {
        return next;
      }

      const currentForColor = next[selectedColorId] ?? [];
      if (currentForColor.length >= 2) {
        // Replace oldest point with the new placement
        next[selectedColorId] = [currentForColor[1], { r, c }];
      } else {
        next[selectedColorId] = [...currentForColor, { r, c }];
      }
      return next;
    });
  };

  const handleVerifySolvable = () => {
    const check = validateCustomLevel(gridSize, completedPairs);
    if (!check.valid) {
      setStatusMsg({ type: 'err', text: check.errorKu ?? 'قۆناغەکە تەواو نییە.' });
      return;
    }
    const solved = solveCustomLevel(gridSize, completedPairs, 50000);
    if (solved.solvable && solved.solutionPaths) {
      setSolutionPreview(solved.solutionPaths);
      setShowSolution(true);
      setStatusMsg({ type: 'ok', text: 'ناوازەیە! ئەم قۆناغە بە تەواوی شیکار دەکرێت و ئامادەیە بۆ بڵاوکردنەوە.' });
    } else if (solved.timedOut) {
      setStatusMsg({
        type: 'ok',
        text: 'تۆڕەکە گەورەیە بۆ پشکنینی خێرا، بەڵام پێکهاتەکەی دروستە. بۆ دڵنیایی ١٠٠٪ دەتوانیت دوگمەی «دروستکردنی خۆکار» بەکاربهێنیت.',
      });
    } else {
      setStatusMsg({
        type: 'err',
        text: 'ئەم ڕێکخستنەی خاڵەکان ناتوانرێت ١٠٠٪ تۆڕەکە پڕ بکاتەوە. شوێنی خاڵەکان بگۆڕە یان دروستکردنی خۆکار بەکاربهێنە.',
      });
    }
  };

  const handlePublish = async (playAfter: boolean) => {
    const countInDiff = levels.filter((l) => l.difficulty === difficulty).length;
    const finalTitle =
      title.trim().length >= 2
        ? title.trim()
        : `قۆناغی ${DIFFICULTY_LABELS[difficulty].ku} #${countInDiff + 1}`;
    const check = validateCustomLevel(gridSize, completedPairs);
    if (!check.valid) {
      setStatusMsg({ type: 'err', text: check.errorKu ?? 'خاڵەکان تەواو نین.' });
      return;
    }

    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await createAdminLevel({
        title: finalTitle,
        difficulty,
        gridSize,
        pairs: completedPairs,
        solutionPaths: solutionPreview ?? undefined,
      });
      onLevelsUpdated(res.levels, playAfter ? res.level : undefined);
      setTitle('');
      setDraftPoints({});
      setSolutionPreview(null);
      if (playAfter) {
        onClose();
      } else {
        setStatusMsg({
          type: 'ok',
          text: `قۆناغی «${res.level.title}» لە بەشی ${DIFFICULTY_LABELS[res.level.difficulty].ku} بڵاوکرایەوە!`,
        });
      }
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە بڵاوکردنەوەی قۆناغ.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleQuickDifficultyChange = async (levelId: string, nextDiff: Difficulty) => {
    setBusy(true);
    setManageMsg(null);
    try {
      const res = await updateAdminLevel(levelId, { difficulty: nextDiff });
      onLevelsUpdated(res.levels);
    } catch (err) {
      setManageMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە گۆڕینی ئاستی قۆناغ.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (level: FlowLevel) => {
    setBusy(true);
    setManageMsg(null);
    try {
      const res = await updateAdminLevel(level.id, { isActive: level.isActive === false });
      onLevelsUpdated(res.levels);
    } catch (err) {
      setManageMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە گۆڕینی دۆخی قۆناغ.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (levelId: string) => {
    setBusy(true);
    setManageMsg(null);
    try {
      const res = await deleteAdminLevel(levelId);
      onLevelsUpdated(res.levels);
    } catch (err) {
      setManageMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە سڕینەوەی قۆناغ.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setCodeMsg(null);
    try {
      const res = await createAdminCode({
        code: newCodeInput.trim() || undefined,
        label: newCodeLabel.trim() || undefined,
      });
      setCodes(res.codes);
      setNewCodeInput('');
      setNewCodeLabel('');
      setCodeMsg({ type: 'ok', text: `کۆدی نوێ «${res.codeRecord.code}» دروستکرا و ئامادەیە بۆ دابەشکردن.` });
    } catch (err) {
      setCodeMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە دروستکردنی کۆد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleCode = async (rec: AccessCodeRecord) => {
    setBusy(true);
    setCodeMsg(null);
    try {
      const res = await updateAdminCode(rec.id, { isActive: !rec.isActive });
      setCodes(res.codes);
    } catch (err) {
      setCodeMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە گۆڕینی دۆخی کۆد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCode = async (id: string) => {
    setBusy(true);
    setCodeMsg(null);
    try {
      const res = await deleteAdminCode(id);
      setCodes(res.codes);
    } catch (err) {
      setCodeMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە سڕینەوەی کۆد.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyCode = async (rec: AccessCodeRecord) => {
    try {
      await navigator.clipboard.writeText(rec.code);
      setCopiedId(rec.id);
      window.setTimeout(() => setCopiedId((prev) => (prev === rec.id ? null : prev)), 1600);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 4) {
      setPwMsg({ type: 'err', text: 'وشەی نهێنی نوێ دەبێت لانیکەم ٤ پیت یان ژمارە بێت.' });
      return;
    }
    setBusy(true);
    try {
      await changeAdminPassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      setPwMsg({ type: 'ok', text: 'وشەی نهێنی ئەدمین بە سەرکەوتوویی گۆڕدرا.' });
    } catch (err) {
      setPwMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'هەڵە لە گۆڕینی وشەی نهێنی.',
      });
    } finally {
      setBusy(false);
    }
  };

  const viewBoxSize = gridSize * 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-studio-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 sm:p-4 flex items-start sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[940px] max-h-[92dvh] my-auto flex flex-col rounded-2xl bg-[#161C26] border border-white/12 text-[#F5F3EE] shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AdminShieldIcon className="w-5 h-5 text-[#E5A93C] shrink-0" />
            <h2 id="admin-studio-title" className="text-base sm:text-lg font-bold">
              ستۆدیۆی ئەدمین — دروستکردن و ڕێکخستنی Flow Free
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#11161F] border border-white/[0.07]">
              <button
                type="button"
                onClick={() => setActiveTab('packs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'packs' ? 'bg-[#222B3B] text-[#E5A93C]' : 'text-[#8E98A8] hover:text-[#F5F3EE]'
                }`}
              >
                پاکێجی حازر
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'create' ? 'bg-[#222B3B] text-[#F5F3EE]' : 'text-[#8E98A8] hover:text-[#F5F3EE]'
                }`}
              >
                دروستکردنی قۆناغ
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'manage' ? 'bg-[#222B3B] text-[#F5F3EE]' : 'text-[#8E98A8] hover:text-[#F5F3EE]'
                }`}
              >
                قۆناغەکان (<span className="font-mono-num">{levels.length}</span>)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('codes')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'codes' ? 'bg-[#222B3B] text-[#E5A93C]' : 'text-[#8E98A8] hover:text-[#F5F3EE]'
                }`}
              >
                کۆدەکان (<span className="font-mono-num">{codes.filter((c) => c.isActive).length}</span>)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="داخستنی ستۆدیۆی ئەدمین"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#F5F3EE] hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        {activeTab === 'packs' ? (
          /* One-Click Ready-Made Packs Tab */
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
            {/* Overview & Current Counts */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div className="max-w-lg">
                <h3 className="text-base font-bold text-[#F5F3EE]">
                  قۆناغی حازری بێسنوور بە یەک کلیک
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                  کاتت نییە خۆت قۆناغ دروست بکەیت؟ لێرەدا دەیان قۆناغی حازر و ١٠٠٪ شیکارکراو بەیەک کلیک زیاد بکە بۆ ئاسان، مامناوەند یان قورس.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div className="px-3.5 py-2 rounded-xl bg-[#11161F] border border-white/[0.07]">
                  <span className="text-[#8E98A8]">ئاسان: </span>
                  <span className="font-mono-num font-bold text-[#10B981]">{levelCounts.easy}</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[#11161F] border border-white/[0.07]">
                  <span className="text-[#8E98A8]">مامناوەند: </span>
                  <span className="font-mono-num font-bold text-[#F59E0B]">{levelCounts.medium}</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[#11161F] border border-white/[0.07]">
                  <span className="text-[#8E98A8]">قورس: </span>
                  <span className="font-mono-num font-bold text-[#E5484D]">{levelCounts.hard}</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-[#1E2634] border border-[#E5A93C]/35">
                  <span className="text-[#D8DEE9]">کۆی گشتی: </span>
                  <span className="font-mono-num font-bold text-[#E5A93C]">{levelCounts.total}</span>
                </div>
              </div>
            </div>

            {packMsg && (
              <div
                role="status"
                className={`px-4 py-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
                  packMsg.type === 'ok'
                    ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#6EE7B7]'
                    : 'bg-[#E5484D]/14 border-[#E5484D]/40 text-[#FCA5A5]'
                }`}
              >
                <span>{packMsg.text}</span>
                {packMsg.firstNew && (
                  <button
                    type="button"
                    onClick={() => {
                      onLevelsUpdated(levels, packMsg.firstNew);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#34D399] text-[#0B1218] font-extrabold text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    یاری بکە لە یەکەم قۆناغی نوێ
                  </button>
                )}
              </div>
            )}

            {/* 4 Instant Ready-Made Pack Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAddReadyMadePack('mixed', 30)}
                className="text-right p-4 rounded-2xl bg-[#1B2330] hover:bg-[#222C3D] disabled:opacity-60 border border-[#E5A93C]/50 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-extrabold text-[#F2BE5C]">
                    +<span className="font-mono-num">30</span> قۆناغی تێکەڵ (پاکێجی گەورە)
                  </div>
                  <div className="text-xs text-[#A1AAB8] mt-1">
                    <span className="font-mono-num">10</span> ئاسان · <span className="font-mono-num">10</span> مامناوەند · <span className="font-mono-num">10</span> قورس بەیەک کلیک
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-[#E5A93C] text-[#10141B] text-xs font-extrabold whitespace-nowrap shrink-0">
                  زیادکردن
                </span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleAddReadyMadePack('easy', 10)}
                className="text-right p-4 rounded-2xl bg-[#121720] hover:bg-[#19202D] disabled:opacity-60 border border-[#10B981]/30 hover:border-[#10B981]/60 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-bold text-[#F5F3EE]">
                    +<span className="font-mono-num text-[#10B981]">10</span> قۆناغی ئاسان
                  </div>
                  <div className="text-xs text-[#8E98A8] mt-1">
                    تۆڕی <span className="font-mono-num">5×5</span> و <span className="font-mono-num">6×6</span> · خێرا و چێژبەخش
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-[#1E2634] text-[#6EE7B7] text-xs font-bold whitespace-nowrap shrink-0">
                  زیادکردن
                </span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleAddReadyMadePack('medium', 10)}
                className="text-right p-4 rounded-2xl bg-[#121720] hover:bg-[#19202D] disabled:opacity-60 border border-[#F59E0B]/30 hover:border-[#F59E0B]/60 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-bold text-[#F5F3EE]">
                    +<span className="font-mono-num text-[#F59E0B]">10</span> قۆناغی مامناوەند
                  </div>
                  <div className="text-xs text-[#8E98A8] mt-1">
                    تۆڕی <span className="font-mono-num">7×7</span> و <span className="font-mono-num">8×8</span> · هاوسەنگی بیرکردنەوە
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-[#1E2634] text-[#FCD34D] text-xs font-bold whitespace-nowrap shrink-0">
                  زیادکردن
                </span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => handleAddReadyMadePack('hard', 10)}
                className="text-right p-4 rounded-2xl bg-[#121720] hover:bg-[#19202D] disabled:opacity-60 border border-[#E5484D]/30 hover:border-[#E5484D]/60 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-bold text-[#F5F3EE]">
                    +<span className="font-mono-num text-[#E5484D]">10</span> قۆناغی قورس
                  </div>
                  <div className="text-xs text-[#8E98A8] mt-1">
                    تۆڕی <span className="font-mono-num">9×9</span> و <span className="font-mono-num">10×10</span> · تەحەدای مامۆستایان
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-[#1E2634] text-[#FCA5A5] text-xs font-bold whitespace-nowrap shrink-0">
                  زیادکردن
                </span>
              </button>
            </div>

            {/* Custom Batch Builder */}
            <div className="p-4 rounded-2xl bg-[#11161F] border border-white/[0.08] space-y-3.5">
              <div className="text-xs font-bold text-[#D8DEE9]">
                یان خۆت بەشی دڵخواز و ژمارەی قۆناغ هەڵبژێرە
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Difficulty Picker */}
                <div className="md:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['mixed', 'easy', 'medium', 'hard'] as BatchDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPackDiff(d)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        packDiff === d
                          ? 'bg-[#222B3B] text-[#F5F3EE] border border-[#E5A93C]/55'
                          : 'bg-[#0E1218] text-[#8E98A8] hover:text-[#F5F3EE] border border-white/[0.06]'
                      }`}
                    >
                      {d === 'mixed' ? 'تێکەڵ' : DIFFICULTY_LABELS[d].ku}
                    </button>
                  ))}
                </div>

                {/* Count Picker */}
                <div className="md:col-span-4 grid grid-cols-5 gap-1.5">
                  {[5, 10, 15, 20, 30].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPackCount(n)}
                      className={`py-2 rounded-lg font-mono-num text-xs font-bold border transition-colors cursor-pointer ${
                        packCount === n
                          ? 'bg-[#222B3B] border-[#E5A93C]/60 text-[#F2BE5C]'
                          : 'bg-[#0E1218] border-white/[0.06] text-[#8E98A8] hover:text-[#F5F3EE]'
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>

                {/* Action Button */}
                <div className="md:col-span-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleAddReadyMadePack(packDiff, packCount)}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] disabled:opacity-60 text-[#10141B] font-extrabold text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {busy ? 'دروستدەکرێت...' : `زیادکردنی +${packCount} قۆناغ`}
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-[#7B8698]">
                هەڵبژێردراو: {BATCH_DIFFICULTY_LABELS[packDiff]} ·{' '}
                <span className="font-mono-num">{packCount}</span> قۆناغی نوێی ١٠٠٪ شیکارکراو
              </div>
            </div>
          </div>
        ) : activeTab === 'create' ? (
          <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Right Controls Form */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <label htmlFor="admin-level-title" className="block text-xs font-medium text-[#B5BECB] mb-1.5">
                  ناونیشانی قۆناغ (ئارەزوومەندانە)
                </label>
                <input
                  id="admin-level-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ئەگەر بەتاڵ بێت خۆکارانە ناو دادەنرێت"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] text-sm focus:outline-none focus:border-[#E5A93C]"
                />
              </div>

              {/* Difficulty Choice */}
              <div>
                <div className="text-xs font-medium text-[#B5BECB] mb-1.5">ئاستی قورسی</div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#11161F] border border-white/[0.07]">
                  {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => handleDifficultyPreset(d)}
                      className={`py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        difficulty === d
                          ? 'bg-[#222B3B] text-[#F5F3EE] border border-[#E5A93C]/45'
                          : 'text-[#8E98A8] hover:text-[#F5F3EE] border border-transparent'
                      }`}
                    >
                      {DIFFICULTY_LABELS[d].ku}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Size */}
              <div>
                <div className="flex items-center justify-between text-xs text-[#B5BECB] mb-1.5">
                  <span>قەبارەی تۆڕ</span>
                  <span className="font-mono-num text-[#E5A93C]">{gridSize}×{gridSize}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[5, 6, 7, 8, 9, 10].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleGridSizeChange(s)}
                      className={`py-2 rounded-lg font-mono-num text-xs font-bold border transition-colors cursor-pointer ${
                        gridSize === s
                          ? 'bg-[#222B3B] border-[#E5A93C]/60 text-[#F5F3EE]'
                          : 'bg-[#11161F] border-white/[0.07] text-[#8E98A8] hover:text-[#F5F3EE]'
                      }`}
                    >
                      {s}×{s}
                    </button>
                  ))}
                </div>
              </div>

              {/* One-Click Auto-Generator + Verify + Clear */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#1E293B] hover:bg-[#273549] border border-[#E5A93C]/45 text-[#F2BE5C] font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  دروستکردنی خۆکار (١٠٠٪ شیکارکراو)
                </button>
                <button
                  type="button"
                  onClick={handleVerifySolvable}
                  className="px-3.5 py-2.5 rounded-xl bg-[#11161F] hover:bg-[#1B2330] border border-white/10 text-[#D8DEE9] font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  پشکنینی شیکاری
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftPoints({});
                    setSolutionPreview(null);
                    setStatusMsg(null);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-[#11161F] hover:bg-[#1B2330] border border-white/10 text-[#9CA3AF] hover:text-[#F5F3EE] text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  پاککردنەوە
                </button>
              </div>

              {/* Color Palette for Manual Placement */}
              <div>
                <div className="flex items-center justify-between text-xs text-[#B5BECB] mb-2">
                  <span>دانانی خاڵ بە دەست (کلیک لەسەر دوو خانە بکە)</span>
                  <span>
                    <span className="font-mono-num font-bold text-[#F5F3EE]">{completedPairs.length}</span> جووت ئامادە
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MINERAL_PALETTE.map((c) => {
                    const placedCount = draftPoints[c.id]?.length ?? 0;
                    const active = selectedColorId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedColorId(c.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-[#222B3B] border-[#E5A93C] text-[#F5F3EE]'
                            : 'bg-[#11161F] border-white/[0.07] text-[#9CA3AF] hover:text-[#F5F3EE]'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.nameKu}</span>
                        <span className="font-mono-num text-[10px] opacity-75">{placedCount}/2</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {statusMsg && (
                <div
                  role="status"
                  className={`px-3.5 py-2.5 rounded-xl border text-xs ${
                    statusMsg.type === 'ok'
                      ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#6EE7B7]'
                      : 'bg-[#E5484D]/14 border-[#E5484D]/40 text-[#FCA5A5]'
                  }`}
                >
                  {statusMsg.text}
                </div>
              )}

              {/* Publish Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlePublish(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] disabled:opacity-60 text-[#10141B] font-extrabold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  بڵاوکردنەوەی قۆناغ
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handlePublish(true)}
                  className="py-3 px-4 rounded-xl bg-[#1E2634] hover:bg-[#273245] border border-white/12 text-[#F5F3EE] font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  بڵاوکردنەوە و یاری کردن
                </button>
              </div>
            </div>

            {/* Left Interactive Editor Preview Grid */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="w-full max-w-[380px]">
                <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-2">
                  <span>پێشبینینی تۆڕی قۆناغ</span>
                  {solutionPreview && (
                    <button
                      type="button"
                      onClick={() => setShowSolution((v) => !v)}
                      className="text-[#E5A93C] hover:underline cursor-pointer"
                    >
                      {showSolution ? 'شاردنەوەی شیکار' : 'پیشاندانی شیکار'}
                    </button>
                  )}
                </div>

                <div
                  dir="ltr"
                  className="relative aspect-square w-full rounded-2xl p-2.5 bg-[#10141B] border border-white/10"
                >
                  <div className="relative w-full h-full rounded-xl overflow-hidden bg-[#0B0F16] border border-white/[0.06]">
                    <div
                      className="grid w-full h-full"
                      style={{
                        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                        const r = Math.floor(idx / gridSize);
                        const c = idx % gridSize;
                        return (
                          <button
                            key={`${r}-${c}`}
                            type="button"
                            onClick={() => handleCellClick(r, c)}
                            aria-label={`دانانی خاڵ لە خانە ${r + 1}-${c + 1}`}
                            className="border border-white/[0.05] hover:bg-white/[0.06] transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#E5A93C]"
                          />
                        );
                      })}
                    </div>

                    {/* Preview Pipes & Placed Nodes */}
                    <svg
                      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      aria-hidden="true"
                    >
                      {showSolution &&
                        solutionPreview &&
                        Object.entries(solutionPreview).map(([k, pts]) => {
                          if (!pts || pts.length < 2) return null;
                          const pigment = getMineralColor(Number(k));
                          const d = pts
                            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.c * 100 + 50} ${p.r * 100 + 50}`)
                            .join(' ');
                          return (
                            <path
                              key={`prev-pipe-${k}`}
                              d={d}
                              fill="none"
                              stroke={pigment.hex}
                              strokeOpacity="0.45"
                              strokeWidth="30"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          );
                        })}

                      {Object.entries(draftPoints).map(([k, pts]) => {
                        const pigment = getMineralColor(Number(k));
                        return pts.map((pt, i) => (
                          <g key={`prev-node-${k}-${i}`}>
                            <circle
                              cx={pt.c * 100 + 50}
                              cy={pt.r * 100 + 50}
                              r="32"
                              fill="#0A0E14"
                            />
                            <circle
                              cx={pt.c * 100 + 50}
                              cy={pt.r * 100 + 50}
                              r="29"
                              fill={pigment.hex}
                            />
                          </g>
                        ));
                      })}
                    </svg>

                    {/* Node Symbols */}
                    <div className="absolute inset-0 pointer-events-none">
                      {Object.entries(draftPoints).map(([k, pts]) => {
                        const pigment = getMineralColor(Number(k));
                        return pts.map((pt, i) => (
                          <div
                            key={`prev-sym-${k}-${i}`}
                            className="absolute flex items-center justify-center"
                            style={{
                              left: `${(pt.c / gridSize) * 100}%`,
                              top: `${(pt.r / gridSize) * 100}%`,
                              width: `${100 / gridSize}%`,
                              height: `${100 / gridSize}%`,
                            }}
                          >
                            <NodeSymbolSvg symbol={pigment.symbol} size={11} />
                          </div>
                        ));
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'manage' ? (
          /* Manage Existing Levels Tab */
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
            {manageMsg && (
              <div
                role="status"
                className={`px-3.5 py-2.5 rounded-xl border text-xs ${
                  manageMsg.type === 'ok'
                    ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#6EE7B7]'
                    : 'bg-[#E5484D]/14 border-[#E5484D]/40 text-[#FCA5A5]'
                }`}
              >
                {manageMsg.text}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.07]">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'easy', 'medium', 'hard'] as const).map((f) => {
                  const count =
                    f === 'all' ? levels.length : levels.filter((l) => l.difficulty === f).length;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setManageFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        manageFilter === f
                          ? 'bg-[#222B3B] text-[#F5F3EE] border border-[#E5A93C]/45'
                          : 'bg-[#11161F] text-[#8E98A8] hover:text-[#F5F3EE] border border-white/[0.06]'
                      }`}
                    >
                      <span>{f === 'all' ? 'هەمووی' : DIFFICULTY_LABELS[f].ku}</span>{' '}
                      <span className="font-mono-num opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('packs')}
                className="px-3 py-1.5 rounded-lg bg-[#1E2634] hover:bg-[#273245] border border-[#E5A93C]/35 text-xs font-bold text-[#F2BE5C] cursor-pointer whitespace-nowrap"
              >
                + زیادکردنی پاکێجی حازر
              </button>
            </div>

            <div className="divide-y divide-white/[0.07]">
              {managedLevels.map((level) => (
                <div
                  key={level.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-bold text-sm text-[#F5F3EE] flex items-center gap-2">
                      <span>{level.title}</span>
                      {level.isCustom && (
                        <span className="text-xs font-normal text-[#E5A93C]">· دروستکراوی ئەدمین</span>
                      )}
                    </div>
                    <div className="text-xs text-[#8E98A8] mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono-num">{level.gridSize}×{level.gridSize}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <span className="font-mono-num">{level.pairs.length}</span> ڕەنگ
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        <span className="font-mono-num">{level.clearCount ?? 0}</span> جار تەواوکراوە
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`ئاستی قورسی ${level.title}`}
                      value={level.difficulty}
                      disabled={busy}
                      onChange={(e) => handleQuickDifficultyChange(level.id, e.target.value as Difficulty)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0E1218] border border-white/12 text-xs text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
                    >
                      <option value="easy">ئاسان</option>
                      <option value="medium">مامناوەند</option>
                      <option value="hard">قورس</option>
                    </select>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleActive(level)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                        level.isActive !== false
                          ? 'bg-[#10B981]/12 border-[#10B981]/35 text-[#6EE7B7]'
                          : 'bg-[#11161F] border-white/10 text-[#8E98A8]'
                      }`}
                    >
                      {level.isActive !== false && <CheckStampIcon className="w-3.5 h-3.5" />}
                      <span>{level.isActive !== false ? 'چالاک' : 'شاراوە'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        onLevelsUpdated(levels, level);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#1E2634] hover:bg-[#273245] text-xs font-semibold text-[#F5F3EE] cursor-pointer"
                    >
                      یاری
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(level.id)}
                      aria-label={`سڕینەوەی ${level.title}`}
                      className="px-3 py-1.5 rounded-lg bg-[#E5484D]/12 hover:bg-[#E5484D]/25 border border-[#E5484D]/35 text-xs font-semibold text-[#FCA5A5] cursor-pointer"
                    >
                      سڕینەوە
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Access Codes & Admin Security Tab */
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
            {/* Create New Code Form */}
            <form onSubmit={handleCreateCode} className="space-y-3 pb-5 border-b border-white/[0.08]">
              <div className="text-sm font-bold text-[#F5F3EE]">
                دروستکردنی کۆدی چوونەژوورەوە بۆ یاریزانان
              </div>
              <p className="text-xs text-[#9CA3AF]">
                ئەم کۆدە بدە بە یاریزانان؛ هەر کەسێک کۆدەکە و ناوی خۆی بنووسێت دەتوانێت یاری بکات و ناوی لە لیستی یەکەمینەکاندا تۆمار دەبێت.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                <input
                  type="text"
                  dir="ltr"
                  value={newCodeInput}
                  onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                  placeholder="FLOW-2026"
                  aria-label="کۆدی نوێ"
                  className="sm:col-span-4 px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] font-mono-num text-xs focus:outline-none focus:border-[#E5A93C]"
                />
                <input
                  type="text"
                  value={newCodeLabel}
                  onChange={(e) => setNewCodeLabel(e.target.value)}
                  placeholder="تێبینی (نموونە: گرووپی هاوڕێیان)"
                  aria-label="تێبینی کۆد"
                  className="sm:col-span-5 px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] text-xs focus:outline-none focus:border-[#E5A93C]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="sm:col-span-3 px-4 py-2.5 rounded-xl bg-[#E5A93C] hover:bg-[#F2BE5C] disabled:opacity-60 text-[#10141B] font-extrabold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  دروستکردنی کۆدی نوێ
                </button>
              </div>

              {codeMsg && (
                <div
                  role="status"
                  className={`px-3.5 py-2 rounded-xl border text-xs ${
                    codeMsg.type === 'ok'
                      ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#6EE7B7]'
                      : 'bg-[#E5484D]/14 border-[#E5484D]/40 text-[#FCA5A5]'
                  }`}
                >
                  {codeMsg.text}
                </div>
              )}
            </form>

            {/* Active & Inactive Codes List */}
            <div>
              <div className="text-xs font-semibold text-[#9CA3AF] mb-2">
                کۆدە تۆمارکراوەکان (<span className="font-mono-num">{codes.length}</span>)
              </div>
              {codes.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#8E98A8]">
                  هیچ کۆدێک نییە؛ کۆدێکی نوێ دروست بکە بۆ ئەوەی یاریزانان بتوانن بچنە ژوورەوە.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.07]">
                  {codes.map((rec) => (
                    <div
                      key={rec.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          dir="ltr"
                          className="font-mono-num text-base font-bold tracking-wider text-[#F2BE5C]"
                        >
                          {rec.code}
                        </span>
                        <span aria-hidden="true" className="text-[#5B6575]">·</span>
                        <span className="text-xs text-[#D8DEE9]">{rec.label}</span>
                        <span aria-hidden="true" className="text-[#5B6575]">·</span>
                        <span className="text-xs text-[#8E98A8]">
                          <span className="font-mono-num">{rec.usageCount}</span> یاریزان
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(rec)}
                          className="px-3 py-1.5 rounded-lg bg-[#1E2634] hover:bg-[#273245] text-xs font-semibold text-[#F5F3EE] cursor-pointer whitespace-nowrap"
                        >
                          {copiedId === rec.id ? 'کۆپیکرا!' : 'کۆپی'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleToggleCode(rec)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            rec.isActive
                              ? 'bg-[#10B981]/12 border-[#10B981]/35 text-[#6EE7B7]'
                              : 'bg-[#11161F] border-white/10 text-[#8E98A8]'
                          }`}
                        >
                          {rec.isActive && <CheckStampIcon className="w-3.5 h-3.5" />}
                          <span>{rec.isActive ? 'چالاک' : 'ناچالاک'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleDeleteCode(rec.id)}
                          aria-label={`سڕینەوەی کۆدی ${rec.code}`}
                          className="px-3 py-1.5 rounded-lg bg-[#E5484D]/12 hover:bg-[#E5484D]/25 border border-[#E5484D]/35 text-xs font-semibold text-[#FCA5A5] cursor-pointer whitespace-nowrap"
                        >
                          سڕینەوە
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Admin Password Security Update */}
            <form onSubmit={handlePasswordChange} className="pt-5 border-t border-white/[0.08] space-y-3">
              <div className="text-sm font-bold text-[#F5F3EE]">گۆڕینی وشەی نهێنی ئەدمین</div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <input
                  type="password"
                  dir="ltr"
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                  placeholder="وشەی نهێنی ئێستا"
                  aria-label="وشەی نهێنی ئێستا"
                  className="sm:col-span-4 px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] text-xs focus:outline-none focus:border-[#E5A93C]"
                  required
                />
                <input
                  type="password"
                  dir="ltr"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="وشەی نهێنی نوێ"
                  aria-label="وشەی نهێنی نوێ"
                  className="sm:col-span-5 px-3.5 py-2.5 rounded-xl bg-[#0E1218] border border-white/12 text-[#F5F3EE] placeholder:text-[#5B6575] text-xs focus:outline-none focus:border-[#E5A93C]"
                  required
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="sm:col-span-3 px-4 py-2.5 rounded-xl bg-[#1E2634] hover:bg-[#273245] border border-white/12 text-[#F5F3EE] font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  پاشەکەوتکردن
                </button>
              </div>
              {pwMsg && (
                <div
                  role="status"
                  className={`px-3.5 py-2 rounded-xl border text-xs ${
                    pwMsg.type === 'ok'
                      ? 'bg-[#10B981]/12 border-[#10B981]/40 text-[#6EE7B7]'
                      : 'bg-[#E5484D]/14 border-[#E5484D]/40 text-[#FCA5A5]'
                  }`}
                >
                  {pwMsg.text}
                </div>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
