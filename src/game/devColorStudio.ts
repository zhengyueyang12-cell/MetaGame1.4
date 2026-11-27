import * as THREE from 'three';

export type ColorStudioCategory = 'global' | 'living' | 'dining' | 'bedroom' | 'bathEntry';

export interface ColorStudioEntry {
  key: string;
  label: string;
  category: ColorStudioCategory;
  kind: 'color' | 'range';
  defaultValue: string | number;
  value: string | number;
  min?: number;
  max?: number;
  step?: number;
  materials: Set<THREE.Material>;
  multipliers: Map<THREE.Material, number>;
  customApply?: (val: string | number) => void;
}

const STORAGE_KEY = 'mea_apartment_color_studio_v1';
const PANEL_ID = 'apartment-color-studio-panel';

const CATEGORY_LABELS: Record<ColorStudioCategory, string> = {
  global: '全局/顶/灯',
  living: '客厅',
  dining: '餐厨',
  bedroom: '卧室',
  bathEntry: '卫浴/玄关',
};

const CATEGORY_ORDER: ColorStudioCategory[] = [
  'global',
  'living',
  'dining',
  'bedroom',
  'bathEntry',
];

function loadSavedColors(): Record<string, string | number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveColorsToStorage(map: Record<string, string | number>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function materialToHex(mat: THREE.Material): string {
  const m = mat as THREE.MeshStandardMaterial;
  if (m && m.color && typeof m.color.getHexString === 'function') {
    return '#' + m.color.getHexString();
  }
  return '#ffffff';
}

class ApartmentColorStudio {
  private entries = new Map<string, ColorStudioEntry>();
  private saved: Record<string, string | number> = {};
  private panelEl: HTMLDivElement | null = null;
  private activeCategory: ColorStudioCategory = 'global';
  private bodyEl: HTMLDivElement | null = null;
  private tabButtons = new Map<ColorStudioCategory, HTMLButtonElement>();
  private keydownBound = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.saved = loadSavedColors();
    }
  }

  public resetRegistryForNewScene(): void {
    this.entries.clear();
    this.saved = typeof window !== 'undefined' ? loadSavedColors() : {};
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
      this.bodyEl = null;
      this.tabButtons.clear();
    }
  }

  public registerMaterialColor(
    key: string,
    label: string,
    category: ColorStudioCategory,
    material: THREE.Material | THREE.Material[],
    opts?: { multiplier?: number; defaultHex?: string }
  ): void {
    const mats = Array.isArray(material) ? material : [material];
    const mult = opts?.multiplier ?? 1.0;

    let entry = this.entries.get(key);
    if (!entry) {
      const defHex = opts?.defaultHex ?? materialToHex(mats[0]);
      const initial = typeof this.saved[key] === 'string' ? this.saved[key] : defHex;
      entry = {
        key,
        label,
        category,
        kind: 'color',
        defaultValue: defHex,
        value: initial,
        materials: new Set(),
        multipliers: new Map(),
      };
      this.entries.set(key, entry);
    }

    for (const m of mats) {
      entry.materials.add(m);
      entry.multipliers.set(m, mult);
    }

    // Immediately apply saved/persisted color to newly registered materials
    if (typeof this.saved[key] === 'string') {
      this.applyEntryToMaterials(entry, String(this.saved[key]));
    }
    this.installGlobals();
  }

  public registerCustomControl(
    key: string,
    label: string,
    category: ColorStudioCategory,
    kind: 'color' | 'range',
    defaultValue: string | number,
    onApply: (val: string | number) => void,
    rangeOpts?: { min: number; max: number; step: number }
  ): void {
    const savedVal = this.saved[key];
    const initial =
      savedVal !== undefined &&
      ((kind === 'color' && typeof savedVal === 'string') ||
        (kind === 'range' && typeof savedVal === 'number'))
        ? savedVal
        : defaultValue;

    const entry: ColorStudioEntry = {
      key,
      label,
      category,
      kind,
      defaultValue,
      value: initial,
      min: rangeOpts?.min,
      max: rangeOpts?.max,
      step: rangeOpts?.step,
      materials: new Set(),
      multipliers: new Map(),
      customApply: onApply,
    };
    this.entries.set(key, entry);

    if (savedVal !== undefined) {
      onApply(initial);
    }
    this.installGlobals();
  }

  private applyEntryToMaterials(entry: ColorStudioEntry, val: string | number): void {
    if (entry.customApply) {
      entry.customApply(val);
    }
    if (entry.kind === 'color' && typeof val === 'string') {
      const baseCol = new THREE.Color(val);
      for (const m of entry.materials) {
        const std = m as THREE.MeshStandardMaterial;
        if (std.color) {
          const mult = entry.multipliers.get(m) ?? 1.0;
          std.color.copy(baseCol);
          if (mult !== 1.0) std.color.multiplyScalar(mult);
        }
      }
    }
  }

  public set(key: string, value: string | number): Record<string, string | number> {
    const entry = this.entries.get(key);
    if (!entry) return this.get();
    entry.value = value;
    this.applyEntryToMaterials(entry, value);
    this.saved[key] = value;
    saveColorsToStorage(this.saved);
    return this.get();
  }

  public setAll(partial: Record<string, string | number>): Record<string, string | number> {
    for (const [k, v] of Object.entries(partial)) {
      if (v !== undefined) this.set(k, v);
    }
    this.renderCategoryBody();
    return this.get();
  }

  public get(): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const [k, e] of this.entries.entries()) {
      out[k] = e.value;
    }
    return out;
  }

  public reset(category?: ColorStudioCategory): Record<string, string | number> {
    for (const entry of this.entries.values()) {
      if (category && entry.category !== category) continue;
      entry.value = entry.defaultValue;
      this.applyEntryToMaterials(entry, entry.defaultValue);
      delete this.saved[entry.key];
    }
    saveColorsToStorage(this.saved);
    this.renderCategoryBody();
    return this.get();
  }

  private renderCategoryBody(): void {
    if (!this.bodyEl) return;
    this.bodyEl.innerHTML = '';

    for (const [cat, btn] of this.tabButtons.entries()) {
      const active = cat === this.activeCategory;
      btn.style.background = active ? '#4e8c57' : 'rgba(255,255,255,0.08)';
      btn.style.color = active ? '#fff' : '#d6d2cc';
    }

    const list = Array.from(this.entries.values()).filter(
      (e) => e.category === this.activeCategory
    );
    for (const entry of list) {
      const row = document.createElement('label');
      row.style.cssText =
        'display:flex;justify-content:space-between;align-items:center;margin:6px 0;gap:8px;';
      const span = document.createElement('span');
      span.textContent =
        entry.kind === 'range' ? `${entry.label} (${entry.value})` : entry.label;

      const inp = document.createElement('input');
      if (entry.kind === 'range') {
        inp.type = 'range';
        inp.min = String(entry.min ?? 40);
        inp.max = String(entry.max ?? 200);
        inp.step = String(entry.step ?? 4);
        inp.value = String(entry.value);
        inp.style.cssText = 'width:108px;cursor:pointer;';
        inp.oninput = () => {
          const num = Number(inp.value);
          span.textContent = `${entry.label} (${num})`;
          this.set(entry.key, num);
        };
      } else {
        inp.type = 'color';
        inp.value = String(entry.value);
        inp.style.cssText =
          'width:44px;height:22px;border:none;background:none;cursor:pointer;padding:0;';
        inp.oninput = () => {
          this.set(entry.key, inp.value);
        };
      }
      row.append(span, inp);
      this.bodyEl.appendChild(row);
    }
  }

  private ensurePanel(): HTMLDivElement {
    if (this.panelEl) return this.panelEl;
    const existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = PANEL_ID;
    Object.assign(el.style, {
      position: 'fixed',
      top: '14px',
      right: '14px',
      width: '300px',
      maxHeight: '84vh',
      display: 'none',
      flexDirection: 'column',
      background: 'rgba(22, 20, 28, 0.92)',
      color: '#f5f2eb',
      border: '1px solid rgba(255, 255, 255, 0.16)',
      borderRadius: '10px',
      padding: '12px 14px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '12px',
      zIndex: '99999',
      boxShadow: '0 10px 28px rgba(0,0,0,0.48)',
      backdropFilter: 'blur(8px)',
    });

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600;font-size:13px;';
    header.innerHTML = '<span>🎨 全屋家具调色面板 (F8 · 自动保存)</span>';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText =
      'background:none;border:none;color:#ccc;font-size:16px;cursor:pointer;padding:0 4px;';
    closeBtn.onclick = () => {
      el.style.display = 'none';
    };
    header.appendChild(closeBtn);
    el.appendChild(header);

    const tabs = document.createElement('div');
    tabs.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;';
    for (const cat of CATEGORY_ORDER) {
      const b = document.createElement('button');
      b.textContent = CATEGORY_LABELS[cat];
      b.style.cssText =
        'padding:4px 7px;border-radius:6px;border:none;cursor:pointer;font-size:11px;font-weight:500;';
      b.onclick = () => {
        this.activeCategory = cat;
        this.renderCategoryBody();
      };
      this.tabButtons.set(cat, b);
      tabs.appendChild(b);
    }
    el.appendChild(tabs);

    const body = document.createElement('div');
    body.style.cssText = 'overflow-y:auto;max-height:52vh;padding-right:4px;';
    this.bodyEl = body;
    el.appendChild(body);

    const btnBar = document.createElement('div');
    btnBar.style.cssText = 'display:flex;gap:6px;margin-top:10px;';

    const resetPageBtn = document.createElement('button');
    resetPageBtn.textContent = '重置本页';
    resetPageBtn.style.cssText =
      'flex:1;padding:5px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;cursor:pointer;font-size:11px;';
    resetPageBtn.onclick = () => this.reset(this.activeCategory);

    const resetAllBtn = document.createElement('button');
    resetAllBtn.textContent = '全部重置';
    resetAllBtn.style.cssText =
      'flex:1;padding:5px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;cursor:pointer;font-size:11px;';
    resetAllBtn.onclick = () => this.reset();

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '复制 JSON';
    copyBtn.style.cssText =
      'flex:1;padding:5px;border-radius:6px;border:none;background:#4e8c57;color:#fff;cursor:pointer;font-weight:600;font-size:11px;';
    copyBtn.onclick = () => {
      const json = JSON.stringify(this.get(), null, 2);
      navigator.clipboard?.writeText(json).catch(() => {});
      console.log('[APARTMENT_COLOR_DEV]', json);
      copyBtn.textContent = '已复制!';
      setTimeout(() => {
        copyBtn.textContent = '复制 JSON';
      }, 1200);
    };

    btnBar.append(resetPageBtn, resetAllBtn, copyBtn);
    el.appendChild(btnBar);

    document.body.appendChild(el);
    this.panelEl = el;
    this.renderCategoryBody();
    return el;
  }

  public openPanel(): void {
    const el = this.ensurePanel();
    el.style.display = 'flex';
    this.renderCategoryBody();
  }

  public closePanel(): void {
    if (this.panelEl) this.panelEl.style.display = 'none';
  }

  public togglePanel(): void {
    const el = this.ensurePanel();
    const opening = el.style.display === 'none';
    el.style.display = opening ? 'flex' : 'none';
    if (opening) this.renderCategoryBody();
  }

  public installGlobals(): void {
    if (typeof window === 'undefined') return;
    const api = {
      get: () => this.get(),
      set: (key: string, value: string | number) => {
        const res = this.set(key, value);
        this.renderCategoryBody();
        return res;
      },
      setAll: (partial: Record<string, string | number>) => this.setAll(partial),
      reset: (category?: ColorStudioCategory) => this.reset(category),
      openPanel: () => this.openPanel(),
      closePanel: () => this.closePanel(),
      togglePanel: () => this.togglePanel(),
    };
    const w = window as unknown as {
      __APARTMENT_COLOR_DEV__?: typeof api;
      __LIVING_COLOR_DEV__?: typeof api;
      __APARTMENT_COLOR_DEV_KEYDOWN__?: (e: KeyboardEvent) => void;
    };
    w.__APARTMENT_COLOR_DEV__ = api;
    w.__LIVING_COLOR_DEV__ = api;

    if (!this.keydownBound) {
      if (w.__APARTMENT_COLOR_DEV_KEYDOWN__) {
        window.removeEventListener('keydown', w.__APARTMENT_COLOR_DEV_KEYDOWN__);
      }
      w.__APARTMENT_COLOR_DEV_KEYDOWN__ = (e: KeyboardEvent) => {
        if (e.key === 'F8') {
          e.preventDefault();
          this.togglePanel();
        }
      };
      window.addEventListener('keydown', w.__APARTMENT_COLOR_DEV_KEYDOWN__);
      this.keydownBound = true;
    }
  }
}

export const apartmentColorStudio = new ApartmentColorStudio();
