import * as THREE from 'three';
import {
  createBeveledBox,
  createBeveledSlab,
  createMoldedDrawerFront,
  createPlushBox,
  createTaperedCurveGeometry,
  createTurnedLegGeometry,
} from '../geometries';
import { createMirrorSurfaceShaderMaterial } from '../pipeline';
import {
  mergeDynamicSubtreeMeshes,
  mergeStaticGroupToSingleMesh,
} from '../SceneManager';
import { apartmentColorStudio } from '../devColorStudio';
import {
  createTabletopPenSet,
  createTabletopTrinketCluster,
  type RoomBuildContext,
} from './roomContext';

const _instPos = new THREE.Vector3();
const _instEuler = new THREE.Euler();
const _instQuat = new THREE.Quaternion();
const _instScale = new THREE.Vector3(1, 1, 1);
const _instMat = new THREE.Matrix4();
const _localMat = new THREE.Matrix4();
const _parentMat = new THREE.Matrix4();
const _instColor = new THREE.Color();

function finalizeInstancedMesh(instMesh: THREE.InstancedMesh): void {
  instMesh.instanceMatrix.needsUpdate = true;
  if (instMesh.instanceColor) {
    instMesh.instanceColor.needsUpdate = true;
  }
  instMesh.computeBoundingSphere();
}

export function buildEntryway(
  ctx: RoomBuildContext,
  playDoorAudio: (open: boolean) => void
): void {
  const {
    scene,
    sceneManager,
    textures,
    outlines,
    collisions,
    doors,
    metaState,
    mat,
    addBoxCollider,
    registerInteractable,
    registerAmbientProp,
  } = ctx;

  const group = new THREE.Group();
  group.name = 'Entryway';
  scene.add(group);
  sceneManager.registerRoomGroup('entryway', group);

  const woodMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xfff8ec,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
  });
  const darkWoodMat = mat({
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
  const darkMetalMat = mat({ color: 0x352e45, roughness: 0.32, metalness: 0.76 });
  const brassMat = mat({ color: 0xc99c58, roughness: 0.3, metalness: 0.82 });
  const doorMat = mat({ color: 0x564d69, roughness: 0.48, metalness: 0.42 });
  const creamMat = mat({ color: 0xfff7fa, roughness: 0.90, metalness: 0.0 });
  const mirrorShaderMat = createMirrorSurfaceShaderMaterial(ctx.uniforms);

  // =========================================================================
  // 1. OPENABLE ARMORED SECURITY FRONT DOOR (West Wall X = -7.96, Z = 4.04 .. 5.16)
  //    Swings outward West (-X) to reveal the eerie Non-Euclidean Hallway!
  // =========================================================================
  const frontDoorFrame = new THREE.Group();
  frontDoorFrame.position.set(-7.96, -0.08, 4.60);

  // Heavy beveled steel outer frame spanning full wall thickness (0.22m)
  const frameJambL = new THREE.Mesh(
    createBeveledBox(0.22, 2.34, 0.08, 0.009, 3),
    darkMetalMat
  );
  frameJambL.position.set(0, 1.17, -0.56);
  frontDoorFrame.add(frameJambL);

  const frameJambR = new THREE.Mesh(
    createBeveledBox(0.22, 2.34, 0.08, 0.009, 3),
    darkMetalMat
  );
  frameJambR.position.set(0, 1.17, 0.56);
  frontDoorFrame.add(frameJambR);

  const frameHeader = new THREE.Mesh(
    createBeveledBox(0.22, 0.09, 1.22, 0.009, 3),
    darkMetalMat
  );
  frameHeader.position.set(0, 2.31, 0);
  frontDoorFrame.add(frameHeader);

  // Low beveled metal floor threshold sill bridging Genkan and outer corridor
  const doorThreshold = new THREE.Mesh(
    createBeveledBox(0.20, 0.024, 1.12, 0.004, 2),
    darkMetalMat
  );
  doorThreshold.position.set(0, 0.012, 0);
  frontDoorFrame.add(doorThreshold);
  // Mount the exterior front door frame on structureGroup (like interior doors) so the
  // exterior West wall opening NEVER leaks bright sky void when viewed from Kitchen/Dining!
  mergeDynamicSubtreeMeshes(frontDoorFrame, outlines, 'FrontDoorFrameMerged');
  ctx.structureGroup.add(frontDoorFrame);

  // Hinged Armored Door Leaf Pivot (hinged at North jamb Z = 4.06, leaf extends along +Z by 1.08m)
  const doorPivot = new THREE.Group();
  doorPivot.userData.dynamic = true;
  doorPivot.position.set(-7.94, -0.08, 4.06);
  ctx.structureGroup.add(doorPivot);

  const doorPanel = new THREE.Mesh(
    createBeveledBox(0.072, 2.26, 1.06, 0.009, 3),
    doorMat
  );
  doorPanel.position.set(0, 1.13, 0.54);
  doorPanel.castShadow = true;
  doorPanel.receiveShadow = true;
  outlines.addOutline(doorPanel, 1.014);
  doorPivot.add(doorPanel);

  // 4 Embossed Beveled Security Stamp Panels (visible on both inner & corridor faces!)
  for (const py of [0.38, 0.86, 1.38, 1.86]) {
    const stamp = new THREE.Mesh(
      createBeveledBox(0.084, 0.36, 0.78, 0.008, 3),
      doorMat
    );
    stamp.position.set(0, py, 0.54);
    doorPivot.add(stamp);
  }

  // Hydraulic door closer box + articulated arm at top
  const closerBox = new THREE.Mesh(
    createBeveledBox(0.06, 0.065, 0.22, 0.01, 2),
    darkMetalMat
  );
  closerBox.position.set(0.06, 2.15, 0.29);
  doorPivot.add(closerBox);

  const closerArm = new THREE.Mesh(
    createBeveledBox(0.02, 0.018, 0.32, 0.005, 2),
    darkMetalMat
  );
  closerArm.position.set(0.075, 2.22, 0.36);
  closerArm.rotation.x = 0.28;
  doorPivot.add(closerArm);

  // Brass peephole lens + ring
  const peephole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.11, 14),
    brassMat
  );
  peephole.rotation.z = Math.PI / 2;
  peephole.position.set(0, 1.56, 0.54);
  doorPivot.add(peephole);

  // Smart Keypad Lock Housing + Dual-Side Lever Handle + Unlocked Dangling Security Chain
  const lockBox = new THREE.Mesh(
    createBeveledBox(0.088, 0.26, 0.11, 0.012, 3),
    darkMetalMat
  );
  lockBox.position.set(0.015, 1.10, 0.94);
  doorPivot.add(lockBox);

  for (const hSide of [-1, 1] as const) {
    const handleGrip = new THREE.Mesh(
      createBeveledBox(0.030, 0.028, 0.14, 0.009, 3),
      brassMat
    );
    handleGrip.position.set(hSide * 0.074, 1.04, 0.89);
    doorPivot.add(handleGrip);
  }

  const lockLedMat = new THREE.MeshBasicMaterial({ color: 0xff3b5c });
  metaState.nonEuclidCorridor.frontDoorLedMat = lockLedMat;
  const lockLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), lockLedMat);
  lockLed.position.set(0.064, 1.18, 0.94);
  doorPivot.add(lockLed);

  // Unlatched security chain dangling loosely down the side of the door
  const chainMount = new THREE.Mesh(
    createBeveledBox(0.036, 0.044, 0.09, 0.006, 2),
    brassMat
  );
  chainMount.position.set(0.048, 1.38, 0.98);
  doorPivot.add(chainMount);

  const danglingChain = new THREE.Mesh(
    createBeveledBox(0.018, 0.16, 0.022, 0.004, 1),
    brassMat
  );
  danglingChain.position.set(0.056, 1.29, 0.98);
  danglingChain.rotation.x = 0.08;
  doorPivot.add(danglingChain);

  // Merge all 13 rigid armored door leaf meshes into 1 single dynamic draw call
  mergeDynamicSubtreeMeshes(doorPivot, outlines, 'FrontDoorLeafMerged');

  const frontDoorColliderId = 'door_col_door_front_entry';
  addBoxCollider(frontDoorColliderId, -7.96, 1.08, 4.60, 0.18, 2.30, 1.12);

  // Register as real openable/pushable room door (swings outward West into -X corridor: negative rotY for z+ leaf!)
  const frontDoorCtrl = {
    id: 'door_front_entry',
    pivot: doorPivot,
    colliderId: frontDoorColliderId,
    isOpen: false,
    closedAngle: 0,
    openAngle: -Math.PI * 0.54,
    currentAngle: 0,
    isRoomDoor: true,
    hingePos: new THREE.Vector3(-7.94, -0.08, 4.06),
    doorWidth: 1.08,
    axisDir: 'z+' as const,
    defaultOpenSign: -1 as const,
    angularVel: 0,
    pushSign: -1 as const,
    isBeingPushed: false,
    wasPassingThrough: false,
    audioPlayedForPush: false,
    closeThudPlayed: false,
    playAudio: playDoorAudio,
  };
  doors.push(frontDoorCtrl);

  registerInteractable('ent_front_door', '公寓防盗门', '推开 / 关上防盗门', 'entryway', doorPivot, () => {
    frontDoorCtrl.isOpen = !frontDoorCtrl.isOpen;
    frontDoorCtrl.isBeingPushed = false;
    frontDoorCtrl.closeThudPlayed = false;
    frontDoorCtrl.angularVel = (frontDoorCtrl.isOpen ? -1 : 1) * 3.0;
    collisions.setEnabled(frontDoorColliderId, false);
    playDoorAudio(frontDoorCtrl.isOpen);
    return frontDoorCtrl.isOpen
      ? {
          title: '公寓入户防盗门 · 已解锁',
          message: '门锁轻响一声弹开了。门外是一条望不到尽头的空寂走廊——但不知为何，远处的轮廓似乎正悄悄向你逼近。',
          metaTrigger: true,
        }
      : {
          title: '公寓入户防盗门',
          message: '沉重的防盗门缓缓合上，将那条诡异的走廊隔绝在门外。',
        };
  });

  // =========================================================================
  // 2. CRAFTED JAPANESE SHOE CABINET (下駄箱) (X = -5.15, Z = 2.80)
  // =========================================================================
  const cabinet = new THREE.Group();
  cabinet.position.set(-5.15, 0, 2.80);

  // Overhanging beveled top slab
  const cabTop = new THREE.Mesh(
    createBeveledSlab(1.56, 0.030, 0.46, 0.025, 0.008),
    woodMat
  );
  cabTop.position.y = 1.115;
  cabTop.castShadow = true;
  cabTop.receiveShadow = true;
  outlines.addOutline(cabTop, 1.015);
  cabinet.add(cabTop);

  // Main beveled cabinet body (raised above open bottom shoe shelf)
  const cabBody = new THREE.Mesh(
    createBeveledBox(1.48, 0.88, 0.4, 0.012, 2),
    woodMat
  );
  cabBody.position.y = 0.66;
  cabBody.castShadow = true;
  cabBody.receiveShadow = true;
  outlines.addOutline(cabBody, 1.015);
  cabinet.add(cabBody);

  // 3 Upper Color-Blocked White Drawers + 3 Lower Molded Doors (`createMoldedDrawerFront`)
  for (const dx of [-0.48, 0, 0.48]) {
    const upperDrawer = createMoldedDrawerFront(
      0.44,
      0.18,
      0.028,
      'z',
      drawerWhiteMat,
      drawerMoldingMat,
      brassMat,
      1
    );
    upperDrawer.position.set(dx, 0.96, 0.208);
    cabinet.add(upperDrawer);

    const lowerDoor = createMoldedDrawerFront(
      0.44,
      0.58,
      0.028,
      'z',
      drawerWhiteMat,
      drawerMoldingMat,
      darkMetalMat,
      1
    );
    lowerDoor.position.set(dx, 0.54, 0.208);
    cabinet.add(lowerDoor);
  }

  // Turned stub legs
  const cabLegGeo = createTurnedLegGeometry(0.022, 0.013, 0.22);
  for (const lx of [-0.66, 0.66]) {
    for (const lz of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(cabLegGeo, darkWoodMat);
      leg.position.set(lx, 0.11, lz);
      cabinet.add(leg);
    }
  }

  // Sculpted Ceramic Key Dish + Brass Key & Pink Charm on Top
  const dishPts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.09, 0),
    new THREE.Vector2(0.125, 0.025),
    new THREE.Vector2(0.115, 0.034),
    new THREE.Vector2(0.08, 0.012),
    new THREE.Vector2(0.0008, 0.012),
  ];
  const keyTray = new THREE.Mesh(
    new THREE.LatheGeometry(dishPts, 20),
    mat({ color: 0xf2eaf7, roughness: 0.25 })
  );
  keyTray.position.set(-0.38, 1.142, 0.02);
  keyTray.castShadow = true;
  outlines.addOutline(keyTray, 1.05);
  cabinet.add(keyTray);

  const keyTrinketGroup = new THREE.Group();
  keyTrinketGroup.position.set(-0.38, 1.16, 0.02);

  const keyRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.022, 0.004, 8, 14),
    brassMat
  );
  keyRing.rotation.x = Math.PI / 2;
  keyRing.position.set(-0.01, 0, 0);
  keyTrinketGroup.add(keyRing);

  const keyShaft = new THREE.Mesh(
    createBeveledBox(0.065, 0.008, 0.018, 0.003, 2),
    brassMat
  );
  keyShaft.position.set(0.03, 0, 0.01);
  keyShaft.rotation.y = 0.4;
  keyTrinketGroup.add(keyShaft);

  const charmTag = new THREE.Mesh(
    createBeveledBox(0.038, 0.012, 0.028, 0.005, 2),
    mat({ color: 0xe86b8c, roughness: 0.4 })
  );
  charmTag.position.set(-0.04, 0.002, -0.01);
  charmTag.rotation.y = -0.3;
  keyTrinketGroup.add(charmTag);
  cabinet.add(keyTrinketGroup);

  // Delivery Sign-off Pen & Stacked Brass Coins on Shoe Cabinet Top
  const { penGroup: entPen } = createTabletopPenSet(ctx, 0x3b4d5e, false);
  entPen.position.set(0.06, 1.130, 0.04);
  entPen.rotation.y = 0.62;
  cabinet.add(entPen);
  registerAmbientProp({
    id: 'ent_cab_pen',
    room: 'entryway',
    mesh: entPen,
    worldPos: [-5.09, 1.130, 2.84],
    kind: 'roller',
    maxDrift: 0.032,
    rollRadius: 0.0056,
    rollAxis: 'x',
    reactivity: 1.28,
  });

  const entCoins = createTabletopTrinketCluster(ctx, 'coins_tag');
  entCoins.position.set(0.18, 1.130, -0.02);
  entCoins.rotation.y = -0.25;
  cabinet.add(entCoins);
  registerAmbientProp({
    id: 'ent_cab_coins',
    room: 'entryway',
    mesh: entCoins,
    worldPos: [-4.97, 1.130, 2.78],
    kind: 'trinket',
    maxDrift: 0.026,
    reactivity: 1.20,
  });

  // Lathe Terracotta Pot + Layered Rosette Succulent on Right End
  const potPts = [
    new THREE.Vector2(0.0008, 0),
    new THREE.Vector2(0.055, 0),
    new THREE.Vector2(0.078, 0.11),
    new THREE.Vector2(0.084, 0.13),
    new THREE.Vector2(0.072, 0.13),
  ];
  const miniPot = new THREE.Mesh(
    new THREE.LatheGeometry(potPts, 16),
    mat({ color: 0xdf9e7d, roughness: 0.65 })
  );
  miniPot.position.set(0.46, 1.142, -0.04);
  miniPot.castShadow = true;
  outlines.addOutline(miniPot, 1.05);
  cabinet.add(miniPot);

  const succMat = mat({ color: 0x628c65, roughness: 0.68 });
  const petalGeo = createPlushBox(0.042, 0.022, 0.065, 0.009, 0.2);
  const petalsInst = new THREE.InstancedMesh(petalGeo, succMat, 8);
  for (let l = 0; l < 8; l++) {
    const ang = (l / 8) * Math.PI * 2;
    _instPos.set(
      0.46 + Math.cos(ang) * 0.038,
      1.28,
      -0.04 + Math.sin(ang) * 0.038
    );
    _instEuler.set(0.35, -ang + Math.PI / 2, 0);
    _instQuat.setFromEuler(_instEuler);
    _instMat.compose(_instPos, _instQuat, _instScale);
    petalsInst.setMatrixAt(l, _instMat);
  }
  finalizeInstancedMesh(petalsInst);
  cabinet.add(petalsInst);

  group.add(cabinet);
  addBoxCollider('col_shoe_cabinet', -5.15, 0.6, 2.80, 1.58, 1.2, 0.5);

  registerInteractable('ent_keys', '玄关钥匙盘', '查看备用钥匙', 'entryway', keyTray, () => ({
    title: '玄关陶瓷钥匙盘',
    message: '里面躺着一把带粉色爱心吊坠的黄铜钥匙，标签写着“地下室备用”，但钥匙齿已经被人为挫平了。',
  }));

  registerAmbientProp({
    id: 'ent_key_tray',
    room: 'entryway',
    mesh: keyTray,
    worldPos: [-5.53, 1.142, 2.82],
    kind: 'wobble',
    maxDrift: 0.015,
    reactivity: 0.82,
  });
  registerAmbientProp({
    id: 'ent_key_charm',
    room: 'entryway',
    mesh: keyTrinketGroup,
    worldPos: [-5.53, 1.16, 2.82],
    kind: 'trinket',
    maxDrift: 0.016,
    reactivity: 1.32,
  });

  // =========================================================================
  // 3. PLUSH SCULPTED SLIPPERS IN SUNKEN GENKAN (Y = -0.08) (INSTANCED MESHES!)
  // =========================================================================
  const soleGeo = createBeveledSlab(0.115, 0.024, 0.26, 0.05, 0.007);
  const insoleGeo = createBeveledSlab(0.102, 0.012, 0.24, 0.045, 0.004);
  const vampGeo = createPlushBox(0.112, 0.048, 0.12, 0.022, 0.18);

  const soleMat = mat({ color: 0xdfd6e8, roughness: 0.85 });
  const slipperInstMat = mat({ color: 0xffffff, roughness: 0.78 });

  const solesInst = new THREE.InstancedMesh(soleGeo, soleMat, 4);
  solesInst.castShadow = true;

  const insolesInst = new THREE.InstancedMesh(insoleGeo, slipperInstMat, 4);
  insolesInst.userData.dynamic = true;

  const vampsInst = new THREE.InstancedMesh(vampGeo, slipperInstMat, 4);
  vampsInst.castShadow = true;
  vampsInst.userData.dynamic = true;

  const slipperSpecs: [number, number, number, number][] = [
    [-6.55, 4.05, 0.1, 0x5c6f9c],
    [-6.55, 4.28, 0.08, 0x5c6f9c],
    // Eerily angled red pair facing INTO the house
    [-6.25, 5.05, -1.4, 0xc74e5e],
    [-6.30, 5.26, -1.75, 0xc74e5e],
  ];

  for (let i = 0; i < slipperSpecs.length; i++) {
    const [sx, sz, rotY, colHex] = slipperSpecs[i];
    _instPos.set(sx, -0.08, sz);
    _instEuler.set(0, rotY, 0);
    _instQuat.setFromEuler(_instEuler);
    _parentMat.compose(_instPos, _instQuat, _instScale);

    // Sole
    _instPos.set(0, 0.012, 0);
    _instEuler.set(0, 0, 0);
    _instQuat.setFromEuler(_instEuler);
    _localMat.compose(_instPos, _instQuat, _instScale);
    _instMat.multiplyMatrices(_parentMat, _localMat);
    solesInst.setMatrixAt(i, _instMat);

    // Insole
    _instPos.set(0, 0.024, 0);
    _localMat.compose(_instPos, _instQuat, _instScale);
    _instMat.multiplyMatrices(_parentMat, _localMat);
    insolesInst.setMatrixAt(i, _instMat);
    insolesInst.setColorAt(i, _instColor.setHex(colHex));

    // Vamp
    _instPos.set(0, 0.042, -0.03);
    _localMat.compose(_instPos, _instQuat, _instScale);
    _instMat.multiplyMatrices(_parentMat, _localMat);
    vampsInst.setMatrixAt(i, _instMat);
    vampsInst.setColorAt(i, _instColor.setHex(colHex));
  }
  finalizeInstancedMesh(solesInst);
  finalizeInstancedMesh(insolesInst);
  finalizeInstancedMesh(vampsInst);
  group.add(solesInst);
  group.add(insolesInst);
  group.add(vampsInst);

  // =========================================================================
  // 4. WALL-MOUNTED WOODEN COAT RACK WITH HANGING PINK COAT & GREEN JACKET,
  //    ROYAL-BLUE UMBRELLA BIN & WALL ELECTRICAL BREAKER BOX (Screenshot 3!)
  // =========================================================================
  const stand = new THREE.Group();
  stand.position.set(-7.28, -0.08, 6.12);

  // Wall-mounted horizontal oak coat-hook rail & top hat shelf on South/West corner wall
  const coatWallBoard = new THREE.Mesh(
    createBeveledBox(0.76, 0.12, 0.032, 0.008, 2),
    woodMat
  );
  coatWallBoard.position.set(0.08, 1.66, 0.46);
  coatWallBoard.castShadow = true;
  outlines.addOutline(coatWallBoard, 1.022);
  stand.add(coatWallBoard);

  const coatTopLedge = new THREE.Mesh(
    createBeveledBox(0.78, 0.028, 0.18, 0.006, 2),
    woodMat
  );
  coatTopLedge.position.set(0.08, 1.72, 0.39);
  coatTopLedge.castShadow = true;
  stand.add(coatTopLedge);

  // 4 Brushed-metal coat hooks along the wall board
  for (const hx of [-0.20, -0.02, 0.16, 0.34]) {
    const hookCurve = [
      new THREE.Vector3(hx, 1.65, 0.44),
      new THREE.Vector3(hx, 1.61, 0.38),
      new THREE.Vector3(hx, 1.66, 0.35),
    ];
    const hook = new THREE.Mesh(
      createTaperedCurveGeometry(hookCurve, 0.009, 0.006, 10, 6),
      darkMetalMat
    );
    stand.add(hook);
  }

  // Draped Rose-Pink Long Coat (left hook) & Olive-Green Jacket (right hook) with UV fold shading (Screenshot 3!)
  const pinkCoatMat = mat({
    map: textures.curtainFabric,
    bumpMap: textures.curtainBump,
    bumpScale: 0.018,
    color: 0xe07898,
    roughness: 0.78,
  });
  const pinkCoat = new THREE.Mesh(
    createPlushBox(0.28, 0.82, 0.16, 0.048, 0.20),
    pinkCoatMat
  );
  pinkCoat.position.set(-0.12, 1.22, 0.34);
  pinkCoat.rotation.set(0.04, 0.10, -0.06);
  pinkCoat.castShadow = true;
  outlines.addOutline(pinkCoat, 1.03);
  stand.add(pinkCoat);

  const greenJacketMat = mat({
    map: textures.curtainFabric,
    bumpMap: textures.curtainBump,
    bumpScale: 0.018,
    color: 0x5c8a58,
    roughness: 0.80,
  });
  const greenJacket = new THREE.Mesh(
    createPlushBox(0.26, 0.64, 0.15, 0.044, 0.18),
    greenJacketMat
  );
  greenJacket.position.set(0.22, 1.30, 0.35);
  greenJacket.rotation.set(0.03, -0.12, 0.07);
  greenJacket.castShadow = true;
  outlines.addOutline(greenJacket, 1.03);
  stand.add(greenJacket);

  // Royal-Blue Cylindrical Umbrella Stand Bin underneath the coats (Screenshot 3!)
  const umbrellaBinMat = mat({
    color: 0x4668b8,
    roughness: 0.38,
    metalness: 0.18,
  });
  const umbBinBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.125, 0.48, 18),
    umbrellaBinMat
  );
  umbBinBody.position.set(0.04, 0.24, 0.12);
  umbBinBody.castShadow = true;
  umbBinBody.receiveShadow = true;
  outlines.addOutline(umbBinBody, 1.03);
  stand.add(umbBinBody);

  const umbBinCavity = new THREE.Mesh(
    new THREE.CircleGeometry(0.132, 16),
    darkMetalMat
  );
  umbBinCavity.rotation.x = -Math.PI / 2;
  umbBinCavity.position.set(0.04, 0.481, 0.12);
  stand.add(umbBinCavity);

  // Rolled Umbrella with J-Handle sticking out of the blue umbrella bin
  const umbrellaCanopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.042, 0.62, 12),
    mat({ color: 0xf088a8, roughness: 0.62 })
  );
  umbrellaCanopy.rotation.x = Math.PI;
  umbrellaCanopy.position.set(0.02, 0.42, 0.12);
  umbrellaCanopy.rotation.z = 0.12;
  stand.add(umbrellaCanopy);

  const jHandlePts = [
    new THREE.Vector3(0.02, 0.68, 0.12),
    new THREE.Vector3(0.00, 0.79, 0.12),
    new THREE.Vector3(-0.04, 0.83, 0.12),
    new THREE.Vector3(-0.08, 0.79, 0.12),
  ];
  const jHandle = new THREE.Mesh(
    createTaperedCurveGeometry(jHandlePts, 0.011, 0.011, 14, 8),
    creamMat
  );
  stand.add(jHandle);

  // Wall-Mounted Electrical Distribution Breaker Box (配电箱) beside the Front Door (Screenshot 3!)
  const breakerGroup = new THREE.Group();
  breakerGroup.position.set(-7.84, 1.72, 3.68);
  const breakerHousing = new THREE.Mesh(
    createBeveledBox(0.056, 0.32, 0.44, 0.010, 2),
    creamMat
  );
  breakerHousing.castShadow = true;
  outlines.addOutline(breakerHousing, 1.03);
  breakerGroup.add(breakerHousing);

  // Dark internal circuit-breaker rail & row of miniature switches
  const breakerRail = new THREE.Mesh(
    createBeveledBox(0.016, 0.14, 0.32, 0.003, 1),
    darkMetalMat
  );
  breakerRail.position.set(0.024, 0.01, 0);
  breakerGroup.add(breakerRail);

  for (let sw = -3; sw <= 3; sw++) {
    const swToggle = new THREE.Mesh(
      createBeveledBox(0.012, 0.036, 0.022, 0.002, 1),
      mat({ color: sw === 0 ? 0xd93b48 : 0x3b68b8, roughness: 0.4 })
    );
    swToggle.position.set(0.032, 0.01, sw * 0.038);
    breakerGroup.add(swToggle);
  }

  // Translucent blue-tinted polycarbonate inspection window cover on the breaker box
  const breakerCover = new THREE.Mesh(
    createBeveledBox(0.014, 0.22, 0.36, 0.004, 1),
    mat({
      color: 0x7ab4e8,
      roughness: 0.18,
      metalness: 0.1,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
    })
  );
  breakerCover.position.set(0.034, 0.01, 0);
  breakerCover.userData.dynamic = true;
  breakerGroup.add(breakerCover);
  group.add(breakerGroup);

  group.add(stand);
  addBoxCollider('col_coat_rack', -7.28, 0.8, 6.12, 0.48, 1.8, 0.48);

  // =========================================================================
  // 5. CHAMFERED FULL-LENGTH WALL MIRROR (South Wall X = -4.40, Z = 6.62)
  // =========================================================================
  const mirrorGroup = new THREE.Group();
  mirrorGroup.position.set(-4.40, 1.48, 6.62);

  const mOuterFrame = new THREE.Mesh(
    createBeveledBox(0.78, 1.44, 0.038, 0.010, 2),
    woodMat
  );
  mOuterFrame.castShadow = true;
  outlines.addOutline(mOuterFrame, 1.016);
  mirrorGroup.add(mOuterFrame);

  const mInnerBevel = new THREE.Mesh(
    createBeveledBox(0.68, 1.34, 0.034, 0.006, 2),
    darkWoodMat
  );
  mInnerBevel.position.z = 0.002;
  mirrorGroup.add(mInnerBevel);

  const mGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.28), mirrorShaderMat);
  mGlass.userData.dynamic = true;
  mGlass.rotation.y = Math.PI;
  mGlass.position.z = -0.022;
  mirrorGroup.add(mGlass);
  group.add(mirrorGroup);

  const mirrorRig = {
    id: 'ent_mirror',
    room: 'entryway' as const,
    mesh: mGlass,
    material: mirrorShaderMat,
    normal: new THREE.Vector3(0, 0, -1),
    planePoint: new THREE.Vector3(-4.40, 1.48, 6.598),
    glitchBurstTimer: 0,
  };
  ctx.mirrors.push(mirrorRig);

  // Register Entryway shared materials into Global Persistent Color Studio (F8)
  apartmentColorStudio.registerMaterialColor('entryWood', '玄关鞋柜/家具木色', 'bathEntry', [
    woodMat,
    drawerWhiteMat,
    drawerMoldingMat,
  ]);
  apartmentColorStudio.registerMaterialColor('entryWood', '玄关鞋柜/家具木色', 'bathEntry', darkWoodMat, {
    multiplier: 0.9,
  });
  apartmentColorStudio.registerMaterialColor('entryFrontDoor', '入户防盗门色', 'bathEntry', doorMat);
  apartmentColorStudio.registerMaterialColor('entryFrontFrame', '入户门框金属', 'bathEntry', darkMetalMat);

  // Merge all static Entryway meshes into a single draw call
  mergeStaticGroupToSingleMesh(group, outlines, 'EntrywayMergedStaticMesh');
}
