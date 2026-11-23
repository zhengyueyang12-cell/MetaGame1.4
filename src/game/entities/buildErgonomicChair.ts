import * as THREE from 'three';
import { createBeveledBox, createBeveledSlab } from '../geometries';
import {
  createTwilightMaterial,
  type OutlineRegistry,
  type TwilightUniforms,
} from '../pipeline';

export interface ErgonomicChairTheme {
  /** Satin molded ABS / nylon polymer chair shell & Y-spine frame (塑料椅身) */
  plasticFrameHex: number;
  /** Secondary darker/contrast polymer accent for caster hoods, gas shroud & lumbar bracket */
  plasticAccentHex: number;
  /** Breathable ergonomic mesh backrest & woven breathable seat cushion (透气椅垫) */
  meshCushionHex: number;
  /** Deep inner pore tint for breathable honeycomb/weave mesh texture */
  meshPoreHex: string;
  /** Base knit thread color for breathable mesh texture */
  meshBaseHex: string;
  /** Highlight weave thread for breathable mesh texture */
  meshHighlightHex: string;
  /** Soft-touch matte PU armrest pad color */
  armPadHex: number;
  /** Pneumatic gas piston / hub metal finish */
  metalHex: number;
  /** Initial seat swivel angle (radians) */
  initialSeatYaw: number;
}

export interface ErgonomicChairResult {
  rootGroup: THREE.Group;
  seatGroup: THREE.Group;
}

/**
 * Generates paired procedural CanvasTextures (albedo + bump) for breathable ergonomic
 * honeycomb/micro-perforated mesh upholstery so the breathable seat & backrest read
 * unmistakably distinct from the smooth satin-matte molded polymer chair shell.
 */
function createBreathableMeshTextures(
  baseHex: string,
  poreHex: string,
  highlightHex: string
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  const b = document.createElement('canvas');
  b.width = size;
  b.height = size;
  const bctx = b.getContext('2d')!;

  // Base breathable woven fabric
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#c8c8c8';
  bctx.fillRect(0, 0, size, size);

  // Fine cross-woven ergonomic knit micro-threads
  ctx.strokeStyle = highlightHex;
  ctx.lineWidth = 1.1;
  bctx.strokeStyle = '#ececec';
  bctx.lineWidth = 1.1;
  for (let i = 0; i < size; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();

    bctx.beginPath();
    bctx.moveTo(0, i);
    bctx.lineTo(size, i);
    bctx.stroke();
  }

  // Staggered hexagonal breathable airflow micro-perforations (ergonomic mesh look!)
  const cellX = 10;
  const cellY = 8;
  for (let row = 0; row * cellY < size + cellY; row++) {
    const offsetX = (row % 2) * (cellX * 0.5);
    for (let col = -1; col * cellX < size + cellX; col++) {
      const px = col * cellX + offsetX;
      const py = row * cellY;

      // Dark recessed breathability pore
      ctx.fillStyle = poreHex;
      ctx.beginPath();
      ctx.ellipse(px, py, 2.35, 1.85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tiny crisp top weave rim highlight catching light
      ctx.strokeStyle = highlightHex;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(px, py - 0.6, 2.4, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      // Deep pore recess in bump map for crisp micro-relief shading
      bctx.fillStyle = '#242424';
      bctx.beginPath();
      bctx.ellipse(px, py, 2.4, 1.9, 0, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.2, 3.2);
  map.anisotropy = 4;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3.2, 3.2);
  bumpMap.anisotropy = 4;
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

/**
 * Generates an ergonomically contoured waterfall-front seat cushion geometry:
 * subtly dished thigh bolsters along the sides, rounded front waterfall drop to relieve
 * knee pressure, and smooth soft-edge rounding.
 */
function createErgonomicSeatCushionGeometry(
  width: number,
  height: number,
  depth: number
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(width, height, depth, 18, 6, 18);
  const pos = geo.attributes.position;
  const hw = width * 0.5;
  const hh = height * 0.5;
  const hd = depth * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    const nx = x / hw; // -1..1
    const ny = y / hh; // -1..1
    const nz = z / hd; // -1..1 (-1 = front edge facing desk, +1 = rear toward backrest)

    // Smooth squircle corner rounding in XZ
    const rEdge = Math.hypot(Math.max(0, Math.abs(nx) - 0.68), Math.max(0, Math.abs(nz) - 0.68));
    if (rEdge > 0.001) {
      const pull = THREE.MathUtils.clamp(rEdge / 0.45, 0, 1);
      x *= 1 - 0.06 * pull * pull;
      z *= 1 - 0.06 * pull * pull;
    }

    // Soft pillowed bevel on top & bottom edges
    const edgeDist = Math.max(Math.abs(nx), Math.abs(nz));
    const bevel = Math.pow(THREE.MathUtils.clamp((edgeDist - 0.62) / 0.38, 0, 1), 1.9);
    y *= 1 - 0.42 * bevel;

    // Ergonomic seat contour on top face: gentle side bolsters + central seating dish
    if (ny > 0) {
      const sideBolster = Math.pow(Math.abs(nx), 2.2) * (1 - bevel) * 0.011;
      const centerDish = -Math.exp(-nx * nx * 2.4) * Math.exp(-(nz - 0.1) * (nz - 0.1) * 2.2) * 0.010;
      y += sideBolster + centerDish;
    }

    // Front waterfall edge droop (nz -> -1 curves gracefully downward!)
    if (nz < -0.52) {
      const wf = THREE.MathUtils.clamp((-nz - 0.52) / 0.48, 0, 1);
      y -= wf * wf * 0.026;
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Shared ergonomic backrest S-curve surface equation (in seatGroup coordinates):
 * guarantees zero clipping between the breathable mesh sheet, outer polymer frame,
 * adjustable rear lumbar support, and sculpted rear Y-spine bracket.
 */
const BACK_CENTER_Y = 0.805;
const BACK_HALF_H = 0.228;
const BACK_HALF_W = 0.214;

function evalBackrestWidthFactor(ny: number): number {
  return 0.90 + 0.10 * Math.sin((ny + 0.35) * 1.4) - 0.05 * Math.pow(Math.max(0, ny - 0.55), 2);
}

function evalBackrestZ(x: number, y: number): number {
  const ny = THREE.MathUtils.clamp((y - BACK_CENTER_Y) / BACK_HALF_H, -1.05, 1.05);
  const wScale = evalBackrestWidthFactor(ny);
  const nx = THREE.MathUtils.clamp(x / (BACK_HALF_W * wScale), -1.05, 1.05);
  const lumbarForward = -Math.exp(-Math.pow((ny + 0.34) / 0.48, 2)) * 0.032;
  const upperRecline = (ny + 0.45) * 0.036;
  const sideWrap = -Math.pow(Math.abs(nx), 1.85) * 0.026;
  return 0.232 + lumbarForward + upperRecline + sideWrap;
}

/**
 * Generates an S-curved taut breathable mesh backrest sheet whose vertices lie strictly
 * on `evalBackrestZ(x, y)` inside the polymer perimeter frame (zero interpenetration!).
 */
function createCurvedMeshBackrestGeometry(
  width: number,
  height: number,
  thickness = 0.010,
  centerY = BACK_CENTER_Y,
  zOffset = 0
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(width, height, thickness, 16, 20, 2);
  const pos = geo.attributes.position;
  const hh = height * 0.5;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const localY = pos.getY(i);
    const localZ = pos.getZ(i);

    const worldY = centerY + localY;
    const ny = THREE.MathUtils.clamp((worldY - BACK_CENTER_Y) / BACK_HALF_H, -1, 1);
    const widthProfile = evalBackrestWidthFactor(ny);
    x *= widthProfile;

    // Slight soft edge taper at very top/bottom corners so mesh seats cleanly inside frame
    const cornerTaper = Math.max(0, Math.abs(localY / hh) - 0.78) / 0.22;
    x *= 1 - 0.14 * cornerTaper * cornerTaper;

    const surfaceZ = evalBackrestZ(x, worldY) + zOffset;
    pos.setXYZ(i, x, worldY, surfaceZ + localZ);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a finely modeled modern Ergonomic Swivel Office Chair (人体工学椅) with clear
 * material & structural distinction between the sculpted satin-matte polymer frame (塑料椅身)
 * and the breathable micro-perforated ergonomic mesh & foam seat cushion (透气椅垫).
 *
 * Orientation convention (matching existing Bedroom & Basement desks):
 *   - Seat front faces local -Z (toward the desk)
 *   - Backrest sits at local +Z
 *   - Ground contact sits cleanly at Y = 0.000
 */
export function createErgonomicSwivelChair(
  uniforms: TwilightUniforms,
  outlines: OutlineRegistry,
  theme: ErgonomicChairTheme
): ErgonomicChairResult {
  const rootGroup = new THREE.Group();
  rootGroup.userData.dynamic = true;

  const mat = (opts: Parameters<typeof createTwilightMaterial>[1]) =>
    createTwilightMaterial(uniforms, opts);

  const { map: meshMap, bumpMap: meshBump } = createBreathableMeshTextures(
    theme.meshBaseHex,
    theme.meshPoreHex,
    theme.meshHighlightHex
  );

  // Distinct satin molded polymer / ABS plastic material (smooth, subtle specular sheen)
  const plasticFrameMat = mat({
    color: theme.plasticFrameHex,
    roughness: 0.38,
    metalness: 0.05,
    celStrength: 0.42,
  });
  const plasticAccentMat = mat({
    color: theme.plasticAccentHex,
    roughness: 0.46,
    metalness: 0.08,
    celStrength: 0.44,
  });
  // Breathable woven micro-perforated ergonomic mesh & seat cushion (matte, tactile, high bump)
  const meshBackMat = mat({
    map: meshMap,
    bumpMap: meshBump,
    bumpScale: 0.014,
    color: theme.meshCushionHex,
    roughness: 0.92,
    metalness: 0.0,
    celStrength: 0.48,
  });
  const breathableSeatMat = mat({
    map: meshMap,
    bumpMap: meshBump,
    bumpScale: 0.011,
    color: theme.meshCushionHex,
    roughness: 0.90,
    metalness: 0.0,
    celStrength: 0.46,
  });
  const armPadMat = mat({
    color: theme.armPadHex,
    roughness: 0.68,
    metalness: 0.02,
    celStrength: 0.42,
  });
  const metalMat = mat({
    color: theme.metalHex,
    roughness: 0.24,
    metalness: 0.84,
    celStrength: 0.28,
  });
  const wheelRubberMat = mat({
    color: 0x202229,
    roughness: 0.72,
    metalness: 0.06,
    celStrength: 0.42,
  });

  // =========================================================================
  // 1. 5-STAR MOLDED NYLON BASE, HOODED TWIN-WHEEL CASTERS & GAS LIFT
  // =========================================================================
  const baseGroup = new THREE.Group();
  baseGroup.userData.dynamic = true;
  rootGroup.add(baseGroup);

  // Central reinforced polymer spider hub
  const centerHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.052, 0.072, 18),
    plasticFrameMat
  );
  centerHub.position.y = 0.098;
  centerHub.castShadow = true;
  baseGroup.add(centerHub);

  // Telescoping pneumatic gas lift: stepped matte polymer dust shroud + shiny chrome piston
  const lowerShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.036, 0.145, 16),
    plasticAccentMat
  );
  lowerShroud.position.y = 0.185;
  baseGroup.add(lowerShroud);

  const upperShroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.030, 0.11, 16),
    plasticAccentMat
  );
  upperShroud.position.y = 0.285;
  baseGroup.add(upperShroud);

  const chromePiston = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.16, 14),
    metalMat
  );
  chromePiston.position.y = 0.365;
  baseGroup.add(chromePiston);

  // 5 arched sculpted polymer spider legs + hooded twin rolling casters
  const casterWheelGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.011, 14);
  casterWheelGeo.rotateZ(Math.PI / 2);

  for (let s = 0; s < 5; s++) {
    const ang = (s / 5) * Math.PI * 2;
    const legPivot = new THREE.Group();
    legPivot.rotation.y = ang;
    baseGroup.add(legPivot);

    // Tapered curved spider arm sloping from hub (Y=0.105) down to caster socket (Y=0.064, Z=0.285)
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.106, 0.032),
      new THREE.Vector3(0, 0.094, 0.135),
      new THREE.Vector3(0, 0.070, 0.245),
      new THREE.Vector3(0, 0.060, 0.290),
    ]);
    const armTube = new THREE.Mesh(
      new THREE.TubeGeometry(armCurve, 12, 0.018, 8, false),
      plasticFrameMat
    );
    armTube.scale.set(1.05, 0.72, 1.0);
    armTube.castShadow = true;
    armTube.receiveShadow = true;
    legPivot.add(armTube);

    // Caster socket boss at tip of spider leg
    const socket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.019, 0.024, 12),
      plasticFrameMat
    );
    socket.position.set(0, 0.056, 0.288);
    legPivot.add(socket);

    // Metallic caster swivel pin
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.022, 8),
      metalMat
    );
    pin.position.set(0, 0.038, 0.288);
    legPivot.add(pin);

    // Twin-wheel hooded rolling caster sitting flush at Y = 0.000
    const casterHood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.026, 12, 1, false, 0, Math.PI),
      plasticAccentMat
    );
    casterHood.rotation.z = Math.PI / 2;
    casterHood.position.set(0, 0.026, 0.292);
    legPivot.add(casterHood);

    for (const wx of [-0.013, 0.013]) {
      const wheel = new THREE.Mesh(casterWheelGeo, wheelRubberMat);
      wheel.position.set(wx, 0.024, 0.292);
      wheel.castShadow = true;
      legPivot.add(wheel);
    }
  }

  // =========================================================================
  // 2. SWIVELING ERGONOMIC UPPER ASSEMBLY (PLASTIC SHELL + BREATHABLE CUSHION)
  // =========================================================================
  const seatGroup = new THREE.Group();
  seatGroup.userData.dynamic = true;
  seatGroup.rotation.y = theme.initialSeatYaw;
  rootGroup.add(seatGroup);

  // 2A. Under-seat mechanical tilt control box + tension dial + height adjustment lever
  const mechBox = new THREE.Mesh(
    createBeveledBox(0.18, 0.055, 0.22, 0.008, 2),
    plasticAccentMat
  );
  mechBox.position.set(0, 0.422, 0.02);
  mechBox.castShadow = true;
  seatGroup.add(mechBox);

  const tensionKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.018, 0.048, 12),
    plasticAccentMat
  );
  tensionKnob.position.set(0, 0.382, -0.052);
  tensionKnob.rotation.x = 0.28;
  seatGroup.add(tensionKnob);

  // Right-side ergonomic height adjustment lever rod + contoured paddle handle
  const leverRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.16, 8),
    metalMat
  );
  leverRod.rotation.z = Math.PI / 2;
  leverRod.position.set(0.155, 0.415, -0.02);
  seatGroup.add(leverRod);

  const leverPaddle = new THREE.Mesh(
    createBeveledBox(0.058, 0.012, 0.032, 0.004, 2),
    plasticAccentMat
  );
  leverPaddle.position.set(0.242, 0.415, -0.02);
  seatGroup.add(leverPaddle);

  // 2B. Sculpted Molded Polymer Lower Seat Pan (塑料座壳 — crisp contrast framing the cushion!)
  const seatShellPan = new THREE.Mesh(
    createBeveledSlab(0.505, 0.036, 0.485, 0.068, 0.012),
    plasticFrameMat
  );
  seatShellPan.position.set(0, 0.456, 0.005);
  seatShellPan.castShadow = true;
  seatShellPan.receiveShadow = true;
  outlines.addOutline(seatShellPan, 1.016);
  seatGroup.add(seatShellPan);

  // Raised molded polymer rear & side trim lip hugging the seat cushion perimeter
  const seatTrimLipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.242, 0.474, -0.175),
    new THREE.Vector3(-0.252, 0.478, 0.02),
    new THREE.Vector3(-0.215, 0.480, 0.215),
    new THREE.Vector3(0.0, 0.482, 0.240),
    new THREE.Vector3(0.215, 0.480, 0.215),
    new THREE.Vector3(0.252, 0.478, 0.02),
    new THREE.Vector3(0.242, 0.474, -0.175),
  ]);
  const seatTrimLip = new THREE.Mesh(
    new THREE.TubeGeometry(seatTrimLipCurve, 28, 0.012, 8, false),
    plasticFrameMat
  );
  seatGroup.add(seatTrimLip);

  // 2C. Breathable Ergonomic Waterfall Seat Cushion (透气坐垫)
  const seatCushionGeo = createErgonomicSeatCushionGeometry(0.476, 0.064, 0.468);
  const seatCushion = new THREE.Mesh(seatCushionGeo, breathableSeatMat);
  seatCushion.position.set(0, 0.495, -0.004);
  seatCushion.castShadow = true;
  seatCushion.receiveShadow = true;
  outlines.addOutline(seatCushion, 1.015);
  seatGroup.add(seatCushion);

  // =========================================================================
  // 3. SCULPTED ERGONOMIC POLYMER Y-SPINE, PERIMETER BACK FRAME & BREATHABLE MESH
  //    (Strictly layered in Z relative to evalBackrestZ so ZERO clipping occurs!)
  // =========================================================================
  // 3A. Contoured Outer Molded Polymer Backrest Perimeter Frame hugging the mesh edges
  const frameProfile: [number, number][] = [
    [0.0, 0.576],
    [0.148, 0.584],
    [0.206, 0.655],
    [0.220, 0.805],
    [0.206, 0.965],
    [0.138, 1.028],
    [0.0, 1.036],
    [-0.138, 1.028],
    [-0.206, 0.965],
    [-0.220, 0.805],
    [-0.206, 0.655],
    [-0.148, 0.584],
  ];
  const backFramePts = frameProfile.map(
    ([fx, fy]) => new THREE.Vector3(fx, fy, evalBackrestZ(fx, fy) + 0.002)
  );
  const backFrameCurve = new THREE.CatmullRomCurve3(backFramePts, true);
  const backFrameMesh = new THREE.Mesh(
    new THREE.TubeGeometry(backFrameCurve, 44, 0.017, 10, true),
    plasticFrameMat
  );
  backFrameMesh.castShadow = true;
  backFrameMesh.receiveShadow = true;
  outlines.addOutline(backFrameMesh, 1.016);
  seatGroup.add(backFrameMesh);

  // 3B. Stretched Breathable Micro-Perforated Mesh Backrest Sheet seated cleanly inside frame
  const meshBackGeo = createCurvedMeshBackrestGeometry(0.414, 0.448, 0.009, BACK_CENTER_Y, 0.0);
  const meshBack = new THREE.Mesh(meshBackGeo, meshBackMat);
  meshBack.castShadow = true;
  meshBack.receiveShadow = true;
  seatGroup.add(meshBack);

  // 3C. Adjustable Contoured Lumbar Support Pad mounted strictly BEHIND lower breathable mesh
  //     (+0.016m behind mesh centerline, matching exact S-curve -> ZERO front poke-through!)
  const lumbarPadGeo = createCurvedMeshBackrestGeometry(0.32, 0.092, 0.014, 0.695, 0.016);
  const lumbarPad = new THREE.Mesh(lumbarPadGeo, plasticAccentMat);
  lumbarPad.castShadow = true;
  seatGroup.add(lumbarPad);

  // 3D. Main Structural Polymer Spine & Y-Frame Support Arms staying strictly BEHIND backrest (+0.042..+0.056m)
  //     Note: NO Z-scaling applied to offset TubeGeometry curves so Z positions remain exact!
  const spineLumbarZ = evalBackrestZ(0, 0.70) + 0.048;
  const spineMidZ = evalBackrestZ(0, 0.80) + 0.052;
  const mainSpineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.422, 0.085),
    new THREE.Vector3(0, 0.432, 0.255),
    new THREE.Vector3(0, 0.518, 0.302),
    new THREE.Vector3(0, 0.615, evalBackrestZ(0, 0.615) + 0.050),
    new THREE.Vector3(0, 0.700, spineLumbarZ),
    new THREE.Vector3(0, 0.800, spineMidZ),
  ]);
  const mainSpine = new THREE.Mesh(
    new THREE.TubeGeometry(mainSpineCurve, 20, 0.020, 10, false),
    plasticFrameMat
  );
  mainSpine.castShadow = true;
  outlines.addOutline(mainSpine, 1.016);
  seatGroup.add(mainSpine);

  // Lumbar clamping bridge linking spine cleanly to the back of the lumbar pad
  const lumbarBridge = new THREE.Mesh(
    createBeveledBox(0.068, 0.052, 0.026, 0.005, 2),
    plasticAccentMat
  );
  lumbarBridge.position.set(0, 0.695, evalBackrestZ(0, 0.695) + 0.032);
  seatGroup.add(lumbarBridge);

  // Signature Ergonomic Y-Frame Upper Shoulder Arms & Lower Frame Struts (strictly behind mesh!)
  for (const side of [-1, 1] as const) {
    const yBranchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.785, spineMidZ),
      new THREE.Vector3(side * 0.088, 0.855, evalBackrestZ(side * 0.088, 0.855) + 0.044),
      new THREE.Vector3(side * 0.168, 0.925, evalBackrestZ(side * 0.168, 0.925) + 0.030),
      new THREE.Vector3(side * 0.206, 0.962, evalBackrestZ(side * 0.206, 0.962) + 0.008),
    ]);
    const yBranch = new THREE.Mesh(
      new THREE.TubeGeometry(yBranchCurve, 14, 0.0135, 8, false),
      plasticFrameMat
    );
    yBranch.castShadow = true;
    seatGroup.add(yBranch);

    // Lower lateral stabilizing struts connecting spine cleanly to lower-outer frame
    const lowerBranchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.615, evalBackrestZ(0, 0.615) + 0.048),
      new THREE.Vector3(side * 0.115, 0.630, evalBackrestZ(side * 0.115, 0.630) + 0.036),
      new THREE.Vector3(side * 0.204, 0.654, evalBackrestZ(side * 0.204, 0.654) + 0.008),
    ]);
    const lowerBranch = new THREE.Mesh(
      new THREE.TubeGeometry(lowerBranchCurve, 10, 0.0115, 8, false),
      plasticFrameMat
    );
    seatGroup.add(lowerBranch);
  }

  // =========================================================================
  // 4. SCULPTED ERGONOMIC HEADREST (头枕) & ADJUSTABLE T-ARMRESTS (塑料扶手)
  // =========================================================================
  // Curved polymer headrest stalks mounting cleanly to the rear of the top frame
  const topFrameZ = evalBackrestZ(0.048, 1.030);
  for (const hx of [-0.048, 0.048]) {
    const neckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, 1.032, topFrameZ + 0.008),
      new THREE.Vector3(hx * 0.92, 1.098, topFrameZ + 0.022),
      new THREE.Vector3(hx * 0.86, 1.158, topFrameZ + 0.006),
    ]);
    const stalk = new THREE.Mesh(
      new THREE.TubeGeometry(neckCurve, 10, 0.009, 8, false),
      plasticFrameMat
    );
    stalk.castShadow = true;
    seatGroup.add(stalk);
  }

  // Headrest molded plastic rear shell + breathable contoured cushion cleanly separated in front
  const headShell = new THREE.Mesh(
    createBeveledSlab(0.265, 0.112, 0.022, 0.036, 0.007),
    plasticFrameMat
  );
  headShell.position.set(0, 1.168, topFrameZ - 0.002);
  headShell.rotation.x = 0.22;
  headShell.castShadow = true;
  outlines.addOutline(headShell, 1.018);
  seatGroup.add(headShell);

  const headCushion = new THREE.Mesh(
    createBeveledSlab(0.246, 0.098, 0.026, 0.032, 0.008),
    breathableSeatMat
  );
  headCushion.position.set(0, 1.164, topFrameZ - 0.022);
  headCushion.rotation.x = 0.22;
  headCushion.castShadow = true;
  seatGroup.add(headCushion);

  // Sculpted Adjustable Polymer T-Armrests with soft-touch PU top pads
  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.175, 0.442, 0.02),
      new THREE.Vector3(side * 0.276, 0.456, 0.02),
      new THREE.Vector3(side * 0.292, 0.545, 0.025),
      new THREE.Vector3(side * 0.292, 0.655, 0.025),
    ]);
    const armPost = new THREE.Mesh(
      new THREE.TubeGeometry(armCurve, 14, 0.0155, 8, false),
      plasticFrameMat
    );
    armPost.scale.set(1.0, 1.0, 1.35);
    armPost.castShadow = true;
    outlines.addOutline(armPost, 1.018);
    seatGroup.add(armPost);

    // Inner telescopic height button accent on armrest post
    const armCollar = new THREE.Mesh(
      createBeveledBox(0.034, 0.044, 0.044, 0.006, 2),
      plasticAccentMat
    );
    armCollar.position.set(side * 0.292, 0.595, 0.025);
    seatGroup.add(armCollar);

    // Molded polymer armrest tray + soft-touch ergonomic PU forearm pad
    const armTray = new THREE.Mesh(
      createBeveledSlab(0.072, 0.018, 0.252, 0.022, 0.005),
      plasticFrameMat
    );
    armTray.position.set(side * 0.292, 0.664, 0.005);
    armTray.castShadow = true;
    seatGroup.add(armTray);

    const armPad = new THREE.Mesh(
      createBeveledSlab(0.068, 0.018, 0.244, 0.020, 0.006),
      armPadMat
    );
    armPad.position.set(side * 0.292, 0.678, 0.005);
    armPad.castShadow = true;
    outlines.addOutline(armPad, 1.016);
    seatGroup.add(armPad);
  }

  return { rootGroup, seatGroup };
}
