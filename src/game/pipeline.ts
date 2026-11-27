import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { AtmosphereMode } from './types';

export interface TwilightUniforms {
  uCelEnabled: { value: number };
  uOutlineEnabled: { value: number };
  uDaylightFactor: { value: number };
  uNightFactor: { value: number };
  uWindowBloomScale: { value: number };
  uSsaoIntensity: { value: number };
  uCeilingAoBoost: { value: number };
  uBaseAoBoost: { value: number };
  uShadowTint: { value: THREE.Color };
  uHighlightWarmth: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
  uRimStrength: { value: number };
  uWindowLightDir: { value: THREE.Vector3 };
  uShaftColor: { value: THREE.Color };
  uCloudShadowStrength: { value: number };
  uTime: { value: number };
  uBakedGiMap: { value: THREE.Texture };
  uBakedGiBounds: { value: THREE.Vector4 };
  uGiIntensity: { value: number };
  uGiTint: { value: THREE.Color };
  uSofaShadowColor: { value: THREE.Color };
  uSofaShadowStrength: { value: number };
  uFloorFresnelStrength: { value: number };
  uAnisotropy: { value: number };
  uTyndallIntensity: { value: number };
  uSoftShadowDecay: { value: number };
  uLivingLightBoost: { value: number };
}

function createFallbackGiTexture(): THREE.DataTexture {
  const data = new Uint8Array([195, 165, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createSharedTwilightUniforms(): TwilightUniforms {
  return {
    uCelEnabled: { value: 1.0 },
    uOutlineEnabled: { value: 1.0 },
    uDaylightFactor: { value: 1.0 },
    uNightFactor: { value: 0.0 },
    uWindowBloomScale: { value: 1.0 },
    uSsaoIntensity: { value: 1.25 },
    uCeilingAoBoost: { value: 1.38 },
    uBaseAoBoost: { value: 1.42 },
    // Soft pale-lavender-grey shadow tint & warm cream highlight (MiSide baseline)
    uShadowTint: { value: new THREE.Color(0x9b8db0) },
    uHighlightWarmth: { value: new THREE.Color(0xfff4e6) },
    uRimColor: { value: new THREE.Color(0xffe0c8) },
    uRimStrength: { value: 0.16 },
    // Downward afternoon sunlight angle from East & South windows (+X, +Y, +Z)
    uWindowLightDir: { value: new THREE.Vector3(0.76, 0.52, 0.38).normalize() },
    uShaftColor: { value: new THREE.Color(0xfff0d4) },
    uCloudShadowStrength: { value: 0.42 },
    uTime: { value: 0 },
    uBakedGiMap: { value: createFallbackGiTexture() },
    uBakedGiBounds: { value: new THREE.Vector4(-8.35, -14.40, 1.0 / 16.05, 1.0 / 21.45) },
    uGiIntensity: { value: 0.94 },
    uGiTint: { value: new THREE.Color(0xffeedc) },
    // Warm soft shadow tint for sofa crevices & backrest bottom
    uSofaShadowColor: { value: new THREE.Color(0xba9a8c) },
    uSofaShadowStrength: { value: 0.50 },
    uFloorFresnelStrength: { value: 0.80 },
    // Anisotropic Scattering & Tyndall dispersion for window shafts
    uAnisotropy: { value: 0.62 },
    uTyndallIntensity: { value: 1.02 },
    uSoftShadowDecay: { value: 0.96 },
    uLivingLightBoost: { value: 0.0 },
  };
}

export function updateTwilightUniformsForMode(
  uniforms: TwilightUniforms,
  mode: AtmosphereMode
): void {
  if (mode === 'daylight') {
    // MiSide Soft Healing Daytime Palette
    uniforms.uDaylightFactor.value = 1.0;
    uniforms.uNightFactor.value = 0.0;
    uniforms.uWindowBloomScale.value = 1.0;
    uniforms.uShadowTint.value.setHex(0x9b8db0);
    uniforms.uHighlightWarmth.value.setHex(0xfff4e6);
    uniforms.uRimColor.value.setHex(0xffe0c8);
    uniforms.uRimStrength.value = 0.16;
    uniforms.uShaftColor.value.setHex(0xfff0d4);
    uniforms.uCloudShadowStrength.value = 0.42;
    uniforms.uSofaShadowColor.value.setHex(0xba9a8c);
    uniforms.uSofaShadowStrength.value = 0.50;
    uniforms.uFloorFresnelStrength.value = 0.80;
    uniforms.uAnisotropy.value = 0.62;
    uniforms.uTyndallIntensity.value = 1.02;
    uniforms.uSoftShadowDecay.value = 0.96;
  } else if (mode === 'sunset') {
    // MiSide Velvety Rose-Lavender & Golden-Apricot Sunset
    uniforms.uDaylightFactor.value = 0.0;
    uniforms.uNightFactor.value = 0.15;
    uniforms.uWindowBloomScale.value = 0.85;
    uniforms.uShadowTint.value.setHex(0x7e5f88);
    uniforms.uHighlightWarmth.value.setHex(0xffd2b4);
    uniforms.uRimColor.value.setHex(0xffbfa0);
    uniforms.uRimStrength.value = 0.22;
    uniforms.uShaftColor.value.setHex(0xffc494);
    uniforms.uCloudShadowStrength.value = 0.54;
    uniforms.uSofaShadowColor.value.setHex(0xb68670);
    uniforms.uSofaShadowStrength.value = 0.55;
    uniforms.uFloorFresnelStrength.value = 1.24;
    uniforms.uAnisotropy.value = 0.68;
    uniforms.uTyndallIntensity.value = 1.16;
    uniforms.uSoftShadowDecay.value = 1.24;
  } else if (mode === 'midnight') {
    // MiSide Dreamy Luminous Violet-Purple / Royal Indigo Nighttime (Reference 1)
    uniforms.uDaylightFactor.value = 0.0;
    uniforms.uNightFactor.value = 1.0;
    uniforms.uWindowBloomScale.value = 0.72;
    uniforms.uShadowTint.value.setHex(0x463880);
    uniforms.uHighlightWarmth.value.setHex(0xdcd4ff);
    uniforms.uRimColor.value.setHex(0x9e8ef2);
    uniforms.uRimStrength.value = 0.20;
    uniforms.uShaftColor.value.setHex(0x7aa4ff);
    uniforms.uAnisotropy.value = 0.58;
    uniforms.uTyndallIntensity.value = 0.90;
    uniforms.uCloudShadowStrength.value = 0.36;
    uniforms.uSofaShadowColor.value.setHex(0x5c609c);
    uniforms.uSofaShadowStrength.value = 0.56;
    uniforms.uFloorFresnelStrength.value = 1.12;
    uniforms.uSoftShadowDecay.value = 1.32;
  } else {
    // Meta psychological horror shift: deep plum-crimson shadows, uncanny magenta-cyan rim
    uniforms.uDaylightFactor.value = 0.0;
    uniforms.uNightFactor.value = 0.40;
    uniforms.uWindowBloomScale.value = 0.70;
    uniforms.uShadowTint.value.setHex(0x5e2850);
    uniforms.uHighlightWarmth.value.setHex(0xffa8b8);
    uniforms.uRimColor.value.setHex(0xff4d79);
    uniforms.uRimStrength.value = 0.30;
    uniforms.uShaftColor.value.setHex(0xff5e87);
    uniforms.uCloudShadowStrength.value = 0.90;
    uniforms.uSofaShadowColor.value.setHex(0x743f5e);
    uniforms.uSofaShadowStrength.value = 0.58;
    uniforms.uFloorFresnelStrength.value = 0.95;
    uniforms.uSoftShadowDecay.value = 1.12;
  }
}

let _softShadowChunkInstalled = false;

/**
/**
 * Upgrades Three.js's built-in SHADOWMAP_TYPE_PCF (which defaults to only 5 taps in r187)
 * to an 8-tap Gaussian-weighted rotated Vogel-disk PCF kernel using Interleaved Gradient Noise.
 * Hardware LinearFilter gives 4x bilinear samples per tap (32 effective PCF taps), keeping smooth
 * contour-free penumbras at half the shadow texture bandwidth of 16-tap.
 */
export function installSoftShadowChunk(): void {
  if (_softShadowChunkInstalled) return;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (chunk && chunk.includes('vogelDiskSample( 4, 5, phi )')) {
    const original5Tap = `				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;`;

    const upgradedDualRingPenumbra = `				// Dual-ring 12-tap Gaussian Vogel-disk PCF:
				// 6 inner core taps (0.72 * radius) + 6 wide diffuse halo taps (2.15 * radius)
				// creates soft grounded contact cores with smooth diffuse double-shadow edge fade!
				float coreShadow = 0.0;
				float coreWeight = 0.0;
				for ( int i = 0; i < 6; i ++ ) {
					vec2 vOffset = vogelDiskSample( i, 6, phi );
					float w = exp( -dot( vOffset, vOffset ) * 1.15 );
					coreShadow += texture( shadowMap, vec3( shadowCoord.xy + vOffset * radius * 0.72, shadowCoord.z ) ) * w;
					coreWeight += w;
				}
				coreShadow /= max( coreWeight, 0.0001 );

				float haloShadow = 0.0;
				float haloWeight = 0.0;
				for ( int j = 0; j < 6; j ++ ) {
					vec2 vOuter = vogelDiskSample( j, 6, phi + 1.0471975 );
					float w2 = exp( -dot( vOuter, vOuter ) * 0.65 );
					haloShadow += texture( shadowMap, vec3( shadowCoord.xy + vOuter * radius * 2.15, shadowCoord.z ) ) * w2;
					haloWeight += w2;
				}
				haloShadow /= max( haloWeight, 0.0001 );

				// Blend inner shadow core (54%) + wide diffuse bounce penumbra (46%) for soft fading edges
				shadow = mix( haloShadow, coreShadow, 0.54 );`;

    if (chunk.includes(original5Tap)) {
      THREE.ShaderChunk.shadowmap_pars_fragment = chunk.replace(
        original5Tap,
        upgradedDualRingPenumbra
      );
    }
  }

  // Upgrade RE_Direct_Physical with a gentle 26% Half-Lambert diffuse wrap so angled
  // furniture faces transition smoothly without either harsh black cutoffs OR flat washed-out shading.
  const physChunk = THREE.ShaderChunk.lights_physical_pars_fragment;
  const origDotNL = `float dotNL = saturate( dot( geometryNormal, directLight.direction ) );`;
  if (physChunk && physChunk.includes(origDotNL)) {
    let patchedPhys = physChunk.replace(
      origDotNL,
      `float rawDotNL = dot( geometryNormal, directLight.direction );
	float halfLambertNL = rawDotNL * 0.5 + 0.5;
	float dotNL = mix( saturate( rawDotNL ), halfLambertNL * halfLambertNL, 0.26 );`
    );
    const origSpec = `reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;`;
    if (patchedPhys.includes(origSpec)) {
      patchedPhys = patchedPhys.replace(
        origSpec,
        `reflectedLight.directSpecular += ( saturate( rawDotNL ) * directLight.color ) * specularBRDF * material.multiScatteringCompensation;`
      );
    }
    THREE.ShaderChunk.lights_physical_pars_fragment = patchedPhys;
  }

  _softShadowChunkInstalled = true;
}

/**
 * Shared GLSL procedural shadow mask function simulating:
 * 1) Slowly drifting twilight clouds modulating overall window sunlight
 * 2) Gently swaying exterior tree branches & dappled leaf clusters outside the East windows
 * 3) Ultra-soft diffused window opening glow projected into the room
 */
const WINDOW_SHADOW_MASK_GLSL = `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Returns vec2(foliageAndCloudMask, windowPaneMask) at East window plane coordinates (winY, winZ)
  vec2 evalExteriorShadowMask(float winY, float winZ, float distFromWin, float time) {
    // 1. Slowly drifting cloud shadows across the sky (gentle, never stark)
    vec2 cloudUv1 = vec2(winZ * 0.24 + time * 0.06, winY * 0.22 - time * 0.035);
    vec2 cloudUv2 = vec2(winZ * 0.45 - time * 0.042, winY * 0.40 + time * 0.05);
    float cloudN = valueNoise2D(cloudUv1) * 0.65 + valueNoise2D(cloudUv2) * 0.35;
    float cloudMask = mix(0.88, 1.04, smoothstep(0.16, 0.86, cloudN));

    // 2. Gentle swaying exterior foliage dapple
    float windPrimary = sin(time * 0.95 + winZ * 1.2 + winY * 0.8) * 0.065;
    float windFlutter = cos(time * 1.85 - winZ * 2.1 + winY * 1.7) * 0.024;
    vec2 swayPos = vec2(winZ + windPrimary + windFlutter, winY + windPrimary * 0.4);

    float leaf1 = valueNoise2D(swayPos * 2.1 + vec2(time * 0.14, -time * 0.10));
    float leaf2 = valueNoise2D(swayPos * 4.2 - vec2(time * 0.22, time * 0.16));
    float leafCanopy = leaf1 * 0.68 + leaf2 * 0.32;

    float branchShadow = smoothstep(0.42, 0.94, leafCanopy);
    float treeMask = 1.0 - branchShadow * 0.14;

    // 3. East Window openings (wz = -7.20 and wz = -2.96, width = 1.28m, full height Y = 0.86 .. 2.70)
    float dZ1 = abs(winZ - (-7.20));
    float dZ2 = abs(winZ - (-2.96));
    float localZ = dZ1 < dZ2 ? (winZ - (-7.20)) : (winZ - (-2.96));
    float minDz = min(dZ1, dZ2);

    // Physically based Soft Shadow Decay: penumbra widens organically with travel distance from window glass
    float softDecay = clamp(uSoftShadowDecay, 0.5, 1.8);
    float distPenumbra = pow(clamp(distFromWin * 0.22, 0.0, 1.45), 1.28) * 0.36;
    float blur = (0.24 + distPenumbra) * softDecay;
    float inWinZ = 1.0 - smoothstep(0.48 - blur * 0.45, 0.74 + blur, minDz);
    float inWinY = smoothstep(0.76 - blur, 0.98 + blur * 0.45, winY) *
                   (1.0 - smoothstep(2.56 - blur * 0.45, 2.80 + blur, winY));
    float winOpening = inWinZ * inWinY;
    float radialSoftDecay = 1.0 / (1.0 + distFromWin * distFromWin * 0.048 * softDecay);

    // Distance-softened diffused muntin scatter (melts cleanly with distance!)
    float mBlur = 0.14 + blur * 0.92;
    float vMullion = smoothstep(0.0, mBlur, abs(localZ));
    float hMullion1 = smoothstep(0.0, mBlur, abs(winY - 1.32));
    float hMullion2 = smoothstep(0.0, mBlur, abs(winY - 1.78));
    float hMullion3 = smoothstep(0.0, mBlur, abs(winY - 2.24));
    float mullionMask = vMullion * hMullion1 * hMullion2 * hMullion3;

    float combinedDynamicMask = clamp(cloudMask * treeMask, 0.78, 1.05);
    float paneMask = winOpening * radialSoftDecay * mix(0.88, 1.0, mullionMask);
    return vec2(combinedDynamicMask, paneMask);
  }
`;

export interface TwilightMaterialOptions extends THREE.MeshStandardMaterialParameters {
  rimScale?: number;
  celStrength?: number;
  woodLacquer?: number;
  /** Optional vertex-shader indoor breeze sway amplitude (e.g. 0.45..1.0 for curtains & plant foliage) */
  windSway?: number;
  /**
   * When > 0.5, boosts creamy-white brightness on top & sunlit faces (#fffaf3)
   * while preserving soft pale lavender-pink shadows (#dfd0dc) strictly in unlit faces and crevices.
   */
  fabricCream?: number;
  /**
   * Enables view-angle Schlick Fresnel micro-reflection along wood plank seams & worn satin grain
   * (0 = disabled, 1.0 = living/dining wood floor, 1.2 = bedroom dusk-optimized wood floor).
   */
  floorFresnel?: number;
  /**
   * Enables geometry-based recessed-panel depth shadow & continuous full-height wood grain
   * on carved wooden doors (eliminates black outlines and upper/lower texture seams).
   */
  doorDepthRelief?: {
    halfThick: number;
    maxRecessDepth: number;
    doorHeight: number;
    doorHalfWidth: number;
  };
}

/**
 * Creates a MeshStandardMaterial patched via onBeforeCompile to produce a
 * rich, volumetric MiSide-inspired shader with 3D directional face differentiation,
 * global SSAO controller boosting ceiling seams & furniture bases,
 * MiSide ~2px anti-aliased shadow-extracted contour,
 * optional view-angle Fresnel micro-reflection on aged wood floors & plank seams,
 * and optional gentle indoor breeze sway for curtains and foliage.
 */
export function createTwilightMaterial(
  shared: TwilightUniforms,
  params: TwilightMaterialOptions
): THREE.MeshStandardMaterial {
  const {
    rimScale = 1.0,
    celStrength = 1.0,
    woodLacquer,
    windSway = 0.0,
    fabricCream = 0.0,
    floorFresnel = 0.0,
    doorDepthRelief,
    ...stdParams
  } = params;

  let inferredLacquer = woodLacquer ?? 0.0;
  if (woodLacquer === undefined && stdParams.color !== undefined && !stdParams.map) {
    const c = new THREE.Color(stdParams.color);
    if (c.r > c.g * 1.12 && c.g > c.b * 1.06 && c.r > 0.38 && c.r < 0.90) {
      inferredLacquer = 0.88;
    }
  }

  installSoftShadowChunk();
  let mat: THREE.MeshStandardMaterial;
  if (inferredLacquer > 0.05) {
    mat = new THREE.MeshPhysicalMaterial({
      ...stdParams,
      // Authentic water-based lacquer (水性清漆/水漆质感): crystal-clear silky satin-gloss topcoat over open-pore wood grain
      clearcoat: Math.min(0.72, 0.30 + inferredLacquer * 0.44),
      clearcoatRoughness: Math.max(0.16, 0.32 - inferredLacquer * 0.14),
      reflectivity: 0.54,
      specularIntensity: 0.72,
      specularColor: new THREE.Color(0xfff5e8),
    });
  } else if (fabricCream > 0.5) {
    mat = new THREE.MeshPhysicalMaterial({
      ...stdParams,
      sheen: 0.52,
      sheenRoughness: 0.78,
      sheenColor: new THREE.Color(0xfff5f2),
    });
  } else {
    mat = new THREE.MeshStandardMaterial(stdParams);
  }
  if (fabricCream > 0.5) {
    mat.userData.isSofaFabric = true;
  }
  if (floorFresnel > 0.01) {
    mat.userData.isWoodFloorFresnel = true;
    mat.userData.baseFloorFresnel = floorFresnel;
  }

  // All twilight styling knobs are passed as uniforms (not GLSL defines), so sharing
  // one cache key eliminates dozens of redundant WebGL shader compilations at cold start.
  mat.customProgramCacheKey = () => 'twilight-miside-v24';
  const doorReliefVec = doorDepthRelief
    ? new THREE.Vector4(
        doorDepthRelief.halfThick,
        doorDepthRelief.maxRecessDepth,
        doorDepthRelief.doorHeight,
        doorDepthRelief.doorHalfWidth
      )
    : new THREE.Vector4(0, 0, 0, 0);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCelEnabled = shared.uCelEnabled;
    shader.uniforms.uOutlineEnabled = shared.uOutlineEnabled;
    shader.uniforms.uDaylightFactor = shared.uDaylightFactor;
    shader.uniforms.uSsaoIntensity = shared.uSsaoIntensity;
    shader.uniforms.uCeilingAoBoost = shared.uCeilingAoBoost;
    shader.uniforms.uBaseAoBoost = shared.uBaseAoBoost;
    shader.uniforms.uShadowTint = shared.uShadowTint;
    shader.uniforms.uHighlightWarmth = shared.uHighlightWarmth;
    shader.uniforms.uRimColor = shared.uRimColor;
    shader.uniforms.uRimStrength = shared.uRimStrength;
    shader.uniforms.uWindowLightDir = shared.uWindowLightDir;
    shader.uniforms.uCloudShadowStrength = shared.uCloudShadowStrength;
    shader.uniforms.uTime = shared.uTime;
    shader.uniforms.uBakedGiMap = shared.uBakedGiMap;
    shader.uniforms.uBakedGiBounds = shared.uBakedGiBounds;
    shader.uniforms.uGiIntensity = shared.uGiIntensity;
    shader.uniforms.uGiTint = shared.uGiTint;
    shader.uniforms.uShaftColor = shared.uShaftColor;
    shader.uniforms.uSofaShadowColor = shared.uSofaShadowColor;
    shader.uniforms.uSofaShadowStrength = shared.uSofaShadowStrength;
    shader.uniforms.uFloorFresnelStrength = shared.uFloorFresnelStrength;
    shader.uniforms.uSoftShadowDecay = shared.uSoftShadowDecay;
    shader.uniforms.uLivingLightBoost = shared.uLivingLightBoost;
    shader.uniforms.uRimScale = { value: rimScale };
    shader.uniforms.uCelStrength = { value: celStrength };
    shader.uniforms.uWoodLacquer = { value: inferredLacquer };
    shader.uniforms.uWindSway = { value: windSway };
    shader.uniforms.uFabricCream = { value: fabricCream };
    shader.uniforms.uFloorFresnel = { value: floorFresnel };
    shader.uniforms.uDoorRelief = { value: doorReliefVec };

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uWindSway;
      uniform float uFabricCream;
      attribute vec3 aOrigPos;
      attribute vec3 aOrigNormal;
      varying vec3 vTwilightWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;
      varying float vSofaVertexAo;
      varying float vSofaBackBottomAo;
      ` +
      shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `
          #include <beginnormal_vertex>
          if (dot(objectNormal, objectNormal) < 1e-6) {
            objectNormal = vec3(0.0, 1.0, 0.0);
          }
          `
        )
        .replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          if (uWindSway > 0.001) {
            #ifdef USE_INSTANCING
              vec4 wsSwayPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
            #else
              vec4 wsSwayPos = modelMatrix * vec4(transformed, 1.0);
            #endif
            float swayPhase = uTime * 1.65 + wsSwayPos.x * 2.1 + wsSwayPos.z * 1.85 + wsSwayPos.y * 1.35;
            float waveA = sin(swayPhase) * 0.0085 + cos(swayPhase * 0.62 + wsSwayPos.x * 3.2) * 0.0045;
            float waveB = cos(swayPhase * 0.84 + wsSwayPos.z * 2.6) * 0.0062;
            // Anchor top curtain headers near Y=2.75m while letting lower hems & leaves breathe softly
            float heightMask = clamp((2.78 - wsSwayPos.y) * 0.65, 0.08, 1.0);
            transformed.x += waveA * uWindSway * heightMask;
            transformed.z += waveB * uWindSway * heightMask;
          } else if (uWindSway < -0.001) {
            // UV-anchored gentle cloth flutter (uv.y=1 anchored on backrest, uv.y=0 hanging hem flutters softly!)
            float uvDrop = pow(clamp(1.0 - uv.y, 0.0, 1.0), 1.55);
            vec4 wsTapPos = modelMatrix * vec4(transformed, 1.0);
            float tPhase = uTime * 2.05 + wsTapPos.z * 3.8 + wsTapPos.y * 4.2;
            float flutter = sin(tPhase) * 0.015 + cos(tPhase * 0.68 + wsTapPos.z * 2.6) * 0.0075;
            transformed.z -= flutter * abs(uWindSway) * uvDrop;
            transformed.x += sin(tPhase * 0.88 + wsTapPos.z * 2.2) * 0.0045 * abs(uWindSway) * uvDrop;
          }
          `
        )
        .replace(
          '#include <worldpos_vertex>',
          `
          #include <worldpos_vertex>
          #ifdef USE_INSTANCING
            mat4 sofaWorldMat = modelMatrix * instanceMatrix;
            vTwilightWorldPos = (sofaWorldMat * vec4(transformed, 1.0)).xyz;
            vec3 vSofaWorldN = normalize(mat3(sofaWorldMat) * objectNormal);
          #else
            vTwilightWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vec3 vSofaWorldN = normalize(mat3(modelMatrix) * objectNormal);
          #endif
          bool hasOrigLocal = dot(aOrigNormal, aOrigNormal) > 0.01;
          vLocalPos = hasOrigLocal ? aOrigPos : transformed;
          vec3 rawLocN = hasOrigLocal ? aOrigNormal : normal;
          float rawLocNLen2 = dot(rawLocN, rawLocN);
          vLocalNormal = rawLocNLen2 > 1e-6 ? rawLocN * inversesqrt(rawLocNLen2) : vec3(0.0, 1.0, 0.0);

          // Vertex-shader structural AO for sofa upholstery (uFabricCream > 0.5):
          // Strictly focuses on genuine interior crevices (underside, low base rail contact,
          // and tucked cushion bottoms) while keeping outer vertical flanks clean and softly shaded!
          vSofaVertexAo = 1.0;
          vSofaBackBottomAo = 0.0;
          if (uFabricCream > 0.5) {
            float downFacing = clamp(-vSofaWorldN.y, 0.0, 1.0);
            // Only the very bottom apron edge near the wood plinth (world Y = 0.14 .. 0.30m)
            float lowerDeckContact = (1.0 - smoothstep(0.14, 0.30, vTwilightWorldPos.y)) * (0.35 + 0.65 * downFacing);
            // Local underside tucked strictly beneath each cushion / backrest block
            float localBottomTuck = clamp((-vLocalPos.y - 0.07) * 3.2, 0.0, 1.0) * (0.30 + 0.70 * downFacing);
            // Gentle interior seat-to-backrest tuck (only near recessed lower-back contact, never outer vertical walls)
            float seatBackSeamBand = exp(-pow((vTwilightWorldPos.y - 0.44) / 0.10, 2.0)) * clamp((-vLocalPos.y) * 2.8, 0.0, 1.0);

            float rawCrevice = clamp(
              downFacing * 0.48 +
              lowerDeckContact * 0.36 +
              localBottomTuck * 0.34 +
              seatBackSeamBand * 0.24,
              0.0,
              0.85
            );
            vSofaVertexAo = 1.0 - rawCrevice * 0.46;
            vSofaBackBottomAo = clamp(
              lowerDeckContact * 0.44 +
              localBottomTuck * 0.38 +
              seatBackSeamBand * 0.28 +
              downFacing * 0.32,
              0.0,
              0.62
            );
          }
          `
        );

    shader.fragmentShader =
      `
      uniform float uCelEnabled;
      uniform float uOutlineEnabled;
      uniform float uDaylightFactor;
      uniform float uSsaoIntensity;
      uniform float uCeilingAoBoost;
      uniform float uBaseAoBoost;
      uniform vec3 uShadowTint;
      uniform vec3 uHighlightWarmth;
      uniform vec3 uRimColor;
      uniform float uRimStrength;
      uniform vec3 uWindowLightDir;
      uniform float uCloudShadowStrength;
      uniform float uTime;
      uniform sampler2D uBakedGiMap;
      uniform vec4 uBakedGiBounds;
      uniform float uGiIntensity;
      uniform vec3 uGiTint;
      uniform vec3 uShaftColor;
      uniform vec3 uSofaShadowColor;
      uniform float uSofaShadowStrength;
      uniform float uFloorFresnelStrength;
      uniform float uSoftShadowDecay;
      uniform float uLivingLightBoost;
      uniform float uRimScale;
      uniform float uCelStrength;
      uniform float uWoodLacquer;
      uniform float uFabricCream;
      uniform float uFloorFresnel;
      uniform vec4 uDoorRelief;
      varying vec3 vTwilightWorldPos;
      varying vec3 vLocalPos;
      varying vec3 vLocalNormal;
      varying float vSofaVertexAo;
      varying float vSofaBackBottomAo;
      vec3 safeNormalize(vec3 v) {
        float l2 = dot(v, v);
        return l2 > 1e-8 ? v * inversesqrt(l2) : vec3(0.0, 1.0, 0.0);
      }
      ${WINDOW_SHADOW_MASK_GLSL}
      ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      if (uDoorRelief.x > 0.001) {
        // Unified full-height wooden door grain & gentle continuous warmth (zero upper/lower splice!)
        vec3 dLocN = safeNormalize(vLocalNormal);
        float doorH = max(uDoorRelief.z, 1.0);
        float doorHalfW = max(uDoorRelief.w, 0.25);
        float doorVertT = clamp(vLocalPos.y / doorH, 0.0, 1.0);

        // Smooth continuous honey-oak vertical flow across the entire 0..doorH leaf
        vec3 doorGradTint = mix(vec3(0.958, 0.922, 0.870), vec3(1.032, 1.020, 0.992), smoothstep(0.0, 1.0, doorVertT));
        float doorWave = cos(vLocalPos.x * 22.0 + sin(vLocalPos.y * 1.45) * 0.30);
        float doorFiber = sin(vLocalPos.x * 74.0 + sin(vLocalPos.y * 1.75) * 0.16);
        float doorGrain = 0.5 + 0.22 * doorWave + 0.13 * doorFiber;
        vec3 doorGrainShift = mix(vec3(0.980, 0.968, 0.950), vec3(1.020, 1.012, 0.996), clamp(doorGrain, 0.0, 1.0));
        diffuseColor.rgb *= doorGradTint * doorGrainShift;

        // Gentle natural carved-wood chroma warmth inside recessed cavities (自然雕刻凹槽色深)
        float interiorMask =
          smoothstep(0.032, 0.064, vLocalPos.y) *
          smoothstep(0.032, 0.064, doorH - vLocalPos.y) *
          (1.0 - smoothstep(doorHalfW - 0.062, doorHalfW - 0.030, abs(vLocalPos.x)));
        float recessT = clamp((uDoorRelief.x - abs(vLocalPos.z)) / max(uDoorRelief.y, 0.004), 0.0, 1.0) * interiorMask;
        float cavityWarmth = smoothstep(0.28, 0.96, recessT);
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.88, 0.82, 0.75), cavityWarmth * 0.30);
      } else if (uWoodLacquer > 0.01) {
        // Clear luminous MiSide honey-gold wood with gentle painterly vertical gradient & silky grain
        vec3 absN = abs(safeNormalize(vLocalNormal));
        float alongCoord = absN.y > 0.5 ? vLocalPos.x : vLocalPos.y;
        float crossCoord = absN.y > 0.5 ? vLocalPos.z : (absN.x > 0.5 ? vLocalPos.z : vLocalPos.x);

        float archWave = cos(crossCoord * 20.0 + sin(alongCoord * 1.9) * 0.38);
        float fiberLines = sin(crossCoord * 68.0 + sin(alongCoord * 2.4) * 0.25);
        float regularGrain = 0.5 + 0.30 * archWave + 0.16 * fiberLines;

        float edgeDist = absN.y > 0.5
          ? max(abs(vLocalPos.x) * 1.05, abs(vLocalPos.z) * 1.15)
          : max(abs(crossCoord) * 1.35, abs(vLocalPos.y) * 0.52);
        float centerGlow = 1.0 - smoothstep(0.14, 0.74, edgeDist);

        // Smooth top-to-bottom honey gradient: brighter creamy-gold honey toward top, warmer golden-amber toward bottom
        float localVertT = smoothstep(-0.42, 0.42, vLocalPos.y);
        float worldVertT = smoothstep(0.05, 1.35, vTwilightWorldPos.y);
        float honeyGradT = absN.y > 0.5
          ? clamp(0.68 + centerGlow * 0.28, 0.0, 1.0)
          : clamp(localVertT * 0.55 + worldVertT * 0.45, 0.0, 1.0);

        // Clear luminous honey gradient tint (zero dark reddish-brown muddiness)
        vec3 honeyBottomTint = vec3(0.960, 0.905, 0.818);
        vec3 honeyTopTint = vec3(1.062, 1.044, 0.992);
        vec3 gradientTint = mix(honeyBottomTint, honeyTopTint, honeyGradT);
        vec3 grainShift = mix(vec3(0.980, 0.968, 0.946), vec3(1.022, 1.014, 0.996), clamp(regularGrain, 0.0, 1.0));
        diffuseColor.rgb *= mix(vec3(1.0), gradientTint * grainShift, clamp(uWoodLacquer * 0.78, 0.0, 0.78));

        // Gentle warm golden-cream chamfer highlight along rounded furniture edges
        float bevelEdge = 1.0 - smoothstep(0.76, 0.992, max(absN.x, max(absN.y, absN.z)));
        float underShelfCavity = clamp(-vLocalNormal.y, 0.0, 1.0) * 0.10;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.045, 1.028, 0.990), bevelEdge * uWoodLacquer * 0.24);
        diffuseColor.rgb *= (1.0 - underShelfCavity * uWoodLacquer * 0.45);
      }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `
      #include <lights_fragment_end>
      float ssaoScale = clamp(uSsaoIntensity, 0.4, 2.5);
      float ceilingBoost = clamp(uCeilingAoBoost, 0.6, 2.5);
      float baseBoost = clamp(uBaseAoBoost, 0.6, 2.5);

      // Living Room smooth spatial zone mask for the Modern Overhead Chandelier ON boost
      // Strictly 0 when OFF -> 100% identical to baseline lighting & shadows!
      // Transitions sharply inside the X=-1.22 partition core (-1.21..-1.15) so the Living Room
      // West wall face (X=-1.14) matches the other 3 walls 100% with zero bleed into the Bedroom (X=-1.30)!
      float livingZoneX = smoothstep(-1.21, -1.15, vTwilightWorldPos.x) * (1.0 - smoothstep(7.24, 7.36, vTwilightWorldPos.x));
      float livingZoneZ = smoothstep(-10.45, -10.22, vTwilightWorldPos.z) * (1.0 - smoothstep(0.18, 0.34, vTwilightWorldPos.z));
      float livingZoneY = smoothstep(-0.20, 0.05, vTwilightWorldPos.y) * (1.0 - smoothstep(3.38, 3.65, vTwilightWorldPos.y));
      float livingBoost = clamp(uLivingLightBoost, 0.0, 1.0) * livingZoneX * livingZoneZ * livingZoneY;

      // Sample apartment-wide baked indoor Global Illumination & perimeter AO
      vec2 giUv = vec2(
        clamp((vTwilightWorldPos.x - uBakedGiBounds.x) * uBakedGiBounds.z, 0.002, 0.998),
        clamp(1.0 - (vTwilightWorldPos.z - uBakedGiBounds.y) * uBakedGiBounds.w, 0.002, 0.998)
      );
      vec3 giSample = texture2D(uBakedGiMap, giUv).rgb;
      float mainFloorMask = smoothstep(-0.35, 0.05, vTwilightWorldPos.y);
      float floorContactW = 1.0 - smoothstep(0.01, 0.74, vTwilightWorldPos.y);
      float wallCreviceW = 1.0 - smoothstep(0.35, 2.85, vTwilightWorldPos.y);
      float giLum = mix(0.96, mix(0.86, 1.16, giSample.r) * uGiIntensity, mainFloorMask);
      vec3 giBounceHue = mix(uShadowTint * 0.88 + vec3(0.22), uGiTint, giSample.g);
      // Balanced midpoint wall-corner, furniture-base & baseboard AO weight
      float giAoWeight = clamp((0.44 + 0.49 * floorContactW * baseBoost + 0.24 * wallCreviceW) * (0.76 + 0.25 * ssaoScale), 0.0, 1.0);
      float giAo = mix(1.0, mix(mix(0.37, 0.86, livingBoost * 0.75), 1.0, giSample.b), mainFloorMask * giAoWeight);

      // Three.js BRDF_Lambert scales diffuseColor by RECIPROCAL_PI (0.318309886)
      vec3 lambertAlb = max(material.diffuseColor * 0.318309886, vec3(0.0001));

      reflectedLight.indirectDiffuse *= giAo * giLum;
      reflectedLight.indirectDiffuse += lambertAlb * giBounceHue * (0.145 * giLum * giAo);
      reflectedLight.directDiffuse *= mix(mix(0.64, 0.94, livingBoost * 0.75), 1.0, mix(1.0, giSample.b, mainFloorMask * clamp((0.40 + 0.57 * floorContactW * baseBoost) * ssaoScale * 0.82, 0.0, 1.0)));

      if (uCelEnabled > 0.5) {
        // Gentle animated window foliage/cloud dapple in Living Room window zone
        float inLivingRoom = smoothstep(-1.21, -1.15, vTwilightWorldPos.x) *
                             (1.0 - smoothstep(0.16, 0.32, vTwilightWorldPos.z)) *
                             smoothstep(-0.15, 0.05, vTwilightWorldPos.y);
        float dynamicShadow = 1.0;
        float projectedPaneGlow = 0.0;
        if (inLivingRoom > 0.002) {
          float distToEastWall = max(0.0, 7.35 - vTwilightWorldPos.x);
          float rayT = distToEastWall / max(uWindowLightDir.x, 0.001);
          vec3 winProj = vTwilightWorldPos + uWindowLightDir * rayT;
          vec2 extMask = evalExteriorShadowMask(winProj.y, winProj.z, distToEastWall, uTime);
          dynamicShadow = mix(1.0, extMask.x, inLivingRoom * uCloudShadowStrength * 0.26 * (1.0 - livingBoost * 0.65));
          projectedPaneGlow = extMask.y * extMask.x * inLivingRoom;
          reflectedLight.directDiffuse *= dynamicShadow;
        }

        vec3 directIrradiance = reflectedLight.directDiffuse / lambertAlb;
        float dLum = dot(directIrradiance, vec3(0.299, 0.587, 0.114));

        vec3 worldNormal = safeNormalize((vec4(normal, 0.0) * viewMatrix).xyz);
        vec3 geomWorldNormal = safeNormalize((vec4(geometryNormal, 0.0) * viewMatrix).xyz);

        // 3D Face Orientation & micro-bump relief without crushing shadow luminance
        float halfLambert = clamp(dot(worldNormal, uWindowLightDir) * 0.5 + 0.5, 0.0, 1.0);
        float softWrap = smoothstep(0.0, 1.0, halfLambert);
        float topFaceBoost = smoothstep(0.25, 0.88, worldNormal.y);
        vec3 bumpDeltaWorld = worldNormal - geomWorldNormal;
        float bumpLightRelief = clamp(dot(bumpDeltaWorld, uWindowLightDir) * 1.15, -0.10, 0.14);

        // Luminance-preserving chromatic twilight tints:
        // Shifts shadows gently toward pastel twilight lavender/mauve and warms lit faces
        // WITHOUT stacking extra multiplicative AO darkening into corners or furniture bases.
        float isSofaMask = step(0.5, uFabricCream);
        float stLum = max(dot(uShadowTint, vec3(0.299, 0.587, 0.114)), 0.08);
        vec3 chromaShadowTint = clamp((uShadowTint / stLum) * 0.96, vec3(0.76), vec3(1.14));

        float hwLum = max(dot(uHighlightWarmth, vec3(0.299, 0.587, 0.114)), 0.10);
        vec3 chromaWarmTint = clamp((uHighlightWarmth / hwLum) * 1.02, vec3(0.88), vec3(1.14));

        float shadowHueMask = (1.0 - smoothstep(0.06, 0.95, dLum)) * (1.0 - livingBoost * 0.65);
        float creviceHueMask = clamp((1.0 - giSample.b) * 0.50 * mainFloorMask * (0.75 + 0.25 * ssaoScale) * (1.0 - livingBoost * 0.65), 0.0, 0.45);
        float litFaceMask = smoothstep(0.18, 0.92, 0.55 * softWrap + 0.45 * topFaceBoost);

        // Gentle highlight shoulder polish so lit areas feel silky & anime-styled, never harsh or flat
        vec3 softDirectIrr = (directIrradiance / (vec3(1.0) + directIrradiance * 0.14)) * mix(vec3(1.0), chromaWarmTint, 0.42 * litFaceMask);
        vec3 polishedDirect = lambertAlb * mix(directIrradiance, softDirectIrr, 0.34 * uCelStrength);
        reflectedLight.directDiffuse = polishedDirect * (1.0 + bumpLightRelief * 0.28 + topFaceBoost * 0.045);

        float shaftLuma = dot(uShaftColor, vec3(0.299, 0.587, 0.114));
        float paneGlowScale = uDaylightFactor > 0.5 ? 0.11 : (0.12 * smoothstep(0.18, 0.65, shaftLuma));
        reflectedLight.directDiffuse += lambertAlb * chromaWarmTint * projectedPaneGlow * softWrap * paneGlowScale;

        // Preserve all real local lamp lighting while harmonizing shadow hue & subtle airy twilight fill
        vec3 indirectChromaMul = mix(
          vec3(1.0),
          chromaShadowTint,
          clamp((0.20 * shadowHueMask + 0.22 * creviceHueMask) * uCelStrength * (1.0 - isSofaMask * 0.78), 0.0, 0.42)
        );
        vec3 airyFillHue = mix(uShadowTint * 0.85 + vec3(0.04, 0.035, 0.06), uHighlightWarmth * 0.96, 0.44 * topFaceBoost + 0.40 * softWrap);
        float airyFillAmt = (uDaylightFactor > 0.5 ? 0.065 : 0.072) * uCelStrength * (0.50 + 0.50 * giAo) * (1.0 - livingBoost * 0.55);
        reflectedLight.indirectDiffuse =
          reflectedLight.indirectDiffuse * indirectChromaMul * (1.0 + bumpLightRelief * 0.22) +
          lambertAlb * airyFillHue * airyFillAmt;

        // Preserve glossy & metallic specular highlights so metal ducts/racks/tiles stay tactile
        float specKeep = mix(mix(0.68, 0.88, uWoodLacquer), 0.98, metalnessFactor) * (1.0 - isSofaMask);
        reflectedLight.directSpecular *= specKeep;
        reflectedLight.indirectSpecular *= specKeep;

        // Subtle anime twilight grazing rim light for clean 3D silhouette separation
        float ndotv = clamp(dot(safeNormalize(normal), safeNormalize(geometryViewDir)), 0.0, 1.0);
        float rimPower = pow(max(1.0 - ndotv, 0.0001), 3.6);
        float rimWeight = rimPower * uRimStrength * uRimScale * (0.35 + 0.65 * softWrap) * dynamicShadow * (1.0 - isSofaMask);
        float rimIntensity = uDaylightFactor > 0.5 ? 0.16 : 0.20;
        reflectedLight.indirectDiffuse += uRimColor * lambertAlb * rimWeight * rimIntensity * (0.55 + 0.45 * giAo);

        // Living Room Ceiling Lamp ON radiance boost (strictly 0 when OFF!)
        if (livingBoost > 0.001) {
          float overheadCatch = 0.76 + 0.24 * clamp(worldNormal.y * 0.5 + 0.5, 0.0, 1.0);
          reflectedLight.indirectDiffuse += lambertAlb * vec3(1.0, 0.968, 0.915) * (0.46 * livingBoost * overheadCatch);
        }

        // =====================================================================
        // SOFA VERTEX-SHADER AO + DYNAMIC LIGHT-TEMPERATURE SHADOW SHADING
        // =====================================================================
        if (uFabricCream > 0.5) {
          vec3 worldN = safeNormalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float topSun = clamp(max(0.0, worldN.y) * 0.50 + softWrap * 0.50, 0.0, 1.0);
          float vertexOcc = clamp(1.0 - vSofaVertexAo, 0.0, 1.0);
          float giCrevice = clamp((1.0 - giSample.b) * 0.22, 0.0, 1.0);
          float bumpCrevice = clamp(max(0.0, -bumpLightRelief) * 1.15, 0.0, 1.0);

          float sofaCreviceMask = clamp(
            vertexOcc * 0.46 +
            vSofaBackBottomAo * 0.22 +
            giCrevice * 0.16 +
            (1.0 - topSun) * 0.12 +
            bumpCrevice * 0.14,
            0.0,
            0.76
          );
          float deepShadowFactor = smoothstep(0.26, 0.94, sofaCreviceMask) * clamp(uSofaShadowStrength, 0.22, 0.48) * (1.0 - livingBoost * 0.45);

          float sunlitCrownMask = smoothstep(0.24, 0.84, topSun) * (1.0 - smoothstep(0.24, 0.68, sofaCreviceMask));
          float outerFlankSoftLift = (1.0 - abs(worldN.y)) * (1.0 - smoothstep(0.18, 0.55, vertexOcc));
          vec3 litCrownTint = mix(vec3(1.0), chromaWarmTint, 0.34);
          reflectedLight.indirectDiffuse += lambertAlb * litCrownTint * (0.14 * sunlitCrownMask + 0.08 * outerFlankSoftLift) * clamp(vSofaVertexAo, 0.68, 1.0);
          reflectedLight.directDiffuse *= mix(vec3(1.0), litCrownTint, sunlitCrownMask * 0.65);

          vec3 tempDeepMul = mix(vec3(1.0), clamp(uSofaShadowColor * 1.24, vec3(0.74), vec3(0.98)), deepShadowFactor);
          float aoDarken = mix(1.0, 0.90, smoothstep(0.36, 0.95, sofaCreviceMask * 0.62 + vSofaBackBottomAo * 0.35));
          reflectedLight.directDiffuse *= tempDeepMul * aoDarken;
          reflectedLight.indirectDiffuse *= tempDeepMul * aoDarken;
          reflectedLight.directSpecular = vec3(0.0);
          reflectedLight.indirectSpecular = vec3(0.0);
        }

        // =====================================================================
        // WOOD FLOOR VIEW-ANGLE FRESNEL MICRO-REFLECTION
        // =====================================================================
        if (uFloorFresnel > 0.01 && uFloorFresnelStrength > 0.01) {
          vec3 floorViewN = safeNormalize(normal);
          vec3 floorGeomN = safeNormalize(geometryNormal);
          vec3 floorViewDir = safeNormalize(geometryViewDir);
          float ndvFloor = clamp(dot(floorViewN, floorViewDir), 0.0, 1.0);
          float fresnelGrazing = pow(max(1.0 - ndvFloor, 0.0001), 3.6);
          float seamBevelSlope = clamp(length(floorViewN - floorGeomN) * 5.2, 0.0, 1.0);
          float satinSmoothness = clamp(1.0 - roughnessFactor, 0.04, 0.45);
          vec3 worldViewDir = safeNormalize((vec4(floorViewDir, 0.0) * viewMatrix).xyz);
          vec3 halfVec = safeNormalize(uWindowLightDir + worldViewDir);
          float microSpecLobe = pow(clamp(dot(worldNormal, halfVec), 0.0, 1.0), mix(14.0, 28.0, satinSmoothness));

          float seamMicroLuster = (0.30 * fresnelGrazing + 0.60 * fresnelGrazing * seamBevelSlope) * (0.40 + 0.90 * satinSmoothness);
          float twilightSheenWeight = uFloorFresnel * clamp(uFloorFresnelStrength, 0.0, 1.5) * (0.45 + 0.55 * giAo);
          vec3 floorSheenColor = mix(uHighlightWarmth, uRimColor, 0.42);

          vec3 grazingMicroSpec = floorSheenColor * (seamMicroLuster * 0.052 + microSpecLobe * seamBevelSlope * 0.032) * twilightSheenWeight;
          reflectedLight.indirectSpecular += grazingMicroSpec;
          reflectedLight.directSpecular += floorSheenColor * microSpecLobe * (0.014 + 0.024 * seamBevelSlope) * twilightSheenWeight;
        }
      } else if (livingBoost > 0.001) {
        reflectedLight.indirectDiffuse += lambertAlb * vec3(1.0, 0.975, 0.935) * (0.40 * livingBoost);
      }

      // =======================================================================
      // MISIDE SOFT SATIN-MATTE CLEARCOAT WOOD SHEEN & WARM BLUSH EDGE GLOW
      // Subdued, wide, velvety warm-pink/warm-amber sheen that preserves deep
      // peach-apricot wood color without glaring pure-white highlights.
      // =======================================================================
      if (uWoodLacquer > 0.05) {
        vec3 woodViewN = safeNormalize(normal);
        vec3 woodGeomN = safeNormalize(geometryNormal);
        vec3 woodViewV = safeNormalize(geometryViewDir);
        vec3 woodWorldN = safeNormalize((vec4(woodViewN, 0.0) * viewMatrix).xyz);
        vec3 woodWorldV = safeNormalize((vec4(woodViewV, 0.0) * viewMatrix).xyz);
        vec3 woodAbsLocN = abs(safeNormalize(vLocalNormal));

        float ndvWood = clamp(dot(woodViewN, woodViewV), 0.0, 1.0);
        // Gentle grazing Fresnel luster across tabletops, drawer fronts & rounded corners
        float woodFresnel = pow(max(1.0 - ndvWood, 0.0001), 2.85);
        // Detect beveled/curved corners & drawer chamfers so edges catch a warm sheen
        float chamferMask = 1.0 - smoothstep(0.76, 0.992, max(woodAbsLocN.x, max(woodAbsLocN.y, woodAbsLocN.z)));
        float bumpNormalDelta = clamp(length(woodViewN - woodGeomN) * 3.2, 0.0, 1.0);
        float edgeCatch = clamp(chamferMask * 0.80 + bumpNormalDelta * 0.30, 0.0, 1.0);

        // Wide, silky, low-intensity clearcoat lobe (sweeps softly across wood without washing it out)
        vec3 keyLightDir = safeNormalize(mix(uWindowLightDir, vec3(0.28, 0.86, 0.42), 0.48));
        vec3 keyHalf = safeNormalize(keyLightDir + woodWorldV);
        float broadSpec = pow(clamp(dot(woodWorldN, keyHalf), 0.0, 1.0), 7.5);
        vec3 topFillHalf = safeNormalize(vec3(0.0, 1.0, 0.0) + woodWorldV);
        float topSoftSheen = pow(clamp(dot(woodWorldN, topFillHalf), 0.0, 1.0), 5.5) * smoothstep(-0.1, 0.85, woodWorldN.y);

        // Soft luminous golden-honey / warm cream micro-sheen (never harsh pure white)
        vec3 satinWarmTint = mix(vec3(1.0, 0.928, 0.818), vec3(1.0, 0.955, 0.862), uDaylightFactor * 0.50);
        float lacquerAmt = clamp(uWoodLacquer, 0.0, 1.0) * (0.55 + 0.45 * giAo);

        // Gently warm-tint Three.js physical clearcoat specular so overhead lamps never bleach wood white
        vec3 woodSpecTint = mix(vec3(1.0), vec3(1.0, 0.935, 0.835), clamp(uWoodLacquer * 0.68, 0.0, 0.68));
        reflectedLight.directSpecular = reflectedLight.directSpecular * woodSpecTint * 0.56;
        reflectedLight.indirectSpecular = reflectedLight.indirectSpecular * woodSpecTint * 0.50;

        vec3 broadClearcoat = satinWarmTint * (broadSpec * 0.032 + topSoftSheen * 0.022) * lacquerAmt;
        vec3 edgeFresnelGlow = satinWarmTint * woodFresnel * (0.024 + 0.050 * edgeCatch) * lacquerAmt;

        reflectedLight.directSpecular += broadClearcoat;
        reflectedLight.indirectSpecular += edgeFresnelGlow;
      }

      // =======================================================================
      // GEOMETRY-BASED WOODEN DOOR RECESSED PANEL DEPTH SHADOW & BEVEL RELIEF
      // Replaces harsh outline strokes with true volumetric recess-depth AO,
      // overhead lip overhang shadows, directional side-bevel shading, and
      // silky upward-bevel satin catchlights driven purely by 3D geometry.
      // =======================================================================
      if (uDoorRelief.x > 0.001) {
        vec3 dLocN = safeNormalize(vLocalNormal);
        vec3 dWorldN = safeNormalize((vec4(safeNormalize(normal), 0.0) * viewMatrix).xyz);
        float doorH = max(uDoorRelief.z, 1.0);
        float doorHalfW = max(uDoorRelief.w, 0.25);

        // Strictly isolate interior carved panel molding & coffers from outer door perimeter rim
        float interiorMask =
          smoothstep(0.032, 0.064, vLocalPos.y) *
          smoothstep(0.032, 0.064, doorH - vLocalPos.y) *
          (1.0 - smoothstep(doorHalfW - 0.062, doorHalfW - 0.030, abs(vLocalPos.x)));

        // Physical recess depth from outer door surface (0.0 = outer stiles/rails, 1.0 = deepest groove floor)
        float recessT = clamp((uDoorRelief.x - abs(vLocalPos.z)) / max(uDoorRelief.y, 0.004), 0.0, 1.0) * interiorMask;
        float slopeAmt = clamp(1.0 - abs(dLocN.z), 0.0, 1.0) * interiorMask;

        // Directional 3D bevel orientation
        float downBevel = clamp(-dLocN.y, 0.0, 1.0) * interiorMask;
        float upBevel = clamp(dLocN.y, 0.0, 1.0) * interiorMask;
        float sideBevel = abs(dLocN.x) * interiorMask;

        vec3 doorKeyDir = safeNormalize(mix(uWindowLightDir, vec3(0.24, 0.84, 0.36), 0.56));
        float sideDot = dot(dWorldN, doorKeyDir);
        float sideShadow = smoothstep(0.26, -0.52, sideDot) * sideBevel;
        float sideCatch = smoothstep(0.14, 0.78, sideDot) * sideBevel;

        // Natural carved-wood recessed channel & directional bevel self-occlusion (自然雕刻立体阴影，不过重)
        float deepGroove = smoothstep(0.54, 0.98, recessT);
        float bevelRecess = smoothstep(0.05, 0.86, recessT) * slopeAmt;
        float panelSetback = smoothstep(0.18, 0.50, recessT) * (1.0 - slopeAmt) * (1.0 - deepGroove);

        float doorOcc = clamp(
          deepGroove * 0.38 +
          downBevel * (0.30 + 0.18 * recessT) +
          bevelRecess * 0.18 +
          sideShadow * 0.24 +
          panelSetback * 0.06,
          0.0,
          0.54
        );

        // Natural warm honey-wood carved relief shadow (subtle, realistic, never heavy black lines)
        vec3 warmDepthColor = vec3(0.52, 0.43, 0.35);
        vec3 depthMul = mix(vec3(1.0), warmDepthColor, doorOcc);
        reflectedLight.directDiffuse *= depthMul;
        reflectedLight.indirectDiffuse *= mix(vec3(1.0), warmDepthColor * 1.08, doorOcc);
        reflectedLight.directSpecular *= (1.0 - doorOcc * 0.60);
        reflectedLight.indirectSpecular *= (1.0 - doorOcc * 0.52);

        // Soft satin catchlight on upward-facing carved bevel sills
        float bevelCatch = clamp(upBevel * (0.46 + 0.54 * (1.0 - deepGroove)) + sideCatch * 0.34, 0.0, 1.0);
        vec3 warmCatchTint = mix(vec3(1.0, 0.955, 0.875), vec3(1.0, 0.972, 0.910), uDaylightFactor * 0.5);
        reflectedLight.indirectDiffuse += lambertAlb * warmCatchTint * (bevelCatch * 0.17);
        reflectedLight.directSpecular += warmCatchTint * (bevelCatch * 0.025);
      }

      // Smooth filmic highlight shoulder compression for non-emissive diffuse surfaces
      // (Expands headroom cleanly only when Living Room modern chandelier is switched ON!)
      vec3 totalDiff = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
      float diffPeak = max(totalDiff.r, max(totalDiff.g, totalDiff.b));
      if (diffPeak > 0.0001) {
        float baseMaxCap = uFabricCream > 0.5 ? 0.72 : 0.64;
        float maxCap = baseMaxCap + livingBoost * 0.56;
        float gain = mix(0.92, 1.04, livingBoost);
        float compressedPeak = (diffPeak * gain) / (1.0 + (diffPeak * gain) / maxCap);
        float diffScale = compressedPeak / diffPeak;
        reflectedLight.directDiffuse *= diffScale;
        reflectedLight.indirectDiffuse *= diffScale;
      }
      float specCap = mix(0.06, 0.115, clamp(uWoodLacquer, 0.0, 1.0));
      reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(specCap));
      reflectedLight.indirectSpecular = min(reflectedLight.indirectSpecular, vec3(specCap));
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      // =======================================================================
      // MISIDE SHADOW-EXTRACTED SMOOTH SILHOUETTE CONTOUR (STRICTLY GATED BY uOutlineEnabled)
      // - Completely disables all shader contours when inkOutlines is turned off!
      // - Eliminates coarse 2x2-pixel fwidth(viewN) jagged aliasing artifacts on
      //   bedroom furniture, wainscoting & architectural trim, using purely smooth
      //   analytical grazing silhouette falloff on curved forms only.
      // =======================================================================
      if (uCelEnabled > 0.5 && uOutlineEnabled > 0.5) {
        vec3 shadedCol = max(gl_FragColor.rgb, vec3(0.004));
        vec3 baseCol = clamp(diffuseColor.rgb, vec3(0.04), vec3(1.0));
        float baseLum = dot(baseCol, vec3(0.299, 0.587, 0.114));
        float maxCh = max(baseCol.r, max(baseCol.g, baseCol.b));
        float minCh = min(baseCol.r, min(baseCol.g, baseCol.b));
        float sat = (maxCh - minCh) / max(maxCh, 0.001);

        float isWhiteObj = smoothstep(0.68, 0.88, baseLum) * (1.0 - smoothstep(0.10, 0.26, sat));
        float isGreenPlant = smoothstep(0.03, 0.14, baseCol.g - max(baseCol.r, baseCol.b));

        vec3 woodShadowMul = vec3(0.42, 0.33, 0.29);
        vec3 whiteShadowMul = vec3(0.48, 0.44, 0.54);
        vec3 greenShadowMul = vec3(0.28, 0.42, 0.31);

        vec3 shadowMul = mix(woodShadowMul, whiteShadowMul, isWhiteObj * 0.90);
        shadowMul = mix(shadowMul, greenShadowMul, isGreenPlant * 0.92);

        vec3 deepShadowOutline = min(shadedCol * shadowMul, shadedCol * 0.62);
        vec3 albedoDeepShadow = min(baseCol * shadowMul * mix(0.44, 0.30, isWhiteObj), shadedCol * 0.60);
        vec3 sameHueOutline = mix(deepShadowOutline, albedoDeepShadow, 0.30);
        float shadedLum = dot(shadedCol, vec3(0.299, 0.587, 0.114));
        sameHueOutline = max(sameHueOutline, vec3(0.024, 0.018, 0.028) * smoothstep(0.02, 0.20, shadedLum));

        // Purely smooth analytical grazing silhouette (zero fwidth 2x2 pixel-block jaggies!)
        vec3 viewN = safeNormalize(geometryNormal);
        vec3 viewV = safeNormalize(geometryViewDir);
        float ndv = clamp(dot(viewN, viewV), 0.0, 1.0);
        float smoothSil = smoothstep(0.22, 0.03, ndv) * pow(max(1.0 - ndv, 0.0001), 3.2);

        // Suppress fragment silhouette on flat axis-aligned walls, wainscoting panels, floors & ceilings
        // so grazing views along walls/wainscoting NEVER develop dark edges!
        vec3 worldG = safeNormalize((vec4(geometryNormal, 0.0) * viewMatrix).xyz);
        float maxAxisAlign = max(abs(worldG.x), max(abs(worldG.y), abs(worldG.z)));
        float isFlatArchPlane = smoothstep(0.985, 0.999, maxAxisAlign);

        float isSofaContour = step(0.5, uFabricCream);
        vec3 sofaContourCol = min(shadedCol * 0.64, uSofaShadowColor * 0.68);
        vec3 finalContourCol = mix(sameHueOutline, sofaContourCol, isSofaContour);

        float camDist = length(vViewPosition);
        float distAtten = clamp(1.36 / (1.0 + camDist * camDist * 0.085), 0.0, 1.0);
        float finalOutlineMask = smoothSil * distAtten * (1.0 - isFlatArchPlane * 0.94);

        gl_FragColor.rgb = mix(gl_FragColor.rgb, finalContourCol, clamp(finalOutlineMask * mix(0.54, 0.42, isSofaContour), 0.0, 0.58));
      }

      #include <dithering_fragment>
      // Guard against NaN or Infinity entering HalfFloatType UnrealBloomPass mip pyramid
      if (!(gl_FragColor.r >= 0.0 && gl_FragColor.r < 60000.0)) gl_FragColor.r = 0.45;
      if (!(gl_FragColor.g >= 0.0 && gl_FragColor.g < 60000.0)) gl_FragColor.g = 0.42;
      if (!(gl_FragColor.b >= 0.0 && gl_FragColor.b < 60000.0)) gl_FragColor.b = 0.40;
      gl_FragColor.rgb = clamp(gl_FragColor.rgb, vec3(0.0), vec3(3.2));
      `
    );
  };

  return mat;
}

/**
 * Physically-grounded optical architectural glass shader for display cabinets
 * and kitchen hutches — eliminates cheap painted white stripes in favor of:
 * - True Schlick Fresnel grazing reflections (clear straight-on, lustrous at angles)
 * - Analytical indoor window + overhead warm lamp environment reflection & GGX specular
 * - Soda-lime glass edge thickness absorption tint + crisp 5mm polished bevel catchlight
 * - Subtle optical surface micro-ripple so reflections glide naturally as the camera moves
 */
export function createArchitecturalGlassMaterial(
  shared: TwilightUniforms,
  options?: {
    tintHex?: number;
    edgeTintHex?: number;
    baseOpacity?: number;
    maxFresnelOpacity?: number;
    bevelWidth?: number;
    bevelStrength?: number;
  }
): THREE.ShaderMaterial {
  const tint = new THREE.Color(options?.tintHex ?? 0xebf6f4);
  const edgeTint = new THREE.Color(options?.edgeTintHex ?? 0x626a73);
  return new THREE.ShaderMaterial({
    uniforms: {
      uDaylightFactor: shared.uDaylightFactor,
      uNightFactor: shared.uNightFactor,
      uWindowLightDir: shared.uWindowLightDir,
      uShaftColor: shared.uShaftColor,
      uHighlightWarmth: shared.uHighlightWarmth,
      uRimColor: shared.uRimColor,
      uTint: { value: tint },
      uEdgeTint: { value: edgeTint },
      uBaseOpacity: { value: options?.baseOpacity ?? 0.06 },
      uMaxFresnelOpacity: { value: options?.maxFresnelOpacity ?? 0.38 },
      uBevelWidth: { value: options?.bevelWidth ?? 0.022 },
      uBevelStrength: { value: options?.bevelStrength ?? 0.22 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uDaylightFactor;
      uniform float uNightFactor;
      uniform vec3 uWindowLightDir;
      uniform vec3 uShaftColor;
      uniform vec3 uHighlightWarmth;
      uniform vec3 uRimColor;
      uniform vec3 uTint;
      uniform vec3 uEdgeTint;
      uniform float uBaseOpacity;
      uniform float uMaxFresnelOpacity;
      uniform float uBevelWidth;
      uniform float uBevelStrength;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vWorldNormal);
        if (!gl_FrontFacing) N = -N;

        // Subtle tempered-glass surface micro-wave so room reflections breathe naturally as you walk
        float microRipple = sin(vWorldPos.y * 9.5 + vWorldPos.z * 7.2) * 0.009;
        vec3 Nopt = normalize(N + vec3(0.0, microRipple, -microRipple * 0.7));

        // 1. Physical Schlick Fresnel (IOR ~ 1.52 -> F0 = 0.042)
        float ndv = clamp(dot(Nopt, V), 0.0, 1.0);
        float fresnel = 0.042 + 0.958 * pow(1.0 - ndv, 4.0);

        // 2. Optical perimeter thickness absorption + crisp 5mm beveled glass edge catchlight
        float dx = min(vUv.x, 1.0 - vUv.x);
        float dy = min(vUv.y, 1.0 - vUv.y);
        float edgeDist = min(dx, dy);

        // Soft emerald/aqua soda-lime edge absorption within the outer bevel band
        float edgeAbsorb = 1.0 - smoothstep(0.0, uBevelWidth * 1.45, edgeDist);
        // Sharp polished 45-degree bevel glint right along the perimeter chamfer
        float bevelLine = smoothstep(uBevelWidth * 0.92, uBevelWidth * 0.30, edgeDist) *
                          (1.0 - smoothstep(uBevelWidth * 0.24, 0.002, edgeDist));
        // Slight directional variation around bevel edges so top/side bevel catches warm window light
        float topLeftBevel = smoothstep(0.35, 0.98, vUv.y) * 0.65 + smoothstep(0.35, 0.98, 1.0 - vUv.x) * 0.35;

        // 3. Analytical Indoor Room Environment Reflection (window softbox + warm ceiling bounce + lower wood counter bounce)
        vec3 R = reflect(-V, Nopt);
        float skyUp = smoothstep(-0.25, 0.75, R.y);
        vec3 lowerBounce = mix(vec3(0.46, 0.36, 0.30), vec3(0.18, 0.16, 0.24), uNightFactor);
        vec3 upperRoom = mix(
          mix(vec3(0.95, 0.86, 0.82), vec3(0.96, 0.98, 1.0), uDaylightFactor),
          vec3(0.36, 0.44, 0.62),
          uNightFactor
        );
        vec3 envRefl = mix(lowerBounce, upperRoom, skyUp);

        // Soft diffused reflection of the bright East/South kitchen windows in reflection direction
        vec3 winDir = normalize(mix(uWindowLightDir, vec3(-0.65, 0.38, -0.58), 0.55));
        float winSoftbox = pow(clamp(dot(R, winDir), 0.0, 1.0), 10.0);
        float winSoftboxCore = pow(clamp(dot(R, winDir), 0.0, 1.0), 42.0);
        vec3 winColor = mix(uShaftColor * 1.15, vec3(0.62, 0.76, 1.0), uNightFactor * 0.65);

        // Secondary warm overhead kitchen ceiling lamp reflection lobe
        vec3 lampDir = normalize(vec3(-0.42, 0.84, -0.34));
        vec3 Hlamp = normalize(lampDir + V);
        float lampSpec = pow(clamp(dot(Nopt, Hlamp), 0.0, 1.0), 84.0);
        vec3 lampCol = mix(vec3(1.0, 0.93, 0.80), vec3(1.0, 0.88, 0.72), uNightFactor);

        // Primary tight specular gleam from directional room light
        vec3 Hwin = normalize(winDir + V);
        float winSpec = pow(clamp(dot(Nopt, Hwin), 0.0, 1.0), 128.0);

        vec3 reflectionCol = envRefl * (0.68 + 0.32 * uDaylightFactor) +
                             winColor * (winSoftbox * 0.32 + winSoftboxCore * 0.42) +
                             lampCol * (lampSpec * 0.58) +
                             mix(uHighlightWarmth, vec3(1.0), 0.45) * (winSpec * 0.65);

        // Combine subtle clear-glass body tint, soft grey/tinted edge absorption, Fresnel reflection & delicate bevel catchlight
        vec3 glassBody = mix(uTint, uEdgeTint, edgeAbsorb * 0.58);
        vec3 bevelCol = mix(uEdgeTint * 1.18, uRimColor, 0.25);
        vec3 bevelGlint = bevelCol * bevelLine * (0.20 + 0.30 * topLeftBevel) * uBevelStrength;
        vec3 finalRgb = mix(glassBody, reflectionCol, clamp(fresnel * 1.25 + 0.18, 0.0, 0.92)) + bevelGlint;

        // Alpha: crystal-clear straight on, refined subtle grey edge without harsh bright white framing
        float specAlpha = (winSpec * 0.30 + lampSpec * 0.22 + winSoftboxCore * 0.12);
        float alpha = mix(uBaseOpacity, uMaxFresnelOpacity, clamp(fresnel * 1.12, 0.0, 1.0)) +
                      edgeAbsorb * (0.09 * clamp(uBevelStrength * 2.2, 0.25, 1.0)) +
                      bevelLine * (0.06 * uBevelStrength) +
                      specAlpha;

        gl_FragColor = vec4(clamp(finalRgb, vec3(0.0), vec3(1.6)), clamp(alpha, 0.04, 0.72));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/**
 * Creates an ultra-soft, view-angle-feathered atmospheric window light glow
 * ShaderMaterial with zero hard ray edges or laser stripes, gently modulated
 * by drifting clouds and swaying exterior foliage.
 */
export function createLightShaftShaderMaterial(
  shared: TwilightUniforms,
  windowZ: number,
  baseOpacity: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uDaylightFactor: shared.uDaylightFactor,
      uNightFactor: shared.uNightFactor,
      uShaftColor: shared.uShaftColor,
      uWindowLightDir: shared.uWindowLightDir,
      uSoftShadowDecay: shared.uSoftShadowDecay,
      uWindowZ: { value: windowZ },
      uBaseOpacity: { value: baseOpacity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDaylightFactor;
      uniform float uNightFactor;
      uniform vec3 uShaftColor;
      uniform vec3 uWindowLightDir;
      uniform float uSoftShadowDecay;
      uniform float uWindowZ;
      uniform float uBaseOpacity;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      ${WINDOW_SHADOW_MASK_GLSL}

      void main() {
        // Project point along shaft back to the East window plane (X = 7.35)
        float distFromWin = max(0.0, 7.35 - vWorldPos.x);
        float rayT = distFromWin / max(uWindowLightDir.x, 0.001);
        vec3 winProj = vWorldPos + uWindowLightDir * rayT;

        // Evaluate soft swaying tree foliage & drifting cloud shadow mask at window aperture
        vec2 mask = evalExteriorShadowMask(winProj.y, winProj.z, distFromWin * 0.5, uTime);

        // View-angle grazing fade: eliminates any visible planar slice edge from any camera angle!
        vec3 viewVec = cameraPosition - vWorldPos;
        float viewLen2 = dot(viewVec, viewVec);
        vec3 viewDir = viewLen2 > 1e-6 ? viewVec * inversesqrt(viewLen2) : vec3(0.0, 0.0, 1.0);
        float normLen2 = dot(vWorldNormal, vWorldNormal);
        vec3 safeWNormal = normLen2 > 1e-6 ? vWorldNormal * inversesqrt(normLen2) : vec3(0.0, 1.0, 0.0);
        float viewGrazingFade = pow(clamp(abs(dot(safeWNormal, viewDir)), 0.0001, 1.0), 1.35);

        // Smooth Gaussian bell profile across vertical & transverse axes
        float bellY = max(0.0001, sin(clamp(vUv.y, 0.001, 0.999) * 3.14159));
        bellY = pow(bellY, 1.45);

        // Smooth longitudinal diffusion from the bright window pane (vUv.x -> 1.0) into the room (vUv.x -> 0.0)
        float lengthFade = smoothstep(0.02, 0.52, vUv.x) * (1.0 - smoothstep(0.86, 1.0, vUv.x));
        float windowProximityBoost = mix(0.26, 1.0, pow(max(vUv.x, 0.0001), 1.05));

        // Soft floor & window plane feathering so downward light melts into the room air
        float floorClip = smoothstep(0.05, 0.52, vWorldPos.y);
        float windowClip = 1.0 - smoothstep(6.96, 7.28, vWorldPos.x);

        // Radial transverse softness around window Z center
        float zDist = abs(vWorldPos.z - (uWindowZ - (1.0 - vUv.x) * 0.22));
        float zSoft = 1.0 - smoothstep(0.28, 0.84, zDist);

        // Gentle atmospheric breathing
        float shimmer = 0.93 + 0.07 * sin(vWorldPos.x * 1.5 - uTime * 0.8 + vWorldPos.z * 1.8);

        // Warm Tyndall sunbeam haze in Daylight & Sunset; soft powdery blue moonlight mist in Midnight!
        float modeScale = mix(mix(0.95, 0.72, uDaylightFactor), 0.62, uNightFactor);
        vec3 finalShaftCol = mix(uShaftColor, vec3(0.56, 0.72, 1.0), uNightFactor * 0.65);
        float alpha = uBaseOpacity *
                      modeScale *
                      lengthFade *
                      windowProximityBoost *
                      floorClip *
                      windowClip *
                      bellY *
                      zSoft *
                      viewGrazingFade *
                      mix(mask.x, 0.92, uNightFactor * 0.55) *
                      shimmer;

        gl_FragColor = vec4(clamp(finalShaftCol, vec3(0.0), vec3(1.0)), clamp(alpha, 0.0, 0.14));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/**
 * True 3D Volumetric Anisotropic Scattering Window Beam Shader:
 * Pairs with `createTyndallShaftClusterGeometry` (single draw call per window) to render:
 * - Henyey-Greenstein anisotropic forward scattering + soft wide-angle diffuse lobe
 * - Rapid, organic exponential attenuation (`exp(-distNorm * uFalloffRate)`) so beams never look too long or rigid
 * - Soft Gaussian transverse feathering & grazing-angle dissolve (eliminates hard geometric beam boundaries)
 * - Fine luminous diffusion where scattered window rays meet suspended micro-dust particles
 */
export function createTyndallBeamShaderMaterial(
  shared: TwilightUniforms,
  baseOpacity = 0.13,
  mullionCols = 3.0,
  mullionRows = 2.0,
  falloffRate = 3.25,
  anisotropyBias = 0.0
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uDaylightFactor: shared.uDaylightFactor,
      uNightFactor: shared.uNightFactor,
      uShaftColor: shared.uShaftColor,
      uAnisotropy: shared.uAnisotropy,
      uTyndallIntensity: shared.uTyndallIntensity,
      uSoftShadowDecay: shared.uSoftShadowDecay,
      uBaseOpacity: { value: baseOpacity },
      uMullionCols: { value: mullionCols },
      uMullionRows: { value: mullionRows },
      uFalloffRate: { value: falloffRate },
      uAnisoBias: { value: anisotropyBias },
    },
    vertexShader: `
      attribute float aBeamKind;
      attribute float aSliceId;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vBeamDir;
      varying float vBeamKind;
      varying float vSliceId;
      void main() {
        vUv = uv;
        vBeamKind = aBeamKind;
        vSliceId = aSliceId;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        // Local -X tilted downward is the beam propagation direction into the room
        vBeamDir = normalize(mat3(modelMatrix) * vec3(-1.0, -0.36, 0.0));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDaylightFactor;
      uniform float uNightFactor;
      uniform vec3 uShaftColor;
      uniform float uAnisotropy;
      uniform float uTyndallIntensity;
      uniform float uSoftShadowDecay;
      uniform float uBaseOpacity;
      uniform float uMullionCols;
      uniform float uMullionRows;
      uniform float uFalloffRate;
      uniform float uAnisoBias;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec3 vBeamDir;
      varying float vBeamKind;
      varying float vSliceId;

      void main() {
        vec3 viewVec = cameraPosition - vWorldPos;
        float viewLen2 = dot(viewVec, viewVec);
        float viewDist = sqrt(max(viewLen2, 1e-6));
        vec3 viewDir = viewVec / viewDist;

        float normLen2 = dot(vWorldNormal, vWorldNormal);
        vec3 safeN = normLen2 > 1e-6 ? vWorldNormal * inversesqrt(normLen2) : vec3(0.0, 1.0, 0.0);
        float ndotv = clamp(abs(dot(safeN, viewDir)), 0.0005, 1.0);

        // Ultra-soft grazing dissolve: eliminates any visible planar slice or outer frustum seam
        float grazingPow = mix(1.24, 1.72, vBeamKind);
        float grazingFade = pow(ndotv, grazingPow);

        // Silky near-camera fade when walking right through window air haze
        float nearCamFade = smoothstep(0.35, 1.25, viewDist);

        // True Dual-Lobe Henyey-Greenstein Anisotropic Scattering phase function
        float cosTheta = clamp(dot(viewDir, vBeamDir), -1.0, 1.0);
        float gFwd = clamp(uAnisotropy + uAnisoBias, 0.15, 0.84);
        float g2 = gFwd * gFwd;
        float hgFwd = (1.0 - g2) / (4.0 * 3.14159265 * pow(max(0.08, 1.0 + g2 - 2.0 * gFwd * cosTheta), 1.5));
        float anisoPhase = clamp(0.46 + hgFwd * 1.44, 0.46, 2.20);

        // Physically based Soft Shadow Decay along propagation (u = 1 at sash, u = 0 at far tip)
        float u = clamp(vUv.x, 0.0, 1.0);
        float distNorm = 1.0 - u;
        float softDecayParam = clamp(uSoftShadowDecay, 0.5, 1.8);
        float physSoftDecay = 1.0 / (1.0 + distNorm * distNorm * (2.2 + softDecayParam * 2.8));

        // Distance-widened Gaussian transverse profile: velvety diffuse edges that dissolve softly
        float sinV = max(0.0005, sin(clamp(vUv.y, 0.001, 0.999) * 3.14159265));
        float bellPow = mix(2.75, 2.15, vBeamKind) * mix(1.0, 0.78, distNorm * 0.7);
        float bellV = pow(sinV, bellPow);

        float entryFeather = 1.0 - smoothstep(0.88, 1.0, u);
        float farDissolve = smoothstep(0.0, 0.48, u);
        float expAtten = exp(-distNorm * (uFalloffRate + 0.35 * softDecayParam)) * physSoftDecay;

        // Smooth floor & furniture-zone clearance cushion: prevents harsh geometric slice lines
        // where airborne window beams pass near floorboards, coffee table, TV console, or side stools!
        float floorFade = smoothstep(0.24, 0.90, vWorldPos.y);
        // Living room TV console & East wall furniture clearance (X = 6.32..7.22, Z = -6.55..-3.60, Y < 1.25)
        vec3 tvDelta = max(abs(vWorldPos - vec3(6.78, 0.56, -5.08)) - vec3(0.46, 0.62, 1.48), vec3(0.0));
        float tvClearance = smoothstep(0.0, 0.42, length(tvDelta));
        // Living room coffee table clearance (X = 4.05..5.20, Z = -6.22..-4.28, Y < 0.78)
        vec3 tableDelta = max(abs(vWorldPos - vec3(4.62, 0.36, -5.25)) - vec3(0.56, 0.38, 0.98), vec3(0.0));
        float tableClearance = smoothstep(0.0, 0.40, length(tableDelta));
        // Living room side stool & sofa cushion clearance
        vec3 stoolDelta = max(abs(vWorldPos - vec3(6.72, 0.42, -2.55)) - vec3(0.36, 0.42, 0.36), vec3(0.0));
        float stoolClearance = smoothstep(0.0, 0.34, length(stoolDelta));
        float objectSoftClearance = floorFade * mix(0.22, 1.0, tvClearance) * mix(0.28, 1.0, tableClearance) * mix(0.30, 1.0, stoolClearance);

        // Soft mullion-dispersed god-ray ripples + rapid distance penumbra dissolution
        float breeze = sin(uTime * 0.38 + vSliceId * 5.3 + vWorldPos.z * 0.45) * 0.035;
        float panePhase = (vUv.y + breeze) * uMullionCols + vSliceId * 0.82;
        float primaryRays = 0.5 + 0.5 * sin(panePhase * 6.2831853 + 0.55);
        float fineRays = 0.5 + 0.5 * sin((vUv.y * (uMullionCols * 2.05 + uMullionRows) + vSliceId * 1.85 + breeze * 1.3) * 6.2831853);
        float rawBands = primaryRays * 0.72 + fineRays * 0.28;

        // Progressive Soft Shadow Decay dispersion: mullions melt rapidly into uniform silky mist
        float crispness = mix(0.08, 0.76, pow(u, 1.35)) * exp(-distNorm * (1.2 + softDecayParam * 0.9));
        float shellStriation = mix(0.86, 1.05, mix(0.55, rawBands, crispness));
        float sheetStriation = mix(0.52, 1.20, mix(0.52, pow(rawBands, 1.20), crispness));
        float striation = mix(shellStriation, sheetStriation, vBeamKind);

        // Delicate volumetric air-particle diffuse shimmer where floating dust intersects light
        float microScatter = 0.88 + 0.12 * sin(vWorldPos.x * 3.1 + vWorldPos.y * 2.6 - uTime * 0.55)
                                         * cos(vWorldPos.z * 2.9 + uTime * 0.42);

        // Spectral scattering tint across Daylight / Sunset / Midnight
        float modeScale = mix(mix(1.16, 0.96, uDaylightFactor), 0.84, uNightFactor) * uTyndallIntensity;
        vec3 warmDayCol = mix(uShaftColor, vec3(1.0, 0.96, 0.88), 0.40 * uDaylightFactor);
        vec3 sunsetCol = mix(warmDayCol, vec3(1.0, 0.84, 0.65), (1.0 - uDaylightFactor) * (1.0 - uNightFactor) * 0.38);
        vec3 baseCol = mix(sunsetCol, vec3(0.58, 0.76, 1.0), uNightFactor * 0.82);
        vec3 finalCol = mix(baseCol, vec3(1.0, 0.98, 0.95), pow(u, 2.4) * 0.34 * (1.0 - uNightFactor * 0.50));

        float layerWeight = mix(0.52, 0.66, vBeamKind);
        float alpha = uBaseOpacity *
                      layerWeight *
                      modeScale *
                      anisoPhase *
                      entryFeather *
                      farDissolve *
                      expAtten *
                      objectSoftClearance *
                      bellV *
                      grazingFade *
                      nearCamFade *
                      striation *
                      microScatter;

        gl_FragColor = vec4(clamp(finalCol, vec3(0.0), vec3(1.0)), clamp(alpha, 0.0, 0.16));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export interface WindowEmissiveShaderMaterial extends THREE.ShaderMaterial {
  color: THREE.Color;
}

/**
 * Creates a conditional window emissive ShaderMaterial for apartment windows:
 * - Lowered daytime window exposure (~0.75 linear luminance) so daytime windows have a soft halo without overexposing.
 * - In the apartment's night state (uNightFactor = 1.0), reduces window Bloom contribution by 50%
 *   compared to daylight (uWindowBloomScale = 0.5) and adds a subtle darkening overlay so windows
 *   at night never appear as pure white light sources.
 */
export function createWindowEmissiveMaterial(
  shared: TwilightUniforms,
  baseColorHex = 0xfff0dc,
  opacity = 0.94
): WindowEmissiveShaderMaterial {
  const baseColor = new THREE.Color(baseColorHex);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: baseColor },
      uDaylightFactor: shared.uDaylightFactor,
      uNightFactor: shared.uNightFactor,
      uWindowBloomScale: shared.uWindowBloomScale,
      uTime: shared.uTime,
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform float uDaylightFactor;
      uniform float uNightFactor;
      uniform float uWindowBloomScale;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vWorldPos;

      void main() {
        // Soft perimeter & curtain-side sash shading so window edges feel recessed and atmospheric
        vec2 edgeDist = abs(vUv - 0.5) * 2.0;
        float frameVignette = 1.0 - smoothstep(0.66, 1.0, max(edgeDist.x, edgeDist.y)) * 0.22;
        float verticalSkyGrad = mix(0.88, 1.04, smoothstep(0.0, 1.0, vUv.y));

        // Controlled daytime window exposure (~0.74 linear luminance, gently above bloom threshold, never blinding white)
        vec3 dayGlassColor = mix(uBaseColor, vec3(0.98, 0.91, 0.84), 0.35) * 0.76 * frameVignette * verticalSkyGrad;

        // Dreamy powdery periwinkle-blue moonlight pane gradient (matches MiSide nighttime bedroom reference!)
        float moonHalo = (1.0 - edgeDist.x * 0.22) * (0.48 + 0.52 * smoothstep(0.05, 0.95, vUv.y));
        float moonGlowCenter = exp(-dot(vUv - vec2(0.50, 0.64), vUv - vec2(0.50, 0.64)) * 2.8);
        vec3 moonBottom = vec3(0.32, 0.44, 0.82);
        vec3 moonTop = vec3(0.56, 0.72, 0.98);
        vec3 moonPaneColor = mix(moonBottom, moonTop, clamp(moonHalo + moonGlowCenter * 0.22, 0.0, 1.0)) * frameVignette;

        vec3 baseLit = mix(dayGlassColor * 0.88, dayGlassColor, uDaylightFactor);
        vec3 nightLit = mix(baseLit, moonPaneColor, uNightFactor * 0.94) * mix(1.0, clamp(uWindowBloomScale * 1.28, 0.78, 1.06), uNightFactor);
        vec3 finalGlass = mix(baseLit, nightLit, uNightFactor);

        gl_FragColor = vec4(clamp(finalGlass, vec3(0.08), vec3(0.88)), uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  }) as WindowEmissiveShaderMaterial;

  mat.color = baseColor;
  return mat;
}

/**
 * Creates an animated floor Gobo ShaderMaterial that projects a soft, diffused
 * window sunlight pool onto the Living Room, Dining Room, and Kitchen floors & counters.
 * Uses NormalBlending and controlled intensity so floor light patches NEVER blow out white!
 */
export function createWindowGoboShaderMaterial(
  shared: TwilightUniforms,
  goboTex: THREE.Texture,
  windowZ: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      uDaylightFactor: shared.uDaylightFactor,
      uNightFactor: shared.uNightFactor,
      uWindowBloomScale: shared.uWindowBloomScale,
      uShaftColor: shared.uShaftColor,
      uSoftShadowDecay: shared.uSoftShadowDecay,
      uGoboMap: { value: goboTex },
      uWindowZ: { value: windowZ },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDaylightFactor;
      uniform float uNightFactor;
      uniform float uWindowBloomScale;
      uniform vec3 uShaftColor;
      uniform float uSoftShadowDecay;
      uniform sampler2D uGoboMap;
      uniform float uWindowZ;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      ${WINDOW_SHADOW_MASK_GLSL}

      void main() {
        // Slanted afternoon window projection with physically based Soft Shadow Decay (越远半影越柔和)
        vec2 swayOffset = vec2(
          sin(uTime * 0.75 + vUv.y * 2.8 + uWindowZ) * 0.004,
          cos(uTime * 0.95 + vUv.x * 2.4 - uWindowZ) * 0.005
        );
        float slantSkew = (1.0 - vUv.x) * 0.18;
        vec2 slantedUv = vec2(vUv.x, vUv.y + slantSkew - 0.09) + swayOffset;
        vec2 uvSample = clamp(slantedUv, 0.005, 0.995);
        vec4 goboSample = texture2D(uGoboMap, uvSample);

        // Travel distance across floor from window sill (0 at sill, 1 at far landing edge)
        float travel = clamp(1.0 - vUv.x, 0.0, 1.0);
        float decayScale = clamp(uSoftShadowDecay, 0.5, 1.8);
        // Physically widening penumbra kernel proportional to travel^1.35
        float penumbra = (0.030 + pow(travel, 1.35) * 0.21) * decayScale;

        // Softly decaying 2x3 window-frame mullion shadows that melt organically toward the far landing edge
        float barX = smoothstep(0.010, 0.056 + penumbra, abs(uvSample.y - 0.50));
        float barY1 = smoothstep(0.010, 0.052 + penumbra, abs(uvSample.x - 0.35));
        float barY2 = smoothstep(0.010, 0.052 + penumbra, abs(uvSample.x - 0.68));
        float mullionContrast = mix(0.24, 0.84, smoothstep(0.05, 0.88, travel));
        float paneGrid = mix(mullionContrast, 1.0, barX * barY1 * barY2);

        // Extra-soft floor landing edge: inverse-square soft decay + distance-widened lateral feathering
        float physEnergyDecay = 1.0 / (1.0 + travel * travel * (1.15 + 0.55 * decayScale));
        float nearSillFade = 1.0 - smoothstep(0.84, 0.99, vUv.x);
        float farLandingFade = smoothstep(0.0, 0.44, vUv.x);
        float windowToRoomGrad = farLandingFade * nearSillFade * physEnergyDecay;

        float sidePad = mix(0.11, 0.36, pow(travel, 1.15)) * clamp(0.85 + 0.22 * decayScale, 0.8, 1.35);
        float sideEdgeFade = smoothstep(0.02, 0.02 + sidePad, uvSample.y) * smoothstep(0.02, 0.02 + sidePad, 1.0 - uvSample.y);
        // Subtle elliptical corner rounding so the landing edge never looks like a hard rectangle
        vec2 ellipPos = (uvSample - vec2(0.52, 0.50)) * vec2(1.85, 2.05);
        float cornerMelt = 1.0 - smoothstep(0.72, 1.18, length(ellipPos));

        // Softly feather around Living Room coffee table & TV console footprints to avoid hard patch-object seams
        vec2 tableFoot = max(abs(vWorldPos.xz - vec2(4.62, -5.25)) - vec2(0.42, 0.78), vec2(0.0));
        float tableSoftMask = mix(0.45, 1.0, smoothstep(0.0, 0.38, length(tableFoot)));
        vec2 tvFoot = max(abs(vWorldPos.xz - vec2(6.76, -5.08)) - vec2(0.32, 1.24), vec2(0.0));
        float tvSoftMask = mix(0.35, 1.0, smoothstep(0.0, 0.34, length(tvFoot)));

        float approxWinY = mix(0.85, 2.55, vUv.x);
        float approxWinZ = uWindowZ + (vUv.y - 0.5) * 1.32;
        vec2 extMask = evalExteriorShadowMask(approxWinY, approxWinZ, 1.4 + travel * 2.8, uTime);

        float shapeMask = windowToRoomGrad * sideEdgeFade * mix(0.65, 1.0, cornerMelt) * paneGrid * tableSoftMask * tvSoftMask;
        float dayStrength = mix(0.19, 0.21, uDaylightFactor) * mix(1.0, 0.76, uNightFactor);
        float extFactor = mix(extMask.x, 0.92, uNightFactor * 0.6);
        float intensity = mix(0.74, 1.0, goboSample.r) * extFactor * shapeMask * dayStrength;
        vec3 warmSunColor = mix(uShaftColor, vec3(0.97, 0.90, 0.79), uDaylightFactor * 0.50);
        vec3 moonPoolColor = vec3(0.50, 0.68, 1.0);
        vec3 finalPatchColor = mix(warmSunColor * 0.58, moonPoolColor * 0.66, uNightFactor);
        gl_FragColor = vec4(clamp(finalPatchColor, vec3(0.0), vec3(0.68)), clamp(intensity, 0.0, 0.21));
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
}

/**
 * Creates a projective planar reflection ShaderMaterial for apartment mirrors.
 * Samples the offscreen mirror view pass (which renders the opposite-direction
 * 'ghost' dust motes) and applies beveled glass edge darkening, twilight violet
 * silvering, and subtle psychological-horror chromatic ripple.
 */
export function createMirrorSurfaceShaderMaterial(
  shared: TwilightUniforms
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMirrorTex: { value: null },
      uTime: shared.uTime,
      uShadowTint: shared.uShadowTint,
      uGlitchIntensity: { value: 0.12 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec4 vScreenPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vScreenPos = projectionMatrix * viewMatrix * wp;
        gl_Position = vScreenPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMirrorTex;
      uniform float uTime;
      uniform vec3 uShadowTint;
      uniform float uGlitchIntensity;
      varying vec2 vUv;
      varying vec4 vScreenPos;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      void main() {
        vec2 ndc = (vScreenPos.xy / max(0.0001, vScreenPos.w)) * 0.5 + 0.5;
        // Flip X for right-handed planar reflection camera projection
        vec2 reflUv = vec2(1.0 - ndc.x, ndc.y);

        // Subtle uncanny glass ripple + psychological chromatic aberration
        float wave = sin(vUv.y * 18.0 - uTime * 2.2) * 0.0018 * (1.0 + uGlitchIntensity * 3.5);
        float chromaShift = (0.0016 + uGlitchIntensity * 0.0065) *
                            (0.6 + 0.4 * sin(uTime * 3.7 + vUv.y * 9.0));

        vec2 uvR = clamp(reflUv + vec2(wave + chromaShift, 0.0), 0.002, 0.998);
        vec2 uvG = clamp(reflUv + vec2(wave, 0.0), 0.002, 0.998);
        vec2 uvB = clamp(reflUv + vec2(wave - chromaShift, 0.0), 0.002, 0.998);

        float r = texture2D(uMirrorTex, uvR).r;
        float g = texture2D(uMirrorTex, uvG).g;
        float b = texture2D(uMirrorTex, uvB).b;
        vec3 reflColor = vec3(r, g, b);
        if (!(reflColor.r >= 0.0 && reflColor.r < 100.0)) reflColor.r = 0.35;
        if (!(reflColor.g >= 0.0 && reflColor.g < 100.0)) reflColor.g = 0.32;
        if (!(reflColor.b >= 0.0 && reflColor.b < 100.0)) reflColor.b = 0.34;
        reflColor = clamp(reflColor, vec3(0.0), vec3(0.65));

        // Antique silvered mirror tint with subtle twilight violet cast
        vec3 silverTint = mix(vec3(0.95, 0.93, 1.0), uShadowTint + vec3(0.45), 0.16);
        reflColor *= silverTint;

        // Beveled glass perimeter vignette & subtle diagonal glass sheen
        vec2 edgeDist = abs(vUv - 0.5) * 2.0;
        float bevelFrame = 1.0 - smoothstep(0.84, 1.0, max(edgeDist.x, edgeDist.y));
        float sheen = 0.035 * smoothstep(0.35, 0.65, sin(vUv.x * 3.5 + vUv.y * 2.8));

        vec3 viewVec = cameraPosition - vWorldPos;
        float viewLen2 = dot(viewVec, viewVec);
        vec3 viewDir = viewLen2 > 1e-6 ? viewVec * inversesqrt(viewLen2) : vec3(0.0, 0.0, 1.0);
        float normLen2 = dot(vWorldNormal, vWorldNormal);
        vec3 safeWN = normLen2 > 1e-6 ? vWorldNormal * inversesqrt(normLen2) : vec3(0.0, 0.0, -1.0);
        float fresnel = pow(max(0.0001, 1.0 - clamp(dot(viewDir, safeWN), 0.0, 1.0)), 3.0);
        vec3 finalColor = reflColor * (0.84 + 0.16 * bevelFrame) + vec3(sheen) + vec3(0.58, 0.52, 0.76) * fresnel * 0.10;

        gl_FragColor = vec4(clamp(finalColor, vec3(0.0), vec3(0.64)), 1.0);
      }
    `,
  });
}

const _texAvgColorCache = new WeakMap<THREE.Texture, THREE.Color>();

/**
 * Samples a fast 4x4 grid on a procedural CanvasTexture to recover its true
 * linear average color (so textured wood furniture like oakMat with near-white
 * tint 0xf0e0d4 yields its actual honey-oak hue rather than white!).
 */
function getTextureAverageLinearColor(tex: THREE.Texture | null | undefined): THREE.Color | null {
  if (!tex) return null;
  const cached = _texAvgColorCache.get(tex);
  if (cached) return cached;
  const img = tex.image as HTMLCanvasElement | undefined;
  if (!img || typeof img.getContext !== 'function' || img.width === 0 || img.height === 0) {
    return null;
  }
  const ctx2d = img.getContext('2d');
  if (!ctx2d) return null;
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let count = 0;
  const stepX = Math.max(1, Math.floor(img.width / 4));
  const stepY = Math.max(1, Math.floor(img.height / 4));
  for (let y = Math.floor(stepY * 0.5); y < img.height; y += stepY) {
    for (let x = Math.floor(stepX * 0.5); x < img.width; x += stepX) {
      const px = ctx2d.getImageData(x, y, 1, 1).data;
      sr += px[0] / 255;
      sg += px[1] / 255;
      sb += px[2] / 255;
      count++;
    }
  }
  if (count === 0) return null;
  const avg = new THREE.Color().setRGB(sr / count, sg / count, sb / count, THREE.SRGBColorSpace);
  _texAvgColorCache.set(tex, avg);
  return avg;
}

/**
 * Computes MiSide-style shadow-extracted dark outline color from a mesh's TRUE
 * surface color (mat.color * average(mat.map)), pulling directly from the
 * darkest shadow zone of that object so white sofas and wooden furniture NEVER
 * get pale or white edges (and never pure #000000 black):
 * - White / cream sofa & ceramics -> deep muted lavender-slate shadow (~0.14 linear)
 * - Wood & warm furniture         -> deep roasted walnut-umber shadow (~0.07 linear)
 * - Green foliage / plants        -> deep forest pine shadow green (~0.05 linear)
 */
function computeMiSideSameHueOutlineColor(sourceMesh: THREE.Mesh, fallbackHex = 0x4c372f): THREE.Color {
  const mat = Array.isArray(sourceMesh.material) ? sourceMesh.material[0] : sourceMesh.material;
  const baseCol = new THREE.Color(fallbackHex);
  if (mat && 'color' in mat && (mat as THREE.MeshStandardMaterial).color instanceof THREE.Color) {
    baseCol.copy((mat as THREE.MeshStandardMaterial).color);
    const stdMat = mat as THREE.MeshStandardMaterial;
    const avgTex = getTextureAverageLinearColor(stdMat.map);
    if (avgTex) {
      baseCol.multiply(avgTex);
    }
  }

  const r = baseCol.r;
  const g = baseCol.g;
  const b = baseCol.b;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const sat = (maxC - minC) / Math.max(maxC, 0.001);

  let outR: number;
  let outG: number;
  let outB: number;

  if (lum > 0.65 && sat < 0.22) {
    // White / cream object -> deep muted lavender-plum shadow extracted from darkest sofa crevices
    outR = r * 0.165;
    outG = g * 0.142;
    outB = b * 0.188;
  } else if (g > r + 0.035 && g > b + 0.025) {
    // Green plant -> deep dark forest pine shadow
    outR = r * 0.22;
    outG = g * 0.34;
    outB = b * 0.24;
  } else {
    // Wood & general furniture -> deep roasted umber / warm shadow extracted from darkest shaded face
    outR = r * 0.21;
    outG = g * 0.155;
    outB = b * 0.132;
  }

  // Strictly cap maximum linear luminance at 0.155 so NO outline can ever appear light or white!
  const outLum = 0.299 * outR + 0.587 * outG + 0.114 * outB;
  const maxAllowedLum = 0.155;
  if (outLum > maxAllowedLum) {
    const scale = maxAllowedLum / outLum;
    outR *= scale;
    outG *= scale;
    outB *= scale;
  }

  // Soft dark chromatic floor so outlines stay rich colored shadow rather than dead #000000 black
  outR = Math.max(0.024, outR);
  outG = Math.max(0.018, outG);
  outB = Math.max(0.020, outB);

  return new THREE.Color(outR, outG, outB);
}

export class OutlineRegistry {
  public readonly meshes: THREE.Mesh[] = [];
  private materials: THREE.ShaderMaterial[] = [];
  private materialCache = new Map<string, THREE.ShaderMaterial>();
  private outlineMat: THREE.MeshBasicMaterial;
  private defaultHex: number;
  private sharedUniforms?: TwilightUniforms;
  private invResolution = new THREE.Vector2(1 / 1280, 1 / 720);
  public enabled = true;

  constructor(colorHex = 0x4c372f, sharedUniforms?: TwilightUniforms) {
    this.defaultHex = colorHex;
    this.sharedUniforms = sharedUniforms;
    this.outlineMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
  }

  public setResolution(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.invResolution.set(1 / w, 1 / h);
  }

  private createSameHueOutlineMaterial(
    color: THREE.Color,
    lineWidthPx = 1.0,
    useVertexColor = false,
    useDynamicSofaShadow = false
  ): THREE.ShaderMaterial {
    // Cache outline ShaderMaterials by quantized color & flags to eliminate redundant WebGL shader switches
    const qR = Math.round(color.r * 24);
    const qG = Math.round(color.g * 24);
    const qB = Math.round(color.b * 24);
    const cacheKey = `${useVertexColor ? 'vcol' : `${qR}_${qG}_${qB}`}|${lineWidthPx.toFixed(2)}|${useDynamicSofaShadow ? 1 : 0}`;
    const cached = this.materialCache.get(cacheKey);
    if (cached) return cached;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uOutlineColor: { value: color.clone() },
        uLineWidthPx: { value: lineWidthPx },
        uInvResolution: { value: this.invResolution },
        uNightFactor: this.sharedUniforms ? this.sharedUniforms.uNightFactor : { value: 0.0 },
        uSofaShadowColor: this.sharedUniforms
          ? this.sharedUniforms.uSofaShadowColor
          : { value: new THREE.Color(0x6e5446) },
        uUseDynamicSofaShadow: { value: useDynamicSofaShadow ? 1.0 : 0.0 },
      },
      vertexShader: `
        uniform float uLineWidthPx;
        uniform vec2 uInvResolution;
        ${useVertexColor ? 'attribute vec3 aOutlineColor;\nvarying vec3 vOutlineColor;' : ''}
        varying float vViewDist;
        void main() {
          ${useVertexColor ? 'vOutlineColor = aOutlineColor;' : ''}
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDist = -mvPos.z;
          vec3 viewNorm = normalize(normalMatrix * normal);
          vec4 clipPos = projectionMatrix * mvPos;
          // Crisp distance-attenuated 1px screen-space silhouette extrusion
          float distScale = clamp(1.22 / (1.0 + max(0.0, vViewDist) * 0.26), 0.14, 1.0);
          vec2 screenDir = normalize(viewNorm.xy + vec2(0.0001));
          clipPos.xy += screenDir * (uLineWidthPx * 2.0) * uInvResolution * clipPos.w * distScale;
          gl_Position = clipPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uOutlineColor;
        uniform float uNightFactor;
        uniform vec3 uSofaShadowColor;
        uniform float uUseDynamicSofaShadow;
        ${useVertexColor ? 'varying vec3 vOutlineColor;' : ''}
        varying float vViewDist;
        void main() {
          // Attenuate alpha smoothly with distance so far outlines melt naturally into Bloom glow
          float distFade = clamp(1.36 / (1.0 + vViewDist * vViewDist * 0.075), 0.0, 1.0);
          if (distFade < 0.04) discard;
          vec3 col = ${useVertexColor ? 'vOutlineColor' : 'uOutlineColor'};
          if (uUseDynamicSofaShadow > 0.5) {
            col = min(uSofaShadowColor * 0.42, vec3(0.16, 0.14, 0.16));
          } else {
            col *= mix(vec3(1.0), vec3(0.32, 0.36, 0.52), uNightFactor);
          }
          float alphaScale = uUseDynamicSofaShadow > 0.5 ? 0.58 : 0.72;
          gl_FragColor = vec4(col, alphaScale * distFade);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      toneMapped: true,
    });
    this.materials.push(mat);
    this.materialCache.set(cacheKey, mat);
    return mat;
  }

  addOutline(source: THREE.Mesh, _thickness = 1.004): THREE.Mesh {
    const srcMat = Array.isArray(source.material) ? source.material[0] : source.material;
    const isSofa = Boolean(srcMat?.userData?.isSofaFabric);
    const sameHueCol = computeMiSideSameHueOutlineColor(source, this.defaultHex);
    const customMat = this.createSameHueOutlineMaterial(sameHueCol, isSofa ? 0.80 : 1.0, false, isSofa);
    const outline = new THREE.Mesh(source.geometry, customMat);
    outline.name = `${source.name || 'mesh'}_outline`;
    outline.userData.outlineColor = sameHueCol;
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.visible = this.enabled;
    outline.raycast = () => {};
    source.add(outline);
    this.meshes.push(outline);
    return outline;
  }

  addMergedOutlineGeometry(
    mergedGeo: THREE.BufferGeometry,
    parent: THREE.Object3D,
    name = 'merged_outline'
  ): THREE.Mesh {
    const hasPerVertexColor = Boolean(mergedGeo.getAttribute('aOutlineColor'));
    const customMat = this.createSameHueOutlineMaterial(
      new THREE.Color(this.defaultHex),
      1.0,
      hasPerVertexColor
    );
    const outline = new THREE.Mesh(mergedGeo, customMat);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.visible = this.enabled;
    outline.name = name;
    outline.userData.dynamic = true;
    outline.raycast = () => {};
    parent.add(outline);
    this.meshes.push(outline);
    return outline;
  }

  removeDisposedOutlines(removedSet: Set<THREE.Mesh>): void {
    for (let i = this.meshes.length - 1; i >= 0; i--) {
      if (removedSet.has(this.meshes[i])) {
        this.meshes.splice(i, 1);
      }
    }
  }

  setVisible(visible: boolean): void {
    this.enabled = visible;
    for (const m of this.meshes) {
      m.visible = visible;
    }
  }

  setColor(hex: number): void {
    this.defaultHex = hex;
    this.outlineMat.color.setHex(hex);
  }

  dispose(): void {
    this.outlineMat.dispose();
    for (const m of this.materials) {
      m.dispose();
    }
    this.materials.length = 0;
    this.materialCache.clear();
  }
}

export interface ProceduralTextures {
  woodFloor: THREE.CanvasTexture;
  woodFloorBump: THREE.CanvasTexture;
  woodFloorRoughness: THREE.CanvasTexture;
  woodDoor: THREE.CanvasTexture;
  woodDoorBump: THREE.CanvasTexture;
  furnitureOak: THREE.CanvasTexture;
  furnitureWoodBump: THREE.CanvasTexture;
  rugWeave: THREE.CanvasTexture;
  rugBump: THREE.CanvasTexture;
  genkanTile: THREE.CanvasTexture;
  kitchenTile: THREE.CanvasTexture;
  kitchenTileBump: THREE.CanvasTexture;
  kitchenTileRoughness: THREE.CanvasTexture;
  basementTile: THREE.CanvasTexture;
  dirtyRug: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  concreteBump: THREE.CanvasTexture;
  concreteRoughness: THREE.CanvasTexture;
  roughMetal: THREE.CanvasTexture;
  roughMetalBump: THREE.CanvasTexture;
  roughMetalRoughness: THREE.CanvasTexture;
  cushionStripes: THREE.CanvasTexture;
  clockFace: THREE.CanvasTexture;
  tvStandby: THREE.CanvasTexture;
  tvMeta: THREE.CanvasTexture;
  pcTerminal: THREE.CanvasTexture;
  crtBasement: THREE.CanvasTexture;
  arcadeMarquee: THREE.CanvasTexture;
  arcadeScreen: THREE.CanvasTexture;
  arcadeSideArt: THREE.CanvasTexture;
  stickyNote: THREE.CanvasTexture;
  dustMote: THREE.CanvasTexture;
  windowLightGobo: THREE.CanvasTexture;
  wallpaperLiving: THREE.CanvasTexture;
  wainscotWood: THREE.CanvasTexture;
  wainscotWhite: THREE.CanvasTexture;
  wallpaperBedroom: THREE.CanvasTexture;
  wallpaperDining: THREE.CanvasTexture;
  plushFabric: THREE.CanvasTexture;
  plushBump: THREE.CanvasTexture;
  curtainFabric: THREE.CanvasTexture;
  curtainFloralGreen: THREE.CanvasTexture;
  curtainBump: THREE.CanvasTexture;
  sofaTuftMap: THREE.CanvasTexture;
  sofaTuftBump: THREE.CanvasTexture;
  ginghamPillow: THREE.CanvasTexture;
  tableclothPink: THREE.CanvasTexture;
  tableclothLaceTrim: THREE.CanvasTexture;
  barStoolUnionVelvet: THREE.CanvasTexture;
  kitchenBacksplashTile: THREE.CanvasTexture;
  brushedSteel: THREE.CanvasTexture;
  bookCoverAtlas: THREE.CanvasTexture;
  bookCoverBump: THREE.CanvasTexture;
  vinylSleeveAtlas: THREE.CanvasTexture;
  bathroomTile: THREE.CanvasTexture;
  bathroomWall: THREE.CanvasTexture;
  bathPlaidMat: THREE.CanvasTexture;
  plantLeaf: THREE.CanvasTexture;
  plantLeafBump: THREE.CanvasTexture;
  pottingSoil: THREE.CanvasTexture;
  pottingSoilBump: THREE.CanvasTexture;
  animePortraits: THREE.Texture[];
  sofaArtworks: THREE.CanvasTexture[];
  all: THREE.Texture[];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  maxAniso: number,
  repeatX = 1,
  repeatY = 1,
  isLinearData = false
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isLinearData ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextures {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const all: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(t: T): T => {
    all.push(t);
    return t;
  };

  // Load the 4 user-provided anime portrait illustrations from /assets/aistudio/
  const loader = new THREE.TextureLoader();
  const portraitUrls = [
    '/assets/aistudio/1794729403861_019e1b9c.png',
    '/assets/aistudio/1794728547592_52528a0f.png',
    '/assets/aistudio/1794732831899_650e55af.png',
    '/assets/aistudio/1794732921521_218f99a4.png',
  ];
  const animePortraits = portraitUrls.map((url) => {
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    tex.repeat.set(0.9, 0.9);
    tex.offset.set(0.05, 0.07);
    return track(tex);
  });

  // 1. High-res MiSide Staggered Running-Bond (工字拼) Hardwood Planks (world-UV scaled 1 tile = 2.0m x 2.0m)
  //    Seamless wrap-around staggered boards with natural per-plank hue/lightness variation across
  //    light cream, warm apricot, and soft honey wood, delicate low-contrast grain, ultra-faint seams,
  //    and subtle per-plank roughness differences for soft dimensional luster under indoor light.
  const wSize = 1024;
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = wSize;
  woodCanvas.height = wSize;
  const wctx = woodCanvas.getContext('2d')!;

  const woodBumpCanvas = document.createElement('canvas');
  woodBumpCanvas.width = wSize;
  woodBumpCanvas.height = wSize;
  const wbctx = woodBumpCanvas.getContext('2d')!;

  const woodRoughCanvas = document.createElement('canvas');
  woodRoughCanvas.width = wSize;
  woodRoughCanvas.height = wSize;
  const wrctx = woodRoughCanvas.getContext('2d')!;

  wctx.fillStyle = '#c48658';
  wctx.fillRect(0, 0, wSize, wSize);
  wbctx.fillStyle = '#929292';
  wbctx.fillRect(0, 0, wSize, wSize);
  wrctx.fillStyle = '#b4b4b4';
  wrctx.fillRect(0, 0, wSize, wSize);

  // Richer, slightly deeper warm caramel-peach oak running-bond floor palette (保持工字拼色，整体略加深更有层次)
  const plankPalette: [number, number, number][] = [
    [214, 162, 118], // Warm honey-caramel
    [206, 152, 108], // Rich apricot-oak
    [198, 142, 98],  // Balanced warm chestnut-oak
    [190, 132, 88],  // Deep peach-caramel oak
    [210, 157, 113], // Soft toasted honey
    [184, 126, 82],  // Rich roasted caramel oak
    [202, 147, 103], // Mid caramel-apricot plank
    [178, 120, 76],  // Deep warm amber-walnut
  ];

  const plankHash = (n: number): number => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };

  // Running-bond staggered row offsets (alternating classic half-bond + quarter-bond variation)
  const rowOffsets = [0.0, 0.50, 0.25, 0.74, 0.12, 0.62, 0.37, 0.86, 0.04, 0.54, 0.29, 0.78, 0.16, 0.66];
  const plankCount = rowOffsets.length; // 14 crisp neat rows per 2m tile (~14.3cm board width)
  const plankH = wSize / plankCount;
  const planksPerRow = 2; // 1.0m board length per plank in running-bond pattern
  const boardW = wSize / planksPerRow;

  for (let i = 0; i < plankCount; i++) {
    const py = i * plankH;
    const rowShift = Math.round(rowOffsets[i] * wSize);
    const joints: number[] = [];

    for (let p = 0; p < planksPerRow; p++) {
      const startX = (rowShift + p * boardW) % wSize;
      joints.push(startX);

      // Deterministic pseudo-random plank tone ensuring neighbors differ naturally
      const h1 = plankHash(i * 37.3 + p * 91.7 + 5.1);
      const h2 = plankHash(i * 73.1 + p * 43.9 + 11.4);
      const h3 = plankHash(i * 19.7 + p * 61.3 + 23.8);
      const palIdx = (Math.floor(h1 * plankPalette.length) + i * 3 + p * 5) % plankPalette.length;
      const [pr, pg, pb] = plankPalette[palIdx];

      // Subtle continuous lightness & hue drift per individual plank
      const lumaShift = (h2 - 0.5) * 14.0;
      const hueWarmth = (h3 - 0.5) * 8.0;
      const rBase = Math.max(152, Math.min(232, Math.round(pr + lumaShift + hueWarmth * 0.7)));
      const gBase = Math.max(106, Math.min(196, Math.round(pg + lumaShift * 0.92 + hueWarmth * 0.15)));
      const bBase = Math.max(68, Math.min(162, Math.round(pb + lumaShift * 0.82 - hueWarmth * 0.65)));

      // Per-plank subtle roughness variation (144..206 -> distinct gentle satin sheen between neighboring boards)
      const boardRough = Math.round(146 + h2 * 56 + (palIdx % 3) * 4);
      // Slight per-plank base height offset for micro-assembled dimensionality
      const boardBumpBase = Math.round(144 + (h3 - 0.5) * 16);

      // Paint this single plank (wrapping seamlessly across X = 0 / wSize with identical color & grain!)
      const drawSegments: [number, number, number][] =
        startX + boardW <= wSize
          ? [[startX, boardW, 0]]
          : [
              [startX, wSize - startX, 0],
              [0, startX + boardW - wSize, wSize - startX],
            ];

      for (const [segX, segW, localOffset] of drawSegments) {
        wctx.save();
        wctx.beginPath();
        wctx.rect(segX, py, segW, plankH);
        wctx.clip();

        wbctx.save();
        wbctx.beginPath();
        wbctx.rect(segX, py, segW, plankH);
        wbctx.clip();

        wrctx.save();
        wrctx.beginPath();
        wrctx.rect(segX, py, segW, plankH);
        wrctx.clip();

        const originX = segX - localOffset;

        // 1) Base plank fill
        wctx.fillStyle = `rgb(${rBase}, ${gBase}, ${bBase})`;
        wctx.fillRect(segX, py, segW, plankH);

        // Subtle longitudinal natural tonal gradation across the board length
        const boardGrad = wctx.createLinearGradient(originX, py, originX + boardW, py);
        boardGrad.addColorStop(0.0, 'rgba(176, 118, 76, 0.055)');
        boardGrad.addColorStop(0.38 + h1 * 0.24, 'rgba(255, 240, 220, 0.065)');
        boardGrad.addColorStop(1.0, 'rgba(172, 114, 72, 0.050)');
        wctx.fillStyle = boardGrad;
        wctx.fillRect(segX, py, segW, plankH);

        // 2) Per-plank roughness base + subtle sheen sweep
        wrctx.fillStyle = `rgb(${boardRough}, ${boardRough}, ${boardRough})`;
        wrctx.fillRect(segX, py, segW, plankH);
        const roughGrad = wrctx.createLinearGradient(originX, py, originX + boardW, py);
        roughGrad.addColorStop(0.0, 'rgba(220, 220, 220, 0.08)');
        roughGrad.addColorStop(0.5, 'rgba(120, 120, 120, 0.08)');
        roughGrad.addColorStop(1.0, 'rgba(215, 215, 215, 0.08)');
        wrctx.fillStyle = roughGrad;
        wrctx.fillRect(segX, py, segW, plankH);

        // 3) Soft chamfered bump profile (gentle micro-bevel along plank edges)
        const hBumpGrad = wbctx.createLinearGradient(0, py, 0, py + plankH);
        hBumpGrad.addColorStop(0.0, '#626262');
        hBumpGrad.addColorStop(0.028, `rgb(${boardBumpBase - 8}, ${boardBumpBase - 8}, ${boardBumpBase - 8})`);
        hBumpGrad.addColorStop(0.065, `rgb(${boardBumpBase + 10}, ${boardBumpBase + 10}, ${boardBumpBase + 10})`);
        hBumpGrad.addColorStop(0.50, `rgb(${boardBumpBase}, ${boardBumpBase}, ${boardBumpBase})`);
        hBumpGrad.addColorStop(0.935, `rgb(${boardBumpBase + 10}, ${boardBumpBase + 10}, ${boardBumpBase + 10})`);
        hBumpGrad.addColorStop(0.972, `rgb(${boardBumpBase - 8}, ${boardBumpBase - 8}, ${boardBumpBase - 8})`);
        hBumpGrad.addColorStop(1.0, '#626262');
        wbctx.fillStyle = hBumpGrad;
        wbctx.fillRect(segX, py, segW, plankH);

        // Whisper-soft plank edge depth shading
        const seamGrad = wctx.createLinearGradient(0, py, 0, py + plankH);
        seamGrad.addColorStop(0.0, 'rgba(146, 96, 62, 0.16)');
        seamGrad.addColorStop(0.032, 'rgba(176, 124, 86, 0.04)');
        seamGrad.addColorStop(0.065, 'rgba(255, 240, 222, 0.09)');
        seamGrad.addColorStop(0.16, 'rgba(255, 240, 222, 0.0)');
        seamGrad.addColorStop(0.84, 'rgba(255, 240, 222, 0.0)');
        seamGrad.addColorStop(0.935, 'rgba(255, 238, 220, 0.08)');
        seamGrad.addColorStop(0.968, 'rgba(176, 124, 86, 0.04)');
        seamGrad.addColorStop(1.0, 'rgba(146, 96, 62, 0.16)');
        wctx.fillStyle = seamGrad;
        wctx.fillRect(segX, py, segW, plankH);

        // 4) Delicate, low-contrast silky wood grain fibers along plank length
        const grainCount = 15;
        for (let g = 0; g < grainCount; g++) {
          const gy = py + 2.5 + (g / grainCount) * (plankH - 5);
          const phase = i * 2.1 + p * 3.7 + g * 0.58;
          const amp = 1.2 + (g % 3) * 0.85;
          const isDeepFiber = g % 5 === 0;
          const isLightRay = g % 6 === 2;
          wctx.strokeStyle = isDeepFiber
            ? 'rgba(144, 92, 58, 0.105)'
            : isLightRay
              ? 'rgba(255, 236, 214, 0.095)'
              : 'rgba(166, 114, 78, 0.065)';
          wctx.lineWidth = isDeepFiber ? 1.15 : 0.85;
          wctx.beginPath();
          wctx.moveTo(originX, gy);
          wctx.bezierCurveTo(
            originX + boardW * 0.33,
            gy + Math.sin(phase) * amp,
            originX + boardW * 0.67,
            gy - Math.cos(phase) * amp,
            originX + boardW,
            gy
          );
          wctx.stroke();

          wbctx.strokeStyle = isDeepFiber
            ? 'rgba(116, 116, 116, 0.22)'
            : 'rgba(172, 172, 172, 0.18)';
          wbctx.lineWidth = 0.85;
          wbctx.beginPath();
          wbctx.moveTo(originX, gy);
          wbctx.bezierCurveTo(
            originX + boardW * 0.33,
            gy + Math.sin(phase) * amp,
            originX + boardW * 0.67,
            gy - Math.cos(phase) * amp,
            originX + boardW,
            gy
          );
          wbctx.stroke();

          if (g % 3 === 0) {
            wrctx.strokeStyle = isDeepFiber
              ? 'rgba(218, 218, 218, 0.26)'
              : 'rgba(124, 124, 124, 0.22)';
            wrctx.lineWidth = 1.0;
            wrctx.beginPath();
            wrctx.moveTo(originX, gy);
            wrctx.bezierCurveTo(
              originX + boardW * 0.33,
              gy + Math.sin(phase) * amp,
              originX + boardW * 0.67,
              gy - Math.cos(phase) * amp,
              originX + boardW,
              gy
            );
            wrctx.stroke();
          }
        }

        // Subtle elongated cathedral grain rings on ~40% of planks
        if (h3 > 0.56) {
          const kx = originX + boardW * (0.28 + h1 * 0.44);
          const ky = py + plankH * (0.34 + h2 * 0.32);
          wctx.strokeStyle = 'rgba(148, 96, 62, 0.085)';
          wctx.lineWidth = 0.95;
          for (let r = 1; r <= 3; r++) {
            wctx.beginPath();
            wctx.ellipse(kx, ky, r * 30, r * 3.8, 0.015, 0, Math.PI * 2);
            wctx.stroke();
          }
        }

        // Fine micro oak pore flecks
        const seed = i * 19 + p * 41;
        for (let f = 0; f < 10; f++) {
          const fx = originX + 10 + (((seed + f * 79) % Math.max(24, Math.floor(boardW - 22))));
          const fy = py + 4 + (((seed + f * 31) % Math.max(8, Math.floor(plankH - 8))));
          const flen = 8 + (f % 12);
          wctx.fillStyle = f % 2 === 0 ? 'rgba(140, 88, 56, 0.065)' : 'rgba(255, 238, 218, 0.075)';
          wctx.fillRect(fx, fy, flen, 1.0);
        }

        wctx.restore();
        wbctx.restore();
        wrctx.restore();
      }
    }

    // Ultra-delicate crisp horizontal plank seam + faint bevel catchlight
    wctx.fillStyle = 'rgba(146, 96, 62, 0.25)';
    wctx.fillRect(0, py - 0.55, wSize, 1.15);
    wctx.fillStyle = 'rgba(255, 238, 218, 0.14)';
    wctx.fillRect(0, py + 0.65, wSize, 0.9);
    wrctx.fillStyle = '#e8e8e8';
    wrctx.fillRect(0, py - 0.5, wSize, 1.2);

    // Ultra-delicate crisp staggered vertical end-joints (工字拼错缝)
    for (const jx of joints) {
      wctx.fillStyle = 'rgba(146, 96, 62, 0.23)';
      wctx.fillRect(jx - 0.55, py, 1.1, plankH);
      wctx.fillStyle = 'rgba(255, 238, 218, 0.13)';
      wctx.fillRect(jx + 0.6, py, 0.85, plankH);
      wrctx.fillStyle = '#e6e6e6';
      wrctx.fillRect(jx - 0.5, py, 1.1, plankH);

      const jointBumpGrad = wbctx.createLinearGradient(jx - 2.5, 0, jx + 2.5, 0);
      jointBumpGrad.addColorStop(0.0, '#9e9e9e');
      jointBumpGrad.addColorStop(0.50, '#626262');
      jointBumpGrad.addColorStop(1.0, '#9e9e9e');
      wbctx.fillStyle = jointBumpGrad;
      wbctx.fillRect(jx - 2.5, py + 1, 5, plankH - 2);
    }
  }
  const woodFloor = track(finalizeTexture(woodCanvas, maxAniso, 1, 1));
  const woodFloorBump = track(finalizeTexture(woodBumpCanvas, maxAniso, 1, 1, true));
  const woodFloorRoughness = track(finalizeTexture(woodRoughCanvas, maxAniso, 1, 1, true));

  // 1b. High-Res (1024x1024) Seamless Water-Lacquered Oak Furniture Wood Grain + Micro-Pore Bump (水漆木纹质感)
  const foSize = 1024;
  const foCanvas = document.createElement('canvas');
  foCanvas.width = foSize;
  foCanvas.height = foSize;
  const foCtx = foCanvas.getContext('2d')!;
  const fobCanvas = document.createElement('canvas');
  fobCanvas.width = foSize;
  fobCanvas.height = foSize;
  const fobCtx = fobCanvas.getContext('2d')!;

  // Warm honey-oak base under clear water-based lacquer (100% seamless across UV wraps)
  foCtx.fillStyle = '#dfa170';
  foCtx.fillRect(0, 0, foSize, foSize);

  // Seamless periodic tonal warmth waves (identical at y=0 and y=foSize so tiled UV faces never split)
  const foWave = foCtx.createLinearGradient(0, 0, 0, foSize);
  foWave.addColorStop(0.0, 'rgba(255, 240, 222, 0.08)');
  foWave.addColorStop(0.22, 'rgba(138, 76, 38, 0.075)');
  foWave.addColorStop(0.48, 'rgba(255, 242, 224, 0.095)');
  foWave.addColorStop(0.76, 'rgba(130, 70, 34, 0.075)');
  foWave.addColorStop(1.0, 'rgba(255, 240, 222, 0.08)');
  foCtx.fillStyle = foWave;
  foCtx.fillRect(0, 0, foSize, foSize);

  // Smooth water-lacquer leveled bump base (mid-neutral gray so clearcoat glides smoothly)
  fobCtx.fillStyle = '#848484';
  fobCtx.fillRect(0, 0, foSize, foSize);

  // Organic seamless earlywood / latewood tonal ribbons
  for (let b = 0; b < 20; b++) {
    const by = (b / 20) * foSize;
    const bh = foSize / 34;
    foCtx.fillStyle =
      b % 2 === 0 ? 'rgba(255, 240, 220, 0.065)' : 'rgba(122, 66, 34, 0.060)';
    foCtx.fillRect(0, by, foSize, bh);
  }

  // Rich flowing natural wood grain fibers (crisp & readable under translucent water lacquer)
  for (let i = 0; i < 168; i++) {
    const fy = (i / 168) * foSize;
    const isHighlight = i % 5 === 0;
    const isDeepVein = i % 7 === 0;
    const w = isDeepVein ? 1.55 + (i % 3) * 0.45 : 0.95 + (i % 3) * 0.38;
    foCtx.strokeStyle = isHighlight
      ? 'rgba(255, 244, 226, 0.14)'
      : isDeepVein
        ? 'rgba(104, 52, 24, 0.165)'
        : 'rgba(142, 78, 40, 0.095)';
    foCtx.lineWidth = w;
    foCtx.beginPath();
    foCtx.moveTo(0, fy);
    const wave1 = Math.sin(i * 0.43) * 8.2 + Math.cos(i * 0.17) * 4.5;
    const wave2 = -Math.cos(i * 0.35) * 7.8 + Math.sin(i * 0.21) * 4.0;
    foCtx.bezierCurveTo(foSize * 0.33, fy + wave1, foSize * 0.67, fy + wave2, foSize, fy);
    foCtx.stroke();

    // Softly leveled lacquer micro-groove bump
    fobCtx.strokeStyle = isHighlight
      ? 'rgba(154,154,154,0.22)'
      : isDeepVein
        ? 'rgba(92,92,92,0.34)'
        : 'rgba(114,114,114,0.20)';
    fobCtx.lineWidth = isDeepVein ? 1.3 : 0.95;
    fobCtx.beginPath();
    fobCtx.moveTo(0, fy);
    fobCtx.bezierCurveTo(foSize * 0.33, fy + wave1, foSize * 0.67, fy + wave2, foSize, fy);
    fobCtx.stroke();
  }

  // Authentic nested cathedral wood grain arches (warm honey-amber growth rings)
  for (let c = 0; c < 11; c++) {
    const cx = 86 + ((c * 193) % (foSize - 172));
    const cy = 72 + ((c * 277) % (foSize - 144));
    const tilt = 0.024 * (c % 2 === 0 ? 1 : -1);
    for (let r = 1; r <= 6; r++) {
      foCtx.strokeStyle =
        r % 2 === 0 ? 'rgba(112, 58, 28, 0.145)' : 'rgba(164, 96, 48, 0.105)';
      foCtx.lineWidth = 1.15 + (r % 2) * 0.45;
      foCtx.beginPath();
      foCtx.ellipse(cx, cy, r * 44, r * 6.4, tilt, 0, Math.PI * 2);
      foCtx.stroke();

      fobCtx.strokeStyle = 'rgba(98, 98, 98, 0.22)';
      fobCtx.lineWidth = 1.1;
      fobCtx.beginPath();
      fobCtx.ellipse(cx, cy, r * 44, r * 6.4, tilt, 0, Math.PI * 2);
      fobCtx.stroke();
    }
  }

  // Quarter-sawn oak medullary ray sheen ribbons & delicate fine wood pore flecks
  for (let i = 0; i < 1600; i++) {
    const px = (i * 389 + 37) % foSize;
    const py = (i * 617 + 19) % foSize;
    const len = 8 + (i % 22);
    if (i % 13 === 0) {
      // Silky golden medullary ray sheen under clear water lacquer
      foCtx.fillStyle = 'rgba(255, 246, 224, 0.17)';
      foCtx.fillRect(px, py, len * 1.1, 2.2);
    } else {
      foCtx.fillStyle =
        i % 3 === 0 ? 'rgba(255, 245, 226, 0.11)' : 'rgba(116, 62, 28, 0.125)';
      foCtx.fillRect(px, py, len, 1.2);
      fobCtx.fillStyle = 'rgba(92, 92, 92, 0.24)';
      fobCtx.fillRect(px, py, len, 1.2);
    }
  }
  const furnitureOak = track(finalizeTexture(foCanvas, maxAniso, 1, 1));
  const furnitureWoodBump = track(finalizeTexture(fobCanvas, maxAniso, 1, 1, true));

  // 2. Cozy Light Khaki Woven Area Rug (浅卡其色地毯, 512x512 twill + soft double border + bump)
  const rugSize = 512;
  const rugCanvas = document.createElement('canvas');
  rugCanvas.width = rugSize;
  rugCanvas.height = rugSize;
  const rctx = rugCanvas.getContext('2d')!;
  const rugBumpCanvas = document.createElement('canvas');
  rugBumpCanvas.width = rugSize;
  rugBumpCanvas.height = rugSize;
  const rbctx = rugBumpCanvas.getContext('2d')!;

  rctx.fillStyle = '#ddd0b8';
  rctx.fillRect(0, 0, rugSize, rugSize);
  rbctx.fillStyle = '#808080';
  rbctx.fillRect(0, 0, rugSize, rugSize);

  for (let i = 0; i < rugSize; i += 6) {
    rctx.strokeStyle = i % 12 === 0 ? 'rgba(164, 146, 118, 0.14)' : 'rgba(248, 242, 228, 0.22)';
    rctx.lineWidth = 2;
    rctx.beginPath();
    rctx.moveTo(i, 0);
    rctx.lineTo(i, rugSize);
    rctx.stroke();
    rctx.beginPath();
    rctx.moveTo(0, i);
    rctx.lineTo(rugSize, i);
    rctx.stroke();

    rbctx.strokeStyle = i % 12 === 0 ? 'rgba(54, 54, 54, 0.45)' : 'rgba(196, 196, 196, 0.45)';
    rbctx.lineWidth = 2;
    rbctx.beginPath();
    rbctx.moveTo(i, 0);
    rbctx.lineTo(i, rugSize);
    rbctx.stroke();
    rbctx.beginPath();
    rbctx.moveTo(0, i);
    rbctx.lineTo(rugSize, i);
    rbctx.stroke();
  }
  rctx.strokeStyle = 'rgba(176, 158, 130, 0.30)';
  rctx.lineWidth = 14;
  rctx.strokeRect(18, 18, rugSize - 36, rugSize - 36);
  rctx.strokeStyle = 'rgba(148, 130, 104, 0.18)';
  rctx.lineWidth = 3;
  rctx.strokeRect(32, 32, rugSize - 64, rugSize - 64);
  const rugWeave = track(finalizeTexture(rugCanvas, maxAniso, 1, 1));
  const rugBump = track(finalizeTexture(rugBumpCanvas, maxAniso, 2, 2, true));

  // 3. Genkan dark slate tile (512x512, world-UV scaled 1 tile = 2.0m x 2.0m)
  const genkanCanvas = document.createElement('canvas');
  genkanCanvas.width = 512;
  genkanCanvas.height = 512;
  const gctx = genkanCanvas.getContext('2d')!;
  gctx.fillStyle = '#403852';
  gctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const d = ((x * 3 + y * 5) % 4) * 5;
      gctx.fillStyle = `rgb(${76 + d}, ${66 + d}, ${96 + d})`;
      gctx.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
      gctx.strokeStyle = 'rgba(210, 200, 228, 0.12)';
      gctx.lineWidth = 2;
      gctx.strokeRect(x * 128 + 5, y * 128 + 5, 118, 118);
    }
  }
  const genkanTile = track(finalizeTexture(genkanCanvas, maxAniso, 1, 1));

  // 4. Kitchen glazed porcelain ceramic tile (1024x1024, world-UV scaled 1 tile = 2.0m x 2.0m, 0.5m tiles + beveled bump + roughness)
  const kitSize = 1024;
  const kitCanvas = document.createElement('canvas');
  kitCanvas.width = kitSize;
  kitCanvas.height = kitSize;
  const kctx = kitCanvas.getContext('2d')!;
  const kitBumpCanvas = document.createElement('canvas');
  kitBumpCanvas.width = kitSize;
  kitBumpCanvas.height = kitSize;
  const kbctx = kitBumpCanvas.getContext('2d')!;
  const kitRoughCanvas = document.createElement('canvas');
  kitRoughCanvas.width = kitSize;
  kitRoughCanvas.height = kitSize;
  const krctx = kitRoughCanvas.getContext('2d')!;

  // Warm dark umber mortar grout base for brown & ochre-umber two-tone marble tiles (棕色和赭褐色拼色大理石地砖)
  kctx.fillStyle = '#4e3727';
  kctx.fillRect(0, 0, kitSize, kitSize);
  kbctx.fillStyle = '#242424';
  kbctx.fillRect(0, 0, kitSize, kitSize);
  krctx.fillStyle = '#eaeaea'; // matte mortar grout (roughness ~0.92)
  krctx.fillRect(0, 0, kitSize, kitSize);

  // Subtle granular mortar texture inside grout seams
  for (let i = 0; i < 1800; i++) {
    const gx = (i * 211 + 17) % kitSize;
    const gy = (i * 389 + 43) % kitSize;
    const shade = 58 + (i % 24);
    kctx.fillStyle = `rgba(${shade + 18}, ${shade}, ${Math.max(20, shade - 16)}, 0.40)`;
    kctx.fillRect(gx, gy, 2, 2);
    const bShade = 24 + (i % 22);
    kbctx.fillStyle = `rgb(${bShade}, ${bShade}, ${bShade})`;
    kbctx.fillRect(gx, gy, 2, 2);
  }

  const kitCell = kitSize / 4; // 256px per 0.50m marble tile
  const kitGrout = 2; // Fine hairline stone grout seam
  for (let tyIdx = 0; tyIdx < 4; tyIdx++) {
    for (let txIdx = 0; txIdx < 4; txIdx++) {
      const seed = txIdx * 13 + tyIdx * 29 + 7;
      const x0 = txIdx * kitCell + kitGrout;
      const y0 = tyIdx * kitCell + kitGrout;
      const tw = kitCell - kitGrout * 2;
      const th = kitCell - kitGrout * 2;

      // Checkerboard two-tone natural marble harmony:
      // Tile A = warm walnut brown (棕色), Tile B = earthy ochre-umber / terracotta-sienna (赭褐色)
      const isOchreTile = (txIdx + tyIdx) % 2 === 1;
      const baseR = (isOchreTile ? 166 : 126) + ((seed * 5) % 9) - 4;
      const baseG = (isOchreTile ? 114 : 86) + ((seed * 7) % 9) - 4;
      const baseB = (isOchreTile ? 76 : 60) + ((seed * 11) % 9) - 4;

      // Soft directional polished stone gradient across each marble slab
      const diagGrad = kctx.createLinearGradient(x0, y0, x0 + tw, y0 + th);
      diagGrad.addColorStop(0.0, `rgb(${Math.min(240, baseR + 12)}, ${Math.min(220, baseG + 10)}, ${Math.min(200, baseB + 8)})`);
      diagGrad.addColorStop(0.48, `rgb(${baseR}, ${baseG}, ${baseB})`);
      diagGrad.addColorStop(1.0, `rgb(${Math.max(40, baseR - 11)}, ${Math.max(30, baseG - 9)}, ${Math.max(22, baseB - 8)})`);
      kctx.fillStyle = diagGrad;
      kctx.fillRect(x0, y0, tw, th);

      // Organic warm mineral stone clouding
      for (let m = 0; m < 7; m++) {
        const mx = x0 + 24 + ((seed * 41 + m * 67) % (tw - 48));
        const my = y0 + 24 + ((seed * 59 + m * 83) % (th - 48));
        const mr = 36 + ((seed + m * 19) % 48);
        const mg = kctx.createRadialGradient(mx, my, 2, mx, my, mr);
        const lighter = (seed + m) % 2 === 0;
        mg.addColorStop(0, lighter ? 'rgba(218, 178, 138, 0.20)' : 'rgba(72, 44, 26, 0.22)');
        mg.addColorStop(1, 'rgba(138, 96, 66, 0)');
        kctx.fillStyle = mg;
        kctx.beginPath();
        kctx.arc(mx, my, mr, 0, Math.PI * 2);
        kctx.fill();
      }

      // Layered organic marble calcite veins (warm cream-ivory + pale gold + subtle umber fractures)
      kctx.save();
      kctx.beginPath();
      kctx.rect(x0 + 2, y0 + 2, tw - 4, th - 4);
      kctx.clip();
      for (let v = 0; v < 4; v++) {
        const flip = (seed + v) % 2 === 0;
        const vx1 = flip ? x0 - 8 : x0 + ((seed * 37 + v * 71) % tw);
        const vy1 = flip ? y0 + ((seed * 43 + v * 59) % th) : y0 - 8;
        const vx2 = flip ? x0 + tw + 8 : x0 + ((seed * 67 + v * 97) % tw);
        const vy2 = flip ? y0 + ((seed * 29 + v * 83) % th) : y0 + th + 8;
        const cp1x = (vx1 + vx2) * 0.5 + (((seed + v * 3) % 5) - 2) * 26;
        const cp1y = (vy1 + vy2) * 0.5 - (((seed + v * 5) % 5) - 2) * 22;
        const cp2x = (vx1 + vx2) * 0.5 - (((seed + v * 7) % 5) - 2) * 24;
        const cp2y = (vy1 + vy2) * 0.5 + (((seed + v * 11) % 5) - 2) * 24;

        // Soft diffused mineral halo around primary vein
        kctx.strokeStyle = v === 2 ? 'rgba(84, 50, 30, 0.16)' : 'rgba(236, 212, 182, 0.16)';
        kctx.lineWidth = v === 0 ? 5.0 : 3.0;
        kctx.beginPath();
        kctx.moveTo(vx1, vy1);
        kctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, vx2, vy2);
        kctx.stroke();

        // Crisp core marble vein
        kctx.strokeStyle =
          v === 0
            ? 'rgba(244, 228, 202, 0.36)'
            : v === 2
              ? 'rgba(88, 52, 32, 0.24)'
              : 'rgba(226, 198, 160, 0.26)';
        kctx.lineWidth = v === 0 ? 1.7 : 1.05;
        kctx.beginPath();
        kctx.moveTo(vx1, vy1);
        kctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, vx2, vy2);
        kctx.stroke();

        // Fine offshoot branch fracture
        if (v < 2) {
          const midX = (vx1 + vx2) * 0.5;
          const midY = (vy1 + vy2) * 0.5;
          const bx2 = midX + (v === 0 ? 54 : -48);
          const by2 = midY + (v === 0 ? -38 : 44);
          kctx.strokeStyle = 'rgba(238, 218, 190, 0.22)';
          kctx.lineWidth = 0.85;
          kctx.beginPath();
          kctx.moveTo(midX, midY);
          kctx.quadraticCurveTo(midX + 12, midY - 14, bx2, by2);
          kctx.stroke();
        }
      }
      kctx.restore();

      // Ultra-fine warm stone mineral flecks
      for (let s = 0; s < 36; s++) {
        const sx = x0 + 6 + ((s * 67 + seed * 31) % (tw - 12));
        const sy = y0 + 6 + ((s * 103 + seed * 47) % (th - 12));
        kctx.fillStyle = s % 3 === 0 ? 'rgba(246, 230, 208, 0.16)' : 'rgba(62, 38, 22, 0.18)';
        kctx.fillRect(sx, sy, 2, 2);
      }

      // Crisp micro-beveled marble tile edge highlights
      kctx.strokeStyle = 'rgba(248, 230, 206, 0.34)';
      kctx.lineWidth = 1.4;
      kctx.beginPath();
      kctx.moveTo(x0 + 1, y0 + th - 1);
      kctx.lineTo(x0 + 1, y0 + 1);
      kctx.lineTo(x0 + tw - 1, y0 + 1);
      kctx.stroke();

      kctx.strokeStyle = 'rgba(54, 34, 20, 0.42)';
      kctx.lineWidth = 1.6;
      kctx.beginPath();
      kctx.moveTo(x0 + tw - 1, y0 + 1.5);
      kctx.lineTo(x0 + tw - 1, y0 + th - 1);
      kctx.lineTo(x0 + 1.5, y0 + th - 1);
      kctx.stroke();

      // Bump map: crisp narrow chamfered marble bevel + smooth polished slab face
      kbctx.fillStyle = '#929292';
      kbctx.fillRect(x0, y0, tw, th);
      kbctx.fillStyle = '#cbcbcb';
      kbctx.fillRect(x0 + 1.5, y0 + 1.5, tw - 3, th - 3);
      const bTileGrad = kbctx.createRadialGradient(
        x0 + tw * 0.5,
        y0 + th * 0.5,
        16,
        x0 + tw * 0.5,
        y0 + th * 0.5,
        tw * 0.62
      );
      bTileGrad.addColorStop(0.0, '#efefef');
      bTileGrad.addColorStop(0.85, '#e2e2e2');
      bTileGrad.addColorStop(1.0, '#d4d4d4');
      kbctx.fillStyle = bTileGrad;
      kbctx.fillRect(x0 + 3, y0 + 3, tw - 6, th - 6);

      // Roughness map: polished satin marble face (~0.28-0.35), tight bevel (~0.48), matte grout (~0.92)
      krctx.fillStyle = '#7c7c7c';
      krctx.fillRect(x0, y0, tw, th);
      const roughBase = 70 + ((seed * 7) % 16);
      krctx.fillStyle = `rgb(${roughBase}, ${roughBase}, ${roughBase})`;
      krctx.fillRect(x0 + 2, y0 + 2, tw - 4, th - 4);
      for (let rs = 0; rs < 16; rs++) {
        const rx = x0 + 18 + ((seed * 37 + rs * 59) % (tw - 36));
        const ry = y0 + 18 + ((seed * 61 + rs * 73) % (th - 36));
        const rr = 16 + ((seed + rs * 11) % 26);
        const rg = krctx.createRadialGradient(rx, ry, 1, rx, ry, rr);
        const rv = rs % 2 === 0 ? Math.max(50, roughBase - 14) : roughBase + 16;
        rg.addColorStop(0, `rgba(${rv}, ${rv}, ${rv}, 0.28)`);
        rg.addColorStop(1, `rgba(${roughBase}, ${roughBase}, ${roughBase}, 0)`);
        krctx.fillStyle = rg;
        krctx.beginPath();
        krctx.arc(rx, ry, rr, 0, Math.PI * 2);
        krctx.fill();
      }
    }
  }
  const kitchenTile = track(finalizeTexture(kitCanvas, maxAniso, 1, 1));
  const kitchenTileBump = track(finalizeTexture(kitBumpCanvas, maxAniso, 1, 1, true));
  const kitchenTileRoughness = track(finalizeTexture(kitRoughCanvas, maxAniso, 1, 1, true));

  // 5. High-precision fine-grained cast-in-place concrete (1024x1024, world-UV 1 tile = 2.0m)
  // Generates synchronized albedo (sRGB), micro-grain bump (linear), and roughness (linear) maps
  const conSize = 1024;
  const conCanvas = document.createElement('canvas');
  conCanvas.width = conSize;
  conCanvas.height = conSize;
  const cctx = conCanvas.getContext('2d')!;

  const conBumpCanvas = document.createElement('canvas');
  conBumpCanvas.width = conSize;
  conBumpCanvas.height = conSize;
  const conBumpCtx = conBumpCanvas.getContext('2d')!;

  const conRoughCanvas = document.createElement('canvas');
  conRoughCanvas.width = conSize;
  conRoughCanvas.height = conSize;
  const crctx = conRoughCanvas.getContext('2d')!;

  // Deterministic fast hash PRNG for seamless fine aggregate grit
  let conSeed = 1337421;
  const nextConRand = (): number => {
    conSeed = (conSeed * 1664525 + 1013904223) >>> 0;
    return conSeed / 4294967296;
  };

  // Base mineral Portland-cement neutral slate-grey
  cctx.fillStyle = '#92909a';
  cctx.fillRect(0, 0, conSize, conSize);
  conBumpCtx.fillStyle = '#808080';
  conBumpCtx.fillRect(0, 0, conSize, conSize);
  crctx.fillStyle = '#dadada'; // High matte cement roughness (~0.86)
  crctx.fillRect(0, 0, conSize, conSize);

  // Broad mineral clouding, troweled cement variation & subtle dampness patches (tile-wrapped)
  for (let i = 0; i < 160; i++) {
    const px = nextConRand() * conSize;
    const py = nextConRand() * conSize;
    const rad = 36 + nextConRand() * 110;
    const damp = i % 5 === 0;
    const dark = i % 3 === 0;
    for (const ox of [-conSize, 0, conSize]) {
      for (const oy of [-conSize, 0, conSize]) {
        const cx = px + ox;
        const cy = py + oy;
        if (cx + rad < 0 || cx - rad > conSize || cy + rad < 0 || cy - rad > conSize) continue;
        const g = cctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
        if (damp) {
          g.addColorStop(0, 'rgba(64, 65, 76, 0.17)');
          g.addColorStop(1, 'rgba(130, 128, 138, 0)');
        } else if (dark) {
          g.addColorStop(0, 'rgba(92, 90, 102, 0.14)');
          g.addColorStop(1, 'rgba(146, 144, 154, 0)');
        } else {
          g.addColorStop(0, 'rgba(186, 184, 194, 0.15)');
          g.addColorStop(1, 'rgba(146, 144, 154, 0)');
        }
        cctx.fillStyle = g;
        cctx.beginPath();
        cctx.arc(cx, cy, rad, 0, Math.PI * 2);
        cctx.fill();

        if (damp) {
          const rg = crctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
          rg.addColorStop(0, 'rgba(145, 145, 145, 0.28)'); // Damp spots slightly sleeker
          rg.addColorStop(1, 'rgba(218, 218, 218, 0)');
          crctx.fillStyle = rg;
          crctx.beginPath();
          crctx.arc(cx, cy, rad, 0, Math.PI * 2);
          crctx.fill();
        }
      }
    }
  }

  // Subtle horizontal cast-in-place pour strata & plywood formwork grain lines
  for (let y = 0; y < conSize; y += 3) {
    const wave = Math.sin(y * 0.055) * 0.5 + Math.sin(y * 0.19) * 0.35 + (nextConRand() - 0.5) * 0.6;
    const alpha = Math.abs(wave) * 0.045;
    cctx.fillStyle = wave > 0 ? `rgba(195, 193, 202, ${alpha})` : `rgba(68, 66, 78, ${alpha})`;
    cctx.fillRect(0, y, conSize, 2);

    const bShade = Math.round(128 + wave * 12);
    conBumpCtx.fillStyle = `rgba(${bShade}, ${bShade}, ${bShade}, 0.18)`;
    conBumpCtx.fillRect(0, y, conSize, 2);
  }

  // Fine tactile sand / silica / crushed-limestone mineral aggregate grit (~24,000 micro grains)
  for (let i = 0; i < 24000; i++) {
    const px = Math.floor(nextConRand() * conSize);
    const py = Math.floor(nextConRand() * conSize);
    const sz = nextConRand() > 0.86 ? 2 : 1;
    const bright = nextConRand() > 0.48;
    const v = bright ? 164 + Math.floor(nextConRand() * 48) : 78 + Math.floor(nextConRand() * 46);
    const tint = Math.floor((nextConRand() - 0.5) * 8);
    cctx.fillStyle = `rgba(${v + tint}, ${v}, ${v + 4 - tint}, ${0.22 + nextConRand() * 0.24})`;
    cctx.fillRect(px, py, sz, sz);

    const bv = bright ? 156 + Math.floor(nextConRand() * 76) : 54 + Math.floor(nextConRand() * 56);
    conBumpCtx.fillStyle = `rgba(${bv}, ${bv}, ${bv}, 0.52)`;
    conBumpCtx.fillRect(px, py, sz, sz);

    if (i % 4 === 0) {
      const rv = bright ? 236 : 196;
      crctx.fillStyle = `rgba(${rv}, ${rv}, ${rv}, 0.25)`;
      crctx.fillRect(px, py, sz, sz);
    }
  }

  // Entrapped air-bubble micro pinholes ("bug holes") typical of poured concrete walls
  for (let i = 0; i < 240; i++) {
    const px = nextConRand() * conSize;
    const py = nextConRand() * conSize;
    const r = 0.8 + nextConRand() * 2.4;
    cctx.fillStyle = 'rgba(46, 44, 56, 0.48)';
    cctx.beginPath();
    cctx.arc(px, py, r, 0, Math.PI * 2);
    cctx.fill();
    // Subtle lower-right highlight lip
    cctx.fillStyle = 'rgba(196, 194, 204, 0.22)';
    cctx.beginPath();
    cctx.arc(px + r * 0.45, py + r * 0.45, r * 0.65, 0, Math.PI * 2);
    cctx.fill();

    conBumpCtx.fillStyle = 'rgba(18, 18, 18, 0.85)';
    conBumpCtx.beginPath();
    conBumpCtx.arc(px, py, r * 1.15, 0, Math.PI * 2);
    conBumpCtx.fill();
  }

  // Crisp cast-concrete formwork panel seams (horizontal + staggered vertical panel joints)
  const drawSeam = (x1: number, y1: number, x2: number, y2: number, lw: number) => {
    cctx.strokeStyle = 'rgba(46, 44, 58, 0.34)';
    cctx.lineWidth = lw;
    cctx.beginPath();
    cctx.moveTo(x1, y1);
    cctx.lineTo(x2, y2);
    cctx.stroke();

    cctx.strokeStyle = 'rgba(202, 200, 212, 0.20)';
    cctx.lineWidth = 1.2;
    cctx.beginPath();
    cctx.moveTo(x1 + 1.5, y1 + 1.5);
    cctx.lineTo(x2 + 1.5, y2 + 1.5);
    cctx.stroke();

    conBumpCtx.strokeStyle = 'rgba(28, 28, 28, 0.82)';
    conBumpCtx.lineWidth = lw + 1;
    conBumpCtx.beginPath();
    conBumpCtx.moveTo(x1, y1);
    conBumpCtx.lineTo(x2, y2);
    conBumpCtx.stroke();
  };
  for (const sy of [256, 512, 768]) {
    drawSeam(0, sy, conSize, sy, 2.2);
  }
  drawSeam(512, 0, 512, 256, 1.8);
  drawSeam(256, 256, 256, 512, 1.8);
  drawSeam(768, 256, 768, 512, 1.8);
  drawSeam(512, 512, 512, 768, 1.8);
  drawSeam(256, 768, 256, conSize, 1.8);
  drawSeam(768, 768, 768, conSize, 1.8);

  // Recessed circular form-tie cone holes with faint rust / mineral drip streaks
  const tiePoints: [number, number][] = [
    [128, 128], [384, 128], [640, 128], [896, 128],
    [128, 384], [384, 384], [640, 384], [896, 384],
    [128, 640], [384, 640], [640, 640], [896, 640],
    [128, 896], [384, 896], [640, 896], [896, 896],
  ];
  for (let idx = 0; idx < tiePoints.length; idx++) {
    const [tx, ty] = tiePoints[idx];
    // Faint vertical mineral / rust streak beneath select tie-holes
    if (idx % 3 === 0) {
      const dripLen = 28 + (idx % 4) * 18;
      const dg = cctx.createLinearGradient(tx, ty + 6, tx, ty + 6 + dripLen);
      dg.addColorStop(0, 'rgba(84, 72, 68, 0.24)');
      dg.addColorStop(1, 'rgba(84, 72, 68, 0)');
      cctx.fillStyle = dg;
      cctx.fillRect(tx - 3, ty + 5, 6, dripLen);
    }
    // Outer chamfer ring
    cctx.fillStyle = 'rgba(182, 180, 192, 0.28)';
    cctx.beginPath();
    cctx.arc(tx + 1.2, ty + 1.4, 8.5, 0, Math.PI * 2);
    cctx.fill();
    // Recessed cone pit
    cctx.fillStyle = 'rgba(54, 52, 64, 0.56)';
    cctx.beginPath();
    cctx.arc(tx, ty, 6.8, 0, Math.PI * 2);
    cctx.fill();
    cctx.fillStyle = 'rgba(34, 32, 42, 0.72)';
    cctx.beginPath();
    cctx.arc(tx, ty, 3.6, 0, Math.PI * 2);
    cctx.fill();

    // Matching deep indent in bump map
    const bg = conBumpCtx.createRadialGradient(tx, ty, 1.5, tx, ty, 8.5);
    bg.addColorStop(0, 'rgba(14, 14, 14, 0.96)');
    bg.addColorStop(0.7, 'rgba(42, 42, 42, 0.78)');
    bg.addColorStop(1, 'rgba(128, 128, 128, 0)');
    conBumpCtx.fillStyle = bg;
    conBumpCtx.beginPath();
    conBumpCtx.arc(tx, ty, 9, 0, Math.PI * 2);
    conBumpCtx.fill();
  }

  // Fine branching hairline shrinkage cracks mirrored into bump map
  const drawCrack = (
    sx: number,
    sy: number,
    segs: [number, number][]
  ) => {
    const trace = (ctx2d: CanvasRenderingContext2D, ox: number, oy: number) => {
      ctx2d.beginPath();
      ctx2d.moveTo(sx + ox, sy + oy);
      let cx = sx + ox;
      let cy = sy + oy;
      for (const [dx, dy] of segs) {
        cx += dx;
        cy += dy;
        ctx2d.lineTo(cx, cy);
      }
      ctx2d.stroke();
    };
    cctx.strokeStyle = 'rgba(40, 38, 50, 0.46)';
    cctx.lineWidth = 1.8;
    trace(cctx, 0, 0);
    cctx.strokeStyle = 'rgba(206, 204, 214, 0.22)';
    cctx.lineWidth = 1.0;
    trace(cctx, 1.6, 1.2);

    conBumpCtx.strokeStyle = 'rgba(16, 16, 16, 0.88)';
    conBumpCtx.lineWidth = 2.6;
    trace(conBumpCtx, 0, 0);
  };

  drawCrack(176, 144, [[38, 48], [-22, 58], [46, 72], [16, 48], [-32, 42]]);
  drawCrack(640, 370, [[-48, 58], [-26, 44], [-62, 68], [18, 50]]);
  drawCrack(380, 680, [[64, 38], [34, 66], [78, 48], [-24, 54]]);
  drawCrack(850, 96, [[-34, 56], [26, 52], [-42, 66]]);

  // Small chipped concrete spalling pockets mirrored into bump
  for (const [cx, cy, r] of [
    [292, 420, 16],
    [784, 630, 20],
    [152, 840, 13],
    [596, 184, 12],
    [904, 876, 17],
  ]) {
    cctx.fillStyle = 'rgba(54, 51, 64, 0.34)';
    cctx.beginPath();
    cctx.ellipse(cx, cy, r, r * 0.65, 0.4, 0, Math.PI * 2);
    cctx.fill();
    cctx.fillStyle = 'rgba(184, 182, 194, 0.24)';
    cctx.beginPath();
    cctx.ellipse(cx + 2.5, cy + 2.5, r * 0.65, r * 0.42, 0.4, 0, Math.PI * 2);
    cctx.fill();

    conBumpCtx.fillStyle = 'rgba(28, 28, 28, 0.78)';
    conBumpCtx.beginPath();
    conBumpCtx.ellipse(cx, cy, r, r * 0.65, 0.4, 0, Math.PI * 2);
    conBumpCtx.fill();
  }

  const concrete = track(finalizeTexture(conCanvas, maxAniso, 1, 1));
  const concreteBump = track(finalizeTexture(conBumpCanvas, maxAniso, 1, 1, true));
  const concreteRoughness = track(finalizeTexture(conRoughCanvas, maxAniso, 1, 1, true));

  // 5B. Basement matte ceramic/stone floor tiles (4x4 grid per 2m x 2m world tile)
  const btCanvas = document.createElement('canvas');
  btCanvas.width = 512;
  btCanvas.height = 512;
  const bt = btCanvas.getContext('2d')!;
  bt.fillStyle = '#4f4a5a'; // Grout base
  bt.fillRect(0, 0, 512, 512);
  const bTileSize = 128;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const shade = ((tx * 3 + ty * 5) % 4) * 5 - 8;
      bt.fillStyle = `rgb(${132 + shade}, ${127 + shade}, ${140 + shade})`;
      bt.fillRect(tx * bTileSize + 3, ty * bTileSize + 3, bTileSize - 6, bTileSize - 6);

      // Subtle corner bevel & surface scuffing on each tile
      bt.fillStyle = 'rgba(210, 206, 220, 0.10)';
      bt.fillRect(tx * bTileSize + 4, ty * bTileSize + 4, bTileSize - 8, 5);
      bt.fillStyle = 'rgba(42, 38, 52, 0.12)';
      bt.fillRect(tx * bTileSize + 4, (ty + 1) * bTileSize - 9, bTileSize - 8, 5);
    }
  }
  for (let i = 0; i < 1200; i++) {
    const px = (i * 97) % 512;
    const py = (i * 193) % 512;
    bt.fillStyle = i % 3 === 0 ? 'rgba(48, 44, 58, 0.16)' : 'rgba(195, 190, 205, 0.12)';
    bt.fillRect(px, py, 3, 2);
  }
  // Subtle grime patches across tiles
  for (const [gx, gy, gr] of [
    [110, 140, 48],
    [360, 290, 62],
    [220, 420, 54],
  ]) {
    const gg = bt.createRadialGradient(gx, gy, 4, gx, gy, gr);
    gg.addColorStop(0, 'rgba(48, 42, 52, 0.22)');
    gg.addColorStop(1, 'rgba(48, 42, 52, 0)');
    bt.fillStyle = gg;
    bt.beginPath();
    bt.arc(gx, gy, gr, 0, Math.PI * 2);
    bt.fill();
  }
  const basementTile = track(finalizeTexture(btCanvas, maxAniso, 1, 1));

  // 5C. Stained & weathered dirty basement rug
  const drCanvas = document.createElement('canvas');
  drCanvas.width = 512;
  drCanvas.height = 512;
  const dr = drCanvas.getContext('2d')!;
  dr.fillStyle = '#68545c';
  dr.fillRect(0, 0, 512, 512);

  // Woven fabric warp/weft grain
  for (let i = 0; i < 512; i += 4) {
    dr.fillStyle = i % 8 === 0 ? 'rgba(35, 28, 34, 0.14)' : 'rgba(180, 162, 165, 0.08)';
    dr.fillRect(0, i, 512, 2);
    dr.fillRect(i, 0, 2, 512);
  }

  // Faded vintage geometric carpet borders & worn center medallion
  dr.strokeStyle = 'rgba(176, 152, 134, 0.42)';
  dr.lineWidth = 14;
  dr.strokeRect(24, 24, 464, 464);
  dr.strokeStyle = 'rgba(74, 58, 74, 0.45)';
  dr.lineWidth = 6;
  dr.strokeRect(46, 46, 420, 420);

  dr.strokeStyle = 'rgba(164, 140, 126, 0.34)';
  dr.lineWidth = 5;
  dr.beginPath();
  dr.moveTo(256, 95);
  dr.lineTo(410, 256);
  dr.lineTo(256, 417);
  dr.lineTo(102, 256);
  dr.closePath();
  dr.stroke();

  // Heavy grime, oil stains, muddy scuffs & threadbare faded patches
  for (const [sx, sy, sr, alpha] of [
    [168, 195, 78, 0.36],
    [340, 310, 92, 0.42],
    [250, 245, 65, 0.28],
    [118, 380, 60, 0.34],
    [390, 145, 58, 0.32],
    [210, 420, 74, 0.30],
  ]) {
    const sg = dr.createRadialGradient(sx, sy, 6, sx, sy, sr);
    sg.addColorStop(0, `rgba(34, 29, 32, ${alpha})`);
    sg.addColorStop(0.6, `rgba(52, 44, 42, ${alpha * 0.55})`);
    sg.addColorStop(1, 'rgba(52, 44, 42, 0)');
    dr.fillStyle = sg;
    dr.beginPath();
    dr.arc(sx, sy, sr, 0, Math.PI * 2);
    dr.fill();
  }
  const dirtyRug = track(finalizeTexture(drCanvas, maxAniso, 1, 1));

  // 6. Striped sofa cushions (harmonized soft cream, dusty blue & lavender stripes)
  const cushCanvas = document.createElement('canvas');
  cushCanvas.width = 128;
  cushCanvas.height = 128;
  const cuctx = cushCanvas.getContext('2d')!;
  cuctx.fillStyle = '#ece6f2';
  cuctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 24) {
    cuctx.fillStyle = x % 48 === 0 ? '#7994b8' : '#a887ad';
    cuctx.fillRect(x, 0, 10, 128);
  }
  const cushionStripes = track(finalizeTexture(cushCanvas, maxAniso, 1, 1));

  // 7. Wall clock face
  const clCanvas = document.createElement('canvas');
  clCanvas.width = 256;
  clCanvas.height = 256;
  const cl = clCanvas.getContext('2d')!;
  cl.fillStyle = '#f0eaf5';
  cl.beginPath();
  cl.arc(128, 128, 122, 0, Math.PI * 2);
  cl.fill();
  cl.strokeStyle = '#4f5d96';
  cl.lineWidth = 10;
  cl.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    cl.strokeStyle = '#332b4a';
    cl.lineWidth = i % 3 === 0 ? 5 : 2.5;
    cl.beginPath();
    cl.moveTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
    cl.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108);
    cl.stroke();
  }
  cl.strokeStyle = '#251e38';
  cl.lineWidth = 7;
  cl.beginPath();
  cl.moveTo(128, 128);
  cl.lineTo(128 - 44, 128 - 32);
  cl.stroke();
  cl.lineWidth = 4;
  cl.beginPath();
  cl.moveTo(128, 128);
  cl.lineTo(128 - 18, 128 - 84);
  cl.stroke();
  const clockFace = track(finalizeTexture(clCanvas, maxAniso));

  // 8. TV Standby (with soft warm MiSide screen reflection highlight so UnrealBloomPass threshold=0.68 softens TV edges)
  const tv1 = document.createElement('canvas');
  tv1.width = 512;
  tv1.height = 288;
  const t1 = tv1.getContext('2d')!;
  const tvGrad = t1.createLinearGradient(0, 0, 512, 288);
  tvGrad.addColorStop(0, '#2a2433');
  tvGrad.addColorStop(0.48, '#383044');
  tvGrad.addColorStop(1, '#221d2b');
  t1.fillStyle = tvGrad;
  t1.fillRect(0, 0, 512, 288);
  // Soft diagonal window-light sheen & warm center glow on the TV glass
  const tvGlow = t1.createRadialGradient(256, 136, 12, 256, 144, 240);
  tvGlow.addColorStop(0, 'rgba(255, 232, 214, 0.42)');
  tvGlow.addColorStop(0.5, 'rgba(255, 216, 196, 0.18)');
  tvGlow.addColorStop(1, 'rgba(255, 200, 175, 0.0)');
  t1.fillStyle = tvGlow;
  t1.fillRect(0, 0, 512, 288);
  t1.fillStyle = 'rgba(255, 238, 224, 0.22)';
  t1.fillRect(28, 18, 456, 4);
  const tvStandby = track(finalizeTexture(tv1, maxAniso));

  // 9. TV Cozy Retro Pixel Game Splash (Warm, high-saturation, zero horror!)
  const tv2 = document.createElement('canvas');
  tv2.width = 256;
  tv2.height = 144;
  const t2 = tv2.getContext('2d')!;
  t2.imageSmoothingEnabled = false;
  t2.fillStyle = '#38c8ff';
  t2.fillRect(0, 0, 256, 144);
  t2.fillStyle = '#8ef0ff';
  t2.fillRect(0, 62, 256, 42);
  t2.fillStyle = '#3be055';
  t2.fillRect(0, 104, 256, 40);
  t2.fillStyle = '#22b33d';
  for (let gx = 0; gx < 256; gx += 16) {
    t2.fillRect(gx, 104, 8, 8);
    t2.fillRect(gx + 8, 112, 8, 8);
  }
  // Cheerful pixel sun & banner
  t2.fillStyle = '#ffe53b';
  t2.fillRect(204, 14, 24, 24);
  t2.fillStyle = '#ff5789';
  t2.fillRect(36, 36, 184, 38);
  t2.fillStyle = '#fff5d6';
  t2.fillRect(40, 40, 176, 30);
  t2.fillStyle = '#ff3d71';
  t2.font = 'bold 14px monospace';
  t2.textAlign = 'center';
  t2.fillText('SUPER BOING!!', 128, 60);
  const tvMeta = track(finalizeTexture(tv2, maxAniso));
  tvMeta.magFilter = THREE.NearestFilter;
  tvMeta.minFilter = THREE.NearestFilter;

  // 10. Bedroom PC Wireframe Console
  const pcCanvas = document.createElement('canvas');
  pcCanvas.width = 512;
  pcCanvas.height = 320;
  const pc = pcCanvas.getContext('2d')!;
  pc.fillStyle = '#141122';
  pc.fillRect(0, 0, 512, 320);
  pc.strokeStyle = '#53d8fb';
  pc.lineWidth = 1.5;
  pc.strokeRect(18, 18, 476, 284);
  pc.fillStyle = '#f26a8d';
  pc.fillRect(18, 18, 476, 32);
  pc.fillStyle = '#141122';
  pc.font = 'bold 16px monospace';
  pc.fillText('ROOM_SIMULATION // 6_ZONES_ACTIVE', 28, 40);
  pc.strokeStyle = 'rgba(83, 216, 251, 0.55)';
  pc.strokeRect(42, 72, 200, 150);
  pc.strokeRect(142, 72, 100, 90);
  pc.fillStyle = '#8ef0ff';
  pc.font = '14px monospace';
  pc.fillText('> LIVING_ROOM: LOCKED', 268, 96);
  pc.fillText('> BASEMENT:    OPEN', 268, 124);
  pc.fillText('> SUBJECT_01:  WATCHING', 268, 152);
  pc.fillStyle = '#ff7b9c';
  pc.fillText('> WARNING: DO NOT EXIT', 42, 266);
  const pcTerminal = track(finalizeTexture(pcCanvas, maxAniso));

  // 11. Basement CRT Monitor
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = 384;
  crtCanvas.height = 288;
  const crt = crtCanvas.getContext('2d')!;
  crt.fillStyle = '#091614';
  crt.fillRect(0, 0, 384, 288);
  crt.fillStyle = '#58f0b8';
  crt.font = '16px monospace';
  crt.fillText('SECTOR_06 // STORAGE_VAULT', 24, 48);
  crt.fillText('CORE_INTEGRITY: 42%', 24, 84);
  crt.fillText('DOOR_SEAL: BYPASSED', 24, 120);
  crt.fillStyle = '#ff6b7a';
  crt.fillText('SHE KNOWS YOU ARE HERE.', 24, 188);
  const crtBasement = track(finalizeTexture(crtCanvas, maxAniso));

  // 12. Fridge Sticky Note
  const noteCanvas = document.createElement('canvas');
  noteCanvas.width = 128;
  noteCanvas.height = 128;
  const nctx = noteCanvas.getContext('2d')!;
  nctx.fillStyle = '#f9e396';
  nctx.fillRect(0, 0, 128, 128);
  nctx.fillStyle = '#c43b4b';
  nctx.fillRect(0, 0, 128, 14);
  nctx.fillStyle = '#332136';
  nctx.font = 'bold 16px sans-serif';
  nctx.fillText('不要下楼', 26, 56);
  nctx.fillText('锁好门。', 26, 86);
  const stickyNote = track(finalizeTexture(noteCanvas, maxAniso));

  // 13. Delicate Circular Radial Dust Mote Sprite
  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = 64;
  dustCanvas.height = 64;
  const dctx = dustCanvas.getContext('2d')!;
  const dGrad = dctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  dGrad.addColorStop(0, 'rgba(255, 238, 215, 1.0)');
  dGrad.addColorStop(0.35, 'rgba(255, 198, 155, 0.65)');
  dGrad.addColorStop(1, 'rgba(255, 175, 130, 0.0)');
  dctx.fillStyle = dGrad;
  dctx.fillRect(0, 0, 64, 64);
  const dustMote = track(finalizeTexture(dustCanvas, maxAniso));

  // 14. Soft Diffused Afternoon Window-Pane Light Pool Gobo on Floor (#fff3d6)
  const goboCanvas = document.createElement('canvas');
  goboCanvas.width = 256;
  goboCanvas.height = 256;
  const gb = goboCanvas.getContext('2d')!;
  gb.fillStyle = '#000000';
  gb.fillRect(0, 0, 256, 256);
  const baseGrad = gb.createLinearGradient(256, 128, 0, 128);
  baseGrad.addColorStop(0.0, 'rgba(255, 243, 214, 0.92)');
  baseGrad.addColorStop(0.55, 'rgba(255, 232, 196, 0.64)');
  baseGrad.addColorStop(1.0, 'rgba(255, 224, 184, 0.12)');
  gb.fillStyle = baseGrad;
  gb.fillRect(14, 14, 228, 228);
  gb.filter = 'blur(8px)';
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 2; row++) {
      const x = 20 + col * 74;
      const y = 22 + row * 108;
      const fade = 0.72 + col * 0.14;
      gb.fillStyle = `rgba(255, 245, 220, ${(0.85 * fade).toFixed(2)})`;
      gb.fillRect(x, y, 64, 96);
    }
  }
  const windowLightGobo = track(finalizeTexture(goboCanvas, maxAniso));

  // 15. Unified Warm Creamy-Beige Wallpaper (统一米黄色墙纸 #f5ecde, 仅保留竖线和小花的装饰, 去除大图案)
  //     Shared across Living Room, Entryway, Bedroom, and Dining Room for 100% cohesive MiSide warmth!
  const paintUnifiedBeigeFloralWallpaper = (
    canvas: HTMLCanvasElement,
    baseHex: string,
    stripeRgba: string,
    flowerPetalRgba: string,
    flowerCenterRgba: string
  ) => {
    canvas.width = 512;
    canvas.height = 512;
    const wctx = canvas.getContext('2d')!;
    wctx.fillStyle = baseHex;
    wctx.fillRect(0, 0, 512, 512);

    // Subtle matte paper fiber micro-grain
    for (let y = 0; y < 512; y += 4) {
      wctx.fillStyle = (y / 4) % 2 === 0 ? 'rgba(255, 252, 245, 0.14)' : 'rgba(218, 198, 174, 0.08)';
      wctx.fillRect(0, y, 512, 2);
    }

    // 1. Delicate vertical pin-stripes (保留竖线装饰)
    for (let x = 0; x < 512; x += 32) {
      // Soft wide warm-cream vertical rib
      wctx.fillStyle = 'rgba(236, 220, 198, 0.22)';
      wctx.fillRect(x, 0, 12, 512);

      // Crisp fine vertical pin-stripe pair
      wctx.strokeStyle = stripeRgba;
      wctx.lineWidth = 1.4;
      wctx.beginPath();
      wctx.moveTo(x + 16, 0);
      wctx.lineTo(x + 16, 512);
      wctx.stroke();

      wctx.strokeStyle = 'rgba(255, 251, 244, 0.45)';
      wctx.lineWidth = 1.0;
      wctx.beginPath();
      wctx.moveTo(x + 18, 0);
      wctx.lineTo(x + 18, 512);
      wctx.stroke();
    }

    // 2. Ditsy tiny 5-petal floral motifs nestled between vertical stripes (保留小花的装饰, 去掉所有大图案)
    const stepX = 64;
    const stepY = 64;
    for (let gy = 0; gy < 512; gy += stepY) {
      for (let gx = 0; gx < 512; gx += stepX) {
        const rowIdx = Math.round(gy / stepY);
        const cx = gx + ((rowIdx & 1) === 1 ? 32 : 0) + 16;
        const cy = gy + 32;
        if (cx >= 512) continue;

        // Tiny pair of sage-taupe leaves beneath the mini blossom
        wctx.fillStyle = 'rgba(188, 172, 148, 0.36)';
        for (const side of [-1, 1]) {
          wctx.beginPath();
          wctx.ellipse(cx + side * 4.2, cy + 3.2, 3.2, 1.4, side * 0.45, 0, Math.PI * 2);
          wctx.fill();
        }

        // Tiny 5-petal ditsy blossom (radius ~4.5px — delicate & never oversized)
        wctx.fillStyle = flowerPetalRgba;
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * Math.PI * 2 - Math.PI / 2;
          wctx.beginPath();
          wctx.ellipse(
            cx + Math.cos(ang) * 3.6,
            cy + Math.sin(ang) * 3.6,
            2.6,
            1.8,
            ang,
            0,
            Math.PI * 2
          );
          wctx.fill();
        }

        // Warm honey-gold flowerpistil dot
        wctx.fillStyle = flowerCenterRgba;
        wctx.beginPath();
        wctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
        wctx.fill();
      }
    }
  };

  // Clean cool blue-violet-tinted off-white living room wallpaper matching ceiling tone
  const wpLivCanvas = document.createElement('canvas');
  wpLivCanvas.width = 512;
  wpLivCanvas.height = 512;
  {
    const lctx = wpLivCanvas.getContext('2d')!;
    // Creamy blush-white pastel wallpaper (奶油粉白色)
    lctx.fillStyle = '#fff4f6';
    lctx.fillRect(0, 0, 512, 512);

    // Whisper-soft warm blush-cream linen paper weave
    for (let y = 0; y < 512; y += 4) {
      lctx.fillStyle = (y / 4) % 2 === 0 ? 'rgba(255, 252, 253, 0.30)' : 'rgba(244, 224, 232, 0.12)';
      lctx.fillRect(0, y, 512, 2);
    }
    // Ultra-delicate pastel rose-cream vertical pinstripe rib
    for (let x = 0; x < 512; x += 32) {
      lctx.fillStyle = 'rgba(250, 234, 240, 0.22)';
      lctx.fillRect(x, 0, 12, 512);
      lctx.strokeStyle = 'rgba(236, 214, 224, 0.24)';
      lctx.lineWidth = 1.1;
      lctx.beginPath();
      lctx.moveTo(x + 16, 0);
      lctx.lineTo(x + 16, 512);
      lctx.stroke();
    }
    // Delicate tone-on-tone tiny cream-blossom floral dots
    for (let gy = 0; gy < 512; gy += 64) {
      for (let gx = 0; gx < 512; gx += 64) {
        const rowIdx = Math.round(gy / 64);
        const cx = gx + ((rowIdx & 1) === 1 ? 32 : 0) + 16;
        const cy = gy + 32;
        if (cx >= 512) continue;
        lctx.fillStyle = 'rgba(255, 253, 254, 0.72)';
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * Math.PI * 2 - Math.PI / 2;
          lctx.beginPath();
          lctx.ellipse(cx + Math.cos(ang) * 3.2, cy + Math.sin(ang) * 3.2, 2.2, 1.5, ang, 0, Math.PI * 2);
          lctx.fill();
        }
        lctx.fillStyle = 'rgba(244, 206, 220, 0.48)';
        lctx.beginPath();
        lctx.arc(cx, cy, 1.3, 0, Math.PI * 2);
        lctx.fill();
      }
    }
  }
  // repeat = (1, 1) because addWall scales UVs directly in world meters!
  const wallpaperLiving = track(finalizeTexture(wpLivCanvas, maxAniso, 1, 1));

  // 16. World-Scaled Warm Light Peach-Wood Wainscoting Texture (比木质框线略浅的温润桃木色护墙板)
  const wainCanvas = document.createElement('canvas');
  wainCanvas.width = 512;
  wainCanvas.height = 512;
  const wn = wainCanvas.getContext('2d')!;
  wn.fillStyle = '#dba078';
  wn.fillRect(0, 0, 512, 512);

  // 8 vertical tongue-and-groove planks per 1.0m tile (64px per vertical plank)
  const plankStep = 64;
  for (let p = 0; p < 8; p++) {
    const px = p * plankStep;
    const toneDelta = ((p * 5 + 3) % 5) - 2;
    const rP = 219 + toneDelta * 2.2;
    const gP = 158 + toneDelta * 1.8;
    const bP = 118 + toneDelta * 1.5;
    wn.fillStyle = `rgb(${Math.round(rP)}, ${Math.round(gP)}, ${Math.round(bP)})`;
    wn.fillRect(px, 0, plankStep, 512);

    const pGrad = wn.createLinearGradient(px, 0, px + plankStep, 0);
    pGrad.addColorStop(0.0, 'rgba(136, 76, 44, 0.18)');
    pGrad.addColorStop(0.14, 'rgba(246, 208, 178, 0.12)');
    pGrad.addColorStop(0.5, 'rgba(252, 218, 190, 0.14)');
    pGrad.addColorStop(0.86, 'rgba(246, 208, 178, 0.10)');
    pGrad.addColorStop(1.0, 'rgba(136, 76, 44, 0.20)');
    wn.fillStyle = pGrad;
    wn.fillRect(px, 0, plankStep, 512);

    // Rich warm peach-wood V-groove seam between adjacent planks
    wn.strokeStyle = 'rgba(128, 70, 40, 0.34)';
    wn.lineWidth = 1.8;
    wn.beginPath();
    wn.moveTo(px, 0);
    wn.lineTo(px, 512);
    wn.stroke();

    wn.strokeStyle = 'rgba(248, 212, 184, 0.30)';
    wn.lineWidth = 1.2;
    wn.beginPath();
    wn.moveTo(px + 2, 0);
    wn.lineTo(px + 2, 512);
    wn.stroke();
  }

  // Fine, delicate vertical peach-wood fibers
  for (let x = 2; x < 512; x += 4) {
    const plankIdx = Math.floor(x / plankStep);
    const localX = ((x % plankStep) - plankStep * 0.5) / (plankStep * 0.5);
    const isDark = (x / 4) % 2 === 0;
    wn.strokeStyle = isDark ? 'rgba(148, 84, 50, 0.11)' : 'rgba(248, 214, 188, 0.10)';
    wn.lineWidth = 1.05;
    wn.beginPath();
    const phaseShift = plankIdx * 1.15;
    for (let y = 0; y <= 512; y += 24) {
      const arch =
        Math.sin((y / 512) * Math.PI * 2.0 + phaseShift) * (1.0 - Math.abs(localX)) * 2.4;
      if (y === 0) wn.moveTo(x + arch, y);
      else wn.lineTo(x + arch, y);
    }
    wn.stroke();
  }
  const wainscotWood = track(finalizeTexture(wainCanvas, maxAniso, 1, 1));

  // 16b. Crisp Creamy-White Vertical Beadboard Wainscoting for MiSide Bedroom (matching reference screenshots!)
  const wainWhiteCanvas = document.createElement('canvas');
  wainWhiteCanvas.width = 512;
  wainWhiteCanvas.height = 512;
  const wnw = wainWhiteCanvas.getContext('2d')!;
  wnw.fillStyle = '#faf5f4';
  wnw.fillRect(0, 0, 512, 512);
  for (let p = 0; p < 8; p++) {
    const px = p * plankStep;
    const wGrad = wnw.createLinearGradient(px, 0, px + plankStep, 0);
    wGrad.addColorStop(0.0, 'rgba(196, 174, 182, 0.24)');
    wGrad.addColorStop(0.10, 'rgba(255, 252, 252, 0.45)');
    wGrad.addColorStop(0.50, 'rgba(255, 254, 255, 0.35)');
    wGrad.addColorStop(0.90, 'rgba(250, 244, 246, 0.25)');
    wGrad.addColorStop(1.0, 'rgba(192, 168, 178, 0.26)');
    wnw.fillStyle = wGrad;
    wnw.fillRect(px, 0, plankStep, 512);

    wnw.strokeStyle = 'rgba(182, 158, 168, 0.42)';
    wnw.lineWidth = 1.8;
    wnw.beginPath();
    wnw.moveTo(px, 0);
    wnw.lineTo(px, 512);
    wnw.stroke();

    wnw.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    wnw.lineWidth = 1.2;
    wnw.beginPath();
    wnw.moveTo(px + 2, 0);
    wnw.lineTo(px + 2, 512);
    wnw.stroke();
  }
  const wainscotWhite = track(finalizeTexture(wainWhiteCanvas, maxAniso, 1, 1));

  // 17. Bedroom Wallpaper: French Sage-Celadon Vertical Regency Stripes & Delicate Botanical Damask (法式淡绿碎花竖条纹壁纸)
  const wpBedCanvas = document.createElement('canvas');
  wpBedCanvas.width = 512;
  wpBedCanvas.height = 512;
  const bwp = wpBedCanvas.getContext('2d')!;
  // Soft French pale sage-pistachio paper base
  bwp.fillStyle = '#dde9d9';
  bwp.fillRect(0, 0, 512, 512);

  // Classic French Regency vertical tonal stripes (seamless 64px repeat)
  for (let x = 0; x < 512; x += 64) {
    bwp.fillStyle = 'rgba(250, 252, 245, 0.44)';
    bwp.fillRect(x, 0, 28, 512);
    bwp.fillStyle = 'rgba(136, 168, 132, 0.14)';
    bwp.fillRect(x + 28, 0, 3, 512);
    bwp.fillRect(x + 61, 0, 3, 512);
  }

  // Subtle matte French linen paper weave micro-grain
  for (let y = 0; y < 512; y += 6) {
    bwp.fillStyle = y % 12 === 0 ? 'rgba(255, 255, 248, 0.08)' : 'rgba(122, 152, 118, 0.05)';
    bwp.fillRect(0, y, 512, 2);
  }

  // Delicate French botanical sage-leaf medallion & cream-ivory blossom motif (seamless wrapping)
  const drawFrenchMedallion = (cx: number, cy: number, scale: number) => {
    for (const ox of [-512, 0, 512]) {
      for (const oy of [-512, 0, 512]) {
        const x = cx + ox;
        const y = cy + oy;
        if (x < -48 || x > 560 || y < -48 || y > 560) continue;
        // Symmetrical French damask olive-sage leaves
        bwp.fillStyle = 'rgba(128, 162, 124, 0.34)';
        for (const dir of [-1, 1]) {
          bwp.save();
          bwp.translate(x + dir * 11 * scale, y + 2 * scale);
          bwp.rotate(dir * 0.48);
          bwp.beginPath();
          bwp.ellipse(0, 0, 12 * scale, 4.8 * scale, 0, 0, Math.PI * 2);
          bwp.fill();
          bwp.restore();

          bwp.save();
          bwp.translate(x + dir * 9 * scale, y - 10 * scale);
          bwp.rotate(dir * -0.42);
          bwp.beginPath();
          bwp.ellipse(0, 0, 9.5 * scale, 4.0 * scale, 0, 0, Math.PI * 2);
          bwp.fill();
          bwp.restore();
        }
        // Central delicate French cream-white fleur-de-lis blossom
        bwp.fillStyle = 'rgba(252, 250, 242, 0.72)';
        for (let p = 0; p < 4; p++) {
          const a = (p / 4) * Math.PI * 2;
          bwp.beginPath();
          bwp.ellipse(
            x + Math.cos(a) * 6.5 * scale,
            y + Math.sin(a) * 6.5 * scale,
            5.2 * scale,
            3.4 * scale,
            a,
            0,
            Math.PI * 2
          );
          bwp.fill();
        }
        bwp.fillStyle = 'rgba(218, 198, 138, 0.65)';
        bwp.beginPath();
        bwp.arc(x, y, 2.8 * scale, 0, Math.PI * 2);
        bwp.fill();
      }
    }
  };

  const cell = 128;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const ix = col * cell + 32;
      const iy = row * cell + 32;
      drawFrenchMedallion(ix, iy, 1.0);
      drawFrenchMedallion(ix + cell * 0.5, iy + cell * 0.5, 0.86);
    }
  }
  const wallpaperBedroom = track(finalizeTexture(wpBedCanvas, maxAniso, 1, 1));

  // 18. Dining & Kitchen Wallpaper: Bright Creamy Blush-Ivory (#fff4f0) with Vertical Stripes & Tiny Flowers
  const wpDinCanvas = document.createElement('canvas');
  paintUnifiedBeigeFloralWallpaper(
    wpDinCanvas,
    '#fff4f0',
    'rgba(234, 212, 204, 0.28)',
    'rgba(255, 252, 250, 0.85)',
    'rgba(244, 204, 186, 0.58)'
  );
  const wallpaperDining = track(finalizeTexture(wpDinCanvas, maxAniso, 1, 1));

  // =========================================================================
  // 19. ECLECTIC SOFA ARTWORK GALLERY (4 Distinct Styles!)
  //   [0] Constructivist Newspaper Collage (构成主义的拼接报纸)
  //   [1] Satirical Caricature of a Fictional Politician (恶搞虚构政治人物的画)
  //   [2] Chibi Anime Girl Illustration (Q版二次元少女)
  //   [3] Surreal Bauhaus Geometric Eye Print (超现实几何构成小画)
  // =========================================================================
  const sofaArtworks: THREE.CanvasTexture[] = [];

  // Artwork 0: Constructivist Newspaper Collage (构成主义的拼接报纸)
  {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 384;
    const ctx = c.getContext('2d')!;
    // Aged cream parchment base
    ctx.fillStyle = '#ece2cf';
    ctx.fillRect(0, 0, 512, 384);

    // Pasted yellowed newspaper clipping blocks at tilted angles
    const drawNewsClipping = (
      x: number,
      y: number,
      w: number,
      h: number,
      angle: number,
      bg: string,
      headline: string
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = bg;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(40,34,30,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      // Headline banner
      ctx.fillStyle = '#221e1d';
      ctx.font = 'bold 16px serif';
      ctx.fillText(headline, -w / 2 + 10, -h / 2 + 22);
      ctx.fillRect(-w / 2 + 8, -h / 2 + 28, w - 16, 2);
      // Simulated newsprint text columns
      ctx.fillStyle = 'rgba(42, 38, 35, 0.58)';
      const cols = 3;
      const colW = (w - 24) / cols;
      for (let col = 0; col < cols; col++) {
        const cx = -w / 2 + 10 + col * (colW + 3);
        for (let ly = -h / 2 + 38; ly < h / 2 - 8; ly += 6) {
          const lineLen = colW * (0.65 + (((ly * 17 + col * 31) % 35) / 100));
          ctx.fillRect(cx, ly, lineLen, 2.5);
        }
      }
      ctx.restore();
    };

    drawNewsClipping(155, 135, 220, 170, -0.11, '#dfd2ba', 'DAILY ECHO // 1924');
    drawNewsClipping(355, 225, 210, 185, 0.08, '#d4c3a6', 'GAZETTE NO. 14');
    drawNewsClipping(180, 290, 230, 130, 0.04, '#e5d9c3', 'EXTRA: TIME STOPPED');

    // Bold El Lissitzky / Rodchenko Constructivist geometric wedges & circles
    ctx.save();
    ctx.fillStyle = '#c8322b'; // Avant-garde crimson wedge ("Beat the Whites with the Red Wedge")
    ctx.beginPath();
    ctx.moveTo(45, 42);
    ctx.lineTo(340, 175);
    ctx.lineTo(135, 255);
    ctx.closePath();
    ctx.fill();

    // Warm cocoa-espresso intersecting bar & ring (replacing stark cold black)
    ctx.fillStyle = '#4e372a';
    ctx.translate(290, 170);
    ctx.rotate(-0.42);
    ctx.fillRect(-160, -18, 320, 36);
    ctx.restore();

    ctx.strokeStyle = '#523b2d';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(356, 134, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e0a53a';
    ctx.beginPath();
    ctx.arc(356, 134, 24, 0, Math.PI * 2);
    ctx.fill();

    // Warm sepia-umber typography banner
    ctx.save();
    ctx.translate(256, 332);
    ctx.rotate(-0.05);
    ctx.fillStyle = '#523a2d';
    ctx.fillRect(-190, -20, 380, 38);
    ctx.fillStyle = '#f8efe0';
    ctx.font = 'bold 21px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('КОНСТРУКЦИЯ // PRESS № 09', 0, 6);
    ctx.restore();

    // Cozy warm golden-parchment sunlit gallery wash (removes cold stark B&W contrast!)
    ctx.fillStyle = 'rgba(248, 224, 194, 0.28)';
    ctx.fillRect(0, 0, 512, 384);

    sofaArtworks.push(track(finalizeTexture(c, maxAniso)));
  }

  // Helper: Loads an image onto a matte wall-harmonized archival print CanvasTexture
  // so paintings integrate smoothly into the room's twilight/daylight/midnight wall palette.
  const createHarmonizedGalleryPrint = (
    url: string,
    width: number,
    height: number,
    opts: {
      baseHex: string;
      filter: string;
      multiplyGlaze: string;
      warmWash: string;
      vignetteAlpha: number;
      fitMode: 'cover' | 'contain';
      pixelArt?: boolean;
    }
  ): THREE.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;

    // Immediate muted matte parchment placeholder before image decode finishes
    ctx.fillStyle = opts.baseHex;
    ctx.fillRect(0, 0, width, height);

    const tex = track(finalizeTexture(c, maxAniso));
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      ctx.fillStyle = opts.baseHex;
      ctx.fillRect(0, 0, width, height);

      // Compute clean aspect-preserving cover or contain rectangle
      const scale =
        opts.fitMode === 'cover'
          ? Math.max(width / img.naturalWidth, height / img.naturalHeight)
          : Math.min(width / img.naturalWidth, height / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const dx = (width - dw) * 0.5;
      const dy = (height - dh) * 0.5;

      // Subtle smoothing for pixel art keeps crispness without harsh digital aliasing
      ctx.imageSmoothingEnabled = !opts.pixelArt;
      ctx.imageSmoothingQuality = 'high';
      ctx.filter = opts.filter;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.filter = 'none';
      ctx.restore();

      // 1. Warm wall-harmonizing multiply glaze to knock down bright pure-white highlights
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = opts.multiplyGlaze;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // 2. Soft low-opacity warm dusty matte wash so deep blacks lift gently to match room shadows
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = opts.warmWash;
      ctx.fillRect(0, 0, width, height);

      // 3. Subtle archival matte paper grain (deterministic lightweight pass)
      let seed = width * 31 + height * 17;
      const nextRand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      for (let i = 0; i < 4200; i++) {
        const gx = nextRand() * width;
        const gy = nextRand() * height;
        const bright = nextRand() > 0.5;
        ctx.fillStyle = bright
          ? 'rgba(242, 232, 222, 0.032)'
          : 'rgba(68, 56, 52, 0.030)';
        ctx.fillRect(gx, gy, 2.2, 2.2);
      }

      // 4. Soft inner frame mat shadow vignette so artwork settles behind the frame bevel
      const vig = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.34,
        width * 0.5,
        height * 0.5,
        Math.hypot(width, height) * 0.56
      );
      vig.addColorStop(0, 'rgba(42, 34, 32, 0)');
      vig.addColorStop(1, `rgba(42, 34, 32, ${opts.vignetteAlpha.toFixed(3)})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      tex.needsUpdate = true;
    };
    img.src = url;
    return tex;
  };

  // Artwork 1: Constructivist Geometric Paper-Cut Collage (构成主义拼贴画 — 明暗柔和适配浅暖墙面)
  sofaArtworks.push(
    createHarmonizedGalleryPrint(
      '/assets/aistudio/IMG_20261121_192018_ec76c714.png',
      768,
      1024,
      {
        baseHex: '#ede6e0',
        filter: 'saturate(0.76) brightness(0.98) contrast(0.86)',
        multiplyGlaze: 'rgba(240, 232, 224, 0.18)',
        warmWash: 'rgba(248, 241, 236, 0.16)',
        vignetteAlpha: 0.06,
        fitMode: 'cover',
        pixelArt: false,
      }
    )
  );

  // Artwork 2: Blue-Haired Pixel Anime Girl Print (蓝头发少女画作 — 明暗柔和适配浅暖墙面)
  sofaArtworks.push(
    createHarmonizedGalleryPrint(
      '/assets/aistudio/IMG_20261121_192001_c418c726.jpg',
      768,
      1024,
      {
        baseHex: '#ebe4e0',
        filter: 'saturate(0.74) brightness(0.97) contrast(0.85)',
        multiplyGlaze: 'rgba(238, 230, 226, 0.16)',
        warmWash: 'rgba(248, 242, 238, 0.16)',
        vignetteAlpha: 0.07,
        fitMode: 'cover',
        pixelArt: true,
      }
    )
  );

  // Artwork 3: Mid-Century Surreal Bauhaus Geometric Eye & Arch Print
  {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 288;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f2e8d9';
    ctx.fillRect(0, 0, 384, 288);

    // Terracotta arch & slate-blue crescent
    ctx.fillStyle = '#cf6a53';
    ctx.beginPath();
    ctx.arc(140, 160, 74, Math.PI, 0);
    ctx.lineTo(214, 260);
    ctx.lineTo(66, 260);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5c7e74';
    ctx.beginPath();
    ctx.arc(265, 135, 68, 0, Math.PI * 2);
    ctx.fill();

    // Warm sepia-lined Watching Eye overlapping warm terracotta & sage forms
    ctx.fillStyle = '#faf3e6';
    ctx.strokeStyle = '#543c2e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(210, 145, 72, 38, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0a542';
    ctx.beginPath();
    ctx.arc(210, 145, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#543c2e';
    ctx.beginPath();
    ctx.arc(210, 145, 10, 0, Math.PI * 2);
    ctx.fill();

    // Cozy warm sunlit apricot gallery glaze
    ctx.fillStyle = 'rgba(248, 224, 194, 0.28)';
    ctx.fillRect(0, 0, 384, 288);

    sofaArtworks.push(track(finalizeTexture(c, maxAniso)));
  }

  // 14. Seamless Warm Honey-Oak Wooden Door Texture (balanced continuous vertical grain, zero dark seam bands!)
  const doorCanvas = document.createElement('canvas');
  doorCanvas.width = 512;
  doorCanvas.height = 1024;
  const doorCtx = doorCanvas.getContext('2d')!;
  const doorBumpCanvas = document.createElement('canvas');
  doorBumpCanvas.width = 512;
  doorBumpCanvas.height = 1024;
  const doorBumpCtx = doorBumpCanvas.getContext('2d')!;

  // Smooth warm honey-apricot-oak door base matching the TV stand palette
  const doorBaseGrad = doorCtx.createLinearGradient(0, 0, 0, 1024);
  doorBaseGrad.addColorStop(0.0, '#f3bb8c');
  doorBaseGrad.addColorStop(0.5, '#e5a16e');
  doorBaseGrad.addColorStop(1.0, '#d08656');
  doorCtx.fillStyle = doorBaseGrad;
  doorCtx.fillRect(0, 0, 512, 1024);
  doorBumpCtx.fillStyle = '#848484';
  doorBumpCtx.fillRect(0, 0, 512, 1024);

  // Ultra-soft wide continuous oak satin bands running unbroken from top to bottom
  for (let w = 0; w < 14; w++) {
    const cx = 36 + w * 34;
    const bandGrad = doorCtx.createLinearGradient(cx - 26, 0, cx + 26, 0);
    const warmShift = w % 2 === 0;
    bandGrad.addColorStop(0, 'rgba(255, 240, 214, 0)');
    bandGrad.addColorStop(
      0.5,
      warmShift ? 'rgba(255, 244, 224, 0.050)' : 'rgba(176, 122, 74, 0.036)'
    );
    bandGrad.addColorStop(1, 'rgba(255, 240, 214, 0)');
    doorCtx.fillStyle = bandGrad;
    doorCtx.fillRect(cx - 26, 0, 52, 1024);

    const bGrad = doorBumpCtx.createLinearGradient(cx - 22, 0, cx + 22, 0);
    bGrad.addColorStop(0, 'rgba(132, 132, 132, 0)');
    bGrad.addColorStop(0.5, warmShift ? 'rgba(150, 150, 150, 0.16)' : 'rgba(114, 114, 114, 0.16)');
    bGrad.addColorStop(1, 'rgba(132, 132, 132, 0)');
    doorBumpCtx.fillStyle = bGrad;
    doorBumpCtx.fillRect(cx - 22, 0, 44, 1024);
  }

  // Delicate elongated vertical oak cathedral grain flowing naturally across the full door height
  for (let a = 0; a < 8; a++) {
    const gx = 68 + ((a * 119) % 376);
    const gy = 180 + ((a * 211) % 660);
    const grx = 32 + (a % 3) * 16;
    const gry = 190 + (a % 3) * 70;
    doorCtx.strokeStyle = a % 2 === 0 ? 'rgba(164, 112, 68, 0.040)' : 'rgba(255, 244, 224, 0.052)';
    doorCtx.lineWidth = 3.0;
    doorCtx.beginPath();
    doorCtx.ellipse(gx, gy, grx, gry, 0, 0, Math.PI * 2);
    doorCtx.stroke();

    doorBumpCtx.strokeStyle = 'rgba(118, 118, 118, 0.12)';
    doorBumpCtx.lineWidth = 2.4;
    doorBumpCtx.beginPath();
    doorBumpCtx.ellipse(gx, gy, grx, gry, 0, 0, Math.PI * 2);
    doorBumpCtx.stroke();
  }

  const woodDoor = track(finalizeTexture(doorCanvas, maxAniso, 1, 1));
  woodDoor.wrapS = THREE.ClampToEdgeWrapping;
  woodDoor.wrapT = THREE.ClampToEdgeWrapping;
  const woodDoorBump = track(finalizeTexture(doorBumpCanvas, maxAniso, 1, 1, true));
  woodDoorBump.wrapS = THREE.ClampToEdgeWrapping;
  woodDoorBump.wrapT = THREE.ClampToEdgeWrapping;

  // 16. Retro Arcade Top Marquee ("IRON TREADS // 铁甲战线 1986")
  const marqCanvas = document.createElement('canvas');
  marqCanvas.width = 512;
  marqCanvas.height = 160;
  const mq = marqCanvas.getContext('2d')!;
  const mqBg = mq.createLinearGradient(0, 0, 512, 160);
  mqBg.addColorStop(0, '#1e0b2e');
  mqBg.addColorStop(0.5, '#59163c');
  mqBg.addColorStop(1, '#1b1138');
  mq.fillStyle = mqBg;
  mq.fillRect(0, 0, 512, 160);

  // Retro diagonal speed stripes
  mq.fillStyle = 'rgba(255, 164, 72, 0.22)';
  for (let i = -4; i < 12; i++) {
    mq.beginPath();
    mq.moveTo(i * 58, 160);
    mq.lineTo(i * 58 + 26, 160);
    mq.lineTo(i * 58 + 94, 0);
    mq.lineTo(i * 58 + 68, 0);
    mq.closePath();
    mq.fill();
  }
  mq.strokeStyle = '#ff9d47';
  mq.lineWidth = 6;
  mq.strokeRect(8, 8, 496, 144);
  mq.strokeStyle = '#ffd584';
  mq.lineWidth = 2;
  mq.strokeRect(15, 15, 482, 130);

  // Mini pixel tank badge on left & right of marquee
  const drawMiniTankBadge = (bx: number, by: number, tint: string) => {
    mq.fillStyle = tint;
    mq.fillRect(bx - 16, by - 6, 32, 18);
    mq.fillStyle = '#241432';
    mq.fillRect(bx - 12, by - 4, 24, 14);
    mq.fillStyle = tint;
    mq.fillRect(bx - 14, by - 8, 7, 22);
    mq.fillRect(bx + 7, by - 8, 7, 22);
    mq.fillRect(bx - 3, by - 18, 6, 16);
  };
  drawMiniTankBadge(54, 80, '#ffb454');
  drawMiniTankBadge(458, 80, '#5ef2d6');

  mq.textAlign = 'center';
  mq.fillStyle = '#2d0b24';
  mq.font = 'bold 40px "Plus Jakarta Sans", sans-serif';
  mq.fillText('IRON TREADS', 258, 74);
  const titleGrad = mq.createLinearGradient(0, 36, 0, 82);
  titleGrad.addColorStop(0, '#fff2b2');
  titleGrad.addColorStop(0.55, '#ff9e4a');
  titleGrad.addColorStop(1, '#ff476f');
  mq.fillStyle = titleGrad;
  mq.fillText('IRON TREADS', 256, 71);

  mq.fillStyle = '#ffe5ba';
  mq.font = 'bold 20px "Noto Sans SC", monospace';
  mq.fillText('铁 甲 战 线  //  1986 ARCADE', 256, 114);
  mq.fillStyle = '#7bf5dc';
  mq.font = '13px monospace';
  mq.fillText('INSERT 100¥ COIN · 1P / 2P TACTICAL TANK SHOOTER', 256, 138);
  const arcadeMarquee = track(finalizeTexture(marqCanvas, maxAniso, 1, 1));

  // 17. Retro Arcade Attract-Mode 4:3 CRT Screen Preview
  const arcCanvas = document.createElement('canvas');
  arcCanvas.width = 480;
  arcCanvas.height = 360;
  const ac = arcCanvas.getContext('2d')!;
  ac.fillStyle = '#070a10';
  ac.fillRect(0, 0, 480, 360);
  // Subtle tactical radar grid
  ac.strokeStyle = 'rgba(54, 148, 116, 0.16)';
  ac.lineWidth = 1;
  for (let gx = 0; gx <= 480; gx += 30) {
    ac.beginPath();
    ac.moveTo(gx, 0);
    ac.lineTo(gx, 360);
    ac.stroke();
  }
  for (let gy = 0; gy <= 360; gy += 30) {
    ac.beginPath();
    ac.moveTo(0, gy);
    ac.lineTo(480, gy);
    ac.stroke();
  }
  // Brick barrier blocks
  ac.fillStyle = '#b94e32';
  for (const [bx, by] of [
    [90, 90],
    [120, 90],
    [330, 90],
    [360, 90],
    [210, 270],
    [240, 270],
  ]) {
    ac.fillRect(bx + 2, by + 2, 26, 26);
    ac.fillStyle = '#df6f4a';
    ac.fillRect(bx + 3, by + 3, 11, 10);
    ac.fillRect(bx + 16, by + 15, 11, 10);
    ac.fillStyle = '#b94e32';
  }
  // Player tank & enemy silhouette
  ac.fillStyle = '#f2b84b';
  ac.fillRect(226, 224, 28, 28);
  ac.fillStyle = '#ffd97d';
  ac.fillRect(237, 208, 6, 18);
  ac.fillStyle = '#e04f68';
  ac.fillRect(226, 62, 28, 28);
  ac.fillStyle = '#ff7b91';
  ac.fillRect(237, 84, 6, 18);
  // Attract overlay banner
  ac.fillStyle = 'rgba(10, 12, 20, 0.78)';
  ac.fillRect(58, 124, 364, 102);
  ac.strokeStyle = '#ff9e4a';
  ac.lineWidth = 2;
  ac.strokeRect(58, 124, 364, 102);
  ac.textAlign = 'center';
  ac.fillStyle = '#ffbc5e';
  ac.font = 'bold 28px monospace';
  ac.fillText('IRON TREADS', 240, 162);
  ac.fillStyle = '#7bf5dc';
  ac.font = 'bold 16px "Noto Sans SC", monospace';
  ac.fillText('铁甲战线 · INSERT COIN [按 F 投币]', 240, 192);
  ac.fillStyle = '#d4d8e8';
  ac.font = '12px monospace';
  ac.fillText('CREDIT 01   HI-SCORE 024800', 240, 214);
  ac.fillStyle = 'rgba(0, 0, 0, 0.28)';
  for (let sy = 0; sy < 360; sy += 3) {
    ac.fillRect(0, sy, 480, 1);
  }
  const arcadeScreen = track(finalizeTexture(arcCanvas, maxAniso, 1, 1));

  // 18. Arcade Cabinet Side-Art Graphic (retro geometric chevron & tank emblem)
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 256;
  sideCanvas.height = 512;
  const sc = sideCanvas.getContext('2d')!;
  sc.fillStyle = '#1e1633';
  sc.fillRect(0, 0, 256, 512);
  // Twin diagonal retro stripes
  sc.fillStyle = '#d9485f';
  sc.beginPath();
  sc.moveTo(0, 320);
  sc.lineTo(256, 175);
  sc.lineTo(256, 220);
  sc.lineTo(0, 365);
  sc.closePath();
  sc.fill();
  sc.fillStyle = '#f29f46';
  sc.beginPath();
  sc.moveTo(0, 372);
  sc.lineTo(256, 227);
  sc.lineTo(256, 256);
  sc.lineTo(0, 401);
  sc.closePath();
  sc.fill();
  sc.fillStyle = '#4ad2b8';
  sc.beginPath();
  sc.moveTo(0, 408);
  sc.lineTo(256, 263);
  sc.lineTo(256, 280);
  sc.lineTo(0, 425);
  sc.closePath();
  sc.fill();
  // Emblem badge
  sc.strokeStyle = 'rgba(255, 214, 148, 0.72)';
  sc.lineWidth = 4;
  sc.beginPath();
  sc.arc(128, 146, 56, 0, Math.PI * 2);
  sc.stroke();
  sc.fillStyle = '#ffbd59';
  sc.fillRect(102, 134, 52, 34);
  sc.fillRect(123, 108, 10, 32);
  sc.fillStyle = '#f4d9ba';
  sc.textAlign = 'center';
  sc.font = 'bold 18px monospace';
  sc.fillText('UNIT-86', 128, 466);
  const arcadeSideArt = track(finalizeTexture(sideCanvas, maxAniso, 1, 1));

  // 19. Soft Chenille / Fleece Plush Fabric Albedo + Tactile Micro-Tuft Bump Map (Bed Quilt & Pillows)
  const plushSize = 512;
  const plushCanvas = document.createElement('canvas');
  plushCanvas.width = plushSize;
  plushCanvas.height = plushSize;
  const plushCtx = plushCanvas.getContext('2d')!;
  const plushBumpCanvas = document.createElement('canvas');
  plushBumpCanvas.width = plushSize;
  plushBumpCanvas.height = plushSize;
  const pbc = plushBumpCanvas.getContext('2d')!;

  // Base creamy-ivory weave albedo (#fbf6f0) & mid-height bump base so white sofa looks creamy white instead of lavender!
  plushCtx.fillStyle = '#fbf6f0';
  plushCtx.fillRect(0, 0, plushSize, plushSize);
  pbc.fillStyle = '#808080';
  pbc.fillRect(0, 0, plushSize, plushSize);

  // Fine tactile woven linen / cotton-chenille cross-weave threads for cozy sofa upholstery
  for (let y = 0; y < plushSize; y += 4) {
    const evenRow = (y / 4) % 2 === 0;
    plushCtx.fillStyle = evenRow ? 'rgba(255,253,250,0.09)' : 'rgba(196,174,162,0.085)';
    plushCtx.fillRect(0, y, plushSize, 2);
    pbc.fillStyle = evenRow ? 'rgba(226,226,226,0.16)' : 'rgba(44,44,44,0.15)';
    pbc.fillRect(0, y, plushSize, 2);
  }
  for (let x = 0; x < plushSize; x += 4) {
    const evenCol = (x / 4) % 2 === 0;
    plushCtx.fillStyle = evenCol ? 'rgba(255,250,248,0.07)' : 'rgba(188,166,158,0.075)';
    plushCtx.fillRect(x, 0, 2, plushSize);
    pbc.fillStyle = evenCol ? 'rgba(218,218,218,0.14)' : 'rgba(54,54,54,0.13)';
    pbc.fillRect(x, 0, 2, plushSize);
  }
  // Subtle slubbed linen warp-weft intersections
  for (let y = 0; y < plushSize; y += 8) {
    for (let x = (y % 16 === 0 ? 0 : 4); x < plushSize; x += 8) {
      plushCtx.fillStyle = 'rgba(255,252,248,0.08)';
      plushCtx.fillRect(x, y, 3, 2);
      pbc.fillStyle = 'rgba(232,232,232,0.18)';
      pbc.fillRect(x, y, 3, 2);
    }
  }

  // Soft quilted diamond/box dimples for puffed blanket loft
  for (let gy = 64; gy < plushSize; gy += 128) {
    for (let gx = 64; gx < plushSize; gx += 128) {
      const grad = pbc.createRadialGradient(gx, gy, 4, gx, gy, 62);
      grad.addColorStop(0, 'rgba(228,228,228,0.34)');
      grad.addColorStop(0.75, 'rgba(165,165,165,0.14)');
      grad.addColorStop(1, 'rgba(85,85,85,0.22)');
      pbc.fillStyle = grad;
      pbc.beginPath();
      pbc.arc(gx, gy, 62, 0, Math.PI * 2);
      pbc.fill();

      const aGrad = plushCtx.createRadialGradient(gx, gy, 4, gx, gy, 62);
      aGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
      aGrad.addColorStop(1, 'rgba(195,162,184,0.07)');
      plushCtx.fillStyle = aGrad;
      plushCtx.beginPath();
      plushCtx.arc(gx, gy, 62, 0, Math.PI * 2);
      plushCtx.fill();
    }
  }

  // Deterministic seeded fuzzy micro-fibers & plush nap tufts (seamless tile wrapping)
  let pSeed = 9137;
  const pRand = () => {
    pSeed = (pSeed * 1664525 + 1013904223) >>> 0;
    return pSeed / 4294967296;
  };
  for (let i = 0; i < 4800; i++) {
    const fx = pRand() * plushSize;
    const fy = pRand() * plushSize;
    const ang = pRand() * Math.PI * 2;
    const len = 3 + pRand() * 6.5;
    const r = 1.1 + pRand() * 1.4;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;
    const bright = pRand() > 0.44;

    plushCtx.strokeStyle = bright ? 'rgba(255,255,255,0.24)' : 'rgba(176,142,164,0.18)';
    plushCtx.lineWidth = r;
    plushCtx.lineCap = 'round';
    for (const ox of [-plushSize, 0, plushSize]) {
      if (fx + ox < -12 || fx + ox > plushSize + 12) continue;
      for (const oy of [-plushSize, 0, plushSize]) {
        if (fy + oy < -12 || fy + oy > plushSize + 12) continue;
        plushCtx.beginPath();
        plushCtx.moveTo(fx + ox, fy + oy);
        plushCtx.lineTo(fx + ox + dx, fy + oy + dy);
        plushCtx.stroke();
      }
    }

    pbc.strokeStyle = bright ? 'rgba(245,245,245,0.34)' : 'rgba(42,42,42,0.28)';
    pbc.lineWidth = r * 1.15;
    pbc.lineCap = 'round';
    for (const ox of [-plushSize, 0, plushSize]) {
      if (fx + ox < -12 || fx + ox > plushSize + 12) continue;
      for (const oy of [-plushSize, 0, plushSize]) {
        if (fy + oy < -12 || fy + oy > plushSize + 12) continue;
        pbc.beginPath();
        pbc.moveTo(fx + ox, fy + oy);
        pbc.lineTo(fx + ox + dx, fy + oy + dy);
        pbc.stroke();
      }
    }
  }

  const plushFabric = track(finalizeTexture(plushCanvas, maxAniso, 3, 3));
  const plushBump = new THREE.CanvasTexture(plushBumpCanvas);
  plushBump.colorSpace = THREE.NoColorSpace;
  plushBump.anisotropy = maxAniso;
  plushBump.wrapS = THREE.RepeatWrapping;
  plushBump.wrapT = THREE.RepeatWrapping;
  plushBump.repeat.set(3, 3);
  plushBump.needsUpdate = true;
  track(plushBump);

  // 20. Woven Jacquard Drapery Curtain Fabric + Deep UV Pleat Fold AO & Micro-Linen Bump
  const curCanvas = document.createElement('canvas');
  curCanvas.width = 512;
  curCanvas.height = 512;
  const curCtx = curCanvas.getContext('2d')!;
  const curBumpCanvas = document.createElement('canvas');
  curBumpCanvas.width = 512;
  curBumpCanvas.height = 512;
  const cbctx = curBumpCanvas.getContext('2d')!;

  curCtx.fillStyle = '#f3eff7';
  curCtx.fillRect(0, 0, 512, 512);
  cbctx.fillStyle = '#808080';
  cbctx.fillRect(0, 0, 512, 512);

  // Baked UV vertical tubular pleat fold AO & ridge highlights (5.5 pleats across width matching createDrapedCurtainGeometry)
  const pleatCount = 5.5;
  for (let x = 0; x < 512; x++) {
    const u = x / 512;
    const phase = u * Math.PI * 2 * pleatCount;
    const wave = Math.sin(phase);
    const pinch = Math.cos(phase * 2.0);
    // Deep valley shadow where wave < 0, soft sunlit ridge where wave > 0
    const foldShade = 0.5 + 0.38 * wave + 0.12 * pinch;
    if (foldShade < 0.5) {
      const shadowAlpha = (0.5 - foldShade) * 0.52;
      curCtx.fillStyle = `rgba(88, 72, 114, ${shadowAlpha.toFixed(3)})`;
    } else {
      const hiAlpha = (foldShade - 0.5) * 0.36;
      curCtx.fillStyle = `rgba(255, 252, 246, ${hiAlpha.toFixed(3)})`;
    }
    curCtx.fillRect(x, 0, 1, 512);

    const bumpVal = Math.round(128 + wave * 68 + pinch * 22);
    cbctx.fillStyle = `rgb(${bumpVal}, ${bumpVal}, ${bumpVal})`;
    cbctx.fillRect(x, 0, 1, 512);
  }

  // Waist tie-back radial gather creases around v = 0.635 (y = 325 in canvas coordinates)
  const tieGrad = curCtx.createLinearGradient(0, 260, 0, 390);
  tieGrad.addColorStop(0.0, 'rgba(94, 78, 122, 0.0)');
  tieGrad.addColorStop(0.5, 'rgba(94, 78, 122, 0.16)');
  tieGrad.addColorStop(1.0, 'rgba(94, 78, 122, 0.0)');
  curCtx.fillStyle = tieGrad;
  curCtx.fillRect(0, 260, 512, 130);

  // Fine woven linen cross-hatch threads
  for (let y = 0; y < 512; y += 4) {
    curCtx.fillStyle = y % 8 === 0 ? 'rgba(255, 252, 255, 0.12)' : 'rgba(136, 120, 158, 0.08)';
    curCtx.fillRect(0, y, 512, 2);
    cbctx.fillStyle = y % 8 === 0 ? 'rgba(215, 215, 215, 0.18)' : 'rgba(48, 48, 48, 0.16)';
    cbctx.fillRect(0, y, 512, 2);
  }

  // Tailored double-folded stitched bottom hem (折叠缝合折边, aligns with CURTAIN_HEM_V = 0.038)
  const hemTopY = Math.round(512 * (1 - 0.038)); // y = 493
  // Double-layer folded fabric subtle depth tint
  curCtx.fillStyle = 'rgba(116, 104, 134, 0.14)';
  curCtx.fillRect(0, hemTopY, 512, 512 - hemTopY);
  // Crisp crease shadow along the top fold tuck
  const hemShadow = curCtx.createLinearGradient(0, hemTopY - 4, 0, hemTopY + 5);
  hemShadow.addColorStop(0.0, 'rgba(72, 60, 92, 0.0)');
  hemShadow.addColorStop(0.45, 'rgba(72, 60, 92, 0.34)');
  hemShadow.addColorStop(0.75, 'rgba(255, 252, 246, 0.28)');
  hemShadow.addColorStop(1.0, 'rgba(255, 252, 246, 0.0)');
  curCtx.fillStyle = hemShadow;
  curCtx.fillRect(0, hemTopY - 4, 512, 9);
  // Fine dashed running-stitch thread line (缝合针脚走线)
  curCtx.save();
  curCtx.strokeStyle = 'rgba(92, 80, 112, 0.42)';
  curCtx.lineWidth = 1.4;
  curCtx.setLineDash([5, 4]);
  curCtx.beginPath();
  curCtx.moveTo(0, hemTopY + 3.5);
  curCtx.lineTo(512, hemTopY + 3.5);
  curCtx.stroke();
  curCtx.strokeStyle = 'rgba(255, 252, 246, 0.68)';
  curCtx.lineWidth = 1.1;
  curCtx.beginPath();
  curCtx.moveTo(0, hemTopY + 2.3);
  curCtx.lineTo(512, hemTopY + 2.3);
  curCtx.stroke();
  curCtx.restore();
  // Soft highlight along the rounded bottom folded edge
  curCtx.fillStyle = 'rgba(255, 252, 248, 0.34)';
  curCtx.fillRect(0, 509, 512, 3);

  // Matching bump relief for the folded hem ridge & indented stitch seam (shared by ALL curtains!)
  cbctx.fillStyle = 'rgba(42, 42, 42, 0.65)';
  cbctx.fillRect(0, hemTopY - 1, 512, 3);
  cbctx.fillStyle = 'rgba(222, 222, 222, 0.48)';
  cbctx.fillRect(0, hemTopY + 2, 512, 512 - hemTopY - 4);
  cbctx.save();
  cbctx.strokeStyle = 'rgba(248, 248, 248, 0.72)';
  cbctx.lineWidth = 1.4;
  cbctx.setLineDash([5, 4]);
  cbctx.beginPath();
  cbctx.moveTo(0, hemTopY + 3.5);
  cbctx.lineTo(512, hemTopY + 3.5);
  cbctx.stroke();
  cbctx.restore();
  cbctx.fillStyle = 'rgba(72, 72, 72, 0.45)';
  cbctx.fillRect(0, 510, 512, 2);

  const curtainFabric = track(finalizeTexture(curCanvas, maxAniso, 1, 1));
  const curtainBump = track(finalizeTexture(curBumpCanvas, maxAniso, 1, 1, true));

  // 20a. Light Green Ditsy Floral Curtain Fabric (浅绿色碎花窗帘) with Baked 5.5-Pleat Fold Shading
  const flSize = 1024;
  const flCanvas = document.createElement('canvas');
  flCanvas.width = flSize;
  flCanvas.height = flSize;
  const flCtx = flCanvas.getContext('2d')!;

  // Soft pastel sage-mint cotton base
  const flBaseGrad = flCtx.createLinearGradient(0, 0, 0, flSize);
  flBaseGrad.addColorStop(0.0, '#d5f2d8');
  flBaseGrad.addColorStop(0.55, '#c9ebd0');
  flBaseGrad.addColorStop(1.0, '#bfe5c6');
  flCtx.fillStyle = flBaseGrad;
  flCtx.fillRect(0, 0, flSize, flSize);

  // Subtle woven cotton-linen cross-hatch texture
  for (let i = 0; i < flSize; i += 4) {
    flCtx.fillStyle = i % 8 === 0 ? 'rgba(255, 255, 248, 0.16)' : 'rgba(124, 174, 134, 0.08)';
    flCtx.fillRect(0, i, flSize, 1.5);
    flCtx.fillStyle = i % 8 === 0 ? 'rgba(255, 255, 248, 0.10)' : 'rgba(124, 174, 134, 0.06)';
    flCtx.fillRect(i, 0, 1.5, flSize);
  }

  // Helper to paint a single dainty 5-petal blossom + sage leaf sprig
  const drawDitsyFlower = (
    cx: number,
    cy: number,
    scale: number,
    rot: number,
    variant: number
  ) => {
    flCtx.save();
    flCtx.translate(cx, cy);
    flCtx.rotate(rot);
    flCtx.scale(scale, scale);

    // Delicate trailing stem & 2-3 tiny sage-green leaves
    flCtx.strokeStyle = 'rgba(104, 156, 114, 0.78)';
    flCtx.lineWidth = 1.8;
    flCtx.lineCap = 'round';
    flCtx.beginPath();
    flCtx.moveTo(0, 2);
    flCtx.quadraticCurveTo(4, 14, -2, 24);
    flCtx.stroke();

    const drawLeaf = (lx: number, ly: number, lRot: number, lScale: number) => {
      flCtx.save();
      flCtx.translate(lx, ly);
      flCtx.rotate(lRot);
      flCtx.scale(lScale, lScale);
      flCtx.fillStyle = variant === 2 ? '#7cb888' : '#8ac394';
      flCtx.beginPath();
      flCtx.ellipse(0, 0, 7.2, 3.2, 0, 0, Math.PI * 2);
      flCtx.fill();
      flCtx.strokeStyle = 'rgba(84, 134, 94, 0.55)';
      flCtx.lineWidth = 0.8;
      flCtx.beginPath();
      flCtx.moveTo(-5.5, 0);
      flCtx.lineTo(5.5, 0);
      flCtx.stroke();
      flCtx.restore();
    };

    drawLeaf(-8, 8, -0.55, 1.0);
    drawLeaf(8, 12, 0.48, 0.92);
    if (variant === 0) {
      drawLeaf(9, -7, -0.45, 0.76);
    }

    // Petals: creamy-white daisies, soft blush-pink buds, or buttercream florets
    const petalCount = variant === 1 ? 4 : 5;
    const petalFill =
      variant === 0 ? '#fffdf6' : variant === 1 ? '#fde3e8' : '#fff8e2';
    const petalStroke =
      variant === 0
        ? 'rgba(182, 210, 184, 0.55)'
        : variant === 1
          ? 'rgba(226, 164, 178, 0.45)'
          : 'rgba(218, 198, 142, 0.45)';

    for (let p = 0; p < petalCount; p++) {
      const a = (p / petalCount) * Math.PI * 2;
      flCtx.save();
      flCtx.rotate(a);
      flCtx.fillStyle = petalFill;
      flCtx.strokeStyle = petalStroke;
      flCtx.lineWidth = 0.9;
      flCtx.beginPath();
      flCtx.ellipse(0, -7.2, 4.1, 6.2, 0, 0, Math.PI * 2);
      flCtx.fill();
      flCtx.stroke();
      flCtx.restore();
    }

    // Warm golden-yellow pollen center
    flCtx.fillStyle = variant === 1 ? '#f4c76a' : '#f7d972';
    flCtx.beginPath();
    flCtx.arc(0, 0, 3.3, 0, Math.PI * 2);
    flCtx.fill();
    flCtx.fillStyle = 'rgba(255, 250, 224, 0.85)';
    flCtx.beginPath();
    flCtx.arc(-0.9, -0.9, 1.2, 0, Math.PI * 2);
    flCtx.fill();

    flCtx.restore();
  };

  // Staggered organic ditsy floral repeat pattern covering the curtain panel
  const cols = 12;
  const rows = 14;
  const stepX = flSize / cols;
  const stepY = flSize / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const hash1 = ((idx * 73 + row * 19 + 11) % 100) / 100;
      const hash2 = ((idx * 137 + col * 29 + 7) % 100) / 100;
      const ox = (row % 2 === 1 ? stepX * 0.5 : 0) + (hash1 - 0.5) * stepX * 0.42;
      const oy = (hash2 - 0.5) * stepY * 0.38;
      const fx = (col * stepX + ox + flSize) % flSize;
      const fy = (row * stepY + oy + flSize) % flSize;
      // Leave clean margin on the decorative hem border
      if (fy > 910) continue;

      const fScale = 0.74 + ((idx * 41) % 34) * 0.012;
      const fRot = ((idx * 53) % 628) * 0.01;
      const fVariant = idx % 5 === 0 ? 1 : idx % 7 === 0 ? 2 : 0;

      // Wrap horizontally for seamless continuity
      for (const wx of [fx - flSize, fx, fx + flSize]) {
        if (wx < -36 || wx > flSize + 36) continue;
        drawDitsyFlower(wx, fy, fScale, fRot, fVariant);
      }

      // Tiny companion clover buds & ivory micro-dots between main blossoms
      const bx = (fx + stepX * 0.44) % flSize;
      const by = fy + stepY * 0.36;
      if (by < 906) {
        flCtx.fillStyle = idx % 2 === 0 ? 'rgba(255, 253, 244, 0.88)' : 'rgba(250, 224, 232, 0.82)';
        flCtx.beginPath();
        flCtx.arc(bx, by, 2.8, 0, Math.PI * 2);
        flCtx.fill();
        flCtx.fillStyle = 'rgba(122, 178, 132, 0.72)';
        flCtx.beginPath();
        flCtx.ellipse(bx + 4.5, by + 3.2, 3.6, 1.8, 0.55, 0, Math.PI * 2);
        flCtx.fill();
      }
    }
  }

  // Delicate cream-sage stitched border near bottom hem
  flCtx.fillStyle = 'rgba(134, 184, 142, 0.22)';
  flCtx.fillRect(0, 916, flSize, 62);
  flCtx.strokeStyle = 'rgba(255, 253, 244, 0.78)';
  flCtx.lineWidth = 3.0;
  flCtx.beginPath();
  flCtx.moveTo(0, 920);
  flCtx.lineTo(flSize, 920);
  flCtx.moveTo(0, 974);
  flCtx.lineTo(flSize, 974);
  flCtx.stroke();
  // Small embroidered floral scallop dots along the hem band
  flCtx.fillStyle = 'rgba(255, 252, 242, 0.86)';
  for (let hx = 16; hx < flSize; hx += 32) {
    flCtx.beginPath();
    flCtx.arc(hx, 947, 4.2, 0, Math.PI * 2);
    flCtx.fill();
  }

  // Baked UV vertical tubular pleat fold AO & sunlit ridge highlights (5.5 pleats matching curtain geometry)
  for (let x = 0; x < flSize; x++) {
    const u = x / flSize;
    const phase = u * Math.PI * 2 * pleatCount;
    const wave = Math.sin(phase);
    const pinch = Math.cos(phase * 2.0);
    const foldShade = 0.5 + 0.38 * wave + 0.12 * pinch;
    if (foldShade < 0.5) {
      const shadowAlpha = (0.5 - foldShade) * 0.44;
      flCtx.fillStyle = `rgba(68, 108, 78, ${shadowAlpha.toFixed(3)})`;
    } else {
      const hiAlpha = (foldShade - 0.5) * 0.30;
      flCtx.fillStyle = `rgba(255, 254, 246, ${hiAlpha.toFixed(3)})`;
    }
    flCtx.fillRect(x, 0, 1, flSize);
  }

  // Soft waist tie-back gather crease shadow around v = 0.635 (y = 650)
  const flTieGrad = flCtx.createLinearGradient(0, 520, 0, 780);
  flTieGrad.addColorStop(0.0, 'rgba(72, 114, 82, 0.0)');
  flTieGrad.addColorStop(0.5, 'rgba(72, 114, 82, 0.15)');
  flTieGrad.addColorStop(1.0, 'rgba(72, 114, 82, 0.0)');
  flCtx.fillStyle = flTieGrad;
  flCtx.fillRect(0, 520, flSize, 260);

  const curtainFloralGreen = track(finalizeTexture(flCanvas, maxAniso, 1, 1));

  // 20b. Sculpted 3D Tufted Sofa Cushion Map + Heightfield Bump (Per-Pixel Continuous Airbrushed Folds!)
  //      Produces unmistakable, soft MiSide-style pinched upholstery folds & pillow lobes without stiff drawn lines!
  const stSize = 512;
  const stCanvas = document.createElement('canvas');
  stCanvas.width = stSize;
  stCanvas.height = stSize;
  const stCtx = stCanvas.getContext('2d')!;
  const stbCanvas = document.createElement('canvas');
  stbCanvas.width = stSize;
  stbCanvas.height = stSize;
  const stbCtx = stbCanvas.getContext('2d')!;

  const stImg = stCtx.createImageData(stSize, stSize);
  const stData = stImg.data;
  const stbImg = stbCtx.createImageData(stSize, stSize);
  const stbData = stbImg.data;

  // 8 radiating tension fold directions (4 primary diagonal X-folds + 4 secondary cardinal gather pleats)
  const foldDirs: [number, number, number, number, number][] = [
    // [cosA, sinA, reach, width, strength]
    [Math.SQRT1_2, Math.SQRT1_2, 0.78, 0.088, 1.0],
    [-Math.SQRT1_2, Math.SQRT1_2, 0.78, 0.088, 1.0],
    [-Math.SQRT1_2, -Math.SQRT1_2, 0.78, 0.088, 1.0],
    [Math.SQRT1_2, -Math.SQRT1_2, 0.78, 0.088, 1.0],
    [1.0, 0.0, 0.44, 0.072, 0.58],
    [-1.0, 0.0, 0.44, 0.072, 0.58],
    [0.0, 1.0, 0.44, 0.072, 0.58],
    [0.0, -1.0, 0.44, 0.072, 0.58],
  ];

  for (let py = 0; py < stSize; py++) {
    const ny = (py - 256) / 256;
    for (let px = 0; px < stSize; px++) {
      const nx = (px - 256) / 256;
      const rSq = nx * nx + ny * ny;
      const r = Math.sqrt(rSq);
      const ang = Math.atan2(ny, nx);

      // 1. Soft, natural central button dimple funnel AO + gentle pillow crown
      const dimpleShadow = Math.exp(-rSq / 0.036) * 0.22 + Math.exp(-rSq / 0.11) * 0.09;
      const crownLift = Math.exp(-Math.pow(r - 0.38, 2) / 0.09) * 0.06;

      // 2. Very soft perimeter edge roll-off
      const boxDist = Math.max(Math.abs(nx), Math.abs(ny));
      const edgeRollAo = Math.pow(Math.max(0, (boxDist - 0.74) / 0.26), 2.2) * 0.12;

      // 3. Gentle continuous curved tension fold valleys radiating softly from center button
      let foldShadowSum = 0.0;
      let foldHighlightSum = 0.0;
      let foldBumpSum = 0.0;

      for (let f = 0; f < foldDirs.length; f++) {
        const [ca, sa, reach, w, str] = foldDirs[f];
        const along = nx * ca + ny * sa;
        if (along > 0.01 && along < reach * 1.25) {
          const curveWarp = Math.sin((along / reach) * Math.PI) * (f < 4 ? 0.022 : -0.015);
          const perp = -nx * sa + ny * ca - curveWarp;
          const localWidth = w * (0.55 + 0.90 * (along / reach));
          const pNorm = perp / localWidth;

          const radialEnv =
            (1.0 - Math.exp(-(along * along) / 0.006)) *
            Math.exp(-Math.pow(along / reach, 2.2)) *
            str;

          const valley = Math.exp(-(pNorm * pNorm) * 1.45) * radialEnv;
          const ridge = Math.exp(-Math.pow(pNorm + 0.85, 2) * 1.35) * radialEnv;
          const subPleat = Math.exp(-Math.pow(pNorm - 0.95, 2) * 1.7) * radialEnv * 0.35;

          foldShadowSum += valley * 0.16;
          foldHighlightSum += (ridge * 0.11 + subPleat * 0.05);
          foldBumpSum += (-valley * 0.28 + ridge * 0.18 + subPleat * 0.09);
        }
      }

      // 4. Broad 4-lobe pillow gather swell between the soft creases
      const lobeSwell =
        (0.5 + 0.5 * Math.cos(ang * 4.0)) *
        Math.exp(-Math.pow(r - 0.38, 2) / 0.095) *
        0.045;

      // 5. Fine tactile woven chenille / bouclé yarn micro-texture
      const weave =
        (Math.sin(px * 1.5708) * 0.5 + Math.cos(py * 1.5708) * 0.5) * 0.016 +
        Math.sin((px + py) * 0.7854) * 0.009;

      // Combine into soft, velvety creamy-white fabric without harsh dark pit contrast
      const shade = Math.min(0.32, dimpleShadow * 0.92 + foldShadowSum * 0.90 + edgeRollAo * 0.75);
      const lift = Math.min(0.20, crownLift * 1.1 + foldHighlightSum * 1.0 + lobeSwell * 1.0) + weave;

      const rCol = Math.max(0, Math.min(255, Math.round(255 * (1.0 - shade * 0.14) + lift * 28)));
      const gCol = Math.max(0, Math.min(255, Math.round(252 * (1.0 - shade * 0.20) + lift * 26)));
      const bCol = Math.max(0, Math.min(255, Math.round(246 * (1.0 - shade * 0.22) + lift * 24)));

      const idx = (py * stSize + px) * 4;
      stData[idx] = rCol;
      stData[idx + 1] = gCol;
      stData[idx + 2] = bCol;
      stData[idx + 3] = 255;

      // Smooth shallow 3D heightfield for sofaTuftBump
      const dome = Math.cos(Math.min(1.0, r) * Math.PI * 0.48) * 0.22;
      const hNorm =
        0.54 +
        dome -
        dimpleShadow * 0.42 +
        foldBumpSum * 0.40 +
        lobeSwell * 1.0 -
        edgeRollAo * 0.30 +
        weave * 1.5;
      const hVal = Math.max(0, Math.min(255, Math.round(hNorm * 255)));
      stbData[idx] = hVal;
      stbData[idx + 1] = hVal;
      stbData[idx + 2] = hVal;
      stbData[idx + 3] = 255;
    }
  }
  stCtx.putImageData(stImg, 0, 0);
  stbCtx.putImageData(stbImg, 0, 0);

  const sofaTuftMap = track(finalizeTexture(stCanvas, maxAniso, 1, 1));
  const sofaTuftBump = track(finalizeTexture(stbCanvas, maxAniso, 1, 1, true));

  // 20c. Green & White Gingham Checkered Throw Pillow Texture (matching Screenshot 5's sofa center pillow!)
  const gingCanvas = document.createElement('canvas');
  gingCanvas.width = 512;
  gingCanvas.height = 512;
  const gingCtx = gingCanvas.getContext('2d')!;
  gingCtx.fillStyle = '#f8f6fa';
  gingCtx.fillRect(0, 0, 512, 512);
  const checkStep = 64;
  for (let y = 0; y < 512; y += checkStep) {
    gingCtx.fillStyle = 'rgba(114, 184, 102, 0.48)';
    gingCtx.fillRect(0, y, 512, checkStep / 2);
  }
  for (let x = 0; x < 512; x += checkStep) {
    gingCtx.fillStyle = 'rgba(114, 184, 102, 0.48)';
    gingCtx.fillRect(x, 0, checkStep / 2, 512);
  }
  // Fine diagonal twill weave lines + soft pillow corner seam AO
  const gingGrad = gingCtx.createRadialGradient(256, 256, 80, 256, 256, 260);
  gingGrad.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
  gingGrad.addColorStop(1, 'rgba(86, 114, 96, 0.28)');
  gingCtx.fillStyle = gingGrad;
  gingCtx.fillRect(0, 0, 512, 512);
  const ginghamPillow = track(finalizeTexture(gingCanvas, maxAniso, 1, 1));

  // 20d. Crisp White Linen Dining Tablecloth with Red & Dark-Green Small Floral Vine Pattern
  const tcCanvas = document.createElement('canvas');
  tcCanvas.width = 512;
  tcCanvas.height = 512;
  const tcCtx = tcCanvas.getContext('2d')!;
  tcCtx.fillStyle = '#fcfbf8';
  tcCtx.fillRect(0, 0, 512, 512);
  // Subtle natural woven white cotton linen cross-hatch
  for (let i = 0; i < 512; i += 4) {
    tcCtx.fillStyle = i % 8 === 0 ? 'rgba(255, 255, 255, 0.34)' : 'rgba(222, 218, 210, 0.16)';
    tcCtx.fillRect(0, i, 512, 2);
    tcCtx.fillRect(i, 0, 2, 512);
  }
  // Delicate repeating sinusoidal dark-green floral vines (seamless 512x512 tiling)
  const drawFloralVineCluster = (cx: number, cy: number, flip = 1) => {
    // Trailing dark-green vine stems
    tcCtx.strokeStyle = '#1f5c36';
    tcCtx.lineWidth = 2.0;
    tcCtx.lineCap = 'round';
    tcCtx.beginPath();
    tcCtx.moveTo(cx - 28 * flip, cy + 26);
    tcCtx.bezierCurveTo(cx - 12 * flip, cy + 6, cx + 10 * flip, cy - 8, cx + 28 * flip, cy - 26);
    tcCtx.stroke();

    tcCtx.strokeStyle = '#2d7244';
    tcCtx.lineWidth = 1.4;
    tcCtx.beginPath();
    tcCtx.moveTo(cx - 4 * flip, cy + 2);
    tcCtx.quadraticCurveTo(cx + 14 * flip, cy + 12, cx + 22 * flip, cy + 4);
    tcCtx.moveTo(cx + 4 * flip, cy - 5);
    tcCtx.quadraticCurveTo(cx - 16 * flip, cy - 12, cx - 22 * flip, cy - 4);
    tcCtx.stroke();

    // Small dark-green pointed leaves along the vine
    const leafSpecs: [number, number, number, number][] = [
      [-18 * flip, 16, -0.5 * flip, 7.5],
      [-6 * flip, 9, 0.8 * flip, 6.8],
      [9 * flip, 8, -0.3 * flip, 7.0],
      [18 * flip, -12, 0.6 * flip, 7.2],
      [-14 * flip, -8, -0.8 * flip, 6.5],
      [4 * flip, -16, 0.25 * flip, 6.8],
    ];
    for (const [lx, ly, rot, r] of leafSpecs) {
      tcCtx.save();
      tcCtx.translate(cx + lx, cy + ly);
      tcCtx.rotate(rot);
      tcCtx.fillStyle = '#1b5332';
      tcCtx.beginPath();
      tcCtx.ellipse(0, 0, r, r * 0.44, 0, 0, Math.PI * 2);
      tcCtx.fill();
      tcCtx.fillStyle = '#327c4b';
      tcCtx.beginPath();
      tcCtx.ellipse(-1, -0.6, r * 0.55, r * 0.22, 0, 0, Math.PI * 2);
      tcCtx.fill();
      tcCtx.restore();
    }

    // Small crimson & rose-red five-petal wildflowers & buds
    const drawRedBlossom = (fx: number, fy: number, pr: number, col: string) => {
      tcCtx.fillStyle = col;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        tcCtx.beginPath();
        tcCtx.arc(fx + Math.cos(a) * pr * 0.85, fy + Math.sin(a) * pr * 0.85, pr * 0.62, 0, Math.PI * 2);
        tcCtx.fill();
      }
      tcCtx.fillStyle = '#ffe998';
      tcCtx.beginPath();
      tcCtx.arc(fx, fy, pr * 0.42, 0, Math.PI * 2);
      tcCtx.fill();
    };
    drawRedBlossom(cx + 12 * flip, cy - 11, 5.2, '#cc2f40');
    drawRedBlossom(cx - 11 * flip, cy + 11, 4.4, '#e04858');
    drawRedBlossom(cx + 22 * flip, cy + 5, 3.2, '#b82536');
    // Tiny scattered crimson berries / rosebuds
    for (const [bx, by] of [
      [-21 * flip, -4],
      [25 * flip, -21],
      [-2 * flip, -20],
      [6 * flip, 21],
    ]) {
      tcCtx.fillStyle = '#c82b3b';
      tcCtx.beginPath();
      tcCtx.arc(cx + bx, cy + by, 2.4, 0, Math.PI * 2);
      tcCtx.fill();
    }
  };

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const cx = col * 128 + 64 + (row % 2 === 1 ? 32 : 0);
      const cy = row * 128 + 64;
      const flip = (row + col) % 2 === 0 ? 1 : -1;
      for (const ox of [-512, 0, 512]) {
        if (cx + ox > -48 && cx + ox < 560) {
          drawFloralVineCluster(cx + ox, cy, flip);
        }
      }
    }
  }
  const tableclothPink = track(finalizeTexture(tcCanvas, maxAniso, 2, 2));

  // 20d2. Delicate Scalloped Ivory-White Embroidered Lace Trim (Alpha-Cutout) for Dining Tablecloth Hem
  const laceCanvas = document.createElement('canvas');
  laceCanvas.width = 256;
  laceCanvas.height = 128;
  const lCtx = laceCanvas.getContext('2d')!;
  lCtx.clearRect(0, 0, 256, 128);

  // Top solid embroidered attachment band + delicate scalloped arches along bottom
  lCtx.fillStyle = '#fcf9f2';
  lCtx.fillRect(0, 0, 256, 22);
  // 4 scalloped lace arches across 256px width
  const archCount = 4;
  const archW = 256 / archCount;
  for (let i = 0; i < archCount; i++) {
    const cx = i * archW + archW * 0.5;
    lCtx.fillStyle = '#fbf7ee';
    lCtx.beginPath();
    lCtx.moveTo(i * archW, 20);
    lCtx.lineTo((i + 1) * archW, 20);
    lCtx.lineTo((i + 1) * archW, 66);
    lCtx.arc(cx, 66, archW * 0.5, 0, Math.PI, false);
    lCtx.closePath();
    lCtx.fill();

    // Small picot scalloped beads along the curved lace border
    for (let p = 1; p <= 9; p++) {
      const ang = (p / 10) * Math.PI;
      const px = cx + Math.cos(ang) * (archW * 0.5 + 3);
      const py = 66 + Math.sin(ang) * (archW * 0.5 + 3);
      lCtx.beginPath();
      lCtx.arc(px, py, 3.6, 0, Math.PI * 2);
      lCtx.fill();
    }
  }

  // Punch crisp openwork lace eyelets (using destination-out) for authentic translucent floral lace
  lCtx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < archCount; i++) {
    const cx = i * archW + archW * 0.5;
    // Central flower eyelet cluster
    lCtx.beginPath();
    lCtx.arc(cx, 62, 7.5, 0, Math.PI * 2);
    lCtx.fill();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      lCtx.beginPath();
      lCtx.arc(cx + Math.cos(a) * 15, 62 + Math.sin(a) * 15, 4.2, 0, Math.PI * 2);
      lCtx.fill();
    }
    // Upper row tiny diamond-spaced eyelets
    for (const ex of [-22, -11, 0, 11, 22]) {
      lCtx.beginPath();
      lCtx.arc(cx + ex, 34, 3.3, 0, Math.PI * 2);
      lCtx.fill();
    }
    // Side corner eyelets between arches
    lCtx.beginPath();
    lCtx.arc(i * archW + 5, 52, 3.8, 0, Math.PI * 2);
    lCtx.arc((i + 1) * archW - 5, 52, 3.8, 0, Math.PI * 2);
    lCtx.fill();
  }

  // Add subtle ivory thread-relief stitching around scallops
  lCtx.globalCompositeOperation = 'source-atop';
  lCtx.strokeStyle = 'rgba(210, 200, 184, 0.65)';
  lCtx.lineWidth = 2.0;
  lCtx.beginPath();
  lCtx.moveTo(0, 16);
  lCtx.lineTo(256, 16);
  lCtx.stroke();
  for (let i = 0; i < archCount; i++) {
    const cx = i * archW + archW * 0.5;
    lCtx.beginPath();
    lCtx.arc(cx, 66, archW * 0.5 - 4, 0.12, Math.PI - 0.12);
    lCtx.stroke();
  }
  lCtx.globalCompositeOperation = 'source-over';
  const tableclothLaceTrim = track(finalizeTexture(laceCanvas, maxAniso, 1, 1));
  tableclothLaceTrim.wrapS = THREE.RepeatWrapping;
  tableclothLaceTrim.wrapT = THREE.ClampToEdgeWrapping;

  // 20d3. British Union-Jack ("英式米字格") Red & Green Plush Velvet Medallion Texture for Bar Stools
  const bvCanvas = document.createElement('canvas');
  bvCanvas.width = 512;
  bvCanvas.height = 512;
  const bvCtx = bvCanvas.getContext('2d')!;
  // Rich British racing / holly forest green velvet base
  bvCtx.fillStyle = '#194f35';
  bvCtx.fillRect(0, 0, 512, 512);
  // Subtle tartan/woven velvet micro-plush texture
  for (let i = 0; i < 512; i += 3) {
    bvCtx.fillStyle = i % 6 === 0 ? 'rgba(255, 245, 228, 0.045)' : 'rgba(8, 28, 18, 0.08)';
    bvCtx.fillRect(0, i, 512, 1.5);
    bvCtx.fillRect(i, 0, 1.5, 512);
  }
  // Diagonal St. Andrew / St. Patrick saltire bands (forming the "米" cross!)
  const drawDiagStripe = (color: string, width: number) => {
    bvCtx.strokeStyle = color;
    bvCtx.lineWidth = width;
    bvCtx.beginPath();
    bvCtx.moveTo(-40, -40);
    bvCtx.lineTo(552, 552);
    bvCtx.moveTo(552, -40);
    bvCtx.lineTo(-40, 552);
    bvCtx.stroke();
  };
  drawDiagStripe('#f4ebd4', 58); // Cream-ivory piping fimbriation
  drawDiagStripe('#c89c4c', 44); // Thin antique gold accent border
  drawDiagStripe('#9e202c', 34); // Deep heritage crimson diagonal cross

  // Orthogonal St. George cross (vertical + horizontal bands over diagonals)
  // Cream-ivory outer fimbriation
  bvCtx.fillStyle = '#f4ebd4';
  bvCtx.fillRect(256 - 46, 0, 92, 512);
  bvCtx.fillRect(0, 256 - 46, 512, 92);
  // Subtle gold inner hairline
  bvCtx.fillStyle = '#c89c4c';
  bvCtx.fillRect(256 - 35, 0, 70, 512);
  bvCtx.fillRect(0, 256 - 35, 512, 70);
  // Rich crimson velvet cross center
  bvCtx.fillStyle = '#b12230';
  bvCtx.fillRect(256 - 29, 0, 58, 512);
  bvCtx.fillRect(0, 256 - 29, 512, 58);

  // Subtle heritage green double-line check detail in the 4 quadrants
  bvCtx.strokeStyle = 'rgba(244, 235, 212, 0.22)';
  bvCtx.lineWidth = 2.5;
  for (const offset of [92, 420]) {
    bvCtx.beginPath();
    bvCtx.moveTo(offset, 0);
    bvCtx.lineTo(offset, 512);
    bvCtx.moveTo(0, offset);
    bvCtx.lineTo(512, offset);
    bvCtx.stroke();
  }
  // Plush velvet radial shading & central button-tuft shadow depth
  const velShade = bvCtx.createRadialGradient(256, 256, 10, 256, 256, 260);
  velShade.addColorStop(0.0, 'rgba(30, 8, 12, 0.36)');
  velShade.addColorStop(0.14, 'rgba(255, 240, 224, 0.14)');
  velShade.addColorStop(0.68, 'rgba(255, 248, 240, 0.05)');
  velShade.addColorStop(1.0, 'rgba(10, 20, 16, 0.38)');
  bvCtx.fillStyle = velShade;
  bvCtx.fillRect(0, 0, 512, 512);
  // Subtle velvet nap grain
  for (let n = 0; n < 3200; n++) {
    const nx = ((n * 197) % 512);
    const ny = ((n * 353) % 512);
    bvCtx.fillStyle = n % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
    bvCtx.fillRect(nx, ny, 2, 2);
  }
  const barStoolUnionVelvet = track(finalizeTexture(bvCanvas, maxAniso, 1, 1));
  barStoolUnionVelvet.wrapS = THREE.ClampToEdgeWrapping;
  barStoolUnionVelvet.wrapT = THREE.ClampToEdgeWrapping;

  // 20e. Glossy Pastel Pink-Lavender Square Ceramic Kitchen Backsplash Tile (matching Screenshot 4!)
  const kbCanvas = document.createElement('canvas');
  kbCanvas.width = 512;
  kbCanvas.height = 512;
  const kbCtx = kbCanvas.getContext('2d')!;
  kbCtx.fillStyle = '#c8b2cc';
  kbCtx.fillRect(0, 0, 512, 512);
  const bTileStep = 64;
  for (let ty = 0; ty < 8; ty++) {
    for (let tx = 0; tx < 8; tx++) {
      const px = tx * bTileStep;
      const py = ty * bTileStep;
      const tone = ((tx * 3 + ty * 5) % 4) - 1.5;
      const rT = Math.round(234 + tone * 4);
      const gT = Math.round(212 + tone * 4);
      const bT = Math.round(232 + tone * 4);
      kbCtx.fillStyle = `rgb(${rT}, ${gT}, ${bT})`;
      kbCtx.fillRect(px + 2, py + 2, bTileStep - 4, bTileStep - 4);
      // Glossy diagonal ceramic glaze reflection highlight
      const tGrad = kbCtx.createLinearGradient(px, py, px + bTileStep, py + bTileStep);
      tGrad.addColorStop(0.0, 'rgba(255, 252, 255, 0.36)');
      tGrad.addColorStop(0.45, 'rgba(255, 252, 255, 0.06)');
      tGrad.addColorStop(1.0, 'rgba(168, 140, 178, 0.22)');
      kbCtx.fillStyle = tGrad;
      kbCtx.fillRect(px + 3, py + 3, bTileStep - 6, bTileStep - 6);
    }
  }
  const kitchenBacksplashTile = track(finalizeTexture(kbCanvas, maxAniso, 4, 2));

  // 21. Directional Brushed Stainless-Steel Texture for Kitchen Range Hood & Metallic Appliances
  const steelCanvas = document.createElement('canvas');
  steelCanvas.width = 512;
  steelCanvas.height = 512;
  const sctx = steelCanvas.getContext('2d')!;
  const steelGrad = sctx.createLinearGradient(0, 0, 512, 512);
  steelGrad.addColorStop(0.0, '#c8cdd8');
  steelGrad.addColorStop(0.28, '#eef2fa');
  steelGrad.addColorStop(0.52, '#b8becb');
  steelGrad.addColorStop(0.78, '#e6ebf5');
  steelGrad.addColorStop(1.0, '#c2c7d4');
  sctx.fillStyle = steelGrad;
  sctx.fillRect(0, 0, 512, 512);

  // Fine horizontal anisotropic brushed metal micro-hairlines
  let sSeed = 4099;
  const sRand = () => {
    sSeed = (sSeed * 1664525 + 1013904223) >>> 0;
    return sSeed / 4294967296;
  };
  for (let y = 0; y < 512; y++) {
    const bright = sRand() > 0.48;
    const alpha = 0.04 + sRand() * 0.09;
    sctx.strokeStyle = bright
      ? `rgba(255, 255, 255, ${alpha.toFixed(3)})`
      : `rgba(72, 78, 94, ${alpha.toFixed(3)})`;
    sctx.lineWidth = 1;
    sctx.beginPath();
    sctx.moveTo(0, y + 0.5);
    sctx.lineTo(512, y + 0.5);
    sctx.stroke();
  }
  const brushedSteel = track(finalizeTexture(steelCanvas, maxAniso, 2, 2));

  // 22. Light-Toned Diverse Book, Manga & Retro Game Box Atlas (1024x1024, 4x4 = 16 Distinct Designs)
  //     Row 0 (0-3): Consecutive Manga Volumes (漫画书) — crisp white/cream jackets with pastel accents & bold vol badges
  //     Row 1 (4-7): Literary Fiction (文学书) — airy linen-ivory, powder-blue, blush-sand, warm oat with obi belly bands
  //     Row 2 (8-11): Philosophy & Essays (哲学书) — understated alabaster, pale stone, parchment, misty slate serif editions
  //     Row 3 (12-13): Technical / Design Manuals (专业书) — clean studio-white & pearl-silver Swiss grid / diagram covers
  //     Row 3 (14-15): Retro Game Cases (复古游戏盒) — pearlescent grey & pastel 90s console/handheld game box art
  const bkCanvas = document.createElement('canvas');
  bkCanvas.width = 1024;
  bkCanvas.height = 1024;
  const bk = bkCanvas.getContext('2d')!;
  const bkBumpCanvas = document.createElement('canvas');
  bkBumpCanvas.width = 1024;
  bkBumpCanvas.height = 1024;
  const bkb = bkBumpCanvas.getContext('2d')!;

  bkb.fillStyle = '#828282';
  bkb.fillRect(0, 0, 1024, 1024);

  type BookCategory = 'manga' | 'literature' | 'philosophy' | 'technical' | 'game';
  interface BookAtlasSpec {
    cat: BookCategory;
    bg: string;
    spineBg: string;
    accent1: string;
    accent2: string;
    ink: string;
    title: string;
    spineTitle: string;
    subtitle: string;
    vol: string;
    obiColor?: string;
    motif:
      | 'manga_burst'
      | 'manga_mint'
      | 'manga_peach'
      | 'manga_cat'
      | 'lit_leaf'
      | 'lit_window'
      | 'lit_zoo'
      | 'lit_bird'
      | 'phil_frame'
      | 'phil_rings'
      | 'phil_diamond'
      | 'phil_grid'
      | 'tech_optics'
      | 'tech_wave'
      | 'game_sfc'
      | 'game_handheld';
  }

  const bookSpecs: BookAtlasSpec[] = [
    // Row 0: Japanese Manga Series (0-3) — soft pastel tinted spines with authentic JP lettering
    {
      cat: 'manga',
      bg: '#f7fafd',
      spineBg: '#dfeef9',
      accent1: '#5da6dc',
      accent2: '#ef8677',
      ink: '#2a3748',
      title: '星屑トラム',
      spineTitle: '星屑トラム',
      subtitle: 'STARDUST TRAM · VOL.1',
      vol: '01',
      motif: 'manga_burst',
    },
    {
      cat: 'manga',
      bg: '#f4fbf7',
      spineBg: '#daf1e5',
      accent1: '#59b996',
      accent2: '#f0ac5e',
      ink: '#283b35',
      title: '星屑トラム',
      spineTitle: '星屑トラム',
      subtitle: 'STARDUST TRAM · VOL.2',
      vol: '02',
      motif: 'manga_mint',
    },
    {
      cat: 'manga',
      bg: '#fdf7f0',
      spineBg: '#fae5d2',
      accent1: '#ea9362',
      accent2: '#719ed4',
      ink: '#3a2d27',
      title: '星屑トラム',
      spineTitle: '星屑トラム',
      subtitle: 'STARDUST TRAM · VOL.3',
      vol: '03',
      motif: 'manga_peach',
    },
    {
      cat: 'manga',
      bg: '#fbf3f9',
      spineBg: '#efe0f2',
      accent1: '#be89cc',
      accent2: '#efbc74',
      ink: '#392a40',
      title: '猫と黄昏',
      spineTitle: '猫と黄昏',
      subtitle: 'NEKO TO TASOGARE · 4',
      vol: '04',
      motif: 'manga_cat',
    },

    // Row 1: Literary Fiction — Curated Mix of Japanese & English Titles (4-7)
    {
      cat: 'literature',
      bg: '#f5efe3',
      spineBg: '#ebe2d1',
      accent1: '#86ab8c',
      accent2: '#d99e75',
      ink: '#3b352f',
      title: '海辺の手紙',
      spineTitle: '海辺の手紙',
      subtitle: 'LETTERS BY THE TIDE',
      vol: 'Ⅰ',
      obiColor: '#f6df98',
      motif: 'lit_leaf',
    },
    {
      cat: 'literature',
      bg: '#dce9f2',
      spineBg: '#cddde9',
      accent1: '#fbf8f2',
      accent2: '#d6a468',
      ink: '#2d3f52',
      title: 'SEPTEMBER',
      spineTitle: 'SEPTEMBER GLASS',
      subtitle: 'NEW EDITION · ESSAYS',
      vol: 'Ⅱ',
      obiColor: '#f5efe6',
      motif: 'lit_window',
    },
    {
      cat: 'literature',
      bg: '#f4e1da',
      spineBg: '#ead2c8',
      accent1: '#c26f68',
      accent2: '#7d9288',
      ink: '#42302d',
      title: '真夜中珈琲',
      spineTitle: '真夜中珈琲',
      subtitle: 'MIDNIGHT KISSA · TOKYO',
      vol: 'Ⅲ',
      obiColor: '#fbf7ee',
      motif: 'lit_zoo',
    },
    {
      cat: 'literature',
      bg: '#f2ead8',
      spineBg: '#e8dcc6',
      accent1: '#d88966',
      accent2: '#6e8ea3',
      ink: '#3a342c',
      title: 'STILL LIFE',
      spineTitle: 'STILL WATER',
      subtitle: 'MORNING SKETCHES',
      vol: 'Ⅳ',
      obiColor: '#c7decb',
      motif: 'lit_bird',
    },

    // Row 2: Philosophy & Essays — Curated Mix of English & Japanese Titles (8-11)
    {
      cat: 'philosophy',
      bg: '#f2f1ec',
      spineBg: '#e7e5dd',
      accent1: '#7e938a',
      accent2: '#bfa486',
      ink: '#2d3130',
      title: 'SILENCE',
      spineTitle: 'BEING & SILENCE',
      subtitle: 'PHENOMENOLOGY NOTES',
      vol: 'II',
      motif: 'phil_frame',
    },
    {
      cat: 'philosophy',
      bg: '#e5e3de',
      spineBg: '#dad7d0',
      accent1: '#697485',
      accent2: '#c9a67a',
      ink: '#2d3036',
      title: '時間の襞',
      spineTitle: '時間の襞',
      subtitle: 'THE FOLD OF TIME',
      vol: 'IV',
      motif: 'phil_rings',
    },
    {
      cat: 'philosophy',
      bg: '#efe7d6',
      spineBg: '#e5dac3',
      accent1: '#8f8762',
      accent2: '#b87f64',
      ink: '#363229',
      title: 'REVERIES',
      spineTitle: 'WALKING NOTES',
      subtitle: 'SOLITARY REFLECTIONS',
      vol: 'I',
      motif: 'phil_diamond',
    },
    {
      cat: 'philosophy',
      bg: '#dde4ea',
      spineBg: '#cfd8e0',
      accent1: '#5d738a',
      accent2: '#c79a7e',
      ink: '#2a3440',
      title: 'ことばの境界',
      spineTitle: 'ことばの境界',
      subtitle: 'LIMITS OF LANGUAGE',
      vol: 'III',
      motif: 'phil_grid',
    },

    // Row 3: Technical / Design Books (12-13) & Retro Game Cases (14-15)
    {
      cat: 'technical',
      bg: '#f8f9fb',
      spineBg: '#edf0f4',
      accent1: '#df7861',
      accent2: '#5596a6',
      ink: '#232a34',
      title: 'OPTICS',
      spineTitle: 'OPTICS & LIGHT',
      subtitle: 'ARCHITECTURAL LIGHTING',
      vol: '3E',
      motif: 'tech_optics',
    },
    {
      cat: 'technical',
      bg: '#eaedf2',
      spineBg: '#dde2ea',
      accent1: '#4d7ea8',
      accent2: '#d9a45b',
      ink: '#222b36',
      title: 'SYNTH 98',
      spineTitle: 'ANALOG SYNTH',
      subtitle: 'FM & ACOUSTIC DESIGN',
      vol: '09',
      motif: 'tech_wave',
    },
    {
      cat: 'game',
      bg: '#e5e8ec',
      spineBg: '#d8dce3',
      accent1: '#e0635a',
      accent2: '#5a8fd9',
      ink: '#252b36',
      title: 'CHRONO DRIFT',
      spineTitle: 'CHRONO DRIFT',
      subtitle: 'SUPER 32-BIT EDITION',
      vol: '97',
      motif: 'game_sfc',
    },
    {
      cat: 'game',
      bg: '#f8efc8',
      spineBg: '#f0e3af',
      accent1: '#5eb89b',
      accent2: '#e87e5c',
      ink: '#2b3330',
      title: 'PIXEL SKY',
      spineTitle: 'PIXEL ODYSSEY',
      subtitle: 'POCKET CART COLLECTION',
      vol: '99',
      motif: 'game_handheld',
    },
  ];

  for (let i = 0; i < 16; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const tx = col * 256;
    const ty = row * 256;
    const spec = bookSpecs[i];

    // 1. Spine Zone [tx .. tx + 56] with delicate paper-wrap cylindrical shading
    bk.fillStyle = spec.spineBg;
    bk.fillRect(tx, ty, 58, 256);
    const spGrad = bk.createLinearGradient(tx, ty, tx + 56, ty);
    spGrad.addColorStop(0, 'rgba(52, 42, 36, 0.14)');
    spGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.08)');
    spGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    spGrad.addColorStop(0.82, 'rgba(255, 255, 255, 0.05)');
    spGrad.addColorStop(1, 'rgba(52, 42, 36, 0.14)');
    bk.fillStyle = spGrad;
    bk.fillRect(tx, ty, 56, 256);
    // 2. Cover Zone [tx + 58 .. tx + 222]
    bk.fillStyle = spec.bg;
    bk.fillRect(tx + 58, ty, 166, 256);
    // 3. Soft Creamy Milled Paper Page Block Strip [tx + 224 .. tx + 256]
    bk.fillStyle = '#faf3e4';
    bk.fillRect(tx + 224, ty, 32, 256);
    for (let px = tx + 225; px < tx + 255; px += 2) {
      const darkLine = (px - tx) % 4 === 0;
      bk.fillStyle = darkLine ? 'rgba(182, 164, 138, 0.34)' : 'rgba(255, 253, 248, 0.65)';
      bk.fillRect(px, ty, 1, 256);
      bkb.fillStyle = darkLine ? '#636363' : '#a2a2a2';
      bkb.fillRect(px, ty, 1, 256);
    }

    // French hinge crease groove between spine and front cover
    bk.fillStyle = 'rgba(48, 38, 34, 0.16)';
    bk.fillRect(tx + 55, ty, 3, 256);
    bkb.fillStyle = '#404040';
    bkb.fillRect(tx + 54, ty, 4, 256);

    const cx0 = tx + 66;
    const cy0 = ty + 12;
    const cw = 150;
    const ch = 232;
    const gx = cx0 + cw * 0.5;
    const gy = cy0 + 132;

    // ---- CATEGORY-DISTINCT SPINE DESIGNS (Zero uniform archive box template!) ----
    if (spec.cat === 'manga') {
      // Manga spine: bright pastel top header band + bold volume square + vertical title + tiny publisher icon
      bk.fillStyle = spec.accent1;
      bk.fillRect(tx + 2, ty + 6, 52, 34);
      bk.fillStyle = '#ffffff';
      bk.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
      bk.textAlign = 'center';
      bk.fillText(spec.vol, tx + 28, ty + 28);

      // Small accent color bar at bottom
      bk.fillStyle = spec.accent2;
      bk.fillRect(tx + 6, ty + 216, 44, 18);
      bk.fillStyle = '#ffffff';
      bk.font = 'bold 9px monospace';
      bk.fillText('COMICS', tx + 28, ty + 229);

      // Vertical Japanese manga title characters
      bk.fillStyle = spec.ink;
      bk.font = 'bold 15px "Noto Sans JP", "Hiragino Sans", sans-serif';
      bk.textAlign = 'center';
      const chars = [...spec.spineTitle];
      chars.forEach((chStr, ci) => {
        bk.fillText(chStr, tx + 28, ty + 74 + ci * 24);
      });
    } else if (spec.cat === 'literature') {
      // Literature spine: airy minimal serif title (vertical JP or rotated EN) + soft pastel obi belly-band!
      if (spec.obiColor) {
        bk.fillStyle = spec.obiColor;
        bk.fillRect(tx, ty + 180, 224, 52);
        bk.fillStyle = 'rgba(40, 32, 26, 0.14)';
        bk.fillRect(tx, ty + 180, 224, 1.5);
      }
      bk.fillStyle = spec.accent1;
      bk.fillRect(tx + 18, ty + 18, 20, 3);
      bk.fillStyle = spec.ink;
      const isLatinLit = /^[\x20-\x7E]+$/.test(spec.spineTitle);
      if (isLatinLit) {
        bk.save();
        bk.translate(tx + 32, ty + 104);
        bk.rotate(-Math.PI / 2);
        bk.font = '600 11.5px Georgia, serif';
        bk.textAlign = 'center';
        bk.fillText(spec.spineTitle, 0, 0);
        bk.restore();
      } else {
        bk.font = '600 14px "Noto Serif JP", Georgia, serif';
        bk.textAlign = 'center';
        const chars = [...spec.spineTitle];
        chars.forEach((chStr, ci) => {
          bk.fillText(chStr, tx + 28, ty + 54 + ci * 22);
        });
      }
      bk.fillStyle = spec.ink;
      bk.font = '10px Georgia, serif';
      bk.textAlign = 'center';
      bk.fillText(spec.vol, tx + 28, ty + 212);
    } else if (spec.cat === 'philosophy') {
      // Philosophy spine: understated classical double-hairline bands & refined Roman numeral
      bk.fillStyle = spec.accent1;
      bk.fillRect(tx + 8, ty + 20, 40, 1.5);
      bk.fillRect(tx + 8, ty + 25, 40, 1.5);
      bk.fillRect(tx + 8, ty + 224, 40, 1.5);
      bk.fillStyle = spec.accent1;
      bk.fillRect(tx + 10, ty + 42, 36, 128);
      bk.fillStyle = '#faf8f2';
      const isLatinPhil = /^[\x20-\x7E]+$/.test(spec.spineTitle);
      if (isLatinPhil) {
        bk.save();
        bk.translate(tx + 32, ty + 106);
        bk.rotate(-Math.PI / 2);
        bk.font = '600 10.5px Georgia, serif';
        bk.textAlign = 'center';
        bk.fillText(spec.spineTitle, 0, 0);
        bk.restore();
      } else {
        bk.font = '600 12.5px "Noto Serif JP", Georgia, serif';
        bk.textAlign = 'center';
        const chars = [...spec.spineTitle];
        const stepY = chars.length >= 6 ? 18 : 21;
        chars.forEach((chStr, ci) => {
          bk.fillText(chStr, tx + 28, ty + 62 + ci * stepY);
        });
      }
      bk.fillStyle = spec.ink;
      bk.font = 'italic 12px Georgia, serif';
      bk.textAlign = 'center';
      bk.fillText(spec.vol, tx + 28, ty + 204);
    } else if (spec.cat === 'technical') {
      // Technical / Design spine: crisp Swiss grid stripe + rotated clean sans-serif title
      bk.fillStyle = spec.accent1;
      bk.fillRect(tx + 4, ty + 12, 48, 24);
      bk.fillStyle = '#ffffff';
      bk.font = 'bold 11px monospace';
      bk.textAlign = 'center';
      bk.fillText(spec.vol, tx + 28, ty + 28);

      bk.save();
      bk.translate(tx + 32, ty + 132);
      bk.rotate(-Math.PI / 2);
      bk.fillStyle = spec.ink;
      bk.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      bk.textAlign = 'center';
      bk.fillText(spec.spineTitle, 0, 0);
      bk.restore();

      bk.fillStyle = spec.accent2;
      bk.fillRect(tx + 4, ty + 226, 48, 12);
    } else {
      // Retro Game Box spine: iconic console color header bar + horizontal cartridge badge + system mark
      bk.fillStyle = spec.accent1;
      bk.fillRect(tx + 2, ty + 6, 52, 44);
      bk.fillStyle = '#ffffff';
      bk.font = 'bold 9px monospace';
      bk.textAlign = 'center';
      bk.fillText('RETRO', tx + 28, ty + 24);
      bk.fillText('32-BIT', tx + 28, ty + 38);

      bk.save();
      bk.translate(tx + 32, ty + 142);
      bk.rotate(-Math.PI / 2);
      bk.fillStyle = spec.ink;
      bk.font = 'bold 13px monospace';
      bk.textAlign = 'center';
      bk.fillText(spec.spineTitle, 0, 0);
      bk.restore();

      bk.fillStyle = spec.accent2;
      bk.fillRect(tx + 8, ty + 216, 40, 22);
      bk.fillStyle = '#ffffff';
      bk.font = 'bold 10px monospace';
      bk.fillText(`'${spec.vol}`, tx + 28, ty + 231);
    }

    // ---- CATEGORY-DISTINCT COVER LAYOUTS & ILLUSTRATIONS ----
    if (spec.cat === 'manga') {
      // Diagonal pastel color block + halftone dots + bold manga cover lettering
      bk.save();
      bk.beginPath();
      bk.rect(cx0, cy0, cw, ch);
      bk.clip();
      bk.fillStyle = spec.accent1;
      bk.beginPath();
      bk.moveTo(cx0, cy0 + 82);
      bk.lineTo(cx0 + cw, cy0 + 48);
      bk.lineTo(cx0 + cw, cy0 + 186);
      bk.lineTo(cx0, cy0 + 212);
      bk.closePath();
      bk.fill();

      // Comic halftone dot pattern
      bk.fillStyle = 'rgba(255, 255, 255, 0.32)';
      for (let hx = cx0 + 10; hx < cx0 + cw; hx += 12) {
        for (let hy = cy0 + 62; hy < cy0 + 195; hy += 12) {
          bk.beginPath();
          bk.arc(hx, hy, 2.5, 0, Math.PI * 2);
          bk.fill();
        }
      }

      // Stylized manga central icon
      bk.fillStyle = spec.accent2;
      if (spec.motif === 'manga_cat') {
        bk.beginPath();
        bk.arc(gx, gy + 4, 30, 0, Math.PI * 2);
        bk.fill();
        bk.beginPath();
        bk.moveTo(gx - 24, gy - 12);
        bk.lineTo(gx - 16, gy - 36);
        bk.lineTo(gx - 4, gy - 20);
        bk.moveTo(gx + 24, gy - 12);
        bk.lineTo(gx + 16, gy - 36);
        bk.lineTo(gx + 4, gy - 20);
        bk.fill();
      } else {
        bk.beginPath();
        bk.arc(gx + 10, gy - 2, 32, 0, Math.PI * 2);
        bk.fill();
        bk.fillStyle = '#ffffff';
        bk.fillRect(gx - 44, gy + 12, 88, 22);
        bk.fillStyle = spec.ink;
        bk.fillRect(gx - 34, gy + 18, 16, 10);
        bk.fillRect(gx - 10, gy + 18, 16, 10);
        bk.fillRect(gx + 14, gy + 18, 16, 10);
      }
      bk.restore();

      bk.fillStyle = spec.ink;
      bk.textAlign = 'left';
      bk.font = 'bold 21px "Noto Sans SC", sans-serif';
      bk.fillText(spec.title, cx0 + 8, cy0 + 30);
      bk.font = 'bold 9px monospace';
      bk.fillText(spec.subtitle, cx0 + 8, cy0 + 46);

      // Volume badge circle bottom-right
      bk.fillStyle = '#ffffff';
      bk.beginPath();
      bk.arc(cx0 + cw - 22, cy0 + ch - 22, 16, 0, Math.PI * 2);
      bk.fill();
      bk.strokeStyle = spec.ink;
      bk.lineWidth = 2;
      bk.stroke();
      bk.fillStyle = spec.ink;
      bk.textAlign = 'center';
      bk.font = 'bold 13px monospace';
      bk.fillText(spec.vol, cx0 + cw - 22, cy0 + ch - 18);
    } else if (spec.cat === 'literature') {
      // Airy editorial cover with illustration + obi band text
      bk.fillStyle = spec.ink;
      bk.textAlign = 'center';
      bk.font = '600 18px Georgia, "Noto Serif SC", serif';
      bk.fillText(spec.title, gx, cy0 + 34);
      bk.font = '8.5px monospace';
      bk.fillStyle = 'rgba(55, 48, 42, 0.72)';
      bk.fillText(spec.subtitle, gx, cy0 + 50);

      if (spec.motif === 'lit_leaf') {
        bk.fillStyle = spec.accent1;
        for (const [ox, oy, ang] of [
          [-16, 108, -0.5],
          [16, 102, 0.5],
          [-12, 132, -0.4],
          [14, 128, 0.45],
        ] as const) {
          bk.beginPath();
          bk.ellipse(gx + ox, cy0 + oy, 16, 7, ang, 0, Math.PI * 2);
          bk.fill();
        }
        bk.strokeStyle = spec.ink;
        bk.lineWidth = 1.6;
        bk.beginPath();
        bk.moveTo(gx, cy0 + 82);
        bk.lineTo(gx, cy0 + 154);
        bk.stroke();
      } else if (spec.motif === 'lit_window') {
        bk.fillStyle = spec.accent1;
        bk.fillRect(gx - 34, cy0 + 74, 68, 84);
        bk.strokeStyle = spec.accent2;
        bk.lineWidth = 2.5;
        bk.strokeRect(gx - 34, cy0 + 74, 68, 84);
        bk.beginPath();
        bk.moveTo(gx, cy0 + 74);
        bk.lineTo(gx, cy0 + 158);
        bk.moveTo(gx - 34, cy0 + 116);
        bk.lineTo(gx + 34, cy0 + 116);
        bk.stroke();
      } else if (spec.motif === 'lit_zoo') {
        bk.fillStyle = spec.accent1;
        bk.beginPath();
        bk.arc(gx - 10, cy0 + 118, 28, Math.PI, 0);
        bk.lineTo(gx + 18, cy0 + 152);
        bk.lineTo(gx - 38, cy0 + 152);
        bk.closePath();
        bk.fill();
        bk.fillStyle = spec.accent2;
        bk.beginPath();
        bk.arc(gx + 22, cy0 + 96, 14, 0, Math.PI * 2);
        bk.fill();
      } else {
        bk.fillStyle = spec.accent1;
        bk.beginPath();
        bk.arc(gx, cy0 + 122, 34, 0, Math.PI * 2);
        bk.fill();
        bk.strokeStyle = '#ffffff';
        bk.lineWidth = 2.4;
        bk.beginPath();
        bk.moveTo(gx - 24, cy0 + 114);
        bk.quadraticCurveTo(gx - 10, cy0 + 100, gx, cy0 + 116);
        bk.quadraticCurveTo(gx + 12, cy0 + 100, gx + 26, cy0 + 114);
        bk.stroke();
      }

      // Obi belly-band typography
      bk.fillStyle = spec.ink;
      bk.font = 'bold 9px monospace';
      bk.fillText('LITERARY EDITION · SOFTCOVER', gx, ty + 210);
    } else if (spec.cat === 'philosophy') {
      // Refined double-hairline academic philosophy layout
      bk.strokeStyle = spec.accent1;
      bk.lineWidth = 1.5;
      bk.strokeRect(cx0 + 8, cy0 + 8, cw - 16, ch - 16);
      bk.strokeRect(cx0 + 13, cy0 + 13, cw - 26, ch - 26);
      bkb.strokeStyle = '#525252';
      bkb.lineWidth = 2;
      bkb.strokeRect(cx0 + 8, cy0 + 8, cw - 16, ch - 16);

      bk.fillStyle = spec.ink;
      bk.textAlign = 'center';
      bk.font = '600 17px Georgia, "Noto Serif SC", serif';
      bk.fillText(spec.title, gx, cy0 + 52);
      bk.font = '8.5px Georgia, serif';
      bk.fillText(spec.subtitle, gx, cy0 + 70);

      bk.strokeStyle = spec.accent1;
      bk.lineWidth = 1.8;
      if (spec.motif === 'phil_rings') {
        for (const r of [14, 24, 34]) {
          bk.beginPath();
          bk.arc(gx, gy + 10, r, 0, Math.PI * 2);
          bk.stroke();
        }
      } else if (spec.motif === 'phil_diamond') {
        bk.beginPath();
        bk.moveTo(gx, gy - 26);
        bk.lineTo(gx + 30, gy + 10);
        bk.lineTo(gx, gy + 46);
        bk.lineTo(gx - 30, gy + 10);
        bk.closePath();
        bk.stroke();
        bk.fillStyle = spec.accent2;
        bk.beginPath();
        bk.arc(gx, gy + 10, 7, 0, Math.PI * 2);
        bk.fill();
      } else if (spec.motif === 'phil_grid') {
        for (let k = -2; k <= 2; k++) {
          bk.beginPath();
          bk.moveTo(gx + k * 14, gy - 20);
          bk.lineTo(gx + k * 14, gy + 38);
          bk.stroke();
        }
        bk.fillStyle = spec.accent2;
        bk.fillRect(gx - 18, gy - 4, 36, 24);
      } else {
        bk.fillStyle = spec.accent1;
        bk.fillRect(gx - 34, gy - 14, 68, 44);
        bk.fillStyle = '#faf8f2';
        bk.font = 'italic 16px Georgia, serif';
        bk.fillText(spec.vol, gx, gy + 14);
      }
      bk.fillStyle = spec.ink;
      bk.font = '9px Georgia, serif';
      bk.fillText(`MONOGRAPH · ${spec.vol}`, gx, cy0 + ch - 24);
    } else if (spec.cat === 'technical') {
      // Swiss modernist technical / design manual cover
      bk.fillStyle = spec.accent1;
      bk.fillRect(cx0, cy0, cw, 54);
      bk.fillStyle = '#ffffff';
      bk.textAlign = 'left';
      bk.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
      bk.fillText(spec.title, cx0 + 10, cy0 + 28);
      bk.font = '8.5px monospace';
      bk.fillText(spec.subtitle, cx0 + 10, cy0 + 44);

      if (spec.motif === 'tech_optics') {
        bk.fillStyle = spec.accent2;
        bk.beginPath();
        bk.moveTo(gx, gy - 32);
        bk.lineTo(gx + 40, gy + 28);
        bk.lineTo(gx - 40, gy + 28);
        bk.closePath();
        bk.fill();
        bk.strokeStyle = spec.accent1;
        bk.lineWidth = 3;
        bk.beginPath();
        bk.moveTo(cx0 + 10, gy + 4);
        bk.lineTo(gx, gy - 2);
        bk.lineTo(cx0 + cw - 10, gy + 18);
        bk.stroke();
      } else {
        // Oscilloscope waveform diagram
        bk.strokeStyle = 'rgba(77, 126, 168, 0.25)';
        bk.lineWidth = 1;
        for (let gyi = cy0 + 78; gyi <= cy0 + 188; gyi += 22) {
          bk.beginPath();
          bk.moveTo(cx0 + 10, gyi);
          bk.lineTo(cx0 + cw - 10, gyi);
          bk.stroke();
        }
        bk.strokeStyle = spec.accent1;
        bk.lineWidth = 2.6;
        bk.beginPath();
        for (let sx = 0; sx <= cw - 20; sx += 3) {
          const sy = gy + Math.sin(sx * 0.09) * 24 * Math.cos(sx * 0.025);
          if (sx === 0) bk.moveTo(cx0 + 10 + sx, sy);
          else bk.lineTo(cx0 + 10 + sx, sy);
        }
        bk.stroke();
      }
      bk.fillStyle = spec.ink;
      bk.font = 'bold 9px monospace';
      bk.fillText(`FIG. ${spec.vol} // TECHNICAL PRESS`, cx0 + 10, cy0 + ch - 14);
    } else {
      // Retro 90s Console / Handheld Game Box cover
      // Left vertical console stripe bar
      bk.fillStyle = spec.accent1;
      bk.fillRect(cx0, cy0, 24, ch);
      bk.save();
      bk.translate(cx0 + 16, cy0 + ch * 0.5);
      bk.rotate(-Math.PI / 2);
      bk.fillStyle = '#ffffff';
      bk.textAlign = 'center';
      bk.font = 'bold 11px monospace';
      bk.fillText('SUPER HOME SYSTEM', 0, 0);
      bk.restore();

      // Pixel-art sky & sunset horizon box art
      const artX = cx0 + 30;
      const artY = cy0 + 14;
      const artW = cw - 36;
      const artH = 144;
      const skyG = bk.createLinearGradient(artX, artY, artX, artY + artH);
      skyG.addColorStop(0, spec.accent2);
      skyG.addColorStop(0.65, '#f6d6a8');
      skyG.addColorStop(1, '#f2a294');
      bk.fillStyle = skyG;
      bk.fillRect(artX, artY, artW, artH);

      // Sun & retro horizon perspective grid
      bk.fillStyle = '#fff6dc';
      bk.beginPath();
      bk.arc(artX + artW * 0.5, artY + 66, 22, 0, Math.PI * 2);
      bk.fill();
      bk.fillStyle = '#3c4566';
      bk.fillRect(artX, artY + 96, artW, artH - 96);
      bk.strokeStyle = 'rgba(130, 232, 220, 0.55)';
      bk.lineWidth = 1.2;
      for (let gl = 0; gl < 5; gl++) {
        const yLine = artY + 102 + gl * 9;
        bk.beginPath();
        bk.moveTo(artX, yLine);
        bk.lineTo(artX + artW, yLine);
        bk.stroke();
      }
      // Game title banner
      bk.fillStyle = spec.ink;
      bk.textAlign = 'left';
      bk.font = 'bold 13px monospace';
      bk.fillText(spec.title, artX + 2, cy0 + 182);
      bk.font = '8.5px monospace';
      bk.fillText(spec.subtitle, artX + 2, cy0 + 198);
      // Rating seal
      bk.strokeStyle = spec.ink;
      bk.lineWidth = 1.5;
      bk.strokeRect(artX + artW - 24, cy0 + ch - 28, 20, 20);
      bk.font = 'bold 12px monospace';
      bk.textAlign = 'center';
      bk.fillText('A', artX + artW - 14, cy0 + ch - 13);
    }
  }

  // Soft tactile book-paper & cloth linen micro-grain across the 1024x1024 atlas
  for (let y = 0; y < 1024; y += 3) {
    bk.fillStyle = y % 6 === 0 ? 'rgba(255, 252, 245, 0.055)' : 'rgba(58, 46, 38, 0.035)';
    bk.fillRect(0, y, 1024, 1.5);
    bkb.fillStyle = y % 6 === 0 ? 'rgba(205, 205, 205, 0.11)' : 'rgba(72, 72, 72, 0.11)';
    bkb.fillRect(0, y, 1024, 1.5);
  }
  for (let x = 0; x < 1024; x += 4) {
    bkb.fillStyle = x % 8 === 0 ? 'rgba(195, 195, 195, 0.08)' : 'rgba(78, 78, 78, 0.08)';
    bkb.fillRect(x, 0, 1.5, 1024);
  }

  const bookCoverAtlas = track(finalizeTexture(bkCanvas, maxAniso, 1, 1));
  const bookCoverBump = track(finalizeTexture(bkBumpCanvas, maxAniso, 1, 1, true));

  // 22b. 12-inch Vinyl Record Jacket Atlas (1024x512, 4x2 = 8 Distinct Lo-Fi / Jazz / Dreamcore Album Sleeves)
  //      Each 256x256 tile: left strip [0..18] = jacket spine, main [18..256] = square album cover art!
  const vsCanvas = document.createElement('canvas');
  vsCanvas.width = 1024;
  vsCanvas.height = 512;
  const vs = vsCanvas.getContext('2d')!;
  const vinylSpecs = [
    {
      bg1: '#f4d9be',
      bg2: '#c5a5cf',
      spine: '#e4c2a2',
      accent1: '#f8efe2',
      accent2: '#6b538a',
      title: 'MIDNIGHT CORRIDOR',
      artist: 'LATE FM TRIO',
      art: 'corridor',
    },
    {
      bg1: '#cfe6f0',
      bg2: '#f2c8b8',
      spine: '#b8d7e5',
      accent1: '#e68c74',
      accent2: '#3f5a75',
      title: 'PASTEL TRAMWAY',
      artist: '1998 DRIFT',
      art: 'tram',
    },
    {
      bg1: '#d8e8d4',
      bg2: '#f3dfb9',
      spine: '#c2d8be',
      accent1: '#c97e56',
      accent2: '#466957',
      title: 'AMBER RAIN WINDOW',
      artist: 'RHODES & TEA',
      art: 'rain',
    },
    {
      bg1: '#dfd2ee',
      bg2: '#b8c8e8',
      spine: '#cbbce0',
      accent1: '#f8e0a4',
      accent2: '#4d5d8c',
      title: 'LIMINAL 19:57',
      artist: 'STATIC NOSTALGIA',
      art: 'moon',
    },
    {
      bg1: '#f7e5cc',
      bg2: '#e9b28a',
      spine: '#e8cfa9',
      accent1: '#3b4a5e',
      accent2: '#d96954',
      title: 'SUNLIT BOSSA',
      artist: 'KYOTO QUARTET',
      art: 'sun',
    },
    {
      bg1: '#eceae4',
      bg2: '#d8d5cc',
      spine: '#dddad2',
      accent1: '#528799',
      accent2: '#d98c66',
      title: 'MODULAR TAPE 04',
      artist: 'ANALOG ARCHIVE',
      art: 'bauhaus',
    },
    {
      bg1: '#f5d9df',
      bg2: '#d7e2f2',
      spine: '#e8c4cc',
      accent1: '#ffffff',
      accent2: '#7a638f',
      title: 'CLOUD GALLERY',
      artist: 'SOFT CHIMES',
      art: 'clouds',
    },
    {
      bg1: '#e4efe8',
      bg2: '#cadbe0',
      spine: '#cfe0d6',
      accent1: '#5b8a6b',
      accent2: '#df9d6b',
      title: 'BOTANICAL LO-FI',
      artist: 'GREENHOUSE',
      art: 'leaves',
    },
  ] as const;

  for (let i = 0; i < 8; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const tx = col * 256;
    const ty = row * 256;
    const sp = vinylSpecs[i];

    // Spine strip [0..20]
    vs.fillStyle = sp.spine;
    vs.fillRect(tx, ty, 20, 256);
    vs.fillStyle = sp.accent2;
    vs.fillRect(tx + 5, ty + 18, 10, 8);
    vs.fillRect(tx + 5, ty + 230, 10, 6);
    vs.save();
    vs.translate(tx + 13, ty + 128);
    vs.rotate(-Math.PI / 2);
    vs.fillStyle = '#2d2633';
    vs.font = 'bold 9px monospace';
    vs.textAlign = 'center';
    vs.fillText(sp.title, 0, 0);
    vs.restore();

    // Square Album Cover [20..256]
    const ax = tx + 20;
    const aw = 236;
    const g = vs.createLinearGradient(ax, ty, ax + aw, ty + 256);
    g.addColorStop(0, sp.bg1);
    g.addColorStop(1, sp.bg2);
    vs.fillStyle = g;
    vs.fillRect(ax, ty, aw, 256);

    const cx = ax + aw * 0.5;
    const cy = ty + 132;
    if (sp.art === 'corridor') {
      for (let k = 0; k < 4; k++) {
        const inset = 22 + k * 16;
        vs.strokeStyle = k === 3 ? sp.accent1 : 'rgba(107, 83, 138, 0.42)';
        vs.lineWidth = 3;
        vs.strokeRect(ax + inset, ty + 52 + k * 14, aw - inset * 2, 168 - k * 24);
      }
      vs.fillStyle = sp.accent1;
      vs.beginPath();
      vs.arc(cx, cy + 8, 20, 0, Math.PI * 2);
      vs.fill();
    } else if (sp.art === 'tram') {
      vs.fillStyle = sp.accent1;
      vs.beginPath();
      vs.arc(cx + 26, ty + 104, 34, 0, Math.PI * 2);
      vs.fill();
      vs.fillStyle = sp.accent2;
      vs.fillRect(ax + 24, ty + 148, aw - 48, 48);
      vs.fillStyle = '#fff5e4';
      for (let wx = 0; wx < 4; wx++) {
        vs.fillRect(ax + 36 + wx * 42, ty + 158, 28, 22);
      }
    } else if (sp.art === 'rain') {
      vs.fillStyle = '#fff9ee';
      vs.fillRect(ax + 38, ty + 56, aw - 76, 128);
      vs.fillStyle = sp.accent1;
      vs.beginPath();
      vs.arc(cx, ty + 124, 28, 0, Math.PI * 2);
      vs.fill();
      vs.strokeStyle = sp.accent2;
      vs.lineWidth = 3;
      vs.strokeRect(ax + 38, ty + 56, aw - 76, 128);
      vs.beginPath();
      vs.moveTo(cx, ty + 56);
      vs.lineTo(cx, ty + 184);
      vs.moveTo(ax + 38, ty + 120);
      vs.lineTo(ax + aw - 38, ty + 120);
      vs.stroke();
    } else if (sp.art === 'moon') {
      vs.fillStyle = sp.accent1;
      vs.beginPath();
      vs.arc(cx, ty + 114, 42, 0, Math.PI * 2);
      vs.fill();
      vs.fillStyle = sp.bg1;
      vs.beginPath();
      vs.arc(cx + 16, ty + 106, 34, 0, Math.PI * 2);
      vs.fill();
      vs.strokeStyle = sp.accent2;
      vs.lineWidth = 2;
      for (let wy = 0; wy < 5; wy++) {
        vs.beginPath();
        vs.moveTo(ax + 24, ty + 178 + wy * 10);
        vs.lineTo(ax + aw - 24, ty + 178 + wy * 10);
        vs.stroke();
      }
    } else if (sp.art === 'sun') {
      vs.fillStyle = sp.accent2;
      vs.beginPath();
      vs.arc(cx, ty + 132, 54, Math.PI, 0);
      vs.fill();
      vs.fillStyle = sp.accent1;
      vs.fillRect(ax + 22, ty + 136, aw - 44, 62);
      vs.fillStyle = '#f8efe0';
      vs.fillRect(ax + 44, ty + 150, aw - 88, 6);
      vs.fillRect(ax + 64, ty + 166, aw - 128, 5);
    } else if (sp.art === 'bauhaus') {
      vs.fillStyle = sp.accent1;
      vs.fillRect(ax + 30, ty + 62, 84, 124);
      vs.fillStyle = sp.accent2;
      vs.beginPath();
      vs.arc(cx + 28, ty + 134, 44, 0, Math.PI * 2);
      vs.fill();
      vs.strokeStyle = '#2d3138';
      vs.lineWidth = 2.5;
      vs.strokeRect(ax + 46, ty + 78, 136, 98);
    } else if (sp.art === 'clouds') {
      vs.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (const [ox, oy, r] of [
        [-34, 128, 32],
        [0, 114, 40],
        [36, 130, 30],
        [-12, 146, 32],
        [22, 146, 28],
      ] as const) {
        vs.beginPath();
        vs.arc(cx + ox, ty + oy, r, 0, Math.PI * 2);
        vs.fill();
      }
    } else {
      vs.fillStyle = sp.accent1;
      for (let lf = 0; lf < 6; lf++) {
        const ang = (lf / 6) * Math.PI * 2;
        vs.beginPath();
        vs.ellipse(
          cx + Math.cos(ang) * 32,
          cy + Math.sin(ang) * 32,
          24,
          11,
          ang,
          0,
          Math.PI * 2
        );
        vs.fill();
      }
      vs.fillStyle = sp.accent2;
      vs.beginPath();
      vs.arc(cx, cy, 16, 0, Math.PI * 2);
      vs.fill();
    }

    // Minimal album header & artist footer
    vs.fillStyle = '#2a2430';
    vs.textAlign = 'left';
    vs.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    vs.fillText(sp.title, ax + 16, ty + 28);
    vs.font = '9px monospace';
    vs.fillStyle = 'rgba(42, 36, 48, 0.72)';
    vs.fillText(`${sp.artist} · 33⅓ RPM`, ax + 16, ty + 240);

    // Subtle cardboard sleeve ring-wear patina
    vs.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    vs.lineWidth = 4;
    vs.beginPath();
    vs.arc(cx, ty + 128, 92, 0, Math.PI * 2);
    vs.stroke();
  }
  const vinylSleeveAtlas = track(finalizeTexture(vsCanvas, maxAniso, 1, 1));

  // --- BATHROOM CERAMIC TILE (warm creamy-ivory large tiles with subtle lavender-taupe grout) ---
  const bathTileCanvas = document.createElement('canvas');
  bathTileCanvas.width = 512;
  bathTileCanvas.height = 512;
  const bathTileCtx = bathTileCanvas.getContext('2d')!;
  bathTileCtx.fillStyle = '#d4cdd8';
  bathTileCtx.fillRect(0, 0, 512, 512);
  const btCells = 4;
  const btStep = 512 / btCells;
  for (let r = 0; r < btCells; r++) {
    for (let c = 0; c < btCells; c++) {
      const shade = ((r * 7 + c * 13) % 5) * 2;
      const g = bathTileCtx.createLinearGradient(c * btStep, r * btStep, (c + 1) * btStep, (r + 1) * btStep);
      g.addColorStop(0, `rgb(${251 - shade}, ${248 - shade}, ${246 - shade})`);
      g.addColorStop(1, `rgb(${244 - shade}, ${240 - shade}, ${242 - shade})`);
      bathTileCtx.fillStyle = g;
      bathTileCtx.fillRect(c * btStep + 3, r * btStep + 3, btStep - 6, btStep - 6);
      bathTileCtx.strokeStyle = 'rgba(255,255,255,0.55)';
      bathTileCtx.lineWidth = 1.5;
      bathTileCtx.strokeRect(c * btStep + 4, r * btStep + 4, btStep - 8, btStep - 8);
    }
  }
  const bathroomTile = track(finalizeTexture(bathTileCanvas, maxAniso, 1, 1));

  // --- BATHROOM PASTEL WAVE-STRIPE WALL (harmonized Morandi soft sky-blue & creamy ivory) ---
  const bwCanvas = document.createElement('canvas');
  bwCanvas.width = 512;
  bwCanvas.height = 512;
  const bwc = bwCanvas.getContext('2d')!;
  const bwBg = bwc.createLinearGradient(0, 0, 0, 512);
  bwBg.addColorStop(0, '#c6deea');
  bwBg.addColorStop(0.5, '#cfe3ee');
  bwBg.addColorStop(1, '#d8e8f0');
  bwc.fillStyle = bwBg;
  bwc.fillRect(0, 0, 512, 512);
  bwc.fillStyle = 'rgba(252, 249, 246, 0.72)';
  for (let s = 0; s < 5; s++) {
    const baseY = 48 + s * 102;
    bwc.beginPath();
    bwc.moveTo(0, baseY);
    for (let x = 0; x <= 512; x += 16) {
      const y = baseY + Math.sin((x / 512) * Math.PI * 2 + s * 1.1) * 7;
      bwc.lineTo(x, y);
    }
    for (let x = 512; x >= 0; x -= 16) {
      const y = baseY + 24 + Math.sin((x / 512) * Math.PI * 2 + s * 1.1 + 0.35) * 7;
      bwc.lineTo(x, y);
    }
    bwc.closePath();
    bwc.fill();
  }
  const bathroomWall = track(finalizeTexture(bwCanvas, maxAniso, 2, 1));

  // --- BATHROOM SOFT SKY-BLUE PLAID WOVEN BATHMAT ---
  const bmCanvas = document.createElement('canvas');
  bmCanvas.width = 256;
  bmCanvas.height = 256;
  const bmc = bmCanvas.getContext('2d')!;
  bmc.fillStyle = '#b4d4e6';
  bmc.fillRect(0, 0, 256, 256);
  bmc.fillStyle = 'rgba(248, 248, 252, 0.48)';
  for (let i = 16; i < 256; i += 44) {
    bmc.fillRect(i, 0, 12, 256);
    bmc.fillRect(0, i, 256, 12);
  }
  bmc.strokeStyle = 'rgba(130, 170, 198, 0.35)';
  bmc.lineWidth = 2;
  for (let i = 4; i < 256; i += 8) {
    bmc.beginPath();
    bmc.moveTo(0, i);
    bmc.lineTo(256, i);
    bmc.stroke();
  }
  const bathPlaidMat = track(finalizeTexture(bmCanvas, maxAniso, 1, 1));

  // --- GRITTY WEATHERED INDUSTRIAL METAL (512x512 seamless albedo + bump + roughness) ---
  // Designed for basement ventilation ducts, heavy iron racks, and utility pipes.
  const rmSize = 512;
  const rmCanvas = document.createElement('canvas');
  rmCanvas.width = rmSize;
  rmCanvas.height = rmSize;
  const rmCtx = rmCanvas.getContext('2d')!;

  const rmBumpCanvas = document.createElement('canvas');
  rmBumpCanvas.width = rmSize;
  rmBumpCanvas.height = rmSize;
  const rmBumpCtx = rmBumpCanvas.getContext('2d')!;

  const rmRoughCanvas = document.createElement('canvas');
  rmRoughCanvas.width = rmSize;
  rmRoughCanvas.height = rmSize;
  const rmRoughCtx = rmRoughCanvas.getContext('2d')!;

  // Base neutral oxidized steel tone (so material.color tints cleanly per asset)
  rmCtx.fillStyle = '#b4b8c0';
  rmCtx.fillRect(0, 0, rmSize, rmSize);
  rmBumpCtx.fillStyle = '#808080';
  rmBumpCtx.fillRect(0, 0, rmSize, rmSize);
  rmRoughCtx.fillStyle = '#b8b8b8';
  rmRoughCtx.fillRect(0, 0, rmSize, rmSize);

  // 1) Broad oxidized mill-scale & soot/oil mottling (tile-wrapped across borders)
  for (let i = 0; i < 95; i++) {
    const mx = (i * 173 + 31) % rmSize;
    const my = (i * 251 + 67) % rmSize;
    const mr = 24 + ((i * 37) % 58);
    const darkPatina = i % 3 !== 0;
    const rustPatina = i % 7 === 0;
    for (const ox of [-rmSize, 0, rmSize]) {
      for (const oy of [-rmSize, 0, rmSize]) {
        if (mx + ox + mr < 0 || mx + ox - mr > rmSize || my + oy + mr < 0 || my + oy - mr > rmSize) continue;
        const ag = rmCtx.createRadialGradient(mx + ox, my + oy, 2, mx + ox, my + oy, mr);
        if (rustPatina) {
          ag.addColorStop(0, 'rgba(116, 84, 66, 0.22)');
          ag.addColorStop(1, 'rgba(116, 84, 66, 0)');
        } else if (darkPatina) {
          ag.addColorStop(0, 'rgba(72, 76, 86, 0.26)');
          ag.addColorStop(1, 'rgba(72, 76, 86, 0)');
        } else {
          ag.addColorStop(0, 'rgba(218, 222, 230, 0.16)');
          ag.addColorStop(1, 'rgba(218, 222, 230, 0)');
        }
        rmCtx.fillStyle = ag;
        rmCtx.beginPath();
        rmCtx.arc(mx + ox, my + oy, mr, 0, Math.PI * 2);
        rmCtx.fill();

        const rg = rmRoughCtx.createRadialGradient(mx + ox, my + oy, 2, mx + ox, my + oy, mr);
        const rv = rustPatina ? 242 : darkPatina ? 228 : 132;
        rg.addColorStop(0, `rgba(${rv}, ${rv}, ${rv}, 0.42)`);
        rg.addColorStop(1, `rgba(${rv}, ${rv}, ${rv}, 0)`);
        rmRoughCtx.fillStyle = rg;
        rmRoughCtx.beginPath();
        rmRoughCtx.arc(mx + ox, my + oy, mr, 0, Math.PI * 2);
        rmRoughCtx.fill();

        const bg = rmBumpCtx.createRadialGradient(mx + ox, my + oy, 2, mx + ox, my + oy, mr * 0.85);
        const bv = darkPatina ? 98 : 154;
        bg.addColorStop(0, `rgba(${bv}, ${bv}, ${bv}, 0.28)`);
        bg.addColorStop(1, `rgba(128, 128, 128, 0)`);
        rmBumpCtx.fillStyle = bg;
        rmBumpCtx.beginPath();
        rmBumpCtx.arc(mx + ox, my + oy, mr * 0.85, 0, Math.PI * 2);
        rmBumpCtx.fill();
      }
    }
  }

  // 2) Coarse rolled-steel directional brushing & wire-wheel scuff streaks
  for (let i = 0; i < 520; i++) {
    const sx = (i * 197 + 19) % rmSize;
    const sy = (i * 89 + 53) % rmSize;
    const len = 18 + ((i * 43) % 72);
    const angle = (i % 5 === 0 ? 0.22 : 0.0) + (((i * 17) % 11) - 5) * 0.025;
    const ex = sx + Math.cos(angle) * len;
    const ey = sy + Math.sin(angle) * len;
    const bright = i % 3 === 0;

    rmCtx.strokeStyle = bright ? 'rgba(232, 236, 242, 0.20)' : 'rgba(66, 70, 78, 0.22)';
    rmCtx.lineWidth = bright ? 1.0 : 1.4;
    rmCtx.beginPath();
    rmCtx.moveTo(sx, sy);
    rmCtx.lineTo(ex, ey);
    rmCtx.stroke();

    rmBumpCtx.strokeStyle = bright ? 'rgba(182, 182, 182, 0.42)' : 'rgba(74, 74, 74, 0.46)';
    rmBumpCtx.lineWidth = 1.2;
    rmBumpCtx.beginPath();
    rmBumpCtx.moveTo(sx, sy);
    rmBumpCtx.lineTo(ex, ey);
    rmBumpCtx.stroke();

    // Burnished scratch ridges catch slightly sharper specular highlights
    rmRoughCtx.strokeStyle = bright ? 'rgba(92, 92, 92, 0.42)' : 'rgba(218, 218, 218, 0.30)';
    rmRoughCtx.lineWidth = 1.1;
    rmRoughCtx.beginPath();
    rmRoughCtx.moveTo(sx, sy);
    rmRoughCtx.lineTo(ex, ey);
    rmRoughCtx.stroke();
  }

  // 3) Gritty forged-metal micro-pitting, mill-scale speckles & oxide flecks
  for (let i = 0; i < 4200; i++) {
    const px = (i * 131 + ((i * i) % 199)) % rmSize;
    const py = (i * 227 + ((i * 37) % 211)) % rmSize;
    const sz = i % 9 === 0 ? 2.4 : 1.4;
    if (i % 13 === 0) {
      // Subtle iron-oxide grit fleck
      rmCtx.fillStyle = 'rgba(112, 78, 60, 0.34)';
      rmBumpCtx.fillStyle = 'rgba(56, 56, 56, 0.56)';
      rmRoughCtx.fillStyle = 'rgba(244, 244, 244, 0.58)';
    } else if (i % 2 === 0) {
      // Dark corrosion pit
      rmCtx.fillStyle = 'rgba(58, 62, 72, 0.30)';
      rmBumpCtx.fillStyle = 'rgba(62, 62, 62, 0.52)';
      rmRoughCtx.fillStyle = 'rgba(232, 232, 232, 0.44)';
    } else {
      // Rough metallic grain highlight speck
      rmCtx.fillStyle = 'rgba(226, 230, 238, 0.22)';
      rmBumpCtx.fillStyle = 'rgba(198, 198, 198, 0.48)';
      rmRoughCtx.fillStyle = 'rgba(126, 126, 126, 0.36)';
    }
    rmCtx.fillRect(px, py, sz, sz);
    rmBumpCtx.fillRect(px, py, sz, sz);
    rmRoughCtx.fillRect(px, py, sz, sz);
  }

  const roughMetal = track(finalizeTexture(rmCanvas, maxAniso, 2, 2));
  const roughMetalBump = track(finalizeTexture(rmBumpCanvas, maxAniso, 2, 2, true));
  const roughMetalRoughness = track(finalizeTexture(rmRoughCanvas, maxAniso, 2, 2, true));

  // --- ORGANIC BOTANICAL PLANT LEAF TEXTURE + VEIN BUMP (512x512) ---
  const plSize = 512;
  const plCanvas = document.createElement('canvas');
  plCanvas.width = plSize;
  plCanvas.height = plSize;
  const plCtx = plCanvas.getContext('2d')!;
  const plbCanvas = document.createElement('canvas');
  plbCanvas.width = plSize;
  plbCanvas.height = plSize;
  const plbCtx = plbCanvas.getContext('2d')!;

  const leafGrad = plCtx.createLinearGradient(0, plSize, 0, 0);
  leafGrad.addColorStop(0.0, '#4a7a42');
  leafGrad.addColorStop(0.42, '#629c56');
  leafGrad.addColorStop(0.82, '#78b468');
  leafGrad.addColorStop(1.0, '#8cc878');
  plCtx.fillStyle = leafGrad;
  plCtx.fillRect(0, 0, plSize, plSize);

  plbCtx.fillStyle = '#808080';
  plbCtx.fillRect(0, 0, plSize, plSize);

  // Organic chlorophyll mottling & subtle waxy sheen bands
  for (let i = 0; i < 64; i++) {
    const mx = (i * 137 + 41) % plSize;
    const my = (i * 223 + 29) % plSize;
    const mr = 28 + ((i * 29) % 58);
    const lighter = i % 2 === 0;
    const lg = plCtx.createRadialGradient(mx, my, 4, mx, my, mr);
    lg.addColorStop(0, lighter ? 'rgba(170, 224, 138, 0.18)' : 'rgba(34, 72, 34, 0.16)');
    lg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    plCtx.fillStyle = lg;
    plCtx.beginPath();
    plCtx.arc(mx, my, mr, 0, Math.PI * 2);
    plCtx.fill();
  }

  // Central botanical midrib + curved pinnate lateral leaf veins
  plCtx.strokeStyle = 'rgba(188, 232, 146, 0.56)';
  plCtx.lineWidth = 6.5;
  plCtx.beginPath();
  plCtx.moveTo(plSize * 0.5, plSize);
  plCtx.lineTo(plSize * 0.5, 16);
  plCtx.stroke();

  plbCtx.strokeStyle = 'rgba(235, 235, 235, 0.85)';
  plbCtx.lineWidth = 7.5;
  plbCtx.beginPath();
  plbCtx.moveTo(plSize * 0.5, plSize);
  plbCtx.lineTo(plSize * 0.5, 16);
  plbCtx.stroke();

  for (let v = 0; v < 12; v++) {
    const vy = plSize - 32 - v * 40;
    for (const side of [-1, 1]) {
      const endX = plSize * 0.5 + side * (215 - Math.abs(v - 5) * 14);
      const endY = vy - 76;
      const ctrlX = plSize * 0.5 + side * 95;
      const ctrlY = vy - 18;

      plCtx.strokeStyle = 'rgba(176, 222, 136, 0.34)';
      plCtx.lineWidth = 2.6;
      plCtx.beginPath();
      plCtx.moveTo(plSize * 0.5, vy);
      plCtx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      plCtx.stroke();

      plCtx.strokeStyle = 'rgba(32, 68, 30, 0.18)';
      plCtx.lineWidth = 1.6;
      plCtx.beginPath();
      plCtx.moveTo(plSize * 0.5, vy + 3);
      plCtx.quadraticCurveTo(ctrlX, ctrlY + 3, endX, endY + 3);
      plCtx.stroke();

      plbCtx.strokeStyle = 'rgba(206, 206, 206, 0.64)';
      plbCtx.lineWidth = 3.2;
      plbCtx.beginPath();
      plbCtx.moveTo(plSize * 0.5, vy);
      plbCtx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      plbCtx.stroke();

      plbCtx.strokeStyle = 'rgba(72, 72, 72, 0.40)';
      plbCtx.lineWidth = 2.0;
      plbCtx.beginPath();
      plbCtx.moveTo(plSize * 0.5, vy + 4);
      plbCtx.quadraticCurveTo(ctrlX, ctrlY + 4, endX, endY + 4);
      plbCtx.stroke();
    }
  }
  const plantLeaf = track(finalizeTexture(plCanvas, maxAniso, 1, 1));
  const plantLeafBump = track(finalizeTexture(plbCanvas, maxAniso, 1, 1, true));

  // --- RICH GRANULAR POTTING SOIL TEXTURE + BUMP (512x512) ---
  const psSize = 512;
  const psCanvas = document.createElement('canvas');
  psCanvas.width = psSize;
  psCanvas.height = psSize;
  const psCtx = psCanvas.getContext('2d')!;
  const psbCanvas = document.createElement('canvas');
  psbCanvas.width = psSize;
  psbCanvas.height = psSize;
  const psbCtx = psbCanvas.getContext('2d')!;

  psCtx.fillStyle = '#3b291f';
  psCtx.fillRect(0, 0, psSize, psSize);
  psbCtx.fillStyle = '#747474';
  psbCtx.fillRect(0, 0, psSize, psSize);

  // Damp peat/humus patches
  for (let i = 0; i < 80; i++) {
    const sx = (i * 157 + 23) % psSize;
    const sy = (i * 271 + 61) % psSize;
    const sr = 18 + ((i * 31) % 44);
    const damp = i % 2 === 0;
    const sg = psCtx.createRadialGradient(sx, sy, 2, sx, sy, sr);
    sg.addColorStop(0, damp ? 'rgba(32, 20, 14, 0.45)' : 'rgba(92, 64, 46, 0.34)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    psCtx.fillStyle = sg;
    psCtx.beginPath();
    psCtx.arc(sx, sy, sr, 0, Math.PI * 2);
    psCtx.fill();
  }

  // Organic soil crumbs, bark bits & sparse pale perlite mineral grains
  for (let i = 0; i < 4800; i++) {
    const gx = (i * 131 + ((i * 19) % 197)) % psSize;
    const gy = (i * 229 + ((i * 37) % 211)) % psSize;
    const rad = 1.1 + ((i * 13) % 28) * 0.12;
    if (i % 78 === 0) {
      // Tiny creamy-white perlite mineral speck
      psCtx.fillStyle = 'rgba(218, 206, 188, 0.78)';
      psbCtx.fillStyle = 'rgba(236, 236, 236, 0.85)';
    } else if (i % 11 === 0) {
      // Shredded reddish-brown pine bark bit
      psCtx.fillStyle = 'rgba(116, 76, 48, 0.72)';
      psbCtx.fillStyle = 'rgba(196, 196, 196, 0.72)';
    } else if (i % 3 === 0) {
      // Deep humus crevice
      psCtx.fillStyle = 'rgba(26, 16, 11, 0.76)';
      psbCtx.fillStyle = 'rgba(36, 36, 36, 0.78)';
    } else {
      // Rich dark loam crumb
      psCtx.fillStyle = 'rgba(78, 54, 38, 0.66)';
      psbCtx.fillStyle = 'rgba(164, 164, 164, 0.62)';
    }
    psCtx.beginPath();
    psCtx.arc(gx, gy, rad, 0, Math.PI * 2);
    psCtx.fill();
    psbCtx.beginPath();
    psbCtx.arc(gx, gy, rad * 1.05, 0, Math.PI * 2);
    psbCtx.fill();
  }
  const pottingSoil = track(finalizeTexture(psCanvas, maxAniso, 2, 2));
  const pottingSoilBump = track(finalizeTexture(psbCanvas, maxAniso, 2, 2, true));

  return {
    woodFloor,
    woodFloorBump,
    woodFloorRoughness,
    woodDoor,
    woodDoorBump,
    furnitureOak,
    furnitureWoodBump,
    rugWeave,
    rugBump,
    genkanTile,
    kitchenTile,
    kitchenTileBump,
    kitchenTileRoughness,
    basementTile,
    dirtyRug,
    concrete,
    concreteBump,
    concreteRoughness,
    roughMetal,
    roughMetalBump,
    roughMetalRoughness,
    cushionStripes,
    clockFace,
    tvStandby,
    tvMeta,
    pcTerminal,
    crtBasement,
    arcadeMarquee,
    arcadeScreen,
    arcadeSideArt,
    stickyNote,
    dustMote,
    windowLightGobo,
    wallpaperLiving,
    wainscotWood,
    wainscotWhite,
    wallpaperBedroom,
    wallpaperDining,
    plushFabric,
    plushBump,
    curtainFabric,
    curtainFloralGreen,
    curtainBump,
    sofaTuftMap,
    sofaTuftBump,
    ginghamPillow,
    tableclothPink,
    tableclothLaceTrim,
    barStoolUnionVelvet,
    kitchenBacksplashTile,
    brushedSteel,
    bookCoverAtlas,
    bookCoverBump,
    vinylSleeveAtlas,
    bathroomTile,
    bathroomWall,
    bathPlaidMat,
    plantLeaf,
    plantLeafBump,
    pottingSoil,
    pottingSoilBump,
    animePortraits,
    sofaArtworks,
    all,
  };
}

export interface BloomIntensityController {
  daylightStrength: number;
  sunsetStrength: number;
  nightStrengthRatio: number;
  metaStrength: number;
  threshold: number;
  radius: number;
  applyForMode: (mode: AtmosphereMode, sharedUniforms?: TwilightUniforms) => void;
}

export interface SsaoIntensityController {
  intensity: number;
  ceilingSeamBoost: number;
  furnitureBaseBoost: number;
  setIntensity: (intensity: number, ceilingSeamBoost?: number, furnitureBaseBoost?: number) => void;
  applyToUniforms: (sharedUniforms?: TwilightUniforms) => void;
}

export interface PostProcessingRig {
  composer: EffectComposer;
  unrealBloomPass: UnrealBloomPass;
  unifiedPass: ShaderPass;
  /** Backwards-compatible aliases */
  gradePass: ShaderPass;
  bloomPass: UnrealBloomPass;
  /** Conditional Bloom intensity controller scaling night window/scene bloom by 50% compared to daylight */
  bloomController: BloomIntensityController;
  /** Global SSAO / Ambient Occlusion intensity controller emphasizing ceiling seams & furniture bases */
  ssaoController: SsaoIntensityController;
  /** Master enable flag for post-processing */
  enabled: boolean;
  /** When true, post-processing is automatically bypassed in normal (non-anomaly) states */
  disableInNormalState: boolean;
  setEnabled: (enabled: boolean) => void;
  setDisableInNormalState: (disableInNormal: boolean) => void;
  shouldRender: (atmosphere: AtmosphereMode, metaGlitchTimer: number) => boolean;
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

/**
 * UnifiedTwilightPostShader:
 * Works in tandem with Three.js's multi-mip UnrealBloomPass (threshold=0.72, strength=0.28, radius=0.95)
 * to deliver MiSide's dreamy warm peach-cream airiness, ~1px same-hue darkened anti-aliased contour,
 * global SSAO shadow depth at ceiling seams & furniture bases, and Meta anomaly effects.
 */
const UnifiedTwilightPostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uTime: { value: 0 },
    uMetaIntensity: { value: 0 },
    uDaylightFactor: { value: 1.0 },
    uBloomStrength: { value: 0.28 },
    uSsaoIntensity: { value: 1.25 },
    uVignette: { value: 0.28 },
    uOutlineEnabled: { value: 1.0 },
    uFisheye: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexelSize;
    uniform float uTime;
    uniform float uMetaIntensity;
    uniform float uDaylightFactor;
    uniform float uBloomStrength;
    uniform float uSsaoIntensity;
    uniform float uVignette;
    uniform float uOutlineEnabled;
    uniform float uFisheye;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;

      // 0. Subtle wide-angle radial Fisheye distortion for Non-Euclidean Corridor immersion
      if (abs(uFisheye) > 0.0005) {
        vec2 p = uv * 2.0 - 1.0;
        float r2 = dot(p, p);
        float k = uFisheye;
        float zoom = 1.0 / (1.0 + abs(k) * 0.85);
        vec2 warped = p * (1.0 + k * r2) * zoom;
        uv = clamp(warped * 0.5 + 0.5, vec2(0.001), vec2(0.999));
      }

      vec2 dir = uv - 0.5;
      float dist = length(dir);

      // 1. Glitch horizontal tearing & radial chromatic aberration (single sample when calm for speed)
      vec3 col;
      if (uMetaIntensity > 0.04) {
        float ca = 0.00014 + uMetaIntensity * (0.008 + 0.004 * sin(uTime * 19.0));
        float tear = step(0.92, fract(sin(floor(uv.y * 42.0) * 19.3 + floor(uTime * 14.0)) * 43758.5));
        uv.x += tear * (sin(uTime * 40.0) * 0.015 * uMetaIntensity);
        float r = texture2D(tDiffuse, uv - dir * ca * dist).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv + dir * ca * dist).b;
        col = vec3(r, g, b);
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }
      col = clamp(col, vec3(0.0), vec3(1.25));

      // 1b. Fast single-ring 4-tap 1px MiSide Anti-Aliased Same-Hue Contour + Soft Crevice AO
      vec2 step1 = uTexelSize * 0.85;
      vec3 cN = texture2D(tDiffuse, uv + vec2(0.0, step1.y)).rgb;
      vec3 cS = texture2D(tDiffuse, uv - vec2(0.0, step1.y)).rgb;
      vec3 cE = texture2D(tDiffuse, uv + vec2(step1.x, 0.0)).rgb;
      vec3 cW = texture2D(tDiffuse, uv - vec2(step1.x, 0.0)).rgb;
      vec3 avgN = 0.25 * (cN + cS + cE + cW);

      if (uOutlineEnabled > 0.5) {
        float edge1px = smoothstep(0.075, 0.24, length(cE - cW) + length(cN - cS));
        float localLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        float bloomAtten = 1.0 - smoothstep(0.68, 0.94, localLum);

        vec3 darkestNeighbor = min(col, min(min(cN, cS), min(cE, cW)));
        float maxC = max(darkestNeighbor.r, max(darkestNeighbor.g, darkestNeighbor.b));
        float minC = min(darkestNeighbor.r, min(darkestNeighbor.g, darkestNeighbor.b));
        float sat = (maxC - minC) / max(maxC, 0.001);
        float darkLum = dot(darkestNeighbor, vec3(0.2126, 0.7152, 0.0722));
        float isWhite = smoothstep(0.58, 0.84, darkLum) * (1.0 - smoothstep(0.10, 0.26, sat));
        float isGreen = smoothstep(0.03, 0.14, darkestNeighbor.g - max(darkestNeighbor.r, darkestNeighbor.b));

        vec3 darkWoodShadow = darkestNeighbor * vec3(0.52, 0.42, 0.38);
        vec3 darkLavenderShadow = darkestNeighbor * vec3(0.54, 0.48, 0.62);
        vec3 darkForestGreen = darkestNeighbor * vec3(0.36, 0.52, 0.40);
        vec3 outlineTarget = mix(darkWoodShadow, darkLavenderShadow, isWhite * 0.88);
        outlineTarget = mix(outlineTarget, darkForestGreen, isGreen * 0.90);
        outlineTarget = min(outlineTarget, col * 0.66);

        col = mix(col, outlineTarget, edge1px * bloomAtten * 0.34);
      }

      // Gentle screen-space crevice shading
      float localCrevice = max(0.0, dot(avgN - col, vec3(0.333)));
      col *= 1.0 - clamp(localCrevice * 0.66 * uSsaoIntensity, 0.0, 0.24);

      // 2. Psychological-horror CRT scanline modulation during anomaly
      if (uMetaIntensity > 0.01) {
        float scan = 1.0 - uMetaIntensity * 0.08 * (0.5 + 0.5 * sin(uv.y * 540.0 + uTime * 8.0));
        col *= scan;
      }

      // 3. Soft MiSide Color Grading & Vignette
      if (uDaylightFactor > 0.5) {
        float dayLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(dayLum), col, 0.98);
        col *= vec3(1.01, 1.00, 0.995);
        float dayVig = smoothstep(1.12, 0.28, dist * (1.0 + uVignette * 0.28));
        col *= mix(1.0, dayVig, 0.10);
      } else {
        float postLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(postLum), col, 0.96);
        float vig = smoothstep(1.06, 0.26, dist * (1.0 + uVignette * 0.32));
        col *= mix(1.0, vig, 0.16 + uMetaIntensity * 0.42);
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number
): PostProcessingRig {
  const composerTarget = new THREE.WebGLRenderTarget(
    Math.max(1, width),
    Math.max(1, height),
    {
      type: THREE.HalfFloatType,
      stencilBuffer: false,
    }
  );
  const composer = new EffectComposer(renderer, composerTarget);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Half-resolution Wide-Radius Soft Bloom Pass (cuts Bloom fill-rate by 75% while staying silky soft!)
  const bloomW = Math.max(64, Math.floor(width * 0.5));
  const bloomH = Math.max(64, Math.floor(height * 0.5));
  const unrealBloomPass = new UnrealBloomPass(
    new THREE.Vector2(bloomW, bloomH),
    0.26, // strength
    0.92, // radius
    0.72  // threshold
  );
  composer.addPass(unrealBloomPass);

  const unifiedPass = new ShaderPass(UnifiedTwilightPostShader);
  unifiedPass.uniforms.uTexelSize.value.set(
    1 / Math.max(1, width),
    1 / Math.max(1, height)
  );
  composer.addPass(unifiedPass);

  const bloomController: BloomIntensityController = {
    daylightStrength: 0.28,
    sunsetStrength: 0.26,
    nightStrengthRatio: 0.50, // 50% reduction in night state compared to daylight!
    metaStrength: 0.30,
    threshold: 0.72,
    radius: 0.95,
    applyForMode: (mode: AtmosphereMode, sharedUniforms?: TwilightUniforms) => {
      unrealBloomPass.threshold = bloomController.threshold;
      unrealBloomPass.radius = bloomController.radius;
      if (mode === 'daylight') {
        unrealBloomPass.strength = bloomController.daylightStrength;
        unifiedPass.uniforms.uDaylightFactor.value = 1.0;
        unifiedPass.uniforms.uBloomStrength.value = bloomController.daylightStrength;
        if (sharedUniforms) {
          sharedUniforms.uNightFactor.value = 0.0;
          sharedUniforms.uWindowBloomScale.value = 1.0;
        }
      } else if (mode === 'sunset') {
        unrealBloomPass.strength = bloomController.sunsetStrength;
        unifiedPass.uniforms.uDaylightFactor.value = 0.0;
        unifiedPass.uniforms.uBloomStrength.value = bloomController.sunsetStrength;
        if (sharedUniforms) {
          sharedUniforms.uNightFactor.value = 0.15;
          sharedUniforms.uWindowBloomScale.value = 0.85;
        }
      } else if (mode === 'midnight') {
        // Gentle dreamy moonlit Bloom in midnight state (soft glow around moonlight window & crescent moon!)
        const nightStrength = bloomController.daylightStrength * 0.68;
        unrealBloomPass.strength = nightStrength;
        unifiedPass.uniforms.uDaylightFactor.value = 0.0;
        unifiedPass.uniforms.uBloomStrength.value = nightStrength;
        if (sharedUniforms) {
          sharedUniforms.uNightFactor.value = 1.0;
          sharedUniforms.uWindowBloomScale.value = 0.72;
        }
      } else {
        unrealBloomPass.strength = bloomController.metaStrength;
        unifiedPass.uniforms.uDaylightFactor.value = 0.0;
        unifiedPass.uniforms.uBloomStrength.value = bloomController.metaStrength;
        if (sharedUniforms) {
          sharedUniforms.uNightFactor.value = 0.40;
          sharedUniforms.uWindowBloomScale.value = 0.70;
        }
      }
    },
  };

  const ssaoController: SsaoIntensityController = {
    intensity: 1.25,
    ceilingSeamBoost: 1.38,
    furnitureBaseBoost: 1.42,
    setIntensity: (
      intensity: number,
      ceilingSeamBoost = ssaoController.ceilingSeamBoost,
      furnitureBaseBoost = ssaoController.furnitureBaseBoost
    ) => {
      ssaoController.intensity = THREE.MathUtils.clamp(intensity, 0.4, 2.5);
      ssaoController.ceilingSeamBoost = THREE.MathUtils.clamp(ceilingSeamBoost, 0.6, 2.5);
      ssaoController.furnitureBaseBoost = THREE.MathUtils.clamp(furnitureBaseBoost, 0.6, 2.5);
      unifiedPass.uniforms.uSsaoIntensity.value = ssaoController.intensity;
    },
    applyToUniforms: (sharedUniforms?: TwilightUniforms) => {
      unifiedPass.uniforms.uSsaoIntensity.value = ssaoController.intensity;
      if (sharedUniforms) {
        sharedUniforms.uSsaoIntensity.value = ssaoController.intensity;
        sharedUniforms.uCeilingAoBoost.value = ssaoController.ceilingSeamBoost;
        sharedUniforms.uBaseAoBoost.value = ssaoController.furnitureBaseBoost;
      }
    },
  };

  const rig: PostProcessingRig = {
    composer,
    unrealBloomPass,
    unifiedPass,
    gradePass: unifiedPass,
    bloomPass: unrealBloomPass,
    bloomController,
    ssaoController,
    enabled: true,
    disableInNormalState: false,
    setEnabled: (enabled: boolean) => {
      rig.enabled = enabled;
    },
    setDisableInNormalState: (disableInNormal: boolean) => {
      rig.disableInNormalState = disableInNormal;
    },
    shouldRender: (atmosphere: AtmosphereMode, metaGlitchTimer: number): boolean => {
      if (!rig.enabled) return false;
      const isFisheyeActive = Math.abs(unifiedPass.uniforms.uFisheye.value) > 0.0005;
      const isAnomaly = atmosphere === 'meta' || metaGlitchTimer > 0.001 || isFisheyeActive;
      if (rig.disableInNormalState && !isAnomaly) {
        return false;
      }
      return true;
    },
    resize: (w: number, h: number) => {
      composer.setSize(w, h);
      unrealBloomPass.resolution.set(
        Math.max(64, Math.floor(w * 0.5)),
        Math.max(64, Math.floor(h * 0.5))
      );
      unifiedPass.uniforms.uTexelSize.value.set(
        1 / Math.max(1, w),
        1 / Math.max(1, h)
      );
    },
    dispose: () => {
      unrealBloomPass.dispose();
      composer.dispose();
    },
  };

  return rig;
}

