// Shared pipe path geometry — used by both DiagramCanvas and useCanvasState
// Must match ConnectorLine rendering exactly.

import { Connector, CanvasElement } from "./canvasTypes";
import { stencilRegistry } from "./stencilRegistry";

export type Pt = { x: number; y: number };
type Side = "left" | "right" | "top" | "bottom";

export function getSide(x: number, y: number): Side {
  const d = [x, 1 - x, y, 1 - y];
  const m = Math.min(...d);
  if (m === d[0]) return "left";
  if (m === d[1]) return "right";
  if (m === d[2]) return "top";
  return "bottom";
}
// hello 
// hello
export const STUB = 12;
export function isHSide(s: Side) { return s === "left" || s === "right"; }

export function stubEnd(p: Pt, s: Side): Pt {
  if (s === "left")  return { x: p.x - STUB, y: p.y };
  if (s === "right") return { x: p.x + STUB, y: p.y };
  if (s === "top")   return { x: p.x, y: p.y - STUB };
  return                    { x: p.x, y: p.y + STUB };
}

/** Corrects a local side to world-space based on element rotation */
export function getWorldSide(localSide: Side, rotation: number): Side {
  const sides: Side[] = ["top", "right", "bottom", "left"];
  const idx = sides.indexOf(localSide);
  // Rotation is clockwise in degrees. 90 deg = 1 step forward in array.
  const steps = Math.round((rotation || 0) / 90);
  const newIdx = (idx + steps) % 4;
  return sides[newIdx < 0 ? newIdx + 4 : newIdx];
}

function defaultMiddle(s1: Pt, s2: Pt, fs: Side, ts: Side): Pt[] {
  const fH = isHSide(fs), tH = isHSide(ts);
  const EPS = 3;
  if (fH && tH) {
    if (Math.abs(s1.y - s2.y) < EPS) return [];
    const mx = (s1.x + s2.x) / 2;
    return [{ x: mx, y: s1.y }, { x: mx, y: s2.y }];
  }
  if (!fH && !tH) {
    if (Math.abs(s1.x - s2.x) < EPS) return [];
    const my = (s1.y + s2.y) / 2;
    return [{ x: s1.x, y: my }, { x: s2.x, y: my }];
  }
  if (fH) return [{ x: s2.x, y: s1.y }];
  return [{ x: s1.x, y: s2.y }];
}

export function buildOrthogonalPath(from: Pt, to: Pt, fs: Side, ts: Side, bends: Pt[]): Pt[] {
  const s1 = stubEnd(from, fs), s2 = stubEnd(to, ts);
  const mid = bends.length > 0 ? bends : defaultMiddle(s1, s2, fs, ts);
  const raw: Pt[] = [from, s1, ...mid, s2, to];
  
  const result: Pt[] = [{ ...raw[0] }];
  let nextIsH = isHSide(fs);

  for (let i = 1; i < raw.length; i++) {
    const prev = result[result.length - 1];
    const target = raw[i];
    
    let cur: Pt;
    if (nextIsH) { cur = { x: target.x, y: prev.y }; }
    else         { cur = { x: prev.x, y: target.y }; }

    if (Math.hypot(cur.x - prev.x, cur.y - prev.y) > 0.1) {
      result.push(cur);
    }
    nextIsH = !nextIsH;
  }

  // Ensure the final point is reached orthogonally.
  const last = result[result.length - 1];
  const dx = Math.abs(last.x - to.x);
  const dy = Math.abs(last.y - to.y);

  if (dx > 0.5 && dy > 0.5) {
    if (isHSide(ts)) {
      result.push({ x: last.x, y: to.y });
    } else {
      result.push({ x: to.x, y: last.y });
    }
  }
  result.push({ ...to });

  // Final cleanup: remove redundant collinear points with an even tighter tolerance
  const finalWaypoints: Pt[] = [result[0]];
  for (let i = 1; i < result.length - 1; i++) {
    const p = finalWaypoints[finalWaypoints.length - 1], c = result[i], n = result[i+1];
    const collinear = (Math.abs(p.x - c.x) < 0.5 && Math.abs(c.x - n.x) < 0.5) ||
                      (Math.abs(p.y - c.y) < 0.5 && Math.abs(c.y - n.y) < 0.5);
    if (!collinear) finalWaypoints.push(c);
  }
  if (result.length > 1) finalWaypoints.push(result[result.length - 1]);

  return finalWaypoints;
}

/** World position of a snap point on an element */
export function getSnapWorldPos(el: CanvasElement, snapId: string): Pt | null {
  const stencil = stencilRegistry.find(s => s.id === el.stencilId);
  if (!stencil) return null;
  const sp = stencil.snapPoints.find(p => p.id === snapId);
  if (!sp) return null;
  const spx = el.flipH ? 1 - sp.x : sp.x;
  const spy = el.flipV ? 1 - sp.y : sp.y;
  const lx = spx * el.width, ly = spy * el.height;
  const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
  const rad = ((el.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = lx - el.width / 2, dy = ly - el.height / 2;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** Full orthogonal waypoints for a connector */
export function connectorWaypoints(
  conn: Connector,
  elements: CanvasElement[],
): Pt[] | null {
  const fromEl = elements.find(e => e.id === conn.fromElementId);
  const toEl   = elements.find(e => e.id === conn.toElementId);
  if (!fromEl || !toEl) return null;

  const from = getSnapWorldPos(fromEl, conn.fromSnapId);
  const to   = getSnapWorldPos(toEl,   conn.toSnapId);
  if (!from || !to) return null;

  const fromStencil = stencilRegistry.find(s => s.id === fromEl.stencilId);
  const toStencil   = stencilRegistry.find(s => s.id === toEl.stencilId);
  const fromSnap = fromStencil?.snapPoints.find(p => p.id === conn.fromSnapId);
  const toSnap   = toStencil?.snapPoints.find(p => p.id === conn.toSnapId);

  const fsx = fromSnap ? (fromEl.flipH ? 1 - fromSnap.x : fromSnap.x) : 0.5;
  const fsy = fromSnap ? (fromEl.flipV ? 1 - fromSnap.y : fromSnap.y) : 0.5;
  const tsx = toSnap   ? (toEl.flipH   ? 1 - toSnap.x   : toSnap.x)   : 0.5;
  const tsy = toSnap   ? (toEl.flipV   ? 1 - toSnap.y   : toSnap.y)   : 0.5;

  const fs = getWorldSide(getSide(fsx, fsy), fromEl.rotation || 0);
  const ts = getWorldSide(getSide(tsx, tsy), toEl.rotation || 0);

  return buildOrthogonalPath(from, to, fs, ts, conn.bendPoints);
}

/**
 * Walk along the orthogonal path at normalised parameter t (0–1)
 * and return the world coordinate at that position.
 */
export function positionAlongPath(pts: Pt[], t: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return { ...pts[0] };

  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(len);
    totalLen += len;
  }
  if (totalLen < 0.001) return { ...pts[0] };

  const target = Math.max(0, Math.min(1, t)) * totalLen;
  let run = 0;
  for (let i = 0; i < segLens.length; i++) {
    if (run + segLens[i] >= target || i === segLens.length - 1) {
      const localT = segLens[i] < 0.001 ? 0 : (target - run) / segLens[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * localT,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * localT,
      };
    }
    run += segLens[i];
  }
  return { ...pts[pts.length - 1] };
}
