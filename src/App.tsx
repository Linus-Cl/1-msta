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
import { solveBUSPH } from "./bu_sph";

import { GridView } from "./components/GridView";

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
  
  // Solver outcomes for CP-SAT
  const [resultCPSAT, setResultCPSAT] = useState<SolverResponse | null>(null);
  const [statusCPSAT, setStatusCPSAT] = useState<SolutionStatus>('IDLE');
  
  // Solver outcomes for BU-SPH
  const [resultBUSPH, setResultBUSPH] = useState<SolverResponse | null>(null);
  const [statusBUSPH, setStatusBUSPH] = useState<SolutionStatus>('IDLE');

  const [solverError, setSolverError] = useState<string | null>(null);
  
  // Selected preset
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);

  // Visual toggles
  const [showDirections, setShowDirections] = useState<boolean>(true);
  const [showRanks, setShowRanks] = useState<boolean>(false);
  const [paintMode, setPaintMode] = useState<'add' | 'remove' | null>(null);
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

  // Global mouse up to reset paint drag
  useEffect(() => {
    const handleMouseUp = () => setPaintMode(null);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Update solver when grid gets modified
  const invalidateSolver = () => {
    setSelectedPresetId("custom");
    setResultCPSAT(null);
    setStatusCPSAT('IDLE');
    setResultBUSPH(null);
    setStatusBUSPH('IDLE');
  };

  // Toggle cell on down or enter
  const handleCellInteraction = (x: number, y: number, interactionType: 'down' | 'enter') => {
    setPolyomino(prev => {
      const exists = prev.some(([px, py]) => px === x && py === y);
      
      if (interactionType === 'down') {
        const newMode = exists ? 'remove' : 'add';
        setPaintMode(newMode);
        
        invalidateSolver();
        if (newMode === 'add') {
          addLog(`Pixel gezeichnet an (${x}, ${y})`);
          return [...prev, [x, y]];
        } else {
          addLog(`Pixel entfernt an (${x}, ${y})`);
          return prev.filter(([px, py]) => !(px === x && py === y));
        }
      } else if (interactionType === 'enter' && paintMode) {
        if (paintMode === 'add' && !exists) {
          invalidateSolver();
          return [...prev, [x, y]];
        } else if (paintMode === 'remove' && exists) {
          invalidateSolver();
          return prev.filter(([px, py]) => !(px === x && py === y));
        }
      }
      return prev;
    });
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
    setResultCPSAT(null);
    setStatusCPSAT('IDLE');
    setResultBUSPH(null);
    setStatusBUSPH('IDLE');
    setSolverError(null);
    addLog(`Preset '${preset.name}' geladen. (${preset.coordinates.length} Instanz-Pixel)`);
  };

  // Clear Grid
  const handleClear = () => {
    setPolyomino([]);
    setSelectedPresetId("custom");
    setResultCPSAT(null);
    setStatusCPSAT('EMPTY');
    setResultBUSPH(null);
    setStatusBUSPH('EMPTY');
    setSolverError(null);
    addLog("Grid vollständig geleert.");
  };

  // Run Both Solvers side by side
  const runBothSolvers = async () => {
    if (polyomino.length === 0) {
      setStatusCPSAT('EMPTY');
      setResultCPSAT(null);
      setStatusBUSPH('EMPTY');
      setResultBUSPH(null);
      addLog("Fehler: Polyomino enthält keine Zellen. Zeichne zuerst etwas auf das Grid!");
      return;
    }

    addLog("Starte Evaluierung (CP-SAT Optimum vs BU-SPH Approximation)...");
    
    // 1. Run BU-SPH Algorithm locally (Fast)
    setStatusBUSPH('RUNNING');
    const busphRes = solveBUSPH(polyomino);
    setResultBUSPH(busphRes);
    setStatusBUSPH(busphRes.status);
    addLog(`BU-SPH abgeschlossen! Benötigt: ${busphRes.support.length} Pixel.`);

    // 2. Run CP-SAT through our Python API
    setStatusCPSAT('RUNNING');
    setSolverError(null);
    
    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinates: polyomino })
      });

      if (!response.ok) {
        throw new Error(`HTTP Fehler ${response.status}: Failed to reach solver.`);
      }

      const resData: SolverResponse = await response.json();
      
      if (resData.status === "ERROR" || !resData.support) {
        throw new Error(resData.message || "Unbekannter Solver-Fehler.");
      }

      resData.engine = "CP-SAT";
      setResultCPSAT(resData);
      setStatusCPSAT(resData.status);
      setSolverError(null);

      const supportCount = resData.support.length;
      addLog(`CP-SAT abgeschlossen! Optimaler Support benötigt: ${supportCount} Pixel.`);
    } catch (err: any) {
      console.error(err);
      setStatusCPSAT('ERROR');
      setSolverError(err.message || "Verbindung zum Solver-Backend fehlgeschlagen.");
      addLog(`Fehler beim CP-SAT Lösen: ${err.message || "Unknown error"}`);
    }
  };

  // Trigger solver automatically on first render
  useEffect(() => {
    runBothSolvers();
  }, []);

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

  // Comparison variables
  let cpsatCount = resultCPSAT?.support ? resultCPSAT.support.length : 0;
  let busphCount = resultBUSPH?.support ? resultBUSPH.support.length : 0;
  let factor = cpsatCount > 0 ? (busphCount / cpsatCount).toFixed(2) : '-';

  return (
    <div id="msta_app_root" className="min-h-screen flex flex-col antialiased bg-slate-50 text-slate-900 border border-slate-200">
      
      {/* Upper Navigation Bar */}
      <header id="app_header" className="border-b border-slate-700 bg-slate-900 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-500 p-2 rounded-sm border border-indigo-600">
            <Cpu className="w-6 h-6 text-white anim-pulse-slow" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-sans text-white tracking-tight uppercase">1-MSTA Engine <span className="font-mono text-xs text-indigo-400 ml-2 font-semibold">CP-SAT vs BU-SPH</span></h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-6 text-sm font-medium">
          <div className="flex items-center space-x-2 text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> SYSTEM ACTIVE
          </div>
          <div className="px-4 py-1.5 bg-slate-800 rounded border border-slate-700 font-mono text-indigo-300">
            COMPARE MODE
          </div>
        </div>
      </header>

      {/* Main Workspace Layout divided horizontally */}
      <main className="flex-1 w-full max-w-full mx-auto px-4 md:px-6 py-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Parameters, Presets and Interactive Controls (4 cols) */}
        <section id="sidebar_controls" className="xl:col-span-3 xl:col-start-1 flex flex-col space-y-6">
          
          {/* Quick Metrics Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-xs font-mono text-slate-400">POLYOMINO (P)</span>
                <span className="text-xl font-bold text-slate-800 tracking-tight">{polyomino.length} <span className="text-xs font-normal text-slate-500">Pixel</span></span>
              </div>
              
              <div className="flex flex-col items-end border-l border-slate-200 pl-4">
                <span className="text-[10px] font-mono text-slate-400 uppercase">APPROX. FAKTOR</span>
                <span className="text-xl font-bold text-indigo-600 tracking-tight">
                  {statusCPSAT === 'RUNNING' || statusCPSAT === 'IDLE' ? '-' : `${factor}x`}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <div className="flex flex-col p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">CP-SAT (Optimum)</span>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-slate-800">{statusCPSAT === 'RUNNING' ? <RefreshCw className="w-4 h-4 animate-spin text-slate-400"/> : cpsatCount}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${statusCPSAT === 'OPTIMAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{statusCPSAT}</span>
                </div>
              </div>
              <div className="flex flex-col p-2 bg-indigo-50 rounded border border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">BU-SPH (Heuristic)</span>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-indigo-700">{statusBUSPH === 'RUNNING' ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400"/> : busphCount}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${statusBUSPH === 'FEASIBLE' ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{statusBUSPH}</span>
                </div>
              </div>
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
                id="btn_run_all"
                onClick={runBothSolvers}
                disabled={statusCPSAT === 'RUNNING'}
                className="col-span-2 bg-slate-900 text-white hover:bg-slate-800 font-medium px-4 py-3 rounded-lg flex flex-col items-center justify-center space-y-1 shadow hover:shadow-md active:scale-98 transition duration-150 disabled:opacity-50 cursor-pointer text-sm"
              >
                <div className="flex items-center space-x-1.5"><Play className="w-3.5 h-3.5" /> <span>Beide Solver Evaluieren</span></div>
                <span className="text-[10px] text-slate-400 font-normal">CP-SAT Optimum vs. BU-SPH Approximation</span>
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
                    className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 bg-white cursor-pointer"
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
                    className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 bg-white cursor-pointer"
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
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
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
              <span className="text-[10px] uppercase text-slate-400 font-bold">Terminal Logs</span>
            </div>
            <div className="h-[120px] overflow-y-auto space-y-1.5 pr-1 text-emerald-400 custom-scrollbar mt-1">
              {terminalLogs.map((log, index) => (
                <div key={index} className="leading-5 break-words">
                  <span className="text-slate-500">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* Right Side: Visual Canvas Grid Workspace (8 cols) */}
        <section id="vertical_canvas_area" className="xl:col-span-9 flex flex-col space-y-6 overflow-hidden">
          
          {/* Main Visual Interactive Workspace Canvas */}
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 shadow-inner flex flex-col relative w-full overflow-hidden">
            
            <div className="flex flex-col mb-4">
              <span className="text-[10px] tracking-widest font-mono text-indigo-600 uppercase font-bold">Interactive Mirrors</span>
              <span className="text-xs text-slate-500">Edit the Polyomino (P) on either grid, results synchronize automatically.</span>
            </div>

            {/* Error Message banner */}
            {solverError && (
              <div className="w-full bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-xs mb-4 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{solverError}</span>
              </div>
            )}

            {/* Side-by-side Grids */}
            <div className="flex max-w-full overflow-x-auto space-x-6 pb-4 custom-scrollbar lg:flex-row flex-col lg:space-y-0 space-y-6">
              
              {/* Left Grid: CP-SAT */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xl flex-1 flex flex-col min-w-max">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold tracking-widest text-slate-700 uppercase">CP-SAT Model</span>
                  <div className="flex items-center space-x-1.5 text-[10px]">
                    <span className="w-3 h-3 bg-slate-900 border border-slate-700 rounded-sm"></span><span className="font-bold text-slate-400 mr-2">P</span>
                    <span className="w-3 h-3 bg-indigo-500 rounded-sm border border-indigo-600"></span><span className="font-bold text-indigo-400">S</span>
                  </div>
                </div>
                <div className="flex justify-center border border-slate-100 p-2 rounded-xl bg-slate-50">
                  <GridView 
                    polyomino={polyomino} 
                    solverResult={resultCPSAT} 
                    handleCellInteraction={handleCellInteraction}
                    minX={MIN_GRID_X} maxX={MAX_GRID_X} minY={MIN_GRID_Y} maxY={MAX_GRID_Y}
                    showDirections={showDirections} showRanks={showRanks}
                  />
                </div>
              </div>

              {/* Right Grid: BU-SPH */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xl flex-1 flex flex-col min-w-max">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold tracking-widest text-indigo-600 uppercase">BU-SPH Algorithm</span>
                  <div className="flex items-center space-x-1.5 text-[10px]">
                    <span className="w-3 h-3 bg-slate-900 border border-slate-700 rounded-sm"></span><span className="font-bold text-slate-400 mr-2">P</span>
                    <span className="w-3 h-3 bg-indigo-500 rounded-sm border border-indigo-600"></span><span className="font-bold text-indigo-400">S</span>
                  </div>
                </div>
                <div className="flex justify-center border border-slate-100 p-2 rounded-xl bg-slate-50">
                  <GridView 
                    polyomino={polyomino} 
                    solverResult={resultBUSPH} 
                    handleCellInteraction={handleCellInteraction}
                    minX={MIN_GRID_X} maxX={MAX_GRID_X} minY={MIN_GRID_Y} maxY={MAX_GRID_Y}
                    showDirections={showDirections} showRanks={showRanks}
                  />
                </div>
              </div>

            </div>
          </div>

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
