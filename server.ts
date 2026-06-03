import express from "express";
import path from "path";
import { exec, spawn } from "child_process";
import { createServer as createViteServer } from "vite";

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
