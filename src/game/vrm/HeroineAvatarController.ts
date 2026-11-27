import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  MToonMaterial,
  VRM,
  VRMExpressionMorphTargetBind,
  VRMLoaderPlugin,
  VRMSpringBoneCollider,
  VRMSpringBoneColliderShapeCapsule,
  VRMSpringBoneColliderShapePlane,
  VRMUtils,
  type VRMHumanBoneName,
  type VRMSpringBoneColliderGroup,
  type VRMSpringBoneJoint,
} from '@pixiv/three-vrm';
import { retargetMixamoFbxToVrmWithMeta } from './mixamoVrmRetarget';
import type { AtmosphereMode, RoomId } from '../types';
import type {
  HeroineExpressionPreset,
  HeroineGesture,
  HeroineGlanceTarget,
  HeroinePerformanceCue,
  HeroineStageAction,
  HeroineWalkUpperBodyStyle,
} from '../../data/bedroomEncounterScript';
import type { PathPoint2D } from '../pathfinding';
import {
  HEROINE_EXPRESSIONS,
  HEROINE_LEFT_CURL_FINGERS,
  HEROINE_POSES,
  HEROINE_RIGHT_CURL_FINGERS,
  type HeroineFingerMode,
  type HeroinePoseDefinition,
  type HeroinePoseId,
} from './heroinePoses.js';

export type HeroinePostureState =
  | 'seated'
  | 'standing_up'
  | 'walking_to_player'
  | 'greeting_wave'
  | 'standing_talking'
  | 'dialogue_walking'
  | 'sitting_down_chair'
  | 'seated_chair'
  | 'standing_up_chair'
  | 'walking_to_sofa'
  | 'sitting_down_sofa'
  | 'seated_sofa'
  | 'standing_up_sofa'
  | 'following_player';

export type SofaTvBehaviorState =
  | 'watching_idle'
  | 'adjust_posture'
  | 'lean_interested'
  | 'side_glance_smile'
  | 'scoot_closer'
  | 'shoulder_rest';

export interface SofaTvBehaviorNotice {
  state: SofaTvBehaviorState;
  fromProgramSwitch: boolean;
}

export interface HeroinePoseTunerState {
  poseId: HeroinePoseId;
  pose: HeroinePoseDefinition;
  expression: HeroineExpressionPreset;
  animateWave: boolean;
}

export type HeroineMoveResolver = (
  currX: number,
  currZ: number,
  nextX: number,
  nextZ: number,
  currY: number
) => { x: number; y: number; z: number };

export type HeroinePathFinder = (
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  feetY: number
) => PathPoint2D[];

export interface HeroineSwivelChairHandle {
  rootGroup: THREE.Group;
  seatGroup: THREE.Group;
  floorY: number;
  radius: number;
}

// Safe unobstructed bedroom floor bounds in front of the bed for heroine standing & walking
// Planted-feet stand-up line sits directly over her hanging shins (~38cm forward of bed seat pelvis)
// so she pushes straight up over her feet instead of floating/drifting horizontally across the floor!
const BEDROOM_STAND_OFF_BED_Z = -2.80;
const BEDROOM_WALK_MIN_X = -6.70;
const BEDROOM_WALK_MAX_X = -2.05;
const BEDROOM_WALK_MIN_Z = -5.15;
const BEDROOM_WALK_MAX_Z = -0.92;
const SWIVEL_CHAIR_SEAT_SURFACE_Y = 0.505;

/**
 * Bedroom Bed-Edge Seat Anchor (South front edge of the plush mattress/duvet in buildBedroom.ts):
 * - Bed center: (-6.54, 0, -4.05)
 * - Duvet top surface Y = 0.595, South outer bedframe/drape edge Z = -3.022
 * - Seated pelvis anchored at (-6.38, -3.18) squarely along the South edge:
 *   hips & upper thighs rest flush on the plush bed edge, while knees (~Z=-2.81) and
 *   shins (~Z=-2.82) hang naturally outside the bed edge (~20cm clearance, zero clipping).
 * - Clear of headboard pillows (X <= -7.00) and star cushion (X >= -5.95).
 */
export const BEDROOM_BED_SEAT_ANCHOR = {
  x: -6.38,
  seatSurfaceY: 0.595,
  z: -3.18,
  facingYaw: 0.12,
  defaultDoorLookPoint: new THREE.Vector3(-5.85, 1.18, -1.10),
};

const MTOON_GI_EQUALIZATION_TARGET = 0.34;
// Natural standing proportion facing the 1.62m player eye camera (~1.60m tall heroine, ~1.48m eye line)
const HEROINE_TARGET_EYE_HEIGHT_M = 1.48;
const HEROINE_TARGET_HEAD_BONE_HEIGHT_M = 1.39;
const HEROINE_TARGET_TOTAL_HEIGHT_M = 1.60;
// Distance from hip/upperLeg bone joint center to underside of seated thighs/glutes on duvet
const SEATED_THIGH_SURFACE_CLEARANCE = 0.070;
// Bed-surface plane sits just above the duvet top so cloth mesh thickness never sinks into mattress
const BED_PLANE_SURFACE_OFFSET_Y = 0.006;
const SKIRT_NAME_REGEX =
  /skirt|dress|apron|petti|lace|ruffle|flounce|coat|cloth|hem|frill|pleat|gown|frock|onepiece|sk_|skt|スカート|エプロン|フリル|ドレス/i;
const FRONT_SKIRT_NAME_REGEX = /front|_f_|_f\d|mae|frt|apron|前|エプロン/i;
const BACK_SKIRT_NAME_REGEX = /back|_b_|_b\d|ushiro|bck|後/i;
const NON_SKIRT_NAME_REGEX =
  /hair|bang|ponytail|twin|ahoge|bust|breast|boob|chest|neck|collar|sleeve|cuff|ear|hat|hood|head/i;

// Natural human head+neck follow limits (eyes lead first, head turns up to ±30 deg before torso pivots)
const MAX_HEAD_YAW_RAD = THREE.MathUtils.degToRad(30);
const MAX_HEAD_PITCH_UP_RAD = THREE.MathUtils.degToRad(16);
const MAX_HEAD_PITCH_DOWN_RAD = THREE.MathUtils.degToRad(14);

const DEFAULT_HEROINE_WALK_SPEED = 1.62;
// Comfortable personal-space follow thresholds (triggers farther away so she doesn't crowd the player)
const FOLLOW_START_DIST = 2.85;
const FOLLOW_STOP_DIST = 1.75;
const FOLLOW_TELEPORT_DIST = 10.5;

const BEDROOM_GLANCE_TARGETS: Record<HeroineGlanceTarget, THREE.Vector3> = {
  desk: new THREE.Vector3(-2.52, 1.08, -6.12),
  window: new THREE.Vector3(-4.85, 1.56, -6.45),
  door: new THREE.Vector3(-1.15, 1.24, -2.55),
  bookshelf: new THREE.Vector3(-4.65, 1.12, -0.15),
};

const BEDROOM_STROLL_SPOTS: Record<'center' | 'window_side' | 'near_desk', { x: number; z: number }> = {
  center: { x: -4.15, z: -2.95 },
  window_side: { x: -4.65, z: -4.45 },
  near_desk: { x: -3.45, z: -4.25 },
};

// Zero-GC scratch objects for per-frame gaze, head tracking, upper-body layering & footwork
const _tmpBox = new THREE.Box3();
const _headWorldPos = new THREE.Vector3();
const _hipsWorldPos = new THREE.Vector3();
const _jointWorldPos = new THREE.Vector3();
const _jointRelLocal = new THREE.Vector3();
const _childWorldPos = new THREE.Vector3();
const _childRelLocal = new THREE.Vector3();
const _drapeDirLocal = new THREE.Vector3();
const _leftLegWorldPos = new THREE.Vector3();
const _rightLegWorldPos = new THREE.Vector3();
const _rootWorldPos = new THREE.Vector3();
const _toTargetWorld = new THREE.Vector3();
const _toTargetLocal = new THREE.Vector3();
const _desiredLookWorld = new THREE.Vector3();
const _invRootQuat = new THREE.Quaternion();
const _eyeLeftLocal = new THREE.Vector3();
const _eyeRightLocal = new THREE.Vector3();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _walkAbductQuat = new THREE.Quaternion();
const _layerEuler = new THREE.Euler();
const _layerQuat = new THREE.Quaternion();
const _footEuler = new THREE.Euler();
const _footQuat = new THREE.Quaternion();
const _blendEulerA = new THREE.Euler();
const _blendEulerB = new THREE.Euler();
const _blendQuatA = new THREE.Quaternion();
const _blendQuatB = new THREE.Quaternion();

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function shortestAngleDelta(from: number, to: number): number {
  let diff = (to - from + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  return diff - Math.PI;
}

export type HeroineAnimSlot = 'idle' | 'walk' | 'sit';

type HeroinePoseDriver =
  | 'none'
  | 'seated'
  | 'standing_up'
  | 'mixamo'
  | 'procedural_walk'
  | 'procedural_standing';

const HEAD_TRACKED_BONES = new Set<VRMHumanBoneName>([
  'neck',
  'head',
  'leftEye',
  'rightEye',
]);

interface StandUpFootworkState {
  hipRoll: number;
  leftHipPitchAdd: number;
  rightHipPitchAdd: number;
  leftKneeAdd: number;
  rightKneeAdd: number;
  leftAnklePitch: number;
  rightAnklePitch: number;
  leftAnkleRoll: number;
  rightAnkleRoll: number;
  leftToesPitch: number;
  rightToesPitch: number;
  armPushBrace: number;
}

export class HeroineAvatarController {
  public readonly root: THREE.Group;
  public readonly lookAtTarget: THREE.Object3D;

  private readonly gltfLoader: GLTFLoader;

  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private sharedFbx: Partial<Record<'idle' | 'walk', THREE.Group>> = {};
  private actions: Partial<Record<HeroineAnimSlot, THREE.AnimationAction>> = {};
  private actionWeights: Record<'idle' | 'walk', number> = { idle: 0, walk: 0 };
  private walkClipNativeSpeed = DEFAULT_HEROINE_WALK_SPEED;
  private seatedBedPlaneCollider: VRMSpringBoneCollider | null = null;
  private seatedMattressEdgeCollider: VRMSpringBoneCollider | null = null;
  private seatedUpperLapCollider: VRMSpringBoneCollider | null = null;
  private seatedLapBridgeCollider: VRMSpringBoneCollider | null = null;
  private seatedUpperKneeCollider: VRMSpringBoneCollider | null = null;
  private seatedKneeBridgeCollider: VRMSpringBoneCollider | null = null;
  private seatedColliders: VRMSpringBoneCollider[] = [];
  private seatedSurfaceMode: 'bed' | 'chair' | 'sofa' = 'bed';
  private seatedBackSideColliderGroup: VRMSpringBoneColliderGroup | null = null;
  private seatedFrontColliderGroup: VRMSpringBoneColliderGroup | null = null;
  private skirtJointOriginalSettings = new Map<
    VRMSpringBoneJoint,
    {
      hitRadius: number;
      stiffness: number;
      dragForce: number;
      gravityPower: number;
      gravityDir: THREE.Vector3;
      originalColliderGroups: VRMSpringBoneColliderGroup[];
      localSeatedGravityDir: THREE.Vector3;
    }
  >();
  private seatSurfaceLocalY = 0.76;
  private seatedRootY = 0;

  // Cheek blush translucent planes attached to raw head bone
  private cheekBlushGroup: THREE.Group | null = null;
  private cheekBlushMat: THREE.MeshBasicMaterial | null = null;
  private cheekBlushTex: THREE.CanvasTexture | null = null;

  private vrmStandingHipsHeight = 0.88;
  private vrmStandingFootHeight = 0.08;
  private vrmStandingToesHeight = 0.025;
  private hasStandingToesBone = false;
  private smileBlockedMouthMorphs: Array<{ mesh: THREE.Mesh; index: number }> = [];
  private spawned = false;
  private disposed = false;

  // Posture, locomotion, stage choreography & A* pathfinding state machine
  private postureState: HeroinePostureState = 'seated';
  private standUpProgress = 0;
  private standUpDuration = 1.72;
  private standUpStartYaw = BEDROOM_BED_SEAT_ANCHOR.facingYaw;
  private standUpForwardDist = 0.36;
  // 2nd-order physics damping state for bed-edge stand-up (zero drift, ground reaction feedback)
  private standUpComFwd = 0;
  private standUpComVelFwd = 0;
  private standUpPelvisY = 0;
  private standUpPelvisVelY = 0;
  private standUpKneeSpring = 0;
  private standUpKneeVel = 0;
  private standUpGroundLoad = 0;
  private standUpPlantedCaptured = false;
  private readonly standUpPlantedFootWorld = new THREE.Vector3();
  private walkPhase = 0;
  private walkStartElapsed = 0;
  private walkTargetPos = new THREE.Vector3(-6.38, 0, -2.50);
  private onWalkArrived: (() => void) | null = null;
  private activePath: PathPoint2D[] = [];
  private pathReplanTimer = 0;
  private lastPlannedGoal = new THREE.Vector3(999, 0, 999);
  private followStuckTimer = 0;
  private isFollowMoving = false;
  private pathFinder: HeroinePathFinder | null = null;
  private bedroomChair: HeroineSwivelChairHandle | null = null;

  // Context-aware upper-body walk layering (e.g. arms crossed while strolling indoors)
  private walkUpperBodyStyle: HeroineWalkUpperBodyStyle = 'normal';
  private armsCrossedWalkBlend = 0;

  // Dialogue stage choreography (room glances, approach-and-reach, swivel-chair sit/stand)
  private roomGlanceTargetPos = new THREE.Vector3();
  private roomGlanceRemaining = 0;
  private onRoomGlanceDone: (() => void) | null = null;
  private onStageWalkArrived: (() => void) | null = null;
  private pendingSitChairAfterWalk = false;
  private chairTransitionProgress = 0;
  private chairTransitionDuration = 0.85;
  private chairStandStartPos = new THREE.Vector3();
  private chairEntryPos = new THREE.Vector3();
  private chairSeatRootY = -0.14;
  private chairFaceYaw = 0;
  private onChairTransitionDone: (() => void) | null = null;

  // Living Room Sofa co-sitting state
  private sofaSeatPos = new THREE.Vector3(2.74, 0, -5.68);
  private sofaEntryPos = new THREE.Vector3(3.14, 0, -5.68);
  private sofaStandStartPos = new THREE.Vector3();
  private sofaTvLookPos = new THREE.Vector3(6.74, 1.28, -5.08);
  private sofaSeatSurfaceY = 0.495;
  private sofaSeatRootY = -0.15;
  private sofaFaceYaw = Math.PI / 2;
  private sofaTransitionProgress = 0;
  private sofaTransitionDuration = 0.95;
  private sofaTvIsOn = false;
  private sofaInDialogue = false;
  private sofaReactionTimer = 0;
  private onSofaTransitionDone: (() => void) | null = null;

  // Sofa TV-Watching Intimacy State Machine (active when seated_sofa + TV ON)
  private intimacy = 55;
  private sofaTvState: SofaTvBehaviorState = 'watching_idle';
  private sofaTvStateElapsed = 0;
  private sofaTvStateDuration = 5.0;
  private sofaAdjustDir: 1 | -1 = 1;
  private sofaScootOffsetZ = 0;
  private sofaScootYawOffset = 0;
  private sofaSpinePitchAdd = 0;
  private sofaSpineRollAdd = 0;
  private sofaChestRollAdd = 0;
  private sofaChestYawAdd = 0;
  private sofaLegShiftAdd = 0;
  private sofaShoulderRestBlend = 0;
  private sofaBehaviorPendingNotice: SofaTvBehaviorNotice | null = null;

  // Living Room Co-Play Xbox Controller Fetch & Handoff Choreography
  private gamingPhase:
    | 'none'
    | 'stand_from_sofa'
    | 'walk_to_table'
    | 'pickup_pads'
    | 'walk_to_player'
    | 'handoff_wait'
    | 'return_to_sofa'
    | 'sit_back_sofa'
    | 'playing_sofa' = 'none';
  private gamingPhaseTimer = 0;
  private gamingPickupNotified = false;
  private gamingHandoffTaken = false;
  private gamingActionPulse = 0;
  private gamingCallbacks: {
    onPickedUpFromTable?: () => void;
    onHandoffStart?: () => void;
    onWhitePadTaken?: () => void;
    onBackSeated?: () => void;
  } | null = null;
  private heldWhitePadMesh: THREE.Group | null = null;
  private heldPurplePadMesh: THREE.Group | null = null;
  private hasWhitePadInHand = false;
  private hasPurplePadInHand = false;
  private readonly _padWorldPos = new THREE.Vector3();
  private readonly _padWorldPosB = new THREE.Vector3();
  private readonly _padWorldQuat = new THREE.Quaternion();

  // Toy-gun aim reaction: tight eye-shut defensive flinch -> micro-pout aggrieved expression
  private toyGunAimed = false;
  private toyGunPhase: 'none' | 'flinch' | 'pout' = 'none';
  private toyGunPhaseTimer = 0;
  private toyGunFlinchBlend = 0;
  private toyGunPoutTimer = 0;
  private toyGunPoutNotified = false;

  // Tiered gaze, body-turn hysteresis, idle ambient glancing & turn-in-place footwork
  private isTurningInPlace = false;
  private turnStepPhase = 0;
  private turnFootworkBlend = 0;
  private turnDirectionSign = 1;
  private idleAmbientGlanceCooldown = 6.5;
  private idleAmbientGlanceRemaining = 0;
  private idleAmbientGlancePoint = new THREE.Vector3();

  // Greeting arrival wave (squint-smile wave -> eyes open -> begin dialogue performance)
  private greetingWaveElapsed = 0;
  private greetingWaveDuration = 2.15;

  // Unrestricted bedroom dialogue following + auto-chair boredom/waiting micro-actions
  private bedroomDialogueFollowEnabled = false;
  private isBedroomDialogueFollowing = false;
  private bedroomIdleChairWaitActive = false;
  private chairBoredomState: 'idle_sway' | 'swivel_play' | 'look_around' | 'chin_rest' | 'kick_feet' = 'idle_sway';
  private chairBoredomElapsed = 0;
  private chairBoredomDuration = 4.5;
  private chairBoredomSwivelDir = 1;
  private chairBoredomLookPoint = new THREE.Vector3();
  private chairBoredomChinBlend = 0;
  private chairBoredomBaseYaw = 0;

  // Real-time Pose Tuner debug override (from bottom-left panel)
  private poseTuner: HeroinePoseTunerState | null = null;
  private preTunerPosture: HeroinePostureState | null = null;
  private readonly preTunerPos = new THREE.Vector3();
  private preTunerYaw = 0;

  // Atmosphere-aware material calibration baselines (prevents daylight skin blowout & bloom/shadow flicker)
  private atmosphereMode: AtmosphereMode = 'daylight';
  private materialBaselines: Array<{
    material: THREE.Material;
    isMToon: boolean;
    origColor: THREE.Color | null;
    origShadeColor: THREE.Color | null;
    origRimColor: THREE.Color | null;
    origGiEq: number;
    origToony: number;
    origEmissiveIntensity: number;
    origEnvMapIntensity: number;
  }> = [];

  // Expressive dialogue performance state (all smoothly damped)
  private activePerformance: HeroinePerformanceCue = {
    expression: 'neutral',
    gesture: 'idle',
    blush: 0,
    headTilt: 0,
    leanForward: 0,
    eyeAvert: false,
  };
  private isSpeaking = false;
  private speakTailTimer = 0;
  private speakPhase = 0;
  private gestureElapsed = 0;
  private standingGestureBlend = 0;
  private lastRenderedPostureState: HeroinePostureState = 'seated';
  private lastRenderedGesture: HeroineGesture = 'idle';
  private lastRenderedWalkStyle: 'normal' | 'arms_crossed' = 'normal';
  private lastRenderedGlancing = false;
  private lipSyncExprNames: Record<'aa' | 'ih' | 'ou' | 'ee' | 'oh', string[]> = {
    aa: ['aa'],
    ih: ['ih'],
    ou: ['ou'],
    ee: ['ee'],
    oh: ['oh'],
  };
  private lipSyncMorphFallback: Array<{ mesh: THREE.Mesh; index: number }> = [];
  private currentBlush = 0;
  private currentHeadTilt = 0;
  private currentLeanForward = 0;
  // Strictly tracked single-emotion native VRM state machine (ZERO mixing; fade out to 0 before fading in next)
  private activeExprChannel:
    | 'none'
    | 'happy'
    | 'relaxed'
    | 'sad'
    | 'angry'
    | 'surprised'
    | 'blink'
    | 'blinkLeft' = 'none';
  private activeExprLinear = 0;
  private currentHappy = 0;
  private currentRelaxed = 0;
  private currentSad = 0;
  private currentAngry = 0;
  private currentSurprised = 0;
  private currentWink = 0;
  private winkPulseElapsed = -1;
  private currentBlink = 0;
  private currentVowelAa = 0;
  private currentVowelIh = 0;
  private currentVowelOu = 0;
  private currentVowelEe = 0;
  private currentVowelOh = 0;
  private smoothedBoneEuler = new Map<VRMHumanBoneName, THREE.Vector3>();

  // Universal bone-level SLERP cross-fade across pose drivers (Mixamo <-> procedural <-> seated)
  private activePoseDriver: HeroinePoseDriver = 'none';
  private lastCommittedQuats = new Map<VRMHumanBoneName, THREE.Quaternion>();
  private lastCommittedHipsPos = new THREE.Vector3();
  private hasLastCommittedPose = false;
  private transitionFromQuats = new Map<VRMHumanBoneName, THREE.Quaternion>();
  private transitionFromHipsPos = new THREE.Vector3();
  private transitionElapsed = 0;
  private transitionDuration = 0;

  // Smooth head/neck gaze & eye tracking state
  private currentHeadYaw = 0;
  private currentHeadPitch = 0;
  private lookAtInitialized = false;

  // Natural randomized blinking state (with occasional double-blink)
  private blinkTimer = 2.4;
  private blinkElapsed = -1;
  private blinkDuration = 0.16;
  private pendingDoubleBlink = false;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'HeroineVrmAvatarRoot';
    this.root.visible = false;
    this.root.position.set(
      BEDROOM_BED_SEAT_ANCHOR.x,
      0,
      BEDROOM_BED_SEAT_ANCHOR.z
    );
    this.root.rotation.set(0, BEDROOM_BED_SEAT_ANCHOR.facingYaw, 0);

    this.lookAtTarget = new THREE.Object3D();
    this.lookAtTarget.name = 'HeroineLookAtTarget';
    this.lookAtTarget.position.copy(BEDROOM_BED_SEAT_ANCHOR.defaultDoorLookPoint);

    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
  }

  public hasVrm(): boolean {
    return this.vrm !== null;
  }

  public getVrmVersion(): string | null {
    return this.vrm?.meta?.metaVersion ?? null;
  }

  public hasSitClip(): boolean {
    return false;
  }

  public isSpawned(): boolean {
    return this.spawned;
  }

  public getPostureState(): HeroinePostureState {
    return this.postureState;
  }

  public setSceneHelpers(
    pathFinder: HeroinePathFinder,
    bedroomChair: HeroineSwivelChairHandle | null
  ): void {
    this.pathFinder = pathFinder;
    this.bedroomChair = bedroomChair;
  }

  public isSeated(): boolean {
    return this.postureState === 'seated';
  }

  public isSeatedOnChair(): boolean {
    return (
      this.postureState === 'seated_chair' ||
      this.postureState === 'sitting_down_chair' ||
      this.postureState === 'standing_up_chair'
    );
  }

  public isSeatedOnSofa(): boolean {
    return this.postureState === 'seated_sofa';
  }

  public isSofaActive(): boolean {
    return (
      this.postureState === 'walking_to_sofa' ||
      this.postureState === 'sitting_down_sofa' ||
      this.postureState === 'seated_sofa' ||
      this.postureState === 'standing_up_sofa'
    );
  }

  public isFollowingPlayer(): boolean {
    return this.postureState === 'following_player';
  }

  public isWalkingToPlayer(): boolean {
    return (
      this.postureState === 'walking_to_player' ||
      this.postureState === 'dialogue_walking' ||
      this.postureState === 'walking_to_sofa'
    );
  }

  public isBusyWithStageAction(): boolean {
    return (
      this.postureState === 'standing_up' ||
      this.postureState === 'walking_to_player' ||
      this.postureState === 'greeting_wave' ||
      this.postureState === 'dialogue_walking' ||
      this.postureState === 'sitting_down_chair' ||
      this.postureState === 'standing_up_chair' ||
      this.postureState === 'walking_to_sofa' ||
      this.postureState === 'sitting_down_sofa' ||
      this.postureState === 'standing_up_sofa' ||
      this.roomGlanceRemaining > 0
    );
  }

  public setBedroomDialogueFollowEnabled(enabled: boolean): void {
    this.bedroomDialogueFollowEnabled = enabled;
    if (!enabled) {
      this.isBedroomDialogueFollowing = false;
    }
  }

  public isBedroomIdleChairWaiting(): boolean {
    return this.bedroomIdleChairWaitActive;
  }

  /**
   * Sends the heroine to sit in the bedroom swivel chair and pass the time with natural
   * fidget/boredom micro-actions when the player leaves the bedroom or goes idle >10s mid-dialogue.
   */
  public enterBedroomIdleChairWait(playerFeetPos: THREE.Vector3): boolean {
    if (this.bedroomIdleChairWaitActive || this.poseTuner || !this.bedroomChair) {
      return false;
    }
    if (this.postureState === 'seated_chair') {
      this.bedroomIdleChairWaitActive = true;
      this.isBedroomDialogueFollowing = false;
      this.chairBoredomBaseYaw = this.root.rotation.y;
      this.chairBoredomState = 'swivel_play';
      this.chairBoredomElapsed = 0;
      this.chairBoredomDuration = 5.2;
      this.activePerformance.gesture = 'idle';
      return true;
    }
    if (this.postureState !== 'standing_talking') {
      return false;
    }
    this.bedroomIdleChairWaitActive = true;
    this.isBedroomDialogueFollowing = false;
    this.activePerformance.gesture = 'idle';
    this.standingGestureBlend = 0;

    const chair = this.bedroomChair;
    const cx = chair.rootGroup.position.x;
    const cz = chair.rootGroup.position.z;
    const dirX = playerFeetPos.x - cx;
    const dirZ = Math.max(0.35, playerFeetPos.z - cz);
    const dirLen = Math.max(0.01, Math.hypot(dirX, dirZ));
    const entryX = THREE.MathUtils.clamp(
      cx + (dirX / dirLen) * 0.48,
      BEDROOM_WALK_MIN_X,
      BEDROOM_WALK_MAX_X
    );
    const entryZ = THREE.MathUtils.clamp(
      cz + (dirZ / dirLen) * 0.48,
      -5.05,
      BEDROOM_WALK_MAX_Z
    );
    this.chairEntryPos.set(entryX, chair.floorY, entryZ);
    this.walkUpperBodyStyle = 'normal';
    this.walkTargetPos.set(entryX, chair.floorY, entryZ);
    this.planPathTo(entryX, entryZ, this.root.position.y);
    this.postureState = 'dialogue_walking';
    this.pendingSitChairAfterWalk = true;
    this.onStageWalkArrived = () => {
      this.walkUpperBodyStyle = 'normal';
      this.pendingSitChairAfterWalk = false;
      this.beginSitIntoChair(playerFeetPos, () => {
        this.chairBoredomBaseYaw = this.root.rotation.y;
        this.chairBoredomState = 'swivel_play';
        this.chairBoredomElapsed = 0;
        this.chairBoredomDuration = 5.2;
      });
    };
    return true;
  }

  /**
   * Smoothly exits boredom waiting when the player returns and interacts with her again.
   */
  public exitBedroomIdleChairWait(): void {
    this.bedroomIdleChairWaitActive = false;
    this.chairBoredomState = 'idle_sway';
    this.chairBoredomElapsed = 0;
  }

  public setIntimacy(value: number): void {
    this.intimacy = THREE.MathUtils.clamp(value, 0, 100);
  }

  public getSofaTvBehaviorState(): SofaTvBehaviorState {
    return this.sofaTvState;
  }

  public consumeSofaTvBehaviorNotice(): SofaTvBehaviorNotice | null {
    const notice = this.sofaBehaviorPendingNotice;
    this.sofaBehaviorPendingNotice = null;
    return notice;
  }

  public setSofaTvIsOn(isOn: boolean): void {
    const wasOn = this.sofaTvIsOn;
    this.sofaTvIsOn = isOn;
    if (wasOn !== isOn) {
      this.resetSofaTvStateMachine(false);
    }
  }

  /**
   * Called whenever the Living Room TV switches channel/program (manually or automatically).
   * If she is cozily watching TV on the sofa, she reacts with a subtle posture adjustment.
   */
  public notifySofaTvProgramSwitch(): void {
    if (
      this.postureState !== 'seated_sofa' ||
      !this.sofaTvIsOn ||
      this.sofaInDialogue ||
      this.toyGunPhase !== 'none' ||
      this.poseTuner
    ) {
      return;
    }
    this.sofaReactionTimer = 0;
    this.sofaAdjustDir = this.sofaAdjustDir === 1 ? -1 : 1;
    this.sofaTvState = 'adjust_posture';
    this.sofaTvStateElapsed = 0;
    this.sofaTvStateDuration = 2.35;
    this.sofaBehaviorPendingNotice = {
      state: 'adjust_posture',
      fromProgramSwitch: true,
    };
  }

  private resetSofaTvStateMachine(immediate = false): void {
    this.sofaTvState = 'watching_idle';
    this.sofaTvStateElapsed = 0;
    this.sofaTvStateDuration = 4.2 + Math.random() * 2.4;
    this.sofaBehaviorPendingNotice = null;
    if (immediate) {
      this.sofaScootOffsetZ = 0;
      this.sofaScootYawOffset = 0;
      this.sofaSpinePitchAdd = 0;
      this.sofaSpineRollAdd = 0;
      this.sofaChestRollAdd = 0;
      this.sofaChestYawAdd = 0;
      this.sofaLegShiftAdd = 0;
      this.sofaShoulderRestBlend = 0;
    }
  }

  private isSofaTvFsmActive(): boolean {
    return (
      this.postureState === 'seated_sofa' &&
      this.sofaTvIsOn &&
      !this.sofaInDialogue &&
      this.toyGunPhase === 'none' &&
      this.sofaReactionTimer <= 0 &&
      !this.poseTuner
    );
  }

  private pickNextSofaTvBehavior(): SofaTvBehaviorState {
    // Intimacy-weighted random micro-behavior transitions:
    // Low intimacy (< 42): polite watching, eager lean, posture shift, occasional warm glance
    // Mid intimacy (42..61): introduces scooting closer & gentle chance to rest head on shoulder
    // High intimacy (>= 62): affectionate mix with frequent shoulder-resting & cozy closeness
    const entries: Array<{ state: SofaTvBehaviorState; weight: number }> =
      this.intimacy < 42
        ? [
            { state: 'watching_idle', weight: 40 },
            { state: 'lean_interested', weight: 28 },
            { state: 'adjust_posture', weight: 18 },
            { state: 'side_glance_smile', weight: 14 },
          ]
        : this.intimacy < 62
          ? [
              { state: 'watching_idle', weight: 20 },
              { state: 'lean_interested', weight: 18 },
              { state: 'adjust_posture', weight: 12 },
              { state: 'side_glance_smile', weight: 18 },
              { state: 'scoot_closer', weight: 18 },
              { state: 'shoulder_rest', weight: this.intimacy >= 50 ? 14 : 0 },
            ]
          : [
              { state: 'watching_idle', weight: 12 },
              { state: 'lean_interested', weight: 14 },
              { state: 'adjust_posture', weight: 8 },
              { state: 'side_glance_smile', weight: 18 },
              { state: 'scoot_closer', weight: 18 },
              { state: 'shoulder_rest', weight: 30 },
            ];

    // Prevent repeating the exact same active micro-action back-to-back
    const filtered = entries.filter(
      (e) => e.weight > 0 && (e.state !== this.sofaTvState || this.sofaTvState === 'watching_idle')
    );
    const pool = filtered.length > 0 ? filtered : entries.filter((e) => e.weight > 0);
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= pool[i].weight;
      if (roll <= 0) {
        return pool[i].state;
      }
    }
    return 'watching_idle';
  }

  private getSofaTvStateDuration(state: SofaTvBehaviorState): number {
    switch (state) {
      case 'adjust_posture':
        return 2.1 + Math.random() * 0.45;
      case 'lean_interested':
        return 5.0 + Math.random() * 2.5;
      case 'side_glance_smile':
        return 4.2 + Math.random() * 2.0;
      case 'scoot_closer':
        return 5.8 + Math.random() * 2.8;
      case 'shoulder_rest':
        return 8.5 + Math.random() * 4.5;
      case 'watching_idle':
      default:
        return 4.0 + Math.random() * 2.6;
    }
  }

  private updateSofaTvStateMachine(dt: number, elapsed: number): void {
    const active = this.isSofaTvFsmActive();

    let targetScootZ = 0;
    let targetYawOffset = 0;
    let targetSpinePitch = 0;
    let targetSpineRoll = 0;
    let targetChestRoll = 0;
    let targetChestYaw = 0;
    let targetLegShift = 0;
    let targetShoulderRest = 0;

    if (active) {
      this.sofaTvStateElapsed += dt;
      if (this.sofaTvStateElapsed >= this.sofaTvStateDuration) {
        const nextState = this.pickNextSofaTvBehavior();
        if (nextState === 'adjust_posture') {
          this.sofaAdjustDir = this.sofaAdjustDir === 1 ? -1 : 1;
        }
        this.sofaTvState = nextState;
        this.sofaTvStateElapsed = 0;
        this.sofaTvStateDuration = this.getSofaTvStateDuration(nextState);
        if (
          nextState === 'shoulder_rest' ||
          nextState === 'scoot_closer' ||
          nextState === 'side_glance_smile'
        ) {
          this.sofaBehaviorPendingNotice = {
            state: nextState,
            fromProgramSwitch: false,
          };
        }
      }

      const normT = THREE.MathUtils.clamp(
        this.sofaTvStateElapsed / Math.max(0.01, this.sofaTvStateDuration),
        0,
        1
      );

      switch (this.sofaTvState) {
        case 'adjust_posture': {
          // Smooth cushion shift + torso re-settle + subtle knee tuck when TV channel switches
          const pulse = Math.sin(normT * Math.PI);
          targetScootZ = 0.05 + this.sofaAdjustDir * 0.036 * pulse;
          targetYawOffset = this.sofaAdjustDir * 0.045 * pulse;
          targetSpinePitch = -0.075 * pulse;
          targetSpineRoll = this.sofaAdjustDir * 0.085 * pulse;
          targetChestYaw = this.sofaAdjustDir * 0.075 * pulse;
          targetLegShift = this.sofaAdjustDir * 0.09 * pulse;
          break;
        }
        case 'lean_interested': {
          // Curious forward lean toward the TV screen with slight animated sway
          targetScootZ = 0.03;
          targetSpinePitch = 0.16 + Math.sin(elapsed * 1.4) * 0.014;
          targetChestYaw = -0.04;
          break;
        }
        case 'side_glance_smile': {
          // Softly angle upper body slightly toward player while sharing a warm smile
          targetScootZ = 0.09;
          targetYawOffset = -0.09;
          targetSpineRoll = 0.035;
          targetChestYaw = -0.08;
          break;
        }
        case 'scoot_closer': {
          // Scoots cozily closer to the player on the sofa cushion
          targetScootZ = 0.25;
          targetYawOffset = -0.09;
          targetSpinePitch = 0.03;
          targetSpineRoll = 0.055;
          break;
        }
        case 'shoulder_rest': {
          // Scoots snugly beside the player (+Z) and gently rests her head onto his left shoulder (+rz)
          targetScootZ = 0.45;
          targetYawOffset = -0.05;
          targetSpinePitch = 0.05;
          targetSpineRoll = 0.20;
          targetChestRoll = 0.16;
          targetShoulderRest = 1.0;
          break;
        }
        case 'watching_idle':
        default: {
          targetScootZ = 0;
          break;
        }
      }
    }

    const scootLambda = targetScootZ > this.sofaScootOffsetZ ? 2.1 : 2.6;
    const bodyLambda = 3.2;
    this.sofaScootOffsetZ = THREE.MathUtils.damp(this.sofaScootOffsetZ, targetScootZ, scootLambda, dt);
    this.sofaScootYawOffset = THREE.MathUtils.damp(this.sofaScootYawOffset, targetYawOffset, 2.8, dt);
    this.sofaSpinePitchAdd = THREE.MathUtils.damp(this.sofaSpinePitchAdd, targetSpinePitch, bodyLambda, dt);
    this.sofaSpineRollAdd = THREE.MathUtils.damp(this.sofaSpineRollAdd, targetSpineRoll, bodyLambda, dt);
    this.sofaChestRollAdd = THREE.MathUtils.damp(this.sofaChestRollAdd, targetChestRoll, bodyLambda, dt);
    this.sofaChestYawAdd = THREE.MathUtils.damp(this.sofaChestYawAdd, targetChestYaw, bodyLambda, dt);
    this.sofaLegShiftAdd = THREE.MathUtils.damp(this.sofaLegShiftAdd, targetLegShift, 4.2, dt);
    this.sofaShoulderRestBlend = THREE.MathUtils.damp(
      this.sofaShoulderRestBlend,
      targetShoulderRest,
      2.4,
      dt
    );
  }

  public triggerSofaBriefReaction(cue: HeroinePerformanceCue, durationSec = 4.2): void {
    this.setPerformanceCue(cue);
    this.sofaReactionTimer = Math.max(this.sofaReactionTimer, durationSec);
  }

  public beginRoutineChat(): void {
    this.poseTuner = null;
    this.preTunerPosture = null;
    this.isFollowMoving = false;
    this.activePath = [];
    this.roomGlanceRemaining = 0;
    this.walkUpperBodyStyle = 'normal';
    if (this.postureState === 'seated_sofa') {
      this.sofaInDialogue = true;
      this.sofaReactionTimer = 0;
      this.resetSofaTvStateMachine(false);
    } else if (this.postureState === 'following_player') {
      this.postureState = 'standing_talking';
    }
  }

  public endRoutineChat(playerFeetPos: THREE.Vector3): void {
    this.isSpeaking = false;
    this.activePerformance = {
      expression: 'neutral',
      gesture: 'idle',
      blush: 0,
      headTilt: 0,
      leanForward: 0,
      eyeAvert: false,
    };
    if (this.postureState === 'seated_sofa') {
      this.sofaInDialogue = false;
      this.sofaReactionTimer = 0;
      return;
    }
    this.startFollowingPlayer(playerFeetPos);
  }

  public beginSitOnLivingSofa(
    seatPos: THREE.Vector3,
    entryPos: THREE.Vector3,
    seatSurfaceY: number,
    facingYaw: number,
    tvLookPos: THREE.Vector3,
    onSeated?: () => void
  ): void {
    this.poseTuner = null;
    this.preTunerPosture = null;
    this.onWalkArrived = null;
    this.onRoomGlanceDone = null;
    this.onStageWalkArrived = null;
    this.roomGlanceRemaining = 0;
    this.pendingSitChairAfterWalk = false;
    this.walkUpperBodyStyle = 'normal';
    this.isSpeaking = false;
    this.isFollowMoving = false;
    this.sofaInDialogue = false;
    this.sofaReactionTimer = 0;
    this.resetSofaTvStateMachine(true);
    this.sofaSeatPos.copy(seatPos);
    this.sofaEntryPos.copy(entryPos);
    this.sofaSeatSurfaceY = seatSurfaceY;
    this.sofaFaceYaw = facingYaw;
    this.sofaTvLookPos.copy(tvLookPos);
    this.onSofaTransitionDone = onSeated ?? null;

    this.activePerformance = {
      expression: 'happy',
      gesture: 'idle',
      blush: 0.14,
      headTilt: 0,
      leanForward: 0,
      eyeAvert: false,
    };

    const distToEntry = Math.hypot(
      this.root.position.x - entryPos.x,
      this.root.position.z - entryPos.z
    );
    if (distToEntry < 0.65) {
      this.startSofaSitDownTransition();
    } else {
      this.restoreStandingSkirtPhysics();
      this.planPathTo(entryPos.x, entryPos.z, entryPos.y);
      this.walkStartElapsed = 0;
      this.postureState = 'walking_to_sofa';
    }
  }

  private startSofaSitDownTransition(): void {
    let seatedThighLocalY = this.vrmStandingHipsHeight - 0.05;
    if (this.vrm) {
      const restLocalY = this.vrm.humanoid.normalizedRestPose?.hips?.position?.[1];
      if (typeof restLocalY === 'number' && restLocalY > 0.2) {
        seatedThighLocalY = restLocalY * this.vrm.scene.scale.y - 0.04;
      }
    }
    this.sofaSeatRootY =
      this.sofaSeatSurfaceY + SEATED_THIGH_SURFACE_CLEARANCE - seatedThighLocalY;
    this.seatSurfaceLocalY = this.sofaSeatSurfaceY - this.sofaSeatRootY;

    this.sofaStandStartPos.copy(this.root.position);
    this.sofaTransitionProgress = 0;
    this.sofaTransitionDuration = 0.96;

    if (this.vrm) {
      this.configureSeatedSkirtPhysics(this.vrm, 'sofa');
      this.positionSeatedColliders(0);
      this.updateSeatedSkirtWorldGravity();
    }
    this.postureState = 'sitting_down_sofa';
  }

  public beginStandUpFromLivingSofa(
    standPos: THREE.Vector3,
    onStood?: () => void
  ): void {
    this.sofaInDialogue = false;
    this.sofaReactionTimer = 0;
    this.resetSofaTvStateMachine(false);
    this.activePerformance = {
      expression: 'neutral',
      gesture: 'idle',
      blush: 0,
      headTilt: 0,
      leanForward: 0,
      eyeAvert: false,
    };
    this.standingGestureBlend = 0;

    if (this.postureState === 'walking_to_sofa') {
      this.activePath = [];
      this.postureState = 'following_player';
      onStood?.();
      return;
    }

    if (this.postureState !== 'seated_sofa' && this.postureState !== 'sitting_down_sofa') {
      onStood?.();
      return;
    }

    this.sofaStandStartPos.copy(this.root.position);
    this.sofaEntryPos.copy(standPos);
    this.sofaTransitionProgress = 0;
    this.sofaTransitionDuration = 0.96;
    this.standUpPlantedCaptured = false;
    this.onSofaTransitionDone = onStood ?? null;
    this.postureState = 'standing_up_sofa';
  }

  public registerHeldControllerMeshes(
    whitePad: THREE.Group,
    purplePad: THREE.Group
  ): void {
    if (this.heldWhitePadMesh) this.root.remove(this.heldWhitePadMesh);
    if (this.heldPurplePadMesh) this.root.remove(this.heldPurplePadMesh);
    this.heldWhitePadMesh = whitePad;
    this.heldPurplePadMesh = purplePad;
    whitePad.visible = false;
    purplePad.visible = false;
    this.root.add(whitePad);
    this.root.add(purplePad);
  }

  public isCoPlayCutsceneBusy(): boolean {
    return (
      this.gamingPhase !== 'none' &&
      this.gamingPhase !== 'playing_sofa'
    );
  }

  public beginSofaCoPlayCutscene(callbacks: {
    onPickedUpFromTable?: () => void;
    onHandoffStart?: () => void;
    onWhitePadTaken?: () => void;
    onBackSeated?: () => void;
  }): void {
    this.gamingCallbacks = callbacks;
    this.gamingPhase = 'stand_from_sofa';
    this.gamingPhaseTimer = 0;
    this.gamingPickupNotified = false;
    this.gamingHandoffTaken = false;
    this.hasWhitePadInHand = false;
    this.hasPurplePadInHand = false;
    this.gamingActionPulse = 0;
    this.walkUpperBodyStyle = 'normal';

    this.beginStandUpFromLivingSofa(new THREE.Vector3(3.14, 0, -5.68), () => {
      if (this.gamingPhase !== 'stand_from_sofa') return;
      this.gamingPhase = 'walk_to_table';
      this.gamingPhaseTimer = 0;
      const tableSpot = new THREE.Vector3(3.96, 0, -5.22);
      this.walkTargetPos.copy(tableSpot);
      this.planPathTo(tableSpot.x, tableSpot.z, 0);
      this.onStageWalkArrived = () => {
        if (this.gamingPhase !== 'walk_to_table') return;
        this.gamingPhase = 'pickup_pads';
        this.gamingPhaseTimer = 0;
        this.activePerformance = {
          expression: 'happy',
          gesture: 'idle',
          blush: 0.22,
          headTilt: 0.05,
          leanForward: 0.35,
        };
      };
      this.walkStartElapsed = 0;
      this.postureState = 'dialogue_walking';
    });
  }

  public triggerGamingReactionPulse(strength = 1.0): void {
    this.gamingActionPulse = Math.min(1.3, Math.max(this.gamingActionPulse, strength));
  }

  public endSofaCoPlay(): void {
    this.gamingPhase = 'none';
    this.gamingPhaseTimer = 0;
    this.gamingCallbacks = null;
    this.hasWhitePadInHand = false;
    this.hasPurplePadInHand = false;
    if (this.heldWhitePadMesh) this.heldWhitePadMesh.visible = false;
    if (this.heldPurplePadMesh) this.heldPurplePadMesh.visible = false;
  }

  /**
   * Drives the heroine's toy-gun aim reaction:
   * 1. When aimed at her (or fired near her), she immediately squeezes her eyes shut and raises
   *    both forearms defensively (`guard_flinch`) for ~0.8s.
   * 2. Then she smoothly lowers her hands and transitions into a micro-pout (`sad` + soft blush).
   */
  public setToyGunAimedAt(
    aimed: boolean,
    justFired = false
  ): 'none' | 'flinch_start' | 'pout_start' {
    if (this.poseTuner || !this.spawned) {
      this.toyGunAimed = false;
      this.toyGunPhase = 'none';
      this.toyGunPoutTimer = 0;
      this.toyGunPoutNotified = false;
      return 'none';
    }

    this.toyGunAimed = aimed;

    if (justFired) {
      this.toyGunPhase = 'flinch';
      this.toyGunPhaseTimer = 0;
      this.toyGunPoutTimer = 3.2;
      this.toyGunPoutNotified = false;
      return 'flinch_start';
    }

    if (aimed) {
      if (this.toyGunPhase === 'none') {
        this.toyGunPhase = 'flinch';
        this.toyGunPhaseTimer = 0;
        this.toyGunPoutTimer = 3.0;
        this.toyGunPoutNotified = false;
        return 'flinch_start';
      }
      if (this.toyGunPhase === 'pout') {
        this.toyGunPoutTimer = Math.max(this.toyGunPoutTimer, 2.2);
        if (!this.toyGunPoutNotified) {
          this.toyGunPoutNotified = true;
          return 'pout_start';
        }
      }
    } else if (this.toyGunPhase === 'pout' && !this.toyGunPoutNotified) {
      this.toyGunPoutNotified = true;
      return 'pout_start';
    }

    return 'none';
  }

  public isPoseTuning(): boolean {
    return this.poseTuner !== null;
  }

  public hasWalkClip(): boolean {
    return Boolean(this.actions.walk);
  }

  public getHeadWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    if (this.vrm) {
      const headNode =
        this.vrm.humanoid.getRawBoneNode('head') ??
        this.vrm.humanoid.getNormalizedBoneNode('head');
      if (headNode) {
        this.root.updateMatrixWorld(true);
        headNode.getWorldPosition(out);
        return out;
      }
    }
    return out.set(
      this.root.position.x,
      this.root.position.y + (this.postureState === 'seated' ? 1.25 : 1.48),
      this.root.position.z
    );
  }

  public getDistanceToWorldPoint(point: THREE.Vector3): number {
    return Math.hypot(
      this.root.position.x - point.x,
      this.root.position.z - point.z
    );
  }

  public setPerformanceCue(cue: HeroinePerformanceCue): void {
    if (cue.gesture !== this.activePerformance.gesture) {
      this.gestureElapsed = 0;
      // Smooth bone-level SLERP cross-fade whenever switching dialogue gestures (eliminates 1-frame arm snaps!)
      this.triggerPoseCrossFade(0.44);
    }
    if (cue.expression === 'wink') {
      // Trigger a crisp one-shot single-eye wink pulse that opens cleanly back to both eyes open
      this.winkPulseElapsed = 0;
    } else {
      this.winkPulseElapsed = -1;
    }
    this.activePerformance = {
      expression: cue.expression,
      gesture: cue.gesture,
      blush: cue.blush ?? 0,
      headTilt: cue.headTilt ?? 0,
      leanForward: cue.leanForward ?? 0,
      eyeAvert: Boolean(cue.eyeAvert),
    };
  }

  public setSpeaking(speaking: boolean): void {
    if (speaking && !this.isSpeaking) {
      // Kick off immediately on an open syllable beat so even short lines clearly animate lips
      this.speakPhase = 0.65;
    }
    this.isSpeaking = speaking;
    if (speaking) {
      this.speakTailTimer = 0.22;
    }
  }

  /**
   * Transitions the heroine smoothly from her procedural bed-edge sitting pose to standing up
   * on the bedroom floor, then walks to a comfortable conversational distance in front of the player.
   */
  public beginStandUpAndApproach(
    playerFeetPos: THREE.Vector3,
    onArrived?: () => void
  ): void {
    this.onWalkArrived = onArrived ?? null;

    // Compute a safe conversational stop point ~1.22m in front of the player on open bedroom floor
    const standOffX = BEDROOM_BED_SEAT_ANCHOR.x;
    const standOffZ = BEDROOM_STAND_OFF_BED_Z;
    let dx = standOffX - playerFeetPos.x;
    let dz = standOffZ - playerFeetPos.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) {
      dx = 0;
      dz = -1;
    } else {
      dx /= len;
      dz /= len;
    }

    const desiredDist = 1.22;
    let tx = THREE.MathUtils.clamp(
      playerFeetPos.x + dx * desiredDist,
      BEDROOM_WALK_MIN_X,
      BEDROOM_WALK_MAX_X
    );
    let tz = THREE.MathUtils.clamp(
      playerFeetPos.z + dz * desiredDist,
      BEDROOM_WALK_MIN_Z,
      BEDROOM_WALK_MAX_Z
    );

    // Ensure she never stops closer than 1.02m to the player camera
    const sep = Math.hypot(tx - playerFeetPos.x, tz - playerFeetPos.z);
    if (sep < 1.02) {
      const pushX = sep > 0.01 ? (tx - playerFeetPos.x) / sep : 0;
      const pushZ = sep > 0.01 ? (tz - playerFeetPos.z) / sep : -1;
      tx = THREE.MathUtils.clamp(
        playerFeetPos.x + pushX * 1.12,
        BEDROOM_WALK_MIN_X,
        BEDROOM_WALK_MAX_X
      );
      tz = THREE.MathUtils.clamp(
        playerFeetPos.z + pushZ * 1.12,
        BEDROOM_WALK_MIN_Z,
        BEDROOM_WALK_MAX_Z
      );
    }

    this.walkTargetPos.set(tx, 0, tz);
    this.walkUpperBodyStyle = 'normal';
    this.roomGlanceRemaining = 0;
    this.onRoomGlanceDone = null;
    this.onStageWalkArrived = null;
    this.pendingSitChairAfterWalk = false;

    this.bedroomIdleChairWaitActive = false;
    this.isBedroomDialogueFollowing = false;
    this.bedroomDialogueFollowEnabled = true;

    if (this.postureState === 'seated') {
      this.postureState = 'standing_up';
      this.standUpProgress = 0;
      this.standUpDuration = 1.72;
      this.standUpStartYaw = BEDROOM_BED_SEAT_ANCHOR.facingYaw;
      this.standUpForwardDist = 0.36;

      // Measure actual horizontal sagittal distance from seated pelvis to her hanging ankles
      // so the stand-up COM shift places her hips squarely over her planted feet with zero drift.
      if (this.vrm) {
        const hipsNode = this.vrm.humanoid.getNormalizedBoneNode('hips');
        const lFoot = this.vrm.humanoid.getNormalizedBoneNode('leftFoot');
        const rFoot = this.vrm.humanoid.getNormalizedBoneNode('rightFoot');
        if (hipsNode && lFoot && rFoot) {
          this.root.updateMatrixWorld(true);
          hipsNode.getWorldPosition(_hipsWorldPos);
          lFoot.getWorldPosition(_leftLegWorldPos);
          rFoot.getWorldPosition(_rightLegWorldPos);
          const avgFootX = (_leftLegWorldPos.x + _rightLegWorldPos.x) * 0.5;
          const avgFootZ = (_leftLegWorldPos.z + _rightLegWorldPos.z) * 0.5;
          const fwdX = Math.sin(this.standUpStartYaw);
          const fwdZ = Math.cos(this.standUpStartYaw);
          const proj = (avgFootX - _hipsWorldPos.x) * fwdX + (avgFootZ - _hipsWorldPos.z) * fwdZ;
          if (Number.isFinite(proj) && proj > 0.20 && proj < 0.52) {
            this.standUpForwardDist = THREE.MathUtils.clamp(proj, 0.30, 0.44);
          }
        }
      }

      // Initialize 2nd-order physics damping state cleanly
      this.standUpComFwd = 0;
      this.standUpComVelFwd = 0;
      this.standUpPelvisY = this.seatedRootY;
      this.standUpPelvisVelY = 0;
      this.standUpKneeSpring = 0;
      this.standUpKneeVel = 0;
      this.standUpGroundLoad = 0;
      this.standUpPlantedCaptured = false;

      this.walkPhase = 0;
      this.gestureElapsed = 0;
      this.greetingWaveElapsed = 0;
      // Keep seated skirt colliders active until legs straighten past ~75% during standing_up
      // so the skirt glides smoothly off the bed edge instead of collapsing on frame 1!
      this.activePerformance = {
        expression: 'neutral',
        gesture: 'idle',
        blush: 0,
        headTilt: 0,
        leanForward: 0,
        eyeAvert: false,
      };
    } else if (
      this.postureState === 'standing_talking' ||
      this.postureState === 'following_player'
    ) {
      const dist = Math.hypot(
        this.root.position.x - playerFeetPos.x,
        this.root.position.z - playerFeetPos.z
      );
      if (dist > 1.75) {
        this.planPathTo(tx, tz, this.root.position.y);
        this.postureState = 'walking_to_player';
        this.walkStartElapsed = 0;
      } else {
        this.postureState = 'standing_talking';
        const cb = this.onWalkArrived;
        this.onWalkArrived = null;
        cb?.();
      }
    }
  }

  /**
   * Executes a lively mid-dialogue choreography beat (corner glance + pause, crossed-arms stroll,
   * approaching player & extending hand, sitting in bedroom swivel chair, or standing up from it).
   * Fires `onReady()` once she finishes moving/pausing and is ready to deliver the line.
   */
  public runDialogueStageAction(
    action: HeroineStageAction,
    playerFeetPos: THREE.Vector3,
    onReady: () => void
  ): void {
    // Clear any in-flight stage callbacks cleanly & wake from chair boredom wait
    this.bedroomIdleChairWaitActive = false;
    this.isBedroomDialogueFollowing = false;
    this.roomGlanceRemaining = 0;
    this.onRoomGlanceDone = null;
    this.onStageWalkArrived = null;
    this.onChairTransitionDone = null;
    this.pendingSitChairAfterWalk = false;

    if (action.type === 'glance_room') {
      const targetPt = BEDROOM_GLANCE_TARGETS[action.target] ?? BEDROOM_GLANCE_TARGETS.desk;
      this.roomGlanceTargetPos.copy(targetPt);
      this.roomGlanceRemaining = action.pauseSec ?? 1.15;
      this.onRoomGlanceDone = onReady;
      // Relax any lingering raised gesture while glancing thoughtfully around the room
      if (
        this.activePerformance.gesture === 'wave' ||
        this.activePerformance.gesture === 'reach_hand' ||
        this.activePerformance.gesture === 'peace'
      ) {
        this.activePerformance.gesture = 'idle';
      }
      return;
    }

    if (action.type === 'stand_from_chair') {
      if (this.postureState === 'seated_chair' || this.postureState === 'sitting_down_chair') {
        this.beginStandUpFromChair(onReady);
      } else {
        onReady();
      }
      return;
    }

    // Actions requiring walking: if currently seated in chair, stand up smoothly first!
    const startAfterStanding = () => {
      // Never walk around holding a previous speaking hand gesture (like reach_hand / wave / peace)!
      this.activePerformance.gesture = 'idle';
      this.standingGestureBlend = 0;

      if (action.type === 'stroll_crossed') {
        const preset = BEDROOM_STROLL_SPOTS[action.spot] ?? BEDROOM_STROLL_SPOTS.center;
        let gx = preset.x;
        let gz = preset.z;
        // Avoid walking straight onto the player's shoes
        const distPlayer = Math.hypot(gx - playerFeetPos.x, gz - playerFeetPos.z);
        if (distPlayer < 1.05) {
          const dx = gx - playerFeetPos.x;
          const dz = gz - playerFeetPos.z;
          const l = Math.max(0.01, Math.hypot(dx, dz));
          gx = THREE.MathUtils.clamp(
            playerFeetPos.x + (dx / l) * 1.25,
            BEDROOM_WALK_MIN_X,
            BEDROOM_WALK_MAX_X
          );
          gz = THREE.MathUtils.clamp(
            playerFeetPos.z + (dz / l) * 1.25,
            BEDROOM_WALK_MIN_Z,
            BEDROOM_WALK_MAX_Z
          );
        }

        const walkDist = Math.hypot(gx - this.root.position.x, gz - this.root.position.z);
        if (walkDist < 0.45) {
          onReady();
          return;
        }
        this.walkUpperBodyStyle = 'arms_crossed';
        this.walkTargetPos.set(gx, 0, gz);
        this.planPathTo(gx, gz, this.root.position.y);
        this.postureState = 'dialogue_walking';
        this.walkStartElapsed = 0;
        this.onStageWalkArrived = () => {
          this.walkUpperBodyStyle = 'normal';
          this.postureState = 'standing_talking';
          onReady();
        };
        return;
      }

      if (action.type === 'approach_and_reach') {
        const stopDist = action.stopDist ?? 1.28;
        const dx = this.root.position.x - playerFeetPos.x;
        const dz = this.root.position.z - playerFeetPos.z;
        const curDist = Math.hypot(dx, dz);

        if (curDist <= stopDist + 0.28) {
          // Already close enough — simply turn naturally toward player if needed and reach out!
          this.postureState = 'standing_talking';
          this.isTurningInPlace = true;
          onReady();
          return;
        }

        const ux = curDist > 0.01 ? dx / curDist : 0;
        const uz = curDist > 0.01 ? dz / curDist : -1;
        const gx = playerFeetPos.x + ux * stopDist;
        const gz = playerFeetPos.z + uz * stopDist;

        this.walkUpperBodyStyle = 'normal';
        this.walkTargetPos.set(gx, this.root.position.y, gz);
        this.planPathTo(gx, gz, this.root.position.y);
        this.walkStartElapsed = 0;
        this.postureState = 'dialogue_walking';
        this.onStageWalkArrived = () => {
          this.postureState = 'standing_talking';
          this.isTurningInPlace = true;
          onReady();
        };
        return;
      }

      if (action.type === 'sit_swivel_chair') {
        const chair = this.bedroomChair;
        if (!chair) {
          onReady();
          return;
        }
        const cx = chair.rootGroup.position.x;
        const cz = chair.rootGroup.position.z;
        // Entry point ~0.48m in front/south-west of chair (clear of PC desk at Z = -6.12)
        const dirX = playerFeetPos.x - cx;
        const dirZ = Math.max(0.35, playerFeetPos.z - cz);
        const dirLen = Math.max(0.01, Math.hypot(dirX, dirZ));
        const entryX = THREE.MathUtils.clamp(
          cx + (dirX / dirLen) * 0.48,
          BEDROOM_WALK_MIN_X,
          BEDROOM_WALK_MAX_X
        );
        const entryZ = THREE.MathUtils.clamp(
          cz + (dirZ / dirLen) * 0.48,
          -5.05,
          BEDROOM_WALK_MAX_Z
        );
        this.chairEntryPos.set(entryX, chair.floorY, entryZ);
        // Use completely natural arm-swinging walk.fbx when walking over to the swivel chair
        this.walkUpperBodyStyle = 'normal';
        this.walkTargetPos.set(entryX, chair.floorY, entryZ);
        this.planPathTo(entryX, entryZ, this.root.position.y);
        this.walkStartElapsed = 0;
        this.postureState = 'dialogue_walking';
        this.pendingSitChairAfterWalk = true;
        this.onStageWalkArrived = () => {
          this.walkUpperBodyStyle = 'normal';
          this.pendingSitChairAfterWalk = false;
          this.beginSitIntoChair(playerFeetPos, onReady);
        };
      }
    };

    if (this.postureState === 'seated_chair' || this.postureState === 'sitting_down_chair') {
      this.beginStandUpFromChair(startAfterStanding);
    } else {
      startAfterStanding();
    }
  }

  private beginSitIntoChair(
    playerFeetPos: THREE.Vector3,
    onSeated?: () => void
  ): void {
    const chair = this.bedroomChair;
    if (!chair) {
      this.postureState = 'standing_talking';
      onSeated?.();
      return;
    }

    const cx = chair.rootGroup.position.x;
    const cz = chair.rootGroup.position.z;
    const desiredFaceYaw = Math.atan2(playerFeetPos.x - cx, playerFeetPos.z - cz);

    // Measure pelvis offset for swivel chair cushion top (Y = 0.505)
    let seatedThighLocalY = this.vrmStandingHipsHeight - 0.05;
    if (this.vrm) {
      const hipsNode = this.vrm.humanoid.getNormalizedBoneNode('hips');
      if (hipsNode) {
        const restLocalY = this.vrm.humanoid.normalizedRestPose?.hips?.position?.[1];
        if (typeof restLocalY === 'number' && restLocalY > 0.2) {
          seatedThighLocalY = restLocalY * this.vrm.scene.scale.y - 0.04;
        }
      }
    }
    this.chairSeatRootY =
      chair.floorY +
      SWIVEL_CHAIR_SEAT_SURFACE_Y +
      SEATED_THIGH_SURFACE_CLEARANCE -
      seatedThighLocalY;
    this.seatSurfaceLocalY =
      chair.floorY + SWIVEL_CHAIR_SEAT_SURFACE_Y - this.chairSeatRootY;

    this.chairStandStartPos.copy(this.root.position);
    this.chairFaceYaw = desiredFaceYaw;
    this.chairTransitionProgress = 0;
    this.chairTransitionDuration = 1.05;
    this.onChairTransitionDone = onSeated ?? null;

    // Activate unified seated lap-apron skirt physics BEFORE bending legs into the swivel chair
    // so the front skirt sweeps smoothly across her lap & knees instead of splitting open!
    if (this.vrm) {
      this.configureSeatedSkirtPhysics(this.vrm, 'chair');
      this.positionSeatedColliders(0);
      this.updateSeatedSkirtWorldGravity();
    }

    this.postureState = 'sitting_down_chair';
  }

  private beginStandUpFromChair(onStood?: () => void): void {
    const chair = this.bedroomChair;
    // Step cleanly directly over her planted feet (~0.28m forward of swivel chair center)
    const standDist = 0.28;
    const fx = Math.sin(this.root.rotation.y);
    const fz = Math.cos(this.root.rotation.y);
    const targetX = THREE.MathUtils.clamp(
      this.root.position.x + fx * standDist,
      BEDROOM_WALK_MIN_X,
      BEDROOM_WALK_MAX_X
    );
    const targetZ = THREE.MathUtils.clamp(
      this.root.position.z + fz * standDist,
      -5.05,
      BEDROOM_WALK_MAX_Z
    );

    this.activePerformance.gesture = 'idle';
    this.standingGestureBlend = 0;
    this.chairStandStartPos.copy(this.root.position);
    this.chairEntryPos.set(targetX, chair ? chair.floorY : 0, targetZ);
    this.chairTransitionProgress = 0;
    this.chairTransitionDuration = 0.96;
    this.standUpPlantedCaptured = false;
    this.onChairTransitionDone = onStood ?? null;
    this.postureState = 'standing_up_chair';
  }

  private planPathTo(goalX: number, goalZ: number, feetY: number): void {
    if (this.pathFinder) {
      this.activePath = this.pathFinder(
        this.root.position.x,
        this.root.position.z,
        goalX,
        goalZ,
        feetY
      );
    } else {
      this.activePath = [{ x: goalX, z: goalZ }];
    }
    this.lastPlannedGoal.set(goalX, feetY, goalZ);
    this.pathReplanTimer = 0.45;
  }

  /**
   * Transitions the heroine directly into following the player across the apartment
   * after the bedroom encounter finishes, using A* obstacle avoidance & `walk.fbx` / `idle.fbx`.
   */
  public startFollowingPlayer(playerFeetPos: THREE.Vector3): void {
    this.poseTuner = null;
    this.preTunerPosture = null;
    this.bedroomDialogueFollowEnabled = false;
    this.isBedroomDialogueFollowing = false;
    this.bedroomIdleChairWaitActive = false;
    this.onWalkArrived = null;
    this.onRoomGlanceDone = null;
    this.onStageWalkArrived = null;
    this.roomGlanceRemaining = 0;
    this.pendingSitChairAfterWalk = false;
    this.walkUpperBodyStyle = 'normal';
    this.isSpeaking = false;
    this.isFollowMoving = false;
    this.followStuckTimer = 0;
    this.activePath = [];
    this.lastPlannedGoal.set(999, 0, 999);
    this.restoreStandingSkirtPhysics();
    this.activePerformance = {
      expression: 'neutral',
      gesture: 'idle',
      blush: 0,
      headTilt: 0,
      leanForward: 0,
      eyeAvert: false,
    };

    this.sofaInDialogue = false;
    this.sofaReactionTimer = 0;
    this.onSofaTransitionDone = null;
    if (this.postureState === 'seated_chair' || this.postureState === 'sitting_down_chair') {
      this.beginStandUpFromChair(() => {
        this.postureState = 'following_player';
        this.lastPlannedGoal.set(999, 0, 999);
      });
    } else if (this.postureState === 'seated_sofa' || this.postureState === 'sitting_down_sofa') {
      this.beginStandUpFromLivingSofa(this.sofaEntryPos.clone(), () => {
        this.postureState = 'following_player';
        this.lastPlannedGoal.set(999, 0, 999);
      });
    } else {
      this.postureState = 'following_player';
    }
  }

  /**
   * Enables or disables real-time Pose Tuner preview mode from the bottom-left debug panel.
   * Automatically positions the heroine seated (for `seated`) or standing cleanly in front of
   * the player (for standing gestures) so slider adjustments are visible at 60fps.
   */
  public setPoseTunerState(
    state: HeroinePoseTunerState | null,
    playerFeetPos?: THREE.Vector3
  ): void {
    if (!state) {
      const prev = this.preTunerPosture;
      this.poseTuner = null;
      this.preTunerPosture = null;
      // Always keep heroine visible when leaving Pose Tuner (never vanish)
      if (this.vrm) {
        this.spawned = true;
        this.root.visible = true;
      }
      if (prev === 'seated' && this.postureState !== 'seated') {
        this.resetToBedroomBed();
      } else if (prev === 'following_player') {
        this.restoreStandingSkirtPhysics();
        this.root.position.copy(this.preTunerPos);
        this.root.rotation.y = this.preTunerYaw;
        this.postureState = 'following_player';
        this.isFollowMoving = false;
      }
      return;
    }

    if (!this.poseTuner) {
      this.preTunerPosture = this.postureState;
      this.preTunerPos.copy(this.root.position);
      this.preTunerYaw = this.root.rotation.y;
    }

    const prevPoseId = this.poseTuner?.poseId;
    this.poseTuner = state;
    this.spawned = true;
    this.root.visible = this.vrm !== null;

    if (prevPoseId !== state.poseId) {
      this.gestureElapsed = 0;
      this.smoothedBoneEuler.clear();
    }

    if (state.poseId === 'seated') {
      if (this.postureState !== 'seated') {
        this.postureState = 'seated';
        if (this.vrm) {
          this.configureSeatedSkirtPhysics(this.vrm);
          this.applyBedEdgeTransform();
        }
      }
    } else {
      // Preview standing gesture cleanly on floor with seated skirt colliders disabled
      const wasSeated = this.postureState === 'seated';
      this.restoreStandingSkirtPhysics();
      this.postureState = 'standing_talking';
      if (wasSeated) {
        let sx = BEDROOM_BED_SEAT_ANCHOR.x;
        let sz = BEDROOM_STAND_OFF_BED_Z;
        if (playerFeetPos) {
          const dx = sx - playerFeetPos.x;
          const dz = sz - playerFeetPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.95) {
            sx = BEDROOM_BED_SEAT_ANCHOR.x;
            sz = BEDROOM_STAND_OFF_BED_Z;
          }
        }
        this.root.position.set(sx, 0, sz);
      }
    }
  }

  /**
   * Restores the heroine back to her seated bed-edge pose & seated skirt colliders (e.g. on game reset).
   */
  public resetToBedroomBed(): void {
    this.poseTuner = null;
    this.preTunerPosture = null;
    this.postureState = 'seated';
    this.standUpProgress = 0;
    this.onWalkArrived = null;
    this.onRoomGlanceDone = null;
    this.onStageWalkArrived = null;
    this.onChairTransitionDone = null;
    this.roomGlanceRemaining = 0;
    this.pendingSitChairAfterWalk = false;
    this.walkUpperBodyStyle = 'normal';
    this.armsCrossedWalkBlend = 0;
    this.isTurningInPlace = false;
    this.turnFootworkBlend = 0;
    this.isSpeaking = false;
    this.isFollowMoving = false;
    this.activePath = [];
    this.lastPlannedGoal.set(999, 0, 999);
    this.followStuckTimer = 0;
    this.smoothedBoneEuler.clear();
    this.resetPoseTransitionState();
    this.resetSofaTvStateMachine(true);
    this.zeroLocomotionMixerWeights();
    this.activeExprChannel = 'none';
    this.activeExprLinear = 0;
    this.currentHappy = 0;
    this.currentRelaxed = 0;
    this.currentSad = 0;
    this.currentAngry = 0;
    this.currentSurprised = 0;
    this.currentWink = 0;
    this.winkPulseElapsed = -1;
    this.activePerformance = {
      expression: 'neutral',
      gesture: 'idle',
      blush: 0,
      headTilt: 0,
      leanForward: 0,
      eyeAvert: false,
    };
    if (this.vrm) {
      this.configureSeatedSkirtPhysics(this.vrm);
      this.applyBedEdgeTransform();
    }
  }

  private resetPoseTransitionState(): void {
    this.activePoseDriver = 'none';
    this.hasLastCommittedPose = false;
    this.transitionElapsed = 0;
    this.transitionDuration = 0;
  }

  /**
   * Snapshots the exact post-blend visual pose from the previous frame and smoothly SLERPs into
   * the incoming pose over `duration` seconds — works even within the same pose driver (e.g.
   * switching between layered dialogue gestures or transitioning out of greeting_wave).
   */
  private triggerPoseCrossFade(duration = 0.42): void {
    if (!this.hasLastCommittedPose || duration <= 0.01) return;
    this.lastCommittedQuats.forEach((q, boneName) => {
      let dst = this.transitionFromQuats.get(boneName);
      if (!dst) {
        dst = new THREE.Quaternion();
        this.transitionFromQuats.set(boneName, dst);
      }
      dst.copy(q);
    });
    this.transitionFromHipsPos.copy(this.lastCommittedHipsPos);
    this.transitionElapsed = 0;
    this.transitionDuration = duration;
  }

  private beginPoseDriverTransition(
    nextDriver: HeroinePoseDriver,
    duration = 0.38
  ): void {
    if (nextDriver === this.activePoseDriver) return;
    if (this.hasLastCommittedPose && this.activePoseDriver !== 'none' && duration > 0.01) {
      this.triggerPoseCrossFade(duration);
    } else {
      this.transitionElapsed = 0;
      this.transitionDuration = 0;
    }
    this.activePoseDriver = nextDriver;
  }

  private applyAndRecordPoseTransition(vrm: VRM, dt: number): void {
    const bones = vrm.humanoid.normalizedHumanBones;
    const boneNames = Object.keys(bones) as VRMHumanBoneName[];

    if (this.transitionDuration > 0) {
      this.transitionElapsed += dt;
      const rawT = THREE.MathUtils.clamp(
        this.transitionElapsed / this.transitionDuration,
        0,
        1
      );
      // Quintic smootherstep (zero velocity & zero acceleration at endpoints -> organic ease-in-out)
      const ease = rawT * rawT * rawT * (rawT * (rawT * 6 - 15) + 10);

      for (let i = 0; i < boneNames.length; i++) {
        const boneName = boneNames[i];
        if (HEAD_TRACKED_BONES.has(boneName)) continue;
        const node = vrm.humanoid.getNormalizedBoneNode(boneName);
        const fromQuat = this.transitionFromQuats.get(boneName);
        if (node && fromQuat) {
          // CRITICAL: THREE.Quaternion.slerpQuaternions(qa, qb, t) does `this.copy(qa).slerp(qb, t)`.
          // Passing `node.quaternion` as `qb` overwrites `qb` with `qa` before slerping, freezing the bone!
          // Always copy the target quaternion into `_blendQuatB` first!
          _blendQuatB.copy(node.quaternion);
          node.quaternion.slerpQuaternions(fromQuat, _blendQuatB, ease);
        }
      }

      const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
      if (hipsNode) {
        hipsNode.position.lerpVectors(this.transitionFromHipsPos, hipsNode.position, ease);
      }

      if (rawT >= 1) {
        this.transitionDuration = 0;
      }
    } else if (this.hasLastCommittedPose && !this.poseTuner) {
      // Continuous safety per-bone SLERP damper prevents ANY 1-frame micro-snaps (e.g. finger switches or clip starts)
      const contAlpha = 1 - Math.exp(-24.0 * dt);
      for (let i = 0; i < boneNames.length; i++) {
        const boneName = boneNames[i];
        if (HEAD_TRACKED_BONES.has(boneName)) continue;
        const node = vrm.humanoid.getNormalizedBoneNode(boneName);
        const prevQuat = this.lastCommittedQuats.get(boneName);
        if (node && prevQuat) {
          _blendQuatB.copy(node.quaternion);
          node.quaternion.slerpQuaternions(prevQuat, _blendQuatB, contAlpha);
        }
      }
    }

    // Record post-blend pose as the exact visual baseline for any future transition
    for (let i = 0; i < boneNames.length; i++) {
      const boneName = boneNames[i];
      if (HEAD_TRACKED_BONES.has(boneName)) continue;
      const node = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) continue;
      let stored = this.lastCommittedQuats.get(boneName);
      if (!stored) {
        stored = new THREE.Quaternion();
        this.lastCommittedQuats.set(boneName, stored);
      }
      stored.copy(node.quaternion);
    }

    const hipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
    if (hipsNode) {
      this.lastCommittedHipsPos.copy(hipsNode.position);
    }
    this.hasLastCommittedPose = true;
  }

  private zeroLocomotionMixerWeights(): void {
    this.actionWeights.idle = 0;
    this.actionWeights.walk = 0;
    if (this.actions.idle) this.actions.idle.setEffectiveWeight(0);
    if (this.actions.walk) this.actions.walk.setEffectiveWeight(0);
  }

  /**
   * Returns -1 for VRM 0.x (normalized bones live inside `vrm.scene` rotated 180 deg around Y,
   * so X and Z axes are negated relative to character-forward +Z) and +1 for VRM 1.0.
   */
  private getVrmAxisSign(vrm: VRM): 1 | -1 {
    return vrm.meta?.metaVersion === '0' ? -1 : 1;
  }

  /**
   * Sets a normalized humanoid bone's local Euler rotation from canonical VRM 1.0 space
   * (+Z forward, +Y up, +X character left), automatically conjugating by Ry(PI) for VRM 0.x
   * so both VRM 0.x and VRM 1.0 produce identical anatomical poses without joint twisting.
   */
  private setCanonicalBoneRotation(
    vrm: VRM,
    boneName: VRMHumanBoneName,
    rx: number,
    ry: number,
    rz: number,
    order: THREE.EulerOrder = 'YXZ'
  ): void {
    const node = vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!node) return;
    const s = this.getVrmAxisSign(vrm);
    node.rotation.order = order;
    node.rotation.set(rx * s, ry, rz * s);
  }

  /**
   * Immediately spawns and seats the heroine on the bedroom bed-edge anchor facing into the room.
   */
  public spawnOnBedroomBed(): void {
    this.spawned = true;
    this.postureState = 'seated';
    this.standUpProgress = 0;
    this.onWalkArrived = null;
    this.isSpeaking = false;
    this.smoothedBoneEuler.clear();
    this.resetPoseTransitionState();
    if (this.vrm) {
      if (this.seatedColliders.length === 0) {
        this.configureSeatedSkirtPhysics(this.vrm);
      }
      this.applyBedEdgeTransform();
      this.root.visible = true;
    }
  }

  public setSpawned(visible: boolean): void {
    this.spawned = visible;
    if (visible && this.postureState === 'seated') {
      this.applyBedEdgeTransform();
    }
    this.root.visible = visible && this.vrm !== null;
  }

  /**
   * Explicitly updates every custom seated SpringBone collider's world & colliderMatrix.
   * NOTE: `@pixiv/three-vrm`'s `VRMSpringBoneCollider` only updates `colliderMatrix` inside
   * `updateWorldMatrix()` (not `updateMatrixWorld()`), so we must invoke `updateWorldMatrix(true, false)`
   * explicitly after moving `root` or the colliders and before `vrm.update()` / `springBoneManager.update()`.
   */
  private updateSeatedCollidersWorldMatrix(): void {
    for (let i = 0; i < this.seatedColliders.length; i++) {
      this.seatedColliders[i].updateWorldMatrix(true, false);
    }
  }

  /**
   * Positions the seated bed & lap colliders in `this.root` local space for a given sit blend [0..1].
   * At `sitBlend = 0`, the bed is lowered and lap capsules hang along standing legs;
   * at `sitBlend = 1`, all colliders sit cleanly at their calibrated mattress & seated-thigh positions.
   */
  private positionSeatedColliders(sitBlend: number): void {
    const t = THREE.MathUtils.clamp(sitBlend, 0, 1);
    const bedDrop = (1 - t) * 0.42;
    const legPitch = t * 1.50;
    const sinP = Math.sin(legPitch);
    const cosP = Math.cos(legPitch);
    const y0 = this.seatSurfaceLocalY;
    const isChair = this.seatedSurfaceMode === 'chair';
    const isSofa = this.seatedSurfaceMode === 'sofa';

    if (this.seatedBedPlaneCollider) {
      this.seatedBedPlaneCollider.position.set(
        0,
        y0 + (isChair || isSofa ? 0.008 : BED_PLANE_SURFACE_OFFSET_Y) - bedDrop,
        0
      );
    }
    if (this.seatedMattressEdgeCollider) {
      if (isChair) {
        this.seatedMattressEdgeCollider.position.set(0, y0 - 0.115 - bedDrop, 0.04);
      } else if (isSofa) {
        this.seatedMattressEdgeCollider.position.set(0, y0 - 0.145 - bedDrop, -0.02);
      } else {
        this.seatedMattressEdgeCollider.position.set(0, y0 - 0.195 - bedDrop, -0.05);
      }
    }
    // Seamless overlapping 4-capsule thigh-hugging lap surface: adjacent capsules overlap by >20%
    // with ZERO inter-capsule valleys so front skirt cloth lays flat & smooth on her thighs
    // strictly BETWEEN her legs and resting hands!
    if (this.seatedUpperLapCollider) {
      this.seatedUpperLapCollider.position.set(
        0,
        y0 + 0.030 - cosP * 0.05,
        sinP * 0.052
      );
    }
    if (this.seatedLapBridgeCollider) {
      this.seatedLapBridgeCollider.position.set(
        0,
        y0 + 0.029 - cosP * 0.125,
        sinP * 0.125
      );
    }
    if (this.seatedUpperKneeCollider) {
      this.seatedUpperKneeCollider.position.set(
        0,
        y0 + 0.026 - cosP * 0.200,
        sinP * 0.200
      );
    }
    if (this.seatedKneeBridgeCollider) {
      this.seatedKneeBridgeCollider.position.set(
        0,
        y0 + 0.017 - cosP * 0.275,
        sinP * 0.275
      );
    }
  }

  /**
   * Temporarily increases skirt SpringBone damping while sliding into/out of a seat
   * so root translation never whips or creases the front skirt hem.
   */
  private setSeatedSkirtSlideDamping(isSliding: boolean): void {
    this.skirtJointOriginalSettings.forEach((orig, joint) => {
      joint.settings.dragForce = isSliding
        ? Math.max(orig.dragForce, 0.94)
        : Math.max(orig.dragForce, 0.85);
    });
  }

  /**
   * Runs a brief calm SpringBone relaxation pass when locking into a swivel chair or sofa seat
   * so the front skirt & apron lay smoothly across her thighs with zero residual motion kinks.
   */
  private settleSeatedSkirtCalmly(steps = 10): void {
    if (!this.vrm?.springBoneManager) return;
    this.setSeatedSkirtSlideDamping(false);
    this.vrm.humanoid.update();
    this.positionSeatedColliders(1);
    this.updateSeatedSkirtWorldGravity();
    this.root.updateMatrixWorld(true);
    this.updateSeatedCollidersWorldMatrix();
    for (let i = 0; i < steps; i++) {
      this.vrm.springBoneManager.update(1 / 60);
    }
  }

  /**
   * Re-orients every seated skirt joint's world gravity vector from `this.root.quaternion` so
   * front/side/back drape stays smoothly aligned with her lap even as the swivel chair rotates.
   */
  private updateSeatedSkirtWorldGravity(): void {
    if (this.seatedColliders.length === 0) return;
    this.skirtJointOriginalSettings.forEach((orig, joint) => {
      joint.settings.gravityDir
        .copy(orig.localSeatedGravityDir)
        .applyQuaternion(this.root.quaternion)
        .normalize();
    });
  }

  /**
   * Calibrates the heroine root transform so her seated pelvis & underside of thighs rest flush
   * on the plush duvet edge (`seatSurfaceY`), with knees and shins hanging freely off the bed edge,
   * then performs a smooth sit-down SpringBone pre-settlement so the entire skirt sweeps cleanly
   * onto her lap and fans evenly across the duvet with zero bed clipping and zero twisting.
   */
  private applyBedEdgeTransform(): void {
    this.root.position.set(
      BEDROOM_BED_SEAT_ANCHOR.x,
      0,
      BEDROOM_BED_SEAT_ANCHOR.z
    );
    this.root.rotation.set(0, BEDROOM_BED_SEAT_ANCHOR.facingYaw, 0);

    if (!this.vrm) return;

    // Always use the canonical procedural seated pose (no longer dependent on sit.fbx)
    this.applyProceduralSeatedPose(this.vrm, 0, 1);
    this.vrm.humanoid.update();
    this.root.updateMatrixWorld(true);

    const leftLeg = this.vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
    const rightLeg = this.vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
    const hipsNode = this.vrm.humanoid.getNormalizedBoneNode('hips');

    let seatedThighLocalY = this.vrmStandingHipsHeight - 0.05;
    if (leftLeg && rightLeg) {
      leftLeg.getWorldPosition(_leftLegWorldPos);
      rightLeg.getWorldPosition(_rightLegWorldPos);
      const avgLegY = (_leftLegWorldPos.y + _rightLegWorldPos.y) * 0.5;
      if (Number.isFinite(avgLegY)) {
        seatedThighLocalY = avgLegY - this.root.position.y;
      }
    } else if (hipsNode) {
      hipsNode.getWorldPosition(_hipsWorldPos);
      if (Number.isFinite(_hipsWorldPos.y)) {
        seatedThighLocalY = _hipsWorldPos.y - this.root.position.y - 0.05;
      }
    }

    const rootY =
      BEDROOM_BED_SEAT_ANCHOR.seatSurfaceY +
      SEATED_THIGH_SURFACE_CLEARANCE -
      seatedThighLocalY;

    this.seatedRootY = rootY;
    this.seatSurfaceLocalY = BEDROOM_BED_SEAT_ANCHOR.seatSurfaceY - rootY;

    this.root.position.set(
      BEDROOM_BED_SEAT_ANCHOR.x,
      rootY,
      BEDROOM_BED_SEAT_ANCHOR.z
    );

    // Align seated skirt gravity with her exact bed facing yaw BEFORE pre-settlement!
    this.updateSeatedSkirtWorldGravity();

    // Smoothly sweep legs & bed/lap colliders from standing -> seated so front skirt chains are
    // carried cleanly ON TOP of the thighs (never trapped underneath) and back/side skirt fans onto duvet.
    if (this.vrm.springBoneManager) {
      this.applyProceduralSeatedPose(this.vrm, 0, 0);
      this.vrm.humanoid.update();
      this.positionSeatedColliders(0);
      this.root.updateMatrixWorld(true);
      this.updateSeatedCollidersWorldMatrix();
      this.vrm.springBoneManager.reset();

      const rampSteps = 26;
      const settleSteps = 20;
      for (let step = 1; step <= rampSteps + settleSteps; step++) {
        const linearT = Math.min(1, step / rampSteps);
        const ease = 1 - (1 - linearT) * (1 - linearT);
        this.applyProceduralSeatedPose(this.vrm, 0, ease);
        this.vrm.humanoid.update();
        this.positionSeatedColliders(ease);
        this.root.updateMatrixWorld(true);
        this.updateSeatedCollidersWorldMatrix();
        this.vrm.springBoneManager.update(1 / 60);
      }
    } else {
      this.positionSeatedColliders(1);
      this.root.updateMatrixWorld(true);
      this.updateSeatedCollidersWorldMatrix();
    }
  }

  /**
   * Configures seated skirt/apron/petticoat SpringBone physics:
   * - Builds a 5-collider seated rig (bed top plane, mattress front-edge guard cylinder, and
   *   3 horizontal lap-bridge capsules spanning across both thighs/knees to seal the inter-thigh gap).
   * - Groups skirt SpringBone joints by chain root so every bone in a chain shares one coherent
   *   radial drape direction around the waist — eliminating vertical-impact buckling & mesh twisting.
   * - Appends our custom collider groups at the end of `joint.colliderGroups` so bed & lap collision
   *   constraints always win on every frame.
   */
  private configureSeatedSkirtPhysics(
    vrm: VRM,
    surfaceMode: 'bed' | 'chair' | 'sofa' = 'bed'
  ): void {
    const manager = vrm.springBoneManager;
    if (!manager) return;

    this.restoreStandingSkirtPhysics();
    this.seatedSurfaceMode = surfaceMode;
    const isChair = surfaceMode === 'chair';
    const isSofa = surfaceMode === 'sofa';

    const bedPlane = new VRMSpringBoneCollider(
      new VRMSpringBoneColliderShapePlane({
        offset: new THREE.Vector3(0, 0, 0),
        normal: new THREE.Vector3(0, 1, 0),
      })
    );
    bedPlane.name = 'HeroineSeatedBedPlaneCollider';

    const mattressEdge = new VRMSpringBoneCollider(
      new VRMSpringBoneColliderShapeCapsule({
        offset: new THREE.Vector3(isChair ? -0.22 : isSofa ? -0.34 : -0.50, 0, 0),
        tail: new THREE.Vector3(isChair ? 0.22 : isSofa ? 0.34 : 0.50, 0, 0),
        radius: isChair ? 0.12 : isSofa ? 0.16 : 0.22,
      })
    );
    mattressEdge.name = 'HeroineSeatedMattressEdgeCollider';

    // Seamless overlapping 4-capsule lap surface: slightly fuller overlapping radii at lowered Y
    // keep the top surface flush with thigh skin while eliminating inter-capsule valley creases!
    const upperLap = new VRMSpringBoneCollider(
      new VRMSpringBoneColliderShapeCapsule({
        offset: new THREE.Vector3(-0.150, 0, 0),
        tail: new THREE.Vector3(0.150, 0, 0),
        radius: 0.050,
      })
    );
    upperLap.name = 'HeroineSeatedUpperLapCollider';

    const lapBridge = new VRMSpringBoneCollider(
      new VRMSpringBoneColliderShapeCapsule({
        offset: new THREE.Vector3(-0.145, 0, 0),
        tail: new THREE.Vector3(0.145, 0, 0),
        radius: 0.049,
      })
    );
    lapBridge.name = 'HeroineSeatedLapBridgeCollider';

    const upperKnee = new VRMSpringBoneCollider(
      new VRMSpringBoneColliderShapeCapsule({
        offset: new THREE.Vector3(-0.138, 0, 0),
        tail: new THREE.Vector3(0.138, 0, 0),
        radius: 0.047,
      })
    );
    upperKnee.name = 'HeroineSeatedUpperKneeCollider';

    const kneeBridge = new VRMSpringBoneCollider(
      new VRMSpringBoneColliderShapeCapsule({
        offset: new THREE.Vector3(-0.128, 0, 0),
        tail: new THREE.Vector3(0.128, 0, 0),
        radius: 0.044,
      })
    );
    kneeBridge.name = 'HeroineSeatedKneeBridgeCollider';

    this.seatedBedPlaneCollider = bedPlane;
    this.seatedMattressEdgeCollider = mattressEdge;
    this.seatedUpperLapCollider = upperLap;
    this.seatedLapBridgeCollider = lapBridge;
    this.seatedUpperKneeCollider = upperKnee;
    this.seatedKneeBridgeCollider = kneeBridge;
    this.seatedColliders = [
      bedPlane,
      mattressEdge,
      upperLap,
      lapBridge,
      upperKnee,
      kneeBridge,
    ];

    for (let i = 0; i < this.seatedColliders.length; i++) {
      this.root.add(this.seatedColliders[i]);
    }
    this.positionSeatedColliders(1);
    this.root.updateMatrixWorld(true);
    this.updateSeatedCollidersWorldMatrix();

    const backSideGroup: VRMSpringBoneColliderGroup = {
      name: 'HeroineSeatedBackSideGroup',
      colliders: [mattressEdge, bedPlane],
    };
    const frontGroup: VRMSpringBoneColliderGroup = {
      name: 'HeroineSeatedFrontLapGroup',
      colliders: [upperLap, lapBridge, upperKnee, kneeBridge],
    };
    this.seatedBackSideColliderGroup = backSideGroup;
    this.seatedFrontColliderGroup = frontGroup;

    // Measure chain roots relative to hips
    const rawHips = vrm.humanoid.getRawBoneNode('hips');
    if (rawHips) {
      rawHips.getWorldPosition(_hipsWorldPos);
    } else {
      _hipsWorldPos.set(
        this.root.position.x,
        this.root.position.y + this.vrmStandingHipsHeight,
        this.root.position.z
      );
    }
    _invRootQuat.copy(this.root.quaternion).invert();

    const excludedAncestors = new Set<THREE.Object3D>();
    const excludedBoneNames: VRMHumanBoneName[] = [
      'head',
      'neck',
      'leftShoulder',
      'rightShoulder',
      'leftUpperArm',
      'rightUpperArm',
      'leftLowerArm',
      'rightLowerArm',
      'leftHand',
      'rightHand',
    ];
    for (let i = 0; i < excludedBoneNames.length; i++) {
      const node = vrm.humanoid.getRawBoneNode(excludedBoneNames[i]);
      if (node) excludedAncestors.add(node);
    }

    const isUnderExcluded = (node: THREE.Object3D): boolean => {
      let cur: THREE.Object3D | null = node;
      while (cur) {
        if (excludedAncestors.has(cur)) return true;
        cur = cur.parent;
      }
      return false;
    };

    // Map bone -> joint so we can climb every joint to its SpringBone chain root
    const boneToJoint = new Map<THREE.Object3D, VRMSpringBoneJoint>();
    manager.joints.forEach((joint) => {
      boneToJoint.set(joint.bone, joint);
    });

    const getChainRootJoint = (joint: VRMSpringBoneJoint): VRMSpringBoneJoint => {
      let rootJoint = joint;
      let parent = joint.bone.parent;
      while (parent) {
        const parentJoint = boneToJoint.get(parent);
        if (!parentJoint) break;
        rootJoint = parentJoint;
        parent = parent.parent;
      }
      return rootJoint;
    };

    interface ChainDrapeConfig {
      isSkirt: boolean;
      isFront: boolean;
      localGravityDir: THREE.Vector3;
    }
    const chainCache = new Map<VRMSpringBoneJoint, ChainDrapeConfig>();

    manager.joints.forEach((joint) => {
      const rootJoint = getChainRootJoint(joint);
      let cfg = chainCache.get(rootJoint);

      if (!cfg) {
        const rootName = rootJoint.bone.name || '';
        const jointName = joint.bone.name || '';
        const combinedName = `${rootName} ${jointName}`;

        if (isUnderExcluded(rootJoint.bone) || NON_SKIRT_NAME_REGEX.test(combinedName)) {
          cfg = {
            isSkirt: false,
            isFront: false,
            localGravityDir: new THREE.Vector3(0, -1, 0),
          };
          chainCache.set(rootJoint, cfg);
        } else {
          rootJoint.bone.getWorldPosition(_jointWorldPos);
          _jointRelLocal
            .subVectors(_jointWorldPos, _hipsWorldPos)
            .applyQuaternion(_invRootQuat);

          const isNamedSkirt = SKIRT_NAME_REGEX.test(combinedName);
          const isInWaistToKneeZone =
            _jointRelLocal.y <= 0.18 && _jointRelLocal.y >= -0.45;

          if (!isNamedSkirt && !isInWaistToKneeZone) {
            cfg = {
              isSkirt: false,
              isFront: false,
              localGravityDir: new THREE.Vector3(0, -1, 0),
            };
            chainCache.set(rootJoint, cfg);
          } else {
            let relX = _jointRelLocal.x;
            let relZ = _jointRelLocal.z;
            if (rootJoint.child) {
              rootJoint.child.getWorldPosition(_childWorldPos);
              _childRelLocal
                .subVectors(_childWorldPos, _hipsWorldPos)
                .applyQuaternion(_invRootQuat);
              if (Math.hypot(relX, relZ) < 0.025) {
                relX = _childRelLocal.x;
                relZ = _childRelLocal.z;
              } else {
                relX = relX * 0.65 + _childRelLocal.x * 0.35;
                relZ = relZ * 0.65 + _childRelLocal.z * 0.35;
              }
            }

            let horizLen = Math.hypot(relX, relZ);
            let dirX = horizLen > 1e-4 ? relX / horizLen : 0;
            let dirZ = horizLen > 1e-4 ? relZ / horizLen : -1;

            if (FRONT_SKIRT_NAME_REGEX.test(combinedName)) {
              dirZ = Math.max(dirZ, 0.72);
              horizLen = Math.hypot(dirX, dirZ) || 1;
              dirX /= horizLen;
              dirZ /= horizLen;
            } else if (BACK_SKIRT_NAME_REGEX.test(combinedName)) {
              dirZ = Math.min(dirZ, -0.72);
              horizLen = Math.hypot(dirX, dirZ) || 1;
              dirX /= horizLen;
              dirZ /= horizLen;
            }

            // Treat a generous front arc (dirZ > 0.14) as front-lap cloth so front-diagonal panels
            // also drape smoothly forward over her knees instead of splitting sideways!
            const isFront =
              FRONT_SKIRT_NAME_REGEX.test(combinedName) ||
              (!BACK_SKIRT_NAME_REGEX.test(combinedName) && dirZ > 0.14);

            if (isFront) {
              // Smooth, natural forward-sloping drape so front skirt & apron lay cleanly across her
              // thighs and over her knees without collapsing or accordion-folding into creases!
              _drapeDirLocal
                .set(dirX * 0.15, -0.46, Math.max(dirZ, 0.62) * 0.86)
                .normalize();
            } else if (dirZ > -0.28) {
              // Guide side skirt cleanly outward/downward onto the cushion beside her thighs
              const sideSign = dirX >= 0 ? 1 : -1;
              _drapeDirLocal
                .set(sideSign * 0.68, -0.52, Math.max(0.10, dirZ * 0.42))
                .normalize();
            } else {
              // Guide back skirt smoothly across the bed/chair/sofa cushion behind her
              _drapeDirLocal
                .set(dirX * 0.56, -0.50, dirZ * 0.78)
                .normalize();
            }

            cfg = {
              isSkirt: true,
              isFront,
              localGravityDir: _drapeDirLocal.clone(),
            };
            chainCache.set(rootJoint, cfg);
          }
        }
      }

      if (!cfg.isSkirt) return;

      let orig = this.skirtJointOriginalSettings.get(joint);
      if (!orig) {
        orig = {
          hitRadius: joint.settings.hitRadius,
          stiffness: joint.settings.stiffness,
          dragForce: joint.settings.dragForce,
          gravityPower: joint.settings.gravityPower,
          gravityDir: joint.settings.gravityDir.clone(),
          originalColliderGroups: [...joint.colliderGroups],
          localSeatedGravityDir: cfg.localGravityDir.clone(),
        };
        this.skirtJointOriginalSettings.set(joint, orig);
      } else {
        orig.localSeatedGravityDir.copy(cfg.localGravityDir);
      }

      // Balanced cloth tension & high damping: prevents limp crumpling/folding while still pressing
      // smoothly onto her thighs strictly underneath her resting hands!
      joint.settings.hitRadius = cfg.isFront
        ? 0.016
        : THREE.MathUtils.clamp(orig.hitRadius || 0.022, 0.018, 0.026);
      joint.settings.stiffness = cfg.isFront
        ? Math.min(Math.max(orig.stiffness, 0.24), 0.34)
        : Math.min(Math.max(orig.stiffness, 0.22), 0.30);
      joint.settings.dragForce = Math.max(orig.dragForce, 0.85);
      joint.settings.gravityDir
        .copy(cfg.localGravityDir)
        .applyQuaternion(this.root.quaternion)
        .normalize();
      joint.settings.gravityPower = cfg.isFront
        ? Math.max(orig.gravityPower, 1.28)
        : Math.max(orig.gravityPower, 1.18);

      if (cfg.isFront) {
        // Replace narrow separate left/right thigh colliders on FRONT skirt joints with our
        // unified broad lap-apron ramp so there is ZERO inter-thigh V-groove twisting or curtain-splitting!
        // (Original colliderGroups are 100% restored verbatim in restoreStandingSkirtPhysics().)
        joint.colliderGroups.length = 0;
        joint.colliderGroups.push(frontGroup);
      } else {
        if (!joint.colliderGroups.includes(backSideGroup)) {
          joint.colliderGroups.push(backSideGroup);
        }
      }
    });
  }

  /**
   * Immediately removes all seated bed/lap colliders and restores each skirt SpringBone joint's
   * exact original authored VRM settings AND original colliderGroups so the skirt hangs with its
   * natural A-line flare whenever standing or walking.
   */
  private restoreStandingSkirtPhysics(): void {
    this.removeSeatedSkirtColliders();
    this.skirtJointOriginalSettings.forEach((orig, joint) => {
      joint.settings.hitRadius = orig.hitRadius;
      joint.settings.stiffness = orig.stiffness;
      joint.settings.dragForce = orig.dragForce;
      joint.settings.gravityDir.copy(orig.gravityDir);
      joint.settings.gravityPower = orig.gravityPower;
      joint.colliderGroups.length = 0;
      for (let i = 0; i < orig.originalColliderGroups.length; i++) {
        joint.colliderGroups.push(orig.originalColliderGroups[i]);
      }
    });
  }

  private removeSeatedSkirtColliders(): void {
    if (this.vrm?.springBoneManager) {
      const groupsToRemove = [
        this.seatedBackSideColliderGroup,
        this.seatedFrontColliderGroup,
      ].filter((g): g is VRMSpringBoneColliderGroup => g !== null);

      if (groupsToRemove.length > 0) {
        this.vrm.springBoneManager.joints.forEach((joint) => {
          for (let i = 0; i < groupsToRemove.length; i++) {
            const idx = joint.colliderGroups.indexOf(groupsToRemove[i]);
            if (idx >= 0) {
              joint.colliderGroups.splice(idx, 1);
            }
          }
        });
      }
    }

    if (this.seatedBackSideColliderGroup) {
      this.seatedBackSideColliderGroup.colliders.length = 0;
    }
    if (this.seatedFrontColliderGroup) {
      this.seatedFrontColliderGroup.colliders.length = 0;
    }

    for (let i = 0; i < this.seatedColliders.length; i++) {
      this.root.remove(this.seatedColliders[i]);
    }
    this.seatedColliders = [];
    this.seatedBedPlaneCollider = null;
    this.seatedMattressEdgeCollider = null;
    this.seatedUpperLapCollider = null;
    this.seatedLapBridgeCollider = null;
    this.seatedUpperKneeCollider = null;
    this.seatedKneeBridgeCollider = null;
    this.seatedBackSideColliderGroup = null;
    this.seatedFrontColliderGroup = null;
  }

  public setAtmosphereMode(mode: AtmosphereMode): void {
    this.atmosphereMode = mode;
    this.applyAtmosphereMaterialCalibration();
  }

  /**
   * Calibrates heroine MToon & PBR materials against the active atmosphere rig.
   * MToon accumulates all scene lights (sun + hemi + ambient + 6 GPU PointLights) without PBR 1/PI
   * normalization, so daylight pushes pale skin past HDR 1.0 & UnrealBloomPass threshold (0.72),
   * causing overexposure and bloom/cel-edge flickering. Scaling albedo/shade/rim from saved
   * baselines keeps skin soft, warm, and rock-steady in every lighting mode.
   */
  private applyAtmosphereMaterialCalibration(): void {
    if (this.materialBaselines.length === 0) return;

    const isDay = this.atmosphereMode === 'daylight';
    const isSunset = this.atmosphereMode === 'sunset';
    const isMeta = this.atmosphereMode === 'meta';

    const colorScale = isDay ? 0.56 : isSunset ? 0.78 : isMeta ? 0.90 : 0.94;
    const shadeScale = isDay ? 0.62 : isSunset ? 0.80 : isMeta ? 0.88 : 0.92;
    const rimScale = isDay ? 0.28 : isSunset ? 0.55 : 0.75;
    const targetGi = isDay ? 0.58 : isSunset ? 0.44 : MTOON_GI_EQUALIZATION_TARGET;
    const maxToony = isDay ? 0.76 : isSunset ? 0.86 : 1.0;
    const maxEmissive = isDay ? 0.12 : isSunset ? 0.25 : 0.45;
    const pbrColorScale = isDay ? 0.64 : isSunset ? 0.82 : 0.95;
    const maxEnv = isDay ? 0.22 : 0.36;

    for (let i = 0; i < this.materialBaselines.length; i++) {
      const b = this.materialBaselines[i];
      if (b.isMToon) {
        const mtoon = b.material as MToonMaterial;
        if (b.origColor && mtoon.color) {
          mtoon.color.copy(b.origColor).multiplyScalar(colorScale);
        }
        if (b.origShadeColor && mtoon.shadeColorFactor) {
          mtoon.shadeColorFactor.copy(b.origShadeColor).multiplyScalar(shadeScale);
        }
        if (b.origRimColor && mtoon.parametricRimColorFactor) {
          mtoon.parametricRimColorFactor.copy(b.origRimColor).multiplyScalar(rimScale);
        }
        mtoon.giEqualizationFactor = isDay
          ? Math.max(Math.min(b.origGiEq, 0.72), targetGi)
          : Math.min(b.origGiEq, targetGi);
        if (typeof mtoon.shadingToonyFactor === 'number') {
          mtoon.shadingToonyFactor = Math.min(b.origToony, maxToony);
        }
        if (typeof mtoon.emissiveIntensity === 'number') {
          mtoon.emissiveIntensity = Math.min(b.origEmissiveIntensity, maxEmissive);
        }
      } else {
        const std = b.material as THREE.MeshStandardMaterial;
        if (b.origColor && std.color) {
          std.color.copy(b.origColor).multiplyScalar(pbrColorScale);
        }
        if (typeof std.envMapIntensity === 'number') {
          std.envMapIntensity = Math.min(b.origEnvMapIntensity, maxEnv);
        }
        if (typeof std.emissiveIntensity === 'number') {
          std.emissiveIntensity = Math.min(b.origEmissiveIntensity, maxEmissive);
        }
      }
      b.material.needsUpdate = true;
    }
  }

  private tuneMaterialsForRoomLighting(vrmScene: THREE.Object3D): void {
    this.materialBaselines = [];
    const seen = new Set<THREE.Material>();

    vrmScene.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Cast grounded shadows onto floors/bed, but disable receiveShadow on VRM MToon skin
      // to eliminate coarse static shadow-map acne & Vogel-disk cel-step flickering in daylight!
      mesh.castShadow = true;
      mesh.receiveShadow = false;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (let i = 0; i < materials.length; i++) {
        const mat = materials[i];
        if (!mat || seen.has(mat)) continue;
        seen.add(mat);

        mat.toneMapped = true;
        const mtoon = mat as MToonMaterial;
        const isMToon = Boolean(mtoon.isMToonMaterial || mat instanceof MToonMaterial);
        const std = mat as THREE.MeshStandardMaterial;

        this.materialBaselines.push({
          material: mat,
          isMToon,
          origColor:
            'color' in mat && (mat as { color?: THREE.Color }).color?.isColor
              ? (mat as { color: THREE.Color }).color.clone()
              : null,
          origShadeColor:
            isMToon && mtoon.shadeColorFactor?.isColor
              ? mtoon.shadeColorFactor.clone()
              : null,
          origRimColor:
            isMToon && mtoon.parametricRimColorFactor?.isColor
              ? mtoon.parametricRimColorFactor.clone()
              : null,
          origGiEq:
            isMToon && typeof mtoon.giEqualizationFactor === 'number'
              ? mtoon.giEqualizationFactor
              : 0.9,
          origToony:
            isMToon && typeof mtoon.shadingToonyFactor === 'number'
              ? mtoon.shadingToonyFactor
              : 0.9,
          origEmissiveIntensity:
            typeof std.emissiveIntensity === 'number' ? std.emissiveIntensity : 1.0,
          origEnvMapIntensity:
            typeof std.envMapIntensity === 'number' ? std.envMapIntensity : 1.0,
        });
      }
    });

    this.applyAtmosphereMaterialCalibration();
  }

  public async loadHeroineFromBlob(blob: Blob): Promise<void> {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const gltf = await this.gltfLoader.loadAsync(objectUrl);
      if (this.disposed) return;

      const loadedVrm = gltf.userData.vrm as VRM | undefined;
      if (!loadedVrm) {
        throw new Error('该文件不是有效的女主 VRM 模型');
      }

      this.disposeCurrentVrm();

      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      VRMUtils.rotateVRM0(loadedVrm);
      this.tuneMaterialsForRoomLighting(loadedVrm.scene);

      // Reset to canonical rest pose before height calibration, grounding & measuring hips height
      loadedVrm.humanoid.resetNormalizedPose();
      loadedVrm.humanoid.update();

      // First ground feet to local Y = 0 at unscaled 1.0 to measure true eye/head/body height
      loadedVrm.scene.scale.setScalar(1);
      loadedVrm.scene.position.set(0, 0, 0);
      loadedVrm.scene.updateMatrixWorld(true);
      _tmpBox.setFromObject(loadedVrm.scene);
      if (!_tmpBox.isEmpty() && Number.isFinite(_tmpBox.min.y)) {
        const yOffset = -_tmpBox.min.y;
        if (Math.abs(yOffset) < 0.8) {
          loadedVrm.scene.position.y = yOffset;
        }
      }
      loadedVrm.scene.updateMatrixWorld(true);

      // Calibrate standing height to a natural ~1.60m (eye height ~1.48m vs 1.62m player camera)
      // Measuring eye bone height avoids distortion from ahoge loops, hats, or tall hair ornaments.
      let heightScale = 1.0;
      const rawLeftEye = loadedVrm.humanoid.getRawBoneNode('leftEye');
      const rawRightEye = loadedVrm.humanoid.getRawBoneNode('rightEye');
      const rawHead = loadedVrm.humanoid.getRawBoneNode('head');
      if (rawLeftEye && rawRightEye) {
        rawLeftEye.getWorldPosition(_eyeLeftLocal);
        rawRightEye.getWorldPosition(_eyeRightLocal);
        const measuredEyeH = (_eyeLeftLocal.y + _eyeRightLocal.y) * 0.5;
        if (measuredEyeH > 0.85 && measuredEyeH < 2.2) {
          heightScale = HEROINE_TARGET_EYE_HEIGHT_M / measuredEyeH;
        }
      } else if (rawHead) {
        rawHead.getWorldPosition(_headWorldPos);
        if (_headWorldPos.y > 0.8 && _headWorldPos.y < 2.1) {
          heightScale = HEROINE_TARGET_HEAD_BONE_HEIGHT_M / _headWorldPos.y;
        }
      } else if (!_tmpBox.isEmpty()) {
        const measuredTotalH = _tmpBox.max.y - _tmpBox.min.y;
        if (measuredTotalH > 0.9 && measuredTotalH < 2.4) {
          heightScale = HEROINE_TARGET_TOTAL_HEIGHT_M / measuredTotalH;
        }
      }
      heightScale = THREE.MathUtils.clamp(heightScale, 0.85, 1.32);

      loadedVrm.scene.scale.setScalar(heightScale);
      loadedVrm.scene.position.set(0, 0, 0);
      loadedVrm.scene.updateMatrixWorld(true);
      _tmpBox.setFromObject(loadedVrm.scene);
      if (!_tmpBox.isEmpty() && Number.isFinite(_tmpBox.min.y)) {
        const yOffset = -_tmpBox.min.y;
        if (Math.abs(yOffset) < 1.0) {
          loadedVrm.scene.position.y = yOffset;
        }
      }
      loadedVrm.scene.updateMatrixWorld(true);
      loadedVrm.springBoneManager?.setInitState();

      const hipsNode = loadedVrm.humanoid.getNormalizedBoneNode('hips');
      loadedVrm.scene.getWorldPosition(_rootWorldPos);
      if (hipsNode) {
        hipsNode.getWorldPosition(_hipsWorldPos);
        const dy = Math.abs(_hipsWorldPos.y - _rootWorldPos.y);
        if (dy > 0.25 && dy < 1.5) {
          this.vrmStandingHipsHeight = dy;
        }
      }

      const lFootRest = loadedVrm.humanoid.getNormalizedBoneNode('leftFoot');
      const rFootRest = loadedVrm.humanoid.getNormalizedBoneNode('rightFoot');
      if (lFootRest && rFootRest) {
        lFootRest.getWorldPosition(_leftLegWorldPos);
        rFootRest.getWorldPosition(_rightLegWorldPos);
        const avgFootH = ((_leftLegWorldPos.y + _rightLegWorldPos.y) * 0.5) - _rootWorldPos.y;
        if (Number.isFinite(avgFootH) && avgFootH >= 0.01 && avgFootH < 0.35) {
          this.vrmStandingFootHeight = avgFootH;
        }
      }

      const lToesRest = loadedVrm.humanoid.getNormalizedBoneNode('leftToes');
      const rToesRest = loadedVrm.humanoid.getNormalizedBoneNode('rightToes');
      if (lToesRest && rToesRest) {
        lToesRest.getWorldPosition(_leftLegWorldPos);
        rToesRest.getWorldPosition(_rightLegWorldPos);
        const avgToesH = ((_leftLegWorldPos.y + _rightLegWorldPos.y) * 0.5) - _rootWorldPos.y;
        if (Number.isFinite(avgToesH) && avgToesH >= 0.002 && avgToesH < 0.25) {
          this.vrmStandingToesHeight = avgToesH;
          this.hasStandingToesBone = true;
        } else {
          this.hasStandingToesBone = false;
        }
      } else {
        this.hasStandingToesBone = false;
      }

      // Wire native VRM LookAt eye tracker to world-space lookAtTarget
      if (loadedVrm.lookAt) {
        loadedVrm.lookAt.target = this.lookAtTarget;
        loadedVrm.lookAt.autoUpdate = true;
      }

      this.vrm = loadedVrm;
      this.root.add(loadedVrm.scene);
      this.mixer = new THREE.AnimationMixer(loadedVrm.scene);
      this.actions = {};
      this.currentHeadYaw = 0;
      this.currentHeadPitch = 0;
      this.lookAtInitialized = false;

      this.rebindAllClips();
      this.discoverLipSyncTargets(loadedVrm);
      this.decoupleSmileExpressionBinds(loadedVrm);
      this.attachCheekBlushPlanes(loadedVrm);
      this.configureSeatedSkirtPhysics(loadedVrm, 'bed');
      this.postureState = 'seated';
      this.applyBedEdgeTransform();
      this.root.visible = this.spawned;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Auto-discovers VRM 1.0, VRM 0.x, and custom/VRChat viseme expression names plus direct
   * SkinnedMesh mouth morphTarget fallbacks so lip-sync is always unmistakably visible.
   */
  private discoverLipSyncTargets(vrm: VRM): void {
    const map: Record<'aa' | 'ih' | 'ou' | 'ee' | 'oh', string[]> = {
      aa: [],
      ih: [],
      ou: [],
      ee: [],
      oh: [],
    };
    const candidates: Record<'aa' | 'ih' | 'ou' | 'ee' | 'oh', string[]> = {
      aa: ['aa', 'a', 'A', 'Aa', 'vrc.v_aa', 'VRC.v_aa', 'Fcl_MTH_A', 'mouth_a', 'MTH_A'],
      ih: ['ih', 'i', 'I', 'Ih', 'vrc.v_ih', 'VRC.v_ih', 'Fcl_MTH_I', 'mouth_i', 'MTH_I'],
      ou: ['ou', 'u', 'U', 'Ou', 'vrc.v_ou', 'VRC.v_ou', 'Fcl_MTH_U', 'mouth_u', 'MTH_U'],
      ee: ['ee', 'e', 'E', 'Ee', 'vrc.v_e', 'VRC.v_e', 'Fcl_MTH_E', 'mouth_e', 'MTH_E'],
      oh: ['oh', 'o', 'O', 'Oh', 'vrc.v_oh', 'VRC.v_oh', 'Fcl_MTH_O', 'mouth_o', 'MTH_O'],
    };

    const expr = vrm.expressionManager;
    if (expr) {
      (['aa', 'ih', 'ou', 'ee', 'oh'] as const).forEach((vowel) => {
        for (const name of candidates[vowel]) {
          if (expr.getExpression(name)) {
            map[vowel].push(name);
            break;
          }
        }
      });
    }
    this.lipSyncExprNames = map;

    // Fallback: inspect face SkinnedMesh morphTargetDictionary in case a VRM omitted expression bindings
    this.lipSyncMorphFallback = [];
    const hasAnyExpr = Object.values(map).some((list) => list.length > 0);
    if (!hasAnyExpr) {
      const mouthRegex = /(^|[_.\s-])(aa|a|oh|o|mouth[_-]?a|mth[_-]?a|jaw[_-]?open|v_aa)$/i;
      vrm.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        for (const [key, idx] of Object.entries(mesh.morphTargetDictionary)) {
          if (mouthRegex.test(key)) {
            this.lipSyncMorphFallback.push({ mesh, index: idx });
            break;
          }
        }
      });
    }
  }

  /**
   * Decouples eye-smile morphs from mouth-opening morphs inside the VRM's native `happy`/`joy`
   * expression preset so smiling curves her eyes cleanly while keeping her mouth completely closed.
   * Also records open-mouth morph targets to enforce zero jaw/mouth opening during smiles.
   */
  private decoupleSmileExpressionBinds(vrm: VRM): void {
    this.smileBlockedMouthMorphs = [];

    const eyeOrBrowOrAllRegex =
      /(?:^|[._-])(?:fcl_)?(?:all|eye|brw|brow|blink|wink|eyelash|eyeline|iris|highlight)|目|眉|まばたき|ウィンク/i;
    const safeMouthExcludeRegex =
      /(?:^|[._-])(?:fcl_)?(?:mth_(?:up|close|neutral)|mouth[_-]?(?:close|neutral)|ha_hide)$/i;

    const mouthMorphRegex =
      /(?:^|[._-])(?:fcl_)?(?:mth_|mouth|lip|jaw|teeth|tongue|kuchi|ha_|vrc\.v_)|^(?:aa|ih|ou|ee|oh|a|i|u|e|o|口|くち|あ|い|う|え|お)$/i;
    const combinedAllSmileRegex = /(?:^|[._-])(?:fcl_)?all[_-]?(?:joy|happy|smile|fun)$/i;

    const normalizeMorphKey = (key: string) => key.replace(/^.*\./, '').toLowerCase();

    const pickSingleSmileEyeIndices = (dict: Record<string, number>): number[] => {
      const entries = Object.entries(dict).map(([k, idx]) => [normalizeMorphKey(k), idx] as const);
      const exactOrder = [
        /(?:^|[._-])(?:fcl_)?eye[_-]?joy$/,
        /(?:^|[._-])(?:fcl_)?eye[_-]?happy$/,
        /(?:^|[._-])(?:fcl_)?eye[_-]?smile$/,
        /(?:^|[._-])(?:fcl_)?eye[_-]?fun$/,
        /(?:^|[._-])(?:fcl_)?eye[_-]?close$/,
      ];
      for (const rx of exactOrder) {
        const hit = entries.find(([nk]) => rx.test(nk));
        if (hit) return [hit[1]];
      }
      // Fallback only if no unified bilateral eye morph exists: one L + one R pair
      const pairOrder: Array<[RegExp, RegExp]> = [
        [/(?:^|[._-])(?:fcl_)?eye[_-]?joy[_-]?l$/, /(?:^|[._-])(?:fcl_)?eye[_-]?joy[_-]?r$/],
        [/(?:^|[._-])(?:fcl_)?eye[_-]?happy[_-]?l$/, /(?:^|[._-])(?:fcl_)?eye[_-]?happy[_-]?r$/],
        [/(?:^|[._-])(?:fcl_)?eye[_-]?close[_-]?l$/, /(?:^|[._-])(?:fcl_)?eye[_-]?close[_-]?r$/],
      ];
      for (const [rxL, rxR] of pairOrder) {
        const hitL = entries.find(([nk]) => rxL.test(nk));
        const hitR = entries.find(([nk]) => rxR.test(nk));
        if (hitL && hitR) return [hitL[1], hitR[1]];
      }
      return [];
    };

    const pickSingleSmileBrowIndex = (dict: Record<string, number>): number | null => {
      const entries = Object.entries(dict).map(([k, idx]) => [normalizeMorphKey(k), idx] as const);
      const exactOrder = [
        /(?:^|[._-])(?:fcl_)?(?:brw|brow)[_-]?joy$/,
        /(?:^|[._-])(?:fcl_)?(?:brw|brow)[_-]?happy$/,
        /(?:^|[._-])(?:fcl_)?(?:brw|brow)[_-]?smile$/,
        /(?:^|[._-])(?:fcl_)?(?:brw|brow)[_-]?fun$/,
      ];
      for (const rx of exactOrder) {
        const hit = entries.find(([nk]) => rx.test(nk));
        if (hit) return hit[1];
      }
      return null;
    };

    vrm.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      for (const [key, idx] of Object.entries(mesh.morphTargetDictionary)) {
        if (
          !eyeOrBrowOrAllRegex.test(key) &&
          !safeMouthExcludeRegex.test(key) &&
          mouthMorphRegex.test(key)
        ) {
          this.smileBlockedMouthMorphs.push({ mesh, index: idx });
        }
      }
    });

    const exprMgr = vrm.expressionManager;
    if (!exprMgr) return;

    for (const presetName of ['happy', 'joy']) {
      const expr = exprMgr.getExpression(presetName);
      if (!expr) continue;

      // Prevent @pixiv/three-vrm from layering any mouth or blink weights on top of native smile
      expr.overrideMouth = 'block';
      expr.overrideBlink = 'block';

      const bindsCopy = [...expr.binds];
      const hasBoundMorphIndex = (prim: THREE.Mesh, idx: number): boolean =>
        expr.binds.some(
          (b) =>
            'primitives' in b &&
            'index' in b &&
            (b as VRMExpressionMorphTargetBind).index === idx &&
            (b as VRMExpressionMorphTargetBind).primitives.includes(prim)
        );

      for (const bind of bindsCopy) {
        if (
          !(
            bind &&
            'primitives' in bind &&
            Array.isArray((bind as VRMExpressionMorphTargetBind).primitives) &&
            typeof (bind as VRMExpressionMorphTargetBind).index === 'number'
          )
        ) {
          continue;
        }
        const morphBind = bind as VRMExpressionMorphTargetBind;
        const bindNames: string[] = [];
        for (const prim of morphBind.primitives) {
          const dict = prim.morphTargetDictionary;
          if (!dict) continue;
          for (const [key, idx] of Object.entries(dict)) {
            if (idx === morphBind.index) {
              bindNames.push(key);
            }
          }
        }

        const isCombinedAll = bindNames.some((n) => combinedAllSmileRegex.test(n));
        if (isCombinedAll) {
          // Collect single prioritized eye + brow replacement binds BEFORE deleting Fcl_ALL_*
          const plannedReplacements: Array<{ prim: THREE.Mesh; index: number }> = [];
          let foundEyeReplacement = false;

          for (const prim of morphBind.primitives) {
            const dict = prim.morphTargetDictionary;
            if (!dict) continue;

            const eyeIndices = pickSingleSmileEyeIndices(dict);
            if (eyeIndices.length > 0) {
              foundEyeReplacement = true;
              for (const idx of eyeIndices) {
                plannedReplacements.push({ prim, index: idx });
              }
            }

            const browIdx = pickSingleSmileBrowIndex(dict);
            if (browIdx !== null) {
              plannedReplacements.push({ prim, index: browIdx });
            }
          }

          if (foundEyeReplacement) {
            expr.deleteBind(morphBind);
            for (const rep of plannedReplacements) {
              if (!hasBoundMorphIndex(rep.prim, rep.index)) {
                expr.addBind(
                  new VRMExpressionMorphTargetBind({
                    primitives: [rep.prim],
                    index: rep.index,
                    weight: morphBind.weight,
                  })
                );
              }
            }
          }
          continue;
        }

        const isMouthBind = bindNames.some(
          (n) =>
            !eyeOrBrowOrAllRegex.test(n) &&
            !safeMouthExcludeRegex.test(n) &&
            mouthMorphRegex.test(n)
        );
        if (isMouthBind) {
          expr.deleteBind(morphBind);
        }
      }
    }
  }

  /**
   * Mounts two feather-soft translucent pink cheek blush decals directly onto the VRM raw `head`
   * bone, auto-calibrated to the model's actual left/right eye bone geometry (works cleanly on
   * both VRM 0.x and VRM 1.0 even when the model lacks a built-in blush blendshape).
   */
  private attachCheekBlushPlanes(vrm: VRM): void {
    this.disposeCheekBlushPlanes();
    const rawHead = vrm.humanoid.getRawBoneNode('head');
    if (!rawHead) return;

    // Generate soft radial translucent blush canvas texture with delicate anime hatch glow
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 128, 96);
      const grad = ctx.createRadialGradient(64, 48, 4, 64, 48, 54);
      grad.addColorStop(0.0, 'rgba(255, 118, 154, 0.72)');
      grad.addColorStop(0.45, 'rgba(255, 134, 168, 0.42)');
      grad.addColorStop(0.78, 'rgba(255, 152, 184, 0.12)');
      grad.addColorStop(1.0, 'rgba(255, 160, 190, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 96);

      // Ultra-soft diagonal anime blush strokes inside center glow
      ctx.strokeStyle = 'rgba(255, 96, 140, 0.28)';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const bx = 64 + i * 11;
        ctx.beginPath();
        ctx.moveTo(bx - 4, 57);
        ctx.lineTo(bx + 4, 41);
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const isVrm0 = vrm.meta?.metaVersion === '0';
    const fwdSign = isVrm0 ? -1 : 1;

    // Calibrate cheek position from raw leftEye / rightEye bones relative to raw head bone
    const rawLeftEye = vrm.humanoid.getRawBoneNode('leftEye');
    const rawRightEye = vrm.humanoid.getRawBoneNode('rightEye');

    let leftX = isVrm0 ? -0.042 : 0.042;
    let rightX = isVrm0 ? 0.042 : -0.042;
    let cheekY = 0.056;
    let cheekZ = fwdSign * 0.094;
    let planeW = 0.044;
    let planeH = 0.028;

    if (rawLeftEye && rawRightEye) {
      rawHead.updateWorldMatrix(true, true);
      rawLeftEye.getWorldPosition(_eyeLeftLocal);
      rawRightEye.getWorldPosition(_eyeRightLocal);
      rawHead.worldToLocal(_eyeLeftLocal);
      rawHead.worldToLocal(_eyeRightLocal);

      const eyeDist = Math.abs(_eyeLeftLocal.x - _eyeRightLocal.x);
      if (eyeDist > 0.02 && eyeDist < 0.20) {
        const eyeMidY = (_eyeLeftLocal.y + _eyeRightLocal.y) * 0.5;
        const eyeMidZ = (_eyeLeftLocal.z + _eyeRightLocal.z) * 0.5;
        const eyeFwdSign = Math.abs(eyeMidZ) > 0.005 ? Math.sign(eyeMidZ) : fwdSign;

        leftX = _eyeLeftLocal.x * 1.06;
        rightX = _eyeRightLocal.x * 1.06;
        cheekY = eyeMidY - eyeDist * 0.36;
        cheekZ = eyeMidZ + eyeFwdSign * eyeDist * 0.44;
        planeW = eyeDist * 0.64;
        planeH = eyeDist * 0.40;
      }
    }

    const group = new THREE.Group();
    group.name = 'HeroineCheekBlushGroup';
    group.visible = false;

    const geo = new THREE.PlaneGeometry(planeW, planeH);
    const leftMesh = new THREE.Mesh(geo, mat);
    leftMesh.position.set(leftX, cheekY, cheekZ);
    leftMesh.rotation.y = (leftX >= 0 ? 1 : -1) * 0.30 * fwdSign;
    if (isVrm0) leftMesh.rotation.y += Math.PI;
    leftMesh.renderOrder = 3;

    const rightMesh = new THREE.Mesh(geo, mat);
    rightMesh.position.set(rightX, cheekY, cheekZ);
    rightMesh.rotation.y = (rightX >= 0 ? 1 : -1) * 0.30 * fwdSign;
    if (isVrm0) rightMesh.rotation.y += Math.PI;
    rightMesh.renderOrder = 3;

    group.add(leftMesh, rightMesh);
    rawHead.add(group);

    this.cheekBlushGroup = group;
    this.cheekBlushMat = mat;
    this.cheekBlushTex = tex;
  }

  private disposeCheekBlushPlanes(): void {
    if (this.cheekBlushGroup) {
      this.cheekBlushGroup.parent?.remove(this.cheekBlushGroup);
      this.cheekBlushGroup.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.isMesh && m.geometry) {
          m.geometry.dispose();
        }
      });
      this.cheekBlushGroup = null;
    }
    if (this.cheekBlushMat) {
      this.cheekBlushMat.dispose();
      this.cheekBlushMat = null;
    }
    if (this.cheekBlushTex) {
      this.cheekBlushTex.dispose();
      this.cheekBlushTex = null;
    }
  }

  /**
   * Kept for loader compatibility; bedroom sitting now permanently uses the procedural pose.
   */
  public async loadSitFbxFromBlob(_blob: Blob): Promise<void> {
    this.clearAction('sit');
    if (this.vrm) {
      this.applyBedEdgeTransform();
    }
  }

  /**
   * Reuses already-loaded protagonist idle.fbx / walk.fbx Mixamo assets for the heroine's
   * humanoid skeleton retargeting (ready for future standing/walking phases too).
   */
  public syncSharedFbx(slot: 'idle' | 'walk', fbxGroup: THREE.Group | null): void {
    if (fbxGroup) {
      this.sharedFbx[slot] = fbxGroup;
      if (this.vrm) {
        this.rebindSingleClip(slot, fbxGroup);
      }
    } else {
      delete this.sharedFbx[slot];
      this.clearAction(slot);
    }
  }

  public removeHeroineVrm(): void {
    this.disposeCurrentVrm();
  }

  public removeSitClip(): void {
    this.clearAction('sit');
    if (this.vrm) {
      this.vrm.humanoid.resetNormalizedPose();
      this.applyBedEdgeTransform();
    }
  }

  private clearAction(slot: HeroineAnimSlot): void {
    const prev = this.actions[slot];
    if (prev) {
      prev.stop();
      this.mixer?.uncacheAction(prev.getClip());
      delete this.actions[slot];
    }
  }

  private rebindAllClips(): void {
    if (!this.vrm || !this.mixer) return;
    this.mixer.stopAllAction();
    this.actions = {};

    if (this.sharedFbx.idle) {
      this.rebindSingleClip('idle', this.sharedFbx.idle);
    }
    if (this.sharedFbx.walk) {
      this.rebindSingleClip('walk', this.sharedFbx.walk);
    }
  }

  /**
   * Retargets Mixamo FBX clips (idle/walk) using the exact same `retargetMixamoFbxToVrmWithMeta`
   * pipeline as the protagonist, resetting normalized bones first for clean proportion measurement.
   */
  private rebindSingleClip(slot: HeroineAnimSlot, fbxGroup: THREE.Group): void {
    if (!this.vrm || !this.mixer) return;
    this.clearAction(slot);

    // Ensure canonical rest pose before Mixamo retargeting (matches protagonist retarget flow)
    this.vrm.humanoid.resetNormalizedPose();
    this.vrm.humanoid.update();
    this.vrm.scene.updateMatrixWorld(true);

    const result = retargetMixamoFbxToVrmWithMeta(
      fbxGroup,
      this.vrm,
      `heroine_${slot}`
    );
    if (!result) return;

    if (slot === 'walk' && result.nativeSpeed !== null && result.nativeSpeed > 0.3 && result.nativeSpeed < 5.0) {
      this.walkClipNativeSpeed = result.nativeSpeed;
    }

    const action = this.mixer.clipAction(result.clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.enabled = true;
    action.setEffectiveTimeScale(1.0);
    action.setEffectiveWeight(0.0);
    action.play();
    this.actions[slot] = action;
  }

  /**
   * Drives retargeted Mixamo `idle.fbx` & `walk.fbx` with continuous normalized cross-fading
   * (`wIdle + wWalk === 1.0`, zero T-pose dips) plus a smoothly blended outward arm abduction
   * post-pass so arms clear her flared maid skirt during both standing idle and walking.
   */
  private applyMixamoLocomotion(
    vrm: VRM,
    dt: number,
    isMoving: boolean,
    moveSpeed: number
  ): boolean {
    const hasIdle = Boolean(this.actions.idle);
    const hasWalk = Boolean(this.actions.walk);
    if (!this.mixer || (!hasIdle && !hasWalk)) {
      return false;
    }
    if (isMoving && !hasWalk) {
      return false;
    }
    if (!isMoving && !hasIdle) {
      return false;
    }

    const enteringMixamo = this.activePoseDriver !== 'mixamo';
    const startingFreshWalk =
      isMoving && hasWalk && (enteringMixamo || this.actionWeights.walk < 0.04);
    if (startingFreshWalk && this.actions.walk) {
      this.actions.walk.time = 0;
    }

    if (enteringMixamo) {
      this.beginPoseDriverTransition('mixamo', isMoving ? 0.42 : 0.46);
      // Start Mixamo immediately at full normalized weight (1.0) so our bone-level SLERP
      // blends cleanly from the previous pose with zero T-pose intermediate frames.
      if (hasIdle && hasWalk) {
        this.actionWeights.walk = isMoving ? 1.0 : 0.0;
        this.actionWeights.idle = 1.0 - this.actionWeights.walk;
      } else if (hasWalk) {
        this.actionWeights.walk = 1.0;
        this.actionWeights.idle = 0.0;
      } else {
        this.actionWeights.idle = 1.0;
        this.actionWeights.walk = 0.0;
      }
    } else if (hasIdle && hasWalk) {
      const targetWalk = isMoving ? 1.0 : 0.0;
      let nextWalk = THREE.MathUtils.damp(this.actionWeights.walk, targetWalk, 6.8, dt);
      if (nextWalk < 0.002) nextWalk = 0;
      else if (nextWalk > 0.998) nextWalk = 1;
      this.actionWeights.walk = nextWalk;
      this.actionWeights.idle = 1.0 - nextWalk;
    } else if (hasWalk) {
      this.actionWeights.walk = 1.0;
      this.actionWeights.idle = 0.0;
    } else {
      this.actionWeights.idle = 1.0;
      this.actionWeights.walk = 0.0;
    }

    if (this.actions.idle) {
      this.actions.idle.setEffectiveWeight(this.actionWeights.idle);
      this.actions.idle.setEffectiveTimeScale(1.0);
    }
    if (this.actions.walk) {
      this.actions.walk.setEffectiveWeight(this.actionWeights.walk);
      const speedScale = THREE.MathUtils.clamp(
        Math.max(moveSpeed, 0.20) / Math.max(0.4, this.walkClipNativeSpeed),
        0.24,
        1.55
      );
      this.actions.walk.setEffectiveTimeScale(speedScale);
    }

    vrm.humanoid.resetNormalizedPose();
    this.mixer.update(dt);

    // Smoothly blend context-aware upper-body walk pose (e.g., arms crossed during indoor strolls)
    // while keeping full walk.fbx lower-body locomotion and natural pelvis bounce!
    const targetArmsCrossed =
      isMoving && this.walkUpperBodyStyle === 'arms_crossed' ? 1.0 : 0.0;
    this.armsCrossedWalkBlend = THREE.MathUtils.damp(
      this.armsCrossedWalkBlend,
      targetArmsCrossed,
      7.5,
      dt
    );
    if (this.armsCrossedWalkBlend < 0.004) this.armsCrossedWalkBlend = 0;

    // 1. Outward skirt-clearance arm abduction (attenuated automatically when arms are crossed)
    const wIdle = hasIdle ? this.actionWeights.idle : 0;
    const wWalk = hasWalk ? this.actionWeights.walk : 0;
    const abductScale = 1.0 - this.armsCrossedWalkBlend;
    const totalW = (wIdle + wWalk) * abductScale;
    if (totalW > 0.01) {
      const s = this.getVrmAxisSign(vrm);
      const upperAbduct = (0.24 * wIdle + 0.30 * wWalk) * abductScale;
      const lowerAbduct = (0.05 * wIdle + 0.06 * wWalk) * abductScale;

      const leftUpper = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
      if (leftUpper) {
        _walkAbductQuat.setFromAxisAngle(_zAxis, upperAbduct * s);
        leftUpper.quaternion.premultiply(_walkAbductQuat);
      }
      const rightUpper = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
      if (rightUpper) {
        _walkAbductQuat.setFromAxisAngle(_zAxis, -upperAbduct * s);
        rightUpper.quaternion.premultiply(_walkAbductQuat);
      }
      const leftLower = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
      if (leftLower) {
        _walkAbductQuat.setFromAxisAngle(_zAxis, lowerAbduct * s);
        leftLower.quaternion.premultiply(_walkAbductQuat);
      }
      const rightLower = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
      if (rightLower) {
        _walkAbductQuat.setFromAxisAngle(_zAxis, -lowerAbduct * s);
        rightLower.quaternion.premultiply(_walkAbductQuat);
      }
    }

    // 2. Layer crossed-arms upper-body pose cleanly onto walk.fbx during indoor casual strolls
    if (this.armsCrossedWalkBlend > 0.01) {
      this.layerUpperBodyPose(vrm, HEROINE_POSES.arms_crossed, this.armsCrossedWalkBlend);
    }

    return true;
  }

  /**
   * Smoothly layers an upper-body arm/shoulder/hand pose (such as `arms_crossed`, `wave`,
   * `reach_hand`, `peace`, or `finger_cheek`) over a live Mixamo `idle.fbx` or `walk.fbx`
   * animation using quaternion SLERP so her full-body stance, weight shift, and breathing
   * stay 100% organic (zero frozen puppet stiffness!).
   */
  private layerUpperBodyPose(
    vrm: VRM,
    pose: HeroinePoseDefinition,
    blend: number,
    maskOverride?: 'none' | 'right' | 'both',
    waveOsc = 0
  ): void {
    const t = THREE.MathUtils.clamp(blend, 0, 1);
    if (t <= 0.004) return;
    const mask = maskOverride ?? pose.armMask ?? 'both';
    if (mask === 'none') return;

    const s = this.getVrmAxisSign(vrm);
    const uaOrder = pose.upperArmOrder ?? 'ZYX';

    const slerpBone = (
      boneName: VRMHumanBoneName,
      rot: [number, number, number],
      order: THREE.EulerOrder,
      addY = 0
    ) => {
      const node = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) return;
      _layerEuler.set(rot[0] * s, rot[1] + addY, rot[2] * s, order);
      _layerQuat.setFromEuler(_layerEuler);
      node.quaternion.slerp(_layerQuat, t);
    };

    if (mask === 'both') {
      slerpBone('leftShoulder', pose.leftShoulder, 'YXZ');
      slerpBone('leftUpperArm', pose.leftUpperArm, uaOrder);
      slerpBone('leftLowerArm', pose.leftLowerArm, 'YXZ');
      slerpBone('leftHand', pose.leftHand, 'XYZ');
      if (t > 0.45) {
        this.applyHandFingerPreset(vrm, 'left', pose.leftFingerMode ?? 'relaxed');
      }
    }

    if (mask === 'right' || mask === 'both') {
      const wm = pose.waveMotion;
      const forearmWave = wm ? waveOsc * wm.forearmY : 0;
      const wristWave = wm ? waveOsc * wm.wristY : 0;
      slerpBone('rightShoulder', pose.rightShoulder, 'YXZ');
      slerpBone('rightUpperArm', pose.rightUpperArm, uaOrder);
      slerpBone('rightLowerArm', pose.rightLowerArm, 'YXZ', forearmWave);
      slerpBone('rightHand', pose.rightHand, 'XYZ', wristWave);
      if (t > 0.45) {
        this.applyHandFingerPreset(vrm, 'right', pose.rightFingerMode ?? 'relaxed');
      }
    }
  }

  /**
   * Drives a natural, living dialogue performance directly ON TOP OF `idle.fbx`:
   * - Full body (legs, hips, pelvis weight shift, natural breathing) stays 100% live `idle.fbx`.
   * - Single-arm gestures (`wave`, `finger_cheek`, `peace`, `reach_hand`) ONLY layer the right arm,
   *   leaving her left arm & body relaxed in `idle.fbx`.
   * - Expressive gestures with `holdSec` smoothly fade IN, hold naturally with subtle drift,
   *   and then softly relax back into `idle.fbx` so she never freezes like a mannequin!
   */
  private applyLayeredDialogueOnIdle(vrm: VRM, dt: number, elapsed: number): void {
    const gesture = this.activePerformance.gesture;
    const pose = HEROINE_POSES[gesture] ?? HEROINE_POSES.idle;
    const mask = pose.armMask ?? (gesture === 'idle' ? 'none' : 'both');

    // Compute natural fade-in / hold / relax-out envelope
    let targetBlend = 0;
    if (gesture !== 'idle' && mask !== 'none') {
      if (typeof pose.holdSec === 'number' && pose.holdSec > 0) {
        if (this.gestureElapsed < pose.holdSec) {
          targetBlend = 1.0;
        } else {
          const fadeSec = pose.waveMotion?.fadeSec ?? 0.95;
          const rem = THREE.MathUtils.clamp(
            1 - (this.gestureElapsed - pose.holdSec) / fadeSec,
            0,
            1
          );
          targetBlend = rem * rem * (3 - 2 * rem);
        }
      } else {
        targetBlend = 1.0;
      }
    }

    this.standingGestureBlend = THREE.MathUtils.damp(
      this.standingGestureBlend,
      targetBlend,
      targetBlend > this.standingGestureBlend ? 4.8 : 3.4,
      dt
    );
    if (this.standingGestureBlend < 0.004) this.standingGestureBlend = 0;

    // Gentle conversational forward lean on spine/chest (additive onto idle.fbx!)
    const targetLean = THREE.MathUtils.clamp(
      this.activePerformance.leanForward ?? pose.spineLean ?? 0,
      0,
      0.6
    );
    this.currentLeanForward = THREE.MathUtils.damp(
      this.currentLeanForward,
      targetLean * (0.45 + 0.55 * this.standingGestureBlend),
      4.5,
      dt
    );
    if (this.currentLeanForward > 0.005) {
      const s = this.getVrmAxisSign(vrm);
      const leanPitch = this.currentLeanForward * 0.14;
      const spine = vrm.humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        _footEuler.set(leanPitch * 0.55 * s, 0, 0, 'YXZ');
        _footQuat.setFromEuler(_footEuler);
        spine.quaternion.multiply(_footQuat);
      }
      const chest = vrm.humanoid.getNormalizedBoneNode('chest');
      if (chest) {
        _footEuler.set(leanPitch * 0.45 * s, 0, 0, 'YXZ');
        _footQuat.setFromEuler(_footEuler);
        chest.quaternion.multiply(_footQuat);
      }
    }

    if (this.standingGestureBlend > 0.005) {
      const waveOsc = pose.waveMotion
        ? Math.sin(this.gestureElapsed * pose.waveMotion.speed) * this.standingGestureBlend
        : Math.sin(elapsed * 1.45) * 0.025 * this.standingGestureBlend;
      this.layerUpperBodyPose(vrm, pose, this.standingGestureBlend, mask, waveOsc);
    }
  }

  /**
   * Layers natural alternating toe-pivot & knee-lift footwork whenever the heroine turns her
   * body in place, preventing rigid figurine-like static rotation.
   */
  private applyTurnInPlaceFootwork(vrm: VRM, dt: number, yawRate: number): void {
    const isStandingStill =
      !this.poseTuner &&
      (this.postureState === 'standing_talking' ||
        (this.postureState === 'following_player' && !this.isFollowMoving));

    const speed = Math.abs(yawRate);
    if (isStandingStill && speed > 0.16) {
      this.turnDirectionSign = yawRate >= 0 ? 1 : -1;
      this.turnFootworkBlend = THREE.MathUtils.damp(this.turnFootworkBlend, 1.0, 9.5, dt);
      this.turnStepPhase += dt * (5.4 + Math.min(3.2, speed) * 1.15);
    } else {
      this.turnFootworkBlend = THREE.MathUtils.damp(this.turnFootworkBlend, 0.0, 8.0, dt);
      if (this.turnFootworkBlend < 0.005) this.turnFootworkBlend = 0;
    }

    const b = this.turnFootworkBlend;
    if (b <= 0.005) return;

    const s = this.getVrmAxisSign(vrm);
    const dir = this.turnDirectionSign;
    const sinP = Math.sin(this.turnStepPhase);
    const leftLift = Math.max(0, sinP) * b;
    const rightLift = Math.max(0, -sinP) * b;

    const mulBone = (
      boneName: VRMHumanBoneName,
      rx: number,
      ry: number,
      rz: number
    ) => {
      const node = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) return;
      _footEuler.set(rx * s, ry, rz * s, 'YXZ');
      _footQuat.setFromEuler(_footEuler);
      node.quaternion.multiply(_footQuat);
    };

    // Subtle pelvic weight transfer left <-> right
    mulBone('hips', 0.015 * b, 0, sinP * 0.028 * b);

    // Alternating pivot step: lift thigh slightly, flex knee, and point/pivot toe toward turn direction
    mulBone('leftUpperLeg', -0.13 * leftLift, dir * 0.14 * leftLift, -0.02 * leftLift);
    mulBone('leftLowerLeg', 0.26 * leftLift, 0, 0);
    mulBone('leftFoot', -0.14 * leftLift, dir * 0.16 * leftLift, 0);

    mulBone('rightUpperLeg', -0.13 * rightLift, dir * 0.14 * rightLift, 0.02 * rightLift);
    mulBone('rightLowerLeg', 0.26 * rightLift, 0, 0);
    mulBone('rightFoot', -0.14 * rightLift, dir * 0.16 * rightLift, 0);
  }

  /**
   * Applies comfortable swivel-chair seated pose (legs bent neatly with feet near floor +
   * optional upper-body dialogue gestures like `heart` or `talk_gentle` while seated!).
   */
  private applyChairSeatedPose(
    vrm: VRM,
    dt: number,
    elapsed: number,
    sitBlend = 1,
    transitionLeanPitch = 0
  ): void {
    this.applyProceduralSeatedPose(vrm, elapsed, sitBlend, undefined, transitionLeanPitch);

    // When waiting idly in the bedroom swivel chair (player left room or idle >10s), play cute
    // time-passing fidgets (chin rest, gentle leg swings, chair swiveling) without breaking skirt physics!
    const boredomChairActive =
      sitBlend > 0.88 &&
      this.postureState === 'seated_chair' &&
      this.bedroomIdleChairWaitActive &&
      this.toyGunPhase === 'none';

    const targetChinBlend =
      boredomChairActive && this.chairBoredomState === 'chin_rest' ? 0.78 : 0;
    this.chairBoredomChinBlend = THREE.MathUtils.damp(
      this.chairBoredomChinBlend,
      targetChinBlend,
      4.2,
      dt
    );
    if (this.chairBoredomChinBlend < 0.005) this.chairBoredomChinBlend = 0;

    if (boredomChairActive && (this.chairBoredomState === 'kick_feet' || this.chairBoredomState === 'swivel_play')) {
      const kickAmp = this.chairBoredomState === 'kick_feet' ? 0.16 : 0.075;
      const kickWave = Math.sin(elapsed * 3.15);
      const sSign = this.getVrmAxisSign(vrm);
      const lKnee = vrm.humanoid.getNormalizedBoneNode('leftLowerLeg');
      const rKnee = vrm.humanoid.getNormalizedBoneNode('rightLowerLeg');
      const lFoot = vrm.humanoid.getNormalizedBoneNode('leftFoot');
      const rFoot = vrm.humanoid.getNormalizedBoneNode('rightFoot');
      if (lKnee) {
        _footEuler.set(kickWave * kickAmp * sSign, 0, 0, 'YXZ');
        _footQuat.setFromEuler(_footEuler);
        lKnee.quaternion.multiply(_footQuat);
      }
      if (rKnee) {
        _footEuler.set(-kickWave * kickAmp * sSign, 0, 0, 'YXZ');
        _footQuat.setFromEuler(_footEuler);
        rKnee.quaternion.multiply(_footQuat);
      }
      if (lFoot) {
        _footEuler.set(-kickWave * kickAmp * 0.55 * sSign, 0, 0, 'YXZ');
        _footQuat.setFromEuler(_footEuler);
        lFoot.quaternion.multiply(_footQuat);
      }
      if (rFoot) {
        _footEuler.set(kickWave * kickAmp * 0.55 * sSign, 0, 0, 'YXZ');
        _footQuat.setFromEuler(_footEuler);
        rFoot.quaternion.multiply(_footQuat);
      }
    }

    if (this.chairBoredomChinBlend > 0.005) {
      this.layerUpperBodyPose(
        vrm,
        HEROINE_POSES.finger_cheek,
        this.chairBoredomChinBlend,
        'right',
        Math.sin(elapsed * 1.1) * 0.018
      );
    }

    // When comfortably seated in dialogue & a specific hand gesture is active (e.g., heart/wink),
    // smoothly fade it in, hold, and relax back onto her lap so her arms never stay frozen up!
    if (
      !boredomChairActive &&
      sitBlend > 0.85 &&
      this.activePerformance.gesture !== 'idle' &&
      this.activePerformance.gesture !== 'wave'
    ) {
      const gesturePose = HEROINE_POSES[this.activePerformance.gesture];
      if (gesturePose) {
        const holdSec = gesturePose.holdSec ?? 3.2;
        const fadeOut =
          this.gestureElapsed < holdSec
            ? 1.0
            : THREE.MathUtils.clamp(1 - (this.gestureElapsed - holdSec) / 0.9, 0, 1);
        const targetBlend = fadeOut * fadeOut * (3 - 2 * fadeOut);
        this.standingGestureBlend = THREE.MathUtils.damp(
          this.standingGestureBlend,
          targetBlend,
          targetBlend > this.standingGestureBlend ? 6.0 : 4.2,
          dt
        );
        if (this.standingGestureBlend > 0.005) {
          this.layerUpperBodyPose(
            vrm,
            gesturePose,
            this.standingGestureBlend,
            gesturePose.armMask ?? 'both'
          );
        }
      }
    } else {
      this.standingGestureBlend = THREE.MathUtils.damp(this.standingGestureBlend, 0, 6.0, dt);
    }

    // While co-seated holding her light-purple Xbox controller & playing TV games together,
    // comfortably hold the controller in front of her waist/chest with playful reactive tilt!
    if (sitBlend > 0.85 && this.gamingPhase === 'playing_sofa') {
      const s = this.getVrmAxisSign(vrm);
      const tilt = Math.sin(elapsed * 4.4) * 0.04 + this.gamingActionPulse * 0.14;
      const setArm = (bone: VRMHumanBoneName, rx: number, ry: number, rz: number, order: THREE.EulerOrder = 'ZYX') => {
        const node = vrm.humanoid.getNormalizedBoneNode(bone);
        if (!node) return;
        _footEuler.set(rx * s, ry, rz * s, order);
        node.quaternion.setFromEuler(_footEuler);
      };
      setArm('leftShoulder', 0.03, 0.06, -0.02, 'YXZ');
      setArm('rightShoulder', 0.03, -0.06, 0.02, 'YXZ');
      setArm('leftUpperArm', 0.42 + tilt * 0.4, -0.46, -1.04, 'ZYX');
      setArm('rightUpperArm', 0.42 - tilt * 0.4, 0.46, 1.04, 'ZYX');
      setArm('leftLowerArm', -0.08, -1.34 + tilt * 0.3, 0.0, 'YXZ');
      setArm('rightLowerArm', 0.08, 1.34 - tilt * 0.3, 0.0, 'YXZ');
      setArm('leftHand', 0.14, 0.16, 0.12, 'XYZ');
      setArm('rightHand', 0.14, -0.16, -0.12, 'XYZ');
      this.applyHandFingerPreset(vrm, 'left', 'heart');
      this.applyHandFingerPreset(vrm, 'right', 'heart');
    }
  }

  /**
   * Clean, poised, anatomically verified procedural sitting & sit/stand transition pose:
   * - Smoothly blends legs AND arms between standing `idle` and `seated` via quaternion SLERP
   *   so arms never pop abruptly into lap angles while still standing.
   * - Applies natural forward torso counter-balance (`transitionLeanPitch`) during sit/stand weight shift.
   */
  private applyProceduralSeatedPose(
    vrm: VRM,
    elapsed: number,
    sitBlend = 1,
    poseOverride?: HeroinePoseDefinition,
    transitionLeanPitch = 0,
    standUpFootwork?: StandUpFootworkState
  ): void {
    // 1. Reset all normalized bones cleanly to canonical rest pose before posing
    vrm.humanoid.resetNormalizedPose();

    const pose = poseOverride ?? HEROINE_POSES.seated;
    const idlePose = HEROINE_POSES.idle;
    const legs = pose.legs ?? HEROINE_POSES.seated.legs!;
    const s = THREE.MathUtils.clamp(sitBlend, 0, 1);
    const sway = Math.sin(elapsed * 0.68) * 0.010;
    const breath = Math.sin(elapsed * 1.55);

    // 2. Poised torso with natural forward weight-transfer lean + Sofa TV-watching intimacy micro-actions
    const sofaFsmScale = !poseOverride && this.postureState === 'seated_sofa' ? s : 0;
    const leanPitch = (pose.spineLean ?? 0) * 0.18 + transitionLeanPitch;
    const sofaPitch = this.sofaSpinePitchAdd * sofaFsmScale;
    const sofaRoll = this.sofaSpineRollAdd * sofaFsmScale;
    const sofaChestRoll = this.sofaChestRollAdd * sofaFsmScale;
    const sofaChestYaw = this.sofaChestYawAdd * sofaFsmScale;
    const sofaLegShift = this.sofaLegShiftAdd * sofaFsmScale;
    const restBlend = this.sofaShoulderRestBlend * sofaFsmScale;

    this.setCanonicalBoneRotation(
      vrm,
      'hips',
      transitionLeanPitch * 0.24,
      0,
      sofaRoll * 0.12 + (standUpFootwork?.hipRoll ?? 0),
      'YXZ'
    );
    this.setCanonicalBoneRotation(
      vrm,
      'spine',
      -0.02 + leanPitch * 0.56 + sofaPitch * 0.62 + breath * 0.008,
      sofaChestYaw * 0.35,
      sway * 0.35 + sofaRoll,
      'YXZ'
    );
    this.setCanonicalBoneRotation(
      vrm,
      'chest',
      0.01 + leanPitch * 0.34 + sofaPitch * 0.38 + breath * 0.014,
      sofaChestYaw * 0.65,
      sway * 0.45 + sofaChestRoll,
      'YXZ'
    );
    this.setCanonicalBoneRotation(
      vrm,
      'upperChest',
      breath * 0.008 + sofaPitch * 0.12,
      0,
      sofaChestRoll * 0.25,
      'YXZ'
    );

    // 3. Legs & Feet: smooth anatomical bend + floor-contact ankle/toe micro-articulation
    this.setCanonicalBoneRotation(
      vrm,
      'leftUpperLeg',
      legs.leftUpperLeg[0] * s + sofaLegShift * 0.22 + (standUpFootwork?.leftHipPitchAdd ?? 0),
      legs.leftUpperLeg[1] * s + sofaLegShift * 0.35,
      legs.leftUpperLeg[2] * s + sofaLegShift * 0.28,
      'YXZ'
    );
    this.setCanonicalBoneRotation(
      vrm,
      'rightUpperLeg',
      legs.rightUpperLeg[0] * s - sofaLegShift * 0.22 + (standUpFootwork?.rightHipPitchAdd ?? 0),
      legs.rightUpperLeg[1] * s + sofaLegShift * 0.35,
      legs.rightUpperLeg[2] * s + sofaLegShift * 0.28,
      'YXZ'
    );

    const legMicroSway = standUpFootwork ? 0 : Math.sin(elapsed * 0.88) * 0.014 * s;
    this.setCanonicalBoneRotation(
      vrm,
      'leftLowerLeg',
      legs.leftLowerLeg[0] * s + legMicroSway - Math.abs(sofaLegShift) * 0.35 + (standUpFootwork?.leftKneeAdd ?? 0),
      0,
      0,
      'YXZ'
    );
    this.setCanonicalBoneRotation(
      vrm,
      'rightLowerLeg',
      legs.rightLowerLeg[0] * s - legMicroSway * 0.8 - Math.abs(sofaLegShift) * 0.35 + (standUpFootwork?.rightKneeAdd ?? 0),
      0,
      0,
      'YXZ'
    );
    if (standUpFootwork) {
      this.setCanonicalBoneRotation(
        vrm,
        'leftFoot',
        legs.leftFoot[0] * s + standUpFootwork.leftAnklePitch,
        0,
        standUpFootwork.leftAnkleRoll,
        'YXZ'
      );
      this.setCanonicalBoneRotation(
        vrm,
        'rightFoot',
        legs.rightFoot[0] * s + standUpFootwork.rightAnklePitch,
        0,
        standUpFootwork.rightAnkleRoll,
        'YXZ'
      );
      this.setCanonicalBoneRotation(vrm, 'leftToes', standUpFootwork.leftToesPitch, 0, 0, 'YXZ');
      this.setCanonicalBoneRotation(vrm, 'rightToes', standUpFootwork.rightToesPitch, 0, 0, 'YXZ');
    } else {
      const ankleBalance = Math.sin(s * Math.PI) * -0.18;
      this.setCanonicalBoneRotation(vrm, 'leftFoot', legs.leftFoot[0] * s + ankleBalance, 0, 0, 'YXZ');
      this.setCanonicalBoneRotation(vrm, 'rightFoot', legs.rightFoot[0] * s + ankleBalance, 0, 0, 'YXZ');
    }

    // 4. Arms & Hands: smoothly SLERP between standing `idle` and `seated` lap rest when transitioning
    const armS = poseOverride ? 1 : smoothStep(0.08, 0.92, s);
    const midArc = poseOverride ? 0 : Math.sin(s * Math.PI);
    const brace = standUpFootwork?.armPushBrace ?? 0;
    const uaOrder = pose.upperArmOrder ?? 'YXZ';
    const idleOrder = idlePose.upperArmOrder ?? 'ZYX';
    const axisSign = this.getVrmAxisSign(vrm);

    const blendBone = (
      boneName: VRMHumanBoneName,
      fromArr: [number, number, number],
      fromOrder: THREE.EulerOrder,
      toArr: [number, number, number],
      toOrder: THREE.EulerOrder,
      t: number,
      extraX = 0,
      extraY = 0,
      extraZ = 0
    ) => {
      const node = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) return;
      _blendEulerA.set(fromArr[0] * axisSign, fromArr[1], fromArr[2] * axisSign, fromOrder);
      _blendEulerB.set(
        (toArr[0] + extraX) * axisSign,
        toArr[1] + extraY,
        (toArr[2] + extraZ) * axisSign,
        toOrder
      );
      _blendQuatA.setFromEuler(_blendEulerA);
      _blendQuatB.setFromEuler(_blendEulerB);
      node.quaternion.slerpQuaternions(_blendQuatA, _blendQuatB, t);
    };

    blendBone('leftShoulder', idlePose.leftShoulder, 'YXZ', pose.leftShoulder, 'YXZ', armS);
    blendBone(
      'rightShoulder',
      idlePose.rightShoulder,
      'YXZ',
      pose.rightShoulder,
      'YXZ',
      armS,
      0,
      0.08 * restBlend,
      0.06 * restBlend
    );
    // Gentle outward balance sweep at mid-sit/stand + subtle mattress push-brace keep arms crisp & collision-free
    blendBone(
      'leftUpperArm',
      idlePose.leftUpperArm,
      idleOrder,
      pose.leftUpperArm,
      uaOrder,
      armS,
      0.06 * restBlend - 0.14 * brace,
      -0.08 * midArc - 0.08 * restBlend - 0.22 * brace,
      breath * 0.010 + 0.10 * midArc - 0.08 * brace
    );
    blendBone(
      'rightUpperArm',
      idlePose.rightUpperArm,
      idleOrder,
      pose.rightUpperArm,
      uaOrder,
      armS,
      0.12 * restBlend - 0.14 * brace,
      0.08 * midArc + 0.16 * restBlend + 0.22 * brace,
      -breath * 0.010 - 0.10 * midArc + 0.06 * restBlend + 0.08 * brace
    );
    blendBone(
      'leftLowerArm',
      idlePose.leftLowerArm,
      'YXZ',
      pose.leftLowerArm,
      'YXZ',
      armS,
      0.06 * restBlend,
      -0.12 * restBlend + 0.34 * brace,
      0
    );
    blendBone(
      'rightLowerArm',
      idlePose.rightLowerArm,
      'YXZ',
      pose.rightLowerArm,
      'YXZ',
      armS,
      0.08 * restBlend,
      0.18 * restBlend - 0.34 * brace,
      0
    );
    blendBone('leftHand', idlePose.leftHand, 'XYZ', pose.leftHand, 'XYZ', armS);
    blendBone('rightHand', idlePose.rightHand, 'XYZ', pose.rightHand, 'XYZ', armS);

    this.applyHandFingerPreset(vrm, 'left', pose.leftFingerMode ?? 'relaxed');
    this.applyHandFingerPreset(vrm, 'right', pose.rightFingerMode ?? 'relaxed');
  }

  /**
   * Smoothly damps a normalized bone's canonical VRM 1.0 Euler angles so transitions between
   * standing idle, gestures (wave / finger_cheek / hands_chest / peace / heart), and walking
   * blend seamlessly with zero popping on both VRM 0.x and VRM 1.0.
   */
  private setDampedCanonicalBone(
    vrm: VRM,
    boneName: VRMHumanBoneName,
    tx: number,
    ty: number,
    tz: number,
    dt: number,
    lambda = 8.0,
    order: THREE.EulerOrder = 'YXZ'
  ): void {
    let cur = this.smoothedBoneEuler.get(boneName);
    if (!cur) {
      cur = new THREE.Vector3(tx, ty, tz);
      this.smoothedBoneEuler.set(boneName, cur);
    } else {
      cur.x = THREE.MathUtils.damp(cur.x, tx, lambda, dt);
      cur.y = THREE.MathUtils.damp(cur.y, ty, lambda, dt);
      cur.z = THREE.MathUtils.damp(cur.z, tz, lambda, dt);
    }
    this.setCanonicalBoneRotation(vrm, boneName, cur.x, cur.y, cur.z, order);
  }

  private seedSmoothedBonesToIdle(): void {
    const idlePose = HEROINE_POSES.idle;
    this.smoothedBoneEuler.set('hips', new THREE.Vector3(0, 0, 0));
    this.smoothedBoneEuler.set('spine', new THREE.Vector3(0, 0, 0));
    this.smoothedBoneEuler.set('chest', new THREE.Vector3(0, 0, 0));
    this.smoothedBoneEuler.set('upperChest', new THREE.Vector3(0, 0, 0));
    this.smoothedBoneEuler.set('leftUpperLeg', new THREE.Vector3(-0.02, 0.04, -0.035));
    this.smoothedBoneEuler.set('rightUpperLeg', new THREE.Vector3(0.03, -0.05, 0.035));
    this.smoothedBoneEuler.set('leftLowerLeg', new THREE.Vector3(0.05, 0, 0));
    this.smoothedBoneEuler.set('rightLowerLeg', new THREE.Vector3(0.06, 0, 0));
    this.smoothedBoneEuler.set('leftFoot', new THREE.Vector3(-0.03, 0, 0));
    this.smoothedBoneEuler.set('rightFoot', new THREE.Vector3(-0.04, 0, 0));
    this.smoothedBoneEuler.set('leftShoulder', new THREE.Vector3(...idlePose.leftShoulder));
    this.smoothedBoneEuler.set('rightShoulder', new THREE.Vector3(...idlePose.rightShoulder));
    this.smoothedBoneEuler.set('leftUpperArm', new THREE.Vector3(...idlePose.leftUpperArm));
    this.smoothedBoneEuler.set('rightUpperArm', new THREE.Vector3(...idlePose.rightUpperArm));
    this.smoothedBoneEuler.set('leftLowerArm', new THREE.Vector3(...idlePose.leftLowerArm));
    this.smoothedBoneEuler.set('rightLowerArm', new THREE.Vector3(...idlePose.rightLowerArm));
    this.smoothedBoneEuler.set('leftHand', new THREE.Vector3(...idlePose.leftHand));
    this.smoothedBoneEuler.set('rightHand', new THREE.Vector3(...idlePose.rightHand));
  }

  /**
   * Graceful procedural anime walk cycle (pelvis sway, natural knee lift, opposite arm swing)
   * used while the heroine approaches the player from the bed.
   */
  private applyProceduralWalkPose(vrm: VRM, dt: number, elapsed: number): void {
    vrm.humanoid.resetNormalizedPose();

    const p = this.walkPhase;
    const sinP = Math.sin(p);
    const cosP = Math.cos(p);
    const breath = Math.sin(elapsed * 1.6);

    // Subtle vertical step bob + gentle pelvis sway
    this.setDampedCanonicalBone(vrm, 'hips', 0.03, sinP * 0.06, -sinP * 0.035, dt, 14);
    this.setDampedCanonicalBone(vrm, 'spine', 0.02 + breath * 0.008, -sinP * 0.05, sinP * 0.02, dt, 12);
    this.setDampedCanonicalBone(vrm, 'chest', 0.01 + breath * 0.01, -sinP * 0.04, 0, dt, 12);

    // Legs: smooth alternating stride
    const lHipPitch = -sinP * 0.36;
    const rHipPitch = sinP * 0.36;
    const lKnee = Math.max(0.06, (cosP * 0.5 + 0.5) * 0.52);
    const rKnee = Math.max(0.06, (-cosP * 0.5 + 0.5) * 0.52);

    this.setDampedCanonicalBone(vrm, 'leftUpperLeg', lHipPitch, 0, -0.02, dt, 16);
    this.setDampedCanonicalBone(vrm, 'rightUpperLeg', rHipPitch, 0, 0.02, dt, 16);
    this.setDampedCanonicalBone(vrm, 'leftLowerLeg', lKnee, 0, 0, dt, 16);
    this.setDampedCanonicalBone(vrm, 'rightLowerLeg', rKnee, 0, 0, dt, 16);
    this.setDampedCanonicalBone(vrm, 'leftFoot', -lHipPitch * 0.28 - lKnee * 0.25, 0, 0, dt, 14);
    this.setDampedCanonicalBone(vrm, 'rightFoot', -rHipPitch * 0.28 - rKnee * 0.25, 0, 0, dt, 14);

    // Opposite gentle arm swing kept comfortably clear of the flared A-line skirt
    this.setDampedCanonicalBone(vrm, 'leftShoulder', 0, 0.04, 0.04, dt, 10);
    this.setDampedCanonicalBone(vrm, 'rightShoulder', 0, -0.04, -0.04, dt, 10);
    this.setDampedCanonicalBone(vrm, 'leftUpperArm', -0.06, -0.08 - sinP * 0.18, -1.02, dt, 12, 'ZYX');
    this.setDampedCanonicalBone(vrm, 'rightUpperArm', -0.06, 0.08 - sinP * 0.18, 1.02, dt, 12, 'ZYX');
    this.setDampedCanonicalBone(vrm, 'leftLowerArm', 0.0, -0.22 - Math.max(0, sinP) * 0.14, 0.0, dt, 12);
    this.setDampedCanonicalBone(vrm, 'rightLowerArm', 0.0, 0.22 + Math.max(0, -sinP) * 0.14, 0.0, dt, 12);
    this.setDampedCanonicalBone(vrm, 'leftHand', 0.04, 0, -0.08, dt, 12, 'XYZ');
    this.setDampedCanonicalBone(vrm, 'rightHand', 0.04, 0, 0.08, dt, 12, 'XYZ');

    for (let i = 0; i < HEROINE_LEFT_CURL_FINGERS.length; i++) {
      const [bone, curlZ] = HEROINE_LEFT_CURL_FINGERS[i];
      this.setCanonicalBoneRotation(vrm, bone, 0, 0, curlZ * 0.75, 'XYZ');
    }
    for (let i = 0; i < HEROINE_RIGHT_CURL_FINGERS.length; i++) {
      const [bone, curlZ] = HEROINE_RIGHT_CURL_FINGERS[i];
      this.setCanonicalBoneRotation(vrm, bone, 0, 0, curlZ * 0.75, 'XYZ');
    }
  }

  /**
   * Natural, calm standing dialogue pose driven entirely by decoupled `HEROINE_POSES` in
   * `heroinePoses.js` (or live Pose Tuner slider overrides for instant real-time posing).
   */
  private applyStandingGesturePose(
    vrm: VRM,
    dt: number,
    elapsed: number,
    poseOverride?: HeroinePoseDefinition,
    animateWaveOverride?: boolean,
    isTuningOverride?: boolean,
    externalWaveBlend?: number
  ): void {
    vrm.humanoid.resetNormalizedPose();

    const gesture: HeroineGesture = this.activePerformance.gesture;
    const pose: HeroinePoseDefinition =
      poseOverride ?? HEROINE_POSES[gesture] ?? HEROINE_POSES.idle;
    const idlePose = HEROINE_POSES.idle;
    const isTuning = isTuningOverride ?? Boolean(poseOverride);

    const targetLean = THREE.MathUtils.clamp(
      isTuning ? pose.spineLean ?? 0 : this.activePerformance.leanForward ?? pose.spineLean ?? 0,
      0,
      1
    );
    this.currentLeanForward = THREE.MathUtils.damp(
      this.currentLeanForward,
      targetLean,
      isTuning ? 18.0 : 4.2,
      dt
    );

    const sway = Math.sin(elapsed * 0.68) * (isTuning ? 0.004 : 0.014);
    const breath = Math.sin(elapsed * 1.48);

    // Calm, poised standing torso with soft natural breathing
    const leanPitch = this.currentLeanForward * 0.18;
    const dampLambda = isTuning ? 26.0 : 6.5;
    this.setDampedCanonicalBone(vrm, 'hips', leanPitch * 0.22, sway * 0.5, sway * 0.7, dt, dampLambda);
    this.setDampedCanonicalBone(
      vrm,
      'spine',
      leanPitch * 0.45 + breath * 0.009,
      -sway * 0.3,
      -sway * 0.45,
      dt,
      dampLambda
    );
    this.setDampedCanonicalBone(
      vrm,
      'chest',
      leanPitch * 0.33 + breath * 0.013,
      -sway * 0.2,
      -sway * 0.28,
      dt,
      dampLambda
    );
    this.setDampedCanonicalBone(vrm, 'upperChest', breath * 0.007, 0, 0, dt, dampLambda);

    this.setDampedCanonicalBone(vrm, 'leftUpperLeg', -0.02, 0.04, -0.035, dt, 8);
    this.setDampedCanonicalBone(vrm, 'rightUpperLeg', 0.03, -0.05, 0.035, dt, 8);
    this.setDampedCanonicalBone(vrm, 'leftLowerLeg', 0.05, 0, 0, dt, 8);
    this.setDampedCanonicalBone(vrm, 'rightLowerLeg', 0.06, 0, 0, dt, 8);
    this.setDampedCanonicalBone(vrm, 'leftFoot', -0.03, 0, 0, dt, 8);
    this.setDampedCanonicalBone(vrm, 'rightFoot', -0.04, 0, 0, dt, 8);

    const lSh: [number, number, number] = [...pose.leftShoulder];
    let rSh: [number, number, number] = [...pose.rightShoulder];
    const lUA: [number, number, number] = [
      pose.leftUpperArm[0],
      pose.leftUpperArm[1],
      pose.leftUpperArm[2] + breath * 0.009,
    ];
    let rUA: [number, number, number] = [
      pose.rightUpperArm[0],
      pose.rightUpperArm[1],
      pose.rightUpperArm[2] - breath * 0.009,
    ];
    const lLA: [number, number, number] = [...pose.leftLowerArm];
    let rLA: [number, number, number] = [...pose.rightLowerArm];
    const lH: [number, number, number] = [...pose.leftHand];
    let rH: [number, number, number] = [...pose.rightHand];

    let leftFingerMode: HeroineFingerMode = pose.leftFingerMode ?? 'relaxed';
    let rightFingerMode: HeroineFingerMode = pose.rightFingerMode ?? 'relaxed';

    // Optional soft greeting wave oscillation (or smooth external blend during greeting_wave / reach_hand)
    if (pose.waveMotion && (!isTuning || animateWaveOverride)) {
      const wm = pose.waveMotion;
      let waveBlend = 1.0;
      if (typeof externalWaveBlend === 'number') {
        waveBlend = THREE.MathUtils.clamp(externalWaveBlend, 0, 1);
      } else if (!isTuning) {
        const waveFade =
          this.gestureElapsed < wm.durationSec
            ? 1.0
            : THREE.MathUtils.clamp(1 - (this.gestureElapsed - wm.durationSec) / wm.fadeSec, 0, 1);
        waveBlend = waveFade * waveFade * (3 - 2 * waveFade);
      }
      const waveOsc = Math.sin((isTuning ? elapsed : this.gestureElapsed) * wm.speed) * waveBlend;

      if (waveBlend < 0.999) {
        rSh = [
          THREE.MathUtils.lerp(idlePose.rightShoulder[0], pose.rightShoulder[0], waveBlend),
          THREE.MathUtils.lerp(idlePose.rightShoulder[1], pose.rightShoulder[1], waveBlend),
          THREE.MathUtils.lerp(idlePose.rightShoulder[2], pose.rightShoulder[2], waveBlend),
        ];
        rUA = [
          THREE.MathUtils.lerp(idlePose.rightUpperArm[0], pose.rightUpperArm[0], waveBlend),
          THREE.MathUtils.lerp(idlePose.rightUpperArm[1], pose.rightUpperArm[1], waveBlend),
          THREE.MathUtils.lerp(
            idlePose.rightUpperArm[2] - breath * 0.009,
            pose.rightUpperArm[2] + breath * 0.009,
            waveBlend
          ),
        ];
        rLA = [
          THREE.MathUtils.lerp(idlePose.rightLowerArm[0], pose.rightLowerArm[0], waveBlend),
          THREE.MathUtils.lerp(idlePose.rightLowerArm[1], pose.rightLowerArm[1], waveBlend) +
            waveOsc * wm.forearmY,
          THREE.MathUtils.lerp(idlePose.rightLowerArm[2], pose.rightLowerArm[2], waveBlend),
        ];
        rH = [
          THREE.MathUtils.lerp(idlePose.rightHand[0], pose.rightHand[0], waveBlend),
          THREE.MathUtils.lerp(idlePose.rightHand[1], pose.rightHand[1], waveBlend) +
            waveOsc * wm.wristY,
          THREE.MathUtils.lerp(idlePose.rightHand[2], pose.rightHand[2], waveBlend),
        ];
        if (waveBlend <= 0.35) {
          rightFingerMode = 'relaxed';
        }
      } else {
        rLA[1] += waveOsc * wm.forearmY;
        rH[1] += waveOsc * wm.wristY;
      }
    }

    const uaOrder = pose.upperArmOrder ?? 'ZYX';
    const armLambda = isTuning ? 28.0 : 6.2;
    const handLambda = isTuning ? 28.0 : 7.5;
    this.setDampedCanonicalBone(vrm, 'leftShoulder', lSh[0], lSh[1], lSh[2], dt, armLambda);
    this.setDampedCanonicalBone(vrm, 'rightShoulder', rSh[0], rSh[1], rSh[2], dt, armLambda);
    this.setDampedCanonicalBone(vrm, 'leftUpperArm', lUA[0], lUA[1], lUA[2], dt, armLambda, uaOrder);
    this.setDampedCanonicalBone(vrm, 'rightUpperArm', rUA[0], rUA[1], rUA[2], dt, armLambda, uaOrder);
    this.setDampedCanonicalBone(vrm, 'leftLowerArm', lLA[0], lLA[1], lLA[2], dt, armLambda, 'YXZ');
    this.setDampedCanonicalBone(vrm, 'rightLowerArm', rLA[0], rLA[1], rLA[2], dt, armLambda, 'YXZ');
    this.setDampedCanonicalBone(vrm, 'leftHand', lH[0], lH[1], lH[2], dt, handLambda, 'XYZ');
    this.setDampedCanonicalBone(vrm, 'rightHand', rH[0], rH[1], rH[2], dt, handLambda, 'XYZ');

    this.applyHandFingerPreset(vrm, 'left', leftFingerMode);
    this.applyHandFingerPreset(vrm, 'right', rightFingerMode);
  }

  private applyHandFingerPreset(
    vrm: VRM,
    side: 'left' | 'right',
    mode: HeroineFingerMode
  ): void {
    const s = side === 'left' ? -1 : 1;
    const setCurl = (
      prox: VRMHumanBoneName,
      inter: VRMHumanBoneName,
      dist: VRMHumanBoneName,
      amount: number,
      splayY = 0
    ) => {
      this.setCanonicalBoneRotation(vrm, prox, 0, splayY, s * amount, 'XYZ');
      this.setCanonicalBoneRotation(vrm, inter, 0, 0, s * amount * 1.15, 'XYZ');
      this.setCanonicalBoneRotation(vrm, dist, 0, 0, s * amount * 0.65, 'XYZ');
    };

    const pfx = side === 'left' ? 'left' : 'right';
    if (mode === 'open') {
      setCurl(`${pfx}IndexProximal`, `${pfx}IndexIntermediate`, `${pfx}IndexDistal`, 0.08, s * 0.05);
      setCurl(`${pfx}MiddleProximal`, `${pfx}MiddleIntermediate`, `${pfx}MiddleDistal`, 0.10, 0);
      setCurl(`${pfx}RingProximal`, `${pfx}RingIntermediate`, `${pfx}RingDistal`, 0.12, -s * 0.04);
      setCurl(`${pfx}LittleProximal`, `${pfx}LittleIntermediate`, `${pfx}LittleDistal`, 0.14, -s * 0.08);
    } else if (mode === 'point') {
      setCurl(`${pfx}IndexProximal`, `${pfx}IndexIntermediate`, `${pfx}IndexDistal`, 0.04, 0);
      setCurl(`${pfx}MiddleProximal`, `${pfx}MiddleIntermediate`, `${pfx}MiddleDistal`, 0.85, 0);
      setCurl(`${pfx}RingProximal`, `${pfx}RingIntermediate`, `${pfx}RingDistal`, 0.92, 0);
      setCurl(`${pfx}LittleProximal`, `${pfx}LittleIntermediate`, `${pfx}LittleDistal`, 0.96, 0);
    } else if (mode === 'peace') {
      setCurl(`${pfx}IndexProximal`, `${pfx}IndexIntermediate`, `${pfx}IndexDistal`, 0.03, s * 0.16);
      setCurl(`${pfx}MiddleProximal`, `${pfx}MiddleIntermediate`, `${pfx}MiddleDistal`, 0.04, -s * 0.14);
      setCurl(`${pfx}RingProximal`, `${pfx}RingIntermediate`, `${pfx}RingDistal`, 0.98, 0);
      setCurl(`${pfx}LittleProximal`, `${pfx}LittleIntermediate`, `${pfx}LittleDistal`, 1.02, 0);
    } else if (mode === 'heart') {
      setCurl(`${pfx}IndexProximal`, `${pfx}IndexIntermediate`, `${pfx}IndexDistal`, 0.56, 0);
      setCurl(`${pfx}MiddleProximal`, `${pfx}MiddleIntermediate`, `${pfx}MiddleDistal`, 0.62, 0);
      setCurl(`${pfx}RingProximal`, `${pfx}RingIntermediate`, `${pfx}RingDistal`, 0.68, 0);
      setCurl(`${pfx}LittleProximal`, `${pfx}LittleIntermediate`, `${pfx}LittleDistal`, 0.72, 0);
    } else {
      const list = side === 'left' ? HEROINE_LEFT_CURL_FINGERS : HEROINE_RIGHT_CURL_FINGERS;
      for (let i = 0; i < list.length; i++) {
        const [bone, curlZ] = list[i];
        this.setCanonicalBoneRotation(vrm, bone, 0, 0, curlZ, 'XYZ');
      }
    }
  }

  /**
   * Logical, human-like 3-tier attention & gaze controller:
   * - While walking: looks naturally ahead along her walking path (never craning backward at player).
   * - During room-glance dialogue beats: looks toward the bedroom landmark, pauses, then returns.
   * - While standing/seated in dialogue or idle:
   *   1. Eyes (`vrm.lookAt`) lead first for small player movements.
   *   2. Head & neck smoothly turn up to ±30 deg while torso stays planted.
   *   3. Torso/chair ONLY pivots when player moves substantially off-axis (> 50-60 deg).
   * - In non-dialogue idle following: occasionally glances softly around the room instead of staring non-stop.
   */
  private updateGazeAndHeadTracking(
    vrm: VRM,
    dt: number,
    elapsed: number,
    playerEyeWorldPos: THREE.Vector3,
    playerRoom: RoomId
  ): void {
    const headNode = vrm.humanoid.getNormalizedBoneNode('head');
    const neckNode = vrm.humanoid.getNormalizedBoneNode('neck');
    if (!headNode) return;

    this.root.updateMatrixWorld(true);
    headNode.getWorldPosition(_headWorldPos);

    const isWalkingNow =
      this.postureState === 'walking_to_player' ||
      this.postureState === 'dialogue_walking' ||
      this.postureState === 'walking_to_sofa' ||
      (this.postureState === 'standing_talking' && this.isBedroomDialogueFollowing) ||
      (this.postureState === 'following_player' && this.isFollowMoving);

    const isDialogue =
      (this.postureState === 'greeting_wave' ||
        this.postureState === 'standing_talking' ||
        (this.postureState === 'seated_chair' && !this.bedroomIdleChairWaitActive) ||
        (this.postureState === 'seated_sofa' &&
          (this.sofaInDialogue || this.sofaReactionTimer > 0))) &&
      !this.poseTuner;

    // Determine logical world gaze target based on current activity
    let lookTargetWorld = _desiredLookWorld;
    let shouldTrackTarget = true;

    if (this.poseTuner) {
      lookTargetWorld.copy(playerEyeWorldPos);
    } else if (this.gamingPhase === 'pickup_pads') {
      lookTargetWorld.set(4.36, 0.48, -5.22);
    } else if (this.gamingPhase === 'handoff_wait') {
      lookTargetWorld.copy(playerEyeWorldPos);
    } else if (this.gamingPhase === 'playing_sofa') {
      lookTargetWorld.copy(this.sofaTvLookPos);
    } else if (isWalkingNow) {
      // Logical attention: watch where she is walking!
      const fwdX = Math.sin(this.root.rotation.y);
      const fwdZ = Math.cos(this.root.rotation.y);
      lookTargetWorld.set(
        this.root.position.x + fwdX * 3.4,
        _headWorldPos.y - 0.04,
        this.root.position.z + fwdZ * 3.4
      );
    } else if (this.roomGlanceRemaining > 0) {
      // Staged dialogue room glance (looking toward desk / window / door)
      lookTargetWorld.copy(this.roomGlanceTargetPos);
    } else if (this.postureState === 'seated_chair' && this.bedroomIdleChairWaitActive && this.toyGunPhase === 'none') {
      if (this.chairBoredomState === 'look_around') {
        lookTargetWorld.copy(this.chairBoredomLookPoint);
      } else if (playerRoom === 'bedroom' && this.chairBoredomState !== 'swivel_play') {
        lookTargetWorld.copy(playerEyeWorldPos);
      } else {
        const fwdX = Math.sin(this.root.rotation.y);
        const fwdZ = Math.cos(this.root.rotation.y);
        lookTargetWorld.set(
          this.root.position.x + fwdX * 2.8,
          _headWorldPos.y - 0.04,
          this.root.position.z + fwdZ * 2.8
        );
      }
    } else if (this.postureState === 'seated_sofa' && !this.sofaInDialogue) {
      // Sitting cozily beside player on Living Room sofa: driven by the Sofa TV-watching FSM when TV is ON,
      // or warmly looking at player when TV is off or when reacting to the toy gun!
      if (this.toyGunPhase !== 'none' || this.sofaReactionTimer > 0) {
        lookTargetWorld.copy(playerEyeWorldPos);
      } else if (this.sofaTvIsOn) {
        if (this.sofaTvState === 'side_glance_smile') {
          lookTargetWorld.copy(playerEyeWorldPos);
        } else if (this.sofaTvState === 'scoot_closer' && Math.sin(elapsed * 0.72) > 0.56) {
          lookTargetWorld.copy(playerEyeWorldPos);
        } else {
          lookTargetWorld.copy(this.sofaTvLookPos);
        }
      } else {
        lookTargetWorld.copy(playerEyeWorldPos);
      }
    } else {
      // Evaluate player position in heroine root local space (+Z forward, +Y up, +X left)
      _toTargetWorld.subVectors(playerEyeWorldPos, _headWorldPos);
      const distToPlayer = _toTargetWorld.length();
      _invRootQuat.copy(this.root.quaternion).invert();
      _toTargetLocal.copy(_toTargetWorld).applyQuaternion(_invRootQuat);

      const relYaw = Math.atan2(_toTargetLocal.x, _toTargetLocal.z);
      const playerInComfortableView =
        _toTargetLocal.z > -0.15 && Math.abs(relYaw) < THREE.MathUtils.degToRad(86);

      // In casual idle following (not dialogue), occasionally glance softly around the room
      if (this.postureState === 'following_player' && !this.isFollowMoving) {
        if (this.idleAmbientGlanceRemaining > 0) {
          this.idleAmbientGlanceRemaining = Math.max(0, this.idleAmbientGlanceRemaining - dt);
          lookTargetWorld.copy(this.idleAmbientGlancePoint);
        } else {
          this.idleAmbientGlanceCooldown -= dt;
          if (this.idleAmbientGlanceCooldown <= 0) {
            this.idleAmbientGlanceCooldown = 7.5 + Math.random() * 5.0;
            this.idleAmbientGlanceRemaining = 1.9 + Math.random() * 1.4;
            const glanceAngle =
              this.root.rotation.y + (Math.random() < 0.5 ? -1 : 1) * (0.42 + Math.random() * 0.45);
            this.idleAmbientGlancePoint.set(
              this.root.position.x + Math.sin(glanceAngle) * 3.2,
              _headWorldPos.y + (Math.random() - 0.35) * 0.45,
              this.root.position.z + Math.cos(glanceAngle) * 3.2
            );
            lookTargetWorld.copy(this.idleAmbientGlancePoint);
          } else if (playerInComfortableView && distToPlayer < 6.5) {
            lookTargetWorld.copy(playerEyeWorldPos);
          } else {
            const fwdX = Math.sin(this.root.rotation.y);
            const fwdZ = Math.cos(this.root.rotation.y);
            lookTargetWorld.set(
              this.root.position.x + fwdX * 3.0,
              _headWorldPos.y,
              this.root.position.z + fwdZ * 3.0
            );
            shouldTrackTarget = false;
          }
        }
      } else if (
        isDialogue ||
        (playerInComfortableView &&
          ((playerRoom === 'bedroom' && distToPlayer < 7.8) || distToPlayer < 5.8))
      ) {
        lookTargetWorld.copy(playerEyeWorldPos);
      } else {
        lookTargetWorld.copy(BEDROOM_BED_SEAT_ANCHOR.defaultDoorLookPoint);
        shouldTrackTarget = false;
      }
    }

    // 1. Primary gaze (Tier 1 — Eyes lead immediately via native VRM LookAt)
    if (!this.lookAtInitialized) {
      this.lookAtTarget.position.copy(lookTargetWorld);
      this.lookAtInitialized = true;
    } else {
      const eyeLambda = isWalkingNow ? 7.0 : isDialogue ? 12.5 : 8.5;
      this.lookAtTarget.position.x = THREE.MathUtils.damp(
        this.lookAtTarget.position.x,
        lookTargetWorld.x,
        eyeLambda,
        dt
      );
      this.lookAtTarget.position.y = THREE.MathUtils.damp(
        this.lookAtTarget.position.y,
        lookTargetWorld.y,
        eyeLambda,
        dt
      );
      this.lookAtTarget.position.z = THREE.MathUtils.damp(
        this.lookAtTarget.position.z,
        lookTargetWorld.z,
        eyeLambda,
        dt
      );
    }
    this.lookAtTarget.updateMatrixWorld(true);

    // 2. Secondary gaze (Tier 2 — Head & Neck follow smoothly while torso stays planted for small moves)
    let targetYaw = 0;
    let targetPitch = 0;
    let targetTilt = 0;

    if (this.poseTuner) {
      targetPitch = this.poseTuner.pose.head[0];
      targetYaw = this.poseTuner.pose.head[1];
      targetTilt = this.poseTuner.pose.head[2];
    } else if (!isWalkingNow) {
      _toTargetWorld.subVectors(lookTargetWorld, _headWorldPos);
      _invRootQuat.copy(this.root.quaternion).invert();
      _toTargetLocal.copy(_toTargetWorld).applyQuaternion(_invRootQuat);
      const horizDist = Math.hypot(_toTargetLocal.x, _toTargetLocal.z);

      if (shouldTrackTarget && horizDist > 0.15) {
        const rawYaw = Math.atan2(_toTargetLocal.x, _toTargetLocal.z);
        const rawPitch = -Math.atan2(_toTargetLocal.y, Math.max(horizDist, 0.25));

        // Deadzone-softened head response: eyes handle tiny shifts (< ~10 deg), head turns smoothly
        // for medium shifts (10..55 deg), keeping neck strictly within human comfort limits.
        const absYaw = Math.abs(rawYaw);
        const headYawFactor = absYaw < 0.16 ? 0.35 : absYaw < 0.55 ? 0.72 : 0.85;
        targetYaw = THREE.MathUtils.clamp(
          rawYaw * headYawFactor,
          -MAX_HEAD_YAW_RAD,
          MAX_HEAD_YAW_RAD
        );
        targetPitch = THREE.MathUtils.clamp(
          rawPitch * (isDialogue ? 0.60 : 0.45),
          -MAX_HEAD_PITCH_UP_RAD,
          MAX_HEAD_PITCH_DOWN_RAD
        );
      }

      if (this.toyGunPhase === 'flinch') {
        // Defensive flinch: tuck chin slightly and turn head gently away while shielding body
        targetPitch = 0.08;
        targetYaw = THREE.MathUtils.clamp(targetYaw - 0.24, -MAX_HEAD_YAW_RAD, MAX_HEAD_YAW_RAD);
        targetTilt = -0.14;
      } else if (this.toyGunPhase === 'pout') {
        // Micro-pout peek: slight bashful head tilt looking softly at player
        targetPitch = THREE.MathUtils.clamp(targetPitch + 0.05, -MAX_HEAD_PITCH_UP_RAD, MAX_HEAD_PITCH_DOWN_RAD);
        targetTilt = 0.09;
      } else if (this.postureState === 'greeting_wave') {
        // Warm cheerful head tilt while squinting & waving hello, then gently straightening
        const waveTiltEnv = Math.sin(
          THREE.MathUtils.clamp(this.greetingWaveElapsed / this.greetingWaveDuration, 0, 1) * Math.PI
        );
        targetTilt = 0.095 * waveTiltEnv;
      } else if (this.postureState === 'seated_chair' && this.bedroomIdleChairWaitActive) {
        if (this.chairBoredomState === 'chin_rest') {
          targetTilt = 0.14;
          targetPitch = THREE.MathUtils.clamp(targetPitch + 0.04, -MAX_HEAD_PITCH_UP_RAD, MAX_HEAD_PITCH_DOWN_RAD);
        } else if (this.chairBoredomState === 'swivel_play') {
          targetTilt = Math.sin(elapsed * 1.15) * 0.08;
        }
      } else if (isDialogue && this.roomGlanceRemaining <= 0) {
        const activePose = HEROINE_POSES[this.activePerformance.gesture];
        targetTilt = THREE.MathUtils.clamp(
          this.activePerformance.headTilt ?? activePose?.head[2] ?? 0,
          -0.28,
          0.28
        );
      } else if (this.isSofaTvFsmActive()) {
        // Expressive head tilt / shoulder-rest angle driven by Sofa TV-watching FSM
        if (this.sofaShoulderRestBlend > 0.02) {
          const b = this.sofaShoulderRestBlend;
          targetTilt = THREE.MathUtils.lerp(targetTilt, 0.27, b);
          targetPitch = THREE.MathUtils.lerp(targetPitch, 0.06, b);
          targetYaw = THREE.MathUtils.lerp(targetYaw, -0.07, b);
        } else if (this.sofaTvState === 'side_glance_smile') {
          targetTilt = 0.10;
        } else if (this.sofaTvState === 'scoot_closer') {
          targetTilt = 0.06;
        } else if (this.sofaTvState === 'lean_interested') {
          targetTilt = -0.05;
        } else if (this.sofaTvState === 'adjust_posture') {
          const normT = THREE.MathUtils.clamp(
            this.sofaTvStateElapsed / Math.max(0.01, this.sofaTvStateDuration),
            0,
            1
          );
          targetTilt = this.sofaAdjustDir * 0.095 * Math.sin(normT * Math.PI);
        }
      }
    } else {
      // Subtle alive head micro-bob while walking forward
      targetPitch = 0.02 + Math.sin(elapsed * 2.2) * 0.015;
    }

    const headLambda = this.poseTuner ? 22.0 : isWalkingNow ? 4.8 : 5.6;
    this.currentHeadYaw = THREE.MathUtils.damp(this.currentHeadYaw, targetYaw, headLambda, dt);
    this.currentHeadPitch = THREE.MathUtils.damp(this.currentHeadPitch, targetPitch, headLambda, dt);
    this.currentHeadTilt = THREE.MathUtils.damp(this.currentHeadTilt, targetTilt, headLambda, dt);

    const axisSign = this.getVrmAxisSign(vrm);
    const bonePitch = this.currentHeadPitch * axisSign;
    const boneYaw = this.currentHeadYaw;
    const boneRoll = this.currentHeadTilt * axisSign;

    // Distribute natural turn & tilt across neck (38%) and head (62%)
    if (neckNode) {
      neckNode.rotation.order = 'YXZ';
      neckNode.rotation.set(bonePitch * 0.38, boneYaw * 0.38, boneRoll * 0.30);
    }
    headNode.rotation.order = 'YXZ';
    headNode.rotation.set(bonePitch * 0.62, boneYaw * 0.62, boneRoll * 0.70);
  }

  /**
   * Pure single-channel native VRM expression driver (`不要混合，切换表情再过渡`):
   * 1. At ANY point in time, at most ONE native VRM expression channel (`happy`, `relaxed`, `sad`,
   *    `angry`, `surprised`, `blink`, `blinkLeft`) is non-zero — NEVER two expressions stacked.
   * 2. When switching expressions (e.g. `neutral` -> `happy`, `happy` -> `sad`), the outgoing
   *    expression (plus any active lip-sync/blink when entering a non-neutral expression) first
   *    transitions cleanly down to exact 0 (~0.13s), and ONLY THEN does the new native expression
   *    transition smoothly up to 1.0 (~0.16s).
   * 3. When smiling (`happy` = native VRM `欣喜`/`喜悦` face at full 1.0), eyes close completely
   *    via the VRM's native morphs, and mouth vowels + auto-blink stay strictly at 0 so the mouth
   *    never opens or distorts the smile.
   */
  private updateExpressionsLipSyncAndBlush(vrm: VRM, dt: number): void {
    const expr = vrm.expressionManager;
    const sofaTvFsmActive = this.isSofaTvFsmActive();
    const isCalmIdleState =
      this.postureState === 'seated' ||
      this.postureState === 'following_player' ||
      (this.postureState === 'seated_sofa' &&
        !this.sofaInDialogue &&
        this.sofaReactionTimer <= 0 &&
        !sofaTvFsmActive);

    const preset: HeroineExpressionPreset = this.poseTuner
      ? this.poseTuner.expression
      : this.toyGunPhase === 'pout'
        ? 'sad'
        : this.toyGunPhase === 'flinch'
          ? 'neutral'
          : isCalmIdleState
            ? 'neutral'
            : sofaTvFsmActive
              ? 'neutral'
              : this.activePerformance.expression;

    type ExprChannel =
      | 'none'
      | 'happy'
      | 'relaxed'
      | 'sad'
      | 'angry'
      | 'surprised'
      | 'blink'
      | 'blinkLeft';

    let desiredChannel: ExprChannel = 'none';
    let desiredWeight = 0;

    if (!this.poseTuner && this.toyGunPhase === 'flinch') {
      desiredChannel = 'blink';
      desiredWeight = 1.0;
    } else if (this.postureState === 'greeting_wave' && !this.poseTuner && this.toyGunPhase === 'none') {
      // Squint-smile wave (0..1.38s: pure native VRM 欣喜 happy=1.0),
      // then smoothly transition back to neutral (eyes open) before dialogue begins!
      if (this.greetingWaveElapsed < 1.38) {
        desiredChannel = 'happy';
        desiredWeight = 1.0;
      } else {
        desiredChannel = 'none';
        desiredWeight = 0;
      }
    } else if (!this.poseTuner && this.toyGunPhase === 'pout') {
      desiredChannel = 'sad';
      desiredWeight = 1.0;
    } else if (
      this.postureState === 'seated_chair' &&
      this.bedroomIdleChairWaitActive &&
      !this.poseTuner &&
      this.toyGunPhase === 'none'
    ) {
      if (this.chairBoredomState === 'kick_feet') {
        desiredChannel = 'happy';
        desiredWeight = 1.0;
      } else {
        desiredChannel = 'none';
        desiredWeight = 0;
      }
    } else if (sofaTvFsmActive && !this.poseTuner) {
      if (this.sofaTvState === 'shoulder_rest' || this.sofaTvState === 'side_glance_smile') {
        desiredChannel = 'happy';
        desiredWeight = 1.0;
      } else if (this.sofaTvState === 'adjust_posture') {
        const normT = THREE.MathUtils.clamp(
          this.sofaTvStateElapsed / Math.max(0.01, this.sofaTvStateDuration),
          0,
          1
        );
        if (normT < 0.42) {
          desiredChannel = 'surprised';
          desiredWeight = 1.0;
        } else {
          desiredChannel = 'none';
          desiredWeight = 0;
        }
      } else {
        desiredChannel = 'none';
        desiredWeight = 0;
      }
    } else if (preset === 'wink' && !this.poseTuner) {
      if (this.winkPulseElapsed < 0) {
        this.winkPulseElapsed = 0;
      } else if (this.activeExprChannel === 'blinkLeft') {
        this.winkPulseElapsed += dt;
      }
      if (this.winkPulseElapsed < 0.34) {
        desiredChannel = 'blinkLeft';
        desiredWeight = 1.0;
      } else {
        desiredChannel = 'none';
        desiredWeight = 0;
      }
    } else {
      const baseWeights = HEROINE_EXPRESSIONS[preset] ?? HEROINE_EXPRESSIONS.neutral;
      if (baseWeights.wink > 0) {
        desiredChannel = 'blinkLeft';
        desiredWeight = THREE.MathUtils.clamp(baseWeights.wink, 0, 1);
      } else if (baseWeights.happy > 0) {
        desiredChannel = 'happy';
        desiredWeight = THREE.MathUtils.clamp(baseWeights.happy, 0, 1);
      } else if (baseWeights.relaxed > 0) {
        desiredChannel = 'relaxed';
        desiredWeight = THREE.MathUtils.clamp(baseWeights.relaxed, 0, 1);
      } else if (baseWeights.sad > 0) {
        desiredChannel = 'sad';
        desiredWeight = THREE.MathUtils.clamp(baseWeights.sad, 0, 1);
      } else if (baseWeights.angry > 0) {
        desiredChannel = 'angry';
        desiredWeight = THREE.MathUtils.clamp(baseWeights.angry, 0, 1);
      } else if (baseWeights.surprised > 0) {
        desiredChannel = 'surprised';
        desiredWeight = THREE.MathUtils.clamp(baseWeights.surprised, 0, 1);
      } else {
        desiredChannel = 'none';
        desiredWeight = 0;
      }
    }

    // Lip-sync is ONLY active in pure neutral open-eyed speaking (`none`), so smiles & native
    // VRM expressions NEVER mix with mouth vowel morphs (`微笑的时候嘴巴不要张开`).
    if (this.isSpeaking) {
      this.speakTailTimer = 0.22;
    } else if (this.speakTailTimer > 0) {
      this.speakTailTimer = Math.max(0, this.speakTailTimer - dt);
    }

    const lipAllowed =
      !this.poseTuner &&
      desiredChannel === 'none' &&
      this.activeExprChannel === 'none';

    let targetAa = 0;
    let targetIh = 0;
    let targetOu = 0;
    let targetEe = 0;
    let targetOh = 0;
    const lipActive = lipAllowed && (this.isSpeaking || this.speakTailTimer > 0);
    if (lipActive) {
      this.speakPhase += dt * 13.4;
      const primaryBeat = Math.pow(0.5 + 0.5 * Math.sin(this.speakPhase), 1.28);
      const accentMod = 0.68 + 0.32 * Math.sin(this.speakPhase * 0.53 + 0.9);
      const tailFade = this.isSpeaking ? 1.0 : THREE.MathUtils.clamp(this.speakTailTimer / 0.22, 0, 1);
      const peakAmp = 0.80;
      const amp = THREE.MathUtils.clamp(primaryBeat * accentMod * peakAmp * tailFade, 0, peakAmp);
      const vowelSlot = Math.floor((this.speakPhase * 0.38) % 6);
      if (vowelSlot === 0 || vowelSlot === 3) {
        targetAa = amp;
      } else if (vowelSlot === 1) {
        targetOh = amp * 0.88;
        targetAa = amp * 0.22;
      } else if (vowelSlot === 2) {
        targetIh = amp * 0.82;
        targetAa = amp * 0.25;
      } else if (vowelSlot === 4) {
        targetOu = amp * 0.85;
      } else {
        targetEe = amp * 0.80;
        targetAa = amp * 0.20;
      }
    }

    const moveToward = (cur: number, dst: number, speed: number) => {
      if (cur < dst) return Math.min(dst, cur + speed * dt);
      if (cur > dst) return Math.max(dst, cur - speed * dt);
      return dst;
    };

    const lipRate = lipAllowed ? 9.5 : 13.5; // closes cleanly within ~0.07s before smile fades in
    this.currentVowelAa = moveToward(this.currentVowelAa, targetAa, lipRate);
    this.currentVowelIh = moveToward(this.currentVowelIh, targetIh, lipRate);
    this.currentVowelOu = moveToward(this.currentVowelOu, targetOu, lipRate);
    this.currentVowelEe = moveToward(this.currentVowelEe, targetEe, lipRate);
    this.currentVowelOh = moveToward(this.currentVowelOh, targetOh, lipRate);

    const maxMouthOpen = Math.max(
      this.currentVowelAa,
      this.currentVowelIh,
      this.currentVowelOu,
      this.currentVowelEe,
      this.currentVowelOh
    );

    // Pause & cleanly close auto-blinking whenever any non-neutral expression is active/pending
    const autoBlinkAllowed =
      desiredChannel === 'none' && this.activeExprChannel === 'none';

    if (!autoBlinkAllowed) {
      this.blinkElapsed = -1;
      this.currentBlink = moveToward(this.currentBlink, 0, 14.0);
    }

    // Non-overlapping sequential expression transition (`不要混合，切换表情再过渡`)
    const fadeOutSpeed = 7.5; // ~0.13s clean fade out to 0
    const fadeInSpeed = 6.2;  // ~0.16s smooth fade in to 1.0

    if (desiredChannel !== this.activeExprChannel) {
      if (this.activeExprChannel !== 'none' && this.activeExprLinear > 0) {
        this.activeExprLinear = Math.max(0, this.activeExprLinear - fadeOutSpeed * dt);
      } else {
        this.activeExprLinear = 0;
        // Wait until mouth vowels & auto-blink reach 0 before activating a native non-neutral expression
        const faceClear =
          desiredChannel === 'none' || (maxMouthOpen <= 0.004 && this.currentBlink <= 0.004);
        if (faceClear) {
          this.activeExprChannel = desiredChannel;
          this.activeExprLinear = 0;
        }
      }
    } else if (this.activeExprChannel !== 'none') {
      if (this.activeExprLinear < desiredWeight) {
        this.activeExprLinear = Math.min(desiredWeight, this.activeExprLinear + fadeInSpeed * dt);
      } else if (this.activeExprLinear > desiredWeight) {
        this.activeExprLinear = Math.max(desiredWeight, this.activeExprLinear - fadeOutSpeed * dt);
      }
    } else {
      this.activeExprLinear = 0;
    }

    const activeWeight =
      this.activeExprChannel === 'none'
        ? 0
        : smoothStep(0, 1, THREE.MathUtils.clamp(this.activeExprLinear, 0, 1));

    this.currentHappy = this.activeExprChannel === 'happy' ? activeWeight : 0;
    this.currentRelaxed = this.activeExprChannel === 'relaxed' ? activeWeight : 0;
    this.currentSad = this.activeExprChannel === 'sad' ? activeWeight : 0;
    this.currentAngry = this.activeExprChannel === 'angry' ? activeWeight : 0;
    this.currentSurprised = this.activeExprChannel === 'surprised' ? activeWeight : 0;
    this.currentWink = this.activeExprChannel === 'blinkLeft' ? activeWeight : 0;

    // Smooth cheek blush fade-in / fade-out
    const sofaFsmBlush =
      this.sofaTvState === 'shoulder_rest'
        ? 0.44
        : this.sofaTvState === 'scoot_closer'
          ? 0.30
          : this.sofaTvState === 'side_glance_smile'
            ? 0.28
            : this.sofaTvState === 'lean_interested'
              ? 0.14
              : this.sofaTvState === 'adjust_posture'
                ? 0.10
                : 0.06;

    const targetBlush = this.poseTuner
      ? 0
      : this.toyGunPhase === 'pout'
        ? 0.38
        : this.toyGunPhase === 'flinch'
          ? 0.24
          : this.postureState === 'greeting_wave'
            ? 0.26
            : sofaTvFsmActive
              ? sofaFsmBlush
              : isCalmIdleState
                ? 0
                : THREE.MathUtils.clamp(this.activePerformance.blush ?? 0, 0, 1);
    const snapZero = (v: number) => (v < 0.002 ? 0 : v);
    this.currentBlush = snapZero(THREE.MathUtils.damp(this.currentBlush, targetBlush, 4.8, dt));

    if (this.cheekBlushGroup && this.cheekBlushMat) {
      this.cheekBlushGroup.visible = this.currentBlush > 0.01;
      this.cheekBlushMat.opacity = this.currentBlush * 0.78;
    }

    // Direct mesh morphTarget fallback if VRM had zero vowel expression presets
    if (this.lipSyncMorphFallback.length > 0) {
      const mouthOpen = Math.max(
        this.currentVowelAa,
        this.currentVowelOh * 0.85,
        this.currentVowelOu * 0.75,
        this.currentVowelIh * 0.65,
        this.currentVowelEe * 0.65
      );
      for (let i = 0; i < this.lipSyncMorphFallback.length; i++) {
        const entry = this.lipSyncMorphFallback[i];
        if (entry.mesh.morphTargetInfluences) {
          entry.mesh.morphTargetInfluences[entry.index] = mouthOpen;
        }
      }
    }

    if (!expr) return;

    const safeSet = (name: string, val: number) => {
      if (expr.getExpression(name)) {
        expr.setValue(name, THREE.MathUtils.clamp(val, 0, 1));
      }
    };

    const setPresetWithAlias = (primary: string, alias: string, val: number) => {
      if (expr.getExpression(primary)) {
        expr.setValue(primary, THREE.MathUtils.clamp(val, 0, 1));
      } else if (expr.getExpression(alias)) {
        expr.setValue(alias, THREE.MathUtils.clamp(val, 0, 1));
      }
    };

    const setVowel = (vowel: 'aa' | 'ih' | 'ou' | 'ee' | 'oh', val: number) => {
      const names = this.lipSyncExprNames[vowel];
      if (names.length > 0) {
        for (let i = 0; i < names.length; i++) {
          safeSet(names[i], val);
        }
      } else {
        safeSet(vowel, val);
      }
    };

    // Write strictly exclusive native VRM emotion channels
    setPresetWithAlias('happy', 'joy', this.currentHappy);
    setPresetWithAlias('relaxed', 'fun', this.currentRelaxed);
    setPresetWithAlias('sad', 'sorrow', this.currentSad);
    safeSet('angry', this.currentAngry);
    safeSet('surprised', this.currentSurprised);

    setVowel('aa', this.currentVowelAa);
    setVowel('ih', this.currentVowelIh);
    setVowel('ou', this.currentVowelOu);
    setVowel('ee', this.currentVowelEe);
    setVowel('oh', this.currentVowelOh);

    // Also drive native VRM blush blendshape if the model defines one
    safeSet('blush', this.currentBlush);
    safeSet('Blush', this.currentBlush);

    if (this.activeExprChannel === 'blink') {
      this.currentBlink = activeWeight;
      safeSet('blink', activeWeight);
      setPresetWithAlias('blinkLeft', 'blink_l', 0);
      setPresetWithAlias('blinkRight', 'blink_r', 0);
    } else if (this.activeExprChannel === 'blinkLeft') {
      safeSet('blink', 0);
      setPresetWithAlias('blinkLeft', 'blink_l', activeWeight);
      setPresetWithAlias('blinkRight', 'blink_r', 0);
    } else if (!autoBlinkAllowed) {
      safeSet('blink', this.currentBlink);
      setPresetWithAlias('blinkLeft', 'blink_l', 0);
      setPresetWithAlias('blinkRight', 'blink_r', 0);
    } else {
      setPresetWithAlias('blinkLeft', 'blink_l', 0);
      setPresetWithAlias('blinkRight', 'blink_r', 0);
      this.updateRandomBlinking(vrm, dt);
    }
  }

  private updateRandomBlinking(vrm: VRM, dt: number): void {
    const expr = vrm.expressionManager;
    if (!expr) return;

    if (this.blinkElapsed >= 0) {
      this.blinkElapsed += dt;
      if (this.blinkElapsed >= this.blinkDuration) {
        this.blinkElapsed = -1;
        this.currentBlink = 0;
        expr.setValue('blink', 0);
        if (this.pendingDoubleBlink) {
          this.pendingDoubleBlink = false;
          this.blinkTimer = 0.14 + Math.random() * 0.08;
        } else {
          this.blinkTimer = 2.2 + Math.random() * 3.6;
          this.pendingDoubleBlink = Math.random() < 0.18;
        }
      } else {
        const p = this.blinkElapsed / this.blinkDuration;
        // Fast natural lid close (38%), soft open (62%)
        const v = p < 0.38 ? p / 0.38 : 1 - (p - 0.38) / 0.62;
        this.currentBlink = THREE.MathUtils.clamp(v, 0, 1);
        expr.setValue('blink', this.currentBlink);
      }
    } else {
      this.currentBlink = 0;
      expr.setValue('blink', 0);
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkElapsed = 0;
        this.blinkDuration = 0.14 + Math.random() * 0.05;
      }
    }
  }

  /**
   * Follows the current A* waypoint queue cleanly, respecting walls/furniture via `moveResolver`.
   * Returns `{ arrived, actualSpeed }`.
   */
  private advanceAlongActivePath(
    dt: number,
    desiredSpeed: number,
    arrivalThreshold: number,
    moveResolver?: HeroineMoveResolver
  ): { arrived: boolean; actualSpeed: number } {
    // Advance past already-reached intermediate waypoints
    while (this.activePath.length > 1) {
      const wp = this.activePath[0];
      if (Math.hypot(wp.x - this.root.position.x, wp.z - this.root.position.z) < 0.30) {
        this.activePath.shift();
      } else {
        break;
      }
    }

    const wp = this.activePath[0];
    if (!wp) {
      return { arrived: true, actualSpeed: 0 };
    }

    const wx = wp.x - this.root.position.x;
    const wz = wp.z - this.root.position.z;
    const wDist = Math.hypot(wx, wz);

    if (this.activePath.length === 1 && wDist <= arrivalThreshold) {
      return { arrived: true, actualSpeed: 0 };
    }

    let actualSpeed = 0;
    if (wDist > 0.02) {
      const step = Math.min(wDist, desiredSpeed * dt);
      const nextX = this.root.position.x + (wx / wDist) * step;
      const nextZ = this.root.position.z + (wz / wDist) * step;
      const prevX = this.root.position.x;
      const prevZ = this.root.position.z;

      if (moveResolver) {
        const resolved = moveResolver(prevX, prevZ, nextX, nextZ, this.root.position.y);
        this.root.position.set(resolved.x, resolved.y, resolved.z);
      } else {
        this.root.position.set(nextX, this.root.position.y, nextZ);
      }

      const moved = Math.hypot(this.root.position.x - prevX, this.root.position.z - prevZ);
      actualSpeed = dt > 1e-4 ? moved / dt : 0;

      const targetYaw = Math.atan2(wx, wz);
      const yawDelta = shortestAngleDelta(this.root.rotation.y, targetYaw);
      this.root.rotation.y += yawDelta * Math.min(1, dt * 8.2);
    }

    return { arrived: false, actualSpeed };
  }

  /**
   * Applies Tier-3 body-turn hysteresis: torso stays completely still for small/medium player
   * movements (handled by eyes + head), and only rotates smoothly when the player moves far
   * out of front view (`startAngleRad`), stopping once comfortably realigned (`stopAngleRad`).
   */
  private applyTieredBodyTurn(
    dt: number,
    targetX: number,
    targetZ: number,
    startAngleRad: number,
    stopAngleRad: number,
    turnRate = 3.8
  ): void {
    const dx = targetX - this.root.position.x;
    const dz = targetZ - this.root.position.z;
    if (Math.hypot(dx, dz) < 0.16) {
      this.isTurningInPlace = false;
      return;
    }

    const desiredYaw = Math.atan2(dx, dz);
    const yawDiff = shortestAngleDelta(this.root.rotation.y, desiredYaw);
    const absDiff = Math.abs(yawDiff);

    if (!this.isTurningInPlace && absDiff > startAngleRad) {
      this.isTurningInPlace = true;
    } else if (this.isTurningInPlace && absDiff < stopAngleRad) {
      this.isTurningInPlace = false;
    }

    if (this.isTurningInPlace) {
      const maxStep = turnRate * dt;
      const step = THREE.MathUtils.clamp(yawDiff * Math.min(1, dt * 5.2), -maxStep, maxStep);
      this.root.rotation.y += step;
    }
  }

  /**
   * Obstacle-avoiding A* player follower with larger comfortable follow distance (`2.85m` start / `1.75m` stop),
   * smooth `walk.fbx` <-> `idle.fbx` cross-fade, and natural tiered gaze when stopped.
   */
  private updateFollowingPlayer(
    vrm: VRM,
    dt: number,
    elapsed: number,
    playerFeetPos: THREE.Vector3,
    moveResolver?: HeroineMoveResolver
  ): void {
    if (this.seatedColliders.length > 0) {
      this.restoreStandingSkirtPhysics();
    }

    const dxPlayer = playerFeetPos.x - this.root.position.x;
    const dzPlayer = playerFeetPos.z - this.root.position.z;
    const distToPlayer = Math.hypot(dxPlayer, dzPlayer);
    const dyPlayer = Math.abs(playerFeetPos.y - this.root.position.y);

    // Graceful teleport catch-up if player fast-travels across the apartment via HUD
    if (distToPlayer > FOLLOW_TELEPORT_DIST || dyPlayer > 2.2) {
      const backX = distToPlayer > 0.01 ? -dxPlayer / distToPlayer : 0;
      const backZ = distToPlayer > 0.01 ? -dzPlayer / distToPlayer : 1;
      const destX = playerFeetPos.x + backX * 1.55;
      const destZ = playerFeetPos.z + backZ * 1.55;
      if (moveResolver) {
        const resolved = moveResolver(
          playerFeetPos.x,
          playerFeetPos.z,
          destX,
          destZ,
          playerFeetPos.y
        );
        this.root.position.set(resolved.x, resolved.y, resolved.z);
      } else {
        this.root.position.set(destX, playerFeetPos.y, destZ);
      }
      this.activePath = [];
      this.lastPlannedGoal.set(999, 0, 999);
      this.isFollowMoving = false;
      this.followStuckTimer = 0;
    }

    // Generous hysteresis so she gives the protagonist breathing space
    if (!this.isFollowMoving && distToPlayer > FOLLOW_START_DIST) {
      this.isFollowMoving = true;
      this.walkStartElapsed = 0;
      this.isTurningInPlace = false;
      this.planPathTo(playerFeetPos.x, playerFeetPos.z, this.root.position.y);
    } else if (this.isFollowMoving && distToPlayer < FOLLOW_STOP_DIST) {
      this.isFollowMoving = false;
      this.followStuckTimer = 0;
      this.activePath = [];
    }

    if (this.isFollowMoving) {
      this.walkUpperBodyStyle = 'normal';
      this.walkStartElapsed += dt;
      this.pathReplanTimer -= dt;
      const goalMoved = Math.hypot(
        playerFeetPos.x - this.lastPlannedGoal.x,
        playerFeetPos.z - this.lastPlannedGoal.z
      );
      if (this.pathReplanTimer <= 0 || goalMoved > 0.70 || this.activePath.length === 0) {
        this.planPathTo(playerFeetPos.x, playerFeetPos.z, this.root.position.y);
      }

      const startRamp = smoothStep(0.08, 0.34, this.walkStartElapsed);
      const desiredSpeed =
        THREE.MathUtils.clamp(1.28 + Math.max(0, distToPlayer - 2.4) * 0.40, 1.18, 2.35) *
        startRamp;
      const { actualSpeed } = this.advanceAlongActivePath(
        dt,
        desiredSpeed,
        0.22,
        moveResolver
      );

      if (actualSpeed < 0.14 && this.walkStartElapsed > 0.42 && distToPlayer > FOLLOW_STOP_DIST + 0.35) {
        this.followStuckTimer += dt;
        if (this.followStuckTimer > 0.65) {
          this.planPathTo(playerFeetPos.x, playerFeetPos.z, this.root.position.y);
          this.followStuckTimer = 0;
        }
      } else {
        this.followStuckTimer = 0;
      }

      const animSpeed = Math.max(actualSpeed, 0.42);
      if (!this.applyMixamoLocomotion(vrm, dt, true, animSpeed)) {
        if (this.activePoseDriver !== 'procedural_walk') {
          this.beginPoseDriverTransition('procedural_walk', 0.28);
          this.smoothedBoneEuler.clear();
          this.zeroLocomotionMixerWeights();
        }
        this.walkPhase += dt * animSpeed * 6.4;
        this.applyProceduralWalkPose(vrm, dt, elapsed);
      }
    } else {
      // Stopped at comfortable distance: only pivot torso if player walks far off-axis (> 60 deg)
      this.applyTieredBodyTurn(
        dt,
        playerFeetPos.x,
        playerFeetPos.z,
        THREE.MathUtils.degToRad(62),
        THREE.MathUtils.degToRad(16),
        3.1
      );
      if (!this.applyMixamoLocomotion(vrm, dt, false, 0)) {
        if (this.activePoseDriver !== 'procedural_standing') {
          this.beginPoseDriverTransition('procedural_standing', 0.30);
          this.smoothedBoneEuler.clear();
          this.zeroLocomotionMixerWeights();
        }
        this.applyStandingGesturePose(vrm, dt, elapsed, HEROINE_POSES.idle, false);
      }
    }
  }

  public update(
    dt: number,
    elapsed: number,
    playerEyeWorldPos: THREE.Vector3,
    playerRoom: RoomId,
    playerFeetWorldPos?: THREE.Vector3,
    moveResolver?: HeroineMoveResolver
  ): void {
    if (!this.vrm || !this.spawned) {
      this.root.visible = false;
      return;
    }

    this.root.visible = true;
    const safeDt = Math.min(dt, 0.05);
    const prevRootYaw = this.root.rotation.y;

    // Tick active dialogue room-glance timer (looks at corner, pauses, then returns to player)
    if (this.roomGlanceRemaining > 0 && !this.poseTuner) {
      this.roomGlanceRemaining = Math.max(0, this.roomGlanceRemaining - safeDt);
      if (this.roomGlanceRemaining <= 0 && this.onRoomGlanceDone) {
        const cb = this.onRoomGlanceDone;
        this.onRoomGlanceDone = null;
        cb();
      }
    }

    // 1. Real-time Pose Tuner override (highest priority when active in bottom-left debug panel)
    if (this.poseTuner) {
      this.zeroLocomotionMixerWeights();
      if (this.poseTuner.poseId === 'seated') {
        this.beginPoseDriverTransition('seated', 0.22);
        this.applyProceduralSeatedPose(this.vrm, elapsed, 1, this.poseTuner.pose);
      } else {
        if (this.activePoseDriver !== 'procedural_standing') {
          this.beginPoseDriverTransition('procedural_standing', 0.22);
          this.smoothedBoneEuler.clear();
        }
        if (this.seatedColliders.length > 0) {
          this.restoreStandingSkirtPhysics();
        }
        const dx = playerEyeWorldPos.x - this.root.position.x;
        const dz = playerEyeWorldPos.z - this.root.position.z;
        if (Math.hypot(dx, dz) > 0.15) {
          const targetYaw = Math.atan2(dx, dz);
          const yawDelta = shortestAngleDelta(this.root.rotation.y, targetYaw);
          this.root.rotation.y += yawDelta * Math.min(1, safeDt * 5.2);
        }
        this.applyStandingGesturePose(
          this.vrm,
          safeDt,
          elapsed,
          this.poseTuner.pose,
          this.poseTuner.animateWave
        );
      }
    } else if (this.postureState === 'seated') {
      this.beginPoseDriverTransition('seated', 0.32);
      this.zeroLocomotionMixerWeights();
      this.applyProceduralSeatedPose(this.vrm, elapsed, 1);
    } else if (this.postureState === 'standing_up') {
      this.beginPoseDriverTransition('standing_up', 0.24);
      this.zeroLocomotionMixerWeights();
      this.standUpProgress = Math.min(1, this.standUpProgress + safeDt / this.standUpDuration);
      const t = this.standUpProgress;

      // 2nd-Order Physics-Damped Biomechanical Stand-Up:
      // 1) Strict sagittal alignment along `standUpStartYaw` -> ZERO lateral drift.
      // 2) Stage 1 (t=0..0.36): Center of Mass (COM) shifts forward over feet with trunk lean BEFORE vertical rise,
      //    while forefoot/toes contact floorboards and build subtle ground reaction pressure.
      // 3) Stage 2 (t=0.36..0.78): Synchronized leg-drive push-off AFTER COM is stabilized forward.
      // 4) Stage 3 (t=0.78..1.00): Critically damped physics cushion absorbs vertical inertia cleanly into standing.
      const fwdX = Math.sin(this.standUpStartYaw);
      const fwdZ = Math.cos(this.standUpStartYaw);
      this.root.rotation.y = this.standUpStartYaw;

      const p1 = smoothStep(0.0, 0.36, t);
      const p2 = smoothStep(0.36, 0.78, t);
      const p3 = smoothStep(0.76, 1.0, t);

      const targetForwardShift =
        t < 0.36
          ? this.standUpForwardDist * 0.64 * p1
          : this.standUpForwardDist * (0.64 + 0.36 * smoothStep(0.36, 0.84, t));

      // Heavily damped 2nd-order spring for COM sagittal shift (zero overshoot or residual slide)
      const accelCom = 116.0 * (targetForwardShift - this.standUpComFwd) - 24.0 * this.standUpComVelFwd;
      this.standUpComVelFwd += accelCom * safeDt;
      this.standUpComFwd = THREE.MathUtils.clamp(
        this.standUpComFwd + this.standUpComVelFwd * safeDt,
        0,
        this.standUpForwardDist
      );

      // Keep vertical sitBlend low until COM shifts squarely forward onto feet (t >= 0.36)
      const sitBlend =
        t < 0.36
          ? THREE.MathUtils.lerp(1.0, 0.84, p1)
          : t < 0.78
            ? THREE.MathUtils.lerp(0.84, 0.04, Math.pow(p2, 0.92))
            : THREE.MathUtils.lerp(0.04, 0.0, p3);

      const forwardLean =
        t < 0.36
          ? 0.56 * smoothStep(0.0, 0.32, t)
          : t < 0.78
            ? THREE.MathUtils.lerp(0.56, 0.14, p2)
            : THREE.MathUtils.lerp(0.14, 0.0, p3);

      // Ground reaction & foot pressure feedback
      const toePreload = smoothStep(0.06, 0.36, t);
      const pushEnv = Math.sin(p2 * Math.PI);
      const settleEnv = Math.sin(p3 * Math.PI);
      this.standUpGroundLoad = THREE.MathUtils.clamp(toePreload * 0.45 + pushEnv * 0.85, 0, 1);

      const targetKneeCushion =
        0.065 * Math.sin(smoothStep(0.20, 0.44, t) * Math.PI) +
        0.048 * settleEnv;
      const accelKnee = 122.0 * (targetKneeCushion - this.standUpKneeSpring) - 19.5 * this.standUpKneeVel;
      this.standUpKneeVel += accelKnee * safeDt;
      this.standUpKneeSpring += this.standUpKneeVel * safeDt;

      const reachR = smoothStep(0.03, 0.28, t);
      const reachL = smoothStep(0.06, 0.32, t);
      const toeTouchWindow = Math.sin(smoothStep(0.10, 0.44, t) * Math.PI);
      const settleTapEnv = Math.sin(smoothStep(0.74, 0.98, t) * Math.PI);

      const footwork: StandUpFootworkState = {
        hipRoll: -0.014 * Math.sin(p1 * Math.PI) + 0.016 * pushEnv - 0.010 * settleEnv,
        leftHipPitchAdd: -0.04 * Math.sin(reachL * Math.PI) - this.standUpKneeSpring * 0.45,
        rightHipPitchAdd: 0.035 * Math.sin(reachR * Math.PI) - this.standUpKneeSpring * 0.45,
        leftKneeAdd: 0.05 * Math.sin(reachL * Math.PI) + this.standUpKneeSpring,
        rightKneeAdd: -0.03 * Math.sin(reachR * Math.PI) + this.standUpKneeSpring + 0.025 * settleTapEnv,
        leftAnklePitch:
          0.16 * Math.sin(reachL * Math.PI) - 0.19 * pushEnv - this.standUpKneeSpring * 0.65,
        rightAnklePitch:
          0.18 * Math.sin(reachR * Math.PI) -
          0.18 * pushEnv -
          this.standUpKneeSpring * 0.65 +
          0.05 * settleTapEnv,
        leftAnkleRoll: 0.014 * pushEnv,
        rightAnkleRoll: -0.014 * pushEnv + 0.012 * settleTapEnv,
        leftToesPitch: -0.24 * toeTouchWindow - 0.14 * this.standUpGroundLoad,
        rightToesPitch: -0.26 * toeTouchWindow - 0.14 * this.standUpGroundLoad - 0.08 * settleTapEnv,
        armPushBrace: Math.sin(smoothStep(0.04, 0.58, t) * Math.PI),
      };

      const posX = BEDROOM_BED_SEAT_ANCHOR.x + fwdX * this.standUpComFwd;
      const posZ = BEDROOM_BED_SEAT_ANCHOR.z + fwdZ * this.standUpComFwd;

      this.applyProceduralSeatedPose(
        this.vrm,
        elapsed,
        sitBlend,
        undefined,
        forwardLean,
        footwork
      );

      // Dynamic floor-contact pelvis solver + planted-foot XZ lock (zero foot slip)
      this.root.position.set(posX, 0, posZ);
      this.vrm.humanoid.update();
      this.root.updateMatrixWorld(true);

      let lowestFootOffset = 0;
      let finalPosX = posX;
      let finalPosZ = posZ;
      const lFootNode = this.vrm.humanoid.getNormalizedBoneNode('leftFoot');
      const rFootNode = this.vrm.humanoid.getNormalizedBoneNode('rightFoot');
      if (lFootNode && rFootNode) {
        lFootNode.getWorldPosition(_leftLegWorldPos);
        rFootNode.getWorldPosition(_rightLegWorldPos);
        lowestFootOffset = Math.min(
          _leftLegWorldPos.y - this.vrmStandingFootHeight,
          _rightLegWorldPos.y - this.vrmStandingFootHeight
        );
        if (t >= 0.20) {
          const avgFootX = (_leftLegWorldPos.x + _rightLegWorldPos.x) * 0.5;
          const avgFootZ = (_leftLegWorldPos.z + _rightLegWorldPos.z) * 0.5;
          if (!this.standUpPlantedCaptured) {
            this.standUpPlantedFootWorld.set(avgFootX, 0, avgFootZ);
            this.standUpPlantedCaptured = true;
          } else {
            const errSag =
              (this.standUpPlantedFootWorld.x - avgFootX) * fwdX +
              (this.standUpPlantedFootWorld.z - avgFootZ) * fwdZ;
            const pinFade = 1 - smoothStep(0.92, 1.0, t);
            const pinFwd = THREE.MathUtils.clamp(errSag, -0.18, 0.18) * pinFade;
            finalPosX = posX + fwdX * pinFwd;
            finalPosZ = posZ + fwdZ * pinFwd;
          }
        }
      }
      if (this.hasStandingToesBone) {
        const lToesNode = this.vrm.humanoid.getNormalizedBoneNode('leftToes');
        const rToesNode = this.vrm.humanoid.getNormalizedBoneNode('rightToes');
        if (lToesNode && rToesNode) {
          lToesNode.getWorldPosition(_leftLegWorldPos);
          rToesNode.getWorldPosition(_rightLegWorldPos);
          lowestFootOffset = Math.min(
            lowestFootOffset,
            _leftLegWorldPos.y - this.vrmStandingToesHeight,
            _rightLegWorldPos.y - this.vrmStandingToesHeight
          );
        }
      }

      const groundLockedRootY = THREE.MathUtils.clamp(-lowestFootOffset, -0.55, 0.06);
      // Slight ground-pressure preload dip before vertical push-off (`t < 0.36`)
      const bedSupportY = THREE.MathUtils.lerp(
        this.seatedRootY,
        this.seatedRootY - 0.018,
        smoothStep(0.06, 0.34, t)
      );
      const targetRootY =
        t < 0.36
          ? Math.max(bedSupportY, groundLockedRootY)
          : THREE.MathUtils.lerp(
              Math.max(bedSupportY, groundLockedRootY),
              groundLockedRootY,
              smoothStep(0.36, 0.48, t)
            );

      // Critically damped spring buffer on vertical pelvis lift for organic foot-ground push-off
      const accelY = 132.0 * (targetRootY - this.standUpPelvisY) - 22.0 * this.standUpPelvisVelY;
      this.standUpPelvisVelY += accelY * safeDt;
      this.standUpPelvisY += this.standUpPelvisVelY * safeDt;
      // Never penetrate floor below ground-locked contact, and converge cleanly to y=0 at settle
      const dampedY = Math.max(this.standUpPelvisY, groundLockedRootY - 0.004);
      this.standUpPelvisY = dampedY;
      const settledY = THREE.MathUtils.lerp(dampedY, 0, smoothStep(0.78, 1.0, t));

      this.root.position.set(finalPosX, settledY, finalPosZ);

      // Keep seated colliders smoothly guiding the skirt off the mattress until knees straighten past 75%
      if (sitBlend > 0.25 && this.seatedColliders.length > 0) {
        this.setSeatedSkirtSlideDamping(true);
        this.positionSeatedColliders(Math.min(1, sitBlend));
        this.updateSeatedSkirtWorldGravity();
      } else if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }

      if (this.standUpProgress >= 1) {
        if (this.seatedColliders.length > 0) {
          this.restoreStandingSkirtPhysics();
        }
        this.standUpComVelFwd = 0;
        this.standUpPelvisVelY = 0;
        // Keep exact settled sagittal stand-off position (zero teleport snap!)
        this.root.position.set(finalPosX, 0, finalPosZ);
        if (playerFeetWorldPos && playerRoom === 'bedroom') {
          const rdx = this.root.position.x - playerFeetWorldPos.x;
          const rdz = this.root.position.z - playerFeetWorldPos.z;
          const rLen = Math.max(0.01, Math.hypot(rdx, rdz));
          const gx = THREE.MathUtils.clamp(
            playerFeetWorldPos.x + (rdx / rLen) * 1.24,
            BEDROOM_WALK_MIN_X,
            BEDROOM_WALK_MAX_X
          );
          const gz = THREE.MathUtils.clamp(
            playerFeetWorldPos.z + (rdz / rLen) * 1.24,
            BEDROOM_WALK_MIN_Z,
            BEDROOM_WALK_MAX_Z
          );
          this.walkTargetPos.set(gx, 0, gz);
        }

        // Seed bone dampers cleanly at relaxed standing idle (NEVER clear to T-pose!)
        this.seedSmoothedBonesToIdle();
        const distToGoal = Math.hypot(
          this.walkTargetPos.x - this.root.position.x,
          this.walkTargetPos.z - this.root.position.z
        );
        const distToPlayerFeet =
          playerFeetWorldPos && playerRoom === 'bedroom'
            ? Math.hypot(
                playerFeetWorldPos.x - this.root.position.x,
                playerFeetWorldPos.z - this.root.position.z
              )
            : Infinity;

        // If already comfortably close (~< 0.94m from goal or player within ~1.65m), transition
        // smoothly into in-place greeting_wave with both feet planted instead of a micro-slide step!
        if (distToGoal < 0.94 || (distToPlayerFeet >= 0.85 && distToPlayerFeet < 1.65)) {
          this.triggerPoseCrossFade(0.42);
          this.postureState = 'greeting_wave';
          this.greetingWaveElapsed = 0;
          this.greetingWaveDuration = 2.15;
          this.gestureElapsed = 0;
          this.standingGestureBlend = 0;
          this.isTurningInPlace = true;
          if (!this.actions.idle) {
            this.beginPoseDriverTransition('procedural_standing', 0.36);
            this.zeroLocomotionMixerWeights();
          }
        } else {
          this.planPathTo(this.walkTargetPos.x, this.walkTargetPos.z, 0);
          this.postureState = 'walking_to_player';
          this.walkPhase = 0;
          this.walkStartElapsed = 0;
        }
      }
    } else if (this.postureState === 'walking_to_player') {
      if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }
      // Dynamically adjust approach target if the player moves around the bedroom!
      if (playerFeetWorldPos && playerRoom === 'bedroom') {
        const distPlayerToGoal = Math.hypot(
          playerFeetWorldPos.x - this.walkTargetPos.x,
          playerFeetWorldPos.z - this.walkTargetPos.z
        );
        if (distPlayerToGoal > 1.75 || distPlayerToGoal < 0.85) {
          const rdx = this.root.position.x - playerFeetWorldPos.x;
          const rdz = this.root.position.z - playerFeetWorldPos.z;
          const rLen = Math.max(0.01, Math.hypot(rdx, rdz));
          const gx = THREE.MathUtils.clamp(
            playerFeetWorldPos.x + (rdx / rLen) * 1.24,
            BEDROOM_WALK_MIN_X,
            BEDROOM_WALK_MAX_X
          );
          const gz = THREE.MathUtils.clamp(
            playerFeetWorldPos.z + (rdz / rLen) * 1.24,
            BEDROOM_WALK_MIN_Z,
            BEDROOM_WALK_MAX_Z
          );
          this.walkTargetPos.set(gx, 0, gz);
          this.pathReplanTimer -= safeDt;
          if (this.pathReplanTimer <= 0) {
            this.planPathTo(gx, gz, 0);
          }
        }
      }

      this.walkStartElapsed += safeDt;
      const startRamp = smoothStep(0.08, 0.34, this.walkStartElapsed);
      const distGoal = Math.hypot(
        this.walkTargetPos.x - this.root.position.x,
        this.walkTargetPos.z - this.root.position.z
      );
      const walkSpeed =
        Math.min(1.26, Math.max(0.72, distGoal * 1.48)) * startRamp;
      const { arrived, actualSpeed } = this.advanceAlongActivePath(
        safeDt,
        walkSpeed,
        0.16,
        moveResolver
      );

      if (arrived || distGoal <= 0.16) {
        this.root.position.y = 0;
        // Transition seamlessly into gentle greeting_wave without clearing smoothed bones!
        this.triggerPoseCrossFade(0.42);
        this.postureState = 'greeting_wave';
        this.greetingWaveElapsed = 0;
        this.greetingWaveDuration = 2.15;
        this.gestureElapsed = 0;
        this.standingGestureBlend = 0;
        this.isTurningInPlace = true;
        if (this.actions.idle) {
          this.applyMixamoLocomotion(this.vrm, safeDt, false, 0);
        } else {
          if (this.activePoseDriver !== 'procedural_standing') {
            this.beginPoseDriverTransition('procedural_standing', 0.36);
            this.zeroLocomotionMixerWeights();
          }
          this.applyStandingGesturePose(
            this.vrm,
            safeDt,
            elapsed,
            HEROINE_POSES.wave,
            true,
            false,
            0
          );
        }
      } else {
        const animSpeed = Math.max(actualSpeed, 0.42);
        if (!this.applyMixamoLocomotion(this.vrm, safeDt, true, animSpeed)) {
          if (this.activePoseDriver !== 'procedural_walk') {
            this.beginPoseDriverTransition('procedural_walk', 0.26);
            this.seedSmoothedBonesToIdle();
            this.zeroLocomotionMixerWeights();
          }
          this.walkPhase += safeDt * animSpeed * 6.4;
          this.applyProceduralWalkPose(this.vrm, safeDt, elapsed);
        }
      }
    } else if (this.postureState === 'greeting_wave') {
      // Smooth continuous greeting wave (0..0.42s raise -> 0.42..1.48s cheerful wave -> 1.48..2.15s lower smoothly)
      if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }
      this.root.position.y = 0;
      this.greetingWaveElapsed += safeDt;

      // Gently turn smoothly to face the player while waving hello
      const gx = playerEyeWorldPos.x - this.root.position.x;
      const gz = playerEyeWorldPos.z - this.root.position.z;
      if (Math.hypot(gx, gz) > 0.2) {
        const desiredYaw = Math.atan2(gx, gz);
        const diff = shortestAngleDelta(this.root.rotation.y, desiredYaw);
        this.root.rotation.y += THREE.MathUtils.clamp(diff * Math.min(1, safeDt * 5.2), -2.6 * safeDt, 2.6 * safeDt);
      }

      const wavePose = HEROINE_POSES.wave;
      const gt = this.greetingWaveElapsed;
      const waveBlend =
        gt < 0.42
          ? smoothStep(0, 0.42, gt)
          : gt < 1.48
            ? 1.0
            : 1.0 - smoothStep(1.48, 2.08, gt);

      this.standingGestureBlend = THREE.MathUtils.damp(this.standingGestureBlend, waveBlend, 8.5, safeDt);
      const waveOsc = Math.sin(Math.max(0, gt - 0.16) * (wavePose.waveMotion?.speed ?? 6.8)) * this.standingGestureBlend;

      if (this.actions.idle) {
        this.applyMixamoLocomotion(this.vrm, safeDt, false, 0);
        if (this.standingGestureBlend > 0.005) {
          this.layerUpperBodyPose(this.vrm, wavePose, this.standingGestureBlend, 'right', waveOsc);
        }
      } else {
        if (this.activePoseDriver !== 'procedural_standing') {
          this.beginPoseDriverTransition('procedural_standing', 0.34);
          this.seedSmoothedBonesToIdle();
          this.zeroLocomotionMixerWeights();
        }
        // Pass isTuningOverride=false + externalWaveBlend so arm lifts smoothly from relaxed idle (never snaps!)
        this.applyStandingGesturePose(
          this.vrm,
          safeDt,
          elapsed,
          wavePose,
          gt < 1.65,
          false,
          this.standingGestureBlend
        );
      }

      if (this.greetingWaveElapsed >= this.greetingWaveDuration) {
        this.triggerPoseCrossFade(0.46);
        this.postureState = 'standing_talking';
        this.gestureElapsed = 0;
        this.standingGestureBlend = 0;
        const cb = this.onWalkArrived;
        this.onWalkArrived = null;
        cb?.();
      }
    } else if (this.postureState === 'dialogue_walking') {
      if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }
      this.walkStartElapsed += safeDt;
      const startRamp = smoothStep(0.08, 0.32, this.walkStartElapsed);
      const distGoal = Math.hypot(
        this.walkTargetPos.x - this.root.position.x,
        this.walkTargetPos.z - this.root.position.z
      );
      const desiredSpeed =
        (this.walkUpperBodyStyle === 'arms_crossed' ? 1.08 : 1.24) * startRamp;
      const { arrived, actualSpeed } = this.advanceAlongActivePath(
        safeDt,
        desiredSpeed,
        0.16,
        moveResolver
      );

      // Fail-safe against tight furniture stall during staged walk
      if (actualSpeed < 0.08 && this.walkStartElapsed > 0.42 && !arrived) {
        this.followStuckTimer += safeDt;
      } else {
        this.followStuckTimer = 0;
      }

      if (arrived || distGoal <= 0.16 || this.followStuckTimer > 1.35) {
        this.followStuckTimer = 0;
        const cb = this.onStageWalkArrived;
        this.onStageWalkArrived = null;
        cb?.();
        // Render one clean resting frame before next tick (cb may transition postureState)
        const postArriveState = this.postureState as HeroinePostureState;
        if (postArriveState === 'sitting_down_chair') {
          this.applyChairSeatedPose(this.vrm, safeDt, elapsed, 0);
        } else if (this.actions.idle) {
          this.applyMixamoLocomotion(this.vrm, safeDt, false, 0);
          this.applyLayeredDialogueOnIdle(this.vrm, safeDt, elapsed);
        } else {
          if (this.activePoseDriver !== 'procedural_standing') {
            this.beginPoseDriverTransition('procedural_standing', 0.42);
            this.seedSmoothedBonesToIdle();
            this.zeroLocomotionMixerWeights();
          }
          this.applyStandingGesturePose(this.vrm, safeDt, elapsed);
        }
      } else {
        const animSpeed = Math.max(actualSpeed, 0.42);
        if (!this.applyMixamoLocomotion(this.vrm, safeDt, true, animSpeed)) {
          if (this.activePoseDriver !== 'procedural_walk') {
            this.beginPoseDriverTransition('procedural_walk', 0.36);
            this.seedSmoothedBonesToIdle();
            this.zeroLocomotionMixerWeights();
          }
          this.walkPhase += safeDt * animSpeed * 6.4;
          this.applyProceduralWalkPose(this.vrm, safeDt, elapsed);
          if (this.walkUpperBodyStyle === 'arms_crossed') {
            this.layerUpperBodyPose(this.vrm, HEROINE_POSES.arms_crossed, 1.0);
          }
        }
      }
    } else if (this.postureState === 'sitting_down_chair') {
      this.beginPoseDriverTransition('seated', 0.26);
      this.zeroLocomotionMixerWeights();
      this.chairTransitionProgress = Math.min(
        1,
        this.chairTransitionProgress + safeDt / this.chairTransitionDuration
      );
      const t = this.chairTransitionProgress;
      // Natural sit-down arc: position back over seat while knees bend & torso leans forward to balance
      const xzEase = smoothStep(0.04, 0.78, t);
      const sitBlend = smoothStep(0.0, 1.0, t);
      const yEase = Math.pow(sitBlend, 1.15);
      const forwardLean = Math.sin(sitBlend * Math.PI) * 0.34;

      const chair = this.bedroomChair;
      const cx = chair ? chair.rootGroup.position.x : this.chairStandStartPos.x;
      const cz = chair ? chair.rootGroup.position.z : this.chairStandStartPos.z;
      const targetX = cx + Math.sin(this.chairFaceYaw) * 0.04;
      const targetZ = cz + Math.cos(this.chairFaceYaw) * 0.04;

      this.root.position.set(
        THREE.MathUtils.lerp(this.chairStandStartPos.x, targetX, xzEase),
        THREE.MathUtils.lerp(this.chairStandStartPos.y, this.chairSeatRootY, yEase),
        THREE.MathUtils.lerp(this.chairStandStartPos.z, targetZ, xzEase)
      );

      const yawDiff = shortestAngleDelta(this.root.rotation.y, this.chairFaceYaw);
      this.root.rotation.y += yawDiff * Math.min(1, safeDt * 6.4);

      if (chair) {
        const chairSeatTargetYaw = this.chairFaceYaw + Math.PI;
        const chairYawDiff = shortestAngleDelta(chair.seatGroup.rotation.y, chairSeatTargetYaw);
        chair.seatGroup.rotation.y += chairYawDiff * Math.min(1, safeDt * 5.8);
      }

      this.setSeatedSkirtSlideDamping(true);
      this.positionSeatedColliders(sitBlend);
      this.updateSeatedSkirtWorldGravity();
      this.applyChairSeatedPose(this.vrm, safeDt, elapsed, sitBlend, forwardLean);

      if (this.chairTransitionProgress >= 1) {
        this.root.position.set(targetX, this.chairSeatRootY, targetZ);
        this.root.rotation.y = this.chairFaceYaw;
        this.settleSeatedSkirtCalmly(10);
        this.postureState = 'seated_chair';
        const cb = this.onChairTransitionDone;
        this.onChairTransitionDone = null;
        cb?.();
      }
    } else if (this.postureState === 'seated_chair') {
      this.beginPoseDriverTransition('seated', 0.30);
      this.zeroLocomotionMixerWeights();
      this.gestureElapsed += safeDt;

      const chair = this.bedroomChair;
      if (chair) {
        if (this.bedroomIdleChairWaitActive && this.toyGunPhase === 'none') {
          // Cycle through cute time-passing micro-actions while waiting on the bedroom swivel chair
          this.chairBoredomElapsed += safeDt;
          if (this.chairBoredomElapsed >= this.chairBoredomDuration) {
            const states: Array<'idle_sway' | 'swivel_play' | 'look_around' | 'chin_rest' | 'kick_feet'> = [
              'swivel_play',
              'look_around',
              'chin_rest',
              'kick_feet',
              'idle_sway',
            ];
            const candidates = states.filter((st) => st !== this.chairBoredomState);
            this.chairBoredomState = candidates[Math.floor(Math.random() * candidates.length)];
            this.chairBoredomElapsed = 0;
            this.chairBoredomDuration = 4.2 + Math.random() * 2.8;
            this.chairBoredomSwivelDir = Math.random() < 0.5 ? 1 : -1;
            if (this.chairBoredomState === 'look_around') {
              const pts = [
                BEDROOM_GLANCE_TARGETS.window,
                BEDROOM_GLANCE_TARGETS.desk,
                BEDROOM_GLANCE_TARGETS.door,
                BEDROOM_GLANCE_TARGETS.bookshelf,
              ];
              this.chairBoredomLookPoint.copy(pts[Math.floor(Math.random() * pts.length)]);
            }
          }

          if (this.chairBoredomState === 'swivel_play') {
            const targetYaw =
              this.chairBoredomBaseYaw +
              Math.sin(elapsed * 1.15) * 0.42 * this.chairBoredomSwivelDir;
            const diff = shortestAngleDelta(this.root.rotation.y, targetYaw);
            this.root.rotation.y += diff * Math.min(1, safeDt * 3.4);
          } else {
            const diff = shortestAngleDelta(this.root.rotation.y, this.chairBoredomBaseYaw);
            this.root.rotation.y += diff * Math.min(1, safeDt * 2.4);
          }
        } else {
          const dx = playerEyeWorldPos.x - chair.rootGroup.position.x;
          const dz = playerEyeWorldPos.z - chair.rootGroup.position.z;
          if (this.roomGlanceRemaining <= 0 && Math.hypot(dx, dz) > 0.2) {
            const desiredYaw = Math.atan2(dx, dz);
            const diff = shortestAngleDelta(this.root.rotation.y, desiredYaw);
            if (!this.isTurningInPlace && Math.abs(diff) > THREE.MathUtils.degToRad(55)) {
              this.isTurningInPlace = true;
            } else if (this.isTurningInPlace && Math.abs(diff) < THREE.MathUtils.degToRad(14)) {
              this.isTurningInPlace = false;
            }
            if (this.isTurningInPlace) {
              const step = THREE.MathUtils.clamp(diff * Math.min(1, safeDt * 3.8), -2.1 * safeDt, 2.1 * safeDt);
              this.root.rotation.y += step;
            }
          }
        }
        this.root.position.set(
          chair.rootGroup.position.x + Math.sin(this.root.rotation.y) * 0.04,
          this.chairSeatRootY,
          chair.rootGroup.position.z + Math.cos(this.root.rotation.y) * 0.04
        );
        const chairSeatTarget = this.root.rotation.y + Math.PI;
        const chairDiff = shortestAngleDelta(chair.seatGroup.rotation.y, chairSeatTarget);
        chair.seatGroup.rotation.y += chairDiff * Math.min(1, safeDt * 7.5);
      }

      this.positionSeatedColliders(1);
      this.updateSeatedSkirtWorldGravity();
      this.applyChairSeatedPose(this.vrm, safeDt, elapsed, 1);
    } else if (this.postureState === 'standing_up_chair') {
      this.beginPoseDriverTransition('standing_up', 0.22);
      this.zeroLocomotionMixerWeights();
      this.chairTransitionProgress = Math.min(
        1,
        this.chairTransitionProgress + safeDt / this.chairTransitionDuration
      );
      const t = this.chairTransitionProgress;
      const p1 = smoothStep(0.0, 0.34, t);
      const p2 = smoothStep(0.32, 0.88, t);
      const p3 = smoothStep(0.84, 1.0, t);
      const xzEase = 0.65 * p1 + 0.35 * p2;
      const yEase = t < 0.32 ? 0.08 * p1 : 0.08 + 0.92 * smoothStep(0.32, 0.92, t);
      const sitBlend =
        t < 0.32
          ? THREE.MathUtils.lerp(1.0, 0.86, p1)
          : t < 0.88
            ? THREE.MathUtils.lerp(0.86, 0.02, p2)
            : THREE.MathUtils.lerp(0.02, 0.0, p3);
      const forwardLean =
        t < 0.34
          ? 0.48 * smoothStep(0.0, 0.32, t)
          : THREE.MathUtils.lerp(0.48, 0.0, smoothStep(0.34, 0.94, t));

      const baseX = THREE.MathUtils.lerp(this.chairStandStartPos.x, this.chairEntryPos.x, xzEase);
      const baseY = THREE.MathUtils.lerp(this.chairStandStartPos.y, this.chairEntryPos.y, yEase);
      const baseZ = THREE.MathUtils.lerp(this.chairStandStartPos.z, this.chairEntryPos.z, xzEase);
      this.root.position.set(baseX, baseY, baseZ);

      if (sitBlend > 0.30 && this.seatedColliders.length > 0) {
        this.setSeatedSkirtSlideDamping(true);
        this.positionSeatedColliders(sitBlend);
        this.updateSeatedSkirtWorldGravity();
      } else if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }
      this.applyChairSeatedPose(this.vrm, safeDt, elapsed, sitBlend, forwardLean);
      this.vrm.humanoid.update();
      this.root.updateMatrixWorld(true);

      let finalX = baseX;
      let finalZ = baseZ;
      const lFoot = this.vrm.humanoid.getNormalizedBoneNode('leftFoot');
      const rFoot = this.vrm.humanoid.getNormalizedBoneNode('rightFoot');
      if (lFoot && rFoot && t >= 0.18) {
        lFoot.getWorldPosition(_leftLegWorldPos);
        rFoot.getWorldPosition(_rightLegWorldPos);
        const avgFootX = (_leftLegWorldPos.x + _rightLegWorldPos.x) * 0.5;
        const avgFootZ = (_leftLegWorldPos.z + _rightLegWorldPos.z) * 0.5;
        if (!this.standUpPlantedCaptured) {
          this.standUpPlantedFootWorld.set(avgFootX, 0, avgFootZ);
          this.standUpPlantedCaptured = true;
        } else {
          const pinFade = 1 - smoothStep(0.90, 1.0, t);
          const dxPin = THREE.MathUtils.clamp(this.standUpPlantedFootWorld.x - avgFootX, -0.18, 0.18) * pinFade;
          const dzPin = THREE.MathUtils.clamp(this.standUpPlantedFootWorld.z - avgFootZ, -0.18, 0.18) * pinFade;
          finalX = baseX + dxPin;
          finalZ = baseZ + dzPin;
          this.root.position.set(finalX, baseY, finalZ);
        }
      }

      if (this.chairTransitionProgress >= 1) {
        if (this.seatedColliders.length > 0) {
          this.restoreStandingSkirtPhysics();
        }
        this.root.position.set(finalX, this.chairEntryPos.y, finalZ);
        this.seedSmoothedBonesToIdle();
        this.walkStartElapsed = 0;
        this.postureState = 'standing_talking';
        this.isTurningInPlace = true;
        const cb = this.onChairTransitionDone;
        this.onChairTransitionDone = null;
        cb?.();
      }
    } else if (this.postureState === 'walking_to_sofa') {
      if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }
      this.walkStartElapsed += safeDt;
      const startRamp = smoothStep(0.08, 0.32, this.walkStartElapsed);
      const { arrived, actualSpeed } = this.advanceAlongActivePath(
        safeDt,
        1.52 * startRamp,
        0.24,
        moveResolver
      );
      if (arrived) {
        this.activePath = [];
        this.startSofaSitDownTransition();
      } else if (this.actions.walk) {
        this.applyMixamoLocomotion(this.vrm, safeDt, true, Math.max(actualSpeed, 0.42));
      } else {
        if (this.activePoseDriver !== 'procedural_walk') {
          this.beginPoseDriverTransition('procedural_walk', 0.22);
          this.smoothedBoneEuler.clear();
          this.zeroLocomotionMixerWeights();
        }
        this.walkPhase += safeDt * 6.8;
        this.applyProceduralWalkPose(this.vrm, safeDt, elapsed);
      }
    } else if (this.postureState === 'sitting_down_sofa') {
      this.beginPoseDriverTransition('seated', 0.26);
      this.zeroLocomotionMixerWeights();
      this.sofaTransitionProgress = Math.min(
        1,
        this.sofaTransitionProgress + safeDt / this.sofaTransitionDuration
      );
      const t = this.sofaTransitionProgress;
      const xzEase = smoothStep(0.04, 0.78, t);
      const sitBlend = smoothStep(0.0, 1.0, t);
      const yEase = Math.pow(sitBlend, 1.15);
      const forwardLean = Math.sin(sitBlend * Math.PI) * 0.34;

      this.root.position.set(
        THREE.MathUtils.lerp(this.sofaStandStartPos.x, this.sofaSeatPos.x, xzEase),
        THREE.MathUtils.lerp(this.sofaStandStartPos.y, this.sofaSeatRootY, yEase),
        THREE.MathUtils.lerp(this.sofaStandStartPos.z, this.sofaSeatPos.z, xzEase)
      );
      const yawDiff = shortestAngleDelta(this.root.rotation.y, this.sofaFaceYaw);
      this.root.rotation.y += yawDiff * Math.min(1, safeDt * 6.8);

      this.setSeatedSkirtSlideDamping(true);
      this.positionSeatedColliders(sitBlend);
      this.updateSeatedSkirtWorldGravity();
      this.applyChairSeatedPose(this.vrm, safeDt, elapsed, sitBlend, forwardLean);

      if (this.sofaTransitionProgress >= 1) {
        this.root.position.set(this.sofaSeatPos.x, this.sofaSeatRootY, this.sofaSeatPos.z);
        this.root.rotation.y = this.sofaFaceYaw;
        this.settleSeatedSkirtCalmly(10);
        this.postureState = 'seated_sofa';
        const cb = this.onSofaTransitionDone;
        this.onSofaTransitionDone = null;
        cb?.();
      }
    } else if (this.postureState === 'seated_sofa') {
      this.beginPoseDriverTransition('seated', 0.30);
      this.zeroLocomotionMixerWeights();
      this.gestureElapsed += safeDt;
      if (this.sofaReactionTimer > 0) {
        this.sofaReactionTimer = Math.max(0, this.sofaReactionTimer - safeDt);
        if (this.sofaReactionTimer <= 0 && !this.sofaInDialogue) {
          this.activePerformance.gesture = 'idle';
          this.activePerformance.expression = 'neutral';
          this.activePerformance.blush = 0;
        }
      }
      this.updateSofaTvStateMachine(safeDt, elapsed);
      const prevZ = this.root.position.z;
      const nextZ = this.sofaSeatPos.z + this.sofaScootOffsetZ;
      this.root.position.set(this.sofaSeatPos.x, this.sofaSeatRootY, nextZ);
      const scootSpeed = Math.abs(nextZ - prevZ) / Math.max(0.001, safeDt);
      this.setSeatedSkirtSlideDamping(scootSpeed > 0.025);

      const targetSofaYaw = this.sofaFaceYaw + this.sofaScootYawOffset;
      const yawDiff = shortestAngleDelta(this.root.rotation.y, targetSofaYaw);
      this.root.rotation.y += yawDiff * Math.min(1, safeDt * 5.0);
      this.positionSeatedColliders(1);
      this.updateSeatedSkirtWorldGravity();
      this.applyChairSeatedPose(this.vrm, safeDt, elapsed, 1);
    } else if (this.postureState === 'standing_up_sofa') {
      this.beginPoseDriverTransition('standing_up', 0.22);
      this.zeroLocomotionMixerWeights();
      this.sofaTransitionProgress = Math.min(
        1,
        this.sofaTransitionProgress + safeDt / this.sofaTransitionDuration
      );
      const t = this.sofaTransitionProgress;
      const p1 = smoothStep(0.0, 0.34, t);
      const p2 = smoothStep(0.32, 0.88, t);
      const p3 = smoothStep(0.84, 1.0, t);
      const xzEase = 0.65 * p1 + 0.35 * p2;
      const yEase = t < 0.32 ? 0.08 * p1 : 0.08 + 0.92 * smoothStep(0.32, 0.92, t);
      const sitBlend =
        t < 0.32
          ? THREE.MathUtils.lerp(1.0, 0.86, p1)
          : t < 0.88
            ? THREE.MathUtils.lerp(0.86, 0.02, p2)
            : THREE.MathUtils.lerp(0.02, 0.0, p3);
      const forwardLean =
        t < 0.34
          ? 0.48 * smoothStep(0.0, 0.32, t)
          : THREE.MathUtils.lerp(0.48, 0.0, smoothStep(0.34, 0.94, t));

      const baseX = THREE.MathUtils.lerp(this.sofaStandStartPos.x, this.sofaEntryPos.x, xzEase);
      const baseY = THREE.MathUtils.lerp(this.sofaStandStartPos.y, this.sofaEntryPos.y, yEase);
      const baseZ = THREE.MathUtils.lerp(this.sofaStandStartPos.z, this.sofaEntryPos.z, xzEase);
      this.root.position.set(baseX, baseY, baseZ);

      if (sitBlend > 0.30 && this.seatedColliders.length > 0) {
        this.setSeatedSkirtSlideDamping(true);
        this.positionSeatedColliders(sitBlend);
        this.updateSeatedSkirtWorldGravity();
      } else if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }
      this.applyChairSeatedPose(this.vrm, safeDt, elapsed, sitBlend, forwardLean);
      this.vrm.humanoid.update();
      this.root.updateMatrixWorld(true);

      let finalX = baseX;
      let finalZ = baseZ;
      const lFoot = this.vrm.humanoid.getNormalizedBoneNode('leftFoot');
      const rFoot = this.vrm.humanoid.getNormalizedBoneNode('rightFoot');
      if (lFoot && rFoot && t >= 0.18) {
        lFoot.getWorldPosition(_leftLegWorldPos);
        rFoot.getWorldPosition(_rightLegWorldPos);
        const avgFootX = (_leftLegWorldPos.x + _rightLegWorldPos.x) * 0.5;
        const avgFootZ = (_leftLegWorldPos.z + _rightLegWorldPos.z) * 0.5;
        if (!this.standUpPlantedCaptured) {
          this.standUpPlantedFootWorld.set(avgFootX, 0, avgFootZ);
          this.standUpPlantedCaptured = true;
        } else {
          const pinFade = 1 - smoothStep(0.90, 1.0, t);
          const dxPin = THREE.MathUtils.clamp(this.standUpPlantedFootWorld.x - avgFootX, -0.18, 0.18) * pinFade;
          const dzPin = THREE.MathUtils.clamp(this.standUpPlantedFootWorld.z - avgFootZ, -0.18, 0.18) * pinFade;
          finalX = baseX + dxPin;
          finalZ = baseZ + dzPin;
          this.root.position.set(finalX, baseY, finalZ);
        }
      }

      if (this.sofaTransitionProgress >= 1) {
        if (this.seatedColliders.length > 0) {
          this.restoreStandingSkirtPhysics();
        }
        this.resetSofaTvStateMachine(true);
        this.root.position.set(finalX, this.sofaEntryPos.y, finalZ);
        this.seedSmoothedBonesToIdle();
        this.walkStartElapsed = 0;
        this.postureState = 'following_player';
        this.lastPlannedGoal.set(999, 0, 999);
        const cb = this.onSofaTransitionDone;
        this.onSofaTransitionDone = null;
        cb?.();
      }
    } else if (this.postureState === 'following_player' && playerFeetWorldPos) {
      this.updateFollowingPlayer(this.vrm, safeDt, elapsed, playerFeetWorldPos, moveResolver);
    } else {
      // 'standing_talking': unrestricted bedroom following when player moves around the bedroom,
      // plus living idle.fbx full-body base + smooth arm-masked gesture layering & tiered gaze!
      if (this.seatedColliders.length > 0) {
        this.restoreStandingSkirtPhysics();
      }
      this.gestureElapsed += safeDt;
      this.root.position.y = 0;

      // Allow her to freely follow the player anywhere inside the bedroom during dialogue!
      if (
        this.bedroomDialogueFollowEnabled &&
        playerRoom === 'bedroom' &&
        playerFeetWorldPos &&
        this.roomGlanceRemaining <= 0 &&
        this.toyGunPhase === 'none'
      ) {
        const clampedPx = THREE.MathUtils.clamp(playerFeetWorldPos.x, BEDROOM_WALK_MIN_X, BEDROOM_WALK_MAX_X);
        const clampedPz = THREE.MathUtils.clamp(playerFeetWorldPos.z, BEDROOM_WALK_MIN_Z, BEDROOM_WALK_MAX_Z);
        const distPlayer = Math.hypot(
          clampedPx - this.root.position.x,
          clampedPz - this.root.position.z
        );

        if (!this.isBedroomDialogueFollowing && distPlayer > 2.35) {
          this.isBedroomDialogueFollowing = true;
          this.walkStartElapsed = 0;
          this.isTurningInPlace = false;
          this.walkUpperBodyStyle = 'normal';
          this.planPathTo(clampedPx, clampedPz, 0);
        } else if (this.isBedroomDialogueFollowing && distPlayer < 1.48) {
          this.isBedroomDialogueFollowing = false;
          this.activePath = [];
        }

        if (this.isBedroomDialogueFollowing) {
          this.walkStartElapsed += safeDt;
          this.pathReplanTimer -= safeDt;
          const goalDrift = Math.hypot(
            clampedPx - this.lastPlannedGoal.x,
            clampedPz - this.lastPlannedGoal.z
          );
          if (this.pathReplanTimer <= 0 || goalDrift > 0.65 || this.activePath.length === 0) {
            this.planPathTo(clampedPx, clampedPz, 0);
          }
          const startRamp = smoothStep(0.08, 0.32, this.walkStartElapsed);
          const followSpd =
            THREE.MathUtils.clamp(1.12 + Math.max(0, distPlayer - 2.0) * 0.35, 1.05, 1.85) * startRamp;
          const { actualSpeed } = this.advanceAlongActivePath(safeDt, followSpd, 0.24, moveResolver);
          const animSpeed = Math.max(actualSpeed, 0.42);
          if (!this.applyMixamoLocomotion(this.vrm, safeDt, true, animSpeed)) {
            if (this.activePoseDriver !== 'procedural_walk') {
              this.beginPoseDriverTransition('procedural_walk', 0.28);
              this.smoothedBoneEuler.clear();
              this.zeroLocomotionMixerWeights();
            }
            this.walkPhase += safeDt * animSpeed * 6.4;
            this.applyProceduralWalkPose(this.vrm, safeDt, elapsed);
          }
        }
      } else {
        this.isBedroomDialogueFollowing = false;
      }

      if (!this.isBedroomDialogueFollowing) {
        if (this.roomGlanceRemaining <= 0) {
          this.applyTieredBodyTurn(
            safeDt,
            playerEyeWorldPos.x,
            playerEyeWorldPos.z,
            THREE.MathUtils.degToRad(52),
            THREE.MathUtils.degToRad(14),
            3.2
          );
        } else {
          // Gentle partial upper-stance turn at most 26° toward room glance target (never a 120° robot spin!)
          const gx = this.roomGlanceTargetPos.x - this.root.position.x;
          const gz = this.roomGlanceTargetPos.z - this.root.position.z;
          if (Math.hypot(gx, gz) > 0.25) {
            const glanceYaw = Math.atan2(gx, gz);
            const diff = shortestAngleDelta(this.root.rotation.y, glanceYaw);
            if (Math.abs(diff) > THREE.MathUtils.degToRad(48)) {
              const subtleStep = THREE.MathUtils.clamp(diff, -0.65 * safeDt, 0.65 * safeDt);
              this.root.rotation.y += subtleStep;
            }
          }
        }

        if (this.actions.idle) {
          this.applyMixamoLocomotion(this.vrm, safeDt, false, 0);
          this.applyLayeredDialogueOnIdle(this.vrm, safeDt, elapsed);
        } else {
          if (this.activePoseDriver !== 'procedural_standing') {
            this.beginPoseDriverTransition('procedural_standing', 0.34);
            this.smoothedBoneEuler.clear();
            this.zeroLocomotionMixerWeights();
          }
          this.applyStandingGesturePose(this.vrm, safeDt, elapsed);
        }
      }
    }

    // 1.35 Update Toy-Gun Aim Reaction state machine (tight eye-shut defensive flinch -> persistent micro-pout)
    if (!this.poseTuner && this.toyGunPhase !== 'none') {
      if (this.toyGunPhase === 'flinch') {
        this.toyGunPhaseTimer += safeDt;
        const flinchLimit = this.toyGunAimed ? 0.85 : 0.48;
        if (this.toyGunPhaseTimer >= flinchLimit) {
          this.toyGunPhase = 'pout';
          this.toyGunPhaseTimer = 0;
          this.toyGunPoutTimer = 2.4;
        }
      } else if (this.toyGunPhase === 'pout') {
        if (this.toyGunAimed) {
          // Continuously hold the aggrieved micro-pout for as long as the toy gun stays pointed at her!
          this.toyGunPoutTimer = 2.4;
        } else {
          this.toyGunPoutTimer = Math.max(0, this.toyGunPoutTimer - safeDt);
          if (this.toyGunPoutTimer <= 0) {
            this.toyGunPhase = 'none';
            this.toyGunPoutNotified = false;
          }
        }
      }
    }

    const targetFlinchBlend = !this.poseTuner && this.toyGunPhase === 'flinch' ? 1.0 : 0.0;
    this.toyGunFlinchBlend = THREE.MathUtils.damp(
      this.toyGunFlinchBlend,
      targetFlinchBlend,
      targetFlinchBlend > this.toyGunFlinchBlend ? 15.0 : 4.8,
      safeDt
    );
    if (this.toyGunFlinchBlend < 0.004) this.toyGunFlinchBlend = 0;
    if (this.toyGunFlinchBlend > 0.005) {
      this.layerUpperBodyPose(
        this.vrm,
        HEROINE_POSES.guard_flinch,
        this.toyGunFlinchBlend,
        'both',
        0
      );
      const s = this.getVrmAxisSign(this.vrm);
      const spine = this.vrm.humanoid.getNormalizedBoneNode('spine');
      if (spine) {
        _footEuler.set(-0.07 * this.toyGunFlinchBlend * s, 0, -0.04 * this.toyGunFlinchBlend * s, 'YXZ');
        _footQuat.setFromEuler(_footEuler);
        spine.quaternion.multiply(_footQuat);
      }
    }

    // 1.4 Layer subtle toe-pivot & knee-lift footwork whenever turning her body in place
    const actualYawRate =
      safeDt > 1e-4 ? shortestAngleDelta(prevRootYaw, this.root.rotation.y) / safeDt : 0;
    this.applyTurnInPlaceFootwork(this.vrm, safeDt, actualYawRate);

    // 1.5 Automatically trigger smooth 0.50s bone-level cross-fade on ANY posture/gesture/walk-style/glance change,
    //     then apply universal SLERP blending & record the visual baseline for the next frame!
    const isGlancingNow = this.roomGlanceRemaining > 0;
    if (
      !this.poseTuner &&
      this.hasLastCommittedPose &&
      (this.postureState !== this.lastRenderedPostureState ||
        this.activePerformance.gesture !== this.lastRenderedGesture ||
        this.walkUpperBodyStyle !== this.lastRenderedWalkStyle ||
        isGlancingNow !== this.lastRenderedGlancing)
    ) {
      this.triggerPoseCrossFade(0.50);
    }
    this.lastRenderedPostureState = this.postureState;
    this.lastRenderedGesture = this.activePerformance.gesture;
    this.lastRenderedWalkStyle = this.walkUpperBodyStyle;
    this.lastRenderedGlancing = isGlancingNow;
    this.applyAndRecordPoseTransition(this.vrm, safeDt);

    // 2. Drive logical VRM LookAt eye tracking + clamped head/neck follow (or Pose Tuner head sliders)
    this.updateGazeAndHeadTracking(this.vrm, safeDt, elapsed, playerEyeWorldPos, playerRoom);

    // 3. Expressions, wink, randomized blinking, soft lip-sync & cheek blush
    this.updateExpressionsLipSyncAndBlush(this.vrm, safeDt);

    // 4. Transfer normalized pose -> raw bones & refresh world matrices so VRM LookAt & SpringBone colliders stay synced
    this.vrm.humanoid.update();
    this.root.updateMatrixWorld(true);
    if (this.seatedColliders.length > 0) {
      this.updateSeatedCollidersWorldMatrix();
    }

    // 4.5 Co-play Xbox controller pickup & handoff choreography ticks
    if (this.gamingActionPulse > 0) {
      this.gamingActionPulse = Math.max(0, this.gamingActionPulse - safeDt * 2.8);
    }
    if (this.gamingPhase === 'pickup_pads') {
      this.gamingPhaseTimer += safeDt;
      // Smoothly turn to face the coffee table (+X) and reach down to collect both Xbox pads
      const yawDiff = shortestAngleDelta(this.root.rotation.y, Math.PI * 0.5);
      this.root.rotation.y += yawDiff * Math.min(1, safeDt * 6.0);

      if (!this.gamingPickupNotified && this.gamingPhaseTimer >= 0.48) {
        this.gamingPickupNotified = true;
        this.hasWhitePadInHand = true;
        this.hasPurplePadInHand = true;
        this.gamingCallbacks?.onPickedUpFromTable?.();
      }

      if (this.gamingPhaseTimer >= 0.96) {
        this.gamingPhase = 'walk_to_player';
        this.gamingPhaseTimer = 0;
        const handoffSpot = new THREE.Vector3(3.38, 0, -4.84);
        this.walkTargetPos.copy(handoffSpot);
        this.planPathTo(handoffSpot.x, handoffSpot.z, 0);
        this.onStageWalkArrived = () => {
          if (this.gamingPhase !== 'walk_to_player') return;
          this.gamingPhase = 'handoff_wait';
          this.gamingPhaseTimer = 0;
          this.activePerformance = {
            expression: 'happy',
            gesture: 'reach_hand',
            blush: 0.30,
            headTilt: 0.06,
            leanForward: 0.14,
          };
          this.gamingCallbacks?.onHandoffStart?.();
        };
        this.walkStartElapsed = 0;
        this.postureState = 'dialogue_walking';
      }
    } else if (this.gamingPhase === 'handoff_wait') {
      this.gamingPhaseTimer += safeDt;
      if (!this.gamingHandoffTaken && this.gamingPhaseTimer >= 0.72) {
        this.gamingHandoffTaken = true;
        this.hasWhitePadInHand = false;
        this.gamingCallbacks?.onWhitePadTaken?.();
      }
      if (this.gamingPhaseTimer >= 1.38) {
        this.gamingPhase = 'return_to_sofa';
        this.gamingPhaseTimer = 0;
        this.activePerformance = {
          expression: 'happy',
          gesture: 'idle',
          blush: 0.24,
          headTilt: 0.04,
          leanForward: 0,
        };
        const returnSpot = new THREE.Vector3(3.14, 0, -5.68);
        this.walkTargetPos.copy(returnSpot);
        this.planPathTo(returnSpot.x, returnSpot.z, 0);
        this.onStageWalkArrived = () => {
          if (this.gamingPhase !== 'return_to_sofa') return;
          this.gamingPhase = 'sit_back_sofa';
          this.sofaSeatPos.set(2.74, 0, -5.68);
          this.sofaEntryPos.set(3.14, 0, -5.68);
          this.sofaFaceYaw = Math.PI / 2;
          this.onSofaTransitionDone = () => {
            if (this.gamingPhase !== 'sit_back_sofa') return;
            this.gamingPhase = 'playing_sofa';
            this.activePerformance = {
              expression: 'happy',
              gesture: 'idle',
              blush: 0.24,
              headTilt: 0.04,
              leanForward: 0.05,
            };
            this.gamingCallbacks?.onBackSeated?.();
          };
          this.startSofaSitDownTransition();
        };
        this.walkStartElapsed = 0;
        this.postureState = 'dialogue_walking';
      }
    }

    // 5. Commit VRM LookAt eye tracking, ExpressionManager, and SpringBones
    this.vrm.update(safeDt);

    // 5.5 Update attached held Xbox controllers in heroine hands
    this.root.updateMatrixWorld(true);
    if (this.heldWhitePadMesh) {
      const rHand = this.vrm.humanoid.getRawBoneNode('rightHand');
      if (this.hasWhitePadInHand && rHand) {
        rHand.getWorldPosition(this._padWorldPos);
        rHand.getWorldQuaternion(this._padWorldQuat);
        this.root.worldToLocal(this._padWorldPos);
        this.heldWhitePadMesh.visible = true;
        this.heldWhitePadMesh.position.copy(this._padWorldPos);
        this.heldWhitePadMesh.position.y -= 0.025;
        this.heldWhitePadMesh.quaternion.copy(this.root.quaternion).invert().multiply(this._padWorldQuat);
      } else {
        this.heldWhitePadMesh.visible = false;
      }
    }
    if (this.heldPurplePadMesh) {
      const lHand = this.vrm.humanoid.getRawBoneNode('leftHand');
      const rHand = this.vrm.humanoid.getRawBoneNode('rightHand');
      if (this.hasPurplePadInHand && this.gamingPhase === 'playing_sofa' && lHand && rHand) {
        lHand.getWorldPosition(this._padWorldPos);
        rHand.getWorldPosition(this._padWorldPosB);
        this._padWorldPos.lerp(this._padWorldPosB, 0.5);
        this.root.worldToLocal(this._padWorldPos);
        this.heldPurplePadMesh.visible = true;
        this.heldPurplePadMesh.position.copy(this._padWorldPos);
        this.heldPurplePadMesh.position.z += 0.035;
        this.heldPurplePadMesh.rotation.set(
          -0.42 + this.gamingActionPulse * 0.14,
          Math.PI,
          Math.sin(elapsed * 4.4) * 0.05
        );
      } else if (this.hasPurplePadInHand && lHand) {
        lHand.getWorldPosition(this._padWorldPos);
        lHand.getWorldQuaternion(this._padWorldQuat);
        this.root.worldToLocal(this._padWorldPos);
        this.heldPurplePadMesh.visible = true;
        this.heldPurplePadMesh.position.copy(this._padWorldPos);
        this.heldPurplePadMesh.position.y -= 0.025;
        this.heldPurplePadMesh.quaternion.copy(this.root.quaternion).invert().multiply(this._padWorldQuat);
      } else {
        this.heldPurplePadMesh.visible = false;
      }
    }

    // 6. Post-VRM-update safety clamp: guarantee decoupled closed mouth while smiling (`happy`)
    if (this.currentHappy > 0.01 && this.smileBlockedMouthMorphs.length > 0) {
      for (let i = 0; i < this.smileBlockedMouthMorphs.length; i++) {
        const entry = this.smileBlockedMouthMorphs[i];
        if (entry.mesh.morphTargetInfluences) {
          entry.mesh.morphTargetInfluences[entry.index] = 0;
        }
      }
    }
  }

  private disposeCurrentVrm(): void {
    this.removeSeatedSkirtColliders();
    this.skirtJointOriginalSettings.clear();
    this.lipSyncMorphFallback = [];
    this.smileBlockedMouthMorphs = [];
    this.materialBaselines = [];
    this.disposeCheekBlushPlanes();
    this.smoothedBoneEuler.clear();
    this.resetPoseTransitionState();
    this.lastCommittedQuats.clear();
    this.transitionFromQuats.clear();
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.actions = {};
    if (this.vrm) {
      if (this.vrm.lookAt) {
        this.vrm.lookAt.target = null;
      }
      this.root.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    this.root.visible = false;
  }

  public dispose(): void {
    this.disposed = true;
    this.disposeCurrentVrm();
    this.sharedFbx = {};
  }
}
