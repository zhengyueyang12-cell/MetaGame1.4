import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { OutlineRegistry } from './pipeline';

/**
 * Creates a RoundedBoxGeometry with safe radius clamping so every furniture
 * piece, trim board, appliance, and prop has smooth beveled edges that catch
 * specular and Fresnel rim highlights.
 */
export function createBeveledBox(
  width: number,
  height: number,
  depth: number,
  radius = 0.025,
  segments = 3
): RoundedBoxGeometry {
  const maxR = Math.min(width, height, depth) * 0.42;
  const r = Math.min(radius, maxR);
  return new RoundedBoxGeometry(width, height, depth, segments, r);
}

/**
 * Creates a soft, plump, stylized cushion / pillow / mattress geometry by
 * deforming a subdivided RoundedBoxGeometry with a cosine pillow-puff profile
 * and subtle seam pinch.
 */
export function createPlushBox(
  width: number,
  height: number,
  depth: number,
  radius = 0.05,
  puff = 0.14
): THREE.BufferGeometry {
  const maxR = Math.min(width, height, depth) * 0.44;
  const geo = new RoundedBoxGeometry(
    width,
    height,
    depth,
    6,
    Math.min(radius, maxR)
  );
  const pos = geo.attributes.position;
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const nx = hw > 1e-4 ? x / hw : 0;
    const ny = hh > 1e-4 ? y / hh : 0;
    const nz = hd > 1e-4 ? z / hd : 0;

    const cx = Math.cos(nx * Math.PI * 0.48);
    const cy = Math.cos(ny * Math.PI * 0.48);
    const cz = Math.cos(nz * Math.PI * 0.48);

    // Bulge center of top/bottom/front/back while keeping corners tucked
    const swellX = 1 + puff * 0.35 * cy * cz;
    const swellY = 1 + puff * cx * cz;
    const swellZ = 1 + puff * 0.55 * cx * cy;

    pos.setXYZ(i, x * swellX, y * swellY, z * swellZ);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a plump upholstered sofa or armchair cushion with a 3D central
 * button-tuft dimple, 4 radiating diagonal X-crease folds, perimeter seam
 * piping swell, and clean planar UV mapping on the primary face so UV-baked
 * wrinkle & tuft maps align with the 3D cushion center.
 */
export function createTuftedCushionGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.055,
  puff = 0.16,
  tuftAxis: 'y' | 'z' | 'x' = 'z',
  tuftDepth = 0.032
): THREE.BufferGeometry {
  const maxR = Math.min(width, height, depth) * 0.44;
  const geo = new RoundedBoxGeometry(
    width,
    height,
    depth,
    18,
    Math.min(radius, maxR)
  );
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = hw > 1e-4 ? x / hw : 0;
    const ny = hh > 1e-4 ? y / hh : 0;
    const nz = hd > 1e-4 ? z / hd : 0;

    const cx = Math.cos(nx * Math.PI * 0.48);
    const cy = Math.cos(ny * Math.PI * 0.48);
    const cz = Math.cos(nz * Math.PI * 0.48);

    // Base pillow loft swell
    x *= 1 + puff * 0.36 * cy * cz;
    y *= 1 + puff * 0.88 * cx * cz;
    z *= 1 + puff * 0.68 * cx * cy;

    // 2D coordinates on the tufted face
    let uFace = nx;
    let vFace = ny;
    let faceWeight = Math.max(0, Math.abs(nz) - 0.30) / 0.70;
    if (tuftAxis === 'y') {
      uFace = nx;
      vFace = nz;
      faceWeight = Math.max(0, Math.abs(ny) - 0.30) / 0.70;
    } else if (tuftAxis === 'x') {
      uFace = nz;
      vFace = ny;
      faceWeight = Math.max(0, Math.abs(nx) - 0.30) / 0.70;
    }

    const rSq = uFace * uFace + vFace * vFace;
    const rDist = Math.sqrt(rSq);
    const angle = Math.atan2(vFace, uFace);

    // Soft 3D central button pull-in dimple + puffed 4-lobe upholstery crown
    const buttonDimple = Math.exp(-rSq / 0.044);
    const crownRingSwell = Math.exp(-Math.pow(rDist - 0.38, 2) / 0.072) * 0.44;

    // Classic cross-tuft valleys (十字拉扣微凹: horizontal + vertical + diagonal X tension creases)
    const crossU = Math.abs(uFace);
    const crossV = Math.abs(vFace);
    const crossCrease =
      (Math.exp(-(crossU * crossU) / 0.015) + Math.exp(-(crossV * crossV) / 0.015)) *
      Math.exp(-rDist * 1.18) *
      (1.0 - Math.exp(-rSq / 0.007));

    const diag1 = Math.abs(uFace - vFace) / Math.SQRT2;
    const diag2 = Math.abs(uFace + vFace) / Math.SQRT2;
    const xCrease =
      (Math.exp(-(diag1 * diag1) / 0.014) + Math.exp(-(diag2 * diag2) / 0.014)) *
      Math.exp(-rDist * 1.20) *
      (1.0 - Math.exp(-rSq / 0.008));

    const radialGather =
      (0.5 - 0.5 * Math.cos(angle * 4.0)) *
      Math.exp(-Math.pow(rDist - 0.30, 2) / 0.09) *
      (1.0 - Math.exp(-rSq / 0.009));

    // Subtle secondary seam tension waves near the tailored perimeter piping
    const edgeGather =
      (0.5 + 0.5 * Math.sin(angle * 8.0)) *
      Math.exp(-Math.pow(rDist - 0.72, 2) / 0.045) *
      0.18;

    const netIndent =
      (buttonDimple * 1.25 + crossCrease * 0.58 + xCrease * 0.64 + radialGather * 0.34 + edgeGather - crownRingSwell) *
      tuftDepth *
      faceWeight;

    if (tuftAxis === 'z') {
      z -= Math.sign(z || 1) * netIndent;
      uv.setXY(i, uFace * 0.5 + 0.5, vFace * 0.5 + 0.5);
    } else if (tuftAxis === 'y') {
      y -= Math.sign(y || 1) * netIndent;
      uv.setXY(i, uFace * 0.5 + 0.5, vFace * 0.5 + 0.5);
    } else {
      x -= Math.sign(x || 1) * netIndent;
      uv.setXY(i, uFace * 0.5 + 0.5, vFace * 0.5 + 0.5);
    }

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a 3D gravity-draped dining tablecloth geometry that rests flat on the
 * tabletop, wraps cleanly outside the 3.4cm bullnose tabletop rim with zero
 * clipping, and hangs vertically downward under gravity with soft box pleats
 * and natural corner folds.
 */
export function createDrapedTableclothGeometry(
  tableWidth: number,
  tableDepth: number,
  dropHeight = 0.22
): THREE.BufferGeometry {
  const segX = 56;
  const segZ = 44;
  // Grid parameterized in [-1, 1] x [-1, 1]
  const geo = new THREE.PlaneGeometry(2, 2, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  // Tabletop half-extents + 6mm clearance outside the wooden bullnose edge so skirt never clips!
  const hw = tableWidth * 0.5 + 0.006;
  const hd = tableDepth * 0.5 + 0.006;
  const cornerR = 0.046;
  const innerW = Math.max(0.05, hw - cornerR);
  const innerD = Math.max(0.05, hd - cornerR);
  const rimThick = 0.036; // clears the 3.4cm thick tabletop slab completely before hanging vertically

  // Inner [-edgeParam, +edgeParam] maps to the flat tabletop; [edgeParam, 1.0] maps to the vertical hanging skirt
  const edgeParam = 0.66;
  // Uniform physical overhang on ALL four sides so ±Z long sides drop to the exact same hem height as ±X ends
  const overhang = Math.max(dropHeight * 1.15, 0.26);
  const maxX = hw + overhang;
  const maxZ = hd + overhang;

  for (let i = 0; i < pos.count; i++) {
    const gx = pos.getX(i); // in [-1, 1]
    const gz = pos.getZ(i); // in [-1, 1]

    // Map [-edgeParam, edgeParam] -> [-hw, hw] x [-hd, hd], and outer strip uniformly by `overhang`
    const absGx = Math.abs(gx);
    const absGz = Math.abs(gz);
    const rawX =
      absGx <= edgeParam
        ? (gx / edgeParam) * hw
        : Math.sign(gx) * (hw + ((absGx - edgeParam) / (1.0 - edgeParam)) * overhang);
    const rawZ =
      absGz <= edgeParam
        ? (gz / edgeParam) * hd
        : Math.sign(gz) * (hd + ((absGz - edgeParam) / (1.0 - edgeParam)) * overhang);

    // Signed distance outside the rounded tabletop rectangle
    const qx = Math.abs(rawX) - innerW;
    const qz = Math.abs(rawZ) - innerD;
    const outX = Math.max(qx, 0);
    const outZ = Math.max(qz, 0);
    const outLen = Math.sqrt(outX * outX + outZ * outZ);
    const distOutside = outLen + Math.min(Math.max(qx, qz), 0) - cornerR;

    if (distOutside <= 0) {
      // Flat top surface of the tablecloth (3.5mm above tabletop top Y = 0.775 -> world Y = 0.7785)
      const edgeProx = Math.exp(distOutside * 18.0);
      const microDrape = Math.sin(rawX * 6.0) * Math.cos(rawZ * 6.0) * 0.0006;
      pos.setXYZ(i, rawX, 0.0035 + microDrape - edgeProx * 0.0008, rawZ);
      uv.setXY(i, (rawX / tableWidth + 0.5) * 2.0, (rawZ / tableDepth + 0.5) * 1.4);
    } else {
      // Closest point on the rounded tabletop perimeter + outward unit normal (nx, nz)
      const nx = outLen > 1e-5 ? (Math.sign(rawX) * outX) / outLen : Math.sign(rawX);
      const nz = outLen > 1e-5 ? (Math.sign(rawZ) * outZ) / outLen : Math.sign(rawZ);
      const bx = Math.sign(rawX) * Math.min(Math.abs(rawX), innerW) + nx * cornerR;
      const bz = Math.sign(rawZ) * Math.min(Math.abs(rawZ), innerD) + nz * cornerR;

      // Exact ray distance from perimeter (bx, bz) to outer grid boundary so s hits 1.0 uniformly on all 4 sides & corners
      const tx = Math.abs(nx) > 1e-5 ? (maxX - Math.abs(bx)) / Math.abs(nx) : 1e9;
      const tz = Math.abs(nz) > 1e-5 ? (maxZ - Math.abs(bz)) / Math.abs(nz) : 1e9;
      const localMaxOverhang = Math.max(0.05, Math.min(tx, tz));
      const s = Math.min(1.0, distOutside / localMaxOverhang);

      // Phase 1 (s in 0..0.16): smoothly wrap over the 3.4cm bullnose rim of the tabletop
      // Phase 2 (s in 0.16..1.0): hang nearly straight down under gravity!
      const rimS = Math.min(1.0, s / 0.16);
      const hangS = Math.max(0.0, (s - 0.16) / 0.84);

      const rimOut = Math.sin(rimS * Math.PI * 0.5) * 0.010;
      const rimDrop = (1.0 - Math.cos(rimS * Math.PI * 0.5)) * rimThick;

      // Gravity vertical drop + gentle lower catenary relaxation
      const y = 0.0035 - rimDrop - hangS * (dropHeight - rimThick);

      // Natural vertical gravity pleats & gathered corner folds along the hanging skirt
      const angle = Math.atan2(bz, bx);
      const isCorner = Math.pow(Math.sin(angle * 2.0), 2.0);
      const pleatWave =
        (Math.sin(angle * 16.0) * 0.0075 +
          isCorner * 0.012 * (0.5 + 0.5 * Math.cos(angle * 8.0))) *
        Math.pow(hangS, 0.85);
      const gravityDrapeOut = rimOut + hangS * 0.008 + pleatWave;

      // Subtle wavy hem scallop at the bottom edge of the hanging cloth
      const hemWave =
        (Math.sin(angle * 16.0) * 0.006 - isCorner * 0.014) * Math.pow(hangS, 1.2);

      pos.setXYZ(
        i,
        bx + nx * gravityDrapeOut,
        y + hemWave,
        bz + nz * gravityDrapeOut
      );

      // Continuous UV coordinates down the hanging skirt
      const uvX = ((bx + nx * s * dropHeight) / tableWidth + 0.5) * 2.0;
      const uvZ = ((bz + nz * s * dropHeight) / tableDepth + 0.5) * 1.4;
      uv.setXY(i, uvX, uvZ);
    }
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates a delicate pleated lace border ribbon that attaches seamlessly to the
 * bottom hem of createDrapedTableclothGeometry and matches its exact corner curves,
 * vertical pleats, and bottom hem wave.
 */
export function createTableclothLaceTrimGeometry(
  tableWidth: number,
  tableDepth: number,
  dropHeight = 0.22,
  laceHeight = 0.052
): THREE.BufferGeometry {
  const hw = tableWidth * 0.5 + 0.006;
  const hd = tableDepth * 0.5 + 0.006;
  const cornerR = 0.046;
  const innerW = Math.max(0.05, hw - cornerR);
  const innerD = Math.max(0.05, hd - cornerR);
  const rimThick = 0.036;

  // Sample continuous rounded-rectangle perimeter points
  const perimPts: { bx: number; bz: number; nx: number; nz: number }[] = [];
  const straightSegsX = 36;
  const straightSegsZ = 24;
  const cornerSegs = 8;

  // Top edge (-Z, left to right)
  for (let i = 0; i < straightSegsX; i++) {
    const t = i / straightSegsX;
    const x = THREE.MathUtils.lerp(-innerW, innerW, t);
    perimPts.push({ bx: x, bz: -hd, nx: 0, nz: -1 });
  }
  // Top-right corner (+X, -Z)
  for (let i = 0; i < cornerSegs; i++) {
    const a = -Math.PI / 2 + (i / cornerSegs) * (Math.PI / 2);
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    perimPts.push({ bx: innerW + nx * cornerR, bz: -innerD + nz * cornerR, nx, nz });
  }
  // Right edge (+X, -Z to +Z)
  for (let i = 0; i < straightSegsZ; i++) {
    const t = i / straightSegsZ;
    const z = THREE.MathUtils.lerp(-innerD, innerD, t);
    perimPts.push({ bx: hw, bz: z, nx: 1, nz: 0 });
  }
  // Bottom-right corner (+X, +Z)
  for (let i = 0; i < cornerSegs; i++) {
    const a = (i / cornerSegs) * (Math.PI / 2);
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    perimPts.push({ bx: innerW + nx * cornerR, bz: innerD + nz * cornerR, nx, nz });
  }
  // Bottom edge (+Z, right to left)
  for (let i = 0; i < straightSegsX; i++) {
    const t = i / straightSegsX;
    const x = THREE.MathUtils.lerp(innerW, -innerW, t);
    perimPts.push({ bx: x, bz: hd, nx: 0, nz: 1 });
  }
  // Bottom-left corner (-X, +Z)
  for (let i = 0; i < cornerSegs; i++) {
    const a = Math.PI / 2 + (i / cornerSegs) * (Math.PI / 2);
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    perimPts.push({ bx: -innerW + nx * cornerR, bz: innerD + nz * cornerR, nx, nz });
  }
  // Left edge (-X, +Z to -Z)
  for (let i = 0; i < straightSegsZ; i++) {
    const t = i / straightSegsZ;
    const z = THREE.MathUtils.lerp(innerD, -innerD, t);
    perimPts.push({ bx: -hw, bz: z, nx: -1, nz: 0 });
  }
  // Top-left corner (-X, -Z)
  for (let i = 0; i < cornerSegs; i++) {
    const a = Math.PI + (i / cornerSegs) * (Math.PI / 2);
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    perimPts.push({ bx: -innerW + nx * cornerR, bz: -innerD + nz * cornerR, nx, nz });
  }

  const count = perimPts.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let arcLen = 0;
  const laceRepeatMeters = 0.145;
  const baseTopY = 0.0035 - rimThick - (dropHeight - rimThick);

  for (let i = 0; i <= count; i++) {
    const p = perimPts[i % count];
    if (i > 0) {
      const prev = perimPts[(i - 1) % count];
      arcLen += Math.hypot(p.bx - prev.bx, p.bz - prev.bz);
    }

    const angle = Math.atan2(p.bz, p.bx);
    const isCorner = Math.pow(Math.sin(angle * 2.0), 2.0);
    const pleatWave =
      Math.sin(angle * 16.0) * 0.0075 +
      isCorner * 0.012 * (0.5 + 0.5 * Math.cos(angle * 8.0));
    const gravityDrapeOut = 0.010 + 0.008 + pleatWave;
    const hemWave = Math.sin(angle * 16.0) * 0.006 - isCorner * 0.014;

    // Slight overlap (+0.004) at top seam so lace tucks cleanly behind/under cloth hem
    const topX = p.bx + p.nx * (gravityDrapeOut + 0.0015);
    const topZ = p.bz + p.nz * (gravityDrapeOut + 0.0015);
    const topY = baseTopY + hemWave + 0.006;

    // Bottom scalloped edge flares gently outward under gravity
    const botX = p.bx + p.nx * (gravityDrapeOut + 0.006);
    const botZ = p.bz + p.nz * (gravityDrapeOut + 0.006);
    const botY = topY - laceHeight;

    const u = arcLen / laceRepeatMeters;
    positions.push(topX, topY, topZ);
    uvs.push(u, 1);
    positions.push(botX, botY, botZ);
    uvs.push(u, 0);

    if (i < count) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an ergonomically curved wooden dining chair backrest rail that wraps
 * gently around the sitter's back with smooth chamfered edges.
 * Local center sits at (0, 0, 0) with the concave inner face pointing toward +Z.
 */
export function createCurvedChairBackrestGeometry(
  width = 0.44,
  height = 0.145,
  thickness = 0.026,
  curveDepth = 0.068,
  segments = 20
): THREE.ExtrudeGeometry {
  const halfW = width * 0.5;
  const shape = new THREE.Shape();

  // Outer convex arc (from -halfW to +halfW)
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = t * 2 - 1; // -1 .. +1
    const x = u * halfW;
    // Parabolic ergonomic wrap curving forward (+Z) toward left/right ends
    const yOuter = curveDepth * (u * u) - thickness * 0.5;
    if (i === 0) shape.moveTo(x, yOuter);
    else shape.lineTo(x, yOuter);
  }
  // Inner concave arc (from +halfW back to -halfW)
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const u = t * 2 - 1;
    const x = u * halfW;
    const yInner = curveDepth * (u * u) + thickness * 0.5;
    shape.lineTo(x, yInner);
  }
  shape.closePath();

  const extrudeH = Math.max(0.02, height - 0.012);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // Rotate so extrusion depth runs vertically along +Y and shape Y maps to +Z (forward wrap)
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}



/**
 * Creates a horizontal slab (tabletop, counter, shelf, rug, or step tread) with
 * rounded plan-view corners AND beveled top/bottom edges.
 */
export function createBeveledSlab(
  width: number,
  thickness: number,
  depth: number,
  cornerRadius = 0.06,
  bevelSize = 0.014,
  bevelSegments = 3
): THREE.ExtrudeGeometry {
  const effBevel = Math.min(bevelSize, thickness * 0.38);
  const w = Math.max(0.02, width - effBevel * 2);
  const d = Math.max(0.02, depth - effBevel * 2);
  const r = Math.min(cornerRadius, w * 0.45, d * 0.45);
  const hw = w / 2;
  const hd = d / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hd);
  shape.lineTo(hw - r, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
  shape.lineTo(hw, hd - r);
  shape.quadraticCurveTo(hw, hd, hw - r, hd);
  shape.lineTo(-hw + r, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
  shape.lineTo(-hw, -hd + r);
  shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

  const innerDepth = Math.max(0.004, thickness - effBevel * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: innerDepth,
    bevelEnabled: true,
    bevelThickness: effBevel,
    bevelSize: effBevel,
    bevelSegments,
    curveSegments: 10,
  });

  geo.rotateX(Math.PI / 2);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a turned wooden furniture leg with a rounded top collar, smooth taper,
 * decorative ankle ring, and spherical foot pad.
 */
export function createTurnedLegGeometry(
  topRadius: number,
  bottomRadius: number,
  height: number,
  segments = 14
): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(bottomRadius * 0.75, 0),
    new THREE.Vector2(bottomRadius * 1.08, height * 0.03),
    new THREE.Vector2(bottomRadius * 0.92, height * 0.07),
    new THREE.Vector2(bottomRadius * 1.15, height * 0.11), // subtle ankle ring
    new THREE.Vector2(bottomRadius, height * 0.14),
    new THREE.Vector2(topRadius * 0.96, height * 0.88),
    new THREE.Vector2(topRadius * 1.1, height * 0.95),
    new THREE.Vector2(topRadius * 0.85, height),
    new THREE.Vector2(0.0008, height),
  ];
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.translate(0, -height / 2, 0);
  geo.computeVertexNormals();
  const norm = geo.attributes.normal;
  if (norm) {
    for (let i = 0; i < norm.count; i++) {
      const nx = norm.getX(i);
      const ny = norm.getY(i);
      const nz = norm.getZ(i);
      const lenSq = nx * nx + ny * ny + nz * nz;
      if (!(lenSq > 1e-6)) {
        norm.setXYZ(i, 0, 1, 0);
      }
    }
    norm.needsUpdate = true;
  }
  return geo;
}

/**
 * Places a turned furniture leg whose TOP is anchored at (topX, topY, topZ)
 * and whose BOTTOM foot splays outward away from the center (0, *, 0).
 */
export function createSplayedLegMesh(
  legGeo: THREE.BufferGeometry,
  material: THREE.Material,
  topX: number,
  topY: number,
  topZ: number,
  height: number,
  splayAngleX = 0.15,
  splayAngleZ = 0.12
): THREE.Mesh {
  const mesh = new THREE.Mesh(legGeo, material);
  // rotZ > 0 moves bottom (-Y) toward +X; rotX < 0 moves bottom (-Y) toward +Z
  const rotZ = topX >= 0 ? Math.abs(splayAngleX) : -Math.abs(splayAngleX);
  const rotX = topZ >= 0 ? -Math.abs(splayAngleZ) : Math.abs(splayAngleZ);
  mesh.rotation.set(rotX, 0, rotZ);

  // Offset center so the top of the leg stays at (topX, topY, topZ) and the foot extends outward
  const halfH = height / 2;
  const dx = Math.sin(rotZ) * halfH;
  const dz = -Math.sin(rotX) * halfH;
  const dy = Math.cos(rotZ) * Math.cos(rotX) * halfH;
  mesh.position.set(topX + dx, topY - dy, topZ + dz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const CURTAIN_HEM_V = 0.038;

/**
 * Remaps the bottom 5 vertex rows of a curtain PlaneGeometry into a crisp,
 * physically sculpted double-folded stitched hem (`v = 0 .. CURTAIN_HEM_V`),
 * returning the remapped `v` coordinate and out-of-plane Z relief (indented
 * stitch seam at `v = hemV`, proud double-layer folded band below, and soft
 * rounded bottom fold lip at `v = 0`).
 */
function sampleCurtainFoldedHem(
  rowIndex: number,
  segY: number,
  u: number,
  hemV = CURTAIN_HEM_V
): { v: number; reliefZ: number } {
  const bodyRows = segY - 5;
  if (rowIndex <= bodyRows) {
    const t = rowIndex / bodyRows;
    const v = 1.0 - t * (1.0 - (hemV + 0.008));
    return { v, reliefZ: 0 };
  }
  const hemStep = rowIndex - bodyRows; // 1..5
  const stitchPucker = Math.sin(u * Math.PI * 34) * 0.0007;
  switch (hemStep) {
    case 1: // Slight tuck-in immediately above the stitch line
      return { v: hemV + 0.0025, reliefZ: -0.0018 };
    case 2: // Indented horizontal stitch groove with subtle needle pucker
      return { v: hemV, reliefZ: -0.0046 + stitchPucker };
    case 3: // Upper ridge of the double-folded hem stepping outward
      return { v: hemV - 0.0045, reliefZ: 0.0078 + stitchPucker * 0.5 };
    case 4: // Weighted flat double-layer hem face
      return { v: hemV * 0.44, reliefZ: 0.0086 };
    default: // Softly rounded folded bottom edge
      return { v: 0.0, reliefZ: 0.0026 };
  }
}

/**
 * Creates a continuous wavy fabric curtain mesh with realistic French pinch-pleats
 * at the top header, natural inward waist gathering at the tieback band, and a
 * softly flared multi-fold bottom hem with a stitched double-folded cuff.
 */
export function createDrapedCurtainGeometry(
  width: number,
  height: number,
  depth = 0.085,
  pleatCount = 5.5
): THREE.BufferGeometry {
  const segX = 48;
  const segY = 40;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = THREE.MathUtils.clamp((x + width / 2) / width, 0, 1); // 0..1 across curtain width
    const rowIndex = Math.floor(i / (segX + 1));
    const { v, reliefZ } = sampleCurtainFoldedHem(rowIndex, segY, u);
    const y = (v - 0.5) * height;
    uv.setY(i, v);

    // Tieback waist gather centered around v = 0.365 (matches tieBand at y = -0.34)
    const tieDist = (v - 0.365) / 0.22;
    const tiePinch = Math.exp(-tieDist * tieDist);

    // Horizontal width profile: pinched at tieback, flared gracefully toward bottom hem & top header
    const bottomFlare = Math.pow(Math.max(0, 1 - v), 1.6) * 0.14;
    const widthScale = 1.0 - tiePinch * 0.26 + bottomFlare;

    // Asymmetric natural sweep toward the outer casing edge + gentle S-curve drape
    const gatherPullX = tiePinch * 0.018 * Math.sin((u - 0.5) * Math.PI);
    const sculptedX = x * widthScale + gatherPullX;

    // Primary tubular catenary pleats + crisp top pinch-pleat harmonic + soft asymmetric ripple
    const headerPinch = Math.pow(v, 2.4);
    const pleatEnv = depth * (0.62 + 0.52 * (1 - v) - 0.22 * tiePinch);
    const phase = u * Math.PI * 2 * pleatCount;
    const primaryWave = Math.sin(phase) * pleatEnv;
    const pinchHarmonic =
      Math.cos(phase * 2.0) * depth * (0.16 + 0.22 * headerPinch);
    const organicRipple =
      Math.sin(u * Math.PI * 3.0 + v * 4.2) * depth * 0.12 * (1 - 0.5 * v);

    // Subtle forward/backward billow around the tieback waist
    const waistBillow = tiePinch * depth * 0.32 * Math.cos((u - 0.5) * Math.PI);

    // Slight hem scallop undulation at the bottom edge so the hem looks like weighted fabric
    const hemWaveY =
      (1 - v) * Math.sin(phase) * 0.008;

    pos.setXYZ(
      i,
      sculptedX,
      y + hemWaveY,
      primaryWave + pinchHarmonic + organicRipple + waistBillow + reliefZ
    );
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a classic "butterfly" (hourglass tieback) curtain panel:
 * fixed full-width pleated header at the top (v = 1), tightly cinched
 * into an hourglass waist in the lower third (v = pinchV), and gracefully
 * flaring outward into a ruffled butterfly skirt with a folded stitched bottom hem.
 */
export function createButterflyCurtainGeometry(
  width: number,
  height: number,
  depth = 0.082,
  pleatCount = 6.5,
  pinchV = 0.28
): THREE.BufferGeometry {
  const segX = 52;
  const segY = 48;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = THREE.MathUtils.clamp((x + width / 2) / width, 0, 1);
    const rowIndex = Math.floor(i / (segX + 1));
    const { v, reliefZ } = sampleCurtainFoldedHem(rowIndex, segY, u);
    const y = (v - 0.5) * height;
    uv.setY(i, v);

    // Asymmetric hourglass gather: smooth sweeping taper from top rod down to lower-third waist,
    // followed by a lively outward butterfly flare at the bottom skirt
    const sigma = v > pinchV ? 0.34 : 0.19;
    const tieDist = (v - pinchV) / sigma;
    const tiePinch = Math.exp(-tieDist * tieDist);

    const lowerRatio = Math.max(0, (pinchV - v) / Math.max(0.01, pinchV));
    const bottomFlare = Math.pow(lowerRatio, 1.3) * 0.22;
    const topAnchor = Math.pow(v, 3.2) * 0.06;

    const widthScale = THREE.MathUtils.clamp(
      1.0 - tiePinch * 0.72 + bottomFlare + topAnchor,
      0.22,
      1.18
    );

    const sculptedX = x * widthScale;

    // Fine vertical pinch-pleats that bunch radially around the cinched waist
    const headerPinch = Math.pow(v, 2.4);
    const phase = u * Math.PI * 2 * pleatCount;
    const pleatEnv = depth * (0.58 + 0.42 * (1 - v) - 0.38 * tiePinch);
    const primaryWave = Math.sin(phase) * pleatEnv;
    const pinchHarmonic =
      Math.cos(phase * 2.0) * depth * (0.14 + 0.20 * headerPinch);
    const organicRipple =
      Math.sin(u * Math.PI * 3.0 + v * 4.5) * depth * 0.10 * (1 - 0.45 * v);

    // Sculpted cylindrical bunching at the tieback waist + soft fabric puff right above & below
    const centerBell = Math.cos((u - 0.5) * Math.PI);
    const waistBundle = tiePinch * depth * 0.48 * centerBell;
    const skirtBillow = lowerRatio * (1 - lowerRatio * 0.35) * depth * 0.28 * centerBell;

    // Gentle weighted scallop along the flared bottom hem
    const hemWaveY =
      Math.pow(1 - v, 2.0) * (Math.sin(phase) * 0.012 - Math.abs(u - 0.5) * 0.022);

    pos.setXYZ(
      i,
      sculptedX,
      y + hemWaveY,
      primaryWave + pinchHarmonic + organicRipple + waistBundle + skirtBillow + reliefZ
    );
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a gracefully flared top curtain valance (窗幔):
 * fixed snugly at the top rod (v = 1) with ZERO inward pinch,
 * fanning softly outward and slightly forward toward the bottom lace hem (v = 0).
 */
export function createFlaredValanceGeometry(
  width: number,
  height: number,
  depth = 0.046,
  pleatCount = 13.0
): THREE.BufferGeometry {
  const segX = 64;
  const segY = 20;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const u = THREE.MathUtils.clamp((x + width / 2) / width, 0, 1);
    const v = THREE.MathUtils.clamp((y + height / 2) / height, 0, 1);

    // Outward flare from top rod (v=1) to bottom lace hem (v=0) — never pinches inward!
    const drop = 1 - v;
    const widthScale = 1.0 + Math.pow(drop, 1.3) * 0.095;
    const sculptedX = x * widthScale;

    // Soft rhythmic ruffle pleats that deepen and billow gently outward toward the bottom hem
    const phase = u * Math.PI * 2 * pleatCount;
    const pleatAmp = depth * (0.28 + 0.85 * Math.pow(drop, 0.85));
    const primaryWave = Math.sin(phase) * pleatAmp;
    const harmonic = Math.cos(phase * 2.0) * depth * 0.14 * (0.4 + 0.6 * drop);
    const forwardFlare = Math.pow(drop, 1.15) * 0.042;
    const hemWaveY = drop * drop * Math.sin(phase) * 0.008;

    pos.setXYZ(i, sculptedX, y + hemWaveY, primaryWave + harmonic + forwardFlare);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates one half (`side`: -1 or +1) of a physically natural gravity-draped velvet curtain pair:
 * - Top header (v = 1) is fixed along the rod from window center (x = 0) to outer edge (halfWidth)
 * - Upper inner edge hangs under gravity in a natural concave catenary swag down to the side tieback
 * - Outer edge hangs naturally straight down, gently gathered into the tieback band
 * - Below the tieback (v < pinchV), the released fabric hangs vertically under gravity with soft pleats
 */
export function createArchedVelvetCurtainGeometry(
  halfWidth: number,
  height: number,
  side: -1 | 1,
  depth = 0.072,
  pleatCount = 6.5,
  pinchV = 0.34
): THREE.BufferGeometry {
  const segX = 56;
  const segY = 56;
  const geo = new THREE.PlaneGeometry(halfWidth, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const tieInner = halfWidth * 0.60; // ~0.53m from center at tieback waist

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = THREE.MathUtils.clamp((x + halfWidth / 2) / halfWidth, 0, 1);
    const rowIndex = Math.floor(i / (segX + 1));
    const { v, reliefZ } = sampleCurtainFoldedHem(rowIndex, segY, u);
    const y = (v - 0.5) * height;
    uv.setY(i, v);

    // s = 0 at the inner (window-center) edge, s = 1 at the outer wall edge
    const s = side === 1 ? u : 1 - u;

    // 1. Physically natural gravity catenary drape for the inner edge:
    //    Fixed at center (x = 0) at the rod (v = 1), falling smoothly under gravity toward the
    //    side tieback (v = pinchV), then hanging naturally straight down with slight soft relaxation.
    let innerDist: number;
    if (v >= pinchV) {
      const t = (1 - v) / Math.max(0.01, 1 - pinchV); // 0 at top rod -> 1 at tieback
      // Natural downward gravity swag (concave toward the floor, never bulging outward!)
      const gravityCurve = Math.pow(t, 1.55);
      // Smooth slight ease into the tieback ring so there is no sharp kink at v = pinchV
      const smoothTie = t * t * (3 - 2 * t);
      innerDist = tieInner * (0.65 * gravityCurve + 0.35 * smoothTie);
    } else {
      // Below the tieback: fabric hangs straight down under gravity, relaxing gently outward
      const belowT = (pinchV - v) / Math.max(0.01, pinchV); // 0 at tieback -> 1 at floor hem
      innerDist = tieInner - halfWidth * 0.075 * (1 - Math.exp(-belowT * 3.0));
    }

    // 2. Outer edge hangs naturally vertical along the wall, gently pulled in at the tieback
    const waistDist = (v - pinchV) / (v > pinchV ? 0.24 : 0.16);
    const waistPinch = Math.exp(-waistDist * waistDist);
    const outerDist = halfWidth * (0.98 - waistPinch * 0.14);

    const radialX = THREE.MathUtils.lerp(innerDist, outerDist, s);
    const sculptedX = side * radialX;

    // 3. Soft, natural rounded velvet folds flowing along the drape
    const phase = s * Math.PI * 2 * pleatCount;
    const pleatEnv = depth * (0.58 + 0.32 * (1 - v) - 0.28 * waistPinch);
    const primaryWave = Math.sin(phase) * pleatEnv;
    const softVelvetRound = Math.cos(phase * 2.0) * depth * 0.10;
    // Gentle natural bunching depth at the tieback bundle (never protruding awkwardly)
    const tieBundle = Math.sin(s * Math.PI) * depth * (0.18 + 0.32 * waistPinch);

    // Subtle weighted hem undulation at the bottom
    const hemWaveY = Math.pow(1 - v, 2.2) * Math.sin(phase) * 0.008;

    pos.setXYZ(
      i,
      sculptedX,
      y + hemWaveY,
      primaryWave + softVelvetRound + tieBundle + reliefZ
    );
  }

  pos.needsUpdate = true;
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a tapered organic branch / stem along a 3D Catmull-Rom curve.
 */
export function createTaperedCurveGeometry(
  points: THREE.Vector3[],
  baseRadius: number,
  tipRadius: number,
  tubularSegments = 24,
  radialSegments = 8
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    baseRadius,
    radialSegments,
    false
  );
  const pos = geo.attributes.position;
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const scale = THREE.MathUtils.lerp(1.0, tipRadius / baseRadius, t);
    curve.getPointAt(t, center);

    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * (radialSegments + 1) + j;
      vertex.fromBufferAttribute(pos, idx);
      vertex.sub(center).multiplyScalar(scale).add(center);
      pos.setXYZ(idx, vertex.x, vertex.y, vertex.z);
    }
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a stylized, multi-part sculpted Moai Head Statue with beveled stone
 * planes, deep brow overhang, angled nose bridge, flared nostrils, carved lips,
 * and elongated ears.
 */
export function createSculptedMoaiGroup(
  stoneMat: THREE.Material,
  darkStoneMat: THREE.Material,
  outlines: OutlineRegistry
): THREE.Group {
  const moai = new THREE.Group();

  // 1. Stepped octagonal plinth base
  const plinthBot = new THREE.Mesh(
    createBeveledSlab(0.24, 0.032, 0.24, 0.04, 0.008),
    darkStoneMat
  );
  plinthBot.position.y = 0.016;
  plinthBot.castShadow = true;
  moai.add(plinthBot);

  const plinthTop = new THREE.Mesh(
    createBeveledSlab(0.19, 0.026, 0.19, 0.035, 0.006),
    stoneMat
  );
  plinthTop.position.y = 0.042;
  moai.add(plinthTop);

  // 2. Sculpted cranium & jaw (Extruded side profile with heavy bevels)
  const headProfile = new THREE.Shape();
  headProfile.moveTo(-0.075, 0.05); // back of neck
  headProfile.lineTo(0.068, 0.05); // front of neck
  headProfile.lineTo(0.085, 0.11); // jutting chin
  headProfile.lineTo(0.072, 0.19); // mouth/philtrum recess
  headProfile.lineTo(0.065, 0.29); // deep eye socket plane
  headProfile.lineTo(0.092, 0.34); // prominent brow ridge
  headProfile.lineTo(0.062, 0.42); // sloped forehead
  headProfile.lineTo(-0.058, 0.41); // crown back
  headProfile.lineTo(-0.078, 0.22); // occiput
  headProfile.closePath();

  const craniumGeo = new THREE.ExtrudeGeometry(headProfile, {
    steps: 1,
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.026,
    bevelSize: 0.022,
    bevelSegments: 4,
  });
  craniumGeo.center();
  // Rotate so front of face points along -X (towards living room center)
  craniumGeo.rotateY(Math.PI);
  const cranium = new THREE.Mesh(craniumGeo, stoneMat);
  cranium.position.set(0, 0.23, 0);
  cranium.castShadow = true;
  cranium.receiveShadow = true;
  outlines.addOutline(cranium, 1.035);
  moai.add(cranium);

  // 3. Heavy overhanging V-shaped brow ridge
  const brow = new THREE.Mesh(
    createBeveledBox(0.07, 0.048, 0.19, 0.016, 3),
    stoneMat
  );
  brow.position.set(-0.078, 0.335, 0);
  brow.rotation.z = -0.18;
  brow.castShadow = true;
  moai.add(brow);

  // 4. Aquiline sculpted nose bridge + flared nostrils
  const noseShape = new THREE.Shape();
  noseShape.moveTo(0, 0);
  noseShape.lineTo(-0.055, -0.01); // nose tip jutting out (-X)
  noseShape.lineTo(-0.02, 0.13); // bridge top under brow
  noseShape.lineTo(0.02, 0.13);
  noseShape.closePath();
  const noseGeo = new THREE.ExtrudeGeometry(noseShape, {
    steps: 1,
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 3,
  });
  noseGeo.center();
  const nose = new THREE.Mesh(noseGeo, stoneMat);
  nose.position.set(-0.088, 0.255, 0);
  nose.castShadow = true;
  moai.add(nose);

  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(
      createBeveledBox(0.036, 0.028, 0.032, 0.01, 2),
      stoneMat
    );
    nostril.position.set(-0.096, 0.2, side * 0.022);
    moai.add(nostril);
  }

  // 5. Pursed stoic lips
  const upperLip = new THREE.Mesh(
    createBeveledBox(0.035, 0.02, 0.082, 0.008, 2),
    stoneMat
  );
  upperLip.position.set(-0.084, 0.152, 0);
  moai.add(upperLip);

  const lowerLip = new THREE.Mesh(
    createBeveledBox(0.032, 0.02, 0.076, 0.008, 2),
    stoneMat
  );
  lowerLip.position.set(-0.082, 0.134, 0);
  moai.add(lowerLip);

  // 6. Elongated carved ears on both sides
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(
      createBeveledBox(0.055, 0.16, 0.028, 0.01, 2),
      stoneMat
    );
    ear.position.set(0.01, 0.24, side * 0.09);
    ear.rotation.z = 0.08;
    moai.add(ear);
  }

  return moai;
}

/**
 * Creates a sheared parallelogram volumetric light sheet whose right edge (u=1, x=0)
 * spans the ENTIRE height of the window aperture (winBottomY .. winTopY) and
 * slants naturally downward into the room (u=0, x=-length, floorBottomY .. floorTopY),
 * with soft organic curvature so no rigid planar ray edges appear.
 */
export function createWindowLightVolumeGeometry(
  length = 4.35,
  winBottomY = 0.88,
  winTopY = 2.68,
  roomBottomY = 0.02,
  roomTopY = 1.18,
  zSpread = 0.0
): THREE.BufferGeometry {
  const segU = 28;
  const segV = 22;
  const geo = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i); // 0 = deep inside room (-X), 1 = at East window (x=0)
    const v = uv.getY(i); // 0 = bottom edge of beam, 1 = top edge of beam

    const x = -length * (1.0 - u);
    const yBot = THREE.MathUtils.lerp(roomBottomY, winBottomY, u);
    const yTop = THREE.MathUtils.lerp(roomTopY, winTopY, u);
    const y = THREE.MathUtils.lerp(yBot, yTop, v);

    // Gentle cambered Z billow + transverse Z spread so the sheet isn't a flat laser plane
    const billow = Math.sin(v * Math.PI) * Math.sin(u * Math.PI) * (zSpread * 0.45);
    const z =
      (1.0 - u) * -0.22 +
      (v - 0.5) * zSpread * (0.45 + 0.55 * (1.0 - u)) +
      billow;

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a single merged 3D volumetric Tyndall light-beam assembly extending
 * diagonally inward (-X) and downward (-Y) from a window opening at X = 0:
 * - Outer 4-sided tapered volumetric scattering frustum (continuous 3D volume from EVERY angle)
 * - 5 fanned internal diagonal god-ray curtains aligned with window pane columns
 * Carries `aBeamKind` (0.0 = outer volumetric scatter shell, 1.0 = internal striated god-ray sheet)
 * and `aSliceId` so one draw call renders rich anime/MiSide diagonal Tyndall shafts!
 */
export function createTyndallShaftClusterGeometry(
  length = 5.1,
  winWidth = 1.24,
  winBottomY = 0.88,
  winTopY = 2.68,
  roomBottomY = 0.02,
  roomTopY = 1.12,
  sideSkewZ = -0.32,
  spreadFactor = 1.38
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const beamKinds: number[] = [];
  const sliceIds: number[] = [];

  const pushTri = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    uv0: [number, number],
    uv1: [number, number],
    uv2: [number, number],
    kind: number,
    slice: number
  ) => {
    const ux = p1[0] - p0[0];
    const uy = p1[1] - p0[1];
    const uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0];
    const vy = p2[1] - p0[1];
    const vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const nLen = Math.hypot(nx, ny, nz) || 1;
    nx /= nLen;
    ny /= nLen;
    nz /= nLen;

    positions.push(...p0, ...p1, ...p2);
    normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    uvs.push(...uv0, ...uv1, ...uv2);
    beamKinds.push(kind, kind, kind);
    sliceIds.push(slice, slice, slice);
  };

  const pushQuad = (
    p00: [number, number, number],
    p10: [number, number, number],
    p11: [number, number, number],
    p01: [number, number, number],
    uv00: [number, number],
    uv10: [number, number],
    uv11: [number, number],
    uv01: [number, number],
    kind: number,
    slice: number
  ) => {
    pushTri(p00, p10, p11, uv00, uv10, uv11, kind, slice);
    pushTri(p00, p11, p01, uv00, uv11, uv01, kind, slice);
  };

  const hwWin = winWidth * 0.5;
  const evalShellPt = (
    u: number, // 0 = room end, 1 = window plane
    v: number, // 0 = bottom, 1 = top
    sideS: number // -1 = left (-Z), +1 = right (+Z)
  ): [number, number, number] => {
    const t = 1.0 - u; // 0 at window, 1 at floor end
    const x = -length * t;
    const yBot = THREE.MathUtils.lerp(winBottomY, roomBottomY, t);
    const yTop = THREE.MathUtils.lerp(winTopY, roomTopY, t);
    const y = THREE.MathUtils.lerp(yBot, yTop, v);
    const halfW = hwWin * THREE.MathUtils.lerp(1.0, spreadFactor, t);
    const z = sideSkewZ * t + sideS * halfW;
    return [x, y, z];
  };

  // 1. Outer 4-sided 3D volumetric frustum (top, bottom, left, right faces)
  const segU = 10;
  const segV = 6;
  const shellSides: { side: 'left' | 'right' | 'top' | 'bottom' }[] = [
    { side: 'left' },
    { side: 'right' },
    { side: 'top' },
    { side: 'bottom' },
  ];
  for (const { side } of shellSides) {
    for (let iu = 0; iu < segU; iu++) {
      const u0 = iu / segU;
      const u1 = (iu + 1) / segU;
      for (let iv = 0; iv < segV; iv++) {
        const w0 = iv / segV;
        const w1 = (iv + 1) / segV;
        const pt = (u: number, w: number): [number, number, number] => {
          if (side === 'left') return evalShellPt(u, w, -1);
          if (side === 'right') return evalShellPt(u, w, 1);
          if (side === 'top') return evalShellPt(u, 1, w * 2 - 1);
          return evalShellPt(u, 0, w * 2 - 1);
        };
        const p00 = pt(u0, w0);
        const p10 = pt(u1, w0);
        const p11 = pt(u1, w1);
        const p01 = pt(u0, w1);
        // Keep v in [0, 1] across the transverse face width so edges feather seamlessly
        pushQuad(p00, p10, p11, p01, [u0, w0], [u1, w0], [u1, w1], [u0, w1], 0.0, 0.5);
      }
    }
  }

  // 2. Five fanned internal diagonal god-ray curtains (visible from front, side, and 3/4 views!)
  const sliceOffsets = [-0.68, -0.34, 0.0, 0.34, 0.68];
  for (let si = 0; si < sliceOffsets.length; si++) {
    const sNorm = sliceOffsets[si];
    const sliceId = si / (sliceOffsets.length - 1);
    for (let iu = 0; iu < segU; iu++) {
      const u0 = iu / segU;
      const u1 = (iu + 1) / segU;
      for (let iv = 0; iv < segV; iv++) {
        const v0 = iv / segV;
        const v1 = (iv + 1) / segV;
        // Slight vertical fan so sheets form a continuous volumetric scatter veil from any angle
        const s0 = sNorm + (v0 - 0.5) * 0.24 * (si % 2 === 0 ? 1 : -1);
        const s1 = sNorm + (v1 - 0.5) * 0.24 * (si % 2 === 0 ? 1 : -1);
        const p00 = evalShellPt(u0, v0, s0);
        const p10 = evalShellPt(u1, v0, s0);
        const p11 = evalShellPt(u1, v1, s1);
        const p01 = evalShellPt(u0, v1, s1);
        pushQuad(p00, p10, p11, p01, [u0, v0], [u1, v0], [u1, v1], [u0, v1], 1.0, sliceId);
      }
    }
  }

  // 3. Two cross-angled diagonal planes (horizontal-ish slanted god-ray planes for top/bottom viewing angles!)
  for (let hi = 0; hi < 2; hi++) {
    const vCenter = hi === 0 ? 0.34 : 0.68;
    const sliceId = hi === 0 ? 0.28 : 0.72;
    for (let iu = 0; iu < segU; iu++) {
      const u0 = iu / segU;
      const u1 = (iu + 1) / segU;
      for (let is = 0; is < segV; is++) {
        const w0 = is / segV;
        const w1 = (is + 1) / segV;
        const s0 = (w0 - 0.5) * 1.82;
        const s1 = (w1 - 0.5) * 1.82;
        const p00 = evalShellPt(u0, vCenter, s0);
        const p10 = evalShellPt(u1, vCenter, s0);
        const p11 = evalShellPt(u1, vCenter, s1);
        const p01 = evalShellPt(u0, vCenter, s1);
        pushQuad(p00, p10, p11, p01, [u0, w0], [u1, w0], [u1, w1], [u0, w1], 1.0, sliceId);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aBeamKind', new THREE.Float32BufferAttribute(beamKinds, 1));
  geo.setAttribute('aSliceId', new THREE.Float32BufferAttribute(sliceIds, 1));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Builds a stylized color-blocked drawer box or cabinet door front with 3D
 * raised rectangular molding lines (抽屉盒表面凸出的造型线) around the perimeter
 * plus an optional central handle pull or knob.
 */
export function createMoldedDrawerFront(
  width: number,
  height: number,
  depth: number,
  facingAxis: 'x' | 'z',
  frontMat: THREE.Material,
  moldingMat: THREE.Material,
  handleMat?: THREE.Material,
  facingSign: 1 | -1 = 1,
  handleAlign: -1 | 0 | 1 = 0
): THREE.Group {
  const g = new THREE.Group();

  // Base beveled drawer/door front slab (crisp 6mm chamfer)
  const baseW = facingAxis === 'z' ? width : depth;
  const baseD = facingAxis === 'z' ? depth : width;
  const basePanel = new THREE.Mesh(
    createBeveledBox(baseW, height, baseD, 0.005, 2),
    frontMat
  );
  basePanel.castShadow = true;
  basePanel.receiveShadow = true;
  g.add(basePanel);

  // Fine Shaker/architectural raised perimeter molding lines
  const insetW = Math.max(0.04, width - 0.050);
  const insetH = Math.max(0.036, height - 0.042);
  const moldThick = 0.009;
  const moldRelief = 0.0055;
  const surfaceOffset = (depth / 2 + moldRelief / 2 - 0.0015) * facingSign;

  for (const sy of [-1, 1]) {
    const hBarW = facingAxis === 'z' ? insetW + moldThick : moldRelief;
    const hBarD = facingAxis === 'z' ? moldRelief : insetW + moldThick;
    const hBar = new THREE.Mesh(
      createBeveledBox(hBarW, moldThick, hBarD, 0.002, 2),
      moldingMat
    );
    hBar.position.set(
      facingAxis === 'x' ? surfaceOffset : 0,
      sy * (insetH / 2),
      facingAxis === 'z' ? surfaceOffset : 0
    );
    hBar.castShadow = true;
    g.add(hBar);
  }

  for (const sx of [-1, 1]) {
    const vBarW = facingAxis === 'z' ? moldThick : moldRelief;
    const vBarD = facingAxis === 'z' ? moldRelief : moldThick;
    const vBar = new THREE.Mesh(
      createBeveledBox(vBarW, Math.max(0.02, insetH - moldThick * 0.5), vBarD, 0.002, 2),
      moldingMat
    );
    vBar.position.set(
      facingAxis === 'z' ? sx * (insetW / 2) : surfaceOffset,
      0,
      facingAxis === 'z' ? surfaceOffset : sx * (insetW / 2)
    );
    vBar.castShadow = true;
    g.add(vBar);
  }

  // Slim architectural bar pull (10mm cross-section)
  if (handleMat) {
    const pullOffset = (depth / 2 + 0.011) * facingSign;
    if (handleAlign === 0) {
      const pullSpan = Math.min(0.13, width * 0.34);
      const pullW = facingAxis === 'z' ? pullSpan : 0.011;
      const pullD = facingAxis === 'z' ? 0.011 : pullSpan;
      const pull = new THREE.Mesh(
        createBeveledBox(pullW, 0.010, pullD, 0.003, 2),
        handleMat
      );
      pull.position.set(
        facingAxis === 'x' ? pullOffset : 0,
        0,
        facingAxis === 'z' ? pullOffset : 0
      );
      pull.castShadow = true;
      g.add(pull);
    } else {
      const pullH = Math.min(0.105, height * 0.30);
      const latchLateral = handleAlign * (width * 0.37);
      const pull = new THREE.Mesh(
        createBeveledBox(0.010, pullH, 0.010, 0.003, 2),
        handleMat
      );
      pull.position.set(
        facingAxis === 'x' ? pullOffset : latchLateral,
        0,
        facingAxis === 'z' ? pullOffset : latchLateral
      );
      pull.castShadow = true;
      g.add(pull);
    }
  }

  return g;
}

/**
 * Turned classic copper-brass round cabinet knob (铜黄圆形把手) via LatheGeometry.
 * Oriented along +Y (base rosette at y=0, spherical knob crown at y≈0.027).
 */
export function createCopperKnobGeometry(scale = 1.0): THREE.LatheGeometry {
  const s = scale;
  const pts = [
    new THREE.Vector2(0.0005 * s, 0.0),
    new THREE.Vector2(0.0145 * s, 0.0),
    new THREE.Vector2(0.0142 * s, 0.0026 * s),
    new THREE.Vector2(0.0110 * s, 0.0046 * s),
    new THREE.Vector2(0.0062 * s, 0.0064 * s),
    new THREE.Vector2(0.0052 * s, 0.0115 * s),
    new THREE.Vector2(0.0074 * s, 0.0148 * s),
    new THREE.Vector2(0.0128 * s, 0.0176 * s),
    new THREE.Vector2(0.0148 * s, 0.0212 * s),
    new THREE.Vector2(0.0136 * s, 0.0252 * s),
    new THREE.Vector2(0.0094 * s, 0.0278 * s),
    new THREE.Vector2(0.0042 * s, 0.0290 * s),
    new THREE.Vector2(0.0004 * s, 0.0293 * s),
  ];
  const geo = new THREE.LatheGeometry(pts, 20);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Sculpted gently bowed arch cabinet pull handle (弧形橱柜拉手) oriented along local X
 * with arch projecting outward along +Z (z=0 at door surface).
 */
export function createArchedCabinetPullGeometry(
  span = 0.118,
  projection = 0.024,
  tubeRadius = 0.0052
): THREE.BufferGeometry {
  const hs = span * 0.5;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-hs, 0, 0.001),
    new THREE.Vector3(-hs * 0.92, 0, projection * 0.72),
    new THREE.Vector3(-hs * 0.45, 0, projection),
    new THREE.Vector3(0, 0, projection * 1.04),
    new THREE.Vector3(hs * 0.45, 0, projection),
    new THREE.Vector3(hs * 0.92, 0, projection * 0.72),
    new THREE.Vector3(hs, 0, 0.001),
  ]);
  return new THREE.TubeGeometry(curve, 22, tubeRadius, 10, false);
}

/**
 * Pillowed retro rounded-edge appliance slab (for Smeg/1950s vintage rounded refrigerator
 * carcass & gently cambered convex doors). Bulges smoothly outward on the front face
 * (camberAxis) while keeping generous pillowy corners.
 */
export function createRetroPillowedSlabGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius = 0.075,
  frontBulge = 0.022,
  frontSign: -1 | 1 = -1,
  topDome = 0.008
): THREE.BufferGeometry {
  const maxR = Math.min(width, height, depth) * 0.46;
  const geo = new RoundedBoxGeometry(
    width,
    height,
    depth,
    8,
    Math.min(cornerRadius, maxR)
  );
  const pos = geo.attributes.position;
  const hw = width * 0.5;
  const hh = height * 0.5;
  const hd = depth * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);

    const nx = hw > 1e-4 ? THREE.MathUtils.clamp(x / hw, -1, 1) : 0;
    const ny = hh > 1e-4 ? THREE.MathUtils.clamp(y / hh, -1, 1) : 0;
    const nz = hd > 1e-4 ? THREE.MathUtils.clamp(z / hd, -1, 1) : 0;

    // Smooth convex outward camber on the front door face (local X = frontSign * hw)
    const frontFactor = THREE.MathUtils.clamp((nx * frontSign - 0.15) / 0.85, 0, 1);
    const camberProfile = Math.cos(ny * Math.PI * 0.46) * Math.cos(nz * Math.PI * 0.46);
    x += frontSign * frontBulge * frontFactor * camberProfile;

    // Subtle domed top crown (classic rounded vintage refrigerator roof)
    if (topDome > 0 && ny > 0.25) {
      const topW = (ny - 0.25) / 0.75;
      y += topDome * topW * Math.cos(nx * Math.PI * 0.46) * Math.cos(nz * Math.PI * 0.46);
    }

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export interface CraftedCabinetFrontOptions {
  width: number;
  height: number;
  depth: number;
  facingAxis: 'x' | 'z';
  facingSign: 1 | -1;
  frameMat: THREE.Material;
  panelMat: THREE.Material;
  grooveMat: THREE.Material;
  handleMat?: THREE.Material;
  handleKind?: 'knob' | 'arch_h' | 'arch_v' | 'none';
  handleAlign?: -1 | 0 | 1;
  handleYOffset?: number;
  stileWidth?: number;
}

/**
 * High-detail architectural recessed Shaker wood cabinet door / drawer front:
 * - True 3D perimeter stiles & rails projecting cleanly forward around a recessed inner panel
 * - Routed bevel shadow step around the inner panel perimeter for rich tactile wood joinery
 * - Choice of turned copper-brass round knob or bowed arch pull handle
 */
export function createCraftedCabinetFront(opts: CraftedCabinetFrontOptions): THREE.Group {
  const {
    width,
    height,
    depth,
    facingAxis,
    facingSign,
    frameMat,
    panelMat,
    grooveMat,
    handleMat,
    handleKind = 'knob',
    handleAlign = 0,
    handleYOffset = 0,
    stileWidth,
  } = opts;

  const g = new THREE.Group();
  const sw = stileWidth ?? Math.min(0.050, Math.min(width, height) * 0.22);
  const railH = Math.min(sw, height * 0.24);
  const innerW = Math.max(0.03, width - sw * 2);
  const innerH = Math.max(0.025, height - railH * 2);

  // 1. Solid backing core + recessed center wood panel (sits 6.5mm behind front rail plane)
  const panelThick = Math.max(0.010, depth - 0.0075);
  const panelShift = -facingSign * (depth * 0.5 - panelThick * 0.5);
  const centerGeo =
    facingAxis === 'z'
      ? createBeveledBox(width - 0.006, height - 0.006, panelThick, 0.0025, 1)
      : createBeveledBox(panelThick, height - 0.006, width - 0.006, 0.0025, 1);
  const centerPanel = new THREE.Mesh(centerGeo, panelMat);
  if (facingAxis === 'x') centerPanel.position.x = panelShift;
  else centerPanel.position.z = panelShift;
  centerPanel.castShadow = true;
  centerPanel.receiveShadow = true;
  g.add(centerPanel);

  // 2. Stepped inner routed bevel collar framing the recessed panel (creates crisp wood joinery shadow!)
  const beadThick = 0.0055;
  const beadWidth = 0.0085;
  const beadX = facingSign * (depth * 0.5 - 0.0055);
  const addBead = (bw: number, bh: number, offsetU: number, offsetY: number) => {
    const geo =
      facingAxis === 'z'
        ? createBeveledBox(bw, bh, beadThick, 0.0018, 1)
        : createBeveledBox(beadThick, bh, bw, 0.0018, 1);
    const m = new THREE.Mesh(geo, grooveMat);
    if (facingAxis === 'x') m.position.set(beadX, offsetY, offsetU);
    else m.position.set(offsetU, offsetY, beadX);
    g.add(m);
  };
  for (const sy of [-1, 1]) {
    addBead(innerW + beadWidth * 0.5, beadWidth, 0, sy * (innerH * 0.5 - beadWidth * 0.35));
  }
  for (const su of [-1, 1]) {
    addBead(beadWidth, Math.max(0.015, innerH - beadWidth * 0.8), su * (innerW * 0.5 - beadWidth * 0.35), 0);
  }

  // 3. Full-depth perimeter vertical stiles & horizontal rails (strictly flush with exact width × height)
  const addFrameBar = (bw: number, bh: number, offsetU: number, offsetY: number) => {
    const geo =
      facingAxis === 'z'
        ? createBeveledBox(bw, bh, depth, 0.0038, 2)
        : createBeveledBox(depth, bh, bw, 0.0038, 2);
    const m = new THREE.Mesh(geo, frameMat);
    if (facingAxis === 'x') m.position.set(0, offsetY, offsetU);
    else m.position.set(offsetU, offsetY, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };

  // Left & Right full-height vertical stiles (exact outer edges at ±width/2)
  for (const su of [-1, 1]) {
    addFrameBar(sw, height, su * (width * 0.5 - sw * 0.5), 0);
  }
  // Top & Bottom horizontal rails fitted tightly between the stiles (exact outer edges at ±height/2)
  for (const sy of [-1, 1]) {
    addFrameBar(innerW + 0.002, railH, 0, sy * (height * 0.5 - railH * 0.5));
  }

  // 4. Sculpted Hardware (Turned Copper-Brass Round Knob OR Bowed Arch Pull)
  if (handleMat && handleKind !== 'none') {
    const facePos = facingSign * (depth * 0.5);
    const lateralU =
      handleAlign === 0 ? 0 : handleAlign * (width * 0.5 - Math.max(sw * 0.52, 0.028));

    if (handleKind === 'knob') {
      const knobGeo = createCopperKnobGeometry(1.0);
      const knob = new THREE.Mesh(knobGeo, handleMat);
      if (facingAxis === 'x') {
        knob.rotation.z = facingSign > 0 ? -Math.PI / 2 : Math.PI / 2;
        knob.position.set(facePos, handleYOffset, lateralU);
      } else {
        knob.rotation.x = facingSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        knob.position.set(lateralU, handleYOffset, facePos);
      }
      knob.castShadow = true;
      g.add(knob);
    } else {
      const span =
        handleKind === 'arch_h'
          ? Math.min(0.122, width * 0.32)
          : Math.min(0.115, height * 0.28);
      const archGeo = createArchedCabinetPullGeometry(span, 0.023, 0.005);
      const arch = new THREE.Mesh(archGeo, handleMat);
      if (handleKind === 'arch_v') {
        arch.rotation.z = Math.PI / 2;
      }
      if (facingAxis === 'x') {
        arch.rotation.y = facingSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        arch.position.set(facePos, handleYOffset, lateralU);
      } else {
        if (facingSign < 0) arch.rotation.y = Math.PI;
        arch.position.set(lateralU, handleYOffset, facePos);
      }
      arch.castShadow = true;
      g.add(arch);

      // Small circular mounting escutcheon bases at each end of the arch pull
      const footGeo = new THREE.CylinderGeometry(0.0085, 0.0095, 0.005, 12);
      for (const sgn of [-1, 1]) {
        const foot = new THREE.Mesh(footGeo, handleMat);
        if (facingAxis === 'x') {
          foot.rotation.z = Math.PI / 2;
          foot.position.set(
            facePos + facingSign * 0.002,
            handleKind === 'arch_v' ? handleYOffset + sgn * (span * 0.5) : handleYOffset,
            handleKind === 'arch_h' ? lateralU + sgn * (span * 0.5) : lateralU
          );
        } else {
          foot.rotation.x = Math.PI / 2;
          foot.position.set(
            handleKind === 'arch_h' ? lateralU + sgn * (span * 0.5) : lateralU,
            handleKind === 'arch_v' ? handleYOffset + sgn * (span * 0.5) : handleYOffset,
            facePos + facingSign * 0.002
          );
        }
        g.add(foot);
      }
    }
  }

  return g;
}

/**
 * Creates a 3D sculpted broad botanical leaf blade (Monstera / Fiddle-Leaf Fig /
 * Bird-of-Paradise style) anchored at its petiole base (0,0,0) and arching
 * gracefully outward along +Z with a central midrib crease and organic wave.
 */
export function createBroadLeafGeometry(
  length: number,
  width: number,
  archBend = 0.26,
  cupFold = 0.14
): THREE.BufferGeometry {
  const segU = 12;
  const segV = 18;
  const geo = new THREE.PlaneGeometry(width, length, segU, segV);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = THREE.MathUtils.clamp(uv.getX(i), 0, 1) * 2.0 - 1.0; // -1 .. 1 across width
    const v = THREE.MathUtils.clamp(uv.getY(i), 0, 1); // 0 (base) .. 1 (tip)

    // Broad ovate / fiddle-leaf silhouette envelope
    const baseTaper = Math.sin(Math.pow(v, 0.58) * Math.PI);
    const fiddleWave = 1.0 + 0.14 * Math.sin(v * Math.PI * 2.5);
    const halfSpan = (width * 0.5) * Math.max(0.04, baseTaper * fiddleWave);

    const lx = u * halfSpan;
    const lz = v * length;

    // Graceful upward lift near base transitioning into a natural downward arch toward tip
    const archY =
      Math.sin(v * Math.PI * 0.68) * (length * 0.14) -
      Math.pow(v, 1.85) * (length * archBend);

    // V-shaped midrib crease in the center + soft cambered leaf margin
    const absU = Math.abs(u);
    const midribCrease = (absU * 0.75 - Math.pow(absU, 2.2) * 0.45) * width * cupFold * Math.sin(v * Math.PI);
    // Subtle organic margin undulation
    const marginRipple = Math.sin(v * Math.PI * 4.0) * (absU * absU) * width * 0.028;

    pos.setXYZ(i, lx, archY + midribCrease + marginRipple, lz);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a MiSide-style relaxed throw pillow geometry:
 * - Swollen, plump center belly (中间鼓胀)
 * - Four pinched, tapered corner ears (四角捏尖)
 * - Subtle diagonal & seam gather wrinkles and soft gravity slump (略带褶皱的松弛枕头造型)
 */
export function createPinchedPlumpPillowGeometry(
  width = 0.36,
  height = 0.34,
  thickness = 0.145,
  wrinkleSeed = 0.0
): THREE.BufferGeometry {
  const segX = 24;
  const segY = 24;
  const segZ = 12;
  const geo = new THREE.BoxGeometry(width, height, thickness, segX, segY, segZ);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const halfT = thickness * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const nx = halfW > 1e-5 ? vx / halfW : 0; // -1 .. 1
    const ny = halfH > 1e-5 ? vy / halfH : 0; // -1 .. 1
    const nz = halfT > 1e-5 ? vz / halfT : 0; // -1 .. 1

    const ax = Math.min(1, Math.abs(nx));
    const ay = Math.min(1, Math.abs(ny));
    const az = Math.min(1, Math.abs(nz));

    // Radial distance from center on face (0 at center, ~1.414 at corners)
    const r2 = nx * nx + ny * ny;
    // Corner proximity factor (peaks near the 4 corners |nx|≈1, |ny|≈1)
    const cornerFactor = Math.pow(ax * ay, 1.35);
    // Mid-edge waist tuck (scalloped inward along the 4 edges between corners)
    const edgeWaistX = (1.0 - ax * ax) * Math.pow(ay, 1.8);
    const edgeWaistY = (1.0 - ay * ay) * Math.pow(ax, 1.8);

    // 1. 四角轻捏造型 (Softly shaped corners without spiky polygonal tips)
    const earExtend = 1.0 + cornerFactor * 0.115 - (edgeWaistX + edgeWaistY) * 0.048;
    // Subtle gravity slump: bottom half slightly fuller & wider than top half
    const gravitySlump = 1.0 - ny * 0.046;

    const sx = vx * earExtend * gravitySlump;
    let sy = vy * (1.0 + cornerFactor * 0.105 - (edgeWaistX + edgeWaistY) * 0.044);

    // Slight organic corner droop on upper ears + gentle asymmetry from wrinkleSeed
    if (ny > 0.15) {
      sy -= cornerFactor * height * (0.032 + 0.011 * Math.sin(wrinkleSeed + nx * 1.8));
    }

    // 2. 中间鼓胀、边缘柔和收拢 (Plump center belly tapering softly to sewn edges without razor-thin tips)
    const centerDome = Math.max(0, 1.0 - r2 * 0.54);
    const domeProfile = Math.pow(centerDome, 0.62);
    const cornerPinchZ = Math.max(0.18, 1.0 - cornerFactor * 0.76);
    const seamTaper = Math.pow(Math.max(0.12, 1.0 - Math.pow(Math.max(ax, ay), 3.3) * 0.78), 0.54);

    // 3. 略带褶皱的松弛枕头表面 (Soft corner gather creases + gentle diagonal fabric drape folds)
    const angle = Math.atan2(ny, nx);
    const cornerGatherCrease =
      Math.sin(angle * 8.0 + wrinkleSeed * 1.7) *
      cornerFactor *
      (1.0 - cornerFactor * 0.45) *
      0.075;
    const diagonalDrapeFold =
      Math.sin((nx * 3.6 + ny * 3.0) + wrinkleSeed * 2.3) *
      Math.exp(-r2 * 1.05) *
      0.044;
    const microPinchPleat =
      Math.cos((nx - ny) * 6.0 - wrinkleSeed) *
      (ax * (1.0 - ax) + ay * (1.0 - ay)) *
      0.028;

    const zEnvelope =
      (0.32 + domeProfile * 1.08) * cornerPinchZ * seamTaper +
      cornerGatherCrease +
      diagonalDrapeFold +
      microPinchPleat;

    // Smoothly round box Z profile into a plush cushion cross-section
    const signZ = nz >= 0 ? 1 : -1;
    const roundedZ = signZ * Math.pow(az, 0.58);
    const sz = roundedZ * halfT * Math.max(0.08, zEnvelope);

    pos.setXYZ(i, sx, sy, sz);
    if (uv) {
      uv.setXY(i, (nx + 1) * 0.5, (ny + 1) * 0.5);
    }
  }

  pos.needsUpdate = true;
  if (uv) uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates a MiSide-style sofa back cushion (沙发靠垫) with soft, rounded plush
 * corners (never sharp or spiky), full velvety pillow loft, gentle organic
 * fabric wrinkles & gravity settle, and a natural shallow central button-tuft
 * dimple on the front (+Z) face.
 */
export function createPinchedTuftedBackCushionGeometry(
  width = 0.94,
  height = 0.54,
  thickness = 0.21,
  wrinkleSeed = 0.0,
  tuftDepth = 0.015
): THREE.BufferGeometry {
  const segX = 28;
  const segY = 24;
  const segZ = 14;
  const geo = new THREE.BoxGeometry(width, height, thickness, segX, segY, segZ);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const halfT = thickness * 0.5;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);

    const nx = halfW > 1e-5 ? vx / halfW : 0; // -1 .. 1
    const ny = halfH > 1e-5 ? vy / halfH : 0; // -1 .. 1
    const nz = halfT > 1e-5 ? vz / halfT : 0; // -1 .. 1

    const ax = Math.min(1, Math.abs(nx));
    const ay = Math.min(1, Math.abs(ny));
    const az = Math.min(1, Math.abs(nz));

    const r2 = nx * nx + ny * ny;
    const rDist = Math.sqrt(r2);
    const cornerFactor = Math.pow(ax * ay, 1.85);
    const edgeWaistX = (1.0 - ax * ax) * Math.pow(ay, 2.2);
    const edgeWaistY = (1.0 - ay * ay) * Math.pow(ax, 2.2);

    // 1. Softly rounded pillow corners (pulling corner vertices gently INWARD so edges are plush & round, never sharp!)
    const cornerRoundScale = 1.0 - cornerFactor * 0.055 - (edgeWaistX + edgeWaistY) * 0.012;
    const gravitySlump = 1.0 - ny * 0.028;

    const sx = vx * cornerRoundScale * gravitySlump;
    let sy = vy * (1.0 - cornerFactor * 0.052 - (edgeWaistX + edgeWaistY) * 0.012);
    if (ny > 0.25) {
      sy -= cornerFactor * height * (0.014 + 0.005 * Math.sin(wrinkleSeed + nx * 1.6));
    }

    // 2. Full, velvety pillow loft with thick, softly rolled edges (zero knife-edge corners!)
    const centerDome = Math.max(0, 1.0 - r2 * 0.44);
    const domeProfile = Math.pow(centerDome, 0.58);
    const cornerPinchZ = Math.max(0.50, 1.0 - cornerFactor * 0.42);
    const edgeNorm = Math.max(ax, ay);
    const seamTaper = Math.pow(Math.max(0.36, 1.0 - Math.pow(edgeNorm, 3.8) * 0.54), 0.46);

    // 3. Subtle, natural upholstery drape folds (smooth low-frequency plushness)
    const angle = Math.atan2(ny, nx);
    const cornerGatherCrease =
      Math.sin(angle * 6.0 + wrinkleSeed * 1.4) *
      cornerFactor *
      (1.0 - cornerFactor * 0.5) *
      0.024;
    const diagonalDrapeFold =
      Math.sin((nx * 3.0 + ny * 2.6) + wrinkleSeed * 2.1) *
      Math.exp(-r2 * 1.15) *
      (1.0 - Math.exp(-r2 / 0.08)) *
      0.022;
    const microPinchPleat =
      Math.cos((nx - ny) * 5.2 - wrinkleSeed) *
      (ax * (1.0 - ax) + ay * (1.0 - ay)) *
      0.014;

    const zEnvelope =
      (0.46 + domeProfile * 0.84) * cornerPinchZ * seamTaper +
      cornerGatherCrease +
      diagonalDrapeFold +
      microPinchPleat;

    // Soft pillowy Z rounding curve (0.54 exponent gives thick cushioned side-walls instead of sharp bevels)
    const signZ = nz >= 0 ? 1 : -1;
    const roundedZ = signZ * Math.pow(az, 0.54);
    let sz = roundedZ * halfT * Math.max(0.24, zEnvelope);

    // 4. Natural, shallow central button-tuft dimple & soft radiating folds on front (+Z) face
    if (nz > 0.20) {
      const frontWeight = Math.min(1, (nz - 0.20) / 0.65);
      // Wide, gentle bell-curve dimple (avoids sharp funnel hole!)
      const buttonDimple = Math.exp(-r2 / 0.095);
      const crownRingSwell = Math.exp(-Math.pow(rDist - 0.44, 2) / 0.11) * 0.22;

      const diag1 = Math.abs(nx - ny) / Math.SQRT2;
      const diag2 = Math.abs(nx + ny) / Math.SQRT2;
      const xCrease =
        (Math.exp(-(diag1 * diag1) / 0.036) + Math.exp(-(diag2 * diag2) / 0.036)) *
        Math.exp(-rDist * 1.35) *
        (1.0 - Math.exp(-r2 / 0.018));

      const crossCrease =
        (Math.exp(-(nx * nx) / 0.042) + Math.exp(-(ny * ny) / 0.042)) *
        Math.exp(-rDist * 1.45) *
        (1.0 - Math.exp(-r2 / 0.020));

      const netIndent =
        (buttonDimple * 0.78 + xCrease * 0.26 + crossCrease * 0.16 - crownRingSwell) *
        tuftDepth *
        frontWeight;
      sz -= netIndent;
    }

    pos.setXYZ(i, sx, sy, sz);
    if (uv) {
      uv.setXY(i, (nx + 1) * 0.5, (ny + 1) * 0.5);
    }
  }

  pos.needsUpdate = true;
  if (uv) uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}


/**
 * Helper to remap a non-indexed BufferGeometry's UVs linearly into a sub-rectangle
 * [u0..u1] x [v0..v1] of a texture atlas.
 */
function remapPartUVs(
  rawGeo: THREE.BufferGeometry,
  u0: number,
  u1: number,
  v0: number,
  v1: number
): THREE.BufferGeometry {
  const geo = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone();
  const uv = geo.attributes.uv;
  if (uv) {
    const du = u1 - u0;
    const dv = v1 - v0;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * du, v0 + uv.getY(i) * dv);
    }
    uv.needsUpdate = true;
  }
  if (rawGeo !== geo) rawGeo.dispose();
  return geo;
}

/**
 * Builds a true 3-part sculpted hardcover/paperback book geometry (merged into a
 * single draw call) eliminating the flat cardboard-box silhouette:
 * 1) Naturally arched/crowned curved spine wrapping smoothly into hinge grooves
 * 2) Front & back cover boards with authentic physical thickness overhanging top,
 *    bottom, and fore-edge
 * 3) Recessed ivory/cream paper page block physically inset inside the cover boards
 *
 * Maps UVs cleanly into the 4x4 (16-variant) light-toned `textures.bookCoverAtlas`
 * across all three orientations:
 * - Upright along X (width < depth): spine faces +Z, covers on ±X
 * - Upright along Z (depth < width): spine faces +X, covers on ±Z
 * - Flat horizontal (height < width && height < depth): spine faces +Z, covers on ±Y
 */
export function createBookGeometry(
  width: number,
  height: number,
  depth: number,
  variantIndex = 0
): THREE.BufferGeometry {
  const idx = ((variantIndex % 16) + 16) % 16;
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const tileU0 = col * 0.25;
  // FlipY=true on CanvasTexture: row 0 is top of canvas (v in [0.75..1.0])
  const tileV1 = 1.0 - row * 0.25;
  const tileV0 = tileV1 - 0.25;

  const spineU0 = tileU0 + 0.025 * 0.25;
  const spineU1 = tileU0 + 0.215 * 0.25;
  const coverU0 = tileU0 + 0.245 * 0.25;
  const coverU1 = tileU0 + 0.855 * 0.25;
  const pageU0 = tileU0 + 0.885 * 0.25;
  const pageU1 = tileU0 + 0.985 * 0.25;
  const padV0 = tileV0 + 0.02 * 0.25;
  const padV1 = tileV1 - 0.02 * 0.25;

  // Build canonical upright book in canonical local frame:
  //   X = thickness (T), Y = height (H), Z = cover depth (D)
  //   Spine curves outward along +Z; recessed fore-edge pages face -Z.
  const isFlatY = height < width && height < depth;
  const isUprightZThin = !isFlatY && depth < width;

  let T = width;
  let H = height;
  let D = depth;
  if (isFlatY) {
    T = height;
    H = width;
    D = depth;
  } else if (isUprightZThin) {
    T = depth;
    H = height;
    D = width;
  }

  // Real physical book proportions: cover boards wrap & overhang recessed page block,
  // and a naturally arched curved spine completely encloses the +Z spine face.
  const boardT = Math.min(T * 0.18, Math.max(0.0024, T * 0.11));
  const overhangY = Math.min(0.0055, H * 0.024);
  const overhangFore = Math.min(0.006, D * 0.032);
  const spineCrown = Math.min(0.011, Math.max(0.0042, T * 0.28));
  const spineBaseZ = D * 0.5 - spineCrown;
  const shoulderSkirt = Math.min(0.0035, D * 0.025);

  const pageT = Math.max(0.003, T - boardT * 2.08);
  const pageH = Math.max(0.02, H - overhangY * 2.0);
  // Keep page block strictly behind spineBaseZ so ivory pages ONLY show on top, bottom & back fore-edge (-Z)
  const pageMinZ = -D * 0.5 + overhangFore;
  const pageMaxZ = spineBaseZ - 0.0018;
  const pageD = Math.max(0.02, pageMaxZ - pageMinZ);
  const pageCenterZ = (pageMinZ + pageMaxZ) * 0.5;

  const parts: THREE.BufferGeometry[] = [];

  // 1) Recessed Cream Paper Page Block (visible ONLY on top +Y, bottom -Y, and back fore-edge -Z)
  const pageRaw = new THREE.BoxGeometry(pageT, pageH, pageD, 1, 2, 1);
  // Subtle concave fore-edge curve on -Z pages (like a real read book!)
  const pPos = pageRaw.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    if (pPos.getZ(i) < 0) {
      const nx = pPos.getX(i) / Math.max(1e-4, pageT * 0.5);
      pPos.setZ(i, pPos.getZ(i) + (1.0 - nx * nx) * Math.min(0.0028, pageT * 0.12));
    }
  }
  pPos.needsUpdate = true;
  pageRaw.computeVertexNormals();
  pageRaw.translate(0, 0, pageCenterZ);
  parts.push(remapPartUVs(pageRaw, pageU0, pageU1, padV0, padV1));

  // 2) Front (+X) & Back (-X) Thick Overhanging Cover Boards (tuck cleanly into spine shoulder)
  const coverMinZ = -D * 0.5;
  const coverMaxZ = spineBaseZ + 0.0008;
  const coverD = Math.max(0.02, coverMaxZ - coverMinZ);
  const coverCenterZ = (coverMinZ + coverMaxZ) * 0.5;
  for (const side of [-1, 1] as const) {
    const boardRaw = new THREE.BoxGeometry(boardT, H, coverD, 1, 2, 2);
    // Subtle French hinge crease indentation right next to the spine (+Z edge)
    const bPos = boardRaw.attributes.position;
    const halfCD = coverD * 0.5;
    for (let i = 0; i < bPos.count; i++) {
      const bz = bPos.getZ(i);
      const bx = bPos.getX(i);
      if (bz > halfCD * 0.72 && bz < halfCD * 0.96 && bx * side > 0) {
        bPos.setX(i, bx - side * boardT * 0.24);
      }
    }
    bPos.needsUpdate = true;
    boardRaw.computeVertexNormals();
    boardRaw.translate(side * (T * 0.5 - boardT * 0.5), 0, coverCenterZ);
    parts.push(remapPartUVs(boardRaw, coverU0, coverU1, padV0, padV1));
  }

  // 3) Naturally Arched Curved Spine Shell (+Z outward face, 10 smooth radial arch segments)
  const spineHalfX = T * 0.5 + 0.0003;
  const archShape = new THREE.Shape();
  const segs = 10;
  // Left shoulder skirt overlapping cover board seamlessly -> smooth outward crown arch -> right shoulder skirt
  archShape.moveTo(-spineHalfX, -shoulderSkirt);
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    const ang = Math.PI * (1 - t); // PI (-X) -> 0 (+X)
    const sx = Math.cos(ang) * spineHalfX;
    // Smooth elliptical crown arching outward in +Y (becomes +Z after rotateX(+PI/2))
    const sy = Math.sin(ang) * spineCrown;
    archShape.lineTo(sx, sy);
  }
  archShape.lineTo(spineHalfX, -shoulderSkirt);
  // Inner concave arc returning from +X to -X
  const innerHalfX = Math.max(0.001, spineHalfX - boardT * 0.95);
  const innerCrown = Math.max(0.0006, spineCrown - boardT * 0.88);
  archShape.lineTo(innerHalfX, -shoulderSkirt);
  for (let s = segs; s >= 0; s--) {
    const t = s / segs;
    const ang = Math.PI * (1 - t);
    const sx = Math.cos(ang) * innerHalfX;
    const sy = Math.sin(ang) * innerCrown - 0.0006;
    archShape.lineTo(sx, sy);
  }
  archShape.lineTo(-innerHalfX, -shoulderSkirt);
  archShape.closePath();

  const spineRaw = new THREE.ExtrudeGeometry(archShape, {
    depth: H,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 4,
  });
  // ExtrudeGeometry extrudes along +Z from 0..H.
  // rotateX(+Math.PI / 2) maps (x, y, z) -> (x, -z, +y), so the arch (+y) points OUTWARD (+Z)!
  spineRaw.rotateX(Math.PI / 2);
  spineRaw.translate(0, H * 0.5, spineBaseZ);

  // Assign smooth arc-length cylindrical spine UVs so vertical typography, color blocks & obi wrap naturally
  const spineNonIdx = spineRaw.index ? spineRaw.toNonIndexed() : spineRaw;
  const sPos = spineNonIdx.attributes.position;
  const sUv = spineNonIdx.attributes.uv;
  for (let i = 0; i < sPos.count; i++) {
    const nx = THREE.MathUtils.clamp(sPos.getX(i) / Math.max(1e-4, spineHalfX), -1, 1);
    // Arc-length normalized U from left (-X = 0) across crown (0 = 0.5) to right (+X = 1)
    const ux = 1.0 - Math.acos(nx) / Math.PI;
    const vy = THREE.MathUtils.clamp((sPos.getY(i) / Math.max(1e-4, H)) + 0.5, 0, 1);
    sUv.setXY(
      i,
      spineU0 + ux * (spineU1 - spineU0),
      padV0 + vy * (padV1 - padV0)
    );
  }
  sUv.needsUpdate = true;
  spineNonIdx.computeVertexNormals();
  if (spineNonIdx !== spineRaw) spineRaw.dispose();
  parts.push(spineNonIdx);

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) {
    return new THREE.BoxGeometry(width, height, depth);
  }

  // Rotate from canonical (X=T, Y=H, Z=D, spine=+Z) to requested orientation
  if (isFlatY) {
    // Rotate +90 deg around Z: local X (thickness) -> +Y, local Y (height) -> -X, local Z (depth/spine) stays +Z
    merged.rotateZ(Math.PI / 2);
  } else if (isUprightZThin) {
    // Rotate +90 deg around Y: local Z (depth/spine) -> +X (spine faces outward!), local X (thickness) -> -Z
    merged.rotateY(Math.PI / 2);
  }

  merged.computeVertexNormals();
  return merged;
}

/**
 * Builds a sculpted 16-bit / 32-bit retro game cartridge geometry (SFC / Famicom / GB style)
 * with top grip ridges, stepped shoulder bevels, recessed front art sticker bay, and bottom pin bay.
 */
export function createRetroCartridgeGeometry(
  width = 0.115,
  height = 0.082,
  depth = 0.020
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const mainBody = createBeveledBox(width, height, depth, 0.0035, 2);
  parts.push(mainBody.index ? mainBody.toNonIndexed() : mainBody);

  // Raised top-left & top-right grip ridges characteristic of classic cartridges
  for (let r = 0; r < 3; r++) {
    const ry = height * 0.30 + r * (height * 0.075);
    const ridge = new THREE.BoxGeometry(width * 0.86, height * 0.024, depth + 0.0026);
    ridge.translate(0, ry, 0);
    parts.push(ridge.index ? ridge.toNonIndexed() : ridge);
  }

  // Slightly stepped lower connector skirt
  const lowerLip = new THREE.BoxGeometry(width * 0.82, height * 0.16, depth * 0.78);
  lowerLip.translate(0, -height * 0.44, 0);
  parts.push(lowerLip.index ? lowerLip.toNonIndexed() : lowerLip);

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  if (!merged) return createBeveledBox(width, height, depth, 0.003, 2);
  merged.computeVertexNormals();
  return merged;
}

/**
 * Builds a 12-inch vinyl LP cardboard jacket with clean UVs mapped into
 * `textures.vinylSleeveAtlas` (4x2 = 8 distinct album covers).
 * Local frame: X = sleeve thickness (0.005..0.009m), Y = 0.315m, Z = 0.315m.
 * Spine faces +Z; square album cover art displays cleanly on ±X faces!
 */
export function createVinylSleeveGeometry(
  thickness = 0.007,
  size = 0.315,
  variantIndex = 0
): THREE.BufferGeometry {
  const idx = ((variantIndex % 8) + 8) % 8;
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  const tileU0 = col * 0.25;
  const tileV1 = 1.0 - row * 0.5;
  const tileV0 = tileV1 - 0.5;

  const spineU0 = tileU0 + 0.005 * 0.25;
  const spineU1 = tileU0 + 0.074 * 0.25;
  const artU0 = tileU0 + 0.082 * 0.25;
  const artU1 = tileU0 + 0.992 * 0.25;
  const padV0 = tileV0 + 0.01 * 0.5;
  const padV1 = tileV1 - 0.01 * 0.5;

  const geo = new THREE.BoxGeometry(thickness, size, size, 1, 1, 1);
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const nx = norm.getX(i);
    const uOrig = uv.getX(i);
    const vOrig = uv.getY(i);
    if (Math.abs(nx) > 0.6) {
      // Front/Back 12-inch square cover art
      uv.setXY(i, artU0 + uOrig * (artU1 - artU0), padV0 + vOrig * (padV1 - padV0));
    } else {
      // Narrow printed jacket spine & edges
      uv.setXY(i, spineU0 + uOrig * (spineU1 - spineU0), padV0 + vOrig * (padV1 - padV0));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

