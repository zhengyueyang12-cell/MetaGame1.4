import type { AABB, RoomId } from './types';

export class CollisionWorld {
  private boxes: Map<string, AABB> = new Map();

  addBox(box: Omit<AABB, 'enabled'> & { enabled?: boolean }): void {
    this.boxes.set(box.id, {
      ...box,
      enabled: box.enabled ?? true,
    });
  }

  setEnabled(id: string, enabled: boolean): void {
    const box = this.boxes.get(id);
    if (box) {
      box.enabled = enabled;
    }
  }

  /**
   * Computes walkable floor elevation at (x, z) given the player's current feet Y.
   * Handles main floor (0.0), sunken genkan tile (-0.08), descending stairwell (0.0 -> -3.2),
   * and basement storage floor (-3.2).
   */
  getFloorHeightAt(x: number, z: number, currentFeetY: number): number {
    // Stairwell shaft: X [-9.20 .. -2.64], Z [0.25 .. 2.45]
    if (x >= -9.20 && x <= -2.64 && z >= 0.25 && z <= 2.45) {
      // Top landing: X >= -2.84 => 0.0
      // Ramp from X = -2.84 down to X = -6.04 => -3.2 (leaves clear flat landing before West wall)
      if (x >= -2.84) return 0.0;
      if (x <= -6.04) return -3.2;
      const t = (-2.84 - x) / (-2.84 - -6.04);
      return -3.2 * Math.max(0, Math.min(1, t));
    }

    // Basement level if player is already below -1.2m
    if (currentFeetY < -1.2) {
      return -3.2;
    }

    // Sunken genkan shoe vestibule & non-Euclidean exterior hallway (flush at Y = -0.08)
    if (x <= -5.88 && z >= 2.45) {
      return -0.08;
    }

    return 0.0;
  }

  /**
   * Resolves horizontal circle-vs-AABB collision with wall sliding.
   */
  resolveMovement(
    currX: number,
    currZ: number,
    nextX: number,
    nextZ: number,
    feetY: number,
    radius = 0.28
  ): { x: number; z: number } {
    let x = nextX;
    let z = nextZ;

    // Clamp outer apartment bounds (accounting for Bathroom north extension & Non-Euclidean West corridor!)
    if (feetY < -1.2) {
      x = Math.max(-9.00, Math.min(2.72, x));
      z = Math.max(-5.80, Math.min(2.20, z));
    } else {
      const inWestCorridor = (currX < -7.45 || x < -7.68) && z >= 3.65 && z <= 5.55;
      const inBathroom = (currZ < -9.95 || z < -10.08) && x >= 2.95 && x <= 7.25;
      const minX = inWestCorridor ? -18.6 : -7.68;
      const minZ = inBathroom ? -13.86 : -10.08;
      x = Math.max(minX, Math.min(7.02, x));
      z = Math.max(minZ, Math.min(6.42, z));
      if (x < -7.95) {
        // Keep player smoothly inside the Non-Euclidean corridor side walls (Z = 3.52 .. 5.68)
        z = Math.max(3.86, Math.min(5.34, z));
      }
      if (z < -10.42) {
        // Keep player smoothly inside Bathroom perimeter walls (X = 2.95 .. 7.35)
        x = Math.max(3.26, Math.min(7.02, x));
      }
    }

    const headY = feetY + 1.65;
    const kneeY = feetY + 0.35;

    // Two-pass iterative push-out so corners slide smoothly without jitter
    for (let pass = 0; pass < 2; pass++) {
      for (const box of this.boxes.values()) {
        if (!box.enabled) continue;
        // Skip boxes completely above head or below step-up knee height
        if (box.maxY <= kneeY || box.minY >= headY) continue;

        const closestX = Math.max(box.minX, Math.min(x, box.maxX));
        const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          if (distSq > 1e-6) {
            const dist = Math.sqrt(distSq);
            const push = radius - dist;
            x += (dx / dist) * push;
            z += (dz / dist) * push;
          } else {
            // Center inside AABB: push out along nearest axis toward previous pos
            const leftPen = Math.abs(x - box.minX);
            const rightPen = Math.abs(box.maxX - x);
            const topPen = Math.abs(z - box.minZ);
            const bottomPen = Math.abs(box.maxZ - z);
            const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
            if (minPen === leftPen) x = box.minX - radius;
            else if (minPen === rightPen) x = box.maxX + radius;
            else if (minPen === topPen) z = box.minZ - radius;
            else z = box.maxZ + radius;
          }
        }
      }
    }

    // Prevent falling off stairwell edge from Entryway/Bedroom side if somehow clipped
    if (Math.abs(currX - x) > 1.5 || Math.abs(currZ - z) > 1.5) {
      return { x: currX, z: currZ };
    }
    return { x, z };
  }

  /**
   * Tests whether a circle of `radius` at (x, z) on elevation `feetY` is free of walls & furniture.
   * Optionally ignores interior room door colliders (`door_*`) since NPCs push them open.
   */
  isPointWalkable(
    x: number,
    z: number,
    feetY: number,
    radius = 0.28,
    ignoreDoorColliders = true
  ): boolean {
    if (feetY < -1.2) {
      if (x < -8.98 || x > 2.70 || z < -5.78 || z > 2.18) return false;
    } else {
      const inWestCorridor = x < -7.68 && z >= 3.84 && z <= 5.36;
      const inBathroom = z < -10.08 && x >= 3.24 && x <= 7.04;
      if (!inWestCorridor && !inBathroom) {
        if (x < -7.68 || x > 7.02 || z < -10.08 || z > 6.42) return false;
      } else if (inWestCorridor) {
        if (x < -18.55 || z < 3.84 || z > 5.36) return false;
      } else if (inBathroom) {
        if (z < -13.84 || x < 3.24 || x > 7.02) return false;
      }
    }

    const headY = feetY + 1.65;
    const kneeY = feetY + 0.35;
    const rSq = radius * radius;

    for (const box of this.boxes.values()) {
      if (!box.enabled) continue;
      if (ignoreDoorColliders && box.id.startsWith('door_')) continue;
      if (box.maxY <= kneeY || box.minY >= headY) continue;

      const closestX = Math.max(box.minX, Math.min(x, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
      const dx = x - closestX;
      const dz = z - closestZ;
      if (dx * dx + dz * dz < rSq) {
        return false;
      }
    }
    return true;
  }

  /**
   * Swept circle 2D visibility check used for path string-pulling smoothing.
   */
  hasLineOfSight2D(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    feetY: number,
    radius = 0.28,
    ignoreDoorColliders = true
  ): boolean {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    if (dist < 0.08) return true;
    const steps = Math.max(2, Math.ceil(dist / 0.18));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const sx = x0 + (x1 - x0) * t;
      const sz = z0 + (z1 - z0) * t;
      if (!this.isPointWalkable(sx, sz, feetY, radius, ignoreDoorColliders)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Ultra-fast analytic ray-vs-AABB occlusion test against tall structural walls and
   * closed doors (`maxY > 1.75 && minY < 1.25`). Replaces brute-force CPU triangle
   * raycasting against 50k+ triangle merged room meshes (<0.01ms per check!).
   */
  isSegmentBlockedByWall(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    ignoreId?: string
  ): boolean {
    const invDx = Math.abs(dx) > 1e-6 ? 1 / dx : 1e9;
    const invDy = Math.abs(dy) > 1e-6 ? 1 / dy : 1e9;
    const invDz = Math.abs(dz) > 1e-6 ? 1 / dz : 1e9;
    const limit = Math.max(0.05, maxDist - 0.06);

    for (const box of this.boxes.values()) {
      if (!box.enabled) continue;
      if (ignoreId && box.id === ignoreId) continue;
      // Only full-height structural walls & closed doors block line-of-sight across rooms
      // (Never allow furniture/rack/workbench colliders prefixed with 'col_' to occlude items resting on them!)
      if (box.id.startsWith('col_')) continue;
      if (box.maxY - box.minY < 1.55) continue;

      const t1 = (box.minX - ox) * invDx;
      const t2 = (box.maxX - ox) * invDx;
      let tmin = Math.min(t1, t2);
      let tmax = Math.max(t1, t2);

      const t3 = (box.minY - oy) * invDy;
      const t4 = (box.maxY - oy) * invDy;
      tmin = Math.max(tmin, Math.min(t3, t4));
      tmax = Math.min(tmax, Math.max(t3, t4));

      const t5 = (box.minZ - oz) * invDz;
      const t6 = (box.maxZ - oz) * invDz;
      tmin = Math.max(tmin, Math.min(t5, t6));
      tmax = Math.min(tmax, Math.max(t5, t6));

      if (tmax >= Math.max(0.02, tmin) && tmin < limit) {
        return true;
      }
    }
    return false;
  }

  /**
   * Ultra-fast analytic raycast against all enabled AABB colliders + floor/ceiling/outer walls
   * for zero-stutter Toy Gun darts and capture nets (<0.02ms, zero allocations).
   */
  raycastAll(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
    outPoint: { x: number; y: number; z: number },
    outNormal: { x: number; y: number; z: number }
  ): number {
    const invDx = Math.abs(dx) > 1e-6 ? 1 / dx : 1e9;
    const invDy = Math.abs(dy) > 1e-6 ? 1 / dy : 1e9;
    const invDz = Math.abs(dz) > 1e-6 ? 1 / dz : 1e9;

    let bestT = maxDist + 1;
    let bestNx = -dx;
    let bestNy = -dy;
    let bestNz = -dz;

    // 1. Test all enabled AABB boxes (walls, doors, furniture colliders)
    for (const box of this.boxes.values()) {
      if (!box.enabled) continue;

      let tmin = -1e9;
      let tmax = 1e9;
      let hitAxis = 0;
      let hitSign = 1;

      const tx1 = (box.minX - ox) * invDx;
      const tx2 = (box.maxX - ox) * invDx;
      const txMin = tx1 < tx2 ? tx1 : tx2;
      const txMax = tx1 < tx2 ? tx2 : tx1;
      if (txMin > tmin) {
        tmin = txMin;
        hitAxis = 0;
        hitSign = dx > 0 ? -1 : 1;
      }
      if (txMax < tmax) tmax = txMax;

      const ty1 = (box.minY - oy) * invDy;
      const ty2 = (box.maxY - oy) * invDy;
      const tyMin = ty1 < ty2 ? ty1 : ty2;
      const tyMax = ty1 < ty2 ? ty2 : ty1;
      if (tyMin > tmin) {
        tmin = tyMin;
        hitAxis = 1;
        hitSign = dy > 0 ? -1 : 1;
      }
      if (tyMax < tmax) tmax = tyMax;

      const tz1 = (box.minZ - oz) * invDz;
      const tz2 = (box.maxZ - oz) * invDz;
      const tzMin = tz1 < tz2 ? tz1 : tz2;
      const tzMax = tz1 < tz2 ? tz2 : tz1;
      if (tzMin > tmin) {
        tmin = tzMin;
        hitAxis = 2;
        hitSign = dz > 0 ? -1 : 1;
      }
      if (tzMax < tmax) tmax = tzMax;

      if (tmax >= tmin && tmin > 0.015 && tmin < bestT) {
        bestT = tmin;
        bestNx = hitAxis === 0 ? hitSign : 0;
        bestNy = hitAxis === 1 ? hitSign : 0;
        bestNz = hitAxis === 2 ? hitSign : 0;
      }
    }

    // 2. Test horizontal floor & ceiling planes based on current level
    const inBasement = oy < -0.5;
    const floorY = inBasement ? -3.2 : (ox <= -5.88 && oz >= 2.45 ? -0.08 : 0.0);
    const ceilY = inBasement ? -0.18 : 3.02;

    if (dy < -1e-5) {
      const tFloor = (floorY - oy) / dy;
      if (tFloor > 0.015 && tFloor < bestT) {
        bestT = tFloor;
        bestNx = 0;
        bestNy = 1;
        bestNz = 0;
      }
    } else if (dy > 1e-5) {
      const tCeil = (ceilY - oy) / dy;
      if (tCeil > 0.015 && tCeil < bestT) {
        bestT = tCeil;
        bestNx = 0;
        bestNy = -1;
        bestNz = 0;
      }
    }

    // 3. Test outer structural wall bounds so projectiles always stick cleanly to exterior walls
    const minX = inBasement ? -9.22 : (oz >= 3.5 && oz <= 5.7 && ox < -7.5 ? -18.8 : -7.96);
    const maxX = inBasement ? 2.94 : 7.30;
    const minZ = inBasement ? -6.02 : (ox >= 2.9 && ox <= 7.35 && oz < -10.0 ? -14.12 : -10.35);
    const maxZ = inBasement ? 2.42 : 6.68;

    const testPlaneX = (px: number, nx: number) => {
      if (Math.abs(dx) < 1e-5) return;
      const t = (px - ox) / dx;
      if (t > 0.015 && t < bestT) {
        bestT = t;
        bestNx = nx;
        bestNy = 0;
        bestNz = 0;
      }
    };
    const testPlaneZ = (pz: number, nz: number) => {
      if (Math.abs(dz) < 1e-5) return;
      const t = (pz - oz) / dz;
      if (t > 0.015 && t < bestT) {
        bestT = t;
        bestNx = 0;
        bestNy = 0;
        bestNz = nz;
      }
    };

    if (dx < 0) testPlaneX(minX, 1);
    else if (dx > 0) testPlaneX(maxX, -1);
    if (dz < 0) testPlaneZ(minZ, 1);
    else if (dz > 0) testPlaneZ(maxZ, -1);

    if (bestT <= maxDist) {
      outPoint.x = ox + dx * bestT;
      outPoint.y = oy + dy * bestT;
      outPoint.z = oz + dz * bestT;
      outNormal.x = bestNx;
      outNormal.y = bestNy;
      outNormal.z = bestNz;
      return bestT;
    }
    return -1;
  }
}

export function getRoomAt(x: number, feetY: number, z: number): { id: RoomId; label: string } {
  if (feetY < -1.0) {
    return { id: 'basement', label: '地下储藏间' };
  }
  if (z < -10.40 && x >= 2.80) {
    return { id: 'bathroom', label: '浴室' };
  }
  if (x <= -8.02 && z > 2.45) {
    return { id: 'entryway', label: '非欧走廊' };
  }
  if (x <= -1.22 && z <= 0.25) {
    return { id: 'bedroom', label: '卧室' };
  }
  if (x <= -2.70 && z > 2.45) {
    return { id: 'entryway', label: '玄关' };
  }
  if (x <= -2.70 && z > 0.25 && z <= 2.45) {
    return { id: 'basement', label: '地下室楼梯间' };
  }
  if (x >= 3.18 && z >= 0.25) {
    return { id: 'kitchen', label: '厨房' };
  }
  if (x >= -2.70 && x < 3.18 && z >= 0.25) {
    return { id: 'dining', label: '餐厅' };
  }
  return { id: 'living', label: '客厅' };
}
