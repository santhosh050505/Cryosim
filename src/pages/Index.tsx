import React, { useEffect, useCallback } from "react";
import StencilPanel from "@/components/diagram/StencilPanel";
import DiagramCanvas from "@/components/diagram/DiagramCanvas";
import CanvasToolbar from "@/components/diagram/CanvasToolbar";
import { useCanvasState } from "@/hooks/useCanvasState";

const Index = () => {
  const canvasState = useCanvasState();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as Element).tagName === "INPUT") return;
        canvasState.deleteSelected();
      }
      if (e.key === "Escape") canvasState.cancelConnection();
      if (e.key === "[" && canvasState.selectedId) {
        const el = canvasState.elements.find(e2 => e2.id === canvasState.selectedId);
        if (el) canvasState.rotateElement(el.id, (el.rotation ?? 0) - 90);
      }
      if (e.key === "]" && canvasState.selectedId) {
        const el = canvasState.elements.find(e2 => e2.id === canvasState.selectedId);
        if (el) canvasState.rotateElement(el.id, (el.rotation ?? 0) + 90);
      }
    },
    [canvasState]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <StencilPanel onDragStart={() => {}} />
      <div className="flex-1 flex flex-col min-w-0">
        <CanvasToolbar
          zoom={canvasState.viewport.zoom}
          hasSelection={!!canvasState.selectedId}
          hasConnectorSelection={!!canvasState.selectedConnectorId}
          canUndo={canvasState.canUndo}
          canRedo={canvasState.canRedo}
          projectName={canvasState.projectName}
          refrigerant={canvasState.refrigerant}
          onZoomIn={canvasState.zoomIn}
          onZoomOut={canvasState.zoomOut}
          onResetView={canvasState.resetView}
          onDelete={canvasState.deleteSelected}
          onRotateCCW={() => {
            if (!canvasState.selectedId) return;
            const el = canvasState.elements.find(e => e.id === canvasState.selectedId);
            if (el) canvasState.rotateElement(el.id, (el.rotation ?? 0) - 90);
          }}
          onRotateCW={() => {
            if (!canvasState.selectedId) return;
            const el = canvasState.elements.find(e => e.id === canvasState.selectedId);
            if (el) canvasState.rotateElement(el.id, (el.rotation ?? 0) + 90);
          }}
          onFlipH={() => {
            if (!canvasState.selectedId) return;
            canvasState.flipElement(canvasState.selectedId, "H");
          }}
          onFlipV={() => {
            if (!canvasState.selectedId) return;
            canvasState.flipElement(canvasState.selectedId, "V");
          }}
          onUndo={canvasState.undo}
          onRedo={canvasState.redo}
          onCreateProject={canvasState.createProject}
          onSaveProject={canvasState.saveProject}
          onOpenProject={canvasState.loadProject}
          getSavedProjects={canvasState.getSavedProjects}
        />
        <DiagramCanvas canvasState={canvasState} />
      </div>
    </div>
  );
};

export default Index;