import React, { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Trash2, RotateCcw, RotateCw, Undo2, Redo2, FlipHorizontal, FlipVertical, FileText, ChevronDown, Plus, FolderOpen, Save } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CreateProjectDialog, OpenProjectDialog } from "./ProjectDialogs";

interface CanvasToolbarProps {
  zoom: number;
  hasSelection: boolean;
  hasConnectorSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  projectName?: string;
  refrigerant?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onDelete: () => void;
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCreateProject: (name: string, refrig: string) => void;
  onSaveProject: () => void;
  onOpenProject: (name: string) => void;
  getSavedProjects: () => any[];
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  zoom, hasSelection, hasConnectorSelection, canUndo, canRedo,
  projectName, refrigerant,
  onZoomIn, onZoomOut, onResetView, onDelete,
  onRotateCW, onRotateCCW, onFlipH, onFlipV,
  onUndo, onRedo,
  onCreateProject, onSaveProject, onOpenProject, getSavedProjects
}) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [openProjectOpen, setOpenProjectOpen] = useState(false);
  
  const btnBase = "p-2 rounded-lg hover:bg-sidebar-tool-active/10 text-muted-foreground hover:text-sidebar-tool-active transition-all duration-200 active:scale-90 flex items-center justify-center";

  return (
    <div className="toolbar-top h-14 flex items-center px-6 gap-2 shrink-0 bg-background/80 backdrop-blur-xl border-b border-border shadow-[0_1px_10px_rgba(0,0,0,0.05)] z-30">
      
      {/* Files Dropdown */}
      <div className="mr-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sidebar-tool-active text-white text-xs font-bold uppercase tracking-wider transition-all hover:brightness-110 hover:shadow-lg hover:shadow-sidebar-tool-active/20 active:scale-95">
              <FileText className="w-3.5 h-3.5" />
              <span>Project</span>
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-2 rounded-xl border-sidebar-tool-border/20 shadow-2xl backdrop-blur-2xl">
            <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-sidebar-tool-active/10 group">
              <Plus className="w-4 h-4 text-sidebar-tool-active" />
              <div className="flex flex-col">
                <span className="font-semibold text-xs">New Project</span>
                <span className="text-[10px] text-muted-foreground">Start from scratch</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOpenProjectOpen(true)} className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-sidebar-tool-active/10 group">
              <FolderOpen className="w-4 h-4 text-sidebar-tool-active" />
              <div className="flex flex-col">
                <span className="font-semibold text-xs">Open Project</span>
                <span className="text-[10px] text-muted-foreground">Load from storage</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1.5 opacity-50" />
            <DropdownMenuItem onClick={onSaveProject} className="gap-3 cursor-pointer py-2.5 rounded-lg focus:bg-sidebar-tool-active/10 group">
              <Save className="w-4 h-4 text-sidebar-tool-active" />
              <div className="flex flex-col">
                <span className="font-semibold text-xs">Save Current</span>
                <span className="text-[10px] text-muted-foreground">Keep your progress</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {projectName && (
        <div className="flex items-center gap-4 mr-6 pl-6 border-l border-border/50 h-full">
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-sidebar-tool-active animate-pulse" />
              <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-muted-foreground/60 leading-none">Active Session</span>
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              {projectName}
              {refrigerant && (
                <span className="text-[9px] bg-sidebar-tool-active/5 text-sidebar-tool-active border border-sidebar-tool-active/20 px-2 py-0.5 rounded-full font-bold">
                  {refrigerant}
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Workspace Controls Group */}
      <div className="flex items-center bg-secondary/50 p-1 rounded-xl gap-0.5">
        <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"
          className={`${btnBase} disabled:opacity-20`}>
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)"
          className={`${btnBase} disabled:opacity-20`}>
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      <div className="h-6 w-px bg-border/50 mx-2" />

      {/* View Controls Group */}
      <div className="flex items-center bg-secondary/50 p-1 rounded-xl gap-0.5">
        <button onClick={onZoomOut} title="Zoom Out" className={btnBase}>
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="px-3 min-w-[3.5rem] flex flex-col items-center justify-center">
           <span className="text-[10px] uppercase font-bold text-muted-foreground/40 leading-none mb-0.5">Zoom</span>
           <span className="text-xs font-mono font-bold tracking-tighter tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <button onClick={onZoomIn} title="Zoom In" className={btnBase}>
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={onResetView} title="Fit to Screen" className={btnBase}>
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1" />

      {/* Contextual Selection tools — only when a stencil is selected */}
      {(hasSelection || hasConnectorSelection) && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
          <div className="h-6 w-px bg-border/50 mx-1" />
          
          {hasSelection && (
            <div className="flex items-center bg-primary/5 border border-primary/10 p-1 rounded-xl gap-0.5">
              <button onClick={onRotateCCW} title="Rotate Left" className={btnBase}>
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={onRotateCW} title="Rotate Right" className={btnBase}>
                <RotateCw className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-primary/20 mx-1" />
              <button onClick={onFlipH} title="Mirror H" className={btnBase}>
                <FlipHorizontal className="w-4 h-4" />
              </button>
              <button onClick={onFlipV} title="Mirror V" className={btnBase}>
                <FlipVertical className="w-4 h-4" />
              </button>
            </div>
          )}

          <button onClick={onDelete} title="Remove Selection"
            className="p-2 rounded-lg hover:bg-destructive/10 text-destructive hover:text-destructive transition-all active:scale-90 flex items-center justify-center border border-transparent hover:border-destructive/20 ml-1">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      <CreateProjectDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreate={onCreateProject} />
      <OpenProjectDialog isOpen={openProjectOpen} onClose={() => setOpenProjectOpen(false)} onOpen={onOpenProject} projects={getSavedProjects()} />
    </div>
  );
};

export default CanvasToolbar;