import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCellOwnerMap,
  getEndpointAt,
  isAdjacent,
  isPairConnected,
  pointKey,
  pointsEqual,
  startDrawingAt,
  stepDrawingTo,
} from '../game/flowEngine';
import { getMineralColor } from '../game/palette';
import type { FlowLevel, FlowPaths, Point } from '../game/types';
import { NodeSymbolSvg } from './GameIcons';

interface FlowBoardProps {
  level: FlowLevel;
  paths: FlowPaths;
  onPathsChange: (nextPaths: FlowPaths, meta: {
    action: 'start' | 'step' | 'connect' | 'cut';
    colorId: number;
    newStroke?: boolean;
  }) => void;
  disabled?: boolean;
  showSymbols?: boolean;
  justWon?: boolean;
  compact?: boolean;
  onInteractStart?: () => void;
}

export function FlowBoard({
  level,
  paths,
  onPathsChange,
  disabled = false,
  showSymbols = true,
  justWon = false,
  compact = false,
  onInteractStart,
}: FlowBoardProps) {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [activeColorId, setActiveColorId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [justConnectedColor, setJustConnectedColor] = useState<number | null>(null);
  const [focusedCell, setFocusedCell] = useState<Point | null>(null);

  const activeColorRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const pathsRef = useRef<FlowPaths>(paths);
  pathsRef.current = paths;

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
    activeColorRef.current = null;
    setIsDragging(false);
    setActiveColorId(null);
  }, []);

  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isDraggingRef.current) {
        stopDragging();
      }
    };
    window.addEventListener('pointerup', handleGlobalEnd);
    window.addEventListener('pointercancel', handleGlobalEnd);
    window.addEventListener('blur', handleGlobalEnd);
    return () => {
      window.removeEventListener('pointerup', handleGlobalEnd);
      window.removeEventListener('pointercancel', handleGlobalEnd);
      window.removeEventListener('blur', handleGlobalEnd);
    };
  }, [stopDragging]);

  useEffect(() => {
    // Reset active stroke when level changes
    stopDragging();
    setFocusedCell(null);
  }, [level.id, stopDragging]);

  const ownerMap = useMemo(() => buildCellOwnerMap(paths), [paths]);

  const connectedSet = useMemo(() => {
    const s = new Set<number>();
    for (const pair of level.pairs) {
      if (isPairConnected(pair, paths[pair.colorId])) {
        s.add(pair.colorId);
      }
    }
    return s;
  }, [level.pairs, paths]);

  const getCellFromClientPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const el = boardRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null;
      const c = Math.min(level.gridSize - 1, Math.max(0, Math.floor((relX / rect.width) * level.gridSize)));
      const r = Math.min(level.gridSize - 1, Math.max(0, Math.floor((relY / rect.height) * level.gridSize)));
      return { r, c };
    },
    [level.gridSize]
  );

  const attemptStep = useCallback(
    (target: Point, colorId: number) => {
      const curPaths = pathsRef.current;
      const curSeg = curPaths[colorId];
      if (!curSeg || curSeg.length === 0) return;

      const head = curSeg[curSeg.length - 1];
      if (pointsEqual(head, target)) return;

      // Support smooth orthogonal interpolation if pointer moved 2 cells diagonally/orthogonally fast
      const stepsToTry: Point[] = [];
      if (isAdjacent(head, target)) {
        stepsToTry.push(target);
      } else {
        const dr = target.r - head.r;
        const dc = target.c - head.c;
        if (Math.abs(dr) + Math.abs(dc) === 2) {
          if (dr === 0) {
            stepsToTry.push({ r: head.r, c: head.c + Math.sign(dc) }, target);
          } else if (dc === 0) {
            stepsToTry.push({ r: head.r + Math.sign(dr), c: head.c }, target);
          } else {
            // Diagonal fast drag: try horizontal-then-vertical, fallback to vertical-then-horizontal
            const midA = { r: head.r, c: target.c };
            const resA = stepDrawingTo(level, curPaths, colorId, midA);
            if (resA.changed) {
              stepsToTry.push(midA, target);
            } else {
              stepsToTry.push({ r: target.r, c: head.c }, target);
            }
          }
        }
      }

      let workingPaths = curPaths;
      for (const nextPt of stepsToTry) {
        const res = stepDrawingTo(level, workingPaths, colorId, nextPt);
        if (!res.changed) break;
        workingPaths = res.paths;
        pathsRef.current = workingPaths;
        if (res.justConnected) {
          setJustConnectedColor(colorId);
          if (settleTimerRef.current !== null) {
            window.clearTimeout(settleTimerRef.current);
          }
          settleTimerRef.current = window.setTimeout(
            () => setJustConnectedColor((prev) => (prev === colorId ? null : prev)),
            260
          );
        }
        onPathsChange(workingPaths, {
          action: res.justConnected ? 'connect' : res.cutColorId !== null ? 'cut' : 'step',
          colorId,
        });
      }
    },
    [level, onPathsChange]
  );

  const handleBoardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const cell = getCellFromClientPoint(e.clientX, e.clientY);
      if (!cell) return;

      onInteractStart?.();
      setFocusedCell(cell);

      // If user clicked an adjacent cell while a color is already selected via keyboard/click, step to it
      if (!isDraggingRef.current && activeColorRef.current !== null) {
        const activeSeg = pathsRef.current[activeColorRef.current];
        if (activeSeg && activeSeg.length > 0 && isAdjacent(activeSeg[activeSeg.length - 1], cell)) {
          isDraggingRef.current = true;
          setIsDragging(true);
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Ignore capture errors in synthetic test events
          }
          attemptStep(cell, activeColorRef.current);
          return;
        }
      }

      const started = startDrawingAt(level, pathsRef.current, cell);
      if (started.activeColorId !== null) {
        activeColorRef.current = started.activeColorId;
        isDraggingRef.current = true;
        setActiveColorId(started.activeColorId);
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture errors
        }
        if (started.changed) {
          pathsRef.current = started.paths;
          onPathsChange(started.paths, {
            action: 'start',
            colorId: started.activeColorId,
            newStroke: true,
          });
        }
      }
    },
    [disabled, getCellFromClientPoint, level, onInteractStart, onPathsChange, attemptStep]
  );

  const handleBoardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !isDraggingRef.current || activeColorRef.current === null) return;
      const cell = getCellFromClientPoint(e.clientX, e.clientY);
      if (!cell) return;
      attemptStep(cell, activeColorRef.current);
    },
    [disabled, getCellFromClientPoint, attemptStep]
  );

  const handleBoardPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
      isDraggingRef.current = false;
      setIsDragging(false);
    },
    []
  );

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, cell: Point) => {
      if (disabled) return;
      let dr = 0;
      let dc = 0;
      if (e.key === 'ArrowUp') dr = -1;
      else if (e.key === 'ArrowDown') dr = 1;
      else if (e.key === 'ArrowLeft') dc = -1;
      else if (e.key === 'ArrowRight') dc = 1;
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const started = startDrawingAt(level, pathsRef.current, cell);
        if (started.activeColorId !== null) {
          activeColorRef.current = started.activeColorId;
          setActiveColorId(started.activeColorId);
          if (started.changed) {
            pathsRef.current = started.paths;
            onPathsChange(started.paths, {
              action: 'start',
              colorId: started.activeColorId,
              newStroke: true,
            });
          }
        }
        return;
      } else {
        return;
      }

      e.preventDefault();
      const nr = Math.max(0, Math.min(level.gridSize - 1, cell.r + dr));
      const nc = Math.max(0, Math.min(level.gridSize - 1, cell.c + dc));
      const nextPt = { r: nr, c: nc };
      setFocusedCell(nextPt);

      if (activeColorRef.current !== null) {
        attemptStep(nextPt, activeColorRef.current);
      }

      const nextBtn = boardRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${nr}-${nc}"]`);
      nextBtn?.focus();
    },
    [disabled, level, onPathsChange, attemptStep]
  );

  // SVG coordinate helper: each cell is 100x100 units in viewBox
  const viewBoxSize = level.gridSize * 100;
  const pipeWidth = level.gridSize >= 9 ? 36 : level.gridSize >= 7 ? 38 : 40;
  const nodeRadius = level.gridSize >= 9 ? 32 : 34;

  const boardMaxSize = compact
    ? 'w-full max-w-[330px]'
    : level.gridSize >= 9
      ? 'w-full max-w-[min(86vw,560px)]'
      : 'w-full max-w-[min(86vw,500px)]';

  return (
    <div
      dir="ltr"
      className={`relative select-none ${boardMaxSize} aspect-square mx-auto rounded-2xl p-2.5 sm:p-3 bg-[#121720] border border-white/10 shadow-[0_22px_50px_rgba(0,0,0,0.55)]`}
    >
      {/* Inner milled stone cavity */}
      <div
        ref={boardRef}
        data-testid="flow-board"
        data-grid-size={level.gridSize}
        onPointerDown={handleBoardPointerDown}
        onPointerMove={handleBoardPointerMove}
        onPointerUp={handleBoardPointerUp}
        className="relative w-full h-full rounded-xl overflow-hidden bg-[#0E131B] border border-white/[0.06] touch-none"
      >
        {/* Interactive Cell Grid Layer */}
        <div
          className="grid w-full h-full"
          style={{
            gridTemplateColumns: `repeat(${level.gridSize}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${level.gridSize}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: level.gridSize * level.gridSize }).map((_, idx) => {
            const r = Math.floor(idx / level.gridSize);
            const c = idx % level.gridSize;
            const pt = { r, c };
            const endpoint = getEndpointAt(level.pairs, pt);
            const ownerColorId = ownerMap.get(pointKey(pt));
            const cellColorId = endpoint ? endpoint.colorId : ownerColorId;
            const pigment = cellColorId !== undefined ? getMineralColor(cellColorId) : null;
            const isFocused = focusedCell?.r === r && focusedCell?.c === c;
            const isActiveHead =
              activeColorId !== null &&
              paths[activeColorId] &&
              paths[activeColorId].length > 0 &&
              pointsEqual(paths[activeColorId][paths[activeColorId].length - 1], pt);

            const ariaLabel = endpoint
              ? `خانە ${r + 1}-${c + 1} · خاڵی ${getMineralColor(endpoint.colorId).nameKu}`
              : pigment
                ? `خانە ${r + 1}-${c + 1} · ڕێڕەوی ${pigment.nameKu}`
                : `خانە ${r + 1}-${c + 1} · بەتاڵ`;

            return (
              <button
                key={`${r}-${c}`}
                type="button"
                data-cell={`${r}-${c}`}
                aria-label={ariaLabel}
                onKeyDown={(e) => handleCellKeyDown(e, pt)}
                className={`relative border border-white/[0.045] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C] focus-visible:z-20 ${
                  disabled ? 'cursor-default' : 'cursor-pointer hover:bg-white/[0.04]'
                } ${isFocused ? 'bg-white/[0.03]' : ''}`}
                style={{
                  backgroundColor: pigment ? pigment.trackHex : undefined,
                  boxShadow: isActiveHead && pigment ? `inset 0 0 0 2px ${pigment.strokeHex}` : undefined,
                }}
              />
            );
          })}
        </div>

        {/* Precision SVG Pipes & Mineral Nodes Layer */}
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          {/* Drawn Pipes */}
          {level.pairs.map((pair) => {
            const pts = paths[pair.colorId];
            if (!pts || pts.length < 2) return null;
            const pigment = getMineralColor(pair.colorId);
            const d = pts
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.c * 100 + 50} ${p.r * 100 + 50}`)
              .join(' ');
            const isConnected = connectedSet.has(pair.colorId);

            return (
              <g key={`pipe-${pair.colorId}`}>
                {/* Recessed dark casing shadow */}
                <path
                  d={d}
                  fill="none"
                  stroke="rgba(7, 10, 15, 0.72)"
                  strokeWidth={pipeWidth + 8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Main mineral ceramic pipe */}
                <path
                  d={d}
                  fill="none"
                  stroke={pigment.hex}
                  strokeWidth={pipeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Crisp top specular ridge */}
                <path
                  d={d}
                  fill="none"
                  stroke={pigment.strokeHex}
                  strokeOpacity={isConnected ? 0.65 : 0.35}
                  strokeWidth={Math.max(4, pipeWidth * 0.2)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}

          {/* Fixed Endpoints (Mineral Nodes) */}
          {level.pairs.map((pair) => {
            const pigment = getMineralColor(pair.colorId);
            const isConnected = connectedSet.has(pair.colorId);
            const isActive = activeColorId === pair.colorId && isDragging;
            const isSettling = justConnectedColor === pair.colorId;

            return [pair.start, pair.end].map((pt, endIdx) => {
              const cx = pt.c * 100 + 50;
              const cy = pt.r * 100 + 50;
              return (
                <g
                  key={`node-${pair.colorId}-${endIdx}`}
                  style={{
                    transformOrigin: `${cx}px ${cy}px`,
                  }}
                  className={isSettling ? 'animate-node-settle' : undefined}
                >
                  {/* Active halo ring */}
                  {(isActive || isConnected) && (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={nodeRadius + (isActive ? 7 : 4)}
                      fill="none"
                      stroke={pigment.strokeHex}
                      strokeOpacity={isActive ? 0.75 : 0.35}
                      strokeWidth={isActive ? 4 : 2.5}
                    />
                  )}
                  {/* Outer dark bevel ring */}
                  <circle cx={cx} cy={cy} r={nodeRadius + 2} fill="#090D13" />
                  {/* Main mineral disc */}
                  <circle cx={cx} cy={cy} r={nodeRadius - 1} fill={pigment.hex} />
                  {/* Subtle top glaze highlight */}
                  <path
                    d={`M ${cx - nodeRadius * 0.55} ${cy - nodeRadius * 0.35} A ${nodeRadius * 0.7} ${nodeRadius * 0.7} 0 0 1 ${cx + nodeRadius * 0.55} ${cy - nodeRadius * 0.35}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.45)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </g>
              );
            });
          })}
        </svg>

        {/* Non-hue Accessibility Symbols overlaid cleanly on endpoints */}
        {showSymbols && (
          <div className="absolute inset-0 pointer-events-none">
            {level.pairs.map((pair) => {
              const pigment = getMineralColor(pair.colorId);
              const symbolSize = level.gridSize >= 9 ? 11 : level.gridSize >= 7 ? 13 : 15;
              return [pair.start, pair.end].map((pt, endIdx) => (
                <div
                  key={`sym-${pair.colorId}-${endIdx}`}
                  className="absolute flex items-center justify-center"
                  style={{
                    left: `${(pt.c / level.gridSize) * 100}%`,
                    top: `${(pt.r / level.gridSize) * 100}%`,
                    width: `${100 / level.gridSize}%`,
                    height: `${100 / level.gridSize}%`,
                  }}
                >
                  <NodeSymbolSvg symbol={pigment.symbol} size={symbolSize} />
                </div>
              ));
            })}
          </div>
        )}

        {/* Stage Clear Gold Rim Shimmer */}
        {justWon && (
          <div
            aria-hidden="true"
            className="animate-win-flash pointer-events-none absolute inset-0 rounded-xl border-4 border-[#E5A93C] shadow-[inset_0_0_38px_rgba(229,169,60,0.42)]"
          />
        )}
      </div>
    </div>
  );
}
