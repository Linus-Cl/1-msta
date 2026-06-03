import React from 'react';
import { Coordinate, SolverResponse } from "../types";

interface GridViewProps {
  polyomino: Coordinate[];
  solverResult: SolverResponse | null;
  handleCellInteraction: (x: number, y: number, mode: 'down' | 'enter') => void;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  showDirections: boolean;
  showRanks: boolean;
}

export function GridView({
  polyomino,
  solverResult,
  handleCellInteraction,
  minX, maxX, minY, maxY,
  showDirections, showRanks
}: GridViewProps) {

  const cols = maxX - minX + 1;
  const isSmall = cols <= 13;
  const isMedium = cols <= 21 && cols > 13;
  const isLarge = cols > 21;

  const wClass = isSmall ? "w-10" : isMedium ? "w-6 xl:w-7" : "w-5 xl:w-6";
  const hClass = isSmall ? "h-10" : isMedium ? "h-6 xl:h-7" : "h-5 xl:h-6";
  const cellClass = `${wClass} ${hClass}`;

  // Check if a coordinate exists in polyomino set
  const isPolyomino = (x: number, y: number) => {
    return polyomino.some(([px, py]) => px === x && py === y);
  };

  // Check if a coordinate exists in the active support response
  const isSupport = (x: number, y: number) => {
    if (!solverResult || !solverResult.support) return false;
    return solverResult.support.some(([sx, sy]) => sx === x && sy === y);
  };

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
        <svg className="w-5 h-5 text-white/80 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    } else if (dx === -1) {
      return (
        <svg className="w-5 h-5 text-white/80 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      );
    } else if (dx === 1) {
      return (
        <svg className="w-5 h-5 text-white/80 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col relative bg-transparent">
      {/* Rows go from max Y to min Y inside visual grid */}
      {Array.from({ length: maxY - minY + 1 }).map((_, rIdx) => {
        const y = maxY - rIdx;
        return (
          <div key={y} className="flex select-none">
            
            {/* Y Axis Labels */}
            <div className={`w-7 flex items-center justify-end pr-2 font-mono text-[10px] text-slate-400 border-r border-slate-100 ${hClass}`}>
              {y}
            </div>

            {/* Columns representing X axis */}
            {Array.from({ length: maxX - minX + 1 }).map((_, cIdx) => {
              const x = minX + cIdx;
              const isP = isPolyomino(x, y);
              const isS = isSupport(x, y);
              const rankValue = solverResult?.ranks?.[`${x},${y}`];

              return (
                <div
                  key={x}
                  onMouseDown={(e) => { e.preventDefault(); handleCellInteraction(x, y, 'down'); }}
                  onMouseEnter={(e) => { e.preventDefault(); handleCellInteraction(x, y, 'enter'); }}
                  className={`${cellClass} border-b border-r border-dashed border-slate-200 flex flex-col items-center justify-center relative cursor-pointer group transition-all duration-150 ${
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
        <div className="w-7" /> {/* Blank corner gap */}
        {Array.from({ length: maxX - minX + 1 }).map((_, cIdx) => {
          const x = minX + cIdx;
          return (
            <div key={x} className={`${wClass} text-center pt-2 font-mono text-[9px] text-slate-400`}>
              {x}
            </div>
          );
        })}
      </div>
    </div>
  );
}
