import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, Hammer, Users, Volume2, VolumeX, Mountain, Waves } from 'lucide-react';
import { GRID_D, GRID_W, BUILDINGS, TICK_MS } from '@/game/constants';
import { screenToTile, tileToScreen, type CameraView } from '@/game/iso';
import {
  canPlace, createGame, placeBuilding, buildRoad, tick, seedAgents, startTraining,
  setSoundCallback, type GameState,
} from '@/game/engine';
import { render } from '@/game/render';
import type { CitizenClass, BuildMode, DifficultyId, TerrainConfig } from '@/game/types';
import {
  initAudio, startAmbient, startMusic, switchAmbient, playSound,
  toggleMute, isMuted, type SoundEvent,
} from '@/game/AudioSystem';
import { saveGame } from '@/game/storage';
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
  terrain: TerrainConfig;
  onExit: () => void;
  loadedState?: GameState | null;
}

type RibbonTab = 'build' | 'society' | null;

export default function GameView({ difficulty, terrain, onExit, loadedState }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // CRITICAL: lazy init so createGame runs exactly ONCE, not on every render.
  // This was the root cause of the jumping map — createGame called setMapSeed
  // with a new random seed each render, changing terrain every frame.
  const [stateRef] = useState(() => loadedState ?? createGame(difficulty, terrain));
  const viewRef = useRef<CameraView>({ x: 0, y: 0, zoom: 1 });
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number; y: number; down: boolean; dragStartX: number; dragStartY: number; dragging: boolean }>({
    x: 0, y: 0, down: false, dragStartX: 0, dragStartY: 0, dragging: false,
  });
  const buildTypeRef = useRef<BuildMode | null>(null);
  const lastSeasonRef = useRef<string>(stateRef.season);
  const [, forceRender] = useState(0);
  const [uiResources, setUiResources] = useState(stateRef.resources);
  const [uiSeason, setUiSeason] = useState(stateRef.season);
  const [uiDay, setUiDay] = useState(stateRef.day);
  const [uiTotalDays, setUiTotalDays] = useState(stateRef.totalDays);
  const [uiSpeed, setUiSpeed] = useState(stateRef.speed);
  const [uiPop, setUiPop] = useState(stateRef.population);
  const [uiHousing, setUiHousing] = useState(stateRef.housingUsed);
  const [uiLog, setUiLog] = useState<string[]>(stateRef.log);
  const [uiClassCounts, setUiClassCounts] = useState<Record<CitizenClass, number>>(stateRef.classCounts);
  const [uiMasterPool, setUiMasterPool] = useState<{ classId: CitizenClass }[]>(stateRef.masterPool);
  const [uiTraining, setUiTraining] = useState(stateRef.training.length);
  const [uiGuests, setUiGuests] = useState(stateRef.guests);
  const [buildType, setBuildType] = useState<BuildMode | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');
  const [showPause, setShowPause] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<RibbonTab>(null);
  const [muted, setMuted] = useState(isMuted());

  const syncUi = useCallback(() => {
    const s = stateRef;
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
    startAmbient(stateRef.season);
    startMusic();

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
      if (keys.has('w') || keys.has('arrowup')) view.y -= moveSpeed;
      if (keys.has('s') || keys.has('arrowdown')) view.y += moveSpeed;
      if (keys.has('a') || keys.has('arrowleft')) view.x += moveSpeed;
      if (keys.has('d') || keys.has('arrowright')) view.x -= moveSpeed;

      const s = stateRef;
      if (!s.gameOver && s.speed > 0) {
        const interval = TICK_MS / s.speed;
        if (now - lastTick >= interval) {
          if (s.agents.length === 0 && s.buildings.some((b) => b.built && BUILDINGS[b.typeId].housing)) {
            seedAgents(s);
          }
          tick(s);
          lastTick = now;
          syncUi();

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

      const ghostType = buildTypeRef.current && buildTypeRef.current !== 'road' ? BUILDINGS[buildTypeRef.current] : null;
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
        const s = stateRef;
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
    const s = stateRef;
    const done = bt === 'road'
      ? buildRoad(s, t.tileX, t.tileY)
      : placeBuilding(s, bt, t.tileX, t.tileY) !== null;
    if (done) {
      playSound('placeBuilding');
      syncUi();
    }
  }, [syncUi]);

  const handleMouseUp = useCallback(() => {
    mouseRef.current.down = false;
    mouseRef.current.dragging = false;
  }, []);

  const selectBuild = useCallback((id: BuildMode | null) => {
    setBuildType(id);
    buildTypeRef.current = id;
  }, []);

  const changeSpeed = useCallback((sp: number) => {
    stateRef.speed = sp;
    syncUi();
  }, [syncUi]);

  const handleSave = useCallback(() => {
    const ok = saveGame(stateRef);
    setSaveMessage(ok ? 'Игра сохранена!' : 'Ошибка сохранения!');
    setTimeout(() => setSaveMessage(''), 2000);
  }, []);

  const handleMute = useCallback(() => {
    const m = toggleMute();
    setMuted(m);
  }, []);

  const toggleTab = useCallback((tab: RibbonTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
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

      {/* === Victoria 3-style left ribbon === */}
      <div className="fixed left-0 top-0 h-full w-16 bg-stone-900 border-r border-stone-700/60 flex flex-col items-center pt-16 gap-1 z-30">
        <RibbonIcon
          icon={Hammer}
          label="Стройка"
          active={activeTab === 'build'}
          onClick={() => toggleTab('build')}
        />
        <RibbonIcon
          icon={Users}
          label="Общество"
          active={activeTab === 'society'}
          onClick={() => toggleTab('society')}
        />
      </div>

      {/* === Slide-out panels attached to ribbon === */}
      {activeTab === 'build' && (
        <div
          className="fixed left-16 top-16 h-[calc(100%-4rem)] w-72 bg-stone-900/95 border-r border-b border-stone-700/60 z-20 overflow-hidden animate-slide-out-right"
        >
          <BuildMenu
            resources={uiResources}
            selected={buildType}
            onSelect={selectBuild}
          />
        </div>
      )}

      {activeTab === 'society' && (
        <div
          className="fixed left-16 top-16 h-[calc(100%-4rem)] w-72 bg-stone-900/95 border-r border-b border-stone-700/60 z-20 overflow-hidden animate-slide-out-right"
        >
          <SocietyPanel
            classCounts={uiClassCounts}
            masterPool={uiMasterPool}
            trainingCount={uiTraining}
            onTrain={() => { startTraining(stateRef); syncUi(); }}
            canTrain={uiClassCounts.smerd > 0 && uiResources.food >= 16}
          />
        </div>
      )}

      {/* === Top bar === */}
      <div className="absolute top-3 left-20 pointer-events-auto z-30">
        <button
          onClick={() => setShowPause(true)}
          title="Меню"
          className="w-11 h-11 rounded-full bg-stone-900/80 border border-stone-700/50 flex items-center justify-center text-amber-100 hover:ring-2 hover:ring-amber-400/40 transition-all"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto z-30">
        <AdvisorBar
          season={uiSeason}
          day={uiDay}
          totalDays={uiTotalDays}
          log={uiLog}
        />
      </div>

      <div className="absolute top-3 right-3 pointer-events-auto flex items-center gap-2 z-30">
        <button
          onClick={handleMute}
          title={muted ? 'Включить звук' : 'Выключить звук'}
          className="w-11 h-11 rounded-full bg-stone-900/80 border border-stone-700/50 flex items-center justify-center text-amber-100 hover:ring-2 hover:ring-amber-400/40 transition-all"
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <TimeControls speed={uiSpeed} onSpeedChange={changeSpeed} />
      </div>

      {/* Right side: guests panel */}
      <div className="absolute right-3 top-20 pointer-events-auto flex flex-col gap-3 z-20">
        {uiGuests.length > 0 && <GuestsPanel guests={uiGuests} />}
      </div>

      {/* Save confirmation toast */}
      {saveMessage && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <div className="bg-stone-900/90 border border-amber-700/30 rounded-lg px-4 py-2 text-amber-100 text-sm">
            {saveMessage}
          </div>
        </div>
      )}

      {/* === Full-width bottom resource bar === */}
      <div className="fixed bottom-0 left-0 w-full h-12 bg-stone-900/95 border-t border-stone-700/60 flex items-center px-6 z-20">
        <ResourceBar resources={uiResources} />
      </div>

      {/* Pause menu */}
      <PauseMenu
        open={showPause}
        onClose={() => setShowPause(false)}
        onSettings={() => { setShowPause(false); setShowSettings(true); }}
        onSave={handleSave}
        onExit={onExit}
      />

      {showSettings && (
        <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      )}

      {gameOver && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-stone-900 border border-stone-700/50 rounded-xl p-8 max-w-md text-center">
            <h2 className="font-display text-4xl text-red-300 mb-3">Конец</h2>
            <p className="text-stone-300 mb-6">{gameOverReason}</p>
            <p className="text-stone-500 text-sm mb-6">
              Деревня продержалась {uiTotalDays} дней.
            </p>
            <button
              className="bg-stone-800 hover:bg-stone-700 border border-amber-700/30 rounded-lg px-6 py-2.5 text-amber-100 transition-all"
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

function RibbonIcon({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Hammer;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all border ${
        active
          ? 'bg-amber-800/40 border-amber-500/40 text-amber-200'
          : 'bg-stone-800/40 border-stone-700/40 text-stone-400 hover:bg-stone-700/40 hover:text-amber-200/70'
      }`}
    >
      <Icon size={22} />
      <span className="text-[8px] uppercase tracking-wide leading-none">{label}</span>
    </button>
  );
}
