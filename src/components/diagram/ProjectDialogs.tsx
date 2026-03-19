import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, refrigerant: string) => void;
}

export function CreateProjectDialog({ isOpen, onClose, onCreate }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [refrigerant, setRefrigerant] = useState("");

  const handleCreate = () => {
    if (!name) return;
    onCreate(name, refrigerant);
    onClose();
    setName("");
    setRefrigerant("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="proj-name" className="text-right">Project Name</Label>
            <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="My Cooling System" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="proj-refrig" className="text-right">Refrigerant</Label>
            <Input id="proj-refrig" value={refrigerant} onChange={(e) => setRefrigerant(e.target.value)} className="col-span-3" placeholder="R-717" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!name}>Create Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OpenProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: (name: string) => void;
  projects: any[];
}

export function OpenProjectDialog({ isOpen, onClose, onOpen, projects }: OpenProjectDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Open Project</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[300px] pr-4 mt-2">
          <div className="flex flex-col gap-2">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No saved projects found.</p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.projectName}
                  onClick={() => { onOpen(p.projectName); onClose(); }}
                  className="flex flex-col text-left p-3 border rounded-md hover:bg-accent transition-colors group"
                >
                  <span className="font-semibold text-sm group-hover:text-accent-foreground">{p.projectName}</span>
                  <div className="flex justify-between w-full text-[10px] text-muted-foreground mt-1">
                    <span>Refrigerant: {p.refrigerant || "N/A"}</span>
                    <span>Last Saved: {new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
