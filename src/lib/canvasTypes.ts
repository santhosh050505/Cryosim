export interface CanvasElement {
  id: string;
  stencilId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flipH?: boolean;
  flipV?: boolean;
  // When this element is placed on a pipe, store which connector and where (0-1)
  pipeMountConnectorId?: string;
  pipeMountT?: number;
  // PRV specific data
  prvData?: {
    manufacturer: string;
    typeOfValve: string;
    diameter: string;
    length: string;
    workingPressure: string;
    refrigerant: string;
    connectionSize?: string;
  };
  // Liquid Receiver specific data
  receiverData?: {
    manufacturer: string;
    productType: string;
    orientation: string;
  };
}

export type PipeType = "suction" | "discharge" | "liquid" | "water";

export interface Connector {
  id: string;
  fromElementId: string;
  fromSnapId: string;
  toElementId: string;
  toSnapId: string;
  bendPoints: { x: number; y: number }[];
  pipeType: PipeType;
  isForward?: boolean;
}

export interface ViewportState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export const GRID_SIZE = 20;
export const SNAP_THRESHOLD = 10;
export const MIN_ELEMENT_SIZE = 40;
export const PIPE_RADIUS = 6;

export const PIPE_STYLES: Record<PipeType, {
  colorTop: string; colorMid: string; colorBot: string;
  colorHighlight: string; label: string;
  radius: number;
}> = {
  suction:   { colorTop: "#90caf9", colorMid: "#1565c0", colorBot: "#1a237e", colorHighlight: "#bbdefb", label: "Suction Line", radius: 6 },
  discharge: { colorTop: "#ef9a9a", colorMid: "#c62828", colorBot: "#7f0000", colorHighlight: "#ffcdd2", label: "Discharge Line", radius: 6 },
  liquid:    { colorTop: "#a5d6a7", colorMid: "#2e7d32", colorBot: "#003300", colorHighlight: "#c8e6c9", label: "Liquid Line", radius: 6 },
  water:     { colorTop: "#f5f5f5", colorMid: "#bdbdbd", colorBot: "#757575", colorHighlight: "#ffffff", label: "Water Line", radius: 8.5 },
};

export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function generateId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Direct-snap configuration ───────────────────────────────────────────────
// Lists pairs of stencils where ANY snap point on stencilA can directly snap
// to ANY snap point on stencilB — no pipe is drawn between them.
export interface DirectSnapStencilPair {
  stencilA: string;
  stencilB: string;
}

export const DIRECT_SNAP_STENCILS: DirectSnapStencilPair[] = [
  { stencilA: "Liquid_Receiver_", stencilB: "PRV" },
  { stencilA: "Suction_Accumulator", stencilB: "PRV" },
];

// How close (px) two snap points must be before they lock
export const DIRECT_SNAP_DIST = 15;

// Legacy alias kept for compatibility
export interface DirectSnapPair {
  stencilA: string; snapA: string;
  stencilB: string; snapB: string;
}
export const DIRECT_SNAP_PAIRS: DirectSnapPair[] = [];

// ─── Pipe-mount configuration ──────────────────────────────────────────────
// Stencils that snap onto a pipe when dropped near one.
// snapId = the snap point on the stencil that aligns to the pipe path.
export interface PipeMountStencil {
  stencilId: string;
  snapId: string;
}

export const PIPE_MOUNT_STENCILS: PipeMountStencil[] = [
  { stencilId: "Pressure Switch", snapId: "bottom" },
  // Add more stencils here to allow them to mount onto pipes
];

// Threshold (px) within which a pipe-mountable stencil snaps to the pipe
export const PIPE_MIDPOINT_SNAP_THRESHOLD = 50;
// How close to the midpoint (fraction 0–1) before snapping exactly to t=0.5
export const PIPE_MIDPOINT_T_SNAP_RANGE = 0.15;