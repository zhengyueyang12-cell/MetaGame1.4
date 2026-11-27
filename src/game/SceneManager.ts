import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import type { OutlineRegistry } from './pipeline';
import type { CeilingLampRig } from './rooms/roomContext';
import type { DoorController, RoomId, ViewMode } from './types';

const ALL_ROOMS: RoomId[] = [
  'living',
  'entryway',
  'dining',
  'kitchen',
  'bedroom',
  'bathroom',
  'basement',
];

// Shared invisible material for Layer-1 raycast proxy boxes (0 GPU draw calls!)
const _invisibleRaycastMat = new THREE.MeshBasicMaterial({
  visible: false,
});

const _tmpBox = new THREE.Box3();
const _tmpSize = new THREE.Vector3();
const _tmpCenter = new THREE.Vector3();

/**
 * Normalizes a BufferGeometry so that all geometries passed to
 * BufferGeometryUtils.mergeGeometries share the exact same attribute layout:
 * - position (vec3, room/world space)
 * - normal (vec3, room/world space)
 * - uv (vec2)
 * - aOrigPos (vec3, pre-merge local coordinates for procedural wood-lacquer shader)
 * - aOrigNormal (vec3, pre-merge local normal for procedural wood-lacquer shader)
 */
export function normalizeGeometryForMerge(
  sourceGeo: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4
): THREE.BufferGeometry {
  const geo = sourceGeo.index ? sourceGeo.toNonIndexed() : sourceGeo.clone();

  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  const vertCount = posAttr.count;

  // Store pre-merge local position and local normal for shader wood-lacquer gradients
  const origPosArray = new Float32Array(vertCount * 3);
  const origNormArray = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    const i3 = i * 3;
    origPosArray[i3] = posAttr.getX(i);
    origPosArray[i3 + 1] = posAttr.getY(i);
    origPosArray[i3 + 2] = posAttr.getZ(i);

    let nx = normAttr.getX(i);
    let ny = normAttr.getY(i);
    let nz = normAttr.getZ(i);
    const lenSq = nx * nx + ny * ny + nz * nz;
    if (!(lenSq > 1e-6)) {
      nx = 0;
      ny = 1;
      nz = 0;
      normAttr.setXYZ(i, 0, 1, 0);
    } else {
      const invLen = 1 / Math.sqrt(lenSq);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;
      normAttr.setXYZ(i, nx, ny, nz);
    }

    origNormArray[i3] = nx;
    origNormArray[i3 + 1] = ny;
    origNormArray[i3 + 2] = nz;
  }

  // Transform position & normal into target group coordinate space (in-place on fresh non-indexed geo)
  geo.applyMatrix4(worldMatrix);

  const worldNormAttr = geo.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < vertCount; i++) {
    const wx = worldNormAttr.getX(i);
    const wy = worldNormAttr.getY(i);
    const wz = worldNormAttr.getZ(i);
    const wLenSq = wx * wx + wy * wy + wz * wz;
    if (!(wLenSq > 1e-6)) {
      worldNormAttr.setXYZ(i, 0, 1, 0);
    }
  }

  let uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uvAttr || uvAttr.itemSize !== 2) {
    uvAttr = new THREE.BufferAttribute(new Float32Array(vertCount * 2), 2);
  }

  // Strip any extra/mismatched attributes and reuse the already-allocated buffers directly (no double-cloning!)
  for (const attrName of Object.keys(geo.attributes)) {
    if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
      geo.deleteAttribute(attrName);
    }
  }
  geo.setAttribute('uv', uvAttr);
  geo.setAttribute('aOrigPos', new THREE.BufferAttribute(origPosArray, 3));
  geo.setAttribute('aOrigNormal', new THREE.BufferAttribute(origNormArray, 3));
  geo.clearGroups();
  return geo;
}

/**
 * Merges all static THREE.Mesh descendants inside `rootGroup` into a SINGLE
 * multi-material BufferGeometry (`BufferGeometryUtils.mergeGeometries(..., true)`)
 * while preserving:
 * - Dynamic objects (`userData.dynamic === true`, `InstancedMesh`, hinged doors)
 * - Layer-1 interactive targets (replaced by lightweight 12-triangle invisible AABB proxy boxes)
 * - Merged ink outlines (all static outlines merged into 1 single outline mesh)
 */
export function mergeStaticGroupToSingleMesh(
  rootGroup: THREE.Group,
  outlines: OutlineRegistry,
  meshName = 'MergedStaticGeometry'
): THREE.Mesh | null {
  rootGroup.updateMatrixWorld(true);
  const rootInverse = rootGroup.matrixWorld.clone().invert();

  // Collect dynamic subtrees (e.g., hinged cabinet doors, TV screen, uncanny silhouette)
  const dynamicRoots = new Set<THREE.Object3D>();
  rootGroup.traverse((obj) => {
    if (obj.userData?.dynamic) {
      dynamicRoots.add(obj);
    }
  });

  const isInsideDynamicSubtree = (obj: THREE.Object3D): boolean => {
    let curr: THREE.Object3D | null = obj;
    while (curr && curr !== rootGroup) {
      if (dynamicRoots.has(curr)) return true;
      curr = curr.parent;
    }
    return false;
  };

  // Create lightweight invisible Layer-1 AABB raycast proxies for static interactables
  const interactRoots: THREE.Object3D[] = [];
  rootGroup.traverse((obj) => {
    if (
      obj !== rootGroup &&
      obj.userData?.interactId &&
      !isInsideDynamicSubtree(obj)
    ) {
      interactRoots.push(obj);
    }
  });

  const proxyMeshes: THREE.Mesh[] = [];
  for (const target of interactRoots) {
    _tmpBox.makeEmpty();
    target.traverse((child) => {
      const m = child as THREE.Mesh;
      if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !m.name.endsWith('_outline')) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        if (m.geometry.boundingBox) {
          const b = m.geometry.boundingBox.clone();
          const relMat = new THREE.Matrix4().multiplyMatrices(rootInverse, m.matrixWorld);
          b.applyMatrix4(relMat);
          _tmpBox.union(b);
        }
      }
    });

    if (!_tmpBox.isEmpty()) {
      _tmpBox.getSize(_tmpSize);
      _tmpBox.getCenter(_tmpCenter);
      const proxyGeo = new THREE.BoxGeometry(
        Math.max(0.08, _tmpSize.x + 0.04),
        Math.max(0.08, _tmpSize.y + 0.04),
        Math.max(0.08, _tmpSize.z + 0.04)
      );
      const proxyMesh = new THREE.Mesh(proxyGeo, _invisibleRaycastMat);
      proxyMesh.name = `raycast_proxy_${target.userData.interactId}`;
      proxyMesh.position.copy(_tmpCenter);
      proxyMesh.userData.interactId = target.userData.interactId;
      proxyMesh.userData.dynamic = true;
      proxyMesh.layers.set(1);
      proxyMeshes.push(proxyMesh);
    }
  }

  // Group static meshes (including static InstancedMeshes!) by material and collect static outline geometries
  const casterBuckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const receiverOnlyBuckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const outlineGeos: THREE.BufferGeometry[] = [];
  const meshesToRemove: THREE.Mesh[] = [];
  const _instMat = new THREE.Matrix4();
  const _instRelMat = new THREE.Matrix4();

  const isInsideDynamicAncestor = (obj: THREE.Object3D): boolean => {
    let curr: THREE.Object3D | null = obj.parent;
    while (curr && curr !== rootGroup) {
      if (dynamicRoots.has(curr)) return true;
      curr = curr.parent;
    }
    return false;
  };

  rootGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;

    // Bake static InstancedMeshes straight into the merged room mesh to eliminate extra draw calls
    // (Preserve InstancedMeshes that rely on per-instance vertex colorTint or runtime animation!)
    if ((mesh as THREE.InstancedMesh).isInstancedMesh) {
      const inst = mesh as THREE.InstancedMesh;
      if (inst.userData?.animatedInstance || inst.instanceColor || isInsideDynamicAncestor(inst)) {
        return;
      }
      const mat = inst.material as THREE.Material;
      const targetMap = inst.castShadow ? casterBuckets : receiverOnlyBuckets;
      let bucket = targetMap.get(mat);
      if (!bucket) {
        bucket = [];
        targetMap.set(mat, bucket);
      }
      const relBase = new THREE.Matrix4().multiplyMatrices(rootInverse, inst.matrixWorld);
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, _instMat);
        _instRelMat.multiplyMatrices(relBase, _instMat);
        bucket.push(normalizeGeometryForMerge(inst.geometry, _instRelMat));
      }
      meshesToRemove.push(inst);
      return;
    }

    if (isInsideDynamicSubtree(mesh)) return;

    const relMatrix = new THREE.Matrix4().multiplyMatrices(
      rootInverse,
      mesh.matrixWorld
    );

    if (mesh.name.endsWith('_outline')) {
      const normGeo = normalizeGeometryForMerge(mesh.geometry, relMatrix);
      const savedCol =
        (mesh.userData.outlineColor as THREE.Color | undefined) ??
        ((mesh.material as THREE.ShaderMaterial)?.uniforms?.uOutlineColor?.value as
          | THREE.Color
          | undefined);
      const r = savedCol ? savedCol.r : 0.11;
      const g = savedCol ? savedCol.g : 0.068;
      const b = savedCol ? savedCol.b : 0.052;
      const vCount = normGeo.attributes.position.count;
      const colArr = new Float32Array(vCount * 3);
      for (let vi = 0; vi < vCount; vi++) {
        colArr[vi * 3] = r;
        colArr[vi * 3 + 1] = g;
        colArr[vi * 3 + 2] = b;
      }
      normGeo.setAttribute('aOutlineColor', new THREE.BufferAttribute(colArr, 3));
      outlineGeos.push(normGeo);
      meshesToRemove.push(mesh);
      return;
    }

    const mat = mesh.material as THREE.Material;
    const targetMap = mesh.castShadow ? casterBuckets : receiverOnlyBuckets;
    let bucket = targetMap.get(mat);
    if (!bucket) {
      bucket = [];
      targetMap.set(mat, bucket);
    }
    bucket.push(normalizeGeometryForMerge(mesh.geometry, relMatrix));
    meshesToRemove.push(mesh);
  });

  if (casterBuckets.size === 0 && receiverOnlyBuckets.size === 0) {
    return null;
  }

  const buildMergedBucketMesh = (
    buckets: Map<THREE.Material, THREE.BufferGeometry[]>,
    name: string,
    castsShadow: boolean
  ): THREE.Mesh | null => {
    if (buckets.size === 0) return null;
    const perMaterialMergedGeos: THREE.BufferGeometry[] = [];
    const materialsArray: THREE.Material[] = [];

    for (const [mat, geos] of buckets.entries()) {
      if (geos.length === 0) continue;
      const matGeo =
        geos.length === 1
          ? geos[0]
          : BufferGeometryUtils.mergeGeometries(geos, false);
      if (geos.length > 1) {
        for (const g of geos) g.dispose();
      }
      if (matGeo) {
        perMaterialMergedGeos.push(matGeo);
        materialsArray.push(mat);
      }
    }

    if (perMaterialMergedGeos.length === 0) return null;
    const singleMergedGeo = BufferGeometryUtils.mergeGeometries(
      perMaterialMergedGeos,
      true
    );
    for (const g of perMaterialMergedGeos) {
      g.dispose();
    }
    if (!singleMergedGeo) return null;

    singleMergedGeo.computeBoundingBox();
    singleMergedGeo.computeBoundingSphere();

    const merged = new THREE.Mesh(singleMergedGeo, materialsArray);
    merged.name = name;
    merged.castShadow = castsShadow;
    merged.receiveShadow = true;
    merged.matrixAutoUpdate = false;
    merged.updateMatrix();
    rootGroup.add(merged);
    return merged;
  };

  const mergedCasterMesh = buildMergedBucketMesh(casterBuckets, meshName, true);
  const mergedReceiverMesh = buildMergedBucketMesh(
    receiverOnlyBuckets,
    `${meshName}_NoCast`,
    false
  );
  const mergedMesh = mergedCasterMesh ?? mergedReceiverMesh;
  if (!mergedMesh) {
    return null;
  }

  // 2. Merge all static outline meshes into a single outline Mesh
  if (outlineGeos.length > 0) {
    const mergedOutlineGeo = BufferGeometryUtils.mergeGeometries(
      outlineGeos,
      false
    );
    for (const g of outlineGeos) g.dispose();
    if (mergedOutlineGeo) {
      mergedOutlineGeo.computeBoundingSphere();
      outlines.addMergedOutlineGeometry(mergedOutlineGeo, rootGroup, `${meshName}_outlines`);
    }
  }

  // 3. Remove original unmerged static meshes and prune empty static groups
  const outlineSet = new Set(meshesToRemove);
  outlines.removeDisposedOutlines(outlineSet);

  for (const m of meshesToRemove) {
    m.parent?.remove(m);
    m.geometry.dispose();
  }

  // Attach the zero-draw-call Layer-1 raycast proxy boxes
  for (const proxy of proxyMeshes) {
    rootGroup.add(proxy);
  }

  return mergedMesh;
}

/**
 * Merges all static child meshes inside a moving/pivoting rigid group (such as a room door leaf,
 * cabinet door leaf, or tabletop trinket prop) into ONE multi-material Mesh + ONE outline Mesh,
 * cutting 150+ small dynamic draw calls down to ~1 per animated object without altering motion.
 */
export function mergeDynamicSubtreeMeshes(
  rigidGroup: THREE.Object3D,
  outlines: OutlineRegistry,
  meshName = 'MergedRigidProp'
): THREE.Mesh | null {
  rigidGroup.updateMatrixWorld(true);
  const rootInverse = rigidGroup.matrixWorld.clone().invert();

  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const outlineGeos: THREE.BufferGeometry[] = [];
  const meshesToRemove: THREE.Mesh[] = [];
  let anyCastsShadow = false;

  rigidGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
    if (Array.isArray(mesh.material)) return;
    const relMatrix = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);

    if (mesh.name.endsWith('_outline')) {
      const normGeo = normalizeGeometryForMerge(mesh.geometry, relMatrix);
      const savedCol =
        (mesh.userData.outlineColor as THREE.Color | undefined) ??
        ((mesh.material as THREE.ShaderMaterial)?.uniforms?.uOutlineColor?.value as
          | THREE.Color
          | undefined);
      const r = savedCol ? savedCol.r : 0.11;
      const g = savedCol ? savedCol.g : 0.068;
      const b = savedCol ? savedCol.b : 0.052;
      const vCount = normGeo.attributes.position.count;
      const colArr = new Float32Array(vCount * 3);
      for (let vi = 0; vi < vCount; vi++) {
        colArr[vi * 3] = r;
        colArr[vi * 3 + 1] = g;
        colArr[vi * 3 + 2] = b;
      }
      normGeo.setAttribute('aOutlineColor', new THREE.BufferAttribute(colArr, 3));
      outlineGeos.push(normGeo);
      meshesToRemove.push(mesh);
      return;
    }

    const mat = mesh.material as THREE.Material;
    if (mat.transparent) return;
    if (mesh.castShadow) anyCastsShadow = true;
    let list = buckets.get(mat);
    if (!list) {
      list = [];
      buckets.set(mat, list);
    }
    list.push(normalizeGeometryForMerge(mesh.geometry, relMatrix));
    meshesToRemove.push(mesh);
  });

  if (meshesToRemove.length <= 1) return null;

  const perMatGeos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  for (const [mat, geos] of buckets.entries()) {
    if (geos.length === 0) continue;
    const g = geos.length === 1 ? geos[0] : BufferGeometryUtils.mergeGeometries(geos, false);
    if (geos.length > 1) {
      for (const item of geos) item.dispose();
    }
    if (g) {
      perMatGeos.push(g);
      mats.push(mat);
    }
  }
  if (perMatGeos.length === 0) return null;

  const finalGeo =
    perMatGeos.length === 1
      ? perMatGeos[0]
      : BufferGeometryUtils.mergeGeometries(perMatGeos, true);
  if (perMatGeos.length > 1) {
    for (const g of perMatGeos) g.dispose();
  }
  if (!finalGeo) return null;

  finalGeo.computeBoundingBox();
  finalGeo.computeBoundingSphere();

  const merged = new THREE.Mesh(finalGeo, mats.length === 1 ? mats[0] : mats);
  merged.name = meshName;
  merged.castShadow = anyCastsShadow;
  merged.receiveShadow = true;
  rigidGroup.add(merged);

  if (outlineGeos.length > 0) {
    const mergedOutlineGeo =
      outlineGeos.length === 1
        ? outlineGeos[0]
        : BufferGeometryUtils.mergeGeometries(outlineGeos, false);
    if (outlineGeos.length > 1) {
      for (const g of outlineGeos) g.dispose();
    }
    if (mergedOutlineGeo) {
      mergedOutlineGeo.computeBoundingSphere();
      outlines.addMergedOutlineGeometry(mergedOutlineGeo, rigidGroup, `${meshName}_outlines`);
    }
  }

  const removedSet = new Set(meshesToRemove);
  outlines.removeDisposedOutlines(removedSet);
  for (const m of meshesToRemove) {
    m.parent?.remove(m);
    m.geometry.dispose();
  }

  return merged;
}

/**
 * SceneManager: Performs stutter-free room-based Portal / PVS (Potentially Visible Set)
 * visibility culling based on the player's current room, coordinates, and door states.
 * Never detaches scene graphs or toggles GPU Light.visible (which would trigger synchronous
 * WebGL NUM_POINT_LIGHTS shader recompilation stalls!).
 */
export class SceneManager {
  private scene: THREE.Scene;
  private roomGroups = new Map<RoomId, THREE.Group>();
  private roomExtraObjects = new Map<RoomId, THREE.Object3D[]>();
  private visibleRooms = new Set<RoomId>(ALL_ROOMS);
  private detachFromScene = false;
  private cullingEnabled = true;

  constructor(scene: THREE.Scene, detachFromScene = false) {
    this.scene = scene;
    this.detachFromScene = detachFromScene;
    for (const r of ALL_ROOMS) {
      this.roomExtraObjects.set(r, []);
    }
  }

  public registerRoomGroup(room: RoomId, group: THREE.Group): void {
    group.userData.roomId = room;
    this.roomGroups.set(room, group);
    if (group.parent !== this.scene) {
      this.scene.add(group);
    }
  }

  public registerRoomObject(room: RoomId, obj: THREE.Object3D): void {
    const list = this.roomExtraObjects.get(room);
    if (list) list.push(obj);
  }

  public setCullingEnabled(enabled: boolean): void {
    this.cullingEnabled = enabled;
  }

  public setDetachFromScene(detach: boolean): void {
    this.detachFromScene = detach;
  }

  public isRoomVisible(room: RoomId): boolean {
    return this.visibleRooms.has(room);
  }

  public getRoomGroups(): Map<RoomId, THREE.Group> {
    return this.roomGroups;
  }

  public getVisibleRooms(): RoomId[] {
    return Array.from(this.visibleRooms);
  }

  /**
   * Computes the Potentially Visible Set (PVS) of rooms from the player's
   * current room and real-time door open/closed states, then updates
   * `visible` and attaches/detaches room groups from the scene graph.
   */
  public updateVisibility(
    currentRoom: RoomId,
    playerFeetPos: THREE.Vector3,
    viewMode: ViewMode,
    doors: DoorController[],
    ceilingLamps: CeilingLampRig[]
  ): boolean {
    // In birds-eye overview mode or when culling is disabled, show all rooms
    if (viewMode === 'overview' || !this.cullingEnabled) {
      return this.applyVisibleSet(new Set(ALL_ROOMS), ceilingLamps);
    }

    const bedroomDoorOpen = this.isDoorOpen(doors, 'door_bedroom');
    const basementDoorOpen = this.isDoorOpen(doors, 'door_basement');
    const livingDoorOpen = this.isDoorOpen(doors, 'door_living_dining');
    const bathroomDoorOpen = this.isDoorOpen(doors, 'door_bathroom');

    const pvs = new Set<RoomId>();
    pvs.add(currentRoom);

    switch (currentRoom) {
      case 'living': {
        // Living room is enclosed from Dining & Kitchen at Z = 0.25 by door_living_dining
        if (livingDoorOpen || playerFeetPos.z > -0.45) {
          pvs.add('dining');
          pvs.add('kitchen');
          pvs.add('entryway');
          if (basementDoorOpen && playerFeetPos.x < 3.4) {
            pvs.add('basement');
          }
        }
        // Bedroom is behind the X = -1.22 partition wall; only visible if bedroom door is open or ajar
        if (bedroomDoorOpen) {
          pvs.add('bedroom');
        }
        // Bathroom is behind the Z = -10.40 north wall; visible when bathroom door is open or ajar
        if (bathroomDoorOpen || playerFeetPos.z < -9.85) {
          pvs.add('bathroom');
        }
        break;
      }

      case 'bathroom': {
        if (bathroomDoorOpen || playerFeetPos.z > -10.95) {
          pvs.add('living');
          if (livingDoorOpen) {
            pvs.add('dining');
          }
          if (bedroomDoorOpen) {
            pvs.add('bedroom');
          }
        }
        break;
      }

      case 'bedroom': {
        // Inside bedroom: if the bedroom door is closed, all other 5 rooms are 100% occluded!
        if (bedroomDoorOpen || playerFeetPos.x > -1.65) {
          pvs.add('living');
          if (livingDoorOpen && playerFeetPos.x > -2.7) {
            pvs.add('dining');
            pvs.add('entryway');
            if (basementDoorOpen) {
              pvs.add('basement');
            }
          }
        }
        break;
      }

      case 'basement': {
        // Inside basement storage / stairwell: connected directly to Dining at X = -2.70, Z = 0.78..1.92
        if (basementDoorOpen || playerFeetPos.y > -0.65) {
          pvs.add('dining');
          pvs.add('entryway');
          pvs.add('kitchen');
          if (livingDoorOpen || playerFeetPos.z < 0.85) {
            pvs.add('living');
          }
        }
        break;
      }

      case 'entryway': {
        // Open-plan sightline runs straight East through the Entryway archway -> Dining -> Kitchen
        pvs.add('dining');
        pvs.add('kitchen');
        if (livingDoorOpen && playerFeetPos.z < 2.7) {
          pvs.add('living');
        }
        if (basementDoorOpen) {
          pvs.add('basement');
        }
        if (bedroomDoorOpen && livingDoorOpen && playerFeetPos.x > -3.9) {
          pvs.add('bedroom');
        }
        break;
      }

      case 'dining': {
        pvs.add('kitchen');
        pvs.add('entryway');
        if (livingDoorOpen || playerFeetPos.z < 0.92) {
          pvs.add('living');
        }
        if (basementDoorOpen) {
          pvs.add('basement');
        }
        if (bedroomDoorOpen && livingDoorOpen && playerFeetPos.z < 1.5) {
          pvs.add('bedroom');
        }
        break;
      }

      case 'kitchen': {
        // Direct open sightline straight West across Dining & Entryway archway to the front door
        pvs.add('dining');
        pvs.add('entryway');
        if (livingDoorOpen || playerFeetPos.z < 0.92) {
          pvs.add('living');
        }
        if (basementDoorOpen && playerFeetPos.x < 4.4) {
          pvs.add('basement');
        }
        if (bedroomDoorOpen && livingDoorOpen && playerFeetPos.z < 1.25) {
          pvs.add('bedroom');
        }
        break;
      }
    }

    return this.applyVisibleSet(pvs, ceilingLamps);
  }

  private isDoorOpen(doors: DoorController[], doorId: string): boolean {
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i];
      if (d.id === doorId) {
        return d.isOpen || Math.abs(d.currentAngle - d.closedAngle) > 0.04;
      }
    }
    return false;
  }

  private applyVisibleSet(
    nextVisible: Set<RoomId>,
    _ceilingLamps: CeilingLampRig[]
  ): boolean {
    let changed = false;
    this.visibleRooms = nextVisible;

    for (const room of ALL_ROOMS) {
      const isVis = nextVisible.has(room);
      const group = this.roomGroups.get(room);
      if (group) {
        if (group.visible !== isVis) {
          group.visible = isVis;
          changed = true;
        }
        // Keep room groups attached so Three.js never rebuilds scene graphs or recompiles light shaders!
        if (this.detachFromScene) {
          if (isVis && group.parent !== this.scene) {
            this.scene.add(group);
          } else if (!isVis && group.parent === this.scene) {
            this.scene.remove(group);
          }
        }
      }

      const extras = this.roomExtraObjects.get(room);
      if (extras) {
        for (let i = 0; i < extras.length; i++) {
          // Never toggle .visible on THREE.Light objects (would trigger synchronous WebGL shader recompile!)
          if (!(extras[i] as THREE.Light).isLight) {
            if (extras[i].visible !== isVis) {
              extras[i].visible = isVis;
              changed = true;
            }
          }
        }
      }
    }

    return changed;
  }
}
