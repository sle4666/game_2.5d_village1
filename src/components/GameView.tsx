import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { GRID_D, GRID_W, BUILDINGS, TICK_MS, SEASON_ORDER } from '@/game/constants';
import { screenToTile, tileToScreen, type CameraView } from '@/game/iso';
import {
  canPlace, createGame, placeBuilding, tick, seedAgents, startTraining,
  setSoundCallback, type GameState,
} from '@/game/engine';
import { render } from '@/game/render';
import type { CitizenClass, BuildingTypeId, DifficultyId } from '@/game/types';
import {
  initAudio, startAmbient, startMusic, switchAmbient, playSound,
  type SoundEvent,
} from '@/game/AudioSystem';
import { saveGame, loadGame } from '@/game/storage';
import ResourceBar from './ResourceBar';
import BuildMenu from './BuildMenu';
import TimeControls from './TimeControls';
import AdvisorBar from './AdvisorBar';
import SocietyPanel from './SocietyPanel';
import GuestsPanel from './GuestsPanel';
import SettingsPanel from './SettingsPanel';
import PauseMenu from './PauseMenu';

interface GameViewProps {
  difficulty: DifficultyId;
  onExit: () => void;
  loadedState?: GameState | null;
}

export default function GameView({ difficulty, onExit, loadedState }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(loadedState ?? createGame(difficulty));
  const viewRef = useRef<CameraView>({ x: 0, y: 0, zoom: 1 });
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number; down: boolean; dragStartX: number; dragStartY: number; dragging: boolean }>({
    x: 0, y: 0, down: false, dragStartX: 0, dragStartY: 0, dragging: false,
  });
  const buildTypeRef = useRef<BuildingTypeId | null>(null);
  const lastSeasonRef = useRef<string>(stateRef.current.season);
  const [, forceRender] = useState(0);
  const [uiResources, setUiResources] = useState(stateRef.current.resources);
  const [uiSeason, setUiSeason] = useState(stateRef.current.season);
  const [uiDay, setUiDay] = useState(stateRef.current.day);
  const [uiTotalDays, setUiTotalDays] = useState(stateRef.current.totalDays);
  const [uiSpeed, setUiSpeed] = useState(stateRef.current.speed);
  const [uiPop, setUiPop] = useState(stateRef.current.population);
  const [uiHousing, setUiHousing] = useState(stateRef.current.housingUsed);
  const [uiLog, setUiLog] = useState<string[]>(stateRef.current.log);
  const [uiClassCounts, setUiClassCounts] = useState<Record<CitizenClass, number>>(stateRef.current.classCounts);
  const [uiMasterPool, setUiMasterPool] = useState<{ classId: CitizenClass }[]>(stateRef.current.masterPool);
  const [uiTraining, setUiTraining] = useState(stateRef.current.training.length);
  const [uiGuests, setUiGuests] = useState(stateRef.current.guests);
  const [buildType, setBuildType] = useState<BuildingTypeId | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [showPause, setShowPause] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const syncUi = useCallback(() => {
    const s = stateRef.current;
    setUiResources({ ...s.resources });
    setUiSeason(s.season);
    setUiDay(s.day);
    setUiTotalDays(s.totalDays);
    setUiSpeed(s.speed);
    setUiPop(s.population);
    setUiHousing(s.housingUsed);
    setUiLog([...s.log]);
    setUiClassCounts({ ...s.classCounts });
    setUiMasterPool([...s.masterPool]);
    setUiTraining(s.training.length);
    setUiGuests([...s.guests]);
    if (s.gameOver) {
      setGameOver(true);
      setGameOverReason(s.gameOverReason);
    }
  }, []);

  // Initialize audio + sound callback bridge.
  useEffect(() => {
    initAudio();
    startAmbient(stateRef.current.season);
    startMusic();

    // Bridge engine sound events to AudioSystem.
    setSoundCallback((event: SoundEvent) => {
      if (event === 'winterComes') {
        switchAmbient('winter');
      }
      playSound(event);
    });

    return () => { setSoundCallback(null); };
  }, []);

  // Center camera initially.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = GRID_W / 2;
    const cy = GRID_D / 2;
    const p = tileToScreen(cx, cy, { x: 0, y: 0, zoom: 1 });
    viewRef.current = {
      x: canvas.width / 2 - p.x,
      y: canvas.height / 2 - p.y,
      zoom: 1,
    };
  }, []);

  // Game loop
  useEffect(() => {
    let lastTick = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const view = viewRef.current;
      const keys = keysRef.current;
      const moveSpeed = 8 / view.zoom;
      if (keys.has('w') || keys.has('arrowup')) view.y += moveSpeed;
      if (keys.has('s') || keys.has('arrowdown')) view.y -= moveSpeed;
      if (keys.has('a') || keys.has('arrowleft')) view.x += moveSpeed;
      if (keys.has('d') || keys.has('arrowright')) view.x -= moveSpeed;

      const s = stateRef.current;
      if (!s.gameOver && s.speed > 0) {
        const interval = TICK_MS / s.speed;
        if (now - lastTick >= interval) {
          if (s.agents.length === 0 && s.buildings.some((b) => b.built && BUILDINGS[b.typeId].housing)) {
            seedAgents(s);
          }
          tick(s);
          lastTick = now;
          syncUi();

          // Switch ambient when season changes.
          if (s.season !== lastSeasonRef.current) {
            lastSeasonRef.current = s.season;
            switchAmbient(s.season);
          }
        }
      }

      const rect = canvas.getBoundingClientRect();
      const mx = (mouseRef.current.x - rect.left) * (canvas.width / rect.width);
      const my = (mouseRef.current.y - rect.top) * (canvas.height / rect.height);
      const t = screenToTile(mx, my, view);
      const hover = t.tileX >= 0 && t.tileY >= 0 && t.tileX < GRID_W && t.tileY < GRID_D
        ? { x: t.tileX, y: t.tileY }
        : null;

      const ghostType = buildTypeRef.current ? BUILDINGS[buildTypeRef.current] : null;
      const ghostValid = ghostType && hover
        ? canPlace(s, ghostType, hover.x, hover.y)
        : false;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        render(
          {
            ctx,
            width: canvas.width,
            height: canvas.height,
            view,
            hoverTile: hover,
            ghostType,
            ghostValid: !!ghostValid,
          },
          s
        );
      }

      forceRender((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [syncUi]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      canvas.style.width = parent.clientWidth + 'px';
      canvas.style.height = parent.clientHeight + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      if (k === 'escape') {
        if (showPause) {
          setShowPause(false);
        } else {
          setBuildType(null);
          buildTypeRef.current = null;
        }
      }
      if (k === ' ') {
        e.preventDefault();
        const s = stateRef.current;
        s.speed = s.speed === 0 ? 1 : 0;
        syncUi();
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [syncUi, showPause]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const view = viewRef.current;
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const newZoom = Math.max(0.4, Math.min(1.6, view.zoom * factor));
    if (newZoom === view.zoom) return;
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - view.x) / view.zoom;
      const wy = (my - view.y) / view.zoom;
      view.zoom = newZoom;
      view.x = mx - wx * newZoom;
      view.y = my - wy * newZoom;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mouseRef.current.x = e.clientX;
    mouseRef.current.y = e.clientY;
    if (mouseRef.current.down) {
      const dx = e.clientX - mouseRef.current.dragStartX;
      const dy = e.clientY - mouseRef.current.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mouseRef.current.dragging = true;
      if (mouseRef.current.dragging && !buildTypeRef.current) {
        viewRef.current.x += dx;
        viewRef.current.y += dy;
        mouseRef.current.dragStartX = e.clientX;
        mouseRef.current.dragStartY = e.clientY;
      }
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseRef.current.down = true;
    mouseRef.current.dragStartX = e.clientX;
    mouseRef.current.dragStartY = e.clientY;
    mouseRef.current.dragging = false;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (mouseRef.current.dragging) return;
    if (e.button !== 0) return;
    const bt = buildTypeRef.current;
    if (!bt) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    const t = screenToTile(mx, my, viewRef.current);
    if (t.tileX < 0 || t.tileY < 0 || t.tileX >= GRID_W || t.tileY >= GRID_D) return;
    const s = stateRef.current;
    // Bridges: single-tile placement on any water tile.
    const placed = placeBuilding(s, bt, t.tileX, t.tileY);
    if (placed) {
      playSound('placeBuilding');
      syncUi();
    }
  }, [syncUi]);

  const handleMouseUp = useCallback(() => {
    mouseRef.current.down = false;
    mouseRef.current.dragging = false;
  }, []);

  const selectBuild = useCallback((id: BuildingTypeId | null) => {
    setBuildType(id);
    buildTypeRef.current = id;
  }, []);

  const changeSpeed = useCallback((sp: number) => {
    stateRef.current.speed = sp;
    syncUi();
  }, [syncUi]);

  const handleSave = useCallback(() => {
    const ok = saveGame(stateRef.current);
    setSaveMessage(ok ? 'Игра сохранена!' : 'Ошибка сохранения!');
    setTimeout(() => setSaveMessage(''), 2000);
  }, []);

  return (
    <div className="fixed inset-0 bg-stone-900 select-none">
      <canvas
        ref={canvasRef}
        className={buildType ? 'canvas-cursor-build' : 'cursor-grab active:cursor-grabbing'}
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); selectBuild(null); }}
      />

      {/* === NEW HUD LAYOUT === */}

      {/* Top-left: hamburger menu button */}
      <div className="absolute top-3 left-3 pointer-events-auto">
        <button
          onClick={() => setShowPause(true)}
          title="Меню"
          className="w-11 h-11 rounded-full wood-panel flex items-center justify-center text-amber-100 hover:ring-2 hover:ring-amber-400/40 transition-all"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Top-center: Advisor bar with season/date + last log message */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto">
        <AdvisorBar
          season={uiSeason}
          day={uiDay}
          totalDays={uiTotalDays}
          log={uiLog}
        />
      </div>

      {/* Top-right: time controls only */}
      <div className="absolute top-3 right-3 pointer-events-auto">
        <TimeControls speed={uiSpeed} onSpeedChange={changeSpeed} />
      </div>

      {/* Below time controls (top-right): resources */}
      <div className="absolute top-16 right-3 pointer-events-auto">
        <ResourceBar resources={uiResources} />
      </div>

      {/* Left side: build menu + society */}
      <div className="absolute left-3 top-20 pointer-events-auto flex flex-col gap-3">
        <BuildMenu
          resources={uiResources}
          selected={buildType}
          onSelect={selectBuild}
        />
        <SocietyPanel
          classCounts={uiClassCounts}
          masterPool={uiMasterPool}
          trainingCount={uiTraining}
          onTrain={() => { startTraining(stateRef.current); syncUi(); }}
          canTrain={uiClassCounts.smerd > 0 && uiResources.food >= 16}
        />
      </div>

      {/* Right side: guests panel (if any) */}
      <div className="absolute right-3 top-32 pointer-events-auto flex flex-col gap-3">
        {uiGuests.length > 0 && <GuestsPanel guests={uiGuests} />}
      </div>

      {/* Save confirmation toast */}
      {saveMessage && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <div className="wood-panel rounded-lg px-4 py-2 text-amber-100 text-sm animate-float-in">
            {saveMessage}
          </div>
        </div>
      )}

      {/* Bottom hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="wood-panel rounded-lg px-4 py-1.5 text-stone-400 text-xs flex gap-4">
          <span>WASD — камера</span>
          <span>Колесо — зум</span>
          <span>ПКМ/Esc — отмена</span>
          <span>Пробел — пауза</span>
        </div>
      </div>

      {/* Pause menu */}
      <PauseMenu
        open={showPause}
        onClose={() => setShowPause(false)}
        onSettings={() => { setShowPause(false); setShowSettings(true); }}
        onSave={handleSave}
        onExit={onExit}
      />

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="wood-panel rounded-xl p-8 max-w-md text-center animate-float-in">
            <h2 className="font-display text-4xl text-red-300 mb-3">Конец</h2>
            <p className="text-stone-300 mb-6">{gameOverReason}</p>
            <p className="text-stone-500 text-sm mb-6">
              Деревня продержалась {uiTotalDays} дней.
            </p>
            <button
              className="btn-rune rounded-lg px-6 py-2.5 text-amber-100"
              onClick={onExit}
            >
              В главное меню
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
