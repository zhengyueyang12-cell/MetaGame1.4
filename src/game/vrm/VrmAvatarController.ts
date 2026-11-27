import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { MToonMaterial, VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  clearAllLocalAssets,
  deleteLocalAsset,
  getAllLocalAssets,
  importAvatarBackupPackage,
  saveLocalAsset,
  type LocalAssetMeta,
  type LocalAssetSlot,
  type StoredLocalAsset,
} from './localAssetDb';
import { retargetMixamoFbxToVrmWithMeta } from './mixamoVrmRetarget';
import {
  applyRightHandFingerGrasp,
  solveRightArmTwoBoneIK,
  type HandGraspPreset,
} from './rightArmTwoBoneIk';
import { HeroineAvatarController } from './HeroineAvatarController';

export type { HandGraspPreset } from './rightArmTwoBoneIk';
export type LocomotionState = 'idle' | 'walk' | 'run';

export interface VrmAvatarStatusSnapshot {
  vrmLoaded: boolean;
  vrmVersion: string | null;
  heroineLoaded: boolean;
  heroineVersion: string | null;
  heroineSitClipBound: boolean;
  heroineSpawned: boolean;
  assets: Partial<Record<LocalAssetSlot, LocalAssetMeta>>;
  boundClips: Record<LocomotionState, boolean>;
  activeMotion: LocomotionState;
  loadingSlot: LocalAssetSlot | 'restore' | null;
  lastError: string | null;
}

export interface VrmAvatarUpdateParams {
  feetPos: THREE.Vector3;
  yaw: number;
  pitch: number;
  walkSpeed: number;
  /** Actual horizontal ground speed (m/s) derived from resolved displacement to prevent foot sliding */
  actualSpeed?: number;
  isMoving: boolean;
  moveDirWorld: THREE.Vector3;
  viewMode: 'first-person' | 'overview';
  thirdPersonPreview: boolean;
  hideAll?: boolean;
  seatedOnSofa?: boolean;
  sofaBaseYaw?: number;
  coPlayMode?: 'none' | 'reaching' | 'holding';
  coPlayReachProgress?: number;
  coPlayInputX?: number;
  coPlayInputY?: number;
  coPlayActionPulse?: number;
}

export interface RightHandIkOptions {
  /** Optional custom world-space elbow pole vector hint (defaults to anatomical right-down-back) */
  poleWorldPos?: THREE.Vector3 | null;
  /** Optional world-space wrist orientation target for held items / flashlight / tools */
  handWorldQuat?: THREE.Quaternion | null;
  /** Optional pullback along shoulder->target so palm/fingers align on handle/prop (default 0.045m) */
  palmBackOffset?: number;
}

const _tmpBox = new THREE.Box3();
const _tmpEuler = new THREE.Euler();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _targetFacingQuat = new THREE.Quaternion();
const _shoulderWorld = new THREE.Vector3();
const _leftShoulderWorld = new THREE.Vector3();
const _charRightWorld = new THREE.Vector3();
const _charFwdWorld = new THREE.Vector3();
const _computedPoleWorld = new THREE.Vector3();
const _toIkTargetXZ = new THREE.Vector3();

// Calibrated native stride velocities (m/s) for standard Mixamo "In Place" clips at 0.92m hip height
const DEFAULT_MIXAMO_WALK_SPEED = 1.68;
const DEFAULT_MIXAMO_RUN_SPEED = 3.45;
const MTOON_GI_EQUALIZATION_TARGET = 0.34;
const HEROINE_SPAWNED_STORAGE_KEY = 'twilight_ark_heroine_spawned_v1';

function readPersistedHeroineSpawned(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    const val = window.localStorage.getItem(HEROINE_SPAWNED_STORAGE_KEY);
    if (val === '0' || val === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

function writePersistedHeroineSpawned(spawned: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(HEROINE_SPAWNED_STORAGE_KEY, spawned ? '1' : '0');
  } catch {
    // Ignore storage errors
  }
}

export class VrmAvatarController {
  public readonly root: THREE.Group;
  public readonly heroine: HeroineAvatarController;
  private readonly avatarHolder: THREE.Group;
  private readonly gltfLoader: GLTFLoader;
  private readonly fbxLoader: FBXLoader;

  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private fbxAssets: Partial<Record<LocomotionState, THREE.Group>> = {};
  private actions: Partial<Record<LocomotionState, THREE.AnimationAction>> = {};
  private clipNativeSpeeds: Partial<Record<LocomotionState, number>> = {};
  private vrmHipsHeight = 0.92;
  private actionWeights: Record<LocomotionState, number> = {
    idle: 1,
    walk: 0,
    run: 0,
  };
  private smoothedGroundSpeed = 0;

  private assetMetas: Partial<Record<LocalAssetSlot, LocalAssetMeta>> = {};
  private activeMotion: LocomotionState = 'idle';
  private loadingSlot: LocalAssetSlot | 'restore' | null = null;
  private lastError: string | null = null;
  private onStatusChange?: (status: VrmAvatarStatusSnapshot) => void;

  private renderPassMode: 'first-person' | 'overview' | 'mirror' | 'third-person' =
    'first-person';
  private lastPitch = 0;

  // Smooth quaternion SLERP facing state (avoids abrupt 180-deg snapping)
  private readonly currentFacingQuat = new THREE.Quaternion();
  private lastFacingYaw = 0;
  private prevAppliedYaw = 0;
  private smoothedYawRate = 0;
  private turnStepPhase = 0;
  private turnFootworkBlend = 0;
  private turnDirectionSign = 1;
  private readonly turnStepEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly turnStepQuat = new THREE.Quaternion();
  private facingInitialized = false;

  // Right-Arm Analytic Two-Bone IK & Finger Grasp state
  private rightHandIkHasTarget = false;
  private readonly rightHandIkTargetWorld = new THREE.Vector3();
  private rightHandIkTargetWeight = 0;
  private rightHandIkWeight = 0;
  private rightHandIkHasCustomPole = false;
  private readonly rightHandIkCustomPole = new THREE.Vector3();
  private rightHandIkHasCustomQuat = false;
  private readonly rightHandIkCustomQuat = new THREE.Quaternion();
  private rightHandIkPalmOffset = 0.045;

  private rightHandGraspTarget = 0;
  private rightHandGraspWeight = 0;
  private rightHandGraspPreset: HandGraspPreset = 'relaxed';

  private blinkTimer = 2.6;
  private blinkElapsed = -1;
  private disposed = false;

  // Seated-on-sofa body pose & smooth controller hand-off state (eliminates floating camera hands)
  private lastSeatedOnSofa = false;
  private heldControllerMesh: THREE.Group | null = null;
  private readonly _padLeftPos = new THREE.Vector3();
  private readonly _padRightPos = new THREE.Vector3();
  private readonly _padMidPos = new THREE.Vector3();
  private sofaLU = new THREE.Vector3(0.36, -0.22, -1.16);
  private sofaRU = new THREE.Vector3(0.36, 0.22, 1.16);
  private sofaLL = new THREE.Vector3(-0.06, -0.78, 0);
  private sofaRL = new THREE.Vector3(0.06, 0.78, 0);
  private sofaLH = new THREE.Vector3(0.08, 0.08, 0.04);
  private sofaRH = new THREE.Vector3(0.08, -0.08, -0.04);

  constructor(onStatusChange?: (status: VrmAvatarStatusSnapshot) => void) {
    this.onStatusChange = onStatusChange;
    this.root = new THREE.Group();
    this.root.name = 'CustomVrmAvatarRoot';
    this.root.visible = false;

    this.avatarHolder = new THREE.Group();
    this.avatarHolder.name = 'CustomVrmAvatarHolder';
    this.root.add(this.avatarHolder);

    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
    this.fbxLoader = new FBXLoader();
    this.heroine = new HeroineAvatarController();
  }

  public hasVrm(): boolean {
    return this.vrm !== null;
  }

  public setHeldController(pad: THREE.Group): void {
    if (this.heldControllerMesh) {
      this.root.remove(this.heldControllerMesh);
    }
    this.heldControllerMesh = pad;
    pad.visible = false;
    this.root.add(pad);
  }

  private computeSofaHipsDropY(): number {
    // Lower VRM so hips rest naturally on the living room sofa cushion (y ≈ 0.50m)
    return -(this.vrmHipsHeight - 0.52);
  }

  private syncHeadVisibilityForPass(mode: 'first-person' | 'overview' | 'mirror' | 'third-person'): void {
    if (!this.vrm) return;
    const rawHead = this.vrm.humanoid.getRawBoneNode('head');
    if (!rawHead) return;
    const hideHeadInFpSofa = this.lastSeatedOnSofa && mode === 'first-person';
    if (hideHeadInFpSofa) {
      rawHead.scale.setScalar(0.0001);
    } else {
      rawHead.scale.set(1, 1, 1);
    }
  }

  public spawnHeroineOnBedroomBed(): void {
    this.heroine.spawnOnBedroomBed();
    writePersistedHeroineSpawned(true);
    this.emitStatus();
  }

  public setHeroineSpawned(spawned: boolean): void {
    this.heroine.setSpawned(spawned);
    writePersistedHeroineSpawned(spawned);
    this.emitStatus();
  }

  public getStatus(): VrmAvatarStatusSnapshot {
    return {
      vrmLoaded: this.vrm !== null,
      vrmVersion: this.vrm?.meta?.metaVersion ?? null,
      heroineLoaded: this.heroine.hasVrm(),
      heroineVersion: this.heroine.getVrmVersion(),
      heroineSitClipBound: this.heroine.hasSitClip(),
      heroineSpawned: this.heroine.isSpawned(),
      assets: { ...this.assetMetas },
      boundClips: {
        idle: Boolean(this.actions.idle),
        walk: Boolean(this.actions.walk),
        run: Boolean(this.actions.run),
      },
      activeMotion: this.activeMotion,
      loadingSlot: this.loadingSlot,
      lastError: this.lastError,
    };
  }

  private emitStatus(): void {
    this.onStatusChange?.(this.getStatus());
  }

  /**
   * Unified Right-Hand Two-Bone IK interface for door handles, flashlights, and held props.
   * Pass `targetWorldPos = null` or `weight = 0` to smoothly release IK control back to animation.
   */
  public setRightHandIK(
    targetWorldPos: THREE.Vector3 | null,
    weight: number,
    options?: RightHandIkOptions
  ): void {
    const clampedW = THREE.MathUtils.clamp(weight, 0, 1);
    if (targetWorldPos) {
      this.rightHandIkTargetWorld.copy(targetWorldPos);
      this.rightHandIkHasTarget = true;
    } else if (clampedW <= 1e-4) {
      // Keep last target position during smooth release fade-out, only clear once weight reaches 0
      this.rightHandIkTargetWeight = 0;
    }

    this.rightHandIkTargetWeight = targetWorldPos ? clampedW : 0;

    if (options?.poleWorldPos) {
      this.rightHandIkCustomPole.copy(options.poleWorldPos);
      this.rightHandIkHasCustomPole = true;
    } else if (options && 'poleWorldPos' in options) {
      this.rightHandIkHasCustomPole = false;
    } else if (!targetWorldPos) {
      this.rightHandIkHasCustomPole = false;
    }

    if (options?.handWorldQuat) {
      this.rightHandIkCustomQuat.copy(options.handWorldQuat);
      this.rightHandIkHasCustomQuat = true;
    } else if (options && 'handWorldQuat' in options) {
      this.rightHandIkHasCustomQuat = false;
    } else if (!targetWorldPos) {
      this.rightHandIkHasCustomQuat = false;
    }

    if (typeof options?.palmBackOffset === 'number') {
      this.rightHandIkPalmOffset = options.palmBackOffset;
    } else if (!targetWorldPos) {
      this.rightHandIkPalmOffset = 0.045;
    }
  }

  /**
   * Unified Right-Hand Finger Grasp controller (for door handles, flashlights, pistol/toy gun, tools).
   * Smoothly rotates VRM normalized right-hand finger bones in local space.
   */
  public setRightHandGrasp(
    graspAmount: number,
    preset: HandGraspPreset = 'hold'
  ): void {
    this.rightHandGraspTarget = THREE.MathUtils.clamp(graspAmount, 0, 1);
    if (graspAmount > 0.01 || this.rightHandGraspWeight <= 0.02) {
      this.rightHandGraspPreset = preset;
    }
  }

  /**
   * Writes the world-space position of the VRM's right shoulder into `out` (returns false if no VRM loaded).
   */
  public getRightShoulderWorldPos(out: THREE.Vector3): boolean {
    if (!this.vrm) return false;
    const upperArm = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    if (!upperArm) return false;
    this.root.updateMatrixWorld(true);
    upperArm.getWorldPosition(out);
    return true;
  }

  /**
   * Automatically checks IndexedDB on page load and restores any cached VRM + FBX files,
   * then performs Mixamo bone retargeting and binds locomotion actions.
   */
  public async restoreFromIndexedDB(): Promise<void> {
    if (this.disposed) return;
    this.loadingSlot = 'restore';
    this.lastError = null;
    this.emitStatus();

    try {
      const cached = await getAllLocalAssets();
      if (this.disposed) return;

      for (const slot of ['vrm', 'idle', 'walk', 'run', 'heroine', 'sit'] as LocalAssetSlot[]) {
        const rec = cached[slot];
        if (rec) {
          this.assetMetas[slot] = {
            slot: rec.slot,
            name: rec.name,
            size: rec.size,
            updatedAt: rec.updatedAt,
          };
        }
      }

      // Load Protagonist VRM first if present (isolated per-slot so one error never blocks others)
      if (cached.vrm && !this.disposed) {
        try {
          await this.loadVrmFromBlob(cached.vrm.blob);
        } catch (err) {
          console.warn('[VrmAvatarController] Failed to restore protagonist VRM:', err);
        }
      }

      // Load Heroine VRM if present & restore persisted spawn visibility
      if (cached.heroine && !this.disposed) {
        try {
          await this.heroine.loadHeroineFromBlob(cached.heroine.blob);
          if (readPersistedHeroineSpawned()) {
            this.heroine.spawnOnBedroomBed();
          }
        } catch (err) {
          console.warn('[VrmAvatarController] Failed to restore heroine VRM:', err);
        }
      }

      // Load any cached shared FBX animations (idle/walk/run) and retarget onto protagonist + heroine
      for (const animSlot of ['idle', 'walk', 'run'] as LocomotionState[]) {
        const rec = cached[animSlot];
        if (rec && !this.disposed) {
          try {
            await this.loadFbxFromBlob(animSlot, rec.blob);
            if (animSlot === 'idle' || animSlot === 'walk') {
              this.heroine.syncSharedFbx(animSlot, this.fbxAssets[animSlot] ?? null);
            }
          } catch (err) {
            console.warn(`[VrmAvatarController] Failed to restore ${animSlot}.fbx:`, err);
          }
        }
      }

      // Load optional heroine sit.fbx if present
      if (cached.sit && !this.disposed) {
        try {
          await this.heroine.loadSitFbxFromBlob(cached.sit.blob);
        } catch (err) {
          console.warn('[VrmAvatarController] Failed to restore sit.fbx:', err);
        }
      }

      if (this.vrm) {
        this.rebindAllRetargetedClips();
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : '恢复 IndexedDB 缓存失败';
      console.warn('[VrmAvatarController] IndexedDB restore failed:', err);
    } finally {
      this.loadingSlot = null;
      this.emitStatus();
    }
  }

  /**
   * Persists a user-selected/dropped file into IndexedDB and loads it via ObjectURL.
   */
  public async importLocalFile(slot: LocalAssetSlot, file: File): Promise<void> {
    if (this.disposed) return;
    this.loadingSlot = slot;
    this.lastError = null;
    this.emitStatus();

    try {
      const stored: StoredLocalAsset = await saveLocalAsset(slot, file);
      if (this.disposed) return;

      this.assetMetas[slot] = {
        slot: stored.slot,
        name: stored.name,
        size: stored.size,
        updatedAt: stored.updatedAt,
      };

      if (slot === 'vrm') {
        await this.loadVrmFromBlob(stored.blob);
        this.rebindAllRetargetedClips();
      } else if (slot === 'heroine') {
        await this.heroine.loadHeroineFromBlob(stored.blob);
        if (this.fbxAssets.idle) this.heroine.syncSharedFbx('idle', this.fbxAssets.idle);
        if (this.fbxAssets.walk) this.heroine.syncSharedFbx('walk', this.fbxAssets.walk);
      } else if (slot === 'sit') {
        await this.heroine.loadSitFbxFromBlob(stored.blob);
      } else {
        await this.loadFbxFromBlob(slot, stored.blob);
        if (this.vrm) {
          this.rebindSingleClip(slot);
        }
        if (slot === 'idle' || slot === 'walk') {
          this.heroine.syncSharedFbx(slot, this.fbxAssets[slot] ?? null);
        }
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : `加载 ${file.name} 失败`;
      console.error(`[VrmAvatarController] Failed to load ${slot}:`, err);
    } finally {
      this.loadingSlot = null;
      this.emitStatus();
    }
  }

  public async removeSlot(slot: LocalAssetSlot): Promise<void> {
    if (this.disposed) return;
    this.lastError = null;
    try {
      await deleteLocalAsset(slot);
      delete this.assetMetas[slot];

      if (slot === 'vrm') {
        this.disposeCurrentVrm();
      } else if (slot === 'heroine') {
        this.heroine.removeHeroineVrm();
      } else if (slot === 'sit') {
        this.heroine.removeSitClip();
      } else {
        delete this.fbxAssets[slot];
        delete this.clipNativeSpeeds[slot];
        const prevAction = this.actions[slot];
        if (prevAction) {
          prevAction.stop();
          this.mixer?.uncacheAction(prevAction.getClip());
          delete this.actions[slot];
        }
        if (slot === 'idle' || slot === 'walk') {
          this.heroine.syncSharedFbx(slot, null);
        }
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : '删除缓存失败';
    } finally {
      this.emitStatus();
    }
  }

  public async clearAll(): Promise<void> {
    if (this.disposed) return;
    this.lastError = null;
    try {
      await clearAllLocalAssets();
      this.assetMetas = {};
      this.fbxAssets = {};
      this.clipNativeSpeeds = {};
      this.disposeCurrentVrm();
      this.heroine.removeHeroineVrm();
      this.heroine.removeSitClip();
      this.heroine.syncSharedFbx('idle', null);
      this.heroine.syncSharedFbx('walk', null);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : '清空缓存失败';
    } finally {
      this.emitStatus();
    }
  }

  public async importBackupPackage(file: File): Promise<{
    slotCount: number;
    poseCount: number;
    heroineSpawned: boolean;
  }> {
    if (this.disposed) {
      return { slotCount: 0, poseCount: 0, heroineSpawned: false };
    }
    this.loadingSlot = 'restore';
    this.lastError = null;
    this.emitStatus();
    try {
      const summary = await importAvatarBackupPackage(file);
      this.assetMetas = {};
      this.fbxAssets = {};
      this.clipNativeSpeeds = {};
      this.disposeCurrentVrm();
      this.heroine.removeHeroineVrm();
      this.heroine.removeSitClip();
      this.heroine.syncSharedFbx('idle', null);
      this.heroine.syncSharedFbx('walk', null);
      await this.restoreFromIndexedDB();
      return summary;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : '导入 .tark 备份失败';
      this.loadingSlot = null;
      this.emitStatus();
      throw err;
    }
  }

  private tuneVrmMaterialsForRoomLighting(vrmScene: THREE.Object3D): void {
    vrmScene.traverse((obj) => {
      obj.frustumCulled = false;
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (let i = 0; i < materials.length; i++) {
        const mat = materials[i];
        if (!mat) continue;

        mat.toneMapped = true;

        const mtoon = mat as MToonMaterial;
        if (mtoon.isMToonMaterial || mat instanceof MToonMaterial) {
          // Lower GI equalization so directional room sunlight, lamps, and shadowed corners
          // shape the VRM character naturally instead of washing out into flat ambient brightness
          const curGi =
            typeof mtoon.giEqualizationFactor === 'number'
              ? mtoon.giEqualizationFactor
              : 0.9;
          mtoon.giEqualizationFactor = Math.min(curGi, MTOON_GI_EQUALIZATION_TARGET);
          mtoon.needsUpdate = true;
        }
      }
    });
  }

  private async loadVrmFromBlob(blob: Blob): Promise<void> {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const gltf = await this.gltfLoader.loadAsync(objectUrl);
      if (this.disposed) return;

      const loadedVrm = gltf.userData.vrm as VRM | undefined;
      if (!loadedVrm) {
        throw new Error('该文件不是有效的 VRM 角色模型');
      }

      this.disposeCurrentVrm();

      // Clean up unnecessary vertices & joints for snappy real-time animation performance
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);

      // Standardize orientation: VRM 0.x originally faces -Z -> rotate to +Z so both 0.x & 1.0 face +Z
      VRMUtils.rotateVRM0(loadedVrm);

      // Tune MToonMaterial toneMapped & giEqualizationFactor + shadow flags for natural room lighting
      this.tuneVrmMaterialsForRoomLighting(loadedVrm.scene);

      // Auto-ground feet cleanly at Y = 0
      loadedVrm.scene.position.set(0, 0, 0);
      loadedVrm.scene.updateMatrixWorld(true);
      _tmpBox.setFromObject(loadedVrm.scene);
      if (!_tmpBox.isEmpty() && Number.isFinite(_tmpBox.min.y)) {
        const yOffset = -_tmpBox.min.y;
        if (Math.abs(yOffset) < 0.8) {
          loadedVrm.scene.position.y = yOffset;
        }
      }

      // Apply relaxed natural A-pose by default (so character never looks stuck in stiff T-pose before FBX load)
      this.applyRelaxedFallbackPose(loadedVrm);

      this.vrm = loadedVrm;
      this.avatarHolder.add(loadedVrm.scene);
      this.mixer = new THREE.AnimationMixer(loadedVrm.scene);
      this.actions = {};
      this.clipNativeSpeeds = {};
      this.actionWeights = { idle: 1, walk: 0, run: 0 };
      this.root.visible = true;
      this.setRenderPassMode(this.renderPassMode);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private async loadFbxFromBlob(slot: LocomotionState, blob: Blob): Promise<void> {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const fbxGroup = await this.fbxLoader.loadAsync(objectUrl);
      if (this.disposed) return;

      if (!fbxGroup.animations || fbxGroup.animations.length === 0) {
        throw new Error(`${slot}.fbx 中未检测到骨骼动画轨道`);
      }
      this.fbxAssets[slot] = fbxGroup;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  private rebindAllRetargetedClips(): void {
    if (!this.vrm || !this.mixer) return;
    this.mixer.stopAllAction();
    this.actions = {};
    this.clipNativeSpeeds = {};
    for (const slot of ['idle', 'walk', 'run'] as LocomotionState[]) {
      this.rebindSingleClip(slot);
    }
  }

  private rebindSingleClip(slot: LocomotionState): void {
    if (!this.vrm || !this.mixer) return;
    const fbxGroup = this.fbxAssets[slot];
    if (!fbxGroup) return;

    const prevAction = this.actions[slot];
    if (prevAction) {
      prevAction.stop();
      this.mixer.uncacheAction(prevAction.getClip());
      delete this.actions[slot];
    }

    const result = retargetMixamoFbxToVrmWithMeta(fbxGroup, this.vrm, `mixamo_${slot}`);
    if (!result) {
      this.lastError = `${slot}.fbx 骨骼重定向失败：未匹配到 Mixamo 人形骨骼`;
      return;
    }

    this.vrmHipsHeight = result.vrmHipsHeight;
    if (result.nativeSpeed !== null) {
      this.clipNativeSpeeds[slot] = result.nativeSpeed;
    } else {
      delete this.clipNativeSpeeds[slot];
    }

    const action = this.mixer.clipAction(result.clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.enabled = true;
    action.setEffectiveTimeScale(1.0);
    action.setEffectiveWeight(slot === this.activeMotion ? 1.0 : 0.0);
    action.play();
    this.actions[slot] = action;
  }

  private applyRelaxedFallbackPose(vrm: VRM): void {
    const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    const leftLowerArm = vrm.humanoid.getNormalizedBoneNode('leftLowerArm');
    const rightLowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');

    if (leftUpperArm) {
      leftUpperArm.rotation.set(0.05, 0, -1.22);
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.set(0.05, 0, 1.22);
    }
    if (leftLowerArm) {
      leftLowerArm.rotation.set(0, -0.18, 0);
    }
    if (rightLowerArm) {
      rightLowerArm.rotation.set(0, 0.18, 0);
    }
  }

  public setRenderPassMode(
    mode: 'first-person' | 'overview' | 'mirror' | 'third-person'
  ): void {
    this.renderPassMode = mode;
    if (!this.vrm) return;

    this.syncHeadVisibilityForPass(mode);

    if (this.lastSeatedOnSofa) {
      const dropY = this.computeSofaHipsDropY();
      this.avatarHolder.visible = true;
      if (mode === 'first-person') {
        // Keep headless seated body visible and slightly back so chest/arms/legs frame naturally
        this.avatarHolder.position.set(0, dropY, -0.18);
      } else {
        this.avatarHolder.position.set(0, dropY, 0);
      }
      return;
    }

    if (mode === 'first-person') {
      // Keep headless avatar out of normal forward gaze to avoid camera clipping
      this.avatarHolder.position.set(0, 0, -0.22);
      this.avatarHolder.visible = this.lastPitch <= -0.62;
    } else {
      this.avatarHolder.position.set(0, 0, 0);
      this.avatarHolder.visible = true;
    }
  }

  private computeClipTimeScale(slot: LocomotionState, groundSpeed: number): number {
    if (slot === 'idle') return 1.0;

    // Scale default stride speed linearly with the VRM's leg/hips height proportion
    const legScale = THREE.MathUtils.clamp(this.vrmHipsHeight / 0.92, 0.72, 1.35);
    const nativeSpeed =
      this.clipNativeSpeeds[slot] ??
      (slot === 'run'
        ? DEFAULT_MIXAMO_RUN_SPEED * legScale
        : DEFAULT_MIXAMO_WALK_SPEED * legScale);

    const rawScale = groundSpeed / Math.max(nativeSpeed, 0.4);
    if (slot === 'run') {
      return THREE.MathUtils.clamp(rawScale, 0.65, 1.75);
    }
    return THREE.MathUtils.clamp(rawScale, 0.52, 2.05);
  }

  private computeDefaultRightElbowPole(vrm: VRM, outPole: THREE.Vector3): boolean {
    const rightShoulder = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
    if (!rightShoulder) return false;
    rightShoulder.getWorldPosition(_shoulderWorld);

    // Derive true character right axis from shoulder pair (fallback to root -X)
    const leftShoulder = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
    if (leftShoulder) {
      leftShoulder.getWorldPosition(_leftShoulderWorld);
      _charRightWorld.subVectors(_shoulderWorld, _leftShoulderWorld);
      _charRightWorld.y = 0;
      if (_charRightWorld.lengthSq() > 1e-6) {
        _charRightWorld.normalize();
      } else {
        _charRightWorld.set(-1, 0, 0).applyQuaternion(this.currentFacingQuat).normalize();
      }
    } else {
      _charRightWorld.set(-1, 0, 0).applyQuaternion(this.currentFacingQuat).normalize();
    }

    // Character forward (+Z rotated by facing quaternion)
    _charFwdWorld.set(0, 0, 1).applyQuaternion(this.currentFacingQuat).normalize();

    // Place elbow pole down (-Y), slightly outward to the right, and slightly behind the torso
    // so the right elbow always bends anatomically downward/outward and never inverts inward!
    outPole
      .copy(_shoulderWorld)
      .addScaledVector(_charRightWorld, 0.36)
      .addScaledVector(_charFwdWorld, -0.30);
    outPole.y -= 0.48;
    return true;
  }

  public update(dt: number, elapsed: number, params: VrmAvatarUpdateParams): void {
    if (!this.vrm) {
      this.root.visible = false;
      if (this.heldControllerMesh) this.heldControllerMesh.visible = false;
      return;
    }

    const safeDt = Math.min(dt, 0.05);
    this.lastPitch = params.pitch;
    const isSeatedOnSofa = Boolean(params.seatedOnSofa);
    this.lastSeatedOnSofa = isSeatedOnSofa;
    this.root.visible = !params.hideAll;
    if (params.hideAll) {
      if (this.heldControllerMesh) this.heldControllerMesh.visible = false;
      return;
    }

    this.root.position.copy(params.feetPos);

    if (isSeatedOnSofa) {
      this.updateSeatedOnSofa(safeDt, elapsed, params);
      return;
    }

    if (this.heldControllerMesh) {
      this.heldControllerMesh.visible = false;
    }
    this.syncHeadVisibilityForPass(this.renderPassMode);

    // Measure actual ground speed (prevents foot sliding when accelerating, decelerating, or pushing walls)
    const rawGroundSpeed =
      typeof params.actualSpeed === 'number'
        ? params.actualSpeed
        : params.isMoving
          ? params.walkSpeed
          : 0;
    this.smoothedGroundSpeed = THREE.MathUtils.damp(
      this.smoothedGroundSpeed,
      rawGroundSpeed,
      14.0,
      safeDt
    );

    // Smoothly damp Right-Hand IK & Finger Grasp weights
    const ikLambda = this.rightHandIkTargetWeight > this.rightHandIkWeight ? 18.0 : 10.5;
    this.rightHandIkWeight = THREE.MathUtils.damp(
      this.rightHandIkWeight,
      this.rightHandIkTargetWeight,
      ikLambda,
      safeDt
    );
    if (this.rightHandIkTargetWeight <= 1e-4 && this.rightHandIkWeight < 0.008) {
      this.rightHandIkWeight = 0;
      this.rightHandIkHasTarget = false;
      this.rightHandIkHasCustomPole = false;
      this.rightHandIkHasCustomQuat = false;
    }

    const graspLambda =
      this.rightHandGraspTarget > this.rightHandGraspWeight ? 16.0 : 11.0;
    this.rightHandGraspWeight = THREE.MathUtils.damp(
      this.rightHandGraspWeight,
      this.rightHandGraspTarget,
      graspLambda,
      safeDt
    );
    if (this.rightHandGraspTarget <= 1e-4 && this.rightHandGraspWeight < 0.008) {
      this.rightHandGraspWeight = 0;
    }

    // -------------------------------------------------------------------------
    // 1. Smooth SLERP Facing Rotation along velocity direction (zero snappy flips)
    // -------------------------------------------------------------------------
    const hasVelocityDir =
      params.isMoving &&
      this.smoothedGroundSpeed > 0.08 &&
      params.moveDirWorld.lengthSq() > 1e-4;

    let desiredYaw = this.facingInitialized ? this.lastFacingYaw : params.yaw + Math.PI;
    let turnLambda = 10.5;

    if (params.thirdPersonPreview) {
      if (hasVelocityDir) {
        // Face smoothly in the exact horizontal velocity direction
        desiredYaw = Math.atan2(params.moveDirWorld.x, params.moveDirWorld.z);
        turnLambda = 12.5;
      } else if (this.rightHandIkHasTarget && this.rightHandIkWeight > 0.05) {
        // When standing still and reaching for a door handle/prop, gently face the handle
        _toIkTargetXZ.set(
          this.rightHandIkTargetWorld.x - params.feetPos.x,
          0,
          this.rightHandIkTargetWorld.z - params.feetPos.z
        );
        if (_toIkTargetXZ.lengthSq() > 0.02) {
          desiredYaw = Math.atan2(_toIkTargetXZ.x, _toIkTargetXZ.z);
          turnLambda = 9.0;
        }
      }
    } else {
      // First-person / overview mode: align smoothly with look direction or forward travel
      desiredYaw = hasVelocityDir
        ? Math.atan2(params.moveDirWorld.x, params.moveDirWorld.z)
        : params.yaw + Math.PI;
      turnLambda = hasVelocityDir ? 13.0 : 10.0;
    }

    _targetFacingQuat.setFromAxisAngle(_upAxis, desiredYaw);
    let actualYawRate = 0;
    if (!this.facingInitialized) {
      this.currentFacingQuat.copy(_targetFacingQuat);
      this.lastFacingYaw = desiredYaw;
      this.prevAppliedYaw = desiredYaw;
      this.facingInitialized = true;
    } else {
      const slerpAlpha = 1 - Math.exp(-turnLambda * safeDt);
      this.currentFacingQuat.slerp(_targetFacingQuat, slerpAlpha);
      this.lastFacingYaw = desiredYaw;
      // Compute true applied yaw rate for natural in-place pivot-stepping footwork
      const curYaw = Math.atan2(
        2 * (this.currentFacingQuat.w * this.currentFacingQuat.y + this.currentFacingQuat.x * this.currentFacingQuat.z),
        1 - 2 * (this.currentFacingQuat.y * this.currentFacingQuat.y + this.currentFacingQuat.z * this.currentFacingQuat.z)
      );
      let yawDelta = ((curYaw - this.prevAppliedYaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      actualYawRate = yawDelta / Math.max(safeDt, 0.001);
      this.prevAppliedYaw = curYaw;
    }
    this.smoothedYawRate = THREE.MathUtils.damp(this.smoothedYawRate, actualYawRate, 12.0, safeDt);
    this.root.quaternion.copy(this.currentFacingQuat);

    // Sync first-person / third-person / overview visibility
    if (params.viewMode === 'overview') {
      this.avatarHolder.visible = true;
      this.avatarHolder.position.set(0, 0, 0);
    } else if (params.thirdPersonPreview) {
      this.avatarHolder.visible = true;
      this.avatarHolder.position.set(0, 0, 0);
    } else if (this.renderPassMode === 'first-person') {
      this.avatarHolder.position.set(0, 0, -0.22);
      this.avatarHolder.visible = this.lastPitch <= -0.62;
    }

    // -------------------------------------------------------------------------
    // 2. Animation Mixer Update (with speed-matched dynamic timeScale)
    // -------------------------------------------------------------------------
    const effectiveSpeed = this.smoothedGroundSpeed;
    const isActuallyMoving = effectiveSpeed > 0.14;
    const isSprinting =
      isActuallyMoving && (effectiveSpeed >= 3.35 || (params.isMoving && params.walkSpeed >= 3.55 && effectiveSpeed >= 2.65));

    let nextState: LocomotionState = 'idle';
    if (isSprinting) {
      nextState = 'run';
    } else if (isActuallyMoving) {
      nextState = 'walk';
    }
    if (nextState !== this.activeMotion) {
      this.activeMotion = nextState;
      this.emitStatus();
    }

    const hasAnyClip = Boolean(
      this.actions.idle || this.actions.walk || this.actions.run
    );

    if (this.mixer && hasAnyClip) {
      let targetSlot: LocomotionState = nextState;
      let fallbackTimeScaleOverride: number | null = null;

      if (targetSlot === 'run' && !this.actions.run) {
        if (this.actions.walk) {
          targetSlot = 'walk';
        } else if (this.actions.idle) {
          targetSlot = 'idle';
        }
      } else if (targetSlot === 'walk' && !this.actions.walk) {
        if (this.actions.run) {
          targetSlot = 'run';
        } else if (this.actions.idle) {
          targetSlot = 'idle';
        }
      } else if (targetSlot === 'idle' && !this.actions.idle) {
        if (this.actions.walk) {
          targetSlot = 'walk';
          fallbackTimeScaleOverride = 0.0;
        } else if (this.actions.run) {
          targetSlot = 'run';
          fallbackTimeScaleOverride = 0.0;
        }
      }

      const blendLambda = 11.5;
      for (const slot of ['idle', 'walk', 'run'] as LocomotionState[]) {
        const targetW = slot === targetSlot ? 1.0 : 0.0;
        this.actionWeights[slot] = THREE.MathUtils.damp(
          this.actionWeights[slot],
          targetW,
          blendLambda,
          safeDt
        );
        const action = this.actions[slot];
        if (action) {
          action.setEffectiveWeight(this.actionWeights[slot]);
          const timeScale =
            slot === targetSlot && fallbackTimeScaleOverride !== null
              ? fallbackTimeScaleOverride
              : this.computeClipTimeScale(slot, Math.max(effectiveSpeed, 0.4));
          action.setEffectiveTimeScale(timeScale);
        }
      }

      // STEP A: Advance skeletal keyframe animations FIRST
      this.mixer.update(safeDt);
    } else {
      // Gentle procedural idle breathing before Mixamo FBX clips are dropped in
      const breath = Math.sin(elapsed * 1.7);
      const chest = this.vrm.humanoid.getNormalizedBoneNode('chest');
      const head = this.vrm.humanoid.getNormalizedBoneNode('head');
      if (chest) {
        chest.rotation.x = breath * 0.02;
      }
      if (head) {
        _tmpEuler.set(
          THREE.MathUtils.clamp(-params.pitch * 0.35, -0.32, 0.32),
          Math.sin(elapsed * 0.55) * 0.06,
          0
        );
        head.rotation.copy(_tmpEuler);
      }
    }

    // -------------------------------------------------------------------------
    // 2B. Natural Turn-In-Place Pivot Footwork (原地转身时腿脚交替踩步与重心微移!)
    // -------------------------------------------------------------------------
    const absYawRate = Math.abs(this.smoothedYawRate);
    if (!isActuallyMoving && absYawRate > 0.14) {
      this.turnDirectionSign = this.smoothedYawRate >= 0 ? 1 : -1;
      this.turnFootworkBlend = THREE.MathUtils.damp(this.turnFootworkBlend, 1.0, 10.5, safeDt);
      this.turnStepPhase += safeDt * (5.6 + Math.min(3.8, absYawRate) * 1.25);
    } else {
      this.turnFootworkBlend = THREE.MathUtils.damp(this.turnFootworkBlend, 0.0, 9.0, safeDt);
      if (this.turnFootworkBlend < 0.005) this.turnFootworkBlend = 0;
    }
    if (this.turnFootworkBlend > 0.005) {
      const b = this.turnFootworkBlend;
      const isVrm1 = this.vrm.meta?.metaVersion === '1';
      const s = isVrm1 ? -1 : 1;
      const dir = this.turnDirectionSign;
      const sinP = Math.sin(this.turnStepPhase);
      const leftLift = Math.max(0, sinP) * b;
      const rightLift = Math.max(0, -sinP) * b;

      const mulBone = (boneName: 'hips' | 'spine' | 'leftUpperLeg' | 'leftLowerLeg' | 'leftFoot' | 'rightUpperLeg' | 'rightLowerLeg' | 'rightFoot' | 'leftUpperArm' | 'rightUpperArm', rx: number, ry: number, rz: number) => {
        const node = this.vrm?.humanoid.getNormalizedBoneNode(boneName);
        if (!node) return;
        this.turnStepEuler.set(rx * s, ry, rz * s, 'YXZ');
        this.turnStepQuat.setFromEuler(this.turnStepEuler);
        node.quaternion.multiply(this.turnStepQuat);
      };

      // Subtle hip weight shift + torso follow-through + gentle arm counter-balance
      mulBone('hips', 0.018 * b, -dir * 0.04 * b, sinP * 0.032 * b);
      mulBone('spine', 0, dir * 0.065 * b, -sinP * 0.018 * b);
      mulBone('leftUpperArm', -0.06 * rightLift, 0, 0);
      mulBone('rightUpperArm', -0.06 * leftLift, 0, 0);

      // Alternating stepping legs: lift thigh, flex knee, and pivot ankle/toe into the turn!
      mulBone('leftUpperLeg', -0.18 * leftLift, dir * 0.16 * leftLift, -0.025 * leftLift);
      mulBone('leftLowerLeg', 0.34 * leftLift, 0, 0);
      mulBone('leftFoot', -0.17 * leftLift, dir * 0.18 * leftLift, 0);

      mulBone('rightUpperLeg', -0.18 * rightLift, dir * 0.16 * rightLift, 0.025 * rightLift);
      mulBone('rightLowerLeg', 0.34 * rightLift, 0, 0);
      mulBone('rightFoot', -0.17 * rightLift, dir * 0.18 * rightLift, 0);
    }

    // -------------------------------------------------------------------------
    // 3. STEP B: Analytic Two-Bone IK & Finger Grasp Override AFTER mixer.update
    // -------------------------------------------------------------------------
    if (this.rightHandIkHasTarget && this.rightHandIkWeight > 1e-4) {
      // Ensure normalized humanoid bone world matrices reflect the latest mixer.update() pose
      this.root.updateMatrixWorld(true);

      const polePos = this.rightHandIkHasCustomPole
        ? this.rightHandIkCustomPole
        : this.computeDefaultRightElbowPole(this.vrm, _computedPoleWorld)
          ? _computedPoleWorld
          : null;

      if (polePos) {
        solveRightArmTwoBoneIK(this.vrm, {
          targetWorldPos: this.rightHandIkTargetWorld,
          poleWorldPos: polePos,
          weight: this.rightHandIkWeight,
          handTargetWorldQuat: this.rightHandIkHasCustomQuat
            ? this.rightHandIkCustomQuat
            : null,
          palmBackOffset: this.rightHandIkPalmOffset,
        });
      }
    }

    if (this.rightHandGraspWeight > 1e-4) {
      applyRightHandFingerGrasp(
        this.vrm,
        this.rightHandGraspWeight,
        this.rightHandGraspPreset
      );
    }

    // Subtle natural eye blinking via VRM ExpressionManager
    if (this.vrm.expressionManager) {
      if (this.blinkElapsed >= 0) {
        this.blinkElapsed += safeDt;
        const dur = 0.16;
        if (this.blinkElapsed >= dur) {
          this.blinkElapsed = -1;
          this.vrm.expressionManager.setValue('blink', 0);
          this.blinkTimer = 2.8 + (Math.sin(elapsed * 1.91) * 0.5 + 0.5) * 3.0;
        } else {
          const p = this.blinkElapsed / dur;
          const v = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
          this.vrm.expressionManager.setValue('blink', THREE.MathUtils.clamp(v, 0, 1));
        }
      } else {
        this.blinkTimer -= safeDt;
        if (this.blinkTimer <= 0) {
          this.blinkElapsed = 0;
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. STEP C: VRM Update LAST (copies normalized bones incl. IK -> raw bones + SpringBones)
    // -------------------------------------------------------------------------
    this.vrm.update(safeDt);
  }

  private updateSeatedOnSofa(
    safeDt: number,
    elapsed: number,
    params: VrmAvatarUpdateParams
  ): void {
    const vrm = this.vrm;
    if (!vrm) return;

    const s = vrm.meta?.metaVersion === '0' ? -1 : 1;
    const baseYaw = params.sofaBaseYaw ?? params.yaw;
    const sofaFacingYaw = baseYaw + Math.PI;
    this.currentFacingQuat.setFromAxisAngle(_upAxis, sofaFacingYaw);
    this.lastFacingYaw = sofaFacingYaw;
    this.facingInitialized = true;
    this.root.quaternion.copy(this.currentFacingQuat);

    const dropY = this.computeSofaHipsDropY();
    this.avatarHolder.visible = true;
    if (params.viewMode === 'overview' || params.thirdPersonPreview || this.renderPassMode !== 'first-person') {
      this.avatarHolder.position.set(0, dropY, 0);
    } else {
      this.avatarHolder.position.set(0, dropY, -0.18);
    }

    let relYaw = params.yaw - baseYaw;
    while (relYaw > Math.PI) relYaw -= Math.PI * 2;
    while (relYaw < -Math.PI) relYaw += Math.PI * 2;

    vrm.humanoid.resetNormalizedPose();

    const setBone = (
      boneName: Parameters<typeof vrm.humanoid.getNormalizedBoneNode>[0],
      rx: number,
      ry: number,
      rz: number,
      order: THREE.EulerOrder = 'YXZ'
    ) => {
      const node = vrm.humanoid.getNormalizedBoneNode(boneName);
      if (!node) return;
      node.rotation.order = order;
      node.rotation.set(rx * s, ry, rz * s);
    };

    const breath = Math.sin(elapsed * 1.45);
    const torsoTurn = THREE.MathUtils.clamp(relYaw * 0.20, -0.24, 0.24);

    // 1. Torso & Seated Legs (thighs flush on cushion, shins vertical)
    setBone('spine', -0.05 + breath * 0.008, torsoTurn * 0.45, 0, 'YXZ');
    setBone('chest', -0.03 + breath * 0.012, torsoTurn * 0.55, 0, 'YXZ');
    setBone('leftUpperLeg', -1.46, -0.06, -0.04, 'YXZ');
    setBone('rightUpperLeg', -1.46, 0.06, 0.04, 'YXZ');
    setBone('leftLowerLeg', 1.48, 0, 0, 'YXZ');
    setBone('rightLowerLeg', 1.48, 0, 0, 'YXZ');
    setBone('leftFoot', 0.04, 0, 0, 'YXZ');
    setBone('rightFoot', 0.04, 0, 0, 'YXZ');

    // 2. Smooth continuous arm poses across: lap rest ('none') -> reaching -> holding controller
    const coPlayMode = params.coPlayMode ?? 'none';
    const reachP = THREE.MathUtils.clamp(params.coPlayReachProgress ?? 0, 0, 1);
    const inX = THREE.MathUtils.clamp(params.coPlayInputX ?? 0, -1, 1);
    const inY = THREE.MathUtils.clamp(params.coPlayInputY ?? 0, -1, 1);
    const pulse = THREE.MathUtils.clamp(params.coPlayActionPulse ?? 0, 0, 1.2);

    // Default relaxed lap-rest targets
    let tLUx = 0.34 + breath * 0.01;
    let tLUy = -0.20;
    let tLUz = -1.16;
    let tLLx = -0.06;
    let tLLy = -0.78;
    let tLLz = 0;
    let tLHx = 0.08;
    let tLHy = 0.08;
    let tLHz = 0.04;

    let tRUx = 0.34 + breath * 0.01;
    let tRUy = 0.20;
    let tRUz = 1.16;
    let tRLx = 0.06;
    let tRLy = 0.78;
    let tRLz = 0;
    let tRHx = 0.08;
    let tRHy = -0.08;
    let tRHz = -0.04;

    let showController = false;

    if (coPlayMode === 'reaching') {
      if (reachP < 0.54) {
        const raw = reachP / 0.54;
        const ext = raw * raw * (3 - 2 * raw);
        // Heroine sits on protagonist's left (-Z = +X local): left arm smoothly reaches from lap to take white pad
        tLUx = THREE.MathUtils.lerp(0.34, -0.76, ext);
        tLUy = THREE.MathUtils.lerp(-0.20, -0.32, ext);
        tLUz = THREE.MathUtils.lerp(-1.16, -0.84, ext);
        tLLx = THREE.MathUtils.lerp(-0.06, -0.04, ext);
        tLLy = THREE.MathUtils.lerp(-0.78, -0.42, ext);
        tLHx = THREE.MathUtils.lerp(0.08, 0.12, ext);

        // Right arm gently lifts slightly ready to receive controller with both hands
        tRUx = THREE.MathUtils.lerp(0.34, 0.40, ext);
        tRUy = THREE.MathUtils.lerp(0.20, 0.36, ext);
        tRUz = THREE.MathUtils.lerp(1.16, 1.08, ext);
        tRLy = THREE.MathUtils.lerp(0.78, 1.08, ext);
      } else {
        showController = true;
        const pull = (reachP - 0.54) / 0.46;
        const smoothPull = pull * pull * (3 - 2 * pull);
        tLUx = THREE.MathUtils.lerp(-0.76, 0.42, smoothPull);
        tLUy = THREE.MathUtils.lerp(-0.32, -0.46, smoothPull);
        tLUz = THREE.MathUtils.lerp(-0.84, -1.04, smoothPull);
        tLLx = THREE.MathUtils.lerp(-0.04, -0.08, smoothPull);
        tLLy = THREE.MathUtils.lerp(-0.42, -1.34, smoothPull);
        tLHx = THREE.MathUtils.lerp(0.12, 0.14, smoothPull);
        tLHy = THREE.MathUtils.lerp(0.08, 0.16, smoothPull);
        tLHz = THREE.MathUtils.lerp(0.04, 0.12, smoothPull);

        tRUx = THREE.MathUtils.lerp(0.40, 0.42, smoothPull);
        tRUy = THREE.MathUtils.lerp(0.36, 0.46, smoothPull);
        tRUz = THREE.MathUtils.lerp(1.08, 1.04, smoothPull);
        tRLx = THREE.MathUtils.lerp(0.06, 0.08, smoothPull);
        tRLy = THREE.MathUtils.lerp(1.08, 1.34, smoothPull);
        tRHx = THREE.MathUtils.lerp(0.08, 0.14, smoothPull);
        tRHy = THREE.MathUtils.lerp(-0.08, -0.16, smoothPull);
        tRHz = THREE.MathUtils.lerp(-0.04, -0.12, smoothPull);
      }
    } else if (coPlayMode === 'holding') {
      showController = true;
      const tilt = inX * 0.05 + pulse * 0.08;
      tLUx = 0.42 - inY * 0.03 + tilt * 0.35 + breath * 0.01;
      tLUy = -0.46;
      tLUz = -1.04;
      tLLx = -0.08;
      tLLy = -1.34 + tilt * 0.22;
      tLHx = 0.14;
      tLHy = 0.16;
      tLHz = 0.12;

      tRUx = 0.42 - inY * 0.03 - tilt * 0.35 + breath * 0.01;
      tRUy = 0.46;
      tRUz = 1.04;
      tRLx = 0.08;
      tRLy = 1.34 - tilt * 0.22;
      tRHx = 0.14;
      tRHy = -0.16;
      tRHz = -0.12;
    }

    const armDamp = 8.5;
    this.sofaLU.set(
      THREE.MathUtils.damp(this.sofaLU.x, tLUx, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaLU.y, tLUy, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaLU.z, tLUz, armDamp, safeDt)
    );
    this.sofaRU.set(
      THREE.MathUtils.damp(this.sofaRU.x, tRUx, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaRU.y, tRUy, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaRU.z, tRUz, armDamp, safeDt)
    );
    this.sofaLL.set(
      THREE.MathUtils.damp(this.sofaLL.x, tLLx, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaLL.y, tLLy, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaLL.z, tLLz, armDamp, safeDt)
    );
    this.sofaRL.set(
      THREE.MathUtils.damp(this.sofaRL.x, tRLx, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaRL.y, tRLy, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaRL.z, tRLz, armDamp, safeDt)
    );
    this.sofaLH.set(
      THREE.MathUtils.damp(this.sofaLH.x, tLHx, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaLH.y, tLHy, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaLH.z, tLHz, armDamp, safeDt)
    );
    this.sofaRH.set(
      THREE.MathUtils.damp(this.sofaRH.x, tRHx, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaRH.y, tRHy, armDamp, safeDt),
      THREE.MathUtils.damp(this.sofaRH.z, tRHz, armDamp, safeDt)
    );

    setBone('leftShoulder', 0.02, 0.04, -0.02, 'YXZ');
    setBone('rightShoulder', 0.02, -0.04, 0.02, 'YXZ');
    setBone('leftUpperArm', this.sofaLU.x, this.sofaLU.y, this.sofaLU.z, 'ZYX');
    setBone('rightUpperArm', this.sofaRU.x, this.sofaRU.y, this.sofaRU.z, 'ZYX');
    setBone('leftLowerArm', this.sofaLL.x, this.sofaLL.y, this.sofaLL.z, 'YXZ');
    setBone('rightLowerArm', this.sofaRL.x, this.sofaRL.y, this.sofaRL.z, 'YXZ');
    setBone('leftHand', this.sofaLH.x, this.sofaLH.y, this.sofaLH.z, 'XYZ');
    setBone('rightHand', this.sofaRH.x, this.sofaRH.y, this.sofaRH.z, 'XYZ');

    vrm.update(safeDt);
    this.syncHeadVisibilityForPass(this.renderPassMode);

    // 3. Position real white Xbox controller right between the VRM's seated hands
    if (this.heldControllerMesh) {
      const lHand = vrm.humanoid.getRawBoneNode('leftHand');
      const rHand = vrm.humanoid.getRawBoneNode('rightHand');
      if (showController && lHand && rHand) {
        this.root.updateMatrixWorld(true);
        lHand.getWorldPosition(this._padLeftPos);
        rHand.getWorldPosition(this._padRightPos);
        this._padMidPos.addVectors(this._padLeftPos, this._padRightPos).multiplyScalar(0.5);
        this.root.worldToLocal(this._padMidPos);
        this.heldControllerMesh.visible = true;
        this.heldControllerMesh.position.set(
          this._padMidPos.x,
          this._padMidPos.y - 0.012,
          this._padMidPos.z + 0.02
        );
        this.heldControllerMesh.rotation.set(
          -0.46 - inY * 0.06 + pulse * 0.08,
          Math.PI,
          -inX * 0.08
        );
      } else {
        this.heldControllerMesh.visible = false;
      }
    }
  }

  private disposeCurrentVrm(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.actions = {};
    this.clipNativeSpeeds = {};
    this.rightHandIkHasTarget = false;
    this.rightHandIkTargetWeight = 0;
    this.rightHandIkWeight = 0;
    this.rightHandGraspTarget = 0;
    this.rightHandGraspWeight = 0;
    if (this.vrm) {
      this.avatarHolder.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    this.root.visible = false;
  }

  public dispose(): void {
    this.disposed = true;
    this.disposeCurrentVrm();
    this.heroine.dispose();
    this.fbxAssets = {};
  }
}
