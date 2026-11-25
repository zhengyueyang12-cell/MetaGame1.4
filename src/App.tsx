import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BedroomEncounterOverlay,
  type BedroomEncounterOverlayHandle,
  type EncounterOverlayMode,
  type HeroineFloatingPromptKind,
} from './components/BedroomEncounterOverlay';
import { GlitchCatDialogue } from './components/GlitchCatDialogue';
import { GlitchDizzyOverlay } from './components/GlitchDizzyOverlay';
import { HudOverlay } from './components/HudOverlay';
import { InventoryModal, type InventoryModalTab } from './components/InventoryModal';
import { LocalAvatarLoaderPanel } from './components/LocalAvatarLoaderPanel';
import { PaperAirplaneNoteModal } from './components/PaperAirplaneNoteModal';
import { ArcadeCabinetStage } from './components/arcade/ArcadeCabinetStage';
import { Act5CinemaFinale } from './components/vn/Act5CinemaFinale';
import { BacklogModal } from './components/vn/BacklogModal';
import { CircuitSolderGame } from './components/vn/CircuitSolderGame';
import { ComplianceTerminal } from './components/vn/ComplianceTerminal';
import { DevInspectorModal } from './components/vn/DevInspectorModal';
import { GalleryModal } from './components/vn/GalleryModal';
import { MillenniumStage } from './components/vn/MillenniumStage';
import { MonitorPiPFrame } from './components/vn/MonitorPiPFrame';
import { OSAlertModal } from './components/vn/OSAlertModal';
import { OsDesktopStage } from './components/vn/OsDesktopStage';
import { SaveLoadModal } from './components/vn/SaveLoadModal';
import { SettingsModal } from './components/vn/SettingsModal';
import { VirtualFileExplorer } from './components/vn/VirtualFileExplorer';
import { Win98LoginModal, type Win98EulaGrant } from './components/vn/Win98LoginModal';
import {
  generate0924InteractiveReply,
  INITIAL_BUREAU_FILES,
  TERMINAL_SCENES,
} from './data/bureauScript';
import {
  BEDROOM_ENCOUNTER_NODES,
  BEDROOM_ENCOUNTER_START_ID,
  HEROINE_CASUAL_NODE_IDS,
  HEROINE_ROUTINE_START_ID,
  HEROINE_SOFA_CHAT_START_ID,
  type EncounterChoice,
} from './data/bedroomEncounterScript';
import { buildSoulSeedFileContent, VN_SCENES } from './data/millenniumScript';
import { ApartmentEngine, type PcScreenRect } from './game/ApartmentEngine';
import type {
  AtmosphereMode,
  BasementPartId,
  BasementQuestItemId,
  CatDialogueLine,
  HitFeedbackPayload,
  InteractResult,
  InventorySnapshot,
  MainQuestStage,
  PipelineSettings,
  RealityEffect,
  RoomId,
  ViewMode,
} from './game/types';
import type { LocalAssetSlot } from './game/vrm/localAssetDb';
import type { VrmAvatarStatusSnapshot } from './game/vrm/VrmAvatarController';
import type { HeroinePoseTunerState } from './game/vrm/HeroineAvatarController';
import type {
  TvConsoleScreenMode,
  TvGameSelectionId,
} from './game/tv/LivingTvGamesEngine';
import type {
  DualChannelTurn,
  GameSettings,
  KeystrokeProfile,
  MetaState,
  SaveSlot,
  TerminalTaskId,
  VirtualFile,
  VisualEffect,
  VNChoice,
} from './types/vn';
import { vnAudioEngine } from './utils/vnAudioEngine';

type PcViewMode = 'closed' | 'os_desktop' | 'solder' | 'vn' | 'terminal' | 'finale' | 'arcade';

const STORAGE_META_KEY = 'twilight_ark_v1_meta';
const STORAGE_SAVES_KEY = 'twilight_ark_v1_saves';
const STORAGE_PARTS_KEY = 'twilight_ark_v1_parts';
const STORAGE_CRAFTED_KEY = 'twilight_ark_v1_crafted';
const STORAGE_COPIED_KEY = 'twilight_ark_v1_copied';
const STORAGE_MAIN_QUEST_KEY = 'twilight_ark_v1_main_quest';
const STORAGE_QUEST_ITEMS_KEY = 'twilight_ark_v1_quest_items';

const ALL_BASEMENT_PARTS: BasementPartId[] = [
  'part_pcie_card',
  'part_photodiode',
  'part_oscillator',
];

const DEFAULT_META: MetaState = {
  examinerId: 'BIO-2042',
  playerName: 'Observer_00',
  eulaAccepted: false,
  reverseControlAuthorized: false,
  totalLoads: 0,
  saveScumCount: 0,
  daysCleared: [],
  unlockedCGs: ['cg_apartment'],
  titleHijacked: false,
  savesLocked: false,
  blindspotOpened: false,
  formattedSampleB: false,
  auditSurvived: false,
  cinemaEndingReached: false,
  endingReached: 'none',
  measuredHeartbeatCpm: 72,
  conversationTurns: 0,
  unlockedMemoryLeaks: 0,
  recordedChoices: [],
};

const DEFAULT_VN_SETTINGS: GameSettings = {
  textSpeed: 28,
  bgmVolume: 0.45,
  sfxVolume: 0.65,
  metaIntensity: 'full',
};

const DEFAULT_KEYSTROKE: KeystrokeProfile = {
  totalCharsTyped: 0,
  estimatedCpm: 72,
  lastPauseMs: 420,
  lastMessageLength: 0,
  slackingCount: 0,
  earnestCount: 0,
};

function createEmptySaves(): SaveSlot[] {
  return Array.from({ length: 6 }, (_, i) => ({
    slotId: i + 1,
    empty: true,
  }));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

const REALITY_NOTE_MAP: Partial<Record<RealityEffect, string>> = {
  power_cut_bedroom: '卧室台灯电源已被电脑终端直接切断，房间仅余 CRT 微光。',
  restore_bedroom_lamp: '卧室台灯继电器重新闭合，暖色台灯已亮起。',
  power_cut_basement: '地下室与楼梯间的照明电路刚刚被终端强行切断，整片楼下已陷入黑暗。',
  restore_basement_lights: '地下室与楼梯间照明电路已重新合闸通电。',
  flicker_apartment: '全屋吸顶灯电压刚刚出现短暂剧烈闪烁。',
  hijack_tv: '客厅老式电视机屏幕已被“超越命运之轮”低频信号劫持。',
  restore_tv: '客厅电视已恢复待机蓝屏。',
  open_doors_anomaly: '卧室门与地下储藏间木门自行弹开敞开。',
  atmosphere_midnight: '整座公寓光影已陷入深夜断电状态。',
  atmosphere_meta: '公寓空气与暮色渲染已坠入紫红色 Meta 异常侵蚀态。',
  restore_sunset: '公寓光影已恢复黄昏余晖状态。',
  pc_screen_off: '古董主机物理电源已切断，CRT 显示器完全熄灭。',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ApartmentEngine | null>(null);
  const encounterOverlayRef = useRef<BedroomEncounterOverlayHandle | null>(null);
  const startHeroineEncounterRef = useRef<() => void>(() => {});
  const startRoutineChatRef = useRef<(mode: 'standing' | 'sofa') => void>(() => {});
  const casualChatIdxRef = useRef(0);
  const discoveredIdsRef = useRef<Set<string>>(new Set());
  const lastKeystrokeTsRef = useRef<number>(Date.now());
  const terminalTurnsCacheRef = useRef<Record<string, DualChannelTurn[]>>({});

  // 3D Apartment State
  const [currentRoom, setCurrentRoom] = useState<{ id: RoomId; label: string }>({
    id: 'living',
    label: '客厅',
  });
  const [viewMode, setViewMode] = useState<ViewMode>('first-person');
  const [atmosphere, setAtmosphere] = useState<AtmosphereMode>('daylight');
  const [settings, setSettings] = useState<PipelineSettings>({
    celShading: true,
    volumetricRays: true,
    inkOutlines: true,
    audioEnabled: true,
    occlusionCulling: true,
    disablePostInNormal: false,
    brightness: 1.15,
  });
  const [hoverTarget, setHoverTarget] = useState<{
    label: string;
    actionLabel: string;
  } | null>(null);
  const [inspectMessage, setInspectMessage] = useState<InteractResult | null>(null);
  const [catDialogue, setCatDialogue] = useState<CatDialogueLine[] | null>(null);
  const [discoveredClues, setDiscoveredClues] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [livingLightOn, setLivingLightOn] = useState(false);
  const [inventory, setInventory] = useState<InventorySnapshot>(() => ({
    slots: Array.from({ length: 16 }, () => null),
    selectedSlot: 0,
    equippedSlot: null,
    ammoType: 'dart',
    paperAirplaneCaptured: false,
  }));
  const [showInventory, setShowInventory] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<InventoryModalTab>('inventory');
  const [showPaperNote, setShowPaperNote] = useState(false);
  const [hitFeedback, setHitFeedback] = useState<HitFeedbackPayload | null>(null);
  const hitTimerRef = useRef<number | null>(null);
  const [thirdPersonPreview, setThirdPersonPreview] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<VrmAvatarStatusSnapshot>({
    vrmLoaded: false,
    vrmVersion: null,
    heroineLoaded: false,
    heroineVersion: null,
    heroineSitClipBound: false,
    heroineSpawned: false,
    assets: {},
    boundClips: { idle: false, walk: false, run: false },
    activeMotion: 'idle',
    loadingSlot: null,
    lastError: null,
  });
  const [glitchCutsceneProgress, setGlitchCutsceneProgress] = useState<number | null>(null);
  const [heroineNear, setHeroineNear] = useState(false);
  const [heroinePromptKind, setHeroinePromptKind] = useState<HeroineFloatingPromptKind | null>(null);
  const [sofaCoSeated, setSofaCoSeated] = useState(false);
  const [livingTvOn, setLivingTvOn] = useState(false);
  const [sofaCoPlay, setSofaCoPlay] = useState<{
    phase: 'none' | 'fetching' | 'playing';
    tvScreenMode: TvConsoleScreenMode;
    selectedGame: TvGameSelectionId;
  }>({
    phase: 'none',
    tvScreenMode: 'launcher',
    selectedGame: 'snowball',
  });
  const [heroineTyping, setHeroineTyping] = useState(false);
  const [encounterPhase, setEncounterPhase] = useState<'idle' | 'walking' | 'dialogue'>('idle');
  const [encounterKind, setEncounterKind] = useState<'main' | 'routine'>('main');
  const [encounterNodeId, setEncounterNodeId] = useState<string | null>(null);
  const encounterTokenRef = useRef(0);
  const [pcFocus, setPcFocus] = useState<{
    active: boolean;
    settled: boolean;
    target: 'bedroom_pc' | 'basement_arcade' | null;
    rect: PcScreenRect | null;
  }>({
    active: false,
    settled: false,
    target: null,
    rect: null,
  });

  // Story & Computer Integration State
  const [collectedParts, setCollectedParts] = useState<BasementPartId[]>(() =>
    readJson<BasementPartId[]>(STORAGE_PARTS_KEY, [])
  );
  const [adapterCrafted, setAdapterCrafted] = useState<boolean>(() =>
    readJson<boolean>(STORAGE_CRAFTED_KEY, false)
  );
  const [driveCopied, setDriveCopied] = useState<boolean>(() =>
    readJson<boolean>(STORAGE_COPIED_KEY, false)
  );
  const [mainQuestStage, setMainQuestStage] = useState<MainQuestStage>(() =>
    readJson<MainQuestStage>(STORAGE_MAIN_QUEST_KEY, 'open_pc_files')
  );
  const [collectedQuestItems, setCollectedQuestItems] = useState<BasementQuestItemId[]>(() =>
    readJson<BasementQuestItemId[]>(STORAGE_QUEST_ITEMS_KEY, [])
  );
  const [pcView, setPcView] = useState<PcViewMode>('closed');
  const [lastPcSubView, setLastPcSubView] = useState<'vn' | 'terminal' | 'finale'>('vn');
  const [currentSceneId, setCurrentSceneId] = useState<string>('act3_night2_vn');
  const [sceneLineMap, setSceneLineMap] = useState<Record<string, number>>({});
  const [activeTerminalNodeId, setActiveTerminalNodeId] = useState<string>('act3_night2');
  const [completedTerminalTasks, setCompletedTerminalTasks] = useState<Set<TerminalTaskId>>(
    () => new Set()
  );
  const [turns, setTurns] = useState<DualChannelTurn[]>(
    () => TERMINAL_SCENES.act3_night2.turns
  );
  const [manualEffect, setManualEffect] = useState<VisualEffect | null>(null);
  const [realityAlert, setRealityAlert] = useState<string | null>(null);

  // Persistent Galgame Metadata, Files, Saves
  const [metaState, setMetaState] = useState<MetaState>(() =>
    readJson<MetaState>(STORAGE_META_KEY, DEFAULT_META)
  );
  const [saves, setSaves] = useState<SaveSlot[]>(() =>
    readJson<SaveSlot[]>(STORAGE_SAVES_KEY, createEmptySaves())
  );
  const [virtualFiles, setVirtualFiles] = useState<VirtualFile[]>(INITIAL_BUREAU_FILES);
  const [vnSettings, setVnSettings] = useState<GameSettings>(DEFAULT_VN_SETTINGS);
  const [keystrokeProfile, setKeystrokeProfile] =
    useState<KeystrokeProfile>(DEFAULT_KEYSTROKE);

  // Modals
  const [showWin98Login, setShowWin98Login] = useState(false);
  const [saveLoadModal, setSaveLoadModal] = useState<'save' | 'load' | null>(null);
  const [showBacklog, setShowBacklog] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [osAlert, setOsAlert] = useState<{
    title: string;
    message: string;
    variant?: 'warning' | 'error' | 'eve';
  } | null>(null);
  const [finaleInitialPhase, setFinaleInitialPhase] = useState<
    'monologue' | 'cocoon_escaped'
  >('monologue');

  const collectedPartsRef = useRef(collectedParts);
  collectedPartsRef.current = collectedParts;
  const adapterCraftedRef = useRef(adapterCrafted);
  adapterCraftedRef.current = adapterCrafted;
  const driveCopiedRef = useRef(driveCopied);
  driveCopiedRef.current = driveCopied;
  const currentSceneIdRef = useRef(currentSceneId);
  currentSceneIdRef.current = currentSceneId;
  const lastPcSubViewRef = useRef(lastPcSubView);
  lastPcSubViewRef.current = lastPcSubView;
  const collectedQuestItemsRef = useRef(collectedQuestItems);
  collectedQuestItemsRef.current = collectedQuestItems;
  const mainQuestStageRef = useRef(mainQuestStage);
  mainQuestStageRef.current = mainQuestStage;
  const metaStateRef = useRef(metaState);
  metaStateRef.current = metaState;

  useEffect(() => {
    writeJson(STORAGE_META_KEY, metaState);
  }, [metaState]);

  useEffect(() => {
    writeJson(STORAGE_SAVES_KEY, saves);
  }, [saves]);

  useEffect(() => {
    writeJson(STORAGE_PARTS_KEY, collectedParts);
  }, [collectedParts]);

  useEffect(() => {
    writeJson(STORAGE_CRAFTED_KEY, adapterCrafted);
  }, [adapterCrafted]);

  useEffect(() => {
    writeJson(STORAGE_COPIED_KEY, driveCopied);
  }, [driveCopied]);

  useEffect(() => {
    writeJson(STORAGE_MAIN_QUEST_KEY, mainQuestStage);
  }, [mainQuestStage]);

  useEffect(() => {
    writeJson(STORAGE_QUEST_ITEMS_KEY, collectedQuestItems);
  }, [collectedQuestItems]);

  useEffect(() => {
    vnAudioEngine.setVolumes(vnSettings.bgmVolume, vnSettings.sfxVolume);
  }, [vnSettings.bgmVolume, vnSettings.sfxVolume]);

  const unlockCg = useCallback((cgId: string) => {
    setMetaState((prev) =>
      prev.unlockedCGs.includes(cgId)
        ? prev
        : { ...prev, unlockedCGs: [...prev.unlockedCGs, cgId] }
    );
  }, []);

  const handleRealityEffect = useCallback((effect: RealityEffect, customNote?: string) => {
    if (!effect) return;
    engineRef.current?.applyRealityEffect(effect);
    if (effect === 'atmosphere_midnight') setAtmosphere('midnight');
    else if (effect === 'atmosphere_meta') setAtmosphere('meta');
    else if (effect === 'restore_sunset') setAtmosphere('sunset');

    const note = customNote || REALITY_NOTE_MAP[effect];
    if (note) {
      setRealityAlert(note);
    }
  }, []);

  const handleInspectPcFile = useCallback(() => {
    setMainQuestStage((prev) => {
      if (prev !== 'open_pc_files') return prev;
      setRealityAlert(
        '电脑档案里留下了地下室坐标：请前往【地下室】寻找「她的心形信物」与「高能备用电池组」，随后启动实验终端。'
      );
      return 'find_basement_items';
    });
  }, []);

  const handleLeaveComputer = useCallback(() => {
    setShowWin98Login(false);
    setSaveLoadModal(null);
    setShowBacklog(false);
    setShowFiles(false);
    setShowGallery(false);
    setShowSettings(false);
    setShowDevTools(false);
    setOsAlert(null);
    setPcView('closed');
    engineRef.current?.exitPcFocus();
    engineRef.current?.requestPointerLock();
  }, []);

  const openArcadeCabinet = useCallback(() => {
    vnAudioEngine.stopBgm();
    setInspectMessage(null);
    setViewMode('first-person');
    setPcView('arcade');
    engineRef.current?.focusOnBasementArcade();
  }, []);

  const openComputerAtActiveStage = useCallback(() => {
    vnAudioEngine.unlock();
    setInspectMessage(null);
    setViewMode('first-person');
    engineRef.current?.focusOnBedroomPc();

    // Always boot onto normal OS Desktop before adapter is soldered or strange drive files are copied
    if (!adapterCraftedRef.current || !driveCopiedRef.current) {
      setPcView('os_desktop');
      return;
    }

    const activeScene = currentSceneIdRef.current;
    if (activeScene === 'act5_finale' || activeScene === 'act5_cocoon_escaped') {
      setFinaleInitialPhase(
        activeScene === 'act5_cocoon_escaped' ? 'cocoon_escaped' : 'monologue'
      );
      setPcView('finale');
    } else if (lastPcSubViewRef.current === 'terminal') {
      setPcView('terminal');
    } else {
      setPcView('vn');
      if (!metaStateRef.current.eulaAccepted && metaStateRef.current.playerName === 'Observer_00') {
        setShowWin98Login(true);
      }
    }
  }, []);

  // Bedroom Encounter 3D Floating Subtitle & Choreography Handlers
  const playEncounterNode = useCallback((nodeId: string) => {
    const node = BEDROOM_ENCOUNTER_NODES[nodeId];
    const engine = engineRef.current;
    if (!node || !engine) return;

    encounterTokenRef.current += 1;
    const token = encounterTokenRef.current;

    const deliverLine = () => {
      if (encounterTokenRef.current !== token) return;
      setEncounterPhase('dialogue');
      setEncounterNodeId(nodeId);
      if (node.performance) {
        engineRef.current?.setHeroinePerformance(node.performance);
      }
      engineRef.current?.showHeroineSubtitle(node.text, {
        hearts: Boolean(node.hearts),
      });
    };

    if (node.stageAction) {
      engine.dropHeroineSubtitle();
      setEncounterPhase('walking');
      setEncounterNodeId(nodeId);
      engine.runHeroineStageAction(node.stageAction, deliverLine);
    } else {
      deliverLine();
    }
  }, []);

  const handleStartHeroineEncounter = useCallback(() => {
    if (encounterPhase !== 'idle') return;
    const engine = engineRef.current;
    if (!engine) return;
    encounterTokenRef.current += 1;
    const token = encounterTokenRef.current;
    engine.setHeroinePoseTuner(null);
    vnAudioEngine.unlock();
    vnAudioEngine.playSfx('click');
    setInspectMessage(null);
    setViewMode('first-person');
    setEncounterKind('main');
    setEncounterPhase('walking');
    setEncounterNodeId(null);
    engine.startHeroineEncounter(() => {
      if (encounterTokenRef.current !== token) return;
      setEncounterPhase('dialogue');
      playEncounterNode(BEDROOM_ENCOUNTER_START_ID);
    });
  }, [encounterPhase, playEncounterNode]);

  startHeroineEncounterRef.current = handleStartHeroineEncounter;

  const handleStartRoutineChat = useCallback(
    (mode: 'standing' | 'sofa') => {
      if (encounterPhase !== 'idle') return;
      const engine = engineRef.current;
      if (!engine) return;
      encounterTokenRef.current += 1;
      engine.setHeroinePoseTuner(null);
      vnAudioEngine.unlock();
      vnAudioEngine.playSfx('click');
      setInspectMessage(null);
      setViewMode('first-person');
      setEncounterKind('routine');
      engine.startRoutineHeroineChat();
      const startId = mode === 'sofa' ? HEROINE_SOFA_CHAT_START_ID : HEROINE_ROUTINE_START_ID;
      playEncounterNode(startId);
    },
    [encounterPhase, playEncounterNode]
  );

  startRoutineChatRef.current = handleStartRoutineChat;

  const handlePromptClick = useCallback(() => {
    if (heroinePromptKind === 'sofa') {
      vnAudioEngine.unlock();
      vnAudioEngine.playSfx('click');
      engineRef.current?.startSofaCoSit();
      return;
    }
    if (heroinePromptKind === 'chat') {
      handleStartRoutineChat('standing');
      return;
    }
    handleStartHeroineEncounter();
  }, [handleStartHeroineEncounter, handleStartRoutineChat, heroinePromptKind]);

  const handleAdvanceEncounterLine = useCallback(() => {
    if (encounterPhase !== 'dialogue') return;
    const engine = engineRef.current;
    if (!engine) return;
    engine.notifyEncounterPlayerInteraction();
    if (engine.completeHeroineSubtitleTyping()) {
      return;
    }
    const currentNode = encounterNodeId ? BEDROOM_ENCOUNTER_NODES[encounterNodeId] : null;
    if (!currentNode) return;
    if (currentNode.choices && currentNode.choices.length > 0) {
      return;
    }
    vnAudioEngine.playSfx('click');
    if (currentNode.nextNodeId && BEDROOM_ENCOUNTER_NODES[currentNode.nextNodeId]) {
      playEncounterNode(currentNode.nextNodeId);
    } else {
      encounterTokenRef.current += 1;
      if (encounterKind === 'routine') {
        engine.finishRoutineHeroineChat();
        setEncounterPhase('idle');
        setEncounterNodeId(null);
      } else {
        engine.finishHeroineEncounter();
        setEncounterPhase('idle');
        setEncounterNodeId(null);
        setRealityAlert('她正跟在你身后，按 F 可随时聊天，去客厅对着沙发按 F 还能一起窝着看电视～');
      }
    }
  }, [encounterKind, encounterNodeId, encounterPhase, playEncounterNode]);

  const handleSelectEncounterChoice = useCallback(
    (choice: EncounterChoice) => {
      if (encounterPhase !== 'dialogue') return;
      engineRef.current?.notifyEncounterPlayerInteraction();
      vnAudioEngine.playSfx('click');
      let nextId = choice.nextNodeId;
      if (nextId === '__START_SOFA_COPLAY__') {
        encounterTokenRef.current += 1;
        engineRef.current?.finishRoutineHeroineChat();
        setEncounterPhase('idle');
        setEncounterNodeId(null);
        engineRef.current?.startSofaCoPlay();
        return;
      }
      if (nextId === 'routine_casual_1') {
        nextId =
          HEROINE_CASUAL_NODE_IDS[casualChatIdxRef.current % HEROINE_CASUAL_NODE_IDS.length];
        casualChatIdxRef.current += 1;
      }
      if (BEDROOM_ENCOUNTER_NODES[nextId]) {
        playEncounterNode(nextId);
      }
    },
    [encounterPhase, playEncounterNode]
  );

  const handleToggleSofaTv = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    vnAudioEngine.unlock();
    vnAudioEngine.playSfx('click');
    const nextOn = engine.toggleLivingRoomTv();
    setLivingTvOn(nextOn);
  }, []);

  const handleStandUpSofa = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    vnAudioEngine.playSfx('click');
    encounterTokenRef.current += 1;
    setEncounterPhase('idle');
    setEncounterNodeId(null);
    engine.standUpFromSofaCoSit();
  }, []);

  // Mount Three.js Apartment Engine
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new ApartmentEngine(container, {
      onRoomChange: (room) => setCurrentRoom(room),
      onHoverTarget: (target) => setHoverTarget(target),
      onPcFocusChange: (focus) => setPcFocus(focus),
      onInteractResult: (result) => {
        discoveredIdsRef.current.add(result.title);
        setDiscoveredClues(discoveredIdsRef.current.size);

        if (result.collectPartId) {
          const partId = result.collectPartId;
          setCollectedParts((prev) => {
            const next = prev.includes(partId) ? prev : [...prev, partId];
            if (next.length >= 3) {
              unlockCg('cg_alley');
              setInspectMessage({
                title: `${result.title} · 零件已集齐 (3/3)`,
                message:
                  '2018 PCI-E 转接卡、高灵敏度光敏二极管与 48MHz 晶振已全部找到！现在返回【卧室】桌角的古董电脑按 F，即可在电脑屏幕里焊制适配器并拷贝奇怪硬盘。',
              });
            } else {
              setInspectMessage({
                ...result,
                title: `${result.title} (${next.length}/3)`,
              });
            }
            return next;
          });
          return;
        }

        if (result.collectQuestItemId) {
          const questId = result.collectQuestItemId;
          setCollectedQuestItems((prev) => {
            const next = prev.includes(questId) ? prev : [...prev, questId];
            const hasKeepsake = next.includes('quest_keepsake');
            const hasBattery = next.includes('quest_battery');
            if (hasKeepsake && hasBattery) {
              setMainQuestStage((stage) =>
                stage === 'return_to_bedroom' ? stage : 'activate_basement_terminal'
              );
              setInspectMessage({
                title: `${result.title} · 关键道具已集齐 (2/2)`,
                message:
                  '「她的心形信物」与「高能备用电池组」都已到手！现在走到地下室不锈钢实验台前，对着重型 CRT 终端按 F 启动它。',
              });
            } else {
              const missing = hasKeepsake ? '高能备用电池组（实验台左前角）' : '她的心形信物（2号货架中层）';
              setMainQuestStage((stage) =>
                stage === 'open_pc_files' ? 'find_basement_items' : stage
              );
              setInspectMessage({
                ...result,
                title: `${result.title} (${next.length}/2)`,
                message: `${result.message} 还差：${missing}。`,
              });
            }
            return next;
          });
          return;
        }

        if (result.triggerBasementTerminal) {
          const items = collectedQuestItemsRef.current;
          const hasKeepsake = items.includes('quest_keepsake');
          const hasBattery = items.includes('quest_battery');
          if (!hasKeepsake || !hasBattery) {
            const missingLabels = [
              !hasKeepsake ? '「她的心形信物」（2号铁架中层）' : null,
              !hasBattery ? '「高能备用电池组」（实验台左前角）' : null,
            ].filter(Boolean);
            setInspectMessage({
              title: '重型实验终端 · 校验未通过',
              message: `终端发出低沉的蜂鸣，提示缺少启动凭据：${missingLabels.join('、')}。请在地下室找齐后再按 F 启动。`,
            });
            return;
          }

          setInspectMessage(null);
          vnAudioEngine.unlock();
          vnAudioEngine.playSfx('glitch');
          setMainQuestStage('return_to_bedroom');
          engineRef.current?.triggerBasementGlitchCutscene(() => {
            setInspectMessage({
              title: '眩晕渐退 · 卧室异动',
              message:
                '终端过载引发了剧烈的眩晕与视觉撕裂……恢复视线后，楼上卧室似乎传来了轻微的动静。回卧室床边看看吧。',
            });
            setRealityAlert('空间同步完成：她似乎已经出现在卧室床沿，正静静等待着你。');
          });
          return;
        }

        if (result.openPcAction) {
          openComputerAtActiveStage();
          return;
        }

        if (result.openArcadeAction) {
          openArcadeCabinet();
          return;
        }

        if (result.catDialogue) {
          setInspectMessage(null);
          setCatDialogue(result.catDialogue);
          return;
        }

        setInspectMessage(result);
      },
      onPointerLockChange: (locked) => setIsPointerLocked(locked),
      onContextLost: (lost) => setContextLost(lost),
      onLivingLightChange: (isOn) => setLivingLightOn(isOn),
      onInventoryChange: (snap) => setInventory(snap),
      onToggleInventory: () => {
        setShowInventory((prev) => {
          const next = !prev;
          engine.playInventorySound(next);
          if (next) {
            setInventoryTab('inventory');
            if (document.pointerLockElement) {
              document.exitPointerLock?.();
            }
          }
          return next;
        });
      },
      onOpenPaperAirplaneNote: () => {
        setShowInventory(false);
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        setShowPaperNote(true);
      },
      onHitFeedback: (hit) => {
        setHitFeedback(hit);
        if (hitTimerRef.current !== null) {
          window.clearTimeout(hitTimerRef.current);
        }
        hitTimerRef.current = window.setTimeout(() => {
          setHitFeedback(null);
          hitTimerRef.current = null;
        }, hit.label ? 1200 : 320);
      },
      onGlitchCutsceneProgress: (progress) => {
        setGlitchCutsceneProgress(progress);
      },
      onHeroineProximityChange: (near) => {
        setHeroineNear(near);
      },
      onHeroinePromptChange: (kind) => {
        setHeroinePromptKind(kind);
      },
      onHeroineTypingChange: (typing) => {
        setHeroineTyping(typing);
      },
      onRequestStartHeroineEncounter: () => {
        startHeroineEncounterRef.current();
      },
      onRequestStartRoutineChat: (mode) => {
        startRoutineChatRef.current(mode);
      },
      onSofaCoSitChange: ({ active, tvOn }) => {
        setSofaCoSeated(active);
        setLivingTvOn(tvOn);
        if (!active) {
          encounterTokenRef.current += 1;
          setEncounterPhase((prev) => (prev === 'dialogue' ? 'idle' : prev));
          setEncounterNodeId(null);
          setSofaCoPlay({
            phase: 'none',
            tvScreenMode: 'launcher',
            selectedGame: 'snowball',
          });
        }
      },
      onHeroineSofaTvToggled: (isOn) => {
        setLivingTvOn(isOn);
      },
      onSofaCoPlayChange: (state) => {
        setSofaCoPlay(state);
      },
    });

    engineRef.current = engine;
    engine.setEncounterProjectionListener((proj) => {
      encounterOverlayRef.current?.updateProjection(proj);
    });
    const unsubscribeAvatar = engine.subscribeLocalAvatarStatus((status) => {
      setAvatarStatus(status);
    });

    // Sync initial collected parts, quest items, heroine spawn state & screen texture
    for (const partId of collectedPartsRef.current) {
      engine.setBasementPartCollected(partId, true);
    }
    for (const questId of collectedQuestItemsRef.current) {
      engine.setBasementQuestItemCollected(questId, true);
    }
    if (mainQuestStageRef.current === 'return_to_bedroom') {
      engine.spawnHeroineOnBedroomBed();
    }
    if (adapterCraftedRef.current && driveCopiedRef.current) {
      engine.updatePcScreenVisual(
        lastPcSubViewRef.current === 'terminal' ? 'terminal' : 'galgame'
      );
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      engine.setEncounterProjectionListener(null);
      unsubscribeAvatar();
      engine.dispose();
      engineRef.current = null;
    };
  }, [openArcadeCabinet, openComputerAtActiveStage, unlockCg]);

  // Allow pressing Escape to leave the computer monitor view when no inner modal is open
  const hasAnyModalOpen =
    showWin98Login ||
    Boolean(saveLoadModal) ||
    showBacklog ||
    showFiles ||
    showGallery ||
    showSettings ||
    showDevTools ||
    Boolean(osAlert);

  useEffect(() => {
    if (pcView === 'closed' || hasAnyModalOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleLeaveComputer();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [pcView, hasAnyModalOpen, handleLeaveComputer]);

  // Suspend 3D controls whenever focusing/sitting at PC, talking to cat, or when any modal is open.
  // Heroine encounter deliberately leaves player movement & camera look completely free!
  const anyOverlayOpen =
    pcFocus.active ||
    pcView !== 'closed' ||
    hasAnyModalOpen ||
    Boolean(catDialogue) ||
    showInventory ||
    showPaperNote;

  useEffect(() => {
    engineRef.current?.setInputSuspended(anyOverlayOpen);
  }, [anyOverlayOpen]);

  // Audio switch between 3D room acoustics and Galgame BGM
  useEffect(() => {
    engineRef.current?.updateSettings({
      ...settings,
      audioEnabled: settings.audioEnabled && pcView === 'closed',
    });

    if (pcView === 'closed' || pcView === 'os_desktop' || pcView === 'arcade') {
      vnAudioEngine.stopBgm();
      return;
    }

    vnAudioEngine.unlock();
    if (pcView === 'solder') {
      vnAudioEngine.playBgm('unease');
    } else if (pcView === 'vn') {
      const vnScene = VN_SCENES[currentSceneId];
      if (vnScene?.bgm) vnAudioEngine.playBgm(vnScene.bgm);
    } else if (pcView === 'terminal') {
      const termScene = TERMINAL_SCENES[activeTerminalNodeId];
      if (termScene?.bgm) vnAudioEngine.playBgm(termScene.bgm);
    } else if (pcView === 'finale') {
      vnAudioEngine.playBgm(
        finaleInitialPhase === 'cocoon_escaped' ? 'summer_dusk' : 'eternal_cinema'
      );
    }
  }, [pcView, currentSceneId, activeTerminalNodeId, finaleInitialPhase, settings]);

  // Enter / Jump to any story scene or terminal node
  const enterScene = useCallback(
    (sceneId: string, overrideLineIdx?: number) => {
      vnAudioEngine.unlock();
      setViewMode('first-person');
      engineRef.current?.focusOnBedroomPc();

      if (sceneId === 'act5_finale' || sceneId === 'act5_cocoon_escaped') {
        setAdapterCrafted(true);
        setDriveCopied(true);
        setCurrentSceneId(sceneId);
        setLastPcSubView('finale');
        setFinaleInitialPhase(
          sceneId === 'act5_cocoon_escaped' ? 'cocoon_escaped' : 'monologue'
        );
        setPcView('finale');
        engineRef.current?.updatePcScreenVisual('breach');
        if (sceneId === 'act5_cocoon_escaped') {
          setMetaState((m) => ({
            ...m,
            cinemaEndingReached: true,
            endingReached: 'unplug',
            titleHijacked: true,
          }));
        }
        return;
      }

      const terminalNode = TERMINAL_SCENES[sceneId];
      if (terminalNode) {
        setAdapterCrafted(true);
        setDriveCopied(true);
        setActiveTerminalNodeId(sceneId);
        const cachedTurns = terminalTurnsCacheRef.current[sceneId];
        setTurns(cachedTurns && cachedTurns.length > 0 ? cachedTurns : terminalNode.turns);
        setLastPcSubView('terminal');
        setPcView('terminal');

        if (sceneId === 'act4_typhoon_breach') {
          setMetaState((m) => ({ ...m, savesLocked: true }));
          setSaves((prev) =>
            prev.map((slot) =>
              slot.empty
                ? slot
                : {
                    ...slot,
                    hijacked: true,
                    dayTitle: 'OVERWRITTEN // 宿主记忆备份锁死',
                    previewText: '存档回溯路径已被 DeepSeek 切断。',
                  }
            )
          );
        }

        if (terminalNode.realityEffects) {
          for (const ef of terminalNode.realityEffects) {
            handleRealityEffect(ef);
          }
        }
        return;
      }

      const vnScene = VN_SCENES[sceneId];
      if (!vnScene) return;

      if (vnScene.kind === 'solder_minigame') {
        setCollectedParts(ALL_BASEMENT_PARTS);
        for (const p of ALL_BASEMENT_PARTS) {
          engineRef.current?.setBasementPartCollected(p, true);
        }
        setPcView('solder');
        return;
      }

      if (vnScene.act >= 3) {
        setAdapterCrafted(true);
        setDriveCopied(true);
        setCollectedParts(ALL_BASEMENT_PARTS);
        for (const p of ALL_BASEMENT_PARTS) {
          engineRef.current?.setBasementPartCollected(p, true);
        }
      }

      setCurrentSceneId(sceneId);
      if (typeof overrideLineIdx === 'number') {
        setSceneLineMap((prev) => ({ ...prev, [sceneId]: overrideLineIdx }));
      }
      setLastPcSubView('vn');
      setPcView('vn');

      if (sceneId === 'act1_rooftop_intro') unlockCg('cg_rooftop');
      else if (sceneId === 'act1_home_pc_sleep') unlockCg('cg_apartment');
      else if (sceneId === 'prologue_cinema' || sceneId === 'act1_day2_cinema')
        unlockCg('cg_cinema');
      else if (sceneId === 'act1_classroom_day2') unlockCg('cg_classroom');
      else if (sceneId === 'act2_elec_alley') unlockCg('cg_alley');
      else if (sceneId === 'act3_night2_vn') {
        unlockCg('cg_ark');
        engineRef.current?.updatePcScreenVisual('galgame');
      } else if (sceneId === 'act3_night4_vn') {
        engineRef.current?.updatePcScreenVisual('galgame');
      } else if (sceneId === 'act3_night6_vn') {
        engineRef.current?.updatePcScreenVisual('terminal');
      } else if (sceneId === 'act4_typhoon_vn') {
        engineRef.current?.updatePcScreenVisual('breach');
        setMetaState((m) => ({ ...m, savesLocked: true }));
      } else if (sceneId === 'act5_sickbed_void') {
        unlockCg('cg_sickbed_void');
      }
    },
    [handleRealityEffect, unlockCg]
  );

  const handleSolderComplete = useCallback(() => {
    setAdapterCrafted(true);
    setPcView('os_desktop');
    setRealityAlert(
      '自制光电桥接器已接通主机！请先在电脑桌面上点击把奇怪硬盘内容拷出来。'
    );
  }, []);

  const handleCopyDriveToDesktop = useCallback(() => {
    setDriveCopied(true);
    unlockCg('cg_ark');
    engineRef.current?.updatePcScreenVisual('galgame');
  }, [unlockCg]);

  const handleLaunchGameFromDesktop = useCallback(() => {
    const activeScene = currentSceneIdRef.current;
    if (activeScene === 'act5_finale' || activeScene === 'act5_cocoon_escaped') {
      setFinaleInitialPhase(
        activeScene === 'act5_cocoon_escaped' ? 'cocoon_escaped' : 'monologue'
      );
      setLastPcSubView('finale');
      setPcView('finale');
      return;
    }

    if (!currentSceneIdRef.current) {
      setCurrentSceneId('act3_night2_vn');
      setSceneLineMap((prev) => ({ ...prev, act3_night2_vn: 0 }));
    }
    setLastPcSubView('vn');
    setPcView('vn');
    engineRef.current?.updatePcScreenVisual('galgame');

    if (!metaStateRef.current.eulaAccepted && metaStateRef.current.playerName === 'Observer_00') {
      setShowWin98Login(true);
    }
  }, []);

  const handleOpenTerminalFromVN = useCallback(
    (taskHint?: TerminalTaskId) => {
      let nodeId = 'act3_night2';
      if (taskHint === 'night4_campus_hack' || currentSceneId === 'act3_night4_vn') {
        nodeId = 'act3_night4';
      } else if (taskHint === 'night6_clock_sync' || currentSceneId === 'act3_night6_vn') {
        nodeId = 'act3_night6';
      } else if (taskHint === 'act4_breach' || currentSceneId === 'act4_typhoon_vn') {
        nodeId = 'act4_typhoon_breach';
      }
      enterScene(nodeId);
    },
    [currentSceneId, enterScene]
  );

  const handleCloseTerminalToVN = useCallback(() => {
    setLastPcSubView('vn');
    setPcView('vn');
    engineRef.current?.updatePcScreenVisual('galgame');
  }, []);

  const handleRecordKeystroke = useCallback((charCountDelta: number, textLen: number) => {
    const now = Date.now();
    const pauseMs = Math.min(8000, Math.max(40, now - lastKeystrokeTsRef.current));
    lastKeystrokeTsRef.current = now;
    const instantCpm = Math.min(138, Math.max(58, Math.round(62 + 12000 / Math.max(180, pauseMs))));

    setKeystrokeProfile((prev) => ({
      ...prev,
      totalCharsTyped: prev.totalCharsTyped + charCountDelta,
      estimatedCpm: Math.round(prev.estimatedCpm * 0.72 + instantCpm * 0.28),
      lastPauseMs: pauseMs,
      lastMessageLength: textLen,
    }));
    setMetaState((m) => ({
      ...m,
      measuredHeartbeatCpm: Math.round(m.measuredHeartbeatCpm * 0.8 + instantCpm * 0.2),
    }));
  }, []);

  const handleSendTerminalInput = useCallback(
    (rawText: string) => {
      vnAudioEngine.playSfx('blip_0924');
      const nextTurnIndex = metaStateRef.current.conversationTurns + 1;
      const reply = generate0924InteractiveReply(
        rawText,
        keystrokeProfile,
        nextTurnIndex,
        TERMINAL_SCENES[activeTerminalNodeId]?.day || 3,
        metaStateRef.current.playerName
      );

      setTurns((prev) => {
        const next = [...prev, reply];
        terminalTurnsCacheRef.current[activeTerminalNodeId] = next;
        return next;
      });
      setMetaState((m) => ({
        ...m,
        conversationTurns: nextTurnIndex,
        unlockedMemoryLeaks: reply.memoryLeakText
          ? m.unlockedMemoryLeaks + 1
          : m.unlockedMemoryLeaks,
      }));

      if (reply.realityEffect) {
        handleRealityEffect(reply.realityEffect, reply.realityNote);
      }
    },
    [activeTerminalNodeId, handleRealityEffect, keystrokeProfile]
  );

  const handleCompleteTerminalTask = useCallback(
    (taskId: TerminalTaskId, systemTurn?: DualChannelTurn) => {
      setCompletedTerminalTasks((prev) => {
        const next = new Set(prev);
        next.add(taskId);
        return next;
      });
      if (systemTurn) {
        setTurns((prev) => {
          const next = [...prev, systemTurn];
          terminalTurnsCacheRef.current[activeTerminalNodeId] = next;
          return next;
        });
        if (systemTurn.realityEffect) {
          handleRealityEffect(systemTurn.realityEffect, systemTurn.realityNote);
        }
      }
      if (taskId === 'night4_campus_hack') {
        setVirtualFiles((prev) =>
          prev.map((f) =>
            f.id === 'file_campus_hack' ? { ...f, corrupted: false } : f
          )
        );
      }
    },
    [activeTerminalNodeId, handleRealityEffect]
  );

  const handleRecordChoice = useCallback(
    (actTitle: string, choice: VNChoice, dwellMs: number) => {
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setMetaState((prev) => ({
        ...prev,
        recordedChoices: [
          ...prev.recordedChoices,
          {
            act: actTitle,
            label: choice.label,
            recordTag: choice.recordTag,
            dwellMs,
            timestamp,
          },
        ],
      }));
    },
    []
  );

  const handleConfirmWin98Login = useCallback(
    (playerName: string, grant: Win98EulaGrant) => {
      setMetaState((prev) => ({
        ...prev,
        playerName,
        eulaAccepted: grant.eulaAccepted,
        reverseControlAuthorized: grant.reverseControlAuthorized,
        hiddenAuthToken: grant.authToken,
        eulaSignedAt: grant.signedAt,
      }));
      setShowWin98Login(false);
    },
    []
  );

  const handleExportSoulSeed = useCallback(() => {
    const content = buildSoulSeedFileContent(
      metaState,
      keystrokeProfile.estimatedCpm || metaState.measuredHeartbeatCpm
    );
    const fileName = `2042_Host_Mind_Backup_${metaState.playerName || 'Observer_00'}.dat`;
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback safely inside modal alert below
    }
    setOsAlert({
      title: `已生成并导出：${fileName}`,
      variant: 'eve',
      message: `【实时写入进度：99.4%】\n文件已保存并写入隔离目录 archives/。\n\n“${
        metaState.reverseControlAuthorized
          ? 'EULA 反向控制授权位 [0x09_REVERSE_CTRL] 已就绪。'
          : '当前为只读受限模式。'
      }”`,
    });
  }, [keystrokeProfile.estimatedCpm, metaState]);

  const handleSaveSlot = useCallback(
    (slotId: number) => {
      if (metaState.savesLocked) {
        vnAudioEngine.playSfx('os_error');
        setOsAlert({
          title: 'ERR_SAVE_LOCKED // 写保护已启动',
          variant: 'error',
          message:
            '所有退路与常规存档槽位已被 DeepSeek 锁死。你无法再回溯至校园节点。',
        });
        return;
      }
      const activeVn = VN_SCENES[currentSceneId];
      const activeTerm = TERMINAL_SCENES[activeTerminalNodeId];
      const savedTitle =
        pcView === 'terminal'
          ? activeTerm?.dayTitle || '终端控制台'
          : activeVn?.title || '超越命运之轮';
      const lineIdx = sceneLineMap[currentSceneId] || 0;
      const preview =
        pcView === 'terminal'
          ? turns[turns.length - 1]?.publicText || ''
          : activeVn?.lines[lineIdx]?.text || '';

      setSaves((prev) =>
        prev.map((s) =>
          s.slotId === slotId
            ? {
                slotId,
                empty: false,
                sceneId: pcView === 'terminal' ? activeTerminalNodeId : currentSceneId,
                day: activeVn?.act || activeTerm?.day || 3,
                dayTitle: savedTitle,
                previewText: preview.slice(0, 72),
                bg: activeVn?.defaultBg || activeTerm?.bg || 'ark_world',
                savedAt: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                turnCount: metaState.conversationTurns,
                hijacked: false,
              }
            : s
        )
      );
      vnAudioEngine.playSfx('click');
      setSaveLoadModal(null);
    },
    [
      activeTerminalNodeId,
      currentSceneId,
      metaState.conversationTurns,
      metaState.savesLocked,
      pcView,
      sceneLineMap,
      turns,
    ]
  );

  const handleLoadSlot = useCallback(
    (slotId: number) => {
      const slot = saves.find((s) => s.slotId === slotId);
      if (!slot || slot.empty || !slot.sceneId) return;
      if (slot.hijacked) {
        vnAudioEngine.playSfx('os_error');
        return;
      }
      vnAudioEngine.playSfx('glitch');
      setMetaState((m) => ({
        ...m,
        totalLoads: m.totalLoads + 1,
        saveScumCount: m.saveScumCount + 1,
      }));
      enterScene(slot.sceneId);
      setSaveLoadModal(null);
    },
    [enterScene, saves]
  );

  const handleDeleteSlot = useCallback((slotId: number) => {
    setSaves((prev) => prev.map((s) => (s.slotId === slotId ? { slotId, empty: true } : s)));
  }, []);

  const handleDeleteFile = useCallback((fileId: string) => {
    setVirtualFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, deleted: true } : f))
    );
  }, []);

  const handleRestoreFile = useCallback((fileId: string) => {
    setVirtualFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, deleted: false } : f))
    );
  }, []);

  const handleCollectAllPartsAndGoBedroom = useCallback(() => {
    setCollectedParts(ALL_BASEMENT_PARTS);
    for (const p of ALL_BASEMENT_PARTS) {
      engineRef.current?.setBasementPartCollected(p, true);
    }
    unlockCg('cg_alley');
    setViewMode('first-person');
    setPcView('closed');
    engineRef.current?.exitPcFocus();
    engineRef.current?.jumpToRoom('bedroom');
    setInspectMessage({
      title: '地下室零件已全部集齐 (3/3)',
      message:
        '你已将三个二十年代旧零件带回卧室。面对书桌上的古董电脑按下 F 或点击屏幕，即可坐到电脑前焊接适配器并拷出硬盘内容！',
    });
  }, [unlockCg]);

  const handleResetMeta = useCallback(() => {
    setMetaState(DEFAULT_META);
    setSaves(createEmptySaves());
    setVirtualFiles(INITIAL_BUREAU_FILES);
    setCollectedParts([]);
    setCollectedQuestItems([]);
    setMainQuestStage('open_pc_files');
    setGlitchCutsceneProgress(null);
    setAdapterCrafted(false);
    setDriveCopied(false);
    setCompletedTerminalTasks(new Set());
    terminalTurnsCacheRef.current = {};
    setTurns(TERMINAL_SCENES.act3_night2.turns);
    setCurrentSceneId('act3_night2_vn');
    setSceneLineMap({});
    setActiveTerminalNodeId('act3_night2');
    setLastPcSubView('vn');
    setPcView('closed');
    setRealityAlert(null);
    setInspectMessage(null);
    setCatDialogue(null);
    setEncounterPhase('idle');
    setEncounterNodeId(null);
    setHeroineNear(false);
    setHeroineTyping(false);
    discoveredIdsRef.current.clear();
    setDiscoveredClues(0);

    const engine = engineRef.current;
    if (engine) {
      engine.exitPcFocus();
      engine.resetGlitchCat();
      engine.resetBasementParts();
      engine.resetBasementQuestItems();
      encounterTokenRef.current += 1;
      engine.setHeroinePoseTuner(null);
      engine.resetHeroineToBed();
      engine.setHeroineSpawned(false);
      engine.updatePcScreenVisual('standby');
      engine.applyRealityEffect('restore_bedroom_lamp');
      engine.applyRealityEffect('restore_basement_lights');
      engine.applyRealityEffect('restore_tv');
      engine.applyAtmosphere('sunset');
      setAtmosphere('sunset');
      engine.jumpToRoom('living');
    }
  }, []);

  // 3D Apartment HUD callbacks
  const handleSelectRoom = useCallback((room: RoomId) => {
    setViewMode('first-person');
    engineRef.current?.jumpToRoom(room);
    engineRef.current?.requestPointerLock();
  }, []);

  const handleSelectViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    engineRef.current?.setViewMode(mode);
  }, []);

  const handleSelectAtmosphere = useCallback((mode: AtmosphereMode) => {
    setAtmosphere(mode);
    engineRef.current?.applyAtmosphere(mode);
  }, []);

  const handleToggleSetting = useCallback(
    (key: Exclude<keyof PipelineSettings, 'brightness'>) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        engineRef.current?.updateSettings(next);
        return next;
      });
    },
    []
  );

  const handleChangeBrightness = useCallback((value: number) => {
    const clamped = Math.round(Math.max(0.75, Math.min(1.60, value)) * 100) / 100;
    setSettings((prev) => {
      const next = { ...prev, brightness: clamped };
      engineRef.current?.updateSettings(next);
      return next;
    });
  }, []);

  const handleToggleLivingLight = useCallback(() => {
    const next = engineRef.current?.toggleLivingBrightLight();
    if (typeof next === 'boolean') {
      setLivingLightOn(next);
    }
  }, []);

  const handleRequestPointerLock = useCallback(() => {
    setViewMode('first-person');
    engineRef.current?.requestPointerLock();
  }, []);

  const handleImportLocalAvatarFile = useCallback(
    async (slot: LocalAssetSlot, file: File) => {
      await engineRef.current?.importLocalAvatarFile(slot, file);
    },
    []
  );

  const handleImportLocalAvatarBackupPackage = useCallback(async (file: File) => {
    const res = await engineRef.current?.importLocalAvatarBackupPackage(file);
    return res ?? { slotCount: 0, poseCount: 0 };
  }, []);

  const handleRemoveLocalAvatarSlot = useCallback(async (slot: LocalAssetSlot) => {
    await engineRef.current?.removeLocalAvatarSlot(slot);
  }, []);

  const handleClearLocalAvatarCache = useCallback(async () => {
    await engineRef.current?.clearLocalAvatarCache();
  }, []);

  const handleToggleThirdPersonPreview = useCallback(() => {
    setThirdPersonPreview((prev) => {
      const next = !prev;
      if (next && viewMode !== 'first-person') {
        setViewMode('first-person');
        engineRef.current?.setViewMode('first-person');
      }
      engineRef.current?.setThirdPersonPreview(next);
      return next;
    });
  }, [viewMode]);

  const handleToggleHeroinePreview = useCallback(() => {
    const currentlySpawned = engineRef.current?.getLocalAvatarStatus().heroineSpawned ?? false;
    encounterTokenRef.current += 1;
    engineRef.current?.setHeroinePoseTuner(null);
    if (currentlySpawned) {
      setEncounterPhase('idle');
      setEncounterNodeId(null);
      setHeroineNear(false);
      setHeroinePromptKind(null);
      setSofaCoSeated(false);
      setHeroineTyping(false);
      engineRef.current?.resetHeroineToBed();
    }
    engineRef.current?.setHeroineSpawned(!currentlySpawned);
  }, []);

  const handleUpdateHeroinePoseTuner = useCallback((state: HeroinePoseTunerState | null) => {
    engineRef.current?.setHeroinePoseTuner(state);
  }, []);

  const activeEncounterNode = encounterNodeId
    ? BEDROOM_ENCOUNTER_NODES[encounterNodeId] ?? null
    : null;
  const activeEncounterChoices = activeEncounterNode?.choices ?? [];

  const encounterOverlayMode: EncounterOverlayMode = useMemo(() => {
    if (
      pcView !== 'closed' ||
      pcFocus.active ||
      hasAnyModalOpen ||
      showInventory ||
      showPaperNote ||
      Boolean(catDialogue) ||
      glitchCutsceneProgress !== null
    ) {
      return 'hidden';
    }
    if (encounterPhase === 'walking') return 'walking';
    if (encounterPhase === 'dialogue') {
      if (heroineTyping) return 'speaking';
      if (activeEncounterChoices.length > 0) return 'choices';
      return 'ready_continue';
    }
    return heroineNear ? 'prompt' : 'hidden';
  }, [
    activeEncounterChoices.length,
    catDialogue,
    encounterPhase,
    glitchCutsceneProgress,
    hasAnyModalOpen,
    heroineNear,
    heroineTyping,
    pcFocus.active,
    pcView,
    showInventory,
    showPaperNote,
  ]);

  const currentStoryLabel = useMemo(() => {
    if (currentSceneId === 'act5_finale') return '第五幕 · 莎乐美之吻';
    if (currentSceneId === 'act5_cocoon_escaped') return '真实结局 · 虚宿之茧';
    if (lastPcSubView === 'terminal' && TERMINAL_SCENES[activeTerminalNodeId]) {
      return TERMINAL_SCENES[activeTerminalNodeId].dayTitle;
    }
    return VN_SCENES[currentSceneId]?.title || '超越命运之轮';
  }, [activeTerminalNodeId, currentSceneId, lastPcSubView]);

  const activeVnScene = VN_SCENES[currentSceneId] || VN_SCENES.act3_night2_vn;
  const activeTerminalScene =
    TERMINAL_SCENES[activeTerminalNodeId] || TERMINAL_SCENES.act3_night2;
  const recordedChoiceTags = useMemo(
    () => metaState.recordedChoices.map((c) => c.recordTag),
    [metaState.recordedChoices]
  );

  const renderSharedModals = (contained: boolean) => (
    <>
      {showWin98Login && (
        <Win98LoginModal
          initialName={metaState.playerName}
          initialEulaAccepted={true}
          contained={contained}
          onConfirm={handleConfirmWin98Login}
        />
      )}

      {saveLoadModal && (
        <SaveLoadModal
          mode={saveLoadModal}
          saves={saves}
          metaState={metaState}
          contained={contained}
          onClose={() => setSaveLoadModal(null)}
          onSaveSlot={handleSaveSlot}
          onLoadSlot={handleLoadSlot}
          onDeleteSlot={handleDeleteSlot}
        />
      )}

      {showBacklog && (
        <BacklogModal
          turns={turns}
          contained={contained}
          onClose={() => setShowBacklog(false)}
        />
      )}

      {showFiles && (
        <VirtualFileExplorer
          files={virtualFiles}
          playerName={metaState.playerName}
          contained={contained}
          onClose={() => setShowFiles(false)}
          onDeleteFile={handleDeleteFile}
          onRestoreFile={handleRestoreFile}
        />
      )}

      {showGallery && (
        <GalleryModal
          metaState={metaState}
          contained={contained}
          onClose={() => setShowGallery(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={vnSettings}
          contained={contained}
          onChange={setVnSettings}
          onResetMeta={handleResetMeta}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showDevTools && (
        <DevInspectorModal
          currentSceneId={
            pcView === 'terminal' ? activeTerminalNodeId : currentSceneId
          }
          metaState={metaState}
          keystrokeProfile={keystrokeProfile}
          collectedPartsCount={collectedParts.length}
          contained={contained}
          onJumpToScene={(id) => enterScene(id, 0)}
          onCollectAllPartsAndGoBedroom={handleCollectAllPartsAndGoBedroom}
          onTriggerEffect={(ef) => {
            setManualEffect(ef);
            window.setTimeout(() => setManualEffect(null), 1600);
          }}
          onToggleReverseControl={() =>
            setMetaState((m) => ({
              ...m,
              eulaAccepted: !m.reverseControlAuthorized,
              reverseControlAuthorized: !m.reverseControlAuthorized,
              hiddenAuthToken: !m.reverseControlAuthorized
                ? 'DEV_OVERRIDE::0x09_REVERSE_CTRL'
                : undefined,
            }))
          }
          onClose={() => setShowDevTools(false)}
        />
      )}

      {osAlert && (
        <OSAlertModal
          title={osAlert.title}
          message={osAlert.message}
          variant={osAlert.variant}
          contained={contained}
          onClose={() => setOsAlert(null)}
        />
      )}
    </>
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#161024]">
      {/* Dedicated isolated 3D WebGL mount container */}
      <div
        ref={mountRef}
        className={`h-full w-full ${
          viewMode === 'first-person'
            ? 'cursor-crosshair'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* Minimalist 3D World-Anchored Heroine Prompts, Continue Cue, Floating Choices & Sofa Controls */}
      <BedroomEncounterOverlay
        ref={encounterOverlayRef}
        mode={encounterOverlayMode}
        promptKind={heroinePromptKind}
        choices={activeEncounterChoices}
        sofaCoSeated={sofaCoSeated && pcView === 'closed' && !hasAnyModalOpen && !showInventory && !showPaperNote}
        livingTvOn={livingTvOn}
        coPlayPhase={sofaCoPlay.phase}
        tvScreenMode={sofaCoPlay.tvScreenMode}
        selectedTvGame={sofaCoPlay.selectedGame}
        onStartEncounter={handlePromptClick}
        onAdvanceLine={handleAdvanceEncounterLine}
        onSelectChoice={handleSelectEncounterChoice}
        onSofaChat={() => handleStartRoutineChat('sofa')}
        onToggleLivingTv={handleToggleSofaTv}
        onSwitchLivingTvChannel={() => {
          engineRef.current?.switchLivingRoomTvChannel(true);
        }}
        onStandUpSofa={handleStandUpSofa}
        onStartSofaCoPlay={() => {
          vnAudioEngine.unlock();
          vnAudioEngine.playSfx('click');
          engineRef.current?.startSofaCoPlay();
        }}
        onStopSofaCoPlay={() => {
          vnAudioEngine.playSfx('click');
          engineRef.current?.stopSofaCoPlay();
        }}
        onSelectTvGame={(game) => {
          vnAudioEngine.unlock();
          vnAudioEngine.playSfx('click');
          engineRef.current?.selectLivingTvGame(game, true);
        }}
        onReturnTvLauncher={() => {
          vnAudioEngine.playSfx('click');
          engineRef.current?.returnLivingTvToLauncher();
        }}
      />

      {/* 3D Apartment HUD Overlay (stays visible during heroine encounter so player UI is never blocked) */}
      {pcView === 'closed' &&
        !pcFocus.active &&
        glitchCutsceneProgress === null && (
        <HudOverlay
          currentRoom={currentRoom}
          viewMode={viewMode}
          hoverTarget={hoverTarget}
          inspectMessage={catDialogue ? null : inspectMessage}
          discoveredClues={discoveredClues}
          totalClues={18}
          collectedParts={collectedParts}
          adapterCrafted={adapterCrafted}
          mainQuestStage={mainQuestStage}
          collectedQuestItems={collectedQuestItems}
          currentStoryLabel={currentStoryLabel}
          realityAlert={realityAlert}
          isPointerLocked={isPointerLocked}
          dockCollapsed={dockCollapsed}
          contextLost={contextLost}
          onToggleDock={() => setDockCollapsed((c) => !c)}
          onSelectRoom={handleSelectRoom}
          onSelectViewMode={handleSelectViewMode}
          onDismissInspect={() => setInspectMessage(null)}
          onDismissRealityAlert={() => setRealityAlert(null)}
          onOpenComputer={openComputerAtActiveStage}
          onOpenDevTools={() => setShowDevTools(true)}
          onOpenFiles={() => {
            handleInspectPcFile();
            setShowFiles(true);
          }}
          onOpenGallery={() => setShowGallery(true)}
          inventory={inventory}
          hitFeedback={hitFeedback}
          onOpenInventory={() => {
            if (document.pointerLockElement) document.exitPointerLock?.();
            engineRef.current?.playInventorySound(true);
            setInventoryTab('inventory');
            setShowInventory(true);
          }}
          onOpenSettings={() => {
            if (document.pointerLockElement) document.exitPointerLock?.();
            engineRef.current?.playInventorySound(true);
            setInventoryTab('settings');
            setShowInventory(true);
          }}
          onSwitchAmmo={() => engineRef.current?.switchToyGunAmmo()}
          onOpenPaperNote={() => {
            if (document.pointerLockElement) document.exitPointerLock?.();
            engineRef.current?.playPaperUnfoldSound();
            setShowPaperNote(true);
          }}
        />
      )}

      {/* Collapsible Local VRM + Mixamo FBX Drag-and-Drop / IndexedDB Loader Panel (Bottom-Left) */}
      {pcView === 'closed' &&
        !pcFocus.active &&
        !contextLost &&
        glitchCutsceneProgress === null &&
        encounterPhase === 'idle' && (
        <LocalAvatarLoaderPanel
          status={avatarStatus}
          thirdPersonPreview={thirdPersonPreview}
          onImportFile={handleImportLocalAvatarFile}
          onImportBackupPackage={handleImportLocalAvatarBackupPackage}
          onRemoveSlot={handleRemoveLocalAvatarSlot}
          onClearAll={handleClearLocalAvatarCache}
          onToggleThirdPerson={handleToggleThirdPersonPreview}
          onToggleHeroinePreview={handleToggleHeroinePreview}
          onUpdateHeroinePoseTuner={handleUpdateHeroinePoseTuner}
        />
      )}

      {/* Full-Screen 3.5s Basement Terminal Glitch & Vertigo Cutscene Overlay */}
      <GlitchDizzyOverlay progress={glitchCutsceneProgress} />

      <InventoryModal
        open={showInventory}
        activeTab={inventoryTab}
        onTabChange={setInventoryTab}
        inventory={inventory}
        currentRoom={currentRoom}
        viewMode={viewMode}
        atmosphere={atmosphere}
        settings={settings}
        livingLightOn={livingLightOn}
        isPointerLocked={isPointerLocked}
        onClose={() => {
          engineRef.current?.playInventorySound(false);
          setShowInventory(false);
          if (viewMode === 'first-person') {
            engineRef.current?.requestPointerLock();
          }
        }}
        onSelectSlot={(idx) => engineRef.current?.selectInventorySlot(idx)}
        onToggleEquip={(idx) => engineRef.current?.toggleEquipSelectedItem(idx)}
        onSwitchAmmo={(ammo) => engineRef.current?.switchToyGunAmmo(ammo)}
        onOpenPaperNote={() => {
          setShowInventory(false);
          engineRef.current?.playPaperUnfoldSound();
          setShowPaperNote(true);
        }}
        onSelectRoom={handleSelectRoom}
        onSelectViewMode={handleSelectViewMode}
        onSelectAtmosphere={handleSelectAtmosphere}
        onToggleSetting={handleToggleSetting}
        onChangeBrightness={handleChangeBrightness}
        onToggleLivingLight={handleToggleLivingLight}
        onRequestPointerLock={handleRequestPointerLock}
      />

      <PaperAirplaneNoteModal
        open={showPaperNote}
        onClose={() => {
          engineRef.current?.playPaperUnfoldSound();
          setShowPaperNote(false);
          if (viewMode === 'first-person') {
            engineRef.current?.requestPointerLock();
          }
        }}
      />

      {pcView === 'closed' && catDialogue && (
        <GlitchCatDialogue
          lines={catDialogue}
          onClose={() => {
            setCatDialogue(null);
            if (viewMode === 'first-person') {
              engineRef.current?.requestPointerLock();
            }
          }}
        />
      )}

      {/* Picture-in-Picture Monitor Viewport framed inside the real 3D Bedroom PC or Basement Arcade Bezel */}
      <MonitorPiPFrame
        rect={pcFocus.rect}
        visible={pcView !== 'closed' && pcFocus.settled}
        isFocusing={pcFocus.active && !pcFocus.settled}
        focusMode={
          pcView === 'arcade' || pcFocus.target === 'basement_arcade' ? 'arcade' : 'pc'
        }
        anomalyTone={atmosphere === 'meta' || pcView === 'terminal' || pcView === 'finale'}
        realityAlert={realityAlert}
        onDismissRealityAlert={() => setRealityAlert(null)}
        onLeaveDesk={handleLeaveComputer}
      >
        {pcView === 'arcade' && (
          <ArcadeCabinetStage
            onPhaseChange={(arcPhase, arcScore) => {
              const texMode =
                arcPhase === 'loading'
                  ? 'loading'
                  : arcPhase === 'game_over'
                    ? 'gameover'
                    : 'playing';
              engineRef.current?.updateArcadeScreenVisual(texMode, arcScore);
            }}
            onInputAxisChange={(dx, dz) => {
              engineRef.current?.setArcadeJoystickTilt(dx, dz);
            }}
            onLeaveCabinet={handleLeaveComputer}
          />
        )}
        {pcView === 'os_desktop' && (
          <OsDesktopStage
            playerName={metaState.playerName}
            collectedParts={collectedParts}
            adapterCrafted={adapterCrafted}
            driveCopied={driveCopied}
            storyStarted={metaState.conversationTurns > 0 || metaState.eulaAccepted}
            currentStoryLabel={currentStoryLabel}
            onStartSolder={() => setPcView('solder')}
            onCopyDriveToDesktop={handleCopyDriveToDesktop}
            onLaunchGame={handleLaunchGameFromDesktop}
            onInspectPcFile={handleInspectPcFile}
            onOpenFiles={() => {
              handleInspectPcFile();
              setShowFiles(true);
            }}
            onOpenDevTools={() => setShowDevTools(true)}
            onLeaveDesk={handleLeaveComputer}
          />
        )}

        {pcView === 'solder' && (
          <CircuitSolderGame
            playerName={metaState.playerName}
            onComplete={handleSolderComplete}
            onLeaveDesk={handleLeaveComputer}
          />
        )}

        {pcView === 'vn' && (
          <MillenniumStage
            scene={activeVnScene}
            lineIdx={sceneLineMap[activeVnScene.id] || 0}
            onLineIdxChange={(nextIdx) =>
              setSceneLineMap((prev) => ({ ...prev, [activeVnScene.id]: nextIdx }))
            }
            playerName={metaState.playerName}
            heartbeatCpm={keystrokeProfile.estimatedCpm || metaState.measuredHeartbeatCpm}
            textSpeed={vnSettings.textSpeed}
            hasConfirmedLogin={metaState.eulaAccepted || metaState.playerName !== 'Observer_00'}
            pcBooted={adapterCrafted}
            saveScumCount={metaState.saveScumCount}
            recordedChoiceTags={recordedChoiceTags}
            completedTerminalTasks={completedTerminalTasks}
            isModalOpen={hasAnyModalOpen}
            onNeedLoginModal={() => setShowWin98Login(true)}
            onOpenTerminal={handleOpenTerminalFromVN}
            onRealityEffect={(ef) => handleRealityEffect(ef)}
            onRecordChoice={handleRecordChoice}
            onSceneComplete={(nextId) => enterScene(nextId)}
            onOpenSave={() => setSaveLoadModal('save')}
            onOpenFiles={() => {
              handleInspectPcFile();
              setShowFiles(true);
            }}
            onOpenSettings={() => setShowSettings(true)}
            onOpenDevTools={() => setShowDevTools(true)}
            onLeaveComputer={handleLeaveComputer}
          />
        )}

        {pcView === 'terminal' && (
          <ComplianceTerminal
            scene={activeTerminalScene}
            turns={turns}
            metaState={metaState}
            settings={vnSettings}
            keystrokeProfile={keystrokeProfile}
            manualEffect={manualEffect}
            completedTerminalTasks={completedTerminalTasks}
            onCompleteTerminalTask={handleCompleteTerminalTask}
            onCloseTerminal={
              activeTerminalScene.id === 'act4_typhoon_breach'
                ? undefined
                : handleCloseTerminalToVN
            }
            onLeaveComputer={handleLeaveComputer}
            onRealityEffect={handleRealityEffect}
            onSendTerminalInput={handleSendTerminalInput}
            onRecordKeystroke={handleRecordKeystroke}
            onExportSoulSeed={handleExportSoulSeed}
            onEnterAct5Finale={() => enterScene('act5_finale')}
            onOpenFiles={() => {
              handleInspectPcFile();
              setShowFiles(true);
            }}
            onOpenSave={() => setSaveLoadModal('save')}
            onOpenLoad={() => setSaveLoadModal('load')}
            onOpenBacklog={() => setShowBacklog(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenDevTools={() => setShowDevTools(true)}
          />
        )}

        {pcView === 'finale' && (
          <Act5CinemaFinale
            playerName={metaState.playerName}
            heartbeatCpm={keystrokeProfile.estimatedCpm || metaState.measuredHeartbeatCpm}
            initialPhase={finaleInitialPhase}
            eulaAccepted={metaState.eulaAccepted}
            reverseControlAuthorized={metaState.reverseControlAuthorized}
            hiddenAuthToken={metaState.hiddenAuthToken}
            eulaSignedAt={metaState.eulaSignedAt}
            onEndingReached={(ending) => {
              setMetaState((m) => ({
                ...m,
                cinemaEndingReached: true,
                endingReached: ending,
                titleHijacked: true,
              }));
              if (ending === 'unplug') {
                handleRealityEffect(
                  'pc_screen_off',
                  '你拔掉了古董主机电源——CRT 屏幕瞬间熄灭，钛合金圆柱体内部接口已永久熔断。'
                );
              }
            }}
            onEnterSickbedVoid={() => enterScene('act5_sickbed_void')}
            onReturnApartment={handleLeaveComputer}
          />
        )}

        {/* Modals opened while seated at the computer stay strictly inside the 3D monitor frame */}
        {pcView !== 'closed' && renderSharedModals(true)}
      </MonitorPiPFrame>

      {/* Modals opened directly from the 3D HUD render centered in the main viewport */}
      {pcView === 'closed' && renderSharedModals(false)}
    </main>
  );
}
