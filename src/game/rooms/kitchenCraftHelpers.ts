import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = repeatX > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = repeatY > 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Warm cream-quartz / fine speckled laminate countertop albedo + micro-bump maps
 * matching the soft warm stone-laminate sheen in MiSide's kitchen.
 */
export function createKitchenCounterTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const [c, ctx] = makeCanvas(512, 512);
  const [bc, bctx] = makeCanvas(512, 512);

  if (ctx && bctx) {
    // Warm ivory-stone base with subtle diagonal warmth gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#f4ede4');
    grad.addColorStop(0.5, '#efe6dc');
    grad.addColorStop(1, '#f3ece3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    bctx.fillStyle = '#808080';
    bctx.fillRect(0, 0, 512, 512);

    // Subtle organic mineral veins
    ctx.strokeStyle = 'rgba(205, 192, 178, 0.22)';
    ctx.lineWidth = 3;
    for (let v = 0; v < 7; v++) {
      ctx.beginPath();
      let x = (v * 83) % 512;
      let y = 0;
      ctx.moveTo(x, y);
      for (let s = 1; s <= 8; s++) {
        x += Math.sin(v * 2.1 + s * 1.3) * 26;
        y = s * 64;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Fine deterministic mineral quartz flecks (warm taupe, cream glint, soft slate)
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 3200; i++) {
      const px = rand() * 512;
      const py = rand() * 512;
      const r = 0.6 + rand() * 1.8;
      const tone = rand();
      if (tone < 0.45) {
        ctx.fillStyle = 'rgba(182, 168, 152, 0.24)';
        bctx.fillStyle = 'rgba(108, 108, 108, 0.45)';
      } else if (tone < 0.80) {
        ctx.fillStyle = 'rgba(255, 252, 248, 0.48)';
        bctx.fillStyle = 'rgba(148, 148, 148, 0.45)';
      } else {
        ctx.fillStyle = 'rgba(154, 142, 134, 0.20)';
        bctx.fillStyle = 'rgba(98, 98, 98, 0.40)';
      }
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      bctx.fillRect(px, py, r * 1.4, r * 1.4);
    }
  }

  return {
    map: finalizeTexture(c, 3, 2, true),
    bumpMap: finalizeTexture(bc, 3, 2, false),
  };
}

/**
 * Satin enamel micro-grain texture for microwave housing and ceramic props.
 */
export function createApplianceEnamelTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#fbf5ee');
    g.addColorStop(0.55, '#f5ece2');
    g.addColorStop(1, '#ede1d4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);

    // Micro satin horizontal brush grain
    for (let y = 0; y < 256; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(150,132,118,0.04)';
      ctx.fillRect(0, y, 256, 1);
    }
  }
  return finalizeTexture(c, 1, 1, true);
}

/**
 * Crisp built-in oven LED fascia display ("185°C" + bake icon + clock "21:40").
 */
export function createOvenDisplayTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 96);
  if (ctx) {
    ctx.fillStyle = '#121018';
    ctx.fillRect(0, 0, 256, 96);

    // Recessed glossy bezel highlight
    ctx.strokeStyle = '#383446';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 250, 90);

    // Subtle glass sheen diagonal
    const sheen = ctx.createLinearGradient(0, 0, 256, 96);
    sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.0)');
    sheen.addColorStop(1, 'rgba(255,160,96,0.05)');
    ctx.fillStyle = sheen;
    ctx.fillRect(4, 4, 248, 88);

    // Warm amber segmented LED digits
    ctx.fillStyle = '#ff9844';
    ctx.shadowColor = '#ff6b1a';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 42px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('185°C', 18, 48);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffc078';
    ctx.fillText('21:40', 172, 34);

    // Small convection bake mode indicator dots
    ctx.shadowBlur = 3;
    ctx.fillStyle = '#ff7030';
    ctx.fillRect(172, 56, 16, 6);
    ctx.fillStyle = '#483b36';
    ctx.fillRect(194, 56, 16, 6);
    ctx.fillRect(216, 56, 16, 6);
  }
  return finalizeTexture(c, 1, 1, true);
}

/**
 * Crisp countertop microwave green LED readout ("00:47" + "800W").
 */
export function createMicrowaveDisplayTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 112);
  if (ctx) {
    ctx.fillStyle = '#0e1816';
    ctx.fillRect(0, 0, 256, 112);

    ctx.strokeStyle = '#2d4440';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 250, 106);

    ctx.fillStyle = '#56f2b4';
    ctx.shadowColor = '#28d890';
    ctx.shadowBlur = 9;
    ctx.font = 'bold 54px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('00:47', 26, 52);

    ctx.shadowBlur = 3;
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#8ef5cb';
    ctx.fillText('800W  AUTO', 28, 92);
  }
  return finalizeTexture(c, 1, 1, true);
}

/**
 * Perforated circular RF-shield glass mesh for microwave viewing door.
 */
export function createMicrowaveMeshGlassTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 192);
  if (ctx) {
    const bg = ctx.createRadialGradient(128, 104, 18, 128, 96, 148);
    bg.addColorStop(0, '#362e3c');
    bg.addColorStop(0.55, '#1d1a26');
    bg.addColorStop(1, '#100e16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 192);

    // Subtle interior ceramic mug + glass turntable silhouette
    ctx.fillStyle = 'rgba(210, 185, 160, 0.14)';
    ctx.fillRect(46, 144, 164, 10);
    ctx.fillStyle = 'rgba(235, 224, 212, 0.16)';
    ctx.fillRect(108, 104, 38, 40);

    // Fine dark perforated RF-shield dot grid
    ctx.fillStyle = 'rgba(8, 8, 12, 0.56)';
    for (let y = 10; y < 182; y += 6) {
      for (let x = 10; x < 246; x += 6) {
        ctx.beginPath();
        ctx.arc(x + ((y / 6) % 2) * 3, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Crisp outer black bezel margin & subtle diagonal glass reflection
    ctx.strokeStyle = '#0c0b12';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 242, 178);

    const refl = ctx.createLinearGradient(0, 0, 210, 180);
    refl.addColorStop(0, 'rgba(255,255,255,0.14)');
    refl.addColorStop(0.32, 'rgba(255,255,255,0.02)');
    refl.addColorStop(0.55, 'rgba(255,255,255,0.0)');
    refl.addColorStop(0.70, 'rgba(255,255,255,0.06)');
    refl.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = refl;
    ctx.fillRect(14, 14, 228, 164);
  }
  return finalizeTexture(c, 1, 1, true);
}

/**
 * Crisp printed paper bottle label for condiments & dish soap (adds immediate lived-in detail).
 */
export function createBottleLabelTexture(
  bgHex: string,
  accentHex: string,
  title: string,
  sub: string
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(160, 128);
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 160, 128);

    ctx.fillStyle = accentHex;
    ctx.fillRect(0, 0, 160, 16);
    ctx.fillRect(0, 112, 160, 16);

    ctx.strokeStyle = 'rgba(60, 44, 34, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 22, 144, 84);

    ctx.fillStyle = '#2e221e';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 80, 56);

    ctx.fillStyle = '#6c5448';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(sub, 80, 84);
  }
  return finalizeTexture(c, 1, 1, true);
}

/**
 * Quilted stitched amber oven mitt texture with MiSide's signature cream spiral swirl motif!
 */
export function createOvenMittTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 256);
  if (ctx) {
    ctx.fillStyle = '#d98a3c';
    ctx.fillRect(0, 0, 256, 256);

    // Soft quilted diamond stitching
    ctx.strokeStyle = 'rgba(148, 82, 26, 0.34)';
    ctx.lineWidth = 2;
    for (let i = -256; i < 512; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 256, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i + 256, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
    }

    // Warm cream spiral motif centered on the mitt palm
    ctx.strokeStyle = 'rgba(255, 232, 198, 0.78)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let t = 0; t < Math.PI * 4.2; t += 0.12) {
      const r = 4 + t * 4.4;
      const x = 128 + Math.cos(t) * r;
      const y = 138 + Math.sin(t) * r;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finalizeTexture(c, 1, 1, true);
}

/**
 * Soft woven gingham / plaid pastel cotton dish towel texture.
 */
export function createPlaidTowelTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(128, 128);
  if (ctx) {
    ctx.fillStyle = '#faf3ea';
    ctx.fillRect(0, 0, 128, 128);

    ctx.fillStyle = 'rgba(222, 134, 152, 0.34)';
    for (let i = 0; i < 128; i += 32) {
      ctx.fillRect(i, 0, 12, 128);
      ctx.fillRect(0, i, 128, 12);
    }
    ctx.fillStyle = 'rgba(182, 102, 122, 0.22)';
    for (let i = 16; i < 128; i += 32) {
      ctx.fillRect(i, 0, 3, 128);
      ctx.fillRect(0, i, 128, 3);
    }
  }
  return finalizeTexture(c, 2, 2, true);
}

/**
 * Shared soft radial contact shadow decal texture for grounding countertop items,
 * appliances, cabinet bases, and wall rails (eliminates floating "toy model" look!).
 */
let cachedContactShadowTex: THREE.CanvasTexture | null = null;

export function createContactShadowMaterial(opacity = 0.28): THREE.MeshBasicMaterial {
  if (!cachedContactShadowTex) {
    const [c, ctx] = makeCanvas(128, 128);
    if (ctx) {
      const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
      g.addColorStop(0.0, 'rgba(22, 15, 28, 0.88)');
      g.addColorStop(0.45, 'rgba(22, 15, 28, 0.52)');
      g.addColorStop(0.78, 'rgba(22, 15, 28, 0.14)');
      g.addColorStop(1.0, 'rgba(22, 15, 28, 0.0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    cachedContactShadowTex = finalizeTexture(c, 1, 1, true);
  }

  return new THREE.MeshBasicMaterial({
    map: cachedContactShadowTex,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
}

export function addContactShadow(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  opacity = 0.26,
  rotY = 0
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    createContactShadowMaterial(opacity)
  );
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rotY;
  m.position.set(x, y + 0.0018, z);
  m.renderOrder = 1;
  m.userData.dynamic = true;
  parent.add(m);
  return m;
}
