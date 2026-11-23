import * as THREE from 'three';
import {
  createTwilightMaterial,
  type OutlineRegistry,
  type TwilightUniforms,
} from '../pipeline';
import type { ToyGunAmmoType } from '../types';

export interface ToyGunRig {
  group: THREE.Group;
  drumGroup: THREE.Group;
  muzzleTip: THREE.Object3D;
  triggerMesh: THREE.Mesh;
  setAmmoType: (ammo: ToyGunAmmoType) => void;
  setTriggerPull: (amount: number) => void;
  spinDrum: (deltaRad: number) => void;
}

export interface CaptureNetRig {
  group: THREE.Group;
  capsuleGroup: THREE.Group;
  netGroup: THREE.Group;
  setDeployProgress: (t: number) => void;
  setOpacity: (alpha: number) => void;
}

export interface PooledDartRig {
  group: THREE.Group;
  trailMesh: THREE.Mesh;
  setOpacity: (alpha: number) => void;
}

export interface SharedProjectileAssets {
  dartCupGeo: THREE.BufferGeometry;
  dartShaftGeo: THREE.BufferGeometry;
  dartFinGeo: THREE.BufferGeometry;
  dartTrailGeo: THREE.BufferGeometry;
  netPodGeo: THREE.BufferGeometry;
  netStrapGeo: THREE.BufferGeometry;
  netDomeGeo: THREE.BufferGeometry;
  netRimGeo: THREE.BufferGeometry;
  netBeadGeo: THREE.BufferGeometry;
  netRibGeos: THREE.BufferGeometry[];
  netTex: THREE.CanvasTexture;
}

export interface PaperAirplaneRig {
  group: THREE.Group;
  planeMesh: THREE.Mesh;
  sparkles: THREE.Points;
  updateFlightFX: (dt: number, elapsed: number) => void;
}

/**
 * Generates a cheerful cartoon sticker decal CanvasTexture for the toy gun receiver sides:
 * playful stars, lightning bolt, pastel polka dots, smiling mascot face & bubbly "POP!" seal.
 */
function createToyGunStickerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base mint-green glossy ABS plastic with gentle gradient
  const bg = ctx.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, '#88ecd0');
  bg.addColorStop(0.55, '#6cdab9');
  bg.addColorStop(1, '#58c9a8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Subtle playful cream-yellow diagonal racing stripe
  ctx.save();
  ctx.fillStyle = '#fff0a8';
  ctx.beginPath();
  ctx.moveTo(0, 152);
  ctx.lineTo(512, 118);
  ctx.lineTo(512, 168);
  ctx.lineTo(0, 202);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ff723c';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();

  // Helper to draw a chunky 5-point cartoon star sticker with white vinyl border
  const drawStarSticker = (cx: number, cy: number, r: number, fill: string, rot = 0) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    const trace = (rad: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 === 0 ? rad : rad * 0.48;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    // White die-cut sticker outline
    trace(r + 6);
    ctx.fillStyle = '#fffdf4';
    ctx.fill();
    // Inner color
    trace(r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#47343c';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Tiny cute kawaii eyes on big star
    if (r >= 26) {
      ctx.fillStyle = '#3d2a34';
      ctx.beginPath();
      ctx.arc(-7, -2, 3.2, 0, Math.PI * 2);
      ctx.arc(7, -2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 4, 4.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.strokeStyle = '#3d2a34';
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
    ctx.restore();
  };

  drawStarSticker(118, 92, 34, '#ffe169', -0.18);
  drawStarSticker(392, 78, 22, '#ff7744', 0.25);
  drawStarSticker(442, 178, 17, '#ffe885', -0.32);

  // Chunky cartoon lightning bolt sticker
  ctx.save();
  ctx.translate(256, 118);
  ctx.rotate(0.08);
  const bolt = (scale: number) => {
    ctx.beginPath();
    ctx.moveTo(-16 * scale, -44 * scale);
    ctx.lineTo(18 * scale, -44 * scale);
    ctx.lineTo(2 * scale, -6 * scale);
    ctx.lineTo(26 * scale, -6 * scale);
    ctx.lineTo(-18 * scale, 48 * scale);
    ctx.lineTo(-4 * scale, 8 * scale);
    ctx.lineTo(-26 * scale, 8 * scale);
    ctx.closePath();
  };
  bolt(1.18);
  ctx.fillStyle = '#fffdf4';
  ctx.fill();
  bolt(1.0);
  ctx.fillStyle = '#ff6a33';
  ctx.fill();
  ctx.strokeStyle = '#47343c';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();

  // Cheerful pastel sticker dots & little bubbles
  const dots: [number, number, number, string][] = [
    [54, 58, 9, '#fffdf4'],
    [176, 52, 7, '#ff7744'],
    [194, 212, 10, '#fffdf4'],
    [328, 198, 8, '#ff7744'],
    [354, 104, 6, '#fffdf4'],
    [68, 214, 7, '#ff7744'],
  ];
  for (const [dx, dy, dr, col] of dots) {
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }

  // Round orange-cream toy badge stamp ("BOING!")
  ctx.save();
  ctx.translate(324, 152);
  ctx.rotate(-0.14);
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.roundRect(-48, -22, 96, 44, 18);
  ctx.fill();
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath();
  ctx.roundRect(-43, -17, 86, 34, 14);
  ctx.fill();
  ctx.fillStyle = '#fff8dc';
  ctx.font = 'bold 21px "Fredoka", "Comic Sans MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('POP!', 0, 1);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates a crisp woven nylon capture-net alpha + color CanvasTexture for the expanding circular net dome.
 */
function createWovenNetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Subtle translucent mint-cream sheen
  ctx.fillStyle = 'rgba(232, 255, 246, 0.14)';
  ctx.fillRect(0, 0, 256, 256);

  // Crisp woven diagonal diamond nylon mesh cords
  ctx.strokeStyle = 'rgba(244, 255, 248, 0.92)';
  ctx.lineWidth = 4.2;
  const step = 32;
  for (let i = -256; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, 256);
    ctx.lineTo(i + 256, 0);
    ctx.stroke();
  }

  // Knot intersections
  ctx.fillStyle = 'rgba(255, 242, 188, 0.95)';
  for (let y = 0; y <= 256; y += step / 2) {
    for (let x = 0; x <= 256; x += step / 2) {
      if (((x + y) / (step / 2)) % 2 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates an organic pale off-white sticky-note texture with fold creases,
 * hand-drawn doodle & little heart on the wing, and subtle shy handwritten inner-fold script.
 */
function createPaperAirplaneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm pale off-white sticky note base (#f8f3e3)
  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#fbf7ea');
  grad.addColorStop(0.55, '#f6efe0');
  grad.addColorStop(1, '#efe5d1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Fine tactile paper grain fibers
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const w = 1 + Math.random() * 5;
    ctx.fillStyle =
      i % 2 === 0 ? 'rgba(176, 154, 126, 0.08)' : 'rgba(255, 255, 250, 0.14)';
    ctx.fillRect(x, y, w, 1);
  }

  // Crisp paper-airplane diagonal crease shading lines
  const drawCrease = (x1: number, y1: number, x2: number, y2: number, alpha = 0.22) => {
    ctx.save();
    ctx.strokeStyle = `rgba(148, 126, 102, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 253, 246, ${alpha * 1.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + 2, y1 + 1);
    ctx.lineTo(x2 + 2, y2 + 1);
    ctx.stroke();
    ctx.restore();
  };

  // Center spine & twin wing folds
  drawCrease(256, 0, 256, 512, 0.28);
  drawCrease(256, 18, 86, 512, 0.22);
  drawCrease(256, 18, 426, 512, 0.22);
  drawCrease(256, 48, 16, 420, 0.12);
  drawCrease(256, 48, 496, 420, 0.12);

  // Hand-drawn doodle on left wing (looping little flight swirl + tiny star + pencil sketch lines)
  ctx.save();
  ctx.strokeStyle = 'rgba(84, 72, 68, 0.62)';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(96, 392);
  ctx.bezierCurveTo(64, 336, 146, 312, 118, 258);
  ctx.bezierCurveTo(100, 224, 152, 206, 142, 174);
  ctx.stroke();
  ctx.setLineDash([]);

  // Hand-drawn tiny sparkle star on left wing
  ctx.translate(148, 154);
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(3, -3);
  ctx.lineTo(14, 0);
  ctx.lineTo(3, 3);
  ctx.lineTo(0, 14);
  ctx.lineTo(-3, 3);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-3, -3);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(98, 80, 74, 0.66)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.restore();

  // Hand-drawn small shy coral-red heart on right wing
  ctx.save();
  ctx.translate(384, 310);
  ctx.rotate(0.24);
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.bezierCurveTo(-22, -2, -26, -22, -10, -24);
  ctx.bezierCurveTo(-2, -25, 0, -16, 0, -13);
  ctx.bezierCurveTo(0, -16, 3, -25, 11, -24);
  ctx.bezierCurveTo(27, -22, 22, -2, 0, 16);
  ctx.closePath();
  ctx.fillStyle = 'rgba(228, 102, 108, 0.34)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(196, 74, 84, 0.80)';
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // Tiny doodle cloud/squiggles next to heart
  ctx.strokeStyle = 'rgba(90, 76, 72, 0.50)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, 34);
  ctx.quadraticCurveTo(-8, 26, 12, 34);
  ctx.quadraticCurveTo(26, 40, 40, 30);
  ctx.stroke();
  ctx.restore();

  // Shy handwritten text naturally blended into the inner fuselage side (subtle pencil/ink)
  ctx.save();
  ctx.translate(230, 368);
  ctx.rotate(-Math.PI / 2 + 0.04);
  ctx.fillStyle = 'rgba(84, 68, 62, 0.44)';
  ctx.font = 'italic 15px "KaiTi", "STKaiti", "Kaiti SC", serif';
  ctx.fillText('我刚刚把你的名字设成了屏幕保护程序。', 0, 0);
  ctx.fillText('你知道我最喜欢什么吗？是你。', 14, 24);
  ctx.fillText('如果你要离开，可以提前告诉我吗？', 24, 48);
  ctx.restore();

  // Subtle uneven aged sticky-note edge shadow
  ctx.strokeStyle = 'rgba(162, 140, 112, 0.28)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 506, 506);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let _cachedStickerTex: THREE.CanvasTexture | null = null;
let _cachedNetTex: THREE.CanvasTexture | null = null;
let _cachedPaperTex: THREE.CanvasTexture | null = null;

function getStickerTexture(): THREE.CanvasTexture {
  if (!_cachedStickerTex) _cachedStickerTex = createToyGunStickerTexture();
  return _cachedStickerTex;
}

function getWovenNetTexture(): THREE.CanvasTexture {
  if (!_cachedNetTex) _cachedNetTex = createWovenNetTexture();
  return _cachedNetTex;
}

function getPaperAirplaneTexture(): THREE.CanvasTexture {
  if (!_cachedPaperTex) _cachedPaperTex = createPaperAirplaneTexture();
  return _cachedPaperTex;
}

/**
 * Builds the comical, oversized children's plastic toy gun:
 * Mint green (#73dfc0), cream yellow (#fff0a8), and tangerine orange-red (#ff6633),
 * with a short stubby barrel, rounded chunky grip, prominent buttons, cartoon stickers,
 * and a transparent revolving drum displaying the currently loaded ammo (suction darts or capture nets).
 * Oriented pointing along -Z (standard Three.js forward for camera-attached viewmodels).
 */
export function buildToyGunMesh(
  uniforms: TwilightUniforms,
  outlines: OutlineRegistry,
  options?: { isViewModel?: boolean }
): ToyGunRig {
  const isViewModel = Boolean(options?.isViewModel);
  const group = new THREE.Group();
  group.name = isViewModel ? 'held_toy_gun' : 'world_toy_gun';
  group.userData.dynamic = true;

  const stickerTex = getStickerTexture();

  const mintMat = createTwilightMaterial(uniforms, {
    color: 0x73dfc0,
    roughness: 0.34,
    metalness: 0.04,
  });
  const mintStickerMat = createTwilightMaterial(uniforms, {
    color: 0xffffff,
    map: stickerTex,
    roughness: 0.32,
    metalness: 0.04,
  });
  const yellowMat = createTwilightMaterial(uniforms, {
    color: 0xfff0a8,
    roughness: 0.36,
    metalness: 0.03,
  });
  const orangeMat = createTwilightMaterial(uniforms, {
    color: 0xff6736,
    roughness: 0.34,
    metalness: 0.04,
  });
  const darkSlotMat = createTwilightMaterial(uniforms, {
    color: 0x3b2c39,
    roughness: 0.65,
    metalness: 0.05,
  });

  // Glossy transparent acrylic cylinder for the ammo drum
  const clearPlasticMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6fff8,
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: 0.34,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    depthWrite: false,
  });

  const addPartOutline = (mesh: THREE.Mesh, thickness = 1.035) => {
    if (!isViewModel) {
      outlines.addOutline(mesh, thickness);
    } else {
      outlines.addOutline(mesh, thickness * 0.99);
    }
  };

  // 1. Main Chunky Bulbous Mint-Green Body (with cartoon sticker decals on left/right faces!)
  const bodyGeo = new THREE.BoxGeometry(0.082, 0.105, 0.215);
  const bodyMats = [
    mintStickerMat, // +X right side (clearly visible in 1st-person viewmodel & sofa!)
    mintStickerMat, // -X left side
    mintMat,
    mintMat,
    mintMat,
    mintMat,
  ];
  const mainBody = new THREE.Mesh(bodyGeo, bodyMats);
  mainBody.position.set(0, 0.036, -0.025);
  mainBody.castShadow = !isViewModel;
  mainBody.receiveShadow = true;
  addPartOutline(mainBody, 1.032);
  group.add(mainBody);

  // Rounded chubby rear cap (cream yellow dome for comical cartoon toy silhouette)
  const rearCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 14),
    yellowMat
  );
  rearCap.scale.set(0.84, 1.02, 0.72);
  rearCap.position.set(0, 0.038, 0.085);
  addPartOutline(rearCap, 1.034);
  group.add(rearCap);

  // Rear pull-priming chunky orange T-ring knob (classic spring-loaded toy blaster!)
  const primeStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.036, 12),
    orangeMat
  );
  primeStem.rotation.x = Math.PI / 2;
  primeStem.position.set(0, 0.044, 0.125);
  group.add(primeStem);

  const primeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.0085, 10, 20),
    orangeMat
  );
  primeRing.position.set(0, 0.044, 0.155);
  addPartOutline(primeRing, 1.045);
  group.add(primeRing);

  // 2. Exaggerated Stubby Oversized Barrel Shroud (Mint + Cream Yellow Stripes + Flared Orange Trumpet Muzzle)
  const barrelBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.052, 0.105, 22),
    mintMat
  );
  barrelBase.rotation.x = Math.PI / 2;
  barrelBase.position.set(0, 0.044, -0.155);
  addPartOutline(barrelBase, 1.032);
  group.add(barrelBase);

  // Cream-yellow chunky collar ring around barrel
  const barrelCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.051, 0.051, 0.024, 22),
    yellowMat
  );
  barrelCollar.rotation.x = Math.PI / 2;
  barrelCollar.position.set(0, 0.044, -0.148);
  group.add(barrelCollar);

  // Flared comical orange-red plastic muzzle trumpet
  const muzzleFlare = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.036, 0.0),
        new THREE.Vector2(0.048, 0.012),
        new THREE.Vector2(0.062, 0.044),
        new THREE.Vector2(0.058, 0.054),
        new THREE.Vector2(0.042, 0.050),
        new THREE.Vector2(0.032, 0.012),
      ],
      24
    ),
    orangeMat
  );
  muzzleFlare.rotation.x = -Math.PI / 2;
  muzzleFlare.position.set(0, 0.044, -0.200);
  addPartOutline(muzzleFlare, 1.036);
  group.add(muzzleFlare);

  // Dark hollow muzzle bore
  const muzzleBore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.030, 0.028, 18),
    darkSlotMat
  );
  muzzleBore.rotation.x = Math.PI / 2;
  muzzleBore.position.set(0, 0.044, -0.228);
  group.add(muzzleBore);

  const muzzleTip = new THREE.Object3D();
  muzzleTip.position.set(0, 0.044, -0.265);
  group.add(muzzleTip);

  // 3. Cute Top Cream-Yellow Cartoon Fin Sight + Orange Bead
  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.046, 0.024, 0.165),
    yellowMat
  );
  topRail.position.set(0, 0.096, -0.040);
  addPartOutline(topRail, 1.036);
  group.add(topRail);

  const frontSightRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.018, 0.0055, 10, 20),
    orangeMat
  );
  frontSightRing.position.set(0, 0.118, -0.175);
  addPartOutline(frontSightRing, 1.045);
  group.add(frontSightRing);

  // 4. Transparent Cylindrical Revolving Ammo Chamber (perched prominently above/side of front receiver!)
  const drumCenterY = 0.048;
  const drumCenterZ = -0.072;
  const drumGroup = new THREE.Group();
  drumGroup.position.set(0, drumCenterY, drumCenterZ);
  group.add(drumGroup);

  // Front & rear cream-yellow drum endcaps
  const capFront = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.056, 0.012, 22),
    yellowMat
  );
  capFront.rotation.x = Math.PI / 2;
  capFront.position.z = -0.046;
  drumGroup.add(capFront);

  const capBack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.056, 0.012, 22),
    yellowMat
  );
  capBack.rotation.x = Math.PI / 2;
  capBack.position.z = 0.046;
  drumGroup.add(capBack);

  // Inner orange spindle
  const drumSpindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.096, 12),
    orangeMat
  );
  drumSpindle.rotation.x = Math.PI / 2;
  drumGroup.add(drumSpindle);

  // Loaded Ammo Visual Group A: 6 mini suction cup darts visible through transparent drum
  const loadedDartsGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rx = Math.cos(a) * 0.033;
    const ry = Math.sin(a) * 0.033;
    const miniShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.062, 10),
      yellowMat
    );
    miniShaft.rotation.x = Math.PI / 2;
    miniShaft.position.set(rx, ry, 0.005);
    loadedDartsGroup.add(miniShaft);

    const miniCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.006, 0.016, 12),
      orangeMat
    );
    miniCup.rotation.x = -Math.PI / 2;
    miniCup.position.set(rx, ry, -0.030);
    loadedDartsGroup.add(miniCup);
  }
  drumGroup.add(loadedDartsGroup);

  // Loaded Ammo Visual Group B: 4 plump folded capture-net capsules (mint/sky pods with orange straps)
  const loadedNetsGroup = new THREE.Group();
  loadedNetsGroup.visible = false;
  const netPodMat = createTwilightMaterial(uniforms, {
    color: 0xaef6e2,
    roughness: 0.48,
    metalness: 0.02,
  });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rx = Math.cos(a) * 0.031;
    const ry = Math.sin(a) * 0.031;
    const pod = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013, 0.038, 6, 10),
      netPodMat
    );
    pod.rotation.x = Math.PI / 2;
    pod.position.set(rx, ry, 0);
    loadedNetsGroup.add(pod);

    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.0135, 0.0032, 6, 14),
      orangeMat
    );
    band.position.set(rx, ry, 0);
    loadedNetsGroup.add(band);
  }
  drumGroup.add(loadedNetsGroup);

  // Transparent outer glossy acrylic drum shell
  const clearDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.058, 0.088, 24),
    clearPlasticMat
  );
  clearDrum.rotation.x = Math.PI / 2;
  drumGroup.add(clearDrum);

  // 5. Rounded Ergonomic Chunky Grip + Trigger Guard + Oversized Orange Trigger
  const gripGroup = new THREE.Group();
  gripGroup.position.set(0, -0.056, 0.036);
  gripGroup.rotation.x = 0.24;

  const gripCore = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.029, 0.082, 10, 16),
    yellowMat
  );
  gripCore.scale.set(0.84, 1.0, 1.15);
  addPartOutline(gripCore, 1.036);
  gripGroup.add(gripCore);

  // Mint rubberized grip side bumper pads
  for (const side of [-1, 1]) {
    const pad = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.017, 0.056, 8, 12),
      mintMat
    );
    pad.scale.set(0.45, 1.0, 1.0);
    pad.position.set(side * 0.022, -0.004, 0.002);
    gripGroup.add(pad);
  }

  // Chunky orange pommel base cap
  const gripPommel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.034, 0.018, 16),
    orangeMat
  );
  gripPommel.scale.set(0.85, 1.0, 1.12);
  gripPommel.position.set(0, -0.068, 0.0);
  addPartOutline(gripPommel, 1.04);
  gripGroup.add(gripPommel);
  group.add(gripGroup);

  // Rounded Trigger Guard loop
  const guardLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.036, 0.0075, 10, 20, Math.PI * 1.15),
    yellowMat
  );
  guardLoop.rotation.y = Math.PI / 2;
  guardLoop.rotation.z = Math.PI * 0.92;
  guardLoop.position.set(0, -0.028, -0.022);
  addPartOutline(guardLoop, 1.04);
  group.add(guardLoop);

  // Oversized chunky tangerine-orange Trigger
  const triggerMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.011, 0.026, 8, 12),
    orangeMat
  );
  triggerMesh.position.set(0, -0.022, -0.012);
  triggerMesh.rotation.x = -0.32;
  addPartOutline(triggerMesh, 1.04);
  group.add(triggerMesh);

  // 6. Prominent Playful Side Plastic Buttons (ammo-mode selector button + decorative chunky round buttons)
  for (const side of [-1, 1]) {
    // Big round orange button
    const bigBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.017, 0.014, 16),
      orangeMat
    );
    bigBtn.rotation.z = Math.PI / 2;
    bigBtn.position.set(side * 0.044, 0.056, 0.032);
    addPartOutline(bigBtn, 1.05);
    group.add(bigBtn);

    // Secondary cream-yellow oval button
    const smallBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.010, 0.011, 0.012, 14),
      yellowMat
    );
    smallBtn.rotation.z = Math.PI / 2;
    smallBtn.position.set(side * 0.044, 0.022, 0.046);
    group.add(smallBtn);

    // Mint decorative side vent nubs
    for (let v = 0; v < 3; v++) {
      const nub = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.022, 0.007),
        yellowMat
      );
      nub.position.set(side * 0.043, 0.048, -0.145 - v * 0.016);
      group.add(nub);
    }
  }

  let currentAmmo: ToyGunAmmoType = 'dart';

  const setAmmoType = (ammo: ToyGunAmmoType) => {
    currentAmmo = ammo;
    loadedDartsGroup.visible = ammo === 'dart';
    loadedNetsGroup.visible = ammo === 'net';
    // Shift big button slightly to reflect mode toggle
    if (ammo === 'net') {
      frontSightRing.scale.set(1.18, 1.18, 1.18);
    } else {
      frontSightRing.scale.set(1.0, 1.0, 1.0);
    }
  };

  const setTriggerPull = (amount: number) => {
    const t = THREE.MathUtils.clamp(amount, 0, 1);
    triggerMesh.position.z = -0.012 + t * 0.014;
    triggerMesh.rotation.x = -0.32 + t * 0.45;
  };

  const spinDrum = (deltaRad: number) => {
    drumGroup.rotation.z += deltaRad;
  };

  setAmmoType(currentAmmo);

  return {
    group,
    drumGroup,
    muzzleTip,
    triggerMesh,
    setAmmoType,
    setTriggerPull,
    spinDrum,
  };
}

/**
 * Pre-builds all shared geometries and textures ONCE at startup so projectile pools
 * cause ZERO runtime geometry allocation or shader compilation hitching when firing.
 */
export function createSharedProjectileAssets(): SharedProjectileAssets {
  // Bold, readable Suction Cup Dart (~1.5x cartoon scale)
  const cupProfile = [
    new THREE.Vector2(0.011, -0.022),
    new THREE.Vector2(0.016, -0.008),
    new THREE.Vector2(0.036, 0.012),
    new THREE.Vector2(0.042, 0.026),
    new THREE.Vector2(0.034, 0.029),
    new THREE.Vector2(0.018, 0.009),
  ];
  const dartCupGeo = new THREE.LatheGeometry(cupProfile, 16);
  dartCupGeo.rotateX(Math.PI / 2);

  const dartShaftGeo = new THREE.CylinderGeometry(0.014, 0.0125, 0.122, 10);
  dartShaftGeo.rotateX(Math.PI / 2);

  const dartFinGeo = new THREE.BoxGeometry(0.0055, 0.038, 0.044);

  // Translucent cartoon air-streak cone trailing behind dart while airborne
  const dartTrailGeo = new THREE.ConeGeometry(0.024, 0.24, 10, 1, true);
  dartTrailGeo.rotateX(-Math.PI / 2);

  // Capture Net geometries (~0.90m diameter woven circular net pouch!)
  const radius = 0.45;
  const netPodGeo = new THREE.CapsuleGeometry(0.036, 0.072, 6, 10);
  netPodGeo.rotateX(Math.PI / 2);
  const netStrapGeo = new THREE.TorusGeometry(0.038, 0.008, 6, 14);

  const netDomeGeo = new THREE.SphereGeometry(
    radius,
    20,
    12,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.56
  );
  netDomeGeo.rotateX(-Math.PI / 2);

  const netRimGeo = new THREE.TorusGeometry(radius * 0.985, 0.015, 8, 28);
  const netBeadGeo = new THREE.SphereGeometry(0.030, 10, 8);

  const netRibGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * radius * 0.98, Math.sin(a) * radius * 0.98, 0.02),
      new THREE.Vector3(Math.cos(a) * radius * 0.62, Math.sin(a) * radius * 0.62, -radius * 0.55),
      new THREE.Vector3(0, 0, -radius * 0.92),
    ]);
    netRibGeos.push(new THREE.TubeGeometry(curve, 8, 0.006, 5, false));
  }

  return {
    dartCupGeo,
    dartShaftGeo,
    dartFinGeo,
    dartTrailGeo,
    netPodGeo,
    netStrapGeo,
    netDomeGeo,
    netRimGeo,
    netBeadGeo,
    netRibGeos,
    netTex: getWovenNetTexture(),
  };
}

/**
 * Builds a zero-stutter poolable Suction Cup Dart using standard MeshLambertMaterial
 * (no custom shader compilation) with smooth fade-out opacity support.
 */
export function createPooledSuctionDart(assets: SharedProjectileAssets): PooledDartRig {
  const group = new THREE.Group();
  group.userData.dynamic = true;
  group.visible = false;

  const cupMat = new THREE.MeshLambertMaterial({
    color: 0xff5a2c,
    emissive: 0x331005,
    transparent: true,
    opacity: 1,
  });
  const shaftMat = new THREE.MeshLambertMaterial({
    color: 0xfff0a4,
    emissive: 0x26200c,
    transparent: true,
    opacity: 1,
  });
  const finMat = new THREE.MeshLambertMaterial({
    color: 0x73dfc0,
    emissive: 0x0d2b22,
    transparent: true,
    opacity: 1,
  });
  const trailMat = new THREE.MeshBasicMaterial({
    color: 0xffe49e,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const cupMesh = new THREE.Mesh(assets.dartCupGeo, cupMat);
  cupMesh.position.z = 0.064;
  group.add(cupMesh);

  const shaft = new THREE.Mesh(assets.dartShaftGeo, shaftMat);
  shaft.position.z = -0.012;
  group.add(shaft);

  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(assets.dartFinGeo, finMat);
    const a = (i * Math.PI) / 2;
    fin.position.set(Math.cos(a) * 0.018, Math.sin(a) * 0.018, -0.056);
    fin.rotation.z = a + Math.PI / 2;
    group.add(fin);
  }

  const trailMesh = new THREE.Mesh(assets.dartTrailGeo, trailMat);
  trailMesh.position.z = -0.17;
  group.add(trailMesh);

  const setOpacity = (alpha: number) => {
    const a = THREE.MathUtils.clamp(alpha, 0, 1);
    cupMat.opacity = a;
    shaftMat.opacity = a;
    finMat.opacity = a;
    cupMat.depthWrite = a > 0.92;
    shaftMat.depthWrite = a > 0.92;
    finMat.depthWrite = a > 0.92;
  };

  return { group, trailMesh, setOpacity };
}

/**
 * Builds a zero-stutter poolable Capture Net projectile (+Z forward) that blooms
 * from a compact pod into a large, unmistakable 0.90m circular woven capture net pouch
 * and smoothly fades out after draping on walls or surfaces.
 */
export function createPooledCaptureNet(assets: SharedProjectileAssets): CaptureNetRig {
  const group = new THREE.Group();
  group.userData.dynamic = true;
  group.visible = false;

  const orangeMat = new THREE.MeshLambertMaterial({
    color: 0xff6b35,
    emissive: 0x331206,
    transparent: true,
    opacity: 1,
  });
  const mintRimMat = new THREE.MeshLambertMaterial({
    color: 0x8ef2d4,
    emissive: 0x163a30,
    transparent: true,
    opacity: 1,
  });
  const netDomeMat = new THREE.MeshBasicMaterial({
    map: assets.netTex,
    color: 0xf4fffb,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ribMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4,
    transparent: true,
    opacity: 0.95,
  });

  // 1. Folded Capsule Shell
  const capsuleGroup = new THREE.Group();
  const pod = new THREE.Mesh(assets.netPodGeo, mintRimMat);
  capsuleGroup.add(pod);
  const strap = new THREE.Mesh(assets.netStrapGeo, orangeMat);
  capsuleGroup.add(strap);
  group.add(capsuleGroup);

  // 2. Expanded Circular Soft Woven Net Pouch (圆形网兜)
  const netGroup = new THREE.Group();
  const radius = 0.45;

  const netDome = new THREE.Mesh(assets.netDomeGeo, netDomeMat);
  netDome.position.z = 0.04;
  netGroup.add(netDome);

  const rimHoop = new THREE.Mesh(assets.netRimGeo, mintRimMat);
  rimHoop.position.z = 0.02;
  netGroup.add(rimHoop);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bead = new THREE.Mesh(assets.netBeadGeo, orangeMat);
    bead.position.set(Math.cos(a) * radius * 0.985, Math.sin(a) * radius * 0.985, 0.02);
    netGroup.add(bead);
  }

  for (let i = 0; i < assets.netRibGeos.length; i++) {
    const rib = new THREE.Mesh(assets.netRibGeos[i], ribMat);
    netGroup.add(rib);
  }

  netGroup.scale.set(0.08, 0.08, 0.08);
  group.add(netGroup);

  const setDeployProgress = (t: number) => {
    const p = THREE.MathUtils.clamp(t, 0, 1);
    const overshoot = p < 1 ? 1 - Math.pow(1 - p, 3) + Math.sin(p * Math.PI) * 0.14 : 1.0;
    const s = Math.max(0.08, overshoot);
    netGroup.scale.set(s, s, 0.65 + 0.35 * s);
    netGroup.visible = p > 0.02;
    const capScale = Math.max(0.001, 1 - p * 2.4);
    capsuleGroup.scale.setScalar(capScale);
    capsuleGroup.visible = p < 0.44;
  };

  const setOpacity = (alpha: number) => {
    const a = THREE.MathUtils.clamp(alpha, 0, 1);
    orangeMat.opacity = a;
    mintRimMat.opacity = a;
    netDomeMat.opacity = a * 0.92;
    ribMat.opacity = a * 0.95;
    orangeMat.depthWrite = a > 0.92;
    mintRimMat.depthWrite = a > 0.92;
  };

  setDeployProgress(0);
  setOpacity(1);

  return { group, capsuleGroup, netGroup, setDeployProgress, setOpacity };
}

/**
 * Builds the custom folded Paper Airplane geometry (oriented flying along +Z)
 * with slightly irregular hand-folded edges, crisp central keel, and delicate off-white sticky-note texture.
 */
function createPaperAirplaneGeometry(): THREE.BufferGeometry {
  // Asymmetric hand-folded vertices (slightly uneven wingtip & crease offsets for authentic handmade charm!)
  const nose = [0.0, 0.004, 0.145];
  const spineRear = [0.0, 0.008, -0.125];
  const keelMid = [0.001, -0.044, -0.020];
  const keelRear = [-0.002, -0.048, -0.118];

  // Inner wing crease shoulders (left & right)
  const leftCreaseRear = [-0.028, 0.012, -0.122];
  const rightCreaseRear = [0.026, 0.011, -0.128];

  // Outer wingtips (intentionally slightly uneven like a casually hand-folded sticky note)
  const leftWingTip = [-0.126, 0.036, -0.106];
  const leftWingMid = [-0.068, 0.022, 0.018];
  const rightWingTip = [0.132, 0.031, -0.114];
  const rightWingMid = [0.072, 0.020, 0.012];

  const positions: number[] = [];
  const uvs: number[] = [];

  const pushTri = (
    a: number[],
    b: number[],
    c: number[],
    ua: [number, number],
    ub: [number, number],
    uc: [number, number]
  ) => {
    positions.push(...a, ...b, ...c);
    uvs.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  };

  // Left inner fuselage wall (keel -> left crease)
  pushTri(nose, keelMid, leftCreaseRear, [0.5, 0.98], [0.5, 0.44], [0.41, 0.06]);
  pushTri(keelMid, keelRear, leftCreaseRear, [0.5, 0.44], [0.5, 0.05], [0.41, 0.06]);

  // Right inner fuselage wall (keel -> right crease)
  pushTri(nose, rightCreaseRear, keelMid, [0.5, 0.98], [0.59, 0.06], [0.5, 0.44]);
  pushTri(keelMid, rightCreaseRear, keelRear, [0.5, 0.44], [0.59, 0.06], [0.5, 0.05]);

  // Left main wing (with hand-drawn doodle)
  pushTri(nose, leftCreaseRear, leftWingMid, [0.5, 0.98], [0.41, 0.06], [0.22, 0.56]);
  pushTri(leftWingMid, leftCreaseRear, leftWingTip, [0.22, 0.56], [0.41, 0.06], [0.04, 0.12]);

  // Right main wing (with tiny coral-red heart)
  pushTri(nose, rightWingMid, rightCreaseRear, [0.5, 0.98], [0.78, 0.56], [0.59, 0.06]);
  pushTri(rightWingMid, rightWingTip, rightCreaseRear, [0.78, 0.56], [0.96, 0.10], [0.59, 0.06]);

  // Tiny center spine crease bridge
  pushTri(nose, spineRear, leftCreaseRear, [0.5, 0.98], [0.5, 0.04], [0.41, 0.06]);
  pushTri(nose, rightCreaseRear, spineRear, [0.5, 0.98], [0.59, 0.06], [0.5, 0.04]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the mysterious, romantic floating Paper Airplane entity that periodically glides
 * across the Living Room and can be caught mid-air with the Toy Gun's Capture Net.
 */
export function createPaperAirplaneRig(
  uniforms: TwilightUniforms,
  outlines: OutlineRegistry
): PaperAirplaneRig {
  const group = new THREE.Group();
  group.name = 'living_paper_airplane';
  group.userData.dynamic = true;

  const paperTex = getPaperAirplaneTexture();
  const paperMat = createTwilightMaterial(uniforms, {
    color: 0xffffff,
    map: paperTex,
    roughness: 0.78,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  // Slight warm self-illumination so it catches the eye softly even in sunset/midnight mood
  paperMat.emissive = new THREE.Color(0xffe9d2);
  paperMat.emissiveIntensity = 0.16;

  const planeGeo = createPaperAirplaneGeometry();
  const planeMesh = new THREE.Mesh(planeGeo, paperMat);
  planeMesh.scale.setScalar(1.38); // ~37cm long so it's graceful, legible, and rewarding to spot & catch
  planeMesh.castShadow = true;
  outlines.addOutline(planeMesh, 1.028);
  group.add(planeMesh);

  // Delicate romantic warm starlight / paper-dust trail sparkles around the airplane
  const sparkleCount = 16;
  const sparklePos = new Float32Array(sparkleCount * 3);
  const sparkleSeeds = new Float32Array(sparkleCount);
  for (let i = 0; i < sparkleCount; i++) {
    sparklePos[i * 3 + 0] = (Math.random() - 0.5) * 0.42;
    sparklePos[i * 3 + 1] = (Math.random() - 0.5) * 0.24;
    sparklePos[i * 3 + 2] = -0.05 - Math.random() * 0.55;
    sparkleSeeds[i] = Math.random() * Math.PI * 2;
  }
  const sparkleGeo = new THREE.BufferGeometry();
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3));
  const sparkleMat = new THREE.PointsMaterial({
    color: 0xffd9b8,
    size: 0.036,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
  group.add(sparkles);

  const updateFlightFX = (_dt: number, elapsed: number) => {
    // Gentle paper wing flutter + subtle thermal pitch bob
    planeMesh.rotation.z = Math.sin(elapsed * 4.8) * 0.065;
    planeMesh.rotation.x = Math.cos(elapsed * 3.1) * 0.04;

    const attr = sparkleGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sparkleCount; i++) {
      const seed = sparkleSeeds[i];
      const phase = (elapsed * 0.9 + seed) % 1.0;
      attr.setXYZ(
        i,
        Math.sin(elapsed * 2.2 + seed * 3.0) * 0.14 * (0.4 + phase),
        Math.cos(elapsed * 2.6 + seed * 2.0) * 0.09 * (0.4 + phase),
        -0.06 - phase * 0.62
      );
    }
    attr.needsUpdate = true;
    sparkleMat.opacity = 0.55 + 0.25 * Math.sin(elapsed * 3.5);
  };

  return { group, planeMesh, sparkles, updateFlightFX };
}

/**
 * Builds the first-person held version of the captured Paper Airplane Note
 * when equipped from the 4x4 backpack.
 */
export function createHeldPaperNoteMesh(
  uniforms: TwilightUniforms,
  outlines: OutlineRegistry
): THREE.Group {
  const holder = new THREE.Group();
  holder.name = 'held_paper_airplane_note';
  holder.userData.dynamic = true;

  const paperTex = getPaperAirplaneTexture();
  const paperMat = createTwilightMaterial(uniforms, {
    color: 0xffffff,
    map: paperTex,
    roughness: 0.80,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  paperMat.emissive = new THREE.Color(0xffe6cc);
  paperMat.emissiveIntensity = 0.10;

  const plane = new THREE.Mesh(createPaperAirplaneGeometry(), paperMat);
  plane.scale.setScalar(0.95);
  // Angle gracefully in the right hand so wing doodle & little heart are clearly visible
  plane.rotation.set(0.28, Math.PI * 0.78, -0.22);
  outlines.addOutline(plane, 1.022);
  holder.add(plane);

  return holder;
}
