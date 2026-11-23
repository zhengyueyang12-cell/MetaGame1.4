import * as THREE from 'three';

export interface GlitchCatRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headPivot: THREE.Group;
  tailPivot: THREE.Group;
  echoShell: THREE.LineSegments;
  hitBox: THREE.Mesh;
  bodyMat: THREE.ShaderMaterial;
  eyeLeftMat: THREE.MeshBasicMaterial;
  eyeRightMat: THREE.MeshBasicMaterial;
  echoMat: THREE.LineBasicMaterial;
  update: (
    elapsed: number,
    fade: number,
    dissolve: number,
    glitchBurst: number,
    primaryHex: number,
    accentHex: number
  ) => void;
}

const _tmpPrimary = new THREE.Color();
const _tmpAccent = new THREE.Color();

function createGlitchBodyShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uDissolve: { value: 0 },
      uGlitchIntensity: { value: 0.25 },
      uPrimaryColor: { value: new THREE.Color(0x7be8ff) },
      uAccentColor: { value: new THREE.Color(0xff5a9c) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uGlitchIntensity;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying float vSliceJitter;

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }

      void main() {
        vec3 pos = position;

        // Horizontal holographic slice tearing during glitch pulses
        float band = floor(pos.y * 42.0 + floor(uTime * 15.0) * 1.37);
        float rnd = hash11(band);
        float burst = pow(max(0.0, sin(uTime * 3.4) * cos(uTime * 7.9)), 8.0);
        float glitchPower = clamp(uGlitchIntensity * (0.35 + burst * 1.65), 0.0, 1.5);
        float activeSlice = step(0.84 - glitchPower * 0.16, rnd);
        float shear = (hash11(band + 19.7) - 0.5) * 0.052 * glitchPower * activeSlice;

        pos.x += shear;
        pos.z += shear * 0.45;

        vLocalPos = pos;
        vSliceJitter = activeSlice * glitchPower;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;

        vec4 mvPos = viewMatrix * worldPos;
        vViewPos = -mvPos.xyz;
        vViewNormal = normalize(normalMatrix * normal);

        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uDissolve;
      uniform float uGlitchIntensity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uAccentColor;

      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      varying vec3 vLocalPos;
      varying vec3 vWorldPos;
      varying float vSliceJitter;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        if (uOpacity <= 0.005) discard;

        // Blocky digital dissolve when phasing in/out or vanishing after dialogue
        vec2 cell = floor(vec2(vLocalPos.x + vLocalPos.z * 0.7, vLocalPos.y) * 34.0);
        float cellNoise = hash21(cell + floor(uTime * 6.0) * 0.07);
        if (cellNoise < uDissolve) discard;
        float dissolveEdge = smoothstep(uDissolve, uDissolve + 0.12, cellNoise);

        vec3 n = normalize(vViewNormal);
        vec3 v = normalize(vViewPos);
        float fresnel = pow(1.0 - abs(dot(n, v)), 1.85);

        // Animated CRT scanlines + transient micro-static dropouts
        float scanline = 0.80 + 0.20 * sin(vWorldPos.y * 165.0 - uTime * 11.0);
        float bandNoise = hash21(vec2(floor(vLocalPos.y * 55.0), floor(uTime * 18.0)));
        float dropout = mix(1.0, step(0.14 * uGlitchIntensity, bandNoise), 0.75);

        // Chromatic blend between primary spectral tint & accent magenta/violet
        float chromaWave = 0.5 + 0.5 * sin(vLocalPos.y * 14.0 - uTime * 4.2 + vSliceJitter * 5.0);
        vec3 holoColor = mix(uPrimaryColor, uAccentColor, clamp(chromaWave * 0.45 + vSliceJitter * 0.65, 0.0, 1.0));
        holoColor = mix(holoColor, vec3(0.95, 0.98, 1.0), fresnel * 0.42);
        holoColor = mix(uAccentColor * 1.4, holoColor, dissolveEdge);

        float coreAlpha = mix(0.24, 0.78, fresnel);
        float alpha = coreAlpha * scanline * dropout * uOpacity;

        gl_FragColor = vec4(holoColor, clamp(alpha, 0.0, 0.86));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/**
 * Builds a composite, bottom-center-pivoted (y = 0) semi-transparent
 * procedural "Glitch Cat" with sculpted seated torso, tilted head, pointed
 * ears, collar tag, glowing heterochromatic eyes, swaying tube tail,
 * wireframe glitch echo, and a Layer-1 raycast proxy hitbox.
 */
export function createGlitchCat(scene: THREE.Scene): GlitchCatRig {
  const root = new THREE.Group();
  root.name = 'StrayGlitchCat';
  root.visible = false;
  root.userData.dynamic = true;
  scene.add(root);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const bodyMat = createGlitchBodyShaderMaterial();

  // 1. Sculpted seated feline torso (LatheGeometry, y = 0.0 .. 0.305)
  const torsoPts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.095, 0.008),
    new THREE.Vector2(0.118, 0.055),
    new THREE.Vector2(0.112, 0.125),
    new THREE.Vector2(0.092, 0.205),
    new THREE.Vector2(0.082, 0.265),
    new THREE.Vector2(0.062, 0.298),
    new THREE.Vector2(0.001, 0.305),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 20);
  torsoGeo.scale(0.92, 1.0, 1.12);
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.set(0, 0, -0.02);
  bodyGroup.add(torso);

  // 2. Seated haunch flanks (left & right tucked hind thighs flush at y = 0.055)
  const haunchGeo = new THREE.SphereGeometry(0.066, 14, 12);
  haunchGeo.scale(0.75, 1.12, 1.18);
  for (const side of [-1, 1] as const) {
    const haunch = new THREE.Mesh(haunchGeo, bodyMat);
    haunch.position.set(side * 0.066, 0.072, -0.045);
    bodyGroup.add(haunch);
  }

  // 3. Forelegs & grounded front paws (resting flush at y = 0)
  const legGeo = new THREE.CylinderGeometry(0.023, 0.018, 0.19, 12);
  const pawGeo = new THREE.SphereGeometry(0.024, 10, 8);
  pawGeo.scale(0.92, 0.56, 1.32);
  for (const side of [-1, 1] as const) {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(side * 0.036, 0.105, 0.062);
    leg.rotation.x = 0.12;
    bodyGroup.add(leg);

    const paw = new THREE.Mesh(pawGeo, bodyMat);
    paw.position.set(side * 0.036, 0.014, 0.082);
    bodyGroup.add(paw);
  }

  // 4. Data-collar & hanging diamond glitch tag
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.008, 8, 20), bodyMat);
  collar.rotation.x = Math.PI / 2 - 0.16;
  collar.position.set(0, 0.275, 0.025);
  bodyGroup.add(collar);

  const tag = new THREE.Mesh(new THREE.OctahedronGeometry(0.016, 0), bodyMat);
  tag.position.set(0, 0.248, 0.09);
  bodyGroup.add(tag);

  // 5. Head Pivot (ears, muzzle, heterochromatic slit eyes)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.348, 0.045);
  bodyGroup.add(headPivot);

  const headGeo = new THREE.SphereGeometry(0.084, 18, 14);
  headGeo.scale(1.08, 0.94, 0.98);
  const head = new THREE.Mesh(headGeo, bodyMat);
  headPivot.add(head);

  const muzzleGeo = new THREE.SphereGeometry(0.032, 12, 10);
  muzzleGeo.scale(1.22, 0.72, 0.85);
  const muzzle = new THREE.Mesh(muzzleGeo, bodyMat);
  muzzle.position.set(0, -0.018, 0.068);
  headPivot.add(muzzle);

  // Pointed cat ears
  const earGeo = new THREE.ConeGeometry(0.034, 0.088, 4);
  earGeo.rotateY(Math.PI / 4);
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(earGeo, bodyMat);
    ear.position.set(side * 0.056, 0.084, 0.004);
    ear.rotation.z = side * -0.28;
    ear.rotation.x = 0.14;
    headPivot.add(ear);
  }

  // Heterochromatic glowing slit eyes (cyan left + rose-magenta right)
  const eyeGeo = new THREE.SphereGeometry(0.0145, 10, 8);
  eyeGeo.scale(0.65, 1.25, 0.52);

  const eyeLeftMat = new THREE.MeshBasicMaterial({
    color: 0x70f8ff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const eyeLeft = new THREE.Mesh(eyeGeo, eyeLeftMat);
  eyeLeft.position.set(-0.034, 0.012, 0.072);
  eyeLeft.rotation.y = -0.18;
  headPivot.add(eyeLeft);

  const eyeRightMat = new THREE.MeshBasicMaterial({
    color: 0xff5a9c,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const eyeRight = new THREE.Mesh(eyeGeo, eyeRightMat);
  eyeRight.position.set(0.034, 0.012, 0.072);
  eyeRight.rotation.y = 0.18;
  headPivot.add(eyeRight);

  // 6. Curved Animated Tail (CatmullRomCurve3 + TubeGeometry)
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.048, -0.11);
  bodyGroup.add(tailPivot);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.04, 0.025, -0.095),
    new THREE.Vector3(0.115, 0.095, -0.135),
    new THREE.Vector3(0.145, 0.195, -0.095),
    new THREE.Vector3(0.105, 0.255, -0.04),
  ]);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 18, 0.017, 8, false);
  const tailMesh = new THREE.Mesh(tailGeo, bodyMat);
  tailPivot.add(tailMesh);

  // 7. Wireframe Glitch Echo Shell (subtle spectral contour overlay)
  const echoEdgesGeo = new THREE.EdgesGeometry(torsoGeo, 28);
  const echoMat = new THREE.LineBasicMaterial({
    color: 0x7be8ff,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const echoShell = new THREE.LineSegments(echoEdgesGeo, echoMat);
  echoShell.position.copy(torso.position);
  echoShell.scale.set(1.045, 1.02, 1.045);
  bodyGroup.add(echoShell);

  // 8. Simplified Invisible Layer-1 Raycast Hitbox for crisp hover/click detection
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.52, 0.52),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitBox.position.set(0, 0.26, 0.01);
  hitBox.name = 'raycast_proxy_stray_glitch_cat';
  hitBox.userData.interactId = 'stray_glitch_cat';
  hitBox.layers.set(1);
  root.add(hitBox);

  const update = (
    elapsed: number,
    fade: number,
    dissolve: number,
    glitchBurst: number,
    primaryHex: number,
    accentHex: number
  ) => {
    bodyMat.uniforms.uTime.value = elapsed;
    bodyMat.uniforms.uOpacity.value = fade;
    bodyMat.uniforms.uDissolve.value = dissolve;
    bodyMat.uniforms.uGlitchIntensity.value = Math.min(1.5, 0.22 + glitchBurst);

    _tmpPrimary.setHex(primaryHex);
    _tmpAccent.setHex(accentHex);
    bodyMat.uniforms.uPrimaryColor.value.copy(_tmpPrimary);
    bodyMat.uniforms.uAccentColor.value.copy(_tmpAccent);

    // Subtle organic breathing, curious head tilt & tail curl sway
    const breath = 1.0 + Math.sin(elapsed * 2.1) * 0.018;
    bodyGroup.scale.set(1.0, breath, 1.0);

    const twitch =
      Math.pow(Math.max(0, Math.sin(elapsed * 4.3) * Math.cos(elapsed * 9.7)), 14) *
      (0.18 + glitchBurst * 0.22);
    headPivot.rotation.z = Math.sin(elapsed * 1.1) * 0.09 + twitch;
    headPivot.rotation.y = Math.sin(elapsed * 0.75) * 0.14 - twitch * 0.6;
    headPivot.rotation.x = Math.sin(elapsed * 1.4) * 0.04;

    tailPivot.rotation.y = Math.sin(elapsed * 1.9) * 0.24 + twitch * 1.4;
    tailPivot.rotation.z = Math.cos(elapsed * 1.35) * 0.08;

    // Echo shell jitters horizontally when glitch intensity spikes
    const echoJitter =
      (Math.sin(elapsed * 37.0) * 0.012 + Math.cos(elapsed * 53.0) * 0.008) *
      (0.25 + glitchBurst * 2.2);
    echoShell.position.x = echoJitter;
    echoMat.color.copy(glitchBurst > 0.35 ? _tmpAccent : _tmpPrimary);
    echoMat.opacity = fade * (1.0 - dissolve) * (0.14 + Math.min(0.45, glitchBurst * 0.35));

    // Eye flicker synced to fade & glitch
    const eyeBlink =
      Math.sin(elapsed * 0.65) > 0.985 || (glitchBurst > 0.4 && Math.sin(elapsed * 48.0) > 0.4)
        ? 0.25
        : 1.0;
    const eyeAlpha = fade * (1.0 - dissolve) * 0.94 * eyeBlink;
    eyeLeftMat.opacity = eyeAlpha;
    eyeRightMat.opacity = eyeAlpha;
  };

  return {
    root,
    bodyGroup,
    headPivot,
    tailPivot,
    echoShell,
    hitBox,
    bodyMat,
    eyeLeftMat,
    eyeRightMat,
    echoMat,
    update,
  };
}
