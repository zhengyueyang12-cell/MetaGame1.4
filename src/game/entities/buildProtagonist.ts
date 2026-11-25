import * as THREE from 'three';
import {
  createTwilightMaterial,
  type OutlineRegistry,
  type TwilightUniforms,
} from '../pipeline';
import { buildXboxControllerMesh } from '../props/livingConsoleProps';

export interface ProtagonistUpdateParams {
  feetPos: THREE.Vector3;
  yaw: number;
  pitch: number;
  walkSpeed: number;
  isMoving: boolean;
  viewMode: 'first-person' | 'overview';
  hideAll?: boolean;
  seatedOnSofa?: boolean;
  sofaBaseYaw?: number;
  coPlayMode?: 'none' | 'reaching' | 'holding';
  coPlayReachProgress?: number;
  coPlayInputX?: number;
  coPlayInputY?: number;
  coPlayActionPulse?: number;
}

export interface ProtagonistRig {
  root: THREE.Group;
  headGroup: THREE.Group;
  bodyGroup: THREE.Group;
  leftHandGroup: THREE.Group;
  rightHandGroup: THREE.Group;
  triangleCount: number;
  setRenderPassMode: (mode: 'first-person' | 'overview' | 'mirror') => void;
  triggerHandReach: (strength?: number) => void;
  update: (dt: number, elapsed: number, params: ProtagonistUpdateParams) => void;
}

interface LoftStation {
  x: number;
  y: number;
  z: number;
  rx: number;
  rz: number;
  mod?: (theta: number, out: [number, number]) => void;
  tiltX?: number;
  tiltZ?: number;
}

/**
 * Generates a smooth, watertight, organic lofted BufferGeometry from cross-section stations.
 * Seam normals are welded so cel/PBR shading wraps invisibly across limbs, torso, and cloth.
 */
function createOrganicLoft(
  stations: LoftStation[],
  radialSegs: number,
  capBottom = true,
  capTop = true
): THREE.BufferGeometry {
  const ringCount = stations.length;
  const stride = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const modPair: [number, number] = [0, 0];

  for (let r = 0; r < ringCount; r++) {
    const st = stations[r];
    const v = r / Math.max(1, ringCount - 1);
    const cosTx = st.tiltX ? Math.cos(st.tiltX) : 1;
    const sinTx = st.tiltX ? Math.sin(st.tiltX) : 0;
    const cosTz = st.tiltZ ? Math.cos(st.tiltZ) : 1;
    const sinTz = st.tiltZ ? Math.sin(st.tiltZ) : 0;

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      let lx = Math.cos(theta) * st.rx;
      let lz = Math.sin(theta) * st.rz;
      let ly = 0;

      if (st.mod) {
        modPair[0] = lx;
        modPair[1] = lz;
        st.mod(theta, modPair);
        lx = modPair[0];
        lz = modPair[1];
      }

      if (st.tiltX) {
        const ny = ly * cosTx - lz * sinTx;
        const nz = ly * sinTx + lz * cosTx;
        ly = ny;
        lz = nz;
      }
      if (st.tiltZ) {
        const nx = lx * cosTz - ly * sinTz;
        const ny = lx * sinTz + ly * cosTz;
        lx = nx;
        ly = ny;
      }

      positions.push(st.x + lx, st.y + ly, st.z + lz);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < ringCount - 1; r++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = r * stride + s;
      const b = a + 1;
      const c = (r + 1) * stride + s;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  if (capBottom && ringCount > 0) {
    const first = stations[0];
    const centerIdx = positions.length / 3;
    positions.push(first.x, first.y, first.z);
    uvs.push(0.5, 0);
    for (let s = 0; s < radialSegs; s++) {
      indices.push(centerIdx, s, s + 1);
    }
  }

  if (capTop && ringCount > 0) {
    const last = stations[ringCount - 1];
    const baseRing = (ringCount - 1) * stride;
    const centerIdx = positions.length / 3;
    positions.push(last.x, last.y, last.z);
    uvs.push(0.5, 1);
    for (let s = 0; s < radialSegs; s++) {
      indices.push(centerIdx, baseRing + s + 1, baseRing + s);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const norm = geo.attributes.normal;
  for (let r = 0; r < ringCount; r++) {
    const i0 = r * stride;
    const i1 = r * stride + radialSegs;
    const nx = norm.getX(i0) + norm.getX(i1);
    const ny = norm.getY(i0) + norm.getY(i1);
    const nz = norm.getZ(i0) + norm.getZ(i1);
    const inv = 1 / Math.max(1e-6, Math.hypot(nx, ny, nz));
    norm.setXYZ(i0, nx * inv, ny * inv, nz * inv);
    norm.setXYZ(i1, nx * inv, ny * inv, nz * inv);
  }
  norm.needsUpdate = true;
  return geo;
}

/**
 * Generates an open-front shell (such as the open zip-up hoodie jacket wrapping cleanly
 * around the back and sides while leaving a crisp front opening showing the white T-shirt).
 * Builds both outer and inner wall with beveled front lapel edges so it has real fabric thickness!
 */
function createOpenJacketShell(
  stations: {
    y: number;
    rx: number;
    rz: number;
    zOff: number;
    openHalfAngle: number; // radians from +Z center opening (0 = +Z front)
    thickness: number;
    foldRipple?: number;
  }[],
  arcSegs = 28
): THREE.BufferGeometry {
  const ringCount = stations.length;
  // Cross-section perimeter loop: outer arc (start -> end) then inner arc (end -> start)
  const outerPts = arcSegs + 1;
  const ringVerts = outerPts * 2;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < ringCount; r++) {
    const st = stations[r];
    const v = r / Math.max(1, ringCount - 1);
    const startPhi = Math.PI * 0.5 + st.openHalfAngle; // Left front edge (+Z is PI/2)
    const endPhi = Math.PI * 2.5 - st.openHalfAngle; // Wraps around -X, -Z (back), +X to right front edge
    const ripple = st.foldRipple ?? 0;

    // Outer surface points
    for (let s = 0; s <= arcSegs; s++) {
      const u = s / arcSegs;
      const phi = startPhi + (endPhi - startPhi) * u;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      // Subtle organic cloth drape folds along back and sides
      const wave =
        ripple *
        (0.55 * Math.sin(phi * 5.0 + v * 3.1) + 0.45 * Math.cos(phi * 3.0 - v * 2.4)) *
        Math.sin(u * Math.PI);
      // Slight chest flattening at front, slight spine hollow at center back
      const backHollow = sinP < -0.7 ? -0.004 * Math.pow(-sinP - 0.7, 1.5) : 0;
      const rx = st.rx + wave;
      const rz = st.rz + wave + backHollow;
      positions.push(cosP * rx, st.y, st.zOff + sinP * rz);
      uvs.push(u, v);
    }

    // Inner lining surface points (reversed to close the thickened C-loop seamlessly)
    for (let s = arcSegs; s >= 0; s--) {
      const u = s / arcSegs;
      const phi = startPhi + (endPhi - startPhi) * u;
      const cosP = Math.cos(phi);
      const sinP = Math.sin(phi);
      const rx = Math.max(0.01, st.rx - st.thickness);
      const rz = Math.max(0.01, st.rz - st.thickness);
      positions.push(cosP * rx, st.y, st.zOff + sinP * rz);
      uvs.push(u, v);
    }
  }

  for (let r = 0; r < ringCount - 1; r++) {
    for (let k = 0; k < ringVerts; k++) {
      const nextK = (k + 1) % ringVerts;
      const a = r * ringVerts + k;
      const b = r * ringVerts + nextK;
      const c = (r + 1) * ringVerts + k;
      const d = (r + 1) * ringVerts + nextK;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Cap bottom & top thickness rims
  for (let s = 0; s < arcSegs; s++) {
    // Bottom rim (r = 0)
    const o0 = s;
    const o1 = s + 1;
    const i0 = ringVerts - 1 - s;
    const i1 = ringVerts - 2 - s;
    indices.push(o0, o1, i0);
    indices.push(o1, i1, i0);

    // Top rim (r = ringCount - 1)
    const base = (ringCount - 1) * ringVerts;
    const to0 = base + s;
    const to1 = base + s + 1;
    const ti0 = base + ringVerts - 1 - s;
    const ti1 = base + ringVerts - 2 - s;
    indices.push(to0, ti0, to1);
    indices.push(to1, ti0, ti1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a curved, tapered, faceted anime hair lock following a 3D CatmullRomCurve3.
 * Diamond-lenticular cross-section gives crisp silhouette tips matching anime line-art.
 */
function createHairStrandGeometry(
  points: THREE.Vector3[],
  baseWidth: number,
  baseThickness: number,
  lengthSegs = 12,
  radialSegs = 6,
  tipTaper = 0.03
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(lengthSegs, false);
  const stride = radialSegs + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= lengthSegs; i++) {
    const t = THREE.MathUtils.clamp(i / lengthSegs, 0, 1);
    const pt = curve.getPoint(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];

    const rootFlare = t < 0.14 ? 0.72 + (t / 0.14) * 0.28 : 1.0;
    const taper = Math.pow(Math.max(0, 1 - t), 0.72) * (1 - tipTaper) + tipTaper;
    const w = baseWidth * rootFlare * taper;
    const h = baseThickness * rootFlare * Math.pow(Math.max(0, 1 - t), 0.85);

    for (let s = 0; s <= radialSegs; s++) {
      const u = s / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      // Slight lenticular ridge along the spine of each hair lock
      const ridge = 1.0 + 0.14 * Math.abs(sinT);
      const lx = cosT * w;
      const ly = sinT * h * ridge;

      positions.push(
        pt.x + B.x * lx + N.x * ly,
        pt.y + B.y * lx + N.y * ly,
        pt.z + B.z * lx + N.z * ly
      );
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < lengthSegs; i++) {
    for (let s = 0; s < radialSegs; s++) {
      const a = i * stride + s;
      const b = a + 1;
      const c = (i + 1) * stride + s;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Sharp welded tip vertex
  const tipPt = curve.getPoint(1);
  const tipIdx = positions.length / 3;
  positions.push(tipPt.x, tipPt.y, tipPt.z);
  uvs.push(0.5, 1);
  const lastRing = lengthSegs * stride;
  for (let s = 0; s < radialSegs; s++) {
    indices.push(lastRing + s, tipIdx, lastRing + s + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an anime young-man head matching the 3-view reference sheet:
 * smooth cranium, clean slender V-tapered jaw, delicate nose bridge & pointed tip in side profile,
 * subtle cheek planes, gentle eye socket contour, and refined chin.
 */
function createSculptedAnimeHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 44, 36);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const ux = pos.getX(i);
    const uy = pos.getY(i);
    const uz = pos.getZ(i);

    let x = ux * 0.088;
    let y = uy * 0.112;
    let z = uz * 0.098;

    // Fuller rounded anime cranium at crown & occiput
    if (uy > 0.1) {
      const cranium = (uy - 0.1) / 0.9;
      x *= 1.0 + 0.08 * Math.sin(cranium * Math.PI);
      if (uz < 0) {
        z *= 1.0 + 0.085 * Math.sin(cranium * Math.PI);
      }
    }

    // Slender, crisp anime male jawline tapering into a clean chin (matching front & side views)
    if (uy < 0.06) {
      const lower = THREE.MathUtils.clamp((0.06 - uy) / 1.06, 0, 1);
      const jawTaper = 1.0 - 0.36 * Math.pow(lower, 1.38);
      x *= jawTaper;

      // Clean front jaw plane + gentle chin point
      if (uz > 0) {
        const chinFocus = Math.exp(-Math.pow(ux / 0.34, 2)) * Math.exp(-Math.pow((uy + 0.88) / 0.24, 2));
        z += 0.0085 * chinFocus;
        y -= 0.0055 * chinFocus;

        // Subtle jaw corner definition along sides (gives sharp anime profile!)
        const jawAngle =
          Math.exp(-Math.pow((Math.abs(ux) - 0.62) / 0.24, 2)) *
          Math.exp(-Math.pow((uy + 0.44) / 0.22, 2));
        x += Math.sign(ux) * 0.0028 * jawAngle;
      } else {
        // Taper under-jaw cleanly back toward neck
        z *= 1.0 - 0.18 * Math.pow(lower, 1.3);
      }
    }

    // Gently flatten front facial plane so anime eyes sit crisply without bulging
    if (uz > 0.35 && uy > -0.58 && uy < 0.45) {
      const faceMask =
        THREE.MathUtils.clamp((uz - 0.35) / 0.65, 0, 1) *
        Math.exp(-Math.pow((uy + 0.06) / 0.56, 2));
      z -= 0.005 * faceMask;
    }

    // Subtle concave eye socket recesses
    if (uz > 0.55) {
      const eyeSocketL =
        Math.exp(-Math.pow((ux - 0.32) / 0.19, 2)) *
        Math.exp(-Math.pow((uy + 0.04) / 0.14, 2));
      const eyeSocketR =
        Math.exp(-Math.pow((ux + 0.32) / 0.19, 2)) *
        Math.exp(-Math.pow((uy + 0.04) / 0.14, 2));
      z -= 0.0038 * (eyeSocketL + eyeSocketR);
    }

    // Defined anime nose bridge & crisp pointed tip (matches side profile!)
    if (uz > 0.68) {
      const noseRidge =
        Math.exp(-Math.pow(ux / 0.088, 2)) *
        Math.exp(-Math.pow((uy + 0.17) / 0.15, 2));
      const noseTip =
        Math.exp(-Math.pow(ux / 0.072, 2)) *
        Math.exp(-Math.pow((uy + 0.28) / 0.068, 2));
      z += 0.0085 * noseRidge + 0.0115 * noseTip;
      y -= 0.0018 * noseTip;
    }

    // Subtle mouth / lip plane below nose
    if (uz > 0.65 && uy < -0.38 && uy > -0.68) {
      const lipCurve =
        Math.exp(-Math.pow(ux / 0.17, 2)) *
        Math.exp(-Math.pow((uy + 0.50) / 0.07, 2));
      z += 0.0032 * lipCurve;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an anatomical sculpted palm geometry with thenar mound and tapered knuckle bridge.
 */
function createSculptedPalmGeometry(sideSign: number): THREE.BufferGeometry {
  const stations: LoftStation[] = [
    { x: 0, y: 0.0, z: 0, rx: 0.024, rz: 0.015 },
    {
      x: 0.001 * sideSign,
      y: -0.022,
      z: 0.002,
      rx: 0.032,
      rz: 0.016,
      mod: (th, out) => {
        if (Math.cos(th) * sideSign < 0 && Math.sin(th) > 0) {
          out[1] += 0.0045 * Math.sin(th);
        }
      },
    },
    { x: 0.001 * sideSign, y: -0.052, z: 0.001, rx: 0.036, rz: 0.0135 },
    { x: 0, y: -0.076, z: 0.0, rx: 0.034, rz: 0.0115 },
    { x: 0, y: -0.084, z: 0.0, rx: 0.027, rz: 0.0085 },
  ];
  return createOrganicLoft(stations, 16, true, true);
}

/**
 * Generates a tapered anatomical finger phalanx segment.
 */
function createFingerSegmentGeometry(
  length: number,
  baseR: number,
  tipR: number,
  isTip = false
): THREE.BufferGeometry {
  const stations: LoftStation[] = [
    { x: 0, y: 0, z: 0, rx: baseR * 0.94, rz: baseR * 0.98 },
    { x: 0, y: -length * 0.35, z: 0, rx: baseR * 0.90, rz: baseR * 0.95 },
    { x: 0, y: -length * 0.72, z: 0, rx: THREE.MathUtils.lerp(baseR, tipR, 0.72), rz: THREE.MathUtils.lerp(baseR, tipR, 0.72) },
    { x: 0, y: -length, z: 0, rx: isTip ? tipR * 0.58 : tipR, rz: isTip ? tipR * 0.52 : tipR },
  ];
  return createOrganicLoft(stations, 10, true, true);
}

/**
 * Procedural CanvasTexture for expressive warm amber-brown anime eyes matching the 3-view reference:
 * crisp dark upper lash line, layered deep-chestnut to luminous honey-amber iris, twin white catchlights.
 */
function createAnimeEyeTexture(isLeftEye: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.save();
  if (!isLeftEye) {
    ctx.translate(256, 0);
    ctx.scale(-1, 1);
  }

  // 1. Sclera (clean soft warm-white almond eye shape with top eyelid shadow)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(22, 134);
  ctx.bezierCurveTo(64, 72, 188, 66, 236, 126);
  ctx.bezierCurveTo(206, 186, 68, 192, 22, 134);
  ctx.closePath();
  ctx.fillStyle = '#fcfaf7';
  ctx.fill();
  ctx.clip();

  // Subtle cool-warm sclera shadow under upper eyelid
  const scleraShade = ctx.createLinearGradient(0, 68, 0, 128);
  scleraShade.addColorStop(0, 'rgba(136, 124, 138, 0.44)');
  scleraShade.addColorStop(0.55, 'rgba(164, 152, 162, 0.14)');
  scleraShade.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = scleraShade;
  ctx.fillRect(0, 60, 256, 80);

  // 2. Warm Amber-Brown Anime Iris (centered slightly inward for calm gaze)
  const ix = 132;
  const iy = 128;
  const irx = 52;
  const iry = 58;

  // Outer espresso iris rim
  ctx.fillStyle = '#2a1a12';
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx + 4, iry + 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vertical chestnut -> honey-amber gradient fill
  const irisGrad = ctx.createLinearGradient(ix, iy - iry, ix, iy + iry);
  irisGrad.addColorStop(0.0, '#2f1c11');
  irisGrad.addColorStop(0.28, '#5a381d');
  irisGrad.addColorStop(0.58, '#9e6732');
  irisGrad.addColorStop(0.84, '#d99e56');
  irisGrad.addColorStop(1.0, '#eec07e');
  ctx.fillStyle = irisGrad;
  ctx.beginPath();
  ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Luminous golden-amber lower crescent glow inside iris
  const glowGrad = ctx.createRadialGradient(ix, iy + 24, 4, ix, iy + 20, 40);
  glowGrad.addColorStop(0, 'rgba(255, 224, 154, 0.85)');
  glowGrad.addColorStop(0.65, 'rgba(222, 154, 72, 0.35)');
  glowGrad.addColorStop(1, 'rgba(222, 154, 72, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.ellipse(ix, iy + 18, 38, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Radial iris fiber strokes
  ctx.strokeStyle = 'rgba(42, 24, 14, 0.22)';
  ctx.lineWidth = 2;
  for (let a = 0; a < 20; a++) {
    const ang = (a / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(ix + Math.cos(ang) * 20, iy + Math.sin(ang) * 22);
    ctx.lineTo(ix + Math.cos(ang) * (irx - 2), iy + Math.sin(ang) * (iry - 2));
    ctx.stroke();
  }

  // Deep espresso pupil
  ctx.fillStyle = '#1b110d';
  ctx.beginPath();
  ctx.ellipse(ix, iy - 1, 21, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Top shadow band across upper iris
  const irisTopShade = ctx.createLinearGradient(0, iy - iry, 0, iy + 4);
  irisTopShade.addColorStop(0, 'rgba(22, 14, 12, 0.65)');
  irisTopShade.addColorStop(0.65, 'rgba(28, 18, 15, 0.16)');
  irisTopShade.addColorStop(1, 'rgba(28, 18, 15, 0)');
  ctx.fillStyle = irisTopShade;
  ctx.fillRect(ix - irx - 6, iy - iry - 6, (irx + 6) * 2, iry + 12);

  // Twin crisp anime specular catchlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(ix - 21, iy - 19, 12.5, 11.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 252, 242, 0.92)';
  ctx.beginPath();
  ctx.arc(ix + 18, iy + 18, 5.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // end sclera clip

  // 3. Crisp tapered anime upper eyelash arch (cool calm young-man shape)
  ctx.fillStyle = '#1a181c';
  ctx.beginPath();
  ctx.moveTo(15, 134);
  ctx.bezierCurveTo(58, 60, 184, 54, 244, 121);
  ctx.lineTo(234, 133);
  ctx.bezierCurveTo(182, 74, 66, 79, 25, 138);
  ctx.closePath();
  ctx.fill();

  // Delicate lower lash corner accent
  ctx.strokeStyle = 'rgba(42, 34, 38, 0.68)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(56, 174);
  ctx.quadraticCurveTo(132, 186, 206, 168);
  ctx.stroke();

  // Subtle double-eyelid crease line above upper lash
  ctx.strokeStyle = 'rgba(136, 98, 86, 0.62)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(48, 76);
  ctx.quadraticCurveTo(132, 46, 212, 78);
  ctx.stroke();

  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Subtle woven cloth micro-texture for charcoal hoodie fleece, grey twill trousers, and off-white cotton tee.
 */
function createSubtleFabricTexture(
  baseHex: string,
  weaveLight: string,
  weaveDark: string,
  isRibbed = false
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  if (isRibbed) {
    for (let x = 0; x < 256; x += 6) {
      ctx.fillStyle = weaveLight;
      ctx.fillRect(x, 0, 2, 256);
      ctx.fillStyle = weaveDark;
      ctx.fillRect(x + 3, 0, 2, 256);
    }
  } else {
    // Diagonal fine cotton/twill micro-grain
    ctx.strokeStyle = weaveLight;
    ctx.lineWidth = 1;
    for (let i = -256; i < 512; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();
    }
    ctx.strokeStyle = weaveDark;
    for (let i = -256; i < 512; i += 7) {
      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Builds the detailed anime male protagonist matching the T-pose 3-view turnaround sheet:
 * - Messy layered charcoal-black spiky anime hair + warm amber-brown eyes with animated blinking
 * - Open charcoal zip-up hoodie jacket with silver zipper tracks, pull tab, dark drawstrings & folded back hood
 * - Clean off-white crewneck T-shirt underneath
 * - Slim-straight medium-slate grey trousers with front & rear pockets
 * - Detailed matte-black modern athletic sneakers with chunky midsoles, laces & heel pull-tabs
 * - Full multi-joint animation (blink, yaw-lead turning anticipation, breathing, drawstring/hood sway, sneaker gait)
 */
export function createProtagonist(
  uniforms: TwilightUniforms,
  outlines: OutlineRegistry
): ProtagonistRig {
  const root = new THREE.Group();
  root.name = 'ProtagonistRoot';

  const bodyGroup = new THREE.Group();
  bodyGroup.name = 'ProtagonistBody';
  root.add(bodyGroup);

  const mat = (opts: Parameters<typeof createTwilightMaterial>[1]) =>
    createTwilightMaterial(uniforms, opts);

  // =========================================================================
  // 1. PROCEDURAL TEXTURES & REFERENCE-MATCHED ANIME PALETTE MATERIALS
  // =========================================================================
  const hoodieTex = createSubtleFabricTexture('#2f323a', 'rgba(255,255,255,0.025)', 'rgba(0,0,0,0.06)', false);
  const ribTex = createSubtleFabricTexture('#23252c', 'rgba(255,255,255,0.032)', 'rgba(0,0,0,0.12)', true);
  const teeTex = createSubtleFabricTexture('#efede7', 'rgba(255,255,255,0.04)', 'rgba(90,82,76,0.035)', false);
  const pantTex = createSubtleFabricTexture('#61656e', 'rgba(255,255,255,0.028)', 'rgba(0,0,0,0.055)', false);

  const skinMat = mat({
    color: 0xfce1d3,
    roughness: 0.72,
    metalness: 0.0,
    celStrength: 0.36,
  });
  const skinShadeMat = mat({
    color: 0xeac2b0,
    roughness: 0.76,
    metalness: 0.0,
    celStrength: 0.36,
  });
  const lipMat = mat({
    color: 0xa46f66,
    roughness: 0.65,
    celStrength: 0.3,
  });
  const hairMat = mat({
    color: 0x24252c,
    roughness: 0.56,
    metalness: 0.04,
    celStrength: 0.44,
  });
  const hairDeepMat = mat({
    color: 0x1b1c22,
    roughness: 0.62,
    celStrength: 0.46,
  });
  const hoodieMat = mat({
    map: hoodieTex,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
    celStrength: 0.46,
  });
  const hoodieInnerMat = mat({
    color: 0x23252c,
    roughness: 0.92,
    celStrength: 0.48,
  });
  const hoodieRibMat = mat({
    map: ribTex,
    color: 0xffffff,
    roughness: 0.90,
    celStrength: 0.48,
  });
  const seamAccentMat = mat({
    color: 0x1e2026,
    roughness: 0.90,
    celStrength: 0.45,
  });
  const zipperSilverMat = mat({
    color: 0xc5cad3,
    roughness: 0.28,
    metalness: 0.74,
    celStrength: 0.24,
  });
  const drawstringMat = mat({
    color: 0x1d1f25,
    roughness: 0.84,
    celStrength: 0.42,
  });
  const teeMat = mat({
    map: teeTex,
    color: 0xffffff,
    roughness: 0.85,
    celStrength: 0.40,
  });
  const teeRibMat = mat({
    color: 0xe6e3dc,
    roughness: 0.88,
    celStrength: 0.42,
  });
  const pantMat = mat({
    map: pantTex,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.02,
    celStrength: 0.45,
  });
  const pantSeamMat = mat({
    color: 0x4b4e57,
    roughness: 0.90,
    celStrength: 0.44,
  });
  const sockDarkMat = mat({
    color: 0x202228,
    roughness: 0.92,
    celStrength: 0.45,
  });
  const sneakerUpperMat = mat({
    color: 0x252830,
    roughness: 0.76,
    metalness: 0.04,
    celStrength: 0.44,
  });
  const sneakerOverlayMat = mat({
    color: 0x1c1e24,
    roughness: 0.64,
    metalness: 0.06,
    celStrength: 0.42,
  });
  const sneakerSoleMat = mat({
    color: 0x17191e,
    roughness: 0.78,
    metalness: 0.03,
    celStrength: 0.44,
  });
  const laceMat = mat({
    color: 0x2e313b,
    roughness: 0.84,
    celStrength: 0.42,
  });

  const leftEyeTex = createAnimeEyeTexture(true);
  const rightEyeTex = createAnimeEyeTexture(false);
  const leftEyeMat = new THREE.MeshBasicMaterial({
    map: leftEyeTex,
    transparent: true,
    alphaTest: 0.06,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const rightEyeMat = new THREE.MeshBasicMaterial({
    map: rightEyeTex,
    transparent: true,
    alphaTest: 0.06,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const addPart = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    outlineScale = 1.022,
    castShadow = true
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    if (outlineScale > 1.0) {
      outlines.addOutline(mesh, outlineScale);
    }
    parent.add(mesh);
    return mesh;
  };

  // =========================================================================
  // 2. PELVIS & STRUCTURED SLATE-GREY TROUSER WAISTBAND (Y = 0.875)
  // =========================================================================
  const pelvisPivot = new THREE.Group();
  pelvisPivot.position.set(0, 0.875, 0);
  bodyGroup.add(pelvisPivot);

  // Sculpted trousers hip & pelvis block
  const pelvisGeo = createOrganicLoft(
    [
      {
        x: 0,
        y: -0.088,
        z: 0.0,
        rx: 0.144,
        rz: 0.098,
        mod: (th, out) => {
          // Subtle twin-thigh separation crease at crotch underside
          const centerDip = Math.exp(-Math.pow(Math.cos(th) / 0.25, 2));
          out[1] *= 1 - 0.14 * centerDip;
        },
      },
      { x: 0, y: -0.025, z: 0.002, rx: 0.150, rz: 0.104 },
      { x: 0, y: 0.036, z: 0.003, rx: 0.146, rz: 0.098 },
      { x: 0, y: 0.082, z: 0.003, rx: 0.141, rz: 0.092 },
    ],
    28,
    true,
    true
  );
  addPart(pelvisPivot, pelvisGeo, pantMat, 1.018);

  // Trouser waistband trim + front fly stitch + button
  const waistBandGeo = createOrganicLoft(
    [
      { x: 0, y: 0.056, z: 0.003, rx: 0.144, rz: 0.094 },
      { x: 0, y: 0.084, z: 0.003, rx: 0.143, rz: 0.093 },
    ],
    28,
    false,
    true
  );
  addPart(pelvisPivot, waistBandGeo, pantSeamMat, 1.0, false);

  const flySeam = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.105, 0.006), pantSeamMat);
  flySeam.position.set(0, 0.015, 0.098);
  pelvisPivot.add(flySeam);

  // Slanted front hip pocket welts (matching front view)
  for (const side of [-1, 1]) {
    const fPocket = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.092, 0.016), pantSeamMat);
    fPocket.position.set(side * 0.116, 0.018, 0.066);
    fPocket.rotation.set(0.06, side * 0.56, side * 0.24);
    pelvisPivot.add(fPocket);

    // Pentagonal rear patch pockets (clearly visible in back view!)
    const rearPocketShape = new THREE.Shape();
    rearPocketShape.moveTo(-0.044, 0.038);
    rearPocketShape.lineTo(0.044, 0.038);
    rearPocketShape.lineTo(0.040, -0.026);
    rearPocketShape.lineTo(0.0, -0.044);
    rearPocketShape.lineTo(-0.040, -0.026);
    rearPocketShape.closePath();
    const rearPocketGeo = new THREE.ExtrudeGeometry(rearPocketShape, {
      depth: 0.006,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    const rPocket = new THREE.Mesh(rearPocketGeo, pantSeamMat);
    rPocket.position.set(side * 0.064, 0.004, -0.098);
    rPocket.rotation.y = Math.PI + side * 0.24;
    rPocket.rotation.x = 0.05;
    pelvisPivot.add(rPocket);
  }

  // =========================================================================
  // 3. TORSO PIVOT: INNER OFF-WHITE T-SHIRT + OPEN CHARCOAL ZIP HOODIE
  // =========================================================================
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.072, 0);
  pelvisPivot.add(torsoPivot);

  // 3A. Inner Off-White Crewneck T-Shirt (clean continuous torso core visible down center chest)
  const innerTeeGeo = createOrganicLoft(
    [
      {
        x: 0,
        y: -0.022,
        z: 0.005,
        rx: 0.136,
        rz: 0.092,
        mod: (th, out) => {
          // Natural subtle vertical T-shirt hem drape folds on front
          if (Math.sin(th) > 0.2) {
            out[1] += 0.003 * Math.sin(Math.cos(th) * 14.0);
          }
        },
      },
      {
        x: 0,
        y: 0.085,
        z: 0.004,
        rx: 0.133,
        rz: 0.089,
        mod: (th, out) => {
          if (Math.sin(th) > 0.2) {
            out[1] += 0.0025 * Math.cos(Math.cos(th) * 10.0);
          }
        },
      },
      { x: 0, y: 0.215, z: 0.006, rx: 0.146, rz: 0.097 },
      { x: 0, y: 0.345, z: 0.008, rx: 0.160, rz: 0.100 },
      { x: 0, y: 0.430, z: 0.004, rx: 0.148, rz: 0.086 },
      { x: 0, y: 0.478, z: -0.004, rx: 0.068, rz: 0.060 },
    ],
    28,
    true,
    true
  );
  addPart(torsoPivot, innerTeeGeo, teeMat, 1.0, true);

  // Ribbed off-white crewneck T-shirt collar ring (visible at upper chest in front view)
  const teeCollarPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const dip = Math.sin(a) > 0 ? Math.sin(a) * 0.026 : 0;
    teeCollarPts.push(
      new THREE.Vector3(
        Math.cos(a) * 0.064,
        0.474 - dip,
        Math.sin(a) * 0.062 + 0.008
      )
    );
  }
  const teeCollarGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(teeCollarPts, true),
    28,
    0.0085,
    8,
    true
  );
  const teeCollarMesh = addPart(torsoPivot, teeCollarGeo, teeRibMat, 1.0, false);

  // 3B. Open Charcoal Zip-Up Hoodie Jacket Shell (true open front revealing white T-shirt!)
  const jacketShellGeo = createOpenJacketShell(
    [
      { y: 0.012, rx: 0.156, rz: 0.107, zOff: 0.004, openHalfAngle: 0.34, thickness: 0.012, foldRipple: 0.004 },
      { y: 0.105, rx: 0.158, rz: 0.109, zOff: 0.004, openHalfAngle: 0.36, thickness: 0.013, foldRipple: 0.005 },
      { y: 0.225, rx: 0.166, rz: 0.114, zOff: 0.006, openHalfAngle: 0.37, thickness: 0.013, foldRipple: 0.004 },
      { y: 0.345, rx: 0.180, rz: 0.116, zOff: 0.007, openHalfAngle: 0.35, thickness: 0.013, foldRipple: 0.003 },
      { y: 0.435, rx: 0.172, rz: 0.102, zOff: 0.002, openHalfAngle: 0.33, thickness: 0.012, foldRipple: 0.002 },
      { y: 0.486, rx: 0.088, rz: 0.078, zOff: -0.006, openHalfAngle: 0.46, thickness: 0.011, foldRipple: 0.001 },
    ],
    32
  );
  addPart(torsoPivot, jacketShellGeo, hoodieMat, 1.02);

  // Darker Ribbed Bottom Hem Band of the Open Zip Hoodie (wrapping around back & sides, split at front)
  const jacketHemGeo = createOpenJacketShell(
    [
      { y: -0.042, rx: 0.151, rz: 0.103, zOff: 0.004, openHalfAngle: 0.35, thickness: 0.012, foldRipple: 0.001 },
      { y: -0.014, rx: 0.155, rz: 0.106, zOff: 0.004, openHalfAngle: 0.34, thickness: 0.012, foldRipple: 0.001 },
      { y: 0.016, rx: 0.156, rz: 0.107, zOff: 0.004, openHalfAngle: 0.34, thickness: 0.012, foldRipple: 0.001 },
    ],
    28
  );
  addPart(torsoPivot, jacketHemGeo, hoodieRibMat, 1.018);

  // 3C. Metallic Silver Vertical Zipper Tracks (left & right open edges) + Zipper Pull Tab
  for (const side of [-1, 1]) {
    const zipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.052, -0.038, 0.102),
      new THREE.Vector3(side * 0.056, 0.105, 0.106),
      new THREE.Vector3(side * 0.060, 0.235, 0.112),
      new THREE.Vector3(side * 0.061, 0.355, 0.114),
      new THREE.Vector3(side * 0.055, 0.440, 0.097),
      new THREE.Vector3(side * 0.043, 0.482, 0.066),
    ]);
    // Dark cloth zipper tape backing
    const tapeGeo = new THREE.TubeGeometry(zipCurve, 22, 0.0048, 6, false);
    addPart(torsoPivot, tapeGeo, seamAccentMat, 1.0, false);

    // Metallic silver zipper teeth rail right along the front open edge
    const railPts = zipCurve.getPoints(18).map((p) => new THREE.Vector3(p.x - side * 0.0032, p.y, p.z + 0.0022));
    const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 22, 0.0024, 6, false);
    addPart(torsoPivot, railGeo, zipperSilverMat, 1.0, false);
  }

  // Metallic silver zipper pull slider dangling at bottom-right open hem (matches front view!)
  const zipSliderGroup = new THREE.Group();
  zipSliderGroup.position.set(0.049, -0.040, 0.104);
  const sliderBox = new THREE.Mesh(new THREE.BoxGeometry(0.0085, 0.012, 0.007), zipperSilverMat);
  zipSliderGroup.add(sliderBox);
  const sliderTab = new THREE.Mesh(new THREE.BoxGeometry(0.0055, 0.020, 0.003), zipperSilverMat);
  sliderTab.position.set(0, -0.013, 0.003);
  sliderTab.rotation.x = 0.16;
  zipSliderGroup.add(sliderTab);
  torsoPivot.add(zipSliderGroup);

  // 3D. Left-Chest Panel Seam & Slanted Lower Welt Pockets (matches front view tailoring!)
  const chestSeamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.062, 0.330, 0.114),
    new THREE.Vector3(0.125, 0.340, 0.094),
    new THREE.Vector3(0.174, 0.354, 0.042),
  ]);
  addPart(torsoPivot, new THREE.TubeGeometry(chestSeamCurve, 12, 0.0022, 5, false), seamAccentMat, 1.0, false);

  for (const side of [-1, 1]) {
    const pocketWeltCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.092, 0.032, 0.095),
      new THREE.Vector3(side * 0.118, 0.088, 0.080),
      new THREE.Vector3(side * 0.136, 0.145, 0.056),
    ]);
    addPart(torsoPivot, new THREE.TubeGeometry(pocketWeltCurve, 10, 0.0046, 6, false), seamAccentMat, 1.0, false);
  }

  // 3E. Animated Dark Charcoal Hood Drawstrings hanging down inner lapels
  const drawstringPivots: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const dsPivot = new THREE.Group();
    dsPivot.position.set(side * 0.052, 0.456, 0.086);
    torsoPivot.add(dsPivot);

    // Tiny metallic drawstring eyelet
    const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.0045, 0.0014, 6, 12), zipperSilverMat);
    eyelet.position.set(0, 0, 0.003);
    dsPivot.add(eyelet);

    const cordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0.004),
      new THREE.Vector3(side * 0.011, -0.058, 0.022),
      new THREE.Vector3(side * 0.014, -0.132, 0.024),
      new THREE.Vector3(side * 0.012, -0.198, 0.021),
    ]);
    const cordMesh = addPart(dsPivot, new THREE.TubeGeometry(cordCurve, 16, 0.0030, 6, false), drawstringMat, 1.0, false);
    void cordMesh;

    // Metallic aglet tip at end of cord
    const aglet = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0028, 0.016, 8), zipperSilverMat);
    aglet.position.set(side * 0.012, -0.205, 0.021);
    dsPivot.add(aglet);

    drawstringPivots.push(dsPivot);
  }

  // 3F. Sculpted Folded Cloth Back Hood & Neck Collar (matches Side & Back views cleanly!)
  // Placed inside `hoodCollarGroup` so we hide it in first-person camera mode (zero clipping!)
  const hoodCollarGroup = new THREE.Group();
  torsoPivot.add(hoodCollarGroup);

  // Soft collar ring wrapping around sides & back of neck into the open hoodie lapels
  const collarFoldPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 20; i++) {
    const u = i / 20;
    const phi = Math.PI * 0.64 + u * Math.PI * 1.72; // wraps around back from left lapel to right lapel
    const backDip = Math.sin(phi) < 0 ? Math.sin(phi) * 0.020 : 0;
    collarFoldPts.push(
      new THREE.Vector3(
        Math.cos(phi) * 0.092,
        0.492 + backDip,
        Math.sin(phi) * 0.088 - 0.012
      )
    );
  }
  addPart(
    hoodCollarGroup,
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(collarFoldPts), 24, 0.024, 10, false),
    hoodieMat,
    1.02
  );

  // Sculpted draped hood body resting cleanly across upper back (V-fold silhouette in back view, plush fold in side view!)
  const hoodPivot = new THREE.Group();
  hoodPivot.position.set(0, 0.478, -0.052);
  hoodCollarGroup.add(hoodPivot);

  const hoodBodyGeo = createOrganicLoft(
    [
      {
        x: 0,
        y: -0.145,
        z: -0.056,
        rx: 0.030,
        rz: 0.014,
      },
      {
        x: 0,
        y: -0.105,
        z: -0.074,
        rx: 0.095,
        rz: 0.032,
        mod: (th, out) => {
          // Soft V-drape central gather
          const backFlat = Math.sin(th) > 0 ? 0.5 : 1.0;
          out[1] *= backFlat;
        },
      },
      {
        x: 0,
        y: -0.048,
        z: -0.088,
        rx: 0.132,
        rz: 0.052,
        mod: (th, out) => {
          if (Math.sin(th) < 0) {
            out[1] -= 0.010 * Math.cos(th * 2);
          }
        },
      },
      {
        x: 0,
        y: 0.008,
        z: -0.068,
        rx: 0.124,
        rz: 0.056,
        tiltX: 0.25,
      },
      {
        x: 0,
        y: 0.044,
        z: -0.018,
        rx: 0.096,
        rz: 0.044,
        tiltX: 0.42,
      },
    ],
    22,
    true,
    true
  );
  addPart(hoodPivot, hoodBodyGeo, hoodieMat, 1.022);

  // Dark recessed inner hood fold rim for dimensional depth in side/back profile
  const hoodCreaseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.098, 0.008, -0.052),
    new THREE.Vector3(-0.062, -0.052, -0.106),
    new THREE.Vector3(0.0, -0.072, -0.118),
    new THREE.Vector3(0.062, -0.052, -0.106),
    new THREE.Vector3(0.098, 0.008, -0.052),
  ]);
  addPart(hoodPivot, new THREE.TubeGeometry(hoodCreaseCurve, 18, 0.016, 8, false), hoodieInnerMat, 1.0, false);

  // =========================================================================
  // 4. NECK, ANIME HEAD, AMBER EYES (WITH BLINK), & LAYERED CHARCOAL HAIR
  // =========================================================================
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.494, 0.002);
  torsoPivot.add(neckPivot);

  const neckGeo = createOrganicLoft(
    [
      { x: 0, y: -0.028, z: -0.002, rx: 0.050, rz: 0.050 },
      { x: 0, y: 0.020, z: 0.001, rx: 0.042, rz: 0.044 },
      { x: 0, y: 0.070, z: 0.003, rx: 0.043, rz: 0.046 },
    ],
    18,
    true,
    true
  );
  const neckMesh = addPart(neckPivot, neckGeo, skinMat, 1.018);

  // Subtle neck shadow under chin (classic anime shading!)
  const chinShadowMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.041, 0.022, 16, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
    skinShadeMat
  );
  chinShadowMesh.position.set(0, 0.055, 0.005);
  neckPivot.add(chinShadowMesh);

  const headGroup = new THREE.Group();
  headGroup.name = 'ProtagonistHead';
  headGroup.position.set(0, 0.078, 0.008);
  neckPivot.add(headGroup);

  // 4A. Sculpted Anime Head
  const headGeo = createSculptedAnimeHeadGeometry();
  const headMesh = addPart(headGroup, headGeo, skinMat, 1.016);
  headMesh.position.set(0, 0.096, 0);

  // 4B. Sculpted Left & Right Ears with inner concha contour
  for (const side of [-1, 1]) {
    const earGroup = new THREE.Group();
    earGroup.position.set(side * 0.084, 0.086, -0.008);
    earGroup.rotation.set(0.05, side * -0.24, side * -0.14);

    const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.020, 14, 12), skinMat);
    earOuter.scale.set(0.42, 1.24, 0.78);
    outlines.addOutline(earOuter, 1.03);
    earGroup.add(earOuter);

    const earConcha = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), skinShadeMat);
    earConcha.scale.set(0.32, 0.85, 0.56);
    earConcha.position.set(side * 0.003, -0.001, 0.004);
    earGroup.add(earConcha);

    headGroup.add(earGroup);
  }

  // 4C. Expressive Warm Amber-Brown Anime Eyes (curved planes hugging face contour) + Animated Eyelids
  const eyelidMeshes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const isLeft = side < 0;
    const eyePlaneGeo = new THREE.PlaneGeometry(0.036, 0.028, 6, 4);
    // Curve the eye plane gently around the front face contour
    const ep = eyePlaneGeo.attributes.position;
    for (let i = 0; i < ep.count; i++) {
      const px = ep.getX(i);
      const py = ep.getY(i);
      ep.setZ(i, -(px * px * 5.2 + py * py * 3.0));
    }
    eyePlaneGeo.computeVertexNormals();

    const eyeMesh = new THREE.Mesh(eyePlaneGeo, isLeft ? leftEyeMat : rightEyeMat);
    eyeMesh.position.set(side * 0.032, 0.092, 0.0925);
    eyeMesh.rotation.y = side * 0.21;
    eyeMesh.rotation.x = 0.03;
    headGroup.add(eyeMesh);

    // Animated upper eyelid skin shutter for naturalistic blinking!
    const lidGeo = new THREE.PlaneGeometry(0.038, 0.026, 4, 2);
    const lp = lidGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const px = lp.getX(i);
      const py = lp.getY(i) - 0.013; // pivot at top edge of eye
      lp.setY(i, py);
      lp.setZ(i, -(px * px * 5.0) + 0.0018);
    }
    lidGeo.computeVertexNormals();
    const lidMesh = new THREE.Mesh(lidGeo, skinMat);
    lidMesh.position.set(side * 0.032, 0.104, 0.0938);
    lidMesh.rotation.y = side * 0.21;
    lidMesh.scale.y = 0.001; // open by default
    headGroup.add(lidMesh);
    eyelidMeshes.push(lidMesh);

    // Clean tapered charcoal anime eyebrow
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.014, 0.114, 0.092),
      new THREE.Vector3(side * 0.032, 0.118, 0.089),
      new THREE.Vector3(side * 0.050, 0.113, 0.081),
    ]);
    addPart(headGroup, new THREE.TubeGeometry(browCurve, 8, 0.0021, 5, false), hairDeepMat, 1.0, false);
  }

  // Calm composed closed anime mouth (slender curved line matching front view)
  const mouthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.013, 0.043, 0.0835),
    new THREE.Vector3(0.0, 0.0422, 0.0865),
    new THREE.Vector3(0.013, 0.043, 0.0835),
  ]);
  addPart(headGroup, new THREE.TubeGeometry(mouthCurve, 8, 0.0014, 5, false), lipMat, 1.0, false);

  // Subtle lower-lip shadow dimple
  const lowerLipDimple = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 8, 6), skinShadeMat);
  lowerLipDimple.scale.set(1.6, 0.35, 0.4);
  lowerLipDimple.position.set(0, 0.0355, 0.083);
  headGroup.add(lowerLipDimple);

  // 4D. Detailed Layered Charcoal-Black Messy Spiky Anime Hair (matching all 3 views!)
  const hairGroup = new THREE.Group();
  headGroup.add(hairGroup);

  // Volumetric cranial hair base hugging top, sides, and back of skull
  const scalpGeo = new THREE.SphereGeometry(0.099, 28, 22, 0, Math.PI * 2, 0, Math.PI * 0.72);
  const sp = scalpGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    let x = sp.getX(i);
    let y = sp.getY(i);
    let z = sp.getZ(i);
    // Lift crown slightly and fuller silhouette at back of head (matching side & back views)
    y *= 1.08;
    if (z < 0) {
      z *= 1.15;
      x *= 1.05;
    } else {
      z *= 1.02;
    }
    // Slight uneven messy silhouette variation
    const ang = Math.atan2(x, z);
    const fluff = 1.0 + 0.032 * Math.sin(ang * 5.0 + y * 12.0);
    x *= fluff;
    z *= fluff;
    sp.setXYZ(i, x, y, z);
  }
  scalpGeo.computeVertexNormals();
  const scalpMesh = addPart(hairGroup, scalpGeo, hairMat, 1.022);
  scalpMesh.position.set(0, 0.110, -0.007);

  // Helper to add a styled curved hair strand easily
  const addLock = (
    pts: [number, number, number][],
    w: number,
    th: number,
    deep = false
  ) => {
    const geo = createHairStrandGeometry(
      pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      w,
      th,
      10,
      6,
      0.03
    );
    addPart(hairGroup, geo, deep ? hairDeepMat : hairMat, 1.016);
  };

  // --- Front Spiky Layered Bangs (9 locks sweeping across forehead & framing eyes) ---
  // Center bangs parting softly over nose bridge
  addLock([[0.002, 0.206, 0.034], [0.008, 0.168, 0.096], [0.002, 0.122, 0.107], [-0.005, 0.095, 0.102]], 0.017, 0.009);
  addLock([[-0.014, 0.205, 0.032], [-0.022, 0.165, 0.095], [-0.020, 0.124, 0.105], [-0.013, 0.100, 0.101]], 0.016, 0.0085);
  addLock([[0.020, 0.204, 0.030], [0.030, 0.164, 0.094], [0.032, 0.124, 0.103], [0.026, 0.098, 0.098]], 0.016, 0.0085);

  // Outer forehead swept spikes
  addLock([[-0.036, 0.198, 0.025], [-0.054, 0.158, 0.086], [-0.056, 0.118, 0.094], [-0.048, 0.092, 0.090]], 0.018, 0.009);
  addLock([[0.040, 0.197, 0.024], [0.058, 0.156, 0.085], [0.060, 0.116, 0.093], [0.052, 0.090, 0.089]], 0.018, 0.009);

  // Fine layering sub-bang tips for messy anime texture
  addLock([[-0.006, 0.196, 0.052], [-0.008, 0.156, 0.103], [-0.016, 0.118, 0.108], [-0.024, 0.103, 0.103]], 0.011, 0.006, true);
  addLock([[0.015, 0.196, 0.050], [0.024, 0.154, 0.102], [0.042, 0.118, 0.100], [0.050, 0.104, 0.095]], 0.011, 0.006, true);
  addLock([[-0.058, 0.186, 0.015], [-0.078, 0.145, 0.068], [-0.080, 0.106, 0.076], [-0.072, 0.078, 0.072]], 0.017, 0.009);
  addLock([[0.058, 0.186, 0.015], [0.078, 0.145, 0.068], [0.080, 0.106, 0.076], [0.072, 0.078, 0.072]], 0.017, 0.009);

  // --- Cheek-Framing Sideburns & Temple Locks (3 per side, prominent in Front & Side views) ---
  for (const s of [-1, 1]) {
    // Front ear-tucked cheek sideburn
    addLock(
      [
        [s * 0.074, 0.174, 0.006],
        [s * 0.094, 0.128, 0.036],
        [s * 0.091, 0.084, 0.038],
        [s * 0.078, 0.046, 0.032],
      ],
      0.016,
      0.0085
    );
    // Mid-temple spiky tuft flaring slightly outward above ear
    addLock(
      [
        [s * 0.078, 0.172, -0.018],
        [s * 0.106, 0.132, -0.002],
        [s * 0.110, 0.094, -0.006],
        [s * 0.102, 0.066, -0.014],
      ],
      0.018,
      0.0095
    );
    // Behind-ear lower lock tapering neatly down toward neck
    addLock(
      [
        [s * 0.072, 0.158, -0.044],
        [s * 0.098, 0.108, -0.044],
        [s * 0.086, 0.062, -0.046],
        [s * 0.066, 0.022, -0.044],
      ],
      0.020,
      0.010,
      true
    );
  }

  // --- Back & Nape Layered Spiky Locks (11 locks for crisp messy back-view silhouette!) ---
  const backAngles = [-0.88, -0.64, -0.40, -0.18, 0.0, 0.18, 0.40, 0.64, 0.88];
  for (let bi = 0; bi < backAngles.length; bi++) {
    const a = backAngles[bi];
    const sinA = Math.sin(a);
    const cosA = Math.cos(a);
    const isCenter = Math.abs(a) < 0.25;
    const tipY = isCenter ? 0.008 : 0.016 + Math.abs(a) * 0.016;
    const flare = (bi % 2 === 0 ? 1 : -1) * 0.008;
    addLock(
      [
        [sinA * 0.066, 0.178 - Math.abs(a) * 0.018, -cosA * 0.072 - 0.006],
        [sinA * 0.096, 0.118, -cosA * 0.108 - 0.008],
        [sinA * 0.084 + flare, 0.062, -cosA * 0.096 - 0.006],
        [sinA * 0.062 + flare * 1.4, tipY, -cosA * 0.068 - 0.004],
      ],
      0.023,
      0.0115,
      bi % 2 === 1
    );
  }
  // Upper-back overlapping fluffy crown layer
  for (const bx of [-0.056, -0.018, 0.022, 0.058]) {
    addLock(
      [
        [bx * 0.7, 0.202, -0.032],
        [bx * 1.15, 0.156, -0.104],
        [bx * 1.24, 0.106, -0.120],
        [bx * 1.18, 0.076, -0.114],
      ],
      0.022,
      0.011
    );
  }

  // --- Crown Messy Lift & Signature Top Ahoge Spikes (matches all 3 views!) ---
  addLock(
    [
      [0.004, 0.210, -0.008],
      [-0.016, 0.228, -0.002],
      [-0.038, 0.236, 0.012],
      [-0.054, 0.226, 0.022],
    ],
    0.011,
    0.006
  );
  addLock(
    [
      [-0.006, 0.212, -0.014],
      [0.012, 0.234, -0.018],
      [0.032, 0.242, -0.012],
      [0.044, 0.232, -0.004],
    ],
    0.010,
    0.0055
  );
  addLock(
    [
      [0.010, 0.208, -0.024],
      [0.034, 0.224, -0.048],
      [0.056, 0.218, -0.064],
    ],
    0.012,
    0.0065
  );

  // =========================================================================
  // 5. ARTICULATED ARMS, DRAPED CHARCOAL HOODIE SLEEVES, RIBBED CUFFS & HANDS
  // =========================================================================
  interface ArmRig {
    shoulder: THREE.Group;
    elbow: THREE.Group;
    wrist: THREE.Group;
    handGroup: THREE.Group;
    fingers: { base: THREE.Group; mid: THREE.Group; tip: THREE.Group }[];
    thumb: { base: THREE.Group; tip: THREE.Group };
  }

  const buildArm = (side: -1 | 1): ArmRig => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.186, 0.420, 0.004);
    torsoPivot.add(shoulder);

    // Smooth hoodie shoulder cap
    const shoulderCap = addPart(
      shoulder,
      new THREE.SphereGeometry(0.062, 18, 14),
      hoodieMat,
      1.018
    );
    shoulderCap.scale.set(1.06, 0.94, 1.0);
    shoulderCap.position.set(-side * 0.010, -0.008, 0);

    // Upper hoodie sleeve with subtle organic cotton drape wrinkles (matching reference sleeves!)
    const upperSleeveGeo = createOrganicLoft(
      [
        { x: 0, y: 0.006, z: 0, rx: 0.059, rz: 0.059 },
        {
          x: side * 0.003,
          y: -0.088,
          z: 0.002,
          rx: 0.056,
          rz: 0.057,
          mod: (th, out) => {
            out[0] += 0.0025 * Math.sin(th * 3.0);
          },
        },
        {
          x: side * 0.002,
          y: -0.186,
          z: -0.002,
          rx: 0.053,
          rz: 0.054,
          mod: (th, out) => {
            out[1] += 0.003 * Math.cos(th * 4.0);
          },
        },
        { x: 0, y: -0.278, z: 0, rx: 0.050, rz: 0.050 },
      ],
      18,
      true,
      true
    );
    addPart(shoulder, upperSleeveGeo, hoodieMat, 1.018);

    // Elbow pivot
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.276, 0);
    shoulder.add(elbow);

    addPart(elbow, new THREE.SphereGeometry(0.049, 14, 12), hoodieMat, 1.015);

    // Forearm hoodie sleeve tapering softly into ribbed cuff
    const forearmSleeveGeo = createOrganicLoft(
      [
        { x: 0, y: 0.004, z: 0, rx: 0.050, rz: 0.050 },
        {
          x: 0,
          y: -0.090,
          z: 0.002,
          rx: 0.048,
          rz: 0.048,
          mod: (th, out) => {
            out[0] += 0.0025 * Math.cos(th * 3.0);
          },
        },
        { x: 0, y: -0.195, z: 0.002, rx: 0.046, rz: 0.045 },
        { x: 0, y: -0.214, z: 0.001, rx: 0.042, rz: 0.041 },
      ],
      18,
      true,
      true
    );
    addPart(elbow, forearmSleeveGeo, hoodieMat, 1.018);

    // Darker Ribbed Wrist Cuff (matching 3-view sheet!)
    const cuffGeo = createOrganicLoft(
      [
        { x: 0, y: -0.210, z: 0.001, rx: 0.041, rz: 0.040 },
        { x: 0, y: -0.236, z: 0.001, rx: 0.038, rz: 0.036 },
        { x: 0, y: -0.262, z: 0.001, rx: 0.035, rz: 0.032 },
      ],
      18,
      true,
      true
    );
    addPart(elbow, cuffGeo, hoodieRibMat, 1.016);

    // Bare slim wrist bridge emerging from ribbed cuff
    const wrist = new THREE.Group();
    wrist.position.set(0, -0.264, 0.001);
    elbow.add(wrist);

    const wristSkinGeo = createOrganicLoft(
      [
        { x: 0, y: 0.014, z: 0, rx: 0.027, rz: 0.021 },
        { x: 0, y: -0.014, z: 0, rx: 0.026, rz: 0.018 },
      ],
      14,
      true,
      true
    );
    addPart(wrist, wristSkinGeo, skinMat, 1.015);

    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.012, 0);
    // Neutral palm facing slightly inward toward thigh
    handGroup.rotation.y = side * -Math.PI * 0.44;
    wrist.add(handGroup);

    // Sculpted anatomical palm
    addPart(handGroup, createSculptedPalmGeometry(side), skinMat, 1.015);

    // Four articulated 3-segment fingers (Index, Middle, Ring, Pinky)
    const fingerSpecs = [
      { x: -side * 0.025, len: 0.068, r: 0.0074 },
      { x: -side * 0.008, len: 0.075, r: 0.0076 },
      { x: side * 0.009, len: 0.069, r: 0.0072 },
      { x: side * 0.025, len: 0.056, r: 0.0064 },
    ];
    const fingers: { base: THREE.Group; mid: THREE.Group; tip: THREE.Group }[] = [];
    for (const fs of fingerSpecs) {
      const base = new THREE.Group();
      base.position.set(fs.x, -0.079, 0.001);
      handGroup.add(base);
      const l1 = fs.len * 0.44;
      addPart(base, createFingerSegmentGeometry(l1, fs.r, fs.r * 0.88), skinMat, 1.012);

      const mid = new THREE.Group();
      mid.position.set(0, -l1, 0);
      base.add(mid);
      const l2 = fs.len * 0.31;
      addPart(mid, createFingerSegmentGeometry(l2, fs.r * 0.86, fs.r * 0.78), skinMat, 1.012);

      const tip = new THREE.Group();
      tip.position.set(0, -l2, 0);
      mid.add(tip);
      const l3 = fs.len * 0.25;
      addPart(tip, createFingerSegmentGeometry(l3, fs.r * 0.76, fs.r * 0.62, true), skinMat, 1.012);

      fingers.push({ base, mid, tip });
    }

    // Articulated opposable thumb
    const thumbBase = new THREE.Group();
    thumbBase.position.set(-side * 0.029, -0.032, 0.011);
    thumbBase.rotation.set(0.28, side * 0.34, -side * 0.56);
    handGroup.add(thumbBase);
    addPart(thumbBase, createFingerSegmentGeometry(0.032, 0.0092, 0.0080), skinMat, 1.012);

    const thumbTip = new THREE.Group();
    thumbTip.position.set(0, -0.030, 0);
    thumbBase.add(thumbTip);
    addPart(thumbTip, createFingerSegmentGeometry(0.026, 0.0078, 0.0064, true), skinMat, 1.012);

    return {
      shoulder,
      elbow,
      wrist,
      handGroup,
      fingers,
      thumb: { base: thumbBase, tip: thumbTip },
    };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // =========================================================================
  // 6. SLIM-STRAIGHT GREY TROUSERS & DETAILED MATTE-BLACK ATHLETIC SNEAKERS
  // =========================================================================
  interface LegRig {
    hip: THREE.Group;
    knee: THREE.Group;
    ankle: THREE.Group;
  }

  const buildLeg = (side: -1 | 1): LegRig => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.078, -0.038, 0);
    pelvisPivot.add(hip);

    // Slim-straight upper thigh trouser with natural soft knee-top drape
    const thighGeo = createOrganicLoft(
      [
        { x: 0, y: 0.028, z: 0, rx: 0.079, rz: 0.084 },
        { x: side * 0.002, y: -0.090, z: 0.002, rx: 0.074, rz: 0.078 },
        { x: side * 0.001, y: -0.220, z: 0.002, rx: 0.066, rz: 0.069 },
        {
          x: 0,
          y: -0.340,
          z: 0.001,
          rx: 0.061,
          rz: 0.064,
          mod: (th, out) => {
            // Subtle knee-back fabric crease
            if (Math.sin(th) < -0.3) {
              out[1] += 0.003 * Math.cos(th * 3.0);
            }
          },
        },
        { x: 0, y: -0.398, z: 0, rx: 0.058, rz: 0.060 },
      ],
      20,
      true,
      true
    );
    addPart(hip, thighGeo, pantMat, 1.018);

    // Knee pivot (Y = 0.875 - 0.038 - 0.392 = 0.445)
    const knee = new THREE.Group();
    knee.position.set(0, -0.392, 0);
    hip.add(knee);

    addPart(knee, new THREE.SphereGeometry(0.057, 14, 12), pantMat, 1.015);

    // Lower leg slim-straight trouser tapering slightly toward ankle cuff with subtle stacking fold
    const shinGeo = createOrganicLoft(
      [
        { x: 0, y: 0.004, z: 0, rx: 0.058, rz: 0.060 },
        { x: 0, y: -0.115, z: -0.004, rx: 0.057, rz: 0.059 },
        { x: 0, y: -0.255, z: -0.004, rx: 0.052, rz: 0.054 },
        {
          x: 0,
          y: -0.340,
          z: 0.001,
          rx: 0.053,
          rz: 0.055,
          mod: (th, out) => {
            // Subtle trouser hem break resting above sneaker tongue
            out[0] += 0.002 * Math.sin(th * 4.0);
          },
        },
        { x: 0, y: -0.362, z: 0.002, rx: 0.050, rz: 0.052 },
      ],
      20,
      true,
      true
    );
    addPart(knee, shinGeo, pantMat, 1.018);

    // Dark charcoal sock ankle core inside hem so there is zero gap when walking
    const sockAnkle = addPart(
      knee,
      new THREE.CylinderGeometry(0.037, 0.036, 0.065, 14),
      sockDarkMat,
      1.0,
      false
    );
    sockAnkle.position.set(0, -0.368, 0.0);

    // Ankle pivot (Y = 0.875 - 0.038 - 0.392 - 0.358 = 0.087)
    const ankle = new THREE.Group();
    ankle.position.set(0, -0.358, 0);
    knee.add(ankle);

    // --- Detailed 8-Part Matte-Black Modern Athletic Sneaker (ground at local Y = -0.087) ---
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(0, -0.087, 0.032);
    ankle.add(shoeGroup);

    // 1. Sculpted Chunky Athletic Outsole & Midsole (sits flush at Y = 0.000!)
    const soleShape = new THREE.Shape();
    soleShape.moveTo(-0.044, -0.094);
    soleShape.bezierCurveTo(-0.048, -0.025, -0.053, 0.050, -0.047, 0.118);
    soleShape.bezierCurveTo(-0.038, 0.156, 0.038, 0.156, 0.047, 0.118);
    soleShape.bezierCurveTo(0.053, 0.050, 0.048, -0.025, 0.044, -0.094);
    soleShape.bezierCurveTo(0.034, -0.118, -0.034, -0.118, -0.044, -0.094);

    const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
      depth: 0.028,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.0035,
      bevelSegments: 2,
    });
    soleGeo.rotateX(Math.PI / 2);
    const soleMesh = addPart(shoeGroup, soleGeo, sneakerSoleMat, 1.02);
    soleMesh.position.set(0, 0.032, 0);

    // 2. Sculpted Matte-Black Woven Sneaker Upper & Rounded Toe Box
    const upperGeo = createOrganicLoft(
      [
        { x: 0, y: 0.026, z: 0.015, rx: 0.045, rz: 0.125 },
        { x: 0, y: 0.046, z: 0.012, rx: 0.044, rz: 0.118 },
        { x: 0, y: 0.068, z: -0.008, rx: 0.041, rz: 0.094 },
        { x: 0, y: 0.088, z: -0.026, rx: 0.038, rz: 0.060 },
      ],
      20,
      true,
      true
    );
    addPart(shoeGroup, upperGeo, sneakerUpperMat, 1.02);

    // 3. Reinforced Toe Cap Mudguard Overlay
    const toeOverlay = addPart(
      shoeGroup,
      new THREE.SphereGeometry(0.044, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      sneakerOverlayMat,
      1.015
    );
    toeOverlay.scale.set(1.0, 0.62, 1.24);
    toeOverlay.position.set(0, 0.030, 0.088);

    // 4. Sculpted Heel Counter Cup (side & back detail)
    const heelCup = addPart(
      shoeGroup,
      new THREE.CylinderGeometry(0.042, 0.045, 0.056, 16, 1, false, Math.PI * 0.55, Math.PI * 0.9),
      sneakerOverlayMat,
      1.016
    );
    heelCup.position.set(0, 0.056, -0.054);

    // 5. Padded Ankle Collar Ring
    const collarRing = addPart(
      shoeGroup,
      new THREE.TorusGeometry(0.039, 0.011, 8, 18),
      sneakerOverlayMat,
      1.015
    );
    collarRing.rotation.x = Math.PI / 2 + 0.14;
    collarRing.scale.set(0.95, 1.18, 1.0);
    collarRing.position.set(0, 0.086, -0.036);

    // 6. Padded Sneaker Tongue rising beneath trouser cuff
    const tongueGeo = new THREE.BoxGeometry(0.044, 0.068, 0.014);
    const tongueMesh = addPart(shoeGroup, tongueGeo, sneakerUpperMat, 1.015);
    tongueMesh.position.set(0, 0.078, 0.022);
    tongueMesh.rotation.x = -0.58;

    // 7. Four Crossed Matte-Black Shoelace Bars across vamp
    for (let li = 0; li < 4; li++) {
      const t = li / 3;
      const ly = 0.053 + t * 0.026;
      const lz = 0.064 - t * 0.042;
      const lw = 0.044 - t * 0.005;
      for (const cross of [-1, 1]) {
        const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, lw, 6), laceMat);
        lace.position.set(0, ly, lz);
        lace.rotation.z = Math.PI / 2;
        lace.rotation.y = cross * 0.24;
        shoeGroup.add(lace);
      }
    }

    // 8. Signature Rear Heel Pull-Tab Loop (matches Side & Back reference views!)
    const pullTabCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.076, -0.086),
      new THREE.Vector3(0, 0.095, -0.099),
      new THREE.Vector3(0, 0.106, -0.092),
      new THREE.Vector3(0, 0.092, -0.078),
    ]);
    addPart(
      shoeGroup,
      new THREE.TubeGeometry(pullTabCurve, 10, 0.0042, 6, false),
      laceMat,
      1.02
    );

    return { hip, knee, ankle };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Seated Xbox controller mesh anchored to bodyGroup and dynamically positioned between palms
  const seatedControllerGroup = buildXboxControllerMesh(uniforms, 'white', outlines, {
    addOutline: true,
    isDynamic: true,
  });
  seatedControllerGroup.visible = false;
  bodyGroup.add(seatedControllerGroup);

  // Zero-GC scratch vectors for dynamic controller placement
  const _padLeftPos = new THREE.Vector3();
  const _padRightPos = new THREE.Vector3();
  const _padMidPos = new THREE.Vector3();

  // =========================================================================
  // 7. TRIANGLE COUNT & RENDER PASS MODE VISIBILITY (First-Person vs Mirror)
  // =========================================================================
  let triangleCount = 0;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.geometry) {
      const idx = obj.geometry.getIndex();
      if (idx) {
        triangleCount += idx.count / 3;
      } else {
        const pos = obj.geometry.attributes.position;
        if (pos) triangleCount += pos.count / 3;
      }
    }
  });
  triangleCount = Math.round(triangleCount);

  let currentRenderPassMode: 'first-person' | 'overview' | 'mirror' = 'first-person';
  let lastPitch = 0;
  let lastSeatedOnSofa = false;

  const setRenderPassMode = (mode: 'first-person' | 'overview' | 'mirror') => {
    currentRenderPassMode = mode;
    if (mode === 'first-person') {
      // Position body slightly BEHIND eye center (local -Z = behind forward gaze!)
      // When seated on the sofa, keep the body visible (without head/neck blocking the camera)
      // so protagonist's real seated hoodie torso, legs, sneakers, arms & controller appear naturally.
      headGroup.visible = false;
      neckMesh.visible = false;
      chinShadowMesh.visible = false;
      hoodCollarGroup.visible = false;
      teeCollarMesh.visible = false;
      bodyGroup.position.set(0, 0, lastSeatedOnSofa ? -0.18 : -0.20);
      bodyGroup.visible = lastSeatedOnSofa || lastPitch <= -0.58 || reachTimer > 0.01;
    } else {
      bodyGroup.visible = true;
      headGroup.visible = true;
      neckMesh.visible = true;
      chinShadowMesh.visible = true;
      hoodCollarGroup.visible = true;
      teeCollarMesh.visible = true;
      bodyGroup.position.set(0, 0, 0);
    }
  };

  // =========================================================================
  // 8. UPGRADED LIFELIKE MULTI-JOINT ANIMATION STATE (Zero per-frame GC!)
  // =========================================================================
  let walkPhase = 0;
  let moveBlend = 0;
  let reachTimer = 0;
  let reachStrength = 0;

  // Natural eye-blink state
  let blinkCooldown = 2.8;
  let blinkElapsed = -1;
  let pendingDoubleBlink = false;

  // Yaw-velocity turning anticipation (smooth head lead & torso follow)
  let prevYaw = 0;
  let yawInitialized = false;
  let smoothYawVel = 0;
  let headLeadYaw = 0;
  let torsoLagYaw = 0;

  // Smoothed seated arm angles (zero-GC state) for seamless rest <-> reach <-> holding transitions
  let lShX = -0.42;
  let lShY = 0.14;
  let lShZ = -0.06;
  let lElX = -0.96;
  let lWrX = -0.04;
  let lHandY = Math.PI * 0.44;
  let rShX = -0.42;
  let rShY = -0.14;
  let rShZ = 0.06;
  let rElX = -0.96;
  let rWrX = -0.04;
  let rHandY = -Math.PI * 0.44;
  let lCurl = 0.24;
  let rCurl = 0.24;

  const triggerHandReach = (strength = 1.0) => {
    reachTimer = 0.62;
    reachStrength = THREE.MathUtils.clamp(strength, 0.4, 1.3);
  };

  const applyHandCurl = (arm: ArmRig, curl: number) => {
    for (let fi = 0; fi < arm.fingers.length; fi++) {
      const cascade = 0.82 + fi * 0.12;
      arm.fingers[fi].base.rotation.x = curl * 0.75 * cascade;
      arm.fingers[fi].mid.rotation.x = curl * 1.08 * cascade;
      arm.fingers[fi].tip.rotation.x = curl * 0.65 * cascade;
    }
    arm.thumb.tip.rotation.x = curl * 0.45;
  };

  const update = (dt: number, elapsed: number, params: ProtagonistUpdateParams) => {
    const safeDt = Math.min(dt, 0.05);
    lastPitch = params.pitch;
    const isSeatedOnSofa = Boolean(params.seatedOnSofa);
    lastSeatedOnSofa = isSeatedOnSofa;
    root.visible = !params.hideAll;
    if (params.hideAll) {
      seatedControllerGroup.visible = false;
      return;
    }

    // Position & facing alignment (character local +Z faces forward; camera looks along -Z)
    root.position.copy(params.feetPos);
    const bodyYaw =
      isSeatedOnSofa && params.sofaBaseYaw !== undefined ? params.sofaBaseYaw : params.yaw;
    root.rotation.set(0, bodyYaw + Math.PI, 0);

    // Wrapped yaw velocity for realistic turning anticipation
    if (!yawInitialized) {
      prevYaw = params.yaw;
      yawInitialized = true;
    }
    let dYaw = params.yaw - prevYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    prevYaw = params.yaw;

    const rawYawVel = safeDt > 1e-4 ? THREE.MathUtils.clamp(dYaw / safeDt, -5.5, 5.5) : 0;
    const dampVel = 1 - Math.exp(-10 * safeDt);
    smoothYawVel += (rawYawVel - smoothYawVel) * dampVel;

    const leadDamp = 1 - Math.exp(-8.5 * safeDt);
    headLeadYaw += (THREE.MathUtils.clamp(smoothYawVel * 0.095, -0.26, 0.26) - headLeadYaw) * leadDamp;
    torsoLagYaw += (THREE.MathUtils.clamp(-smoothYawVel * 0.055, -0.15, 0.15) - torsoLagYaw) * leadDamp;

    // Smooth locomotion blend
    const speedFactor = THREE.MathUtils.clamp(params.walkSpeed / 2.6, 0, 1.45);
    const targetMove = !isSeatedOnSofa && params.isMoving ? Math.max(0.28, speedFactor) : 0;
    moveBlend += (targetMove - moveBlend) * Math.min(1, safeDt * 9.5);

    if (moveBlend > 0.01) {
      walkPhase += safeDt * (5.6 + speedFactor * 3.1);
    }

    // Interaction hand reach envelope
    if (reachTimer > 0) {
      reachTimer = Math.max(0, reachTimer - safeDt);
    }
    const reachCurve =
      reachTimer > 0 ? Math.sin((1 - reachTimer / 0.62) * Math.PI) * reachStrength : 0;

    // Natural irregular eye blinking (with occasional gentle double-blink)
    if (blinkElapsed >= 0) {
      blinkElapsed += safeDt;
      const blinkDur = 0.165;
      if (blinkElapsed >= blinkDur) {
        blinkElapsed = -1;
        for (let i = 0; i < eyelidMeshes.length; i++) {
          eyelidMeshes[i].scale.y = 0.001;
        }
        if (pendingDoubleBlink) {
          pendingDoubleBlink = false;
          blinkCooldown = 0.14;
        } else {
          blinkCooldown = 3.0 + ((Math.sin(elapsed * 1.73) * 0.5 + 0.5) * 3.2);
          pendingDoubleBlink = Math.sin(elapsed * 4.31) > 0.68;
        }
      } else {
        // Fast close, slightly gentler reopen
        const p = blinkElapsed / blinkDur;
        const closeAmt = p < 0.42 ? p / 0.42 : 1 - (p - 0.42) / 0.58;
        const lidScale = 0.001 + Math.pow(THREE.MathUtils.clamp(closeAmt, 0, 1), 0.7) * 1.05;
        for (let i = 0; i < eyelidMeshes.length; i++) {
          eyelidMeshes[i].scale.y = lidScale;
        }
      }
    } else {
      blinkCooldown -= safeDt;
      if (blinkCooldown <= 0) {
        blinkElapsed = 0;
      }
    }

    const breath = Math.sin(elapsed * 1.55);
    const idleShift = Math.sin(elapsed * 0.62);
    const idleCuriosity = Math.sin(elapsed * 0.47 + 0.8);

    if (isSeatedOnSofa) {
      // Keep full body (minus head/neck in FP) visible and offset slightly back so legs/arms frame naturally
      if (currentRenderPassMode === 'first-person') {
        bodyGroup.visible = true;
        bodyGroup.position.set(0, 0, -0.18);
      }

      let relYaw = params.yaw - (params.sofaBaseYaw ?? params.yaw);
      while (relYaw > Math.PI) relYaw -= Math.PI * 2;
      while (relYaw < -Math.PI) relYaw += Math.PI * 2;

      // Pelvis & torso seated comfortably on the living room sofa cushion (`y = 0.495`)
      pelvisPivot.position.set(0, 0.530 + breath * 0.0018, -0.02);
      pelvisPivot.rotation.set(0, 0, 0);

      torsoPivot.rotation.set(
        -0.08 + breath * 0.008,
        THREE.MathUtils.clamp(relYaw * 0.22, -0.26, 0.26),
        idleShift * 0.008
      );
      torsoPivot.scale.set(1, 1, 1 + breath * 0.007);

      for (let i = 0; i < drawstringPivots.length; i++) {
        const side = i === 0 ? -1 : 1;
        drawstringPivots[i].rotation.x = 0.08 + breath * 0.012;
        drawstringPivots[i].rotation.z = side * 0.014;
      }
      hoodPivot.rotation.x = -0.04 + breath * 0.008;

      headGroup.rotation.set(
        THREE.MathUtils.clamp(-params.pitch * 0.48, -0.34, 0.34) + breath * 0.008,
        THREE.MathUtils.clamp(relYaw * 0.52, -0.58, 0.58),
        idleCuriosity * 0.018
      );

      // Seated thighs resting on cushion, shins vertical, sneakers flush on living room floor
      leftLeg.hip.rotation.set(-1.46, 0.08, -0.04);
      leftLeg.knee.rotation.set(1.46, 0, 0);
      leftLeg.ankle.rotation.set(0.04, 0, 0);

      rightLeg.hip.rotation.set(-1.46, -0.08, 0.04);
      rightLeg.knee.rotation.set(1.46, 0, 0);
      rightLeg.ankle.rotation.set(0.04, 0, 0);

      // Compute smooth target arm poses across `none` (lap rest) -> `reaching` -> `holding`
      const coPlayMode = params.coPlayMode ?? 'none';
      const reachP = THREE.MathUtils.clamp(params.coPlayReachProgress ?? 0, 0, 1);
      const inX = THREE.MathUtils.clamp(params.coPlayInputX ?? 0, -1, 1);
      const inY = THREE.MathUtils.clamp(params.coPlayInputY ?? 0, -1, 1);
      const pulse = THREE.MathUtils.clamp(params.coPlayActionPulse ?? 0, 0, 1.2);

      let tLShX = -0.44 + breath * 0.012;
      let tLShY = 0.16;
      let tLShZ = -0.08;
      let tLElX = -0.96 - breath * 0.015;
      let tLWrX = -0.04;
      let tLHandY = Math.PI * 0.44;
      let tLCurl = 0.24 + breath * 0.02;

      let tRShX = -0.44 + breath * 0.012;
      let tRShY = -0.16;
      let tRShZ = 0.08;
      let tRElX = -0.96 - breath * 0.015;
      let tRWrX = -0.04;
      let tRHandY = -Math.PI * 0.44;
      let tRCurl = 0.24 + breath * 0.02;

      let showController = false;

      if (coPlayMode === 'reaching') {
        if (reachP < 0.54) {
          const ext = Math.sin((reachP / 0.54) * Math.PI * 0.5);
          // Right arm (+X -> toward heroine on left side of sofa) reaches out from hoodie sleeve
          tRShX = THREE.MathUtils.lerp(-0.44, -1.24, ext);
          tRShY = THREE.MathUtils.lerp(-0.16, 0.16, ext);
          tRShZ = THREE.MathUtils.lerp(0.08, -0.04, ext);
          tRElX = THREE.MathUtils.lerp(-0.96, -0.34, ext);
          tRWrX = THREE.MathUtils.lerp(-0.04, -0.16, ext);
          tRHandY = THREE.MathUtils.lerp(-Math.PI * 0.44, -Math.PI * 0.24, ext);
          tRCurl = THREE.MathUtils.lerp(0.24, 0.06, ext);
          // Left arm rises slightly ready to receive controller with both hands
          tLShX = THREE.MathUtils.lerp(-0.44, -0.58, ext);
          tLShY = THREE.MathUtils.lerp(0.16, 0.28, ext);
          tLElX = THREE.MathUtils.lerp(-0.96, -1.22, ext);
          tLCurl = THREE.MathUtils.lerp(0.24, 0.14, ext);
        } else {
          showController = true;
          const pull = (reachP - 0.54) / 0.46;
          const smoothPull = pull * pull * (3 - 2 * pull);
          tRShX = THREE.MathUtils.lerp(-1.24, -0.64, smoothPull);
          tRShY = THREE.MathUtils.lerp(0.16, -0.32, smoothPull);
          tRShZ = THREE.MathUtils.lerp(-0.04, 0.06, smoothPull);
          tRElX = THREE.MathUtils.lerp(-0.34, -1.34, smoothPull);
          tRWrX = -0.16;
          tRHandY = THREE.MathUtils.lerp(-Math.PI * 0.24, -Math.PI * 0.36, smoothPull);
          tRCurl = THREE.MathUtils.lerp(0.12, 0.56, smoothPull);

          tLShX = THREE.MathUtils.lerp(-0.58, -0.64, smoothPull);
          tLShY = THREE.MathUtils.lerp(0.28, 0.32, smoothPull);
          tLShZ = -0.06;
          tLElX = THREE.MathUtils.lerp(-1.22, -1.34, smoothPull);
          tLWrX = -0.16;
          tLHandY = Math.PI * 0.36;
          tLCurl = THREE.MathUtils.lerp(0.14, 0.56, smoothPull);
        }
      } else if (coPlayMode === 'holding') {
        showController = true;
        const tilt = inX * 0.07 + pulse * 0.09;
        tLShX = -0.64 - inY * 0.025 + tilt * 0.35 + breath * 0.01;
        tLShY = 0.32;
        tLShZ = -0.06;
        tLElX = -1.34 + pulse * 0.06;
        tLWrX = -0.16 - pulse * 0.05;
        tLHandY = Math.PI * 0.36;
        tLCurl = 0.58;

        tRShX = -0.64 - inY * 0.025 - tilt * 0.35 + breath * 0.01;
        tRShY = -0.32;
        tRShZ = 0.06;
        tRElX = -1.34 + pulse * 0.06;
        tRWrX = -0.16 - pulse * 0.05;
        tRHandY = -Math.PI * 0.36;
        tRCurl = 0.58;
      }

      const armDamp = 9.5;
      lShX = THREE.MathUtils.damp(lShX, tLShX, armDamp, safeDt);
      lShY = THREE.MathUtils.damp(lShY, tLShY, armDamp, safeDt);
      lShZ = THREE.MathUtils.damp(lShZ, tLShZ, armDamp, safeDt);
      lElX = THREE.MathUtils.damp(lElX, tLElX, armDamp, safeDt);
      lWrX = THREE.MathUtils.damp(lWrX, tLWrX, armDamp, safeDt);
      lHandY = THREE.MathUtils.damp(lHandY, tLHandY, armDamp, safeDt);
      lCurl = THREE.MathUtils.damp(lCurl, tLCurl, armDamp, safeDt);

      rShX = THREE.MathUtils.damp(rShX, tRShX, armDamp, safeDt);
      rShY = THREE.MathUtils.damp(rShY, tRShY, armDamp, safeDt);
      rShZ = THREE.MathUtils.damp(rShZ, tRShZ, armDamp, safeDt);
      rElX = THREE.MathUtils.damp(rElX, tRElX, armDamp, safeDt);
      rWrX = THREE.MathUtils.damp(rWrX, tRWrX, armDamp, safeDt);
      rHandY = THREE.MathUtils.damp(rHandY, tRHandY, armDamp, safeDt);
      rCurl = THREE.MathUtils.damp(rCurl, tRCurl, armDamp, safeDt);

      leftArm.shoulder.rotation.set(lShX, lShY, lShZ);
      leftArm.elbow.rotation.set(lElX, 0, 0);
      leftArm.wrist.rotation.set(lWrX, 0, -0.04);
      leftArm.handGroup.rotation.y = lHandY;
      applyHandCurl(leftArm, lCurl);

      rightArm.shoulder.rotation.set(rShX, rShY, rShZ);
      rightArm.elbow.rotation.set(rElX, 0, 0);
      rightArm.wrist.rotation.set(rWrX, 0, 0.04);
      rightArm.handGroup.rotation.y = rHandY;
      applyHandCurl(rightArm, rCurl);

      if (showController) {
        bodyGroup.updateMatrixWorld(true);
        leftArm.handGroup.getWorldPosition(_padLeftPos);
        rightArm.handGroup.getWorldPosition(_padRightPos);
        _padMidPos.addVectors(_padLeftPos, _padRightPos).multiplyScalar(0.5);
        bodyGroup.worldToLocal(_padMidPos);
        seatedControllerGroup.visible = true;
        seatedControllerGroup.position.set(
          _padMidPos.x,
          _padMidPos.y - 0.024,
          _padMidPos.z + 0.030
        );
        seatedControllerGroup.rotation.set(
          -0.46 + (params.coPlayInputY ?? 0) * 0.05 + (params.coPlayActionPulse ?? 0) * 0.10,
          0,
          -(params.coPlayInputX ?? 0) * 0.14
        );
      } else {
        seatedControllerGroup.visible = false;
      }
      return;
    }

    // Standing / walking path: ensure seated controller stays hidden and handGroup resting yaw restored
    seatedControllerGroup.visible = false;
    leftArm.handGroup.rotation.y = Math.PI * 0.44;
    rightArm.handGroup.rotation.y = -Math.PI * 0.44;

    // Core harmonic signals
    const sinW = Math.sin(walkPhase);
    const cosW = Math.cos(walkPhase);
    const sin2W = Math.sin(walkPhase * 2);
    const cos2W = Math.cos(walkPhase * 2);

    // 1. Pelvis: double-frequency vertical stride bounce + subtle weight shift & hip drop
    const walkBob = Math.abs(sinW) * 0.028 * moveBlend;
    const idleWeightX = idleShift * 0.009 * (1 - moveBlend);
    pelvisPivot.position.y = 0.875 + walkBob + breath * 0.0028 * (1 - moveBlend * 0.5);
    pelvisPivot.position.x = sinW * 0.014 * moveBlend + idleWeightX;
    pelvisPivot.rotation.y = sinW * 0.088 * moveBlend + torsoLagYaw * 0.45;
    pelvisPivot.rotation.z =
      -sinW * 0.036 * moveBlend + idleShift * 0.016 * (1 - moveBlend);

    // 2. Torso: counter-rotation against hips + gentle breathing pitch + subtle forward lean when sprinting
    torsoPivot.rotation.y = -sinW * 0.105 * moveBlend + torsoLagYaw * 0.7;
    const rawTorsoPitch =
      0.015 + 0.055 * moveBlend + breath * 0.012 * (1 - moveBlend * 0.4) + reachCurve * 0.07;
    torsoPivot.rotation.x = currentRenderPassMode === 'first-person' ? Math.min(0, rawTorsoPitch) : rawTorsoPitch;
    torsoPivot.rotation.z =
      sinW * 0.022 * moveBlend - idleShift * 0.012 * (1 - moveBlend);

    // Keep FP body cleanly hidden during normal forward gaze; reveal smoothly when looking down or reaching
    if (currentRenderPassMode === 'first-person') {
      bodyGroup.position.set(0, 0, -0.20);
      bodyGroup.visible = lastPitch <= -0.58 || reachTimer > 0.01;
    }

    // Subtle chest breathing micro-scale
    const chestBreathScale = 1 + breath * 0.008;
    torsoPivot.scale.set(1, 1, chestBreathScale);

    // 3. Secondary Motion: Swinging Dark Drawstrings & Soft Back-Hood Bounce
    const strideAccel = cos2W * 0.08 * moveBlend;
    for (let i = 0; i < drawstringPivots.length; i++) {
      const side = i === 0 ? -1 : 1;
      drawstringPivots[i].rotation.x =
        0.04 + strideAccel * 1.15 + Math.sin(walkPhase - 0.6) * 0.05 * moveBlend + breath * 0.016;
      drawstringPivots[i].rotation.z =
        side * (0.012 + Math.cos(walkPhase - 0.4) * 0.045 * moveBlend) - smoothYawVel * 0.035;
    }
    hoodPivot.rotation.x = -0.02 + Math.max(0, sin2W) * 0.048 * moveBlend + breath * 0.012;

    // 4. Head & Neck: follows look pitch + natural turn anticipation + gentle idle curiosity
    const clampedPitch = THREE.MathUtils.clamp(-params.pitch * 0.48, -0.34, 0.34);
    headGroup.rotation.x =
      clampedPitch +
      breath * 0.011 * (1 - moveBlend * 0.4) -
      sin2W * 0.015 * moveBlend;
    headGroup.rotation.y =
      headLeadYaw + idleCuriosity * 0.055 * (1 - moveBlend);
    headGroup.rotation.z =
      -headLeadYaw * 0.18 + Math.sin(elapsed * 0.39) * 0.022 * (1 - moveBlend);

    // 5. Legs & Sneakers: natural stride, knee swing clearance & heel-strike / toe-off ankle roll
    const strideAmp = 0.44 * moveBlend;
    const leftHipX = sinW * strideAmp;
    const rightHipX = -sinW * strideAmp;

    // Knee bends most cleanly during swing phase & softens on weight acceptance
    const leftKneeX =
      Math.max(0, -cosW) * 0.62 * moveBlend + Math.max(0, sinW) * 0.14 * moveBlend;
    const rightKneeX =
      Math.max(0, cosW) * 0.62 * moveBlend + Math.max(0, -sinW) * 0.14 * moveBlend;

    // Sneaker ankle articulation (dorsiflex on heel strike, plantarflex on toe push-off)
    const leftAnkleX =
      (-sinW * 0.24 - Math.max(0, -cosW) * 0.16) * moveBlend;
    const rightAnkleX =
      (sinW * 0.24 - Math.max(0, cosW) * 0.16) * moveBlend;

    leftLeg.hip.rotation.set(leftHipX, 0.03, -0.018 - idleShift * 0.012 * (1 - moveBlend));
    leftLeg.knee.rotation.set(leftKneeX, 0, 0);
    leftLeg.ankle.rotation.set(leftAnkleX, 0, 0);

    rightLeg.hip.rotation.set(rightHipX, -0.03, 0.018 - idleShift * 0.012 * (1 - moveBlend));
    rightLeg.knee.rotation.set(rightKneeX, 0, 0);
    rightLeg.ankle.rotation.set(rightAnkleX, 0, 0);

    // 6. Arms & Hands: natural counter-swing with elbow lag, breathing shoulder poise & reach
    const armSwing = 0.34 * moveBlend;
    const leftShoulderX = -sinW * armSwing + 0.035;
    const leftElbowX = -(0.16 + Math.max(0, -sinW) * 0.26 * moveBlend + breath * 0.018);

    leftArm.shoulder.rotation.set(
      leftShoulderX,
      0.04,
      -0.085 - breath * 0.010
    );
    leftArm.elbow.rotation.set(leftElbowX, 0, 0);
    leftArm.wrist.rotation.set(0.05 * moveBlend, 0, -0.04);

    // Right arm carries the interaction reach gesture
    const rightShoulderX =
      sinW * armSwing + 0.035 - reachCurve * 0.88;
    const rightShoulderZ =
      0.085 + breath * 0.010 - reachCurve * 0.14;
    const rightElbowX =
      -(0.16 + Math.max(0, sinW) * 0.26 * moveBlend + breath * 0.018 + reachCurve * 0.44);

    rightArm.shoulder.rotation.set(rightShoulderX, -0.04 + reachCurve * 0.14, rightShoulderZ);
    rightArm.elbow.rotation.set(rightElbowX, 0, 0);
    rightArm.wrist.rotation.set(
      0.05 * moveBlend - reachCurve * 0.16,
      reachCurve * 0.28,
      0.04
    );

    // Sync seated arm targets smoothly to relaxed idle so sitting down is always seamless
    lShX = -0.44;
    lShY = 0.16;
    lShZ = -0.08;
    lElX = -0.96;
    rShX = -0.44;
    rShY = -0.16;
    rShZ = 0.08;
    rElX = -0.96;

    // Relaxed natural anime finger curl (softens open during reach!)
    const baseCurl = (0.24 + breath * 0.028) * (1 - reachCurve * 0.72);
    applyHandCurl(leftArm, 0.24 + breath * 0.025);
    applyHandCurl(rightArm, baseCurl);
  };

  setRenderPassMode('first-person');

  return {
    root,
    headGroup,
    bodyGroup,
    leftHandGroup: leftArm.handGroup,
    rightHandGroup: rightArm.handGroup,
    triangleCount,
    setRenderPassMode,
    triggerHandReach,
    update,
  };
}
