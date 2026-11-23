import * as THREE from 'three';
import {
  createBeveledBox,
  createBeveledSlab,
  createDrapedTableclothGeometry,
  createPlushBox,
} from '../geometries';
import {
  mergeDynamicSubtreeMeshes,
  mergeStaticGroupToSingleMesh,
} from '../SceneManager';
import type { RoomBuildContext } from './roomContext';

/**
 * Builds an ultra-deep (56m visual depth), clean, doorless Non-Euclidean Apartment Hallway
 * outside the Entryway front door (X = -8.00 .. -64.00, centered on Z = 4.60, floor Y = -0.08).
 *
 * Architectural Style:
 * - Clean, cozy apartment interior finish: warm patterned living wallpaper on upper walls,
 *   honey-oak vertical beadboard wainscoting + chair rail + baseboard on lower walls, and
 *   warm oak hardwood planks underfoot — ZERO side doors or cluttered projections.
 * - Sparse warm round flush ceiling dome lamps (`圆灯`) spaced generously every 7.0 meters
 *   for moody alternating pools of light & shadow stretching deep into the vanishing point.
 * - Built as 14 clean 4.0m modular segments (each merged to 1 draw call) with undistorted
 *   world-meter UVs; segments strictly behind the approaching `endGroup` are hidden invisibly.
 * - At the far end sits a REAL hinged, pushable/openable apartment armored door (`endDoorPivot`)
 *   that slides hyperbolically closer from 54m away down to X = -17.20 as the player walks West.
 *   Pushing or opening that door reveals a 1:1 lit 180°-rotated Entryway behind it so walking
 *   straight through folds seamlessly back into the player's own Entryway!
 */
export function buildNonEuclidCorridor(
  ctx: RoomBuildContext,
  playDoorAudio: (open: boolean) => void
): void {
  const { scene, textures, outlines, mat, metaState, registerInteractable } = ctx;

  const root = new THREE.Group();
  root.name = 'NonEuclidCorridor';
  root.visible = false;
  scene.add(root);

  const FLOOR_Y = -0.08;
  const CEIL_Y = 3.02;
  const CORR_H = CEIL_Y - FLOOR_Y; // 3.10m matching apartment ceiling height
  const Z_CENTER = 4.60;
  const HALF_W = 1.08; // Interior Z = 3.52 .. 5.68 (clean 2.16m width)
  const BAY_LEN = 4.0;
  const BAY_COUNT = 18; // Spans X = -8.00 .. -80.00 (72 meters of deep vanishing perspective!)

  // Clean apartment-harmonized materials (wallpaper + honey-oak wainscoting + warm oak floor)
  const hallWallpaperMat = mat({
    map: textures.wallpaperLiving,
    color: 0xf0eef8,
    roughness: 0.90,
    metalness: 0.0,
    celStrength: 0.54,
  });
  const hallWainscotMat = mat({
    map: textures.wainscotWood,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xe6d3c4,
    roughness: 0.78,
    metalness: 0.02,
    celStrength: 0.52,
    woodLacquer: 0.16,
  });
  const hallOakTrimMat = mat({
    map: textures.furnitureOak,
    color: 0xf2d9b6,
    roughness: 0.64,
    metalness: 0.02,
    woodLacquer: 0.24,
  });
  const hallWoodFloorMat = mat({
    map: textures.woodFloor,
    bumpMap: textures.woodFloorBump,
    bumpScale: 0.012,
    roughnessMap: textures.woodFloorRoughness,
    color: 0xfcf2e4,
    roughness: 0.68,
    metalness: 0.02,
    woodLacquer: 0.20,
    celStrength: 0.50,
  });
  const hallCeilMat = mat({
    color: 0xf1eff8,
    roughness: 0.90,
    metalness: 0.0,
    celStrength: 0.48,
  });
  const crownMat = mat({
    color: 0xf6f3fa,
    roughness: 0.76,
    metalness: 0.02,
  });
  const darkMetalMat = mat({
    color: 0x352e45,
    roughness: 0.32,
    metalness: 0.76,
  });
  const brassMat = mat({
    color: 0xc99c58,
    roughness: 0.30,
    metalness: 0.82,
  });
  const doorSteelMat = mat({
    color: 0x564d69,
    roughness: 0.48,
    metalness: 0.42,
  });
  const roundLampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfff0d8 });

  // Helper to assign crisp world-meter UVs so wallpaper, wainscoting & wood floor never stretch
  const makeBoxWorldUV = (
    w: number,
    h: number,
    d: number,
    tileX: number,
    tileY: number,
    tileZ: number
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const norm = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (ny > 0.5) {
        uv.setXY(i, u * (w / tileX), v * (d / tileZ));
      } else if (nx > 0.5) {
        uv.setXY(i, u * (d / tileZ), v * (h / tileY));
      } else {
        uv.setXY(i, u * (w / tileX), v * (h / tileY));
      }
    }
    uv.needsUpdate = true;
    return g;
  };

  // =========================================================================
  // 1. 14 CLEAN MODULAR CORRIDOR BAYS (56m DEEP: X = -8.0 .. -64.0)
  //    Clean wallpaper + honey-oak wainscoting + warm oak floor + sparse round lamps!
  // =========================================================================
  const bays: { group: THREE.Group; frontX: number }[] = [];

  for (let b = 0; b < BAY_COUNT; b++) {
    const frontX = -8.0 - b * BAY_LEN;
    const centerX = frontX - BAY_LEN / 2;
    const bayGroup = new THREE.Group();
    bayGroup.name = `NonEuclidCleanBay_${b}`;

    // Warm oak hardwood floor slab (undistorted world-meter plank scale)
    const floorGeo = makeBoxWorldUV(BAY_LEN + 0.02, 0.16, HALF_W * 2 + 0.24, 2.2, 1.0, 2.2);
    const fMesh = new THREE.Mesh(floorGeo, hallWoodFloorMat);
    fMesh.position.set(centerX, FLOOR_Y - 0.08, Z_CENTER);
    fMesh.receiveShadow = true;
    bayGroup.add(fMesh);

    // Clean ceiling slab
    const ceilMesh = new THREE.Mesh(
      new THREE.BoxGeometry(BAY_LEN + 0.02, 0.16, HALF_W * 2 + 0.24),
      hallCeilMat
    );
    ceilMesh.position.set(centerX, CEIL_Y + 0.08, Z_CENTER);
    bayGroup.add(ceilMesh);

    // North & South Clean Wallpaper Walls + Honey-Oak Wainscoting + Chair Rail + Baseboard + Crown
    for (const side of [-1, 1] as const) {
      const wallZ = Z_CENTER + side * (HALF_W + 0.08);
      const innerZ = Z_CENTER + side * HALF_W;

      const wallGeo = makeBoxWorldUV(BAY_LEN + 0.02, CORR_H, 0.16, 2.2, 2.2, 1.0);
      const wall = new THREE.Mesh(wallGeo, hallWallpaperMat);
      wall.position.set(centerX, FLOOR_Y + CORR_H / 2, wallZ);
      wall.receiveShadow = true;
      bayGroup.add(wall);

      // Clean lower honey-oak wood wainscoting (0.94m tall)
      const wainGeo = makeBoxWorldUV(BAY_LEN + 0.02, 0.94, 0.024, 1.8, 0.94, 1.0);
      const wain = new THREE.Mesh(wainGeo, hallWainscotMat);
      wain.position.set(centerX, FLOOR_Y + 0.47, innerZ - side * 0.012);
      wain.receiveShadow = true;
      bayGroup.add(wain);

      // Honey-oak beveled chair rail cap along top of wainscoting
      const chairRail = new THREE.Mesh(
        createBeveledBox(BAY_LEN + 0.02, 0.044, 0.046, 0.008, 2),
        hallOakTrimMat
      );
      chairRail.position.set(centerX, FLOOR_Y + 0.955, innerZ - side * 0.020);
      bayGroup.add(chairRail);

      // Honey-oak floor baseboard
      const baseboard = new THREE.Mesh(
        createBeveledBox(BAY_LEN + 0.02, 0.072, 0.036, 0.006, 2),
        hallOakTrimMat
      );
      baseboard.position.set(centerX, FLOOR_Y + 0.036, innerZ - side * 0.016);
      bayGroup.add(baseboard);

      // Clean white ceiling crown molding
      const crown = new THREE.Mesh(
        createBeveledBox(BAY_LEN + 0.02, 0.048, 0.042, 0.008, 1),
        crownMat
      );
      crown.position.set(centerX, CEIL_Y - 0.024, innerZ - side * 0.018);
      bayGroup.add(crown);
    }

    // Sparse, warm Round Flush Ceiling Dome Lamps (圆灯 — only every 3rd bay, i.e., every 12.0 meters!)
    if (b % 3 === 1) {
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.195, 0.032, 20),
        crownMat
      );
      rim.position.set(centerX, CEIL_Y - 0.016, Z_CENTER);
      bayGroup.add(rim);

      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
        roundLampGlowMat
      );
      dome.position.set(centerX, CEIL_Y - 0.022, Z_CENTER);
      bayGroup.add(dome);
    }

    mergeStaticGroupToSingleMesh(bayGroup, outlines, `NonEuclidCleanBayMerged_${b}`);
    root.add(bayGroup);
    bays.push({ group: bayGroup, frontX });
  }

  // Sparse soft warm-cream corridor round-lamp PointLights (aligned with the 12m round ceiling lamps)
  for (const lx of [-14.0, -26.0]) {
    const corrLight = new THREE.PointLight(0xffe9d2, 0.72, 14.0, 1.25);
    corrLight.position.set(lx, CEIL_Y - 0.28, Z_CENTER);
    corrLight.castShadow = false;
    scene.add(corrLight);
  }

  // =========================================================================
  // 2. APPROACHING NON-EUCLIDEAN END WALL + REAL PUSHABLE/OPENABLE ARMORED DOOR
  //    Starts 68m away at X = -76.0 and contracts hyperbolically to X = -16.00 (exact bay seam!).
  //    Player pushes or opens this exact apartment door to step smoothly back into Entryway!
  // =========================================================================
  const endGroup = new THREE.Group();
  endGroup.name = 'NonEuclidReturnPortalEnd';
  endGroup.position.set(-76.0, FLOOR_Y, Z_CENTER);
  endGroup.userData.dynamic = true;

  // Clean matching wallpaper + wainscoting end partition framing the return doorway (Z = -0.56 .. +0.56)
  for (const side of [-1, 1] as const) {
    const sideW = new THREE.Mesh(
      makeBoxWorldUV(0.18, CORR_H, 0.64, 1.0, 2.2, 2.2),
      hallWallpaperMat
    );
    sideW.position.set(0, CORR_H / 2, side * 0.88);
    endGroup.add(sideW);

    const sideWain = new THREE.Mesh(
      makeBoxWorldUV(0.024, 0.94, 0.62, 1.0, 0.94, 1.8),
      hallWainscotMat
    );
    sideWain.position.set(0.095, 0.47, side * 0.87);
    endGroup.add(sideWain);

    const sideRail = new THREE.Mesh(
      createBeveledBox(0.044, 0.044, 0.62, 0.008, 1),
      hallOakTrimMat
    );
    sideRail.position.set(0.105, 0.955, side * 0.87);
    endGroup.add(sideRail);

    const jamb = new THREE.Mesh(
      createBeveledBox(0.22, 2.34, 0.08, 0.008, 2),
      darkMetalMat
    );
    jamb.position.set(0, 1.17, side * 0.56);
    endGroup.add(jamb);
  }

  const endHeaderWall = new THREE.Mesh(
    makeBoxWorldUV(0.18, CORR_H - 2.28, 1.16, 1.0, 2.2, 2.2),
    hallWallpaperMat
  );
  endHeaderWall.position.set(0, 2.28 + (CORR_H - 2.28) / 2, 0);
  endGroup.add(endHeaderWall);

  const endHeaderFrame = new THREE.Mesh(
    createBeveledBox(0.22, 0.09, 1.22, 0.008, 2),
    darkMetalMat
  );
  endHeaderFrame.position.set(0, 2.31, 0);
  endGroup.add(endHeaderFrame);

  const endThreshold = new THREE.Mesh(
    createBeveledBox(0.20, 0.024, 1.12, 0.004, 2),
    darkMetalMat
  );
  endThreshold.position.set(0, 0.012, 0);
  endGroup.add(endThreshold);

  // =========================================================================
  // 1:1 180°-Rotated Return Entryway + Open Archway + Dining & Kitchen Vista!
  // Exact coordinate transform from real apartment (realX, realY, realZ) into
  // endGroup local space (origin = doorway center at realX=-8.00, realY=-0.08, realZ=4.60):
  //   localX = -8.00 - realX,   localY = realY + 0.08,   localZ = 4.60 - realZ
  // This removes the old solid blocking wall so opening the end door reveals the
  // exact Entryway, open archway, dining table & kitchen vista with zero visual jump!
  // =========================================================================
  const dioWallMat = mat({
    map: textures.wallpaperLiving,
    color: 0xfff8fa,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.56,
  });
  const dioDiningWallMat = mat({
    map: textures.wallpaperLiving,
    color: 0xfff8fa,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.56,
  });
  const dioWainscotMat = mat({
    map: textures.wainscotWood,
    color: 0xe6d5c8,
    roughness: 0.82,
    metalness: 0.02,
    celStrength: 0.54,
  });
  const dioOakMat = mat({
    map: textures.furnitureOak,
    color: 0xebd8ca,
    roughness: 0.54,
    metalness: 0.04,
  });
  const dioDrawerWhiteMat = mat({
    color: 0xf7f2eb,
    roughness: 0.56,
    metalness: 0.02,
  });
  const dioCeilMat = mat({
    color: 0xf4f2fa,
    roughness: 0.92,
    metalness: 0.0,
    celStrength: 0.48,
  });
  const dioKitchenTileMat = mat({
    map: textures.kitchenTile,
    color: 0xf4eef7,
    roughness: 0.52,
    metalness: 0.04,
  });
  const dioTableclothMat = mat({
    map: textures.tableclothPink,
    color: 0xfafbf8,
    roughness: 0.84,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const dioMossCushionMat = mat({
    map: textures.plushFabric,
    color: 0x647d43,
    roughness: 0.86,
    metalness: 0.0,
  });
  const dioWinGlowMat = mat({
    color: 0xf6efe6,
    emissive: new THREE.Color(0xffe8ce),
    emissiveIntensity: 0.42,
    roughness: 0.48,
    metalness: 0.0,
  });

  // --- A. ENTRYWAY FLOOR, SUNKEN GENKAN & RAISED STEP (localX: 0 .. -5.30) ---
  const ENTRY_DEPTH = 5.30; // realX: -8.00 .. -2.70
  const TOTAL_VISTA_DEPTH = 15.35; // realX: -8.00 .. +7.35 (Entryway + Dining + Kitchen!)

  const dioFloorGenkan = new THREE.Mesh(
    new THREE.BoxGeometry(2.12, 0.14, 4.32),
    mat({ map: textures.genkanTile, color: 0xb9b0cf, roughness: 0.68 })
  );
  dioFloorGenkan.position.set(-1.06, -0.07, 0);
  dioFloorGenkan.receiveShadow = true;
  endGroup.add(dioFloorGenkan);

  const dioStep = new THREE.Mesh(
    createBeveledSlab(0.16, 0.095, 4.26, 0.02, 0.01),
    mat({ color: 0xc99474, roughness: 0.78 })
  );
  dioStep.position.set(-2.12, 0.044, 0);
  endGroup.add(dioStep);

  // Entryway + Dining hardwood floor (localX: -2.12 .. -11.18, Y top = +0.08)
  const dioWoodSpan = 11.18 - 2.12;
  const dioFloorWood = new THREE.Mesh(
    makeBoxWorldUV(dioWoodSpan, 0.22, 6.60, 2.2, 1.0, 2.2),
    hallWoodFloorMat
  );
  dioFloorWood.position.set(-2.12 - dioWoodSpan / 2, -0.03, 1.08);
  dioFloorWood.receiveShadow = true;
  endGroup.add(dioFloorWood);

  // Kitchen tiled floor (localX: -11.18 .. -15.35, Y top = +0.08)
  const dioKitSpan = TOTAL_VISTA_DEPTH - 11.18;
  const dioFloorKit = new THREE.Mesh(
    makeBoxWorldUV(dioKitSpan, 0.22, 6.60, 2.0, 1.0, 2.0),
    dioKitchenTileMat
  );
  dioFloorKit.position.set(-11.18 - dioKitSpan / 2, -0.03, 1.08);
  dioFloorKit.receiveShadow = true;
  endGroup.add(dioFloorKit);

  // Continuous Entryway + Dining + Kitchen ceiling (Y bottom = 3.18 -> real Y = 3.10)
  const dioCeil = new THREE.Mesh(
    new THREE.BoxGeometry(TOTAL_VISTA_DEPTH + 0.2, 0.14, 6.80),
    dioCeilMat
  );
  dioCeil.position.set(-TOTAL_VISTA_DEPTH / 2, 3.25, 1.08);
  endGroup.add(dioCeil);

  // --- B. ENTRYWAY SIDE WALLS (localX: 0 .. -5.30, localZ = -2.14 & +2.15) ---
  for (const [wz, sign] of [
    [2.15, 1],
    [-2.14, -1],
  ] as const) {
    const sWall = new THREE.Mesh(
      makeBoxWorldUV(ENTRY_DEPTH, 3.22, 0.16, 2.2, 2.2, 1.0),
      dioWallMat
    );
    sWall.position.set(-ENTRY_DEPTH / 2, 1.61, wz + sign * 0.08);
    endGroup.add(sWall);

    const sWain = new THREE.Mesh(
      makeBoxWorldUV(ENTRY_DEPTH, 0.92, 0.022, 1.8, 0.92, 1.0),
      dioWainscotMat
    );
    sWain.position.set(-ENTRY_DEPTH / 2, 0.46, wz - sign * 0.011);
    endGroup.add(sWain);

    const sRail = new THREE.Mesh(
      new THREE.BoxGeometry(ENTRY_DEPTH, 0.045, 0.042),
      hallOakTrimMat
    );
    sRail.position.set(-ENTRY_DEPTH / 2, 0.93, wz - sign * 0.020);
    endGroup.add(sRail);
  }

  // --- C. OPEN ENTRYWAY-DINING ARCHWAY AT localX = -5.30 (realX = -2.70) ---
  // North pilaster (realZ = 2.45..2.95 -> localZ = +1.65..+2.15)
  const archNorthPil = new THREE.Mesh(
    makeBoxWorldUV(0.18, 3.22, 0.56, 1.0, 2.2, 2.2),
    dioWallMat
  );
  archNorthPil.position.set(-ENTRY_DEPTH, 1.61, 1.90);
  endGroup.add(archNorthPil);

  // South pilaster (realZ = 5.75..6.74 -> localZ = -2.14..-1.15)
  const archSouthPil = new THREE.Mesh(
    makeBoxWorldUV(0.18, 3.22, 1.04, 1.0, 2.2, 2.2),
    dioWallMat
  );
  archSouthPil.position.set(-ENTRY_DEPTH, 1.61, -1.65);
  endGroup.add(archSouthPil);

  // Archway overhead header (localY = 2.48..3.18, spanning open Z = -1.15..+1.65)
  const archHeader = new THREE.Mesh(
    makeBoxWorldUV(0.18, 0.72, 2.86, 1.0, 2.2, 2.2),
    dioWallMat
  );
  archHeader.position.set(-ENTRY_DEPTH, 2.83, 0.25);
  endGroup.add(archHeader);

  // --- D. MATCHING 1:1 ENTRYWAY FURNISHINGS ---
  // 1) Shoe Cabinet (realX = -5.15, realZ = 2.80 -> localX = -2.85, localZ = +1.80)
  const dioShoeCab = new THREE.Mesh(
    createBeveledBox(1.48, 0.88, 0.40, 0.012, 2),
    dioOakMat
  );
  dioShoeCab.position.set(-2.85, 0.74, 1.80);
  endGroup.add(dioShoeCab);

  const dioShoeTop = new THREE.Mesh(
    createBeveledSlab(1.56, 0.030, 0.46, 0.025, 0.008),
    dioOakMat
  );
  dioShoeTop.position.set(-2.85, 1.195, 1.80);
  endGroup.add(dioShoeTop);

  for (const dx of [-0.48, 0, 0.48]) {
    const uDrw = new THREE.Mesh(
      createBeveledBox(0.44, 0.18, 0.026, 0.006, 1),
      dioDrawerWhiteMat
    );
    uDrw.position.set(-2.85 + dx, 1.04, 1.592);
    endGroup.add(uDrw);
    const lDrw = new THREE.Mesh(
      createBeveledBox(0.44, 0.56, 0.026, 0.006, 1),
      dioDrawerWhiteMat
    );
    lDrw.position.set(-2.85 + dx, 0.62, 1.592);
    endGroup.add(lDrw);
  }
  const dioMiniPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.055, 0.13, 12),
    mat({ color: 0xdf9e7d, roughness: 0.65 })
  );
  dioMiniPot.position.set(-3.31, 1.28, 1.84);
  endGroup.add(dioMiniPot);
  const dioSucc = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 10, 8),
    mat({ color: 0x628c65, roughness: 0.68 })
  );
  dioSucc.scale.set(1, 0.65, 1);
  dioSucc.position.set(-3.31, 1.36, 1.84);
  endGroup.add(dioSucc);

  // 2) Coat Rack + Hanging Pink Coat, Olive Jacket & Royal-Blue Umbrella Bin (realX=-7.28, realZ=6.12 -> localX=-0.72, localZ=-1.52)
  const dioCoatBoard = new THREE.Mesh(
    createBeveledBox(0.76, 0.12, 0.032, 0.008, 1),
    dioOakMat
  );
  dioCoatBoard.position.set(-0.80, 1.66, -1.98);
  endGroup.add(dioCoatBoard);

  const dioPinkCoat = new THREE.Mesh(
    createPlushBox(0.28, 0.82, 0.16, 0.04, 0.18),
    mat({ color: 0xe07898, roughness: 0.78 })
  );
  dioPinkCoat.position.set(-0.60, 1.22, -1.86);
  endGroup.add(dioPinkCoat);

  const dioGreenCoat = new THREE.Mesh(
    createPlushBox(0.26, 0.64, 0.15, 0.04, 0.16),
    mat({ color: 0x5c8a58, roughness: 0.80 })
  );
  dioGreenCoat.position.set(-0.94, 1.30, -1.87);
  endGroup.add(dioGreenCoat);

  const dioUmbBin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.125, 0.48, 14),
    mat({ color: 0x4668b8, roughness: 0.38, metalness: 0.18 })
  );
  dioUmbBin.position.set(-0.76, 0.24, -1.64);
  endGroup.add(dioUmbBin);

  // 3) Blue & Red Slippers on sunken Genkan floor
  const dioBlueSlipMat = mat({ color: 0x5c6f9c, roughness: 0.78 });
  const dioRedSlipMat = mat({ color: 0xc74e5e, roughness: 0.78 });
  for (const [sx, sz, rotY, sMat] of [
    [-1.45, 0.55, 0.1, dioBlueSlipMat],
    [-1.45, 0.32, 0.08, dioBlueSlipMat],
    [-1.75, -0.45, -1.4, dioRedSlipMat],
    [-1.70, -0.66, -1.75, dioRedSlipMat],
  ] as const) {
    const slip = new THREE.Mesh(createBeveledSlab(0.115, 0.042, 0.26, 0.045, 0.008), sMat);
    slip.position.set(sx, 0.022, sz);
    slip.rotation.y = rotY;
    endGroup.add(slip);
  }

  // 4) Full-Length Framed Mirror on right wall (realX=-4.40, realZ=6.62 -> localX=-3.60, localZ=-2.02)
  const dioMirrorFrame = new THREE.Mesh(
    createBeveledBox(0.78, 1.44, 0.038, 0.010, 1),
    dioOakMat
  );
  dioMirrorFrame.position.set(-3.60, 1.56, -2.04);
  endGroup.add(dioMirrorFrame);
  const dioMirrorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 1.28),
    mat({ color: 0xc8d2e2, roughness: 0.14, metalness: 0.55 })
  );
  dioMirrorGlass.position.set(-3.60, 1.56, -2.015);
  endGroup.add(dioMirrorGlass);

  // 5) Electrical Breaker Box beside door (realX=-7.84, realZ=3.68 -> localX=-0.16, localZ=+0.92)
  const dioBreaker = new THREE.Mesh(
    createBeveledBox(0.056, 0.32, 0.44, 0.010, 1),
    dioDrawerWhiteMat
  );
  dioBreaker.position.set(-0.16, 1.80, 0.92);
  endGroup.add(dioBreaker);

  // Entryway flush ceiling lamp
  const dioLamp = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 16),
    roundLampGlowMat
  );
  dioLamp.rotation.x = Math.PI / 2;
  dioLamp.position.set(-2.90, 3.16, 0);
  endGroup.add(dioLamp);

  // --- E. DINING ROOM & KITCHEN VISTA BEYOND THE OPEN ARCHWAY (localX: -5.30 .. -15.35) ---
  const DIN_KIT_DEPTH = TOTAL_VISTA_DEPTH - ENTRY_DEPTH; // 10.05m
  // Right wall (real South Dining/Kitchen wall at Z = 6.74 -> localZ = -2.14)
  const dioSouthDinWall = new THREE.Mesh(
    makeBoxWorldUV(DIN_KIT_DEPTH, 3.22, 0.18, 2.2, 2.2, 1.0),
    dioDiningWallMat
  );
  dioSouthDinWall.position.set(-ENTRY_DEPTH - DIN_KIT_DEPTH / 2, 1.61, -2.23);
  endGroup.add(dioSouthDinWall);

  // South Dining Window sunlight panel (realX = -1.45 -> localX = -6.55)
  const dioSouthWin = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 1.58), dioWinGlowMat);
  dioSouthWin.position.set(-6.55, 1.82, -2.12);
  endGroup.add(dioSouthWin);

  // Left wall (real North Dining/Kitchen wall at Z = 0.25 -> localZ = +4.35)
  const dioNorthDinWall = new THREE.Mesh(
    makeBoxWorldUV(DIN_KIT_DEPTH, 3.22, 0.18, 2.2, 2.2, 1.0),
    dioDiningWallMat
  );
  dioNorthDinWall.position.set(-ENTRY_DEPTH - DIN_KIT_DEPTH / 2, 1.61, 4.44);
  endGroup.add(dioNorthDinWall);

  // Far back wall (real East Kitchen wall at X = 7.35 -> localX = -15.35)
  const dioFarEastWall = new THREE.Mesh(
    makeBoxWorldUV(0.18, 3.22, 6.75, 1.0, 2.2, 2.2),
    dioDiningWallMat
  );
  dioFarEastWall.position.set(-TOTAL_VISTA_DEPTH - 0.09, 1.61, 1.12);
  endGroup.add(dioFarEastWall);

  // Sunlit Kitchen East Window glow on far back wall (realZ = 4.95 -> localZ = -0.35)
  const dioKitEastWin = new THREE.Mesh(new THREE.PlaneGeometry(1.50, 1.38), dioWinGlowMat);
  dioKitEastWin.rotation.y = Math.PI / 2;
  dioKitEastWin.position.set(-TOTAL_VISTA_DEPTH + 0.02, 1.88, -0.35);
  endGroup.add(dioKitEastWin);

  // Dining Table with Green Floral Tablecloth & 4 Moss-Green Dining Chairs (realX=0.32, realZ=4.25 -> localX=-8.32, localZ=+0.35)
  const DIN_LX = -8.32;
  const DIN_LZ = 0.35;
  const dioTableTop = new THREE.Mesh(
    createBeveledSlab(1.85, 0.04, 1.17, 0.04, 0.008),
    dioOakMat
  );
  dioTableTop.position.set(DIN_LX, 0.96, DIN_LZ);
  endGroup.add(dioTableTop);

  const dioClothGeo = createDrapedTableclothGeometry(1.85, 1.17, 0.25);
  const dioCloth = new THREE.Mesh(dioClothGeo, dioTableclothMat);
  dioCloth.position.set(DIN_LX, 0.985, DIN_LZ);
  endGroup.add(dioCloth);

  for (const [tlx, tlz] of [
    [-0.76, -0.44],
    [0.76, -0.44],
    [-0.76, 0.44],
    [0.76, 0.44],
  ] as const) {
    const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, 0.88, 8), dioOakMat);
    tLeg.position.set(DIN_LX + tlx, 0.52, DIN_LZ + tlz);
    endGroup.add(tLeg);
  }

  for (const [cx, cz, backDir] of [
    [-0.54, -0.84, -1],
    [0.54, -0.84, -1],
    [-0.54, 0.84, 1],
    [0.54, 0.84, 1],
  ] as const) {
    const cSeat = new THREE.Mesh(createPlushBox(0.44, 0.05, 0.44, 0.02, 0.08), dioMossCushionMat);
    cSeat.position.set(DIN_LX + cx, 0.56, DIN_LZ + cz);
    endGroup.add(cSeat);
    const cBack = new THREE.Mesh(createBeveledBox(0.45, 0.16, 0.032, 0.008, 1), dioOakMat);
    cBack.position.set(DIN_LX + cx, 0.94, DIN_LZ + cz + backDir * 0.20);
    endGroup.add(cBack);
    for (const lx of [-0.17, 0.17]) {
      for (const lz of [-0.17, 0.17]) {
        const cLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.010, 0.46, 6), dioOakMat);
        cLeg.position.set(DIN_LX + cx + lx, 0.31, DIN_LZ + cz + lz);
        endGroup.add(cLeg);
      }
    }
  }

  // Dining Pendant Lamp Dome above the table
  const dioPendant = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.18, 16),
    mat({ color: 0xe6eaf2, roughness: 0.28, metalness: 0.65 })
  );
  dioPendant.position.set(DIN_LX, 2.38, DIN_LZ);
  endGroup.add(dioPendant);
  const dioPendantBulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), roundLampGlowMat);
  dioPendantBulb.position.set(DIN_LX, 2.28, DIN_LZ);
  endGroup.add(dioPendantBulb);

  // Dining Sideboard Buffet (realX=0.32, realZ=6.38 -> localX=-8.32, localZ=-1.78)
  const dioSideboard = new THREE.Mesh(
    createBeveledBox(1.76, 0.84, 0.44, 0.012, 1),
    dioOakMat
  );
  dioSideboard.position.set(-8.32, 0.52, -1.78);
  endGroup.add(dioSideboard);

  // Kitchen Breakfast Bar Divider (realX=3.18, realZ=3.82..6.74 -> localX=-11.18, localZ=-2.14..+0.78)
  const dioBarWall = new THREE.Mesh(
    createBeveledBox(0.32, 1.04, 2.94, 0.012, 1),
    dioDiningWallMat
  );
  dioBarWall.position.set(-11.18, 0.60, -0.68);
  endGroup.add(dioBarWall);
  const dioBarTop = new THREE.Mesh(
    createBeveledSlab(0.54, 0.048, 3.00, 0.02, 0.008),
    dioOakMat
  );
  dioBarTop.position.set(-11.18, 1.13, -0.68);
  endGroup.add(dioBarTop);

  // Kitchen East Countertop & Upper Cabinets along far wall (localX = -14.88)
  const dioKitCounter = new THREE.Mesh(
    createBeveledBox(0.74, 0.90, 3.40, 0.012, 1),
    dioDrawerWhiteMat
  );
  dioKitCounter.position.set(-14.92, 0.53, -0.45);
  endGroup.add(dioKitCounter);
  const dioKitUpperCab = new THREE.Mesh(
    createBeveledBox(0.42, 0.78, 1.85, 0.012, 1),
    dioOakMat
  );
  dioKitUpperCab.position.set(-15.08, 2.48, 1.78);
  endGroup.add(dioKitUpperCab);

  // Refrigerator silhouette at North Kitchen entrance (realX=3.86, realZ=0.76 -> localX=-11.86, localZ=+3.84)
  const dioFridge = new THREE.Mesh(
    createBeveledBox(0.82, 1.88, 0.70, 0.10, 3),
    mat({ color: 0xf6e6c0, roughness: 0.22, metalness: 0.06 })
  );
  dioFridge.position.set(-11.86, 1.02, 3.84);
  endGroup.add(dioFridge);

  // Opaque light-blocking shroud strictly behind the far Kitchen wall so distant bays never bleed through
  const shroudBack = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 5.2),
    new THREE.MeshBasicMaterial({ color: 0x161024, side: THREE.DoubleSide })
  );
  shroudBack.rotation.y = Math.PI / 2;
  shroudBack.position.set(-TOTAL_VISTA_DEPTH - 0.28, 1.65, 1.08);
  endGroup.add(shroudBack);

  mergeStaticGroupToSingleMesh(endGroup, outlines, 'NonEuclidReturnEndMerged');

  // =========================================================================
  // 3. HINGED PUSHABLE / OPENABLE END ARMORED DOOR (`endDoorPivot`)
  //    Hinged on the right jamb (local Z = +0.54, leaf extends -Z by 1.08m).
  //    Swings INWARD West (-X) into the returning Entryway when pushed or interacted!
  // =========================================================================
  const endDoorPivot = new THREE.Group();
  endDoorPivot.name = 'NonEuclidEndDoorPivot';
  endDoorPivot.position.set(-0.02, 0, 0.54);
  endDoorPivot.userData.dynamic = true;

  const endDoorPanel = new THREE.Mesh(
    createBeveledBox(0.072, 2.26, 1.06, 0.009, 3),
    doorSteelMat
  );
  endDoorPanel.position.set(0, 1.13, -0.54);
  outlines.addOutline(endDoorPanel, 1.014);
  endDoorPivot.add(endDoorPanel);

  for (const py of [0.38, 0.86, 1.38, 1.86]) {
    const stamp = new THREE.Mesh(
      createBeveledBox(0.084, 0.36, 0.78, 0.008, 2),
      doorSteelMat
    );
    stamp.position.set(0, py, -0.54);
    endDoorPivot.add(stamp);
  }

  const endPeephole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.10, 14),
    brassMat
  );
  endPeephole.rotation.z = Math.PI / 2;
  endPeephole.position.set(0, 1.56, -0.54);
  endDoorPivot.add(endPeephole);

  const endLockBox = new THREE.Mesh(
    createBeveledBox(0.086, 0.24, 0.11, 0.010, 2),
    darkMetalMat
  );
  endLockBox.position.set(0.015, 1.10, -0.94);
  endDoorPivot.add(endLockBox);

  for (const hSide of [-1, 1] as const) {
    const grip = new THREE.Mesh(
      createBeveledBox(0.030, 0.028, 0.14, 0.008, 2),
      brassMat
    );
    grip.position.set(hSide * 0.074, 1.04, -0.89);
    endDoorPivot.add(grip);
  }

  const endLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x5ef2ff })
  );
  endLed.position.set(0.064, 1.18, -0.94);
  endDoorPivot.add(endLed);

  // Merge all 10 rigid end-door sub-meshes into a single dynamic draw call
  mergeDynamicSubtreeMeshes(endDoorPivot, outlines, 'NonEuclidEndDoorLeafMerged');
  endGroup.add(endDoorPivot);

  registerInteractable(
    'non_euclid_end_door',
    '尽头的防盗门',
    '推开房门',
    'entryway',
    endDoorPivot,
    () => {
      const corr = metaState.nonEuclidCorridor;
      corr.endDoorIsOpen = !corr.endDoorIsOpen;
      corr.endDoorAudioPlayed = true;
      playDoorAudio(corr.endDoorIsOpen);
      return {
        title: corr.endDoorIsOpen ? '推开尽头的房门' : '合上房门',
        message: corr.endDoorIsOpen
          ? '厚重的防盗门缓缓向内敞开——门后透出的，竟是熟悉而温暖的玄关灯光。'
          : '防盗门轻轻合拢，长廊再次归于寂静。',
      };
    }
  );

  // Dynamic warm light inside the returning Entryway diorama (synced with endGroup.position.x)
  const dioramaLight = new THREE.PointLight(0xffeed8, 0.96, 10.5, 1.12);
  dioramaLight.position.set(-1.85, 2.75, 0);
  dioramaLight.castShadow = false;
  endGroup.add(dioramaLight);

  root.add(endGroup);

  metaState.nonEuclidCorridor.group = root;
  metaState.nonEuclidCorridor.shellGroup = null;
  metaState.nonEuclidCorridor.endGroup = endGroup;
  metaState.nonEuclidCorridor.endDoorPivot = endDoorPivot;
  metaState.nonEuclidCorridor.endDoorAngle = 0;
  metaState.nonEuclidCorridor.endDoorVel = 0;
  metaState.nonEuclidCorridor.endDoorIsOpen = false;
  metaState.nonEuclidCorridor.endDoorAudioPlayed = false;
  metaState.nonEuclidCorridor.bays = bays;
  metaState.nonEuclidCorridor.dioramaLight = dioramaLight;
}
