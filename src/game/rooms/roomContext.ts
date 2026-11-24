import * as THREE from 'three';
import type { CollisionWorld } from '../collision';
import { createBeveledBox, createMoldedDrawerFront } from '../geometries';
import type { OutlineRegistry, ProceduralTextures, TwilightUniforms } from '../pipeline';
import { createTwilightMaterial } from '../pipeline';
import { mergeDynamicSubtreeMeshes, SceneManager } from '../SceneManager';
import type { DoorController, InteractableTarget, InteractResult, RoomId } from '../types';

export interface CeilingLampRig {
  id: string;
  room: RoomId;
  position: THREE.Vector3;
  light: THREE.PointLight;
  bulbMaterials: THREE.MeshBasicMaterial[];
  bulbBaseColors: THREE.Color[];
  baseColor: THREE.Color;
  dimColor: THREE.Color;
  baseIntensity: number;
  modeMultiplier: number;
  userEnabled: boolean;
  // Proximity & room-entry flicker state
  burstTimer: number;
  burstDuration: number;
  burstSeed: number;
  proximityRadius: number;
  proximityCooldown: number;
  wasWithinProximity: boolean;
  currentFactor: number;
}

export interface ReflectiveMirrorRig {
  id: string;
  room: RoomId;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  /** World-space unit normal pointing out of the reflective glass surface */
  normal: THREE.Vector3;
  /** World-space center point on the mirror glass plane */
  planePoint: THREE.Vector3;
  /** Temporary glitch burst timer triggered by player inspection or anomaly */
  glitchBurstTimer: number;
}

export type AmbientPropKind = 'roller' | 'trinket' | 'wobble' | 'slide';

export interface AmbientPropOptions {
  id: string;
  room: RoomId;
  mesh: THREE.Object3D;
  /** World-space position [x, y, z] of the prop for fast distance & wake calculations */
  worldPos: [number, number, number];
  kind?: AmbientPropKind;
  /** Maximum persistent horizontal drift radius from initial rest pose (meters) */
  maxDrift?: number;
  /** Effective barrel radius for 'roller' props so horizontal drift rolls the mesh */
  rollRadius?: number;
  /** Local axis around which 'roller' props spin ('x' or 'z', default 'x') */
  rollAxis?: 'x' | 'z';
  /** Sensitivity multiplier to player movement wake & footstep vibrations */
  reactivity?: number;
}

export interface AmbientPropRig {
  id: string;
  room: RoomId;
  mesh: THREE.Object3D;
  worldOrigin: THREE.Vector3;
  baseLocalPos: THREE.Vector3;
  baseLocalRot: THREE.Euler;
  kind: AmbientPropKind;
  maxDrift: number;
  rollRadius: number;
  rollAxis: 'x' | 'z';
  reactivity: number;
  seed: number;
  // Persistent plastic drift offset on the tabletop (in parent local XZ & yaw)
  driftX: number;
  driftZ: number;
  driftYaw: number;
  // Dynamic spring-damper state around the drifted rest pose
  offsetX: number;
  offsetZ: number;
  velX: number;
  velZ: number;
  yawOffset: number;
  yawVel: number;
  tiltX: number;
  tiltZ: number;
  tiltVelX: number;
  tiltVelZ: number;
}

export interface SwivelChairRig {
  id: string;
  room: RoomId;
  /** Root chair group translated across the floor (x, floorY, z) */
  rootGroup: THREE.Group;
  /** Upper seat+backrest assembly that swivels smoothly around Y when bumped */
  seatGroup: THREE.Group;
  /** Floor height for this chair (0.0 for bedroom, -3.20 for basement) */
  floorY: number;
  /** Horizontal collision radius in meters */
  radius: number;
  /** Room boundary clamp so the chair stays inside its room */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Linear sliding velocity on floor XZ (m/s) */
  vx: number;
  vz: number;
  /** Upper seat swivel angular velocity (rad/s) */
  spinVel: number;
  /** Subtle wheel-base yaw drift velocity (rad/s) */
  baseSpinVel: number;
}


export interface CabinetDoorOptions {
  id: string;
  label: string;
  room: RoomId;
  /** Center X of the closed door in parent's local coordinates */
  centerX: number;
  /** Center Y of the closed door in parent's local coordinates */
  centerY: number;
  /** Center Z of the closed door in parent's local coordinates */
  centerZ: number;
  width: number;
  height: number;
  depth?: number;
  thickness?: number;
  /** Axis perpendicular to the cabinet door face ('x' or 'z') */
  facingAxis: 'x' | 'z';
  /** Direction the cabinet door faces outward (+1 or -1 along facingAxis) */
  facingSign: 1 | -1;
  /** Which lateral edge of the door is hinged (-1 or +1 along the door width axis) */
  hingeSide: -1 | 1;
  openSign?: 1 | -1;
  frontMat?: THREE.Material;
  doorMat?: THREE.Material;
  moldingMat: THREE.Material;
  handleMat?: THREE.Material;
  parent: THREE.Object3D;
  /** Optional custom door leaf group (e.g., for fridge doors or louvered doors) */
  customDoorGroup?: THREE.Group;
  /** Whether to place a dark recessed cabinet interior cavity behind the door */
  addRecessedCavity?: boolean;
  openAngleMag?: number;
  messageOpen?: string;
  messageClose?: string;
}

export interface TurntableRig {
  worldPos: THREE.Vector3;
  platterGroup: THREE.Group;
  tonearmPivot: THREE.Group;
  labelMat: THREE.MeshStandardMaterial;
  labelAccentMat: THREE.MeshStandardMaterial;
  ledMat: THREE.MeshBasicMaterial;
  vuGlowMats: THREE.MeshBasicMaterial[];
  nowPlayingSleeveMesh: THREE.Mesh;
  isPlaying: boolean;
  currentTrackIndex: number;
  spinSpeed: number;
  armAngle: number;
  applyTrackState: (trackIndex: number, isPlaying: boolean) => void;
}

export interface RoomBuildContext {
  scene: THREE.Scene;
  sceneManager: SceneManager;
  structureGroup: THREE.Group;
  ceilingGroup: THREE.Group;
  uniforms: TwilightUniforms;
  textures: ProceduralTextures;
  outlines: OutlineRegistry;
  collisions: CollisionWorld;
  interactables: InteractableTarget[];
  doors: DoorController[];
  volumetricRays: THREE.Mesh[];
  windowGlowMeshes: THREE.Mesh[];
  ceilingLamps: CeilingLampRig[];
  mirrors: ReflectiveMirrorRig[];
  ambientProps: AmbientPropRig[];
  clockRigs: { hourHand: THREE.Object3D; minuteHand: THREE.Object3D; secondHand?: THREE.Object3D }[];
  flickerLights: { light: THREE.PointLight; baseIntensity: number }[];
  turntableRig: TurntableRig | null;
  metaState: {
    tvMetaOn: boolean;
    tvScreenMat: THREE.MeshStandardMaterial | null;
    pcScreenMat: THREE.MeshStandardMaterial | null;
    pcScreenMesh: THREE.Mesh | null;
    arcadeScreenMat: THREE.MeshStandardMaterial | null;
    arcadeScreenMesh: THREE.Mesh | null;
    arcadeJoystickGroup: THREE.Group | null;
    bedroomLampLight: THREE.PointLight | null;
    bedroomLampShadeMat: THREE.MeshStandardMaterial | null;
    bedroomMoonlightFill: THREE.PointLight | null;
    silhouetteGroup: THREE.Group | null;
    basementLightOn: boolean;
    basementBlackout: boolean;
    bedroomLampOn: boolean;
    collectedParts: Set<string>;
    partMeshes: Record<string, THREE.Object3D>;
    toyGunWorldMesh: THREE.Group | null;
    nonEuclidCorridor: {
      group: THREE.Group | null;
      shellGroup: THREE.Group | null;
      endGroup: THREE.Group | null;
      endDoorPivot: THREE.Group | null;
      endDoorAngle: number;
      endDoorVel: number;
      endDoorIsOpen: boolean;
      endDoorAudioPlayed: boolean;
      bays: { group: THREE.Group; frontX: number }[];
      frontDoorLedMat: THREE.MeshBasicMaterial | null;
      dioramaLight: THREE.PointLight | null;
    };
    basementLab: {
      fanRotors: THREE.Object3D[];
      exhaustFanRotors: THREE.Object3D[];
      hologramGroup: THREE.Group | null;
      holoRings: THREE.Object3D[];
      robotArmHead: THREE.Object3D | null;
      coolantBubbles: THREE.Object3D[];
      crtCanvas: HTMLCanvasElement | null;
      crtCtx: CanvasRenderingContext2D | null;
      crtTexture: THREE.CanvasTexture | null;
      crtAccum: number;
      scanPulse: number;
      holoLight: THREE.PointLight | null;
      pcbLeds: THREE.MeshBasicMaterial[];
    };
    livingBrightLight: {
      isOn: boolean;
      lights: THREE.PointLight[];
      baseIntensities: number[];
      bulbMats: THREE.MeshBasicMaterial[];
      switchRockers: THREE.Object3D[];
      switchLedMats: THREE.MeshBasicMaterial[];
      fanRotor: THREE.Object3D | null;
      fanSpeed: number;
      onToggleNotify?: (isOn: boolean) => void;
    };
    livingTv: {
      isOn: boolean;
      canvas: HTMLCanvasElement | null;
      ctx: CanvasRenderingContext2D | null;
      texture: THREE.CanvasTexture | null;
      ledMat: THREE.MeshBasicMaterial | null;
      time: number;
      accum: number;
      score: number;
      channel: number;
      channelTimer: number;
      switchFlashTimer: number;
    };
    swivelChairs: SwivelChairRig[];
  };
  mat: (params: Parameters<typeof createTwilightMaterial>[1]) => THREE.MeshStandardMaterial;
  addWall: (
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    parent?: THREE.Object3D,
    castShadow?: boolean
  ) => THREE.Mesh;
  addBoxCollider: (
    id: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number
  ) => void;
  registerInteractable: (
    id: string,
    label: string,
    actionLabel: string,
    room: RoomId,
    mesh: THREE.Object3D,
    onInteract: () => InteractResult | void
  ) => void;
  registerDoor: (
    id: string,
    label: string,
    room: RoomId,
    hingeX: number,
    hingeY: number,
    hingeZ: number,
    doorWidth: number,
    doorHeight: number,
    axisDir: 'x+' | 'x-' | 'z+' | 'z-',
    openSign: 1 | -1,
    doorMat: THREE.Material,
    handleMat: THREE.Material,
    playDoorAudio: (open: boolean) => void
  ) => DoorController;
  registerCabinetDoor: (opts: CabinetDoorOptions) => DoorController;
  registerCeilingLamp: (opts: {
    id: string;
    room: RoomId;
    position: THREE.Vector3;
    light: THREE.PointLight;
    bulbMaterials?: THREE.MeshBasicMaterial[];
    baseIntensity: number;
    dimColorHex?: number;
    proximityRadius?: number;
  }) => CeilingLampRig;
  registerAmbientProp: (opts: AmbientPropOptions) => AmbientPropRig;
}

export function createRoomBuildContext(
  scene: THREE.Scene,
  uniforms: TwilightUniforms,
  textures: ProceduralTextures,
  outlines: OutlineRegistry,
  collisions: CollisionWorld,
  playCabinetAudio: (open: boolean) => void = () => {}
): RoomBuildContext {
  const sceneManager = new SceneManager(scene, false);

  const structureGroup = new THREE.Group();
  structureGroup.name = 'ApartmentStructure';
  scene.add(structureGroup);

  const ceilingGroup = new THREE.Group();
  ceilingGroup.name = 'ApartmentCeilings';
  scene.add(ceilingGroup);

  const interactables: InteractableTarget[] = [];
  const doors: DoorController[] = [];
  const volumetricRays: THREE.Mesh[] = [];
  const windowGlowMeshes: THREE.Mesh[] = [];
  const ceilingLamps: CeilingLampRig[] = [];
  const mirrors: ReflectiveMirrorRig[] = [];
  const ambientProps: AmbientPropRig[] = [];
  const clockRigs: { hourHand: THREE.Object3D; minuteHand: THREE.Object3D; secondHand?: THREE.Object3D }[] = [];
  const flickerLights: { light: THREE.PointLight; baseIntensity: number }[] = [];

  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const _tmpColor = new THREE.Color();
  const mat = (params: Parameters<typeof createTwilightMaterial>[1]) => {
    const colorHex =
      params.color !== undefined
        ? _tmpColor.set(params.color as THREE.ColorRepresentation).getHexString()
        : 'ffffff';
    const emissiveHex =
      params.emissive !== undefined
        ? _tmpColor.set(params.emissive as THREE.ColorRepresentation).getHexString()
        : 'none';
    const key = [
      colorHex,
      params.roughness ?? 1,
      params.metalness ?? 0,
      params.rimScale ?? 1,
      params.celStrength ?? 1,
      params.woodLacquer ?? 'auto',
      params.floorFresnel ?? 0,
      params.windSway ?? 0,
      params.fabricCream ?? 0,
      params.map ? params.map.uuid : 'nomap',
      params.bumpMap ? params.bumpMap.uuid : 'nobump',
      params.bumpScale ?? 0,
      params.roughnessMap ? params.roughnessMap.uuid : 'norough',
      params.transparent ? 1 : 0,
      params.opacity ?? 1,
      params.side ?? THREE.FrontSide,
      emissiveHex,
      params.emissiveIntensity ?? 1,
      params.envMapIntensity ?? 1,
      params.polygonOffset ? 1 : 0,
      params.polygonOffsetFactor ?? 0,
      params.polygonOffsetUnits ?? 0,
    ].join('|');

    const cached = matCache.get(key);
    if (cached) return cached;
    const created = createTwilightMaterial(uniforms, params);
    matCache.set(key, created);
    return created;
  };

  // Shared recessed warm wood interior cavity materials for open cabinets/cupboards
  const cabinetCavityMat = mat({
    color: 0x8f6b58,
    roughness: 0.88,
    metalness: 0.0,
    woodLacquer: 0.14,
  });
  const cabinetShelfMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xf8e5c8,
    roughness: 0.60,
    metalness: 0.0,
    woodLacquer: 0.48,
  });

  const addBoxCollider = (
    id: string,
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number
  ) => {
    collisions.addBox({
      id,
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minY: cy - h / 2,
      maxY: cy + h / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
  };

  const addWall = (
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    parent: THREE.Object3D = structureGroup,
    castShadow = false
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    // Scale UVs in world meters (1 tile = 2.0m x 2.0m) so wallpaper never stretches or squishes across different wall sizes
    const tileMeters = 2.0;
    const normAttr = geo.attributes.normal;
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      const nx = Math.abs(normAttr.getX(i));
      const ny = Math.abs(normAttr.getY(i));
      const u = uvAttr.getX(i);
      const v = uvAttr.getY(i);
      if (nx > 0.5) {
        uvAttr.setXY(i, u * (d / tileMeters), v * (h / tileMeters));
      } else if (ny > 0.5) {
        uvAttr.setXY(i, u * (w / tileMeters), v * (d / tileMeters));
      } else {
        uvAttr.setXY(i, u * (w / tileMeters), v * (h / tileMeters));
      }
    }
    uvAttr.needsUpdate = true;

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.name = id;
    parent.add(mesh);
    addBoxCollider(id, x, y, z, w, h, d);
    return mesh;
  };

  const registerInteractable = (
    id: string,
    label: string,
    actionLabel: string,
    room: RoomId,
    mesh: THREE.Object3D,
    onInteract: () => InteractResult | void
  ) => {
    mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !child.name.endsWith('_outline')) {
        child.layers.enable(1);
        child.userData.interactId = id;
      }
    });
    interactables.push({ id, label, actionLabel, room, mesh, onInteract });
  };

  const registerDoor = (
    id: string,
    label: string,
    room: RoomId,
    hingeX: number,
    hingeY: number,
    hingeZ: number,
    doorWidth: number,
    doorHeight: number,
    axisDir: 'x+' | 'x-' | 'z+' | 'z-',
    openSign: 1 | -1,
    doorMat: THREE.Material,
    handleMat: THREE.Material,
    playDoorAudio: (open: boolean) => void
  ): DoorController => {
    const isAlongZ = axisDir === 'z+' || axisDir === 'z-';
    const dirSign = axisDir === 'z+' || axisDir === 'x+' ? 1 : -1;

    // Derive unified luminous honey satin-matte oak door material with geometry-based recessed depth shading
    const baseDoorColor =
      (doorMat as THREE.MeshStandardMaterial).color?.clone() ??
      new THREE.Color(0xfff6e6);
    const doorThick = 0.058;
    const doorHalfThick = doorThick * 0.5; // 0.029m
    const recessCoreThick = 0.022; // True 18mm physical recess depth on BOTH sides
    const recessCoreHalf = recessCoreThick * 0.5; // 0.011m
    const maxRecessDepth = doorHalfThick - recessCoreHalf; // 0.018m

    const doorLeafMat = mat({
      map: textures.woodDoor,
      bumpMap: textures.woodDoorBump,
      bumpScale: 0.0055,
      color: baseDoorColor.clone().lerp(new THREE.Color(0xfff8eb), 0.30),
      roughness: 0.57,
      metalness: 0.0,
      woodLacquer: 0.52,
      doorDepthRelief: {
        halfThick: doorHalfThick,
        maxRecessDepth,
        doorHeight,
        doorHalfWidth: doorWidth * 0.5,
      },
    });
    const frameCasingMat = mat({
      map: textures.furnitureOak,
      bumpMap: textures.furnitureWoodBump,
      bumpScale: 0.005,
      color: baseDoorColor.clone().lerp(new THREE.Color(0xfff4e0), 0.35),
      roughness: 0.60,
      metalness: 0.0,
      woodLacquer: 0.50,
    });

    // 1. Clean Single-Layer Architectural Doorway Architrave Frame (Jambs + Header Casing)
    const frameGroup = new THREE.Group();
    const centerX = isAlongZ ? hingeX : hingeX + dirSign * (doorWidth / 2);
    const centerZ = isAlongZ ? hingeZ + dirSign * (doorWidth / 2) : hingeZ;
    frameGroup.position.set(centerX, hingeY, centerZ);

    const jambGeo = isAlongZ
      ? createBeveledBox(0.205, doorHeight + 0.05, 0.056, 0.008, 2)
      : createBeveledBox(0.056, doorHeight + 0.05, 0.205, 0.008, 2);
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(jambGeo, frameCasingMat);
      jamb.position.set(
        isAlongZ ? 0 : side * (doorWidth / 2 + 0.024),
        doorHeight / 2,
        isAlongZ ? side * (doorWidth / 2 + 0.024) : 0
      );
      jamb.castShadow = true;
      frameGroup.add(jamb);
    }
    const headerGeo = isAlongZ
      ? createBeveledBox(0.22, 0.072, doorWidth + 0.14, 0.010, 2)
      : createBeveledBox(doorWidth + 0.14, 0.072, 0.22, 0.010, 2);
    const header = new THREE.Mesh(headerGeo, frameCasingMat);
    header.position.set(0, doorHeight + 0.026, 0);
    header.castShadow = true;
    frameGroup.add(header);
    structureGroup.add(frameGroup);

    // 2. Pivoting Solid-Oak Door Leaf with Seamless Monolithic 3D Carved Recessed Panels
    //    All sub-geometries are pre-baked into ONE unified door-leaf local space
    //    (X in [-W/2, +W/2], Y in [0, H], Z in [-doorHalfThick, +doorHalfThick]) so
    //    aOrigPos, aOrigNormal, UV grain, and geometry-based depth shadows flow
    //    with 100% continuity from bottom to top — zero black outlines & zero splice seams!
    const pivot = new THREE.Group();
    pivot.userData.dynamic = true;
    pivot.position.set(hingeX, hingeY, hingeZ);
    structureGroup.add(pivot);

    const leafGroup = new THREE.Group();
    if (isAlongZ) {
      leafGroup.position.set(0, 0, dirSign * (doorWidth / 2));
      leafGroup.rotation.y = Math.PI / 2;
    } else {
      leafGroup.position.set(dirSign * (doorWidth / 2), 0, 0);
    }
    pivot.add(leafGroup);

    const stileW = Math.max(0.115, doorWidth * 0.148);
    const innerW = doorWidth - stileW * 2;
    const botRailH = doorHeight * 0.105;
    const lowerTopY = doorHeight * 0.388;
    const midTopY = doorHeight * 0.488;
    const upperTopY = doorHeight * 0.902;

    // Single unified clamped planar+edge UV projector in baked door-leaf space
    const applyUnifiedDoorUVs = (geo: THREE.BufferGeometry): void => {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const norm = geo.attributes.normal as THREE.BufferAttribute | undefined;
      let uv = geo.attributes.uv as THREE.BufferAttribute | undefined;
      if (!uv || uv.count !== pos.count) {
        uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
        geo.setAttribute('uv', uv);
      }
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const nx = norm ? Math.abs(norm.getX(i)) : 0;
        const ny = norm ? Math.abs(norm.getY(i)) : 0;
        // Subtle Z offset only on 90-degree perimeter/wall faces so wood grain wraps cleanly without streaks
        const uRaw = (px + doorWidth * 0.5 + (nx > 0.72 ? pz * 0.45 : 0)) / doorWidth;
        const vRaw = (py + (ny > 0.72 ? pz * 0.45 : 0)) / doorHeight;
        uv.setXY(
          i,
          THREE.MathUtils.clamp(uRaw, 0.004, 0.996),
          THREE.MathUtils.clamp(vRaw, 0.004, 0.996)
        );
      }
      uv.needsUpdate = true;
    };

    // 2A. Continuous watertight recessed inner oak core (pre-baked into Y = 0..doorHeight)
    const coreGeo = new THREE.BoxGeometry(doorWidth - 0.004, doorHeight - 0.004, recessCoreThick);
    coreGeo.translate(0, doorHeight * 0.5, 0);
    applyUnifiedDoorUVs(coreGeo);
    const coreMesh = new THREE.Mesh(coreGeo, doorLeafMat);
    coreMesh.castShadow = true;
    coreMesh.receiveShadow = true;
    leafGroup.add(coreMesh);

    // 2B. Monolithic seamless outer door face plates with 18mm physical recess & sculptural 4-segment bevels
    const outerBevelSize = 0.0082;
    const outerBevelThick = 0.0082;
    const outerExtrudeDepth = maxRecessDepth - outerBevelThick; // 0.0098m straight reveal + 0.0082m bevel = 0.018m

    const buildDoorFaceGeo = (): THREE.BufferGeometry => {
      const hw = doorWidth * 0.5 - outerBevelSize;
      const shape = new THREE.Shape();
      shape.moveTo(-hw, outerBevelSize);
      shape.lineTo(hw, outerBevelSize);
      shape.lineTo(hw, doorHeight - outerBevelSize);
      shape.lineTo(-hw, doorHeight - outerBevelSize);
      shape.closePath();

      // Offset holes outward by outerBevelSize so the finished bevel opening matches innerW & rail heights
      const addPanelHole = (y0: number, y1: number) => {
        const hole = new THREE.Path();
        const x0 = -innerW * 0.5 - outerBevelSize;
        const x1 = innerW * 0.5 + outerBevelSize;
        const hy0 = y0 - outerBevelSize;
        const hy1 = y1 + outerBevelSize;
        hole.moveTo(x0, hy0);
        hole.lineTo(x0, hy1);
        hole.lineTo(x1, hy1);
        hole.lineTo(x1, hy0);
        hole.closePath();
        shape.holes.push(hole);
      };
      addPanelHole(botRailH, lowerTopY);
      addPanelHole(midTopY, upperTopY);

      const faceGeo = new THREE.ExtrudeGeometry(shape, {
        depth: outerExtrudeDepth,
        bevelEnabled: true,
        bevelThickness: outerBevelThick,
        bevelSize: outerBevelSize,
        bevelSegments: 4,
      });
      // Translate so outer flat face sits at Z = +doorHalfThick (+0.029m) and back embeds into solid core
      faceGeo.translate(0, 0, recessCoreHalf);
      return faceGeo;
    };

    const frontFaceGeo = buildDoorFaceGeo();
    applyUnifiedDoorUVs(frontFaceGeo);
    const frontFace = new THREE.Mesh(frontFaceGeo, doorLeafMat);
    frontFace.castShadow = true;
    frontFace.receiveShadow = true;
    // Intentionally NO inverted-hull outline on recessed door panels (pure geometry-based depth shadow!)
    leafGroup.add(frontFace);

    const backFaceGeo = buildDoorFaceGeo();
    backFaceGeo.rotateY(Math.PI);
    applyUnifiedDoorUVs(backFaceGeo);
    const backFace = new THREE.Mesh(backFaceGeo, doorLeafMat);
    backFace.castShadow = true;
    backFace.receiveShadow = true;
    leafGroup.add(backFace);

    // 2C. Sculpted chamfered inner fielded panels leaving a crisp 22mm deep recessed shadow groove all around
    const coffers: [number, number][] = [
      [(midTopY + upperTopY) / 2, upperTopY - midTopY],
      [(botRailH + lowerTopY) / 2, lowerTopY - botRailH],
    ];
    const grooveMoat = 0.022;
    const bossBevelSize = 0.013;
    const bossBevelThick = 0.0062;
    const bossExtrudeDepth = 0.0046; // Rises from |z|=0.011 to |z|=0.0218 (recessed 7.2mm below outer door face)

    for (const [cy, ch] of coffers) {
      const footprintW = innerW - grooveMoat * 2;
      const footprintH = ch - grooveMoat * 2;
      const corePanelW = footprintW - bossBevelSize * 2;
      const corePanelH = footprintH - bossBevelSize * 2;
      if (corePanelW > 0.06 && corePanelH > 0.06) {
        const buildFieldBossGeo = (): THREE.BufferGeometry => {
          const bShape = new THREE.Shape();
          const bhw = corePanelW * 0.5;
          const bhh = corePanelH * 0.5;
          bShape.moveTo(-bhw, -bhh);
          bShape.lineTo(bhw, -bhh);
          bShape.lineTo(bhw, bhh);
          bShape.lineTo(-bhw, bhh);
          bShape.closePath();

          const bGeo = new THREE.ExtrudeGeometry(bShape, {
            depth: bossExtrudeDepth,
            bevelEnabled: true,
            bevelThickness: bossBevelThick,
            bevelSize: bossBevelSize,
            bevelSegments: 4,
          });
          bGeo.translate(0, cy, recessCoreHalf);
          return bGeo;
        };

        const frontBossGeo = buildFieldBossGeo();
        applyUnifiedDoorUVs(frontBossGeo);
        const frontBoss = new THREE.Mesh(frontBossGeo, doorLeafMat);
        frontBoss.castShadow = true;
        frontBoss.receiveShadow = true;
        leafGroup.add(frontBoss);

        const backBossGeo = buildFieldBossGeo();
        backBossGeo.rotateY(Math.PI);
        applyUnifiedDoorUVs(backBossGeo);
        const backBoss = new THREE.Mesh(backBossGeo, doorLeafMat);
        backBoss.castShadow = true;
        backBoss.receiveShadow = true;
        leafGroup.add(backBoss);
      }
    }

    // Slim realistic lever assembly on both sides
    const handleGroup = new THREE.Group();
    const hOffset = dirSign * (doorWidth - 0.12);
    handleGroup.position.set(isAlongZ ? 0 : hOffset, 1.02, isAlongZ ? hOffset : 0);

    const roseGeo = new THREE.CylinderGeometry(0.027, 0.027, doorThick + 0.020, 14);
    if (isAlongZ) roseGeo.rotateZ(Math.PI / 2);
    else roseGeo.rotateX(Math.PI / 2);
    const rose = new THREE.Mesh(roseGeo, handleMat);
    handleGroup.add(rose);

    for (const side of [-1, 1]) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0085, 0.0085, 0.042, 10),
        handleMat
      );
      if (isAlongZ) {
        stem.rotation.z = Math.PI / 2;
        stem.position.x = side * (doorThick / 2 + 0.020);
      } else {
        stem.rotation.x = Math.PI / 2;
        stem.position.z = side * (doorThick / 2 + 0.020);
      }
      handleGroup.add(stem);

      const gripGeo = isAlongZ
        ? createBeveledBox(0.016, 0.016, 0.120, 0.005, 2)
        : createBeveledBox(0.120, 0.016, 0.016, 0.005, 2);
      const grip = new THREE.Mesh(gripGeo, handleMat);
      if (isAlongZ) {
        grip.position.set(
          side * (doorThick / 2 + 0.040),
          0,
          -dirSign * 0.044
        );
      } else {
        grip.position.set(
          -dirSign * 0.044,
          0,
          side * (doorThick / 2 + 0.040)
        );
      }
      handleGroup.add(grip);
    }
    pivot.add(handleGroup);
    // Merge all door-leaf panels, moldings & hardware into 1 single multi-material draw call
    mergeDynamicSubtreeMeshes(pivot, outlines, `${id}_leaf_merged`);

    // Attach world-tracked handle anchor nodes AFTER mesh merge so both sides of the lever handle
    // always follow the rotating door leaf in world space for Right-Hand IK grasping
    const handleAnchors: THREE.Object3D[] = [];
    for (const side of [-1, 1] as const) {
      const anchor = new THREE.Object3D();
      anchor.name = `${id}_handle_anchor_${side > 0 ? 'pos' : 'neg'}`;
      if (isAlongZ) {
        anchor.position.set(
          side * (doorThick / 2 + 0.044),
          1.02,
          hOffset - dirSign * 0.044
        );
      } else {
        anchor.position.set(
          hOffset - dirSign * 0.044,
          1.02,
          side * (doorThick / 2 + 0.044)
        );
      }
      pivot.add(anchor);
      handleAnchors.push(anchor);
    }

    const colliderId = `door_col_${id}`;
    addBoxCollider(
      colliderId,
      centerX,
      hingeY + doorHeight / 2,
      centerZ,
      isAlongZ ? 0.16 : doorWidth,
      doorHeight,
      isAlongZ ? doorWidth : 0.16
    );

    const ctrl: DoorController = {
      id,
      pivot,
      colliderId,
      isOpen: false,
      closedAngle: 0,
      openAngle: openSign * (Math.PI * 0.48),
      currentAngle: 0,
      isRoomDoor: true,
      hingePos: new THREE.Vector3(hingeX, hingeY, hingeZ),
      doorWidth,
      axisDir,
      defaultOpenSign: openSign,
      angularVel: 0,
      pushSign: openSign,
      isBeingPushed: false,
      wasPassingThrough: false,
      audioPlayedForPush: false,
      closeThudPlayed: false,
      playAudio: playDoorAudio,
      handleAnchors,
    };
    doors.push(ctrl);

    registerInteractable(
      id,
      label,
      '推开 / 开关门',
      room,
      pivot,
      () => {
        ctrl.isOpen = !ctrl.isOpen;
        ctrl.isBeingPushed = false;
        ctrl.closeThudPlayed = false;
        ctrl.angularVel = (ctrl.isOpen ? openSign : -openSign) * 3.2;
        collisions.setEnabled(colliderId, false);
        playDoorAudio(ctrl.isOpen);
        return {
          title: label,
          message: ctrl.isOpen ? `轻轻推开了${label}。` : `带上了${label}。`,
        };
      }
    );

    return ctrl;
  };

  const registerCabinetDoor = (opts: CabinetDoorOptions): DoorController => {
    const {
      id,
      label,
      room,
      centerX,
      centerY,
      centerZ,
      width,
      height,
      depth,
      thickness,
      facingAxis,
      facingSign,
      hingeSide,
      openSign: explicitOpenSign,
      frontMat,
      doorMat,
      moldingMat,
      handleMat,
      parent,
      customDoorGroup,
      addRecessedCavity = true,
      openAngleMag = Math.PI * 0.46,
      messageOpen,
      messageClose,
    } = opts;
    const doorDepth = thickness ?? depth ?? 0.028;
    const resolvedFrontMat = doorMat ?? frontMat ?? moldingMat;

    // 1. Dark recessed interior cabinet cavity + inner shelf behind the door (visible when swung open!)
    if (addRecessedCavity) {
      const cavW = Math.max(0.06, width - 0.04);
      const cavH = Math.max(0.06, height - 0.04);
      const cavGeo =
        facingAxis === 'x'
          ? new THREE.BoxGeometry(0.016, cavH, cavW)
          : new THREE.BoxGeometry(cavW, cavH, 0.016);
      const cavityMesh = new THREE.Mesh(cavGeo, cabinetCavityMat);
      cavityMesh.position.set(
        facingAxis === 'x' ? centerX - facingSign * 0.008 : centerX,
        centerY,
        facingAxis === 'z' ? centerZ - facingSign * 0.008 : centerZ
      );
      parent.add(cavityMesh);

      if (height >= 0.28) {
        const shelfGeo =
          facingAxis === 'x'
            ? createBeveledBox(0.022, 0.016, cavW - 0.01, 0.003, 1)
            : createBeveledBox(cavW - 0.01, 0.016, 0.022, 0.003, 1);
        const shelfMesh = new THREE.Mesh(shelfGeo, cabinetShelfMat);
        shelfMesh.position.set(
          facingAxis === 'x' ? centerX - facingSign * 0.004 : centerX,
          centerY - 0.02,
          facingAxis === 'z' ? centerZ - facingSign * 0.004 : centerZ
        );
        parent.add(shelfMesh);
      }
    }

    // 2. Hinge pivot group positioned at the hinged vertical edge of the cabinet door
    const pivot = new THREE.Group();
    pivot.userData.dynamic = true;
    const hingeOffset = hingeSide * (width / 2);
    if (facingAxis === 'x') {
      pivot.position.set(centerX, centerY, centerZ + hingeOffset);
    } else {
      pivot.position.set(centerX + hingeOffset, centerY, centerZ);
    }
    parent.add(pivot);

    // 3. Door leaf mesh offset from the hinge so its closed center sits at (centerX, centerY, centerZ)
    const leafGroup =
      customDoorGroup ??
      createMoldedDrawerFront(
        width,
        height,
        doorDepth,
        facingAxis,
        resolvedFrontMat,
        moldingMat,
        handleMat,
        facingSign,
        (-hingeSide) as -1 | 1
      );
    if (facingAxis === 'x') {
      leafGroup.position.set(0, 0, -hingeOffset);
    } else {
      leafGroup.position.set(-hingeOffset, 0, 0);
    }
    pivot.add(leafGroup);
    // Merge cabinet door panel, raised Shaker moldings & handle into 1 single draw call
    mergeDynamicSubtreeMeshes(pivot, outlines, `${id}_cab_merged`);

    // Attach world-tracked cabinet handle anchor after merge for Right-Hand IK interaction
    const cabHandleAnchor = new THREE.Object3D();
    cabHandleAnchor.name = `${id}_cab_handle_anchor`;
    const handleSpanFromHinge = -hingeSide * Math.max(0.06, width * 0.86);
    if (facingAxis === 'x') {
      cabHandleAnchor.position.set(
        facingSign * (doorDepth * 0.5 + 0.028),
        0,
        handleSpanFromHinge
      );
    } else {
      cabHandleAnchor.position.set(
        handleSpanFromHinge,
        0,
        facingSign * (doorDepth * 0.5 + 0.028)
      );
    }
    pivot.add(cabHandleAnchor);

    // 4. Compute exact outward swing direction around the Y axis
    const openSign: 1 | -1 =
      explicitOpenSign ??
      (facingAxis === 'x'
        ? ((-hingeSide * facingSign) as 1 | -1)
        : ((hingeSide * facingSign) as 1 | -1));

    const ctrl: DoorController = {
      id,
      pivot,
      colliderId: '',
      isOpen: false,
      closedAngle: 0,
      openAngle: openSign * openAngleMag,
      currentAngle: 0,
      handleAnchors: [cabHandleAnchor],
    };
    doors.push(ctrl);

    registerInteractable(
      id,
      label,
      '开关柜门',
      room,
      pivot,
      () => {
        ctrl.isOpen = !ctrl.isOpen;
        playCabinetAudio(ctrl.isOpen);
        return {
          title: label,
          message: ctrl.isOpen
            ? (messageOpen ?? `伴随着木铰链轻微的吱呀声，拉开了${label}。`)
            : (messageClose ?? `轻轻合上了${label}。`),
        };
      }
    );

    return ctrl;
  };

  const registerCeilingLamp = (opts: {
    id: string;
    room: RoomId;
    position: THREE.Vector3;
    light: THREE.PointLight;
    bulbMaterials?: THREE.MeshBasicMaterial[];
    baseIntensity: number;
    dimColorHex?: number;
    proximityRadius?: number;
  }): CeilingLampRig => {
    const mats = opts.bulbMaterials ?? [];
    const rig: CeilingLampRig = {
      id: opts.id,
      room: opts.room,
      position: opts.position.clone(),
      light: opts.light,
      bulbMaterials: mats,
      bulbBaseColors: mats.map((m) => m.color.clone()),
      baseColor: opts.light.color.clone(),
      dimColor: new THREE.Color(opts.dimColorHex ?? 0x703b54),
      baseIntensity: opts.baseIntensity,
      modeMultiplier: 1.0,
      userEnabled: true,
      burstTimer: 0,
      burstDuration: 1.1,
      burstSeed: Math.random() * 100,
      proximityRadius: opts.proximityRadius ?? 3.3,
      proximityCooldown: 0,
      wasWithinProximity: false,
      currentFactor: 1.0,
    };
    ceilingLamps.push(rig);
    return rig;
  };

  let propSeedCounter = 1;
  const registerAmbientProp = (opts: AmbientPropOptions): AmbientPropRig => {
    // Merge multi-part tabletop trinket / pen meshes into 1 draw call while preserving live motion
    mergeDynamicSubtreeMeshes(opts.mesh, outlines, `${opts.id}_prop_merged`);
    opts.mesh.userData.dynamic = true;
    opts.mesh.rotation.order = 'YXZ';

    const seed = (propSeedCounter++ * 1.61803398875) % 100.0;
    const rig: AmbientPropRig = {
      id: opts.id,
      room: opts.room,
      mesh: opts.mesh,
      worldOrigin: new THREE.Vector3(opts.worldPos[0], opts.worldPos[1], opts.worldPos[2]),
      baseLocalPos: opts.mesh.position.clone(),
      baseLocalRot: opts.mesh.rotation.clone(),
      kind: opts.kind ?? 'trinket',
      maxDrift: opts.maxDrift ?? 0.026,
      rollRadius: opts.rollRadius ?? 0.006,
      rollAxis: opts.rollAxis ?? 'x',
      reactivity: opts.reactivity ?? 1.0,
      seed,
      driftX: 0,
      driftZ: 0,
      driftYaw: 0,
      offsetX: 0,
      offsetZ: 0,
      velX: 0,
      velZ: 0,
      yawOffset: 0,
      yawVel: 0,
      tiltX: 0,
      tiltZ: 0,
      tiltVelX: 0,
      tiltVelZ: 0,
    };
    ambientProps.push(rig);
    return rig;
  };

  return {
    scene,
    sceneManager,
    structureGroup,
    ceilingGroup,
    uniforms,
    textures,
    outlines,
    collisions,
    interactables,
    doors,
    volumetricRays,
    windowGlowMeshes,
    ceilingLamps,
    mirrors,
    ambientProps,
    clockRigs,
    flickerLights,
    turntableRig: null,
    metaState: {
      tvMetaOn: false,
      tvScreenMat: null,
      pcScreenMat: null,
      pcScreenMesh: null,
      arcadeScreenMat: null,
      arcadeScreenMesh: null,
      arcadeJoystickGroup: null,
      bedroomLampLight: null,
      bedroomLampShadeMat: null,
      bedroomMoonlightFill: null,
      silhouetteGroup: null,
      basementLightOn: true,
      basementBlackout: false,
      bedroomLampOn: true,
      collectedParts: new Set<string>(),
      partMeshes: {},
      toyGunWorldMesh: null,
      nonEuclidCorridor: {
        group: null,
        shellGroup: null,
        endGroup: null,
        endDoorPivot: null,
        endDoorAngle: 0,
        endDoorVel: 0,
        endDoorIsOpen: false,
        endDoorAudioPlayed: false,
        bays: [],
        frontDoorLedMat: null,
        dioramaLight: null,
      },
      basementLab: {
        fanRotors: [],
        exhaustFanRotors: [],
        hologramGroup: null,
        holoRings: [],
        robotArmHead: null,
        coolantBubbles: [],
        crtCanvas: null,
        crtCtx: null,
        crtTexture: null,
        crtAccum: 0,
        scanPulse: 0,
        holoLight: null,
        pcbLeds: [],
      },
      livingBrightLight: {
        isOn: false,
        lights: [],
        baseIntensities: [],
        bulbMats: [],
        switchRockers: [],
        switchLedMats: [],
        fanRotor: null,
        fanSpeed: 0.9,
      },
      livingTv: {
        isOn: false,
        canvas: null,
        ctx: null,
        texture: null,
        ledMat: null,
        time: 0,
        accum: 0,
        score: 0,
        channel: 0,
        channelTimer: 0,
        switchFlashTimer: 0,
      },
      swivelChairs: [],
    },
    mat,
    addWall,
    addBoxCollider,
    registerInteractable,
    registerDoor,
    registerCabinetDoor,
    registerCeilingLamp,
    registerAmbientProp,
  };
}

/**
 * Builds a high-detail 5-part Fountain Pen (aligned along local X axis so it rolls
 * naturally around its barrel) plus an optional companion drafting pencil.
 */
export function createTabletopPenSet(
  ctx: RoomBuildContext,
  barrelColorHex = 0x2c3e6b,
  withCompanionPencil = true
): { penGroup: THREE.Group; pencilGroup?: THREE.Group } {
  const { mat, outlines } = ctx;
  const barrelMat = mat({ color: barrelColorHex, roughness: 0.26, metalness: 0.35 });
  const brassMat = mat({ color: 0xd4a859, roughness: 0.24, metalness: 0.85 });
  const nibSteelMat = mat({ color: 0xe6ebf5, roughness: 0.18, metalness: 0.90 });

  const penGroup = new THREE.Group();
  penGroup.rotation.order = 'YXZ';

  // 1. Main lacquered barrel (aligned along X axis, radius = 0.0056m, length = 0.128m)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0056, 0.0050, 0.128, 10),
    barrelMat
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.y = 0.0056;
  barrel.castShadow = true;
  outlines.addOutline(barrel, 1.08);
  penGroup.add(barrel);

  // 2. Brass center cap ring & rear finial
  const capRing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0061, 0.0061, 0.012, 10),
    brassMat
  );
  capRing.rotation.z = Math.PI / 2;
  capRing.position.set(-0.012, 0.0056, 0);
  penGroup.add(capRing);

  // 3. Pocket clip bar along the cap
  const clip = new THREE.Mesh(
    createBeveledBox(0.044, 0.0026, 0.0036, 0.0008, 1),
    brassMat
  );
  clip.position.set(-0.036, 0.012, 0);
  penGroup.add(clip);

  // 4. Tapered metallic nib collar & fountain nib tip (+X end)
  const nibCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.0050, 0.024, 10),
    nibSteelMat
  );
  nibCone.rotation.z = -Math.PI / 2;
  nibCone.position.set(0.074, 0.0056, 0);
  penGroup.add(nibCone);

  if (!withCompanionPencil) {
    return { penGroup };
  }

  // Companion hexagonal wood/brass drafting pencil
  const pencilGroup = new THREE.Group();
  pencilGroup.rotation.order = 'YXZ';
  const cedarMat = mat({ color: 0xc98a5b, roughness: 0.46, metalness: 0.08 });
  const graphiteMat = mat({ color: 0x2a2733, roughness: 0.35, metalness: 0.45 });

  const pShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0046, 0.0046, 0.136, 6),
    cedarMat
  );
  pShaft.rotation.z = Math.PI / 2;
  pShaft.position.y = 0.0046;
  pShaft.castShadow = true;
  outlines.addOutline(pShaft, 1.08);
  pencilGroup.add(pShaft);

  const pTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.0046, 0.018, 8),
    graphiteMat
  );
  pTip.rotation.z = -Math.PI / 2;
  pTip.position.set(0.076, 0.0046, 0);
  pencilGroup.add(pTip);

  const pFerrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0049, 0.0049, 0.012, 10),
    brassMat
  );
  pFerrule.rotation.z = Math.PI / 2;
  pFerrule.position.set(-0.070, 0.0046, 0);
  pencilGroup.add(pFerrule);

  return { penGroup, pencilGroup };
}

/**
 * Builds a small cluster of tactile tabletop trinkets (polyhedral dice, miniature
 * brass spinning top / star paperweight, or vintage coins) that react to player movement.
 */
export function createTabletopTrinketCluster(
  ctx: RoomBuildContext,
  variant: 'dice_top' | 'brass_rings' | 'coins_tag' = 'dice_top'
): THREE.Group {
  const { mat, outlines } = ctx;
  const cluster = new THREE.Group();
  cluster.rotation.order = 'YXZ';

  const brassMat = mat({ color: 0xd4a859, roughness: 0.24, metalness: 0.86 });
  const ivoryMat = mat({ color: 0xf4ece1, roughness: 0.38, metalness: 0.05 });
  const obsidianMat = mat({ color: 0x262134, roughness: 0.25, metalness: 0.45 });
  const glassGemMat = mat({
    color: 0x66e0ff,
    emissive: 0x1d688a,
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.2,
  });

  if (variant === 'dice_top') {
    // 1. Two small beveled ivory & obsidian gaming dice
    const die1 = new THREE.Mesh(
      createBeveledBox(0.019, 0.019, 0.019, 0.004, 2),
      ivoryMat
    );
    die1.position.set(-0.018, 0.0095, 0.008);
    die1.rotation.y = 0.35;
    die1.castShadow = true;
    outlines.addOutline(die1, 1.08);
    cluster.add(die1);

    const die2 = new THREE.Mesh(
      createBeveledBox(0.017, 0.017, 0.017, 0.0035, 2),
      obsidianMat
    );
    die2.position.set(0.012, 0.0085, 0.022);
    die2.rotation.y = -0.52;
    die2.castShadow = true;
    outlines.addOutline(die2, 1.08);
    cluster.add(die2);

    // 2. Miniature Brass Spinning Top (Totem Trinket)
    const topGroup = new THREE.Group();
    topGroup.position.set(0.014, 0.018, -0.014);
    topGroup.rotation.z = 0.12;
    const coneLow = new THREE.Mesh(
      new THREE.ConeGeometry(0.016, 0.018, 14),
      brassMat
    );
    coneLow.rotation.x = Math.PI;
    coneLow.position.y = -0.009;
    coneLow.castShadow = true;
    outlines.addOutline(coneLow, 1.08);
    topGroup.add(coneLow);

    const coneRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.010, 0.006, 14),
      brassMat
    );
    coneRim.position.y = 0.003;
    topGroup.add(coneRim);

    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.004, 0.016, 10),
      brassMat
    );
    stem.position.y = 0.012;
    topGroup.add(stem);
    cluster.add(topGroup);
  } else if (variant === 'brass_rings') {
    // Interlocking brass armillary paperweight + glowing glass marble
    const baseCoin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.026, 0.006, 16),
      obsidianMat
    );
    baseCoin.position.y = 0.003;
    cluster.add(baseCoin);

    for (const [rx, rz, rRad] of [
      [0.35, 0.2, 0.020],
      [-0.4, 0.85, 0.016],
    ] as const) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(rRad, 0.0028, 8, 18),
        brassMat
      );
      ring.position.set(0, 0.024, 0);
      ring.rotation.set(rx, 0.3, rz);
      ring.castShadow = true;
      outlines.addOutline(ring, 1.06);
      cluster.add(ring);
    }

    const coreGem = new THREE.Mesh(
      new THREE.SphereGeometry(0.0085, 12, 10),
      glassGemMat
    );
    coreGem.position.set(0, 0.024, 0);
    cluster.add(coreGem);
  } else {
    // Stacked brass coins & metallic charm tag
    for (const [cx, cy, cz] of [
      [-0.012, 0.0025, 0.004],
      [-0.006, 0.0065, 0.008],
      [0.018, 0.0025, -0.008],
    ] as const) {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.013, 0.013, 0.004, 14),
        brassMat
      );
      coin.position.set(cx, cy, cz);
      coin.castShadow = true;
      outlines.addOutline(coin, 1.08);
      cluster.add(coin);
    }
  }

  return cluster;
}

