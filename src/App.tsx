import React, { useState, useEffect } from "react";
import { 
  Play, 
  Trash2, 
  HelpCircle, 
  Code, 
  Cpu, 
  BookOpen, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Info,
  Layers,
  FileCode,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PRESETS } from "./presets";
import { Coordinate, SolutionStatus, SolverResponse, Preset } from "./types";

export default function App() {
  const [gridSize, setGridSize] = useState<'sm' | 'md' | 'lg'>('sm');

  const gridConfigs = {
    sm: { minX: -2, maxX: 8, maxY: 6 },
    md: { minX: -6, maxX: 14, maxY: 12 },
    lg: { minX: -10, maxX: 20, maxY: 18 }
  };

  const MIN_GRID_X = gridConfigs[gridSize].minX;
  const MAX_GRID_X = gridConfigs[gridSize].maxX;
  const MIN_GRID_Y = 0;
  const MAX_GRID_Y = gridConfigs[gridSize].maxY;

  // Active polyomino P coordinates
  const [polyomino, setPolyomino] = useState<Coordinate[]>(PRESETS[0].coordinates);
  
  // Solver outcomes
  const [solverResult, setSolverResult] = useState<SolverResponse | null>({
    status: 'OPTIMAL',
    support: [],
    edges: [],
    ranks: {}
  });
  const [solverStatus, setSolverStatus] = useState<SolutionStatus>('IDLE');
  const [solverError, setSolverError] = useState<string | null>(null);
  
  // Selected preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);

  // Visual toggles
  const [showDirections, setShowDirections] = useState<boolean>(true);
  const [showRanks, setShowRanks] = useState<boolean>(false);
  const [explanationExpanded, setExplanationExpanded] = useState<boolean>(true);
  const [codeViewerExpanded, setCodeViewerExpanded] = useState<boolean>(false);

  // Active terminal output log simulation
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "Terminal initialisiert...",
    "CP-SAT Modell bereit. Standard-Modell 'Cave (Self-Supporting)' geladen.",
    "Boden hat Rank = 0. Warte auf Eingabe..."
  ]);

  const addLog = (msg: string) => {
    setTerminalLogs((prev) => [...prev.slice(-15), `${new Date().toLocaleTimeString()} | ${msg}`]);
  };

  // Convert coordinate array to a string key for efficient map lookup e.g. "x,y"
  const getCoordKey = (x: number, y: number) => `${x},${y}`;

  // Check if a coordinate exists in polyomino set
  const isPolyomino = (x: number, y: number) => {
    return polyomino.some(([px, py]) => px === x && py === y);
  };

  // Check if a coordinate exists in the active support response
  const isSupport = (x: number, y: number) => {
    if (!solverResult || !solverResult.support) return false;
    return solverResult.support.some(([sx, sy]) => sx === x && sy === y);
  };

  // Toggle cell on click
  const handleCellClick = (x: number, y: number) => {
    const exists = isPolyomino(x, y);
    let newPoly: Coordinate[];
    
    if (exists) {
      newPoly = polyomino.filter(([px, py]) => !(px === x && py === y));
      addLog(`Pixel entfernt an (${x}, ${y})`);
    } else {
      newPoly = [...polyomino, [x, y]];
      addLog(`Pixel gezeichnet an (${x}, ${y})`);
    }
    
    setPolyomino(newPoly);
    setSelectedPresetId("custom");
    // Invalidate stale solver output when grid is modified
    setSolverResult(null);
    setSolverStatus('IDLE');
  };

  // Handle Preset Selection
  const selectPreset = (preset: Preset) => {
    // Auto adjust grid size based on coordinates
    const minX = Math.min(...preset.coordinates.map(c => c[0]));
    const maxX = Math.max(...preset.coordinates.map(c => c[0]));
    const maxY = Math.max(...preset.coordinates.map(c => c[1]));
    
    if (minX < gridConfigs[gridSize].minX || maxX > gridConfigs[gridSize].maxX || maxY > gridConfigs[gridSize].maxY) {
      if (minX >= gridConfigs.sm.minX && maxX <= gridConfigs.sm.maxX && maxY <= gridConfigs.sm.maxY) {
        setGridSize('sm');
      } else if (minX >= gridConfigs.md.minX && maxX <= gridConfigs.md.maxX && maxY <= gridConfigs.md.maxY) {
        setGridSize('md');
      } else {
        setGridSize('lg');
      }
    }

    setPolyomino(preset.coordinates);
    setSelectedPresetId(preset.id);
    setSolverResult(null);
    setSolverStatus('IDLE');
    setSolverError(null);
    addLog(`Preset '${preset.name}' geladen. (${preset.coordinates.length} Instanz-Pixel)`);
  };

  // Clear Grid
  const handleClear = () => {
    setPolyomino([]);
    setSelectedPresetId("custom");
    setSolverResult(null);
    setSolverStatus('EMPTY');
    setSolverError(null);
    addLog("Grid vollständig geleert.");
  };

  // Core API call to invoke CP-SAT solver
  const runSolver = async () => {
    if (polyomino.length === 0) {
      setSolverStatus('EMPTY');
      setSolverResult(null);
      addLog("Fehler: Polyomino enthält keine Zellen. Zeichne zuerst etwas auf das Grid!");
      return;
    }

    setSolverStatus('RUNNING');
    addLog("Sende Polyomino-Koordinaten an Python backend (CP-SAT Solver)...");
    
    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ coordinates: polyomino })
      });

      if (!response.ok) {
        throw new Error(`HTTP Fehler ${response.status}: Failed to reach solver.`);
      }

      const resData: SolverResponse = await response.json();
      
      if (resData.status === "ERROR" || !resData.support) {
        throw new Error(resData.message || "Unbekannter Solver-Fehler.");
      }

      setSolverResult(resData);
      setSolverStatus(resData.status);
      setSolverError(null);

      const supportCount = resData.support.length;
      addLog(`CP-SAT abgeschlossen! Status: ${resData.status}. Optimaler Support benötigt: ${supportCount} Pixel.`);
      if (supportCount === 0) {
         addLog("Spektakulär! Keine Support-Strukturen notwendig (das Polyomino hält sich selbst).");
      } else {
         addLog(`Support-Koordinaten berechnet: ${JSON.stringify(resData.support)}`);
      }

    } catch (err: any) {
      console.error(err);
      setSolverStatus('ERROR');
      setSolverError(err.message || "Verbindung zum Solver-Backend fehlgeschlagen.");
      addLog(`Fehler beim Lösen: ${err.message || "Unknown error"}`);
    }
  };

  // Trigger solver automatically on first render to display default "Cave" state
  useEffect(() => {
    runSolver();
  }, []);

  // Helper to render Arrows inside cells showing support flow representation
  const getDirectionArrow = (x: number, y: number) => {
    if (!solverResult || !solverResult.edges) return null;
    
    // Find if there is an edge starting from this point
    const edge = solverResult.edges.find(e => e.from[0] === x && e.from[1] === y);
    if (!edge) return null;

    const [tx, ty] = edge.to;
    const dx = tx - x;
    const dy = ty - y;

    // Arrow pointing directions
    if (dy === -1) {
      return (
        <svg className="w-5 h-5 text-white/70 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    } else if (dx === -1) {
      return (
        <svg className="w-5 h-5 text-white/70 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      );
    } else if (dx === 1) {
      return (
        <svg className="w-5 h-5 text-white/70 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      );
    }
    return null;
  };

  const pythonCode = `from ortools.sat.python import cp_model

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
    S = {}; Occ = {}; Rank = {}
    max_nodes = (max_x - min_x + 1) * (max_y + 1)
    
    for x in range(min_x, max_x + 1):
        for y in range(0, max_y + 1):
            if (x, y) in P_set:
                S[x, y] = model.NewConstant(0) # P-Pixel brauchen keinen Support
                Occ[x, y] = model.NewConstant(1)
            else:
                S[x, y] = model.NewBoolVar(f'S_{x}_{y}')
                Occ[x, y] = S[x, y]
            
            Rank[x, y] = model.NewIntVar(0, max_nodes, f'Rank_{x}_{y}')
            
            # Boden-Pixel haben Rank 0 (Verankerung am Fundament)
            if y == 0:
                model.Add(Rank[x, y] == 0)

    # --- CONSTRAINTS (SUPPORT-FLUSS) ---
    for x in range(min_x, max_x + 1):
        for y in range(1, max_y + 1): # y=0 braucht keine Absicherung nach unten
            candidates = []
            if y - 1 >= 0: candidates.append((x, y - 1)) # Down
            if x - 1 >= min_x: candidates.append((x - 1, y)) # Left
            if x + 1 <= max_x: candidates.append((x + 1, y)) # Right
            
            edge_vars = []
            for (cx, cy) in candidates:
                edge = model.NewBoolVar(f'edge_{x}_{y}_to_{cx}_{cy}')
                edge_vars.append(edge)
                
                # Wenn edge aktiv, MUSS der Nachbar belegt sein
                model.Add(Occ[cx, cy] == 1).OnlyEnforceIf(edge)
                
                # Wenn edge aktiv, muss Rank abnehmen (Zyklusverhinderung / Gravitationsfluss)
                model.Add(Rank[x, y] > Rank[cx, cy]).OnlyEnforceIf(edge)
            
            # Wenn (x,y) belegt ist, muss ES EXAKT EINEN Support-Nachbarn geben
            model.AddExactlyOne(edge_vars).OnlyEnforceIf(Occ[x, y])
            # Wenn (x,y) leer ist, darf es keine ausgehenden Kanten geben
            for edge in edge_vars:
                model.Add(edge == 0).OnlyEnforceIf(Occ[x, y].Not())

    # --- ZIELFUNKTION ---
    model.Minimize(sum(S.values()))
    
    solver = cp_model.CpSolver()
    status = solver.Solve(model)
    
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        return [(x, y) for (x, y) in S if solver.Value(S[x, y]) == 1]
    return None`;

  return (
    <div id="msta_app_root" className="min-h-screen flex flex-col antialiased bg-slate-50 text-slate-900 border border-slate-200">
      
      {/* Upper Navigation Bar */}
      <header id="app_header" className="border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-500 p-2 rounded-sm border border-indigo-600">
            <Cpu className="w-6 h-6 text-white anim-pulse-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans text-white tracking-tight uppercase">1-MSTA CP-SAT Engine <span className="font-mono text-xs text-indigo-400 ml-2 font-semibold">v1.0.4-beta</span></h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-6 text-sm font-medium">
          <div className="flex items-center space-x-2 text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> SYSTEM ACTIVE
          </div>
          <div className="px-4 py-1.5 bg-slate-800 rounded border border-slate-700 font-mono text-indigo-300">
            BUILD MODE
          </div>
        </div>
      </header>

      {/* Main Workspace Layout divided horizontally */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Parameters, Presets and Interactive Controls (5 cols) */}
        <section id="sidebar_controls" className="lg:col-span-4 flex flex-col space-y-6">
          
          {/* Quick Metrics Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs font-mono text-slate-400">POLYOMINO (P)</span>
              <span className="text-2xl font-bold text-slate-800 tracking-tight">{polyomino.length} <span className="text-xs text-slate-500">Pixel</span></span>
            </div>
            <div className="border-r border-slate-200 h-8"></div>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-slate-400">SUPPORT (S)</span>
              <span className="text-2xl font-bold text-indigo-600 tracking-tight">
                {solverStatus === 'RUNNING' ? (
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 py-1" />
                ) : (
                  solverResult?.support?.length ?? '?'
                )} <span className="text-xs text-indigo-500">Pixel</span>
              </span>
            </div>
            <div className="border-r border-slate-200 h-8"></div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono text-slate-400">SOLVER STATS</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded mt-1 overflow-hidden tracking-normal ${
                solverStatus === 'OPTIMAL' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                solverStatus === 'FEASIBLE' ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 
                solverStatus === 'EMPTY' ? 'bg-slate-50 text-slate-500 border border-slate-200' :
                solverStatus === 'RUNNING' ? 'bg-indigo-50 text-indigo-500 border border-indigo-200 animate-pulse' :
                'bg-red-50 text-red-500 border border-red-200'
              }`}>
                {solverStatus}
              </span>
            </div>
          </div>

          {/* Action Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center space-x-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span>Aktionen</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="btn_run_solver"
                onClick={runSolver}
                disabled={solverStatus === 'RUNNING'}
                className="col-span-2 bg-slate-900 text-white hover:bg-slate-800 font-medium px-4 py-3 rounded-lg flex items-center justify-center space-x-2 shadow hover:shadow-md active:scale-98 transition duration-150 disabled:opacity-50 cursor-pointer text-sm"
              >
                <Play className="w-4 h-4" />
                <span>Optimalen Support berechnen</span>
              </button>

              <button
                id="btn_clear"
                onClick={handleClear}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-medium px-3 py-2.5 rounded-lg flex items-center justify-center space-x-2 active:scale-98 transition duration-150 text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Leeren</span>
              </button>

              <button
                id="btn_reset_default"
                onClick={() => selectPreset(PRESETS[0])}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-medium px-3 py-2.5 rounded-lg flex items-center justify-center space-x-2 active:scale-98 transition duration-150 text-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Klassiker laden</span>
              </button>
            </div>

            {/* Quick visualization settings */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-500 flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={showDirections} 
                    onChange={(e) => setShowDirections(e.target.checked)} 
                    className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 bg-white"
                  />
                  <span>Support-Kraftrichtung einblenden</span>
                </label>
                <Info className="w-3 h-3 text-slate-400 cursor-help" title="Zeigt an, in welche Richtung (unten, links, rechts) die Unterstützung fließt." />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-500 flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    checked={showRanks} 
                    onChange={(e) => setShowRanks(e.target.checked)} 
                    className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 bg-white"
                  />
                  <span>Ränge einblenden (Rank_x_y)</span>
                </label>
                <Info className="w-3 h-3 text-slate-400 cursor-help" title="Zeigt den errechneten Baum-Rang des CP-SAT Modells (Höhe im directed forest)." />
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100/50 mt-2">
                <span className="text-xs text-slate-500">Grid Größe anpassen</span>
                <select 
                  value={gridSize}
                  onChange={(e) => setGridSize(e.target.value as 'sm' | 'md' | 'lg')}
                  className="text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 text-slate-700 outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="sm">Klein (11x7)</option>
                  <option value="md">Mittel (21x13)</option>
                  <option value="lg">Groß (31x19)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preset Selector Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>Presets & Benchmarks</span>
            </h2>
            <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  id={`preset_btn_${p.id}`}
                  onClick={() => selectPreset(p)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 cursor-pointer flex flex-col space-y-1 ${
                    selectedPresetId === p.id 
                    ? "bg-indigo-50 border-indigo-200" 
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`font-semibold text-xs ${selectedPresetId === p.id ? "text-indigo-700" : "text-slate-700"}`}>{p.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      N={p.coordinates.length}
                    </span>
                  </div>
                  <p className={`text-[11px] leading-normal line-clamp-2 ${selectedPresetId === p.id ? "text-indigo-600/80" : "text-slate-500"}`}>{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Simulated Terminal for exact output */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              </div>
              <span className="text-[10px] uppercase text-slate-400 font-bold">Terminal Output - cp_model.CpSolver()</span>
            </div>
            <div className="h-[148px] overflow-y-auto space-y-1.5 pr-1 text-emerald-400 custom-scrollbar mt-1">
              {terminalLogs.map((log, index) => (
                <div key={index} className="leading-5 break-words">
                  <span className="text-slate-500">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* Right Side: Visual Canvas Grid Workspace (8 cols) */}
        <section id="vertical_canvas_area" className="lg:col-span-8 flex flex-col space-y-6">
          
          {/* Main Visual Interactive Workspace Canvas */}
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 shadow-inner flex flex-col items-center justify-center relative min-h-[500px]">
            
            <div className="absolute top-4 left-4 flex flex-col">
              <span className="text-[10px] tracking-widest font-mono text-indigo-600 uppercase font-bold">Interactive Grid</span>
              <span className="text-xs text-slate-500">Klicke Zellen an, um das Polyomino (P) zu zeichnen/löschen.</span>
            </div>

            <div className="absolute top-4 right-4 flex space-x-3 items-center text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 bg-slate-900 border border-slate-700 rounded-sm"></span>
                <span className="text-slate-600 font-bold">POLYOMINO (P)</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3.5 h-3.5 bg-indigo-500 rounded-sm border border-indigo-600 animate-pulse"></span>
                <span className="text-slate-600 font-bold">SUPPORT (S)</span>
              </div>
            </div>

            {/* Error Message banner */}
            {solverError && (
              <div className="w-full bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-xs mb-4 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{solverError}</span>
              </div>
            )}

            {/* The main Grid workspace */}
            <div id="msta_grid_container" className="flex flex-col relative bg-white p-6 rounded-2xl border border-slate-200 shadow-xl mt-8 overflow-x-auto max-w-full">
              
              {/* Rows go from max Y to min Y inside visual grid */}
              {Array.from({ length: MAX_GRID_Y - MIN_GRID_Y + 1 }).map((_, rIdx) => {
                const y = MAX_GRID_Y - rIdx;
                return (
                  <div key={y} className="flex select-none">
                    
                    {/* Y Axis Labels */}
                    <div className="w-8 flex items-center justify-end pr-2.5 font-mono text-xs text-slate-400 h-11 border-r border-slate-100">
                      y={y}
                    </div>

                    {/* Columns representing X axis */}
                    {Array.from({ length: MAX_GRID_X - MIN_GRID_X + 1 }).map((_, cIdx) => {
                      const x = MIN_GRID_X + cIdx;
                      const isP = isPolyomino(x, y);
                      const isS = isSupport(x, y);
                      const rankValue = solverResult?.ranks?.[`${x},${y}`];

                      return (
                        <div
                          key={x}
                          onClick={() => handleCellClick(x, y)}
                          className={`w-11 h-11 border-b border-r border-dashed border-slate-200 flex flex-col items-center justify-center relative cursor-pointer group transition-all duration-150 ${
                            isP 
                            ? "bg-slate-900 border-solid border-slate-900 font-semibold" 
                            : isS 
                            ? "bg-indigo-500 border-solid border-indigo-600 text-white font-medium shadow-sm" 
                            : "bg-slate-50 hover:bg-slate-100"
                          }`}
                          title={`Koordinate: (${x}, ${y})`}
                        >
                          {/* Outer Border for ground y=0 */}
                          {y === 0 && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400" title="Bodenverankerung" />
                          )}

                          {/* Render Arrow directions for support flow */}
                          {showDirections && (isP || isS) && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              {getDirectionArrow(x, y)}
                            </div>
                          )}

                          {/* Human readable label inside voxel */}
                          {isP && (
                            <span className="text-[10px] text-white font-mono font-bold z-10 select-none">P</span>
                          )}
                          {isS && (
                            <span className="text-[10px] text-white font-mono font-bold z-10 select-none animate-pulse">S</span>
                          )}

                          {/* Rank overlay code */}
                          {showRanks && rankValue !== undefined && (isP || isS) && (
                            <div className="absolute bottom-0.5 right-1 text-[8px] font-mono text-indigo-200 z-15 bg-slate-900/80 px-0.5 rounded leading-none">
                              r={rankValue}
                            </div>
                          )}

                          {/* Subtle hover indicators */}
                          <div className="absolute inset-0 border border-transparent group-hover:border-indigo-400/40 pointer-events-none" />
                        </div>
                      );
                    })}

                  </div>
                );
              })}

              {/* X Axis Labels under rows */}
              <div className="flex">
                <div className="w-8" /> {/* Blank corner gap */}
                {Array.from({ length: MAX_GRID_X - MIN_GRID_X + 1 }).map((_, cIdx) => {
                  const x = MIN_GRID_X + cIdx;
                  return (
                    <div key={x} className="w-11 text-center pt-2 font-mono text-[10px] text-slate-400">
                      x={x}
                    </div>
                  );
                })}
              </div>

            </div>

            {/* Empty grid state advice */}
            {polyomino.length === 0 && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center select-none rounded-2xl pointer-events-none">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl max-w-sm pointer-events-auto">
                  <span className="text-sm font-semibold text-slate-800 block mb-1">Grid ist leer</span>
                  <span className="text-xs text-slate-500 block mb-3">Zeichne eine Struktur oder lade ein Preset oben aus dem Menü, um loszulegen!</span>
                  <button 
                    onClick={() => selectPreset(PRESETS[0])}
                    className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-4 py-1.5 rounded-lg cursor-pointer"
                  >
                    Preset laden
                  </button>
                </div>
              </div>
            )}

            {/* Visual grounding feedback bottom label */}
            <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center space-x-1.5">
                <span className="w-2.5 h-1 bg-emerald-400 rounded"></span>
                <span>Y = 0 (Boden / Fundament)</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="border-b border-dashed border-slate-400 w-4 inline-block"></span>
                <span>Zyklen-Einflussbereich</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="text-indigo-500">&darr; &larr; &rarr;</span>
                <span>Richtungsketten zum Fundament</span>
              </span>
            </div>

          </div>

          {/* Interactive Scientific Explanation Section */}
          <AnimatePresence>
            {explanationExpanded && (
              <motion.div
                key="explainer_section"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 font-sans"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    <span className="uppercase tracking-widest text-xs">Hintergrund & Zyklus-Eliminierung</span>
                  </h3>
                  <button 
                    onClick={() => setExplanationExpanded(false)}
                    className="text-slate-400 hover:text-slate-800 transition cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed space-y-3">
                  <p>
                    Bei der physikalischen Abstützung (z.B. im 3D-Druck) muss jedes Volumenelement (Voxel) stabil verankert sein. Übersetzt bedeutet das: 
                    Jedes belegte Pixel <code className="text-indigo-600 bg-indigo-50 px-1 rounded">Occ[x, y]</code> muss über belegte Nachbarpixel ununterbrochen bis zum 
                    Boden <code className="text-slate-500 bg-slate-50 border border-slate-100 font-mono px-1 rounded">(y = 0)</code> herabreichen. Die Richtungen der stützenden Kraftübertragung verlaufen 
                    immer <strong>abwärts (y-1)</strong>, <strong>links (x-1)</strong> oder <strong>rechts (x+1)</strong>.
                  </p>
                  
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 space-y-2">
                    <span className="font-bold text-sm text-slate-800 block">Das zyklische Paradoxon ("Luftschloss"):</span>
                    <p className="text-slate-500 leading-relaxed">
                      Einfache Weg-Bedingungen neigen zu unendlichen Schleifen. Ein Pixel stützt seinen linken Nachbarn, der stützt den rechten, 
                      und im Kreis halten sie sich gegenseitig in der Luft, ohne je echte Verbindung zum Fundament zu besitzen.
                    </p>
                    <span className="font-bold text-sm text-slate-800 block mt-3">Die mathematische CP-SAT Lösung (Directed Tree):</span>
                    <p className="text-slate-500 leading-relaxed">
                      Das Python-Modell verhindert Luftschlösser über eine <code className="text-indigo-600 bg-indigo-50 px-1 font-mono rounded">Rank[x, y]</code> Variable. 
                      Wenn Pixel A ein tragendes Glied von Pixel B ist, muss <code className="text-emerald-600 font-mono bg-emerald-50 px-1 rounded">Rank[B] &gt; Rank[A]</code> gelten. 
                      Da der Rank am Boden <code className="text-emerald-600 font-mono bg-emerald-50 px-1 rounded">Rank[*, 0] = 0</code> beträgt und stetig wachsen muss, 
                      sind ringförmige Selbststützen (Zyklen) mathematisch unmöglich.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive Code Viewer Section */}
          <AnimatePresence>
            {codeViewerExpanded && (
              <motion.div
                key="code_viewer_section"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800 flex items-center space-x-2">
                    <FileCode className="w-4 h-4 text-indigo-500" />
                    <span>Exact Solver CP-SAT Code (Python, OR-Tools)</span>
                  </h3>
                  <button 
                    onClick={() => setCodeViewerExpanded(false)}
                    className="text-slate-400 hover:text-slate-800 transition cursor-pointer"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative">
                  <pre className="text-[11px] font-mono text-emerald-400 bg-slate-900 p-5 rounded-xl border border-slate-800 shadow-inner overflow-x-auto max-h-[380px] leading-relaxed select-all">
                    {pythonCode}
                  </pre>
                  
                  <div className="absolute top-3 right-3 flex space-x-2">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(pythonCode);
                        addLog("Quellcode in die Zwischenablage kopiert!");
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-mono font-bold px-3 py-1.5 rounded cursor-pointer"
                    >
                      Kopieren
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-500 leading-relaxed flex items-center space-x-2">
                  <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  <span>Kopiere diesen Code direkt auf deine lokale Maschine, installiere OR-Tools (<code className="text-slate-800 bg-slate-100 border border-slate-200 px-1 rounded font-mono">pip install ortools</code>) und starte die exakte Lösung!</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </section>

      </main>

      {/* Footer detailing project parameters */}
      <footer id="app_footer" className="border-t border-slate-200 bg-white py-4 text-center text-[10px] uppercase tracking-widest font-bold text-slate-400 mt-auto font-sans">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>Google AI Studio Build &bull; 1-MSTA Playground <span className="font-mono text-indigo-400 ml-1">v1.0</span></span>
          <span>Präzise Zyklus-Eliminierung über gerichtet wachsende Spanning-Arboreszenzen</span>
        </div>
      </footer>

    </div>
  );
}
