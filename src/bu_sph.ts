import { Coordinate, DirectedEdge, SolverResponse } from "./types";

export function solveBUSPH(polyomino: Coordinate[]): SolverResponse {
  if (polyomino.length === 0) {
    return { status: 'EMPTY', support: [], edges: [], engine: 'BU-SPH' };
  }

  const S_add: Set<string> = new Set();
  const edges: DirectedEdge[] = [];
  
  const P_set = new Set(polyomino.map(c => `${c[0]},${c[1]}`));
  const isSnet = (x: number, y: number) => P_set.has(`${x},${y}`) || S_add.has(`${x},${y}`);

  // Find local minima M
  const minima: Coordinate[] = [];
  for (const [px, py] of polyomino) {
    if (py > 0 && !P_set.has(`${px},${py - 1}`)) {
      minima.push([px, py]);
    }
  }

  // Break ties randomly or deterministically. We use deterministic iteration.
  // Group by Y
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
      let bestCost = Infinity;
      let bestMove: { 
        mIndex: number, 
        path: Coordinate[], 
        newEdges: DirectedEdge[] 
      } | null = null;
      
      for (let i = 0; i < Hl.length; i++) {
        const [mx, my] = Hl[i];
        
        // Try all reasonable xB bounds to allow RLS connections
        for (let xB = minX_P - my - 2; xB <= maxX_P + my + 2; xB++) {
          let currentCost = 0;
          let currentPath: Coordinate[] = [];
          let currentEdges: DirectedEdge[] = [];
          
          let hit = false;
          const stepX = xB >= mx ? 1 : -1;
          
          let prev = [mx, my] as Coordinate;
          
          // Horizontal step
          if (xB !== mx) {
            for (let x = mx + stepX; stepX > 0 ? x <= xB : x >= xB; x += stepX) {
              currentEdges.push({ from: prev, to: [x, my] });
              prev = [x, my];
              
              if (isSnet(x, my)) {
                hit = true;
                break;
              } else {
                currentCost++;
                currentPath.push([x, my]);
              }
            }
          }
          
          // Vertical step
          if (!hit) {
            for (let yDrop = my - 1; yDrop >= 0; yDrop--) {
              currentEdges.push({ from: prev, to: [xB, yDrop] });
              prev = [xB, yDrop];
              
              if (isSnet(xB, yDrop)) {
                hit = true;
                break; // Docked to something below
              } else {
                currentCost++;
                currentPath.push([xB, yDrop]);
                if (yDrop === 0) {
                  hit = true;
                  break;
                }
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
