import type { VRMHumanBoneName } from '@pixiv/three-vrm';
import type * as THREE from 'three';
import type {
  HeroineExpressionPreset,
  HeroineGesture,
} from '../../data/bedroomEncounterScript';

export type HeroinePoseId = 'seated' | HeroineGesture;
export type HeroineFingerMode = 'relaxed' | 'open' | 'point' | 'peace' | 'heart';

export interface HeroineExpressionWeights {
  happy: number;
  relaxed: number;
  sad: number;
  angry: number;
  surprised: number;
  wink: number;
}

export interface HeroineWaveMotion {
  speed: number;
  durationSec: number;
  fadeSec: number;
  forearmY: number;
  wristY: number;
}

export interface HeroineSeatedLegs {
  leftUpperLeg: [number, number, number];
  rightUpperLeg: [number, number, number];
  leftLowerLeg: [number, number, number];
  rightLowerLeg: [number, number, number];
  leftFoot: [number, number, number];
  rightFoot: [number, number, number];
}

export interface HeroinePoseDefinition {
  category: 'seated' | 'standing';
  upperArmOrder: THREE.EulerOrder;
  leftShoulder: [number, number, number];
  rightShoulder: [number, number, number];
  leftUpperArm: [number, number, number];
  rightUpperArm: [number, number, number];
  leftLowerArm: [number, number, number];
  rightLowerArm: [number, number, number];
  leftHand: [number, number, number];
  rightHand: [number, number, number];
  head: [number, number, number];
  spineLean: number;
  leftFingerMode: HeroineFingerMode;
  rightFingerMode: HeroineFingerMode;
  /** Which arms this standing gesture layers onto live idle.fbx ('right' keeps left arm & body 100% idle.fbx) */
  armMask?: 'none' | 'right' | 'both';
  /** Optional natural hold duration (seconds) before softly relaxing arms back into live idle.fbx */
  holdSec?: number;
  waveMotion?: HeroineWaveMotion;
  legs?: HeroineSeatedLegs;
}

export interface HeroinePoseListItem {
  id: HeroinePoseId;
  label: string;
  category: 'seated' | 'standing';
}

export interface HeroineExpressionListItem {
  id: HeroineExpressionPreset;
  label: string;
}

export interface HeroineTunerPrefs {
  poseId: HeroinePoseId;
  expression: HeroineExpressionPreset;
}

export const HEROINE_POSE_LIST: readonly HeroinePoseListItem[];
export const HEROINE_EXPRESSION_LIST: readonly HeroineExpressionListItem[];
export const HEROINE_EXPRESSIONS: Record<HeroineExpressionPreset, HeroineExpressionWeights>;
export const HEROINE_LEFT_CURL_FINGERS: readonly (readonly [VRMHumanBoneName, number])[];
export const HEROINE_RIGHT_CURL_FINGERS: readonly (readonly [VRMHumanBoneName, number])[];
export const DEFAULT_HEROINE_POSES: Readonly<Record<HeroinePoseId, HeroinePoseDefinition>>;
export const HEROINE_POSES: Record<HeroinePoseId, HeroinePoseDefinition>;

export function cloneHeroinePose(poseId: HeroinePoseId): HeroinePoseDefinition;
export function cloneDefaultHeroinePose(poseId: HeroinePoseId): HeroinePoseDefinition;
export function saveHeroinePoseOverride(
  poseId: HeroinePoseId,
  pose: HeroinePoseDefinition
): void;
export function resetHeroinePoseOverride(poseId: HeroinePoseId): HeroinePoseDefinition;
export function resetAllHeroinePoseOverrides(): void;
export function hasHeroinePoseOverride(poseId: HeroinePoseId): boolean;
export function getHeroinePoseOverrideCount(): number;
export function exportHeroinePoseOverridesMap(): Record<string, Partial<HeroinePoseDefinition>>;
export function importHeroinePoseOverridesMap(
  raw: Record<string, unknown> | null | undefined
): number;
export function loadHeroineTunerPrefs(): HeroineTunerPrefs;
export function saveHeroineTunerPrefs(prefs: HeroineTunerPrefs): void;
export function formatHeroinePoseSnippet(
  poseId: HeroinePoseId,
  pose: HeroinePoseDefinition,
  expression?: HeroineExpressionPreset
): string;
