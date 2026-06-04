# 1-MSTA Algorithmic Playground: Tilt Assembly Support Structures

Welcome to the official algorithmic testbed for the **1-Directional Minimum Superset Tilt Assembly Problem (1-MSTA)**. This repository serves as the computational backend and interactive visualizer for a thesis at TU Braunschweig.

## The Problem
In the physical model of **Tilt Assembly**, unit square tiles (programmable matter/micro-robots) are dropped into a 2D grid from a single direction (e.g., gravity from the North). A tile stops moving as soon as it touches any already-placed tile—whether from below, the left, or the right (lateral sticking). 

To construct complex shapes (Polyominoes) that feature overhangs or "local minima" (stalactites), we must first build a **Support Structure**. The 1-MSTA problem asks: *What is the absolute minimum number of support tiles required to make a given polyomino constructible?*

## Features of this Repository
- **Exact CP-SAT Solver (Python):** A highly optimized Constraint Programming model using Google OR-Tools. It finds the provable mathematical optimum by modeling the support network as a cycle-free, directed flow, perfectly accounting for the complex lateral sticking physics.
- **BU-SPH Heuristic (TypeScript):** A very fast Bottom-Up Shortest Path Heuristic that mathematically guarantees a factor-2 approximation of the optimum.
- **Adversarial Worst-Case Generator:** An automated search engine that mutates polyominoes to computationally discover theoretical worst-case instances that maximize the approximation gap.
- **Interactive Web UI:** A React-based playground to draw shapes, run solvers in real-time, and visually inspect the algorithmic routing geometry.
## Architecture

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express (TypeScript)
- **Solvers:** 
  - Python 3 + `ortools` (CP-SAT)
  - TypeScript (BU-SPH)

## Prerequisites

1. **Node.js** (v18+)
2. **Python 3** (v3.8+)
3. **Google OR-Tools** (`pip install ortools`)

## Setup & Running Locally

1. **Install Node dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   python3 -m pip install ortools
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the Playground:**
   Open your browser and navigate to `http://localhost:3000`.

## Generating Adversarial Instances

1. Open the application.
2. In the left sidebar, locate the **Adversarial Search** panel.
3. Configure the search duration and maximum polyomino size.
4. Click **Generate Worst Cases**. 
5. The backend will generate thousands of valid polyominoes, evaluate them using BU-SPH, and verify the hardest ones using CP-SAT.
6. The found instances will automatically populate the Presets list, sorted by their error ratio (BU-SPH cost / Optimal cost).

## License

MIT License
