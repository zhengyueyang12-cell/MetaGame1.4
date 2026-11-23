import * as THREE from 'three';
import {
  createBeveledBox,
  createBeveledSlab,
} from '../geometries';
import { mergeStaticGroupToSingleMesh } from '../SceneManager';
import { createErgonomicSwivelChair } from '../entities/buildErgonomicChair';
import {
  type RoomBuildContext,
} from './roomContext';

/**
 * Draws the live retro red CRT screen canvas: oscilloscope grid, dual animated
 * harmonic waveforms, diagnostic status bar, and bold "DATA TRANSFERRED" readout.
 * Adapted to the moody dark basement lab aesthetic.
 */
export function drawBasementTerminalCrtCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
  scanPulse = 0
): void {
  // Deep phosphor CRT glass backdrop
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.48, 22, w * 0.5, h * 0.5, w * 0.68);
  bg.addColorStop(0, scanPulse > 0.05 ? '#163544' : '#102631');
  bg.addColorStop(0.7, '#09161d');
  bg.addColorStop(1, '#040a0e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle oscilloscope calibration grid
  ctx.strokeStyle = 'rgba(72, 214, 210, 0.14)';
  ctx.lineWidth = 1;
  for (let gx = 32; gx < w; gx += 32) {
    ctx.beginPath();
    ctx.moveTo(gx + 0.5, 22);
    ctx.lineTo(gx + 0.5, h - 22);
    ctx.stroke();
  }
  for (let gy = 32; gy < h; gy += 32) {
    ctx.beginPath();
    ctx.moveTo(20, gy + 0.5);
    ctx.lineTo(w - 20, gy + 0.5);
    ctx.stroke();
  }

  // Top telemetry header bar
  ctx.fillStyle = 'rgba(218, 66, 86, 0.24)';
  ctx.fillRect(20, 18, w - 40, 28);
  ctx.strokeStyle = 'rgba(255, 108, 128, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 18, w - 40, 28);

  ctx.fillStyle = '#ff9aa8';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CORE_LINK // CH-04 [SYNC OK]', 30, 37);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7bf5e2';
  const pulsePct = Math.min(100, Math.round(98 + Math.sin(time * 2.1) * 1.8));
  ctx.fillText(`SIG ${pulsePct}%`, w - 30, 37);

  // Upper live dual-channel oscilloscope waveforms
  const waveTop = 64;
  const waveH = 104;
  const waveMid = waveTop + waveH * 0.5;
  ctx.strokeStyle = 'rgba(110, 238, 228, 0.28)';
  ctx.strokeRect(20, waveTop, w - 40, waveH);

  // Secondary crimson-amber harmonic carrier wave
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 122, 138, 0.72)';
  ctx.lineWidth = 2;
  for (let x = 26; x <= w - 26; x += 4) {
    const nx = (x - 26) / (w - 52);
    const env = Math.sin(nx * Math.PI);
    const y =
      waveMid +
      Math.sin(nx * 18.0 - time * 5.2) * 16 * env +
      Math.cos(nx * 41.0 + time * 8.4) * (6 + scanPulse * 8) * env;
    if (x === 26) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Primary luminous cyan-mint neural transfer waveform
  ctx.beginPath();
  ctx.strokeStyle = '#6cf7e8';
  ctx.lineWidth = 2.6;
  ctx.shadowColor = '#3ce8d8';
  ctx.shadowBlur = 8;
  for (let x = 26; x <= w - 26; x += 3) {
    const nx = (x - 26) / (w - 52);
    const env = 0.35 + 0.65 * Math.sin(nx * Math.PI);
    const spike =
      Math.exp(-Math.pow((nx - ((time * 0.24) % 1.0)) * 14, 2)) * (22 + scanPulse * 14);
    const y =
      waveMid -
      spike * Math.sin(nx * 60) +
      Math.sin(nx * 11.5 - time * 3.8) * 18 * env +
      Math.sin(nx * 29.0 - time * 7.1) * 7 * env;
    if (x === 26) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Center high-contrast DATA TRANSFERRED readout box
  const boxY = 186;
  const boxH = 116;
  ctx.fillStyle = 'rgba(10, 28, 36, 0.88)';
  ctx.fillRect(26, boxY, w - 52, boxH);
  ctx.strokeStyle = scanPulse > 0.1 ? '#ff7a92' : '#64efe0';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(26, boxY, w - 52, boxH);

  // Corner reticle ticks
  ctx.fillStyle = '#ff6b82';
  ctx.fillRect(26, boxY, 12, 4);
  ctx.fillRect(w - 38, boxY, 12, 4);
  ctx.fillRect(26, boxY + boxH - 4, 12, 4);
  ctx.fillRect(w - 38, boxY + boxH - 4, 12, 4);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(108, 247, 232, 0.65)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#e8fffb';
  ctx.font = 'bold 34px monospace';
  ctx.fillText('DATA', w * 0.5, boxY + 46);
  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = scanPulse > 0.1 ? '#ffd0d8' : '#7ef9ec';
  ctx.fillText('TRANSFERRED', w * 0.5, boxY + 86);
  ctx.restore();

  // Bottom progress bar + hex memory dump line
  const barY = 320;
  ctx.fillStyle = 'rgba(84, 224, 212, 0.18)';
  ctx.fillRect(28, barY, w - 56, 14);
  const segCount = 18;
  const segW = (w - 64) / segCount;
  const activeSegs = Math.floor(((Math.sin(time * 0.9) * 0.08 + 0.92)) * segCount);
  for (let i = 0; i < segCount; i++) {
    ctx.fillStyle = i < activeSegs ? (i > segCount - 4 ? '#ff6d86' : '#5ef2e2') : 'rgba(94, 242, 226, 0.14)';
    ctx.fillRect(32 + i * segW, barY + 3, segW - 4, 8);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(166, 236, 230, 0.8)';
  ctx.font = '13px monospace';
  ctx.fillText('MEM: 0x04F8 -> REALITY_GEN // LINKED', 28, 356);
  ctx.textAlign = 'right';
  ctx.fillStyle = Math.sin(time * 5.0) > 0 ? '#78ffbe' : '#3a8f74';
  ctx.fillText('● ACTIVE', w - 28, 356);

  // Subtle CRT phosphor scanlines & glass vignette
  ctx.fillStyle = 'rgba(0, 6, 10, 0.22)';
  for (let sy = 0; sy < h; sy += 4) {
    ctx.fillRect(0, sy, w, 1.5);
  }
}

function createGreenPcbTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const c = canvas.getContext('2d')!;

  // Rich emerald-forest solder mask backdrop
  c.fillStyle = '#124e33';
  c.fillRect(0, 0, 512, 384);

  // Fine copper trace bus network
  c.strokeStyle = '#2da86c';
  c.lineWidth = 3;
  for (let i = 0; i < 22; i++) {
    const y = 18 + i * 16;
    c.beginPath();
    c.moveTo(12, y);
    c.lineTo(140 + (i % 5) * 24, y);
    c.lineTo(164 + (i % 5) * 24, y + (i % 2 === 0 ? 12 : -12));
    c.lineTo(498, y + (i % 2 === 0 ? 12 : -12));
    c.stroke();
  }
  // Vertical power rail busbars
  c.strokeStyle = '#d4a84e';
  c.lineWidth = 4;
  for (const vx of [64, 212, 370, 456]) {
    c.beginPath();
    c.moveTo(vx, 14);
    c.lineTo(vx, 370);
    c.stroke();
  }

  // Gold plated vias & solder pads
  for (let gx = 28; gx < 490; gx += 36) {
    for (let gy = 26; gy < 360; gy += 34) {
      c.fillStyle = '#e5be62';
      c.beginPath();
      c.arc(gx, gy, 4.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#0c2d1e';
      c.beginPath();
      c.arc(gx, gy, 1.8, 0, Math.PI * 2);
      c.fill();
    }
  }

  // IC chip silkscreen outlines & dark silicon packages
  const chips: [number, number, number, number, string][] = [
    [92, 68, 96, 92, 'FPGA-98X'],
    [248, 56, 86, 68, 'VRAM-04'],
    [248, 162, 102, 86, 'CORE-DSP'],
    [88, 214, 108, 84, 'PSU-REG'],
    [392, 102, 54, 152, 'BUS-IO'],
  ];
  for (const [cx, cy, cw, ch, lbl] of chips) {
    c.fillStyle = '#181c24';
    c.fillRect(cx, cy, cw, ch);
    c.strokeStyle = '#a2f0c4';
    c.lineWidth = 2;
    c.strokeRect(cx - 3, cy - 3, cw + 6, ch + 6);
    // Silver IC gull-wing pins
    c.fillStyle = '#cfd8e2';
    for (let px = cx + 8; px < cx + cw - 6; px += 12) {
      c.fillRect(px, cy - 8, 5, 6);
      c.fillRect(px, cy + ch + 2, 5, 6);
    }
    c.fillStyle = '#b4e4cc';
    c.font = 'bold 12px monospace';
    c.textAlign = 'center';
    c.fillText(lbl, cx + cw * 0.5, cy + ch * 0.5 + 4);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCorrugatedHoseTextures(): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = 256;
  colorCanvas.height = 64;
  const cc = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 64;
  const bc = bumpCanvas.getContext('2d')!;

  // Accordion corrugated ribs along U (length of tube)
  for (let x = 0; x < 256; x++) {
    const phase = (x / 256) * Math.PI * 2 * 8;
    const ridge = 0.5 + 0.5 * Math.sin(phase);
    const shade = Math.round(22 + ridge * 30);
    cc.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 7})`;
    cc.fillRect(x, 0, 1, 64);

    const bVal = Math.round(30 + ridge * 215);
    bc.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
    bc.fillRect(x, 0, 1, 64);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(9, 1);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(9, 1);

  return { map, bumpMap };
}

function createBreakerWarningTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const c = canvas.getContext('2d')!;

  // Weathered industrial hazard yellow placard
  c.fillStyle = '#e5b235';
  c.fillRect(0, 0, 256, 160);

  // Diagonal black-yellow warning border top & bottom
  c.fillStyle = '#1b1b22';
  c.fillRect(0, 0, 256, 22);
  c.fillRect(0, 138, 256, 22);
  c.fillStyle = '#e5b235';
  for (let x = -20; x < 276; x += 26) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x + 12, 0);
    c.lineTo(x + 2, 22);
    c.lineTo(x - 10, 22);
    c.closePath();
    c.fill();

    c.beginPath();
    c.moveTo(x, 138);
    c.lineTo(x + 12, 138);
    c.lineTo(x + 2, 160);
    c.lineTo(x - 10, 160);
    c.closePath();
    c.fill();
  }

  // Inner dark warning frame
  c.strokeStyle = '#1c1c24';
  c.lineWidth = 4;
  c.strokeRect(10, 28, 236, 104);

  // Red-trimmed warning triangle + lightning bolt on left
  c.fillStyle = '#1c1c24';
  c.beginPath();
  c.moveTo(58, 40);
  c.lineTo(94, 112);
  c.lineTo(22, 112);
  c.closePath();
  c.fill();
  c.fillStyle = '#f2c144';
  c.beginPath();
  c.moveTo(58, 50);
  c.lineTo(86, 106);
  c.lineTo(30, 106);
  c.closePath();
  c.fill();
  // Lightning bolt
  c.fillStyle = '#c42736';
  c.beginPath();
  c.moveTo(61, 58);
  c.lineTo(48, 82);
  c.lineTo(59, 82);
  c.lineTo(52, 102);
  c.lineTo(70, 76);
  c.lineTo(59, 76);
  c.closePath();
  c.fill();

  // Bold industrial typography
  c.fillStyle = '#191920';
  c.font = 'bold 26px sans-serif';
  c.textAlign = 'left';
  c.fillText('高压危险', 106, 70);
  c.fillStyle = '#a81e2c';
  c.font = 'bold 17px monospace';
  c.fillText('DANGER 380V', 106, 95);
  c.fillStyle = '#252530';
  c.font = 'bold 12px monospace';
  c.fillText('MAIN BREAKER B-01', 106, 116);

  // Light grime & scratches
  c.fillStyle = 'rgba(40, 34, 28, 0.14)';
  for (let i = 0; i < 45; i++) {
    c.fillRect((i * 53) % 250, (i * 37) % 154, 4, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createPegboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;

  // Powder-coated industrial slate-steel pegboard backing
  const bg = c.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, '#444854');
  bg.addColorStop(1, '#363944');
  c.fillStyle = bg;
  c.fillRect(0, 0, 512, 256);

  // Faint workshop scuff marks & painted tool shadow outlines
  c.strokeStyle = 'rgba(215, 224, 236, 0.14)';
  c.lineWidth = 2;
  c.strokeRect(12, 12, 488, 232);

  // Crisp uniform perforated pegboard hole grid
  for (let y = 20; y <= 236; y += 16) {
    for (let x = 20; x <= 492; x += 16) {
      // Dark punched bore
      c.fillStyle = '#171920';
      c.beginPath();
      c.arc(x, y, 3.1, 0, Math.PI * 2);
      c.fill();
      // Subtle lower metallic bevel catchlight
      c.fillStyle = 'rgba(170, 180, 198, 0.28)';
      c.beginPath();
      c.arc(x + 0.8, y + 1.0, 2.2, 0.2, Math.PI * 0.85);
      c.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createClueBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 360;
  const c = canvas.getContext('2d')!;

  // Textured warm corkboard backdrop
  c.fillStyle = '#8b6a4e';
  c.fillRect(0, 0, 512, 360);
  for (let i = 0; i < 3600; i++) {
    const px = (i * 197 + (i % 13) * 17) % 512;
    const py = (i * 283 + (i % 11) * 19) % 360;
    const shade = i % 2 === 0 ? 'rgba(64, 44, 28, 0.22)' : 'rgba(176, 144, 108, 0.18)';
    c.fillStyle = shade;
    c.fillRect(px, py, 2, 2);
  }

  // 1. Blue Circuit Schematic Sheet (Top-Left)
  c.save();
  c.translate(28, 26);
  c.rotate(-0.03);
  c.fillStyle = '#1c3e68';
  c.fillRect(0, 0, 210, 148);
  c.strokeStyle = 'rgba(166, 224, 255, 0.82)';
  c.lineWidth = 1.6;
  c.strokeRect(8, 8, 194, 132);
  // Circuit diagram boxes & signal buses
  c.strokeRect(22, 26, 50, 32);
  c.strokeRect(102, 26, 74, 38);
  c.strokeRect(36, 86, 62, 36);
  c.strokeRect(128, 88, 54, 34);
  c.beginPath();
  c.moveTo(72, 42); c.lineTo(102, 42);
  c.moveTo(47, 58); c.lineTo(47, 86);
  c.moveTo(98, 104); c.lineTo(128, 104);
  c.moveTo(140, 64); c.lineTo(140, 88);
  c.stroke();
  // Sine wave sketch
  c.beginPath();
  for (let sx = 0; sx < 44; sx += 2) {
    const sy = 104 + Math.sin(sx * 0.45) * 9;
    if (sx === 0) c.moveTo(44 + sx, sy); else c.lineTo(44 + sx, sy);
  }
  c.stroke();
  c.fillStyle = '#cceeff';
  c.font = 'bold 10px monospace';
  c.fillText('BRIDGE SCHEMATIC v2.4', 18, 20);
  c.fillText('48MHz', 28, 46);
  c.fillText('PCI-E BUS', 110, 48);
  c.fillText('OPTICAL', 134, 108);
  c.restore();

  // 2. Aged Grid Paper Wiring Notes (Bottom-Center)
  c.save();
  c.translate(154, 186);
  c.rotate(0.025);
  c.fillStyle = '#e7dfce';
  c.fillRect(0, 0, 194, 144);
  c.strokeStyle = 'rgba(104, 138, 174, 0.25)';
  c.lineWidth = 1;
  for (let gx = 12; gx < 194; gx += 14) {
    c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, 144); c.stroke();
  }
  for (let gy = 12; gy < 144; gy += 14) {
    c.beginPath(); c.moveTo(0, gy); c.lineTo(194, gy); c.stroke();
  }
  c.fillStyle = '#2b2a34';
  c.font = 'bold 11px monospace';
  c.fillText('CHECKLIST // SECTOR 06', 12, 22);
  c.fillStyle = '#3c3a46';
  c.font = '10px monospace';
  c.fillText('[x] BYPASS WATCHDOG', 12, 44);
  c.fillText('[x] SOLDER 48MHz CLK', 12, 62);
  c.fillText('[ ] CALIBRATE DIODE', 12, 80);
  c.fillText('[ ] OPEN FLOOR HATCH', 12, 98);
  // Hand-drawn red circle emphasis
  c.strokeStyle = '#c92f3e';
  c.lineWidth = 2.2;
  c.beginPath();
  c.ellipse(104, 118, 64, 14, -0.05, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#b42333';
  c.font = 'bold 11px monospace';
  c.fillText('DO NOT CUT POWER!', 48, 122);
  c.restore();

  // 3. Polaroid / Snapshot Photo Card (Top-Right)
  c.save();
  c.translate(362, 30);
  c.rotate(0.055);
  c.fillStyle = '#f2eee6';
  c.fillRect(0, 0, 114, 128);
  c.fillStyle = '#1b2836';
  c.fillRect(9, 10, 96, 86);
  // Abstract cyan wireframe silhouette on snapshot
  c.strokeStyle = '#62f4ff';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(57, 34, 12, 0, Math.PI * 2);
  c.moveTo(57, 46); c.lineTo(57, 76);
  c.moveTo(40, 56); c.lineTo(74, 56);
  c.stroke();
  c.fillStyle = '#33313b';
  c.font = '10px monospace';
  c.fillText('UNIT-0924 ?', 20, 116);
  c.restore();

  // 4. Colored Sticky Notes (Yellow, Pink, Mint-Cyan)
  const stickies: [number, number, number, string, string, string][] = [
    [258, 36, -0.06, '#f4df72', 'PIN 7 -> GND', 'NO FILTER!'],
    [268, 112, 0.04, '#f3a0b2', 'BASEMENT', 'VENT = 65cm'],
    [36, 206, -0.04, '#9be4d6', 'VOLT 380V', 'BREAKER W'],
    [378, 198, -0.05, '#f4df72', 'RACK 1 & 3', 'SPARE IC'],
    [388, 272, 0.06, '#f5c484', 'HATCH KEY?', 'CHECK LAB'],
  ];
  for (const [sx, sy, rot, col, line1, line2] of stickies) {
    c.save();
    c.translate(sx, sy);
    c.rotate(rot);
    c.fillStyle = 'rgba(20, 14, 10, 0.24)';
    c.fillRect(4, 5, 86, 66);
    c.fillStyle = col;
    c.fillRect(0, 0, 86, 66);
    c.fillStyle = 'rgba(0, 0, 0, 0.07)';
    c.fillRect(0, 0, 86, 12);
    c.fillStyle = '#24232c';
    c.font = 'bold 10px monospace';
    c.fillText(line1, 8, 30);
    c.fillText(line2, 8, 48);
    c.restore();
  }

  // 5. Red Investigation Yarn Connecting Key Clues
  const pins: [number, number][] = [
    [130, 36],
    [298, 46],
    [414, 42],
    [248, 198],
    [76, 216],
    [420, 210],
  ];
  c.strokeStyle = 'rgba(210, 42, 56, 0.86)';
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(pins[0][0], pins[0][1]);
  c.lineTo(pins[1][0], pins[1][1]);
  c.lineTo(pins[2][0], pins[2][1]);
  c.lineTo(pins[3][0], pins[3][1]);
  c.lineTo(pins[0][0], pins[0][1]);
  c.moveTo(pins[4][0], pins[4][1]);
  c.lineTo(pins[3][0], pins[3][1]);
  c.lineTo(pins[5][0], pins[5][1]);
  c.stroke();

  for (const [px, py] of pins) {
    c.fillStyle = '#d93244';
    c.beginPath();
    c.arc(px, py, 5.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffadb6';
    c.beginPath();
    c.arc(px - 1.5, py - 1.5, 1.8, 0, Math.PI * 2);
    c.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createAntiSlipMatTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;

  // Dark heavy vulcanized industrial rubber base
  c.fillStyle = '#252831';
  c.fillRect(0, 0, 512, 256);

  // Raised diamond-plate / ribbed anti-slip tread grid
  c.strokeStyle = '#363b47';
  c.lineWidth = 2;
  for (let y = 16; y < 240; y += 14) {
    for (let x = 16; x < 496; x += 18) {
      const alt = ((x + y) / 2) % 2 === 0;
      c.beginPath();
      if (alt) {
        c.moveTo(x - 4, y - 3);
        c.lineTo(x + 4, y + 3);
      } else {
        c.moveTo(x - 4, y + 3);
        c.lineTo(x + 4, y - 3);
      }
      c.stroke();
    }
  }

  // Worn yellow safety border strip around perimeter
  c.strokeStyle = '#cfa03a';
  c.lineWidth = 10;
  c.strokeRect(10, 10, 492, 236);

  // Workshop dust & shoe scuff wear in front standing zone
  const scuff = c.createRadialGradient(256, 178, 12, 256, 178, 145);
  scuff.addColorStop(0, 'rgba(130, 126, 138, 0.16)');
  scuff.addColorStop(1, 'rgba(40, 42, 52, 0)');
  c.fillStyle = scuff;
  c.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createScarredWorkbenchWoodTexture(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const w = 512;
  const h = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = w;
  colCanvas.height = h;
  const c = colCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const b = bumpCanvas.getContext('2d')!;

  let s = 918273;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  // Base oiled weathered workshop timber planks (4 horizontal boards across depth)
  const plankColors = ['#694c38', '#5e4331', '#6e503a', '#573d2c'];
  const plankH = h / 4;
  b.fillStyle = '#808080';
  b.fillRect(0, 0, w, h);

  for (let p = 0; p < 4; p++) {
    const py = p * plankH;
    c.fillStyle = plankColors[p];
    c.fillRect(0, py, w, plankH);

    // Longitudinal coarse timber grain streaks
    for (let g = 0; g < 68; g++) {
      const gy = py + rand() * plankH;
      const dark = rand() > 0.42;
      c.strokeStyle = dark
        ? `rgba(28, 17, 10, ${0.12 + rand() * 0.18})`
        : `rgba(148, 112, 78, ${0.08 + rand() * 0.12})`;
      c.lineWidth = 0.8 + rand() * 2.4;
      c.beginPath();
      c.moveTo(0, gy);
      c.bezierCurveTo(
        w * 0.32,
        gy + (rand() - 0.5) * 9,
        w * 0.68,
        gy + (rand() - 0.5) * 9,
        w,
        gy + (rand() - 0.5) * 5
      );
      c.stroke();

      b.strokeStyle = dark ? 'rgba(62,62,62,0.34)' : 'rgba(176,176,176,0.22)';
      b.lineWidth = 1.0 + rand() * 1.4;
      b.beginPath();
      b.moveTo(0, gy);
      b.lineTo(w, gy + (rand() - 0.5) * 3);
      b.stroke();
    }

    // Occasional timber knots
    for (let k = 0; k < 2; k++) {
      const kx = 48 + rand() * (w - 96);
      const ky = py + 24 + rand() * (plankH - 48);
      const kr = 8 + rand() * 11;
      const kg = c.createRadialGradient(kx, ky, 1, kx, ky, kr);
      kg.addColorStop(0, 'rgba(30, 18, 11, 0.72)');
      kg.addColorStop(0.55, 'rgba(54, 34, 22, 0.38)');
      kg.addColorStop(1, 'rgba(54, 34, 22, 0)');
      c.fillStyle = kg;
      c.beginPath();
      c.ellipse(kx, ky, kr * 1.7, kr * 0.78, (rand() - 0.5) * 0.2, 0, Math.PI * 2);
      c.fill();
    }

    // Dark plank kerf seam
    if (p > 0) {
      c.fillStyle = 'rgba(18, 12, 8, 0.78)';
      c.fillRect(0, py - 2, w, 4);
      b.fillStyle = '#242424';
      b.fillRect(0, py - 2, w, 4);
    }
  }

  // Heavy dark machine-oil stains & greasy grime blotches
  const oilSpots: [number, number, number, number][] = [
    [168, 245, 76, 0.50],
    [255, 220, 62, 0.42],
    [392, 198, 44, 0.46],
    [118, 310, 52, 0.36],
    [335, 345, 48, 0.30],
  ];
  for (const [ox, oy, orad, oalpha] of oilSpots) {
    const og = c.createRadialGradient(ox, oy, orad * 0.14, ox, oy, orad);
    og.addColorStop(0, `rgba(18, 16, 18, ${oalpha})`);
    og.addColorStop(0.62, `rgba(30, 24, 20, ${oalpha * 0.62})`);
    og.addColorStop(1, 'rgba(30, 24, 20, 0)');
    c.fillStyle = og;
    c.beginPath();
    c.ellipse(ox, oy, orad * 1.25, orad * 0.85, rand() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }

  // Chisel & turning gouge scars across the bench surface
  for (let sc = 0; sc < 85; sc++) {
    const sx = 24 + rand() * (w - 48);
    const sy = 20 + rand() * (h - 40);
    const slen = 10 + rand() * 44;
    const sang = (rand() - 0.5) * 1.3;
    const ex = sx + Math.cos(sang) * slen;
    const ey = sy + Math.sin(sang) * slen;
    c.strokeStyle = rand() > 0.35 ? 'rgba(26, 17, 11, 0.48)' : 'rgba(176, 134, 92, 0.32)';
    c.lineWidth = 0.9 + rand() * 1.6;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(ex, ey);
    c.stroke();

    b.strokeStyle = '#363636';
    b.lineWidth = 1.4;
    b.beginPath();
    b.moveTo(sx, sy);
    b.lineTo(ex, ey);
    b.stroke();
  }

  // Scattered fine wood sawdust specks & metallic iron filing flecks
  for (let d = 0; d < 260; d++) {
    const dx = rand() * w;
    const dy = rand() * h;
    const isIron = rand() < 0.34;
    c.fillStyle = isIron
      ? `rgba(138, 146, 162, ${0.35 + rand() * 0.35})`
      : `rgba(218, 178, 126, ${0.28 + rand() * 0.34})`;
    c.fillRect(dx, dy, 1.4 + rand() * 2.4, 1.0 + rand() * 1.8);
  }

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

function createRustyCastIronTexture(baseHex: string, rustStrength = 0.55): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const c = colCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const b = bumpCanvas.getContext('2d')!;

  let s = 445199 + Math.round(rustStrength * 1000);
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };

  c.fillStyle = baseHex;
  c.fillRect(0, 0, size, size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);

  // Cast-iron sand-grain pitting
  for (let i = 0; i < 1600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 0.8 + rand() * 2.2;
    const dark = rand() > 0.45;
    c.fillStyle = dark ? 'rgba(14, 15, 20, 0.22)' : 'rgba(130, 136, 148, 0.14)';
    c.fillRect(x, y, r, r);
    b.fillStyle = dark ? 'rgba(46, 46, 46, 0.42)' : 'rgba(196, 196, 196, 0.34)';
    b.fillRect(x, y, r, r);
  }

  // Oxidized rust patches & chipped paint edges
  const patchCount = Math.round(28 + rustStrength * 34);
  for (let p = 0; p < patchCount; p++) {
    const rx = rand() * size;
    const ry = rand() * size;
    const rad = 8 + rand() * 26;
    const rg = c.createRadialGradient(rx, ry, 1, rx, ry, rad);
    const warmRust = rand() > 0.4 ? '138, 66, 36' : '98, 46, 26';
    rg.addColorStop(0, `rgba(${warmRust}, ${0.38 + rustStrength * 0.32})`);
    rg.addColorStop(0.65, `rgba(112, 54, 30, ${0.22 + rustStrength * 0.20})`);
    rg.addColorStop(1, 'rgba(90, 44, 24, 0)');
    c.fillStyle = rg;
    c.beginPath();
    c.ellipse(rx, ry, rad * (0.8 + rand() * 0.6), rad * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    c.fill();

    const bg = b.createRadialGradient(rx, ry, 1, rx, ry, rad);
    bg.addColorStop(0, 'rgba(218, 218, 218, 0.32)');
    bg.addColorStop(1, 'rgba(128, 128, 128, 0)');
    b.fillStyle = bg;
    b.beginPath();
    b.arc(rx, ry, rad, 0, Math.PI * 2);
    b.fill();
  }

  // Scratched metallic wear streaks
  for (let w = 0; w < 24; w++) {
    const x1 = rand() * size;
    const y1 = rand() * size;
    const len = 10 + rand() * 34;
    const ang = rand() * Math.PI * 2;
    c.strokeStyle = 'rgba(168, 174, 186, 0.24)';
    c.lineWidth = 1.0;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x1 + Math.cos(ang) * len, y1 + Math.sin(ang) * len);
    c.stroke();
  }

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

function createLatheSketchNotesTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const c = canvas.getContext('2d')!;

  c.clearRect(0, 0, 512, 320);

  // Main oil-stained engineering graph sheet (left-center)
  c.save();
  c.translate(18, 22);
  c.rotate(-0.025);
  c.fillStyle = 'rgba(14, 14, 20, 0.34)';
  c.fillRect(6, 7, 296, 250);
  c.fillStyle = '#ddd4c1';
  c.fillRect(0, 0, 296, 250);

  // Faint blueprint graph grid
  c.strokeStyle = 'rgba(84, 118, 134, 0.22)';
  c.lineWidth = 1;
  for (let gx = 16; gx < 296; gx += 16) {
    c.beginPath();
    c.moveTo(gx, 0);
    c.lineTo(gx, 250);
    c.stroke();
  }
  for (let gy = 16; gy < 250; gy += 16) {
    c.beginPath();
    c.moveTo(0, gy);
    c.lineTo(296, gy);
    c.stroke();
  }

  // Greasy fingerprint smudge on graph paper
  const smudge = c.createRadialGradient(252, 205, 4, 252, 205, 42);
  smudge.addColorStop(0, 'rgba(64, 50, 38, 0.36)');
  smudge.addColorStop(1, 'rgba(64, 50, 38, 0)');
  c.fillStyle = smudge;
  c.fillRect(190, 150, 106, 100);

  // Hand-drawn stepped lathe shaft cross-section & center axis
  c.strokeStyle = '#2d313d';
  c.lineWidth = 2.4;
  c.beginPath();
  // Stepped spindle silhouette
  c.moveTo(42, 92);
  c.lineTo(106, 92);
  c.lineTo(106, 76);
  c.lineTo(186, 76);
  c.lineTo(212, 88);
  c.lineTo(256, 88);
  c.lineTo(256, 142);
  c.lineTo(212, 142);
  c.lineTo(186, 154);
  c.lineTo(106, 154);
  c.lineTo(106, 138);
  c.lineTo(42, 138);
  c.closePath();
  c.stroke();

  // Centerline dash-dot
  c.strokeStyle = '#9e3838';
  c.lineWidth = 1.4;
  c.setLineDash([12, 4, 3, 4]);
  c.beginPath();
  c.moveTo(24, 115);
  c.lineTo(274, 115);
  c.stroke();
  c.setLineDash([]);

  // Dimension arrows & handwritten callouts
  c.strokeStyle = '#384666';
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(42, 54);
  c.lineTo(256, 54);
  c.moveTo(42, 48);
  c.lineTo(42, 88);
  c.moveTo(256, 48);
  c.lineTo(256, 84);
  c.stroke();

  c.fillStyle = '#252b3b';
  c.font = 'bold 16px monospace';
  c.fillText('L = 128.0 mm', 102, 47);
  c.fillText('Ø24.0 ±0.05', 110, 178);
  c.fillStyle = '#8b2630';
  c.font = 'bold 15px monospace';
  c.fillText('M10x1.25  680 RPM', 34, 212);
  c.fillStyle = '#3a3c48';
  c.font = '13px monospace';
  c.fillText('进刀: 0.2mm / 涂机油', 34, 234);

  // Masking tape corners
  c.fillStyle = 'rgba(218, 198, 142, 0.88)';
  c.fillRect(-10, 6, 42, 14);
  c.fillRect(262, 4, 42, 14);
  c.restore();

  // Yellow handwritten sticky note (top right)
  c.save();
  c.translate(342, 26);
  c.rotate(0.065);
  c.fillStyle = 'rgba(14, 14, 20, 0.30)';
  c.fillRect(5, 6, 132, 118);
  c.fillStyle = '#e7cf72';
  c.fillRect(0, 0, 132, 118);
  c.fillStyle = '#ccb254';
  c.fillRect(0, 0, 132, 16);
  c.fillStyle = '#2d261c';
  c.font = 'bold 16px sans-serif';
  c.fillText('注意!', 14, 40);
  c.font = '14px sans-serif';
  c.fillText('皮带略打滑', 14, 64);
  c.fillText('尾座记得锁死', 14, 86);
  c.fillText('→ 主轴滴油', 14, 106);
  c.restore();

  // Faded rose-tan reminder note (bottom right)
  c.save();
  c.translate(352, 168);
  c.rotate(-0.08);
  c.fillStyle = 'rgba(14, 14, 20, 0.30)';
  c.fillRect(5, 6, 124, 108);
  c.fillStyle = '#dfaba4';
  c.fillRect(0, 0, 124, 108);
  c.fillStyle = '#362325';
  c.font = 'bold 14px monospace';
  c.fillText('CHUCK #3', 14, 34);
  c.font = '13px monospace';
  c.fillText('1:3.2 PULLEY', 14, 58);
  c.fillText('R = 12.0', 14, 78);
  c.fillText('DON\'T FORGET', 14, 96);
  // Masking tape tab on top
  c.fillStyle = 'rgba(218, 198, 142, 0.85)';
  c.fillRect(36, -7, 50, 14);
  c.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const _instPos = new THREE.Vector3();
const _instEuler = new THREE.Euler();
const _instQuat = new THREE.Quaternion();
const _instScale = new THREE.Vector3(1, 1, 1);
const _instMat = new THREE.Matrix4();

function setInstanceTransform(
  instMesh: THREE.InstancedMesh,
  index: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1
): void {
  _instPos.set(x, y, z);
  _instEuler.set(rx, ry, rz);
  _instQuat.setFromEuler(_instEuler);
  _instScale.set(sx, sy, sz);
  _instMat.compose(_instPos, _instQuat, _instScale);
  instMesh.setMatrixAt(index, _instMat);
}

function finalizeInstancedMesh(instMesh: THREE.InstancedMesh): void {
  instMesh.instanceMatrix.needsUpdate = true;
  if (instMesh.instanceColor) {
    instMesh.instanceColor.needsUpdate = true;
  }
  instMesh.computeBoundingSphere();
}

export function buildBasement(ctx: RoomBuildContext, playDoorAudio: (open: boolean) => void): void {
  const {
    scene,
    sceneManager,
    textures,
    outlines,
    mat,
    addBoxCollider,
    registerInteractable,
    registerDoor,
    registerCeilingLamp,
    registerAmbientProp,
    metaState,
  } = ctx;

  const group = new THREE.Group();
  group.name = 'BasementStorage';
  scene.add(group);
  sceneManager.registerRoomGroup('basement', group);

  const woodStepMat = mat({ color: 0x8f6255, roughness: 0.60, metalness: 0.04, woodLacquer: 0.34 });
  const riserMat = mat({ color: 0x69453c, roughness: 0.72, metalness: 0.04 });
  const doorMat = mat({
    map: textures.furnitureOak,
    bumpMap: textures.furnitureWoodBump,
    bumpScale: 0.004,
    color: 0xfff6e6,
    roughness: 0.58,
    metalness: 0.0,
    woodLacquer: 0.52,
  });
  const ironMat = mat({
    map: textures.roughMetal,
    bumpMap: textures.roughMetalBump,
    bumpScale: 0.024,
    roughnessMap: textures.roughMetalRoughness,
    color: 0x3b3a48,
    roughness: 0.74,
    metalness: 0.78,
  });
  const rackSteelMat = mat({
    map: textures.roughMetal,
    bumpMap: textures.roughMetalBump,
    bumpScale: 0.026,
    roughnessMap: textures.roughMetalRoughness,
    color: 0x525262,
    roughness: 0.72,
    metalness: 0.74,
  });
  const cardboardMat = mat({ color: 0xb58d6b, roughness: 0.85, metalness: 0.0 });
  const tapeMat = mat({ color: 0xd9bf9c, roughness: 0.65, metalness: 0.05 });
  const crateMat = mat({ color: 0x4b5d73, roughness: 0.68, metalness: 0.18 });
  const crateLidMat = mat({ color: 0x374557, roughness: 0.6, metalness: 0.2 });
  const pipeMat = mat({
    map: textures.roughMetal,
    bumpMap: textures.roughMetalBump,
    bumpScale: 0.026,
    roughnessMap: textures.roughMetalRoughness,
    color: 0x585463,
    roughness: 0.72,
    metalness: 0.76,
  });
  const redValveMat = mat({ color: 0xc23e4d, roughness: 0.4, metalness: 0.55 });
  const brassMat = mat({ color: 0xc99c58, roughness: 0.3, metalness: 0.85 });

  // =========================================================================
  // 1. BASEMENT DOOR & BULLNOSE DESCENDING STAIRCASE (X = -2.70 -> -6.04, Z = 0.25 .. 2.45)
  // =========================================================================
  registerDoor(
    'door_basement',
    '地下室木门',
    'dining',
    -2.70,
    0,
    0.78,
    1.14,
    2.2,
    'z+',
    -1,
    doorMat,
    ironMat,
    playDoorAudio
  );

  // 16 Bullnose Beveled Stair Treads + Vertical Risers (X = -2.84 .. -6.04, leaving clear landing before West wall)
  const stepCount = 16;
  const stairStartX = -2.84;
  const stairEndX = -6.04;
  const stairSpanX = stairStartX - stairEndX; // 3.20m
  const treadGeo = createBeveledSlab(0.28, 0.042, 1.96, 0.03, 0.012);
  const riserGeo = createBeveledBox(0.03, 0.21, 1.94, 0.006, 2);

  const treadsInst = new THREE.InstancedMesh(treadGeo, woodStepMat, stepCount);
  treadsInst.castShadow = true;
  treadsInst.receiveShadow = true;
  treadsInst.userData.dynamic = true;

  const risersInst = new THREE.InstancedMesh(riserGeo, riserMat, stepCount);
  risersInst.receiveShadow = true;
  risersInst.userData.dynamic = true;

  for (let i = 0; i < stepCount; i++) {
    const t = (i + 0.5) / stepCount;
    const sx = stairStartX - t * stairSpanX;
    const sy = -t * 3.2;

    setInstanceTransform(treadsInst, i, sx, sy - 0.021, 1.35);
    setInstanceTransform(risersInst, i, sx + 0.095, sy - 0.115, 1.35);
  }
  finalizeInstancedMesh(treadsInst);
  finalizeInstancedMesh(risersInst);
  group.add(treadsInst);
  group.add(risersInst);

  // Angled Side Stringer Beams + Tubular Iron Handrail with Wall Brackets
  // Trimmed strictly below Y=-0.02 so stringers never poke through or clip the Dining Room floor!
  const stairAngle = Math.atan2(3.2, stairSpanX);
  const stairMidX = (stairStartX + stairEndX) / 2;
  const stringerLen = Math.hypot(stairSpanX, 3.2) - 0.16;
  for (const sz of [0.36, 2.34]) {
    const stringer = new THREE.Mesh(
      createBeveledBox(stringerLen, 0.21, 0.05, 0.012, 2),
      riserMat
    );
    stringer.position.set(stairMidX - 0.07, -1.78, sz);
    stringer.rotation.z = stairAngle;
    group.add(stringer);
  }

  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, stringerLen - 0.1, 12),
    ironMat
  );
  rail.position.set(stairMidX, -0.78, 2.28);
  rail.rotation.z = stairAngle + Math.PI / 2;
  rail.castShadow = true;
  group.add(rail);

  for (const bt of [0.15, 0.5, 0.85]) {
    const bx = stairStartX - bt * stairSpanX;
    const by = -bt * 3.2 + 0.82;
    const bracket = new THREE.Mesh(
      createBeveledBox(0.04, 0.08, 0.12, 0.008, 2),
      ironMat
    );
    bracket.position.set(bx, by, 2.32);
    group.add(bracket);
  }

  // =========================================================================
  // 2. CONCRETE CEILING BEAMS, WIRE-CAGE EXPLOSION-PROOF PENDANT LAMPS,
  //    DETAILED PIPING/VALVES & CRAWL-SIZE VENTILATION DUCT + EXHAUST FAN
  // =========================================================================
  const beamConcreteMat = mat({
    map: textures.concrete,
    bumpMap: textures.concreteBump,
    bumpScale: 0.022,
    roughnessMap: textures.concreteRoughness,
    color: 0x9a96a3,
    roughness: 0.94,
    metalness: 0.02,
  });
  const galvDuctMat = mat({
    map: textures.roughMetal,
    bumpMap: textures.roughMetalBump,
    bumpScale: 0.028,
    roughnessMap: textures.roughMetalRoughness,
    color: 0x525864,
    roughness: 0.78,
    metalness: 0.70,
  });
  const galvSeamMat = mat({
    map: textures.roughMetal,
    bumpMap: textures.roughMetalBump,
    bumpScale: 0.030,
    roughnessMap: textures.roughMetalRoughness,
    color: 0x3a3f4a,
    roughness: 0.80,
    metalness: 0.76,
  });
  const ductInteriorMat = mat({ color: 0x101218, roughness: 0.95, metalness: 0.15 });
  const copperLineMat = mat({ color: 0xb86e42, roughness: 0.32, metalness: 0.80 });
  const pendantEnamelMat = mat({ color: 0x26323a, roughness: 0.36, metalness: 0.62 });
  const pendantGuardMat = mat({ color: 0x707784, roughness: 0.52, metalness: 0.82 });

  // 2A. Transverse Cast-In-Place Concrete Load-Bearing Ceiling Beams + Wall Corbels
  // Ceiling underside is Y = -0.45; beams drop 0.32m to Y = -0.77.
  // First beam at X = -7.30 terminates cleanly against the North crawl-size duct soffit (Z = -5.20).
  const beamSpecs: [number, number, number][] = [
    [-7.30, -5.20, 0.25],
    [-4.40, -6.01, 0.14],
    [-1.50, -6.01, 0.14],
    [1.40, -6.01, 0.14],
  ];
  for (const [bx, zStart, zEnd] of beamSpecs) {
    const bLen = zEnd - zStart;
    const bCenterZ = (zStart + zEnd) * 0.5;
    const beam = new THREE.Mesh(
      createBeveledBox(0.30, 0.32, bLen, 0.012, 2),
      beamConcreteMat
    );
    beam.position.set(bx, -0.61, bCenterZ);
    beam.castShadow = true;
    beam.receiveShadow = true;
    outlines.addOutline(beam, 1.012);
    group.add(beam);

    // Tapered structural concrete corbel haunches where beams bear on walls
    for (const endZ of [zStart + 0.14, zEnd - 0.14]) {
      const corbel = new THREE.Mesh(
        createBeveledBox(0.34, 0.16, 0.28, 0.01, 2),
        beamConcreteMat
      );
      corbel.position.set(bx, -0.83, endZ);
      group.add(corbel);
    }
  }
  // Longitudinal stairwell header beam framing the opening (X = -9.24 .. -5.32, Z = +0.25)
  const stairHeaderBeam = new THREE.Mesh(
    createBeveledBox(3.96, 0.34, 0.28, 0.012, 2),
    beamConcreteMat
  );
  stairHeaderBeam.position.set(-7.28, -0.62, 0.25);
  stairHeaderBeam.castShadow = true;
  stairHeaderBeam.receiveShadow = true;
  group.add(stairHeaderBeam);

  // 2B. Flush-Mounted Plastic-Shell Central Ceiling Light (塑料壳平面吸顶灯)
  const buildPlasticShellCeilingLamp = (
    id: string,
    lx: number,
    lz: number,
    lightColorHex: number,
    baseIntensity: number,
    dimColorHex: number,
    proximityRadius: number
  ) => {
    const rig = new THREE.Group();
    rig.position.set(lx, -0.45, lz);
    rig.userData.dynamic = true;

    const plasticShellMat = mat({
      color: 0xe2e4e8,
      roughness: 0.42,
      metalness: 0.04,
    });
    const plasticTrimMat = mat({
      color: 0xc2c6ce,
      roughness: 0.48,
      metalness: 0.06,
    });
    const plasticGrooveMat = mat({
      color: 0x9fa5af,
      roughness: 0.52,
      metalness: 0.08,
    });

    // Outer molded white/light-grey ABS plastic housing flush to the basement ceiling
    const outerHousing = new THREE.Mesh(
      createBeveledSlab(0.76, 0.056, 0.76, 0.058, 0.012),
      plasticShellMat
    );
    outerHousing.position.y = -0.028;
    outlines.addOutline(outerHousing, 1.016);
    rig.add(outerHousing);

    // Subtle stepped plastic inner collar & shadow groove framing the flat diffuser
    const innerRimFrame = new THREE.Mesh(
      createBeveledSlab(0.69, 0.014, 0.69, 0.048, 0.005),
      plasticGrooveMat
    );
    innerRimFrame.position.y = -0.054;
    rig.add(innerRimFrame);

    // Flush milky-white frosted acrylic/plastic diffuser panel (dynamic so blackout/flicker dims it)
    const diffuserMat = new THREE.MeshBasicMaterial({
      color: 0xfff5e0,
    });
    const diffuserPanel = new THREE.Mesh(
      createBeveledSlab(0.65, 0.014, 0.65, 0.042, 0.004),
      diffuserMat
    );
    diffuserPanel.position.y = -0.059;
    diffuserPanel.userData.dynamic = true;
    rig.add(diffuserPanel);

    // Subtle inner luminous center sheen strip for soft realistic LED glow
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfffaf0,
      transparent: true,
      opacity: 0.65,
    });
    const coreGlow = new THREE.Mesh(
      createBeveledSlab(0.46, 0.006, 0.46, 0.032, 0.002),
      coreMat
    );
    coreGlow.position.y = -0.064;
    coreGlow.userData.dynamic = true;
    rig.add(coreGlow);

    // Four molded corner plastic retainer clips on the housing lip
    for (const cx of [-0.33, 0.33]) {
      for (const cz of [-0.33, 0.33]) {
        const clip = new THREE.Mesh(
          createBeveledBox(0.032, 0.010, 0.032, 0.003, 1),
          plasticTrimMat
        );
        clip.position.set(cx, -0.056, cz);
        rig.add(clip);
      }
    }

    const ptLight = new THREE.PointLight(lightColorHex, baseIntensity, 16.5, 1.32);
    ptLight.position.set(0, -0.22, 0);
    rig.add(ptLight);
    group.add(rig);

    return registerCeilingLamp({
      id,
      room: 'basement',
      position: new THREE.Vector3(lx, -0.67, lz),
      light: ptLight,
      bulbMaterials: [diffuserMat, coreMat],
      baseIntensity,
      dimColorHex,
      proximityRadius,
    });
  };

  // Single central flush plastic-shell ceiling light
  const basementLampRig = buildPlasticShellCeilingLamp(
    'lamp_basement',
    -2.45,
    -2.95,
    0xf5f1e4,
    3.35,
    0x334840,
    5.6
  );
  basementLampRig.light.distance = 16.5;
  const extraBasementLampRigs: typeof basementLampRig[] = [];

  // 2C. Detailed Wall Water Pipes, Bolted Flanges, U-Hangers, Red Handwheel Valve & Brass Pressure Gauge
  // Main steel water trunk along upper North wall (Y = -0.86, Z = -5.88, X = -4.55 .. +2.86, clear of crawl duct)
  // plus secondary parallel copper return pipe (Y = -0.98, Z = -5.89) and staircase-side overhead pipe (Z = -0.26)
  const flangeRingGeo = new THREE.CylinderGeometry(0.088, 0.088, 0.036, 14);
  flangeRingGeo.rotateZ(Math.PI / 2);
  const flangesInst = new THREE.InstancedMesh(flangeRingGeo, ironMat, 10);
  flangesInst.userData.dynamic = true;
  let flangeIdx = 0;

  // North wall horizontal steel main trunk + copper return line
  const northMainPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 7.45, 14),
    pipeMat
  );
  northMainPipe.rotation.z = Math.PI / 2;
  northMainPipe.position.set(-0.84, -0.86, -5.88);
  northMainPipe.castShadow = true;
  group.add(northMainPipe);

  const northCopperPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 7.45, 12),
    copperLineMat
  );
  northCopperPipe.rotation.z = Math.PI / 2;
  northCopperPipe.position.set(-0.84, -0.99, -5.89);
  group.add(northCopperPipe);

  for (const fx of [-4.20, -2.55, -0.90, 0.75, 2.25]) {
    setInstanceTransform(flangesInst, flangeIdx++, fx, -0.86, -5.88);
    // Wall standoff pipe clamp bracket anchoring both twin pipes to concrete wall
    const wallClamp = new THREE.Mesh(createBeveledBox(0.042, 0.24, 0.14, 0.005, 1), ironMat);
    wallClamp.position.set(fx + 0.35, -0.92, -5.94);
    group.add(wallClamp);
  }

  // Secondary ceiling water main running beside the staircase wall (Y = -0.85, Z = -0.24, X = -5.20 .. +2.86)
  const southMainPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 8.08, 14),
    pipeMat
  );
  southMainPipe.rotation.z = Math.PI / 2;
  southMainPipe.position.set(-1.17, -0.85, -0.24);
  southMainPipe.castShadow = true;
  group.add(southMainPipe);

  for (const fx of [-4.40, -2.80, -1.50, 0.20, 1.40]) {
    setInstanceTransform(flangesInst, flangeIdx++, fx, -0.85, -0.24);
  }
  finalizeInstancedMesh(flangesInst);
  group.add(flangesInst);

  // Ceiling steel U-bolt hanger brackets suspending the south pipe beneath the concrete beams
  for (const hx of [-4.40, -1.50, 1.40]) {
    const hangerPlate = new THREE.Mesh(createBeveledBox(0.08, 0.14, 0.14, 0.005, 1), ironMat);
    hangerPlate.position.set(hx, -0.81, -0.24);
    group.add(hangerPlate);
  }

  // Vertical Twin Water Pipe Drop on North Wall (X = -3.85, Z = -5.86, cleanly between vent duct & workbench)
  // Positioned directly above the recessed cast-iron floor drain at (-3.85, -3.196, -5.66)!
  const pipeDropX = -3.85;
  const vertMainPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.048, 0.048, 2.34, 14),
    pipeMat
  );
  vertMainPipe.position.set(pipeDropX, -2.02, -5.86);
  vertMainPipe.castShadow = true;
  group.add(vertMainPipe);

  // T-joint collar & bolted flanges on vertical riser
  const teeJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.14, 14), ironMat);
  teeJoint.position.set(pipeDropX, -0.86, -5.86);
  group.add(teeJoint);

  for (const clampY of [-1.25, -2.28, -2.86]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.036, 12), ironMat);
    collar.position.set(pipeDropX, clampY, -5.86);
    group.add(collar);
    const wallLug = new THREE.Mesh(createBeveledBox(0.16, 0.042, 0.12, 0.004, 1), ironMat);
    wallLug.position.set(pipeDropX, clampY, -5.94);
    group.add(wallLug);
  }

  // Detailed Brass Valve Body + 5-Spoke Red Cast-Iron Handwheel Valve (Y = -1.74)
  const valveBonnet = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.16, 14), brassMat);
  valveBonnet.position.set(pipeDropX, -1.74, -5.86);
  group.add(valveBonnet);

  const valveStem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.14, 10), brassMat);
  valveStem.rotation.x = Math.PI * 0.5;
  valveStem.position.set(pipeDropX, -1.74, -5.78);
  group.add(valveStem);

  const valveWheelGroup = new THREE.Group();
  valveWheelGroup.position.set(pipeDropX, -1.74, -5.71);
  const valveRim = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.017, 10, 20), redValveMat);
  outlines.addOutline(valveRim, 1.045);
  valveWheelGroup.add(valveRim);
  const valveHub = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.028, 12), brassMat);
  valveHub.rotation.x = Math.PI * 0.5;
  valveWheelGroup.add(valveHub);
  for (let s = 0; s < 5; s++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.21, 8), redValveMat);
    spoke.rotation.z = (s / 5) * Math.PI;
    valveWheelGroup.add(spoke);
  }
  group.add(valveWheelGroup);

  // Brass Analog Pressure Gauge mounted above valve (Y = -1.44)
  const gaugeStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), brassMat);
  gaugeStem.rotation.x = Math.PI * 0.5;
  gaugeStem.position.set(pipeDropX, -1.44, -5.80);
  group.add(gaugeStem);

  const gaugeCase = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.036, 18), brassMat);
  gaugeCase.rotation.x = Math.PI * 0.5;
  gaugeCase.position.set(pipeDropX, -1.44, -5.74);
  outlines.addOutline(gaugeCase, 1.04);
  group.add(gaugeCase);

  const gaugeDial = new THREE.Mesh(
    new THREE.CircleGeometry(0.056, 16),
    mat({ color: 0xebe6d8, roughness: 0.55, metalness: 0.02 })
  );
  gaugeDial.position.set(pipeDropX, -1.44, -5.720);
  group.add(gaugeDial);

  const gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.044, 0.004), redValveMat);
  gaugeNeedle.position.set(pipeDropX + 0.010, -1.432, -5.716);
  gaugeNeedle.rotation.z = -0.62;
  group.add(gaugeNeedle);

  // Parallel Secondary Copper Return Drop + Quarter-Turn Red Ball Valve Lever (X = -3.60)
  const vertCopperDrop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 2.20, 12),
    copperLineMat
  );
  vertCopperDrop.position.set(pipeDropX + 0.25, -2.09, -5.88);
  group.add(vertCopperDrop);

  const ballValveBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.09, 10), brassMat);
  ballValveBody.position.set(pipeDropX + 0.25, -1.96, -5.88);
  group.add(ballValveBody);

  const leverHandle = new THREE.Mesh(createBeveledBox(0.13, 0.020, 0.014, 0.004, 1), redValveMat);
  leverHandle.position.set(pipeDropX + 0.31, -1.96, -5.82);
  leverHandle.rotation.z = -0.18;
  group.add(leverHandle);

  // Floor base flange & drain spout bending slightly forward above the floor drain
  const floorSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.22, 10), pipeMat);
  floorSpout.rotation.x = Math.PI * 0.42;
  floorSpout.position.set(pipeDropX, -3.02, -5.76);
  group.add(floorSpout);

  // 2D. CRAWL-SIZE GALVANIZED METAL VENTILATION DUCT (0.72m wide x 0.60m tall)
  //     + CONTINUOUSLY SLOWLY ROTATING INDUSTRIAL METAL EXHAUST FAN
  const ductY = -0.78; // Top at -0.48 (3cm below ceiling), bottom at -1.08 (well above breaker & player head!)
  const ductW = 0.72;
  const ductH = 0.60;

  // North-wall crawl-size trunk duct (X = -9.20 .. -4.60, Z = -5.60)
  const northDuctLen = 4.60;
  const northDuct = new THREE.Mesh(
    createBeveledBox(northDuctLen, ductH, ductW, 0.012, 2),
    galvDuctMat
  );
  northDuct.position.set(-6.90, ductY, -5.60);
  northDuct.castShadow = true;
  northDuct.receiveShadow = true;
  outlines.addOutline(northDuct, 1.012);
  group.add(northDuct);

  // Riveted flanged collar seams & ceiling trapeze suspension rods along North duct
  for (const dx of [-8.20, -7.05, -5.90, -4.78]) {
    const seam = new THREE.Mesh(
      createBeveledBox(0.044, ductH + 0.056, ductW + 0.056, 0.006, 1),
      galvSeamMat
    );
    seam.position.set(dx, ductY, -5.60);
    group.add(seam);

    // Threaded steel hanger rod & underside trapeze bar
    const trapeze = new THREE.Mesh(createBeveledBox(0.036, 0.026, ductW + 0.14, 0.004, 1), ironMat);
    trapeze.position.set(dx, ductY - ductH * 0.5 - 0.018, -5.60);
    group.add(trapeze);
    const hangerRod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.68, 8), ironMat);
    hangerRod.position.set(dx, ductY + 0.02, -5.20);
    group.add(hangerRod);
  }

  // West-wall crawl-size branch duct turning South at NW corner (X = -8.84, Z = -5.96 .. -0.26)
  const westDuctLen = 5.70;
  const westDuct = new THREE.Mesh(
    createBeveledBox(ductW, ductH, westDuctLen, 0.012, 2),
    galvDuctMat
  );
  westDuct.position.set(-8.84, ductY, -3.11);
  westDuct.castShadow = true;
  westDuct.receiveShadow = true;
  outlines.addOutline(westDuct, 1.012);
  group.add(westDuct);

  // Bolted flange collars & trapeze supports along West duct
  for (const dz of [-4.95, -3.75, -2.55, -1.35, -0.34]) {
    const wSeam = new THREE.Mesh(
      createBeveledBox(ductW + 0.056, ductH + 0.056, 0.044, 0.006, 1),
      galvSeamMat
    );
    wSeam.position.set(-8.84, ductY, dz);
    group.add(wSeam);

    const wTrap = new THREE.Mesh(createBeveledBox(ductW + 0.14, 0.026, 0.036, 0.004, 1), ironMat);
    wTrap.position.set(-8.84, ductY - ductH * 0.5 - 0.018, dz);
    group.add(wTrap);
    const wRod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.68, 8), ironMat);
    wRod.position.set(-8.44, ductY + 0.02, dz);
    group.add(wRod);
  }

  // Bolted crawl-access maintenance hatch plate on West duct side (facing +X)
  const crawlHatch = new THREE.Mesh(
    createBeveledBox(0.024, 0.44, 0.56, 0.006, 1),
    galvSeamMat
  );
  crawlHatch.position.set(-8.47, ductY, -1.95);
  group.add(crawlHatch);
  for (const [hy, hz] of [[-0.17, -0.22], [-0.17, 0.22], [0.17, -0.22], [0.17, 0.22]] as const) {
    const hBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.026, 6), brassMat);
    hBolt.rotation.z = Math.PI * 0.5;
    hBolt.position.set(-8.455, ductY + hy, -1.95 + hz);
    group.add(hBolt);
  }

  // Continuously Slowly Rotating Industrial Metal Exhaust Fan Housing (mounted prominently at North duct intake facing +Z)
  const fanHousing = new THREE.Group();
  fanHousing.position.set(-4.96, ductY, -5.20);
  group.add(fanHousing);

  // Heavy bolted square outer intake shroud protruding from the crawl duct
  const shroudDepth = 0.18;
  const shroudOuter = new THREE.Mesh(
    createBeveledBox(0.76, 0.68, shroudDepth, 0.012, 2),
    galvSeamMat
  );
  shroudOuter.position.set(0, 0, shroudDepth * 0.5);
  shroudOuter.castShadow = true;
  outlines.addOutline(shroudOuter, 1.024);
  fanHousing.add(shroudOuter);

  // Deep dark recessed vent shaft cavity behind the metal impeller
  const ventCavity = new THREE.Mesh(new THREE.CircleGeometry(0.285, 24), ductInteriorMat);
  ventCavity.position.set(0, 0, shroudDepth + 0.002);
  fanHousing.add(ventCavity);

  // Rolled circular galvanized steel venturi intake ring
  const venturiRing = new THREE.Mesh(new THREE.TorusGeometry(0.292, 0.024, 10, 28), galvDuctMat);
  venturiRing.position.set(0, 0, shroudDepth + 0.014);
  fanHousing.add(venturiRing);

  // 4 Corner mounting hex bolts on shroud face
  for (const bx of [-0.32, 0.32]) {
    for (const by of [-0.28, 0.28]) {
      const sBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.024, 6), brassMat);
      sBolt.rotation.x = Math.PI * 0.5;
      sBolt.position.set(bx, by, shroudDepth + 0.008);
      fanHousing.add(sBolt);
    }
  }

  // Rear motor mounting spider struts
  for (let st = 0; st < 4; st++) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.016, 0.012), ironMat);
    strut.position.set(0, 0, shroudDepth + 0.010);
    strut.rotation.z = (st / 4) * Math.PI;
    fanHousing.add(strut);
  }

  // Continuously Slowly Rotating 6-Blade Galvanized Metal Impeller Rotor (dynamic!)
  const exhaustFanRotor = new THREE.Group();
  exhaustFanRotor.position.set(0, 0, shroudDepth + 0.024);
  exhaustFanRotor.userData.dynamic = true;
  fanHousing.add(exhaustFanRotor);
  metaState.basementLab.exhaustFanRotors.push(exhaustFanRotor);

  const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.074, 0.044, 16), ironMat);
  rotorHub.rotation.x = Math.PI * 0.5;
  rotorHub.userData.dynamic = true;
  exhaustFanRotor.add(rotorHub);

  const rotorNut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.054, 6), brassMat);
  rotorNut.rotation.x = Math.PI * 0.5;
  rotorNut.userData.dynamic = true;
  exhaustFanRotor.add(rotorNut);

  const exhaustBladeGeo = createBeveledBox(0.205, 0.092, 0.008, 0.002, 1);
  for (let b = 0; b < 6; b++) {
    const bPivot = new THREE.Group();
    bPivot.rotation.z = (b / 6) * Math.PI * 2;
    bPivot.userData.dynamic = true;
    const blade = new THREE.Mesh(exhaustBladeGeo, galvDuctMat);
    blade.position.set(0.158, 0, 0);
    blade.rotation.x = 0.44;
    blade.userData.dynamic = true;
    bPivot.add(blade);
    exhaustFanRotor.add(bPivot);
  }

  // Protective Front Concentric Wire Safety Grille
  for (const gr of [0.10, 0.19, 0.275]) {
    const gRing = new THREE.Mesh(new THREE.TorusGeometry(gr, 0.0042, 6, 24), pendantGuardMat);
    gRing.position.set(0, 0, shroudDepth + 0.056);
    fanHousing.add(gRing);
  }
  for (let s = 0; s < 4; s++) {
    const gBar = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.57, 6), pendantGuardMat);
    gBar.position.set(0, 0, shroudDepth + 0.056);
    gBar.rotation.z = (s / 4) * Math.PI;
    fanHousing.add(gBar);
  }

  // =========================================================================
  // 3. HIGH-DETAIL INDUSTRIAL METAL STORAGE RACKS (SLOTS, RIBS, X-BRACING & PROPS)
  // =========================================================================
  const rackDarkIronMat = mat({
    map: textures.roughMetal,
    bumpMap: textures.roughMetalBump,
    bumpScale: 0.026,
    roughnessMap: textures.roughMetalRoughness,
    color: 0x2f2f3c,
    roughness: 0.78,
    metalness: 0.78,
  });
  const rackSlotMat = mat({ color: 0x16151d, roughness: 0.85, metalness: 0.22 });
  const toolRedMat = mat({ color: 0xa62f3b, roughness: 0.38, metalness: 0.46 });
  const labelPaperMat = mat({ color: 0xd8d0c2, roughness: 0.78, metalness: 0.02 });
  const jarGlassMat = mat({
    color: 0x6ba6c4,
    roughness: 0.16,
    metalness: 0.14,
    transparent: true,
    opacity: 0.56,
  });
  const hazardYellowMat = mat({ color: 0xd9a23b, roughness: 0.52, metalness: 0.16 });
  const reelDarkMat = mat({ color: 0x232530, roughness: 0.48, metalness: 0.32 });

  const buildStorageRack = (
    rx: number,
    rz: number,
    rotY: number,
    colId: string,
    rackVariant: 0 | 1 | 2
  ) => {
    const rack = new THREE.Group();
    rack.position.set(rx, -3.2, rz);
    rack.rotation.y = rotY;

    const rackW = 1.78;
    const rackD = 0.58;
    const rackH = 2.20;
    const halfW = rackW * 0.5 - 0.03;
    const halfD = rackD * 0.5 - 0.025;

    // 1. Slotted L-Profile Angle-Iron Uprights + Bolted Footpads + Instanced Punch Slots
    const flangeXGeo = createBeveledBox(0.048, rackH, 0.011, 0.002, 1);
    const flangeZGeo = createBeveledBox(0.011, rackH, 0.048, 0.002, 1);
    const footPadGeo = createBeveledBox(0.088, 0.016, 0.088, 0.003, 1);

    const slotsPerFace = 16;
    const totalSlots = 4 * 2 * slotsPerFace;
    const slotGeo = new THREE.BoxGeometry(0.014, 0.032, 0.006);
    const slotsInst = new THREE.InstancedMesh(slotGeo, rackSlotMat, totalSlots);
    let slotIdx = 0;

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const px = sx * halfW;
        const pz = sz * halfD;

        // L-angle iron dual flanges
        const fX = new THREE.Mesh(flangeXGeo, rackSteelMat);
        fX.position.set(px - sx * 0.018, rackH * 0.5, pz);
        fX.castShadow = true;
        rack.add(fX);

        const fZ = new THREE.Mesh(flangeZGeo, rackSteelMat);
        fZ.position.set(px, rackH * 0.5, pz - sz * 0.018);
        fZ.castShadow = true;
        rack.add(fZ);

        // Steel leveling footpad anchored flush to floor (y = 0)
        const foot = new THREE.Mesh(footPadGeo, rackDarkIronMat);
        foot.position.set(px - sx * 0.006, 0.008, pz - sz * 0.006);
        rack.add(foot);

        // Perforated mounting slot holes along both outer angle-iron faces
        for (let k = 0; k < slotsPerFace; k++) {
          const sy = 0.14 + k * 0.128;
          // Front/back face slot
          setInstanceTransform(
            slotsInst,
            slotIdx++,
            px - sx * 0.018,
            sy,
            pz + sz * 0.006
          );
          // Side face slot
          setInstanceTransform(
            slotsInst,
            slotIdx++,
            px + sx * 0.006,
            sy,
            pz - sz * 0.018,
            0,
            Math.PI * 0.5,
            0
          );
        }
      }
    }
    finalizeInstancedMesh(slotsInst);
    rack.add(slotsInst);

    // 2. Full Double X-Cross Bracing (Both Side Bays + Twin Rear Bays) with Center Bolts
    const sideSpanZ = halfD * 2 - 0.04;
    const bayH = 0.88;
    const sideDiagLen = Math.hypot(sideSpanZ, bayH);
    const sideDiagAngle = Math.atan2(sideSpanZ, bayH);
    const sideStrapGeo = createBeveledBox(0.010, sideDiagLen, 0.022, 0.002, 1);
    const rivetGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.018, 8);

    for (const sx of [-1, 1]) {
      const bx = sx * (halfW + 0.006);
      for (const bayCenterY of [0.64, 1.54]) {
        for (const dir of [-1, 1]) {
          const strap = new THREE.Mesh(sideStrapGeo, rackDarkIronMat);
          strap.position.set(bx, bayCenterY, 0);
          strap.rotation.x = dir * sideDiagAngle;
          rack.add(strap);
        }
        const centerBolt = new THREE.Mesh(rivetGeo, brassMat);
        centerBolt.rotation.z = Math.PI * 0.5;
        centerBolt.position.set(bx, bayCenterY, 0);
        rack.add(centerBolt);
      }
    }

    // Rear X-bracing straps spanning back bay
    const rearSpanX = halfW * 2 - 0.06;
    const rearBayH = 1.18;
    const rearDiagLen = Math.hypot(rearSpanX, rearBayH);
    const rearDiagAngle = Math.atan2(rearSpanX, rearBayH);
    const rearStrapGeo = createBeveledBox(0.022, rearDiagLen, 0.009, 0.002, 1);
    for (const dir of [-1, 1]) {
      const rStrap = new THREE.Mesh(rearStrapGeo, rackDarkIronMat);
      rStrap.position.set(0, 1.16, -halfD - 0.005);
      rStrap.rotation.z = dir * rearDiagAngle;
      rack.add(rStrap);
    }
    const rearBolt = new THREE.Mesh(rivetGeo, brassMat);
    rearBolt.rotation.x = Math.PI * 0.5;
    rearBolt.position.set(0, 1.16, -halfD - 0.006);
    rack.add(rearBolt);

    // 3. Reinforced Steel Shelves with Folded Lip Aprons, Underside Stiffening Ribs & Gussets
    const shelfTopGeo = createBeveledSlab(rackW, 0.034, rackD, 0.016, 0.007);
    const frontLipGeo = createBeveledBox(rackW - 0.02, 0.044, 0.014, 0.003, 1);
    const longRibGeo = createBeveledBox(rackW - 0.10, 0.028, 0.018, 0.003, 1);
    const crossRibGeo = createBeveledBox(0.022, 0.026, rackD - 0.08, 0.003, 1);
    const gussetGeo = createBeveledBox(0.075, 0.068, 0.016, 0.003, 1);

    for (const sy of [0.22, 0.88, 1.54, 2.12]) {
      const shelf = new THREE.Mesh(shelfTopGeo, rackSteelMat);
      shelf.position.y = sy;
      shelf.receiveShadow = true;
      shelf.castShadow = true;
      outlines.addOutline(shelf, 1.014);
      rack.add(shelf);

      // Folded steel front & back channel lips
      for (const lz of [-1, 1]) {
        const lip = new THREE.Mesh(frontLipGeo, rackDarkIronMat);
        lip.position.set(0, sy - 0.018, lz * (rackD * 0.5 - 0.006));
        rack.add(lip);
      }

      // Underside longitudinal C-channel stiffening ribs
      for (const rzOff of [-0.14, 0, 0.14]) {
        const lRib = new THREE.Mesh(longRibGeo, rackDarkIronMat);
        lRib.position.set(0, sy - 0.028, rzOff);
        rack.add(lRib);
      }
      // Underside transverse stiffening ribs
      for (const rxOff of [-0.52, 0, 0.52]) {
        const cRib = new THREE.Mesh(crossRibGeo, rackDarkIronMat);
        cRib.position.set(rxOff, sy - 0.028, 0);
        rack.add(cRib);
      }

      // Corner riveted gusset brackets
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const gus = new THREE.Mesh(gussetGeo, rackDarkIronMat);
          gus.position.set(sx * (halfW - 0.036), sy - 0.044, sz * (halfD - 0.006));
          rack.add(gus);
        }
      }
    }

    // 4. Diverse, Naturally Arranged Industrial Workshop Clutter
    //    (Plastic parts bins, vintage PC towers, discarded monitors, coiled cables, steel toolboxes)
    //    Carefully preserves open middle-shelf collectible slots on Rack 1 & Rack 3!
    const pcBeigeMat = mat({ color: 0xc9c0ae, roughness: 0.62, metalness: 0.08 });
    const pcDarkMat = mat({ color: 0x2a2d36, roughness: 0.52, metalness: 0.36 });
    const crtGlassOffMat = mat({ color: 0x1e252a, roughness: 0.18, metalness: 0.28 });
    const binBlueMat = mat({ color: 0x2f5e94, roughness: 0.48, metalness: 0.08 });
    const binAmberMat = mat({ color: 0xc4822e, roughness: 0.48, metalness: 0.08 });
    const binTealMat = mat({ color: 0x2f756e, roughness: 0.48, metalness: 0.08 });
    const toolOliveMat = mat({ color: 0x45584a, roughness: 0.44, metalness: 0.48 });
    const orangeWireMat = mat({ color: 0xc95b2c, roughness: 0.58, metalness: 0.10 });

    const addDetailedCrate = (x: number, baseY: number, z: number, w: number, h: number, d: number, rot: number) => {
      const tote = new THREE.Group();
      tote.position.set(x, baseY + h * 0.5, z);
      tote.rotation.y = rot;

      const body = new THREE.Mesh(createBeveledBox(w, h, d, 0.018, 2), crateMat);
      body.castShadow = true;
      body.receiveShadow = true;
      outlines.addOutline(body, 1.024);
      tote.add(body);

      for (const ribX of [-w * 0.28, 0, w * 0.28]) {
        const rib = new THREE.Mesh(createBeveledBox(0.022, h * 0.72, d + 0.012, 0.004, 1), crateLidMat);
        rib.position.set(ribX, -0.01, 0);
        tote.add(rib);
      }
      const lid = new THREE.Mesh(createBeveledSlab(w + 0.032, 0.034, d + 0.032, 0.024, 0.009), crateLidMat);
      lid.position.y = h * 0.5 + 0.012;
      tote.add(lid);

      for (const lx of [-w * 0.32, w * 0.32]) {
        const latch = new THREE.Mesh(createBeveledBox(0.044, 0.056, 0.018, 0.004, 1), hazardYellowMat);
        latch.position.set(lx, h * 0.42, d * 0.5 + 0.008);
        tote.add(latch);
      }
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.006), labelPaperMat);
      tag.position.set(0, 0.02, d * 0.5 + 0.007);
      tote.add(tag);

      rack.add(tote);
    };

    const addPlasticPartsBin = (
      x: number,
      baseY: number,
      z: number,
      w: number,
      h: number,
      d: number,
      binMat: THREE.Material,
      rot: number
    ) => {
      const bin = new THREE.Group();
      bin.position.set(x, baseY, z);
      bin.rotation.y = rot;

      // Open-front hopper style industrial plastic parts organizer bin
      const floor = new THREE.Mesh(createBeveledBox(w, 0.018, d, 0.004, 1), binMat);
      floor.position.y = 0.009;
      bin.add(floor);
      const back = new THREE.Mesh(createBeveledBox(w, h, 0.018, 0.004, 1), binMat);
      back.position.set(0, h * 0.5, -d * 0.5 + 0.009);
      bin.add(back);
      for (const sx of [-1, 1]) {
        const side = new THREE.Mesh(createBeveledBox(0.018, h, d, 0.004, 1), binMat);
        side.position.set(sx * (w * 0.5 - 0.009), h * 0.5, 0);
        side.castShadow = true;
        outlines.addOutline(side, 1.028);
        bin.add(side);
      }
      const frontLip = new THREE.Mesh(createBeveledBox(w, h * 0.54, 0.018, 0.004, 1), binMat);
      frontLip.position.set(0, h * 0.27, d * 0.5 - 0.009);
      bin.add(frontLip);
      // White inventory card on front lip
      const card = new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, h * 0.26, 0.005), labelPaperMat);
      card.position.set(0, h * 0.28, d * 0.5 + 0.002);
      bin.add(card);
      // Assorted spare parts visible inside open bin
      for (let p = 0; p < 3; p++) {
        const part = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 0.055, 8),
          p === 0 ? brassMat : p === 1 ? rackSteelMat : toolRedMat
        );
        part.rotation.set(0.5 + p * 0.4, p * 1.1, 0.6);
        part.position.set((p - 1) * (w * 0.22), 0.042, -0.02 + (p % 2) * 0.04);
        bin.add(part);
      }
      rack.add(bin);
    };

    const addOldPcTower = (
      x: number,
      baseY: number,
      z: number,
      rot: number,
      lyingFlat = false,
      darkCase = false
    ) => {
      const pc = new THREE.Group();
      const caseMat = darkCase ? pcDarkMat : pcBeigeMat;
      const trimMat = darkCase ? rackSteelMat : rackDarkIronMat;

      if (lyingFlat) {
        pc.position.set(x, baseY + 0.105, z);
        pc.rotation.set(0, rot, Math.PI * 0.5);
      } else {
        pc.position.set(x, baseY + 0.225, z);
        pc.rotation.y = rot;
      }

      const chassis = new THREE.Mesh(createBeveledBox(0.20, 0.44, 0.42, 0.012, 2), caseMat);
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      outlines.addOutline(chassis, 1.024);
      pc.add(chassis);

      // Front bezel recessed drive bays (2x 5.25" optical + 3.5" floppy)
      for (const by of [0.14, 0.085]) {
        const drive = new THREE.Mesh(createBeveledBox(0.155, 0.040, 0.012, 0.002, 1), trimMat);
        drive.position.set(0, by, 0.212);
        pc.add(drive);
      }
      const floppy = new THREE.Mesh(createBeveledBox(0.105, 0.016, 0.010, 0.002, 1), rackSlotMat);
      floppy.position.set(0, 0.02, 0.212);
      pc.add(floppy);
      // Lower intake vent louvers & power button
      const ventGrille = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.008), rackSlotMat);
      ventGrille.position.set(0, -0.12, 0.211);
      pc.add(ventGrille);
      const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.012, 10), toolRedMat);
      pwrBtn.rotation.x = Math.PI * 0.5;
      pwrBtn.position.set(0.052, -0.028, 0.214);
      pc.add(pwrBtn);

      rack.add(pc);
    };

    const addOldMonitor = (
      x: number,
      baseY: number,
      z: number,
      rot: number,
      isLcd = false
    ) => {
      const mon = new THREE.Group();
      mon.position.set(x, baseY, z);
      mon.rotation.y = rot;

      if (isLcd) {
        // Discarded dusty 4:3 silver-charcoal LCD monitor
        const base = new THREE.Mesh(createBeveledBox(0.22, 0.018, 0.16, 0.005, 1), pcDarkMat);
        base.position.y = 0.009;
        mon.add(base);
        const neck = new THREE.Mesh(createBeveledBox(0.055, 0.12, 0.032, 0.004, 1), pcDarkMat);
        neck.position.set(0, 0.075, -0.03);
        mon.add(neck);
        const panel = new THREE.Mesh(createBeveledBox(0.38, 0.30, 0.044, 0.008, 2), rackSteelMat);
        panel.position.set(0, 0.23, 0.0);
        panel.rotation.x = -0.06;
        panel.castShadow = true;
        outlines.addOutline(panel, 1.024);
        mon.add(panel);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.245), crtGlassOffMat);
        screen.position.set(0, 0.23, 0.024);
        screen.rotation.x = -0.06;
        mon.add(screen);
      } else {
        // Discarded beige 14-inch CRT monitor with tapered rear cathode tube
        const swivel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.036, 14), pcBeigeMat);
        swivel.position.y = 0.018;
        mon.add(swivel);
        const frontCowl = new THREE.Mesh(createBeveledBox(0.37, 0.33, 0.20, 0.020, 2), pcBeigeMat);
        frontCowl.position.set(0, 0.20, 0.04);
        frontCowl.castShadow = true;
        outlines.addOutline(frontCowl, 1.022);
        mon.add(frontCowl);
        const rearTube = new THREE.Mesh(createBeveledBox(0.25, 0.22, 0.17, 0.022, 2), pcBeigeMat);
        rearTube.position.set(0, 0.19, -0.12);
        mon.add(rearTube);
        const glass = new THREE.Mesh(createBeveledBox(0.30, 0.23, 0.022, 0.008, 2), crtGlassOffMat);
        glass.position.set(0, 0.21, 0.136);
        mon.add(glass);
        const pwrDot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.008), rackDarkIronMat);
        pwrDot.position.set(0.13, 0.062, 0.142);
        mon.add(pwrDot);
      }
      rack.add(mon);
    };

    const addArchiveCarton = (x: number, baseY: number, z: number, w: number, h: number, d: number, rot: number) => {
      const carton = new THREE.Group();
      carton.position.set(x, baseY + h * 0.5, z);
      carton.rotation.y = rot;

      const body = new THREE.Mesh(createBeveledBox(w, h, d, 0.016, 2), cardboardMat);
      body.castShadow = true;
      outlines.addOutline(body, 1.024);
      carton.add(body);

      const tapeTop = new THREE.Mesh(createBeveledBox(w + 0.006, 0.012, 0.058, 0.002, 1), tapeMat);
      tapeTop.position.y = h * 0.5 + 0.002;
      carton.add(tapeTop);

      const tapeFront = new THREE.Mesh(createBeveledBox(0.058, 0.11, 0.008, 0.002, 1), tapeMat);
      tapeFront.position.set(0, h * 0.5 - 0.048, d * 0.5 + 0.003);
      carton.add(tapeFront);

      const manifest = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.085, 0.005), labelPaperMat);
      manifest.position.set(w * 0.24, -0.02, d * 0.5 + 0.004);
      manifest.rotation.z = -0.04;
      carton.add(manifest);

      rack.add(carton);
    };

    const addMechanicToolbox = (x: number, baseY: number, z: number, rot: number, olive = false) => {
      const tb = new THREE.Group();
      tb.position.set(x, baseY, z);
      tb.rotation.y = rot;
      const bodyMat = olive ? toolOliveMat : toolRedMat;
      const base = new THREE.Mesh(createBeveledBox(0.46, 0.17, 0.24, 0.014, 2), bodyMat);
      base.position.y = 0.085;
      base.castShadow = true;
      outlines.addOutline(base, 1.03);
      tb.add(base);
      const lid = new THREE.Mesh(createBeveledBox(0.47, 0.055, 0.25, 0.012, 2), bodyMat);
      lid.position.y = 0.19;
      tb.add(lid);
      for (const lx of [-0.14, 0.14]) {
        const clasp = new THREE.Mesh(createBeveledBox(0.032, 0.048, 0.014, 0.003, 1), rackSteelMat);
        clasp.position.set(lx, 0.155, 0.126);
        tb.add(clasp);
      }
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.010, 8, 16, Math.PI), rackDarkIronMat);
      handle.position.set(0, 0.215, 0);
      tb.add(handle);
      rack.add(tb);
    };

    const addFluidCanister = (x: number, baseY: number, z: number, radius: number, height: number, stripe: boolean) => {
      const can = new THREE.Group();
      can.position.set(x, baseY, z);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), rackDarkIronMat);
      body.position.y = height * 0.5;
      body.castShadow = true;
      outlines.addOutline(body, 1.036);
      can.add(body);
      if (stripe) {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(radius + 0.003, radius + 0.003, height * 0.24, 16),
          hazardYellowMat
        );
        band.position.y = height * 0.52;
        can.add(band);
      }
      const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.96, 0.008, 8, 16), rackSteelMat);
      rim.rotation.x = Math.PI * 0.5;
      rim.position.y = height - 0.006;
      can.add(rim);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.026, 10), brassMat);
      cap.position.set(radius * 0.35, height + 0.012, 0);
      can.add(cap);
      rack.add(can);
    };

    const addCableCoilAndReels = (x: number, baseY: number, z: number, orangeAccent = false) => {
      const grp = new THREE.Group();
      grp.position.set(x, baseY, z);
      for (let i = 0; i < 3; i++) {
        const coil = new THREE.Mesh(
          new THREE.TorusGeometry(0.115, 0.024, 10, 20),
          orangeAccent && i === 2 ? orangeWireMat : reelDarkMat
        );
        coil.rotation.x = Math.PI * 0.5;
        coil.position.set((i - 1) * 0.012, 0.024 + i * 0.041, (i % 2) * 0.01);
        grp.add(coil);
      }
      for (let r = 0; r < 2; r++) {
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.026, 18), rackSteelMat);
        reel.position.set(0.27, 0.015 + r * 0.034, 0.02);
        grp.add(reel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.032, 12), toolRedMat);
        hub.position.set(0.27, 0.015 + r * 0.034, 0.02);
        grp.add(hub);
      }
      rack.add(grp);
    };

    // Populate each of the 3 wall-flush racks uniquely & naturally
    if (rackVariant === 0) {
      // RACK 1 (Leftmost along staircase wall) — preserves part_pcie_card slot on middle shelf (x=0.08, z=+0.14)
      // Lower shelf (y = 0.237): Two vintage ATX PC towers + coiled cables
      addOldPcTower(-0.62, 0.237, 0.01, 0.14, false, false);
      addOldPcTower(-0.34, 0.237, -0.02, -0.09, false, true);
      addDetailedCrate(0.34, 0.237, 0.02, 0.50, 0.34, 0.40, -0.08);
      // Middle shelf (y = 0.897): Plastic organizer bins on left, red steel toolbox on right (center OPEN for PCI-E card)
      addPlasticPartsBin(-0.64, 0.897, 0.02, 0.24, 0.18, 0.34, binBlueMat, 0.07);
      addPlasticPartsBin(-0.37, 0.897, -0.01, 0.24, 0.18, 0.34, binAmberMat, -0.05);
      addMechanicToolbox(0.54, 0.897, -0.02, -0.14, false);
      // Upper shelf (y = 1.557): Discarded beige CRT monitor + cable coils + fluid canister
      addOldMonitor(-0.48, 1.557, 0.01, 0.22, false);
      addCableCoilAndReels(0.14, 1.557, -0.02, true);
      addFluidCanister(0.66, 1.557, 0.03, 0.095, 0.27, true);
      // Top deck (y = 2.137): Single worn archive box + spare plastic parts bin
      addArchiveCarton(-0.42, 2.137, 0.0, 0.44, 0.24, 0.36, 0.09);
      addPlasticPartsBin(0.28, 2.137, 0.02, 0.32, 0.19, 0.36, binTealMat, -0.12);
    } else if (rackVariant === 1) {
      // RACK 2 (Center) — Rich electronics graveyard: monitors, PC tower on its side, toolboxes, parts bins
      // Lower shelf (y = 0.237): Heavy industrial tote + discarded CRT monitor angled casually
      addDetailedCrate(-0.48, 0.237, 0.0, 0.52, 0.36, 0.42, 0.06);
      addOldMonitor(0.32, 0.237, 0.02, -0.26, false);
      // Middle shelf (y = 0.897): Olive steel toolbox + coiled cables + specimen coolant jars
      addMechanicToolbox(-0.52, 0.897, 0.02, 0.11, true);
      addCableCoilAndReels(0.06, 0.897, -0.02, true);
      for (const [jx, jz] of [[0.56, -0.06], [0.69, 0.07]] as const) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.16, 12), jarGlassMat);
        jar.position.set(jx, 0.897 + 0.08, jz);
        rack.add(jar);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 12), rackDarkIronMat);
        lid.position.set(jx, 0.897 + 0.17, jz);
        rack.add(lid);
      }
      // Upper shelf (y = 1.557): Row of 3 colored plastic organizer bins + lying PC case
      addPlasticPartsBin(-0.62, 1.557, 0.01, 0.23, 0.17, 0.34, binBlueMat, 0.04);
      addPlasticPartsBin(-0.36, 1.557, 0.02, 0.23, 0.17, 0.34, binTealMat, -0.06);
      addPlasticPartsBin(-0.10, 1.557, 0.0, 0.23, 0.17, 0.34, binAmberMat, 0.08);
      addOldPcTower(0.44, 1.557, 0.0, -0.15, true, true);
      // Top deck (y = 2.137): Dusty 4:3 LCD monitor + cable reels
      addOldMonitor(-0.36, 2.137, 0.0, 0.18, true);
      addCableCoilAndReels(0.28, 2.137, 0.0, false);
    } else {
      // RACK 3 (Rightmost near workbench) — preserves part_photodiode slot on middle shelf (x=-0.05, z=+0.14)
      // Lower shelf (y = 0.237): Lying beige PC tower + fluid canisters + plastic tote
      addOldPcTower(-0.46, 0.237, 0.01, 0.12, true, false);
      addFluidCanister(0.10, 0.237, 0.02, 0.105, 0.31, true);
      addFluidCanister(0.36, 0.237, -0.04, 0.095, 0.27, false);
      addPlasticPartsBin(0.64, 0.237, 0.02, 0.24, 0.20, 0.36, binBlueMat, -0.11);
      // Middle shelf (y = 0.897): Left LCD monitor + right plastic bins (center OPEN for photodiode)
      addOldMonitor(-0.56, 0.897, -0.01, 0.24, true);
      addPlasticPartsBin(0.46, 0.897, 0.01, 0.24, 0.18, 0.34, binAmberMat, -0.09);
      addPlasticPartsBin(0.71, 0.897, -0.02, 0.22, 0.18, 0.34, binBlueMat, 0.06);
      // Upper shelf (y = 1.557): Red mechanic toolbox + upright dark PC case + archive carton
      addMechanicToolbox(-0.52, 1.557, 0.01, 0.08, false);
      addOldPcTower(0.05, 1.557, -0.02, -0.16, false, true);
      addArchiveCarton(0.52, 1.557, 0.0, 0.42, 0.30, 0.38, 0.07);
      // Top deck (y = 2.137): Coiled orange/black cables + fluid canister
      addCableCoilAndReels(-0.36, 2.137, 0.0, true);
      addDetailedCrate(0.36, 2.137, 0.0, 0.44, 0.24, 0.36, -0.09);
    }

    group.add(rack);

    // Accurate Box3 collider from assembled rack dimensions
    rack.updateMatrixWorld(true);
    const rackBox = new THREE.Box3().setFromObject(rack);
    const rCenter = new THREE.Vector3();
    const rSize = new THREE.Vector3();
    rackBox.getCenter(rCenter);
    rackBox.getSize(rSize);
    addBoxCollider(colId, rCenter.x, rCenter.y, rCenter.z, rSize.x, rSize.y, rSize.z);
    return rack;
  };

  // All three metal storage racks arranged closely side-by-side along the staircase wall (Z = +0.14), facing -Z into the basement
  buildStorageRack(-4.05, -0.19, Math.PI, 'col_base_rack_1', 0);
  buildStorageRack(-2.25, -0.19, Math.PI, 'col_base_rack_2', 1);
  buildStorageRack(-0.45, -0.19, Math.PI, 'col_base_rack_3', 2);

  // =========================================================================
  // 4. DETAILED INDUSTRIAL HIGH-VOLTAGE BREAKER PANEL (West Wall X = -9.16, Y = -1.72, Z = -2.60)
  // =========================================================================
  const breaker = new THREE.Group();
  breaker.position.set(-9.16, -1.72, -2.60);

  // Heavy NEMA-grade cast steel cabinet body + 4 wall mounting lugs
  const bBox = new THREE.Mesh(
    createBeveledBox(0.20, 0.78, 0.56, 0.018, 3),
    ironMat
  );
  bBox.castShadow = true;
  outlines.addOutline(bBox, 1.032);
  breaker.add(bBox);

  for (const ly of [-0.34, 0.34]) {
    for (const lz of [-0.30, 0.30]) {
      const lug = new THREE.Mesh(createBeveledBox(0.022, 0.06, 0.055, 0.004, 1), rackDarkIronMat);
      lug.position.set(-0.088, ly, lz);
      breaker.add(lug);
    }
  }

  // Hinged steel front door + chrome lock T-handle + side piano hinges
  const bDoor = new THREE.Mesh(
    createBeveledBox(0.032, 0.68, 0.48, 0.010, 2),
    rackSteelMat
  );
  bDoor.position.x = 0.098;
  breaker.add(bDoor);

  for (const hy of [-0.22, 0.22]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.075, 8), ironMat);
    hinge.position.set(0.105, hy, -0.242);
    breaker.add(hinge);
  }
  const lockHandle = new THREE.Mesh(createBeveledBox(0.024, 0.09, 0.022, 0.004, 1), brassMat);
  lockHandle.position.set(0.122, -0.02, 0.19);
  breaker.add(lockHandle);

  // High-Voltage 380V Warning Placard mounted on lower front door
  const breakerSignTex = createBreakerWarningTexture();
  const breakerSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.20),
    mat({ map: breakerSignTex, roughness: 0.48, metalness: 0.08 })
  );
  breakerSign.rotation.y = Math.PI * 0.5;
  breakerSign.position.set(0.116, -0.14, -0.02);
  breaker.add(breakerSign);

  // Twin recessed analog voltmeter & ammeter dials + red/amber/green status pilot lamps
  for (const [mz, needleRot] of [[-0.10, 0.35], [0.06, -0.22]] as const) {
    const meterBezel = new THREE.Mesh(createBeveledBox(0.020, 0.11, 0.11, 0.004, 1), rackDarkIronMat);
    meterBezel.position.set(0.114, 0.16, mz);
    breaker.add(meterBezel);
    const meterFace = new THREE.Mesh(new THREE.PlaneGeometry(0.082, 0.082), labelPaperMat);
    meterFace.rotation.y = Math.PI * 0.5;
    meterFace.position.set(0.125, 0.16, mz);
    breaker.add(meterFace);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.056, 0.005), redValveMat);
    needle.position.set(0.128, 0.155, mz);
    needle.rotation.x = needleRot;
    breaker.add(needle);
  }

  for (const [lz, lCol] of [
    [-0.12, 0x4dff9e],
    [-0.04, 0xffb84d],
    [0.04, 0xff3b5c],
  ] as const) {
    const pilotBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.016, 10), ironMat);
    pilotBezel.rotation.z = Math.PI * 0.5;
    pilotBezel.position.set(0.116, 0.275, lz);
    breaker.add(pilotBezel);
    const pilotBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 10, 10),
      new THREE.MeshBasicMaterial({ color: lCol })
    );
    pilotBulb.position.set(0.126, 0.275, lz);
    breaker.add(pilotBulb);
  }

  // Heavy external side knife-switch throw lever with insulated red handle & guard rail
  const switchBox = new THREE.Mesh(createBeveledBox(0.09, 0.14, 0.045, 0.006, 1), rackDarkIronMat);
  switchBox.position.set(0.02, 0.04, 0.295);
  breaker.add(switchBox);

  const throwArm = new THREE.Mesh(
    createBeveledBox(0.026, 0.26, 0.024, 0.006, 2),
    rackSteelMat
  );
  throwArm.position.set(0.065, 0.13, 0.325);
  throwArm.rotation.z = -0.36;
  breaker.add(throwArm);

  const throwGrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.020, 0.095, 10),
    redValveMat
  );
  throwGrip.rotation.x = Math.PI * 0.5;
  throwGrip.position.set(0.112, 0.23, 0.325);
  outlines.addOutline(throwGrip, 1.05);
  breaker.add(throwGrip);

  // Waterproof cable glands + 3 rigid galvanized conduits climbing to ceiling + heavy cable drops to floor
  for (const cz of [-0.14, 0.0, 0.14]) {
    // Upper conduit gland + riser pipe up to ceiling/vent soffit
    const topGland = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.045, 10), brassMat);
    topGland.position.set(-0.02, 0.405, cz);
    breaker.add(topGland);
    const upConduit = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.64, 10), pipeMat);
    upConduit.position.set(-0.02, 0.72, cz);
    breaker.add(upConduit);

    // Lower gland + protective steel raceway channel down toward floor cabling
    const botGland = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.045, 10), brassMat);
    botGland.position.set(-0.02, -0.405, cz);
    breaker.add(botGland);
    const downConduit = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 1.06, 10), pipeMat);
    downConduit.position.set(-0.02, -0.94, cz);
    breaker.add(downConduit);
  }
  // Wall saddle bar clamping the 3 vertical conduits below breaker box
  const conduitClamp = new THREE.Mesh(createBeveledBox(0.055, 0.045, 0.38, 0.004, 1), ironMat);
  conduitClamp.position.set(-0.03, -0.96, 0);
  breaker.add(conduitClamp);

  group.add(breaker);

  registerInteractable('base_breaker', '高压配电箱', '拉动电闸', 'basement', breaker, () => {
    metaState.basementLightOn = !metaState.basementLightOn;
    metaState.basementBlackout = !metaState.basementLightOn;
    basementLampRig.userEnabled = metaState.basementLightOn;
    for (const r of extraBasementLampRigs) {
      r.userEnabled = metaState.basementLightOn;
    }
    return {
      title: '地下室总配电箱',
      message: metaState.basementLightOn
        ? '合上红色闸刀，头顶与楼梯间的照明灯组全部恢复明亮通电。'
        : '拉下电闸，地下室与楼梯间照明瞬间熄灭，只剩下角落里的老式 CRT 显示器幽幽亮着。',
    };
  });

  // =========================================================================
  // 5. MISIDE-INSPIRED HEAVY EXPERIMENTAL TERMINAL & REALITY CHARACTER GENERATOR
  //    Centered in Basement Core Zone: X = 1.18, Y = -3.20, Z = -5.06 (facing +Z)
  // =========================================================================
  const labRig = new THREE.Group();
  labRig.name = 'BasementExperimentalTerminal';
  labRig.position.set(1.18, -3.2, -5.06);

  // Basement-adapted industrial Toon materials (weathered crimson, brushed steel, muted cobalt trim)
  const stainlessTopMat = mat({ color: 0x7e8896, roughness: 0.32, metalness: 0.72 });
  const stainlessFrameMat = mat({ color: 0x5c6472, roughness: 0.38, metalness: 0.74 });
  const bumperBlueMat = mat({ color: 0x35649c, roughness: 0.52, metalness: 0.16 });
  const bumperBlueDarkMat = mat({ color: 0x264872, roughness: 0.58, metalness: 0.18 });
  const labCrimsonMat = mat({ color: 0xa62d39, roughness: 0.38, metalness: 0.34 });
  const labCrimsonDarkMat = mat({ color: 0x76202a, roughness: 0.46, metalness: 0.38 });
  const consoleCharcoalMat = mat({ color: 0x242632, roughness: 0.46, metalness: 0.44 });
  const brushedAlumMat = mat({ color: 0xa9b3c2, roughness: 0.24, metalness: 0.84 });
  const fanWhiteMat = mat({ color: 0xdce2ea, roughness: 0.36, metalness: 0.12 });
  const keycapMat = mat({ color: 0x8d95a6, roughness: 0.56, metalness: 0.08 });
  const copperPipeMat = mat({ color: 0xba7044, roughness: 0.30, metalness: 0.82 });
  const acrylicGlassMat = mat({
    color: 0xa8d8e8,
    roughness: 0.12,
    metalness: 0.12,
    transparent: true,
    opacity: 0.26,
  });
  acrylicGlassMat.depthWrite = false;
  const coolantGlassMat = mat({
    color: 0x90d6f8,
    roughness: 0.10,
    metalness: 0.15,
    transparent: true,
    opacity: 0.34,
  });
  coolantGlassMat.depthWrite = false;
  const coolantLiquidMat = new THREE.MeshStandardMaterial({
    color: 0x1ea6f5,
    emissive: 0x1688e0,
    emissiveIntensity: 0.82,
    roughness: 0.16,
    metalness: 0.08,
    transparent: true,
    opacity: 0.76,
  });
  const ledGreenMat = new THREE.MeshBasicMaterial({ color: 0x4dff9e });
  const ledAmberMat = new THREE.MeshBasicMaterial({ color: 0xffb84d });
  const ledCrimsonMat = new THREE.MeshBasicMaterial({ color: 0xff4568 });
  const ledCyanMat = new THREE.MeshBasicMaterial({ color: 0x5cf2ff });
  metaState.basementLab.pcbLeds.push(ledGreenMat, ledAmberMat, ledCyanMat);

  // Anti-slip ribbed rubber workshop mat with yellow safety border under & in front of the workbench
  const antiSlipMatTex = createAntiSlipMatTexture();
  const labFloorMat = new THREE.Mesh(
    createBeveledSlab(3.04, 0.016, 1.72, 0.04, 0.005),
    mat({ map: antiSlipMatTex, roughness: 0.90, metalness: 0.04 })
  );
  labFloorMat.position.set(0, 0.008, 0.22);
  labFloorMat.receiveShadow = true;
  labRig.add(labFloorMat);

  // -------------------------------------------------------------------------
  // A. WIDE HEAVY-DUTY INDUSTRIAL REPAIR WORKBENCH (2.88m x 1.00m)
  //    With thick laminated top, steel frame, power strip, 3-drawer cabinet & repair props
  // -------------------------------------------------------------------------
  const benchFrameGroup = new THREE.Group();
  const tableW = 2.88;
  const tableD = 1.00;
  const topY = 0.84;
  const lowerY = 0.24;

  const heavyTimberTopMat = mat({ color: 0x5c4a3e, roughness: 0.68, metalness: 0.06 });
  const deskLampGreenMat = mat({ color: 0x2d4e42, roughness: 0.36, metalness: 0.48 });
  const ceramicMugMat = mat({ color: 0xe6dfd0, roughness: 0.32, metalness: 0.05 });
  const coffeeMat = mat({ color: 0x24150e, roughness: 0.18, metalness: 0.06 });
  const solderStationMat = mat({ color: 0x3b5878, roughness: 0.42, metalness: 0.22 });
  const spongeYellowMat = mat({ color: 0xd9b245, roughness: 0.92, metalness: 0.0 });
  const smallPcbMat = mat({ color: 0x1e6b48, roughness: 0.42, metalness: 0.18 });
  const partsTrayMat = mat({ color: 0x9aa9b8, roughness: 0.32, metalness: 0.12, transparent: true, opacity: 0.78 });

  // Thick reinforced laminated worktop + heavy steel apron & brushed work-pad inset
  const benchTop = new THREE.Mesh(
    createBeveledSlab(tableW, 0.054, tableD, 0.020, 0.009),
    heavyTimberTopMat
  );
  benchTop.position.set(0, topY - 0.027, 0);
  benchTop.castShadow = true;
  benchTop.receiveShadow = true;
  outlines.addOutline(benchTop, 1.011);
  benchFrameGroup.add(benchTop);

  // Brushed stainless steel ESD mat inset across central equipment deck
  const esdTopPlate = new THREE.Mesh(
    createBeveledSlab(2.06, 0.008, 0.86, 0.012, 0.003),
    stainlessTopMat
  );
  esdTopPlate.position.set(0.04, topY + 0.002, -0.02);
  esdTopPlate.receiveShadow = true;
  benchFrameGroup.add(esdTopPlate);

  const benchApron = new THREE.Mesh(
    createBeveledBox(tableW - 0.08, 0.064, tableD - 0.08, 0.006, 1),
    stainlessFrameMat
  );
  benchApron.position.set(0, topY - 0.082, 0);
  benchFrameGroup.add(benchApron);

  // Rear structural steel backsplash rail + multi-outlet industrial power strip
  const backsplash = new THREE.Mesh(
    createBeveledBox(tableW, 0.11, 0.032, 0.006, 1),
    stainlessFrameMat
  );
  backsplash.position.set(0, topY + 0.055, -tableD * 0.5 + 0.016);
  benchFrameGroup.add(backsplash);

  const powerStrip = new THREE.Mesh(
    createBeveledBox(0.54, 0.046, 0.042, 0.005, 1),
    consoleCharcoalMat
  );
  powerStrip.position.set(-1.02, topY + 0.052, -tableD * 0.5 + 0.050);
  benchFrameGroup.add(powerStrip);
  for (let s = 0; s < 5; s++) {
    const outlet = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.024, 0.008), rackSlotMat);
    outlet.position.set(-1.18 + s * 0.072, topY + 0.052, -tableD * 0.5 + 0.073);
    benchFrameGroup.add(outlet);
  }
  const stripSwitch = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.018, 0.012), ledCrimsonMat);
  stripSwitch.position.set(-0.79, topY + 0.052, -tableD * 0.5 + 0.074);
  benchFrameGroup.add(stripSwitch);

  // Heavy Bolted Steel Edge Channel + Blue Anti-Collision Corner Guards
  for (const bz of [-1, 1]) {
    const frontBackRail = new THREE.Mesh(
      createBeveledBox(tableW + 0.038, 0.060, 0.036, 0.010, 2),
      bumperBlueMat
    );
    frontBackRail.position.set(0, topY - 0.028, bz * (tableD * 0.5 + 0.012));
    frontBackRail.castShadow = true;
    outlines.addOutline(frontBackRail, 1.015);
    benchFrameGroup.add(frontBackRail);
  }
  for (const bx of [-1, 1]) {
    const sideRail = new THREE.Mesh(
      createBeveledBox(0.036, 0.060, tableD + 0.038, 0.010, 2),
      bumperBlueMat
    );
    sideRail.position.set(bx * (tableW * 0.5 + 0.012), topY - 0.028, 0);
    sideRail.castShadow = true;
    outlines.addOutline(sideRail, 1.015);
    benchFrameGroup.add(sideRail);
  }
  for (const bx of [-1, 1]) {
    for (const bz of [-1, 1]) {
      const cornerCap = new THREE.Mesh(
        createBeveledBox(0.068, 0.068, 0.068, 0.014, 2),
        bumperBlueDarkMat
      );
      cornerCap.position.set(bx * (tableW * 0.5 + 0.010), topY - 0.028, bz * (tableD * 0.5 + 0.010));
      benchFrameGroup.add(cornerCap);
    }
  }

  // Lower equipment deck + front blue protective edge strip
  const lowerShelf = new THREE.Mesh(
    createBeveledSlab(tableW - 0.12, 0.038, tableD - 0.14, 0.016, 0.008),
    stainlessFrameMat
  );
  lowerShelf.position.set(0, lowerY - 0.019, -0.02);
  lowerShelf.receiveShadow = true;
  lowerShelf.castShadow = true;
  outlines.addOutline(lowerShelf, 1.014);
  benchFrameGroup.add(lowerShelf);

  const lowerBlueTrim = new THREE.Mesh(
    createBeveledBox(tableW - 0.08, 0.042, 0.024, 0.008, 2),
    bumperBlueMat
  );
  lowerBlueTrim.position.set(0, lowerY - 0.019, (tableD - 0.14) * 0.5 - 0.01);
  benchFrameGroup.add(lowerBlueTrim);

  // 4 Heavy Square Tubular Steel Legs + Side Tie Bars + Rubber Leveling Feet
  for (const lx of [-tableW * 0.5 + 0.085, tableW * 0.5 - 0.085]) {
    for (const lz of [-tableD * 0.5 + 0.085, tableD * 0.5 - 0.085]) {
      const leg = new THREE.Mesh(
        createBeveledBox(0.064, topY - 0.05, 0.064, 0.008, 2),
        stainlessFrameMat
      );
      leg.position.set(lx, (topY - 0.05) * 0.5 + 0.02, lz);
      leg.castShadow = true;
      outlines.addOutline(leg, 1.020);
      benchFrameGroup.add(leg);

      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.024, 12), consoleCharcoalMat);
      foot.position.set(lx, 0.012, lz);
      benchFrameGroup.add(foot);
    }
    const sideBar = new THREE.Mesh(
      createBeveledBox(0.036, 0.042, tableD - 0.22, 0.005, 1),
      stainlessFrameMat
    );
    sideBar.position.set(lx, lowerY - 0.02, 0);
    benchFrameGroup.add(sideBar);
  }

  // Left-Outer 3-Drawer Steel Mechanic Under-Bench Cabinet (x = -1.14, cleanly clear of manifold at -0.48)
  const drawerCab = new THREE.Group();
  drawerCab.position.set(-1.14, 0.42, -0.02);
  const cabBody = new THREE.Mesh(createBeveledBox(0.46, 0.64, 0.68, 0.010, 2), labCrimsonDarkMat);
  cabBody.castShadow = true;
  outlines.addOutline(cabBody, 1.02);
  drawerCab.add(cabBody);
  for (let d = 0; d < 3; d++) {
    const dy = 0.20 - d * 0.20;
    const dFace = new THREE.Mesh(createBeveledBox(0.42, 0.17, 0.022, 0.005, 1), labCrimsonMat);
    dFace.position.set(0, dy, 0.344);
    drawerCab.add(dFace);
    const dPull = new THREE.Mesh(createBeveledBox(0.18, 0.018, 0.026, 0.004, 1), brushedAlumMat);
    dPull.position.set(0, dy + 0.032, 0.362);
    drawerCab.add(dPull);
    const dLabel = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.032, 0.005), labelPaperMat);
    dLabel.position.set(0, dy - 0.028, 0.358);
    drawerCab.add(dLabel);
  }
  benchFrameGroup.add(drawerCab);

  // --- TABLETOP REPAIR PROPS (Clear of CRT, Reality Generator & part_oscillator at local -0.04, 0.84, +0.32) ---

  // 1. Folding Articulated Swing-Arm Desk Lamp clamped at back-left (local -1.32, topY, -0.34)
  const deskLamp = new THREE.Group();
  deskLamp.position.set(-1.32, topY, -0.34);
  deskLamp.rotation.y = 0.54;
  const lampClamp = new THREE.Mesh(createBeveledBox(0.075, 0.072, 0.075, 0.006, 1), consoleCharcoalMat);
  lampClamp.position.y = 0.018;
  deskLamp.add(lampClamp);
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.075, 10), rackSteelMat);
  lampPost.position.y = 0.085;
  deskLamp.add(lampPost);
  // Lower twin parallel folding struts
  for (const lz of [-0.015, 0.015]) {
    const lowArm = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.34, 8), rackSteelMat);
    lowArm.position.set(-0.045, 0.245, lz);
    lowArm.rotation.z = 0.28;
    deskLamp.add(lowArm);
  }
  const elbowKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.048, 10), consoleCharcoalMat);
  elbowKnob.rotation.x = Math.PI * 0.5;
  elbowKnob.position.set(-0.095, 0.405, 0);
  deskLamp.add(elbowKnob);
  // Upper forward-reaching swing arm
  for (const lz of [-0.012, 0.012]) {
    const upArm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.36, 8), rackSteelMat);
    upArm.position.set(0.065, 0.495, lz);
    upArm.rotation.z = -1.04;
    deskLamp.add(upArm);
  }
  // Conical industrial green enameled reflector shade + warm task bulb
  const lampHead = new THREE.Group();
  lampHead.position.set(0.24, 0.55, 0);
  lampHead.rotation.z = 0.32;
  const lampCap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.046, 0.068, 14), deskLampGreenMat);
  lampHead.add(lampCap);
  const lampCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.046, 0.118, 0.115, 18, 1, true),
    deskLampGreenMat
  );
  lampCone.position.y = -0.085;
  outlines.addOutline(lampCone, 1.03);
  lampHead.add(lampCone);
  const lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe6a8 })
  );
  lampBulb.position.y = -0.095;
  lampHead.add(lampBulb);
  deskLamp.add(lampHead);
  benchFrameGroup.add(deskLamp);

  // 2. Electric Soldering Station, Iron in Spring Stand, Solder Reel & Damp Sponge (local -1.24, topY, +0.18)
  const solderGroup = new THREE.Group();
  solderGroup.position.set(-1.24, topY, 0.18);
  solderGroup.rotation.y = 0.24;
  const stationBox = new THREE.Mesh(createBeveledBox(0.15, 0.095, 0.17, 0.008, 2), solderStationMat);
  stationBox.position.set(0, 0.048, 0);
  stationBox.castShadow = true;
  outlines.addOutline(stationBox, 1.03);
  solderGroup.add(stationBox);
  const tempDial = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.018, 12), consoleCharcoalMat);
  tempDial.rotation.x = Math.PI * 0.5;
  tempDial.position.set(-0.025, 0.052, 0.088);
  solderGroup.add(tempDial);
  const sPwrLed = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.010), ledCrimsonMat);
  sPwrLed.position.set(0.038, 0.062, 0.088);
  solderGroup.add(sPwrLed);
  // Iron holder base + yellow cleaning sponge + angled electric soldering iron
  const holderBase = new THREE.Mesh(createBeveledBox(0.09, 0.018, 0.13, 0.004, 1), consoleCharcoalMat);
  holderBase.position.set(0.145, 0.009, 0.02);
  solderGroup.add(holderBase);
  const sponge = new THREE.Mesh(createBeveledBox(0.064, 0.014, 0.064, 0.003, 1), spongeYellowMat);
  sponge.position.set(0.145, 0.022, 0.045);
  solderGroup.add(sponge);
  const ironGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.12, 10), bumperBlueMat);
  ironGrip.position.set(0.145, 0.092, -0.025);
  ironGrip.rotation.x = 0.68;
  solderGroup.add(ironGrip);
  const ironShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0055, 0.10, 8), brushedAlumMat);
  ironShaft.position.set(0.145, 0.042, 0.026);
  ironShaft.rotation.x = 0.68;
  solderGroup.add(ironShaft);
  const ironTip = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.022, 8), copperPipeMat);
  ironTip.position.set(0.145, 0.014, 0.058);
  ironTip.rotation.x = 0.68 + Math.PI;
  solderGroup.add(ironTip);
  // Solder wire spool beside station
  const wireSpool = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.048, 12), bumperBlueDarkMat);
  wireSpool.position.set(-0.04, 0.024, 0.14);
  solderGroup.add(wireSpool);
  const solderWrap = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.034, 12), brushedAlumMat);
  solderWrap.position.set(-0.04, 0.024, 0.14);
  solderGroup.add(solderWrap);
  benchFrameGroup.add(solderGroup);

  // 3. Scattered Circuit Boards (PCBs) & Small Hand Tools on Workbench Surface
  const addLoosePcb = (px: number, pz: number, pw: number, pd: number, rot: number) => {
    const pcb = new THREE.Group();
    pcb.position.set(px, topY + 0.005, pz);
    pcb.rotation.y = rot;
    const board = new THREE.Mesh(createBeveledBox(pw, 0.008, pd, 0.002, 1), smallPcbMat);
    pcb.add(board);
    const ic = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.28, 0.010, pd * 0.32), consoleCharcoalMat);
    ic.position.set(-pw * 0.12, 0.008, 0);
    pcb.add(ic);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.018, 8), bumperBlueMat);
    cap.position.set(pw * 0.22, 0.012, -pd * 0.15);
    pcb.add(cap);
    const padStrip = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.45, 0.009, 0.012), brassMat);
    padStrip.position.set(0, 0.001, pd * 0.46);
    pcb.add(padStrip);
    benchFrameGroup.add(pcb);
  };
  addLoosePcb(-0.92, 0.36, 0.16, 0.11, 0.34);
  addLoosePcb(0.28, 0.39, 0.14, 0.095, -0.42);
  addLoosePcb(1.16, -0.26, 0.18, 0.12, 0.19);

  // Loose screwdriver & red-handled wire cutters resting on left-front bench
  const looseHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.009, 0.09, 8), hazardYellowMat);
  looseHandle.rotation.set(0, 0.65, Math.PI * 0.5);
  looseHandle.position.set(-0.74, topY + 0.010, 0.38);
  benchFrameGroup.add(looseHandle);
  const looseBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.11, 6), brushedAlumMat);
  looseBlade.rotation.set(0, 0.65, Math.PI * 0.5);
  looseBlade.position.set(-0.67, topY + 0.010, 0.32);
  benchFrameGroup.add(looseBlade);

  // 4. Open Compartmentalized Plastic Parts Organizer Box (local +1.20, topY, +0.26)
  const partsBox = new THREE.Group();
  partsBox.position.set(1.20, topY, 0.26);
  partsBox.rotation.y = -0.22;
  const pbBase = new THREE.Mesh(createBeveledBox(0.28, 0.044, 0.19, 0.005, 1), partsTrayMat);
  pbBase.position.y = 0.022;
  outlines.addOutline(pbBase, 1.03);
  partsBox.add(pbBase);
  // Internal divider ribs + colorful tiny electronic components
  for (const dx of [-0.07, 0.0, 0.07]) {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.038, 0.178), rackSteelMat);
    div.position.set(dx, 0.024, 0);
    partsBox.add(div);
  }
  const midDiv = new THREE.Mesh(new THREE.BoxGeometry(0.266, 0.038, 0.006), rackSteelMat);
  midDiv.position.set(0, 0.024, 0);
  partsBox.add(midDiv);
  for (const [cx, cz, cMat] of [
    [-0.10, -0.045, brassMat],
    [-0.035, 0.045, labCrimsonMat],
    [0.035, -0.045, bumperBlueMat],
    [0.10, 0.045, hazardYellowMat],
  ] as const) {
    const bit = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.016, 0.038), cMat);
    bit.position.set(cx, 0.020, cz);
    partsBox.add(bit);
  }
  benchFrameGroup.add(partsBox);

  // 5. Enamel Workshop Water / Coffee Mug with D-Handle (local +1.28, topY, -0.02)
  const mugGroup = new THREE.Group();
  mugGroup.position.set(1.28, topY, -0.02);
  mugGroup.rotation.y = -0.65;
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.041, 0.098, 16), ceramicMugMat);
  mugBody.position.y = 0.049;
  mugBody.castShadow = true;
  outlines.addOutline(mugBody, 1.04);
  mugGroup.add(mugBody);
  const mugRim = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.004, 8, 16), bumperBlueDarkMat);
  mugRim.rotation.x = Math.PI * 0.5;
  mugRim.position.y = 0.097;
  mugGroup.add(mugRim);
  const mugCoffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 14), coffeeMat);
  mugCoffee.rotation.x = -Math.PI * 0.5;
  mugCoffee.position.y = 0.086;
  mugGroup.add(mugCoffee);
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 8, 12, Math.PI), ceramicMugMat);
  mugHandle.rotation.z = -Math.PI * 0.5;
  mugHandle.position.set(0.042, 0.052, 0);
  mugGroup.add(mugHandle);
  benchFrameGroup.add(mugGroup);

  labRig.add(benchFrameGroup);

  // 6. Dynamic Ergonomic Workshop Swivel Chair (Matte Graphite Polymer Frame + Breathable Slate Mesh Cushion)
  const { rootGroup: swivelChair, seatGroup: swivelSeat } = createErgonomicSwivelChair(
    ctx.uniforms,
    outlines,
    {
      plasticFrameHex: 0x2a2d35,
      plasticAccentHex: 0x1e2027,
      meshCushionHex: 0x465063,
      meshBaseHex: '#3f4758',
      meshPoreHex: '#191d26',
      meshHighlightHex: 'rgba(182, 198, 224, 0.28)',
      armPadHex: 0x22252d,
      metalHex: 0xa2aab8,
      initialSeatYaw: 0.48,
    }
  );
  swivelChair.name = 'base_swivel_chair';
  swivelChair.position.set(0.84, -3.20, -3.96);
  swivelChair.scale.setScalar(1.2);
  group.add(swivelChair);
  metaState.swivelChairs.push({
    id: 'base_swivel_chair',
    room: 'basement',
    rootGroup: swivelChair,
    seatGroup: swivelSeat,
    floorY: -3.20,
    radius: 0.39,
    bounds: { minX: -5.30, maxX: 2.35, minZ: -5.45, maxZ: 0.35 },
    vx: 0,
    vz: 0,
    spinVel: 0,
    baseSpinVel: 0,
  });

  // Helper to build a spinning 7-blade white cooling fan inside a shroud
  const buildSpinningWhiteFan = (radius: number, bladeCount = 7): THREE.Group => {
    const fanAssembly = new THREE.Group();
    const housing = new THREE.Mesh(
      new THREE.TorusGeometry(radius + 0.008, 0.009, 8, 18),
      consoleCharcoalMat
    );
    fanAssembly.add(housing);

    const rotor = new THREE.Group();
    rotor.userData.dynamic = true;

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, 0.016, 12), fanWhiteMat);
    hub.rotation.x = Math.PI * 0.5;
    rotor.add(hub);

    const bladeGeo = createBeveledBox(radius * 0.68, radius * 0.24, 0.005, 0.0015, 1);
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i / bladeCount) * Math.PI * 2;
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = angle;
      const blade = new THREE.Mesh(bladeGeo, fanWhiteMat);
      blade.position.set(radius * 0.48, 0, 0);
      blade.rotation.x = 0.36;
      bladePivot.add(blade);
      rotor.add(bladePivot);
    }
    fanAssembly.add(rotor);
    metaState.basementLab.fanRotors.push(rotor);
    return fanAssembly;
  };

  // -------------------------------------------------------------------------
  // B. RIGHT SIDE OF BENCH: RETRO RED CRT MONITOR & RED-BLACK CONSOLE HOST
  // -------------------------------------------------------------------------
  const terminalHostGroup = new THREE.Group();
  terminalHostGroup.position.set(0.68, topY, -0.06);
  labRig.add(terminalHostGroup);

  // 1. Red-Black Heavy Console Host Pedestal with Toggle Switches & Status Strip
  const hostBody = new THREE.Mesh(
    createBeveledBox(0.56, 0.22, 0.44, 0.016, 2),
    consoleCharcoalMat
  );
  hostBody.position.set(0.06, 0.11, -0.06);
  hostBody.castShadow = true;
  outlines.addOutline(hostBody, 1.022);
  terminalHostGroup.add(hostBody);

  // Crimson-red side armor cheeks on console host
  for (const sx of [-0.285, 0.285]) {
    const cheek = new THREE.Mesh(
      createBeveledBox(0.028, 0.20, 0.41, 0.008, 2),
      labCrimsonMat
    );
    cheek.position.set(0.06 + sx, 0.11, -0.06);
    terminalHostGroup.add(cheek);
  }

  // Recessed front drive bay & slanted toggle-switch panel
  const switchPanel = new THREE.Mesh(
    createBeveledBox(0.48, 0.088, 0.042, 0.006, 1),
    stainlessFrameMat
  );
  switchPanel.position.set(0.06, 0.075, 0.164);
  switchPanel.rotation.x = -0.18;
  terminalHostGroup.add(switchPanel);

  // 5 Chrome Bat-Handle Toggle Switches + Red Emergency Push Button
  for (let sw = 0; sw < 5; sw++) {
    const swX = -0.12 + sw * 0.056;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.012, 8), brushedAlumMat);
    collar.rotation.x = Math.PI * 0.5 - 0.18;
    collar.position.set(swX, 0.076, 0.186);
    terminalHostGroup.add(collar);

    const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0045, 0.028, 8), brushedAlumMat);
    lever.position.set(swX, 0.080, 0.198);
    lever.rotation.x = sw % 2 === 0 ? 1.15 : 1.92;
    terminalHostGroup.add(lever);
  }
  const bigRedBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.018, 12), labCrimsonMat);
  bigRedBtn.rotation.x = Math.PI * 0.5 - 0.18;
  bigRedBtn.position.set(0.22, 0.078, 0.192);
  terminalHostGroup.add(bigRedBtn);

  // Drive slot + green/amber indicator LEDs
  const driveSlot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.012), rackSlotMat);
  driveSlot.position.set(0.06, 0.165, 0.162);
  terminalHostGroup.add(driveSlot);
  const hostLed1 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), ledGreenMat);
  hostLed1.position.set(0.22, 0.165, 0.166);
  terminalHostGroup.add(hostLed1);
  const hostLed2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), ledAmberMat);
  hostLed2.position.set(0.25, 0.165, 0.166);
  terminalHostGroup.add(hostLed2);

  // 2. Red-Black Triple White-Fan Cooling Blower Unit (left of console host)
  const blowerGroup = new THREE.Group();
  blowerGroup.position.set(-0.40, 0.0, -0.06);
  blowerGroup.rotation.y = 0.08;
  terminalHostGroup.add(blowerGroup);

  const blowerCore = new THREE.Mesh(
    createBeveledBox(0.36, 0.175, 0.24, 0.014, 2),
    consoleCharcoalMat
  );
  blowerCore.position.y = 0.088;
  blowerCore.castShadow = true;
  outlines.addOutline(blowerCore, 1.024);
  blowerGroup.add(blowerCore);

  // Red industrial side cowls & top handle frame
  for (const sx of [-0.185, 0.185]) {
    const cowl = new THREE.Mesh(createBeveledBox(0.032, 0.185, 0.255, 0.010, 2), labCrimsonMat);
    cowl.position.set(sx, 0.092, 0);
    outlines.addOutline(cowl, 1.028);
    blowerGroup.add(cowl);
  }
  const blowerTopCap = new THREE.Mesh(createBeveledBox(0.39, 0.022, 0.25, 0.006, 1), labCrimsonDarkMat);
  blowerTopCap.position.set(0, 0.186, 0);
  blowerGroup.add(blowerTopCap);

  // 3 Spinning White Impeller Fans across front face of blower box
  for (const fx of [-0.105, 0, 0.105]) {
    const fan = buildSpinningWhiteFan(0.044, 7);
    fan.position.set(fx, 0.092, 0.123);
    blowerGroup.add(fan);
  }

  // 3. Retro Red CRT Small Monitor atop Console Host (CanvasTexture waveform + DATA TRANSFERRED)
  const crtUnit = new THREE.Group();
  crtUnit.position.set(0.06, 0.22, -0.06);
  crtUnit.rotation.y = -0.06;
  terminalHostGroup.add(crtUnit);

  const crtBody = new THREE.Mesh(
    createBeveledBox(0.50, 0.38, 0.28, 0.028, 3),
    labCrimsonMat
  );
  crtBody.position.set(0, 0.20, 0.02);
  crtBody.castShadow = true;
  outlines.addOutline(crtBody, 1.022);
  crtUnit.add(crtBody);

  // Rear tapered CRT cathode-ray housing
  const crtBackTube = new THREE.Mesh(
    createBeveledBox(0.34, 0.26, 0.20, 0.030, 2),
    labCrimsonDarkMat
  );
  crtBackTube.position.set(0, 0.19, -0.18);
  crtBackTube.castShadow = true;
  crtUnit.add(crtBackTube);

  // Dark recessed screen surround hood
  const crtBezel = new THREE.Mesh(
    createBeveledBox(0.44, 0.32, 0.048, 0.012, 2),
    consoleCharcoalMat
  );
  crtBezel.position.set(0, 0.20, 0.146);
  crtUnit.add(crtBezel);

  // Tubular steel top carry handle + whip antenna
  const crtHandleTop = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 10), stainlessFrameMat);
  crtHandleTop.rotation.z = Math.PI * 0.5;
  crtHandleTop.position.set(0, 0.435, 0.02);
  crtUnit.add(crtHandleTop);
  for (const hx of [-0.17, 0.17]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.012, 0.055, 8), stainlessFrameMat);
    post.position.set(hx, 0.41, 0.02);
    crtUnit.add(post);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.006, 0.34, 8), brushedAlumMat);
  antenna.position.set(-0.20, 0.52, -0.08);
  antenna.rotation.z = 0.26;
  antenna.rotation.x = -0.12;
  crtUnit.add(antenna);

  // Dynamic CanvasTexture CRT Screen (live oscilloscope waveform + DATA TRANSFERRED)
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = 512;
  crtCanvas.height = 384;
  const crtCtx = crtCanvas.getContext('2d')!;
  drawBasementTerminalCrtCanvas(crtCtx, 512, 384, 0, 0);
  const crtTexture = new THREE.CanvasTexture(crtCanvas);
  crtTexture.colorSpace = THREE.SRGBColorSpace;
  crtTexture.anisotropy = 4;
  crtTexture.needsUpdate = true;

  metaState.basementLab.crtCanvas = crtCanvas;
  metaState.basementLab.crtCtx = crtCtx;
  metaState.basementLab.crtTexture = crtTexture;

  const liveCrtMat = new THREE.MeshStandardMaterial({
    map: crtTexture,
    emissiveMap: crtTexture,
    emissive: new THREE.Color(0xc2fff8),
    emissiveIntensity: 1.05,
    roughness: 0.18,
    metalness: 0.08,
  });
  const liveCrtScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.285), liveCrtMat);
  liveCrtScreen.position.set(0, 0.20, 0.173);
  liveCrtScreen.userData.dynamic = true;
  liveCrtScreen.layers.enable(1);
  liveCrtScreen.userData.interactId = 'base_crt';
  crtUnit.add(liveCrtScreen);

  // Soft cyan-teal CRT screen glow spill onto console & bench
  const crtSpillLight = new THREE.PointLight(0x70f0e4, 0.58, 2.4, 1.5);
  crtSpillLight.position.set(0, 0.22, 0.38);
  crtSpillLight.castShadow = false;
  crtUnit.add(crtSpillLight);

  // 4. Red-Trimmed Mechanical Keyboard & Tilted Status Readout Strip on Front Right
  const kbGroup = new THREE.Group();
  kbGroup.position.set(0.02, 0.018, 0.30);
  kbGroup.rotation.x = 0.11;
  terminalHostGroup.add(kbGroup);

  const kbChassis = new THREE.Mesh(createBeveledBox(0.50, 0.032, 0.19, 0.008, 2), labCrimsonMat);
  outlines.addOutline(kbChassis, 1.028);
  kbGroup.add(kbChassis);
  const kbPlate = new THREE.Mesh(createBeveledBox(0.46, 0.014, 0.155, 0.004, 1), consoleCharcoalMat);
  kbPlate.position.y = 0.016;
  kbGroup.add(kbPlate);
  // Sculpted keycap banks
  for (let row = 0; row < 4; row++) {
    const keyRow = new THREE.Mesh(createBeveledBox(0.42, 0.012, 0.024, 0.003, 1), keycapMat);
    keyRow.position.set(0, 0.026, -0.052 + row * 0.034);
    kbGroup.add(keyRow);
  }
  const redEnterKey = new THREE.Mesh(createBeveledBox(0.048, 0.015, 0.026, 0.003, 1), labCrimsonMat);
  redEnterKey.position.set(0.18, 0.028, 0.016);
  kbGroup.add(redEnterKey);

  // Small angled red telemetry LCD bar next to keyboard
  const miniHud = new THREE.Mesh(createBeveledBox(0.24, 0.082, 0.046, 0.008, 2), labCrimsonMat);
  miniHud.position.set(-0.34, 0.042, 0.24);
  miniHud.rotation.set(-0.42, 0.18, 0);
  outlines.addOutline(miniHud, 1.03);
  terminalHostGroup.add(miniHud);
  const miniHudFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.054),
    new THREE.MeshBasicMaterial({ color: 0x3bd688 })
  );
  miniHudFace.position.set(-0.335, 0.049, 0.264);
  miniHudFace.rotation.set(-0.42, 0.18, 0);
  terminalHostGroup.add(miniHudFace);

  // -------------------------------------------------------------------------
  // C. LOWER DECK: RED COMPUTE PSU CHASSIS (GREEN PCB INSIDE) & COOLANT MANIFOLD
  // -------------------------------------------------------------------------
  const psuGroup = new THREE.Group();
  psuGroup.position.set(0.58, lowerY, 0.04);
  psuGroup.rotation.y = -0.22;
  labRig.add(psuGroup);

  const psuW = 0.54;
  const psuH = 0.44;
  const psuD = 0.42;

  // Heavy crimson-red PSU outer cage (back, top, bottom, right, left frame) with recessed open front bay
  const psuRear = new THREE.Mesh(createBeveledBox(psuW, psuH, 0.05, 0.01, 2), labCrimsonDarkMat);
  psuRear.position.set(0, psuH * 0.5, -psuD * 0.5 + 0.025);
  psuGroup.add(psuRear);
  for (const py of [0.024, psuH - 0.024]) {
    const plate = new THREE.Mesh(createBeveledBox(psuW, 0.048, psuD, 0.010, 2), labCrimsonMat);
    plate.position.set(0, py, 0);
    plate.castShadow = true;
    outlines.addOutline(plate, 1.018);
    psuGroup.add(plate);
  }
  for (const px of [-psuW * 0.5 + 0.024, psuW * 0.5 - 0.024]) {
    const sidePlate = new THREE.Mesh(createBeveledBox(0.048, psuH, psuD, 0.010, 2), labCrimsonMat);
    sidePlate.position.set(px, psuH * 0.5, 0);
    sidePlate.castShadow = true;
    outlines.addOutline(sidePlate, 1.018);
    psuGroup.add(sidePlate);
  }
  // Top protective roll-cage grab rails
  for (const rx of [-0.18, 0.18]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, psuD - 0.06, 10), labCrimsonDarkMat);
    rail.rotation.x = Math.PI * 0.5;
    rail.position.set(rx, psuH + 0.032, 0);
    psuGroup.add(rail);
  }

  // Interior Green Compute PCB Backplane visible through front inspection window
  const pcbTex = createGreenPcbTexture();
  const pcbMat = new THREE.MeshStandardMaterial({
    map: pcbTex,
    emissiveMap: pcbTex,
    emissive: new THREE.Color(0x36d97e),
    emissiveIntensity: 0.48,
    roughness: 0.36,
    metalness: 0.22,
  });
  const pcbBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), pcbMat);
  pcbBoard.position.set(0, psuH * 0.5, 0.11);
  psuGroup.add(pcbBoard);

  // 3D Components mounted on the Green PCB (cylindrical capacitors, aluminum heatsink, spinning internal fan)
  for (let cap = 0; cap < 4; cap++) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.044, 10), consoleCharcoalMat);
    cyl.rotation.x = Math.PI * 0.5;
    cyl.position.set(-0.14 + cap * 0.044, 0.12, 0.135);
    psuGroup.add(cyl);
  }
  for (let fin = 0; fin < 5; fin++) {
    const hsFin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.042), brushedAlumMat);
    hsFin.position.set(-0.14 + fin * 0.022, 0.29, 0.134);
    psuGroup.add(hsFin);
  }
  const psuInternalFan = buildSpinningWhiteFan(0.066, 7);
  psuInternalFan.position.set(0.11, 0.27, 0.142);
  psuGroup.add(psuInternalFan);

  // Pulsing green & amber PCB diagnostic LEDs
  for (const [lx, ly, lMat] of [
    [-0.17, 0.35, ledGreenMat],
    [-0.13, 0.35, ledAmberMat],
    [0.16, 0.12, ledCyanMat],
  ] as const) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), lMat);
    led.position.set(lx, ly, 0.146);
    led.userData.dynamic = true;
    psuGroup.add(led);
  }

  // Clear acrylic inspection window glass pane & front frame strips
  const psuGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.33), acrylicGlassMat);
  psuGlass.position.set(0, psuH * 0.5, psuD * 0.5 - 0.012);
  psuGlass.renderOrder = 3;
  psuGroup.add(psuGlass);

  // Subtle emerald PCB inner glow spill
  const psuGlowLight = new THREE.PointLight(0x3ce88a, 0.42, 1.8, 1.7);
  psuGlowLight.position.set(0, 0.24, 0.32);
  psuGlowLight.castShadow = false;
  psuGroup.add(psuGlowLight);

  // Lower-left Coolant Pump & Hose Distribution Manifold Box
  const manifoldGroup = new THREE.Group();
  manifoldGroup.position.set(-0.48, lowerY, -0.04);
  labRig.add(manifoldGroup);

  const manifoldBox = new THREE.Mesh(
    createBeveledBox(0.62, 0.34, 0.42, 0.016, 2),
    consoleCharcoalMat
  );
  manifoldBox.position.y = 0.17;
  manifoldBox.castShadow = true;
  outlines.addOutline(manifoldBox, 1.022);
  manifoldGroup.add(manifoldBox);

  const manifoldFace = new THREE.Mesh(createBeveledBox(0.54, 0.26, 0.02, 0.005, 1), bumperBlueDarkMat);
  manifoldFace.position.set(0, 0.17, 0.212);
  manifoldGroup.add(manifoldFace);

  for (const gx of [-0.14, 0.14]) {
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.028, 16), brushedAlumMat);
    gauge.rotation.x = Math.PI * 0.5;
    gauge.position.set(gx, 0.20, 0.228);
    manifoldGroup.add(gauge);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.042, 14), labelPaperMat);
    dial.position.set(gx, 0.20, 0.244);
    manifoldGroup.add(dial);
  }
  for (const collarX of [-0.20, -0.06, 0.08, 0.20]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.040, 0.052, 12), brassMat);
    collar.rotation.x = Math.PI * 0.5;
    collar.position.set(collarX, 0.08, 0.228);
    manifoldGroup.add(collar);
  }

  // -------------------------------------------------------------------------
  // D. LEFT SIDE OF BENCH: "REALITY CHARACTER GENERATOR" (修改现实人物生成器)
  //    (Red Robotic Gripper Arm, eGPU Dock, Blue Coolant Tank, Wireframe Humanoid Hologram)
  // -------------------------------------------------------------------------
  const generatorGroup = new THREE.Group();
  generatorGroup.position.set(-0.56, topY, 0.0);
  labRig.add(generatorGroup);

  // 1. Blue-Rimmed Optical Materialization / Scanner Plinth + Calibration Hand-Crank
  const plinthOuter = new THREE.Mesh(
    createBeveledSlab(0.64, 0.048, 0.48, 0.042, 0.012),
    bumperBlueMat
  );
  plinthOuter.position.set(-0.04, 0.024, 0.10);
  plinthOuter.castShadow = true;
  outlines.addOutline(plinthOuter, 1.022);
  generatorGroup.add(plinthOuter);

  const plinthBed = new THREE.Mesh(
    createBeveledSlab(0.54, 0.018, 0.38, 0.028, 0.006),
    consoleCharcoalMat
  );
  plinthBed.position.set(-0.04, 0.048, 0.10);
  generatorGroup.add(plinthBed);

  // Glowing cyan emitter calibration rings embedded in scanner plinth
  for (const [ringR, tubeR] of [[0.145, 0.006], [0.095, 0.0045]] as const) {
    const eRing = new THREE.Mesh(new THREE.TorusGeometry(ringR, tubeR, 8, 28), ledCyanMat);
    eRing.rotation.x = Math.PI * 0.5;
    eRing.position.set(-0.04, 0.059, 0.10);
    generatorGroup.add(eRing);
  }

  // Tactile side calibration crank module (nod to MiSide scanner crank, darkened industrial finish)
  const crankBox = new THREE.Mesh(createBeveledBox(0.085, 0.095, 0.095, 0.008, 2), stainlessFrameMat);
  crankBox.position.set(-0.34, 0.055, 0.28);
  outlines.addOutline(crankBox, 1.03);
  generatorGroup.add(crankBox);
  const crankArm = new THREE.Mesh(createBeveledBox(0.016, 0.085, 0.018, 0.003, 1), brushedAlumMat);
  crankArm.position.set(-0.39, 0.095, 0.28);
  crankArm.rotation.z = 0.28;
  generatorGroup.add(crankArm);
  const crankKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.046, 10), labCrimsonMat);
  crankKnob.rotation.z = Math.PI * 0.5;
  crankKnob.position.set(-0.42, 0.132, 0.28);
  generatorGroup.add(crankKnob);

  // 2. Articulated Red Robotic Gripper Arm (红色机械臂夹具) poised over Hologram Pad
  const armBaseGroup = new THREE.Group();
  armBaseGroup.position.set(-0.46, 0.0, -0.20);
  armBaseGroup.rotation.y = 0.62;
  generatorGroup.add(armBaseGroup);

  const armPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.102, 0.056, 16), consoleCharcoalMat);
  armPedestal.position.y = 0.028;
  outlines.addOutline(armPedestal, 1.03);
  armBaseGroup.add(armPedestal);

  const shoulderTurret = new THREE.Mesh(createBeveledBox(0.11, 0.11, 0.11, 0.012, 2), labCrimsonMat);
  shoulderTurret.position.y = 0.105;
  outlines.addOutline(shoulderTurret, 1.03);
  armBaseGroup.add(shoulderTurret);

  const shoulderJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 14), stainlessFrameMat);
  shoulderJoint.rotation.x = Math.PI * 0.5;
  shoulderJoint.position.set(0, 0.145, 0);
  armBaseGroup.add(shoulderJoint);

  // Lower crimson robotic arm link + hydraulic piston rod
  const lowerArm = new THREE.Mesh(createBeveledBox(0.068, 0.34, 0.062, 0.010, 2), labCrimsonMat);
  lowerArm.position.set(0.06, 0.295, 0);
  lowerArm.rotation.z = -0.34;
  lowerArm.castShadow = true;
  outlines.addOutline(lowerArm, 1.028);
  armBaseGroup.add(lowerArm);

  const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.26, 8), brushedAlumMat);
  pistonRod.position.set(0.115, 0.27, 0);
  pistonRod.rotation.z = -0.34;
  armBaseGroup.add(pistonRod);

  // Elbow servo + animated upper forearm & 3-finger precision claw gripper
  const robotArmHead = new THREE.Group();
  robotArmHead.position.set(0.12, 0.445, 0);
  robotArmHead.userData.dynamic = true;
  armBaseGroup.add(robotArmHead);
  metaState.basementLab.robotArmHead = robotArmHead;

  const elbowServo = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.105, 14), consoleCharcoalMat);
  elbowServo.rotation.x = Math.PI * 0.5;
  robotArmHead.add(elbowServo);

  const upperForearm = new THREE.Mesh(createBeveledBox(0.28, 0.056, 0.054, 0.008, 2), labCrimsonMat);
  upperForearm.position.set(0.14, 0.025, 0);
  upperForearm.rotation.z = 0.14;
  upperForearm.castShadow = true;
  outlines.addOutline(upperForearm, 1.03);
  robotArmHead.add(upperForearm);

  const wristCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.056, 12), stainlessFrameMat);
  wristCollar.rotation.z = Math.PI * 0.5;
  wristCollar.position.set(0.285, 0.044, 0);
  robotArmHead.add(wristCollar);

  // 3-Finger Mechanical Gripper Claws + Laser Calibration Emitter Tip
  for (let c = 0; c < 3; c++) {
    const cAngle = (c / 3) * Math.PI * 2;
    const clawPivot = new THREE.Group();
    clawPivot.position.set(0.315, 0.044, 0);
    clawPivot.rotation.x = cAngle;
    const fingerBase = new THREE.Mesh(createBeveledBox(0.068, 0.014, 0.016, 0.003, 1), brushedAlumMat);
    fingerBase.position.set(0.032, 0.026, 0);
    fingerBase.rotation.z = 0.35;
    clawPivot.add(fingerBase);
    const fingerTip = new THREE.Mesh(createBeveledBox(0.052, 0.011, 0.013, 0.002, 1), labCrimsonDarkMat);
    fingerTip.position.set(0.072, 0.022, 0);
    fingerTip.rotation.z = -0.45;
    clawPivot.add(fingerTip);
    robotArmHead.add(clawPivot);
  }
  const laserTip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), ledCrimsonMat);
  laserTip.position.set(0.318, 0.044, 0);
  robotArmHead.add(laserTip);

  // 3. Heavy Open-Frame eGPU Dock (显卡坞) on Back-Right of Generator Zone
  const egpuGroup = new THREE.Group();
  egpuGroup.position.set(0.36, 0.0, -0.22);
  egpuGroup.rotation.y = -0.16;
  generatorGroup.add(egpuGroup);

  const egpuBase = new THREE.Mesh(createBeveledBox(0.38, 0.042, 0.24, 0.008, 2), consoleCharcoalMat);
  egpuBase.position.y = 0.021;
  outlines.addOutline(egpuBase, 1.024);
  egpuGroup.add(egpuBase);

  // Red structural eGPU frame pillars & top arch
  for (const ex of [-0.175, 0.175]) {
    const pillar = new THREE.Mesh(createBeveledBox(0.026, 0.23, 0.22, 0.006, 1), labCrimsonMat);
    pillar.position.set(ex, 0.135, 0);
    outlines.addOutline(pillar, 1.026);
    egpuGroup.add(pillar);
  }
  const egpuBridge = new THREE.Mesh(createBeveledBox(0.38, 0.024, 0.055, 0.005, 1), labCrimsonDarkMat);
  egpuBridge.position.set(0, 0.246, -0.07);
  egpuGroup.add(egpuBridge);

  // Dual Heavy Graphics Cards with Exposed Fin Stacks, Copper Heatpipes & LED Bars
  for (const gz of [-0.048, 0.048]) {
    const gpuBody = new THREE.Mesh(createBeveledBox(0.31, 0.145, 0.046, 0.007, 2), stainlessFrameMat);
    gpuBody.position.set(0, 0.125, gz);
    gpuBody.castShadow = true;
    outlines.addOutline(gpuBody, 1.026);
    egpuGroup.add(gpuBody);

    const gpuLedStrip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.010, 0.008), ledCyanMat);
    gpuLedStrip.position.set(0, 0.192, gz + 0.021);
    egpuGroup.add(gpuLedStrip);

    // Copper heatpipe loops protruding at GPU top
    for (const hx of [-0.08, 0.0, 0.08]) {
      const pipeLoop = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0045, 6, 12, Math.PI), copperPipeMat);
      pipeLoop.position.set(hx, 0.198, gz);
      egpuGroup.add(pipeLoop);
    }
  }
  // Twin spinning white fans on front of eGPU dock
  for (const fx of [-0.078, 0.078]) {
    const gFan = buildSpinningWhiteFan(0.048, 7);
    gFan.position.set(fx, 0.125, 0.096);
    egpuGroup.add(gFan);
  }

  // 4. Blue Coolant Reservoir Tank (蓝色冷却液槽) with Luminous Liquid & Rising Micro-Bubbles
  const coolantGroup = new THREE.Group();
  coolantGroup.position.set(-0.46, 0.0, 0.18);
  generatorGroup.add(coolantGroup);

  const tankBase = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.114, 0.042, 18), consoleCharcoalMat);
  tankBase.position.y = 0.021;
  outlines.addOutline(tankBase, 1.03);
  coolantGroup.add(tankBase);

  const tankCap = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.036, 18), consoleCharcoalMat);
  tankCap.position.y = 0.348;
  outlines.addOutline(tankCap, 1.03);
  coolantGroup.add(tankCap);

  const tankValve = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.030, 0.034, 12), labCrimsonMat);
  tankValve.position.y = 0.382;
  coolantGroup.add(tankValve);

  // Inner luminous electric-blue coolant core
  const coolantCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.078, 0.255, 16),
    coolantLiquidMat
  );
  coolantCore.position.y = 0.172;
  coolantGroup.add(coolantCore);

  // 6 Animated Rising Micro-Bubbles inside the blue coolant column
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xb8f4ff });
  for (let b = 0; b < 6; b++) {
    const bRadius = 0.008 + (b % 3) * 0.003;
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(bRadius, 8, 8), bubbleMat);
    const angle = b * 1.18;
    const dist = 0.026 + (b % 2) * 0.024;
    bubble.position.set(Math.cos(angle) * dist, 0.07 + b * 0.036, Math.sin(angle) * dist);
    bubble.userData.dynamic = true;
    bubble.userData.bubblePhase = b * 0.65;
    coolantGroup.add(bubble);
    metaState.basementLab.coolantBubbles.push(bubble);
  }

  // Outer borosilicate glass cylinder (renderOrder 4 so internal liquid & bubbles render cleanly)
  const glassTank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.094, 0.094, 0.295, 18),
    coolantGlassMat
  );
  glassTank.position.y = 0.188;
  glassTank.renderOrder = 4;
  coolantGroup.add(glassTank);

  // 4 Vertical stainless steel tie-rods reinforcing the coolant cylinder
  for (let r = 0; r < 4; r++) {
    const a = (r / 4) * Math.PI * 2 + Math.PI * 0.25;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.31, 8), brushedAlumMat);
    rod.position.set(Math.cos(a) * 0.102, 0.186, Math.sin(a) * 0.102);
    coolantGroup.add(rod);
  }

  // Copper/blue feeder tube connecting coolant reservoir to scanner plinth & eGPU
  const coolantFeedCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.46, 0.06, 0.18),
    new THREE.Vector3(-0.34, 0.08, 0.02),
    new THREE.Vector3(-0.14, 0.05, -0.14),
    new THREE.Vector3(0.18, 0.07, -0.20),
  ]);
  const coolantFeedTube = new THREE.Mesh(
    new THREE.TubeGeometry(coolantFeedCurve, 24, 0.011, 8, false),
    bumperBlueMat
  );
  generatorGroup.add(coolantFeedTube);

  // 5. Floating Rotating Wireframe Humanoid Hologram (悬浮旋转线框人形全息投影)
  const holoAnchor = new THREE.Group();
  holoAnchor.position.set(-0.04, 0.06, 0.10);
  holoAnchor.userData.dynamic = true;
  generatorGroup.add(holoAnchor);

  // Translucent upward hologram emitter light cone
  const holoBeamMat = new THREE.MeshBasicMaterial({
    color: 0x38e4ff,
    transparent: true,
    opacity: 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const holoCone = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.09, 0.56, 20, 1, true), holoBeamMat);
  holoCone.position.y = 0.28;
  holoCone.renderOrder = 5;
  holoAnchor.add(holoCone);

  // Rotating stylized wireframe humanoid figure
  const hologramGroup = new THREE.Group();
  hologramGroup.position.set(0, 0.33, 0);
  hologramGroup.userData.dynamic = true;
  holoAnchor.add(hologramGroup);
  metaState.basementLab.hologramGroup = hologramGroup;

  const holoWireMat = new THREE.LineBasicMaterial({
    color: 0x62f4ff,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const holoWireAccentMat = new THREE.LineBasicMaterial({
    color: 0xff70a6,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const holoInnerShellMat = new THREE.MeshBasicMaterial({
    color: 0x26c8f5,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const addHoloPart = (
    geo: THREE.BufferGeometry,
    px: number,
    py: number,
    pz: number,
    rx = 0,
    ry = 0,
    rz = 0,
    useAccent = false
  ) => {
    const shell = new THREE.Mesh(geo, holoInnerShellMat);
    shell.position.set(px, py, pz);
    shell.rotation.set(rx, ry, rz);
    shell.renderOrder = 5;
    hologramGroup.add(shell);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      useAccent ? holoWireAccentMat : holoWireMat
    );
    wire.position.set(px, py, pz);
    wire.rotation.set(rx, ry, rz);
    wire.renderOrder = 6;
    hologramGroup.add(wire);
  };

  // Sculpted stylized humanoid silhouette (head, hair pigtails hint, torso, skirt, arms, legs)
  addHoloPart(new THREE.SphereGeometry(0.052, 12, 9), 0, 0.205, 0); // Head
  addHoloPart(new THREE.ConeGeometry(0.022, 0.095, 6), -0.056, 0.185, -0.015, 0.1, 0, 0.38, true); // Left hair lock
  addHoloPart(new THREE.ConeGeometry(0.022, 0.095, 6), 0.056, 0.185, -0.015, 0.1, 0, -0.38, true); // Right hair lock
  addHoloPart(new THREE.CylinderGeometry(0.018, 0.022, 0.032, 8), 0, 0.145, 0); // Neck
  addHoloPart(new THREE.CylinderGeometry(0.056, 0.036, 0.125, 10, 2), 0, 0.072, 0); // Upper torso
  addHoloPart(new THREE.CylinderGeometry(0.038, 0.076, 0.105, 12, 2), 0, -0.038, 0, 0, 0, 0, true); // Flared skirt
  // Arms gracefully angled slightly outward
  addHoloPart(new THREE.CylinderGeometry(0.015, 0.012, 0.15, 7), -0.076, 0.055, 0.012, -0.18, 0, 0.28);
  addHoloPart(new THREE.CylinderGeometry(0.015, 0.012, 0.15, 7), 0.076, 0.055, 0.012, -0.18, 0, -0.28);
  // Legs
  addHoloPart(new THREE.CylinderGeometry(0.020, 0.013, 0.185, 8), -0.028, -0.175, 0);
  addHoloPart(new THREE.CylinderGeometry(0.020, 0.013, 0.185, 8), 0.028, -0.175, 0);

  // 2 Tilted Counter-Rotating Holographic Telemetry Rings orbiting the humanoid
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(0.155, 0.0038, 6, 32),
    new THREE.MeshBasicMaterial({
      color: 0x62f4ff,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring1.position.y = 0.34;
  ring1.rotation.set(1.18, 0.22, 0);
  ring1.userData.dynamic = true;
  holoAnchor.add(ring1);
  metaState.basementLab.holoRings.push(ring1);

  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(0.182, 0.0032, 6, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff6b9d,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring2.position.y = 0.27;
  ring2.rotation.set(1.42, -0.35, 0.2);
  ring2.userData.dynamic = true;
  holoAnchor.add(ring2);
  metaState.basementLab.holoRings.push(ring2);

  // Cyan Holographic Point Light casting subtle eerie reflection on the dark basement lab
  const holoLight = new THREE.PointLight(0x3ad8ff, 0.82, 3.4, 1.45);
  holoLight.position.set(0, 0.36, 0.08);
  holoLight.castShadow = false;
  holoAnchor.add(holoLight);
  metaState.basementLab.holoLight = holoLight;

  // -------------------------------------------------------------------------
  // E. 5 FLOOR-HUGGING THICK BLACK CORRUGATED HOSES (TubeGeometry, y >= radius)
  // -------------------------------------------------------------------------
  const { map: hoseColorMap, bumpMap: hoseBumpMap } = createCorrugatedHoseTextures();
  const corrugatedHoseMat = mat({
    map: hoseColorMap,
    bumpMap: hoseBumpMap,
    bumpScale: 0.028,
    color: 0x262934,
    roughness: 0.64,
    metalness: 0.16,
  });

  const buildFloorCorrugatedHose = (
    rawPoints: [number, number, number][],
    radius: number,
    tubularSegments = 56
  ) => {
    // Clamp all floor-zone control points strictly above radius + 0.004 to prevent floor clipping
    const minFloorY = radius + 0.004;
    const pts = rawPoints.map(([x, y, z]) => new THREE.Vector3(x, Math.max(y, minFloorY), z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const tubeGeo = new THREE.TubeGeometry(curve, tubularSegments, radius, 10, false);

    // Guarantee mathematically that NO vertex of the extruded tube dips below basement floor (y = 0)
    const pos = tubeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < 0.003) {
        pos.setY(i, 0.003);
      }
    }
    pos.needsUpdate = true;
    tubeGeo.computeVertexNormals();

    const hoseMesh = new THREE.Mesh(tubeGeo, corrugatedHoseMat);
    hoseMesh.castShadow = true;
    hoseMesh.receiveShadow = true;
    outlines.addOutline(hoseMesh, 1.03);
    labRig.add(hoseMesh);
  };

  // Hose 1 (r = 0.042): Thick main umbilical from Red PSU -> curving across dark tiles to Vault Floor Hatch!
  buildFloorCorrugatedHose(
    [
      [0.42, 0.34, 0.16],
      [0.24, 0.14, 0.44],
      [-0.08, 0.046, 0.78],
      [-0.78, 0.046, 1.24],
      [-1.72, 0.046, 1.62],
      [-2.58, 0.046, 2.02],
      [-3.18, 0.046, 2.38],
    ],
    0.042,
    64
  );

  // Hose 2 (r = 0.038): Parallel twin umbilical from Coolant Manifold -> sweeping beside Hose 1 to Vault Hatch!
  buildFloorCorrugatedHose(
    [
      [-0.36, 0.32, 0.18],
      [-0.48, 0.13, 0.50],
      [-0.72, 0.042, 0.94],
      [-1.36, 0.042, 1.38],
      [-2.18, 0.042, 1.78],
      [-2.86, 0.042, 2.06],
      [-3.22, 0.042, 2.16],
    ],
    0.038,
    60
  );

  // Hose 3 (r = 0.035): Generator power/data conduit looping out on floor & feeding behind Rack 2
  buildFloorCorrugatedHose(
    [
      [-0.72, 0.34, 0.16],
      [-0.96, 0.14, 0.48],
      [-1.24, 0.039, 0.86],
      [-1.74, 0.039, 0.72],
      [-2.06, 0.039, 0.12],
      [-2.24, 0.039, -0.58],
    ],
    0.035,
    54
  );

  // Hose 4 (r = 0.033): Heavy PSU rear-right power trunk hugging floor toward East concrete wall conduit
  buildFloorCorrugatedHose(
    [
      [0.78, 0.32, 0.14],
      [1.04, 0.12, 0.42],
      [1.26, 0.037, 0.68],
      [1.52, 0.037, 0.36],
      [1.64, 0.037, -0.28],
      [1.66, 0.18, -0.78],
    ],
    0.033,
    48
  );

  // Hose 5 (r = 0.030): Overhead-to-lower umbilical linking Reality Generator underside down into Red PSU
  buildFloorCorrugatedHose(
    [
      [-0.56, 0.78, -0.14],
      [-0.36, 0.56, 0.18],
      [-0.12, 0.24, 0.34],
      [0.16, 0.09, 0.36],
      [0.36, 0.28, 0.22],
    ],
    0.030,
    38
  );

  // Heavy industrial floor saddle clamps pinning twin hoses cleanly onto the tiles
  for (const [cx, cz, crot] of [
    [-0.95, 1.30, 0.48],
    [-2.25, 1.88, 0.42],
  ] as const) {
    const clamp = new THREE.Mesh(createBeveledBox(0.24, 0.022, 0.062, 0.004, 1), rackDarkIronMat);
    clamp.position.set(cx, 0.014, cz);
    clamp.rotation.y = crot;
    labRig.add(clamp);
  }

  group.add(labRig);

  // Accurate Box3 Collider computed directly from the heavy industrial workbench footprint (tabletop height)
  labRig.updateMatrixWorld(true);
  const benchBox = new THREE.Box3().setFromObject(benchFrameGroup);
  const bCenter = new THREE.Vector3();
  const bSize = new THREE.Vector3();
  benchBox.getCenter(bCenter);
  benchBox.getSize(bSize);
  addBoxCollider('col_base_lab_bench', bCenter.x, -2.72, bCenter.z, bSize.x, 0.96, bSize.z);

  // Preserved Interactive Trigger #1: Retro Red CRT & Console Terminal (base_crt)
  registerInteractable(
    'base_crt',
    '重型实验终端 · CRT',
    '启动地下室终端',
    'basement',
    terminalHostGroup,
    () => {
      metaState.basementLab.scanPulse = 1.0;
      return {
        title: 'SECTOR_06 // 重型实验终端 [DATA TRANSFERRED]',
        message:
          '红色显像管屏幕跳动着双通道同步波形：“DATA TRANSFERRED · 现实锚点已写入 · 底层线缆正直连地板铁盖下方。她知道你下楼了。”',
        metaTrigger: true,
        triggerBasementTerminal: true,
      };
    }
  );

  // Preserved Interactive Trigger #2: Reality Character Generator (base_char_generator)
  registerInteractable(
    'base_char_generator',
    '修改现实人物生成器',
    '检测全息投影 / 启动同步',
    'basement',
    generatorGroup,
    () => {
      metaState.basementLab.scanPulse = 1.0;
      return {
        title: 'REALITY_CHAR_GEN // 修改现实人物生成器',
        message:
          '蓝色冷却液槽内气泡骤然加速，红色机械臂微微校准——悬浮的线框人形全息投影闪过一帧畸变轮廓：“对象映射进度 98.4% · 显卡坞与地下核心同步中。”',
        metaTrigger: true,
        triggerBasementTerminal: true,
      };
    }
  );

  // =========================================================================
  // 6. BOLTED IRON VAULT FLOOR HATCH & HEAVY PADLOCK (X = -2.70, Z = -2.70)
  // =========================================================================
  const hatch = new THREE.Group();
  hatch.position.set(-2.70, -3.19, -2.70);

  const hatchFrame = new THREE.Mesh(
    createBeveledSlab(1.38, 0.055, 1.38, 0.08, 0.016),
    ironMat
  );
  hatchFrame.position.y = 0.025;
  outlines.addOutline(hatchFrame, 1.022);
  hatch.add(hatchFrame);

  // 2 Recessed Ribbed Vault Doors
  const vaultDoorMat = mat({ color: 0x523244, roughness: 0.58, metalness: 0.52 });
  for (const side of [-1, 1]) {
    const vDoor = new THREE.Mesh(
      createBeveledSlab(0.56, 0.068, 1.16, 0.04, 0.014),
      vaultDoorMat
    );
    vDoor.position.set(side * 0.29, 0.038, 0);
    hatch.add(vDoor);

    // Cross reinforcement ribs
    for (const rz of [-0.36, 0, 0.36]) {
      const rib = new THREE.Mesh(
        createBeveledBox(0.48, 0.02, 0.045, 0.006, 2),
        ironMat
      );
      rib.position.set(side * 0.29, 0.075, rz);
      hatch.add(rib);
    }
  }

  // 8 Perimeter Hex Bolts
  const boltGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.025, 6);
  for (const bx of [-0.6, 0.6]) {
    for (const bz of [-0.6, -0.2, 0.2, 0.6]) {
      const bolt = new THREE.Mesh(boltGeo, brassMat);
      bolt.position.set(bx, 0.058, bz);
      hatch.add(bolt);
    }
  }

  // Heavy Brass Padlock + U-Shackle locking center seam
  const lockGroup = new THREE.Group();
  lockGroup.position.set(0, 0.095, 0.15);
  lockGroup.rotation.z = 0.25;
  const lockBody = new THREE.Mesh(
    createBeveledBox(0.13, 0.15, 0.055, 0.018, 3),
    brassMat
  );
  outlines.addOutline(lockBody, 1.06);
  lockGroup.add(lockBody);
  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.042, 0.012, 8, 16, Math.PI),
    rackSteelMat
  );
  shackle.position.y = 0.075;
  lockGroup.add(shackle);
  hatch.add(lockGroup);

  group.add(hatch);

  // =========================================================================
  // 6B. BASEMENT WORKSHOP DECOR: DIRTY RUG ON TILED FLOOR, PEGBOARD, BLUEPRINT & SPOOLS
  // =========================================================================
  const dirtyRugMat = mat({
    map: textures.dirtyRug,
    color: 0xd9ced2,
    roughness: 0.96,
    metalness: 0.0,
  });
  const yellowPaintMat = mat({ color: 0xe6b44c, roughness: 0.56, metalness: 0.06 });
  const pegboardMat = mat({ color: 0xb68a63, roughness: 0.72, metalness: 0.02 });
  const blueprintMat = mat({ color: 0x264873, roughness: 0.58, metalness: 0.04 });
  const copperMat = mat({ color: 0xc97b4b, roughness: 0.34, metalness: 0.78 });

  // Stained, weathered dirty carpet resting over the basement tiled floor
  const dirtyRug = new THREE.Mesh(
    createBeveledSlab(3.8, 0.016, 2.8, 0.04, 0.006),
    dirtyRugMat
  );
  dirtyRug.position.set(-5.80, -3.192, -2.50);
  dirtyRug.rotation.y = 0.03;
  dirtyRug.receiveShadow = true;
  group.add(dirtyRug);

  // Yellow industrial safety border around the floor vault hatch
  for (const [hx, hz, hw, hd] of [
    [-2.70, -3.46, 1.54, 0.06],
    [-2.70, -1.94, 1.54, 0.06],
    [-3.44, -2.70, 0.06, 1.46],
    [-1.96, -2.70, 0.06, 1.46],
  ] as const) {
    const borderStrip = new THREE.Mesh(
      new THREE.BoxGeometry(hw, 0.012, hd),
      yellowPaintMat
    );
    borderStrip.position.set(hx, -3.184, hz);
    group.add(borderStrip);
  }

  // Upgraded Wide Perforated Steel Tool Pegboard above Industrial Workbench (X = 1.18, Y = -1.36, Z = -5.95)
  const pegboardTex = createPegboardTexture();
  const pegboard = new THREE.Group();
  pegboard.position.set(1.18, -1.36, -5.95);

  const pegOuterFrame = new THREE.Mesh(
    createBeveledBox(1.94, 0.86, 0.032, 0.008, 2),
    rackDarkIronMat
  );
  outlines.addOutline(pegOuterFrame, 1.018);
  pegboard.add(pegOuterFrame);

  const pegFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.86, 0.78),
    mat({ map: pegboardTex, roughness: 0.55, metalness: 0.42 })
  );
  pegFace.position.z = 0.018;
  pegboard.add(pegFace);

  // Hanging 3D workshop tools on pegboard: 3 graduated wrenches, 3 screwdrivers, pliers, rubber mallet, hacksaw, multimeter & tape rolls
  for (let w = 0; w < 3; w++) {
    const wx = -0.78 + w * 0.11;
    const wLen = 0.30 - w * 0.05;
    const wrenchBar = new THREE.Mesh(createBeveledBox(0.022, wLen, 0.010, 0.002, 1), brushedAlumMat);
    wrenchBar.position.set(wx, 0.12 - w * 0.02, 0.032);
    pegboard.add(wrenchBar);
    const wrenchJaw = new THREE.Mesh(new THREE.TorusGeometry(0.024 - w * 0.003, 0.007, 6, 12, Math.PI * 1.45), brushedAlumMat);
    wrenchJaw.position.set(wx, 0.12 - w * 0.02 + wLen * 0.52, 0.032);
    wrenchJaw.rotation.z = 0.8;
    pegboard.add(wrenchJaw);
  }
  for (const [sx, sLen, handleMat] of [
    [-0.38, 0.24, redValveMat],
    [-0.28, 0.21, yellowPaintMat],
    [-0.18, 0.19, bumperBlueMat],
  ] as const) {
    const sHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.013, 0.095, 10), handleMat);
    sHandle.position.set(sx, 0.22, 0.034);
    pegboard.add(sHandle);
    const sShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, sLen - 0.09, 8), brushedAlumMat);
    sShaft.position.set(sx, 0.22 - sLen * 0.46, 0.034);
    pegboard.add(sShaft);
  }
  // Rubber workshop mallet
  const malletShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.28, 8), woodStepMat);
  malletShaft.position.set(0.02, 0.08, 0.034);
  pegboard.add(malletShaft);
  const malletHead = new THREE.Mesh(createBeveledBox(0.11, 0.062, 0.052, 0.010, 2), consoleCharcoalMat);
  malletHead.position.set(0.02, 0.23, 0.042);
  pegboard.add(malletHead);
  // Red industrial hacksaw
  const sawFrame = new THREE.Mesh(createBeveledBox(0.36, 0.018, 0.012, 0.003, 1), redValveMat);
  sawFrame.position.set(0.36, 0.24, 0.032);
  pegboard.add(sawFrame);
  const sawBlade = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.014, 0.004), brushedAlumMat);
  sawBlade.position.set(0.36, 0.13, 0.032);
  pegboard.add(sawBlade);
  for (const sx of [0.19, 0.53]) {
    const sawEnd = new THREE.Mesh(createBeveledBox(0.018, 0.12, 0.012, 0.003, 1), redValveMat);
    sawEnd.position.set(sx, 0.185, 0.032);
    pegboard.add(sawEnd);
  }
  // Yellow digital multimeter + 2 hanging tape rolls
  const meterBody = new THREE.Mesh(createBeveledBox(0.105, 0.17, 0.036, 0.008, 2), yellowPaintMat);
  meterBody.position.set(0.72, 0.16, 0.036);
  pegboard.add(meterBody);
  const meterLcd = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.044), mat({ color: 0x8ea48d, roughness: 0.45, metalness: 0.05 }));
  meterLcd.position.set(0.72, 0.20, 0.056);
  pegboard.add(meterLcd);
  for (const [tx, tMat] of [[-0.64, consoleCharcoalMat], [-0.46, bumperBlueMat]] as const) {
    const tapeRoll = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.016, 8, 16), tMat);
    tapeRoll.position.set(tx, -0.22, 0.036);
    pegboard.add(tapeRoll);
  }
  // Small steel pegboard parts bin rail along lower right
  const pegTray = new THREE.Mesh(createBeveledBox(0.68, 0.082, 0.11, 0.006, 1), bumperBlueDarkMat);
  pegTray.position.set(0.46, -0.24, 0.064);
  pegboard.add(pegTray);
  group.add(pegboard);

  // Side Clue Board with Circuit Diagrams & Sticky Notes on East Wall beside Workbench (X = 2.91, Y = -1.52, Z = -4.72)
  const clueBoardTex = createClueBoardTexture();
  const clueBoard = new THREE.Group();
  clueBoard.position.set(2.91, -1.52, -4.72);
  clueBoard.rotation.y = -Math.PI * 0.5;

  const clueFrame = new THREE.Mesh(
    createBeveledBox(1.30, 0.90, 0.034, 0.008, 2),
    darkWoodMatForBase()
  );
  clueFrame.castShadow = true;
  outlines.addOutline(clueFrame, 1.020);
  clueBoard.add(clueFrame);

  const clueFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.22, 0.82),
    mat({ map: clueBoardTex, roughness: 0.78, metalness: 0.02 })
  );
  clueFace.position.z = 0.019;
  clueBoard.add(clueFace);

  // Bottom aluminum chalk/marker ledge + 3D pushpins
  const clueLedge = new THREE.Mesh(createBeveledBox(1.24, 0.022, 0.068, 0.004, 1), rackSteelMat);
  clueLedge.position.set(0, -0.455, 0.038);
  clueBoard.add(clueLedge);
  for (const [px, py, pMat] of [
    [-0.32, 0.30, redValveMat],
    [0.08, 0.28, yellowPaintMat],
    [0.38, 0.29, redValveMat],
    [-0.02, -0.04, redValveMat],
    [-0.44, -0.10, bumperBlueMat],
  ] as const) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), pMat);
    pin.position.set(px, py, 0.026);
    clueBoard.add(pin);
  }
  group.add(clueBoard);

  // Framed Wiring Blueprint Poster on North Wall (lowered slightly to clear overhead crawl duct: X = -7.60, Y = -1.88, Z = -5.95)
  const blueprintFrame = new THREE.Group();
  blueprintFrame.position.set(-7.60, -1.88, -5.95);
  const bpBacking = new THREE.Mesh(
    createBeveledBox(0.86, 0.62, 0.026, 0.008, 2),
    darkWoodMatForBase()
  );
  blueprintFrame.add(bpBacking);
  const bpSheet = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.54), blueprintMat);
  bpSheet.position.z = 0.015;
  blueprintFrame.add(bpSheet);
  for (const lineY of [-0.14, 0, 0.14]) {
    const gridLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.68, 0.012),
      tapeMat
    );
    gridLine.position.set(0, lineY, 0.017);
    blueprintFrame.add(gridLine);
  }
  group.add(blueprintFrame);

  // =========================================================================
  // 6b. RETRO UPRIGHT ARCADE CABINET — 《铁甲战线 / IRON TREADS》(X = -6.80, Z = -5.45)
  // =========================================================================
  const cabinetBodyMat = mat({ color: 0x221a36, roughness: 0.46, metalness: 0.18 });
  const cabinetTrimMat = mat({ color: 0xe64b65, roughness: 0.34, metalness: 0.16 });
  const cabinetSideArtMat = mat({
    map: textures.arcadeSideArt,
    roughness: 0.44,
    metalness: 0.12,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const smokedBezelMat = mat({ color: 0x161422, roughness: 0.32, metalness: 0.25 });
  const deckMat = mat({ color: 0x2b2442, roughness: 0.42, metalness: 0.22 });
  const chromeMat = mat({ color: 0xd5dce6, roughness: 0.18, metalness: 0.88 });
  const p1StickMat = mat({ color: 0xff4567, roughness: 0.22, metalness: 0.14 });
  const p2StickMat = mat({ color: 0x4ae8cc, roughness: 0.22, metalness: 0.14 });
  const btnAmberMat = mat({ color: 0xffa742, roughness: 0.26, metalness: 0.12 });
  const btnWhiteMat = mat({ color: 0xf4eef8, roughness: 0.30, metalness: 0.08 });
  const coinGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff7b47,
    emissive: 0xff5126,
    emissiveIntensity: 0.85,
    roughness: 0.28,
    metalness: 0.1,
  });
  const arcadeMarqueeMat = new THREE.MeshStandardMaterial({
    map: textures.arcadeMarquee,
    emissiveMap: textures.arcadeMarquee,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.92,
    roughness: 0.3,
    metalness: 0.05,
  });
  const arcadeScreenMat = new THREE.MeshStandardMaterial({
    map: textures.arcadeScreen,
    emissiveMap: textures.arcadeScreen,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.78,
    roughness: 0.22,
    metalness: 0.06,
  });
  metaState.arcadeScreenMat = arcadeScreenMat;

  const arcadeGroup = new THREE.Group();
  arcadeGroup.position.set(-8.66, -3.2, 1.84);
  arcadeGroup.rotation.y = Math.PI;
  arcadeGroup.name = 'BasementArcadeCabinet';

  // 1. Extruded & Beveled Classic Arcade Side Cheeks (Left & Right)
  const sideShape = new THREE.Shape();
  sideShape.moveTo(-0.40, 0.025);
  sideShape.lineTo(0.33, 0.025);
  sideShape.lineTo(0.33, 0.86);
  sideShape.lineTo(0.44, 0.90);
  sideShape.lineTo(0.44, 0.99);
  sideShape.lineTo(0.30, 1.03);
  sideShape.lineTo(0.15, 1.54);
  sideShape.lineTo(0.35, 1.62);
  sideShape.lineTo(0.31, 1.84);
  sideShape.lineTo(-0.37, 1.86);
  sideShape.lineTo(-0.40, 1.80);
  sideShape.closePath();

  const sideCheekGeo = new THREE.ExtrudeGeometry(sideShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });

  // Left cheek spans X = -0.378 .. -0.346; Right cheek spans X = +0.346 .. +0.378
  for (const sx of [-0.346, 0.378]) {
    const cheek = new THREE.Mesh(sideCheekGeo, cabinetBodyMat);
    cheek.position.set(sx, 0, 0);
    cheek.rotation.y = -Math.PI * 0.5;
    cheek.castShadow = true;
    cheek.receiveShadow = true;
    outlines.addOutline(cheek, 1.02);
    arcadeGroup.add(cheek);
  }

  // Side-Art Recessed Graphic Panels on outer flanks
  for (const [px, rotY] of [
    [-0.388, -Math.PI * 0.5],
    [0.388, Math.PI * 0.5],
  ] as const) {
    const artPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 1.32), cabinetSideArtMat);
    artPanel.position.set(px, 0.96, -0.04);
    artPanel.rotation.y = rotY;
    arcadeGroup.add(artPanel);
  }

  // Crimson T-Molding Edge Accent Strips running down the front cheek silhouettes
  const tMoldSegments: [number, number, number, number][] = [
    [0.44, 0.335, 0.85, 0.0], // lower front vertical
    [0.945, 0.446, 0.11, 0.0], // deck nose
    [1.285, 0.228, 0.54, -0.285], // CRT bay slant
    [1.73, 0.335, 0.24, -0.17], // marquee brow
  ];
  for (const sx of [-0.362, 0.362]) {
    for (const [ty, tz, tLen, tRotX] of tMoldSegments) {
      const strip = new THREE.Mesh(
        createBeveledBox(0.018, tLen, 0.018, 0.004, 1),
        cabinetTrimMat
      );
      strip.position.set(sx, ty, tz);
      strip.rotation.x = tRotX;
      arcadeGroup.add(strip);
    }
  }

  // 2. Chassis Core, Top Cap, Rear Service Door & 4 Leveling Feet
  const basePlinth = new THREE.Mesh(
    createBeveledBox(0.692, 0.06, 0.72, 0.008, 2),
    ironMat
  );
  basePlinth.position.set(0, 0.055, -0.03);
  arcadeGroup.add(basePlinth);

  for (const [fx, fz] of [
    [-0.31, 0.28],
    [0.31, 0.28],
    [-0.31, -0.34],
    [0.31, -0.34],
  ] as const) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 0.03, 10), chromeMat);
    foot.position.set(fx, 0.015, fz);
    arcadeGroup.add(foot);
  }

  const lowerBox = new THREE.Mesh(
    createBeveledBox(0.688, 0.84, 0.69, 0.01, 2),
    cabinetBodyMat
  );
  lowerBox.position.set(0, 0.49, -0.03);
  lowerBox.castShadow = true;
  lowerBox.receiveShadow = true;
  arcadeGroup.add(lowerBox);

  const upperBackBox = new THREE.Mesh(
    createBeveledBox(0.688, 0.94, 0.44, 0.01, 2),
    cabinetBodyMat
  );
  upperBackBox.position.set(0, 1.38, -0.16);
  upperBackBox.castShadow = true;
  arcadeGroup.add(upperBackBox);

  // Rear ventilation louver plate
  const rearGrill = new THREE.Mesh(
    createBeveledBox(0.46, 0.52, 0.018, 0.004, 1),
    ironMat
  );
  rearGrill.position.set(0, 0.56, -0.382);
  arcadeGroup.add(rearGrill);

  // 3. Lower Front Kickplate & Detailed Iron Coin Door Assembly
  const kickPlate = new THREE.Mesh(
    createBeveledBox(0.66, 0.14, 0.022, 0.005, 2),
    ironMat
  );
  kickPlate.position.set(0, 0.14, 0.318);
  arcadeGroup.add(kickPlate);

  const coinDoorFrame = new THREE.Mesh(
    createBeveledBox(0.42, 0.50, 0.028, 0.008, 2),
    ironMat
  );
  coinDoorFrame.position.set(0, 0.49, 0.318);
  outlines.addOutline(coinDoorFrame, 1.03);
  arcadeGroup.add(coinDoorFrame);

  // Coin door lock & center hinge strip
  const coinLock = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.022, 10),
    chromeMat
  );
  coinLock.rotation.x = Math.PI * 0.5;
  coinLock.position.set(0, 0.66, 0.336);
  arcadeGroup.add(coinLock);

  // Twin Glowing 100¥ Coin Reject Buttons + Recessed Return Cups
  for (const cx of [-0.095, 0.095]) {
    const coinBtnBezel = new THREE.Mesh(
      createBeveledBox(0.072, 0.088, 0.018, 0.004, 1),
      chromeMat
    );
    coinBtnBezel.position.set(cx, 0.56, 0.336);
    arcadeGroup.add(coinBtnBezel);

    const coinBtn = new THREE.Mesh(
      createBeveledBox(0.046, 0.058, 0.016, 0.004, 1),
      coinGlowMat
    );
    coinBtn.position.set(cx, 0.56, 0.344);
    arcadeGroup.add(coinBtn);

    const coinSlot = new THREE.Mesh(
      createBeveledBox(0.008, 0.032, 0.008, 0.001, 1),
      ironMat
    );
    coinSlot.position.set(cx, 0.56, 0.353);
    arcadeGroup.add(coinSlot);

    const returnPocket = new THREE.Mesh(
      createBeveledBox(0.076, 0.086, 0.022, 0.005, 1),
      smokedBezelMat
    );
    returnPocket.position.set(cx, 0.38, 0.334);
    arcadeGroup.add(returnPocket);

    const returnFlap = new THREE.Mesh(
      createBeveledBox(0.052, 0.056, 0.008, 0.002, 1),
      chromeMat
    );
    returnFlap.position.set(cx, 0.38, 0.344);
    arcadeGroup.add(returnFlap);
  }

  // 4. Angled Control Panel Deck + Wrist Bolster + 2 Ball-Top Joysticks + 8 Action Buttons
  const controlDeckGroup = new THREE.Group();
  controlDeckGroup.position.set(0, 0.945, 0.34);
  controlDeckGroup.rotation.x = 0.16;
  arcadeGroup.add(controlDeckGroup);

  const deckBase = new THREE.Mesh(
    createBeveledBox(0.688, 0.068, 0.25, 0.01, 2),
    deckMat
  );
  outlines.addOutline(deckBase, 1.02);
  controlDeckGroup.add(deckBase);

  const bolsterBar = new THREE.Mesh(
    createBeveledBox(0.688, 0.028, 0.034, 0.008, 2),
    chromeMat
  );
  bolsterBar.position.set(0, 0.032, 0.114);
  controlDeckGroup.add(bolsterBar);

  // P1 Animated Ball-Top Joystick (left) + P2 Ball-Top Joystick (right)
  const buildJoystick = (jx: number, jz: number, ballMat: THREE.Material, isDynamic: boolean): THREE.Group => {
    const baseMount = new THREE.Group();
    baseMount.position.set(jx, 0.035, jz);
    if (isDynamic) baseMount.userData.dynamic = true;

    const washer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.006, 14),
      ironMat
    );
    washer.position.y = 0.003;
    if (isDynamic) washer.userData.dynamic = true;
    baseMount.add(washer);

    const stickPivot = new THREE.Group();
    stickPivot.position.y = 0.006;
    if (isDynamic) stickPivot.userData.dynamic = true;

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0065, 0.0065, 0.056, 10),
      chromeMat
    );
    shaft.position.y = 0.028;
    if (isDynamic) shaft.userData.dynamic = true;
    stickPivot.add(shaft);

    const ballTop = new THREE.Mesh(new THREE.SphereGeometry(0.021, 14, 12), ballMat);
    ballTop.position.y = 0.058;
    if (isDynamic) ballTop.userData.dynamic = true;
    outlines.addOutline(ballTop, 1.06);
    stickPivot.add(ballTop);

    baseMount.add(stickPivot);
    controlDeckGroup.add(baseMount);
    return stickPivot;
  };

  metaState.arcadeJoystickGroup = buildJoystick(-0.20, 0.015, p1StickMat, true);
  buildJoystick(0.08, 0.015, p2StickMat, false);

  // 6 Concave Action Buttons (3 for P1, 3 for P2) + 2 Start Buttons
  const actionButtons: [number, number, THREE.Material][] = [
    [-0.10, -0.01, p1StickMat],
    [-0.045, -0.024, btnAmberMat],
    [0.01, -0.012, p1StickMat],
    [0.18, -0.01, p2StickMat],
    [0.235, -0.024, btnAmberMat],
    [0.29, -0.012, p2StickMat],
    [-0.24, -0.072, btnWhiteMat],
    [0.04, -0.072, btnWhiteMat],
  ];
  for (const [bx, bz, bMat] of actionButtons) {
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.008, 14),
      ironMat
    );
    collar.position.set(bx, 0.038, bz);
    controlDeckGroup.add(collar);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.01, 14),
      bMat
    );
    cap.position.set(bx, 0.043, bz);
    controlDeckGroup.add(cap);
  }

  // 5. Recessed 4:3 CRT Monitor Bay & Glass Tube Screen (0.54m x 0.405m tilted -0.22 rad)
  const crtBayGroup = new THREE.Group();
  crtBayGroup.position.set(0, 1.285, 0.165);
  crtBayGroup.rotation.x = -0.22;
  arcadeGroup.add(crtBayGroup);

  const crtBezelBack = new THREE.Mesh(
    createBeveledBox(0.684, 0.51, 0.055, 0.01, 2),
    smokedBezelMat
  );
  crtBayGroup.add(crtBezelBack);

  // Raised perimeter frame rails around the 0.54 x 0.405 CRT screen
  for (const [rx, ry, rw, rh] of [
    [0, 0.225, 0.66, 0.046],
    [0, -0.225, 0.66, 0.046],
    [-0.305, 0, 0.05, 0.41],
    [0.305, 0, 0.05, 0.41],
  ] as const) {
    const rail = new THREE.Mesh(
      createBeveledBox(rw, rh, 0.026, 0.005, 1),
      ironMat
    );
    rail.position.set(rx, ry, 0.032);
    crtBayGroup.add(rail);
  }

  // Live 4:3 CRT Screen Surface (marked dynamic so static merging preserves its transform & material!)
  const arcadeScreenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.54, 0.405),
    arcadeScreenMat
  );
  arcadeScreenMesh.position.set(0, 0, 0.031);
  arcadeScreenMesh.userData.dynamic = true;
  arcadeScreenMesh.userData.interactId = 'base_arcade';
  arcadeScreenMesh.layers.enable(1);
  crtBayGroup.add(arcadeScreenMesh);
  metaState.arcadeScreenMesh = arcadeScreenMesh;

  // 6. Upper Speaker Soffit & Backlit Top Marquee Lightbox
  const speakerSoffit = new THREE.Mesh(
    createBeveledBox(0.684, 0.075, 0.24, 0.008, 2),
    cabinetBodyMat
  );
  speakerSoffit.position.set(0, 1.565, 0.17);
  speakerSoffit.rotation.x = 0.34;
  arcadeGroup.add(speakerSoffit);

  for (const sx of [-0.21, 0.21]) {
    const grille = new THREE.Mesh(
      createBeveledBox(0.16, 0.045, 0.016, 0.004, 1),
      ironMat
    );
    grille.position.set(sx, 1.54, 0.225);
    grille.rotation.x = 0.34;
    arcadeGroup.add(grille);
  }

  const marqueeHousing = new THREE.Group();
  marqueeHousing.position.set(0, 1.725, 0.285);
  marqueeHousing.rotation.x = 0.18;
  arcadeGroup.add(marqueeHousing);

  const marqueeBox = new THREE.Mesh(
    createBeveledBox(0.688, 0.215, 0.11, 0.01, 2),
    cabinetBodyMat
  );
  outlines.addOutline(marqueeBox, 1.02);
  marqueeHousing.add(marqueeBox);

  const marqueeRetainerTop = new THREE.Mesh(
    createBeveledBox(0.68, 0.02, 0.022, 0.004, 1),
    chromeMat
  );
  marqueeRetainerTop.position.set(0, 0.098, 0.052);
  marqueeHousing.add(marqueeRetainerTop);

  const marqueeRetainerBot = new THREE.Mesh(
    createBeveledBox(0.68, 0.02, 0.022, 0.004, 1),
    chromeMat
  );
  marqueeRetainerBot.position.set(0, -0.098, 0.052);
  marqueeHousing.add(marqueeRetainerBot);

  const marqueeArt = new THREE.Mesh(
    new THREE.PlaneGeometry(0.648, 0.178),
    arcadeMarqueeMat
  );
  marqueeArt.position.set(0, 0, 0.058);
  marqueeHousing.add(marqueeArt);

  // Subtle warm marquee & CRT spill light onto the control deck
  const arcadeSpillLight = new THREE.PointLight(0xffa468, 0.62, 2.7, 1.6);
  arcadeSpillLight.position.set(0, 1.68, 0.42);
  arcadeSpillLight.castShadow = false;
  arcadeGroup.add(arcadeSpillLight);

  group.add(arcadeGroup);
  addBoxCollider('col_base_arcade', -8.66, -2.25, 1.84, 0.84, 1.9, 0.92);

  registerInteractable(
    'base_arcade',
    '老式街机《铁甲战线》',
    '投币进入画中画游玩',
    'basement',
    arcadeGroup,
    () => ({
      title: '老式街机《铁甲战线》',
      message: '投币启动 1986 年经典坦克射击街机。',
      openArcadeAction: true,
    })
  );

  function darkWoodMatForBase() {
    return mat({ color: 0x5c4238, roughness: 0.6, metalness: 0.05 });
  }

  // Copper Cable Spool beside West Breaker Wall (X = -8.68, Z = -3.72)
  const spoolGroup = new THREE.Group();
  spoolGroup.position.set(-8.68, -3.2, -3.72);
  for (const sy of [0.025, 0.31]) {
    const flange = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.036, 16),
      woodStepMat
    );
    flange.position.y = sy;
    outlines.addOutline(flange, 1.03);
    spoolGroup.add(flange);
  }
  const copperCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.25, 16),
    copperMat
  );
  copperCore.position.y = 0.17;
  spoolGroup.add(copperCore);
  group.add(spoolGroup);
  addBoxCollider('col_base_spool', -8.68, -3.0, -3.72, 0.48, 0.45, 0.48);

  // =========================================================================
  // 6C. FLOOR & BASEBOARD RUBBER CABLING, ANTI-TRIP CABLE RAMPS, METAL FLOOR DRAIN
  //     & CORNER WORKSHOP FILLERS (STEEL DRUMS, FOLDING STEPLADDER, PLASTIC CRATES)
  // =========================================================================
  const rubberCableBlackMat = mat({ color: 0x1e2028, roughness: 0.72, metalness: 0.12 });
  const rubberCableSlateMat = mat({ color: 0x353b4a, roughness: 0.68, metalness: 0.14 });
  const rubberCableOrangeMat = mat({ color: 0xc25428, roughness: 0.58, metalness: 0.10 });
  const rampRubberMat = mat({ color: 0x22242c, roughness: 0.84, metalness: 0.08 });
  const rampYellowMat = mat({ color: 0xe3b132, roughness: 0.50, metalness: 0.12 });
  const drumBlueMat = mat({ color: 0x35536e, roughness: 0.54, metalness: 0.52 });
  const drumOliveMat = mat({ color: 0x4b5446, roughness: 0.58, metalness: 0.48 });
  const ladderAlumMat = mat({ color: 0x9aa3b0, roughness: 0.34, metalness: 0.76 });
  const turnoverCrateBlueMat = mat({ color: 0x325b86, roughness: 0.54, metalness: 0.12 });
  const turnoverCrateAmberMat = mat({ color: 0xb97b2c, roughness: 0.54, metalness: 0.12 });

  const buildWorldRubberCable = (
    rawPts: [number, number, number][],
    radius: number,
    cableMat: THREE.Material,
    segments = 64
  ) => {
    const minY = -3.20 + radius + 0.004;
    const pts = rawPts.map(([x, y, z]) => new THREE.Vector3(x, Math.max(y, minY), z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const geo = new THREE.TubeGeometry(curve, segments, radius, 8, false);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) < -3.196) pos.setY(i, -3.196);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, cableMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Cable Run A (heavy r = 0.024): Breaker Panel -> West Baseboard -> NW Corner -> North Baseboard -> Workbench Rear
  buildWorldRubberCable(
    [
      [-9.14, -2.74, -2.46],
      [-9.12, -3.14, -2.52],
      [-9.12, -3.17, -4.20],
      [-9.10, -3.17, -5.88],
      [-6.80, -3.17, -5.90],
      [-3.20, -3.17, -5.90],
      [-0.40, -3.17, -5.88],
      [1.72, -3.17, -5.54],
      [1.72, -2.96, -5.12],
    ],
    0.024,
    rubberCableBlackMat,
    76
  );

  // Cable Run B (r = 0.017 + thin orange r = 0.011): Breaker Panel -> South along West Wall -> Arcade Cabinet Power!
  buildWorldRubberCable(
    [
      [-9.14, -2.74, -2.74],
      [-9.12, -3.14, -2.68],
      [-9.12, -3.18, -1.20],
      [-9.12, -3.18, 0.45],
      [-9.06, -3.18, 1.56],
      [-8.78, -3.16, 1.78],
    ],
    0.017,
    rubberCableSlateMat,
    54
  );
  buildWorldRubberCable(
    [
      [-9.14, -2.74, -2.68],
      [-9.08, -3.15, -2.60],
      [-9.06, -3.18, -1.10],
      [-9.06, -3.18, 0.50],
      [-8.98, -3.18, 1.62],
      [-8.72, -3.16, 1.82],
    ],
    0.011,
    rubberCableOrangeMat,
    54
  );

  // Cable Run C (twin crossing cables r = 0.022 & r = 0.013): Breaker Panel -> Floor Crossing under Ramp #1 -> Vault Hatch -> under Ramp #2 -> Workbench
  buildWorldRubberCable(
    [
      [-9.12, -2.74, -2.60],
      [-8.96, -3.17, -2.72],
      [-7.40, -3.17, -3.28],
      [-5.65, -3.17, -3.82],
      [-3.85, -3.17, -3.65],
      [-2.10, -3.17, -3.55],
      [-0.82, -3.17, -3.85],
      [0.12, -3.17, -4.52],
      [0.64, -2.96, -4.96],
    ],
    0.022,
    rubberCableBlackMat,
    72
  );
  buildWorldRubberCable(
    [
      [-9.12, -2.74, -2.54],
      [-8.90, -3.18, -2.68],
      [-7.32, -3.18, -3.35],
      [-5.60, -3.18, -3.88],
      [-3.80, -3.18, -3.72],
      [-2.05, -3.18, -3.62],
      [-0.76, -3.18, -3.90],
      [0.18, -3.18, -4.58],
      [0.72, -2.96, -5.00],
    ],
    0.013,
    rubberCableOrangeMat,
    72
  );

  // Cable Run D (thin r = 0.014): East Wall Baseboard Utility Run -> Workbench Right Side
  buildWorldRubberCable(
    [
      [2.88, -3.18, -1.65],
      [2.86, -3.18, -3.40],
      [2.82, -3.18, -4.75],
      [2.56, -3.18, -4.96],
      [2.42, -2.96, -5.02],
    ],
    0.014,
    rubberCableSlateMat,
    42
  );

  // 2 Yellow-Black Anti-Trip Floor Cable Protector Ramps (防踩过线槽) straddling floor cable crossings
  const buildCableProtectorRamp = (rx: number, rz: number, rotY: number) => {
    const ramp = new THREE.Group();
    ramp.position.set(rx, -3.20, rz);
    ramp.rotation.y = rotY;
    // Beveled dark vulcanized rubber body
    const base = new THREE.Mesh(createBeveledSlab(0.92, 0.036, 0.30, 0.018, 0.010), rampRubberMat);
    base.position.y = 0.018;
    base.receiveShadow = true;
    outlines.addOutline(base, 1.022);
    ramp.add(base);
    // High-visibility hazard yellow hinged top channel lid with anti-slip ribs
    const lid = new THREE.Mesh(createBeveledBox(0.86, 0.012, 0.145, 0.003, 1), rampYellowMat);
    lid.position.y = 0.039;
    ramp.add(lid);
    for (let r = -3; r <= 3; r++) {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.005, 0.125), rampRubberMat);
      tread.position.set(r * 0.11, 0.046, 0);
      ramp.add(tread);
    }
    group.add(ramp);
  };
  buildCableProtectorRamp(-5.65, -3.84, 0.28);
  buildCableProtectorRamp(-0.80, -3.86, -0.34);

  // =========================================================================
  // 6D. HEAVY INDUSTRIAL WOOD WORKBENCH + DIY MINI LATHE (简易车床工作台)
  //     Positioned in the empty space left of the Experimental Terminal:
  //     X = -1.92, Y = -3.20, Z = -5.42 (tabletop topY = 0.84 -> world Y = -2.36)
  // =========================================================================
  const latheBenchX = -1.92;
  const latheBenchY = -3.20;
  const latheBenchZ = -5.42;
  const latheBenchW = 2.04;
  const latheBenchD = 0.94;
  const latheTopY = 0.84;

  const benchWoodTex = createScarredWorkbenchWoodTexture();
  const castIronDarkTex = createRustyCastIronTexture('#323740', 0.52);
  const castIronGreenTex = createRustyCastIronTexture('#3b4e4a', 0.58);
  const rustSteelTex = createRustyCastIronTexture('#4d3b33', 0.82);

  const benchPlankMat = mat({
    map: benchWoodTex.map,
    bumpMap: benchWoodTex.bumpMap,
    bumpScale: 0.022,
    color: 0xc8a484,
    roughness: 0.82,
    metalness: 0.03,
  });
  const benchPlankAltMat = mat({
    map: benchWoodTex.map,
    bumpMap: benchWoodTex.bumpMap,
    bumpScale: 0.024,
    color: 0xb68f6f,
    roughness: 0.86,
    metalness: 0.03,
  });
  const rustedAngleIronMat = mat({
    map: rustSteelTex.map,
    bumpMap: rustSteelTex.bumpMap,
    bumpScale: 0.026,
    color: 0x7a594c,
    roughness: 0.84,
    metalness: 0.68,
  });
  const castIronBodyMat = mat({
    map: castIronDarkTex.map,
    bumpMap: castIronDarkTex.bumpMap,
    bumpScale: 0.026,
    color: 0x565d68,
    roughness: 0.78,
    metalness: 0.72,
  });
  const chippedEnamelLatheMat = mat({
    map: castIronGreenTex.map,
    bumpMap: castIronGreenTex.bumpMap,
    bumpScale: 0.022,
    color: 0x627c74,
    roughness: 0.68,
    metalness: 0.54,
  });
  const machinedSteelMat = mat({
    map: textures.roughMetal,
    bumpMap: textures.roughMetalBump,
    bumpScale: 0.010,
    color: 0xaab4c2,
    roughness: 0.30,
    metalness: 0.86,
  });
  const latheMotorBlueMat = mat({
    map: castIronDarkTex.map,
    bumpMap: castIronDarkTex.bumpMap,
    bumpScale: 0.020,
    color: 0x425b70,
    roughness: 0.66,
    metalness: 0.60,
  });
  const vBeltRubberMat = mat({ color: 0x1b1c22, roughness: 0.88, metalness: 0.08 });
  const oilCanRedMat = mat({
    map: rustSteelTex.map,
    bumpMap: rustSteelTex.bumpMap,
    bumpScale: 0.014,
    color: 0xb64234,
    roughness: 0.52,
    metalness: 0.44,
  });
  const chiselHandleWoodMat = mat({ color: 0x9c6b43, roughness: 0.68, metalness: 0.02 });
  const freshWoodTurnedMat = mat({ color: 0xd9b07e, roughness: 0.58, metalness: 0.02 });
  const roughStockWoodMat = mat({ color: 0x6f4b32, roughness: 0.88, metalness: 0.02 });
  const shavingWoodMat = mat({ color: 0xdab47e, roughness: 0.76, metalness: 0.02 });
  const ironFilingMat = mat({ color: 0x5c6678, roughness: 0.38, metalness: 0.86 });
  const oilRagMat = mat({ color: 0x6a635e, roughness: 0.94, metalness: 0.0 });
  const latheToolboxRedMat = mat({
    map: rustSteelTex.map,
    bumpMap: rustSteelTex.bumpMap,
    bumpScale: 0.020,
    color: 0x8f3732,
    roughness: 0.66,
    metalness: 0.52,
  });
  const latheShadeEnamelMat = mat({ color: 0x2d3c37, roughness: 0.42, metalness: 0.56 });

  const latheBenchRig = new THREE.Group();
  latheBenchRig.name = 'BasementWoodLatheWorkbench';
  latheBenchRig.position.set(latheBenchX, latheBenchY, latheBenchZ);

  // --- 1. Heavy Spliced Wooden Plank Tabletop + Rusted Angle-Iron Perimeter Frame ---
  const plankCount = 4;
  const plankThick = 0.068;
  const plankGap = 0.004;
  const singlePlankD = (latheBenchD - 0.032 - plankGap * (plankCount - 1)) / plankCount;
  for (let p = 0; p < plankCount; p++) {
    const pz = -latheBenchD * 0.5 + 0.016 + singlePlankD * 0.5 + p * (singlePlankD + plankGap);
    const plank = new THREE.Mesh(
      createBeveledBox(latheBenchW - 0.028, plankThick, singlePlankD, 0.006, 1),
      p % 2 === 0 ? benchPlankMat : benchPlankAltMat
    );
    plank.position.set(0, latheTopY - plankThick * 0.5, pz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    outlines.addOutline(plank, 1.014);
    latheBenchRig.add(plank);
  }

  // Subtle dark wet machine-oil slick directly beneath the lathe chuck & tool post
  const tabletopOilSlick = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 18),
    mat({ color: 0x1b1819, roughness: 0.30, metalness: 0.14, transparent: true, opacity: 0.56 })
  );
  tabletopOilSlick.rotation.x = -Math.PI * 0.5;
  tabletopOilSlick.scale.set(1.45, 0.78, 1);
  tabletopOilSlick.position.set(-0.18, latheTopY + 0.0015, 0.04);
  latheBenchRig.add(tabletopOilSlick);

  // Rusted L-Angle Iron Perimeter Edging (front/back/left/right lips + vertical skirts)
  const angleLipH = 0.010;
  const angleSideH = 0.076;
  const angleThick = 0.012;
  for (const sz of [-1, 1]) {
    const edgeVert = new THREE.Mesh(
      createBeveledBox(latheBenchW + 0.008, angleSideH, angleThick, 0.002, 1),
      rustedAngleIronMat
    );
    edgeVert.position.set(0, latheTopY - angleSideH * 0.5 + 0.004, sz * (latheBenchD * 0.5 - angleThick * 0.5));
    edgeVert.castShadow = true;
    outlines.addOutline(edgeVert, 1.018);
    latheBenchRig.add(edgeVert);

    const edgeTopLip = new THREE.Mesh(
      new THREE.BoxGeometry(latheBenchW + 0.008, angleLipH, 0.032),
      rustedAngleIronMat
    );
    edgeTopLip.position.set(0, latheTopY + 0.002, sz * (latheBenchD * 0.5 - 0.016));
    latheBenchRig.add(edgeTopLip);
  }
  for (const sx of [-1, 1]) {
    const sideVert = new THREE.Mesh(
      createBeveledBox(angleThick, angleSideH, latheBenchD, 0.002, 1),
      rustedAngleIronMat
    );
    sideVert.position.set(sx * (latheBenchW * 0.5 - angleThick * 0.5), latheTopY - angleSideH * 0.5 + 0.004, 0);
    sideVert.castShadow = true;
    outlines.addOutline(sideVert, 1.018);
    latheBenchRig.add(sideVert);

    const sideTopLip = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, angleLipH, latheBenchD),
      rustedAngleIronMat
    );
    sideTopLip.position.set(sx * (latheBenchW * 0.5 - 0.016), latheTopY + 0.002, 0);
    latheBenchRig.add(sideTopLip);
  }
  // Hex rivets along the front rusted angle-iron edge
  for (let bx = -0.88; bx <= 0.89; bx += 0.22) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.014, 6), ironMat);
    bolt.rotation.x = Math.PI * 0.5;
    bolt.position.set(bx, latheTopY - 0.032, latheBenchD * 0.5 + 0.003);
    latheBenchRig.add(bolt);
  }

  // --- 2. Rusted Heavy Steel Leg Frame, Cross-Bracing & Lower Storage Shelf ---
  const legH = latheTopY - plankThick;
  const legOffsetX = latheBenchW * 0.5 - 0.085;
  const legOffsetZ = latheBenchD * 0.5 - 0.085;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(
        createBeveledBox(0.062, legH, 0.062, 0.006, 1),
        rustedAngleIronMat
      );
      leg.position.set(sx * legOffsetX, legH * 0.5, sz * legOffsetZ);
      leg.castShadow = true;
      leg.receiveShadow = true;
      outlines.addOutline(leg, 1.028);
      latheBenchRig.add(leg);

      // Bolted floor footplate
      const foot = new THREE.Mesh(createBeveledBox(0.115, 0.014, 0.115, 0.003, 1), ironMat);
      foot.position.set(sx * legOffsetX, 0.007, sz * legOffsetZ);
      latheBenchRig.add(foot);
    }

    // Side structural steel rails + diagonal gusset brace
    for (const ry of [0.22, latheTopY - 0.11]) {
      const sideRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.044, legOffsetZ * 2),
        rustedAngleIronMat
      );
      sideRail.position.set(sx * legOffsetX, ry, 0);
      latheBenchRig.add(sideRail);
    }
    const diagBrace = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.028, 0.92),
      rustedAngleIronMat
    );
    diagBrace.position.set(sx * legOffsetX, 0.48, 0);
    diagBrace.rotation.x = 0.58 * sx;
    latheBenchRig.add(diagBrace);
  }
  // Front & back lower steel stretchers + upper apron rail
  for (const sz of [-1, 1]) {
    const lowRail = new THREE.Mesh(
      new THREE.BoxGeometry(legOffsetX * 2, 0.044, 0.036),
      rustedAngleIronMat
    );
    lowRail.position.set(0, 0.22, sz * legOffsetZ);
    latheBenchRig.add(lowRail);
  }
  const backApron = new THREE.Mesh(
    new THREE.BoxGeometry(legOffsetX * 2, 0.085, 0.032),
    rustedAngleIronMat
  );
  backApron.position.set(0, latheTopY - 0.11, -legOffsetZ);
  latheBenchRig.add(backApron);

  // Slatted worn timber lower storage shelf (y = 0.242)
  const shelfY = 0.242;
  for (let sp = 0; sp < 4; sp++) {
    const slat = new THREE.Mesh(
      createBeveledBox(legOffsetX * 2 - 0.06, 0.026, 0.165, 0.004, 1),
      sp % 2 === 0 ? benchPlankAltMat : benchPlankMat
    );
    slat.position.set(0, shelfY, -0.275 + sp * 0.183);
    slat.receiveShadow = true;
    latheBenchRig.add(slat);
  }

  // --- 3. Under-Bench Clutter: Old Battered Toolbox, Messy Cables, Stock Rods & Parts ---
  // Battered rusty-red metal toolbox tucked slightly askew on left lower shelf
  const underToolbox = new THREE.Group();
  underToolbox.position.set(-0.50, shelfY + 0.013, 0.06);
  underToolbox.rotation.y = 0.24;
  const tbBody = new THREE.Mesh(createBeveledBox(0.46, 0.175, 0.23, 0.008, 1), latheToolboxRedMat);
  tbBody.position.y = 0.088;
  tbBody.castShadow = true;
  outlines.addOutline(tbBody, 1.030);
  underToolbox.add(tbBody);
  // Slightly propped hinged lid so tools peek out
  const tbLid = new THREE.Mesh(createBeveledBox(0.468, 0.045, 0.236, 0.008, 1), latheToolboxRedMat);
  tbLid.position.set(0, 0.196, -0.022);
  tbLid.rotation.x = -0.22;
  outlines.addOutline(tbLid, 1.032);
  underToolbox.add(tbLid);
  const tbHandle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.022), ironMat);
  tbHandle.position.set(0, 0.238, -0.03);
  tbHandle.rotation.x = -0.22;
  underToolbox.add(tbHandle);
  // Steel wrench & red-grip pliers sticking out of ajar toolbox
  const tbWrench = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.010, 0.026), machinedSteelMat);
  tbWrench.position.set(0.12, 0.176, 0.085);
  tbWrench.rotation.set(0.08, 0.42, 0.05);
  underToolbox.add(tbWrench);
  const tbPlierGrip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.022), oilCanRedMat);
  tbPlierGrip.position.set(-0.11, 0.175, 0.092);
  tbPlierGrip.rotation.set(0.06, -0.35, 0.04);
  underToolbox.add(tbPlierGrip);
  latheBenchRig.add(underToolbox);

  // Messy coiled scrap cables on center lower shelf & spilling onto concrete floor beneath
  for (let coil = 0; coil < 4; coil++) {
    const cTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.125 + (coil % 2) * 0.024, 0.011, 7, 20),
      coil === 2 ? rubberCableOrangeMat : rubberCableBlackMat
    );
    cTorus.rotation.set(Math.PI * 0.5 + (coil - 1.5) * 0.07, 0.15 * coil, 0.10 * coil);
    cTorus.position.set(0.04 + (coil % 2) * 0.03, shelfY + 0.026 + coil * 0.017, 0.10 - (coil % 2) * 0.04);
    latheBenchRig.add(cTorus);
  }
  // Stray cable tail draping off the shelf down onto the concrete floor
  const underSpillCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.08, shelfY + 0.04, 0.14),
    new THREE.Vector3(0.14, shelfY + 0.01, 0.34),
    new THREE.Vector3(0.10, 0.08, 0.38),
    new THREE.Vector3(-0.08, 0.015, 0.28),
    new THREE.Vector3(-0.24, 0.015, 0.36),
  ]);
  const underSpillCable = new THREE.Mesh(
    new THREE.TubeGeometry(underSpillCurve, 26, 0.010, 7, false),
    rubberCableBlackMat
  );
  latheBenchRig.add(underSpillCable);

  // Spare parts plastic crate + bundle of raw turning stock bars on right lower shelf
  const sparePartsBin = new THREE.Mesh(
    createBeveledBox(0.32, 0.155, 0.24, 0.008, 1),
    turnoverCrateBlueMat
  );
  sparePartsBin.position.set(0.56, shelfY + 0.09, -0.06);
  sparePartsBin.rotation.y = -0.18;
  outlines.addOutline(sparePartsBin, 1.032);
  latheBenchRig.add(sparePartsBin);
  // Spare gears & iron collars sticking out of the crate
  for (let sg = 0; sg < 3; sg++) {
    const spareGear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042 - sg * 0.006, 0.042 - sg * 0.006, 0.018, 14),
      sg === 1 ? brassMat : castIronBodyMat
    );
    spareGear.position.set(0.50 + sg * 0.055, shelfY + 0.17, -0.08 + sg * 0.03);
    spareGear.rotation.set(0.45 + sg * 0.3, 0.2, 0.55);
    latheBenchRig.add(spareGear);
  }
  // Raw wood dowels & steel round stock rods stacked on shelf front-right
  const stockSpecs: [number, number, number, number, THREE.Material][] = [
    [0.54, 0.16, 0.019, 0.54, roughStockWoodMat],
    [0.56, 0.20, 0.017, 0.50, roughStockWoodMat],
    [0.52, 0.24, 0.014, 0.48, rustedAngleIronMat],
    [0.55, 0.27, 0.011, 0.44, brassMat],
  ];
  for (const [sx, sz, srad, slen, smat] of stockSpecs) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(srad, srad, slen, 10), smat);
    rod.rotation.z = Math.PI * 0.5;
    rod.rotation.y = (sz - 0.20) * 0.45;
    rod.position.set(sx, shelfY + 0.013 + srad, sz);
    latheBenchRig.add(rod);
  }

  // Small dented scrap bucket under front-left corner filled with shavings
  const scrapBucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.125, 0.095, 0.195, 14),
    galvDuctMat
  );
  scrapBucket.position.set(-0.74, 0.098, 0.14);
  outlines.addOutline(scrapBucket, 1.030);
  latheBenchRig.add(scrapBucket);
  const bucketShavingsMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.112, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    shavingWoodMat
  );
  bucketShavingsMound.scale.set(1, 0.52, 1);
  bucketShavingsMound.position.set(-0.74, 0.168, 0.14);
  latheBenchRig.add(bucketShavingsMound);

  // --- 4. DIY / HOMEMADE MINI LATHE (简易手作车床) BOLTED ON TABLETOP ---
  const latheGroup = new THREE.Group();
  latheGroup.position.set(-0.16, latheTopY, 0.02);

  // Reusable spoked manual handwheel builder (rim + 3 spokes + hub + offset crank handle)
  const buildSpokedHandwheel = (
    radius: number,
    axis: 'x' | 'z',
    dir: 1 | -1
  ): THREE.Group => {
    const hw = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.14, 8, 18), castIronBodyMat);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.24, radius * 0.26, radius * 0.34, 10),
      machinedSteelMat
    );
    hub.rotation.x = Math.PI * 0.5;
    hw.add(rim, hub);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3;
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.075, radius * 0.085, radius * 1.72, 6),
        castIronBodyMat
      );
      spoke.position.set(Math.cos(a) * radius * 0.46, Math.sin(a) * radius * 0.46, 0);
      spoke.rotation.z = a - Math.PI * 0.5;
      spoke.scale.y = 0.52;
      hw.add(spoke);
    }
    const crank = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.11, radius * 0.09, radius * 0.72, 8),
      chiselHandleWoodMat
    );
    crank.rotation.x = Math.PI * 0.5;
    crank.position.set(radius * 0.86, 0, dir * radius * 0.42);
    hw.add(crank);
    if (axis === 'x') {
      hw.rotation.y = Math.PI * 0.5;
    }
    return hw;
  };

  // Shallow sheet-metal chip tray bolted beneath the lathe bed
  const chipTray = new THREE.Mesh(createBeveledBox(1.14, 0.014, 0.34, 0.003, 1), rustedAngleIronMat);
  chipTray.position.set(-0.02, 0.007, 0.01);
  chipTray.receiveShadow = true;
  outlines.addOutline(chipTray, 1.018);
  latheGroup.add(chipTray);

  // Cast-iron bed feet (left & right pedestals bolted to timber top)
  for (const fx of [-0.46, 0.42]) {
    const bedFoot = new THREE.Mesh(createBeveledBox(0.18, 0.056, 0.20, 0.008, 1), castIronBodyMat);
    bedFoot.position.set(fx, 0.042, 0);
    bedFoot.castShadow = true;
    outlines.addOutline(bedFoot, 1.030);
    latheGroup.add(bedFoot);
    for (const bz of [-0.082, 0.082]) {
      const lagBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.014, 6), ironMat);
      lagBolt.position.set(fx, 0.072, bz);
      latheGroup.add(lagBolt);
    }
  }

  // Ribbed cast-iron lathe bed + twin bright machined steel guide ways (床身与双导轨)
  const bedSpine = new THREE.Mesh(createBeveledBox(1.04, 0.064, 0.145, 0.008, 1), chippedEnamelLatheMat);
  bedSpine.position.set(-0.02, 0.096, 0);
  bedSpine.castShadow = true;
  bedSpine.receiveShadow = true;
  outlines.addOutline(bedSpine, 1.022);
  latheGroup.add(bedSpine);
  for (const wz of [-0.048, 0.048]) {
    const bedWay = new THREE.Mesh(createBeveledBox(1.03, 0.020, 0.028, 0.004, 1), machinedSteelMat);
    bedWay.position.set(-0.02, 0.136, wz);
    bedWay.castShadow = true;
    latheGroup.add(bedWay);
  }

  // Front threaded leadscrew (丝杠) + end bearing blocks
  const leadscrew = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.94, 10), machinedSteelMat);
  leadscrew.rotation.z = Math.PI * 0.5;
  leadscrew.position.set(0.01, 0.088, 0.095);
  latheGroup.add(leadscrew);
  for (const bx of [-0.46, 0.48]) {
    const lsBlock = new THREE.Mesh(createBeveledBox(0.028, 0.042, 0.044, 0.004, 1), castIronBodyMat);
    lsBlock.position.set(bx, 0.090, 0.092);
    latheGroup.add(lsBlock);
  }

  const spindleY = 0.258;

  // Rusted / Chipped-Enamel Headstock (主轴箱) on left end
  const headstock = new THREE.Mesh(
    createBeveledBox(0.225, 0.215, 0.185, 0.014, 2),
    chippedEnamelLatheMat
  );
  headstock.position.set(-0.415, 0.248, 0);
  headstock.castShadow = true;
  headstock.receiveShadow = true;
  outlines.addOutline(headstock, 1.028);
  latheGroup.add(headstock);

  // Bolted front gear inspection cover + aluminum speed-ratio nameplate + brass oil cup
  const gearPlate = new THREE.Mesh(createBeveledBox(0.145, 0.115, 0.014, 0.004, 1), castIronBodyMat);
  gearPlate.position.set(-0.415, 0.238, 0.096);
  latheGroup.add(gearPlate);
  const speedTag = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.036, 0.004), machinedSteelMat);
  speedTag.position.set(-0.415, 0.268, 0.104);
  latheGroup.add(speedTag);
  const oilCup = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.008, 0.024, 8), brassMat);
  oilCup.position.set(-0.375, 0.366, 0.015);
  latheGroup.add(oilCup);
  const redSwitchLever = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.044, 8), oilCanRedMat);
  redSwitchLever.position.set(-0.455, 0.205, 0.112);
  redSwitchLever.rotation.x = 0.65;
  latheGroup.add(redSwitchLever);

  // Main horizontal steel spindle shaft passing through headstock
  const spindleShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.34, 12),
    machinedSteelMat
  );
  spindleShaft.rotation.z = Math.PI * 0.5;
  spindleShaft.position.set(-0.42, spindleY, 0);
  latheGroup.add(spindleShaft);

  // 3-Step Cast-Iron V-Belt Pulley on left exterior of headstock (x = -0.565)
  const pulleyX = -0.568;
  for (const [ox, pr] of [
    [-0.018, 0.044],
    [0.0, 0.056],
    [0.018, 0.068],
  ] as const) {
    const stepPulley = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, 0.015, 18), castIronBodyMat);
    stepPulley.rotation.z = Math.PI * 0.5;
    stepPulley.position.set(pulleyX + ox, spindleY, 0);
    stepPulley.castShadow = true;
    outlines.addOutline(stepPulley, 1.032);
    latheGroup.add(stepPulley);
  }

  // External Vintage Single-Phase Motor behind headstock + Exposed V-Belt Loop (外接马达与裸露皮带)
  const motorPos = new THREE.Vector3(-0.45, 0.108, -0.255);
  const motorMountPlate = new THREE.Mesh(
    createBeveledBox(0.22, 0.018, 0.18, 0.004, 1),
    rustedAngleIronMat
  );
  motorMountPlate.position.set(motorPos.x, 0.018, motorPos.z);
  latheGroup.add(motorMountPlate);
  const motorBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.072, 0.185, 16),
    latheMotorBlueMat
  );
  motorBody.rotation.z = Math.PI * 0.5;
  motorBody.position.copy(motorPos);
  motorBody.castShadow = true;
  outlines.addOutline(motorBody, 1.028);
  latheGroup.add(motorBody);
  // Motor cooling fins
  for (let mf = 0; mf < 10; mf++) {
    const ang = (mf / 10) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.008, 0.018), castIronBodyMat);
    fin.position.set(
      motorPos.x,
      motorPos.y + Math.sin(ang) * 0.073,
      motorPos.z + Math.cos(ang) * 0.073
    );
    fin.rotation.x = -ang;
    latheGroup.add(fin);
  }
  // Top start-capacitor cylinder & wiring junction box on motor
  const motorCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.088, 10), castIronBodyMat);
  motorCap.rotation.z = Math.PI * 0.5;
  motorCap.position.set(motorPos.x + 0.01, motorPos.y + 0.086, motorPos.z - 0.012);
  latheGroup.add(motorCap);
  const motorTermBox = new THREE.Mesh(createBeveledBox(0.056, 0.044, 0.052, 0.004, 1), ironMat);
  motorTermBox.position.set(motorPos.x + 0.04, motorPos.y + 0.064, motorPos.z - 0.056);
  latheGroup.add(motorTermBox);
  // Motor shaft & aluminum drive pulley aligned at x = pulleyX
  const motorShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.12, 10), machinedSteelMat);
  motorShaft.rotation.z = Math.PI * 0.5;
  motorShaft.position.set(-0.55, motorPos.y, motorPos.z);
  latheGroup.add(motorShaft);
  const motorPulley = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.026, 16), machinedSteelMat);
  motorPulley.rotation.z = Math.PI * 0.5;
  motorPulley.position.set(pulleyX, motorPos.y, motorPos.z);
  outlines.addOutline(motorPulley, 1.036);
  latheGroup.add(motorPulley);

  // Exposed taut V-Belt loop wrapping around headstock pulley (0, spindleY) & motor pulley (motorPos.z, motorPos.y)
  const beltPts: THREE.Vector3[] = [];
  const p1Y = spindleY;
  const p1Z = 0;
  const r1 = 0.058;
  const p2Y = motorPos.y;
  const p2Z = motorPos.z;
  const r2 = 0.038;
  const beltAxisAng = Math.atan2(p1Y - p2Y, p1Z - p2Z);
  // Wrap around top/front arc of upper pulley
  for (let i = 0; i <= 7; i++) {
    const a = beltAxisAng - Math.PI * 0.55 + (i / 7) * Math.PI * 1.1;
    beltPts.push(new THREE.Vector3(pulleyX, p1Y + Math.sin(a) * r1, p1Z + Math.cos(a) * r1));
  }
  // Wrap around bottom/rear arc of motor pulley
  for (let i = 0; i <= 7; i++) {
    const a = beltAxisAng + Math.PI * 0.48 + (i / 7) * Math.PI * 1.04;
    beltPts.push(new THREE.Vector3(pulleyX, p2Y + Math.sin(a) * r2, p2Z + Math.cos(a) * r2));
  }
  const vBeltCurve = new THREE.CatmullRomCurve3(beltPts, true, 'centripetal', 0.35);
  const vBeltMesh = new THREE.Mesh(
    new THREE.TubeGeometry(vBeltCurve, 44, 0.0075, 6, true),
    vBeltRubberMat
  );
  vBeltMesh.castShadow = true;
  outlines.addOutline(vBeltMesh, 1.05);
  latheGroup.add(vBeltMesh);

  // 3-Jaw Scroll Chuck (三爪卡盘) mounted on right side of headstock spindle
  const chuckX = -0.258;
  const chuckBody = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.066, 20), machinedSteelMat);
  chuckBody.rotation.z = Math.PI * 0.5;
  chuckBody.position.set(chuckX, spindleY, 0);
  chuckBody.castShadow = true;
  outlines.addOutline(chuckBody, 1.028);
  latheGroup.add(chuckBody);
  const chuckBackplate = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.062, 0.022, 16), castIronBodyMat);
  chuckBackplate.rotation.z = Math.PI * 0.5;
  chuckBackplate.position.set(chuckX - 0.042, spindleY, 0);
  latheGroup.add(chuckBackplate);
  for (let j = 0; j < 3; j++) {
    const ja = (j / 3) * Math.PI * 2 + 0.4;
    const jaw = new THREE.Mesh(createBeveledBox(0.046, 0.022, 0.036, 0.003, 1), ironMat);
    jaw.position.set(
      chuckX + 0.034,
      spindleY + Math.sin(ja) * 0.038,
      Math.cos(ja) * 0.038
    );
    jaw.rotation.x = -ja;
    latheGroup.add(jaw);
  }

  // Half-Machined Cylindrical Workpiece (加工到一半的圆木件: left half freshly turned & stepped, right half rough stock)
  const wpTurnedProfile = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.022, 0.0),
    new THREE.Vector2(0.022, 0.055),
    new THREE.Vector2(0.017, 0.062),
    new THREE.Vector2(0.017, 0.112),
    new THREE.Vector2(0.025, 0.122),
    new THREE.Vector2(0.025, 0.175),
    new THREE.Vector2(0.019, 0.180),
    new THREE.Vector2(0.025, 0.186),
    new THREE.Vector2(0.025, 0.210),
    new THREE.Vector2(0.001, 0.210),
  ];
  const wpTurnedGeo = new THREE.LatheGeometry(wpTurnedProfile, 18);
  wpTurnedGeo.rotateZ(-Math.PI * 0.5);
  const wpTurned = new THREE.Mesh(wpTurnedGeo, freshWoodTurnedMat);
  wpTurned.position.set(chuckX + 0.032, spindleY, 0);
  wpTurned.castShadow = true;
  outlines.addOutline(wpTurned, 1.032);
  latheGroup.add(wpTurned);

  // Un-turned thicker rough stock on the right half meeting the tailstock live center
  const wpRough = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.032, 0.165, 14), roughStockWoodMat);
  wpRough.rotation.z = Math.PI * 0.5;
  wpRough.position.set(chuckX + 0.312, spindleY, 0);
  wpRough.castShadow = true;
  outlines.addOutline(wpRough, 1.030);
  latheGroup.add(wpRough);

  // Carriage, Cross-Slide, Compound Rest & 4-Way Tool Post with Engaged Cutting Bit (刀架与车刀)
  const carriageX = -0.028;
  const saddle = new THREE.Mesh(createBeveledBox(0.165, 0.026, 0.185, 0.005, 1), castIronBodyMat);
  saddle.position.set(carriageX, 0.156, 0.012);
  saddle.castShadow = true;
  outlines.addOutline(saddle, 1.028);
  latheGroup.add(saddle);

  const apron = new THREE.Mesh(createBeveledBox(0.155, 0.088, 0.036, 0.005, 1), chippedEnamelLatheMat);
  apron.position.set(carriageX, 0.106, 0.102);
  outlines.addOutline(apron, 1.030);
  latheGroup.add(apron);

  const crossSlide = new THREE.Mesh(createBeveledBox(0.088, 0.026, 0.185, 0.004, 1), castIronBodyMat);
  crossSlide.position.set(carriageX, 0.182, 0.036);
  latheGroup.add(crossSlide);

  const compoundRest = new THREE.Mesh(createBeveledBox(0.068, 0.024, 0.115, 0.004, 1), machinedSteelMat);
  compoundRest.position.set(carriageX, 0.207, 0.056);
  compoundRest.rotation.y = 0.34;
  latheGroup.add(compoundRest);

  const toolPost = new THREE.Mesh(createBeveledBox(0.058, 0.052, 0.058, 0.004, 1), castIronBodyMat);
  toolPost.position.set(carriageX, 0.244, 0.062);
  toolPost.castShadow = true;
  outlines.addOutline(toolPost, 1.036);
  latheGroup.add(toolPost);

  // Top clamping handle on tool post + square HSS cutting tool bit touching the workpiece shoulder
  const postClampBar = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.095, 8), machinedSteelMat);
  postClampBar.rotation.z = Math.PI * 0.5;
  postClampBar.position.set(carriageX, 0.278, 0.062);
  latheGroup.add(postClampBar);
  const engagedBit = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.088), machinedSteelMat);
  engagedBit.position.set(carriageX - 0.014, spindleY - 0.004, 0.036);
  engagedBit.rotation.y = -0.18;
  latheGroup.add(engagedBit);

  // Handwheel #1 (Carriage front traverse) & Handwheel #2 (Cross-slide feed)
  const apronWheel = buildSpokedHandwheel(0.044, 'z', 1);
  apronWheel.position.set(carriageX - 0.044, 0.102, 0.132);
  latheGroup.add(apronWheel);
  const crossWheel = buildSpokedHandwheel(0.032, 'z', 1);
  crossWheel.position.set(carriageX, 0.182, 0.148);
  latheGroup.add(crossWheel);

  // Cast-Iron Tailstock (尾座) with Quill, Live Center & Handwheel #3 on right side
  const tailX = 0.305;
  const tailBase = new THREE.Mesh(createBeveledBox(0.175, 0.036, 0.145, 0.006, 1), castIronBodyMat);
  tailBase.position.set(tailX, 0.162, 0);
  latheGroup.add(tailBase);
  const tailBody = new THREE.Mesh(createBeveledBox(0.155, 0.115, 0.118, 0.012, 2), chippedEnamelLatheMat);
  tailBody.position.set(tailX + 0.008, 0.236, 0);
  tailBody.castShadow = true;
  outlines.addOutline(tailBody, 1.030);
  latheGroup.add(tailBody);
  // Locking lever with red ball knob
  const tailLever = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.068, 8), machinedSteelMat);
  tailLever.position.set(tailX, 0.214, 0.082);
  tailLever.rotation.x = 0.55;
  latheGroup.add(tailLever);
  const tailKnob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), oilCanRedMat);
  tailKnob.position.set(tailX, 0.242, 0.102);
  latheGroup.add(tailKnob);
  // Brushed steel tailstock quill + hardened conical live center meeting the rough workpiece tip
  const tailQuill = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.11, 12), machinedSteelMat);
  tailQuill.rotation.z = Math.PI * 0.5;
  tailQuill.position.set(tailX - 0.095, spindleY, 0);
  latheGroup.add(tailQuill);
  const liveCenter = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.038, 12), machinedSteelMat);
  liveCenter.rotation.z = Math.PI * 0.5;
  liveCenter.position.set(tailX - 0.165, spindleY, 0);
  latheGroup.add(liveCenter);
  // Handwheel #3 on right rear of tailstock
  const tailWheel = buildSpokedHandwheel(0.048, 'x', 1);
  tailWheel.position.set(tailX + 0.116, spindleY, 0);
  latheGroup.add(tailWheel);

  latheBenchRig.add(latheGroup);

  // --- 5. Scattered Tabletop Tools: Turning Chisels, Vernier Caliper, Oil Can, Rag & Shavings ---
  // 4 Assorted Lathe Turning Chisels / Cutting Tools (不同规格切削车刀) scattered right of lathe
  const chiselSpecs: [number, number, number, number, number][] = [
    [0.54, 0.04, 0.28, 0.22, 0.013],
    [0.62, 0.08, 0.32, -0.34, 0.015],
    [0.69, 0.00, 0.24, 0.62, 0.011],
    [0.46, -0.22, 0.27, 1.38, 0.012],
  ];
  for (const [cx, cz, totalLen, rotY, handleR] of chiselSpecs) {
    const ch = new THREE.Group();
    ch.position.set(cx, latheTopY + handleR, cz);
    ch.rotation.y = rotY;
    const hLen = totalLen * 0.48;
    const bLen = totalLen * 0.52;
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(handleR * 0.85, handleR, hLen, 10),
      chiselHandleWoodMat
    );
    handle.rotation.z = Math.PI * 0.5;
    handle.position.x = -bLen * 0.5;
    outlines.addOutline(handle, 1.045);
    ch.add(handle);
    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(handleR * 0.86, handleR * 0.86, 0.018, 10),
      brassMat
    );
    ferrule.rotation.z = Math.PI * 0.5;
    ferrule.position.x = -0.004;
    ch.add(ferrule);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(bLen, handleR * 0.46, handleR * 0.82),
      machinedSteelMat
    );
    blade.position.x = bLen * 0.5;
    ch.add(blade);
    latheBenchRig.add(ch);
  }

  // Vernier Caliper (游标卡尺) resting near front-right tabletop edge
  const caliper = new THREE.Group();
  caliper.position.set(0.56, latheTopY + 0.005, 0.28);
  caliper.rotation.y = -0.44;
  const calBeam = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.004, 0.016), machinedSteelMat);
  caliper.add(calBeam);
  const calFixedJaw = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.005, 0.068), machinedSteelMat);
  calFixedJaw.position.set(-0.112, 0, 0.026);
  caliper.add(calFixedJaw);
  const calSlideBody = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.007, 0.024), castIronBodyMat);
  calSlideBody.position.set(-0.036, 0.001, 0);
  caliper.add(calSlideBody);
  const calSlideJaw = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.005, 0.068), machinedSteelMat);
  calSlideJaw.position.set(-0.052, 0, 0.026);
  caliper.add(calSlideJaw);
  const calUpperJaw1 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.004, 0.028), machinedSteelMat);
  calUpperJaw1.position.set(-0.114, 0, -0.018);
  caliper.add(calUpperJaw1);
  const calUpperJaw2 = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.004, 0.028), machinedSteelMat);
  calUpperJaw2.position.set(-0.054, 0, -0.018);
  caliper.add(calUpperJaw2);
  latheBenchRig.add(caliper);

  // Vintage Red/Brass Pump Oil Can (润滑油罐) with curved nozzle on right tabletop
  const oilCan = new THREE.Group();
  oilCan.position.set(0.79, latheTopY, -0.18);
  oilCan.rotation.y = -0.65;
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.050, 0.105, 14), oilCanRedMat);
  canBody.position.y = 0.052;
  canBody.castShadow = true;
  outlines.addOutline(canBody, 1.036);
  oilCan.add(canBody);
  const canDome = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.042, 0.028, 14), oilCanRedMat);
  canDome.position.y = 0.118;
  oilCan.add(canDome);
  const canCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.018, 10), brassMat);
  canCollar.position.y = 0.140;
  oilCan.add(canCollar);
  const spoutCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.148, 0),
    new THREE.Vector3(0.018, 0.202, 0),
    new THREE.Vector3(0.064, 0.228, 0),
    new THREE.Vector3(0.098, 0.214, 0),
  ]);
  const canSpout = new THREE.Mesh(new THREE.TubeGeometry(spoutCurve, 14, 0.0042, 6, false), brassMat);
  oilCan.add(canSpout);
  const canHandle = new THREE.Mesh(new THREE.TorusGeometry(0.030, 0.0045, 6, 12, Math.PI * 1.15), ironMat);
  canHandle.position.set(-0.045, 0.068, 0);
  canHandle.rotation.z = Math.PI * 0.45;
  oilCan.add(canHandle);
  latheBenchRig.add(oilCan);

  // Chuck T-handle key + crumpled oily shop rag near front-left tabletop
  const chuckKeyShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.11, 8), machinedSteelMat);
  chuckKeyShaft.rotation.z = Math.PI * 0.5;
  chuckKeyShaft.rotation.y = 0.35;
  chuckKeyShaft.position.set(-0.62, latheTopY + 0.006, 0.28);
  latheBenchRig.add(chuckKeyShaft);
  const chuckKeyCross = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.085, 8), machinedSteelMat);
  chuckKeyCross.rotation.x = Math.PI * 0.5;
  chuckKeyCross.rotation.z = 0.35;
  chuckKeyCross.position.set(-0.67, latheTopY + 0.006, 0.26);
  latheBenchRig.add(chuckKeyCross);

  const oilyRag = new THREE.Mesh(createBeveledSlab(0.18, 0.020, 0.14, 0.025, 0.006), oilRagMat);
  oilyRag.position.set(-0.82, latheTopY + 0.010, 0.16);
  oilyRag.rotation.y = 0.48;
  outlines.addOutline(oilyRag, 1.032);
  latheBenchRig.add(oilyRag);

  // Splashed Curled Wood Shavings & Fine Iron Filings (InstancedMesh clusters around chuck, bed & tabletop)
  const woodShavingGeo = new THREE.TorusGeometry(0.014, 0.0038, 5, 8, Math.PI * 1.42);
  const woodShavingCount = 58;
  const woodShavingsInst = new THREE.InstancedMesh(woodShavingGeo, shavingWoodMat, woodShavingCount);
  let shSeed = 51729;
  const shRand = () => {
    shSeed = (shSeed * 1664525 + 1013904223) >>> 0;
    return shSeed / 0xffffffff;
  };
  for (let i = 0; i < woodShavingCount; i++) {
    const onFloor = i >= 48;
    const sx = onFloor
      ? -0.45 + shRand() * 0.72
      : -0.48 + shRand() * 0.86;
    const sz = onFloor
      ? 0.46 + shRand() * 0.26
      : -0.14 + shRand() * 0.46;
    const sy = onFloor ? 0.006 : latheTopY + (Math.abs(sx + 0.18) < 0.28 && Math.abs(sz - 0.02) < 0.14 ? 0.018 : 0.005);
    const sc = 0.65 + shRand() * 0.95;
    setInstanceTransform(
      woodShavingsInst,
      i,
      sx,
      sy,
      sz,
      shRand() * Math.PI,
      shRand() * Math.PI * 2,
      shRand() * Math.PI,
      sc,
      sc * 0.72,
      sc
    );
  }
  finalizeInstancedMesh(woodShavingsInst);
  latheBenchRig.add(woodShavingsInst);

  const ironFilingGeo = new THREE.BoxGeometry(0.014, 0.003, 0.005);
  const ironFilingCount = 68;
  const ironFilingsInst = new THREE.InstancedMesh(ironFilingGeo, ironFilingMat, ironFilingCount);
  for (let i = 0; i < ironFilingCount; i++) {
    const fx = -0.46 + shRand() * 1.06;
    const fz = -0.18 + shRand() * 0.50;
    const inTray = Math.abs(fx + 0.16) < 0.54 && Math.abs(fz - 0.02) < 0.15;
    const fy = latheTopY + (inTray ? 0.016 : 0.003);
    setInstanceTransform(
      ironFilingsInst,
      i,
      fx,
      fy,
      fz,
      (shRand() - 0.5) * 0.4,
      shRand() * Math.PI * 2,
      (shRand() - 0.5) * 0.4,
      0.55 + shRand() * 1.15,
      1,
      0.6 + shRand() * 0.9
    );
  }
  finalizeInstancedMesh(ironFilingsInst);
  latheBenchRig.add(ironFilingsInst);

  group.add(latheBenchRig);
  addBoxCollider('col_base_lathe_bench', latheBenchX, -2.72, latheBenchZ, latheBenchW + 0.06, 0.96, latheBenchD + 0.06);

  // --- 6. Electrical Linkage: External Wall Switch/Outlet Box + Messy Wires to Breaker Panel ---
  const outletBoxGroup = new THREE.Group();
  outletBoxGroup.position.set(-2.66, -2.02, -5.945);
  const outletEnclosure = new THREE.Mesh(createBeveledBox(0.165, 0.115, 0.058, 0.006, 1), rustedAngleIronMat);
  outletEnclosure.castShadow = true;
  outlines.addOutline(outletEnclosure, 1.036);
  outletBoxGroup.add(outletEnclosure);
  const outletFace = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.095, 0.010), ironMat);
  outletFace.position.z = 0.028;
  outletBoxGroup.add(outletFace);
  // Red rocker power switch + twin socket recesses + warm amber pilot indicator
  const outletSwitch = new THREE.Mesh(createBeveledBox(0.026, 0.042, 0.018, 0.003, 1), oilCanRedMat);
  outletSwitch.position.set(-0.044, 0.004, 0.036);
  outletSwitch.rotation.x = -0.25;
  outletBoxGroup.add(outletSwitch);
  const outletPilotMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
  const outletPilot = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), outletPilotMat);
  outletPilot.position.set(-0.044, -0.028, 0.034);
  outletPilot.userData.dynamic = true;
  outletBoxGroup.add(outletPilot);
  for (const sx of [0.008, 0.048]) {
    const socketFace = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), consoleCharcoalMat);
    socketFace.rotation.x = Math.PI * 0.5;
    socketFace.position.set(sx, 0, 0.032);
    outletBoxGroup.add(socketFace);
  }
  // Inserted heavy rubber plug for the lathe motor
  const lathePlug = new THREE.Mesh(createBeveledBox(0.032, 0.034, 0.042, 0.004, 1), rubberCableBlackMat);
  lathePlug.position.set(0.048, 0, 0.052);
  outletBoxGroup.add(lathePlug);
  group.add(outletBoxGroup);

  // Messy coiled cord from lathe external motor terminal box -> wall outlet plug
  buildWorldRubberCable(
    [
      [latheBenchX - 0.57, latheBenchY + latheTopY + 0.17, latheBenchZ - 0.30],
      [latheBenchX - 0.70, latheBenchY + latheTopY + 0.05, latheBenchZ - 0.44],
      [latheBenchX - 0.84, -2.38, -5.88],
      [-2.74, -2.26, -5.92],
      [-2.61, -2.02, -5.89],
    ],
    0.009,
    rubberCableBlackMat,
    30
  );

  // Messy electrical cables routed from the wall outlet box along North concrete wall -> NW Corner -> Breaker Panel (-9.16, -1.72, -2.60)
  buildWorldRubberCable(
    [
      [-2.74, -2.02, -5.94],
      [-3.55, -2.10, -5.95],
      [-4.68, -2.02, -5.95],
      [-5.92, -2.14, -5.95],
      [-7.25, -2.04, -5.95],
      [-8.55, -2.11, -5.94],
      [-9.14, -2.06, -5.86],
      [-9.15, -2.14, -4.60],
      [-9.15, -2.02, -3.45],
      [-9.14, -2.10, -2.66],
    ],
    0.013,
    rubberCableBlackMat,
    84
  );
  buildWorldRubberCable(
    [
      [-2.74, -2.05, -5.93],
      [-3.62, -2.16, -5.94],
      [-4.72, -2.06, -5.94],
      [-5.98, -2.20, -5.94],
      [-7.30, -2.09, -5.94],
      [-8.60, -2.16, -5.93],
      [-9.12, -2.11, -5.82],
      [-9.13, -2.20, -4.52],
      [-9.13, -2.08, -3.40],
      [-9.14, -2.14, -2.62],
    ],
    0.0085,
    rubberCableOrangeMat,
    84
  );
  // Small metal wall saddle clips holding the messy cables along the North wall
  for (const clipX of [-3.55, -4.68, -5.92, -7.25, -8.55]) {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.055, 0.022), ironMat);
    clip.position.set(clipX, -2.08, -5.97);
    group.add(clip);
  }

  // --- 7. Handwritten Machining Sketches & Sticky Notes on Concrete Wall Behind Lathe ---
  const latheNotesTex = createLatheSketchNotesTexture();
  const latheNotesPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.58),
    mat({
      map: latheNotesTex,
      transparent: true,
      alphaTest: 0.05,
      roughness: 0.88,
      metalness: 0.0,
    })
  );
  latheNotesPlane.position.set(-1.74, -1.78, -5.982);
  group.add(latheNotesPlane);

  // Subtle dark workshop grime & oil splatter stain on concrete wall directly behind the lathe
  const wallOilSplatter = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 20),
    mat({ color: 0x26242b, roughness: 0.94, metalness: 0.02, transparent: true, opacity: 0.34 })
  );
  wallOilSplatter.scale.set(1.55, 0.72, 1);
  wallOilSplatter.position.set(-2.02, -2.14, -5.988);
  group.add(wallOilSplatter);

  // --- 8. Hanging Explosion-Proof Wire-Cage Task Pendant Lamp with Pull-Chain (工况小吊灯) ---
  const taskLampRig = new THREE.Group();
  const taskLampX = -1.96;
  const taskLampZ = -5.32;
  taskLampRig.position.set(taskLampX, -0.45, taskLampZ);

  const tlRose = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.036, 12), ironMat);
  tlRose.position.y = -0.018;
  taskLampRig.add(tlRose);

  // Braided black drop cord down to localized machine-shop task height (Y = -1.42)
  const tlCord = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.82, 8), rubberCableBlackMat);
  tlCord.position.y = -0.44;
  taskLampRig.add(tlCord);

  // Cast socket neck + compact flared enamel industrial shade
  const tlNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.095, 12), rustedAngleIronMat);
  tlNeck.position.y = -0.88;
  outlines.addOutline(tlNeck, 1.036);
  taskLampRig.add(tlNeck);

  const tlShade = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.044, 0.078),
        new THREE.Vector2(0.098, 0.056),
        new THREE.Vector2(0.172, 0.0),
        new THREE.Vector2(0.158, -0.006),
        new THREE.Vector2(0.068, 0.048),
      ],
      18
    ),
    latheShadeEnamelMat
  );
  tlShade.position.y = -0.985;
  tlShade.castShadow = true;
  outlines.addOutline(tlShade, 1.032);
  taskLampRig.add(tlShade);

  // Glowing warm tungsten bulb & explosion-proof glass dome (dynamic so breaker/pull-chain toggles it)
  const tlGlobeMat = new THREE.MeshBasicMaterial({
    color: 0xffe4b0,
    transparent: true,
    opacity: 0.76,
  });
  const tlGlobe = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.040, 0.112, 12), tlGlobeMat);
  tlGlobe.position.y = -1.035;
  tlGlobe.userData.dynamic = true;
  taskLampRig.add(tlGlobe);

  const tlCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
  const tlCore = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), tlCoreMat);
  tlCore.position.y = -1.035;
  tlCore.userData.dynamic = true;
  taskLampRig.add(tlCore);

  // 3D Wire-Guard Explosion-Proof Cage around the task bulb
  for (const [ry, rr] of [
    [-0.985, 0.064],
    [-1.050, 0.062],
    [-1.105, 0.048],
  ] as const) {
    const cRing = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.004, 6, 16), pendantGuardMat);
    cRing.rotation.x = Math.PI * 0.5;
    cRing.position.y = ry;
    taskLampRig.add(cRing);
  }
  for (let w = 0; w < 6; w++) {
    const a = (w / 6) * Math.PI * 2;
    const wc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.064, -0.978, Math.sin(a) * 0.064),
      new THREE.Vector3(Math.cos(a) * 0.062, -1.055, Math.sin(a) * 0.062),
      new THREE.Vector3(Math.cos(a) * 0.042, -1.108, Math.sin(a) * 0.042),
      new THREE.Vector3(Math.cos(a) * 0.012, -1.132, Math.sin(a) * 0.012),
    ]);
    taskLampRig.add(new THREE.Mesh(new THREE.TubeGeometry(wc, 10, 0.0036, 6, false), pendantGuardMat));
  }

  // Beaded Metal Pull-Chain Switch + Brass Acorn Pull Weight (开关拉绳)
  const pullChainCord = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.36, 6), brassMat);
  pullChainCord.position.set(0.054, -1.115, 0.032);
  taskLampRig.add(pullChainCord);
  for (let pb = 0; pb < 9; pb++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0044, 6, 6), brassMat);
    bead.position.set(0.054, -0.965 - pb * 0.038, 0.032);
    taskLampRig.add(bead);
  }
  const pullAcorn = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.011, 0.028, 8), brassMat);
  pullAcorn.position.set(0.054, -1.305, 0.032);
  outlines.addOutline(pullAcorn, 1.05);
  taskLampRig.add(pullAcorn);

  // Focused warm amber workshop PointLight illuminating only the lathe workbench zone
  const latheTaskLight = new THREE.PointLight(0xffcb84, 1.85, 5.2, 1.72);
  latheTaskLight.position.set(0, -1.14, 0.04);
  taskLampRig.add(latheTaskLight);
  group.add(taskLampRig);

  const latheTaskLampRig = registerCeilingLamp({
    id: 'lamp_base_lathe',
    room: 'basement',
    position: new THREE.Vector3(taskLampX, -1.56, taskLampZ),
    light: latheTaskLight,
    bulbMaterials: [tlCoreMat, tlGlobeMat],
    baseIntensity: 1.85,
    dimColorHex: 0x3b352c,
    proximityRadius: 3.4,
  });
  extraBasementLampRigs.push(latheTaskLampRig);

  // Interactable hit proxy over the lathe & pull-chain lamp
  const latheInteractProxy = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.92, 0.85),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  latheInteractProxy.position.set(latheBenchX, -2.02, latheBenchZ + 0.04);
  latheInteractProxy.userData.dynamic = true;
  group.add(latheInteractProxy);

  registerInteractable(
    'base_lathe',
    '手作简易车床工作台',
    '拉动工况吊灯 / 检查车床',
    'basement',
    latheInteractProxy,
    () => {
      if (!metaState.basementLightOn) {
        return {
          title: '手作简易车床工作台',
          message:
            '拉了拉防爆小吊灯的黄铜拉绳，但地下室总电闸已经断电。借着微光能看到卡盘上还夹着一根车削到一半的阶梯轴，台面上沾满机油与新鲜木屑。',
        };
      }
      latheTaskLampRig.userEnabled = !latheTaskLampRig.userEnabled;
      return {
        title: latheTaskLampRig.userEnabled ? '点亮车床工况小吊灯' : '关闭车床工况小吊灯',
        message: latheTaskLampRig.userEnabled
          ? '拉绳咔哒一声，铁丝网防爆小吊灯洒下暖黄光圈：这台自制简易车床用外接老马达和裸露皮带驱动，卡盘里还夹着车了一半的工件，墙上贴着标注 Ø24.0 的手绘尺寸草图。'
          : '拉绳轻响，车床正上方的防爆小吊灯熄灭，斑驳的木质工作台与生锈铸铁床身重新隐入地下室的昏暗之中。',
      };
    }
  );

  // Recessed Cast-Iron Metal Floor Drain directly beneath the North-Wall Vertical Water Pipe (-3.85, -3.196, -5.66)
  const floorDrain = new THREE.Group();
  floorDrain.position.set(-3.85, -3.196, -5.66);
  // Subtle damp darkened water ring around drain
  const dampRing = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 20),
    mat({ color: 0x3b3844, roughness: 0.42, metalness: 0.08, transparent: true, opacity: 0.45 })
  );
  dampRing.rotation.x = -Math.PI * 0.5;
  dampRing.position.y = 0.001;
  floorDrain.add(dampRing);
  const drainFrame = new THREE.Mesh(createBeveledBox(0.30, 0.014, 0.30, 0.004, 1), ironMat);
  drainFrame.position.y = 0.007;
  outlines.addOutline(drainFrame, 1.028);
  floorDrain.add(drainFrame);
  const drainSump = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), ductInteriorMat);
  drainSump.rotation.x = -Math.PI * 0.5;
  drainSump.position.y = 0.015;
  floorDrain.add(drainSump);
  for (let g = -3; g <= 3; g++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.008, 0.014), rackSteelMat);
    bar.position.set(0, 0.017, g * 0.034);
    floorDrain.add(bar);
  }
  group.add(floorDrain);

  // Corner Filler #1 (NW Corner): 2 Weathered Ribbed Industrial Steel Drums (旧铁桶)
  const buildSteelDrum = (dx: number, dz: number, dMat: THREE.Material, tiltY: number) => {
    const drum = new THREE.Group();
    drum.position.set(dx, -3.20, dz);
    drum.rotation.y = tiltY;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.86, 20), dMat);
    body.position.y = 0.43;
    body.castShadow = true;
    body.receiveShadow = true;
    outlines.addOutline(body, 1.020);
    drum.add(body);
    // Molded rolling hoops & top/bottom chimes
    for (const ry of [0.02, 0.28, 0.58, 0.84]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.288, 0.012, 8, 22), rackDarkIronMat);
      hoop.rotation.x = Math.PI * 0.5;
      hoop.position.y = ry;
      drum.add(hoop);
    }
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.289, 0.289, 0.16, 20), hazardYellowMat);
    stripe.position.y = 0.43;
    drum.add(stripe);
    // Bung caps on top lid
    const bung1 = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.024, 10), brassMat);
    bung1.position.set(0.12, 0.868, 0.04);
    drum.add(bung1);
    const bung2 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.022, 8), rackSteelMat);
    bung2.position.set(-0.14, 0.868, -0.05);
    drum.add(bung2);
    group.add(drum);
  };
  buildSteelDrum(-8.58, -5.32, drumBlueMat, 0.42);
  buildSteelDrum(-7.94, -5.46, drumOliveMat, -0.85);
  addBoxCollider('col_base_nw_drums', -8.26, -2.76, -5.38, 1.24, 0.90, 0.78);

  // Corner Filler #2 (SE Corner): Folding A-Frame Industrial Stepladder (折叠人字梯)
  const ladder = new THREE.Group();
  ladder.position.set(2.42, -3.20, -0.58);
  ladder.rotation.y = -0.62;
  const ladderH = 1.48;
  const ladderSpread = 0.22; // half-angle rad
  // Front & rear twin aluminum side rails
  for (const sx of [-0.21, 0.21]) {
    const frontRail = new THREE.Mesh(createBeveledBox(0.030, ladderH, 0.058, 0.005, 1), ladderAlumMat);
    frontRail.position.set(sx, ladderH * 0.485, 0.16);
    frontRail.rotation.x = -ladderSpread;
    frontRail.castShadow = true;
    outlines.addOutline(frontRail, 1.028);
    ladder.add(frontRail);

    const rearRail = new THREE.Mesh(createBeveledBox(0.026, ladderH, 0.042, 0.004, 1), ladderAlumMat);
    rearRail.position.set(sx, ladderH * 0.485, -0.16);
    rearRail.rotation.x = ladderSpread;
    rearRail.castShadow = true;
    ladder.add(rearRail);

    // Non-slip black rubber feet
    for (const fz of [-0.31, 0.31]) {
      const lFoot = new THREE.Mesh(createBeveledBox(0.038, 0.032, 0.064, 0.004, 1), rampRubberMat);
      lFoot.position.set(sx, 0.016, fz);
      ladder.add(lFoot);
    }
    // Side articulated locking spreader bar
    const spreader = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.018, 0.42), redValveMat);
    spreader.position.set(sx, 0.72, 0);
    ladder.add(spreader);
  }
  // 5 Ribbed non-slip horizontal treads climbing front rails
  for (let st = 0; st < 5; st++) {
    const t = (st + 1) / 5.4;
    const sy = t * 1.40;
    const sz = 0.31 * (1 - t);
    const step = new THREE.Mesh(createBeveledBox(0.41, 0.022, 0.088, 0.004, 1), ladderAlumMat);
    step.position.set(0, sy, sz);
    step.castShadow = true;
    ladder.add(step);
  }
  // Rear cross-bracing rungs + molded top paint/tool cap
  for (const ry of [0.36, 0.86]) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.40, 8), rackSteelMat);
    rung.rotation.z = Math.PI * 0.5;
    rung.position.set(0, ry, -0.23 + ry * 0.14);
    ladder.add(rung);
  }
  const topCap = new THREE.Mesh(createBeveledBox(0.46, 0.038, 0.18, 0.008, 2), redValveMat);
  topCap.position.set(0, 1.44, 0);
  outlines.addOutline(topCap, 1.03);
  ladder.add(topCap);
  group.add(ladder);
  addBoxCollider('col_base_ladder', 2.42, -2.46, -0.58, 0.68, 1.50, 0.68);

  // Corner Filler #3 (East Wall Mid-Zone & North Wall Under Exhaust Fan): Stacked Industrial Plastic Turnover Crates (塑料周转箱)
  const buildTurnoverCrate = (
    cx: number,
    cy: number,
    cz: number,
    rotY: number,
    cMat: THREE.Material,
    hasConduitInside = false
  ) => {
    const tc = new THREE.Group();
    tc.position.set(cx, cy, cz);
    tc.rotation.y = rotY;
    const w = 0.56;
    const h = 0.30;
    const d = 0.38;
    const floor = new THREE.Mesh(createBeveledBox(w, 0.022, d, 0.004, 1), cMat);
    floor.position.y = 0.011;
    tc.add(floor);
    for (const sz of [-1, 1]) {
      const wall = new THREE.Mesh(createBeveledBox(w, h, 0.022, 0.004, 1), cMat);
      wall.position.set(0, h * 0.5, sz * (d * 0.5 - 0.011));
      wall.castShadow = true;
      outlines.addOutline(wall, 1.022);
      tc.add(wall);
    }
    for (const sx of [-1, 1]) {
      const endWall = new THREE.Mesh(createBeveledBox(0.022, h, d, 0.004, 1), cMat);
      endWall.position.set(sx * (w * 0.5 - 0.011), h * 0.5, 0);
      endWall.castShadow = true;
      tc.add(endWall);
    }
    // Molded top stacking rim
    const rimF = new THREE.Mesh(createBeveledBox(w + 0.024, 0.026, d + 0.024, 0.005, 1), cMat);
    rimF.position.y = h - 0.010;
    tc.add(rimF);
    if (hasConduitInside) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 18), rubberCableOrangeMat);
      coil.rotation.x = Math.PI * 0.42;
      coil.position.set(-0.08, 0.14, 0);
      tc.add(coil);
      const sparePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.44, 10), pipeMat);
      sparePipe.rotation.set(0.15, 0.4, 1.12);
      sparePipe.position.set(0.10, 0.20, 0.02);
      tc.add(sparePipe);
    }
    group.add(tc);
  };
  // East wall stacked turnover crates (X = 2.48, Z = -2.35)
  buildTurnoverCrate(2.48, -3.20, -2.35, 1.48, turnoverCrateBlueMat, false);
  buildTurnoverCrate(2.46, -2.90, -2.32, 1.66, turnoverCrateAmberMat, true);
  addBoxCollider('col_base_east_crates', 2.48, -2.86, -2.34, 0.50, 0.68, 0.64);

  // North wall under exhaust fan intake (X = -4.96, Z = -5.52)
  buildTurnoverCrate(-4.96, -3.20, -5.52, 0.08, turnoverCrateBlueMat, false);
  buildTurnoverCrate(-4.92, -2.90, -5.50, -0.14, turnoverCrateBlueMat, true);
  addBoxCollider('col_base_north_crates', -4.94, -2.86, -5.51, 0.64, 0.68, 0.46);

  // =========================================================================
  // 7. COLLECTIBLE 2020s ADAPTER PARTS (For building the strange drive bridge)
  // =========================================================================
  const pcbGreenMat = mat({ color: 0x266b4e, roughness: 0.42, metalness: 0.15 });
  const goldPinMat = mat({ color: 0xebb955, roughness: 0.25, metalness: 0.88 });
  const cyanLedMat = new THREE.MeshBasicMaterial({ color: 0x52f2ff });
  const amberLedMat = new THREE.MeshBasicMaterial({ color: 0xffc052 });
  const diodeGlassMat = mat({ color: 0x99d9ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  const partHitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const partHitProxyGeo = new THREE.BoxGeometry(0.40, 0.24, 0.34);

  // Part 1: 2018 旧式 PCI-E 转接卡 (on Rack 1 middle shelf along staircase wall, facing -Z)
  const pcieGroup = new THREE.Group();
  pcieGroup.position.set(-4.13, -2.298, -0.33);
  pcieGroup.rotation.y = Math.PI + 0.28;
  pcieGroup.userData.dynamic = true;
  const pcieHitProxy = new THREE.Mesh(partHitProxyGeo, partHitProxyMat);
  pcieHitProxy.position.y = 0.08;
  pcieGroup.add(pcieHitProxy);
  const pcieTray = new THREE.Mesh(
    createBeveledBox(0.28, 0.016, 0.18, 0.005, 2),
    pcbGreenMat
  );
  pcieTray.position.y = 0.008;
  outlines.addOutline(pcieTray, 1.06);
  pcieGroup.add(pcieTray);
  const pcieFingers = new THREE.Mesh(
    createBeveledBox(0.16, 0.018, 0.028, 0.003, 2),
    goldPinMat
  );
  pcieFingers.position.set(0, 0.009, 0.088);
  pcieGroup.add(pcieFingers);
  const pcieChip = new THREE.Mesh(
    createBeveledBox(0.075, 0.022, 0.075, 0.004, 2),
    ironMat
  );
  pcieChip.position.set(-0.02, 0.022, -0.01);
  pcieGroup.add(pcieChip);
  const pcieLed = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), cyanLedMat);
  pcieLed.position.set(0.09, 0.024, 0.04);
  pcieGroup.add(pcieLed);
  group.add(pcieGroup);
  metaState.partMeshes['part_pcie_card'] = pcieGroup;

  registerInteractable(
    'part_pcie_card',
    '2018 旧式 PCI-E 转接卡',
    '拾取零件 (1/3)',
    'basement',
    pcieGroup,
    () => {
      pcieGroup.visible = false;
      metaState.collectedParts.add('part_pcie_card');
      return {
        title: '拾取零件：2018 旧式 PCI-E 转接卡',
        message:
          '一块没有 2042 审查熔断器（Watchdog）的二十年代老式转接卡。有了它，就能把学校捡到的钛合金圆柱体直连到卧室的老主机主板上。',
        collectPartId: 'part_pcie_card',
      };
    }
  );

  // Part 2: 高灵敏度光敏二极管 (on Rack 3 middle shelf along staircase wall, facing -Z)
  const diodeGroup = new THREE.Group();
  diodeGroup.position.set(-0.40, -2.298, -0.33);
  diodeGroup.rotation.y = Math.PI - 0.35;
  diodeGroup.userData.dynamic = true;
  const diodeHitProxy = new THREE.Mesh(partHitProxyGeo, partHitProxyMat);
  diodeHitProxy.position.y = 0.08;
  diodeGroup.add(diodeHitProxy);
  const diodeBox = new THREE.Mesh(
    createBeveledBox(0.22, 0.028, 0.16, 0.006, 2),
    crateMat
  );
  diodeBox.position.y = 0.014;
  outlines.addOutline(diodeBox, 1.06);
  diodeGroup.add(diodeBox);
  const diodeDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 14, 12),
    diodeGlassMat
  );
  diodeDome.position.set(0, 0.045, 0);
  diodeGroup.add(diodeDome);
  const diodeCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.032, 10),
    goldPinMat
  );
  diodeCore.position.set(0, 0.04, 0);
  diodeGroup.add(diodeCore);
  const diodeLed = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), amberLedMat);
  diodeLed.position.set(-0.07, 0.036, 0.05);
  diodeGroup.add(diodeLed);
  group.add(diodeGroup);
  metaState.partMeshes['part_photodiode'] = diodeGroup;

  registerInteractable(
    'part_photodiode',
    '高灵敏度光敏二极管',
    '拾取零件 (2/3)',
    'basement',
    diodeGroup,
    () => {
      diodeGroup.visible = false;
      metaState.collectedParts.add('part_photodiode');
      return {
        title: '拾取零件：高灵敏度光敏二极管',
        message:
          '拆机光电元件盒里翻出的高灵敏光敏接收头，刚好用来读取那枚钛合金玻璃柱内部泛着虹彩的磁光脉冲涂层。',
        collectPartId: 'part_photodiode',
      };
    }
  );

  // Part 3: 48MHz 时钟晶振与逻辑芯片 (flush on the front-center stainless experimental bench)
  const oscGroup = new THREE.Group();
  oscGroup.position.set(1.14, -2.360, -4.74);
  oscGroup.rotation.y = 0.22;
  oscGroup.userData.dynamic = true;
  const oscHitProxy = new THREE.Mesh(partHitProxyGeo, partHitProxyMat);
  oscHitProxy.position.y = 0.08;
  oscGroup.add(oscHitProxy);
  const oscBoard = new THREE.Mesh(
    createBeveledBox(0.20, 0.014, 0.14, 0.004, 2),
    pcbGreenMat
  );
  oscBoard.position.y = 0.007;
  outlines.addOutline(oscBoard, 1.06);
  oscGroup.add(oscBoard);
  const oscCan = new THREE.Mesh(
    createBeveledBox(0.065, 0.034, 0.042, 0.006, 2),
    rackSteelMat
  );
  oscCan.position.set(-0.03, 0.03, 0);
  oscGroup.add(oscCan);
  const oscIC = new THREE.Mesh(
    createBeveledBox(0.055, 0.018, 0.055, 0.004, 2),
    ironMat
  );
  oscIC.position.set(0.045, 0.022, -0.01);
  oscGroup.add(oscIC);
  const oscLed = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), cyanLedMat);
  oscLed.position.set(0.06, 0.025, 0.045);
  oscGroup.add(oscLed);
  group.add(oscGroup);
  metaState.partMeshes['part_oscillator'] = oscGroup;

  registerInteractable(
    'part_oscillator',
    '48MHz 时钟晶振与逻辑芯片',
    '拾取零件 (3/3)',
    'basement',
    oscGroup,
    () => {
      oscGroup.visible = false;
      metaState.collectedParts.add('part_oscillator');
      return {
        title: '拾取零件：48MHz 时钟晶振与逻辑芯片',
        message:
          '从老式 CRT 测试台边找到的 48MHz 晶振与通用逻辑芯片，正好能用来稳定那块奇怪硬盘内部的微米黄铜齿轮时序。',
        collectPartId: 'part_oscillator',
      };
    }
  );

  // Register collectible electronic parts for subtle tabletop micro-vibration
  registerAmbientProp({
    id: 'base_part_pcie',
    room: 'basement',
    mesh: pcieGroup,
    worldPos: [-4.13, -2.298, -0.33],
    kind: 'trinket',
    maxDrift: 0.020,
    reactivity: 1.08,
  });
  registerAmbientProp({
    id: 'base_part_photodiode',
    room: 'basement',
    mesh: diodeGroup,
    worldPos: [-0.40, -2.298, -0.33],
    kind: 'trinket',
    maxDrift: 0.020,
    reactivity: 1.08,
  });
  registerAmbientProp({
    id: 'base_part_oscillator',
    room: 'basement',
    mesh: oscGroup,
    worldPos: [1.14, -2.360, -4.74],
    kind: 'trinket',
    maxDrift: 0.022,
    reactivity: 1.14,
  });

  // =========================================================================
  // 11. MAINLINE STORY PICKUPS: 信物 (Keepsake) & 备用电池 (Battery)
  // =========================================================================
  // Quest Item 1: 银色心形信物 (Rack 2 middle shelf front lip, catching eye from the stairs)
  const keepsakeGroup = new THREE.Group();
  keepsakeGroup.position.set(-2.02, -2.298, -0.37);
  keepsakeGroup.rotation.y = 0.25;
  keepsakeGroup.userData.dynamic = true;
  const keepsakeHitProxy = new THREE.Mesh(partHitProxyGeo, partHitProxyMat);
  keepsakeHitProxy.position.y = 0.08;
  keepsakeGroup.add(keepsakeHitProxy);

  const keepsakeRibbonMat = mat({
    color: 0xf488a8,
    emissive: 0xd94e7a,
    emissiveIntensity: 0.42,
    roughness: 0.45,
    metalness: 0.05,
  });
  const keepsakeSilverMat = mat({
    color: 0xf4eef8,
    emissive: 0xffc6da,
    emissiveIntensity: 0.36,
    roughness: 0.22,
    metalness: 0.85,
  });

  const keepsakeBox = new THREE.Mesh(
    createBeveledBox(0.15, 0.036, 0.13, 0.008, 2),
    mat({ color: 0x3b2638, roughness: 0.55, metalness: 0.1 })
  );
  keepsakeBox.position.y = 0.018;
  outlines.addOutline(keepsakeBox, 1.05);
  keepsakeGroup.add(keepsakeBox);

  const keepsakeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.038, 0.007, 10, 20),
    keepsakeSilverMat
  );
  keepsakeRing.rotation.x = Math.PI / 2;
  keepsakeRing.position.set(0, 0.044, 0);
  keepsakeGroup.add(keepsakeRing);

  const keepsakeGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.024, 0),
    keepsakeRibbonMat
  );
  keepsakeGem.scale.set(1.0, 0.55, 1.15);
  keepsakeGem.position.set(0, 0.050, 0);
  keepsakeGroup.add(keepsakeGem);

  const keepsakeGlowLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.012, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffa6c9 })
  );
  keepsakeGlowLed.position.set(0.055, 0.042, 0.042);
  keepsakeGroup.add(keepsakeGlowLed);
  group.add(keepsakeGroup);
  metaState.partMeshes['quest_keepsake'] = keepsakeGroup;

  registerInteractable(
    'quest_keepsake',
    '她的心形信物',
    '拾取信物',
    'basement',
    keepsakeGroup,
    () => {
      keepsakeGroup.visible = false;
      metaState.collectedParts.add('quest_keepsake');
      return {
        title: '拾取关键道具：她的心形信物',
        message:
          '一枚系着淡粉色缎带的银质心形吊坠，背面刻着极细的编号。它似乎能通过地下室实验终端的身份校验。',
        collectQuestItemId: 'quest_keepsake',
      };
    }
  );

  // Quest Item 2: 高能备用电池 (Front-left corner of the basement experimental workbench)
  const batteryGroup = new THREE.Group();
  batteryGroup.position.set(0.08, -2.360, -4.66);
  batteryGroup.rotation.y = -0.34;
  batteryGroup.userData.dynamic = true;
  const batteryHitProxy = new THREE.Mesh(partHitProxyGeo, partHitProxyMat);
  batteryHitProxy.position.y = 0.09;
  batteryGroup.add(batteryHitProxy);

  const batteryShellMat = mat({
    color: 0xeab438,
    roughness: 0.36,
    metalness: 0.25,
  });
  const batteryCapMat = mat({
    color: 0x262933,
    roughness: 0.42,
    metalness: 0.48,
  });
  const batteryBody = new THREE.Mesh(
    createBeveledBox(0.16, 0.11, 0.095, 0.010, 2),
    batteryShellMat
  );
  batteryBody.position.y = 0.055;
  outlines.addOutline(batteryBody, 1.05);
  batteryGroup.add(batteryBody);

  const batteryTop = new THREE.Mesh(
    createBeveledBox(0.164, 0.024, 0.098, 0.006, 2),
    batteryCapMat
  );
  batteryTop.position.y = 0.114;
  batteryGroup.add(batteryTop);

  for (const tx of [-0.044, 0.044]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.012, 0.024, 10),
      goldPinMat
    );
    post.position.set(tx, 0.134, 0);
    batteryGroup.add(post);
  }
  const chargeBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.092, 0.018, 0.008),
    new THREE.MeshBasicMaterial({ color: 0x52ffbe })
  );
  chargeBar.position.set(0, 0.062, 0.049);
  batteryGroup.add(chargeBar);
  group.add(batteryGroup);
  metaState.partMeshes['quest_battery'] = batteryGroup;

  registerInteractable(
    'quest_battery',
    '高能备用电池组',
    '拾取电池',
    'basement',
    batteryGroup,
    () => {
      batteryGroup.visible = false;
      metaState.collectedParts.add('quest_battery');
      return {
        title: '拾取关键道具：高能备用电池组',
        message:
          '指示灯满格发亮的工业级锂电模块，正好可以接入地下室实验终端的主供电槽。',
        collectQuestItemId: 'quest_battery',
      };
    }
  );

  // Merge all static Basement meshes into a single draw call
  mergeStaticGroupToSingleMesh(group, outlines, 'BasementMergedStaticMesh');
}
