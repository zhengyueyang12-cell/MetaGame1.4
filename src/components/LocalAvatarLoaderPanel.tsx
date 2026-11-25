import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  Eye,
  FileUp,
  Loader2,
  Pause,
  PersonStanding,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_LOCAL_ASSET_SLOTS,
  classifyLocalAvatarFiles,
  ensurePersistentStorage,
  exportAvatarBackupPackage,
  formatFileSize,
  type LocalAssetSlot,
} from '../game/vrm/localAssetDb';
import type {
  LocomotionState,
  VrmAvatarStatusSnapshot,
} from '../game/vrm/VrmAvatarController';
import type { HeroinePoseTunerState } from '../game/vrm/HeroineAvatarController';
import type { HeroineExpressionPreset } from '../data/bedroomEncounterScript';
import {
  HEROINE_EXPRESSION_LIST,
  HEROINE_POSE_LIST,
  cloneHeroinePose,
  formatHeroinePoseSnippet,
  getHeroinePoseOverrideCount,
  hasHeroinePoseOverride,
  loadHeroineTunerPrefs,
  resetHeroinePoseOverride,
  saveHeroinePoseOverride,
  saveHeroineTunerPrefs,
  type HeroinePoseDefinition,
  type HeroinePoseId,
} from '../game/vrm/heroinePoses.js';

interface LocalAvatarLoaderPanelProps {
  status: VrmAvatarStatusSnapshot;
  thirdPersonPreview: boolean;
  onImportFile: (slot: LocalAssetSlot, file: File) => Promise<void>;
  onImportBackupPackage: (file: File) => Promise<{ slotCount: number; poseCount: number }>;
  onRemoveSlot: (slot: LocalAssetSlot) => Promise<void>;
  onClearAll: () => Promise<void>;
  onToggleThirdPerson: () => void;
  onToggleHeroinePreview: () => void;
  onUpdateHeroinePoseTuner: (state: HeroinePoseTunerState | null) => void;
}

interface SlotDescriptor {
  slot: LocalAssetSlot;
  title: string;
  hint: string;
  accept: string;
  extLabel: string;
  group: 'protagonist' | 'heroine';
}

const PROTAGONIST_SLOTS: readonly SlotDescriptor[] = [
  {
    slot: 'vrm',
    title: '男主模型',
    hint: '支持 VRM 0.x / 1.0',
    accept: '.vrm',
    extLabel: '.vrm',
    group: 'protagonist',
  },
  {
    slot: 'idle',
    title: '待机动作',
    hint: 'idle.fbx (男女主共用)',
    accept: '.fbx',
    extLabel: 'idle.fbx',
    group: 'protagonist',
  },
  {
    slot: 'walk',
    title: '行走动作',
    hint: 'walk.fbx (男女主共用)',
    accept: '.fbx',
    extLabel: 'walk.fbx',
    group: 'protagonist',
  },
  {
    slot: 'run',
    title: '奔跑动作',
    hint: 'run.fbx (Shift)',
    accept: '.fbx',
    extLabel: 'run.fbx',
    group: 'protagonist',
  },
] as const;

const HEROINE_SLOTS: readonly SlotDescriptor[] = [
  {
    slot: 'heroine',
    title: '女主模型',
    hint: 'heroine.vrm (卧室床沿)',
    accept: '.vrm',
    extLabel: 'heroine.vrm',
    group: 'heroine',
  },
  {
    slot: 'sit',
    title: '坐姿动作',
    hint: 'sit.fbx 可选 · 不传则程序化坐姿',
    accept: '.fbx',
    extLabel: 'sit.fbx',
    group: 'heroine',
  },
] as const;

const ALL_SLOT_DESCRIPTORS: readonly SlotDescriptor[] = [
  ...PROTAGONIST_SLOTS,
  ...HEROINE_SLOTS,
];

const MOTION_LABELS: Record<LocomotionState, string> = {
  idle: '待机 Idle',
  walk: '行走 Walk',
  run: '奔跑 Run',
};

const PANEL_CLS =
  'rounded-lg border border-white/25 bg-[#150f22]/78 shadow-[0_6px_22px_rgba(8,4,16,0.45)]';

type TunerTab = 'rightArm' | 'leftArm' | 'head';
type Vec3BoneKey =
  | 'rightUpperArm'
  | 'rightLowerArm'
  | 'rightHand'
  | 'leftUpperArm'
  | 'leftLowerArm'
  | 'leftHand'
  | 'head';

const AXIS_LABELS = ['X', 'Y', 'Z'] as const;

export function LocalAvatarLoaderPanel({
  status,
  thirdPersonPreview,
  onImportFile,
  onImportBackupPackage,
  onRemoveSlot,
  onClearAll,
  onToggleThirdPerson,
  onToggleHeroinePreview,
  onUpdateHeroinePoseTuner,
}: LocalAvatarLoaderPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [draggingBatch, setDraggingBatch] = useState(false);
  const [draggingSlot, setDraggingSlot] = useState<LocalAssetSlot | null>(null);
  const [dropNotice, setDropNotice] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  // Real-time heroine pose tuner state (auto-hydrated & persisted to localStorage)
  const [tunerOpen, setTunerOpen] = useState(false);
  const [tunerActive, setTunerActive] = useState(false);
  const [tunerPoseId, setTunerPoseId] = useState<HeroinePoseId>(
    () => loadHeroineTunerPrefs().poseId
  );
  const [tunerPose, setTunerPose] = useState<HeroinePoseDefinition>(() =>
    cloneHeroinePose(loadHeroineTunerPrefs().poseId)
  );
  const [tunerExpr, setTunerExpr] = useState<HeroineExpressionPreset>(
    () => loadHeroineTunerPrefs().expression
  );
  const [tunerPoseSaved, setTunerPoseSaved] = useState<boolean>(() =>
    hasHeroinePoseOverride(loadHeroineTunerPrefs().poseId)
  );
  const [tunerAnimateWave, setTunerAnimateWave] = useState(false);
  const [tunerTab, setTunerTab] = useState<TunerTab>('rightArm');
  const [copiedPose, setCopiedPose] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  // Clear live pose tuning cleanly if heroine asset is unloaded
  useEffect(() => {
    if (!status.heroineLoaded && tunerActive) {
      setTunerActive(false);
      setTunerOpen(false);
      onUpdateHeroinePoseTuner(null);
    }
  }, [status.heroineLoaded, tunerActive, onUpdateHeroinePoseTuner]);

  useEffect(() => {
    void ensurePersistentStorage().then((ok) => setStoragePersisted(ok));
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const pushTunerState = (
    poseId: HeroinePoseId,
    pose: HeroinePoseDefinition,
    expression: HeroineExpressionPreset,
    animateWave: boolean
  ) => {
    setTunerActive(true);
    onUpdateHeroinePoseTuner({
      poseId,
      pose,
      expression,
      animateWave,
    });
  };

  const handleToggleTunerOpen = () => {
    exitLockIfNeeded();
    if (!tunerOpen) {
      const latest = cloneHeroinePose(tunerPoseId);
      setTunerPose(latest);
      setTunerPoseSaved(hasHeroinePoseOverride(tunerPoseId));
      setTunerOpen(true);
      pushTunerState(tunerPoseId, latest, tunerExpr, tunerAnimateWave);
    } else {
      setTunerOpen(false);
    }
  };

  const handleExitTuner = () => {
    exitLockIfNeeded();
    setTunerActive(false);
    setTunerOpen(false);
    onUpdateHeroinePoseTuner(null);
  };

  const handleSelectTunerPose = (nextPoseId: HeroinePoseId) => {
    const cloned = cloneHeroinePose(nextPoseId);
    setTunerPoseId(nextPoseId);
    setTunerPose(cloned);
    setTunerPoseSaved(hasHeroinePoseOverride(nextPoseId));
    setTunerAnimateWave(false);
    saveHeroineTunerPrefs({ poseId: nextPoseId, expression: tunerExpr });
    pushTunerState(nextPoseId, cloned, tunerExpr, false);
  };

  const handleSelectTunerExpr = (nextExpr: HeroineExpressionPreset) => {
    setTunerExpr(nextExpr);
    saveHeroineTunerPrefs({ poseId: tunerPoseId, expression: nextExpr });
    pushTunerState(tunerPoseId, tunerPose, nextExpr, tunerAnimateWave);
  };

  const handleUpdateBoneAxis = (bone: Vec3BoneKey, axisIdx: 0 | 1 | 2, value: number) => {
    const rounded = Math.round(value * 100) / 100;
    const prevVec = tunerPose[bone];
    const nextVec: [number, number, number] = [prevVec[0], prevVec[1], prevVec[2]];
    nextVec[axisIdx] = rounded;
    const nextPose: HeroinePoseDefinition = {
      ...tunerPose,
      [bone]: nextVec,
    };
    setTunerPose(nextPose);
    saveHeroinePoseOverride(tunerPoseId, nextPose);
    setTunerPoseSaved(true);
    pushTunerState(tunerPoseId, nextPose, tunerExpr, tunerAnimateWave);
  };

  const handleUpdateSpineLean = (value: number) => {
    const rounded = Math.round(value * 100) / 100;
    const nextPose: HeroinePoseDefinition = {
      ...tunerPose,
      spineLean: rounded,
    };
    setTunerPose(nextPose);
    saveHeroinePoseOverride(tunerPoseId, nextPose);
    setTunerPoseSaved(true);
    pushTunerState(tunerPoseId, nextPose, tunerExpr, tunerAnimateWave);
  };

  const handleResetTunerPose = () => {
    exitLockIfNeeded();
    const restored = resetHeroinePoseOverride(tunerPoseId);
    setTunerPose(restored);
    setTunerPoseSaved(false);
    pushTunerState(tunerPoseId, restored, tunerExpr, tunerAnimateWave);
  };

  const handleCopyTunerParams = async () => {
    exitLockIfNeeded();
    const snippet = formatHeroinePoseSnippet(tunerPoseId, tunerPose, tunerExpr);
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(snippet);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = snippet;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopiedPose(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedPose(false);
        copyTimerRef.current = null;
      }, 2000);
    } else {
      setDropNotice('浏览器禁止剪贴板写入，请检查权限后重试。');
    }
  };

  const renderBoneSliderGroup = (
    title: string,
    boneKey: Vec3BoneKey,
    min: number,
    max: number
  ) => {
    const vec = tunerPose[boneKey];
    return (
      <div className="rounded border border-white/12 bg-black/25 px-2 py-1.5">
        <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-[#f4e8ff]">
          <span>{title}</span>
          <span className="font-mono text-[9px] text-[#cbb8de]/75 tabular-nums">
            [{vec[0].toFixed(2)}, {vec[1].toFixed(2)}, {vec[2].toFixed(2)}]
          </span>
        </div>
        <div className="space-y-1">
          {([0, 1, 2] as const).map((axisIdx) => {
            const rad = vec[axisIdx];
            const deg = Math.round((rad * 180) / Math.PI);
            return (
              <div key={axisIdx} className="flex items-center gap-1.5">
                <span className="w-3 text-[9.5px] font-mono text-[#ffcae2]">
                  {AXIS_LABELS[axisIdx]}
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={0.01}
                  value={rad}
                  onChange={(e) =>
                    handleUpdateBoneAxis(boneKey, axisIdx, parseFloat(e.target.value))
                  }
                  className="h-1 flex-1 cursor-pointer accent-[#ff9ec7]"
                />
                <span className="w-[68px] text-right font-mono text-[9.5px] text-[#e7daf5] tabular-nums">
                  {rad >= 0 ? '+' : ''}
                  {rad.toFixed(2)} ({deg}°)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const batchInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const slotInputRefs = useRef<Record<LocalAssetSlot, HTMLInputElement | null>>({
    vrm: null,
    idle: null,
    walk: null,
    run: null,
    heroine: null,
    sit: null,
  });

  const cachedCount = ALL_LOCAL_ASSET_SLOTS.filter((s) =>
    Boolean(status.assets[s])
  ).length;
  const boundAnimCount = (['idle', 'walk', 'run'] as LocomotionState[]).filter(
    (s) => status.boundClips[s]
  ).length;
  const isBusy = status.loadingSlot !== null || backupBusy;

  const exitLockIfNeeded = () => {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  };

  const restoreFromBackupFile = async (file: File) => {
    exitLockIfNeeded();
    setDropNotice(null);
    setBackupNotice(null);
    setBackupBusy(true);
    try {
      const res = await onImportBackupPackage(file);
      const prefs = loadHeroineTunerPrefs();
      const cloned = cloneHeroinePose(prefs.poseId);
      setTunerPoseId(prefs.poseId);
      setTunerPose(cloned);
      setTunerExpr(prefs.expression);
      setTunerPoseSaved(hasHeroinePoseOverride(prefs.poseId));
      if (tunerActive) {
        pushTunerState(prefs.poseId, cloned, prefs.expression, tunerAnimateWave);
      }
      setBackupNotice(`已恢复 ${res.slotCount} 个模型/动作与 ${res.poseCount} 项姿态微调！`);
    } catch (err) {
      setDropNotice(err instanceof Error ? err.message : '恢复备份包失败');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleExportBackup = async () => {
    exitLockIfNeeded();
    setDropNotice(null);
    setBackupNotice(null);
    setBackupBusy(true);
    try {
      const { blob, filename, slotCount, poseCount } = await exportAvatarBackupPackage();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setBackupNotice(`已导出 ${slotCount} 个模型/动作 + ${poseCount} 项姿态微调 (.tark)`);
    } catch (err) {
      setDropNotice(err instanceof Error ? err.message : '导出备份包失败');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBatchFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    exitLockIfNeeded();
    setDropNotice(null);
    setBackupNotice(null);
    const { matched, backupFile, unrecognized } = classifyLocalAvatarFiles(files);

    if (backupFile) {
      await restoreFromBackupFile(backupFile);
      return;
    }

    // Import VRM models first so FBX files dropped alongside immediately retarget onto them
    const orderedSlots: LocalAssetSlot[] = [
      'vrm',
      'heroine',
      'idle',
      'walk',
      'run',
      'sit',
    ];
    let importedCount = 0;
    for (const slot of orderedSlots) {
      const file = matched[slot];
      if (file) {
        await onImportFile(slot, file);
        importedCount += 1;
      }
    }

    if (unrecognized.length > 0) {
      setDropNotice(
        `已忽略不支持的文件：${unrecognized.slice(0, 2).join('、')}${
          unrecognized.length > 2 ? ' 等' : ''
        }（仅支持 .vrm / .fbx / .tark）`
      );
    } else if (importedCount === 0) {
      setDropNotice('未识别到 .vrm、.fbx 或 .tark 备份文件');
    }
  };

  const handleSlotFile = async (slot: LocalAssetSlot, file: File) => {
    exitLockIfNeeded();
    setDropNotice(null);
    const lower = file.name.toLowerCase();
    const expectedExt = slot === 'vrm' || slot === 'heroine' ? '.vrm' : '.fbx';
    if (!lower.endsWith(expectedExt)) {
      setDropNotice(`该槽位仅支持 ${expectedExt} 文件（当前：${file.name}）`);
      return;
    }
    await onImportFile(slot, file);
  };

  const handleBatchDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBatch(false);
    setDraggingSlot(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleBatchFiles(e.dataTransfer.files);
    }
  };

  const handleSlotDrop = (slot: LocalAssetSlot) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBatch(false);
    setDraggingSlot(null);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      void handleBatchFiles(files);
      return;
    }
    void handleSlotFile(slot, files[0]);
  };

  const handleBatchInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleBatchFiles(files);
    }
    e.target.value = '';
  };

  const handleSlotInputChange =
    (slot: LocalAssetSlot) => (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleSlotFile(slot, file);
      }
      e.target.value = '';
    };

  const renderSlotRow = (desc: SlotDescriptor) => {
    const meta = status.assets[desc.slot];
    const isSlotLoading =
      status.loadingSlot === desc.slot || status.loadingSlot === 'restore';
    const isDragTarget = draggingSlot === desc.slot;

    let isBound = false;
    let boundLabel = '已重定向';
    if (desc.slot === 'vrm') {
      isBound = status.vrmLoaded;
      boundLabel = `VRM${status.vrmVersion ? ` ${status.vrmVersion}` : ''}`;
    } else if (desc.slot === 'heroine') {
      isBound = status.heroineLoaded;
      boundLabel = status.heroineSpawned
        ? `床沿已就位`
        : `VRM${status.heroineVersion ? ` ${status.heroineVersion}` : ''}`;
    } else if (desc.slot === 'sit') {
      isBound = status.heroineSitClipBound;
      boundLabel = '已绑定坐姿';
    } else {
      isBound = status.boundClips[desc.slot as LocomotionState];
    }

    const isActiveMotion =
      (desc.slot === 'idle' || desc.slot === 'walk' || desc.slot === 'run') &&
      status.vrmLoaded &&
      isBound &&
      status.activeMotion === desc.slot;

    return (
      <div
        key={desc.slot}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraggingSlot(desc.slot);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraggingSlot((cur) => (cur === desc.slot ? null : cur));
        }}
        onDrop={handleSlotDrop(desc.slot)}
        className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 transition-colors ${
          isDragTarget
            ? 'border-[#ffb88c] bg-[#ffb88c]/20'
            : isActiveMotion || (desc.slot === 'heroine' && status.heroineSpawned)
              ? 'border-emerald-300/50 bg-emerald-500/12'
              : 'border-white/15 bg-black/22'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-[#f8eefc]">
              {desc.title}
            </span>
            <span className="font-mono text-[9.5px] text-[#cbb8de]/80">
              {desc.extLabel}
            </span>
            {isSlotLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-[#ffb88c]" />
            ) : isBound ? (
              <span className="inline-flex items-center gap-0.5 text-[9.5px] text-emerald-300">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {boundLabel}
              </span>
            ) : meta ? (
              <span className="text-[9.5px] text-amber-200/90">
                {desc.slot === 'vrm' || desc.slot === 'heroine'
                  ? '待加载'
                  : desc.slot === 'sit'
                    ? '待导入女主VRM'
                    : '待导入VRM'}
              </span>
            ) : desc.slot === 'sit' && status.heroineLoaded ? (
              <span className="text-[9.5px] text-sky-200/85">程序化坐姿</span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[10px] text-[#cbb8de]/80 tabular-nums">
            {meta
              ? `${meta.name} (${formatFileSize(meta.size)})`
              : `未缓存 · ${desc.hint}`}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              exitLockIfNeeded();
              slotInputRefs.current[desc.slot]?.click();
            }}
            className="flex items-center gap-0.5 rounded border border-white/22 bg-white/10 px-1.5 py-0.5 text-[10px] text-[#f5ecff] hover:bg-white/20 disabled:opacity-50 cursor-pointer"
          >
            <FileUp className="h-2.5 w-2.5" />
            <span>{meta ? '替换' : '选择'}</span>
          </button>
          {meta && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                exitLockIfNeeded();
                setDropNotice(null);
                void onRemoveSlot(desc.slot);
              }}
              title={`移除 ${desc.title} 缓存`}
              className="rounded border border-white/15 p-0.5 text-[#cbb8de] hover:border-rose-300/45 hover:bg-rose-500/20 hover:text-rose-100 disabled:opacity-50 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="pointer-events-auto fixed bottom-3 left-3 z-20 flex flex-col items-start select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Hidden multi-file picker */}
      <input
        ref={batchInputRef}
        type="file"
        multiple
        accept=".vrm,.fbx,.tark"
        className="hidden"
        onChange={handleBatchInputChange}
      />
      {/* Hidden backup archive picker */}
      <input
        ref={backupInputRef}
        type="file"
        accept=".tark,.twilight-pkg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void restoreFromBackupFile(f);
          e.target.value = '';
        }}
      />

      {/* Hidden per-slot pickers */}
      {ALL_SLOT_DESCRIPTORS.map((desc) => (
        <input
          key={desc.slot}
          ref={(el) => {
            slotInputRefs.current[desc.slot] = el;
          }}
          type="file"
          accept={desc.accept}
          className="hidden"
          onChange={handleSlotInputChange(desc.slot)}
        />
      ))}

      {/* Expanded Debug Drawer */}
      {expanded && (
        <div
          className={`mb-2 w-[324px] max-w-[calc(100vw-24px)] max-h-[78vh] overflow-y-auto p-3 text-[#f1e7fc] ${PANEL_CLS}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Database className="h-3.5 w-3.5 shrink-0 text-[#ffb88c]" />
              <span className="text-xs font-semibold tracking-wide truncate">
                加载本地模型/动画
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {cachedCount > 0 && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    exitLockIfNeeded();
                    setDropNotice(null);
                    if (tunerActive) {
                      setTunerActive(false);
                      setTunerOpen(false);
                      onUpdateHeroinePoseTuner(null);
                    }
                    void onClearAll();
                  }}
                  title="清空 IndexedDB 中缓存的所有模型和动作"
                  className="flex items-center gap-1 rounded border border-rose-300/35 bg-rose-500/15 px-1.5 py-0.5 text-[10px] text-rose-200 hover:bg-rose-500/30 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  <span>清空缓存</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                title="折叠面板"
                className="rounded border border-white/15 p-0.5 text-[#cbb8de] hover:bg-white/15 hover:text-white cursor-pointer"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Unified Drag-and-Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingBatch(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDraggingBatch(false);
            }}
            onDrop={handleBatchDrop}
            onClick={() => {
              exitLockIfNeeded();
              batchInputRef.current?.click();
            }}
            className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-2.5 py-2 text-center transition-colors ${
              draggingBatch
                ? 'border-[#ffb88c] bg-[#ffb88c]/18 text-[#fff3e8]'
                : 'border-white/28 bg-white/[0.04] text-[#d6c7e8] hover:border-[#ffb88c]/65 hover:bg-white/[0.08]'
            }`}
          >
            <Upload className="h-4 w-4 text-[#ffb88c]" />
            <p className="mt-1 text-[11px] font-medium text-[#f8eefc]">
              拖放或点击批量导入 .vrm / .fbx / .tark
            </p>
            <p className="mt-0.5 text-[10px] text-[#cbb8de]/85">
              自动识别角色/动作或一键恢复 .tark 跨 Remix 备份包
            </p>
          </div>

          {/* Cross-Remix Persistence & 1-Click Backup Card */}
          <div className="mt-2 rounded-md border border-violet-300/25 bg-violet-950/25 p-2">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-[#e7d8ff]">
                <Archive className="h-3 w-3 text-[#c8a8ff]" />
                <span>跨 Remix 持久化备份</span>
              </div>
              {storagePersisted && (
                <span
                  title="已向浏览器申请 Persistent Storage，同域名重启不易被系统回收"
                  className="inline-flex items-center gap-0.5 text-[9.5px] text-emerald-300"
                >
                  <ShieldCheck className="h-2.5 w-2.5" />
                  同域防清理已开启
                </span>
              )}
            </div>
            <p className="mt-1 text-[9.5px] leading-relaxed text-[#cbb8de]/85">
              每次 Remix 会分配新域名，浏览器会隔离旧域名的 IndexedDB 与微调记录。Remix 前点导出 <code className="text-[#ffd8be]">.tark</code>，新版本拖入即可一键复原全部模型与微调（共 {getHeroinePoseOverrideCount()} 项姿态微调）。
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                disabled={isBusy || (cachedCount === 0 && getHeroinePoseOverrideCount() === 0)}
                onClick={() => void handleExportBackup()}
                className="flex flex-1 items-center justify-center gap-1 rounded border border-[#c8a8ff]/45 bg-[#c8a8ff]/18 px-2 py-1 text-[10px] font-medium text-[#f4ecff] hover:bg-[#c8a8ff]/28 disabled:opacity-45 cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>导出全部备份 (.tark)</span>
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  exitLockIfNeeded();
                  backupInputRef.current?.click();
                }}
                className="flex items-center justify-center gap-1 rounded border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-medium text-[#f5ecff] hover:bg-white/20 disabled:opacity-45 cursor-pointer"
              >
                <FileUp className="h-3 w-3" />
                <span>导入备份</span>
              </button>
            </div>
            {backupNotice && (
              <p className="mt-1 text-[10px] text-emerald-300">{backupNotice}</p>
            )}
          </div>

          {/* Protagonist Slots */}
          <div className="mt-2.5 space-y-1.5">
            {PROTAGONIST_SLOTS.map(renderSlotRow)}
          </div>

          {/* Heroine Slots */}
          <div className="mt-2.5 border-t border-white/15 pt-2">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-[10.5px] font-medium text-[#ffcae2]">
                <Sparkles className="h-3 w-3 text-[#ff9ec7]" />
                <span>女主资产 · 卧室床沿等待</span>
              </div>
              {status.heroineLoaded && (
                <button
                  type="button"
                  onClick={() => {
                    exitLockIfNeeded();
                    onToggleHeroinePreview();
                  }}
                  title="在卧室床沿预览或隐藏女主坐姿与视线追踪"
                  className={`rounded border px-1.5 py-0.5 text-[9.5px] font-medium transition-colors cursor-pointer ${
                    status.heroineSpawned
                      ? 'border-emerald-300/55 bg-emerald-500/20 text-emerald-100'
                      : 'border-pink-300/40 bg-pink-500/15 text-pink-100 hover:bg-pink-500/28'
                  }`}
                >
                  {status.heroineSpawned ? '已在床沿 · 隐藏' : '床沿预览'}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {HEROINE_SLOTS.map(renderSlotRow)}
            </div>

            {/* Collapsible Real-Time Pose Tuner (heroinePoses.js) */}
            {status.heroineLoaded && (
              <div className="mt-2 rounded-md border border-pink-300/28 bg-pink-950/22">
                <button
                  type="button"
                  onClick={handleToggleTunerOpen}
                  className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05] cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <SlidersHorizontal className="h-3 w-3 shrink-0 text-[#ff9ec7]" />
                    <span className="text-[10.5px] font-medium text-[#ffe3f0] truncate">
                      实时捏动作 · 姿态微调
                    </span>
                    {tunerActive && (
                      <span className="rounded border border-pink-300/45 bg-pink-400/20 px-1 py-0 text-[9px] text-pink-100">
                        预览中
                      </span>
                    )}
                    {tunerPoseSaved && (
                      <span className="rounded border border-emerald-300/40 bg-emerald-500/18 px-1 py-0 text-[9px] text-emerald-100">
                        已保存
                      </span>
                    )}
                  </div>
                  {tunerOpen ? (
                    <ChevronUp className="h-3 w-3 shrink-0 text-[#d6c7e8]" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 text-[#d6c7e8]" />
                  )}
                </button>

                {tunerOpen && (
                  <div className="space-y-2 border-t border-white/12 px-2 pb-2 pt-2">
                    {/* Pose & Expression selectors */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="flex flex-col gap-0.5 text-[9.5px] text-[#d6c7e8]">
                        <span>选择动作</span>
                        <select
                          value={tunerPoseId}
                          onChange={(e) =>
                            handleSelectTunerPose(e.target.value as HeroinePoseId)
                          }
                          className="rounded border border-white/22 bg-[#1a122a] px-1.5 py-1 text-[10.5px] text-[#f8eefc] outline-none focus:border-[#ff9ec7]"
                        >
                          {HEROINE_POSE_LIST.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col gap-0.5 text-[9.5px] text-[#d6c7e8]">
                        <span>预览表情</span>
                        <select
                          value={tunerExpr}
                          onChange={(e) =>
                            handleSelectTunerExpr(
                              e.target.value as HeroineExpressionPreset
                            )
                          }
                          className="rounded border border-white/22 bg-[#1a122a] px-1.5 py-1 text-[10.5px] text-[#f8eefc] outline-none focus:border-[#ff9ec7]"
                        >
                          {HEROINE_EXPRESSION_LIST.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {/* Limb tabs + optional wave toggle */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        {(
                          [
                            { id: 'rightArm', label: '右臂' },
                            { id: 'leftArm', label: '左臂' },
                            { id: 'head', label: '头部/前倾' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setTunerTab(tab.id)}
                            className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                              tunerTab === tab.id
                                ? 'border-[#ff9ec7]/70 bg-[#ff9ec7]/25 text-[#fff2f8]'
                                : 'border-white/15 bg-white/[0.05] text-[#cbb8de] hover:bg-white/12'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {tunerPoseId === 'wave' && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextAnim = !tunerAnimateWave;
                            setTunerAnimateWave(nextAnim);
                            pushTunerState(tunerPoseId, tunerPose, tunerExpr, nextAnim);
                          }}
                          title="开启或暂停挥手摆动，暂停时更方便精细调角度"
                          className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9.5px] transition-colors cursor-pointer ${
                            tunerAnimateWave
                              ? 'border-emerald-300/50 bg-emerald-500/20 text-emerald-100'
                              : 'border-white/18 bg-white/8 text-[#e5d8f4] hover:bg-white/15'
                          }`}
                        >
                          {tunerAnimateWave ? (
                            <>
                              <Pause className="h-2.5 w-2.5" />
                              <span>挥动中</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-2.5 w-2.5" />
                              <span>试挥</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Sliders */}
                    <div className="space-y-1.5">
                      {tunerTab === 'rightArm' && (
                        <>
                          {renderBoneSliderGroup('右大臂 rightUpperArm', 'rightUpperArm', -3.14, 3.14)}
                          {renderBoneSliderGroup('右小臂 rightLowerArm', 'rightLowerArm', -3.14, 3.14)}
                          {renderBoneSliderGroup('右手腕 rightHand', 'rightHand', -2.2, 2.2)}
                        </>
                      )}
                      {tunerTab === 'leftArm' && (
                        <>
                          {renderBoneSliderGroup('左大臂 leftUpperArm', 'leftUpperArm', -3.14, 3.14)}
                          {renderBoneSliderGroup('左小臂 leftLowerArm', 'leftLowerArm', -3.14, 3.14)}
                          {renderBoneSliderGroup('左手腕 leftHand', 'leftHand', -2.2, 2.2)}
                        </>
                      )}
                      {tunerTab === 'head' && (
                        <>
                          {renderBoneSliderGroup('头部 head (俯仰X/偏航Y/歪头Z)', 'head', -0.75, 0.75)}
                          <div className="rounded border border-white/12 bg-black/25 px-2 py-1.5">
                            <div className="flex items-center justify-between text-[10px] font-medium text-[#f4e8ff]">
                              <span>身体前倾 spineLean</span>
                              <span className="font-mono text-[9.5px] text-[#e7daf5] tabular-nums">
                                {tunerPose.spineLean.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.02}
                              value={tunerPose.spineLean}
                              onChange={(e) =>
                                handleUpdateSpineLean(parseFloat(e.target.value))
                              }
                              className="mt-1 h-1 w-full cursor-pointer accent-[#ff9ec7]"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => void handleCopyTunerParams()}
                        className={`flex flex-1 items-center justify-center gap-1 rounded border px-2 py-1 text-[10.5px] font-medium transition-colors cursor-pointer ${
                          copiedPose
                            ? 'border-emerald-300/60 bg-emerald-500/25 text-emerald-100'
                            : 'border-[#ff9ec7]/55 bg-[#ff9ec7]/22 text-[#fff0f7] hover:bg-[#ff9ec7]/34'
                        }`}
                      >
                        {copiedPose ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>已复制参数</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>复制当前参数</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleResetTunerPose}
                        title="恢复该动作的默认角度"
                        className="flex items-center gap-0.5 rounded border border-white/20 bg-white/10 px-1.5 py-1 text-[10px] text-[#f0e5fb] hover:bg-white/20 cursor-pointer"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        <span>重置</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExitTuner}
                        title="退出微调并恢复正常状态"
                        className="rounded border border-white/18 bg-black/30 px-1.5 py-1 text-[10px] text-[#cbb8de] hover:bg-white/15 hover:text-white cursor-pointer"
                      >
                        退出
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live Retargeting / Locomotion Status & Third-Person Preview Toggle */}
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/15 pt-2">
            <div className="text-[10.5px] text-[#d6c7e8] tabular-nums">
              {status.vrmLoaded ? (
                <span>
                  动作状态：
                  <strong className="text-[#ffb88c]">
                    {MOTION_LABELS[status.activeMotion]}
                  </strong>
                  <span className="ml-1 text-[#b7a5cc]">({boundAnimCount}/3)</span>
                </span>
              ) : (
                <span className="text-[#b7a5cc]">刷新后自动从 IndexedDB 恢复</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                exitLockIfNeeded();
                onToggleThirdPerson();
              }}
              title="切换第三人称跟随视角，方便观察 VRM 模型与 Mixamo 动作"
              className={`flex items-center gap-1 rounded border px-2 py-1 text-[10.5px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                thirdPersonPreview
                  ? 'border-[#ffb88c]/65 bg-[#ffb085]/28 text-[#ffe6d4]'
                  : 'border-white/22 bg-white/10 text-[#ece1f8] hover:bg-white/18'
              }`}
            >
              <Eye className="h-3 w-3" />
              <span>{thirdPersonPreview ? '第三人称中' : '第三人称预览'}</span>
            </button>
          </div>

          {/* Error / Validation Feedback */}
          {(status.lastError || dropNotice) && (
            <div className="mt-2 flex items-start gap-1.5 rounded border border-rose-300/40 bg-rose-950/55 px-2 py-1.5 text-[10.5px] text-rose-100">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-rose-300" />
              <span className="leading-snug">{dropNotice || status.lastError}</span>
            </div>
          )}
        </div>
      )}

      {/* Compact Corner Toggle Chip (supports direct drag-over to expand!) */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            exitLockIfNeeded();
            setExpanded((prev) => !prev);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setExpanded(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-[#f1e7fc] transition-colors hover:border-white/40 hover:bg-[#1f1633]/88 cursor-pointer ${PANEL_CLS}`}
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ffb88c]" />
          ) : (
            <PersonStanding
              className={`h-3.5 w-3.5 ${
                status.vrmLoaded || status.heroineLoaded
                  ? 'text-emerald-300'
                  : 'text-[#ffb88c]'
              }`}
            />
          )}
          <span>加载本地模型/动画</span>
          {cachedCount > 0 && (
            <span className="rounded border border-white/20 bg-white/10 px-1 py-0 text-[9.5px] font-mono text-[#ffd8be] tabular-nums">
              {status.vrmLoaded ? `VRM+${boundAnimCount}` : `${cachedCount}项`}
              {status.heroineLoaded ? '+女主' : ''}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-3 w-3 text-[#cbb8de]" />
          ) : (
            <ChevronUp className="h-3 w-3 text-[#cbb8de]" />
          )}
        </button>

        {!expanded && status.vrmLoaded && (
          <button
            type="button"
            onClick={() => {
              exitLockIfNeeded();
              onToggleThirdPerson();
            }}
            className={`flex items-center gap-1 px-2 py-1.5 text-[10.5px] font-medium transition-colors cursor-pointer ${PANEL_CLS} ${
              thirdPersonPreview
                ? 'border-[#ffb88c]/60 text-[#ffd8be]'
                : 'text-[#d6c7e8] hover:text-white'
            }`}
          >
            <Eye className="h-3 w-3" />
            <span>{thirdPersonPreview ? '切回第一人称' : '第三人称预览'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
