import { Coordinate, DirectedEdge, SolverResponse } from "./types";

function computeAnchored(P_set: Set<string>, S_add: Set<string>): Set<string> {
    const anchored = new Set<string>();
    
    // Group all points by Y
    const byY: Record<number, [number, number][]> = {};
    let maxY = 0;
    
    const addToByY = (x: number, y: number) => {
        if (!byY[y]) byY[y] = [];
        byY[y].push([x, y]);
        if (y > maxY) maxY = y;
    };
    
    for (const p of P_set) {
        const [x, y] = p.split(',').map(Number);
        if (y === 0) anchored.add(p);
        addToByY(x, y);
    }
    for (const p of S_add) {
        const [x, y] = p.split(',').map(Number);
        // Support structures CANNOT anchor to the floor directly.
        addToByY(x, y);
    }
    
    for (let y = 1; y <= maxY; y++) {
        if (!byY[y]) continue;
        
        let changed = true;
        while (changed) {
            changed = false;
            for (const [x, _] of byY[y]) {
                const key = `${x},${y}`;
                if (!anchored.has(key)) {
                    // Force only travels UP in terms of evaluation (supported from below)
                    // So if below, left, or right is already anchored, this point becomes anchored.
                    const downAnchored = anchored.has(`${x},${y-1}`);
                    const leftAnchored = anchored.has(`${x-1},${y}`);
                    const rightAnchored = anchored.has(`${x+1},${y}`);
                    
                    if (downAnchored || leftAnchored || rightAnchored) {
                        anchored.add(key);
                        changed = true; // Cascade search for horizontal propagation
                    }
                }
            }
        }
    }
    return anchored;
}

export function solveBUSPH(polyomino: Coordinate[]): SolverResponse {
  if (polyomino.length === 0) {
    return { status: 'EMPTY', support: [], edges: [], engine: 'BU-SPH' };
  }

  const S_add: Set<string> = new Set();
  const edges: DirectedEdge[] = [];
  
  const P_set = new Set(polyomino.map(c => `${c[0]},${c[1]}`));

  // Find local minima M
  const minima: Coordinate[] = [];
  for (const [px, py] of polyomino) {
    if (py > 0 && !P_set.has(`${px},${py - 1}`)) {
      minima.push([px, py]);
    }
  }

  // Iterate strictly bottom-up
  const H: Record<number, Coordinate[]> = {};
  for (const min of minima) {
    if (!H[min[1]]) H[min[1]] = [];
    H[min[1]].push(min);
  }

  const sortedY = Object.keys(H).map(Number).sort((a, b) => a - b);
  const minX_P = Math.min(...polyomino.map(p=>p[0]));
  const maxX_P = Math.max(...polyomino.map(p=>p[0]));

  for (const y of sortedY) {
    let Hl = H[y];
    while (Hl.length > 0) {
      // Recompute the dynamic grounded structures before every evaluation
      const anchored = computeAnchored(P_set, S_add);
      
      let bestCost = Infinity;
      let bestMove: { 
        mIndex: number, 
        path: Coordinate[], 
        newEdges: DirectedEdge[] 
      } | null = null;
      
      for (let i = 0; i < Hl.length; i++) {
        const [mx, my] = Hl[i];
        
        // Skip if this minimum is already magically supported by previous operations!
        if (anchored.has(`${mx},${my}`)) {
            bestCost = 0;
            bestMove = { mIndex: i, path: [], newEdges: [] };
            break; 
        }

        // Try all reasonable xB bounds to allow RLS connections
        for (let xB = minX_P - my - 2; xB <= maxX_P + my + 2; xB++) {
          let currentCost = 0;
          let currentPath: Coordinate[] = [];
          let currentEdges: DirectedEdge[] = [];
          
          let hit = false;
          const stepX = xB >= mx ? 1 : -1;
          
          let prev = [mx, my] as Coordinate;
          
          // Horizontal segment of RLS
          if (xB !== mx) {
            for (let x = mx + stepX; stepX > 0 ? x <= xB : x >= xB; x += stepX) {
              currentEdges.push({ from: prev, to: [x, my] });
              prev = [x, my];
              
              if (anchored.has(`${x},${my}`)) {
                hit = true;
                break;
              } else if (P_set.has(`${x},${my}`)) {
                // Free to pass through existing P block
              } else {
                currentCost++;
                currentPath.push([x, my]);
              }
            }
          }
          
          // Vertical drop segment of RLS
          if (!hit) {
            for (let yDrop = my - 1; yDrop >= 0; yDrop--) {
              currentEdges.push({ from: prev, to: [xB, yDrop] });
              prev = [xB, yDrop];
              
              if (anchored.has(`${xB},${yDrop}`)) {
                hit = true;
                break; 
              } else if (P_set.has(`${xB},${yDrop}`)) {
                // Free to pass down through existing P block
              } else {
                if (yDrop === 0) {
                  // Hit the floor but it's not anchored (not P). This is a failure!
                  hit = false;
                  break;
                }
                currentCost++;
                currentPath.push([xB, yDrop]);
              }
            }
          }
          
          if (hit && currentCost < bestCost) {
            bestCost = currentCost;
            bestMove = { mIndex: i, path: currentPath, newEdges: currentEdges };
          }
        }
      }
      
      if (bestMove) {
        for (const p of bestMove.path) {
           S_add.add(`${p[0]},${p[1]}`);
        }
        for (const e of bestMove.newEdges) {
           edges.push(e);
        }
        Hl.splice(bestMove.mIndex, 1);
      } else {
        break; // Safety breakout if no valid move found
      }
    }
  }

  const supportPixels = Array.from(S_add).map(s => {
    const [x, y] = s.split(',').map(Number);
    return [x, y] as Coordinate;
  });

  return { 
    status: 'FEASIBLE', 
    support: supportPixels, 
    edges: edges, 
    engine: 'BU-SPH' 
  };
}
