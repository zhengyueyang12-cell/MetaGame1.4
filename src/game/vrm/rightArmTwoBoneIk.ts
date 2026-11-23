import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

export type HandGraspPreset = 'relaxed' | 'door' | 'hold' | 'pistol';

export interface TwoBoneIkSolveOptions {
  /** World-space target position for the right hand / palm */
  targetWorldPos: THREE.Vector3;
  /** World-space elbow pole vector hint to prevent elbow inversion */
  poleWorldPos: THREE.Vector3;
  /** Blend weight in [0, 1] between animated pose and solved IK pose */
  weight: number;
  /** Optional world-space target orientation for rightHand */
  handTargetWorldQuat?: THREE.Quaternion | null;
  /**
   * Optional pullback along (shoulder -> target) so the palm/fingers land
   * centered on a door handle or prop instead of the wrist joint clipping inside.
   * Default: 0.045m
   */
  palmBackOffset?: number;
}

// Pre-allocated zero-GC scratch math objects for per-frame Two-Bone IK solving
const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();
const _posC = new THREE.Vector3();
const _posB2 = new THREE.Vector3();
const _posC2 = new THREE.Vector3();
const _effectiveTarget = new THREE.Vector3();
const _aToT = new THREE.Vector3();
const _dirAT = new THREE.Vector3();
const _aToP = new THREE.Vector3();
const _bendDir = new THREE.Vector3();
const _fallbackUp = new THREE.Vector3(0, -1, 0);
const _fallbackSide = new THREE.Vector3(0, 0, -1);
const _solvedB = new THREE.Vector3();
const _solvedC = new THREE.Vector3();
const _curUpperDir = new THREE.Vector3();
const _newUpperDir = new THREE.Vector3();
const _curLowerDir = new THREE.Vector3();
const _newLowerDir = new THREE.Vector3();

const _origUpperLocalQuat = new THREE.Quaternion();
const _origLowerLocalQuat = new THREE.Quaternion();
const _origHandLocalQuat = new THREE.Quaternion();
const _curUpperWorldQuat = new THREE.Quaternion();
const _curLowerWorldQuat = new THREE.Quaternion();
const _deltaUpperWorld = new THREE.Quaternion();
const _deltaLowerWorld = new THREE.Quaternion();
const _newUpperWorldQuat = new THREE.Quaternion();
const _newLowerWorldQuat = new THREE.Quaternion();
const _parentWorldQuatInv = new THREE.Quaternion();
const _ikUpperLocalQuat = new THREE.Quaternion();
const _ikLowerLocalQuat = new THREE.Quaternion();
const _ikHandLocalQuat = new THREE.Quaternion();

const _fingerTargetEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _fingerTargetQuat = new THREE.Quaternion();
const _fingerOrigQuat = new THREE.Quaternion();

/**
 * Analytic Two-Bone IK solver for a VRM right arm chain:
 *   rightUpperArm (A) -> rightLowerArm (B) -> rightHand (C)
 *
 * Operates directly on VRM normalized bone nodes AFTER `mixer.update(delta)` and
 * BEFORE `vrm.update(delta)`, guaranteeing zero animation overwrite and full
 * compatibility with both VRM 0.x and VRM 1.0 skeletons.
 */
export function solveRightArmTwoBoneIK(
  vrm: VRM,
  options: TwoBoneIkSolveOptions
): boolean {
  const w = THREE.MathUtils.clamp(options.weight, 0, 1);
  if (w <= 1e-4) return false;

  const upperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
  const lowerArm = vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
  const hand = vrm.humanoid.getNormalizedBoneNode('rightHand');
  if (!upperArm || !lowerArm || !hand || !upperArm.parent) {
    return false;
  }

  // Save animated local rotations before applying IK
  _origUpperLocalQuat.copy(upperArm.quaternion);
  _origLowerLocalQuat.copy(lowerArm.quaternion);
  _origHandLocalQuat.copy(hand.quaternion);

  // Read current world joint positions from freshly updated matrices
  upperArm.getWorldPosition(_posA);
  lowerArm.getWorldPosition(_posB);
  hand.getWorldPosition(_posC);

  const len1 = _posA.distanceTo(_posB);
  const len2 = _posB.distanceTo(_posC);
  if (len1 < 1e-4 || len2 < 1e-4) {
    return false;
  }

  // Pull wrist target slightly back toward shoulder so palm/fingers wrap around the anchor
  _aToT.subVectors(options.targetWorldPos, _posA);
  const rawDist = _aToT.length();
  if (rawDist < 1e-4) {
    return false;
  }
  _dirAT.copy(_aToT).divideScalar(rawDist);

  const palmBack = options.palmBackOffset ?? 0.045;
  const adjustedDist = Math.max(0.05, rawDist - palmBack);
  _effectiveTarget.copy(_posA).addScaledVector(_dirAT, adjustedDist);

  // Clamp distance strictly inside triangle inequality bounds (leaving tiny 0.4% bend margin)
  const minDist = Math.abs(len1 - len2) + 0.015;
  const maxDist = (len1 + len2) * 0.996;
  const d = THREE.MathUtils.clamp(adjustedDist, minDist, maxDist);

  // Analytic Law of Cosines for shoulder angle alpha inside the IK plane
  const cosAlpha = THREE.MathUtils.clamp(
    (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d),
    -1,
    1
  );
  const alpha = Math.acos(cosAlpha);

  // Build elbow bend direction perpendicular to shoulder->target using the Pole Vector
  _aToP.subVectors(options.poleWorldPos, _posA);
  _bendDir.copy(_aToP).addScaledVector(_dirAT, -_aToP.dot(_dirAT));
  if (_bendDir.lengthSq() < 1e-6) {
    // Fallback if pole lies colinear with shoulder->target
    _bendDir.copy(_fallbackUp).addScaledVector(_dirAT, -_fallbackUp.dot(_dirAT));
    if (_bendDir.lengthSq() < 1e-6) {
      _bendDir.copy(_fallbackSide).addScaledVector(_dirAT, -_fallbackSide.dot(_dirAT));
    }
  }
  _bendDir.normalize();

  // Solved world-space elbow B and wrist C positions
  _solvedB
    .copy(_posA)
    .addScaledVector(_dirAT, len1 * Math.cos(alpha))
    .addScaledVector(_bendDir, len1 * Math.sin(alpha));
  _solvedC.copy(_posA).addScaledVector(_dirAT, d);

  // 1. Solve upperArm rotation aligning (B - A) -> (solvedB - A)
  _curUpperDir.subVectors(_posB, _posA);
  _newUpperDir.subVectors(_solvedB, _posA);
  if (_curUpperDir.lengthSq() > 1e-8 && _newUpperDir.lengthSq() > 1e-8) {
    _curUpperDir.normalize();
    _newUpperDir.normalize();
    _deltaUpperWorld.setFromUnitVectors(_curUpperDir, _newUpperDir);

    upperArm.getWorldQuaternion(_curUpperWorldQuat);
    _newUpperWorldQuat.copy(_deltaUpperWorld).multiply(_curUpperWorldQuat);

    upperArm.parent.getWorldQuaternion(_parentWorldQuatInv).invert();
    _ikUpperLocalQuat.copy(_parentWorldQuatInv).multiply(_newUpperWorldQuat);

    upperArm.quaternion.copy(_origUpperLocalQuat).slerp(_ikUpperLocalQuat, w);
    upperArm.updateMatrixWorld(true);
  }

  // 2. Solve lowerArm rotation aligning updated (C2 - B2) -> (solvedC - B2)
  lowerArm.getWorldPosition(_posB2);
  hand.getWorldPosition(_posC2);
  _curLowerDir.subVectors(_posC2, _posB2);
  _newLowerDir.subVectors(_solvedC, _posB2);
  if (_curLowerDir.lengthSq() > 1e-8 && _newLowerDir.lengthSq() > 1e-8) {
    _curLowerDir.normalize();
    _newLowerDir.normalize();
    _deltaLowerWorld.setFromUnitVectors(_curLowerDir, _newLowerDir);

    lowerArm.getWorldQuaternion(_curLowerWorldQuat);
    _newLowerWorldQuat.copy(_deltaLowerWorld).multiply(_curLowerWorldQuat);

    upperArm.getWorldQuaternion(_parentWorldQuatInv).invert();
    _ikLowerLocalQuat.copy(_parentWorldQuatInv).multiply(_newLowerWorldQuat);

    lowerArm.quaternion.copy(_origLowerLocalQuat).slerp(_ikLowerLocalQuat, w);
    lowerArm.updateMatrixWorld(true);
  }

  // 3. Optional wrist orientation alignment for held props / door handles
  if (options.handTargetWorldQuat) {
    lowerArm.getWorldQuaternion(_parentWorldQuatInv).invert();
    _ikHandLocalQuat
      .copy(_parentWorldQuatInv)
      .multiply(options.handTargetWorldQuat);
    hand.quaternion.copy(_origHandLocalQuat).slerp(_ikHandLocalQuat, w);
    hand.updateMatrixWorld(true);
  }

  return true;
}

interface FingerCurlSpec {
  bone: VRMHumanBoneName;
  /** Local Euler angles [rx, ry, rz] in VRM normalized bone space (right arm = -X, palm = -Y -> +Z curls inward) */
  rot: readonly [number, number, number];
}

const GRASP_PRESETS: Record<HandGraspPreset, readonly FingerCurlSpec[]> = {
  relaxed: [
    { bone: 'rightThumbMetacarpal', rot: [0.05, 0.14, 0.12] },
    { bone: 'rightThumbProximal', rot: [0.0, 0.08, 0.12] },
    { bone: 'rightThumbDistal', rot: [0.0, 0.05, 0.10] },
    { bone: 'rightIndexProximal', rot: [0, 0, 0.18] },
    { bone: 'rightIndexIntermediate', rot: [0, 0, 0.22] },
    { bone: 'rightIndexDistal', rot: [0, 0, 0.16] },
    { bone: 'rightMiddleProximal', rot: [0, 0, 0.22] },
    { bone: 'rightMiddleIntermediate', rot: [0, 0, 0.26] },
    { bone: 'rightMiddleDistal', rot: [0, 0, 0.18] },
    { bone: 'rightRingProximal', rot: [0, 0, 0.26] },
    { bone: 'rightRingIntermediate', rot: [0, 0, 0.30] },
    { bone: 'rightRingDistal', rot: [0, 0, 0.20] },
    { bone: 'rightLittleProximal', rot: [0, 0, 0.30] },
    { bone: 'rightLittleIntermediate', rot: [0, 0, 0.32] },
    { bone: 'rightLittleDistal', rot: [0, 0, 0.22] },
  ],
  door: [
    { bone: 'rightThumbMetacarpal', rot: [0.12, 0.38, 0.26] },
    { bone: 'rightThumbProximal', rot: [0.04, 0.18, 0.28] },
    { bone: 'rightThumbDistal', rot: [0.0, 0.08, 0.24] },
    { bone: 'rightIndexProximal', rot: [0, 0, 0.58] },
    { bone: 'rightIndexIntermediate', rot: [0, 0, 0.72] },
    { bone: 'rightIndexDistal', rot: [0, 0, 0.42] },
    { bone: 'rightMiddleProximal', rot: [0, 0, 0.66] },
    { bone: 'rightMiddleIntermediate', rot: [0, 0, 0.80] },
    { bone: 'rightMiddleDistal', rot: [0, 0, 0.48] },
    { bone: 'rightRingProximal', rot: [0, 0, 0.70] },
    { bone: 'rightRingIntermediate', rot: [0, 0, 0.84] },
    { bone: 'rightRingDistal', rot: [0, 0, 0.50] },
    { bone: 'rightLittleProximal', rot: [0, 0, 0.74] },
    { bone: 'rightLittleIntermediate', rot: [0, 0, 0.86] },
    { bone: 'rightLittleDistal', rot: [0, 0, 0.52] },
  ],
  hold: [
    { bone: 'rightThumbMetacarpal', rot: [0.18, 0.52, 0.36] },
    { bone: 'rightThumbProximal', rot: [0.08, 0.24, 0.42] },
    { bone: 'rightThumbDistal', rot: [0.0, 0.10, 0.38] },
    { bone: 'rightIndexProximal', rot: [0, 0, 0.92] },
    { bone: 'rightIndexIntermediate', rot: [0, 0, 1.05] },
    { bone: 'rightIndexDistal', rot: [0, 0, 0.65] },
    { bone: 'rightMiddleProximal', rot: [0, 0, 0.98] },
    { bone: 'rightMiddleIntermediate', rot: [0, 0, 1.12] },
    { bone: 'rightMiddleDistal', rot: [0, 0, 0.68] },
    { bone: 'rightRingProximal', rot: [0, 0, 1.02] },
    { bone: 'rightRingIntermediate', rot: [0, 0, 1.15] },
    { bone: 'rightRingDistal', rot: [0, 0, 0.72] },
    { bone: 'rightLittleProximal', rot: [0, 0, 1.05] },
    { bone: 'rightLittleIntermediate', rot: [0, 0, 1.16] },
    { bone: 'rightLittleDistal', rot: [0, 0, 0.72] },
  ],
  pistol: [
    { bone: 'rightThumbMetacarpal', rot: [0.12, 0.44, 0.28] },
    { bone: 'rightThumbProximal', rot: [0.05, 0.16, 0.24] },
    { bone: 'rightThumbDistal', rot: [0.0, 0.06, 0.18] },
    // Index finger lightly curved on trigger
    { bone: 'rightIndexProximal', rot: [0, 0, 0.28] },
    { bone: 'rightIndexIntermediate', rot: [0, 0, 0.48] },
    { bone: 'rightIndexDistal', rot: [0, 0, 0.35] },
    // Middle, ring, little fingers wrapped tightly around grip
    { bone: 'rightMiddleProximal', rot: [0, 0, 1.02] },
    { bone: 'rightMiddleIntermediate', rot: [0, 0, 1.18] },
    { bone: 'rightMiddleDistal', rot: [0, 0, 0.72] },
    { bone: 'rightRingProximal', rot: [0, 0, 1.06] },
    { bone: 'rightRingIntermediate', rot: [0, 0, 1.20] },
    { bone: 'rightRingDistal', rot: [0, 0, 0.74] },
    { bone: 'rightLittleProximal', rot: [0, 0, 1.10] },
    { bone: 'rightLittleIntermediate', rot: [0, 0, 1.22] },
    { bone: 'rightLittleDistal', rot: [0, 0, 0.76] },
  ],
};

/**
 * Applies a smooth local-space finger curl/grasp gesture to VRM normalized right-hand
 * finger bones. Safe on VRMs missing optional finger bones (skips missing bones gracefully).
 */
export function applyRightHandFingerGrasp(
  vrm: VRM,
  weight: number,
  preset: HandGraspPreset = 'hold'
): void {
  const w = THREE.MathUtils.clamp(weight, 0, 1);
  if (w <= 1e-4) return;

  const specs = GRASP_PRESETS[preset];
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const node = vrm.humanoid.getNormalizedBoneNode(spec.bone);
    if (!node) continue;

    _fingerOrigQuat.copy(node.quaternion);
    _fingerTargetEuler.set(spec.rot[0], spec.rot[1], spec.rot[2], 'XYZ');
    _fingerTargetQuat.setFromEuler(_fingerTargetEuler);
    node.quaternion.copy(_fingerOrigQuat).slerp(_fingerTargetQuat, w);
  }
}
