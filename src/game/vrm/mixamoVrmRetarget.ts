import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

/**
 * Standard Mixamo bone suffix -> @pixiv/three-vrm v3 VRMHumanBoneName map.
 * Supports prefixes like `mixamorig`, `mixamorig:`, `mixamorig1`, `mixamorig_`, or unprefixed Mixamo names.
 */
const MIXAMO_SUFFIX_TO_VRM: Record<string, VRMHumanBoneName> = {
  Hips: 'hips',
  Spine: 'spine',
  Spine1: 'chest',
  Spine2: 'upperChest',
  Neck: 'neck',
  Head: 'head',

  LeftShoulder: 'leftShoulder',
  LeftArm: 'leftUpperArm',
  LeftForeArm: 'leftLowerArm',
  LeftHand: 'leftHand',
  LeftHandThumb1: 'leftThumbMetacarpal',
  LeftHandThumb2: 'leftThumbProximal',
  LeftHandThumb3: 'leftThumbDistal',
  LeftHandIndex1: 'leftIndexProximal',
  LeftHandIndex2: 'leftIndexIntermediate',
  LeftHandIndex3: 'leftIndexDistal',
  LeftHandMiddle1: 'leftMiddleProximal',
  LeftHandMiddle2: 'leftMiddleIntermediate',
  LeftHandMiddle3: 'leftMiddleDistal',
  LeftHandRing1: 'leftRingProximal',
  LeftHandRing2: 'leftRingIntermediate',
  LeftHandRing3: 'leftRingDistal',
  LeftHandPinky1: 'leftLittleProximal',
  LeftHandPinky2: 'leftLittleIntermediate',
  LeftHandPinky3: 'leftLittleDistal',

  RightShoulder: 'rightShoulder',
  RightArm: 'rightUpperArm',
  RightForeArm: 'rightLowerArm',
  RightHand: 'rightHand',
  RightHandThumb1: 'rightThumbMetacarpal',
  RightHandThumb2: 'rightThumbProximal',
  RightHandThumb3: 'rightThumbDistal',
  RightHandIndex1: 'rightIndexProximal',
  RightHandIndex2: 'rightIndexIntermediate',
  RightHandIndex3: 'rightIndexDistal',
  RightHandMiddle1: 'rightMiddleProximal',
  RightHandMiddle2: 'rightMiddleIntermediate',
  RightHandMiddle3: 'rightMiddleDistal',
  RightHandRing1: 'rightRingProximal',
  RightHandRing2: 'rightRingIntermediate',
  RightHandRing3: 'rightRingDistal',
  RightHandPinky1: 'rightLittleProximal',
  RightHandPinky2: 'rightLittleIntermediate',
  RightHandPinky3: 'rightLittleDistal',

  LeftUpLeg: 'leftUpperLeg',
  LeftLeg: 'leftLowerLeg',
  LeftFoot: 'leftFoot',
  LeftToeBase: 'leftToes',

  RightUpLeg: 'rightUpperLeg',
  RightLeg: 'rightLowerLeg',
  RightFoot: 'rightFoot',
  RightToeBase: 'rightToes',
};

function resolveMixamoBoneToVrm(mixamoName: string): VRMHumanBoneName | undefined {
  // Normalize prefixes such as "mixamorig:Hips", "mixamorigHips", "mixamorig1:Hips", "Armature|mixamorigHips"
  const afterPipe = mixamoName.includes('|')
    ? mixamoName.slice(mixamoName.lastIndexOf('|') + 1)
    : mixamoName;
  const stripped = afterPipe.replace(/^mixamorig[\d_:-]*/i, '');
  if (MIXAMO_SUFFIX_TO_VRM[stripped]) {
    return MIXAMO_SUFFIX_TO_VRM[stripped];
  }
  // Case-insensitive fallback
  const lower = stripped.toLowerCase();
  for (const [k, v] of Object.entries(MIXAMO_SUFFIX_TO_VRM)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function findMixamoHipsNode(asset: THREE.Group): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  asset.traverse((obj) => {
    if (found) return;
    if (resolveMixamoBoneToVrm(obj.name) === 'hips') {
      found = obj;
    }
  });
  return found;
}

const _vec3 = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _restRotationInverse = new THREE.Quaternion();
const _parentRestWorldRotation = new THREE.Quaternion();
const _vrmHipsWorld = new THREE.Vector3();
const _vrmRootWorld = new THREE.Vector3();
const _vrmSceneScale = new THREE.Vector3();
const _mixamoHipsWorld = new THREE.Vector3();
const _mixamoRootWorld = new THREE.Vector3();

export interface RetargetedMixamoClipResult {
  clip: THREE.AnimationClip;
  /** Measured root-motion horizontal speed (m/s) if the clip wasn't exported "In Place", else null */
  nativeSpeed: number | null;
  /** Target VRM hips rest height (world meters) for stride-length calibration */
  vrmHipsHeight: number;
}

/**
 * Retargets a loaded Mixamo FBX animation group onto a @pixiv/three-vrm v3 VRM instance.
 * - Handles both VRM 0.x and VRM 1.0 coordinate handedness cleanly.
 * - Scales hips vertical motion in unscaled VRM local space so `vrm.scene.scale` height
 *   calibration is never applied twice (zero height pop between idle/walk/procedural poses).
 * - Strips linear horizontal root-motion drift (X/Z) so non-"In Place" Mixamo walk/run clips
 *   stay locked neatly onto the character's movement controller while keeping natural bounce & sway.
 */
export function retargetMixamoFbxToVrmWithMeta(
  fbxAsset: THREE.Group,
  vrm: VRM,
  clipName: string
): RetargetedMixamoClipResult | null {
  const sourceClip =
    THREE.AnimationClip.findByName(fbxAsset.animations, 'mixamo.com') ??
    fbxAsset.animations[0];
  if (!sourceClip || sourceClip.tracks.length === 0) {
    return null;
  }

  fbxAsset.updateMatrixWorld(true);
  vrm.scene.updateMatrixWorld(true);

  const isVrm0 = vrm.meta?.metaVersion === '0';

  // Compute Mixamo -> VRM hips height scale ratio (keeping local bone space separate from vrm.scene world scale)
  const mixamoHips = findMixamoHipsNode(fbxAsset);
  let motionHipsHeight = 100.0;
  if (mixamoHips) {
    if (Math.abs(mixamoHips.position.y) > 1e-3) {
      motionHipsHeight = Math.abs(mixamoHips.position.y);
    } else {
      mixamoHips.getWorldPosition(_mixamoHipsWorld);
      fbxAsset.getWorldPosition(_mixamoRootWorld);
      const dy = Math.abs(_mixamoHipsWorld.y - _mixamoRootWorld.y);
      if (dy > 1e-3) motionHipsHeight = dy;
    }
  }

  vrm.scene.getWorldScale(_vrmSceneScale);
  const vrmScaleY = Math.max(0.01, Math.abs(_vrmSceneScale.y));

  const vrmHipsNode = vrm.humanoid.getNormalizedBoneNode('hips');
  let vrmWorldHipsHeight = 0.92;
  let vrmLocalHipsHeight = 0.92 / vrmScaleY;
  if (vrmHipsNode) {
    vrmHipsNode.getWorldPosition(_vrmHipsWorld);
    vrm.scene.getWorldPosition(_vrmRootWorld);
    const dy = Math.abs(_vrmHipsWorld.y - _vrmRootWorld.y);
    if (dy > 0.1) vrmWorldHipsHeight = dy;

    const restLocalY = vrm.humanoid.normalizedRestPose?.hips?.position?.[1];
    if (typeof restLocalY === 'number' && Math.abs(restLocalY) > 0.1) {
      vrmLocalHipsHeight = Math.abs(restLocalY);
      vrmWorldHipsHeight = vrmLocalHipsHeight * vrmScaleY;
    } else {
      vrmLocalHipsHeight = vrmWorldHipsHeight / vrmScaleY;
    }
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const duration = sourceClip.duration;
  let measuredNativeSpeed: number | null = null;

  for (const track of sourceClip.tracks) {
    const dotIdx = track.name.lastIndexOf('.');
    if (dotIdx <= 0) continue;

    const mixamoRigName = track.name.slice(0, dotIdx);
    const propertyName = track.name.slice(dotIdx + 1);

    const vrmBoneName = resolveMixamoBoneToVrm(mixamoRigName);
    if (!vrmBoneName) continue;

    const vrmNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);
    const vrmNodeName = vrmNode?.name;
    if (!vrmNodeName) continue;

    const mixamoRigNode = fbxAsset.getObjectByName(mixamoRigName);
    if (!mixamoRigNode) continue;

    if (track instanceof THREE.QuaternionKeyframeTrack && propertyName === 'quaternion') {
      mixamoRigNode.getWorldQuaternion(_restRotationInverse).invert();
      if (mixamoRigNode.parent) {
        mixamoRigNode.parent.getWorldQuaternion(_parentRestWorldRotation);
      } else {
        _parentRestWorldRotation.identity();
      }

      const rawValues = track.values;
      const outValues = new Float32Array(rawValues.length);

      for (let i = 0; i < rawValues.length; i += 4) {
        _quatA.set(
          rawValues[i],
          rawValues[i + 1],
          rawValues[i + 2],
          rawValues[i + 3]
        );
        // Official @pixiv/three-vrm v3 normalized bone quaternion retargeting:
        // q_retargeted = parentRestWorldRotation * q_source * inv(restWorldRotation)
        _quatA
          .premultiply(_parentRestWorldRotation)
          .multiply(_restRotationInverse);

        if (isVrm0) {
          outValues[i] = -_quatA.x;
          outValues[i + 1] = _quatA.y;
          outValues[i + 2] = -_quatA.z;
          outValues[i + 3] = _quatA.w;
        } else {
          outValues[i] = _quatA.x;
          outValues[i + 1] = _quatA.y;
          outValues[i + 2] = _quatA.z;
          outValues[i + 3] = _quatA.w;
        }
      }

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.quaternion`,
          track.times,
          outValues
        )
      );
    } else if (
      track instanceof THREE.VectorKeyframeTrack &&
      propertyName === 'position' &&
      vrmBoneName === 'hips'
    ) {
      const rawValues = track.values;
      const sampleCount = Math.floor(rawValues.length / 3);
      if (sampleCount === 0) continue;

      // Guard against Mixamo FBX files whose bind-pose hips Y is lower than their animated standing Y
      // so characters never suddenly stretch taller or float above the floor when switching clips.
      let maxTrackY = 0;
      for (let s = 0; s < sampleCount; s++) {
        const y = rawValues[s * 3 + 1];
        if (y > maxTrackY) maxTrackY = y;
      }
      const effectiveMotionHipsHeight =
        maxTrackY > motionHipsHeight * 1.03 ? maxTrackY / 1.01 : motionHipsHeight;

      const localHipsPositionScale =
        effectiveMotionHipsHeight > 1e-4
          ? vrmLocalHipsHeight / effectiveMotionHipsHeight
          : 0.01;
      const worldHipsPositionScale =
        effectiveMotionHipsHeight > 1e-4
          ? vrmWorldHipsHeight / effectiveMotionHipsHeight
          : 0.01;

      // Remove linear horizontal root-motion travel on X/Z so both "In Place" and traveling
      // Mixamo walk/run clips stay locked cleanly to the character's movement capsule.
      const startX = rawValues[0];
      const startZ = rawValues[2];
      const endX = rawValues[(sampleCount - 1) * 3];
      const endZ = rawValues[(sampleCount - 1) * 3 + 2];
      if (duration > 0.08) {
        const totalHorizMeters =
          Math.hypot(endX - startX, endZ - startZ) * worldHipsPositionScale;
        const estSpeed = totalHorizMeters / duration;
        if (estSpeed >= 0.45 && estSpeed <= 8.0) {
          measuredNativeSpeed = estSpeed;
        }
      }
      const outValues = new Float32Array(rawValues.length);

      for (let s = 0; s < sampleCount; s++) {
        const i3 = s * 3;
        const frac = sampleCount > 1 ? s / (sampleCount - 1) : 0;
        const driftX = startX + (endX - startX) * frac;
        const driftZ = startZ + (endZ - startZ) * frac;

        const relX = (rawValues[i3] - driftX) * localHipsPositionScale;
        const absY = rawValues[i3 + 1] * localHipsPositionScale;
        const relZ = (rawValues[i3 + 2] - driftZ) * localHipsPositionScale;

        _vec3.set(
          isVrm0 ? -relX : relX,
          absY,
          isVrm0 ? -relZ : relZ
        );
        outValues[i3] = _vec3.x;
        outValues[i3 + 1] = _vec3.y;
        outValues[i3 + 2] = _vec3.z;
      }

      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmNodeName}.position`,
          track.times,
          outValues
        )
      );
    }
  }

  if (tracks.length === 0) {
    return null;
  }

  return {
    clip: new THREE.AnimationClip(clipName, duration, tracks),
    nativeSpeed: measuredNativeSpeed,
    vrmHipsHeight: vrmWorldHipsHeight,
  };
}

export function retargetMixamoFbxToVrm(
  fbxAsset: THREE.Group,
  vrm: VRM,
  clipName: string
): THREE.AnimationClip | null {
  return retargetMixamoFbxToVrmWithMeta(fbxAsset, vrm, clipName)?.clip ?? null;
}
