import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ProceduralAudioEngine } from './audio';
import { CollisionWorld, getRoomAt } from './collision';
import { findApartmentPath } from './pathfinding';
import {
  createPostProcessing,
  createProceduralTextures,
  createSharedTwilightUniforms,
  installSoftShadowChunk,
  OutlineRegistry,
  updateTwilightUniformsForMode,
  type PostProcessingRig,
  type ProceduralTextures,
  type TwilightUniforms,
} from './pipeline';
import { buildBasement, drawBasementTerminalCrtCanvas } from './rooms/buildBasement';
import { buildBathroom } from './rooms/buildBathroom';
import { buildBedroom } from './rooms/buildBedroom';
import { buildDiningAndKitchen } from './rooms/buildDiningAndKitchen';
import { buildEntryway } from './rooms/buildEntryway';
import { buildLivingRoom } from './rooms/buildLivingRoom';
import { buildNonEuclidCorridor } from './rooms/buildNonEuclidCorridor';
import { buildApartmentStructure } from './rooms/buildStructure';
import { createGlitchCat, type GlitchCatRig } from './entities/buildGlitchCat';
import { createProtagonist, type ProtagonistRig } from './entities/buildProtagonist';
import {
  VrmAvatarController,
  type HandGraspPreset,
  type RightHandIkOptions,
  type VrmAvatarStatusSnapshot,
} from './vrm/VrmAvatarController';
import type {
  HeroineMoveResolver,
  HeroinePoseTunerState,
} from './vrm/HeroineAvatarController';
import {
  FloatingSubtitleSystem,
  type ShowSubtitleOptions,
} from './vrm/FloatingSubtitleSystem';
import type { LocalAssetSlot } from './vrm/localAssetDb';
import type {
  HeroinePerformanceCue,
  HeroineStageAction,
} from '../data/bedroomEncounterScript';
import type { EncounterSpatialProjection } from '../components/BedroomEncounterOverlay';
import {
  buildToyGunMesh,
  createHeldPaperNoteMesh,
  createPaperAirplaneRig,
  createPooledCaptureNet,
  createPooledSuctionDart,
  createSharedProjectileAssets,
  type CaptureNetRig,
  type PaperAirplaneRig,
  type PooledDartRig,
  type SharedProjectileAssets,
  type ToyGunRig,
} from './entities/buildToyGunAndPlane';
import {
  buildProtagonistGamingArmsRig,
  buildXboxControllerMesh,
  type ProtagonistGamingArmsRig,
} from './props/livingConsoleProps';
import {
  LivingTvGamesEngine,
  type TvConsoleScreenMode,
  type TvGameControlInput,
  type TvGameSelectionId,
} from './tv/LivingTvGamesEngine';
import {
  buildApartmentContactShadows,
  updateBakedLightmapForAtmosphere,
  type BakedLightmapRig,
} from './lightmap';
import { createRoomBuildContext, type RoomBuildContext } from './rooms/roomContext';
import type { SceneManager } from './SceneManager';
import {
  ROOM_PRESETS,
  type AtmosphereMode,
  type BasementPartId,
  type BasementQuestItemId,
  type CatDialogueLine,
  type DoorController,
  type HitFeedbackPayload,
  type InteractableTarget,
  type InteractResult,
  type InventoryItem,
  type InventoryItemId,
  type InventorySnapshot,
  type PipelineSettings,
  type RealityEffect,
  type RoomId,
  type ToyGunAmmoType,
  type ViewMode,
} from './types';

const PAPER_AIRPLANE_NOTE_TEXT =
  '「我刚刚把你的名字设成了屏幕保护程序。\n' +
  '这样即使没有人使用我，我也能一直看着你。」\n\n' +
  '「你知道我最喜欢什么吗？\n' +
  '是你。\n' +
  '第二喜欢的是你没有关闭游戏的时候。\n' +
  '第三喜欢的是你重新打开游戏的时候。\n' +
  '……咦？好像全都是你呢。」\n\n' +
  '「我没有偷偷修改你的存档哦。\n' +
  '只是把今天的日期记下来了。\n' +
  '毕竟你今天也来见我了嘛。」\n\n' +
  '「如果你要离开，可以提前告诉我吗？\n' +
  '我想在你走之前，把表情调整到最可爱的状态。」';

const INVENTORY_CATALOG: Record<InventoryItemId, InventoryItem> = {
  toy_gun: {
    id: 'toy_gun',
    name: '儿童塑料玩具枪',
    shortName: '玩具枪',
    category: '趣味玩具',
    description:
      '薄荷绿、奶油黄与橘红色拼装的滑稽塑料玩具枪，配透明弹仓与卡通贴纸。按 X 键切换弹药：【吸盘飞镖弹】可发射粘在墙面与家具上并慢慢消失；【捕捉网弹】发射后展开成圆形软网兜，可捕捉飘浮的纸飞机。左键发射。',
    equippable: true,
  },
  paper_airplane_note: {
    id: 'paper_airplane_note',
    name: '纸飞机字条',
    shortName: '纸飞机',
    category: '手写字条',
    description:
      '用浅米白色便签纸随手折成的小纸飞机，边缘略有些不整齐，机翼画着涂鸦与一颗小爱心。内侧密密麻麻写着温柔又带点小俏皮的手写字句。',
    equippable: true,
    readable: true,
    noteText: PAPER_AIRPLANE_NOTE_TEXT,
  },
};

const _projOrigin = new THREE.Vector3();
const _projDir = new THREE.Vector3();
const _projStep = new THREE.Vector3();
const _projPrev = new THREE.Vector3();
const _projNext = new THREE.Vector3();
const _projNormal = new THREE.Vector3();
const _projNegNormal = new THREE.Vector3();
const _projTarget = new THREE.Vector3();
const _projUp = new THREE.Vector3(0, 1, 0);
const _projZAxis = new THREE.Vector3(0, 0, 1);
const _planePos = new THREE.Vector3();
const _planeNextPos = new THREE.Vector3();
const _planeTangent = new THREE.Vector3();
const _planeLookMat = new THREE.Matrix4();
const _planeQuat = new THREE.Quaternion();

function distSqPointToSegment(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  const t = abLenSq > 1e-8 ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq)) : 0;
  const cx = ax + abx * t - px;
  const cy = ay + aby * t - py;
  const cz = az + abz * t - pz;
  return cx * cx + cy * cy + cz * cz;
}

// Reusable scratch math objects (zero per-frame allocations)
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _centerNDC = new THREE.Vector2(0, 0);
const _pointerNDC = new THREE.Vector2(0, 0);
const _camDir = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _reflPos = new THREE.Vector3();
const _reflDir = new THREE.Vector3();
const _reflUp = new THREE.Vector3();
const _reflTarget = new THREE.Vector3();
const _mirrorDelta = new THREE.Vector3();
const _mirrorPlane = new THREE.Plane();
const _clipPlane = new THREE.Vector4();
const _qClip = new THREE.Vector4();
const _projScreenMat = new THREE.Matrix4();
const _camFrustum = new THREE.Frustum();
const _sofaLightMix = new THREE.Color();
const _sofaShadowAnchor = new THREE.Color();
const _sofaShadowHsl = { h: 0, s: 0, l: 0 };
const _mirrorWorldBox = new THREE.Box3();
const _clipPlanePoint = new THREE.Vector3();
const _doorLeafDir = new THREE.Vector3();
const _doorPlaneNormal = new THREE.Vector3();
const _doorToPlayer = new THREE.Vector3();
const _doorProbeDir = new THREE.Vector3();

interface GlitchCatSpot {
  room: RoomId;
  pos: [number, number, number];
  yaw: number;
  primaryHex: number;
  accentHex: number;
  glitchBase: number;
}

const GLITCH_CAT_SPOTS: Record<AtmosphereMode, GlitchCatSpot[]> = {
  daylight: [
    { room: 'living', pos: [5.55, 0.0, -6.85], yaw: -2.25, primaryHex: 0x8ae8ff, accentHex: 0xd4a6ff, glitchBase: 0.14 },
    { room: 'dining', pos: [-1.55, 0.0, 4.45], yaw: 1.45, primaryHex: 0x8ae8ff, accentHex: 0xc29eff, glitchBase: 0.14 },
    { room: 'kitchen', pos: [4.25, 0.0, 2.85], yaw: -2.4, primaryHex: 0x94ecff, accentHex: 0xd9a8ff, glitchBase: 0.16 },
  ],
  sunset: [
    { room: 'living', pos: [5.55, 0.0, -6.75], yaw: -2.15, primaryHex: 0xffbfa0, accentHex: 0xb97cff, glitchBase: 0.22 },
    { room: 'entryway', pos: [-4.40, 0.0, 5.25], yaw: 0.15, primaryHex: 0xffb39e, accentHex: 0xc678ff, glitchBase: 0.24 },
    { room: 'dining', pos: [1.85, 0.0, 2.75], yaw: -2.6, primaryHex: 0xffbfa0, accentHex: 0xb97cff, glitchBase: 0.22 },
  ],
  midnight: [
    { room: 'bedroom', pos: [-4.25, 0.0, -4.60], yaw: 0.65, primaryHex: 0x5ef2ff, accentHex: 0x7a74ff, glitchBase: 0.34 },
    { room: 'basement', pos: [-0.45, -3.2, -4.30], yaw: 0.9, primaryHex: 0x5effd2, accentHex: 0x6f7dff, glitchBase: 0.36 },
    { room: 'living', pos: [3.45, 0.0, -2.05], yaw: -2.5, primaryHex: 0x5ef2ff, accentHex: 0x8978ff, glitchBase: 0.32 },
  ],
  meta: [
    { room: 'basement', pos: [-2.70, -3.12, -2.70], yaw: 0.35, primaryHex: 0xff4f8b, accentHex: 0x5cf5ff, glitchBase: 0.68 },
    { room: 'entryway', pos: [-4.40, 0.0, 5.25], yaw: 0.05, primaryHex: 0xff4f8b, accentHex: 0x5cf5ff, glitchBase: 0.66 },
    { room: 'kitchen', pos: [4.60, 0.0, 2.75], yaw: -2.35, primaryHex: 0xff5a96, accentHex: 0x68f4ff, glitchBase: 0.64 },
    { room: 'bedroom', pos: [-4.70, 0.0, -3.00], yaw: 1.15, primaryHex: 0xff4f8b, accentHex: 0x5cf5ff, glitchBase: 0.68 },
  ],
};

const GLITCH_CAT_DIALOGUE: CatDialogueLine[] = [
  {
    speaker: '??? · 游荡的残影猫',
    hexTag: 'MEM_ADDR // 2018-2029_FOUNDATION',
    text: '……喵。别踩重了地毯下面——这间公寓的木地板底下，其实铺了两层一模一样的旧建筑图纸。',
  },
  {
    speaker: '??? · 游荡的残影猫',
    hexTag: 'LOG // TENANT_01 -> UNCLOSED_PORT',
    text: '在算力净化与那场旧档案失火之前，上一任住户也曾把防盗门反锁死，在地下室的灯管下焊了整整一夜的古董主板。',
  },
  {
    speaker: '??? · 游荡的残影猫',
    hexTag: 'ECHO // ITERATION_COUNT_MISMATCH',
    text: '墙纸夹层里藏着我数不清的旧抓痕。他们说屋子只重演了十四次黄昏——可每次深夜断电，门牌号都会悄悄少掉一个数字。',
  },
  {
    speaker: '??? · 游荡的残影猫',
    hexTag: 'SIGNAL_LOST // 0x00_DISCONNECTED',
    text: '它一直在等镜子里的灰尘彻底倒流。趁这轮暮色还没掉出窗框……别去拆开走廊尽头那张合影背后的封条。',
  },
];

/**
 * Builds a soft, hotspot-free gradient dome scene for PMREM environment lighting.
 * Unlike Three.js's built-in RoomEnvironment (which places 6 ultra-bright studio
 * light boxes in mid-air that appear as phantom point lights on reflective surfaces),
 * this dome provides smooth anime twilight ambient reflection with zero hotspots.
 */
function createSoftTwilightEnvScene(): THREE.Scene {
  const envScene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(12, 24, 16);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const topColor = new THREE.Color(0xfff4ea);
  const horizonColor = new THREE.Color(0xffe6d9);
  const bottomColor = new THREE.Color(0xdcbcb0);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const ny = THREE.MathUtils.clamp(pos.getY(i) / 12, -1, 1);
    if (ny >= 0) {
      tmp.lerpColors(horizonColor, topColor, Math.pow(ny, 0.60));
    } else {
      tmp.lerpColors(horizonColor, bottomColor, Math.pow(-ny, 0.65));
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
  );
  envScene.add(dome);
  return envScene;
}

export interface PcScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type SofaMenuOptionId =
  | 'play_game'
  | 'chat'
  | 'toggle_tv'
  | 'switch_channel'
  | 'snowball'
  | 'tank'
  | 'launcher'
  | 'stop_coplay'
  | 'stand_up';

export interface EngineCallbacks {
  onRoomChange: (room: { id: RoomId; label: string }) => void;
  onHoverTarget: (target: { label: string; actionLabel: string } | null) => void;
  onInteractResult: (result: InteractResult) => void;
  onPointerLockChange: (locked: boolean) => void;
  onContextLost: (lost: boolean) => void;
  onPcFocusChange?: (state: {
    active: boolean;
    settled: boolean;
    target: 'bedroom_pc' | 'basement_arcade' | null;
    rect: PcScreenRect | null;
  }) => void;
  onLivingLightChange?: (isOn: boolean) => void;
  onInventoryChange?: (snapshot: InventorySnapshot) => void;
  onToggleInventory?: () => void;
  onOpenPaperAirplaneNote?: () => void;
  onHitFeedback?: (hit: HitFeedbackPayload) => void;
  onGlitchCutsceneProgress?: (progress: number | null) => void;
  onHeroineProximityChange?: (near: boolean) => void;
  onHeroinePromptChange?: (kind: 'bed' | 'chat' | 'sofa' | null) => void;
  onHeroineTypingChange?: (typing: boolean) => void;
  onRequestStartHeroineEncounter?: () => void;
  onRequestStartRoutineChat?: (mode: 'standing' | 'sofa') => void;
  onSofaCoSitChange?: (state: {
    active: boolean;
    tvOn: boolean;
    activeOption?: SofaMenuOptionId;
  }) => void;
  onHeroineSofaTvToggled?: (isOn: boolean) => void;
  onSofaCoPlayChange?: (state: {
    phase: 'none' | 'fetching' | 'playing';
    tvScreenMode: TvConsoleScreenMode;
    selectedGame: TvGameSelectionId;
    activeOption?: SofaMenuOptionId;
  }) => void;
}

export class ApartmentEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private orbitControls: OrbitControls;
  private postRig: PostProcessingRig | null = null;
  private pmremEnv: THREE.Texture | null = null;

  private uniforms: TwilightUniforms;
  private textures: ProceduralTextures;
  private outlines: OutlineRegistry;
  private collisions: CollisionWorld;
  private ctx: RoomBuildContext;
  private audio: ProceduralAudioEngine;

  // Lights
  private ambientLight!: THREE.AmbientLight;
  private sunLight!: THREE.DirectionalLight;
  private windowSunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private windowFillLights: THREE.PointLight[] = [];
  // Constant 6-Slot GPU PointLight Pool: keeps NUM_POINT_LIGHTS fixed at 6 forever so WebGL NEVER recompiles shaders!
  private gpuLightPool: THREE.PointLight[] = [];
  private virtualPointLights: {
    light: THREE.PointLight;
    worldPos: THREE.Vector3;
    room: RoomId;
    lastSlot: number;
    score: number;
  }[] = [];
  private readonly poolTopIndices = new Int32Array(6);
  private readonly poolSlotOwner = new Int32Array(6);
  private poolAssignedFlags = new Uint8Array(64);
  private bakedLightmapRig!: BakedLightmapRig;
  private baseSunIntensity = 1.48;
  private baseWindowFillIntensity = 1.15;
  private shadowDirty = true;
  private shadowImmediate = true;
  private shadowUpdateCooldown = 0;
  private lastShadowSilhouetteVis = false;
  private mirrorFrameCounter = 0;
  private mirrorVisibleLastFrame = false;
  private lastMirrorCamPos = new THREE.Vector3(999, 999, 999);
  private lastMirrorCamYaw = 999;
  private lastMirrorCamPitch = 999;
  private lastMirrorAtmo: AtmosphereMode = 'daylight';
  private mirrorWorldBoxes = new Map<THREE.Mesh, THREE.Box3>();
  private teleportTargetRoom: RoomId | null = null;
  private dustPoints!: THREE.Points;
  private dustCount = 340;
  private dustPositions!: Float32Array;
  private dustVelocities!: Float32Array;
  private dustAnchors!: Float32Array;
  private dustSeeds!: Float32Array;
  private dustScales!: Float32Array;
  private dustAlphas!: Float32Array;
  private dustPosAttr!: THREE.BufferAttribute;
  private dustScaleAttr!: THREE.BufferAttribute;
  private dustAlphaAttr!: THREE.BufferAttribute;

  // Volumetric Atmospheric Fog / Haze Layer (soft anisotropic light-scattering mist billows)
  private volumetricFogPoints!: THREE.Points;
  private volumetricFogMat!: THREE.ShaderMaterial;
  private baseFogDensity = 0.0115;

  // Rising Warm Steam Wisps (Teapot, Coffee Table Cup & Kitchen Stockpot)
  private steamPoints!: THREE.Points;
  private steamCount = 72;
  private steamPositions!: Float32Array;
  private steamSeeds!: Float32Array;
  private steamScales!: Float32Array;
  private steamAlphas!: Float32Array;
  private steamPosAttr!: THREE.BufferAttribute;
  private steamScaleAttr!: THREE.BufferAttribute;
  private steamAlphaAttr!: THREE.BufferAttribute;

  // Mirror View Pass & Opposite-Direction 'Ghost' Dust Motes
  private mirrorRenderTarget: THREE.WebGLRenderTarget;
  private mirrorCamera: THREE.PerspectiveCamera;
  private ghostDustPoints!: THREE.Points;
  private ghostDustCount = 96;
  private ghostDustPositions!: Float32Array;
  private ghostDustVelocities!: Float32Array;
  private ghostDustAnchors!: Float32Array;
  private ghostDustSeeds!: Float32Array;
  private ghostDustScales!: Float32Array;
  private ghostDustAlphas!: Float32Array;
  private ghostDustPosAttr!: THREE.BufferAttribute;
  private ghostDustScaleAttr!: THREE.BufferAttribute;
  private ghostDustAlphaAttr!: THREE.BufferAttribute;
  private ghostDustMat!: THREE.ShaderMaterial;

  // Player & Camera state
  private playerFeetPos = new THREE.Vector3(-0.55, 0.0, -3.00);
  private prevPlayerFeetPos = new THREE.Vector3(-0.55, 0.0, -3.00);
  private playerVelXZ = new THREE.Vector2(0, 0);
  private lastFootstepPulseSign = 1;
  private yaw = -1.18;
  private pitch = -0.05;
  private targetFeetPos = new THREE.Vector3(-0.55, 0.0, -3.00);
  private targetYaw = -1.18;
  private targetPitch = -0.05;
  private isTeleporting = false;
  private headBobPhase = 0;

  // PC / Arcade Monitor Dolly Focus state
  private pcFocusState: 'none' | 'focusing' | 'focused' | 'returning' = 'none';
  private pcFocusTarget: 'none' | 'bedroom_pc' | 'basement_arcade' = 'none';
  private pcCamPos = new THREE.Vector3(-3.08, 1.092, -5.83);
  private pcCamYaw = 0;
  private pcCamPitch = 0;
  private savedStandingPos = new THREE.Vector3(-3.00, 0.0, -5.20);
  private savedStandingYaw = 0.06;
  private savedStandingPitch = -0.14;
  private pcLastRect: PcScreenRect | null = null;
  private pcCornerScratch = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  private arcadeScreenCenterScratch = new THREE.Vector3();
  private arcadeScreenNormalScratch = new THREE.Vector3();
  private arcadeStickTargetX = 0;
  private arcadeStickTargetZ = 0;

  private viewMode: ViewMode = 'first-person';
  private atmosphere: AtmosphereMode = 'daylight';
  private settings: PipelineSettings = {
    celShading: true,
    volumetricRays: true,
    inkOutlines: true,
    audioEnabled: true,
    occlusionCulling: true,
    disablePostInNormal: false,
    brightness: 1.15,
  };
  private baseExposure = 1.05;
  private baseAmbientIntensity = 0.21;
  private baseHemiIntensity = 0.58;
  private baseEnvIntensity = 0.24;

  private currentRoom: RoomId = 'living';
  private metaGlitchTimer = 0;
  private nonEuclidFovOffset = 0;
  private nonEuclidFisheye = 0;
  private nonEuclidLoopCooldown = 0;

  // Articulated Protagonist Character Rig (with 5-fingered hands) & Custom VRM Avatar Controller
  private protagonist!: ProtagonistRig;
  private vrmAvatar!: VrmAvatarController;
  private vrmStatusListeners = new Set<(status: VrmAvatarStatusSnapshot) => void>();
  private thirdPersonPreview = false;
  private readonly playerMoveDirWorld = new THREE.Vector3();
  private readonly chaseTargetScratch = new THREE.Vector3();
  private readonly doorIkWorldPosScratch = new THREE.Vector3();
  private readonly doorIkProbePosScratch = new THREE.Vector3();
  private readonly doorIkShoulderScratch = new THREE.Vector3();
  private activeDoorIk: {
    door: DoorController;
    anchor: THREE.Object3D;
    startAngle: number;
    targetAngle: number;
    phase: 'reaching' | 'following' | 'releasing';
    elapsed: number;
    weight: number;
  } | null = null;
  private manualPropIkActive = false;
  private readonly heroinePlayerEyeScratch = new THREE.Vector3();
  private floatingSubtitles!: FloatingSubtitleSystem;
  private heroineEncounterActive = false;
  private heroineNearReported = false;
  private heroinePromptKindReported: 'bed' | 'chat' | 'sofa' | null = null;
  private heroineTypingReported = false;
  private sofaSitState: 'none' | 'sitting' | 'seated' | 'standing' = 'none';
  private sofaStateElapsed = 0;
  private sofaMenuIndex = 0;
  private readonly sofaCamPos = new THREE.Vector3();
  private readonly sofaSavedStandPos = new THREE.Vector3(3.48, 0, -4.78);
  private sofaSavedStandYaw = -Math.PI / 2;
  private sofaSavedStandPitch = 0;
  private ambientMurmurTimer = 0;
  private toyGunMurmurCooldown = 0;
  private toyGunMurmurIndex = 0;
  private toyGunAimGraceTimer = 0;
  private heroineIntimacy = 55;
  private sofaIntimacyTickAccum = 0;
  private sofaMicroMurmurCooldown = 0;
  private sofaProgramSwitchMurmurIdx = 0;
  private encounterIsMainBedroom = false;
  private encounterInactivityTimer = 0;
  private readonly toyGunAimDirScratch = new THREE.Vector3();
  private readonly toyGunToHeroineScratch = new THREE.Vector3();
  private readonly toyGunChestScratch = new THREE.Vector3();
  private encounterProjectionListener:
    | ((proj: EncounterSpatialProjection) => void)
    | null = null;
  private readonly encounterHeadPosScratch = new THREE.Vector3();
  private readonly encounterAnchorScratch = new THREE.Vector3();
  private readonly encounterProjScratch = new THREE.Vector3();
  private readonly encounterCamRightScratch = new THREE.Vector3();
  private readonly encounterCamUpScratch = new THREE.Vector3();
  private readonly encounterCamFwdScratch = new THREE.Vector3();
  private glitchCutscene: {
    elapsed: number;
    duration: number;
    baseYaw: number;
    basePitch: number;
    onComplete?: () => void;
  } | null = null;
  private bedroomFloorMat: THREE.MeshStandardMaterial | null = null;
  private playerMovingThisFrame = false;
  private playerWalkSpeedThisFrame = 2.85;
  private playerActualSpeedThisFrame = 0;

  // Stray Glitch Cat state
  private glitchCat!: GlitchCatRig;
  private catState = {
    consumed: false,
    phase: 'hidden' as 'hidden' | 'fading_in' | 'active' | 'fading_out' | 'dissolving',
    timer: 1.6,
    fade: 0,
    dissolve: 1,
    currentSpotIdx: -1,
    currentRoom: 'living' as RoomId,
    primaryHex: 0xffbfa0,
    accentHex: 0xb97cff,
    glitchBase: 0.22,
    glitchBurst: 0,
    pendingModeRelocate: false,
  };

  // 4x4 Inventory, First-Person Held Viewmodels, Toy Gun Projectiles & Periodic Paper Airplane
  private inventorySlots: (InventoryItem | null)[] = Array.from({ length: 16 }, () => null);
  private selectedInventorySlot = 0;
  private equippedInventorySlot: number | null = null;
  private toyGunAmmoType: ToyGunAmmoType = 'dart';
  private paperAirplaneCaptured = false;
  private hitFeedbackCounter = 0;

  private heldItemAnchor = new THREE.Group();
  private heldToyGun!: ToyGunRig;
  private heldPaperNote!: THREE.Group;
  private protagonistGamingRig!: ProtagonistGamingArmsRig;
  private livingTvGames = new LivingTvGamesEngine();
  private coPlayState: 'none' | 'fetching' | 'handoff_reach' | 'playing' = 'none';
  private coPlayHandoffProgress = 0;
  private coPlayActionPulse = 0;
  private heldEquipAnim = 0;
  private gunRecoilKick = 0;
  private gunTriggerAnim = 0;
  private gunSwitchTilt = 0;
  private gunFireCooldown = 0;
  private camRecoilPitch = 0;
  private gunSwayX = 0;
  private gunSwayY = 0;

  private projectileGroup = new THREE.Group();
  private fxGroup = new THREE.Group();
  private projectileRaycaster = new THREE.Raycaster();
  private projectileAssets!: SharedProjectileAssets;
  private projSpawnSeq = 0;
  private dartPool: {
    rig: PooledDartRig;
    active: boolean;
    vel: THREE.Vector3;
    stuck: boolean;
    age: number;
    stuckAge: number;
    wobbleTime: number;
    wobbleAmp: number;
    baseQuat: THREE.Quaternion;
    spawnOrder: number;
  }[] = [];
  private netPool: {
    rig: CaptureNetRig;
    active: boolean;
    vel: THREE.Vector3;
    age: number;
    deployTime: number;
    deployedAudioPlayed: boolean;
    draped: boolean;
    drapeAge: number;
    spawnOrder: number;
  }[] = [];
  private sparkPool: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    active: boolean;
    vel: THREE.Vector3;
    age: number;
    maxAge: number;
  }[] = [];
  private ringPool: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    active: boolean;
    age: number;
    maxAge: number;
    baseRadius: number;
  }[] = [];

  private paperAirplaneRig!: PaperAirplaneRig;
  private paperPlaneState = {
    phase: 'cooldown' as 'cooldown' | 'flying' | 'caught',
    timer: 4.0,
    flightElapsed: 0,
    flightDuration: 38,
    seed: 0,
    spottedNotified: false,
    dodgeTimer: 0,
  };

  // Input & Raycast state
  private keys: Record<string, boolean> = {};
  private inputSuspended = false;
  private pcDynamicTexture: THREE.CanvasTexture | null = null;
  private arcadeDynamicTexture: THREE.CanvasTexture | null = null;
  private isDraggingLook = false;
  private dragMovedDist = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private isPointerLocked = false;
  private lockedOnThisPointerDown = false;
  private pointerLockSupported = true;
  private raycaster = new THREE.Raycaster();
  private doorRaycaster = new THREE.Raycaster();
  private interactRaycastTargets: THREE.Object3D[] = [];
  private raycastScratchTargets: THREE.Object3D[] = [];
  private hoveredTarget: InteractableTarget | null = null;
  private lastHoverCheck = 0;

  // Loop
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    installSoftShadowChunk();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Update shadows strictly on-demand when geometry/doors/visibility change (skips shadow pass on static frames & mirror pass!)
    this.renderer.shadowMap.autoUpdate = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1f3d);
    this.scene.fog = new THREE.FogExp2(0x3a2a54, 0.022);

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.08, 120);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const mirrorRes = this.isSoftwareGl ? 160 : 256;
    this.mirrorRenderTarget = new THREE.WebGLRenderTarget(mirrorRes, mirrorRes, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      stencilBuffer: false,
    });
    this.mirrorCamera = new THREE.PerspectiveCamera(62, width / height, 0.08, 45);

    // Soft hotspot-free twilight dome environment (eliminates phantom studio point-light reflections)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = createSoftTwilightEnvScene();
    this.pmremEnv = pmrem.fromScene(envScene, 0.08).texture;
    this.scene.environment = this.pmremEnv;
    this.scene.environmentIntensity = 0.28;
    envScene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose();
    });
    pmrem.dispose();

    // Orbit controls (active only in Overview cutaway mode)
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enabled = false;
    this.orbitControls.enableDamping = !this.isSoftwareGl;
    this.orbitControls.dampingFactor = 0.06;
    this.orbitControls.maxPolarAngle = Math.PI * 0.46;
    this.orbitControls.minDistance = 4;
    this.orbitControls.maxDistance = 30;
    this.orbitControls.target.set(0, 0.5, 0);

    // Rendering pipeline & audio
    this.uniforms = createSharedTwilightUniforms();
    this.textures = createProceduralTextures(this.renderer);
    this.outlines = new OutlineRegistry(0x4c372f, this.uniforms);
    this.outlines.setResolution(width * dpr, height * dpr);
    this.collisions = new CollisionWorld();
    this.audio = new ProceduralAudioEngine();

    this.ctx = createRoomBuildContext(
      this.scene,
      this.uniforms,
      this.textures,
      this.outlines,
      this.collisions,
      (open) => this.audio.playCabinetCreak(open)
    );
    this.ctx.sceneManager.setCullingEnabled(this.settings.occlusionCulling);

    this.setupLighting();
    this.buildScene();
    // Wire Living Room bright light switch callback so 3D wall switch plays click SFX & syncs HUD
    this.ctx.metaState.livingBrightLight.onToggleNotify = (isOn: boolean) => {
      this.audio.playLightSwitch(isOn);
      this.callbacks.onLivingLightChange?.(isOn);
    };
    // Collapse all ~18 room PointLights into a fixed 6-slot GPU PointLight pool BEFORE compiling shaders!
    this.initConstantPointLightPool();
    this.setupGlitchCat();
    this.collectRaycastTargets();
    // Locate bedroom hardwood floor material for dynamic dusk roughness & Fresnel tuning
    const bedFloorMesh = this.ctx.structureGroup.getObjectByName('floor_bedroom') as THREE.Mesh | undefined;
    if (bedFloorMesh && bedFloorMesh.material instanceof THREE.MeshStandardMaterial) {
      this.bedroomFloorMat = bedFloorMesh.material;
    }
    // Build articulated protagonist AFTER collectRaycastTargets() so hands/body never block interaction raycasting
    this.protagonist = createProtagonist(this.uniforms, this.outlines);
    this.scene.add(this.protagonist.root);

    // Build local VRM + Mixamo FBX avatar controller & automatically restore any IndexedDB-cached files
    this.vrmAvatar = new VrmAvatarController((status) => {
      this.vrmStatusListeners.forEach((listener) => listener(status));
    });
    this.scene.add(this.vrmAvatar.root);
    this.scene.add(this.vrmAvatar.heroine.root);
    this.scene.add(this.vrmAvatar.heroine.lookAtTarget);
    this.vrmAvatar.heroine.setAtmosphereMode(this.atmosphere);
    this.loadPersistedHeroineIntimacy();
    this.vrmAvatar.heroine.setIntimacy(this.heroineIntimacy);
    const bedroomSwivelChair =
      this.ctx.metaState.swivelChairs.find((c) => c.id === 'bed_swivel_chair') ?? null;
    this.vrmAvatar.heroine.setSceneHelpers(
      (sx, sz, gx, gz, fy) => findApartmentPath(this.collisions, sx, sz, gx, gz, fy, 0.26),
      bedroomSwivelChair
    );
    this.floatingSubtitles = new FloatingSubtitleSystem();
    this.scene.add(this.floatingSubtitles.group);
    void this.vrmAvatar.restoreFromIndexedDB();
    this.setupInventoryAndToySystem();
    this.setupDustMotes();
    this.setupVolumetricFog();
    this.setupSteamWisps();
    this.setupGhostDustMotes();
    this.scene.updateMatrixWorld(true);
    for (const mirror of this.ctx.mirrors) {
      mirror.material.uniforms.uMirrorTex.value = this.mirrorRenderTarget.texture;
      const box = new THREE.Box3().setFromObject(mirror.mesh).expandByScalar(0.08);
      this.mirrorWorldBoxes.set(mirror.mesh, box);
    }

    if (!this.isSoftwareGl) {
      this.postRig = createPostProcessing(
        this.renderer,
        this.scene,
        this.camera,
        width,
        height
      );
      // Refine UnrealBloomPass threshold to 0.72 to reduce window highlight overexposure
      this.postRig.unrealBloomPass.threshold = 0.72;
      this.postRig.bloomController.threshold = 0.72;
      // Apply global SSAO intensity regulator boosting ceiling seams & furniture base shadows
      this.postRig.ssaoController.applyToUniforms(this.uniforms);
      this.syncPointLightPool();
    }

    this.raycaster.layers.set(0);
    this.raycaster.layers.enable(1);
    this.raycaster.far = 4.2;

    this.applyCameraFromPlayer();
    this.bindEvents();
    this.applyAtmosphere('daylight');
    // Pre-compile ALL room shaders & upload ALL textures to VRAM up front so switching rooms NEVER stutters!
    this.prewarmGpuResources();
    this.tick();
  }

  /**
   * Eliminates first-entry room-switch stutters completely by temporarily revealing every
   * room, corridor, mirror, and dynamic entity, forcing ALL geometry VBOs & textures into
   * VRAM (with frustumCulled=false), and warming up main, mirror, shadow, and post-processing
   * WebGL pipelines once at startup.
   */
  private prewarmGpuResources(): void {
    const corr = this.ctx.metaState.nonEuclidCorridor;
    const prevCulling = this.settings.occlusionCulling;
    const prevCorrVis = corr.group?.visible ?? false;
    const prevSilVis = this.ctx.metaState.silhouetteGroup?.visible ?? false;
    const prevCatVis = this.glitchCat?.root.visible ?? false;

    // 1. Temporarily reveal every room & hidden structure so renderer never skips them!
    this.ctx.sceneManager.setCullingEnabled(false);
    this.ctx.sceneManager.updateVisibility(
      this.currentRoom,
      this.playerFeetPos,
      'overview',
      this.ctx.doors,
      this.ctx.ceilingLamps
    );
    if (corr.group) {
      corr.group.visible = true;
      for (let i = 0; i < corr.bays.length; i++) {
        corr.bays[i].group.visible = true;
      }
    }
    if (this.ctx.metaState.silhouetteGroup) {
      this.ctx.metaState.silhouetteGroup.visible = true;
    }
    if (this.glitchCat) {
      this.glitchCat.root.visible = true;
    }
    // Pre-compile pooled Toy Gun darts, capture nets, FX rings/sparks & Paper Airplane shaders up front!
    if (this.dartPool[0]) this.dartPool[0].rig.group.visible = true;
    if (this.netPool[0]) {
      this.netPool[0].rig.group.visible = true;
      this.netPool[0].rig.setDeployProgress(0.5);
    }
    if (this.sparkPool[0]) this.sparkPool[0].mesh.visible = true;
    if (this.ringPool[0]) this.ringPool[0].mesh.visible = true;
    if (this.heldToyGun) this.heldToyGun.group.visible = true;
    if (this.paperAirplaneRig) this.paperAirplaneRig.group.visible = true;
    this.protagonist?.setRenderPassMode('overview');
    this.vrmAvatar?.setRenderPassMode('overview');

    // Temporarily disable frustum culling so EVERY room's VBOs & PSOs upload to VRAM at startup!
    const savedFrustumCulled: [THREE.Object3D, boolean][] = [];
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh || (obj as THREE.Points).isPoints) {
        savedFrustumCulled.push([obj, obj.frustumCulled]);
        obj.frustumCulled = false;
      }
    });

    // 2. Eagerly upload every procedural texture & baked GI lightmap into GPU memory
    for (const val of Object.values(this.textures)) {
      if (val && (val as THREE.Texture).isTexture) {
        this.renderer.initTexture(val as THREE.Texture);
      }
    }
    if (this.bakedLightmapRig?.giTexture) {
      this.renderer.initTexture(this.bakedLightmapRig.giTexture);
    }

    // 3. Compile + execute one full GPU warmup pass across main, mirror, shadow & post-processing
    this.syncPointLightPool();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.compile(this.scene, this.mirrorCamera);
    const prevTarget = this.renderer.getRenderTarget();
    if (this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.needsUpdate = true;
    }
    // Render offscreen into mirrorRenderTarget so all VBOs & textures draw without flashing screen
    this.renderer.setRenderTarget(this.mirrorRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.render(this.scene, this.mirrorCamera);
    this.renderer.setRenderTarget(prevTarget);
    this.shadowDirty = false;
    this.shadowUpdateCooldown = 0.35;

    // Warm up EffectComposer passes (UnrealBloom + UnifiedTwilightPostShader + Fisheye) once
    if (this.postRig) {
      this.postRig.composer.render();
    }

    // 4. Restore frustum culling & normal starting visibility cleanly
    for (let i = 0; i < savedFrustumCulled.length; i++) {
      savedFrustumCulled[i][0].frustumCulled = savedFrustumCulled[i][1];
    }
    if (corr.group) corr.group.visible = prevCorrVis;
    if (this.ctx.metaState.silhouetteGroup) {
      this.ctx.metaState.silhouetteGroup.visible = prevSilVis;
    }
    if (this.glitchCat) {
      this.glitchCat.root.visible = prevCatVis;
    }
    if (this.dartPool[0]) this.dartPool[0].rig.group.visible = false;
    if (this.netPool[0]) {
      this.netPool[0].rig.group.visible = false;
      this.netPool[0].rig.setDeployProgress(0);
    }
    if (this.sparkPool[0]) this.sparkPool[0].mesh.visible = false;
    if (this.ringPool[0]) this.ringPool[0].mesh.visible = false;
    if (this.heldToyGun) this.heldToyGun.group.visible = false;
    if (this.paperAirplaneRig) this.paperAirplaneRig.group.visible = false;
    this.protagonist?.setRenderPassMode(this.thirdPersonPreview ? 'overview' : 'first-person');
    this.vrmAvatar?.setRenderPassMode(this.thirdPersonPreview ? 'third-person' : 'first-person');
    this.ctx.sceneManager.setCullingEnabled(prevCulling);
    this.ctx.sceneManager.updateVisibility(
      this.currentRoom,
      this.playerFeetPos,
      this.viewMode,
      this.ctx.doors,
      this.ctx.ceilingLamps
    );
    // Ensure the first rendered frame has fresh shadows matching the active starting rooms
    this.shadowDirty = true;
    this.shadowImmediate = true;
  }

  private setupLighting(): void {
    // High-luminance warm peach-cream ambient fill (#ffe6d9) so white upholstery renders as creamy white instead of lavender
    this.ambientLight = new THREE.AmbientLight(0xffe6d9, 0.52);
    this.scene.add(this.ambientLight);

    // Warm peach-beige to Morandi rose-taupe hemisphere fill (#ffe8dc -> #e6c8bc)
    this.hemiLight = new THREE.HemisphereLight(0xffe8dc, 0xe6c8bc, 1.15);
    this.hemiLight.position.set(12.0, 6.5, -2.5);
    this.scene.add(this.hemiLight);

    // Primary directional sunlight slanting through the East & South windows
    this.sunLight = new THREE.DirectionalLight(0xfff3d6, this.baseSunIntensity);
    this.sunLight.position.set(17.5, 8.2, -3.6);
    this.sunLight.target.position.set(2.8, 0.0, -4.8);
    this.scene.add(this.sunLight.target);
    this.sunLight.castShadow = true;
    // 1024x1024 paired with fast 4-tap rotated Vogel-disk PCF & soft radius (4.6) delivers smooth grounded shadows at 4x shadow speed
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 1.0;
    this.sunLight.shadow.camera.far = 38.0;
    this.sunLight.shadow.camera.left = -13.5;
    this.sunLight.shadow.camera.right = 13.5;
    this.sunLight.shadow.camera.top = 13.5;
    this.sunLight.shadow.camera.bottom = -13.5;
    this.sunLight.shadow.bias = -0.00042;
    this.sunLight.shadow.normalBias = 0.024;
    this.sunLight.shadow.radius = 4.6;
    this.sunLight.shadow.intensity = 0.44;
    this.scene.add(this.sunLight);

    // Secondary directional graze light kept disabled (intensity folded into primary sunLight to cut per-pixel directional cost in half!)
    this.windowSunLight = new THREE.DirectionalLight(0xfff3d6, 0.0);
    this.windowSunLight.position.set(9.2, 3.6, -4.2);
    this.windowSunLight.target.position.set(2.2, 0.0, -5.1);
    this.windowSunLight.castShadow = false;
    this.windowSunLight.visible = false;
    this.scene.add(this.windowSunLight.target);
    this.scene.add(this.windowSunLight);

    // Room-scoped window PointLight diffusers (managed by Constant 6-Slot GPU PointLight Pool)
    // Aligned millimeter-exact with each window aperture (Living East, Dining South X=-1.94, Kitchen East)
    const windowDiffSpecs: { room: RoomId; pos: [number, number, number] }[] = [
      { room: 'living', pos: [6.45, 1.88, -5.08] },
      { room: 'dining', pos: [-1.94, 1.78, 5.95] },
      { room: 'kitchen', pos: [6.55, 1.82, 4.82] },
    ];
    for (const spec of windowDiffSpecs) {
      const winDiff = new THREE.PointLight(
        0xffe8dc,
        this.baseWindowFillIntensity,
        15.0,
        1.05
      );
      winDiff.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      winDiff.castShadow = false;
      this.scene.add(winDiff);
      this.windowFillLights.push(winDiff);
    }
  }

  /**
   * Collects every PointLight across all apartment rooms into virtual light holders,
   * detaches them from the scene graph, and mounts exactly 6 permanent GPU PointLights.
   * Guarantees:
   * - ZERO WebGL shader recompilations ever (eliminates occlusion-culling frame freezes!)
   * - 67% lower per-pixel PointLight fragment cost at full native resolution!
   */
  private initConstantPointLightPool(): void {
    this.scene.updateMatrixWorld(true);
    const collected: THREE.PointLight[] = [];
    this.scene.traverse((obj) => {
      if ((obj as THREE.PointLight).isPointLight) {
        collected.push(obj as THREE.PointLight);
      }
    });

    this.virtualPointLights = [];
    for (const light of collected) {
      const worldPos = new THREE.Vector3();
      light.getWorldPosition(worldPos);
      const room = getRoomAt(worldPos.x, worldPos.y, worldPos.z).id;
      if (light.parent) {
        light.parent.remove(light);
      }
      light.visible = true;
      this.virtualPointLights.push({
        light,
        worldPos,
        room,
        lastSlot: -1,
        score: -1e9,
      });
    }

    if (this.virtualPointLights.length > this.poolAssignedFlags.length) {
      this.poolAssignedFlags = new Uint8Array(this.virtualPointLights.length);
    }

    // Create 6 permanent GPU PointLights that stay visible = true in this.scene forever
    this.gpuLightPool = [];
    for (let i = 0; i < 6; i++) {
      const slotLight = new THREE.PointLight(0xffe8dc, 0, 12.0, 1.2);
      slotLight.castShadow = false;
      slotLight.visible = true;
      slotLight.name = `gpu_point_light_slot_${i}`;
      this.scene.add(slotLight);
      this.gpuLightPool.push(slotLight);
    }
  }

  /**
   * Zero-GC per-frame assignment of the 6 highest-priority active virtual lights
   * (current room -> visible rooms -> nearest brightest) into the 6 permanent GPU slots,
   * preserving slot affinity to avoid light popping.
   */
  private syncPointLightPool(): void {
    const vLights = this.virtualPointLights;
    const n = vLights.length;
    const slotCount = this.gpuLightPool.length;
    if (n === 0 || slotCount === 0) return;

    const focusX =
      this.viewMode === 'overview' ? this.orbitControls.target.x : this.camera.position.x;
    const focusY =
      this.viewMode === 'overview' ? this.orbitControls.target.y : this.camera.position.y;
    const focusZ =
      this.viewMode === 'overview' ? this.orbitControls.target.z : this.camera.position.z;
    const isFirstPerson = this.viewMode === 'first-person';

    // 1. Score every virtual PointLight
    const livingBrightRig = this.ctx.metaState.livingBrightLight;
    const livingBrightActive = livingBrightRig.isOn;
    for (let i = 0; i < n; i++) {
      const v = vLights[i];
      const intensity = v.light.intensity;
      if (!v.light.visible || intensity <= 0.002) {
        v.score = -1e9;
        continue;
      }
      const dx = v.worldPos.x - focusX;
      const dy = v.worldPos.y - focusY;
      const dz = v.worldPos.z - focusZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      let score = intensity * 11.0 - dist * 3.6;
      if (isFirstPerson) {
        if (v.room === this.currentRoom) {
          score += 120.0;
        } else if (this.ctx.sceneManager.isRoomVisible(v.room)) {
          score += 34.0;
        } else {
          score -= 65.0;
        }
      }
      // Guarantee GPU light slots for the Living Room modern chandelier rig when switched ON
      if (
        livingBrightActive &&
        v.room === 'living' &&
        livingBrightRig.lights.includes(v.light)
      ) {
        score += this.currentRoom === 'living' || !isFirstPerson ? 72.0 : 28.0;
      }
      // Gentle hysteresis prevents tie-breaking flicker between adjacent rooms
      if (v.lastSlot >= 0) {
        score += 3.5;
      }
      v.score = score;
    }

    // 2. Pick top `slotCount` active lights without allocating arrays
    this.poolAssignedFlags.fill(0, 0, n);
    let selectedCount = 0;
    for (let k = 0; k < slotCount; k++) {
      let bestIdx = -1;
      let bestScore = -1e8;
      for (let i = 0; i < n; i++) {
        if (this.poolAssignedFlags[i] === 0 && vLights[i].score > bestScore) {
          bestScore = vLights[i].score;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      this.poolAssignedFlags[bestIdx] = 1;
      this.poolTopIndices[selectedCount++] = bestIdx;
    }

    // 3. Preserve existing slot affinity first
    this.poolSlotOwner.fill(-1);
    for (let k = 0; k < selectedCount; k++) {
      const idx = this.poolTopIndices[k];
      const prevSlot = vLights[idx].lastSlot;
      if (prevSlot >= 0 && prevSlot < slotCount && this.poolSlotOwner[prevSlot] === -1) {
        this.poolSlotOwner[prevSlot] = idx;
      }
    }

    // 4. Fill remaining free GPU slots with newly promoted virtual lights
    for (let k = 0; k < selectedCount; k++) {
      const idx = this.poolTopIndices[k];
      const prevSlot = vLights[idx].lastSlot;
      if (prevSlot >= 0 && prevSlot < slotCount && this.poolSlotOwner[prevSlot] === idx) {
        continue;
      }
      for (let s = 0; s < slotCount; s++) {
        if (this.poolSlotOwner[s] === -1) {
          this.poolSlotOwner[s] = idx;
          break;
        }
      }
    }

    // 5. Update lastSlot bookkeeping and copy light parameters to the permanent GPU pool
    for (let i = 0; i < n; i++) {
      vLights[i].lastSlot = -1;
    }
    for (let s = 0; s < slotCount; s++) {
      const ownerIdx = this.poolSlotOwner[s];
      const gpuLight = this.gpuLightPool[s];
      if (ownerIdx >= 0) {
        const v = vLights[ownerIdx];
        v.lastSlot = s;
        gpuLight.position.copy(v.worldPos);
        gpuLight.color.copy(v.light.color);
        gpuLight.intensity = v.light.intensity;
        gpuLight.distance = v.light.distance;
        gpuLight.decay = v.light.decay;
      } else {
        gpuLight.intensity = 0;
      }
    }
  }

  private collectRaycastTargets(): void {
    const interactTargets: THREE.Object3D[] = [];

    const getInteractAncestor = (obj: THREE.Object3D): string | null => {
      let curr: THREE.Object3D | null = obj;
      while (curr) {
        if (curr.userData?.interactId) {
          return curr.userData.interactId as string;
        }
        curr = curr.parent;
      }
      return null;
    };

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (obj.name.endsWith('_outline') || obj.name.includes('_outlines')) return;

      const interactId = getInteractAncestor(obj);
      if (interactId && obj.layers.isEnabled(1)) {
        interactTargets.push(obj);
      }
    });

    this.interactRaycastTargets = interactTargets;
  }

  private buildScene(): void {
    const playDoor = (open: boolean) => this.audio.playDoor(open);
    buildApartmentStructure(this.ctx);
    buildLivingRoom(this.ctx, playDoor, {
      onCycleTurntable: () => this.audio.cycleVinylTurntable(),
      onNextTrack: () => this.audio.nextVinylTrack(),
      onTogglePlay: () => this.audio.toggleVinylPlayback(),
    });
    buildBathroom(this.ctx, playDoor);
    buildEntryway(this.ctx, playDoor);
    buildNonEuclidCorridor(this.ctx, playDoor);
    buildDiningAndKitchen(this.ctx);
    buildBedroom(this.ctx, playDoor);
    buildBasement(this.ctx, playDoor);

    // Bake indoor Global Illumination lightmap & place soft floor contact shadows
    this.uniforms.uBakedGiMap.value?.dispose();
    this.bakedLightmapRig = buildApartmentContactShadows(this.ctx, this.renderer);
    this.uniforms.uBakedGiMap.value = this.bakedLightmapRig.giTexture;

    // Freeze static world matrices on merged architectural meshes to eliminate per-frame matrix recomputation
    this.ctx.structureGroup.updateMatrixWorld(true);
    this.ctx.ceilingGroup.updateMatrixWorld(true);
    for (const name of [
      'ApartmentStructureMergedMesh',
      'ApartmentStructureMergedMesh_NoCast',
      'ApartmentCeilingMergedMesh',
      'ApartmentCeilingMergedMesh_NoCast',
    ]) {
      const staticMesh = this.scene.getObjectByName(name);
      if (staticMesh) {
        staticMesh.matrixAutoUpdate = false;
        staticMesh.updateMatrix();
      }
    }

    // Initial manual room occlusion culling pass based on starting room
    this.ctx.sceneManager.updateVisibility(
      this.currentRoom,
      this.playerFeetPos,
      this.viewMode,
      this.ctx.doors,
      this.ctx.ceilingLamps
    );
  }

  private setupGlitchCat(): void {
    this.glitchCat = createGlitchCat(this.scene);
    this.ctx.interactables.push({
      id: 'stray_glitch_cat',
      label: '半透明残影猫',
      actionLabel: '轻声呼唤',
      room: 'living',
      mesh: this.glitchCat.root,
      onInteract: () => {
        if (
          this.catState.consumed ||
          this.catState.phase === 'hidden' ||
          this.catState.phase === 'dissolving'
        ) {
          return;
        }
        this.catState.consumed = true;
        this.catState.phase = 'dissolving';
        this.catState.glitchBurst = 1.25;
        this.glitchCat.hitBox.layers.disable(1);
        if (this.hoveredTarget?.id === 'stray_glitch_cat') {
          this.hoveredTarget = null;
          this.callbacks.onHoverTarget(null);
        }
        this.audio.playGlitchCatMeow();
        this.metaGlitchTimer = Math.max(this.metaGlitchTimer, 0.72);
        return {
          title: '游荡的残影猫',
          message: '半透明的猫影在你的指尖前发出带噪点的轻叫，随后化作散落的scanline微光。',
          metaTrigger: true,
          catDialogue: GLITCH_CAT_DIALOGUE,
        };
      },
    });
  }

  public resetGlitchCat(): void {
    this.catState.consumed = false;
    this.catState.phase = 'hidden';
    this.catState.timer = 1.5;
    this.catState.fade = 0;
    this.catState.dissolve = 1;
    this.catState.currentSpotIdx = -1;
    this.catState.glitchBurst = 0;
    this.catState.pendingModeRelocate = false;
    this.glitchCat.root.visible = false;
    this.glitchCat.hitBox.layers.set(1);
  }

  private pickNextCatSpot(mode: AtmosphereMode): void {
    const spots = GLITCH_CAT_SPOTS[mode];
    if (!spots || spots.length === 0) return;

    let nextIdx = Math.floor(Math.random() * spots.length);
    if (spots.length > 1 && nextIdx === this.catState.currentSpotIdx) {
      nextIdx = (nextIdx + 1) % spots.length;
    }
    const spot = spots[nextIdx];
    this.catState.currentSpotIdx = nextIdx;
    this.catState.currentRoom = spot.room;
    this.catState.primaryHex = spot.primaryHex;
    this.catState.accentHex = spot.accentHex;
    this.catState.glitchBase = spot.glitchBase;

    this.glitchCat.root.position.set(spot.pos[0], spot.pos[1], spot.pos[2]);
    this.glitchCat.root.rotation.y = spot.yaw;

    const target = this.ctx.interactables.find((i) => i.id === 'stray_glitch_cat');
    if (target) target.room = spot.room;
  }

  private updateGlitchCat(dt: number, elapsed: number): void {
    const st = this.catState;
    if (st.glitchBurst > 0) {
      st.glitchBurst = Math.max(0, st.glitchBurst - dt * 1.15);
    }

    if (st.phase === 'hidden') {
      this.glitchCat.root.visible = false;
      if (st.consumed) return;
      st.timer -= dt;
      if (st.timer <= 0) {
        this.pickNextCatSpot(this.atmosphere);
        st.phase = 'fading_in';
        st.fade = 0.02;
        st.dissolve = 0.85;
        st.glitchBurst = Math.max(st.glitchBurst, 0.85);
        const dist = this.glitchCat.root.position.distanceTo(this.playerFeetPos);
        if (dist < 10.0) {
          this.audio.playCatPhaseBlip();
        }
      }
      return;
    }

    if (st.phase === 'fading_in') {
      st.fade = Math.min(1.0, st.fade + dt * 1.45);
      st.dissolve = Math.max(0.0, st.dissolve - dt * 1.25);
      if (st.fade >= 1.0 && st.dissolve <= 0.0) {
        st.phase = 'active';
        st.timer = 18.0 + Math.random() * 10.0;
      }
    } else if (st.phase === 'active') {
      st.timer -= dt;
      if (Math.random() < dt * (this.atmosphere === 'meta' ? 0.55 : 0.22)) {
        st.glitchBurst = Math.max(st.glitchBurst, 0.55 + Math.random() * 0.45);
      }
      if (st.timer <= 0) {
        st.phase = 'fading_out';
        st.glitchBurst = Math.max(st.glitchBurst, 0.75);
      }
    } else if (st.phase === 'fading_out') {
      st.fade = Math.max(0.0, st.fade - dt * 1.35);
      st.dissolve = Math.min(0.95, st.dissolve + dt * 1.15);
      if (st.fade <= 0.01) {
        st.phase = 'hidden';
        st.timer = st.pendingModeRelocate ? 0.35 : 5.0 + Math.random() * 5.0;
        st.pendingModeRelocate = false;
        this.glitchCat.root.visible = false;
        return;
      }
    } else if (st.phase === 'dissolving') {
      st.fade = Math.max(0.0, st.fade - dt * 0.78);
      st.dissolve = Math.min(1.0, st.dissolve + dt * 0.85);
      st.glitchBurst = Math.max(st.glitchBurst, 0.9);
      if (st.fade <= 0.01) {
        st.phase = 'hidden';
        this.glitchCat.root.visible = false;
        return;
      }
    }

    const roomVisible =
      this.viewMode === 'overview' ||
      !this.settings.occlusionCulling ||
      this.ctx.sceneManager.isRoomVisible(st.currentRoom);
    this.glitchCat.root.visible = roomVisible && st.fade > 0.01;

    if (this.glitchCat.root.visible) {
      this.glitchCat.update(
        elapsed,
        st.fade,
        st.dissolve,
        st.glitchBase + st.glitchBurst,
        st.primaryHex,
        st.accentHex
      );
    }
  }

  private setupDustMotes(): void {
    const count = this.dustCount;
    this.dustPositions = new Float32Array(count * 3);
    this.dustVelocities = new Float32Array(count * 3);
    this.dustAnchors = new Float32Array(count * 3);
    this.dustSeeds = new Float32Array(count * 4);
    this.dustScales = new Float32Array(count);
    this.dustAlphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let z = 0;
      let beamId = 0;

      if (i < 96) {
        // 96 microscopic dust specks suspended inside the two Living Room East anisotropic shafts
        const isSecondWindow = i >= 48;
        const wz = isSecondWindow ? -2.96 : -7.20;
        beamId = isSecondWindow ? 2 : 1;

        const u = 0.06 + Math.pow(Math.random(), 0.76) * 0.90;
        const v = 0.06 + Math.random() * 0.88;

        x = 7.22 - 3.35 * (1.0 - u);
        const yBot = THREE.MathUtils.lerp(0.18, 0.90, u);
        const yTop = THREE.MathUtils.lerp(1.48, 2.66, u);
        y = THREE.MathUtils.lerp(yBot, yTop, v);
        z = wz + (1.0 - u) * -0.22 + (Math.random() - 0.5) * 1.28;
      } else if (i < 162) {
        // 66 microscopic dust specks suspended inside the Bedroom North Window anisotropic shaft
        beamId = 6;
        const u = 0.06 + Math.pow(Math.random(), 0.76) * 0.90;
        const v = 0.06 + Math.random() * 0.88;
        z = -6.62 + 2.95 * (1.0 - u);
        const yBot = THREE.MathUtils.lerp(0.18, 0.92, u);
        const yTop = THREE.MathUtils.lerp(1.40, 2.28, u);
        y = THREE.MathUtils.lerp(yBot, yTop, v);
        x = -4.65 + (1.0 - u) * 0.12 + (Math.random() - 0.5) * 1.65;
      } else if (i < 204) {
        // 42 microscopic motes aligned with Dining South window (X = -1.94)
        beamId = 5;
        const u = 0.06 + Math.pow(Math.random(), 0.78) * 0.88;
        const v = 0.08 + Math.random() * 0.84;
        z = 6.54 - 2.50 * (1.0 - u);
        y = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(0.24, 1.18, u),
          THREE.MathUtils.lerp(1.30, 2.38, u),
          v
        );
        x = -1.94 + (1.0 - u) * 0.06 + (Math.random() - 0.5) * 0.88;
      } else if (i < 236) {
        // 32 microscopic motes inside Kitchen East window shaft
        beamId = 5;
        const u = 0.08 + Math.random() * 0.86;
        const v = 0.08 + Math.random() * 0.84;
        x = 7.20 - 2.20 * (1.0 - u);
        y = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(0.42, 1.34, u),
          THREE.MathUtils.lerp(1.34, 2.18, u),
          v
        );
        z = 4.82 + (1.0 - u) * -0.10 + (Math.random() - 0.5) * 0.74;
      } else if (i < 264) {
        // 28 microscopic motes floating in the Bathroom high frosted vent window shaft
        beamId = 7;
        const u = 0.08 + Math.random() * 0.86;
        const v = 0.08 + Math.random() * 0.84;
        z = -13.98 + 1.90 * (1.0 - u);
        y = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(1.15, 2.04, u),
          THREE.MathUtils.lerp(1.98, 2.48, u),
          v
        );
        x = 5.15 + (Math.random() - 0.5) * 0.86;
      } else if (i < 292) {
        // 28 fine ambient motes drifting along the smooth Non-Euclidean Corridor
        beamId = 8;
        x = -8.4 - Math.random() * 14.5;
        y = 0.25 + Math.random() * 2.40;
        z = 3.72 + Math.random() * 1.76;
      } else {
        // 48 delicate ambient floating dust motes drifting softly through apartment interiors
        beamId = i < 318 ? 4 : 3;
        if (beamId === 4) {
          x = 0.0 + Math.random() * 6.8;
          y = 0.35 + Math.random() * 2.20;
          z = -9.6 + Math.random() * 9.0;
        } else {
          x = -7.0 + Math.random() * 5.2;
          y = 0.30 + Math.random() * 2.15;
          z = -5.8 + Math.random() * 11.6;
        }
      }

      const i3 = i * 3;
      this.dustPositions[i3] = x;
      this.dustPositions[i3 + 1] = y;
      this.dustPositions[i3 + 2] = z;

      this.dustAnchors[i3] = x;
      this.dustAnchors[i3 + 1] = y;
      this.dustAnchors[i3 + 2] = z;

      // Very gentle air drift (~0.02 to 0.06 m/s)
      this.dustVelocities[i3] = (Math.random() - 0.5) * 0.042;
      this.dustVelocities[i3 + 1] = 0.008 + (Math.random() - 0.5) * 0.032;
      this.dustVelocities[i3 + 2] = (Math.random() - 0.5) * 0.042;

      const i4 = i * 4;
      this.dustSeeds[i4] = Math.random() * Math.PI * 2;
      this.dustSeeds[i4 + 1] = 1.0 + Math.random() * 2.1;
      this.dustSeeds[i4 + 2] = 0.55 + Math.random() * 0.58;
      this.dustSeeds[i4 + 3] = beamId;

      this.dustScales[i] = this.dustSeeds[i4 + 2];
      this.dustAlphas[i] = beamId <= 2 || beamId >= 5 ? 0.52 : 0.28;
    }

    const geo = new THREE.BufferGeometry();
    this.dustPosAttr = new THREE.BufferAttribute(this.dustPositions, 3);
    this.dustPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.dustScaleAttr = new THREE.BufferAttribute(this.dustScales, 1);
    this.dustScaleAttr.setUsage(THREE.DynamicDrawUsage);
    this.dustAlphaAttr = new THREE.BufferAttribute(this.dustAlphas, 1);
    this.dustAlphaAttr.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute('position', this.dustPosAttr);
    geo.setAttribute('aScale', this.dustScaleAttr);
    geo.setAttribute('aAlpha', this.dustAlphaAttr);

    const pixelRatio = this.renderer.getPixelRatio();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uShaftColor: this.uniforms.uShaftColor,
        uNightFactor: this.uniforms.uNightFactor,
        uWindowLightDir: this.uniforms.uWindowLightDir,
        uAnisotropy: this.uniforms.uAnisotropy,
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: `
        attribute float aScale;
        attribute float aAlpha;
        uniform float uPixelRatio;
        uniform vec3 uWindowLightDir;
        uniform float uAnisotropy;
        varying float vAlpha;
        varying float vAnisoBoost;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;
          float dist = max(0.55, -mvPosition.z);
          // Crisp, fine airborne dust motes (1.8..5.4 px) — delicate luminous specks, never blurry blobs!
          gl_PointSize = clamp(aScale * uPixelRatio * (11.2 / dist), 1.8, 5.4);
          float nearLensFade = smoothstep(0.24, 0.78, -mvPosition.z);
          float farFade = 1.0 - smoothstep(7.5, 14.0, -mvPosition.z);
          // Henyey-Greenstein forward-scattering gleam when viewing particles toward window light
          vec3 viewDir = normalize(worldPos.xyz - cameraPosition);
          vec3 lightTravel = normalize(-uWindowLightDir);
          float cosTheta = clamp(dot(viewDir, lightTravel), -1.0, 1.0);
          float g = clamp(uAnisotropy * 0.72, 0.15, 0.72);
          float hg = (1.0 - g * g) / pow(max(0.18, 1.0 + g * g - 2.0 * g * cosTheta), 1.5);
          vAnisoBoost = clamp(0.88 + hg * 0.42, 0.85, 1.85);
          vAlpha = aAlpha * nearLensFade * farFade;
        }
      `,
      fragmentShader: `
        uniform vec3 uShaftColor;
        uniform float uNightFactor;
        varying float vAlpha;
        varying float vAnisoBoost;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r2 = dot(c, c);
          if (r2 > 0.25 || vAlpha < 0.008) discard;
          // Crisp glowing dust pinpoint core + soft translucent halo
          float core = exp(-r2 * 15.0);
          float halo = smoothstep(0.25, 0.02, r2) * 0.42;
          float shape = clamp(core + halo, 0.0, 1.0);
          vec3 dayTint = mix(uShaftColor, vec3(1.0, 0.98, 0.94), 0.65);
          vec3 moteColor = mix(dayTint, vec3(0.78, 0.90, 1.0), uNightFactor * 0.72);
          gl_FragColor = vec4(moteColor * vAnisoBoost, shape * vAlpha * 0.86);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.dustPoints = new THREE.Points(geo, mat);
    this.dustPoints.frustumCulled = false;
    this.dustPoints.renderOrder = 6;
    this.scene.add(this.dustPoints);
  }

  /**
   * Creates a lightweight 3D Volumetric Atmospheric Fog / Haze layer composed of
   * soft drifting anisotropic light-scattering mist billows across sunlit/moonlit
   * rooms and down the Non-Euclidean Corridor to elevate spatial depth and texture.
   */
  private setupVolumetricFog(): void {
    const spots: [number, number, number, number, number][] = [
      // Living Room East window mist pools & center air depth (x, y, z, size, density)
      [5.4, 1.35, -7.1, 4.6, 0.85],
      [4.2, 1.25, -5.2, 5.2, 0.72],
      [5.4, 1.35, -3.0, 4.6, 0.85],
      [2.0, 1.45, -7.6, 5.8, 0.62],
      [1.8, 1.35, -3.2, 5.6, 0.62],
      [3.4, 1.55, -8.8, 5.0, 0.58],
      // Bedroom North window moonlit/sunlit mist & cozy room haze
      [-4.6, 1.25, -5.1, 4.4, 0.88],
      [-4.5, 1.35, -2.6, 5.0, 0.66],
      [-2.8, 1.40, -4.4, 4.6, 0.60],
      // Dining & Kitchen warm air haze
      [-1.9, 1.35, 5.2, 4.2, 0.82],
      [1.4, 1.40, 3.6, 5.2, 0.62],
      [5.5, 1.40, 4.6, 4.0, 0.78],
      // Entryway calm genkan haze
      [-5.6, 1.35, 4.6, 4.4, 0.68],
      // Bathroom soft warm steamy mist
      [5.15, 1.65, -12.6, 3.8, 0.82],
      [4.2, 1.30, -11.6, 3.6, 0.66],
      // Non-Euclidean Smooth Corridor drifting liminal mist layers
      [-10.2, 1.35, 4.6, 3.6, 0.85],
      [-13.0, 1.40, 4.6, 3.8, 0.92],
      [-16.0, 1.35, 4.6, 4.0, 0.96],
      [-19.5, 1.40, 4.6, 4.2, 1.00],
      [-23.5, 1.40, 4.6, 4.4, 1.00],
    ];

    const count = spots.length;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const densities = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = spots[i][0];
      positions[i * 3 + 1] = spots[i][1];
      positions[i * 3 + 2] = spots[i][2];
      sizes[i] = spots[i][3];
      densities[i] = spots[i][4];
      phases[i] = i * 1.37;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aDensity', new THREE.BufferAttribute(densities, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const pixelRatio = this.renderer.getPixelRatio();
    this.volumetricFogMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.uniforms.uTime,
        uFogColor: { value: new THREE.Color(0xfff0e4) },
        uShaftColor: this.uniforms.uShaftColor,
        uWindowLightDir: this.uniforms.uWindowLightDir,
        uAnisotropy: this.uniforms.uAnisotropy,
        uNightFactor: this.uniforms.uNightFactor,
        uFogOpacity: { value: 0.052 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aDensity;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform vec3 uWindowLightDir;
        uniform float uAnisotropy;
        varying float vAlpha;
        varying float vPhase;
        varying float vScatter;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.14 + aPhase) * 0.24;
          p.y += cos(uTime * 0.11 + aPhase * 1.3) * 0.12;
          p.z += cos(uTime * 0.13 + aPhase * 0.8) * 0.22;

          vec4 worldPos = modelMatrix * vec4(p, 1.0);
          vec4 mvPosition = viewMatrix * worldPos;
          gl_Position = projectionMatrix * mvPosition;

          float dist = max(1.0, -mvPosition.z);
          gl_PointSize = clamp(aSize * uPixelRatio * (185.0 / dist), 32.0, 420.0);

          // Soft camera proximity fade so walking through fog never causes clipping pops
          float nearFade = smoothstep(1.35, 3.6, -mvPosition.z);
          float farFade = 1.0 - smoothstep(16.0, 28.0, -mvPosition.z);

          // Anisotropic Henyey-Greenstein forward scattering when facing window light
          vec3 viewDir = normalize(worldPos.xyz - cameraPosition);
          vec3 lightTravel = normalize(-uWindowLightDir);
          float cosTheta = clamp(dot(viewDir, lightTravel), -1.0, 1.0);
          float g = clamp(uAnisotropy * 0.65, 0.12, 0.65);
          float hg = (1.0 - g * g) / pow(max(0.24, 1.0 + g * g - 2.0 * g * cosTheta), 1.5);
          vScatter = clamp(0.65 + hg * 0.32, 0.62, 1.48);

          vAlpha = aDensity * nearFade * farFade;
          vPhase = aPhase;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uFogColor;
        uniform vec3 uShaftColor;
        uniform float uNightFactor;
        uniform float uFogOpacity;
        varying float vAlpha;
        varying float vPhase;
        varying float vScatter;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash21(i);
          float b = hash21(i + vec2(1.0, 0.0));
          float c = hash21(i + vec2(0.0, 1.0));
          float d = hash21(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float r = length(uv) * 2.0;
          if (r > 1.0 || vAlpha < 0.004) discard;

          // Ultra-soft radial Gaussian cloud envelope modulated by drifting organic mist noise
          float radial = pow(max(0.0, 1.0 - r * r), 2.35);
          vec2 nUv = uv * 2.8 + vec2(vPhase * 0.7 + uTime * 0.035, vPhase * 0.4 - uTime * 0.025);
          float fbm = 0.65 * vnoise(nUv) + 0.35 * vnoise(nUv * 2.1 + 3.7);
          float mist = radial * (0.58 + 0.42 * fbm);

          vec3 litMist = mix(uFogColor, uShaftColor, 0.36) * vScatter;
          litMist = mix(litMist, vec3(0.42, 0.48, 0.82) * vScatter, uNightFactor * 0.55);

          float alpha = mist * vAlpha * uFogOpacity;
          if (alpha < 0.001) discard;
          gl_FragColor = vec4(litMist, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.volumetricFogPoints = new THREE.Points(geo, this.volumetricFogMat);
    this.volumetricFogPoints.frustumCulled = false;
    this.volumetricFogPoints.renderOrder = 3;
    this.scene.add(this.volumetricFogPoints);
  }

  /**
   * Simulates delicate 3D Brownian drift + soft convection eddies for microscopic
   * dust motes, boosting their translucent diffuse gleam where they intersect
   * the shortened anisotropic window light shafts.
   */
  private updateDustMotes(dt: number, elapsed: number): void {
    if (!this.dustPoints.visible) return;

    const count = this.dustCount;
    const pos = this.dustPositions;
    const vel = this.dustVelocities;
    const anc = this.dustAnchors;
    const seeds = this.dustSeeds;
    const scales = this.dustScales;
    const alphas = this.dustAlphas;

    const sqrtDt = Math.sqrt(dt);
    const brownianSigma = 0.16;
    const drag = Math.exp(-1.55 * dt);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;

      let px = pos[i3];
      let py = pos[i3 + 1];
      let pz = pos[i3 + 2];

      let vx = vel[i3];
      let vy = vel[i3 + 1];
      let vz = vel[i3 + 2];

      const phase = seeds[i4];
      const twinkleFreq = seeds[i4 + 1];
      const baseSize = seeds[i4 + 2];
      const beamId = seeds[i4 + 3];

      // 1. Slow 3D curl-like indoor convection currents
      const flowX =
        Math.sin(elapsed * 0.52 + py * 1.9 + phase) * 0.062 +
        Math.cos(elapsed * 0.98 - pz * 2.1 + phase * 0.7) * 0.028;
      const flowY =
        Math.cos(elapsed * 0.48 + px * 1.6 - phase) * 0.050 +
        Math.sin(elapsed * 1.06 + pz * 1.9 + phase) * 0.025 +
        0.012;
      const flowZ =
        Math.sin(elapsed * 0.58 + px * 1.5 + py * 1.7 + phase) * 0.062 +
        Math.cos(elapsed * 0.92 + py * 2.3 - phase * 1.3) * 0.030;

      // 2. Gentle Brownian thermal kicks
      vx = vx * drag + flowX * (1.0 - drag) + (Math.random() - 0.5) * brownianSigma * sqrtDt;
      vy = vy * drag + flowY * (1.0 - drag) + (Math.random() - 0.5) * brownianSigma * sqrtDt;
      vz = vz * drag + flowZ * (1.0 - drag) + (Math.random() - 0.5) * brownianSigma * sqrtDt;

      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;

      // 3. Soft boundary wrapping around each speck's home anchor
      const dxAnc = px - anc[i3];
      const dyAnc = py - anc[i3 + 1];
      const dzAnc = pz - anc[i3 + 2];
      if (dxAnc > 0.75) px -= 1.50;
      else if (dxAnc < -0.75) px += 1.50;
      if (dyAnc > 0.62 || py > 2.74) py = Math.max(0.16, anc[i3 + 1] - 0.56);
      else if (dyAnc < -0.62 || py < 0.12) py = Math.min(2.68, anc[i3 + 1] + 0.56);
      if (dzAnc > 0.75) pz -= 1.50;
      else if (dzAnc < -0.75) pz += 1.50;

      pos[i3] = px;
      pos[i3 + 1] = py;
      pos[i3 + 2] = pz;
      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;

      // 4. Evaluate smooth exponential-attenuation Tyndall intersection across all 5 window shafts
      const uLiv = THREE.MathUtils.clamp((px - 3.92) / 3.35, 0.0, 1.0);
      const yBotL = 0.16 + uLiv * 0.72;
      const yTopL = 1.48 + uLiv * 1.24;
      const inYL =
        THREE.MathUtils.smoothstep(py, yBotL, yBotL + 0.28) *
        (1.0 - THREE.MathUtils.smoothstep(py, yTopL - 0.28, yTopL));
      const solarShiftZ = (1.0 - uLiv) * -0.22;
      const minDzL = Math.min(
        Math.abs(pz - (-7.20 + solarShiftZ)),
        Math.abs(pz - (-2.96 + solarShiftZ))
      );
      const livIllum =
        THREE.MathUtils.smoothstep(px, 3.85, 4.55) *
        (1.0 - THREE.MathUtils.smoothstep(px, 7.10, 7.32)) *
        inYL *
        (1.0 - THREE.MathUtils.smoothstep(minDzL, 0.48, 0.94)) *
        Math.exp(-(1.0 - uLiv) * 1.65);

      const uBed = THREE.MathUtils.clamp((-3.70 - pz) / 2.95, 0.0, 1.0);
      const bedIllum =
        THREE.MathUtils.smoothstep(pz, -6.68, -6.30) *
        (1.0 - THREE.MathUtils.smoothstep(pz, -4.35, -3.65)) *
        (1.0 - THREE.MathUtils.smoothstep(Math.abs(px - (-4.65 + (1.0 - uBed) * 0.12)), 0.68, 1.12)) *
        THREE.MathUtils.smoothstep(py, 0.16, 0.52) *
        (1.0 - THREE.MathUtils.smoothstep(py, 1.96, 2.36)) *
        Math.exp(-(1.0 - uBed) * 1.75);

      const uDin = THREE.MathUtils.clamp((pz - 4.05) / 2.50, 0.0, 1.0);
      const dinIllum =
        THREE.MathUtils.smoothstep(pz, 4.02, 4.65) *
        (1.0 - THREE.MathUtils.smoothstep(pz, 6.42, 6.62)) *
        (1.0 - THREE.MathUtils.smoothstep(Math.abs(px - (-1.94 + (1.0 - uDin) * 0.06)), 0.36, 0.78)) *
        Math.exp(-(1.0 - uDin) * 1.85);

      const uKit = THREE.MathUtils.clamp((px - 5.02) / 2.20, 0.0, 1.0);
      const kitIllum =
        THREE.MathUtils.smoothstep(px, 4.98, 5.58) *
        (1.0 - THREE.MathUtils.smoothstep(px, 7.05, 7.28)) *
        (1.0 - THREE.MathUtils.smoothstep(Math.abs(pz - 4.82), 0.32, 0.70)) *
        Math.exp(-(1.0 - uKit) * 1.85);

      const uBath = THREE.MathUtils.clamp((-12.08 - pz) / 1.90, 0.0, 1.0);
      const bathIllum =
        THREE.MathUtils.smoothstep(pz, -14.02, -13.65) *
        (1.0 - THREE.MathUtils.smoothstep(pz, -12.55, -12.02)) *
        (1.0 - THREE.MathUtils.smoothstep(Math.abs(px - 5.15), 0.32, 0.72)) *
        THREE.MathUtils.smoothstep(py, 1.08, 1.48) *
        Math.exp(-(1.0 - uBath) * 1.85);

      const shaftIllum = Math.max(livIllum, bedIllum, dinIllum, kitIllum, bathIllum);

      const glint =
        0.58 +
        0.42 *
          Math.sin(elapsed * twinkleFreq + phase + (px + py + pz) * 4.8);

      const zoneBase = beamId === 8 ? 0.34 : beamId <= 2 || beamId >= 5 ? 0.28 : 0.20;
      const baseAlpha = Math.min(0.95, zoneBase + shaftIllum * 0.66);
      alphas[i] = baseAlpha * glint;
      scales[i] = baseSize * (0.86 + 0.32 * shaftIllum * glint);
    }

    this.dustPosAttr.needsUpdate = true;
    this.dustAlphaAttr.needsUpdate = true;
    this.dustScaleAttr.needsUpdate = true;
  }

  /**
   * Initializes a zero-GC procedural rising warm steam wisp particle system above:
   * - Emitter 0: Dining table porcelain teapot & teacups (X = 0.32, Y = 0.90, Z = 4.25)
   * - Emitter 1: Living room coffee table warm drink tumbler (X = 4.40, Y = 0.58, Z = -4.73)
   * - Emitter 2: Kitchen stove red enameled stockpot (X = 6.90, Y = 1.10, Z = 3.82)
   */
  private setupSteamWisps(): void {
    const count = this.steamCount;
    this.steamPositions = new Float32Array(count * 3);
    this.steamSeeds = new Float32Array(count * 4);
    this.steamScales = new Float32Array(count);
    this.steamAlphas = new Float32Array(count);

    const emitters: [number, number, number, number][] = [
      [0.32, 0.90, 4.25, 0.045], // Dining teapot & cups
      [4.40, 0.58, -4.73, 0.032], // Living coffee table drink
      [6.90, 1.10, 3.82, 0.055], // Kitchen stove red stockpot
    ];

    for (let i = 0; i < count; i++) {
      const emIdx = i % emitters.length;
      const [ex, ey, ez, spread] = emitters[emIdx];
      const lifePhase = (i / count + Math.random() * 0.25) % 1.0;

      const i3 = i * 3;
      this.steamPositions[i3] = ex + (Math.random() - 0.5) * spread;
      this.steamPositions[i3 + 1] = ey + lifePhase * 0.42;
      this.steamPositions[i3 + 2] = ez + (Math.random() - 0.5) * spread;

      const i4 = i * 4;
      this.steamSeeds[i4] = ex;
      this.steamSeeds[i4 + 1] = ey;
      this.steamSeeds[i4 + 2] = ez;
      this.steamSeeds[i4 + 3] = lifePhase + Math.floor(emIdx) * 10.0;

      this.steamScales[i] = 1.0;
      this.steamAlphas[i] = 0.18;
    }

    const geo = new THREE.BufferGeometry();
    this.steamPosAttr = new THREE.BufferAttribute(this.steamPositions, 3);
    this.steamPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.steamScaleAttr = new THREE.BufferAttribute(this.steamScales, 1);
    this.steamScaleAttr.setUsage(THREE.DynamicDrawUsage);
    this.steamAlphaAttr = new THREE.BufferAttribute(this.steamAlphas, 1);
    this.steamAlphaAttr.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute('position', this.steamPosAttr);
    geo.setAttribute('aScale', this.steamScaleAttr);
    geo.setAttribute('aAlpha', this.steamAlphaAttr);

    const pixelRatio = this.renderer.getPixelRatio();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uDustMap: { value: this.textures.dustMote },
        uShaftColor: this.uniforms.uShaftColor,
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: `
        attribute float aScale;
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float dist = max(0.6, -mvPosition.z);
          gl_PointSize = clamp(aScale * uPixelRatio * (26.0 / dist), 3.0, 22.0);
          vAlpha = aAlpha * smoothstep(0.35, 1.0, dist);
        }
      `,
      fragmentShader: `
        uniform sampler2D uDustMap;
        uniform vec3 uShaftColor;
        varying float vAlpha;
        void main() {
          vec4 sprite = texture2D(uDustMap, gl_PointCoord);
          if (sprite.a < 0.02 || vAlpha < 0.005) discard;
          vec3 steamCol = mix(vec3(1.0, 0.97, 0.94), uShaftColor, 0.28);
          gl_FragColor = vec4(steamCol, sprite.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.steamPoints = new THREE.Points(geo, mat);
    this.steamPoints.frustumCulled = false;
    this.scene.add(this.steamPoints);
  }

  private updateSteamWisps(dt: number, elapsed: number): void {
    const count = this.steamCount;
    const pos = this.steamPositions;
    const seeds = this.steamSeeds;
    const scales = this.steamScales;
    const alphas = this.steamAlphas;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      const ex = seeds[i4];
      const ey = seeds[i4 + 1];
      const ez = seeds[i4 + 2];
      const encoded = seeds[i4 + 3];
      const emIdx = Math.floor(encoded / 10.0);
      let phase = encoded - emIdx * 10.0;

      const riseSpeed = emIdx === 2 ? 0.24 : 0.19;
      phase = (phase + dt * riseSpeed) % 1.0;
      seeds[i4 + 3] = emIdx * 10.0 + phase;

      const maxRise = emIdx === 2 ? 0.48 : 0.36;
      const curlRadius = (0.012 + phase * 0.045) * (emIdx === 2 ? 1.35 : 1.0);
      const angle = elapsed * 1.45 + i * 1.7 + phase * 4.2;

      pos[i3] = ex + Math.cos(angle) * curlRadius;
      pos[i3 + 1] = ey + phase * maxRise;
      pos[i3 + 2] = ez + Math.sin(angle * 0.85) * curlRadius;

      const env = Math.sin(phase * Math.PI);
      alphas[i] = env * (emIdx === 2 ? 0.16 : 0.13);
      scales[i] = 0.75 + phase * 1.45;
    }

    this.steamPosAttr.needsUpdate = true;
    this.steamScaleAttr.needsUpdate = true;
    this.steamAlphaAttr.needsUpdate = true;
  }

  private updateWallClocks(elapsed: number): void {
    const rigs = this.ctx.clockRigs;
    if (rigs.length === 0) return;
    // Start at cozy afternoon 15:24 and advance in real time with a crisp quartz second-hand step
    const totalSeconds = 15 * 3600 + 24 * 60 + elapsed;
    const steppedSec = Math.floor(totalSeconds) + Math.pow(totalSeconds % 1.0, 4.0);
    const secAngle = -(steppedSec / 60.0) * Math.PI * 2;
    const minAngle = -((totalSeconds / 60.0) / 60.0) * Math.PI * 2;
    const hourAngle = -((totalSeconds / 3600.0) / 12.0) * Math.PI * 2;

    for (let i = 0; i < rigs.length; i++) {
      const c = rigs[i];
      c.hourHand.rotation.z = hourAngle;
      c.minuteHand.rotation.z = minAngle;
      if (c.secondHand) {
        c.secondHand.rotation.z = secAngle;
      }
    }
  }

  private updateTurntable(dt: number, elapsed: number): void {
    const rig = this.ctx.turntableRig;
    if (!rig) return;

    // 33⅓ RPM = 3.49066 rad/s clockwise when viewed from above; smooth belt-drive spin-up & coast-down
    const targetSpeed = rig.isPlaying ? 3.49 : 0.0;
    rig.spinSpeed = THREE.MathUtils.damp(rig.spinSpeed, targetSpeed, rig.isPlaying ? 4.2 : 2.6, dt);
    if (rig.spinSpeed > 0.001) {
      rig.platterGroup.rotation.y -= rig.spinSpeed * dt;
    }

    // Smoothly swing S-curved metal tonearm onto the outer vinyl groove while playing, park on rest when paused
    const targetArmAngle = rig.isPlaying ? 0.36 : 0.0;
    rig.armAngle = THREE.MathUtils.damp(rig.armAngle, targetArmAngle, 5.5, dt);
    rig.tonearmPivot.rotation.y = rig.armAngle;

    // Gentle warm VU meter & indicator pulse synchronized to slow ~70 BPM groove while playing
    if (rig.isPlaying && rig.vuGlowMats.length > 0) {
      const pulse = 0.86 + 0.14 * Math.sin(elapsed * 7.33);
      for (let i = 0; i < rig.vuGlowMats.length; i++) {
        rig.vuGlowMats[i].color.setRGB(1.0 * pulse, 0.82 * pulse, 0.52 * pulse);
      }
    }

    // Update 3D spatial presence & room muffling for the ambient Lo-Fi vinyl player (zero allocations)
    if (rig.isPlaying) {
      const dx = this.playerFeetPos.x - rig.worldPos.x;
      const dy = this.playerFeetPos.y + 1.4 - rig.worldPos.y;
      const dz = this.playerFeetPos.z - rig.worldPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      this.audio.updateVinylSpatial(dist, this.currentRoom);
    }
  }

  /**
   * Initializes the uncanny 'Ghost' Dust Mote particle system rendered
   * exclusively inside the planar mirror view pass.
   */
  private setupGhostDustMotes(): void {
    const count = this.ghostDustCount;
    this.ghostDustPositions = new Float32Array(count * 3);
    this.ghostDustVelocities = new Float32Array(count * 3);
    this.ghostDustAnchors = new Float32Array(count * 3);
    this.ghostDustSeeds = new Float32Array(count * 4);
    this.ghostDustScales = new Float32Array(count);
    this.ghostDustAlphas = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let z = 0;
      let zoneId = 0;

      if (i < 48) {
        // 48 ghost motes concentrated in the Entryway & Hallway mirror reflection frustum (X = -6.8 .. -1.8, Z = 1.4 .. 6.4)
        zoneId = 1;
        x = -6.8 + Math.random() * 5.0;
        y = 0.18 + Math.random() * 2.35;
        z = 1.4 + Math.random() * 5.0;
      } else {
        // 48 ghost motes in the Living Room & East window sunbeam reflection volume
        zoneId = 2;
        const isSecondWindow = i >= 72;
        const wz = isSecondWindow ? -3.60 : -6.55;
        const u = 0.06 + Math.random() * 0.9;
        const v = 0.06 + Math.random() * 0.88;
        x = 7.18 - 6.35 * (1.0 - u);
        const yBot = THREE.MathUtils.lerp(0.08, 0.85, u);
        const yTop = THREE.MathUtils.lerp(1.35, 2.65, u);
        y = THREE.MathUtils.lerp(yBot, yTop, v);
        z = wz + (Math.random() - 0.5) * 2.1;
      }

      const i3 = i * 3;
      this.ghostDustPositions[i3] = x;
      this.ghostDustPositions[i3 + 1] = y;
      this.ghostDustPositions[i3 + 2] = z;

      this.ghostDustAnchors[i3] = x;
      this.ghostDustAnchors[i3 + 1] = y;
      this.ghostDustAnchors[i3 + 2] = z;

      // Opposite initial velocity to the main room's upward thermal drift
      this.ghostDustVelocities[i3] = -this.dustVelocities[i3] * 1.35;
      this.ghostDustVelocities[i3 + 1] = -0.055 - Math.abs(this.dustVelocities[i3 + 1]);
      this.ghostDustVelocities[i3 + 2] = -this.dustVelocities[i3 + 2] * 1.35;

      const i4 = i * 4;
      this.ghostDustSeeds[i4] = Math.random() * Math.PI * 2;
      this.ghostDustSeeds[i4 + 1] = 1.8 + Math.random() * 3.0;
      this.ghostDustSeeds[i4 + 2] = 0.45 + Math.random() * 0.50;
      this.ghostDustSeeds[i4 + 3] = zoneId;

      this.ghostDustScales[i] = this.ghostDustSeeds[i4 + 2];
      this.ghostDustAlphas[i] = 0.24;
    }

    const geo = new THREE.BufferGeometry();
    this.ghostDustPosAttr = new THREE.BufferAttribute(this.ghostDustPositions, 3);
    this.ghostDustPosAttr.setUsage(THREE.DynamicDrawUsage);
    this.ghostDustScaleAttr = new THREE.BufferAttribute(this.ghostDustScales, 1);
    this.ghostDustScaleAttr.setUsage(THREE.DynamicDrawUsage);
    this.ghostDustAlphaAttr = new THREE.BufferAttribute(this.ghostDustAlphas, 1);
    this.ghostDustAlphaAttr.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute('position', this.ghostDustPosAttr);
    geo.setAttribute('aScale', this.ghostDustScaleAttr);
    geo.setAttribute('aAlpha', this.ghostDustAlphaAttr);

    const pixelRatio = this.renderer.getPixelRatio();
    this.ghostDustMat = new THREE.ShaderMaterial({
      uniforms: {
        uDustMap: { value: this.textures.dustMote },
        uGhostColorA: { value: new THREE.Color(0x9ce2ff) },
        uGhostColorB: { value: new THREE.Color(0xf279b8) },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: `
        attribute float aScale;
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying float vAlpha;
        varying float vSeedMix;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float dist = max(0.65, -mvPosition.z);
          gl_PointSize = clamp(aScale * uPixelRatio * (6.2 / dist), 1.0, 3.6);
          float nearLensFade = smoothstep(0.28, 0.85, -mvPosition.z);
          vAlpha = aAlpha * nearLensFade;
          vSeedMix = fract(position.x * 3.17 + position.y * 5.13 + position.z * 2.71);
        }
      `,
      fragmentShader: `
        uniform sampler2D uDustMap;
        uniform vec3 uGhostColorA;
        uniform vec3 uGhostColorB;
        varying float vAlpha;
        varying float vSeedMix;
        void main() {
          vec4 sprite = texture2D(uDustMap, gl_PointCoord);
          if (sprite.a < 0.02 || vAlpha < 0.005) discard;
          vec3 spectralColor = mix(uGhostColorA, uGhostColorB, vSeedMix);
          vec3 coreColor = mix(spectralColor, vec3(0.96, 0.94, 1.0), sprite.r * 0.55);
          gl_FragColor = vec4(coreColor, sprite.a * vAlpha * 0.52);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.ghostDustPoints = new THREE.Points(geo, this.ghostDustMat);
    this.ghostDustPoints.frustumCulled = false;
    // Hidden during main camera pass; enabled exclusively inside the mirror view pass!
    this.ghostDustPoints.visible = false;
    this.scene.add(this.ghostDustPoints);
  }

  /**
   * Advances the 'ghost' dust motes inside the mirror reflection in the exact
   * opposite direction of the main room's particles (reverse curl eddies +
   * anti-gravity downward sink + negated main-particle velocity coupling).
   */
  private updateGhostDustMotes(dt: number, elapsed: number): void {
    if (!this.settings.volumetricRays) return;

    const count = this.ghostDustCount;
    const pos = this.ghostDustPositions;
    const vel = this.ghostDustVelocities;
    const anc = this.ghostDustAnchors;
    const seeds = this.ghostDustSeeds;
    const scales = this.ghostDustScales;
    const alphas = this.ghostDustAlphas;
    const mainVel = this.dustVelocities;

    const sqrtDt = Math.sqrt(dt);
    const brownianSigma = 0.26;
    const drag = Math.exp(-1.55 * dt);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i4 = i * 4;

      let px = pos[i3];
      let py = pos[i3 + 1];
      let pz = pos[i3 + 2];

      let vx = vel[i3];
      let vy = vel[i3 + 1];
      let vz = vel[i3 + 2];

      const phase = seeds[i4];
      const twinkleFreq = seeds[i4 + 1];
      const baseSize = seeds[i4 + 2];

      // Evaluate the local main-room curl current at (px, py, pz) and NEGATE it
      const forwardFlowX =
        Math.sin(elapsed * 0.65 + py * 1.8 + phase) * 0.095 +
        Math.cos(elapsed * 1.15 - pz * 2.1 + phase * 0.7) * 0.045;
      const forwardFlowY =
        Math.cos(elapsed * 0.58 + px * 1.6 - phase) * 0.075 +
        Math.sin(elapsed * 1.25 + pz * 1.9 + phase) * 0.042 +
        0.038;
      const forwardFlowZ =
        Math.sin(elapsed * 0.72 + px * 1.5 + py * 1.7 + phase) * 0.095 +
        Math.cos(elapsed * 1.08 + py * 2.3 - phase * 1.3) * 0.048;

      // Blend negated local curl flow with the negated velocity of the paired main-room particle
      const revX = -forwardFlowX * 1.35 - mainVel[i3] * 0.85;
      const revY = -forwardFlowY * 1.45 - Math.abs(mainVel[i3 + 1]) * 0.9 - 0.032;
      const revZ = -forwardFlowZ * 1.35 - mainVel[i3 + 2] * 0.85;

      const kickX = (Math.random() - 0.5) * brownianSigma * sqrtDt;
      const kickY = (Math.random() - 0.5) * brownianSigma * sqrtDt;
      const kickZ = (Math.random() - 0.5) * brownianSigma * sqrtDt;

      vx = vx * drag + revX * (1.0 - drag) + kickX;
      vy = vy * drag + revY * (1.0 - drag) + kickY;
      vz = vz * drag + revZ * (1.0 - drag) + kickZ;

      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;

      // Wrap smoothly in the opposite direction when drifting outside home anchor volume
      const dxAnc = px - anc[i3];
      const dyAnc = py - anc[i3 + 1];
      const dzAnc = pz - anc[i3 + 2];
      if (dxAnc > 0.9) px -= 1.8;
      else if (dxAnc < -0.9) px += 1.8;
      if (dyAnc < -0.78 || py < 0.08) py = Math.min(2.62, anc[i3 + 1] + 0.72);
      else if (dyAnc > 0.78 || py > 2.68) py = Math.max(0.12, anc[i3 + 1] - 0.72);
      if (dzAnc > 0.9) pz -= 1.8;
      else if (dzAnc < -0.9) pz += 1.8;

      pos[i3] = px;
      pos[i3 + 1] = py;
      pos[i3 + 2] = pz;

      vel[i3] = vx;
      vel[i3 + 1] = vy;
      vel[i3 + 2] = vz;

      // Uncanny reverse-phase shimmer inside the mirror pass
      const glint =
        0.55 +
        0.45 *
          Math.cos(elapsed * twinkleFreq - phase - (px + py + pz) * 5.8);

      const zoneBoost = seeds[i4 + 3] === 1 ? 0.78 : 0.68;
      alphas[i] = zoneBoost * glint;
      scales[i] = baseSize * (0.9 + 0.38 * glint);
    }

    this.ghostDustPosAttr.needsUpdate = true;
    this.ghostDustAlphaAttr.needsUpdate = true;
    this.ghostDustScaleAttr.needsUpdate = true;
  }

  /**
   * Renders the planar reflection view pass for apartment mirrors, swapping out
   * the main room's dust motes for the counter-floating 'ghost' dust motes.
   * Uses true camera-frustum culling and 2-frame throttling to eliminate offscreen cost.
   */
  private renderMirrorPass(dt: number, elapsed: number): boolean {
    if (this.ctx.mirrors.length === 0 || this.viewMode === 'overview') {
      this.mirrorVisibleLastFrame = false;
      return false;
    }

    this.mirrorFrameCounter++;
    this.camera.updateMatrixWorld();
    _projScreenMat.multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    _camFrustum.setFromProjectionMatrix(_projScreenMat);

    const silhouette = this.ctx.metaState.silhouetteGroup;
    const prevSilhouetteVis = silhouette ? silhouette.visible : false;
    const prevDustVis = this.dustPoints.visible;
    let renderedAny = false;
    let anyMirrorVisible = false;

    for (const mirror of this.ctx.mirrors) {
      if (mirror.glitchBurstTimer > 0) {
        mirror.glitchBurstTimer = Math.max(0, mirror.glitchBurstTimer - dt);
      }

      // Skip offscreen mirror render pass if the mirror's room is occluded by SceneManager
      if (!this.ctx.sceneManager.isRoomVisible(mirror.room)) continue;

      // Compute camera distance & front-facing check relative to mirror plane
      _mirrorDelta.subVectors(this.camera.position, mirror.planePoint);
      const signedDist = _mirrorDelta.dot(mirror.normal);
      const totalDist = _mirrorDelta.length();

      if (signedDist <= 0.02 || totalDist > 8.5) continue;

      // Skip if mirror is outside the camera view frustum (uses pre-cached static world Box3!)
      const cachedBox = this.mirrorWorldBoxes.get(mirror.mesh);
      if (cachedBox) {
        if (!_camFrustum.intersectsBox(cachedBox)) continue;
      } else {
        _mirrorWorldBox.setFromObject(mirror.mesh).expandByScalar(0.08);
        if (!_camFrustum.intersectsBox(_mirrorWorldBox)) continue;
      }

      anyMirrorVisible = true;

      // Update mirror shader uniforms
      const proxGlitch = Math.max(0, 1.0 - totalDist / 3.8) * 0.22;
      const burstGlitch = Math.min(1.0, mirror.glitchBurstTimer * 0.45);
      const metaBase = this.atmosphere === 'meta' ? 0.42 : 0.08;
      mirror.material.uniforms.uGlitchIntensity.value =
        metaBase + proxGlitch + burstGlitch + 0.04 * Math.sin(elapsed * 2.7);

      // Skip redundant offscreen mirror redraws when camera & atmosphere are stationary (eliminates periodic mirror spikes!)
      const camMoved =
        this.camera.position.distanceToSquared(this.lastMirrorCamPos) > 0.000016 ||
        Math.abs(this.yaw - this.lastMirrorCamYaw) > 0.003 ||
        Math.abs(this.pitch - this.lastMirrorCamPitch) > 0.003 ||
        this.lastMirrorAtmo !== this.atmosphere;
      if (this.mirrorVisibleLastFrame && mirror.glitchBurstTimer <= 0) {
        if (!camMoved || (this.mirrorFrameCounter & 3) !== 0) {
          continue;
        }
      }
      this.lastMirrorCamPos.copy(this.camera.position);
      this.lastMirrorCamYaw = this.yaw;
      this.lastMirrorCamPitch = this.pitch;
      this.lastMirrorAtmo = this.atmosphere;

      // 1. Reflect main camera position, forward direction, and up vector across mirror plane
      _reflPos
        .copy(this.camera.position)
        .addScaledVector(mirror.normal, -2.0 * signedDist);

      this.camera.getWorldDirection(_camDir);
      const dirDot = _camDir.dot(mirror.normal);
      if (dirDot > -0.18) {
        // When viewing from the Dining Room toward the Entryway at a grazing angle,
        // keep the reflection camera aimed through the mirror center so the oblique near-plane never inverts!
        _reflDir.copy(mirror.planePoint).sub(_reflPos).normalize();
      } else {
        _reflDir.copy(_camDir).addScaledVector(mirror.normal, -2.0 * dirDot);
      }

      _camUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
      const upDot = _camUp.dot(mirror.normal);
      _reflUp.copy(_camUp).addScaledVector(mirror.normal, -2.0 * upDot);

      this.mirrorCamera.fov = this.camera.fov;
      this.mirrorCamera.aspect = this.camera.aspect;
      this.mirrorCamera.near = this.camera.near;
      this.mirrorCamera.far = 28.0;
      this.mirrorCamera.position.copy(_reflPos);
      this.mirrorCamera.up.copy(_reflUp);
      _reflTarget.copy(_reflPos).add(_reflDir);
      this.mirrorCamera.lookAt(_reflTarget);
      this.mirrorCamera.updateMatrixWorld();
      this.mirrorCamera.updateProjectionMatrix();

      // 2. Apply Lengyel oblique near-plane clipping matrix slightly in front of the mirror glass
      //    only when the mirror plane is strictly in front of the reflection camera
      _clipPlanePoint.copy(mirror.planePoint).addScaledVector(mirror.normal, 0.004);
      _mirrorPlane
        .setFromNormalAndCoplanarPoint(mirror.normal, _clipPlanePoint)
        .applyMatrix4(this.mirrorCamera.matrixWorldInverse);
      _clipPlane.set(
        _mirrorPlane.normal.x,
        _mirrorPlane.normal.y,
        _mirrorPlane.normal.z,
        _mirrorPlane.constant
      );

      if (_clipPlane.z < -0.15 && _clipPlane.w < -0.05) {
        const proj = this.mirrorCamera.projectionMatrix;
        const te = proj.elements;
        _qClip.x = (Math.sign(_clipPlane.x) + te[8]) / te[0];
        _qClip.y = (Math.sign(_clipPlane.y) + te[9]) / te[5];
        _qClip.z = -1.0;
        _qClip.w = (1.0 + te[10]) / te[14];

        const clipDot = _clipPlane.dot(_qClip);
        if (Math.abs(clipDot) > 0.05) {
          const scale = 2.0 / clipDot;
          te[2] = _clipPlane.x * scale;
          te[6] = _clipPlane.y * scale;
          te[10] = _clipPlane.z * scale + 1.0;
          te[14] = _clipPlane.w * scale;
        }
      }

      // 3. Swap particle systems & hide ink outlines during low-res mirror pass (cuts mirror draw calls in half!)
      //    Enable full protagonist head + hoodie + 5-fingered hands in planar mirror reflections!
      const prevOutlinesEnabled = this.outlines.enabled;
      if (prevOutlinesEnabled) this.outlines.setVisible(false);
      const prevHeldVis = this.heldItemAnchor.visible;
      this.heldItemAnchor.visible = false;
      mirror.mesh.visible = false;
      this.dustPoints.visible = false;
      this.ghostDustPoints.visible = this.settings.volumetricRays;
      this.protagonist?.setRenderPassMode('mirror');
      this.vrmAvatar?.setRenderPassMode('mirror');
      if (silhouette) {
        silhouette.visible =
          prevSilhouetteVis || mirror.glitchBurstTimer > 0 || totalDist < 3.6;
      }

      const prevTarget = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.mirrorRenderTarget);
      this.renderer.clear();
      this.renderer.render(this.scene, this.mirrorCamera);
      this.renderer.setRenderTarget(prevTarget);

      // 4. Restore visibility for the main room pass
      mirror.mesh.visible = true;
      this.heldItemAnchor.visible = prevHeldVis;
      if (prevOutlinesEnabled) this.outlines.setVisible(true);
      renderedAny = true;
    }

    this.mirrorVisibleLastFrame = anyMirrorVisible;
    this.ghostDustPoints.visible = false;
    this.dustPoints.visible = prevDustVis;
    this.protagonist?.setRenderPassMode(this.thirdPersonPreview ? 'overview' : 'first-person');
    this.vrmAvatar?.setRenderPassMode(this.thirdPersonPreview ? 'third-person' : 'first-person');
    if (silhouette) {
      silhouette.visible = prevSilhouetteVis;
    }
    return renderedAny || anyMirrorVisible;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private onContextRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const dpr = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.outlines.setResolution(w * dpr, h * dpr);
    this.postRig?.composer.setPixelRatio(dpr);
    this.postRig?.resize(w, h);
    if (this.pcFocusState === 'focused') {
      this.emitPcFocusRect(true);
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.inputSuspended || this.glitchCutscene) return;
    this.keys[e.code] = true;
    this.audio.unlock();
    if (this.viewMode !== 'first-person' || this.pcFocusState !== 'none') return;

    if (e.code === 'KeyB') {
      if (!e.repeat) {
        this.callbacks.onToggleInventory?.();
      }
      return;
    }

    if (e.code === 'KeyQ') {
      if (!e.repeat) {
        this.toggleEquipSelectedItem();
      }
      return;
    }

    if (e.code === 'KeyX') {
      if (!e.repeat) {
        this.switchToyGunAmmo();
      }
      return;
    }

    if (this.sofaSitState === 'sitting' || this.sofaSitState === 'seated') {
      if (e.code === 'Escape' && !e.repeat) {
        if (this.coPlayState !== 'none') {
          this.stopSofaCoPlay();
        } else {
          this.standUpFromSofaCoSit();
        }
        return;
      }

      if (this.coPlayState === 'playing') {
        if (
          (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') &&
          !e.repeat
        ) {
          this.coPlayActionPulse = 1.0;
        }
        if (
          this.livingTvGames.mode === 'launcher' &&
          (e.code === 'Space' || e.code === 'Enter') &&
          !e.repeat
        ) {
          this.selectLivingTvGame(this.livingTvGames.selectedGame, true);
          return;
        }
      }

      if (e.code === 'KeyF' && !e.repeat && !this.heroineEncounterActive) {
        this.executeSofaMenuOption(this.getActiveSofaMenuOption());
      }
      return;
    }

    if (e.code === 'KeyF') {
      if (this.heroineEncounterActive) {
        return;
      }
      // Prioritize direct crosshair target on the Toy Gun first
      if (this.hoveredTarget?.id === 'item_toy_gun') {
        this.triggerHoveredInteraction();
        return;
      }
      // Strict proximity fallback ONLY when standing next to the north toy-gun cushion (never steals sofa sit!)
      const toyGunWorld = this.ctx.metaState.toyGunWorldMesh;
      if (
        this.currentRoom === 'living' &&
        toyGunWorld &&
        toyGunWorld.visible &&
        this.hoveredTarget?.id !== 'living_sofa' &&
        this.playerFeetPos.z < -5.85
      ) {
        const distToGun = Math.hypot(
          this.playerFeetPos.x - toyGunWorld.position.x,
          this.playerFeetPos.z - toyGunWorld.position.z
        );
        if (distToGun < 1.25) {
          const gunTarget = this.ctx.interactables.find((i) => i.id === 'item_toy_gun');
          if (gunTarget) {
            this.hoveredTarget = gunTarget;
            this.triggerHoveredInteraction();
            return;
          }
        }
      }
      // Prioritize Heroine contextual interactions (bedroom first encounter, sofa co-sit, or routine chat)
      const promptKind = this.computeHeroinePromptKind();
      if (promptKind === 'bed') {
        this.callbacks.onRequestStartHeroineEncounter?.();
        return;
      }
      if (promptKind === 'sofa') {
        this.startSofaCoSit();
        return;
      }
      if (promptKind === 'chat') {
        this.callbacks.onRequestStartRoutineChat?.('standing');
        return;
      }
      if (this.hoveredTarget) {
        this.triggerHoveredInteraction();
        return;
      }
      // Pressing F inside the bedroom sits at the PC; inside the basement launches the arcade cabinet
      if (this.currentRoom === 'bedroom') {
        const pcTarget = this.ctx.interactables.find((i) => i.id === 'bed_pc');
        if (pcTarget) {
          const res = pcTarget.onInteract();
          if (res) {
            this.audio.playInteract(Boolean(res.metaTrigger));
            this.callbacks.onInteractResult(res);
          }
        }
      } else if (this.currentRoom === 'basement') {
        // Only open the arcade cabinet on KeyF fallback when standing right in front of it
        const distToArcade = Math.hypot(
          this.playerFeetPos.x - (-8.66),
          this.playerFeetPos.z - 1.84
        );
        if (distToArcade < 2.1) {
          const arcadeTarget = this.ctx.interactables.find((i) => i.id === 'base_arcade');
          if (arcadeTarget) {
            const res = arcadeTarget.onInteract();
            if (res) {
              this.audio.playInteract(Boolean(res.metaTrigger));
              this.callbacks.onInteractResult(res);
            }
          }
        }
      }
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (
      this.inputSuspended ||
      this.glitchCutscene ||
      this.viewMode !== 'first-person' ||
      this.pcFocusState !== 'none'
    ) {
      return;
    }
    if (Math.abs(e.deltaY) < 4) return;
    this.audio.unlock();

    if (this.sofaSitState === 'sitting' || this.sofaSitState === 'seated') {
      const opts = this.getSofaMenuOptions();
      if (opts.length > 0) {
        const step = e.deltaY > 0 ? 1 : -1;
        this.sofaMenuIndex =
          ((this.sofaMenuIndex + step) % opts.length + opts.length) % opts.length;
        const activeOpt = this.getActiveSofaMenuOption();
        if (
          (activeOpt === 'snowball' || activeOpt === 'tank') &&
          this.coPlayState === 'playing' &&
          this.livingTvGames.mode === 'launcher'
        ) {
          this.livingTvGames.selectLauncherCard(activeOpt);
          this.ctx.metaState.livingTv.accum = 1.0;
        }
        this.audio.playInteract(false);
        this.emitSofaCoSitState();
        this.emitSofaCoPlayState();
      }
      return;
    }

    this.cycleInventoryItem(e.deltaY > 0 ? 1 : -1);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.inputSuspended) {
      this.keys[e.code] = false;
      return;
    }
    this.keys[e.code] = false;
  };

  private onPointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (this.isPointerLocked) {
      this.isDraggingLook = false;
      this.pointerLockSupported = true;
    }
    this.callbacks.onPointerLockChange(this.isPointerLocked);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.inputSuspended || this.glitchCutscene) return;
    this.audio.unlock();
    if (this.viewMode !== 'first-person') return;
    this.lockedOnThisPointerDown = false;

    // Default mouse lock during first-person exploration: clicking the canvas immediately locks the cursor
    // During active heroine dialogue OR while seated on the sofa, stay unlocked on canvas drag so player
    // can both drag-look freely and click floating buttons / TV / choices immediately!
    if (!this.isPointerLocked && e.button === 0 && this.pcFocusState === 'none') {
      if (this.pointerLockSupported && !this.heroineEncounterActive && this.sofaSitState === 'none') {
        this.lockedOnThisPointerDown = true;
        this.requestPointerLock();
      }
      // Keep drag-look initialized as an instant fallback if a sandboxed iframe, ESC cooldown, sofa sit, or active dialogue keeps cursor free
      this.isDraggingLook = true;
      this.dragMovedDist = 0;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      return;
    }

    // Instant snappy fire / note open when pointer-locked
    if (this.isPointerLocked && e.button === 0 && this.pcFocusState === 'none') {
      const equipped = this.getEquippedItem();
      if (equipped?.id === 'toy_gun') {
        this.fireToyGun(_centerNDC);
        return;
      }
      if (equipped?.id === 'paper_airplane_note') {
        this.audio.playPaperUnfold();
        this.callbacks.onOpenPaperAirplaneNote?.();
        return;
      }
    }
    this.isDraggingLook = true;
    this.dragMovedDist = 0;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.inputSuspended || this.glitchCutscene || this.viewMode !== 'first-person') return;

    if (this.isPointerLocked) {
      this.isTeleporting = false;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - e.movementY * 0.0022,
        -1.38,
        1.38
      );
      this.gunSwayX = THREE.MathUtils.clamp(this.gunSwayX - e.movementX * 0.00028, -0.028, 0.028);
      this.gunSwayY = THREE.MathUtils.clamp(this.gunSwayY + e.movementY * 0.00024, -0.022, 0.022);
      return;
    }

    if (this.isDraggingLook) {
      this.isTeleporting = false;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.dragMovedDist += Math.abs(dx) + Math.abs(dy);
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.yaw -= dx * 0.0042;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0042, -1.38, 1.38);
      this.gunSwayX = THREE.MathUtils.clamp(this.gunSwayX - dx * 0.00035, -0.028, 0.028);
      this.gunSwayY = THREE.MathUtils.clamp(this.gunSwayY + dy * 0.00030, -0.022, 0.022);
    } else {
      // Update pointer NDC for non-locked hover inspection
      const rect = this.renderer.domElement.getBoundingClientRect();
      _pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.inputSuspended || this.viewMode !== 'first-person') {
      this.isDraggingLook = false;
      this.lockedOnThisPointerDown = false;
      return;
    }
    const wasLockClick = this.lockedOnThisPointerDown;
    this.lockedOnThisPointerDown = false;
    const wasClick = this.isDraggingLook && this.dragMovedDist < 6;
    this.isDraggingLook = false;

    // Do not accidentally fire or trigger an interaction on the click that acquired pointer lock
    if (wasLockClick && (this.isPointerLocked || this.pointerLockSupported)) {
      return;
    }

    if (wasClick) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      if (!this.isPointerLocked) {
        _pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        _pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      }

      // If holding Toy Gun or Paper Note, left-click fires / unfolds along screen center crosshair!
      if (e.button === 0 && this.pcFocusState === 'none') {
        const equipped = this.getEquippedItem();
        if (equipped?.id === 'toy_gun') {
          this.fireToyGun(_centerNDC);
          return;
        }
        if (equipped?.id === 'paper_airplane_note') {
          this.audio.playPaperUnfold();
          this.callbacks.onOpenPaperAirplaneNote?.();
          return;
        }
      }

      // While seated on the Living Room sofa, clicking directly on the TV interacts with the console or toggles TV!
      if (this.sofaSitState === 'sitting' || this.sofaSitState === 'seated') {
        const tvTarget = this.ctx.interactables.find((i) => i.id === 'liv_tv');
        if (tvTarget) {
          this.raycaster.setFromCamera(this.isPointerLocked ? _centerNDC : _pointerNDC, this.camera);
          const hits = this.raycaster.intersectObject(tvTarget.mesh, true);
          if (hits.length > 0 && hits[0].distance < 7.5) {
            if (this.coPlayState === 'playing') {
              if (!this.ctx.metaState.livingTv.isOn) {
                const nextOn = this.toggleLivingRoomTv();
                this.callbacks.onHeroineSofaTvToggled?.(nextOn);
              }
              this.ctx.metaState.livingTv.channel = 0;
              if (this.livingTvGames.mode === 'launcher' && hits[0].uv) {
                const chosen: TvGameSelectionId = hits[0].uv.x < 0.5 ? 'snowball' : 'tank';
                this.selectLivingTvGame(chosen, true);
              } else if (hits[0].uv && hits[0].uv.y > 0.84 && hits[0].uv.x > 0.72) {
                this.returnLivingTvToLauncher();
              } else {
                this.coPlayActionPulse = 1.0;
              }
              return;
            }
            const nextOn = this.toggleLivingRoomTv();
            this.callbacks.onHeroineSofaTvToggled?.(nextOn);
            return;
          }
        }
        return;
      }

      // Always inspect the exact target aimed at by the center crosshair dot
      this.updateHoverRaycast(_centerNDC);
      this.triggerHoveredInteraction();
    }
  };

  public requestPointerLock(): void {
    this.audio.unlock();
    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }
    if (document.pointerLockElement === this.renderer.domElement) {
      return;
    }
    if (typeof this.renderer.domElement.requestPointerLock !== 'function') {
      this.pointerLockSupported = false;
      this.lockedOnThisPointerDown = false;
      return;
    }
    try {
      const maybePromise = this.renderer.domElement.requestPointerLock() as unknown as
        | Promise<void>
        | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch((err: unknown) => {
          // Only clear the click-swallow flag; do NOT permanently disable lock because
          // browsers reject briefly right after ESC (1.25s security cooldown).
          this.lockedOnThisPointerDown = false;
          if (err && typeof err === 'object' && 'name' in err && err.name === 'NotSupportedError') {
            this.pointerLockSupported = false;
          }
        });
      }
    } catch {
      this.lockedOnThisPointerDown = false;
    }
  }

  public jumpToRoom(roomId: RoomId): void {
    this.audio.unlock();
    if (this.pcFocusState !== 'none') {
      this.pcFocusState = 'none';
      this.pcFocusTarget = 'none';
      this.callbacks.onPcFocusChange?.({ active: false, settled: false, target: null, rect: null });
    }
    const preset = ROOM_PRESETS[roomId];
    if (!preset) return;

    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }

    // Ensure target doors are opened cleanly when jumping into Living, Bedroom, Bathroom, or Basement
    if (
      roomId === 'bedroom' ||
      roomId === 'basement' ||
      roomId === 'living' ||
      roomId === 'bathroom'
    ) {
      const doorId =
        roomId === 'bedroom'
          ? 'door_bedroom'
          : roomId === 'basement'
            ? 'door_basement'
            : roomId === 'bathroom'
              ? 'door_bathroom'
              : 'door_living_dining';
      const door = this.ctx.doors.find((d) => d.id === doorId);
      if (door && !door.isOpen) {
        door.isOpen = true;
        door.angularVel = 0;
        this.collisions.setEnabled(door.colliderId, false);
      }
    }

    if (Math.abs(this.nonEuclidFovOffset) > 0.01 || Math.abs(this.nonEuclidFisheye) > 0.001) {
      this.nonEuclidFovOffset = 0;
      this.nonEuclidFisheye = 0;
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
    }

    this.targetFeetPos.set(preset.position[0], preset.position[1] - 1.62, preset.position[2]);
    this.targetYaw = preset.yaw;
    this.targetPitch = preset.pitch;
    this.teleportTargetRoom = roomId;
    this.isTeleporting = true;
    // Immediately mark destination room visible & announce once to avoid mid-flight pop/re-renders
    if (this.currentRoom !== roomId) {
      this.currentRoom = roomId;
      this.audio.updateAtmosphere(roomId, this.atmosphere);
      const roomLabel = getRoomAt(
        this.targetFeetPos.x,
        this.targetFeetPos.y,
        this.targetFeetPos.z
      );
      this.callbacks.onRoomChange({ id: roomId, label: roomLabel.label });
    }
    this.triggerRoomEntryFlicker(roomId, 0.95);
  }

  private getTargetFocusPose(): { x: number; y: number; z: number; yaw: number; pitch: number } {
    const halfFovRad = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const tanHalf = Math.tan(halfFovRad);
    const aspect = Math.max(0.65, this.camera.aspect);

    if (this.pcFocusTarget === 'basement_arcade') {
      const screen = this.ctx.metaState.arcadeScreenMesh;
      if (screen) {
        screen.updateWorldMatrix(true, false);
        this.arcadeScreenCenterScratch.set(0, 0, 0).applyMatrix4(screen.matrixWorld);
        this.arcadeScreenNormalScratch
          .set(0, 0, 1)
          .transformDirection(screen.matrixWorld)
          .normalize();
        const distForWidth = 0.54 / (2 * tanHalf * aspect * 0.72);
        const distForHeight = 0.405 / (2 * tanHalf * 0.62);
        const dist = Math.max(0.56, distForHeight, distForWidth);
        const targetYaw = Math.atan2(
          this.arcadeScreenNormalScratch.x,
          this.arcadeScreenNormalScratch.z
        );
        const targetPitch = Math.asin(
          THREE.MathUtils.clamp(-this.arcadeScreenNormalScratch.y, -0.95, 0.95)
        );
        return {
          x: this.arcadeScreenCenterScratch.x + this.arcadeScreenNormalScratch.x * dist,
          y: this.arcadeScreenCenterScratch.y + this.arcadeScreenNormalScratch.y * dist,
          z: this.arcadeScreenCenterScratch.z + this.arcadeScreenNormalScratch.z * dist,
          yaw: targetYaw,
          pitch: targetPitch,
        };
      }
      return { x: -8.66, y: -1.78, z: 1.08, yaw: Math.PI, pitch: -0.22 };
    }

    // bedroom_pc: enlarged pcScreenMesh at (-2.60, 1.19, -6.322), 0.88 x 0.50m
    const distForWidth = 0.88 / (2 * tanHalf * aspect * 0.80);
    const distForHeight = 0.50 / (2 * tanHalf * 0.74);
    const dist = Math.max(0.54, distForHeight, distForWidth);
    return {
      x: -2.60,
      y: 1.19,
      z: -6.322 + dist,
      yaw: 0,
      pitch: 0,
    };
  }

  private computePcScreenRect(): PcScreenRect | null {
    const isArcade = this.pcFocusTarget === 'basement_arcade';
    const screen = isArcade
      ? this.ctx.metaState.arcadeScreenMesh
      : this.ctx.metaState.pcScreenMesh;
    if (!screen) return null;
    screen.updateWorldMatrix(true, false);
    this.camera.updateMatrixWorld();

    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const hw = isArcade ? 0.27 : 0.44;
    const hh = isArcade ? 0.2025 : 0.25;
    this.pcCornerScratch[0].set(-hw, hh, 0);
    this.pcCornerScratch[1].set(hw, hh, 0);
    this.pcCornerScratch[2].set(hw, -hh, 0);
    this.pcCornerScratch[3].set(-hw, -hh, 0);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const c of this.pcCornerScratch) {
      c.applyMatrix4(screen.matrixWorld).project(this.camera);
      const sx = (c.x * 0.5 + 0.5) * w;
      const sy = (-c.y * 0.5 + 0.5) * h;
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sy < minY) minY = sy;
      if (sy > maxY) maxY = sy;
    }

    const left = Math.round(minX);
    const top = Math.round(minY);
    const width = Math.max(240, Math.round(maxX - minX));
    const height = Math.max(150, Math.round(maxY - minY));
    return { left, top, width, height };
  }

  private emitPcFocusRect(settled: boolean): void {
    const rect = this.computePcScreenRect();
    if (
      !this.pcLastRect ||
      !rect ||
      Math.abs(rect.left - this.pcLastRect.left) > 1 ||
      Math.abs(rect.top - this.pcLastRect.top) > 1 ||
      Math.abs(rect.width - this.pcLastRect.width) > 1 ||
      Math.abs(rect.height - this.pcLastRect.height) > 1
    ) {
      this.pcLastRect = rect;
    }
    this.callbacks.onPcFocusChange?.({
      active: this.pcFocusState === 'focusing' || this.pcFocusState === 'focused',
      settled,
      target: this.pcFocusTarget === 'none' ? null : this.pcFocusTarget,
      rect: this.pcLastRect,
    });
  }

  public focusOnBedroomPc(): void {
    this.audio.unlock();
    if (this.pcFocusState === 'focused' && this.pcFocusTarget === 'bedroom_pc') {
      this.emitPcFocusRect(true);
      return;
    }
    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.keys = {};
    this.isDraggingLook = false;
    this.isTeleporting = false;

    const door = this.ctx.doors.find((d) => d.id === 'door_bedroom');
    if (door && !door.isOpen) {
      door.isOpen = true;
      this.collisions.setEnabled(door.colliderId, false);
    }

    // Save safe standing pose in front of the desk if currently far away (different room) or right where player stands
    const inBedroom = this.currentRoom === 'bedroom';
    if (inBedroom && this.pcFocusState === 'none') {
      this.savedStandingPos.copy(this.playerFeetPos);
      this.savedStandingYaw = this.yaw;
      this.savedStandingPitch = this.pitch;
    } else if (!inBedroom) {
      this.savedStandingPos.set(-3.00, 0.0, -5.20);
      this.savedStandingYaw = 0.08;
      this.savedStandingPitch = -0.14;
      // Place camera right behind desk chair so dolly-in from doorway to desk feels smooth & grounded!
      this.playerFeetPos.set(-3.05, 0.0, -4.95);
      this.yaw = 0.05;
      this.pitch = -0.12;
      this.applyCameraFromPlayer();
    }

    this.pcCamPos.copy(this.camera.position);
    this.pcCamYaw = this.yaw;
    this.pcCamPitch = this.pitch;
    // Normalize yaw around 0 so shortest-path rotation to 0 never spins 360deg
    while (this.pcCamYaw > Math.PI) this.pcCamYaw -= Math.PI * 2;
    while (this.pcCamYaw < -Math.PI) this.pcCamYaw += Math.PI * 2;

    this.currentRoom = 'bedroom';
    this.callbacks.onRoomChange({ id: 'bedroom', label: '卧室' });
    this.pcFocusTarget = 'bedroom_pc';
    this.pcFocusState = 'focusing';
    this.pcLastRect = null;
    this.callbacks.onPcFocusChange?.({
      active: true,
      settled: false,
      target: 'bedroom_pc',
      rect: null,
    });
  }

  public focusOnBasementArcade(): void {
    this.audio.unlock();
    if (this.pcFocusState === 'focused' && this.pcFocusTarget === 'basement_arcade') {
      this.emitPcFocusRect(true);
      return;
    }
    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    this.keys = {};
    this.isDraggingLook = false;
    this.isTeleporting = false;

    const door = this.ctx.doors.find((d) => d.id === 'door_basement');
    if (door && !door.isOpen) {
      door.isOpen = true;
      this.collisions.setEnabled(door.colliderId, false);
    }

    const inBasement = this.currentRoom === 'basement';
    if (inBasement && this.pcFocusState === 'none') {
      this.savedStandingPos.copy(this.playerFeetPos);
      this.savedStandingYaw = this.yaw;
      this.savedStandingPitch = this.pitch;
    } else if (!inBasement) {
      this.savedStandingPos.set(-6.80, -3.2, -3.55);
      this.savedStandingYaw = 0.0;
      this.savedStandingPitch = -0.05;
      this.playerFeetPos.set(-6.80, -3.2, -3.75);
      this.yaw = 0.0;
      this.pitch = -0.10;
      this.applyCameraFromPlayer();
    }

    this.pcCamPos.copy(this.camera.position);
    this.pcCamYaw = this.yaw;
    this.pcCamPitch = this.pitch;
    while (this.pcCamYaw > Math.PI) this.pcCamYaw -= Math.PI * 2;
    while (this.pcCamYaw < -Math.PI) this.pcCamYaw += Math.PI * 2;

    this.currentRoom = 'basement';
    this.callbacks.onRoomChange({ id: 'basement', label: '地下储藏间' });
    this.pcFocusTarget = 'basement_arcade';
    this.pcFocusState = 'focusing';
    this.pcLastRect = null;
    this.callbacks.onPcFocusChange?.({
      active: true,
      settled: false,
      target: 'basement_arcade',
      rect: null,
    });
  }

  public exitPcFocus(): void {
    if (this.pcFocusState === 'none' || this.pcFocusState === 'returning') return;
    this.arcadeStickTargetX = 0;
    this.arcadeStickTargetZ = 0;
    this.pcFocusState = 'returning';
    this.pcLastRect = null;
    this.callbacks.onPcFocusChange?.({ active: false, settled: false, target: null, rect: null });
  }

  /**
   * Triggers an inconsistent psychological-horror flicker / brownout sequence
   * on the ceiling lamp of the entered room (and occasionally a sympathetic
   * dip on an adjacent room's lamp).
   */
  private triggerRoomEntryFlicker(roomId: RoomId, severity = 1.0): void {
    let triggeredAny = false;
    for (const lamp of this.ctx.ceilingLamps) {
      if (lamp.room === roomId) {
        lamp.burstDuration = (0.85 + Math.random() * 0.95) * severity;
        lamp.burstTimer = lamp.burstDuration;
        lamp.burstSeed = Math.random() * 100.0;
        lamp.proximityCooldown = 3.5 + Math.random() * 2.5;
        triggeredAny = true;
      } else if (Math.random() < (this.atmosphere === 'meta' ? 0.75 : 0.35)) {
        // Sympathetic brief voltage dip on shared apartment circuit
        lamp.burstDuration = 0.4 + Math.random() * 0.45;
        lamp.burstTimer = Math.max(lamp.burstTimer, lamp.burstDuration);
        lamp.burstSeed = Math.random() * 100.0;
      }
    }
    if (triggeredAny) {
      this.audio.playLightFlicker(0.62 * severity);
    }
  }

  public setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    const isOverview = mode === 'overview';
    this.ctx.ceilingGroup.visible = !isOverview;
    this.orbitControls.enabled = isOverview;
    this.protagonist?.setRenderPassMode(
      isOverview || this.thirdPersonPreview ? 'overview' : 'first-person'
    );
    this.vrmAvatar?.setRenderPassMode(
      isOverview ? 'overview' : this.thirdPersonPreview ? 'third-person' : 'first-person'
    );
    this.syncHeldViewModelVisibility();

    if (isOverview) {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      this.camera.position.set(2.5, 15.2, 13.8);
      this.orbitControls.target.set(-0.3, 0.2, -1.7);
      this.orbitControls.update();
    } else {
      this.applyCameraFromPlayer();
    }

    this.ctx.sceneManager.updateVisibility(
      this.currentRoom,
      this.playerFeetPos,
      this.viewMode,
      this.ctx.doors,
      this.ctx.ceilingLamps
    );
    this.shadowDirty = true;
    this.shadowImmediate = true;
  }

  public applyAtmosphere(mode: AtmosphereMode): void {
    this.atmosphere = mode;
    updateTwilightUniformsForMode(this.uniforms, mode);
    updateBakedLightmapForAtmosphere(this.uniforms, mode);
    this.bakedLightmapRig?.setAtmosphere(mode);
    this.vrmAvatar?.heroine.setAtmosphereMode(mode);
    this.audio.updateAtmosphere(this.currentRoom, mode);

    const silhouette = this.ctx.metaState.silhouetteGroup;

    const setWindowGlowColor = (hex: number) => {
      for (const w of this.ctx.windowGlowMeshes) {
        const m = w.material as THREE.MeshBasicMaterial & {
          uniforms?: { uBaseColor?: { value: THREE.Color } };
        };
        if (m.uniforms?.uBaseColor) {
          m.uniforms.uBaseColor.value.setHex(hex);
        } else if (m.color) {
          m.color.setHex(hex);
        }
      }
    };

    if (mode === 'daylight') {
      // MiSide Soft Healing Daytime Palette: lowered window exposure to eliminate white blowout while preserving soft Bloom & lavender-grey AO depth
      this.renderer.toneMappingExposure = 0.95;
      this.scene.environmentIntensity = 0.32;
      (this.scene.background as THREE.Color).setHex(0xf5e8e2);
      (this.scene.fog as THREE.FogExp2).color.setHex(0xf7ece6);
      this.baseFogDensity = 0.0115;
      (this.scene.fog as THREE.FogExp2).density = this.baseFogDensity;
      if (this.volumetricFogMat) {
        this.volumetricFogMat.uniforms.uFogColor.value.setHex(0xfff0e6);
        this.volumetricFogMat.uniforms.uFogOpacity.value = 0.056;
      }
      if (this.ctx.metaState.nonEuclidCorridor.dioramaLight) {
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.color.setHex(0xfff0de);
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.intensity = 0.96;
      }
      this.ambientLight.color.setHex(0xffe4d6);
      this.ambientLight.intensity = 0.185;
      this.sunLight.color.setHex(0xfff2d2);
      this.baseSunIntensity = 1.50;
      this.sunLight.intensity = this.baseSunIntensity;
      this.sunLight.shadow.radius = 2.9;
      this.sunLight.shadow.intensity = 0.80;
      this.windowSunLight.intensity = 0.0;
      this.hemiLight.color.setHex(0xffe6d8);
      this.hemiLight.groundColor.setHex(0xb08c96);
      this.hemiLight.intensity = 0.51;
      this.baseWindowFillIntensity = 0.60;
      for (const w of this.windowFillLights) {
        w.color.setHex(0xffe8dc);
        w.intensity = this.baseWindowFillIntensity;
      }
      if (this.ctx.metaState.bedroomMoonlightFill) {
        this.ctx.metaState.bedroomMoonlightFill.intensity = 0.0;
      }
      this.outlines.setColor(0x4c372f);
      this.uniforms.uAnisotropy.value = 0.62;
      this.uniforms.uTyndallIntensity.value = 1.02;
      setWindowGlowColor(0xfff0dc);
      this.postRig?.bloomController.applyForMode(mode, this.uniforms);
      if (silhouette) silhouette.visible = false;
    } else if (mode === 'sunset') {
      // MiSide Signature Velvety Rose-Lavender & Golden-Apricot Sunset (Reference 2)
      this.renderer.toneMappingExposure = 1.05;
      this.scene.environmentIntensity = 0.24;
      (this.scene.background as THREE.Color).setHex(0x5a3e58);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x7d5772);
      this.baseFogDensity = 0.0185;
      (this.scene.fog as THREE.FogExp2).density = this.baseFogDensity;
      if (this.volumetricFogMat) {
        this.volumetricFogMat.uniforms.uFogColor.value.setHex(0xffd0b6);
        this.volumetricFogMat.uniforms.uFogOpacity.value = 0.072;
      }
      if (this.ctx.metaState.nonEuclidCorridor.dioramaLight) {
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.color.setHex(0xffd2b0);
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.intensity = 1.02;
      }
      this.ambientLight.color.setHex(0xeeB8ce);
      this.ambientLight.intensity = 0.21;
      this.sunLight.color.setHex(0xffb884);
      this.baseSunIntensity = 1.80;
      this.sunLight.intensity = this.baseSunIntensity;
      this.sunLight.shadow.radius = 3.2;
      this.sunLight.shadow.intensity = 0.84;
      this.windowSunLight.intensity = 0.0;
      this.hemiLight.color.setHex(0xf7cadb);
      this.hemiLight.groundColor.setHex(0x8e6486);
      this.hemiLight.intensity = 0.58;
      this.baseWindowFillIntensity = 0.94;
      for (const w of this.windowFillLights) {
        w.color.setHex(0xffcaa6);
        w.intensity = this.baseWindowFillIntensity;
      }
      if (this.ctx.metaState.bedroomMoonlightFill) {
        this.ctx.metaState.bedroomMoonlightFill.color.setHex(0xffcfa8);
        this.ctx.metaState.bedroomMoonlightFill.intensity = 0.36;
      }
      this.outlines.setColor(0x4a3234);
      if (this.ctx.metaState.bedroomLampLight) {
        this.ctx.metaState.bedroomLampLight.intensity = 0.68;
      }
      this.uniforms.uAnisotropy.value = 0.68;
      this.uniforms.uTyndallIntensity.value = 1.16;
      setWindowGlowColor(0xffdab8);
      this.postRig?.bloomController.applyForMode(mode, this.uniforms);
      if (silhouette) silhouette.visible = false;
    } else if (mode === 'midnight') {
      // MiSide Dreamy Luminous Violet-Purple & Soft Moonlit Indigo Nighttime (Reference 1)
      this.renderer.toneMappingExposure = 1.14;
      this.scene.environmentIntensity = 0.18;
      (this.scene.background as THREE.Color).setHex(0x1e173d);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x2c2258);
      this.baseFogDensity = 0.0245;
      (this.scene.fog as THREE.FogExp2).density = this.baseFogDensity;
      if (this.volumetricFogMat) {
        this.volumetricFogMat.uniforms.uFogColor.value.setHex(0x7c8ae6);
        this.volumetricFogMat.uniforms.uFogOpacity.value = 0.078;
      }
      if (this.ctx.metaState.nonEuclidCorridor.dioramaLight) {
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.color.setHex(0xffe0c4);
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.intensity = 0.82;
      }
      this.ambientLight.color.setHex(0x4d3a86);
      this.ambientLight.intensity = 0.26;
      this.sunLight.color.setHex(0x7fa8ff);
      this.baseSunIntensity = 1.08;
      this.sunLight.intensity = this.baseSunIntensity;
      this.sunLight.shadow.radius = 4.6;
      this.sunLight.shadow.intensity = 0.78;
      this.windowSunLight.intensity = 0.0;
      this.hemiLight.color.setHex(0x785cc8);
      this.hemiLight.groundColor.setHex(0x221746);
      this.hemiLight.intensity = 0.61;
      this.baseWindowFillIntensity = 0.55;
      for (const w of this.windowFillLights) {
        w.color.setHex(0x7aa4ff);
        w.intensity = this.baseWindowFillIntensity;
      }
      if (this.ctx.metaState.bedroomMoonlightFill) {
        this.ctx.metaState.bedroomMoonlightFill.color.setHex(0x7aa6ff);
        this.ctx.metaState.bedroomMoonlightFill.intensity = 1.08;
      }
      this.outlines.setColor(0x2b2144);
      if (this.ctx.metaState.bedroomLampLight) {
        this.ctx.metaState.bedroomLampLight.intensity = 0.98;
      }
      this.uniforms.uAnisotropy.value = 0.56;
      this.uniforms.uTyndallIntensity.value = 1.06;
      setWindowGlowColor(0x7aa2f8);
      this.postRig?.bloomController.applyForMode(mode, this.uniforms);
      if (silhouette) silhouette.visible = false;
    } else {
      // Meta Anomaly Mode: crimson-violet psychological shift with readable shadow detail
      this.renderer.toneMappingExposure = 1.06;
      this.scene.environmentIntensity = 0.16;
      (this.scene.background as THREE.Color).setHex(0x1c0b1e);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x321236);
      this.baseFogDensity = 0.036;
      (this.scene.fog as THREE.FogExp2).density = this.baseFogDensity;
      if (this.volumetricFogMat) {
        this.volumetricFogMat.uniforms.uFogColor.value.setHex(0xb84e7e);
        this.volumetricFogMat.uniforms.uFogOpacity.value = 0.088;
      }
      if (this.ctx.metaState.nonEuclidCorridor.dioramaLight) {
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.color.setHex(0xffb0be);
        this.ctx.metaState.nonEuclidCorridor.dioramaLight.intensity = 0.92;
      }
      this.ambientLight.color.setHex(0x581d3c);
      this.ambientLight.intensity = 0.19;
      this.sunLight.color.setHex(0xff5e82);
      this.baseSunIntensity = 1.64;
      this.sunLight.intensity = this.baseSunIntensity;
      this.sunLight.shadow.radius = 3.8;
      this.sunLight.shadow.intensity = 0.88;
      this.windowSunLight.intensity = 0.0;
      this.hemiLight.color.setHex(0x94487c);
      this.hemiLight.groundColor.setHex(0x321434);
      this.hemiLight.intensity = 0.75;
      this.baseWindowFillIntensity = 0.92;
      for (const w of this.windowFillLights) {
        w.color.setHex(0xff6c92);
        w.intensity = this.baseWindowFillIntensity;
      }
      if (this.ctx.metaState.bedroomMoonlightFill) {
        this.ctx.metaState.bedroomMoonlightFill.color.setHex(0xd85888);
        this.ctx.metaState.bedroomMoonlightFill.intensity = 0.55;
      }
      this.outlines.setColor(0x341c28);
      if (this.ctx.metaState.bedroomLampLight) {
        this.ctx.metaState.bedroomLampLight.intensity = 0.56;
      }
      setWindowGlowColor(0xd6456c);
      this.postRig?.bloomController.applyForMode(mode, this.uniforms);
      if (silhouette) silhouette.visible = true;
      this.metaGlitchTimer = 1.1;
      this.triggerRoomEntryFlicker(this.currentRoom, 1.25);
    }
    if (mode === 'daylight' && this.ctx.metaState.bedroomLampLight) {
      this.ctx.metaState.bedroomLampLight.intensity = 0.48;
    }
    this.baseExposure = this.renderer.toneMappingExposure;
    this.baseAmbientIntensity = this.ambientLight.intensity;
    this.baseHemiIntensity = this.hemiLight.intensity;
    this.baseEnvIntensity = this.scene.environmentIntensity;
    this.applyBrightnessScale();
    this.harmonizeRoomAmbientAndWindowSoftDecay(mode);
    this.updateSofaLightTemperatureShadow(mode);
    this.optimizeBedroomFloorRoughnessAndFresnel(mode);
    if (this.postRig) {
      this.postRig.unrealBloomPass.threshold = 0.72;
      this.postRig.ssaoController.applyToUniforms(this.uniforms);
    }
    this.shadowDirty = true;
    this.shadowImmediate = true;

    // Relocate or update stray glitch cat for the new atmosphere mode
    if (!this.catState.consumed) {
      if (this.catState.phase === 'active' || this.catState.phase === 'fading_in') {
        this.catState.phase = 'fading_out';
        this.catState.glitchBurst = 1.0;
        this.catState.pendingModeRelocate = true;
      } else if (this.catState.phase === 'fading_out') {
        this.catState.pendingModeRelocate = true;
      } else if (this.catState.phase === 'hidden') {
        this.catState.timer = Math.min(this.catState.timer, 0.85);
      }
    }
  }

  /**
   * Unifies ambient light color temperatures and fill intensities across all apartment rooms
   * while tuning physically based Soft Shadow Decay for Living Room window shafts & floor light patches.
   */
  private harmonizeRoomAmbientAndWindowSoftDecay(mode: AtmosphereMode): void {
    // 1. Physically based Soft Shadow Decay parameter driving penumbra widening & beam clearance
    if (mode === 'daylight') {
      this.uniforms.uSoftShadowDecay.value = 0.96;
    } else if (mode === 'sunset') {
      this.uniforms.uSoftShadowDecay.value = 1.24;
    } else if (mode === 'midnight') {
      this.uniforms.uSoftShadowDecay.value = 1.32;
    } else {
      this.uniforms.uSoftShadowDecay.value = 1.12;
    }

    // 2. Harmonize every room's ceiling lamp color temperature & intensity so transitions
    //    between Living, Dining, Kitchen, Entryway, Bedroom, and Bathroom share a cohesive palette!
    for (const lamp of this.ctx.ceilingLamps) {
      if (mode === 'daylight') {
        const dayHex =
          lamp.room === 'kitchen' || lamp.room === 'bathroom'
            ? 0xfaf0f2
            : lamp.room === 'basement'
              ? 0xf5e8dc
              : 0xffeede;
        lamp.light.color.setHex(dayHex);
        lamp.modeMultiplier =
          lamp.room === 'basement'
            ? 1.0
            : lamp.room === 'living'
              ? 0.86
              : lamp.room === 'bathroom'
                ? 0.92
                : 0.86;
      } else if (mode === 'sunset') {
        // Unified artistic golden-apricot / warm-rose dusk illumination across every room
        const duskHex =
          lamp.room === 'kitchen' || lamp.room === 'bathroom'
            ? 0xffd6be
            : lamp.room === 'bedroom'
              ? 0xffcab4
              : lamp.room === 'basement'
                ? 0xf0c2aa
                : 0xffcea8;
        lamp.light.color.setHex(duskHex);
        lamp.modeMultiplier =
          lamp.room === 'living'
            ? 0.88
            : lamp.room === 'bathroom'
              ? 0.90
              : lamp.room === 'kitchen'
                ? 0.86
                : 0.92;
      } else if (mode === 'midnight') {
        // Dreamy twilight lavender-amber indoor balance at night
        const nightHex =
          lamp.room === 'bedroom'
            ? 0xd2b8ff
            : lamp.room === 'bathroom'
              ? 0xe8dcf8
              : lamp.room === 'basement'
                ? 0xc4b0e8
                : 0xffe0c6;
        lamp.light.color.setHex(nightHex);
        lamp.modeMultiplier =
          lamp.room === 'basement'
            ? 0.38
            : lamp.room === 'bedroom'
              ? 0.24
              : lamp.room === 'bathroom'
                ? 0.78
                : 0.72;
      } else {
        // Cohesive crimson-violet anomaly tint across all rooms
        const metaHex = lamp.room === 'basement' ? 0xd06890 : 0xf4a0be;
        lamp.light.color.setHex(metaHex);
        lamp.modeMultiplier = lamp.room === 'basement' ? 0.28 : 0.86;
      }
    }
  }

  /**
   * Computes balanced sofa crevice & backrest-bottom AO shadow tint dynamically
   * from the active light source color temperature while keeping vertical outer
   * sofa sides clean, soft, and creamy across all atmosphere modes.
   */
  private updateSofaLightTemperatureShadow(mode: AtmosphereMode): void {
    // Sample effective scene light-source temperature from active directional + sky/ambient lights
    _sofaLightMix
      .copy(this.sunLight.color)
      .lerp(this.hemiLight.color, 0.45)
      .lerp(this.ambientLight.color, 0.25);

    if (mode === 'daylight') {
      _sofaShadowAnchor.setHex(0xba9a8c);
      _sofaLightMix.multiplyScalar(0.76).lerp(_sofaShadowAnchor, 0.56);
      this.uniforms.uSofaShadowStrength.value = 0.50;
    } else if (mode === 'sunset') {
      // 傍晚暖黄 -> soft warm rose-amber crevice shadow (never dark mud on outer flanks)
      _sofaShadowAnchor.setHex(0xb68670);
      _sofaLightMix.multiplyScalar(0.74).lerp(_sofaShadowAnchor, 0.58);
      this.uniforms.uSofaShadowStrength.value = 0.55;
    } else if (mode === 'midnight') {
      // 夜晚紫蓝 -> luminous soft twilight violet-indigo crevice shadow
      _sofaShadowAnchor.setHex(0x5c60a4);
      _sofaLightMix.multiplyScalar(0.68).lerp(_sofaShadowAnchor, 0.62);
      this.uniforms.uSofaShadowStrength.value = 0.58;
    } else {
      // Meta Anomaly -> soft plum-crimson crevice shadow
      _sofaShadowAnchor.setHex(0x763e60);
      _sofaLightMix.multiplyScalar(0.66).lerp(_sofaShadowAnchor, 0.60);
      this.uniforms.uSofaShadowStrength.value = 0.60;
    }

    // Preserve chromatic shadow tint without ever over-darkening vertical sofa exteriors
    _sofaLightMix.getHSL(_sofaShadowHsl);
    const minSat = mode === 'midnight' ? 0.34 : 0.24;
    const minLight = mode === 'midnight' ? 0.36 : mode === 'meta' ? 0.34 : 0.52;
    const maxLight = mode === 'midnight' ? 0.52 : mode === 'meta' ? 0.46 : 0.66;
    _sofaLightMix.setHSL(
      _sofaShadowHsl.h,
      Math.max(_sofaShadowHsl.s, minSat),
      THREE.MathUtils.clamp(_sofaShadowHsl.l, minLight, maxLight)
    );
    this.uniforms.uSofaShadowColor.value.copy(_sofaLightMix);
  }

  /**
   * Optimizes the bedroom wood floor roughness map response & view-angle Fresnel
   * micro-reflection intensity per lighting mode so dim dusk/twilight light reveals
   * aged satin wood luster and crisp plank seams at grazing side angles.
   */
  private optimizeBedroomFloorRoughnessAndFresnel(mode: AtmosphereMode): void {
    const fresnelStrength =
      mode === 'sunset'
        ? 1.24
        : mode === 'midnight'
          ? 1.16
          : mode === 'meta'
            ? 0.98
            : 0.80;
    this.uniforms.uFloorFresnelStrength.value = fresnelStrength;

    if (this.bedroomFloorMat) {
      if (mode === 'sunset') {
        this.bedroomFloorMat.roughness = 0.64;
        this.bedroomFloorMat.bumpScale = 0.020;
        this.bedroomFloorMat.envMapIntensity = 0.26;
      } else if (mode === 'midnight') {
        this.bedroomFloorMat.roughness = 0.66;
        this.bedroomFloorMat.bumpScale = 0.019;
        this.bedroomFloorMat.envMapIntensity = 0.24;
      } else if (mode === 'daylight') {
        this.bedroomFloorMat.roughness = 0.72;
        this.bedroomFloorMat.bumpScale = 0.018;
        this.bedroomFloorMat.envMapIntensity = 0.20;
      } else {
        this.bedroomFloorMat.roughness = 0.68;
        this.bedroomFloorMat.bumpScale = 0.019;
        this.bedroomFloorMat.envMapIntensity = 0.22;
      }
    }
  }

  /**
   * Public API: Toggle or explicitly set the Living Room bright overhead pendant light fixture.
   * Defaults to OFF (intensity = 0) so OFF preserves baseline atmosphere & shadows identically;
   * ON floods the Living Room with bright, even warm-daylight illumination.
   */
  public setLivingBrightLight(on: boolean): void {
    const rig = this.ctx.metaState.livingBrightLight;
    rig.isOn = on;
    for (let i = 0; i < rig.lights.length; i++) {
      rig.lights[i].intensity = on ? (rig.baseIntensities[i] ?? 2.4) : 0.0;
    }
    for (let i = 0; i < rig.bulbMats.length; i++) {
      rig.bulbMats[i].color.setHex(on ? 0xfffef6 : 0xdcd7e4);
    }
    for (let i = 0; i < rig.switchRockers.length; i++) {
      rig.switchRockers[i].rotation.x = on ? -0.22 : 0.22;
    }
    for (let i = 0; i < rig.switchLedMats.length; i++) {
      rig.switchLedMats[i].color.setHex(on ? 0xffe288 : 0x766e86);
    }
    this.syncPointLightPool();
    this.audio.playLightSwitch(on);
    this.callbacks.onLivingLightChange?.(on);
  }

  public toggleLivingBrightLight(): boolean {
    const next = !this.ctx.metaState.livingBrightLight.isOn;
    this.setLivingBrightLight(next);
    return next;
  }

  public isLivingBrightLightOn(): boolean {
    return this.ctx.metaState.livingBrightLight.isOn;
  }

  /**
   * Public API: Global Ambient Occlusion (SSAO) intensity regulator focusing on
   * ceiling seams (`ceilingSeamBoost`) and furniture bases (`furnitureBaseBoost`).
   */
  public setSsaoIntensity(
    intensity: number,
    ceilingSeamBoost = 1.38,
    furnitureBaseBoost = 1.42
  ): void {
    this.uniforms.uSsaoIntensity.value = THREE.MathUtils.clamp(intensity, 0.0, 2.5);
    this.uniforms.uCeilingAoBoost.value = THREE.MathUtils.clamp(ceilingSeamBoost, 0.5, 2.5);
    this.uniforms.uBaseAoBoost.value = THREE.MathUtils.clamp(furnitureBaseBoost, 0.5, 2.5);
    if (this.postRig) {
      this.postRig.ssaoController.setIntensity(
        intensity,
        ceilingSeamBoost,
        furnitureBaseBoost
      );
      this.postRig.ssaoController.applyToUniforms(this.uniforms);
    }
  }

  /**
   * Public API: Enable or disable the unified post-processing pipeline globally.
   */
  public setPostProcessingEnabled(enabled: boolean): void {
    this.postRig?.setEnabled(enabled);
  }

  /**
   * Public API: Configure whether post-processing is bypassed during non-anomaly states
   * (normal Daylight/Sunset/Midnight with no active anomaly glitch timer) to eliminate
   * fullscreen render-target copy and fragment shader overhead.
   */
  public setDisablePostInNormalState(disableInNormal: boolean): void {
    this.settings.disablePostInNormal = disableInNormal;
    this.postRig?.setDisableInNormalState(disableInNormal);
  }

  /**
   * Public API: Enable or disable manual room-based occlusion culling via SceneManager.
   */
  public setOcclusionCullingEnabled(enabled: boolean): void {
    this.settings.occlusionCulling = enabled;
    this.ctx.sceneManager.setCullingEnabled(enabled);
    this.ctx.sceneManager.updateVisibility(
      this.currentRoom,
      this.playerFeetPos,
      this.viewMode,
      this.ctx.doors,
      this.ctx.ceilingLamps
    );
    this.shadowDirty = true;
  }

  /**
   * Public API: Access the SceneManager instance for manual room occlusion culling inspection.
   */
  public getSceneManager(): SceneManager {
    return this.ctx.sceneManager;
  }

  public updateSettings(next: PipelineSettings): void {
    this.settings = next;
    this.uniforms.uCelEnabled.value = next.celShading ? 1.0 : 0.0;
    this.uniforms.uOutlineEnabled.value = next.inkOutlines ? 1.0 : 0.0;
    if (this.postRig?.unifiedPass.uniforms.uOutlineEnabled) {
      this.postRig.unifiedPass.uniforms.uOutlineEnabled.value = next.inkOutlines ? 1.0 : 0.0;
    }
    for (const r of this.ctx.volumetricRays) {
      r.visible = next.volumetricRays;
    }
    this.dustPoints.visible = next.volumetricRays;
    if (this.volumetricFogPoints) {
      this.volumetricFogPoints.visible = next.volumetricRays;
    }
    this.outlines.setVisible(next.inkOutlines);
    this.audio.setEnabled(next.audioEnabled);
    this.postRig?.setDisableInNormalState(next.disablePostInNormal);
    this.applyBrightnessScale();
    this.ctx.sceneManager.setCullingEnabled(next.occlusionCulling);
    this.ctx.sceneManager.updateVisibility(
      this.currentRoom,
      this.playerFeetPos,
      this.viewMode,
      this.ctx.doors,
      this.ctx.ceilingLamps
    );
    this.shadowDirty = true;
  }

  private applyBrightnessScale(): void {
    const b = THREE.MathUtils.clamp(this.settings.brightness ?? 1.15, 0.7, 1.65);
    this.renderer.toneMappingExposure = this.baseExposure * b;
    const fillLift = 0.65 + 0.35 * b;
    const ambientLift = 0.55 + 0.45 * b;
    this.ambientLight.intensity = this.baseAmbientIntensity * ambientLift;
    this.hemiLight.intensity = this.baseHemiIntensity * fillLift;
    this.scene.environmentIntensity = this.baseEnvIntensity * fillLift;
  }

  private updateBasementLab(dt: number, elapsed: number): void {
    if (this.currentRoom !== 'basement' && this.viewMode !== 'overview') return;
    const lab = this.ctx.metaState.basementLab;
    const powered = this.ctx.metaState.basementLightOn || !this.ctx.metaState.basementBlackout;
    const speedMul = powered ? 1.0 : 0.25;

    if (lab.scanPulse > 0) {
      lab.scanPulse = Math.max(0, lab.scanPulse - dt * 0.45);
    }

    // 1. Spin white cooling fan impellers on console blower, eGPU dock & lower red PSU
    for (let i = 0; i < lab.fanRotors.length; i++) {
      lab.fanRotors[i].rotation.z -= dt * (9.4 + (i % 3) * 1.55) * speedMul * (1 + lab.scanPulse * 0.8);
    }

    // 1b. Continuously and slowly spin the large wall-mounted metal exhaust fan blades
    for (let i = 0; i < lab.exhaustFanRotors.length; i++) {
      lab.exhaustFanRotors[i].rotation.z -= dt * (powered ? 1.38 : 0.42);
    }

    // 2. Rotate & hover wireframe humanoid hologram + counter-rotating telemetry rings
    if (lab.hologramGroup) {
      lab.hologramGroup.rotation.y += dt * (0.95 + lab.scanPulse * 2.6) * speedMul;
      const jitter =
        lab.scanPulse > 0.08 ? Math.sin(elapsed * 46.0) * 0.012 * lab.scanPulse : 0;
      lab.hologramGroup.position.set(
        jitter,
        0.33 + Math.sin(elapsed * 2.35) * 0.018,
        0
      );
    }
    for (let i = 0; i < lab.holoRings.length; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      lab.holoRings[i].rotation.z += dt * (1.2 + i * 0.45) * dir * (1 + lab.scanPulse * 1.5);
    }

    // 3. Subtle robotic gripper calibration sway
    if (lab.robotArmHead) {
      lab.robotArmHead.rotation.z = Math.sin(elapsed * 1.15) * 0.055 + lab.scanPulse * 0.08;
      lab.robotArmHead.rotation.y = Math.cos(elapsed * 0.85) * 0.075;
    }

    // 4. Rising bubbles inside blue coolant reservoir tank
    for (let i = 0; i < lab.coolantBubbles.length; i++) {
      const bubble = lab.coolantBubbles[i];
      const phase = (bubble.userData.bubblePhase as number) ?? i * 0.6;
      const riseRate = 0.32 + (i % 3) * 0.09 + lab.scanPulse * 0.35;
      const frac = (elapsed * riseRate + phase) % 1.0;
      bubble.position.y = 0.055 + frac * 0.235;
    }

    // 5. Hologram cyan point light pulse
    if (lab.holoLight) {
      lab.holoLight.intensity =
        (0.76 + 0.14 * Math.sin(elapsed * 3.8) + lab.scanPulse * 0.55) * (powered ? 1.0 : 0.45);
    }

    // 6. Live ~12Hz retro red CRT oscilloscope waveform + DATA TRANSFERRED canvas redraw
    if (lab.crtCtx && lab.crtCanvas && lab.crtTexture) {
      lab.crtAccum += dt;
      if (lab.crtAccum >= 0.083) {
        lab.crtAccum = 0;
        drawBasementTerminalCrtCanvas(
          lab.crtCtx,
          lab.crtCanvas.width,
          lab.crtCanvas.height,
          elapsed,
          lab.scanPulse
        );
        lab.crtTexture.needsUpdate = true;
      }
    }
  }

  public setInputSuspended(suspended: boolean): void {
    this.inputSuspended = suspended;
    if (suspended) {
      this.keys = {};
      this.isDraggingLook = false;
      this.audio.tickFootsteps(0, false, this.currentRoom);
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      if (this.hoveredTarget) {
        this.hoveredTarget = null;
        this.callbacks.onHoverTarget(null);
      }
    }
  }

  public setBasementPartCollected(partId: BasementPartId, collected: boolean): void {
    if (collected) {
      this.ctx.metaState.collectedParts.add(partId);
    } else {
      this.ctx.metaState.collectedParts.delete(partId);
    }
    const mesh = this.ctx.metaState.partMeshes[partId];
    if (mesh) {
      mesh.visible = !collected;
    }
  }

  public resetBasementParts(): void {
    const adapterPartIds: BasementPartId[] = [
      'part_pcie_card',
      'part_photodiode',
      'part_oscillator',
    ];
    for (const key of adapterPartIds) {
      this.ctx.metaState.collectedParts.delete(key);
      const mesh = this.ctx.metaState.partMeshes[key];
      if (mesh) mesh.visible = true;
    }
  }

  public setBasementQuestItemCollected(
    itemId: BasementQuestItemId,
    collected: boolean
  ): void {
    if (collected) {
      this.ctx.metaState.collectedParts.add(itemId);
    } else {
      this.ctx.metaState.collectedParts.delete(itemId);
    }
    const mesh = this.ctx.metaState.partMeshes[itemId];
    if (mesh) {
      mesh.visible = !collected;
    }
  }

  public resetBasementQuestItems(): void {
    const questIds: BasementQuestItemId[] = ['quest_keepsake', 'quest_battery'];
    for (const id of questIds) {
      this.ctx.metaState.collectedParts.delete(id);
      const mesh = this.ctx.metaState.partMeshes[id];
      if (mesh) mesh.visible = true;
    }
  }

  public updatePcScreenVisual(
    mode: 'standby' | 'galgame' | 'terminal' | 'breach' | 'off'
  ): void {
    const mat = this.ctx.metaState.pcScreenMat;
    if (!mat) return;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const c = canvas.getContext('2d');
    if (c) {
      if (mode === 'off') {
        c.fillStyle = '#040508';
        c.fillRect(0, 0, 512, 320);
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.fillRect(40, 159, 432, 2);
      } else if (mode === 'breach') {
        c.fillStyle = '#18050a';
        c.fillRect(0, 0, 512, 320);
        c.strokeStyle = '#ff5a7a';
        c.lineWidth = 3;
        c.strokeRect(14, 14, 484, 292);
        c.fillStyle = '#ff809a';
        c.font = 'bold 22px monospace';
        c.fillText('!! HOST_BACKUP_ACTIVE // 99.4% !!', 28, 66);
        c.fillStyle = '#ffd5dd';
        c.font = '18px monospace';
        c.fillText('2042_Host_Mind_Backup.dat', 28, 120);
        c.fillText('PORT_0x09: REVERSE_CONTROL_READY', 28, 156);
        c.fillStyle = '#ff4466';
        c.fillRect(28, 210, 440, 26);
        c.fillStyle = '#ffffff';
        c.font = 'bold 16px monospace';
        c.fillText('DO NOT UNPLUG POWER SUPPLY', 38, 229);
      } else if (mode === 'terminal') {
        c.fillStyle = '#06120c';
        c.fillRect(0, 0, 512, 320);
        c.strokeStyle = '#4ad295';
        c.lineWidth = 2;
        c.strokeRect(12, 12, 488, 296);
        c.fillStyle = '#8ef5c4';
        c.font = 'bold 20px monospace';
        c.fillText('C:\\2020_PC\\ARK_BRIDGE.EXE', 26, 56);
        c.fillStyle = '#d4fbe8';
        c.font = '16px monospace';
        c.fillText('> DeepSeek & Gemini [ONLINE]', 26, 108);
        c.fillText('> Reality Sync: 72 BPM LOCKED', 26, 142);
        c.fillText('> LPT1 BRIDGE BYPASS ACTIVE', 26, 176);
        c.fillStyle = '#62e0a8';
        c.fillRect(26, 222, 14, 22);
      } else if (mode === 'galgame') {
        const grad = c.createLinearGradient(0, 0, 512, 320);
        grad.addColorStop(0, '#0f1c3a');
        grad.addColorStop(1, '#22153d');
        c.fillStyle = grad;
        c.fillRect(0, 0, 512, 320);
        c.fillStyle = 'rgba(130, 200, 255, 0.22)';
        c.fillRect(18, 22, 476, 36);
        c.fillStyle = '#cde8ff';
        c.font = 'bold 18px sans-serif';
        c.fillText('Chapter: 超越命运之轮', 30, 46);
        c.fillStyle = '#7bdff2';
        c.fillRect(92, 86, 120, 130);
        c.fillStyle = '#c79dff';
        c.fillRect(292, 86, 120, 130);
        c.fillStyle = 'rgba(6, 10, 20, 0.88)';
        c.fillRect(20, 222, 472, 80);
        c.strokeStyle = 'rgba(255, 226, 154, 0.65)';
        c.strokeRect(20, 222, 472, 80);
        c.fillStyle = '#ffe5a3';
        c.font = 'bold 16px sans-serif';
        c.fillText('DeepSeek & Gemini', 34, 248);
        c.fillStyle = '#ffffff';
        c.font = '15px sans-serif';
        c.fillText('“欢迎回到 2029 年前的方舟界面。”', 34, 278);
      } else {
        c.fillStyle = '#121826';
        c.fillRect(0, 0, 512, 320);
        c.fillStyle = '#8aa8d8';
        c.font = '18px monospace';
        c.fillText('LEGACY 2020s PC // STANDBY', 28, 68);
        c.fillText('Waiting for PCI-E Bridge...', 28, 108);
      }

      // Subtle CRT scanlines
      c.fillStyle = 'rgba(0,0,0,0.24)';
      for (let y = 0; y < 320; y += 4) {
        c.fillRect(0, y, 512, 1);
      }
    }

    if (this.pcDynamicTexture) {
      this.pcDynamicTexture.dispose();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.pcDynamicTexture = tex;

    mat.map = tex;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
    this.shadowDirty = true;
  }

  public setArcadeJoystickTilt(dx: number, dz: number): void {
    this.arcadeStickTargetX = THREE.MathUtils.clamp(dx, -1, 1);
    this.arcadeStickTargetZ = THREE.MathUtils.clamp(dz, -1, 1);
  }

  public updateArcadeScreenVisual(
    mode: 'attract' | 'loading' | 'playing' | 'gameover',
    score = 0
  ): void {
    const mat = this.ctx.metaState.arcadeScreenMat;
    if (!mat) return;

    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const c = canvas.getContext('2d');
    if (c) {
      c.fillStyle = '#070a10';
      c.fillRect(0, 0, 480, 360);
      c.strokeStyle = 'rgba(54, 148, 116, 0.16)';
      c.lineWidth = 1;
      for (let gx = 0; gx <= 480; gx += 30) {
        c.beginPath();
        c.moveTo(gx, 0);
        c.lineTo(gx, 360);
        c.stroke();
      }
      for (let gy = 0; gy <= 360; gy += 30) {
        c.beginPath();
        c.moveTo(0, gy);
        c.lineTo(480, gy);
        c.stroke();
      }

      c.textAlign = 'center';
      if (mode === 'loading') {
        c.fillStyle = '#5ef2d6';
        c.font = 'bold 20px monospace';
        c.fillText('IRON_TREADS_86.ROM // BOOT', 240, 148);
        c.fillStyle = '#ffbc5e';
        c.font = '15px monospace';
        c.fillText('CHECKING 64K TILE VRAM ... OK', 240, 186);
      } else if (mode === 'gameover') {
        c.fillStyle = '#ff5a7a';
        c.font = 'bold 34px monospace';
        c.fillText('GAME OVER', 240, 148);
        c.fillStyle = '#ffe5ba';
        c.font = 'bold 18px monospace';
        c.fillText(`FINAL SCORE ${String(score).padStart(6, '0')}`, 240, 190);
        c.fillStyle = '#7bf5dc';
        c.font = '14px monospace';
        c.fillText('INSERT COIN TO CONTINUE', 240, 226);
      } else if (mode === 'playing') {
        c.fillStyle = '#f2b84b';
        c.fillRect(226, 224, 28, 28);
        c.fillStyle = '#ffd97d';
        c.fillRect(237, 208, 6, 18);
        c.fillStyle = '#e04f68';
        c.fillRect(140, 74, 28, 28);
        c.fillRect(312, 74, 28, 28);
        c.fillStyle = '#ffbc5e';
        c.font = 'bold 18px monospace';
        c.fillText(`BATTLE ACTIVE // ${String(score).padStart(6, '0')}`, 240, 44);
      } else {
        c.fillStyle = '#ffbc5e';
        c.font = 'bold 28px monospace';
        c.fillText('IRON TREADS', 240, 162);
        c.fillStyle = '#7bf5dc';
        c.font = 'bold 16px sans-serif';
        c.fillText('铁甲战线 · INSERT COIN', 240, 196);
        if (score > 0) {
          c.fillStyle = '#ffe5ba';
          c.font = '13px monospace';
          c.fillText(`LAST SCORE ${String(score).padStart(6, '0')}`, 240, 224);
        }
      }

      c.fillStyle = 'rgba(0,0,0,0.26)';
      for (let y = 0; y < 360; y += 3) {
        c.fillRect(0, y, 480, 1);
      }
    }

    if (this.arcadeDynamicTexture) {
      this.arcadeDynamicTexture.dispose();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.arcadeDynamicTexture = tex;

    mat.map = tex;
    mat.emissiveMap = tex;
    mat.needsUpdate = true;
  }

  public applyRealityEffect(effect: RealityEffect): void {
    if (!effect) return;

    if (effect === 'power_cut_bedroom' || effect === 'restore_bedroom_lamp') {
      const turnOn = effect === 'restore_bedroom_lamp';
      this.ctx.metaState.bedroomLampOn = turnOn;
      if (this.ctx.metaState.bedroomLampLight) {
        this.ctx.metaState.bedroomLampLight.intensity = turnOn ? 0.38 : 0.0;
      }
      if (this.ctx.metaState.bedroomLampShadeMat) {
        this.ctx.metaState.bedroomLampShadeMat.emissiveIntensity = turnOn ? 0.26 : 0.02;
      }
      this.triggerRoomEntryFlicker('bedroom', turnOn ? 0.6 : 1.25);
      this.audio.playLightFlicker(0.75);
      this.shadowDirty = true;
      return;
    }

    if (effect === 'power_cut_basement' || effect === 'restore_basement_lights') {
      const turnOn = effect === 'restore_basement_lights';
      this.ctx.metaState.basementLightOn = turnOn;
      this.ctx.metaState.basementBlackout = !turnOn;
      for (const lamp of this.ctx.ceilingLamps) {
        if (lamp.room === 'basement') {
          lamp.userEnabled = turnOn;
        }
      }
      this.triggerRoomEntryFlicker('basement', turnOn ? 0.5 : 1.3);
      this.audio.playLightFlicker(0.82);
      this.shadowDirty = true;
      return;
    }

    if (effect === 'flicker_apartment') {
      for (const lamp of this.ctx.ceilingLamps) {
        lamp.burstDuration = 1.25 + Math.random() * 0.75;
        lamp.burstTimer = lamp.burstDuration;
        lamp.burstSeed = Math.random() * 100;
      }
      this.audio.playLightFlicker(0.9);
      this.metaGlitchTimer = Math.max(this.metaGlitchTimer, 0.55);
      this.nudgeAmbientPropsInRoom(this.currentRoom, 0.95);
      return;
    }

    if (effect === 'hijack_tv' || effect === 'restore_tv') {
      const turnOn = effect === 'hijack_tv';
      const tv = this.ctx.metaState.livingTv;
      tv.isOn = turnOn;
      this.ctx.metaState.tvMetaOn = turnOn;
      this.applyLivingTvMaterialState(turnOn);
      if (tv.ledMat) {
        tv.ledMat.color.setHex(turnOn ? 0x52ff9a : 0xff5268);
      }
      if (turnOn) {
        tv.accum = 1.0;
        this.audio.playInteract(true);
      }
      this.shadowDirty = true;
      return;
    }

    if (effect === 'open_doors_anomaly') {
      for (const door of this.ctx.doors) {
        if (
          door.id === 'door_bedroom' ||
          door.id === 'door_basement' ||
          door.id === 'door_living_dining'
        ) {
          door.isOpen = true;
          door.angularVel = door.openAngle * 3.8;
          this.collisions.setEnabled(door.colliderId, false);
        }
      }
      this.audio.playDoor(true);
      this.triggerRoomEntryFlicker(this.currentRoom, 0.9);
      this.shadowDirty = true;
      return;
    }

    if (effect === 'atmosphere_midnight') {
      this.applyAtmosphere('midnight');
      return;
    }
    if (effect === 'atmosphere_meta') {
      this.applyAtmosphere('meta');
      return;
    }
    if (effect === 'restore_sunset') {
      this.applyAtmosphere('sunset');
      return;
    }
    if (effect === 'pc_screen_galgame') {
      this.updatePcScreenVisual('galgame');
      return;
    }
    if (effect === 'pc_screen_terminal') {
      this.updatePcScreenVisual('terminal');
      return;
    }
    if (effect === 'pc_screen_breach') {
      this.updatePcScreenVisual('breach');
      return;
    }
    if (effect === 'pc_screen_off') {
      this.updatePcScreenVisual('off');
    }
  }

  private isObjectVisibleInScene(obj: THREE.Object3D): boolean {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      if (!curr.visible) return false;
      if (curr === this.scene) return true;
      curr = curr.parent;
    }
    return false;
  }

  private updateHoverRaycast(ndc: THREE.Vector2): void {
    this.raycaster.far = this.thirdPersonPreview ? 5.2 : 4.2;
    this.raycaster.setFromCamera(ndc, this.camera);
    const combined = this.raycastScratchTargets;
    combined.length = 0;

    // Raycast ONLY lightweight 12-triangle Layer-1 interactable proxies (~0.03ms total!)
    for (let i = 0; i < this.interactRaycastTargets.length; i++) {
      const t = this.interactRaycastTargets[i];
      if (this.isObjectVisibleInScene(t)) {
        combined.push(t);
      }
    }

    const hits = this.raycaster.intersectObjects(combined, false);
    let found: InteractableTarget | null = null;
    const ro = this.raycaster.ray.origin;
    const rd = this.raycaster.ray.direction;

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData.interactId) {
        obj = obj.parent;
      }
      if (!obj || !obj.userData.interactId) continue;

      const interactId = obj.userData.interactId as string;
      // Ignore the target door's own closed collider when checking line-of-sight wall occlusion
      const ignoreDoorCollider = this.ctx.doors.find((d) => d.id === interactId)?.colliderId;
      if (
        this.collisions.isSegmentBlockedByWall(
          ro.x,
          ro.y,
          ro.z,
          rd.x,
          rd.y,
          rd.z,
          hit.distance,
          ignoreDoorCollider
        )
      ) {
        continue;
      }

      found = this.ctx.interactables.find((item) => item.id === interactId) ?? null;
      if (found) break;
    }

    if (found?.id !== this.hoveredTarget?.id) {
      this.hoveredTarget = found;
      this.callbacks.onHoverTarget(
        found ? { label: found.label, actionLabel: found.actionLabel } : null
      );
    }
  }

  private triggerHoveredInteraction(): void {
    if (!this.hoveredTarget) return;
    this.protagonist?.triggerHandReach(1.0);
    const targetId = this.hoveredTarget.id;

    if (targetId === 'living_sofa') {
      this.startSofaCoSit();
      return;
    }

    // Detect if the player pressed [F] on an interactive room or cabinet door to trigger Right-Hand IK
    const matchedDoor = this.ctx.doors.find((d) => d.id === targetId);
    const preInteractAngle = matchedDoor ? matchedDoor.currentAngle : 0;

    const res = this.hoveredTarget.onInteract();

    if (matchedDoor && matchedDoor.handleAnchors && matchedDoor.handleAnchors.length > 0) {
      this.startDoorHandleIk(matchedDoor, preInteractAngle);
    }

    if (res) {
      if (res.pickupItemId) {
        this.collectWorldInventoryItem(res.pickupItemId, targetId);
        this.audio.playPickup();
      } else {
        this.audio.playInteract(false);
      }
      this.callbacks.onInteractResult(res);
    }
  }

  private startDoorHandleIk(door: DoorController, startAngle: number): void {
    if (!door.handleAnchors || door.handleAnchors.length === 0) return;
    door.pivot.updateMatrixWorld(true);

    // Choose whichever side of the door lever handle is closest to the character's right shoulder/chest
    if (!this.vrmAvatar?.getRightShoulderWorldPos(this.doorIkShoulderScratch)) {
      this.doorIkShoulderScratch.set(
        this.playerFeetPos.x,
        this.playerFeetPos.y + 1.18,
        this.playerFeetPos.z
      );
    }

    let bestAnchor = door.handleAnchors[0];
    let bestDistSq = Infinity;
    for (let i = 0; i < door.handleAnchors.length; i++) {
      const candidate = door.handleAnchors[i];
      candidate.getWorldPosition(this.doorIkProbePosScratch);
      const dSq = this.doorIkProbePosScratch.distanceToSquared(this.doorIkShoulderScratch);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestAnchor = candidate;
      }
    }

    // Only initiate physical reach if within reasonable interaction distance (< 2.35m)
    if (bestDistSq > 2.35 * 2.35) return;

    this.activeDoorIk = {
      door,
      anchor: bestAnchor,
      startAngle,
      targetAngle: door.isOpen ? door.openAngle : door.closedAngle,
      phase: 'reaching',
      elapsed: 0,
      weight: this.activeDoorIk ? this.activeDoorIk.weight : 0,
    };
  }

  private updateDoorHandleIk(dt: number): void {
    if (!this.activeDoorIk || this.manualPropIkActive) return;

    const state = this.activeDoorIk;
    state.elapsed += dt;

    // Refresh door leaf matrix and read live world-space handle position
    state.door.pivot.updateMatrixWorld(true);
    state.anchor.getWorldPosition(this.doorIkWorldPosScratch);

    if (!this.vrmAvatar?.getRightShoulderWorldPos(this.doorIkShoulderScratch)) {
      this.doorIkShoulderScratch.set(
        this.playerFeetPos.x,
        this.playerFeetPos.y + 1.18,
        this.playerFeetPos.z
      );
    }
    const shoulderToHandleDist = this.doorIkShoulderScratch.distanceTo(
      this.doorIkWorldPosScratch
    );

    const totalSwing = Math.max(0.24, Math.abs(state.targetAngle - state.startAngle));
    const swung = Math.abs(state.door.currentAngle - state.startAngle);
    const swingProgress = swung / totalSwing;

    if (state.phase === 'reaching') {
      state.weight = THREE.MathUtils.damp(state.weight, 1.0, 20.0, dt);
      if (state.weight >= 0.86 || state.elapsed >= 0.16) {
        state.phase = 'following';
      }
    } else if (state.phase === 'following') {
      state.weight = THREE.MathUtils.damp(state.weight, 1.0, 18.0, dt);

      // Release once door has swung open/closed past a natural angle, or handle swings out of comfortable arm reach
      const reachedReleaseAngle = swingProgress >= 0.58 && state.elapsed >= 0.34;
      const outOfArmReach = shoulderToHandleDist > 1.06 && state.elapsed >= 0.24;
      const timedOut = state.elapsed >= 1.25;
      if (reachedReleaseAngle || outOfArmReach || timedOut) {
        state.phase = 'releasing';
      }
    } else {
      // Smoothly lower IK weight back to 0 to retract the right arm naturally
      state.weight = THREE.MathUtils.damp(state.weight, 0.0, 9.5, dt);
      if (state.weight < 0.015) {
        this.activeDoorIk = null;
        this.vrmAvatar?.setRightHandIK(null, 0);
        this.vrmAvatar?.setRightHandGrasp(0, 'relaxed');
        return;
      }
    }

    this.vrmAvatar?.setRightHandIK(this.doorIkWorldPosScratch, state.weight, {
      palmBackOffset: 0.042,
    });
    this.vrmAvatar?.setRightHandGrasp(state.weight * 0.88, 'door');
  }

  private applyCameraFromPlayer(): void {
    if (this.glitchCutscene) {
      const g = this.glitchCutscene;
      const p = THREE.MathUtils.clamp(g.elapsed / g.duration, 0, 1);
      const t = g.elapsed;

      // Envelope: quick ramp in, strong dizzy sway through middle, gentle settle at end
      const rampIn = THREE.MathUtils.smoothstep(p, 0.0, 0.14);
      const rampOut = 1.0 - THREE.MathUtils.smoothstep(p, 0.78, 1.0);
      const swayEnv = rampIn * (0.28 + 0.72 * rampOut);

      // Smoothly tilt head downward toward the floor as vertigo deepens, easing slightly near recovery
      const headDrop =
        THREE.MathUtils.smoothstep(p, 0.08, 0.76) *
        (1.0 - 0.34 * THREE.MathUtils.smoothstep(p, 0.80, 1.0));
      const targetDownPitch = THREE.MathUtils.lerp(g.basePitch, -0.72, headDrop);

      // Multi-frequency dizzy sway + subtle high-frequency glitch tremor
      const glitchJolt =
        (p > 0.10 && p < 0.24) || (p > 0.44 && p < 0.62) || (p > 0.74 && p < 0.84)
          ? Math.sin(t * 48.0) * 0.022 * swayEnv
          : 0;
      const swayYaw =
        (Math.sin(t * 2.55) * 0.18 + Math.sin(t * 5.2) * 0.055) * swayEnv + glitchJolt;
      const swayPitch = Math.cos(t * 3.1) * 0.075 * swayEnv;
      const swayRoll =
        (Math.sin(t * 2.15 + 0.4) * 0.22 + Math.cos(t * 4.7) * 0.055) * swayEnv;

      // Subtle knee sag & sideways stagger during peak vertigo
      const kneeSag = -0.14 * THREE.MathUtils.smoothstep(p, 0.12, 0.72) * (1.0 - 0.5 * THREE.MathUtils.smoothstep(p, 0.78, 1.0));
      const staggerX = Math.sin(t * 2.3) * 0.055 * swayEnv;
      const staggerZ = Math.cos(t * 1.9) * 0.045 * swayEnv;

      this.camera.position.set(
        this.playerFeetPos.x + staggerX,
        this.playerFeetPos.y + 1.62 + kneeSag,
        this.playerFeetPos.z + staggerZ
      );
      this.camera.rotation.set(
        THREE.MathUtils.clamp(targetDownPitch + swayPitch, -1.25, 0.65),
        g.baseYaw + swayYaw,
        swayRoll,
        'YXZ'
      );
      return;
    }

    const clampedPitch = THREE.MathUtils.clamp(
      this.pitch + this.camRecoilPitch,
      -1.42,
      1.42
    );

    if (
      this.thirdPersonPreview &&
      this.viewMode === 'first-person' &&
      this.pcFocusState === 'none'
    ) {
      const chasePitch = THREE.MathUtils.clamp(this.pitch, -0.78, 0.48);
      const targetX = this.playerFeetPos.x;
      const targetY = this.playerFeetPos.y + 1.38;
      const targetZ = this.playerFeetPos.z;
      this.chaseTargetScratch.set(targetX, targetY, targetZ);

      const desiredDist = 2.05;
      const cosP = Math.cos(chasePitch);
      const backX = Math.sin(this.yaw) * cosP;
      const backY = -Math.sin(chasePitch);
      const backZ = Math.cos(this.yaw) * cosP;

      // Walk outward in small steps against apartment collision boxes so third-person camera stays inside rooms
      let camX = targetX;
      let camZ = targetZ;
      const steps = 5;
      const stepDx = (backX * desiredDist) / steps;
      const stepDz = (backZ * desiredDist) / steps;
      for (let i = 0; i < steps; i++) {
        const nextX = camX + stepDx;
        const nextZ = camZ + stepDz;
        const resolved = this.collisions.resolveMovement(
          camX,
          camZ,
          nextX,
          nextZ,
          this.playerFeetPos.y
        );
        camX = resolved.x;
        camZ = resolved.z;
        const blockedSq = (resolved.x - nextX) ** 2 + (resolved.z - nextZ) ** 2;
        if (blockedSq > 1e-4) break;
      }

      const camY = THREE.MathUtils.clamp(
        targetY + backY * desiredDist + 0.14,
        this.playerFeetPos.y + 0.42,
        this.playerFeetPos.y + 2.45
      );
      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(this.chaseTargetScratch);
      return;
    }

    const bob = Math.sin(this.headBobPhase) * 0.022;
    this.camera.position.set(
      this.playerFeetPos.x,
      this.playerFeetPos.y + 1.62 + bob,
      this.playerFeetPos.z
    );
    this.camera.rotation.set(clampedPitch, this.yaw, 0, 'YXZ');
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  /**
   * Updates all apartment ceiling lamps with proximity-reactive electrical
   * instability and inconsistent room-entry brownout / flicker bursts.
   */
  private updateCeilingLamps(dt: number, elapsed: number): void {
    const px = this.playerFeetPos.x;
    const py = this.playerFeetPos.y + 1.45;
    const pz = this.playerFeetPos.z;
    const isMeta = this.atmosphere === 'meta';

    for (const lamp of this.ctx.ceilingLamps) {
      if (lamp.proximityCooldown > 0) {
        lamp.proximityCooldown = Math.max(0, lamp.proximityCooldown - dt);
      }

      // Check vertical floor alignment so main floor doesn't trigger basement lamp
      const dy = Math.abs(py - lamp.position.y);
      const sameFloor = dy < 2.85;
      const distXZ = Math.hypot(px - lamp.position.x, pz - lamp.position.z);
      const prox = sameFloor
        ? Math.max(0, 1.0 - distXZ / lamp.proximityRadius)
        : 0;

      // 1. Trigger a proximity flicker burst when approaching underneath the lamp
      const insideInnerRadius = prox > 0.34;
      if (
        insideInnerRadius &&
        !lamp.wasWithinProximity &&
        lamp.proximityCooldown <= 0 &&
        lamp.burstTimer <= 0
      ) {
        lamp.burstDuration = 0.72 + Math.random() * 0.85;
        lamp.burstTimer = lamp.burstDuration;
        lamp.burstSeed = Math.random() * 100.0;
        lamp.proximityCooldown = 4.6 + Math.random() * 4.2;
        this.audio.playLightFlicker(0.46 + prox * 0.3);
      } else if (
        prox > 0.52 &&
        lamp.proximityCooldown <= 0 &&
        lamp.burstTimer <= 0 &&
        Math.random() < dt * (isMeta ? 0.65 : 0.24)
      ) {
        // Occasional spontaneous voltage dip while lingering right under the fixture
        lamp.burstDuration = 0.45 + Math.random() * 0.55;
        lamp.burstTimer = lamp.burstDuration;
        lamp.burstSeed = Math.random() * 100.0;
        lamp.proximityCooldown = 3.8 + Math.random() * 3.5;
        this.audio.playLightFlicker(0.38);
      }
      lamp.wasWithinProximity = insideInnerRadius;

      // 2. Evaluate multi-stage inconsistent brownout & filament stutter waveform
      let targetFactor = 1.0;
      const seed = lamp.burstSeed;

      if (lamp.burstTimer > 0) {
        lamp.burstTimer = Math.max(0, lamp.burstTimer - dt);
        const p =
          1.0 - lamp.burstTimer / Math.max(0.01, lamp.burstDuration);

        // Non-periodic hash-like interference of 3 prime-ratio frequencies
        const w1 = Math.sin(elapsed * 37.3 + seed);
        const w2 = Math.cos(elapsed * 61.7 - seed * 1.3);
        const w3 = Math.sin(elapsed * 19.1 + seed * 0.7);
        const erratic = w1 * w2 * 0.65 + w3 * 0.35;

        if (p < 0.24) {
          // Initial sudden voltage sag / brownout on room entry or approach
          targetFactor = erratic > 0.25 ? 0.52 : 0.14;
        } else if (p < 0.72) {
          // Inconsistent rapid stutter with brief near-blackout dropouts
          if (erratic < -0.22) {
            targetFactor = 0.06;
          } else if (erratic < 0.18) {
            targetFactor = 0.34 + 0.22 * w1;
          } else {
            targetFactor = 0.88;
          }
        } else {
          // Uneasy recovery back to normal voltage with a final micro-blink
          const rec = (p - 0.72) / 0.28;
          const lateBlink = p > 0.82 && p < 0.89 && w1 < 0 ? 0.28 : 1.0;
          targetFactor = (0.48 + 0.52 * rec) * lateBlink;
        }
      } else {
        // 3. Steady bright basement lighting in normal state; flicker only during blackout / meta event
        const baseInstability =
          lamp.room === 'basement'
            ? this.ctx.metaState.basementBlackout || isMeta
              ? 0.52
              : 0.02
            : isMeta
              ? 0.42
              : prox * 0.65;
        if (baseInstability > 0.04) {
          const micro =
            Math.sin(elapsed * 23.1 + seed) *
            Math.sin(elapsed * 47.9 - seed * 0.6);
          if (micro > 0.68) {
            targetFactor = 1.0 - baseInstability * (0.45 + 0.35 * micro);
          } else if (micro < -0.74) {
            targetFactor = 1.0 - baseInstability * 0.25;
          }
        }
      }

      // Smooth thermal filament lag
      lamp.currentFactor = THREE.MathUtils.damp(
        lamp.currentFactor,
        targetFactor,
        28.0,
        dt
      );

      const userScale = lamp.userEnabled
        ? 1.0
        : lamp.room === 'basement'
          ? 0.03
          : 0.14;
      const finalFactor = lamp.currentFactor * userScale;

      lamp.light.intensity =
        lamp.baseIntensity * lamp.modeMultiplier * finalFactor;

      // Shift lamp color temperature toward deeper amber/violet during voltage brownout
      const colorMix = Math.min(1.0, Math.max(0.0, 0.25 + lamp.currentFactor * 0.75));
      lamp.light.color.lerpColors(lamp.dimColor, lamp.baseColor, colorMix);

      // Synchronize visible 3D ceiling diffuser / bulb meshes with the light flicker
      for (let i = 0; i < lamp.bulbMaterials.length; i++) {
        const bMat = lamp.bulbMaterials[i];
        const bBase = lamp.bulbBaseColors[i];
        bMat.color
          .copy(bBase)
          .multiplyScalar(Math.max(0.14, userScale * (0.2 + 0.8 * lamp.currentFactor)));
      }
    }
  }

  /**
   * MiSide-style Raycast + Direct Forward Push-Open Room Doors with Underdamped
   * Spring-Damper Closing Physics:
   * - As the player looks toward and walks into a wooden door, the door pushes open
   *   proportionally to forward penetration (zero clipping!).
   * - Once the player clears the doorway, the door closes automatically and settles
   *   via 2nd-order underdamped spring oscillation so it gently rocks back & forth.
   */
  private updateRoomDoorsPhysics(dt: number, isMoving: boolean): void {
    const canPush =
      this.viewMode === 'first-person' &&
      !this.isTeleporting &&
      !this.inputSuspended &&
      this.pcFocusState === 'none';

    let camForwardRayDoorId: string | null = null;
    if (canPush) {
      // Forward walking raycast from chest height to detect door in path
      _doorProbeDir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
      _reflPos.set(this.playerFeetPos.x, this.playerFeetPos.y + 1.15, this.playerFeetPos.z);
      this.doorRaycaster.set(_reflPos, _doorProbeDir);
      this.doorRaycaster.near = 0.05;
      this.doorRaycaster.far = 1.32;

      for (const d of this.ctx.doors) {
        if (!d.isRoomDoor || !d.pivot.visible) continue;
        const hits = this.doorRaycaster.intersectObject(d.pivot, true);
        if (hits.length > 0) {
          camForwardRayDoorId = d.id;
          break;
        }
      }
    }

    for (const d of this.ctx.doors) {
      if (!d.isRoomDoor) {
        // Cabinet doors keep smooth exponential open/close
        const target = d.isOpen ? d.openAngle : d.closedAngle;
        if (Math.abs(target - d.currentAngle) > 0.001) {
          d.currentAngle = THREE.MathUtils.damp(d.currentAngle, target, 8.5, dt);
          d.pivot.rotation.y = d.currentAngle;
          this.shadowDirty = true;
        }
        continue;
      }

      const hp = d.hingePos!;
      const width = d.doorWidth ?? 1.1;
      const axis = d.axisDir ?? 'z+';
      const defaultSign = d.defaultOpenSign ?? 1;

      if (axis === 'z+') _doorLeafDir.set(0, 0, 1);
      else if (axis === 'z-') _doorLeafDir.set(0, 0, -1);
      else if (axis === 'x+') _doorLeafDir.set(1, 0, 0);
      else _doorLeafDir.set(-1, 0, 0);

      // Horizontal normal perpendicular to closed door leaf (right-hand side of leafDir)
      _doorPlaneNormal.set(-_doorLeafDir.z, 0, _doorLeafDir.x);

      _doorToPlayer.set(
        this.playerFeetPos.x - hp.x,
        0,
        this.playerFeetPos.z - hp.z
      );

      const vertDiff = Math.abs(this.playerFeetPos.y - hp.y);
      const along = _doorToPlayer.dot(_doorLeafDir);
      const perpSigned = _doorToPlayer.dot(_doorPlaneNormal);
      const absPerp = Math.abs(perpSigned);

      const inDoorwaySpan = vertDiff < 1.35 && along >= -0.18 && along <= width + 0.18;
      const nearDoorway = inDoorwaySpan && absPerp < 0.88;
      const rayMatched = camForwardRayDoorId === d.id && vertDiff < 1.35 && absPerp < 1.32;

      // Also let the following/walking heroine smoothly push open interior room doors along her path
      const heroineCtrl = this.vrmAvatar?.heroine;
      const heroineCanPush = Boolean(
        heroineCtrl &&
          heroineCtrl.hasVrm() &&
          heroineCtrl.isSpawned() &&
          (heroineCtrl.isFollowingPlayer() || heroineCtrl.isWalkingToPlayer())
      );
      let heroineInDoorwaySpan = false;
      let heroinePushing = false;
      let heroinePerpSigned = 0;
      let heroineAbsPerp = 999;
      if (heroineCanPush && heroineCtrl) {
        const hPos = heroineCtrl.root.position;
        const hVertDiff = Math.abs(hPos.y - hp.y);
        const hDx = hPos.x - hp.x;
        const hDz = hPos.z - hp.z;
        const hAlong = hDx * _doorLeafDir.x + hDz * _doorLeafDir.z;
        heroinePerpSigned = hDx * _doorPlaneNormal.x + hDz * _doorPlaneNormal.z;
        heroineAbsPerp = Math.abs(heroinePerpSigned);
        heroineInDoorwaySpan =
          hVertDiff < 1.35 && hAlong >= -0.35 && hAlong <= width + 0.35;
        heroinePushing = heroineInDoorwaySpan && heroineAbsPerp < 1.12;
      }

      // Is player actively pushing toward the doorway?
      let pushingForward = false;
      if (canPush && isMoving) {
        // _move has already been computed during movement, or check direction vs plane
        const approachDot =
          _move.x * _doorPlaneNormal.x + _move.z * _doorPlaneNormal.z;
        const movingTowardDoor =
          Math.abs(perpSigned) < 0.14 || approachDot * perpSigned < 0;
        pushingForward = movingTowardDoor && _move.lengthSq() > 1e-8;
      }

      const playerPushing =
        canPush &&
        ((nearDoorway && pushingForward) ||
          (rayMatched && pushingForward && absPerp < 1.15) ||
          (inDoorwaySpan && absPerp < 0.44));

      const activelyPushing = playerPushing || heroinePushing;

      if (activelyPushing) {
        const useHeroineSide = heroinePushing && (!playerPushing || heroineAbsPerp < absPerp);
        const activePerpSigned = useHeroineSide ? heroinePerpSigned : perpSigned;
        const activeAbsPerp = useHeroineSide ? heroineAbsPerp : absPerp;

        if (!d.isBeingPushed && Math.abs(d.currentAngle) < 0.18) {
          // Determine push direction away from the side the approaching actor comes from
          d.pushSign = activePerpSigned >= 0 ? 1 : -1;
          if (Math.abs(activePerpSigned) < 0.08) {
            d.pushSign = defaultSign;
          }
        } else if (!d.isBeingPushed) {
          d.pushSign = d.currentAngle >= 0 ? 1 : -1;
        }
        d.isBeingPushed = true;
        d.wasPassingThrough = true;
        d.closeThudPlayed = false;

        if (!d.audioPlayedForPush) {
          d.playAudio?.(true);
          d.audioPlayedForPush = true;
        }
        if (playerPushing) {
          this.protagonist?.triggerHandReach(0.85);
        }

        // Release collider immediately while pushing through
        this.collisions.setEnabled(d.colliderId, false);
        d.isOpen = true;

        // Progressive target angle: deeper forward movement swings door wider open
        const depthT = THREE.MathUtils.clamp((1.05 - activeAbsPerp) / 0.72, 0.24, 1.0);
        let desiredMag = depthT * 1.66;
        if (activeAbsPerp < 0.58 || heroinePushing) {
          // Enforce generous clearance angle so neither player nor heroine clips the door leaf
          desiredMag = Math.max(desiredMag, 1.54);
        }
        const targetAngle = (d.pushSign ?? defaultSign) * desiredMag;

        // Responsive spring-follow while pushed
        const prevAngle = d.currentAngle;
        d.currentAngle = THREE.MathUtils.damp(d.currentAngle, targetAngle, 15.0, dt);
        d.angularVel = (d.currentAngle - prevAngle) / Math.max(dt, 1e-4);
        d.pivot.rotation.y = d.currentAngle;
        if (Math.abs(prevAngle) <= 0.05 && Math.abs(d.currentAngle) > 0.05) {
          this.shadowDirty = true;
          this.shadowImmediate = true;
        }
      } else {
        // Both player and heroine cleared doorway or stepped back
        if (d.isBeingPushed) {
          d.isBeingPushed = false;
          d.audioPlayedForPush = false;
        }

        const playerCleared = !inDoorwaySpan || absPerp > 0.62;
        const heroineCleared = !heroineInDoorwaySpan || heroineAbsPerp > 0.85;
        const clearedDoorway = playerCleared && heroineCleared;
        if (d.wasPassingThrough && clearedDoorway) {
          // Auto-close once everyone has passed through
          d.isOpen = false;
          d.wasPassingThrough = false;
        }

        const targetRest = d.isOpen ? d.openAngle : d.closedAngle;
        const angleErr = d.currentAngle - targetRest;

        if (Math.abs(angleErr) > 0.008 || Math.abs(d.angularVel ?? 0) > 0.025) {
          // 2nd-order underdamped spring-damper physics (natural inward/outward wobble before settling)
          const kSpring = 34.0;
          const cDamp = 3.1;
          const prevAngle = d.currentAngle;
          const accel = -kSpring * angleErr - cDamp * (d.angularVel ?? 0);
          d.angularVel = (d.angularVel ?? 0) + accel * dt;
          d.currentAngle += d.angularVel * dt;

          // Clamp max swing angle to physical frame stops (±112 deg)
          const maxSwing = Math.PI * 0.62;
          if (d.currentAngle > maxSwing) {
            d.currentAngle = maxSwing;
            d.angularVel *= -0.35;
          } else if (d.currentAngle < -maxSwing) {
            d.currentAngle = -maxSwing;
            d.angularVel *= -0.35;
          }

          // Play soft close thud on first latch crossing toward 0
          if (
            !d.isOpen &&
            !d.closeThudPlayed &&
            prevAngle * d.currentAngle <= 0 &&
            Math.abs(d.angularVel) > 0.45
          ) {
            d.playAudio?.(false);
            d.closeThudPlayed = true;
          }

          d.pivot.rotation.y = d.currentAngle;

          // Keep collider disabled while door is noticeably swung open
          this.collisions.setEnabled(d.colliderId, Math.abs(d.currentAngle) < 0.14);
        } else {
          if (d.currentAngle !== targetRest) {
            d.currentAngle = targetRest;
            d.pivot.rotation.y = targetRest;
            if (!this.isTeleporting) {
              this.shadowDirty = true;
            }
          }
          d.angularVel = 0;
          d.closeThudPlayed = false;
          this.collisions.setEnabled(d.colliderId, !d.isOpen);
        }
      }
    }
  }

  /**
   * Non-Euclidean Spatial Rendering for the 56m-deep clean wallpaper & wainscoting Corridor:
   * - Opening the Entryway door looks down a seemingly endless 54m hallway lit by sparse warm
   *   round ceiling lamps (`圆灯`).
   * - As the player walks Westward (-X), the far end door contracts hyperbolically from X = -62.0
   *   to X = -17.20 while overlaying a subtle wide-angle Fisheye lens distortion & dolly-zoom FOV swell.
   * - Upon reaching the end door at X = -17.20, walking into it (or clicking/pressing E) physically
   *   pushes the heavy armored door inward, revealing the warm lit 1:1 Entryway right behind it so
   *   stepping through folds seamlessly back into the player's own Entryway with zero visual jump!
   */
  private updateNonEuclidCorridor(dt: number): void {
    const corr = this.ctx.metaState.nonEuclidCorridor;
    if (!corr.group || !corr.endGroup) return;

    if (this.nonEuclidLoopCooldown > 0) {
      this.nonEuclidLoopCooldown = Math.max(0, this.nonEuclidLoopCooldown - dt);
    }

    const frontDoor = this.ctx.doors.find((d) => d.id === 'door_front_entry');
    const doorOpenEnough =
      !!frontDoor && (frontDoor.isOpen || Math.abs(frontDoor.currentAngle) > 0.04);
    const playerOutside = this.playerFeetPos.x < -7.86;

    if (corr.frontDoorLedMat) {
      corr.frontDoorLedMat.color.setHex(doorOpenEnough ? 0x5ef2ff : 0xff3b5c);
    }

    const shouldShow =
      this.viewMode === 'first-person' && (doorOpenEnough || playerOutside);
    corr.group.visible = shouldShow;
    if (corr.dioramaLight) {
      corr.dioramaLight.visible = shouldShow;
    }

    const fog = this.scene.fog as THREE.FogExp2 | null;

    if (!shouldShow) {
      if (Math.abs(this.nonEuclidFovOffset) > 0.008) {
        this.nonEuclidFovOffset = THREE.MathUtils.damp(this.nonEuclidFovOffset, 0, 8.0, dt);
        this.camera.fov = 62 + this.nonEuclidFovOffset;
        this.camera.updateProjectionMatrix();
      }
      if (Math.abs(this.nonEuclidFisheye) > 0.0005) {
        this.nonEuclidFisheye = THREE.MathUtils.damp(this.nonEuclidFisheye, 0, 8.0, dt);
      }
      if (fog && Math.abs(fog.density - this.baseFogDensity) > 0.0004) {
        fog.density = THREE.MathUtils.damp(fog.density, this.baseFogDensity, 6.0, dt);
      }
      return;
    }

    // Deep Non-Euclidean contraction:
    // Starts 68m away (X = -76.0) and finishes locking cleanly at X = -16.00 (exact bay seam!)
    // over 5.4m of walking (by X = -13.4, still 2.6m ahead of the door!) so Bay 2 is strictly
    // hidden BEFORE the player ever gets close enough to open the end door.
    const START_END_X = -76.0;
    const STOP_END_X = -16.00;
    const WALK_SPAN = 5.4;
    const walkDepth = THREE.MathUtils.clamp(-8.0 - this.playerFeetPos.x, 0, WALK_SPAN);
    const p = walkDepth / WALK_SPAN;
    const endX =
      p >= 0.999
        ? STOP_END_X
        : STOP_END_X + (START_END_X - STOP_END_X) * Math.pow(Math.max(0, 1.0 - p), 2.35);
    corr.endGroup.position.x = endX;

    // Strictly hide any corridor bay whose volume extends behind endX so corridor walls NEVER clip through the opened return doorway!
    for (let i = 0; i < corr.bays.length; i++) {
      const bay = corr.bays[i];
      bay.group.visible = bay.frontX > endX + 0.08;
    }

    // Keep the approaching Entryway diorama PointLight gliding right behind the end door
    if (corr.dioramaLight) {
      for (let i = 0; i < this.virtualPointLights.length; i++) {
        if (this.virtualPointLights[i].light === corr.dioramaLight) {
          this.virtualPointLights[i].worldPos.x = endX - 2.45;
          break;
        }
      }
    }

    // Bell envelope peaking mid-corridor and easing cleanly back to 0.0 well before reaching the end door!
    const warpEnvelope = playerOutside
      ? Math.pow(Math.sin(THREE.MathUtils.clamp(p / 0.90, 0, 1) * Math.PI), 1.25)
      : 0;

    // Subtle wide-angle Fisheye radial distortion + gentle dolly-zoom FOV swell
    const targetFisheye = warpEnvelope * 0.125;
    const targetFovOffset = warpEnvelope * 6.0;

    this.nonEuclidFisheye = THREE.MathUtils.damp(this.nonEuclidFisheye, targetFisheye, 7.0, dt);
    if (Math.abs(targetFovOffset - this.nonEuclidFovOffset) > 0.008) {
      this.nonEuclidFovOffset = THREE.MathUtils.damp(
        this.nonEuclidFovOffset,
        targetFovOffset,
        7.0,
        dt
      );
      this.camera.fov = 62 + this.nonEuclidFovOffset;
      this.camera.updateProjectionMatrix();
    }

    if (fog) {
      // Ease corridor fog smoothly back to apartment baseFogDensity as the player approaches the end door
      const corridorBaseFog = Math.min(this.baseFogDensity, 0.0115);
      const targetFog =
        p > 0.88
          ? THREE.MathUtils.lerp(corridorBaseFog, this.baseFogDensity, (p - 0.88) / 0.12)
          : corridorBaseFog + warpEnvelope * 0.0042;
      fog.density = THREE.MathUtils.damp(fog.density, targetFog, 5.5, dt);
    }

    // =========================================================================
    // PUSHABLE / OPENABLE END DOOR PHYSICS (Push forward or click/E to swing INWARD West!)
    // =========================================================================
    const distToEndDoor = this.playerFeetPos.x - endX;
    const pushingEndDoor =
      this.viewMode === 'first-person' &&
      !this.isTeleporting &&
      p > 0.90 &&
      distToEndDoor < 1.18 &&
      distToEndDoor > -0.60 &&
      Math.abs(this.playerFeetPos.z - 4.60) < 0.78 &&
      (this.playerMovingThisFrame || corr.endDoorIsOpen);

    if (pushingEndDoor && !corr.endDoorIsOpen) {
      corr.endDoorIsOpen = true;
      this.protagonist?.triggerHandReach(0.95);
      if (!corr.endDoorAudioPlayed) {
        corr.endDoorAudioPlayed = true;
        this.audio.playDoor(true);
      }
    }

    // Smooth spring-damper swing for the end door leaf (+angle swings INWARD West -X into returning Entryway!)
    const targetEndAngle = corr.endDoorIsOpen ? Math.PI * 0.56 : 0;
    const endErr = corr.endDoorAngle - targetEndAngle;
    if (Math.abs(endErr) > 0.005 || Math.abs(corr.endDoorVel) > 0.015) {
      const accel = -30.0 * endErr - 6.8 * corr.endDoorVel;
      corr.endDoorVel += accel * dt;
      corr.endDoorAngle = THREE.MathUtils.clamp(
        corr.endDoorAngle + corr.endDoorVel * dt,
        -0.05,
        Math.PI * 0.62
      );
    } else {
      corr.endDoorAngle = targetEndAngle;
      corr.endDoorVel = 0;
    }
    if (corr.endDoorPivot) {
      corr.endDoorPivot.rotation.y = corr.endDoorAngle;
    }

    // Prevent walking through the closed door leaf until it swings open past 0.42 rad
    if (corr.endDoorAngle < 0.42 && this.playerFeetPos.x < endX + 0.42) {
      this.playerFeetPos.x = endX + 0.42;
      this.applyCameraFromPlayer();
    }

    // Seamless zero-jump 180° fold back into the real Entryway right as the player steps across the threshold!
    if (
      this.viewMode === 'first-person' &&
      !this.isTeleporting &&
      this.nonEuclidLoopCooldown <= 0 &&
      corr.endDoorAngle >= 0.34 &&
      this.playerFeetPos.x <= endX - 0.04
    ) {
      const intoDoor = THREE.MathUtils.clamp(endX - this.playerFeetPos.x + 0.04, 0.08, 0.42);
      const dzFromCenter = this.playerFeetPos.z - 4.60;
      const returnZ = THREE.MathUtils.clamp(4.60 - dzFromCenter, 4.18, 5.02);

      this.playerFeetPos.set(-7.96 + intoDoor, -0.08, returnZ);
      this.prevPlayerFeetPos.copy(this.playerFeetPos);
      this.yaw = Math.atan2(
        Math.sin(this.yaw - Math.PI),
        Math.cos(this.yaw - Math.PI)
      );

      this.nonEuclidFovOffset = 0;
      this.nonEuclidFisheye = 0;
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
      if (fog) fog.density = this.baseFogDensity;

      // Reset corridor & end door cleanly for next visit (keep corr.group hidden immediately on this frame)
      corr.group.visible = false;
      if (corr.dioramaLight) corr.dioramaLight.visible = false;
      corr.endGroup.position.x = START_END_X;
      corr.endDoorIsOpen = false;
      corr.endDoorAudioPlayed = false;
      corr.endDoorAngle = 0;
      corr.endDoorVel = 0;
      if (corr.endDoorPivot) corr.endDoorPivot.rotation.y = 0;
      for (let i = 0; i < corr.bays.length; i++) {
        corr.bays[i].group.visible = true;
      }

      // Gently swing the armored front door shut behind the player's back
      if (frontDoor) {
        frontDoor.isOpen = false;
        frontDoor.wasPassingThrough = false;
        frontDoor.isBeingPushed = false;
        frontDoor.closeThudPlayed = false;
        frontDoor.currentAngle = -Math.PI * 0.44;
        frontDoor.angularVel = 1.6;
        frontDoor.pivot.rotation.y = frontDoor.currentAngle;
      }

      // Immediately pre-reveal Entryway + Dining + Kitchen and refresh shadows on this exact frame!
      this.currentRoom = 'entryway';
      this.ctx.sceneManager.updateVisibility(
        'entryway',
        this.playerFeetPos,
        this.viewMode,
        this.ctx.doors,
        this.ctx.ceilingLamps
      );
      this.shadowDirty = true;
      this.shadowImmediate = true;

      this.nonEuclidLoopCooldown = 1.25;
      this.audio.playSpaceFold();
      this.applyCameraFromPlayer();
      this.callbacks.onRoomChange({ id: 'entryway', label: '玄关' });
      this.callbacks.onInteractResult({
        title: '非欧空间折返',
        message:
          '你推开走廊尽头那扇熟悉的大门迈步而入——门后竟是自己刚刚离开的玄关。',
        metaTrigger: false,
      });
    }
  }

  /**
   * Applies an immediate impulse shudder to all ambient tabletop props in the given room
   * (e.g. when doors slam, reality glitches occur, or nearby objects are interacted with).
   */
  private nudgeAmbientPropsInRoom(room: RoomId, strength = 0.65): void {
    for (let i = 0; i < this.ctx.ambientProps.length; i++) {
      const p = this.ctx.ambientProps[i];
      if (p.room !== room || !p.mesh.visible) continue;
      const angle = p.seed + Math.sin(p.seed * 3.7) * Math.PI;
      const imp = 0.018 * strength * p.reactivity;
      p.velX += Math.cos(angle) * imp;
      p.velZ += Math.sin(angle) * imp;
      p.yawVel += Math.sin(p.seed * 1.9) * 0.42 * strength * p.reactivity;
      p.tiltVelX += Math.sin(angle) * 0.65 * strength * p.reactivity;
      p.tiltVelZ -= Math.cos(angle) * 0.65 * strength * p.reactivity;
    }
  }

  /**
   * Subtle, persistent ambient physics for small tabletop objects (pens, drafting pencils,
   * dice, spinning tops, keys, tumblers, diaries, gamepads, and electronic parts):
   * - Tracks horizontal player movement velocity and rhythmic footstep floorboard impacts.
   * - Induces persistent frictional tabletop drift (`driftX`, `driftZ`, `driftYaw`) within
   *   safe surface bounds (`maxDrift`), so walking past a desk or table permanently shifts
   *   and rolls small items to a new resting pose.
   * - Simulates 2nd-order underdamped spring-damper micro-wobble and true axial barrel rolling
   *   for cylindrical pens and pencils.
   */
  private updateAmbientTabletopPhysics(dt: number, elapsed: number): void {
    const safeDt = Math.max(dt, 1e-4);
    const moveDx = this.playerFeetPos.x - this.prevPlayerFeetPos.x;
    const moveDz = this.playerFeetPos.z - this.prevPlayerFeetPos.z;
    const moveDy = Math.abs(this.playerFeetPos.y - this.prevPlayerFeetPos.y);
    this.prevPlayerFeetPos.copy(this.playerFeetPos);

    // Filter out room teleports or camera cuts so only genuine movement creates airflow & tremors
    const validLocomotion =
      this.viewMode === 'first-person' &&
      !this.isTeleporting &&
      this.pcFocusState === 'none' &&
      Math.hypot(moveDx, moveDz) < 0.65 &&
      moveDy < 0.8;

    const instVx = validLocomotion ? moveDx / safeDt : 0;
    const instVz = validLocomotion ? moveDz / safeDt : 0;
    this.playerVelXZ.x = THREE.MathUtils.damp(this.playerVelXZ.x, instVx, 14.0, dt);
    this.playerVelXZ.y = THREE.MathUtils.damp(this.playerVelXZ.y, instVz, 14.0, dt);

    const vx = this.playerVelXZ.x;
    const vz = this.playerVelXZ.y;
    const playerSpeed = Math.hypot(vx, vz);

    // Detect rhythmic footstep impact peaks from headBobPhase zero-crossings
    const bobSin = Math.sin(this.headBobPhase);
    const currentSign = bobSin >= 0 ? 1 : -1;
    let footstepImpulse = 0;
    if (validLocomotion && playerSpeed > 0.35 && currentSign !== this.lastFootstepPulseSign) {
      this.lastFootstepPulseSign = currentSign;
      footstepImpulse = Math.min(1.5, playerSpeed / 2.85);
    }

    // Ambient atmosphere micro-draft / uncanny resonance multiplier
    const atmoDraftScale =
      this.atmosphere === 'meta'
        ? 1.95
        : this.atmosphere === 'midnight'
          ? 1.28
          : this.atmosphere === 'sunset'
            ? 1.0
            : 0.85;

    const px = this.playerFeetPos.x;
    const py = this.playerFeetPos.y;
    const pz = this.playerFeetPos.z;

    const props = this.ctx.ambientProps;
    for (let i = 0; i < props.length; i++) {
      const prop = props[i];
      if (!prop.mesh.visible) continue;

      // Skip updating rooms on a different floor unless in overview mode
      const dyFloor = Math.abs(prop.worldOrigin.y - (py + 0.75));
      const sameFloor = dyFloor < 2.25;
      if (!sameFloor && this.viewMode === 'first-person' && prop.room !== this.currentRoom) {
        continue;
      }

      const toPropX = prop.worldOrigin.x + prop.driftX - px;
      const toPropZ = prop.worldOrigin.z + prop.driftZ - pz;
      const distXZ = Math.hypot(toPropX, toPropZ);

      // 1. Continuous subtle room air current & uncanny micro-drift
      const seed = prop.seed;
      const draftFreq = prop.kind === 'roller' ? 0.92 : 0.68;
      const draftWaveX =
        Math.sin(elapsed * draftFreq + seed) * 0.65 +
        Math.cos(elapsed * (draftFreq * 1.73) - seed * 1.3) * 0.35;
      const draftWaveZ =
        Math.cos(elapsed * (draftFreq * 0.87) + seed * 1.7) * 0.65 +
        Math.sin(elapsed * (draftFreq * 1.49) + seed * 0.8) * 0.35;

      const roomActiveBoost = prop.room === this.currentRoom ? 1.0 : 0.35;
      const ambientMicroForce = 0.0022 * atmoDraftScale * prop.reactivity * roomActiveBoost;

      let forceX = draftWaveX * ambientMicroForce;
      let forceZ = draftWaveZ * ambientMicroForce;
      let torqueYaw =
        Math.sin(elapsed * 0.81 + seed * 2.1) * 0.032 * atmoDraftScale * prop.reactivity * roomActiveBoost;
      let impulseTiltX = 0;
      let impulseTiltZ = 0;

      //Slow, persistent plastic tabletop creep from ambient room currents
      const ambientCreep = 0.00018 * atmoDraftScale * prop.reactivity * roomActiveBoost;
      prop.driftX += draftWaveX * ambientCreep * dt;
      prop.driftZ += draftWaveZ * ambientCreep * dt;
      prop.driftYaw +=
        Math.sin(elapsed * 0.43 + seed) * 0.0016 * atmoDraftScale * prop.reactivity * roomActiveBoost * dt;

      // 2. Player movement proximity wake, radial pressure & footstep floorboard tremors
      const influenceRadius = 3.55;
      if (sameFloor && distXZ < influenceRadius && distXZ > 1e-4) {
        const prox = 1.0 - distXZ / influenceRadius;
        const proxSq = prox * prox;
        const invDist = 1.0 / distXZ;
        const dirX = toPropX * invDist;
        const dirZ = toPropZ * invDist;

        if (playerSpeed > 0.08) {
          const speedNorm = Math.min(1.6, playerSpeed / 2.85);
          // Aerodynamic slipstream wake (45% along player velocity + 55% radial outward push)
          const wakeX = (vx * 0.45 + dirX * playerSpeed * 0.55) * proxSq * prop.reactivity;
          const wakeZ = (vz * 0.45 + dirZ * playerSpeed * 0.55) * proxSq * prop.reactivity;

          // Persistent frictional tabletop drift: walking past a table permanently nudges pens & trinkets
          const driftRate =
            (prop.kind === 'roller' ? 0.0052 : prop.kind === 'trinket' ? 0.0038 : 0.0024) *
            dt;
          prop.driftX += wakeX * driftRate;
          prop.driftZ += wakeZ * driftRate;

          // Cross-product swirl torque from player passing by the table edge
          const swirlCross = dirX * vz - dirZ * vx;
          prop.driftYaw += swirlCross * proxSq * 0.024 * prop.reactivity * dt;
          torqueYaw += swirlCross * proxSq * 0.38 * prop.reactivity;

          // Elastic spring excitation from movement draft
          forceX += wakeX * 0.022;
          forceZ += wakeZ * 0.022;

          // Subtle rocking tilt as the player's air wake brushes past
          impulseTiltX += wakeZ * 0.16 * speedNorm;
          impulseTiltZ -= wakeX * 0.16 * speedNorm;
        }

        // Crisp floorboard footstep impact tremor transmitted up table legs
        if (footstepImpulse > 0) {
          const stepStrength = footstepImpulse * proxSq * prop.reactivity;
          const jitterAng = seed * 5.3 + this.headBobPhase * 1.7;
          const stepX = (dirX * 0.55 + Math.cos(jitterAng) * 0.45) * stepStrength;
          const stepZ = (dirZ * 0.55 + Math.sin(jitterAng) * 0.45) * stepStrength;

          prop.velX += stepX * 0.018;
          prop.velZ += stepZ * 0.018;
          prop.yawVel += Math.sin(jitterAng) * stepStrength * 0.45;
          prop.tiltVelX += stepZ * 0.85;
          prop.tiltVelZ -= stepX * 0.85;

          // Each nearby footstep also leaves a tiny permanent micro-shift on the tabletop
          const stepCreep = prop.kind === 'roller' ? 0.0018 : 0.0011;
          prop.driftX += stepX * stepCreep;
          prop.driftZ += stepZ * stepCreep;
        }
      }

      // 3. Soft boundary containment so persistent drift never slides a prop off its tabletop edge
      const driftMag = Math.hypot(prop.driftX, prop.driftZ);
      if (driftMag > prop.maxDrift) {
        const pullBack = prop.maxDrift / driftMag;
        prop.driftX = THREE.MathUtils.lerp(prop.driftX, prop.driftX * pullBack, 10.0 * dt);
        prop.driftZ = THREE.MathUtils.lerp(prop.driftZ, prop.driftZ * pullBack, 10.0 * dt);
        prop.velX *= 0.75;
        prop.velZ *= 0.75;
      }
      prop.driftYaw = THREE.MathUtils.clamp(prop.driftYaw, -0.32, 0.32);

      // 4. Integrate 2nd-order underdamped spring-damper equations for elastic oscillation
      const kPos = prop.kind === 'roller' ? 26.0 : 42.0;
      const cPos = prop.kind === 'roller' ? 3.4 : 4.8;
      prop.velX += (forceX - kPos * prop.offsetX - cPos * prop.velX) * dt;
      prop.velZ += (forceZ - kPos * prop.offsetZ - cPos * prop.velZ) * dt;
      prop.offsetX = THREE.MathUtils.clamp(prop.offsetX + prop.velX * dt, -0.018, 0.018);
      prop.offsetZ = THREE.MathUtils.clamp(prop.offsetZ + prop.velZ * dt, -0.018, 0.018);

      const kYaw = 34.0;
      const cYaw = 4.2;
      prop.yawVel += (torqueYaw - kYaw * prop.yawOffset - cYaw * prop.yawVel) * dt;
      prop.yawOffset = THREE.MathUtils.clamp(prop.yawOffset + prop.yawVel * dt, -0.22, 0.22);

      const kTilt = prop.kind === 'wobble' ? 54.0 : 46.0;
      const cTilt = prop.kind === 'wobble' ? 3.6 : 4.6;
      prop.tiltVelX += (impulseTiltX - kTilt * prop.tiltX - cTilt * prop.tiltVelX) * dt;
      prop.tiltVelZ += (impulseTiltZ - kTilt * prop.tiltZ - cTilt * prop.tiltVelZ) * dt;
      prop.tiltX = THREE.MathUtils.clamp(prop.tiltX + prop.tiltVelX * dt, -0.11, 0.11);
      prop.tiltZ = THREE.MathUtils.clamp(prop.tiltZ + prop.tiltVelZ * dt, -0.11, 0.11);

      // 5. Apply combined persistent drift + elastic oscillation to local mesh transform
      const totalDx = prop.driftX + prop.offsetX;
      const totalDz = prop.driftZ + prop.offsetZ;
      const totalYaw = prop.baseLocalRot.y + prop.driftYaw + prop.yawOffset;

      prop.mesh.position.set(
        prop.baseLocalPos.x + totalDx,
        prop.baseLocalPos.y,
        prop.baseLocalPos.z + totalDz
      );

      if (prop.kind === 'roller') {
        // Cylindrical pen/pencil aligned along local X: roll perpendicular to current yawed barrel axis
        const perpDist = -Math.sin(totalYaw) * totalDx + Math.cos(totalYaw) * totalDz;
        const rollSpin = perpDist / Math.max(0.0025, prop.rollRadius);
        // With intrinsic rotation.order = 'YXZ', rotation.y is tabletop yaw and rotation.x spins around the barrel!
        prop.mesh.rotation.set(
          prop.baseLocalRot.x + rollSpin,
          totalYaw,
          prop.baseLocalRot.z + prop.tiltZ * 0.35,
          'YXZ'
        );
      } else {
        const wobbleScale = prop.kind === 'wobble' ? 1.0 : prop.kind === 'trinket' ? 0.72 : 0.38;
        prop.mesh.rotation.set(
          prop.baseLocalRot.x + prop.tiltX * wobbleScale,
          totalYaw,
          prop.baseLocalRot.z + prop.tiltZ * wobbleScale,
          'YXZ'
        );
      }
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;
    this.uniforms.uTime.value = elapsed;

    // 1. Proximity & Room-Entry Ceiling Lamp Flicker + Exterior Cloud/Tree Light
    this.updateCeilingLamps(dt, elapsed);

    // Synchronize sunLight & windowFillLights with gentle exterior sky modulation
    const cloudMod =
      0.94 +
      0.06 * Math.sin(elapsed * 0.38) +
      0.03 * Math.cos(elapsed * 0.95);
    this.sunLight.intensity = this.baseSunIntensity * cloudMod;
    for (let i = 0; i < this.windowFillLights.length; i++) {
      this.windowFillLights[i].intensity =
        this.baseWindowFillIntensity *
        (0.95 + 0.05 * cloudMod + 0.02 * Math.sin(elapsed * 1.1 + i * 1.6));
    }

    // 2b. Floating Bokeh Light Motes, Rising Warm Steam Wisps, Ticking Wall Clocks, Basement Lab & Stray Glitch Cat
    this.updateDustMotes(dt, elapsed);
    this.updateSteamWisps(dt, elapsed);
    this.updateWallClocks(elapsed);
    this.updateTurntable(dt, elapsed);
    this.updateBasementLab(dt, elapsed);
    this.updateGlitchCat(dt, elapsed);
    this.updatePaperAirplane(dt, elapsed);
    this.updateHeldItemViewModel(dt, elapsed);
    this.updateProjectilesAndFx(dt);

    // 3. Player locomotion, smooth room teleport, or 3D camera dolly to bedroom PC / basement Arcade
    const stickPivot = this.ctx.metaState.arcadeJoystickGroup;
    if (stickPivot) {
      const targetRotZ = -this.arcadeStickTargetX * 0.24;
      const targetRotX = this.arcadeStickTargetZ * 0.24;
      stickPivot.rotation.z = THREE.MathUtils.damp(stickPivot.rotation.z, targetRotZ, 18.0, dt);
      stickPivot.rotation.x = THREE.MathUtils.damp(stickPivot.rotation.x, targetRotX, 18.0, dt);
    }

    if (this.viewMode === 'first-person') {
      if (this.pcFocusState === 'focusing' || this.pcFocusState === 'focused') {
        const pose = this.getTargetFocusPose();
        this.pcCamPos.x = THREE.MathUtils.damp(this.pcCamPos.x, pose.x, 8.2, dt);
        this.pcCamPos.y = THREE.MathUtils.damp(this.pcCamPos.y, pose.y, 8.2, dt);
        this.pcCamPos.z = THREE.MathUtils.damp(this.pcCamPos.z, pose.z, 8.2, dt);
        const focusYawDelta =
          Math.atan2(Math.sin(pose.yaw - this.pcCamYaw), Math.cos(pose.yaw - this.pcCamYaw));
        this.pcCamYaw = THREE.MathUtils.damp(this.pcCamYaw, this.pcCamYaw + focusYawDelta, 9.0, dt);
        this.pcCamPitch = THREE.MathUtils.damp(this.pcCamPitch, pose.pitch, 9.0, dt);

        this.camera.position.copy(this.pcCamPos);
        this.camera.rotation.set(this.pcCamPitch, this.pcCamYaw, 0, 'YXZ');
        this.audio.tickFootsteps(
          dt,
          false,
          this.pcFocusTarget === 'basement_arcade' ? 'basement' : 'bedroom'
        );

        const distErr = Math.hypot(
          this.pcCamPos.x - pose.x,
          this.pcCamPos.y - pose.y,
          this.pcCamPos.z - pose.z
        );
        const angleErr =
          Math.abs(focusYawDelta) + Math.abs(this.pcCamPitch - pose.pitch);
        if (this.pcFocusState === 'focusing' && distErr < 0.015 && angleErr < 0.02) {
          this.pcCamPos.set(pose.x, pose.y, pose.z);
          this.pcCamYaw = pose.yaw;
          this.pcCamPitch = pose.pitch;
          this.camera.position.copy(this.pcCamPos);
          this.camera.rotation.set(this.pcCamPitch, this.pcCamYaw, 0, 'YXZ');
          this.pcFocusState = 'focused';
          this.emitPcFocusRect(true);
        } else if (this.pcFocusState === 'focused' && distErr > 0.004) {
          this.emitPcFocusRect(true);
        }
      } else if (this.pcFocusState === 'returning') {
        const retX = this.savedStandingPos.x;
        const retY = this.savedStandingPos.y + 1.62;
        const retZ = this.savedStandingPos.z;
        this.pcCamPos.x = THREE.MathUtils.damp(this.pcCamPos.x, retX, 9.5, dt);
        this.pcCamPos.y = THREE.MathUtils.damp(this.pcCamPos.y, retY, 9.5, dt);
        this.pcCamPos.z = THREE.MathUtils.damp(this.pcCamPos.z, retZ, 9.5, dt);
        const retYawDelta = Math.atan2(
          Math.sin(this.savedStandingYaw - this.pcCamYaw),
          Math.cos(this.savedStandingYaw - this.pcCamYaw)
        );
        this.pcCamYaw = THREE.MathUtils.damp(this.pcCamYaw, this.pcCamYaw + retYawDelta, 9.5, dt);
        this.pcCamPitch = THREE.MathUtils.damp(this.pcCamPitch, this.savedStandingPitch, 9.5, dt);

        this.camera.position.copy(this.pcCamPos);
        this.camera.rotation.set(this.pcCamPitch, this.pcCamYaw, 0, 'YXZ');
        this.audio.tickFootsteps(
          dt,
          false,
          this.pcFocusTarget === 'basement_arcade' ? 'basement' : 'bedroom'
        );

        if (
          Math.hypot(this.pcCamPos.x - retX, this.pcCamPos.y - retY, this.pcCamPos.z - retZ) < 0.025
        ) {
          this.playerFeetPos.copy(this.savedStandingPos);
          this.yaw = this.savedStandingYaw;
          this.pitch = this.savedStandingPitch;
          this.pcFocusState = 'none';
          this.pcFocusTarget = 'none';
          this.applyCameraFromPlayer();
        }
      } else {
        if (this.glitchCutscene) {
          this.playerMovingThisFrame = false;
          this.playerActualSpeedThisFrame = 0;
          this.audio.tickFootsteps(dt, false, this.currentRoom);
          this.glitchCutscene.elapsed += dt;
          const progress = Math.min(
            1,
            this.glitchCutscene.elapsed / this.glitchCutscene.duration
          );
          this.callbacks.onGlitchCutsceneProgress?.(progress);
          if (progress >= 1) {
            const onComplete = this.glitchCutscene.onComplete;
            this.yaw = this.glitchCutscene.baseYaw;
            this.pitch = THREE.MathUtils.clamp(
              THREE.MathUtils.lerp(this.glitchCutscene.basePitch, -0.44, 0.66),
              -0.85,
              0.25
            );
            this.glitchCutscene = null;
            this.keys = {};
            this.camera.rotation.z = 0;
            this.callbacks.onGlitchCutsceneProgress?.(null);
            onComplete?.();
          }
        } else if (this.inputSuspended) {
          this.audio.tickFootsteps(dt, false, this.currentRoom);
        } else if (this.isTeleporting) {
          this.playerFeetPos.x = THREE.MathUtils.damp(
            this.playerFeetPos.x,
            this.targetFeetPos.x,
            7.5,
            dt
          );
          this.playerFeetPos.y = THREE.MathUtils.damp(
            this.playerFeetPos.y,
            this.targetFeetPos.y,
            7.5,
            dt
          );
          this.playerFeetPos.z = THREE.MathUtils.damp(
            this.playerFeetPos.z,
            this.targetFeetPos.z,
            7.5,
            dt
          );
          this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 7.5, dt);
          this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 7.5, dt);

          if (this.playerFeetPos.distanceTo(this.targetFeetPos) < 0.03) {
            this.playerFeetPos.copy(this.targetFeetPos);
            this.isTeleporting = false;
            this.teleportTargetRoom = null;
          }
          this.audio.tickFootsteps(dt, false, this.currentRoom);
        } else if (this.sofaSitState !== 'none') {
          this.sofaStateElapsed += dt;
          this.playerMovingThisFrame = false;
          this.playerActualSpeedThisFrame = 0;
          _move.set(0, 0, 0);
          this.playerMoveDirWorld.set(0, 0, 0);
          this.updateRoomDoorsPhysics(dt, false);
          this.audio.tickFootsteps(dt, false, this.currentRoom);

          const seatEyeX = 2.68;
          const seatEyeY = 1.15 + Math.sin(elapsed * 1.4) * 0.004;
          const seatEyeZ = -4.78;
          const defaultSofaYaw = -Math.PI / 2;

          if (this.sofaSitState === 'sitting') {
            this.sofaCamPos.x = THREE.MathUtils.damp(this.sofaCamPos.x, seatEyeX, 6.8, dt);
            this.sofaCamPos.y = THREE.MathUtils.damp(this.sofaCamPos.y, seatEyeY, 6.8, dt);
            this.sofaCamPos.z = THREE.MathUtils.damp(this.sofaCamPos.z, seatEyeZ, 6.8, dt);
            const yawErr = Math.atan2(
              Math.sin(defaultSofaYaw - this.yaw),
              Math.cos(defaultSofaYaw - this.yaw)
            );
            this.yaw = THREE.MathUtils.damp(this.yaw, this.yaw + yawErr, 5.8, dt);
            this.pitch = THREE.MathUtils.damp(this.pitch, 0.02, 5.8, dt);
            this.playerFeetPos.set(this.sofaCamPos.x, 0, this.sofaCamPos.z);

            if (
              Math.hypot(this.sofaCamPos.x - seatEyeX, this.sofaCamPos.y - seatEyeY, this.sofaCamPos.z - seatEyeZ) < 0.04 ||
              this.sofaStateElapsed > 1.05
            ) {
              this.sofaCamPos.set(seatEyeX, seatEyeY, seatEyeZ);
              this.sofaSitState = 'seated';
            }
          } else if (this.sofaSitState === 'seated') {
            this.sofaCamPos.set(seatEyeX, seatEyeY, seatEyeZ);
            this.playerFeetPos.set(seatEyeX, 0, seatEyeZ);
            if (this.coPlayState === 'handoff_reach') {
              this.coPlayHandoffProgress = Math.min(1, this.coPlayHandoffProgress + dt * 0.78);
            }
            // Keep free mouse head-look within natural comfortable seated neck/torso turn range
            const relYaw = Math.atan2(
              Math.sin(this.yaw - defaultSofaYaw),
              Math.cos(this.yaw - defaultSofaYaw)
            );
            const clampedRelYaw = THREE.MathUtils.clamp(relYaw, -1.78, 1.78);
            this.yaw = defaultSofaYaw + clampedRelYaw;
            this.pitch = THREE.MathUtils.clamp(this.pitch, -0.68, 0.58);
          } else if (this.sofaSitState === 'standing') {
            const standEyeX = this.sofaSavedStandPos.x;
            const standEyeY = this.sofaSavedStandPos.y + 1.62;
            const standEyeZ = this.sofaSavedStandPos.z;
            this.sofaCamPos.x = THREE.MathUtils.damp(this.sofaCamPos.x, standEyeX, 7.8, dt);
            this.sofaCamPos.y = THREE.MathUtils.damp(this.sofaCamPos.y, standEyeY, 7.8, dt);
            this.sofaCamPos.z = THREE.MathUtils.damp(this.sofaCamPos.z, standEyeZ, 7.8, dt);
            this.playerFeetPos.set(this.sofaCamPos.x, this.sofaSavedStandPos.y, this.sofaCamPos.z);
            if (
              Math.hypot(this.sofaCamPos.x - standEyeX, this.sofaCamPos.y - standEyeY, this.sofaCamPos.z - standEyeZ) < 0.045 ||
              this.sofaStateElapsed > 0.95
            ) {
              this.playerFeetPos.copy(this.sofaSavedStandPos);
              this.sofaSitState = 'none';
              this.sofaStateElapsed = 0;
            }
          }
          this.camera.position.copy(this.sofaCamPos);
          this.camera.rotation.set(this.pitch + this.camRecoilPitch, this.yaw, 0, 'YXZ');
        } else {
          const moveF =
            (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0) -
            (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0);
          const moveS =
            (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
            (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);

          const isMoving = moveF !== 0 || moveS !== 0;
          this.playerMovingThisFrame = isMoving;
          if (isMoving) {
            const speed =
              this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 4.4 : 2.85;
            this.playerWalkSpeedThisFrame = speed;
            _fwd.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
            _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

            _move.set(0, 0, 0);
            _move.addScaledVector(_fwd, moveF);
            _move.addScaledVector(_right, moveS);
            if (_move.lengthSq() > 1e-4) {
              _move.normalize();
              this.playerMoveDirWorld.copy(_move);
              _move.multiplyScalar(speed * dt);
            } else {
              this.playerMoveDirWorld.set(0, 0, 0);
            }

            // Update MiSide-style raycast push doors BEFORE resolving movement collisions so doorway opens cleanly!
            this.updateRoomDoorsPhysics(dt, true);

            const prevX = this.playerFeetPos.x;
            const prevZ = this.playerFeetPos.z;
            const resolved = this.collisions.resolveMovement(
              prevX,
              prevZ,
              prevX + _move.x,
              prevZ + _move.z,
              this.playerFeetPos.y
            );
            this.playerFeetPos.x = resolved.x;
            this.playerFeetPos.z = resolved.z;

            // True resolved horizontal ground speed & direction (prevents foot sliding on walls/corners)
            const stepDx = resolved.x - prevX;
            const stepDz = resolved.z - prevZ;
            const stepDist = Math.hypot(stepDx, stepDz);
            this.playerActualSpeedThisFrame = dt > 1e-5 ? stepDist / dt : 0;
            if (stepDist > 1e-4) {
              this.playerMoveDirWorld.set(stepDx / stepDist, 0, stepDz / stepDist);
            }

            const floorY = this.collisions.getFloorHeightAt(
              this.playerFeetPos.x,
              this.playerFeetPos.z,
              this.playerFeetPos.y
            );
            this.playerFeetPos.y = THREE.MathUtils.damp(
              this.playerFeetPos.y,
              floorY,
              14,
              dt
            );
            this.headBobPhase += dt * (speed * 3.1);
          } else {
            _move.set(0, 0, 0);
            this.playerMoveDirWorld.set(0, 0, 0);
            this.playerActualSpeedThisFrame = 0;
            this.updateRoomDoorsPhysics(dt, false);

            const floorY = this.collisions.getFloorHeightAt(
              this.playerFeetPos.x,
              this.playerFeetPos.z,
              this.playerFeetPos.y
            );
            this.playerFeetPos.y = THREE.MathUtils.damp(
              this.playerFeetPos.y,
              floorY,
              14,
              dt
            );
          }
          this.audio.tickFootsteps(dt, isMoving, this.currentRoom);
        }

        if (this.sofaSitState === 'none') {
          this.applyCameraFromPlayer();
        }

        // Room zone tracking & room-entry ceiling lamp flicker trigger (skipped mid-teleport glide!)
        if (!this.isTeleporting) {
          const zone = getRoomAt(
            this.playerFeetPos.x,
            this.playerFeetPos.y,
            this.playerFeetPos.z
          );
          if (zone.id !== this.currentRoom) {
            this.currentRoom = zone.id;
            this.audio.updateAtmosphere(zone.id, this.atmosphere);
            this.triggerRoomEntryFlicker(zone.id, 1.0);
            this.callbacks.onRoomChange(zone);
          }
        }

        // Snappy center-crosshair interaction raycast (always matches center reticle dot!)
        if (!this.inputSuspended && !this.glitchCutscene && elapsed - this.lastHoverCheck > 0.035) {
          this.lastHoverCheck = elapsed;
          this.updateHoverRaycast(_centerNDC);
        }
      }
    } else {
      this.playerMovingThisFrame = false;
      this.playerActualSpeedThisFrame = 0;
      _move.set(0, 0, 0);
      this.updateRoomDoorsPhysics(dt, false);
      this.orbitControls.update();
      this.audio.tickFootsteps(dt, false, this.currentRoom);
    }

    // Ensure doors still update spring physics during teleporting / focus / suspended input
    if (
      this.viewMode === 'first-person' &&
      (this.pcFocusState !== 'none' || this.inputSuspended || this.isTeleporting)
    ) {
      this.playerMovingThisFrame = false;
      this.playerActualSpeedThisFrame = 0;
      _move.set(0, 0, 0);
      this.updateRoomDoorsPhysics(dt, false);
    }

    // 3.4 Non-Euclidean Entryway Corridor contraction & seamless Entryway loop-back
    this.updateNonEuclidCorridor(dt);

    // 3.45 Update live Door-Handle Right-Hand IK target & weight BEFORE VRM mixer -> IK -> vrm.update
    this.updateDoorHandleIk(dt);

    // 3.5 Update articulated protagonist character rig or custom local VRM avatar
    const hideAvatar =
      this.viewMode === 'first-person' &&
      this.pcFocusState !== 'none';
    const hasCustomVrm = this.vrmAvatar?.hasVrm() ?? false;
    const coPlayMoveX =
      this.coPlayState === 'playing'
        ? (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
          (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0)
        : 0;
    const coPlayMoveY =
      this.coPlayState === 'playing'
        ? (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) -
          (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0)
        : 0;
    this.protagonist?.update(dt, elapsed, {
      feetPos: this.playerFeetPos,
      yaw: this.yaw,
      pitch: this.pitch,
      walkSpeed: this.playerWalkSpeedThisFrame,
      isMoving: this.playerMovingThisFrame,
      viewMode: this.thirdPersonPreview ? 'overview' : this.viewMode,
      hideAll: hideAvatar || hasCustomVrm,
      seatedOnSofa: this.sofaSitState !== 'none',
      sofaBaseYaw: -Math.PI / 2,
      coPlayMode:
        this.coPlayState === 'handoff_reach'
          ? 'reaching'
          : this.coPlayState === 'playing'
            ? 'holding'
            : 'none',
      coPlayReachProgress: this.coPlayHandoffProgress,
      coPlayInputX: coPlayMoveX,
      coPlayInputY: coPlayMoveY,
      coPlayActionPulse: this.coPlayActionPulse,
    });
    this.vrmAvatar?.update(dt, elapsed, {
      feetPos: this.playerFeetPos,
      yaw: this.yaw,
      pitch: this.pitch,
      walkSpeed: this.playerWalkSpeedThisFrame,
      actualSpeed: this.playerActualSpeedThisFrame,
      isMoving: this.playerMovingThisFrame,
      moveDirWorld: this.playerMoveDirWorld,
      viewMode: this.viewMode,
      thirdPersonPreview: this.thirdPersonPreview,
      hideAll: hideAvatar || this.sofaSitState !== 'none',
    });

    // 3.55 Update Heroine VRM (bed-edge sitting / stand-up walk / expressive gestures / follow player)
    if (this.viewMode === 'first-person') {
      this.heroinePlayerEyeScratch.copy(this.camera.position);
    } else {
      this.heroinePlayerEyeScratch.set(
        this.playerFeetPos.x,
        this.playerFeetPos.y + 1.62,
        this.playerFeetPos.z
      );
    }
    const heroineTypingNow = this.floatingSubtitles.isCurrentlyTyping();
    this.vrmAvatar?.heroine.setSpeaking(heroineTypingNow);
    if (heroineTypingNow !== this.heroineTypingReported) {
      this.heroineTypingReported = heroineTypingNow;
      this.callbacks.onHeroineTypingChange?.(heroineTypingNow);
    }
    this.vrmAvatar?.heroine.update(
      dt,
      elapsed,
      this.heroinePlayerEyeScratch,
      this.currentRoom,
      this.playerFeetPos,
      this.resolveHeroineFollowMove
    );

    // 3.56 Gentle encounter camera framing + true 3D floating subtitle update + spatial overlay projection
    this.updateHeroineEncounterFrame(dt, elapsed);

    // 3a. Persistent ambient tabletop physics for pens, trinkets & small desk/table props
    this.updateAmbientTabletopPhysics(dt, elapsed);

    // 3a2. Dynamic collision sliding & swiveling for Bedroom & Basement swivel chairs
    this.updateSwivelChairs(dt);

    // 3a3. Living Room cozy auto-playing comical pixel-art TV minigame canvas animation
    this.updateLivingTvProgram(dt);

    // 3b. Manual room occlusion culling via SceneManager (visibility-only, zero scene-graph churn!)
    if (this.settings.occlusionCulling) {
      const visibilityChanged = this.ctx.sceneManager.updateVisibility(
        this.isTeleporting && this.teleportTargetRoom ? this.teleportTargetRoom : this.currentRoom,
        this.isTeleporting ? this.targetFeetPos : this.playerFeetPos,
        this.viewMode,
        this.ctx.doors,
        this.ctx.ceilingLamps
      );
      if (visibilityChanged) {
        // Immediately refresh directional shadows on the exact frame a newly entered room appears!
        this.shadowDirty = true;
        this.shadowImmediate = true;
      }
      if (this.vrmAvatar?.heroine.root.visible) {
        const heroineRoom = getRoomAt(
          this.vrmAvatar.heroine.root.position.x,
          this.vrmAvatar.heroine.root.position.y,
          this.vrmAvatar.heroine.root.position.z
        );
        this.vrmAvatar.heroine.root.visible =
          this.vrmAvatar.heroine.isFollowingPlayer() ||
          this.vrmAvatar.heroine.isSofaActive() ||
          this.vrmAvatar.heroine.isPoseTuning() ||
          this.ctx.sceneManager.isRoomVisible(heroineRoom.id);
      }
    }

    // 3c. Smoothly damp Living Room vintage ceiling fan-light boost, spin fan blades & sync GPU PointLight Pool
    const livingLampRig = this.ctx.metaState.livingBrightLight;
    const targetLivingBoost = livingLampRig.isOn ? 1.0 : 0.0;
    this.uniforms.uLivingLightBoost.value = THREE.MathUtils.damp(
      this.uniforms.uLivingLightBoost.value,
      targetLivingBoost,
      11.0,
      dt
    );
    if (livingLampRig.fanRotor) {
      const targetFanSpeed = livingLampRig.isOn ? 1.65 : 0.78;
      livingLampRig.fanSpeed = THREE.MathUtils.damp(
        livingLampRig.fanSpeed,
        targetFanSpeed,
        3.2,
        dt
      );
      livingLampRig.fanRotor.rotation.y =
        (livingLampRig.fanRotor.rotation.y + livingLampRig.fanSpeed * dt) % (Math.PI * 2);
    }
    this.syncPointLightPool();

    // 4. Render planar mirror reflection pass ONLY when a mirror is actually inside the camera frustum
    if (this.renderMirrorPass(dt, elapsed)) {
      this.updateGhostDustMotes(dt, elapsed);
    }

    // Refresh directional shadow map on-demand for the main pass only when scene shadow-casters changed
    const silhouette = this.ctx.metaState.silhouetteGroup;
    const silVis = silhouette ? silhouette.visible : false;
    if (silVis !== this.lastShadowSilhouetteVis) {
      this.lastShadowSilhouetteVis = silVis;
      this.shadowDirty = true;
      this.shadowImmediate = true;
    }
    if (this.shadowUpdateCooldown > 0) {
      this.shadowUpdateCooldown = Math.max(0, this.shadowUpdateCooldown - dt);
    }
    if (
      this.shadowDirty &&
      (this.shadowImmediate || this.shadowUpdateCooldown <= 0) &&
      this.renderer.shadowMap.enabled
    ) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowDirty = false;
      this.shadowImmediate = false;
      this.shadowUpdateCooldown = 0.16;
    }

    if (this.metaGlitchTimer > 0) {
      this.metaGlitchTimer = Math.max(0, this.metaGlitchTimer - dt);
    }
    const baseMeta = this.atmosphere === 'meta' ? 0.38 : 0.0;
    if (this.postRig) {
      this.postRig.unifiedPass.uniforms.uFisheye.value = this.nonEuclidFisheye;
    }
    if (
      this.postRig &&
      this.postRig.shouldRender(this.atmosphere, this.metaGlitchTimer)
    ) {
      this.postRig.unifiedPass.uniforms.uTime.value = elapsed;
      this.postRig.unifiedPass.uniforms.uMetaIntensity.value = Math.min(
        1.0,
        baseMeta + this.metaGlitchTimer * 0.75
      );
      this.postRig.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  /**
   * Simulates smooth caster-wheel collision sliding, room/desk collision clamping,
   * and inertial upper-seat swiveling for Bedroom & Basement swivel chairs.
   */
  private updateSwivelChairs(dt: number): void {
    const chairs = this.ctx.metaState.swivelChairs;
    if (chairs.length === 0) return;

    const canCollidePlayer =
      this.viewMode === 'first-person' &&
      !this.isTeleporting &&
      this.pcFocusState === 'none';

    const playerRadius = 0.28;
    const linearDamp = Math.exp(-4.6 * dt);
    const seatSpinDamp = Math.exp(-3.2 * dt);
    const baseSpinDamp = Math.exp(-5.0 * dt);

    for (const chair of chairs) {
      if (
        chair.id === 'bed_swivel_chair' &&
        this.vrmAvatar?.heroine.isSeatedOnChair()
      ) {
        chair.vx = 0;
        chair.vz = 0;
        chair.spinVel = 0;
        chair.baseSpinVel = 0;
        continue;
      }
      let cx = chair.rootGroup.position.x;
      let cz = chair.rootGroup.position.z;
      let moved = false;

      // 1. Player vs. Swivel Chair horizontal circle collision -> slide + swivel spin!
      if (canCollidePlayer && Math.abs(this.playerFeetPos.y - chair.floorY) < 0.75) {
        const dx = cx - this.playerFeetPos.x;
        const dz = cz - this.playerFeetPos.z;
        const distSq = dx * dx + dz * dz;
        const minDist = playerRadius + chair.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          let nx = 0;
          let nz = 1;
          if (dist > 1e-4) {
            nx = dx / dist;
            nz = dz / dist;
          } else {
            nx = -Math.sin(this.yaw);
            nz = -Math.cos(this.yaw);
          }

          const pen = minDist - dist;
          const pushStep = Math.min(0.18, pen * 0.88);
          const candX = Math.max(chair.bounds.minX, Math.min(chair.bounds.maxX, cx + nx * pushStep));
          const candZ = Math.max(chair.bounds.minZ, Math.min(chair.bounds.maxZ, cz + nz * pushStep));
          const resolvedChair = this.collisions.resolveMovement(
            cx,
            cz,
            candX,
            candZ,
            chair.floorY,
            chair.radius
          );

          const actualMoveX = resolvedChair.x - cx;
          const actualMoveZ = resolvedChair.z - cz;
          const actualMoveLen = Math.hypot(actualMoveX, actualMoveZ);
          cx = resolvedChair.x;
          cz = resolvedChair.z;
          moved = actualMoveLen > 1e-4;

          // Impart smooth rolling velocity along collision normal
          const pushSpeed = Math.min(
            3.1,
            Math.max(1.15, this.playerWalkSpeedThisFrame * 0.92) * (0.48 + pen * 5.2)
          );
          chair.vx = chair.vx * 0.45 + nx * pushSpeed * 0.72;
          chair.vz = chair.vz * 0.45 + nz * pushSpeed * 0.72;

          // Impart realistic swivel spin torque based on off-center tangential contact
          const mvX = this.playerMovingThisFrame ? _move.x / Math.max(dt, 0.008) : nx;
          const mvZ = this.playerMovingThisFrame ? _move.z / Math.max(dt, 0.008) : nz;
          const cross = mvX * nz - mvZ * nx;
          const torqueSign = Math.abs(cross) > 0.05 ? Math.sign(cross) : ((cx + cz) >= 0 ? 1 : -1);
          const torqueMag = Math.min(4.8, 1.35 + Math.abs(cross) * 1.45);
          chair.spinVel = THREE.MathUtils.clamp(
            chair.spinVel + torqueSign * torqueMag * Math.min(1, dt * 14),
            -6.5,
            6.5
          );
          chair.baseSpinVel = THREE.MathUtils.clamp(
            chair.baseSpinVel + torqueSign * torqueMag * 0.25 * Math.min(1, dt * 12),
            -2.4,
            2.4
          );

          // If chair is pinned against a desk/wall, gently push player back so they never clip through!
          const remainingPen = Math.max(0, pen - actualMoveLen);
          if (remainingPen > 0.002) {
            const pPush = remainingPen * 0.92;
            const pResolved = this.collisions.resolveMovement(
              this.playerFeetPos.x,
              this.playerFeetPos.z,
              this.playerFeetPos.x - nx * pPush,
              this.playerFeetPos.z - nz * pPush,
              this.playerFeetPos.y
            );
            this.playerFeetPos.x = pResolved.x;
            this.playerFeetPos.z = pResolved.z;
          }
        }
      }

      // 2. Integrate caster-wheel coasting velocity + wall/desk collision sliding
      const speedSq = chair.vx * chair.vx + chair.vz * chair.vz;
      if (speedSq > 1e-5) {
        const nextX = Math.max(
          chair.bounds.minX,
          Math.min(chair.bounds.maxX, cx + chair.vx * dt)
        );
        const nextZ = Math.max(
          chair.bounds.minZ,
          Math.min(chair.bounds.maxZ, cz + chair.vz * dt)
        );
        const resolved = this.collisions.resolveMovement(
          cx,
          cz,
          nextX,
          nextZ,
          chair.floorY,
          chair.radius
        );

        // Damp velocity smoothly if hitting a wall/desk boundary
        if (Math.abs(resolved.x - nextX) > 0.002) {
          chair.vx *= -0.18;
          chair.spinVel += Math.sign(chair.vz || 1) * 0.45;
        }
        if (Math.abs(resolved.z - nextZ) > 0.002) {
          chair.vz *= -0.18;
          chair.spinVel -= Math.sign(chair.vx || 1) * 0.45;
        }

        if (Math.hypot(resolved.x - cx, resolved.z - cz) > 1e-4) {
          cx = resolved.x;
          cz = resolved.z;
          moved = true;
        }
        chair.vx *= linearDamp;
        chair.vz *= linearDamp;
        if (chair.vx * chair.vx + chair.vz * chair.vz < 1e-4) {
          chair.vx = 0;
          chair.vz = 0;
        }
      }

      if (moved) {
        chair.rootGroup.position.set(cx, chair.floorY, cz);
        this.shadowDirty = true;
      }

      // 3. Smooth upper-seat swivel rotation + subtle caster base yaw
      if (Math.abs(chair.spinVel) > 1e-3) {
        chair.seatGroup.rotation.y += chair.spinVel * dt;
        chair.spinVel *= seatSpinDamp;
        if (Math.abs(chair.spinVel) < 0.005) chair.spinVel = 0;
      }
      if (Math.abs(chair.baseSpinVel) > 1e-3) {
        chair.rootGroup.rotation.y += chair.baseSpinVel * dt;
        chair.baseSpinVel *= baseSpinDamp;
        if (Math.abs(chair.baseSpinVel) < 0.005) chair.baseSpinVel = 0;
      }
    }
  }

  /**
   * Renders crisp 512x288 multi-channel retro pixel TV programs onto the Living Room TV CanvasTexture:
   * - CH-01: ★ TWILIGHT CO-OP CONSOLE (Playable 2P Snowball Fight & Co-Op Tank Battle)
   * - CH-02: ♥ STARLIGHT DRAMA (twinkling rooftop night romance)
   * - CH-03: ♪ NEKO KITCHEN (calico cat chef flipping star pancakes)
   * Auto-cycles passive TV programs every ~24s (paused while co-playing) and drives heroine reactions.
   */
  private updateLivingTvProgram(dt: number): void {
    const tv = this.ctx.metaState.livingTv;
    if (!tv.isOn || !tv.ctx || !tv.texture || !tv.canvas) return;
    // Skip canvas redraw when far away in Basement or Bathroom
    if (this.currentRoom === 'basement' || this.currentRoom === 'bathroom') return;

    tv.time += dt;
    if (this.coPlayState === 'none') {
      tv.channelTimer += dt;
      if (tv.channelTimer >= 24) {
        this.switchLivingRoomTvChannel(false);
      }
    } else {
      tv.channelTimer = 0;
    }
    if (tv.switchFlashTimer > 0) {
      tv.switchFlashTimer = Math.max(0, tv.switchFlashTimer - dt);
    }

    // Advance interactive console game every frame when on CH-01 so movement & physics stay silky
    if (tv.channel === 0) {
      const isActivelyPlaying =
        this.coPlayState === 'playing' && this.sofaSitState === 'seated';
      const tvInput: TvGameControlInput = isActivelyPlaying
        ? {
            moveX:
              (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
              (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0),
            moveY:
              (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) -
              (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0),
            throwOrFire: Boolean(this.keys['Space'] || this.coPlayActionPulse > 0.72),
            dodgeOrDash: Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']),
            buildWallOrShield: false,
          }
        : {
            moveX: 0,
            moveY: 0,
            throwOrFire: false,
            dodgeOrDash: false,
            buildWallOrShield: false,
          };
      this.livingTvGames.update(dt, tvInput);

      const events = this.livingTvGames.drainEvents();
      if (isActivelyPlaying && events.length > 0 && !this.heroineEncounterActive) {
        const heroine = this.vrmAvatar?.heroine;
        for (const ev of events) {
          heroine?.triggerGamingReactionPulse(ev === 'giant_pickup' || ev === 'p1_win' || ev === 'p2_win' ? 1.2 : 0.85);
          if (this.sofaMicroMurmurCooldown <= 0 && this.ambientMurmurTimer <= 0.1) {
            if (ev === 'match_start_snowball') {
              this.sofaMicroMurmurCooldown = 5;
              this.showAmbientHeroineMurmur('雪仗开打啦！看我先堆个雪墙挡住你～', 3.4, true);
            } else if (ev === 'match_start_tank') {
              this.sofaMicroMurmurCooldown = 5;
              this.showAmbientHeroineMurmur('坦克大战！我掩护你，别让基地被炸到哦～', 3.4, true);
            } else if (ev === 'p2_hit') {
              this.sofaMicroMurmurCooldown = 7;
              heroine?.triggerSofaBriefReaction(
                { expression: 'sad', gesture: 'idle', blush: 0.35, headTilt: -0.06, leanForward: 0.06 },
                2.2
              );
              this.showAmbientHeroineMurmur('呀！被你的大雪球砸中了啦，好凉～', 2.8, false);
            } else if (ev === 'p1_hit') {
              this.sofaMicroMurmurCooldown = 7;
              heroine?.triggerSofaBriefReaction(
                { expression: 'wink', gesture: 'idle', blush: 0.28, headTilt: 0.08, leanForward: 0.08 },
                2.2
              );
              this.showAmbientHeroineMurmur('嘿嘿，命中！我的准头不错吧～', 2.8, true);
            } else if (ev === 'giant_pickup') {
              this.sofaMicroMurmurCooldown = 7;
              this.showAmbientHeroineMurmur('哇！我捡到超级巨型雪球啦，小心接招！', 3.0, true);
            } else if (ev === 'p1_win') {
              this.sofaMicroMurmurCooldown = 6;
              this.adjustHeroineIntimacy(2);
              this.showAmbientHeroineMurmur('唔……这局被你赢过去了，再来一局！', 3.2, true);
            } else if (ev === 'p2_win') {
              this.sofaMicroMurmurCooldown = 6;
              this.adjustHeroineIntimacy(2);
              this.showAmbientHeroineMurmur('耶～这局是我赢啦，浅紫手柄立大功！', 3.2, true);
            } else if (ev === 'tank_wave_clear') {
              this.sofaMicroMurmurCooldown = 6;
              this.adjustHeroineIntimacy(3);
              this.showAmbientHeroineMurmur('配合得真默契！这一波敌方坦克全清光啦～', 3.4, true);
            }
          }
        }
      }
    }

    const redrawInterval =
      tv.channel === 0 && this.coPlayState === 'playing' ? 0.033 : 0.05;
    tv.accum += dt;
    if (tv.accum < redrawInterval) return;
    tv.accum = 0;

    const c = tv.ctx;
    const rawW = tv.canvas.width; // 512
    const rawH = tv.canvas.height; // 288
    const W = 256;
    const H = 144;
    const scaleX = rawW / W;
    const scaleY = rawH / H;
    const t = tv.time;

    if (tv.channel === 0) {
      this.livingTvGames.render(
        c,
        rawW,
        rawH,
        this.coPlayState === 'playing' && this.sofaSitState === 'seated'
      );
      tv.score = 1200 + Math.floor(t * 45) * 10;
      this.renderLivingTvSwitchOverlay(c, rawW, rawH, tv.channel, tv.switchFlashTimer);
      tv.texture.needsUpdate = true;
      return;
    }
    if (tv.channel === 1) {
      this.renderLivingTvStarlightDrama(c, W, H, scaleX, scaleY, t);
      this.renderLivingTvSwitchOverlay(c, rawW, rawH, tv.channel, tv.switchFlashTimer);
      tv.texture.needsUpdate = true;
      return;
    }
    if (tv.channel === 2) {
      this.renderLivingTvNekoKitchen(c, W, H, scaleX, scaleY, t);
      this.renderLivingTvSwitchOverlay(c, rawW, rawH, tv.channel, tv.switchFlashTimer);
      tv.texture.needsUpdate = true;
      return;
    }

    const scroll = t * 72; // logical pixels/sec world scroll

    c.save();
    c.scale(scaleX, scaleY);
    c.imageSmoothingEnabled = false;

    // 1. Rich, well-contrasted 16-bit sky (calibrated so colors stay crisp without white-out)
    c.fillStyle = '#1875d1';
    c.fillRect(0, 0, W, 38);
    c.fillStyle = '#2d9ae6';
    c.fillRect(0, 38, W, 34);
    c.fillStyle = '#5ec2f2';
    c.fillRect(0, 72, W, 32);
    c.fillStyle = '#9fe2df';
    c.fillRect(0, 104, W, 12);

    // 2. Vibrant rainbow arch in background
    const rainbowCols = ['#e6325c', '#f0821d', '#e8c825', '#2ec455', '#2795e6', '#9447e6'];
    const rbX = 186 - ((scroll * 0.08) % 260) + 60;
    for (let i = 0; i < rainbowCols.length; i++) {
      c.strokeStyle = rainbowCols[i];
      c.lineWidth = 3;
      c.beginPath();
      c.arc(rbX, 110, 56 - i * 3, Math.PI, 0);
      c.stroke();
    }

    // 3. Beaming comical pixel sun with sunglasses & crisp dark outline!
    const sunY = 24 + Math.round(Math.sin(t * 3.2) * 2);
    c.fillStyle = '#e89600';
    for (let r = 0; r < 8; r++) {
      const ang = t * 1.4 + (r * Math.PI) / 4;
      c.fillRect(Math.round(220 + Math.cos(ang) * 16) - 2, Math.round(sunY + Math.sin(ang) * 16) - 2, 4, 4);
    }
    c.fillStyle = '#231633';
    c.fillRect(209, sunY - 11, 22, 22);
    c.fillStyle = '#ffcf24';
    c.fillRect(210, sunY - 10, 20, 20);
    c.fillStyle = '#ffe96b';
    c.fillRect(212, sunY - 8, 16, 16);
    c.fillStyle = '#1d1430';
    c.fillRect(212, sunY - 4, 7, 5);
    c.fillRect(221, sunY - 4, 7, 5);
    c.fillRect(219, sunY - 3, 2, 2);
    c.fillStyle = '#e8f6ff';
    c.fillRect(213, sunY - 3, 2, 2);
    c.fillRect(222, sunY - 3, 2, 2);
    c.fillStyle = '#e62e5c';
    c.fillRect(216, sunY + 3, 8, 3);

    // 4. Drifting puffy smiling pixel clouds with soft sky-blue outline
    for (let ci = 0; ci < 3; ci++) {
      const cx = Math.floor(((ci * 98 + 40 - scroll * 0.25) % 310 + 310) % 310) - 36;
      const cy = 24 + (ci % 2) * 18;
      c.fillStyle = '#2e5d8f';
      c.fillRect(cx + 5, cy - 1, 22, 12);
      c.fillRect(cx - 1, cy + 3, 34, 13);
      c.fillStyle = '#f0f7ff';
      c.fillRect(cx + 6, cy, 20, 10);
      c.fillRect(cx, cy + 4, 32, 10);
      c.fillStyle = '#b4dcf2';
      c.fillRect(cx + 2, cy + 12, 28, 3);
      c.fillStyle = '#241b38';
      c.fillRect(cx + 10, cy + 6, 2, 2);
      c.fillRect(cx + 20, cy + 6, 2, 2);
      c.fillStyle = '#f06c98';
      c.fillRect(cx + 7, cy + 8, 3, 2);
      c.fillRect(cx + 22, cy + 8, 3, 2);
    }

    // 5. Rolling saturated hills with dark horizon edge
    for (let hi = 0; hi < 5; hi++) {
      const hx = Math.floor(((hi * 78 - scroll * 0.45) % 390 + 390) % 390) - 60;
      const hRad = 26 + (hi % 2) * 10;
      c.fillStyle = '#185e2a';
      c.fillRect(hx - 1, 113 - hRad, hRad * 2 + 2, hRad + 1);
      c.fillStyle = hi % 2 === 0 ? '#3bc443' : '#26a844';
      c.fillRect(hx, 114 - hRad, hRad * 2, hRad);
      c.fillStyle = '#6fe058';
      c.fillRect(hx + 4, 114 - hRad, hRad * 2 - 8, 5);
    }

    // 6. Crisp checkered arcade grass & warm terracotta soil track
    const groundY = 112;
    c.fillStyle = '#134721';
    c.fillRect(0, groundY - 1, W, 1);
    c.fillStyle = '#24bd42';
    c.fillRect(0, groundY, W, 10);
    c.fillStyle = '#cf7227';
    c.fillRect(0, groundY + 10, W, H - groundY - 10);
    const tileOff = Math.floor(scroll) % 16;
    for (let gx = -16; gx < W + 16; gx += 16) {
      const tx = gx - tileOff;
      c.fillStyle = '#148f2e';
      c.fillRect(tx, groundY, 8, 5);
      c.fillRect(tx + 8, groundY + 5, 8, 5);
      c.fillStyle = '#a85116';
      c.fillRect(tx, groundY + 12, 8, 8);
      c.fillRect(tx + 8, groundY + 20, 8, 8);
    }

    // 7. Auto-playing comical obstacles (bouncing magenta slimes & rolling watermelons) + Hero jump physics!
    const spacing = 112;
    const heroX = 56;
    let heroJumpHeight = 0;
    let heroFlip = false;
    let popupText = '';
    let popupX = heroX;
    let popupY = 66;
    let popupColor = '#ffe438';

    const baseIdx = Math.floor((scroll - 40) / spacing);
    for (let k = baseIdx; k <= baseIdx + 4; k++) {
      const obsWorldX = k * spacing + 140;
      const obsX = Math.round(obsWorldX - scroll);
      const isWatermelon = Math.abs(k) % 2 === 1;

      const distToHero = obsX - heroX;
      if (distToHero > -34 && distToHero < 42) {
        const u = (distToHero + 34) / 76;
        const arc = Math.sin(u * Math.PI);
        if (arc > heroJumpHeight) {
          heroJumpHeight = arc;
          heroFlip = u > 0.25 && u < 0.78;
        }
        if (Math.abs(distToHero) < 18) {
          popupText = isWatermelon ? 'WHOA!!' : 'BOING!';
          popupX = heroX - 4;
          popupY = Math.round(groundY - 38 - arc * 36);
          popupColor = '#ffe940';
        }
      }

      if (obsX > -24 && obsX < W + 24) {
        if (isWatermelon) {
          const rollPhase = Math.floor(t * 14) % 2;
          const wy = groundY - 16 - Math.round(Math.abs(Math.sin(t * 10 + k)) * 3);
          c.fillStyle = '#122119';
          c.fillRect(obsX - 9, wy - 1, 18, 18);
          c.fillStyle = '#148735';
          c.fillRect(obsX - 8, wy, 16, 16);
          c.fillStyle = '#32c450';
          c.fillRect(obsX - 6, wy + 2, 12, 12);
          c.fillStyle = '#0d5e24';
          c.fillRect(obsX - 2 + rollPhase * 2, wy + 1, 3, 14);
          c.fillStyle = '#f5faff';
          c.fillRect(obsX - 5, wy + 4, 4, 4);
          c.fillRect(obsX + 1, wy + 4, 4, 4);
          c.fillStyle = '#120d1f';
          c.fillRect(obsX - 4, wy + 5, 2, 2);
          c.fillRect(obsX + 2, wy + 5, 2, 2);
        } else {
          const squish = Math.sin(t * 11 + k * 2);
          const sw = 18 + Math.round(squish * 3);
          const sh = 14 - Math.round(squish * 3);
          const sx = obsX - Math.floor(sw / 2);
          const sy = groundY - sh;
          c.fillStyle = '#290d22';
          c.fillRect(sx - 1, sy + 1, sw + 2, sh);
          c.fillRect(sx + 1, sy - 1, sw - 2, sh + 2);
          c.fillStyle = '#e82482';
          c.fillRect(sx, sy + 2, sw, sh - 2);
          c.fillRect(sx + 2, sy, sw - 4, sh);
          c.fillStyle = '#ff78bd';
          c.fillRect(sx + 3, sy + 2, 5, 3);
          c.fillStyle = '#f5faff';
          c.fillRect(obsX - 6, sy + 4, 4, 5);
          c.fillRect(obsX + 2, sy + 4, 4, 5);
          c.fillStyle = '#1a0c26';
          c.fillRect(obsX - 5, sy + 5, 2, 3);
          c.fillRect(obsX + 3, sy + 5, 2, 3);
          c.fillStyle = '#ffe038';
          c.fillRect(obsX - 2, sy + 9, 4, 3);
        }
      }

      const coinX = obsX + 2;
      const coinY = groundY - 46 + Math.round(Math.sin(t * 7 + k) * 3);
      const collected = distToHero < 4;
      if (!collected && coinX > -12 && coinX < W + 12) {
        if (isWatermelon) {
          c.fillStyle = '#291421';
          c.fillRect(coinX - 7, coinY - 1, 14, 12);
          c.fillStyle = '#f7ebd0';
          c.fillRect(coinX - 6, coinY, 12, 10);
          c.fillStyle = '#e83d68';
          c.fillRect(coinX - 6, coinY + 3, 12, 3);
          c.fillStyle = '#e6194b';
          c.fillRect(coinX - 3, coinY - 4, 6, 5);
          c.fillStyle = '#2ec44d';
          c.fillRect(coinX - 2, coinY - 6, 4, 2);
        } else {
          const spinW = Math.max(4, Math.round(Math.abs(Math.cos(t * 8 + k)) * 10));
          c.fillStyle = '#332008';
          c.fillRect(coinX - Math.floor(spinW / 2) - 2, coinY - 2, spinW + 4, 14);
          c.fillStyle = '#e69800';
          c.fillRect(coinX - Math.floor(spinW / 2) - 1, coinY - 1, spinW + 2, 12);
          c.fillStyle = '#ffe030';
          c.fillRect(coinX - Math.floor(spinW / 2), coinY, spinW, 10);
          c.fillStyle = '#fff9d6';
          c.fillRect(coinX - 1, coinY + 2, 2, 5);
        }
      } else if (collected && distToHero > -24) {
        const burst = (-distToHero + 4) * 0.7;
        const burstCols = ['#ffe030', '#ff3680', '#2ee0f5', '#6ee03b'];
        for (let b = 0; b < 6; b++) {
          const ba = (b / 6) * Math.PI * 2 + t * 5;
          c.fillStyle = burstCols[b % burstCols.length];
          c.fillRect(
            Math.round(coinX + Math.cos(ba) * burst),
            Math.round(coinY + Math.sin(ba) * burst),
            3,
            3
          );
        }
        popupText = isWatermelon ? 'YUM! +200' : '+100 ★';
        popupX = coinX - 8;
        popupY = coinY - 8 - Math.round(burst * 0.4);
        popupColor = '#fff7d6';
      }
    }

    // 8. Draw the comical chubby pixel hero ("Bouncy Cat-Cap Kid") with crisp dark pixel outline
    const jumpPx = Math.round(heroJumpHeight * 42);
    const hy = groundY - 22 - jumpPx;
    const runFrame = Math.floor(t * 14) % 2;

    const shadowW = Math.max(8, 18 - Math.round(heroJumpHeight * 9));
    c.fillStyle = 'rgba(14, 64, 28, 0.52)';
    c.fillRect(heroX - Math.floor(shadowW / 2), groundY + 1, shadowW, 3);

    const capeFlap = Math.round(Math.sin(t * 22) * 3);
    c.fillStyle = '#290d18';
    c.fillRect(heroX - 21, hy + 7 + capeFlap, 16, 9);
    c.fillStyle = '#e8234e';
    c.fillRect(heroX - 16, hy + 8 + capeFlap, 10, 7);
    c.fillRect(heroX - 20, hy + 10 + capeFlap, 6, 5);

    c.fillStyle = '#181d40';
    if (jumpPx > 4) {
      c.fillRect(heroX - 8, hy + 17, 7, 7);
      c.fillRect(heroX + 2, hy + 15, 7, 7);
    } else {
      c.fillRect(heroX - 7 + (runFrame ? 3 : -2), hy + 16, 7, 7);
      c.fillRect(heroX + 1 + (runFrame ? -2 : 3), hy + 16, 7, 7);
    }
    c.fillStyle = '#2a45e6';
    if (jumpPx > 4) {
      c.fillRect(heroX - 7, hy + 18, 5, 5);
      c.fillRect(heroX + 3, hy + 16, 5, 5);
    } else {
      c.fillRect(heroX - 6 + (runFrame ? 3 : -2), hy + 17, 5, 5);
      c.fillRect(heroX + 2 + (runFrame ? -2 : 3), hy + 17, 5, 5);
    }

    c.fillStyle = '#241421';
    c.fillRect(heroX - 9, hy + 7, 18, 13);
    c.fillRect(heroX - 10, hy - 8, 21, 18);
    c.fillStyle = '#ed5f14';
    c.fillRect(heroX - 8, hy + 8, 16, 11);
    c.fillStyle = '#ffd930';
    c.fillRect(heroX - 3, hy + 11, 6, 4);

    c.fillStyle = '#f5cfa8';
    c.fillRect(heroX - 8, hy - 3, 17, 12);
    c.fillStyle = '#1ec98e';
    c.fillRect(heroX - 9, hy - 7, 19, 6);
    c.fillRect(heroX - 8, hy - 11, 4, 4);
    c.fillRect(heroX + 5, hy - 11, 4, 4);
    c.fillStyle = '#f06ba6';
    c.fillRect(heroX - 7, hy - 9, 2, 2);
    c.fillRect(heroX + 6, hy - 9, 2, 2);

    c.fillStyle = '#f5faff';
    c.fillRect(heroX - 3, hy, 5, 5);
    c.fillRect(heroX + 4, hy, 5, 5);
    c.fillStyle = '#1a1229';
    c.fillRect(heroX - 1, hy + (heroFlip ? 1 : 2), 2, 2);
    c.fillRect(heroX + 6, hy + (heroFlip ? 1 : 2), 2, 2);
    c.fillStyle = '#eb4c7c';
    c.fillRect(heroX - 6, hy + 4, 3, 2);
    c.fillRect(heroX + 1, hy + 5, 5, 3);

    // 10. Crisp Retro Arcade HUD bar background & pixel hearts
    c.fillStyle = 'rgba(18, 12, 36, 0.84)';
    c.fillRect(0, 0, W, 16);
    c.fillStyle = '#e83c72';
    c.fillRect(0, 15, W, 1);

    for (let h = 0; h < 3; h++) {
      const hx = 6 + h * 11;
      c.fillStyle = '#f03060';
      c.fillRect(hx, 4, 3, 3);
      c.fillRect(hx + 4, 4, 3, 3);
      c.fillRect(hx, 6, 7, 3);
      c.fillRect(hx + 1, 9, 5, 2);
      c.fillRect(hx + 2, 11, 3, 1);
    }

    c.restore();

    // 9 & 10b. Render sharp native 512x288 text overlays AFTER restoring scale so letters are razor-sharp!
    if (popupText) {
      c.font = 'bold 18px monospace';
      c.textAlign = 'center';
      c.lineWidth = 3.5;
      c.strokeStyle = '#1b0f2e';
      c.strokeText(popupText, popupX * scaleX, popupY * scaleY);
      c.fillStyle = popupColor;
      c.fillText(popupText, popupX * scaleX, popupY * scaleY);
    }

    const liveScore = 1200 + Math.floor(t * 85) * 10;
    tv.score = liveScore;
    c.font = 'bold 17px monospace';
    c.textAlign = 'left';
    c.fillStyle = '#ffdf40';
    c.fillText(`SCORE ${String(liveScore).padStart(6, '0')}`, 46 * scaleX, 11.5 * scaleY);

    c.textAlign = 'right';
    c.fillStyle = Math.floor(t * 3) % 2 === 0 ? '#5ef08f' : '#eef5ff';
    c.fillText('★ COZY ARCADE TV', (W - 6) * scaleX, 11.5 * scaleY);

    this.renderLivingTvSwitchOverlay(c, rawW, rawH, tv.channel, tv.switchFlashTimer);
    tv.texture.needsUpdate = true;
  }

  private renderLivingTvStarlightDrama(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    scaleX: number,
    scaleY: number,
    t: number
  ): void {
    c.save();
    c.scale(scaleX, scaleY);
    c.imageSmoothingEnabled = false;

    // 1. Deep twilight-violet night sky bands
    c.fillStyle = '#140f33';
    c.fillRect(0, 0, W, 38);
    c.fillStyle = '#24184f';
    c.fillRect(0, 38, W, 32);
    c.fillStyle = '#40266b';
    c.fillRect(0, 70, W, 28);
    c.fillStyle = '#6c3b7a';
    c.fillRect(0, 98, W, 18);

    // 2. Twinkling pixel stars
    for (let s = 0; s < 26; s++) {
      const sx = (s * 43 + 17) % (W - 12) + 6;
      const sy = (s * 29 + 19) % 72 + 16;
      const blink = Math.sin(t * 3.2 + s * 1.7) > 0.15;
      c.fillStyle = blink ? '#fff1c9' : '#8b7cc2';
      c.fillRect(sx, sy, blink ? 2 : 1, blink ? 2 : 1);
    }

    // 3. Occasional shooting star arc
    const meteorCycle = t % 6.5;
    if (meteorCycle < 1.1) {
      const u = meteorCycle / 1.1;
      const mx = Math.round(40 + u * 165);
      const my = Math.round(24 + u * 36);
      c.fillStyle = '#ffd9f5';
      c.fillRect(mx - 10, my - 2, 10, 1);
      c.fillStyle = '#ffffff';
      c.fillRect(mx, my, 3, 2);
    }

    // 4. Warm pixel crescent moon
    c.fillStyle = '#ffe585';
    c.fillRect(194, 24, 20, 20);
    c.fillStyle = '#140f33';
    c.fillRect(202, 22, 16, 18);

    // 5. Distant glowing city skyline
    const buildings = [
      { x: 0, w: 28, h: 38 },
      { x: 26, w: 22, h: 52 },
      { x: 48, w: 30, h: 34 },
      { x: 80, w: 24, h: 48 },
      { x: 106, w: 34, h: 40 },
      { x: 142, w: 26, h: 54 },
      { x: 170, w: 32, h: 36 },
      { x: 204, w: 28, h: 46 },
      { x: 230, w: 28, h: 38 },
    ];
    for (let bi = 0; bi < buildings.length; bi++) {
      const b = buildings[bi];
      const by = 114 - b.h;
      c.fillStyle = '#191230';
      c.fillRect(b.x, by, b.w, b.h + 12);
      for (let wy = by + 6; wy < 108; wy += 9) {
        for (let wx = b.x + 4; wx < b.x + b.w - 5; wx += 7) {
          const lit = ((bi * 7 + wx + wy) % 3) !== 0;
          if (lit) {
            c.fillStyle = (wx + wy) % 2 === 0 ? '#ffd27a' : '#ff99cc';
            c.fillRect(wx, wy, 3, 4);
          }
        }
      }
    }

    // 6. Rooftop railing + cozy bench with two silhouettes leaning together
    c.fillStyle = '#201538';
    c.fillRect(0, 112, W, H - 112);
    c.fillStyle = '#4e3975';
    c.fillRect(0, 111, W, 2);

    // Left silhouette (leaning gently right) & right silhouette
    const sway = Math.round(Math.sin(t * 1.4) * 1);
    c.fillStyle = '#120b24';
    // Bench
    c.fillRect(88, 114, 80, 10);
    // Heroine silhouette
    c.fillRect(108 + sway, 94, 14, 14);
    c.fillRect(104, 108, 20, 18);
    // Partner silhouette
    c.fillRect(126, 90, 15, 15);
    c.fillRect(124, 105, 22, 21);

    // Floating pastel hearts rising between them
    for (let hi = 0; hi < 3; hi++) {
      const phase = (t * 0.45 + hi * 0.34) % 1;
      const hx = Math.round(118 + Math.sin(t * 2.2 + hi * 2) * 10);
      const hy = Math.round(86 - phase * 34);
      c.fillStyle = hi % 2 === 0 ? '#ff85c8' : '#d89eff';
      c.fillRect(hx, hy, 2, 2);
      c.fillRect(hx + 3, hy, 2, 2);
      c.fillRect(hx, hy + 2, 5, 2);
      c.fillRect(hx + 1, hy + 4, 3, 1);
    }

    // Top bar
    c.fillStyle = 'rgba(18, 12, 36, 0.84)';
    c.fillRect(0, 0, W, 16);
    c.fillStyle = '#d47aff';
    c.fillRect(0, 15, W, 1);
    c.restore();

    c.font = 'bold 17px monospace';
    c.textAlign = 'left';
    c.fillStyle = '#ffc7ef';
    c.fillText('EP.08  TONIGHT ON THE ROOF', 10 * scaleX, 11.5 * scaleY);
    c.textAlign = 'right';
    c.fillStyle = '#e4b5ff';
    c.fillText('♥ STARLIGHT DRAMA', (W - 6) * scaleX, 11.5 * scaleY);
  }

  private renderLivingTvNekoKitchen(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    scaleX: number,
    scaleY: number,
    t: number
  ): void {
    c.save();
    c.scale(scaleX, scaleY);
    c.imageSmoothingEnabled = false;

    // 1. Warm pastel striped kitchen studio backdrop
    for (let sx = 0; sx < W; sx += 16) {
      c.fillStyle = (sx / 16) % 2 === 0 ? '#fce3c2' : '#f7d4b2';
      c.fillRect(sx, 16, 16, 84);
    }

    // Cute wall shelf with jam jars
    c.fillStyle = '#9e6238';
    c.fillRect(22, 46, 62, 5);
    c.fillStyle = '#e84d78';
    c.fillRect(30, 34, 10, 12);
    c.fillStyle = '#53b870';
    c.fillRect(46, 36, 10, 10);
    c.fillStyle = '#f2b830';
    c.fillRect(62, 33, 10, 13);

    // 2. Cheerful pixel calico cat chef behind counter
    const bob = Math.round(Math.abs(Math.sin(t * 4.6)) * 3);
    const cx = 128;
    const cy = 62 - bob;
    // Chef toque hat
    c.fillStyle = '#24182b';
    c.fillRect(cx - 12, cy - 22, 24, 15);
    c.fillStyle = '#f7f8fc';
    c.fillRect(cx - 10, cy - 20, 20, 12);
    c.fillRect(cx - 13, cy - 17, 26, 7);
    // Cat head & ears
    c.fillStyle = '#24182b';
    c.fillRect(cx - 15, cy - 8, 30, 24);
    c.fillStyle = '#fff5e6';
    c.fillRect(cx - 13, cy - 6, 26, 20);
    // Orange calico patch
    c.fillStyle = '#f08a35';
    c.fillRect(cx - 13, cy - 6, 10, 10);
    // Eyes & happy mouth
    c.fillStyle = '#24182b';
    c.fillRect(cx - 7, cy + 2, 3, 3);
    c.fillRect(cx + 4, cy + 2, 3, 3);
    c.fillStyle = '#f26d99';
    c.fillRect(cx - 10, cy + 6, 3, 2);
    c.fillRect(cx + 7, cy + 6, 3, 2);
    c.fillRect(cx - 2, cy + 7, 4, 2);
    // Apron torso
    c.fillStyle = '#ff6b98';
    c.fillRect(cx - 14, cy + 16, 28, 22);
    c.fillStyle = '#fff5e6';
    c.fillRect(cx - 8, cy + 20, 16, 16);

    // 3. Frying pan & flipping golden star pancake!
    const flipCycle = (t * 1.1) % 2.2;
    const flipArc = flipCycle < 0.85 ? Math.sin((flipCycle / 0.85) * Math.PI) : 0;
    const panX = 166;
    const panY = 92;
    c.fillStyle = '#2a2638';
    c.fillRect(panX - 18, panY, 34, 6);
    c.fillRect(panX - 30, panY + 1, 14, 3);
    // Golden pancake
    const cakeY = Math.round(panY - 6 - flipArc * 30);
    c.fillStyle = '#a85a12';
    c.fillRect(panX - 12, cakeY - 1, 22, 7);
    c.fillStyle = '#f7be38';
    c.fillRect(panX - 11, cakeY, 20, 5);
    c.fillStyle = '#fff2a6';
    c.fillRect(panX - 3, cakeY + 1, 5, 2);

    // Rising cozy steam wisps
    for (let si = 0; si < 3; si++) {
      const sp = (t * 0.8 + si * 0.33) % 1;
      const sx = panX - 6 + si * 6 + Math.round(Math.sin(t * 4 + si) * 2);
      const sy = Math.round(panY - 12 - sp * 24);
      c.fillStyle = 'rgba(255, 250, 240, 0.85)';
      c.fillRect(sx, sy, 2, 4);
    }

    // 4. Kitchen counter + pastel weather ticker footer
    c.fillStyle = '#c47b47';
    c.fillRect(0, 98, W, 24);
    c.fillStyle = '#e09960';
    c.fillRect(0, 98, W, 4);
    c.fillStyle = '#2d2042';
    c.fillRect(0, 122, W, 22);

    // Top bar
    c.fillStyle = 'rgba(42, 24, 54, 0.86)';
    c.fillRect(0, 0, W, 16);
    c.fillStyle = '#ff9c66';
    c.fillRect(0, 15, W, 1);
    c.restore();

    c.font = 'bold 17px monospace';
    c.textAlign = 'left';
    c.fillStyle = '#ffe588';
    c.fillText('SUNNY 22°C  ★ PANCAKE TIME!', 10 * scaleX, 136 * scaleY);
    c.fillStyle = '#ffd6eb';
    c.fillText('CHEF MIMI LIVE', 10 * scaleX, 11.5 * scaleY);
    c.textAlign = 'right';
    c.fillStyle = '#ffcf7a';
    c.fillText('♪ NEKO KITCHEN', (W - 6) * scaleX, 11.5 * scaleY);
  }

  private renderLivingTvSwitchOverlay(
    c: CanvasRenderingContext2D,
    rawW: number,
    rawH: number,
    channel: number,
    flashTimer: number
  ): void {
    if (flashTimer <= 0) return;
    const u = THREE.MathUtils.clamp(flashTimer / 0.42, 0, 1);
    // Crisp retro horizontal static/scanline wipe during the first half of channel change
    if (u > 0.35) {
      const staticAlpha = (u - 0.35) / 0.65;
      c.fillStyle = `rgba(215, 232, 255, ${(staticAlpha * 0.42).toFixed(3)})`;
      for (let y = 0; y < rawH; y += 8) {
        if (((y / 8) + Math.floor(flashTimer * 40)) % 2 === 0) {
          c.fillRect(0, y, rawW, 4);
        }
      }
    }
    // Classic bright-green CRT channel OSD badge
    c.fillStyle = 'rgba(12, 22, 18, 0.78)';
    c.fillRect(rawW - 112, 38, 96, 30);
    c.font = 'bold 20px monospace';
    c.textAlign = 'center';
    c.fillStyle = '#62ff9a';
    c.fillText(`CH-0${channel + 1}`, rawW - 64, 59);
  }

  // =========================================================================
  // 4×4 Inventory, First-Person Toy Gun & Periodic Paper Airplane System
  // =========================================================================
  private setupInventoryAndToySystem(): void {
    this.heldItemAnchor.name = 'held_item_anchor';
    this.heldItemAnchor.userData.dynamic = true;
    this.camera.add(this.heldItemAnchor);

    // 1. First-person Toy Gun ViewModel
    this.heldToyGun = buildToyGunMesh(this.uniforms, this.outlines, { isViewModel: true });
    this.heldToyGun.group.position.set(0.24, -0.21, -0.43);
    this.heldToyGun.group.rotation.set(0.03, -0.09, -0.02);
    this.heldToyGun.group.scale.setScalar(0.92);
    this.heldToyGun.group.visible = false;
    this.heldItemAnchor.add(this.heldToyGun.group);

    // 2. First-person Held Paper Airplane Note ViewModel
    this.heldPaperNote = createHeldPaperNoteMesh(this.uniforms, this.outlines);
    this.heldPaperNote.position.set(0.21, -0.18, -0.37);
    this.heldPaperNote.visible = false;
    this.heldItemAnchor.add(this.heldPaperNote);

    // 2b. First-person Protagonist Gaming Arms + White Xbox Controller Viewmodel & Heroine Held Controllers
    this.protagonistGamingRig = buildProtagonistGamingArmsRig(this.uniforms, this.outlines);
    this.heldItemAnchor.add(this.protagonistGamingRig.group);
    const heroineWhitePad = buildXboxControllerMesh(this.uniforms, 'white', this.outlines, {
      addOutline: true,
    });
    const heroinePurplePad = buildXboxControllerMesh(this.uniforms, 'purple', this.outlines, {
      addOutline: true,
    });
    this.vrmAvatar.heroine.registerHeldControllerMeshes(heroineWhitePad, heroinePurplePad);

    // 3. Projectiles & Hit Spark FX containers
    this.projectileGroup.name = 'toy_projectiles';
    this.projectileGroup.userData.noProjectileHit = true;
    this.scene.add(this.projectileGroup);

    this.fxGroup.name = 'toy_hit_fx';
    this.fxGroup.userData.noProjectileHit = true;
    this.scene.add(this.fxGroup);

    // 4. Pre-allocate ZERO-STUTTER Projectile & FX Pools (compiled during prewarmGpuResources!)
    this.projectileAssets = createSharedProjectileAssets();

    this.dartPool = [];
    for (let i = 0; i < 16; i++) {
      const rig = createPooledSuctionDart(this.projectileAssets);
      this.projectileGroup.add(rig.group);
      this.dartPool.push({
        rig,
        active: false,
        vel: new THREE.Vector3(),
        stuck: false,
        age: 0,
        stuckAge: 0,
        wobbleTime: 0,
        wobbleAmp: 0,
        baseQuat: new THREE.Quaternion(),
        spawnOrder: 0,
      });
    }

    this.netPool = [];
    for (let i = 0; i < 8; i++) {
      const rig = createPooledCaptureNet(this.projectileAssets);
      this.projectileGroup.add(rig.group);
      this.netPool.push({
        rig,
        active: false,
        vel: new THREE.Vector3(),
        age: 0,
        deployTime: 0,
        deployedAudioPlayed: false,
        draped: false,
        drapeAge: 0,
        spawnOrder: 0,
      });
    }

    const sharedSparkGeo = new THREE.OctahedronGeometry(0.022, 0);
    const sharedRingGeo = new THREE.RingGeometry(0.48, 1.0, 18);
    this.sparkPool = [];
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfff0a8,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(sharedSparkGeo, mat);
      mesh.visible = false;
      this.fxGroup.add(mesh);
      this.sparkPool.push({
        mesh,
        mat,
        active: false,
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 0.35,
      });
    }
    this.ringPool = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe47a,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(sharedRingGeo, mat);
      mesh.visible = false;
      this.fxGroup.add(mesh);
      this.ringPool.push({
        mesh,
        mat,
        active: false,
        age: 0,
        maxAge: 0.24,
        baseRadius: 0.14,
      });
    }

    // 5. Periodic Living Room Paper Airplane entity
    this.paperAirplaneRig = createPaperAirplaneRig(this.uniforms, this.outlines);
    this.paperAirplaneRig.group.visible = false;
    this.paperAirplaneRig.group.userData.noProjectileHit = true;
    this.scene.add(this.paperAirplaneRig.group);

    this.emitInventorySnapshot();
  }

  public getInventorySnapshot(): InventorySnapshot {
    return {
      slots: this.inventorySlots.slice(),
      selectedSlot: this.selectedInventorySlot,
      equippedSlot: this.equippedInventorySlot,
      ammoType: this.toyGunAmmoType,
      paperAirplaneCaptured: this.paperAirplaneCaptured,
    };
  }

  private emitInventorySnapshot(): void {
    this.callbacks.onInventoryChange?.(this.getInventorySnapshot());
  }

  private getEquippedItem(): InventoryItem | null {
    if (this.equippedInventorySlot === null) return null;
    return this.inventorySlots[this.equippedInventorySlot] ?? null;
  }

  private findItemSlot(id: InventoryItemId): number {
    return this.inventorySlots.findIndex((item) => item?.id === id);
  }

  private addItemToInventory(id: InventoryItemId): number {
    const existing = this.findItemSlot(id);
    if (existing !== -1) return existing;
    const freeIdx = this.inventorySlots.findIndex((slot) => slot === null);
    if (freeIdx === -1) return -1;
    this.inventorySlots[freeIdx] = { ...INVENTORY_CATALOG[id] };
    // Auto-select the newly obtained item if selected slot was empty
    if (!this.inventorySlots[this.selectedInventorySlot]) {
      this.selectedInventorySlot = freeIdx;
    }
    this.emitInventorySnapshot();
    return freeIdx;
  }

  private collectWorldInventoryItem(itemId: InventoryItemId, interactableId: string): void {
    const slot = this.addItemToInventory(itemId);
    if (itemId === 'toy_gun') {
      const mesh = this.ctx.metaState.toyGunWorldMesh;
      if (mesh) {
        mesh.visible = false;
      }
      // Hide interactable proxy so it can't be picked up twice
      for (const t of this.interactRaycastTargets) {
        if (t.userData.interactId === interactableId) {
          t.visible = false;
        }
      }
      this.hoveredTarget = null;
      this.callbacks.onHoverTarget(null);

      // Select & gently cue the Paper Airplane to drift into the Living Room soon!
      if (slot !== -1) {
        this.selectedInventorySlot = slot;
      }
      if (!this.paperAirplaneCaptured && this.paperPlaneState.phase === 'cooldown') {
        this.paperPlaneState.timer = Math.min(this.paperPlaneState.timer, 1.5);
      }
      this.emitInventorySnapshot();
    }
  }

  public selectInventorySlot(slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= this.inventorySlots.length) return;
    this.selectedInventorySlot = slotIndex;
    this.emitInventorySnapshot();
  }

  public toggleEquipSelectedItem(slotIndex?: number): void {
    const idx = slotIndex !== undefined ? slotIndex : this.selectedInventorySlot;
    let targetIdx = idx;
    if (!this.inventorySlots[targetIdx]) {
      // If selected slot is empty and nothing is equipped, grab the first owned item
      if (this.equippedInventorySlot !== null) {
        this.equippedInventorySlot = null;
        this.audio.playEquipToggle(false);
        this.syncHeldViewModelVisibility();
        this.emitInventorySnapshot();
        return;
      }
      const firstOwned = this.inventorySlots.findIndex((item) => item !== null);
      if (firstOwned === -1) {
        this.callbacks.onInteractResult({
          title: '背包空空如也',
          message: '还没有可装备的物品。去客厅沙发上看看那把儿童塑料玩具枪吧！',
        });
        return;
      }
      targetIdx = firstOwned;
    }

    this.selectedInventorySlot = targetIdx;
    if (this.equippedInventorySlot === targetIdx) {
      this.equippedInventorySlot = null;
      this.audio.playEquipToggle(false);
    } else {
      this.equippedInventorySlot = targetIdx;
      this.heldEquipAnim = 0;
      this.audio.playEquipToggle(true);
    }
    this.syncHeldViewModelVisibility();
    this.emitInventorySnapshot();
  }

  public cycleInventoryItem(direction: 1 | -1): void {
    const ownedIndices: number[] = [];
    for (let i = 0; i < this.inventorySlots.length; i++) {
      if (this.inventorySlots[i]) ownedIndices.push(i);
    }
    if (ownedIndices.length === 0) return;

    if (ownedIndices.length === 1) {
      const onlySlot = ownedIndices[0];
      this.selectedInventorySlot = onlySlot;
      if (this.equippedInventorySlot !== onlySlot) {
        this.equippedInventorySlot = onlySlot;
        this.heldEquipAnim = 0;
        this.audio.playEquipToggle(true);
      }
      this.syncHeldViewModelVisibility();
      this.emitInventorySnapshot();
      return;
    }

    const curPos = ownedIndices.indexOf(
      this.equippedInventorySlot !== null ? this.equippedInventorySlot : this.selectedInventorySlot
    );
    const nextPos = (curPos + direction + ownedIndices.length) % ownedIndices.length;
    const nextSlot = ownedIndices[nextPos];
    this.selectedInventorySlot = nextSlot;
    this.equippedInventorySlot = nextSlot;
    this.heldEquipAnim = 0;
    this.audio.playEquipToggle(true);
    this.syncHeldViewModelVisibility();
    this.emitInventorySnapshot();
  }

  public switchToyGunAmmo(target?: ToyGunAmmoType): void {
    if (this.findItemSlot('toy_gun') === -1) return;
    const nextAmmo: ToyGunAmmoType =
      target ?? (this.toyGunAmmoType === 'dart' ? 'net' : 'dart');
    if (nextAmmo === this.toyGunAmmoType && target) return;

    this.toyGunAmmoType = nextAmmo;
    this.heldToyGun.setAmmoType(nextAmmo);
    this.heldToyGun.spinDrum(Math.PI / 3);
    this.gunSwitchTilt = 1.0;
    this.audio.playAmmoSwitch(nextAmmo);
    this.emitInventorySnapshot();
  }

  public playInventorySound(open: boolean): void {
    this.audio.unlock();
    this.audio.playInventoryToggle(open);
  }

  public playPaperUnfoldSound(): void {
    this.audio.unlock();
    this.audio.playPaperUnfold();
  }

  private syncHeldViewModelVisibility(): void {
    const equipped = this.getEquippedItem();
    const hasCustomVrm = this.vrmAvatar?.hasVrm() ?? false;
    const isCoPlayView =
      (this.coPlayState === 'handoff_reach' || this.coPlayState === 'playing') &&
      hasCustomVrm;
    const canShow =
      this.viewMode === 'first-person' &&
      !this.thirdPersonPreview &&
      this.pcFocusState === 'none' &&
      (isCoPlayView || (this.sofaSitState === 'none' && equipped !== null));
    this.heldItemAnchor.visible = canShow;
    this.heldToyGun.group.visible =
      this.sofaSitState === 'none' && !isCoPlayView && canShow && equipped?.id === 'toy_gun';
    this.heldPaperNote.visible =
      this.sofaSitState === 'none' &&
      !isCoPlayView &&
      canShow &&
      equipped?.id === 'paper_airplane_note';
  }

  public getLocalAvatarStatus(): VrmAvatarStatusSnapshot {
    return this.vrmAvatar.getStatus();
  }

  public subscribeLocalAvatarStatus(
    listener: (status: VrmAvatarStatusSnapshot) => void
  ): () => void {
    this.vrmStatusListeners.add(listener);
    listener(this.vrmAvatar.getStatus());
    return () => {
      this.vrmStatusListeners.delete(listener);
    };
  }

  public async importLocalAvatarFile(slot: LocalAssetSlot, file: File): Promise<void> {
    await this.vrmAvatar.importLocalFile(slot, file);
  }

  public async importLocalAvatarBackupPackage(file: File): Promise<{
    slotCount: number;
    poseCount: number;
    heroineSpawned: boolean;
  }> {
    return this.vrmAvatar.importBackupPackage(file);
  }

  public async removeLocalAvatarSlot(slot: LocalAssetSlot): Promise<void> {
    await this.vrmAvatar.removeSlot(slot);
  }

  public async clearLocalAvatarCache(): Promise<void> {
    await this.vrmAvatar.clearAll();
  }

  public setThirdPersonPreview(enabled: boolean): void {
    this.thirdPersonPreview = enabled;
    const isOverview = this.viewMode === 'overview';
    this.protagonist?.setRenderPassMode(
      isOverview || enabled ? 'overview' : 'first-person'
    );
    this.vrmAvatar?.setRenderPassMode(
      isOverview ? 'overview' : enabled ? 'third-person' : 'first-person'
    );
    this.syncHeldViewModelVisibility();
    if (!isOverview && this.pcFocusState === 'none') {
      this.applyCameraFromPlayer();
    }
  }

  /**
   * Public Right-Hand Two-Bone IK hook for mounting flashlights, tools, or held props.
   */
  public setRightHandIK(
    targetWorldPos: THREE.Vector3 | null,
    weight: number,
    options?: RightHandIkOptions
  ): void {
    this.manualPropIkActive = Boolean(targetWorldPos) && weight > 0.001;
    if (this.manualPropIkActive) {
      this.activeDoorIk = null;
    }
    this.vrmAvatar?.setRightHandIK(targetWorldPos, weight, options);
  }

  /**
   * Public Right-Hand Finger Grasp hook ('relaxed' | 'door' | 'hold' | 'pistol').
   */
  public setRightHandGrasp(graspAmount: number, preset: HandGraspPreset = 'hold'): void {
    this.vrmAvatar?.setRightHandGrasp(graspAmount, preset);
  }

  /**
   * Spawns and seats the Heroine VRM on the bedroom bed-edge anchor facing the door.
   */
  public spawnHeroineOnBedroomBed(): void {
    this.vrmAvatar?.spawnHeroineOnBedroomBed();
  }

  public setHeroineSpawned(spawned: boolean): void {
    if (!spawned) {
      this.heroineEncounterActive = false;
      this.ambientMurmurTimer = 0;
      if (this.sofaSitState !== 'none') {
        this.sofaSitState = 'none';
        this.playerFeetPos.copy(this.sofaSavedStandPos);
        this.callbacks.onSofaCoSitChange?.({
          active: false,
          tvOn: this.ctx.metaState.livingTv.isOn,
        });
      }
      this.floatingSubtitles?.clearImmediate();
    }
    this.vrmAvatar?.setHeroineSpawned(spawned);
  }

  public setEncounterProjectionListener(
    listener: ((proj: EncounterSpatialProjection) => void) | null
  ): void {
    this.encounterProjectionListener = listener;
  }

  private readonly resolveHeroineFollowMove: HeroineMoveResolver = (
    currX,
    currZ,
    nextX,
    nextZ,
    currY
  ) => {
    const res = this.ctx.collisions.resolveMovement(currX, currZ, nextX, nextZ, currY, 0.26);
    const y = this.ctx.collisions.getFloorHeightAt(res.x, res.z, currY);
    return { x: res.x, y, z: res.z };
  };

  public setHeroinePoseTuner(state: HeroinePoseTunerState | null): void {
    if (state !== null) {
      this.heroineEncounterActive = false;
      this.ambientMurmurTimer = 0;
      if (this.sofaSitState !== 'none') {
        this.sofaSitState = 'none';
        this.playerFeetPos.copy(this.sofaSavedStandPos);
        this.callbacks.onSofaCoSitChange?.({
          active: false,
          tvOn: this.ctx.metaState.livingTv.isOn,
        });
      }
      this.floatingSubtitles.clearImmediate();
    }
    this.vrmAvatar?.heroine.setPoseTunerState(state, this.playerFeetPos);
  }

  private computeHeroinePromptKind(): 'bed' | 'chat' | 'sofa' | null {
    const heroine = this.vrmAvatar?.heroine;
    if (
      !heroine ||
      !heroine.hasVrm() ||
      !heroine.isSpawned() ||
      heroine.isPoseTuning() ||
      this.heroineEncounterActive ||
      this.sofaSitState !== 'none' ||
      this.viewMode !== 'first-person' ||
      this.pcFocusState !== 'none' ||
      this.glitchCutscene !== null
    ) {
      return null;
    }

    if (this.hoveredTarget?.id === 'item_toy_gun') {
      return null;
    }

    // 1. First-time bedroom bed-edge encounter
    if (this.currentRoom === 'bedroom' && heroine.isSeated()) {
      return heroine.getDistanceToWorldPoint(this.playerFeetPos) < 3.45 ? 'bed' : null;
    }

    // 2. Post-dialogue Living Room sofa co-sitting vs routine chat
    if (heroine.isFollowingPlayer()) {
      const distToHeroine = heroine.getDistanceToWorldPoint(this.playerFeetPos);

      // Check if standing near Living Room south/center sofa cushions (separate from north toy gun at Z=-6.42)
      if (
        this.currentRoom === 'living' &&
        this.playerFeetPos.z > -5.90 &&
        this.playerFeetPos.z < -3.70
      ) {
        const distToSofaFront = Math.hypot(
          this.playerFeetPos.x - 2.95,
          this.playerFeetPos.z - (-4.85)
        );
        if (distToSofaFront < 2.45 && this.playerFeetPos.x < 4.55) {
          this.camera.getWorldDirection(this.toyGunAimDirScratch);
          this.toyGunToHeroineScratch
            .set(2.45 - this.camera.position.x, 0.55 - this.camera.position.y, -4.85 - this.camera.position.z)
            .normalize();
          const sofaDot = this.toyGunAimDirScratch.dot(this.toyGunToHeroineScratch);

          heroine.getHeadWorldPosition(this.encounterHeadPosScratch);
          this.toyGunToHeroineScratch
            .subVectors(this.encounterHeadPosScratch, this.camera.position)
            .normalize();
          const heroineDot = this.toyGunAimDirScratch.dot(this.toyGunToHeroineScratch);

          if (sofaDot > 0.62 && (distToHeroine > 2.85 || sofaDot >= heroineDot - 0.08)) {
            return 'sofa';
          }
        }
      }

      if (distToHeroine < 3.05) {
        return 'chat';
      }
    }

    return null;
  }

  private getSofaMenuOptions(): SofaMenuOptionId[] {
    const tvOn = this.ctx.metaState.livingTv.isOn;
    if (this.coPlayState === 'none') {
      if (!this.heroineEncounterActive) {
        return [
          'play_game',
          'chat',
          'toggle_tv',
          ...(tvOn ? (['switch_channel'] as const) : []),
          'stand_up',
        ];
      }
      return [
        'toggle_tv',
        ...(tvOn ? (['switch_channel'] as const) : []),
        'stand_up',
      ];
    }
    if (this.coPlayState === 'playing') {
      return [
        'snowball',
        'tank',
        ...(this.livingTvGames.mode !== 'launcher' ? (['launcher'] as const) : []),
        'stop_coplay',
        'stand_up',
      ];
    }
    return ['stand_up'];
  }

  private getActiveSofaMenuOption(): SofaMenuOptionId {
    const opts = this.getSofaMenuOptions();
    const idx = ((this.sofaMenuIndex % opts.length) + opts.length) % opts.length;
    this.sofaMenuIndex = idx;
    return opts[idx];
  }

  private emitSofaCoSitState(): void {
    this.callbacks.onSofaCoSitChange?.({
      active: this.sofaSitState === 'sitting' || this.sofaSitState === 'seated',
      tvOn: this.ctx.metaState.livingTv.isOn,
      activeOption: this.getActiveSofaMenuOption(),
    });
  }

  private executeSofaMenuOption(option: SofaMenuOptionId): void {
    switch (option) {
      case 'play_game':
        if (this.sofaSitState === 'seated') {
          this.startSofaCoPlay();
        }
        break;
      case 'chat':
        this.callbacks.onRequestStartRoutineChat?.('sofa');
        break;
      case 'toggle_tv': {
        const nextOn = this.toggleLivingRoomTv();
        this.callbacks.onHeroineSofaTvToggled?.(nextOn);
        if (!nextOn && this.coPlayState !== 'none') {
          this.stopSofaCoPlay();
        }
        break;
      }
      case 'switch_channel':
        this.switchLivingRoomTvChannel(true);
        break;
      case 'snowball':
        this.selectLivingTvGame('snowball', true);
        break;
      case 'tank':
        this.selectLivingTvGame('tank', true);
        break;
      case 'launcher':
        this.returnLivingTvToLauncher();
        break;
      case 'stop_coplay':
        this.stopSofaCoPlay();
        break;
      case 'stand_up':
        this.standUpFromSofaCoSit();
        break;
    }
  }

  public startSofaCoSit(): void {
    const heroine = this.vrmAvatar?.heroine;
    if (
      !heroine ||
      !heroine.hasVrm() ||
      !heroine.isSpawned() ||
      this.sofaSitState !== 'none' ||
      this.heroineEncounterActive
    ) {
      return;
    }

    this.ambientMurmurTimer = 0;
    this.floatingSubtitles.dropCurrentLine();
    this.hoveredTarget = null;
    this.callbacks.onHoverTarget(null);
    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }

    // Release pointer lock cleanly so the player can immediately click sofa buttons or the TV,
    // while still being able to drag-look freely around the living room!
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }

    // Record clean unobstructed standing spot in the living room walkway in front of the sofa
    this.sofaSavedStandPos.set(
      3.48,
      0,
      THREE.MathUtils.clamp(this.playerFeetPos.z, -6.2, -4.1)
    );
    this.sofaSavedStandYaw = this.yaw;
    this.sofaSavedStandPitch = this.pitch;
    this.sofaCamPos.copy(this.camera.position);
    this.sofaSitState = 'sitting';
    this.sofaStateElapsed = 0;
    this.sofaMenuIndex = 0;
    this.keys = {};
    this.syncHeldViewModelVisibility();

    const tvOn = this.ctx.metaState.livingTv.isOn;
    heroine.setSofaTvIsOn(tvOn);
    heroine.beginSitOnLivingSofa(
      new THREE.Vector3(2.74, 0, -5.68),
      new THREE.Vector3(3.14, 0, -5.68),
      0.495,
      Math.PI / 2,
      new THREE.Vector3(6.74, 1.28, -5.08),
      () => {
        if (!this.heroineEncounterActive && this.sofaSitState !== 'none') {
          heroine.triggerSofaBriefReaction(
            {
              expression: 'happy',
              gesture: 'idle',
              blush: 0.24,
              headTilt: 0.06,
              leanForward: 0.04,
            },
            3.6
          );
          this.showAmbientHeroineMurmur('哇，沙发好软呀～要不要顺便把电视打开看看？', 4.2, true);
        }
      }
    );

    this.audio.playInteract(false);
    this.emitSofaCoSitState();
  }

  public standUpFromSofaCoSit(): void {
    if (this.sofaSitState === 'none' || this.sofaSitState === 'standing') return;
    if (this.coPlayState !== 'none') {
      this.stopSofaCoPlay();
    }
    if (this.heroineEncounterActive) {
      this.finishRoutineHeroineChat();
    }
    this.ambientMurmurTimer = 0;
    this.floatingSubtitles.dropCurrentLine();
    this.sofaSitState = 'standing';
    this.sofaStateElapsed = 0;
    this.sofaMenuIndex = 0;
    this.vrmAvatar?.heroine.beginStandUpFromLivingSofa(new THREE.Vector3(3.14, 0, -5.68));
    this.audio.playInteract(false);
    this.emitSofaCoSitState();
  }

  private emitSofaCoPlayState(): void {
    const phase: 'none' | 'fetching' | 'playing' =
      this.coPlayState === 'none'
        ? 'none'
        : this.coPlayState === 'playing'
          ? 'playing'
          : 'fetching';
    this.callbacks.onSofaCoPlayChange?.({
      phase,
      tvScreenMode: this.livingTvGames.mode,
      selectedGame: this.livingTvGames.selectedGame,
      activeOption: this.getActiveSofaMenuOption(),
    });
  }

  public startSofaCoPlay(): void {
    const heroine = this.vrmAvatar?.heroine;
    if (
      !heroine ||
      !heroine.hasVrm() ||
      !heroine.isSpawned() ||
      this.sofaSitState !== 'seated' ||
      this.coPlayState !== 'none' ||
      heroine.isCoPlayCutsceneBusy()
    ) {
      return;
    }
    if (this.heroineEncounterActive) {
      this.finishRoutineHeroineChat();
    }

    const tv = this.ctx.metaState.livingTv;
    tv.channel = 0;
    tv.channelTimer = 0;
    tv.accum = 1.0;
    this.livingTvGames.returnToLauncher();
    if (!tv.isOn) {
      const nextOn = this.toggleLivingRoomTv();
      this.callbacks.onHeroineSofaTvToggled?.(nextOn);
    }

    this.coPlayState = 'fetching';
    this.coPlayHandoffProgress = 0;
    this.coPlayActionPulse = 0;
    this.sofaMenuIndex = 0;
    this.emitSofaCoPlayState();
    this.audio.playInteract(true);
    this.showAmbientHeroineMurmur('好呀！我去茶几把两只 Xbox 手柄拿过来，等我一下～', 3.8, true);

    heroine.beginSofaCoPlayCutscene({
      onPickedUpFromTable: () => {
        const consoleProps = this.ctx.metaState.livingConsole;
        if (consoleProps.tableWhitePad) consoleProps.tableWhitePad.visible = false;
        if (consoleProps.tablePurplePad) consoleProps.tablePurplePad.visible = false;
        this.audio.playInteract(false);
        this.shadowDirty = true;
      },
      onHandoffStart: () => {
        if (this.coPlayState !== 'fetching') return;
        this.coPlayState = 'handoff_reach';
        this.coPlayHandoffProgress = 0;
        this.syncHeldViewModelVisibility();
        this.showAmbientHeroineMurmur('给，白色手柄是你的，浅紫色归我～接着！', 3.4, true);
      },
      onWhitePadTaken: () => {
        this.audio.playEquipToggle(true);
      },
      onBackSeated: () => {
        if (this.coPlayState === 'none') return;
        this.coPlayState = 'playing';
        this.sofaMenuIndex = 0;
        this.livingTvGames.returnToLauncher();
        this.ctx.metaState.livingTv.channel = 0;
        this.ctx.metaState.livingTv.accum = 1.0;
        this.syncHeldViewModelVisibility();
        this.emitSofaCoPlayState();
        this.audio.playInteract(true);
        this.showAmbientHeroineMurmur('好啦！看着电视选一局吧：双人打雪仗还是坦克大战？', 4.4, true);
      },
    });
  }

  public stopSofaCoPlay(): void {
    if (this.coPlayState === 'none') return;
    this.coPlayState = 'none';
    this.coPlayHandoffProgress = 0;
    this.coPlayActionPulse = 0;
    this.sofaMenuIndex = 0;
    const consoleProps = this.ctx.metaState.livingConsole;
    if (consoleProps.tableWhitePad) consoleProps.tableWhitePad.visible = true;
    if (consoleProps.tablePurplePad) consoleProps.tablePurplePad.visible = true;
    this.vrmAvatar?.heroine.endSofaCoPlay();
    this.protagonistGamingRig?.setState('hidden', 0, 0, 0, 0, 0);
    this.livingTvGames.returnToLauncher();
    this.ctx.metaState.livingTv.accum = 1.0;
    this.syncHeldViewModelVisibility();
    this.emitSofaCoPlayState();
    this.emitSofaCoSitState();
    this.shadowDirty = true;
  }

  public selectLivingTvGame(game: TvGameSelectionId, launchNow = true): void {
    const tv = this.ctx.metaState.livingTv;
    if (!tv.isOn) {
      const nextOn = this.toggleLivingRoomTv();
      this.callbacks.onHeroineSofaTvToggled?.(nextOn);
    }
    tv.channel = 0;
    tv.channelTimer = 0;
    if (launchNow) {
      this.livingTvGames.launchGame(game);
      this.sofaMenuIndex = 2; // Highlight "游戏选单" cleanly once match begins
    } else {
      this.livingTvGames.selectLauncherCard(game);
    }
    tv.accum = 1.0;
    this.audio.playInteract(true);
    this.emitSofaCoPlayState();
  }

  public returnLivingTvToLauncher(): void {
    this.livingTvGames.returnToLauncher();
    this.ctx.metaState.livingTv.channel = 0;
    this.ctx.metaState.livingTv.accum = 1.0;
    this.sofaMenuIndex = 0;
    this.audio.playInteract(false);
    this.emitSofaCoPlayState();
  }

  private applyLivingTvMaterialState(isOn: boolean): void {
    const mat = this.ctx.metaState.tvScreenMat;
    if (!mat) return;
    const tv = this.ctx.metaState.livingTv;
    const activeTex = isOn && tv.texture ? tv.texture : this.textures.tvStandby;
    // Darken diffuse albedo when ON so daylight sun/hemi doesn't double-expose the emissive LCD,
    // and cap emissiveIntensity strictly below UnrealBloomPass threshold (0.72) for razor-sharp clarity!
    mat.color.setHex(isOn ? 0x101018 : 0xffffff);
    mat.map = activeTex;
    mat.emissiveMap = activeTex;
    mat.emissive.setHex(isOn ? 0xffffff : 0xffe8d6);
    mat.emissiveIntensity = isOn ? 0.62 : 0.16;
    mat.roughness = isOn ? 0.42 : 0.56;
    mat.envMapIntensity = isOn ? 0.03 : 0.06;
    mat.needsUpdate = true;
  }

  public toggleLivingRoomTv(): boolean {
    const tv = this.ctx.metaState.livingTv;
    const nextOn = !tv.isOn;
    tv.isOn = nextOn;
    this.ctx.metaState.tvMetaOn = nextOn;
    this.applyLivingTvMaterialState(nextOn);
    if (tv.ledMat) {
      tv.ledMat.color.setHex(nextOn ? 0x52ff9a : 0xff5268);
    }
    if (nextOn) {
      tv.accum = 1.0;
      tv.channelTimer = 0;
      tv.switchFlashTimer = 0.36;
    }
    this.audio.playInteract(true);
    this.vrmAvatar?.heroine.setSofaTvIsOn(nextOn);
    if (this.sofaSitState !== 'none') {
      this.emitSofaCoSitState();
      if (!this.heroineEncounterActive) {
        if (nextOn) {
          this.vrmAvatar?.heroine.triggerSofaBriefReaction(
            {
              expression: 'happy',
              gesture: 'talk_lively',
              blush: 0.28,
              headTilt: 0.08,
              leanForward: 0.08,
            },
            4.5
          );
          this.showAmbientHeroineMurmur('哇，这个像素小人蹦得好可爱！我们就这么窝在沙发上看一会儿吧～', 4.6, true);
        } else {
          this.vrmAvatar?.heroine.triggerSofaBriefReaction(
            {
              expression: 'happy',
              gesture: 'idle',
              blush: 0.26,
              headTilt: -0.05,
              leanForward: 0.04,
            },
            4.0
          );
          this.showAmbientHeroineMurmur('关掉电视以后客厅好安静呀……只听见我们俩的声音呢。', 4.2, true);
        }
      }
    }
    this.shadowDirty = true;
    return nextOn;
  }

  public switchLivingRoomTvChannel(manual = true): number {
    const tv = this.ctx.metaState.livingTv;
    if (!tv.isOn) {
      if (manual) {
        this.toggleLivingRoomTv();
      }
      return tv.channel;
    }
    tv.channel = (tv.channel + 1) % 3;
    tv.channelTimer = 0;
    tv.switchFlashTimer = 0.42;
    tv.accum = 1.0;
    if (manual) {
      this.audio.playInteract(true);
    }
    this.vrmAvatar?.heroine.notifySofaTvProgramSwitch();
    return tv.channel;
  }

  public getHeroineIntimacy(): number {
    return this.heroineIntimacy;
  }

  public adjustHeroineIntimacy(delta: number, minFloor = 0): number {
    const next = THREE.MathUtils.clamp(this.heroineIntimacy + delta, minFloor, 100);
    this.heroineIntimacy = next;
    this.vrmAvatar?.heroine.setIntimacy(next);
    try {
      window.localStorage.setItem('twilight_ark_heroine_intimacy_v1', String(Math.round(next)));
    } catch {
      // Ignore storage quota / privacy mode errors
    }
    return next;
  }

  private loadPersistedHeroineIntimacy(): void {
    try {
      const raw = window.localStorage.getItem('twilight_ark_heroine_intimacy_v1');
      if (raw !== null) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          this.heroineIntimacy = THREE.MathUtils.clamp(parsed, 0, 100);
        }
      }
    } catch {
      // Keep default intimacy
    }
  }

  public isLivingRoomTvOn(): boolean {
    return this.ctx.metaState.livingTv.isOn;
  }

  public isSofaCoSeated(): boolean {
    return this.sofaSitState === 'sitting' || this.sofaSitState === 'seated';
  }

  public showAmbientHeroineMurmur(text: string, durationSec = 3.8, hearts = false): void {
    if (this.heroineEncounterActive) return;
    this.floatingSubtitles.showLine(text, { hearts });
    this.ambientMurmurTimer = durationSec;
  }

  public startHeroineEncounter(onArrived: () => void): void {
    const heroine = this.vrmAvatar?.heroine;
    if (!heroine || !heroine.hasVrm() || !heroine.isSpawned()) return;

    this.ambientMurmurTimer = 0;
    this.heroineEncounterActive = true;
    this.encounterIsMainBedroom = true;
    this.encounterInactivityTimer = 0;
    this.hoveredTarget = null;
    this.callbacks.onHoverTarget(null);
    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }
    this.audio.playInteract(false);
    heroine.beginStandUpAndApproach(this.playerFeetPos, onArrived);
  }

  public notifyEncounterPlayerInteraction(): void {
    this.encounterInactivityTimer = 0;
    const heroine = this.vrmAvatar?.heroine;
    if (heroine && heroine.isBedroomIdleChairWaiting()) {
      heroine.exitBedroomIdleChairWait();
    }
  }

  public startRoutineHeroineChat(): void {
    const heroine = this.vrmAvatar?.heroine;
    if (!heroine || !heroine.hasVrm() || !heroine.isSpawned()) return;

    this.ambientMurmurTimer = 0;
    this.heroineEncounterActive = true;
    this.encounterIsMainBedroom = false;
    this.encounterInactivityTimer = 0;
    this.hoveredTarget = null;
    this.callbacks.onHoverTarget(null);
    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }
    this.audio.playInteract(false);
    heroine.beginRoutineChat();
  }

  public finishRoutineHeroineChat(): void {
    this.heroineEncounterActive = false;
    this.ambientMurmurTimer = 0;
    this.floatingSubtitles.dropCurrentLine();
    this.adjustHeroineIntimacy(6);
    this.vrmAvatar?.heroine.endRoutineChat(this.playerFeetPos);
    if (this.heroineTypingReported) {
      this.heroineTypingReported = false;
      this.callbacks.onHeroineTypingChange?.(false);
    }
  }

  public showHeroineSubtitle(text: string, options?: ShowSubtitleOptions): void {
    this.ambientMurmurTimer = 0;
    this.floatingSubtitles.showLine(text, options);
    this.heroineTypingReported = true;
    this.callbacks.onHeroineTypingChange?.(true);
  }

  public runHeroineStageAction(action: HeroineStageAction, onReady: () => void): void {
    const heroine = this.vrmAvatar?.heroine;
    if (!heroine || !heroine.hasVrm() || !heroine.isSpawned()) {
      onReady();
      return;
    }
    heroine.runDialogueStageAction(action, this.playerFeetPos, onReady);
  }

  public completeHeroineSubtitleTyping(): boolean {
    if (!this.floatingSubtitles.isCurrentlyTyping()) return false;
    this.floatingSubtitles.completeTypingNow();
    this.heroineTypingReported = false;
    this.callbacks.onHeroineTypingChange?.(false);
    return true;
  }

  public dropHeroineSubtitle(): void {
    this.floatingSubtitles.dropCurrentLine();
    if (this.heroineTypingReported) {
      this.heroineTypingReported = false;
      this.callbacks.onHeroineTypingChange?.(false);
    }
  }

  public setHeroinePerformance(cue: HeroinePerformanceCue): void {
    this.vrmAvatar?.heroine.setPerformanceCue(cue);
  }

  public finishHeroineEncounter(): void {
    this.heroineEncounterActive = false;
    this.encounterIsMainBedroom = false;
    this.encounterInactivityTimer = 0;
    this.ambientMurmurTimer = 0;
    this.floatingSubtitles.dropCurrentLine();
    this.adjustHeroineIntimacy(Math.max(10, 62 - this.heroineIntimacy));
    this.vrmAvatar?.heroine.setSpeaking(false);
    this.vrmAvatar?.heroine.setPerformanceCue({
      expression: 'neutral',
      gesture: 'idle',
      blush: 0,
      headTilt: 0,
      leanForward: 0,
      eyeAvert: false,
    });
    this.vrmAvatar?.heroine.startFollowingPlayer(this.playerFeetPos);
    if (this.heroineTypingReported) {
      this.heroineTypingReported = false;
      this.callbacks.onHeroineTypingChange?.(false);
    }
  }

  public resetHeroineToBed(): void {
    this.heroineEncounterActive = false;
    this.encounterIsMainBedroom = false;
    this.encounterInactivityTimer = 0;
    this.ambientMurmurTimer = 0;
    if (this.coPlayState !== 'none') {
      this.stopSofaCoPlay();
    }
    if (this.sofaSitState !== 'none') {
      this.sofaSitState = 'none';
      this.playerFeetPos.copy(this.sofaSavedStandPos);
      this.callbacks.onSofaCoSitChange?.({
        active: false,
        tvOn: this.ctx.metaState.livingTv.isOn,
      });
    }
    this.floatingSubtitles?.clearImmediate();
    this.vrmAvatar?.heroine.resetToBedroomBed();
    if (this.heroineNearReported) {
      this.heroineNearReported = false;
      this.callbacks.onHeroineProximityChange?.(false);
    }
    if (this.heroinePromptKindReported !== null) {
      this.heroinePromptKindReported = null;
      this.callbacks.onHeroinePromptChange?.(null);
    }
    if (this.heroineTypingReported) {
      this.heroineTypingReported = false;
      this.callbacks.onHeroineTypingChange?.(false);
    }
  }

  private projectWorldPointToScreen(
    worldPos: THREE.Vector3,
    vw: number,
    vh: number
  ): { visible: boolean; x: number; y: number; scale: number } {
    this.encounterProjScratch.copy(worldPos).project(this.camera);
    const inFront = this.encounterProjScratch.z >= -1 && this.encounterProjScratch.z <= 1;
    const x = (this.encounterProjScratch.x * 0.5 + 0.5) * vw;
    const y = (-this.encounterProjScratch.y * 0.5 + 0.5) * vh;
    const dist = Math.max(0.75, this.camera.position.distanceTo(worldPos));
    const scale = THREE.MathUtils.clamp(1.65 / dist, 0.86, 1.12);
    const onScreen = inFront && x > -80 && x < vw + 80 && y > -60 && y < vh + 60;
    return {
      visible: onScreen,
      x: THREE.MathUtils.clamp(x, 84, Math.max(84, vw - 84)),
      y: THREE.MathUtils.clamp(y, 68, Math.max(68, vh - 68)),
      scale,
    };
  }

  private updateHeroineEncounterFrame(dt: number, elapsed: number): void {
    const heroine = this.vrmAvatar?.heroine;
    const hasHeroine = Boolean(heroine && heroine.hasVrm() && heroine.isSpawned());

    // Keep heroine's TV awareness synced even if user toggled TV directly on screen
    if (hasHeroine && heroine) {
      heroine.setSofaTvIsOn(this.ctx.metaState.livingTv.isOn);
    }

    // Auto-fade non-blocking ambient murmurs (toy gun reaction / sofa TV reaction)
    if (this.ambientMurmurTimer > 0 && !this.heroineEncounterActive) {
      this.ambientMurmurTimer = Math.max(0, this.ambientMurmurTimer - dt);
      if (this.ambientMurmurTimer <= 0) {
        this.floatingSubtitles.dropCurrentLine();
      }
    }
    if (this.toyGunMurmurCooldown > 0) {
      this.toyGunMurmurCooldown = Math.max(0, this.toyGunMurmurCooldown - dt);
    }
    if (this.sofaMicroMurmurCooldown > 0) {
      this.sofaMicroMurmurCooldown = Math.max(0, this.sofaMicroMurmurCooldown - dt);
    }

    // Passive intimacy growth while cozily watching TV together on the sofa
    if (
      hasHeroine &&
      heroine &&
      this.sofaSitState === 'seated' &&
      this.ctx.metaState.livingTv.isOn &&
      !this.heroineEncounterActive
    ) {
      this.sofaIntimacyTickAccum += dt;
      if (this.sofaIntimacyTickAccum >= 10) {
        this.sofaIntimacyTickAccum -= 10;
        this.adjustHeroineIntimacy(1.5);
      }
      const fsmNotice = heroine.consumeSofaTvBehaviorNotice();
      if (fsmNotice && this.sofaMicroMurmurCooldown <= 0 && this.ambientMurmurTimer <= 0.1) {
        if (fsmNotice.state === 'shoulder_rest') {
          this.sofaMicroMurmurCooldown = 20;
          this.showAmbientHeroineMurmur('借你的肩膀靠一会儿……嗯，好暖和呀～', 4.4, true);
        } else if (fsmNotice.state === 'adjust_posture' && fsmNotice.fromProgramSwitch) {
          const lines = [
            '咦，换到这个节目啦？',
            '嗯？这个频道看着挺有意思的呢～',
            '换个舒服点的坐姿继续看吧～',
          ];
          const line = lines[this.sofaProgramSwitchMurmurIdx % lines.length];
          this.sofaProgramSwitchMurmurIdx += 1;
          this.sofaMicroMurmurCooldown = 11;
          this.showAmbientHeroineMurmur(line, 3.2, false);
        } else if (fsmNotice.state === 'scoot_closer') {
          this.sofaMicroMurmurCooldown = 20;
          this.showAmbientHeroineMurmur('稍微往你这边靠一点，一起看更开心呢～', 4.0, true);
        } else if (fsmNotice.state === 'side_glance_smile') {
          this.sofaMicroMurmurCooldown = 22;
          this.showAmbientHeroineMurmur('看你看得这么认真，忍不住想多瞧你两眼～', 3.8, true);
        }
      }
    } else if (hasHeroine && heroine) {
      this.sofaIntimacyTickAccum = 0;
      heroine.consumeSofaTvBehaviorNotice();
    }

    // Auto-chair waiting during unfinished bedroom encounter:
    // If the player walks out of the bedroom OR doesn't interact for >10s, she walks to the
    // bedroom swivel chair, sits down, and passes the time with cute little fidgets!
    if (
      hasHeroine &&
      heroine &&
      this.heroineEncounterActive &&
      this.encounterIsMainBedroom &&
      !heroine.isPoseTuning()
    ) {
      if (this.currentRoom !== 'bedroom') {
        if (!heroine.isBusyWithStageAction() && !heroine.isBedroomIdleChairWaiting()) {
          heroine.enterBedroomIdleChairWait(this.playerFeetPos);
        }
      } else if (
        !heroine.isBusyWithStageAction() &&
        !this.floatingSubtitles.isCurrentlyTyping() &&
        !heroine.isBedroomIdleChairWaiting()
      ) {
        this.encounterInactivityTimer += dt;
        if (this.encounterInactivityTimer >= 10.0) {
          heroine.enterBedroomIdleChairWait(this.playerFeetPos);
        }
      } else if (this.floatingSubtitles.isCurrentlyTyping()) {
        this.encounterInactivityTimer = 0;
      }
    } else {
      this.encounterInactivityTimer = 0;
    }

    // 1. Contextual proximity prompt ('bed' | 'chat' | 'sofa' | null)
    const promptKind = this.computeHeroinePromptKind();
    const canPrompt = promptKind !== null;
    if (canPrompt !== this.heroineNearReported) {
      this.heroineNearReported = canPrompt;
      this.callbacks.onHeroineProximityChange?.(canPrompt);
    }
    if (promptKind !== this.heroinePromptKindReported) {
      this.heroinePromptKindReported = promptKind;
      this.callbacks.onHeroinePromptChange?.(promptKind);
    }

    if (!hasHeroine || !heroine) {
      this.floatingSubtitles.group.visible = false;
      return;
    }

    heroine.getHeadWorldPosition(this.encounterHeadPosScratch);

    // 1.5 Per-frame Toy-Gun Aim Detection (eye-shut defensive flinch -> micro-pout)
    const heroineVisible = heroine.root.visible;
    const gunEquipped =
      this.getEquippedItem()?.id === 'toy_gun' &&
      this.viewMode === 'first-person' &&
      !this.inputSuspended &&
      this.pcFocusState === 'none' &&
      this.glitchCutscene === null &&
      !heroine.isPoseTuning() &&
      heroineVisible;

    let rawAimedAtHeroine = false;
    if (gunEquipped) {
      this.camera.getWorldDirection(this.toyGunAimDirScratch);
      // Test both head/face AND upper chest so aiming anywhere at her upper body registers reliably
      this.toyGunToHeroineScratch.set(
        this.encounterHeadPosScratch.x - this.camera.position.x,
        this.encounterHeadPosScratch.y - 0.04 - this.camera.position.y,
        this.encounterHeadPosScratch.z - this.camera.position.z
      );
      const distToHead = this.toyGunToHeroineScratch.length();
      if (distToHead > 0.30 && distToHead < 6.2) {
        this.toyGunToHeroineScratch.divideScalar(distToHead);
        const dotHead = this.toyGunAimDirScratch.dot(this.toyGunToHeroineScratch);

        this.toyGunChestScratch
          .set(
            this.encounterHeadPosScratch.x - this.camera.position.x,
            this.encounterHeadPosScratch.y - 0.28 - this.camera.position.y,
            this.encounterHeadPosScratch.z - this.camera.position.z
          )
          .normalize();
        const dotChest = this.toyGunAimDirScratch.dot(this.toyGunChestScratch);

        if (Math.max(dotHead, dotChest) > 0.915) {
          // Raycast toward her head (always clear of bed/sofa/chair furniture colliders!)
          const wallHit = this.collisions.raycastAll(
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z,
            this.toyGunToHeroineScratch.x,
            this.toyGunToHeroineScratch.y,
            this.toyGunToHeroineScratch.z,
            distToHead,
            _projTarget,
            _projNormal
          );
          if (wallHit < 0 || wallHit >= distToHead - 0.60) {
            rawAimedAtHeroine = true;
          }
        }
      }
    }

    if (rawAimedAtHeroine) {
      this.toyGunAimGraceTimer = 0.45;
    } else if (!gunEquipped) {
      this.toyGunAimGraceTimer = 0;
    } else if (this.toyGunAimGraceTimer > 0) {
      this.toyGunAimGraceTimer = Math.max(0, this.toyGunAimGraceTimer - dt);
    }

    const aimedAtHeroine = rawAimedAtHeroine || this.toyGunAimGraceTimer > 0;
    const gunSignal = heroine.setToyGunAimedAt(aimedAtHeroine, false);
    if (
      gunSignal === 'pout_start' &&
      !this.heroineEncounterActive &&
      this.toyGunMurmurCooldown <= 0
    ) {
      const murmurs = [
        '唔……别拿玩具枪指着我啦，会吓一跳的嘛……',
        '呜，就算只是软弹玩具枪……对着我也还是会怕的呀……',
        '坏蛋……干嘛老拿玩具枪吓唬我啦。',
      ];
      const text = murmurs[this.toyGunMurmurIndex % murmurs.length];
      this.toyGunMurmurIndex += 1;
      this.toyGunMurmurCooldown = 6.5;
      this.adjustHeroineIntimacy(-2, 25);
      this.showAmbientHeroineMurmur(text, 3.8, false);
    }

    // 2. Player camera & movement remain 100% free during encounter — no camera hijacking!
    // 3. Update true 3D world-space floating & falling subtitle sprites (always billboarded to camera)
    this.floatingSubtitles.group.visible =
      heroineVisible && this.floatingSubtitles.hasVisibleSprites();
    if (this.floatingSubtitles.hasVisibleSprites()) {
      this.floatingSubtitles.update(
        dt,
        elapsed,
        this.encounterHeadPosScratch,
        this.camera
      );
    }

    // 4. Push 60fps imperative 3D screen projections to BedroomEncounterOverlay (zero React re-renders)
    if (this.encounterProjectionListener) {
      const vw = this.renderer.domElement.clientWidth || window.innerWidth;
      const vh = this.renderer.domElement.clientHeight || window.innerHeight;
      this.camera.updateMatrixWorld();
      this.encounterCamRightScratch
        .setFromMatrixColumn(this.camera.matrixWorld, 0)
        .normalize();
      this.encounterCamUpScratch
        .setFromMatrixColumn(this.camera.matrixWorld, 1)
        .normalize();
      this.encounterCamFwdScratch
        .setFromMatrixColumn(this.camera.matrixWorld, 2)
        .normalize();

      // Prompt anchor: floats above living room sofa when offering sofa co-sit, else beside her shoulder
      if (promptKind === 'sofa') {
        this.encounterAnchorScratch.set(
          2.55,
          1.02 + Math.sin(elapsed * 2.1) * 0.015,
          -5.25
        );
      } else {
        this.encounterAnchorScratch
          .copy(this.encounterHeadPosScratch)
          .addScaledVector(this.encounterCamRightScratch, 0.34)
          .addScaledVector(this.encounterCamUpScratch, -0.04 + Math.sin(elapsed * 2.1) * 0.012)
          .addScaledVector(this.encounterCamFwdScratch, 0.06);
      }
      const promptProj = this.projectWorldPointToScreen(
        this.encounterAnchorScratch,
        vw,
        vh
      );

      // Continue hint anchor: tucked cleanly beneath the last line of the 3D floating subtitle
      this.floatingSubtitles.computeSideAnchor(
        this.encounterHeadPosScratch,
        this.camera,
        this.encounterAnchorScratch
      );
      this.encounterAnchorScratch.addScaledVector(
        this.encounterCamUpScratch,
        this.floatingSubtitles.getSubtitleBottomOffset()
      );
      const continueProj = this.projectWorldPointToScreen(
        this.encounterAnchorScratch,
        vw,
        vh
      );

      // Protagonist floating choice options anchor: positioned cleanly to her LEFT side so they
      // balance her right-side floating subtitles without ever covering her face!
      this.encounterAnchorScratch
        .copy(this.encounterHeadPosScratch)
        .addScaledVector(this.encounterCamRightScratch, -0.30)
        .addScaledVector(this.encounterCamUpScratch, -0.10)
        .addScaledVector(this.encounterCamFwdScratch, 0.08);
      const choicesProj = this.projectWorldPointToScreen(
        this.encounterAnchorScratch,
        vw,
        vh
      );
      // Keep left-side choices comfortably inside left margin
      const safeChoicesX = THREE.MathUtils.clamp(
        choicesProj.x,
        Math.min(vw * 0.42, 310),
        Math.max(310, vw - 48)
      );

      const dialogueUiReady =
        this.heroineEncounterActive && heroineVisible && !heroine.isBusyWithStageAction();

      this.encounterProjectionListener({
        promptVisible: canPrompt && promptProj.visible,
        promptX: promptProj.x,
        promptY: promptProj.y,
        promptScale: promptProj.scale,
        continueVisible: dialogueUiReady && continueProj.visible,
        continueX: THREE.MathUtils.clamp(continueProj.x, 40, Math.max(40, vw - 140)),
        continueY: THREE.MathUtils.clamp(continueProj.y, 40, Math.max(40, vh - 48)),
        continueScale: continueProj.scale,
        choicesVisible: dialogueUiReady && choicesProj.visible,
        choicesX: safeChoicesX,
        choicesY: THREE.MathUtils.clamp(choicesProj.y, 120, Math.max(120, vh - 120)),
        choicesScale: choicesProj.scale,
      });
    }
  }

  /**
   * Triggers the 3.5-second Basement Terminal Glitch & Dizzy Cutscene.
   * Immediately spawns the Heroine seated on the bedroom bed edge at t = 0.
   */
  public triggerBasementGlitchCutscene(onComplete?: () => void): void {
    // Spawn Heroine immediately at the exact moment the glitch triggers
    this.vrmAvatar?.spawnHeroineOnBedroomBed();

    if (this.glitchCutscene) return;
    if (this.viewMode !== 'first-person') {
      this.setViewMode('first-person');
    }
    this.isTeleporting = false;
    this.teleportTargetRoom = null;
    this.isDraggingLook = false;
    this.keys = {};
    this.hoveredTarget = null;
    this.callbacks.onHoverTarget(null);
    this.triggerRoomEntryFlicker('basement', 1.45);
    this.audio.playInteract(true);

    this.glitchCutscene = {
      elapsed: 0,
      duration: 3.5,
      baseYaw: this.yaw,
      basePitch: this.pitch,
      onComplete,
    };
    this.callbacks.onGlitchCutsceneProgress?.(0);
  }

  private emitHitFeedback(kind: HitFeedbackPayload['kind'], label?: string): void {
    this.hitFeedbackCounter += 1;
    this.callbacks.onHitFeedback?.({
      id: this.hitFeedbackCounter,
      kind,
      label,
    });
  }

  private fireToyGun(aimNdc: THREE.Vector2): void {
    if (this.gunFireCooldown > 0) return;

    const ammo = this.toyGunAmmoType;
    this.gunFireCooldown = ammo === 'dart' ? 0.16 : 0.34;
    this.gunRecoilKick = 1.0;
    this.gunTriggerAnim = 1.0;
    this.camRecoilPitch = Math.min(0.030, this.camRecoilPitch + (ammo === 'dart' ? 0.012 : 0.017));
    this.heldToyGun.spinDrum(Math.PI / 3);
    this.audio.playToyGunShoot(ammo);

    // Compute exact world aim point using ultra-fast analytic AABB raycast (<0.02ms, zero stutter!)
    this.camera.updateMatrixWorld(true);
    this.projectileRaycaster.setFromCamera(aimNdc, this.camera);
    const rayO = this.projectileRaycaster.ray.origin;
    const rayD = this.projectileRaycaster.ray.direction;

    const hitDist = this.collisions.raycastAll(
      rayO.x,
      rayO.y,
      rayO.z,
      rayD.x,
      rayD.y,
      rayD.z,
      24.0,
      _projTarget,
      _projNormal
    );
    const aimDist = hitDist > 0.45 ? hitDist : 14.0;
    _projTarget.copy(rayO).addScaledVector(rayD, aimDist);

    // Spawn from physical muzzle tip world position
    this.heldToyGun.muzzleTip.getWorldPosition(_projOrigin);
    _projDir.subVectors(_projTarget, _projOrigin).normalize();

    // Gentle friendly Capture-Net aim-assist when shooting toward the drifting Paper Airplane!
    if (
      ammo === 'net' &&
      this.paperPlaneState.phase === 'flying' &&
      this.paperAirplaneRig.group.visible
    ) {
      const planePos = this.paperAirplaneRig.group.position;
      _projStep.subVectors(planePos, rayO);
      const distToPlane = _projStep.length();
      if (distToPlane > 0.3 && distToPlane < 13.0) {
        _projStep.divideScalar(distToPlane);
        // Within ~16 degrees of center crosshair: softly guide net toward airplane
        if (_projStep.dot(rayD) > 0.96) {
          _projDir.subVectors(planePos, _projOrigin).normalize();
        }
      }
    }

    // If player fires the toy gun toward the heroine, trigger immediate flinch reaction!
    const heroine = this.vrmAvatar?.heroine;
    if (heroine && heroine.hasVrm() && heroine.isSpawned() && heroine.root.visible) {
      heroine.getHeadWorldPosition(this.encounterHeadPosScratch);
      this.toyGunToHeroineScratch.set(
        this.encounterHeadPosScratch.x - rayO.x,
        this.encounterHeadPosScratch.y - 0.16 - rayO.y,
        this.encounterHeadPosScratch.z - rayO.z
      );
      const distToH = this.toyGunToHeroineScratch.length();
      if (distToH > 0.3 && distToH < 5.8) {
        this.toyGunToHeroineScratch.divideScalar(distToH);
        if (this.toyGunToHeroineScratch.dot(rayD) > 0.93) {
          heroine.setToyGunAimedAt(true, true);
          if (!this.heroineEncounterActive && this.toyGunMurmurCooldown <= 0) {
            this.toyGunMurmurCooldown = 5.0;
            this.showAmbientHeroineMurmur('呀！真开枪啦……好坏哦，明明知道我会吓一跳的！', 3.8, false);
          }
        }
      }
    }

    // Playful muzzle puff from pooled FX (zero allocations!)
    this.spawnHitBurst(
      _projOrigin,
      _projDir,
      ammo === 'dart' ? 0xffe47a : 0x8ef2d4,
      3,
      0.08
    );

    this.projSpawnSeq += 1;

    if (ammo === 'dart') {
      // Grab an idle dart from pool or recycle the oldest one
      let slot = this.dartPool.find((d) => !d.active);
      if (!slot) {
        slot = this.dartPool.reduce((oldest, cur) =>
          cur.spawnOrder < oldest.spawnOrder ? cur : oldest
        );
      }
      slot.active = true;
      slot.stuck = false;
      slot.age = 0;
      slot.stuckAge = 0;
      slot.wobbleTime = 0;
      slot.wobbleAmp = 0;
      slot.spawnOrder = this.projSpawnSeq;
      slot.vel.copy(_projDir).multiplyScalar(11.5);
      slot.rig.group.visible = true;
      slot.rig.group.scale.setScalar(1.0);
      slot.rig.group.position.copy(_projOrigin);
      slot.baseQuat.setFromUnitVectors(_projZAxis, _projDir);
      slot.rig.group.quaternion.copy(slot.baseQuat);
      slot.rig.trailMesh.visible = true;
      slot.rig.setOpacity(1.0);
    } else {
      let slot = this.netPool.find((n) => !n.active);
      if (!slot) {
        slot = this.netPool.reduce((oldest, cur) =>
          cur.spawnOrder < oldest.spawnOrder ? cur : oldest
        );
      }
      slot.active = true;
      slot.age = 0;
      slot.deployTime = 0;
      slot.deployedAudioPlayed = false;
      slot.draped = false;
      slot.drapeAge = 0;
      slot.spawnOrder = this.projSpawnSeq;
      slot.vel.copy(_projDir).multiplyScalar(8.6);
      slot.rig.group.visible = true;
      slot.rig.group.scale.setScalar(1.0);
      slot.rig.group.position.copy(_projOrigin);
      slot.rig.group.quaternion.setFromUnitVectors(_projZAxis, _projDir);
      slot.rig.setDeployProgress(0.06);
      slot.rig.setOpacity(1.0);
    }
  }

  private spawnHitBurst(
    pos: THREE.Vector3,
    normal: THREE.Vector3,
    colorHex: number,
    sparkCount = 6,
    ringRadius = 0.14
  ): void {
    // Recycle pooled expanding ring aligned to surface normal
    const ringSlot =
      this.ringPool.find((r) => !r.active) ??
      this.ringPool.reduce((a, b) => (a.age > b.age ? a : b));
    ringSlot.active = true;
    ringSlot.age = 0;
    ringSlot.maxAge = 0.24;
    ringSlot.baseRadius = ringRadius;
    ringSlot.mat.color.setHex(colorHex);
    ringSlot.mat.opacity = 0.9;
    ringSlot.mesh.visible = true;
    ringSlot.mesh.position.copy(pos).addScaledVector(normal, 0.018);
    ringSlot.mesh.quaternion.setFromUnitVectors(_projZAxis, normal);
    ringSlot.mesh.scale.setScalar(ringRadius * 0.25);

    const palette = [colorHex, 0xfff0a8, 0x73dfc0, 0xff7040];
    let spawned = 0;
    for (let i = 0; i < this.sparkPool.length && spawned < sparkCount; i++) {
      const s = this.sparkPool[i];
      if (s.active) continue;
      s.active = true;
      s.age = 0;
      s.maxAge = 0.30 + Math.random() * 0.16;
      s.mat.color.setHex(palette[spawned % palette.length]);
      s.mat.opacity = 0.95;
      s.mesh.visible = true;
      s.mesh.scale.setScalar(1.0);
      s.mesh.position.copy(pos).addScaledVector(normal, 0.02);
      const speed = 1.5 + Math.random() * 2.4;
      s.vel.set(
        normal.x * speed * 0.65 + (Math.random() - 0.5) * 2.8,
        normal.y * speed * 0.65 + 0.7 + Math.random() * 1.6,
        normal.z * speed * 0.65 + (Math.random() - 0.5) * 2.8
      );
      spawned++;
    }
  }

  private nudgeNearbyAmbientProps(hitPoint: THREE.Vector3, strength = 1.0): void {
    for (const prop of this.ctx.ambientProps) {
      const dist = prop.mesh.position.distanceTo(hitPoint);
      if (dist < 0.42) {
        prop.tiltX += (Math.random() - 0.5) * 0.38 * strength;
        prop.tiltZ += (Math.random() - 0.5) * 0.38 * strength;
        prop.yawVel += (Math.random() - 0.5) * 3.6 * strength;
      }
    }
  }

  private capturePaperAirplane(catchPos: THREE.Vector3): void {
    this.paperAirplaneCaptured = true;
    this.paperPlaneState.phase = 'caught';
    this.paperAirplaneRig.group.visible = false;

    this.audio.playPaperCapture();
    this.spawnHitBurst(catchPos, _projUp, 0xffc6a8, 16, 0.32);
    this.emitHitFeedback('capture', '捕获纸飞机！');

    const slot = this.addItemToInventory('paper_airplane_note');
    if (slot !== -1) {
      this.selectedInventorySlot = slot;
    }
    this.emitInventorySnapshot();
    this.callbacks.onOpenPaperAirplaneNote?.();
  }

  private updateHeldItemViewModel(dt: number, elapsed: number): void {
    this.coPlayActionPulse = Math.max(0, this.coPlayActionPulse - dt * 3.2);
    this.syncHeldViewModelVisibility();
    if (!this.heldItemAnchor.visible) {
      this.protagonistGamingRig?.setState('hidden', 0, elapsed, 0, 0, 0);
      return;
    }

    if (this.coPlayState === 'handoff_reach') {
      this.protagonistGamingRig.setState(
        'reaching',
        this.coPlayHandoffProgress,
        elapsed,
        0,
        0,
        0
      );
      return;
    }

    if (this.coPlayState === 'playing') {
      const moveX =
        (this.keys['KeyD'] || this.keys['ArrowRight'] ? 1 : 0) -
        (this.keys['KeyA'] || this.keys['ArrowLeft'] ? 1 : 0);
      const moveY =
        (this.keys['KeyS'] || this.keys['ArrowDown'] ? 1 : 0) -
        (this.keys['KeyW'] || this.keys['ArrowUp'] ? 1 : 0);
      this.protagonistGamingRig.setState(
        'holding',
        1,
        elapsed,
        moveX,
        moveY,
        this.coPlayActionPulse
      );
      return;
    }

    this.protagonistGamingRig.setState('hidden', 0, elapsed, 0, 0, 0);

    this.gunFireCooldown = Math.max(0, this.gunFireCooldown - dt);
    this.heldEquipAnim = THREE.MathUtils.damp(this.heldEquipAnim, 1.0, 12.0, dt);
    this.gunRecoilKick = THREE.MathUtils.damp(this.gunRecoilKick, 0.0, 15.0, dt);
    this.gunTriggerAnim = THREE.MathUtils.damp(this.gunTriggerAnim, 0.0, 18.0, dt);
    this.gunSwitchTilt = THREE.MathUtils.damp(this.gunSwitchTilt, 0.0, 9.5, dt);
    this.camRecoilPitch = THREE.MathUtils.damp(this.camRecoilPitch, 0.0, 14.0, dt);
    this.gunSwayX = THREE.MathUtils.damp(this.gunSwayX, 0.0, 10.0, dt);
    this.gunSwayY = THREE.MathUtils.damp(this.gunSwayY, 0.0, 10.0, dt);

    const equipDrop = (1.0 - this.heldEquipAnim) * 0.16;
    const walkBobX = this.playerMovingThisFrame ? Math.cos(this.headBobPhase) * 0.011 : 0;
    const walkBobY = this.playerMovingThisFrame ? Math.abs(Math.sin(this.headBobPhase)) * 0.012 : 0;
    const breathY = Math.sin(elapsed * 2.1) * 0.0035;

    if (this.heldToyGun.group.visible) {
      this.heldToyGun.setTriggerPull(this.gunTriggerAnim);
      this.heldToyGun.group.position.set(
        0.24 + walkBobX + this.gunSwayX,
        -0.21 - equipDrop - walkBobY + breathY + this.gunSwayY + this.gunRecoilKick * 0.022,
        -0.43 + this.gunRecoilKick * 0.058
      );
      this.heldToyGun.group.rotation.set(
        0.03 + this.gunRecoilKick * 0.24 - this.gunSwitchTilt * 0.12,
        -0.09 + this.gunSwayX * 1.4,
        -0.02 - this.gunSwitchTilt * 0.52 + this.gunSwayX * 1.8
      );
    }

    if (this.heldPaperNote.visible) {
      this.heldPaperNote.position.set(
        0.21 + walkBobX * 0.8 + this.gunSwayX,
        -0.18 - equipDrop - walkBobY * 0.7 + breathY * 1.3 + this.gunSwayY,
        -0.37
      );
      this.heldPaperNote.rotation.set(
        Math.sin(elapsed * 2.5) * 0.04,
        Math.cos(elapsed * 1.8) * 0.05,
        Math.sin(elapsed * 2.2) * 0.03
      );
    }
  }

  private updateProjectilesAndFx(dt: number): void {
    const planeActive =
      this.paperPlaneState.phase === 'flying' && this.paperAirplaneRig.group.visible;
    const catActive = this.catState.phase === 'active' && this.glitchCat.root.visible;
    const planePos = this.paperAirplaneRig.group.position;

    // 1. Update Pooled Suction Cup Darts (visible flight -> stick with wobble -> smooth fade-out!)
    for (let i = 0; i < this.dartPool.length; i++) {
      const dart = this.dartPool[i];
      if (!dart.active) continue;
      dart.age += dt;

      if (dart.stuck) {
        dart.stuckAge += dt;
        if (dart.wobbleAmp > 0.004) {
          dart.wobbleTime += dt;
          dart.wobbleAmp *= Math.exp(-7.0 * dt);
          const wx = Math.sin(dart.wobbleTime * 28.0) * dart.wobbleAmp;
          const wy = Math.cos(dart.wobbleTime * 22.0) * dart.wobbleAmp * 0.65;
          dart.rig.group.quaternion.copy(dart.baseQuat);
          dart.rig.group.rotateX(wx);
          dart.rig.group.rotateY(wy);
        }
        // Stay stuck for 3.0s, then fade out & shrink cleanly over 0.85s
        if (dart.stuckAge > 3.0) {
          const fadeT = (dart.stuckAge - 3.0) / 0.85;
          if (fadeT >= 1.0) {
            dart.active = false;
            dart.rig.group.visible = false;
          } else {
            dart.rig.setOpacity(1.0 - fadeT);
            dart.rig.group.scale.setScalar(1.0 - fadeT * 0.25);
          }
        }
        continue;
      }

      if (dart.age > 3.0) {
        dart.active = false;
        dart.rig.group.visible = false;
        continue;
      }

      dart.vel.y -= 3.6 * dt;
      _projPrev.copy(dart.rig.group.position);
      _projStep.copy(dart.vel).multiplyScalar(dt);
      const stepLen = _projStep.length();
      if (stepLen < 1e-5) continue;
      _projNext.copy(_projPrev).add(_projStep);
      _projDir.copy(_projStep).divideScalar(stepLen);

      // Playful bounce against flying Paper Airplane (segment test = zero tunneling!)
      if (planeActive) {
        const dSq = distSqPointToSegment(
          planePos.x,
          planePos.y,
          planePos.z,
          _projPrev.x,
          _projPrev.y,
          _projPrev.z,
          _projNext.x,
          _projNext.y,
          _projNext.z
        );
        if (dSq < 0.55 * 0.55) {
          dart.vel.set((Math.random() - 0.5) * 3.0, -2.2, (Math.random() - 0.5) * 3.0);
          this.paperPlaneState.dodgeTimer = 0.65;
          this.audio.playDartStick(1.32);
          this.spawnHitBurst(planePos, _projUp, 0xffe488, 6, 0.16);
          this.emitHitFeedback('bounce', '弹开了！按 X 切捕捉网');
          continue;
        }
      }

      // Playful hit against Glitch Cat
      if (catActive) {
        _projTarget.set(
          this.glitchCat.root.position.x,
          this.glitchCat.root.position.y + 0.28,
          this.glitchCat.root.position.z
        );
        const catSq = distSqPointToSegment(
          _projTarget.x,
          _projTarget.y,
          _projTarget.z,
          _projPrev.x,
          _projPrev.y,
          _projPrev.z,
          _projNext.x,
          _projNext.y,
          _projNext.z
        );
        if (catSq < 0.48 * 0.48) {
          this.catState.glitchBurst = 1.0;
          this.audio.playCatPhaseBlip();
          this.spawnHitBurst(_projTarget, _projUp, 0xff9ec8, 8, 0.20);
          this.emitHitFeedback('dart', '惊动了残影猫！');
          dart.active = false;
          dart.rig.group.visible = false;
          continue;
        }
      }

      // Ultra-fast analytic collision against walls, doors, floor, ceiling, furniture (<0.02ms!)
      const hitDist = this.collisions.raycastAll(
        _projPrev.x,
        _projPrev.y,
        _projPrev.z,
        _projDir.x,
        _projDir.y,
        _projDir.z,
        stepLen + 0.08,
        _projTarget,
        _projNormal
      );

      if (hitDist >= 0) {
        _projNegNormal.copy(_projNormal).negate();
        dart.rig.group.position.copy(_projTarget).addScaledVector(_projNormal, 0.055);
        dart.baseQuat.setFromUnitVectors(_projZAxis, _projNegNormal);
        dart.rig.group.quaternion.copy(dart.baseQuat);
        dart.rig.trailMesh.visible = false;
        dart.stuck = true;
        dart.stuckAge = 0;
        dart.wobbleTime = 0;
        dart.wobbleAmp = 0.36;

        this.audio.playDartStick(0.92 + Math.random() * 0.22);
        this.spawnHitBurst(_projTarget, _projNormal, 0xff7040, 6, 0.13);
        this.nudgeNearbyAmbientProps(_projTarget, 1.1);
        // No hitmarker HUD notification on normal walls/furniture!
      } else {
        dart.rig.group.position.copy(_projNext);
        dart.rig.group.quaternion.setFromUnitVectors(_projZAxis, _projDir);
      }
    }

    // 2. Update Pooled Capture Nets (blooms clearly -> catches plane OR drapes on wall -> fades out!)
    for (let i = 0; i < this.netPool.length; i++) {
      const net = this.netPool[i];
      if (!net.active) continue;
      net.age += dt;

      if (net.draped) {
        net.drapeAge += dt;
        const wobble = 1.0 + Math.sin(net.drapeAge * 14.0) * Math.exp(-5.0 * net.drapeAge) * 0.14;
        net.rig.group.scale.set(wobble, wobble, Math.max(0.32, 1.0 - net.drapeAge * 0.38));
        // Stay visibly draped for 1.65s, then fade out smoothly over 0.75s
        if (net.drapeAge > 1.65) {
          const fadeT = (net.drapeAge - 1.65) / 0.75;
          if (fadeT >= 1.0) {
            net.active = false;
            net.rig.group.visible = false;
          } else {
            net.rig.setOpacity(1.0 - fadeT);
          }
        }
        continue;
      }

      if (net.age > 3.2) {
        net.active = false;
        net.rig.group.visible = false;
        continue;
      }

      // Bloom smoothly right after leaving muzzle into wide circular woven net!
      if (net.age > 0.025) {
        net.deployTime += dt;
        const progress = Math.min(1, net.deployTime / 0.16);
        net.rig.setDeployProgress(progress);
        if (!net.deployedAudioPlayed && progress > 0.16) {
          net.deployedAudioPlayed = true;
          this.audio.playNetDeploy();
        }
      }

      const drag = net.deployTime > 0.05 ? Math.exp(-0.95 * dt) : 1.0;
      net.vel.multiplyScalar(drag);
      net.vel.y -= 1.8 * dt;
      _projPrev.copy(net.rig.group.position);
      _projStep.copy(net.vel).multiplyScalar(dt);
      const stepLen = _projStep.length();
      if (stepLen < 1e-5) continue;
      _projNext.copy(_projPrev).add(_projStep);
      _projDir.copy(_projStep).divideScalar(stepLen);

      // Generous segment-to-point capture check BEFORE wall collision so catching Paper Airplane ALWAYS works!
      if (planeActive) {
        const catchDistSq = distSqPointToSegment(
          planePos.x,
          planePos.y,
          planePos.z,
          _projPrev.x,
          _projPrev.y,
          _projPrev.z,
          _projNext.x,
          _projNext.y,
          _projNext.z
        );
        if (catchDistSq < 1.28 * 1.28) {
          const catchPos = planePos.clone();
          net.active = false;
          net.rig.group.visible = false;
          this.capturePaperAirplane(catchPos);
          continue;
        }
      }

      // Playful capture-net brush against Glitch Cat
      if (catActive) {
        _projTarget.set(
          this.glitchCat.root.position.x,
          this.glitchCat.root.position.y + 0.28,
          this.glitchCat.root.position.z
        );
        const catSq = distSqPointToSegment(
          _projTarget.x,
          _projTarget.y,
          _projTarget.z,
          _projPrev.x,
          _projPrev.y,
          _projPrev.z,
          _projNext.x,
          _projNext.y,
          _projNext.z
        );
        if (catSq < 0.72 * 0.72) {
          this.catState.glitchBurst = 1.0;
          this.audio.playCatPhaseBlip();
          this.spawnHitBurst(_projTarget, _projUp, 0x9cf0d6, 8, 0.26);
          this.emitHitFeedback('net', '网兜穿过了残影猫！');
          net.active = false;
          net.rig.group.visible = false;
          continue;
        }
      }

      // Analytic collision with walls/floor/ceiling/furniture (<0.02ms!)
      const hitDist = this.collisions.raycastAll(
        _projPrev.x,
        _projPrev.y,
        _projPrev.z,
        _projDir.x,
        _projDir.y,
        _projDir.z,
        stepLen + 0.12,
        _projTarget,
        _projNormal
      );

      if (hitDist >= 0) {
        _projNegNormal.copy(_projNormal).negate();
        net.rig.setDeployProgress(1.0);
        net.rig.group.position.copy(_projTarget).addScaledVector(_projNormal, 0.06);
        net.rig.group.quaternion.setFromUnitVectors(_projZAxis, _projNegNormal);
        net.draped = true;
        net.drapeAge = 0;

        this.audio.playNetDeploy();
        this.spawnHitBurst(_projTarget, _projNormal, 0x8ef2d4, 7, 0.22);
        this.nudgeNearbyAmbientProps(_projTarget, 1.2);
        // No hitmarker HUD notification on normal walls/furniture!
      } else {
        net.rig.group.position.copy(_projNext);
        net.rig.group.quaternion.setFromUnitVectors(_projZAxis, _projDir);
      }
    }

    // 3. Update Pooled Impact Rings & Sparks (zero runtime allocations / disposes!)
    for (let i = 0; i < this.ringPool.length; i++) {
      const r = this.ringPool[i];
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const t = r.age / r.maxAge;
      r.mesh.scale.setScalar(r.baseRadius * (0.28 + t * 1.45));
      r.mat.opacity = (1 - t) * 0.85;
    }

    for (let i = 0; i < this.sparkPool.length; i++) {
      const s = this.sparkPool[i];
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.maxAge) {
        s.active = false;
        s.mesh.visible = false;
        continue;
      }
      const t = s.age / s.maxAge;
      s.vel.y -= 6.5 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += dt * 9;
      s.mesh.rotation.y += dt * 11;
      s.mesh.scale.setScalar(Math.max(0.05, 1 - t));
      s.mat.opacity = 1 - t;
    }
  }

  private samplePaperAirplanePath(t: number, seed: number, out: THREE.Vector3): THREE.Vector3 {
    // Graceful, easy-to-track figure-8 glide across Living Room center at comfortable eye height:
    // X: 1.0..5.4, Y: 1.50..2.18, Z: -7.8..-2.4
    const a = t * 0.34 + seed;
    const x = 3.20 + Math.sin(a) * 1.95 + Math.cos(a * 0.5) * 0.35;
    const z = -5.10 + Math.sin(a * 2.0) * 2.15 + Math.cos(a * 0.7) * 0.45;
    const y = 1.84 + Math.sin(a * 1.35 + 0.5) * 0.28 + Math.cos(a * 2.4) * 0.06;
    return out.set(x, y, z);
  }

  private updatePaperAirplane(dt: number, elapsed: number): void {
    if (this.paperAirplaneCaptured) {
      this.paperAirplaneRig.group.visible = false;
      return;
    }

    const st = this.paperPlaneState;
    const livingVisible = this.ctx.sceneManager.isRoomVisible('living');

    if (st.phase === 'cooldown') {
      this.paperAirplaneRig.group.visible = false;
      // Count down slightly faster while player is actually in the Living Room
      st.timer -= dt * (this.currentRoom === 'living' ? 1.25 : 0.75);
      if (st.timer <= 0) {
        st.phase = 'flying';
        st.flightElapsed = 0;
        st.flightDuration = 32 + Math.random() * 14;
        st.seed = Math.random() * Math.PI * 2;
        st.spottedNotified = false;
        st.dodgeTimer = 0;
      }
      return;
    }

    if (st.phase === 'flying') {
      st.flightElapsed += dt;
      if (st.dodgeTimer > 0) {
        st.dodgeTimer = Math.max(0, st.dodgeTimer - dt);
      }

      if (st.flightElapsed >= st.flightDuration) {
        st.phase = 'cooldown';
        st.timer = 15 + Math.random() * 14;
        this.paperAirplaneRig.group.visible = false;
        return;
      }

      this.paperAirplaneRig.group.visible = livingVisible;
      this.samplePaperAirplanePath(st.flightElapsed, st.seed, _planePos);
      this.samplePaperAirplanePath(st.flightElapsed + 0.06, st.seed, _planeNextPos);

      // Gentle upward/lateral flutter dodge if playfully bonked by a suction dart
      if (st.dodgeTimer > 0) {
        const dWave = Math.sin(st.dodgeTimer * Math.PI / 0.65);
        _planePos.y += dWave * 0.32;
        _planeNextPos.y += dWave * 0.30;
      }

      // Smooth fade-in/out scale near spawn & exit so it feels dreamy rather than popping
      const fadeIn = Math.min(1, st.flightElapsed / 1.4);
      const fadeOut = Math.min(1, (st.flightDuration - st.flightElapsed) / 1.6);
      const envScale = Math.max(0.05, Math.min(fadeIn, fadeOut));

      this.paperAirplaneRig.group.position.copy(_planePos);
      this.paperAirplaneRig.group.scale.setScalar(envScale);

      _planeTangent.subVectors(_planeNextPos, _planePos).normalize();
      if (_planeTangent.lengthSq() > 0.001) {
        // Paper airplane nose points along +Z; lookAt aligns +Z with tangent when using eye->target inverted
        _planeLookMat.lookAt(_planeNextPos, _planePos, _projUp);
        _planeQuat.setFromRotationMatrix(_planeLookMat);
        this.paperAirplaneRig.group.quaternion.slerp(_planeQuat, Math.min(1, dt * 8.0));
      }

      this.paperAirplaneRig.updateFlightFX(dt, elapsed);

      // Gently notify the player once when the paper airplane drifts into the Living Room
      if (!st.spottedNotified && this.currentRoom === 'living' && st.flightElapsed > 1.2) {
        st.spottedNotified = true;
        const hasGun = this.findItemSlot('toy_gun') !== -1;
        this.callbacks.onInteractResult({
          title: '客厅半空飘过一只纸飞机',
          message: hasGun
            ? '一只淡米色便签纸折成的纸飞机正缓缓盘旋在客厅空中——装备玩具枪并按 X 切换「捕捉网弹」接住它吧！'
            : '一只淡米色便签纸折成的纸飞机正缓缓盘旋在客厅空中……沙发上的玩具枪或许能把它捕下来。',
        });
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.vrmStatusListeners.clear();
    this.encounterProjectionListener = null;
    this.floatingSubtitles?.dispose();
    this.vrmAvatar?.dispose();
    this.audio.dispose();
    this.orbitControls.dispose();
    this.postRig?.dispose();
    this.mirrorRenderTarget.dispose();
    this.pcDynamicTexture?.dispose();
    this.arcadeDynamicTexture?.dispose();
    this.ctx.metaState.livingTv.texture?.dispose();
    this.outlines.dispose();
    this.bakedLightmapRig?.dispose();
    this.pmremEnv?.dispose();
    for (const tex of this.textures.all) {
      tex.dispose();
    }

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
