import { Coordinate } from "./types";

export function generateRandomPolyomino(size: number): Coordinate[] {
    const coords: Set<string> = new Set();
    const result: Coordinate[] = [];

    // Start with a random point on the floor (y=0)
    // To keep it somewhat centered, we choose x between 1 and 4
    const startX = Math.floor(Math.random() * 4) + 1;
    coords.add(`${startX},0`);
    result.push([startX, 0]);

    const neighbors = (x: number, y: number) => [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
    ];

    while (result.length < size) {
        // Collect all possible valid neighbors
        const possible: Coordinate[] = [];
        for (const [cx, cy] of result) {
            for (const [nx, ny] of neighbors(cx, cy)) {
                // Must not go below floor, must not already exist
                if (ny >= 0 && !coords.has(`${nx},${ny}`)) {
                    // Optional: limit x to keep it within view
                    if (nx >= -5 && nx <= 10) {
                        possible.push([nx, ny] as Coordinate);
                    }
                }
            }
        }

        if (possible.length === 0) break; // Should theoretically never happen

        // Pick a random neighbor
        const pick = possible[Math.floor(Math.random() * possible.length)];
        coords.add(`${pick[0]},${pick[1]}`);
        result.push(pick);
    }

    // Normalize so that minX is somewhat positive (e.g. 0 or 1) to fit nicely in UI grid
    const minX = Math.min(...result.map(p => p[0]));
    const offsetX = minX < 1 ? 1 - minX : 0;
    
    if (offsetX !== 0) {
        return result.map(p => [p[0] + offsetX, p[1]] as Coordinate);
    }

    return result;
}
