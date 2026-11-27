import * as THREE from 'three';
import {
  createBeveledBox,
  createBeveledSlab,
  createButterflyCurtainGeometry,
  createCopperKnobGeometry,
  createCraftedCabinetFront,
  createCurvedChairBackrestGeometry,
  createDrapedCurtainGeometry,
  createDrapedTableclothGeometry,
  createMoldedDrawerFront,
  createPlushBox,
  createRetroPillowedSlabGeometry,
  createSplayedLegMesh,
  createTableclothLaceTrimGeometry,
  createTaperedCurveGeometry,
  createTurnedLegGeometry,
  createTyndallShaftClusterGeometry,
} from '../geometries';
import {
  createArchitecturalGlassMaterial,
  createTyndallBeamShaderMaterial,
  createWindowEmissiveMaterial,
  createWindowGoboShaderMaterial,
} from '../pipeline';
import { mergeStaticGroupToSingleMesh } from '../SceneManager';
import { apartmentColorStudio } from '../devColorStudio';
import {
  createTabletopPenSet,
  createTabletopTrinketCluster,
  type RoomBuildContext,
} from './roomContext';
import {
  addContactShadow,
  createApplianceEnamelTexture,
  createBottleLabelTexture,
  createKitchenCounterTextures,
  createMicrowaveDisplayTexture,
  createMicrowaveMeshGlassTexture,
  createOvenDisplayTexture,
  createOvenMittTexture,
  createPlaidTowelTexture,
} from './kitchenCraftHelpers';

const _instPos = new THREE.Vector3();
const _instEuler = new THREE.Euler();
const _instQuat = new THREE.Quaternion();
const _instScale = new THREE.Vector3(1, 1, 1);
const _instMat = new THREE.Matrix4();
const _localMat = new THREE.Matrix4();
const _parentMat = new THREE.Matrix4();

function setInstanceTransform(
  instMesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1
): void {
  _instPos.set(x, y, z);
  _instEuler.set(rx, ry, rz);
  _instQuat.setFromEuler(_instEuler);
  _instScale.set(sx, sy, sz);
  _instMat.compose(_instPos, _instQuat, _instScale);
  instMesh.setMatrixAt(index, _instMat);
}

function finalizeInstancedMesh(instMesh: THREE.InstancedMesh): void {
  instMesh.instanceMatrix.needsUpdate = true;
  if (instMesh.instanceColor) {
    instMesh.instanceColor.needsUpdate = true;
  }
  instMesh.computeBoundingSphere();
}

export function buildDiningAndKitchen(ctx: RoomBuildContext): void {
  const {
    scene,
    sceneManager,
    ceilingGroup,
    uniforms,
    textures,
    outlines,
    volumetricRays,
    windowGlowMeshes,
    clockRigs,
    mat,
    addBoxCollider,
    registerInteractable,
    registerCabinetDoor,
    registerCeilingLamp,
    registerAmbientProp,
  } = ctx;

  const diningGroup = new THREE.Group();
  diningGroup.name = 'DiningRoom';
  scene.add(diningGroup);
  sceneManager.registerRoomGroup('dining', diningGroup);

  const kitchenGroup = new THREE.Group();
  kitchenGroup.name = 'KitchenRoom';
  scene.add(kitchenGroup);
  sceneManager.registerRoomGroup('kitchen', kitchenGroup);

  // Clear luminous golden-honey MiSide wood furniture & cabinet materials with tactile grain relief
  const oakMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.0072,
    color: 0xfff5e4,
    roughness: 0.54,
    metalness: 0.0,
    woodLacquer: 0.58,
  });
  const darkWoodMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.0072,
    color: 0xeed2aa,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
  });
  // Recessed Shaker center wood panel & routed bevel shadow wood materials
  const woodPanelMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.0064,
    color: 0xfffaf0,
    roughness: 0.56,
    metalness: 0.0,
    woodLacquer: 0.54,
  });
  const woodMoldingMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.0065,
    color: 0xf4dec0,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
  });
  const woodGrooveMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.006,
    color: 0xd9b282,
    roughness: 0.66,
    metalness: 0.0,
    woodLacquer: 0.36,
  });
  // Warm burnished copper-brass material for round cabinet knobs & vintage kitchen pulls (铜黄金属质感)
  const copperBrassMat = mat({
    color: 0xd99a48,
    roughness: 0.22,
    metalness: 0.88,
    envMapIntensity: 1.38,
    celStrength: 0.34,
    rimScale: 1.32,
  });
  // Procedural Kitchen PBR Micro-Textures (quartz-speckled countertop, satin enamel, LED screens, printed labels)
  const counterTexPair = createKitchenCounterTextures();
  const applianceEnamelTex = createApplianceEnamelTexture();
  const ovenDisplayTex = createOvenDisplayTexture();
  const mwDisplayTex = createMicrowaveDisplayTexture();
  const mwMeshGlassTex = createMicrowaveMeshGlassTexture();
  const ovenMittTex = createOvenMittTexture();
  const plaidTowelTex = createPlaidTowelTexture();

  // Brushed satin-chrome cabinet arch pulls matching MiSide's crisp silver pulls on warm honey-oak doors
  const cabinetPullChromeMat = mat({
    map: textures.brushedSteel,
    color: 0xe6eaf2,
    roughness: 0.18,
    metalness: 0.90,
    envMapIntensity: 1.45,
    celStrength: 0.30,
    rimScale: 1.38,
  });
  const aoRecessMat = mat({
    color: 0x3b2a22,
    roughness: 0.92,
    metalness: 0.0,
  });
  const applianceCreamMat = mat({
    map: applianceEnamelTex,
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.06,
    envMapIntensity: 0.85,
  });
  const applianceTrimMat = mat({
    map: applianceEnamelTex,
    color: 0xf2e6da,
    roughness: 0.38,
    metalness: 0.08,
  });

  const creamMat = mat({ color: 0xfff8f4, roughness: 0.28, metalness: 0.04, envMapIntensity: 0.85 });
  const seatFabricMat = mat({ color: 0xb69ad0, roughness: 0.94, metalness: 0.0 });
  const steelMat = mat({
    map: textures.brushedSteel,
    bumpMap: textures.brushedSteel,
    bumpScale: 0.0025,
    color: 0xd8dce6,
    roughness: 0.24,
    metalness: 0.82,
    envMapIntensity: 1.32,
  });
  const brushedSinkMetalMat = mat({
    map: textures.brushedSteel,
    bumpMap: textures.brushedSteel,
    bumpScale: 0.003,
    color: 0xcfd4de,
    roughness: 0.22,
    metalness: 0.86,
    envMapIntensity: 1.38,
  });
  const sinkInnerMetalMat = mat({
    map: textures.brushedSteel,
    bumpMap: textures.brushedSteel,
    bumpScale: 0.0035,
    color: 0x9ea5b4,
    roughness: 0.28,
    metalness: 0.80,
    envMapIntensity: 1.15,
  });
  const darkIronMat = mat({ color: 0x262230, roughness: 0.34, metalness: 0.68 });
  const counterTopMat = mat({
    map: counterTexPair.map,
    bumpMap: counterTexPair.bumpMap,
    bumpScale: 0.0022,
    color: 0xffffff,
    roughness: 0.30,
    metalness: 0.04,
    envMapIntensity: 0.85,
  });
  // Warm creamy ivory-yellow (米白色偏黄) glossy vintage enamel refrigerator material
  const fridgeMat = mat({
    color: 0xf6e6c0,
    roughness: 0.19,
    metalness: 0.05,
    envMapIntensity: 1.28,
    rimScale: 1.34,
    celStrength: 0.56,
  });
  const fridgeTrimMat = mat({
    color: 0xe9d5a8,
    roughness: 0.30,
    metalness: 0.06,
    celStrength: 0.52,
  });
  const retroChromeMat = mat({
    color: 0xf0f4fc,
    roughness: 0.13,
    metalness: 0.92,
    envMapIntensity: 1.5,
    celStrength: 0.28,
    rimScale: 1.45,
  });
  const cavityDarkMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0x8a6448,
    roughness: 0.78,
    metalness: 0.0,
    woodLacquer: 0.28,
  });
  // High-fidelity crystal-clear cabinet glass with delicate smoked-grey perimeter edge (zero harsh white borders!)
  const cabinetGlassMat = createArchitecturalGlassMaterial(uniforms, {
    tintHex: 0xe6eaee,
    edgeTintHex: 0x5d656f,
    baseOpacity: 0.05,
    maxFresnelOpacity: 0.34,
    bevelWidth: 0.018,
    bevelStrength: 0.14,
  });
  // Light-green linen tablecloth with red & dark-green small floral vine pattern + scalloped ivory lace hem
  const tableclothMat = mat({
    map: textures.tableclothPink,
    bumpMap: textures.plushBump,
    bumpScale: 0.006,
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const tableclothLaceMat = new THREE.MeshStandardMaterial({
    map: textures.tableclothLaceTrim,
    color: 0xfffcf6,
    roughness: 0.86,
    metalness: 0.0,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
  });
  // Moss green (青苔绿) plush fabric for dining chair cushions
  const grassGreenCushionMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.008,
    color: 0x647d43,
    roughness: 0.86,
    metalness: 0.0,
  });
  const backsplashTileMat = mat({
    map: textures.kitchenBacksplashTile,
    bumpMap: textures.kitchenTileBump,
    bumpScale: 0.005,
    color: 0xf2e4f6,
    roughness: 0.24,
    metalness: 0.08,
  });

  // =========================================================================
  // 1. DINING TABLE + SCULPTED PORCELAIN TEAPOT & CUPS (Table 1.17x, Chairs 1.04x at X = 0.12, Z = 4.08)
  // =========================================================================
  const DINING_TABLE_SCALE = 1.3 * 0.9; // 1.17 (0.9x of previous 1.3x)
  const DINING_CHAIR_SCALE = 1.3 * 0.8; // 1.04 (0.8x of previous 1.3x)
  const DINING_CX = 0.12;
  const DINING_CZ = 4.08;

  const table = new THREE.Group();
  table.position.set(DINING_CX, 0, DINING_CZ);
  table.scale.setScalar(DINING_TABLE_SCALE);

  const top = new THREE.Mesh(
    createBeveledSlab(1.58, 0.034, 1.00, 0.045, 0.008),
    oakMat
  );
  top.position.y = 0.758;
  top.castShadow = true;
  top.receiveShadow = true;
  outlines.addOutline(top, 1.014);
  table.add(top);

  // Under-table color-blocked white utility drawers on front & back aprons with raised molding lines
  const apronLong = createBeveledBox(1.26, 0.065, 0.035, 0.008, 2);
  for (const az of [-0.36, 0.36]) {
    const r = new THREE.Mesh(apronLong, darkWoodMat);
    r.position.set(0, 0.695, az);
    table.add(r);
  }
  const tableDrawer = createMoldedDrawerFront(
    0.44,
    0.058,
    0.022,
    'z',
    woodPanelMat,
    woodMoldingMat,
    steelMat,
    -1
  );
  tableDrawer.position.set(0, 0.695, -0.375);
  table.add(tableDrawer);

  const apronShort = createBeveledBox(0.035, 0.065, 0.72, 0.008, 2);
  for (const ax of [-0.63, 0.63]) {
    const r = new THREE.Mesh(apronShort, darkWoodMat);
    r.position.set(ax, 0.695, 0);
    table.add(r);
  }

  const diningLegGeo = createTurnedLegGeometry(0.024, 0.015, 0.735);
  for (const [lx, lz] of [
    [-0.64, -0.37],
    [0.64, -0.37],
    [-0.64, 0.37],
    [0.64, 0.37],
  ]) {
    const leg = createSplayedLegMesh(
      diningLegGeo,
      oakMat,
      lx,
      0.725,
      lz,
      0.735,
      0.13,
      0.11
    );
    table.add(leg);
  }

  // Light-Green Red & Dark-Green Floral Vine Draped Tablecloth + Delicate Scalloped Ivory Lace Trim Hem
  const tableclothGeo = createDrapedTableclothGeometry(1.58, 1.00, 0.22);
  const tableclothMesh = new THREE.Mesh(tableclothGeo, tableclothMat);
  tableclothMesh.position.y = 0.776;
  tableclothMesh.castShadow = true;
  tableclothMesh.receiveShadow = true;
  table.add(tableclothMesh);

  const tableclothLaceGeo = createTableclothLaceTrimGeometry(1.58, 1.00, 0.22, 0.056);
  const tableclothLaceMesh = new THREE.Mesh(tableclothLaceGeo, tableclothLaceMat);
  tableclothLaceMesh.position.y = 0.776;
  tableclothLaceMesh.castShadow = false;
  tableclothLaceMesh.receiveShadow = true;
  table.add(tableclothLaceMesh);

  // Wooden Coaster Tray with Twin Glass/Chrome Salt & Pepper Shakers in Center of Table (Screenshot 1)
  const shakerTrayGroup = new THREE.Group();
  shakerTrayGroup.position.set(-0.22, 0.784, 0.04);
  const shakerTray = new THREE.Mesh(
    createBeveledSlab(0.18, 0.016, 0.12, 0.02, 0.004),
    oakMat
  );
  shakerTray.castShadow = true;
  shakerTrayGroup.add(shakerTray);
  for (const [sx, sCol] of [
    [-0.04, 0xfaf8fc],
    [0.04, 0x9c8274],
  ] as const) {
    const shakerBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.026, 0.068, 14),
      mat({ color: sCol, roughness: 0.22, metalness: 0.08 })
    );
    shakerBody.position.set(sx, 0.042, 0);
    shakerBody.castShadow = true;
    outlines.addOutline(shakerBody, 1.04);
    shakerTrayGroup.add(shakerBody);
    const shakerCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      brushedSinkMetalMat
    );
    shakerCap.position.set(sx, 0.075, 0);
    shakerTrayGroup.add(shakerCap);
  }
  table.add(shakerTrayGroup);

  // Sculpted Multi-Part Porcelain Teapot (Lathe body + lid + S-spout + C-handle)
  const teapotGroup = new THREE.Group();
  teapotGroup.position.set(0.08, 0.785, -0.02);
  const potProfile = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.058, 0),
    new THREE.Vector2(0.095, 0.055),
    new THREE.Vector2(0.092, 0.105),
    new THREE.Vector2(0.052, 0.145),
    new THREE.Vector2(0.056, 0.155),
    new THREE.Vector2(0.022, 0.168),
    new THREE.Vector2(0.0008, 0.168),
  ];
  const teapotBody = new THREE.Mesh(
    new THREE.LatheGeometry(potProfile, 22),
    creamMat
  );
  teapotBody.castShadow = true;
  outlines.addOutline(teapotBody, 1.05);
  teapotGroup.add(teapotBody);

  const finialKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 12, 10),
    creamMat
  );
  finialKnob.position.y = 0.178;
  teapotGroup.add(finialKnob);

  const spoutPts = [
    new THREE.Vector3(0.075, 0.055, 0),
    new THREE.Vector3(0.125, 0.085, 0),
    new THREE.Vector3(0.145, 0.14, 0),
    new THREE.Vector3(0.16, 0.15, 0),
  ];
  const spout = new THREE.Mesh(
    createTaperedCurveGeometry(spoutPts, 0.018, 0.009, 14, 8),
    creamMat
  );
  teapotGroup.add(spout);

  const handlePts = [
    new THREE.Vector3(-0.068, 0.13, 0),
    new THREE.Vector3(-0.13, 0.12, 0),
    new THREE.Vector3(-0.125, 0.055, 0),
    new THREE.Vector3(-0.072, 0.04, 0),
  ];
  const potHandle = new THREE.Mesh(
    createTaperedCurveGeometry(handlePts, 0.011, 0.01, 14, 8),
    creamMat
  );
  teapotGroup.add(potHandle);
  table.add(teapotGroup);

  // 2 Lathe Teacups + Saucers + Tea Liquid
  const saucerPts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.045, 0),
    new THREE.Vector2(0.068, 0.014),
    new THREE.Vector2(0.062, 0.018),
    new THREE.Vector2(0.04, 0.006),
    new THREE.Vector2(0.0008, 0.006),
  ];
  const cupPts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.028, 0),
    new THREE.Vector2(0.042, 0.058),
    new THREE.Vector2(0.038, 0.06),
    new THREE.Vector2(0.024, 0.006),
    new THREE.Vector2(0.0008, 0.006),
  ];
  const saucerGeo = new THREE.LatheGeometry(saucerPts, 18);
  const cupGeo = new THREE.LatheGeometry(cupPts, 18);

  for (const cx of [-0.32, 0.36]) {
    const cupSet = new THREE.Group();
    cupSet.position.set(cx, 0.785, 0.08);
    const saucer = new THREE.Mesh(saucerGeo, creamMat);
    saucer.castShadow = true;
    cupSet.add(saucer);
    const cup = new THREE.Mesh(cupGeo, creamMat);
    cup.position.y = 0.006;
    cup.castShadow = true;
    outlines.addOutline(cup, 1.05);
    cupSet.add(cup);
    const teaSurface = new THREE.Mesh(
      new THREE.CircleGeometry(0.036, 14),
      mat({ color: 0x7a2e2e, roughness: 0.15 })
    );
    teaSurface.rotation.x = -Math.PI / 2;
    teaSurface.position.y = 0.052;
    cupSet.add(teaSurface);
    table.add(cupSet);
  }

  // Lived-In Prop on Dining Table 1: Tall Iced Peach-Tea Glass with Bent Drinking Straw (插上吸管的饮料)
  const dinDrinkGroup = new THREE.Group();
  dinDrinkGroup.position.set(-0.52, 0.785, -0.18);
  const dinGlassMat = mat({
    color: 0xebf4fa,
    roughness: 0.16,
    metalness: 0.05,
    transparent: true,
    opacity: 0.60,
  });
  const tallGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.033, 0.135, 16),
    dinGlassMat
  );
  tallGlass.position.y = 0.068;
  tallGlass.castShadow = true;
  outlines.addOutline(tallGlass, 1.05);
  dinDrinkGroup.add(tallGlass);

  const peachTeaLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.037, 0.030, 0.102, 14),
    mat({ color: 0xd97b38, roughness: 0.2 })
  );
  peachTeaLiquid.position.y = 0.055;
  dinDrinkGroup.add(peachTeaLiquid);

  const dinStrawPts = [
    new THREE.Vector3(0.005, 0.02, 0.0),
    new THREE.Vector3(-0.008, 0.142, 0.006),
    new THREE.Vector3(-0.015, 0.175, 0.012),
    new THREE.Vector3(-0.048, 0.192, 0.028),
  ];
  const dinStraw = new THREE.Mesh(
    createTaperedCurveGeometry(dinStrawPts, 0.0052, 0.0052, 14, 8),
    mat({ color: 0x4ecdc4, roughness: 0.35 })
  );
  dinStraw.castShadow = true;
  dinDrinkGroup.add(dinStraw);
  table.add(dinDrinkGroup);

  // Lived-In Prop on Dining Table 2: Tabletop Soy Sauce Cruet & Pepper Mill (餐桌酱料调味品)
  const tableCondiments = new THREE.Group();
  tableCondiments.position.set(0.48, 0.785, -0.20);
  const soyCruetPts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.032, 0),
    new THREE.Vector2(0.034, 0.052),
    new THREE.Vector2(0.018, 0.088),
    new THREE.Vector2(0.022, 0.105),
    new THREE.Vector2(0.0008, 0.105),
  ];
  const soyCruet = new THREE.Mesh(
    new THREE.LatheGeometry(soyCruetPts, 16),
    mat({ color: 0x3b1f1a, roughness: 0.24, metalness: 0.08 })
  );
  soyCruet.castShadow = true;
  outlines.addOutline(soyCruet, 1.05);
  tableCondiments.add(soyCruet);

  const soyCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.023, 0.018, 12),
    mat({ color: 0xc93838, roughness: 0.4 })
  );
  soyCap.position.y = 0.108;
  tableCondiments.add(soyCap);

  const pepperMill = new THREE.Mesh(
    createTurnedLegGeometry(0.022, 0.025, 0.115),
    darkWoodMat
  );
  pepperMill.position.set(0.075, 0.058, 0.03);
  pepperMill.castShadow = true;
  outlines.addOutline(pepperMill, 1.05);
  tableCondiments.add(pepperMill);
  table.add(tableCondiments);

  diningGroup.add(table);
  addBoxCollider(
    'col_dining_table',
    DINING_CX,
    0.45 * DINING_TABLE_SCALE,
    DINING_CZ,
    1.65 * DINING_TABLE_SCALE,
    0.9 * DINING_TABLE_SCALE,
    1.15 * DINING_TABLE_SCALE
  );

  // Dining Table Pen, Pencil & Coin Trinkets + Ambient Registration (worldPos accounts for table scale)
  const { penGroup: dinPen, pencilGroup: dinPencil } = createTabletopPenSet(ctx, 0x2d5a4c, true);
  dinPen.position.set(-0.18, 0.785, -0.24);
  dinPen.rotation.y = -0.34;
  table.add(dinPen);
  registerAmbientProp({
    id: 'din_table_pen',
    room: 'dining',
    mesh: dinPen,
    worldPos: [
      DINING_CX - 0.18 * DINING_TABLE_SCALE,
      0.785 * DINING_TABLE_SCALE,
      DINING_CZ - 0.24 * DINING_TABLE_SCALE,
    ],
    kind: 'roller',
    maxDrift: 0.036,
    rollRadius: 0.0056,
    rollAxis: 'x',
    reactivity: 1.30,
  });

  if (dinPencil) {
    dinPencil.position.set(-0.12, 0.785, -0.29);
    dinPencil.rotation.y = -0.68;
    table.add(dinPencil);
    registerAmbientProp({
      id: 'din_table_pencil',
      room: 'dining',
      mesh: dinPencil,
      worldPos: [
        DINING_CX - 0.12 * DINING_TABLE_SCALE,
        0.785 * DINING_TABLE_SCALE,
        DINING_CZ - 0.29 * DINING_TABLE_SCALE,
      ],
      kind: 'roller',
      maxDrift: 0.034,
      rollRadius: 0.0046,
      rollAxis: 'x',
      reactivity: 1.24,
    });
  }

  const dinTrinkets = createTabletopTrinketCluster(ctx, 'coins_tag');
  dinTrinkets.position.set(0.16, 0.785, 0.24);
  dinTrinkets.rotation.y = 0.42;
  table.add(dinTrinkets);
  registerAmbientProp({
    id: 'din_table_trinkets',
    room: 'dining',
    mesh: dinTrinkets,
    worldPos: [
      DINING_CX + 0.16 * DINING_TABLE_SCALE,
      0.785 * DINING_TABLE_SCALE,
      DINING_CZ + 0.24 * DINING_TABLE_SCALE,
    ],
    kind: 'trinket',
    maxDrift: 0.028,
    reactivity: 1.18,
  });

  registerAmbientProp({
    id: 'din_table_drink',
    room: 'dining',
    mesh: dinDrinkGroup,
    worldPos: [
      DINING_CX - 0.52 * DINING_TABLE_SCALE,
      0.785 * DINING_TABLE_SCALE,
      DINING_CZ - 0.18 * DINING_TABLE_SCALE,
    ],
    kind: 'wobble',
    maxDrift: 0.018,
    reactivity: 0.94,
  });
  registerAmbientProp({
    id: 'din_table_condiments',
    room: 'dining',
    mesh: tableCondiments,
    worldPos: [
      DINING_CX + 0.48 * DINING_TABLE_SCALE,
      0.785 * DINING_TABLE_SCALE,
      DINING_CZ - 0.20 * DINING_TABLE_SCALE,
    ],
    kind: 'wobble',
    maxDrift: 0.016,
    reactivity: 0.88,
  });

  // =========================================================================
  // 2. 4 HIGH-CRAFT SCULPTED DINING CHAIRS (Curved Wrap Backrest + Matte Oiled Solid Oak + Woven Wool-Linen Cushion, ZERO Plastic Look!)
  // =========================================================================
  // Dedicated high-resolution hand-rubbed matte oiled oak wood texture & bump (告别塑料感!)
  const chairWoodTex = (() => {
    const W = 512;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx2d = c.getContext('2d')!;
    const bc = document.createElement('canvas');
    bc.width = W;
    bc.height = H;
    const bctx = bc.getContext('2d')!;

    const base = ctx2d.createLinearGradient(0, 0, W, H);
    base.addColorStop(0.0, '#d8a87e');
    base.addColorStop(0.5, '#cc986d');
    base.addColorStop(1.0, '#c28d62');
    ctx2d.fillStyle = base;
    ctx2d.fillRect(0, 0, W, H);
    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, W, H);

    // Rich organic oak grain bands & fine medullary wood pores
    for (let x = 0; x < W; x += 2) {
      const wave = Math.sin((x / W) * Math.PI * 14) * 0.5 + Math.sin((x / W) * Math.PI * 34 + 1.1) * 0.25;
      ctx2d.fillStyle =
        wave > 0
          ? `rgba(248, 224, 196, ${(wave * 0.14).toFixed(3)})`
          : `rgba(88, 52, 28, ${(-wave * 0.18).toFixed(3)})`;
      ctx2d.fillRect(x, 0, 2, H);
      const bv = Math.round(128 + wave * 36);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x, 0, 2, H);
    }
    for (let i = 0; i < 2600; i++) {
      const px = (i * 197 + 19) % W;
      const py = (i * 331 + 23) % H;
      ctx2d.fillStyle = i % 2 === 0 ? 'rgba(72, 42, 22, 0.11)' : 'rgba(250, 232, 206, 0.06)';
      ctx2d.fillRect(px, py, 1.5, 8 + (i % 9));
      bctx.fillStyle = i % 2 === 0 ? 'rgba(54, 54, 54, 0.35)' : 'rgba(198, 198, 198, 0.22)';
      bctx.fillRect(px, py, 1.5, 8 + (i % 9));
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    const bumpMap = new THREE.CanvasTexture(bc);
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    return { map, bumpMap };
  })();

  const chairOiledOakMat = mat({
    map: chairWoodTex.map,
    bumpMap: chairWoodTex.bumpMap,
    bumpScale: 0.012,
    color: 0xffffff,
    roughness: 0.80, // Matte hand-rubbed oiled oak — ZERO plastic glare!
    metalness: 0.0,
    woodLacquer: 0.08,
    celStrength: 0.44,
  });

  // Rich tactile woven moss-green linen-wool seat cushion (high roughness, real weave bump!)
  const chairWovenCushionMat = mat({
    map: textures.rugWeave,
    bumpMap: textures.plushBump,
    bumpScale: 0.020,
    color: 0x677e48,
    roughness: 0.95,
    metalness: 0.0,
    rimScale: 1.24,
    celStrength: 0.42,
  });

  const chairSeatGeo = createPlushBox(0.42, 0.044, 0.42, 0.022, 0.08);
  const chairFrameGeo = createBeveledSlab(0.44, 0.026, 0.44, 0.032, 0.007);
  const chairBackGeo = createCurvedChairBackrestGeometry(0.45, 0.148, 0.026, 0.068, 20);
  const chairSpindleGeo = new THREE.CylinderGeometry(0.0095, 0.0115, 0.35, 10);
  const chairLegGeo = createTurnedLegGeometry(0.018, 0.0115, 0.44);

  const chairFramesInst = new THREE.InstancedMesh(chairFrameGeo, chairOiledOakMat, 4);
  chairFramesInst.castShadow = true;
  chairFramesInst.receiveShadow = true;

  const chairCushionsInst = new THREE.InstancedMesh(chairSeatGeo, chairWovenCushionMat, 4);
  chairCushionsInst.castShadow = true;
  chairCushionsInst.receiveShadow = true;

  const chairBackRailsInst = new THREE.InstancedMesh(chairBackGeo, chairOiledOakMat, 4);
  chairBackRailsInst.castShadow = true;
  chairBackRailsInst.receiveShadow = true;

  const chairSpindlesInst = new THREE.InstancedMesh(chairSpindleGeo, chairOiledOakMat, 20);
  chairSpindlesInst.castShadow = true;

  const chairLegsInst = new THREE.InstancedMesh(chairLegGeo, chairOiledOakMat, 16);
  chairLegsInst.castShadow = true;

  const chairOffsets: [number, number, number][] = [
    [-0.46 * DINING_TABLE_SCALE, -0.72 * DINING_TABLE_SCALE, 0],
    [0.46 * DINING_TABLE_SCALE, -0.72 * DINING_TABLE_SCALE, 0],
    [-0.46 * DINING_TABLE_SCALE, 0.72 * DINING_TABLE_SCALE, Math.PI],
    [0.46 * DINING_TABLE_SCALE, 0.72 * DINING_TABLE_SCALE, Math.PI],
  ];

  let spindleIdx = 0;
  let chairLegIdx = 0;

  for (let cIdx = 0; cIdx < chairOffsets.length; cIdx++) {
    const [cx, cz, rot] = chairOffsets[cIdx];
    const worldX = DINING_CX + cx;
    const worldZ = DINING_CZ + cz;

    _instPos.set(worldX, 0, worldZ);
    _instEuler.set(0, rot, 0);
    _instQuat.setFromEuler(_instEuler);
    _instScale.set(DINING_CHAIR_SCALE, DINING_CHAIR_SCALE, DINING_CHAIR_SCALE);
    _parentMat.compose(_instPos, _instQuat, _instScale);

    setInstanceTransform(
      chairFramesInst,
      cIdx,
      worldX,
      0.435 * DINING_CHAIR_SCALE,
      worldZ,
      0,
      rot,
      0,
      DINING_CHAIR_SCALE,
      DINING_CHAIR_SCALE,
      DINING_CHAIR_SCALE
    );

    setInstanceTransform(
      chairCushionsInst,
      cIdx,
      worldX,
      0.468 * DINING_CHAIR_SCALE,
      worldZ,
      0,
      rot,
      0,
      DINING_CHAIR_SCALE,
      DINING_CHAIR_SCALE,
      DINING_CHAIR_SCALE
    );

    _instPos.set(0, 0.825, -0.195);
    _instEuler.set(-0.07, 0, 0);
    _instQuat.setFromEuler(_instEuler);
    _instScale.set(1, 1, 1);
    _localMat.compose(_instPos, _instQuat, _instScale);
    _instMat.multiplyMatrices(_parentMat, _localMat);
    chairBackRailsInst.setMatrixAt(cIdx, _instMat);

    const spindleXs = [-0.175, -0.088, 0, 0.088, 0.175];
    for (const sx of spindleXs) {
      const u = sx / 0.225;
      const arcZ = -0.215 + 0.056 * (u * u);
      _instPos.set(sx, 0.625, arcZ);
      _instEuler.set(-0.065, 0, -u * 0.035);
      _instQuat.setFromEuler(_instEuler);
      _localMat.compose(_instPos, _instQuat, _instScale);
      _instMat.multiplyMatrices(_parentMat, _localMat);
      chairSpindlesInst.setMatrixAt(spindleIdx++, _instMat);
    }

    for (const [lx, lz] of [
      [-0.16, -0.16],
      [0.16, -0.16],
      [-0.16, 0.16],
      [0.16, 0.16],
    ]) {
      const signX = lx < 0 ? -1 : 1;
      const signZ = lz < 0 ? -1 : 1;
      const rZ = signX * 0.13;
      const rX = -signZ * 0.13;
      _instPos.set(
        lx + signX * Math.sin(0.13) * (0.44 * 0.45),
        0.43 - 0.44 / 2,
        lz + signZ * Math.sin(0.13) * (0.44 * 0.45)
      );
      _instEuler.set(rX, 0, rZ);
      _instQuat.setFromEuler(_instEuler);
      _localMat.compose(_instPos, _instQuat, _instScale);
      _instMat.multiplyMatrices(_parentMat, _localMat);
      chairLegsInst.setMatrixAt(chairLegIdx++, _instMat);
    }
  }

  finalizeInstancedMesh(chairFramesInst);
  finalizeInstancedMesh(chairCushionsInst);
  finalizeInstancedMesh(chairBackRailsInst);
  finalizeInstancedMesh(chairSpindlesInst);
  finalizeInstancedMesh(chairLegsInst);

  diningGroup.add(
    chairFramesInst,
    chairCushionsInst,
    chairBackRailsInst,
    chairSpindlesInst,
    chairLegsInst
  );

  // =========================================================================
  // 3. INDUSTRIAL BRUSHED-SILVER DOME PENDANT LAMPS (Dining + Kitchen Island, Screenshot 1!)
  // =========================================================================
  const shadeOuterMat = mat({
    map: textures.brushedSteel,
    color: 0xe6eaf2,
    roughness: 0.24,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });
  const shadeInnerMat = mat({
    color: 0xfff3de,
    emissive: new THREE.Color(0xffc994),
    emissiveIntensity: 0.35,
    roughness: 0.38,
    side: THREE.DoubleSide,
  });
  const pendantBulbMat = new THREE.MeshBasicMaterial({ color: 0xffd8ab });

  const buildDomePendant = (px: number, py: number, pz: number) => {
    const pGroup = new THREE.Group();
    pGroup.position.set(px, py, pz);

    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 0.042, 16),
      darkIronMat
    );
    canopy.position.y = 0.95;
    pGroup.add(canopy);

    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.92, 8),
      darkIronMat
    );
    cord.position.y = 0.50;
    pGroup.add(cord);

    const bellCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.056, 0.058, 18),
      oakMat
    );
    bellCap.position.y = 0.205;
    pGroup.add(bellCap);

    const brassNeckRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.006, 8, 20),
      copperBrassMat
    );
    brassNeckRing.rotation.x = Math.PI / 2;
    brassNeckRing.position.y = 0.176;
    pGroup.add(brassNeckRing);

    const domePts = [
      new THREE.Vector2(0.045, 0.175),
      new THREE.Vector2(0.145, 0.152),
      new THREE.Vector2(0.235, 0.082),
      new THREE.Vector2(0.264, 0.008),
      new THREE.Vector2(0.258, 0.0),
      new THREE.Vector2(0.240, 0.0),
    ];
    const domeShade = new THREE.Mesh(
      new THREE.LatheGeometry(domePts, 28),
      shadeOuterMat
    );
    domeShade.castShadow = true;
    outlines.addOutline(domeShade, 1.026);
    pGroup.add(domeShade);

    const shadeRimLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.254, 0.0065, 8, 28),
      copperBrassMat
    );
    shadeRimLip.rotation.x = Math.PI / 2;
    shadeRimLip.position.y = 0.003;
    pGroup.add(shadeRimLip);

    const innerReflector = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.23, 0.05, 22, 1, true),
      shadeInnerMat
    );
    innerReflector.position.y = 0.02;
    pGroup.add(innerReflector);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.046, 14, 14),
      pendantBulbMat
    );
    bulb.position.y = 0.01;
    pGroup.add(bulb);
    ceilingGroup.add(pGroup);
  };

  // Align Dining Dome Pendant strictly with the sculpted ceiling medallion center (0.32, 3.204, 4.25)
  const DINING_CEIL_CX = 0.32;
  const DINING_CEIL_CZ = 4.25;
  buildDomePendant(DINING_CEIL_CX, 2.254, DINING_CEIL_CZ);

  const diningLight = new THREE.PointLight(0xffcfa8, 0.86, 13.5, 0.90);
  diningLight.position.set(DINING_CEIL_CX, 2.15, DINING_CEIL_CZ);
  scene.add(diningLight);

  registerCeilingLamp({
    id: 'lamp_dining',
    room: 'dining',
    position: new THREE.Vector3(DINING_CEIL_CX, 2.23, DINING_CEIL_CZ),
    light: diningLight,
    bulbMaterials: [pendantBulbMat],
    baseIntensity: 0.86,
    proximityRadius: 4.2,
  });

  // =========================================================================
  // 4. AMERICAN SIDEBOARD MATCHING LIVING ROOM FURNITURE (参考客厅美式餐边柜：齐平直角框 + 上三抽弧形拉环 + 下中空冷灰玻璃双格门!)
  // =========================================================================
  const sideboard = new THREE.Group();
  sideboard.position.set(0.32, 0, 6.38);

  const sbBronzeMat = mat({ color: 0x4c3a2d, roughness: 0.34, metalness: 0.78 });
  const sbBrassMat = mat({ color: 0xdcb46c, roughness: 0.36, metalness: 0.70 });
  const sbGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x708090,
    roughness: 0.06,
    metalness: 0.14,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  // Helper: Flush 90° flat-recessed Shaker drawer/door front facing -Z (matching Living Room sideboard!)
  const buildDiningShakerFront = (w: number, h: number, style: 'bail' | 'ring'): THREE.Group => {
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(w - 0.004, h - 0.004, 0.012), darkWoodMat);
    back.position.z = 0.004;
    g.add(back);
    const rH = Math.min(0.028, h * 0.20);
    const sW = Math.min(0.038, w * 0.12);
    for (const ry of [-(h - rH) * 0.5, (h - rH) * 0.5]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, rH, 0.018), oakMat);
      r.position.set(0, ry, -0.001);
      g.add(r);
    }
    for (const sx of [-(w - sW) * 0.5, (w - sW) * 0.5]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(sW, h, 0.018), oakMat);
      st.position.set(sx, 0, -0.001);
      g.add(st);
    }
    if (style === 'bail') {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.036, 0.006, -0.010),
        new THREE.Vector3(-0.020, -0.012, -0.018),
        new THREE.Vector3(0, -0.016, -0.020),
        new THREE.Vector3(0.020, -0.012, -0.018),
        new THREE.Vector3(0.036, 0.006, -0.010),
      ]);
      const bail = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.0036, 8, false), sbBronzeMat);
      g.add(bail);
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0034, 8, 14), sbBrassMat);
      ring.position.set(0, -0.004, -0.012);
      g.add(ring);
    }
    return g;
  };

  // Single clean solid-wood back panel + top drawer deck + hollow center display cavity with shelf!
  const sbBack = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.70, 0.020), darkWoodMat);
  sbBack.position.set(0, 0.48, 0.21);
  sideboard.add(sbBack);
  const sbTopDeck = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.16, 0.42), darkWoodMat);
  sbTopDeck.position.set(0, 0.74, 0);
  sideboard.add(sbTopDeck);
  const sbFloor = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.020, 0.42), darkWoodMat);
  sbFloor.position.set(0, 0.145, 0);
  sideboard.add(sbFloor);
  for (const dx of [-0.42, 0.42]) {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.52, 0.41), oakMat);
    div.position.set(dx, 0.405, 0);
    sideboard.add(div);
  }
  const sbShelf = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.018, 0.37), oakMat);
  sbShelf.position.set(0, 0.40, 0.01);
  sideboard.add(sbShelf);

  // Crisp sharp-edged 3-step American crown top & stepped base plinth
  const sbTop = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.030, 0.50), oakMat);
  sbTop.position.y = 0.855;
  sbTop.castShadow = true;
  sbTop.receiveShadow = true;
  sideboard.add(sbTop);
  const sbCrownCove = new THREE.Mesh(new THREE.BoxGeometry(1.73, 0.018, 0.47), darkWoodMat);
  sbCrownCove.position.y = 0.831;
  sideboard.add(sbCrownCove);

  const sbPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.026, 0.48), oakMat);
  sbPlinth.position.y = 0.125;
  sbPlinth.castShadow = true;
  sideboard.add(sbPlinth);
  const sbPlinthSkirt = new THREE.Mesh(new THREE.BoxGeometry(1.70, 0.018, 0.45), darkWoodMat);
  sbPlinthSkirt.position.y = 0.102;
  sideboard.add(sbPlinthSkirt);

  for (const sx of [-0.83, 0.83]) {
    const sideW = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.70, 0.44), oakMat);
    sideW.position.set(sx, 0.48, 0);
    sideboard.add(sideW);
  }

  // Top 3 Flush Drawers (Left narrow + Center wide + Right narrow) with Antique-Bronze Bail Drop-Pulls
  for (const [dx, dw] of [
    [-0.61, 0.36],
    [0, 0.78],
    [0.61, 0.36],
  ] as const) {
    const drw = buildDiningShakerFront(dw, 0.145, 'bail');
    drw.position.set(dx, 0.742, -0.215);
    sideboard.add(drw);
  }

  // Lower Row: Outer Solid Flush-Framed Interactive Doors + Center Twin Cool-Gray Glass Mullioned Doors!
  for (const [idx, dx] of [
    [0, -0.61],
    [2, 0.61],
  ] as const) {
    const hingeSide: -1 | 1 = dx < 0 ? -1 : 1;
    const customDoor = buildDiningShakerFront(0.36, 0.49, 'ring');
    registerCabinetDoor({
      id: `din_sideboard_door_${idx}`,
      label: idx === 0 ? '餐边柜左柜门' : '餐边柜右柜门',
      room: 'dining',
      parent: sideboard,
      centerX: dx,
      centerY: 0.402,
      centerZ: -0.215,
      width: 0.36,
      height: 0.49,
      thickness: 0.020,
      facingAxis: 'z',
      facingSign: -1,
      hingeSide,
      openSign: (-hingeSide) as -1 | 1,
      doorMat: darkWoodMat,
      moldingMat: oakMat,
      handleMat: sbBronzeMat,
      customDoorGroup: customDoor,
    });
  }
  for (const gx of [-0.20, 0.20]) {
    const gDoor = new THREE.Group();
    gDoor.position.set(gx, 0.402, -0.215);
    const dw = 0.38;
    const dh = 0.49;
    const fW = 0.036;
    for (const ry of [-(dh - fW) * 0.5, (dh - fW) * 0.5]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(dw, fW, 0.018), oakMat);
      r.position.set(0, ry, -0.001);
      gDoor.add(r);
    }
    for (const sx of [-(dw - fW) * 0.5, (dw - fW) * 0.5]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(fW, dh, 0.018), oakMat);
      st.position.set(sx, 0, -0.001);
      gDoor.add(st);
    }
    const pane = new THREE.Mesh(new THREE.BoxGeometry(dw - fW * 1.8, dh - fW * 1.8, 0.005), sbGlassMat);
    gDoor.add(pane);
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.011, dh - fW * 1.8, 0.010), oakMat);
    vBar.position.z = -0.003;
    gDoor.add(vBar);
    for (const hy of [-0.072, 0.072]) {
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(dw - fW * 1.8, 0.011, 0.010), oakMat);
      hBar.position.set(0, hy, -0.003);
      gDoor.add(hBar);
    }
    const gKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.008, 0.014, 8), sbBronzeMat);
    gKnob.rotation.x = Math.PI / 2;
    gKnob.position.set(gx < 0 ? 0.155 : -0.155, 0.01, -0.014);
    gDoor.add(gKnob);
    sideboard.add(gDoor);
  }

  const sbLegGeo = createTurnedLegGeometry(0.030, 0.016, 0.095);
  for (const lx of [-0.76, 0.76]) {
    for (const lz of [-0.18, 0.18]) {
      const leg = new THREE.Mesh(sbLegGeo, darkWoodMat);
      leg.position.set(lx, 0.048, lz);
      leg.castShadow = true;
      sideboard.add(leg);
    }
  }

  // Beveled Picture Frame on Sideboard
  const photoGroup = new THREE.Group();
  photoGroup.position.set(-0.42, 0.99, 0);
  photoGroup.rotation.set(0.18, 0.24, 0);
  const photoOuter = new THREE.Mesh(
    createBeveledBox(0.24, 0.3, 0.032, 0.01, 3),
    oakMat
  );
  photoOuter.castShadow = true;
  outlines.addOutline(photoOuter, 1.05);
  photoGroup.add(photoOuter);
  const photoCanvas = new THREE.Mesh(
    createBeveledBox(0.18, 0.24, 0.036, 0.004, 2),
    mat({ color: 0x3b2c44, roughness: 0.7 })
  );
  photoGroup.add(photoCanvas);
  sideboard.add(photoGroup);

  // White Ceramic Pitcher Vase with Pink Rose Bouquet on right side of sideboard (Screenshot 2!)
  const bowlGroup = new THREE.Group();
  bowlGroup.position.set(0.38, 0.862, 0);
  const pitcherPts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.056, 0),
    new THREE.Vector2(0.072, 0.08),
    new THREE.Vector2(0.046, 0.15),
    new THREE.Vector2(0.058, 0.19),
    new THREE.Vector2(0.050, 0.19),
    new THREE.Vector2(0.038, 0.14),
    new THREE.Vector2(0.0008, 0.02),
  ];
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pitcherPts, 18), creamMat);
  bowl.castShadow = true;
  outlines.addOutline(bowl, 1.04);
  bowlGroup.add(bowl);

  const roseLeafMat = mat({ color: 0x4e8a5c, roughness: 0.62, windSway: 0.55 });
  const roseBloomMat = mat({ color: 0xf27d9c, roughness: 0.52, windSway: 0.55 });
  for (const [rx, ry, rz] of [
    [-0.024, 0.23, 0.014],
    [0.026, 0.25, -0.012],
    [0.002, 0.27, 0.022],
  ] as const) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.10, 6),
      roseLeafMat
    );
    stem.position.set(rx * 0.6, ry - 0.04, rz * 0.6);
    bowlGroup.add(stem);
    const rose = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.028, 1),
      roseBloomMat
    );
    rose.position.set(rx, ry, rz);
    rose.castShadow = true;
    outlines.addOutline(rose, 1.05);
    bowlGroup.add(rose);
  }
  sideboard.add(bowlGroup);

  diningGroup.add(sideboard);
  addBoxCollider('col_sideboard', 0.32, 0.45, 6.38, 1.76, 0.9, 0.5);

  // =========================================================================
  // 4B. LOW WOODEN BENCH WITH PLUSH BROWN TEDDY BEAR, FLOATING BOOK LEDGE,
  //     BLUE WALL CLOCK & PASTEL-PINK TIED-BACK DINING CURTAINS (Screenshot 2!)
  // =========================================================================
  const teddyBenchGroup = new THREE.Group();
  teddyBenchGroup.position.set(-1.05, 0, 6.36);

  const tbSeat = new THREE.Mesh(
    createBeveledSlab(0.58, 0.028, 0.36, 0.024, 0.007),
    oakMat
  );
  tbSeat.position.y = 0.42;
  tbSeat.castShadow = true;
  tbSeat.receiveShadow = true;
  outlines.addOutline(tbSeat, 1.022);
  teddyBenchGroup.add(tbSeat);

  const tbLegGeo = createTurnedLegGeometry(0.018, 0.012, 0.41, 10);
  for (const [lx, lz] of [
    [-0.22, -0.12],
    [0.22, -0.12],
    [-0.22, 0.12],
    [0.22, 0.12],
  ] as const) {
    const leg = createSplayedLegMesh(
      tbLegGeo,
      oakMat,
      lx,
      0.41,
      lz,
      0.41,
      0.12,
      0.10
    );
    teddyBenchGroup.add(leg);
  }

  // 3D Sculpted Plush Brown Teddy Bear sitting on the bench (Screenshot 2!)
  const teddyGroup = new THREE.Group();
  teddyGroup.position.set(0, 0.435, 0.02);
  teddyGroup.rotation.y = 0.18;
  const teddyFurMat = mat({
    map: textures.sofaTuftMap,
    bumpMap: textures.sofaTuftBump,
    bumpScale: 0.008,
    color: 0x8f5838,
    roughness: 0.88,
  });
  const teddyMuzzleMat = mat({ color: 0xe6c7a8, roughness: 0.78 });

  const teddyTorso = new THREE.Mesh(
    createPlushBox(0.22, 0.25, 0.18, 0.08, 0.16),
    teddyFurMat
  );
  teddyTorso.position.y = 0.125;
  teddyTorso.castShadow = true;
  outlines.addOutline(teddyTorso, 1.035);
  teddyGroup.add(teddyTorso);

  const teddyBelly = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 14, 12),
    teddyMuzzleMat
  );
  teddyBelly.scale.set(1.0, 1.15, 0.45);
  teddyBelly.position.set(0, 0.12, -0.075);
  teddyGroup.add(teddyBelly);

  const teddyHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 16, 14),
    teddyFurMat
  );
  teddyHead.scale.set(1.06, 0.98, 0.96);
  teddyHead.position.set(0, 0.31, -0.01);
  teddyHead.castShadow = true;
  outlines.addOutline(teddyHead, 1.035);
  teddyGroup.add(teddyHead);

  const teddySnout = new THREE.Mesh(
    new THREE.SphereGeometry(0.044, 12, 10),
    teddyMuzzleMat
  );
  teddySnout.scale.set(1.1, 0.85, 0.85);
  teddySnout.position.set(0, 0.292, -0.096);
  teddyGroup.add(teddySnout);

  const teddyNose = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 10, 8),
    darkIronMat
  );
  teddyNose.position.set(0, 0.304, -0.132);
  teddyGroup.add(teddyNose);

  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 12, 10),
      teddyFurMat
    );
    ear.scale.set(1.0, 1.0, 0.55);
    ear.position.set(sx * 0.082, 0.395, 0.0);
    teddyGroup.add(ear);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 8, 8),
      darkIronMat
    );
    eye.position.set(sx * 0.038, 0.325, -0.095);
    teddyGroup.add(eye);

    const arm = new THREE.Mesh(
      createPlushBox(0.072, 0.15, 0.075, 0.03, 0.12),
      teddyFurMat
    );
    arm.position.set(sx * 0.125, 0.15, -0.03);
    arm.rotation.set(0.35, 0, sx * -0.28);
    arm.castShadow = true;
    teddyGroup.add(arm);

    const leg = new THREE.Mesh(
      createPlushBox(0.082, 0.085, 0.16, 0.035, 0.12),
      teddyFurMat
    );
    leg.position.set(sx * 0.072, 0.045, -0.085);
    leg.castShadow = true;
    teddyGroup.add(leg);
  }
  teddyBenchGroup.add(teddyGroup);
  diningGroup.add(teddyBenchGroup);
  addBoxCollider('col_din_teddy_bench', -1.05, 0.38, 6.36, 0.60, 0.78, 0.40);

  registerInteractable('din_teddy', '泰迪熊玩偶', '查看泰迪熊', 'dining', teddyGroup, () => ({
    title: '端坐在木凳上的棕毛泰迪熊',
    message: '圆润饱满的棕色泰迪熊乖巧地坐在餐边柜旁的矮木凳上，纽扣般乌黑的眼睛正对着餐桌，毛绒缝线间带着淡淡的阳光与织物柔顺剂香气。',
  }));

  // Floating Wooden Wall Book-Ledge + Round Blue Wall Clock above Teddy Bench (Screenshot 2!)
  const wallLedgeGroup = new THREE.Group();
  wallLedgeGroup.position.set(-1.05, 1.48, 6.55);
  const ledgeBoard = new THREE.Mesh(
    createBeveledBox(0.66, 0.028, 0.18, 0.006, 2),
    oakMat
  );
  ledgeBoard.castShadow = true;
  outlines.addOutline(ledgeBoard, 1.022);
  wallLedgeGroup.add(ledgeBoard);

  for (const [bx, bw, bh, bcol] of [
    [-0.18, 0.042, 0.21, 0x5c7da8],
    [-0.13, 0.038, 0.19, 0xe8889e],
    [-0.08, 0.044, 0.22, 0x7ab882],
    [0.12, 0.16, 0.20, 0xf5ebd8],
  ] as const) {
    const lBook = new THREE.Mesh(
      createBeveledBox(bw, bh, 0.13, 0.005, 2),
      mat({ color: bcol, roughness: 0.58 })
    );
    lBook.position.set(bx, 0.014 + bh / 2, 0);
    lBook.castShadow = true;
    outlines.addOutline(lBook, 1.03);
    wallLedgeGroup.add(lBook);
  }
  diningGroup.add(wallLedgeGroup);

  // Wooden-Framed Square Wall Clock on Dining South Wall (木框方形挂钟, keeping live 3D ticking hands!)
  const dinSquareClockFaceTex = (() => {
    const S = 384;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx2d = c.getContext('2d')!;

    ctx2d.fillStyle = '#faf4e6';
    ctx2d.fillRect(0, 0, S, S);
    ctx2d.strokeStyle = '#4a3525';
    ctx2d.lineWidth = 3.5;
    ctx2d.strokeRect(26, 26, S - 52, S - 52);
    ctx2d.lineWidth = 1.6;
    ctx2d.strokeRect(36, 36, S - 72, S - 72);

    const halfSpan = S * 0.5 - 26;
    const innerSpan = S * 0.5 - 36;
    for (let m = 0; m < 60; m++) {
      const ang = (m / 60) * Math.PI * 2 - Math.PI * 0.5;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const scaleOut = halfSpan / Math.max(Math.abs(dx), Math.abs(dy));
      const scaleIn = (m % 5 === 0 ? innerSpan - 5 : innerSpan) / Math.max(Math.abs(dx), Math.abs(dy));
      ctx2d.strokeStyle = m % 5 === 0 ? '#3a2618' : 'rgba(74, 53, 37, 0.50)';
      ctx2d.lineWidth = m % 5 === 0 ? 3.4 : 1.4;
      ctx2d.beginPath();
      ctx2d.moveTo(S * 0.5 + dx * scaleIn, S * 0.5 + dy * scaleIn);
      ctx2d.lineTo(S * 0.5 + dx * scaleOut, S * 0.5 + dy * scaleOut);
      ctx2d.stroke();
    }

    ctx2d.fillStyle = '#382417';
    ctx2d.font = 'bold 32px Georgia, serif';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    const numSpan = S * 0.5 - 66;
    for (let h = 1; h <= 12; h++) {
      const ang = (h / 12) * Math.PI * 2 - Math.PI * 0.5;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const rSq = numSpan / Math.max(Math.abs(dx), Math.abs(dy));
      ctx2d.fillText(String(h), S * 0.5 + dx * rSq * 0.94, S * 0.5 + dy * rSq * 0.94 + 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  })();

  const dinClockGroup = new THREE.Group();
  dinClockGroup.position.set(-1.05, 2.04, 6.60);
  const dinClockBack = new THREE.Mesh(
    createBeveledBox(0.30, 0.30, 0.032, 0.006, 2),
    darkWoodMat
  );
  dinClockBack.castShadow = true;
  dinClockGroup.add(dinClockBack);

  const dinFrameSize = 0.325;
  const dinBarW = 0.038;
  for (const fy of [-dinFrameSize * 0.5 + dinBarW * 0.5, dinFrameSize * 0.5 - dinBarW * 0.5]) {
    const hBar = new THREE.Mesh(createBeveledBox(dinFrameSize, dinBarW, 0.040, 0.006, 2), oakMat);
    hBar.position.set(0, fy, -0.004);
    hBar.castShadow = true;
    outlines.addOutline(hBar, 1.025);
    dinClockGroup.add(hBar);
  }
  for (const fx of [-dinFrameSize * 0.5 + dinBarW * 0.5, dinFrameSize * 0.5 - dinBarW * 0.5]) {
    const vBar = new THREE.Mesh(createBeveledBox(dinBarW, dinFrameSize - dinBarW * 1.9, 0.040, 0.006, 2), oakMat);
    vBar.position.set(fx, 0, -0.004);
    vBar.castShadow = true;
    outlines.addOutline(vBar, 1.025);
    dinClockGroup.add(vBar);
  }

  const dinClockFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.252, 0.252),
    mat({ map: dinSquareClockFaceTex, roughness: 0.40 })
  );
  dinClockFace.rotation.y = Math.PI;
  dinClockFace.position.z = -0.019;
  dinClockGroup.add(dinClockFace);

  // Real-time ticking 3D clock hands on the Dining wall clock
  const dinHourPivot = new THREE.Group();
  dinHourPivot.position.set(0, 0, -0.023);
  dinHourPivot.userData.dynamic = true;
  const dinHourBlade = new THREE.Mesh(
    createBeveledBox(0.012, 0.068, 0.004, 0.0015, 1),
    darkIronMat
  );
  dinHourBlade.position.y = 0.028;
  dinHourBlade.userData.dynamic = true;
  dinHourPivot.add(dinHourBlade);
  dinClockGroup.add(dinHourPivot);

  const dinMinPivot = new THREE.Group();
  dinMinPivot.position.set(0, 0, -0.026);
  dinMinPivot.userData.dynamic = true;
  const dinMinBlade = new THREE.Mesh(
    createBeveledBox(0.009, 0.096, 0.004, 0.0015, 1),
    darkIronMat
  );
  dinMinBlade.position.y = 0.040;
  dinMinBlade.userData.dynamic = true;
  dinMinPivot.add(dinMinBlade);
  dinClockGroup.add(dinMinPivot);

  const dinSecPivot = new THREE.Group();
  dinSecPivot.position.set(0, 0, -0.029);
  dinSecPivot.userData.dynamic = true;
  const dinSecBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.106, 0.003),
    mat({ color: 0xd94558, roughness: 0.35 })
  );
  dinSecBlade.position.y = 0.042;
  dinSecBlade.userData.dynamic = true;
  dinSecPivot.add(dinSecBlade);
  dinClockGroup.add(dinSecPivot);

  clockRigs.push({
    hourHand: dinHourPivot,
    minuteHand: dinMinPivot,
    secondHand: dinSecPivot,
  });
  diningGroup.add(dinClockGroup);

  // =========================================================================
  // 4C. SUNLIT DINING ROOM SOUTH WINDOW, PASTEL-PINK TIED-BACK CURTAINS &
  //     WARM GOLDEN FLOOR SUNLIGHT PATCH (Matching Screenshot 1 / IMG_173246!)
  // =========================================================================
  const dinWindowGroup = new THREE.Group();
  dinWindowGroup.position.set(-1.94, 1.78, 6.60);

  const dinWinFrame = new THREE.Mesh(
    createBeveledBox(0.92, 1.38, 0.046, 0.008, 2),
    oakMat
  );
  dinWinFrame.castShadow = true;
  outlines.addOutline(dinWinFrame, 1.018);
  dinWindowGroup.add(dinWinFrame);

  const dinWinSill = new THREE.Mesh(
    createBeveledSlab(1.02, 0.032, 0.11, 0.014, 0.006),
    darkWoodMat
  );
  dinWinSill.position.set(0, -0.69, -0.032);
  dinWinSill.castShadow = true;
  dinWindowGroup.add(dinWinSill);

  const dinWinGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.80, 1.24),
    createWindowEmissiveMaterial(uniforms, 0xfff0dc, 0.94)
  );
  dinWinGlow.rotation.y = Math.PI;
  dinWinGlow.position.z = -0.025;
  dinWinGlow.userData.dynamic = true;
  dinWindowGroup.add(dinWinGlow);
  windowGlowMeshes.push(dinWinGlow);

  // Window mullions (vertical & horizontal crossbars)
  const dinMullionV = new THREE.Mesh(
    createBeveledBox(0.026, 1.26, 0.052, 0.004, 1),
    oakMat
  );
  dinMullionV.position.z = -0.006;
  dinWindowGroup.add(dinMullionV);
  for (const my of [-0.20, 0.22]) {
    const dinMullionH = new THREE.Mesh(
      createBeveledBox(0.82, 0.024, 0.052, 0.004, 1),
      oakMat
    );
    dinMullionH.position.set(0, my, -0.006);
    dinWindowGroup.add(dinMullionH);
  }

  // Translucent white sheer inner curtain panels (半透明白纱) diffusing window light
  const dinSheerMat = mat({
    map: textures.curtainFabric,
    bumpMap: textures.curtainBump,
    bumpScale: 0.012,
    color: 0xfbf7f5,
    transparent: true,
    opacity: 0.50,
    roughness: 0.90,
    metalness: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    windSway: 0.45,
  });
  for (const side of [-1, 1] as const) {
    const sheerGeo = createDrapedCurtainGeometry(0.42, 1.82, 0.036, 8.5);
    const sheerMesh = new THREE.Mesh(sheerGeo, dinSheerMat);
    sheerMesh.position.set(side * 0.20, -0.14, -0.044);
    sheerMesh.userData.dynamic = true;
    dinWindowGroup.add(sheerMesh);
  }

  // Wooden curtain rod & warm khaki cotton-linen butterfly curtains (玄关附近卡其色蝴蝶帘 + 底部折叠缝合折边)
  const khakiLinenCurtainTex = (() => {
    const W = 512;
    const H = 1024;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx2d = c.getContext('2d')!;
    const bg = ctx2d.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0.0, '#d6c5aa');
    bg.addColorStop(0.5, '#cbb89b');
    bg.addColorStop(1.0, '#c2ae90');
    ctx2d.fillStyle = bg;
    ctx2d.fillRect(0, 0, W, H);

    // Fine natural woven cotton-linen cross-weave slub
    for (let y = 0; y < H; y += 3) {
      ctx2d.fillStyle = y % 6 === 0 ? 'rgba(255, 250, 240, 0.065)' : 'rgba(118, 98, 74, 0.05)';
      ctx2d.fillRect(0, y, W, 1);
    }
    for (let x = 0; x < W; x += 3) {
      ctx2d.fillStyle = x % 6 === 0 ? 'rgba(255, 250, 240, 0.055)' : 'rgba(114, 94, 70, 0.045)';
      ctx2d.fillRect(x, 0, 1, H);
    }

    // Tailored double-folded & stitched bottom hem (折叠缝合折边, aligns with CURTAIN_HEM_V = 0.038)
    const hemTopY = Math.round(H * (1 - 0.038)); // y = 985
    ctx2d.fillStyle = 'rgba(112, 92, 66, 0.16)';
    ctx2d.fillRect(0, hemTopY, W, H - hemTopY);
    const hemGrad = ctx2d.createLinearGradient(0, hemTopY - 6, 0, hemTopY + 9);
    hemGrad.addColorStop(0.0, 'rgba(84, 66, 44, 0.0)');
    hemGrad.addColorStop(0.42, 'rgba(84, 66, 44, 0.44)');
    hemGrad.addColorStop(0.72, 'rgba(255, 248, 234, 0.28)');
    hemGrad.addColorStop(1.0, 'rgba(255, 248, 234, 0.0)');
    ctx2d.fillStyle = hemGrad;
    ctx2d.fillRect(0, hemTopY - 6, W, 15);
    // Fine cream-linen dashed running-stitch thread line (缝合走线针脚)
    ctx2d.save();
    ctx2d.strokeStyle = 'rgba(92, 74, 50, 0.52)';
    ctx2d.lineWidth = 1.8;
    ctx2d.setLineDash([7, 5]);
    ctx2d.beginPath();
    ctx2d.moveTo(0, hemTopY + 5.0);
    ctx2d.lineTo(W, hemTopY + 5.0);
    ctx2d.stroke();
    ctx2d.strokeStyle = 'rgba(252, 244, 228, 0.76)';
    ctx2d.lineWidth = 1.3;
    ctx2d.beginPath();
    ctx2d.moveTo(0, hemTopY + 3.6);
    ctx2d.lineTo(W, hemTopY + 3.6);
    ctx2d.stroke();
    ctx2d.restore();
    // Soft folded bottom edge highlight & underside shadow
    ctx2d.fillStyle = 'rgba(255, 248, 236, 0.26)';
    ctx2d.fillRect(0, H - 5, W, 3);
    ctx2d.fillStyle = 'rgba(82, 64, 42, 0.32)';
    ctx2d.fillRect(0, H - 2, W, 2);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1.2, 1.0);
    tex.anisotropy = 4;
    return tex;
  })();

  const dinCurtainMat = mat({
    map: khakiLinenCurtainTex,
    bumpMap: textures.curtainBump,
    bumpScale: 0.012,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    rimScale: 1.12,
    side: THREE.DoubleSide,
    windSway: 0.72,
  });
  const dinTieBandMat = mat({
    color: 0xf4ede0,
    roughness: 0.90,
    metalness: 0.0,
  });
  const dinRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 1.32, 12),
    darkWoodMat
  );
  dinRod.rotation.z = Math.PI / 2;
  dinRod.position.set(0, 0.76, -0.065);
  dinWindowGroup.add(dinRod);

  const dinButterflyGeo = createButterflyCurtainGeometry(0.44, 1.96, 0.072, 7.0, 0.28);
  for (const side of [-1, 1] as const) {
    const panelX = side * 0.42;
    const cPanel = new THREE.Mesh(dinButterflyGeo, dinCurtainMat);
    cPanel.position.set(panelX, -0.18, -0.068);
    cPanel.castShadow = true;
    cPanel.receiveShadow = true;
    outlines.addOutline(cPanel, 1.015);
    dinWindowGroup.add(cPanel);

    // Sculpted butterfly tieback ribbon band + 2-loop bow at lower cinched waist (v = 0.28 -> y = -0.61)
    const tieY = -0.61;
    const tieBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.060, 0.013, 10, 18),
      dinTieBandMat
    );
    tieBand.rotation.x = Math.PI / 2;
    tieBand.scale.set(1.18, 0.82, 1);
    tieBand.position.set(panelX, tieY, -0.064);
    dinWindowGroup.add(tieBand);

    const bowKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 10, 8),
      dinTieBandMat
    );
    bowKnot.position.set(panelX, tieY, -0.118);
    dinWindowGroup.add(bowKnot);

    for (const bSide of [-1, 1]) {
      const bowLoop = new THREE.Mesh(
        new THREE.TorusGeometry(0.026, 0.008, 8, 14),
        dinTieBandMat
      );
      bowLoop.rotation.z = bSide * 0.26;
      bowLoop.scale.set(1.32, 0.72, 0.55);
      bowLoop.position.set(panelX + bSide * 0.030, tieY + 0.010, -0.122);
      dinWindowGroup.add(bowLoop);

      const ribbonTail = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.125, 0.007),
        dinTieBandMat
      );
      ribbonTail.rotation.z = bSide * 0.22;
      ribbonTail.rotation.x = 0.08;
      ribbonTail.position.set(panelX + bSide * 0.020, tieY - 0.062, -0.124);
      dinWindowGroup.add(ribbonTail);
    }
  }
  diningGroup.add(dinWindowGroup);

  // Dining Room South Window Anisotropic Tyndall Shaft — aligned millimeter-exact with dinWindowGroup at X = -1.94, Z = 6.60!
  const dinTyndallGeo = createTyndallShaftClusterGeometry(
    2.45,
    0.78,
    1.18,
    2.38,
    0.22,
    1.28,
    0.06,
    1.24
  );
  const dinTyndallMat = createTyndallBeamShaderMaterial(uniforms, 0.132, 2.0, 2.0, 3.40, 0.04);
  const dinTyndallShaft = new THREE.Mesh(dinTyndallGeo, dinTyndallMat);
  dinTyndallShaft.position.set(-1.94, 0, 6.58);
  // Rotate -PI/2 around Y so local -X projects North (-Z) into the Dining Room directly from the window glass!
  dinTyndallShaft.rotation.y = -Math.PI / 2;
  dinTyndallShaft.renderOrder = 4;
  dinTyndallShaft.userData.dynamic = true;
  diningGroup.add(dinTyndallShaft);
  volumetricRays.push(dinTyndallShaft);

  // Soft window sunlight pool aligned directly beneath the South window at X = -1.90, Z = 5.52
  const dinFloorGoboMat = createWindowGoboShaderMaterial(
    uniforms,
    textures.windowLightGobo,
    5.52
  );
  const dinFloorLightPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.38),
    dinFloorGoboMat
  );
  dinFloorLightPatch.rotation.x = -Math.PI / 2;
  dinFloorLightPatch.rotation.z = -0.06;
  dinFloorLightPatch.position.set(-1.90, 0.0045, 5.52);
  scene.add(dinFloorLightPatch);
  volumetricRays.push(dinFloorLightPatch);

  registerInteractable('din_photo', '餐边柜相框', '查看照片', 'dining', photoGroup, () => ({
    title: '被划掉脸部的合影',
    message: '带倒角木框的双人合影被圆珠笔反复涂抹过，背面写着一行小字：“第 14 次重置”。',
    metaTrigger: true,
  }));

  registerAmbientProp({
    id: 'din_sideboard_photo',
    room: 'dining',
    mesh: photoGroup,
    worldPos: [-0.10, 0.99, 6.38],
    kind: 'wobble',
    maxDrift: 0.014,
    reactivity: 0.86,
  });
  registerAmbientProp({
    id: 'din_sideboard_bowl',
    room: 'dining',
    mesh: bowlGroup,
    worldPos: [0.70, 0.862, 6.38],
    kind: 'wobble',
    maxDrift: 0.014,
    reactivity: 0.76,
  });

  // =========================================================================
  // 5. KITCHEN (X: +3.18 .. +7.35, Z: +0.25 .. +6.74)
  // =========================================================================
  // Pass-through Breakfast Counter Bar Top with Bullnose Bevel + Crafted Honey-Oak Shaker Paneling
  const barTop = new THREE.Mesh(
    createBeveledSlab(0.48, 0.036, 2.78, 0.028, 0.008),
    counterTopMat
  );
  barTop.position.set(3.18, 1.034, 5.25);
  barTop.castShadow = true;
  barTop.receiveShadow = true;
  outlines.addOutline(barTop, 1.014);
  kitchenGroup.add(barTop);

  // Under-counter honey-oak apron & recessed Shaker wood paneling on both sides of the breakfast bar
  const barUnderTrim = new THREE.Mesh(
    createBeveledBox(0.24, 0.038, 2.74, 0.005, 2),
    oakMat
  );
  barUnderTrim.position.set(3.18, 0.996, 5.25);
  kitchenGroup.add(barUnderTrim);

  for (const [bSide, bX] of [
    [-1, 3.084],
    [1, 3.276],
  ] as const) {
    for (const pz of [4.36, 5.25, 6.14]) {
      const barPanel = createCraftedCabinetFront({
        width: 0.84,
        height: 0.78,
        depth: 0.020,
        facingAxis: 'x',
        facingSign: bSide,
        frameMat: oakMat,
        panelMat: woodPanelMat,
        grooveMat: woodGrooveMat,
        handleKind: 'none',
        stileWidth: 0.056,
      });
      barPanel.position.set(bX, 0.54, pz);
      kitchenGroup.add(barPanel);
    }
    const barPlinth = new THREE.Mesh(
      createBeveledBox(0.022, 0.09, 2.74, 0.004, 1),
      darkWoodMat
    );
    barPlinth.position.set(bX, 0.045, 5.25);
    kitchenGroup.add(barPlinth);
  }

  // 2 Refined British Heritage Bar Stools with Round Red-&-Green Union-Jack Velvet Cushions & Round Velvet Backrests
  const brassStoolMat = mat({
    color: 0xd9b05a,
    roughness: 0.24,
    metalness: 0.84,
  });
  const velvetUnionMat = mat({
    map: textures.barStoolUnionVelvet,
    bumpMap: textures.plushBump,
    bumpScale: 0.009,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
  });
  const velvetGreenTrimMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.009,
    color: 0x1b593c,
    roughness: 0.74,
    metalness: 0.04,
  });
  const velvetCrimsonBackMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.009,
    color: 0x9e1f2d,
    roughness: 0.74,
    metalness: 0.04,
  });

  // Sculpted plump round seat profile via LatheGeometry
  const barLegGeo = createTurnedLegGeometry(0.017, 0.011, 0.67);
  const footRingMainGeo = new THREE.TorusGeometry(0.168, 0.010, 10, 24);
  footRingMainGeo.rotateX(Math.PI / 2);
  const footRingInnerGeo = new THREE.TorusGeometry(0.132, 0.006, 8, 22);
  footRingInnerGeo.rotateX(Math.PI / 2);

  const barStoolSpecs: { x: number; z: number; yaw: number }[] = [
    { x: 2.66, z: 4.55, yaw: 0.08 },
    { x: 2.66, z: 5.75, yaw: -0.10 },
  ];

  for (const spec of barStoolSpecs) {
    const stool = new THREE.Group();
    // Face +X toward breakfast counter with slight lived-in angle
    stool.position.set(spec.x, 0, spec.z);
    stool.rotation.y = spec.yaw;

    // 1. 4 Splayed turned oak legs + antique brass floor ferrule caps
    for (const [lx, lz] of [
      [-0.115, -0.115],
      [0.115, -0.115],
      [-0.115, 0.115],
      [0.115, 0.115],
    ]) {
      const signX = lx < 0 ? -1 : 1;
      const signZ = lz < 0 ? -1 : 1;
      const rZ = signX * 0.13;
      const rX = -signZ * 0.13;
      const leg = new THREE.Mesh(barLegGeo, darkWoodMat);
      leg.position.set(
        lx + signX * Math.sin(0.13) * (0.67 * 0.45),
        0.67 - 0.67 / 2,
        lz + signZ * Math.sin(0.13) * (0.67 * 0.45)
      );
      leg.rotation.set(rX, 0, rZ);
      leg.castShadow = true;
      stool.add(leg);

      // Polished brass foot cap ferrule at bottom of each leg
      const ferrule = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0135, 0.0115, 0.068, 12),
        brassStoolMat
      );
      ferrule.position.set(
        lx + signX * Math.sin(0.13) * (0.67 * 0.87),
        0.036,
        lz + signZ * Math.sin(0.13) * (0.67 * 0.87)
      );
      ferrule.rotation.set(rX, 0, rZ);
      stool.add(ferrule);
    }

    // 2. Double brass footrest ring + 4 radial brass cross-spokes
    const footRing = new THREE.Mesh(footRingMainGeo, brassStoolMat);
    footRing.position.y = 0.24;
    stool.add(footRing);

    const innerRing = new THREE.Mesh(footRingInnerGeo, brassStoolMat);
    innerRing.position.y = 0.24;
    stool.add(innerRing);

    for (let k = 0; k < 4; k++) {
      const ang = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.33, 8),
        brassStoolMat
      );
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.y = ang;
      spoke.position.y = 0.24;
      stool.add(spoke);
    }

    // 3. Sculpted dark-wood under-seat apron collar + decorative brass upholstery studs
    const underApron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.195, 0.175, 0.036, 24),
      darkWoodMat
    );
    underApron.position.y = 0.665;
    underApron.castShadow = true;
    stool.add(underApron);

    const seatBrassPipingBot = new THREE.Mesh(
      new THREE.TorusGeometry(0.208, 0.0065, 8, 28),
      brassStoolMat
    );
    seatBrassPipingBot.rotation.x = Math.PI / 2;
    seatBrassPipingBot.position.y = 0.684;
    stool.add(seatBrassPipingBot);

    for (let st = 0; st < 14; st++) {
      const a = (st / 14) * Math.PI * 2;
      const stud = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 8, 6),
        brassStoolMat
      );
      stud.position.set(Math.cos(a) * 0.212, 0.696, Math.sin(a) * 0.212);
      stool.add(stud);
    }

    // 4. Plump Round Velvet Seat Cushion (Green Velvet Skirt + Union Jack Red-Green Velvet Crown!)
    const seatSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.214, 0.208, 0.064, 28),
      velvetGreenTrimMat
    );
    seatSkirt.position.y = 0.716;
    seatSkirt.castShadow = true;
    seatSkirt.receiveShadow = true;
    outlines.addOutline(seatSkirt, 1.02);
    stool.add(seatSkirt);

    // Gently domed top velvet cushion medallion displaying crisp British Union Jack ("英式米字格")
    const seatTopGeo = new THREE.SphereGeometry(0.212, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.28);
    // Planar top-down circular UV mapping so the Union Jack sits centered and crisp on the round cushion!
    const stPos = seatTopGeo.attributes.position;
    const stUv = seatTopGeo.attributes.uv;
    for (let i = 0; i < stPos.count; i++) {
      const px = stPos.getX(i);
      const pz = stPos.getZ(i);
      stUv.setXY(i, 0.5 + (px / 0.212) * 0.48, 0.5 + (pz / 0.212) * 0.48);
    }
    stUv.needsUpdate = true;
    seatTopGeo.scale(1, 0.34, 1);
    const seatTop = new THREE.Mesh(seatTopGeo, velvetUnionMat);
    seatTop.position.y = 0.706;
    seatTop.castShadow = true;
    seatTop.receiveShadow = true;
    stool.add(seatTop);

    const seatPipingTop = new THREE.Mesh(
      new THREE.TorusGeometry(0.213, 0.006, 8, 28),
      brassStoolMat
    );
    seatPipingTop.rotation.x = Math.PI / 2;
    seatPipingTop.position.y = 0.746;
    stool.add(seatPipingTop);

    // Central brass tuft button on the round seat cushion
    const seatButton = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 10, 8),
      brassStoolMat
    );
    seatButton.scale.set(1, 0.45, 1);
    seatButton.position.y = 0.777;
    stool.add(seatButton);

    // 5. Twin Gracefully Curved Brass Backrest Supports (sweeping behind -X side of stool)
    for (const szOff of [-0.082, 0.082]) {
      const railCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.145, 0.665, szOff * 0.85),
        new THREE.Vector3(-0.228, 0.725, szOff),
        new THREE.Vector3(-0.246, 0.865, szOff * 0.96),
        new THREE.Vector3(-0.226, 0.985, szOff * 0.76),
      ]);
      const railMesh = new THREE.Mesh(
        new THREE.TubeGeometry(railCurve, 18, 0.0105, 10, false),
        brassStoolMat
      );
      railMesh.castShadow = true;
      stool.add(railMesh);
    }

    // 6. Refined Round Velvet Backrest Cushion ("圆形丝绒靠垫", Red & Green British Union Jack!)
    const backMedallion = new THREE.Group();
    backMedallion.position.set(-0.212, 0.985, 0);
    backMedallion.rotation.z = 0.14; // Gentle ergonomic recline

    // Deep crimson velvet outer drum
    const backDrum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.168, 0.168, 0.044, 28),
      velvetCrimsonBackMat
    );
    backDrum.rotation.z = Math.PI / 2;
    backDrum.castShadow = true;
    outlines.addOutline(backDrum, 1.024);
    backMedallion.add(backDrum);

    // Front padded round Union Jack velvet face (+X side facing sitter)
    const backFaceGeo = new THREE.CircleGeometry(0.166, 28);
    const backFrontFace = new THREE.Mesh(backFaceGeo, velvetUnionMat);
    backFrontFace.rotation.y = Math.PI / 2;
    backFrontFace.position.x = 0.024;
    backMedallion.add(backFrontFace);

    // Rear matching Union Jack velvet face (-X side visible from dining room!)
    const backRearFace = new THREE.Mesh(backFaceGeo, velvetUnionMat);
    backRearFace.rotation.y = -Math.PI / 2;
    backRearFace.position.x = -0.024;
    backMedallion.add(backRearFace);

    // Twin antique brass piping rings framing front & back of the round velvet cushion
    for (const bx of [-0.021, 0.021]) {
      const backPiping = new THREE.Mesh(
        new THREE.TorusGeometry(0.168, 0.007, 8, 28),
        brassStoolMat
      );
      backPiping.rotation.y = Math.PI / 2;
      backPiping.position.x = bx;
      backMedallion.add(backPiping);
    }

    // Central brass tuft buttons on both sides of the round backrest medallion
    for (const bx of [-0.026, 0.026]) {
      const tuftBtn = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 10, 8),
        brassStoolMat
      );
      tuftBtn.scale.set(0.45, 1, 1);
      tuftBtn.position.x = bx;
      backMedallion.add(tuftBtn);
    }

    stool.add(backMedallion);
    diningGroup.add(stool);
  }

  // -------------------------------------------------------------------------
  // L-Shaped Kitchen Lower Cabinets (Split around the Recessed Sink at Z = 5.01..5.63!)
  // -------------------------------------------------------------------------
  // East Cabinet North section (under stove, Z = 3.55 .. 5.01)
  const cabEastNorth = new THREE.Mesh(
    createBeveledBox(0.7, 0.818, 1.46, 0.012, 2),
    oakMat
  );
  cabEastNorth.position.set(6.90, 0.489, 4.28);
  cabEastNorth.castShadow = true;
  cabEastNorth.receiveShadow = true;
  kitchenGroup.add(cabEastNorth);

  // East Cabinet under-sink lower base (Y = 0.08 .. 0.74, leaving Y = 0.74..0.93 open for the sunken metal basin!)
  const cabEastUnderSink = new THREE.Mesh(
    createBeveledBox(0.7, 0.66, 0.64, 0.012, 2),
    oakMat
  );
  cabEastUnderSink.position.set(6.90, 0.41, 5.32);
  cabEastUnderSink.castShadow = true;
  cabEastUnderSink.receiveShadow = true;
  kitchenGroup.add(cabEastUnderSink);

  // East Cabinet South corner section (Z = 5.63 .. 6.64)
  const cabEastSouth = new THREE.Mesh(
    createBeveledBox(0.7, 0.818, 1.01, 0.012, 2),
    oakMat
  );
  cabEastSouth.position.set(6.90, 0.489, 6.135);
  cabEastSouth.castShadow = true;
  cabEastSouth.receiveShadow = true;
  kitchenGroup.add(cabEastSouth);

  const toeEast = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.08, 3.08),
    darkWoodMat
  );
  toeEast.position.set(6.94, 0.04, 5.10);
  kitchenGroup.add(toeEast);

  // -------------------------------------------------------------------------
  // FULL-SIZE WESTERN BUILT-IN METALLIC LARGE OVEN (嵌入式橱柜一体金属大烤箱)
  // Integrated flush into the East lower cabinet directly under the gas cooktop (Z = 3.98)
  // -------------------------------------------------------------------------
  const builtInOvenGroup = new THREE.Group();
  builtInOvenGroup.name = 'BuiltInMetallicLargeOven';
  builtInOvenGroup.position.set(6.54, 0.48, 3.98);

  const brushedOvenSteelMat = mat({
    map: textures.brushedSteel,
    bumpMap: textures.brushedSteel,
    bumpScale: 0.003,
    color: 0xd8dce6,
    roughness: 0.22,
    metalness: 0.84,
    envMapIntensity: 1.35,
  });
  const darkAnodizedOvenMat = mat({
    color: 0x1d1c26,
    roughness: 0.22,
    metalness: 0.68,
    envMapIntensity: 1.1,
  });
  const ovenCavityMat = mat({
    color: 0x16131d,
    roughness: 0.62,
    metalness: 0.28,
  });
  const ovenWindowGlassMat = new THREE.MeshStandardMaterial({
    color: 0x14121c,
    roughness: 0.06,
    metalness: 0.28,
    transparent: true,
    opacity: 0.54,
    depthWrite: false,
  });

  // 0) Recessed dark perimeter shadow reveal bezel between cabinet carcass & oven surround
  const ovenRecessShadow = new THREE.Mesh(
    createBeveledBox(0.024, 0.784, 0.804, 0.004, 1),
    aoRecessMat
  );
  ovenRecessShadow.position.set(0.008, 0, 0);
  builtInOvenGroup.add(ovenRecessShadow);

  // 1) Outer Brushed Stainless-Steel Built-In Surround Frame (0.78m wide × 0.76m tall, beveled perimeter)
  const ovenOuterFrame = new THREE.Mesh(
    createBeveledBox(0.036, 0.76, 0.78, 0.010, 3),
    brushedOvenSteelMat
  );
  ovenOuterFrame.castShadow = true;
  ovenOuterFrame.receiveShadow = true;
  outlines.addOutline(ovenOuterFrame, 1.015);
  builtInOvenGroup.add(ovenOuterFrame);

  // 2) Upper Brushed-Steel & Dark Glass Control Fascia Panel (Y = +0.285, height 0.145m)
  const ovenFascia = new THREE.Mesh(
    createBeveledBox(0.044, 0.145, 0.74, 0.008, 2),
    darkAnodizedOvenMat
  );
  ovenFascia.position.set(-0.006, 0.285, 0);
  builtInOvenGroup.add(ovenFascia);

  // Upper cooling exhaust slot bar & brushed stainless fascia divider trim
  const ovenVentSlot = new THREE.Mesh(
    createBeveledBox(0.046, 0.014, 0.66, 0.003, 1),
    ovenCavityMat
  );
  ovenVentSlot.position.set(-0.009, 0.194, 0);
  builtInOvenGroup.add(ovenVentSlot);

  const fasciaTrimStrip = new THREE.Mesh(
    createBeveledBox(0.050, 0.018, 0.748, 0.005, 2),
    brushedOvenSteelMat
  );
  fasciaTrimStrip.position.set(-0.008, 0.212, 0);
  builtInOvenGroup.add(fasciaTrimStrip);

  // Central Digital Amber LED Oven Temperature & Clock Display ("185°C · 21:40") framed in beveled chrome
  const ovenDisplayBezel = new THREE.Mesh(
    createBeveledBox(0.010, 0.068, 0.196, 0.003, 1),
    brushedOvenSteelMat
  );
  ovenDisplayBezel.position.set(-0.027, 0.288, 0);
  builtInOvenGroup.add(ovenDisplayBezel);

  const ovenDigitalDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.180, 0.056),
    new THREE.MeshBasicMaterial({ map: ovenDisplayTex })
  );
  ovenDigitalDisplay.rotation.y = -Math.PI / 2;
  ovenDigitalDisplay.position.set(-0.033, 0.288, 0);
  ovenDigitalDisplay.userData.dynamic = true;
  builtInOvenGroup.add(ovenDigitalDisplay);

  // 4 Heavy Chamfered Knurled Two-Tone Rotary Control Knobs + Engraved Tick Escutcheons
  const ovenEscutcheonGeo = new THREE.CylinderGeometry(0.034, 0.036, 0.008, 22);
  ovenEscutcheonGeo.rotateZ(Math.PI / 2);
  const ovenKnobBaseGeo = new THREE.CylinderGeometry(0.026, 0.028, 0.014, 20);
  ovenKnobBaseGeo.rotateZ(Math.PI / 2);
  const ovenKnobCapGeo = new THREE.CylinderGeometry(0.022, 0.025, 0.020, 20);
  ovenKnobCapGeo.rotateZ(Math.PI / 2);
  for (const [kIdx, kz] of [
    [0, -0.28],
    [1, -0.17],
    [2, 0.17],
    [3, 0.28],
  ] as const) {
    const esc = new THREE.Mesh(ovenEscutcheonGeo, darkAnodizedOvenMat);
    esc.position.set(-0.028, 0.288, kz);
    builtInOvenGroup.add(esc);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.031, 0.0028, 8, 22),
      brushedOvenSteelMat
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.032, 0.288, kz);
    builtInOvenGroup.add(ring);

    const knobBase = new THREE.Mesh(ovenKnobBaseGeo, darkAnodizedOvenMat);
    knobBase.position.set(-0.036, 0.288, kz);
    builtInOvenGroup.add(knobBase);

    const knobCap = new THREE.Mesh(ovenKnobCapGeo, brushedOvenSteelMat);
    knobCap.position.set(-0.048, 0.288, kz);
    knobCap.castShadow = true;
    builtInOvenGroup.add(knobCap);

    // Subtle rotation angle per dial for authentic lived-in oven state
    const dialAng = kIdx === 1 ? -0.55 : kIdx === 2 ? 0.65 : 0.0;
    const indicator = new THREE.Mesh(
      createBeveledBox(0.008, 0.014, 0.0045, 0.001, 1),
      darkAnodizedOvenMat
    );
    indicator.position.set(
      -0.059,
      0.288 + Math.cos(dialAng) * 0.011,
      kz + Math.sin(dialAng) * 0.011
    );
    indicator.rotation.x = dialAng;
    builtInOvenGroup.add(indicator);
  }

  // 3) Deep Recessed Dark Enamel Oven Interior Cavity + Glowing Broiler Tube + Full Chrome Wire Racks
  const ovenCavityBox = new THREE.Mesh(
    createBeveledBox(0.032, 0.50, 0.64, 0.004, 1),
    ovenCavityMat
  );
  ovenCavityBox.position.set(0.006, -0.065, 0);
  builtInOvenGroup.add(ovenCavityBox);

  // Warm ambient orange broiler glow bar & 2 detailed wire baking racks inside the window
  const broilerGlowMat = new THREE.MeshBasicMaterial({ color: 0xff7830 });
  for (const gy of [0.115, -0.238]) {
    const glowTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 0.54, 10),
      broilerGlowMat
    );
    glowTube.rotation.x = Math.PI / 2;
    glowTube.position.set(-0.006, gy, 0);
    builtInOvenGroup.add(glowTube);
  }
  for (const ry of [-0.015, -0.145]) {
    const rackFrontBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0048, 0.0048, 0.59, 10),
      brushedOvenSteelMat
    );
    rackFrontBar.rotation.x = Math.PI / 2;
    rackFrontBar.position.set(-0.015, ry, 0);
    builtInOvenGroup.add(rackFrontBar);

    // Cross grid wire tips visible through the viewing glass
    for (let gz = -0.24; gz <= 0.241; gz += 0.06) {
      const rackGrid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0024, 0.0024, 0.022, 6),
        brushedOvenSteelMat
      );
      rackGrid.rotation.z = Math.PI / 2;
      rackGrid.position.set(-0.006, ry, gz);
      builtInOvenGroup.add(rackGrid);
    }
  }
  // Enameled roasting tray with rolled lip resting on lower rack
  const roastingTray = new THREE.Mesh(
    createBeveledBox(0.022, 0.030, 0.44, 0.006, 2),
    darkAnodizedOvenMat
  );
  roastingTray.position.set(-0.011, -0.124, 0);
  builtInOvenGroup.add(roastingTray);

  // 4) Large Pull-Down Brushed Stainless-Steel Oven Door with Chamfered Double-Glazed Viewing Window
  const ovenDoorTopRail = new THREE.Mesh(
    createBeveledBox(0.050, 0.068, 0.742, 0.008, 3),
    brushedOvenSteelMat
  );
  ovenDoorTopRail.position.set(-0.015, 0.155, 0);
  ovenDoorTopRail.castShadow = true;
  builtInOvenGroup.add(ovenDoorTopRail);

  const ovenDoorBotRail = new THREE.Mesh(
    createBeveledBox(0.050, 0.068, 0.742, 0.008, 3),
    brushedOvenSteelMat
  );
  ovenDoorBotRail.position.set(-0.015, -0.295, 0);
  ovenDoorBotRail.castShadow = true;
  builtInOvenGroup.add(ovenDoorBotRail);

  for (const sz of [-0.326, 0.326]) {
    const ovenDoorStile = new THREE.Mesh(
      createBeveledBox(0.050, 0.39, 0.092, 0.008, 3),
      brushedOvenSteelMat
    );
    ovenDoorStile.position.set(-0.015, -0.07, sz);
    ovenDoorStile.castShadow = true;
    builtInOvenGroup.add(ovenDoorStile);
  }

  // Dark anodized stepped inner window bezel & tinted heat-resistant glass pane
  const ovenWindowRim = new THREE.Mesh(
    createBeveledBox(0.044, 0.392, 0.562, 0.006, 2),
    darkAnodizedOvenMat
  );
  ovenWindowRim.position.set(-0.012, -0.07, 0);
  builtInOvenGroup.add(ovenWindowRim);

  const ovenGlassPane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.54, 0.37),
    ovenWindowGlassMat
  );
  ovenGlassPane.rotation.y = -Math.PI / 2;
  ovenGlassPane.position.set(-0.036, -0.07, 0);
  ovenGlassPane.userData.dynamic = true;
  builtInOvenGroup.add(ovenGlassPane);

  // 5) Heavy Tubular Brushed-Steel Pro Oven Handle Bar + Flared Cylindrical Standoffs & End Caps
  const ovenHandleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0125, 0.0125, 0.65, 16),
    cabinetPullChromeMat
  );
  ovenHandleBar.rotation.x = Math.PI / 2;
  ovenHandleBar.position.set(-0.072, 0.158, 0);
  ovenHandleBar.castShadow = true;
  builtInOvenGroup.add(ovenHandleBar);

  const ovenStandoffGeo = new THREE.CylinderGeometry(0.011, 0.015, 0.040, 12);
  ovenStandoffGeo.rotateZ(Math.PI / 2);
  for (const hz of [-0.265, 0.265]) {
    const standoff = new THREE.Mesh(ovenStandoffGeo, cabinetPullChromeMat);
    standoff.position.set(-0.050, 0.158, hz);
    builtInOvenGroup.add(standoff);
  }

  kitchenGroup.add(builtInOvenGroup);

  // Crisp architectural vertical face-frame stiles, dark reveal seams & under-counter shadow lip on East lower cabinetry
  for (const stileZ of [3.57, 4.38, 4.99, 5.65]) {
    const faceStile = new THREE.Mesh(
      createBeveledBox(0.026, 0.818, 0.026, 0.004, 2),
      darkWoodMat
    );
    faceStile.position.set(6.548, 0.489, stileZ);
    kitchenGroup.add(faceStile);
  }
  const eastTopRail = new THREE.Mesh(
    createBeveledBox(0.026, 0.028, 3.08, 0.004, 2),
    oakMat
  );
  eastTopRail.position.set(6.548, 0.884, 5.10);
  kitchenGroup.add(eastTopRail);

  // Under-countertop overhang ambient-occlusion shadow bar along East cabinetry
  const eastUnderTopShadow = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.014, 3.09),
    aoRecessMat
  );
  eastUnderTopShadow.position.set(6.535, 0.892, 5.10);
  kitchenGroup.add(eastUnderTopShadow);

  // Remaining East Cabinet Doors (Z = 4.685 beside oven & Z = 5.32 under sink) with recessed Shaker joinery & brushed-chrome arch pulls
  const eastDoorSpecs: { z: number; width: number; isUnderSink: boolean; hingeSide: -1 | 1 }[] = [
    { z: 4.685, width: 0.584, isUnderSink: false, hingeSide: -1 },
    { z: 5.32, width: 0.630, isUnderSink: true, hingeSide: 1 },
  ];
  for (let i = 0; i < eastDoorSpecs.length; i++) {
    const spec = eastDoorSpecs[i];
    const customLeaf = createCraftedCabinetFront({
      width: spec.width,
      height: spec.isUnderSink ? 0.58 : 0.56,
      depth: 0.026,
      facingAxis: 'x',
      facingSign: -1,
      frameMat: oakMat,
      panelMat: woodPanelMat,
      grooveMat: woodGrooveMat,
      handleMat: cabinetPullChromeMat,
      handleKind: 'arch_v',
      handleAlign: (-spec.hingeSide) as -1 | 1,
      handleYOffset: 0.08,
      stileWidth: 0.050,
    });
    registerCabinetDoor({
      id: `kit_cab_east_${i}`,
      label: spec.isUnderSink ? '水槽下方橱柜门' : '烤箱旁橱柜门',
      room: 'kitchen',
      parent: kitchenGroup,
      centerX: 6.537,
      centerY: spec.isUnderSink ? 0.37 : 0.365,
      centerZ: spec.z,
      width: spec.width,
      height: spec.isUnderSink ? 0.58 : 0.56,
      thickness: 0.026,
      facingAxis: 'x',
      facingSign: -1,
      hingeSide: spec.hingeSide,
      openSign: spec.hingeSide,
      doorMat: oakMat,
      moldingMat: woodMoldingMat,
      handleMat: cabinetPullChromeMat,
      customDoorGroup: customLeaf,
    });

    if (!spec.isUnderSink) {
      const drawer = createCraftedCabinetFront({
        width: spec.width,
        height: 0.194,
        depth: 0.026,
        facingAxis: 'x',
        facingSign: -1,
        frameMat: oakMat,
        panelMat: woodPanelMat,
        grooveMat: woodGrooveMat,
        handleMat: cabinetPullChromeMat,
        handleKind: 'arch_h',
        handleAlign: 0,
        stileWidth: 0.038,
      });
      drawer.position.set(6.537, 0.762, spec.z);
      kitchenGroup.add(drawer);
    } else {
      // Decorative false apron panel directly in front of the sunken metal sink basin with subtle recessed pull accent
      const sinkApron = createCraftedCabinetFront({
        width: spec.width,
        height: 0.175,
        depth: 0.024,
        facingAxis: 'x',
        facingSign: -1,
        frameMat: oakMat,
        panelMat: woodMoldingMat,
        grooveMat: woodGrooveMat,
        handleMat: cabinetPullChromeMat,
        handleKind: 'arch_h',
        handleAlign: 0,
        stileWidth: 0.036,
      });
      sinkApron.position.set(6.538, 0.768, spec.z);
      kitchenGroup.add(sinkApron);
    }
  }

  // East Countertop Slabs split cleanly around the Sink Opening (Z = 5.00 .. 5.64, X = 6.69 .. 7.11)
  const topEastNorth = new THREE.Mesh(
    createBeveledSlab(0.76, 0.036, 1.48, 0.024, 0.009),
    counterTopMat
  );
  topEastNorth.position.set(6.90, 0.916, 4.26);
  topEastNorth.castShadow = true;
  topEastNorth.receiveShadow = true;
  kitchenGroup.add(topEastNorth);

  const topEastSouth = new THREE.Mesh(
    createBeveledSlab(0.76, 0.036, 1.03, 0.024, 0.009),
    counterTopMat
  );
  topEastSouth.position.set(6.90, 0.916, 6.145);
  topEastSouth.castShadow = true;
  topEastSouth.receiveShadow = true;
  kitchenGroup.add(topEastSouth);

  // Front & back countertop bridge strips flanking the sink opening
  const topEastSinkFront = new THREE.Mesh(
    createBeveledBox(0.16, 0.036, 0.66, 0.009, 2),
    counterTopMat
  );
  topEastSinkFront.position.set(6.60, 0.916, 5.32);
  topEastSinkFront.receiveShadow = true;
  kitchenGroup.add(topEastSinkFront);

  const topEastSinkBack = new THREE.Mesh(
    createBeveledBox(0.18, 0.036, 0.66, 0.009, 2),
    counterTopMat
  );
  topEastSinkBack.position.set(7.19, 0.916, 5.32);
  topEastSinkBack.receiveShadow = true;
  kitchenGroup.add(topEastSinkBack);

  // Countertop-to-wall beveled backsplash cove trim along East & South walls (eliminates hard wall seam!)
  const eastWallCove = new THREE.Mesh(
    createBeveledBox(0.022, 0.026, 3.08, 0.006, 2),
    oakMat
  );
  eastWallCove.position.set(7.242, 0.942, 5.10);
  kitchenGroup.add(eastWallCove);

  addBoxCollider('col_kit_cab_e', 6.90, 0.5, 5.09, 0.8, 1.0, 3.16);

  const cabSouth = new THREE.Mesh(
    createBeveledBox(3.40, 0.818, 0.7, 0.012, 2),
    oakMat
  );
  cabSouth.position.set(5.20, 0.489, 6.28);
  cabSouth.castShadow = true;
  cabSouth.receiveShadow = true;
  kitchenGroup.add(cabSouth);

  const toeSouth = new THREE.Mesh(
    new THREE.BoxGeometry(3.36, 0.08, 0.62),
    darkWoodMat
  );
  toeSouth.position.set(5.20, 0.04, 6.32);
  kitchenGroup.add(toeSouth);

  // Architectural face-frame stiles, top rail & under-countertop contact shadow bar along South lower cabinet (-Z face)
  for (const stileX of [3.70, 4.46, 5.22, 5.98]) {
    const sStile = new THREE.Mesh(
      createBeveledBox(0.026, 0.818, 0.026, 0.004, 2),
      darkWoodMat
    );
    sStile.position.set(stileX, 0.489, 5.928);
    kitchenGroup.add(sStile);
  }
  const southTopRail = new THREE.Mesh(
    createBeveledBox(3.38, 0.028, 0.026, 0.004, 2),
    oakMat
  );
  southTopRail.position.set(5.20, 0.884, 5.928);
  kitchenGroup.add(southTopRail);

  const southUnderTopShadow = new THREE.Mesh(
    new THREE.BoxGeometry(3.40, 0.014, 0.016),
    aoRecessMat
  );
  southUnderTopShadow.position.set(5.20, 0.892, 5.915);
  kitchenGroup.add(southUnderTopShadow);

  // Strictly aligned Recessed Shaker Oak Doors & Drawers with sculpted brushed-chrome arched pulls along South cabinet front (-Z face)
  const southDoorXs = [4.08, 4.84, 5.60];
  for (let i = 0; i < southDoorXs.length; i++) {
    const dx = southDoorXs[i];
    const hingeSide: -1 | 1 = i < 2 ? -1 : 1;
    const southLeaf = createCraftedCabinetFront({
      width: 0.728,
      height: 0.56,
      depth: 0.026,
      facingAxis: 'z',
      facingSign: -1,
      frameMat: oakMat,
      panelMat: woodPanelMat,
      grooveMat: woodGrooveMat,
      handleMat: cabinetPullChromeMat,
      handleKind: 'arch_v',
      handleAlign: (-hingeSide) as -1 | 1,
      handleYOffset: 0.08,
      stileWidth: 0.052,
    });
    registerCabinetDoor({
      id: `kit_cab_south_${i}`,
      label: `厨房南侧下层橱柜门 (${i + 1})`,
      room: 'kitchen',
      parent: kitchenGroup,
      centerX: dx,
      centerY: 0.365,
      centerZ: 5.917,
      width: 0.728,
      height: 0.56,
      thickness: 0.026,
      facingAxis: 'z',
      facingSign: -1,
      hingeSide,
      openSign: (-hingeSide) as -1 | 1,
      doorMat: oakMat,
      moldingMat: woodMoldingMat,
      handleMat: cabinetPullChromeMat,
      customDoorGroup: southLeaf,
    });

    const drawer = createCraftedCabinetFront({
      width: 0.728,
      height: 0.194,
      depth: 0.026,
      facingAxis: 'z',
      facingSign: -1,
      frameMat: oakMat,
      panelMat: woodPanelMat,
      grooveMat: woodGrooveMat,
      handleMat: cabinetPullChromeMat,
      handleKind: 'arch_h',
      handleAlign: 0,
      stileWidth: 0.038,
    });
    drawer.position.set(dx, 0.762, 5.917);
    kitchenGroup.add(drawer);
  }

  const topSouth = new THREE.Mesh(
    createBeveledSlab(3.46, 0.036, 0.76, 0.024, 0.009),
    counterTopMat
  );
  topSouth.position.set(5.20, 0.916, 6.28);
  topSouth.castShadow = true;
  topSouth.receiveShadow = true;
  kitchenGroup.add(topSouth);

  const southWallCove = new THREE.Mesh(
    createBeveledBox(3.42, 0.026, 0.022, 0.006, 2),
    oakMat
  );
  southWallCove.position.set(5.20, 0.942, 6.625);
  kitchenGroup.add(southWallCove);

  // Subtle dark floor contact shadow along toe-kicks of East & South lower cabinets
  addContactShadow(kitchenGroup, 6.50, 0.002, 5.10, 0.24, 3.16, 0.24);
  addContactShadow(kitchenGroup, 5.20, 0.002, 5.88, 3.46, 0.24, 0.24);

  addBoxCollider('col_kit_cab_s', 5.20, 0.5, 6.28, 3.46, 1.0, 0.8);

  // =========================================================================
  // 5A-1. UPPER 2-DOOR GLASS WALL CABINET WITH RECESSED CAVITY & VISIBLE DISHWARE
  //       Positioned cleanly South of the centered over-sink window: Z = 5.72 .. 6.62 (width 0.90m)
  // =========================================================================
  const upperCabGroup = new THREE.Group();
  upperCabGroup.position.set(7.03, 2.24, 6.17);

  // Outer oak top, bottom, and side carcass boards leaving the front (-X) open for glass doors!
  for (const sy of [-0.365, 0.365]) {
    const hBoard = new THREE.Mesh(
      createBeveledBox(0.42, 0.030, 0.90, 0.008, 2),
      oakMat
    );
    hBoard.position.y = sy;
    hBoard.castShadow = true;
    upperCabGroup.add(hBoard);
  }
  const midCabShelf = new THREE.Mesh(
    createBeveledBox(0.38, 0.022, 0.85, 0.005, 2),
    oakMat
  );
  midCabShelf.position.set(0.01, -0.01, 0);
  upperCabGroup.add(midCabShelf);

  for (const sz of [-0.436, 0.0, 0.436]) {
    const vWall = new THREE.Mesh(
      createBeveledBox(0.40, 0.71, 0.028, 0.006, 2),
      oakMat
    );
    vWall.position.z = sz;
    vWall.castShadow = true;
    upperCabGroup.add(vWall);
  }

  // Deep warm-dark recessed back panel inside the glass wall cabinet
  const upperCabBack = new THREE.Mesh(
    createBeveledBox(0.024, 0.71, 0.86, 0.004, 1),
    cavityDarkMat
  );
  upperCabBack.position.x = 0.195;
  upperCabGroup.add(upperCabBack);

  // Curated MiSide-style ceramic bowls, mugs, stemmed glasses & canisters clearly visible inside!
  for (const [by, bz] of [
    [-0.31, -0.24],
    [-0.27, -0.24],
    [-0.23, -0.24],
    [-0.31, 0.22],
    [-0.27, 0.22],
    [-0.23, 0.22],
  ] as const) {
    const dishBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.050, 0.046, 18),
      creamMat
    );
    dishBowl.position.set(0.0, by, bz);
    upperCabGroup.add(dishBowl);
  }
  for (const [mz, mcol] of [
    [-0.30, 0xfff8f4],
    [-0.16, 0xf2d494],
    [0.14, 0xfff8f4],
  ] as const) {
    const mugBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.032, 0.088, 16),
      mat({ color: mcol, roughness: 0.26, metalness: 0.04 })
    );
    mugBody.position.set(0.01, 0.048, mz);
    upperCabGroup.add(mugBody);
  }
  for (const wz of [0.27, 0.36]) {
    const glassCup = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
      cabinetGlassMat
    );
    glassCup.rotation.x = Math.PI;
    glassCup.position.set(0.02, 0.135, wz);
    glassCup.userData.dynamic = true;
    upperCabGroup.add(glassCup);

    const glassStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0032, 0.0032, 0.078, 8),
      cabinetPullChromeMat
    );
    glassStem.position.set(0.02, 0.068, wz);
    upperCabGroup.add(glassStem);

    const glassFoot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.022, 0.005, 12),
      cabinetPullChromeMat
    );
    glassFoot.position.set(0.02, 0.028, wz);
    upperCabGroup.add(glassFoot);
  }
  kitchenGroup.add(upperCabGroup);

  // Upper cabinet stepped top crown molding cap & under-cabinet warm LED task light bar
  const upperCrown = new THREE.Mesh(
    createBeveledBox(0.45, 0.036, 0.94, 0.007, 2),
    darkWoodMat
  );
  upperCrown.position.set(7.02, 2.635, 6.17);
  kitchenGroup.add(upperCrown);

  const underCabLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.012, 0.80),
    new THREE.MeshBasicMaterial({ color: 0xffecd2 })
  );
  underCabLed.position.set(6.88, 1.862, 6.17);
  kitchenGroup.add(underCabLed);

  // Helper to build a strictly edge-aligned framed glass cabinet door with:
  // - Crisp beveled honey-oak stiles & rails + recessed dark-wood inner glazing rabbet bead
  // - Optical Fresnel beveled tempered glass pane
  // - Turned burnished copper-brass / chrome knob
  const buildFramedGlassDoor = (
    doorW: number,
    doorH: number,
    doorThick: number,
    handleSide: -1 | 1,
    knobYOffset = -0.08
  ) => {
    const dg = new THREE.Group();
    const stileW = 0.052;
    const innerW = doorW - stileW * 2;
    const innerH = doorH - stileW * 2;

    // 1. Full-height left & right vertical wooden stiles (strict outer edges at ±doorW/2)
    for (const sz of [-doorW / 2 + stileW / 2, doorW / 2 - stileW / 2]) {
      const stile = new THREE.Mesh(
        createBeveledBox(doorThick, doorH, stileW, 0.004, 2),
        oakMat
      );
      stile.position.z = sz;
      stile.castShadow = true;
      stile.receiveShadow = true;
      dg.add(stile);
    }
    // 2. Top & bottom horizontal wooden rails fitted flush between the stiles (strict outer edges at ±doorH/2)
    for (const sy of [-doorH / 2 + stileW / 2, doorH / 2 - stileW / 2]) {
      const rail = new THREE.Mesh(
        createBeveledBox(doorThick, stileW, innerW + 0.002, 0.004, 2),
        oakMat
      );
      rail.position.y = sy;
      rail.castShadow = true;
      rail.receiveShadow = true;
      dg.add(rail);
    }

    // 3. Stepped inner wooden glazing rabbet bead (gives real cabinet glass framing depth!)
    const beadW = 0.011;
    const beadD = doorThick - 0.008;
    for (const sz of [-innerW / 2 + beadW / 2, innerW / 2 - beadW / 2]) {
      const vBead = new THREE.Mesh(
        createBeveledBox(beadD, innerH, beadW, 0.002, 1),
        woodGrooveMat
      );
      vBead.position.z = sz;
      dg.add(vBead);
    }
    for (const sy of [-innerH / 2 + beadW / 2, innerH / 2 - beadW / 2]) {
      const hBead = new THREE.Mesh(
        createBeveledBox(beadD, beadW, innerW - beadW * 1.6, 0.002, 1),
        woodGrooveMat
      );
      hBead.position.y = sy;
      dg.add(hBead);
    }

    // 4. Optical Fresnel + beveled-edge architectural glass pane recessed cleanly inside the rabbet
    const glassPane = new THREE.Mesh(
      new THREE.PlaneGeometry(innerW - beadW * 1.6 + 0.004, innerH - beadW * 1.6 + 0.004),
      cabinetGlassMat
    );
    glassPane.rotation.y = -Math.PI / 2;
    glassPane.position.x = -0.0015;
    glassPane.castShadow = false;
    glassPane.receiveShadow = false;
    glassPane.renderOrder = 2;
    glassPane.userData.dynamic = true;
    dg.add(glassPane);

    // 5. Turned burnished copper-brass round knob centered on latch stile
    const knob = new THREE.Mesh(createCopperKnobGeometry(1.0), cabinetPullChromeMat);
    knob.rotation.z = Math.PI / 2; // Point outward along -X
    knob.position.set(
      -doorThick / 2,
      knobYOffset,
      handleSide * (doorW / 2 - stileW * 0.5)
    );
    knob.castShadow = true;
    dg.add(knob);
    return dg;
  };

  // Upper 2-Door Wall Cabinet: carcass spans Z = 5.72 .. 6.62 (0.900m) and Y = 1.860 .. 2.620 (0.760m), front X = 6.820
  const upperDoorZs = [5.944, 6.396];
  for (let i = 0; i < upperDoorZs.length; i++) {
    const uz = upperDoorZs[i];
    const hingeSide: -1 | 1 = i === 0 ? -1 : 1;
    const glassDoorGroup = buildFramedGlassDoor(0.448, 0.760, 0.026, (-hingeSide) as -1 | 1, -0.14);
    registerCabinetDoor({
      id: `kit_cupboard_upper_${i}`,
      label: `厨房玻璃吊柜门 (${i + 1})`,
      room: 'kitchen',
      parent: kitchenGroup,
      centerX: 6.807,
      centerY: 2.240,
      centerZ: uz,
      width: 0.448,
      height: 0.760,
      thickness: 0.026,
      facingAxis: 'x',
      facingSign: -1,
      hingeSide,
      openSign: hingeSide,
      doorMat: oakMat,
      moldingMat: woodMoldingMat,
      handleMat: cabinetPullChromeMat,
      customDoorGroup: glassDoorGroup,
      addRecessedCavity: false,
    });
  }

  // =========================================================================
  // 5A-2. HIGH-DETAIL BRUSHED STAINLESS-STEEL CHIMNEY RANGE HOOD (精细金属拉丝油烟机)
  //       Positioned at (6.90, 1.90, 3.98), spanning Z = 3.57 .. 4.39 (Zero Cabinet Clipping!)
  // =========================================================================
  const hoodSteelMat = mat({
    map: textures.brushedSteel,
    bumpMap: textures.brushedSteel,
    bumpScale: 0.003,
    color: 0xdce0eb,
    roughness: 0.20,
    metalness: 0.84,
    envMapIntensity: 1.35,
    celStrength: 0.35,
    rimScale: 1.35,
  });
  const hoodChromeMat = mat({
    color: 0xf2f5fc,
    roughness: 0.12,
    metalness: 0.94,
    envMapIntensity: 1.5,
    celStrength: 0.28,
    rimScale: 1.45,
  });
  const hoodDarkFasciaMat = mat({
    color: 0x1b1d26,
    roughness: 0.18,
    metalness: 0.65,
  });
  const hoodFilterMat = mat({
    map: textures.brushedSteel,
    color: 0x9aa0b0,
    roughness: 0.28,
    metalness: 0.86,
  });

  // Brushed Stainless-Steel Wall Backsplash Panel + Hanging Utensil Rail behind Stove
  const backsplash = new THREE.Mesh(
    createBeveledBox(0.012, 0.94, 0.82, 0.003, 2),
    hoodSteelMat
  );
  backsplash.position.set(7.248, 1.42, 3.98);
  backsplash.receiveShadow = true;
  kitchenGroup.add(backsplash);

  const utensilRail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.68, 10),
    hoodChromeMat
  );
  utensilRail.rotation.x = Math.PI / 2;
  utensilRail.position.set(7.215, 1.56, 3.98);
  kitchenGroup.add(utensilRail);

  for (const rz of [3.68, 4.28]) {
    const railMount = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.014, 0.036, 10),
      hoodChromeMat
    );
    railMount.rotation.z = Math.PI / 2;
    railMount.position.set(7.23, 1.56, rz);
    kitchenGroup.add(railMount);
  }

  // Hanging stainless soup ladle & slotted spatula on rail
  for (let uIdx = 0; uIdx < 2; uIdx++) {
    const uz = uIdx === 0 ? 3.84 : 4.12;
    const handle = new THREE.Mesh(
      createBeveledBox(0.006, 0.22, 0.016, 0.002, 1),
      hoodChromeMat
    );
    handle.position.set(7.212, 1.44, uz);
    kitchenGroup.add(handle);

    const head =
      uIdx === 0
        ? new THREE.Mesh(
            new THREE.SphereGeometry(0.036, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
            hoodChromeMat
          )
        : new THREE.Mesh(
            createBeveledBox(0.006, 0.075, 0.056, 0.002, 1),
            hoodChromeMat
          );
    if (uIdx === 0) {
      head.rotation.z = -Math.PI / 2;
      head.position.set(7.195, 1.32, uz);
    } else {
      head.position.set(7.212, 1.30, uz);
    }
    kitchenGroup.add(head);
  }

  const hoodGroup = new THREE.Group();
  hoodGroup.position.set(6.90, 1.90, 3.98);

  // 1. Lower Rectangular Collector Apron (0.60m deep × 0.068m tall × 0.82m wide -> Z = 3.57 .. 4.39)
  const hoodApron = new THREE.Mesh(
    createBeveledBox(0.60, 0.068, 0.82, 0.009, 3),
    hoodSteelMat
  );
  hoodApron.castShadow = true;
  hoodApron.receiveShadow = true;
  outlines.addOutline(hoodApron, 1.02);
  hoodGroup.add(hoodApron);

  // Bottom perimeter stainless drip-lip frame
  const hoodLip = new THREE.Mesh(
    createBeveledBox(0.612, 0.016, 0.832, 0.004, 2),
    hoodChromeMat
  );
  hoodLip.position.y = -0.028;
  hoodGroup.add(hoodLip);

  // 2. Two-tier Tapered Pyramid / Trapezoidal Upper Canopy
  const hoodSlopeLow = new THREE.Mesh(
    createBeveledBox(0.54, 0.088, 0.75, 0.012, 3),
    hoodSteelMat
  );
  hoodSlopeLow.position.set(0.025, 0.068, 0);
  hoodSlopeLow.castShadow = true;
  outlines.addOutline(hoodSlopeLow, 1.02);
  hoodGroup.add(hoodSlopeLow);

  const hoodSlopeHigh = new THREE.Mesh(
    createBeveledBox(0.44, 0.076, 0.56, 0.010, 3),
    hoodSteelMat
  );
  hoodSlopeHigh.position.set(0.065, 0.142, 0);
  hoodSlopeHigh.castShadow = true;
  hoodGroup.add(hoodSlopeHigh);

  // 3. Front Anodized Black-Glass Control Fascia Panel + Digital Status Display + 5 Chrome Push Buttons
  const hoodFascia = new THREE.Mesh(
    createBeveledBox(0.010, 0.044, 0.52, 0.003, 2),
    hoodDarkFasciaMat
  );
  hoodFascia.position.set(-0.301, 0.002, 0);
  hoodGroup.add(hoodFascia);

  const hoodDisplay = new THREE.Mesh(
    new THREE.PlaneGeometry(0.078, 0.022),
    new THREE.MeshBasicMaterial({ color: 0x74e8ff })
  );
  hoodDisplay.rotation.y = -Math.PI / 2;
  hoodDisplay.position.set(-0.307, 0.002, -0.14);
  hoodGroup.add(hoodDisplay);

  for (let bIdx = 0; bIdx < 5; bIdx++) {
    const bz = -0.03 + bIdx * 0.048;
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.010, 12),
      hoodChromeMat
    );
    btn.rotation.z = Math.PI / 2;
    btn.position.set(-0.306, 0.002, bz);
    hoodGroup.add(btn);
  }

  // 4. Underside Recessed Commercial Baffle Grease Filter Cassettes + 2 Warm LED Downlights
  for (const fz of [-0.18, 0.18]) {
    const filterFrame = new THREE.Mesh(
      createBeveledBox(0.38, 0.014, 0.31, 0.003, 1),
      hoodFilterMat
    );
    filterFrame.position.set(0.02, -0.032, fz);
    hoodGroup.add(filterFrame);

    // 7 sculpted 3D stainless baffle louver ribs per filter cassette
    for (let r = -3; r <= 3; r++) {
      const baffleRib = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.008, 0.022),
        hoodChromeMat
      );
      baffleRib.position.set(0.02, -0.037, fz + r * 0.038);
      baffleRib.rotation.x = 0.22;
      hoodGroup.add(baffleRib);
    }

    // Filter latch release tab
    const filterLatch = new THREE.Mesh(
      createBeveledBox(0.028, 0.012, 0.044, 0.002, 1),
      hoodDarkFasciaMat
    );
    filterLatch.position.set(-0.14, -0.039, fz);
    hoodGroup.add(filterLatch);
  }

  // Dual recessed warm-white halogen/LED worktop puck lights along front underside
  const hoodLightMat = new THREE.MeshBasicMaterial({ color: 0xfff0d4 });
  for (const lz of [-0.24, 0.24]) {
    const puckRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.038, 0.008, 16),
      hoodChromeMat
    );
    puckRing.position.set(-0.21, -0.034, lz);
    hoodGroup.add(puckRing);

    const puckLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.010, 16),
      hoodLightMat
    );
    puckLens.position.set(-0.21, -0.036, lz);
    hoodGroup.add(puckLens);
  }

  // 5. Two-Stage Telescopic Brushed Stainless Chimney Duct + Side Exhaust Louver Slots + Ceiling Collar
  const chimneyLower = new THREE.Mesh(
    createBeveledBox(0.34, 0.64, 0.36, 0.014, 3),
    hoodSteelMat
  );
  chimneyLower.position.set(0.14, 0.48, 0);
  chimneyLower.castShadow = true;
  outlines.addOutline(chimneyLower, 1.022);
  hoodGroup.add(chimneyLower);

  // Telescopic seam collar ring between lower & upper chimney shafts
  const chimneySeam = new THREE.Mesh(
    createBeveledBox(0.352, 0.022, 0.372, 0.005, 2),
    hoodChromeMat
  );
  chimneySeam.position.set(0.14, 0.79, 0);
  hoodGroup.add(chimneySeam);

  const chimneyUpper = new THREE.Mesh(
    createBeveledBox(0.31, 0.44, 0.33, 0.012, 3),
    hoodSteelMat
  );
  chimneyUpper.position.set(0.15, 0.99, 0);
  chimneyUpper.castShadow = true;
  hoodGroup.add(chimneyUpper);

  // Laser-cut horizontal exhaust louver vent slots on both Z faces of upper chimney
  for (const sideZ of [-0.167, 0.167]) {
    for (let vIdx = 0; vIdx < 5; vIdx++) {
      const ventSlot = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.008, 0.006),
        hoodDarkFasciaMat
      );
      ventSlot.position.set(0.14, 1.02 + vIdx * 0.022, sideZ);
      hoodGroup.add(ventSlot);
    }
  }

  // Ceiling mounting flange collar at Y = 3.09m
  const ceilingCollar = new THREE.Mesh(
    createBeveledBox(0.38, 0.032, 0.40, 0.008, 2),
    hoodChromeMat
  );
  ceilingCollar.position.set(0.14, 1.188, 0);
  hoodGroup.add(ceilingCollar);

  kitchenGroup.add(hoodGroup);

  // 2-Burner Gas Cooktop + Cast Iron Grates + Enamel Stockpot (Centered at X = 6.90, Z = 3.98 directly under Range Hood!)
  const stovePlate = new THREE.Mesh(
    createBeveledSlab(0.56, 0.028, 0.74, 0.035, 0.008),
    darkIronMat
  );
  stovePlate.position.set(6.90, 0.94, 3.98);
  kitchenGroup.add(stovePlate);

  // Brushed stainless cooktop perimeter trim & 2 front rotary ignition knobs
  for (const kz of [3.76, 4.20]) {
    const stoveKnob = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.019, 0.022, 14),
      hoodChromeMat
    );
    stoveKnob.position.set(6.66, 0.958, kz);
    kitchenGroup.add(stoveKnob);
  }

  for (const bz of [3.78, 4.18]) {
    const burner = new THREE.Mesh(
      new THREE.TorusGeometry(0.082, 0.008, 8, 18),
      hoodChromeMat
    );
    burner.rotation.x = Math.PI / 2;
    burner.position.set(6.90, 0.958, bz);
    kitchenGroup.add(burner);

    // Crossed cast-iron trivet grate bars per burner
    for (const rotY of [0, Math.PI / 2]) {
      const grateBar = new THREE.Mesh(
        createBeveledBox(0.21, 0.012, 0.010, 0.002, 1),
        darkIronMat
      );
      grateBar.position.set(6.90, 0.964, bz);
      grateBar.rotation.y = rotY;
      kitchenGroup.add(grateBar);
    }
  }

  // Red Enamel Stockpot with side loop handles & lid knob on front burner
  const potGroup = new THREE.Group();
  potGroup.position.set(6.90, 0.97, 3.78);
  const potBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.095, 0.14, 18),
    mat({ color: 0xb83e4b, roughness: 0.3, metalness: 0.25 })
  );
  potBody.position.y = 0.07;
  potBody.castShadow = true;
  outlines.addOutline(potBody, 1.04);
  potGroup.add(potBody);
  const potLid = new THREE.Mesh(
    createBeveledSlab(0.225, 0.018, 0.225, 0.11, 0.005),
    hoodChromeMat
  );
  potLid.position.y = 0.145;
  potGroup.add(potLid);
  const potKnob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.018, 12),
    darkIronMat
  );
  potKnob.position.y = 0.162;
  potGroup.add(potKnob);
  for (const sz of [-0.105, 0.105]) {
    const potHandle = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.005, 8, 12),
      hoodChromeMat
    );
    potHandle.rotation.x = Math.PI / 2;
    potHandle.position.set(0, 0.105, sz);
    potGroup.add(potHandle);
  }
  kitchenGroup.add(potGroup);

  // =========================================================================
  // 5B. HIGH-CRAFT RECESSED BRUSHED STAINLESS-STEEL KITCHEN SINK + WIRE DRAINER + BRIDGE FAUCET
  //     Positioned at (6.90, 0.936, 5.32), sunken 18cm with chamfered rim, rounded inner fillets & strainer
  // =========================================================================
  const sinkGroup = new THREE.Group();
  sinkGroup.position.set(6.90, 0.936, 5.32);

  // 0) Thin dark silicone caulk contact shadow seam framing outer sink cutout on countertop
  for (const sx of [-0.264, 0.264]) {
    const caulkX = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.004, 0.688),
      aoRecessMat
    );
    caulkX.position.set(sx, -0.002, 0);
    sinkGroup.add(caulkX);
  }
  for (const sz of [-0.342, 0.342]) {
    const caulkZ = new THREE.Mesh(
      new THREE.BoxGeometry(0.534, 0.004, 0.008),
      aoRecessMat
    );
    caulkZ.position.set(0, -0.002, sz);
    sinkGroup.add(caulkZ);
  }

  // 1) Top Beveled Brushed-Stainless Perimeter Rim Flange + Wide Rear Faucet Deck Ledge
  const frontRimBar = new THREE.Mesh(
    createBeveledBox(0.056, 0.015, 0.684, 0.006, 3),
    brushedSinkMetalMat
  );
  frontRimBar.position.set(-0.234, 0.001, 0);
  frontRimBar.receiveShadow = true;
  sinkGroup.add(frontRimBar);

  // Wider rear faucet & soap deck ledge (like MiSide's flat recessed rear sink flange)
  const backRimBar = new THREE.Mesh(
    createBeveledBox(0.078, 0.015, 0.684, 0.006, 3),
    brushedSinkMetalMat
  );
  backRimBar.position.set(0.224, 0.001, 0);
  backRimBar.receiveShadow = true;
  sinkGroup.add(backRimBar);

  for (const sz of [-0.312, 0.312]) {
    const rimBarZ = new THREE.Mesh(
      createBeveledBox(0.44, 0.015, 0.060, 0.006, 3),
      brushedSinkMetalMat
    );
    rimBarZ.position.set(-0.004, 0.001, sz);
    rimBarZ.receiveShadow = true;
    sinkGroup.add(rimBarZ);
  }

  // 2) 4 Sloped Inner Brushed-Metal Basin Walls + 4 Rounded Corner Fillets (pressed stainless look!)
  const sinkDepth = 0.18;
  for (const [sx, tiltZ] of [
    [-0.198, 0.075],
    [0.184, -0.075],
  ] as const) {
    const wallX = new THREE.Mesh(
      createBeveledBox(0.022, sinkDepth, 0.576, 0.005, 2),
      sinkInnerMetalMat
    );
    wallX.position.set(sx, -sinkDepth / 2, 0);
    wallX.rotation.z = tiltZ;
    wallX.receiveShadow = true;
    sinkGroup.add(wallX);
  }
  for (const [sz, tiltX] of [
    [-0.278, -0.075],
    [0.278, 0.075],
  ] as const) {
    const wallZ = new THREE.Mesh(
      createBeveledBox(0.388, sinkDepth, 0.022, 0.005, 2),
      sinkInnerMetalMat
    );
    wallZ.position.set(-0.007, -sinkDepth / 2, sz);
    wallZ.rotation.x = tiltX;
    wallZ.receiveShadow = true;
    sinkGroup.add(wallZ);
  }
  // Pressed rounded corner fillets inside the basin so inner corners catch smooth specular highlights
  for (const [cx, cz] of [
    [-0.186, -0.264],
    [-0.186, 0.264],
    [0.172, -0.264],
    [0.172, 0.264],
  ] as const) {
    const cornerFillet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.016, sinkDepth, 12),
      sinkInnerMetalMat
    );
    cornerFillet.position.set(cx, -sinkDepth / 2, cz);
    sinkGroup.add(cornerFillet);
  }

  // 3) Sunken Brushed-Steel Basin Bottom Plate with subtle drain depression
  const basinBottom = new THREE.Mesh(
    createBeveledSlab(0.39, 0.018, 0.56, 0.036, 0.006),
    brushedSinkMetalMat
  );
  basinBottom.position.set(-0.007, -sinkDepth, 0);
  basinBottom.receiveShadow = true;
  sinkGroup.add(basinBottom);

  // 4) Recessed Multi-Ring Stainless Drain Strainer Basket + Slotted Grate + Center Pin
  const drainOuterFlange = new THREE.Mesh(
    new THREE.TorusGeometry(0.044, 0.0055, 10, 24),
    hoodChromeMat
  );
  drainOuterFlange.rotation.x = Math.PI / 2;
  drainOuterFlange.position.set(0.015, -sinkDepth + 0.011, 0.05);
  sinkGroup.add(drainOuterFlange);

  const drainHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.038, 20),
    darkIronMat
  );
  drainHole.rotation.x = -Math.PI / 2;
  drainHole.position.set(0.015, -sinkDepth + 0.010, 0.05);
  sinkGroup.add(drainHole);

  const drainInnerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.016, 0.034, 18),
    steelMat
  );
  drainInnerRing.rotation.x = -Math.PI / 2;
  drainInnerRing.position.set(0.015, -sinkDepth + 0.0115, 0.05);
  sinkGroup.add(drainInnerRing);

  for (let dSpoke = 0; dSpoke < 3; dSpoke++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.003, 0.004),
      hoodChromeMat
    );
    spoke.position.set(0.015, -sinkDepth + 0.012, 0.05);
    spoke.rotation.y = (dSpoke * Math.PI) / 3;
    sinkGroup.add(spoke);
  }
  const drainPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.011, 0.012, 12),
    hoodChromeMat
  );
  drainPlug.position.set(0.015, -sinkDepth + 0.014, 0.05);
  sinkGroup.add(drainPlug);

  // 5) Fruit Peels resting DOWN INSIDE the right half of the recessed stainless basin
  const bananaPeelMat = mat({ color: 0xebd14b, roughness: 0.56 });
  const bananaTipMat = mat({ color: 0x59422a, roughness: 0.78 });
  const orangePeelMat = mat({ color: 0xf08334, roughness: 0.48 });
  const applePeelMat = mat({ color: 0xd13b4a, roughness: 0.44 });

  const basinFloorY = -sinkDepth + 0.012;

  const bananaGroup = new THREE.Group();
  bananaGroup.position.set(-0.06, basinFloorY, 0.14);
  const bStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.009, 0.028, 8),
    bananaTipMat
  );
  bStem.position.y = 0.018;
  bananaGroup.add(bStem);
  for (const [ang, spread] of [
    [0.2, 0.095],
    [2.25, 0.090],
    [-2.05, 0.10],
  ] as const) {
    const peelPts = [
      new THREE.Vector3(0, 0.014, 0),
      new THREE.Vector3(Math.cos(ang) * spread * 0.55, 0.022, Math.sin(ang) * spread * 0.55),
      new THREE.Vector3(Math.cos(ang) * spread, 0.004, Math.sin(ang) * spread),
    ];
    const peel = new THREE.Mesh(
      createTaperedCurveGeometry(peelPts, 0.012, 0.005, 10, 6),
      bananaPeelMat
    );
    peel.castShadow = true;
    bananaGroup.add(peel);
  }
  sinkGroup.add(bananaGroup);

  for (const [ox, oz, rotY] of [
    [0.06, 0.17, 0.4],
    [0.08, 0.08, -1.1],
  ] as const) {
    const oPeel = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.008, 8, 12, Math.PI * 1.15),
      orangePeelMat
    );
    oPeel.position.set(ox, basinFloorY + 0.006, oz);
    oPeel.rotation.set(Math.PI / 2 - 0.25, rotY, 0.3);
    oPeel.castShadow = true;
    sinkGroup.add(oPeel);
  }

  // 6) MiSide-Grade Chrome Wire Dish Drainer Basket nested inside the left half of the sink!
  const drainerGroup = new THREE.Group();
  drainerGroup.position.set(-0.01, -0.095, -0.145);

  const bw = 0.31; // along X
  const bd = 0.22; // along Z
  const bh = 0.095;
  // Upper & lower rounded rectangular chrome perimeter hoops
  for (const [hy, scaleXZ, rad] of [
    [bh, 1.0, 0.0042],
    [bh * 0.52, 0.96, 0.0026],
    [0.0, 0.90, 0.0036],
  ] as const) {
    const hx = (bw * 0.5) * scaleXZ;
    const hz = (bd * 0.5) * scaleXZ;
    const hoopCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-hx + 0.02, hy, -hz),
        new THREE.Vector3(hx - 0.02, hy, -hz),
        new THREE.Vector3(hx, hy, -hz + 0.02),
        new THREE.Vector3(hx, hy, hz - 0.02),
        new THREE.Vector3(hx - 0.02, hy, hz),
        new THREE.Vector3(-hx + 0.02, hy, hz),
        new THREE.Vector3(-hx, hy, hz - 0.02),
        new THREE.Vector3(-hx, hy, -hz + 0.02),
      ],
      true
    );
    const hoop = new THREE.Mesh(
      new THREE.TubeGeometry(hoopCurve, 40, rad, 8, true),
      hoodChromeMat
    );
    drainerGroup.add(hoop);
  }

  // Twin curved carry handles extending over the front & back sink rim edges
  for (const sEnd of [-1, 1] as const) {
    const handleLoop = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sEnd * (bw * 0.50), bh, -0.055),
      new THREE.Vector3(sEnd * (bw * 0.50 + 0.036), bh + 0.012, -0.048),
      new THREE.Vector3(sEnd * (bw * 0.50 + 0.036), bh + 0.012, 0.048),
      new THREE.Vector3(sEnd * (bw * 0.50), bh, 0.055),
    ]);
    const hMesh = new THREE.Mesh(
      new THREE.TubeGeometry(handleLoop, 18, 0.0038, 8, false),
      hoodChromeMat
    );
    drainerGroup.add(hMesh);
  }

  // Fine crisscross bottom & side basket wire cradle ribs
  for (let wz = -bd * 0.40; wz <= bd * 0.401; wz += 0.026) {
    const uWire = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-bw * 0.49, bh, wz),
      new THREE.Vector3(-bw * 0.45, 0.008, wz),
      new THREE.Vector3(0, 0.0, wz),
      new THREE.Vector3(bw * 0.45, 0.008, wz),
      new THREE.Vector3(bw * 0.49, bh, wz),
    ]);
    drainerGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(uWire, 14, 0.0020, 6, false), hoodChromeMat)
    );
  }
  for (let wx = -bw * 0.40; wx <= bw * 0.401; wx += 0.034) {
    const zWire = new THREE.CatmullRomCurve3([
      new THREE.Vector3(wx, bh, -bd * 0.49),
      new THREE.Vector3(wx, 0.008, -bd * 0.44),
      new THREE.Vector3(wx, 0.0, 0),
      new THREE.Vector3(wx, 0.008, bd * 0.44),
      new THREE.Vector3(wx, bh, bd * 0.49),
    ]);
    drainerGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(zWire, 14, 0.0020, 6, false), hoodChromeMat)
    );
  }

  // 2 freshly washed glazed ceramic plates leaning neatly in the chrome drainer basket
  for (const [pz, pTilt] of [
    [-0.048, 0.24],
    [-0.005, 0.26],
  ] as const) {
    const dryPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.072, 0.010, 20),
      creamMat
    );
    dryPlate.rotation.set(Math.PI / 2 - pTilt, 0, 0);
    dryPlate.position.set(0.01, 0.078, pz);
    dryPlate.castShadow = true;
    drainerGroup.add(dryPlate);
  }
  sinkGroup.add(drainerGroup);

  // 7) Realistic Two-Layer Yellow/Green Scrubbing Sponge & Printed-Label Dish-Soap Bottle on Sink Corner
  const spongeGroup = new THREE.Group();
  spongeGroup.position.set(0.20, 0.015, -0.22);
  spongeGroup.rotation.y = 0.22;
  const spongeYellow = new THREE.Mesh(
    createBeveledBox(0.056, 0.018, 0.088, 0.004, 2),
    mat({ color: 0xf4d546, roughness: 0.90 })
  );
  spongeYellow.position.y = 0.009;
  spongeYellow.castShadow = true;
  spongeGroup.add(spongeYellow);

  const spongeScrubPad = new THREE.Mesh(
    createBeveledBox(0.056, 0.007, 0.088, 0.002, 1),
    mat({ color: 0x3b7a44, roughness: 0.96 })
  );
  spongeScrubPad.position.y = 0.020;
  spongeGroup.add(spongeScrubPad);
  addContactShadow(spongeGroup, 0, 0.0005, 0, 0.076, 0.106, 0.30);
  sinkGroup.add(spongeGroup);

  const soapLabelTex = createBottleLabelTexture('#f7f4fc', '#68b4e6', 'WASH', 'LEMON SOAP');
  const soapGroup = new THREE.Group();
  soapGroup.position.set(0.215, 0.008, -0.34);
  const soapPts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.027, 0),
    new THREE.Vector2(0.029, 0.088),
    new THREE.Vector2(0.018, 0.122),
    new THREE.Vector2(0.013, 0.132),
    new THREE.Vector2(0.0008, 0.132),
  ];
  const soapBottle = new THREE.Mesh(new THREE.LatheGeometry(soapPts, 18), creamMat);
  soapBottle.castShadow = true;
  outlines.addOutline(soapBottle, 1.04);
  soapGroup.add(soapBottle);

  const soapLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0295, 0.0285, 0.056, 18, 1, true),
    mat({ map: soapLabelTex, roughness: 0.42 })
  );
  soapLabel.position.y = 0.052;
  soapLabel.rotation.y = -Math.PI / 2;
  soapGroup.add(soapLabel);

  const soapCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.014, 0.022, 12),
    mat({ color: 0xd93b48, roughness: 0.32 })
  );
  soapCap.position.y = 0.142;
  soapGroup.add(soapCap);
  addContactShadow(soapGroup, 0, 0.001, 0, 0.076, 0.076, 0.28);
  sinkGroup.add(soapGroup);

  kitchenGroup.add(sinkGroup);

  // 8) Classic Sculpted Bridge Cross-Handle Gooseneck Faucet (MiSide style!)
  const faucetGroup = new THREE.Group();
  faucetGroup.position.set(7.125, 0.944, 5.32);

  // Central stepped escutcheon base & tall riser column
  const fBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.028, 0.022, 18),
    hoodChromeMat
  );
  fBase.position.y = 0.011;
  faucetGroup.add(fBase);

  const fColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.105, 16),
    brushedSinkMetalMat
  );
  fColumn.position.y = 0.068;
  fColumn.castShadow = true;
  faucetGroup.add(fColumn);

  // Horizontal cylindrical bridge mixer manifold connecting Left (Hot) & Right (Cold) cross handles
  const fBridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.165, 16),
    hoodChromeMat
  );
  fBridge.rotation.x = Math.PI / 2;
  fBridge.position.set(-0.008, 0.074, 0);
  fBridge.castShadow = true;
  faucetGroup.add(fBridge);

  // Gooseneck curved spout with flared stepped aerator nozzle
  const faucetPts = [
    new THREE.Vector3(0.0, 0.112, 0),
    new THREE.Vector3(0.0, 0.255, 0),
    new THREE.Vector3(-0.068, 0.325, 0),
    new THREE.Vector3(-0.155, 0.295, 0),
    new THREE.Vector3(-0.195, 0.215, 0),
  ];
  const faucetSpout = new THREE.Mesh(
    createTaperedCurveGeometry(faucetPts, 0.0145, 0.011, 22, 12),
    hoodChromeMat
  );
  faucetSpout.castShadow = true;
  faucetGroup.add(faucetSpout);

  const aeratorNozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.0125, 0.018, 16),
    brushedSinkMetalMat
  );
  aeratorNozzle.position.set(-0.196, 0.207, 0);
  aeratorNozzle.rotation.z = -0.30;
  faucetGroup.add(aeratorNozzle);

  // Twin side-mounted 4-spoke turned Cross-Handles with Red (Hot) & Blue (Cold) ceramic index caps
  for (const [vz, indCol] of [
    [-0.088, 0xd93b48],
    [0.088, 0x3b78d9],
  ] as const) {
    const valveHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.016, 0.022, 14),
      hoodChromeMat
    );
    valveHub.rotation.x = Math.PI / 2;
    valveHub.position.set(-0.008, 0.074, vz);
    faucetGroup.add(valveHub);

    for (const rotZ of [0, Math.PI / 2]) {
      const crossSpoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0042, 0.0042, 0.056, 10),
        hoodChromeMat
      );
      crossSpoke.position.set(-0.008, 0.074, vz + Math.sign(vz) * 0.012);
      crossSpoke.rotation.z = rotZ;
      faucetGroup.add(crossSpoke);
    }

    const capDot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.005, 12),
      mat({ color: indCol, roughness: 0.28 })
    );
    capDot.rotation.x = Math.PI / 2;
    capDot.position.set(-0.008, 0.074, vz + Math.sign(vz) * 0.018);
    faucetGroup.add(capDot);
  }
  kitchenGroup.add(faucetGroup);

  // =========================================================================
  // 5B-2. DEEP RECESSED BEVELED WOODEN KITCHEN WINDOW + SLATTED WOODEN VENETIAN BLINDS
  //       Centered at Z = 5.14 right above the sink (spanning Z = 4.71..5.57, Y = 1.34..2.36)
  //       Zero overlap with Range Hood (Z <= 4.39) or Upper Glass Wall Cabinet (Z >= 5.72)!
  // =========================================================================
  const sinkWindowGroup = new THREE.Group();
  sinkWindowGroup.position.set(7.24, 1.85, 5.14);

  const winW = 0.86;
  const winH = 1.02;
  const casingW = 0.056;
  const innerWinW = winW - casingW * 2;
  const innerWinH = winH - casingW * 2;

  // 1) Outer beveled honey-oak architrave casing (4 mitered sculpted trim boards)
  for (const sz of [-winW / 2 + casingW / 2, winW / 2 - casingW / 2]) {
    const casingStile = new THREE.Mesh(
      createBeveledBox(0.036, winH, casingW, 0.007, 2),
      oakMat
    );
    casingStile.position.set(-0.018, 0, sz);
    casingStile.castShadow = true;
    casingStile.receiveShadow = true;
    sinkWindowGroup.add(casingStile);
  }
  for (const sy of [-winH / 2 + casingW / 2, winH / 2 - casingW / 2]) {
    const casingRail = new THREE.Mesh(
      createBeveledBox(0.036, casingW, innerWinW + 0.004, 0.007, 2),
      oakMat
    );
    casingRail.position.set(-0.018, sy, 0);
    casingRail.castShadow = true;
    casingRail.receiveShadow = true;
    sinkWindowGroup.add(casingRail);
  }

  // 2) Deep recessed wooden box-jamb reveals (15cm architectural window depth inside the open East wall!)
  for (const sz of [-innerWinW / 2 + 0.010, innerWinW / 2 - 0.010]) {
    const jambV = new THREE.Mesh(
      createBeveledBox(0.15, innerWinH, 0.022, 0.003, 1),
      woodPanelMat
    );
    jambV.position.set(0.055, 0, sz);
    jambV.receiveShadow = true;
    sinkWindowGroup.add(jambV);
  }
  for (const sy of [-innerWinH / 2 + 0.010, innerWinH / 2 - 0.010]) {
    const jambH = new THREE.Mesh(
      createBeveledBox(0.15, 0.022, innerWinW, 0.003, 1),
      woodPanelMat
    );
    jambH.position.set(0.055, sy, 0);
    jambH.receiveShadow = true;
    sinkWindowGroup.add(jambH);
  }

  // 3) Thick protruding bullnose honey-oak windowsill + underside dark shadow apron molding
  const swSill = new THREE.Mesh(
    createBeveledSlab(0.115, 0.032, winW + 0.075, 0.014, 0.007),
    oakMat
  );
  swSill.position.set(-0.044, -winH / 2 - 0.004, 0);
  swSill.castShadow = true;
  swSill.receiveShadow = true;
  outlines.addOutline(swSill, 1.018);
  sinkWindowGroup.add(swSill);

  const swSillApron = new THREE.Mesh(
    createBeveledBox(0.026, 0.028, winW + 0.02, 0.005, 2),
    darkWoodMat
  );
  swSillApron.position.set(-0.016, -winH / 2 - 0.032, 0);
  sinkWindowGroup.add(swSillApron);

  // Recessed backlit frosted daylight glass pane seated deeply inside the open wall aperture
  const swGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(innerWinW - 0.016, innerWinH - 0.016),
    createWindowEmissiveMaterial(uniforms, 0xfff4e2, 0.96)
  );
  swGlass.rotation.y = -Math.PI / 2;
  swGlass.position.x = 0.088;
  swGlass.userData.dynamic = true;
  sinkWindowGroup.add(swGlass);
  windowGlowMeshes.push(swGlass);

  // Inner beveled wooden sash frame & subtle sill bead
  for (const sz of [-innerWinW / 2 + 0.024, innerWinW / 2 - 0.024]) {
    const sashV = new THREE.Mesh(
      createBeveledBox(0.026, innerWinH - 0.016, 0.024, 0.004, 1),
      oakMat
    );
    sashV.position.set(0.068, 0, sz);
    sinkWindowGroup.add(sashV);
  }
  const swMullion = new THREE.Mesh(
    createBeveledBox(0.026, 0.022, innerWinW - 0.024, 0.004, 1),
    oakMat
  );
  swMullion.position.set(0.068, -0.05, 0);
  sinkWindowGroup.add(swMullion);

  // 4) Detailed Wooden Venetian Blind Assembly (Headrail Valance + 9 Tilted Beveled Slats + Ladder Cords + Pull Tassel!)
  const blindValance = new THREE.Mesh(
    createBeveledBox(0.068, 0.046, winW + 0.04, 0.007, 2),
    oakMat
  );
  blindValance.position.set(-0.044, winH / 2 + 0.012, 0);
  blindValance.castShadow = true;
  outlines.addOutline(blindValance, 1.02);
  sinkWindowGroup.add(blindValance);

  // 9 finely beveled wooden blind slats partially lowered at the top of the window
  for (let slat = 0; slat < 9; slat++) {
    const blindSlat = new THREE.Mesh(
      createBeveledBox(0.036, 0.0075, winW - 0.015, 0.002, 1),
      slat % 2 === 0 ? oakMat : woodPanelMat
    );
    blindSlat.position.set(-0.040, winH / 2 - 0.024 - slat * 0.024, 0);
    blindSlat.rotation.z = 0.24;
    blindSlat.castShadow = true;
    sinkWindowGroup.add(blindSlat);
  }
  // Brushed aluminum/wood weighted bottom rail bar (matching MiSide's crisp bottom blind bar!)
  const blindBottomBar = new THREE.Mesh(
    createBeveledBox(0.042, 0.018, winW + 0.01, 0.004, 2),
    steelMat
  );
  blindBottomBar.position.set(-0.042, winH / 2 - 0.244, 0);
  blindBottomBar.castShadow = true;
  sinkWindowGroup.add(blindBottomBar);

  // Twin vertical ladder-tape cords running through the wooden slats
  for (const lz of [-0.26, 0.26]) {
    const ladderCord = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.24, 0.012),
      creamMat
    );
    ladderCord.position.set(-0.042, winH / 2 - 0.125, lz);
    sinkWindowGroup.add(ladderCord);
  }

  // Hanging braided pull cord + turned wooden acorn tassel bead on the left side (just like MiSide!)
  const blindCord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0028, 0.0028, 0.62, 6),
    creamMat
  );
  blindCord.position.set(-0.048, 0.14, -winW / 2 + 0.055);
  sinkWindowGroup.add(blindCord);

  const blindTassel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.010, 0.028, 10),
    oakMat
  );
  blindTassel.position.set(-0.048, -0.175, -winW / 2 + 0.055);
  sinkWindowGroup.add(blindTassel);

  kitchenGroup.add(sinkWindowGroup);

  // Shorter, softly attenuated Anisotropic Tyndall Shaft pouring Westward (-X) from Kitchen East window
  const kitTyndallGeo = createTyndallShaftClusterGeometry(
    2.15,
    0.72,
    1.34,
    2.24,
    0.44,
    1.32,
    -0.10,
    1.26
  );
  const kitTyndallMat = createTyndallBeamShaderMaterial(uniforms, 0.125, 2.0, 2.0, 3.45, 0.04);
  const kitBeam = new THREE.Mesh(kitTyndallGeo, kitTyndallMat);
  kitBeam.position.set(7.26, 0, 5.14);
  kitBeam.renderOrder = 4;
  kitBeam.userData.dynamic = true;
  kitchenGroup.add(kitBeam);
  volumetricRays.push(kitBeam);

  const kitCounterGoboMat = createWindowGoboShaderMaterial(
    uniforms,
    textures.windowLightGobo,
    5.14
  );
  const kitCounterPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.92),
    kitCounterGoboMat
  );
  kitCounterPatch.rotation.x = -Math.PI / 2;
  kitCounterPatch.rotation.z = -0.18;
  kitCounterPatch.position.set(6.78, 0.9365, 5.66);
  scene.add(kitCounterPatch);
  volumetricRays.push(kitCounterPatch);

  const kitFloorPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.65),
    kitCounterGoboMat
  );
  kitFloorPatch.rotation.x = -Math.PI / 2;
  kitFloorPatch.rotation.z = -0.24;
  kitFloorPatch.position.set(5.72, 0.0045, 5.05);
  scene.add(kitFloorPatch);
  volumetricRays.push(kitFloorPatch);

  // Glossy Pastel Square Ceramic Tile Backsplash + MiSide Warm Honey-Oak Wainscot Cap Rail!
  const tileBacksplashUnderWin = new THREE.Mesh(
    createBeveledBox(0.012, 0.42, 1.24, 0.003, 1),
    backsplashTileMat
  );
  tileBacksplashUnderWin.position.set(7.246, 1.15, 5.04);
  tileBacksplashUnderWin.receiveShadow = true;
  kitchenGroup.add(tileBacksplashUnderWin);

  const tileBacksplashUnderCab = new THREE.Mesh(
    createBeveledBox(0.012, 0.92, 0.98, 0.003, 1),
    backsplashTileMat
  );
  tileBacksplashUnderCab.position.set(7.246, 1.40, 6.14);
  tileBacksplashUnderCab.receiveShadow = true;
  kitchenGroup.add(tileBacksplashUnderCab);

  const tileBacksplashSouth = new THREE.Mesh(
    createBeveledBox(3.42, 0.46, 0.012, 0.003, 1),
    backsplashTileMat
  );
  tileBacksplashSouth.position.set(5.20, 1.17, 6.625);
  tileBacksplashSouth.receiveShadow = true;
  kitchenGroup.add(tileBacksplashSouth);

  // Honey-oak beveled horizontal wainscot cap rail crowning the ceramic tile backsplash (signature MiSide woodwork!)
  const southTileCapRail = new THREE.Mesh(
    createBeveledBox(3.44, 0.030, 0.026, 0.006, 2),
    oakMat
  );
  southTileCapRail.position.set(5.20, 1.41, 6.618);
  southTileCapRail.castShadow = true;
  kitchenGroup.add(southTileCapRail);

  const eastTileCapLeft = new THREE.Mesh(
    createBeveledBox(0.026, 0.030, 0.34, 0.006, 2),
    oakMat
  );
  eastTileCapLeft.position.set(7.236, 1.355, 4.56);
  kitchenGroup.add(eastTileCapLeft);

  const eastTileCapRight = new THREE.Mesh(
    createBeveledBox(0.026, 0.030, 1.06, 0.006, 2),
    oakMat
  );
  eastTileCapRight.position.set(7.236, 1.41, 6.10);
  kitchenGroup.add(eastTileCapRight);

  // Wooden Wall Hook Rail with Curved Chrome S-Hooks, Quilted Spiral Oven Mitt & Stitched Diamond Potholder
  const mittRail = new THREE.Mesh(
    createBeveledBox(0.58, 0.036, 0.028, 0.008, 2),
    oakMat
  );
  mittRail.position.set(5.90, 1.54, 6.605);
  mittRail.castShadow = true;
  kitchenGroup.add(mittRail);

  for (const hx of [5.74, 6.04]) {
    const sHookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx, 1.56, 6.590),
      new THREE.Vector3(hx, 1.55, 6.578),
      new THREE.Vector3(hx, 1.49, 6.580),
      new THREE.Vector3(hx, 1.46, 6.572),
    ]);
    const sHook = new THREE.Mesh(
      new THREE.TubeGeometry(sHookCurve, 12, 0.0038, 8, false),
      hoodChromeMat
    );
    kitchenGroup.add(sHook);
  }

  const ovenMittGroup = new THREE.Group();
  ovenMittGroup.position.set(5.74, 1.35, 6.575);
  ovenMittGroup.rotation.z = 0.14;
  const mittMat = mat({
    map: ovenMittTex,
    bumpMap: textures.plushBump,
    bumpScale: 0.005,
    color: 0xffffff,
    roughness: 0.82,
  });
  const mittBody = new THREE.Mesh(createPlushBox(0.125, 0.195, 0.038, 0.032, 0.16), mittMat);
  mittBody.castShadow = true;
  outlines.addOutline(mittBody, 1.04);
  ovenMittGroup.add(mittBody);

  const mittCuff = new THREE.Mesh(
    createBeveledBox(0.112, 0.030, 0.042, 0.008, 2),
    mat({ color: 0xc2722c, roughness: 0.84 })
  );
  mittCuff.position.set(0, 0.092, 0);
  ovenMittGroup.add(mittCuff);

  const mittThumb = new THREE.Mesh(createPlushBox(0.056, 0.088, 0.034, 0.020, 0.14), mittMat);
  mittThumb.position.set(0.064, -0.022, 0);
  mittThumb.rotation.z = -0.52;
  ovenMittGroup.add(mittThumb);
  kitchenGroup.add(ovenMittGroup);

  const potholder = new THREE.Mesh(
    createPlushBox(0.135, 0.135, 0.022, 0.018, 0.10),
    mat({
      map: plaidTowelTex,
      bumpMap: textures.plushBump,
      bumpScale: 0.004,
      color: 0xf4a8bc,
      roughness: 0.84,
    })
  );
  potholder.position.set(6.04, 1.37, 6.578);
  potholder.rotation.z = Math.PI / 4;
  potholder.castShadow = true;
  outlines.addOutline(potholder, 1.04);
  kitchenGroup.add(potholder);

  // Lime-Green Rectangular Trash Bin with White Flip-Top Lid beside Breakfast Island
  const trashBinGroup = new THREE.Group();
  trashBinGroup.position.set(3.52, 0, 3.68);
  const binBody = new THREE.Mesh(
    createBeveledBox(0.32, 0.52, 0.24, 0.022, 3),
    mat({ color: 0x82c458, roughness: 0.40, metalness: 0.05 })
  );
  binBody.position.y = 0.26;
  binBody.castShadow = true;
  binBody.receiveShadow = true;
  outlines.addOutline(binBody, 1.025);
  trashBinGroup.add(binBody);

  const binRim = new THREE.Mesh(
    createBeveledBox(0.34, 0.036, 0.26, 0.012, 2),
    creamMat
  );
  binRim.position.y = 0.53;
  binRim.castShadow = true;
  trashBinGroup.add(binRim);

  const binFlipLid = new THREE.Mesh(
    createBeveledBox(0.28, 0.018, 0.20, 0.008, 2),
    creamMat
  );
  binFlipLid.position.y = 0.552;
  binFlipLid.rotation.z = 0.06;
  trashBinGroup.add(binFlipLid);
  addContactShadow(trashBinGroup, 0, 0.002, 0, 0.42, 0.34, 0.26);
  kitchenGroup.add(trashBinGroup);
  addBoxCollider('col_kit_trash_bin', 3.52, 0.28, 3.68, 0.36, 0.56, 0.28);

  // Lived-In Prop 4: Beveled Wooden Condiment Tray with Printed-Label Sauce Bottles & Spice Jars (X = 6.87, Z = 4.66)
  const condimentsGroup = new THREE.Group();
  condimentsGroup.position.set(6.87, 0.934, 4.66);

  // Beveled honey-oak organizer tray with raised rim + grounding contact shadow
  const trayBase = new THREE.Mesh(
    createBeveledSlab(0.28, 0.014, 0.44, 0.022, 0.005),
    oakMat
  );
  trayBase.position.y = 0.007;
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  condimentsGroup.add(trayBase);
  addContactShadow(condimentsGroup, 0, 0.0005, 0, 0.34, 0.50, 0.28);

  const soyLabelTex = createBottleLabelTexture('#f5ebd4', '#a82c2c', 'SOY', 'BREWED 500ML');
  const chiliLabelTex = createBottleLabelTexture('#fff2e2', '#c83434', 'CHILI', 'HOT SAUCE');
  const oilLabelTex = createBottleLabelTexture('#f2f4e4', '#5b7a36', 'OLIVE', 'EXTRA VIRGIN');

  // 1) Tall dark-amber Soy Sauce Bottle with printed label & red flip-cap
  const soyBottlePts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.034, 0),
    new THREE.Vector2(0.036, 0.118),
    new THREE.Vector2(0.015, 0.162),
    new THREE.Vector2(0.015, 0.200),
    new THREE.Vector2(0.0008, 0.200),
  ];
  const soyBottle = new THREE.Mesh(
    new THREE.LatheGeometry(soyBottlePts, 18),
    mat({ color: 0x361c18, roughness: 0.18, metalness: 0.12 })
  );
  soyBottle.position.set(0.01, 0.014, 0.0);
  soyBottle.castShadow = true;
  outlines.addOutline(soyBottle, 1.04);
  condimentsGroup.add(soyBottle);
  const soyLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0368, 0.0362, 0.058, 18, 1, true),
    mat({ map: soyLabelTex, roughness: 0.52 })
  );
  soyLabel.position.set(0.01, 0.080, 0.0);
  soyLabel.rotation.y = -Math.PI / 2;
  condimentsGroup.add(soyLabel);
  const soyBottleCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.022, 12),
    mat({ color: 0xc93838, roughness: 0.34 })
  );
  soyBottleCap.position.set(0.01, 0.222, 0.0);
  condimentsGroup.add(soyBottleCap);

  // 2) Crimson Chili Squeeze Bottle with printed label & pointed nozzle
  const chiliBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.030, 0.032, 0.140, 16),
    mat({ color: 0xd43b3b, roughness: 0.34 })
  );
  chiliBottle.position.set(-0.065, 0.084, 0.095);
  chiliBottle.castShadow = true;
  outlines.addOutline(chiliBottle, 1.04);
  condimentsGroup.add(chiliBottle);
  const chiliLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0315, 0.0322, 0.052, 16, 1, true),
    mat({ map: chiliLabelTex, roughness: 0.50 })
  );
  chiliLabel.position.set(-0.065, 0.080, 0.095);
  chiliLabel.rotation.y = -Math.PI / 2;
  condimentsGroup.add(chiliLabel);
  const chiliNozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.020, 0.044, 14),
    mat({ color: 0xf5ebd6, roughness: 0.36 })
  );
  chiliNozzle.position.set(-0.065, 0.176, 0.095);
  condimentsGroup.add(chiliNozzle);

  // 3) Olive-green Glass Cooking Oil Bottle with printed label & stainless pour spout
  const oilBottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.034, 0.172, 16),
    mat({ color: 0x567534, roughness: 0.18, metalness: 0.10 })
  );
  oilBottle.position.set(0.048, 0.100, -0.115);
  oilBottle.castShadow = true;
  outlines.addOutline(oilBottle, 1.04);
  condimentsGroup.add(oilBottle);
  const oilLabel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0335, 0.0342, 0.058, 16, 1, true),
    mat({ map: oilLabelTex, roughness: 0.52 })
  );
  oilLabel.position.set(0.048, 0.094, -0.115);
  oilLabel.rotation.y = -Math.PI / 2;
  condimentsGroup.add(oilLabel);
  const oilNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.018, 0.044, 12),
    hoodChromeMat
  );
  oilNeck.position.set(0.048, 0.208, -0.115);
  condimentsGroup.add(oilNeck);

  // 4) Two small glass spice/seasoning jars (turmeric & rosemary herb) with brushed steel shaker caps
  for (const [jx, jz, jcol] of [
    [-0.072, -0.085, 0xdea038],
    [0.015, 0.145, 0x6b8c52],
  ] as const) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.023, 0.024, 0.070, 14),
      mat({ color: jcol, roughness: 0.32, metalness: 0.05 })
    );
    jar.position.set(jx, 0.049, jz);
    jar.castShadow = true;
    outlines.addOutline(jar, 1.05);
    condimentsGroup.add(jar);
    const jarLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.016, 14),
      hoodChromeMat
    );
    jarLid.position.set(jx, 0.092, jz);
    condimentsGroup.add(jarLid);
  }
  kitchenGroup.add(condimentsGroup);

  // Lived-In Prop 5: Beveled Wooden Cutting Board with Routed Juice Groove, Sliced Fruit & Full-Tang Chef Knife (X = 6.14, Z = 6.22)
  const boardGroup = new THREE.Group();
  boardGroup.position.set(6.14, 0.934, 6.22);
  boardGroup.rotation.y = 0.16;

  const cuttingBoardMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.0055,
    color: 0xecc99c,
    roughness: 0.44,
    metalness: 0.02,
    woodLacquer: 0.48,
  });
  const boardSlab = new THREE.Mesh(
    createBeveledSlab(0.42, 0.024, 0.29, 0.036, 0.008),
    cuttingBoardMat
  );
  boardSlab.position.y = 0.012;
  boardSlab.castShadow = true;
  boardSlab.receiveShadow = true;
  outlines.addOutline(boardSlab, 1.025);
  boardGroup.add(boardSlab);

  // Routed dark perimeter juice groove recessed along top of the cutting board (MiSide craft detail!)
  for (const gz of [-0.118, 0.118]) {
    const grooveH = new THREE.Mesh(
      new THREE.BoxGeometry(0.352, 0.0025, 0.007),
      woodGrooveMat
    );
    grooveH.position.set(0, 0.0242, gz);
    boardGroup.add(grooveH);
  }
  for (const gx of [-0.176, 0.176]) {
    const grooveV = new THREE.Mesh(
      new THREE.BoxGeometry(0.007, 0.0025, 0.242),
      woodGrooveMat
    );
    grooveV.position.set(gx, 0.0242, 0);
    boardGroup.add(grooveV);
  }

  // Sculpted paddle handle with dark routed teardrop hang-hole
  const boardHandle = new THREE.Mesh(
    createBeveledSlab(0.088, 0.022, 0.112, 0.028, 0.007),
    cuttingBoardMat
  );
  boardHandle.position.set(0.236, 0.012, 0);
  boardHandle.castShadow = true;
  boardGroup.add(boardHandle);

  const boardHole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.024, 14),
    aoRecessMat
  );
  boardHole.position.set(0.246, 0.012, 0);
  boardGroup.add(boardHole);

  addContactShadow(boardGroup, 0.02, 0.0005, 0, 0.56, 0.36, 0.30);

  const appleHalf = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    applePeelMat
  );
  appleHalf.position.set(-0.08, 0.025, -0.03);
  appleHalf.castShadow = true;
  boardGroup.add(appleHalf);

  const orangeSlice = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.035, 0.014, 16),
    orangePeelMat
  );
  orangeSlice.position.set(-0.01, 0.031, 0.05);
  orangeSlice.castShadow = true;
  boardGroup.add(orangeSlice);

  // Detailed full-tang chef knife with stainless bolster & twin handle rivets resting on the board
  const knifeOnBoard = new THREE.Group();
  knifeOnBoard.position.set(0.07, 0.029, -0.01);
  knifeOnBoard.rotation.y = -0.45;
  const kHandle = new THREE.Mesh(
    createBeveledBox(0.112, 0.018, 0.024, 0.006, 2),
    darkIronMat
  );
  kHandle.position.x = 0.082;
  knifeOnBoard.add(kHandle);
  for (const rx of [0.058, 0.088, 0.114]) {
    const rivet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0028, 0.0028, 0.020, 8),
      hoodChromeMat
    );
    rivet.position.set(rx, 0, 0);
    knifeOnBoard.add(rivet);
  }
  const kBolster = new THREE.Mesh(
    createBeveledBox(0.016, 0.018, 0.026, 0.004, 1),
    hoodChromeMat
  );
  kBolster.position.x = 0.024;
  knifeOnBoard.add(kBolster);
  const kBlade = new THREE.Mesh(
    createBeveledBox(0.155, 0.0038, 0.038, 0.001, 1),
    hoodChromeMat
  );
  kBlade.position.set(-0.052, 0, 0.005);
  kBlade.castShadow = true;
  knifeOnBoard.add(kBlade);
  boardGroup.add(knifeOnBoard);
  kitchenGroup.add(boardGroup);

  // =========================================================================
  // 5B-3. MISIDE-GRADE SCULPTED HONEY-OAK KNIFE BLOCK (with carved slots, front shears pocket & riveted handles!)
  //       Positioned at (5.52, 0.934, 6.26), keeping middle chef knife slot visibly empty!
  // =========================================================================
  const knifeBlock = new THREE.Group();
  knifeBlock.position.set(5.52, 0.934, 6.26);
  knifeBlock.rotation.y = -0.18;

  // Rubber anti-slip base pad + crisp countertop contact shadow
  const kbBasePad = new THREE.Mesh(
    createBeveledBox(0.165, 0.008, 0.165, 0.003, 1),
    darkIronMat
  );
  kbBasePad.position.set(0, 0.004, -0.010);
  knifeBlock.add(kbBasePad);
  addContactShadow(knifeBlock, 0, 0.0005, -0.01, 0.24, 0.24, 0.34);

  // Main angled honey-oak wooden knife block carcass with chamfered edges
  const blockBody = new THREE.Mesh(
    createBeveledBox(0.162, 0.228, 0.148, 0.014, 3),
    cuttingBoardMat
  );
  blockBody.position.set(0, 0.118, 0.0);
  blockBody.rotation.x = -0.24;
  blockBody.castShadow = true;
  blockBody.receiveShadow = true;
  outlines.addOutline(blockBody, 1.032);
  knifeBlock.add(blockBody);

  // Stepped front wooden kitchen-shears / sharpener pocket block (signature MiSide silhouette!)
  const frontPocket = new THREE.Mesh(
    createBeveledBox(0.068, 0.098, 0.054, 0.008, 2),
    oakMat
  );
  frontPocket.position.set(0, 0.052, -0.072);
  frontPocket.castShadow = true;
  frontPocket.receiveShadow = true;
  knifeBlock.add(frontPocket);

  // Dark carved knife slots along the angled top face (shows empty middle slot clearly!)
  for (let sIdx = 0; sIdx < 3; sIdx++) {
    const slotGroove = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.006, 0.044),
      aoRecessMat
    );
    slotGroove.position.set(-0.044 + sIdx * 0.044, 0.230, 0.028);
    slotGroove.rotation.x = -0.24;
    knifeBlock.add(slotGroove);
  }

  // Detailed ergonomic full-tang knives with brushed steel bolsters, spine tangs & rivets (Slot 1 = empty!)
  for (const [k, kLen] of [
    [0, 0.118],
    [2, 0.104],
  ] as const) {
    const kx = -0.044 + k * 0.044;
    const kGrp = new THREE.Group();
    kGrp.position.set(kx, 0.228, 0.028);
    kGrp.rotation.x = -0.24;

    const bladeHeel = new THREE.Mesh(
      createBeveledBox(0.004, 0.018, 0.032, 0.001, 1),
      hoodChromeMat
    );
    bladeHeel.position.y = 0.008;
    kGrp.add(bladeHeel);

    const bolster = new THREE.Mesh(
      createBeveledBox(0.018, 0.016, 0.028, 0.004, 2),
      hoodChromeMat
    );
    bolster.position.y = 0.022;
    kGrp.add(bolster);

    const handle = new THREE.Mesh(
      createBeveledBox(0.022, kLen, 0.026, 0.006, 2),
      darkIronMat
    );
    handle.position.y = 0.026 + kLen * 0.5;
    handle.castShadow = true;
    kGrp.add(handle);

    // 3 chrome full-tang rivets visible on each knife grip
    for (const ry of [0.050, 0.078, 0.104]) {
      if (ry > 0.02 + kLen) continue;
      const riv = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0025, 0.0025, 0.024, 8),
        hoodChromeMat
      );
      riv.rotation.z = Math.PI / 2;
      riv.position.set(0, ry, 0);
      kGrp.add(riv);
    }
    knifeBlock.add(kGrp);
  }
  kitchenGroup.add(knifeBlock);

  // Lived-In Prop 5B: Glazed Ceramic Utensil Crock + Wooden Spoon, Slotted Turner & Wire Whisk (South-East corner X = 6.72, Z = 6.18)
  const crockGroup = new THREE.Group();
  crockGroup.position.set(6.72, 0.934, 6.18);
  const crockBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.056, 0.155, 20),
    mat({ color: 0xf4ece4, roughness: 0.24, metalness: 0.04 })
  );
  crockBody.position.y = 0.078;
  crockBody.castShadow = true;
  crockBody.receiveShadow = true;
  outlines.addOutline(crockBody, 1.035);
  crockGroup.add(crockBody);

  const crockRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.061, 0.006, 8, 22),
    mat({ color: 0xd9a87c, roughness: 0.34 })
  );
  crockRim.rotation.x = Math.PI / 2;
  crockRim.position.y = 0.154;
  crockGroup.add(crockRim);

  const crockInner = new THREE.Mesh(
    new THREE.CircleGeometry(0.055, 18),
    aoRecessMat
  );
  crockInner.rotation.x = -Math.PI / 2;
  crockInner.position.y = 0.148;
  crockGroup.add(crockInner);

  // Wooden cooking spoon leaning out of crock
  const spoonStick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.007, 0.26, 10),
    cuttingBoardMat
  );
  spoonStick.position.set(-0.022, 0.18, -0.015);
  spoonStick.rotation.set(-0.18, 0, 0.22);
  spoonStick.castShadow = true;
  crockGroup.add(spoonStick);

  const spoonHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 12, 10),
    cuttingBoardMat
  );
  spoonHead.scale.set(0.85, 1.25, 0.42);
  spoonHead.position.set(-0.048, 0.30, -0.036);
  spoonHead.rotation.set(-0.18, 0, 0.22);
  crockGroup.add(spoonHead);

  // Stainless steel slotted turner & wire whisk leaning at opposite angles
  const turnerHandle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.24, 10),
    hoodChromeMat
  );
  turnerHandle.position.set(0.024, 0.175, 0.018);
  turnerHandle.rotation.set(0.16, 0.3, -0.20);
  crockGroup.add(turnerHandle);

  const turnerBlade = new THREE.Mesh(
    createBeveledBox(0.054, 0.072, 0.005, 0.002, 1),
    hoodChromeMat
  );
  turnerBlade.position.set(0.048, 0.295, 0.036);
  turnerBlade.rotation.set(0.16, 0.3, -0.20);
  crockGroup.add(turnerBlade);

  addContactShadow(crockGroup, 0, 0.0005, 0, 0.16, 0.16, 0.30);
  kitchenGroup.add(crockGroup);

  // Lived-In Prop 5C: Folded Pastel Plaid Dish Towel + Warm Glazed Ceramic Mug on South Counter (X = 5.04, Z = 6.14)
  const towelMugGroup = new THREE.Group();
  towelMugGroup.position.set(5.04, 0.934, 6.14);
  towelMugGroup.rotation.y = -0.14;

  const foldedTowel = new THREE.Mesh(
    createPlushBox(0.24, 0.016, 0.17, 0.012, 0.06),
    mat({
      map: plaidTowelTex,
      bumpMap: textures.plushBump,
      bumpScale: 0.004,
      color: 0xffffff,
      roughness: 0.88,
    })
  );
  foldedTowel.position.y = 0.008;
  foldedTowel.castShadow = true;
  foldedTowel.receiveShadow = true;
  towelMugGroup.add(foldedTowel);
  addContactShadow(towelMugGroup, 0, 0.0005, 0, 0.28, 0.21, 0.24);

  const counterMug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.040, 0.036, 0.092, 18),
    mat({ color: 0xf4d8a4, roughness: 0.24, metalness: 0.04 })
  );
  counterMug.position.set(0.04, 0.060, -0.01);
  counterMug.castShadow = true;
  outlines.addOutline(counterMug, 1.04);
  towelMugGroup.add(counterMug);

  const mugHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.024, 0.0055, 8, 16, Math.PI),
    mat({ color: 0xf4d8a4, roughness: 0.24, metalness: 0.04 })
  );
  mugHandle.rotation.z = -Math.PI / 2;
  mugHandle.position.set(0.078, 0.060, -0.01);
  towelMugGroup.add(mugHandle);

  const coffeeSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 16),
    mat({ color: 0x3b2216, roughness: 0.12, metalness: 0.08 })
  );
  coffeeSurface.rotation.x = -Math.PI / 2;
  coffeeSurface.position.set(0.04, 0.096, -0.01);
  towelMugGroup.add(coffeeSurface);
  kitchenGroup.add(towelMugGroup);

  registerInteractable('kit_knives', '木质砧板与刀架', '检查砧板与厨刀', 'kitchen', boardGroup, () => ({
    title: '切了一半水果的木质砧板',
    message: '厚实的木质砧板上放着切开的苹果、香橙片和那把从刀架上抽出的主厨刀，旁边整齐地摆着酱油、辣酱与调味罐，仿佛屋主人刚刚还在准备夜宵。',
    metaTrigger: true,
  }));

  registerAmbientProp({
    id: 'kit_board_knife',
    room: 'kitchen',
    mesh: knifeOnBoard,
    worldPos: [6.21, 0.962, 6.21],
    kind: 'slide',
    maxDrift: 0.020,
    reactivity: 1.08,
  });
  registerAmbientProp({
    id: 'kit_counter_condiments',
    room: 'kitchen',
    mesh: condimentsGroup,
    worldPos: [6.87, 0.934, 4.66],
    kind: 'wobble',
    maxDrift: 0.016,
    reactivity: 0.88,
  });

  // =========================================================================
  // 5C. HIGH-CRAFT COUNTERTOP MICROWAVE OVEN ON SOUTH COUNTERTOP
  //     (倒角机身 + 金属散热格栅 + 网孔屏蔽玻璃窗 + 清晰LED数字屏 + 接触阴影, X = 4.46, Z = 6.24)
  // =========================================================================
  const mwGroup = new THREE.Group();
  mwGroup.name = 'CountertopMicrowaveOven';
  mwGroup.position.set(4.46, 0.934, 6.24);

  // Soft grounding contact shadow beneath the entire microwave footprint
  addContactShadow(mwGroup, 0, 0.0005, 0, 0.68, 0.52, 0.36);

  // 4 non-slip rubberized feet on countertop
  for (const [fx, fz] of [
    [-0.23, -0.16],
    [0.23, -0.16],
    [-0.23, 0.16],
    [0.23, 0.16],
  ] as const) {
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.015, 0.016, 12),
      darkIronMat
    );
    foot.position.set(fx, 0.008, fz);
    mwGroup.add(foot);
  }

  // Enlarged, realistic outer satin-enamel microwave body with generous chamfered edges
  const mwBody = new THREE.Mesh(
    createBeveledBox(0.58, 0.34, 0.43, 0.024, 3),
    applianceCreamMat
  );
  mwBody.position.y = 0.184;
  mwBody.castShadow = true;
  mwBody.receiveShadow = true;
  outlines.addOutline(mwBody, 1.020);
  mwGroup.add(mwBody);

  // Side cooling ventilation louver slots on both left (-X) and right (+X) panels
  for (const sideX of [-0.291, 0.291]) {
    for (let vIdx = 0; vIdx < 6; vIdx++) {
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.004, 0.009, 0.18),
        aoRecessMat
      );
      vent.position.set(sideX, 0.245 - vIdx * 0.022, 0.02);
      mwGroup.add(vent);
    }
  }

  // Brushed stainless-steel upper/lower beveled accent trim strips on front face
  for (const ty of [0.028, 0.338]) {
    const trimBar = new THREE.Mesh(
      createBeveledBox(0.556, 0.014, 0.020, 0.004, 2),
      steelMat
    );
    trimBar.position.set(0, ty, -0.214);
    mwGroup.add(trimBar);
  }

  // Dark vertical reveal seam separating the door leaf from the control console
  const mwDoorSeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.292, 0.028),
    aoRecessMat
  );
  mwDoorSeam.position.set(0.142, 0.184, -0.214);
  mwGroup.add(mwDoorSeam);

  // Left-side Chamfered Microwave Door Frame & Perforated RF-Shield Viewing Window
  const mwDoor = new THREE.Mesh(
    createBeveledBox(0.412, 0.288, 0.028, 0.011, 3),
    applianceTrimMat
  );
  mwDoor.position.set(-0.068, 0.184, -0.216);
  mwDoor.castShadow = true;
  mwGroup.add(mwDoor);

  const mwWindowBezel = new THREE.Mesh(
    createBeveledBox(0.336, 0.218, 0.032, 0.008, 2),
    darkIronMat
  );
  mwWindowBezel.position.set(-0.076, 0.184, -0.218);
  mwGroup.add(mwWindowBezel);

  // Perforated RF-shield dark glass mesh showing turntable & mug silhouette inside
  const mwWindowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.312, 0.194),
    new THREE.MeshStandardMaterial({
      map: mwMeshGlassTex,
      roughness: 0.14,
      metalness: 0.24,
      envMapIntensity: 1.15,
    })
  );
  mwWindowMesh.rotation.y = Math.PI;
  mwWindowMesh.position.set(-0.076, 0.184, -0.2355);
  mwWindowMesh.userData.dynamic = true;
  mwGroup.add(mwWindowMesh);

  // Ergonomic Curved Brushed-Steel Pull Handle with Tapered Chrome Mounting Collars
  const mwHandleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.114, 0.092, -0.226),
    new THREE.Vector3(0.114, 0.106, -0.252),
    new THREE.Vector3(0.114, 0.184, -0.256),
    new THREE.Vector3(0.114, 0.262, -0.252),
    new THREE.Vector3(0.114, 0.276, -0.226),
  ]);
  const mwHandle = new THREE.Mesh(
    new THREE.TubeGeometry(mwHandleCurve, 20, 0.0085, 12, false),
    hoodChromeMat
  );
  mwHandle.castShadow = true;
  mwGroup.add(mwHandle);

  for (const hy of [0.092, 0.276]) {
    const hCollar = new THREE.Mesh(
      createBeveledBox(0.022, 0.024, 0.012, 0.004, 1),
      hoodChromeMat
    );
    hCollar.position.set(0.114, hy, -0.228);
    mwGroup.add(hCollar);
  }

  // Right-side Recessed Dark Control Panel + Crisp Emerald LED Clock ("00:47 · 800W") + Tactile Keypad & Knurled Dial
  const mwControlPanel = new THREE.Mesh(
    createBeveledBox(0.128, 0.288, 0.024, 0.007, 2),
    darkIronMat
  );
  mwControlPanel.position.set(0.214, 0.184, -0.215);
  mwGroup.add(mwControlPanel);

  // Chrome bezel + crisp canvas-rendered emerald LED screen ("00:47")
  const mwLedBezel = new THREE.Mesh(
    createBeveledBox(0.100, 0.048, 0.006, 0.002, 1),
    steelMat
  );
  mwLedBezel.position.set(0.214, 0.276, -0.226);
  mwGroup.add(mwLedBezel);

  const mwLedScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.092, 0.040),
    new THREE.MeshBasicMaterial({ map: mwDisplayTex })
  );
  mwLedScreen.rotation.y = Math.PI;
  mwLedScreen.position.set(0.214, 0.276, -0.230);
  mwLedScreen.userData.dynamic = true;
  mwGroup.add(mwLedScreen);

  // Tactile buttons (with subtle green Start & warm amber Stop accents) + knurled chrome rotary dial
  const mwBtnRows = [0.224, 0.194, 0.164];
  for (let rIdx = 0; rIdx < mwBtnRows.length; rIdx++) {
    const by = mwBtnRows[rIdx];
    for (let cIdx = 0; cIdx < 2; cIdx++) {
      const bx = cIdx === 0 ? 0.190 : 0.238;
      const btnMat =
        rIdx === 2 && cIdx === 0
          ? mat({ color: 0x52c48c, roughness: 0.34, metalness: 0.15 })
          : rIdx === 2 && cIdx === 1
            ? mat({ color: 0xd96858, roughness: 0.34, metalness: 0.15 })
            : steelMat;
      const btn = new THREE.Mesh(
        createBeveledBox(0.036, 0.016, 0.010, 0.003, 1),
        btnMat
      );
      btn.position.set(bx, by, -0.228);
      mwGroup.add(btn);
    }
  }
  const mwDialRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.028, 0.003, 8, 22),
    hoodChromeMat
  );
  mwDialRing.position.set(0.214, 0.104, -0.228);
  mwGroup.add(mwDialRing);

  const mwDial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.025, 0.020, 20),
    steelMat
  );
  mwDial.rotation.x = Math.PI / 2;
  mwDial.position.set(0.214, 0.104, -0.235);
  mwDial.castShadow = true;
  mwGroup.add(mwDial);

  const mwDialNotch = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.012, 0.005),
    darkIronMat
  );
  mwDialNotch.position.set(0.214, 0.114, -0.245);
  mwGroup.add(mwDialNotch);

  kitchenGroup.add(mwGroup);

  // =========================================================================
  // 6. RETRO ROUNDED CREAMY-YELLOW REFRIGERATOR AT KITCHEN ENTRANCE WALL (X = 3.86, Z = 0.78)
  //    (米白色偏黄复古圆润造型: 大圆角弧面门体 + 镀铬复古弯弧把手 + 复古金属徽章 + 底部镀铬短脚)
  // =========================================================================
  const fridge = new THREE.Group();
  // Local -X rotates to world +Z (South, facing into kitchen); local +X sits flush near North wall.
  fridge.position.set(3.86, 0, 0.78);
  fridge.rotation.y = Math.PI / 2;

  // 1) 4 Sculpted Retro Chrome Stub Feet + Recessed Dark Lower Ventilation Kick-Grille
  for (const [fx, fz] of [
    [-0.24, -0.30],
    [0.26, -0.30],
    [-0.24, 0.30],
    [0.26, 0.30],
  ] as const) {
    const legUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.022, 0.056, 16),
      retroChromeMat
    );
    legUpper.position.set(fx, 0.032, fz);
    legUpper.castShadow = true;
    fridge.add(legUpper);

    const rubberPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, 0.010, 14),
      darkIronMat
    );
    rubberPad.position.set(fx, 0.005, fz);
    fridge.add(rubberPad);
  }

  const ventBase = new THREE.Mesh(
    createBeveledBox(0.58, 0.052, 0.66, 0.012, 2),
    darkIronMat
  );
  ventBase.position.set(0.01, 0.068, 0);
  fridge.add(ventBase);

  // 2) Generously Rounded Pillowy Vintage Carcass with Softly Domed Retro Roof
  const fCarcass = new THREE.Mesh(
    createRetroPillowedSlabGeometry(0.68, 1.86, 0.82, 0.115, 0.014, -1, 0.016),
    fridgeMat
  );
  fCarcass.position.set(0.04, 1.00, 0);
  fCarcass.castShadow = true;
  fCarcass.receiveShadow = true;
  outlines.addOutline(fCarcass, 1.016);
  fridge.add(fCarcass);

  // Subtle horizontal recessed chrome beltline accent band between upper freezer & lower fridge
  const fridgeBeltTrim = new THREE.Mesh(
    createBeveledBox(0.020, 0.018, 0.77, 0.006, 2),
    fridgeTrimMat
  );
  fridgeBeltTrim.position.set(-0.302, 1.335, 0);
  fridge.add(fridgeBeltTrim);

  // 3) Dark Magnetic Rubber Door Gaskets tucked tightly behind both doors
  const fridgeGasketMat = mat({ color: 0x3b353e, roughness: 0.78 });
  const topGasket = new THREE.Mesh(
    createBeveledBox(0.026, 0.51, 0.76, 0.038, 3),
    fridgeGasketMat
  );
  topGasket.position.set(-0.296, 1.625, 0);
  fridge.add(topGasket);

  const botGasket = new THREE.Mesh(
    createBeveledBox(0.026, 1.20, 0.76, 0.038, 3),
    fridgeGasketMat
  );
  botGasket.position.set(-0.296, 0.715, 0);
  fridge.add(botGasket);

  // 4) Softly Cambered Pillowy Upper Freezer Door & Lower Fridge Door (圆润弧面复古门板)
  const topDoor = new THREE.Mesh(
    createRetroPillowedSlabGeometry(0.066, 0.54, 0.80, 0.056, 0.024, -1, 0.006),
    fridgeMat
  );
  topDoor.position.set(-0.332, 1.625, 0);
  topDoor.castShadow = true;
  topDoor.receiveShadow = true;
  fridge.add(topDoor);

  const botDoor = new THREE.Mesh(
    createRetroPillowedSlabGeometry(0.066, 1.24, 0.80, 0.056, 0.026, -1, 0.004),
    fridgeMat
  );
  botDoor.position.set(-0.332, 0.715, 0);
  botDoor.castShadow = true;
  botDoor.receiveShadow = true;
  fridge.add(botDoor);

  // Subtle retro chrome barrel hinges on the left edge (local -Z)
  for (const hy of [1.84, 1.35, 0.16]) {
    const hingePin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.044, 12),
      retroChromeMat
    );
    hingePin.position.set(-0.312, hy, -0.398);
    fridge.add(hingePin);
  }

  // 5) Sculpted Vintage Curved Chrome Retro Handles with Teardrop Mounting Escutcheons
  const buildRetroFridgeHandle = (centerY: number, span: number) => {
    const hg = new THREE.Group();
    hg.position.set(-0.365, centerY, 0.295);

    const hs = span * 0.5;
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.008, -hs, 0),
      new THREE.Vector3(-0.036, -hs * 0.82, 0),
      new THREE.Vector3(-0.048, -hs * 0.32, 0),
      new THREE.Vector3(-0.050, 0, 0),
      new THREE.Vector3(-0.048, hs * 0.32, 0),
      new THREE.Vector3(-0.036, hs * 0.82, 0),
      new THREE.Vector3(0.008, hs, 0),
    ]);
    const barMesh = new THREE.Mesh(
      new THREE.TubeGeometry(handleCurve, 26, 0.0115, 12, false),
      retroChromeMat
    );
    barMesh.castShadow = true;
    hg.add(barMesh);

    // Flared vintage chrome mounting bezels at top & bottom of each handle
    for (const sy of [-hs, hs]) {
      const bezel = new THREE.Mesh(
        createBeveledBox(0.020, 0.046, 0.030, 0.008, 2),
        retroChromeMat
      );
      bezel.position.set(0.002, sy, 0);
      hg.add(bezel);
    }
    return hg;
  };
  fridge.add(buildRetroFridgeHandle(1.60, 0.25));
  fridge.add(buildRetroFridgeHandle(1.04, 0.36));

  // 6) Classic Embossed Retro Chrome Script Badge Emblem centered on upper freezer door
  const badgeBar = new THREE.Mesh(
    createBeveledBox(0.012, 0.024, 0.165, 0.006, 2),
    retroChromeMat
  );
  badgeBar.position.set(-0.386, 1.775, 0);
  fridge.add(badgeBar);
  for (const bz of [-0.10, 0.10]) {
    const badgeDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.0075, 10, 8),
      retroChromeMat
    );
    badgeDot.position.set(-0.386, 1.775, bz);
    fridge.add(badgeDot);
  }

  // 7) Warning sticky note + decorative pastel retro magnets resting cleanly on cambered front face
  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(0.175, 0.175),
    mat({ map: textures.stickyNote, roughness: 0.85 })
  );
  note.rotation.y = -Math.PI / 2;
  note.rotation.x = 0.04;
  note.position.set(-0.391, 1.54, -0.07);
  fridge.add(note);

  const magnet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.017, 0.011, 14),
    mat({ color: 0xd94558, roughness: 0.32 })
  );
  magnet.rotation.z = Math.PI / 2;
  magnet.position.set(-0.394, 1.608, -0.07);
  fridge.add(magnet);

  // Two subtle pastel decorative fridge magnets on lower door
  for (const [my, mz, mcol] of [
    [1.14, -0.18, 0x76b88a],
    [1.06, -0.09, 0xf2bc57],
  ] as const) {
    const decoMag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.010, 14),
      mat({ color: mcol, roughness: 0.34 })
    );
    decoMag.rotation.z = Math.PI / 2;
    decoMag.position.set(-0.392, my, mz);
    fridge.add(decoMag);
  }

  kitchenGroup.add(fridge);
  addBoxCollider('col_fridge', 3.86, 0.98, 0.78, 0.88, 1.96, 0.80);

  note.userData.dynamic = true;
  registerInteractable('kit_fridge', '冰箱上的黄色便签', '阅读便签', 'kitchen', note, () => ({
    title: '冰箱门上的黄色便签',
    message: '被红色磁贴吸住的字条写着：“不要下楼，锁好地下室的门。无论下面传出什么声音都不要理会。”',
  }));

  // =========================================================================
  // 6B. HIGH-CRAFT GLASS-FRONT KITCHEN DISH HUTCH (X = 6.84, Z = 2.58)
  //     严格边对边对齐柜门 + 铜黄圆形拉手 + 物理菲涅尔磨边玻璃 + 精细实木榫卯造型
  // =========================================================================
  const hutchGroup = new THREE.Group();
  hutchGroup.position.set(6.84, 0, 2.58);

  // 1) Recessed Dark-Oak Plinth Base (Y = 0 .. 0.06) + Lower Solid-Oak Carcass (Y = 0.06 .. 0.88, Z = -0.68..+0.68)
  const hutchPlinth = new THREE.Mesh(
    createBeveledBox(0.56, 0.06, 1.32, 0.004, 1),
    darkWoodMat
  );
  hutchPlinth.position.set(0.025, 0.03, 0);
  hutchPlinth.receiveShadow = true;
  hutchGroup.add(hutchPlinth);

  const hutchBase = new THREE.Mesh(
    createBeveledBox(0.62, 0.82, 1.36, 0.008, 2),
    oakMat
  );
  hutchBase.position.y = 0.47;
  hutchBase.castShadow = true;
  hutchBase.receiveShadow = true;
  hutchGroup.add(hutchBase);

  // Subtle Shaker recessed side-panel molding on exposed North/South flanks of lower carcass
  for (const sSide of [-1, 1] as const) {
    const baseSideMolding = createCraftedCabinetFront({
      width: 0.56,
      height: 0.76,
      depth: 0.016,
      facingAxis: 'z',
      facingSign: sSide,
      frameMat: oakMat,
      panelMat: woodPanelMat,
      grooveMat: woodGrooveMat,
      handleKind: 'none',
      stileWidth: 0.044,
    });
    baseSideMolding.position.set(0, 0.47, sSide * 0.680);
    hutchGroup.add(baseSideMolding);
  }

  // Lower countertop ledge with double-stepped bullnose honey-oak profile (top Y = 0.912)
  const hutchCounter = new THREE.Mesh(
    createBeveledSlab(0.66, 0.032, 1.40, 0.018, 0.007),
    oakMat
  );
  hutchCounter.position.y = 0.896;
  hutchCounter.castShadow = true;
  hutchCounter.receiveShadow = true;
  outlines.addOutline(hutchCounter, 1.015);
  hutchGroup.add(hutchCounter);

  // 3 Strictly Edge-Aligned Lower Shaker Doors & Drawers (span ±0.672 on ±0.680 carcass, 6mm clean reveal!)
  // Every door and drawer fitted with turned burnished copper-brass round knobs (铜黄圆形把手)!
  for (const [dIdx, hz] of [
    [0, -0.450],
    [1, 0.0],
    [2, 0.450],
  ] as const) {
    const baseDoor = createCraftedCabinetFront({
      width: 0.444,
      height: 0.580,
      depth: 0.024,
      facingAxis: 'x',
      facingSign: -1,
      frameMat: oakMat,
      panelMat: woodPanelMat,
      grooveMat: woodGrooveMat,
      handleMat: copperBrassMat,
      handleKind: 'knob',
      handleAlign: dIdx === 0 ? 1 : -1,
      handleYOffset: 0.14,
      stileWidth: 0.046,
    });
    baseDoor.position.set(-0.322, 0.374, hz);
    hutchGroup.add(baseDoor);

    const baseDrw = createCraftedCabinetFront({
      width: 0.444,
      height: 0.194,
      depth: 0.024,
      facingAxis: 'x',
      facingSign: -1,
      frameMat: oakMat,
      panelMat: woodPanelMat,
      grooveMat: woodGrooveMat,
      handleMat: copperBrassMat,
      handleKind: 'knob',
      handleAlign: 0,
      stileWidth: 0.034,
    });
    baseDrw.position.set(-0.322, 0.771, hz);
    hutchGroup.add(baseDrw);
  }

  // 2) Upper Glass-Front Display Hutch Carcass (strictly spanning Z = -0.670..+0.670, Y = 0.912..2.232, X = -0.170..+0.290)
  // Bottom & Top Carcass Boards flush at Y = 0.912..0.940 and Y = 2.204..2.232
  for (const sy of [0.926, 2.218]) {
    const endBoard = new THREE.Mesh(
      createBeveledBox(0.46, 0.028, 1.312, 0.004, 2),
      oakMat
    );
    endBoard.position.set(0.060, sy, 0);
    endBoard.castShadow = true;
    endBoard.receiveShadow = true;
    hutchGroup.add(endBoard);
  }

  // Two Interior Display Shelves (3 tidy display tiers) recessed 2.2cm behind the glass doors
  for (const sy of [1.36, 1.79]) {
    const innerShelf = new THREE.Mesh(
      createBeveledBox(0.415, 0.024, 1.284, 0.004, 2),
      oakMat
    );
    innerShelf.position.set(0.072, sy, 0);
    innerShelf.castShadow = true;
    innerShelf.receiveShadow = true;
    hutchGroup.add(innerShelf);

    // Molded front shelf edge lip
    const shelfLip = new THREE.Mesh(
      createBeveledBox(0.014, 0.028, 1.284, 0.003, 1),
      darkWoodMat
    );
    shelfLip.position.set(-0.132, sy, 0);
    hutchGroup.add(shelfLip);
  }

  // Full-height Side Walls (exact outer Z faces at ±0.670, front X at -0.170, Y = 0.912..2.232)
  for (const sSide of [-1, 1] as const) {
    const hSide = new THREE.Mesh(
      createBeveledBox(0.46, 1.320, 0.028, 0.004, 2),
      oakMat
    );
    hSide.position.set(0.060, 1.572, sSide * 0.656);
    hSide.castShadow = true;
    hSide.receiveShadow = true;
    outlines.addOutline(hSide, 1.016);
    hutchGroup.add(hSide);

    // Subtle recessed Shaker panel trim on exposed upper cabinet side flanks
    const sidePanelTrim = createCraftedCabinetFront({
      width: 0.40,
      height: 1.22,
      depth: 0.012,
      facingAxis: 'z',
      facingSign: sSide,
      frameMat: oakMat,
      panelMat: woodPanelMat,
      grooveMat: woodGrooveMat,
      handleKind: 'none',
      stileWidth: 0.042,
    });
    sidePanelTrim.position.set(0.060, 1.572, sSide * 0.670);
    hutchGroup.add(sidePanelTrim);
  }

  // Warm planked oak interior back panel + subtle vertical groove battens (warm depth behind dishes!)
  const hutchBack = new THREE.Mesh(
    createBeveledBox(0.024, 1.292, 1.292, 0.003, 1),
    cavityDarkMat
  );
  hutchBack.position.set(0.278, 1.572, 0);
  hutchBack.receiveShadow = true;
  hutchGroup.add(hutchBack);

  for (let pz = -0.52; pz <= 0.521; pz += 0.13) {
    const backGroove = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 1.28, 0.006),
      woodGrooveMat
    );
    backGroove.position.set(0.264, 1.572, pz);
    hutchGroup.add(backGroove);
  }

  // Two-Tier Stepped Architectural Crown Cornice sitting flush atop Y = 2.232
  const hutchCrownLower = new THREE.Mesh(
    createBeveledSlab(0.49, 0.022, 1.375, 0.010, 0.004),
    darkWoodMat
  );
  hutchCrownLower.position.set(0.048, 2.243, 0);
  hutchCrownLower.castShadow = true;
  hutchGroup.add(hutchCrownLower);

  const hutchCrownUpper = new THREE.Mesh(
    createBeveledSlab(0.52, 0.032, 1.415, 0.014, 0.006),
    oakMat
  );
  hutchCrownUpper.position.set(0.038, 2.270, 0);
  hutchCrownUpper.castShadow = true;
  outlines.addOutline(hutchCrownUpper, 1.015);
  hutchGroup.add(hutchCrownUpper);

  // 3) Curated 3-Tier Dishware Collection clearly visible behind the optical glass!
  const glazedSageMat = mat({ color: 0x9ab8a0, roughness: 0.26, metalness: 0.04 });
  const glazedButterMat = mat({ color: 0xf2d494, roughness: 0.28, metalness: 0.04 });
  const glazedBlushMat = mat({ color: 0xebb8bc, roughness: 0.28, metalness: 0.04 });

  // Tier 1 (Bottom Shelf Y = 0.940): Stacked ribbed porcelain bowls & dinner plates
  for (const bz of [-0.46, -0.16, 0.16, 0.46]) {
    for (let stack = 0; stack < 3; stack++) {
      const bowlMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.084, 0.052, 0.050, 18),
        stack === 2 && bz > 0 ? glazedSageMat : creamMat
      );
      bowlMesh.position.set(0.04, 0.966 + stack * 0.040, bz);
      bowlMesh.castShadow = true;
      hutchGroup.add(bowlMesh);
    }
  }

  // Tier 2 (Middle Shelf Y = 1.372): White porcelain mugs & stemmed crystal wine glasses
  for (const mz of [-0.48, -0.28, -0.08, 0.12]) {
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.033, 0.090, 16),
      mz < -0.2 ? glazedButterMat : creamMat
    );
    mug.position.set(0.04, 1.418, mz);
    mug.castShadow = true;
    hutchGroup.add(mug);
  }
  for (const wz of [0.30, 0.46]) {
    const wineBowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
      cabinetGlassMat
    );
    wineBowl.rotation.x = Math.PI;
    wineBowl.position.set(0.04, 1.505, wz);
    wineBowl.userData.dynamic = true;
    hutchGroup.add(wineBowl);

    const wineStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0038, 0.0038, 0.082, 8),
      retroChromeMat
    );
    wineStem.position.set(0.04, 1.430, wz);
    hutchGroup.add(wineStem);

    const wineFoot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, 0.005, 14),
      retroChromeMat
    );
    wineFoot.position.set(0.04, 1.386, wz);
    hutchGroup.add(wineFoot);
  }

  // Tier 3 (Top Shelf Y = 1.802): Ceramic pitcher, pastel spice canisters & upright display plates
  const pitcherBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.062, 0.175, 16),
    creamMat
  );
  pitcherBody.position.set(0.06, 1.892, -0.44);
  pitcherBody.castShadow = true;
  hutchGroup.add(pitcherBody);

  for (const [cz, ch, cmat] of [
    [-0.22, 0.135, glazedBlushMat],
    [-0.04, 0.155, glazedSageMat],
    [0.14, 0.125, glazedButterMat],
  ] as const) {
    const canister = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, ch, 16),
      cmat
    );
    canister.position.set(0.05, 1.804 + ch * 0.5, cz);
    canister.castShadow = true;
    hutchGroup.add(canister);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.050, 0.050, 0.016, 16),
      oakMat
    );
    lid.position.set(0.05, 1.804 + ch + 0.008, cz);
    hutchGroup.add(lid);
  }
  for (const pz of [0.34, 0.48]) {
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.092, 0.092, 0.012, 20),
      creamMat
    );
    plate.rotation.z = Math.PI / 2 - 0.16;
    plate.position.set(0.11, 1.895, pz);
    plate.castShadow = true;
    hutchGroup.add(plate);
  }

  // 4) Twin Strictly Edge-Aligned Interactive Glass Doors with Copper-Brass Round Knobs!
  //    Carcass outer span: Z = -0.670..+0.670 (1.340m), Y = 0.912..2.232 (1.320m), front X = -0.170
  //    Each door: width = 0.668m, height = 1.320m, thickness = 0.026m -> centerX = -0.183, centerZ = ±0.336
  //    Result: 0.000m outer edge overhang error + crisp 4mm center meeting seam!
  for (const [idx, hz] of [
    [0, -0.336],
    [1, 0.336],
  ] as const) {
    const hingeSide: -1 | 1 = idx === 0 ? -1 : 1;
    const hutchGlassDoor = buildFramedGlassDoor(
      0.668,
      1.320,
      0.026,
      (-hingeSide) as -1 | 1,
      -0.18
    );
    registerCabinetDoor({
      id: `kit_hutch_glass_${idx}`,
      label: idx === 0 ? '玻璃餐具柜左门' : '玻璃餐具柜右门',
      room: 'kitchen',
      parent: hutchGroup,
      centerX: -0.183,
      centerY: 1.572,
      centerZ: hz,
      width: 0.668,
      height: 1.320,
      thickness: 0.026,
      facingAxis: 'x',
      facingSign: -1,
      hingeSide,
      openSign: hingeSide,
      doorMat: oakMat,
      moldingMat: woodMoldingMat,
      handleMat: copperBrassMat,
      customDoorGroup: hutchGlassDoor,
      addRecessedCavity: false,
    });
  }

  kitchenGroup.add(hutchGroup);
  addBoxCollider('col_kit_hutch', 6.84, 1.14, 2.58, 0.70, 2.28, 1.40);

  // =========================================================================
  // Register Dining & Kitchen shared materials into Global Persistent Color Studio (F8)
  apartmentColorStudio.registerMaterialColor('diningWood', '餐桌/餐边柜/橱柜木色', 'dining', [
    oakMat,
    woodPanelMat,
    woodMoldingMat,
  ]);
  apartmentColorStudio.registerMaterialColor('diningWood', '餐桌/餐边柜/橱柜木色', 'dining', darkWoodMat, {
    multiplier: 0.85,
  });
  apartmentColorStudio.registerMaterialColor('diningChairWood', '餐椅实木色', 'dining', chairOiledOakMat);
  apartmentColorStudio.registerMaterialColor('diningChairCushion', '餐椅坐垫布色', 'dining', chairWovenCushionMat);
  apartmentColorStudio.registerMaterialColor('diningCurtain', '餐厅蝴蝶帘色', 'dining', dinCurtainMat);
  apartmentColorStudio.registerMaterialColor('diningTablecloth', '餐厅桌布色调', 'dining', tableclothMat);
  apartmentColorStudio.registerMaterialColor('kitchenCounter', '厨房台面颜色', 'dining', counterTopMat);
  apartmentColorStudio.registerMaterialColor('kitchenBacksplash', '厨房防溅墙砖', 'dining', backsplashTileMat);
  apartmentColorStudio.registerMaterialColor('kitchenFridge', '厨房冰箱/家电色', 'dining', [
    fridgeMat,
    fridgeTrimMat,
    applianceCreamMat,
    applianceTrimMat,
  ]);
  apartmentColorStudio.registerMaterialColor('glassTint', '柜门玻璃色调', 'living', [
    sbGlassMat,
    cabinetGlassMat,
  ]);
  apartmentColorStudio.registerMaterialColor('lampColor', '全屋灯具/光源色调', 'global', shadeOuterMat);

  // 7. MERGE STATIC DINING & KITCHEN GEOMETRIES FOR MINIMAL DRAW CALLS
  // =========================================================================
  mergeStaticGroupToSingleMesh(diningGroup, outlines, 'DiningRoomMergedStaticMesh');
  mergeStaticGroupToSingleMesh(kitchenGroup, outlines, 'KitchenMergedStaticMesh');
}
