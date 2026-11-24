import * as THREE from 'three';
import {
  createBeveledBox,
  createBeveledSlab,
  createDrapedCurtainGeometry,
  createTyndallShaftClusterGeometry,
} from '../geometries';
import {
  createTyndallBeamShaderMaterial,
  createWindowEmissiveMaterial,
  createWindowGoboShaderMaterial,
} from '../pipeline';
import { mergeStaticGroupToSingleMesh } from '../SceneManager';
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
  // Unified Entryway, Dining & Kitchen wall material matching Living Room wallpaper & color seamlessly
  const diningWallMat = mat({
    map: textures.wallpaperLiving,
    color: 0xfff8fa,
    roughness: 0.94,
    metalness: 0.0,
    celStrength: 0.56,
  });
  // Bright warm honey-wood wainscoting (matte clay/gouache finish, zero gloss)
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
  // MiSide Bedroom Crisp Creamy-White Painted Beadboard Wainscoting & Architectural Trim
  const bedWainscotMat = mat({
    map: textures.wainscotWhite,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.0,
    celStrength: 0.52,
  });
  const bedWainscotTrimMat = mat({
    color: 0xfffaf8,
    roughness: 0.78,
    metalness: 0.0,
    celStrength: 0.50,
  });
  const trimMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xfff4e0,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.46,
  });
  const darkTrimMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xf4ddb9,
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
    color: 0xfff5e2,
    roughness: 0.62,
    metalness: 0.0,
    woodLacquer: 0.42,
  });

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
  addWall('wall_n_win_top', -4.65, 2.7, -6.74, 1.90, 0.8, wallThick, bedroomWallMat);

  // South Wall: Entryway section (X: -8.09 .. -2.80) extends down to Y=-0.14 to seal sunken Genkan (-0.08m) cleanly!
  const H_GENKAN = H + 0.14;
  const Y_GENKAN_WALL = (H - 0.14) / 2;
  addWall('wall_s_entry', -5.445, Y_GENKAN_WALL, 6.74, 5.29, H_GENKAN, wallThick, livingWallMat);
  addWall('wall_s_dinkit', 2.22, H / 2, 6.74, 10.22, H, wallThick, diningWallMat);

  // West Wall: Bedroom & Stairwell (Z: -6.83 .. 2.53) -> bedroomWallMat; Entryway (Z: 2.36 .. 6.83) extends down to Y=-0.14 so daylight never bleeds under baseboard!
  addWall('wall_w_bed', -8.00, H / 2, -2.15, wallThick, H, 9.36, bedroomWallMat);
  addWall('wall_w_entry_n', -8.00, Y_GENKAN_WALL, 3.20, wallThick, H_GENKAN, 1.68, livingWallMat);
  addWall('wall_w_entry_s', -8.00, Y_GENKAN_WALL, 5.995, wallThick, H_GENKAN, 1.67, livingWallMat);
  addWall('wall_w_entry_hdr', -8.00, 2.69, 4.60, wallThick, 0.82, 1.14, livingWallMat);

  // East Wall: Kitchen section (Z: 0.33 .. 6.83) -> diningWallMat (meets wall_liv_din_e cleanly without overlap)
  addWall('wall_e_s_kitchen', 7.35, H / 2, 3.58, wallThick, H, 6.50, diningWallMat);

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
  // 2B. BEDROOM NORTH WINDOW: MISIDE CRISP WHITE CASEMENT WINDOW, SOFT WHITE
  //     PLEATED CURTAINS, SILL FLOWERS & TEDDY BEAR + GLOWING CRESCENT MOON
  // =========================================================================
  const bedWinGroup = new THREE.Group();
  bedWinGroup.name = 'BedroomSlidingWindow';
  bedWinGroup.position.set(-4.65, 0, -6.69);
  structureGroup.add(bedWinGroup);

  // Exterior luminous window glass backdrop with night-state 50% Bloom reduction & darkening overlay
  const bedGlassMat = createWindowEmissiveMaterial(uniforms, 0xfff0ec, 0.92);
  const bedGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.88, 1.40), bedGlassMat);
  bedGlass.position.set(-4.65, 1.60, -6.80);
  bedGlass.userData.dynamic = true;
  structureGroup.add(bedGlass);
  windowGlowMeshes.push(bedGlass);

  // Bedroom North Window Anisotropic Scattering Tyndall Shaft (shorter reach, silky soft diffuse gradient!)
  const bedTyndallGeo = createTyndallShaftClusterGeometry(
    2.85,
    1.78,
    0.92,
    2.28,
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

  // Crisp creamy-white molded window sill, apron, header & side casings
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

  const bedHeader = new THREE.Mesh(
    createBeveledSlab(2.14, 0.062, 0.28, 0.032, 0.014),
    bedWainscotTrimMat
  );
  bedHeader.position.set(0, 2.315, 0.03);
  bedHeader.castShadow = true;
  outlines.addOutline(bedHeader, 1.018);
  bedWinGroup.add(bedHeader);

  for (const bx of [-0.97, 0.97]) {
    const sideCasing = new THREE.Mesh(
      createBeveledBox(0.092, 1.44, 0.24, 0.015, 3),
      bedWainscotTrimMat
    );
    sideCasing.position.set(bx, 1.60, 0.02);
    sideCasing.castShadow = true;
    bedWinGroup.add(sideCasing);
  }

  // Clean white 2x2 casement window sashes & muntin grid (matching MiSide Screenshot 3!)
  for (const [sashX, sashZ] of [
    [-0.455, -0.025],
    [0.455, -0.025],
  ] as const) {
    const sashGroup = new THREE.Group();
    sashGroup.position.set(sashX, 1.605, sashZ);
    const sashW = 0.92;
    const sashH = 1.32;
    for (const ry of [-sashH / 2 + 0.025, sashH / 2 - 0.025]) {
      const hRail = new THREE.Mesh(
        createBeveledBox(sashW, 0.048, 0.034, 0.008, 2),
        bedWainscotTrimMat
      );
      hRail.position.y = ry;
      sashGroup.add(hRail);
    }
    for (const rx of [-sashW / 2 + 0.025, sashW / 2 - 0.025]) {
      const vStile = new THREE.Mesh(
        createBeveledBox(0.048, sashH - 0.04, 0.034, 0.008, 2),
        bedWainscotTrimMat
      );
      vStile.position.x = rx;
      sashGroup.add(vStile);
    }
    const midBar = new THREE.Mesh(
      createBeveledBox(sashW - 0.08, 0.028, 0.024, 0.005, 2),
      bedWainscotTrimMat
    );
    sashGroup.add(midBar);
    bedWinGroup.add(sashGroup);
  }

  // Slim white curtain rod + finials + rings + soft white pleated flanking curtains
  const curtainRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 2.52, 12),
    bedWainscotTrimMat
  );
  curtainRod.rotation.z = Math.PI / 2;
  curtainRod.position.set(0, 2.38, 0.145);
  bedWinGroup.add(curtainRod);

  for (const fx of [-1.27, 1.27]) {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), bedWainscotTrimMat);
    finial.position.set(fx, 2.38, 0.145);
    bedWinGroup.add(finial);
    const bracket = new THREE.Mesh(
      createBeveledBox(0.024, 0.055, 0.11, 0.006, 2),
      bedWainscotTrimMat
    );
    bracket.position.set(fx * 0.90, 2.365, 0.095);
    bedWinGroup.add(bracket);
  }

  const bedCurtainMat = mat({
    map: textures.plushFabric,
    color: 0xfff8f9,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.DoubleSide,
    windSway: 0.34,
  });
  const bedCurtainGeo = createDrapedCurtainGeometry(0.56, 1.78, 0.075, 5.0);
  for (const side of [-1, 1] as const) {
    const curtain = new THREE.Mesh(bedCurtainGeo, bedCurtainMat);
    curtain.position.set(side * 0.98, 1.49, 0.145);
    curtain.castShadow = true;
    curtain.receiveShadow = true;
    curtain.userData.dynamic = true;
    bedWinGroup.add(curtain);

    for (let r = 0; r < 5; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.021, 0.004, 8, 14),
        bedWainscotTrimMat
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(side * (0.74 + r * 0.115), 2.38, 0.145);
      bedWinGroup.add(ring);
    }
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
    map: textures.wallpaperLiving,
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
  addWall('wall_entry_stair', -5.355, Y_GENKAN_WALL, 2.45, 5.47, H_GENKAN, 0.16, livingWallMat);

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

    // Subtle crisp white paneled attic ceiling material
    const atticCeilingMat = mat({
      map: textures.wainscotWhite,
      color: 0xf7f4fb,
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

  // Dining Room & Kitchen Perimeter Crown Molding (顶角线, matching 0.056m width & light-oak color) at Y = 3.072m
  const diningAndKitchenCrownSpecs: [number, number, number, number][] = [
    // Dining Room & Corridor
    [0.24, 0.35, 5.76, 0.056],
    [0.24, 6.63, 5.76, 0.056],
    [-2.60, 3.50, 0.056, 6.32],
    [3.07, 3.50, 0.056, 6.32],
    // Kitchen
    [5.26, 0.35, 4.02, 0.056],
    [5.26, 6.63, 4.02, 0.056],
    [3.29, 3.50, 0.056, 6.32],
    [7.24, 3.50, 0.056, 6.32],
  ];
  for (const [cx, cz, cw, cd] of diningAndKitchenCrownSpecs) {
    const dCrown = new THREE.Mesh(
      createBeveledBox(cw, 0.056, cd, 0.008, 2),
      wainscotTrimMat
    );
    dCrown.position.set(cx, 3.072, cz);
    ceilingGroup.add(dCrown);
  }

  // Double-Stepped Honey-Oak Cove Cornice Framing the Dining Room Recessed Tray (-1.68..2.32 x 2.80..5.72)
  const diningTrayBorders: [number, number, number, number, number, number][] = [
    [0.32, 3.18, 2.80, 4.12, 0.18, 0.12],
    [0.32, 3.18, 5.72, 4.12, 0.18, 0.12],
    [-1.68, 3.18, 4.26, 0.12, 0.18, 3.04],
    [2.32, 3.18, 4.26, 0.12, 0.18, 3.04],
  ];
  for (const [x, y, z, w, h, d] of diningTrayBorders) {
    const db = new THREE.Mesh(createBeveledBox(w, h, d, 0.022, 3), coveTrimMat);
    db.position.set(x, y, z);
    ceilingGroup.add(db);
  }

  // Inner decorative step molding + 4 Corner Rosette Blocks inside the Dining Tray
  const diningInnerMoldings: [number, number, number, number][] = [
    [0.32, 2.88, 3.84, 0.06],
    [0.32, 5.64, 3.84, 0.06],
    [-1.60, 4.26, 0.06, 2.80],
    [2.24, 4.26, 0.06, 2.80],
  ];
  for (const [mx, mz, mw, md] of diningInnerMoldings) {
    const im = new THREE.Mesh(
      createBeveledBox(mw, 0.048, md, 0.010, 2),
      wainscotTrimMat
    );
    im.position.set(mx, 3.225, mz);
    ceilingGroup.add(im);
  }
  for (const [rx, rz] of [
    [-1.52, 2.96],
    [2.16, 2.96],
    [-1.52, 5.56],
    [2.16, 5.56],
  ]) {
    const rosette = new THREE.Mesh(
      createBeveledSlab(0.22, 0.042, 0.22, 0.06, 0.010),
      darkTrimMat
    );
    rosette.position.set(rx, 3.235, rz);
    ceilingGroup.add(rosette);
  }

  // Crossed Architectural Coffer Ribs & Sculpted Layered Ceiling Medallion (雕花圆形灯盘) at (0.32, 3.25, 4.25)
  const dinCrossRibX = new THREE.Mesh(
    createBeveledBox(3.84, 0.055, 0.085, 0.012, 2),
    coveTrimMat
  );
  dinCrossRibX.position.set(0.32, 3.232, 4.25);
  ceilingGroup.add(dinCrossRibX);

  const dinCrossRibZ = new THREE.Mesh(
    createBeveledBox(0.085, 0.055, 2.80, 0.012, 2),
    coveTrimMat
  );
  dinCrossRibZ.position.set(0.32, 3.232, 4.25);
  ceilingGroup.add(dinCrossRibZ);

  // Outer carved oak ring + inner cream plaster rose medallion above Dining Pendant Lamp
  const dinMedallionOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.56, 0.036, 28),
    coveTrimMat
  );
  dinMedallionOuter.position.set(0.32, 3.242, 4.25);
  outlines.addOutline(dinMedallionOuter, 1.02);
  ceilingGroup.add(dinMedallionOuter);

  const dinMedallionMid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.41, 0.032, 24),
    wainscotMat
  );
  dinMedallionMid.position.set(0.32, 3.222, 4.25);
  ceilingGroup.add(dinMedallionMid);

  const dinMedallionBead = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.016, 10, 24),
    brassMat
  );
  dinMedallionBead.rotation.x = Math.PI / 2;
  dinMedallionBead.position.set(0.32, 3.204, 4.25);
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
    const livBulbMat = new THREE.MeshBasicMaterial({ color: 0xfff4e2 });
    const livCanopyGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.006, 12),
      livBulbMat
    );
    livCanopyGlow.position.set(3.12, 3.276, -5.08);
    ceilingGroup.add(livCanopyGlow);

    const livLight = new THREE.PointLight(0xfff2dc, 0.58 * 0.85, 12.0 * 1.45, 0.90);
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
      mat({ color: 0xec829e, roughness: 0.55 })
    );
    socketCap.position.y = -cordLen;
    pendant.add(socketCap);

    const shadeOuterMat = mat({
      color: 0xf48da8,
      roughness: 0.56,
      metalness: 0.05,
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
      color: 0xffd7e3,
      side: THREE.BackSide,
    });
    const shadeInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.280, 0.205, 24, 1, true),
      shadeInnerMat
    );
    shadeInner.position.y = shadeY;
    pendant.add(shadeInner);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff8fa });
    const bulbSphere = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), bulbMat);
    bulbSphere.position.y = shadeY - 0.025;
    pendant.add(bulbSphere);

    ceilingGroup.add(pendant);

    const bedCeilLight = new THREE.PointLight(0xffe4ec, 0.82 * 0.85, 9.5 * 1.45, 0.90);
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
