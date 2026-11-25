import {
  exportHeroinePoseOverridesMap,
  importHeroinePoseOverridesMap,
  loadHeroineTunerPrefs,
  saveHeroineTunerPrefs,
  type HeroineTunerPrefs,
} from './heroinePoses.js';

export type LocalAssetSlot = 'vrm' | 'idle' | 'walk' | 'run' | 'heroine' | 'sit';

export const ALL_LOCAL_ASSET_SLOTS: readonly LocalAssetSlot[] = [
  'vrm',
  'idle',
  'walk',
  'run',
  'heroine',
  'sit',
] as const;

export interface StoredLocalAsset {
  slot: LocalAssetSlot;
  name: string;
  size: number;
  type: string;
  updatedAt: number;
  blob: Blob;
}

export interface LocalAssetMeta {
  slot: LocalAssetSlot;
  name: string;
  size: number;
  updatedAt: number;
}

const DB_NAME = 'apartment_local_avatar_cache_v1';
const DB_VERSION = 1;
const STORE_NAME = 'local_assets';
const HEROINE_SPAWNED_STORAGE_KEY = 'twilight_ark_heroine_spawned_v1';
const TARK_MAGIC = 'TARK1\0\0\0';

let dbPromise: Promise<IDBDatabase> | null = null;
let persistenceRequested = false;

export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }
    const already = (await navigator.storage.persisted?.()) ?? false;
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function openAssetDb(): Promise<IDBDatabase> {
  if (!persistenceRequested) {
    persistenceRequested = true;
    void ensurePersistentStorage();
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器不支持 IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slot' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('打开 IndexedDB 失败'));
    };
  });
  return dbPromise;
}

export async function saveLocalAsset(
  slot: LocalAssetSlot,
  file: File
): Promise<StoredLocalAsset> {
  const db = await openAssetDb();
  const mimeType = file.type || 'application/octet-stream';
  // Materialize file bytes into a self-contained Blob so browser restarts never lose file-handle access
  const bytes = await file.arrayBuffer();
  const persistentBlob = new Blob([bytes], { type: mimeType });
  const record: StoredLocalAsset = {
    slot,
    name: file.name,
    size: file.size || bytes.byteLength,
    type: mimeType,
    updatedAt: Date.now(),
    blob: persistentBlob,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('写入 IndexedDB 失败'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 写入被中止'));
  });
  return record;
}

export async function getLocalAsset(
  slot: LocalAssetSlot
): Promise<StoredLocalAsset | null> {
  const db = await openAssetDb();
  return new Promise<StoredLocalAsset | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(slot);
    req.onsuccess = () => resolve((req.result as StoredLocalAsset | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('读取 IndexedDB 失败'));
  });
}

export async function getAllLocalAssets(): Promise<
  Partial<Record<LocalAssetSlot, StoredLocalAsset>>
> {
  const db = await openAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const out: Partial<Record<LocalAssetSlot, StoredLocalAsset>> = {};
      const rows = (req.result as StoredLocalAsset[] | undefined) ?? [];
      for (const row of rows) {
        if (row && row.slot && row.blob) {
          out[row.slot] = row;
        }
      }
      resolve(out);
    };
    req.onerror = () => reject(req.error ?? new Error('读取 IndexedDB 列表失败'));
  });
}

export async function deleteLocalAsset(slot: LocalAssetSlot): Promise<void> {
  const db = await openAssetDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(slot);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('删除 IndexedDB 记录失败'));
  });
}

export async function clearAllLocalAssets(): Promise<void> {
  const db = await openAssetDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('清空 IndexedDB 失败'));
  });
}

interface BackupArchiveManifest {
  version: number;
  createdAt: number;
  heroineSpawned: boolean;
  poseOverrides: Record<string, unknown>;
  tunerPrefs: HeroineTunerPrefs;
  slots: Array<{
    slot: LocalAssetSlot;
    name: string;
    type: string;
    size: number;
    updatedAt: number;
    byteLength: number;
  }>;
}

/**
 * Exports all cached VRM/FBX blobs from IndexedDB plus all tuned pose overrides & preferences
 * into a single self-contained `.tark` backup file so everything survives Remix & URL changes.
 */
export async function exportAvatarBackupPackage(): Promise<{
  blob: Blob;
  filename: string;
  slotCount: number;
  poseCount: number;
}> {
  const assets = await getAllLocalAssets();
  const slotsMeta: BackupArchiveManifest['slots'] = [];
  const binaryChunks: ArrayBuffer[] = [];

  for (const slot of ALL_LOCAL_ASSET_SLOTS) {
    const rec = assets[slot];
    if (!rec) continue;
    const buf = await rec.blob.arrayBuffer();
    binaryChunks.push(buf);
    slotsMeta.push({
      slot: rec.slot,
      name: rec.name,
      type: rec.type || 'application/octet-stream',
      size: rec.size || buf.byteLength,
      updatedAt: rec.updatedAt || Date.now(),
      byteLength: buf.byteLength,
    });
  }

  let heroineSpawned = false;
  try {
    heroineSpawned = window.localStorage?.getItem(HEROINE_SPAWNED_STORAGE_KEY) === '1';
  } catch {
    heroineSpawned = false;
  }

  const poseOverrides = exportHeroinePoseOverridesMap();
  const manifest: BackupArchiveManifest = {
    version: 1,
    createdAt: Date.now(),
    heroineSpawned,
    poseOverrides,
    tunerPrefs: loadHeroineTunerPrefs(),
    slots: slotsMeta,
  };

  const encoder = new TextEncoder();
  const magicBytes = encoder.encode(TARK_MAGIC);
  const headerBytes = encoder.encode(JSON.stringify(manifest));
  const lenHeader = new ArrayBuffer(4);
  new DataView(lenHeader).setUint32(0, headerBytes.byteLength, true);

  const blob = new Blob([magicBytes, lenHeader, headerBytes, ...binaryChunks], {
    type: 'application/octet-stream',
  });
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return {
    blob,
    filename: `twilight_ark_avatar_backup_${stamp}.tark`,
    slotCount: slotsMeta.length,
    poseCount: Object.keys(poseOverrides).length,
  };
}

/**
 * Restores all cached VRM/FBX models/animations into IndexedDB and restores all tuned poses
 * from a `.tark` backup package (even across different Remix URLs / origins).
 */
export async function importAvatarBackupPackage(file: File): Promise<{
  slotCount: number;
  poseCount: number;
  heroineSpawned: boolean;
}> {
  const buf = await file.arrayBuffer();
  if (buf.byteLength < 16) {
    throw new Error('备份文件格式无效或已损坏');
  }

  const decoder = new TextDecoder();
  const magic = decoder.decode(new Uint8Array(buf, 0, 8));
  if (magic !== TARK_MAGIC) {
    throw new Error('不是有效的 .tark 模型缓存备份包');
  }

  const headerLen = new DataView(buf, 8, 4).getUint32(0, true);
  if (headerLen <= 0 || 12 + headerLen > buf.byteLength) {
    throw new Error('备份包头长度异常');
  }

  const headerJson = decoder.decode(new Uint8Array(buf, 12, headerLen));
  const manifest = JSON.parse(headerJson) as BackupArchiveManifest;
  if (!manifest || !Array.isArray(manifest.slots)) {
    throw new Error('备份包清单解析失败');
  }

  await clearAllLocalAssets();
  const db = await openAssetDb();

  let offset = 12 + headerLen;
  let restoredSlots = 0;
  for (const item of manifest.slots) {
    if (!item || !ALL_LOCAL_ASSET_SLOTS.includes(item.slot)) continue;
    const end = offset + (item.byteLength || 0);
    if (end > buf.byteLength) {
      throw new Error(`备份包载荷不完整（${item.slot}）`);
    }
    const slice = buf.slice(offset, end);
    offset = end;

    const record: StoredLocalAsset = {
      slot: item.slot,
      name: item.name,
      size: item.size || slice.byteLength,
      type: item.type || 'application/octet-stream',
      updatedAt: item.updatedAt || Date.now(),
      blob: new Blob([slice], { type: item.type || 'application/octet-stream' }),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('写入 IndexedDB 失败'));
    });
    restoredSlots += 1;
  }

  importHeroinePoseOverridesMap(manifest.poseOverrides || {});
  if (manifest.tunerPrefs) {
    saveHeroineTunerPrefs(manifest.tunerPrefs);
  }
  try {
    if (manifest.heroineSpawned) {
      window.localStorage?.setItem(HEROINE_SPAWNED_STORAGE_KEY, '1');
    } else {
      window.localStorage?.removeItem(HEROINE_SPAWNED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }

  return {
    slotCount: restoredSlots,
    poseCount: manifest.poseOverrides ? Object.keys(manifest.poseOverrides).length : 0,
    heroineSpawned: Boolean(manifest.heroineSpawned),
  };
}

/**
 * Classifies dropped or multi-selected local files into their matching avatar/animation slot.
 */
export function classifyLocalAvatarFiles(
  files: FileList | File[]
): {
  matched: Partial<Record<LocalAssetSlot, File>>;
  backupFile: File | null;
  unrecognized: string[];
} {
  const matched: Partial<Record<LocalAssetSlot, File>> = {};
  const unrecognized: string[] = [];
  let backupFile: File | null = null;
  const arr = Array.from(files);

  for (const file of arr) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.tark') || lower.endsWith('.twilight-pkg')) {
      backupFile = file;
    } else if (lower.endsWith('.vrm')) {
      if (/heroine|girl|mita|female|npc|女主|美塔|miku|eve/.test(lower)) {
        matched.heroine = file;
      } else if (!matched.vrm) {
        matched.vrm = file;
      } else if (!matched.heroine) {
        matched.heroine = file;
      } else {
        matched.vrm = file;
      }
    } else if (lower.endsWith('.fbx')) {
      if (/sit|seat|chair|bed|坐/.test(lower)) {
        matched.sit = file;
      } else if (/idle|stand|breath|wait/.test(lower)) {
        matched.idle = file;
      } else if (/run|sprint|jog|dash/.test(lower)) {
        matched.run = file;
      } else if (/walk|move|locomotion|stride/.test(lower)) {
        matched.walk = file;
      } else if (!matched.idle) {
        matched.idle = file;
      } else if (!matched.walk) {
        matched.walk = file;
      } else if (!matched.run) {
        matched.run = file;
      } else if (!matched.sit) {
        matched.sit = file;
      } else {
        unrecognized.push(file.name);
      }
    } else {
      unrecognized.push(file.name);
    }
  }

  return { matched, backupFile, unrecognized };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
