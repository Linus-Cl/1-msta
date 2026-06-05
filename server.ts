import express from "express";
import path from "path";
import { exec, spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import { solveBUSPH } from "./src/bu_sph";
import { generateRandomPolyomino } from "./src/polyomino_generator";

const app = express();
const PORT = 3000;

app.use(express.json());

// API route to solve the 1-MSTA problem via the python script
app.post("/api/solve", async (req, res) => {
  try {
    const { coordinates, time_limit } = req.body;
    if (!coordinates || !Array.isArray(coordinates)) {
      res.status(400).json({ error: "Invalid coordinates format. Must be an array of [x, y] coordinates." });
      return;
    }

    // Spawn Python subprocess to run api_solver.py
    const p = spawn("python3", ["./api_solver.py"]);
    
    let stdoutBuffer = "";
    let stderrBuffer = "";

    p.stdout.on("data", (data) => {
      stdoutBuffer += data.toString();
    });

    p.stderr.on("data", (data) => {
      stderrBuffer += data.toString();
    });

    p.on("close", (code) => {
      if (code !== 0) {
        console.error("Python solver error (code):", code, stderrBuffer);
        res.status(500).json({ error: "Solver failed", details: stderrBuffer });
        return;
      }

      try {
        const jsonResult = JSON.parse(stdoutBuffer.trim());
        res.json(jsonResult);
      } catch (parseErr) {
        console.error("Failed to parse Python output:", stdoutBuffer);
        res.status(500).json({ error: "Solver response parse error", raw: stdoutBuffer });
      }
    });

    // Write input coordinates to Python stdin
    p.stdin.write(JSON.stringify({ coordinates, time_limit: time_limit ?? 5.0 }));
    p.stdin.end();

  } catch (err: any) {
    console.error("Solver endpoint error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// A simple endpoint to get info or test connection
app.get("/api/info", (req, res) => {
  res.json({
    name: "1-MSTA Solver API",
    version: "1.0.0",
    engine: "CP-SAT (OR-Tools)"
  });
});

app.post("/api/adversarial", async (req, res) => {
  try {
    const { 
      mode = 'time',       // 'time' | 'count'
      duration = 5,        // seconds (used when mode === 'time')
      count = 100,         // number of instances (used when mode === 'count')
      max_size = 15,       // exact polyomino size to generate
      top_k = 10           // how many worst-cases to verify with CP-SAT
    } = req.body;

    const runCP_SAT = (poly: any): Promise<any> => {
      return new Promise((resolve) => {
        const p = spawn("python3", ["./api_solver.py"]);
        let stdoutBuffer = "";
        let stderrBuffer = "";
        p.stdout.on("data", (d) => stdoutBuffer += d.toString());
        p.stderr.on("data", (d) => stderrBuffer += d.toString());
        p.on("close", (code) => {
          if (code === 0) {
            try { resolve(JSON.parse(stdoutBuffer.trim())); }
            catch(e) { resolve({ status: 'PARSE_ERROR' }); }
          } else {
            resolve({ status: 'INFEASIBLE' });
          }
        });
        p.stdin.write(JSON.stringify({ coordinates: poly, time_limit: 5.0 }));
        p.stdin.end();
      });
    };

    // --- Phase 1: Generate candidates and score with BU-SPH (fast) ---
    const candidates: any[] = [];

    if (mode === 'count') {
      // Count-based: generate exactly `count` polyominoes
      for (let i = 0; i < count; i++) {
        const polyomino = generateRandomPolyomino(max_size);
        const heurResult = solveBUSPH(polyomino);
        if (heurResult.status === 'FEASIBLE') {
          candidates.push({ polyomino, heurCost: heurResult.support.length });
        }
      }
    } else {
      // Time-based: generate as many as possible within `duration` seconds
      const endTime = Date.now() + (duration * 1000);
      while (Date.now() < endTime) {
        const polyomino = generateRandomPolyomino(max_size);
        const heurResult = solveBUSPH(polyomino);
        if (heurResult.status === 'FEASIBLE') {
          candidates.push({ polyomino, heurCost: heurResult.support.length });
        }
      }
    }

    // --- Phase 2: Build score summary for ALL candidates ---
    // We include raw heurCosts (lightweight: just numbers) so the client
    // can build histograms and stats without the full polyomino data.
    candidates.sort((a, b) => b.heurCost - a.heurCost);
    const allHeurCosts: number[] = candidates.map(c => c.heurCost);

    // Build a distribution: how many instances had each heurCost value
    const maxHeur = allHeurCosts.length > 0 ? allHeurCosts[0] : 0;
    const scoreDist: Record<number, number> = {};
    for (const cost of allHeurCosts) {
      scoreDist[cost] = (scoreDist[cost] ?? 0) + 1;
    }

    // Summary stats
    const mean = allHeurCosts.length > 0
      ? allHeurCosts.reduce((a, b) => a + b, 0) / allHeurCosts.length
      : 0;
    const sorted = [...allHeurCosts].sort((a, b) => a - b);
    const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

    // --- Phase 3: Take top-K by heuristic cost and verify with CP-SAT ---
    const topCandidates = candidates.slice(0, top_k);

    const evaluated: any[] = [];
    for (const cand of topCandidates) {
      if (cand.heurCost === 0) continue;
      const cpResult = await runCP_SAT(cand.polyomino);
      if (cpResult.status === 'OPTIMAL' || cpResult.status === 'FEASIBLE') {
        const exactCost = cpResult.support.length;
        const ratio = exactCost > 0
          ? (cand.heurCost / exactCost)
          : (cand.heurCost > 0 ? 999 : 1);
        evaluated.push({
          polyomino: cand.polyomino,
          heurCost: cand.heurCost,
          exactCost,
          ratio
        });
      }
    }

    evaluated.sort((a, b) => b.ratio - a.ratio);

    res.json({
      // Top verified worst-cases (full data incl. polyomino coords)
      instances: evaluated,
      // Full score data for analysis / download
      all_heur_costs: allHeurCosts,
      score_distribution: scoreDist,
      summary: {
        total_generated: candidates.length,
        mean_heur_cost: Math.round(mean * 100) / 100,
        median_heur_cost: median,
        max_heur_cost: maxHeur,
        worst_cases_verified: evaluated.length,
      }
    });
  } catch (err: any) {
    console.error("Adversarial error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Express server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting Express server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
