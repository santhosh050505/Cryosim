import React, { useRef, useCallback, useEffect, useState } from "react";
import CanvasElementComponent from "./CanvasElement";
import ConnectorLine from "./ConnectorLine";
import { useCanvasState, areDirectlySnapped } from "@/hooks/useCanvasState";
import { PIPE_STYLES, PipeType, PIPE_MOUNT_STENCILS, PIPE_MIDPOINT_SNAP_THRESHOLD, PIPE_MIDPOINT_T_SNAP_RANGE } from "@/lib/canvasTypes";
import { stencilRegistry } from "@/lib/stencilRegistry";
import { connectorWaypoints, positionAlongPath, Pt } from "@/lib/pipeGeometry";
import { PRVModal } from "./PRVModal";
import { LiquidReceiverModal } from "./LiquidReceiverModal";

interface DiagramCanvasProps {
  canvasState: ReturnType<typeof useCanvasState>;
}

const PIPE_TYPES: PipeType[] = ["suction", "discharge", "liquid", "water"];

// How close (px in canvas coords) a dropped stencil must be to a pipe to mount on it
const PIPE_MOUNT_THRESHOLD = 30;

/** Check if a stencilId is configured to mount on pipes */
function isPipeMountStencil(stencilId: string): boolean {
  return PIPE_MOUNT_STENCILS.some(s => s.stencilId === stencilId);
}

/** Find closest point on any connector's orthogonal path to (cx,cy).
 *  If stencil is a pipe-mount stencil and near midpoint (t≈0.5), snaps to exact midpoint.
 */
function findNearestPipePoint(
  cx: number, cy: number,
  connectors: import("@/lib/canvasTypes").Connector[],
  elements: import("@/lib/canvasTypes").CanvasElement[],
  snapToMidpoint?: boolean,
): { connectorId: string; t: number; x: number; y: number } | null {
  let best: { connectorId: string; t: number; x: number; y: number; dist: number } | null = null;

  const threshold = snapToMidpoint ? PIPE_MIDPOINT_SNAP_THRESHOLD : PIPE_MOUNT_THRESHOLD;

  for (const conn of connectors) {
    // Skip connectors that already have a mounted element
    const alreadyMounted = elements.some(e => e.pipeMountConnectorId === conn.id);
    if (alreadyMounted) continue;

    const pts = connectorWaypoints(conn, elements);
    if (!pts || pts.length < 2) continue;

    // Total path length for normalised t
    const segLens: number[] = [];
    let totalLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y);
      segLens.push(len);
      totalLen += len;
    }
    if (totalLen < 1) continue;

    let runLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x, ay = pts[i].y;
      const bx = pts[i+1].x, by = pts[i+1].y;
      const dx = bx - ax, dy = by - ay;
      const len2 = dx*dx + dy*dy;
      if (len2 < 0.01) { runLen += segLens[i]; continue; }

      let localT = ((cx - ax)*dx + (cy - ay)*dy) / len2;
      localT = Math.max(0, Math.min(1, localT));

      const globalT = (runLen + localT * segLens[i]) / totalLen;
      // Allow mounting anywhere except the very tips
      if (globalT < 0.03 || globalT > 0.97) { runLen += segLens[i]; continue; }

      const px = ax + localT*dx, py = ay + localT*dy;
      const dist = Math.hypot(cx - px, cy - py);

      if (dist < threshold && (!best || dist < best.dist)) {
        // For pipe-mount stencils: if near the midpoint, snap exactly to t=0.5
        let finalT = globalT;
        if (snapToMidpoint && Math.abs(globalT - 0.5) < PIPE_MIDPOINT_T_SNAP_RANGE) {
          finalT = 0.5;
          const midPt = positionAlongPath(pts, 0.5);
          best = { connectorId: conn.id, t: finalT, x: midPt.x, y: midPt.y, dist };
          runLen += segLens[i];
          continue;
        }
        best = { connectorId: conn.id, t: finalT, x: px, y: py, dist };
      }
      runLen += segLens[i];
    }
  }

  return best ? { connectorId: best.connectorId, t: best.t, x: best.x, y: best.y } : null;
}

// ─── Main component ───────────────────────────────────────────────────────────
const DiagramCanvas: React.FC<DiagramCanvasProps> = ({ canvasState }) => {
  const {
    elements, connectors,
    selectedId, selectedConnectorId,
    setSelectedId, setSelectedConnectorId,
    viewport, snapLines, connectingFrom,
    activePipeType, setActivePipeType,
    addElement, moveElement, moveElementEnd,
    resizeElement, resizeElementEnd,
    rotateElement, clearSnapLines, flipElement, updateElement,
    startConnection, completeConnection, cancelConnection,
    addBendPoint, moveBendPoint, bendPointMoveEnd,
    toggleConnectorForward,
    pan, undo, redo,
    setBendPoints,
    mountElementOnPipe, getPipeMountPosition,
    directSnappedConnectorIds,
  } = canvasState;

  const svgRef = useRef<SVGSVGElement>(null);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });

  // Track pipe-mount preview while dragging over canvas
  const [pipeMountPreview, setPipeMountPreview] = useState<{
    connectorId: string; x: number; y: number; isMidpoint: boolean;
  } | null>(null);

  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  const [prvModalOpen, setPrvModalOpen] = useState(false);
  const [editingPrvElementId, setEditingPrvElementId] = useState<string | null>(null);

  const [receiverModalOpen, setReceiverModalOpen] = useState(false);
  const [editingReceiverElementId, setEditingReceiverElementId] = useState<string | null>(null);

  const editingPrvElement = elements.find(el => el.id === editingPrvElementId) || null;
  const editingReceiverElement = elements.find(el => el.id === editingReceiverElementId) || null;

  const handlePrvSave = (data: any) => {
    if (editingPrvElementId) {
      updateElement(editingPrvElementId, { prvData: data });
    }
  };

  const handleReceiverSave = (data: any) => {
    if (editingReceiverElementId) {
      updateElement(editingReceiverElementId, { receiverData: data });
    }
  };

  const openPrvModal = (elementId: string) => {
    setEditingPrvElementId(elementId);
    setPrvModalOpen(true);
  };

  const openReceiverModal = (elementId: string) => {
    setEditingReceiverElementId(elementId);
    setReceiverModalOpen(true);
  };

  const isConnectedToReceiver = editingPrvElement ? elements.some(el => {
    if (el.stencilId !== "Liquid_Receiver_" && el.stencilId !== "Suction_Accumulator") return false;
    // Check direct snap
    if (areDirectlySnapped(editingPrvElement, el)) return true;
    // Check connectors
    if (connectors.some(c => 
      (c.fromElementId === editingPrvElement.id && c.toElementId === el.id) || 
      (c.fromElementId === el.id && c.toElementId === editingPrvElement.id)
    )) return true;
    return false;
  }) : false;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (((e.ctrlKey || e.metaKey) && e.key === "y") || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")) { e.preventDefault(); redo(); }
      else if (e.key === "Delete" || e.key === "Backspace") canvasState.deleteSelected();
      else if (e.key.toLowerCase() === "l" && selectedConnectorId) { e.preventDefault(); toggleConnectorForward(selectedConnectorId); }
      else if (e.key === "Escape") cancelConnection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, canvasState, cancelConnection]);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const viewportG = svg.querySelector('.main-viewport-g') as SVGGElement || svg;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = viewportG.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const worldPt = pt.matrixTransform(ctm.inverse());
    return { x: worldPt.x, y: worldPt.y };
  }, []);

  // Track which stencil is currently being dragged from the panel
  const dragStencilId = useRef<string>("");

  // ── Drop handler: detect pipe proximity ──────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setPipeMountPreview(null);
    dragStencilId.current = "";
    const stencilId = e.dataTransfer.getData("stencilId");
    if (!stencilId) return;
    if (stencilId === "pipe-suction")        { setActivePipeType("suction");    return; }
    if (stencilId === "pipe-discharge")      { setActivePipeType("discharge");  return; }
    if (stencilId === "pipe-liquid")         { setActivePipeType("liquid");     return; }
    if (stencilId === "pipe-water")          { setActivePipeType("water");      return; }

    const stencil = stencilRegistry.find(s => s.id === stencilId);
    if (!stencil) return;

    const pos = screenToCanvas(e.clientX, e.clientY);
    const isMountStencil = isPipeMountStencil(stencilId);

    // Only pipe-mount stencils (Pressure Switch) snap onto pipes
    if (isMountStencil) {
      const pipeHit = findNearestPipePoint(pos.x, pos.y, connectors, elements, true);
      if (pipeHit) {
        const mountConfig = PIPE_MOUNT_STENCILS.find(s => s.stencilId === stencilId);
        const snapDef = stencil.snapPoints.find(sp => sp.id === mountConfig?.snapId);
        const offsetX = snapDef ? (snapDef.x - 0.5) * stencil.width  : 0;
        const offsetY = snapDef ? (snapDef.y - 0.5) * stencil.height : 0;
        const newEl = addElement(stencilId, pipeHit.x - offsetX, pipeHit.y - offsetY, {
          pipeMountConnectorId: pipeHit.connectorId,
          pipeMountT: pipeHit.t,
        });
        if (stencilId === "PRV" && (newEl as any)?.id) {
          openPrvModal((newEl as any).id);
        }
        return;
      }
    }

    // All other stencils (and pipe-mount stencils dropped away from a pipe): place freely
    const newEl = addElement(stencilId, pos.x, pos.y);
    if (stencilId === "PRV" && (newEl as any)?.id) {
      openPrvModal((newEl as any).id);
    } else if (stencilId === "Liquid_Receiver_" && (newEl as any)?.id) {
      openReceiverModal((newEl as any).id);
    }
  }, [screenToCanvas, addElement, setActivePipeType, connectors, elements]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";

    // Try to read the stencilId being dragged (works in most browsers on dragover)
    const stencilId = e.dataTransfer.getData("stencilId");
    if (stencilId) dragStencilId.current = stencilId;
    const currentStencilId = dragStencilId.current;

    // Only show midpoint preview when dragging a pipe-mount stencil (Pressure Switch)
    if (!isPipeMountStencil(currentStencilId)) {
      setPipeMountPreview(null);
      return;
    }

    const pos = screenToCanvas(e.clientX, e.clientY);
    const pipeHit = findNearestPipePoint(pos.x, pos.y, connectors, elements, true);
    if (pipeHit) {
      const isMidpoint = Math.abs(pipeHit.t - 0.5) < 0.02;
      setPipeMountPreview({ connectorId: pipeHit.connectorId, x: pipeHit.x, y: pipeHit.y, isMidpoint });
    } else {
      setPipeMountPreview(null);
    }
  }, [screenToCanvas, connectors, elements]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as Element).classList.contains("canvas-bg-rect")) {
      setSelectedId(null);
      setSelectedConnectorId(null);
      if (connectingFrom) cancelConnection();
      if (e.button === 1) {
        isPanning.current = true;
        lastPan.current = { x: e.clientX, y: e.clientY };
      }
    }
  }, [setSelectedId, setSelectedConnectorId, connectingFrom, cancelConnection]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning.current) {
      pan(e.clientX - lastPan.current.x, e.clientY - lastPan.current.y);
      lastPan.current = { x: e.clientX, y: e.clientY };
    }
  }, [pan]);

  // Called every frame while a pipe-mounted element is being dragged on canvas
  const handleElementDragMove = useCallback((_id: string) => {
    // Midpoint hint is only shown during library drag (handleDragOver), not canvas drag
  }, []);

  const handleElementDragEnd = useCallback((_id: string) => {
    // nothing needed
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY > 0) canvasState.zoomOut(); else canvasState.zoomIn();
    } else {
      pan(-e.deltaX, -e.deltaY);
    }
  }, [pan, canvasState]);

  const handleSnapPointClick = useCallback((elementId: string, snapId: string) => {
    if (connectingFrom) completeConnection(elementId, snapId);
    else startConnection(elementId, snapId);
  }, [connectingFrom, startConnection, completeConnection]);

  const activePipeStyle = PIPE_STYLES[activePipeType];

  // ── Compute live positions for pipe-mounted elements ──────────────────────
  // We override their x/y so they track the pipe in real-time
  const resolvedElements = elements.map(el => {
    if (!el.pipeMountConnectorId) return el;
    const pos = getPipeMountPosition(el);
    if (!pos) return el;
    return { ...el, x: pos.x, y: pos.y };
  });

  return (
    <div className="flex-1 overflow-hidden relative canvas-grid flex flex-col">

      {/* Pipe type selector */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border-white/20">
        <div className="px-3 py-1 flex flex-col items-center justify-center border-r border-border/50 mr-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em] leading-none mb-0.5">Circuit</span>
          <span className="text-[10px] font-black text-foreground uppercase tracking-wider leading-none">Segment</span>
        </div>
        <div className="flex items-center gap-1.5">
          {PIPE_TYPES.map(pt => {
            const s = PIPE_STYLES[pt];
            const isActive = pt === activePipeType;
            return (
              <button key={pt} onClick={() => setActivePipeType(pt)} title={s.label}
                className={`text-[10px] font-bold px-4 py-2 rounded-xl transition-all duration-300 flex items-center gap-2 group ${
                  isActive 
                  ? "bg-white text-foreground shadow-sm scale-105" 
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-white/40"
                }`}
              >
                <div className="w-2 h-2 rounded-full shadow-inner" style={{ background: s.colorMid }} />
                <span className="uppercase tracking-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Connection mode indicator */}
      {connectingFrom && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-foreground text-background text-[10px] font-bold tracking-widest uppercase px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl border border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-ping" style={{ background: activePipeStyle.colorMid }} />
              <span className="opacity-70">Routing:</span>
              <span style={{ color: activePipeStyle.colorMid }}>{activePipeStyle.label}</span>
            </div>
            <div className="h-4 w-px bg-background/20" />
            <span className="text-background/60">Click Target Snap Point</span>
            <div className="flex items-center gap-1 bg-background/10 px-2 py-0.5 rounded text-[8px] border border-background/10">
              <span className="opacity-50">ESC to</span>
              <span>CANCEL</span>
            </div>
          </div>
        </div>
      )}

      <svg
        ref={svgRef}
        className="w-full h-full"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => { setPipeMountPreview(null); dragStencilId.current = ""; }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: connectingFrom ? "crosshair" : "default", userSelect: "none", WebkitUserSelect: "none" }}
      >
        <g className="main-viewport-g" transform={`translate(${viewport.offsetX}, ${viewport.offsetY}) scale(${viewport.zoom})`}>
          <rect className="canvas-bg-rect" x={-10000} y={-10000} width={20000} height={20000} fill="transparent" />
          {/* 1. REGULAR STENCILS */}
          {resolvedElements
            .filter(el => !el.pipeMountConnectorId)
            .map(el => (
              <CanvasElementComponent
                key={el.id}
                element={el}
                isSelected={el.id === selectedId}
                zoom={viewport.zoom}
                offsetX={viewport.offsetX}
                offsetY={viewport.offsetY}
                isConnecting={!!connectingFrom}
                connectingFrom={connectingFrom}
                isHovered={hoveredElementId === el.id}
                onHoverChange={setHoveredElementId}
                onSelect={id => { setSelectedId(id); setSelectedConnectorId(null); }}
                onMove={moveElement}
                onMoveEnd={() => { clearSnapLines(); moveElementEnd(); }}
                onDragMove={handleElementDragMove}
                onDragEnd={handleElementDragEnd}
                onResize={resizeElement}
                onResizeEnd={resizeElementEnd}
                onRotate={rotateElement}
                onFlip={flipElement}
                onRightClick={(id) => {
                  const el = elements.find(e => e.id === id);
                  if (el?.stencilId === "PRV") openPrvModal(id);
                  else if (el?.stencilId === "Liquid_Receiver_") openReceiverModal(id);
                }}
                onSnapPointClick={handleSnapPointClick}
              />
            ))}

          {/* 2. PIPE-MOUNTED STENCILS */}
          {resolvedElements
            .filter(el => !!el.pipeMountConnectorId)
            .map(el => (
              <CanvasElementComponent
                key={el.id}
                element={el}
                isSelected={el.id === selectedId}
                zoom={viewport.zoom}
                offsetX={viewport.offsetX}
                offsetY={viewport.offsetY}
                isConnecting={!!connectingFrom}
                connectingFrom={connectingFrom}
                isHovered={hoveredElementId === el.id}
                onHoverChange={setHoveredElementId}
                onSelect={id => { setSelectedId(id); setSelectedConnectorId(null); }}
                onMove={moveElement}
                onMoveEnd={() => { clearSnapLines(); moveElementEnd(); }}
                onDragMove={handleElementDragMove}
                onDragEnd={handleElementDragEnd}
                onResize={resizeElement}
                onResizeEnd={resizeElementEnd}
                onRotate={rotateElement}
                onFlip={flipElement}
                onRightClick={(id) => {
                  const el = elements.find(e => e.id === id);
                  if (el?.stencilId === "PRV") openPrvModal(id);
                  else if (el?.stencilId === "Liquid_Receiver_") openReceiverModal(id);
                }}
                onSnapPointClick={handleSnapPointClick}
              />
            ))}

          {/* 3. CONNECTORS — Rendered after all stencils to be 'always visible' on top */}
          {connectors
            .map(conn => {
              const mountedEl = resolvedElements.find(e => e.pipeMountConnectorId === conn.id);
              return (
                <ConnectorLine
                  key={conn.id}
                  connector={conn}
                  elements={resolvedElements}
                  isSelected={conn.id === selectedConnectorId}
                  zoom={viewport.zoom}
                  onSelect={id => { setSelectedConnectorId(id); setSelectedId(null); }}
                  onSetBendPoints={setBendPoints}
                  onSetBendPointsEnd={bendPointMoveEnd}
                  mountedElement={mountedEl}
                />
              );
            })}

          {/* 4. SNAP POINTS OVERLAY — rendered last to ensure red dots are always on top of pipes */}
          {resolvedElements.map(el => (
            <CanvasElementComponent
              key={el.id + "-snaps"}
              element={el}
              isSelected={el.id === selectedId}
              zoom={viewport.zoom}
              offsetX={viewport.offsetX}
              offsetY={viewport.offsetY}
              isConnecting={!!connectingFrom}
              connectingFrom={connectingFrom}
              isHovered={hoveredElementId === el.id}
              onHoverChange={setHoveredElementId}
              onSelect={id => { setSelectedId(id); setSelectedConnectorId(null); }}
              onMove={moveElement}
              onMoveEnd={() => { clearSnapLines(); moveElementEnd(); }}
              onDragMove={handleElementDragMove}
              onDragEnd={handleElementDragEnd}
              onResize={resizeElement}
              onResizeEnd={resizeElementEnd}
              onRotate={rotateElement}
              onFlip={flipElement}
              onSnapPointClick={handleSnapPointClick}
              snapPointsOnly={true}
            />
          ))}

          {/* Pipe-mount drop preview — shown while dragging a stencil near a pipe */}
          {pipeMountPreview && (
            <g style={{ pointerEvents: "none" }}>
              {/* Glowing ring at snap point */}
              <circle
                cx={pipeMountPreview.x}
                cy={pipeMountPreview.y}
                r={pipeMountPreview.isMidpoint ? 14 : 10}
                fill={pipeMountPreview.isMidpoint ? "rgba(34,197,94,0.25)" : "rgba(59,130,246,0.2)"}
                stroke={pipeMountPreview.isMidpoint ? "#22c55e" : "#3b82f6"}
                strokeWidth={2}
                strokeDasharray={pipeMountPreview.isMidpoint ? "none" : "4 2"}
              />
              <circle
                cx={pipeMountPreview.x}
                cy={pipeMountPreview.y}
                r={4}
                fill={pipeMountPreview.isMidpoint ? "#22c55e" : "#3b82f6"}
              />
              {/* Midpoint label */}
              {pipeMountPreview.isMidpoint && (
                <text
                  x={pipeMountPreview.x}
                  y={pipeMountPreview.y - 20}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#22c55e"
                  fontWeight="bold"
                  style={{ userSelect: "none" }}
                >
                  Midpoint ✓
                </text>
              )}
            </g>
          )}

        </g>

        {/* Snap alignment lines */}
        {snapLines.x !== undefined && (
          <line x1={snapLines.x * viewport.zoom + viewport.offsetX} y1={0}
            x2={snapLines.x * viewport.zoom + viewport.offsetX} y2="100%"
            stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        )}
        {snapLines.y !== undefined && (
          <line x1={0} y1={snapLines.y * viewport.zoom + viewport.offsetY}
            x2="100%" y2={snapLines.y * viewport.zoom + viewport.offsetY}
            stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        )}
      </svg>

      <PRVModal
        isOpen={prvModalOpen}
        onClose={() => setPrvModalOpen(false)}
        element={editingPrvElement}
        projectRefrigerant={canvasState.refrigerant}
        onSave={handlePrvSave}
        isConnectedToReceiver={isConnectedToReceiver}
      />

      <LiquidReceiverModal
        isOpen={receiverModalOpen}
        onClose={() => setReceiverModalOpen(false)}
        element={editingReceiverElement}
        onSave={handleReceiverSave}
      />
    </div>
  );
};

export default DiagramCanvas;