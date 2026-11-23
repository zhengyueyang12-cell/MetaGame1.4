import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createBeveledBox,
  createBeveledSlab,
  createBookGeometry,
  createBroadLeafGeometry,
  createDrapedCurtainGeometry,
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
    color: 0xffe4cc,
    roughness: 0.90,
    metalness: 0.0,
    woodLacquer: 0.0,
    celStrength: 0.54,
  });
  const wainscotTrimMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xfff6e6,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.44,
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

  // Hinged Living Room / Dining Partition Door (Z = 0.25, X = 1.58 .. 2.73)
  const doorMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xfff6e6,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
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

  // Clear luminous golden-honey MiSide wood furniture materials (zero double-darkening)
  const oakMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xfff8ec,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
  });
  const darkOakMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xf2d9b6,
    roughness: 0.62,
    metalness: 0.0,
    woodLacquer: 0.48,
  });
  const drawerWhiteMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xfffdf6,
    roughness: 0.59,
    metalness: 0.0,
    woodLacquer: 0.50,
  });
  const drawerMoldingMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xf7e4c6,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.50,
  });
  const handleBrassMat = mat({ color: 0xdcb46c, roughness: 0.38, metalness: 0.68 });
  const rugMat = mat({
    map: textures.rugWeave,
    bumpMap: textures.rugBump,
    bumpScale: 0.012,
    color: 0xfff5f2,
    roughness: 0.96,
    metalness: 0.0,
  });
  const curtainMat = mat({
    map: textures.curtainFloralGreen,
    bumpMap: textures.curtainBump,
    bumpScale: 0.018,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
    windSway: 0.76,
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
    color: 0xf6f1de,
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
  // Lively Macaron Color-Pop Throw Pillow Palette: Sakura Pink, Sky Blue, Coral Peach, Butter Lemon & Mint Gingham
  const sofaCreamPillowMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.011,
    color: 0xffa6c4,
    roughness: 0.92,
    metalness: 0.0,
    fabricCream: 1.0,
  });
  const sofaIcePillowMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.011,
    color: 0x94d4ff,
    roughness: 0.92,
    metalness: 0.0,
    fabricCream: 1.0,
  });
  const sofaLemonPillowMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.011,
    color: 0xffeb88,
    roughness: 0.92,
    metalness: 0.0,
    fabricCream: 1.0,
  });
  const sofaCoralPillowMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.011,
    color: 0xff9482,
    roughness: 0.92,
    metalness: 0.0,
    fabricCream: 1.0,
  });
  const ginghamPillowMat = mat({
    map: textures.ginghamPillow,
    bumpMap: textures.plushBump,
    bumpScale: 0.013,
    color: 0xffffff,
    roughness: 0.91,
    metalness: 0.0,
    fabricCream: 1.0,
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
  // 1. WOVEN AREA RUG WITH BEVELED EDGES (Y = +0.012)
  // =========================================================================
  const rugGroup = new THREE.Group();
  rugGroup.position.set(4.10, 0.012, -5.25);
  const rugMain = new THREE.Mesh(
    createBeveledSlab(5.0, 0.024, 5.4, 0.16, 0.009),
    rugMat
  );
  rugMain.receiveShadow = true;
  rugGroup.add(rugMain);
  group.add(rugGroup);

  // =========================================================================
  // 2. PATTERNED JACQUARD DRAPED CURTAINS + TRANSLUCENT WHITE SHEER CURTAINS
  //    (半透明白纱与精细窗帘褶皱) + TIEBACK TASSELS, RINGS & FINIALS
  // =========================================================================
  const curtainGeo = createDrapedCurtainGeometry(0.46, 2.56, 0.078, 7.5);
  curtainGeo.rotateY(-Math.PI / 2);

  // Full-aperture translucent white voile sheer curtain geometry with fine vertical pleats
  const sheerPanelGeo = createDrapedCurtainGeometry(0.66, 2.46, 0.038, 10.5);
  sheerPanelGeo.rotateY(-Math.PI / 2);

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

    for (const side of [-1, 1]) {
      const cz = wz + side * 0.68;
      const curtain = new THREE.Group();
      curtain.position.set(7.08, 1.50, cz);

      const drapeMesh = new THREE.Mesh(curtainGeo, curtainMat);
      drapeMesh.castShadow = true;
      drapeMesh.receiveShadow = true;
      outlines.addOutline(drapeMesh, 1.012);
      curtain.add(drapeMesh);

      // Sculpted gathered fabric tieback band + braided hanging tassel
      const tieBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.095, 0.018, 10, 18),
        curtainBandMat
      );
      tieBand.rotation.x = Math.PI / 2;
      tieBand.scale.set(0.72, 1.32, 1);
      tieBand.position.set(0, -0.34, 0);
      curtain.add(tieBand);

      const tasselCord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.14, 8),
        curtainBandMat
      );
      tasselCord.position.set(-0.055, -0.42, side * 0.05);
      curtain.add(tasselCord);

      const tasselSkirt = new THREE.Mesh(
        new THREE.ConeGeometry(0.024, 0.085, 12),
        handleBrassMat
      );
      tasselSkirt.position.set(-0.055, -0.51, side * 0.05);
      curtain.add(tasselSkirt);

      for (let r = 0; r < 6; r++) {
        const rz = (r - 2.5) * 0.068;
        _instMat.makeTranslation(7.09, 2.79, cz + rz);
        curtainRingsInst.setMatrixAt(ringIdx++, _instMat);
      }

      group.add(curtain);
    }

    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 1.76, 12),
      darkOakMat
    );
    rod.rotation.x = Math.PI / 2;
    rod.position.set(7.09, 2.81, wz);
    rod.castShadow = true;
    group.add(rod);

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
  // 3. ENLARGED ARCHITECTURAL LOUVERED TV MEDIA CONSOLE (X = 6.76, Z = -5.08)
  //    Width = 2.38m, Depth = 0.58m, Height = 0.62m + Hi-Fi Bookshelf Speakers
  // =========================================================================
  const tvConsole = new THREE.Group();
  tvConsole.position.set(6.76, 0, -5.08);

  // Chunkier rounded bullnose solid-oak top slab + shadow reveal under-bevel
  const consoleTop = new THREE.Mesh(
    createBeveledSlab(0.60, 0.044, 2.40, 0.056, 0.015),
    oakMat
  );
  consoleTop.position.y = 0.606;
  consoleTop.castShadow = true;
  consoleTop.receiveShadow = true;
  outlines.addOutline(consoleTop, 1.014);
  tvConsole.add(consoleTop);

  const consoleTopReveal = new THREE.Mesh(
    createBeveledBox(0.53, 0.018, 2.30, 0.006, 2),
    darkOakMat
  );
  consoleTopReveal.position.y = 0.576;
  tvConsole.add(consoleTopReveal);

  const consoleBot = new THREE.Mesh(
    createBeveledSlab(0.58, 0.038, 2.34, 0.046, 0.012),
    oakMat
  );
  consoleBot.position.y = 0.178;
  consoleBot.castShadow = true;
  consoleBot.receiveShadow = true;
  tvConsole.add(consoleBot);

  // Sculpted longitudinal & cross under-apron stretcher frame connecting the 6 legs
  for (const sx of [-0.18, 0.18]) {
    const longStretcher = new THREE.Mesh(
      createBeveledBox(0.028, 0.032, 2.08, 0.006, 2),
      darkOakMat
    );
    longStretcher.position.set(sx, 0.146, 0);
    tvConsole.add(longStretcher);
  }
  for (const sz of [-1.02, 0, 1.02]) {
    const crossStretcher = new THREE.Mesh(
      createBeveledBox(0.38, 0.030, 0.028, 0.006, 2),
      darkOakMat
    );
    crossStretcher.position.set(0, 0.146, sz);
    tvConsole.add(crossStretcher);
  }

  // Deep dark recessed interior cavity backing so TV console bays have strong 3D depth (纵深感)
  const carcass = new THREE.Mesh(
    createBeveledBox(0.028, 0.39, 2.24, 0.006, 2),
    cavityDarkMat
  );
  carcass.position.set(0.24, 0.385, 0);
  tvConsole.add(carcass);

  const cavityCeiling = new THREE.Mesh(
    createBeveledBox(0.48, 0.012, 2.20, 0.003, 1),
    cavityDarkMat
  );
  cavityCeiling.position.set(0.02, 0.568, 0);
  tvConsole.add(cavityCeiling);

  const midShelf = new THREE.Mesh(
    createBeveledBox(0.51, 0.026, 0.72, 0.006, 2),
    oakMat
  );
  midShelf.position.set(-0.005, 0.405, 0);
  tvConsole.add(midShelf);

  // InstancedMesh for 4 Vertical Structural Dividers & Outer Side Walls of TV Console
  const vPanelGeo = createBeveledBox(0.52, 0.39, 0.032, 0.007, 2);
  const consoleDividersInst = new THREE.InstancedMesh(vPanelGeo, oakMat, 4);
  consoleDividersInst.castShadow = true;
  const dividerZs = [-1.11, -0.37, 0.37, 1.11];
  for (let i = 0; i < dividerZs.length; i++) {
    _instMat.makeTranslation(6.76, 0.385, -5.08 + dividerZs[i]);
    consoleDividersInst.setMatrixAt(i, _instMat);
  }
  consoleDividersInst.instanceMatrix.needsUpdate = true;
  consoleDividersInst.computeBoundingSphere();
  group.add(consoleDividersInst);

  // Left & Right Interactive Louvered Cabinet Doors (7 angled wooden slats per door!)
  for (const sz of [-0.74, 0.74]) {
    const hingeSide: -1 | 1 = sz < 0 ? -1 : 1;
    const doorFrame = new THREE.Group();

    const moldedDoor = createMoldedDrawerFront(
      0.69,
      0.37,
      0.026,
      'x',
      drawerWhiteMat,
      drawerMoldingMat,
      handleBrassMat,
      -1,
      (-hingeSide) as -1 | 1
    );
    doorFrame.add(moldedDoor);

    for (let s = 0; s < 7; s++) {
      const slat = new THREE.Mesh(
        createBeveledBox(0.010, 0.013, 0.52, 0.003, 1),
        oakMat
      );
      slat.position.set(-0.013, -0.105 + s * 0.035, 0);
      slat.rotation.z = 0.22;
      slat.castShadow = true;
      doorFrame.add(slat);
    }

    registerCabinetDoor({
      id: sz < 0 ? 'liv_cab_tv_left' : 'liv_cab_tv_right',
      label: sz < 0 ? '电视柜左百叶柜门' : '电视柜右百叶柜门',
      room: 'living',
      parent: tvConsole,
      centerX: -0.265,
      centerY: 0.385,
      centerZ: sz,
      width: 0.69,
      height: 0.37,
      thickness: 0.026,
      facingAxis: 'x',
      facingSign: -1,
      hingeSide,
      openSign: hingeSide,
      doorMat: drawerWhiteMat,
      moldingMat: drawerMoldingMat,
      handleMat: handleBrassMat,
      customDoorGroup: doorFrame,
    });
  }

  // Center Lower Molded AV Storage Drawer
  const centerConsoleDrawer = createMoldedDrawerFront(
    0.70,
    0.175,
    0.026,
    'x',
    drawerWhiteMat,
    drawerMoldingMat,
    handleBrassMat,
    -1
  );
  centerConsoleDrawer.position.set(-0.265, 0.285, 0);
  tvConsole.add(centerConsoleDrawer);

  // Detailed Home Theater AV Receiver & Game Console Deck in Upper Center Bay
  const deckChassisMat = mat({ color: 0x221d30, roughness: 0.28, metalness: 0.55 });
  const deckGlassMat = mat({ color: 0x100d18, roughness: 0.12, metalness: 0.20 });
  const mediaDeck = new THREE.Mesh(
    createBeveledBox(0.38, 0.072, 0.46, 0.008, 2),
    deckChassisMat
  );
  mediaDeck.position.set(-0.04, 0.455, -0.08);
  mediaDeck.castShadow = true;
  tvConsole.add(mediaDeck);

  // Front VFD display window & brushed brass rotary volume/selector knobs
  const deckDisplay = new THREE.Mesh(
    createBeveledBox(0.008, 0.032, 0.22, 0.002, 1),
    deckGlassMat
  );
  deckDisplay.position.set(-0.232, 0.458, -0.08);
  tvConsole.add(deckDisplay);

  for (const [kz, kr] of [
    [-0.25, 0.016],
    [0.09, 0.013],
  ] as const) {
    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(kr, kr, 0.018, 14),
      handleBrassMat
    );
    knob.rotation.z = Math.PI / 2;
    knob.position.set(-0.236, 0.455, kz);
    tvConsole.add(knob);
  }

  const deckLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.007, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x56d8ff })
  );
  deckLed.position.set(-0.233, 0.458, 0.05);
  tvConsole.add(deckLed);

  // Stacked game disc cases next to the AV console inside center bay
  for (const [gy, gcol] of [
    [0.428, 0x2d549e],
    [0.446, 0xb83b4e],
  ] as const) {
    const gameCase = new THREE.Mesh(
      createBeveledBox(0.19, 0.016, 0.14, 0.003, 1),
      mat({ color: gcol, roughness: 0.42 })
    );
    gameCase.position.set(-0.08, gy, 0.24);
    gameCase.rotation.y = 0.08;
    tvConsole.add(gameCase);
  }

  // Pair of Hi-Fi Warm Honey-Wood Bookshelf Speakers flanking the TV on the Console Top
  const speakerCabMat = mat({ color: 0xd99f74, roughness: 0.76, metalness: 0.0, woodLacquer: 0.25 });
  const speakerBaffleMat = mat({ color: 0x423a52, roughness: 0.90, metalness: 0.0 });
  const speakerConeMat = mat({ color: 0x554c68, roughness: 0.88, metalness: 0.0 });
  for (const spZ of [-1.00, 1.00]) {
    const hiFiGroup = new THREE.Group();
    hiFiGroup.position.set(-0.02, 0.62, spZ);
    hiFiGroup.rotation.y = spZ < 0 ? -0.10 : 0.10;

    const cab = new THREE.Mesh(
      createBeveledBox(0.22, 0.34, 0.19, 0.010, 3),
      speakerCabMat
    );
    cab.position.y = 0.175;
    cab.castShadow = true;
    outlines.addOutline(cab, 1.022);
    hiFiGroup.add(cab);

    const baffle = new THREE.Mesh(
      createBeveledBox(0.012, 0.30, 0.16, 0.004, 2),
      speakerBaffleMat
    );
    baffle.position.set(-0.108, 0.175, 0);
    hiFiGroup.add(baffle);

    // Copper-ringed main woofer + silk-dome tweeter + bass-reflex port
    const wooferRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.006, 10, 20),
      handleBrassMat
    );
    wooferRing.rotation.y = Math.PI / 2;
    wooferRing.position.set(-0.115, 0.125, 0);
    hiFiGroup.add(wooferRing);

    const wooferCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.022, 0.016, 16),
      speakerConeMat
    );
    wooferCone.rotation.z = Math.PI / 2;
    wooferCone.position.set(-0.112, 0.125, 0);
    hiFiGroup.add(wooferCone);

    const tweeterRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.024, 0.004, 8, 16),
      handleBrassMat
    );
    tweeterRing.rotation.y = Math.PI / 2;
    tweeterRing.position.set(-0.115, 0.245, 0);
    hiFiGroup.add(tweeterRing);

    const tweeterDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 10),
      speakerConeMat
    );
    tweeterDome.scale.set(0.45, 1, 1);
    tweeterDome.position.set(-0.114, 0.245, 0);
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

  // InstancedMesh for 6 Turned Splayed Oak Legs under TV Console
  const consoleLegGeo = createTurnedLegGeometry(0.024, 0.014, 0.175);
  const consoleLegsInst = new THREE.InstancedMesh(consoleLegGeo, oakMat, 6);
  consoleLegsInst.castShadow = true;
  let cLegIdx = 0;
  const tvConsoleOrigin = new THREE.Vector3(6.76, 0, -5.08);
  for (const lz of [-1.02, 0, 1.02]) {
    for (const lx of [-0.21, 0.21]) {
      consoleLegsInst.setMatrixAt(
        cLegIdx++,
        composeSplayedLegMatrix(lx, 0.168, lz, 0.175, 0.14, lz === 0 ? 0 : 0.08, tvConsoleOrigin)
      );
    }
  }
  consoleLegsInst.instanceMatrix.needsUpdate = true;
  consoleLegsInst.computeBoundingSphere();
  group.add(consoleLegsInst);

  group.add(tvConsole);
  addBoxCollider('col_tv_console', 6.76, 0.42, -5.08, 0.64, 0.84, 2.40);

  // =========================================================================
  // 4. ENLARGED 65-INCH FLAT-SCREEN TV WITH MULTI-LAYER BEZEL & SOUNDBAR CHIN
  // =========================================================================
  const tvGroup = new THREE.Group();
  tvGroup.position.set(6.78, 0.62, -5.08);
  const tvMat = mat({ color: 0x1e1929, roughness: 0.24, metalness: 0.58 });
  const tvTrimMat = mat({ color: 0x3b334f, roughness: 0.28, metalness: 0.68 });

  // Heavy die-cast gunmetal pedestal base + twin aerodynamic support necks
  const tvBase = new THREE.Mesh(
    createBeveledSlab(0.30, 0.018, 0.68, 0.032, 0.006),
    tvTrimMat
  );
  tvBase.position.y = 0.009;
  tvBase.castShadow = true;
  outlines.addOutline(tvBase, 1.02);
  tvGroup.add(tvBase);

  for (const nz of [-0.18, 0.18]) {
    const tvNeck = new THREE.Mesh(
      createBeveledBox(0.048, 0.19, 0.065, 0.009, 2),
      tvMat
    );
    tvNeck.position.set(0.025, 0.10, nz);
    tvNeck.rotation.z = -0.12;
    tvNeck.castShadow = true;
    tvGroup.add(tvNeck);
  }

  // Outer dark titanium TV chassis frame (1.76m wide x 1.02m tall)
  const tvFrame = new THREE.Mesh(
    createBeveledBox(0.040, 1.02, 1.76, 0.012, 3),
    tvMat
  );
  tvFrame.position.y = 0.68;
  tvFrame.castShadow = true;
  outlines.addOutline(tvFrame, 1.015);
  tvGroup.add(tvFrame);

  // Inner chamfered metallic bezel surround framing the glass display
  for (const [by, bh] of [
    [1.178, 0.018],
    [0.198, 0.018],
  ] as const) {
    const hBezel = new THREE.Mesh(
      createBeveledBox(0.044, bh, 1.74, 0.004, 2),
      tvTrimMat
    );
    hBezel.position.set(-0.002, by, 0);
    tvGroup.add(hBezel);
  }
  for (const bz of [-0.865, 0.865]) {
    const vBezel = new THREE.Mesh(
      createBeveledBox(0.044, 0.99, 0.018, 0.004, 2),
      tvTrimMat
    );
    vBezel.position.set(-0.002, 0.688, bz);
    tvGroup.add(vBezel);
  }

  // Sculpted rear electronics enclosure with horizontal cooling louver grooves
  const tvRear = new THREE.Mesh(
    createBeveledBox(0.038, 0.68, 1.24, 0.014, 2),
    tvMat
  );
  tvRear.position.set(0.028, 0.64, 0);
  tvGroup.add(tvRear);

  // Brushed-metal bottom acoustic soundbar chin + center badge + standby LED
  const tvChin = new THREE.Mesh(
    createBeveledBox(0.046, 0.032, 1.75, 0.005, 2),
    tvTrimMat
  );
  tvChin.position.set(-0.004, 0.176, 0);
  tvGroup.add(tvChin);

  const tvBadge = new THREE.Mesh(
    createBeveledBox(0.008, 0.012, 0.065, 0.002, 1),
    handleBrassMat
  );
  tvBadge.position.set(-0.026, 0.176, 0);
  tvGroup.add(tvBadge);

  const tvStandbyLedMat = new THREE.MeshBasicMaterial({ color: 0xff5268 });
  const tvStandbyLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 8, 8),
    tvStandbyLedMat
  );
  tvStandbyLed.position.set(-0.025, 0.172, 0.78);
  tvStandbyLed.userData.dynamic = true;
  tvGroup.add(tvStandbyLed);

  // Live crisp 16:9 retro pixel-art CanvasTexture for cozy comical auto-playing TV minigame
  const tvLiveCanvas = document.createElement('canvas');
  tvLiveCanvas.width = 256;
  tvLiveCanvas.height = 144;
  const tvLiveCtx = tvLiveCanvas.getContext('2d');
  if (tvLiveCtx) {
    tvLiveCtx.imageSmoothingEnabled = false;
  }
  const tvLiveTexture = new THREE.CanvasTexture(tvLiveCanvas);
  tvLiveTexture.colorSpace = THREE.SRGBColorSpace;
  tvLiveTexture.magFilter = THREE.NearestFilter;
  tvLiveTexture.minFilter = THREE.NearestFilter;
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
    map: textures.tvStandby,
    emissiveMap: textures.tvStandby,
    emissive: new THREE.Color(0xffe8d6),
    emissiveIntensity: 0.18,
    roughness: 0.56,
    metalness: 0.04,
    envMapIntensity: 0.06,
  });
  metaState.tvScreenMat = tvScreenMat;
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.94), tvScreenMat);
  tvScreen.rotation.y = -Math.PI / 2;
  tvScreen.position.set(-0.022, 0.688, 0);
  tvScreen.userData.dynamic = true;
  tvGroup.add(tvScreen);
  group.add(tvGroup);

  // Recessed Floating Oak Wall Shelf above enlarged TV with Horizontal Slatted Back, Speakers, Books & Storage Boxes (Screenshot 2)
  const wallShelf = new THREE.Group();
  wallShelf.position.set(7.06, 2.02, -5.08);
  const wsBack = new THREE.Mesh(
    createBeveledBox(0.016, 0.30, 1.72, 0.004, 2),
    cavityDarkMat
  );
  wsBack.position.x = 0.115;
  wallShelf.add(wsBack);

  // Horizontal wooden slats across the back of the floating TV shelf (matches Screenshot 2!)
  for (let s = -2; s <= 2; s++) {
    const hSlat = new THREE.Mesh(
      createBeveledBox(0.012, 0.036, 1.70, 0.003, 1),
      oakMat
    );
    hSlat.position.set(0.102, s * 0.056, 0);
    wallShelf.add(hSlat);
  }

  for (const sy of [-0.155, 0.155]) {
    const wsBoard = new THREE.Mesh(
      createBeveledBox(0.26, 0.026, 1.76, 0.006, 2),
      oakMat
    );
    wsBoard.position.y = sy;
    wsBoard.castShadow = true;
    wsBoard.receiveShadow = true;
    wallShelf.add(wsBoard);
  }
  for (const sz of [-0.865, 0.865]) {
    const wsSide = new THREE.Mesh(
      createBeveledBox(0.26, 0.30, 0.026, 0.006, 2),
      oakMat
    );
    wsSide.position.z = sz;
    wsSide.castShadow = true;
    wallShelf.add(wsSide);
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
    oakMat
  );
  shelfWhiteLid.position.set(-0.01, 0.258, -0.52);
  wallShelf.add(shelfWhiteLid);

  // Compact studio monitor speakers flanking books inside floating shelf
  for (const spZ of [-0.72, 0.72]) {
    const spCab = new THREE.Mesh(
      createBeveledBox(0.15, 0.22, 0.14, 0.006, 2),
      speakerCabMat
    );
    spCab.position.set(-0.01, -0.032, spZ);
    spCab.castShadow = true;
    wallShelf.add(spCab);

    const woofer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.01, 14),
      speakerConeMat
    );
    woofer.rotation.z = Math.PI / 2;
    woofer.position.set(-0.088, -0.06, spZ);
    wallShelf.add(woofer);

    const tweeter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.01, 12),
      speakerConeMat
    );
    tweeter.rotation.z = Math.PI / 2;
    tweeter.position.set(-0.088, 0.025, spZ);
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
    const activeTex = nextOn && metaState.livingTv.texture ? metaState.livingTv.texture : textures.tvStandby;
    tvScreenMat.map = activeTex;
    tvScreenMat.emissiveMap = activeTex;
    tvScreenMat.emissive.setHex(nextOn ? 0xffffff : 0xffe8d6);
    tvScreenMat.emissiveIntensity = nextOn ? 1.05 : 0.18;
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
  // 5. TALL 3-TIER OPEN WOODEN BOOKCASE WITH RECESSED CAVITY & LOUVERED BASE
  //    (X = -0.98, Z = -1.25) + 3-DRAWER CHEST OF DRAWERS (Screenshot 2)
  // =========================================================================
  const shelf = new THREE.Group();
  shelf.position.set(-0.98, 0, -1.25);

  const bcTop = new THREE.Mesh(
    createBeveledSlab(0.32, 0.036, 0.96, 0.034, 0.010),
    oakMat
  );
  bcTop.position.y = 1.62;
  bcTop.castShadow = true;
  bcTop.receiveShadow = true;
  outlines.addOutline(bcTop, 1.02);
  shelf.add(bcTop);

  for (const sy of [1.26, 0.91, 0.56]) {
    const bcTier = new THREE.Mesh(
      createBeveledBox(0.28, 0.028, 0.88, 0.007, 2),
      oakMat
    );
    bcTier.position.y = sy;
    bcTier.castShadow = true;
    bcTier.receiveShadow = true;
    shelf.add(bcTier);
  }

  const bcBot = new THREE.Mesh(
    createBeveledSlab(0.31, 0.034, 0.94, 0.032, 0.010),
    oakMat
  );
  bcBot.position.y = 0.18;
  bcBot.castShadow = true;
  bcBot.receiveShadow = true;
  shelf.add(bcBot);

  for (const sz of [-0.44, 0.44]) {
    const sidePanel = new THREE.Mesh(
      createBeveledBox(0.29, 1.44, 0.034, 0.009, 2),
      oakMat
    );
    sidePanel.position.set(0, 0.90, sz);
    sidePanel.castShadow = true;
    outlines.addOutline(sidePanel, 1.018);
    shelf.add(sidePanel);
  }

  // Deep warm-dark recessed back panel for strong 3D shelf cavity depth (纵深感)
  const bcBack = new THREE.Mesh(
    createBeveledBox(0.022, 1.42, 0.86, 0.005, 2),
    cavityDarkMat
  );
  bcBack.position.set(-0.132, 0.90, 0);
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

  // 3-Drawer Wooden Chest of Drawers beside the Bookcase with 2-Drawer Top Organizer (Screenshot 1)
  const chestGroup = new THREE.Group();
  chestGroup.position.set(-0.92, 0, -2.52);
  const chestBody = new THREE.Mesh(
    createBeveledBox(0.43, 0.78, 0.79, 0.020, 3),
    oakMat
  );
  chestBody.position.y = 0.45;
  chestBody.castShadow = true;
  chestBody.receiveShadow = true;
  outlines.addOutline(chestBody, 1.018);
  chestGroup.add(chestBody);

  const chestTop = new THREE.Mesh(
    createBeveledSlab(0.47, 0.040, 0.84, 0.044, 0.013),
    oakMat
  );
  chestTop.position.y = 0.858;
  chestTop.castShadow = true;
  chestGroup.add(chestTop);

  for (const dy of [0.22, 0.45, 0.68]) {
    const drw = createMoldedDrawerFront(
      0.70,
      0.20,
      0.024,
      'x',
      drawerWhiteMat,
      drawerMoldingMat,
      handleBrassMat,
      1
    );
    drw.position.set(0.215, dy, 0);
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
    mat({ map: textures.sofaArtworks[2], color: 0xe6dcd4, roughness: 0.92, celStrength: 0.44 })
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
    mat({ map: textures.sofaArtworks[1], color: 0xe6dcd4, roughness: 0.92, celStrength: 0.44 })
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
  // 5B. FOUR-DRAWER LONG WOODEN DRESSER + HANDCRAFTED CHRISTMAS WREATH
  //     Placed on the West wall directly to the RIGHT of the Bedroom Door
  //     (door_bedroom Z = -4.15..-3.05; facing door from Living Room, right is -Z!)
  // =========================================================================
  const bedSideDresser = new THREE.Group();
  bedSideDresser.position.set(-0.84, 0, -5.55);

  const bsdCarcass = new THREE.Mesh(
    createBeveledBox(0.46, 0.78, 1.54, 0.022, 3),
    oakMat
  );
  bsdCarcass.position.y = 0.49;
  bsdCarcass.castShadow = true;
  bsdCarcass.receiveShadow = true;
  outlines.addOutline(bsdCarcass, 1.015);
  bedSideDresser.add(bsdCarcass);

  // Chunky bullnose rounded honey-oak top slab
  const bsdTop = new THREE.Mesh(
    createBeveledSlab(0.51, 0.042, 1.62, 0.048, 0.014),
    oakMat
  );
  bsdTop.position.y = 0.895;
  bsdTop.castShadow = true;
  bsdTop.receiveShadow = true;
  outlines.addOutline(bsdTop, 1.015);
  bedSideDresser.add(bsdTop);

  // Subtle recessed shadow molding under top slab
  const bsdReveal = new THREE.Mesh(
    createBeveledBox(0.47, 0.014, 1.56, 0.004, 2),
    darkOakMat
  );
  bsdReveal.position.y = 0.870;
  bedSideDresser.add(bsdReveal);

  // 4 Full-Width Stacked Molded Drawers (四层长抽屉) with dual brass knobs
  const bsdDrawerYs = [0.215, 0.398, 0.581, 0.764];
  for (const dy of bsdDrawerYs) {
    const drwSlab = new THREE.Mesh(
      createBeveledBox(0.026, 0.160, 1.44, 0.008, 2),
      drawerWhiteMat
    );
    drwSlab.position.set(0.232, dy, 0);
    drwSlab.castShadow = true;
    drwSlab.receiveShadow = true;
    bedSideDresser.add(drwSlab);

    // Molded raised honey-oak trim frame around each long drawer front
    const trimTopBotGeo = createBeveledBox(0.012, 0.016, 1.38, 0.004, 2);
    for (const ty of [-0.066, 0.066]) {
      const mBar = new THREE.Mesh(trimTopBotGeo, drawerMoldingMat);
      mBar.position.set(0.244, dy + ty, 0);
      bedSideDresser.add(mBar);
    }
    const trimSideGeo = createBeveledBox(0.012, 0.146, 0.018, 0.004, 2);
    for (const tz of [-0.682, 0.682]) {
      const sBar = new THREE.Mesh(trimSideGeo, drawerMoldingMat);
      sBar.position.set(0.244, dy, tz);
      bedSideDresser.add(sBar);
    }
    // Dual rounded brass drawer knobs
    for (const kz of [-0.36, 0.36]) {
      const knobStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.009, 0.018, 10),
        handleBrassMat
      );
      knobStem.rotation.z = Math.PI / 2;
      knobStem.position.set(0.252, dy, kz);
      bedSideDresser.add(knobStem);

      const knobBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 12, 10),
        handleBrassMat
      );
      knobBall.position.set(0.264, dy, kz);
      knobBall.castShadow = true;
      bedSideDresser.add(knobBall);
    }
  }

  // 4 Sturdy Turned Tapered Oak Legs under the 4-Drawer Long Dresser
  const bsdLegGeo = createTurnedLegGeometry(0.025, 0.016, 0.115);
  for (const [lx, lz] of [
    [-0.17, -0.68],
    [0.17, -0.68],
    [-0.17, 0.68],
    [0.17, 0.68],
  ] as const) {
    const leg = new THREE.Mesh(bsdLegGeo, darkOakMat);
    leg.position.set(lx, 0.056, lz);
    leg.castShadow = true;
    bedSideDresser.add(leg);
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
  // 5C. HANDCRAFTED CHRISTMAS WREATH ON WALL ABOVE 4-DRAWER LONG DRESSER
  //     Composed of: Noble Fir (诺贝松), Pinecones (松果), Cinnamon Sticks (桂皮),
  //     Holly Leaves & Berries (冬青), Dried Lemon Slices (柠檬), and a plump
  //     Center Cotton-Stuffed Red Velvet Fabric Bow (棉花填充布艺红丝绒蝴蝶结)!
  // =========================================================================
  const wreathGroup = new THREE.Group();
  wreathGroup.position.set(-1.105, 1.80, -5.55); // Flush on West wall above the 4-drawer dresser, facing +X

  const nobleFirDarkMat = mat({
    map: textures.plantLeaf,
    bumpMap: textures.plantLeafBump,
    bumpScale: 0.018,
    color: 0x3b6e56,
    roughness: 0.74,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const nobleFirSilverMat = mat({
    map: textures.plantLeaf,
    bumpMap: textures.plantLeafBump,
    bumpScale: 0.016,
    color: 0x568e74,
    roughness: 0.70,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const pineconeMat = mat({ color: 0x6b4228, roughness: 0.86, metalness: 0.0 });
  const pineconeTipMat = mat({ color: 0x8f6242, roughness: 0.84, metalness: 0.0 });
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
  // Plush cotton-stuffed red velvet bow material (soft woven fabric nap, rich crimson)
  const redVelvetBowMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.015,
    color: 0xb81a2c,
    roughness: 0.88,
    metalness: 0.0,
    rimScale: 0.85,
  });
  const redVelvetDeepMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.014,
    color: 0x921222,
    roughness: 0.90,
    metalness: 0.0,
  });

  // Subtle brass wall nail + hanging loop behind wreath
  const wreathHook = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.026, 8),
    handleBrassMat
  );
  wreathHook.rotation.z = Math.PI / 2;
  wreathHook.position.set(0.01, 0.36, 0);
  wreathGroup.add(wreathHook);

  // Structural woven pine-bough torus base ring (lies in Y-Z plane, facing +X)
  const wreathBase = new THREE.Mesh(
    new THREE.TorusGeometry(0.275, 0.056, 12, 28),
    nobleFirDarkMat
  );
  wreathBase.rotation.y = Math.PI / 2;
  wreathBase.position.x = 0.042;
  wreathBase.castShadow = true;
  wreathBase.receiveShadow = true;
  wreathGroup.add(wreathBase);

  // 1) Dense layered Noble Fir needle sprigs (诺贝松枝叶) sweeping clockwise around the ring
  const firSprigGeo = createPlushBox(0.018, 0.054, 0.145, 0.007, 0.24);
  for (let i = 0; i < 42; i++) {
    const ang = (i / 42) * Math.PI * 2;
    const radJitter = 0.245 + (i % 3) * 0.032;
    const sprig = new THREE.Mesh(
      firSprigGeo,
      i % 3 === 0 ? nobleFirSilverMat : nobleFirDarkMat
    );
    const sy = Math.sin(ang) * radJitter;
    const sz = Math.cos(ang) * radJitter;
    const sx = 0.058 + (i % 4) * 0.012;
    sprig.position.set(sx, sy, sz);
    sprig.rotation.set(ang + 0.42 + ((i % 5) - 2) * 0.12, (i % 2 === 0 ? 0.28 : -0.22), 0.18 + (i % 3) * 0.10);
    sprig.scale.set(1.0, 0.85 + (i % 3) * 0.16, 0.85 + (i % 4) * 0.12);
    sprig.castShadow = true;
    wreathGroup.add(sprig);
  }

  // 2) Sculpted Multi-Tiered Pinecones (松果) — 6 clustered pinecones around the wreath
  const buildPinecone = (scale = 1.0) => {
    const pc = new THREE.Group();
    const tiers = [
      { y: 0.0, r: 0.026, h: 0.018 },
      { y: 0.016, r: 0.032, h: 0.020 },
      { y: 0.033, r: 0.028, h: 0.019 },
      { y: 0.048, r: 0.021, h: 0.016 },
      { y: 0.060, r: 0.012, h: 0.013 },
    ];
    for (let t = 0; t < tiers.length; t++) {
      const tr = tiers[t];
      const coneTier = new THREE.Mesh(
        new THREE.ConeGeometry(tr.r, tr.h, 8),
        t % 2 === 0 ? pineconeMat : pineconeTipMat
      );
      coneTier.rotation.x = Math.PI;
      coneTier.rotation.y = t * 0.42;
      coneTier.position.y = tr.y;
      coneTier.castShadow = true;
      pc.add(coneTier);
    }
    pc.scale.setScalar(scale);
    return pc;
  };
  for (const [pAng, pRad, pScale] of [
    [0.52, 0.275, 1.05],
    [1.62, 0.270, 0.95],
    [2.68, 0.280, 1.08],
    [3.74, 0.268, 0.96],
    [4.82, 0.278, 1.02],
    [5.72, 0.265, 0.92],
  ] as const) {
    const pc = buildPinecone(pScale);
    pc.position.set(0.095, Math.sin(pAng) * pRad, Math.cos(pAng) * pRad);
    pc.rotation.set(pAng + 0.5, 0.25, -Math.PI * 0.42);
    wreathGroup.add(pc);
  }

  // 3) Bundled Rolled Cinnamon Sticks (桂皮卷束) tied with twine — 4 aromatic bundles
  const buildCinnamonBundle = () => {
    const cb = new THREE.Group();
    for (const [oy, oz] of [
      [-0.008, -0.007],
      [0.008, -0.006],
      [0.0, 0.008],
    ] as const) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0095, 0.0095, 0.115, 10),
        cinnamonMat
      );
      stick.position.set(0, oy, oz);
      stick.rotation.z = Math.PI / 2;
      stick.castShadow = true;
      cb.add(stick);
    }
    const twineWrap = new THREE.Mesh(
      new THREE.TorusGeometry(0.017, 0.0032, 6, 14),
      twineMat
    );
    twineWrap.rotation.y = Math.PI / 2;
    cb.add(twineWrap);
    return cb;
  };
  for (const [cAng, cTilt] of [
    [1.06, 0.45],
    [2.16, -0.35],
    [4.28, 0.52],
    [5.28, -0.40],
  ] as const) {
    const bundle = buildCinnamonBundle();
    bundle.position.set(0.096, Math.sin(cAng) * 0.275, Math.cos(cAng) * 0.275);
    bundle.rotation.set(cAng + cTilt, Math.PI / 2, 0.28);
    wreathGroup.add(bundle);
  }

  // 4) Dried Golden-Amber Lemon Slices (干柠檬片) — 5 translucent citrus wheels
  const buildLemonSlice = (radius = 0.044) => {
    const ls = new THREE.Group();
    const peel = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.008, 18),
      lemonPeelMat
    );
    peel.rotation.z = Math.PI / 2;
    ls.add(peel);

    const pith = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.87, radius * 0.87, 0.0092, 18),
      lemonPithMat
    );
    pith.rotation.z = Math.PI / 2;
    ls.add(pith);

    const pulp = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, 0.010, 16),
      lemonPulpMat
    );
    pulp.rotation.z = Math.PI / 2;
    ls.add(pulp);

    // Pale pith spoke dividers across the citrus face
    for (let s = 0; s < 4; s++) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.0106, radius * 1.54, 0.0028),
        lemonPithMat
      );
      spoke.rotation.x = (s / 4) * Math.PI;
      ls.add(spoke);
    }
    return ls;
  };
  for (const [lAng, lRad, lSize] of [
    [0.14, 0.285, 0.046],
    [1.34, 0.268, 0.042],
    [2.98, 0.282, 0.045],
    [4.02, 0.275, 0.042],
    [5.50, 0.284, 0.044],
  ] as const) {
    const slice = buildLemonSlice(lSize);
    slice.position.set(0.104, Math.sin(lAng) * lRad, Math.cos(lAng) * lRad);
    slice.rotation.set(0, (Math.cos(lAng) * 0.22), Math.sin(lAng) * 0.22);
    wreathGroup.add(slice);
  }

  // 5) Holly Leaves & Glossy Red Berry Clusters (冬青叶与红冬青果) — 8 festive sprigs
  const hollyLeafGeo = createBroadLeafGeometry(0.088, 0.048, 0.22, 0.14);
  const hollyBerryGeo = new THREE.SphereGeometry(0.0115, 10, 8);
  for (let h = 0; h < 8; h++) {
    const hAng = (h / 8) * Math.PI * 2 + 0.30;
    const hPos = new THREE.Vector3(0.100, Math.sin(hAng) * 0.272, Math.cos(hAng) * 0.272);
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

  // 6) CENTER COTTON-STUFFED RED VELVET FABRIC BOW (花环中间棉花填充的布艺红丝绒蝴蝶结)
  //    Plump pillowy inflated velvet bow sitting prominently in the center of the wreath!
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0.095, -0.01, 0);

  // Subtle velvet mounting backing bar bridging the wreath inner opening so the central bow sits securely
  const bowMountStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.44, 8),
    nobleFirDarkMat
  );
  bowMountStrut.rotation.x = Math.PI / 2;
  bowMountStrut.position.set(-0.042, 0.01, 0);
  bowGroup.add(bowMountStrut);

  // Left & Right plump cotton-stuffed pillowy velvet bow ears (rounded inflated plush lobes)
  const bowEarGeo = createPlushBox(0.068, 0.132, 0.168, 0.032, 0.36);
  for (const side of [-1, 1] as const) {
    const earGroup = new THREE.Group();
    earGroup.position.set(0.014, 0.022, side * 0.105);
    earGroup.rotation.set(side * -0.22, side * -0.24, 0.06);

    const earMesh = new THREE.Mesh(bowEarGeo, redVelvetBowMat);
    earMesh.castShadow = true;
    earMesh.receiveShadow = true;
    outlines.addOutline(earMesh, 1.022);
    earGroup.add(earMesh);

    // Pinched fabric pleat fold crease near the center knot
    const crease = new THREE.Mesh(
      createPlushBox(0.048, 0.056, 0.046, 0.016, 0.24),
      redVelvetDeepMat
    );
    crease.position.set(-0.006, 0, -side * 0.062);
    earGroup.add(crease);

    bowGroup.add(earGroup);
  }

  // Puffy cotton-stuffed central velvet knot pillow
  const bowKnot = new THREE.Mesh(
    createPlushBox(0.076, 0.088, 0.078, 0.028, 0.34),
    redVelvetBowMat
  );
  bowKnot.position.set(0.032, 0.018, 0);
  bowKnot.castShadow = true;
  bowKnot.receiveShadow = true;
  outlines.addOutline(bowKnot, 1.024);
  bowGroup.add(bowKnot);

  // Two softly draped, stuffed velvet swallowtail ribbon tails cascading downward
  const tailGeo = createPlushBox(0.034, 0.22, 0.076, 0.014, 0.26);
  for (const [side, tiltX, tiltY, lenScale] of [
    [-1, 0.24, 0.14, 1.02],
    [1, -0.20, -0.12, 0.94],
  ] as const) {
    const tail = new THREE.Mesh(tailGeo, redVelvetBowMat);
    tail.position.set(0.016, -0.105, side * 0.062);
    tail.rotation.set(tiltX, tiltY, -0.12);
    tail.scale.set(1, lenScale, 1);
    tail.castShadow = true;
    tail.receiveShadow = true;
    outlines.addOutline(tail, 1.02);
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

  // Sculpted Wall Clock above floating shelf
  const clockGroup = new THREE.Group();
  clockGroup.position.set(7.15, 2.56, -5.08);
  const clockBack = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.038, 28),
    mat({ color: 0x3f4e8c, roughness: 0.38, metalness: 0.25 })
  );
  clockBack.rotation.z = Math.PI / 2;
  clockBack.castShadow = true;
  clockGroup.add(clockBack);

  const clockBezel = new THREE.Mesh(
    new THREE.TorusGeometry(0.195, 0.018, 14, 32),
    mat({ color: 0x5264ab, roughness: 0.32, metalness: 0.3 })
  );
  clockBezel.rotation.y = Math.PI / 2;
  clockBezel.position.x = -0.018;
  outlines.addOutline(clockBezel, 1.03);
  clockGroup.add(clockBezel);

  const clockFaceMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.185, 28),
    mat({ map: textures.clockFace, roughness: 0.35 })
  );
  clockFaceMesh.rotation.y = -Math.PI / 2;
  clockFaceMesh.position.x = -0.022;
  clockGroup.add(clockFaceMesh);
  group.add(clockGroup);

  registerInteractable('liv_clock', '挂钟', '查看时间', 'living', clockGroup, () => ({
    title: '墙壁挂钟',
    message: '指针死死停在 19:57。秒针没有在走动，但窗外的黄昏却从未落幕。',
  }));

  // =========================================================================
  // 6. ENLARGED MID-CENTURY COFFEE TABLE WITH SLATTED SHELF & DUAL DRAWERS
  //    Position: (4.62, 0, -5.25), Width = 0.94m, Length = 1.68m, Height = 0.43m
  // =========================================================================
  const table = new THREE.Group();
  table.position.set(4.62, 0, -5.25);

  // Chunkier rounded bullnose solid-oak tabletop + under-bevel shadow rail
  const tableTop = new THREE.Mesh(
    createBeveledSlab(0.96, 0.042, 1.70, 0.072, 0.014),
    oakMat
  );
  tableTop.position.y = 0.427;
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  outlines.addOutline(tableTop, 1.014);
  table.add(tableTop);

  const tableUnderBevel = new THREE.Mesh(
    createBeveledBox(0.84, 0.016, 1.56, 0.005, 2),
    darkOakMat
  );
  tableUnderBevel.position.y = 0.402;
  table.add(tableUnderBevel);

  // Sculpted mortise-and-tenon apron rails & corner joinery blocks
  const apronLongGeo = createBeveledBox(0.026, 0.058, 1.32, 0.006, 2);
  for (const ax of [-0.32, 0.32]) {
    const rail = new THREE.Mesh(apronLongGeo, darkOakMat);
    rail.position.set(ax, 0.376, 0);
    table.add(rail);
  }
  const apronShortGeo = createBeveledBox(0.64, 0.058, 0.026, 0.006, 2);
  for (const az of [-0.65, 0.65]) {
    const rail = new THREE.Mesh(apronShortGeo, darkOakMat);
    rail.position.set(0, 0.376, az);
    table.add(rail);
  }

  // Dual side-by-side molded utility drawers on both -X (sofa) & +X (TV) faces
  for (const side of [-1, 1] as const) {
    const centerStile = new THREE.Mesh(
      createBeveledBox(0.028, 0.058, 0.036, 0.005, 2),
      darkOakMat
    );
    centerStile.position.set(side * 0.32, 0.376, 0);
    table.add(centerStile);

    for (const dz of [-0.31, 0.31]) {
      const ctDrawer = createMoldedDrawerFront(
        0.56,
        0.054,
        0.022,
        'x',
        drawerWhiteMat,
        drawerMoldingMat,
        handleBrassMat,
        side
      );
      ctDrawer.position.set(side * 0.324, 0.376, dz);
      table.add(ctDrawer);
    }
  }

  // Lower Slatted Magazine Rack Shelf (Y = 0.175m) suspended between the 4 splayed legs
  for (const lx of [-0.27, 0.27]) {
    const shelfRail = new THREE.Mesh(
      createBeveledBox(0.024, 0.024, 1.28, 0.005, 2),
      darkOakMat
    );
    shelfRail.position.set(lx, 0.168, 0);
    table.add(shelfRail);
  }
  for (const sz of [-0.62, 0.62]) {
    const shelfCross = new THREE.Mesh(
      createBeveledBox(0.56, 0.024, 0.026, 0.005, 2),
      darkOakMat
    );
    shelfCross.position.set(0, 0.168, sz);
    table.add(shelfCross);
  }
  const slatRackGeo = createBeveledBox(0.54, 0.012, 0.056, 0.003, 1);
  for (let s = -4; s <= 4; s++) {
    const slat = new THREE.Mesh(slatRackGeo, oakMat);
    slat.position.set(0, 0.178, s * 0.132);
    slat.castShadow = true;
    slat.receiveShadow = true;
    table.add(slat);
  }

  // Decorative wooden catch-all tray & art magazine resting on the lower slatted shelf
  const lowerTray = new THREE.Mesh(
    createBeveledSlab(0.34, 0.028, 0.44, 0.024, 0.006),
    darkOakMat
  );
  lowerTray.position.set(-0.02, 0.196, -0.24);
  lowerTray.rotation.y = 0.08;
  table.add(lowerTray);

  const lowerMag = new THREE.Mesh(
    createBookGeometry(0.24, 0.022, 0.32, 1),
    bookAtlasMat
  );
  lowerMag.position.set(0.04, 0.195, 0.28);
  lowerMag.rotation.y = -0.18;
  table.add(lowerMag);

  // InstancedMesh for 4 Turned Splayed Oak Legs under Enlarged Coffee Table
  const tableLegGeo = createTurnedLegGeometry(0.024, 0.014, 0.415);
  const tableLegsInst = new THREE.InstancedMesh(tableLegGeo, oakMat, 4);
  tableLegsInst.castShadow = true;
  const tableOrigin = new THREE.Vector3(4.62, 0, -5.25);
  const tableLegCoords: [number, number][] = [
    [-0.32, -0.64],
    [0.32, -0.64],
    [-0.32, 0.64],
    [0.32, 0.64],
  ];
  for (let i = 0; i < tableLegCoords.length; i++) {
    const [lx, lz] = tableLegCoords[i];
    tableLegsInst.setMatrixAt(
      i,
      composeSplayedLegMatrix(lx, 0.402, lz, 0.415, 0.18, 0.14, tableOrigin)
    );
  }
  tableLegsInst.instanceMatrix.needsUpdate = true;
  tableLegsInst.computeBoundingSphere();
  group.add(tableLegsInst);

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

  // Open Double-Page Illustrated Botanical Magazine & Pink Heart Notepad on Coffee Table (Screenshot 1!)
  const openMagGroup = new THREE.Group();
  openMagGroup.position.set(-0.04, 0.443, 0.14);
  openMagGroup.rotation.y = 0.36;

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

  // Sculpted Gamepad Controller on Coffee Table
  const gamepadGroup = new THREE.Group();
  gamepadGroup.position.set(0.24, 0.444, 0.38);
  gamepadGroup.rotation.y = -0.38;
  gamepadGroup.scale.setScalar(0.92);

  const padBodyMat = mat({ color: 0xff7aa8, roughness: 0.90, metalness: 0.0 });
  const padAccentMat = mat({ color: 0x453b56, roughness: 0.90, metalness: 0.0 });

  const padCenter = new THREE.Mesh(
    createBeveledBox(0.11, 0.026, 0.15, 0.008, 3),
    padBodyMat
  );
  padCenter.position.y = 0.018;
  padCenter.castShadow = true;
  outlines.addOutline(padCenter, 1.05);
  gamepadGroup.add(padCenter);

  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.075, 6, 12),
      padBodyMat
    );
    grip.rotation.x = Math.PI / 2;
    grip.rotation.z = side * 0.28;
    grip.position.set(-0.015, 0.016, side * 0.072);
    grip.castShadow = true;
    outlines.addOutline(grip, 1.05);
    gamepadGroup.add(grip);

    const stickStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.016, 8),
      padAccentMat
    );
    stickStem.position.set(side === -1 ? 0.01 : -0.012, 0.034, side * 0.036);
    gamepadGroup.add(stickStem);

    const stickCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.012, 0.006, 12),
      padAccentMat
    );
    stickCap.position.set(side === -1 ? 0.01 : -0.012, 0.042, side * 0.036);
    gamepadGroup.add(stickCap);
  }

  const dpadH = new THREE.Mesh(
    createBeveledBox(0.026, 0.006, 0.009, 0.002, 1),
    padAccentMat
  );
  dpadH.position.set(-0.015, 0.033, -0.048);
  gamepadGroup.add(dpadH);
  const dpadV = new THREE.Mesh(
    createBeveledBox(0.009, 0.006, 0.026, 0.002, 1),
    padAccentMat
  );
  dpadV.position.set(-0.015, 0.033, -0.048);
  gamepadGroup.add(dpadV);

  for (const [bx, bz, bcol] of [
    [0.018, 0.052, 0x72eb9e],
    [0.030, 0.040, 0xff6e8e],
    [0.006, 0.040, 0x74c2ff],
    [0.018, 0.028, 0xffe26a],
  ] as const) {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 8),
      mat({ color: bcol, roughness: 0.90, metalness: 0.0 })
    );
    btn.position.set(bx, 0.033, bz);
    gamepadGroup.add(btn);
  }
  table.add(gamepadGroup);

  // Two-Tone Creamy White & Macaron Sky-Blue Square Pen Holder Cup on Coffee Table
  const penCupGroup = new THREE.Group();
  penCupGroup.position.set(-0.22, 0.442, -0.34);
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

  const remoteGroup = new THREE.Group();
  remoteGroup.position.set(0.18, 0.442, 0.08);
  remoteGroup.rotation.y = 0.28;
  const remoteBody = new THREE.Mesh(
    createBeveledBox(0.048, 0.016, 0.165, 0.005, 2),
    padAccentMat
  );
  remoteBody.position.y = 0.008;
  remoteBody.castShadow = true;
  outlines.addOutline(remoteBody, 1.04);
  remoteGroup.add(remoteBody);
  for (let rb = 0; rb < 6; rb++) {
    const rBtn = new THREE.Mesh(
      createBeveledBox(0.010, 0.004, 0.010, 0.002, 1),
      mat({
        color: rb === 0 ? 0xe04858 : rb === 1 ? 0x48b868 : 0x788296,
        roughness: 0.4,
      })
    );
    rBtn.position.set((rb % 2 === 0 ? -1 : 1) * 0.009, 0.017, -0.045 + Math.floor(rb / 2) * 0.028);
    remoteGroup.add(rBtn);
  }
  table.add(remoteGroup);

  group.add(table);
  addBoxCollider('col_coffee_table', 4.62, 0.26, -5.25, 0.98, 0.52, 1.72);

  const cablePts = [
    new THREE.Vector3(4.87, 0.458, -4.87),
    new THREE.Vector3(5.12, 0.422, -4.92),
    new THREE.Vector3(5.32, 0.16, -4.98),
    new THREE.Vector3(5.58, 0.032, -5.04),
    new THREE.Vector3(5.92, 0.028, -5.12),
    new THREE.Vector3(6.22, 0.032, -5.16),
    new THREE.Vector3(6.38, 0.22, -5.16),
    new THREE.Vector3(6.51, 0.455, -5.16),
  ];
  const controllerCable = new THREE.Mesh(
    createTaperedCurveGeometry(cablePts, 0.0075, 0.0075, 44, 8),
    padAccentMat
  );
  controllerCable.castShadow = true;
  group.add(controllerCable);

  const consolePlug = new THREE.Mesh(
    createBeveledBox(0.036, 0.018, 0.024, 0.004, 2),
    padAccentMat
  );
  consolePlug.position.set(6.52, 0.455, -5.16);
  group.add(consolePlug);

  registerInteractable('liv_gamepad', '连线游戏手柄', '检查游戏手柄', 'living', gamepadGroup, () => ({
    title: '连着主机的游戏手柄',
    message: '宽大的实木茶几上放着一只双手柄控制器，长长的数据线越过地毯连向电视柜里的游戏机。旁边的冰饮还插着吸管，手柄握把甚至还带着一丝手心的余温。',
  }));

  registerInteractable('liv_headphone_stand', '胡桃木耳机架与头戴耳机', '检查茶几摆件', 'living', headphoneStandGroup, () => ({
    title: '胡桃木黄铜耳机架与精致抽纸盒',
    message: '黄铜支架上稳稳挂着一副象牙白复古监听头戴耳机，柔软的耳罩还带着淡淡的木质香气；旁边的陶瓷橡木盖抽纸盒里轻轻抽出一角素白纸巾，把茶几衬托得格外温馨利落。',
  }));

  // Small Tabletop Pens, Drafting Pencil & Brass Top/Dice Trinkets on Coffee Table
  const { penGroup: livPen, pencilGroup: livPencil } = createTabletopPenSet(ctx, 0x2c4a6f, true);
  livPen.position.set(-0.24, 0.442, -0.05);
  livPen.rotation.y = 0.38;
  table.add(livPen);
  registerAmbientProp({
    id: 'liv_table_pen',
    room: 'living',
    mesh: livPen,
    worldPos: [4.38, 0.442, -5.30],
    kind: 'roller',
    maxDrift: 0.038,
    rollRadius: 0.0056,
    rollAxis: 'x',
    reactivity: 1.32,
  });

  if (livPencil) {
    livPencil.position.set(-0.29, 0.442, 0.04);
    livPencil.rotation.y = -0.52;
    table.add(livPencil);
    registerAmbientProp({
      id: 'liv_table_pencil',
      room: 'living',
      mesh: livPencil,
      worldPos: [4.33, 0.442, -5.21],
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
    id: 'liv_table_gamepad',
    room: 'living',
    mesh: gamepadGroup,
    worldPos: [4.86, 0.444, -4.87],
    kind: 'slide',
    maxDrift: 0.022,
    reactivity: 0.88,
  });
  registerAmbientProp({
    id: 'liv_table_top_book',
    room: 'living',
    mesh: flatBook2,
    worldPos: [4.64, 0.482, -4.99],
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

  // Playful Comical Children's Plastic Toy Gun resting visibly on the middle sofa cushion
  const toyGunRig = buildToyGunMesh(ctx.uniforms, outlines, { isViewModel: false });
  const toyGunWorld = toyGunRig.group;
  // Sofa is at (2.38, 0, -5.25), rotY = +PI/2 (local +Z -> world +X, local +X -> world -Z).
  // Middle cushion top sits at Y ~ 0.515..0.525; place clearly in front-center between pillows.
  toyGunWorld.position.set(2.54, 0.556, -5.18);
  toyGunWorld.rotation.set(0.05, 0.62, Math.PI / 2 - 0.12);
  toyGunWorld.scale.setScalar(1.08);
  toyGunWorld.userData.dynamic = true;
  // Tight invisible hit-proxy right around the toy gun so center-dot targeting is instant and pinpoint accurate
  const toyGunHitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.28, 0.42),
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

  group.add(sofa);
  addBoxCollider('col_sofa_main', 2.38, 0.54, -5.25, 1.18, 1.06, 3.62);

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

  // Macaron Mint-Lime Articulated Dome Desk Lamp on End Table
  const greenLampMat = mat({ color: 0x8ee89e, roughness: 0.90, metalness: 0.0 });
  const lampBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.024, 18),
    greenLampMat
  );
  lampBase.position.set(-0.08, 0.606, -0.08);
  lampBase.castShadow = true;
  endTable.add(lampBase);

  const lampArmPts = [
    new THREE.Vector3(-0.08, 0.618, -0.08),
    new THREE.Vector3(-0.12, 0.78, -0.10),
    new THREE.Vector3(-0.02, 0.92, -0.02),
  ];
  const lampArm = new THREE.Mesh(
    createTaperedCurveGeometry(lampArmPts, 0.011, 0.009, 14, 8),
    handleBrassMat
  );
  lampArm.castShadow = true;
  endTable.add(lampArm);

  const lampDome = new THREE.Mesh(
    new THREE.ConeGeometry(0.095, 0.11, 18, 1, true),
    greenLampMat
  );
  lampDome.position.set(0.01, 0.89, 0.01);
  lampDome.rotation.set(0.32, 0, -0.35);
  lampDome.castShadow = true;
  outlines.addOutline(lampDome, 1.03);
  endTable.add(lampDome);

  const lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff8dc })
  );
  lampBulb.position.set(0.02, 0.86, 0.02);
  endTable.add(lampBulb);

  // Tabletop small ornaments on Sofa End Table: macaron sakura ceramic mug + pastel mint mini twin-bell alarm clock
  const etCoaster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.050, 0.008, 16),
    darkOakMat
  );
  etCoaster.position.set(-0.12, 0.598, 0.12);
  endTable.add(etCoaster);

  const etMug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.032, 0.076, 16),
    mat({ color: 0xffb2cc, roughness: 0.90, metalness: 0.0 })
  );
  etMug.position.set(-0.12, 0.640, 0.12);
  etMug.castShadow = true;
  endTable.add(etMug);

  const etClockBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.042, 0.026, 18),
    mat({ color: 0x9ee8cc, roughness: 0.90, metalness: 0.0 })
  );
  etClockBody.rotation.z = Math.PI / 2;
  etClockBody.rotation.y = -0.36;
  etClockBody.position.set(0.14, 0.638, -0.11);
  etClockBody.castShadow = true;
  endTable.add(etClockBody);

  for (const bellS of [-1, 1]) {
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      handleBrassMat
    );
    bell.position.set(0.14 + bellS * 0.018, 0.682, -0.11 + bellS * 0.024);
    endTable.add(bell);
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

    // Non-emissive matte archival canvas art material tinted to blend seamlessly into the living room wall
    const artMat = mat({
      map: artTex,
      color: 0xe6dcd4,
      roughness: 0.93,
      metalness: 0.0,
      celStrength: 0.44,
    });
    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(w - 0.13, h - 0.13),
      artMat
    );
    art.position.z = 0.032;
    fg.add(art);

    galleryGroup.add(fg);
  };

  const artworks = textures.sofaArtworks;
  buildEclecticArtFrame(1.75, 2.08, -10.29, 0.88, 0.64, 0.022, 0x4a3531, artworks[0], 0.016);
  buildEclecticArtFrame(2.82, 1.90, -10.29, 0.64, 0.84, -0.024, 0x9b7e5c, artworks[1], 0.020);
  buildEclecticArtFrame(3.66, 2.26, -10.29, 0.54, 0.70, 0.028, 0x625a66, artworks[2], 0.022);
  buildEclecticArtFrame(3.78, 1.50, -10.29, 0.52, 0.38, -0.020, 0x2e2636, artworks[3], 0.015);

  // =========================================================================
  // 10. LUSH BROAD-LEAF POTTED PLANT WITH INSTANCED FOLIAGE (X = 6.74, Z = -9.66, clear of Bathroom doorway)
  // =========================================================================
  const plant = new THREE.Group();
  const plantOrigin = new THREE.Vector3(6.74, 0, -9.66);
  plant.position.copy(plantOrigin);

  const potPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.22, 0.34),
    new THREE.Vector2(0.24, 0.38),
    new THREE.Vector2(0.22, 0.40),
    new THREE.Vector2(0.19, 0.37),
  ];
  const pot = new THREE.Mesh(new THREE.LatheGeometry(potPts, 22), ceramicMat);
  pot.position.y = 0.02;
  pot.castShadow = true;
  pot.receiveShadow = true;
  outlines.addOutline(pot, 1.03);
  plant.add(pot);

  const saucer = new THREE.Mesh(
    createBeveledSlab(0.38, 0.026, 0.38, 0.18, 0.008),
    oakMat
  );
  saucer.position.y = 0.012;
  plant.add(saucer);

  // Rich mounded organic potting soil with scattered bark nuggets & mineral pebbles
  const soil = new THREE.Mesh(
    new THREE.SphereGeometry(0.20, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    pottingSoilMat
  );
  soil.scale.set(1.0, 0.28, 1.0);
  soil.position.y = 0.345;
  soil.receiveShadow = true;
  plant.add(soil);

  const barkChipMat = mat({ color: 0x5e3c28, roughness: 0.92, metalness: 0.0 });
  const pebbleMat = mat({ color: 0xc8bba8, roughness: 0.86, metalness: 0.0 });
  for (let b = 0; b < 14; b++) {
    const ba = (b / 14) * Math.PI * 2 + 0.3;
    const br = 0.055 + ((b * 37) % 12) * 0.010;
    const isPebble = b % 4 === 0;
    const chip = new THREE.Mesh(
      isPebble
        ? new THREE.DodecahedronGeometry(0.010 + (b % 2) * 0.004, 0)
        : new THREE.BoxGeometry(0.022, 0.008, 0.014),
      isPebble ? pebbleMat : barkChipMat
    );
    chip.position.set(
      Math.cos(ba) * br,
      0.382 + (1 - br / 0.20) * 0.018,
      Math.sin(ba) * br
    );
    chip.rotation.set(b * 0.4, b * 0.9, b * 0.25);
    plant.add(chip);
  }

  const stemConfigs: THREE.Vector3[][] = [
    [
      new THREE.Vector3(0, 0.36, 0),
      new THREE.Vector3(-0.03, 0.72, 0.02),
      new THREE.Vector3(0.02, 1.12, -0.02),
      new THREE.Vector3(-0.01, 1.44, 0.01),
    ],
    [
      new THREE.Vector3(-0.04, 0.36, 0.03),
      new THREE.Vector3(-0.09, 0.68, 0.07),
      new THREE.Vector3(-0.12, 1.02, 0.09),
    ],
    [
      new THREE.Vector3(0.04, 0.36, -0.03),
      new THREE.Vector3(0.08, 0.64, -0.06),
      new THREE.Vector3(0.11, 0.94, -0.08),
    ],
  ];
  for (const sPts of stemConfigs) {
    const sMesh = new THREE.Mesh(
      createTaperedCurveGeometry(sPts, 0.028, 0.012, 18, 8),
      plantStemMat
    );
    sMesh.castShadow = true;
    plant.add(sMesh);
  }

  // InstancedMesh for 13 Arching Broad Leaves (7 Light-Green + 6 Dark-Green)
  const broadLeafBaseGeo = createBroadLeafGeometry(0.52, 0.27, 0.28, 0.16);
  const leafPlacements: {
    stemBase: [number, number, number];
    leafBase: [number, number, number];
    yaw: number;
    pitch: number;
    roll: number;
    scale: number;
    light: boolean;
  }[] = [
    { stemBase: [-0.05, 0.56, 0.04], leafBase: [-0.14, 0.68, 0.12], yaw: -0.65, pitch: 0.48, roll: -0.12, scale: 0.68, light: false },
    { stemBase: [0.05, 0.58, -0.04], leafBase: [0.15, 0.70, -0.10], yaw: 2.35, pitch: 0.50, roll: 0.10, scale: 0.68, light: true },
    { stemBase: [-0.04, 0.62, -0.04], leafBase: [-0.12, 0.75, -0.14], yaw: -2.25, pitch: 0.46, roll: 0.08, scale: 0.85, light: false },
    { stemBase: [0.04, 0.64, 0.04], leafBase: [0.13, 0.78, 0.14], yaw: 0.75, pitch: 0.44, roll: -0.08, scale: 0.85, light: true },
    { stemBase: [-0.08, 0.86, 0.06], leafBase: [-0.20, 1.04, 0.16], yaw: -0.85, pitch: 0.36, roll: -0.10, scale: 1.0, light: true },
    { stemBase: [0.02, 0.90, 0.05], leafBase: [0.06, 1.08, 0.18], yaw: 0.22, pitch: 0.38, roll: 0.06, scale: 1.0, light: false },
    { stemBase: [0.08, 0.88, -0.06], leafBase: [0.20, 1.05, -0.15], yaw: 1.95, pitch: 0.38, roll: -0.12, scale: 0.85, light: true },
    { stemBase: [-0.06, 0.94, -0.05], leafBase: [-0.18, 1.12, -0.14], yaw: -1.85, pitch: 0.34, roll: 0.10, scale: 1.0, light: false },
    { stemBase: [-0.09, 0.98, 0.02], leafBase: [-0.22, 1.16, 0.04], yaw: -1.42, pitch: 0.32, roll: -0.06, scale: 0.85, light: true },
    { stemBase: [0.01, 1.18, -0.01], leafBase: [-0.08, 1.38, 0.08], yaw: -0.45, pitch: 0.22, roll: -0.08, scale: 1.0, light: true },
    { stemBase: [0.01, 1.22, -0.01], leafBase: [0.09, 1.42, -0.07], yaw: 2.55, pitch: 0.24, roll: 0.08, scale: 1.0, light: false },
    { stemBase: [0.0, 1.28, 0.0], leafBase: [-0.10, 1.48, -0.08], yaw: -2.15, pitch: 0.20, roll: 0.05, scale: 0.85, light: true },
    { stemBase: [0.0, 1.34, 0.0], leafBase: [0.06, 1.54, 0.09], yaw: 0.58, pitch: 0.16, roll: -0.05, scale: 0.85, light: false },
  ];

  const lightLeaves = leafPlacements.filter((l) => l.light);
  const darkLeaves = leafPlacements.filter((l) => !l.light);
  const lightLeavesInst = new THREE.InstancedMesh(
    broadLeafBaseGeo,
    plantLeafLightMat,
    lightLeaves.length
  );
  lightLeavesInst.castShadow = true;
  lightLeavesInst.receiveShadow = true;

  const darkLeavesInst = new THREE.InstancedMesh(
    broadLeafBaseGeo,
    plantLeafMat,
    darkLeaves.length
  );
  darkLeavesInst.castShadow = true;
  darkLeavesInst.receiveShadow = true;

  let lIdx = 0;
  let dIdx = 0;
  for (const lp of leafPlacements) {
    const pStart = new THREE.Vector3(...lp.stemBase);
    const pEnd = new THREE.Vector3(...lp.leafBase);
    const pMid = pStart.clone().lerp(pEnd, 0.5);
    pMid.y += 0.04;

    const petiole = new THREE.Mesh(
      createTaperedCurveGeometry([pStart, pMid, pEnd], 0.013, 0.007, 10, 6),
      plantStemMat
    );
    petiole.castShadow = true;
    plant.add(petiole);

    _instPos.set(
      plantOrigin.x + pEnd.x,
      plantOrigin.y + pEnd.y,
      plantOrigin.z + pEnd.z
    );
    _instEuler.set(lp.pitch, lp.yaw, lp.roll, 'YXZ');
    _instQuat.setFromEuler(_instEuler);
    _instScale.setScalar(lp.scale);
    _instMat.compose(_instPos, _instQuat, _instScale);

    if (lp.light) {
      lightLeavesInst.setMatrixAt(lIdx++, _instMat);
    } else {
      darkLeavesInst.setMatrixAt(dIdx++, _instMat);
    }
  }
  lightLeavesInst.instanceMatrix.needsUpdate = true;
  lightLeavesInst.computeBoundingSphere();
  darkLeavesInst.instanceMatrix.needsUpdate = true;
  darkLeavesInst.computeBoundingSphere();
  group.add(lightLeavesInst, darkLeavesInst);

  group.add(plant);
  addBoxCollider('col_liv_plant', 6.74, 0.5, -9.66, 0.52, 1.2, 0.52);

  // =========================================================================
  // 10B. SE CORNER 5-TIER STANDING BOOKSHELF (Preserved Oak Frame + Sculpted Books)
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

    // 4 slim vertical light-oak corner posts + back cross-brace
    const postGeo = createBeveledBox(0.034, totalHeight, 0.034, 0.005, 2);
    const halfW = shelfWidth / 2 - 0.022;
    const halfD = shelfDepth / 2 - 0.022;
    for (const [px, pz] of [
      [-halfW, -halfD],
      [halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
    ] as const) {
      const post = new THREE.Mesh(postGeo, oakMat);
      post.position.set(px, totalHeight / 2, pz);
      post.castShadow = true;
      post.receiveShadow = true;
      rackGroup.add(post);
    }

    // Back recessed slat panel for deep cubby AO contrast
    const backPanel = new THREE.Mesh(
      createBeveledBox(shelfWidth - 0.04, totalHeight - 0.16, 0.014, 0.003, 1),
      darkOakMat
    );
    backPanel.position.set(0, totalHeight / 2 + 0.04, -halfD + 0.006);
    backPanel.receiveShadow = true;
    rackGroup.add(backPanel);

    const tierBoardGeo = createBeveledSlab(shelfWidth, 0.026, shelfDepth, 0.016, 0.006);
    const sideRailGeo = createBeveledBox(0.020, 0.022, shelfDepth - 0.04, 0.003, 1);
    const tierGap = (totalHeight - 0.22) / (numTiers - 1);

    for (let t = 0; t < numTiers; t++) {
      const tierY = 0.14 + t * tierGap;
      const board = new THREE.Mesh(tierBoardGeo, oakMat);
      board.position.y = tierY;
      board.castShadow = true;
      board.receiveShadow = true;
      rackGroup.add(board);

      // Side bookend rails on each shelf tier
      for (const sx of [-halfW, halfW]) {
        const sRail = new THREE.Mesh(sideRailGeo, wainscotTrimMat);
        sRail.position.set(sx, tierY + 0.036, 0);
        rackGroup.add(sRail);
      }

      // Populate lower & middle tiers with naturally varied sculpted light-toned books, manga sets & retro games
      if (t < numTiers - 1) {
        populateRealisticBookTier({
          parent: rackGroup,
          axis: 'x',
          spineSign: 1,
          start: -halfW + 0.026,
          end: halfW - 0.026,
          surfaceY: tierY + 0.013,
          depthCenter: 0.012,
          maxDepth: shelfDepth * 0.72,
          maxHeight: tierGap - 0.026,
          seed: seedOffset * 37 + t * 23,
          includeMangaSet: t === 1,
          includeHorizontalStack: t === 0 || t === 2,
          includeRetroGames: true,
        });
      } else {
        // Top tier ornament: mini matte ceramic planter pot with succulent, stacked light-toned artbooks & retro cartridge
        const topBook1 = new THREE.Mesh(
          createBookGeometry(0.185, 0.026, 0.142, 6),
          bookAtlasMat
        );
        topBook1.position.set(-0.085, tierY + 0.026, 0);
        topBook1.rotation.y = 0.14;
        topBook1.castShadow = true;
        topBook1.receiveShadow = true;
        rackGroup.add(topBook1);

        const topBook2 = new THREE.Mesh(
          createBookGeometry(0.162, 0.022, 0.126, 10),
          bookAtlasMat
        );
        topBook2.position.set(-0.085, tierY + 0.050, 0.005);
        topBook2.rotation.y = -0.18;
        topBook2.castShadow = true;
        topBook2.receiveShadow = true;
        rackGroup.add(topBook2);

        const topCart = new THREE.Mesh(
          createRetroCartridgeGeometry(0.108, 0.015, 0.076),
          retroCartridgeMats[1]
        );
        topCart.position.set(-0.082, tierY + 0.068, 0.008);
        topCart.rotation.y = 0.28;
        topCart.castShadow = true;
        rackGroup.add(topCart);

        const miniPot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.048, 0.038, 0.068, 14),
          ceramicMat
        );
        miniPot.position.set(0.10, tierY + 0.047, 0);
        miniPot.castShadow = true;
        rackGroup.add(miniPot);

        const succulent = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.044, 1),
          plantLeafLightMat
        );
        succulent.scale.set(1.1, 0.72, 1.1);
        succulent.position.set(0.10, tierY + 0.092, 0);
        rackGroup.add(succulent);
      }
    }

    group.add(rackGroup);
    return rackGroup;
  };

  // 1) 5-Tier Standing Corner Bookshelf in Living Room SE Corner (X = 6.78, Z = -0.68) facing into room
  buildStandingCornerBookRack(6.78, -0.68, -Math.PI * 0.72, 5, 0.62, 0.32, 1.54, 3);
  addBoxCollider('col_liv_se_book_rack', 6.78, 0.78, -0.68, 0.64, 1.56, 0.64);

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

  // Shared dynamic luminous diffuser material (swaps milky white plastic OFF <-> warm-white panel glow ON)
  const chandelierGlowMat = new THREE.MeshBasicMaterial({ color: 0xe8e5df });
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

    // Vintage stepped antique-brass light-kit fitter cup beneath the motor (bottom-to-top Y)
    const fitterPts = [
      new THREE.Vector2(0.096, -0.248),
      new THREE.Vector2(0.108, -0.246),
      new THREE.Vector2(0.114, -0.228),
      new THREE.Vector2(0.104, -0.214),
    ];
    const lightFitter = new THREE.Mesh(
      new THREE.LatheGeometry(fitterPts, 28),
      antiqueBrassMat
    );
    fanStaticGroup.add(lightFitter);

    // Sculpted vintage frosted milk-glass schoolhouse dome globe (bottom-to-top Y for outward normals)
    const globePts = [
      new THREE.Vector2(0.0, -0.369),
      new THREE.Vector2(0.056, -0.366),
      new THREE.Vector2(0.122, -0.354),
      new THREE.Vector2(0.164, -0.328),
      new THREE.Vector2(0.168, -0.298),
      new THREE.Vector2(0.138, -0.264),
      new THREE.Vector2(0.098, -0.242),
    ];
    const milkGlassGlobe = new THREE.Mesh(
      new THREE.LatheGeometry(globePts, 32),
      chandelierGlowMat
    );
    outlines.addOutline(milkGlassGlobe, 1.016);
    fanStaticGroup.add(milkGlassGlobe);

    // Delicate antique-brass finial button capping the bottom tip of the milk-glass dome
    const finialBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.014, 0.012, 16),
      antiqueBrassMat
    );
    finialBase.position.y = -0.371;
    fanStaticGroup.add(finialBase);
    const finialKnob = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 10),
      antiqueBrassMat
    );
    finialKnob.position.y = -0.382;
    fanStaticGroup.add(finialKnob);

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

    // Primary Ceiling Fan-Light Wide-Radius Warm-White PointLight (starts at 0 = OFF)
    const mainChandelierLight = new THREE.PointLight(0xfff0d6, 0.0, 21.0, 0.66);
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

    const downLightSrc = new THREE.PointLight(0xfff2dc, 0.0, 18.0, 0.70);
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
      brightRig.bulbMats[i].color.setHex(nextOn ? 0xfff6e5 : 0xe8e5df);
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
}
