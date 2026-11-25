import * as THREE from 'three';
import { createBeveledBox } from '../geometries';
import {
  createTwilightMaterial,
  type OutlineRegistry,
  type TwilightUniforms,
} from '../pipeline';

export type XboxControllerVariant = 'white' | 'purple';

/**
 * Builds a high-detail Xbox Series-style wireless controller composite THREE.Group:
 * - Sculpted extruded center chassis + angled ergonomic flared grip horns & rear palm swells
 * - Contrasting rubberized backshell vs matte ceramic-white (`白色`) or pastel-lavender (`浅紫色`) faceplate
 * - Recessed glossy dark Nexus bezel with glowing Xbox guide emblem + Share/View/Menu pills
 * - Asymmetric dual concave thumbsticks (left high, right low) with metallic collars & textured rings
 * - Faceted 8-way hybrid metallic D-pad dish + glossy colored ABXY acrylic dome buttons
 * - Top LB/RB contoured bumpers, sloped analog LT/RT triggers, and recessed USB-C port
 *
 * Canonical local orientation:
 * - Width along X (~0.156m), Depth along Z (~0.106m: -Z = front triggers/bumpers, +Z = grip tails),
 *   Bottom rests cleanly near y = 0 (upward +Y).
 */
export function buildXboxControllerMesh(
  uniforms: TwilightUniforms,
  variant: XboxControllerVariant,
  outlines?: OutlineRegistry,
  opts?: { addOutline?: boolean; isDynamic?: boolean }
): THREE.Group {
  const group = new THREE.Group();
  group.name = `xbox_controller_${variant}`;
  if (opts?.isDynamic !== false) {
    group.userData.dynamic = true;
  }

  const mat = (params: Parameters<typeof createTwilightMaterial>[1]) =>
    createTwilightMaterial(uniforms, params);

  const isWhite = variant === 'white';
  const shellColor = isWhite ? 0xf4f4f7 : 0xc9b4f8;
  const backGripColor = isWhite ? 0xe1e3ea : 0xa38cde;
  const bumperColor = isWhite ? 0xe7e9f0 : 0x9980d6;

  const shellMat = mat({
    color: shellColor,
    roughness: 0.62,
    metalness: 0.04,
    celStrength: 0.34,
  });
  const backGripMat = mat({
    color: backGripColor,
    roughness: 0.88,
    metalness: 0.02,
    celStrength: 0.38,
  });
  const bumperMat = mat({
    color: bumperColor,
    roughness: 0.52,
    metalness: 0.08,
    celStrength: 0.34,
  });
  const rubberMat = mat({
    color: 0x22232c,
    roughness: 0.90,
    metalness: 0.04,
    celStrength: 0.36,
  });
  const gunmetalMat = mat({
    color: 0x383a48,
    roughness: 0.36,
    metalness: 0.52,
    celStrength: 0.30,
  });
  const glossDarkMat = mat({
    color: 0x16171e,
    roughness: 0.22,
    metalness: 0.16,
    celStrength: 0.28,
  });
  const chromeCollarMat = mat({
    color: 0xd0d4e2,
    roughness: 0.24,
    metalness: 0.78,
    celStrength: 0.26,
  });
  const nexusEmissiveMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(isWhite ? 0xd9f7ff : 0xf0d6ff),
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.1,
  });

  // 1. Sculpted 2D Xbox top-down silhouette extruded with generous bevels
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.046, -0.044);
  bodyShape.bezierCurveTo(-0.018, -0.049, 0.018, -0.049, 0.046, -0.044);
  bodyShape.bezierCurveTo(0.068, -0.040, 0.075, -0.016, 0.077, 0.012);
  bodyShape.bezierCurveTo(0.079, 0.036, 0.076, 0.056, 0.064, 0.062);
  bodyShape.bezierCurveTo(0.052, 0.066, 0.043, 0.048, 0.036, 0.033);
  bodyShape.bezierCurveTo(0.025, 0.026, -0.025, 0.026, -0.036, 0.033);
  bodyShape.bezierCurveTo(-0.043, 0.048, -0.052, 0.066, -0.064, 0.062);
  bodyShape.bezierCurveTo(-0.076, 0.056, -0.079, 0.036, -0.077, 0.012);
  bodyShape.bezierCurveTo(-0.075, -0.016, -0.068, -0.040, -0.046, -0.044);

  const upperGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.0055,
    bevelSize: 0.0045,
    bevelSegments: 3,
    curveSegments: 14,
  });
  upperGeo.rotateX(Math.PI / 2);
  const upperShell = new THREE.Mesh(upperGeo, shellMat);
  upperShell.position.y = 0.033;
  upperShell.castShadow = true;
  upperShell.receiveShadow = true;
  if (opts?.addOutline && outlines) {
    outlines.addOutline(upperShell, 1.04);
  }
  group.add(upperShell);

  // 2. Sculpted lower chassis + angled ergonomic hand grips
  const lowerShell = new THREE.Mesh(
    createBeveledBox(0.094, 0.016, 0.064, 0.006, 2),
    backGripMat
  );
  lowerShell.position.set(0, 0.016, -0.009);
  lowerShell.castShadow = true;
  group.add(lowerShell);

  for (const side of [-1, 1] as const) {
    // Ergonomic flared palm grip horn sloping gently down-back
    const grip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0175, 0.052, 8, 14),
      backGripMat
    );
    grip.rotation.set(1.22, 0, side * 0.24);
    grip.position.set(side * 0.058, 0.0185, 0.024);
    grip.castShadow = true;
    grip.receiveShadow = true;
    if (opts?.addOutline && outlines) {
      outlines.addOutline(grip, 1.04);
    }
    group.add(grip);

    // Textured grip backpad highlight seam
    const gripPad = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.013, 0.038, 6, 10),
      shellMat
    );
    gripPad.rotation.set(1.22, 0, side * 0.24);
    gripPad.position.set(side * 0.059, 0.0225, 0.022);
    group.add(gripPad);
  }

  // 3. Top Shoulder Bumpers (LB / RB) + Analog Triggers (LT / RT) + Front Bezel
  const frontBezel = new THREE.Mesh(
    createBeveledBox(0.056, 0.013, 0.014, 0.003, 2),
    glossDarkMat
  );
  frontBezel.position.set(0, 0.030, -0.043);
  group.add(frontBezel);

  // Recessed USB-C charging port on the front nose
  const usbPort = new THREE.Mesh(
    createBeveledBox(0.011, 0.0045, 0.004, 0.001, 1),
    chromeCollarMat
  );
  usbPort.position.set(0, 0.030, -0.0495);
  group.add(usbPort);

  for (const side of [-1, 1] as const) {
    // Bumper (LB / RB)
    const bumper = new THREE.Mesh(
      createBeveledBox(0.036, 0.0095, 0.015, 0.0035, 2),
      bumperMat
    );
    bumper.position.set(side * 0.042, 0.032, -0.041);
    bumper.rotation.y = side * -0.18;
    bumper.rotation.z = side * -0.08;
    group.add(bumper);

    // Trigger (LT / RT) angled downward behind bumper
    const trigger = new THREE.Mesh(
      createBeveledBox(0.023, 0.015, 0.016, 0.004, 2),
      rubberMat
    );
    trigger.position.set(side * 0.043, 0.020, -0.047);
    trigger.rotation.x = 0.44;
    trigger.rotation.y = side * -0.14;
    group.add(trigger);
  }

  // 4. Xbox Nexus Guide Button + View / Menu / Share center controls
  const guideRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0098, 0.0098, 0.0045, 18),
    glossDarkMat
  );
  guideRing.position.set(0, 0.0382, -0.024);
  group.add(guideRing);

  const guideDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.0076, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
    nexusEmissiveMat
  );
  guideDome.position.set(0, 0.0374, -0.024);
  group.add(guideDome);

  // Small View / Menu circular buttons & Share pill
  for (const bx of [-0.0155, 0.0155]) {
    const sysBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0042, 0.0042, 0.004, 12),
      glossDarkMat
    );
    sysBtn.position.set(bx, 0.0384, -0.008);
    group.add(sysBtn);
  }
  const shareBtn = new THREE.Mesh(
    createBeveledBox(0.0095, 0.0038, 0.0056, 0.0018, 1),
    glossDarkMat
  );
  shareBtn.position.set(0, 0.0384, -0.001);
  group.add(shareBtn);

  // 5. Asymmetric Dual Thumbsticks: Left Upper (-0.042, -0.011), Right Lower (+0.023, +0.016)
  const stickCoords: ReadonlyArray<readonly [number, number]> = [
    [-0.041, -0.010],
    [0.023, 0.015],
  ];
  for (const [sx, sz] of stickCoords) {
    // Anti-friction collar ring
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.0115, 0.0014, 8, 18),
      chromeCollarMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.set(sx, 0.0388, sz);
    group.add(collar);

    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.003, 16),
      glossDarkMat
    );
    well.position.set(sx, 0.0378, sz);
    group.add(well);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0046, 0.0055, 0.011, 12),
      gunmetalMat
    );
    stem.position.set(sx, 0.0435, sz);
    group.add(stem);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0105, 0.0092, 0.0045, 18),
      rubberMat
    );
    cap.position.set(sx, 0.0495, sz);
    group.add(cap);

    // Grippy outer thumb rim
    const capRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.0092, 0.0013, 6, 18),
      rubberMat
    );
    capRim.rotation.x = Math.PI / 2;
    capRim.position.set(sx, 0.0518, sz);
    group.add(capRim);
  }

  // 6. Hybrid Faceted Xbox 8-Way D-Pad (Lower Left: -0.023, +0.015)
  const dpadGroup = new THREE.Group();
  dpadGroup.position.set(-0.023, 0.0385, 0.015);
  const dpadDish = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0135, 0.0145, 0.004, 8),
    gunmetalMat
  );
  dpadDish.rotation.y = Math.PI / 8;
  dpadGroup.add(dpadDish);

  const dpadCrossH = new THREE.Mesh(
    createBeveledBox(0.024, 0.0042, 0.0072, 0.0014, 1),
    glossDarkMat
  );
  dpadCrossH.position.y = 0.0018;
  dpadGroup.add(dpadCrossH);

  const dpadCrossV = new THREE.Mesh(
    createBeveledBox(0.0072, 0.0042, 0.024, 0.0014, 1),
    glossDarkMat
  );
  dpadCrossV.position.y = 0.0018;
  dpadGroup.add(dpadCrossV);
  group.add(dpadGroup);

  // 7. Glossy Colored ABXY Buttons (Upper Right: +0.042, -0.010)
  const abxyLayout: ReadonlyArray<readonly [number, number, number]> = [
    [0.042, 0.002, 0x3de87c],   // A (Bottom - Green)
    [0.054, -0.010, 0xff5268],  // B (Right - Red)
    [0.030, -0.010, 0x45b6ff],  // X (Left - Blue)
    [0.042, -0.022, 0xffd23f],  // Y (Top - Yellow)
  ];
  for (const [bx, bz, bcol] of abxyLayout) {
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0053, 0.0053, 0.0028, 12),
      glossDarkMat
    );
    well.position.set(bx, 0.0378, bz);
    group.add(well);

    const dome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0047, 0.0042, 14),
      mat({
        color: bcol,
        roughness: 0.24,
        metalness: 0.08,
        celStrength: 0.28,
      })
    );
    dome.position.set(bx, 0.0402, bz);
    group.add(dome);
  }

  return group;
}

/**
 * Builds a sleek, detailed multi-part Smart TV Remote Control (`电视遥控器`).
 */
export function buildTvRemoteMesh(
  uniforms: TwilightUniforms,
  outlines?: OutlineRegistry
): THREE.Group {
  const remote = new THREE.Group();
  remote.name = 'living_tv_remote_refined';
  remote.userData.dynamic = true;

  const mat = (params: Parameters<typeof createTwilightMaterial>[1]) =>
    createTwilightMaterial(uniforms, params);

  const slateBodyMat = mat({ color: 0x262934, roughness: 0.54, metalness: 0.14 });
  const brushedTrimMat = mat({ color: 0x9aa2b6, roughness: 0.30, metalness: 0.72 });
  const softKeyMat = mat({ color: 0x3b4052, roughness: 0.68, metalness: 0.06 });
  const irWindowMat = mat({ color: 0x2c0e18, roughness: 0.18, metalness: 0.22 });

  // Lower curved spine & upper beveled deck
  const body = new THREE.Mesh(
    createBeveledBox(0.046, 0.014, 0.168, 0.005, 3),
    slateBodyMat
  );
  body.position.y = 0.007;
  body.castShadow = true;
  body.receiveShadow = true;
  if (outlines) outlines.addOutline(body, 1.04);
  remote.add(body);

  // Subtle brushed aluminum upper face inlay
  const faceTrim = new THREE.Mesh(
    createBeveledBox(0.036, 0.0025, 0.146, 0.002, 1),
    brushedTrimMat
  );
  faceTrim.position.set(0, 0.0138, 0.002);
  remote.add(faceTrim);

  // Glossy dark-ruby IR emitter window on front edge (-Z)
  const irNose = new THREE.Mesh(
    createBeveledBox(0.022, 0.007, 0.008, 0.002, 1),
    irWindowMat
  );
  irNose.position.set(0, 0.0075, -0.082);
  remote.add(irNose);

  // Crimson Power button (top left) + tiny Mic/Input button (top right)
  const powerBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0048, 0.0048, 0.0035, 14),
    mat({ color: 0xee4558, roughness: 0.34 })
  );
  powerBtn.position.set(-0.010, 0.0156, -0.058);
  remote.add(powerBtn);

  const inputBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0038, 0.0038, 0.0032, 12),
    softKeyMat
  );
  inputBtn.position.set(0.010, 0.0154, -0.058);
  remote.add(inputBtn);

  // Metallic directional navigation ring + central glossy OK button
  const dpadRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0125, 0.0028, 8, 22),
    softKeyMat
  );
  dpadRing.rotation.x = Math.PI / 2;
  dpadRing.position.set(0, 0.0156, -0.028);
  remote.add(dpadRing);

  const okBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0062, 0.0062, 0.0038, 16),
    brushedTrimMat
  );
  okBtn.position.set(0, 0.0159, -0.028);
  remote.add(okBtn);

  // Back / Home / Mute trio below nav ring
  const navRowCols = [0x4c5368, 0x55a8ff, 0xf2a848];
  for (let i = 0; i < 3; i++) {
    const pill = new THREE.Mesh(
      createBeveledBox(0.0082, 0.003, 0.0055, 0.0014, 1),
      mat({ color: navRowCols[i], roughness: 0.45 })
    );
    pill.position.set((i - 1) * 0.0115, 0.0154, -0.002);
    remote.add(pill);
  }

  // Dual Volume & Channel rocker bars
  for (const side of [-1, 1] as const) {
    const rocker = new THREE.Mesh(
      createBeveledBox(0.011, 0.0036, 0.028, 0.0018, 2),
      softKeyMat
    );
    rocker.position.set(side * 0.0105, 0.0157, 0.022);
    remote.add(rocker);
  }

  // Subtle lower shortcut dots (4 pastel streaming / game launcher keys)
  const shortcutCols = [0xff6382, 0x56d88c, 0x62b2ff, 0xb88cff];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      const key = new THREE.Mesh(
        createBeveledBox(0.011, 0.003, 0.008, 0.0014, 1),
        mat({ color: shortcutCols[idx], roughness: 0.38 })
      );
      key.position.set(
        (col === 0 ? -1 : 1) * 0.0085,
        0.0153,
        0.048 + row * 0.014
      );
      remote.add(key);
    }
  }

  return remote;
}

export interface ProtagonistGamingArmsRig {
  group: THREE.Group;
  controller: THREE.Group;
  setState: (
    mode: 'hidden' | 'reaching' | 'holding',
    reachProgress: number,
    elapsed: number,
    inputAxisX: number,
    inputAxisY: number,
    actionPulse: number
  ) => void;
}

/**
 * First-person protagonist forearm + 5-fingered hand + White Xbox Controller viewmodel:
 * - Used during the living room co-play handoff (right arm smoothly reaches forward to take
 *   the white Xbox controller from the heroine) and while actively playing TV games together.
 */
export function buildProtagonistGamingArmsRig(
  uniforms: TwilightUniforms,
  outlines?: OutlineRegistry
): ProtagonistGamingArmsRig {
  const group = new THREE.Group();
  group.name = 'protagonist_gaming_arms_viewmodel';
  group.userData.dynamic = true;
  group.visible = false;

  const mat = (params: Parameters<typeof createTwilightMaterial>[1]) =>
    createTwilightMaterial(uniforms, params);

  const skinMat = mat({
    color: 0xfce1d3,
    roughness: 0.72,
    metalness: 0.0,
    celStrength: 0.36,
  });
  const skinShadeMat = mat({
    color: 0xeac2b0,
    roughness: 0.76,
    metalness: 0.0,
    celStrength: 0.36,
  });
  const hoodieMat = mat({
    color: 0x2f323a,
    roughness: 0.88,
    metalness: 0.02,
    celStrength: 0.44,
  });
  const cuffMat = mat({
    color: 0x23252c,
    roughness: 0.90,
    metalness: 0.02,
    celStrength: 0.44,
  });

  // White Xbox Controller held cleanly at local pivot
  const controllerPivot = new THREE.Group();
  controllerPivot.position.set(0, 0, 0);
  const controller = buildXboxControllerMesh(uniforms, 'white', outlines, {
    addOutline: true,
    isDynamic: true,
  });
  // Tilt controller slightly toward the camera (+Z) so the player can clearly admire its details
  controller.position.set(0, -0.015, 0);
  controllerPivot.add(controller);
  group.add(controllerPivot);

  const buildHandArm = (side: -1 | 1): { armGroup: THREE.Group; thumb: THREE.Mesh } => {
    const armGroup = new THREE.Group();

    // Forearm hoodie sleeve extending toward player body (+Z, -Y)
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.036, 0.24, 14),
      hoodieMat
    );
    sleeve.rotation.set(Math.PI * 0.46, 0, side * -0.26);
    sleeve.position.set(side * 0.095, -0.048, 0.145);
    armGroup.add(sleeve);

    // Ribbed cuff near wrist
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.029, 0.032, 14),
      cuffMat
    );
    cuff.rotation.set(Math.PI * 0.46, 0, side * -0.26);
    cuff.position.set(side * 0.072, -0.028, 0.056);
    armGroup.add(cuff);

    // Wrist & palm cradling the controller grip
    const palm = new THREE.Mesh(
      createBeveledBox(0.030, 0.022, 0.050, 0.008, 2),
      skinMat
    );
    palm.position.set(side * 0.064, -0.008, 0.016);
    palm.rotation.set(-0.18, side * -0.22, side * -0.24);
    armGroup.add(palm);

    // 4 wrapped fingers gripping underneath controller horn
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0046, 0.020, 4, 8),
        f >= 2 ? skinShadeMat : skinMat
      );
      finger.rotation.set(Math.PI * 0.48, 0, side * 0.65);
      finger.position.set(
        side * 0.046,
        -0.014 - f * 0.001,
        0.003 + f * 0.0105
      );
      armGroup.add(finger);
    }

    // Articulated thumb resting near thumbstick / ABXY buttons
    const thumb = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0052, 0.022, 4, 8),
      skinMat
    );
    thumb.rotation.set(0.45, side * 0.2, side * 0.58);
    thumb.position.set(side * 0.039, 0.028, 0.006);
    armGroup.add(thumb);

    return { armGroup, thumb };
  };

  const leftArm = buildHandArm(-1);
  const rightArm = buildHandArm(1);
  group.add(leftArm.armGroup);
  group.add(rightArm.armGroup);

  const setState: ProtagonistGamingArmsRig['setState'] = (
    mode,
    reachProgress,
    elapsed,
    inputAxisX,
    inputAxisY,
    actionPulse
  ) => {
    if (mode === 'hidden') {
      group.visible = false;
      return;
    }
    group.visible = true;

    if (mode === 'reaching') {
      // Smooth two-phase grab animation:
      // 0..0.52: empty right hand reaches forward toward heroine's outstretched hand
      // 0.52..1.0: grasps white controller & pulls smoothly down into bottom gaming hold
      const p = THREE.MathUtils.clamp(reachProgress, 0, 1);
      if (p < 0.52) {
        const ext = THREE.MathUtils.smoothstep(p / 0.52, 0, 1);
        controller.visible = false;
        leftArm.armGroup.visible = false;
        rightArm.armGroup.visible = true;
        group.position.set(
          THREE.MathUtils.lerp(0.18, 0.04, ext),
          THREE.MathUtils.lerp(-0.28, -0.09, ext),
          THREE.MathUtils.lerp(-0.34, -0.58, ext)
        );
        group.rotation.set(THREE.MathUtils.lerp(0.28, -0.08, ext), 0.14 * (1 - ext), 0);
        rightArm.armGroup.position.set(0, 0, 0);
        rightArm.armGroup.rotation.set(0, 0, 0);
      } else {
        const pull = THREE.MathUtils.smoothstep((p - 0.52) / 0.48, 0, 1);
        controller.visible = true;
        leftArm.armGroup.visible = pull > 0.25;
        leftArm.armGroup.position.set(
          THREE.MathUtils.lerp(-0.14, 0, pull),
          THREE.MathUtils.lerp(-0.16, 0, pull),
          0
        );
        rightArm.armGroup.visible = true;
        group.position.set(
          THREE.MathUtils.lerp(0.04, 0.0, pull),
          THREE.MathUtils.lerp(-0.09, -0.255, pull),
          THREE.MathUtils.lerp(-0.58, -0.375, pull)
        );
        group.rotation.set(
          THREE.MathUtils.lerp(-0.08, 0.52, pull),
          0,
          0
        );
      }
      return;
    }

    // 'holding': Active comfortable bottom-frame hold leaving the TV completely clear!
    controller.visible = true;
    leftArm.armGroup.visible = true;
    rightArm.armGroup.visible = true;
    leftArm.armGroup.position.set(0, 0, 0);
    rightArm.armGroup.position.set(0, 0, 0);

    const idleBob = Math.sin(elapsed * 2.1) * 0.0028;
    const actionLift = actionPulse * 0.010;
    group.position.set(
      inputAxisX * 0.009,
      -0.255 + idleBob + actionLift,
      -0.375 - actionPulse * 0.008
    );
    group.rotation.set(
      0.52 + inputAxisY * 0.055 - actionPulse * 0.08,
      -inputAxisX * 0.045,
      -inputAxisX * 0.065
    );

    // Subtle live thumb motion on left stick & right face buttons
    leftArm.thumb.position.set(-0.039 + inputAxisX * 0.004, 0.028, 0.006 - inputAxisY * 0.004);
    rightArm.thumb.position.set(
      0.039,
      0.028 - actionPulse * 0.0045,
      0.006
    );
  };

  return {
    group,
    controller,
    setState,
  };
}
