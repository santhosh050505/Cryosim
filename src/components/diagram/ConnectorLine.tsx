import React, { useRef } from "react";
import { Connector, CanvasElement, PIPE_RADIUS, PIPE_STYLES, PipeType } from "@/lib/canvasTypes";
import { stencilRegistry } from "@/lib/stencilRegistry";
import { connectorWaypoints, positionAlongPath, getSide, getWorldSide, buildOrthogonalPath, STUB, isHSide, stubEnd } from "@/lib/pipeGeometry";

interface ConnectorLineProps {
  connector: Connector;
  elements: CanvasElement[];
  isSelected: boolean;
  zoom: number;
  onSelect: (id: string) => void;
  onSetBendPoints: (connectorId: string, pts: { x: number; y: number }[]) => void;
  onSetBendPointsEnd?: () => void;
  /** If an element is mounted on this pipe, pass it here so the pipe renders with a gap */
  mountedElement?: CanvasElement;
}

type Pt = { x: number; y: number };
type Side = "left" | "right" | "top" | "bottom";

// ─── Snap point world position ────────────────────────────────────────────────
function getSnapPos(element: CanvasElement, snapId: string): Pt | null {
  const stencil = stencilRegistry.find(s => s.id === element.stencilId);
  if (!stencil) return null;
  const sp = stencil.snapPoints.find(p => p.id === snapId);
  if (!sp) return null;
  // Apply flip to snap point normalised coordinates before converting to world space
  const spx = (element.flipH ? 1 - sp.x : sp.x);
  const spy = (element.flipV ? 1 - sp.y : sp.y);
  const lx = spx * element.width, ly = spy * element.height;
  const cx = element.x + element.width / 2, cy = element.y + element.height / 2;
  const rad = ((element.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = lx - element.width / 2, dy = ly - element.height / 2;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

// ════════════════════════════════════════════════════════════════════════════
//  CORE MODEL
//
//  We store the pipe as a list of WAYPOINTS: [from, A, B, C, ..., to]
//  where every consecutive pair is EITHER same-X (vertical) OR same-Y (horizontal).
//
//  bendPoints in connector stores [A, B, C, ...] — the interior waypoints.
//  from and to are recomputed each render from element positions.
//
//  The first segment (from→A) always exits along fromSide.
//  The last  segment (Z→to)  always arrives along toSide (exits reversed).
//  A and the stubs are:
//    A  = stubEnd(from, fromSide)   — first waypoint after from
//    Z  = stubEnd(to,   toSide)     — last  waypoint before to
//
//  So the full list is: from, A(=stub1), [...middle bends...], Z(=stub2), to
//  But we only STORE the middle bends (not A and Z, they're always recomputed).
//
//  DEFAULT ROUTE (no user bends):
//    Computed once from the fromSide/toSide geometry.
//    Produces 0, 1, or 2 middle bends.
//
//  RENDERING:
//    pathPts = [from, stub1, ...middleBends, stub2, to]
//    All consecutive pairs are guaranteed axis-aligned.
//
//  EDITING:
//    Midpoint drag: slides ONE segment → updates its two neighbouring waypoints.
//    Corner  drag:  moves the corner    → updates that ONE waypoint.
//    Both only move in the allowed perpendicular direction.
// ════════════════════════════════════════════════════════════════════════════

function computeDefaultMiddle(
  stub1: Pt, stub2: Pt,
  fromSide: Side, toSide: Side
): Pt[] {
  const fH = isHSide(fromSide);
  const tH = isHSide(toSide);
  const EPS = 1;

  if (fH && tH) {
    // H→H: need one vertical bridge column
    if (Math.abs(stub1.y - stub2.y) < EPS) return []; // already aligned
    const mx = (stub1.x + stub2.x) / 2;
    return [{ x: mx, y: stub1.y }, { x: mx, y: stub2.y }];
  }
  if (!fH && !tH) {
    // V→V: need one horizontal bridge row
    if (Math.abs(stub1.x - stub2.x) < EPS) return [];
    const my = (stub1.y + stub2.y) / 2;
    return [{ x: stub1.x, y: my }, { x: stub2.x, y: my }];
  }
  // H→V or V→H: single elbow corner
  if (fH) return [{ x: stub2.x, y: stub1.y }];
  return [{ x: stub1.x, y: stub2.y }];
}

// Build the full point list from stored middle bends
// Guarantees: every consecutive pair shares X or Y exactly.
function buildWaypoints(
  from: Pt, to: Pt,
  fromSide: Side, toSide: Side,
  middleBends: Pt[]
): Pt[] {
  return buildOrthogonalPath(from, to, fromSide, toSide, middleBends);
}

function toSVGPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

/**
 * Build two path strings that split the full path at parameter t,
 * leaving a gap of `gapPx` pixels on each side of the split point.
 * Returns [beforePath, afterPath] or null if path is too short.
 */
function buildSplitPaths(
  pts: Pt[], t: number, gapPx: number
): { before: string; after: string; splitPt: Pt } | null {
  if (pts.length < 2) return null;

  // Compute total length and segment lengths
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen < gapPx * 2 + 1) return null;

  const splitPt = positionAlongPath(pts, t);

  // Walk path to collect points before gap start
  const gapStart = Math.max(0, t * totalLen - gapPx);
  const gapEnd   = Math.min(totalLen, t * totalLen + gapPx);

  const beforePts: Pt[] = [];
  const afterPts: Pt[] = [];

  let run = 0;
  let beforeDone = false;
  let afterStarted = false;

  // Always include first point in before
  beforePts.push({ ...pts[0] });

  for (let i = 0; i < segLens.length; i++) {
    const segStart = run;
    const segEnd = run + segLens[i];
    const a = pts[i], b = pts[i+1];

    if (!beforeDone) {
      if (segEnd <= gapStart) {
        // Entire segment is before gap
        beforePts.push({ ...b });
      } else {
        // Segment crosses gap start — add interpolated point
        const localT = (gapStart - segStart) / segLens[i];
        const gx = a.x + (b.x - a.x) * Math.max(0, Math.min(1, localT));
        const gy = a.y + (b.y - a.y) * Math.max(0, Math.min(1, localT));
        beforePts.push({ x: gx, y: gy });
        beforeDone = true;
      }
    }

    if (beforeDone && !afterStarted) {
      if (segEnd <= gapEnd) {
        // Still in the gap, skip
      } else {
        // Segment crosses gap end — start after path
        const localT = (gapEnd - segStart) / segLens[i];
        const gx = a.x + (b.x - a.x) * Math.max(0, Math.min(1, localT));
        const gy = a.y + (b.y - a.y) * Math.max(0, Math.min(1, localT));
        afterPts.push({ x: gx, y: gy });
        afterPts.push({ ...b });
        afterStarted = true;
      }
    } else if (afterStarted) {
      afterPts.push({ ...b });
    }

    run = segEnd;
  }

  if (beforePts.length < 2 || afterPts.length < 2) return null;

  return {
    before: toSVGPath(beforePts),
    after: toSVGPath(afterPts),
    splitPt,
  };
}

// Returns true if segment A→B is horizontal
function segH(a: Pt, b: Pt): boolean {
  return Math.abs(b.y - a.y) < Math.abs(b.x - a.x);
}

// ─── Pipe visual ──────────────────────────────────────────────────────────────
function PipeStroke({ pathD, pipeType, isSelected }: {
  pathD: string; pipeType: PipeType; isSelected: boolean;
}) {
  const s = PIPE_STYLES[pipeType], r = s.radius;
  return (
    <g>
      <path d={pathD} fill="none" stroke={s.colorBot}       strokeWidth={r * 2}    strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />
      <path d={pathD} fill="none" stroke={s.colorMid}       strokeWidth={r * 1.6}  strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none" }} />
      <path d={pathD} fill="none" stroke={s.colorHighlight} strokeWidth={r * 0.45} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} style={{ pointerEvents: "none" }} />
      {isSelected && <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth={r * 2 + 5} strokeLinecap="round" strokeLinejoin="round" opacity={0.3} className="drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" style={{ pointerEvents: "none" }} />}
    </g>
  );
}

// ─── Arrow head at destination (B) end of pipe ───────────────────────────────
// The last segment is always stub2→to (the STUB leading into the stencil).
// We place the arrow ON this last segment, apex pointing toward `to`.
function PipeArrow({ pathPts, pipeType }: { pathPts: Pt[]; pipeType: PipeType }) {
  if (pathPts.length < 2) return null;
  const s = PIPE_STYLES[pipeType];
  const r = s.radius;

  // Last segment: second-last point → last point (to)
  const segA = pathPts[pathPts.length - 2];
  const segB = pathPts[pathPts.length - 1]; // = `to`, the snap point

  const dx = segB.x - segA.x;
  const dy = segB.y - segA.y;
  const segLen = Math.hypot(dx, dy);
  if (segLen < 1) return null;

  const ux = dx / segLen; // unit along flow direction
  const uy = dy / segLen;
  const px = -uy;         // perpendicular
  const py =  ux;

  const arrowLen  = r * 3.0;
  const arrowHalf = r * 1.4;

  // Apex is at `to` (the snap point itself) — arrow tip right at the stencil entry
  const apex = { x: segB.x,              y: segB.y };
  const base = { x: apex.x - ux * arrowLen, y: apex.y - uy * arrowLen };
  const bl   = { x: base.x + px * arrowHalf, y: base.y + py * arrowHalf };
  const br   = { x: base.x - px * arrowHalf, y: base.y - py * arrowHalf };

  const pts = `${apex.x.toFixed(1)},${apex.y.toFixed(1)} ${bl.x.toFixed(1)},${bl.y.toFixed(1)} ${br.x.toFixed(1)},${br.y.toFixed(1)}`;

  return (
    <g style={{ pointerEvents: "none" }}>
      <polygon points={pts} fill="white" opacity={0.95} />
      <polygon points={pts} fill={s.colorMid} opacity={0.55} />
      <polygon points={pts} fill="none" stroke={s.colorBot} strokeWidth={1.2} />
    </g>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const ConnectorLine: React.FC<ConnectorLineProps> = ({
  connector, elements, isSelected, zoom, onSelect, onSetBendPoints, onSetBendPointsEnd, mountedElement,
}) => {
  const fromEl = elements.find(e => e.id === connector.fromElementId);
  const toEl   = elements.find(e => e.id === connector.toElementId);
  if (!fromEl || !toEl) return null;

  const from = getSnapPos(fromEl, connector.fromSnapId);
  const to   = getSnapPos(toEl,   connector.toSnapId);
  if (!from || !to) return null;

  const fromStencil = stencilRegistry.find(s => s.id === fromEl.stencilId);
  const toStencil   = stencilRegistry.find(s => s.id === toEl.stencilId);
  const fromSnap    = fromStencil?.snapPoints.find(p => p.id === connector.fromSnapId);
  const toSnap      = toStencil?.snapPoints.find(p => p.id === connector.toSnapId);

  const pipeType: PipeType = connector.pipeType ?? "suction";
  // Apply flip to snap coordinates when computing exit side
  const fromSnapX = fromSnap ? (fromEl.flipH ? 1 - fromSnap.x : fromSnap.x) : 0.5;
  const fromSnapY = fromSnap ? (fromEl.flipV ? 1 - fromSnap.y : fromSnap.y) : 0.5;
  const toSnapX   = toSnap   ? (toEl.flipH   ? 1 - toSnap.x   : toSnap.x)   : 0.5;
  const toSnapY   = toSnap   ? (toEl.flipV   ? 1 - toSnap.y   : toSnap.y)   : 0.5;
  const fromSide = getWorldSide(getSide(fromSnapX, fromSnapY), fromEl.rotation || 0);
  const toSide   = getWorldSide(getSide(toSnapX,   toSnapY), toEl.rotation   || 0);

  const stub1 = stubEnd(from, fromSide);
  const stub2 = stubEnd(to,   toSide);

  // The "middle" bends: what's stored, or default if nothing stored yet
  const middleBends: Pt[] = connector.bendPoints.length > 0
    ? connector.bendPoints
    : computeDefaultMiddle(stub1, stub2, fromSide, toSide);

  // Full rendered waypoints list
  const pathPts = buildWaypoints(from, to, fromSide, toSide, middleBends);
  const pathD   = toSVGPath(pathPts);

  // No gap — pipe renders continuously through the mounted element.
  // The element SVG sits on top of the pipe naturally via z-order.
  const splitResult = null;

  // ══════════════════════════════════════════════════════════════════════════
  //  SEGMENT MIDPOINT HANDLE  (circle ●)
  //
  //  For segment i (pathPts[i] → pathPts[i+1]):
  //    • H segment → can slide in Y.  Dragging changes the Y of this segment.
  //    • V segment → can slide in X.  Dragging changes the X of this segment.
  //
  //  When a segment slides, both its endpoints (waypoints[i] and waypoints[i+1])
  //  need to move, but only in the perpendicular axis.
  //
  //  We work with the FULL waypoints list (pathPts) — not bendPoints directly.
  //  We recompute what to store as middleBends from the updated full list.
  //
  //  The mapping: pathPts = [from(0), stub1(1), ...middle..., stub2(N-2), to(N-1)]
  //  The "editable" range is [1 .. N-2] (inclusive) = pathPts without from/to.
  //  Storing: middleBends = pathPts[2 .. N-3]  (strip stub1 and stub2 too)
  //           BUT: if there are no middles, store [] and let default handle it.
  //
  //  Actually, simplest: store ALL of pathPts[1..N-2] as bendPoints.
  //  Then buildWaypoints uses them directly (bypassing defaultBends).
  //  This gives us full control.
  // ══════════════════════════════════════════════════════════════════════════

  // Helper: extract storable bends from a full waypoints list
  // Storable = everything except from (index 0) and to (last index)
  function extractBends(pts: Pt[]): Pt[] {
    return pts.slice(1, -1).map(p => ({ ...p }));
  }

  const MidHandle: React.FC<{ segIdx: number }> = ({ segIdx }) => {
    const ptA = pathPts[segIdx];
    const ptB = pathPts[segIdx + 1];
    if (!ptA || !ptB) return null;
    const len = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y);
    if (len < 6) return null;

    const isH = segH(ptA, ptB);
    const mid: Pt = { x: (ptA.x + ptB.x) / 2, y: (ptA.y + ptB.y) / 2 };

    const dragStart   = useRef({ cx: 0, cy: 0 });
    const dragPts     = useRef<Pt[]>([]);  // snapshot of pathPts at drag start
    const dragAxisVal = useRef(0);          // Y (if H) or X (if V) at drag start

    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const svg = (e.target as SVGElement).closest("svg");
      if (!svg) return;
      const viewportG = svg.querySelector('.main-viewport-g') as SVGGElement || svg;
      const pt = svg.createSVGPoint();

      const getPointInWorld = (clientX: number, clientY: number) => {
        pt.x = clientX;
        pt.y = clientY;
        const ctm = viewportG.getScreenCTM();
        return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
      };

      const mouseStart = getPointInWorld(e.clientX, e.clientY);
      dragPts.current     = pathPts.map(p => ({ ...p }));
      dragAxisVal.current = isH ? ptA.y : ptA.x;
      document.body.style.userSelect = "none";

      // Ensure we have internal waypoints to move.
      if (connector.bendPoints.length === 0) {
        let stablePts = pathPts;
        if (pathPts.length < 4) {
          const s1 = stubEnd(from, fromSide);
          const s2 = stubEnd(to, toSide);
          stablePts = [from, s1, s2, to];
        }
        onSetBendPoints(connector.id, extractBends(stablePts));
        dragPts.current = stablePts.map(p => ({ ...p }));
      }

      const onMove = (ev: MouseEvent) => {
        ev.preventDefault();
        const mouseCur = getPointInWorld(ev.clientX, ev.clientY);
        const dx = mouseCur.x - mouseStart.x;
        const dy = mouseCur.y - mouseStart.y;

        // Clone snapshot
        const newPts = dragPts.current.map(p => ({ ...p }));
        const axisVal = dragAxisVal.current;
        const snapping = !ev.shiftKey;
        const GRID = 20;

        if (isH) {
          const rawY = axisVal + dy;
          const newY = snapping ? Math.round(rawY / GRID) * GRID : rawY;
          for (let i = 0; i < newPts.length; i++) {
            if (i === 0 || i === newPts.length - 1) continue;
            if (Math.abs(newPts[i].y - axisVal) < 10) {
              newPts[i] = { x: newPts[i].x, y: newY };
            }
          }
        } else {
          const rawX = axisVal + dx;
          const newX = snapping ? Math.round(rawX / GRID) * GRID : rawX;
          for (let i = 0; i < newPts.length; i++) {
            if (i === 0 || i === newPts.length - 1) continue;
            if (Math.abs(newPts[i].x - axisVal) < 10) {
              newPts[i] = { x: newX, y: newPts[i].y };
            }
          }
        }

        onSetBendPoints(connector.id, extractBends(newPts));
      };

      const onUp = () => {
        document.body.style.userSelect = "";
        onSetBendPointsEnd?.();
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    return (
      <g onMouseDown={handleMouseDown}>
        <circle 
          cx={mid.x} cy={mid.y} r={20} 
          fill="transparent" 
          style={{ cursor: isH ? "ns-resize" : "ew-resize", pointerEvents: "all" }} 
        />
        <circle
          cx={mid.x} cy={mid.y} r={isSelected ? 6 : 0}
          fill="white" stroke="hsl(var(--primary))" strokeWidth={2.5}
          className="drop-shadow-md hover:scale-125 transition-transform duration-200"
          style={{ pointerEvents: "none", opacity: isSelected ? 1 : 0 }}
        />
      </g>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  CORNER HANDLE  (square ■)
  //
  //  Corner at pathPts[ptIdx] between:
  //    incoming segment: pathPts[ptIdx-1] → pathPts[ptIdx]
  //    outgoing segment: pathPts[ptIdx]   → pathPts[ptIdx+1]
  //
  //  The corner can ONLY move perpendicular to the INCOMING segment:
  //    incoming H → corner moves only in Y (up/down)
  //    incoming V → corner moves only in X (left/right)
  //
  //  Moving the corner changes pathPts[ptIdx] in one axis only.
  //  The adjacent segments automatically stretch/shrink to accommodate.
  //  We snapshot pathPts and update just index ptIdx.
  // ══════════════════════════════════════════════════════════════════════════

  const CornerHandle: React.FC<{ ptIdx: number }> = ({ ptIdx }) => {
    const pt     = pathPts[ptIdx];
    const prevPt = pathPts[ptIdx - 1];
    const nextPt = pathPts[ptIdx + 1];
    if (!pt || !prevPt || !nextPt) return null;

    const inH = segH(prevPt, pt);    // incoming segment is horizontal?
    const moveInY = inH;             // if incoming=H, corner moves in Y
    const cursor = moveInY ? "ns-resize" : "ew-resize";

    const dragStart = useRef({ cx: 0, cy: 0 });
    const dragPts   = useRef<Pt[]>([]);
    const dragCornerVal = useRef(0); // Y (if moveInY) or X at drag start

    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const svg = (e.target as SVGElement).closest("svg");
      if (!svg) return;
      const viewportG = svg.querySelector('.main-viewport-g') as SVGGElement || svg;
      const pt = svg.createSVGPoint();

      const getPointInWorld = (clientX: number, clientY: number) => {
        pt.x = clientX;
        pt.y = clientY;
        const ctm = viewportG.getScreenCTM();
        return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
      };

      const mouseStart = getPointInWorld(e.clientX, e.clientY);
      dragPts.current      = pathPts.map(p => ({ ...p }));
      dragCornerVal.current = moveInY ? pt.y : pt.x;
      document.body.style.userSelect = "none";

      if (connector.bendPoints.length === 0) {
        onSetBendPoints(connector.id, extractBends(pathPts));
        dragPts.current = pathPts.map(p => ({ ...p }));
      }

      const onMove = (ev: MouseEvent) => {
        ev.preventDefault();
        const mouseCur = getPointInWorld(ev.clientX, ev.clientY);
        const dx = mouseCur.x - mouseStart.x;
        const dy = mouseCur.y - mouseStart.y;

        const newPts = dragPts.current.map(p => ({ ...p }));

        if (moveInY) {
          // Corner moves vertically → update Y of this point only
          newPts[ptIdx] = { x: newPts[ptIdx].x, y: dragCornerVal.current + dy };
        } else {
          // Corner moves horizontally → update X of this point only
          newPts[ptIdx] = { x: dragCornerVal.current + dx, y: newPts[ptIdx].y };
        }

        onSetBendPoints(connector.id, extractBends(newPts));
      };

      const onUp = () => {
        document.body.style.userSelect = "";
        onSetBendPointsEnd?.();
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    return (
      <g onMouseDown={handleMouseDown}>
        <circle 
          cx={pt.x} cy={pt.y} r={20} 
          fill="transparent" 
          style={{ cursor, pointerEvents: "all" }} 
        />
        <rect
          x={pt.x - 7} y={pt.y - 7} width={14} height={14}
          fill="white" stroke="hsl(var(--primary))" strokeWidth={2.5} rx={3}
          className="drop-shadow-md hover:scale-125 transition-transform duration-200"
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  };

  // Inner pts: all except from and to — these get handles
  const innerCount = pathPts.length - 2;

  return (
    <g>
      {/* Wide click target — always full path */}
      <path
        d={pathD} fill="none" stroke="transparent"
        strokeWidth={isSelected ? PIPE_STYLES[pipeType].radius * 2 + 18 : PIPE_STYLES[pipeType].radius * 2 + 6}
        strokeLinecap="round" strokeLinejoin="round"
        style={{ cursor: "pointer", pointerEvents: "stroke" }}
        onClick={e => { e.stopPropagation(); onSelect(connector.id); }}
      />

      {/* Pipe visual — continuous, element sits on top via z-order */}
      <PipeStroke pathD={pathD} pipeType={pipeType} isSelected={isSelected} />

      {/* Arrow at the destination (B / to) end of the pipe */}
      <PipeArrow pathPts={pathPts} pipeType={pipeType} />

      {isSelected && (
        <g>
          {/* Midpoint handle on every segment (circle) */}
          {Array.from({ length: pathPts.length - 1 }, (_, i) => (
            <MidHandle key={`m${i}`} segIdx={i} />
          ))}
          {/* Corner handle on every interior point (square) */}
          {Array.from({ length: pathPts.length - 2 }, (_, i) => (
            <CornerHandle key={`c${i}`} ptIdx={i + 1} />
          ))}
        </g>
      )}
    </g>
  );
};

export default ConnectorLine;