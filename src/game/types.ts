import type * as THREE from 'three';

export type RoomId =
  | 'living'
  | 'entryway'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'basement';

export type AtmosphereMode = 'daylight' | 'sunset' | 'midnight' | 'meta';

export type ViewMode = 'first-person' | 'overview';

export interface PipelineSettings {
  celShading: boolean;
  volumetricRays: boolean;
  inkOutlines: boolean;
  audioEnabled: boolean;
  occlusionCulling: boolean;
  disablePostInNormal: boolean;
  brightness: number;
}

export interface AABB {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  enabled: boolean;
}

export type BasementPartId =
  | 'part_pcie_card'
  | 'part_photodiode'
  | 'part_oscillator';

export type BasementQuestItemId = 'quest_keepsake' | 'quest_battery';

export type MainQuestStage =
  | 'open_pc_files'
  | 'find_basement_items'
  | 'activate_basement_terminal'
  | 'return_to_bedroom';

export type RealityEffect =
  | 'power_cut_bedroom'
  | 'restore_bedroom_lamp'
  | 'power_cut_basement'
  | 'restore_basement_lights'
  | 'flicker_apartment'
  | 'hijack_tv'
  | 'restore_tv'
  | 'open_doors_anomaly'
  | 'atmosphere_midnight'
  | 'atmosphere_meta'
  | 'restore_sunset'
  | 'pc_screen_standby'
  | 'pc_screen_galgame'
  | 'pc_screen_terminal'
  | 'pc_screen_breach'
  | 'pc_screen_off';

export interface InteractableTarget {
  id: string;
  label: string;
  actionLabel: string;
  room: RoomId;
  mesh: THREE.Object3D;
  onInteract: () => InteractResult | void;
}

export interface CatDialogueLine {
  speaker: string;
  hexTag: string;
  text: string;
}

export type InventoryItemId = 'toy_gun' | 'paper_airplane_note';

export type ToyGunAmmoType = 'dart' | 'net';

export interface InventoryItem {
  id: InventoryItemId;
  name: string;
  shortName: string;
  category: string;
  description: string;
  equippable: boolean;
  readable?: boolean;
  noteText?: string;
}

export interface InventorySnapshot {
  slots: (InventoryItem | null)[];
  selectedSlot: number;
  equippedSlot: number | null;
  ammoType: ToyGunAmmoType;
  paperAirplaneCaptured: boolean;
}

export interface HitFeedbackPayload {
  id: number;
  kind: 'dart' | 'net' | 'capture' | 'bounce';
  label?: string;
}

export interface InteractResult {
  title: string;
  message: string;
  metaTrigger?: boolean;
  sanityDelta?: number;
  collectPartId?: BasementPartId;
  collectQuestItemId?: BasementQuestItemId;
  triggerBasementTerminal?: boolean;
  pickupItemId?: InventoryItemId;
  openPcAction?: boolean;
  openArcadeAction?: boolean;
  catDialogue?: CatDialogueLine[];
}

export interface DoorController {
  id: string;
  pivot: THREE.Object3D;
  colliderId: string;
  isOpen: boolean;
  closedAngle: number;
  openAngle: number;
  currentAngle: number;
  isRoomDoor?: boolean;
  hingePos?: THREE.Vector3;
  doorWidth?: number;
  axisDir?: 'x+' | 'x-' | 'z+' | 'z-';
  defaultOpenSign?: 1 | -1;
  angularVel?: number;
  pushSign?: 1 | -1;
  isBeingPushed?: boolean;
  wasPassingThrough?: boolean;
  audioPlayedForPush?: boolean;
  closeThudPlayed?: boolean;
  playAudio?: (open: boolean) => void;
  /** World-tracked empty anchor nodes positioned at each door lever / cabinet handle */
  handleAnchors?: THREE.Object3D[];
}

export interface RoomPreset {
  id: RoomId;
  nameZh: string;
  nameEn: string;
  position: [number, number, number];
  yaw: number;
  pitch: number;
}

export const ROOM_PRESETS: Record<RoomId, RoomPreset> = {
  living: {
    id: 'living',
    nameZh: '客厅',
    nameEn: 'Living Room',
    position: [0.45, 1.62, -2.65],
    yaw: -1.15,
    pitch: -0.06,
  },
  entryway: {
    id: 'entryway',
    nameZh: '玄关',
    nameEn: 'Entryway',
    position: [-4.10, 1.62, 4.45],
    yaw: 2.68,
    pitch: -0.05,
  },
  dining: {
    id: 'dining',
    nameZh: '餐厅',
    nameEn: 'Dining Room',
    position: [-1.05, 1.62, 2.75],
    yaw: -1.25,
    pitch: -0.06,
  },
  kitchen: {
    id: 'kitchen',
    nameZh: '厨房',
    nameEn: 'Kitchen',
    position: [4.10, 1.62, 3.50],
    yaw: -1.95,
    pitch: -0.08,
  },
  bedroom: {
    id: 'bedroom',
    nameZh: '卧室',
    nameEn: 'Bedroom',
    position: [-2.25, 1.62, -3.10],
    yaw: 1.18,
    pitch: -0.06,
  },
  bathroom: {
    id: 'bathroom',
    nameZh: '浴室',
    nameEn: 'Bathroom',
    position: [5.22, 1.62, -11.15],
    yaw: 0.24,
    pitch: -0.08,
  },
  basement: {
    id: 'basement',
    nameZh: '地下储藏间',
    nameEn: 'Basement Storage',
    position: [-7.40, -1.58, -0.45],
    yaw: -1.18,
    pitch: -0.05,
  },
};
