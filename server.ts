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
    const duration = req.body.duration || 5; // seconds
    const max_size = req.body.max_size || 15;
    
    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);
    
    // Generate many random instances and score them with BU-SPH
    let candidates: any[] = [];
    
    while (Date.now() < endTime) {
      // Small timeout to not completely block the event loop? 
      // Actually we are inside async so it's ok, but it's synchronous CPU bound.
      // We'll yield slightly if needed, but for small durations it's fine.
      const polyomino = generateRandomPolyomino(max_size);
      
      const heurResult = solveBUSPH(polyomino);
      // We are looking for cases where support is needed, heurResult.support.length > 0
      if (heurResult.status === 'FEASIBLE') {
         candidates.push({
             polyomino,
             heurCost: heurResult.support.length
         });
      }
    }
    
    // Sort by heurCost descending
    candidates.sort((a, b) => b.heurCost - a.heurCost);
    
    // Take the top 10 to evaluate exactly with CP-SAT
    const topCandidates = candidates.slice(0, 10);
    
    const runCP_SAT = (poly: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const p = spawn("python3", ["./api_solver.py"]);
        let stdoutBuffer = "";
        let stderrBuffer = "";
        p.stdout.on("data", (d) => stdoutBuffer += d.toString());
        p.stderr.on("data", (d) => stderrBuffer += d.toString());
        p.on("close", (code) => {
          if (code === 0) {
            try { resolve(JSON.parse(stdoutBuffer.trim())); } 
            catch(e) { reject(e); }
          } else {
            resolve({ status: 'INFEASIBLE' }); // just fallback
          }
        });
        p.stdin.write(JSON.stringify({ coordinates: poly, time_limit: 5.0 }));
        p.stdin.end();
      });
    };
    
    const evaluated = [];
    for (const cand of topCandidates) {
      if (cand.heurCost === 0) continue; // No support needed anyway
      const cpResult = await runCP_SAT(cand.polyomino);
      if (cpResult.status === 'OPTIMAL' || cpResult.status === 'FEASIBLE') {
        const exactCost = cpResult.support.length;
        // Avoid division by zero
        const ratio = exactCost > 0 ? (cand.heurCost / exactCost) : (cand.heurCost > 0 ? 999 : 1);
        evaluated.push({
          polyomino: cand.polyomino,
          heurCost: cand.heurCost,
          exactCost,
          ratio
        });
      }
    }
    
    // Sort by worst ratio (BU-SPH performing bad compared to Opt)
    evaluated.sort((a, b) => b.ratio - a.ratio);
    
    res.json({ instances: evaluated });
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
