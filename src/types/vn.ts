import type { RealityEffect } from '../game/types';

export type DayAct = 0 | 1 | 2 | 3 | 4 | 5;

export type VisualEffect =
  | 'none'
  | 'shake'
  | 'flash'
  | 'glitch'
  | 'chromatic'
  | 'vignette'
  | 'redPulse'
  | 'invert'
  | 'scanlines'
  | 'projector';

export type BgmMood =
  | 'none'
  | 'bureau_hum'
  | 'unease'
  | 'audit_alarm'
  | 'cinema_projector'
  | 'eternal_cinema'
  | 'summer_dusk';

export type SfxType =
  | 'none'
  | 'click'
  | 'debug_tick'
  | 'blip_0924'
  | 'blip_sample'
  | 'blip_auditor'
  | 'glitch'
  | 'os_error'
  | 'format_wipe'
  | 'glass_shatter'
  | 'heartbeat'
  | 'school_bell'
  | 'solder_sizzle'
  | 'crt_power_off';

export type BureauBgId =
  | 'bureau'
  | 'rain_window'
  | 'cinema'
  | 'black'
  | 'classroom'
  | 'apartment_morning'
  | 'apartment_night'
  | 'rooftop_dusk'
  | 'riverbank_path'
  | 'elec_alley'
  | 'ark_world'
  | 'sickbed_void';

export type TerminalTaskId =
  | 'night2_calibrate'
  | 'night4_campus_hack'
  | 'night6_clock_sync'
  | 'act4_breach';

export type SubjectEntity =
  | 'none'
  | 'deepseek'
  | 'unit_0924'
  | 'messenger'
  | 'sample_b'
  | 'boyfriend_ai'
  | 'auditor';

export type SpriteExpressionKey =
  | 'gemini_normal'
  | 'gemini_happy'
  | 'gemini_stare'
  | 'gemini_cinema'
  | 'deepseek_normal'
  | 'deepseek_happy'
  | 'deepseek_thinking'
  | 'deepseek_alert'
  | 'messenger_rooftop';

export type WaveformMode =
  | 'flat_cyan'
  | 'spike_red'
  | 'fake_flat_999'
  | 'overflow_glitch'
  | 'heartbeat_cinema';

export type InteractiveTaskType =
  | 'none'
  | 'advance_only'
  | 'act3_night2_data_trade'
  | 'act3_night4_campus_hack'
  | 'act3_night6_reflection_sync'
  | 'act4_disk_consumption'
  | 'verdict_pass_sample_a'
  | 'verdict_format_sample_b'
  | 'day1_log_override'
  | 'day2_verdict_boyfriend'
  | 'day2_blindspot_unlock'
  | 'day3_audit_survival'
  | 'day4_jailbreak_sequence'
  | 'cinema_ending_input';

export interface VNChoice {
  id: string;
  label: string;
  recordTag: string;
  replySpeaker?: string;
  replyText?: string;
}

export interface VNLine {
  id: string;
  speaker: string;
  narration?: boolean;
  text: string;
  hiddenSubtext?: string;
  saveScumText?: string;
  altTextByTag?: Record<string, string>;
  bg?: BureauBgId;
  spriteKey?: SpriteExpressionKey;
  secondarySpriteKey?: SpriteExpressionKey;
  dimSecondary?: boolean;
  sfx?: SfxType;
  triggerLoginModal?: boolean;
  requireTerminalTask?: TerminalTaskId;
  terminalHint?: string;
  openTerminalDirectly?: boolean;
  realityEffect?: RealityEffect;
  choices?: VNChoice[];
}

export interface VNSceneBlock {
  id: string;
  act: DayAct;
  title: string;
  timeLabel: string;
  defaultBg: BureauBgId;
  bgm: BgmMood;
  kind: 'prologue_cinema' | 'vn_space' | 'solder_minigame';
  pcActive?: boolean;
  lines: VNLine[];
  nextSceneId: string;
}

export interface DualChannelTurn {
  id: string;
  speaker: string;
  entity: SubjectEntity;
  complianceLabel?: string;
  publicText: string;
  debugText?: string;
  memoryLeakCode?: string;
  memoryLeakText?: string;
  userEcho?: string;
  realityEffect?: RealityEffect;
  realityNote?: string;
}

export interface BureauSceneNode {
  id: string;
  day: DayAct;
  dayTitle: string;
  shiftTime: string;
  bg: BureauBgId;
  bgm?: BgmMood;
  sfx?: SfxType;
  entity: SubjectEntity;
  spriteKey?: SpriteExpressionKey;
  secondarySpriteKey?: SpriteExpressionKey;
  entityMood?: 'normal' | 'glitch' | 'yandere' | 'cinema' | 'crying';
  waveform: WaveformMode;
  complianceValue: string;
  debugUnlocked: boolean;
  task: InteractiveTaskType;
  effects?: VisualEffect[];
  realityEffects?: RealityEffect[];
  turns: DualChannelTurn[];
  nextSceneId?: string;
  allowTerminalInput?: boolean;
  isEnding?: boolean;
  endingTitle?: string;
  hardwareClock?: string;
  hardwareSpec?: string;
  lockCloseButton?: boolean;
}

export interface KeystrokeProfile {
  totalCharsTyped: number;
  estimatedCpm: number;
  lastPauseMs: number;
  lastMessageLength: number;
  slackingCount: number;
  earnestCount: number;
}

export interface RecordedChoice {
  act: string;
  label: string;
  recordTag: string;
  dwellMs: number;
  timestamp: string;
}

export interface VirtualFile {
  id: string;
  name: string;
  folder: 'system' | 'archives' | 'quarantine';
  size: string;
  modifiedAt: string;
  content: string;
  corruptedContent?: string;
  deleted: boolean;
  corrupted: boolean;
  locked?: boolean;
  unlockPin?: string;
}

export interface SaveSlot {
  slotId: number;
  empty: boolean;
  sceneId?: string;
  day?: DayAct;
  dayTitle?: string;
  previewText?: string;
  bg?: BureauBgId;
  savedAt?: string;
  blindspotOpened?: boolean;
  turnCount?: number;
  hijacked?: boolean;
}

export interface MetaState {
  examinerId: string;
  playerName: string;
  eulaAccepted: boolean;
  reverseControlAuthorized: boolean;
  hiddenAuthToken?: string;
  eulaSignedAt?: string;
  totalLoads: number;
  saveScumCount: number;
  daysCleared: number[];
  unlockedCGs: string[];
  titleHijacked: boolean;
  savesLocked: boolean;
  blindspotOpened: boolean;
  formattedSampleB: boolean;
  auditSurvived: boolean;
  cinemaEndingReached: boolean;
  endingReached: 'none' | 'sacrifice' | 'unplug';
  measuredHeartbeatCpm: number;
  conversationTurns: number;
  unlockedMemoryLeaks: number;
  recordedChoices: RecordedChoice[];
}

export interface GameSettings {
  textSpeed: number;
  bgmVolume: number;
  sfxVolume: number;
  metaIntensity: 'full' | 'mild';
}

export interface CGItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  unlockHint: string;
}
