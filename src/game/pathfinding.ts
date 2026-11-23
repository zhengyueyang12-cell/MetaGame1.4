import type { CollisionWorld } from './collision';

export interface PathPoint2D {
  x: number;
  z: number;
}

const CELL_SIZE = 0.32;
const ORIGIN_X = -19.2;
const ORIGIN_Z = -14.4;
const GRID_COLS = 86; // covers X = -19.2 .. +8.32
const GRID_ROWS = 68; // covers Z = -14.4 .. +7.36
const MAX_EXPANSIONS = 950;

const DIRS: readonly [number, number, number][] = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  [1, 1, 1.4142],
  [1, -1, 1.4142],
  [-1, 1, 1.4142],
  [-1, -1, 1.4142],
];

function worldToCol(x: number): number {
  return Math.max(0, Math.min(GRID_COLS - 1, Math.round((x - ORIGIN_X) / CELL_SIZE)));
}

function worldToRow(z: number): number {
  return Math.max(0, Math.min(GRID_ROWS - 1, Math.round((z - ORIGIN_Z) / CELL_SIZE)));
}

function colToWorld(col: number): number {
  return ORIGIN_X + col * CELL_SIZE;
}

function rowToWorld(row: number): number {
  return ORIGIN_Z + row * CELL_SIZE;
}

function cellKey(col: number, row: number): number {
  return row * GRID_COLS + col;
}

function findNearestWalkableCell(
  collisions: CollisionWorld,
  col: number,
  row: number,
  feetY: number,
  radius: number
): { col: number; row: number } | null {
  if (collisions.isPointWalkable(colToWorld(col), rowToWorld(row), feetY, radius, true)) {
    return { col, row };
  }
  for (let ring = 1; ring <= 5; ring++) {
    for (let dc = -ring; dc <= ring; dc++) {
      for (let dr = -ring; dr <= ring; dr++) {
        if (Math.abs(dc) !== ring && Math.abs(dr) !== ring) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= GRID_COLS || nr < 0 || nr >= GRID_ROWS) continue;
        if (collisions.isPointWalkable(colToWorld(nc), rowToWorld(nr), feetY, radius, true)) {
          return { col: nc, row: nr };
        }
      }
    }
  }
  return null;
}

/**
 * Lightweight 8-directional grid A* pathfinder with obstacle-clearance preference and
 * line-of-sight string-pulling smoothing so the heroine naturally steers around beds,
 * desks, chairs, tables, and doorways instead of walking straight into furniture.
 */
export function findApartmentPath(
  collisions: CollisionWorld,
  startX: number,
  startZ: number,
  goalX: number,
  goalZ: number,
  feetY: number,
  agentRadius = 0.26
): PathPoint2D[] {
  const directDist = Math.hypot(goalX - startX, goalZ - startZ);
  if (directDist < 0.25) {
    return [{ x: goalX, z: goalZ }];
  }

  // Fast path: unobstructed straight line with comfortable clearance
  if (
    collisions.hasLineOfSight2D(
      startX,
      startZ,
      goalX,
      goalZ,
      feetY,
      agentRadius + 0.04,
      true
    ) &&
    collisions.isPointWalkable(goalX, goalZ, feetY, agentRadius, true)
  ) {
    return [{ x: goalX, z: goalZ }];
  }

  const startCell = findNearestWalkableCell(
    collisions,
    worldToCol(startX),
    worldToRow(startZ),
    feetY,
    agentRadius
  );
  const goalCell = findNearestWalkableCell(
    collisions,
    worldToCol(goalX),
    worldToRow(goalZ),
    feetY,
    agentRadius
  );
  if (!startCell || !goalCell) {
    return [{ x: goalX, z: goalZ }];
  }

  const startKey = cellKey(startCell.col, startCell.row);
  const goalKey = cellKey(goalCell.col, goalCell.row);
  if (startKey === goalKey) {
    return [{ x: colToWorld(goalCell.col), z: rowToWorld(goalCell.row) }];
  }

  const walkableCache = new Map<number, boolean>();
  const isCellWalkable = (c: number, r: number): boolean => {
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return false;
    const k = cellKey(c, r);
    const cached = walkableCache.get(k);
    if (cached !== undefined) return cached;
    const ok = collisions.isPointWalkable(colToWorld(c), rowToWorld(r), feetY, agentRadius, true);
    walkableCache.set(k, ok);
    return ok;
  };

  // Soft clearance check: slightly penalize cells hugging furniture edges so paths curve neatly around obstacles
  const clearancePenalty = (c: number, r: number): number => {
    const wx = colToWorld(c);
    const wz = rowToWorld(r);
    return collisions.isPointWalkable(wx, wz, feetY, agentRadius + 0.14, true) ? 0 : 0.45;
  };

  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();

  // Lightweight binary min-heap on fScore
  const heapKeys: number[] = [startKey];
  const heapFs: number[] = [
    Math.hypot(goalCell.col - startCell.col, goalCell.row - startCell.row),
  ];

  const heapPush = (k: number, f: number) => {
    heapKeys.push(k);
    heapFs.push(f);
    let idx = heapKeys.length - 1;
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (heapFs[parent] <= heapFs[idx]) break;
      const tk = heapKeys[parent];
      heapKeys[parent] = heapKeys[idx];
      heapKeys[idx] = tk;
      const tf = heapFs[parent];
      heapFs[parent] = heapFs[idx];
      heapFs[idx] = tf;
      idx = parent;
    }
  };

  const heapPop = (): number => {
    const top = heapKeys[0];
    const lastK = heapKeys.pop()!;
    const lastF = heapFs.pop()!;
    if (heapKeys.length > 0) {
      heapKeys[0] = lastK;
      heapFs[0] = lastF;
      let idx = 0;
      const n = heapKeys.length;
      while (true) {
        const left = (idx << 1) + 1;
        const right = left + 1;
        let smallest = idx;
        if (left < n && heapFs[left] < heapFs[smallest]) smallest = left;
        if (right < n && heapFs[right] < heapFs[smallest]) smallest = right;
        if (smallest === idx) break;
        const tk = heapKeys[smallest];
        heapKeys[smallest] = heapKeys[idx];
        heapKeys[idx] = tk;
        const tf = heapFs[smallest];
        heapFs[smallest] = heapFs[idx];
        heapFs[idx] = tf;
        idx = smallest;
      }
    }
    return top;
  };

  gScore.set(startKey, 0);
  fScore.set(startKey, heapFs[0]);

  let bestKey = startKey;
  let bestHeuristic = heapFs[0];
  let expansions = 0;
  let reachedGoal = false;

  while (heapKeys.length > 0 && expansions < MAX_EXPANSIONS) {
    const current = heapPop();
    if (closed.has(current)) continue;
    closed.add(current);
    expansions++;

    if (current === goalKey) {
      reachedGoal = true;
      bestKey = current;
      break;
    }

    const cc = current % GRID_COLS;
    const cr = Math.floor(current / GRID_COLS);
    const curG = gScore.get(current) ?? Infinity;

    for (let d = 0; d < DIRS.length; d++) {
      const [dc, dr, stepCost] = DIRS[d];
      const nc = cc + dc;
      const nr = cr + dr;
      if (!isCellWalkable(nc, nr)) continue;

      // Prevent diagonal corner-cutting across furniture corners
      if (dc !== 0 && dr !== 0) {
        if (!isCellWalkable(cc + dc, cr) || !isCellWalkable(cc, cr + dr)) {
          continue;
        }
      }

      const nk = cellKey(nc, nr);
      if (closed.has(nk)) continue;

      const tentativeG = curG + stepCost + clearancePenalty(nc, nr);
      if (tentativeG < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, current);
        gScore.set(nk, tentativeG);
        const h = Math.hypot(goalCell.col - nc, goalCell.row - nr);
        if (h < bestHeuristic) {
          bestHeuristic = h;
          bestKey = nk;
        }
        const f = tentativeG + h * 1.15;
        fScore.set(nk, f);
        heapPush(nk, f);
      }
    }
  }

  // Reconstruct raw grid path
  const rawPoints: PathPoint2D[] = [];
  let trace: number | undefined = reachedGoal ? goalKey : bestKey;
  while (trace !== undefined && trace !== startKey) {
    const tc = trace % GRID_COLS;
    const tr = Math.floor(trace / GRID_COLS);
    rawPoints.push({ x: colToWorld(tc), z: rowToWorld(tr) });
    trace = cameFrom.get(trace);
  }
  rawPoints.reverse();

  if (reachedGoal && collisions.isPointWalkable(goalX, goalZ, feetY, agentRadius, true)) {
    if (rawPoints.length > 0) {
      rawPoints[rawPoints.length - 1] = { x: goalX, z: goalZ };
    } else {
      rawPoints.push({ x: goalX, z: goalZ });
    }
  }

  if (rawPoints.length <= 1) {
    return rawPoints.length === 1 ? rawPoints : [{ x: goalX, z: goalZ }];
  }

  // Line-of-sight string-pulling smoothing to remove staircase grid zig-zags
  const smoothed: PathPoint2D[] = [];
  let anchorX = startX;
  let anchorZ = startZ;
  let cursor = 0;

  while (cursor < rawPoints.length) {
    let farthest = cursor;
    for (let probe = rawPoints.length - 1; probe > cursor; probe--) {
      if (
        collisions.hasLineOfSight2D(
          anchorX,
          anchorZ,
          rawPoints[probe].x,
          rawPoints[probe].z,
          feetY,
          agentRadius + 0.03,
          true
        )
      ) {
        farthest = probe;
        break;
      }
    }
    const chosen = rawPoints[farthest];
    smoothed.push(chosen);
    anchorX = chosen.x;
    anchorZ = chosen.z;
    cursor = farthest + 1;
  }

  return smoothed;
}
