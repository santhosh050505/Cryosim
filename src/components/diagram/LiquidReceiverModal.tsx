import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CanvasElement } from "@/lib/canvasTypes";

interface LiquidReceiverModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: CanvasElement | null;
  onSave: (data: any) => void;
}

const MANUFACTURERS = ["Refrigeration research"];
const PRODUCT_TYPES = ["BULL DOG Receivers", "ASME Receivers"];
const ORIENTATIONS = ["Horizontal", "Vertical"];

export function LiquidReceiverModal({ isOpen, onClose, element, onSave }: LiquidReceiverModalProps) {
  const [manufacturer, setManufacturer] = useState("Refrigeration research");
  const [productType, setProductType] = useState("");
  const [orientation, setOrientation] = useState("");

  useEffect(() => {
    if (isOpen && element?.receiverData) {
      setManufacturer(element.receiverData.manufacturer || "Refrigeration research");
      setProductType(element.receiverData.productType || "");
      setOrientation(element.receiverData.orientation || "");
    } else if (isOpen) {
      setManufacturer("Refrigeration research");
      setProductType("");
      setOrientation("");
    }
  }, [element, isOpen]);

  const handleSave = () => {
    onSave({
      manufacturer,
      productType,
      orientation,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[360px] p-0 overflow-hidden border-sidebar-tool-border/20 shadow-2xl backdrop-blur-3xl bg-background/95">
        <div className="bg-sidebar-tool-bg p-4 flex items-center justify-between border-b border-sidebar-tool-border/50">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-sidebar-tool-active uppercase">CryoVault Receiver</span>
            <DialogTitle className="text-sm font-bold tracking-tight text-white uppercase">Liquid Receiver Setup</DialogTitle>
          </div>
          <div className="h-2 w-2 rounded-full bg-sidebar-tool-active animate-pulse" />
        </div>

        <div className="p-5 grid gap-4 bg-background">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Manufacturer</Label>
            <div className="col-span-3">
              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger className="h-9 text-xs border-muted/50">
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-muted/20">
                  {MANUFACTURERS.map(m => (
                    <SelectItem key={m} value={m} className="text-xs py-2">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Product Type</Label>
            <div className="col-span-3">
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger className="h-9 text-xs border-muted/50">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-muted/20">
                  {PRODUCT_TYPES.map(t => (
                    <SelectItem key={t} value={t} className="text-xs py-2">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Orientation</Label>
            <div className="col-span-3">
              <Select value={orientation} onValueChange={setOrientation}>
                <SelectTrigger className="h-9 text-xs border-muted/50">
                  <SelectValue placeholder="Select Orientation" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-muted/20">
                  {ORIENTATIONS.map(o => (
                    <SelectItem key={o} value={o} className="text-xs py-2">{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-secondary/20 border-t border-muted/30">
          <Button 
            onClick={handleSave} 
            className="w-full h-10 bg-sidebar-tool-active hover:bg-sidebar-tool-active/90 text-white font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-sidebar-tool-active/20 rounded-lg transition-all active:scale-[0.98]"
          >
            Apply Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
