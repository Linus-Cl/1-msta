import { Coordinate } from "./types";

// Only 4-directional adjacency: UP, RIGHT, LEFT, DOWN
const DIRS: [number, number][] = [[0, 1], [1, 0], [-1, 0], [0, -1]];

// Weighted directions for growth — heavy upward bias to create tall, sparse trees
const DIR_WEIGHTS = [
    { dx: 0, dy: 1, w: 50 },   // UP       — dominant: grows tall branches
    { dx: 1, dy: 0, w: 18 },   // RIGHT    — lateral extension
    { dx: -1, dy: 0, w: 18 },   // LEFT     — lateral extension
    { dx: 0, dy: -1, w: 2 },   // DOWN     — very rare, creates overhangs
];
const TOTAL_W = DIR_WEIGHTS.reduce((s, d) => s + d.w, 0);

function key(x: number, y: number) { return `${x},${y}`; }

/**
 * Generates a random, FULLY 4-CONNECTED polyomino of exactly `size` pixels.
 *
 * Connectivity guarantee: we only ever add a cell that is 4-adjacent to an
 * already-existing cell, so the shape is connected by construction.
 *
 * Sparseness strategy:
 * - Growth is strongly biased upward (weight 50 vs 18 lateral vs 2 down).
 * - Cells that would have ≥2 existing 4-neighbours are rejected probabilistically,
 *   preventing filled rectangular blobs.
 * - We sample from existing cells biased toward high-y tips, which pushes the
 *   shape to extend in long vertical arms rather than spreading out flat.
 * - This creates tree/comb-like polyominoes with many overhanging pixels that
 *   have no cell directly below them — i.e. many local minima for the solver.
 */
export function generateRandomPolyomino(size: number): Coordinate[] {
    const coords = new Set<string>();
    const result: Coordinate[] = [];

    // Single seed on the ground — connectivity is maintained from here on
    const startX = Math.floor(Math.random() * 5) + 2;
    coords.add(key(startX, 0));
    result.push([startX, 0]);

    const maxAttempts = size * 150;
    let attempts = 0;

    while (result.length < size && attempts < maxAttempts) {
        attempts++;

        // Pick an existing cell to extend from.
        // Bias toward later-added (typically higher) cells by using a power transform:
        // pow(rand, 0.35) skews toward 1 → end of array → recently grown tips.
        const pickIdx = Math.floor(Math.pow(Math.random(), 0.35) * result.length);
        const [cx, cy] = result[pickIdx];

        // Sample a direction according to weights
        let rng = Math.random() * TOTAL_W;
        let chosenDx = 0, chosenDy = 1;
        for (const { dx, dy, w } of DIR_WEIGHTS) {
            rng -= w;
            if (rng <= 0) { chosenDx = dx; chosenDy = dy; break; }
        }

        const nx = cx + chosenDx;
        const ny = cy + chosenDy;

        // Hard constraints
        if (ny < 0) continue;                        // cannot go below the floor
        if (coords.has(key(nx, ny))) continue;       // already occupied
        if (nx < -10 || nx > 20) continue;           // stay within view

        // Count how many 4-neighbours this new cell would have in the existing set
        const adjCount = DIRS.filter(([dx, dy]) => coords.has(key(nx + dx, ny + dy))).length;

        // Sparseness / anti-blob filter:
        // Cells with 3+ neighbours turn the shape into a filled region — reject most of them.
        // Cells with 2 neighbours are allowed but dampened to keep the shape lean.
        if (adjCount >= 3 && Math.random() < 0.88) continue;
        if (adjCount >= 2 && Math.random() < 0.48) continue;

        coords.add(key(nx, ny));
        result.push([nx, ny]);
    }

    // Normalise so minX >= 1 (fits inside the default grid view)
    const minX = Math.min(...result.map(p => p[0]));
    const offsetX = minX < 1 ? 1 - minX : 0;
    return offsetX > 0
        ? result.map(p => [p[0] + offsetX, p[1]] as Coordinate)
        : result;
}
