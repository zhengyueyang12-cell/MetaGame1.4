import * as THREE from 'three';
import {
  createBeveledBox,
  createBeveledSlab,
  createBookGeometry,
  createMoldedDrawerFront,
  createPinchedPlumpPillowGeometry,
  createPlushBox,
  createTurnedLegGeometry,
} from '../geometries';
import { mergeStaticGroupToSingleMesh } from '../SceneManager';
import { createErgonomicSwivelChair } from '../entities/buildErgonomicChair';
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

/**
 * Generates a crisp procedural circular rosy-pink MiSide rug texture with a cream border ring.
 */
function createCircularPinkRugTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  // Soft rosy-pink woven base
  const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 250);
  grad.addColorStop(0.0, '#f388a5');
  grad.addColorStop(0.76, '#ec7697');
  grad.addColorStop(1.0, '#df6889');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle concentric weave texture
  ctx.strokeStyle = 'rgba(255, 240, 245, 0.09)';
  ctx.lineWidth = 1.5;
  for (let r = 24; r < 245; r += 9) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Signature MiSide cream ring border near the perimeter (Screenshot 2)
  ctx.strokeStyle = '#fdebf0';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 224, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(220, 108, 140, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 215, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a cute pastel framed wall print texture (hearts / anime character art / pastel sky).
 */
function createPastelArtTexture(variant: 'girl' | 'heart' | 'clouds'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d')!;

  if (variant === 'girl') {
    const bg = ctx.createLinearGradient(0, 0, 0, 320);
    bg.addColorStop(0, '#ffe3ee');
    bg.addColorStop(1, '#f4d9f7');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 320);
    // Stylized pastel anime ribbon & silhouette
    ctx.fillStyle = '#5367b5';
    ctx.beginPath();
    ctx.arc(128, 128, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe5dc';
    ctx.beginPath();
    ctx.arc(128, 134, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e35578';
    ctx.beginPath();
    ctx.moveTo(86, 240);
    ctx.lineTo(170, 240);
    ctx.lineTo(154, 174);
    ctx.lineTo(102, 174);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4e6ec2';
    ctx.fillRect(82, 238, 92, 42);
  } else if (variant === 'heart') {
    const bg = ctx.createLinearGradient(0, 0, 256, 320);
    bg.addColorStop(0, '#ffdbe7');
    bg.addColorStop(1, '#fbe8f4');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = '#ef7092';
    ctx.beginPath();
    ctx.moveTo(128, 224);
    ctx.bezierCurveTo(64, 176, 48, 112, 92, 92);
    ctx.bezierCurveTo(116, 82, 128, 108, 128, 118);
    ctx.bezierCurveTo(128, 108, 140, 82, 164, 92);
    ctx.bezierCurveTo(208, 112, 192, 176, 128, 224);
    ctx.fill();
  } else {
    const bg = ctx.createLinearGradient(0, 0, 0, 320);
    bg.addColorStop(0, '#c8dffb');
    bg.addColorStop(0.65, '#fbd8e8');
    bg.addColorStop(1, '#fff0d8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 320);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (const [x, y, r] of [
      [78, 145, 28],
      [106, 138, 34],
      [138, 148, 26],
      [172, 196, 24],
      [196, 190, 30],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function buildBedroom(ctx: RoomBuildContext, playDoorAudio: (open: boolean) => void): void {
  const {
    scene,
    sceneManager,
    uniforms,
    textures,
    outlines,
    mat,
    addBoxCollider,
    registerInteractable,
    registerCabinetDoor,
    registerDoor,
    registerAmbientProp,
    clockRigs,
    metaState,
  } = ctx;

  const group = new THREE.Group();
  group.name = 'Bedroom';
  scene.add(group);
  sceneManager.registerRoomGroup('bedroom', group);

  // =========================================================================
  // MISIDE BEDROOM PALETTE: Crisp Creamy-White + Pastel Pink + Sky Blue + Honey Oak Door
  // =========================================================================
  const whiteFurnMat = mat({
    color: 0xfbf6f6,
    roughness: 0.50,
    metalness: 0.02,
    woodLacquer: 0.56,
    celStrength: 0.50,
  });
  const whiteTrimMat = mat({
    color: 0xf6eaee,
    roughness: 0.54,
    metalness: 0.02,
    woodLacquer: 0.52,
    celStrength: 0.50,
  });
  const pastelPinkMat = mat({
    color: 0xf7b2c6,
    roughness: 0.52,
    metalness: 0.02,
    woodLacquer: 0.48,
    celStrength: 0.50,
  });
  const softPinkFabricMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.012,
    color: 0xfac8d7,
    roughness: 0.92,
    metalness: 0.0,
    celStrength: 0.36,
  });
  const rosyPinkMat = mat({
    color: 0xef85a3,
    roughness: 0.56,
    metalness: 0.02,
    woodLacquer: 0.44,
    celStrength: 0.50,
  });
  const skyBlueMat = mat({
    color: 0x779ce2,
    roughness: 0.56,
    metalness: 0.04,
    celStrength: 0.50,
  });
  const softBlueFabricMat = mat({
    color: 0x5c84d6,
    roughness: 0.85,
    metalness: 0.0,
    celStrength: 0.45,
  });
  // Unified clear luminous honey satin-matte oak wooden door matching Living Room wooden door
  const doorMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.005,
    color: 0xfff6e6,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
  });
  const silverMetalMat = mat({ color: 0xd4cedc, roughness: 0.28, metalness: 0.65 });
  const darkMetalMat = mat({ color: 0x453d54, roughness: 0.38, metalness: 0.62 });
  const brassMat = mat({ color: 0xd9b168, roughness: 0.30, metalness: 0.75 });

  // Crisp snowy-white duvet & soft blush-pink bedding (Screenshots 2 & 3)
  const duvetMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.016,
    color: 0xfff8fa,
    roughness: 0.92,
    metalness: 0.0,
    celStrength: 0.32,
  });
  const sheetMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.012,
    color: 0xfffafc,
    roughness: 0.91,
    metalness: 0.0,
    celStrength: 0.32,
  });
  const pinkThrowMat = mat({
    map: textures.plushFabric,
    bumpMap: textures.plushBump,
    bumpScale: 0.015,
    color: 0xf7b8ca,
    roughness: 0.93,
    metalness: 0.0,
    celStrength: 0.34,
  });

  // =========================================================================
  // 0. FLOOR RUGS: LARGE CIRCULAR ROSY-PINK RUG + SOFT BLUSH BED RUNNER RUG
  //    (Exact match to MiSide Screenshot 2!)
  // =========================================================================
  const pinkRugTex = createCircularPinkRugTexture();
  const circleRug = new THREE.Mesh(
    new THREE.CylinderGeometry(1.42, 1.44, 0.014, 48),
    mat({
      map: pinkRugTex,
      bumpMap: textures.plushBump,
      bumpScale: 0.008,
      color: 0xffffff,
      roughness: 0.94,
      metalness: 0.0,
      celStrength: 0.34,
    })
  );
  circleRug.position.set(-3.75, 0.008, -2.72);
  circleRug.receiveShadow = true;
  outlines.addOutline(circleRug, 1.008);
  group.add(circleRug);

  // Soft blush-ivory rectangular rug beneath the bed & foot-of-bed bench
  const bedRug = new THREE.Mesh(
    createBeveledSlab(2.85, 0.014, 2.55, 0.24, 0.004),
    mat({
      map: textures.plushFabric,
      color: 0xfae5ec,
      roughness: 0.95,
      metalness: 0.0,
      celStrength: 0.32,
    })
  );
  bedRug.position.set(-5.92, 0.007, -4.05);
  bedRug.receiveShadow = true;
  group.add(bedRug);

  // Small pastel-pink mat under the PC desk & swivel chair (Screenshot 3!)
  const deskRug = new THREE.Mesh(
    createBeveledSlab(1.18, 0.012, 0.72, 0.14, 0.003),
    mat({
      map: textures.plushFabric,
      color: 0xf49bb6,
      roughness: 0.94,
      metalness: 0.0,
      celStrength: 0.34,
    })
  );
  deskRug.position.set(-2.58, 0.007, -5.56);
  deskRug.receiveShadow = true;
  group.add(deskRug);

  // =========================================================================
  // 1. HINGED HONEY-OAK BEDROOM DOOR (X = -1.22, Z = -4.15 .. -3.05)
  // =========================================================================
  registerDoor(
    'door_bedroom',
    '卧室木门',
    'bedroom',
    -1.22,
    0,
    -4.15,
    1.10,
    2.2,
    'z+',
    1,
    doorMat,
    silverMetalMat,
    playDoorAudio
  );

  // =========================================================================
  // 2. MISIDE CRISP WHITE & PASTEL-PINK BED (X = -6.54, Z = -4.05)
  //    + UPHOLSTERED FOOT-OF-BED BENCH WITH DRAPED THROW & FRIED-EGG CUSHION!
  // =========================================================================
  const bed = new THREE.Group();
  bed.position.set(-6.54, 0, -4.05);

  // Crisp white paneled platform bedframe (2.52m x 2.02m)
  const frame = new THREE.Mesh(
    createBeveledSlab(2.52, 0.17, 2.02, 0.036, 0.011),
    whiteFurnMat
  );
  frame.position.y = 0.245;
  frame.castShadow = true;
  frame.receiveShadow = true;
  outlines.addOutline(frame, 1.015);
  bed.add(frame);

  // Subtle pastel-pink side trim molding + crisp white under-bed storage drawers
  for (const sideSign of [-1, 1] as const) {
    for (const dx of [-0.50, 0.50]) {
      const underBedDrawer = createMoldedDrawerFront(
        0.88,
        0.15,
        0.026,
        'z',
        whiteFurnMat,
        whiteTrimMat,
        pastelPinkMat,
        sideSign
      );
      underBedDrawer.position.set(dx, 0.245, sideSign * 1.015);
      bed.add(underBedDrawer);
    }
  }

  // Turned white wooden bed legs (Instanced)
  const bedLegGeo = createTurnedLegGeometry(0.038, 0.024, 0.16);
  const bedLegsInst = new THREE.InstancedMesh(bedLegGeo, whiteFurnMat, 4);
  const bedLegCoords: [number, number][] = [
    [-1.14, -0.88],
    [1.14, -0.88],
    [-1.14, 0.88],
    [1.14, 0.88],
  ];
  for (let i = 0; i < bedLegCoords.length; i++) {
    setInstanceTransform(
      bedLegsInst,
      i,
      bedLegCoords[i][0],
      0.08,
      bedLegCoords[i][1]
    );
  }
  finalizeInstancedMesh(bedLegsInst);
  bed.add(bedLegsInst);

  // Helper: create a smooth arched headboard / footboard panel extruded along X (spanning Z = -halfW .. +halfW)
  const createArchedBoardGeometry = (
    widthZ: number,
    sideHeight: number,
    archRise: number,
    thicknessX: number,
    bevel = 0.012
  ): THREE.BufferGeometry => {
    const hw = widthZ * 0.5;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, 0);
    shape.lineTo(-hw, sideHeight);
    shape.quadraticCurveTo(0, sideHeight + archRise * 2.0, hw, sideHeight);
    shape.lineTo(hw, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thicknessX,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel * 0.9,
      bevelSegments: 3,
      curveSegments: 26,
    });
    // Center thickness along Z then rotate +90deg around Y so width spans Z and thickness spans X
    geo.translate(0, 0, -thicknessX * 0.5);
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  };

  // Crisp White Arched Headboard (圆弧形床头, matching MiSide reference!)
  const hbGroup = new THREE.Group();
  hbGroup.position.set(-1.23, 0, 0);

  // Main smoothly arched solid headboard body (side height 0.94m, convex arch apex 1.32m)
  const hbArchMain = new THREE.Mesh(
    createArchedBoardGeometry(2.08, 0.94, 0.38, 0.064, 0.014),
    whiteFurnMat
  );
  hbArchMain.position.set(0, 0.08, 0);
  hbArchMain.castShadow = true;
  hbArchMain.receiveShadow = true;
  outlines.addOutline(hbArchMain, 1.014);
  hbGroup.add(hbArchMain);

  // Inner softly stepped arched decorative relief panel on the room-facing (+X) face
  const hbArchInset = new THREE.Mesh(
    createArchedBoardGeometry(1.80, 0.78, 0.30, 0.016, 0.008),
    whiteTrimMat
  );
  hbArchInset.position.set(0.036, 0.16, 0);
  hbArchInset.receiveShadow = true;
  hbGroup.add(hbArchInset);

  // Subtle rounded vertical side pilasters flush with the arch shoulders (no spiky square posts!)
  for (const sz of [-1.02, 1.02]) {
    const sidePilaster = new THREE.Mesh(
      createBeveledBox(0.084, 0.94, 0.068, 0.020, 3),
      whiteFurnMat
    );
    sidePilaster.position.set(0.0, 0.55, sz);
    sidePilaster.castShadow = true;
    sidePilaster.receiveShadow = true;
    hbGroup.add(sidePilaster);
  }

  bed.add(hbGroup);

  // Matching Gently Arched Low Footboard at the East end of the bed (matching MiSide reference!)
  const footboard = new THREE.Group();
  footboard.position.set(1.25, 0, 0);

  const fbArchMain = new THREE.Mesh(
    createArchedBoardGeometry(2.04, 0.44, 0.18, 0.052, 0.012),
    whiteFurnMat
  );
  fbArchMain.position.set(0, 0.12, 0);
  fbArchMain.castShadow = true;
  fbArchMain.receiveShadow = true;
  outlines.addOutline(fbArchMain, 1.015);
  footboard.add(fbArchMain);

  const fbArchInset = new THREE.Mesh(
    createArchedBoardGeometry(1.76, 0.32, 0.14, 0.014, 0.006),
    whiteTrimMat
  );
  fbArchInset.position.set(0.030, 0.18, 0);
  footboard.add(fbArchInset);

  for (const sz of [-1.01, 1.01]) {
    const fbLeg = new THREE.Mesh(
      createBeveledBox(0.072, 0.54, 0.064, 0.018, 2),
      whiteFurnMat
    );
    fbLeg.position.set(0, 0.30, sz);
    fbLeg.castShadow = true;
    footboard.add(fbLeg);
  }
  bed.add(footboard);

  // Plump Quilted Mattress
  const mattress = new THREE.Mesh(
    createPlushBox(2.34, 0.24, 1.86, 0.042, 0.08),
    sheetMat
  );
  mattress.position.set(0.02, 0.445, 0);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  bed.add(mattress);

  // Snowy White Plush Duvet Quilt with Side Waterfall Drapes + Soft Pastel-Pink Foot Runner
  const duvetMain = new THREE.Mesh(
    createPlushBox(1.66, 0.19, 1.90, 0.052, 0.12),
    duvetMat
  );
  duvetMain.position.set(0.35, 0.50, 0);
  duvetMain.castShadow = true;
  duvetMain.receiveShadow = true;
  outlines.addOutline(duvetMain, 1.015);
  bed.add(duvetMain);

  for (const sideZ of [-0.95, 0.95]) {
    const sideDrape = new THREE.Mesh(
      createPlushBox(1.58, 0.21, 0.13, 0.040, 0.11),
      duvetMat
    );
    sideDrape.position.set(0.36, 0.415, sideZ);
    sideDrape.rotation.x = sideZ > 0 ? 0.12 : -0.12;
    sideDrape.castShadow = true;
    sideDrape.receiveShadow = true;
    bed.add(sideDrape);
  }

  // Soft pastel-pink folded blanket runner draped across lower third of the duvet
  const pinkFootBlanket = new THREE.Mesh(
    createPlushBox(0.62, 0.068, 1.94, 0.030, 0.12),
    pinkThrowMat
  );
  pinkFootBlanket.position.set(0.84, 0.585, 0);
  pinkFootBlanket.castShadow = true;
  pinkFootBlanket.receiveShadow = true;
  outlines.addOutline(pinkFootBlanket, 1.016);
  bed.add(pinkFootBlanket);

  // Softly rolled pastel-pink top sheet cuff
  const sheetFold = new THREE.Mesh(
    createPlushBox(0.28, 0.22, 1.92, 0.052, 0.12),
    pinkThrowMat
  );
  sheetFold.position.set(-0.44, 0.50, 0);
  sheetFold.castShadow = true;
  sheetFold.receiveShadow = true;
  bed.add(sheetFold);

  // 2 Crisp White Plump Sleeping Pillows + Pastel-Pink Pinched Throw Pillow + Plush Star Pillow (Screenshot 3!)
  const pillowGeo = createPlushBox(0.46, 0.17, 0.72, 0.066, 0.26);
  const pillowsInst = new THREE.InstancedMesh(pillowGeo, sheetMat, 2);
  pillowsInst.castShadow = true;
  pillowsInst.receiveShadow = true;
  setInstanceTransform(pillowsInst, 0, -0.88, 0.65, -0.45, 0.04, 0.06, -0.24);
  setInstanceTransform(pillowsInst, 1, -0.88, 0.65, 0.45, -0.04, -0.05, -0.24);
  finalizeInstancedMesh(pillowsInst);
  bed.add(pillowsInst);

  const accentThrowPillow = new THREE.Mesh(
    createPinchedPlumpPillowGeometry(0.42, 0.36, 0.145, 1.7),
    softPinkFabricMat
  );
  accentThrowPillow.position.set(-0.66, 0.67, 0.04);
  accentThrowPillow.rotation.set(0.04, 1.52, -0.34);
  accentThrowPillow.castShadow = true;
  outlines.addOutline(accentThrowPillow, 1.022);
  bed.add(accentThrowPillow);

  // Cute Plush Star Cushion resting near the foot of the bed (Screenshot 3!)
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.17 : 0.088;
    if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  starGeo.center();
  const starCushion = new THREE.Mesh(
    starGeo,
    mat({ color: 0xf6c2b0, roughness: 0.92, celStrength: 0.35 })
  );
  starCushion.rotation.x = Math.PI / 2;
  starCushion.rotation.z = 0.35;
  starCushion.position.set(0.76, 0.66, 0.56);
  starCushion.castShadow = true;
  outlines.addOutline(starCushion, 1.03);
  bed.add(starCushion);

  // Stylized Plush Bunny Doll sitting against pillow
  const bunny = new THREE.Group();
  bunny.position.set(-0.56, 0.63, -0.46);
  bunny.rotation.y = 0.48;
  const bunnyMat = mat({ color: 0xfad8e4, roughness: 0.90 });
  const bTorso = new THREE.Mesh(new THREE.SphereGeometry(0.086, 14, 12), bunnyMat);
  bTorso.scale.set(1, 1.2, 0.9);
  bTorso.position.y = 0.080;
  bunny.add(bTorso);
  const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.076, 14, 12), bunnyMat);
  bHead.position.y = 0.215;
  outlines.addOutline(bHead, 1.05);
  bunny.add(bHead);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.020, 0.094, 4, 8), bunnyMat);
    ear.position.set(side * 0.034, 0.315, 0);
    ear.rotation.z = side * -0.18;
    bunny.add(ear);
  }
  bed.add(bunny);

  group.add(bed);
  addBoxCollider('col_bed', -6.54, 0.56, -4.05, 2.62, 1.12, 2.10);

  // -------------------------------------------------------------------------
  // 2B. FOOT-OF-BED UPHOLSTERED WHITE & PINK BENCH WITH DRAPED IVORY THROW
  //     & CUTE FRIED-EGG PLUSH CUSHION (MiSide Screenshots 2 & 3!)
  // -------------------------------------------------------------------------
  const bench = new THREE.Group();
  bench.position.set(-4.84, 0, -4.05);

  const benchBase = new THREE.Mesh(
    createBeveledBox(0.46, 0.055, 1.46, 0.012, 2),
    whiteFurnMat
  );
  benchBase.position.y = 0.35;
  benchBase.castShadow = true;
  bench.add(benchBase);

  for (const [lx, lz] of [
    [-0.18, -0.66],
    [0.18, -0.66],
    [-0.18, 0.66],
    [0.18, 0.66],
  ]) {
    const bLeg = new THREE.Mesh(
      createBeveledBox(0.044, 0.35, 0.044, 0.008, 2),
      whiteFurnMat
    );
    bLeg.position.set(lx, 0.175, lz);
    bLeg.castShadow = true;
    bench.add(bLeg);
  }

  const benchCushion = new THREE.Mesh(
    createPlushBox(0.48, 0.095, 1.48, 0.032, 0.10),
    softPinkFabricMat
  );
  benchCushion.position.y = 0.425;
  benchCushion.castShadow = true;
  benchCushion.receiveShadow = true;
  outlines.addOutline(benchCushion, 1.018);
  bench.add(benchCushion);

  // Folded ivory blanket draped smoothly over the south half of the bench (Screenshot 2!)
  const benchThrowTop = new THREE.Mesh(
    createPlushBox(0.51, 0.032, 0.56, 0.016, 0.08),
    sheetMat
  );
  benchThrowTop.position.set(0, 0.482, 0.26);
  benchThrowTop.castShadow = true;
  bench.add(benchThrowTop);
  for (const sx of [-0.245, 0.245]) {
    const drapeSide = new THREE.Mesh(
      createPlushBox(0.040, 0.24, 0.54, 0.014, 0.08),
      sheetMat
    );
    drapeSide.position.set(sx, 0.365, 0.26);
    drapeSide.castShadow = true;
    bench.add(drapeSide);
  }

  // Cute Fried-Egg Plush Cushion resting on the north half of the bench (Screenshots 2 & 3!)
  const eggGroup = new THREE.Group();
  eggGroup.position.set(0.0, 0.485, -0.34);
  eggGroup.rotation.y = 0.28;
  const eggWhiteMat = mat({ color: 0xfffdf9, roughness: 0.90, celStrength: 0.36 });
  const eggYolkMat = mat({ color: 0xffd24c, roughness: 0.85, celStrength: 0.38 });
  const eggCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.155, 0.042, 18), eggWhiteMat);
  eggCenter.scale.set(1.08, 1.0, 0.92);
  eggCenter.castShadow = true;
  outlines.addOutline(eggCenter, 1.035);
  eggGroup.add(eggCenter);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), eggWhiteMat);
    lobe.scale.set(1.0, 0.42, 1.0);
    lobe.position.set(Math.cos(a) * 0.115, 0.0, Math.sin(a) * 0.105);
    eggGroup.add(lobe);
  }
  const eggYolk = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), eggYolkMat);
  eggYolk.scale.set(1.0, 0.56, 1.0);
  eggYolk.position.set(0.01, 0.028, 0.0);
  outlines.addOutline(eggYolk, 1.04);
  eggGroup.add(eggYolk);
  bench.add(eggGroup);

  group.add(bench);
  addBoxCollider('col_bed_bench', -4.84, 0.28, -4.05, 0.54, 0.56, 1.54);

  // =========================================================================
  // 3. CRISP WHITE 2-DRAWER NIGHTSTAND + WARM PLEATED LAMP + PINK ALARM CLOCK
  //    (X = -7.55, Z = -5.85)
  // =========================================================================
  const nightstand = new THREE.Group();
  nightstand.position.set(-7.55, 0, -5.85);

  const nsTop = new THREE.Mesh(
    createBeveledSlab(0.62, 0.032, 0.66, 0.028, 0.009),
    whiteFurnMat
  );
  nsTop.position.y = 0.648;
  nsTop.castShadow = true;
  outlines.addOutline(nsTop, 1.016);
  nightstand.add(nsTop);

  const nsBody = new THREE.Mesh(
    createBeveledBox(0.57, 0.48, 0.61, 0.012, 2),
    whiteFurnMat
  );
  nsBody.position.y = 0.39;
  nsBody.castShadow = true;
  nightstand.add(nsBody);

  for (const dy of [0.275, 0.50]) {
    const drawer = createMoldedDrawerFront(
      0.54,
      0.195,
      0.028,
      'x',
      whiteFurnMat,
      whiteTrimMat,
      pastelPinkMat,
      1
    );
    drawer.position.set(0.298, dy, 0);
    nightstand.add(drawer);
  }

  const nsLegGeo = createTurnedLegGeometry(0.022, 0.013, 0.16);
  for (const [lx, lz] of [
    [-0.23, -0.25],
    [0.23, -0.25],
    [-0.23, 0.25],
    [0.23, 0.25],
  ]) {
    const leg = new THREE.Mesh(nsLegGeo, whiteFurnMat);
    leg.position.set(lx, 0.08, lz);
    nightstand.add(leg);
  }

  // Cute White Ceramic Bedside Lamp Base + Warm Creamy-Peach Pleated Shade (Screenshot 3!)
  const lampBasePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.082, 0),
    new THREE.Vector2(0.105, 0.068),
    new THREE.Vector2(0.068, 0.160),
    new THREE.Vector2(0.024, 0.210),
    new THREE.Vector2(0, 0.210),
  ];
  const lampBase = new THREE.Mesh(
    new THREE.LatheGeometry(lampBasePts, 18),
    mat({ color: 0xfdf2f6, roughness: 0.32, metalness: 0.05 })
  );
  lampBase.position.set(-0.03, 0.665, -0.08);
  lampBase.castShadow = true;
  outlines.addOutline(lampBase, 1.045);
  nightstand.add(lampBase);

  const lampShadeMat = new THREE.MeshStandardMaterial({
    color: 0xffe6d4,
    emissive: new THREE.Color(0xffbd7a),
    emissiveIntensity: 0.42,
    roughness: 0.80,
    metalness: 0.0,
    envMapIntensity: 0.05,
    side: THREE.DoubleSide,
  });
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.108, 0.182, 0.24, 18, 1, true),
    lampShadeMat
  );
  lampShade.userData.dynamic = true;
  lampShade.position.set(-0.03, 0.935, -0.08);
  outlines.addOutline(lampShade, 1.04);
  nightstand.add(lampShade);

  const bedLampLight = new THREE.PointLight(0xffcb88, 0.72, 6.4, 1.05);
  bedLampLight.position.set(-0.03, 0.90, -0.08);
  nightstand.add(bedLampLight);
  metaState.bedroomLampLight = bedLampLight;
  metaState.bedroomLampShadeMat = lampShadeMat;

  // Pastel-Pink Twin-Bell Alarm Clock on Nightstand
  const alarmClock = new THREE.Group();
  alarmClock.position.set(0.10, 0.725, 0.17);
  alarmClock.rotation.y = 0.5;
  const acBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.056, 0.056, 0.034, 16),
    rosyPinkMat
  );
  acBody.rotation.z = Math.PI / 2;
  alarmClock.add(acBody);
  const acDial = new THREE.Mesh(
    new THREE.CircleGeometry(0.045, 16),
    mat({ color: 0xfffaf8, roughness: 0.5 })
  );
  acDial.rotation.y = Math.PI / 2;
  acDial.position.x = 0.018;
  alarmClock.add(acDial);
  for (const side of [-1, 1]) {
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.023, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      silverMetalMat
    );
    bell.position.set(0, 0.056, side * 0.038);
    bell.rotation.x = side * 0.5;
    alarmClock.add(bell);
  }
  nightstand.add(alarmClock);

  // Fountain pen resting on Nightstand top
  const { penGroup: nsPen } = createTabletopPenSet(ctx, 0xe87a9c, false);
  nsPen.position.set(0.08, 0.665, -0.18);
  nsPen.rotation.y = -0.45;
  nightstand.add(nsPen);
  registerAmbientProp({
    id: 'bed_ns_pen',
    room: 'bedroom',
    mesh: nsPen,
    worldPos: [-7.47, 0.665, -6.03],
    kind: 'roller',
    maxDrift: 0.028,
    rollRadius: 0.0056,
    rollAxis: 'x',
    reactivity: 1.25,
  });

  group.add(nightstand);
  addBoxCollider('col_nightstand', -7.55, 0.42, -5.85, 0.68, 0.85, 0.72);

  registerAmbientProp({
    id: 'bed_ns_clock',
    room: 'bedroom',
    mesh: alarmClock,
    worldPos: [-7.45, 0.725, -5.68],
    kind: 'wobble',
    maxDrift: 0.020,
    reactivity: 1.12,
  });

  registerInteractable('bed_lamp', '床头台灯', '开关台灯', 'bedroom', nightstand, () => {
    metaState.bedroomLampOn = !metaState.bedroomLampOn;
    bedLampLight.intensity = metaState.bedroomLampOn ? 0.44 : 0.0;
    lampShadeMat.emissiveIntensity = metaState.bedroomLampOn ? 0.42 : 0.0;
    return {
      title: '床头暖光台灯',
      message: metaState.bedroomLampOn
        ? '柔和的暖橘色微光重新亮起，将粉色壁纸映照得像童话一样温暖。'
        : '关掉台灯后，房间瞬间沉入安静的夜色与点点星光中。',
    };
  });

  // =========================================================================
  // 4. CRISP WHITE SHAKER-PANELED WARDROBE + LEANING FULL-LENGTH MIRROR
  //    (X = -7.54, Z = -1.00 — Matching MiSide Screenshot 3!)
  // =========================================================================
  const wardrobe = new THREE.Group();
  wardrobe.position.set(-7.54, 0, -1.00);

  const wCorniceLower = new THREE.Mesh(
    createBeveledSlab(0.71, 0.028, 1.41, 0.020, 0.008),
    whiteFurnMat
  );
  wCorniceLower.position.y = 2.125;
  wCorniceLower.castShadow = true;
  wardrobe.add(wCorniceLower);

  const wCorniceTop = new THREE.Mesh(
    createBeveledSlab(0.76, 0.032, 1.48, 0.024, 0.009),
    whiteFurnMat
  );
  wCorniceTop.position.y = 2.155;
  wCorniceTop.castShadow = true;
  outlines.addOutline(wCorniceTop, 1.014);
  wardrobe.add(wCorniceTop);

  const wPlinth = new THREE.Mesh(
    createBeveledSlab(0.70, 0.056, 1.40, 0.020, 0.009),
    whiteFurnMat
  );
  wPlinth.position.y = 0.096;
  wPlinth.castShadow = true;
  wardrobe.add(wPlinth);

  const bunFootGeo = createTurnedLegGeometry(0.028, 0.018, 0.068);
  for (const [fx, fz] of [
    [-0.27, -0.60],
    [0.27, -0.60],
    [-0.27, 0.60],
    [0.27, 0.60],
  ]) {
    const foot = new THREE.Mesh(bunFootGeo, whiteFurnMat);
    foot.position.set(fx, 0.034, fz);
    wardrobe.add(foot);
  }

  const wBack = new THREE.Mesh(
    createBeveledBox(0.04, 1.98, 1.32, 0.010, 2),
    whiteTrimMat
  );
  wBack.position.set(-0.30, 1.12, 0);
  wBack.castShadow = true;
  wBack.receiveShadow = true;
  wardrobe.add(wBack);

  const wTopBoard = new THREE.Mesh(
    createBeveledBox(0.64, 0.04, 1.34, 0.012, 2),
    whiteFurnMat
  );
  wTopBoard.position.set(0, 2.09, 0);
  wardrobe.add(wTopBoard);

  const wBotBoard = new THREE.Mesh(
    createBeveledBox(0.64, 0.04, 1.34, 0.012, 2),
    whiteFurnMat
  );
  wBotBoard.position.set(0, 0.145, 0);
  wardrobe.add(wBotBoard);

  for (const sz of [-0.65, 0.65]) {
    const sideWall = new THREE.Mesh(
      createBeveledBox(0.64, 1.98, 0.046, 0.012, 2),
      whiteFurnMat
    );
    sideWall.position.set(0, 1.12, sz);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    wardrobe.add(sideWall);

    const pilaster = new THREE.Mesh(
      createBeveledBox(0.042, 1.98, 0.056, 0.010, 2),
      whiteFurnMat
    );
    pilaster.position.set(0.315, 1.12, sz * 0.99);
    pilaster.castShadow = true;
    wardrobe.add(pilaster);
  }

  // Hanging blue sweater on side hook of the wardrobe (exact MiSide Screenshot 3 detail!)
  const sideHook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), silverMetalMat);
  sideHook.rotation.x = Math.PI / 2;
  sideHook.position.set(0.04, 1.66, 0.695);
  wardrobe.add(sideHook);
  const hangingSweater = new THREE.Mesh(
    createPlushBox(0.34, 0.56, 0.055, 0.018, 0.14),
    softBlueFabricMat
  );
  hangingSweater.position.set(0.04, 1.35, 0.705);
  hangingSweater.castShadow = true;
  outlines.addOutline(hangingSweater, 1.028);
  wardrobe.add(hangingSweater);

  // Interior soft cream liner + upper shelf + folded sweaters + brass clothes rod + garments
  const wInteriorLiner = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 1.90, 1.24),
    mat({ color: 0x3b2f3c, roughness: 0.88 })
  );
  wInteriorLiner.position.set(-0.275, 1.12, 0);
  wardrobe.add(wInteriorLiner);

  const wUpperShelf = new THREE.Mesh(
    createBeveledBox(0.54, 0.028, 1.24, 0.008, 2),
    whiteFurnMat
  );
  wUpperShelf.position.set(-0.02, 1.72, 0);
  wardrobe.add(wUpperShelf);

  for (const [fz, fcol, fy] of [
    [-0.32, 0xf7c5d4, 1.76],
    [-0.32, 0xd85d76, 1.81],
    [0.26, 0x7ba6e8, 1.76],
  ] as const) {
    const folded = new THREE.Mesh(
      createPlushBox(0.32, 0.048, 0.28, 0.018, 0.14),
      mat({ color: fcol, roughness: 0.9 })
    );
    folded.position.set(0.0, fy, fz);
    wardrobe.add(folded);
  }

  const wRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1.24, 10),
    brassMat
  );
  wRod.rotation.x = Math.PI / 2;
  wRod.position.set(0.02, 1.62, 0);
  wardrobe.add(wRod);

  for (const [hz, isCardigan] of [
    [-0.38, true],
    [-0.16, false],
    [0.12, true],
    [0.36, false],
  ] as const) {
    const hanger = new THREE.Mesh(
      createBeveledBox(0.34, 0.014, 0.012, 0.003, 1),
      whiteTrimMat
    );
    hanger.position.set(0.02, 1.59, hz);
    wardrobe.add(hanger);

    const garment = new THREE.Mesh(
      createPlushBox(0.36, 0.62, 0.042, 0.014, 0.1),
      mat({ color: isCardigan ? 0xd0485c : 0x3b63a8, roughness: 0.85 })
    );
    garment.position.set(0.02, 1.25, hz);
    wardrobe.add(garment);
  }

  for (const [dz, doorId, doorLabel, hingeSide] of [
    [-0.308, 'bed_wardrobe_left', '衣柜左门', -1],
    [0.308, 'bed_wardrobe_right', '衣柜右门', 1],
  ] as const) {
    registerCabinetDoor({
      id: doorId,
      label: doorLabel,
      room: 'bedroom',
      parent: wardrobe,
      centerX: 0.315,
      centerY: 1.12,
      centerZ: dz,
      width: 0.61,
      height: 1.92,
      thickness: 0.032,
      facingAxis: 'x',
      facingSign: 1,
      hingeSide,
      openSign: (-hingeSide) as -1 | 1,
      doorMat: whiteFurnMat,
      moldingMat: whiteTrimMat,
      handleMat: pastelPinkMat,
    });
  }

  group.add(wardrobe);
  addBoxCollider('col_wardrobe', -7.54, 1.0, -1.00, 0.76, 2.24, 1.48);

  // Leaning White-Framed Full-Length Mirror nestled between Bed and Wardrobe (Screenshot 3!)
  const leanMirror = new THREE.Group();
  leanMirror.position.set(-7.68, 0, -2.32);
  leanMirror.rotation.y = 0.24;
  leanMirror.rotation.z = 0.12;
  const mirrorFrame = new THREE.Mesh(
    createBeveledBox(0.042, 1.56, 0.56, 0.012, 2),
    whiteFurnMat
  );
  mirrorFrame.position.y = 0.78;
  mirrorFrame.castShadow = true;
  outlines.addOutline(mirrorFrame, 1.018);
  leanMirror.add(mirrorFrame);
  const mirrorPane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 1.46),
    mat({ color: 0xe6eaf6, roughness: 0.12, metalness: 0.72 })
  );
  mirrorPane.rotation.y = Math.PI / 2;
  mirrorPane.position.set(0.023, 0.78, 0);
  leanMirror.add(mirrorPane);
  group.add(leanMirror);

  // =========================================================================
  // 5. MISIDE WHITE & PASTEL-PINK PC DESK + PINK TOWER + PINK SWIVEL CHAIR
  //    + PINK GAMING HEADPHONES (X = -2.52, Z = -6.12; pcScreen world = (-2.60, 1.19, -6.322))
  // =========================================================================
  const desk = new THREE.Group();
  desk.position.set(-2.52, 0, -6.12);

  const dTop = new THREE.Mesh(
    createBeveledSlab(1.88, 0.036, 0.88, 0.032, 0.009),
    whiteFurnMat
  );
  dTop.position.y = 0.795;
  dTop.castShadow = true;
  dTop.receiveShadow = true;
  outlines.addOutline(dTop, 1.014);
  desk.add(dTop);

  // Clean white panel left leg & slim white back modesty panel
  const leftSidePanel = new THREE.Mesh(
    createBeveledBox(0.042, 0.78, 0.80, 0.008, 2),
    whiteFurnMat
  );
  leftSidePanel.position.set(-0.88, 0.39, 0);
  leftSidePanel.castShadow = true;
  desk.add(leftSidePanel);

  // Right-side White & Pastel-Pink 3-Drawer Desk Pedestal (exact match to Screenshots 2 & 3!)
  const deskPedestal = new THREE.Mesh(
    createBeveledBox(0.46, 0.78, 0.78, 0.012, 2),
    whiteFurnMat
  );
  deskPedestal.position.set(0.68, 0.39, 0.0);
  deskPedestal.castShadow = true;
  outlines.addOutline(deskPedestal, 1.014);
  desk.add(deskPedestal);

  for (const dy of [0.16, 0.40, 0.64]) {
    const deskDrawer = createMoldedDrawerFront(
      0.40,
      0.21,
      0.026,
      'z',
      pastelPinkMat,
      whiteFurnMat,
      whiteFurnMat,
      1
    );
    deskDrawer.position.set(0.68, dy, 0.392);
    desk.add(deskDrawer);
  }

  // Pastel-Pink PC Tower Chassis nestled under the left side of the desk (Screenshot 2!)
  const pcTower = new THREE.Mesh(
    createBeveledBox(0.25, 0.50, 0.50, 0.014, 2),
    pastelPinkMat
  );
  pcTower.position.set(-0.62, 0.25, -0.05);
  pcTower.castShadow = true;
  outlines.addOutline(pcTower, 1.02);
  desk.add(pcTower);

  const pcFrontBezel = new THREE.Mesh(
    createBeveledBox(0.18, 0.42, 0.012, 0.004, 1),
    whiteFurnMat
  );
  pcFrontBezel.position.set(-0.62, 0.25, 0.204);
  desk.add(pcFrontBezel);

  const towerLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.38, 0.014),
    new THREE.MeshBasicMaterial({ color: 0x7ae2ff })
  );
  towerLed.position.set(-0.515, 0.25, 0.203);
  desk.add(towerLed);

  // Pastel-Pink & White Monitor Base, Arm & Ultrawide Thin-Bezel Screen Frame (EXACT pcScreen coords!)
  const monBase = new THREE.Mesh(
    createBeveledSlab(0.28, 0.016, 0.22, 0.026, 0.005),
    pastelPinkMat
  );
  monBase.position.set(-0.08, 0.820, -0.25);
  desk.add(monBase);

  const monArm = new THREE.Mesh(
    createBeveledBox(0.052, 0.25, 0.042, 0.008, 2),
    pastelPinkMat
  );
  monArm.position.set(-0.08, 0.945, -0.27);
  monArm.rotation.x = -0.15;
  desk.add(monArm);

  const monBody = new THREE.Mesh(
    createBeveledBox(0.94, 0.55, 0.032, 0.009, 2),
    pastelPinkMat
  );
  monBody.position.set(-0.08, 1.19, -0.22);
  monBody.castShadow = true;
  outlines.addOutline(monBody, 1.016);
  desk.add(monBody);

  const pcScreenMat = new THREE.MeshStandardMaterial({
    map: textures.pcTerminal,
    emissiveMap: textures.pcTerminal,
    emissive: new THREE.Color(0x6ad4f5),
    emissiveIntensity: 0.62,
    roughness: 0.56,
    metalness: 0.04,
    envMapIntensity: 0.06,
  });
  metaState.pcScreenMat = pcScreenMat;
  const pcScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.50), pcScreenMat);
  pcScreen.userData.dynamic = true;
  pcScreen.layers.enable(1);
  pcScreen.userData.interactId = 'bed_pc';
  pcScreen.position.set(-0.08, 1.19, -0.202);
  metaState.pcScreenMesh = pcScreen;
  desk.add(pcScreen);

  // Cute Pastel-Pink Gaming Headphones resting on the right side of the desk (Screenshots 2 & 3!)
  const headphones = new THREE.Group();
  headphones.position.set(-0.56, 0.835, 0.16);
  headphones.rotation.set(Math.PI / 2, 0, -0.42);
  const hpBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.013, 10, 22, Math.PI * 1.15),
    pastelPinkMat
  );
  hpBand.rotation.z = -0.22;
  outlines.addOutline(hpBand, 1.05);
  headphones.add(hpBand);
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.034, 14), rosyPinkMat);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(s * 0.088, -0.018, 0);
    outlines.addOutline(cup, 1.05);
    headphones.add(cup);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.012, 8, 14), whiteFurnMat);
    pad.rotation.y = Math.PI / 2;
    pad.position.set(s * 0.068, -0.018, 0);
    headphones.add(pad);
  }
  desk.add(headphones);

  // Cute Pink Articulated Desk Lamp on right back corner of desk (Screenshot 3!)
  const deskLamp = new THREE.Group();
  deskLamp.position.set(0.66, 0.814, -0.22);
  const dlBase = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.086, 0.022, 16), pastelPinkMat);
  dlBase.position.y = 0.011;
  deskLamp.add(dlBase);
  const dlStem1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), whiteFurnMat);
  dlStem1.position.set(0.02, 0.125, -0.02);
  dlStem1.rotation.z = -0.18;
  deskLamp.add(dlStem1);
  const dlStem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8), whiteFurnMat);
  dlStem2.position.set(-0.02, 0.30, 0.02);
  dlStem2.rotation.z = 0.42;
  deskLamp.add(dlStem2);
  const dlShade = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.12, 16, 1, true), pastelPinkMat);
  dlShade.position.set(-0.10, 0.34, 0.05);
  dlShade.rotation.z = 0.65;
  outlines.addOutline(dlShade, 1.04);
  deskLamp.add(dlShade);
  const dlBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.026, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff1cf })
  );
  dlBulb.position.set(-0.11, 0.315, 0.055);
  deskLamp.add(dlBulb);
  const deskLampLight = new THREE.PointLight(0xffc982, 0.58, 3.8, 1.25);
  deskLampLight.position.set(-0.12, 0.29, 0.06);
  deskLamp.add(deskLampLight);
  desk.add(deskLamp);

  // Mysterious Titanium-Glass Cylindrical Drive (学校天台捡到的奇怪硬盘) on Desk
  const driveProp = new THREE.Group();
  driveProp.position.set(0.46, 0.818, 0.10);
  driveProp.userData.dynamic = true;
  const drivePad = new THREE.Mesh(
    createBeveledBox(0.20, 0.011, 0.16, 0.003, 2),
    mat({ color: 0x3b2a34, roughness: 0.78 })
  );
  drivePad.position.y = 0.0055;
  driveProp.add(drivePad);
  const cylCapMat = mat({ color: 0x8f9ab0, roughness: 0.28, metalness: 0.85 });
  const cylGlassMat = mat({
    color: 0x62d9ff,
    emissive: 0x2688b5,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.82,
  });
  const cylCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.10, 16),
    cylGlassMat
  );
  cylCore.rotation.z = Math.PI / 2;
  cylCore.position.set(0, 0.038, 0);
  outlines.addOutline(cylCore, 1.08);
  driveProp.add(cylCore);
  for (const sx of [-0.052, 0.052]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.029, 0.029, 0.020, 16),
      cylCapMat
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.set(sx, 0.038, 0);
    driveProp.add(cap);
  }
  const gearRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.019, 0.0045, 8, 16),
    brassMat
  );
  gearRing.rotation.y = Math.PI / 2;
  gearRing.position.set(0, 0.038, 0);
  driveProp.add(gearRing);
  desk.add(driveProp);

  registerInteractable(
    'bed_drive',
    '学校捡到的奇怪硬盘',
    '检查钛合金圆柱体',
    'bedroom',
    driveProp,
    () => ({
      title: '违禁冷存储介质 // 钛合金玻璃圆柱体',
      message:
        '你在学校天台捡到的奇怪硬盘。玻璃腔体里封存着微米级黄铜齿轮与泛虹彩的磁光涂层——现代终端一插就会触发 Watchdog 熔断，必须在地下室找齐 3 个电子零件做成适配器，才能插进桌面这台老电脑读取。',
    })
  );

  // Pastel-Pink Desk Mat + White/Pink Mechanical Keyboard + Cute White Mouse
  const deskMat = new THREE.Mesh(
    createBeveledSlab(0.92, 0.008, 0.36, 0.032, 0.003),
    softPinkFabricMat
  );
  deskMat.position.set(-0.05, 0.818, 0.14);
  desk.add(deskMat);

  const kbGroup = new THREE.Group();
  kbGroup.position.set(-0.14, 0.828, 0.14);
  kbGroup.rotation.x = 0.08;

  const kbCase = new THREE.Mesh(
    createBeveledBox(0.46, 0.018, 0.165, 0.004, 2),
    whiteFurnMat
  );
  kbGroup.add(kbCase);

  const keycapRowGeo = createBeveledBox(0.42, 0.010, 0.024, 0.003, 1);
  for (const [idx, dz] of [
    [0, -0.050],
    [1, -0.019],
    [2, 0.012],
    [3, 0.043],
  ] as const) {
    const keyRow = new THREE.Mesh(keycapRowGeo, idx % 2 === 0 ? whiteTrimMat : pastelPinkMat);
    keyRow.position.set(0, 0.012, dz);
    kbGroup.add(keyRow);
  }
  desk.add(kbGroup);

  const mouseBody = new THREE.Mesh(
    createPlushBox(0.072, 0.032, 0.118, 0.022, 0.14),
    whiteFurnMat
  );
  mouseBody.position.set(0.22, 0.828, 0.15);
  desk.add(mouseBody);

  // Desk Fountain Pen, Drafting Pencil & Brass Armillary Rings Trinket
  const { penGroup: deskPen, pencilGroup: deskPencil } = createTabletopPenSet(ctx, 0xee789c, true);
  deskPen.position.set(-0.74, 0.814, -0.10);
  deskPen.rotation.y = 1.18;
  desk.add(deskPen);
  registerAmbientProp({
    id: 'bed_desk_pen',
    room: 'bedroom',
    mesh: deskPen,
    worldPos: [-3.26, 0.814, -6.22],
    kind: 'roller',
    maxDrift: 0.036,
    rollRadius: 0.0056,
    rollAxis: 'x',
    reactivity: 1.32,
  });

  if (deskPencil) {
    deskPencil.position.set(-0.78, 0.814, -0.18);
    deskPencil.rotation.y = 0.92;
    desk.add(deskPencil);
    registerAmbientProp({
      id: 'bed_desk_pencil',
      room: 'bedroom',
      mesh: deskPencil,
      worldPos: [-3.30, 0.814, -6.30],
      kind: 'roller',
      maxDrift: 0.035,
      rollRadius: 0.0046,
      rollAxis: 'x',
      reactivity: 1.28,
    });
  }

  const deskTrinket = createTabletopTrinketCluster(ctx, 'brass_rings');
  deskTrinket.position.set(0.38, 0.814, -0.15);
  deskTrinket.rotation.y = -0.36;
  desk.add(deskTrinket);
  registerAmbientProp({
    id: 'bed_desk_trinket',
    room: 'bedroom',
    mesh: deskTrinket,
    worldPos: [-2.14, 0.814, -6.27],
    kind: 'trinket',
    maxDrift: 0.028,
    reactivity: 1.18,
  });

  registerAmbientProp({
    id: 'bed_desk_drive',
    room: 'bedroom',
    mesh: driveProp,
    worldPos: [-2.06, 0.818, -6.02],
    kind: 'slide',
    maxDrift: 0.022,
    reactivity: 1.02,
  });
  registerAmbientProp({
    id: 'bed_desk_mouse',
    room: 'bedroom',
    mesh: mouseBody,
    worldPos: [-2.30, 0.828, -5.97],
    kind: 'slide',
    maxDrift: 0.026,
    reactivity: 1.10,
  });

  group.add(desk);
  // Tight collider matching actual PC desk footprint (Z = -6.57..-5.67) so swivel chair rolls freely in front!
  addBoxCollider('col_pc_desk', -2.52, 0.55, -6.12, 1.92, 1.25, 0.90);

  // MiSide Refined Ergonomic Swivel Chair (Satin Cream Polymer Shell + Breathable Dusty-Rose Mesh Cushion)
  const { rootGroup: taskChair, seatGroup: taskChairSeat } = createErgonomicSwivelChair(
    uniforms,
    outlines,
    {
      plasticFrameHex: 0xf4ecef,
      plasticAccentHex: 0xdfd0d8,
      meshCushionHex: 0xeab0c4,
      meshBaseHex: '#e6a6bc',
      meshPoreHex: '#8d576b',
      meshHighlightHex: 'rgba(255, 240, 246, 0.45)',
      armPadHex: 0xd9b3c0,
      metalHex: 0xd8dce4,
      initialSeatYaw: 0.34,
    }
  );
  taskChair.name = 'bed_swivel_chair';
  taskChair.position.set(-2.60, 0, -5.24);

  group.add(taskChair);
  metaState.swivelChairs.push({
    id: 'bed_swivel_chair',
    room: 'bedroom',
    rootGroup: taskChair,
    seatGroup: taskChairSeat,
    floorY: 0.0,
    radius: 0.33,
    bounds: { minX: -4.85, maxX: -0.95, minZ: -6.10, maxZ: -1.15 },
    vx: 0,
    vz: 0,
    spinVel: 0,
    baseSpinVel: 0,
  });

  registerInteractable('bed_pc', '卧室老式桌面电脑', '坐到电脑前', 'bedroom', monBody, () => ({
    title: '二十年代无审查老式主机',
    message: '正在接入桌面老式电脑……',
    openPcAction: true,
  }));

  // =========================================================================
  // 6. WHITE 2-DOOR SIDEBOARD / BOOKCASE + DIARY + POTTED PLANT + PINK ROSES
  //    IN WHITE PITCHER (X = -4.65, Z = -0.04 — Matching MiSide Screenshot 1!)
  // =========================================================================
  const bookcase = new THREE.Group();
  bookcase.position.set(-4.65, 0, -0.04);

  const bcTop = new THREE.Mesh(
    createBeveledSlab(1.06, 0.032, 0.42, 0.024, 0.008),
    whiteFurnMat
  );
  bcTop.position.y = 0.88;
  bcTop.castShadow = true;
  bcTop.receiveShadow = true;
  outlines.addOutline(bcTop, 1.015);
  bookcase.add(bcTop);

  const bcCarcass = new THREE.Mesh(
    createBeveledBox(1.00, 0.78, 0.38, 0.012, 2),
    whiteFurnMat
  );
  bcCarcass.position.y = 0.48;
  bcCarcass.castShadow = true;
  bcCarcass.receiveShadow = true;
  bookcase.add(bcCarcass);

  // 4 Tapered white sideboard legs
  for (const [lx, lz] of [
    [-0.44, -0.14],
    [0.44, -0.14],
    [-0.44, 0.14],
    [0.44, 0.14],
  ]) {
    const leg = new THREE.Mesh(
      createTurnedLegGeometry(0.022, 0.013, 0.10),
      whiteFurnMat
    );
    leg.position.set(lx, 0.05, lz);
    bookcase.add(leg);
  }

  // Twin Crisp White Paneled Doors with Cute Round White Knobs (facing -Z into bedroom!)
  for (const dx of [-0.235, 0.235]) {
    const doorPanel = createMoldedDrawerFront(
      0.44,
      0.66,
      0.024,
      'z',
      whiteFurnMat,
      whiteTrimMat,
      whiteFurnMat,
      -1
    );
    doorPanel.position.set(dx, 0.48, -0.194);
    bookcase.add(doorPanel);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), whiteFurnMat);
    knob.position.set(dx > 0 ? 0.065 : -0.065, 0.68, -0.214);
    outlines.addOutline(knob, 1.06);
    bookcase.add(knob);
  }

  // Potted Green Leafy Plant in Dark Charcoal Pot on left side of sideboard (Screenshot 1!)
  const sbPotGroup = new THREE.Group();
  sbPotGroup.position.set(-0.33, 0.896, 0.0);
  const sbPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.088, 0.068, 0.135, 16),
    mat({ color: 0x4e545c, roughness: 0.65 })
  );
  sbPot.position.y = 0.068;
  sbPot.castShadow = true;
  outlines.addOutline(sbPot, 1.035);
  sbPotGroup.add(sbPot);

  const leafGreenMat = mat({ color: 0x5c964e, roughness: 0.72, celStrength: 0.46 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.005, 0.14, 6),
      leafGreenMat
    );
    stem.position.set(Math.cos(ang) * 0.032, 0.175, Math.sin(ang) * 0.032);
    stem.rotation.set(Math.sin(ang) * 0.48, 0, -Math.cos(ang) * 0.48);
    sbPotGroup.add(stem);

    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 8), leafGreenMat);
    leaf.scale.set(1.35, 0.24, 0.85);
    leaf.position.set(Math.cos(ang) * 0.088, 0.23 + (i % 2) * 0.03, Math.sin(ang) * 0.088);
    leaf.rotation.y = -ang;
    leaf.rotation.z = 0.22;
    outlines.addOutline(leaf, 1.03);
    sbPotGroup.add(leaf);
  }
  bookcase.add(sbPotGroup);

  // White Ceramic Pitcher with Pink Roses beside the plant (Screenshot 1!)
  const pitcherGroup = new THREE.Group();
  pitcherGroup.position.set(-0.04, 0.896, 0.02);
  const pitcherPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.058, 0),
    new THREE.Vector2(0.068, 0.05),
    new THREE.Vector2(0.044, 0.15),
    new THREE.Vector2(0.050, 0.21),
    new THREE.Vector2(0.042, 0.21),
    new THREE.Vector2(0.038, 0.15),
  ];
  const pitcher = new THREE.Mesh(
    new THREE.LatheGeometry(pitcherPts, 16),
    mat({ color: 0xfbf8fc, roughness: 0.25, metalness: 0.06 })
  );
  pitcher.castShadow = true;
  outlines.addOutline(pitcher, 1.04);
  pitcherGroup.add(pitcher);

  const pitcherHandle = new THREE.Mesh(
    new THREE.TorusGeometry(0.044, 0.008, 8, 14, Math.PI),
    whiteFurnMat
  );
  pitcherHandle.rotation.z = -Math.PI / 2;
  pitcherHandle.position.set(0.048, 0.13, 0);
  pitcherGroup.add(pitcherHandle);

  const roseMat = mat({ color: 0xf78ead, roughness: 0.72, celStrength: 0.45 });
  for (const [rx, ry, rz] of [
    [-0.024, 0.255, 0.015],
    [0.026, 0.275, -0.012],
    [0.002, 0.295, 0.018],
  ]) {
    const roseStem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 6), leafGreenMat);
    roseStem.position.set(rx * 0.5, 0.22, rz * 0.5);
    pitcherGroup.add(roseStem);
    const rose = new THREE.Mesh(new THREE.DodecahedronGeometry(0.034, 1), roseMat);
    rose.position.set(rx, ry, rz);
    outlines.addOutline(rose, 1.045);
    pitcherGroup.add(rose);
  }
  bookcase.add(pitcherGroup);

  // Crimson Ribbon-Bound Hardcover Diary resting on the right side of the white sideboard
  const bookAtlasMat = mat({
    map: textures.bookCoverAtlas,
    bumpMap: textures.bookCoverBump,
    bumpScale: 0.008,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    woodLacquer: 0.0,
  });
  const diaryGroup = new THREE.Group();
  diaryGroup.position.set(0.28, 0.912, -0.02);
  diaryGroup.rotation.y = 0.25;
  const diaryCover = new THREE.Mesh(
    createBookGeometry(0.18, 0.032, 0.23, 0),
    bookAtlasMat
  );
  diaryCover.castShadow = true;
  outlines.addOutline(diaryCover, 1.05);
  diaryGroup.add(diaryCover);
  const diaryPages = new THREE.Mesh(
    createBeveledBox(0.168, 0.022, 0.218, 0.004, 2),
    sheetMat
  );
  diaryPages.position.x = 0.004;
  diaryGroup.add(diaryPages);
  const strap = new THREE.Mesh(
    createBeveledBox(0.185, 0.036, 0.020, 0.004, 2),
    brassMat
  );
  strap.position.z = 0.05;
  diaryGroup.add(strap);
  bookcase.add(diaryGroup);

  group.add(bookcase);
  addBoxCollider('col_bed_bookcase', -4.65, 0.46, -0.04, 1.10, 0.94, 0.46);

  diaryGroup.userData.dynamic = true;
  registerInteractable('bed_diary', '红色日记本', '翻阅日记', 'bedroom', diaryGroup, () => ({
    title: '带黄铜搭扣的红色日记本',
    message: '“11月15日：她又把所有的门把手拆下来藏进了地下室。她说这样我就永远不会离开这个版本了。”',
  }));

  registerAmbientProp({
    id: 'bed_bookcase_diary',
    room: 'bedroom',
    mesh: diaryGroup,
    worldPos: [-4.37, 0.912, -0.06],
    kind: 'slide',
    maxDrift: 0.018,
    reactivity: 0.85,
  });

  // =========================================================================
  // 7. MISIDE SIGNATURE BEDROOM PROPS FROM SCREENSHOTS 1 & 2:
  //    A) White 3-Tier Rolling Utility Cart (NW corner beside window, X=-6.16, Z=-6.28)
  //    B) White 4-Drawer Chest + Pink Storage Box (SE wall, X=-2.05, Z=-0.16)
  //    C) White 4-Cubby Wall Shelves (above PC desk & beside Bedroom Door)
  //    D) Round Sky-Blue Wall Clock (animated in clockRigs!) & Framed Pastel Prints
  //    E) Dreamy Twinkling Golden Wall Star Accents (glowing at Sunset & Midnight!)
  // =========================================================================

  // 7A. White 3-Tier Rolling Utility Cart (Screenshot 1!)
  const cart = new THREE.Group();
  cart.position.set(-6.16, 0, -6.28);
  cart.rotation.y = 0.14;

  // Twin curved white U-frame vertical handles & caster wheels
  for (const sx of [-0.24, 0.24]) {
    for (const sz of [-0.14, 0.14]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011, 0.011, 0.84, 10),
        whiteFurnMat
      );
      post.position.set(sx, 0.47, sz);
      post.castShadow = true;
      cart.add(post);

      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.016, 10),
        darkMetalMat
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.022, sz);
      cart.add(wheel);
    }
    const handleArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.011, 8, 16, Math.PI),
      whiteFurnMat
    );
    handleArch.rotation.y = Math.PI / 2;
    handleArch.position.set(sx, 0.89, 0);
    cart.add(handleArch);
  }

  // 3 White Tray Baskets
  for (const ty of [0.16, 0.46, 0.76]) {
    const trayBot = new THREE.Mesh(
      createBeveledBox(0.46, 0.024, 0.30, 0.006, 2),
      whiteFurnMat
    );
    trayBot.position.y = ty;
    trayBot.castShadow = true;
    cart.add(trayBot);
    for (const side of [-1, 1]) {
      const lipZ = new THREE.Mesh(createBeveledBox(0.46, 0.088, 0.016, 0.005, 1), whiteFurnMat);
      lipZ.position.set(0, ty + 0.044, side * 0.145);
      cart.add(lipZ);
      const lipX = new THREE.Mesh(createBeveledBox(0.016, 0.088, 0.30, 0.005, 1), whiteFurnMat);
      lipX.position.set(side * 0.225, ty + 0.044, 0);
      cart.add(lipX);
    }
  }
  // Top basket: Blue zipper travel pouch (Screenshot 1!)
  const bluePouch = new THREE.Mesh(
    createPlushBox(0.32, 0.14, 0.17, 0.028, 0.12),
    skyBlueMat
  );
  bluePouch.position.set(0, 0.84, 0);
  outlines.addOutline(bluePouch, 1.03);
  cart.add(bluePouch);
  // Middle basket: Folded ivory cloth
  const foldedCloth = new THREE.Mesh(
    createPlushBox(0.26, 0.065, 0.18, 0.020, 0.10),
    sheetMat
  );
  foldedCloth.position.set(-0.02, 0.505, 0);
  cart.add(foldedCloth);
  // Bottom basket: Pastel-pink storage box
  const cartPinkBox = new THREE.Mesh(
    createBeveledBox(0.24, 0.10, 0.17, 0.008, 2),
    rosyPinkMat
  );
  cartPinkBox.position.set(0.03, 0.22, 0);
  outlines.addOutline(cartPinkBox, 1.035);
  cart.add(cartPinkBox);

  group.add(cart);
  addBoxCollider('col_bed_cart', -6.16, 0.48, -6.28, 0.56, 0.96, 0.40);

  // 7B. White 4-Drawer Chest + Pink Storage Box beside it (Screenshot 2!)
  const chest = new THREE.Group();
  chest.position.set(-2.12, 0, -0.18);
  const chTop = new THREE.Mesh(
    createBeveledSlab(0.68, 0.030, 0.42, 0.020, 0.008),
    whiteFurnMat
  );
  chTop.position.y = 0.92;
  chTop.castShadow = true;
  outlines.addOutline(chTop, 1.016);
  chest.add(chTop);

  const chBody = new THREE.Mesh(
    createBeveledBox(0.64, 0.84, 0.38, 0.010, 2),
    whiteFurnMat
  );
  chBody.position.y = 0.49;
  chBody.castShadow = true;
  chest.add(chBody);

  for (const dy of [0.18, 0.38, 0.58, 0.78]) {
    const chDrawer = createMoldedDrawerFront(
      0.56,
      0.17,
      0.022,
      'z',
      whiteFurnMat,
      whiteTrimMat,
      pastelPinkMat,
      -1
    );
    chDrawer.position.set(0, dy, -0.192);
    chest.add(chDrawer);
  }
  // Cute Pink Storage Box sitting on the floor beside the white chest (Screenshot 2!)
  const floorPinkBox = new THREE.Mesh(
    createBeveledBox(0.32, 0.26, 0.30, 0.012, 2),
    pastelPinkMat
  );
  floorPinkBox.position.set(-0.56, 0.13, -0.02);
  floorPinkBox.castShadow = true;
  outlines.addOutline(floorPinkBox, 1.025);
  chest.add(floorPinkBox);

  group.add(chest);
  addBoxCollider('col_bed_chest', -2.26, 0.46, -0.18, 1.02, 0.94, 0.46);

  // 7C. White 4-Cubby Wall Shelves (Screenshots 2 & 3!)
  const buildCubbyShelf = (x: number, y: number, z: number, rotY: number) => {
    const shelf = new THREE.Group();
    shelf.position.set(x, y, z);
    shelf.rotation.y = rotY;

    const w = 0.76;
    const h = 0.72;
    const d = 0.24;
    // Outer frame + center cross dividers
    for (const sy of [-h / 2, 0, h / 2]) {
      const board = new THREE.Mesh(createBeveledBox(w, 0.024, d, 0.005, 1), whiteFurnMat);
      board.position.y = sy;
      board.castShadow = true;
      shelf.add(board);
    }
    for (const sx of [-w / 2, 0, w / 2]) {
      const side = new THREE.Mesh(createBeveledBox(0.024, h + 0.024, d, 0.005, 1), whiteFurnMat);
      side.position.x = sx;
      side.castShadow = true;
      shelf.add(side);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.014), whiteTrimMat);
    back.position.z = -d / 2 + 0.007;
    shelf.add(back);

    // Bottom cubbies: 2 Pastel-pink storage bins with handle cutouts
    for (const bx of [-0.185, 0.185]) {
      const bin = new THREE.Mesh(createBeveledBox(0.30, 0.24, 0.20, 0.008, 2), pastelPinkMat);
      bin.position.set(bx, -0.22, 0.008);
      outlines.addOutline(bin, 1.03);
      shelf.add(bin);
      const handleSlot = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.022, 0.008),
        mat({ color: 0x6e4858, roughness: 0.8 })
      );
      handleSlot.position.set(bx, -0.17, 0.11);
      shelf.add(handleSlot);
    }

    // Top-right cubby: 3 Sky-blue upright binders (Screenshot 2!)
    for (let i = 0; i < 3; i++) {
      const binder = new THREE.Mesh(createBeveledBox(0.075, 0.27, 0.19, 0.005, 1), skyBlueMat);
      binder.position.set(0.075 + i * 0.095, 0.15, 0.005);
      outlines.addOutline(binder, 1.035);
      shelf.add(binder);
    }

    // Top-left cubby: Potted mini cactus (Screenshot 2!)
    const cPot = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.044, 0.088, 12), whiteTrimMat);
    cPot.position.set(-0.185, 0.056, 0.01);
    shelf.add(cPot);
    const cactusMat = mat({ color: 0x64a35c, roughness: 0.78 });
    const cStem = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.095, 6, 10), cactusMat);
    cStem.position.set(-0.185, 0.155, 0.01);
    outlines.addOutline(cStem, 1.04);
    shelf.add(cStem);
    const cArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.020, 0.045, 5, 8), cactusMat);
    cArm.position.set(-0.145, 0.165, 0.01);
    cArm.rotation.z = -0.52;
    shelf.add(cArm);

    group.add(shelf);
  };

  // Cubby shelf above PC desk (North wall) & beside Bedroom Door (East wall)
  buildCubbyShelf(-2.52, 2.08, -6.52, 0);
  buildCubbyShelf(-1.44, 1.76, -5.05, -Math.PI / 2);

  // 7D. Round Sky-Blue Wall Clock (animated in clockRigs, Screenshot 2!)
  const wallClock = new THREE.Group();
  wallClock.position.set(-3.40, 2.38, 0.145);
  wallClock.rotation.y = Math.PI;
  const clockRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.046, 28),
    skyBlueMat
  );
  clockRim.rotation.x = Math.PI / 2;
  outlines.addOutline(clockRim, 1.03);
  wallClock.add(clockRim);

  const clockFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.205, 24),
    mat({ color: 0xfffafd, roughness: 0.55 })
  );
  clockFace.position.z = 0.025;
  wallClock.add(clockFace);

  for (let t = 0; t < 12; t++) {
    const a = (t / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(t % 3 === 0 ? 0.012 : 0.007, t % 3 === 0 ? 0.032 : 0.018, 0.004),
      skyBlueMat
    );
    tick.position.set(Math.sin(a) * 0.172, Math.cos(a) * 0.172, 0.027);
    tick.rotation.z = -a;
    wallClock.add(tick);
  }
  const hourHandPivot = new THREE.Group();
  hourHandPivot.position.z = 0.030;
  hourHandPivot.userData.dynamic = true;
  const hourHandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.105, 0.005), darkMetalMat);
  hourHandMesh.position.y = 0.042;
  hourHandPivot.add(hourHandMesh);
  wallClock.add(hourHandPivot);

  const minuteHandPivot = new THREE.Group();
  minuteHandPivot.position.z = 0.034;
  minuteHandPivot.userData.dynamic = true;
  const minuteHandMesh = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.155, 0.005), darkMetalMat);
  minuteHandMesh.position.y = 0.066;
  minuteHandPivot.add(minuteHandMesh);
  wallClock.add(minuteHandPivot);

  clockRigs.push({ hourHand: hourHandPivot, minuteHand: minuteHandPivot });
  group.add(wallClock);

  // Cute White-Framed Pastel Prints on Bedroom Walls (Screenshots 1, 2 & 3!)
  const addFramedPrint = (
    x: number,
    y: number,
    z: number,
    rotY: number,
    w: number,
    h: number,
    variant: 'girl' | 'heart' | 'clouds'
  ) => {
    const frameGrp = new THREE.Group();
    frameGrp.position.set(x, y, z);
    frameGrp.rotation.y = rotY;
    const outer = new THREE.Mesh(
      createBeveledBox(w + 0.075, h + 0.075, 0.028, 0.006, 2),
      whiteFurnMat
    );
    outlines.addOutline(outer, 1.022);
    frameGrp.add(outer);
    const canvasMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      mat({ map: createPastelArtTexture(variant), color: 0xffffff, roughness: 0.72 })
    );
    canvasMesh.position.z = 0.016;
    frameGrp.add(canvasMesh);
    group.add(frameGrp);
  };

  addFramedPrint(-1.33, 1.78, -2.05, -Math.PI / 2, 0.42, 0.52, 'girl');
  addFramedPrint(-5.82, 1.88, 0.145, Math.PI, 0.44, 0.54, 'clouds');
  addFramedPrint(-7.88, 1.98, -4.05, Math.PI / 2, 0.46, 0.40, 'heart');

  // 7E. Dreamy Twinkling Golden Wall Star Accents (MiSide Screenshot 3!)
  //     Soft warm sparkles across the upper bedroom walls, brightening naturally at Sunset & Midnight.
  {
    const starPositions: number[] = [];
    const starSeeds: number[] = [];
    const addWallStars = (
      count: number,
      xMin: number,
      xMax: number,
      yMin: number,
      yMax: number,
      zMin: number,
      zMax: number,
      seedOffset: number
    ) => {
      for (let i = 0; i < count; i++) {
        const h1 = Math.abs(Math.sin((i + seedOffset) * 12.9898) * 43758.5453) % 1;
        const h2 = Math.abs(Math.sin((i + seedOffset) * 78.233) * 24634.6345) % 1;
        const h3 = Math.abs(Math.sin((i + seedOffset) * 39.425) * 19283.7465) % 1;
        starPositions.push(
          xMin + (xMax - xMin) * h1,
          yMin + (yMax - yMin) * h2,
          zMin + (zMax - zMin) * h3
        );
        starSeeds.push(h3 * 6.28318);
      }
    };
    // North, West, South & East upper bedroom walls (just 0.03m off wall surface)
    addWallStars(26, -7.75, -1.45, 1.08, 2.88, -6.60, -6.60, 11);
    addWallStars(26, -7.86, -7.86, 1.08, 2.88, -6.50, -0.05, 47);
    addWallStars(22, -7.75, -1.45, 1.08, 2.88, 0.12, 0.12, 89);
    addWallStars(22, -1.35, -1.35, 1.08, 2.88, -6.50, -0.05, 131);

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    starGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(starSeeds, 1));

    const starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: uniforms.uTime,
        uNightFactor: uniforms.uNightFactor,
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uNightFactor;
        varying float vTwinkle;
        void main() {
          float tw = 0.62 + 0.38 * sin(uTime * 1.9 + aSeed * 3.0);
          vTwinkle = tw * mix(0.28, 1.0, uNightFactor);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = clamp((24.0 + 18.0 * tw) / max(-mvPos.z, 0.6), 4.0, 26.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vTwinkle;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          // 4-point dreamy anime sparkle star cross + soft circular halo
          float crossRay = exp(-abs(p.x) * 18.0) * exp(-abs(p.y) * 5.2)
                         + exp(-abs(p.y) * 18.0) * exp(-abs(p.x) * 5.2);
          float core = exp(-d * d * 24.0);
          float alpha = clamp((core * 0.92 + crossRay * 0.68) * vTwinkle, 0.0, 1.0);
          if (alpha < 0.02) discard;
          vec3 col = mix(vec3(1.0, 0.94, 0.82), vec3(1.0, 0.98, 0.92), core);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const starPoints = new THREE.Points(starGeo, starMat);
    starPoints.userData.dynamic = true;
    group.add(starPoints);
  }

  // Merge all static Bedroom meshes into a single draw call
  mergeStaticGroupToSingleMesh(group, outlines, 'BedroomMergedStaticMesh');
}
