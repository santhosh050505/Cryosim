import { useState, useCallback, useRef, useEffect } from "react";
import {
  CanvasElement, Connector, ViewportState, PipeType,
  generateId, snapToGrid, SNAP_THRESHOLD, MIN_ELEMENT_SIZE,
  DIRECT_SNAP_STENCILS, DIRECT_SNAP_DIST, PIPE_MOUNT_STENCILS,
} from "@/lib/canvasTypes";
import { stencilRegistry } from "@/lib/stencilRegistry";
import { connectorWaypoints, positionAlongPath, getSnapWorldPos } from "@/lib/pipeGeometry";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if two stencils are configured for direct-snapping */
function areDirectSnapStencils(stencilIdA: string, stencilIdB: string): boolean {
  return DIRECT_SNAP_STENCILS.some(p =>
    (p.stencilA === stencilIdA && p.stencilB === stencilIdB) ||
    (p.stencilA === stencilIdB && p.stencilB === stencilIdA)
  );
}

/**
 * Try to find the closest snap point pair between movingEl and any other element.
 * Checks ALL combinations of snap points on both stencils.
 * Returns the locked position for movingEl if any pair is within DIRECT_SNAP_DIST.
 */
function tryDirectSnap(
  movingEl: CanvasElement,
  others: CanvasElement[],
): { x: number; y: number } | null {
  const movingStencil = stencilRegistry.find(s => s.id === movingEl.stencilId);
  if (!movingStencil) return null;

  let bestDist = DIRECT_SNAP_DIST;
  let bestPos: { x: number; y: number } | null = null;

  for (const other of others) {
    if (!areDirectSnapStencils(movingEl.stencilId, other.stencilId)) continue;

    const otherStencil = stencilRegistry.find(s => s.id === other.stencilId);
    if (!otherStencil) continue;

    // Check every combination of snap points on both stencils
    for (const mySnap of movingStencil.snapPoints) {
      const myPos = getSnapWorldPos(movingEl, mySnap.id);
      if (!myPos) continue;

      for (const otherSnap of otherStencil.snapPoints) {
        const otherPos = getSnapWorldPos(other, otherSnap.id);
        if (!otherPos) continue;

        const dist = Math.hypot(myPos.x - otherPos.x, myPos.y - otherPos.y);
        if (dist < bestDist) {
          bestDist = dist;
          // Move movingEl so this snap point aligns exactly with other's snap point
          bestPos = {
            x: movingEl.x + (otherPos.x - myPos.x),
            y: movingEl.y + (otherPos.y - myPos.y),
          };
        }
      }
    }
  }

  return bestPos;
}

/**
 * Check if two elements are currently directly-snapped together.
 * Returns true if ANY snap point pair between them is within 4px.
 */
export function areDirectlySnapped(a: CanvasElement, b: CanvasElement): boolean {
  if (!areDirectSnapStencils(a.stencilId, b.stencilId)) return false;

  const stencilA = stencilRegistry.find(s => s.id === a.stencilId);
  const stencilB = stencilRegistry.find(s => s.id === b.stencilId);
  if (!stencilA || !stencilB) return false;

  for (const snapA of stencilA.snapPoints) {
    const posA = getSnapWorldPos(a, snapA.id);
    if (!posA) continue;
    for (const snapB of stencilB.snapPoints) {
      const posB = getSnapWorldPos(b, snapB.id);
      if (!posB) continue;
      if (Math.hypot(posA.x - posB.x, posA.y - posB.y) < 4) return true;
    }
  }
  return false;
}

// ─── Snapshot ────────────────────────────────────────────────────────────────
interface Snapshot {
  elements: CanvasElement[];
  connectors: Connector[];
}

function clone(els: CanvasElement[], conns: Connector[]): Snapshot {
  return {
    elements:   els.map(e => ({ ...e })),
    connectors: conns.map(c => ({ ...c, bendPoints: c.bendPoints.map(p => ({ ...p })) })),
  };
}

const MAX_HISTORY = 100;

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useCanvasState() {
  const [elements, setElements] = useState<CanvasElement[]>(() => {
    try {
      const saved = localStorage.getItem("cryosim_current_project");
      return saved ? JSON.parse(saved).elements : [];
    } catch { return []; }
  });
  const [connectors, setConnectors] = useState<Connector[]>(() => {
    try {
      const saved = localStorage.getItem("cryosim_current_project");
      return saved ? JSON.parse(saved).connectors : [];
    } catch { return []; }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const [viewport,   setViewport]   = useState<ViewportState>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [snapLines,  setSnapLines]  = useState<{ x?: number; y?: number }>({});
  const [connectingFrom, setConnectingFrom] = useState<{ elementId: string; snapId: string } | null>(null);
  const [activePipeType, setActivePipeType] = useState<PipeType>("suction");
  const [projectName, setProjectName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("cryosim_current_project");
      return saved ? JSON.parse(saved).projectName : "";
    } catch { return ""; }
  });
  const [refrigerant, setRefrigerant] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("cryosim_current_project");
      return saved ? JSON.parse(saved).refrigerant : "";
    } catch { return ""; }
  });

  const history      = useRef<Snapshot[]>([{ elements, connectors }]);
  const historyIndex = useRef(0);
  const [, forceRender] = useState(0);

  // ── Persistence ─────────────────────────────────────────────────────────────
  
  // Save current state to localStorage on every change
  useEffect(() => {
    const data = { elements, connectors, projectName, refrigerant };
    localStorage.setItem("cryosim_current_project", JSON.stringify(data));
  }, [elements, connectors, projectName, refrigerant]);

  // Cleanup: If connectingFrom refers to an element that was deleted (via undo etc), clear it
  useEffect(() => {
    if (connectingFrom && !elements.find(e => e.id === connectingFrom.elementId)) {
      setConnectingFrom(null);
    }
  }, [elements, connectingFrom]);

  const canUndo = historyIndex.current > 0;
  const canRedo = historyIndex.current < history.current.length - 1;

  const pushHistory = useCallback((els: CanvasElement[], conns: Connector[]) => {
    const snap = clone(els, conns);
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(snap);
    if (history.current.length > MAX_HISTORY) history.current.shift();
    historyIndex.current = history.current.length - 1;
    forceRender(n => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIndex.current <= 0) return;
    historyIndex.current -= 1;
    const snap = history.current[historyIndex.current];
    setElements(snap.elements.map(e => ({ ...e })));
    setConnectors(snap.connectors.map(c => ({ ...c, bendPoints: c.bendPoints.map(p => ({ ...p })) })));
    setSelectedId(null); 
    setSelectedConnectorId(null);
    setConnectingFrom(null);
    forceRender(n => n + 1);
  }, []);

  const redo = useCallback(() => {
    if (historyIndex.current >= history.current.length - 1) return;
    historyIndex.current += 1;
    const snap = history.current[historyIndex.current];
    setElements(snap.elements.map(e => ({ ...e })));
    setConnectors(snap.connectors.map(c => ({ ...c, bendPoints: c.bendPoints.map(p => ({ ...p })) })));
    setSelectedId(null); 
    setSelectedConnectorId(null);
    setConnectingFrom(null);
    forceRender(n => n + 1);
  }, []);

  // ── Elements ─────────────────────────────────────────────────────────────

  const addElement = useCallback((stencilId: string, x: number, y: number, extraProps?: Partial<CanvasElement>) => {
    const stencil = stencilRegistry.find(s => s.id === stencilId);
    if (!stencil) return;
    const el: CanvasElement = {
      id: generateId(), stencilId,
      x: snapToGrid(x - stencil.width / 2),
      y: snapToGrid(y - stencil.height / 2),
      width: stencil.width, height: stencil.height,
      rotation: 0, flipH: false, flipV: false,
      ...extraProps,
    };
    setElements(prev => {
      const next = [...prev, el];
      setConnectors(conns => { pushHistory(next, conns); return conns; });
      return next;
    });
    setSelectedId(el.id);
    return el;
  }, [pushHistory]);

  const moveElement = useCallback((id: string, newX: number, newY: number) => {
    setElements(prev => {
      const target = prev.find(e => e.id === id);
      if (!target) return prev;

      if (target.pipeMountConnectorId !== undefined) {
        const conn = connectors.find(c => c.id === target.pipeMountConnectorId);
        if (!conn) return prev;
        const pts = connectorWaypoints(conn, prev);
        if (!pts || pts.length < 2) return prev;
        const cx = newX + target.width / 2;
        const cy = newY + target.height / 2;
        const segLens: number[] = [];
        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const len = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
          segLens.push(len);
          totalLen += len;
        }
        if (totalLen < 1) return prev;
        let bestT = target.pipeMountT ?? 0.5;
        let bestDist = Infinity;
        let runLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
          const ax = pts[i].x, ay = pts[i].y;
          const bx = pts[i+1].x, by = pts[i+1].y;
          const dx = bx - ax, dy = by - ay;
          const len2 = dx*dx + dy*dy;
          if (len2 < 0.01) { runLen += segLens[i]; continue; }
          let localT = ((cx - ax)*dx + (cy - ay)*dy) / len2;
          localT = Math.max(0, Math.min(1, localT));
          const globalT = Math.max(0.03, Math.min(0.97, (runLen + localT * segLens[i]) / totalLen));
          const px = ax + localT*dx, py = ay + localT*dy;
          const dist = Math.hypot(cx - px, cy - py);
          if (dist < bestDist) { bestDist = dist; bestT = globalT; }
          runLen += segLens[i];
        }
        if (Math.abs(bestT - 0.5) < 0.08) bestT = 0.5;
        return prev.map(e => e.id === id ? { ...e, pipeMountT: bestT } : e);
      }

      const others = prev.filter(e => e.id !== id);
      let sx = snapToGrid(newX), sy = snapToGrid(newY);
      const lines: { x?: number; y?: number } = {};
      const tcx = sx + target.width / 2, tcy = sy + target.height / 2;
      for (const o of others) {
        if (o.pipeMountConnectorId !== undefined) continue;
        if (areDirectlySnapped(target, o)) continue;
        const ocx = o.x + o.width / 2, ocy = o.y + o.height / 2;
        if (Math.abs(tcx - ocx) < SNAP_THRESHOLD) { sx = ocx - target.width / 2; lines.x = ocx; }
        if (Math.abs(tcy - ocy) < SNAP_THRESHOLD) { sy = ocy - target.height / 2; lines.y = ocy; }
        if (Math.abs(sx - (o.x + o.width))       < SNAP_THRESHOLD) { sx = o.x + o.width;      lines.x = sx; }
        if (Math.abs((sx + target.width) - o.x)  < SNAP_THRESHOLD) { sx = o.x - target.width; lines.x = o.x; }
        if (Math.abs(sy - (o.y + o.height))       < SNAP_THRESHOLD) { sy = o.y + o.height;      lines.y = sy; }
        if (Math.abs((sy + target.height) - o.y) < SNAP_THRESHOLD) { sy = o.y - target.height; lines.y = o.y; }
      }
      const movingEl = { ...target, x: sx, y: sy };
      const locked = tryDirectSnap(movingEl, others.filter(o => !areDirectlySnapped(target, o)));
      if (locked) { sx = locked.x; sy = locked.y; }
      const dx = sx - target.x;
      const dy = sy - target.y;
      setSnapLines(lines);
      return prev.map(e => {
        if (e.id === id) return { ...e, x: sx, y: sy };
        if (areDirectlySnapped(target, e)) return { ...e, x: e.x + dx, y: e.y + dy };
        return e;
      });
    });
  }, [connectors]);

  const moveElementEnd = useCallback(() => {
    setElements(prev => {
      setConnectors(conns => { pushHistory(prev, conns); return conns; });
      return prev;
    });
  }, [pushHistory]);

  const resizeElement = useCallback((id: string, w: number, h: number, x?: number, y?: number) => {
    setElements(prev => prev.map(e => {
      if (e.id !== id) return e;
      return {
        ...e,
        width:  Math.max(MIN_ELEMENT_SIZE, w),
        height: Math.max(MIN_ELEMENT_SIZE, h),
        ...(x !== undefined ? { x } : {}),
        ...(y !== undefined ? { y } : {}),
      };
    }));
  }, []);

  const resizeElementEnd = useCallback(() => {
    setElements(prev => {
      setConnectors(conns => { pushHistory(prev, conns); return conns; });
      return prev;
    });
  }, [pushHistory]);

  const clearSnapLines = useCallback(() => setSnapLines({}), []);

  const rotateElement = useCallback((id: string, absoluteAngle: number) => {
    setElements(prev => {
      const next = prev.map(e => e.id !== id ? e : { ...e, rotation: ((absoluteAngle % 360) + 360) % 360 });
      setConnectors(conns => { pushHistory(next, conns); return conns; });
      return next;
    });
  }, [pushHistory]);

  const flipElement = useCallback((id: string, axis: "H" | "V") => {
    setElements(prev => {
      const next = prev.map(e => {
        if (e.id !== id) return e;
        return axis === "H" ? { ...e, flipH: !e.flipH } : { ...e, flipV: !e.flipV };
      });
      setConnectors(conns => { pushHistory(next, conns); return conns; });
      return next;
    });
  }, [pushHistory]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setElements(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
      setConnectors(conns => { pushHistory(next, conns); return conns; });
      return next;
    });
  }, [pushHistory]);

  const deleteSelected = useCallback(() => {
    if (selectedConnectorId) {
      setElements(prev => prev.map(e =>
        e.pipeMountConnectorId === selectedConnectorId
          ? { ...e, pipeMountConnectorId: undefined, pipeMountT: undefined }
          : e
      ));
      setConnectors(prev => {
        const next = prev.filter(c => c.id !== selectedConnectorId);
        setElements(els => { pushHistory(els, next); return els; });
        return next;
      });
      setSelectedConnectorId(null);
      return;
    }
    // If routing from this element, cancel
    if (connectingFrom?.elementId === selectedId) {
      setConnectingFrom(null);
    }

    setElements(prev => {
      const next = prev.filter(e => e.id !== selectedId);
      setConnectors(conns => {
        const nextConns = conns.filter(c => c.fromElementId !== selectedId && c.toElementId !== selectedId);
        pushHistory(next, nextConns);
        return nextConns;
      });
      return next;
    });
    setSelectedId(null);
  }, [selectedId, selectedConnectorId, connectingFrom, pushHistory]);

  // ── Connections ───────────────────────────────────────────────────────────

  const startConnection = useCallback((elementId: string, snapId: string) => {
    setConnectingFrom({ elementId, snapId });
  }, []);

  const completeConnection = useCallback((toElementId: string, toSnapId: string) => {
    if (!connectingFrom) return;
    if (connectingFrom.elementId === toElementId) { setConnectingFrom(null); return; }
    const exists = connectors.some(c =>
      (c.fromElementId === connectingFrom.elementId && c.fromSnapId === connectingFrom.snapId &&
       c.toElementId === toElementId && c.toSnapId === toSnapId) ||
      (c.fromElementId === toElementId && c.fromSnapId === toSnapId &&
       c.toElementId === connectingFrom.elementId && c.toSnapId === connectingFrom.snapId)
    );
    if (!exists) {
      const connector: Connector = {
        id: generateId(),
        fromElementId: connectingFrom.elementId, fromSnapId: connectingFrom.snapId,
        toElementId, toSnapId,
        bendPoints: [], pipeType: activePipeType,
      };
      setConnectors(prev => {
        const next = [...prev, connector];
        setElements(els => { pushHistory(els, next); return els; });
        return next;
      });
    }
    setConnectingFrom(null);
  }, [connectingFrom, connectors, activePipeType, pushHistory]);

  const cancelConnection = useCallback(() => setConnectingFrom(null), []);

  const setBendPoints = useCallback((connectorId: string, pts: { x: number; y: number }[]) => {
    setConnectors(prev =>
      prev.map(c => c.id !== connectorId ? c : { ...c, bendPoints: pts.map(p => ({ ...p })) })
    );
  }, []);

  const bendPointMoveEnd = useCallback(() => {
    setConnectors(conns => {
      setElements(els => { pushHistory(els, conns); return els; });
      return conns;
    });
  }, [pushHistory]);

  const addBendPoint = useCallback((connectorId: string, x: number, y: number, index: number) => {
    setConnectors(prev => prev.map(c => {
      if (c.id !== connectorId) return c;
      const nb = [...c.bendPoints]; nb.splice(index, 0, { x, y });
      return { ...c, bendPoints: nb };
    }));
  }, []);

  const moveBendPoint = useCallback((connectorId: string, index: number, x: number, y: number) => {
    setConnectors(prev => prev.map(c => {
      if (c.id !== connectorId) return c;
      const nb = [...c.bendPoints]; nb[index] = { x, y };
      return { ...c, bendPoints: nb };
    }));
  }, []);

  const mountElementOnPipe = useCallback((elementId: string, connectorId: string, t: number) => {
    setElements(prev => {
      const next = prev.map(e =>
        e.id === elementId ? { ...e, pipeMountConnectorId: connectorId, pipeMountT: t } : e
      );
      setConnectors(conns => { pushHistory(next, conns); return conns; });
      return next;
    });
  }, [pushHistory]);

  const toggleConnectorForward = useCallback((id: string) => {
    setConnectors(prev => {
      const next = prev.map(c => c.id === id ? { ...c, isForward: !c.isForward } : c);
      setElements(els => { pushHistory(els, next); return els; });
      return next;
    });
  }, [pushHistory]);

  const getPipeMountPosition = useCallback((el: CanvasElement): { x: number; y: number } | null => {
    if (!el.pipeMountConnectorId) return null;
    const conn = connectors.find(c => c.id === el.pipeMountConnectorId);
    if (!conn) return null;
    const pts = connectorWaypoints(conn, elements);
    if (!pts || pts.length < 2) return null;
    const t = el.pipeMountT ?? 0.5;
    const pt = positionAlongPath(pts, t);
    const stencil = stencilRegistry.find(s => s.id === el.stencilId);
    const mountConfig = PIPE_MOUNT_STENCILS.find(s => s.stencilId === el.stencilId);
    const snapDef = stencil?.snapPoints.find(sp => sp.id === mountConfig?.snapId);
    const offsetX = snapDef ? (snapDef.x - 0.5) * el.width  : 0;
    const offsetY = snapDef ? (snapDef.y - 0.5) * el.height : 0;
    return { x: pt.x - el.width / 2 - offsetX, y: pt.y - el.height / 2 - offsetY };
  }, [connectors, elements]);

  // ── Viewport ──────────────────────────────────────────────────────────────
  const zoomIn    = useCallback(() => setViewport(v => ({ ...v, zoom: Math.min(v.zoom * 1.2, 5) })), []);
  const zoomOut   = useCallback(() => setViewport(v => ({ ...v, zoom: Math.max(v.zoom / 1.2, 0.1) })), []);
  const resetView = useCallback(() => setViewport({ offsetX: 0, offsetY: 0, zoom: 1 }), []);
  const pan       = useCallback((dx: number, dy: number) => setViewport(v => ({ ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy })), []);

  // ── Project Management ──────────────────────────────────────────────────────
  
  const createProject = useCallback((name: string, refrig: string) => {
    setProjectName(name);
    setRefrigerant(refrig);
    setElements([]);
    setConnectors([]);
    setSelectedId(null);
    setSelectedConnectorId(null);
    setConnectingFrom(null);
    history.current = [{ elements: [], connectors: [] }];
    historyIndex.current = 0;
    forceRender(n => n + 1);
  }, []);

  const saveProject = useCallback(() => {
    if (!projectName) return;
    const projectData = { elements, connectors, projectName, refrigerant, updatedAt: new Date().toISOString() };
    const projectsRaw = localStorage.getItem("cryosim_projects") || "[]";
    const projects = JSON.parse(projectsRaw);
    const idx = projects.findIndex((p: any) => p.projectName === projectName);
    const newProjects = [...projects];
    if (idx >= 0) newProjects[idx] = projectData;
    else newProjects.push(projectData);
    localStorage.setItem("cryosim_projects", JSON.stringify(newProjects));
  }, [elements, connectors, projectName, refrigerant]);

  const loadProject = useCallback((name: string) => {
    const projectsRaw = localStorage.getItem("cryosim_projects") || "[]";
    const projects = JSON.parse(projectsRaw);
    const p = projects.find((p: any) => p.projectName === name);
    if (p) {
      setElements(p.elements || []);
      setConnectors(p.connectors || []);
      setProjectName(p.projectName || "");
      setRefrigerant(p.refrigerant || "");
      setSelectedId(null);
      setSelectedConnectorId(null);
      setConnectingFrom(null);
      history.current = [{ elements: p.elements || [], connectors: p.connectors || [] }];
      historyIndex.current = 0;
      forceRender(n => n + 1);
    }
  }, []);

  const getSavedProjects = useCallback(() => {
    const projectsRaw = localStorage.getItem("cryosim_projects") || "[]";
    return JSON.parse(projectsRaw);
  }, []);

  // ─── Derived ─────────────────────────────────────────────────────────────
  const directSnappedConnectorIds = new Set<string>();
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      if (areDirectlySnapped(elements[i], elements[j])) {
        for (const c of connectors) {
          if ((c.fromElementId === elements[i].id && c.toElementId === elements[j].id) ||
              (c.fromElementId === elements[j].id && c.toElementId === elements[i].id)) {
            directSnappedConnectorIds.add(c.id);
          }
        }
      }
    }
  }

  return {
    elements, connectors,
    selectedId, selectedConnectorId,
    setSelectedId, setSelectedConnectorId,
    viewport, snapLines, connectingFrom,
    activePipeType, setActivePipeType,
    projectName, setProjectName,
    refrigerant, setRefrigerant,
    addElement, moveElement, moveElementEnd,
    resizeElement, resizeElementEnd,
    clearSnapLines, deleteSelected,
    rotateElement, flipElement, updateElement,
    startConnection, completeConnection, cancelConnection,
    addBendPoint, moveBendPoint, setBendPoints, bendPointMoveEnd,
    toggleConnectorForward,
    mountElementOnPipe, getPipeMountPosition,
    directSnappedConnectorIds,
    zoomIn, zoomOut, resetView, pan,
    createProject, saveProject, loadProject, getSavedProjects,
    undo, redo, canUndo, canRedo,
  };
}