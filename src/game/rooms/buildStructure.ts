import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  createArchedVelvetCurtainGeometry,
  createBeveledBox,
  createBeveledSlab,
  createDrapedCurtainGeometry,
  createFlaredValanceGeometry,
  createTyndallShaftClusterGeometry,
} from '../geometries';
import {
  createTyndallBeamShaderMaterial,
  createWindowEmissiveMaterial,
  createWindowGoboShaderMaterial,
} from '../pipeline';
import { mergeStaticGroupToSingleMesh } from '../SceneManager';
import { apartmentColorStudio } from '../devColorStudio';
import type { RoomBuildContext } from './roomContext';

export function buildApartmentStructure(ctx: RoomBuildContext): void {
  const {
    scene,
    structureGroup,
    ceilingGroup,
    uniforms,
    textures,
    outlines,
    mat,
    addWall,
    volumetricRays,
    windowGlowMeshes,
    registerCeilingLamp,
  } = ctx;

  apartmentColorStudio.resetRegistryForNewScene();

  // Creamy pastel blush-white wallpaper & matte gouache walls (MiSide style)
  const livingWallMat = mat({
    map: textures.wallpaperLiving,
    color: 0xfff8fa,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.56,
  });
  const bedroomWallMat = mat({
    map: textures.wallpaperBedroom,
    color: 0xffffff,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.58,
  });
  // Entryway, Dining & Kitchen warm creamy-ivory wallpaper
  const diningWallMat = mat({
    map: textures.wallpaperDining,
    color: 0xfff8fa,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.56,
  });
  // Warm peach-wood wainscoting (slightly lighter peach-wood than the architectural trims, never white!)
  const wainscotMat = mat({
    map: textures.wainscotWood,
    color: 0xf7e2d2,
    roughness: 0.84,
    metalness: 0.0,
    woodLacquer: 0.12,
    celStrength: 0.48,
  });
  // Architectural corner/wainscoting trims matched 1:1 to door frame casings (墙角框线颜色与门框一致!)
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
  // French Sage-Celadon & Antique Ivory Boiserie Wainscoting & Architectural Trim (法式绿系护墙板)
  const bedWainscotMat = mat({
    map: textures.wainscotWhite,
    color: 0xd8e6d4,
    roughness: 0.84,
    metalness: 0.0,
    celStrength: 0.52,
  });
  const bedWainscotTrimMat = mat({
    color: 0xfaf7ef,
    roughness: 0.74,
    metalness: 0.0,
    celStrength: 0.50,
  });
  const trimMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xf5e2c4,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.48,
  });
  const darkTrimMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xe6cfa9,
    roughness: 0.62,
    metalness: 0.0,
    woodLacquer: 0.44,
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
  // Dedicated Bedroom hardwood floor material (staggered warm apricot planks with subtle dusk sheen)
  const bedroomFloorMat = mat({
    map: textures.woodFloor,
    bumpMap: textures.woodFloorBump,
    bumpScale: 0.008,
    roughnessMap: textures.woodFloorRoughness,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    woodLacquer: 0.0,
    floorFresnel: 0.85,
    celStrength: 0.48,
  });
  bedroomFloorMat.userData.isBedroomFloor = true;

  const genkanTileMat = mat({
    map: textures.genkanTile,
    bumpMap: textures.kitchenTileBump,
    bumpScale: 0.006,
    color: 0xd8d0e8,
    roughness: 0.90,
    metalness: 0.0,
  });
  const kitchenTileMat = mat({
    map: textures.kitchenTile,
    bumpMap: textures.kitchenTileBump,
    bumpScale: 0.015,
    roughnessMap: textures.kitchenTileRoughness,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
    floorFresnel: 0.82,
    celStrength: 0.46,
  });
  const basementTileMat = mat({
    map: textures.basementTile,
    color: 0xc8c2d6,
    roughness: 0.88,
    metalness: 0.0,
  });
  const concreteMat = mat({
    map: textures.concrete,
    bumpMap: textures.concreteBump,
    bumpScale: 0.022,
    roughnessMap: textures.concreteRoughness,
    color: 0xd0ccd8,
    roughness: 0.94,
    metalness: 0.02,
    celStrength: 0.44,
  });
  // Soft creamy blush-white ceiling harmonizing with pastel anime interior
  const ceilingMat = mat({ color: 0xfff9fb, roughness: 0.95, metalness: 0.0, celStrength: 0.48 });
  const coveTrimMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.003,
    color: 0xf5e2c4,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.48,
  });

  // Register shared global architectural materials into persistent Color Studio
  apartmentColorStudio.registerMaterialColor('ceiling', '全屋天花板', 'global', ceilingMat);
  apartmentColorStudio.registerMaterialColor('doorAndTrim', '门框与墙角框线', 'global', [
    wainscotTrimMat,
    trimMat,
    coveTrimMat,
  ]);
  apartmentColorStudio.registerMaterialColor('doorAndTrim', '门框与墙角框线', 'global', darkTrimMat, {
    multiplier: 0.92,
  });
  apartmentColorStudio.registerMaterialColor('wainscot', '护墙板', 'global', wainscotMat);
  apartmentColorStudio.registerMaterialColor('woodFloor', '客餐厅/玄关木地板', 'global', woodFloorMat);
  apartmentColorStudio.registerMaterialColor('kitchenFloor', '厨房地砖', 'dining', kitchenTileMat);
  apartmentColorStudio.registerMaterialColor('genkanFloor', '玄关落尘区地砖', 'bathEntry', genkanTileMat);
  apartmentColorStudio.registerMaterialColor('bedroomFloor', '卧室木地板', 'global', bedroomFloorMat);
  apartmentColorStudio.registerMaterialColor('livingWall', '客厅墙面', 'living', livingWallMat);
  apartmentColorStudio.registerMaterialColor('diningWall', '餐厨/玄关墙面', 'dining', diningWallMat);
  apartmentColorStudio.registerMaterialColor('bedroomWall', '卧室墙纸', 'bedroom', bedroomWallMat);
  apartmentColorStudio.registerMaterialColor('bedroomWainscot', '卧室白护墙板', 'bedroom', [
    bedWainscotMat,
    bedWainscotTrimMat,
  ]);

  // =========================================================================
  // 1. FLOORS (Main Level Y=0 with Stairwell Cutout + Genkan -0.08 + Basement -3.2)
  // =========================================================================
  const addFloorSlab = (
    x1: number,
    x2: number,
    z1: number,
    z2: number,
    topY: number,
    thickness: number,
    material: THREE.Material,
    name: string
  ) => {
    const w = x2 - x1;
    const d = z2 - z1;
    const geo = new THREE.BoxGeometry(w, thickness, d);
    const tileMeters = 2.0;
    const normAttr = geo.attributes.normal;
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      if (Math.abs(normAttr.getY(i)) > 0.5) {
        uvAttr.setXY(
          i,
          uvAttr.getX(i) * (w / tileMeters),
          uvAttr.getY(i) * (d / tileMeters)
        );
      }
    }
    uvAttr.needsUpdate = true;

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set((x1 + x2) / 2, topY - thickness / 2, (z1 + z2) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = name;
    structureGroup.add(mesh);
    return mesh;
  };

  // Main Floor (East of X=-2.70): Dining + Hallway (wood); Living Room floor is merged inside buildLivingRoom.ts
  addFloorSlab(-2.70, 3.18, 0.25, 6.74, 0.0, 0.3, woodFloorMat, 'floor_dining');
  // Kitchen floor (tile)
  addFloorSlab(3.18, 7.35, 0.25, 6.74, 0.0, 0.3, kitchenTileMat, 'floor_kitchen');
  // Bedroom floor (aged satin hardwood with dusk Fresnel micro-reflection)
  addFloorSlab(-8.00, -1.22, -6.74, 0.25, 0.0, 0.3, bedroomFloorMat, 'floor_bedroom');
  // Entryway upper wood landing (X: -5.88 .. -2.70, Z: 2.45 .. 6.74)
  addFloorSlab(-5.88, -2.70, 2.45, 6.74, 0.0, 0.3, woodFloorMat, 'floor_entry_wood');
  // Genkan sunken slate vestibule (X: -8.00 .. -5.88, Z: 2.45 .. 6.74, topY = -0.08)
  addFloorSlab(-8.00, -5.88, 2.45, 6.74, -0.08, 0.22, genkanTileMat, 'floor_genkan_tile');

  // Beveled bullnose wood threshold step nosing at X = -5.88
  const stepNosing = new THREE.Mesh(
    createBeveledSlab(0.16, 0.095, 4.25, 0.03, 0.018),
    trimMat
  );
  stepNosing.position.set(-5.88, -0.038, 4.60);
  stepNosing.castShadow = true;
  stepNosing.receiveShadow = true;
  structureGroup.add(stepNosing);

  // Oak threshold saddle + slim brushed-brass inlay strips bridging Dining wood & Kitchen tile (X = 3.18, Z = 0.45..3.76)
  const thresholdBrassMat = mat({ color: 0xc9a366, roughness: 0.34, metalness: 0.62 });
  const thresholdSaddle = new THREE.Mesh(
    createBeveledBox(0.10, 0.010, 3.31, 0.003, 2),
    wainscotTrimMat
  );
  thresholdSaddle.position.set(3.18, 0.005, 2.105);
  thresholdSaddle.receiveShadow = true;
  structureGroup.add(thresholdSaddle);
  for (const bx of [3.128, 3.232]) {
    const inlay = new THREE.Mesh(
      createBeveledBox(0.012, 0.012, 3.31, 0.002, 1),
      thresholdBrassMat
    );
    inlay.position.set(bx, 0.0055, 2.105);
    structureGroup.add(inlay);
  }

  // Basement Storage Floor (Y = -3.2) covering expanded Basement + Stairwell landing (tiled floor)
  {
    const bx1 = -9.46;
    const bx2 = 3.16;
    const bz1 = -6.22;
    const bz2 = 2.55;
    const bw = bx2 - bx1;
    const bd = bz2 - bz1;
    const btGeo = new THREE.BoxGeometry(bw, 0.25, bd);
    const uvAttr = btGeo.attributes.uv;
    const normAttr = btGeo.attributes.normal;
    for (let i = 0; i < uvAttr.count; i++) {
      const ny = Math.abs(normAttr.getY(i));
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (ny > 0.5) {
        uvAttr.setXY(i, u * (bw / 2.0), v * (bd / 2.0));
      }
    }
    uvAttr.needsUpdate = true;
    const floorBasementMesh = new THREE.Mesh(btGeo, basementTileMat);
    floorBasementMesh.position.set((bx1 + bx2) / 2, -3.2 - 0.125, (bz1 + bz2) / 2);
    floorBasementMesh.receiveShadow = true;
    floorBasementMesh.castShadow = false;
    floorBasementMesh.name = 'floor_basement';
    structureGroup.add(floorBasementMesh);
  }
  // Basement Ceiling Slab (top at Y = -0.3, bottom at Y = -0.45) - includes expanded west stairwell alcove
  addFloorSlab(-9.46, 3.16, -6.22, 0.25, -0.3, 0.15, concreteMat, 'ceil_basement_north');
  addFloorSlab(-2.70, 3.16, 0.25, 2.55, -0.3, 0.15, concreteMat, 'ceil_basement_east');
  addFloorSlab(-9.46, -7.91, 0.25, 2.55, -0.3, 0.15, concreteMat, 'ceil_stair_west_alcove');

  // =========================================================================
  // 2. MAIN LEVEL PERIMETER WALLS (H = 3.1m, centered at Y = 1.55, Corner-Sealed!)
  // =========================================================================
  const H = 3.1;
  const wallThick = 0.18;

  // North Wall in Bedroom (Z = -6.74, X: -8.09 .. -1.30 — flush against X=-1.22 partition without intersecting Living Room alcove!)
  addWall('wall_n_bed_w', -6.845, H / 2, -6.74, 2.49, H, wallThick, bedroomWallMat);
  addWall('wall_n_bed_e', -2.50, H / 2, -6.74, 2.40, H, wallThick, bedroomWallMat);
  addWall('wall_n_win_bot', -4.65, 0.45, -6.74, 1.90, 0.9, wallThick, bedroomWallMat);
  // Semicircular arch spandrel wall above Bedroom North Window (Y = 2.12 .. 3.10 with R = 0.93m arched cutout!)
  {
    const archWallShape = new THREE.Shape();
    archWallShape.moveTo(-0.95, 2.12);
    archWallShape.lineTo(-0.95, H);
    archWallShape.lineTo(0.95, H);
    archWallShape.lineTo(0.95, 2.12);
    archWallShape.lineTo(0.93, 2.12);
    archWallShape.absarc(0, 2.12, 0.93, 0, Math.PI, false);
    archWallShape.lineTo(-0.95, 2.12);
    const archWallGeo = new THREE.ExtrudeGeometry(archWallShape, {
      depth: wallThick,
      bevelEnabled: false,
      curveSegments: 36,
    });
    archWallGeo.translate(0, 0, -wallThick / 2);
    const pos = archWallGeo.attributes.position;
    const uv = archWallGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + 0.95) / 2.0, pos.getY(i) / 2.0);
    }
    uv.needsUpdate = true;
    const archWallMesh = new THREE.Mesh(archWallGeo, bedroomWallMat);
    archWallMesh.name = 'wall_n_win_top_arch';
    archWallMesh.position.set(-4.65, 0, -6.74);
    archWallMesh.castShadow = true;
    archWallMesh.receiveShadow = true;
    structureGroup.add(archWallMesh);
  }

  // South Wall: Entryway section (X: -8.09 .. -2.80) extends down to Y=-0.14 to seal sunken Genkan (-0.08m) cleanly!
  const H_GENKAN = H + 0.14;
  const Y_GENKAN_WALL = (H - 0.14) / 2;
  addWall('wall_s_entry', -5.445, Y_GENKAN_WALL, 6.74, 5.29, H_GENKAN, wallThick, diningWallMat);
  addWall('wall_s_dinkit', 2.22, H / 2, 6.74, 10.22, H, wallThick, diningWallMat);

  // West Wall: Bedroom & Stairwell (Z: -6.83 .. 2.53) -> bedroomWallMat; Entryway (Z: 2.36 .. 6.83) extends down to Y=-0.14 so daylight never bleeds under baseboard!
  addWall('wall_w_bed', -8.00, H / 2, -2.15, wallThick, H, 9.36, bedroomWallMat);
  addWall('wall_w_entry_n', -8.00, Y_GENKAN_WALL, 3.20, wallThick, H_GENKAN, 1.68, diningWallMat);
  addWall('wall_w_entry_s', -8.00, Y_GENKAN_WALL, 5.995, wallThick, H_GENKAN, 1.67, diningWallMat);
  addWall('wall_w_entry_hdr', -8.00, 2.69, 4.60, wallThick, 0.82, 1.14, diningWallMat);

  // East Wall: Kitchen section (Z: 0.33 .. 6.83) with real recessed window opening above the sink
  // (Aperture Z = 4.76 .. 5.52, Y = 1.39 .. 2.31 — framed cleanly by sinkWindowGroup at Z = 5.14, Y = 1.85!)
  addWall('wall_e_s_kitchen_n', 7.35, H / 2, 2.545, wallThick, H, 4.43, diningWallMat);
  addWall('wall_e_s_kitchen_s', 7.35, H / 2, 6.175, wallThick, H, 1.31, diningWallMat);
  addWall('wall_e_s_kitchen_win_bot', 7.35, 0.695, 5.14, wallThick, 1.39, 0.76, diningWallMat);
  addWall('wall_e_s_kitchen_win_top', 7.35, (2.31 + H) / 2, 5.14, wallThick, H - 2.31, 0.76, diningWallMat);

  // Brass hardware material for window locks & sash lifts
  const brassMat = mat({ color: 0xd4a85c, roughness: 0.28, metalness: 0.72 });
  const trackMetalMat = mat({ color: 0xb8b2c4, roughness: 0.36, metalness: 0.55 });
  const blindWoodMat = mat({
    color: 0xc9936b,
    roughness: 0.48,
    metalness: 0.05,
    woodLacquer: 0.92,
  });
  const blindCordMat = mat({ color: 0xe8dec8, roughness: 0.82, metalness: 0.0 });

  // =========================================================================
  // 2A. LIVING ROOM EAST WINDOWS (Refined Tall Double-Sash Windows, Wider Spacing!)
  // =========================================================================
  for (const [, wz] of [
    [1, -7.20],
    [2, -2.96],
  ] as const) {

    // Deep molded wooden window sill with stepped apron & decorative corbel blocks (aperture width = 1.28m)
    const sill = new THREE.Mesh(
      createBeveledSlab(0.21, 0.054, 1.48, 0.038, 0.015),
      wainscotTrimMat
    );
    sill.position.set(7.30, 0.875, wz);
    sill.castShadow = true;
    sill.receiveShadow = true;
    outlines.addOutline(sill, 1.018);
    structureGroup.add(sill);

    const apron = new THREE.Mesh(
      createBeveledBox(0.05, 0.058, 1.36, 0.012, 3),
      wainscotBaseMat
    );
    apron.position.set(7.265, 0.822, wz);
    structureGroup.add(apron);

    // 2 Carved wooden corbel brackets beneath the window sill ends
    for (const side of [-1, 1]) {
      const corbel = new THREE.Mesh(
        createBeveledBox(0.062, 0.075, 0.065, 0.012, 2),
        darkTrimMat
      );
      corbel.position.set(7.26, 0.81, wz + side * 0.54);
      structureGroup.add(corbel);
    }

    // Outer & Inner stepped vertical casings (fluted jambs) + top crown cornice
    for (const side of [-1, 1]) {
      const outerCasing = new THREE.Mesh(
        createBeveledBox(0.16, 1.88, 0.088, 0.016, 3),
        wainscotTrimMat
      );
      outerCasing.position.set(7.31, 1.80, wz + side * 0.655);
      outerCasing.castShadow = true;
      structureGroup.add(outerCasing);

      const innerLiner = new THREE.Mesh(
        createBeveledBox(0.12, 1.82, 0.042, 0.01, 2),
        darkTrimMat
      );
      innerLiner.position.set(7.32, 1.80, wz + side * 0.595);
      structureGroup.add(innerLiner);
    }

    const topCornice = new THREE.Mesh(
      createBeveledSlab(0.20, 0.075, 1.52, 0.032, 0.015),
      wainscotTrimMat
    );
    topCornice.position.set(7.30, 2.745, wz);
    topCornice.castShadow = true;
    outlines.addOutline(topCornice, 1.018);
    structureGroup.add(topCornice);

    const subHeader = new THREE.Mesh(
      createBeveledBox(0.14, 0.038, 1.38, 0.01, 2),
      darkTrimMat
    );
    subHeader.position.set(7.31, 2.695, wz);
    structureGroup.add(subHeader);

    // Warm painted wooden colonial window sashes & muntin bars that receive real scene lighting (darken naturally at night!)
    const whiteSashMat = mat({
      map: textures.furnitureOak,
      bumpMap: textures.furnitureWoodBump,
      bumpScale: 0.004,
      color: 0xe8d8cc,
      roughness: 0.90,
      metalness: 0.0,
      woodLacquer: 0.08,
    });
    for (const [sashY, sashX, sashH] of [
      [2.235, 7.355, 0.89], // Upper sash (slightly outer)
      [1.355, 7.330, 0.91], // Lower sash (slightly inner)
    ] as const) {
      // Top & bottom sash rails
      for (const ry of [-sashH / 2 + 0.024, sashH / 2 - 0.024]) {
        const rail = new THREE.Mesh(
          createBeveledBox(0.036, 0.048, 1.18, 0.008, 2),
          whiteSashMat
        );
        rail.position.set(sashX, sashY + ry, wz);
        rail.castShadow = false;
        structureGroup.add(rail);
      }
      // Left, Center-Left, Center-Right & Right vertical sash stiles/muntins (3-column colonial grid!)
      for (const rz of [-0.565, -0.188, 0.188, 0.565]) {
        const stile = new THREE.Mesh(
          createBeveledBox(0.032, sashH - 0.04, 0.034, 0.006, 2),
          whiteSashMat
        );
        stile.position.set(sashX, sashY, wz + rz);
        stile.castShadow = false;
        structureGroup.add(stile);
      }
      // Horizontal glazing muntin bar dividing each sash into 2x3 panes
      const hMuntin = new THREE.Mesh(
        createBeveledBox(0.028, 0.028, 1.14, 0.005, 2),
        whiteSashMat
      );
      hMuntin.position.set(sashX, sashY, wz);
      hMuntin.castShadow = false;
      structureGroup.add(hMuntin);
    }

    // Center Meeting Rail Brass Sash Lock & Bottom Sash Lift Handles
    const sashLock = new THREE.Mesh(
      createBeveledBox(0.032, 0.022, 0.068, 0.006, 2),
      brassMat
    );
    sashLock.position.set(7.305, 1.80, wz);
    structureGroup.add(sashLock);

    for (const hz of [-0.28, 0.28]) {
      const liftHandle = new THREE.Mesh(
        createBeveledBox(0.026, 0.018, 0.080, 0.005, 2),
        brassMat
      );
      liftHandle.position.set(7.305, 0.935, wz + hz);
      structureGroup.add(liftHandle);
    }

    // Glowing luminous window glass spanning full aperture (Y = 0.88 .. 2.72) with conditional night Bloom reduction & darkening overlay
    const glassMat = createWindowEmissiveMaterial(uniforms, 0xfff0dc, 0.94);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 1.86), glassMat);
    glass.rotation.y = -Math.PI / 2;
    glass.position.set(7.40, 1.80, wz);
    glass.userData.dynamic = true;
    structureGroup.add(glass);
    windowGlowMeshes.push(glass);

    // Shorter, softer Anisotropic Scattering Tyndall Shaft Assembly (strong exponential decay, no hard beam edges!)
    const tyndallGeo = createTyndallShaftClusterGeometry(
      3.25,
      1.26,
      0.88,
      2.66,
      0.16,
      1.42,
      -0.24,
      1.32
    );
    const tyndallMat = createTyndallBeamShaderMaterial(uniforms, 0.145, 3.0, 2.0, 3.15, 0.08);
    const tyndallShaft = new THREE.Mesh(tyndallGeo, tyndallMat);
    tyndallShaft.position.set(7.28, 0, wz);
    tyndallShaft.renderOrder = 4;
    tyndallShaft.userData.dynamic = true;
    structureGroup.add(tyndallShaft);
    volumetricRays.push(tyndallShaft);

    // Slanted Semi-Transparent Window-Grid Afternoon Sunlight Patch on Floor & Rug (Y = 0.0385 above rug top!)
    const goboMat = createWindowGoboShaderMaterial(
      uniforms,
      textures.windowLightGobo,
      wz
    );
    const goboPatch = new THREE.Mesh(new THREE.PlaneGeometry(3.85, 1.96), goboMat);
    goboPatch.rotation.x = -Math.PI / 2;
    goboPatch.rotation.z = -0.18;
    goboPatch.position.set(5.28, 0.0385, wz - 0.34);
    goboPatch.renderOrder = 3;
    goboPatch.userData.dynamic = true;
    structureGroup.add(goboPatch);
    volumetricRays.push(goboPatch);
  }

  // =========================================================================
  // 2B. BEDROOM NORTH ARCHED WINDOW: CRISP WHITE CASEMENT + SEMICIRCULAR FANLIGHT ARCH
  //     + LIVING-ROOM-STYLE ARCHED PARTED CURTAINS, LACE VALANCE, SHEERS & WHITE TASSELS
  // =========================================================================
  const bedWinGroup = new THREE.Group();
  bedWinGroup.name = 'BedroomSlidingWindow';
  bedWinGroup.position.set(-4.65, 0, -6.69);
  structureGroup.add(bedWinGroup);

  const ARCH_SPRING_Y = 2.12;
  const ARCH_RADIUS = 0.93;

  // Exterior luminous arched window glass backdrop (rectangular lower + semicircular fanlight upper)
  const bedGlassMat = createWindowEmissiveMaterial(uniforms, 0xfff0ec, 0.92);
  const bedGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.88, 1.24), bedGlassMat);
  bedGlass.position.set(-4.65, 1.52, -6.80);
  bedGlass.userData.dynamic = true;
  structureGroup.add(bedGlass);
  windowGlowMeshes.push(bedGlass);

  const bedArchGlass = new THREE.Mesh(
    new THREE.CircleGeometry(ARCH_RADIUS + 0.02, 40, 0, Math.PI),
    bedGlassMat
  );
  bedArchGlass.position.set(-4.65, ARCH_SPRING_Y, -6.80);
  bedArchGlass.userData.dynamic = true;
  structureGroup.add(bedArchGlass);
  windowGlowMeshes.push(bedArchGlass);

  // Bedroom North Window Anisotropic Scattering Tyndall Shaft (shorter reach, silky soft diffuse gradient!)
  const bedTyndallGeo = createTyndallShaftClusterGeometry(
    2.85,
    1.78,
    0.92,
    2.82,
    0.16,
    1.36,
    0.12,
    1.28
  );
  const bedTyndallMat = createTyndallBeamShaderMaterial(uniforms, 0.138, 2.0, 2.0, 3.25, 0.08);
  const bedTyndallShaft = new THREE.Mesh(bedTyndallGeo, bedTyndallMat);
  bedTyndallShaft.position.set(-4.65, 0, -6.68);
  // Rotate +PI/2 around Y so local -X projects South (+Z) into the Bedroom across the sill, bed & floor!
  bedTyndallShaft.rotation.y = Math.PI / 2;
  bedTyndallShaft.renderOrder = 4;
  bedTyndallShaft.userData.dynamic = true;
  structureGroup.add(bedTyndallShaft);
  volumetricRays.push(bedTyndallShaft);

  // Crisp creamy-white molded window sill, apron, transom impost bar & vertical side casings
  const bedSill = new THREE.Mesh(
    createBeveledSlab(2.12, 0.054, 0.32, 0.038, 0.014),
    bedWainscotTrimMat
  );
  bedSill.position.set(0, 0.905, 0.05);
  bedSill.castShadow = true;
  bedSill.receiveShadow = true;
  outlines.addOutline(bedSill, 1.018);
  bedWinGroup.add(bedSill);

  const bedApron = new THREE.Mesh(
    createBeveledBox(1.98, 0.048, 0.042, 0.010, 2),
    bedWainscotTrimMat
  );
  bedApron.position.set(0, 0.856, 0.145);
  bedWinGroup.add(bedApron);

  // Horizontal transom impost molding separating lower casement panes & upper semicircular arch
  const bedTransomBar = new THREE.Mesh(
    createBeveledSlab(2.08, 0.056, 0.25, 0.022, 0.010),
    bedWainscotTrimMat
  );
  bedTransomBar.position.set(0, ARCH_SPRING_Y, 0.02);
  bedTransomBar.castShadow = true;
  outlines.addOutline(bedTransomBar, 1.016);
  bedWinGroup.add(bedTransomBar);

  for (const bx of [-0.97, 0.97]) {
    const sideCasing = new THREE.Mesh(
      createBeveledBox(0.092, 1.24, 0.24, 0.015, 3),
      bedWainscotTrimMat
    );
    sideCasing.position.set(bx, 1.51, 0.02);
    sideCasing.castShadow = true;
    bedWinGroup.add(sideCasing);
  }

  // Semicircular Arched Outer Casing + Inner Sash Ring + Radial Sunburst Fanlight Muntins (半圆形拱窗框与放射窗格!)
  {
    const makeArchRingGeo = (rIn: number, rOut: number, depth: number, bevel = 0.008) => {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, rOut, 0, Math.PI, false);
      sh.lineTo(-rIn, 0);
      sh.absarc(0, 0, rIn, Math.PI, 0, true);
      sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, {
        depth,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 2,
        curveSegments: 36,
      });
      geo.translate(0, 0, -depth / 2);
      return geo;
    };

    // Sculpted outer semicircular wooden arch casing flush with side casings
    const outerArchCasing = new THREE.Mesh(
      makeArchRingGeo(ARCH_RADIUS - 0.015, ARCH_RADIUS + 0.088, 0.23, 0.010),
      bedWainscotTrimMat
    );
    outerArchCasing.position.set(0, ARCH_SPRING_Y, 0.02);
    outerArchCasing.castShadow = true;
    outlines.addOutline(outerArchCasing, 1.015);
    bedWinGroup.add(outerArchCasing);

    // Inner recessed semicircular sash frame + concentric sunburst hub arc
    const innerArchSash = new THREE.Mesh(
      makeArchRingGeo(ARCH_RADIUS - 0.062, ARCH_RADIUS - 0.010, 0.042, 0.004),
      bedWainscotTrimMat
    );
    innerArchSash.position.set(0, ARCH_SPRING_Y, -0.025);
    bedWinGroup.add(innerArchSash);

    const hubArchRing = new THREE.Mesh(
      makeArchRingGeo(0.24, 0.278, 0.030, 0.003),
      bedWainscotTrimMat
    );
    hubArchRing.position.set(0, ARCH_SPRING_Y, -0.025);
    bedWinGroup.add(hubArchRing);

    // 5 crisp radial sunburst muntin spokes fanning across the semicircular fanlight glass
    const spokeLen = ARCH_RADIUS - 0.04 - 0.255;
    const spokeMidR = 0.255 + spokeLen * 0.5;
    for (let s = 1; s <= 5; s++) {
      const ang = (s / 6) * Math.PI;
      const spoke = new THREE.Mesh(
        createBeveledBox(0.026, spokeLen, 0.024, 0.004, 1),
        bedWainscotTrimMat
      );
      spoke.position.set(
        Math.cos(ang) * spokeMidR,
        ARCH_SPRING_Y + Math.sin(ang) * spokeMidR,
        -0.025
      );
      spoke.rotation.z = ang - Math.PI / 2;
      bedWinGroup.add(spoke);
    }
  }

  // Clean white 2x2 lower casement window sashes & muntin grid
  for (const [sashX, sashZ] of [
    [-0.455, -0.025],
    [0.455, -0.025],
  ] as const) {
    const sashGroup = new THREE.Group();
    sashGroup.position.set(sashX, 1.515, sashZ);
    const sashW = 0.92;
    const sashH = 1.15;
    for (const ry of [-sashH / 2 + 0.025, sashH / 2 - 0.025]) {
      const hRail = new THREE.Mesh(
        createBeveledBox(sashW, 0.046, 0.034, 0.008, 2),
        bedWainscotTrimMat
      );
      hRail.position.y = ry;
      sashGroup.add(hRail);
    }
    for (const rx of [-sashW / 2 + 0.025, sashW / 2 - 0.025]) {
      const vStile = new THREE.Mesh(
        createBeveledBox(0.046, sashH - 0.04, 0.034, 0.008, 2),
        bedWainscotTrimMat
      );
      vStile.position.x = rx;
      sashGroup.add(vStile);
    }
    const midBar = new THREE.Mesh(
      createBeveledBox(sashW - 0.08, 0.026, 0.024, 0.005, 2),
      bedWainscotTrimMat
    );
    sashGroup.add(midBar);
    bedWinGroup.add(sashGroup);
  }

  // Living-Room-Style Arched Parted Curtains + Flared Lace Valance + Inner Sheers + Tieback Bows + White Tassels!
  // (卧室窗帘形制与客厅完全一致：双层纱帘+拱形对开帘布+蝴蝶结绑带+蕾丝花边窗幔+下摆白色流苏)
  {
    const ROD_Y = 3.18;
    const CURTAIN_H = 2.94; // drapes from Y = 3.18 down to Y = 0.24
    const CURTAIN_CENTER_Y = ROD_Y - CURTAIN_H * 0.5; // 1.71

    // Soft French sage-celadon linen bedroom curtain fabric & muted olive-sage tieback ribbon band
    const bedCurtainMat = mat({
      map: textures.plushFabric,
      bumpMap: textures.plushBump,
      bumpScale: 0.010,
      color: 0xe4efe0,
      roughness: 0.88,
      metalness: 0.0,
      rimScale: 1.35,
      celStrength: 0.34,
      side: THREE.DoubleSide,
      windSway: 0.65,
    });
    const bedCurtainBandMat = mat({
      map: textures.plushFabric,
      color: 0x7e9f7c,
      roughness: 0.78,
      metalness: 0.02,
      rimScale: 1.32,
      celStrength: 0.40,
    });
    const bedSheerMat = mat({
      map: textures.plushFabric,
      color: 0xfffdfb,
      roughness: 0.90,
      metalness: 0.0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      windSway: 0.72,
    });

    // Register bedroom curtain color into persistent Global Color Studio (F8)
    apartmentColorStudio.registerMaterialColor('bedroomCurtain', '卧室窗帘布色', 'bedroom', bedCurtainMat);
    apartmentColorStudio.registerMaterialColor('bedroomCurtainBand', '卧室窗帘绑带色', 'bedroom', bedCurtainBandMat);

    // 1) Inner sheer rod + twin translucent white voile sheer panels
    const sheerRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.010, 0.010, 2.26, 10),
      bedWainscotTrimMat
    );
    sheerRod.rotation.z = Math.PI / 2;
    sheerRod.position.set(0, ROD_Y - 0.05, 0.115);
    bedWinGroup.add(sheerRod);

    const bedSheerGeo = createDrapedCurtainGeometry(0.96, CURTAIN_H - 0.10, 0.036, 10.5);
    for (const sSide of [-1, 1] as const) {
      const sheerMesh = new THREE.Mesh(bedSheerGeo, bedSheerMat);
      sheerMesh.position.set(sSide * 0.50, CURTAIN_CENTER_Y + 0.02, 0.115);
      sheerMesh.userData.dynamic = true;
      bedWinGroup.add(sheerMesh);
    }

    // 2) Outer curtain rod + sculpted sphere finials + brackets
    const curtainRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 2.66, 12),
      bedWainscotTrimMat
    );
    curtainRod.rotation.z = Math.PI / 2;
    curtainRod.position.set(0, ROD_Y, 0.175);
    curtainRod.castShadow = true;
    bedWinGroup.add(curtainRod);

    for (const fx of [-1.34, 1.34]) {
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), bedWainscotTrimMat);
      finial.position.set(fx, ROD_Y, 0.175);
      bedWinGroup.add(finial);
      const bracket = new THREE.Mesh(
        createBeveledBox(0.034, 0.038, 0.18, 0.008, 2),
        bedWainscotTrimMat
      );
      bracket.position.set(fx * 0.86, ROD_Y, 0.095);
      bedWinGroup.add(bracket);
    }

    // 3) Twin full-height arched parted pleated curtains + white cotton bottom tassels + tieback bows
    const bedCurtainLeftGeo = createArchedVelvetCurtainGeometry(1.18, CURTAIN_H, -1, 0.074, 6.5, 0.34);
    const bedCurtainRightGeo = createArchedVelvetCurtainGeometry(1.18, CURTAIN_H, 1, 0.074, 6.5, 0.34);

    const bedTasselMat = mat({
      color: 0xfbf7ee,
      roughness: 0.92,
      metalness: 0.0,
      windSway: 0.65,
    });
    const bedTasselGeo = (() => {
      const cord = new THREE.CylinderGeometry(0.0028, 0.0028, 0.016, 6);
      cord.translate(0, -0.008, 0);
      const bead = new THREE.SphereGeometry(0.0065, 7, 6);
      bead.translate(0, -0.018, 0);
      const skirt = new THREE.ConeGeometry(0.0125, 0.046, 8);
      skirt.translate(0, -0.044, 0);
      return BufferGeometryUtils.mergeGeometries([cord, bead, skirt], false)!;
    })();
    const _tm = new THREE.Matrix4();

    for (const side of [-1, 1] as const) {
      const panelGroup = new THREE.Group();
      panelGroup.position.set(0, CURTAIN_CENTER_Y, 0.175);

      const panelGeo = side === -1 ? bedCurtainLeftGeo : bedCurtainRightGeo;
      const drapeMesh = new THREE.Mesh(panelGeo, bedCurtainMat);
      drapeMesh.castShadow = true;
      drapeMesh.receiveShadow = true;
      drapeMesh.userData.dynamic = true;
      outlines.addOutline(drapeMesh, 1.012);
      panelGroup.add(drapeMesh);

      // White cotton tassel fringe hanging along the exact wavy v = 0 bottom hem
      const hemPos = panelGeo.attributes.position;
      const hemUv = panelGeo.attributes.uv;
      const anchors: THREE.Vector3[] = [];
      for (let vi = 0; vi < hemPos.count; vi++) {
        if (hemUv.getY(vi) <= 0.001) {
          anchors.push(new THREE.Vector3(hemPos.getX(vi), hemPos.getY(vi), hemPos.getZ(vi)));
        }
      }
      const stride = Math.max(1, Math.floor(anchors.length / 20));
      const picked = anchors.filter((_, idx) => idx % stride === 0);
      const tasselsInst = new THREE.InstancedMesh(bedTasselGeo, bedTasselMat, picked.length);
      for (let ti = 0; ti < picked.length; ti++) {
        const a = picked[ti];
        _tm.makeTranslation(a.x, a.y + 0.003, a.z);
        tasselsInst.setMatrixAt(ti, _tm);
      }
      tasselsInst.instanceMatrix.needsUpdate = true;
      tasselsInst.computeBoundingSphere();
      tasselsInst.userData.dynamic = true;
      panelGroup.add(tasselsInst);

      // Sculpted tieback ribbon band + 2-loop bow + fluttering tails at the gathered waist
      const tieY = -0.47;
      const tieX = side * 0.855;
      const tieBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.102, 0.016, 10, 20),
        bedCurtainBandMat
      );
      tieBand.rotation.x = Math.PI / 2;
      tieBand.scale.set(1.22, 0.68, 1);
      tieBand.position.set(tieX, tieY, 0.012);
      panelGroup.add(tieBand);

      const bowKnot = new THREE.Mesh(
        new THREE.SphereGeometry(0.019, 10, 8),
        bedCurtainBandMat
      );
      bowKnot.position.set(tieX, tieY, 0.074);
      panelGroup.add(bowKnot);

      for (const bSide of [-1, 1]) {
        const bowLoop = new THREE.Mesh(
          new THREE.TorusGeometry(0.032, 0.009, 8, 16),
          bedCurtainBandMat
        );
        bowLoop.rotation.z = bSide * -0.28;
        bowLoop.scale.set(1.35, 0.72, 0.55);
        bowLoop.position.set(tieX + bSide * 0.036, tieY + 0.012, 0.080);
        panelGroup.add(bowLoop);

        const ribbonTail = new THREE.Mesh(
          new THREE.BoxGeometry(0.022, 0.15, 0.008),
          bedCurtainBandMat
        );
        ribbonTail.rotation.z = bSide * -0.22;
        ribbonTail.rotation.x = 0.10;
        ribbonTail.position.set(tieX + bSide * 0.026, tieY - 0.074, 0.082);
        panelGroup.add(ribbonTail);
      }

      // Curtain rings along rod
      for (let r = 0; r < 6; r++) {
        const rx = side * (0.12 + r * 0.205);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.024, 0.005, 8, 14),
          bedWainscotTrimMat
        );
        ring.rotation.y = Math.PI / 2;
        ring.position.set(rx, ROD_Y - 0.01, 0.175);
        bedWinGroup.add(ring);
      }

      bedWinGroup.add(panelGroup);
    }

    // 4) Outwardly-flared top valance with delicate scalloped white lace trim (matching Living Room valance!)
    const bedValanceTex = (() => {
      const vc = document.createElement('canvas');
      vc.width = 1024;
      vc.height = 256;
      const vctx = vc.getContext('2d')!;
      vctx.clearRect(0, 0, 1024, 256);
      const topGrad = vctx.createLinearGradient(0, 0, 0, 152);
      topGrad.addColorStop(0.0, '#eef5ea');
      topGrad.addColorStop(0.6, '#dfecda');
      topGrad.addColorStop(1.0, '#cfe0ca');
      vctx.fillStyle = topGrad;
      vctx.fillRect(0, 0, 1024, 152);
      // French sage satin seam ribbon + scalloped white embroidered lace border
      vctx.fillStyle = '#8bab88';
      vctx.fillRect(0, 144, 1024, 14);
      vctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      vctx.fillRect(0, 158, 1024, 38);
      vctx.fillStyle = '#ffffff';
      vctx.fillRect(0, 194, 1024, 5);
      const scallops = 24;
      const scW = 1024 / scallops;
      const scR = scW * 0.5;
      for (let i = 0; i < scallops; i++) {
        const cx = i * scW + scR;
        const cy = 200;
        vctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        vctx.beginPath();
        vctx.arc(cx, cy, scR + 1.5, 0, Math.PI, false);
        vctx.closePath();
        vctx.fill();
        vctx.strokeStyle = '#ffffff';
        vctx.lineWidth = 4.0;
        vctx.beginPath();
        vctx.arc(cx, cy, scR + 0.5, 0.04, Math.PI - 0.04, false);
        vctx.stroke();
      }
      const tex = new THREE.CanvasTexture(vc);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      return tex;
    })();
    const bedValanceMat = mat({
      map: bedValanceTex,
      color: 0xffffff,
      roughness: 0.64,
      metalness: 0.02,
      rimScale: 1.38,
      celStrength: 0.36,
      alphaTest: 0.14,
      transparent: true,
      side: THREE.DoubleSide,
      windSway: 0.42,
    });
    const bedValanceGeo = createFlaredValanceGeometry(2.50, 0.36, 0.044, 13.0);
    const bedValanceMesh = new THREE.Mesh(bedValanceGeo, bedValanceMat);
    bedValanceMesh.position.set(0, ROD_Y - 0.14, 0.255);
    bedValanceMesh.castShadow = true;
    bedValanceMesh.receiveShadow = true;
    bedValanceMesh.userData.dynamic = true;
    bedWinGroup.add(bedValanceMesh);
  }

  // Sill Decor (Screenshot 3): Mini wooden plant stand + potted purple flowers + cute seated plush teddy bear
  const sillStand = new THREE.Group();
  sillStand.position.set(-0.08, 0.935, 0.08);
  const standTop = new THREE.Mesh(
    createBeveledSlab(0.32, 0.018, 0.16, 0.016, 0.005),
    wainscotTrimMat
  );
  standTop.position.y = 0.085;
  sillStand.add(standTop);
  for (const sx of [-0.12, 0.12]) {
    for (const sz of [-0.055, 0.055]) {
      const sLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.085, 8), wainscotTrimMat);
      sLeg.position.set(sx, 0.042, sz);
      sillStand.add(sLeg);
    }
  }
  const sillPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.048, 0.098, 14),
    mat({ color: 0xe8b5a2, roughness: 0.72 })
  );
  sillPot.position.set(0, 0.142, 0);
  outlines.addOutline(sillPot, 1.04);
  sillStand.add(sillPot);

  const sillLeafMat = mat({ color: 0x568b52, roughness: 0.78 });
  const sillFlowerMat = mat({ color: 0x9c72d8, roughness: 0.75 });
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), sillLeafMat);
    leaf.scale.set(1.4, 0.45, 0.9);
    leaf.position.set(Math.cos(ang) * 0.055, 0.21 + (i % 2) * 0.02, Math.sin(ang) * 0.045);
    leaf.rotation.y = ang;
    sillStand.add(leaf);
  }
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + 0.3;
    const r = i === 0 ? 0 : 0.058;
    const blossom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.025, 0), sillFlowerMat);
    blossom.position.set(Math.cos(ang) * r, 0.265 + (i % 3) * 0.024, Math.sin(ang) * r * 0.8);
    sillStand.add(blossom);
  }
  bedWinGroup.add(sillStand);

  // Cute Plush Teddy Bear sitting on the right side of the Bedroom Window Sill (Screenshot 3!)
  const teddy = new THREE.Group();
  teddy.position.set(0.42, 0.935, 0.09);
  teddy.rotation.y = -0.22;
  const bearFurMat = mat({ color: 0xc99c7c, roughness: 0.92 });
  const bearMuzzleMat = mat({ color: 0xedd6c2, roughness: 0.90 });
  const bearEyeMat = mat({ color: 0x2a1f24, roughness: 0.25 });
  const bearBody = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), bearFurMat);
  bearBody.scale.set(1.0, 1.12, 0.92);
  bearBody.position.y = 0.095;
  outlines.addOutline(bearBody, 1.045);
  teddy.add(bearBody);
  const bearHead = new THREE.Mesh(new THREE.SphereGeometry(0.074, 14, 12), bearFurMat);
  bearHead.position.y = 0.225;
  outlines.addOutline(bearHead, 1.05);
  teddy.add(bearHead);
  const bearMuzzle = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), bearMuzzleMat);
  bearMuzzle.scale.set(1.15, 0.85, 0.9);
  bearMuzzle.position.set(0, 0.212, 0.062);
  teddy.add(bearMuzzle);
  const bearNose = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), bearEyeMat);
  bearNose.position.set(0, 0.222, 0.088);
  teddy.add(bearNose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), bearFurMat);
    ear.position.set(s * 0.056, 0.282, 0.0);
    teddy.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), bearEyeMat);
    eye.position.set(s * 0.025, 0.236, 0.066);
    teddy.add(eye);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.065, 6, 8), bearFurMat);
    leg.rotation.x = Math.PI / 2;
    leg.position.set(s * 0.052, 0.032, 0.072);
    teddy.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.023, 0.055, 6, 8), bearFurMat);
    arm.rotation.set(0.35, 0, s * -0.42);
    arm.position.set(s * 0.082, 0.125, 0.035);
    teddy.add(arm);
  }
  bedWinGroup.add(teddy);

  // Glowing Warm-Gold Crescent Moon Night-Light mounted high in the Bedroom Attic Gable Peak above the Window
  const moonShape = new THREE.Shape();
  moonShape.absarc(0, 0, 0.155, Math.PI * 0.28, Math.PI * 1.72, false);
  moonShape.absarc(0.072, 0.015, 0.125, Math.PI * 1.56, Math.PI * 0.42, true);
  moonShape.closePath();
  const moonGeo = new THREE.ExtrudeGeometry(moonShape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  moonGeo.center();
  const moonGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd57e });
  const moonLightMesh = new THREE.Mesh(moonGeo, moonGlowMat);
  moonLightMesh.position.set(0, 2.98, 0.088);
  moonLightMesh.userData.dynamic = true;
  bedWinGroup.add(moonLightMesh);

  const moonCord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.003, 0.003, 0.46, 6),
    mat({ color: 0xebe2e6, roughness: 0.8 })
  );
  moonCord.position.set(0, 2.61, 0.072);
  bedWinGroup.add(moonCord);

  // Soft Bedroom North Window Moonlight Wash PointLight (room-culled by SceneManager for zero cost outside bedroom!)
  const bedMoonlightFill = new THREE.PointLight(0x7ca6ff, 0.0, 6.8, 1.35);
  bedMoonlightFill.position.set(-4.65, 1.72, -6.22);
  bedMoonlightFill.castShadow = false;
  scene.add(bedMoonlightFill);
  ctx.sceneManager.registerRoomObject('bedroom', bedMoonlightFill);
  ctx.metaState.bedroomMoonlightFill = bedMoonlightFill;

  // Soft bedroom North-window floor light pool (warm sunlight in day/sunset, powdery cool-blue moonlight wash in midnight)
  const bedFloorGoboMat = createWindowGoboShaderMaterial(
    uniforms,
    textures.windowLightGobo,
    -4.65
  );
  const bedFloorGobo = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 2.15), bedFloorGoboMat);
  bedFloorGobo.rotation.x = -Math.PI / 2;
  bedFloorGobo.rotation.z = -Math.PI / 2;
  bedFloorGobo.position.set(-4.68, 0.012, -5.18);
  bedFloorGobo.userData.dynamic = true;
  structureGroup.add(bedFloorGobo);
  volumetricRays.push(bedFloorGobo);

  // Exterior twilight/daylight sky backdrop outside windows (placed well clear of Bathroom Z = -14.15!)
  const skyGeo = new THREE.PlaneGeometry(36, 16);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xd88894, side: THREE.DoubleSide });
  const eastSky = new THREE.Mesh(skyGeo, skyMat);
  eastSky.rotation.y = Math.PI / 2;
  eastSky.position.set(10.6, 2.5, -2.0);
  eastSky.userData.dynamic = true;
  structureGroup.add(eastSky);
  windowGlowMeshes.push(eastSky);

  const northSky = new THREE.Mesh(skyGeo, skyMat);
  northSky.position.set(0, 2.5, -17.2);
  northSky.userData.dynamic = true;
  structureGroup.add(northSky);
  windowGlowMeshes.push(northSky);

  // =========================================================================
  // 3. INTERIOR PARTITION WALLS, CORNER PILASTERS & WOOD WAINSCOTING
  //    (All corners overlapped by full wall thickness so zero gaps exist!)
  // =========================================================================
  // Partition wall between Bedroom & Living Room at X = -1.22 (spanning Z = -6.83 .. +0.33)
  addWall('wall_bed_liv_n', -1.22, H / 2, -5.49, 0.16, H, 2.68, livingWallMat);
  addWall('wall_bed_liv_s', -1.22, H / 2, -1.36, 0.16, H, 3.38, livingWallMat);
  addWall('wall_bed_liv_hdr', -1.22, 2.65, -3.60, 0.16, 0.9, 1.16, livingWallMat);

  const bedroomOverlayMat = mat({
    map: textures.wallpaperBedroom,
    color: 0xffffff,
    roughness: 0.90,
    metalness: 0.0,
    celStrength: 0.62,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const diningOverlayMat = mat({
    map: textures.wallpaperDining,
    color: 0xfff8fa,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.56,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const concreteOverlayMat = mat({
    map: textures.concrete,
    bumpMap: textures.concreteBump,
    bumpScale: 0.020,
    roughnessMap: textures.concreteRoughness,
    color: 0xd0ccd8,
    roughness: 0.94,
    metalness: 0.02,
    celStrength: 0.44,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  apartmentColorStudio.registerMaterialColor('bedroomWall', '卧室墙纸', 'bedroom', bedroomOverlayMat);
  apartmentColorStudio.registerMaterialColor('diningWall', '餐厨/玄关墙面', 'dining', diningOverlayMat);

  // Bedroom-side thin wallpaper overlay on West face of X=-1.22 partition wall (trimmed to bedroom interior!)
  const makeOverlayPlane = (width: number, height: number) => {
    const g = new THREE.PlaneGeometry(width, height);
    const uvs = g.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      uvs.setXY(i, uvs.getX(i) * (width / 2.0), uvs.getY(i) * (height / 2.0));
    }
    uvs.needsUpdate = true;
    return g;
  };
  const bedEastOverlayN = new THREE.Mesh(makeOverlayPlane(2.50, H), bedroomOverlayMat);
  bedEastOverlayN.rotation.y = -Math.PI / 2;
  bedEastOverlayN.position.set(-1.305, H / 2, -5.40);
  bedEastOverlayN.receiveShadow = true;
  structureGroup.add(bedEastOverlayN);

  const bedEastOverlayS = new THREE.Mesh(makeOverlayPlane(3.22, H), bedroomOverlayMat);
  bedEastOverlayS.rotation.y = -Math.PI / 2;
  bedEastOverlayS.position.set(-1.305, H / 2, -1.44);
  bedEastOverlayS.receiveShadow = true;
  structureGroup.add(bedEastOverlayS);

  const bedEastOverlayHdr = new THREE.Mesh(makeOverlayPlane(1.16, 0.9), bedroomOverlayMat);
  bedEastOverlayHdr.rotation.y = -Math.PI / 2;
  bedEastOverlayHdr.position.set(-1.305, 2.65, -3.60);
  bedEastOverlayHdr.receiveShadow = true;
  structureGroup.add(bedEastOverlayHdr);

  // Wall between Bedroom and Basement Stairwell at Z = 0.25 (spanning X = -8.09 .. -1.14, sealing the (-1.22, 0.25) corner!)
  addWall('wall_bed_stair', -4.615, H / 2, 0.25, 6.95, H, 0.16, bedroomWallMat);
  // Dining-room side wallpaper overlay on the East stub of wall_bed_stair (X = -2.70 .. -1.14, Z = +0.335)
  const stairHeaderLivingOverlay = new THREE.Mesh(makeOverlayPlane(1.56, H), diningOverlayMat);
  stairHeaderLivingOverlay.position.set(-1.92, H / 2, 0.335);
  stairHeaderLivingOverlay.receiveShadow = true;
  structureGroup.add(stairHeaderLivingOverlay);

  // Wall between Entryway and Basement Stairwell at Z = 2.45 (extends to Y=-0.14 to seal sunken Genkan floor cleanly!)
  addWall('wall_entry_stair', -5.355, Y_GENKAN_WALL, 2.45, 5.47, H_GENKAN, 0.16, diningWallMat);

  // East wall of Basement Stairwell at X = -2.70 (spanning Z = 0.17 .. 2.53 with doorway at Z = 0.78..1.92, facing Dining Room)
  addWall('wall_stair_e_n', -2.70, H / 2, 0.475, 0.16, H, 0.61, diningWallMat);
  addWall('wall_stair_e_s', -2.70, H / 2, 2.225, 0.16, H, 0.61, diningWallMat);
  addWall('wall_stair_e_hdr', -2.70, 2.65, 1.35, 0.16, 0.9, 1.20, diningWallMat);

  // Partition wall between Living Room and Dining/Kitchen at Z = 0.25 (spanning X = -1.30 .. 7.44, doorway X = 1.58 .. 2.73)
  addWall('wall_liv_din_w', 0.14, H / 2, 0.25, 2.88, H, 0.16, livingWallMat);
  addWall('wall_liv_din_e', 5.085, H / 2, 0.25, 4.71, H, 0.16, livingWallMat);
  addWall('wall_liv_din_hdr', 2.155, 2.65, 0.25, 1.21, 0.9, 0.16, livingWallMat);

  // Dining/Kitchen-side wallpaper overlay on South (+Z) face of Z = 0.25 partition wall
  const dinNorthOverlayW = new THREE.Mesh(makeOverlayPlane(2.72, H), diningOverlayMat);
  dinNorthOverlayW.position.set(0.22, H / 2, 0.335);
  dinNorthOverlayW.receiveShadow = true;
  structureGroup.add(dinNorthOverlayW);

  const kitNorthOverlayE = new THREE.Mesh(makeOverlayPlane(4.53, H), diningOverlayMat);
  kitNorthOverlayE.position.set(4.995, H / 2, 0.335);
  kitNorthOverlayE.receiveShadow = true;
  structureGroup.add(kitNorthOverlayE);

  const dinNorthOverlayHdr = new THREE.Mesh(makeOverlayPlane(1.15, 0.9), diningOverlayMat);
  dinNorthOverlayHdr.position.set(2.155, 2.65, 0.335);
  dinNorthOverlayHdr.receiveShadow = true;
  structureGroup.add(dinNorthOverlayHdr);

  // Wall between Entryway and Dining Room at X = -2.70 (spanning Z = 2.37 .. 6.83 with archway at Z = 2.95..5.75)
  addWall('wall_entry_din_n', -2.70, H / 2, 2.66, 0.16, H, 0.58, diningWallMat);
  addWall('wall_entry_din_s', -2.70, H / 2, 6.29, 0.16, H, 1.08, diningWallMat);
  addWall('wall_entry_din_hdr', -2.70, 2.75, 4.35, 0.16, 0.7, 2.86, diningWallMat);

  // Architectural Corner Trim Posts at key interior wall junctions
  // Kept strictly clear of Bedroom interior faces (Z <= 0.17, X <= -1.30) so no stray wooden board pokes into the Bedroom wall!
  const cornerPostSpecs: [number, number, number, number][] = [
    [-1.185, 0.285, 0.125, 0.125], // Living/Dining junction (strictly East & South of Bedroom corner!)
    [-2.70, 0.295, 0.185, 0.105],  // Dining/Stairwell junction (strictly South of Bedroom wall Z = 0.17!)
    [-2.70, 2.45, 0.195, 0.195],   // Entryway/Dining/Stairwell junction
  ];
  for (const [cx, cz, pw, pd] of cornerPostSpecs) {
    const cornerPost = new THREE.Mesh(
      createBeveledBox(pw, H, pd, 0.012, 3),
      wainscotTrimMat
    );
    cornerPost.position.set(cx, H / 2, cz);
    cornerPost.castShadow = true;
    cornerPost.receiveShadow = true;
    structureGroup.add(cornerPost);
  }

  for (const az of [2.97, 5.73]) {
    const pilaster = new THREE.Mesh(
      createBeveledBox(0.22, 2.42, 0.08, 0.018, 3),
      wainscotTrimMat
    );
    pilaster.position.set(-2.70, 1.21, az);
    pilaster.castShadow = true;
    structureGroup.add(pilaster);
  }
  const archBeam = new THREE.Mesh(
    createBeveledBox(0.24, 0.09, 2.90, 0.02, 3),
    wainscotTrimMat
  );
  archBeam.position.set(-2.70, 2.42, 4.35);
  archBeam.castShadow = true;
  structureGroup.add(archBeam);

  addWall('wall_kit_div_bot', 3.18, 0.5, 5.28, 0.18, 1.0, 2.92, diningWallMat);
  addWall('wall_kit_hdr', 3.18, 2.8, 3.55, 0.18, 0.6, 6.42, diningWallMat);

  // Kitchen archway pilasters (North at Z=0.39 & South at Z=3.82) & overhead beam framing Dining <-> Kitchen
  const kitNorthPillar = new THREE.Mesh(
    createBeveledBox(0.22, 2.52, 0.12, 0.02, 3),
    wainscotTrimMat
  );
  kitNorthPillar.position.set(3.18, 1.26, 0.39);
  kitNorthPillar.castShadow = true;
  kitNorthPillar.receiveShadow = true;
  structureGroup.add(kitNorthPillar);

  const kitPillar = new THREE.Mesh(
    createBeveledBox(0.22, 2.52, 0.12, 0.02, 3),
    wainscotTrimMat
  );
  kitPillar.position.set(3.18, 1.26, 3.82);
  kitPillar.castShadow = true;
  kitPillar.receiveShadow = true;
  structureGroup.add(kitPillar);

  const kitBeam = new THREE.Mesh(
    createBeveledBox(0.24, 0.085, 6.30, 0.018, 3),
    wainscotTrimMat
  );
  kitBeam.position.set(3.18, 2.5, 3.55);
  structureGroup.add(kitBeam);

  // -------------------------------------------------------------------------
  // SOFA-HEIGHT LIGHT-WOOD WAINSCOTING (淡木色无缝衔接竖向木板护墙板, H = 0.86m)
  // Continuous row of 3D beveled vertical tongue-and-groove planks (zero box frames!)
  // -------------------------------------------------------------------------
  const WAIN_H = 0.86;

  const addWainscotWall = (
    cx: number,
    cz: number,
    length: number,
    facing: 'z+' | 'z-' | 'x+' | 'x-',
    panelMaterial: THREE.Material = wainscotMat,
    trimMaterial: THREE.Material = wainscotTrimMat
  ) => {
    const isAlongX = facing === 'z+' || facing === 'z-';
    const sign = facing === 'z+' || facing === 'x+' ? 1 : -1;
    const wGroup = new THREE.Group();
    wGroup.position.set(cx, 0, cz);

    // 1. Main backing wainscot board with UVs scaled in world meters (1.0m tile)
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

    const panel = new THREE.Mesh(panelGeo, panelMaterial);
    panel.position.y = WAIN_H / 2;
    panel.receiveShadow = true;
    wGroup.add(panel);

    // 2. Continuous row of seamlessly joined 3D vertical beadboard planks
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
      const plankMesh = new THREE.Mesh(singlePlankGeo, panelMaterial);
      plankMesh.position.set(
        isAlongX ? offset : sign * 0.004,
        plankY,
        isAlongX ? sign * 0.004 : offset
      );
      plankMesh.castShadow = false;
      plankMesh.receiveShadow = true;
      wGroup.add(plankMesh);
    }

    // 3. Top beveled chair-rail molding cap (顶收口腰线 at Y = 0.878m) + subtle under-lip bead
    const railW = isAlongX ? length : 0.046;
    const railD = isAlongX ? 0.046 : length;
    const chairRail = new THREE.Mesh(
      createBeveledBox(railW, 0.046, railD, 0.011, 3),
      trimMaterial
    );
    chairRail.position.set(
      isAlongX ? 0 : sign * 0.008,
      WAIN_H + 0.018,
      isAlongX ? sign * 0.008 : 0
    );
    chairRail.castShadow = false;
    chairRail.receiveShadow = true;
    wGroup.add(chairRail);

    const underBead = new THREE.Mesh(
      createBeveledBox(
        isAlongX ? length : 0.034,
        0.018,
        isAlongX ? 0.034 : length,
        0.004,
        2
      ),
      trimMaterial
    );
    underBead.position.set(
      isAlongX ? 0 : sign * 0.005,
      WAIN_H - 0.008,
      isAlongX ? sign * 0.005 : 0
    );
    wGroup.add(underBead);

    // 4. Bottom beveled baseboard plinth
    const baseW = isAlongX ? length : 0.056;
    const baseD = isAlongX ? 0.056 : length;
    const baseboard = new THREE.Mesh(
      createBeveledBox(baseW, 0.056, baseD, 0.008, 2),
      trimMaterial
    );
    baseboard.position.set(
      isAlongX ? 0 : sign * 0.010,
      0.028,
      isAlongX ? sign * 0.010 : 0
    );
    baseboard.receiveShadow = true;
    wGroup.add(baseboard);

    structureGroup.add(wGroup);
  };

  // (Living Room Wainscoting is built & merged inside buildLivingRoom.ts)

  // 2) Entryway Wainscoting (trimmed cleanly around Front Door casing, corner post & archway pilasters!)
  addWainscotWall(-5.35, 2.545, 5.12, 'z+');
  addWainscotWall(-5.35, 6.635, 5.12, 'z-');
  addWainscotWall(-7.895, 3.21, 1.24, 'x+');
  addWainscotWall(-7.895, 5.99, 1.24, 'x+');
  addWainscotWall(-2.795, 2.749, 0.402, 'x-');
  addWainscotWall(-2.795, 6.20, 0.90, 'x-');

  // Sunken Genkan Lower Oak Baseboard Plinth Risers (Y = -0.082 .. +0.008) sealing the 8cm drop
  // so bright daylight skybox NEVER leaks or shows white below the Entryway baseboards!
  const addGenkanSkirt = (x: number, z: number, w: number, d: number) => {
    const skirt = new THREE.Mesh(
      createBeveledBox(w, 0.092, d, 0.006, 2),
      wainscotTrimMat
    );
    skirt.position.set(x, -0.038, z);
    skirt.receiveShadow = true;
    structureGroup.add(skirt);
  };
  addGenkanSkirt(-6.89, 2.555, 2.06, 0.058); // North Genkan sunken baseboard
  addGenkanSkirt(-6.89, 6.625, 2.06, 0.058); // South Genkan sunken baseboard
  addGenkanSkirt(-7.885, 3.29, 0.058, 1.48); // West Genkan North of front door
  addGenkanSkirt(-7.885, 5.91, 0.058, 1.48); // West Genkan South of front door
  // Extend Entryway West concave corner trim posts down to the sunken Genkan tile (Y=-0.08)
  for (const vz of [2.55, 6.63]) {
    const cornerDrop = new THREE.Mesh(
      createBeveledBox(0.058, 0.10, 0.058, 0.006, 2),
      wainscotTrimMat
    );
    cornerDrop.position.set(-7.89, -0.036, vz);
    cornerDrop.receiveShadow = true;
    structureGroup.add(cornerDrop);
  }

  // 3) Dining Room Wainscoting (seals basement door jambs Z=0.72..1.98 cleanly with zero exposed wallpaper gaps!)
  addWainscotWall(0.24, 6.635, 5.70, 'z-');
  addWainscotWall(-2.605, 6.20, 0.90, 'x+');
  addWainscotWall(-2.605, 2.749, 0.402, 'x+');
  addWainscotWall(-2.609, 0.534, 0.376, 'x+');
  addWainscotWall(-2.609, 2.166, 0.376, 'x+');
  addWainscotWall(-1.92, 0.345, 1.37, 'z+');
  addWainscotWall(0.175, 0.345, 2.80, 'z+');
  addWainscotWall(3.075, 5.25, 2.78, 'x-');

  // 4) Kitchen Wainscoting (seamless continuation from Dining Room through X=3.18 archway & along Kitchen walls!)
  addWainscotWall(5.26, 0.345, 3.98, 'z+');
  addWainscotWall(7.245, 1.42, 2.15, 'x-');
  addWainscotWall(3.275, 5.25, 2.78, 'x+');
  addWainscotWall(3.39, 6.635, 0.24, 'z-');

  // 5) Bedroom Crisp White Beadboard Wainscoting (MiSide Screenshots 1 & 2, H = 0.86m)
  //    Fits cleanly under North window sill (Y=0.905) and splits cleanly around Bedroom door (Z=-4.15..-3.05)!
  addWainscotWall(-4.61, 0.16, 6.56, 'z-', bedWainscotMat, bedWainscotTrimMat);
  addWainscotWall(-7.90, -3.245, 6.76, 'x+', bedWainscotMat, bedWainscotTrimMat);
  addWainscotWall(-4.61, -6.64, 6.56, 'z+', bedWainscotMat, bedWainscotTrimMat);
  addWainscotWall(-1.31, -5.43, 2.42, 'x-', bedWainscotMat, bedWainscotTrimMat);
  addWainscotWall(-1.31, -1.41, 3.14, 'x-', bedWainscotMat, bedWainscotTrimMat);

  // -------------------------------------------------------------------------
  // 4A. MISIDE ARCHITECTURAL CORNER TRIM STRIPS:
  //     Crisp white inside Bedroom, warm honey-oak across Entryway/Dining/Kitchen
  // -------------------------------------------------------------------------
  const vCornerStripGeo = createBeveledBox(0.056, 3.08, 0.056, 0.008, 2);
  const bedroomCornerPositions: [number, number][] = [
    [-7.89, -6.63], // Bedroom NW concave corner
    [-1.32, -6.63], // Bedroom NE concave corner
    [-7.89, 0.14],  // Bedroom SW concave corner
    [-1.32, 0.14],  // Bedroom SE concave corner
  ];
  for (const [vx, vz] of bedroomCornerPositions) {
    const vStrip = new THREE.Mesh(vCornerStripGeo, bedWainscotTrimMat);
    vStrip.position.set(vx, 1.54, vz);
    vStrip.castShadow = false;
    vStrip.receiveShadow = true;
    structureGroup.add(vStrip);
  }

  const vCornerPositions: [number, number][] = [
    // Entryway concave & archway corners
    [-7.89, 2.55],  // Entryway NW concave corner
    [-7.89, 6.63],  // Entryway SW concave corner
    [-2.80, 2.55],  // Entryway NE concave corner
    [-2.80, 6.63],  // Entryway SE concave corner
    [-2.80, 2.97],  // Entryway-Dining archway North convex corner (Entry side)
    [-2.80, 5.73],  // Entryway-Dining archway South convex corner (Entry side)
    // Dining Room & Corridor concave and archway convex corners
    [-2.60, 0.35],  // Corridor NW concave corner
    [-2.60, 2.97],  // Entryway-Dining archway North convex corner (Dining side)
    [-2.60, 5.73],  // Entryway-Dining archway South convex corner (Dining side)
    [-2.60, 6.63],  // Dining SW concave corner
    [3.07, 0.35],   // Corridor NE concave corner (Dining side of Kitchen arch)
    [3.07, 3.82],   // Dining-Kitchen divider North convex end (Dining side)
    [3.07, 6.63],   // Dining SE concave corner
    // Kitchen concave & convex corners
    [3.29, 0.35],   // Kitchen NW concave corner (Kitchen side of arch)
    [3.29, 3.82],   // Kitchen divider North convex end (Kitchen side)
    [3.29, 6.63],   // Kitchen SW concave corner
    [7.24, 0.35],   // Kitchen NE concave corner
    [7.24, 6.63],   // Kitchen SE concave corner
  ];
  for (const [vx, vz] of vCornerPositions) {
    const vStrip = new THREE.Mesh(vCornerStripGeo, wainscotTrimMat);
    vStrip.position.set(vx, 1.54, vz);
    vStrip.castShadow = false;
    vStrip.receiveShadow = true;
    structureGroup.add(vStrip);
  }

  // =========================================================================
  // 4. BASEMENT & STAIRWELL CRACKED CEMENT WALLS (NO WAINSCOTING, WIDE LANDING)
  // =========================================================================
  const BH = 2.9;
  const BY = -1.75;
  addWall('base_wall_n', -3.145, BY, -6.12, 12.63, BH, 0.22, concreteMat);
  // Push West wall opposite the stairs back to X = -9.35 (inner face -9.24) for generous landing space
  addWall('base_wall_w', -9.35, BY, -1.835, 0.22, BH, 8.79, concreteMat);
  addWall('base_wall_e', 3.06, BY, -1.835, 0.22, BH, 8.79, concreteMat);
  // Wide 3.92m doorway from stairwell landing (-9.24 .. -5.32) into basement room — zero corner obstruction!
  addWall('base_wall_s_e', -1.075, BY, 0.25, 8.49, BH, 0.22, concreteMat);
  // Lower stair shaft walls strictly below the 0.30m main floor slabs (top at Y = -0.31)
  // so there is ZERO coplanar Z-fighting flicker with the Dining/Entryway hardwood floors!
  addWall('stair_shaft_s', -6.035, -1.755, 2.45, 6.85, 2.89, 0.18, concreteMat);
  addWall('stair_shaft_e', -2.70, -1.755, 1.35, 0.18, 2.89, 2.20, concreteMat);

  // Concrete doorway lintel & stairwell west alcove upper bulkhead sealing Y = -0.30 .. -0.008 (strictly below Y=0!)
  const baseDoorLintel = new THREE.Mesh(
    new THREE.BoxGeometry(3.96, 0.292, 0.22),
    concreteMat
  );
  baseDoorLintel.position.set(-7.28, -0.154, 0.25);
  baseDoorLintel.receiveShadow = true;
  structureGroup.add(baseDoorLintel);

  const stairWestBulkhead = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.292, 2.24),
    concreteMat
  );
  stairWestBulkhead.position.set(-8.00, -0.154, 1.35);
  stairWestBulkhead.receiveShadow = true;
  structureGroup.add(stairWestBulkhead);

  // World-UV-scaled cracked cement liners on upper stairwell walls (replacing bedroom/living wallpapers inside stairwell)
  const addStairCementFace = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    rotY: number
  ) => {
    const face = new THREE.Mesh(makeOverlayPlane(w, h), concreteOverlayMat);
    face.position.set(x, y, z);
    face.rotation.y = rotY;
    face.receiveShadow = true;
    structureGroup.add(face);
  };
  // North stairwell face (Z = 0.335, Y = -0.30 .. 3.10)
  addStairCementFace(-5.345, 1.40, 0.335, 5.13, 3.40, 0);
  // South stairwell face (Z = 2.358, Y = -0.30 .. 3.10) — covers slab edge cleanly below Y=0
  addStairCementFace(-5.345, 1.40, 2.358, 5.13, 3.40, Math.PI);
  // Upper West stairwell face (X = -7.905, Y = -0.30 .. 3.10)
  addStairCementFace(-7.905, 1.40, 1.35, 2.04, 3.40, Math.PI / 2);
  // Upper East stairwell faces flanking the basement entry door (X = -2.785) + slab edge rim strictly below Y=0
  addStairCementFace(-2.785, 1.55, 0.555, 0.45, 3.10, -Math.PI / 2);
  addStairCementFace(-2.785, 1.55, 2.145, 0.45, 3.10, -Math.PI / 2);
  addStairCementFace(-2.785, 2.65, 1.35, 1.14, 0.90, -Math.PI / 2);
  addStairCementFace(-2.785, -0.156, 1.35, 2.04, 0.292, -Math.PI / 2);

  // =========================================================================
  // 5. MAIN CEILINGS & LIVING ROOM COVE TRAY (Toggled off in Overview Mode)
  // =========================================================================
  const addCeil = (x1: number, x2: number, z1: number, z2: number, y: number, m: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, 0.14, z2 - z1), m);
    mesh.position.set((x1 + x2) / 2, y + 0.07, (z1 + z2) / 2);
    mesh.receiveShadow = true;
    ceilingGroup.add(mesh);
  };

  addCeil(-1.22, 7.35, -10.40, -8.65, 3.1, ceilingMat);
  addCeil(-1.22, 7.35, -1.50, 0.25, 3.1, ceilingMat);
  addCeil(-1.22, 0.25, -8.65, -1.50, 3.1, ceilingMat);
  addCeil(6.00, 7.35, -8.65, -1.50, 3.1, ceilingMat);
  addCeil(0.25, 6.00, -8.65, -1.50, 3.28, ceilingMat);

  const coveBorders: [number, number, number, number, number, number][] = [
    [3.125, 3.19, -8.65, 5.86, 0.18, 0.11],
    [3.125, 3.19, -1.50, 5.86, 0.18, 0.11],
    [0.25, 3.19, -5.075, 0.11, 0.18, 7.26],
    [6.00, 3.19, -5.075, 0.11, 0.18, 7.26],
  ];
  for (const [x, y, z, w, h, d] of coveBorders) {
    const b = new THREE.Mesh(createBeveledBox(w, h, d, 0.024, 3), coveTrimMat);
    b.position.set(x, y, z);
    ceilingGroup.add(b);
  }

  // -------------------------------------------------------------------------
  // 5A-BED. BEDROOM PITCHED ATTIC GABLE ROOF (阁楼人字形屋顶, matching MiSide reference!)
  //         Spans X = -8.00 .. -1.22 (center ridge X = -4.61), Z = -6.74 .. +0.25
  //         Side eaves at Y = 3.06m rising smoothly to central ridge peak at Y = 4.30m
  // -------------------------------------------------------------------------
  {
    const bedMinX = -8.00;
    const bedMaxX = -1.22;
    const bedCenterX = (bedMinX + bedMaxX) * 0.5; // -4.61
    const bedHalfSpan = (bedMaxX - bedMinX) * 0.5; // 3.39
    const bedMinZ = -6.74;
    const bedMaxZ = 0.25;
    const bedCenterZ = (bedMinZ + bedMaxZ) * 0.5; // -3.245
    const bedLenZ = bedMaxZ - bedMinZ; // 6.99
    const eaveY = 3.06;
    const ridgeY = 4.30;
    const rise = ridgeY - eaveY; // 1.24m
    const slopeAngle = Math.atan2(rise, bedHalfSpan);
    const slopeLen = Math.hypot(bedHalfSpan, rise) + 0.14;

    // French antique-cream paneled attic ceiling material
    const atticCeilingMat = mat({
      map: textures.wainscotWhite,
      color: 0xfaf8f0,
      roughness: 0.90,
      metalness: 0.0,
      celStrength: 0.52,
    });

    const createRoofSlopeGeo = (lenX: number, thickY: number, lenZ: number) => {
      const geo = new THREE.BoxGeometry(lenX, thickY, lenZ);
      const uv = geo.attributes.uv;
      const norm = geo.attributes.normal;
      for (let i = 0; i < uv.count; i++) {
        if (Math.abs(norm.getY(i)) > 0.5) {
          uv.setXY(i, uv.getX(i) * (lenX / 1.45), uv.getY(i) * (lenZ / 2.2));
        }
      }
      uv.needsUpdate = true;
      return geo;
    };

    // West & East pitched attic roof panels meeting cleanly at ridge X = -4.61, Y = 4.30
    const slopeMidY = (eaveY + ridgeY) * 0.5 + 0.07;
    const westSlope = new THREE.Mesh(
      createRoofSlopeGeo(slopeLen, 0.14, bedLenZ + 0.16),
      atticCeilingMat
    );
    westSlope.position.set(bedCenterX - bedHalfSpan * 0.5, slopeMidY, bedCenterZ);
    westSlope.rotation.z = slopeAngle;
    westSlope.receiveShadow = true;
    ceilingGroup.add(westSlope);

    const eastSlope = new THREE.Mesh(
      createRoofSlopeGeo(slopeLen, 0.14, bedLenZ + 0.16),
      atticCeilingMat
    );
    eastSlope.position.set(bedCenterX + bedHalfSpan * 0.5, slopeMidY, bedCenterZ);
    eastSlope.rotation.z = -slopeAngle;
    eastSlope.receiveShadow = true;
    ceilingGroup.add(eastSlope);

    // Crisp white central attic ridge beam running North-South along the roof apex
    const ridgeBeam = new THREE.Mesh(
      createBeveledBox(0.11, 0.085, bedLenZ - 0.04, 0.012, 2),
      bedWainscotTrimMat
    );
    ridgeBeam.position.set(bedCenterX, ridgeY - 0.025, bedCenterZ);
    ceilingGroup.add(ridgeBeam);

    // Airtight North (Z = -6.74) & South (Z = +0.25) triangular gable end infill walls
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-bedHalfSpan - 0.04, 0);
    gableShape.lineTo(bedHalfSpan + 0.04, 0);
    gableShape.lineTo(0, rise + 0.06);
    gableShape.closePath();

    const buildGableWallGeo = () => {
      const gGeo = new THREE.ExtrudeGeometry(gableShape, {
        depth: 0.18,
        bevelEnabled: false,
      });
      gGeo.translate(0, 0, -0.09);
      // Scale UVs in world meters (1 tile = 2.0m) so bedroom wallpaper seamlessly flows into the gable triangle
      const pos = gGeo.attributes.position;
      const uv = gGeo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getX(i) + bedHalfSpan) / 2.0, (pos.getY(i) + eaveY) / 2.0);
      }
      uv.needsUpdate = true;
      return gGeo;
    };

    const northGable = new THREE.Mesh(buildGableWallGeo(), bedroomWallMat);
    northGable.position.set(bedCenterX, eaveY, bedMinZ);
    northGable.receiveShadow = true;
    ceilingGroup.add(northGable);

    const southGable = new THREE.Mesh(buildGableWallGeo(), bedroomWallMat);
    southGable.position.set(bedCenterX, eaveY, bedMaxZ);
    southGable.receiveShadow = true;
    ceilingGroup.add(southGable);

    // Angled crisp-white rake trim moldings framing the North & South gable ceiling peaks
    for (const gz of [bedMinZ + 0.105, bedMaxZ - 0.105]) {
      for (const side of [-1, 1] as const) {
        const rakeTrim = new THREE.Mesh(
          createBeveledBox(slopeLen - 0.16, 0.046, 0.042, 0.008, 2),
          bedWainscotTrimMat
        );
        rakeTrim.position.set(
          bedCenterX + side * (bedHalfSpan * 0.5),
          (eaveY + ridgeY) * 0.5 - 0.015,
          gz
        );
        rakeTrim.rotation.z = -side * slopeAngle;
        ceilingGroup.add(rakeTrim);
      }
    }
  }

  addCeil(-8.00, -2.70, 0.25, 2.45, 3.1, ceilingMat);

  // -------------------------------------------------------------------------
  // 5A. ENTRYWAY SCULPTED COFFERED WOOD-LATTICE TRAY CEILING (玄关雕琢跌级木格栅藻井天花板)
  //     Outer soffit at Y = 3.10m, recessed central tray (-6.95..-3.75 x 3.35..5.85) at Y = 3.24m
  // -------------------------------------------------------------------------
  addCeil(-8.00, -2.70, 2.45, 3.35, 3.10, ceilingMat);
  addCeil(-8.00, -2.70, 5.85, 6.74, 3.10, ceilingMat);
  addCeil(-8.00, -6.95, 3.35, 5.85, 3.10, ceilingMat);
  addCeil(-3.75, -2.70, 3.35, 5.85, 3.10, ceilingMat);
  addCeil(-6.95, -3.75, 3.35, 5.85, 3.24, ceilingMat);

  // Entryway perimeter crown molding (warm honey-oak) & Bedroom eave crown molding (crisp white along West & East eaves)
  const entrywayCrownSpecs: [number, number, number, number][] = [
    [-5.35, 2.55, 5.14, 0.056],
    [-5.35, 6.63, 5.14, 0.056],
    [-7.89, 4.59, 0.056, 4.12],
    [-2.80, 4.59, 0.056, 4.12],
  ];
  for (const [cx, cz, cw, cd] of entrywayCrownSpecs) {
    const crown = new THREE.Mesh(
      createBeveledBox(cw, 0.056, cd, 0.008, 2),
      wainscotTrimMat
    );
    crown.position.set(cx, 3.072, cz);
    ceilingGroup.add(crown);
  }
  const bedroomEaveCrownSpecs: [number, number, number, number][] = [
    [-7.89, -3.245, 0.056, 6.82],
    [-1.32, -3.245, 0.056, 6.82],
  ];
  for (const [cx, cz, cw, cd] of bedroomEaveCrownSpecs) {
    const crown = new THREE.Mesh(
      createBeveledBox(cw, 0.056, cd, 0.008, 2),
      bedWainscotTrimMat
    );
    crown.position.set(cx, 3.045, cz);
    ceilingGroup.add(crown);
  }

  // Stepped honey-oak cove border beams framing the Entryway recessed tray
  const entryTrayBorders: [number, number, number, number, number, number][] = [
    [-5.35, 3.17, 3.35, 3.32, 0.16, 0.11],
    [-5.35, 3.17, 5.85, 3.32, 0.16, 0.11],
    [-6.95, 3.17, 4.60, 0.11, 0.16, 2.60],
    [-3.75, 3.17, 4.60, 0.11, 0.16, 2.60],
  ];
  for (const [x, y, z, w, h, d] of entryTrayBorders) {
    const tb = new THREE.Mesh(createBeveledBox(w, h, d, 0.020, 3), coveTrimMat);
    tb.position.set(x, y, z);
    ceilingGroup.add(tb);
  }

  // Crossed Kumiko / Coffered Oak Beams inside the Entryway recessed tray (Y = 3.195m)
  for (const bz of [4.02, 5.18]) {
    const longBeam = new THREE.Mesh(
      createBeveledBox(3.16, 0.085, 0.075, 0.012, 2),
      coveTrimMat
    );
    longBeam.position.set(-5.35, 3.195, bz);
    ceilingGroup.add(longBeam);
  }
  for (const bx of [-6.08, -4.12]) {
    const crossBeam = new THREE.Mesh(
      createBeveledBox(0.075, 0.085, 2.46, 0.012, 2),
      coveTrimMat
    );
    crossBeam.position.set(bx, 3.195, 4.60);
    ceilingGroup.add(crossBeam);
  }
  // Fine wooden lattice ribs in the outer Entryway ceiling bays
  for (const lx of [-6.52, -5.62, -4.58, -3.92]) {
    for (const lz of [3.68, 5.52]) {
      const slat = new THREE.Mesh(
        createBeveledBox(0.028, 0.045, 0.56, 0.006, 2),
        wainscotTrimMat
      );
      slat.position.set(lx, 3.215, lz);
      ceilingGroup.add(slat);
    }
  }
  // Sculpted Octagonal Oak Ceiling Medallion above Entryway lantern (-5.10, 3.235, 4.60)
  const entryMedallionOuter = new THREE.Mesh(
    createBeveledSlab(0.86, 0.036, 0.86, 0.24, 0.010),
    coveTrimMat
  );
  entryMedallionOuter.position.set(-5.10, 3.225, 4.60);
  outlines.addOutline(entryMedallionOuter, 1.02);
  ceilingGroup.add(entryMedallionOuter);

  const entryMedallionInner = new THREE.Mesh(
    createBeveledSlab(0.62, 0.028, 0.62, 0.18, 0.008),
    wainscotMat
  );
  entryMedallionInner.position.set(-5.10, 3.205, 4.60);
  ceilingGroup.add(entryMedallionInner);

  // -------------------------------------------------------------------------
  // 5B. DINING ROOM, CORRIDOR & KITCHEN SCULPTED ARCHITECTURAL CEILINGS (餐厅与走廊雕琢吊顶)
  //     Corridor beamed ceiling (Z: 0.25..2.35 at Y=3.10) + Dining Grand Coffered Tray (Z: 2.35..6.74, tray at Y=3.26)
  // -------------------------------------------------------------------------
  // Corridor ceiling slab (X: -2.70 .. 3.18, Z: 0.25 .. 2.35)
  addCeil(-2.70, 3.18, 0.25, 2.35, 3.10, ceilingMat);
  // Dining outer soffit slabs surrounding the recessed tray (X: -1.68 .. 2.32, Z: 2.80 .. 5.72)
  addCeil(-2.70, 3.18, 2.35, 2.80, 3.10, ceilingMat);
  addCeil(-2.70, 3.18, 5.72, 6.74, 3.10, ceilingMat);
  addCeil(-2.70, -1.68, 2.80, 5.72, 3.10, ceilingMat);
  addCeil(2.32, 3.18, 2.80, 5.72, 3.10, ceilingMat);
  // Dining Recessed Central Tray Slab at Y = 3.26m
  addCeil(-1.68, 2.32, 2.80, 5.72, 3.26, ceilingMat);
  // Kitchen ceiling slab (X: 3.18 .. 7.35, Z: 0.25 .. 6.74)
  addCeil(3.18, 7.35, 0.25, 6.74, 3.10, ceilingMat);

  // Corridor Exposed Transverse Chamfered Oak Beams & Corbel Brackets (Z: 0.28 .. 2.35)
  const corrHeaderBeam = new THREE.Mesh(
    createBeveledBox(5.76, 0.11, 0.12, 0.016, 3),
    coveTrimMat
  );
  corrHeaderBeam.position.set(0.24, 3.045, 2.35);
  ceilingGroup.add(corrHeaderBeam);

  for (const bx of [-2.10, -0.58, 0.94, 2.46]) {
    const cBeam = new THREE.Mesh(
      createBeveledBox(0.10, 0.095, 2.02, 0.014, 2),
      coveTrimMat
    );
    cBeam.position.set(bx, 3.05, 1.32);
    ceilingGroup.add(cBeam);

    // Decorative stepped corbel blocks at North & South ends of each corridor beam
    for (const cz of [0.40, 2.24]) {
      const corbel = new THREE.Mesh(
        createBeveledBox(0.13, 0.08, 0.14, 0.012, 2),
        darkTrimMat
      );
      corbel.position.set(bx, 3.01, cz);
      ceilingGroup.add(corbel);
    }
  }

  // Pure American 2-Step Crisp Perimeter Crown Cornice (纯美式二阶硬朗顶角线) at Y = 3.06..3.09m
  const diningAndKitchenCrownSpecs: [number, number, number, number][] = [
    // Dining Room & Corridor
    [0.24, 0.35, 5.76, 0.072],
    [0.24, 6.63, 5.76, 0.072],
    [-2.60, 3.50, 0.072, 6.32],
    [3.07, 3.50, 0.072, 6.32],
    // Kitchen
    [5.26, 0.35, 4.02, 0.068],
    [5.26, 6.63, 4.02, 0.068],
    [3.29, 3.50, 0.068, 6.32],
    [7.24, 3.50, 0.068, 6.32],
  ];
  for (const [cx, cz, cw, cd] of diningAndKitchenCrownSpecs) {
    const dCrownUpper = new THREE.Mesh(
      new THREE.BoxGeometry(cw, 0.034, cd),
      wainscotTrimMat
    );
    dCrownUpper.position.set(cx, 3.084, cz);
    ceilingGroup.add(dCrownUpper);

    const dCrownLower = new THREE.Mesh(
      new THREE.BoxGeometry(cw > cd ? cw : cw * 0.62, 0.026, cd > cw ? cd : cd * 0.62),
      coveTrimMat
    );
    dCrownLower.position.set(cx, 3.056, cz);
    ceilingGroup.add(dCrownLower);
  }

  // Pure American Stepped Coffered Ceiling Tray (-1.68..2.32 x 2.80..5.72) with Crisp Box-Beam Grid (纯美式藻井吊顶装饰线!)
  const diningTrayBorders: [number, number, number, number, number, number][] = [
    [0.32, 3.18, 2.80, 4.12, 0.18, 0.12],
    [0.32, 3.18, 5.72, 4.12, 0.18, 0.12],
    [-1.68, 3.18, 4.26, 0.12, 0.18, 3.04],
    [2.32, 3.18, 4.26, 0.12, 0.18, 3.04],
  ];
  for (const [x, y, z, w, h, d] of diningTrayBorders) {
    const db = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), coveTrimMat);
    db.position.set(x, y, z);
    ceilingGroup.add(db);
  }

  // Crisp Stepped Inner Coffer Crown Lip + 4 Square Architectural Corner Plinths
  const diningInnerMoldings: [number, number, number, number][] = [
    [0.32, 2.87, 3.88, 0.052],
    [0.32, 5.65, 3.88, 0.052],
    [-1.61, 4.26, 0.052, 2.84],
    [2.25, 4.26, 0.052, 2.84],
  ];
  for (const [mx, mz, mw, md] of diningInnerMoldings) {
    const im = new THREE.Mesh(new THREE.BoxGeometry(mw, 0.042, md), wainscotTrimMat);
    im.position.set(mx, 3.228, mz);
    ceilingGroup.add(im);
  }
  for (const [rx, rz] of [
    [-1.56, 2.92],
    [2.20, 2.92],
    [-1.56, 5.60],
    [2.20, 5.60],
  ]) {
    const rosette = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.048, 0.18), darkTrimMat);
    rosette.position.set(rx, 3.226, rz);
    ceilingGroup.add(rosette);
  }

  // Classic American Coffered Ceiling Beams (3x2 recessed coffer grid: 2 longitudinal + 1 central cross beam + stepped soffit trim!)
  for (const bz of [3.74, 4.78]) {
    const beamX = new THREE.Mesh(new THREE.BoxGeometry(3.88, 0.072, 0.092), coveTrimMat);
    beamX.position.set(0.32, 3.224, bz);
    ceilingGroup.add(beamX);
    const beamXCap = new THREE.Mesh(new THREE.BoxGeometry(3.88, 0.020, 0.118), wainscotTrimMat);
    beamXCap.position.set(0.32, 3.184, bz);
    ceilingGroup.add(beamXCap);
  }
  for (const bx of [-0.36, 1.00]) {
    const beamZ = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.072, 2.84), coveTrimMat);
    beamZ.position.set(bx, 3.224, 4.26);
    ceilingGroup.add(beamZ);
    const beamZCap = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.020, 2.84), wainscotTrimMat);
    beamZCap.position.set(bx, 3.184, 4.26);
    ceilingGroup.add(beamZCap);
  }

  // Crisp American Stepped Square-and-Octagon Ceiling Medallion above Dining Pendant Lamp (0.32, 3.22, 4.25)
  const dinMedallionOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.46, 0.50, 0.032, 8),
    coveTrimMat
  );
  dinMedallionOuter.rotation.y = Math.PI / 8;
  dinMedallionOuter.position.set(0.32, 3.242, 4.25);
  ceilingGroup.add(dinMedallionOuter);

  const dinMedallionMid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.37, 0.028, 8),
    wainscotMat
  );
  dinMedallionMid.rotation.y = Math.PI / 8;
  dinMedallionMid.position.set(0.32, 3.222, 4.25);
  ceilingGroup.add(dinMedallionMid);

  const dinMedallionBead = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.014, 8, 20),
    brassMat
  );
  dinMedallionBead.rotation.x = Math.PI / 2;
  dinMedallionBead.position.set(0.32, 3.206, 4.25);
  ceilingGroup.add(dinMedallionBead);

  // =========================================================================
  // 6. SCULPTED CEILING LAMP FIXTURES (Proximity-Reactive Flicker Rigs)
  // =========================================================================
  const buildFlushCeilingLamp = (
    id: string,
    room: 'living' | 'kitchen' | 'entryway' | 'bedroom',
    x: number,
    ceilY: number,
    z: number,
    radius: number,
    lightColorHex: number,
    bulbColorHex: number,
    baseIntensity: number,
    dist: number,
    proximityRadius: number
  ) => {
    const fixture = new THREE.Group();
    fixture.position.set(x, ceilY, z);

    // Beveled oak mounting ring / collar against ceiling
    const collar = new THREE.Mesh(
      createBeveledSlab(radius * 2.25, 0.042, radius * 2.25, radius * 1.05, 0.012),
      darkTrimMat
    );
    collar.position.y = -0.021;
    outlines.addOutline(collar, 1.03);
    fixture.add(collar);

    // Frosted milk-glass diffuser dome
    const bulbMat = new THREE.MeshBasicMaterial({ color: bulbColorHex });
    const diffuser = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.88, radius * 0.76, 0.075, 20),
      bulbMat
    );
    diffuser.position.y = -0.068;
    outlines.addOutline(diffuser, 1.035);
    fixture.add(diffuser);

    // Decorative brass center finial cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.028, 0.018, 12),
      darkTrimMat
    );
    cap.position.y = -0.108;
    fixture.add(cap);

    ceilingGroup.add(fixture);

    // Room PointLight with soft sub-linear decay (0.90) & wide radius for uniform, hotspot-free room illumination
    const light = new THREE.PointLight(lightColorHex, baseIntensity * 0.85, dist * 1.45, 0.90);
    light.position.set(x, ceilY - 0.38, z);
    scene.add(light);

    registerCeilingLamp({
      id,
      room,
      position: new THREE.Vector3(x, ceilY - 0.1, z),
      light,
      bulbMaterials: [bulbMat],
      baseIntensity,
      proximityRadius,
    });
  };

  // Living Room recessed tray subtle warm-white ambient emitter (concealed cleanly inside the vintage fan brass canopy)
  {
    const livBulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8 });
    const livCanopyGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.006, 12),
      livBulbMat
    );
    livCanopyGlow.position.set(3.12, 3.276, -5.08);
    ceilingGroup.add(livCanopyGlow);

    const livLight = new THREE.PointLight(0xfff5e4, 0.58 * 0.85, 12.0 * 1.45, 0.90);
    livLight.position.set(3.12, 3.00, -5.08);
    scene.add(livLight);

    registerCeilingLamp({
      id: 'lamp_living',
      room: 'living',
      position: new THREE.Vector3(3.12, 3.18, -5.08),
      light: livLight,
      bulbMaterials: [livBulbMat],
      baseIntensity: 0.58,
      proximityRadius: 5.0,
    });
  }

  // Kitchen Crafted Honey-Oak Wood, Brushed-Brass & Frosted Opal-Glass Semi-Flush Ceiling Lamp
  {
    const kx = 5.25;
    const ky = 3.10;
    const kz = 3.60;
    const kitLamp = new THREE.Group();
    kitLamp.position.set(kx, ky, kz);

    const kitWoodMat = mat({
      map: textures.furnitureOak,
      bumpMap: textures.furnitureWoodBump,
      bumpScale: 0.005,
      color: 0xe6bc88,
      roughness: 0.44,
      metalness: 0.02,
      woodLacquer: 0.52,
    });
    const kitBrassMat = mat({
      color: 0xdca452,
      roughness: 0.24,
      metalness: 0.86,
      envMapIntensity: 1.35,
    });
    const kitOpalGlassMat = mat({
      color: 0xfff8ee,
      emissive: new THREE.Color(0xffe6c4),
      emissiveIntensity: 0.46,
      roughness: 0.26,
      metalness: 0.04,
      transparent: true,
      opacity: 0.94,
    });
    const kitBulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2dc });

    // Soft ceiling contact shadow halo around mounting canopy
    const ceilShadow = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.34, 28),
      new THREE.MeshBasicMaterial({
        color: 0x1a1424,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      })
    );
    ceilShadow.rotation.x = Math.PI / 2;
    ceilShadow.position.y = -0.003;
    kitLamp.add(ceilShadow);

    // Stepped turned brushed-brass ceiling canopy & short stem
    const canopyOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.142, 0.026, 24),
      kitWoodMat
    );
    canopyOuter.position.y = -0.014;
    kitLamp.add(canopyOuter);

    const canopyBrass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.104, 0.022, 20),
      kitBrassMat
    );
    canopyBrass.position.y = -0.036;
    kitLamp.add(canopyBrass);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.085, 14),
      kitBrassMat
    );
    stem.position.y = -0.082;
    kitLamp.add(stem);

    // Sculpted beveled honey-oak wooden outer halo ring (Torus + stepped wooden collar)
    const woodDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.248, 0.264, 0.072, 28, 1, true),
      kitWoodMat
    );
    woodDrum.material.side = THREE.DoubleSide;
    woodDrum.position.y = -0.145;
    outlines.addOutline(woodDrum, 1.022);
    kitLamp.add(woodDrum);

    for (const [ry, rad] of [
      [-0.108, 0.248],
      [-0.181, 0.264],
    ] as const) {
      const woodBead = new THREE.Mesh(
        new THREE.TorusGeometry(rad, 0.011, 10, 28),
        kitWoodMat
      );
      woodBead.rotation.x = Math.PI / 2;
      woodBead.position.y = ry;
      kitLamp.add(woodBead);
    }

    // 4 Radial Brushed-Brass Mounting Brackets connecting stem to wooden shade ring
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.245, 0.009, 0.014),
        kitBrassMat
      );
      strut.position.set(Math.cos(ang) * 0.125, -0.114, Math.sin(ang) * 0.125);
      strut.rotation.y = -ang;
      kitLamp.add(strut);

      const clip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.024, 8),
        kitBrassMat
      );
      clip.position.set(Math.cos(ang) * 0.258, -0.145, Math.sin(ang) * 0.258);
      kitLamp.add(clip);
    }

    // Stepped frosted opal-glass diffuser dome + warm glowing inner core
    const diffuserBowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.232, 24, 14, 0, Math.PI * 2, Math.PI * 0.50, Math.PI * 0.50),
      kitOpalGlassMat
    );
    diffuserBowl.scale.set(1, 0.52, 1);
    diffuserBowl.position.y = -0.132;
    kitLamp.add(diffuserBowl);

    const innerGlowCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 16, 12),
      kitBulbMat
    );
    innerGlowCore.scale.set(1, 0.56, 1);
    innerGlowCore.position.y = -0.152;
    kitLamp.add(innerGlowCore);

    // Bottom brass accent ring & turned finial knob
    const lowerBrassRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.228, 0.006, 8, 28),
      kitBrassMat
    );
    lowerBrassRing.rotation.x = Math.PI / 2;
    lowerBrassRing.position.y = -0.186;
    kitLamp.add(lowerBrassRing);

    const finial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.008, 0.028, 12),
      kitBrassMat
    );
    finial.position.y = -0.258;
    kitLamp.add(finial);

    ceilingGroup.add(kitLamp);

    const kitLight = new THREE.PointLight(0xfff1dc, 0.90 * 0.85, 10.5 * 1.45, 0.90);
    kitLight.position.set(kx, ky - 0.42, kz);
    scene.add(kitLight);

    registerCeilingLamp({
      id: 'lamp_kitchen',
      room: 'kitchen',
      position: new THREE.Vector3(kx, ky - 0.14, kz),
      light: kitLight,
      bulbMaterials: [kitBulbMat],
      baseIntensity: 0.90,
      proximityRadius: 4.2,
    });
  }

  // Entryway warm Japanese ceiling lantern (mounted on the sculpted Entryway ceiling medallion at Y = 3.20m)
  buildFlushCeilingLamp(
    'lamp_entryway',
    'entryway',
    -5.10,
    3.20,
    4.60,
    0.22,
    0xffbf9b,
    0xf5d5b8,
    0.82,
    8.8,
    3.8
  );

  // Bedroom MiSide Pastel-Pink Conical Pendant Lamp hanging down from the pitched attic roof!
  {
    const bx = -4.25;
    // Height on East roof slope at bx = -4.25 (0.36m East of ridge X = -4.61)
    const roofSlopeRad = Math.atan2(1.24, 3.39);
    const by = 4.30 - (Math.abs(bx - -4.61) / 3.39) * 1.24; // ~4.17m
    const bz = -3.35;
    const cordLen = 1.38;
    const shadeY = -cordLen - 0.125;
    const pendant = new THREE.Group();
    pendant.position.set(bx, by, bz);

    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.082, 0.036, 16),
      bedWainscotTrimMat
    );
    canopy.position.y = -0.01;
    canopy.rotation.z = -roofSlopeRad;
    pendant.add(canopy);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, cordLen, 8),
      mat({ color: 0x3b313c, roughness: 0.75 })
    );
    cord.position.y = -cordLen * 0.5;
    pendant.add(cord);

    const socketCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.052, 0.068, 16),
      mat({ color: 0xd8b46e, roughness: 0.42, metalness: 0.48 })
    );
    socketCap.position.y = -cordLen;
    pendant.add(socketCap);

    const shadeOuterMat = mat({
      color: 0x8fb08c,
      roughness: 0.62,
      metalness: 0.04,
      side: THREE.FrontSide,
    });
    const shadeOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.285, 0.21, 24, 1, true),
      shadeOuterMat
    );
    shadeOuter.position.y = shadeY;
    outlines.addOutline(shadeOuter, 1.03);
    pendant.add(shadeOuter);

    const shadeInnerMat = new THREE.MeshBasicMaterial({
      color: 0xfcf5e6,
      side: THREE.BackSide,
    });
    const shadeInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.280, 0.205, 24, 1, true),
      shadeInnerMat
    );
    shadeInner.position.y = shadeY;
    pendant.add(shadeInner);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff8ec });
    const bulbSphere = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), bulbMat);
    bulbSphere.position.y = shadeY - 0.025;
    pendant.add(bulbSphere);

    ceilingGroup.add(pendant);

    const bedCeilLight = new THREE.PointLight(0xfff4e2, 0.82 * 0.85, 9.5 * 1.45, 0.90);
    bedCeilLight.position.set(bx, by + shadeY - 0.10, bz);
    scene.add(bedCeilLight);

    registerCeilingLamp({
      id: 'lamp_bedroom',
      room: 'bedroom',
      position: new THREE.Vector3(bx, by + shadeY - 0.02, bz),
      light: bedCeilLight,
      bulbMaterials: [bulbMat, shadeInnerMat],
      baseIntensity: 0.82,
      proximityRadius: 4.0,
    });
  }

  // Two bright warm-white Stairwell Wall Sconces lighting the descent (switch off on special blackout!)
  for (const [idx, sx, sy] of [
    [1, -3.85, 0.55],
    [2, -6.90, -1.55],
  ] as const) {
    const sconce = new THREE.Group();
    sconce.position.set(sx, sy, 2.34);

    const backplate = new THREE.Mesh(
      createBeveledBox(0.14, 0.22, 0.035, 0.008, 2),
      darkTrimMat
    );
    sconce.add(backplate);

    const sconceBulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3dc });
    const globe = new THREE.Mesh(
      createBeveledBox(0.11, 0.14, 0.08, 0.015, 2),
      sconceBulbMat
    );
    globe.userData.dynamic = true;
    globe.position.z = -0.055;
    outlines.addOutline(globe, 1.03);
    sconce.add(globe);
    structureGroup.add(sconce);

    const sLight = new THREE.PointLight(0xffe7c2, 1.75, 9.0, 1.4);
    sLight.position.set(sx, sy - 0.04, 2.06);
    scene.add(sLight);
    registerCeilingLamp({
      id: `lamp_stair_${idx}`,
      room: 'basement',
      position: new THREE.Vector3(sx, sy, 2.06),
      light: sLight,
      bulbMaterials: [sconceBulbMat],
      baseIntensity: 1.75,
      dimColorHex: 0x3b222a,
      proximityRadius: 3.6,
    });
  }

  // Merge all static architectural walls, floors, windows, wainscoting & wood trims in structureGroup and ceilingGroup
  mergeStaticGroupToSingleMesh(structureGroup, outlines, 'ApartmentStructureMergedMesh');
  mergeStaticGroupToSingleMesh(ceilingGroup, outlines, 'ApartmentCeilingMergedMesh');
}
