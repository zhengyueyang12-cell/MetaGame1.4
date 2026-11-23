import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Shield, Trophy, Volume2, VolumeX } from 'lucide-react';
import { arcadeAudio } from '../../utils/arcadeAudio';

export type ArcadePhase = 'loading' | 'playing' | 'paused' | 'stage_clear' | 'game_over';

interface ArcadeCabinetStageProps {
  onPhaseChange?: (phase: ArcadePhase, score: number) => void;
  onInputAxisChange?: (dx: number, dz: number) => void;
  onLeaveCabinet?: () => void;
}

const COLS = 16;
const ROWS = 12;
const TILE = 30;
const CANVAS_W = COLS * TILE; // 480
const CANVAS_H = ROWS * TILE; // 360
const TANK_SIZE = 24;
const HI_SCORE_KEY = 'twilight_arcade_tanks_hiscore_v1';

// Tile codes: 0 empty, 1 brick, 2 steel, 3 bush, 4 water, 5 HQ eagle
type TileCode = 0 | 1 | 2 | 3 | 4 | 5;
type Dir = 'up' | 'down' | 'left' | 'right';
type EnemyKind = 'scout' | 'striker' | 'heavy' | 'bonus';
type PowerUpKind = 'star' | 'shield' | 'clock' | 'bomb' | 'fortify';

interface TankEntity {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  recoil: number;
  trackPhase: number;
  isPlayer: boolean;
  kind?: EnemyKind;
  aiTurnTimer?: number;
  shieldTimer: number;
  level: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromPlayer: boolean;
  power: number; // 1 = brick, 2 = fast/steel-pierce at lv3
  alive: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

interface PowerUpItem {
  x: number;
  y: number;
  kind: PowerUpKind;
  life: number;
}

// 3 handcrafted 16x12 tactical stages (0=empty, 1=brick, 2=steel, 3=bush, 4=water, 5=HQ at (7,11))
const STAGE_MAPS: TileCode[][][] = [
  // Stage 1: Urban Outpost
  [
    [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 1, 0, 1, 0, 2, 0, 0, 0, 0, 2, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 3, 1, 1, 3, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 1, 3, 2, 2, 3, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 4, 4, 0, 0, 0],
    [1, 1, 0, 3, 3, 0, 1, 1, 1, 1, 0, 3, 3, 0, 1, 1],
    [2, 0, 0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0, 0, 2],
    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0],
    [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Stage 2: Steel River Crossing
  [
    [0, 0, 1, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 0, 2, 2, 0, 1, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
    [2, 1, 0, 4, 4, 4, 0, 1, 1, 0, 4, 4, 4, 0, 1, 2],
    [0, 0, 0, 3, 3, 0, 0, 2, 2, 0, 0, 3, 3, 0, 0, 0],
    [0, 1, 1, 3, 0, 0, 1, 1, 1, 1, 0, 0, 3, 1, 1, 0],
    [0, 1, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 1, 0],
    [0, 0, 0, 0, 1, 1, 0, 2, 2, 0, 1, 1, 0, 0, 0, 0],
    [1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
    [0, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
  // Stage 3: Crimson Citadel
  [
    [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
    [0, 1, 0, 1, 0, 1, 2, 0, 0, 2, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 1, 3, 3, 3, 3, 1, 0, 0, 0, 1, 0],
    [0, 2, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 2, 0],
    [0, 0, 3, 3, 4, 4, 0, 2, 2, 0, 4, 4, 3, 3, 0, 0],
    [1, 0, 3, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 3, 0, 1],
    [1, 0, 0, 1, 2, 0, 1, 2, 2, 1, 0, 2, 1, 0, 0, 1],
    [0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0],
    [0, 1, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 2, 1, 0],
    [0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 5, 1, 0, 0, 0, 0, 0, 0, 0],
  ],
];

const HQ_FORTRESS_CELLS: [number, number][] = [
  [6, 11],
  [6, 10],
  [7, 10],
  [8, 10],
  [8, 11],
];

const BOOT_LOGS = [
  'Z80-B CPU @ 6.0MHz ............ OK',
  '64K TILE VRAM CHECK ............. OK',
  'IRON_TREADS_86.ROM (CRC F84A) ... OK',
  'YM2151 FM SOUND CHIP ............ READY',
  'CREDIT 01 ACCEPTED · STARTING MISSION',
];

function readHiScore(): number {
  try {
    const val = Number(window.localStorage.getItem(HI_SCORE_KEY) || '24800');
    return Number.isFinite(val) && val > 0 ? val : 24800;
  } catch {
    return 24800;
  }
}

function saveHiScore(score: number): void {
  try {
    window.localStorage.setItem(HI_SCORE_KEY, String(score));
  } catch {
    // Ignore storage quota errors
  }
}

function dirToVec(dir: Dir): [number, number] {
  if (dir === 'up') return [0, -1];
  if (dir === 'down') return [0, 1];
  if (dir === 'left') return [-1, 0];
  return [1, 0];
}

function aabbOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export const ArcadeCabinetStage: React.FC<ArcadeCabinetStageProps> = ({
  onPhaseChange,
  onInputAxisChange,
  onLeaveCabinet,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<ArcadePhase>('loading');
  const [bootProgress, setBootProgress] = useState(0);
  const [bootLinesShown, setBootLinesShown] = useState(1);
  const [hud, setHud] = useState(() => ({
    score: 0,
    hiScore: readHiScore(),
    stage: 1,
    lives: 3,
    enemiesLeft: 10,
    weaponLevel: 1,
    shieldActive: false,
    freezeActive: false,
    hqAlive: true,
    reason: '',
  }));
  const [muted, setMuted] = useState(false);

  const phaseRef = useRef<ArcadePhase>('loading');
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const onInputAxisChangeRef = useRef(onInputAxisChange);
  onInputAxisChangeRef.current = onInputAxisChange;

  const keysRef = useRef<Record<string, boolean>>({});
  const mouseFireRef = useRef(false);
  const rafRef = useRef<number>(0);

  // Mutable simulation state kept in a single ref so 60fps loop never stutters React
  const simRef = useRef<{
    grid: TileCode[][];
    player: TankEntity;
    enemies: TankEntity[];
    bullets: Bullet[];
    particles: Particle[];
    popups: FloatingText[];
    powerUps: PowerUpItem[];
    enemyQueue: EnemyKind[];
    spawnTimer: number;
    spawnIndex: number;
    freezeTimer: number;
    fortifyTimer: number;
    shakeTimer: number;
    stageClearTimer: number;
    nextId: number;
    score: number;
    hiScore: number;
    stage: number;
    lives: number;
    hqAlive: boolean;
    lastAxisX: number;
    lastAxisZ: number;
  } | null>(null);

  const buildStageGrid = (stageNum: number): TileCode[][] => {
    const src = STAGE_MAPS[(stageNum - 1) % STAGE_MAPS.length];
    return src.map((row) => [...row] as TileCode[]);
  };

  const createEnemyQueue = (stageNum: number): EnemyKind[] => {
    const total = 8 + Math.min(8, stageNum * 2);
    const list: EnemyKind[] = [];
    for (let i = 0; i < total; i++) {
      if (i % 4 === 3) list.push('bonus');
      else if (stageNum >= 2 && i % 3 === 2) list.push('heavy');
      else if (i % 2 === 1) list.push('striker');
      else list.push('scout');
    }
    return list;
  };

  const createPlayerTank = (level = 1): TankEntity => ({
    id: 1,
    x: 4 * TILE + 3,
    y: 11 * TILE + 3,
    dir: 'up',
    speed: 118,
    hp: 1,
    maxHp: 1,
    fireCooldown: 0,
    recoil: 0,
    trackPhase: 0,
    isPlayer: true,
    shieldTimer: 3.0,
    level,
  });

  const initCampaign = useCallback((stageNum = 1, keepScore = 0, keepLives = 3, keepLevel = 1) => {
    const hiScore = Math.max(readHiScore(), keepScore);
    const queue = createEnemyQueue(stageNum);
    simRef.current = {
      grid: buildStageGrid(stageNum),
      player: createPlayerTank(keepLevel),
      enemies: [],
      bullets: [],
      particles: [],
      popups: [],
      powerUps: [],
      enemyQueue: queue,
      spawnTimer: 0.45,
      spawnIndex: 0,
      freezeTimer: 0,
      fortifyTimer: 0,
      shakeTimer: 0,
      stageClearTimer: 0,
      nextId: 10,
      score: keepScore,
      hiScore,
      stage: stageNum,
      lives: keepLives,
      hqAlive: true,
      lastAxisX: 0,
      lastAxisZ: 0,
    };
    setHud({
      score: keepScore,
      hiScore,
      stage: stageNum,
      lives: keepLives,
      enemiesLeft: queue.length,
      weaponLevel: keepLevel,
      shieldActive: true,
      freezeActive: false,
      hqAlive: true,
      reason: '',
    });
  }, []);

  const setSyncedPhase = useCallback((next: ArcadePhase) => {
    phaseRef.current = next;
    setPhase(next);
    onPhaseChangeRef.current?.(next, simRef.current?.score ?? 0);
  }, []);

  const enterBattleFromBoot = useCallback(() => {
    if (phaseRef.current !== 'loading') return;
    arcadeAudio.playCoin();
    initCampaign(1, 0, 3, 1);
    setSyncedPhase('playing');
  }, [initCampaign, setSyncedPhase]);

  const handleRestart = useCallback(() => {
    arcadeAudio.playCoin();
    initCampaign(1, 0, 3, 1);
    setSyncedPhase('playing');
  }, [initCampaign, setSyncedPhase]);

  const handleTogglePause = useCallback(() => {
    if (phaseRef.current === 'playing') {
      setSyncedPhase('paused');
    } else if (phaseRef.current === 'paused') {
      setSyncedPhase('playing');
    }
  }, [setSyncedPhase]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      arcadeAudio.setMuted(next);
      return next;
    });
  }, []);

  // Boot loading sequence (1.85s retro CRT self-check with early Space/Enter/Click skip)
  useEffect(() => {
    arcadeAudio.playBootTick();
    setBootProgress(0);
    setBootLinesShown(1);
    onPhaseChangeRef.current?.('loading', 0);

    const start = performance.now();
    const duration = 1850;
    const interval = window.setInterval(() => {
      if (phaseRef.current !== 'loading') {
        window.clearInterval(interval);
        return;
      }
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setBootProgress(pct);
      const lines = Math.min(BOOT_LOGS.length, 1 + Math.floor((pct / 100) * BOOT_LOGS.length));
      setBootLinesShown(lines);
      if (pct >= 100) {
        window.clearInterval(interval);
        enterBattleFromBoot();
      }
    }, 65);

    return () => {
      window.clearInterval(interval);
    };
  }, [enterBattleFromBoot]);

  // Keyboard listener scoped cleanly while arcade stage is mounted
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)
      ) {
        e.preventDefault();
      }
      keysRef.current[e.code] = true;

      if (phaseRef.current === 'loading' && (e.code === 'Space' || e.code === 'Enter')) {
        enterBattleFromBoot();
        return;
      }
      if (e.code === 'KeyP') {
        handleTogglePause();
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'KeyR' && phaseRef.current !== 'loading') {
        handleRestart();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      onInputAxisChangeRef.current?.(0, 0);
    };
  }, [enterBattleFromBoot, handleRestart, handleToggleMute, handleTogglePause]);

  // Main 60fps Canvas Simulation & Renderer
  useEffect(() => {
    if (phase === 'loading') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let lastTime = performance.now();
    let hudSyncAccum = 0;

    const spawnBurst = (
      x: number,
      y: number,
      color: string,
      count: number,
      speedMax = 110
    ) => {
      const sim = simRef.current;
      if (!sim) return;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 25 + Math.random() * speedMax;
        sim.particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 0.25 + Math.random() * 0.28,
          maxLife: 0.52,
          size: 2 + Math.random() * 3.5,
          color,
        });
      }
    };

    const addPopup = (x: number, y: number, text: string, color: string) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.popups.push({ x, y, text, color, life: 0.9 });
    };

    const collidesGridOrTanks = (
      tx: number,
      ty: number,
      ignoreId: number
    ): boolean => {
      const sim = simRef.current;
      if (!sim) return true;
      if (tx < 1 || ty < 1 || tx + TANK_SIZE > CANVAS_W - 1 || ty + TANK_SIZE > CANVAS_H - 1) {
        return true;
      }

      const c0 = Math.max(0, Math.floor(tx / TILE));
      const c1 = Math.min(COLS - 1, Math.floor((tx + TANK_SIZE - 0.5) / TILE));
      const r0 = Math.max(0, Math.floor(ty / TILE));
      const r1 = Math.min(ROWS - 1, Math.floor((ty + TANK_SIZE - 0.5) / TILE));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const tile = sim.grid[r][c];
          if (tile === 1 || tile === 2 || tile === 4 || tile === 5) {
            return true;
          }
        }
      }

      if (sim.player.id !== ignoreId && sim.lives > 0) {
        if (
          aabbOverlap(
            tx,
            ty,
            TANK_SIZE,
            TANK_SIZE,
            sim.player.x + 1,
            sim.player.y + 1,
            TANK_SIZE - 2,
            TANK_SIZE - 2
          )
        ) {
          return true;
        }
      }
      for (const e of sim.enemies) {
        if (e.id === ignoreId) continue;
        if (
          aabbOverlap(
            tx,
            ty,
            TANK_SIZE,
            TANK_SIZE,
            e.x + 1,
            e.y + 1,
            TANK_SIZE - 2,
            TANK_SIZE - 2
          )
        ) {
          return true;
        }
      }
      return false;
    };

    const moveTankWithCornerSnap = (tank: TankEntity, dir: Dir, dt: number): boolean => {
      const [dx, dy] = dirToVec(dir);
      const step = tank.speed * dt;
      let nx = tank.x + dx * step;
      let ny = tank.y + dy * step;

      // Gentle 30px corridor alignment assist so turning into brick alleys feels crisp
      if (dx !== 0) {
        const nearestY = Math.round((tank.y - 3) / TILE) * TILE + 3;
        const diffY = nearestY - tank.y;
        if (Math.abs(diffY) <= 10 && Math.abs(diffY) > 0.3) {
          const snapStep = Math.sign(diffY) * Math.min(Math.abs(diffY), step * 0.9);
          if (!collidesGridOrTanks(tank.x, tank.y + snapStep, tank.id)) {
            tank.y += snapStep;
            ny = tank.y;
          }
        }
      } else if (dy !== 0) {
        const nearestX = Math.round((tank.x - 3) / TILE) * TILE + 3;
        const diffX = nearestX - tank.x;
        if (Math.abs(diffX) <= 10 && Math.abs(diffX) > 0.3) {
          const snapStep = Math.sign(diffX) * Math.min(Math.abs(diffX), step * 0.9);
          if (!collidesGridOrTanks(tank.x + snapStep, tank.y, tank.id)) {
            tank.x += snapStep;
            nx = tank.x;
          }
        }
      }

      if (!collidesGridOrTanks(nx, ny, tank.id)) {
        tank.x = nx;
        tank.y = ny;
        tank.trackPhase += step * 0.35;
        return true;
      }
      return false;
    };

    const fireTank = (tank: TankEntity) => {
      const sim = simRef.current;
      if (!sim) return;
      const [dx, dy] = dirToVec(tank.dir);
      const cx = tank.x + TANK_SIZE * 0.5 + dx * 13;
      const cy = tank.y + TANK_SIZE * 0.5 + dy * 13;
      const speed = tank.isPlayer ? 255 + tank.level * 28 : 195 + sim.stage * 10;
      sim.bullets.push({
        x: cx,
        y: cy,
        vx: dx * speed,
        vy: dy * speed,
        fromPlayer: tank.isPlayer,
        power: tank.isPlayer && tank.level >= 3 ? 2 : 1,
        alive: true,
      });
      tank.recoil = 1.0;
      tank.fireCooldown = tank.isPlayer
        ? Math.max(0.18, 0.36 - (tank.level - 1) * 0.06)
        : 0.95 + Math.random() * 0.8;

      spawnBurst(cx, cy, tank.isPlayer ? '#ffe082' : '#ff8a80', 4, 55);
      if (tank.isPlayer) arcadeAudio.playShoot();
    };

    const awardPoints = (pts: number) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.score += pts;
      if (sim.score > sim.hiScore) {
        sim.hiScore = sim.score;
        saveHiScore(sim.hiScore);
      }
    };

    const spawnEnemyFromQueue = () => {
      const sim = simRef.current;
      if (!sim || sim.enemyQueue.length === 0 || sim.enemies.length >= 4) return;
      const spawnCols = [0, 7, 15];
      const col = spawnCols[sim.spawnIndex % spawnCols.length];
      sim.spawnIndex++;
      const sx = col * TILE + 3;
      const sy = 3;
      if (collidesGridOrTanks(sx, sy, -1)) return;

      const kind = sim.enemyQueue.shift()!;
      const speedBoost = Math.min(24, (sim.stage - 1) * 6);
      const hp = kind === 'heavy' ? 3 : kind === 'striker' || kind === 'bonus' ? 2 : 1;
      const speed =
        kind === 'scout'
          ? 88 + speedBoost
          : kind === 'heavy'
            ? 56 + speedBoost * 0.6
            : 72 + speedBoost;

      sim.enemies.push({
        id: sim.nextId++,
        x: sx,
        y: sy,
        dir: 'down',
        speed,
        hp,
        maxHp: hp,
        fireCooldown: 0.7 + Math.random() * 0.8,
        recoil: 0,
        trackPhase: 0,
        isPlayer: false,
        kind,
        aiTurnTimer: 0.8 + Math.random() * 1.4,
        shieldTimer: 0.6,
        level: 1,
      });
      spawnBurst(sx + TANK_SIZE / 2, sy + TANK_SIZE / 2, '#7bf5dc', 8, 65);
    };

    const updateSimulation = (dt: number) => {
      const sim = simRef.current;
      if (!sim) return;

      if (sim.shakeTimer > 0) sim.shakeTimer = Math.max(0, sim.shakeTimer - dt);
      if (sim.freezeTimer > 0) sim.freezeTimer = Math.max(0, sim.freezeTimer - dt);

      if (sim.fortifyTimer > 0) {
        sim.fortifyTimer = Math.max(0, sim.fortifyTimer - dt);
        if (sim.fortifyTimer === 0 && sim.hqAlive) {
          for (const [fc, fr] of HQ_FORTRESS_CELLS) {
            if (sim.grid[fr][fc] === 2) sim.grid[fr][fc] = 1;
          }
        }
      }

      // Stage clear transition countdown
      if (phaseRef.current === 'stage_clear') {
        sim.stageClearTimer -= dt;
        if (sim.stageClearTimer <= 0) {
          const nextStage = sim.stage + 1;
          initCampaign(nextStage, sim.score, sim.lives, sim.player.level);
          setSyncedPhase('playing');
        }
        return;
      }

      // 1. Player Controls & 3D Joystick Axis Feedback
      const k = keysRef.current;
      const axisX = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
      const axisZ = (k['KeyS'] || k['ArrowDown'] ? 1 : 0) - (k['KeyW'] || k['ArrowUp'] ? 1 : 0);
      if (axisX !== sim.lastAxisX || axisZ !== sim.lastAxisZ) {
        sim.lastAxisX = axisX;
        sim.lastAxisZ = axisZ;
        onInputAxisChangeRef.current?.(axisX, axisZ);
      }

      const p = sim.player;
      if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
      if (p.recoil > 0) p.recoil = Math.max(0, p.recoil - dt * 6);
      if (p.shieldTimer > 0) p.shieldTimer = Math.max(0, p.shieldTimer - dt);

      let moveDir: Dir | null = null;
      if (axisZ < 0) moveDir = 'up';
      else if (axisZ > 0) moveDir = 'down';
      else if (axisX < 0) moveDir = 'left';
      else if (axisX > 0) moveDir = 'right';

      if (moveDir) {
        p.dir = moveDir;
        moveTankWithCornerSnap(p, moveDir, dt);
      }

      if ((k['Space'] || k['KeyJ'] || k['KeyZ'] || mouseFireRef.current) && p.fireCooldown <= 0) {
        fireTank(p);
      }

      // 2. Enemy Spawning & AI
      sim.spawnTimer -= dt;
      if (sim.spawnTimer <= 0) {
        spawnEnemyFromQueue();
        sim.spawnTimer = 1.9;
      }

      for (const e of sim.enemies) {
        if (e.fireCooldown > 0) e.fireCooldown = Math.max(0, e.fireCooldown - dt);
        if (e.recoil > 0) e.recoil = Math.max(0, e.recoil - dt * 6);
        if (e.shieldTimer > 0) e.shieldTimer = Math.max(0, e.shieldTimer - dt);

        if (sim.freezeTimer > 0) continue;

        e.aiTurnTimer = (e.aiTurnTimer ?? 1) - dt;
        const moved = moveTankWithCornerSnap(e, e.dir, dt);
        if (!moved || (e.aiTurnTimer ?? 0) <= 0) {
          const dirs: Dir[] = ['down', 'left', 'right', 'up'];
          // Bias toward player or HQ bottom half
          if (Math.random() < 0.48) {
            const targetX = Math.random() < 0.55 ? p.x : 7 * TILE;
            const targetY = Math.random() < 0.55 ? p.y : 11 * TILE;
            const dx = targetX - e.x;
            const dy = targetY - e.y;
            if (Math.abs(dx) > Math.abs(dy)) e.dir = dx >= 0 ? 'right' : 'left';
            else e.dir = dy >= 0 ? 'down' : 'up';
          } else {
            e.dir = dirs[Math.floor(Math.random() * dirs.length)];
          }
          e.aiTurnTimer = 0.75 + Math.random() * 1.45;
        }

        if (e.fireCooldown <= 0) {
          fireTank(e);
        }
      }

      // 3. Bullets vs Arena Walls, HQ & Tanks
      for (const b of sim.bullets) {
        if (!b.alive) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.x < 2 || b.x > CANVAS_W - 2 || b.y < 2 || b.y > CANVAS_H - 2) {
          b.alive = false;
          spawnBurst(b.x, b.y, '#ffe082', 4, 45);
          continue;
        }

        const col = Math.floor(b.x / TILE);
        const row = Math.floor(b.y / TILE);
        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
          const tile = sim.grid[row][col];
          if (tile === 1) {
            sim.grid[row][col] = 0;
            b.alive = false;
            arcadeAudio.playBrickHit();
            spawnBurst(col * TILE + 15, row * TILE + 15, '#e26a48', 10, 95);
            continue;
          } else if (tile === 2) {
            b.alive = false;
            if (b.power >= 2) {
              sim.grid[row][col] = 0;
              arcadeAudio.playBrickHit();
              spawnBurst(col * TILE + 15, row * TILE + 15, '#9ec4db', 12, 110);
            } else {
              if (b.fromPlayer) arcadeAudio.playSteelClang();
              spawnBurst(b.x, b.y, '#e2eef8', 5, 70);
            }
            continue;
          } else if (tile === 5) {
            sim.grid[row][col] = 0;
            b.alive = false;
            sim.hqAlive = false;
            sim.shakeTimer = 0.45;
            arcadeAudio.playExplode(true);
            arcadeAudio.playGameOver();
            spawnBurst(col * TILE + 15, row * TILE + 15, '#ff526f', 28, 160);
            setHud((prev) => ({ ...prev, hqAlive: false, reason: '基地指挥塔已被摧毁' }));
            setSyncedPhase('game_over');
            return;
          }
        }

        // Bullet vs Enemy Tanks
        if (b.fromPlayer) {
          for (let ei = sim.enemies.length - 1; ei >= 0; ei--) {
            const e = sim.enemies[ei];
            if (b.x >= e.x && b.x <= e.x + TANK_SIZE && b.y >= e.y && b.y <= e.y + TANK_SIZE) {
              b.alive = false;
              if (e.shieldTimer > 0) {
                arcadeAudio.playSteelClang();
                break;
              }
              e.hp -= b.power;
              if (e.hp <= 0) {
                const pts =
                  e.kind === 'heavy' ? 400 : e.kind === 'bonus' ? 300 : e.kind === 'striker' ? 200 : 100;
                awardPoints(pts);
                addPopup(e.x + 12, e.y, `+${pts}`, '#ffe58f');
                spawnBurst(e.x + 12, e.y + 12, '#ff9d52', 18, 145);
                arcadeAudio.playExplode(e.kind === 'heavy');
                if (e.kind === 'heavy') sim.shakeTimer = 0.16;

                if (e.kind === 'bonus') {
                  const kinds: PowerUpKind[] = ['star', 'shield', 'clock', 'bomb', 'fortify'];
                  const drop = kinds[Math.floor(Math.random() * kinds.length)];
                  sim.powerUps.push({
                    x: Math.max(20, Math.min(CANVAS_W - 44, e.x)),
                    y: Math.max(20, Math.min(CANVAS_H - 44, e.y)),
                    kind: drop,
                    life: 11.0,
                  });
                }
                sim.enemies.splice(ei, 1);
              } else {
                arcadeAudio.playSteelClang();
                spawnBurst(b.x, b.y, '#ffd584', 6, 70);
              }
              break;
            }
          }
        } else {
          // Enemy bullet vs Player
          if (b.x >= p.x && b.x <= p.x + TANK_SIZE && b.y >= p.y && b.y <= p.y + TANK_SIZE) {
            b.alive = false;
            if (p.shieldTimer <= 0) {
              sim.lives -= 1;
              sim.shakeTimer = 0.3;
              arcadeAudio.playExplode(true);
              spawnBurst(p.x + 12, p.y + 12, '#ff6b78', 24, 150);
              if (sim.lives <= 0) {
                arcadeAudio.playGameOver();
                setHud((prev) => ({ ...prev, lives: 0, reason: '装甲已被全部击毁' }));
                setSyncedPhase('game_over');
                return;
              }
              sim.player = createPlayerTank(Math.max(1, p.level - 1));
              addPopup(sim.player.x + 12, sim.player.y - 6, 'RESPAWN', '#7bf5dc');
            } else {
              spawnBurst(b.x, b.y, '#5ef2d6', 6, 65);
            }
          }
        }
      }

      // Bullet vs Bullet cancel
      for (let i = 0; i < sim.bullets.length; i++) {
        const a = sim.bullets[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < sim.bullets.length; j++) {
          const c = sim.bullets[j];
          if (!c.alive || a.fromPlayer === c.fromPlayer) continue;
          if (Math.hypot(a.x - c.x, a.y - c.y) < 7) {
            a.alive = false;
            c.alive = false;
            spawnBurst((a.x + c.x) * 0.5, (a.y + c.y) * 0.5, '#ffffff', 5, 50);
          }
        }
      }
      sim.bullets = sim.bullets.filter((b) => b.alive);

      // 4. Power-Up Pickups
      for (let i = sim.powerUps.length - 1; i >= 0; i--) {
        const item = sim.powerUps[i];
        item.life -= dt;
        if (item.life <= 0) {
          sim.powerUps.splice(i, 1);
          continue;
        }
        if (aabbOverlap(p.x, p.y, TANK_SIZE, TANK_SIZE, item.x, item.y, 24, 24)) {
          arcadeAudio.playPowerup();
          awardPoints(250);
          if (item.kind === 'star') {
            p.level = Math.min(3, p.level + 1);
            addPopup(item.x + 12, item.y, `LV.${p.level} UP!`, '#ffe58f');
          } else if (item.kind === 'shield') {
            p.shieldTimer = 6.5;
            addPopup(item.x + 12, item.y, 'SHIELD 6S', '#5ef2d6');
          } else if (item.kind === 'clock') {
            sim.freezeTimer = 5.5;
            addPopup(item.x + 12, item.y, 'FREEZE!', '#8ecbff');
          } else if (item.kind === 'fortify') {
            sim.fortifyTimer = 12.0;
            for (const [fc, fr] of HQ_FORTRESS_CELLS) {
              if (sim.grid[fr][fc] !== 5) sim.grid[fr][fc] = 2;
            }
            addPopup(item.x + 12, item.y, 'STEEL HQ!', '#d8e4f0');
          } else if (item.kind === 'bomb') {
            for (const e of sim.enemies) {
              awardPoints(150);
              spawnBurst(e.x + 12, e.y + 12, '#ff9d52', 16, 130);
            }
            if (sim.enemies.length > 0) arcadeAudio.playExplode(true);
            sim.enemies = [];
            sim.shakeTimer = 0.25;
            addPopup(item.x + 12, item.y, 'AIRSTRIKE!', '#ff768d');
          }
          sim.powerUps.splice(i, 1);
        }
      }

      // 5. Particles & Popups
      for (let i = sim.particles.length - 1; i >= 0; i--) {
        const pt = sim.particles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.life -= dt;
        if (pt.life <= 0) sim.particles.splice(i, 1);
      }
      for (let i = sim.popups.length - 1; i >= 0; i--) {
        const pop = sim.popups[i];
        pop.y -= 24 * dt;
        pop.life -= dt;
        if (pop.life <= 0) sim.popups.splice(i, 1);
      }

      // 6. Stage Clear check
      if (sim.enemyQueue.length === 0 && sim.enemies.length === 0) {
        arcadeAudio.playStageClear();
        sim.stageClearTimer = 2.1;
        setSyncedPhase('stage_clear');
      }
    };

    const drawTank = (tank: TankEntity, nowMs: number) => {
      const cx = tank.x + TANK_SIZE * 0.5;
      const cy = tank.y + TANK_SIZE * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      let angle = 0;
      if (tank.dir === 'right') angle = Math.PI * 0.5;
      else if (tank.dir === 'down') angle = Math.PI;
      else if (tank.dir === 'left') angle = -Math.PI * 0.5;
      ctx.rotate(angle);

      const isBonusFlash = !tank.isPlayer && tank.kind === 'bonus' && Math.floor(nowMs / 130) % 2 === 0;
      const bodyMain = tank.isPlayer
        ? '#f2b84b'
        : isBonusFlash
          ? '#ffd166'
          : tank.kind === 'heavy'
            ? '#9d7bff'
            : tank.kind === 'striker'
              ? '#45d1b8'
              : '#e04f68';
      const bodyDark = tank.isPlayer
        ? '#9c681d'
        : isBonusFlash
          ? '#b85042'
          : tank.kind === 'heavy'
            ? '#4c328a'
            : tank.kind === 'striker'
              ? '#1e6e63'
              : '#7d2034';
      const turretColor = tank.isPlayer ? '#ffe188' : '#f4e6ef';

      // Treads
      ctx.fillStyle = '#252936';
      ctx.fillRect(-12, -11, 5, 22);
      ctx.fillRect(7, -11, 5, 22);
      ctx.fillStyle = bodyDark;
      const treadOffset = Math.floor(tank.trackPhase) % 4;
      for (let ty = -10 + treadOffset; ty < 11; ty += 4) {
        ctx.fillRect(-12, ty, 5, 2);
        ctx.fillRect(7, ty, 5, 2);
      }

      // Hull
      ctx.fillStyle = bodyMain;
      ctx.fillRect(-8, -9, 16, 18);
      ctx.fillStyle = bodyDark;
      ctx.fillRect(-6, -7, 12, 14);
      ctx.fillStyle = bodyMain;
      ctx.fillRect(-5, -6, 10, 12);

      // Barrel with recoil kick
      const recoilPx = tank.recoil * 3;
      ctx.fillStyle = turretColor;
      ctx.fillRect(-2, -14 + recoilPx, 4, 11);
      ctx.fillRect(-3.5, -4 + recoilPx * 0.4, 7, 7);

      ctx.restore();

      // Armor pips for multi-HP enemy tanks
      if (!tank.isPlayer && tank.maxHp > 1) {
        for (let i = 0; i < tank.hp; i++) {
          ctx.fillStyle = '#ffe58f';
          ctx.fillRect(tank.x + 4 + i * 6, tank.y - 4, 4, 2);
        }
      }

      // Shield ring
      if (tank.shieldTimer > 0) {
        ctx.strokeStyle = tank.isPlayer ? '#5ef2d6' : '#a8b8d0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const renderScene = (nowMs: number) => {
      const sim = simRef.current;
      if (!sim) return;

      ctx.save();
      if (!prefersReducedMotion && sim.shakeTimer > 0) {
        const mag = sim.shakeTimer * 10;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // Background + crisp tactical grid lines
      ctx.fillStyle = '#070a10';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.strokeStyle = 'rgba(54, 148, 116, 0.13)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= CANVAS_W; gx += TILE) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, CANVAS_H);
        ctx.stroke();
      }
      for (let gy = 0; gy <= CANVAS_H; gy += TILE) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(CANVAS_W, gy);
        ctx.stroke();
      }

      // Base layer tiles: Brick(1), Steel(2), Water(4), HQ(5)
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const tile = sim.grid[r][c];
          const px = c * TILE;
          const py = r * TILE;
          if (tile === 1) {
            ctx.fillStyle = '#9c3e26';
            ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = '#d96a46';
            ctx.fillRect(px + 2, py + 2, 12, 12);
            ctx.fillRect(px + 16, py + 2, 12, 12);
            ctx.fillRect(px + 2, py + 16, 12, 12);
            ctx.fillRect(px + 16, py + 16, 12, 12);
          } else if (tile === 2) {
            ctx.fillStyle = '#68798d';
            ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
            ctx.fillStyle = '#b4c5d8';
            ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
            ctx.fillStyle = '#dce8f5';
            ctx.fillRect(px + 7, py + 7, 5, 5);
          } else if (tile === 4) {
            const wave = Math.floor(nowMs / 260) % 2;
            ctx.fillStyle = '#184e78';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#3689c7';
            ctx.fillRect(px + (wave ? 4 : 10), py + 6, 14, 3);
            ctx.fillRect(px + (wave ? 12 : 4), py + 18, 14, 3);
          } else if (tile === 5) {
            ctx.fillStyle = '#241838';
            ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
            ctx.strokeStyle = '#ffbc5e';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
            // Pixel Eagle Emblem
            ctx.fillStyle = '#ffbc5e';
            ctx.fillRect(px + 12, py + 6, 6, 18);
            ctx.fillRect(px + 6, py + 10, 18, 6);
            ctx.fillStyle = '#ff5a7a';
            ctx.fillRect(px + 13, py + 11, 4, 4);
          }
        }
      }

      // Power-ups
      for (const item of sim.powerUps) {
        const blink = Math.floor(nowMs / 160) % 2 === 0;
        ctx.fillStyle = blink ? '#251a40' : '#40265e';
        ctx.fillRect(item.x, item.y, 24, 24);
        ctx.strokeStyle = '#ffbc5e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(item.x, item.y, 24, 24);
        ctx.fillStyle = '#fff2b2';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        const glyph =
          item.kind === 'star'
            ? '★'
            : item.kind === 'shield'
              ? 'S'
              : item.kind === 'clock'
                ? 'T'
                : item.kind === 'bomb'
                  ? 'B'
                  : 'H';
        ctx.fillText(glyph, item.x + 12, item.y + 16);
      }

      // Tanks
      if (sim.lives > 0) drawTank(sim.player, nowMs);
      for (const e of sim.enemies) drawTank(e, nowMs);

      // Bullets
      for (const b of sim.bullets) {
        ctx.fillStyle = b.fromPlayer ? '#fff4b8' : '#ff8c9e';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.power >= 2 ? 3.8 : 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Foliage Bush Canopy (rendered ABOVE tanks & shells)
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (sim.grid[r][c] === 3) {
            const px = c * TILE;
            const py = r * TILE;
            ctx.fillStyle = 'rgba(34, 118, 68, 0.88)';
            ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
            ctx.fillStyle = 'rgba(72, 178, 108, 0.9)';
            ctx.fillRect(px + 5, py + 5, 9, 9);
            ctx.fillRect(px + 16, py + 15, 9, 9);
          }
        }
      }

      // Particles & Floating Popups
      for (const pt of sim.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      ctx.font = 'bold 11px monospace';
      for (const pop of sim.popups) {
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, pop.x, pop.y);
      }

      ctx.restore();
    };

    const frameLoop = (now: number) => {
      const dt = Math.min(0.035, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (phaseRef.current === 'playing' || phaseRef.current === 'stage_clear') {
        updateSimulation(dt);
      }
      renderScene(now);

      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.08 && simRef.current) {
        hudSyncAccum = 0;
        const sim = simRef.current;
        setHud((prev) => {
          const left = sim.enemyQueue.length + sim.enemies.length;
          const shield = sim.player.shieldTimer > 0;
          const freeze = sim.freezeTimer > 0;
          if (
            prev.score === sim.score &&
            prev.hiScore === sim.hiScore &&
            prev.stage === sim.stage &&
            prev.lives === sim.lives &&
            prev.enemiesLeft === left &&
            prev.weaponLevel === sim.player.level &&
            prev.shieldActive === shield &&
            prev.freezeActive === freeze &&
            prev.hqAlive === sim.hqAlive
          ) {
            return prev;
          }
          return {
            ...prev,
            score: sim.score,
            hiScore: sim.hiScore,
            stage: sim.stage,
            lives: sim.lives,
            enemiesLeft: left,
            weaponLevel: sim.player.level,
            shieldActive: shield,
            freezeActive: freeze,
            hqAlive: sim.hqAlive,
          };
        });
      }

      rafRef.current = window.requestAnimationFrame(frameLoop);
    };

    rafRef.current = window.requestAnimationFrame(frameLoop);
    return () => {
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [initCampaign, phase, setSyncedPhase]);

  return (
    <div className="flex h-full w-full flex-col bg-[#060910] font-mono text-[#f5eefc] select-none">
      {/* Phase 1: Retro 1986 Arcade PCB Boot & ROM Self-Check Loading Screen */}
      {phase === 'loading' && (
        <div
          onClick={enterBattleFromBoot}
          className="relative flex h-full w-full cursor-pointer flex-col justify-between bg-[#070a12] p-5"
        >
          <div className="flex items-center justify-between border-b border-[#5ef2d6]/30 pb-2 text-[11px] text-[#7bf5dc]">
            <span>ARCADE PCB // UNIT-86</span>
            <span className="text-[#ffbc5e]">CREDIT 01</span>
          </div>

          <div className="my-auto flex flex-col gap-3">
            <div className="text-center">
              <div className="text-lg font-bold tracking-[0.22em] text-[#ffbc5e] sm:text-2xl">
                IRON TREADS
              </div>
              <div className="text-xs font-semibold tracking-widest text-[#7bf5dc]">
                铁 甲 战 线 · 1986 ROM BOOTING
              </div>
            </div>

            <div className="mx-auto w-full max-w-md rounded border border-[#5ef2d6]/35 bg-[#0a101d] p-3 text-[11px] leading-relaxed text-[#a8f5e5]">
              {BOOT_LOGS.slice(0, bootLinesShown).map((line, i) => (
                <div key={i} className="truncate">
                  {line}
                </div>
              ))}
            </div>

            {/* Progress track with mini pixel tank */}
            <div className="mx-auto w-full max-w-md space-y-1.5">
              <div className="flex justify-between text-[11px] tabular-nums text-[#ffe5ba]">
                <span>LOADING SPRITE &amp; TILE BANKS...</span>
                <span>{bootProgress}%</span>
              </div>
              <div className="h-3.5 w-full overflow-hidden rounded-sm border border-[#ffbc5e]/60 bg-[#121628] p-0.5">
                <div
                  className="h-full bg-[#ff9e4a] transition-[width] duration-75"
                  style={{ width: `${bootProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-[#a895bd]">
            按 [SPACE] / [ENTER] 或点击屏幕立即进入战场
          </div>
        </div>
      )}

      {/* Phase 2: Playable Retro Tank Shooter */}
      {phase !== 'loading' && (
        <>
          {/* Compact Top Arcade HUD Strip (strictly separated above battleground canvas) */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#ff9e4a]/30 bg-[#0d101c] px-2.5 py-1.5 text-[11px]">
            <div className="flex items-center gap-2.5 tabular-nums">
              <span className="font-bold text-[#ffbc5e]">STG {hud.stage}</span>
              <span className="text-[#ffe5ba]">
                SCR <strong className="text-white">{String(hud.score).padStart(6, '0')}</strong>
              </span>
              <span className="hidden items-center gap-1 text-[#7bf5dc] sm:inline-flex">
                <Trophy className="h-3 w-3" />
                {String(hud.hiScore).padStart(6, '0')}
              </span>
            </div>

            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-[#ff809a]">HP {hud.lives}</span>
              <span className="text-[#ffd166]">FOE {hud.enemiesLeft}</span>
              <span className="text-[#7bf5dc]">LV.{hud.weaponLevel}</span>
              {hud.shieldActive && (
                <span className="inline-flex items-center gap-0.5 text-[#5ef2d6]">
                  <Shield className="h-3 w-3" />
                  护盾
                </span>
              )}
              {hud.freezeActive && <span className="text-[#8ecbff]">冻结</span>}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleMute}
                title="音效开关 (M)"
                className="rounded border border-white/15 bg-white/5 p-1 text-[#e5daf2] hover:bg-white/15 cursor-pointer"
              >
                {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={handleTogglePause}
                title="暂停 / 继续 (P)"
                className="rounded border border-white/15 bg-white/5 p-1 text-[#e5daf2] hover:bg-white/15 cursor-pointer"
              >
                {phase === 'paused' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                title="重新开始 (R)"
                className="rounded border border-white/15 bg-white/5 p-1 text-[#e5daf2] hover:bg-white/15 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 4:3 Retro Battlefield Canvas */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#05070c] p-1">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onPointerDown={() => {
                mouseFireRef.current = true;
              }}
              onPointerUp={() => {
                mouseFireRef.current = false;
              }}
              onPointerLeave={() => {
                mouseFireRef.current = false;
              }}
              className="h-full w-full max-h-full max-w-full object-contain"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Stage Clear Overlay */}
            {phase === 'stage_clear' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#070a12]/72">
                <div className="rounded border-2 border-[#ffbc5e] bg-[#101424] px-6 py-4 text-center shadow-2xl">
                  <div className="text-lg font-bold tracking-widest text-[#ffbc5e]">
                    STAGE {hud.stage} CLEAR!
                  </div>
                  <div className="mt-1 text-xs text-[#7bf5dc]">
                    正在前往下一防线……
                  </div>
                </div>
              </div>
            )}

            {/* Pause Overlay */}
            {phase === 'paused' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#070a12]/80">
                <div className="rounded border-2 border-[#7bf5dc] bg-[#101424] px-6 py-4 text-center shadow-2xl">
                  <div className="text-base font-bold tracking-widest text-[#7bf5dc]">
                    PAUSED · 暂停
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="rounded bg-[#ff9e4a] px-3 py-1 text-xs font-bold text-[#140e1c] hover:bg-[#ffb770] cursor-pointer"
                    >
                      继续游戏
                    </button>
                    <button
                      type="button"
                      onClick={handleRestart}
                      className="rounded border border-white/25 px-3 py-1 text-xs text-white hover:bg-white/10 cursor-pointer"
                    >
                      重新开局
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Game Over Overlay */}
            {phase === 'game_over' && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#09050c]/86">
                <div className="rounded border-2 border-[#ff5a7a] bg-[#180d1e] px-6 py-4 text-center shadow-2xl">
                  <div className="text-xl font-bold tracking-widest text-[#ff5a7a]">
                    GAME OVER
                  </div>
                  <div className="mt-1 text-xs text-[#ffd1db]">
                    {hud.reason || '防线失守'}
                  </div>
                  <div className="mt-2 text-sm tabular-nums text-[#ffe5ba]">
                    SCORE {String(hud.score).padStart(6, '0')} · HI{' '}
                    {String(hud.hiScore).padStart(6, '0')}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleRestart}
                      className="rounded bg-[#ff5a7a] px-3.5 py-1 text-xs font-bold text-white hover:bg-[#ff748e] cursor-pointer"
                    >
                      投币重开 (R)
                    </button>
                    {onLeaveCabinet && (
                      <button
                        type="button"
                        onClick={onLeaveCabinet}
                        className="rounded border border-white/25 px-3 py-1 text-xs text-[#e5daf2] hover:bg-white/10 cursor-pointer"
                      >
                        离开街机
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
