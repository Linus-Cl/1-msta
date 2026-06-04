import sys
import json
from ortools.sat.python import cp_model

def solve_1msta_json(polyomino_coords, time_limit=5.0):
    """
    Solves the 1-MSTA problem exactly using CP-SAT and returns support coords and directed edges.
    """
    model = cp_model.CpModel()
    
    # Identify bounding box
    if not polyomino_coords:
        return {"support": [], "edges": [], "status": "EMPTY"}
        
    min_x = min(x for x, y in polyomino_coords) - 1
    max_x = max(x for x, y in polyomino_coords) + 1
    max_y = max(y for x, y in polyomino_coords)
    
    # Force min_x to be at least some padding, or y to start from 0
    P_set = set(tuple(p) for p in polyomino_coords)
    
    # --- VARIABLES ---
    S = {}
    Occ = {}
    Rank = {}
    
    max_nodes = (max_x - min_x + 1) * (max_y + 1) + 10
    
    for x in range(min_x, max_x + 1):
        for y in range(0, max_y + 1):
            if (x, y) in P_set:
                S[x, y] = model.NewConstant(0)
                Occ[x, y] = model.NewConstant(1)
            else:
                # Support structures CANNOT be built on the floor (y=0).
                # Only the original polyomino can act as an anchor at y=0.
                if y == 0:
                    S[x, y] = model.NewConstant(0)
                else:
                    S[x, y] = model.NewBoolVar(f'S_{x}_{y}')
                Occ[x, y] = S[x, y]
            
            Rank[x, y] = model.NewIntVar(0, max_nodes, f'Rank_{x}_{y}')
            
            # Ground nodes have Rank 0
            if y == 0:
                model.Add(Rank[x, y] == 0)

    # --- CONSTRAINTS ---
    support_edges = {} # (x, y) -> list of (cx, cy, edge_var)
    
    for x in range(min_x, max_x + 1):
        for y in range(1, max_y + 1):
            candidates = []
            if y - 1 >= 0: candidates.append((x, y - 1))
            if x - 1 >= min_x: candidates.append((x - 1, y))
            if x + 1 <= max_x: candidates.append((x + 1, y))
            
            edge_vars = []
            for (cx, cy) in candidates:
                edge = model.NewBoolVar(f'edge_{x}_{y}_to_{cx}_{cy}')
                edge_vars.append(edge)
                support_edges[(x, y, cx, cy)] = edge
                
                # If edge active, both source and target must be occupied
                model.Add(Occ[x, y] == 1).OnlyEnforceIf(edge)
                model.Add(Occ[cx, cy] == 1).OnlyEnforceIf(edge)
                
                # Rank relation to eliminate cycles
                model.Add(Rank[x, y] > Rank[cx, cy]).OnlyEnforceIf(edge)
            
            # If (x,y) occupied, exactly one support neighbor must be active.
            # If empty, no outgoing support edges.
            # This is elegantly expressed as sum(edge_vars) == Occ[x,y] since edge_vars are booleans.
            model.Add(sum(edge_vars) == Occ[x, y])


    # --- OBJECTIVE ---
    # Minimize sum of support pixels
    model.Minimize(sum(S.values()))
    
    # --- SOLVE ---
    solver = cp_model.CpSolver()
    if time_limit > 0:
        solver.parameters.max_time_in_seconds = float(time_limit)
    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        support_coords = [[x, y] for (x, y) in S if solver.Value(S[x, y]) == 1]
        
        edges_list = []
        for (x, y, cx, cy), edge_var in support_edges.items():
            if solver.Value(edge_var) == 1:
                edges_list.append({
                    "from": [x, y],
                    "to": [cx, cy]
                })
        
        # Collect ranks for visualization/verification
        ranks = {}
        for x in range(min_x, max_x + 1):
            for y in range(0, max_y + 1):
                if solver.Value(Occ[x, y]) == 1:
                    ranks[f"{x},{y}"] = solver.Value(Rank[x, y])

        return {
            "status": "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE",
            "support": support_coords,
            "edges": edges_list,
            "ranks": ranks,
            "min_x": min_x,
            "max_x": max_x,
            "max_y": max_y
        }
    else:
        return {"status": "INFEASIBLE", "support": [], "edges": [], "ranks": {}}

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            # default test run
            test_polyomino = [
                [0,0], [1,0], [2,0], [3,0], [4,0],
                [0,1],                      [4,1],
                [0,2],                      [4,2],
                [0,3], [1,3], [2,3], [3,3], [4,3]
            ]
            res = solve_1msta_json(test_polyomino)
            print(json.dumps(res, indent=2))
        else:
            payload = json.loads(input_data)
            if isinstance(payload, list):
                polyomino_coords = payload
                res = solve_1msta_json(polyomino_coords)
            else:
                polyomino_coords = payload.get("coordinates", [])
                time_limit = payload.get("time_limit", 5.0)
                res = solve_1msta_json(polyomino_coords, time_limit)
            print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"status": "ERROR", "message": str(e)}))
