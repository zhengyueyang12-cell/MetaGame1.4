import * as THREE from 'three';

interface ActiveCharSprite {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  localOffsetX: number;
  localOffsetY: number;
  revealDelay: number;
  revealed: boolean;
  fadeIn: number;
  phaseOffset: number;
  widthWorld: number;
  heightWorld: number;
}

interface FallingCharSprite {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  vel: THREE.Vector3;
  rotVel: number;
  age: number;
  maxAge: number;
  delay: number;
  initialOpacity: number;
}

interface HeartBubbleParticle {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  baseX: number;
  baseZ: number;
  velY: number;
  driftX: number;
  driftZ: number;
  swayFreq: number;
  swayAmp: number;
  swayPhase: number;
  baseScale: number;
  wobblePhase: number;
  age: number;
  maxAge: number;
}

interface CachedGlyph {
  texture: THREE.CanvasTexture;
  aspect: number;
}

export interface ShowSubtitleOptions {
  /** Spawns cute rising 3D pink-purple heart bubbles around the heroine & subtitle */
  hearts?: boolean;
}

const CHAR_HEIGHT_WORLD = 0.058;
const LINE_HEIGHT_WORLD = 0.074;
const MAX_CHARS_PER_LINE = 12;
const CHAR_REVEAL_INTERVAL = 0.044;
const GRAVITY_ACCEL = -4.2;

const CUTE_SUBTITLE_FONT =
  '700 92px "ZCOOL KuaiLe", "M PLUS Rounded 1c", "Noto Sans SC", "Hiragino Maru Gothic ProN", "PingFang SC", "Microsoft YaHei", sans-serif';

const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _anchorPos = new THREE.Vector3();
const _charPos = new THREE.Vector3();

/**
 * True 3D World-Space Floating Subtitle & Heart-Bubble Renderer (zero boxes / zero panels):
 * - Renders each character as a high-DPI cute pink-purple gradient + deep berry-plum outlined
 *   3D billboard sprite in world space beside the heroine, automatically facing the player
 *   from any walking angle without ever blocking her face.
 * - Types out character-by-character with gentle upward buoyancy.
 * - On affectionate/flirty lines (`hearts: true`), floats glossy pink-lavender heart bubbles
 *   gently rising around the heroine & text.
 * - When dismissed/advanced, detaches every character into a gravity-driven falling body with
 *   organic scatter, tilt rotation, and smooth fade-out.
 */
export class FloatingSubtitleSystem {
  public readonly group: THREE.Group;

  private readonly glyphCache = new Map<string, CachedGlyph>();
  private activeChars: ActiveCharSprite[] = [];
  private fallingChars: FallingCharSprite[] = [];
  private heartBubbles: HeartBubbleParticle[] = [];
  private heartTextures: THREE.CanvasTexture[] = [];

  private activeElapsed = 0;
  private totalDuration = 0;
  private isTyping = false;
  private activeText = '';
  private currentLineCount = 1;
  private heartEmitterRemaining = 0;
  private heartSpawnCooldown = 0;
  private disposed = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Floating3DSubtitleGroup';

    // Refresh cached glyph canvases once cute webfont finishes loading
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (this.disposed) return;
        if (this.activeChars.length === 0 && this.fallingChars.length === 0) {
          this.glyphCache.forEach((g) => g.texture.dispose());
          this.glyphCache.clear();
        }
      });
    }
  }

  public isCurrentlyTyping(): boolean {
    return this.isTyping;
  }

  public hasActiveLine(): boolean {
    return this.activeChars.length > 0;
  }

  public hasVisibleSprites(): boolean {
    return (
      this.activeChars.length > 0 ||
      this.fallingChars.length > 0 ||
      this.heartBubbles.length > 0
    );
  }

  /**
   * Generates glossy translucent pink-purple heart bubble textures (3 subtle hue variants).
   */
  private ensureHeartTextures(): THREE.CanvasTexture[] {
    if (this.heartTextures.length > 0) return this.heartTextures;

    const palettes = [
      {
        rim: 'rgba(255, 206, 240, 0.88)',
        fillTop: '#ff96d1',
        fillMid: '#f278cb',
        fillBot: '#c978ff',
        stroke: 'rgba(92, 24, 108, 0.82)',
        glow: 'rgba(255, 146, 224, 0.72)',
      },
      {
        rim: 'rgba(232, 204, 255, 0.88)',
        fillTop: '#ffb3e1',
        fillMid: '#e688f2',
        fillBot: '#a97cff',
        stroke: 'rgba(78, 22, 104, 0.80)',
        glow: 'rgba(218, 134, 255, 0.72)',
      },
      {
        rim: 'rgba(255, 222, 244, 0.90)',
        fillTop: '#ffa4d6',
        fillMid: '#ff70b8',
        fillBot: '#d678f5',
        stroke: 'rgba(104, 22, 92, 0.80)',
        glow: 'rgba(255, 132, 204, 0.74)',
      },
    ];

    for (const p of palettes) {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, size, size);
        const cx = size * 0.5;
        const cy = size * 0.5;

        // 1. Translucent iridescent soap bubble sphere
        const bubbleGrad = ctx.createRadialGradient(
          cx - 14,
          cy - 16,
          6,
          cx,
          cy,
          52
        );
        bubbleGrad.addColorStop(0.0, 'rgba(255, 245, 252, 0.42)');
        bubbleGrad.addColorStop(0.58, 'rgba(244, 184, 242, 0.16)');
        bubbleGrad.addColorStop(0.84, 'rgba(210, 144, 255, 0.36)');
        bubbleGrad.addColorStop(1.0, 'rgba(255, 198, 238, 0.0)');

        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.fillStyle = bubbleGrad;
        ctx.fill();

        ctx.lineWidth = 2.6;
        ctx.strokeStyle = p.rim;
        ctx.stroke();

        // 2. Plump cute anime heart nestled inside the bubble
        ctx.save();
        ctx.translate(cx, cy + 4);
        ctx.shadowColor = p.glow;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(0, 22);
        ctx.bezierCurveTo(-30, 4, -34, -22, -15, -26);
        ctx.bezierCurveTo(-5, -28, 0, -19, 0, -14);
        ctx.bezierCurveTo(0, -19, 5, -28, 15, -26);
        ctx.bezierCurveTo(34, -22, 30, 4, 0, 22);
        ctx.closePath();

        const heartGrad = ctx.createLinearGradient(0, -28, 0, 22);
        heartGrad.addColorStop(0, p.fillTop);
        heartGrad.addColorStop(0.52, p.fillMid);
        heartGrad.addColorStop(1, p.fillBot);
        ctx.fillStyle = heartGrad;
        ctx.fill();

        ctx.lineWidth = 3.2;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = p.stroke;
        ctx.stroke();

        // Tiny glossy heart specular highlight
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        ctx.beginPath();
        ctx.ellipse(-11, -13, 5.5, 3.2, -0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3. Outer soap bubble curved highlight + sparkle dot
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 3.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, 41, -2.55, -1.85);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(cx + 26, cy + 25, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      this.heartTextures.push(tex);
    }

    return this.heartTextures;
  }

  /**
   * Triggers a gentle burst of rising 3D heart bubbles around the heroine for `durationSec`.
   */
  public emitHeartBubbles(durationSec = 2.6): void {
    this.heartEmitterRemaining = Math.max(this.heartEmitterRemaining, durationSec);
    this.heartSpawnCooldown = Math.min(this.heartSpawnCooldown, 0.05);
  }

  private spawnSingleHeartBubble(headWorldPos: THREE.Vector3, camera: THREE.Camera): void {
    const textures = this.ensureHeartTextures();
    const tex = textures[Math.floor(Math.random() * textures.length)];

    camera.updateMatrixWorld();
    _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    _camForward.setFromMatrixColumn(camera.matrixWorld, 2).normalize();

    const sideSign = Math.random() < 0.62 ? 1 : -1;
    const lateral = sideSign * (0.14 + Math.random() * 0.34);
    const vertical = -0.02 + Math.random() * 0.24;
    const forward = 0.04 + Math.random() * 0.14;

    const startX = headWorldPos.x + _camRight.x * lateral + _camForward.x * forward;
    const startY = headWorldPos.y + vertical;
    const startZ = headWorldPos.z + _camRight.z * lateral + _camForward.z * forward;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(startX, startY, startZ);
    sprite.renderOrder = 26;
    const baseScale = 0.068 + Math.random() * 0.048;
    sprite.scale.set(baseScale * 0.2, baseScale * 0.2, 1);
    this.group.add(sprite);

    this.heartBubbles.push({
      sprite,
      material: mat,
      baseX: startX,
      baseZ: startZ,
      velY: 0.22 + Math.random() * 0.16,
      driftX: (Math.random() - 0.5) * 0.12,
      driftZ: (Math.random() - 0.5) * 0.12,
      swayFreq: 2.2 + Math.random() * 1.4,
      swayAmp: 0.028 + Math.random() * 0.026,
      swayPhase: Math.random() * Math.PI * 2,
      baseScale,
      wobblePhase: Math.random() * Math.PI * 2,
      age: 0,
      maxAge: 1.85 + Math.random() * 0.85,
    });
  }

  /**
   * Wraps Chinese/punctuation text cleanly into 1-3 short airy lines without orphan punctuation.
   */
  private wrapLines(text: string): string[] {
    const clean = text.trim();
    if (!clean) return [];

    const chars = Array.from(clean);
    const lines: string[] = [];
    let buf: string[] = [];
    const noLineStart = new Set([
      '，',
      '。',
      '！',
      '？',
      '、',
      '…',
      '～',
      '—',
      '」',
      '”',
      '.',
      ',',
      '!',
      '?',
    ]);

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch === '\n') {
        if (buf.length > 0) {
          lines.push(buf.join(''));
          buf = [];
        }
        continue;
      }
      buf.push(ch);

      const next = chars[i + 1];
      const isNaturalBreak =
        (ch === '，' ||
          ch === '。' ||
          ch === '！' ||
          ch === '？' ||
          ch === '…' ||
          ch === '—' ||
          ch === '～') &&
        buf.length >= 6;
      const reachedMax = buf.length >= MAX_CHARS_PER_LINE && (!next || !noLineStart.has(next));

      if (isNaturalBreak || reachedMax) {
        lines.push(buf.join(''));
        buf = [];
      }
    }
    if (buf.length > 0) {
      lines.push(buf.join(''));
    }
    return lines;
  }

  private getOrCreateGlyph(char: string): CachedGlyph {
    const existing = this.glyphCache.get(char);
    if (existing) return existing;

    const canvas = document.createElement('canvas');
    const size = 168;
    const isNarrow = /[a-zA-Z0-9.,!?:;'"]/i.test(char) || char === ' ';
    const width = isNarrow ? 112 : size;
    canvas.width = width;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, width, size);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = CUTE_SUBTITLE_FONT;

      const cx = width * 0.5;
      const cy = size * 0.53;

      // 1. Dreamy pastel pink-purple outer glow halo
      ctx.save();
      ctx.shadowColor = 'rgba(218, 126, 255, 0.78)';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(72, 22, 92, 0.94)';
      ctx.strokeText(char, cx, cy);
      ctx.restore();

      // 2. Crisp deep berry-plum cartoon outline for readability in daylight & midnight
      ctx.save();
      ctx.shadowColor = 'rgba(42, 10, 58, 0.90)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;
      ctx.lineWidth = 10.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#47155e';
      ctx.strokeText(char, cx, cy);
      ctx.restore();

      // 3. Cute vertical pink-to-lavender pastel gradient fill
      const fillGrad = ctx.createLinearGradient(0, cy - 46, 0, cy + 48);
      fillGrad.addColorStop(0.0, '#fff5fc');
      fillGrad.addColorStop(0.46, '#ffc8ee');
      fillGrad.addColorStop(1.0, '#d8a6ff');
      ctx.fillStyle = fillGrad;
      ctx.fillText(char, cx, cy);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    const glyph: CachedGlyph = {
      texture,
      aspect: width / size,
    };
    this.glyphCache.set(char, glyph);
    return glyph;
  }

  /**
   * Immediately reveals all remaining characters in the active line (e.g., when clicking mid-typing).
   */
  public completeTypingNow(): void {
    if (!this.isTyping) return;
    this.activeElapsed = this.totalDuration + 0.5;
    this.isTyping = false;
    for (let i = 0; i < this.activeChars.length; i++) {
      const ch = this.activeChars[i];
      ch.revealed = true;
      ch.fadeIn = 1;
      ch.material.opacity = 1;
    }
  }

  /**
   * Releases the current active floating subtitle into 3D gravity-drop falling sprites
   * with organic scatter, gentle tumble rotation, and gradual fade-out.
   */
  public dropCurrentLine(): void {
    if (this.activeChars.length === 0) return;

    const count = this.activeChars.length;
    for (let i = 0; i < count; i++) {
      const item = this.activeChars[i];
      if (!item.revealed && item.fadeIn <= 0.02) {
        this.group.remove(item.sprite);
        item.material.dispose();
        continue;
      }

      // Slight left-to-right staggered cascade as characters lose buoyancy
      const stagger = (i / Math.max(1, count)) * 0.14 + Math.random() * 0.05;
      const spreadX = (Math.random() - 0.5) * 0.42;
      const spreadZ = (Math.random() - 0.5) * 0.34;
      const liftY = 0.12 + Math.random() * 0.24;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (1.1 + Math.random() * 2.2);

      this.fallingChars.push({
        sprite: item.sprite,
        material: item.material,
        vel: new THREE.Vector3(spreadX, liftY, spreadZ),
        rotVel: spin,
        age: 0,
        maxAge: 1.05 + Math.random() * 0.35,
        delay: stagger,
        initialOpacity: Math.max(0.25, item.material.opacity),
      });
    }

    this.activeChars = [];
    this.isTyping = false;
    this.activeText = '';
    this.activeElapsed = 0;
    this.totalDuration = 0;
  }

  /**
   * Displays a new 3D floating subtitle line; any previous active line gracefully drops under gravity.
   */
  public showLine(text: string, options?: ShowSubtitleOptions): void {
    if (this.activeChars.length > 0) {
      this.dropCurrentLine();
    }

    const lines = this.wrapLines(text);
    this.activeText = text;
    this.currentLineCount = Math.max(1, lines.length);
    this.activeElapsed = 0;

    if (options?.hearts) {
      this.emitHeartBubbles(3.2);
    }

    if (lines.length === 0) {
      this.isTyping = false;
      this.totalDuration = 0;
      return;
    }

    let charIndex = 0;
    for (let row = 0; row < lines.length; row++) {
      const rowChars = Array.from(lines[row]);
      let cursorX = 0;
      const offsetY = -row * LINE_HEIGHT_WORLD;

      for (let col = 0; col < rowChars.length; col++) {
        const ch = rowChars[col];
        const glyph = this.getOrCreateGlyph(ch);
        const charWidth = CHAR_HEIGHT_WORLD * glyph.aspect;
        const advance = charWidth * (ch === ' ' ? 0.55 : 0.78);

        if (ch !== ' ') {
          const material = new THREE.SpriteMaterial({
            map: glyph.texture,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          });
          const sprite = new THREE.Sprite(material);
          sprite.renderOrder = 25;
          sprite.scale.set(charWidth, CHAR_HEIGHT_WORLD, 1);
          this.group.add(sprite);

          this.activeChars.push({
            sprite,
            material,
            localOffsetX: cursorX + charWidth * 0.5,
            localOffsetY: offsetY,
            revealDelay: charIndex * CHAR_REVEAL_INTERVAL,
            revealed: false,
            fadeIn: 0,
            phaseOffset: charIndex * 0.42,
            widthWorld: charWidth,
            heightWorld: CHAR_HEIGHT_WORLD,
          });
        }

        cursorX += advance;
        charIndex += 1;
      }
    }

    this.totalDuration = Math.max(0.25, charIndex * CHAR_REVEAL_INTERVAL + 0.16);
    this.isTyping = true;
  }

  /**
   * Computes a clean 3D anchor beside the heroine's head/shoulder (to the right of her face from
   * the player camera's live perspective) so subtitles automatically orient toward the player
   * even as they walk freely around her.
   */
  public computeSideAnchor(
    headWorldPos: THREE.Vector3,
    camera: THREE.Camera,
    out: THREE.Vector3
  ): THREE.Vector3 {
    camera.updateMatrixWorld();
    _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    _camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    _camForward.setFromMatrixColumn(camera.matrixWorld, 2).normalize();

    // Offset to the right of her face (+0.29m) and slightly forward toward camera (+0.08m)
    const verticalLift = 0.06 + (this.currentLineCount - 1) * 0.032;
    out
      .copy(headWorldPos)
      .addScaledVector(_camRight, 0.29)
      .addScaledVector(_camUp, verticalLift)
      .addScaledVector(_camForward, 0.08);
    return out;
  }

  /**
   * Returns the vertical world-space offset below `computeSideAnchor` where the continue prompt
   * should sit so it never overlaps wrapped 2-, 3-, or 4-line subtitles.
   */
  public getSubtitleBottomOffset(): number {
    const lines = Math.max(1, this.currentLineCount);
    return -(lines * LINE_HEIGHT_WORLD + 0.055);
  }

  public update(
    dt: number,
    elapsed: number,
    headWorldPos: THREE.Vector3,
    camera: THREE.Camera
  ): void {
    const safeDt = Math.min(dt, 0.05);

    // 1. Update active floating characters anchored in 3D world space beside heroine
    if (this.activeChars.length > 0) {
      this.activeElapsed += safeDt;
      this.computeSideAnchor(headWorldPos, camera, _anchorPos);

      let allRevealed = true;
      for (let i = 0; i < this.activeChars.length; i++) {
        const item = this.activeChars[i];
        if (this.activeElapsed >= item.revealDelay) {
          item.revealed = true;
          item.fadeIn = Math.min(1, item.fadeIn + safeDt * 7.5);
        } else {
          allRevealed = false;
        }

        const ease = 1 - Math.pow(1 - item.fadeIn, 3);
        const riseOffset = (1 - ease) * -0.028;
        const gentleBob =
          Math.sin(elapsed * 2.15 + item.phaseOffset) * 0.0048 * ease;

        _charPos
          .copy(_anchorPos)
          .addScaledVector(_camRight, item.localOffsetX)
          .addScaledVector(_camUp, item.localOffsetY + riseOffset + gentleBob);

        item.sprite.position.copy(_charPos);
        const scalePop = 0.84 + 0.16 * ease;
        item.sprite.scale.set(
          item.widthWorld * scalePop,
          item.heightWorld * scalePop,
          1
        );
        item.material.opacity = ease;
      }

      if (allRevealed && this.activeElapsed >= this.totalDuration) {
        this.isTyping = false;
      }
    }

    // 2. Simulate gravity-drop falling characters
    if (this.fallingChars.length > 0) {
      for (let i = this.fallingChars.length - 1; i >= 0; i--) {
        const f = this.fallingChars[i];
        if (f.delay > 0) {
          f.delay -= safeDt;
          continue;
        }

        f.age += safeDt;
        if (f.age >= f.maxAge) {
          this.group.remove(f.sprite);
          f.material.dispose();
          this.fallingChars.splice(i, 1);
          continue;
        }

        f.vel.y += GRAVITY_ACCEL * safeDt;
        const drag = Math.max(0, 1 - 1.4 * safeDt);
        f.vel.x *= drag;
        f.vel.z *= drag;

        f.sprite.position.addScaledVector(f.vel, safeDt);
        if (f.sprite.position.y < 0.03) {
          f.sprite.position.y = 0.03;
          f.vel.y *= -0.18;
          f.vel.x *= 0.6;
          f.vel.z *= 0.6;
        }

        f.material.rotation += f.rotVel * safeDt;
        const lifeT = f.age / f.maxAge;
        const fade = lifeT < 0.25 ? 1 : 1 - (lifeT - 0.25) / 0.75;
        f.material.opacity = Math.max(0, f.initialOpacity * fade * fade);
      }
    }

    // 3. Emit & animate rising 3D pink-purple heart bubbles on affectionate lines
    if (this.heartEmitterRemaining > 0) {
      this.heartEmitterRemaining = Math.max(0, this.heartEmitterRemaining - safeDt);
      this.heartSpawnCooldown -= safeDt;
      if (this.heartSpawnCooldown <= 0 && this.heartBubbles.length < 18) {
        this.spawnSingleHeartBubble(headWorldPos, camera);
        this.heartSpawnCooldown = 0.28 + Math.random() * 0.24;
      }
    }

    if (this.heartBubbles.length > 0) {
      for (let i = this.heartBubbles.length - 1; i >= 0; i--) {
        const b = this.heartBubbles[i];
        b.age += safeDt;
        if (b.age >= b.maxAge) {
          this.group.remove(b.sprite);
          b.material.dispose();
          this.heartBubbles.splice(i, 1);
          continue;
        }

        const lifeT = b.age / b.maxAge;
        b.baseX += b.driftX * safeDt;
        b.baseZ += b.driftZ * safeDt;
        const sway = Math.sin(b.age * b.swayFreq + b.swayPhase) * b.swayAmp;

        b.sprite.position.x = b.baseX + sway;
        b.sprite.position.y += b.velY * safeDt;
        b.sprite.position.z = b.baseZ + Math.cos(b.age * b.swayFreq * 0.8 + b.swayPhase) * b.swayAmp * 0.65;

        // Soft pop-in scale + gentle soap-bubble pulse
        const popT = Math.min(1, b.age / 0.26);
        const popEase = 1 - Math.pow(1 - popT, 3);
        const pulse = 1 + Math.sin(b.age * 4.5 + b.wobblePhase) * 0.07;
        const s = b.baseScale * (0.35 + 0.65 * popEase) * pulse;
        b.sprite.scale.set(s, s, 1);
        b.material.rotation = Math.sin(b.age * 2.6 + b.wobblePhase) * 0.24;

        const fadeIn = Math.min(1, b.age / 0.22);
        const fadeOut = lifeT < 0.58 ? 1 : 1 - (lifeT - 0.58) / 0.42;
        b.material.opacity = Math.max(0, fadeIn * fadeOut * fadeOut * 0.94);
      }
    }
  }

  public clearImmediate(): void {
    for (let i = 0; i < this.activeChars.length; i++) {
      this.group.remove(this.activeChars[i].sprite);
      this.activeChars[i].material.dispose();
    }
    this.activeChars = [];

    for (let i = 0; i < this.fallingChars.length; i++) {
      this.group.remove(this.fallingChars[i].sprite);
      this.fallingChars[i].material.dispose();
    }
    this.fallingChars = [];

    for (let i = 0; i < this.heartBubbles.length; i++) {
      this.group.remove(this.heartBubbles[i].sprite);
      this.heartBubbles[i].material.dispose();
    }
    this.heartBubbles = [];
    this.heartEmitterRemaining = 0;
    this.heartSpawnCooldown = 0;

    this.isTyping = false;
    this.activeText = '';
    this.activeElapsed = 0;
  }

  public getActiveText(): string {
    return this.activeText;
  }

  public dispose(): void {
    this.disposed = true;
    this.clearImmediate();
    this.glyphCache.forEach((glyph) => glyph.texture.dispose());
    this.glyphCache.clear();
    for (let i = 0; i < this.heartTextures.length; i++) {
      this.heartTextures[i].dispose();
    }
    this.heartTextures = [];
  }
}
