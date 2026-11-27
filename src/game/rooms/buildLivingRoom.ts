import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createArchedVelvetCurtainGeometry,
  createBeveledBox,
  createBeveledSlab,
  createBookGeometry,
  createBroadLeafGeometry,
  createDrapedCurtainGeometry,
  createFlaredValanceGeometry,
  createMoldedDrawerFront,
  createPinchedPlumpPillowGeometry,
  createPinchedTuftedBackCushionGeometry,
  createPlushBox,
  createRetroCartridgeGeometry,
  createTaperedCurveGeometry,
  createTurnedLegGeometry,
  createVinylSleeveGeometry,
} from '../geometries';
import { createArchitecturalGlassMaterial } from '../pipeline';
import { LOFI_TRACKS, type LofiTrackSpec } from '../vinylPlayer';
import {
  mergeDynamicSubtreeMeshes,
  mergeStaticGroupToSingleMesh,
  normalizeGeometryForMerge,
} from '../SceneManager';
import {
  createTabletopPenSet,
  createTabletopTrinketCluster,
  type RoomBuildContext,
} from './roomContext';
import { buildToyGunMesh } from '../entities/buildToyGunAndPlane';
import { apartmentColorStudio } from '../devColorStudio';
import {
  buildTvRemoteMesh,
  buildXboxControllerMesh,
} from '../props/livingConsoleProps';

// Reusable matrix/transform scratch objects for InstancedMesh population
const _instMat = new THREE.Matrix4();
const _instPos = new THREE.Vector3();
const _instQuat = new THREE.Quaternion();
const _instEuler = new THREE.Euler();
const _instScale = new THREE.Vector3(1, 1, 1);
const _pivotPre = new THREE.Matrix4();
const _rotMat = new THREE.Matrix4();

/**
 * Computes the world/local Matrix4 for an outward-splayed turned furniture leg
 * anchored at top (topX, topY, topZ) so multiple legs can be batched into a single THREE.InstancedMesh.
 */
function composeSplayedLegMatrix(
  topX: number,
  topY: number,
  topZ: number,
  legHeight: number,
  splayAngleX: number,
  splayAngleZ: number,
  parentOffset = new THREE.Vector3(0, 0, 0)
): THREE.Matrix4 {
  const rx = topZ >= 0 ? -splayAngleX : splayAngleX;
  const rz = topX >= 0 ? splayAngleZ : -splayAngleZ;
  _pivotPre.makeTranslation(0, -legHeight / 2, 0);
  _instEuler.set(rx, 0, rz, 'XYZ');
  _rotMat.makeRotationFromEuler(_instEuler);
  _instMat.makeTranslation(
    parentOffset.x + topX,
    parentOffset.y + topY,
    parentOffset.z + topZ
  );
  _instMat.multiply(_rotMat).multiply(_pivotPre);
  return _instMat.clone();
}

export function buildLivingRoom(
  ctx: RoomBuildContext,
  playDoorAudio: (open: boolean) => void,
  turntableControls?: {
    onCycleTurntable: () => { playing: boolean; trackIndex: number; track: LofiTrackSpec };
    onNextTrack: () => { playing: boolean; trackIndex: number; track: LofiTrackSpec };
    onTogglePlay: () => { playing: boolean; trackIndex: number; track: LofiTrackSpec };
  }
): void {
  const {
    scene,
    sceneManager,
    ceilingGroup,
    uniforms,
    textures,
    outlines,
    mat,
    addWall,
    addBoxCollider,
    registerInteractable,
    registerCabinetDoor,
    registerDoor,
    registerAmbientProp,
    metaState,
  } = ctx;

  const group = new THREE.Group();
  group.name = 'LivingRoom';
  scene.add(group);
  sceneManager.registerRoomGroup('living', group);

  // =========================================================================
  // 0. LIVING ROOM STATIC ARCHITECTURAL STRUCTURE (Walls, Floor & Wainscoting)
  //    Merged together with static furniture via BufferGeometryUtils!
  // =========================================================================
  const livingWallMat = mat({
    map: textures.wallpaperLiving,
    color: 0xfff8fa,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.56,
  });
  const woodFloorMat = mat({
    map: textures.woodFloor,
    bumpMap: textures.woodFloorBump,
    bumpScale: 0.008,
    roughnessMap: textures.woodFloorRoughness,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    woodLacquer: 0.0,
    floorFresnel: 0.44,
    celStrength: 0.48,
  });
  const wainscotMat = mat({
    map: textures.wainscotWood,
    color: 0xf7e2d2,
    roughness: 0.84,
    metalness: 0.0,
    woodLacquer: 0.12,
    celStrength: 0.48,
  });
  const wainscotTrimMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xf5e2c4,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.48,
  });
  const wainscotBaseMat = wainscotTrimMat;

  // Living Room Hardwood Floor Slab (X: -1.22 .. 7.35, Z: -10.40 .. 0.25) with world-meter UVs
  const floorLivingGeo = new THREE.BoxGeometry(8.57, 0.3, 10.65);
  {
    const normAttr = floorLivingGeo.attributes.normal;
    const uvAttr = floorLivingGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      if (Math.abs(normAttr.getY(i)) > 0.5) {
        uvAttr.setXY(i, uvAttr.getX(i) * (8.57 / 2.0), uvAttr.getY(i) * (10.65 / 2.0));
      }
    }
    uvAttr.needsUpdate = true;
  }
  const floorLivingMesh = new THREE.Mesh(floorLivingGeo, woodFloorMat);
  floorLivingMesh.position.set(3.065, -0.15, -5.075);
  floorLivingMesh.receiveShadow = true;
  floorLivingMesh.name = 'floor_living';
  group.add(floorLivingMesh);

  // Living Room Perimeter Walls (cleanly butt-jointed with zero coplanar Z-fighting!)
  // Windows at wz = -7.20 (Z = -7.84..-6.56) and wz = -2.96 (Z = -3.60..-2.32), giving a wide 2.96m center TV wall!
  const H = 3.1;
  const wallThick = 0.18;
  // North wall (Z = -10.40, X = -1.30 .. 7.44) split around new Bathroom doorway (X = 4.68 .. 5.78, Y = 0 .. 2.20)
  addWall('wall_n_living_w', 1.69, H / 2, -10.40, 5.98, H, wallThick, livingWallMat, group);
  addWall('wall_n_living_e', 6.61, H / 2, -10.40, 1.66, H, wallThick, livingWallMat, group);
  addWall('wall_n_living_hdr', 5.23, 2.65, -10.40, 1.12, 0.90, wallThick, livingWallMat, group);
  addWall('wall_liv_nw_alcove', -1.22, H / 2, -8.57, 0.16, H, 3.48, livingWallMat, group);
  addWall('wall_e_n_corner', 7.35, H / 2, -9.075, wallThick, H, 2.47, livingWallMat, group);
  addWall('wall_e_mid_tv', 7.35, H / 2, -5.08, wallThick, H, 2.96, livingWallMat, group);
  addWall('wall_e_s_liv', 7.35, H / 2, -1.075, wallThick, H, 2.49, livingWallMat, group);
  for (const [idx, wz] of [
    [1, -7.20],
    [2, -2.96],
  ] as const) {
    addWall(`wall_e_w${idx}_bot`, 7.35, 0.43, wz, wallThick, 0.86, 1.28, livingWallMat, group);
    addWall(`wall_e_w${idx}_top`, 7.35, 2.91, wz, wallThick, 0.38, 1.28, livingWallMat, group);
  }

  // Living Room Seamless Vertical Plank Wainscoting (H = 0.86m, continuous 3D vertical boards, zero box frames!)
  const WAIN_H = 0.86;
  const addLivingWainscot = (
    cx: number,
    cz: number,
    length: number,
    facing: 'z+' | 'z-' | 'x+' | 'x-'
  ) => {
    const isAlongX = facing === 'z+' || facing === 'z-';
    const sign = facing === 'z+' || facing === 'x+' ? 1 : -1;
    const wGroup = new THREE.Group();
    wGroup.position.set(cx, 0, cz);

    const panelW = isAlongX ? length : 0.020;
    const panelD = isAlongX ? 0.020 : length;
    const panelGeo = new THREE.BoxGeometry(panelW, WAIN_H, panelD);
    const uvAttr = panelGeo.attributes.uv;
    const normAttr = panelGeo.attributes.normal;
    for (let i = 0; i < uvAttr.count; i++) {
      const nx = Math.abs(normAttr.getX(i));
      const ny = Math.abs(normAttr.getY(i));
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (nx > 0.5) {
        uvAttr.setXY(i, u * (panelD / 1.0), v * (WAIN_H / 1.0));
      } else if (ny > 0.5) {
        uvAttr.setXY(i, u * (panelW / 1.0), v * (panelD / 1.0));
      } else {
        uvAttr.setXY(i, u * (panelW / 1.0), v * (WAIN_H / 1.0));
      }
    }
    uvAttr.needsUpdate = true;

    const panel = new THREE.Mesh(panelGeo, wainscotMat);
    panel.position.y = WAIN_H / 2;
    panel.receiveShadow = true;
    wGroup.add(panel);

    // Continuous row of seamlessly joined 3D vertical wooden planks (一列列木板无缝衔接)
    const plankTarget = 0.125;
    const numPlanks = Math.max(2, Math.round(length / plankTarget));
    const plankW = length / numPlanks;
    const plankH = WAIN_H - 0.105;
    const plankY = 0.095 + plankH / 2;

    const singlePlankGeo = createBeveledBox(
      isAlongX ? Math.max(0.02, plankW - 0.002) : 0.028,
      plankH,
      isAlongX ? 0.028 : Math.max(0.02, plankW - 0.002),
      0.0045,
      2
    );
    const pUv = singlePlankGeo.attributes.uv;
    for (let k = 0; k < pUv.count; k++) {
      pUv.setXY(k, pUv.getX(k) * (plankW / 1.0), pUv.getY(k) * (plankH / 1.0));
    }
    pUv.needsUpdate = true;

    for (let p = 0; p < numPlanks; p++) {
      const offset = -length / 2 + (p + 0.5) * plankW;
      const plankMesh = new THREE.Mesh(singlePlankGeo, wainscotMat);
      plankMesh.position.set(
        isAlongX ? offset : sign * 0.004,
        plankY,
        isAlongX ? sign * 0.004 : offset
      );
      plankMesh.castShadow = false;
      plankMesh.receiveShadow = true;
      wGroup.add(plankMesh);
    }

    const chairRail = new THREE.Mesh(
      createBeveledBox(isAlongX ? length : 0.046, 0.046, isAlongX ? 0.046 : length, 0.011, 3),
      wainscotTrimMat
    );
    chairRail.position.set(isAlongX ? 0 : sign * 0.008, WAIN_H + 0.018, isAlongX ? sign * 0.008 : 0);
    chairRail.castShadow = false;
    chairRail.receiveShadow = true;
    wGroup.add(chairRail);

    const underBead = new THREE.Mesh(
      createBeveledBox(isAlongX ? length : 0.034, 0.018, isAlongX ? 0.034 : length, 0.004, 2),
      wainscotTrimMat
    );
    underBead.position.set(isAlongX ? 0 : sign * 0.005, WAIN_H - 0.008, isAlongX ? sign * 0.005 : 0);
    wGroup.add(underBead);

    const baseboard = new THREE.Mesh(
      createBeveledBox(isAlongX ? length : 0.056, 0.056, isAlongX ? 0.056 : length, 0.008, 2),
      wainscotTrimMat
    );
    baseboard.position.set(isAlongX ? 0 : sign * 0.010, 0.028, isAlongX ? sign * 0.010 : 0);
    baseboard.receiveShadow = true;
    wGroup.add(baseboard);

    group.add(wGroup);
  };

  // North wall wainscoting split cleanly around Bathroom doorway architrave (X = 4.64 .. 5.82)
  addLivingWainscot(1.76, -10.295, 5.76, 'z+');
  addLivingWainscot(6.535, -10.295, 1.43, 'z+');
  addLivingWainscot(7.245, -5.075, 10.43, 'x-');
  addLivingWainscot(-1.125, -7.245, 6.09, 'x+');
  addLivingWainscot(-1.125, -1.36, 3.10, 'x+');
  addLivingWainscot(0.23, 0.155, 2.68, 'z-');
  addLivingWainscot(4.995, 0.155, 4.53, 'z-');

  // -------------------------------------------------------------------------
  // 0B. COMPLETE MISIDE ARCHITECTURAL WOOD TRIM BOX-FRAME IN LIVING ROOM
  //     (浅原木色木质收边线条: Vertical Floor-to-Ceiling Corner Strips + Top Crown Moldings)
  // -------------------------------------------------------------------------
  const livCornerStripGeo = createBeveledBox(0.056, 3.08, 0.056, 0.008, 2);
  const livCornerCoords: [number, number][] = [
    [-1.12, -10.29], // NW concave corner
    [7.24, -10.29],  // NE concave corner
    [7.24, 0.15],    // SE concave corner
    [-1.12, 0.15],   // SW concave corner
  ];
  for (const [cx, cz] of livCornerCoords) {
    const cStrip = new THREE.Mesh(livCornerStripGeo, wainscotTrimMat);
    cStrip.position.set(cx, 1.54, cz);
    cStrip.castShadow = false;
    cStrip.receiveShadow = true;
    group.add(cStrip);
  }

  // Top Perimeter Crown Molding (顶角线, matching 0.056m width & light-oak color) at Y = 3.072m
  const livCrownSpecs: [number, number, number, number][] = [
    [3.06, -10.29, 8.42, 0.056], // North wall crown
    [3.06, 0.15, 8.42, 0.056],   // South wall crown
    [7.24, -5.07, 0.056, 10.50], // East wall crown
    [-1.12, -5.07, 0.056, 10.50],// West wall crown
  ];
  for (const [cx, cz, cw, cd] of livCrownSpecs) {
    const crown = new THREE.Mesh(
      createBeveledBox(cw, 0.056, cd, 0.008, 2),
      wainscotTrimMat
    );
    crown.position.set(cx, 3.072, cz);
    crown.receiveShadow = true;
    group.add(crown);
  }

  // Hinged Living Room / Dining Partition Door (Z = 0.25, X = 1.58 .. 2.73) — harmonized with TV stand honey-apricot-oak
  const doorMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xffffff,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.42,
  });
  const doorMetalMat = mat({ color: 0x3b334a, roughness: 0.32, metalness: 0.72 });
  registerDoor(
    'door_living_dining',
    '客厅木门',
    'living',
    1.58,
    0,
    0.25,
    1.15,
    2.2,
    'x+',
    1,
    doorMat,
    doorMetalMat,
    playDoorAudio
  );

  // Unified honey-apricot-oak furniture materials harmonized seamlessly with the TV stand
  const oakMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xffffff,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.42,
  });
  const darkOakMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xe6baa0,
    roughness: 0.65,
    metalness: 0.0,
    woodLacquer: 0.36,
  });
  const drawerWhiteMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xfffdf6,
    roughness: 0.59,
    metalness: 0.0,
    woodLacquer: 0.44,
  });
  const drawerMoldingMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xf2d2b8,
    roughness: 0.62,
    metalness: 0.0,
    woodLacquer: 0.42,
  });
  const handleBrassMat = mat({ color: 0xdcb46c, roughness: 0.38, metalness: 0.68 });
  // Pure Cream-White Cashmere Christmas Rug with Fine Red-Green Pinstripes, Center Medallion & Scattered Small Holly Motifs
  // (奶油白主底 + 红绿细线边框 + 中心花纹与零散红绿小花，无大块角部/边缘色块)
  const christmasRugTex = (() => {
    const S = 1024;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const rctx = c.getContext('2d')!;

    // 1) Pure Luminous Warm Cream-White Cashmere Base across the entire rug (edges, corners & field all white!)
    const bgGrad = rctx.createRadialGradient(S * 0.5, S * 0.5, 60, S * 0.5, S * 0.5, S * 0.74);
    bgGrad.addColorStop(0.0, '#fdfaf3');
    bgGrad.addColorStop(0.68, '#f6f0e4');
    bgGrad.addColorStop(1.0, '#efe6d6');
    rctx.fillStyle = bgGrad;
    rctx.fillRect(0, 0, S, S);

    // Subtle tone-on-tone warm-cream woven diamond quilt texture across the white field
    rctx.save();
    rctx.strokeStyle = 'rgba(216, 204, 186, 0.24)';
    rctx.lineWidth = 1.8;
    const step = 68;
    for (let d = -S; d < S * 2; d += step) {
      rctx.beginPath();
      rctx.moveTo(d, 72);
      rctx.lineTo(d + (S - 144), S - 72);
      rctx.stroke();
      rctx.beginPath();
      rctx.moveTo(d, S - 72);
      rctx.lineTo(d + (S - 144), 72);
      rctx.stroke();
    }
    rctx.restore();

    // 2) Delicate Red & Green Fine Pinstripe Border Lines on Pure Cream-White Edge (红绿细线边框，绝无大块色块)
    rctx.strokeStyle = '#337d53';
    rctx.lineWidth = 5.5;
    rctx.strokeRect(42, 42, S - 84, S - 84);

    rctx.strokeStyle = '#c8424e';
    rctx.lineWidth = 4.0;
    rctx.strokeRect(60, 60, S - 120, S - 120);

    rctx.strokeStyle = 'rgba(214, 186, 118, 0.65)';
    rctx.lineWidth = 2.2;
    rctx.strokeRect(72, 72, S - 144, S - 144);

    const drawSnowflake = (cx: number, cy: number, rad: number, color: string, lw = 3.0) => {
      rctx.save();
      rctx.translate(cx, cy);
      rctx.strokeStyle = color;
      rctx.lineWidth = lw;
      rctx.lineCap = 'round';
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        rctx.beginPath();
        rctx.moveTo(0, 0);
        rctx.lineTo(dx * rad, dy * rad);
        rctx.stroke();
        const mx = dx * rad * 0.56;
        const my = dy * rad * 0.56;
        for (const sgn of [-1, 1]) {
          const bAng = ang + sgn * 0.68;
          rctx.beginPath();
          rctx.moveTo(mx, my);
          rctx.lineTo(mx + Math.cos(bAng) * rad * 0.36, my + Math.sin(bAng) * rad * 0.36);
          rctx.stroke();
        }
      }
      rctx.fillStyle = color;
      rctx.beginPath();
      rctx.arc(0, 0, lw * 0.82, 0, Math.PI * 2);
      rctx.fill();
      rctx.restore();
    };

    const drawHollySprig = (cx: number, cy: number, scale = 1.0, rot = 0) => {
      rctx.save();
      rctx.translate(cx, cy);
      rctx.rotate(rot);
      rctx.scale(scale, scale);
      for (const [ang, col] of [
        [-0.62, '#2d7549'],
        [0.62, '#388b59'],
        [Math.PI - 0.62, '#388b59'],
        [Math.PI + 0.62, '#2d7549'],
      ] as [number, string][]) {
        rctx.fillStyle = col;
        rctx.beginPath();
        rctx.ellipse(Math.cos(ang) * 14, Math.sin(ang) * 14, 12.5, 6.2, ang, 0, Math.PI * 2);
        rctx.fill();
      }
      rctx.fillStyle = '#cf3947';
      for (const [bx, by] of [
        [0, -4.5],
        [-4.6, 3.4],
        [4.6, 3.4],
      ]) {
        rctx.beginPath();
        rctx.arc(bx, by, 5.0, 0, Math.PI * 2);
        rctx.fill();
      }
      rctx.fillStyle = '#fffdf6';
      rctx.beginPath();
      rctx.arc(-1.4, -5.8, 1.7, 0, Math.PI * 2);
      rctx.fill();
      rctx.restore();
    };

    // 3) Scattered Small Red-Green Holly Flowers & Tiny Snowflakes on the Open White Field & Corners (零散红绿小花，无大色块)
    const scatteredSprigs: [number, number, number, number][] = [
      // Four gentle corner sprigs
      [138, 138, 1.32, Math.PI * 0.25],
      [S - 138, 138, 1.32, -Math.PI * 0.25],
      [138, S - 138, 1.32, -Math.PI * 0.25],
      [S - 138, S - 138, 1.32, Math.PI * 0.25],
      // Subtle mid-edge small sprigs
      [S * 0.5, 118, 1.05, 0],
      [S * 0.5, S - 118, 1.05, 0],
      [118, S * 0.5, 1.05, Math.PI * 0.5],
      [S - 118, S * 0.5, 1.05, Math.PI * 0.5],
      // Light organic field accents between corners and center
      [285, 255, 0.88, 0.65],
      [S - 285, 255, 0.88, -0.65],
      [285, S - 255, 0.88, -0.65],
      [S - 285, S - 255, 0.88, 0.65],
    ];
    for (const [hx, hy, hs, hrot] of scatteredSprigs) {
      drawHollySprig(hx, hy, hs, hrot);
    }

    // Whisper-light scattered tiny red & green snowflakes
    for (const [fx, fy, fr, fcol] of [
      [215, 152, 14, 'rgba(200, 66, 78, 0.65)'],
      [152, 215, 13, 'rgba(51, 125, 83, 0.62)'],
      [S - 215, 152, 14, 'rgba(200, 66, 78, 0.65)'],
      [S - 152, 215, 13, 'rgba(51, 125, 83, 0.62)'],
      [215, S - 152, 14, 'rgba(200, 66, 78, 0.65)'],
      [152, S - 215, 13, 'rgba(51, 125, 83, 0.62)'],
      [S - 215, S - 152, 14, 'rgba(200, 66, 78, 0.65)'],
      [S - 152, S - 215, 13, 'rgba(51, 125, 83, 0.62)'],
    ] as [number, number, number, string][]) {
      drawSnowflake(fx, fy, fr, fcol, 2.3);
    }

    // 4) Ornate Scalloped 8-Lobed Red-Green Christmas Center Medallion (保留中心红绿花环徽章)
    const cx = S * 0.5;
    const cy = S * 0.5;

    const traceScallopPetal = (radOuter: number, radInner: number, lobes: number, rotOffset = 0) => {
      rctx.beginPath();
      const steps = lobes * 24;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2 + rotOffset;
        const lobeWave = Math.cos(a * lobes);
        const r = radInner + (radOuter - radInner) * (0.5 + 0.5 * Math.pow(Math.max(0, lobeWave), 0.72) * (lobeWave >= 0 ? 1 : -0.35));
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) rctx.moveTo(px, py);
        else rctx.lineTo(px, py);
      }
      rctx.closePath();
    };

    // Subtle cream-gold halo ring framing the center medallion
    rctx.strokeStyle = 'rgba(222, 194, 122, 0.62)';
    rctx.lineWidth = 3.5;
    rctx.beginPath();
    rctx.arc(cx, cy, 232, 0, Math.PI * 2);
    rctx.stroke();

    // Outer 8-lobed evergreen botanical medallion
    traceScallopPetal(218, 174, 8, 0);
    rctx.fillStyle = '#2f7a4e';
    rctx.fill();
    rctx.strokeStyle = '#ecd084';
    rctx.lineWidth = 4.2;
    rctx.stroke();

    // Cream-white scalloped lace separator ring
    traceScallopPetal(174, 142, 8, Math.PI / 8);
    rctx.fillStyle = '#faf5ea';
    rctx.fill();

    // Inner 8-lobed rich crimson-red tapestry medallion
    traceScallopPetal(156, 120, 8, 0);
    rctx.fillStyle = '#c83e4b';
    rctx.fill();
    rctx.strokeStyle = '#f2d488';
    rctx.lineWidth = 3.8;
    rctx.stroke();

    // Deep evergreen inner rosette core
    rctx.fillStyle = '#2a6f46';
    rctx.beginPath();
    rctx.arc(cx, cy, 70, 0, Math.PI * 2);
    rctx.fill();
    rctx.strokeStyle = '#fbf7ee';
    rctx.lineWidth = 3.2;
    rctx.stroke();

    // Ring of 16 alternating holly-berry sprigs & cream-white snowflakes woven around the outer green wreath
    for (let w = 0; w < 16; w++) {
      const wa = (w / 16) * Math.PI * 2;
      const wx = cx + Math.cos(wa) * 192;
      const wy = cy + Math.sin(wa) * 192;
      if (w % 2 === 0) {
        drawHollySprig(wx, wy, 0.88, wa + Math.PI * 0.5);
      } else {
        drawSnowflake(wx, wy, 11.5, '#fbf7ee', 2.3);
      }
    }

    // 8 delicate cream snowflakes orbiting the red medallion ring
    for (let k = 0; k < 8; k++) {
      const ka = (k / 8) * Math.PI * 2 + Math.PI / 8;
      drawSnowflake(cx + Math.cos(ka) * 108, cy + Math.sin(ka) * 108, 14, '#fbf7ee', 2.5);
    }

    // Centerpiece layered cream-white & warm-gold star snowflake
    drawSnowflake(cx, cy, 52, '#fbf7ee', 4.5);
    drawSnowflake(cx, cy, 26, '#f5d684', 3.2);

    // Four small cardinal holly sprigs outside the center medallion
    for (let d = 0; d < 4; d++) {
      const da = (d / 4) * Math.PI * 2;
      drawHollySprig(cx + Math.cos(da) * 254, cy + Math.sin(da) * 254, 1.06, da + Math.PI * 0.5);
    }

    // Soft Painterly Plush Wool Puffs
    for (let p = 0; p < 160; p++) {
      const px = ((p * 179 + 53) % (S - 80)) + 40;
      const py = ((p * 251 + 97) % (S - 80)) + 40;
      const pr = 18 + (p % 5) * 8;
      const pGrad = rctx.createRadialGradient(px, py, 2, px, py, pr);
      if (p % 2 === 0) {
        pGrad.addColorStop(0, 'rgba(255, 252, 244, 0.12)');
        pGrad.addColorStop(1, 'rgba(255, 252, 244, 0)');
      } else {
        pGrad.addColorStop(0, 'rgba(72, 46, 38, 0.05)');
        pGrad.addColorStop(1, 'rgba(72, 46, 38, 0)');
      }
      rctx.fillStyle = pGrad;
      rctx.beginPath();
      rctx.arc(px, py, pr, 0, Math.PI * 2);
      rctx.fill();
    }

    // Balanced 4x4px cashmere-tuft granules (right at the sweet spot between tactile wool grain & anime cleanliness!)
    const srcData = rctx.getImageData(0, 0, S, S);
    const dstImg = rctx.createImageData(S, S);
    const src = srcData.data;
    const dst = dstImg.data;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = S;
    bumpCanvas.height = S;
    const bctx = bumpCanvas.getContext('2d')!;
    const bumpImg = bctx.createImageData(S, S);
    const bData = bumpImg.data;

    const cellSz = 4;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const tx = Math.floor(x / cellSz);
        const ty = Math.floor(y / cellSz);
        const cellHash = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        const fineHash = ((x * 374761393) ^ (y * 668265263)) >>> 0;

        // Balanced yarn-edge feather (±1.75px — woven wool edge without harsh jaggedness)
        const jx = (((cellHash & 15) - 7.5) / 7.5) * 1.75;
        const jy = ((((cellHash >> 4) & 15) - 7.5) / 7.5) * 1.75;
        const sx = Math.min(S - 1, Math.max(0, Math.round(x + jx)));
        const sy = Math.min(S - 1, Math.max(0, Math.round(y + jy)));
        const sIdx = (sy * S + sx) * 4;

        // Rounded cashmere granule dome + restrained tuft & fiber variation
        const lx = ((x % cellSz) - (cellSz - 1) * 0.5) / (cellSz * 0.54);
        const ly = ((y % cellSz) - (cellSz - 1) * 0.5) / (cellSz * 0.54);
        const dome = Math.max(0, 1.0 - (lx * lx + ly * ly) * 0.58);
        const tuftVar = (((cellHash >> 8) & 31) - 15.5) * 0.45;
        const microGrain = ((fineHash & 15) - 7.5) * 0.35;
        const shadeDelta = (dome - 0.70) * 23.0 + tuftVar + microGrain;

        const dIdx = (y * S + x) * 4;
        dst[dIdx] = Math.min(255, Math.max(0, src[sIdx] + shadeDelta));
        dst[dIdx + 1] = Math.min(255, Math.max(0, src[sIdx + 1] + shadeDelta));
        dst[dIdx + 2] = Math.min(255, Math.max(0, src[sIdx + 2] + shadeDelta));
        dst[dIdx + 3] = 255;

        const bumpVal = Math.min(
          255,
          Math.max(0, Math.round(92 + dome * 130 + tuftVar * 1.2 + microGrain * 1.1))
        );
        bData[dIdx] = bumpVal;
        bData[dIdx + 1] = bumpVal;
        bData[dIdx + 2] = bumpVal;
        bData[dIdx + 3] = 255;
      }
    }
    rctx.putImageData(dstImg, 0, 0);
    bctx.putImageData(bumpImg, 0, 0);

    const colorTex = new THREE.CanvasTexture(c);
    colorTex.colorSpace = THREE.SRGBColorSpace;
    colorTex.wrapS = THREE.ClampToEdgeWrapping;
    colorTex.wrapT = THREE.ClampToEdgeWrapping;
    colorTex.anisotropy = 4;

    const bumpTex = new THREE.CanvasTexture(bumpCanvas);
    bumpTex.wrapS = THREE.ClampToEdgeWrapping;
    bumpTex.wrapT = THREE.ClampToEdgeWrapping;
    bumpTex.anisotropy = 4;

    return { colorTex, bumpTex };
  })();

  // Balanced Anime Plush Cashmere Rug Material (midpoint bumpScale 0.030 & celStrength 0.48)
  const rugMat = mat({
    map: christmasRugTex.colorTex,
    bumpMap: christmasRugTex.bumpTex,
    bumpScale: 0.030,
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
    rimScale: 1.36,
    celStrength: 0.48,
  });

  // Live-tunable Curtain Palette: Warm Cream-Cotton Base + Denser Deeper Olive-Moss Fine Intersecting Plaid Lines
  // (暖米白底 + 更密一点的深橄榄苔绿细线条交叉格纹!)
  const curtainPalette = {
    base: '#f6f1e4',
    check: '#64792d', // Deeper olive-moss green
    checkAlpha: 0.80,
    checkSize: 72,    // Denser fine plaid spacing (格子纹更密一点!)
  };

  const curtainCanvas = document.createElement('canvas');
  curtainCanvas.width = 512;
  curtainCanvas.height = 1536;

  const parseHexRgb = (hex: string): [number, number, number] => {
    const clean = hex.replace('#', '').trim();
    const n = parseInt(clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean, 16);
    if (Number.isNaN(n)) return [106, 126, 50];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const paintLivingCurtainCanvas = () => {
    const W = curtainCanvas.width;
    const H = curtainCanvas.height;
    const ctx2d = curtainCanvas.getContext('2d')!;
    const [cr, cg, cb] = parseHexRgb(curtainPalette.check);
    const sz = Math.max(48, Math.min(256, Math.round(curtainPalette.checkSize)));

    // 1) Warm Creamy-Cotton Base (#f6f1e4)
    ctx2d.fillStyle = curtainPalette.base;
    ctx2d.fillRect(0, 0, W, H);

    // 2) Crisp Slender Intersecting Olive-Moss Plaid Lines (细线条交叉，告别粗色带!)
    const a = curtainPalette.checkAlpha;
    const mainLw = Math.max(6, Math.round(sz * 0.085)); // ~11px slender woven stripe
    const subLw = Math.max(2, Math.round(sz * 0.025));  // ~3px fine companion hairline
    const subGap = mainLw + 6;

    // Vertical thin plaid lines
    for (let x = Math.round(sz * 0.5); x < W; x += sz) {
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a.toFixed(2)})`;
      ctx2d.fillRect(x - mainLw * 0.5, 0, mainLw, H);
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(a * 0.58).toFixed(2)})`;
      ctx2d.fillRect(x - subGap, 0, subLw, H);
      ctx2d.fillRect(x + subGap - subLw, 0, subLw, H);
    }
    // Horizontal thin plaid lines (cross cleanly into darker olive intersection knots!)
    for (let y = Math.round(sz * 0.5); y < H; y += sz) {
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(a * 0.94).toFixed(2)})`;
      ctx2d.fillRect(0, y - mainLw * 0.5, W, mainLw);
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(a * 0.54).toFixed(2)})`;
      ctx2d.fillRect(0, y - subGap, W, subLw);
      ctx2d.fillRect(0, y + subGap - subLw, W, subLw);
    }

    // Fine woven cotton-linen cross-weave slub threads
    for (let y = 0; y < H; y += 3) {
      ctx2d.fillStyle = y % 6 === 0 ? 'rgba(255, 253, 246, 0.16)' : `rgba(${Math.round(cr * 0.55)}, ${Math.round(cg * 0.55)}, ${Math.round(cb * 0.45)}, 0.055)`;
      ctx2d.fillRect(0, y, W, 1);
    }
    for (let x = 0; x < W; x += 3) {
      ctx2d.fillStyle = x % 6 === 0 ? 'rgba(255, 253, 246, 0.14)' : `rgba(${Math.round(cr * 0.55)}, ${Math.round(cg * 0.55)}, ${Math.round(cb * 0.45)}, 0.048)`;
      ctx2d.fillRect(x, 0, 1, H);
    }

    // 3) Tailored double-folded & stitched bottom hem (折叠缝合折边, aligns with CURTAIN_HEM_V = 0.038)
    const hemTopY = Math.round(H * (1 - 0.038)); // y = 1478
    ctx2d.fillStyle = `rgba(${Math.round(cr * 0.52)}, ${Math.round(cg * 0.55)}, ${Math.round(cb * 0.42)}, 0.14)`;
    ctx2d.fillRect(0, hemTopY, W, H - hemTopY);
    const hemGrad = ctx2d.createLinearGradient(0, hemTopY - 8, 0, hemTopY + 12);
    hemGrad.addColorStop(0.0, 'rgba(62, 74, 30, 0.0)');
    hemGrad.addColorStop(0.42, 'rgba(62, 74, 30, 0.36)');
    hemGrad.addColorStop(0.68, 'rgba(255, 252, 244, 0.42)');
    hemGrad.addColorStop(1.0, 'rgba(255, 252, 244, 0.0)');
    ctx2d.fillStyle = hemGrad;
    ctx2d.fillRect(0, hemTopY - 8, W, 20);
    // Fine dashed running-stitch thread line (缝合走线针脚)
    ctx2d.save();
    ctx2d.strokeStyle = 'rgba(74, 88, 36, 0.58)';
    ctx2d.lineWidth = 2.0;
    ctx2d.setLineDash([7, 5]);
    ctx2d.beginPath();
    ctx2d.moveTo(0, hemTopY + 6.5);
    ctx2d.lineTo(W, hemTopY + 6.5);
    ctx2d.stroke();
    ctx2d.strokeStyle = 'rgba(255, 252, 244, 0.86)';
    ctx2d.lineWidth = 1.5;
    ctx2d.beginPath();
    ctx2d.moveTo(0, hemTopY + 4.8);
    ctx2d.lineTo(W, hemTopY + 4.8);
    ctx2d.stroke();
    ctx2d.restore();
    ctx2d.fillStyle = 'rgba(255, 252, 244, 0.34)';
    ctx2d.fillRect(0, H - 7, W, 4);
    ctx2d.fillStyle = 'rgba(62, 74, 30, 0.28)';
    ctx2d.fillRect(0, H - 3, W, 3);
  };
  paintLivingCurtainCanvas();

  const matchaFloralCurtainTex = (() => {
    const tex = new THREE.CanvasTexture(curtainCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1.35, 1.0); // Denser fine plaid checks across curtain width!
    tex.anisotropy = 4;
    return tex;
  })();

  // Silky plush velvet shading: lower roughness + strong grazing rim sheen + smooth continuous shading
  const curtainMat = mat({
    map: matchaFloralCurtainTex,
    bumpMap: textures.curtainBump,
    bumpScale: 0.007,
    color: 0xffffff,
    roughness: 0.56,
    metalness: 0.04,
    rimScale: 1.55,
    celStrength: 0.34,
    side: THREE.DoubleSide,
    windSway: 0.55,
  });
  const sheerCurtainMat = mat({
    map: textures.curtainFabric,
    bumpMap: textures.curtainBump,
    bumpScale: 0.010,
    color: 0xfffafa,
    transparent: true,
    opacity: 0.50,
    roughness: 0.94,
    metalness: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    windSway: 0.44,
  });
  const curtainBandMat = mat({
    color: 0xf4efe4,
    roughness: 0.92,
    metalness: 0.0,
  });
  const sofaMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.013,
    color: 0xfffdf8,
    roughness: 0.91,
    metalness: 0.0,
    rimScale: 0.72,
    fabricCream: 1.0,
  });
  const sofaBackTuftMat = mat({
    map: textures.sofaTuftMap,
    bumpMap: textures.sofaTuftBump,
    bumpScale: 0.017,
    color: 0xfffdf8,
    roughness: 0.90,
    metalness: 0.0,
    rimScale: 0.0,
    fabricCream: 1.0,
  });
  const sofaDarkMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.012,
    color: 0xfdf7f0,
    roughness: 0.91,
    metalness: 0.0,
    rimScale: 0.0,
    fabricCream: 1.0,
  });
  const sofaButtonMat = mat({
    map: textures.plushFabric,
    color: 0xfaf4ee,
    roughness: 0.92,
    metalness: 0.0,
    rimScale: 0.0,
    fabricCream: 1.0,
  });
  // Cozy Christmas Knitted & Plush Sofa Throw Pillows (圣诞红底白边 + 森林绿雪花针织 + 奶油麻花毛绒抱枕)
  const createKnitChristmasPillowTex = (style: 'redWhiteTrim' | 'greenSnowflake' | 'creamKnit') => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx2d = c.getContext('2d')!;

    if (style === 'redWhiteTrim') {
      // Warm Christmas berry-crimson knit base + thick plush snow-white border trim
      ctx2d.fillStyle = '#cf3442';
      ctx2d.fillRect(0, 0, S, S);
      ctx2d.strokeStyle = '#faf5ea';
      ctx2d.lineWidth = 38;
      ctx2d.strokeRect(19, 19, S - 38, S - 38);
      ctx2d.strokeStyle = '#e8c468';
      ctx2d.lineWidth = 5;
      ctx2d.strokeRect(48, 48, S - 96, S - 96);
    } else if (style === 'greenSnowflake') {
      // Rich spruce-pine knit base + Fair Isle cream bands
      ctx2d.fillStyle = '#2d7649';
      ctx2d.fillRect(0, 0, S, S);
      ctx2d.fillStyle = 'rgba(250, 244, 232, 0.22)';
      ctx2d.fillRect(0, 74, S, 24);
      ctx2d.fillRect(0, S - 98, S, 24);
      ctx2d.strokeStyle = '#faf5ea';
      ctx2d.lineWidth = 6;
      ctx2d.strokeRect(24, 24, S - 48, S - 48);
    } else {
      // Warm oatmeal-cream chunky cable-knit base + festive red & pine accent stripes
      ctx2d.fillStyle = '#f6efe2';
      ctx2d.fillRect(0, 0, S, S);
      ctx2d.fillStyle = '#cf3442';
      ctx2d.fillRect(0, 86, S, 22);
      ctx2d.fillRect(0, S - 108, S, 22);
      ctx2d.fillStyle = '#2d7649';
      ctx2d.fillRect(0, 118, S, 12);
      ctx2d.fillRect(0, S - 130, S, 12);
    }

    // Crisp V-stitch knitted wool yarn ribs across entire pillow surface
    ctx2d.lineWidth = 2.0;
    for (let y = 6; y < S; y += 12) {
      for (let x = 4; x < S; x += 14) {
        ctx2d.strokeStyle = 'rgba(255, 252, 244, 0.14)';
        ctx2d.beginPath();
        ctx2d.moveTo(x, y - 4);
        ctx2d.lineTo(x + 5, y + 4);
        ctx2d.lineTo(x + 10, y - 4);
        ctx2d.stroke();
        ctx2d.strokeStyle = 'rgba(28, 16, 18, 0.12)';
        ctx2d.beginPath();
        ctx2d.moveTo(x + 2, y - 2);
        ctx2d.lineTo(x + 5, y + 5);
        ctx2d.stroke();
      }
    }

    // Draw crisp knitted snow-white snowflakes on red & green Christmas pillows
    const drawKnitSnowflake = (cx: number, cy: number, rad: number, color: string, lw = 6) => {
      ctx2d.save();
      ctx2d.translate(cx, cy);
      ctx2d.strokeStyle = color;
      ctx2d.lineWidth = lw;
      ctx2d.lineCap = 'round';
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        ctx2d.beginPath();
        ctx2d.moveTo(0, 0);
        ctx2d.lineTo(dx * rad, dy * rad);
        ctx2d.stroke();
        for (const sgn of [-1, 1]) {
          const bAng = ang + sgn * 0.68;
          ctx2d.beginPath();
          ctx2d.moveTo(dx * rad * 0.56, dy * rad * 0.56);
          ctx2d.lineTo(
            dx * rad * 0.56 + Math.cos(bAng) * rad * 0.36,
            dy * rad * 0.56 + Math.sin(bAng) * rad * 0.36
          );
          ctx2d.stroke();
        }
      }
      ctx2d.restore();
    };

    if (style === 'redWhiteTrim') {
      drawKnitSnowflake(S * 0.5, S * 0.5, 96, '#fcf8ee', 9);
      drawKnitSnowflake(S * 0.5, S * 0.5, 42, '#f4cf6a', 5);
    } else if (style === 'greenSnowflake') {
      drawKnitSnowflake(S * 0.5, S * 0.5, 88, '#fcf8ee', 8);
      for (const [sx, sy] of [
        [124, 152],
        [388, 152],
        [124, 360],
        [388, 360],
      ]) {
        drawKnitSnowflake(sx, sy, 34, '#f8f2e4', 5);
      }
    } else {
      drawKnitSnowflake(S * 0.5, S * 0.5, 72, '#cf3442', 7);
      drawKnitSnowflake(S * 0.5, S * 0.5, 34, '#2d7649', 5);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  const xmasRedPillowTex = createKnitChristmasPillowTex('redWhiteTrim');
  const xmasGreenPillowTex = createKnitChristmasPillowTex('greenSnowflake');
  const xmasCreamPillowTex = createKnitChristmasPillowTex('creamKnit');

  const sofaCreamPillowMat = mat({
    map: xmasRedPillowTex,
    bumpMap: textures.plushBump,
    bumpScale: 0.018,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    rimScale: 1.38,
    fabricCream: 0.85,
  });
  const sofaIcePillowMat = mat({
    map: xmasCreamPillowTex,
    bumpMap: textures.plushBump,
    bumpScale: 0.018,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    rimScale: 1.38,
    fabricCream: 0.90,
  });
  const sofaLemonPillowMat = mat({
    map: xmasRedPillowTex,
    bumpMap: textures.plushBump,
    bumpScale: 0.018,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    rimScale: 1.38,
    fabricCream: 0.85,
  });
  const sofaCoralPillowMat = mat({
    map: xmasGreenPillowTex,
    bumpMap: textures.plushBump,
    bumpScale: 0.018,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    rimScale: 1.38,
    fabricCream: 0.85,
  });
  const ginghamPillowMat = mat({
    map: xmasGreenPillowTex,
    bumpMap: textures.plushBump,
    bumpScale: 0.018,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    rimScale: 1.38,
    fabricCream: 0.85,
  });
  // Light-toned Matte Paper & Cloth Book Atlas Material (16-variant sculpted books)
  const bookAtlasMat = mat({
    map: textures.bookCoverAtlas,
    bumpMap: textures.bookCoverBump,
    bumpScale: 0.010,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    celStrength: 0.42,
    woodLacquer: 0.0,
  });
  // Semi-matte printed cardboard 12-inch Vinyl LP Jacket Atlas Material (8 distinct illustrated covers)
  const vinylSleeveMat = mat({
    map: textures.vinylSleeveAtlas,
    bumpMap: textures.bookCoverBump,
    bumpScale: 0.005,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.0,
    celStrength: 0.38,
    woodLacquer: 0.08,
  });
  // Pastel retro game cartridge plastics (warm shell grey, mint, lavender, butter yellow) + printed label
  const retroCartridgeMats = [
    mat({ color: 0xdfe2e8, roughness: 0.56, metalness: 0.02, celStrength: 0.44 }),
    mat({ color: 0xbde0d1, roughness: 0.54, metalness: 0.02, celStrength: 0.44 }),
    mat({ color: 0xd4c8e8, roughness: 0.54, metalness: 0.02, celStrength: 0.44 }),
    mat({ color: 0xf2df9e, roughness: 0.54, metalness: 0.02, celStrength: 0.44 }),
  ];
  const retroLabelMat = mat({ color: 0xfcf8f0, roughness: 0.70, metalness: 0.0, celStrength: 0.38 });

  /**
   * Populates a single shelf bay with naturally varied, sculpted light-toned books:
   * consecutive Manga tankobon sets (0-3), Literary fiction (4-7), Philosophy (8-11),
   * taller Technical/Design volumes (12-13), Retro Game Cases (14-15), sculpted pastel
   * Retro Game Cartridges, organic depth stagger, leaning end-books, and occasional flat stacks.
   */
  const populateRealisticBookTier = (opts: {
    parent: THREE.Object3D;
    axis: 'x' | 'z';
    spineSign?: 1 | -1;
    start: number;
    end: number;
    surfaceY: number;
    depthCenter: number;
    maxDepth: number;
    maxHeight: number;
    seed: number;
    includeMangaSet?: boolean;
    includeHorizontalStack?: boolean;
    includeRetroGames?: boolean;
  }) => {
    const {
      parent,
      axis,
      spineSign = 1,
      start,
      end,
      surfaceY,
      depthCenter,
      maxDepth,
      maxHeight,
      seed,
      includeMangaSet = false,
      includeHorizontalStack = false,
      includeRetroGames = true,
    } = opts;

    let rngState = (seed * 1664525 + 1013904223) >>> 0;
    const nextRand = () => {
      rngState = (rngState * 1664525 + 1013904223) >>> 0;
      return (rngState & 0xffff) / 0xffff;
    };

    const placeItem = (
      along: number,
      y: number,
      depthOffset: number,
      mesh: THREE.Object3D,
      lean = 0,
      extraYaw = 0
    ) => {
      const depthPos = depthCenter + depthOffset * spineSign;
      if (axis === 'x') {
        mesh.position.set(along, y, depthPos);
        mesh.rotation.z = lean;
        mesh.rotation.y = (spineSign === -1 ? Math.PI : 0) + extraYaw;
      } else {
        mesh.position.set(depthPos, y, along);
        mesh.rotation.x = -lean;
        mesh.rotation.y = (spineSign === -1 ? Math.PI : 0) + extraYaw;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
    };

    const makeBookGeo = (thick: number, height: number, depth: number, variantIdx: number) =>
      axis === 'x'
        ? createBookGeometry(thick, height, depth, variantIdx)
        : createBookGeometry(depth, height, thick, variantIdx);

    const safeMaxH = Math.max(0.155, maxHeight - 0.022);
    const safeMaxD = Math.max(0.125, maxDepth - 0.025);

    // Airy ~48%–56% lived-in fill ratio so shelves never look crammed wall-to-wall!
    const totalSpan = Math.max(0.16, end - start);
    const fillRatio = 0.46 + nextRand() * 0.12;
    const alignRight = nextRand() > 0.56;
    const activeSpan = totalSpan * fillRatio;

    // Optionally reserve space on the open side for a compact 2-book horizontal stack (+ retro cartridge)
    const stackSpan = 0.155;
    const doStack = includeHorizontalStack && totalSpan > 0.42 && nextRand() > 0.35;
    const uprightBudget = Math.max(0.12, doStack ? activeSpan * 0.72 : activeSpan);

    let cursor = alignRight
      ? end - uprightBudget - 0.014
      : start + 0.012 + nextRand() * Math.min(0.04, totalSpan * 0.08);
    const uprightEnd = Math.min(end - 0.012, cursor + uprightBudget);

    // 1) Consecutive matched Manga set (3 slim Japanese tankobon volumes side-by-side)
    if (includeMangaSet && uprightEnd - cursor > 0.085) {
      const volCount = nextRand() > 0.55 ? 4 : 3;
      const baseMangaH = Math.min(safeMaxH, 0.172 + nextRand() * 0.008);
      const baseMangaD = Math.min(safeMaxD, 0.128 + nextRand() * 0.008);
      for (let v = 0; v < volCount; v++) {
        const thick = 0.0175 + nextRand() * 0.0028;
        if (cursor + thick > uprightEnd - 0.01) break;
        const h = baseMangaH + (nextRand() - 0.5) * 0.004;
        const d = baseMangaD + (nextRand() - 0.5) * 0.004;
        const depthStagger = (nextRand() - 0.45) * 0.010;
        const bk = new THREE.Mesh(makeBookGeo(thick, h, d, v), bookAtlasMat);
        placeItem(cursor + thick * 0.5, surfaceY + h * 0.5, depthStagger, bk, 0);
        cursor += thick + 0.0022;
      }
      cursor += 0.010;
    }

    // 2) Mixed Literature, Philosophy, Technical/Design books & Retro Game Cases/Cartridges
    let itemCount = 0;
    let placedCartridge = false;
    while (cursor < uprightEnd - 0.032) {
      const remaining = uprightEnd - cursor;
      const roll = nextRand();

      // Occasional sculpted upright pastel retro game cartridge tucked beside books
      if (
        includeRetroGames &&
        !placedCartridge &&
        itemCount >= 2 &&
        remaining > 0.055 &&
        roll > 0.84
      ) {
        const cartThick = 0.017;
        const cartH = 0.088;
        const cartD = Math.min(safeMaxD, 0.126);
        const cartMat = retroCartridgeMats[Math.floor(nextRand() * retroCartridgeMats.length)];
        const cartGroup = new THREE.Group();
        const cartBody = new THREE.Mesh(
          axis === 'x'
            ? createRetroCartridgeGeometry(cartThick, cartH, cartD)
            : createRetroCartridgeGeometry(cartD, cartH, cartThick),
          cartMat
        );
        cartBody.castShadow = true;
        cartBody.receiveShadow = true;
        cartGroup.add(cartBody);

        // Printed front label sticker on cartridge face
        const sticker = new THREE.Mesh(
          new THREE.BoxGeometry(
            axis === 'x' ? 0.0018 : cartD * 0.58,
            cartH * 0.54,
            axis === 'x' ? cartD * 0.58 : 0.0018
          ),
          retroLabelMat
        );
        if (axis === 'x') {
          sticker.position.set(cartThick * 0.49, 0.004, 0);
        } else {
          sticker.position.set(0, 0.004, cartThick * 0.49);
        }
        cartGroup.add(sticker);

        placeItem(cursor + cartThick * 0.5, surfaceY + cartH * 0.5, 0.012, cartGroup, 0);
        cursor += cartThick + 0.006;
        placedCartridge = true;
        itemCount++;
        continue;
      }

      // Pick category & realistic dimensions
      let variantIdx: number;
      let thick: number;
      let height: number;
      let depth: number;

      if (includeRetroGames && roll < 0.16) {
        // Retro Game Box (14-15)
        variantIdx = 14 + (itemCount % 2);
        thick = 0.017 + nextRand() * 0.004;
        height = Math.min(safeMaxH, 0.176 + nextRand() * 0.014);
        depth = Math.min(safeMaxD, 0.136 + nextRand() * 0.008);
      } else if (roll < 0.48) {
        // Literary Fiction (4-7)
        variantIdx = 4 + Math.floor(nextRand() * 4);
        thick = 0.021 + nextRand() * 0.008;
        height = Math.min(safeMaxH, 0.184 + nextRand() * 0.028);
        depth = Math.min(safeMaxD, 0.138 + nextRand() * 0.018);
      } else if (roll < 0.78) {
        // Philosophy (8-11)
        variantIdx = 8 + Math.floor(nextRand() * 4);
        thick = 0.022 + nextRand() * 0.010;
        height = Math.min(safeMaxH, 0.194 + nextRand() * 0.030);
        depth = Math.min(safeMaxD, 0.144 + nextRand() * 0.018);
      } else {
        // Technical / Design Manual (12-13)
        variantIdx = 12 + (itemCount % 2);
        thick = 0.026 + nextRand() * 0.008;
        height = Math.min(safeMaxH, 0.218 + nextRand() * 0.032);
        depth = Math.min(safeMaxD, 0.156 + nextRand() * 0.020);
      }

      // Lean the very last book naturally against the upright row if space permits
      const isLast = remaining < thick + 0.068 && itemCount >= 2;
      const lean = isLast ? -(0.14 + nextRand() * 0.07) : 0;
      const leanExtraSpan = isLast ? Math.abs(Math.sin(lean)) * height * 0.55 : 0;
      if (cursor + thick + leanExtraSpan > uprightEnd) break;

      const depthStagger = (nextRand() - 0.45) * 0.020;
      const bkMesh = new THREE.Mesh(makeBookGeo(thick, height, depth, variantIdx), bookAtlasMat);
      const yCenter =
        surfaceY + (height * Math.cos(lean)) * 0.5 + (thick * Math.abs(Math.sin(lean))) * 0.5;
      placeItem(
        cursor + thick * 0.5 + leanExtraSpan * 0.55,
        yCenter,
        depthStagger,
        bkMesh,
        lean
      );

      cursor += thick + 0.0028 + leanExtraSpan;
      itemCount++;
      if (isLast) break;
    }

    // 3) Compact Horizontal Stack of 2 books tucked gracefully into the airy open half
    if (doStack) {
      const stackCenter = alignRight
        ? start + stackSpan * 0.5 + 0.032
        : end - stackSpan * 0.5 - 0.024;
      let stackY = surfaceY;
      const stackCount = 2;
      for (let s = 0; s < stackCount; s++) {
        const flatW = Math.min(stackSpan, 0.168 - s * 0.012);
        const flatD = Math.min(safeMaxD, 0.142 - s * 0.008);
        const flatT = 0.022 + nextRand() * 0.007;
        const varIdx = (4 + ((seed + s * 5) % 10)) % 16;
        // Flat books keep their curved spine on +Z; rotate +PI/2 when placed on Z-axis shelves so spine faces outward (+X/-X)
        const flatGeo = createBookGeometry(flatW, flatT, flatD, varIdx);
        const flatBook = new THREE.Mesh(flatGeo, bookAtlasMat);
        const baseFlatYaw = axis === 'z' ? Math.PI / 2 : 0;
        const yawJitter = baseFlatYaw + (s % 2 === 0 ? 1 : -1) * (0.06 + nextRand() * 0.08);
        placeItem(
          stackCenter + (nextRand() - 0.5) * 0.008,
          stackY + flatT * 0.5,
          (nextRand() - 0.5) * 0.008,
          flatBook,
          0,
          yawJitter
        );
        stackY += flatT;
      }

      // Rest a sculpted retro cartridge neatly on top of the flat book stack
      if (includeRetroGames && stackY + 0.025 < surfaceY + safeMaxH) {
        const cartMat = retroCartridgeMats[(seed + 1) % retroCartridgeMats.length];
        const flatCart = new THREE.Mesh(
          createRetroCartridgeGeometry(0.118, 0.016, 0.082),
          cartMat
        );
        placeItem(stackCenter + 0.004, stackY + 0.0085, 0.005, flatCart, 0, 0.22);
      }
    }
  };
  const cavityDarkMat = mat({
    color: 0x8e6b5c,
    roughness: 0.88,
    metalness: 0.0,
    woodLacquer: 0.15,
  });
  const ceramicMat = mat({ color: 0xfff8fa, roughness: 0.34, metalness: 0.02 });
  // Botanical veined waxy plant leaf materials + rich organic granular potting soil
  const plantLeafMat = mat({
    map: textures.plantLeaf,
    bumpMap: textures.plantLeafBump,
    bumpScale: 0.016,
    color: 0xc2f0c8,
    roughness: 0.44,
    metalness: 0.02,
    side: THREE.DoubleSide,
    windSway: 0.65,
  });
  const plantLeafLightMat = mat({
    map: textures.plantLeaf,
    bumpMap: textures.plantLeafBump,
    bumpScale: 0.014,
    color: 0xdff8d6,
    roughness: 0.46,
    metalness: 0.02,
    side: THREE.DoubleSide,
    windSway: 0.65,
  });
  const pottingSoilMat = mat({
    map: textures.pottingSoil,
    bumpMap: textures.pottingSoilBump,
    bumpScale: 0.026,
    color: 0x6c5242,
    roughness: 0.95,
    metalness: 0.0,
  });
  const plantStemMat = mat({ color: 0x458f56, roughness: 0.72, metalness: 0.0 });
  const pageMat = mat({ color: 0xfffafc, roughness: 0.92, metalness: 0.0 });

  // =========================================================================
  // 1. PLUSH 3D CASHMERE-PILE CHRISTMAS AREA RUG WITH FRINGE & LOFT (Y = +0.014)
  // =========================================================================
  const rugGroup = new THREE.Group();
  rugGroup.position.set(4.10, 0.014, -5.25);

  // Thick cushioned warm cream-white wool backing (matches pure white rug edge — zero green bleed!)
  const rugBaseSlab = new THREE.Mesh(
    createBeveledSlab(5.0, 0.028, 5.4, 0.14, 0.011),
    mat({ color: 0xf3ecdd, roughness: 0.92, metalness: 0.0, celStrength: 0.52 })
  );
  rugBaseSlab.receiveShadow = true;
  outlines.addOutline(rugBaseSlab, 1.006);
  rugGroup.add(rugBaseSlab);

  const rugPileGeo = new THREE.PlaneGeometry(4.92, 5.32, 76, 82);
  rugPileGeo.rotateX(-Math.PI / 2);
  {
    const posAttr = rugPileGeo.attributes.position;
    const uvAttr = rugPileGeo.attributes.uv;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const u = THREE.MathUtils.clamp((x + 2.46) / 4.92, 0, 1);
      const v = THREE.MathUtils.clamp((z + 2.66) / 5.32, 0, 1);
      uvAttr.setXY(i, u, v);

      // Soft plush wool cushion crown + tapered micro-undulation so pile never dips into backing slab
      const edgeDist = Math.min(u, 1 - u, v, 1 - v);
      const edgeLoft = THREE.MathUtils.smoothstep(edgeDist, 0.0, 0.045) * 0.0065;
      const tuftFade = THREE.MathUtils.smoothstep(edgeDist, 0.0, 0.035);
      const microTuft =
        (Math.sin(x * 16.5 + z * 5.2) * 0.0016 +
          Math.cos(z * 18.2 - x * 6.4) * 0.0016 +
          Math.sin(x * 42.0) * Math.cos(z * 42.0) * 0.0010) *
        tuftFade;
      posAttr.setY(i, 0.0154 + edgeLoft + microTuft);
    }
    posAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    rugPileGeo.computeVertexNormals();
  }
  const rugMain = new THREE.Mesh(rugPileGeo, rugMat);
  rugMain.receiveShadow = true;
  rugGroup.add(rugMain);

  // Tactile Cream-Ivory Twisted Cashmere Tassel Fringes along North & South Rug Ends
  const rugFringeMat = mat({ color: 0xf4ecdc, roughness: 0.95, metalness: 0.0 });
  const fringeGeo = new THREE.CylinderGeometry(0.0055, 0.0045, 0.075, 6);
  fringeGeo.rotateX(Math.PI / 2);
  const fringeCountPerSide = 68;
  const fringesInst = new THREE.InstancedMesh(fringeGeo, rugFringeMat, fringeCountPerSide * 2);
  fringesInst.receiveShadow = true;
  let fIdx = 0;
  for (const zSide of [-1, 1]) {
    for (let k = 0; k < fringeCountPerSide; k++) {
      const fx = -2.38 + (k / (fringeCountPerSide - 1)) * 4.76;
      const fz = zSide * 2.73;
      const splay = (((k * 17) % 7) - 3) * 0.035;
      _instPos.set(4.10 + fx, 0.006, -5.25 + fz);
      _instEuler.set(0, splay, 0);
      _instQuat.setFromEuler(_instEuler);
      _instScale.set(1, 0.72, 1);
      _instMat.compose(_instPos, _instQuat, _instScale);
      fringesInst.setMatrixAt(fIdx++, _instMat);
    }
  }
  fringesInst.instanceMatrix.needsUpdate = true;
  fringesInst.computeBoundingSphere();
  group.add(fringesInst);
  group.add(rugGroup);

  // =========================================================================
  // 2. ARCHED MATCHA-GREEN VELVET CURTAINS + FLARED LACE VALANCE + SHEERS
  //    (上段聚拢成拱形、丝绒厚实柔滑质感的抹茶绿窗帘 + 向外舒展的蕾丝窗幔)
  // =========================================================================
  const curtainLeftGeo = createArchedVelvetCurtainGeometry(0.88, 2.56, -1, 0.072, 6.5, 0.34);
  curtainLeftGeo.rotateY(-Math.PI / 2);
  const curtainRightGeo = createArchedVelvetCurtainGeometry(0.88, 2.56, 1, 0.072, 6.5, 0.34);
  curtainRightGeo.rotateY(-Math.PI / 2);

  // Full-aperture translucent white voile sheer curtain geometry with fine vertical pleats
  const sheerPanelGeo = createDrapedCurtainGeometry(0.66, 2.46, 0.038, 10.5);
  sheerPanelGeo.rotateY(-Math.PI / 2);

  // Top Curtain Valance (live-redrawable Olive-Matcha Gingham + White Lace Trim)
  const valanceCanvas = document.createElement('canvas');
  valanceCanvas.width = 1024;
  valanceCanvas.height = 256;
  const paintValanceTopBand = () => {
    const W = valanceCanvas.width;
    const ctx2d = valanceCanvas.getContext('2d')!;
    const [cr, cg, cb] = parseHexRgb(curtainPalette.check);
    const vCheck = Math.max(48, Math.round(curtainPalette.checkSize * 0.72));
    const a = curtainPalette.checkAlpha;
    const mainLw = Math.max(5, Math.round(vCheck * 0.09));
    const subLw = 2;

    ctx2d.fillStyle = curtainPalette.base;
    ctx2d.fillRect(0, 0, W, 152);
    for (let x = Math.round(vCheck * 0.5); x < W; x += vCheck) {
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a.toFixed(2)})`;
      ctx2d.fillRect(x - mainLw * 0.5, 0, mainLw, 152);
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(a * 0.56).toFixed(2)})`;
      ctx2d.fillRect(x - mainLw - 4, 0, subLw, 152);
      ctx2d.fillRect(x + mainLw + 2, 0, subLw, 152);
    }
    for (let y = 42; y < 152; y += vCheck) {
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(a * 0.94).toFixed(2)})`;
      ctx2d.fillRect(0, y - mainLw * 0.5, W, mainLw);
      ctx2d.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${(a * 0.52).toFixed(2)})`;
      ctx2d.fillRect(0, y - mainLw - 4, W, subLw);
      ctx2d.fillRect(0, y + mainLw + 2, W, subLw);
    }
    // Soft vertical pleat shading across valance body
    for (let i = 0; i < 24; i++) {
      const fx = (i / 24) * W;
      const fw = W / 24;
      const pGrad = ctx2d.createLinearGradient(fx, 0, fx + fw, 0);
      pGrad.addColorStop(0.0, 'rgba(54, 68, 28, 0.14)');
      pGrad.addColorStop(0.46, 'rgba(255, 253, 246, 0.10)');
      pGrad.addColorStop(1.0, 'rgba(54, 68, 28, 0.14)');
      ctx2d.fillStyle = pGrad;
      ctx2d.fillRect(fx, 0, fw, 152);
    }
  };

  const valanceTex = (() => {
    const W = 1024;
    const H = 256;
    const c = valanceCanvas;
    const ctx2d = c.getContext('2d')!;
    ctx2d.clearRect(0, 0, W, H);
    paintValanceTopBand();

    // 2) Intricate Multi-Tier White Embroidered Lace Trim (y = 144..252)
    // 2a) Upper satin lace heading ribbon with delicate twin stitch lines & tiny pearl beads
    ctx2d.fillStyle = '#fdfcf8';
    ctx2d.fillRect(0, 144, W, 16);
    ctx2d.fillStyle = 'rgba(186, 194, 180, 0.55)';
    ctx2d.fillRect(0, 143, W, 2);
    ctx2d.fillRect(0, 159, W, 1.5);
    ctx2d.fillStyle = 'rgba(218, 222, 212, 0.75)';
    for (let sx = 6; sx < W; sx += 12) {
      ctx2d.beginPath();
      ctx2d.arc(sx, 152, 2.0, 0, Math.PI * 2);
      ctx2d.fill();
    }

    // 2b) Sheer diamond-mesh tulle insertion band (y = 160..198) with embroidered floral diamonds
    ctx2d.fillStyle = 'rgba(253, 252, 248, 0.52)';
    ctx2d.fillRect(0, 160, W, 38);
    ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx2d.lineWidth = 1.3;
    for (let mx = -40; mx < W + 40; mx += 11) {
      ctx2d.beginPath();
      ctx2d.moveTo(mx, 160);
      ctx2d.lineTo(mx + 38, 198);
      ctx2d.moveTo(mx + 38, 160);
      ctx2d.lineTo(mx, 198);
      ctx2d.stroke();
    }
    // Delicate embroidered diamond motifs along the mesh band
    const scallops = 24;
    const scW = W / scallops;
    const scR = scW * 0.5;
    for (let i = 0; i < scallops; i++) {
      const cx = i * scW + scR;
      const my = 179;
      ctx2d.fillStyle = '#ffffff';
      ctx2d.beginPath();
      ctx2d.moveTo(cx, my - 11);
      ctx2d.lineTo(cx + 9, my);
      ctx2d.lineTo(cx, my + 11);
      ctx2d.lineTo(cx - 9, my);
      ctx2d.closePath();
      ctx2d.fill();
      // Tiny embroidered side buds
      ctx2d.beginPath();
      ctx2d.arc(cx - 13, my, 2.6, 0, Math.PI * 2);
      ctx2d.arc(cx + 13, my, 2.6, 0, Math.PI * 2);
      ctx2d.fill();
    }
    // Crisp lower lace cord separating tulle mesh from scalloped fringe
    ctx2d.fillStyle = '#ffffff';
    ctx2d.fillRect(0, 196, W, 5);

    // 2c) 24 Finely Sculpted Double-Ring Scalloped Lace Arches with Picot Pearl Beading
    for (let i = 0; i < scallops; i++) {
      const cx = i * scW + scR;
      const cy = 201;

      // Translucent inner tulle web inside each scallop arch
      ctx2d.fillStyle = 'rgba(254, 253, 250, 0.72)';
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, scR + 1.5, 0, Math.PI, false);
      ctx2d.closePath();
      ctx2d.fill();

      // Bold embroidered outer scalloped border cordonnet
      ctx2d.strokeStyle = '#ffffff';
      ctx2d.lineWidth = 4.2;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, scR + 0.5, 0.04, Math.PI - 0.04, false);
      ctx2d.stroke();

      // Secondary inner concentric lace embroidery arc
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx2d.lineWidth = 2.0;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, scR * 0.66, 0.14, Math.PI - 0.14, false);
      ctx2d.stroke();

      // Subtle silver-ivory embroidery relief shadow
      ctx2d.strokeStyle = 'rgba(202, 206, 198, 0.52)';
      ctx2d.lineWidth = 1.2;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, scR * 0.84, 0.10, Math.PI - 0.10, false);
      ctx2d.stroke();

      // Tiny embroidered fan rays inside each scallop
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx2d.lineWidth = 1.5;
      for (let r = 1; r <= 5; r++) {
        const ang = (r / 6) * Math.PI;
        ctx2d.beginPath();
        ctx2d.moveTo(cx + Math.cos(ang) * 4.5, cy + Math.sin(ang) * 4.5);
        ctx2d.lineTo(cx + Math.cos(ang) * (scR - 2.0), cy + Math.sin(ang) * (scR - 2.0));
        ctx2d.stroke();
      }

      // Delicate micro-picot lace pearl loops around every scallop edge
      ctx2d.fillStyle = '#ffffff';
      for (let b = 1; b <= 7; b++) {
        const ang = (b / 8) * Math.PI;
        const px = cx + Math.cos(ang) * (scR + 3.4);
        const py = cy + Math.sin(ang) * (scR + 3.4);
        ctx2d.beginPath();
        ctx2d.arc(px, py, 2.3, 0, Math.PI * 2);
        ctx2d.fill();
      }
    }

    // 2d) Punch delicate openwork eyelet cutouts (central medallion + twin side teardrops + mesh diamonds)
    ctx2d.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < scallops; i++) {
      const cx = i * scW + scR;
      // Mesh diamond center eyelet
      ctx2d.beginPath();
      ctx2d.arc(cx, 179, 3.0, 0, Math.PI * 2);
      ctx2d.fill();
      // Scallop inner center floral eyelet
      ctx2d.beginPath();
      ctx2d.arc(cx, 211, 3.6, 0, Math.PI * 2);
      ctx2d.fill();
      // Flanking petite eyelet teardrops
      for (const ox of [-9.5, 9.5]) {
        ctx2d.beginPath();
        ctx2d.arc(cx + ox, 207, 2.2, 0, Math.PI * 2);
        ctx2d.fill();
      }
    }
    ctx2d.globalCompositeOperation = 'source-over';

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  })();

  const valanceMat = mat({
    map: valanceTex,
    color: 0xffffff,
    roughness: 0.60,
    metalness: 0.03,
    rimScale: 1.40,
    celStrength: 0.36,
    side: THREE.DoubleSide,
    alphaTest: 0.28,
    windSway: 0.18,
  });
  // Outwardly flared ruffle valance (never pinches inward!)
  const valanceGeo = createFlaredValanceGeometry(1.80, 0.38, 0.044, 13.0);
  valanceGeo.rotateY(-Math.PI / 2);

  // InstancedMesh for 24 Curtain Rings, 4 Rod Finials & 4 Wall Brackets
  const ringGeo = new THREE.TorusGeometry(0.024, 0.005, 8, 12);
  ringGeo.rotateY(Math.PI / 2);
  const curtainRingsInst = new THREE.InstancedMesh(ringGeo, darkOakMat, 24);
  let ringIdx = 0;

  const finialGeo = new THREE.SphereGeometry(0.036, 12, 10);
  finialGeo.scale(1, 1, 1.35);
  const finialsInst = new THREE.InstancedMesh(finialGeo, oakMat, 4);
  let finialIdx = 0;

  const bracketGeo = createBeveledBox(0.18, 0.036, 0.034, 0.008, 2);
  const bracketsInst = new THREE.InstancedMesh(bracketGeo, darkOakMat, 4);
  let bracketIdx = 0;

  for (const wz of [-7.20, -2.96]) {
    // Inner sheer curtain rod & 2 translucent white sheer panels spanning the window aperture
    const sheerRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 1.54, 10),
      oakMat
    );
    sheerRod.rotation.x = Math.PI / 2;
    sheerRod.position.set(7.17, 2.75, wz);
    group.add(sheerRod);

    for (const sSide of [-1, 1]) {
      const sheerMesh = new THREE.Mesh(sheerPanelGeo, sheerCurtainMat);
      sheerMesh.position.set(7.17, 1.51, wz + sSide * 0.32);
      sheerMesh.userData.dynamic = true;
      group.add(sheerMesh);
    }

    for (const side of [-1, 1] as const) {
      const curtain = new THREE.Group();
      // Centered on window wz so upper section of left & right velvet panels meet seamlessly at wz,
      // then sweep outward in a graceful elliptical arch framing the window!
      curtain.position.set(7.08, 1.50, wz);

      const drapeMesh = new THREE.Mesh(
        side === -1 ? curtainLeftGeo : curtainRightGeo,
        curtainMat
      );
      drapeMesh.castShadow = true;
      drapeMesh.receiveShadow = true;
      outlines.addOutline(drapeMesh, 1.012);
      curtain.add(drapeMesh);

      // Delicate White Cotton Tassel Fringe hanging along the exact wavy bottom hem (窗帘下摆白色流苏!)
      const tasselMat = mat({
        color: 0xfbf7ee,
        roughness: 0.92,
        metalness: 0.0,
        windSway: 0.65,
      });
      const tasselGeo = (() => {
        const cord = new THREE.CylinderGeometry(0.0028, 0.0028, 0.016, 6);
        cord.translate(0, -0.008, 0);
        const bead = new THREE.SphereGeometry(0.0065, 7, 6);
        bead.translate(0, -0.018, 0);
        const skirt = new THREE.ConeGeometry(0.0125, 0.046, 8);
        skirt.translate(0, -0.044, 0);
        return BufferGeometryUtils.mergeGeometries([cord, bead, skirt], false)!;
      })();
      const hemPosAttr = (side === -1 ? curtainLeftGeo : curtainRightGeo).attributes.position;
      const hemUvAttr = (side === -1 ? curtainLeftGeo : curtainRightGeo).attributes.uv;
      const tasselAnchors: THREE.Vector3[] = [];
      for (let vi = 0; vi < hemPosAttr.count; vi++) {
        if (hemUvAttr.getY(vi) <= 0.001) {
          tasselAnchors.push(new THREE.Vector3(hemPosAttr.getX(vi), hemPosAttr.getY(vi), hemPosAttr.getZ(vi)));
        }
      }
      const stride = Math.max(1, Math.floor(tasselAnchors.length / 18));
      const picked = tasselAnchors.filter((_, idx) => idx % stride === 0);
      const tasselsInst = new THREE.InstancedMesh(tasselGeo, tasselMat, picked.length);
      for (let ti = 0; ti < picked.length; ti++) {
        const a = picked[ti];
        _instPos.set(a.x, a.y + 0.003, a.z);
        _instEuler.set(0, 0, 0);
        _instQuat.setFromEuler(_instEuler);
        _instScale.set(1, 1, 1);
        _instMat.compose(_instPos, _instQuat, _instScale);
        tasselsInst.setMatrixAt(ti, _instMat);
      }
      tasselsInst.instanceMatrix.needsUpdate = true;
      tasselsInst.computeBoundingSphere();
      curtain.add(tasselsInst);

      // Sculpted velvet tieback ribbon band + 2-loop bow + fluttering tails at the gathered waist (v = 0.34 -> y = -0.41)
      const tieY = -0.41;
      const tieZ = side * 0.635;
      const tieBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.095, 0.016, 10, 20),
        curtainBandMat
      );
      tieBand.rotation.x = Math.PI / 2;
      tieBand.scale.set(0.68, 1.24, 1);
      tieBand.position.set(-0.012, tieY, tieZ);
      curtain.add(tieBand);

      // Ribbon bow facing into the living room (-X)
      const bowKnot = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 10, 8),
        curtainBandMat
      );
      bowKnot.position.set(-0.072, tieY, tieZ);
      curtain.add(bowKnot);

      for (const bSide of [-1, 1]) {
        const bowLoop = new THREE.Mesh(
          new THREE.TorusGeometry(0.030, 0.009, 8, 16),
          curtainBandMat
        );
        bowLoop.rotation.y = Math.PI / 2;
        bowLoop.rotation.x = bSide * 0.28;
        bowLoop.scale.set(1.35, 0.72, 0.55);
        bowLoop.position.set(-0.078, tieY + 0.012, tieZ + bSide * 0.034);
        curtain.add(bowLoop);

        const ribbonTail = new THREE.Mesh(
          new THREE.BoxGeometry(0.008, 0.145, 0.022),
          curtainBandMat
        );
        ribbonTail.rotation.x = bSide * 0.22;
        ribbonTail.rotation.z = -0.10;
        ribbonTail.position.set(-0.080, tieY - 0.072, tieZ + bSide * 0.024);
        curtain.add(ribbonTail);
      }

      for (let r = 0; r < 6; r++) {
        const rz = side * (0.08 + r * 0.148);
        _instMat.makeTranslation(7.09, 2.79, wz + rz);
        curtainRingsInst.setMatrixAt(ringIdx++, _instMat);
      }

      group.add(curtain);
    }

    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.84, 12),
      darkOakMat
    );
    rod.rotation.x = Math.PI / 2;
    rod.position.set(7.09, 2.81, wz);
    rod.castShadow = true;
    group.add(rod);

    // Top outwardly-flared matcha velvet valance with intricate scalloped white lace trim
    const valanceMesh = new THREE.Mesh(valanceGeo, valanceMat);
    valanceMesh.position.set(6.99, 2.66, wz);
    valanceMesh.castShadow = true;
    valanceMesh.receiveShadow = true;
    group.add(valanceMesh);

    for (const end of [-1, 1]) {
      _instMat.makeTranslation(7.09, 2.81, wz + end * 0.90);
      finialsInst.setMatrixAt(finialIdx++, _instMat);

      _instMat.makeTranslation(7.17, 2.81, wz + end * 0.76);
      bracketsInst.setMatrixAt(bracketIdx++, _instMat);
    }
  }
  curtainRingsInst.instanceMatrix.needsUpdate = true;
  curtainRingsInst.computeBoundingSphere();
  finialsInst.instanceMatrix.needsUpdate = true;
  finialsInst.computeBoundingSphere();
  bracketsInst.instanceMatrix.needsUpdate = true;
  bracketsInst.computeBoundingSphere();
  group.add(curtainRingsInst, finialsInst, bracketsInst);

  // =========================================================================
  // 3. MISIDE HONEY-OAK GRADIENT TV MEDIA CONSOLE, SLEEK FLAT TV & MATTE-BLACK SPEAKERS
  //    (X = 6.76, Z = -5.08 — Clean soft shading gradients, minimal grain stripes!)
  // =========================================================================
  const makeSmoothGradientTexture = (
    topHex: string,
    midHex: string,
    botHex: string,
    edgeShade = 0.14,
    subtleGrainAlpha = 0.025
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx2d = c.getContext('2d')!;
    const vGrad = ctx2d.createLinearGradient(0, 0, 0, 256);
    vGrad.addColorStop(0.0, topHex);
    vGrad.addColorStop(0.48, midHex);
    vGrad.addColorStop(1.0, botHex);
    ctx2d.fillStyle = vGrad;
    ctx2d.fillRect(0, 0, 256, 256);

    // Soft horizontal edge AO falloff for painterly 3D volume
    const hGrad = ctx2d.createLinearGradient(0, 0, 256, 0);
    hGrad.addColorStop(0.0, `rgba(42, 22, 18, ${edgeShade})`);
    hGrad.addColorStop(0.14, 'rgba(255, 255, 255, 0.04)');
    hGrad.addColorStop(0.5, 'rgba(255, 248, 240, 0.06)');
    hGrad.addColorStop(0.86, 'rgba(255, 255, 255, 0.03)');
    hGrad.addColorStop(1.0, `rgba(42, 22, 18, ${edgeShade})`);
    ctx2d.fillStyle = hGrad;
    ctx2d.fillRect(0, 0, 256, 256);

    // Ultra-subtle satin tonal variation (almost zero stripes)
    if (subtleGrainAlpha > 0) {
      for (let i = 0; i < 18; i++) {
        const y = (i / 18) * 256 + ((i * 37) % 11);
        ctx2d.fillStyle = i % 2 === 0
          ? `rgba(255, 240, 224, ${subtleGrainAlpha})`
          : `rgba(92, 48, 26, ${subtleGrainAlpha})`;
        ctx2d.fillRect(0, y, 256, 4 + (i % 5));
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  // High-Res (512x512) Water-Lacquered Oak Wood Grain Texture for TV Stand, Wall Shelf & Sideboard (木纹水漆质感)
  const makeWaterLacquerWoodTexture = (
    topHex: string,
    midHex: string,
    botHex: string,
    veinColor: string,
    highlightColor: string,
    edgeShade = 0.14
  ): THREE.CanvasTexture => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx2d = c.getContext('2d')!;
    const vGrad = ctx2d.createLinearGradient(0, 0, 0, S);
    vGrad.addColorStop(0.0, topHex);
    vGrad.addColorStop(0.48, midHex);
    vGrad.addColorStop(1.0, botHex);
    ctx2d.fillStyle = vGrad;
    ctx2d.fillRect(0, 0, S, S);

    // Subtle aqueous sheen & soft painterly edge AO falloff
    const hGrad = ctx2d.createLinearGradient(0, 0, S, 0);
    hGrad.addColorStop(0.0, `rgba(42, 22, 16, ${edgeShade})`);
    hGrad.addColorStop(0.16, 'rgba(255, 250, 244, 0.06)');
    hGrad.addColorStop(0.5, 'rgba(255, 248, 240, 0.09)');
    hGrad.addColorStop(0.84, 'rgba(255, 250, 244, 0.05)');
    hGrad.addColorStop(1.0, `rgba(42, 22, 16, ${edgeShade})`);
    ctx2d.fillStyle = hGrad;
    ctx2d.fillRect(0, 0, S, S);

    // Crisp flowing natural oak wood grain fibers under clear water-based lacquer
    for (let i = 0; i < 88; i++) {
      const fy = (i / 88) * S;
      const isHi = i % 5 === 0;
      const isDeep = i % 7 === 0;
      ctx2d.strokeStyle = isHi ? highlightColor : veinColor;
      ctx2d.globalAlpha = isHi ? 0.16 : isDeep ? 0.22 : 0.11;
      ctx2d.lineWidth = isDeep ? 1.5 : 0.95;
      ctx2d.beginPath();
      ctx2d.moveTo(0, fy);
      const w1 = Math.sin(i * 0.41) * 5.6 + Math.cos(i * 0.19) * 3.0;
      const w2 = -Math.cos(i * 0.33) * 5.2 + Math.sin(i * 0.23) * 2.6;
      ctx2d.bezierCurveTo(S * 0.33, fy + w1, S * 0.67, fy + w2, S, fy);
      ctx2d.stroke();
    }

    // Organic cathedral growth ring arches
    for (let k = 0; k < 5; k++) {
      const cx = 64 + k * 96;
      const cy = 62 + ((k * 137) % (S - 124));
      for (let r = 1; r <= 5; r++) {
        ctx2d.strokeStyle = veinColor;
        ctx2d.globalAlpha = r % 2 === 0 ? 0.15 : 0.10;
        ctx2d.lineWidth = 1.05;
        ctx2d.beginPath();
        ctx2d.ellipse(cx, cy, r * 30, r * 4.4, 0.02 * (k % 2 === 0 ? 1 : -1), 0, Math.PI * 2);
        ctx2d.stroke();
      }
    }

    // Fine oak open pores & silky medullary sheen flecks
    for (let i = 0; i < 480; i++) {
      const px = (i * 197 + 19) % S;
      const py = (i * 313 + 7) % S;
      const len = 6 + (i % 14);
      ctx2d.fillStyle = i % 9 === 0 ? highlightColor : veinColor;
      ctx2d.globalAlpha = i % 9 === 0 ? 0.17 : 0.11;
      ctx2d.fillRect(px, py, len, 1.1);
    }
    ctx2d.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  };

  // Water-lacquered honey-apricot & deep walnut oak wood grain textures (水漆木纹质感)
  const tvWoodGradTex = makeWaterLacquerWoodTexture('#f2bb8c', '#e39e6a', '#c97e4f', '#6b3518', '#fff4e2', 0.14);
  const tvWoodDeepTex = makeWaterLacquerWoodTexture('#d6905e', '#be7446', '#9a5834', '#4d240f', '#ffebd2', 0.18);
  // Smooth satin charcoal-slate gradient for TV bezel, stand, media players & studio speakers
  const tvCharcoalGradTex = makeSmoothGradientTexture('#3b404e', '#262a35', '#161922', 0.18, 0.0);
  const tvSpeakerConeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx2d = c.getContext('2d')!;
    const rGrad = ctx2d.createRadialGradient(54, 52, 4, 64, 64, 62);
    rGrad.addColorStop(0.0, '#4d5364');
    rGrad.addColorStop(0.28, '#292d38');
    rGrad.addColorStop(0.68, '#1b1e26');
    rGrad.addColorStop(0.86, '#393e4c');
    rGrad.addColorStop(1.0, '#14161d');
    ctx2d.fillStyle = rGrad;
    ctx2d.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  // Sleek MiSide standby TV glass gradient (deep midnight-slate -> soft indigo sheen -> velvet charcoal)
  const tvStandbyGradTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 288;
    const ctx2d = c.getContext('2d')!;
    const bg = ctx2d.createLinearGradient(0, 0, 0, 288);
    bg.addColorStop(0.0, '#171d2c');
    bg.addColorStop(0.46, '#232e46');
    bg.addColorStop(0.50, '#182032');
    bg.addColorStop(1.0, '#101420');
    ctx2d.fillStyle = bg;
    ctx2d.fillRect(0, 0, 512, 288);
    // Soft diagonal window reflection sheen
    const sheen = ctx2d.createRadialGradient(365, 86, 12, 365, 86, 210);
    sheen.addColorStop(0.0, 'rgba(185, 208, 255, 0.14)');
    sheen.addColorStop(0.5, 'rgba(140, 168, 230, 0.05)');
    sheen.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx2d.fillStyle = sheen;
    ctx2d.fillRect(0, 0, 512, 288);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const tvWoodMat = mat({
    map: tvWoodGradTex,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.0052,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.0,
    woodLacquer: 0.85,
  });
  const tvWoodDeepMat = mat({
    map: tvWoodDeepTex,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.0055,
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0.0,
    woodLacquer: 0.75,
  });
  const tvCharcoalMat = mat({
    map: tvCharcoalGradTex,
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.32,
  });
  const tvCharcoalTrimMat = mat({
    map: tvCharcoalGradTex,
    color: 0xd8dce8,
    roughness: 0.28,
    metalness: 0.42,
  });

  // Vintage oil-rubbed antique bronze hardware material (复古暗古铜拉手材质，与黄铜形成丰富层次)
  const antiqueBronzeMat = mat({ color: 0x4a382c, roughness: 0.34, metalness: 0.78 });

  // Reusable Varied American Hardware Handle Builder (多种复古美式拉手，不再千篇一律！)
  // facingDir: +1 means handle extends toward +X; -1 means toward -X
  const createAmericanHandle = (
    style: 'bail' | 'cup' | 'bar' | 'ring' | 'octKnob',
    facingDir: 1 | -1 = 1
  ): THREE.Group => {
    const h = new THREE.Group();
    const s = facingDir;
    if (style === 'bail') {
      // Classic American Curved Bail Drop-Pull (参考图二顶部抽屉复古弧形吊环拉手)
      for (const rz of [-0.036, 0.036]) {
        const rosette = new THREE.Mesh(
          new THREE.CylinderGeometry(0.010, 0.012, 0.005, 8),
          antiqueBronzeMat
        );
        rosette.rotation.z = Math.PI / 2;
        rosette.position.set(s * 0.003, 0.008, rz);
        h.add(rosette);
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0035, 0.0035, 0.012, 8),
          antiqueBronzeMat
        );
        post.rotation.z = Math.PI / 2;
        post.position.set(s * 0.009, 0.008, rz);
        h.add(post);
      }
      const bailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.014, 0.008, -0.036),
        new THREE.Vector3(s * 0.020, -0.010, -0.022),
        new THREE.Vector3(s * 0.022, -0.016, 0),
        new THREE.Vector3(s * 0.020, -0.010, 0.022),
        new THREE.Vector3(s * 0.014, 0.008, 0.036),
      ]);
      const bailMesh = new THREE.Mesh(
        new THREE.TubeGeometry(bailCurve, 16, 0.0038, 8, false),
        antiqueBronzeMat
      );
      bailMesh.castShadow = true;
      h.add(bailMesh);
    } else if (style === 'cup') {
      // Classic American Half-Moon Shell Cup Pull (复古贝壳半月杯形拉手)
      const hood = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 12, 8, 0, Math.PI, 0, Math.PI * 0.55),
        antiqueBronzeMat
      );
      hood.scale.set(0.55, 0.72, 1.35);
      hood.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      hood.position.set(s * 0.002, 0.004, 0);
      hood.castShadow = true;
      h.add(hood);
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, 0.006, 0.072),
        handleBrassMat
      );
      lip.position.set(s * 0.003, 0.009, 0);
      h.add(lip);
    } else if (style === 'bar') {
      // Sleek Stepped Vertical Bar Pull (复古金属阶梯竖拉手 — 用于电视柜柜门)
      for (const py of [-0.042, 0.042]) {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.014, 0.014), antiqueBronzeMat);
        base.position.set(s * 0.003, py, 0);
        h.add(base);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8), antiqueBronzeMat);
        post.rotation.z = Math.PI / 2;
        post.position.set(s * 0.012, py, 0);
        h.add(post);
      }
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.104, 0.009), handleBrassMat);
      grip.position.set(s * 0.021, 0, 0);
      grip.castShadow = true;
      h.add(grip);
    } else if (style === 'ring') {
      // Vintage Hanging Drop-Ring Pull (复古圆盘吊环拉手 — 用于实木柜门)
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.018, 0.005, 8),
        antiqueBronzeMat
      );
      plate.rotation.z = Math.PI / 2;
      plate.position.set(s * 0.003, 0.010, 0);
      h.add(plate);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.016, 0.0036, 8, 16),
        handleBrassMat
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s * 0.012, -0.006, 0);
      ring.castShadow = true;
      h.add(ring);
    } else {
      // Faceted Octagonal Antique-Bronze Knob (复古八角暗铜门钮 — 用于玻璃门)
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.013, 0.004, 8),
        antiqueBronzeMat
      );
      plate.rotation.z = Math.PI / 2;
      plate.position.set(s * 0.003, 0, 0);
      h.add(plate);
      const knob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.008, 0.014, 8),
        antiqueBronzeMat
      );
      knob.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      knob.position.set(s * 0.011, 0, 0);
      knob.castShadow = true;
      h.add(knob);
    }
    return h;
  };

  const tvConsole = new THREE.Group();
  tvConsole.position.set(6.76, 0, -5.08);

  // Crisp Sharp-Edged 3-Step American Crown Top (硬朗直角阶梯顶冠，告别凸出发圆!)
  const consoleTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.032, 2.44),
    tvWoodMat
  );
  consoleTop.position.y = 0.609;
  consoleTop.castShadow = true;
  consoleTop.receiveShadow = true;
  tvConsole.add(consoleTop);

  const consoleUnderCrown = new THREE.Mesh(
    new THREE.BoxGeometry(0.585, 0.020, 2.39),
    tvWoodDeepMat
  );
  consoleUnderCrown.position.y = 0.583;
  tvConsole.add(consoleUnderCrown);

  const consoleFriezeBead = new THREE.Mesh(
    new THREE.BoxGeometry(0.565, 0.014, 2.35),
    tvWoodMat
  );
  consoleFriezeBead.position.y = 0.566;
  tvConsole.add(consoleFriezeBead);

  // Full-width upper open media shelf divider with crisp flat front lip (top at Y = 0.391m)
  const upperBayFloor = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.026, 2.28),
    tvWoodMat
  );
  upperBayFloor.position.set(-0.005, 0.378, 0);
  upperBayFloor.castShadow = true;
  upperBayFloor.receiveShadow = true;
  tvConsole.add(upperBayFloor);

  const upperBayLip = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.028, 2.28),
    tvWoodDeepMat
  );
  upperBayLip.position.set(-0.274, 0.378, 0);
  tvConsole.add(upperBayLip);

  // Crisp Sharp-Edged Baseboard Plinth + Bracket Feet (告别圆角底框!)
  const consoleBot = new THREE.Mesh(
    new THREE.BoxGeometry(0.60, 0.030, 2.40),
    tvWoodMat
  );
  consoleBot.position.y = 0.083;
  consoleBot.castShadow = true;
  consoleBot.receiveShadow = true;
  tvConsole.add(consoleBot);

  const plinthSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.022, 2.34),
    tvWoodDeepMat
  );
  plinthSkirt.position.y = 0.057;
  tvConsole.add(plinthSkirt);

  for (const fx of [-0.24, 0.24]) {
    for (const fz of [-1.11, 0, 1.11]) {
      const isCorner = fz !== 0;
      const bracketFoot = new THREE.Mesh(
        new THREE.BoxGeometry(isCorner ? 0.088 : 0.068, 0.064, isCorner ? 0.125 : 0.080),
        tvWoodDeepMat
      );
      bracketFoot.position.set(fx, 0.032, fz);
      bracketFoot.castShadow = true;
      bracketFoot.receiveShadow = true;
      tvConsole.add(bracketFoot);
    }
  }

  // Single clean solid backing panel + crisp sharp-edged side walls
  const carcass = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.49, 2.28),
    tvWoodDeepMat
  );
  carcass.position.set(0.25, 0.335, 0);
  carcass.receiveShadow = true;
  tvConsole.add(carcass);

  const outerSideGeo = new THREE.BoxGeometry(0.56, 0.49, 0.040);
  for (const sz of [-1.14, 1.14]) {
    const sideWall = new THREE.Mesh(outerSideGeo, tvWoodMat);
    sideWall.position.set(0, 0.335, sz);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    tvConsole.add(sideWall);

    const sideInset = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.36, 0.010),
      tvWoodDeepMat
    );
    sideInset.position.set(0, 0.335, sz + (sz < 0 ? -0.017 : 0.017));
    tvConsole.add(sideInset);
  }

  const lowerDivGeo = new THREE.BoxGeometry(0.53, 0.275, 0.034);
  for (const sz of [-0.38, 0.38]) {
    const div = new THREE.Mesh(lowerDivGeo, tvWoodMat);
    div.position.set(-0.005, 0.232, sz);
    div.castShadow = true;
    div.receiveShadow = true;
    tvConsole.add(div);
  }

  // Clean flush sharp-edged front vertical stiles (平齐硬朗直边框，不凸出发圆!)
  for (const [pz, pH, pY] of [
    [-1.14, 0.47, 0.335],
    [1.14, 0.47, 0.335],
    [-0.38, 0.268, 0.232],
    [0.38, 0.268, 0.232],
  ] as const) {
    const stilePost = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, pH, 0.048),
      tvWoodMat
    );
    stilePost.position.set(-0.272, pY, pz);
    tvConsole.add(stilePost);
  }

  // Left & Right Interactive Flush-Framed Flat-Recessed Cabinet Doors + Stepped Vertical Bar Pulls!
  for (const sz of [-0.76, 0.76]) {
    const hingeSide: -1 | 1 = sz < 0 ? -1 : 1;
    const doorFrame = new THREE.Group();

    // Flat recessed inner panel
    const doorBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.260, 0.694),
      tvWoodDeepMat
    );
    doorBack.position.set(0.004, 0, 0);
    doorFrame.add(doorBack);

    // Flush sharp-edged Shaker rails & stiles (clean 7mm recess, zero bulging rounded blocks!)
    for (const fy of [-0.112, 0.112]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.040, 0.70), tvWoodMat);
      rail.position.set(-0.001, fy, 0);
      rail.castShadow = true;
      doorFrame.add(rail);
    }
    for (const fz of [-0.322, 0.322]) {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.264, 0.056), tvWoodMat);
      stile.position.set(-0.001, 0, fz);
      stile.castShadow = true;
      doorFrame.add(stile);
    }
    // Crisp stepped inner shadow molding lip
    for (const fy of [-0.088, 0.088]) {
      const innerBead = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.009, 0.588), tvWoodDeepMat);
      innerBead.position.set(-0.001, fy, 0);
      doorFrame.add(innerBead);
    }
    for (const fz of [-0.290, 0.290]) {
      const innerBead = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.184, 0.009), tvWoodDeepMat);
      innerBead.position.set(-0.001, 0, fz);
      doorFrame.add(innerBead);
    }

    // Distinct Sleek Stepped Vertical Bar Pull on TV console doors!
    const barHandle = createAmericanHandle('bar', -1);
    barHandle.position.set(-0.010, 0, -hingeSide * 0.305);
    doorFrame.add(barHandle);

    registerCabinetDoor({
      id: sz < 0 ? 'liv_cab_tv_left' : 'liv_cab_tv_right',
      label: sz < 0 ? '电视柜左镶板柜门' : '电视柜右镶板柜门',
      room: 'living',
      parent: tvConsole,
      centerX: -0.265,
      centerY: 0.232,
      centerZ: sz,
      width: 0.70,
      height: 0.268,
      thickness: 0.026,
      facingAxis: 'x',
      facingSign: -1,
      hingeSide,
      openSign: hingeSide,
      doorMat: tvWoodMat,
      moldingMat: tvWoodDeepMat,
      handleMat: handleBrassMat,
      customDoorGroup: doorFrame,
    });
  }

  // Two Sleek Matte-Black Media Players / Consoles stacked in upper & lower center open bays (matching Image 1!)
  for (const [py, ph, pw, pd] of [
    [0.422, 0.054, 0.48, 0.34],
    [0.128, 0.058, 0.44, 0.32],
  ] as const) {
    const box = new THREE.Mesh(
      createBeveledBox(pd, ph, pw, 0.009, 2),
      tvCharcoalMat
    );
    box.position.set(-0.04, py, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    outlines.addOutline(box, 1.018);
    tvConsole.add(box);

    // Subtle front gloss slot & tiny white power indicator
    const slot = new THREE.Mesh(
      createBeveledBox(0.006, 0.008, pw * 0.52, 0.002, 1),
      tvCharcoalTrimMat
    );
    slot.position.set(-0.04 - pd / 2 - 0.001, py + 0.004, -0.03);
    tvConsole.add(slot);
  }

  // Compact Matte-Black Studio Monitor Speakers with Smooth Gradient Cabinets & Cones (matching Image 1!)
  const speakerCabMat = tvCharcoalMat;
  const speakerBaffleMat = mat({
    map: tvCharcoalGradTex,
    color: 0xb8bcc8,
    roughness: 0.48,
    metalness: 0.16,
  });
  const speakerConeMat = mat({
    map: tvSpeakerConeTex,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.18,
  });
  const speakerRingMat = mat({ color: 0x3b404e, roughness: 0.32, metalness: 0.45 });

  // Pair of sleek matte-black bookshelf speakers flanking the TV on the Console Top
  for (const spZ of [-1.03, 1.03]) {
    const hiFiGroup = new THREE.Group();
    hiFiGroup.position.set(-0.02, 0.625, spZ);
    hiFiGroup.rotation.y = spZ < 0 ? -0.10 : 0.10;

    const cab = new THREE.Mesh(
      createBeveledBox(0.19, 0.28, 0.16, 0.012, 3),
      speakerCabMat
    );
    cab.position.y = 0.145;
    cab.castShadow = true;
    cab.receiveShadow = true;
    outlines.addOutline(cab, 1.02);
    hiFiGroup.add(cab);

    const baffle = new THREE.Mesh(
      createBeveledBox(0.010, 0.245, 0.132, 0.004, 2),
      speakerBaffleMat
    );
    baffle.position.set(-0.092, 0.145, 0);
    hiFiGroup.add(baffle);

    // Subtle charcoal-ringed woofer + smooth gradient cone + silk-dome tweeter (clean modern look!)
    const wooferRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.044, 0.005, 10, 22),
      speakerRingMat
    );
    wooferRing.rotation.y = Math.PI / 2;
    wooferRing.position.set(-0.099, 0.102, 0);
    hiFiGroup.add(wooferRing);

    const wooferCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.041, 0.018, 0.014, 20),
      speakerConeMat
    );
    wooferCone.rotation.z = Math.PI / 2;
    wooferCone.position.set(-0.096, 0.102, 0);
    hiFiGroup.add(wooferCone);

    const tweeterRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.020, 0.0035, 8, 18),
      speakerRingMat
    );
    tweeterRing.rotation.y = Math.PI / 2;
    tweeterRing.position.set(-0.099, 0.205, 0);
    hiFiGroup.add(tweeterRing);

    const tweeterDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 14, 10),
      speakerConeMat
    );
    tweeterDome.scale.set(0.45, 1, 1);
    tweeterDome.position.set(-0.098, 0.205, 0);
    hiFiGroup.add(tweeterDome);

    tvConsole.add(hiFiGroup);
  }

  // Tabletop Small Ornaments on the TV Console (桌面小摆件: wooden block calendar, glass reed diffuser & mini figurines)
  const calBase = new THREE.Mesh(
    createBeveledBox(0.062, 0.028, 0.115, 0.004, 2),
    darkOakMat
  );
  calBase.position.set(-0.14, 0.634, -0.66);
  calBase.rotation.y = 0.18;
  tvConsole.add(calBase);
  for (const [czOff, colHex] of [
    [-0.024, 0xf7efe8],
    [0.024, 0xf2d6c8],
  ] as const) {
    const calBlock = new THREE.Mesh(
      createBeveledBox(0.044, 0.046, 0.044, 0.005, 2),
      mat({ color: colHex, roughness: 0.86 })
    );
    calBlock.position.set(-0.14, 0.668, -0.66 + czOff);
    calBlock.rotation.y = 0.18;
    tvConsole.add(calBlock);
  }

  // Reed diffuser bottle + wooden aroma sticks on the South end of the TV Console
  const diffuserBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.034, 0.088, 14),
    mat({ color: 0xe8dff0, roughness: 0.25, metalness: 0.05 })
  );
  diffuserBottle.position.set(-0.12, 0.664, 0.68);
  tvConsole.add(diffuserBottle);
  const diffuserCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.018, 12),
    handleBrassMat
  );
  diffuserCollar.position.set(-0.12, 0.714, 0.68);
  tvConsole.add(diffuserCollar);
  for (const [rx, rz] of [
    [-0.16, 0.12],
    [0.14, -0.14],
    [0.05, 0.18],
  ] as const) {
    const reedStick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0022, 0.0022, 0.19, 6),
      oakMat
    );
    reedStick.position.set(-0.12 + rz * 0.05, 0.76, 0.68 + rx * 0.05);
    reedStick.rotation.set(rx, 0, rz);
    tvConsole.add(reedStick);
  }

  // Pair of cute pastel bunny/cat desktop mini figurines beside the TV
  for (const [fz, fCol, fScale] of [
    [0.54, 0xf6c8d2, 1.0],
    [0.60, 0xc8dff5, 0.84],
  ] as const) {
    const figBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.026 * fScale, 12, 10),
      mat({ color: fCol, roughness: 0.78 })
    );
    figBody.scale.set(1, 1.18, 1);
    figBody.position.set(-0.15, 0.648 * fScale + (1 - fScale) * 0.62, fz);
    tvConsole.add(figBody);
    for (const earS of [-1, 1]) {
      const ear = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.006 * fScale, 0.018 * fScale, 4, 8),
        mat({ color: fCol, roughness: 0.78 })
      );
      ear.position.set(-0.15, 0.678 * fScale + (1 - fScale) * 0.62, fz + earS * 0.012 * fScale);
      ear.rotation.x = earS * 0.18;
      tvConsole.add(ear);
    }
  }

  group.add(tvConsole);
  addBoxCollider('col_tv_console', 6.76, 0.42, -5.08, 0.64, 0.84, 2.40);

  // =========================================================================
  // =========================================================================
  // 4. SLEEK MISIDE FLAT-SCREEN TV WITH WIDE CHAMFERED STAND & SMOOTH GRADIENT SCREEN
  // =========================================================================
  const tvGroup = new THREE.Group();
  tvGroup.position.set(6.78, 0.625, -5.08);
  const tvMat = tvCharcoalMat;
  const tvTrimMat = tvCharcoalTrimMat;

  // Wide modern beveled charcoal pedestal bar + single centered sculpted neck (matching Image 1!)
  const tvBase = new THREE.Mesh(
    createBeveledSlab(0.24, 0.020, 0.88, 0.030, 0.007),
    tvMat
  );
  tvBase.position.set(0.01, 0.010, 0);
  tvBase.castShadow = true;
  tvBase.receiveShadow = true;
  outlines.addOutline(tvBase, 1.018);
  tvGroup.add(tvBase);

  const tvNeck = new THREE.Mesh(
    createBeveledBox(0.056, 0.17, 0.16, 0.012, 2),
    tvMat
  );
  tvNeck.position.set(0.032, 0.095, 0);
  tvNeck.rotation.z = -0.10;
  tvNeck.castShadow = true;
  tvGroup.add(tvNeck);

  // Clean slim matte-charcoal TV chassis frame (1.76m wide x 1.00m tall)
  const tvFrame = new THREE.Mesh(
    createBeveledBox(0.034, 1.00, 1.76, 0.010, 3),
    tvMat
  );
  tvFrame.position.y = 0.665;
  tvFrame.castShadow = true;
  tvFrame.receiveShadow = true;
  outlines.addOutline(tvFrame, 1.014);
  tvGroup.add(tvFrame);

  // Subtle slim inner bezel surround framing the glass display
  for (const [by, bh] of [
    [1.156, 0.014],
    [0.176, 0.020],
  ] as const) {
    const hBezel = new THREE.Mesh(
      createBeveledBox(0.038, bh, 1.74, 0.004, 2),
      tvTrimMat
    );
    hBezel.position.set(-0.002, by, 0);
    tvGroup.add(hBezel);
  }
  for (const bz of [-0.866, 0.866]) {
    const vBezel = new THREE.Mesh(
      createBeveledBox(0.038, 0.98, 0.014, 0.004, 2),
      tvTrimMat
    );
    vBezel.position.set(-0.002, 0.668, bz);
    tvGroup.add(vBezel);
  }

  // Smooth tapered rear electronics housing
  const tvRear = new THREE.Mesh(
    createBeveledBox(0.032, 0.64, 1.22, 0.014, 2),
    tvMat
  );
  tvRear.position.set(0.024, 0.63, 0);
  tvGroup.add(tvRear);

  // Subtle tiny silver center emblem + standby indicator LED
  const tvBadge = new THREE.Mesh(
    createBeveledBox(0.005, 0.008, 0.042, 0.002, 1),
    tvTrimMat
  );
  tvBadge.position.set(-0.022, 0.174, 0);
  tvGroup.add(tvBadge);

  const tvStandbyLedMat = new THREE.MeshBasicMaterial({ color: 0xff5268 });
  const tvStandbyLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.0045, 8, 8),
    tvStandbyLedMat
  );
  tvStandbyLed.position.set(-0.022, 0.174, 0.78);
  tvStandbyLed.userData.dynamic = true;
  tvGroup.add(tvStandbyLed);

  // Live crisp 16:9 retro pixel-art CanvasTexture (512x288 HiDPI) for cozy comical auto-playing TV minigame
  const tvLiveCanvas = document.createElement('canvas');
  tvLiveCanvas.width = 512;
  tvLiveCanvas.height = 288;
  const tvLiveCtx = tvLiveCanvas.getContext('2d');
  if (tvLiveCtx) {
    tvLiveCtx.imageSmoothingEnabled = false;
  }
  const tvLiveTexture = new THREE.CanvasTexture(tvLiveCanvas);
  tvLiveTexture.colorSpace = THREE.SRGBColorSpace;
  tvLiveTexture.magFilter = THREE.LinearFilter;
  tvLiveTexture.minFilter = THREE.LinearFilter;
  tvLiveTexture.anisotropy = 4;
  tvLiveTexture.generateMipmaps = false;

  metaState.livingTv.isOn = false;
  metaState.livingTv.canvas = tvLiveCanvas;
  metaState.livingTv.ctx = tvLiveCtx;
  metaState.livingTv.texture = tvLiveTexture;
  metaState.livingTv.ledMat = tvStandbyLedMat;
  metaState.livingTv.time = 0;
  metaState.livingTv.accum = 0.1;
  metaState.livingTv.score = 1200;

  const tvScreenMat = new THREE.MeshStandardMaterial({
    map: tvStandbyGradTex,
    emissiveMap: tvStandbyGradTex,
    emissive: new THREE.Color(0xd8e4ff),
    emissiveIntensity: 0.24,
    roughness: 0.34,
    metalness: 0.12,
    envMapIntensity: 0.14,
  });
  metaState.tvScreenMat = tvScreenMat;
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.70, 0.945), tvScreenMat);
  tvScreen.rotation.y = -Math.PI / 2;
  tvScreen.position.set(-0.020, 0.668, 0);
  tvScreen.userData.dynamic = true;
  tvGroup.add(tvScreen);
  group.add(tvGroup);

  // American Hutch-Style Overhead Wall Shelf above TV (vertical beadboard back + crown molding + corbels)
  const wallShelf = new THREE.Group();
  wallShelf.position.set(7.06, 2.02, -5.08);
  // Single clean solid-wood hutch back panel (一整块平整背板，无多余竖条)
  const wsBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.30, 1.72),
    tvWoodDeepMat
  );
  wsBack.position.x = 0.114;
  wsBack.receiveShadow = true;
  wallShelf.add(wsBack);

  for (const sy of [-0.155, 0.155]) {
    const wsBoard = new THREE.Mesh(
      createBeveledBox(sy > 0 ? 0.28 : 0.26, 0.026, sy > 0 ? 1.80 : 1.76, 0.006, 2),
      tvWoodMat
    );
    wsBoard.position.y = sy;
    wsBoard.castShadow = true;
    wsBoard.receiveShadow = true;
    outlines.addOutline(wsBoard, 1.014);
    wallShelf.add(wsBoard);
  }
  // Stepped American Crown Molding Trim along Upper Shelf Cornice + Supporting Under-Corbels
  const wsCrownLip = new THREE.Mesh(
    createBeveledBox(0.295, 0.018, 1.83, 0.005, 2),
    tvWoodDeepMat
  );
  wsCrownLip.position.y = 0.162;
  wallShelf.add(wsCrownLip);

  for (const sz of [-0.865, 0.865]) {
    const wsSide = new THREE.Mesh(
      createBeveledBox(0.26, 0.30, 0.032, 0.006, 2),
      tvWoodMat
    );
    wsSide.position.z = sz;
    wsSide.castShadow = true;
    wallShelf.add(wsSide);

    // Sculpted American Corbel Bracket beneath each end of the wall shelf
    const corbelTop = new THREE.Mesh(
      createBeveledBox(0.19, 0.045, 0.036, 0.006, 2),
      tvWoodDeepMat
    );
    corbelTop.position.set(0.03, -0.190, sz);
    wallShelf.add(corbelTop);

    const corbelDrop = new THREE.Mesh(
      createBeveledBox(0.095, 0.085, 0.032, 0.006, 2),
      tvWoodMat
    );
    corbelDrop.position.set(0.075, -0.235, sz);
    wallShelf.add(corbelDrop);
  }
  // Matte pastel macaron fabric & paper organizer boxes with fitted lids on the floating shelf
  const shelfGreenBoxMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.007,
    color: 0x9ee8b4,
    roughness: 0.94,
    metalness: 0.0,
  });
  const shelfGreenBox = new THREE.Mesh(
    createBeveledBox(0.18, 0.10, 0.22, 0.006, 2),
    shelfGreenBoxMat
  );
  shelfGreenBox.position.set(-0.01, -0.090, 0.44);
  shelfGreenBox.castShadow = true;
  wallShelf.add(shelfGreenBox);
  const shelfGreenLid = new THREE.Mesh(
    createBeveledBox(0.188, 0.022, 0.228, 0.004, 2),
    shelfGreenBoxMat
  );
  shelfGreenLid.position.set(-0.01, -0.032, 0.44);
  wallShelf.add(shelfGreenLid);
  const shelfGreenLabel = new THREE.Mesh(
    createBeveledBox(0.006, 0.028, 0.058, 0.002, 1),
    pageMat
  );
  shelfGreenLabel.position.set(-0.101, -0.088, 0.44);
  wallShelf.add(shelfGreenLabel);

  const shelfWhiteBoxMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.007,
    color: 0xffd0df,
    roughness: 0.94,
    metalness: 0.0,
  });
  const shelfWhiteBox = new THREE.Mesh(
    createBeveledBox(0.17, 0.082, 0.20, 0.006, 2),
    shelfWhiteBoxMat
  );
  shelfWhiteBox.position.set(-0.01, 0.210, -0.52);
  shelfWhiteBox.castShadow = true;
  wallShelf.add(shelfWhiteBox);
  const shelfWhiteLid = new THREE.Mesh(
    createBeveledBox(0.178, 0.020, 0.208, 0.004, 2),
    tvWoodMat
  );
  shelfWhiteLid.position.set(-0.01, 0.258, -0.52);
  wallShelf.add(shelfWhiteLid);

  // Compact matte-black studio monitor speakers flanking books inside floating shelf (matching Image 1!)
  for (const spZ of [-0.72, 0.72]) {
    const spCab = new THREE.Mesh(
      createBeveledBox(0.16, 0.23, 0.145, 0.009, 2),
      speakerCabMat
    );
    spCab.position.set(-0.01, -0.026, spZ);
    spCab.castShadow = true;
    spCab.receiveShadow = true;
    outlines.addOutline(spCab, 1.02);
    wallShelf.add(spCab);

    const spWooferRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.004, 8, 18),
      speakerRingMat
    );
    spWooferRing.rotation.y = Math.PI / 2;
    spWooferRing.position.set(-0.092, -0.062, spZ);
    wallShelf.add(spWooferRing);

    const woofer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.016, 0.012, 16),
      speakerConeMat
    );
    woofer.rotation.z = Math.PI / 2;
    woofer.position.set(-0.089, -0.062, spZ);
    wallShelf.add(woofer);

    const spTweeterRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.017, 0.003, 8, 16),
      speakerRingMat
    );
    spTweeterRing.rotation.y = Math.PI / 2;
    spTweeterRing.position.set(-0.092, 0.024, spZ);
    wallShelf.add(spTweeterRing);

    const tweeter = new THREE.Mesh(
      new THREE.SphereGeometry(0.013, 12, 10),
      speakerConeMat
    );
    tweeter.scale.set(0.45, 1, 1);
    tweeter.position.set(-0.090, 0.024, spZ);
    wallShelf.add(tweeter);
  }
  // Sculpted light-toned books, matched manga mini-set, horizontal stack & retro game cartridge inside floating TV shelf
  populateRealisticBookTier({
    parent: wallShelf,
    axis: 'z',
    spineSign: -1,
    start: -0.58,
    end: -0.06,
    surfaceY: -0.142,
    depthCenter: -0.01,
    maxDepth: 0.175,
    maxHeight: 0.275,
    seed: 107,
    includeMangaSet: true,
    includeHorizontalStack: false,
    includeRetroGames: true,
  });
  populateRealisticBookTier({
    parent: wallShelf,
    axis: 'z',
    spineSign: -1,
    start: 0.04,
    end: 0.58,
    surfaceY: -0.142,
    depthCenter: -0.01,
    maxDepth: 0.175,
    maxHeight: 0.275,
    seed: 211,
    includeMangaSet: false,
    includeHorizontalStack: true,
    includeRetroGames: true,
  });
  group.add(wallShelf);

  registerInteractable('liv_tv', '客厅电视', '打开 / 关闭电视', 'living', tvGroup, () => {
    const nextOn = !metaState.livingTv.isOn;
    metaState.livingTv.isOn = nextOn;
    metaState.tvMetaOn = nextOn;
    const activeTex = nextOn && metaState.livingTv.texture ? metaState.livingTv.texture : tvStandbyGradTex;
    tvScreenMat.color.setHex(nextOn ? 0x101018 : 0xffffff);
    tvScreenMat.map = activeTex;
    tvScreenMat.emissiveMap = activeTex;
    tvScreenMat.emissive.setHex(nextOn ? 0xffffff : 0xd8e4ff);
    tvScreenMat.emissiveIntensity = nextOn ? 0.62 : 0.24;
    tvScreenMat.roughness = nextOn ? 0.42 : 0.34;
    tvScreenMat.envMapIntensity = nextOn ? 0.03 : 0.14;
    tvScreenMat.needsUpdate = true;
    if (metaState.livingTv.ledMat) {
      metaState.livingTv.ledMat.color.setHex(nextOn ? 0x52ff9a : 0xff5268);
    }
    if (nextOn) {
      // Trigger immediate frame paint on next tick
      metaState.livingTv.accum = 1.0;
    }
    return nextOn
      ? {
          title: '客厅电视 · 温馨像素频道',
          message: '电视自动播放起高饱和度的滑稽像素小游戏节目——圆滚滚的小像素人正一路蹦跳躲史莱姆、疯狂吃金币！',
        }
      : {
          title: '客厅电视',
          message: '关掉了电视，屏幕恢复为柔和安静的待机状态。',
        };
  });

  // =========================================================================
  // 5. AMERICAN HERITAGE BOOKCASE & 3-DRAWER CHEST (テレビ柜同款立体双色线脚与凸起斜边镶芯板)
  // =========================================================================
  // Sharp-Edged Flush American Recessed-Panel Drawer / Door Builder (平整内凹 + 齐平硬朗直框 + 多样复古拉手!)
  const buildTvStyleRaisedDrawer = (
    drwW: number,
    drwH: number,
    dualHandles: boolean,
    handleStyle: 'bail' | 'cup' | 'ring' | 'octKnob' = 'cup'
  ): THREE.Group => {
    const g = new THREE.Group();

    // 1) Crisp flat recessed center panel (平整内凹芯板)
    const recessBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, drwH - 0.004, drwW - 0.004),
      tvWoodDeepMat
    );
    recessBack.position.x = -0.004;
    recessBack.receiveShadow = true;
    g.add(recessBack);

    // 2) Flush sharp 90-degree outer Shaker rails & stiles (齐平硬朗直框，不再凸出发圆!)
    const railH = Math.min(0.028, drwH * 0.20);
    const stileW = Math.min(0.040, drwW * 0.12);
    for (const ry of [-(drwH - railH) * 0.5, (drwH - railH) * 0.5]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, railH, drwW),
        tvWoodMat
      );
      rail.position.set(0.001, ry, 0);
      rail.castShadow = true;
      rail.receiveShadow = true;
      g.add(rail);
    }
    for (const sz of [-(drwW - stileW) * 0.5, (drwW - stileW) * 0.5]) {
      const stile = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, drwH, stileW),
        tvWoodMat
      );
      stile.position.set(0.001, 0, sz);
      stile.castShadow = true;
      stile.receiveShadow = true;
      g.add(stile);
    }

    // 3) Slim crisp inner step shadow bead (8mm recessed sharp inner molding)
    const innerW = drwW - stileW * 2;
    const innerH = drwH - railH * 2;
    if (innerW > 0.05 && innerH > 0.03) {
      for (const ry of [-(innerH * 0.5 - 0.004), innerH * 0.5 - 0.004]) {
        const innerStep = new THREE.Mesh(
          new THREE.BoxGeometry(0.014, 0.008, innerW + 0.002),
          tvWoodDeepMat
        );
        innerStep.position.set(-0.001, ry, 0);
        g.add(innerStep);
      }
      for (const sz of [-(innerW * 0.5 - 0.004), innerW * 0.5 - 0.004]) {
        const innerStep = new THREE.Mesh(
          new THREE.BoxGeometry(0.014, innerH + 0.002, 0.008),
          tvWoodDeepMat
        );
        innerStep.position.set(-0.001, 0, sz);
        g.add(innerStep);
      }
    }

    // 4) Distinct American Hardware Handle(s) mounted cleanly on the recessed face
    const handleZs = dualHandles ? [-drwW * 0.25, drwW * 0.25] : [0];
    for (const hz of handleZs) {
      const hObj = createAmericanHandle(handleStyle, 1);
      hObj.position.set(0.002, 0, hz);
      g.add(hObj);
    }

    return g;
  };

  const shelf = new THREE.Group();
  shelf.position.set(-0.98, 0, -1.25);

  // 1) Crisp Sharp-Edged 3-Step American Crown Top (硬朗直角阶梯顶冠，无圆角凸出!)
  const bcTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.030, 1.02),
    tvWoodMat
  );
  bcTop.position.set(0.014, 1.635, 0);
  bcTop.castShadow = true;
  bcTop.receiveShadow = true;
  shelf.add(bcTop);

  const bcCrownCove = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.020, 0.98),
    tvWoodDeepMat
  );
  bcCrownCove.position.set(0.010, 1.610, 0);
  shelf.add(bcCrownCove);

  const bcFrieze = new THREE.Mesh(
    new THREE.BoxGeometry(0.33, 0.014, 0.94),
    tvWoodMat
  );
  bcFrieze.position.set(0.006, 1.593, 0);
  shelf.add(bcFrieze);

  // 2) Crisp Flat Open Shelf Tiers
  for (const sy of [1.26, 0.91, 0.56]) {
    const bcTier = new THREE.Mesh(
      new THREE.BoxGeometry(0.295, 0.026, 0.88),
      tvWoodMat
    );
    bcTier.position.y = sy;
    bcTier.castShadow = true;
    bcTier.receiveShadow = true;
    shelf.add(bcTier);
  }

  // 3) Crisp Sharp-Edged Baseboard Plinth + Straight Tapered Feet
  const bcBot = new THREE.Mesh(
    new THREE.BoxGeometry(0.365, 0.028, 0.99),
    tvWoodMat
  );
  bcBot.position.set(0.010, 0.088, 0);
  bcBot.castShadow = true;
  bcBot.receiveShadow = true;
  shelf.add(bcBot);

  const bcPlinthSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.335, 0.020, 0.94),
    tvWoodDeepMat
  );
  bcPlinthSkirt.position.set(0.006, 0.064, 0);
  shelf.add(bcPlinthSkirt);

  for (const fx of [-0.11, 0.13]) {
    for (const fz of [-0.42, 0.42]) {
      const bFoot = new THREE.Mesh(
        new THREE.BoxGeometry(0.070, 0.060, 0.095),
        tvWoodDeepMat
      );
      bFoot.position.set(fx, 0.030, fz);
      bFoot.castShadow = true;
      shelf.add(bFoot);
    }
  }

  // 4) Flush Crisp Side Walls with Recessed Side Frame (齐平直框，不再突出圆柱!)
  for (const sz of [-0.44, 0.44]) {
    const sidePanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 1.48, 0.038),
      tvWoodMat
    );
    sidePanel.position.set(0, 0.845, sz);
    sidePanel.castShadow = true;
    sidePanel.receiveShadow = true;
    shelf.add(sidePanel);

    const sideInset = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 1.28, 0.010),
      tvWoodDeepMat
    );
    sideInset.position.set(0, 0.845, sz + (sz < 0 ? -0.016 : 0.016));
    shelf.add(sideInset);
  }

  // 5) Single Clean Solid-Wood Backing Panel (一整块平整背板)
  const bcBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.020, 1.48, 0.86),
    tvWoodDeepMat
  );
  bcBack.position.set(-0.142, 0.845, 0);
  bcBack.receiveShadow = true;
  shelf.add(bcBack);

  // Two cozy linen storage boxes paired with generous open book zones on the upper bookcase tiers
  for (const [ty, tz, tw, th, col] of [
    [0.925, 0.28, 0.22, 0.155, 0xf4eee6],
    [1.275, -0.28, 0.22, 0.155, 0x8fb883],
  ] as const) {
    const boxFabricMat = mat({
      map: textures.plushFabric,
      bumpMap: textures.plushBump,
      bumpScale: 0.008,
      color: col,
      roughness: 0.92,
    });
    const box = new THREE.Mesh(
      createBeveledBox(0.20, th - 0.02, tw, 0.006, 2),
      boxFabricMat
    );
    box.position.set(0.01, ty + (th - 0.02) / 2, tz);
    box.castShadow = true;
    box.receiveShadow = true;
    shelf.add(box);

    // Fitted overhanging box lid
    const boxLid = new THREE.Mesh(
      createBeveledBox(0.208, 0.024, tw + 0.008, 0.004, 2),
      boxFabricMat
    );
    boxLid.position.set(0.01, ty + th - 0.01, tz);
    boxLid.castShadow = true;
    shelf.add(boxLid);

    // Front geometric label plate + brass pull grommet
    const labelPlate = new THREE.Mesh(
      createBeveledBox(0.006, 0.036, 0.068, 0.002, 1),
      pageMat
    );
    labelPlate.position.set(0.111, ty + th * 0.46, tz);
    shelf.add(labelPlate);

    const grommet = new THREE.Mesh(
      new THREE.TorusGeometry(0.009, 0.0025, 6, 14),
      handleBrassMat
    );
    grommet.rotation.y = Math.PI / 2;
    grommet.position.set(0.113, ty + th * 0.24, tz);
    shelf.add(grommet);
  }

  // Crisp Sharp-Edged American 3-Drawer Chest with Half-Moon Shell Cup Pulls (齐平硬朗直框 + 贝壳杯形拉手!)
  const chestGroup = new THREE.Group();
  chestGroup.position.set(-0.92, 0, -2.52);

  const chestBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.72, 0.74),
    tvWoodDeepMat
  );
  chestBody.position.y = 0.455;
  chestBody.castShadow = true;
  chestBody.receiveShadow = true;
  chestGroup.add(chestBody);

  // Crisp Sharp-Edged 3-Step Top Crown (硬朗直角阶梯顶线，不发圆)
  const chestTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.49, 0.030, 0.86),
    tvWoodMat
  );
  chestTop.position.set(0.010, 0.862, 0);
  chestTop.castShadow = true;
  chestTop.receiveShadow = true;
  chestGroup.add(chestTop);

  const chestUnderCrown = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.020, 0.825),
    tvWoodDeepMat
  );
  chestUnderCrown.position.set(0.006, 0.837, 0);
  chestGroup.add(chestUnderCrown);

  const chestFrieze = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.014, 0.80),
    tvWoodMat
  );
  chestFrieze.position.set(0.004, 0.820, 0);
  chestGroup.add(chestFrieze);

  // Crisp Base Plinth + Straight Tapered Feet
  const chestBot = new THREE.Mesh(
    new THREE.BoxGeometry(0.475, 0.028, 0.845),
    tvWoodMat
  );
  chestBot.position.set(0.008, 0.084, 0);
  chestBot.castShadow = true;
  chestBot.receiveShadow = true;
  chestGroup.add(chestBot);

  const chestPlinthSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.445, 0.020, 0.805),
    tvWoodDeepMat
  );
  chestPlinthSkirt.position.set(0.004, 0.060, 0);
  chestGroup.add(chestPlinthSkirt);

  for (const fx of [-0.17, 0.19]) {
    for (const fz of [-0.35, 0.35]) {
      const bFoot = new THREE.Mesh(
        new THREE.BoxGeometry(0.072, 0.060, 0.095),
        tvWoodDeepMat
      );
      bFoot.position.set(fx, 0.030, fz);
      bFoot.castShadow = true;
      chestGroup.add(bFoot);
    }
  }

  // Flush Crisp Side Walls (齐平直框，不再突出圆边柱!)
  for (const sz of [-0.38, 0.38]) {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.72, 0.038),
      tvWoodMat
    );
    sideWall.position.set(0, 0.455, sz);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    chestGroup.add(sideWall);

    const sideInset = new THREE.Mesh(
      new THREE.BoxGeometry(0.31, 0.56, 0.010),
      tvWoodDeepMat
    );
    sideInset.position.set(0, 0.455, sz + (sz < 0 ? -0.016 : 0.016));
    chestGroup.add(sideInset);
  }

  // Flush horizontal divider rails + 3 Flat-Recessed Drawers with Vintage Shell Cup Pulls ('cup')
  for (const ry of [0.336, 0.574]) {
    const divRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.020, 0.72),
      tvWoodMat
    );
    divRail.position.set(0.213, ry, 0);
    chestGroup.add(divRail);
  }
  for (const dy of [0.218, 0.455, 0.692]) {
    const drw = buildTvStyleRaisedDrawer(0.69, 0.208, true, 'cup');
    drw.position.set(0.214, dy, 0);
    chestGroup.add(drw);
  }
  // White & oak 2-drawer stacked desktop organizer box on top of the chest (Screenshot 1: two stacked drawers!)
  const topOrgShell = new THREE.Mesh(
    createBeveledBox(0.26, 0.20, 0.44, 0.008, 2),
    oakMat
  );
  topOrgShell.position.set(-0.02, 0.97, 0.06);
  topOrgShell.castShadow = true;
  outlines.addOutline(topOrgShell, 1.025);
  chestGroup.add(topOrgShell);
  for (const oy of [0.92, 1.02]) {
    const miniDrw = new THREE.Mesh(
      createBeveledBox(0.018, 0.084, 0.40, 0.004, 2),
      ceramicMat
    );
    miniDrw.position.set(0.112, oy, 0.06);
    chestGroup.add(miniDrw);
    const notch = new THREE.Mesh(
      createBeveledBox(0.020, 0.012, 0.06, 0.002, 1),
      cavityDarkMat
    );
    notch.position.set(0.114, oy + 0.032, 0.06);
    chestGroup.add(notch);
  }
  // Framed blue-haired anime illustration standing on top of the 2-drawer organizer
  const orgFrame = new THREE.Mesh(
    createBeveledBox(0.026, 0.21, 0.165, 0.005, 2),
    oakMat
  );
  orgFrame.position.set(-0.02, 1.17, 0.06);
  orgFrame.rotation.z = 0.12;
  orgFrame.castShadow = true;
  outlines.addOutline(orgFrame, 1.04);
  chestGroup.add(orgFrame);
  const orgPic = new THREE.Mesh(
    new THREE.PlaneGeometry(0.125, 0.165),
    mat({ map: textures.sofaArtworks[2], color: 0xf7f2ed, roughness: 0.90, celStrength: 0.34 })
  );
  orgPic.rotation.y = Math.PI / 2;
  orgPic.position.set(-0.005, 1.17, 0.06);
  chestGroup.add(orgPic);

  // Floating Wooden Wall Shelf above the 3-Drawer Chest with Framed Art & White Potted Plant
  const chestWallShelf = new THREE.Group();
  chestWallShelf.position.set(-1.02, 1.72, -2.52);
  const cwsBoard = new THREE.Mesh(
    createBeveledSlab(0.24, 0.028, 0.86, 0.02, 0.006),
    oakMat
  );
  cwsBoard.castShadow = true;
  cwsBoard.receiveShadow = true;
  outlines.addOutline(cwsBoard, 1.02);
  chestWallShelf.add(cwsBoard);

  const cwsArtFrame = new THREE.Mesh(
    createBeveledBox(0.028, 0.25, 0.20, 0.006, 2),
    oakMat
  );
  cwsArtFrame.position.set(-0.01, 0.136, 0.18);
  cwsArtFrame.rotation.z = 0.14;
  cwsArtFrame.castShadow = true;
  outlines.addOutline(cwsArtFrame, 1.035);
  chestWallShelf.add(cwsArtFrame);
  const cwsArtCanvas = new THREE.Mesh(
    new THREE.PlaneGeometry(0.15, 0.20),
    mat({ map: textures.sofaArtworks[1], color: 0xf7f2ed, roughness: 0.90, celStrength: 0.34 })
  );
  cwsArtCanvas.rotation.y = Math.PI / 2;
  cwsArtCanvas.position.set(0.006, 0.136, 0.18);
  chestWallShelf.add(cwsArtCanvas);

  // Small white ceramic potted green plant on the floating wall shelf (with dark potting soil & veined leaves)
  const cwsPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.042, 0.095, 14),
    ceramicMat
  );
  cwsPot.position.set(0.01, 0.062, -0.20);
  cwsPot.castShadow = true;
  outlines.addOutline(cwsPot, 1.04);
  chestWallShelf.add(cwsPot);
  const cwsSoil = new THREE.Mesh(
    new THREE.SphereGeometry(0.050, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
    pottingSoilMat
  );
  cwsSoil.scale.set(1, 0.34, 1);
  cwsSoil.position.set(0.01, 0.104, -0.20);
  chestWallShelf.add(cwsSoil);
  for (let lf = 0; lf < 6; lf++) {
    const ang = (lf / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(
      createPlushBox(0.045, 0.018, 0.095, 0.008, 0.18),
      lf % 2 === 0 ? plantLeafLightMat : plantLeafMat
    );
    leaf.position.set(0.01 + Math.cos(ang) * 0.042, 0.125, -0.20 + Math.sin(ang) * 0.042);
    leaf.rotation.set(0.42, -ang + Math.PI / 2, 0);
    leaf.castShadow = true;
    chestWallShelf.add(leaf);
  }
  group.add(chestWallShelf);

  // Small Square Wooden Stool + Woven Rattan Storage Basket + White Potted Plant between Bookcase & Chest (Screenshot 1!)
  const rattanStoolGroup = new THREE.Group();
  rattanStoolGroup.position.set(-0.95, 0, -1.90);
  const rsTop = new THREE.Mesh(
    createBeveledSlab(0.32, 0.024, 0.32, 0.024, 0.006),
    oakMat
  );
  rsTop.position.y = 0.28;
  rsTop.castShadow = true;
  outlines.addOutline(rsTop, 1.025);
  rattanStoolGroup.add(rsTop);
  for (const [lx, lz] of [
    [-0.11, -0.11],
    [0.11, -0.11],
    [-0.11, 0.11],
    [0.11, 0.11],
  ] as const) {
    const leg = new THREE.Mesh(
      createBeveledBox(0.024, 0.27, 0.024, 0.004, 1),
      oakMat
    );
    leg.position.set(lx, 0.135, lz);
    leg.rotation.set(lz < 0 ? 0.08 : -0.08, 0, lx < 0 ? -0.08 : 0.08);
    rattanStoolGroup.add(leg);
  }
  // Woven Rattan Storage Basket with Lid & Dark Leather Clasp on the Stool (Screenshot 1)
  const rattanMat = mat({
    map: textures.rugWeave,
    bumpMap: textures.rugBump,
    bumpScale: 0.012,
    color: 0xd99e66,
    roughness: 0.82,
  });
  const rattanBasket = new THREE.Mesh(
    createBeveledBox(0.26, 0.18, 0.28, 0.012, 2),
    rattanMat
  );
  rattanBasket.position.y = 0.382;
  rattanBasket.castShadow = true;
  outlines.addOutline(rattanBasket, 1.03);
  rattanStoolGroup.add(rattanBasket);
  const rattanClasp = new THREE.Mesh(
    createBeveledBox(0.014, 0.042, 0.028, 0.003, 1),
    cavityDarkMat
  );
  rattanClasp.position.set(0.132, 0.42, 0);
  rattanStoolGroup.add(rattanClasp);

  // White Ceramic Pot + Lush Green Houseplant perched on top of the Rattan Basket (with granular soil & veined leaves)
  const basketPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054, 0.040, 0.088, 14),
    ceramicMat
  );
  basketPot.position.y = 0.516;
  basketPot.castShadow = true;
  outlines.addOutline(basketPot, 1.04);
  rattanStoolGroup.add(basketPot);
  const basketSoil = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48),
    pottingSoilMat
  );
  basketSoil.scale.set(1, 0.34, 1);
  basketSoil.position.set(0, 0.556, 0);
  rattanStoolGroup.add(basketSoil);
  for (let lf = 0; lf < 7; lf++) {
    const ang = (lf / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(
      createPlushBox(0.044, 0.016, 0.092, 0.007, 0.18),
      lf % 2 === 0 ? plantLeafLightMat : plantLeafMat
    );
    leaf.position.set(Math.cos(ang) * 0.04, 0.575, Math.sin(ang) * 0.04);
    leaf.rotation.set(0.38, -ang + Math.PI / 2, 0);
    leaf.castShadow = true;
    rattanStoolGroup.add(leaf);
  }
  group.add(rattanStoolGroup);

  group.add(chestGroup);
  addBoxCollider('col_liv_chest', -0.92, 0.48, -2.52, 0.46, 0.96, 0.84);

  // =========================================================================
  // 5B. CLASSIC AMERICAN SIDEBOARD CABINET (硬朗齐平直框 + 复古弧形吊环/圆环/八角铜钮 + 透明冷灰玻璃展示内腔!)
  // =========================================================================
  const bedSideDresser = new THREE.Group();
  bedSideDresser.position.set(-0.84, 0, -5.55);

  // Single clean solid-wood back panel + left/right closed compartments + HOLLOW CENTER DISPLAY CAVITY!
  const bsdBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.020, 0.74, 1.54),
    tvWoodDeepMat
  );
  bsdBack.position.set(-0.215, 0.48, 0);
  bsdBack.receiveShadow = true;
  bedSideDresser.add(bsdBack);

  // Top drawer deck (seals drawer bay above the open glass display cavity)
  const bsdTopDeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.16, 1.50),
    tvWoodDeepMat
  );
  bsdTopDeck.position.set(0.0, 0.768, 0);
  bedSideDresser.add(bsdTopDeck);

  // Left & Right closed cabinet interior dividers + Center Display Interior Shelf & Tableware
  for (const divZ of [-0.365, 0.365]) {
    const innerDiv = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.55, 0.022), tvWoodMat);
    innerDiv.position.set(0, 0.405, divZ);
    bedSideDresser.add(innerDiv);
  }
  const bsdFloor = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.020, 1.50), tvWoodDeepMat);
  bsdFloor.position.set(0, 0.142, 0);
  bedSideDresser.add(bsdFloor);

  // Interior warm-wood display shelf visible through the transparent cool-gray glass doors!
  const bsdDisplayShelf = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.018, 0.71), tvWoodMat);
  bsdDisplayShelf.position.set(-0.01, 0.405, 0);
  bsdDisplayShelf.receiveShadow = true;
  bedSideDresser.add(bsdDisplayShelf);

  // Stacked cream-ceramic bowls & plates displayed neatly inside the glass cabinet (like reference photos!)
  const dispCeramicMat = mat({ color: 0xf4efe6, roughness: 0.36, metalness: 0.02 });
  const dispSageBowlMat = mat({ color: 0x8ea886, roughness: 0.38, metalness: 0.02 });
  for (let p = 0; p < 4; p++) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.068, 0.016, 16), dispCeramicMat);
    plate.position.set(0.02, 0.162 + p * 0.018, 0.16);
    bedSideDresser.add(plate);
  }
  const lowerBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.044, 0.068, 16), dispSageBowlMat);
  lowerBowl.position.set(0.01, 0.188, -0.15);
  bedSideDresser.add(lowerBowl);
  for (let b = 0; b < 3; b++) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.036, 0.042, 16), dispCeramicMat);
    bowl.position.set(0.01, 0.434 + b * 0.028, -0.16);
    bedSideDresser.add(bowl);
  }
  const carafe = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.046, 0.14, 14), dispCeramicMat);
  carafe.position.set(0.0, 0.484, 0.14);
  bedSideDresser.add(carafe);

  // Crisp Sharp-Edged 3-Step American Crown Top (无圆角/无厚描边!)
  const bsdTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.030, 1.64),
    tvWoodMat
  );
  bsdTop.position.set(0.012, 0.895, 0);
  bsdTop.castShadow = true;
  bsdTop.receiveShadow = true;
  bedSideDresser.add(bsdTop);

  const bsdUnderCrown = new THREE.Mesh(
    new THREE.BoxGeometry(0.49, 0.018, 1.60),
    tvWoodDeepMat
  );
  bsdUnderCrown.position.set(0.008, 0.871, 0);
  bedSideDresser.add(bsdUnderCrown);

  const bsdFrieze = new THREE.Mesh(
    new THREE.BoxGeometry(0.47, 0.014, 1.57),
    tvWoodMat
  );
  bsdFrieze.position.set(0.005, 0.855, 0);
  bedSideDresser.add(bsdFrieze);

  // Crisp Stepped American Base Plinth + Tapered Feet
  const bsdBot = new THREE.Mesh(
    new THREE.BoxGeometry(0.51, 0.026, 1.62),
    tvWoodMat
  );
  bsdBot.position.set(0.008, 0.118, 0);
  bsdBot.castShadow = true;
  bsdBot.receiveShadow = true;
  bedSideDresser.add(bsdBot);

  const bsdPlinthSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.020, 1.58),
    tvWoodDeepMat
  );
  bsdPlinthSkirt.position.set(0.005, 0.095, 0);
  bedSideDresser.add(bsdPlinthSkirt);

  const bsdBunGeo = createTurnedLegGeometry(0.030, 0.016, 0.090);
  for (const fx of [-0.19, 0.21]) {
    for (const fz of [-0.73, 0.73]) {
      const bFoot = new THREE.Mesh(bsdBunGeo, tvWoodDeepMat);
      bFoot.position.set(fx, 0.045, fz);
      bFoot.castShadow = true;
      bedSideDresser.add(bFoot);
    }
  }

  // Clean Flush Side Panels with Crisp Recessed Side Frame
  for (const sz of [-0.76, 0.76]) {
    const sideWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.73, 0.036),
      tvWoodMat
    );
    sideWall.position.set(0, 0.485, sz);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    bedSideDresser.add(sideWall);

    const sideInset = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.56, 0.010),
      tvWoodDeepMat
    );
    sideInset.position.set(0, 0.485, sz + (sz < 0 ? -0.015 : 0.015));
    bedSideDresser.add(sideInset);
  }

  // Flush Horizontal Divider Rail & Vertical Stiles (齐平直框!)
  const midRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.020, 1.49),
    tvWoodMat
  );
  midRail.position.set(0.228, 0.682, 0);
  bedSideDresser.add(midRail);

  for (const vz of [-0.74, -0.37, 0.37, 0.74]) {
    const vStile = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.72, 0.032),
      tvWoodMat
    );
    vStile.position.set(0.228, 0.485, vz);
    bedSideDresser.add(vStile);
  }

  // TOP ROW: 3 Flush Recessed-Panel Drawers with Vintage Curved Bail Drop-Pulls ('bail', matching photo 2!)
  const leftTopDrw = buildTvStyleRaisedDrawer(0.325, 0.145, false, 'bail');
  leftTopDrw.position.set(0.230, 0.768, -0.555);
  bedSideDresser.add(leftTopDrw);

  const centerTopDrw = buildTvStyleRaisedDrawer(0.695, 0.145, true, 'bail');
  centerTopDrw.position.set(0.230, 0.768, 0);
  bedSideDresser.add(centerTopDrw);

  const rightTopDrw = buildTvStyleRaisedDrawer(0.325, 0.145, false, 'bail');
  rightTopDrw.position.set(0.230, 0.768, 0.555);
  bedSideDresser.add(rightTopDrw);

  // LOWER ROW: Left & Right Solid Flush-Framed Doors with Vintage Drop-Ring Pulls ('ring')
  for (const [dz, knobSide] of [
    [-0.555, 1],
    [0.555, -1],
  ] as const) {
    const sideDoor = buildTvStyleRaisedDrawer(0.325, 0.525, false, 'ring');
    sideDoor.position.set(0.230, 0.402, dz);
    // Position drop-ring pull on the inner opening stile edge
    const ringHandle = sideDoor.children[sideDoor.children.length - 1];
    ringHandle.position.set(0.008, 0.015, knobSide * 0.125);
    bedSideDresser.add(sideDoor);
  }

  // Center Twin Display Doors with TRANSPARENT COOL-GRAY GLASS (透明冷灰色玻璃) + Octagonal Bronze Knobs ('octKnob')!
  const cabGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x708090,
    roughness: 0.06,
    metalness: 0.14,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  for (const [dz, knobSide] of [
    [-0.175, 1],
    [0.175, -1],
  ] as const) {
    const gDoor = new THREE.Group();
    gDoor.position.set(0.230, 0.402, dz);
    const dw = 0.335;
    const dh = 0.525;
    const fW = 0.038;
    // Flush crisp wooden frame rails & stiles
    for (const ry of [-(dh - fW) * 0.5, (dh - fW) * 0.5]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.018, fW, dw), tvWoodMat);
      r.position.set(0.001, ry, 0);
      r.castShadow = true;
      gDoor.add(r);
    }
    for (const sz of [-(dw - fW) * 0.5, (dw - fW) * 0.5]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.018, dh, fW), tvWoodMat);
      st.position.set(0.001, 0, sz);
      st.castShadow = true;
      gDoor.add(st);
    }
    // Transparent cool-gray glass pane + crisp 2×3 wooden muntin grid
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.005, dh - fW * 1.8, dw - fW * 1.8), cabGlassMat);
    pane.position.set(0.000, 0, 0);
    gDoor.add(pane);

    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.010, dh - fW * 1.8, 0.011), tvWoodMat);
    vBar.position.set(0.003, 0, 0);
    gDoor.add(vBar);
    for (const hy of [-0.075, 0.075]) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.011, dw - fW * 1.8), tvWoodMat);
      hBar.position.set(0.003, hy, 0);
      gDoor.add(hBar);
    }
    // Faceted antique-bronze octagonal knob on inner meeting stile
    const gKnob = createAmericanHandle('octKnob', 1);
    gKnob.position.set(0.009, 0.010, knobSide * 0.145);
    gDoor.add(gKnob);

    bedSideDresser.add(gDoor);
  }

  // Cheerful color-accent tabletop decor on the 4-drawer long dresser (ceramic tray, scented candle & pastel figurine)
  const bsdTray = new THREE.Mesh(
    createBeveledSlab(0.24, 0.018, 0.34, 0.036, 0.006),
    mat({ color: 0xffe4b8, roughness: 0.42, metalness: 0.02 })
  );
  bsdTray.position.set(0.02, 0.925, -0.44);
  bsdTray.castShadow = true;
  bedSideDresser.add(bsdTray);

  const bsdCandleJar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.040, 0.095, 16),
    mat({ color: 0xff9284, roughness: 0.38, metalness: 0.02 })
  );
  bsdCandleJar.position.set(0.01, 0.980, -0.48);
  bsdCandleJar.castShadow = true;
  bedSideDresser.add(bsdCandleJar);

  const bsdWax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.012, 14),
    mat({ color: 0xfff7e6, roughness: 0.62 })
  );
  bsdWax.position.set(0.01, 1.026, -0.48);
  bedSideDresser.add(bsdWax);

  const bsdMintBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.038, 0.12, 14),
    mat({ color: 0x8de0b8, roughness: 0.32, metalness: 0.04 })
  );
  bsdMintBottle.position.set(0.03, 0.992, -0.36);
  bsdMintBottle.castShadow = true;
  bedSideDresser.add(bsdMintBottle);

  const bsdStackBook1 = new THREE.Mesh(
    createBookGeometry(0.20, 0.028, 0.27, 2),
    bookAtlasMat
  );
  bsdStackBook1.position.set(0.0, 0.930, 0.44);
  bsdStackBook1.rotation.y = 0.12;
  bsdStackBook1.castShadow = true;
  bedSideDresser.add(bsdStackBook1);

  const bsdStackBook2 = new THREE.Mesh(
    createBookGeometry(0.18, 0.024, 0.24, 4),
    bookAtlasMat
  );
  bsdStackBook2.position.set(0.01, 0.956, 0.43);
  bsdStackBook2.rotation.y = -0.18;
  bsdStackBook2.castShadow = true;
  bedSideDresser.add(bsdStackBook2);

  group.add(bedSideDresser);
  addBoxCollider('col_liv_bed_dresser', -0.84, 0.46, -5.55, 0.54, 0.94, 1.64);

  // =========================================================================
  // 5C. HANDCRAFTED WOVEN PINE-BOUGH CHRISTMAS WREATH ABOVE DRESSER
  //     - Hidden thin woody grapevine core + 66 true 3-wing 3D anime conifer boughs (ZERO green donut!)
  //     - Fibonacci open-scale woody pinecones (26 individual scales each, ZERO bun cones!)
  //     - Structured 4-loop folded crimson velvet ribbon bow + V-notched swallowtail tails
  //       with custom woven velvet nap & selvedge stitch texture!
  // =========================================================================
  const wreathGroup = new THREE.Group();
  wreathGroup.position.set(-1.105, 1.80, -5.55); // Flush on West wall above dresser, facing +X

  const wreathTwigBarkMat = mat({ color: 0x462b1b, roughness: 0.90, metalness: 0.0 });
  const pineconeScaleBaseMat = mat({ color: 0x5c361e, roughness: 0.84, metalness: 0.0, celStrength: 0.52 });
  const pineconeScaleTipMat = mat({ color: 0x9b6b45, roughness: 0.78, metalness: 0.0, celStrength: 0.48 });
  const cinnamonMat = mat({ color: 0x8c4d2b, roughness: 0.82, metalness: 0.0 });
  const twineMat = mat({ color: 0xe4d2b0, roughness: 0.92, metalness: 0.0 });
  const wreathHollyLeafMat = mat({
    map: textures.plantLeaf,
    bumpMap: textures.plantLeafBump,
    bumpScale: 0.015,
    color: 0x266236,
    roughness: 0.36,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const wreathBerryMat = mat({
    color: 0xd91c28,
    roughness: 0.18,
    metalness: 0.04,
  });
  const lemonPeelMat = mat({ color: 0xe6b42e, roughness: 0.62, metalness: 0.0 });
  const lemonPithMat = mat({ color: 0xfaf0d2, roughness: 0.78, metalness: 0.0 });
  const lemonPulpMat = mat({ color: 0xf4c842, roughness: 0.42, metalness: 0.02 });

  // Custom Woven Crimson Velvet Ribbon Texture + Micro-Twill Nap Bump (真实丝绒布料织纹与锁边压线)
  const velvetRibbonTextures = (() => {
    const W = 256;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const vctx = c.getContext('2d')!;
    const bc = document.createElement('canvas');
    bc.width = W;
    bc.height = H;
    const bctx = bc.getContext('2d')!;

    // Rich directional silk-velvet pile sheen across ribbon length & width
    const sheen = vctx.createLinearGradient(0, 0, 0, H);
    sheen.addColorStop(0.0, '#780d1b');
    sheen.addColorStop(0.26, '#be1d32');
    sheen.addColorStop(0.50, '#dc2b42');
    sheen.addColorStop(0.76, '#a91629');
    sheen.addColorStop(1.0, '#6e0b18');
    vctx.fillStyle = sheen;
    vctx.fillRect(0, 0, W, H);

    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, W, H);

    // Fine woven velvet warp/weft fabric threads & short brushed pile nap
    for (let y = 0; y < H; y += 2) {
      vctx.fillStyle = y % 4 === 0 ? 'rgba(255, 195, 205, 0.075)' : 'rgba(42, 4, 10, 0.085)';
      vctx.fillRect(0, y, W, 1);
      bctx.fillStyle = y % 4 === 0 ? 'rgba(205, 205, 205, 0.24)' : 'rgba(55, 55, 55, 0.24)';
      bctx.fillRect(0, y, W, 1);
    }
    for (let x = 0; x < W; x += 3) {
      vctx.fillStyle = x % 6 === 0 ? 'rgba(255, 210, 218, 0.055)' : 'rgba(48, 5, 12, 0.065)';
      vctx.fillRect(x, 0, 1.5, H);
      bctx.fillStyle = x % 6 === 0 ? 'rgba(218, 218, 218, 0.22)' : 'rgba(52, 52, 52, 0.22)';
      bctx.fillRect(x, 0, 1.5, H);
    }

    // Crisp tailored satin-velvet selvedge edge welting + fine gold-crimson running stitch along both ribbon borders!
    for (const edgeX of [10, W - 10]) {
      vctx.fillStyle = 'rgba(248, 178, 186, 0.28)';
      vctx.fillRect(edgeX - 4, 0, 8, H);
      bctx.fillStyle = 'rgba(232, 232, 232, 0.55)';
      bctx.fillRect(edgeX - 3, 0, 6, H);

      vctx.save();
      vctx.strokeStyle = 'rgba(246, 206, 146, 0.62)';
      vctx.lineWidth = 1.8;
      vctx.setLineDash([6, 4]);
      vctx.beginPath();
      vctx.moveTo(edgeX, 0);
      vctx.lineTo(edgeX, H);
      vctx.stroke();
      vctx.restore();
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.ClampToEdgeWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;

    const bumpMap = new THREE.CanvasTexture(bc);
    bumpMap.wrapS = THREE.ClampToEdgeWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.anisotropy = 4;

    return { map, bumpMap };
  })();

  const redVelvetBowMat = mat({
    map: velvetRibbonTextures.map,
    bumpMap: velvetRibbonTextures.bumpMap,
    bumpScale: 0.014,
    color: 0xffffff,
    roughness: 0.74,
    metalness: 0.02,
    rimScale: 1.32,
    celStrength: 0.46,
    side: THREE.DoubleSide,
  });
  const redVelvetDeepMat = mat({
    map: velvetRibbonTextures.map,
    bumpMap: velvetRibbonTextures.bumpMap,
    bumpScale: 0.014,
    color: 0xd9b8be,
    roughness: 0.80,
    metalness: 0.0,
    rimScale: 1.15,
    celStrength: 0.48,
    side: THREE.DoubleSide,
  });

  // Subtle brass wall nail behind top of wreath
  const wreathHook = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.026, 8),
    handleBrassMat
  );
  wreathHook.rotation.z = Math.PI / 2;
  wreathHook.position.set(0.01, 0.34, 0);
  wreathGroup.add(wreathHook);

  // Slim hidden dark-brown grapevine twig ring (compact radius = 0.228m)
  const wreathVineCore = new THREE.Mesh(
    new THREE.TorusGeometry(0.228, 0.018, 10, 28),
    wreathTwigBarkMat
  );
  wreathVineCore.rotation.y = Math.PI / 2;
  wreathVineCore.position.x = 0.044;
  wreathGroup.add(wreathVineCore);

  // 1) Exact Christmas-Tree-Matched 11-Shoot Serrated Conifer Spray Texture + 3-Wing 3D Bough Geometry!
  const wreathPineSprayTex = (() => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const pctx = c.getContext('2d')!;
    pctx.clearRect(0, 0, S, S);
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';

    const drawConiferShoot = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      halfWid: number,
      teethCount: number,
      brightVariant = false
    ) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      pctx.save();
      pctx.translate(x0, y0);
      pctx.rotate(ang);

      const tracePad = () => {
        pctx.beginPath();
        pctx.moveTo(0, -halfWid * 0.38);
        for (let k = 0; k < teethCount; k++) {
          const t0 = k / teethCount;
          const tTip = (k + 0.86) / teethCount;
          const tNotch = (k + 0.94) / teethCount;
          const env = Math.sin(Math.min(1, t0 * 1.15 + 0.20) * Math.PI * 0.78);
          const oy = -halfWid * (0.55 + 0.52 * env);
          const ny = -halfWid * (0.30 + 0.32 * env);
          pctx.quadraticCurveTo(len * (t0 + 0.42 / teethCount), oy * 0.92, len * Math.min(0.96, tTip), oy);
          if (k < teethCount - 1) pctx.lineTo(len * tNotch, ny);
        }
        pctx.lineTo(len * 0.95, -halfWid * 0.28);
        pctx.lineTo(len, 0);
        pctx.lineTo(len * 0.95, halfWid * 0.28);
        for (let k = teethCount - 1; k >= 0; k--) {
          const t0 = k / teethCount;
          const tTip = (k + 0.86) / teethCount;
          const tNotch = (k + 0.94) / teethCount;
          const env = Math.sin(Math.min(1, t0 * 1.15 + 0.20) * Math.PI * 0.78);
          const oy = halfWid * (0.55 + 0.52 * env);
          const ny = halfWid * (0.30 + 0.32 * env);
          if (k < teethCount - 1) pctx.lineTo(len * tNotch, ny);
          pctx.quadraticCurveTo(len * (t0 + 0.42 / teethCount), oy * 0.92, len * Math.min(0.96, tTip), oy);
        }
        pctx.lineTo(0, halfWid * 0.38);
        pctx.closePath();
      };

      tracePad();
      pctx.fillStyle = brightVariant ? '#349154' : '#297e47';
      pctx.fill();
      pctx.strokeStyle = '#154428';
      pctx.lineWidth = 4.4;
      pctx.stroke();

      pctx.save();
      tracePad();
      pctx.clip();
      const shGrad = pctx.createLinearGradient(0, -halfWid, 0, halfWid);
      shGrad.addColorStop(0.0, brightVariant ? '#5cb86c' : '#48a65c');
      shGrad.addColorStop(0.48, brightVariant ? '#359255' : '#2b8049');
      shGrad.addColorStop(1.0, '#1d5c35');
      pctx.fillStyle = shGrad;
      pctx.fillRect(0, -halfWid * 1.3, len * 1.05, halfWid * 2.6);

      const tipGrad = pctx.createLinearGradient(len * 0.45, 0, len, 0);
      tipGrad.addColorStop(0.0, 'rgba(130, 218, 132, 0)');
      tipGrad.addColorStop(1.0, brightVariant ? 'rgba(142, 226, 136, 0.82)' : 'rgba(116, 208, 122, 0.68)');
      pctx.fillStyle = tipGrad;
      pctx.fillRect(len * 0.45, -halfWid * 1.2, len * 0.60, halfWid * 2.4);
      pctx.restore();
      pctx.restore();
    };

    const shoots: [number, number, number, number, number, number, boolean][] = [
      [256, 470, 62, 336, 26, 5, false],
      [256, 464, 450, 330, 26, 5, true],
      [256, 392, 58, 244, 25, 5, true],
      [256, 386, 454, 238, 25, 5, false],
      [256, 310, 76, 156, 24, 5, false],
      [256, 304, 436, 150, 24, 5, true],
      [256, 228, 108, 86, 22, 4, true],
      [256, 222, 404, 80, 22, 4, false],
      [256, 154, 154, 38, 20, 4, false],
      [256, 150, 358, 36, 20, 4, true],
    ];
    for (const [x0, y0, x1, y1, hw, tc, bright] of shoots) {
      drawConiferShoot(x0, y0, x1, y1, hw, tc, bright);
    }
    drawConiferShoot(256, 504, 256, 14, 30, 9, true);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  })();

  // Deeper, richer dark-evergreen pine tint matching the darkened Christmas tree
  const wreathPineMat = mat({
    map: wreathPineSprayTex,
    color: 0xbad0bc,
    roughness: 0.70,
    metalness: 0.0,
    alphaTest: 0.40,
    side: THREE.DoubleSide,
    rimScale: 1.28,
    celStrength: 0.56,
  });

  // True 3-Wing 3D S-Sweep Conifer Bough Geometry (identical structure to Christmas tree's pineFrondGeo!)
  const wreathBoughGeo = (() => {
    const bLen = 0.255;
    const bWid = 0.195;
    const wings: THREE.BufferGeometry[] = [];
    for (const tilt of [0, 0.46, -0.46]) {
      const wScale = tilt === 0 ? 1.0 : 0.66;
      const g = new THREE.PlaneGeometry(bWid * wScale, bLen, 5, 8);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, bLen * 0.5);

      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const pz = pos.getZ(i);
        const t = THREE.MathUtils.clamp(pz / bLen, 0, 1);
        const sideFrac = Math.abs(px) / (bWid * wScale * 0.5);
        const archY = 0.016 * Math.sin(t * Math.PI) - 0.022 * Math.pow(t, 1.5);
        const roofSkirtY = -Math.pow(sideFrac, 1.15) * 0.024 * (0.35 + 0.65 * t);
        const rx = px * Math.cos(tilt) - roofSkirtY * Math.sin(tilt);
        const ry = px * Math.sin(tilt) + roofSkirtY * Math.cos(tilt) + archY;
        pos.setXYZ(i, rx, ry, pz);
      }
      g.computeVertexNormals();
      wings.push(g);
    }
    return BufferGeometryUtils.mergeGeometries(wings, false)!;
  })();

  // Arrange 66 3-wing 3D pine boughs around the compact 0.228m vine ring (外圈缩小一点，更紧凑精致)
  const wreathBoughSpecs: {
    r: number;
    ang: number;
    splayRad: number;
    liftX: number;
    xBase: number;
    sc: number;
  }[] = [];
  // Outer feathery ring (24 boughs)
  for (let i = 0; i < 24; i++) {
    wreathBoughSpecs.push({
      r: 0.232 + (i % 2) * 0.010,
      ang: (i / 24) * Math.PI * 2,
      splayRad: 0.40 + (i % 3) * 0.06,
      liftX: 0.16,
      xBase: 0.046,
      sc: 0.88 + (i % 3) * 0.05,
    });
  }
  // Thick main front crown ring (24 boughs)
  for (let i = 0; i < 24; i++) {
    wreathBoughSpecs.push({
      r: 0.214 + (i % 2) * 0.008,
      ang: ((i + 0.5) / 24) * Math.PI * 2,
      splayRad: 0.06 + ((i % 3) - 1) * 0.07,
      liftX: 0.34 + (i % 2) * 0.08,
      xBase: 0.064,
      sc: 0.82 + (i % 3) * 0.04,
    });
  }
  // Inner rim ring (18 boughs)
  for (let i = 0; i < 18; i++) {
    wreathBoughSpecs.push({
      r: 0.192,
      ang: ((i + 0.25) / 18) * Math.PI * 2,
      splayRad: -0.32,
      liftX: 0.24,
      xBase: 0.056,
      sc: 0.74 + (i % 2) * 0.05,
    });
  }

  const wreathBoughsInst = new THREE.InstancedMesh(
    wreathBoughGeo,
    wreathPineMat,
    wreathBoughSpecs.length
  );
  wreathBoughsInst.castShadow = false;
  wreathBoughsInst.receiveShadow = true;
  {
    const bFwd = new THREE.Vector3();
    const bUp = new THREE.Vector3();
    const bRight = new THREE.Vector3();
    const bBasis = new THREE.Matrix4();
    for (let i = 0; i < wreathBoughSpecs.length; i++) {
      const sp = wreathBoughSpecs[i];
      const radY = Math.sin(sp.ang);
      const radZ = Math.cos(sp.ang);
      // Clockwise tangent in Y-Z plane (looking from +X toward wall)
      const tanY = Math.cos(sp.ang);
      const tanZ = -Math.sin(sp.ang);

      // +Z of bough sweeps along clockwise tangent + radial splay + gentle +X forward loft
      bFwd
        .set(
          sp.liftX,
          tanY + radY * sp.splayRad,
          tanZ + radZ * sp.splayRad
        )
        .normalize();
      // +Y of bough (upper pine needle face) faces outward (+X) into the living room!
      bUp.set(1, radY * 0.22, radZ * 0.22).normalize();
      bRight.crossVectors(bUp, bFwd).normalize();
      bUp.crossVectors(bFwd, bRight).normalize();

      bBasis.makeBasis(bRight, bUp, bFwd);
      _instQuat.setFromRotationMatrix(bBasis);
      _instPos.set(sp.xBase, radY * sp.r, radZ * sp.r);
      _instScale.set(sp.sc, sp.sc, sp.sc);
      _instMat.compose(_instPos, _instQuat, _instScale);
      wreathBoughsInst.setMatrixAt(i, _instMat);
    }
    wreathBoughsInst.instanceMatrix.needsUpdate = true;
    wreathBoughsInst.computeBoundingSphere();
  }
  wreathGroup.add(wreathBoughsInst);

  // 2) Fibonacci Open-Scale Woody Pinecones (26 individual sculpted woody bract scales per pinecone!)
  const pineconeScaleGeo = (() => {
    const g = new THREE.ConeGeometry(0.0095, 0.024, 4);
    g.scale(1.15, 1.0, 0.36); // Flattened diamond woody scale blade
    g.translate(0, 0.011, 0);
    return g;
  })();
  const buildOpenScalePinecone = (scale = 1.0) => {
    const pc = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.011, 0.056, 8),
      wreathTwigBarkMat
    );
    core.position.y = 0.028;
    pc.add(core);

    const numScales = 26;
    const goldenAng = 2.39996;
    for (let k = 0; k < numScales; k++) {
      const t = k / (numScales - 1); // 0 bottom -> 1 apex
      const y = 0.006 + t * 0.052;
      const env = Math.sin(Math.pow(t, 0.78) * Math.PI * 0.92);
      const yaw = k * goldenAng;
      const flare = THREE.MathUtils.lerp(1.12, 0.42, t); // Wide open scales below, tighter near apex
      const scMesh = new THREE.Mesh(
        pineconeScaleGeo,
        k % 2 === 0 ? pineconeScaleTipMat : pineconeScaleBaseMat
      );
      scMesh.position.set(Math.cos(yaw) * 0.006 * env, y, Math.sin(yaw) * 0.006 * env);
      scMesh.rotation.order = 'YXZ';
      scMesh.rotation.y = -yaw + Math.PI * 0.5;
      scMesh.rotation.x = flare;
      const sFactor = 0.65 + 0.55 * env;
      scMesh.scale.set(sFactor, sFactor, sFactor);
      pc.add(scMesh);
    }
    pc.scale.setScalar(scale);
    return pc;
  };
  // Organic NON-uniform clustered placement for Pinecones (错落聚簇分布)
  for (const [pAng, pRad, pScale] of [
    [0.62, 0.228, 1.04],
    [0.92, 0.218, 0.88],
    [2.38, 0.232, 1.08],
    [4.42, 0.224, 1.02],
    [5.85, 0.222, 0.94],
  ] as const) {
    const pc = buildOpenScalePinecone(pScale);
    pc.position.set(0.118, Math.sin(pAng) * pRad, Math.cos(pAng) * pRad);
    pc.rotation.set(pAng + 0.45, 0.28, -Math.PI * 0.40);
    wreathGroup.add(pc);
  }

  // 3) Bundled Rolled Cinnamon Sticks (桂皮卷束) — asymmetric clustered pairs
  const buildCinnamonBundle = () => {
    const cb = new THREE.Group();
    for (const [oy, oz] of [
      [-0.008, -0.007],
      [0.008, -0.006],
      [0.0, 0.008],
    ] as const) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0085, 0.0085, 0.10, 10),
        cinnamonMat
      );
      stick.position.set(0, oy, oz);
      stick.rotation.z = Math.PI / 2;
      stick.castShadow = true;
      cb.add(stick);
    }
    const twineWrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.0155, 0.003, 6, 14),
      twineMat
    );
    twineWrap.rotation.y = Math.PI / 2;
    cb.add(twineWrap);
    return cb;
  };
  for (const [cAng, cRad, cTilt] of [
    [1.18, 0.226, 0.48],
    [2.68, 0.232, -0.32],
    [4.12, 0.224, 0.55],
  ] as const) {
    const bundle = buildCinnamonBundle();
    bundle.position.set(0.122, Math.sin(cAng) * cRad, Math.cos(cAng) * cRad);
    bundle.rotation.set(cAng + cTilt, Math.PI / 2, 0.28);
    wreathGroup.add(bundle);
  }

  // 4) Dried Golden-Amber Lemon Slices (干柠檬片) — asymmetric organic grouping
  const buildLemonSlice = (radius = 0.040) => {
    const ls = new THREE.Group();
    const peel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.007, 18),
      lemonPeelMat
    );
    peel.rotation.z = Math.PI / 2;
    ls.add(peel);

    const pith = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.87, radius * 0.87, 0.0082, 18),
      lemonPithMat
    );
    pith.rotation.z = Math.PI / 2;
    ls.add(pith);

    const pulp = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, 0.009, 16),
      lemonPulpMat
    );
    pulp.rotation.z = Math.PI / 2;
    ls.add(pulp);

    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.0096, radius * 1.54, 0.0026),
        lemonPithMat
      );
      spoke.rotation.x = (s / 4) * Math.PI;
      ls.add(spoke);
    }
    return ls;
  };
  for (const [lAng, lRad, lSize] of [
    [0.24, 0.230, 0.042],
    [1.92, 0.224, 0.038],
    [2.20, 0.234, 0.036],
    [5.22, 0.228, 0.040],
  ] as const) {
    const slice = buildLemonSlice(lSize);
    slice.position.set(0.128, Math.sin(lAng) * lRad, Math.cos(lAng) * lRad);
    slice.rotation.set(0, Math.cos(lAng) * 0.22, Math.sin(lAng) * 0.22);
    wreathGroup.add(slice);
  }

  // 4B) Fluffy White Natural Cotton Bolls (棉花朵) — clustered organically with pinecones & cinnamon
  const cottonFluffMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.012,
    color: 0xfbf7f0,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.42,
  });
  const buildCottonBoll = (scale = 1.0) => {
    const cb = new THREE.Group();
    // Woody brown 4-petal cotton calyx cup at base
    for (let p = 0; p < 4; p++) {
      const pa = (p / 4) * Math.PI * 2 + 0.4;
      const sepal = new THREE.Mesh(
        new THREE.ConeGeometry(0.012, 0.026, 4),
        wreathTwigBarkMat
      );
      sepal.position.set(-0.004, Math.sin(pa) * 0.014, Math.cos(pa) * 0.014);
      sepal.rotation.set(pa, 0, -Math.PI * 0.38);
      cb.add(sepal);
    }
    // 4 plump creamy-white cotton puffs nestled in the calyx
    for (const [ox, oy, oz, rad] of [
      [0.012, 0.011, 0.009, 0.017],
      [0.013, -0.011, 0.010, 0.016],
      [0.011, 0.009, -0.012, 0.016],
      [0.014, -0.009, -0.010, 0.015],
      [0.018, 0.0, 0.0, 0.015],
    ] as const) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rad, 10, 8), cottonFluffMat);
      puff.position.set(ox, oy, oz);
      puff.castShadow = true;
      cb.add(puff);
    }
    cb.scale.setScalar(scale);
    return cb;
  };
  for (const [ctAng, ctRad, ctScale] of [
    [1.46, 0.228, 1.05],
    [3.52, 0.226, 1.00],
    [3.84, 0.218, 0.88],
    [5.54, 0.230, 0.96],
  ] as const) {
    const cotton = buildCottonBoll(ctScale);
    cotton.position.set(0.122, Math.sin(ctAng) * ctRad, Math.cos(ctAng) * ctRad);
    cotton.rotation.set(ctAng, 0.15, 0.08);
    wreathGroup.add(cotton);
  }

  // 4C) Red-and-White Striped Christmas Candy Canes (糖拐杖) — tucked asymmetrically into the wreath!
  const candyCaneTex = (() => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const cc = c.getContext('2d')!;
    cc.fillStyle = '#fffaf4';
    cc.fillRect(0, 0, 128, 256);
    cc.fillStyle = '#d62234';
    for (let y = -128; y < 384; y += 32) {
      cc.beginPath();
      cc.moveTo(0, y);
      cc.lineTo(128, y + 64);
      cc.lineTo(128, y + 78);
      cc.lineTo(0, y + 14);
      cc.closePath();
      cc.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 3);
    return tex;
  })();
  const candyCaneMat = mat({
    map: candyCaneTex,
    color: 0xffffff,
    roughness: 0.24,
    metalness: 0.04,
    celStrength: 0.44,
  });
  const candyCaneGeo = (() => {
    const pts = [
      new THREE.Vector3(0, -0.075, 0),
      new THREE.Vector3(0, -0.015, 0),
      new THREE.Vector3(0, 0.045, 0),
      new THREE.Vector3(0, 0.068, 0.012),
      new THREE.Vector3(0, 0.074, 0.032),
      new THREE.Vector3(0, 0.058, 0.046),
      new THREE.Vector3(0, 0.034, 0.044),
    ];
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0082, 10, false);
  })();
  for (const [ccAng, ccRad, ccRotX, ccScale] of [
    [0.82, 0.228, -0.45, 1.02],
    [2.92, 0.225, 0.58, 0.96],
    [4.74, 0.222, -0.32, 0.94],
  ] as const) {
    const cane = new THREE.Mesh(candyCaneGeo, candyCaneMat);
    cane.position.set(0.132, Math.sin(ccAng) * ccRad, Math.cos(ccAng) * ccRad);
    cane.rotation.set(ccRotX, 0.16, 0.14);
    cane.scale.setScalar(ccScale);
    cane.castShadow = true;
    wreathGroup.add(cane);
  }

  // 5) Holly Leaves & Glossy Red Berry Clusters (冬青叶与红冬青果) — asymmetric accents
  const hollyLeafGeo = createBroadLeafGeometry(0.076, 0.042, 0.22, 0.14);
  const hollyBerryGeo = new THREE.SphereGeometry(0.0105, 10, 8);
  for (const hAng of [0.42, 1.72, 2.52, 3.26, 4.98, 6.04]) {
    const hPos = new THREE.Vector3(0.126, Math.sin(hAng) * 0.226, Math.cos(hAng) * 0.226);
    for (const side of [-1, 1]) {
      const hLeaf = new THREE.Mesh(hollyLeafGeo, wreathHollyLeafMat);
      hLeaf.position.copy(hPos);
      hLeaf.rotation.set(hAng + side * 0.65, Math.PI / 2 + side * 0.35, side * 0.42);
      hLeaf.castShadow = true;
      wreathGroup.add(hLeaf);
    }
    for (const [bx, by, bz] of [
      [0.016, 0.010, 0.008],
      [0.018, -0.009, 0.011],
      [0.014, 0.002, -0.012],
      [0.022, 0.003, 0.001],
    ] as const) {
      const berry = new THREE.Mesh(hollyBerryGeo, wreathBerryMat);
      berry.position.set(hPos.x + bx, hPos.y + by, hPos.z + bz);
      berry.castShadow = true;
      wreathGroup.add(berry);
    }
  }

  // 6) STRUCTURED 4-LOOP FOLDED CRIMSON VELVET RIBBON BOW + SWALLOWTAIL TAILS
  //    Real thickened wide ribbon strips with pinched gather pleats, open teardrop turns,
  //    pleated center cinch band, and crisp V-notched swallowtail ends!
  const buildSolidRibbonStrip = (
    segU: number,
    segV: number,
    thick: number,
    evalSurface: (u: number, v: number, outPos: THREE.Vector3) => void
  ): THREE.BufferGeometry => {
    const topGeo = new THREE.PlaneGeometry(1, 1, segU, segV);
    const botGeo = new THREE.PlaneGeometry(1, 1, segU, segV);
    botGeo.rotateY(Math.PI);

    const pTop = topGeo.attributes.position;
    const uvTop = topGeo.attributes.uv;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < pTop.count; i++) {
      const u = THREE.MathUtils.clamp(pTop.getX(i) + 0.5, 0, 1); // 0..1 along ribbon length
      const v = THREE.MathUtils.clamp(pTop.getY(i) + 0.5, 0, 1); // 0..1 across ribbon width
      evalSurface(u, v - 0.5, tmp);
      pTop.setXYZ(i, tmp.x, tmp.y, tmp.z);
      uvTop.setXY(i, v, u * 1.8);
    }
    pTop.needsUpdate = true;
    uvTop.needsUpdate = true;
    topGeo.computeVertexNormals();

    const nTop = topGeo.attributes.normal;
    const pBot = botGeo.attributes.position;
    const uvBot = botGeo.attributes.uv;
    for (let iy = 0; iy <= segV; iy++) {
      for (let ix = 0; ix <= segU; ix++) {
        const srcIdx = iy * (segU + 1) + (segU - ix);
        const dstIdx = iy * (segU + 1) + ix;
        const nx = nTop.getX(srcIdx);
        const ny = nTop.getY(srcIdx);
        const nz = nTop.getZ(srcIdx);
        pBot.setXYZ(
          dstIdx,
          pTop.getX(srcIdx) - nx * thick,
          pTop.getY(srcIdx) - ny * thick,
          pTop.getZ(srcIdx) - nz * thick
        );
        pTop.setXYZ(
          srcIdx,
          pTop.getX(srcIdx) + nx * (thick * 0.5),
          pTop.getY(srcIdx) + ny * (thick * 0.5),
          pTop.getZ(srcIdx) + nz * (thick * 0.5)
        );
        uvBot.setXY(dstIdx, uvTop.getX(srcIdx), uvTop.getY(srcIdx));
      }
    }
    pTop.needsUpdate = true;
    pBot.needsUpdate = true;
    uvBot.needsUpdate = true;
    topGeo.computeVertexNormals();
    botGeo.computeVertexNormals();
    return BufferGeometryUtils.mergeGeometries([topGeo, botGeo], false)!;
  };

  // Parametric folded teardrop velvet ribbon loop (pinched & pleated at waist, open curved teardrop turn!)
  const createFoldedVelvetLoopGeo = (
    spanZ: number,
    loopDepthX: number,
    ribbonW: number,
    side: -1 | 1
  ): THREE.BufferGeometry =>
    buildSolidRibbonStrip(40, 14, 0.0075, (u, s, out) => {
      const theta = u * Math.PI; // 0 (front cinch) -> pi/2 (outer teardrop fold) -> pi (back cinch)
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      // Teardrop centerline in X-Z (arches proudly forward along upper-front half, rounds open turn, tucks back)
      const cz = side * spanZ * Math.pow(sinT, 0.76);
      const cx =
        0.016 +
        loopDepthX * Math.pow(sinT, 0.62) * (0.56 + 0.44 * cosT);
      const cyLift = 0.022 * sinT * cosT;

      // Pinched tightly inside center knot (u=0,1), fanning out to full proud ribbon width along the loop!
      const pinch = 1.0 - Math.pow(sinT, 0.52);
      const wScale = 0.26 + 0.74 * Math.pow(sinT, 0.48);

      // 3 crisp longitudinal fabric gather pleats radiating from the knot into the velvet ribbon belly!
      const pleatWave =
        Math.sin(s * Math.PI * 3.0) * 0.013 * (0.28 + 0.72 * pinch);
      // Softly cupped velvet ribbon cross-section so edges curl naturally inward like heavy woven ribbon
      const edgeCurl = -s * s * 0.022 * sinT;

      const wy = s * ribbonW * wScale + cyLift;
      const wx = cx + pleatWave * (0.5 + 0.5 * Math.abs(cosT)) + edgeCurl;
      const wz = cz + side * edgeCurl * 0.35;
      out.set(wx, wy, wz);
    });

  // Parametric pleated center ribbon cinch wrap (wraps snugly around the gathered waist with real folds)
  const createVelvetKnotWrapGeo = (): THREE.BufferGeometry =>
    buildSolidRibbonStrip(24, 12, 0.008, (u, s, out) => {
      const ang = (u - 0.5) * Math.PI * 1.18; // Wraps from top (+Y) over front (+X) to bottom (-Y)
      const radY = 0.056;
      const radX = 0.052;
      const pleat = Math.cos(s * Math.PI * 4.0) * 0.0045;
      const wx = 0.036 + Math.cos(ang) * radX + pleat;
      const wy = Math.sin(ang) * radY;
      const wz = s * 0.082 * (0.88 + 0.12 * Math.cos(ang));
      out.set(wx, wy, wz);
    });

  // Parametric S-draped wide velvet ribbon tail with crisp inverted-V swallowtail cut tip (燕尾切口)!
  const createSwallowtailRibbonGeo = (
    tailLen: number,
    ribbonW: number,
    side: -1 | 1
  ): THREE.BufferGeometry =>
    buildSolidRibbonStrip(32, 14, 0.0065, (u, s, out) => {
      // At u -> 1, center (s = 0) notches upward while outer corners (|s| = 0.5) extend to crisp swallowtail points!
      const vNotch = (1.0 - Math.abs(s) * 2.0) * 0.048 * THREE.MathUtils.smoothstep(u, 0.72, 1.0);
      const dropY = -0.028 - u * tailLen + vNotch;

      // Gentle S-curve billow draped over the lower pine wreath + soft longitudinal ribbon ripple
      const billowX =
        0.026 +
        Math.sin(u * Math.PI * 1.35) * 0.034 +
        Math.sin(s * Math.PI * 2.0) * 0.008 * (1.0 - u * 0.4) -
        s * s * 0.014;
      const flareW = ribbonW * (0.52 + 0.56 * Math.pow(u, 0.65));
      const sweepZ = side * (0.036 + Math.pow(u, 1.08) * 0.095) + s * flareW;
      out.set(billowX, dropY, sweepZ);
    });

  const bowGroup = new THREE.Group();
  bowGroup.position.set(0.110, 0.012, 0);

  // Upper/Outer pair of broad structured velvet ribbon loops + Lower/Inner pair sized to the compact wreath
  const mainLoopLeftGeo = createFoldedVelvetLoopGeo(0.185, 0.084, 0.132, -1);
  const mainLoopRightGeo = createFoldedVelvetLoopGeo(0.185, 0.084, 0.132, 1);
  const innerLoopLeftGeo = createFoldedVelvetLoopGeo(0.148, 0.070, 0.112, -1);
  const innerLoopRightGeo = createFoldedVelvetLoopGeo(0.148, 0.070, 0.112, 1);

  for (const side of [-1, 1] as const) {
    // Primary proud upper-horizontal velvet ribbon loop
    const mainLoop = new THREE.Mesh(
      side === -1 ? mainLoopLeftGeo : mainLoopRightGeo,
      redVelvetBowMat
    );
    mainLoop.position.set(0.014, 0.026, 0);
    mainLoop.rotation.x = side * -0.18;
    mainLoop.castShadow = true;
    mainLoop.receiveShadow = true;
    outlines.addOutline(mainLoop, 1.016);
    bowGroup.add(mainLoop);

    // Secondary angled velvet ribbon loop filling upper-inner & lower-inner center naturally
    const subLoop = new THREE.Mesh(
      side === -1 ? innerLoopLeftGeo : innerLoopRightGeo,
      redVelvetDeepMat
    );
    subLoop.position.set(-0.008, 0.058, 0);
    subLoop.rotation.x = side * 0.42;
    subLoop.rotation.y = side * -0.10;
    subLoop.castShadow = true;
    subLoop.receiveShadow = true;
    bowGroup.add(subLoop);
  }

  // Tightly wrapped, creased velvet ribbon center cinch band
  const knotWrap = new THREE.Mesh(createVelvetKnotWrapGeo(), redVelvetBowMat);
  knotWrap.position.set(0.016, 0.020, 0);
  knotWrap.castShadow = true;
  knotWrap.receiveShadow = true;
  outlines.addOutline(knotWrap, 1.018);
  bowGroup.add(knotWrap);

  // Two flowing wavy velvet ribbon tails with crisp swallowtail V-cut tips filling the lower wreath opening
  for (const [side, len] of [
    [-1, 0.295],
    [1, 0.275],
  ] as const) {
    const tail = new THREE.Mesh(
      createSwallowtailRibbonGeo(len, 0.112, side),
      redVelvetBowMat
    );
    tail.castShadow = true;
    tail.receiveShadow = true;
    outlines.addOutline(tail, 1.015);
    bowGroup.add(tail);
  }
  wreathGroup.add(bowGroup);

  group.add(wreathGroup);
  registerInteractable('liv_xmas_wreath', '手工圣诞花环', '欣赏圣诞花环', 'living', wreathGroup, () => ({
    title: '诺贝松圣诞花环与红丝绒蝴蝶结',
    message: '挂在四层长斗柜上方墙面的手工圣诞花环：饱满的诺贝松枝叶间点缀着松果、捆扎桂皮、亮红冬青果与金黄干柠檬片，正中央是一只蓬松柔软、填满棉花的布艺红丝绒蝴蝶结。',
  }));

  // InstancedMesh for 4 Outward-Splayed Turned Oak Legs under Bookshelf
  const bcLegGeo = createTurnedLegGeometry(0.020, 0.013, 0.17);
  const bcLegsInst = new THREE.InstancedMesh(bcLegGeo, darkOakMat, 4);
  const shelfOrigin = new THREE.Vector3(-0.98, 0, -1.25);
  const bcLegCoords: [number, number][] = [
    [-0.09, -0.37],
    [0.09, -0.37],
    [-0.09, 0.37],
    [0.09, 0.37],
  ];
  for (let i = 0; i < bcLegCoords.length; i++) {
    const [lx, lz] = bcLegCoords[i];
    bcLegsInst.setMatrixAt(
      i,
      composeSplayedLegMatrix(lx, 0.165, lz, 0.17, 0.14, 0.12, shelfOrigin)
    );
  }
  bcLegsInst.instanceMatrix.needsUpdate = true;
  bcLegsInst.computeBoundingSphere();
  group.add(bcLegsInst);

  // Sculpted Light-Toned Diverse Books, Manga Sets, Horizontal Stacks & Retro Games across all 4 West Bookcase Tiers
  // Tier 1 (Y = 0.574): Full-width primary display shelf (Manga set + Literature + Philosophy + Horizontal stack + Cartridge)
  populateRealisticBookTier({
    parent: shelf,
    axis: 'z',
    spineSign: 1,
    start: -0.40,
    end: 0.40,
    surfaceY: 0.574,
    depthCenter: 0.016,
    maxDepth: 0.21,
    maxHeight: 0.31,
    seed: 31,
    includeMangaSet: true,
    includeHorizontalStack: true,
    includeRetroGames: true,
  });
  // Tier 2 (Y = 0.924): Left/center open bay beside the cream linen box
  populateRealisticBookTier({
    parent: shelf,
    axis: 'z',
    spineSign: 1,
    start: -0.40,
    end: 0.14,
    surfaceY: 0.924,
    depthCenter: 0.016,
    maxDepth: 0.21,
    maxHeight: 0.31,
    seed: 67,
    includeMangaSet: false,
    includeHorizontalStack: true,
    includeRetroGames: true,
  });
  // Tier 3 (Y = 1.274): Center/right open bay beside the sage linen box
  populateRealisticBookTier({
    parent: shelf,
    axis: 'z',
    spineSign: 1,
    start: -0.14,
    end: 0.40,
    surfaceY: 1.274,
    depthCenter: 0.016,
    maxDepth: 0.21,
    maxHeight: 0.31,
    seed: 97,
    includeMangaSet: true,
    includeHorizontalStack: false,
    includeRetroGames: true,
  });
  // Lower Cupboard Interior (Y = 0.197): Stored philosophy, design books & retro game boxes behind the white cupboard doors
  populateRealisticBookTier({
    parent: shelf,
    axis: 'z',
    spineSign: 1,
    start: -0.38,
    end: 0.38,
    surfaceY: 0.197,
    depthCenter: 0.004,
    maxDepth: 0.20,
    maxHeight: 0.32,
    seed: 149,
    includeMangaSet: false,
    includeHorizontalStack: true,
    includeRetroGames: true,
  });

  // Interactive Lower Cupboard Doors on the Living Room Bookshelf Cabinet
  for (const sz of [-0.205, 0.205]) {
    const hingeSide: -1 | 1 = sz < 0 ? -1 : 1;
    registerCabinetDoor({
      id: sz < 0 ? 'liv_cupboard_left' : 'liv_cupboard_right',
      label: sz < 0 ? '书柜下层左柜门' : '书柜下层右柜门',
      room: 'living',
      parent: shelf,
      centerX: 0.132,
      centerY: 0.37,
      centerZ: sz,
      width: 0.40,
      height: 0.34,
      thickness: 0.024,
      facingAxis: 'x',
      facingSign: 1,
      hingeSide,
      openSign: (-hingeSide) as -1 | 1,
      doorMat: drawerWhiteMat,
      moldingMat: drawerMoldingMat,
      handleMat: handleBrassMat,
    });
  }

  group.add(shelf);
  addBoxCollider('col_liv_bookshelf', -0.98, 0.50, -1.25, 0.34, 1.0, 0.96);

  // Wooden-Framed Square Wall Clock above TV Wall Shelf (木框方形挂钟, 指针停在 19:57)
  const squareClockFaceTex = (() => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx2d = c.getContext('2d')!;

    // Warm vintage cream-ivory square dial base
    const dialGrad = ctx2d.createRadialGradient(S * 0.5, S * 0.5, 30, S * 0.5, S * 0.5, S * 0.72);
    dialGrad.addColorStop(0.0, '#fdfaf0');
    dialGrad.addColorStop(0.75, '#f6efe0');
    dialGrad.addColorStop(1.0, '#eadec8');
    ctx2d.fillStyle = dialGrad;
    ctx2d.fillRect(0, 0, S, S);

    // Classic double-line square railway minute track
    ctx2d.strokeStyle = '#4a3525';
    ctx2d.lineWidth = 4;
    ctx2d.strokeRect(34, 34, S - 68, S - 68);
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(48, 48, S - 96, S - 96);

    // 60 perimeter ticks projected onto the square railway track + 12 bold hour ticks
    const halfSpan = S * 0.5 - 34;
    const innerSpan = S * 0.5 - 48;
    for (let m = 0; m < 60; m++) {
      const ang = (m / 60) * Math.PI * 2 - Math.PI * 0.5;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const scaleOut = halfSpan / Math.max(Math.abs(dx), Math.abs(dy));
      const scaleIn = (m % 5 === 0 ? innerSpan - 6 : innerSpan) / Math.max(Math.abs(dx), Math.abs(dy));
      ctx2d.strokeStyle = m % 5 === 0 ? '#3a2618' : 'rgba(74, 53, 37, 0.55)';
      ctx2d.lineWidth = m % 5 === 0 ? 4.2 : 1.8;
      ctx2d.beginPath();
      ctx2d.moveTo(S * 0.5 + dx * scaleIn, S * 0.5 + dy * scaleIn);
      ctx2d.lineTo(S * 0.5 + dx * scaleOut, S * 0.5 + dy * scaleOut);
      ctx2d.stroke();
    }

    // Classic serif numerals arranged cleanly inside the square dial
    ctx2d.fillStyle = '#382417';
    ctx2d.font = 'bold 42px Georgia, serif';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    const numSpan = S * 0.5 - 88;
    for (let h = 1; h <= 12; h++) {
      const ang = (h / 12) * Math.PI * 2 - Math.PI * 0.5;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const rSq = numSpan / Math.max(Math.abs(dx), Math.abs(dy));
      ctx2d.fillText(String(h), S * 0.5 + dx * rSq * 0.94, S * 0.5 + dy * rSq * 0.94 + 2);
    }

    // Subtle inner decorative brass/umber hairline square & maker mark
    ctx2d.strokeStyle = 'rgba(168, 128, 76, 0.45)';
    ctx2d.lineWidth = 2;
    ctx2d.strokeRect(142, 142, S - 284, S - 284);
    ctx2d.fillStyle = 'rgba(92, 66, 44, 0.72)';
    ctx2d.font = '600 15px Georgia, serif';
    ctx2d.fillText('HERITAGE OAK', S * 0.5, S * 0.5 - 48);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  })();

  const clockGroup = new THREE.Group();
  clockGroup.position.set(7.15, 2.56, -5.08);

  // Recessed square backing box
  const clockBack = new THREE.Mesh(
    createBeveledBox(0.036, 0.36, 0.36, 0.008, 2),
    darkOakMat
  );
  clockBack.position.x = 0.004;
  clockBack.castShadow = true;
  clockGroup.add(clockBack);

  // Mitered Molded Warm-Oak Square Outer Frame (4 thick beveled frame rails)
  const frameSize = 0.385;
  const frameBarW = 0.044;
  for (const fy of [-frameSize * 0.5 + frameBarW * 0.5, frameSize * 0.5 - frameBarW * 0.5]) {
    const hBar = new THREE.Mesh(
      createBeveledBox(0.044, frameBarW, frameSize, 0.007, 2),
      oakMat
    );
    hBar.position.set(-0.006, fy, 0);
    hBar.castShadow = true;
    outlines.addOutline(hBar, 1.025);
    clockGroup.add(hBar);
  }
  for (const fz of [-frameSize * 0.5 + frameBarW * 0.5, frameSize * 0.5 - frameBarW * 0.5]) {
    const vBar = new THREE.Mesh(
      createBeveledBox(0.044, frameSize - frameBarW * 1.9, frameBarW, 0.007, 2),
      oakMat
    );
    vBar.position.set(-0.006, 0, fz);
    vBar.castShadow = true;
    outlines.addOutline(vBar, 1.025);
    clockGroup.add(vBar);
  }

  // Inner Brushed-Brass Bezel Fillet framing the square dial
  for (const by of [-0.149, 0.149]) {
    const bRim = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.304), handleBrassMat);
    bRim.position.set(-0.022, by, 0);
    clockGroup.add(bRim);
  }
  for (const bz of [-0.149, 0.149]) {
    const bRim = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.304, 0.006), handleBrassMat);
    bRim.position.set(-0.022, 0, bz);
    clockGroup.add(bRim);
  }

  // Square Vintage Cream Dial Face
  const clockFaceMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.296, 0.296),
    mat({ map: squareClockFaceTex, roughness: 0.42 })
  );
  clockFaceMesh.rotation.y = -Math.PI / 2;
  clockFaceMesh.position.x = -0.018;
  clockGroup.add(clockFaceMesh);

  // Sculpted 3D Clock Hands frozen at 19:57 (7:57) + Brass Center Cap
  // Facing -X: +Y is 12 o'clock, +Z is 3 o'clock (to viewer's right when looking East +X -> wait: looking +X, right is +Z, left is -Z!)
  const clockHandMat = mat({ color: 0x2c1d14, roughness: 0.35, metalness: 0.25 });
  const addFixedClockHand = (clockMinutes: number, len: number, wid: number, xOff: number, handMat = clockHandMat) => {
    const ang = (clockMinutes / 60) * Math.PI * 2;
    const hPivot = new THREE.Group();
    hPivot.position.set(xOff, 0, 0);
    // Looking toward +X (East wall): +Y is 12 o'clock, +Z is clockwise 3 o'clock -> rotate around -X by +ang!
    hPivot.rotation.x = -ang;
    const blade = new THREE.Mesh(
      createBeveledBox(0.004, len, wid, 0.001, 1),
      handMat
    );
    blade.position.y = len * 0.38;
    hPivot.add(blade);
    clockGroup.add(hPivot);
  };
  addFixedClockHand((7 + 57 / 60) * 5, 0.092, 0.012, -0.021); // Hour hand at ~7:57
  addFixedClockHand(57, 0.126, 0.0085, -0.024); // Minute hand at :57
  addFixedClockHand(22, 0.132, 0.0035, -0.026, mat({ color: 0xb83b3b, roughness: 0.35 })); // Frozen red second hand

  const clockCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.012, 0.010, 12),
    handleBrassMat
  );
  clockCap.rotation.z = Math.PI / 2;
  clockCap.position.x = -0.026;
  clockGroup.add(clockCap);

  group.add(clockGroup);

  registerInteractable('liv_clock', '挂钟', '查看时间', 'living', clockGroup, () => ({
    title: '木框方形挂钟',
    message: '指针死死停在 19:57。秒针没有在走动，但窗外的黄昏却从未落幕。',
  }));

  // =========================================================================
  // 6. CLASSIC AMERICAN TRADITIONAL COFFEE TABLE WITH TURNED BALUSTER LEGS,
  //    STEPPED OGEE TABLETOP, RAISED-PANEL WOOD DRAWERS & PANELED UNDERTIER SHELF
  //    Position: (4.62, 0, -5.25), Width = 0.96m, Length = 1.70m, Top Surface Y = 0.448m!
  // =========================================================================
  const table = new THREE.Group();
  table.position.set(4.62, 0, -5.25);

  // Multi-Stepped American Ogee-Molded Overhanging Tabletop (top exact at Y = 0.448m!)
  const tableTop = new THREE.Mesh(
    createBeveledSlab(0.98, 0.032, 1.72, 0.032, 0.010),
    oakMat
  );
  tableTop.position.y = 0.432;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  outlines.addOutline(tableTop, 1.013);
  table.add(tableTop);

  // Stepped American Cove Under-Molding beneath the Overhanging Tabletop
  const tableUnderBevel = new THREE.Mesh(
    createBeveledBox(0.92, 0.020, 1.66, 0.006, 2),
    darkOakMat
  );
  tableUnderBevel.position.y = 0.408;
  tableUnderBevel.castShadow = true;
  table.add(tableUnderBevel);

  // Recessed American Framed Apron Structure + Lower Beaded Apron Molding (Y = 0.334 .. 0.400)
  const apronLongGeo = createBeveledBox(0.028, 0.066, 1.44, 0.005, 2);
  for (const ax of [-0.39, 0.39]) {
    const rail = new THREE.Mesh(apronLongGeo, oakMat);
    rail.position.set(ax, 0.368, 0);
    rail.castShadow = true;
    table.add(rail);

    const lowerBead = new THREE.Mesh(
      createBeveledBox(0.036, 0.012, 1.46, 0.003, 2),
      darkOakMat
    );
    lowerBead.position.set(ax, 0.334, 0);
    table.add(lowerBead);
  }
  const apronShortGeo = createBeveledBox(0.78, 0.066, 0.028, 0.005, 2);
  for (const az of [-0.73, 0.73]) {
    const rail = new THREE.Mesh(apronShortGeo, oakMat);
    rail.position.set(0, 0.368, az);
    rail.castShadow = true;
    table.add(rail);

    // American Recessed Panel Molding on Short End Aprons
    const endInset = new THREE.Mesh(
      createBeveledBox(0.58, 0.038, 0.012, 0.003, 2),
      darkOakMat
    );
    endInset.position.set(0, 0.368, az + (az < 0 ? -0.012 : 0.012));
    table.add(endInset);

    const shortBead = new THREE.Mesh(
      createBeveledBox(0.80, 0.012, 0.036, 0.003, 2),
      darkOakMat
    );
    shortBead.position.set(0, 0.334, az);
    table.add(shortBead);
  }

  // Dual Symmetrical American Raised-Panel Wood Drawers (same warm peach-oak family + vintage brass pulls!)
  for (const side of [-1, 1] as const) {
    const centerStile = new THREE.Mesh(
      createBeveledBox(0.034, 0.068, 0.048, 0.005, 2),
      darkOakMat
    );
    centerStile.position.set(side * 0.39, 0.368, 0);
    table.add(centerStile);

    for (const dz of [-0.355, 0.355]) {
      const ctDrawer = createMoldedDrawerFront(
        0.62,
        0.056,
        0.024,
        'x',
        oakMat,
        darkOakMat,
        handleBrassMat,
        side
      );
      ctDrawer.position.set(side * 0.395, 0.368, dz);
      table.add(ctDrawer);
    }
  }

  // Framed Paneled American Solid-Oak Undertier Display Shelf (top at Y = 0.148m)
  const lowerShelfOuter = new THREE.Mesh(
    createBeveledSlab(0.82, 0.026, 1.54, 0.018, 0.006),
    oakMat
  );
  lowerShelfOuter.position.y = 0.135;
  lowerShelfOuter.castShadow = true;
  lowerShelfOuter.receiveShadow = true;
  outlines.addOutline(lowerShelfOuter, 1.012);
  table.add(lowerShelfOuter);

  for (const pz of [-0.36, 0.36]) {
    const shelfGroove = new THREE.Mesh(
      createBeveledBox(0.66, 0.006, 0.62, 0.002, 1),
      darkOakMat
    );
    shelfGroove.position.set(0, 0.147, pz);
    table.add(shelfGroove);

    const shelfRaised = new THREE.Mesh(
      createBeveledBox(0.61, 0.008, 0.57, 0.003, 1),
      oakMat
    );
    shelfRaised.position.set(0, 0.149, pz);
    shelfRaised.receiveShadow = true;
    table.add(shelfRaised);
  }

  // Decorative wooden catch-all tray & art magazine resting flush on the American undertier shelf
  const lowerTray = new THREE.Mesh(
    createBeveledSlab(0.34, 0.028, 0.44, 0.024, 0.006),
    darkOakMat
  );
  lowerTray.position.set(-0.02, 0.166, -0.24);
  lowerTray.rotation.y = 0.08;
  table.add(lowerTray);

  const lowerMag = new THREE.Mesh(
    createBookGeometry(0.24, 0.022, 0.32, 1),
    bookAtlasMat
  );
  lowerMag.position.set(0.04, 0.164, 0.28);
  lowerMag.rotation.y = -0.18;
  table.add(lowerMag);

  // 4 Chunky Vertical American Turned Baluster / Spindle Legs (美式车削葫芦方柱腿)
  const balusterProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.022, 0),       // Bottom floor pad
    new THREE.Vector2(0.034, 0.022),   // Bun foot swell
    new THREE.Vector2(0.020, 0.048),   // Ankle pinch
    new THREE.Vector2(0.028, 0.060),   // Lower ring bead
    new THREE.Vector2(0.022, 0.115),   // Lower shaft into shelf block
    new THREE.Vector2(0.022, 0.160),   // Emerging above shelf block
    new THREE.Vector2(0.032, 0.175),   // Mid collar ring
    new THREE.Vector2(0.023, 0.192),   // Neck pinch
    new THREE.Vector2(0.038, 0.245),   // Plump American baluster urn belly!
    new THREE.Vector2(0.022, 0.305),   // Upper taper neck
    new THREE.Vector2(0.032, 0.320),   // Upper ring bead
    new THREE.Vector2(0.026, 0.334),   // Join into top square post
  ];
  const balusterLegGeo = new THREE.LatheGeometry(balusterProfile, 18);
  const legSquarePostGeo = createBeveledBox(0.068, 0.078, 0.068, 0.006, 2);
  const legShelfBlockGeo = createBeveledBox(0.064, 0.044, 0.064, 0.005, 2);

  for (const [lx, lz] of [
    [-0.39, -0.73],
    [0.39, -0.73],
    [-0.39, 0.73],
    [0.39, 0.73],
  ] as const) {
    const turnedCol = new THREE.Mesh(balusterLegGeo, oakMat);
    turnedCol.position.set(lx, 0, lz);
    turnedCol.castShadow = true;
    turnedCol.receiveShadow = true;
    outlines.addOutline(turnedCol, 1.03);
    table.add(turnedCol);

    // Top square pommel block joining the molded apron
    const topBlock = new THREE.Mesh(legSquarePostGeo, darkOakMat);
    topBlock.position.set(lx, 0.369, lz);
    topBlock.castShadow = true;
    outlines.addOutline(topBlock, 1.025);
    table.add(topBlock);

    // Lower square pommel block anchoring the undertier shelf
    const shelfBlock = new THREE.Mesh(legShelfBlockGeo, darkOakMat);
    shelfBlock.position.set(lx, 0.135, lz);
    shelfBlock.castShadow = true;
    table.add(shelfBlock);
  }

  // 1) Sculpted Walnut & Brushed-Brass Headphone Stand + Over-Ear Studio Headphones
  const headphoneStandGroup = new THREE.Group();
  headphoneStandGroup.position.set(0.17, 0.442, -0.32);
  headphoneStandGroup.rotation.y = -0.38;

  const hpMetalMat = mat({ color: 0xd9c298, roughness: 0.28, metalness: 0.72, celStrength: 0.38 });
  const hpShellMat = mat({ color: 0xf4ece2, roughness: 0.34, metalness: 0.08, celStrength: 0.42 });
  const hpPadMat = mat({ color: 0x3b3538, roughness: 0.82, metalness: 0.02, celStrength: 0.45 });
  const hpYokeMat = mat({ color: 0x8d8892, roughness: 0.30, metalness: 0.68, celStrength: 0.38 });

  // Weighted chamfered walnut base + subtle recessed accessory tray lip
  const hpBase = new THREE.Mesh(
    createBeveledSlab(0.126, 0.018, 0.114, 0.022, 0.005),
    darkOakMat
  );
  hpBase.position.y = 0.009;
  hpBase.castShadow = true;
  hpBase.receiveShadow = true;
  outlines.addOutline(hpBase, 1.035);
  headphoneStandGroup.add(hpBase);

  const hpBaseTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.024, 0.008, 16),
    hpMetalMat
  );
  hpBaseTrim.position.set(0, 0.021, -0.012);
  headphoneStandGroup.add(hpBaseTrim);

  // Curved slender brushed-brass upright stem + arched oak headband cradle
  const hpStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.022, -0.012),
    new THREE.Vector3(0, 0.132, -0.018),
    new THREE.Vector3(0, 0.228, -0.006),
    new THREE.Vector3(0, 0.264, 0.004),
  ]);
  const hpStem = new THREE.Mesh(
    new THREE.TubeGeometry(hpStemCurve, 18, 0.0062, 10, false),
    hpMetalMat
  );
  hpStem.castShadow = true;
  headphoneStandGroup.add(hpStem);

  const hpCradleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.044, 0.252, 0.004),
    new THREE.Vector3(-0.022, 0.267, 0.004),
    new THREE.Vector3(0, 0.272, 0.004),
    new THREE.Vector3(0.022, 0.267, 0.004),
    new THREE.Vector3(0.044, 0.252, 0.004),
  ]);
  const hpCradle = new THREE.Mesh(
    new THREE.TubeGeometry(hpCradleCurve, 14, 0.011, 8, false),
    oakMat
  );
  hpCradle.scale.set(1.0, 0.58, 1.35);
  hpCradle.castShadow = true;
  headphoneStandGroup.add(hpCradle);

  // Draped Over-Ear Studio Headphones resting cleanly on the cradle
  const headphonesRig = new THREE.Group();
  headphonesRig.position.set(0, 0.278, 0.006);

  const headbandCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.072, -0.106, 0),
    new THREE.Vector3(-0.080, -0.042, 0),
    new THREE.Vector3(-0.054, 0.004, 0),
    new THREE.Vector3(0, 0.016, 0),
    new THREE.Vector3(0.054, 0.004, 0),
    new THREE.Vector3(0.080, -0.042, 0),
    new THREE.Vector3(0.072, -0.106, 0),
  ]);
  const headbandOuter = new THREE.Mesh(
    new THREE.TubeGeometry(headbandCurve, 28, 0.0105, 10, false),
    hpShellMat
  );
  headbandOuter.scale.set(1.0, 1.0, 1.55);
  headbandOuter.castShadow = true;
  outlines.addOutline(headbandOuter, 1.03);
  headphonesRig.add(headbandOuter);

  const headbandCushion = new THREE.Mesh(
    new THREE.TubeGeometry(headbandCurve, 24, 0.0082, 8, false),
    hpPadMat
  );
  headbandCushion.position.y = -0.0045;
  headbandCushion.scale.set(0.95, 0.94, 1.35);
  headphonesRig.add(headbandCushion);

  // Twin adjustable metal sliders, yokes, champagne-cream earcups & plush earpads
  for (const side of [-1, 1] as const) {
    const slider = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0034, 0.0034, 0.036, 8),
      hpYokeMat
    );
    slider.position.set(side * 0.074, -0.114, 0);
    slider.rotation.z = side * 0.14;
    headphonesRig.add(slider);

    const yoke = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.0034, 8, 16, Math.PI),
      hpYokeMat
    );
    yoke.position.set(side * 0.070, -0.152, 0);
    yoke.rotation.y = Math.PI / 2;
    headphonesRig.add(yoke);

    const earCupGroup = new THREE.Group();
    earCupGroup.position.set(side * 0.066, -0.154, 0);
    earCupGroup.rotation.z = side * -0.16;

    // Oval sculpted champagne-ivory outer earcup dome
    const cupDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.040, 20, 14),
      hpShellMat
    );
    cupDome.scale.set(0.46, 1.12, 0.92);
    cupDome.position.x = side * 0.011;
    cupDome.castShadow = true;
    outlines.addOutline(cupDome, 1.035);
    earCupGroup.add(cupDome);

    // Brushed-brass accent ring on outer earcup face
    const cupRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.0024, 8, 20),
      hpMetalMat
    );
    cupRing.rotation.y = Math.PI / 2;
    cupRing.scale.set(0.88, 1.12, 1.0);
    cupRing.position.x = side * 0.028;
    earCupGroup.add(cupRing);

    // Plush matte leatherette oval earpad cushion
    const earPad = new THREE.Mesh(
      new THREE.TorusGeometry(0.030, 0.0125, 12, 22),
      hpPadMat
    );
    earPad.rotation.y = Math.PI / 2;
    earPad.scale.set(0.90, 1.14, 1.0);
    earPad.position.x = side * -0.003;
    earPad.castShadow = true;
    earCupGroup.add(earPad);

    // Acoustic inner driver fabric scrim
    const scrim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.004, 16),
      cavityDarkMat
    );
    scrim.rotation.z = Math.PI / 2;
    scrim.scale.set(1.0, 1.0, 0.88);
    scrim.position.x = side * -0.001;
    earCupGroup.add(scrim);

    headphonesRig.add(earCupGroup);
  }
  headphoneStandGroup.add(headphonesRig);
  table.add(headphoneStandGroup);

  // 2) Refined Warm-Cream Ceramic & Beveled Honey-Oak Tissue Box (精致抽纸盒)
  const tissueBoxGroup = new THREE.Group();
  tissueBoxGroup.position.set(-0.07, 0.442, -0.22);
  tissueBoxGroup.rotation.y = 0.16;

  const tbW = 0.215;
  const tbH = 0.088;
  const tbD = 0.122;

  const tissueCeramicMat = mat({
    color: 0xf9f3ea,
    roughness: 0.36,
    metalness: 0.02,
    celStrength: 0.40,
  });
  const tissuePaperMat = mat({
    color: 0xfffdf9,
    roughness: 0.94,
    metalness: 0.0,
    side: THREE.DoubleSide,
    celStrength: 0.32,
  });

  // Subtle recessed felt base footpad so box floats crisp above coffee table
  const tbFoot = new THREE.Mesh(
    createBeveledBox(tbW - 0.016, 0.006, tbD - 0.016, 0.002, 1),
    darkOakMat
  );
  tbFoot.position.y = 0.003;
  tissueBoxGroup.add(tbFoot);

  // Rounded matte warm-cream ceramic body with crisp brass front badge trim
  const tbBody = new THREE.Mesh(
    createBeveledBox(tbW, tbH - 0.014, tbD, 0.014, 3),
    tissueCeramicMat
  );
  tbBody.position.y = 0.006 + (tbH - 0.014) / 2;
  tbBody.castShadow = true;
  tbBody.receiveShadow = true;
  outlines.addOutline(tbBody, 1.03);
  tissueBoxGroup.add(tbBody);

  // Delicate horizontal decorative fluting rib & tiny brass nameplate on front face
  const tbBrassPlate = new THREE.Mesh(
    createBeveledBox(0.036, 0.010, 0.003, 0.001, 1),
    hpMetalMat
  );
  tbBrassPlate.position.set(0, 0.044, tbD / 2 + 0.001);
  tissueBoxGroup.add(tbBrassPlate);

  // Warm beveled honey-oak top lid with recessed dark oval dispensing slot
  const tbLid = new THREE.Mesh(
    createBeveledSlab(tbW - 0.008, 0.014, tbD - 0.008, 0.016, 0.004),
    oakMat
  );
  tbLid.position.y = tbH - 0.004;
  tbLid.castShadow = true;
  tbLid.receiveShadow = true;
  outlines.addOutline(tbLid, 1.025);
  tissueBoxGroup.add(tbLid);

  const slotRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.0026, 8, 20),
    hpMetalMat
  );
  slotRim.rotation.x = Math.PI / 2;
  slotRim.scale.set(2.35, 0.48, 1.0);
  slotRim.position.y = tbH + 0.0036;
  tissueBoxGroup.add(slotRim);

  const slotOpening = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.020, 0.003, 18),
    cavityDarkMat
  );
  slotOpening.scale.set(2.25, 1.0, 0.44);
  slotOpening.position.y = tbH + 0.0028;
  tissueBoxGroup.add(slotOpening);

  // Organically sculpted billowing 2-ply soft ivory tissue emerging gracefully from the slot
  const buildTissueWave = (
    w: number,
    h: number,
    tiltX: number,
    tiltZ: number,
    phase: number
  ): THREE.BufferGeometry => {
    const geo = new THREE.PlaneGeometry(w, h, 14, 12);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let vi = 0; vi < pos.count; vi++) {
      const px = pos.getX(vi);
      const py = pos.getY(vi);
      const vNorm = (py + h * 0.5) / h; // 0 at slot base, 1 at soft ruffled peak
      const uNorm = px / (w * 0.5);
      // Pinch sharply inside the dispensing slot at vNorm = 0, flare softly outward toward top!
      const pinch = 0.42 + 0.72 * Math.pow(vNorm, 0.75);
      const xOut = px * pinch + Math.sin(vNorm * Math.PI * 1.15 + phase) * 0.008 * vNorm;
      const yOut = py + h * 0.5 + (1 - Math.abs(uNorm)) * 0.016 * vNorm;
      const flutter =
        Math.sin(uNorm * 3.6 + phase) * 0.010 * vNorm * vNorm +
        Math.cos(vNorm * 3.1 + phase * 0.7) * 0.008 * vNorm;
      const zOut = flutter + tiltX * vNorm * vNorm * 0.042;
      pos.setXYZ(vi, xOut + tiltZ * vNorm * 0.018, yOut, zOut);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const tissueSheetA = new THREE.Mesh(
    buildTissueWave(0.102, 0.068, 0.72, -0.35, 0.4),
    tissuePaperMat
  );
  tissueSheetA.position.set(0, tbH + 0.001, 0.002);
  tissueSheetA.castShadow = true;
  tissueBoxGroup.add(tissueSheetA);

  const tissueSheetB = new THREE.Mesh(
    buildTissueWave(0.088, 0.056, -0.58, 0.42, 2.2),
    tissuePaperMat
  );
  tissueSheetB.position.set(0.004, tbH + 0.001, -0.002);
  tissueSheetB.castShadow = true;
  tissueBoxGroup.add(tissueSheetB);

  table.add(tissueBoxGroup);

  // Standing Hardcover Artbook with Printed Title & Geometric Cover on Coffee Table
  const blueBookGroup = new THREE.Group();
  blueBookGroup.position.set(-0.10, 0.562, -0.56);
  blueBookGroup.rotation.y = 0.32;
  blueBookGroup.rotation.z = -0.16;
  const blueCover = new THREE.Mesh(
    createBookGeometry(0.16, 0.23, 0.044, 1),
    bookAtlasMat
  );
  blueCover.castShadow = true;
  blueCover.receiveShadow = true;
  outlines.addOutline(blueCover, 1.045);
  blueBookGroup.add(blueCover);
  table.add(blueBookGroup);

  // Wooden Serving Tray with Warm Glowing Scented Candle on Coffee Table (茶几木质托盘 + 暖光香薰蜡烛)
  const candleTrayGroup = new THREE.Group();
  candleTrayGroup.position.set(-0.22, 0.448, 0.36);
  candleTrayGroup.rotation.y = 0.14;

  const trayBase = new THREE.Mesh(
    createBeveledSlab(0.24, 0.014, 0.32, 0.036, 0.004),
    darkOakMat
  );
  trayBase.position.y = 0.007;
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  outlines.addOutline(trayBase, 1.028);
  candleTrayGroup.add(trayBase);

  // Raised tray rim walls + brushed-brass side loop handles
  for (const rz of [-0.152, 0.152]) {
    const rim = new THREE.Mesh(createBeveledBox(0.23, 0.024, 0.014, 0.003, 2), oakMat);
    rim.position.set(0, 0.018, rz);
    candleTrayGroup.add(rim);

    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.004, 8, 16, Math.PI),
      handleBrassMat
    );
    handle.position.set(0, 0.028, rz);
    candleTrayGroup.add(handle);
  }
  for (const rx of [-0.112, 0.112]) {
    const rim = new THREE.Mesh(createBeveledBox(0.014, 0.024, 0.30, 0.003, 2), oakMat);
    rim.position.set(rx, 0.018, 0);
    candleTrayGroup.add(rim);
  }

  // Amber frosted-glass scented candle jar + melted cream wax + glowing flame + warm PointLight
  const candleJarMat = mat({
    color: 0xdca064,
    roughness: 0.24,
    metalness: 0.05,
    transparent: true,
    opacity: 0.84,
  });
  const candleJar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.040, 0.086, 18),
    candleJarMat
  );
  candleJar.position.set(0.01, 0.056, -0.02);
  candleJar.castShadow = true;
  // Static ceramic candle jar merges into LivingRoomMergedStaticMesh (only flame & halo remain dynamic!)
  candleTrayGroup.add(candleJar);

  const candleWax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.039, 0.036, 0.068, 16),
    mat({ color: 0xfbf2e0, roughness: 0.55, metalness: 0.0 })
  );
  candleWax.position.set(0.01, 0.048, -0.02);
  candleTrayGroup.add(candleWax);

  // Minimalist cream scent label band around the candle jar
  const candleLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0445, 0.0425, 0.036, 18, 1, true, -0.8, 1.6),
    mat({ color: 0xfaf4e8, roughness: 0.85, side: THREE.DoubleSide })
  );
  candleLabel.position.set(0.01, 0.054, -0.02);
  candleTrayGroup.add(candleLabel);

  // Glowing teardrop candle flame + soft warm additive halo + near-field warm PointLight
  const flameMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe494 })
  );
  flameMesh.scale.set(0.72, 1.85, 0.72);
  flameMesh.position.set(0.01, 0.104, -0.02);
  flameMesh.userData.dynamic = true;
  candleTrayGroup.add(flameMesh);

  const flameHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.036, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffcf70,
      transparent: true,
      opacity: 0.30,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  flameHalo.position.set(0.01, 0.106, -0.02);
  flameHalo.userData.dynamic = true;
  candleTrayGroup.add(flameHalo);

  const candleLight = new THREE.PointLight(0xffca72, 0.90, 2.3, 2.0);
  candleLight.position.set(0.01, 0.145, -0.02);
  candleTrayGroup.add(candleLight);

  // Vintage matchbox & petite evergreen sprig resting beside the candle inside the wooden tray
  const matchbox = new THREE.Mesh(
    createBeveledBox(0.046, 0.014, 0.068, 0.002, 1),
    mat({ color: 0xb8363f, roughness: 0.72 })
  );
  matchbox.position.set(-0.042, 0.021, 0.075);
  matchbox.rotation.y = -0.35;
  candleTrayGroup.add(matchbox);

  const traySprig = new THREE.Mesh(
    new THREE.ConeGeometry(0.016, 0.075, 6),
    mat({ color: 0x2e7a4a, roughness: 0.75 })
  );
  traySprig.rotation.set(Math.PI * 0.48, 0.4, -0.6);
  traySprig.position.set(0.045, 0.024, 0.068);
  candleTrayGroup.add(traySprig);

  table.add(candleTrayGroup);

  // Open Double-Page Illustrated Botanical Magazine & Pink Heart Notepad on Coffee Table (shifted slightly +X to give controllers sofa-side room)
  const openMagGroup = new THREE.Group();
  openMagGroup.position.set(0.14, 0.443, 0.16);
  openMagGroup.rotation.y = 0.28;

  // Pink heart-patterned booklet tucked diagonally underneath the open magazine (Screenshot 1)
  const flatBook2 = new THREE.Mesh(
    createBeveledSlab(0.18, 0.012, 0.24, 0.012, 0.004),
    mat({ map: textures.tableclothPink, color: 0xf6c2d4, roughness: 0.68 })
  );
  flatBook2.position.set(-0.08, 0.006, 0.08);
  flatBook2.rotation.y = -0.52;
  flatBook2.castShadow = true;
  openMagGroup.add(flatBook2);

  // Left & Right cambered open magazine pages
  for (const side of [-1, 1] as const) {
    const pageLeaf = new THREE.Mesh(
      createBeveledSlab(0.16, 0.010, 0.22, 0.008, 0.003),
      pageMat
    );
    pageLeaf.position.set(side * 0.078, 0.014, 0);
    pageLeaf.rotation.z = side * -0.05;
    pageLeaf.castShadow = true;
    outlines.addOutline(pageLeaf, 1.03);
    openMagGroup.add(pageLeaf);
  }
  // Botanical green header block & text lines on left page + botanical plant motif on right page
  const magGreenPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.065, 0.052),
    plantLeafLightMat
  );
  magGreenPatch.rotation.x = -Math.PI / 2;
  magGreenPatch.position.set(-0.09, 0.021, -0.045);
  openMagGroup.add(magGreenPatch);

  for (let ln = 0; ln < 6; ln++) {
    const textLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.006),
      cavityDarkMat
    );
    textLine.rotation.x = -Math.PI / 2;
    textLine.position.set(-0.075, 0.021, 0.01 + ln * 0.014);
    openMagGroup.add(textLine);
  }
  const magBotanicalIllust = new THREE.Mesh(
    new THREE.PlaneGeometry(0.075, 0.095),
    plantLeafMat
  );
  magBotanicalIllust.rotation.x = -Math.PI / 2;
  magBotanicalIllust.position.set(0.075, 0.021, 0.01);
  openMagGroup.add(magBotanicalIllust);
  table.add(openMagGroup);

  // Iced Drink Tumbler with Bent Drinking Straw
  const drinkGroup = new THREE.Group();
  drinkGroup.position.set(-0.22, 0.443, 0.52);
  const coaster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.058, 0.009, 16),
    darkOakMat
  );
  drinkGroup.add(coaster);

  const cupGlassMat = mat({
    color: 0xe6f2fa,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.62,
  });
  cupGlassMat.depthWrite = false;
  const tumblerCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.034, 0.13, 18),
    cupGlassMat
  );
  tumblerCup.position.y = 0.068;
  tumblerCup.castShadow = true;
  outlines.addOutline(tumblerCup, 1.05);
  drinkGroup.add(tumblerCup);

  const drinkLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.040, 0.031, 0.095, 16),
    mat({ color: 0xe86f52, roughness: 0.22 })
  );
  drinkLiquid.position.y = 0.055;
  drinkGroup.add(drinkLiquid);

  const lidRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.005, 8, 18),
    ceramicMat
  );
  lidRim.rotation.x = Math.PI / 2;
  lidRim.position.y = 0.134;
  drinkGroup.add(lidRim);

  const strawPts = [
    new THREE.Vector3(-0.008, 0.02, -0.005),
    new THREE.Vector3(0.006, 0.140, 0.004),
    new THREE.Vector3(0.014, 0.172, 0.010),
    new THREE.Vector3(0.048, 0.188, 0.032),
  ];
  const strawMesh = new THREE.Mesh(
    createTaperedCurveGeometry(strawPts, 0.0055, 0.0055, 14, 8),
    mat({ color: 0xff6b8b, roughness: 0.35 })
  );
  strawMesh.castShadow = true;
  drinkGroup.add(strawMesh);
  table.add(drinkGroup);

  // Two Detailed Wireless Xbox Controllers (White & Light Purple) + Sleek TV Remote on Sofa-Near Edge (-X)
  const consoleStationGroup = new THREE.Group();
  consoleStationGroup.position.set(-0.27, 0.442, 0.08);
  consoleStationGroup.userData.dynamic = true;

  const tablePurplePad = buildXboxControllerMesh(uniforms, 'purple', outlines, {
    addOutline: true,
    isDynamic: true,
  });
  tablePurplePad.position.set(0.01, 0.0, -0.22);
  tablePurplePad.rotation.y = Math.PI * 0.44;
  consoleStationGroup.add(tablePurplePad);

  const tableWhitePad = buildXboxControllerMesh(uniforms, 'white', outlines, {
    addOutline: true,
    isDynamic: true,
  });
  tableWhitePad.position.set(0.01, 0.0, 0.01);
  tableWhitePad.rotation.y = Math.PI * 0.56;
  consoleStationGroup.add(tableWhitePad);

  const tableRemote = buildTvRemoteMesh(uniforms, outlines);
  tableRemote.position.set(-0.01, 0.0, 0.23);
  tableRemote.rotation.y = Math.PI * 0.5 + 0.12;
  consoleStationGroup.add(tableRemote);

  table.add(consoleStationGroup);
  ctx.metaState.livingConsole.tableWhitePad = tableWhitePad;
  ctx.metaState.livingConsole.tablePurplePad = tablePurplePad;
  ctx.metaState.livingConsole.tableRemote = tableRemote;

  // Two-Tone Creamy White & Macaron Sky-Blue Square Pen Holder Cup on Coffee Table
  const penCupGroup = new THREE.Group();
  penCupGroup.position.set(-0.20, 0.442, -0.46);
  const cupBot = new THREE.Mesh(
    createBeveledBox(0.072, 0.052, 0.072, 0.008, 2),
    mat({ color: 0x82c8ff, roughness: 0.90, metalness: 0.0 })
  );
  cupBot.position.y = 0.026;
  cupBot.castShadow = true;
  penCupGroup.add(cupBot);
  const cupTop = new THREE.Mesh(
    createBeveledBox(0.074, 0.054, 0.074, 0.008, 2),
    ceramicMat
  );
  cupTop.position.y = 0.078;
  cupTop.castShadow = true;
  outlines.addOutline(cupTop, 1.04);
  penCupGroup.add(cupTop);
  const cupCavity = new THREE.Mesh(
    createBeveledBox(0.058, 0.012, 0.058, 0.004, 1),
    cavityDarkMat
  );
  cupCavity.position.y = 0.102;
  penCupGroup.add(cupCavity);
  for (const [px, pz, rx, rz, pcol] of [
    [-0.014, -0.012, 0.16, 0.18, 0xff7da0],
    [0.015, -0.010, 0.12, -0.22, 0x6ae09c],
    [0.004, 0.016, -0.18, -0.10, 0xffdf6e],
  ] as const) {
    const standPen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.004, 0.135, 8),
      mat({ color: pcol, roughness: 0.35 })
    );
    standPen.position.set(px, 0.095, pz);
    standPen.rotation.set(rx, 0, rz);
    penCupGroup.add(standPen);
  }
  table.add(penCupGroup);

  group.add(table);
  addBoxCollider('col_coffee_table', 4.62, 0.26, -5.25, 0.98, 0.52, 1.72);

  registerInteractable('liv_gamepad', 'Xbox 双人手柄与遥控器', '查看手柄与遥控器', 'living', consoleStationGroup, () => ({
    title: '茶几沙发侧的双人 Xbox 手柄与遥控器',
    message: '茶几靠近沙发的一侧整齐摆着两只 Xbox 无线游戏手柄——一只纯净白、一只浅薰衣草紫，还有一只金属边框电视遥控器。坐上客厅沙发就能叫她一起拿手柄打雪仗或玩坦克大战！',
  }));

  registerInteractable('liv_headphone_stand', '胡桃木耳机架与精致抽纸盒', '检查茶几摆件', 'living', headphoneStandGroup, () => ({
    title: '胡桃木黄铜耳机架与精致抽纸盒',
    message: '黄铜支架上稳稳挂着一副象牙白复古监听头戴耳机，柔软的耳罩还带着淡淡的木质香气；旁边的陶瓷橡木盖抽纸盒里轻轻抽出一角素白纸巾，把茶几衬托得格外温馨利落。',
  }));

  // Small Tabletop Pens, Drafting Pencil & Brass Top/Dice Trinkets on Coffee Table
  const { penGroup: livPen, pencilGroup: livPencil } = createTabletopPenSet(ctx, 0x2c4a6f, true);
  livPen.position.set(0.16, 0.442, -0.24);
  livPen.rotation.y = 0.38;
  table.add(livPen);
  registerAmbientProp({
    id: 'liv_table_pen',
    room: 'living',
    mesh: livPen,
    worldPos: [4.78, 0.442, -5.49],
    kind: 'roller',
    maxDrift: 0.038,
    rollRadius: 0.0056,
    rollAxis: 'x',
    reactivity: 1.32,
  });

  if (livPencil) {
    livPencil.position.set(0.10, 0.442, -0.34);
    livPencil.rotation.y = -0.52;
    table.add(livPencil);
    registerAmbientProp({
      id: 'liv_table_pencil',
      room: 'living',
      mesh: livPencil,
      worldPos: [4.72, 0.442, -5.59],
      kind: 'roller',
      maxDrift: 0.036,
      rollRadius: 0.0046,
      rollAxis: 'x',
      reactivity: 1.26,
    });
  }

  const livTrinkets = createTabletopTrinketCluster(ctx, 'dice_top');
  livTrinkets.position.set(0.26, 0.442, -0.02);
  livTrinkets.rotation.y = 0.24;
  table.add(livTrinkets);
  registerAmbientProp({
    id: 'liv_table_trinkets',
    room: 'living',
    mesh: livTrinkets,
    worldPos: [4.88, 0.442, -5.27],
    kind: 'trinket',
    maxDrift: 0.032,
    reactivity: 1.22,
  });

  // Register existing Coffee Table small props for subtle ambient physics
  registerAmbientProp({
    id: 'liv_table_drink',
    room: 'living',
    mesh: drinkGroup,
    worldPos: [4.40, 0.443, -4.73],
    kind: 'wobble',
    maxDrift: 0.018,
    reactivity: 0.92,
  });
  registerAmbientProp({
    id: 'liv_table_top_book',
    room: 'living',
    mesh: flatBook2,
    worldPos: [4.82, 0.482, -4.97],
    kind: 'slide',
    maxDrift: 0.016,
    reactivity: 0.72,
  });
  registerAmbientProp({
    id: 'liv_table_headphones',
    room: 'living',
    mesh: headphoneStandGroup,
    worldPos: [4.79, 0.442, -5.57],
    kind: 'wobble',
    maxDrift: 0.010,
    reactivity: 0.56,
  });
  registerAmbientProp({
    id: 'liv_table_tissue_box',
    room: 'living',
    mesh: tissueBoxGroup,
    worldPos: [4.55, 0.442, -5.47],
    kind: 'slide',
    maxDrift: 0.014,
    reactivity: 0.68,
  });

  // =========================================================================
  // 7. SIDE STOOL WITH INSTANCED LEGS + LOWER SHELF + CERAMIC VASE
  // =========================================================================
  const stool = new THREE.Group();
  stool.position.set(6.72, 0, -2.55);
  const stoolTop = new THREE.Mesh(
    createBeveledSlab(0.48, 0.042, 0.52, 0.075, 0.012),
    oakMat
  );
  stoolTop.position.y = 0.56;
  stoolTop.castShadow = true;
  outlines.addOutline(stoolTop, 1.025);
  stool.add(stoolTop);

  // InstancedMesh for 4 Outward-Splayed Turned Legs under Side Stool
  const stoolLegGeo = createTurnedLegGeometry(0.022, 0.014, 0.565);
  const stoolLegsInst = new THREE.InstancedMesh(stoolLegGeo, oakMat, 4);
  stoolLegsInst.castShadow = true;
  const stoolOrigin = new THREE.Vector3(6.72, 0, -2.55);
  const stoolLegCoords: [number, number][] = [
    [-0.15, -0.17],
    [0.15, -0.17],
    [-0.15, 0.17],
    [0.15, 0.17],
  ];
  for (let i = 0; i < stoolLegCoords.length; i++) {
    const [sx, sz] = stoolLegCoords[i];
    stoolLegsInst.setMatrixAt(
      i,
      composeSplayedLegMatrix(sx, 0.545, sz, 0.565, 0.18, 0.18, stoolOrigin)
    );
  }
  stoolLegsInst.instanceMatrix.needsUpdate = true;
  stoolLegsInst.computeBoundingSphere();
  group.add(stoolLegsInst);

  const lowerShelf = new THREE.Mesh(
    createBeveledSlab(0.39, 0.024, 0.43, 0.045, 0.007),
    oakMat
  );
  lowerShelf.position.y = 0.24;
  lowerShelf.castShadow = true;
  stool.add(lowerShelf);

  for (const sz of [-0.21, 0.21]) {
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.42, 8),
      darkOakMat
    );
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.225, sz);
    stool.add(rung);
  }

  const vasePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.062, 0),
    new THREE.Vector2(0.098, 0.09),
    new THREE.Vector2(0.088, 0.17),
    new THREE.Vector2(0.036, 0.27),
    new THREE.Vector2(0.034, 0.32),
    new THREE.Vector2(0.052, 0.35),
    new THREE.Vector2(0.042, 0.355),
    new THREE.Vector2(0.028, 0.31),
  ];
  const vase = new THREE.Mesh(new THREE.LatheGeometry(vasePts, 24), ceramicMat);
  vase.position.y = 0.58;
  vase.castShadow = true;
  outlines.addOutline(vase, 1.04);
  stool.add(vase);

  // Arching woody winterberry branches laden with glossy red holly berries & serrated dark-green holly leaves
  // (电视机右边花瓶插的带叶子红色冬青果!)
  const hollyBranchMat = mat({ color: 0x5c3e2e, roughness: 0.82, metalness: 0.0 });
  const vaseHollyLeafMat = mat({
    map: textures.plantLeaf,
    bumpMap: textures.plantLeafBump,
    bumpScale: 0.015,
    color: 0x2a6c3a,
    roughness: 0.36,
    metalness: 0.02,
    side: THREE.DoubleSide,
    windSway: 0.38,
  });
  const vaseHollyLeafBrightMat = mat({
    map: textures.plantLeaf,
    bumpMap: textures.plantLeafBump,
    bumpScale: 0.014,
    color: 0x3b8648,
    roughness: 0.38,
    metalness: 0.02,
    side: THREE.DoubleSide,
    windSway: 0.38,
  });
  const vaseHollyBerryMat = mat({
    color: 0xdc1c28,
    roughness: 0.18,
    metalness: 0.05,
  });

  const vaseHollyLeafGeo = createBroadLeafGeometry(0.115, 0.062, 0.24, 0.14);
  const vaseBerryGeo = new THREE.SphereGeometry(0.0135, 10, 8);
  const hollyBranches = [
    {
      pts: [
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(-0.04, 1.04, 0.05),
        new THREE.Vector3(-0.11, 1.24, 0.11),
      ],
      yaw: 0.55,
    },
    {
      pts: [
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(0.04, 1.06, -0.05),
        new THREE.Vector3(0.10, 1.27, -0.12),
      ],
      yaw: -2.35,
    },
    {
      pts: [
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(-0.06, 1.00, -0.04),
        new THREE.Vector3(-0.14, 1.15, -0.09),
      ],
      yaw: -1.25,
    },
    {
      pts: [
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(0.05, 1.02, 0.06),
        new THREE.Vector3(0.12, 1.18, 0.13),
      ],
      yaw: 1.15,
    },
    {
      pts: [
        new THREE.Vector3(0, 0.86, 0),
        new THREE.Vector3(-0.01, 1.12, 0.01),
        new THREE.Vector3(-0.03, 1.34, 0.03),
      ],
      yaw: -0.25,
    },
    {
      pts: [
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(-0.07, 0.96, 0.03),
        new THREE.Vector3(-0.15, 1.06, 0.06),
      ],
      yaw: -0.78,
    },
    {
      pts: [
        new THREE.Vector3(0, 0.85, 0),
        new THREE.Vector3(0.02, 1.08, -0.01),
        new THREE.Vector3(0.06, 1.29, -0.02),
      ],
      yaw: 2.15,
    },
  ];

  for (let bIdx = 0; bIdx < hollyBranches.length; bIdx++) {
    const hb = hollyBranches[bIdx];
    const curve = new THREE.CatmullRomCurve3(hb.pts);
    const branchMesh = new THREE.Mesh(
      createTaperedCurveGeometry(hb.pts, 0.0085, 0.0038, 14, 6),
      hollyBranchMat
    );
    branchMesh.castShadow = true;
    stool.add(branchMesh);

    // Place clusters of glossy scarlet holly berries & paired dark-green holly leaves along upper 60% of each branch
    for (const frac of [0.48, 0.74, 0.96]) {
      const nodePos = curve.getPoint(frac);
      // 2-3 holly leaves radiating from the node
      const leafCount = frac > 0.9 ? 2 : 3;
      for (let lf = 0; lf < leafCount; lf++) {
        const lAng = hb.yaw + lf * 2.15 + frac * 3.1;
        const leafHolder = new THREE.Group();
        leafHolder.position.copy(nodePos);
        leafHolder.rotation.order = 'YXZ';
        leafHolder.rotation.set(0.42 + (lf % 2) * 0.22, lAng, (lf % 2 === 0 ? 1 : -1) * 0.16);
        const hLeaf = new THREE.Mesh(
          vaseHollyLeafGeo,
          (bIdx + lf) % 2 === 0 ? vaseHollyLeafMat : vaseHollyLeafBrightMat
        );
        hLeaf.castShadow = true;
        hLeaf.receiveShadow = true;
        leafHolder.add(hLeaf);
        stool.add(leafHolder);
      }

      // Tight cluster of 5-6 bright glossy red holly berries (红冬青果)
      const berryOffsets: [number, number, number][] = [
        [0.014, 0.010, 0.008],
        [-0.013, 0.008, 0.012],
        [0.006, -0.010, -0.014],
        [-0.010, 0.018, -0.006],
        [0.011, 0.022, 0.002],
        [0.0, 0.004, 0.016],
      ];
      const count = frac > 0.9 ? 6 : 4;
      for (let k = 0; k < count; k++) {
        const [ox, oy, oz] = berryOffsets[k];
        const berry = new THREE.Mesh(vaseBerryGeo, vaseHollyBerryMat);
        berry.position.set(nodePos.x + ox, nodePos.y + oy, nodePos.z + oz);
        berry.scale.setScalar(0.88 + ((bIdx + k) % 3) * 0.12);
        berry.castShadow = true;
        stool.add(berry);
      }
    }
  }
  group.add(stool);
  addBoxCollider('col_side_stool', 6.72, 0.4, -2.55, 0.54, 0.8, 0.56);

  // =========================================================================
  // 8. MISIDE CHUNKY ROUNDED PLUSH STRAIGHT 3-SEATER SOFA (NO CHAISE LOUNGE!)
  //    - Removed chaise lounge extension for a balanced straight 3-seater silhouette
  //    - Extra-thick rounded plump seat cushions & soft chunky armrests (加厚坐垫、圆润敦实)
  //    - Rich woven linen-chenille cloth texture + lively macaron color-pop throw pillows
  // =========================================================================
  const sofa = new THREE.Group();
  sofa.position.set(2.38, 0, -5.25);
  sofa.rotation.y = Math.PI / 2;

  // Rounded satin honey-oak under-frame plinth rail
  const sofaWoodTrim = new THREE.Mesh(
    createBeveledSlab(3.46, 0.042, 1.04, 0.052, 0.013),
    oakMat
  );
  sofaWoodTrim.position.set(0.0, 0.132, 0.02);
  sofaWoodTrim.castShadow = true;
  sofaWoodTrim.receiveShadow = true;
  outlines.addOutline(sofaWoodTrim, 1.012);
  sofa.add(sofaWoodTrim);

  // Softly rounded upholstered base apron deck (lowered slightly to let extra-thick cushions stand out!)
  const sofaDeck = new THREE.Mesh(
    createPlushBox(3.32, 0.118, 1.00, 0.036, 0.08),
    sofaDarkMat
  );
  sofaDeck.position.set(0.0, 0.210, 0.02);
  sofaDeck.castShadow = true;
  sofaDeck.receiveShadow = true;
  sofa.add(sofaDeck);

  // Soft flush self-fabric upholstery button for the gentle central cushion tuft
  const buttonTuftGeo = new THREE.SphereGeometry(0.015, 14, 10);
  buttonTuftGeo.scale(0.85, 0.85, 0.30);

  // 3 Equal Extra-Thick Plump Rounded Seat Cushions across full straight 3-seater span
  const mainSeatCushGeo = createPlushBox(0.96, 0.255, 0.98, 0.068, 0.22);
  const mainSeatInst = new THREE.InstancedMesh(mainSeatCushGeo, sofaMat, 3);
  mainSeatInst.castShadow = true;
  mainSeatInst.receiveShadow = true;
  const seatXs = [-0.99, 0.0, 0.99];
  for (let i = 0; i < seatXs.length; i++) {
    _instMat.makeTranslation(seatXs[i], 0.386, 0.05);
    mainSeatInst.setMatrixAt(i, _instMat);
  }
  mainSeatInst.instanceMatrix.needsUpdate = true;
  mainSeatInst.computeBoundingSphere();
  sofa.add(mainSeatInst);

  // Layer 1: Chunky Rounded Outer Backrest Frame
  const outerBackrest = new THREE.Mesh(
    createPlushBox(3.34, 0.58, 0.155, 0.048, 0.11),
    sofaDarkMat
  );
  outerBackrest.position.set(0.0, 0.555, -0.425);
  outerBackrest.rotation.x = -0.055;
  outerBackrest.castShadow = true;
  outerBackrest.receiveShadow = true;
  outlines.addOutline(outerBackrest, 1.014);
  sofa.add(outerBackrest);

  // Layer 2: 3 Plump Rounded Tufted Back Cushions
  const backCushSpecs: [number, number][] = [
    [-0.99, 0.4],
    [0.0, 2.1],
    [0.99, 3.8],
  ];
  for (const [bx, seed] of backCushSpecs) {
    const backCushGroup = new THREE.Group();
    backCushGroup.position.set(bx, 0.745, -0.250);
    backCushGroup.rotation.x = -0.145;

    const backCushGeo = createPinchedTuftedBackCushionGeometry(0.96, 0.56, 0.235, seed, 0.016);
    const backCush = new THREE.Mesh(backCushGeo, sofaBackTuftMat);
    backCush.castShadow = true;
    backCush.receiveShadow = true;
    outlines.addOutline(backCush, 1.014);
    backCushGroup.add(backCush);

    const tuftCap = new THREE.Mesh(buttonTuftGeo, sofaButtonMat);
    tuftCap.position.set(0, 0, 0.108);
    backCushGroup.add(tuftCap);

    sofa.add(backCushGroup);
  }

  // Chunky, Plump & Rounded Left & Right Armrests (圆润敦实扶手)
  const leftArm = new THREE.Mesh(
    createPlushBox(0.21, 0.50, 1.02, 0.058, 0.16),
    sofaMat
  );
  leftArm.position.set(-1.59, 0.495, 0.02);
  leftArm.rotation.z = 0.032;
  leftArm.castShadow = true;
  leftArm.receiveShadow = true;
  outlines.addOutline(leftArm, 1.015);
  sofa.add(leftArm);

  const rightArm = new THREE.Mesh(
    createPlushBox(0.21, 0.50, 1.02, 0.058, 0.16),
    sofaMat
  );
  rightArm.position.set(1.59, 0.495, 0.02);
  rightArm.rotation.z = -0.032;
  rightArm.castShadow = true;
  rightArm.receiveShadow = true;
  outlines.addOutline(rightArm, 1.015);
  sofa.add(rightArm);

  // Gently Fluttering Christmas Reindeer & Snowflake Knit Tapestry Draped over the Large Sofa Backrest
  // (大沙发靠背圣诞节驯鹿雪花图案挂毯，挂在靠背上且下摆随微风轻轻飘动！)
  const sofaReindeerTapestryTex = (() => {
    const W = 512;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const tctx = c.getContext('2d')!;

    // 1) Cozy Nordic Crimson-Red Wool Knit Base
    tctx.fillStyle = '#b42937';
    tctx.fillRect(0, 0, W, H);

    // 2) Fair-Isle Pine-Green & Cream-Ivory Geometric Knit Bands (top crest, upper/lower borders)
    const drawBand = (y0: number, h: number, col: string) => {
      tctx.fillStyle = col;
      tctx.fillRect(0, y0, W, h);
    };
    drawBand(0, 38, '#28623d');
    drawBand(38, 14, '#f8f2e4');
    drawBand(116, 26, '#28623d');
    drawBand(142, 10, '#f8f2e4');
    drawBand(396, 10, '#f8f2e4');
    drawBand(406, 30, '#28623d');
    drawBand(436, 14, '#f8f2e4');
    drawBand(450, 34, '#b42937');

    // Cream Nordic diamonds marching along green bands
    tctx.fillStyle = '#f8f2e4';
    for (const by of [19, 129, 421]) {
      for (let x = 16; x < W; x += 32) {
        tctx.beginPath();
        tctx.moveTo(x, by - 8);
        tctx.lineTo(x + 8, by);
        tctx.lineTo(x, by + 8);
        tctx.lineTo(x - 8, by);
        tctx.closePath();
        tctx.fill();
      }
    }

    // Helper: 8-Pointed Nordic Snowflake
    const drawKnitSnowflake = (cx: number, cy: number, rad: number, col = '#fbf7ec', lw = 3.2) => {
      tctx.save();
      tctx.translate(cx, cy);
      tctx.strokeStyle = col;
      tctx.lineWidth = lw;
      tctx.lineCap = 'round';
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const rLen = a % 2 === 0 ? rad : rad * 0.78;
        tctx.beginPath();
        tctx.moveTo(0, 0);
        tctx.lineTo(dx * rLen, dy * rLen);
        tctx.stroke();
        if (a % 2 === 0) {
          const mx = dx * rLen * 0.58;
          const my = dy * rLen * 0.58;
          for (const sgn of [-1, 1]) {
            const ba = ang + sgn * 0.72;
            tctx.beginPath();
            tctx.moveTo(mx, my);
            tctx.lineTo(mx + Math.cos(ba) * rad * 0.30, my + Math.sin(ba) * rad * 0.30);
            tctx.stroke();
          }
        }
      }
      tctx.restore();
    };

    // Helper: Charming Stylized Prancing Christmas Reindeer Silhouette (圣诞驯鹿图案)
    const drawReindeer = (cx: number, cy: number, sc: number, flipX = 1) => {
      tctx.save();
      tctx.translate(cx, cy);
      tctx.scale(flipX * sc, sc);
      tctx.fillStyle = '#fbf6ea';
      tctx.strokeStyle = '#fbf6ea';
      tctx.lineCap = 'round';
      tctx.lineJoin = 'round';

      // Graceful arched torso
      tctx.beginPath();
      tctx.ellipse(0, 6, 28, 12, -0.06, 0, Math.PI * 2);
      tctx.fill();

      // Proud neck & head
      tctx.beginPath();
      tctx.moveTo(16, 2);
      tctx.quadraticCurveTo(28, -14, 30, -28);
      tctx.lineTo(44, -26);
      tctx.quadraticCurveTo(46, -20, 38, -17);
      tctx.quadraticCurveTo(32, -8, 25, 10);
      tctx.closePath();
      tctx.fill();

      // Cute ear & tiny fluffy tail
      tctx.beginPath();
      tctx.ellipse(27, -30, 5.5, 2.5, -0.7, 0, Math.PI * 2);
      tctx.fill();
      tctx.beginPath();
      tctx.ellipse(-28, -1, 6, 3.2, -0.5, 0, Math.PI * 2);
      tctx.fill();

      // Branching Antlers (驯鹿鹿角)
      tctx.lineWidth = 3.2;
      tctx.beginPath();
      tctx.moveTo(30, -28);
      tctx.quadraticCurveTo(22, -46, 12, -56);
      tctx.moveTo(22, -42);
      tctx.lineTo(28, -54);
      tctx.moveTo(18, -48);
      tctx.lineTo(8, -48);
      tctx.moveTo(33, -29);
      tctx.quadraticCurveTo(36, -45, 42, -55);
      tctx.moveTo(37, -43);
      tctx.lineTo(46, -46);
      tctx.stroke();

      // Four slender prancing legs
      tctx.lineWidth = 4.6;
      tctx.beginPath();
      // Front legs (one raised prancing, one planted)
      tctx.moveTo(19, 13);
      tctx.lineTo(28, 28);
      tctx.lineTo(35, 44);
      tctx.moveTo(14, 14);
      tctx.lineTo(10, 32);
      tctx.lineTo(14, 46);
      // Hind legs
      tctx.moveTo(-18, 12);
      tctx.lineTo(-27, 29);
      tctx.lineTo(-34, 45);
      tctx.moveTo(-13, 14);
      tctx.lineTo(-14, 32);
      tctx.lineTo(-19, 46);
      tctx.stroke();

      // Festive tiny pine-green scarf collar around reindeer's neck
      tctx.strokeStyle = '#2c7648';
      tctx.lineWidth = 4.5;
      tctx.beginPath();
      tctx.moveTo(19, -10);
      tctx.lineTo(31, -8);
      tctx.stroke();

      tctx.restore();
    };

    // Helper: Stylized Nordic Knit Pine Tree
    const drawKnitTree = (cx: number, cy: number, sc: number) => {
      tctx.save();
      tctx.translate(cx, cy);
      tctx.scale(sc, sc);
      tctx.fillStyle = '#2d7548';
      for (const [y0, w, h] of [
        [-30, 14, 18],
        [-16, 22, 20],
        [0, 30, 22],
      ]) {
        tctx.beginPath();
        tctx.moveTo(0, y0);
        tctx.lineTo(w, y0 + h);
        tctx.lineTo(-w, y0 + h);
        tctx.closePath();
        tctx.fill();
      }
      tctx.fillStyle = '#f8e096';
      tctx.beginPath();
      tctx.arc(0, -34, 4.5, 0, Math.PI * 2);
      tctx.fill();
      tctx.restore();
    };

    // Upper crest snowflakes (visible along top of sofa backrest)
    for (let i = 0; i < 6; i++) {
      drawKnitSnowflake(42 + i * 85, 82, 20, '#fbf6ea', 2.8);
    }

    // Center Showcase Band (Y = 152..396 -> hangs right across the back of the large sofa!)
    // 3 Prancing Christmas Reindeer + Nordic Snowflakes & Mini Pine Trees
    drawReindeer(112, 278, 1.05, 1);
    drawReindeer(256, 272, 1.18, -1);
    drawReindeer(400, 278, 1.05, 1);

    // Ornate snowflakes floating above & between the reindeer
    drawKnitSnowflake(52, 200, 22, '#fbf6ea', 2.8);
    drawKnitSnowflake(184, 198, 28, '#f8e3a2', 3.2);
    drawKnitSnowflake(328, 198, 28, '#f8e3a2', 3.2);
    drawKnitSnowflake(460, 200, 22, '#fbf6ea', 2.8);
    drawKnitSnowflake(184, 344, 18, '#fbf6ea', 2.4);
    drawKnitSnowflake(328, 344, 18, '#fbf6ea', 2.4);
    drawKnitTree(42, 344, 0.85);
    drawKnitTree(470, 344, 0.85);

    // 4-sided stitched blanket binding / whipstitch hem border (毛毯四周封边 + 锁边针脚，告别生硬直切边缘!)
    tctx.strokeStyle = '#f6efe0';
    tctx.lineWidth = 22;
    tctx.strokeRect(11, 11, W - 22, H - 22);
    tctx.strokeStyle = '#255a37';
    tctx.lineWidth = 8;
    tctx.strokeRect(24, 24, W - 48, H - 48);
    // Decorative whipstitch blanket-edge thread dashes around all 4 sides
    tctx.save();
    tctx.strokeStyle = '#b42937';
    tctx.lineWidth = 2.6;
    tctx.setLineDash([6, 6]);
    tctx.strokeRect(14, 14, W - 28, H - 28);
    tctx.restore();

    // Tactile wool-knit stitch micro-grain across entire tapestry
    for (let y = 0; y < H; y += 4) {
      tctx.fillStyle = y % 8 === 0 ? 'rgba(255, 250, 240, 0.08)' : 'rgba(52, 12, 18, 0.09)';
      tctx.fillRect(0, y, W, 1.5);
    }
    for (let x = 0; x < W; x += 4) {
      tctx.fillStyle = x % 8 === 0 ? 'rgba(255, 250, 240, 0.06)' : 'rgba(52, 12, 18, 0.07)';
      tctx.fillRect(x, 0, 1.5, H);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  })();

  // Negative windSway (-0.76) activates UV-anchored gentle cloth flutter (top locked safely above sofa, hem sways!)
  const sofaTapestryMat = mat({
    map: sofaReindeerTapestryTex,
    bumpMap: textures.plushBump,
    bumpScale: 0.016,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    rimScale: 1.28,
    side: THREE.DoubleSide,
    windSway: -0.76,
  });

  // Casually Crumpled & Diagonally Draped Throw Blanket over the Large Sofa Backrest
  // (胡乱折叠斜披在沙发靠背上的圣诞驯鹿毛毯：斜角垂坠 + 自然堆褶 + 圆润封边 + 严控安全间隙防穿模!)
  const tapestryCurvePts = [
    new THREE.Vector3(0, 0.78, -0.078),  // Casually draped down front-top of cushion (clear of cushion front!)
    new THREE.Vector3(0, 1.045, -0.175), // Rising smoothly over front shoulder with +2cm clearance
    new THREE.Vector3(0, 1.064, -0.295), // Resting loftily over top crest of backrest (zero clipping!)
    new THREE.Vector3(0, 0.992, -0.448), // Rounding over rear top shoulder
    new THREE.Vector3(0, 0.800, -0.538), // Casually cascading down upper-back
    new THREE.Vector3(0, 0.515, -0.556), // Mid-back loose rumpled hang
    new THREE.Vector3(0, 0.215, -0.568), // Free-hanging hem fluttering softly!
  ];
  const tapestryCurve = new THREE.CatmullRomCurve3(tapestryCurvePts);
  const tapSegU = 42;
  const tapSegV = 34;
  const tapGeo = new THREE.BufferGeometry();
  const tapPos: number[] = [];
  const tapUvs: number[] = [];
  const tapIndices: number[] = [];
  for (let iu = 0; iu <= tapSegU; iu++) {
    const t = iu / tapSegU; // 0 (front-top) -> 1 (rear hanging hem)
    const pt = tapestryCurve.getPoint(t);
    const uvY = t <= 0.38 ? 1.0 : THREE.MathUtils.clamp(1.0 - (t - 0.38) / 0.62, 0, 1);
    const hangT = THREE.MathUtils.smoothstep(t, 0.34, 1.0);

    // Diagonal skew across the backrest (starts left-of-center in front, drapes diagonally toward right-center in back!)
    const diagShiftX = THREE.MathUtils.lerp(-0.46, 0.36, Math.pow(t, 0.92)) + Math.sin(t * Math.PI * 1.4) * 0.08;
    // Organic bunched width: gathered narrower at the crest fold, flaring asymmetrically at the draped ends (not rectangular!)
    const localWidth = 1.24 - 0.24 * Math.sin(t * Math.PI) + 0.16 * Math.sin(t * Math.PI * 2.2);

    for (let iv = 0; iv <= tapSegV; iv++) {
      const s = iv / tapSegV; // 0..1 across width
      const sCentered = s - 0.5;

      // Softly rounded organic corners & wavy uneven edge silhouette (别那么四方四正!)
      const edgeProx = Math.max(0, (Math.abs(sCentered) - 0.34) / 0.16);
      const cornerRound = edgeProx * edgeProx * (Math.pow(1 - t, 3.0) + Math.pow(t, 3.0));
      const x = diagShiftX + sCentered * localWidth * (1.0 - cornerRound * 0.18);

      // Asymmetric diagonal hem drop (one corner hangs ~14cm lower than the other like a casually tossed throw!)
      const diagDropY = sCentered * 0.22 * (0.25 + 0.75 * hangT) + Math.sin(s * Math.PI * 3.2 + t * 2.8) * 0.024 * hangT;

      // Natural crumpled diagonal fold ridges + soft folded-over edge curl (all pushed outward >= 0 to prevent clipping!)
      const fold1 = Math.sin(s * Math.PI * 3.5 + t * 4.2) * 0.018;
      const fold2 = Math.cos(s * Math.PI * 6.0 - t * 3.1) * 0.010;
      const crestBunchY = (1.0 - hangT) * Math.max(0, fold1 + 0.012) * 0.85;
      const rearBillowZ = -(Math.abs(fold1) + Math.max(0, fold2) + 0.008) * hangT;
      // Soft rolled blanket-binding lip curl at left/right edges
      const edgeCurlOut = edgeProx * edgeProx * 0.012 * (hangT > 0.2 ? -1 : 1);

      tapPos.push(
        x,
        pt.y + diagDropY + crestBunchY,
        pt.z + rearBillowZ + edgeCurlOut * (hangT > 0.2 ? 1 : 0)
      );
      tapUvs.push(s, uvY);
    }
  }
  for (let iu = 0; iu < tapSegU; iu++) {
    for (let iv = 0; iv < tapSegV; iv++) {
      const a = iu * (tapSegV + 1) + iv;
      const b = a + 1;
      const cIdx = a + (tapSegV + 1);
      const d = cIdx + 1;
      tapIndices.push(a, cIdx, b, b, cIdx, d);
    }
  }
  tapGeo.setAttribute('position', new THREE.Float32BufferAttribute(tapPos, 3));
  tapGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tapUvs, 2));
  tapGeo.setIndex(tapIndices);
  tapGeo.computeVertexNormals();

  // Casually Folded-Over Second Layer Flap tucked diagonally across the top-left shoulder of the throw (自然叠褶层次!)
  const foldFlapPts = [
    new THREE.Vector3(0, 1.072, -0.255),
    new THREE.Vector3(0, 1.028, -0.435),
    new THREE.Vector3(0, 0.825, -0.558),
    new THREE.Vector3(0, 0.565, -0.578),
  ];
  const foldFlapCurve = new THREE.CatmullRomCurve3(foldFlapPts);
  const ffGeo = new THREE.BufferGeometry();
  const ffPos: number[] = [];
  const ffUvs: number[] = [];
  const ffIdx: number[] = [];
  const ffU = 20;
  const ffV = 16;
  for (let iu = 0; iu <= ffU; iu++) {
    const t = iu / ffU;
    const pt = foldFlapCurve.getPoint(t);
    const uvY = THREE.MathUtils.clamp(1.0 - t * 0.85, 0.15, 1.0);
    const centerX = THREE.MathUtils.lerp(-0.56, -0.18, t);
    const w = THREE.MathUtils.lerp(0.46, 0.30, t);
    for (let iv = 0; iv <= ffV; iv++) {
      const s = iv / ffV;
      const sc = s - 0.5;
      const waveZ = -Math.abs(Math.sin(s * Math.PI * 2.5 + t * 3.0)) * 0.014;
      ffPos.push(centerX + sc * w, pt.y + sc * 0.12 * t, pt.z + waveZ);
      ffUvs.push(s * 0.65, uvY);
    }
  }
  for (let iu = 0; iu < ffU; iu++) {
    for (let iv = 0; iv < ffV; iv++) {
      const a = iu * (ffV + 1) + iv;
      const b = a + 1;
      const cIdx = a + (ffV + 1);
      const d = cIdx + 1;
      ffIdx.push(a, cIdx, b, b, cIdx, d);
    }
  }
  ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(ffPos, 3));
  ffGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ffUvs, 2));
  ffGeo.setIndex(ffIdx);
  ffGeo.computeVertexNormals();

  // Merge main diagonally-draped throw + folded top-left flap into ONE single animated mesh (1 draw call!)
  const mergedThrowGeo = BufferGeometryUtils.mergeGeometries([tapGeo, ffGeo], false)!;
  const reindeerTapestryMesh = new THREE.Mesh(mergedThrowGeo, sofaTapestryMat);
  reindeerTapestryMesh.castShadow = false;
  reindeerTapestryMesh.receiveShadow = true;
  reindeerTapestryMesh.userData.dynamic = true;
  sofa.add(reindeerTapestryMesh);

  // Casually Draped Light-Brown Plush Fleece Throw Blanket over the Right Sofa Armrest (淡棕色慵懒毛绒盖毯)
  const throwBlanketMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.018,
    color: 0xcfa986,
    roughness: 0.94,
    metalness: 0.0,
    rimScale: 1.42,
    side: THREE.DoubleSide,
  });
  const blanketCurvePts = [
    new THREE.Vector3(1.24, 0.515, 0.12),   // Casually pooled on the right seat cushion
    new THREE.Vector3(1.42, 0.565, 0.14),   // Climbing gently up inner armrest slope
    new THREE.Vector3(1.52, 0.745, 0.10),   // Softly cresting inner top shoulder of armrest
    new THREE.Vector3(1.62, 0.768, 0.08),   // Resting plushly over armrest crown
    new THREE.Vector3(1.725, 0.710, 0.06),  // Rounding down outer shoulder of armrest
    new THREE.Vector3(1.750, 0.460, 0.05),  // Cascading lazily down outer side of sofa
    new THREE.Vector3(1.762, 0.220, 0.04),  // Hanging soft hem just above plinth
  ];
  const blanketCurve = new THREE.CatmullRomCurve3(blanketCurvePts);
  const blanketSegU = 36;
  const blanketSegV = 18;
  const blanketWidth = 0.64;
  const blanketGeo = new THREE.BufferGeometry();
  const bPositions: number[] = [];
  const bUvs: number[] = [];
  const bIndices: number[] = [];

  for (let iu = 0; iu <= blanketSegU; iu++) {
    const u = iu / blanketSegU;
    const centerPt = blanketCurve.getPoint(u);
    const tangent = blanketCurve.getTangent(u);
    // Outward normal in XY plane (perpendicular to curve tangent & Z axis)
    const nx = -tangent.y;
    const ny = tangent.x;
    for (let iv = 0; iv <= blanketSegV; iv++) {
      const v = iv / blanketSegV;
      // Casual diagonal drape skew + soft organic folded fabric waves along the blanket!
      const skewZ = (u - 0.45) * 0.09;
      const localZ = (v - 0.5) * blanketWidth * (0.94 + 0.12 * Math.sin(u * Math.PI)) + skewZ;
      const ripple =
        Math.sin(v * Math.PI * 5.0 + u * 3.5) * 0.012 * (0.4 + 0.6 * Math.sin(u * Math.PI)) +
        Math.cos(v * Math.PI * 3.0 - u * 4.0) * 0.008;
      const thickOff = 0.008 + ripple;
      bPositions.push(
        centerPt.x + nx * thickOff,
        centerPt.y + ny * thickOff,
        centerPt.z + localZ
      );
      bUvs.push(u * 2.2, v * 1.4);
    }
  }
  for (let iu = 0; iu < blanketSegU; iu++) {
    for (let iv = 0; iv < blanketSegV; iv++) {
      const a = iu * (blanketSegV + 1) + iv;
      const b = (iu + 1) * (blanketSegV + 1) + iv;
      const c = (iu + 1) * (blanketSegV + 1) + (iv + 1);
      const d = iu * (blanketSegV + 1) + (iv + 1);
      bIndices.push(a, b, d, b, c, d);
    }
  }
  blanketGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPositions, 3));
  blanketGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bUvs, 2));
  blanketGeo.setIndex(bIndices);
  blanketGeo.computeVertexNormals();

  const drapedBlanket = new THREE.Mesh(blanketGeo, throwBlanketMat);
  drapedBlanket.castShadow = true;
  drapedBlanket.receiveShadow = true;
  outlines.addOutline(drapedBlanket, 1.012);
  sofa.add(drapedBlanket);

  // Soft cream-camel knotted tassel fringes along the hanging outer hem of the throw blanket
  const blanketFringeMat = mat({ color: 0xe6d2bc, roughness: 0.94 });
  for (let tf = 0; tf < 14; tf++) {
    const fz = 0.08 + ((tf / 13) - 0.5) * 0.60;
    const tassel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.0035, 0.068, 6),
      blanketFringeMat
    );
    tassel.position.set(1.762, 0.186, fz);
    tassel.rotation.x = ((tf % 3) - 1) * 0.08;
    sofa.add(tassel);
  }

  // Layer 3: Colorful Macaron Throw Pillows (跳色点缀抱枕) nestled across the straight 3-seater
  const pillowGeoA = createPinchedPlumpPillowGeometry(0.42, 0.39, 0.165, 0.5);
  const pillowGeoB = createPinchedPlumpPillowGeometry(0.38, 0.36, 0.155, 2.1);
  const pillowGeoC = createPinchedPlumpPillowGeometry(0.41, 0.38, 0.160, 3.7);
  const pillowGeoD = createPinchedPlumpPillowGeometry(0.36, 0.34, 0.148, 5.2);

  // 1) Left Armrest Corner: Sakura Pink plump pillow
  const leftCornerCreamPillow = new THREE.Mesh(pillowGeoA, sofaCreamPillowMat);
  leftCornerCreamPillow.position.set(-1.26, 0.655, 0.02);
  leftCornerCreamPillow.rotation.set(-0.24, 0.48, 0.15);
  leftCornerCreamPillow.castShadow = true;
  leftCornerCreamPillow.receiveShadow = true;
  outlines.addOutline(leftCornerCreamPillow, 1.016);
  sofa.add(leftCornerCreamPillow);

  // 2) Left-of-Center Accent: Sky-Blue macaron pillow slumped casually forward
  const leftAccentPillow = new THREE.Mesh(pillowGeoD, sofaIcePillowMat);
  leftAccentPillow.position.set(-0.78, 0.615, 0.12);
  leftAccentPillow.rotation.set(-0.36, 0.22, -0.14);
  leftAccentPillow.castShadow = true;
  leftAccentPillow.receiveShadow = true;
  outlines.addOutline(leftAccentPillow, 1.016);
  sofa.add(leftAccentPillow);

  // 3) Center-Right Accent: Signature Mint Green Gingham pillow
  const ginghamCenterPillow = new THREE.Mesh(pillowGeoC, ginghamPillowMat);
  ginghamCenterPillow.position.set(0.56, 0.650, 0.01);
  ginghamCenterPillow.rotation.set(-0.24, -0.18, 0.10);
  ginghamCenterPillow.castShadow = true;
  ginghamCenterPillow.receiveShadow = true;
  outlines.addOutline(ginghamCenterPillow, 1.016);
  sofa.add(ginghamCenterPillow);

  // 4) Right Armrest Inner Corner: Warm Butter-Lemon + Coral-Peach color-pop pillows
  const rightCornerCreamPillow = new THREE.Mesh(pillowGeoB, sofaLemonPillowMat);
  rightCornerCreamPillow.position.set(1.22, 0.655, -0.01);
  rightCornerCreamPillow.rotation.set(-0.22, -0.50, -0.16);
  rightCornerCreamPillow.castShadow = true;
  rightCornerCreamPillow.receiveShadow = true;
  outlines.addOutline(rightCornerCreamPillow, 1.016);
  sofa.add(rightCornerCreamPillow);

  const rightCoralPillow = new THREE.Mesh(pillowGeoD, sofaCoralPillowMat);
  rightCoralPillow.position.set(0.96, 0.605, 0.13);
  rightCoralPillow.rotation.set(-0.38, -0.26, 0.12);
  rightCoralPillow.castShadow = true;
  rightCoralPillow.receiveShadow = true;
  outlines.addOutline(rightCoralPillow, 1.016);
  sofa.add(rightCoralPillow);

  // Playful Comical Children's Plastic Toy Gun resting visibly on the far-north sofa cushion (isolated from co-sit zone)
  const toyGunRig = buildToyGunMesh(ctx.uniforms, outlines, { isViewModel: false });
  const toyGunWorld = toyGunRig.group;
  // Sofa is at (2.38, 0, -5.25), rotY = +PI/2 (local +Z -> world +X, local +X -> world -Z).
  // Place on the far north cushion (Z = -6.42) so its pickup hitbox stays cleanly separated from the co-sit zone.
  toyGunWorld.position.set(2.68, 0.556, -6.42);
  toyGunWorld.rotation.set(0.05, 0.48, Math.PI / 2 - 0.12);
  toyGunWorld.scale.setScalar(1.08);
  toyGunWorld.userData.dynamic = true;
  // Comfortable invisible hit-proxy strictly on the north cushion around the toy gun (Z ≈ -6.66..-6.20),
  // cleanly separated by >0.50m from the south/center sofa sit zone!
  const toyGunHitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.34, 0.48),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  toyGunHitProxy.position.set(0, 0.02, -0.04);
  toyGunWorld.add(toyGunHitProxy);
  group.add(toyGunWorld);
  metaState.toyGunWorldMesh = toyGunWorld;

  registerInteractable(
    'item_toy_gun',
    '儿童塑料玩具枪',
    '收纳进背包',
    'living',
    toyGunWorld,
    () => ({
      title: '已收纳：儿童塑料玩具枪',
      message: '已放进背包！按 B 查看背包，按 Q 快速装备，按 X 切换弹药。',
      pickupItemId: 'toy_gun',
    })
  );

  // InstancedMesh for 6 Sturdy Tapered Oak Legs under Straight 3-Seater Sofa
  const sofaLegGeo = createTurnedLegGeometry(0.025, 0.015, 0.135);
  const sofaLegsInst = new THREE.InstancedMesh(sofaLegGeo, darkOakMat, 6);
  const sofaLocalOrigin = new THREE.Vector3(0, 0, 0);
  const sofaLegCoords: [number, number][] = [
    [-1.56, -0.40],
    [0.0, -0.40],
    [1.56, -0.40],
    [-1.56, 0.42],
    [0.0, 0.42],
    [1.56, 0.42],
  ];
  for (let i = 0; i < sofaLegCoords.length; i++) {
    const [lx, lz] = sofaLegCoords[i];
    sofaLegsInst.setMatrixAt(
      i,
      composeSplayedLegMatrix(lx, 0.126, lz, 0.135, 0.15, 0.14, sofaLocalOrigin)
    );
  }
  sofaLegsInst.instanceMatrix.needsUpdate = true;
  sofaLegsInst.computeBoundingSphere();
  sofa.add(sofaLegsInst);

  // Invisible sit hit-proxy covering ONLY the south/center cushions (world Z in [-5.705, -3.955]),
  // leaving a wide >0.50m dead-zone gap before the toy gun at world Z = -6.42.
  const sofaSitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.72, 0.94),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
    })
  );
  sofaSitProxy.position.set(-0.42, 0.56, 0.02);
  sofa.add(sofaSitProxy);

  group.add(sofa);
  addBoxCollider('col_sofa_main', 2.34, 0.54, -5.25, 1.06, 1.06, 3.62);

  registerInteractable(
    'living_sofa',
    '客厅沙发',
    '一起坐到沙发上',
    'living',
    sofaSitProxy,
    () => undefined
  );

  // =========================================================================
  // 8B. TWO-TIER WOODEN SOFA END TABLE + LIME-GREEN ARTICULATED DESK LAMP
  //     + PLUMP WHITE TUFTED ARMCHAIR & STRIPED FLOOR LAMP + SPLIT AC UNIT
  //     (Directly modeled after MiSide Reference Screenshots 3 & 5!)
  // =========================================================================
  // 1) Two-Tier Oak End Table beside Sofa with Green Articulated Desk Lamp (Screenshot 5)
  const endTable = new THREE.Group();
  endTable.position.set(2.34, 0, -7.52);
  const etTop = new THREE.Mesh(
    createBeveledSlab(0.58, 0.038, 0.58, 0.062, 0.013),
    oakMat
  );
  etTop.position.y = 0.582;
  etTop.castShadow = true;
  etTop.receiveShadow = true;
  outlines.addOutline(etTop, 1.02);
  endTable.add(etTop);

  const etShelf = new THREE.Mesh(
    createBeveledSlab(0.46, 0.024, 0.46, 0.028, 0.006),
    oakMat
  );
  etShelf.position.y = 0.24;
  etShelf.castShadow = true;
  etShelf.receiveShadow = true;
  endTable.add(etShelf);

  const etLegGeo = createTurnedLegGeometry(0.020, 0.013, 0.565);
  for (const [lx, lz] of [
    [-0.20, -0.20],
    [0.20, -0.20],
    [-0.20, 0.20],
    [0.20, 0.20],
  ] as const) {
    const leg = new THREE.Mesh(etLegGeo, darkOakMat);
    leg.position.set(lx, 0.285, lz);
    leg.castShadow = true;
    endTable.add(leg);
  }
  // Matte linen storage box with lid on lower shelf + printed hardcover book on top tier
  const etStorageBox = new THREE.Mesh(
    createBeveledBox(0.28, 0.13, 0.30, 0.008, 2),
    shelfWhiteBoxMat
  );
  etStorageBox.position.set(0, 0.317, 0);
  etStorageBox.castShadow = true;
  endTable.add(etStorageBox);
  const etStorageLid = new THREE.Mesh(
    createBeveledBox(0.29, 0.020, 0.31, 0.004, 2),
    oakMat
  );
  etStorageLid.position.set(0, 0.388, 0);
  endTable.add(etStorageLid);

  const etMagazine = new THREE.Mesh(
    createBookGeometry(0.22, 0.024, 0.28, 5),
    bookAtlasMat
  );
  etMagazine.position.set(0.08, 0.606, 0.08);
  etMagazine.rotation.y = 0.24;
  endTable.add(etMagazine);

  // 1A) Anime Cel-Shaded Vintage Ceramic Gourd & Pleated Linen Empire Table Lamp (动漫画风百褶布艺陶瓷台灯)
  {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(-0.08, 0.601, -0.08);

    // Soft matte-satin anime celadon ceramic & warm stylized anime gold (柔和动漫画风低反光)
    const lampCeramicMat = mat({
      color: 0xa2ccb0,
      roughness: 0.76,
      metalness: 0.0,
      celStrength: 0.66,
      rimScale: 1.38,
    });
    const animeGoldMat = mat({
      color: 0xe6c178,
      roughness: 0.62,
      metalness: 0.22,
      celStrength: 0.62,
      rimScale: 1.30,
    });
    // Stepped warm-gold pedestal foot
    const footPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.068, 0.0),
      new THREE.Vector2(0.066, 0.012),
      new THREE.Vector2(0.056, 0.022),
      new THREE.Vector2(0.048, 0.028),
    ];
    const lampFoot = new THREE.Mesh(new THREE.LatheGeometry(footPts, 24), animeGoldMat);
    lampFoot.castShadow = true;
    outlines.addOutline(lampFoot, 1.022);
    lampGroup.add(lampFoot);

    // Sculpted ceramic gourd vase body
    const vasePts = [
      new THREE.Vector2(0.046, 0.026),
      new THREE.Vector2(0.066, 0.056),
      new THREE.Vector2(0.076, 0.098),
      new THREE.Vector2(0.068, 0.142),
      new THREE.Vector2(0.042, 0.178),
      new THREE.Vector2(0.026, 0.204),
      new THREE.Vector2(0.030, 0.218),
    ];
    const lampVase = new THREE.Mesh(new THREE.LatheGeometry(vasePts, 28), lampCeramicMat);
    lampVase.castShadow = true;
    lampVase.receiveShadow = true;
    outlines.addOutline(lampVase, 1.024);
    lampGroup.add(lampVase);

    // Neck collar, socket stem & delicate pull-chain switch
    const neckCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.030, 0.026, 18),
      animeGoldMat
    );
    neckCollar.position.y = 0.228;
    lampGroup.add(neckCollar);

    const socketStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.016, 0.072, 14),
      animeGoldMat
    );
    socketStem.position.y = 0.274;
    lampGroup.add(socketStem);

    // Delicate pull-chain hanging just under the pleated shade
    const pullChain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, 0.078, 6),
      animeGoldMat
    );
    pullChain.position.set(0.032, 0.226, 0.026);
    lampGroup.add(pullChain);
    const pullDrop = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 8), animeGoldMat);
    pullDrop.position.set(0.032, 0.184, 0.026);
    lampGroup.add(pullDrop);

    // Warm-ivory pleated linen empire lampshade (24 crisp radial fabric pleats!)
    const shadePts = [
      new THREE.Vector2(0.142, 0.242),
      new THREE.Vector2(0.130, 0.285),
      new THREE.Vector2(0.114, 0.335),
      new THREE.Vector2(0.096, 0.382),
      new THREE.Vector2(0.080, 0.416),
    ];
    const pleatedShadeGeo = new THREE.LatheGeometry(shadePts, 72);
    const sp = pleatedShadeGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const vx = sp.getX(i);
      const vz = sp.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r > 0.01) {
        const ang = Math.atan2(vz, vx);
        const pleat = Math.cos(ang * 24) * 0.0046;
        const sc = (r + pleat) / r;
        sp.setX(i, vx * sc);
        sp.setZ(i, vz * sc);
      }
    }
    pleatedShadeGeo.computeVertexNormals();

    const lampShadeMat = mat({
      map: textures.plushFabric,
      color: 0xfff6e6,
      emissive: new THREE.Color(0xffe6bc),
      emissiveIntensity: 0.22,
      roughness: 0.92,
      metalness: 0.0,
      celStrength: 0.58,
      side: THREE.DoubleSide,
    });
    const lampShade = new THREE.Mesh(pleatedShadeGeo, lampShadeMat);
    lampShade.castShadow = true;
    outlines.addOutline(lampShade, 1.022);
    lampGroup.add(lampShade);

    // Top & bottom warm-sage braided fabric trim piping rings
    const pipingMat = mat({ color: 0x7fa286, roughness: 0.88, metalness: 0.0, celStrength: 0.62 });
    const botTrim = new THREE.Mesh(new THREE.TorusGeometry(0.142, 0.0045, 8, 36), pipingMat);
    botTrim.rotation.x = Math.PI / 2;
    botTrim.position.y = 0.242;
    lampGroup.add(botTrim);
    const topTrim = new THREE.Mesh(new THREE.TorusGeometry(0.080, 0.004, 8, 32), pipingMat);
    topTrim.rotation.x = Math.PI / 2;
    topTrim.position.y = 0.416;
    lampGroup.add(topTrim);

    // Warm-white inner glowing bulb + brass spider & turned top finial
    const lampBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xfff6e4 })
    );
    lampBulb.position.y = 0.318;
    lampGroup.add(lampBulb);

    const finialPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.006, 0.036, 10),
      animeGoldMat
    );
    finialPost.position.y = 0.422;
    lampGroup.add(finialPost);
    const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), animeGoldMat);
    finialBall.position.y = 0.442;
    lampGroup.add(finialBall);

    endTable.add(lampGroup);
  }

  // 1B) Anime Cel-Shaded Pastel Ceramic Coffee Mug with C-Handle, Latte Heart Art & Wood Coaster (动漫画风马克杯)
  {
    const mugGroup = new THREE.Group();
    mugGroup.position.set(-0.12, 0.601, 0.13);
    mugGroup.rotation.y = 0.68;

    // Turned recessed walnut-oak coaster
    const coasterPts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.050, 0.0),
      new THREE.Vector2(0.052, 0.008),
      new THREE.Vector2(0.046, 0.009),
      new THREE.Vector2(0.044, 0.005),
      new THREE.Vector2(0.0, 0.005),
    ];
    const etCoaster = new THREE.Mesh(new THREE.LatheGeometry(coasterPts, 24), darkOakMat);
    etCoaster.receiveShadow = true;
    mugGroup.add(etCoaster);

    // Soft pastel anime dipped-ceramic glaze texture
    const mugTex = (() => {
      const mc = document.createElement('canvas');
      mc.width = 256;
      mc.height = 128;
      const mctx = mc.getContext('2d')!;
      mctx.fillStyle = '#fff7f8';
      mctx.fillRect(0, 0, 256, 128);
      // Soft sakura-rose lower dipped glaze band + subtle warm gold stripe
      const dip = mctx.createLinearGradient(0, 68, 0, 128);
      dip.addColorStop(0.0, '#f8c4d4');
      dip.addColorStop(1.0, '#efa5bc');
      mctx.fillStyle = dip;
      mctx.fillRect(0, 72, 256, 56);
      mctx.fillStyle = '#e2be76';
      mctx.fillRect(0, 6, 256, 5);
      mctx.fillStyle = '#e2be76';
      mctx.fillRect(0, 69, 256, 3);
      const tex = new THREE.CanvasTexture(mc);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const mugCeramicMat = mat({
      map: mugTex,
      color: 0xffffff,
      roughness: 0.74,
      metalness: 0.0,
      celStrength: 0.68,
      rimScale: 1.38,
    });
    const mugInnerMat = mat({
      color: 0xfffaf6,
      roughness: 0.78,
      metalness: 0.0,
      celStrength: 0.64,
    });

    // Sculpted ceramic mug body with footed base & rolled lip
    const mugOuterPts = [
      new THREE.Vector2(0.0, 0.005),
      new THREE.Vector2(0.031, 0.005),
      new THREE.Vector2(0.034, 0.014),
      new THREE.Vector2(0.039, 0.044),
      new THREE.Vector2(0.040, 0.076),
      new THREE.Vector2(0.041, 0.088),
      new THREE.Vector2(0.037, 0.091),
      new THREE.Vector2(0.034, 0.088),
    ];
    const mugOuter = new THREE.Mesh(new THREE.LatheGeometry(mugOuterPts, 28), mugCeramicMat);
    mugOuter.castShadow = true;
    mugOuter.receiveShadow = true;
    outlines.addOutline(mugOuter, 1.028);
    mugGroup.add(mugOuter);

    const mugInnerPts = [
      new THREE.Vector2(0.034, 0.088),
      new THREE.Vector2(0.033, 0.054),
      new THREE.Vector2(0.029, 0.016),
      new THREE.Vector2(0.0, 0.014),
    ];
    const mugInner = new THREE.Mesh(new THREE.LatheGeometry(mugInnerPts, 24), mugInnerMat);
    mugGroup.add(mugInner);

    // Sculpted ergonomic C-curved ceramic handle with crisp anime outline
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.038, 0.074, 0),
      new THREE.Vector3(0.058, 0.072, 0),
      new THREE.Vector3(0.064, 0.048, 0),
      new THREE.Vector3(0.056, 0.026, 0),
      new THREE.Vector3(0.035, 0.024, 0),
    ]);
    const mugHandle = new THREE.Mesh(
      new THREE.TubeGeometry(handleCurve, 18, 0.0054, 10, false),
      mugInnerMat
    );
    mugHandle.castShadow = true;
    outlines.addOutline(mugHandle, 1.03);
    mugGroup.add(mugHandle);

    // Warm cappuccino coffee surface with cute cream foam heart latte art
    const latteTex = (() => {
      const lc = document.createElement('canvas');
      lc.width = 128;
      lc.height = 128;
      const lctx = lc.getContext('2d')!;
      const bg = lctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      bg.addColorStop(0.0, '#a46b44');
      bg.addColorStop(0.75, '#865230');
      bg.addColorStop(1.0, '#683b20');
      lctx.fillStyle = bg;
      lctx.fillRect(0, 0, 128, 128);
      lctx.fillStyle = '#fff6e8';
      lctx.beginPath();
      lctx.moveTo(64, 86);
      lctx.bezierCurveTo(34, 64, 34, 38, 52, 38);
      lctx.bezierCurveTo(60, 38, 64, 46, 64, 50);
      lctx.bezierCurveTo(64, 46, 68, 38, 76, 38);
      lctx.bezierCurveTo(94, 38, 94, 64, 64, 86);
      lctx.fill();
      const tex = new THREE.CanvasTexture(lc);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const coffeeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.0335, 22),
      mat({ map: latteTex, roughness: 0.78, metalness: 0.0, celStrength: 0.56 })
    );
    coffeeDisc.rotation.x = -Math.PI / 2;
    coffeeDisc.position.y = 0.074;
    mugGroup.add(coffeeDisc);

    endTable.add(mugGroup);
  }

  // 1C) Anime Cel-Shaded Pastel Mint Twin-Bell Alarm Clock (动漫画风复古双铃闹钟)
  {
    const clockGroup = new THREE.Group();
    clockGroup.position.set(0.14, 0.601, -0.11);
    clockGroup.rotation.y = -0.52;

    const clockEnamelMat = mat({
      color: 0x97dec5,
      roughness: 0.72,
      metalness: 0.04,
      celStrength: 0.68,
      rimScale: 1.38,
    });
    const clockGoldMat = mat({
      color: 0xe8c47a,
      roughness: 0.58,
      metalness: 0.24,
      celStrength: 0.62,
      rimScale: 1.30,
    });

    // Twin angled brass ball feet resting cleanly at Y = 0
    for (const fx of [-0.028, 0.028]) {
      const footStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.004, 0.004, 0.016, 8),
        clockGoldMat
      );
      footStem.position.set(fx, 0.012, 0);
      footStem.rotation.z = fx < 0 ? 0.34 : -0.34;
      clockGroup.add(footStem);
      const footBall = new THREE.Mesh(new THREE.SphereGeometry(0.0068, 10, 8), clockGoldMat);
      footBall.position.set(fx * 1.12, 0.0068, 0);
      clockGroup.add(footBall);
    }

    // Round pastel-mint drum casing (center at Y = 0.056, radius = 0.046)
    const clockDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.046, 0.034, 28),
      clockEnamelMat
    );
    clockDrum.rotation.x = Math.PI / 2;
    clockDrum.position.set(0, 0.056, 0);
    clockDrum.castShadow = true;
    outlines.addOutline(clockDrum, 1.028);
    clockGroup.add(clockDrum);

    // Warm stylized gold front bezel ring
    const clockBezel = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.0046, 10, 32),
      clockGoldMat
    );
    clockBezel.position.set(0, 0.056, 0.017);
    clockGroup.add(clockBezel);

    // Crisp 256x256 printed anime analog dial face
    const dialTex = (() => {
      const dc = document.createElement('canvas');
      dc.width = 256;
      dc.height = 256;
      const dctx = dc.getContext('2d')!;
      dctx.fillStyle = '#fffcf4';
      dctx.fillRect(0, 0, 256, 256);
      dctx.strokeStyle = '#4a403a';
      dctx.lineWidth = 4;
      dctx.beginPath();
      dctx.arc(128, 128, 114, 0, Math.PI * 2);
      dctx.stroke();

      // Minute & hour tick marks
      for (let t = 0; t < 60; t++) {
        const a = (t / 60) * Math.PI * 2 - Math.PI / 2;
        const isHour = t % 5 === 0;
        const r1 = isHour ? 96 : 104;
        const r2 = 112;
        dctx.strokeStyle = isHour ? '#3a322e' : '#8e847c';
        dctx.lineWidth = isHour ? 4.4 : 1.8;
        dctx.beginPath();
        dctx.moveTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1);
        dctx.lineTo(128 + Math.cos(a) * r2, 128 + Math.sin(a) * r2);
        dctx.stroke();
      }
      // Crisp Arabic numerals 1..12
      dctx.fillStyle = '#3a322e';
      dctx.font = 'bold 26px "M PLUS Rounded 1c", sans-serif';
      dctx.textAlign = 'center';
      dctx.textBaseline = 'middle';
      for (let h = 1; h <= 12; h++) {
        const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
        dctx.fillText(String(h), 128 + Math.cos(a) * 76, 128 + Math.sin(a) * 78);
      }
      const tex = new THREE.CanvasTexture(dc);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const dialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.042, 28),
      mat({ map: dialTex, roughness: 0.88, metalness: 0.0, celStrength: 0.45 })
    );
    dialFace.position.set(0, 0.056, 0.0176);
    clockGroup.add(dialFace);

    // 3D Hour, Minute & Coral-Red Second Hands + Gold Center Pin
    const handDarkMat = mat({ color: 0x383238, roughness: 0.72, metalness: 0.08, celStrength: 0.60 });
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.0038, 0.022, 0.0018), handDarkMat);
    hourHand.position.set(-0.006, 0.062, 0.0195);
    hourHand.rotation.z = 0.65;
    clockGroup.add(hourHand);

    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.0030, 0.032, 0.0018), handDarkMat);
    minHand.position.set(0.008, 0.066, 0.0202);
    minHand.rotation.z = -0.58;
    clockGroup.add(minHand);

    const secHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.0016, 0.034, 0.0014),
      mat({ color: 0xe25858, roughness: 0.72, metalness: 0.0, celStrength: 0.58 })
    );
    secHand.position.set(-0.004, 0.046, 0.0208);
    secHand.rotation.z = 2.45;
    clockGroup.add(secHand);

    const centerPin = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 8), clockGoldMat);
    centerPin.position.set(0, 0.056, 0.0212);
    clockGroup.add(centerPin);

    // Twin stylized anime gold bells on slender stems + center hammer + top arched carrying loop
    for (const bs of [-1, 1]) {
      const ang = bs * 0.64;
      const bellPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0024, 0.0024, 0.018, 8),
        clockGoldMat
      );
      bellPost.position.set(Math.sin(ang) * 0.049, 0.056 + Math.cos(ang) * 0.049, 0);
      bellPost.rotation.z = -ang;
      clockGroup.add(bellPost);

      const bell = new THREE.Mesh(
        new THREE.SphereGeometry(0.0175, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
        clockGoldMat
      );
      bell.position.set(Math.sin(ang) * 0.050, 0.056 + Math.cos(ang) * 0.050, 0);
      bell.rotation.z = -ang;
      bell.castShadow = true;
      outlines.addOutline(bell, 1.032);
      clockGroup.add(bell);
    }

    // Center hammer & arched top carrying handle
    const hammerStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0020, 0.0020, 0.018, 6),
      clockGoldMat
    );
    hammerStem.position.set(0, 0.109, 0);
    clockGroup.add(hammerStem);
    const hammerHead = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 8, 8), clockGoldMat);
    hammerHead.position.set(0, 0.119, 0);
    clockGroup.add(hammerHead);

    const topLoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.0024, 8, 20, Math.PI),
      clockGoldMat
    );
    topLoop.position.set(0, 0.102, 0);
    clockGroup.add(topLoop);

    endTable.add(clockGroup);
  }

  group.add(endTable);
  addBoxCollider('col_liv_end_table', 2.34, 0.42, -7.52, 0.60, 0.84, 0.60);

  // 2) Plump White Tufted Armchair + Curved-Stem Striped Floor Lamp (Screenshot 3)
  const armchair = new THREE.Group();
  armchair.position.set(1.15, 0, -9.12);
  armchair.rotation.y = 0.52;

  const acPlinth = new THREE.Mesh(
    createBeveledSlab(0.96, 0.044, 0.92, 0.032, 0.010),
    oakMat
  );
  acPlinth.position.y = 0.145;
  acPlinth.castShadow = true;
  acPlinth.receiveShadow = true;
  outlines.addOutline(acPlinth, 1.018);
  armchair.add(acPlinth);

  for (const [lx, lz] of [
    [-0.38, -0.36],
    [0.38, -0.36],
    [-0.38, 0.36],
    [0.38, 0.36],
  ] as const) {
    const leg = new THREE.Mesh(sofaLegGeo, darkOakMat);
    leg.position.set(lx, 0.07, lz);
    armchair.add(leg);
  }

  // Outer wrap-around upholstered back shell (靠背) + top head-roll bolster of the White Tufted Armchair (Screenshot 4!)
  const acOuterBackShell = new THREE.Mesh(
    createPlushBox(0.92, 0.78, 0.16, 0.042, 0.10),
    sofaDarkMat
  );
  acOuterBackShell.position.set(0, 0.56, -0.37);
  acOuterBackShell.rotation.x = -0.08;
  acOuterBackShell.castShadow = true;
  acOuterBackShell.receiveShadow = true;
  outlines.addOutline(acOuterBackShell, 1.018);
  armchair.add(acOuterBackShell);

  const acHeadRoll = new THREE.Mesh(
    createPlushBox(0.68, 0.12, 0.15, 0.036, 0.12),
    sofaMat
  );
  acHeadRoll.position.set(0, 0.92, -0.39);
  acHeadRoll.rotation.x = -0.10;
  acHeadRoll.castShadow = true;
  outlines.addOutline(acHeadRoll, 1.02);
  armchair.add(acHeadRoll);

  const acSeat = new THREE.Mesh(
    createPlushBox(0.68, 0.22, 0.76, 0.052, 0.15),
    sofaMat
  );
  acSeat.position.set(0, 0.34, 0.04);
  acSeat.castShadow = true;
  acSeat.receiveShadow = true;
  outlines.addOutline(acSeat, 1.018);
  armchair.add(acSeat);

  // Pillow-sculpted tufted back cushion (靠垫) nestled between back and outer shell, reclining gently backward
  const acBackGroup = new THREE.Group();
  acBackGroup.position.set(0, 0.64, -0.22);
  acBackGroup.rotation.x = -0.14;
  const acBack = new THREE.Mesh(
    createPinchedTuftedBackCushionGeometry(0.66, 0.50, 0.21, 1.3, 0.015),
    sofaBackTuftMat
  );
  acBack.castShadow = true;
  acBack.receiveShadow = true;
  outlines.addOutline(acBack, 1.018);
  acBackGroup.add(acBack);

  const acButton = new THREE.Mesh(buttonTuftGeo, sofaButtonMat);
  acButton.position.set(0, 0, 0.096);
  acBackGroup.add(acButton);
  armchair.add(acBackGroup);

  for (const side of [-1, 1]) {
    const acArm = new THREE.Mesh(
      createPlushBox(0.18, 0.48, 0.86, 0.042, 0.12),
      sofaMat
    );
    acArm.position.set(side * 0.41, 0.46, 0.0);
    acArm.rotation.z = side * -0.04;
    acArm.castShadow = true;
    acArm.receiveShadow = true;
    outlines.addOutline(acArm, 1.02);
    armchair.add(acArm);
  }
  group.add(armchair);
  addBoxCollider('col_liv_armchair', 1.15, 0.48, -9.12, 1.02, 0.96, 1.02);

  // 3) Z-Neck Wooden Floor Lamp with Striped Conical Shade & Hanging Pull Chain (Screenshot 4!)
  const floorLamp = new THREE.Group();
  floorLamp.position.set(0.54, 0, -9.86);
  const flBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.21, 0.042, 22),
    oakMat
  );
  flBase.position.y = 0.021;
  flBase.castShadow = true;
  outlines.addOutline(flBase, 1.025);
  floorLamp.add(flBase);

  // Characteristic Z-bend horizontal offset at top of wooden floor lamp stem (matching Screenshot 4!)
  const flStemPts = [
    new THREE.Vector3(0, 0.03, 0),
    new THREE.Vector3(0, 1.34, 0),
    new THREE.Vector3(0.02, 1.42, 0.01),
    new THREE.Vector3(0.13, 1.43, 0.08),
    new THREE.Vector3(0.15, 1.58, 0.09),
  ];
  const flStem = new THREE.Mesh(
    createTaperedCurveGeometry(flStemPts, 0.020, 0.015, 28, 10),
    oakMat
  );
  flStem.castShadow = true;
  outlines.addOutline(flStem, 1.03);
  floorLamp.add(flStem);

  const flShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.26, 0.29, 24, 1, true),
    mat({
      map: textures.cushionStripes,
      color: 0xfff5e4,
      emissive: new THREE.Color(0xffdcb5),
      emissiveIntensity: 0.82,
      roughness: 0.65,
      side: THREE.DoubleSide,
    })
  );
  flShade.position.set(0.15, 1.56, 0.09);
  flShade.castShadow = true;
  outlines.addOutline(flShade, 1.025);
  floorLamp.add(flShade);

  // Warm inner glowing bulb core inside the floor lamp shade so the lamp emits soft MiSide Bloom
  const flBulbCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff4d8 })
  );
  flBulbCore.position.set(0.15, 1.54, 0.09);
  floorLamp.add(flBulbCore);

  // Top & bottom dark trim rings on the striped conical lamp shade (Screenshot 4)
  for (const [ry, rr] of [
    [1.705, 0.145],
    [1.415, 0.260],
  ] as const) {
    const shadeRim = new THREE.Mesh(
      new THREE.TorusGeometry(rr, 0.005, 8, 24),
      darkOakMat
    );
    shadeRim.rotation.x = Math.PI / 2;
    shadeRim.position.set(0.15, ry, 0.09);
    floorLamp.add(shadeRim);
  }

  // Hanging beaded pull chain & wooden acorn fob under the floor lamp shade (Screenshot 4)
  const pullChain = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0028, 0.0028, 0.22, 6),
    handleBrassMat
  );
  pullChain.position.set(0.11, 1.34, 0.07);
  floorLamp.add(pullChain);
  const pullFob = new THREE.Mesh(
    new THREE.SphereGeometry(0.011, 8, 8),
    oakMat
  );
  pullFob.position.set(0.11, 1.22, 0.07);
  floorLamp.add(pullFob);
  group.add(floorLamp);
  addBoxCollider('col_liv_floor_lamp', 0.18, 0.85, -9.48, 0.44, 1.70, 0.44);

  // 4) Enlarged Corner-Mounted Split Air Conditioner (加大壁挂空调置于西北拐角 + 空调保温管道与电源线插座)
  const acUnit = new THREE.Group();
  acUnit.position.set(-0.32, 2.62, -10.13);
  const acBodyMat = mat({ color: 0xf7f5fa, roughness: 0.26, metalness: 0.08 });
  const acTrimMat = mat({ color: 0xdad4e4, roughness: 0.42, metalness: 0.08 });
  const acPipeTapeMat = mat({ color: 0xe6e0da, roughness: 0.72, metalness: 0.04 });
  const acCordMat = mat({ color: 0xedeaf0, roughness: 0.56, metalness: 0.05 });

  // Main enlarged AC chassis (1.48m wide x 0.40m tall x 0.31m deep)
  const acShell = new THREE.Mesh(
    createBeveledBox(1.48, 0.40, 0.31, 0.044, 3),
    acBodyMat
  );
  acShell.castShadow = true;
  acShell.receiveShadow = true;
  outlines.addOutline(acShell, 1.018);
  acUnit.add(acShell);

  // Subtle top intake grille ribs & sculpted front panel seam line
  const acTopGrille = new THREE.Mesh(
    createBeveledBox(1.34, 0.014, 0.16, 0.004, 1),
    acTrimMat
  );
  acTopGrille.position.set(0, 0.202, -0.02);
  acUnit.add(acTopGrille);

  const acFrontSeam = new THREE.Mesh(
    createBeveledBox(1.42, 0.010, 0.014, 0.002, 1),
    acTrimMat
  );
  acFrontSeam.position.set(0, 0.045, 0.154);
  acUnit.add(acFrontSeam);

  // Metallic accent stripe & temperature LED display window on right side of front panel
  const acDisplayPlate = new THREE.Mesh(
    createBeveledBox(0.14, 0.052, 0.012, 0.004, 1),
    mat({ color: 0x262133, roughness: 0.22, metalness: 0.25 })
  );
  acDisplayPlate.position.set(0.50, -0.035, 0.155);
  acUnit.add(acDisplayPlate);

  const acStatusLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x62f288 })
  );
  acStatusLed.position.set(0.54, -0.035, 0.163);
  acUnit.add(acStatusLed);

  const acTempDot = new THREE.Mesh(
    new THREE.BoxGeometry(0.048, 0.016, 0.004),
    new THREE.MeshBasicMaterial({ color: 0x9ef7ff })
  );
  acTempDot.position.set(0.475, -0.035, 0.162);
  acUnit.add(acTempDot);

  // Cute decorative front-panel decals / stickers on the AC unit (空调表面精致小贴花)
  {
    const dc = document.createElement('canvas');
    dc.width = 1024;
    dc.height = 256;
    const dctx = dc.getContext('2d')!;
    dctx.clearRect(0, 0, 1024, 256);

    // 1) Left corner: delicate watercolor botanical olive/eucalyptus vine + tiny pastel wildflowers
    dctx.save();
    dctx.translate(150, 146);
    dctx.strokeStyle = '#6c9a68';
    dctx.lineWidth = 4.2;
    dctx.lineCap = 'round';
    dctx.beginPath();
    dctx.moveTo(-88, 30);
    dctx.bezierCurveTo(-30, 8, 36, -12, 92, -32);
    dctx.stroke();

    const acLeaves: [number, number, number, number, string][] = [
      [-58, 12, -0.65, 19, '#7eb078'],
      [-28, 22, 0.52, 18, '#8dc086'],
      [-2, -6, -0.58, 21, '#6fa06a'],
      [28, 6, 0.48, 19, '#88b982'],
      [56, -24, -0.52, 18, '#77aa72'],
      [82, -16, 0.32, 15, '#92c58b'],
    ];
    for (const [lx, ly, rot, rad, col] of acLeaves) {
      dctx.save();
      dctx.translate(lx, ly);
      dctx.rotate(rot);
      dctx.fillStyle = col;
      dctx.beginPath();
      dctx.ellipse(0, 0, rad, rad * 0.44, 0, 0, Math.PI * 2);
      dctx.fill();
      dctx.restore();
    }
    // Tiny cream-pink & butter-yellow five-petal blossoms
    const drawMiniBlossom = (bx: number, by: number, pr: number, petalCol: string) => {
      dctx.fillStyle = petalCol;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        dctx.beginPath();
        dctx.arc(bx + Math.cos(a) * pr * 0.85, by + Math.sin(a) * pr * 0.85, pr * 0.62, 0, Math.PI * 2);
        dctx.fill();
      }
      dctx.fillStyle = '#f8d86c';
      dctx.beginPath();
      dctx.arc(bx, by, pr * 0.45, 0, Math.PI * 2);
      dctx.fill();
    };
    drawMiniBlossom(-38, -14, 10, '#f5a9bc');
    drawMiniBlossom(16, -28, 8.5, '#ffd884');
    drawMiniBlossom(64, 12, 9, '#f29eb4');
    dctx.restore();

    // 2) Center-left: cozy minimalist sleeping kitten & fluffy pastel cloud sticker
    dctx.save();
    dctx.translate(468, 134);
    // Soft sky-blue cloud cushion
    dctx.fillStyle = 'rgba(182, 218, 246, 0.82)';
    for (const [cx, cy, r] of [
      [-36, 16, 20],
      [-10, 12, 24],
      [20, 14, 22],
      [44, 18, 18],
    ]) {
      dctx.beginPath();
      dctx.arc(cx, cy, r, 0, Math.PI * 2);
      dctx.fill();
    }
    // Curled cream-ginger sleeping cat silhouette
    dctx.fillStyle = '#f6d4a8';
    dctx.beginPath();
    dctx.ellipse(4, 2, 34, 22, 0, 0, Math.PI * 2);
    dctx.fill();
    // Cat head & pointy ears
    dctx.beginPath();
    dctx.arc(-20, -6, 18, 0, Math.PI * 2);
    dctx.fill();
    dctx.beginPath();
    dctx.moveTo(-34, -14);
    dctx.lineTo(-32, -30);
    dctx.lineTo(-20, -20);
    dctx.moveTo(-16, -21);
    dctx.lineTo(-8, -31);
    dctx.lineTo(-4, -15);
    dctx.fill();
    // Closed happy sleeping eyes & rosy cheeks
    dctx.strokeStyle = '#5a4236';
    dctx.lineWidth = 2.6;
    dctx.beginPath();
    dctx.arc(-26, -6, 4.2, 0.15 * Math.PI, 0.85 * Math.PI);
    dctx.stroke();
    dctx.beginPath();
    dctx.arc(-13, -6, 4.2, 0.15 * Math.PI, 0.85 * Math.PI);
    dctx.stroke();
    dctx.fillStyle = 'rgba(244, 146, 164, 0.65)';
    dctx.beginPath();
    dctx.arc(-31, -1, 3.6, 0, Math.PI * 2);
    dctx.arc(-9, -1, 3.6, 0, Math.PI * 2);
    dctx.fill();
    // Soft ginger tabby forehead stripes & tail curl
    dctx.strokeStyle = '#d9985a';
    dctx.lineWidth = 3.2;
    dctx.beginPath();
    dctx.arc(34, 4, 14, -0.5 * Math.PI, 0.7 * Math.PI);
    dctx.stroke();
    dctx.restore();

    // 3) Scattered tiny golden stars, pastel sparkles & a four-leaf clover on right-center
    const drawStar = (sx: number, sy: number, r: number, col: string) => {
      dctx.fillStyle = col;
      dctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rad = i % 2 === 0 ? r : r * 0.36;
        const x = sx + Math.cos(a) * rad;
        const y = sy + Math.sin(a) * rad;
        if (i === 0) dctx.moveTo(x, y);
        else dctx.lineTo(x, y);
      }
      dctx.closePath();
      dctx.fill();
    };
    drawStar(330, 82, 13, '#f7d16c');
    drawStar(362, 112, 8, '#f6a8be');
    drawStar(586, 78, 12, '#f7d16c');
    drawStar(620, 108, 9, '#9fd0f2');
    // Tiny four-leaf clover sticker near right-center (well clear of LED panel)
    dctx.save();
    dctx.translate(765, 136);
    dctx.fillStyle = '#7bb474';
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      dctx.beginPath();
      dctx.arc(Math.cos(a) * 12, Math.sin(a) * 12, 11, 0, Math.PI * 2);
      dctx.fill();
    }
    dctx.strokeStyle = '#5f9458';
    dctx.lineWidth = 3.2;
    dctx.beginPath();
    dctx.moveTo(0, 10);
    dctx.quadraticCurveTo(4, 28, 14, 34);
    dctx.stroke();
    drawMiniBlossom(42, -16, 7.5, '#f6a8bc');
    drawStar(-42, -18, 9.5, '#f7d16c');
    dctx.restore();

    const acDecalTex = new THREE.CanvasTexture(dc);
    acDecalTex.colorSpace = THREE.SRGBColorSpace;
    acDecalTex.anisotropy = 4;
    const acDecalMat = new THREE.MeshStandardMaterial({
      map: acDecalTex,
      transparent: true,
      roughness: 0.34,
      metalness: 0.02,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const acDecalPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.265), acDecalMat);
    acDecalPlane.position.set(-0.12, 0.028, 0.1568);
    acUnit.add(acDecalPlane);
  }

  // Deep dark bottom air-discharge cavity & tilted motorized louver deflector blade
  const acOutletCavity = new THREE.Mesh(
    createBeveledBox(1.36, 0.062, 0.105, 0.008, 1),
    cavityDarkMat
  );
  acOutletCavity.position.set(0, -0.155, 0.105);
  acUnit.add(acOutletCavity);

  const acLouverBlade = new THREE.Mesh(
    createBeveledBox(1.34, 0.016, 0.066, 0.004, 1),
    acBodyMat
  );
  acLouverBlade.position.set(0, -0.172, 0.136);
  acLouverBlade.rotation.x = 0.44;
  acUnit.add(acLouverBlade);

  // Insulated Refrigerant & Condensate Drain Pipe Bundle exiting left side (-X) into NW corner wall hole!
  const acPipePts = [
    new THREE.Vector3(-0.72, -0.11, -0.06),
    new THREE.Vector3(-0.78, -0.14, -0.08),
    new THREE.Vector3(-0.80, -0.26, -0.09),
    new THREE.Vector3(-0.80, -0.34, -0.02),
    new THREE.Vector3(-0.82, -0.36, 0.04),
  ];
  const acPipeBundle = new THREE.Mesh(
    createTaperedCurveGeometry(acPipePts, 0.036, 0.034, 16, 10),
    acPipeTapeMat
  );
  acPipeBundle.castShadow = true;
  outlines.addOutline(acPipeBundle, 1.04);
  acUnit.add(acPipeBundle);

  // Secondary thinner ribbed condensate drain hose tucked alongside main wrapped bundle
  const acDrainPts = [
    new THREE.Vector3(-0.71, -0.15, -0.04),
    new THREE.Vector3(-0.76, -0.22, -0.05),
    new THREE.Vector3(-0.78, -0.34, 0.00),
    new THREE.Vector3(-0.82, -0.38, 0.05),
  ];
  const acDrainHose = new THREE.Mesh(
    createTaperedCurveGeometry(acDrainPts, 0.014, 0.014, 14, 8),
    acTrimMat
  );
  acUnit.add(acDrainHose);

  // Wall-penetration decorative plastic flange collar mounted flush on West alcove wall (X = -1.14)
  const wallCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.058, 0.062, 0.028, 16),
    acBodyMat
  );
  wallCollar.rotation.z = Math.PI / 2;
  wallCollar.position.set(-0.815, -0.36, 0.04);
  acUnit.add(wallCollar);

  // High-Mounted Dedicated 16A AC Wall Outlet Socket on North Wall right of AC (local X = +0.92, Y = -0.16, Z = -0.15)
  const acSocketPlate = new THREE.Mesh(
    createBeveledBox(0.108, 0.108, 0.020, 0.006, 2),
    acBodyMat
  );
  acSocketPlate.position.set(0.92, -0.16, -0.155);
  acUnit.add(acSocketPlate);

  const acSwitchBtn = new THREE.Mesh(
    createBeveledBox(0.024, 0.032, 0.014, 0.003, 1),
    acTrimMat
  );
  acSwitchBtn.position.set(0.945, -0.145, -0.142);
  acUnit.add(acSwitchBtn);

  // Heavy 16A 3-Prong Molded AC Plug inserted into wall outlet
  const acPlugBody = new THREE.Mesh(
    createBeveledBox(0.046, 0.052, 0.040, 0.007, 2),
    acBodyMat
  );
  acPlugBody.position.set(0.895, -0.168, -0.130);
  acUnit.add(acPlugBody);

  // Curved Dangling Power Cord looping naturally from bottom-right of AC unit down & over into the 16A plug
  const acCordPts = [
    new THREE.Vector3(0.68, -0.16, -0.11),
    new THREE.Vector3(0.74, -0.34, -0.125),
    new THREE.Vector3(0.84, -0.36, -0.125),
    new THREE.Vector3(0.895, -0.25, -0.125),
    new THREE.Vector3(0.895, -0.185, -0.128),
  ];
  const acPowerCord = new THREE.Mesh(
    createTaperedCurveGeometry(acCordPts, 0.0085, 0.0085, 18, 8),
    acCordMat
  );
  acPowerCord.castShadow = true;
  acUnit.add(acPowerCord);

  group.add(acUnit);


  // =========================================================================
  // 9. ECLECTIC STAGGERED ARTWORK GALLERY ABOVE SOFA
  // =========================================================================
  const galleryGroup = new THREE.Group();
  galleryGroup.name = 'EclecticSofaArtGallery';
  group.add(galleryGroup);

  const buildEclecticArtFrame = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    rotZ: number,
    frameColorHex: number,
    artTex: THREE.Texture,
    cornerRadius = 0.018
  ) => {
    const fg = new THREE.Group();
    fg.position.set(x, y, z);
    fg.rotation.z = rotZ;

    const customFrameMat = mat({
      color: frameColorHex,
      roughness: 0.48,
      metalness: 0.08,
    });

    const outer = new THREE.Mesh(
      createBeveledSlab(w, 0.048, h, cornerRadius, 0.012),
      customFrameMat
    );
    outer.rotation.x = Math.PI / 2;
    outer.castShadow = true;
    outlines.addOutline(outer, 1.022);
    fg.add(outer);

    const matBoard = new THREE.Mesh(
      createBeveledSlab(w - 0.075, 0.052, h - 0.075, Math.max(0.01, cornerRadius * 0.7), 0.006),
      pageMat
    );
    matBoard.rotation.x = Math.PI / 2;
    matBoard.position.z = 0.004;
    fg.add(matBoard);

    // Wall-harmonized matte archival canvas art material matching the airy living room wall luminance
    const artMat = mat({
      map: artTex,
      color: 0xf7f2ed,
      roughness: 0.90,
      metalness: 0.0,
      celStrength: 0.34,
    });
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.13, h - 0.13),
      artMat
    );
    art.position.z = 0.032;
    fg.add(art);

    // Delicate Evergreen Vine & Crimson Satin Ribbon Accent along Frame Edge (画框边缘细绿藤蔓与红丝带)
    const vineMat = mat({ color: 0x2f7d4a, roughness: 0.72, celStrength: 0.52 });
    const leafMat = mat({ color: 0x459a5d, roughness: 0.70, celStrength: 0.54 });
    const ribbonRedMat = mat({ color: 0xd62d3e, roughness: 0.42, metalness: 0.08, rimScale: 1.3 });

    const hw = w * 0.5;
    const hh = h * 0.5;
    const vinePts: THREE.Vector3[] = [];
    // Wind gracefully across top edge of frame and cascade slightly down one side
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const vx = THREE.MathUtils.lerp(-hw + 0.02, hw + 0.005, t);
      const vy = hh + 0.004 + Math.sin(t * Math.PI * 3.5) * 0.012;
      const vz = 0.024 + Math.cos(t * Math.PI * 3.5) * 0.005;
      vinePts.push(new THREE.Vector3(vx, vy, vz));
    }
    for (let i = 1; i <= 5; i++) {
      const t = i / 5;
      const vx = hw + 0.005 + Math.sin(t * Math.PI * 2.0) * 0.008;
      const vy = THREE.MathUtils.lerp(hh, hh - h * 0.45, t);
      const vz = 0.024 + Math.cos(t * Math.PI * 2.0) * 0.004;
      vinePts.push(new THREE.Vector3(vx, vy, vz));
    }
    const vineStem = new THREE.Mesh(
      createTaperedCurveGeometry(vinePts, 0.0045, 0.003, 28, 6),
      vineMat
    );
    fg.add(vineStem);

    // Petite paired evergreen leaves tucked along the frame vine
    const tinyLeafGeo = new THREE.SphereGeometry(0.014, 7, 5);
    tinyLeafGeo.scale(1.45, 0.62, 0.28);
    for (let i = 1; i < vinePts.length - 1; i += 2) {
      const pt = vinePts[i];
      for (const ls of [-1, 1]) {
        const lf = new THREE.Mesh(tinyLeafGeo, leafMat);
        lf.position.set(pt.x + ls * 0.009, pt.y + (i < 10 ? ls * 0.007 : 0), pt.z + 0.004);
        lf.rotation.set(0.15, 0, ls * 0.65 + (i >= 10 ? Math.PI * 0.5 : 0));
        fg.add(lf);
      }
    }

    // Petite Crimson Satin Ribbon Bow perched at the upper-right corner of the frame
    const bowCornerX = hw - 0.012;
    const bowCornerY = hh - 0.008;
    const bowKnot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), ribbonRedMat);
    bowKnot.position.set(bowCornerX, bowCornerY, 0.032);
    fg.add(bowKnot);

    for (const bs of [-1, 1]) {
      const loop = new THREE.Mesh(
        new THREE.TorusGeometry(0.018, 0.0055, 6, 14),
        ribbonRedMat
      );
      loop.scale.set(1.3, 0.68, 0.5);
      loop.rotation.z = bs * 0.45 - 0.35;
      loop.position.set(bowCornerX + bs * 0.018, bowCornerY + 0.006, 0.033);
      fg.add(loop);

      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.072, 0.003), ribbonRedMat);
      tail.rotation.z = bs * 0.24;
      tail.position.set(bowCornerX + bs * 0.012, bowCornerY - 0.038, 0.031);
      fg.add(tail);
    }

    galleryGroup.add(fg);
  };

  const artworks = textures.sofaArtworks;
  buildEclecticArtFrame(1.75, 2.08, -10.29, 0.88, 0.64, 0.022, 0x7a5c50, artworks[0], 0.016);
  buildEclecticArtFrame(2.82, 1.90, -10.29, 0.64, 0.84, -0.024, 0xb89674, artworks[1], 0.020);
  buildEclecticArtFrame(3.66, 2.26, -10.29, 0.54, 0.70, 0.028, 0x8a808d, artworks[2], 0.022);
  buildEclecticArtFrame(3.78, 1.50, -10.29, 0.52, 0.38, -0.020, 0x625668, artworks[3], 0.015);

  // =========================================================================
  // 10. NATURAL IRREGULAR PINE-NEEDLE GLOWING CHRISTMAS TREE (X = 6.74, Z = -9.66)
  //     (精细自然不对称发光圣诞树：清晰可见的羽毛状松针枝叶 + 松果 + 垂弧珠链 + 彩球 + 暖光灯串 + 发光金星)
  // =========================================================================
  const xmasTree = new THREE.Group();
  xmasTree.name = 'LivingRoomChristmasTree';
  const treeOrigin = new THREE.Vector3(6.74, 0, -9.66);
  xmasTree.position.copy(treeOrigin);

  // 1) Festive Red & Evergreen Scalloped Velvet Tree Skirt + Oak Barrel Base
  const treeSkirtRedMat = mat({
    color: 0xc22032,
    roughness: 0.86,
    metalness: 0.0,
    rimScale: 1.35,
  });
  const treeGoldTrimMat = mat({
    color: 0xefc968,
    roughness: 0.26,
    metalness: 0.74,
  });
  const treeSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.53, 0.57, 0.016, 32),
    treeSkirtRedMat
  );
  treeSkirt.position.y = 0.008;
  treeSkirt.receiveShadow = true;
  xmasTree.add(treeSkirt);

  const skirtGoldRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.010, 8, 36),
    treeGoldTrimMat
  );
  skirtGoldRim.rotation.x = Math.PI / 2;
  skirtGoldRim.position.y = 0.015;
  xmasTree.add(skirtGoldRim);

  const barrelMat = mat({
    map: textures.furnitureOak,
    color: 0xb8764a,
    roughness: 0.62,
    metalness: 0.0,
  });
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.142, 0.27, 20),
    barrelMat
  );
  barrel.position.y = 0.145;
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  outlines.addOutline(barrel, 1.03);
  xmasTree.add(barrel);

  for (const hy of [0.075, 0.225]) {
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(hy < 0.15 ? 0.154 : 0.178, 0.008, 8, 24),
      treeGoldTrimMat
    );
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = hy;
    xmasTree.add(hoop);
  }

  // 2) Anime Hand-Painted Scaly Pine-Bark Trunk (动漫手绘风格暖红棕松树皮树干)
  const pineBarkTextures = (() => {
    const W = 256;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx2d = c.getContext('2d')!;
    const bc = document.createElement('canvas');
    bc.width = W;
    bc.height = H;
    const bctx = bc.getContext('2d')!;

    // Warm dark cocoa anime lineart crevice base
    ctx2d.fillStyle = '#3d2215';
    ctx2d.fillRect(0, 0, W, H);
    bctx.fillStyle = '#383838';
    bctx.fillRect(0, 0, W, H);

    // Stylized rounded Ghibli/Anime pine bark scales with clean cel-shaded highlight & shadow blocks
    const cols = 6;
    const rows = 11;
    const cw = W / cols;
    const ch = H / rows;
    for (let ry = -1; ry <= rows; ry++) {
      for (let rx = -1; rx <= cols; rx++) {
        const seed = ((rx + 7) * 41 + (ry + 11) * 73) >>> 0;
        const px = (rx + (ry % 2) * 0.48) * cw + (((seed * 13) % 9) - 4);
        const py = ry * ch + (((seed * 19) % 11) - 5);
        const pw = cw * (0.82 + (seed % 4) * 0.04);
        const ph = ch * (0.86 + ((seed >> 2) % 4) * 0.04);

        const plateTones = ['#7d4c31', '#8e5a3b', '#9c6646', '#6e4129'];
        ctx2d.fillStyle = plateTones[seed % plateTones.length];
        bctx.fillStyle = `rgb(${175 + (seed % 45)}, ${175 + (seed % 45)}, ${175 + (seed % 45)})`;

        // Smooth rounded hexagonal bark scale
        const drawAnimeScale = (targetCtx: CanvasRenderingContext2D, inset = 0) => {
          const w2 = Math.max(3, pw * 0.5 - inset);
          const h2 = Math.max(3, ph * 0.5 - inset);
          targetCtx.beginPath();
          targetCtx.moveTo(px, py - h2);
          targetCtx.quadraticCurveTo(px + w2, py - h2 * 0.65, px + w2, py);
          targetCtx.quadraticCurveTo(px + w2, py + h2 * 0.65, px, py + h2);
          targetCtx.quadraticCurveTo(px - w2, py + h2 * 0.65, px - w2, py);
          targetCtx.quadraticCurveTo(px - w2, py - h2 * 0.65, px, py - h2);
          targetCtx.closePath();
        };

        drawAnimeScale(ctx2d, 2.2);
        ctx2d.fill();

        // Clean anime top-left warm cel highlight crescent on each bark scale
        ctx2d.strokeStyle = 'rgba(222, 162, 118, 0.55)';
        ctx2d.lineWidth = 2.6;
        ctx2d.beginPath();
        ctx2d.arc(px, py, Math.max(4, pw * 0.36), Math.PI * 0.95, Math.PI * 1.85);
        ctx2d.stroke();

        drawAnimeScale(bctx, 2.4);
        bctx.fill();
      }
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 4);
    map.anisotropy = 4;

    const bumpMap = new THREE.CanvasTexture(bc);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(2, 4);
    bumpMap.anisotropy = 4;

    return { map, bumpMap };
  })();

  const trunkMat = mat({
    map: pineBarkTextures.map,
    bumpMap: pineBarkTextures.bumpMap,
    bumpScale: 0.018,
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.0,
    celStrength: 0.56,
  });
  const trunkCurvePts = [
    new THREE.Vector3(0, 0.18, 0),
    new THREE.Vector3(-0.015, 0.66, 0.012),
    new THREE.Vector3(0.012, 1.16, -0.010),
    new THREE.Vector3(-0.006, 1.60, 0.008),
    new THREE.Vector3(0.002, 1.88, 0),
  ];
  const trunkGeo = createTaperedCurveGeometry(trunkCurvePts, 0.056, 0.014, 28, 12);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  outlines.addOutline(trunk, 1.04);
  xmasTree.add(trunk);

  // Stylized pruned pine branch-collar stubs along the visible lower/mid trunk
  for (let s = 0; s < 8; s++) {
    const sy = 0.28 + s * 0.13;
    const sang = s * 2.25 + 0.4;
    const sr = THREE.MathUtils.lerp(0.046, 0.026, s / 8);
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.015, 0.042, 8),
      trunkMat
    );
    stub.position.set(Math.cos(sang) * sr, sy, Math.sin(sang) * sr);
    stub.rotation.order = 'YXZ';
    stub.rotation.y = -sang + Math.PI / 2;
    stub.rotation.x = 1.15;
    xmasTree.add(stub);
  }

  // 3) 2-Level Anime Conifer Pine-Frond Texture (512x512):
  //    NO broadleaf stems or leaf midribs! Each shoot merges tiny needles into a clean,
  //    serrated spiky-tipped anime conifer needle-cluster pad (锯齿松针簇单片，无叶茎叶脉！)
  const pineNeedleSprayTex = (() => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const pctx = c.getContext('2d')!;
    pctx.clearRect(0, 0, S, S);
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';

    // Draws one merged conifer pine-tuft shoot from (x0, y0) to (x1, y1):
    // Slender evergreen silhouette with forward-swept serrated pine-needle teeth & 3-Point tuft tip,
    // ZERO broadleaf belly, ZERO central vein, ZERO exposed brown twig!
    const drawConiferTuftPad = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      halfWid: number,
      teethCount: number,
      brightVariant = false
    ) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);

      pctx.save();
      pctx.translate(x0, y0);
      pctx.rotate(ang);

      const traceSerratedConiferPad = () => {
        pctx.beginPath();
        pctx.moveTo(0, -halfWid * 0.38);
        // Upper serrated pine-needle teeth sweeping forward toward +X
        for (let k = 0; k < teethCount; k++) {
          const t0 = k / teethCount;
          const tTip = (k + 0.86) / teethCount;
          const tNotch = (k + 0.94) / teethCount;
          const env = Math.sin(Math.min(1, t0 * 1.15 + 0.20) * Math.PI * 0.78);
          const outerY = -halfWid * (0.55 + 0.52 * env);
          const notchY = -halfWid * (0.30 + 0.32 * env);
          pctx.quadraticCurveTo(len * (t0 + 0.42 / teethCount), outerY * 0.92, len * Math.min(0.96, tTip), outerY);
          if (k < teethCount - 1) {
            pctx.lineTo(len * tNotch, notchY);
          }
        }
        // Crisp 3-needle terminal conifer tuft point at x = len
        pctx.lineTo(len * 0.95, -halfWid * 0.28);
        pctx.lineTo(len, 0);
        pctx.lineTo(len * 0.95, halfWid * 0.28);

        // Lower serrated pine-needle teeth returning to base
        for (let k = teethCount - 1; k >= 0; k--) {
          const t0 = k / teethCount;
          const tTip = (k + 0.86) / teethCount;
          const tNotch = (k + 0.94) / teethCount;
          const env = Math.sin(Math.min(1, t0 * 1.15 + 0.20) * Math.PI * 0.78);
          const outerY = halfWid * (0.55 + 0.52 * env);
          const notchY = halfWid * (0.30 + 0.32 * env);
          if (k < teethCount - 1) {
            pctx.lineTo(len * tNotch, notchY);
          }
          pctx.quadraticCurveTo(len * (t0 + 0.42 / teethCount), outerY * 0.92, len * Math.min(0.96, tTip), outerY);
        }
        pctx.lineTo(0, halfWid * 0.38);
        pctx.closePath();
      };

      // 1) Clean anime pine silhouette + dark-spruce ink contour
      traceSerratedConiferPad();
      pctx.fillStyle = brightVariant ? '#349154' : '#297e47';
      pctx.fill();
      pctx.strokeStyle = '#154428';
      pctx.lineWidth = 4.6;
      pctx.stroke();

      // 2) Clip inside the conifer pad to paint clean anime cel-shading (NO midrib vein!)
      pctx.save();
      traceSerratedConiferPad();
      pctx.clip();

      // Deep pine shadow band along lower/base underside for lush evergreen depth
      const shGrad = pctx.createLinearGradient(0, -halfWid, 0, halfWid);
      shGrad.addColorStop(0.0, brightVariant ? '#5cb86c' : '#48a65c');
      shGrad.addColorStop(0.48, brightVariant ? '#359255' : '#2b8049');
      shGrad.addColorStop(1.0, '#1d5c35');
      pctx.fillStyle = shGrad;
      pctx.fillRect(0, -halfWid * 1.3, len * 1.05, halfWid * 2.6);

      // Sunlit Ghibli yellow-green highlight brush strokes on the outer pine-needle tips!
      const tipGrad = pctx.createLinearGradient(len * 0.45, 0, len, 0);
      tipGrad.addColorStop(0.0, 'rgba(130, 218, 132, 0)');
      tipGrad.addColorStop(1.0, brightVariant ? 'rgba(142, 226, 136, 0.82)' : 'rgba(116, 208, 122, 0.68)');
      pctx.fillStyle = tipGrad;
      pctx.fillRect(len * 0.45, -halfWid * 1.2, len * 0.60, halfWid * 2.4);

      // Subtle longitudinal needle-groove cel strokes (suggests bundled needles without messy hairlines)
      pctx.strokeStyle = 'rgba(20, 68, 38, 0.32)';
      pctx.lineWidth = 2.2;
      for (const gy of [-0.36, 0.06, 0.42]) {
        pctx.beginPath();
        pctx.moveTo(len * 0.12, halfWid * gy * 0.5);
        pctx.lineTo(len * 0.84, halfWid * gy);
        pctx.stroke();
      }

      pctx.restore();
      pctx.restore();
    };

    // 5 pairs of outward-fanning serrated conifer needle-pads + lush needle-covered central shoot
    // (Canvas bottom y=502 is v=0 trunk base; canvas top y=16 is v=1 outer drooping tip!)
    const lateralShoots: [number, number, number, number, number, number, boolean][] = [
      [256, 470, 62, 336, 26, 5, false],
      [256, 464, 450, 330, 26, 5, true],
      [256, 392, 58, 244, 25, 5, true],
      [256, 386, 454, 238, 25, 5, false],
      [256, 310, 76, 156, 24, 5, false],
      [256, 304, 436, 150, 24, 5, true],
      [256, 228, 108, 86, 22, 4, true],
      [256, 222, 404, 80, 22, 4, false],
      [256, 154, 154, 38, 20, 4, false],
      [256, 150, 358, 36, 20, 4, true],
    ];
    for (const [x0, y0, x1, y1, hw, tc, bright] of lateralShoots) {
      drawConiferTuftPad(x0, y0, x1, y1, hw, tc, bright);
    }

    // Central conifer leader shoot completely clothed in pine needles (zero bare stem!)
    drawConiferTuftPad(256, 504, 256, 14, 30, 9, true);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  })();

  // Deeper, richer dark-evergreen pine tint matching the darkened Christmas wreath
  const pineNeedleMat = mat({
    map: pineNeedleSprayTex,
    color: 0xb8ceb9,
    roughness: 0.70,
    metalness: 0.0,
    alphaTest: 0.40,
    side: THREE.DoubleSide,
    rimScale: 1.30,
    celStrength: 0.58,
  });

  // Lush S-Sweep Fir-Bough Geometry (restored 3-wing fullness with graceful outstretched tip)
  const pineFrondGeo = (() => {
    const frondLen = 0.46;
    const frondWid = 0.35;
    const layers: THREE.BufferGeometry[] = [];
    for (const tilt of [0, 0.46, -0.46]) {
      const wScale = tilt === 0 ? 1.0 : 0.64;
      const g = new THREE.PlaneGeometry(frondWid * wScale, frondLen, 6, 9);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, frondLen * 0.5);

      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const pz = pos.getZ(i);
        const t = THREE.MathUtils.clamp(pz / frondLen, 0, 1);
        const sideFrac = Math.abs(px) / (frondWid * wScale * 0.5);
        const sCurveY =
          0.014 * Math.sin(t * Math.PI) - 0.076 * Math.pow(t, 1.42) + 0.018 * Math.pow(t, 2.8);
        const roofSkirtY = -Math.pow(sideFrac, 1.15) * 0.042 * (0.35 + 0.65 * t);
        const rx = px * Math.cos(tilt) - roofSkirtY * Math.sin(tilt);
        const ry = px * Math.sin(tilt) + roofSkirtY * Math.cos(tilt) + sCurveY;
        pos.setXYZ(i, rx, ry, pz);
      }
      g.computeVertexNormals();
      layers.push(g);
    }
    return BufferGeometryUtils.mergeGeometries(layers, false)!;
  })();

  const treeRand = (seed: number) => {
    const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // Restored Lush Fullness with Subtle Tier Layering & Moderate Droop Variation:
  // 13 full tiers (14..8 boughs per tier) — rich and fluffy without looking sparse or solid-walled!
  const boughTransforms: {
    pos: THREE.Vector3;
    yaw: number;
    pitch: number;
    roll: number;
    sx: number;
    sy: number;
    sz: number;
  }[] = [];

  const branchTipAnchors: { x: number; y: number; z: number; r: number }[] = [];

  const numWhorls = 13;
  for (let w = 0; w < numWhorls; w++) {
    const wt = w / (numWhorls - 1);
    const baseY = THREE.MathUtils.lerp(0.41, 1.82, Math.pow(wt, 0.94));
    const count = Math.max(8, Math.round(THREE.MathUtils.lerp(14, 8, wt)));
    const baseReach = THREE.MathUtils.lerp(1.26, 0.29, Math.pow(wt, 0.88));
    const whorlPhase = w * 2.15 + treeRand(w * 13) * 0.45;

    for (let b = 0; b < count; b++) {
      const seed = w * 41 + b * 23 + 7;
      const yawJitter = (treeRand(seed) - 0.5) * 0.28;
      const yaw = (b / count) * Math.PI * 2 + whorlPhase + yawJitter;

      const reachMult = 0.85 + treeRand(seed + 3) * 0.34;
      const sz = baseReach * reachMult;
      const sx = THREE.MathUtils.lerp(1.22, 0.52, wt) * (0.90 + treeRand(seed + 7) * 0.22);

      // Moderate, natural pitch variation (~±6° around the soft downward sweep)
      const modeOffset = ((b + w) % 3 - 1) * 0.085;
      const pitch =
        THREE.MathUtils.lerp(0.30, 0.23, wt) + modeOffset + (treeRand(seed + 19) - 0.5) * 0.08;
      const loftY = ((b + w) % 3 === 0 ? 0.016 : -0.010) + (treeRand(seed + 11) - 0.5) * 0.020;
      const roll = (treeRand(seed + 23) - 0.5) * 0.20;

      const startR = THREE.MathUtils.lerp(0.036, 0.008, wt);
      const bx = Math.cos(yaw) * startR;
      const bz = Math.sin(yaw) * startR;
      const by = baseY + loftY;

      boughTransforms.push({
        pos: new THREE.Vector3(bx, by, bz),
        yaw: Math.PI / 2 - yaw,
        pitch,
        roll,
        sx,
        sy: sx,
        sz,
      });

      const tipDist = startR + 0.40 * sz * Math.cos(pitch);
      const tipY = by - 0.40 * sz * Math.sin(pitch) - 0.055 * sz;
      branchTipAnchors.push({
        x: Math.cos(yaw) * tipDist,
        y: tipY,
        z: Math.sin(yaw) * tipDist,
        r: tipDist,
      });

      // Keep bottom 2 whorls lightly relaxed (every 3rd inner sprig), full inner richness from whorl 2 upward!
      const addInner = w < 2 ? b % 3 === 0 : b % 2 === 0 || wt > 0.55;
      if (addInner) {
        boughTransforms.push({
          pos: new THREE.Vector3(bx * 0.65, by + 0.025, bz * 0.65),
          yaw: Math.PI / 2 - yaw + 0.30,
          pitch: pitch + 0.10,
          roll: -roll * 0.5,
          sx: sx * 0.84,
          sy: sx * 0.84,
          sz: sz * 0.58,
        });
      }
    }
  }

  // Lush Crown Cap right beneath the Star Topper (Y = 1.86..1.90)
  for (const [crownY, crownCount, crownSz, crownPitch] of [
    [1.86, 8, 0.26, 0.28],
    [1.90, 7, 0.20, 0.38],
  ] as const) {
    for (let t = 0; t < crownCount; t++) {
      const tAng = (t / crownCount) * Math.PI * 2 + crownY * 3.1;
      boughTransforms.push({
        pos: new THREE.Vector3(0, crownY, 0),
        yaw: Math.PI / 2 - tAng,
        pitch: crownPitch + (t % 3) * 0.05,
        roll: 0,
        sx: 0.46,
        sy: 0.46,
        sz: crownSz,
      });
    }
  }

  const pineBoughsInst = new THREE.InstancedMesh(
    pineFrondGeo,
    pineNeedleMat,
    boughTransforms.length
  );
  pineBoughsInst.castShadow = true;
  pineBoughsInst.receiveShadow = true;

  for (let i = 0; i < boughTransforms.length; i++) {
    const bt = boughTransforms[i];
    _instPos.set(
      treeOrigin.x + bt.pos.x,
      treeOrigin.y + bt.pos.y,
      treeOrigin.z + bt.pos.z
    );
    _instEuler.set(bt.pitch, bt.yaw, bt.roll, 'YXZ');
    _instQuat.setFromEuler(_instEuler);
    _instScale.set(bt.sx, bt.sy, bt.sz);
    _instMat.compose(_instPos, _instQuat, _instScale);
    pineBoughsInst.setMatrixAt(i, _instMat);
  }
  pineBoughsInst.instanceMatrix.needsUpdate = true;
  pineBoughsInst.computeBoundingSphere();
  group.add(pineBoughsInst);

  // 4) 10 Sculpted Natural Brown Pinecones Nestled Organically on Branches
  const treePineconeMat = mat({ color: 0x6b4428, roughness: 0.84, metalness: 0.0 });
  const pineconeGeo = new THREE.ConeGeometry(0.024, 0.058, 7, 3);
  pineconeGeo.rotateX(Math.PI); // Tapered tip pointing downward like hanging spruce cones
  for (let p = 0; p < 10; p++) {
    const anchor = branchTipAnchors[(p * 9 + 4) % branchTipAnchors.length];
    const pCone = new THREE.Mesh(pineconeGeo, treePineconeMat);
    pCone.position.set(anchor.x * 0.82, anchor.y - 0.015, anchor.z * 0.82);
    pCone.rotation.set((treeRand(p * 7) - 0.5) * 0.3, p * 1.1, (treeRand(p * 11) - 0.5) * 0.3);
    pCone.castShadow = true;
    xmasTree.add(pCone);
  }

  // 5) Naturally Draped Golden Tinsel Garland with Catenary Swag Loops (not a rigid coil!)
  const garlandPts: THREE.Vector3[] = [];
  const garlandSteps = 84;
  for (let i = 0; i <= garlandSteps; i++) {
    const t = i / garlandSteps;
    const swagLoop = Math.abs(Math.sin(t * Math.PI * 19)); // 19 draped festoon swags
    const gy = THREE.MathUtils.lerp(0.44, 1.66, t) - (1 - swagLoop) * 0.042;
    const gr =
      THREE.MathUtils.lerp(0.46, 0.11, Math.pow(t, 0.90)) *
      (0.92 + 0.10 * swagLoop + (treeRand(i * 3) - 0.5) * 0.04);
    const gAng = t * Math.PI * 2 * 4.2;
    garlandPts.push(new THREE.Vector3(Math.cos(gAng) * gr, gy, Math.sin(gAng) * gr));
  }
  const garlandMesh = new THREE.Mesh(
    createTaperedCurveGeometry(garlandPts, 0.011, 0.007, 108, 7),
    treeGoldTrimMat
  );
  xmasTree.add(garlandMesh);

  // 6) 28 Anime Cel-Shaded Candy-Gloss Christmas Baubles + Outlines
  const baubleMats = [
    mat({ color: 0xec4456, roughness: 0.28, metalness: 0.16, celStrength: 0.58, rimScale: 1.4 }),
    mat({ color: 0xf9d576, roughness: 0.28, metalness: 0.38, celStrength: 0.54, rimScale: 1.4 }),
    mat({ color: 0x3a965e, roughness: 0.28, metalness: 0.18, celStrength: 0.58, rimScale: 1.4 }),
    mat({ color: 0xfff8ee, roughness: 0.30, metalness: 0.12, celStrength: 0.52, rimScale: 1.4 }),
  ];
  const baubleGeo = new THREE.SphereGeometry(0.032, 12, 10);
  const baubleCapGeo = new THREE.CylinderGeometry(0.007, 0.008, 0.012, 8);
  for (let i = 0; i < 28; i++) {
    const idx = Math.floor(((i * 7 + 3) / 28) * branchTipAnchors.length) % branchTipAnchors.length;
    const anchor = branchTipAnchors[idx];
    const bScale = 0.85 + (i % 3) * 0.16;
    const bx = anchor.x * 0.90;
    const by = anchor.y - 0.028 * bScale;
    const bz = anchor.z * 0.90;

    const bauble = new THREE.Mesh(baubleGeo, baubleMats[i % baubleMats.length]);
    bauble.position.set(bx, by, bz);
    bauble.scale.setScalar(bScale);
    bauble.castShadow = true;
    outlines.addOutline(bauble, 1.055);
    xmasTree.add(bauble);

    const cap = new THREE.Mesh(baubleCapGeo, treeGoldTrimMat);
    cap.position.set(bx, by + 0.030 * bScale, bz);
    xmasTree.add(cap);
  }

  // 7) 56 Dreamy Anime Bokeh Fairy Lights + Soft Warm Halo Orbs + Cozy Golden PointLight
  const fairyGlowMats = [
    new THREE.MeshStandardMaterial({
      color: 0xfff4c6,
      emissive: new THREE.Color(0xffd670),
      emissiveIntensity: 2.5,
      roughness: 0.3,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xfffbf0,
      emissive: new THREE.Color(0xfff2c8),
      emissiveIntensity: 2.4,
      roughness: 0.3,
    }),
    new THREE.MeshStandardMaterial({
      color: 0xffc8bc,
      emissive: new THREE.Color(0xff7e6e),
      emissiveIntensity: 2.2,
      roughness: 0.3,
    }),
  ];
  const fairyBulbGeo = new THREE.SphereGeometry(0.015, 8, 6);
  const fairyBokehGeo = new THREE.SphereGeometry(0.036, 8, 6);
  const fairyBokehMat = new THREE.MeshBasicMaterial({
    color: 0xffe498,
    transparent: true,
    opacity: 0.20,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const fairyBokehInst = new THREE.InstancedMesh(fairyBokehGeo, fairyBokehMat, 56);
  for (let i = 0; i < 56; i++) {
    const anchor = branchTipAnchors[(i * 5 + 1) % branchTipAnchors.length];
    const inward = 0.76 + (i % 3) * 0.11;
    const lx = anchor.x * inward;
    const ly = anchor.y + 0.012 + (i % 2 === 0 ? 0.008 : -0.008);
    const lz = anchor.z * inward;

    const bulb = new THREE.Mesh(fairyBulbGeo, fairyGlowMats[i % fairyGlowMats.length]);
    bulb.position.set(lx, ly, lz);
    xmasTree.add(bulb);

    _instPos.set(treeOrigin.x + lx, treeOrigin.y + ly, treeOrigin.z + lz);
    _instQuat.identity();
    _instScale.setScalar(0.85 + (i % 3) * 0.18);
    _instMat.compose(_instPos, _instQuat, _instScale);
    fairyBokehInst.setMatrixAt(i, _instMat);
  }
  fairyBokehInst.instanceMatrix.needsUpdate = true;
  fairyBokehInst.computeBoundingSphere();
  group.add(fairyBokehInst);

  // Warm golden glow light illuminating the pine needles, gifts, and surrounding corner
  const xmasTreeLight = new THREE.PointLight(0xffcf78, 1.45, 3.9, 1.8);
  xmasTreeLight.position.set(-0.18, 1.24, 0.18);
  xmasTree.add(xmasTreeLight);

  // 8) Glowing 3D Golden 5-Pointed Star Topper + Subtle Halo Glow
  const starShape = new THREE.Shape();
  const starOuterR = 0.112;
  const starInnerR = 0.046;
  for (let p = 0; p < 10; p++) {
    const r = p % 2 === 0 ? starOuterR : starInnerR;
    const ang = (p / 10) * Math.PI * 2 + Math.PI / 2;
    const sx = Math.cos(ang) * r;
    const sy = Math.sin(ang) * r;
    if (p === 0) starShape.moveTo(sx, sy);
    else starShape.lineTo(sx, sy);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  starGeo.center();
  const starTopperMat = new THREE.MeshStandardMaterial({
    color: 0xffe994,
    emissive: new THREE.Color(0xffc94a),
    emissiveIntensity: 2.5,
    roughness: 0.22,
    metalness: 0.62,
  });
  const starTopper = new THREE.Mesh(starGeo, starTopperMat);
  starTopper.position.set(0, 1.94, 0);
  starTopper.rotation.y = -Math.PI * 0.22;
  xmasTree.add(starTopper);

  const starHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 14, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffdf82,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  starHalo.position.set(0, 1.94, 0);
  starHalo.userData.dynamic = true;
  xmasTree.add(starHalo);

  // 9) 4 Wrapped Red & Green Christmas Gift Boxes around the Tree Skirt
  const giftSpecs: {
    pos: [number, number, number];
    size: [number, number, number];
    yaw: number;
    boxHex: number;
    ribbonHex: number;
  }[] = [
    { pos: [-0.28, 0.09, 0.26], size: [0.22, 0.16, 0.20], yaw: 0.32, boxHex: 0xc82436, ribbonHex: 0xf2cd74 },
    { pos: [0.18, 0.075, 0.34], size: [0.18, 0.13, 0.18], yaw: -0.42, boxHex: 0x1f6e3c, ribbonHex: 0xf7efe0 },
    { pos: [-0.36, 0.065, -0.06], size: [0.16, 0.11, 0.16], yaw: 0.65, boxHex: 0xfaf2e4, ribbonHex: 0xc82436 },
    { pos: [-0.06, 0.055, 0.38], size: [0.14, 0.095, 0.13], yaw: 0.15, boxHex: 0x247844, ribbonHex: 0xf2cd74 },
  ];
  for (const g of giftSpecs) {
    const giftGroup = new THREE.Group();
    giftGroup.position.set(...g.pos);
    giftGroup.rotation.y = g.yaw;
    const [gw, gh, gd] = g.size;
    const boxMat = mat({ color: g.boxHex, roughness: 0.56, metalness: 0.04 });
    const ribMat = mat({ color: g.ribbonHex, roughness: 0.36, metalness: 0.28 });

    const giftBox = new THREE.Mesh(createBeveledBox(gw, gh, gd, 0.008, 2), boxMat);
    giftBox.castShadow = true;
    giftBox.receiveShadow = true;
    outlines.addOutline(giftBox, 1.03);
    giftGroup.add(giftBox);

    const ribX = new THREE.Mesh(new THREE.BoxGeometry(gw + 0.008, gh + 0.008, 0.022), ribMat);
    const ribZ = new THREE.Mesh(new THREE.BoxGeometry(0.022, gh + 0.008, gd + 0.008), ribMat);
    giftGroup.add(ribX, ribZ);

    for (const bs of [-1, 1]) {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.006, 6, 12), ribMat);
      bow.position.set(bs * 0.018, gh * 0.5 + 0.016, 0);
      bow.rotation.z = bs * 0.35;
      giftGroup.add(bow);
    }
    xmasTree.add(giftGroup);
  }

  group.add(xmasTree);

  // =========================================================================
  // 10B. GLAZED CERAMIC PET FOOD & WATER BOWL SET NEAR CHRISTMAS TREE BY EAST WINDOW
  //      (圣诞树附近靠窗地面：釉面瓷质双碗宠物食盆，含手绘釉下彩爪印纹、猫粮与清澈饮水)
  // =========================================================================
  {
    const petStation = new THREE.Group();
    petStation.name = 'LivingCeramicPetBowlStation';
    petStation.position.set(6.72, 0, -8.36);
    petStation.rotation.y = -Math.PI * 0.5 + 0.12;

    // Soft rounded-corner cream-sage silicone/linen pet feeding placemat
    const matPadMat = mat({
      color: 0xe6e8de,
      roughness: 0.86,
      metalness: 0.0,
      celStrength: 0.42,
    });
    const matPad = new THREE.Mesh(
      createBeveledSlab(0.50, 0.008, 0.28, 0.06, 0.003),
      matPadMat
    );
    matPad.position.y = 0.004;
    matPad.receiveShadow = true;
    petStation.add(matPad);

    // Subtle recessed rim border around the feeding mat
    const matRim = new THREE.Mesh(
      createBeveledSlab(0.46, 0.004, 0.24, 0.05, 0.002),
      mat({ color: 0xd7dccd, roughness: 0.88, metalness: 0.0 })
    );
    matRim.position.y = 0.0085;
    matRim.receiveShadow = true;
    petStation.add(matRim);

    // Procedural hand-painted under-glaze ceramic exterior pattern (cream porcelain + sage/cobalt paw & fish motifs)
    const bowlDecalTex = (() => {
      const bc = document.createElement('canvas');
      bc.width = 512;
      bc.height = 128;
      const bctx = bc.getContext('2d')!;
      bctx.fillStyle = '#fcf9f2';
      bctx.fillRect(0, 0, 512, 128);
      // Hand-painted thin celadon-sage & muted cobalt ceramic rim bands
      bctx.fillStyle = '#7ea28a';
      bctx.fillRect(0, 14, 512, 6);
      bctx.fillStyle = '#5c7c9a';
      bctx.fillRect(0, 108, 512, 5);

      // Repeating tiny under-glaze paw prints & delicate botanical dots around bowl circumference
      for (let i = 0; i < 6; i++) {
        const cx = i * 85 + 42;
        const cy = 64;
        bctx.fillStyle = i % 2 === 0 ? '#5b7a98' : '#799c84';
        // Main paw pad
        bctx.beginPath();
        bctx.ellipse(cx, cy + 5, 9.5, 7.2, 0, 0, Math.PI * 2);
        bctx.fill();
        // 4 tiny toe beans
        for (const [tx, ty] of [
          [-10, -5],
          [-3.5, -10],
          [3.5, -10],
          [10, -5],
        ]) {
          bctx.beginPath();
          bctx.arc(cx + tx, cy + ty, 3.2, 0, Math.PI * 2);
          bctx.fill();
        }
        // Small ceramic glaze accent dot between paws
        bctx.fillStyle = '#d49a6a';
        bctx.beginPath();
        bctx.arc(cx + 42, cy, 3.0, 0, Math.PI * 2);
        bctx.fill();
      }
      const tex = new THREE.CanvasTexture(bc);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    })();

    // Authentic glossy glazed porcelain ceramic material (高光白瓷釉面质感)
    const ceramicGlazeMat = new THREE.MeshPhysicalMaterial({
      map: bowlDecalTex,
      color: 0xffffff,
      roughness: 0.11,
      metalness: 0.02,
      clearcoat: 0.94,
      clearcoatRoughness: 0.06,
      reflectivity: 0.72,
    });
    const ceramicInnerMat = new THREE.MeshPhysicalMaterial({
      color: 0xfdfbf6,
      roughness: 0.10,
      metalness: 0.02,
      clearcoat: 0.96,
      clearcoatRoughness: 0.05,
      reflectivity: 0.75,
    });

    // Sculpted ceramic pet bowl Lathe profile (solid footed base -> curved glazed belly -> rolled porcelain lip -> deep concave basin)
    const bowlOuterPts = [
      new THREE.Vector2(0.0, 0.002),
      new THREE.Vector2(0.066, 0.002),
      new THREE.Vector2(0.072, 0.010),
      new THREE.Vector2(0.088, 0.032),
      new THREE.Vector2(0.094, 0.058),
      new THREE.Vector2(0.096, 0.074),
      new THREE.Vector2(0.091, 0.080),
      new THREE.Vector2(0.084, 0.078),
    ];
    const bowlOuterGeo = new THREE.LatheGeometry(bowlOuterPts, 32);

    const bowlInnerPts = [
      new THREE.Vector2(0.084, 0.078),
      new THREE.Vector2(0.080, 0.066),
      new THREE.Vector2(0.074, 0.038),
      new THREE.Vector2(0.054, 0.018),
      new THREE.Vector2(0.0, 0.014),
    ];
    const bowlInnerGeo = new THREE.LatheGeometry(bowlInnerPts, 32);

    const kibbleMat = mat({
      color: 0x7b4c2d,
      roughness: 0.88,
      metalness: 0.0,
      celStrength: 0.45,
    });
    const kibbleDarkMat = mat({
      color: 0x5c371f,
      roughness: 0.90,
      metalness: 0.0,
    });
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff4fa,
      roughness: 0.04,
      metalness: 0.02,
      transparent: true,
      opacity: 0.68,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 0.9,
    });

    // Left Ceramic Bowl (Food) & Right Ceramic Bowl (Water)
    for (const [idx, bx] of [
      [0, -0.115],
      [1, 0.115],
    ] as const) {
      const bowlGroup = new THREE.Group();
      bowlGroup.position.set(bx, 0.008, 0);

      const outerMesh = new THREE.Mesh(bowlOuterGeo, ceramicGlazeMat);
      outerMesh.castShadow = true;
      outerMesh.receiveShadow = true;
      outlines.addOutline(outerMesh, 1.02);
      bowlGroup.add(outerMesh);

      const innerMesh = new THREE.Mesh(bowlInnerGeo, ceramicInnerMat);
      innerMesh.receiveShadow = true;
      bowlGroup.add(innerMesh);

      if (idx === 0) {
        // Pet kibble mound + scattered 3D crunchy kibble pellets
        const mound = new THREE.Mesh(
          new THREE.SphereGeometry(0.066, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
          kibbleMat
        );
        mound.scale.set(1.0, 0.46, 1.0);
        mound.position.y = 0.030;
        bowlGroup.add(mound);

        const pelletGeo = new THREE.DodecahedronGeometry(0.0075, 0);
        for (let p = 0; p < 18; p++) {
          const a = p * 2.399;
          const r = 0.012 + (p / 18) * 0.048;
          const py = 0.056 - (r / 0.066) * 0.020;
          const pellet = new THREE.Mesh(pelletGeo, p % 3 === 0 ? kibbleDarkMat : kibbleMat);
          pellet.position.set(Math.cos(a) * r, py, Math.sin(a) * r);
          pellet.rotation.set(p * 0.7, p * 1.1, p * 0.4);
          pellet.scale.set(1.1, 0.72, 0.95);
          bowlGroup.add(pellet);
        }
      } else {
        // Clear reflective drinking water surface
        const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(0.076, 28), waterMat);
        waterDisc.rotation.x = -Math.PI / 2;
        waterDisc.position.y = 0.054;
        bowlGroup.add(waterDisc);
      }

      petStation.add(bowlGroup);
    }

    group.add(petStation);
  }
  addBoxCollider('col_liv_plant', 6.74, 0.8, -9.66, 0.72, 1.8, 0.72);

  // =========================================================================
  // 10B. AMERICAN HERITAGE SOLID-WOOD LIBRARY BOOKCASE (电视最右边美式实木书架)
  //      & MODERN VINYL TURNTABLE MEDIA CABINET + BOOKSHELF BESIDE SMALL SOFA
  // =========================================================================
  const buildStandingCornerBookRack = (
    originX: number,
    originZ: number,
    rotY: number,
    numTiers: number,
    shelfWidth: number,
    shelfDepth: number,
    totalHeight: number,
    seedOffset: number
  ) => {
    const rackGroup = new THREE.Group();
    rackGroup.position.set(originX, 0, originZ);
    rackGroup.rotation.y = rotY;

    const halfW = shelfWidth / 2;
    const halfD = shelfDepth / 2;

    // 1) Crisp Sharp-Edged Stepped American Crown Cornice (硬朗直角外挑顶冠，告别发圆)
    const crownTop = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth + 0.085, 0.030, shelfDepth + 0.068),
      oakMat
    );
    crownTop.position.set(0, totalHeight + 0.015, 0.008);
    crownTop.castShadow = true;
    crownTop.receiveShadow = true;
    rackGroup.add(crownTop);

    const crownCove = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth + 0.048, 0.022, shelfDepth + 0.036),
      darkOakMat
    );
    crownCove.position.set(0, totalHeight - 0.011, 0.004);
    rackGroup.add(crownCove);

    const headerApron = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth - 0.05, 0.048, 0.018),
      oakMat
    );
    headerApron.position.set(0, totalHeight - 0.046, halfD - 0.012);
    rackGroup.add(headerApron);

    // 2) Crisp Flush Paneled Side Walls (齐平直框，不再突出圆边柱)
    for (const sx of [-halfW + 0.018, halfW - 0.018]) {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, totalHeight - 0.05, shelfDepth - 0.01),
        oakMat
      );
      sideWall.position.set(sx, totalHeight / 2 - 0.015, 0);
      sideWall.castShadow = true;
      sideWall.receiveShadow = true;
      rackGroup.add(sideWall);

      const sidePanelInset = new THREE.Mesh(
        new THREE.BoxGeometry(0.010, totalHeight - 0.28, shelfDepth - 0.095),
        darkOakMat
      );
      sidePanelInset.position.set(sx + (sx < 0 ? -0.015 : 0.015), totalHeight / 2 + 0.02, 0);
      rackGroup.add(sidePanelInset);
    }

    // 3) Single clean solid-wood back panel (一整块平整背板，无多余竖条)
    const backBoard = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth - 0.04, totalHeight - 0.08, 0.018),
      darkOakMat
    );
    backBoard.position.set(0, totalHeight / 2 - 0.01, -halfD + 0.012);
    backBoard.receiveShadow = true;
    rackGroup.add(backBoard);

    // 4) Crisp Sharp-Edged Baseboard Plinth & Straight Bracket Feet
    const basePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(shelfWidth + 0.042, 0.028, shelfDepth + 0.032),
      oakMat
    );
    basePlinth.position.set(0, 0.074, 0.004);
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;
    rackGroup.add(basePlinth);

    for (const fx of [-halfW + 0.025, halfW - 0.025]) {
      for (const fz of [-halfD + 0.025, halfD - 0.025]) {
        const foot = new THREE.Mesh(
          new THREE.BoxGeometry(0.062, 0.060, 0.062),
          darkOakMat
        );
        foot.position.set(fx, 0.030, fz);
        foot.castShadow = true;
        rackGroup.add(foot);
      }
    }

    // 5) Enclosed Lower Flush Flat-Recessed Shaker Double Doors + Vintage Drop-Ring Pulls!
    const lowerCabTopY = 0.45;
    const doorW = (shelfWidth - 0.095) * 0.5;
    for (const ds of [-1, 1] as const) {
      const dx = ds * (doorW * 0.5 + 0.003);
      // Flat recessed inner panel
      const dBack = new THREE.Mesh(
        new THREE.BoxGeometry(doorW - 0.004, 0.336, 0.012),
        darkOakMat
      );
      dBack.position.set(dx, 0.27, halfD - 0.010);
      rackGroup.add(dBack);

      // Flush sharp outer rails & stiles (平整内凹，无凸起中芯块!)
      for (const ry of [-0.150, 0.150]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.036, 0.018), oakMat);
        rail.position.set(dx, 0.27 + ry, halfD - 0.005);
        rackGroup.add(rail);
      }
      for (const sx of [-(doorW * 0.5 - 0.018), doorW * 0.5 - 0.018]) {
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.336, 0.018), oakMat);
        stile.position.set(dx + sx, 0.27, halfD - 0.005);
        rackGroup.add(stile);
      }

      // Vintage Drop-Ring Pull rotated to face +Z
      const ringPull = createAmericanHandle('ring', 1);
      ringPull.rotation.y = -Math.PI / 2;
      ringPull.position.set(dx - ds * (doorW * 0.34), 0.30, halfD + 0.004);
      rackGroup.add(ringPull);
    }

    // 6) Crisp Flat Open Upper Shelf Tiers + Books & Top Ornaments
    const openTiers = Math.max(3, numTiers - 1);
    const tierBoardGeo = new THREE.BoxGeometry(shelfWidth - 0.05, 0.026, shelfDepth - 0.01);
    const tierGap = (totalHeight - 0.14 - lowerCabTopY) / (openTiers - 1);

    for (let t = 0; t < openTiers; t++) {
      const tierY = lowerCabTopY + t * tierGap;
      const board = new THREE.Mesh(tierBoardGeo, oakMat);
      board.position.y = tierY;
      board.castShadow = true;
      board.receiveShadow = true;
      rackGroup.add(board);

      // Molded front edge nosing trim along each shelf
      const nosing = new THREE.Mesh(
        createBeveledBox(shelfWidth - 0.06, 0.014, 0.016, 0.003, 1),
        darkOakMat
      );
      nosing.position.set(0, tierY - 0.012, halfD - 0.004);
      rackGroup.add(nosing);

      if (t < openTiers - 1) {
        populateRealisticBookTier({
          parent: rackGroup,
          axis: 'x',
          spineSign: 1,
          start: -halfW + 0.05,
          end: halfW - 0.05,
          surfaceY: tierY + 0.014,
          depthCenter: 0.012,
          maxDepth: shelfDepth * 0.72,
          maxHeight: tierGap - 0.032,
          seed: seedOffset * 37 + t * 23,
          includeMangaSet: t === 1,
          includeHorizontalStack: t === 0 || t === 2,
          includeRetroGames: true,
        });
      } else {
        // Top tier ornament: stacked artbooks, retro cartridge & ceramic succulent planter
        const topBook1 = new THREE.Mesh(
          createBookGeometry(0.185, 0.026, 0.142, 6),
          bookAtlasMat
        );
        topBook1.position.set(-0.085, tierY + 0.027, 0);
        topBook1.rotation.y = 0.14;
        topBook1.castShadow = true;
        topBook1.receiveShadow = true;
        rackGroup.add(topBook1);

        const topBook2 = new THREE.Mesh(
          createBookGeometry(0.162, 0.022, 0.126, 10),
          bookAtlasMat
        );
        topBook2.position.set(-0.085, tierY + 0.051, 0.005);
        topBook2.rotation.y = -0.18;
        topBook2.castShadow = true;
        topBook2.receiveShadow = true;
        rackGroup.add(topBook2);

        const topCart = new THREE.Mesh(
          createRetroCartridgeGeometry(0.108, 0.015, 0.076),
          retroCartridgeMats[1]
        );
        topCart.position.set(-0.082, tierY + 0.069, 0.008);
        topCart.rotation.y = 0.28;
        topCart.castShadow = true;
        rackGroup.add(topCart);

        const miniPot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.048, 0.038, 0.068, 14),
          ceramicMat
        );
        miniPot.position.set(0.10, tierY + 0.048, 0);
        miniPot.castShadow = true;
        rackGroup.add(miniPot);

        const succulent = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.044, 1),
          plantLeafLightMat
        );
        succulent.scale.set(1.1, 0.72, 1.1);
        succulent.position.set(0.10, tierY + 0.093, 0);
        rackGroup.add(succulent);
      }
    }

    group.add(rackGroup);
    return rackGroup;
  };

  // 1) American Solid-Wood Library Bookcase in Living Room SE Corner (X = 6.76, Z = -0.68)
  buildStandingCornerBookRack(6.76, -0.68, -Math.PI * 0.72, 5, 0.68, 0.34, 1.62, 3);
  addBoxCollider('col_liv_se_book_rack', 6.76, 0.82, -0.68, 0.68, 1.64, 0.68);

  // =========================================================================
  // 10C. ASYMMETRIC WARM GOLDEN STAR FAIRY LIGHTS (NO TV-TOP STRIP!)
  //      (自然非对称暖黄色小星星灯串：沙发后方画廊墙面、西北/东南墙角、单侧窗台与电视柜斜垂)
  // =========================================================================
  {
    const fairyWireMat = mat({ color: 0xb88b48, roughness: 0.35, metalness: 0.65 });
    const miniStarShape = new THREE.Shape();
    for (let p = 0; p < 10; p++) {
      const r = p % 2 === 0 ? 0.019 : 0.008;
      const a = (p / 10) * Math.PI * 2 + Math.PI / 2;
      if (p === 0) miniStarShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else miniStarShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    miniStarShape.closePath();
    const miniStarGeo = new THREE.ExtrudeGeometry(miniStarShape, {
      depth: 0.005,
      bevelEnabled: false,
    });
    miniStarGeo.center();

    const miniStarMat = new THREE.MeshStandardMaterial({
      color: 0xfff0b2,
      emissive: new THREE.Color(0xffd264),
      emissiveIntensity: 2.9,
      roughness: 0.2,
    });
    const miniHaloGeo = new THREE.SphereGeometry(0.034, 8, 6);
    const miniHaloMat = new THREE.MeshBasicMaterial({
      color: 0xffdf84,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const starEntries: { pos: THREE.Vector3; yaw: number }[] = [];

    // Generalized asymmetric 3D fairy-light strand between arbitrary anchor points with uneven sag loops!
    const addAsymmetricFairyStrand = (
      anchors: THREE.Vector3[],
      sags: number[],
      starsPerSpan: number[],
      faceYaw: number
    ) => {
      const allPts: THREE.Vector3[] = [];
      for (let seg = 0; seg < anchors.length - 1; seg++) {
        const p0 = anchors[seg];
        const p1 = anchors[seg + 1];
        const sag = sags[seg] ?? 0.08;
        const steps = 16;
        for (let i = seg === 0 ? 0 : 1; i <= steps; i++) {
          const t = i / steps;
          const pt = p0.clone().lerp(p1, t);
          pt.y -= Math.sin(t * Math.PI) * sag;
          allPts.push(pt);
        }
        const count = starsPerSpan[seg] ?? 6;
        for (let s = 0; s < count; s++) {
          const t = (s + 0.45 + ((s * 7) % 3) * 0.06) / count;
          const pt = p0.clone().lerp(p1, Math.min(0.95, t));
          pt.y -= Math.sin(Math.min(0.95, t) * Math.PI) * sag + 0.013;
          starEntries.push({ pos: pt, yaw: faceYaw });
        }
      }
      const wire = new THREE.Mesh(
        createTaperedCurveGeometry(allPts, 0.0022, 0.0022, Math.max(24, allPts.length * 2), 5),
        fairyWireMat
      );
      group.add(wire);
    };

    // 1) Sofa-Back North Wall Gallery Asymmetric Swag (沙发后方墙面错落斜垂星星灯, Z = -10.27)
    addAsymmetricFairyStrand(
      [
        new THREE.Vector3(0.92, 2.58, -10.27),
        new THREE.Vector3(2.15, 2.66, -10.27),
        new THREE.Vector3(3.38, 2.48, -10.27),
        new THREE.Vector3(4.32, 2.72, -10.27),
      ],
      [0.16, 0.11, 0.21],
      [7, 6, 6],
      0 // Facing +Z toward living room
    );

    // 2) NW Corner Diagonal Cozy Swag behind Small Sofa & Vinyl Cabinet (西北墙角斜跨星星灯)
    addAsymmetricFairyStrand(
      [
        new THREE.Vector3(-1.12, 2.42, -8.35),
        new THREE.Vector3(-1.12, 2.62, -10.18),
        new THREE.Vector3(0.45, 2.34, -10.26),
      ],
      [0.24, 0.17],
      [8, 7],
      Math.PI * 0.25
    );

    // 3) SE Bookcase Corner Casual Diagonal Swag from South Window to American Bookcase Crown (东南墙角)
    addAsymmetricFairyStrand(
      [
        new THREE.Vector3(7.10, 2.36, -2.35),
        new THREE.Vector3(7.12, 2.08, -1.18),
        new THREE.Vector3(6.62, 1.66, -0.52),
      ],
      [0.18, 0.13],
      [6, 5],
      -Math.PI * 0.65
    );

    // 4) Single Casual Asymmetric Sill Strand on North Window (closest to Christmas tree, NO symmetric twin!)
    addAsymmetricFairyStrand(
      [
        new THREE.Vector3(7.12, 1.02, -7.82),
        new THREE.Vector3(7.12, 0.94, -7.08),
        new THREE.Vector3(7.12, 1.06, -6.54),
      ],
      [0.09, 0.05],
      [5, 4],
      -Math.PI / 2
    );

    // 5) Off-Center Casual Accent Swag along North-Half of TV Console Lower Edge (NO TV-top strip!)
    addAsymmetricFairyStrand(
      [
        new THREE.Vector3(6.435, 0.575, -6.26),
        new THREE.Vector3(6.435, 0.562, -5.42),
        new THREE.Vector3(6.435, 0.570, -4.65),
      ],
      [0.075, 0.045],
      [6, 5],
      -Math.PI / 2
    );

    const starsInst = new THREE.InstancedMesh(miniStarGeo, miniStarMat, starEntries.length);
    const halosInst = new THREE.InstancedMesh(miniHaloGeo, miniHaloMat, starEntries.length);
    for (let i = 0; i < starEntries.length; i++) {
      const entry = starEntries[i];
      _instPos.copy(entry.pos);
      _instEuler.set(0, entry.yaw, ((i % 5) - 2) * 0.14);
      _instQuat.setFromEuler(_instEuler);
      _instScale.setScalar(0.85 + (i % 3) * 0.15);
      _instMat.compose(_instPos, _instQuat, _instScale);
      starsInst.setMatrixAt(i, _instMat);

      _instQuat.identity();
      _instScale.setScalar(0.9 + (i % 3) * 0.16);
      _instMat.compose(_instPos, _instQuat, _instScale);
      halosInst.setMatrixAt(i, _instMat);
    }
    starsInst.instanceMatrix.needsUpdate = true;
    starsInst.computeBoundingSphere();
    halosInst.instanceMatrix.needsUpdate = true;
    halosInst.computeBoundingSphere();
    group.add(starsInst, halosInst);

    // Soft warm golden fairy-light PointLights for Sofa-Back Wall & NW Corner
    const galleryFairyGlow = new THREE.PointLight(0xffd076, 0.72, 3.6, 1.9);
    galleryFairyGlow.position.set(2.65, 2.35, -9.85);
    group.add(galleryFairyGlow);

    const nwCornerFairyGlow = new THREE.PointLight(0xffd076, 0.65, 3.2, 1.9);
    nwCornerFairyGlow.position.set(-0.55, 2.20, -9.55);
    group.add(nwCornerFairyGlow);
  }

  // 2) MODERN VINYL TURNTABLE MEDIA CABINET + BOOKSHELF BESIDE THE SMALL SOFA
  //    Tucked diagonally flush into NW corner (X = -0.38, Z = -9.72), matching the small sofa orientation (rotation.y = 0.52)!
  const vinylCabinet = new THREE.Group();
  vinylCabinet.name = 'LivingVinylCabinet';
  vinylCabinet.position.set(-0.38, 0, -9.72);
  vinylCabinet.rotation.y = 0.52; // Same diagonal orientation as armchair (rotation.y = 0.52)

  const cabW = 1.36;
  const cabD = 0.44;
  const legH = 0.16;
  const cabTopY = 0.84;
  const cabBodyH = cabTopY - legH; // 0.68m

  const cabMetalMat = mat({
    color: 0x3b3d46,
    roughness: 0.42,
    metalness: 0.68,
    celStrength: 0.45,
  });
  const brushedAlumMat = mat({
    color: 0xd6dae0,
    roughness: 0.28,
    metalness: 0.78,
    celStrength: 0.38,
  });
  const turntableWalnutMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xd9a87c,
    roughness: 0.46,
    metalness: 0.02,
    woodLacquer: 0.56,
  });
  const turntableDeckCreamMat = mat({
    color: 0xf4eee6,
    roughness: 0.50,
    metalness: 0.04,
    celStrength: 0.40,
  });
  const vinylDiscMat = mat({
    color: 0x181a21,
    roughness: 0.22,
    metalness: 0.22,
    celStrength: 0.35,
  });
  const vinylGrooveMat = mat({
    color: 0x2d323e,
    roughness: 0.18,
    metalness: 0.38,
  });
  const ampChassisMat = mat({
    color: 0x2d313b,
    roughness: 0.38,
    metalness: 0.62,
    celStrength: 0.42,
  });
  const speakerGrilleMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.010,
    color: 0xede5d7,
    roughness: 0.92,
    metalness: 0.0,
    fabricCream: 0.85,
  });

  // Minimalist matte-charcoal steel base frame with 4 tapered support legs & brushed-brass ferrules
  for (const [lx, lz] of [
    [-cabW / 2 + 0.08, -cabD / 2 + 0.06],
    [cabW / 2 - 0.08, -cabD / 2 + 0.06],
    [-cabW / 2 + 0.08, cabD / 2 - 0.06],
    [cabW / 2 - 0.08, cabD / 2 - 0.06],
  ] as const) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.011, legH - 0.018, 12),
      cabMetalMat
    );
    leg.position.set(lx, legH / 2 + 0.009, lz);
    leg.castShadow = true;
    vinylCabinet.add(leg);

    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0115, 0.010, 0.022, 12),
      handleBrassMat
    );
    ferrule.position.set(lx, 0.011, lz);
    vinylCabinet.add(ferrule);
  }
  // Center support leg & slim metal under-frame rails for sturdy modern proportion
  const centerLeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.010, legH - 0.018, 10),
    cabMetalMat
  );
  centerLeg.position.set(0.17, legH / 2 + 0.009, 0);
  vinylCabinet.add(centerLeg);

  for (const rz of [-cabD / 2 + 0.06, cabD / 2 - 0.06]) {
    const underRail = new THREE.Mesh(
      new THREE.BoxGeometry(cabW - 0.16, 0.020, 0.020),
      cabMetalMat
    );
    underRail.position.set(0, legH - 0.014, rz);
    vinylCabinet.add(underRail);
  }
  for (const rx of [-cabW / 2 + 0.08, cabW / 2 - 0.08]) {
    const sideTie = new THREE.Mesh(
      new THREE.BoxGeometry(0.020, 0.018, cabD - 0.12),
      cabMetalMat
    );
    sideTie.position.set(rx, legH - 0.014, 0);
    vinylCabinet.add(sideTie);
  }

  // Warm Honey-Oak Outer Carcass (Top slab, bottom deck, side cheeks, warm back panel)
  const cabTopSlab = new THREE.Mesh(
    createBeveledSlab(cabW + 0.024, 0.032, cabD + 0.018, 0.022, 0.008),
    oakMat
  );
  cabTopSlab.position.y = cabTopY - 0.016;
  cabTopSlab.castShadow = true;
  cabTopSlab.receiveShadow = true;
  outlines.addOutline(cabTopSlab, 1.014);
  vinylCabinet.add(cabTopSlab);

  const cabBotDeck = new THREE.Mesh(
    createBeveledBox(cabW, 0.028, cabD, 0.007, 2),
    oakMat
  );
  cabBotDeck.position.y = legH + 0.014;
  cabBotDeck.castShadow = true;
  cabBotDeck.receiveShadow = true;
  vinylCabinet.add(cabBotDeck);

  for (const sx of [-cabW / 2 + 0.015, cabW / 2 - 0.015]) {
    const cheek = new THREE.Mesh(
      createBeveledBox(0.030, cabBodyH - 0.028, cabD - 0.004, 0.006, 2),
      oakMat
    );
    cheek.position.set(sx, legH + cabBodyH / 2, 0);
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    outlines.addOutline(cheek, 1.014);
    vinylCabinet.add(cheek);
  }

  const cabBackPanel = new THREE.Mesh(
    createBeveledBox(cabW - 0.04, cabBodyH - 0.04, 0.018, 0.003, 1),
    cavityDarkMat
  );
  cabBackPanel.position.set(0, legH + cabBodyH / 2, -cabD / 2 + 0.012);
  cabBackPanel.receiveShadow = true;
  vinylCabinet.add(cabBackPanel);

  // Architectural Interior Partitions:
  // Main vertical divider separating Left Vinyl+Book zone (X = -0.65..+0.17) and Right Bookshelf zone (X = +0.19..+0.65)
  const mainDivider = new THREE.Mesh(
    createBeveledBox(0.024, cabBodyH - 0.052, cabD - 0.036, 0.005, 2),
    oakMat
  );
  mainDivider.position.set(0.18, legH + cabBodyH / 2, 0.004);
  mainDivider.castShadow = true;
  mainDivider.receiveShadow = true;
  vinylCabinet.add(mainDivider);

  // Left Horizontal Shelf at Y = 0.464 -> Upper Vinyl Cubbies (inner H = 0.348m for 12" LPs), Lower-Left Book Bay (H = 0.264m)
  const leftMidShelf = new THREE.Mesh(
    createBeveledBox(0.82, 0.024, cabD - 0.036, 0.005, 2),
    oakMat
  );
  leftMidShelf.position.set(-0.24, 0.464, 0.004);
  leftMidShelf.castShadow = true;
  leftMidShelf.receiveShadow = true;
  vinylCabinet.add(leftMidShelf);

  // Center vertical divider inside upper vinyl bay + 2 slim brushed-brass wire record dividers
  const vinylMidDiv = new THREE.Mesh(
    createBeveledBox(0.022, 0.348, cabD - 0.042, 0.004, 2),
    oakMat
  );
  vinylMidDiv.position.set(-0.24, 0.650, 0.004);
  vinylMidDiv.castShadow = true;
  vinylCabinet.add(vinylMidDiv);

  for (const wx of [-0.445, -0.035]) {
    const wireRodV = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0032, 0.0032, 0.25, 8),
      handleBrassMat
    );
    wireRodV.position.set(wx, 0.60, 0.09);
    vinylCabinet.add(wireRodV);
    const wireRodTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0032, 0.0032, 0.24, 8),
      handleBrassMat
    );
    wireRodTop.rotation.x = Math.PI / 2;
    wireRodTop.position.set(wx, 0.725, -0.03);
    vinylCabinet.add(wireRodTop);
  }

  // Rightmost Bay Enclosed with a Modern Flush-Inset Honey-Oak Cabinet Door + Brushed-Brass Pull Handle
  // Bay spans X = 0.192 .. 0.650 (width 0.458), Y = 0.188 .. 0.808 (height 0.620), front Z = cabD / 2
  {
    const doorW = 0.446;
    const doorH = 0.610;
    const doorCX = 0.422;
    const doorCY = 0.498;
    const doorZ = cabD * 0.5 - 0.009;

    const cabDoorGroup = new THREE.Group();
    cabDoorGroup.position.set(doorCX, doorCY, doorZ);

    // Subtle recessed dark shadow reveal behind the flush-inset door edge (clean modern gap!)
    const doorReveal = new THREE.Mesh(
      new THREE.BoxGeometry(doorW + 0.008, doorH + 0.008, 0.006),
      cavityDarkMat
    );
    doorReveal.position.z = -0.009;
    cabDoorGroup.add(doorReveal);

    // Main beveled warm honey-oak cabinet door slab
    const doorPanel = new THREE.Mesh(
      createBeveledBox(doorW, doorH, 0.020, 0.005, 2),
      oakMat
    );
    doorPanel.castShadow = true;
    doorPanel.receiveShadow = true;
    outlines.addOutline(doorPanel, 1.012);
    cabDoorGroup.add(doorPanel);

    // Subtle minimalist recessed shaker framing accent on front face (same warm oak family)
    const insetFace = new THREE.Mesh(
      createBeveledBox(doorW - 0.068, doorH - 0.068, 0.005, 0.0025, 2),
      turntableWalnutMat
    );
    insetFace.position.z = 0.0095;
    insetFace.receiveShadow = true;
    cabDoorGroup.add(insetFace);

    // Sleek vertical brushed-brass cylinder pull handle & twin standoffs on the left (opening) edge
    const pullX = -doorW * 0.5 + 0.036;
    const pullY = 0.045;
    const pullBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0052, 0.0052, 0.135, 12),
      handleBrassMat
    );
    pullBar.position.set(pullX, pullY, 0.024);
    pullBar.castShadow = true;
    cabDoorGroup.add(pullBar);

    for (const pyOff of [-0.046, 0.046]) {
      const standoff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0038, 0.0038, 0.016, 10),
        handleBrassMat
      );
      standoff.rotation.x = Math.PI / 2;
      standoff.position.set(pullX, pullY + pyOff, 0.016);
      cabDoorGroup.add(standoff);
    }

    vinylCabinet.add(cabDoorGroup);
  }

  // PACK THE TWO TALL VINYL CUBBIES WITH COLORFUL, AIRILY SPACED 12-INCH VINYL LP RECORDS
  const innerSleevePaperMat = mat({ color: 0xf7f2e8, roughness: 0.88, celStrength: 0.38 });
  const vinylBayRanges: [number, number, number][] = [
    [-0.640, -0.456, 11], // Far-left sub-bay
    [-0.434, -0.258, 29], // Mid-left sub-bay
    [-0.222, -0.046, 47], // Mid-right sub-bay
    [-0.024, 0.158, 61],  // Center-right sub-bay
  ];
  const vinylFloorY = 0.476;
  for (let b = 0; b < vinylBayRanges.length; b++) {
    const [bx0, bx1, bSeed] = vinylBayRanges[b];
    // Leave tasteful ~35% airy breathing room in each vinyl cubby so records look curated rather than stuffed
    const fillEnd = bx0 + (bx1 - bx0) * (b % 2 === 0 ? 0.68 : 0.56);
    let vx = bx0 + 0.010;
    let rIdx = 0;
    while (vx < fillEnd - 0.014) {
      const hVal = ((bSeed * 31 + rIdx * 17) * 2654435761) >>> 0;
      const rf1 = (hVal & 0xff) / 255;
      const rf2 = ((hVal >> 8) & 0xff) / 255;
      const rf3 = ((hVal >> 16) & 0xff) / 255;

      const sleeveThick = 0.0062 + rf1 * 0.0038;
      const sleeveSize = 0.312 + (rf2 - 0.5) * 0.006;
      const variantIdx = (b * 3 + rIdx + Math.floor(rf3 * 3)) % 8;

      const isEndLean = vx + sleeveThick + 0.026 >= fillEnd && rIdx >= 2;
      const leanAngle = isEndLean ? -(0.12 + rf1 * 0.06) : (rf2 - 0.5) * 0.032;
      const extraSpan = isEndLean ? Math.abs(Math.sin(leanAngle)) * sleeveSize * 0.45 : 0;
      if (vx + sleeveThick + extraSpan > bx1 - 0.008) break;

      const pullOutZ = 0.018 + rf3 * 0.032; // Varied staggered sleeve edges!
      const lpMesh = new THREE.Mesh(
        createVinylSleeveGeometry(sleeveThick, sleeveSize, variantIdx),
        vinylSleeveMat
      );
      lpMesh.position.set(
        vx + sleeveThick * 0.5 + extraSpan * 0.42,
        vinylFloorY + (sleeveSize * Math.cos(leanAngle)) * 0.5 + 0.002,
        pullOutZ
      );
      lpMesh.rotation.z = leanAngle;
      lpMesh.castShadow = true;
      lpMesh.receiveShadow = true;
      vinylCabinet.add(lpMesh);

      // Subtle paper inner sleeve peeking slightly on every ~4th record for organic realism
      if (rIdx % 4 === 1 && !isEndLean) {
        const innerPeek = new THREE.Mesh(
          new THREE.BoxGeometry(0.0022, sleeveSize * 0.96, 0.012),
          innerSleevePaperMat
        );
        innerPeek.position.set(
          vx + sleeveThick * 0.5,
          vinylFloorY + sleeveSize * 0.49,
          pullOutZ + sleeveSize * 0.5 + 0.003
        );
        vinylCabinet.add(innerPeek);
      }

      vx += sleeveThick + 0.0034 + rf2 * 0.0036 + extraSpan;
      rIdx++;
      if (isEndLean) break;
    }
  }

  // POPULATE THE OPEN LOWER-LEFT BOOK BAY OF THE VINYL CABINET (~50% AIRY FILL, EN/JP BOOKS & RETRO GAMES)
  populateRealisticBookTier({
    parent: vinylCabinet,
    axis: 'x',
    spineSign: 1,
    start: -0.638,
    end: 0.156,
    surfaceY: legH + 0.028,
    depthCenter: 0.055,
    maxDepth: 0.24,
    maxHeight: 0.260,
    seed: 401,
    includeMangaSet: true,
    includeHorizontalStack: true,
    includeRetroGames: true,
  });

  // =========================================================================
  // TABLETOP HI-FI MODERN VINYL TURNTABLE (local X = -0.32, Y = 0.84, Z = 0.01)
  // =========================================================================
  const turntableGroup = new THREE.Group();
  turntableGroup.name = 'LivingVinylTurntable';
  turntableGroup.position.set(-0.32, cabTopY, 0.01);
  turntableGroup.userData.dynamic = true;

  // 4 vibration-damping brass-ringed isolation feet
  for (const [fx, fz] of [
    [-0.19, -0.145],
    [0.19, -0.145],
    [-0.19, 0.145],
    [0.19, 0.145],
  ] as const) {
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 0.014, 14),
      cabMetalMat
    );
    foot.position.set(fx, 0.007, fz);
    turntableGroup.add(foot);

    const footRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0175, 0.0175, 0.004, 14),
      handleBrassMat
    );
    footRing.position.set(fx, 0.011, fz);
    turntableGroup.add(footRing);
  }

  // Two-tier modern plinth: warm walnut/oak body + crisp satin-ivory top trim plate
  const plinthBase = new THREE.Mesh(
    createBeveledBox(0.448, 0.042, 0.356, 0.008, 2),
    turntableWalnutMat
  );
  plinthBase.position.y = 0.035;
  plinthBase.castShadow = true;
  plinthBase.receiveShadow = true;
  outlines.addOutline(plinthBase, 1.015);
  turntableGroup.add(plinthBase);

  const plinthDeck = new THREE.Mesh(
    createBeveledBox(0.432, 0.008, 0.340, 0.003, 2),
    turntableDeckCreamMat
  );
  plinthDeck.position.y = 0.058;
  plinthDeck.receiveShadow = true;
  turntableGroup.add(plinthDeck);

  // Rotary brushed-brass speed/power knob (33/45 RPM) & glowing micro indicator LED (front-left)
  const speedKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.017, 0.014, 18),
    handleBrassMat
  );
  speedKnob.position.set(-0.184, 0.068, 0.132);
  turntableGroup.add(speedKnob);

  const ledBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 10),
    brushedAlumMat
  );
  ledBezel.position.set(-0.152, 0.063, 0.138);
  turntableGroup.add(ledBezel);

  const turntableLedMat = new THREE.MeshBasicMaterial({ color: 0xffb866 });
  const ledDot = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 10, 8), turntableLedMat);
  ledDot.position.set(-0.152, 0.0655, 0.138);
  turntableGroup.add(ledDot);

  // Subtle brushed aluminum pitch slider beside tonearm
  const pitchSlot = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.003, 0.056),
    cabMetalMat
  );
  pitchSlot.position.set(0.182, 0.063, 0.088);
  turntableGroup.add(pitchSlot);
  const pitchFader = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.009, 0.012),
    brushedAlumMat
  );
  pitchFader.position.set(0.182, 0.067, 0.084);
  turntableGroup.add(pitchFader);

  // SPINNING PLATTER + GROOVED 12-INCH VINYL RECORD + COLORED CENTER LABEL
  const platterGroup = new THREE.Group();
  platterGroup.position.set(-0.044, 0.062, 0.006);
  platterGroup.userData.dynamic = true;

  const alumPlatter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.151, 0.154, 0.014, 40),
    brushedAlumMat
  );
  alumPlatter.position.y = 0.007;
  alumPlatter.castShadow = true;
  alumPlatter.receiveShadow = true;
  platterGroup.add(alumPlatter);

  const slipMat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.147, 0.147, 0.003, 36),
    cabMetalMat
  );
  slipMat.position.y = 0.015;
  platterGroup.add(slipMat);

  const vinylDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.146, 0.146, 0.0036, 44),
    vinylDiscMat
  );
  vinylDisc.position.y = 0.0182;
  vinylDisc.receiveShadow = true;
  platterGroup.add(vinylDisc);

  // Fine concentric specular micro-grooves across the playing surface
  for (const gr of [0.138, 0.118, 0.096, 0.072]) {
    const grooveRing = new THREE.Mesh(
      new THREE.TorusGeometry(gr, 0.0009, 6, 48),
      vinylGrooveMat
    );
    grooveRing.rotation.x = Math.PI / 2;
    grooveRing.position.y = 0.0202;
    platterGroup.add(grooveRing);
  }

  // Colored Center Paper Label (updates dynamically per Lo-Fi track!)
  const initialTrack = LOFI_TRACKS[0];
  const recordLabelMat = new THREE.MeshStandardMaterial({
    color: initialTrack.labelHex,
    roughness: 0.72,
    metalness: 0.0,
  });
  const recordLabelAccentMat = new THREE.MeshStandardMaterial({
    color: initialTrack.accentHex,
    roughness: 0.65,
    metalness: 0.04,
  });
  const centerLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.049, 0.049, 0.0012, 28),
    recordLabelMat
  );
  centerLabel.position.y = 0.0204;
  platterGroup.add(centerLabel);

  const labelAccentArc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 0.0015, 24, 1, false, 0, Math.PI * 0.92),
    recordLabelAccentMat
  );
  labelAccentArc.position.y = 0.0207;
  platterGroup.add(labelAccentArc);

  // Inner ring + printed white stripe marker (makes 33⅓ RPM spin visibly readable!)
  const labelMarkerBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.0012, 0.0045),
    turntableDeckCreamMat
  );
  labelMarkerBar.position.set(0.016, 0.0214, 0.008);
  platterGroup.add(labelMarkerBar);

  const spindle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0036, 0.0036, 0.016, 12),
    brushedAlumMat
  );
  spindle.position.y = 0.027;
  platterGroup.add(spindle);

  turntableGroup.add(platterGroup);

  // TONEARM BASE + PIVOTING S-CURVED METAL TONEARM + HEADSHELL & STYLUS
  const tonearmBaseRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.038, 0.012, 24),
    cabMetalMat
  );
  tonearmBaseRing.position.set(0.156, 0.066, -0.098);
  turntableGroup.add(tonearmBaseRing);

  const tonearmRestPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0035, 0.004, 0.024, 8),
    cabMetalMat
  );
  tonearmRestPost.position.set(0.158, 0.072, -0.016);
  turntableGroup.add(tonearmRestPost);
  const tonearmRestCradle = new THREE.Mesh(
    new THREE.TorusGeometry(0.006, 0.0018, 6, 10, Math.PI),
    cabMetalMat
  );
  tonearmRestCradle.rotation.z = Math.PI;
  tonearmRestCradle.position.set(0.158, 0.085, -0.016);
  turntableGroup.add(tonearmRestCradle);

  const tonearmPivot = new THREE.Group();
  tonearmPivot.position.set(0.156, 0.088, -0.098);
  tonearmPivot.userData.dynamic = true;

  const gimbal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.024, 16),
    brushedAlumMat
  );
  tonearmPivot.add(gimbal);

  const counterweight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.024, 16),
    brushedAlumMat
  );
  counterweight.rotation.x = Math.PI / 2;
  counterweight.position.set(0, 0.002, -0.036);
  tonearmPivot.add(counterweight);

  // Graceful S-curved aluminum tonearm sweeping from gimbal toward platter groove
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.002, -0.044),
    new THREE.Vector3(0, 0.002, 0.048),
    new THREE.Vector3(0.008, 0.002, 0.112),
    new THREE.Vector3(-0.008, 0.001, 0.168),
    new THREE.Vector3(-0.026, -0.002, 0.202),
  ]);
  const armTube = new THREE.Mesh(
    new THREE.TubeGeometry(armCurve, 22, 0.0032, 8, false),
    brushedAlumMat
  );
  armTube.castShadow = true;
  tonearmPivot.add(armTube);

  // Matte-charcoal angled headshell + brass finger lift + ruby cartridge
  const headshell = new THREE.Mesh(
    createBeveledBox(0.015, 0.010, 0.032, 0.002, 1),
    cabMetalMat
  );
  headshell.position.set(-0.032, -0.003, 0.214);
  headshell.rotation.y = -0.36;
  tonearmPivot.add(headshell);

  const fingerLift = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0012, 0.0012, 0.018, 6),
    handleBrassMat
  );
  fingerLift.rotation.z = Math.PI / 2;
  fingerLift.position.set(-0.020, -0.001, 0.210);
  tonearmPivot.add(fingerLift);

  const cartridgeBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.011, 0.009, 0.018),
    handleBrassMat
  );
  cartridgeBody.position.set(-0.032, -0.009, 0.215);
  cartridgeBody.rotation.y = -0.36;
  tonearmPivot.add(cartridgeBody);

  turntableGroup.add(tonearmPivot);

  // HINGED SEMI-TRANSPARENT OPTICAL ACRYLIC DUST COVER (Propped slightly open ~25° on twin chrome hinges!)
  for (const hx of [-0.155, 0.155]) {
    const hinge = new THREE.Mesh(
      createBeveledBox(0.028, 0.022, 0.014, 0.003, 1),
      brushedAlumMat
    );
    hinge.position.set(hx, 0.056, -0.178);
    turntableGroup.add(hinge);
  }
  const acrylicGlassMat = createArchitecturalGlassMaterial(uniforms, {
    tintHex: 0x4e525c,
    edgeTintHex: 0x2f333c,
    baseOpacity: 0.34,
    maxFresnelOpacity: 0.68,
    bevelWidth: 0.045,
  });
  const dustCoverPivot = new THREE.Group();
  dustCoverPivot.position.set(0, 0.062, -0.176);
  dustCoverPivot.rotation.x = -0.44; // Propped cleanly open ~25 degrees!
  dustCoverPivot.userData.dynamic = true;

  const dcW = 0.444;
  const dcH = 0.068;
  const dcD = 0.352;
  const dcT = 0.0042;
  const acrylicPanes: [number, number, number, number, number, number][] = [
    [0, dcH, dcD / 2, dcW, dcT, dcD],                 // Top sheet
    [0, dcH / 2, dcD, dcW, dcH, dcT],                 // Front wall
    [0, dcH / 2, 0, dcW, dcH, dcT],                   // Rear wall
    [-dcW / 2, dcH / 2, dcD / 2, dcT, dcH, dcD],      // Left wall
    [dcW / 2, dcH / 2, dcD / 2, dcT, dcH, dcD],       // Right wall
  ];
  for (const [px, py, pz, pw, ph, pd] of acrylicPanes) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), acrylicGlassMat);
    pane.position.set(px, py, pz);
    pane.castShadow = false;
    pane.receiveShadow = false;
    dustCoverPivot.add(pane);
  }
  turntableGroup.add(dustCoverPivot);
  vinylCabinet.add(turntableGroup);

  // =========================================================================
  // "NOW PLAYING" OAK & BRASS VINYL DISPLAY EASEL (local X = +0.13, Y = 0.84)
  // =========================================================================
  const easelGroup = new THREE.Group();
  easelGroup.position.set(0.13, cabTopY, -0.02);
  easelGroup.userData.dynamic = true;

  const easelBase = new THREE.Mesh(
    createBeveledBox(0.22, 0.022, 0.092, 0.005, 2),
    oakMat
  );
  easelBase.position.y = 0.011;
  easelBase.castShadow = true;
  easelBase.receiveShadow = true;
  easelGroup.add(easelBase);

  const easelBrassBar = new THREE.Mesh(
    createBeveledBox(0.14, 0.008, 0.005, 0.001, 1),
    handleBrassMat
  );
  easelBrassBar.position.set(0, 0.012, 0.047);
  easelGroup.add(easelBrassBar);

  for (const rx of [-0.068, 0.068]) {
    const easelRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0032, 0.0032, 0.22, 8),
      handleBrassMat
    );
    easelRod.position.set(rx, 0.115, -0.036);
    easelRod.rotation.x = -0.22;
    easelGroup.add(easelRod);
  }

  // Dynamic "Now Playing" 12-inch LP Sleeve (swaps cover art cleanly when switching tracks!)
  const nowPlayingSleeveGeos = LOFI_TRACKS.map((tr) =>
    createVinylSleeveGeometry(0.008, 0.308, tr.sleeveVariantIdx)
  );
  const nowPlayingSleeveMesh = new THREE.Mesh(nowPlayingSleeveGeos[0], vinylSleeveMat);
  nowPlayingSleeveMesh.position.set(0, 0.170, 0.002);
  nowPlayingSleeveMesh.rotation.set(-0.18, Math.PI / 2, 0);
  nowPlayingSleeveMesh.castShadow = true;
  nowPlayingSleeveMesh.receiveShadow = true;
  nowPlayingSleeveMesh.userData.dynamic = true;
  easelGroup.add(nowPlayingSleeveMesh);
  vinylCabinet.add(easelGroup);

  // =========================================================================
  // COMPACT RETRO-MODERN STEREO MINI AMPLIFIER + MATCHING MINI MONITOR SPEAKER
  // =========================================================================
  const ampGroup = new THREE.Group();
  ampGroup.name = 'LivingVinylMiniAmp';
  ampGroup.position.set(0.415, cabTopY, 0.025);
  ampGroup.userData.dynamic = true;

  const ampChassis = new THREE.Mesh(
    createBeveledBox(0.20, 0.086, 0.23, 0.005, 2),
    ampChassisMat
  );
  ampChassis.position.y = 0.050;
  ampChassis.castShadow = true;
  ampChassis.receiveShadow = true;
  outlines.addOutline(ampChassis, 1.018);
  ampGroup.add(ampChassis);

  // Warm oak wooden side cheeks flanking the brushed-metal amp chassis
  for (const sx of [-0.104, 0.104]) {
    const ampCheek = new THREE.Mesh(
      createBeveledBox(0.012, 0.084, 0.226, 0.003, 1),
      turntableWalnutMat
    );
    ampCheek.position.set(sx, 0.050, 0);
    ampCheek.castShadow = true;
    ampGroup.add(ampCheek);
  }

  // Twin warm-amber illuminated VU meters on the amp front panel
  const vuGlowMats: THREE.MeshBasicMaterial[] = [];
  for (const vx of [-0.044, 0.044]) {
    const vuMat = new THREE.MeshBasicMaterial({ color: 0x5c4734 });
    vuGlowMats.push(vuMat);
    const vuWindow = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.032, 0.004), vuMat);
    vuWindow.position.set(vx, 0.064, 0.115);
    ampGroup.add(vuWindow);

    const vuNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.024, 0.002), ampChassisMat);
    vuNeedle.position.set(vx - 0.008, 0.060, 0.1175);
    vuNeedle.rotation.z = 0.28;
    ampGroup.add(vuNeedle);
  }

  // Knurled brushed-brass Volume & Tone rotary knobs + mini toggle switch
  for (const [kx, kr] of [
    [-0.062, 0.014],
    [0.062, 0.011],
  ] as const) {
    const ampKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(kr, kr, 0.014, 16),
      handleBrassMat
    );
    ampKnob.rotation.x = Math.PI / 2;
    ampKnob.position.set(kx, 0.027, 0.121);
    ampGroup.add(ampKnob);
  }
  const ampToggle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0028, 0.0028, 0.014, 8),
    brushedAlumMat
  );
  ampToggle.rotation.x = Math.PI / 2 - 0.35;
  ampToggle.position.set(0, 0.027, 0.121);
  ampGroup.add(ampToggle);

  vinylCabinet.add(ampGroup);

  // Matching Compact Oak Bookshelf Monitor Speaker beside the Mini Amp
  const miniSpeaker = new THREE.Group();
  miniSpeaker.position.set(0.595, cabTopY, -0.02);
  miniSpeaker.rotation.y = -0.14;
  const spBody = new THREE.Mesh(
    createBeveledBox(0.138, 0.215, 0.165, 0.007, 2),
    oakMat
  );
  spBody.position.y = 0.1075;
  spBody.castShadow = true;
  spBody.receiveShadow = true;
  outlines.addOutline(spBody, 1.016);
  miniSpeaker.add(spBody);

  const spGrille = new THREE.Mesh(
    createBeveledBox(0.120, 0.192, 0.014, 0.004, 1),
    speakerGrilleMat
  );
  spGrille.position.set(0, 0.108, 0.080);
  miniSpeaker.add(spGrille);

  const spBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.007, 0.004),
    handleBrassMat
  );
  spBadge.position.set(0, 0.026, 0.087);
  miniSpeaker.add(spBadge);
  vinylCabinet.add(miniSpeaker);

  group.add(vinylCabinet);
  addBoxCollider('col_liv_vinyl_cabinet', -0.42, 0.54, -9.72, 1.18, 1.08, 0.92);

  // Register Turntable Animation & Visual State Rig on ctx
  const applyTrackState = (trackIndex: number, isPlaying: boolean) => {
    const safeIdx = ((trackIndex % LOFI_TRACKS.length) + LOFI_TRACKS.length) % LOFI_TRACKS.length;
    const track = LOFI_TRACKS[safeIdx];
    if (ctx.turntableRig) {
      ctx.turntableRig.currentTrackIndex = safeIdx;
      ctx.turntableRig.isPlaying = isPlaying;
    }
    recordLabelMat.color.setHex(track.labelHex);
    recordLabelAccentMat.color.setHex(track.accentHex);
    turntableLedMat.color.setHex(isPlaying ? 0x6dffb4 : 0xffb866);
    nowPlayingSleeveMesh.geometry = nowPlayingSleeveGeos[safeIdx];
    for (let i = 0; i < vuGlowMats.length; i++) {
      vuGlowMats[i].color.setHex(isPlaying ? 0xffd288 : 0x5c4734);
    }
  };

  ctx.turntableRig = {
    worldPos: new THREE.Vector3(-0.38, 0.92, -9.72),
    platterGroup,
    tonearmPivot,
    labelMat: recordLabelMat,
    labelAccentMat: recordLabelAccentMat,
    ledMat: turntableLedMat,
    vuGlowMats,
    nowPlayingSleeveMesh,
    isPlaying: false,
    currentTrackIndex: 0,
    spinSpeed: 0,
    armAngle: 0,
    applyTrackState,
  };

  // Interactive Target 1: Turntable & Vinyl Disc -> Play, cycle through all 4 Lo-Fi tracks, and Pause
  registerInteractable(
    'liv_turntable',
    '现代黑胶唱片机',
    '播放 / 切换曲目 / 暂停',
    'living',
    turntableGroup,
    () => {
      if (!turntableControls) {
        return {
          title: '现代黑胶唱片机',
          message: '黑胶唱盘正静静等待落针。',
        };
      }
      const res = turntableControls.onCycleTurntable();
      applyTrackState(res.trackIndex, res.playing);
      if (!res.playing) {
        return {
          title: '黑胶唱片机 · 已暂停',
          message: '轻抬唱臂离开黑胶纹路，彩色圆标缓缓停转，客厅回归宁静。（再次点击可重新播放）',
        };
      }
      return {
        title: `黑胶唱片 · ${res.track.side}《${res.track.title}》`,
        message: `${res.track.englishTitle} · ${res.track.moodNote}（再次点击唱片可切换下一首或暂停，点击右侧功放可随时暂停/继续）`,
      };
    }
  );

  // Interactive Target 2: Mini Amp -> Direct Pause / Resume without skipping track
  registerInteractable(
    'liv_vinyl_amp',
    '桌面迷你功放',
    '暂停 / 继续播放唱片',
    'living',
    ampGroup,
    () => {
      if (!turntableControls) {
        return {
          title: '桌面迷你功放',
          message: '暖黄色的 VU 表微微发亮。',
        };
      }
      const res = turntableControls.onTogglePlay();
      applyTrackState(res.trackIndex, res.playing);
      return res.playing
        ? {
            title: `继续播放 · ${res.track.side}《${res.track.title}》`,
            message: `唱针轻落，空灵清透的电钢琴泛音独奏伴随极轻黑胶底噪在客厅散开（${res.track.bpm} BPM）。`,
          }
        : {
            title: '黑胶唱片机 · 已暂停',
            message: '抬起了金属唱臂，暖色 VU 表暗了下来，客厅回归安静。',
          };
    }
  );

  // Interactive Target 3: Now Playing Record Easel -> Skip directly to next Electric Piano Solo track
  registerInteractable(
    'liv_vinyl_easel',
    '正在播放唱片架',
    '切换下一首电钢琴独奏唱片',
    'living',
    easelGroup,
    () => {
      if (!turntableControls) {
        return {
          title: '正在播放唱片架',
          message: '展示架上斜倚着一张色彩柔和的 12 寸电钢琴独奏黑胶封套。',
        };
      }
      const res = turntableControls.onNextTrack();
      applyTrackState(res.trackIndex, res.playing);
      return {
        title: `切换唱片 · ${res.track.side}《${res.track.title}》`,
        message: `${res.track.englishTitle} · ${res.track.moodNote}`,
      };
    }
  );

  // =========================================================================
  // 11. STYLIZED ANIME SILHOUETTE FIGURE (Dynamic - Revealed in Meta Mode)
  // =========================================================================
  const figure = new THREE.Group();
  figure.name = 'UncannySilhouette';
  figure.position.set(5.10, 0, -3.95);
  figure.rotation.y = -2.35;
  figure.visible = false;
  figure.userData.dynamic = true;

  const skinMat = mat({ color: 0xf0d6cf, roughness: 0.72 });
  const hairMat = mat({ color: 0x222038, roughness: 0.52 });
  const cardiganMat = mat({ color: 0xb53c48, roughness: 0.78 });
  const skirtMat = mat({ color: 0x2f539e, roughness: 0.76 });
  const tightsMat = mat({ color: 0x252333, roughness: 0.62 });
  const slipperMat = mat({ color: 0xc84b58, roughness: 0.68 });

  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.052, 0.56, 6, 12),
      tightsMat
    );
    leg.position.set(side * 0.11, 0.36, side * 0.08);
    leg.rotation.x = side * 0.22;
    leg.castShadow = true;
    outlines.addOutline(leg, 1.045);
    figure.add(leg);

    const shoe = new THREE.Mesh(
      createBeveledBox(0.11, 0.055, 0.23, 0.02, 3),
      slipperMat
    );
    shoe.position.set(side * 0.11, 0.028, side * 0.16);
    figure.add(shoe);
  }

  const skirtPts = [
    new THREE.Vector2(0.11, 0.38),
    new THREE.Vector2(0.13, 0.34),
    new THREE.Vector2(0.27, 0.02),
    new THREE.Vector2(0.25, 0),
  ];
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtPts, 18), skirtMat);
  skirt.position.y = 0.62;
  skirt.castShadow = true;
  outlines.addOutline(skirt, 1.035);
  figure.add(skirt);

  const torso = new THREE.Mesh(
    createPlushBox(0.26, 0.42, 0.2, 0.06, 0.12),
    cardiganMat
  );
  torso.position.y = 1.15;
  torso.castShadow = true;
  outlines.addOutline(torso, 1.035);
  figure.add(torso);

  const collar = new THREE.Mesh(
    createBeveledBox(0.11, 0.34, 0.05, 0.012, 2),
    ceramicMat
  );
  collar.position.set(0, 1.15, 0.09);
  figure.add(collar);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.042, 0.36, 6, 10),
      cardiganMat
    );
    arm.position.set(side * 0.17, 1.12, 0.11);
    arm.rotation.set(-0.7, 0, side * -0.25);
    arm.castShadow = true;
    outlines.addOutline(arm, 1.04);
    figure.add(arm);
  }

  const katanaGroup = new THREE.Group();
  katanaGroup.position.set(0.04, 0.98, 0.24);
  katanaGroup.rotation.set(0.45, 0.1, -0.65);

  const scabbard = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.012, 0.78, 10),
    mat({ color: 0x1e1829, roughness: 0.28, metalness: 0.45 })
  );
  scabbard.scale.set(0.75, 1, 1.3);
  scabbard.position.y = -0.12;
  scabbard.castShadow = true;
  katanaGroup.add(scabbard);

  const tsuba = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.012, 14),
    mat({ color: 0xd4a459, roughness: 0.3, metalness: 0.8 })
  );
  tsuba.position.y = 0.27;
  katanaGroup.add(tsuba);

  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.015, 0.24, 10),
    mat({ color: 0x3b2338, roughness: 0.65 })
  );
  hilt.scale.set(0.75, 1, 1.25);
  hilt.position.y = 0.39;
  katanaGroup.add(hilt);
  figure.add(katanaGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.132, 20, 18), skinMat);
  head.position.y = 1.48;
  head.castShadow = true;
  figure.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.148, 20, 18), hairMat);
  hairCap.position.set(0, 1.51, -0.018);
  hairCap.scale.set(1.08, 1.06, 1.1);
  outlines.addOutline(hairCap, 1.04);
  figure.add(hairCap);

  const hairBob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.165, 0.2, 16),
    hairMat
  );
  hairBob.position.set(0, 1.42, -0.025);
  outlines.addOutline(hairBob, 1.035);
  figure.add(hairBob);

  metaState.silhouetteGroup = figure;
  group.add(figure);

  // =========================================================================
  // 12. MERGE ALL STATIC ARCHITECTURAL STRUCTURES & FURNITURE INTO A SINGLE
  //     BUFFERGEOMETRY VIA BufferGeometryUtils.mergeGeometries!
  // =========================================================================
  // First merge static sub-meshes inside figure's katana (keeping figure toggleable)
  const katanaGeos: THREE.BufferGeometry[] = [];
  const katanaMats: THREE.Material[] = [];
  katanaGroup.updateMatrixWorld(true);
  const figInv = figure.matrixWorld.clone().invert();
  for (const child of [...katanaGroup.children]) {
    const m = child as THREE.Mesh;
    if (m.isMesh && !Array.isArray(m.material)) {
      const rel = new THREE.Matrix4().multiplyMatrices(figInv, m.matrixWorld);
      katanaGeos.push(normalizeGeometryForMerge(m.geometry, rel));
      katanaMats.push(m.material);
      katanaGroup.remove(m);
      m.geometry.dispose();
    }
  }
  if (katanaGeos.length > 0) {
    const mergedKatanaGeo = BufferGeometryUtils.mergeGeometries(katanaGeos, true);
    for (const g of katanaGeos) g.dispose();
    if (mergedKatanaGeo) {
      const mergedKatana = new THREE.Mesh(mergedKatanaGeo, katanaMats);
      mergedKatana.castShadow = true;
      figure.add(mergedKatana);
      figure.remove(katanaGroup);
    }
  }

  // =========================================================================
  // 11B. EXQUISITE MODERN DUAL-HALO ARCHITECTURAL CHANDELIER + TWIN RECESSED
  //      DOWNLIGHTS + TACTILE CHAMPAGNE-GOLD WALL SWITCHES
  //      Default OFF (preserves exact baseline lighting & shadow mood);
  //      Switching ON floods the entire Living Room evenly ("亮堂堂")!
  // =========================================================================
  const brightRig = metaState.livingBrightLight;
  const champagneGoldMat = mat({
    color: 0xe8c994,
    roughness: 0.24,
    metalness: 0.86,
    celStrength: 0.42,
  });
  const switchPlateMat = mat({ color: 0xfdfaf6, roughness: 0.74, metalness: 0.0 });
  const switchRockerMat = mat({ color: 0xfffdfb, roughness: 0.68, metalness: 0.0 });

  // Shared dynamic luminous diffuser material (warm-white frosted milk-glass glow — never cold gray!)
  const chandelierGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff4e2 });
  brightRig.bulbMats.push(chandelierGlowMat);

  // Matte-white & soft-satin ABS plastic shell materials for the flat ceiling panel lamp
  const plasticShellMat = mat({
    color: 0xf6f4f0,
    roughness: 0.44,
    metalness: 0.02,
    celStrength: 0.45,
  });
  const plasticTrimMat = mat({
    color: 0xe6e3de,
    roughness: 0.50,
    metalness: 0.04,
    celStrength: 0.45,
  });
  const plasticGrooveMat = mat({
    color: 0xc9c6c0,
    roughness: 0.62,
    metalness: 0.05,
    celStrength: 0.45,
  });

  // 1) Central Vintage Wooden 5-Blade Ceiling Fan-Light Combo (复古木质吊扇一体灯，短吊杆)
  //    Mounted on ceilingGroup at Living Room tray center (3.12, 3.28, -5.08) so Overview Mode hides it cleanly!
  {
    const antiqueBrassMat = mat({
      color: 0xc9a05c,
      roughness: 0.28,
      metalness: 0.84,
      celStrength: 0.42,
    });
    const vintageBronzeMat = mat({
      color: 0x4f3b2c,
      roughness: 0.42,
      metalness: 0.62,
      celStrength: 0.48,
    });
    const fanWoodBladeMat = mat({
      map: textures.furnitureOak,
      bumpMap: textures.furnitureWoodBump,
      bumpScale: 0.005,
      color: 0xa97244,
      roughness: 0.46,
      metalness: 0.0,
      woodLacquer: 0.62,
    });
    const fanCaneInlayMat = mat({
      map: textures.furnitureOak,
      color: 0xd2a874,
      roughness: 0.56,
      metalness: 0.0,
      woodLacquer: 0.42,
    });

    const fanRoot = new THREE.Group();
    fanRoot.name = 'LivingVintageCeilingFanLamp';
    fanRoot.position.set(3.12, 3.28, -5.08);
    fanRoot.userData.dynamic = true;

    // 1A. Static Vintage Mount, Short Downrod Shaft, Motor Housing & Milk-Glass Light Kit
    const fanStaticGroup = new THREE.Group();
    fanStaticGroup.userData.dynamic = true;

    // Stepped vintage antique-brass ceiling canopy (covers tray center flush at Y=0)
    const canopyPts = [
      new THREE.Vector2(0.016, -0.044),
      new THREE.Vector2(0.042, -0.042),
      new THREE.Vector2(0.078, -0.026),
      new THREE.Vector2(0.114, -0.014),
      new THREE.Vector2(0.126, -0.004),
      new THREE.Vector2(0.126, 0.0),
    ];
    const canopyMesh = new THREE.Mesh(
      new THREE.LatheGeometry(canopyPts, 28),
      antiqueBrassMat
    );
    outlines.addOutline(canopyMesh, 1.018);
    fanStaticGroup.add(canopyMesh);

    // Short vintage brushed-brass downrod shaft (短轴设计: ~7.8cm visible drop)
    const shortShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0155, 0.0155, 0.088, 16),
      antiqueBrassMat
    );
    shortShaft.position.y = -0.082;
    fanStaticGroup.add(shortShaft);

    // Turned brass coupling collar at top of motor housing
    const collarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.046, 0.026, 20),
      antiqueBrassMat
    );
    collarMesh.position.y = -0.118;
    fanStaticGroup.add(collarMesh);

    // Classic curved vintage oil-rubbed bronze motor housing drum (bottom-to-top Y for outward normals)
    const motorPts = [
      new THREE.Vector2(0.098, -0.216),
      new THREE.Vector2(0.132, -0.212),
      new THREE.Vector2(0.162, -0.194),
      new THREE.Vector2(0.168, -0.168),
      new THREE.Vector2(0.156, -0.144),
      new THREE.Vector2(0.112, -0.126),
      new THREE.Vector2(0.044, -0.120),
    ];
    const motorHousing = new THREE.Mesh(
      new THREE.LatheGeometry(motorPts, 32),
      vintageBronzeMat
    );
    motorHousing.castShadow = true;
    outlines.addOutline(motorHousing, 1.018);
    fanStaticGroup.add(motorHousing);

    // Upper & lower spun antique-brass accent trim rings around motor housing
    for (const [ry, rad] of [
      [-0.145, 0.157],
      [-0.194, 0.161],
    ] as const) {
      const trimRing = new THREE.Mesh(
        new THREE.TorusGeometry(rad, 0.0055, 8, 32),
        antiqueBrassMat
      );
      trimRing.rotation.x = Math.PI / 2;
      trimRing.position.y = ry;
      fanStaticGroup.add(trimRing);
    }

    // Ornate stepped antique-brass light-kit fitter gallery beneath the motor (bottom-to-top Y)
    const fitterPts = [
      new THREE.Vector2(0.098, -0.254),
      new THREE.Vector2(0.118, -0.252),
      new THREE.Vector2(0.124, -0.238),
      new THREE.Vector2(0.114, -0.224),
      new THREE.Vector2(0.104, -0.214),
    ];
    const lightFitter = new THREE.Mesh(
      new THREE.LatheGeometry(fitterPts, 32),
      antiqueBrassMat
    );
    fanStaticGroup.add(lightFitter);

    // Decorative beaded brass gallery lip ring framing the top of the fluted shade
    const galleryBeadRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.116, 0.0052, 10, 36),
      antiqueBrassMat
    );
    galleryBeadRing.rotation.x = Math.PI / 2;
    galleryBeadRing.position.y = -0.252;
    fanStaticGroup.add(galleryBeadRing);

    // Sculpted 16-flute vintage lotus/bell-tulip frosted milk-glass lantern shade (优化复古花瓣棱纹乳白玻璃灯罩)
    const globePts = [
      new THREE.Vector2(0.0, -0.402),
      new THREE.Vector2(0.044, -0.398),
      new THREE.Vector2(0.102, -0.384),
      new THREE.Vector2(0.156, -0.354),
      new THREE.Vector2(0.184, -0.318),
      new THREE.Vector2(0.172, -0.284),
      new THREE.Vector2(0.134, -0.264),
      new THREE.Vector2(0.104, -0.248),
    ];
    const flutedShadeGeo = new THREE.LatheGeometry(globePts, 64);
    const shadePos = flutedShadeGeo.attributes.position;
    for (let i = 0; i < shadePos.count; i++) {
      const vx = shadePos.getX(i);
      const vy = shadePos.getY(i);
      const vz = shadePos.getZ(i);
      const r = Math.hypot(vx, vz);
      if (r > 0.025) {
        const ang = Math.atan2(vz, vx);
        // Smooth radial bell-petal flutes strongest around the belly (-0.36 .. -0.27)
        const bellyT = Math.max(0, Math.min(1, 1 - Math.abs(vy + 0.325) / 0.072));
        const fluteAmp = 0.0072 * bellyT * bellyT;
        const nextR = r + Math.cos(ang * 16) * fluteAmp;
        const scale = nextR / r;
        shadePos.setX(i, vx * scale);
        shadePos.setZ(i, vz * scale);
      }
    }
    flutedShadeGeo.computeVertexNormals();
    const milkGlassGlobe = new THREE.Mesh(flutedShadeGeo, chandelierGlowMat);
    outlines.addOutline(milkGlassGlobe, 1.015);
    fanStaticGroup.add(milkGlassGlobe);

    // Slender antique-brass equatorial accent ring + 4 sculpted lantern ribs cradling the fluted glass shade
    const waistRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.184, 0.0042, 8, 40),
      antiqueBrassMat
    );
    waistRing.rotation.x = Math.PI / 2;
    waistRing.position.y = -0.318;
    fanStaticGroup.add(waistRing);

    for (let rIdx = 0; rIdx < 4; rIdx++) {
      const a = (rIdx / 4) * Math.PI * 2 + Math.PI / 4;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const ribPts = [
        new THREE.Vector3(ca * 0.114, -0.252, sa * 0.114),
        new THREE.Vector3(ca * 0.156, -0.276, sa * 0.156),
        new THREE.Vector3(ca * 0.190, -0.318, sa * 0.190),
        new THREE.Vector3(ca * 0.158, -0.362, sa * 0.158),
        new THREE.Vector3(ca * 0.088, -0.392, sa * 0.088),
        new THREE.Vector3(ca * 0.028, -0.405, sa * 0.028),
      ];
      const ribGeo = createTaperedCurveGeometry(ribPts, 0.0036, 0.0030, 14, 6);
      const ribMesh = new THREE.Mesh(ribGeo, antiqueBrassMat);
      fanStaticGroup.add(ribMesh);
    }

    // Stepped vintage lotus-cap antique-brass bottom finial (sculpted turned acorn drop)
    const finialCapPts = [
      new THREE.Vector2(0.0, -0.436),
      new THREE.Vector2(0.011, -0.428),
      new THREE.Vector2(0.014, -0.418),
      new THREE.Vector2(0.008, -0.412),
      new THREE.Vector2(0.024, -0.408),
      new THREE.Vector2(0.036, -0.400),
      new THREE.Vector2(0.032, -0.396),
    ];
    const finialCap = new THREE.Mesh(
      new THREE.LatheGeometry(finialCapPts, 20),
      antiqueBrassMat
    );
    fanStaticGroup.add(finialCap);

    // Twin delicate vintage brass pull chains with turned walnut teardrop fobs
    for (const [ang, len] of [
      [0.45, 0.115],
      [1.05, 0.088],
    ] as const) {
      const px = Math.cos(ang) * 0.102;
      const pz = Math.sin(ang) * 0.102;
      const chain = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0022, 0.0022, len, 6),
        antiqueBrassMat
      );
      chain.position.set(px, -0.240 - len * 0.5, pz);
      fanStaticGroup.add(chain);

      const fob = new THREE.Mesh(
        new THREE.SphereGeometry(0.0085, 10, 8),
        fanWoodBladeMat
      );
      fob.scale.set(0.85, 1.45, 0.85);
      fob.position.set(px, -0.240 - len - 0.008, pz);
      fanStaticGroup.add(fob);
    }

    mergeDynamicSubtreeMeshes(fanStaticGroup, outlines, 'LivingVintageFanStaticMerged');
    fanRoot.add(fanStaticGroup);

    // 1B. Dynamic Rotating 5-Blade Vintage Walnut Wood Rotor Hub (spins smoothly in render loop!)
    const fanRotor = new THREE.Group();
    fanRotor.name = 'LivingVintageFanRotor';
    fanRotor.position.set(0, -0.170, 0);
    fanRotor.userData.dynamic = true;

    // Build graceful vintage beveled teardrop wooden paddle blade geometry
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0.195, -0.048);
    bladeShape.quadraticCurveTo(0.36, -0.064, 0.56, -0.072);
    bladeShape.quadraticCurveTo(0.655, -0.072, 0.672, -0.022);
    bladeShape.quadraticCurveTo(0.676, 0.0, 0.672, 0.022);
    bladeShape.quadraticCurveTo(0.655, 0.072, 0.56, 0.072);
    bladeShape.quadraticCurveTo(0.36, 0.064, 0.195, 0.048);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.007,
      bevelEnabled: true,
      bevelThickness: 0.0028,
      bevelSize: 0.0036,
      bevelSegments: 2,
    });
    // Lay blade flat in XZ plane (center Y=0) and normalize planar UVs along wood grain
    bladeGeo.rotateX(Math.PI / 2);
    bladeGeo.translate(0, 0.0035, 0);
    {
      const bPos = bladeGeo.attributes.position as THREE.BufferAttribute;
      const bUv = bladeGeo.attributes.uv as THREE.BufferAttribute;
      for (let vi = 0; vi < bPos.count; vi++) {
        bUv.setXY(
          vi,
          THREE.MathUtils.clamp((bPos.getX(vi) - 0.18) / 0.52, 0.02, 0.98),
          THREE.MathUtils.clamp((bPos.getZ(vi) + 0.08) / 0.16, 0.02, 0.98)
        );
      }
      bUv.needsUpdate = true;
    }

    // Subtle decorative lighter wood/cane inlay panel set on the underside & top of each blade
    const inlayShape = new THREE.Shape();
    inlayShape.moveTo(0.285, -0.030);
    inlayShape.quadraticCurveTo(0.44, -0.040, 0.565, -0.044);
    inlayShape.quadraticCurveTo(0.618, -0.042, 0.625, 0.0);
    inlayShape.quadraticCurveTo(0.618, 0.042, 0.565, 0.044);
    inlayShape.quadraticCurveTo(0.44, 0.040, 0.285, 0.030);
    inlayShape.closePath();
    const inlayGeo = new THREE.ExtrudeGeometry(inlayShape, {
      depth: 0.0138,
      bevelEnabled: false,
    });
    inlayGeo.rotateX(Math.PI / 2);
    inlayGeo.translate(0, 0.0069, 0);

    // Ornate antique-brass blade-iron mounting bracket (叶叉)
    const bracketShape = new THREE.Shape();
    bracketShape.moveTo(0.135, -0.024);
    bracketShape.lineTo(0.215, -0.028);
    bracketShape.lineTo(0.268, -0.046);
    bracketShape.lineTo(0.284, -0.038);
    bracketShape.lineTo(0.284, 0.038);
    bracketShape.lineTo(0.268, 0.046);
    bracketShape.lineTo(0.215, 0.028);
    bracketShape.lineTo(0.135, 0.024);
    bracketShape.closePath();
    const bracketGeo = new THREE.ExtrudeGeometry(bracketShape, {
      depth: 0.0055,
      bevelEnabled: true,
      bevelThickness: 0.0016,
      bevelSize: 0.0018,
      bevelSegments: 2,
    });
    bracketGeo.rotateX(Math.PI / 2);
    bracketGeo.translate(0, -0.0065, 0);

    const rivetGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 8);
    const bladeCount = 5;
    for (let bi = 0; bi < bladeCount; bi++) {
      const armHolder = new THREE.Group();
      armHolder.rotation.y = (bi / bladeCount) * Math.PI * 2;

      // Aerodynamic 11-degree blade pitch
      const pitchedBlade = new THREE.Group();
      pitchedBlade.rotation.x = 0.19;

      const woodBlade = new THREE.Mesh(bladeGeo, fanWoodBladeMat);
      woodBlade.castShadow = true;
      woodBlade.receiveShadow = true;
      outlines.addOutline(woodBlade, 1.016);
      pitchedBlade.add(woodBlade);

      const caneInlay = new THREE.Mesh(inlayGeo, fanCaneInlayMat);
      pitchedBlade.add(caneInlay);

      const ironBracket = new THREE.Mesh(bracketGeo, antiqueBrassMat);
      pitchedBlade.add(ironBracket);

      // Three raised vintage brass mounting rivets on the underside of each blade iron
      for (const [rx, rz] of [
        [0.245, 0.0],
        [0.266, -0.026],
        [0.266, 0.026],
      ] as const) {
        const rivet = new THREE.Mesh(rivetGeo, antiqueBrassMat);
        rivet.position.set(rx, -0.0138, rz);
        pitchedBlade.add(rivet);
      }

      armHolder.add(pitchedBlade);
      fanRotor.add(armHolder);
    }

    mergeDynamicSubtreeMeshes(fanRotor, outlines, 'LivingVintageFanRotorMerged');
    fanRoot.add(fanRotor);
    brightRig.fanRotor = fanRotor;

    ceilingGroup.add(fanRoot);

    // Primary Ceiling Fan-Light Wide-Radius Warm-White PointLight (暖白色光源)
    const mainChandelierLight = new THREE.PointLight(0xfff5e4, 0.0, 21.0, 0.66);
    mainChandelierLight.position.set(3.12, 2.84, -5.08);
    mainChandelierLight.castShadow = false;
    scene.add(mainChandelierLight);
    brightRig.lights.push(mainChandelierLight);
    brightRig.baseIntensities.push(2.70);
  }

  // 2) Twin Ultra-Slim Flush White-Plastic Flat LED Ceiling Pucks flanking North & South of the tray ceiling
  for (const dz of [-2.55, -7.60]) {
    const downlight = new THREE.Group();
    downlight.position.set(3.30, 3.28, dz);
    downlight.userData.dynamic = true;

    const plasticRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.126, 0.024, 28),
      plasticShellMat
    );
    plasticRim.position.y = -0.012;
    outlines.addOutline(plasticRim, 1.02);
    downlight.add(plasticRim);

    const innerLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.104, 0.0045, 8, 28),
      plasticGrooveMat
    );
    innerLip.rotation.x = Math.PI / 2;
    innerLip.position.y = -0.023;
    downlight.add(innerLip);

    const lensDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.102, 0.102, 0.008, 24),
      chandelierGlowMat
    );
    lensDisc.position.y = -0.024;
    downlight.add(lensDisc);

    mergeDynamicSubtreeMeshes(downlight, outlines, `LivingDownlightMerged_${dz}`);
    ceilingGroup.add(downlight);

    const downLightSrc = new THREE.PointLight(0xfff5e4, 0.0, 18.0, 0.70);
    downLightSrc.position.set(3.30, 2.94, dz);
    downLightSrc.castShadow = false;
    scene.add(downLightSrc);
    brightRig.lights.push(downLightSrc);
    brightRig.baseIntensities.push(1.85);
  }

  // Shared toggle handler for both physical modern wall switches
  const toggleLivingBrightLights = () => {
    const nextOn = !brightRig.isOn;
    brightRig.isOn = nextOn;
    for (let i = 0; i < brightRig.lights.length; i++) {
      brightRig.lights[i].intensity = nextOn ? (brightRig.baseIntensities[i] ?? 2.4) : 0.0;
    }
    for (let i = 0; i < brightRig.bulbMats.length; i++) {
      brightRig.bulbMats[i].color.setHex(nextOn ? 0xfff9ee : 0xfff4e2);
    }
    for (let i = 0; i < brightRig.switchRockers.length; i++) {
      brightRig.switchRockers[i].rotation.x = nextOn ? -0.22 : 0.22;
    }
    for (let i = 0; i < brightRig.switchLedMats.length; i++) {
      brightRig.switchLedMats[i].color.setHex(nextOn ? 0xffe288 : 0x766e86);
    }
    brightRig.onToggleNotify?.(nextOn);
    return {
      title: nextOn ? '客厅复古吊扇灯已开启' : '客厅复古吊扇灯已关闭',
      message: nextOn
        ? '复古木质吊扇一体灯的乳白玻璃灯罩与两侧筒灯同时点亮，木扇叶轻快旋转带来温暖柔和的光影。'
        : '客厅吊扇灯已关闭，扇叶转为轻缓微风转动，室内恢复当前氛围的自然光影层次。',
    };
  };

  // Helper to mount a sleek modern champagne-gold & matte-ivory wall switch panel
  const addLivingWallSwitch = (
    id: string,
    x: number,
    y: number,
    z: number,
    rotY: number
  ) => {
    const swGroup = new THREE.Group();
    swGroup.userData.dynamic = true;
    swGroup.position.set(x, y, z);
    swGroup.rotation.y = rotY;

    // Slim brushed champagne-gold outer metallic frame + satin matte-ivory ceramic faceplate
    const goldFrame = new THREE.Mesh(
      createBeveledBox(0.112, 0.144, 0.012, 0.004, 2),
      champagneGoldMat
    );
    goldFrame.position.z = 0.006;
    outlines.addOutline(goldFrame, 1.038);
    swGroup.add(goldFrame);

    const plate = new THREE.Mesh(
      createBeveledBox(0.102, 0.134, 0.015, 0.004, 2),
      switchPlateMat
    );
    plate.position.z = 0.011;
    swGroup.add(plate);

    // Wide minimalist frameless push-rocker paddle with central champagne-gold hairline detail
    const rockerPivot = new THREE.Group();
    rockerPivot.userData.dynamic = true;
    rockerPivot.position.set(0, 0.006, 0.020);
    rockerPivot.rotation.x = 0.22;
    const rockerMesh = new THREE.Mesh(
      createBeveledBox(0.072, 0.082, 0.012, 0.003, 2),
      switchRockerMat
    );
    outlines.addOutline(rockerMesh, 1.04);
    rockerPivot.add(rockerMesh);

    const rockerGoldLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.050, 0.0035, 0.003),
      champagneGoldMat
    );
    rockerGoldLine.position.set(0, 0, 0.0065);
    rockerPivot.add(rockerGoldLine);

    swGroup.add(rockerPivot);
    brightRig.switchRockers.push(rockerPivot);

    // Delicate recessed horizontal status LED indicator slit below the rocker
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x766e86 });
    const ledMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.0055, 0.004),
      ledMat
    );
    ledMesh.userData.dynamic = true;
    ledMesh.position.set(0, -0.048, 0.020);
    swGroup.add(ledMesh);
    brightRig.switchLedMats.push(ledMat);

    group.add(swGroup);
    registerInteractable(
      id,
      '客厅现代主灯开关',
      '开灯 / 关灯',
      'living',
      swGroup,
      toggleLivingBrightLights
    );
  };

  // Switch 1: South wall beside the Living-Dining wooden door (clear wall above wainscoting)
  addLivingWallSwitch('living_bright_switch_south', 1.32, 1.30, 0.155, Math.PI);
  // Switch 2: West wall beside the Bedroom doorway (right by the sofa/bedroom entrance)
  addLivingWallSwitch('living_bright_switch_west', -1.125, 1.30, -4.38, Math.PI / 2);

  // Merge all static architectural structures (walls, floor, wainscoting) and static
  // furniture in LivingRoom into a single multi-material BufferGeometry!
  mergeStaticGroupToSingleMesh(group, outlines, 'LivingRoomMergedStaticMesh');

  // =========================================================================
  // 13. REGISTER LIVING ROOM MATERIALS INTO GLOBAL PERSISTENT COLOR STUDIO (F8)
  // =========================================================================
  {
    const redrawCurtains = () => {
      paintLivingCurtainCanvas();
      matchaFloralCurtainTex.needsUpdate = true;
      paintValanceTopBand();
      valanceTex.needsUpdate = true;
    };

    apartmentColorStudio.registerCustomControl(
      'curtainBase',
      '窗帘底色',
      'living',
      'color',
      curtainPalette.base,
      (v) => {
        curtainPalette.base = String(v);
        redrawCurtains();
      }
    );
    apartmentColorStudio.registerCustomControl(
      'curtainCheck',
      '窗帘格纹线色',
      'living',
      'color',
      curtainPalette.check,
      (v) => {
        curtainPalette.check = String(v);
        redrawCurtains();
      }
    );
    apartmentColorStudio.registerCustomControl(
      'curtainCheckSize',
      '窗帘格子间距',
      'living',
      'range',
      curtainPalette.checkSize,
      (v) => {
        curtainPalette.checkSize = Number(v) || 72;
        redrawCurtains();
      },
      { min: 40, max: 180, step: 4 }
    );

    apartmentColorStudio.registerMaterialColor('livingWall', '客厅墙面', 'living', livingWallMat);
    apartmentColorStudio.registerMaterialColor('woodFloor', '客餐厅木地板', 'global', woodFloorMat);
    apartmentColorStudio.registerMaterialColor('wainscot', '护墙板', 'global', wainscotMat);
    apartmentColorStudio.registerMaterialColor('doorAndTrim', '门框与墙角框线', 'global', wainscotTrimMat);

    apartmentColorStudio.registerMaterialColor('sofaFabric', '大沙发面料', 'living', [
      sofaMat,
      sofaBackTuftMat,
    ]);
    apartmentColorStudio.registerMaterialColor('sofaFabric', '大沙发面料', 'living', sofaDarkMat, {
      multiplier: 0.92,
    });
    apartmentColorStudio.registerMaterialColor('tvWood', '电视柜/斗柜主木色', 'living', tvWoodMat);
    apartmentColorStudio.registerMaterialColor('tvWoodDeep', '电视柜/斗柜深木色', 'living', tvWoodDeepMat);
    apartmentColorStudio.registerMaterialColor('oakWood', '茶几/角柜木色', 'living', oakMat);
    apartmentColorStudio.registerMaterialColor('oakWood', '茶几/角柜木色', 'living', darkOakMat, {
      multiplier: 0.84,
    });
    apartmentColorStudio.registerMaterialColor('rugTint', '客厅地毯色调', 'living', rugMat);
    apartmentColorStudio.registerMaterialColor('pineTint', '圣诞树/花环绿叶', 'living', [
      pineNeedleMat,
      wreathPineMat,
    ]);
    apartmentColorStudio.registerMaterialColor('tapestryTint', '沙发驯鹿毛毯', 'living', sofaTapestryMat);
    apartmentColorStudio.registerMaterialColor('glassTint', '餐边柜玻璃色', 'living', cabGlassMat);
  }
}
