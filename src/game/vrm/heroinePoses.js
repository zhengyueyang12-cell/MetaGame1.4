/**
 * 独立的女主姿态与表情配置文件 (heroinePoses.js)
 *
 * 与主场景、剧情脚本完全解耦，所有程序化骨骼角度（弧度制，VRM 1.0 标准坐标系，
 * 控制器会自动为 VRM 0.x 做共轭映射）与原生 VRM 表情权重均集中在此维护。
 * 支持自动持久化用户在「实时捏动作」中微调后的参数到 localStorage，刷新后自动恢复。
 *
 * 坐标系参考（VRM 1.0 规范空间，+Z 朝前，+Y 朝上，+X 朝角色左侧）：
 * - leftUpperArm / rightUpperArm：站姿使用 'ZYX' 欧拉序（X=大臂自转，Y=前后摆，Z=上下抬落）
 * - leftLowerArm / rightLowerArm：使用 'YXZ' 欧拉序（X=前臂旋前/旋后，Y=肘关节自然屈伸，Z=0）
 * - leftHand / rightHand：使用 'XYZ' 欧拉序（手腕微调）
 * - head：[pitchX, yawY, rollZ] 头部姿态附加偏移（弧度）
 */

const POSE_OVERRIDES_STORAGE_KEY = 'twilight_ark_heroine_pose_overrides_v2';
const TUNER_PREFS_STORAGE_KEY = 'twilight_ark_heroine_tuner_prefs_v1';

export const HEROINE_POSE_LIST = [
  { id: 'seated', label: '坐姿（床沿）', category: 'seated' },
  { id: 'idle', label: '站立待机', category: 'standing' },
  { id: 'wave', label: '挥手打招呼', category: 'standing' },
  { id: 'finger_cheek', label: '手指点脸', category: 'standing' },
  { id: 'hands_chest', label: '双手放胸前', category: 'standing' },
  { id: 'peace', label: '比耶', category: 'standing' },
  { id: 'heart', label: '双手比心', category: 'standing' },
  { id: 'talk_gentle', label: '柔和交谈', category: 'standing' },
  { id: 'talk_lively', label: '活泼交谈', category: 'standing' },
  { id: 'lean_curious', label: '好奇前倾', category: 'standing' },
  { id: 'reach_hand', label: '伸手向男主', category: 'standing' },
  { id: 'arms_crossed', label: '双手交叉（抱臂）', category: 'standing' },
];

export const HEROINE_EXPRESSION_LIST = [
  { id: 'neutral', label: '默认自然 (neutral)' },
  { id: 'happy', label: '轻微笑 (happy)' },
  { id: 'relaxed', label: '温和放松 (relaxed)' },
  { id: 'sad', label: '微委屈 (sad)' },
  { id: 'surprised', label: '轻惊讶 (surprised)' },
  { id: 'wink', label: '单眼 Wink (blinkLeft)' },
];

/**
 * 原生 VRM 单一情绪配置（严禁多情绪混叠，且避免过重权重导致闭眼呆滞傻笑）
 * 每个预设只激活至多 1 个 VRM 原生表情，保持双眼清亮自然注视镜头。
 */
export const HEROINE_EXPRESSIONS = {
  neutral: {
    happy: 0,
    relaxed: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    wink: 0,
  },
  happy: {
    happy: 0.24,
    relaxed: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    wink: 0,
  },
  relaxed: {
    happy: 0,
    relaxed: 0.26,
    sad: 0,
    angry: 0,
    surprised: 0,
    wink: 0,
  },
  sad: {
    happy: 0,
    relaxed: 0,
    sad: 0.28,
    angry: 0,
    surprised: 0,
    wink: 0,
  },
  surprised: {
    happy: 0,
    relaxed: 0,
    sad: 0,
    angry: 0,
    surprised: 0.36,
    wink: 0,
  },
  wink: {
    happy: 0,
    relaxed: 0,
    sad: 0,
    angry: 0,
    surprised: 0,
    wink: 0.92,
  },
};

export const HEROINE_LEFT_CURL_FINGERS = [
  ['leftIndexProximal', -0.18],
  ['leftIndexIntermediate', -0.22],
  ['leftIndexDistal', -0.12],
  ['leftMiddleProximal', -0.22],
  ['leftMiddleIntermediate', -0.24],
  ['leftMiddleDistal', -0.14],
  ['leftRingProximal', -0.25],
  ['leftRingIntermediate', -0.26],
  ['leftRingDistal', -0.15],
  ['leftLittleProximal', -0.28],
  ['leftLittleIntermediate', -0.26],
  ['leftLittleDistal', -0.15],
];

export const HEROINE_RIGHT_CURL_FINGERS = [
  ['rightIndexProximal', 0.18],
  ['rightIndexIntermediate', 0.22],
  ['rightIndexDistal', 0.12],
  ['rightMiddleProximal', 0.22],
  ['rightMiddleIntermediate', 0.24],
  ['rightMiddleDistal', 0.14],
  ['rightRingProximal', 0.25],
  ['rightRingIntermediate', 0.26],
  ['rightRingDistal', 0.15],
  ['rightLittleProximal', 0.28],
  ['rightLittleIntermediate', 0.26],
  ['rightLittleDistal', 0.15],
];

/**
 * 出厂默认姿态参数表（作为重置基准）
 * 站立待机及自然垂手已做加宽外展（±1.02），确保双臂自然悬于蓬松裙摆外侧不穿模。
 */
export const DEFAULT_HEROINE_POSES = {
  // 床沿程序化坐姿（保留已调优的防穿模双手与坐腿角度，upperArm 使用 'YXZ' 欧拉序）
  seated: {
    category: 'seated',
    upperArmOrder: 'YXZ',
    leftShoulder: [0, 0.06, -0.04],
    rightShoulder: [0, -0.06, 0.04],
    leftUpperArm: [-0.18, -0.16, -1.23],
    rightUpperArm: [-0.18, 0.16, 1.23],
    leftLowerArm: [0.15, -0.98, -0.35],
    rightLowerArm: [0.15, 0.98, 0.35],
    leftHand: [1.04, -0.05, 0.26],
    rightHand: [1.04, 0.05, -0.26],
    head: [0, 0, 0],
    spineLean: 0,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'relaxed',
    legs: {
      leftUpperLeg: [-1.50, -0.03, -0.03],
      rightUpperLeg: [-1.50, 0.03, 0.03],
      leftLowerLeg: [1.52, 0, 0],
      rightLowerLeg: [1.52, 0, 0],
      leftFoot: [0.18, 0, 0],
      rightFoot: [0.18, 0, 0],
    },
  },

  // 程序化站立待机：双臂自然微外展（Z=±1.02）+ 微屈肘，避免与蓬松裙摆穿模
  idle: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'none',
    leftShoulder: [0, 0.04, 0.04],
    rightShoulder: [0, -0.04, -0.04],
    leftUpperArm: [-0.04, -0.08, -1.04],
    rightUpperArm: [-0.04, 0.08, 1.04],
    leftLowerArm: [0.0, -0.18, 0.0],
    rightLowerArm: [0.0, 0.18, 0.0],
    leftHand: [0.0, 0.0, -0.08],
    rightHand: [0.0, 0.0, 0.08],
    head: [0, 0, 0],
    spineLean: 0,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'relaxed',
  },

  wave: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'right',
    holdSec: 2.5,
    leftShoulder: [0, 0.04, 0.04],
    rightShoulder: [0, -0.03, 0.02],
    leftUpperArm: [-0.04, -0.08, -1.04],
    rightUpperArm: [-1.05, 0.52, 1.05],
    leftLowerArm: [0.0, -0.18, 0.0],
    rightLowerArm: [0.55, 1.82, 0.0],
    leftHand: [0.0, 0.0, -0.08],
    rightHand: [0.0, 0.0, -0.06],
    head: [0, 0, 0.06],
    spineLean: 0.12,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'open',
    waveMotion: {
      speed: 4.3,
      durationSec: 2.4,
      fadeSec: 0.85,
      forearmY: 0.16,
      wristY: 0.24,
    },
  },

  finger_cheek: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'right',
    holdSec: 3.4,
    leftShoulder: [0, 0.04, 0.04],
    rightShoulder: [0, -0.04, 0.01],
    leftUpperArm: [-0.04, -0.08, -1.04],
    rightUpperArm: [-0.72, 1.02, 0.94],
    leftLowerArm: [0.0, -0.18, 0.0],
    rightLowerArm: [0.22, 2.22, 0.0],
    leftHand: [0.0, 0.0, -0.08],
    rightHand: [0.0, 0.06, -0.06],
    head: [0, 0, 0.10],
    spineLean: 0.10,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'point',
  },

  // 双手轻合胸前：正值 X 轴大臂内旋，手肘自然垂于肋侧、双手柔拢在胸前而非僵硬上举
  hands_chest: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'both',
    holdSec: 3.6,
    leftShoulder: [0, 0.04, -0.02],
    rightShoulder: [0, -0.04, 0.02],
    leftUpperArm: [0.76, -0.28, -1.14],
    rightUpperArm: [0.76, 0.28, 1.14],
    leftLowerArm: [-0.14, -1.78, 0.0],
    rightLowerArm: [0.14, 1.78, 0.0],
    leftHand: [0.10, -0.10, 0.08],
    rightHand: [0.10, 0.10, -0.08],
    head: [0, 0, 0.08],
    spineLean: 0.08,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'relaxed',
  },

  peace: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'right',
    holdSec: 2.9,
    leftShoulder: [0, 0.04, 0.04],
    rightShoulder: [0, -0.03, 0.01],
    leftUpperArm: [-0.04, -0.08, -1.04],
    rightUpperArm: [-1.02, 0.56, 0.96],
    leftLowerArm: [0.0, -0.18, 0.0],
    rightLowerArm: [0.48, 1.88, 0.0],
    leftHand: [0.0, 0.0, -0.08],
    rightHand: [0.0, 0.04, -0.05],
    head: [0, 0, 0.07],
    spineLean: 0.10,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'peace',
  },

  // 双手比心：手肘轻垂、前臂向胸前柔和聚拢，不再向两侧僵硬外翻
  heart: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'both',
    holdSec: 3.1,
    leftShoulder: [0, 0.05, -0.02],
    rightShoulder: [0, -0.05, 0.02],
    leftUpperArm: [0.58, -0.38, -1.08],
    rightUpperArm: [0.58, 0.38, 1.08],
    leftLowerArm: [-0.22, -1.68, 0.0],
    rightLowerArm: [0.22, 1.68, 0.0],
    leftHand: [0.14, -0.14, 0.16],
    rightHand: [0.14, 0.14, -0.16],
    head: [0, 0, -0.08],
    spineLean: 0.14,
    leftFingerMode: 'heart',
    rightFingerMode: 'heart',
  },

  // 柔和交谈：手肘放松垂在腰侧，轻度不对称前臂微抬
  talk_gentle: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'both',
    holdSec: 3.4,
    leftShoulder: [0, 0.03, 0.02],
    rightShoulder: [0, -0.03, -0.02],
    leftUpperArm: [0.44, -0.14, -1.16],
    rightUpperArm: [0.52, 0.18, 1.14],
    leftLowerArm: [-0.08, -0.78, 0.0],
    rightLowerArm: [0.10, 1.06, 0.0],
    leftHand: [0.08, -0.06, 0.06],
    rightHand: [0.10, 0.08, -0.06],
    head: [0, 0, -0.06],
    spineLean: 0.08,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'open',
  },

  talk_lively: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'both',
    holdSec: 3.2,
    leftShoulder: [0, 0.03, 0.02],
    rightShoulder: [0, -0.03, -0.02],
    leftUpperArm: [0.48, -0.22, -1.12],
    rightUpperArm: [0.42, 0.28, 1.08],
    leftLowerArm: [-0.10, -1.18, 0.0],
    rightLowerArm: [0.12, 1.32, 0.0],
    leftHand: [0.10, -0.08, 0.08],
    rightHand: [0.10, 0.08, -0.08],
    head: [0, 0, 0.05],
    spineLean: 0.10,
    leftFingerMode: 'open',
    rightFingerMode: 'open',
  },

  lean_curious: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'none',
    leftShoulder: [0, 0.04, 0.04],
    rightShoulder: [0, -0.04, -0.04],
    leftUpperArm: [-0.04, 0.10, -1.04],
    rightUpperArm: [-0.04, -0.10, 1.04],
    leftLowerArm: [0.0, -0.28, 0.0],
    rightLowerArm: [0.0, 0.28, 0.0],
    leftHand: [0.04, 0.0, -0.08],
    rightHand: [0.04, 0.0, 0.08],
    head: [0, 0, -0.09],
    spineLean: 0.42,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'relaxed',
  },

  // 伸手向男主：仅右手优雅正前伸出、掌心微朝上，左手保持自然待机
  reach_hand: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'right',
    holdSec: 2.8,
    leftShoulder: [0, 0.04, 0.04],
    rightShoulder: [0, -0.04, 0.01],
    leftUpperArm: [-0.04, -0.08, -1.04],
    rightUpperArm: [0.24, 1.18, 0.78],
    leftLowerArm: [0.0, -0.18, 0.0],
    rightLowerArm: [0.34, 0.38, 0.0],
    leftHand: [0.0, 0.0, -0.08],
    rightHand: [0.12, 0.04, -0.10],
    head: [0, 0, 0.06],
    spineLean: 0.14,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'open',
  },

  // 双手交叉（自然抱臂）：大臂自然下垂并正值内旋（X=+1.06），双前臂水平错层轻搭于腰腹上方，绝不抬到脸前
  arms_crossed: {
    category: 'standing',
    upperArmOrder: 'ZYX',
    armMask: 'both',
    leftShoulder: [0, 0.05, -0.02],
    rightShoulder: [0, -0.05, 0.02],
    leftUpperArm: [1.05, -0.24, -1.16],
    rightUpperArm: [1.08, 0.28, 1.12],
    leftLowerArm: [-0.10, -1.56, 0.0],
    rightLowerArm: [0.10, 1.52, 0.0],
    leftHand: [0.06, -0.10, 0.06],
    rightHand: [0.06, 0.10, -0.06],
    head: [0, 0, -0.04],
    spineLean: 0.04,
    leftFingerMode: 'relaxed',
    rightFingerMode: 'relaxed',
  },
};

function deepClonePose(src) {
  return {
    category: src.category,
    upperArmOrder: src.upperArmOrder,
    leftShoulder: [...src.leftShoulder],
    rightShoulder: [...src.rightShoulder],
    leftUpperArm: [...src.leftUpperArm],
    rightUpperArm: [...src.rightUpperArm],
    leftLowerArm: [...src.leftLowerArm],
    rightLowerArm: [...src.rightLowerArm],
    leftHand: [...src.leftHand],
    rightHand: [...src.rightHand],
    head: [...src.head],
    spineLean: src.spineLean ?? 0,
    leftFingerMode: src.leftFingerMode,
    rightFingerMode: src.rightFingerMode,
    ...(src.armMask ? { armMask: src.armMask } : {}),
    ...(typeof src.holdSec === 'number' ? { holdSec: src.holdSec } : {}),
    ...(src.waveMotion ? { waveMotion: { ...src.waveMotion } } : {}),
    ...(src.legs
      ? {
          legs: {
            leftUpperLeg: [...src.legs.leftUpperLeg],
            rightUpperLeg: [...src.legs.rightUpperLeg],
            leftLowerLeg: [...src.legs.leftLowerLeg],
            rightLowerLeg: [...src.legs.rightLowerLeg],
            leftFoot: [...src.legs.leftFoot],
            rightFoot: [...src.legs.rightFoot],
          },
        }
      : {}),
  };
}

function isVec3(v) {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function mergePoseWithOverride(base, ov) {
  const out = deepClonePose(base);
  if (!ov || typeof ov !== 'object') return out;
  if (isVec3(ov.leftShoulder)) out.leftShoulder = [...ov.leftShoulder];
  if (isVec3(ov.rightShoulder)) out.rightShoulder = [...ov.rightShoulder];
  if (isVec3(ov.leftUpperArm)) out.leftUpperArm = [...ov.leftUpperArm];
  if (isVec3(ov.rightUpperArm)) out.rightUpperArm = [...ov.rightUpperArm];
  if (isVec3(ov.leftLowerArm)) out.leftLowerArm = [...ov.leftLowerArm];
  if (isVec3(ov.rightLowerArm)) out.rightLowerArm = [...ov.rightLowerArm];
  if (isVec3(ov.leftHand)) out.leftHand = [...ov.leftHand];
  if (isVec3(ov.rightHand)) out.rightHand = [...ov.rightHand];
  if (isVec3(ov.head)) out.head = [...ov.head];
  if (typeof ov.spineLean === 'number' && Number.isFinite(ov.spineLean)) {
    out.spineLean = ov.spineLean;
  }
  return out;
}

function readSavedPoseOverrides() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const raw = window.localStorage.getItem(POSE_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSavedPoseOverrides(map) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (Object.keys(map).length === 0) {
      window.localStorage.removeItem(POSE_OVERRIDES_STORAGE_KEY);
    } else {
      window.localStorage.setItem(POSE_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage quota / privacy errors
  }
}

const persistedPoseOverrides = readSavedPoseOverrides();

/**
 * 当前生效的全部姿态参数表（自动合并 localStorage 持久化微调值）
 */
export const HEROINE_POSES = Object.fromEntries(
  Object.keys(DEFAULT_HEROINE_POSES).map((id) => [
    id,
    mergePoseWithOverride(DEFAULT_HEROINE_POSES[id], persistedPoseOverrides[id]),
  ])
);

export function cloneHeroinePose(poseId) {
  const src = HEROINE_POSES[poseId] || HEROINE_POSES.idle;
  return deepClonePose(src);
}

export function cloneDefaultHeroinePose(poseId) {
  const src = DEFAULT_HEROINE_POSES[poseId] || DEFAULT_HEROINE_POSES.idle;
  return deepClonePose(src);
}

/**
 * 将某个姿态的微调参数立即写入内存与 localStorage，确保退出微调与刷新页面后依然持久生效。
 */
export function saveHeroinePoseOverride(poseId, pose) {
  const base = DEFAULT_HEROINE_POSES[poseId];
  if (!base || !pose) return;
  const merged = mergePoseWithOverride(base, pose);
  HEROINE_POSES[poseId] = merged;
  persistedPoseOverrides[poseId] = {
    leftShoulder: [...merged.leftShoulder],
    rightShoulder: [...merged.rightShoulder],
    leftUpperArm: [...merged.leftUpperArm],
    rightUpperArm: [...merged.rightUpperArm],
    leftLowerArm: [...merged.leftLowerArm],
    rightLowerArm: [...merged.rightLowerArm],
    leftHand: [...merged.leftHand],
    rightHand: [...merged.rightHand],
    head: [...merged.head],
    spineLean: merged.spineLean,
  };
  writeSavedPoseOverrides(persistedPoseOverrides);
}

export function resetHeroinePoseOverride(poseId) {
  const base = DEFAULT_HEROINE_POSES[poseId];
  if (!base) return cloneHeroinePose('idle');
  delete persistedPoseOverrides[poseId];
  writeSavedPoseOverrides(persistedPoseOverrides);
  HEROINE_POSES[poseId] = deepClonePose(base);
  return deepClonePose(base);
}

export function resetAllHeroinePoseOverrides() {
  for (const key of Object.keys(persistedPoseOverrides)) {
    delete persistedPoseOverrides[key];
  }
  writeSavedPoseOverrides(persistedPoseOverrides);
  for (const id of Object.keys(DEFAULT_HEROINE_POSES)) {
    HEROINE_POSES[id] = deepClonePose(DEFAULT_HEROINE_POSES[id]);
  }
}

export function hasHeroinePoseOverride(poseId) {
  return Boolean(persistedPoseOverrides[poseId]);
}

export function getHeroinePoseOverrideCount() {
  return Object.keys(persistedPoseOverrides).length;
}

export function loadHeroineTunerPrefs() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { poseId: 'wave', expression: 'neutral' };
    }
    const raw = window.localStorage.getItem(TUNER_PREFS_STORAGE_KEY);
    if (!raw) return { poseId: 'wave', expression: 'neutral' };
    const parsed = JSON.parse(raw);
    const poseId =
      parsed && typeof parsed.poseId === 'string' && DEFAULT_HEROINE_POSES[parsed.poseId]
        ? parsed.poseId
        : 'wave';
    const expression =
      parsed && typeof parsed.expression === 'string' && HEROINE_EXPRESSIONS[parsed.expression]
        ? parsed.expression
        : 'neutral';
    return { poseId, expression };
  } catch {
    return { poseId: 'wave', expression: 'neutral' };
  }
}

export function saveHeroineTunerPrefs(prefs) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(TUNER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors
  }
}

function fmtVec3(v) {
  return `[${v.map((n) => Number(n.toFixed(2))).join(', ')}]`;
}

export function formatHeroinePoseSnippet(poseId, pose, expression = 'neutral') {
  return [
    `${poseId}: {`,
    `  expression: '${expression}',`,
    `  leftUpperArm: ${fmtVec3(pose.leftUpperArm)},`,
    `  leftLowerArm: ${fmtVec3(pose.leftLowerArm)},`,
    `  leftHand: ${fmtVec3(pose.leftHand)},`,
    `  rightUpperArm: ${fmtVec3(pose.rightUpperArm)},`,
    `  rightLowerArm: ${fmtVec3(pose.rightLowerArm)},`,
    `  rightHand: ${fmtVec3(pose.rightHand)},`,
    `  head: ${fmtVec3(pose.head)},`,
    `  spineLean: ${Number((pose.spineLean ?? 0).toFixed(2))},`,
    `},`,
  ].join('\n');
}
