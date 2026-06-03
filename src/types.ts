export type Coordinate = [number, number];

export interface DirectedEdge {
  from: Coordinate;
  to: Coordinate;
}

export type SolutionStatus = 'IDLE' | 'RUNNING' | 'OPTIMAL' | 'FEASIBLE' | 'INFEASIBLE' | 'ERROR' | 'EMPTY';

export interface SolverResponse {
  status: SolutionStatus;
  support: Coordinate[];
  edges: DirectedEdge[];
  ranks?: Record<string, number>;
  min_x?: number;
  max_x?: number;
  max_y?: number;
  message?: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  coordinates: Coordinate[];
}
