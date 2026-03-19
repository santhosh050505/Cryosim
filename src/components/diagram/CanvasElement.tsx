import React, { useRef, useCallback, useState } from "react";
import { CanvasElement as CanvasElementType, MIN_ELEMENT_SIZE } from "@/lib/canvasTypes";
import { stencilRegistry } from "@/lib/stencilRegistry";

interface CanvasElementProps {
  element: CanvasElementType;
  isSelected: boolean;
  zoom: number;
  offsetX: number;
  offsetY: number;
  isConnecting: boolean;
  connectingFrom: { elementId: string; snapId: string } | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onMoveEnd: () => void;
  onDragMove?: (id: string) => void;   // fires every mousemove while dragging
  onDragEnd?: (id: string) => void;    // fires on mouseup after drag
  onResize: (id: string, w: number, h: number, x?: number, y?: number) => void;
  onResizeEnd: () => void;
  onRotate: (id: string, absoluteAngle: number) => void;
  onFlip: (id: string, axis: "H" | "V") => void;
  onSnapPointClick: (elementId: string, snapId: string) => void;
  onRightClick?: (id: string) => void;
  snapPointsOnly?: boolean;
  isHovered?: boolean;
  onHoverChange?: (id: string | null) => void;
}

type ResizeCorner = "nw" | "ne" | "sw" | "se";

// ─── Snap Point with heartbeat + source pulse effect ─────────────────────────
const SnapPoint: React.FC<{
  cx: number;
  cy: number;
  snapId: string;
  isSource: boolean;  // this is the active connection source point
  isVisible: boolean; // whether the red dot should be shown
  onSnapPointClick: (e: React.MouseEvent, snapId: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}> = ({ cx, cy, snapId, isSource, isVisible, onSnapPointClick, onMouseEnter, onMouseLeave }) => {
  const [beating, setBeating] = useState(false);
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDown = (e: React.MouseEvent) => {
    setBeating(false);
    if (beatTimer.current) clearTimeout(beatTimer.current);
    requestAnimationFrame(() => {
      setBeating(true);
      beatTimer.current = setTimeout(() => setBeating(false), 650);
    });
    onSnapPointClick(e, snapId);
  };

  return (
    <g>
      {/* Transparent hit area — rendered on top of everything to ensure points can always be clicked/hovered */}
      <circle
        cx={cx} cy={cy} r={isVisible ? 8 : 5}
        fill="transparent"
        style={{ cursor: "crosshair", pointerEvents: "all" }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseDown={handleDown}
      />
      
      {/* Visual Dot — only shown when isVisible is true */}
      <g style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.15s ease", pointerEvents: "none" }}>
        {/* Source pulse rings */}
        {isSource && (
          <>
            <circle cx={cx} cy={cy} r={3.5} fill="none" stroke="hsl(0,84%,50%)" strokeWidth={1.5} className="snap-source-ring-1" />
            <circle cx={cx} cy={cy} r={3.5} fill="none" stroke="hsl(0,84%,50%)" strokeWidth={1} className="snap-source-ring-2" />
            <circle cx={cx} cy={cy} r={3.5} fill="none" stroke="hsl(0,84%,50%)" strokeWidth={0.5} className="snap-source-ring-3" />
          </>
        )}
        {beating && !isSource && (
          <circle cx={cx} cy={cy} r={3.5} fill="none" stroke="hsl(0,84%,50%)" strokeWidth={1.5} className="snap-ripple" />
        )}
        <circle
          cx={cx} cy={cy}
          r={isSource ? 5 : 4}
          fill="hsl(0,84%,50%)"
          stroke="white"
          strokeWidth={isSource ? 1.5 : 1}
          className={beating ? "snap-point-beat" : ""}
        />
      </g>
    </g>
  );
};

// ─── Canvas Element ───────────────────────────────────────────────────────────
const CanvasElementComponent: React.FC<CanvasElementProps> = ({
  element, isSelected, zoom, offsetX, offsetY, isConnecting, connectingFrom,
  onSelect, onMove, onMoveEnd, onDragMove, onDragEnd, onResize, onResizeEnd,
  onRotate, onFlip, onSnapPointClick, onRightClick, snapPointsOnly,
  isHovered, onHoverChange,
}) => {
  const stencil    = stencilRegistry.find(s => s.id === element.stencilId);
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(element.id);
    isDragging.current = true;

    // Use viewport CTM for stable screen→world conversion
    const svg = (e.target as SVGElement).closest("svg") as SVGSVGElement | null;
    const viewportG = svg?.querySelector(".main-viewport-g") as SVGGElement | null;
    const vpCTM = viewportG?.getScreenCTM();
    if (!svg || !vpCTM) return;
    const vpInverse = vpCTM.inverse();

    const screenToWorld = (clientX: number, clientY: number) => {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const w = pt.matrixTransform(vpInverse);
      return { x: w.x, y: w.y };
    };

    const startMouse = screenToWorld(e.clientX, e.clientY);
    const startElX = element.x;
    const startElY = element.y;

    const prevSel = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      ev.preventDefault();
      const cur = screenToWorld(ev.clientX, ev.clientY);
      onMove(element.id, startElX + (cur.x - startMouse.x), startElY + (cur.y - startMouse.y));
      onDragMove?.(element.id);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = prevSel;
      onMoveEnd();
      onDragEnd?.(element.id);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [element.id, element.x, element.y, onSelect, onMove, onMoveEnd, onDragMove, onDragEnd]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, corner: ResizeCorner) => {
    e.stopPropagation();

    const svg = (e.target as SVGElement).closest("svg") as SVGSVGElement | null;
    if (!svg) return;
    const viewportG = svg.querySelector(".main-viewport-g") as SVGGElement | null;
    if (!viewportG) return;
    const vpCTM = viewportG.getScreenCTM();
    if (!vpCTM) return;
    const vpInverse = vpCTM.inverse();

    const screenToWorld = (cx: number, cy: number) => {
      const pt = svg.createSVGPoint();
      pt.x = cx; pt.y = cy;
      const w = pt.matrixTransform(vpInverse);
      return { x: w.x, y: w.y };
    };

    // Snapshot start state — never re-read element during drag
    const sx = element.x, sy = element.y;
    const sw = element.width, sh = element.height;
    const rot = element.rotation ?? 0;
    const rad = (rot * Math.PI) / 180;
    const co = Math.cos(rad), si = Math.sin(rad);
    const hcx = sw / 2, hcy = sh / 2; // half-size = rotation center offset

    // localToWorld: element-local (lx,ly) → SVG world, using START geometry
    const l2w = (lx: number, ly: number) => {
      const dx = lx - hcx, dy = ly - hcy;
      return {
        x: sx + hcx + dx * co - dy * si,
        y: sy + hcy + dx * si + dy * co,
      };
    };

    // Anchor = opposite corner in local coords, computed ONCE
    let aLx: number, aLy: number;
    switch (corner) {
      case "nw": aLx = sw; aLy = sh; break; // anchor SE
      case "ne": aLx = 0;  aLy = sh; break; // anchor SW
      case "sw": aLx = sw; aLy = 0;  break; // anchor NE
      case "se": aLx = 0;  aLy = 0;  break; // anchor NW
    }
    const aw = l2w(aLx, aLy); // anchor world position — FIXED for entire drag

    // Initial mouse in world coords
    const m0 = screenToWorld(e.clientX, e.clientY);

    const onMouseMove = (ev: MouseEvent) => {
      const m = screenToWorld(ev.clientX, ev.clientY);

      // World-space delta from initial click position
      const dwx = m.x - m0.x, dwy = m.y - m0.y;

      // Project into element's local axes (un-rotate)
      const ldx =  dwx * co + dwy * si;
      const ldy = -dwx * si + dwy * co;

      // Apply delta to starting size — sign depends on which corner is dragged
      let nw = sw, nh = sh;
      switch (corner) {
        case "se": nw = sw + ldx; nh = sh + ldy; break;
        case "nw": nw = sw - ldx; nh = sh - ldy; break;
        case "ne": nw = sw + ldx; nh = sh - ldy; break;
        case "sw": nw = sw - ldx; nh = sh + ldy; break;
      }
      nw = Math.max(MIN_ELEMENT_SIZE, nw);
      nh = Math.max(MIN_ELEMENT_SIZE, nh);

      // Anchor's local position in the NEW-sized rect (same corner identity)
      let naLx: number, naLy: number;
      switch (corner) {
        case "se": naLx = 0;  naLy = 0;  break;
        case "nw": naLx = nw; naLy = nh; break;
        case "ne": naLx = 0;  naLy = nh; break;
        case "sw": naLx = nw; naLy = 0;  break;
      }

      // Back-solve new origin so anchor stays at aw in world space
      const nhw = nw / 2, nhh = nh / 2;
      const adx = naLx! - nhw, ady = naLy! - nhh;
      const nx = aw.x - nhw - (adx * co - ady * si);
      const ny = aw.y - nhh - (adx * si + ady * co);

      onResize(element.id, nw, nh, nx, ny);
    };

    const onMouseUp = () => {
      onResizeEnd();
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [element, onResize, onResizeEnd]);



  const handleRotateMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
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

    const centerWorld = {
      x: element.x + element.width / 2,
      y: element.y + element.height / 2
    };

    const mouseStart = getPointInWorld(e.clientX, e.clientY);
    const startAngle = Math.atan2(mouseStart.y - centerWorld.y, mouseStart.x - centerWorld.x);
    const startRotation = element.rotation ?? 0;

    const onMouseMove = (ev: MouseEvent) => {
      const mouseCurrent = getPointInWorld(ev.clientX, ev.clientY);
      const curAngle = Math.atan2(mouseCurrent.y - centerWorld.y, mouseCurrent.x - centerWorld.x);
      const delta = (curAngle - startAngle) * (180 / Math.PI);
      onRotate(element.id, (startRotation + delta + 360) % 360);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [element, onRotate]);

  const handleSnapPointClick = useCallback((e: React.MouseEvent, snapId: string) => {
    e.stopPropagation();
    onSnapPointClick(element.id, snapId);
  }, [element.id, onSnapPointClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      onRightClick?.(element.id);
    }
  }, [element.id, onRightClick]);

  if (!stencil) return null;

  const rotation = element.rotation ?? 0;
  const cx = element.width / 2;
  const cy = element.height / 2;
  const flipH = element.flipH ?? false;
  const flipV = element.flipV ?? false;

  // Build flip transform: scale around centre of element
  const flipScaleX = flipH ? -1 : 1;
  const flipScaleY = flipV ? -1 : 1;
  // Translate so flip pivot is the element centre
  const flipTransform = (flipH || flipV)
    ? `translate(${flipH ? element.width : 0}, ${flipV ? element.height : 0}) scale(${flipScaleX}, ${flipScaleY})`
    : undefined;

  const resizeCorners: { corner: ResizeCorner; cx: number; cy: number; cursor: string }[] = [
    { corner: "nw", cx: 0,             cy: 0,              cursor: "nwse-resize" },
    { corner: "ne", cx: element.width, cy: 0,              cursor: "nesw-resize" },
    { corner: "sw", cx: 0,             cy: element.height, cursor: "nesw-resize" },
    { corner: "se", cx: element.width, cy: element.height, cursor: "nwse-resize" },
  ];

  const showVisuals = (isHovered || isSelected || isConnecting);
  
  // Always render snap point hit areas in the overlay pass, even if visuals are hidden.
  // This ensures they catch hovers that would otherwise hit a pipe above the stencil.
  const snapPoints = (snapPointsOnly || showVisuals) ? stencil.snapPoints.map(sp => {
    const spx = flipH ? 1 - sp.x : sp.x;
    const spy = flipV ? 1 - sp.y : sp.y;
    return (
      <SnapPoint
        key={sp.id}
        cx={spx * element.width}
        cy={spy * element.height}
        snapId={sp.id}
        isVisible={showVisuals}
        isSource={connectingFrom?.elementId === element.id && connectingFrom?.snapId === sp.id}
        onSnapPointClick={handleSnapPointClick}
        onMouseEnter={() => onHoverChange?.(element.id)}
        onMouseLeave={() => onHoverChange?.(null)}
      />
    );
  }) : null;

  if (snapPointsOnly) {
    return (
      <g transform={`translate(${element.x}, ${element.y}) rotate(${rotation}, ${cx}, ${cy})`}>
        {snapPoints}
      </g>
    );
  }

  return (
    <g
      transform={`translate(${element.x}, ${element.y}) rotate(${rotation}, ${cx}, ${cy})`}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => onHoverChange?.(element.id)}
      onMouseLeave={() => onHoverChange?.(null)}
      style={{ cursor: "default", outline: "none" }}
    >
      {/* Selection outline */}
      {isSelected && (
        <rect x={-2} y={-2} width={element.width + 4} height={element.height + 4}
          fill="none" stroke="hsl(var(--primary))" strokeWidth={2} rx={6}
          className="drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]"
          style={{ cursor: "move", pointerEvents: "all" }} />
      )}

      {/* Stencil image — with flip transform applied */}
      <g transform={flipTransform}>
        <image
          href={stencil.svgPath}
          width={element.width}
          height={element.height}
          preserveAspectRatio="none"
          style={{ pointerEvents: "all", cursor: "move" }}
        />
      </g>

      {/* Snap points — rendered here as well to maintain hit targets during interaction */}
      {snapPoints}

      {/* Handles — only when selected */}
      {isSelected && (
        <>
          {/* Resize corners */}
          {resizeCorners.map(h => (
            <circle key={h.corner}
              cx={h.cx} cy={h.cy} r={6}
              fill="white" stroke="hsl(var(--primary))" strokeWidth={2.5}
              className="drop-shadow-sm hover:scale-125 transition-transform duration-200"
              style={{ cursor: h.cursor, pointerEvents: "all" }}
              onMouseDown={e => handleResizeMouseDown(e, h.corner)}
            />
          ))}

          {/* Rotation stem + handle */}
          <line x1={cx} y1={-4} x2={cx} y2={-24}
            stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="4 2" style={{ pointerEvents: "none" }} />
          <circle cx={cx} cy={-32} r={10}
            fill="white" stroke="hsl(var(--primary))" strokeWidth={2.5}
            className="drop-shadow-md hover:scale-110 transition-transform duration-200"
            style={{ cursor: "crosshair", pointerEvents: "all" }}
            onMouseDown={handleRotateMouseDown}
          />
          <path d="M -4 -1 A 4 4 0 1 1 1 4" fill="none"
            stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinecap="round"
            transform={`translate(${cx}, -32)`} style={{ pointerEvents: "none" }} />
          <polygon points="1,4 4,2 -1,1" fill="hsl(var(--primary))"
            transform={`translate(${cx}, -32)`} style={{ pointerEvents: "none" }} />
        </>
      )}
    </g>
  );
};

export default CanvasElementComponent;