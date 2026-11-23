import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import type { TwilightUniforms } from './pipeline';
import type { RoomBuildContext } from './rooms/roomContext';
import type { AtmosphereMode, RoomId } from './types';

/**
 * World-space XZ bounds covered by the apartment-wide baked GI lightmap.
 * Covers all main-floor rooms including Bathroom: X in [-8.35, +7.70], Z in [-14.40, +7.05].
 */
export const GI_MIN_X = -8.35;
export const GI_MAX_X = 7.70;
export const GI_MIN_Z = -14.40;
export const GI_MAX_Z = 7.05;
export const GI_WIDTH = GI_MAX_X - GI_MIN_X; // 16.05m
export const GI_DEPTH = GI_MAX_Z - GI_MIN_Z; // 21.45m

export interface BakedLightmapRig {
  giTexture: THREE.CanvasTexture;
  contactTextures: THREE.CanvasTexture[];
  contactMaterials: THREE.MeshBasicMaterial[];
  setAtmosphere: (mode: AtmosphereMode) => void;
  dispose: () => void;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-5, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Signed distance in XZ to an axis-aligned rectangle centered at (cx, cz) with half-extents (hx, hz). */
function sdBox2D(x: number, z: number, cx: number, cz: number, hx: number, hz: number): number {
  const dx = Math.abs(x - cx) - hx;
  const dz = Math.abs(z - cz) - hz;
  if (dx > 0) {
    return dz > 0 ? Math.sqrt(dx * dx + dz * dz) : dx;
  }
  return dz > 0 ? dz : dx > dz ? dx : dz;
}

/** Smooth Gaussian elliptical bounce contribution. */
function gaussElliptical(
  x: number,
  z: number,
  cx: number,
  cz: number,
  rx: number,
  rz: number
): number {
  const nx = (x - cx) / rx;
  const nz = (z - cz) / rz;
  return Math.exp(-(nx * nx + nz * nz));
}

/**
 * Bakes a 512x512 world-space indoor Global Illumination + Ambient Occlusion lightmap:
 * - R channel: multi-bounce room indirect radiance (windows, pendant/ceiling bounce, corridor spill)
 * - G channel: warm-vs-cool indirect bounce color temperature balance
 * - B channel: structural wall-baseboard, corner pilaster, and furniture-perimeter contact AO
 */
export function createApartmentBakedLightmap(
  renderer: THREE.WebGLRenderer
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx2d = canvas.getContext('2d')!;
  const imgData = ctx2d.createImageData(size, size);
  const data = imgData.data;

  // Wall segments for floor-perimeter & corner Ambient Occlusion (cx, cz, hx, hz)
  const wallAoBoxes: [number, number, number, number][] = [
    // Perimeter walls
    [3.07, -10.40, 4.37, 0.11], // Living North
    [-1.22, -8.57, 0.10, 1.74], // Living NW Alcove
    [-4.61, -6.74, 3.40, 0.11], // Bedroom North
    [-8.00, 0.0, 0.11, 6.75], // West exterior
    [-5.35, 6.74, 2.65, 0.11], // Entryway South
    [2.325, 6.74, 5.025, 0.11], // Dining/Kitchen South
    [7.35, -1.83, 0.11, 8.58], // East exterior
    // Interior partitions (cleanly gapped at doorways!)
    [-1.22, -5.49, 0.10, 1.34], // Bed/Liv North
    [-1.22, -1.36, 0.10, 1.69], // Bed/Liv South (door at Z = -4.15..-3.05)
    [-4.615, 0.25, 3.475, 0.10], // Bed/Stairwell
    [-5.355, 2.45, 2.735, 0.10], // Entryway/Stairwell
    [-2.70, 0.475, 0.10, 0.305], // Basement North jamb
    [-2.70, 2.225, 0.10, 0.305], // Basement South jamb
    [0.14, 0.25, 1.44, 0.10], // Liv/Din West (door at X = 1.58..2.73)
    [5.085, 0.25, 2.355, 0.10], // Liv/Kit East
    [-2.70, 2.66, 0.10, 0.29], // Entry/Din North pilaster
    [-2.70, 6.29, 0.10, 0.54], // Entry/Din South pilaster
    [3.18, 5.28, 0.11, 1.46], // Kitchen breakfast bar knee-wall
    // Bathroom perimeter walls (X = 2.95 .. 7.35, Z = -14.15 .. -10.40)
    [5.15, -14.15, 2.24, 0.11], // Bathroom North
    [2.95, -12.28, 0.11, 1.88], // Bathroom West
    [7.35, -12.28, 0.11, 1.88], // Bathroom East
  ];

  // Furniture under-foot AO pads (cx, cz, hx, hz, strength, featherMeters)
  const furnitureAoPads: [number, number, number, number, number, number][] = [
    // Dining Room (餐厅) — strong grounded contact AO around table, chairs, sideboard, barstools
    [0.32, 4.25, 0.80, 0.52, 0.34, 0.36],
    [-0.14, 3.51, 0.22, 0.22, 0.26, 0.24],
    [0.78, 3.51, 0.22, 0.22, 0.26, 0.24],
    [-0.14, 4.99, 0.22, 0.22, 0.26, 0.24],
    [0.78, 4.99, 0.22, 0.22, 0.26, 0.24],
    [0.32, 6.38, 0.88, 0.24, 0.38, 0.30],
    [-1.05, 6.36, 0.30, 0.20, 0.32, 0.24],
    [2.74, 4.55, 0.19, 0.19, 0.24, 0.22],
    [2.74, 5.75, 0.19, 0.19, 0.24, 0.22],
    // Kitchen (厨房) — toe-kick, relocated entrance fridge, adapted glass dish hutch & trash bin contact AO
    [6.90, 5.09, 0.38, 1.56, 0.42, 0.32],
    [5.20, 6.28, 1.72, 0.38, 0.42, 0.32],
    [3.86, 0.76, 0.44, 0.38, 0.44, 0.30],
    [6.84, 2.58, 0.32, 0.68, 0.42, 0.28],
    [3.52, 3.68, 0.16, 0.18, 0.32, 0.24],
    // Entryway & Corridor (走廊 / 玄关)
    [-5.15, 2.80, 0.78, 0.24, 0.36, 0.28],
    [-7.28, 6.12, 0.24, 0.24, 0.26, 0.24],
    [-5.88, 4.60, 0.08, 2.12, 0.24, 0.26],
    // Living Room (客厅)
    [2.38, -5.25, 0.58, 1.84, 0.38, 0.36],
    [3.27, -4.04, 0.42, 0.60, 0.34, 0.30],
    [4.62, -5.25, 0.48, 0.85, 0.30, 0.32],
    [6.76, -5.08, 0.32, 1.20, 0.40, 0.32],
    [-0.96, -1.22, 0.18, 0.52, 0.34, 0.26],
    [-0.95, -1.90, 0.20, 0.20, 0.30, 0.22],
    [-0.92, -2.52, 0.22, 0.44, 0.36, 0.28],
    [2.34, -7.52, 0.26, 0.28, 0.32, 0.26],
    [1.15, -9.12, 0.46, 0.44, 0.38, 0.30],
    [0.18, -9.48, 0.20, 0.20, 0.28, 0.22],
    [6.72, -2.55, 0.24, 0.26, 0.28, 0.26],
    [6.52, -9.62, 0.24, 0.24, 0.34, 0.28],
    [6.78, -0.68, 0.30, 0.30, 0.42, 0.32], // Living Room SE corner standing book rack
    [-0.82, -9.82, 0.28, 0.28, 0.40, 0.30], // Living Room NW corner book stand
    // Bedroom (卧室) — enlarged Bed (South), Nightstand (North), Wardrobe, enlarged PC Desk & Chair
    [-6.54, -4.05, 1.28, 1.02, 0.44, 0.38],
    [-7.55, -5.85, 0.32, 0.34, 0.36, 0.28],
    [-7.54, -1.00, 0.36, 0.72, 0.46, 0.34],
    [-2.52, -6.12, 0.96, 0.46, 0.36, 0.32],
    [-2.60, -5.38, 0.30, 0.30, 0.28, 0.26],
    [-4.65, -0.04, 0.44, 0.15, 0.36, 0.28],
    // Bathroom (浴室) — Vanity, Hamper, Shower, Toilet, Towel Rack, Washer
    [3.42, -11.90, 0.34, 0.58, 0.44, 0.30],
    [3.42, -10.88, 0.28, 0.30, 0.40, 0.26],
    [3.68, -13.42, 0.62, 0.62, 0.38, 0.30],
    [6.86, -13.48, 0.38, 0.28, 0.42, 0.28],
    [6.92, -12.32, 0.24, 0.36, 0.38, 0.26],
    [6.88, -11.12, 0.34, 0.34, 0.44, 0.28],
  ];

  // Structural corner / pilaster pockets (cx, cz, radius, strength) — balanced midpoint depth
  const cornerNodes: [number, number, number, number][] = [
    [-2.70, 0.25, 0.78, 0.42],
    [-2.70, 2.45, 0.78, 0.42],
    [-1.22, 0.25, 0.78, 0.42],
    [-1.22, -6.74, 0.75, 0.40],
    [3.18, 0.39, 0.71, 0.40],
    [3.18, 3.82, 0.71, 0.40],
    [3.18, 6.65, 0.75, 0.42],
    [7.26, 6.65, 0.84, 0.44],
    [7.26, 0.25, 0.81, 0.42],
    [-7.91, 6.65, 0.84, 0.42],
    [-7.91, 2.45, 0.78, 0.40],
    [-7.91, 0.25, 0.78, 0.40],
    [-7.91, -6.65, 0.84, 0.42],
    [-2.70, 6.65, 0.77, 0.40],
    [7.26, -10.31, 0.84, 0.44],
    [-1.14, -10.31, 0.84, 0.44],
    // Bathroom corners
    [3.04, -10.48, 0.72, 0.40],
    [7.26, -10.48, 0.72, 0.40],
    [3.04, -14.06, 0.76, 0.42],
    [7.26, -14.06, 0.76, 0.42],
  ];

  for (let py = 0; py < size; py++) {
    const wz = GI_MIN_Z + ((py + 0.5) / size) * GI_DEPTH;
    for (let px = 0; px < size; px++) {
      const wx = GI_MIN_X + ((px + 0.5) / size) * GI_WIDTH;

      // 1. Multi-bounce indirect GI luminance (harmonized room-to-room base luminance 0.56..0.95)
      let giLum = 0.56;
      let warmFactor = 0.46;

      // Living Room: Strong East window sunlight bounce off oak floor + rug
      const inLiving = smoothstep(-1.38, -0.95, wx) * (1 - smoothstep(0.08, 0.42, wz));
      if (inLiving > 0.001) {
        const win1 = gaussElliptical(wx, wz, 4.65, -7.20, 3.35, 1.75);
        const win2 = gaussElliptical(wx, wz, 4.65, -2.96, 3.35, 1.75);
        const ceilLiv = gaussElliptical(wx, wz, 3.12, -5.08, 3.55, 3.30);
        const alcoveFill = gaussElliptical(wx, wz, 2.70, -8.80, 3.15, 1.85);
        const livBounce = Math.max(win1, win2) * 0.40 + ceilLiv * 0.14 + alcoveFill * 0.08;
        giLum += livBounce * inLiving;
        warmFactor += (Math.max(win1, win2) * 0.52 + ceilLiv * 0.18) * inLiving;
      }

      // Dining Room & Corridor (餐厅 & 走廊): South window sunlight patch + Pendant bounce + doorway light spill
      const inDining =
        smoothstep(-2.88, -2.45, wx) *
        (1 - smoothstep(3.05, 3.45, wx)) *
        smoothstep(0.08, 0.42, wz);
      if (inDining > 0.001) {
        const dinSouthWin = gaussElliptical(wx, wz, -1.45, 5.25, 1.95, 2.10);
        const pendantPool = gaussElliptical(wx, wz, 0.32, 4.25, 2.45, 2.25);
        const livDoorSpill = gaussElliptical(wx, wz, 2.15, 0.65, 1.40, 1.40);
        const archSpill = gaussElliptical(wx, wz, -2.35, 4.35, 1.50, 1.65);
        const corridorFill = gaussElliptical(wx, wz, 0.25, 1.55, 2.65, 1.15);
        giLum += (dinSouthWin * 0.34 + pendantPool * 0.28 + livDoorSpill * 0.16 + archSpill * 0.11 + corridorFill * 0.10) * inDining;
        warmFactor += (dinSouthWin * 0.48 + pendantPool * 0.45 + livDoorSpill * 0.22) * inDining;
      }

      // Kitchen (厨房): East window sunlight bounce + Ceramic tile indirect bounce + drum ceiling fill
      const inKitchen = smoothstep(2.98, 3.40, wx) * smoothstep(0.08, 0.42, wz);
      if (inKitchen > 0.001) {
        const kitEastWin = gaussElliptical(wx, wz, 6.10, 4.95, 1.85, 1.95);
        const kitCeiling = gaussElliptical(wx, wz, 5.25, 3.60, 2.25, 2.50);
        const counterBounce = gaussElliptical(wx, wz, 5.20, 4.40, 2.00, 2.00);
        giLum += (kitEastWin * 0.32 + kitCeiling * 0.26 + counterBounce * 0.14) * inKitchen;
        warmFactor += (kitEastWin * 0.44 + kitCeiling * 0.16) * inKitchen;
      }

      // Entryway (玄关): Lantern glow + slightly moody Genkan depth
      const inEntry = (1 - smoothstep(-2.88, -2.45, wx)) * smoothstep(2.28, 2.62, wz);
      if (inEntry > 0.001) {
        const lantern = gaussElliptical(wx, wz, -5.10, 4.60, 2.15, 1.90);
        const genkanDeep = 1 - smoothstep(-7.65, -5.70, wx);
        giLum += (lantern * 0.22 - genkanDeep * 0.10) * inEntry;
        warmFactor += lantern * 0.32 * inEntry;
      }

      // Bedroom (卧室): North sliding window diffuse sky bounce + bedside lamp pool (swapped North)
      const inBed = (1 - smoothstep(-1.38, -1.05, wx)) * (1 - smoothstep(0.08, 0.42, wz));
      if (inBed > 0.001) {
        const bedWin = gaussElliptical(wx, wz, -4.65, -6.15, 2.00, 2.65);
        const bedLamp = gaussElliptical(wx, wz, -7.45, -5.85, 1.60, 1.60);
        const bedCeil = gaussElliptical(wx, wz, -4.40, -3.35, 2.65, 2.55);
        giLum += (bedWin * 0.22 + bedLamp * 0.16 + bedCeil * 0.12) * inBed;
        warmFactor += (bedLamp * 0.42 - bedWin * 0.14) * inBed;
      }

      // Bathroom (浴室): Soft ceiling dome + vanity mirror bounce with tiled corner depth
      const inBath = smoothstep(2.80, 3.15, wx) * (1 - smoothstep(-10.55, -10.22, wz));
      if (inBath > 0.001) {
        const bathCeil = gaussElliptical(wx, wz, 5.15, -12.25, 1.95, 1.75);
        const vanityBounce = gaussElliptical(wx, wz, 3.70, -11.90, 1.15, 1.25);
        giLum += (bathCeil * 0.26 + vanityBounce * 0.14) * inBath;
        warmFactor += (bathCeil * 0.20 + vanityBounce * 0.26) * inBath;
      }

      // 2. Ambient Occlusion & Soft Perimeter Contact Shadows (B channel)
      let ao = 1.0;

      // Wall-floor baseboard AO (balanced midpoint between light and deep grounding)
      let minWallDist = 0.72;
      for (let i = 0; i < wallAoBoxes.length; i++) {
        const wBox = wallAoBoxes[i];
        const dx = Math.abs(wx - wBox[0]) - wBox[2];
        if (dx >= minWallDist) continue;
        const dz = Math.abs(wz - wBox[1]) - wBox[3];
        if (dz >= minWallDist) continue;
        const d = dx > 0 ? (dz > 0 ? Math.sqrt(dx * dx + dz * dz) : dx) : dz > 0 ? dz : dx > dz ? dx : dz;
        if (d < minWallDist) minWallDist = d;
      }
      const wallFactor = smoothstep(-0.04, 0.72, minWallDist);
      ao *= 0.38 + 0.62 * wallFactor;

      // Corner & pilaster contact pockets (fast AABB + squared-distance reject)
      for (let i = 0; i < cornerNodes.length; i++) {
        const cn = cornerNodes[i];
        const rad = cn[2];
        const dx = wx - cn[0];
        if (dx >= rad || dx <= -rad) continue;
        const dz = wz - cn[1];
        if (dz >= rad || dz <= -rad) continue;
        const distSq = dx * dx + dz * dz;
        if (distSq < rad * rad) {
          const t = 1 - smoothstep(0.0, rad, Math.sqrt(distSq));
          ao *= 1 - cn[3] * t;
        }
      }

      // Furniture perimeter contact AO (fast AABB reject skips >94% of pads per pixel)
      for (let i = 0; i < furnitureAoPads.length; i++) {
        const pad = furnitureAoPads[i];
        const feather = pad[5];
        const dx = Math.abs(wx - pad[0]) - pad[2];
        if (dx >= feather) continue;
        const dz = Math.abs(wz - pad[1]) - pad[3];
        if (dz >= feather) continue;
        const d = dx > 0 ? (dz > 0 ? Math.sqrt(dx * dx + dz * dz) : dx) : dz > 0 ? dz : dx > dz ? dx : dz;
        if (d < feather) {
          const fall = 1 - smoothstep(-0.12, feather, d);
          ao *= 1 - Math.min(0.62, pad[4] * 1.08) * fall;
        }
      }

      const idx = (py * size + px) * 4;
      data[idx] = Math.round(clamp01(giLum) * 255);
      data[idx + 1] = Math.round(clamp01(warmFactor) * 255);
      data[idx + 2] = Math.round(clamp01(ao) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx2d.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Updates baked GI lightmap intensity & bounce tint to match each atmosphere preset.
 */
export function updateBakedLightmapForAtmosphere(
  uniforms: TwilightUniforms,
  mode: AtmosphereMode
): void {
  if (mode === 'daylight') {
    uniforms.uGiIntensity.value = 0.94;
    uniforms.uGiTint.value.setHex(0xffeedc);
  } else if (mode === 'sunset') {
    uniforms.uGiIntensity.value = 0.96;
    uniforms.uGiTint.value.setHex(0xffc6aa);
  } else if (mode === 'midnight') {
    uniforms.uGiIntensity.value = 0.90;
    uniforms.uGiTint.value.setHex(0x886ed4);
  } else {
    uniforms.uGiIntensity.value = 0.88;
    uniforms.uGiTint.value.setHex(0xf59ab8);
  }
}

function createSoftRectContactTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;

  for (let y = 0; y < size; y++) {
    const ny = (y / (size - 1)) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const nx = (x / (size - 1)) * 2 - 1;
      // Rounded-box signed distance inside [-1, 1]^2
      const qx = Math.max(0, Math.abs(nx) - 0.48);
      const qy = Math.max(0, Math.abs(ny) - 0.48);
      const dist = Math.hypot(qx, qy) / 0.52;
      const alpha = Math.pow(clamp01(1 - smoothstep(0.0, 1.0, dist)), 1.75);
      const idx = (y * size + x) * 4;
      d[idx] = 56;
      d[idx + 1] = 46;
      d[idx + 2] = 68;
      d[idx + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createSoftRadialContactTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(56, 46, 68, 1.0)');
  g.addColorStop(0.45, 'rgba(56, 46, 68, 0.52)');
  g.addColorStop(0.8, 'rgba(56, 46, 68, 0.16)');
  g.addColorStop(1, 'rgba(56, 46, 68, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Places soft, non-shadow-casting floor contact-shadow decals across all rooms,
 * with special emphasis on the Dining Room (餐厅), Kitchen (厨房), and Hallway/Corridor (走廊),
 * grounding furniture legs, cabinet toe-kicks, doorway thresholds, and architectural pilasters.
 */
export function buildApartmentContactShadows(
  ctx: RoomBuildContext,
  renderer: THREE.WebGLRenderer
): BakedLightmapRig {
  const giTexture = createApartmentBakedLightmap(renderer);
  const rectTex = createSoftRectContactTexture();
  const radialTex = createSoftRadialContactTexture();
  const contactTextures = [rectTex, radialTex];

  const matPool = new Map<string, THREE.MeshBasicMaterial>();
  const contactMaterials: THREE.MeshBasicMaterial[] = [];
  const baseOpacities = new Map<THREE.MeshBasicMaterial, number>();

  const getMat = (kind: 'rect' | 'radial', opacity: number): THREE.MeshBasicMaterial => {
    const key = `${kind}-${opacity.toFixed(2)}`;
    const cached = matPool.get(key);
    if (cached) return cached;
    const m = new THREE.MeshBasicMaterial({
      map: kind === 'rect' ? rectTex : radialTex,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    matPool.set(key, m);
    contactMaterials.push(m);
    baseOpacities.set(m, opacity);
    return m;
  };

  const sharedPlaneGeo = new THREE.PlaneGeometry(1, 1);
  sharedPlaneGeo.rotateX(-Math.PI / 2);

  const roomShadowGroups: Record<RoomId, THREE.Group> = {
    living: new THREE.Group(),
    entryway: new THREE.Group(),
    dining: new THREE.Group(),
    kitchen: new THREE.Group(),
    bedroom: new THREE.Group(),
    bathroom: new THREE.Group(),
    basement: new THREE.Group(),
  };

  for (const [roomKey, grp] of Object.entries(roomShadowGroups) as [RoomId, THREE.Group][]) {
    grp.name = `ContactShadows_${roomKey}`;
    ctx.scene.add(grp);
    ctx.sceneManager.registerRoomObject(roomKey, grp);
  }

  const roomDecalBuckets: Record<RoomId, Map<THREE.MeshBasicMaterial, THREE.BufferGeometry[]>> = {
    living: new Map(),
    entryway: new Map(),
    dining: new Map(),
    kitchen: new Map(),
    bedroom: new Map(),
    bathroom: new Map(),
    basement: new Map(),
  };
  const _decalMat4 = new THREE.Matrix4();
  const _decalPos = new THREE.Vector3();
  const _decalQuat = new THREE.Quaternion();
  const _decalEuler = new THREE.Euler();
  const _decalScale = new THREE.Vector3();
  const mergedDecalGeos: THREE.BufferGeometry[] = [];

  const addDecal = (
    room: RoomId,
    kind: 'rect' | 'radial',
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    opacity: number,
    rotY = 0
  ) => {
    const mat = getMat(kind, opacity);
    const geo = sharedPlaneGeo.clone();
    _decalPos.set(x, y, z);
    _decalEuler.set(0, rotY, 0);
    _decalQuat.setFromEuler(_decalEuler);
    _decalScale.set(w, 1, d);
    _decalMat4.compose(_decalPos, _decalQuat, _decalScale);
    geo.applyMatrix4(_decalMat4);
    const map = roomDecalBuckets[room];
    let list = map.get(mat);
    if (!list) {
      list = [];
      map.set(mat, list);
    }
    list.push(geo);
  };

  // =========================================================================
  // 1. DINING ROOM (餐厅) & HALLWAY / CORRIDOR (走廊) CONTACT SHADOWS
  // =========================================================================
  // Dining Table soft canopy shadow + 4 splayed leg floor spots
  addDecal('dining', 'rect', 0.32, 0.0025, 4.25, 1.72, 1.18, 0.30);
  for (const [lx, lz] of [
    [-0.64, -0.37],
    [0.64, -0.37],
    [-0.64, 0.37],
    [0.64, 0.37],
  ]) {
    addDecal('dining', 'radial', 0.32 + lx * 1.12, 0.003, 4.25 + lz * 1.12, 0.24, 0.24, 0.42);
  }

  // 4 Dining Chairs (under-seat pool + 16 splayed leg spots)
  const chairOffsets: [number, number][] = [
    [-0.46, -0.74],
    [0.46, -0.74],
    [-0.46, 0.74],
    [0.46, 0.74],
  ];
  for (const [cx, cz] of chairOffsets) {
    const wx = 0.32 + cx;
    const wz = 4.25 + cz;
    addDecal('dining', 'radial', wx, 0.0025, wz, 0.58, 0.58, 0.28);
    for (const [lx, lz] of [
      [-0.19, -0.19],
      [0.19, -0.19],
      [-0.19, 0.19],
      [0.19, 0.19],
    ]) {
      addDecal('dining', 'radial', wx + lx, 0.0032, wz + lz, 0.14, 0.14, 0.34);
    }
  }

  // Dining South Sideboard Buffet + 4 splayed leg contacts + Low Teddy Bear Bench (-1.05, 6.36)
  addDecal('dining', 'rect', 0.32, 0.0025, 6.38, 1.92, 0.68, 0.42);
  addDecal('dining', 'rect', -1.05, 0.0025, 6.36, 0.72, 0.50, 0.36);
  for (const lx of [-0.75, 0.75]) {
    for (const lz of [-0.17, 0.17]) {
      addDecal('dining', 'radial', 0.32 + lx, 0.0032, 6.38 + lz, 0.18, 0.18, 0.40);
    }
  }

  // 2 Breakfast Barstools (Dining side of breakfast bar) + leg contacts
  for (const sz of [4.55, 5.75]) {
    addDecal('dining', 'radial', 2.74, 0.0025, sz, 0.52, 0.52, 0.34);
    for (const [lx, lz] of [
      [-0.13, -0.13],
      [0.13, -0.13],
      [-0.13, 0.13],
      [0.13, 0.13],
    ]) {
      addDecal('dining', 'radial', 2.74 + lx, 0.0032, sz + lz, 0.13, 0.13, 0.34);
    }
  }

  // Corridor & Threshold Grounding Shadows (走廊 + 门框过渡阴影)
  // Dining North Corridor Wall baseboard feather (X = -2.60 .. 1.50, Z = 0.39)
  addDecal('dining', 'rect', -0.55, 0.0022, 0.39, 4.18, 0.38, 0.24);
  // Basement Doorway Jambs & Threshold Strip (X = -2.52, Z = 0.35..2.35)
  addDecal('dining', 'rect', -2.50, 0.0024, 1.35, 0.38, 2.15, 0.26);
  addDecal('dining', 'radial', -2.58, 0.003, 0.65, 0.34, 0.30, 0.34);
  addDecal('dining', 'radial', -2.58, 0.003, 2.05, 0.34, 0.30, 0.34);
  // Living-Dining Doorway Jambs & Threshold Strip (X = 1.54..2.77, Z = 0.36)
  addDecal('dining', 'rect', 2.155, 0.0025, 0.36, 1.38, 0.36, 0.24);
  addDecal('dining', 'radial', 1.54, 0.003, 0.34, 0.28, 0.28, 0.32);
  addDecal('dining', 'radial', 2.77, 0.003, 0.34, 0.28, 0.28, 0.32);
  // Entryway-Dining Archway Pilasters (X = -2.60, Z = 2.95 & 5.75)
  addDecal('dining', 'radial', -2.60, 0.0028, 2.95, 0.46, 0.42, 0.32);
  addDecal('dining', 'radial', -2.60, 0.0028, 5.75, 0.46, 0.42, 0.32);

  // =========================================================================
  // 2. KITCHEN (厨房) CONTACT SHADOWS
  // =========================================================================
  // East Lower Cabinet toe-kick perimeter contact shadow (Z = 3.50..6.68)
  addDecal('kitchen', 'rect', 6.48, 0.0025, 5.09, 0.58, 3.22, 0.44);
  // South Lower Cabinet toe-kick perimeter contact shadow (X = 3.45..6.95)
  addDecal('kitchen', 'rect', 5.20, 0.0025, 5.86, 3.52, 0.58, 0.44);
  // Breakfast Bar knee-wall floor contact (Dining & Kitchen faces along X = 3.18)
  addDecal('dining', 'rect', 3.03, 0.0025, 5.28, 0.40, 3.00, 0.36);
  addDecal('kitchen', 'rect', 3.33, 0.0025, 5.28, 0.40, 3.00, 0.36);
  // Refrigerator footprint contact shadow at North Kitchen Entrance wall (X = 3.86, Z = 0.78)
  addDecal('kitchen', 'rect', 3.86, 0.0026, 0.78, 0.96, 0.88, 0.48);
  // Two-Tier Glass-Front Kitchen Dish Hutch footprint (X = 6.84, Z = 2.58) + Lime-Green Trash Bin (3.52, 3.68)
  addDecal('kitchen', 'rect', 6.84, 0.0026, 2.58, 0.68, 1.42, 0.44);
  addDecal('kitchen', 'rect', 3.52, 0.0026, 3.68, 0.44, 0.48, 0.38);
  // Kitchen North baseboard feather & archway pilasters (X = 3.18, Z = 0.39 / 3.82)
  addDecal('kitchen', 'rect', 5.25, 0.0022, 0.39, 4.10, 0.36, 0.24);
  addDecal('kitchen', 'radial', 3.18, 0.0028, 0.39, 0.44, 0.40, 0.32);
  addDecal('kitchen', 'radial', 3.18, 0.0028, 3.82, 0.48, 0.46, 0.36);

  // =========================================================================
  // 3. ENTRYWAY (玄关) CONTACT SHADOWS
  // =========================================================================
  addDecal('entryway', 'rect', -5.15, 0.0025, 2.80, 1.66, 0.62, 0.38);
  for (const lx of [-0.66, 0.66]) {
    for (const lz of [-0.15, 0.15]) {
      addDecal('entryway', 'radial', -5.15 + lx, 0.0032, 2.80 + lz, 0.18, 0.18, 0.36);
    }
  }
  addDecal('entryway', 'radial', -7.28, -0.0775, 6.12, 0.62, 0.62, 0.42);
  // Genkan sunken step base contact shadow along X = -5.88
  addDecal('entryway', 'rect', -5.92, -0.0775, 4.60, 0.36, 4.25, 0.34);
  // Slippers in Genkan
  for (const [sx, sz] of [
    [-6.55, 4.05],
    [-6.55, 4.28],
    [-6.25, 5.05],
    [-6.30, 5.26],
  ]) {
    addDecal('entryway', 'radial', sx, -0.0772, sz, 0.22, 0.32, 0.30);
  }

  // =========================================================================
  // 4. LIVING ROOM (客厅) CONTACT SHADOWS (Grounded on both Rug Y=0.0372 & Floor Y=0.0028)
  // =========================================================================
  // Woven area rug floor border feather
  addDecal('living', 'rect', 4.10, 0.002, -5.25, 5.12, 5.52, 0.24);
  // L-Sofa deep soft contact shadow on top of the rug (rug top is at Y = 0.036, so place at Y = 0.0372!)
  addDecal('living', 'rect', 2.38, 0.0372, -5.25, 1.42, 3.92, 0.48);
  addDecal('living', 'rect', 3.27, 0.0372, -4.04, 1.04, 1.42, 0.44);
  // Individual L-Sofa turned wooden leg contact shadows on rug
  for (const [lx, lz] of [
    [1.92, -6.96],
    [2.82, -6.96],
    [1.92, -5.25],
    [2.82, -5.25],
    [1.92, -3.52],
    [3.66, -3.52],
    [3.66, -4.55],
  ]) {
    addDecal('living', 'radial', lx, 0.0376, lz, 0.24, 0.24, 0.46);
  }
  // Coffee Table soft contact shadow on top of rug + 4 splayed legs
  addDecal('living', 'rect', 4.62, 0.0372, -5.25, 1.18, 1.92, 0.42);
  for (const [lx, lz] of [
    [-0.35, -0.68],
    [0.35, -0.68],
    [-0.35, 0.68],
    [0.35, 0.68],
  ]) {
    addDecal('living', 'radial', 4.62 + lx, 0.0378, -5.25 + lz, 0.22, 0.22, 0.48);
  }
  // TV Console soft contact shadow + 6 splayed legs + Floor-Standing Speaker Towers
  addDecal('living', 'rect', 6.76, 0.0028, -5.08, 0.84, 2.56, 0.48);
  for (const lz of [-6.08, -5.08, -4.08]) {
    addDecal('living', 'radial', 6.52, 0.0034, lz, 0.20, 0.20, 0.44);
    addDecal('living', 'radial', 6.98, 0.0034, lz, 0.20, 0.20, 0.44);
  }
  addDecal('living', 'radial', 6.76, 0.0030, -6.28, 0.46, 0.46, 0.42);
  addDecal('living', 'radial', 6.76, 0.0030, -3.88, 0.46, 0.46, 0.42);
  // Tall 3-Tier Bookcase + Rattan Basket Stool + 3-Drawer Chest of Drawers
  addDecal('living', 'rect', -0.96, 0.0028, -1.22, 0.52, 1.20, 0.44);
  addDecal('living', 'radial', -0.95, 0.0028, -1.90, 0.48, 0.48, 0.38);
  addDecal('living', 'rect', -0.92, 0.0028, -2.52, 0.60, 1.06, 0.44);
  // Two-Tier Sofa End Table on rug + White Tufted Armchair + Curved-Stem Striped Floor Lamp
  addDecal('living', 'rect', 2.34, 0.0372, -7.52, 0.72, 0.76, 0.42);
  addDecal('living', 'rect', 1.15, 0.0028, -9.12, 1.12, 1.08, 0.44, 0.28);
  addDecal('living', 'radial', 0.18, 0.0030, -9.48, 0.52, 0.52, 0.42);
  // Side Stool + Broadleaf Plant
  addDecal('living', 'radial', 6.72, 0.0028, -2.55, 0.66, 0.70, 0.34);
  addDecal('living', 'radial', 6.52, 0.0028, -9.62, 0.68, 0.68, 0.42);

  // =========================================================================
  // 5. BEDROOM (卧室) CONTACT SHADOWS (Enlarged Bed South, Nightstand North, Enlarged PC Desk)
  // =========================================================================
  addDecal('bedroom', 'rect', -6.54, 0.0028, -4.05, 2.74, 2.24, 0.46);
  addDecal('bedroom', 'rect', -7.55, 0.0028, -5.85, 0.78, 0.84, 0.40);
  addDecal('bedroom', 'rect', -7.54, 0.0028, -1.00, 0.88, 1.64, 0.46);
  addDecal('bedroom', 'rect', -2.52, 0.0028, -6.12, 2.04, 1.04, 0.36);
  addDecal('bedroom', 'radial', -2.60, 0.0030, -5.38, 0.78, 0.78, 0.38);
  addDecal('bedroom', 'rect', -4.65, 0.0028, -0.04, 1.02, 0.46, 0.40);

  // =========================================================================
  // 6. BATHROOM (浴室) CONTACT SHADOWS
  // =========================================================================
  addDecal('bathroom', 'rect', 3.42, 0.0028, -11.90, 0.72, 1.24, 0.44);
  addDecal('bathroom', 'rect', 3.42, 0.0028, -10.88, 0.60, 0.68, 0.44);
  addDecal('bathroom', 'radial', 3.68, 0.0028, -13.42, 1.38, 1.38, 0.40);
  addDecal('bathroom', 'radial', 5.15, 0.0028, -13.71, 0.46, 0.38, 0.36);
  addDecal('bathroom', 'radial', 6.86, 0.0028, -13.48, 0.86, 0.64, 0.44);
  addDecal('bathroom', 'rect', 6.92, 0.0028, -12.32, 0.52, 0.76, 0.42);
  addDecal('bathroom', 'rect', 6.88, 0.0028, -11.12, 0.76, 0.76, 0.48);

  // Merge static contact-shadow decals per room & material into single batched meshes
  for (const [roomKey, bucketMap] of Object.entries(roomDecalBuckets) as [
    RoomId,
    Map<THREE.MeshBasicMaterial, THREE.BufferGeometry[]>,
  ][]) {
    if (bucketMap.size === 0) continue;
    const perMatGeos: THREE.BufferGeometry[] = [];
    const mats: THREE.MeshBasicMaterial[] = [];
    for (const [mat, geos] of bucketMap.entries()) {
      const merged =
        geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
      if (geos.length > 1) {
        for (const g of geos) g.dispose();
      }
      if (merged) {
        perMatGeos.push(merged);
        mats.push(mat);
      }
    }
    if (perMatGeos.length > 0) {
      const combined = BufferGeometryUtils.mergeGeometries(perMatGeos, true);
      for (const g of perMatGeos) g.dispose();
      if (combined) {
        combined.computeBoundingSphere();
        mergedDecalGeos.push(combined);
        const batchMesh = new THREE.Mesh(combined, mats);
        batchMesh.name = `ContactShadowsMerged_${roomKey}`;
        batchMesh.castShadow = false;
        batchMesh.receiveShadow = false;
        batchMesh.renderOrder = 2;
        batchMesh.matrixAutoUpdate = false;
        batchMesh.updateMatrix();
        roomShadowGroups[roomKey].add(batchMesh);
      }
    }
  }

  const setAtmosphere = (mode: AtmosphereMode) => {
    const mult =
      mode === 'daylight'
        ? 0.62
        : mode === 'sunset'
          ? 0.78
          : mode === 'midnight'
            ? 0.72
            : 0.96;
    const tint =
      mode === 'daylight'
        ? 0x625074
        : mode === 'sunset'
          ? 0x4c3764
          : mode === 'midnight'
            ? 0x1a153a
            : 0x2a0e26;
    for (const mat of contactMaterials) {
      const base = baseOpacities.get(mat) ?? 0.36;
      mat.opacity = Math.min(0.62, base * mult);
      mat.color.setHex(tint);
    }
  };

  const dispose = () => {
    giTexture.dispose();
    for (const tex of contactTextures) tex.dispose();
    for (const mat of contactMaterials) mat.dispose();
    for (const geo of mergedDecalGeos) geo.dispose();
    sharedPlaneGeo.dispose();
  };

  return {
    giTexture,
    contactTextures,
    contactMaterials,
    setAtmosphere,
    dispose,
  };
}
