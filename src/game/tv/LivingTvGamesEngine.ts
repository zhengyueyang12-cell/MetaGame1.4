export type TvGameSelectionId = 'snowball' | 'tank';
export type TvConsoleScreenMode = 'launcher' | 'snowball' | 'tank';

export interface TvGameControlInput {
  moveX: number; // -1..1
  moveY: number; // -1..1
  throwOrFire: boolean; // edge/hold trigger
  dodgeOrDash: boolean;
  buildWallOrShield: boolean;
}

export type TvGameReactionEvent =
  | 'match_start_snowball'
  | 'match_start_tank'
  | 'p1_hit'
  | 'p2_hit'
  | 'giant_pickup'
  | 'snow_wall_built'
  | 'p1_win'
  | 'p2_win'
  | 'tank_wave_clear';

interface SnowPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dirX: number;
  dirY: number;
  hp: number;
  maxHp: number;
  score: number;
  cooldown: number;
  wallCooldown: number;
  dashTimer: number;
  dashCooldown: number;
  invulnTimer: number;
  hurtFlash: number;
  carryingGiant: boolean;
  walkPhase: number;
  aiStrafeDir: number;
  aiThinkTimer: number;
}

interface SnowballProj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: 1 | 2;
  giant: boolean;
  radius: number;
  life: number;
}

interface SnowWall {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  owner: 1 | 2;
}

interface GiantSnowPickup {
  x: number;
  y: number;
  pulse: number;
}

interface SnowParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
}

// --- Tank Battle Types ---
type TankDir = 0 | 1 | 2 | 3; // 0: Up, 1: Right, 2: Down, 3: Left
// Tile grid: 26 x 13 tiles of 16x16px (arena x: 48..464, y: 44..252 -> 416x208)
// 0 = empty, 1 = brick (destructible), 2 = steel (indestructible), 3 = bush (cover), 4 = ice/water accent
interface TankEntity {
  x: number;
  y: number;
  dir: TankDir;
  kind: 'p1' | 'p2' | 'enemy_normal' | 'enemy_fast' | 'enemy_heavy';
  hp: number;
  speed: number;
  fireCooldown: number;
  dashCooldown: number;
  shieldTimer: number;
  invulnTimer: number;
  respawnTimer: number;
  score: number;
  alive: boolean;
  aiTimer: number;
  aiTargetX: number;
  aiTargetY: number;
  trackPhase: number;
}

interface TankBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  team: 'ally' | 'enemy';
  owner: 'p1' | 'p2' | 'enemy';
  power: number;
}

interface TankPowerup {
  x: number;
  y: number;
  kind: 'star' | 'shield' | 'bomb';
  life: number;
}

const ARENA_SNOW_LEFT = 24;
const ARENA_SNOW_TOP = 42;
const ARENA_SNOW_RIGHT = 488;
const ARENA_SNOW_BOTTOM = 266;

const TANK_COLS = 26;
const TANK_ROWS = 13;
const TANK_TILE = 16;
const TANK_ORIGIN_X = 48;
const TANK_ORIGIN_Y = 44;

const DIR_DX: readonly number[] = [0, 1, 0, -1];
const DIR_DY: readonly number[] = [-1, 0, 1, 0];

/**
 * Complete self-contained 512x288 Living Room TV Console Arcade Engine:
 * - Console Game Launcher Menu (`launcher`)
 * - Game 1 (`snowball`): 2P Snowball Fight (move, dodge roll, throw, stack destructible snow walls, giant snowball pickups)
 * - Game 2 (`tank`): 2P Co-Op Tank Battle (destructible brick/steel maze, armor waves, power-ups, explosions)
 */
export class LivingTvGamesEngine {
  public mode: TvConsoleScreenMode = 'launcher';
  public selectedGame: TvGameSelectionId = 'snowball';
  public aiReactionEvents: TvGameReactionEvent[] = [];

  private time = 0;
  private roundOverTimer = 0;
  private roundWinnerText = '';
  private prevFireHeld = false;
  private prevDodgeHeld = false;
  private prevWallHeld = false;

  // Ambient falling snowflakes
  private flakes: Array<{ x: number; y: number; r: number; speed: number; drift: number }> = [];

  // Snowball Fight State
  private snowP1!: SnowPlayer;
  private snowP2!: SnowPlayer;
  private snowballs: SnowballProj[] = [];
  private snowWalls: SnowWall[] = [];
  private giantPickups: GiantSnowPickup[] = [];
  private giantSpawnTimer = 4.5;
  private particles: SnowParticle[] = [];

  // Tank Battle State
  private tankGrid: number[][] = [];
  private tanks: TankEntity[] = [];
  private tankBullets: TankBullet[] = [];
  private tankPowerups: TankPowerup[] = [];
  private tankWave = 1;
  private tankEnemiesRemaining = 0;
  private tankSpawnTimer = 1.2;
  private tankBaseAlive = true;
  private tankP1Score = 0;
  private tankP2Score = 0;

  constructor() {
    for (let i = 0; i < 42; i++) {
      this.flakes.push({
        x: Math.random() * 512,
        y: Math.random() * 288,
        r: 1 + Math.random() * 2.2,
        speed: 14 + Math.random() * 22,
        drift: Math.random() * Math.PI * 2,
      });
    }
    this.resetSnowballMatch(false);
    this.resetTankMatch(1, false);
  }

  public selectLauncherCard(game: TvGameSelectionId): void {
    this.selectedGame = game;
  }

  public toggleLauncherCard(): TvGameSelectionId {
    this.selectedGame = this.selectedGame === 'snowball' ? 'tank' : 'snowball';
    return this.selectedGame;
  }

  public launchGame(game: TvGameSelectionId): void {
    this.selectedGame = game;
    this.mode = game;
    if (game === 'snowball') {
      this.resetSnowballMatch(true);
      this.aiReactionEvents.push('match_start_snowball');
    } else {
      this.resetTankMatch(1, true);
      this.aiReactionEvents.push('match_start_tank');
    }
  }

  public returnToLauncher(): void {
    this.mode = 'launcher';
    this.roundOverTimer = 0;
    this.roundWinnerText = '';
  }

  public drainEvents(): TvGameReactionEvent[] {
    if (this.aiReactionEvents.length === 0) return [];
    const copy = this.aiReactionEvents.slice();
    this.aiReactionEvents.length = 0;
    return copy;
  }

  private resetSnowballMatch(preserveScore: boolean): void {
    const prevS1 = preserveScore && this.snowP1 ? this.snowP1.score : 0;
    const prevS2 = preserveScore && this.snowP2 ? this.snowP2.score : 0;

    this.snowP1 = {
      x: 112,
      y: 154,
      vx: 0,
      vy: 0,
      dirX: 1,
      dirY: 0,
      hp: 5,
      maxHp: 5,
      score: prevS1,
      cooldown: 0.25,
      wallCooldown: 0,
      dashTimer: 0,
      dashCooldown: 0,
      invulnTimer: 0.5,
      hurtFlash: 0,
      carryingGiant: false,
      walkPhase: 0,
      aiStrafeDir: 1,
      aiThinkTimer: 0,
    };

    this.snowP2 = {
      x: 400,
      y: 154,
      vx: 0,
      vy: 0,
      dirX: -1,
      dirY: 0,
      hp: 5,
      maxHp: 5,
      score: prevS2,
      cooldown: 0.55,
      wallCooldown: 0.4,
      dashTimer: 0,
      dashCooldown: 0,
      invulnTimer: 0.5,
      hurtFlash: 0,
      carryingGiant: false,
      walkPhase: 0,
      aiStrafeDir: 1,
      aiThinkTimer: 0.3,
    };

    this.snowballs = [];
    this.particles = [];
    this.giantPickups = [];
    this.giantSpawnTimer = 3.8;
    this.roundOverTimer = 0;
    this.roundWinnerText = '';

    // Starter snow walls in courtyard
    this.snowWalls = [
      { x: 186, y: 102, w: 16, h: 36, hp: 3, maxHp: 3, owner: 1 },
      { x: 186, y: 174, w: 16, h: 36, hp: 3, maxHp: 3, owner: 1 },
      { x: 310, y: 102, w: 16, h: 36, hp: 3, maxHp: 3, owner: 2 },
      { x: 310, y: 174, w: 16, h: 36, hp: 3, maxHp: 3, owner: 2 },
    ];
  }

  private resetTankMatch(wave: number, preserveScore: boolean): void {
    this.tankWave = wave;
    if (!preserveScore) {
      this.tankP1Score = 0;
      this.tankP2Score = 0;
    }
    this.tankBaseAlive = true;
    this.tankBullets = [];
    this.tankPowerups = [];
    this.particles = [];
    this.roundOverTimer = 0;
    this.roundWinnerText = '';
    this.tankEnemiesRemaining = 5 + wave * 2;
    this.tankSpawnTimer = 0.8;

    // Build symmetric 26x13 brick/steel/bush battlefield
    const grid: number[][] = Array.from({ length: TANK_ROWS }, () =>
      Array.from({ length: TANK_COLS }, () => 0)
    );

    const setBrickBlock = (c0: number, r0: number, w: number, h: number, val = 1) => {
      for (let r = r0; r < r0 + h; r++) {
        for (let c = c0; c < c0 + w; c++) {
          if (r >= 0 && r < TANK_ROWS && c >= 0 && c < TANK_COLS) {
            grid[r][c] = val;
          }
        }
      }
    };

    // Classic defensive fortress pillars + destructible brick cover
    setBrickBlock(2, 2, 2, 4, 1);
    setBrickBlock(6, 2, 2, 3, 1);
    setBrickBlock(12, 2, 2, 2, 2); // Central steel armor block
    setBrickBlock(18, 2, 2, 3, 1);
    setBrickBlock(22, 2, 2, 4, 1);

    setBrickBlock(4, 6, 3, 1, 2);
    setBrickBlock(19, 6, 3, 1, 2);
    setBrickBlock(9, 5, 2, 3, 1);
    setBrickBlock(15, 5, 2, 3, 1);
    setBrickBlock(12, 6, 2, 1, 1);

    // Foliage ambush bushes
    setBrickBlock(0, 6, 2, 2, 3);
    setBrickBlock(24, 6, 2, 2, 3);
    setBrickBlock(11, 8, 4, 1, 3);

    // Lower cover walls
    setBrickBlock(3, 9, 2, 2, 1);
    setBrickBlock(21, 9, 2, 2, 1);

    // Brick bunker shielding HQ eagle at bottom-center (cols 12..13, row 12)
    setBrickBlock(11, 10, 4, 1, 1);
    grid[11][11] = 1;
    grid[12][11] = 1;
    grid[11][14] = 1;
    grid[12][14] = 1;
    grid[11][12] = 0;
    grid[11][13] = 0;
    grid[12][12] = 0;
    grid[12][13] = 0;

    this.tankGrid = grid;

    // Spawn P1 & Heroine P2 tanks flanking the HQ
    this.tanks = [
      {
        x: TANK_ORIGIN_X + 9 * TANK_TILE + 8,
        y: TANK_ORIGIN_Y + 12 * TANK_TILE + 8,
        dir: 0,
        kind: 'p1',
        hp: 3,
        speed: 88,
        fireCooldown: 0.2,
        dashCooldown: 0,
        shieldTimer: 2.0,
        invulnTimer: 2.0,
        respawnTimer: 0,
        score: this.tankP1Score,
        alive: true,
        aiTimer: 0,
        aiTargetX: 0,
        aiTargetY: 0,
        trackPhase: 0,
      },
      {
        x: TANK_ORIGIN_X + 16 * TANK_TILE + 8,
        y: TANK_ORIGIN_Y + 12 * TANK_TILE + 8,
        dir: 0,
        kind: 'p2',
        hp: 3,
        speed: 88,
        fireCooldown: 0.3,
        dashCooldown: 0,
        shieldTimer: 2.0,
        invulnTimer: 2.0,
        respawnTimer: 0,
        score: this.tankP2Score,
        alive: true,
        aiTimer: 0.2,
        aiTargetX: TANK_ORIGIN_X + 13 * TANK_TILE,
        aiTargetY: TANK_ORIGIN_Y + 4 * TANK_TILE,
        trackPhase: 0,
      },
    ];
  }

  public update(dt: number, input: TvGameControlInput): void {
    const safeDt = Math.min(0.05, Math.max(0, dt));
    this.time += safeDt;

    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      f.y += f.speed * safeDt;
      f.x += Math.sin(this.time * 1.4 + f.drift) * 9 * safeDt;
      if (f.y > 292) {
        f.y = -4;
        f.x = Math.random() * 512;
      }
    }

    const fireEdge = input.throwOrFire && !this.prevFireHeld;
    const dodgeEdge = input.dodgeOrDash && !this.prevDodgeHeld;
    const wallEdge = input.buildWallOrShield && !this.prevWallHeld;
    this.prevFireHeld = input.throwOrFire;
    this.prevDodgeHeld = input.dodgeOrDash;
    this.prevWallHeld = input.buildWallOrShield;

    if (this.mode === 'launcher') {
      return;
    }

    if (this.mode === 'snowball') {
      this.updateSnowball(safeDt, input, fireEdge, dodgeEdge, wallEdge);
    } else if (this.mode === 'tank') {
      this.updateTank(safeDt, input, fireEdge || input.throwOrFire, dodgeEdge, wallEdge);
    }
  }

  private spawnBurst(x: number, y: number, color: string, count: number, speed = 80): void {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2 + Math.random() * 2.5,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        color,
      });
    }
  }

  // =========================================================================
  // GAME 1: 2P SNOWBALL FIGHT (躲避、投掷、堆雪墙、巨型雪球)
  // =========================================================================
  private updateSnowball(
    dt: number,
    input: TvGameControlInput,
    fireEdge: boolean,
    dodgeEdge: boolean,
    wallEdge: boolean
  ): void {
    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }

    if (this.roundOverTimer > 0) {
      this.roundOverTimer -= dt;
      if (this.roundOverTimer <= 0) {
        this.resetSnowballMatch(true);
      }
      return;
    }

    // Spawn giant snowballs periodically near center arena
    if (this.giantPickups.length < 2) {
      this.giantSpawnTimer -= dt;
      if (this.giantSpawnTimer <= 0) {
        this.giantSpawnTimer = 8.5 + Math.random() * 3.5;
        this.giantPickups.push({
          x: 242 + (Math.random() - 0.5) * 60,
          y: 86 + Math.random() * 136,
          pulse: 0,
        });
      }
    }

    for (let i = 0; i < this.giantPickups.length; i++) {
      this.giantPickups[i].pulse += dt * 4.0;
    }

    // Update P1 (Protagonist)
    this.updateSnowPlayerStep(this.snowP1, dt, input.moveX, input.moveY, dodgeEdge);
    if (fireEdge || (input.throwOrFire && this.snowP1.cooldown <= 0)) {
      this.fireSnowball(this.snowP1, 1);
    }
    if (wallEdge || dodgeEdge) {
      this.tryBuildSnowWall(this.snowP1, 1);
    }

    // Update P2 (Heroine AI)
    this.updateSnowHeroineAi(dt);

    // Pickup Giant Snowballs
    for (const [pl, owner] of [
      [this.snowP1, 1],
      [this.snowP2, 2],
    ] as const) {
      if (pl.carryingGiant) continue;
      for (let i = this.giantPickups.length - 1; i >= 0; i--) {
        const g = this.giantPickups[i];
        if (Math.hypot(pl.x - g.x, pl.y - g.y) < 22) {
          pl.carryingGiant = true;
          this.giantPickups.splice(i, 1);
          this.spawnBurst(g.x, g.y, '#d8f4ff', 10, 70);
          if (owner === 2) {
            this.aiReactionEvents.push('giant_pickup');
          }
          break;
        }
      }
    }

    // Update snowballs + collision with walls & players
    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const b = this.snowballs[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.giant && Math.random() < 0.55) {
        this.particles.push({
          x: b.x + (Math.random() - 0.5) * 10,
          y: b.y + (Math.random() - 0.5) * 10,
          vx: -b.vx * 0.12,
          vy: -b.vy * 0.12,
          size: 3.5,
          life: 0,
          maxLife: 0.25,
          color: '#e8f9ff',
        });
      }

      if (
        b.life <= 0 ||
        b.x < ARENA_SNOW_LEFT ||
        b.x > ARENA_SNOW_RIGHT ||
        b.y < ARENA_SNOW_TOP ||
        b.y > ARENA_SNOW_BOTTOM
      ) {
        this.spawnBurst(b.x, b.y, '#ffffff', b.giant ? 14 : 6, b.giant ? 110 : 60);
        this.snowballs.splice(i, 1);
        continue;
      }

      // Check Snow Walls
      let hitWall = false;
      for (let wIdx = this.snowWalls.length - 1; wIdx >= 0; wIdx--) {
        const w = this.snowWalls[wIdx];
        if (w.owner === b.owner && !b.giant) continue; // Friendly passes through own cover
        if (
          b.x + b.radius > w.x &&
          b.x - b.radius < w.x + w.w &&
          b.y + b.radius > w.y &&
          b.y - b.radius < w.y + w.h
        ) {
          w.hp -= b.giant ? 3 : 1;
          this.spawnBurst(b.x, b.y, '#e2f4ff', b.giant ? 14 : 7, 85);
          if (w.hp <= 0) {
            this.snowWalls.splice(wIdx, 1);
          }
          if (!b.giant) {
            hitWall = true;
            break;
          }
        }
      }
      if (hitWall) {
        this.snowballs.splice(i, 1);
        continue;
      }

      // Check Opponent Hit
      const target = b.owner === 1 ? this.snowP2 : this.snowP1;
      const targetId = b.owner === 1 ? 2 : 1;
      if (target.invulnTimer <= 0 && target.dashTimer <= 0) {
        if (Math.hypot(b.x - target.x, b.y - target.y) < b.radius + 11) {
          const dmg = b.giant ? 2 : 1;
          target.hp = Math.max(0, target.hp - dmg);
          target.invulnTimer = 0.72;
          target.hurtFlash = 0.35;
          this.spawnBurst(b.x, b.y, '#ffffff', b.giant ? 18 : 10, 120);
          this.snowballs.splice(i, 1);

          if (targetId === 2) {
            this.aiReactionEvents.push('p2_hit');
          } else {
            this.aiReactionEvents.push('p1_hit');
          }

          if (target.hp <= 0) {
            if (b.owner === 1) {
              this.snowP1.score += 1;
              this.roundWinnerText = 'P1 获胜！';
              this.aiReactionEvents.push('p1_win');
            } else {
              this.snowP2.score += 1;
              this.roundWinnerText = '女主 获胜！';
              this.aiReactionEvents.push('p2_win');
            }
            this.roundOverTimer = 2.6;
          }
        }
      }
    }
  }

  private updateSnowPlayerStep(
    pl: SnowPlayer,
    dt: number,
    moveX: number,
    moveY: number,
    dodgeEdge: boolean
  ): void {
    pl.cooldown = Math.max(0, pl.cooldown - dt);
    pl.wallCooldown = Math.max(0, pl.wallCooldown - dt);
    pl.dashCooldown = Math.max(0, pl.dashCooldown - dt);
    pl.invulnTimer = Math.max(0, pl.invulnTimer - dt);
    pl.hurtFlash = Math.max(0, pl.hurtFlash - dt);

    const len = Math.hypot(moveX, moveY);
    const nx = len > 0.05 ? moveX / len : 0;
    const ny = len > 0.05 ? moveY / len : 0;
    if (len > 0.1) {
      pl.dirX = nx;
      pl.dirY = ny;
      pl.walkPhase += dt * 11;
    }

    if (dodgeEdge && pl.dashCooldown <= 0) {
      pl.dashTimer = 0.22;
      pl.dashCooldown = 1.05;
      const dx = nx !== 0 || ny !== 0 ? nx : pl.dirX;
      const dy = nx !== 0 || ny !== 0 ? ny : pl.dirY;
      pl.vx = dx * 290;
      pl.vy = dy * 290;
      this.spawnBurst(pl.x, pl.y, '#e8f7ff', 6, 55);
    }

    if (pl.dashTimer > 0) {
      pl.dashTimer = Math.max(0, pl.dashTimer - dt);
      pl.x += pl.vx * dt;
      pl.y += pl.vy * dt;
    } else {
      const spd = pl.carryingGiant ? 96 : 128;
      pl.x += nx * spd * dt;
      pl.y += ny * spd * dt;
    }

    pl.x = Math.max(ARENA_SNOW_LEFT + 12, Math.min(ARENA_SNOW_RIGHT - 12, pl.x));
    pl.y = Math.max(ARENA_SNOW_TOP + 14, Math.min(ARENA_SNOW_BOTTOM - 14, pl.y));
  }

  private fireSnowball(pl: SnowPlayer, owner: 1 | 2): void {
    if (pl.cooldown > 0) return;
    const opponent = owner === 1 ? this.snowP2 : this.snowP1;
    let aimX = pl.dirX;
    let aimY = pl.dirY;

    // Helpful gentle aim-assist toward opponent if aiming roughly in their hemisphere
    const toOppX = opponent.x - pl.x;
    const toOppY = opponent.y - pl.y;
    const dist = Math.hypot(toOppX, toOppY);
    if (dist > 4) {
      const ox = toOppX / dist;
      const oy = toOppY / dist;
      const dot = aimX * ox + aimY * oy;
      if (dot > 0.25) {
        aimX = ox;
        aimY = oy;
      }
    }

    const giant = pl.carryingGiant;
    pl.carryingGiant = false;
    pl.cooldown = giant ? 0.55 : 0.38;
    const spd = giant ? 295 : 245;

    this.snowballs.push({
      x: pl.x + aimX * 14,
      y: pl.y + aimY * 14,
      vx: aimX * spd,
      vy: aimY * spd,
      owner,
      giant,
      radius: giant ? 12 : 5,
      life: 2.1,
    });
  }

  private tryBuildSnowWall(pl: SnowPlayer, owner: 1 | 2): void {
    if (pl.wallCooldown > 0) return;
    const ownWalls = this.snowWalls.filter((w) => w.owner === owner);
    if (ownWalls.length >= 4) {
      const idx = this.snowWalls.findIndex((w) => w.owner === owner);
      if (idx !== -1) this.snowWalls.splice(idx, 1);
    }
    pl.wallCooldown = 1.8;
    const wx = Math.max(
      ARENA_SNOW_LEFT + 18,
      Math.min(ARENA_SNOW_RIGHT - 34, pl.x + pl.dirX * 26 - 8)
    );
    const wy = Math.max(
      ARENA_SNOW_TOP + 12,
      Math.min(ARENA_SNOW_BOTTOM - 46, pl.y + pl.dirY * 26 - 17)
    );
    this.snowWalls.push({ x: wx, y: wy, w: 16, h: 34, hp: 3, maxHp: 3, owner });
    this.spawnBurst(wx + 8, wy + 17, '#ffffff', 8, 55);
    if (owner === 1) {
      this.aiReactionEvents.push('snow_wall_built');
    }
  }

  private updateSnowHeroineAi(dt: number): void {
    const ai = this.snowP2;
    const p1 = this.snowP1;
    ai.aiThinkTimer -= dt;
    if (ai.aiThinkTimer <= 0) {
      ai.aiThinkTimer = 0.45 + Math.random() * 0.45;
      if (Math.random() < 0.45) ai.aiStrafeDir *= -1;
    }

    let moveX = 0;
    let moveY = 0;
    let wantDodge = false;
    let wantWall = false;

    // 1. Dodge incoming P1 snowballs
    for (let i = 0; i < this.snowballs.length; i++) {
      const b = this.snowballs[i];
      if (b.owner !== 1) continue;
      const dx = ai.x - b.x;
      const dy = ai.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 110) {
        const dot = (dx * b.vx + dy * b.vy) / Math.max(1, dist * Math.hypot(b.vx, b.vy));
        if (dot > 0.62) {
          // Sidestep perpendicular to projectile velocity
          moveX = -b.vy * ai.aiStrafeDir;
          moveY = b.vx * ai.aiStrafeDir;
          if (dist < 62 && ai.dashCooldown <= 0) {
            wantDodge = true;
          } else if (ai.wallCooldown <= 0 && Math.random() < 0.08) {
            wantWall = true;
          }
          break;
        }
      }
    }

    // 2. Otherwise chase giant snowball pickup or strafe-duel P1
    if (moveX === 0 && moveY === 0) {
      if (!ai.carryingGiant && this.giantPickups.length > 0) {
        const g = this.giantPickups[0];
        moveX = g.x - ai.x;
        moveY = g.y - ai.y;
      } else {
        const targetX = Math.max(270, Math.min(452, p1.x + 170));
        moveX = targetX - ai.x;
        moveY = (p1.y - ai.y) * 0.4 + ai.aiStrafeDir * 44;
      }
    }

    this.updateSnowPlayerStep(ai, dt, moveX, moveY, wantDodge);

    // Face toward P1 to aim & build cover toward P1
    const aimDx = p1.x - ai.x;
    const aimDy = p1.y - ai.y;
    const aimLen = Math.max(1, Math.hypot(aimDx, aimDy));
    ai.dirX = aimDx / aimLen;
    ai.dirY = aimDy / aimLen;

    if (wantWall) {
      this.tryBuildSnowWall(ai, 2);
    }

    if (ai.cooldown <= 0 && (ai.carryingGiant || Math.random() < dt * 2.2)) {
      this.fireSnowball(ai, 2);
    }
  }

  // =========================================================================
  // GAME 2: 2P TANK BATTLE (坦克大战)
  // =========================================================================
  private updateTank(
    dt: number,
    input: TvGameControlInput,
    fireWanted: boolean,
    dodgeEdge: boolean,
    shieldEdge: boolean
  ): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
      if (p.life >= p.maxLife) this.particles.splice(i, 1);
    }

    if (this.roundOverTimer > 0) {
      this.roundOverTimer -= dt;
      if (this.roundOverTimer <= 0) {
        const nextWave = this.tankBaseAlive ? this.tankWave + 1 : 1;
        this.resetTankMatch(nextWave, this.tankBaseAlive);
      }
      return;
    }

    // Spawn enemy wave tanks from top 3 bays
    const activeEnemies = this.tanks.filter((t) => t.alive && t.kind.startsWith('enemy')).length;
    if (this.tankEnemiesRemaining > 0 && activeEnemies < 4) {
      this.tankSpawnTimer -= dt;
      if (this.tankSpawnTimer <= 0) {
        this.tankSpawnTimer = 2.4;
        const spawnCols = [1, 12, 24];
        const sc = spawnCols[Math.floor(Math.random() * spawnCols.length)];
        const roll = Math.random();
        const kind: TankEntity['kind'] =
          roll < 0.25 ? 'enemy_fast' : roll < 0.45 ? 'enemy_heavy' : 'enemy_normal';
        this.tanks.push({
          x: TANK_ORIGIN_X + sc * TANK_TILE + 8,
          y: TANK_ORIGIN_Y + 8,
          dir: 2,
          kind,
          hp: kind === 'enemy_heavy' ? 2 : 1,
          speed: kind === 'enemy_fast' ? 88 : kind === 'enemy_heavy' ? 46 : 62,
          fireCooldown: 0.7,
          dashCooldown: 0,
          shieldTimer: 0,
          invulnTimer: 0.5,
          respawnTimer: 0,
          score: 0,
          alive: true,
          aiTimer: 0.6,
          aiTargetX: TANK_ORIGIN_X + 12.5 * TANK_TILE,
          aiTargetY: TANK_ORIGIN_Y + 12 * TANK_TILE,
          trackPhase: 0,
        });
        this.tankEnemiesRemaining -= 1;
      }
    }

    // Update all tanks
    const p1 = this.tanks.find((t) => t.kind === 'p1');
    const p2 = this.tanks.find((t) => t.kind === 'p2');

    if (p1) {
      if (!p1.alive) {
        p1.respawnTimer -= dt;
        if (p1.respawnTimer <= 0) {
          p1.alive = true;
          p1.hp = 3;
          p1.x = TANK_ORIGIN_X + 9 * TANK_TILE + 8;
          p1.y = TANK_ORIGIN_Y + 12 * TANK_TILE + 8;
          p1.dir = 0;
          p1.invulnTimer = 2.0;
          p1.shieldTimer = 2.0;
        }
      } else {
        p1.fireCooldown = Math.max(0, p1.fireCooldown - dt);
        p1.dashCooldown = Math.max(0, p1.dashCooldown - dt);
        p1.shieldTimer = Math.max(0, p1.shieldTimer - dt);
        p1.invulnTimer = Math.max(0, p1.invulnTimer - dt);

        let moveDir: TankDir | null = null;
        if (Math.abs(input.moveX) > Math.abs(input.moveY)) {
          if (input.moveX > 0.2) moveDir = 1;
          else if (input.moveX < -0.2) moveDir = 3;
        } else {
          if (input.moveY < -0.2) moveDir = 0;
          else if (input.moveY > 0.2) moveDir = 2;
        }
        const shiftBoost = (shieldEdge || dodgeEdge) && p1.dashCooldown <= 0;
        if (shiftBoost) {
          p1.shieldTimer = 2.4;
          p1.dashCooldown = 2.4;
        }
        if (moveDir !== null) {
          p1.dir = moveDir;
          const dashBoost = shiftBoost ? 1.9 : 1.0;
          this.moveTankStep(p1, p1.speed * dashBoost * dt);
        }
        if (fireWanted && p1.fireCooldown <= 0) {
          this.fireTankBullet(p1);
        }
      }
    }

    if (p2) {
      this.updateHeroineTankAi(p2, dt);
    }

    for (let i = 0; i < this.tanks.length; i++) {
      const t = this.tanks[i];
      if (!t.alive || !t.kind.startsWith('enemy')) continue;
      this.updateEnemyTankAi(t, dt);
    }

    // Powerups pickup
    for (let i = this.tankPowerups.length - 1; i >= 0; i--) {
      const pu = this.tankPowerups[i];
      pu.life -= dt;
      if (pu.life <= 0) {
        this.tankPowerups.splice(i, 1);
        continue;
      }
      for (const ally of [p1, p2]) {
        if (!ally || !ally.alive) continue;
        if (Math.hypot(ally.x - pu.x, ally.y - pu.y) < 16) {
          if (pu.kind === 'shield') {
            ally.shieldTimer = 5.0;
          } else if (pu.kind === 'star') {
            ally.speed = Math.min(116, ally.speed + 10);
          } else {
            // Bomb clears active enemies
            for (const en of this.tanks) {
              if (en.alive && en.kind.startsWith('enemy')) {
                en.alive = false;
                this.spawnBurst(en.x, en.y, '#ffb347', 12, 95);
                if (ally.kind === 'p1') this.tankP1Score += 100;
                else this.tankP2Score += 100;
              }
            }
          }
          this.tankPowerups.splice(i, 1);
          break;
        }
      }
    }

    // Bullets update & collision
    for (let i = this.tankBullets.length - 1; i >= 0; i--) {
      const b = this.tankBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      const gx = Math.floor((b.x - TANK_ORIGIN_X) / TANK_TILE);
      const gy = Math.floor((b.y - TANK_ORIGIN_Y) / TANK_TILE);

      if (gx < 0 || gx >= TANK_COLS || gy < 0 || gy >= TANK_ROWS) {
        this.spawnBurst(b.x, b.y, '#ffdd88', 4, 45);
        this.tankBullets.splice(i, 1);
        continue;
      }

      const cell = this.tankGrid[gy][gx];
      if (cell === 1 || cell === 2) {
        if (cell === 1) {
          this.tankGrid[gy][gx] = 0;
          this.spawnBurst(b.x, b.y, '#e87a48', 7, 70);
        } else {
          this.spawnBurst(b.x, b.y, '#c8d6f0', 4, 50);
        }
        this.tankBullets.splice(i, 1);
        continue;
      }

      // Check HQ Heart-Eagle hit (cols 12..13, row 12)
      if (gy === 12 && (gx === 12 || gx === 13)) {
        if (b.team === 'enemy') {
          this.tankBaseAlive = false;
          this.spawnBurst(b.x, b.y, '#ff5978', 22, 125);
          this.roundWinnerText = '基地被毁！重新挑战';
          this.roundOverTimer = 2.6;
          this.aiReactionEvents.push('p1_hit');
        }
        this.tankBullets.splice(i, 1);
        continue;
      }

      // Check Tank hits
      let consumed = false;
      for (let tIdx = 0; tIdx < this.tanks.length; tIdx++) {
        const tk = this.tanks[tIdx];
        if (!tk.alive) continue;
        const tkTeam = tk.kind === 'p1' || tk.kind === 'p2' ? 'ally' : 'enemy';
        if (tkTeam === b.team) continue;
        if (Math.hypot(tk.x - b.x, tk.y - b.y) < 11) {
          consumed = true;
          if (tk.shieldTimer > 0 || tk.invulnTimer > 0) {
            this.spawnBurst(b.x, b.y, '#9ce8ff', 5, 50);
          } else {
            tk.hp -= b.power;
            this.spawnBurst(b.x, b.y, '#ffb347', 10, 85);
            if (tk.hp <= 0) {
              tk.alive = false;
              this.spawnBurst(tk.x, tk.y, '#ff6d4d', 16, 110);
              if (tkTeam === 'enemy') {
                if (b.owner === 'p1') this.tankP1Score += 100;
                else if (b.owner === 'p2') {
                  this.tankP2Score += 100;
                  this.aiReactionEvents.push('p2_win');
                }
                if (Math.random() < 0.28) {
                  const kinds: Array<TankPowerup['kind']> = ['star', 'shield', 'bomb'];
                  this.tankPowerups.push({
                    x: tk.x,
                    y: tk.y,
                    kind: kinds[Math.floor(Math.random() * kinds.length)],
                    life: 11,
                  });
                }
              } else {
                tk.respawnTimer = 2.5;
                if (tk.kind === 'p2') this.aiReactionEvents.push('p2_hit');
                else this.aiReactionEvents.push('p1_hit');
              }
            }
          }
          break;
        }
      }
      if (consumed) {
        this.tankBullets.splice(i, 1);
      }
    }

    // Check Wave Win
    const stillAliveEnemies = this.tanks.some((t) => t.alive && t.kind.startsWith('enemy'));
    if (this.tankEnemiesRemaining === 0 && !stillAliveEnemies && this.tankBaseAlive) {
      this.roundWinnerText = `第 ${this.tankWave} 关清空！`;
      this.roundOverTimer = 2.6;
      this.aiReactionEvents.push('tank_wave_clear');
    }
  }

  private moveTankStep(tk: TankEntity, dist: number): boolean {
    const nx = tk.x + DIR_DX[tk.dir] * dist;
    const ny = tk.y + DIR_DY[tk.dir] * dist;
    const half = 6.6;

    const minX = TANK_ORIGIN_X + half;
    const maxX = TANK_ORIGIN_X + TANK_COLS * TANK_TILE - half;
    const minY = TANK_ORIGIN_Y + half;
    const maxY = TANK_ORIGIN_Y + TANK_ROWS * TANK_TILE - half;
    if (nx < minX || nx > maxX || ny < minY || ny > maxY) {
      return false;
    }

    // Check 4 corners against solid tiles (1 = brick, 2 = steel)
    const corners = [
      [nx - half, ny - half],
      [nx + half, ny - half],
      [nx - half, ny + half],
      [nx + half, ny + half],
    ];
    for (const [cx, cy] of corners) {
      const gx = Math.floor((cx - TANK_ORIGIN_X) / TANK_TILE);
      const gy = Math.floor((cy - TANK_ORIGIN_Y) / TANK_TILE);
      if (gx >= 0 && gx < TANK_COLS && gy >= 0 && gy < TANK_ROWS) {
        const cell = this.tankGrid[gy][gx];
        if (cell === 1 || cell === 2) {
          // Gentle lane-centering nudge so tanks glide smoothly through 16px corridors!
          if (tk.dir === 0 || tk.dir === 2) {
            const centerCol = Math.round((tk.x - TANK_ORIGIN_X - 8) / TANK_TILE);
            const targetX = TANK_ORIGIN_X + centerCol * TANK_TILE + 8;
            tk.x += Math.sign(targetX - tk.x) * Math.min(Math.abs(targetX - tk.x), dist * 0.6);
          } else {
            const centerRow = Math.round((tk.y - TANK_ORIGIN_Y - 8) / TANK_TILE);
            const targetY = TANK_ORIGIN_Y + centerRow * TANK_TILE + 8;
            tk.y += Math.sign(targetY - tk.y) * Math.min(Math.abs(targetY - tk.y), dist * 0.6);
          }
          return false;
        }
      }
    }

    tk.x = nx;
    tk.y = ny;
    tk.trackPhase += dist * 0.5;
    return true;
  }

  private fireTankBullet(tk: TankEntity): void {
    tk.fireCooldown = tk.kind === 'p1' || tk.kind === 'p2' ? 0.38 : 1.05;
    const spd = tk.kind === 'p1' || tk.kind === 'p2' ? 215 : 155;
    this.tankBullets.push({
      x: tk.x + DIR_DX[tk.dir] * 9,
      y: tk.y + DIR_DY[tk.dir] * 9,
      vx: DIR_DX[tk.dir] * spd,
      vy: DIR_DY[tk.dir] * spd,
      team: tk.kind === 'p1' || tk.kind === 'p2' ? 'ally' : 'enemy',
      owner: tk.kind === 'p1' ? 'p1' : tk.kind === 'p2' ? 'p2' : 'enemy',
      power: 1,
    });
  }

  private updateHeroineTankAi(p2: TankEntity, dt: number): void {
    if (!p2.alive) {
      p2.respawnTimer -= dt;
      if (p2.respawnTimer <= 0) {
        p2.alive = true;
        p2.hp = 3;
        p2.x = TANK_ORIGIN_X + 16 * TANK_TILE + 8;
        p2.y = TANK_ORIGIN_Y + 12 * TANK_TILE + 8;
        p2.dir = 0;
        p2.shieldTimer = 2.2;
      }
      return;
    }

    p2.fireCooldown = Math.max(0, p2.fireCooldown - dt);
    p2.shieldTimer = Math.max(0, p2.shieldTimer - dt);
    p2.invulnTimer = Math.max(0, p2.invulnTimer - dt);
    p2.aiTimer -= dt;

    const nearestEnemy = this.tanks.find((t) => t.alive && t.kind.startsWith('enemy'));
    if (p2.aiTimer <= 0) {
      p2.aiTimer = 0.55 + Math.random() * 0.45;
      if (nearestEnemy) {
        const dx = nearestEnemy.x - p2.x;
        const dy = nearestEnemy.y - p2.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          p2.dir = dx >= 0 ? 1 : 3;
        } else {
          p2.dir = dy >= 0 ? 2 : 0;
        }
      } else {
        p2.dir = (Math.floor(Math.random() * 4) as TankDir);
      }
    }

    const moved = this.moveTankStep(p2, p2.speed * dt);
    if (!moved && p2.fireCooldown <= 0) {
      // Blast through brick or pick an open direction
      this.fireTankBullet(p2);
      p2.dir = ((p2.dir + (Math.random() < 0.5 ? 1 : 3)) % 4) as TankDir;
    } else if (p2.fireCooldown <= 0 && nearestEnemy) {
      const aligned =
        (Math.abs(nearestEnemy.x - p2.x) < 20 && ((p2.dir === 0 && nearestEnemy.y < p2.y) || (p2.dir === 2 && nearestEnemy.y > p2.y))) ||
        (Math.abs(nearestEnemy.y - p2.y) < 20 && ((p2.dir === 1 && nearestEnemy.x > p2.x) || (p2.dir === 3 && nearestEnemy.x < p2.x)));
      if (aligned || Math.random() < dt * 1.4) {
        this.fireTankBullet(p2);
      }
    }
  }

  private updateEnemyTankAi(en: TankEntity, dt: number): void {
    en.fireCooldown = Math.max(0, en.fireCooldown - dt);
    en.invulnTimer = Math.max(0, en.invulnTimer - dt);
    en.aiTimer -= dt;

    const moved = this.moveTankStep(en, en.speed * dt);
    if (!moved || en.aiTimer <= 0) {
      en.aiTimer = 0.75 + Math.random() * 1.1;
      const hqX = TANK_ORIGIN_X + 12.5 * TANK_TILE;
      const hqY = TANK_ORIGIN_Y + 12 * TANK_TILE;
      if (Math.random() < 0.62) {
        const dx = hqX - en.x;
        const dy = hqY - en.y;
        en.dir = Math.abs(dy) > Math.abs(dx) * 0.8 ? (dy > 0 ? 2 : 0) : dx > 0 ? 1 : 3;
      } else {
        en.dir = (Math.floor(Math.random() * 4) as TankDir);
      }
    }
    if (en.fireCooldown <= 0 && (!moved || Math.random() < dt * 1.1)) {
      this.fireTankBullet(en);
    }
  }

  // =========================================================================
  // CANVAS 2D RENDERER (512x288)
  // =========================================================================
  public render(c: CanvasRenderingContext2D, rawW: number, rawH: number, isCoPlaying: boolean): void {
    c.save();
    c.imageSmoothingEnabled = false;

    if (this.mode === 'launcher') {
      this.renderLauncher(c, rawW, rawH, isCoPlaying);
    } else if (this.mode === 'snowball') {
      this.renderSnowball(c, rawW, rawH);
    } else {
      this.renderTank(c, rawW, rawH);
    }

    c.restore();
  }

  private renderLauncher(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    isCoPlaying: boolean
  ): void {
    // Cozy midnight-twilight retro console backdrop (rich deep colors, crisp contrast!)
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#131633');
    grad.addColorStop(0.55, '#1e1b44');
    grad.addColorStop(1, '#26173e');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    // Subtle snow-drift starfield
    c.fillStyle = 'rgba(225, 240, 255, 0.55)';
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      c.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
    }

    // Header banner
    c.fillStyle = 'rgba(12, 10, 26, 0.72)';
    c.fillRect(0, 0, W, 42);
    c.fillStyle = '#a389ff';
    c.fillRect(0, 41, W, 2);

    c.fillStyle = '#f6e9ff';
    c.font = 'bold 17px monospace';
    c.textAlign = 'left';
    c.fillText('TWILIGHT CO-OP CONSOLE · 双人游戏机', 18, 26);

    c.fillStyle = '#9ceeff';
    c.font = 'bold 12px monospace';
    c.textAlign = 'right';
    c.fillText('P1 白手柄 · P2 浅紫手柄', W - 18, 25);

    // Game Selection Cards
    const cards: Array<{
      id: TvGameSelectionId;
      x: number;
      title: string;
      sub: string;
      tag: string;
      accent: string;
      bg: string;
    }> = [
      {
        id: 'snowball',
        x: 34,
        title: '① 双人打雪仗',
        sub: '投掷 · 闪避 · 堆雪墙 · 巨型雪球',
        tag: 'SNOWBALL SHOWDOWN',
        accent: '#6ae3ff',
        bg: '#163252',
      },
      {
        id: 'tank',
        x: 268,
        title: '② 坦克大战',
        sub: '双人联机 · 拆砖轰炸 · 守卫基地',
        tag: 'CO-OP TANK BATTLE',
        accent: '#ffb35c',
        bg: '#32211e',
      },
    ];

    for (const card of cards) {
      const selected = this.selectedGame === card.id;
      const y = 62;
      const cw = 210;
      const ch = 174;

      if (selected) {
        c.fillStyle = 'rgba(255, 255, 255, 0.14)';
        c.fillRect(card.x - 4, y - 4, cw + 8, ch + 8);
      }

      c.fillStyle = card.bg;
      c.fillRect(card.x, y, cw, ch);

      c.strokeStyle = selected ? card.accent : 'rgba(255,255,255,0.22)';
      c.lineWidth = selected ? 3 : 1.5;
      c.strokeRect(card.x, y, cw, ch);

      // Illustrated mini-preview inside card
      c.fillStyle = card.id === 'snowball' ? '#254f7a' : '#181822';
      c.fillRect(card.x + 12, y + 12, cw - 24, 92);

      if (card.id === 'snowball') {
        // Snow courtyard art
        c.fillStyle = '#dff5ff';
        c.fillRect(card.x + 12, y + 84, cw - 24, 20);
        // Snow wall
        c.fillStyle = '#ffffff';
        c.fillRect(card.x + 96, y + 54, 14, 30);
        // White & lavender characters + giant snowball
        c.fillStyle = '#ffffff';
        c.fillRect(card.x + 42, y + 56, 16, 22);
        c.fillStyle = '#63d8ff';
        c.fillRect(card.x + 44, y + 50, 12, 6);
        c.fillStyle = '#d3b2ff';
        c.fillRect(card.x + 148, y + 56, 16, 22);
        c.fillStyle = '#ff85bf';
        c.fillRect(card.x + 150, y + 50, 12, 6);
        // Giant snowball flying!
        c.fillStyle = '#ffffff';
        c.beginPath();
        c.arc(card.x + 106, y + 36, 12, 0, Math.PI * 2);
        c.fill();
      } else {
        // Tank arena preview art
        c.fillStyle = '#c85a32';
        for (let bx = 0; bx < 5; bx++) {
          c.fillRect(card.x + 28 + bx * 32, y + 30, 20, 12);
        }
        // P1 cyan tank + P2 lavender tank
        c.fillStyle = '#69dcff';
        c.fillRect(card.x + 56, y + 68, 18, 18);
        c.fillRect(card.x + 63, y + 58, 4, 12);
        c.fillStyle = '#cfa8ff';
        c.fillRect(card.x + 132, y + 68, 18, 18);
        c.fillRect(card.x + 139, y + 58, 4, 12);
        // Enemy red tank
        c.fillStyle = '#ff6352';
        c.fillRect(card.x + 96, y + 22, 18, 16);
      }

      // Labels
      c.fillStyle = '#ffffff';
      c.font = 'bold 16px monospace';
      c.textAlign = 'left';
      c.fillText(card.title, card.x + 14, y + 128);

      c.fillStyle = '#d5c9f0';
      c.font = '11.5px monospace';
      c.fillText(card.sub, card.x + 14, y + 149);

      c.fillStyle = selected ? card.accent : '#8d86aa';
      c.font = 'bold 10.5px monospace';
      c.fillText(selected ? `▶ ${card.tag}` : card.tag, card.x + 14, y + 166);
    }

    // Bottom Prompt
    c.fillStyle = 'rgba(10, 8, 22, 0.80)';
    c.fillRect(0, H - 38, W, 38);
    c.fillStyle = '#ffe2f6';
    c.font = 'bold 13px monospace';
    c.textAlign = 'center';
    c.fillText(
      isCoPlaying
        ? '[滚轮] 选择游戏  ·  [F] 确认开始'
        : '坐在沙发上滚轮选择「一起打游戏」按 [F] 开玩！',
      W / 2,
      H - 14
    );
  }

  private renderSnowball(c: CanvasRenderingContext2D, W: number, H: number): void {
    // Cozy crisp winter courtyard
    c.fillStyle = '#b9dced';
    c.fillRect(0, 0, W, H);

    // Arena boundary snow bank frame
    c.fillStyle = '#537396';
    c.fillRect(16, 36, W - 32, H - 52);
    c.fillStyle = '#d8eef9';
    c.fillRect(
      ARENA_SNOW_LEFT,
      ARENA_SNOW_TOP,
      ARENA_SNOW_RIGHT - ARENA_SNOW_LEFT,
      ARENA_SNOW_BOTTOM - ARENA_SNOW_TOP
    );

    // Subtle snow floor patches + center dividing frost line
    c.fillStyle = '#c5e2f2';
    c.fillRect(255, ARENA_SNOW_TOP + 4, 2, ARENA_SNOW_BOTTOM - ARENA_SNOW_TOP - 8);
    c.fillRect(92, 92, 46, 22);
    c.fillRect(365, 198, 52, 24);

    // Top HUD Bar
    c.fillStyle = '#181a30';
    c.fillRect(0, 0, W, 34);
    c.fillStyle = '#8ce2ff';
    c.font = 'bold 13px monospace';
    c.textAlign = 'left';
    const heartsP1 = '♥'.repeat(this.snowP1.hp) + '♡'.repeat(this.snowP1.maxHp - this.snowP1.hp);
    c.fillText(`P1(你) ${heartsP1}  [${this.snowP1.score}]`, 14, 22);

    c.fillStyle = '#ffd5f4';
    c.textAlign = 'center';
    c.font = 'bold 12px monospace';
    c.fillText('打雪仗', W / 2, 21);

    c.fillStyle = '#dfadff';
    c.font = 'bold 13px monospace';
    c.textAlign = 'right';
    const heartsP2 = '♥'.repeat(this.snowP2.hp) + '♡'.repeat(this.snowP2.maxHp - this.snowP2.hp);
    c.fillText(`[${this.snowP2.score}] ${heartsP2} 女主(P2)`, W - 14, 22);

    // Giant Snowball Pickups on ground
    for (let i = 0; i < this.giantPickups.length; i++) {
      const g = this.giantPickups[i];
      const r = 11 + Math.sin(g.pulse) * 1.4;
      c.fillStyle = 'rgba(72, 180, 255, 0.32)';
      c.beginPath();
      c.arc(g.x, g.y, r + 5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(g.x, g.y, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#6ec8ff';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = '#2d6ea8';
      c.font = 'bold 9px monospace';
      c.textAlign = 'center';
      c.fillText('巨型雪球', g.x, g.y - r - 5);
    }

    // Stacked Snow Walls
    for (let i = 0; i < this.snowWalls.length; i++) {
      const w = this.snowWalls[i];
      c.fillStyle = 'rgba(56, 86, 122, 0.35)';
      c.fillRect(w.x + 2, w.y + 3, w.w, w.h);
      c.fillStyle = w.hp === 3 ? '#ffffff' : w.hp === 2 ? '#dff3ff' : '#badcf0';
      c.fillRect(w.x, w.y, w.w, w.h);
      c.strokeStyle = w.owner === 1 ? '#61c8f5' : '#cf92ff';
      c.lineWidth = 1.5;
      c.strokeRect(w.x, w.y, w.w, w.h);
    }

    // Characters
    this.drawSnowCharacter(c, this.snowP1, '#ffffff', '#3fb4f5', 'P1');
    this.drawSnowCharacter(c, this.snowP2, '#f7ddff', '#b978ff', 'P2');

    // Snowballs
    for (let i = 0; i < this.snowballs.length; i++) {
      const b = this.snowballs[i];
      c.fillStyle = 'rgba(40, 72, 110, 0.28)';
      c.beginPath();
      c.arc(b.x, b.y + 4, b.radius, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = b.giant ? '#5bc6ff' : b.owner === 1 ? '#64beff' : '#d28eff';
      c.lineWidth = b.giant ? 2.5 : 1.4;
      c.stroke();
    }

    // Particles & falling snow
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
    }
    c.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      c.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
    }

    // Footer control hint
    c.fillStyle = '#181a30';
    c.fillRect(0, H - 20, W, 20);
    c.fillStyle = '#cce3ff';
    c.font = '10.5px monospace';
    c.textAlign = 'center';
    c.fillText('WASD移动 · Space扔雪球 · Shift翻滚/雪墙 · 滚轮/[F]菜单', W / 2, H - 6);

    if (this.roundOverTimer > 0) {
      c.fillStyle = 'rgba(18, 16, 36, 0.78)';
      c.fillRect(130, 108, 252, 72);
      c.strokeStyle = '#ff9be0';
      c.lineWidth = 2;
      c.strokeRect(130, 108, 252, 72);
      c.fillStyle = '#ffffff';
      c.font = 'bold 20px monospace';
      c.textAlign = 'center';
      c.fillText(this.roundWinnerText, W / 2, 146);
      c.fillStyle = '#c8c0ef';
      c.font = '12px monospace';
      c.fillText('下一局即将开始...', W / 2, 168);
    }
  }

  private drawSnowCharacter(
    c: CanvasRenderingContext2D,
    pl: SnowPlayer,
    coatCol: string,
    accentCol: string,
    tag: string
  ): void {
    const hurt = pl.hurtFlash > 0 && Math.floor(pl.hurtFlash * 24) % 2 === 0;
    c.fillStyle = 'rgba(35, 62, 92, 0.28)';
    c.beginPath();
    c.ellipse(pl.x, pl.y + 11, 10, 5, 0, 0, Math.PI * 2);
    c.fill();

    const bob = Math.abs(Math.sin(pl.walkPhase)) * 2.5;
    const rollSquash = pl.dashTimer > 0 ? 0.72 : 1.0;

    c.save();
    c.translate(pl.x, pl.y - bob);
    c.scale(1, rollSquash);

    // Coat & Hat
    c.fillStyle = hurt ? '#ff7b93' : coatCol;
    c.fillRect(-8, -4, 16, 14);
    c.fillStyle = accentCol;
    c.fillRect(-7, -11, 14, 8);
    c.fillStyle = '#ffe5d6';
    c.fillRect(-5, -6, 10, 6);

    // Aim direction indicator pip
    c.fillStyle = accentCol;
    c.beginPath();
    c.arc(pl.dirX * 15, pl.dirY * 15, 2.6, 0, Math.PI * 2);
    c.fill();

    // Carrying Giant Snowball overhead!
    if (pl.carryingGiant) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(0, -19, 10, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#6ad4ff';
      c.lineWidth = 2;
      c.stroke();
    }

    c.restore();

    c.fillStyle = '#243a56';
    c.font = 'bold 9px monospace';
    c.textAlign = 'center';
    c.fillText(tag, pl.x, pl.y + 21);
  }

  private renderTank(c: CanvasRenderingContext2D, W: number, H: number): void {
    c.fillStyle = '#1d1f29';
    c.fillRect(0, 0, W, H);

    // Top HUD
    c.fillStyle = '#11121a';
    c.fillRect(0, 0, W, 34);
    c.fillStyle = '#7de2ff';
    c.font = 'bold 13px monospace';
    c.textAlign = 'left';
    c.fillText(`P1: ${this.tankP1Score}`, 18, 22);

    c.fillStyle = '#ffe092';
    c.textAlign = 'center';
    const aliveEn = this.tanks.filter((t) => t.alive && t.kind.startsWith('enemy')).length;
    c.fillText(
      `坦克大战 · WAVE ${this.tankWave} · 敌军 ${this.tankEnemiesRemaining + aliveEn}`,
      W / 2,
      22
    );

    c.fillStyle = '#dfaeff';
    c.textAlign = 'right';
    c.fillText(`女主(P2): ${this.tankP2Score}`, W - 18, 22);

    // Arena floor
    c.fillStyle = '#0c0d12';
    c.fillRect(
      TANK_ORIGIN_X,
      TANK_ORIGIN_Y,
      TANK_COLS * TANK_TILE,
      TANK_ROWS * TANK_TILE
    );
    c.strokeStyle = '#53596e';
    c.lineWidth = 2;
    c.strokeRect(
      TANK_ORIGIN_X - 1,
      TANK_ORIGIN_Y - 1,
      TANK_COLS * TANK_TILE + 2,
      TANK_ROWS * TANK_TILE + 2
    );

    // Base Heart-Eagle at bottom center
    const hqX = TANK_ORIGIN_X + 12 * TANK_TILE;
    const hqY = TANK_ORIGIN_Y + 12 * TANK_TILE;
    c.fillStyle = this.tankBaseAlive ? '#ffcf48' : '#553338';
    c.fillRect(hqX + 2, hqY + 1, 28, 14);
    c.fillStyle = this.tankBaseAlive ? '#ff5588' : '#2a1a1d';
    c.font = 'bold 12px monospace';
    c.textAlign = 'center';
    c.fillText(this.tankBaseAlive ? '★HQ★' : '✖', hqX + 16, hqY + 12);

    // Bricks & Steel
    for (let r = 0; r < TANK_ROWS; r++) {
      for (let col = 0; col < TANK_COLS; col++) {
        const cell = this.tankGrid[r][col];
        if (cell === 1) {
          const x = TANK_ORIGIN_X + col * TANK_TILE;
          const y = TANK_ORIGIN_Y + r * TANK_TILE;
          c.fillStyle = '#bf532c';
          c.fillRect(x, y, TANK_TILE, TANK_TILE);
          c.fillStyle = '#e07246';
          c.fillRect(x + 1, y + 1, 6, 6);
          c.fillRect(x + 9, y + 9, 6, 6);
        } else if (cell === 2) {
          const x = TANK_ORIGIN_X + col * TANK_TILE;
          const y = TANK_ORIGIN_Y + r * TANK_TILE;
          c.fillStyle = '#9aa6bd';
          c.fillRect(x, y, TANK_TILE, TANK_TILE);
          c.fillStyle = '#dce4f5';
          c.fillRect(x + 3, y + 3, 10, 10);
        }
      }
    }

    // Powerups
    for (let i = 0; i < this.tankPowerups.length; i++) {
      const pu = this.tankPowerups[i];
      c.fillStyle =
        pu.kind === 'shield' ? '#63dcff' : pu.kind === 'star' ? '#ffe052' : '#ff6859';
      c.fillRect(pu.x - 6, pu.y - 6, 12, 12);
      c.fillStyle = '#111118';
      c.font = 'bold 9px monospace';
      c.textAlign = 'center';
      c.fillText(pu.kind === 'shield' ? 'S' : pu.kind === 'star' ? '★' : 'B', pu.x, pu.y + 3);
    }

    // Tanks
    for (let i = 0; i < this.tanks.length; i++) {
      const tk = this.tanks[i];
      if (!tk.alive) continue;
      const bodyCol =
        tk.kind === 'p1'
          ? '#64d8ff'
          : tk.kind === 'p2'
            ? '#d19eff'
            : tk.kind === 'enemy_fast'
              ? '#ffae42'
              : tk.kind === 'enemy_heavy'
                ? '#c84b6a'
                : '#f05548';
      const turretCol =
        tk.kind === 'p1' ? '#d4f5ff' : tk.kind === 'p2' ? '#f5e2ff' : '#ffd2c8';

      c.save();
      c.translate(tk.x, tk.y);
      c.rotate(tk.dir * (Math.PI / 2));
      // Treads
      c.fillStyle = '#383d4a';
      c.fillRect(-7, -7, 3, 14);
      c.fillRect(4, -7, 3, 14);
      // Hull
      c.fillStyle = bodyCol;
      c.fillRect(-5, -5, 10, 10);
      // Cannon barrel pointing Up (-Y)
      c.fillStyle = turretCol;
      c.fillRect(-1.5, -10, 3, 8);
      c.restore();

      if (tk.shieldTimer > 0) {
        c.strokeStyle = 'rgba(130, 235, 255, 0.85)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(tk.x, tk.y, 10, 0, Math.PI * 2);
        c.stroke();
      }
    }

    // Bushes rendered on top for classic ambush cover
    for (let r = 0; r < TANK_ROWS; r++) {
      for (let col = 0; col < TANK_COLS; col++) {
        if (this.tankGrid[r][col] === 3) {
          const x = TANK_ORIGIN_X + col * TANK_TILE;
          const y = TANK_ORIGIN_Y + r * TANK_TILE;
          c.fillStyle = 'rgba(46, 152, 68, 0.86)';
          c.fillRect(x, y, TANK_TILE, TANK_TILE);
          c.fillStyle = '#4ad167';
          c.fillRect(x + 2, y + 3, 5, 5);
          c.fillRect(x + 9, y + 8, 5, 5);
        }
      }
    }

    // Bullets & Particles
    c.fillStyle = '#fff5a8';
    for (let i = 0; i < this.tankBullets.length; i++) {
      const b = this.tankBullets[i];
      c.fillRect(b.x - 2, b.y - 2, 4, 4);
    }
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
    }

    // Footer control hint
    c.fillStyle = '#11121a';
    c.fillRect(0, H - 20, W, 20);
    c.fillStyle = '#ffdba8';
    c.font = '10.5px monospace';
    c.textAlign = 'center';
    c.fillText('WASD移动 · Space开炮 · Shift冲刺/护盾 · 保卫★HQ · 滚轮/[F]菜单', W / 2, H - 6);

    if (this.roundOverTimer > 0) {
      c.fillStyle = 'rgba(18, 16, 30, 0.80)';
      c.fillRect(130, 108, 252, 72);
      c.strokeStyle = '#ffbe6b';
      c.lineWidth = 2;
      c.strokeRect(130, 108, 252, 72);
      c.fillStyle = '#ffffff';
      c.font = 'bold 18px monospace';
      c.textAlign = 'center';
      c.fillText(this.roundWinnerText, W / 2, 146);
      c.fillStyle = '#e5d4b3';
      c.font = '12px monospace';
      c.fillText('准备下一局...', W / 2, 168);
    }
  }
}
