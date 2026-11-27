import * as THREE from 'three';
import {
  createBeveledBox,
  createBeveledSlab,
  createPlushBox,
  createTaperedCurveGeometry,
  createTurnedLegGeometry,
  createTyndallShaftClusterGeometry,
} from '../geometries';
import {
  createMirrorSurfaceShaderMaterial,
  createTyndallBeamShaderMaterial,
  createWindowEmissiveMaterial,
} from '../pipeline';
import { mergeStaticGroupToSingleMesh } from '../SceneManager';
import { apartmentColorStudio } from '../devColorStudio';
import type { RoomBuildContext } from './roomContext';

/**
 * Builds a cozy MiSide-inspired Bathroom connected to the right side of the Living Room
 * North painting wall (Z = -10.40, doorway X = 4.68 .. 5.78).
 *
 * Footprint: X = 2.95 .. 7.35 (4.40m wide), Z = -14.15 .. -10.40 (3.75m deep), Y = 0 .. 3.10.
 * Harmonized with the apartment's soft cream/lavender/honey-oak palette while incorporating
 * the pastel powder-blue wave-stripe upper walls, warm ivory ceramic lower tiles, curved
 * corner glass shower enclosure, louvered vanity & brass faucet, wall mirror, oak towel rack,
 * toilet, washing machine, high frosted vent window, and marine porthole medallion.
 */
export function buildBathroom(
  ctx: RoomBuildContext,
  playDoorAudio: (open: boolean) => void
): void {
  const {
    scene,
    sceneManager,
    ceilingGroup,
    uniforms,
    textures,
    outlines,
    volumetricRays,
    windowGlowMeshes,
    mat,
    addWall,
    addBoxCollider,
    registerDoor,
    registerCabinetDoor,
    registerCeilingLamp,
    registerInteractable,
  } = ctx;

  const group = new THREE.Group();
  group.name = 'BathroomRoom';
  scene.add(group);
  sceneManager.registerRoomGroup('bathroom', group);

  // Room dimensions: X = 2.95 .. 7.35, Z = -14.15 .. -10.40, H = 3.10
  const X1 = 2.95;
  const X2 = 7.35;
  const Z1 = -14.15;
  const Z2 = -10.40;
  const CX = (X1 + X2) / 2; // 5.15
  const CZ = (Z1 + Z2) / 2; // -12.275
  const W = X2 - X1; // 4.40
  const D = Z2 - Z1; // 3.75
  const H = 3.10;
  const wallThick = 0.18;

  // Materials harmonized with the apartment's warm cream/honey-oak & MiSide pastel powder-blue
  const bathTileFloorMat = mat({
    map: textures.bathroomTile,
    bumpMap: textures.kitchenTileBump,
    bumpScale: 0.008,
    color: 0xf7f4f9,
    roughness: 0.34,
    metalness: 0.06,
    celStrength: 0.50,
  });

  const bathLowerTileMat = mat({
    map: textures.bathroomTile,
    bumpMap: textures.kitchenTileBump,
    bumpScale: 0.006,
    color: 0xfaf6f2,
    roughness: 0.30,
    metalness: 0.05,
    celStrength: 0.52,
  });

  const bathUpperWallMat = mat({
    map: textures.bathroomWall,
    color: 0xf2f7fc,
    roughness: 0.88,
    metalness: 0.0,
    celStrength: 0.58,
  });

  const ceilingMat = mat({
    color: 0xf4f0f5,
    roughness: 0.90,
    metalness: 0.0,
    celStrength: 0.50,
  });

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

  const ceramicWhiteMat = mat({
    color: 0xfbf8fc,
    roughness: 0.22,
    metalness: 0.06,
  });

  const vanityBlueMat = mat({
    color: 0xdcebf4,
    roughness: 0.44,
    metalness: 0.04,
  });

  const vanityTrimMat = mat({
    color: 0xf2f6fa,
    roughness: 0.42,
    metalness: 0.04,
  });

  const brassMat = mat({
    color: 0xd9ad62,
    roughness: 0.28,
    metalness: 0.78,
  });

  const chromeMat = mat({
    color: 0xd8dde8,
    roughness: 0.22,
    metalness: 0.78,
  });

  const towelWhiteMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.008,
    color: 0xfdfaf8,
    roughness: 0.92,
    metalness: 0.0,
  });

  const bathMatPlaid = mat({
    map: textures.bathPlaidMat,
    bumpMap: textures.rugBump,
    bumpScale: 0.012,
    color: 0xf7fbff,
    roughness: 0.92,
    metalness: 0.0,
  });

  const showerGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdcf1ff,
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // =========================================================================
  // 1. FLOOR SLAB, CEILING & PERIMETER WALLS (Lower Ceramic Tile + Upper Wave Wall)
  // =========================================================================
  const floorGeo = new THREE.BoxGeometry(W, 0.30, D);
  {
    const normAttr = floorGeo.attributes.normal;
    const uvAttr = floorGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      if (Math.abs(normAttr.getY(i)) > 0.5) {
        uvAttr.setXY(i, uvAttr.getX(i) * (W / 1.5), uvAttr.getY(i) * (D / 1.5));
      }
    }
    uvAttr.needsUpdate = true;
  }
  const floorMesh = new THREE.Mesh(floorGeo, bathTileFloorMat);
  floorMesh.position.set(CX, -0.15, CZ);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'floor_bathroom';
  group.add(floorMesh);

  // Threshold marble saddle strip bridging Living Room hardwood & Bathroom ceramic tile
  const thresholdStrip = new THREE.Mesh(
    createBeveledBox(1.12, 0.012, 0.16, 0.004, 2),
    ceramicWhiteMat
  );
  thresholdStrip.position.set(5.23, 0.006, Z2);
  thresholdStrip.receiveShadow = true;
  group.add(thresholdStrip);

  // Bathroom Ceiling Slab (parented to ceilingGroup so Overview mode lifts it away cleanly!)
  const bathCeiling = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.20, 0.14, D + 0.20),
    ceilingMat
  );
  bathCeiling.position.set(CX, H + 0.07, CZ);
  bathCeiling.receiveShadow = true;
  ceilingGroup.add(bathCeiling);

  // Structural outer perimeter walls (North, West, East) — South wall is the shared wall_n_living at Z = -10.40
  addWall('wall_bath_n', CX, H / 2, Z1, W + wallThick, H, wallThick, bathUpperWallMat, group);
  addWall('wall_bath_w', X1, H / 2, CZ, wallThick, H, D + wallThick, bathUpperWallMat, group);
  addWall('wall_bath_e', X2, H / 2, CZ, wallThick, H, D + wallThick, bathUpperWallMat, group);

  // Bathroom-side interior upper wave-stripe overlay on South wall (Z = -10.31 facing -Z into Bathroom),
  // cleanly split around the Bathroom doorway (X = 4.68 .. 5.78, Y = 0 .. 2.20)
  const makeWallPlane = (pw: number, ph: number, tileU = 2.0, tileV = 2.0) => {
    const g = new THREE.PlaneGeometry(pw, ph);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * (pw / tileU), uv.getY(i) * (ph / tileV));
    }
    uv.needsUpdate = true;
    return g;
  };

  // South wall inner wave finish (Z = -10.495 facing -Z)
  const sWestW = 4.68 - (X1 + 0.09); // 1.64m
  const sEastW = (X2 - 0.09) - 5.78; // 1.48m
  const sOverlayW = new THREE.Mesh(makeWallPlane(sWestW, H), bathUpperWallMat);
  sOverlayW.rotation.y = Math.PI;
  sOverlayW.position.set(X1 + 0.09 + sWestW / 2, H / 2, Z2 - 0.095);
  sOverlayW.receiveShadow = true;
  group.add(sOverlayW);

  const sOverlayE = new THREE.Mesh(makeWallPlane(sEastW, H), bathUpperWallMat);
  sOverlayE.rotation.y = Math.PI;
  sOverlayE.position.set(5.78 + sEastW / 2, H / 2, Z2 - 0.095);
  sOverlayE.receiveShadow = true;
  group.add(sOverlayE);

  const sOverlayHdr = new THREE.Mesh(makeWallPlane(1.10, H - 2.20), bathUpperWallMat);
  sOverlayHdr.rotation.y = Math.PI;
  sOverlayHdr.position.set(5.23, 2.20 + (H - 2.20) / 2, Z2 - 0.095);
  sOverlayHdr.receiveShadow = true;
  group.add(sOverlayHdr);

  // Lower ivory ceramic wall tile wainscoting (H = 1.24m) with honey-oak top ledge rail
  const TILE_H = 1.24;
  const addTiledWallBand = (
    cx: number,
    cz: number,
    len: number,
    facing: 'z+' | 'z-' | 'x+' | 'x-',
    ledgeDepth = 0.052
  ) => {
    const isAlongX = facing === 'z+' || facing === 'z-';
    const sign = facing === 'z+' || facing === 'x+' ? 1 : -1;
    const bw = isAlongX ? len : 0.024;
    const bd = isAlongX ? 0.024 : len;
    const geo = new THREE.BoxGeometry(bw, TILE_H, bd);
    const uv = geo.attributes.uv;
    const norm = geo.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(norm.getX(i));
      const u = uv.getX(i);
      const v = uv.getY(i);
      if (nx > 0.5) {
        uv.setXY(i, u * (bd / 1.35), v * (TILE_H / 1.35));
      } else {
        uv.setXY(i, u * (bw / 1.35), v * (TILE_H / 1.35));
      }
    }
    uv.needsUpdate = true;

    const band = new THREE.Mesh(geo, bathLowerTileMat);
    band.position.set(cx, TILE_H / 2, cz);
    band.receiveShadow = true;
    group.add(band);

    const rail = new THREE.Mesh(
      createBeveledBox(
        isAlongX ? len : ledgeDepth,
        0.044,
        isAlongX ? ledgeDepth : len,
        0.008,
        2
      ),
      oakMat
    );
    rail.position.set(
      cx + (isAlongX ? 0 : sign * (ledgeDepth * 0.35)),
      TILE_H + 0.022,
      cz + (isAlongX ? sign * (ledgeDepth * 0.35) : 0)
    );
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  };

  addTiledWallBand(CX, Z1 + 0.102, W - 0.18, 'z+', 0.054); // North wall
  addTiledWallBand(X1 + 0.102, CZ, D - 0.18, 'x+', 0.054); // West wall
  addTiledWallBand(X2 - 0.102, CZ, D - 0.18, 'x-', 0.115); // East wall (wider oak toilet-side shelf ledge!)
  addTiledWallBand(X1 + 0.09 + sWestW / 2, Z2 - 0.106, sWestW, 'z-', 0.048); // South-West segment
  addTiledWallBand(5.78 + sEastW / 2, Z2 - 0.106, sEastW, 'z-', 0.048); // South-East segment

  // Subtle cream ceiling crown trim strips around Bathroom perimeter
  for (const [tx, tz, tw, td] of [
    [CX, Z1 + 0.11, W - 0.16, 0.048],
    [CX, Z2 - 0.11, W - 0.16, 0.048],
    [X1 + 0.11, CZ, 0.048, D - 0.16],
    [X2 - 0.11, CZ, 0.048, D - 0.16],
  ] as const) {
    const crown = new THREE.Mesh(createBeveledBox(tw, 0.048, td, 0.008, 2), vanityTrimMat);
    crown.position.set(tx, H - 0.024, tz);
    group.add(crown);
  }

  // =========================================================================
  // 2. HINGED BATHROOM DOOR (Z = -10.40, X = 4.68 .. 5.78, swings into Bathroom)
  // =========================================================================
  const bathDoorMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xfff6e6,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
  });
  const doorHandleMat = mat({ color: 0xc9a366, roughness: 0.30, metalness: 0.72 });
  registerDoor(
    'door_bathroom',
    '浴室木门',
    'bathroom',
    4.68,
    0,
    -10.40,
    1.10,
    2.20,
    'x+',
    -1,
    bathDoorMat,
    doorHandleMat,
    playDoorAudio
  );

  // =========================================================================
  // 3. CURVED CORNER GLASS SHOWER ENCLOSURE (NW Corner: X = 3.06..4.34, Z = -14.04..-12.76)
  // =========================================================================
  const showerGroup = new THREE.Group();
  const shOriginX = X1 + 0.12; // 3.07
  const shOriginZ = Z1 + 0.12; // -14.03
  const shRadius = 1.18;
  showerGroup.position.set(shOriginX, 0, shOriginZ);

  // Raised quarter-circle shower tray (extruded arc)
  const trayShape = new THREE.Shape();
  trayShape.moveTo(0, 0);
  trayShape.lineTo(shRadius, 0);
  trayShape.absarc(0, 0, shRadius, 0, Math.PI / 2, false);
  trayShape.lineTo(0, 0);
  const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
    depth: 0.11,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 22,
  });
  trayGeo.rotateX(Math.PI / 2);
  const trayMesh = new THREE.Mesh(trayGeo, ceramicWhiteMat);
  trayMesh.position.y = 0.11;
  trayMesh.receiveShadow = true;
  outlines.addOutline(trayMesh, 1.014);
  showerGroup.add(trayMesh);

  // Top & Bottom quarter-circle aluminum frame rails
  for (const ry of [0.135, 2.26]) {
    const railGeo = new THREE.TorusGeometry(shRadius - 0.025, 0.022, 10, 24, Math.PI / 2);
    railGeo.rotateX(Math.PI / 2);
    const railMesh = new THREE.Mesh(railGeo, vanityTrimMat);
    railMesh.position.y = ry;
    showerGroup.add(railMesh);
  }

  // Vertical corner stanchions framing the curved shower glass
  for (const [px, pz] of [
    [shRadius - 0.025, 0.02],
    [0.02, shRadius - 0.025],
    [(shRadius - 0.025) * 0.707, (shRadius - 0.025) * 0.707],
  ] as const) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.020, 2.14, 10),
      vanityTrimMat
    );
    post.position.set(px, 1.20, pz);
    showerGroup.add(post);
  }

  // Curved transparent shower glass enclosure (kept dynamic so static merge doesn't bake alpha!)
  const curvedGlassGeo = new THREE.CylinderGeometry(
    shRadius - 0.025,
    shRadius - 0.025,
    2.10,
    22,
    1,
    true,
    0,
    Math.PI / 2
  );
  const curvedGlass = new THREE.Mesh(curvedGlassGeo, showerGlassMat);
  curvedGlass.position.y = 1.20;
  curvedGlass.userData.dynamic = true;
  showerGroup.add(curvedGlass);

  // Twin chrome curved-door grab handles
  for (const ang of [Math.PI * 0.21, Math.PI * 0.29]) {
    const hMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.032, 0.008, 8, 14),
      chromeMat
    );
    hMesh.position.set(Math.sin(ang) * shRadius, 1.12, Math.cos(ang) * shRadius);
    hMesh.rotation.y = ang;
    showerGroup.add(hMesh);
  }

  // Chrome shower riser pipe, rain showerhead, mixer valve & hanging handheld hose
  const riserPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 1.12, 10),
    chromeMat
  );
  riserPipe.position.set(0.11, 1.56, 0.42);
  showerGroup.add(riserPipe);

  const mixerBody = new THREE.Mesh(
    createBeveledBox(0.06, 0.075, 0.18, 0.012, 2),
    chromeMat
  );
  mixerBody.position.set(0.07, 1.06, 0.42);
  showerGroup.add(mixerBody);

  const headArm = new THREE.Mesh(
    createTaperedCurveGeometry(
      [
        new THREE.Vector3(0.11, 2.08, 0.42),
        new THREE.Vector3(0.16, 2.18, 0.42),
        new THREE.Vector3(0.28, 2.12, 0.42),
      ],
      0.011,
      0.010,
      10,
      8
    ),
    chromeMat
  );
  showerGroup.add(headArm);

  const showerHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.030, 0.034, 16),
    chromeMat
  );
  showerHead.position.set(0.30, 2.08, 0.42);
  showerHead.rotation.z = -0.35;
  showerGroup.add(showerHead);

  const showerHose = new THREE.Mesh(
    createTaperedCurveGeometry(
      [
        new THREE.Vector3(0.10, 1.02, 0.45),
        new THREE.Vector3(0.15, 0.72, 0.56),
        new THREE.Vector3(0.14, 0.96, 0.68),
        new THREE.Vector3(0.11, 1.46, 0.58),
      ],
      0.008,
      0.008,
      16,
      8
    ),
    chromeMat
  );
  showerGroup.add(showerHose);

  // Shampoo & conditioner bottles on corner shower caddy
  const caddyShelf = new THREE.Mesh(
    createBeveledSlab(0.22, 0.018, 0.22, 0.03, 0.004),
    chromeMat
  );
  caddyShelf.position.set(0.18, 1.18, 0.18);
  showerGroup.add(caddyShelf);

  for (const [bx, bz, bcol, bh] of [
    [0.14, 0.14, 0x8ec5e8, 0.17],
    [0.22, 0.16, 0xf2b5c8, 0.15],
  ] as const) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.028, bh, 12),
      mat({ color: bcol, roughness: 0.36 })
    );
    bottle.position.set(bx, 1.19 + bh / 2, bz);
    showerGroup.add(bottle);
  }

  group.add(showerGroup);
  addBoxCollider('col_bath_shower', shOriginX + 0.55, 1.1, shOriginZ + 0.55, 1.12, 2.2, 1.12);

  // =========================================================================
  // 4. LOUVERED SINK VANITY, BRASS GOOSE-NECK FAUCET & WALL MIRROR (West Wall)
  // =========================================================================
  const vanityGroup = new THREE.Group();
  vanityGroup.position.set(X1 + 0.42, 0, -11.90);

  const vanCounter = new THREE.Mesh(
    createBeveledSlab(0.58, 0.068, 1.12, 0.028, 0.010),
    ceramicWhiteMat
  );
  vanCounter.position.y = 0.84;
  vanCounter.castShadow = true;
  vanCounter.receiveShadow = true;
  outlines.addOutline(vanCounter, 1.015);
  vanityGroup.add(vanCounter);

  // Recessed porcelain basin
  const basinRim = new THREE.Mesh(
    createBeveledBox(0.40, 0.020, 0.64, 0.014, 2),
    mat({ color: 0xebe6f0, roughness: 0.25 })
  );
  basinRim.position.set(0.02, 0.872, 0);
  vanityGroup.add(basinRim);

  // Vanity wooden legs & lower towel shelf
  const vanBody = new THREE.Mesh(
    createBeveledBox(0.52, 0.48, 1.04, 0.010, 2),
    vanityBlueMat
  );
  vanBody.position.set(-0.01, 0.56, 0);
  vanBody.castShadow = true;
  vanBody.receiveShadow = true;
  outlines.addOutline(vanBody, 1.014);
  vanityGroup.add(vanBody);

  const vanBotShelf = new THREE.Mesh(
    createBeveledSlab(0.50, 0.028, 1.02, 0.016, 0.005),
    vanityTrimMat
  );
  vanBotShelf.position.set(-0.01, 0.16, 0);
  vanityGroup.add(vanBotShelf);

  for (const lx of [-0.22, 0.22]) {
    for (const lz of [-0.47, 0.47]) {
      const leg = new THREE.Mesh(
        createBeveledBox(0.046, 0.80, 0.046, 0.007, 2),
        vanityTrimMat
      );
      leg.position.set(lx, 0.40, lz);
      vanityGroup.add(leg);
    }
  }

  // Folded cream towels on open bottom vanity shelf
  for (let t = 0; t < 3; t++) {
    const towel = new THREE.Mesh(
      createPlushBox(0.32, 0.052, 0.46, 0.020, 0.12),
      towelWhiteMat
    );
    towel.position.set(0.02, 0.20 + t * 0.048, -0.14);
    vanityGroup.add(towel);
  }

  // Interactive Louvered Vanity Cabinet Doors (facing +X into Bathroom)
  for (const [idx, dz] of [
    [0, -0.25],
    [1, 0.25],
  ] as const) {
    const hingeSide: -1 | 1 = idx === 0 ? -1 : 1;
    const louverDoor = new THREE.Group();
    const frameSlab = new THREE.Mesh(
      createBeveledBox(0.026, 0.42, 0.46, 0.006, 2),
      vanityTrimMat
    );
    louverDoor.add(frameSlab);
    for (let s = 0; s < 7; s++) {
      const slat = new THREE.Mesh(
        createBeveledBox(0.012, 0.018, 0.36, 0.002, 1),
        vanityBlueMat
      );
      slat.position.set(0.012, -0.13 + s * 0.043, 0);
      slat.rotation.z = -0.24;
      louverDoor.add(slat);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), brassMat);
    knob.position.set(0.026, 0.04, -hingeSide * 0.16);
    louverDoor.add(knob);

    registerCabinetDoor({
      id: `bath_vanity_door_${idx}`,
      label: idx === 0 ? '洗手台左百叶柜门' : '洗手台右百叶柜门',
      room: 'bathroom',
      parent: vanityGroup,
      centerX: 0.26,
      centerY: 0.56,
      centerZ: dz,
      width: 0.46,
      height: 0.42,
      thickness: 0.026,
      facingAxis: 'x',
      facingSign: 1,
      hingeSide,
      doorMat: vanityTrimMat,
      moldingMat: vanityBlueMat,
      handleMat: brassMat,
      customDoorGroup: louverDoor,
    });
  }

  // Warm Brass Arch Faucet + Hot/Cold Knobs + Soap Dispenser
  const faucetSpout = new THREE.Mesh(
    createTaperedCurveGeometry(
      [
        new THREE.Vector3(-0.20, 0.875, 0),
        new THREE.Vector3(-0.20, 1.04, 0),
        new THREE.Vector3(-0.14, 1.08, 0),
        new THREE.Vector3(-0.08, 1.01, 0),
      ],
      0.012,
      0.010,
      14,
      10
    ),
    brassMat
  );
  vanityGroup.add(faucetSpout);

  for (const kz of [-0.11, 0.11]) {
    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.020, 0.036, 12), brassMat);
    fBase.position.set(-0.20, 0.892, kz);
    vanityGroup.add(fBase);
    const fCross = new THREE.Mesh(createBeveledBox(0.014, 0.012, 0.056, 0.003, 1), brassMat);
    fCross.position.set(-0.20, 0.916, kz);
    vanityGroup.add(fCross);
  }

  // Pastel blue liquid hand-soap dispenser & toothbrush cup
  const soapBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.038, 0.125, 14),
    mat({ color: 0xa8cde0, roughness: 0.28 })
  );
  soapBottle.position.set(-0.14, 0.935, -0.34);
  outlines.addOutline(soapBottle, 1.04);
  vanityGroup.add(soapBottle);

  const soapPump = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.042, 10),
    brassMat
  );
  soapPump.position.set(-0.14, 1.018, -0.34);
  vanityGroup.add(soapPump);

  const brushCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.028, 0.092, 14),
    ceramicWhiteMat
  );
  brushCup.position.set(-0.14, 0.920, 0.36);
  vanityGroup.add(brushCup);

  for (const [bCol, bTilt] of [
    [0xf092aa, 0.18],
    [0x86bce8, -0.14],
  ] as const) {
    const brush = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0055, 0.16, 8),
      mat({ color: bCol, roughness: 0.45 })
    );
    brush.position.set(-0.14, 0.985, 0.36 + bTilt * 0.06);
    brush.rotation.x = bTilt;
    vanityGroup.add(brush);
  }

  group.add(vanityGroup);
  addBoxCollider('col_bath_vanity', X1 + 0.42, 0.45, -11.90, 0.62, 0.95, 1.16);

  // Reflective Wall Mirror mounted directly above the Vanity (West Wall)
  const mirrorShaderMat = createMirrorSurfaceShaderMaterial(uniforms);
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(X1 + 0.135, 1.72, -11.90);

  const mirFrame = new THREE.Mesh(
    createBeveledBox(0.042, 0.96, 1.08, 0.010, 2),
    vanityTrimMat
  );
  mirFrame.castShadow = true;
  outlines.addOutline(mirFrame, 1.016);
  mirrorGroup.add(mirFrame);

  const mirGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.84), mirrorShaderMat);
  mirGlass.rotation.y = Math.PI / 2;
  mirGlass.position.x = 0.025;
  mirGlass.userData.dynamic = true;
  mirrorGroup.add(mirGlass);
  group.add(mirrorGroup);

  const bathMirrorRig = {
    id: 'bath_mirror',
    room: 'bathroom' as const,
    mesh: mirGlass,
    material: mirrorShaderMat,
    normal: new THREE.Vector3(1, 0, 0),
    planePoint: new THREE.Vector3(X1 + 0.160, 1.72, -11.90),
    glitchBurstTimer: 0,
  };
  ctx.mirrors.push(bathMirrorRig);

  // Tall Linen Side Cabinet next to Vanity (SW corner: X = 3.38, Z = -10.88)
  const linenCab = new THREE.Group();
  linenCab.position.set(X1 + 0.42, 0, -10.88);
  const linenBody = new THREE.Mesh(
    createBeveledBox(0.46, 1.46, 0.56, 0.012, 2),
    vanityTrimMat
  );
  linenBody.position.y = 0.74;
  linenBody.castShadow = true;
  linenBody.receiveShadow = true;
  outlines.addOutline(linenBody, 1.016);
  linenCab.add(linenBody);
  for (const dy of [0.36, 0.78, 1.18]) {
    const dFront = new THREE.Mesh(
      createBeveledBox(0.022, 0.34, 0.48, 0.006, 2),
      vanityBlueMat
    );
    dFront.position.set(0.232, dy, 0);
    linenCab.add(dFront);
    const dPull = new THREE.Mesh(
      createBeveledBox(0.024, 0.022, 0.12, 0.004, 1),
      brassMat
    );
    dPull.position.set(0.252, dy, 0);
    linenCab.add(dPull);
  }
  group.add(linenCab);
  addBoxCollider('col_bath_linen', X1 + 0.42, 0.75, -10.88, 0.50, 1.52, 0.60);

  // =========================================================================
  // 5. HIGH FROSTED VENT WINDOW + SHORT ANISOTROPIC LIGHT SHAFT, HEATED TOWEL RAIL,
  //    WOODEN STOOL & TRAILING PLANT ON NORTH WALL (Z = -14.04)
  // =========================================================================
  const ventWinGroup = new THREE.Group();
  ventWinGroup.position.set(5.15, 2.28, Z1 + 0.11);

  const ventFrame = new THREE.Mesh(
    createBeveledBox(0.86, 0.52, 0.068, 0.008, 2),
    vanityTrimMat
  );
  outlines.addOutline(ventFrame, 1.018);
  ventWinGroup.add(ventFrame);

  const ventGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.38),
    createWindowEmissiveMaterial(uniforms, 0xebf4ff, 0.88)
  );
  ventGlass.position.z = 0.036;
  ventGlass.userData.dynamic = true;
  ventWinGroup.add(ventGlass);
  windowGlowMeshes.push(ventGlass);
  group.add(ventWinGroup);

  // Soft, short anisotropic scattering light shaft from high bathroom vent window
  const bathTyndallGeo = createTyndallShaftClusterGeometry(
    1.85,
    0.70,
    2.04,
    2.48,
    1.15,
    1.95,
    0.04,
    1.22
  );
  const bathTyndallMat = createTyndallBeamShaderMaterial(
    uniforms,
    0.095,
    1.0,
    1.0,
    3.75,
    0.05
  );
  const bathTyndallShaft = new THREE.Mesh(bathTyndallGeo, bathTyndallMat);
  bathTyndallShaft.position.set(5.15, 0, Z1 + 0.16);
  bathTyndallShaft.rotation.y = Math.PI / 2;
  bathTyndallShaft.renderOrder = 4;
  bathTyndallShaft.userData.dynamic = true;
  group.add(bathTyndallShaft);
  volumetricRays.push(bathTyndallShaft);

  // Heated chrome towel rail + draped folded cream bath towel
  const railGroup = new THREE.Group();
  railGroup.position.set(5.15, 1.18, Z1 + 0.15);
  for (const rx of [-0.26, 0.26]) {
    const vBar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.52, 10), chromeMat);
    vBar.position.x = rx;
    railGroup.add(vBar);
  }
  for (let r = 0; r < 4; r++) {
    const hBar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.52, 10), chromeMat);
    hBar.rotation.z = Math.PI / 2;
    hBar.position.y = -0.18 + r * 0.12;
    railGroup.add(hBar);
  }
  const hungTowel = new THREE.Mesh(
    createPlushBox(0.38, 0.44, 0.058, 0.022, 0.14),
    towelWhiteMat
  );
  hungTowel.position.set(0, -0.02, 0.036);
  hungTowel.castShadow = true;
  outlines.addOutline(hungTowel, 1.022);
  railGroup.add(hungTowel);
  group.add(railGroup);

  // Small honey-oak wooden bath stool beneath towel rail
  const stoolGroup = new THREE.Group();
  stoolGroup.position.set(5.15, 0, Z1 + 0.44);
  const stoolTop = new THREE.Mesh(createBeveledSlab(0.34, 0.028, 0.26, 0.022, 0.006), oakMat);
  stoolTop.position.y = 0.34;
  stoolTop.castShadow = true;
  outlines.addOutline(stoolTop, 1.022);
  stoolGroup.add(stoolTop);
  const sLegGeo = createTurnedLegGeometry(0.016, 0.011, 0.33, 8);
  for (const lx of [-0.12, 0.12]) {
    for (const lz of [-0.08, 0.08]) {
      const sLeg = new THREE.Mesh(sLegGeo, darkOakMat);
      sLeg.position.set(lx, 0.165, lz);
      stoolGroup.add(sLeg);
    }
  }
  group.add(stoolGroup);
  addBoxCollider('col_bath_stool', 5.15, 0.20, Z1 + 0.44, 0.36, 0.40, 0.30);

  // Small floating oak shelf + cascading ivy potted plant on North wall right of vent window
  const plantShelf = new THREE.Mesh(
    createBeveledBox(0.56, 0.028, 0.16, 0.006, 2),
    oakMat
  );
  plantShelf.position.set(6.05, 1.88, Z1 + 0.19);
  plantShelf.castShadow = true;
  group.add(plantShelf);

  const ivyPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.048, 0.10, 12),
    mat({ color: 0x524c58, roughness: 0.72 })
  );
  ivyPot.position.set(6.05, 1.945, Z1 + 0.20);
  group.add(ivyPot);

  const ivyLeafMat = mat({ color: 0x4f8454, roughness: 0.68, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), ivyLeafMat);
    leaf.scale.set(1.25, 0.42, 0.9);
    leaf.position.set(
      6.05 + Math.sin(i * 1.45) * 0.075,
      1.98 - t * 0.48,
      Z1 + 0.24 + Math.cos(i * 0.9) * 0.035
    );
    leaf.rotation.set(0.3, i * 0.8, 0.2);
    group.add(leaf);
  }

  // =========================================================================
  // 6. CERAMIC TOILET, OAK TOWEL RACK, WASHING MACHINE & MARINE PORTHOLE (East Wall)
  // =========================================================================
  // Porcelain Toilet facing West (-X) near NE corner
  const toiletGroup = new THREE.Group();
  toiletGroup.position.set(X2 - 0.50, 0, -13.48);

  const tPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.14, 0.36, 16),
    ceramicWhiteMat
  );
  tPedestal.position.set(-0.04, 0.18, 0);
  tPedestal.castShadow = true;
  toiletGroup.add(tPedestal);

  const tBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    ceramicWhiteMat
  );
  tBowl.scale.set(1.22, 0.62, 0.96);
  tBowl.position.set(-0.06, 0.36, 0);
  tBowl.castShadow = true;
  outlines.addOutline(tBowl, 1.022);
  toiletGroup.add(tBowl);

  const tLid = new THREE.Mesh(
    createBeveledSlab(0.46, 0.032, 0.38, 0.16, 0.008),
    ceramicWhiteMat
  );
  tLid.position.set(-0.06, 0.43, 0);
  toiletGroup.add(tLid);

  const tTank = new THREE.Mesh(
    createBeveledBox(0.22, 0.44, 0.42, 0.024, 3),
    ceramicWhiteMat
  );
  tTank.position.set(0.22, 0.62, 0);
  tTank.castShadow = true;
  outlines.addOutline(tTank, 1.02);
  toiletGroup.add(tTank);

  const flushBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.016, 12),
    chromeMat
  );
  flushBtn.position.set(0.22, 0.848, 0);
  toiletGroup.add(flushBtn);

  // Toilet paper roll holder on North-East tiled wall beside toilet
  const tpRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.11, 14),
    towelWhiteMat
  );
  tpRoll.rotation.z = Math.PI / 2;
  tpRoll.position.set(-0.18, 0.72, -0.50);
  toiletGroup.add(tpRoll);

  group.add(toiletGroup);
  addBoxCollider('col_bath_toilet', X2 - 0.46, 0.45, -13.48, 0.78, 0.90, 0.54);

  // Toiletries caddy & mini potted plant perched along East wall oak ledge (Y = 1.285)
  const caddyBox = new THREE.Mesh(
    createBeveledBox(0.14, 0.12, 0.32, 0.012, 2),
    ceramicWhiteMat
  );
  caddyBox.position.set(X2 - 0.19, 1.345, -12.48);
  caddyBox.castShadow = true;
  group.add(caddyBox);
  for (const [cz, col] of [
    [-12.56, 0xf2b5c8],
    [-12.46, 0xa8d4f0],
    [-12.38, 0xead8b8],
  ] as const) {
    const miniB = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.024, 0.12, 10),
      mat({ color: col, roughness: 0.38 })
    );
    miniB.position.set(X2 - 0.19, 1.44, cz);
    group.add(miniB);
  }

  // Open 3-Tier Honey-Oak Towel Rack (East wall, Z = -12.32)
  const oakRack = new THREE.Group();
  oakRack.position.set(X2 - 0.42, 0, -12.32);
  for (const lx of [-0.16, 0.16]) {
    for (const lz of [-0.30, 0.30]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.86, 10),
        oakMat
      );
      post.position.set(lx, 0.43, lz);
      post.castShadow = true;
      oakRack.add(post);
    }
  }
  for (const sy of [0.16, 0.46, 0.76]) {
    const shelf = new THREE.Mesh(
      createBeveledSlab(0.36, 0.024, 0.64, 0.020, 0.005),
      oakMat
    );
    shelf.position.y = sy;
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    oakRack.add(shelf);
  }
  // Folded fluffy bath towels & oval tabletop vanity mirror on rack
  for (let t = 0; t < 2; t++) {
    const tw = new THREE.Mesh(
      createPlushBox(0.28, 0.056, 0.44, 0.020, 0.14),
      towelWhiteMat
    );
    tw.position.set(0, 0.505 + t * 0.052, 0);
    oakRack.add(tw);
  }
  const smallBox = new THREE.Mesh(
    createBeveledBox(0.24, 0.12, 0.32, 0.010, 2),
    mat({ color: 0xe6dff0, roughness: 0.78 })
  );
  smallBox.position.set(0, 0.23, 0.04);
  oakRack.add(smallBox);
  group.add(oakRack);
  addBoxCollider('col_bath_oak_rack', X2 - 0.42, 0.45, -12.32, 0.42, 0.90, 0.68);

  // Front-Loading Compact Washing Machine (SE Corner: X = 6.84, Z = -11.12)
  const washer = new THREE.Group();
  washer.position.set(X2 - 0.46, 0, -11.12);
  const wBody = new THREE.Mesh(
    createBeveledBox(0.64, 0.86, 0.64, 0.018, 2),
    ceramicWhiteMat
  );
  wBody.position.y = 0.43;
  wBody.castShadow = true;
  wBody.receiveShadow = true;
  outlines.addOutline(wBody, 1.015);
  washer.add(wBody);

  const wRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.030, 10, 20),
    chromeMat
  );
  wRing.rotation.y = Math.PI / 2;
  wRing.position.set(-0.325, 0.44, 0);
  washer.add(wRing);

  const wGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.02, 18),
    mat({ color: 0x3b4458, roughness: 0.18, metalness: 0.35 })
  );
  wGlass.rotation.z = Math.PI / 2;
  wGlass.position.set(-0.318, 0.44, 0);
  washer.add(wGlass);

  const wDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.025, 14),
    chromeMat
  );
  wDial.rotation.z = Math.PI / 2;
  wDial.position.set(-0.326, 0.76, -0.08);
  washer.add(wDial);

  const wLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x72e5ff })
  );
  wLed.position.set(-0.326, 0.76, 0.14);
  washer.add(wLed);
  group.add(washer);
  addBoxCollider('col_bath_washer', X2 - 0.46, 0.45, -11.12, 0.68, 0.90, 0.68);

  // Decorative Round Marine Porthole Wall Medallion on East Wall (matching MiSide bathroom accent!)
  const portholeGroup = new THREE.Group();
  portholeGroup.position.set(X2 - 0.115, 2.04, -12.05);
  const pRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.044, 12, 24),
    vanityTrimMat
  );
  pRim.rotation.y = Math.PI / 2;
  outlines.addOutline(pRim, 1.02);
  portholeGroup.add(pRim);

  const pDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.30, 22),
    mat({ color: 0x7ab8de, roughness: 0.36, metalness: 0.08 })
  );
  pDisc.rotation.y = -Math.PI / 2;
  pDisc.position.x = -0.015;
  portholeGroup.add(pDisc);

  const pWave = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.018, 8, 18, Math.PI * 1.4),
    ceramicWhiteMat
  );
  pWave.rotation.y = Math.PI / 2;
  pWave.position.set(-0.025, 0.02, 0);
  portholeGroup.add(pWave);
  group.add(portholeGroup);

  // =========================================================================
  // 7. SOFT PLAID & POWDER-BLUE BATHMATS ON TILED FLOOR
  // =========================================================================
  const mainMat = new THREE.Mesh(
    createBeveledSlab(1.28, 0.018, 0.88, 0.14, 0.006),
    bathMatPlaid
  );
  mainMat.position.set(4.85, 0.010, -11.95);
  mainMat.receiveShadow = true;
  group.add(mainMat);

  const toiletMat = new THREE.Mesh(
    createBeveledSlab(0.56, 0.016, 0.82, 0.12, 0.005),
    mat({
      map: textures.plushFabric,
      color: 0xb9dcf0,
      roughness: 0.92,
      metalness: 0.0,
    })
  );
  toiletMat.position.set(5.88, 0.009, -13.45);
  toiletMat.receiveShadow = true;
  group.add(toiletMat);

  // =========================================================================
  // 8. BATHROOM FLUSH CEILING LAMP & POINT LIGHT (Auto-enrolled in 6-Slot Pool)
  // =========================================================================
  const lampGroup = new THREE.Group();
  lampGroup.position.set(CX, H - 0.05, CZ);

  const lampTrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.19, 0.036, 20),
    vanityTrimMat
  );
  lampGroup.add(lampTrim);

  const bathBulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8 });
  const lampDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.155, 18, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5),
    bathBulbMat
  );
  lampDome.position.y = -0.01;
  lampDome.userData.dynamic = true;
  lampGroup.add(lampDome);
  ceilingGroup.add(lampGroup);

  const bathLight = new THREE.PointLight(0xfff1e4, 0.92, 11.5, 1.05);
  bathLight.position.set(CX, H - 0.24, CZ);
  bathLight.castShadow = false;
  scene.add(bathLight);

  registerCeilingLamp({
    id: 'lamp_bathroom',
    room: 'bathroom',
    position: new THREE.Vector3(CX, H - 0.12, CZ),
    light: bathLight,
    bulbMaterials: [bathBulbMat],
    baseIntensity: 0.92,
    dimColorHex: 0x625078,
    proximityRadius: 3.4,
  });

  // Register Bathroom shared materials into Global Persistent Color Studio (F8)
  apartmentColorStudio.registerMaterialColor('ceiling', '全屋天花板', 'global', ceilingMat);
  apartmentColorStudio.registerMaterialColor('bathTile', '浴室地砖/下墙砖', 'bathEntry', [
    bathTileFloorMat,
    bathLowerTileMat,
  ]);
  apartmentColorStudio.registerMaterialColor('bathUpperWall', '浴室上墙面', 'bathEntry', bathUpperWallMat);
  apartmentColorStudio.registerMaterialColor('bathVanity', '浴室洗手台色', 'bathEntry', [
    vanityBlueMat,
    vanityTrimMat,
  ]);
  apartmentColorStudio.registerMaterialColor('bathCeramic', '浴室陶瓷洁具', 'bathEntry', ceramicWhiteMat);
  apartmentColorStudio.registerMaterialColor('bathOak', '浴室木质家具', 'bathEntry', [
    oakMat,
    darkOakMat,
  ]);
  apartmentColorStudio.registerMaterialColor('bathTowel', '浴室毛巾织物', 'bathEntry', towelWhiteMat);

  // Merge all static Bathroom architecture & furniture into a single draw call!
  mergeStaticGroupToSingleMesh(group, outlines, 'BathroomMergedStaticMesh');
}
