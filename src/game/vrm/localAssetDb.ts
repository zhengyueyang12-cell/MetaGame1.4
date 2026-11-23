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

let dbPromise: Promise<IDBDatabase> | null = null;

function openAssetDb(): Promise<IDBDatabase> {
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

/**
 * Classifies dropped or multi-selected local files into their matching avatar/animation slot.
 */
export function classifyLocalAvatarFiles(
  files: FileList | File[]
): { matched: Partial<Record<LocalAssetSlot, File>>; unrecognized: string[] } {
  const matched: Partial<Record<LocalAssetSlot, File>> = {};
  const unrecognized: string[] = [];
  const arr = Array.from(files);

  for (const file of arr) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.vrm')) {
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

  return { matched, unrecognized };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
