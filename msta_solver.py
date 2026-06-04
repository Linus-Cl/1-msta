from ortools.sat.python import cp_model

def solve_1msta_exact(polyomino_coords):
    """
    Solves the 1-MSTA problem exactly using CP-SAT.
    polyomino_coords: list of tuples (x, y) representing the instance P.
    Returns: list of support coordinates S, or None if infeasible.
    """
    model = cp_model.CpModel()
    
    # Bounding Box ermitteln (mit 1 Pixel Puffer links/rechts)
    min_x = min(x for x, y in polyomino_coords) - 1
    max_x = max(x for x, y in polyomino_coords) + 1
    max_y = max(y for x, y in polyomino_coords)
    
    P_set = set(polyomino_coords)
    
    # --- VARIABLEN ---
    # S[x,y]: 1 wenn hier ein Support-Pixel ist
    S = {}
    # Occ[x,y]: 1 wenn hier ein Instanz-Pixel ODER Support-Pixel ist
    Occ = {}
    # Rank[x,y]: Integer für Zyklus-Eliminierung (Distanz zum Boden)
    Rank = {}
    
    max_nodes = (max_x - min_x + 1) * (max_y + 1)
    
    for x in range(min_x, max_x + 1):
        for y in range(0, max_y + 1):
            if (x, y) in P_set:
                S[x, y] = model.NewConstant(0) # P-Pixel brauchen keinen Support-Eintrag
                Occ[x, y] = model.NewConstant(1)
            else:
                S[x, y] = model.NewBoolVar(f'S_{x}_{y}')
                Occ[x, y] = S[x, y]
            
            Rank[x, y] = model.NewIntVar(0, max_nodes, f'Rank_{x}_{y}')
            
            # Boden-Pixel haben Rank 0
            if y == 0:
                model.Add(Rank[x, y] == 0)

    # --- CONSTRAINTS ---
    # Gerichtete Kantenvariablen (Support-Fluss)
    support_edges = {}
    
    for x in range(min_x, max_x + 1):
        for y in range(1, max_y + 1): # y=0 braucht keinen Support nach unten
            
            # Mögliche Nachbarn, die (x,y) abstützen können (unten, links, rechts)
            candidates = []
            if y - 1 >= 0: candidates.append((x, y - 1))
            if x - 1 >= min_x: candidates.append((x - 1, y))
            if x + 1 <= max_x: candidates.append((x + 1, y))
            
            edge_vars = []
            for (cx, cy) in candidates:
                edge = model.NewBoolVar(f'edge_{x}_{y}_to_{cx}_{cy}')
                edge_vars.append(edge)
                
                # Wenn edge aktiv, MUSS der Nachbar belegt sein
                model.Add(Occ[cx, cy] == 1).OnlyEnforceIf(edge)
                
                # Wenn edge aktiv, muss Rank strikt abnehmen (Zyklusverhinderung)
                model.Add(Rank[x, y] > Rank[cx, cy]).OnlyEnforceIf(edge)
            
            # Wenn (x,y) belegt ist, muss ES EXAKT EINEN Support-Nachbarn geben.
            # Wenn leer, darf es keine ausgehenden Kanten geben.
            # Ausgedrückt als Summenbedingung über die boolschen Kantenvariablen.
            model.Add(sum(edge_vars) == Occ[x, y])


    # --- ZIELFUNKTION ---
    # Minimiere die Summe aller Support-Pixel
    model.Minimize(sum(S.values()))
    
    # --- SOLVER ---
    solver = cp_model.CpSolver()
    # solver.parameters.log_search_progress = True # Für Debugging aktivieren
    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        support_coords = [(x, y) for (x, y) in S if solver.Value(S[x, y]) == 1]
        return support_coords
    else:
        return None

def print_grid(P, S):
    """Visualisiert das Grid im Terminal"""
    if S is None:
        print("Keine Lösung gefunden!")
        return
        
    all_coords = P + S
    if not all_coords: return
    
    min_x = min(x for x, y in all_coords)
    max_x = max(x for x, y in all_coords)
    max_y = max(y for x, y in all_coords)
    
    print("\n--- 1-MSTA GRID ---")
    for y in range(max_y, -1, -1):
        row_str = f"{y:2d} | "
        for x in range(min_x, max_x + 1):
            if (x, y) in P:
                row_str += "██" # Instanz
            elif (x, y) in S:
                row_str += "[]" # Support
            else:
                row_str += ".." # Leer
        print(row_str)
    print("    " + "-" * (max_x - min_x + 1)*2)
    print("     " + "".join([str(x)[-1] + " " for x in range(min_x, max_x + 1)]))
    print("██ = Polyomino (P), [] = Support (S)\n")


# === TESTLAUF ===
if __name__ == "__main__":
    # Ein kleines "Höhlen"-Polyomino. 
    # Es schwebt ein Pixel bei (2,3), das nach unten abgestützt werden muss!
    test_polyomino = [
        (0,0), (1,0), (2,0), (3,0), (4,0),
        (0,1),                      (4,1),
        (0,2),                      (4,2),
        (0,3), (1,3), (2,3), (3,3), (4,3)
    ]
    
    print("Starte CP-SAT Solver...")
    support = solve_1msta_exact(test_polyomino)
    
    print(f"Optimaler Support benötigt: {len(support)} Pixel")
    print_grid(test_polyomino, support)
