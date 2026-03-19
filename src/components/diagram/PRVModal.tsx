import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CanvasElement } from "@/lib/canvasTypes";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PRVModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: CanvasElement | null;
  onSave: (data: any) => void;
  
  projectRefrigerant?: string;
  isConnectedToReceiver?: boolean;
}

const MANUFACTURERS = ["Mueller Refrigeration", "Superior"];

const VALVE_TYPES: Record<string, string[]> = {
  "Mueller Refrigeration": [
    "Angle NPTFE to Flare",
    "Atmospheric - NPTFE Inlet",
    "Internal",
    "Straight Thru",
    "High Pressure"
  ],
  "Superior": [
    "Angle Valves",
    "Atmospheric Valves",
    "Straight Thru",
    "Female Connection Valves"
  ]
};

const VALVE_FILES: Record<string, string> = {
  "Angle Valves": "Angle valve.json",
  "Atmospheric Valves": "valves_atmospheric.json",
  "Straight Thru": "Straight Thru.json",
  "Female Connection Valves": "Female Connection Valves.json"
};

const MUELLER_CONFIG: Record<string, { f: string; discharge: string; results: string }> = {
  "Angle NPTFE to Flare": {
    f: "refrigerantFactors for f.json",
    discharge: "To find discharge.json",
    results: "Discharge result.json",
  },
  "Internal": {
    f: "refrigerantFactors for f 1.json",
    discharge: "Internal 1.json",
    results: "Internal.json",
  },
  "Atmospheric - NPTFE Inlet": {
    f: "refrigerantFactors for f 2.json",
    discharge: "Valves_Atmospheric .json",
    results: "Valves_Atmospheric 1.json",
  },
  "Straight Thru": {
    f: "refrigerantFactors for f 4.json",
    discharge: "Valves_Straight .json",
    results: "Valves_Straight 1.json",
  },
  "High Pressure": {
    f: "refrigerantFactors for f 3.json",
    discharge: "Valves_High_Pressure .json",
    results: "Valves_High_Pressure 1.json",
  }
};

export function PRVModal({ isOpen, onClose, element, onSave, projectRefrigerant, isConnectedToReceiver }: PRVModalProps) {
  const [manufacturer, setManufacturer] = useState("");
  const [typeOfValve, setTypeOfValve] = useState("");
  const [diameter, setDiameter] = useState("");
  const [length, setLength] = useState("");
  const [workingPressure, setWorkingPressure] = useState("");
  const [connectionSize, setConnectionSize] = useState("");
  const [refrigerant, setRefrigerant] = useState("");
  const [lookupResults, setLookupResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [calculatedC, setCalculatedC] = useState<number | null>(null);
  const [matchingPressure, setMatchingPressure] = useState<string | null>(null);
  const [dischargeLetter, setDischargeLetter] = useState<string | null>(null);
  const [psiData, setPsiData] = useState<any[]>([]);
  const [selectedPsiPart, setSelectedPsiPart] = useState("");
  const [receiverMaxPressure, setReceiverMaxPressure] = useState<number | null>(null);

  const [receiverParts, setReceiverParts] = useState<any[]>([]);
  const [loadingReceivers, setLoadingReceivers] = useState(false);

  useEffect(() => {
    const fetchPsiData = async () => {
      try {
        const res = await fetch('/psi.json');
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json[0]?.data) {
            setPsiData(json[0].data);
          }
        }
      } catch (err) {
        console.error("Failed to load psi.json", err);
      }
    };
    fetchPsiData();
  }, []);

  useEffect(() => {
    const fetchReceiverParts = async () => {
      const wp = parseFloat(workingPressure);
      if (isNaN(wp)) {
        setReceiverParts([]);
        return;
      }

      if (wp > 675) {
        setError("Please enter the valid working pressure (max 675 PSIG).");
        setReceiverParts([]);
        return;
      }
      
      setError(null);
      setLoadingReceivers(true);
      try {
        const filesToFetch = [];
        if (wp <= 450) {
          filesToFetch.push('receivers_data_450_updated.json', 'receivers_data_600_updated.json', 'receivers_data_675_updated.json');
        } else if (wp <= 600) {
          filesToFetch.push('receivers_data_600_updated.json', 'receivers_data_675_updated.json');
        } else if (wp <= 675) {
          filesToFetch.push('receivers_data_675_updated.json');
        }

        const allParts: any[] = [];
        for (const file of filesToFetch) {
          const res = await fetch(`/maxpressure/${file}`);
          if (res.ok) {
            const data = await res.json();
            allParts.push(...data);
          }
        }
        setReceiverParts(allParts);
      } catch (err) {
        console.error("Failed to load receiver data", err);
      } finally {
        setLoadingReceivers(false);
      }
    };

    if (isConnectedToReceiver && workingPressure) {
      fetchReceiverParts();
    } else {
      setReceiverParts([]);
    }
  }, [workingPressure, isConnectedToReceiver]);

  useEffect(() => {
    if (isOpen) {
      if (element?.prvData) {
        setManufacturer(element.prvData.manufacturer || "");
        setTypeOfValve(element.prvData.typeOfValve || "");
        setDiameter(element.prvData.diameter || "");
        setLength(element.prvData.length || "");
        setWorkingPressure(element.prvData.workingPressure || "");
        setConnectionSize(element.prvData.connectionSize || "");
        setRefrigerant(projectRefrigerant || element.prvData.refrigerant || "");
      } else {
        setManufacturer("");
        setTypeOfValve("");
        setDiameter("");
        setLength("");
        setWorkingPressure("");
        setConnectionSize("");
        setRefrigerant(projectRefrigerant || "");
      }
      setLookupResults(null);
      setError(null);
      setShowResults(false);
      setCalculatedC(null);
      setMatchingPressure(null);
      setDischargeLetter(null);
      setSelectedPsiPart("");
      setReceiverMaxPressure(null);
    }
  }, [element, isOpen, projectRefrigerant]);

  const handleSave = () => {
    onSave({
      manufacturer,
      typeOfValve,
      diameter,
      length,
      workingPressure,
      connectionSize,
      refrigerant,
      selectedValve: lookupResults && lookupResults.length > 0 ? lookupResults[0] : null
    });
    onClose();
  };

  const performMuellerLookup = async () => {
    setIsSearching(true);
    setError(null);
    setLookupResults(null);

    const config = MUELLER_CONFIG[typeOfValve];
    if (!config) {
      setError(`Configuration not found for valve type: ${typeOfValve}`);
      setIsSearching(false);
      return;
    }

    try {
      const folderPath = `/Mueller/${typeOfValve}`;
      
      // 1. Get f value
      const factorsRes = await fetch(`${folderPath}/${config.f}`);
      if (!factorsRes.ok) throw new Error(`Could not load refrigerant factors for ${typeOfValve}.`);
      const factorsData = await factorsRes.json();
      const factors = factorsData.refrigerantFactors;

      const normRef = refrigerant.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const refData = factors[normRef];
      if (!refData) throw new Error(`Refrigerant ${refrigerant} ("${normRef}") not found in database.`);

      const userP = parseFloat(workingPressure);
      const mwp = receiverMaxPressure || 1000; // Default to high if not connected to receiver

      const availablePressures = Object.keys(refData).map(Number).sort((a, b) => a - b);
      let matchP = availablePressures.find(p => p >= userP && p <= mwp);
      if (!matchP) throw new Error(`Operating pressure range [${userP}, ${mwp}] is out of range for this refrigerant.`);
      
      const f = refData[matchP.toString()];

      // 2. Calculate C
      const d = parseFloat(diameter);
      const l = parseFloat(length);
      if (isNaN(d) || isNaN(l)) throw new Error("Invalid diameter or length.");
      
      const C = f * d * l;
      setCalculatedC(C);

      // 3. Get Final Results first to see available table letters
      const resultsRes = await fetch(`${folderPath}/${config.results}`);
      if (!resultsRes.ok) throw new Error("Could not load discharge results.");
      const resultsRaw = await resultsRes.json();

      let allResults: any[] = [];
      if (Array.isArray(resultsRaw)) {
        allResults = resultsRaw;
      } else if (resultsRaw.valves) {
        allResults = resultsRaw.valves;
      } else if (resultsRaw.products) {
        allResults = resultsRaw.products;
      } else {
        Object.values(resultsRaw).forEach(val => {
          if (Array.isArray(val)) {
            allResults = [...allResults, ...val];
          }
        });
      }

      const availableLetters = new Set();
      allResults.forEach(r => {
        const t = r["Discharge Table"] || r["discharge_table"];
        if (t) availableLetters.add(t);
      });

      // 4. Find Discharge Letter
      const dischargeRes = await fetch(`${folderPath}/${config.discharge}`);
      if (!dischargeRes.ok) throw new Error("Could not load discharge lookup table.");
      const dischargeRaw = await dischargeRes.json();
      
      let psigEntries = Array.isArray(dischargeRaw) ? dischargeRaw : (dischargeRaw.PSIG_Data || dischargeRaw.PSIG || []);
      
      const sortedEntries = psigEntries
        .filter((e: any) => {
          const p = parseFloat(e.PSIG || e.pressure || "0");
          return p >= userP && p <= mwp;
        })
        .sort((a: any, b: any) => {
          const pa = parseFloat(a.PSIG || a.pressure || "0");
          const pb = parseFloat(b.PSIG || b.pressure || "0");
          return pa - pb;
        });

      if (sortedEntries.length === 0) throw new Error("No pressure data available for this range.");
      
      let finalPressure: string | null = null;
      let finalLetter: string | null = null;
      let finalValves: any[] = [];

      for (const row of sortedEntries) {
        if (finalLetter) break;

        const rowPressure = (row.PSIG || row.pressure)?.toString();
        const rowCapacities = row.Capacities || row.capacity || {};
        
        // Sort letters by their capacity at this pressure (ascending)
        const lettersSortedByCap = Object.entries(rowCapacities)
          .map(([letter, cap]) => ({ letter, capVal: parseFloat(cap as string) }))
          .filter(e => !isNaN(e.capVal))
          .sort((a, b) => a.capVal - b.capVal);

        for (const { letter, capVal } of lettersSortedByCap) {
          if (capVal >= C && availableLetters.has(letter)) {
            // Check if ANY valve for this letter matches the connection size
            const normalizeSize = (s: string | number) => {
              const str = String(s).trim();
              if (str === "1/8" || str === "0.125") return "0.125";
              if (str === "1/4" || str === "0.25") return "0.25";
              if (str === "3/8" || str === "0.375") return "0.375";
              if (str === "1/2" || str === "0.5") return "0.5";
              if (str === "3/4" || str === "0.75") return "0.75";
              if (str === "1" || str === "1.0") return "1";
              if (str === "1 1/4" || str === "1.25") return "1.25";
              if (str === "1 1/2" || str === "1.5") return "1.5";
              return str;
            };

            const targetSizeNorm = normalizeSize(connectionSize);

            const matches = allResults.filter(r => {
              const table = r["Discharge Table"] || r["discharge_table"];
              const inlet = (r["NPTFE A (in)"] || r["Inlet A (in)"] || r["nptfe_A_in"] || r["inlet"]?.["nptfe_A_in"] || r["inlet_size"] || "");
              const inletNorm = normalizeSize(inlet as string | number);
              return table === letter && (inletNorm === targetSizeNorm || String(inlet) === connectionSize);
            });

            if (matches.length > 0) {
              finalPressure = rowPressure;
              finalLetter = letter;
              finalValves = matches;
              break; 
            }
          }
        }
      }

      if (!finalLetter) {
        throw new Error(`No available valves match capacity ${C.toFixed(2)} and connection size ${connectionSize} within pressure range [${userP}, ${mwp}] PSIG.`);
      }

      setMatchingPressure(finalPressure);
      setDischargeLetter(finalLetter);
      setLookupResults(finalValves);
      setShowResults(true);

    } catch (err: any) {
      setError(err.message || "An error occurred during Mueller lookup");
    } finally {
      setIsSearching(false);
    }
  };

  const performSuperiorLookup = async () => {
    setIsSearching(true);
    setError(null);
    setLookupResults(null);

    try {
      // 1. Fetch refrigerant factors
      const factorsRes = await fetch('/superior/refrigerant_factors.json');
      const factors = await factorsRes.json();
      
      let f: number | null = null;
      for (const [key, list] of Object.entries(factors)) {
        if ((list as string[]).includes(refrigerant)) {
          f = parseFloat(key);
          break;
        }
      }

      if (f === null) {
        throw new Error(`Refrigerant factor for ${refrigerant} not found.`);
      }

      // 2. Calculate C
      const d = parseFloat(diameter);
      const l = parseFloat(length);
      if (isNaN(d) || isNaN(l)) {
        throw new Error("Invalid diameter or length value.");
      }

      const C = f * d * l;
      setCalculatedC(C);

      // 3. Fetch valve data
      const fileName = VALVE_FILES[typeOfValve];
      if (!fileName) {
        throw new Error(`Valve type ${typeOfValve} not supported for lookup.`);
      }

      const valvesRes = await fetch(`/superior/${fileName}`);
      const valves: any[] = await valvesRes.json();

       const userP = parseFloat(workingPressure);
      const mwp = receiverMaxPressure || 1000;
      
      // 4. Find matches per valve
      let finalists: any[] = [];
      
      valves.forEach(valve => {
        const inlet = valve["Size (Inches)"]?.["Inlet NPT"];
        const matchesSize = String(inlet) === String(connectionSize);

        if (matchesSize) {
          const capacities = valve["Discharge Capacity (psig)"] || {};
          const validPressures = Object.entries(capacities)
            .map(([pStr, cap]) => ({
              pressure: parseFloat(pStr),
              capacity: typeof cap === 'string' ? parseFloat(cap) : (cap as number)
            }))
            .filter(entry => entry.pressure >= userP && entry.pressure <= mwp && entry.capacity !== null && !isNaN(entry.capacity) && entry.capacity >= C)
            .sort((a, b) => a.pressure - b.pressure);

          if (validPressures.length > 0) {
            finalists.push({
              ...valve,
              foundPressure: validPressures[0].pressure.toString(),
              foundCapacity: validPressures[0].capacity
            });
          }
        }
      });

      if (finalists.length === 0) {
        throw new Error(`No valve found with sufficient capacity (>= ${C.toFixed(2)}) within pressure range [${userP}, ${mwp}] psig.`);
      }

      setLookupResults(finalists);
      setMatchingPressure(finalists[0].foundPressure);
      setShowResults(true);

    } catch (err: any) {
      setError(err.message || "An error occurred during lookup");
    } finally {
      setIsSearching(false);
    }
  };

  const handleApply = () => {
    if (!isConnectedToReceiver) {
      if (!manufacturer || !typeOfValve || !refrigerant) {
        setError("Please select Manufacturer, Valve Type, and Refrigerant.");
        return;
      }
      
      // If user has provided all data for lookup, perform it anyway
      if (diameter && length && workingPressure && connectionSize && (manufacturer === "Mueller Refrigeration" || manufacturer === "Superior")) {
        if (manufacturer === "Mueller Refrigeration") {
          performMuellerLookup();
        } else {
          performSuperiorLookup();
        }
        return;
      }

      handleSave();
      return;
    }

    if (!manufacturer || !typeOfValve || !diameter || !length || !workingPressure || !refrigerant) {
      setError("Please fill in all fields before applying.");
      return;
    }

    if (manufacturer === "Mueller Refrigeration") {
      performMuellerLookup();
    } else if (manufacturer === "Superior") {
      performSuperiorLookup();
    } else {
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`p-0 overflow-hidden border-sidebar-tool-border/20 shadow-2xl backdrop-blur-3xl bg-background/95 ${isConnectedToReceiver ? 'sm:max-w-[360px]' : 'sm:max-w-[320px]'}`}>
        <div className="bg-sidebar-tool-bg p-4 flex items-center justify-between border-b border-sidebar-tool-border/50">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-sidebar-tool-active uppercase">CryoControl Panel</span>
            <DialogTitle className="text-sm font-bold tracking-tight text-white uppercase">PRV Configuration</DialogTitle>
          </div>
          <div className="h-2 w-2 rounded-full bg-sidebar-tool-active animate-pulse" />
        </div>

        <div className="p-5 grid gap-4 bg-background">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="manufacturer" className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Manufacturer</Label>
            <div className="col-span-3">
              <Select value={manufacturer} onValueChange={(val) => {
                setManufacturer(val);
                setTypeOfValve("");
                setError(null);
              }}>
                <SelectTrigger id="manufacturer" className="h-9 text-xs border-muted/50 focus:ring-sidebar-tool-active/30">
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
            <Label htmlFor="typeOfValve" className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Valve Type</Label>
            <div className="col-span-3">
              <Select value={typeOfValve} onValueChange={(val) => {
                setTypeOfValve(val);
                setError(null);
              }} disabled={!manufacturer}>
                <SelectTrigger id="typeOfValve" className="h-9 text-xs border-muted/50 focus:ring-sidebar-tool-active/30">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-muted/20">
                  {(VALVE_TYPES[manufacturer] || []).map(t => (
                    <SelectItem key={t} value={t} className="text-xs py-2">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="h-px bg-muted/40 my-1" />

          {isConnectedToReceiver ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="pressure" className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Working Pressure</Label>
                <div className="col-span-3">
                  <Input 
                    id="pressure" 
                    value={workingPressure} 
                    onChange={(e) => setWorkingPressure(e.target.value)} 
                    className="h-9 text-xs border-muted/50 bg-secondary/30 focus:bg-background transition-all" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="psiPart" className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Receiver Part No</Label>
                <div className="col-span-3 relative">
                  <Select value={selectedPsiPart} onValueChange={(val) => {
                    setSelectedPsiPart(val);
                    const item = receiverParts.find(d => String(d.part_number) === val) || psiData.find(d => String(d["Part Number"]) === val);
                    if (item) {
                      const d = item.diameter_a || item["\"A\" Diameter"];
                      const l = item.length_over_caps_b || item["\"B\" Length Over Caps"];
                      setDiameter(String(d));
                      setLength(String(l));
                      setConnectionSize(String(item.connection_size || "1/2"));
                      setReceiverMaxPressure(item.max_allowable_pressure || null);
                    }
                  }}>
                    <SelectTrigger id="psiPart" className="h-9 text-xs border-muted/50 focus:ring-sidebar-tool-active/30">
                      <SelectValue placeholder="Select Receiver Part" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-muted/20">
                      {(receiverParts.length > 0 ? receiverParts : psiData).map((item, idx) => {
                        const pNo = item.part_number || item["Part Number"];
                        const maxP = item.max_allowable_pressure || "";
                        return (
                          <SelectItem key={`${pNo}-${idx}`} value={String(pNo)} className="text-xs py-2">
                            {pNo} {maxP ? `(${maxP} PSIG)` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {loadingReceivers && (
                    <div className="absolute right-10 top-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="diameter" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vessel Diameter (ft)</Label>
                  <Input id="diameter" value={diameter} onChange={(e) => setDiameter(e.target.value)} className="h-9 text-xs border-muted/50 bg-secondary/30 focus:bg-background transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="length" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vessel Length (ft)</Label>
                  <Input id="length" value={length} onChange={(e) => setLength(e.target.value)} className="h-9 text-xs border-muted/50 bg-secondary/30 focus:bg-background transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="connectionSize" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Connection Size</Label>
                  <Input id="connectionSize" value={connectionSize} onChange={(e) => setConnectionSize(e.target.value)} placeholder="e.g. 1/4" className="h-9 text-xs border-muted/50 bg-secondary/30 focus:bg-background transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="refrigerant" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Refrigerant</Label>
                  <Input 
                    id="refrigerant" 
                    value={refrigerant} 
                    onChange={(e) => setRefrigerant(e.target.value)}
                    className="h-9 text-xs border-muted/50 bg-secondary/30 focus:bg-background transition-all" 
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="refrigerant-only" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Refrigerant</Label>
              <Input 
                id="refrigerant-only" 
                value={refrigerant} 
                onChange={(e) => setRefrigerant(e.target.value)}
                className="h-9 text-xs border-muted/50 bg-secondary/30 focus:bg-background transition-all" 
              />
              <div className="mt-2 text-[10px] text-muted-foreground/80 italic text-center p-2 bg-secondary/10 rounded-md border border-muted/20">
                Connect this PRV to a Liquid Receiver or Suction Accumulator stencil to enable capacity lookup and enter vessel dimensions.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-secondary/20 border-t border-muted/30">
          <Button 
            disabled={isSearching}
            onClick={handleApply} 
            className="w-full h-10 bg-sidebar-tool-active hover:bg-sidebar-tool-active/90 text-white font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-sidebar-tool-active/20 rounded-lg transition-all active:scale-[0.98]"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Apply Component Data
          </Button>
        </DialogFooter>

        {error && (
          <div className="px-5 pb-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-[11px] text-destructive leading-normal">{error}</p>
            </div>
          </div>
        )}
      </DialogContent>
      
      {/* Results Modal */}
      <Dialog open={showResults} onOpenChange={(open) => !open && setShowResults(false)}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-sidebar-tool-border/20 shadow-2xl backdrop-blur-3xl bg-background/95">
          <div className="bg-sidebar-tool-active p-4 flex items-center gap-3 border-b border-white/10">
            <CheckCircle2 className="h-5 w-5 text-white" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-white/70 uppercase">Lookup Results</span>
              <DialogTitle className="text-sm font-bold tracking-tight text-white uppercase">Matching Component Found</DialogTitle>
            </div>
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="p-5 space-y-4">
              <div className="bg-sidebar-tool-active/5 rounded-xl p-4 border border-sidebar-tool-active/20 space-y-3">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-foreground/60 font-bold uppercase tracking-wider">Calculated Capacity (C)</span>
                  <span className="font-mono font-bold text-foreground bg-sidebar-tool-active/10 px-2 py-0.5 rounded">{calculatedC?.toFixed(3)}</span>
                </div>
                {manufacturer === "Mueller Refrigeration" && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-foreground/60 font-bold uppercase tracking-wider">Discharge Table Match</span>
                    <span className="font-mono font-bold text-sidebar-tool-active text-xs">{dischargeLetter}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-foreground/60 font-bold uppercase tracking-wider">Working Pressure</span>
                  <span className="font-bold text-foreground">{workingPressure} psig</span>
                </div>
                {receiverMaxPressure && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-foreground/60 font-bold uppercase tracking-wider">Receiver Max Pressure</span>
                    <span className="font-bold text-orange-500">{receiverMaxPressure} PSIG</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-foreground/60 font-bold uppercase tracking-wider">Results Found</span>
                  <span className="font-mono font-bold text-sidebar-tool-active text-xs">{lookupResults?.length || 0} valve(s)</span>
                </div>
              </div>

              {manufacturer === "Mueller Refrigeration" ? (
                // Mueller Result Rendering
                lookupResults?.map((res, idx) => {
                  // Robust property extraction for inconsistent Mueller JSONs
                  const partNo = res["Part Number *"] || res["Part Number"] || res["part_number"];
                  const inlet = res["NPTFE A (in)"] || res["Inlet A (in)"] || res["nptfe_A_in"] || res["inlet"]?.["nptfe_A_in"] || res["inlet_size"] || res["Inlet A (in)"];
                  const outlet = res["Flare Outlet B"] || res["Outlet B (in)"] || res["Flare B (in)"] || res["NPTFI B (in)"] || res["dimension"]?.["B_in"] || res["outlet_size"] || res["NPTFI B (in)"] || res["Outlet B (in)"] || res["Flare B (in)"];
                  
                  // Handle nested dimensions or flat fields
                  const dimC = res["C (in)"] || res["dimension"]?.["C_in"] || res["C_in"];
                  const dimCmm = res["C (mm)"] || res["dimension"]?.["C_mm"] || res["C_mm"];
                  const dimD = res["D(in)"] || res["D (in)"] || res["dimension"]?.["D_in"] || res["D_in"];
                  const dimDmm = res["D (mm)"] || res["dimension"]?.["D_mm"] || res["D_mm"];
                  
                  // Handle Weight
                  const wtLb = res["Wt (lb)"] || res["weight"]?.["lb"] || res["weight_lb"];
                  const wtKg = res["Wt (kg)"] || res["weight"]?.["kg"] || res["weight_kg"];

                  return (
                    <div key={idx} className="border border-muted/50 rounded-xl overflow-hidden shadow-sm bg-white/50">
                      <div className="bg-sidebar-tool-active/10 px-3 py-2 border-b border-sidebar-tool-active/20 flex justify-between items-center">
                        <span className="text-[11px] font-black text-sidebar-tool-active tracking-tight uppercase">PART NO: {partNo}</span>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-4">
                        {inlet && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Inlet</span>
                            <span className="text-xs font-bold text-foreground">{inlet}</span>
                          </div>
                        )}
                        {outlet && (
                          <div className="flex flex-col gap-1 text-right">
                            <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Outlet</span>
                            <span className="text-xs font-bold text-foreground">{outlet}</span>
                          </div>
                        )}
                        {dimC && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Dim C (in/mm)</span>
                            <span className="text-xs font-bold text-foreground">{dimC} / {dimCmm || "-"}</span>
                          </div>
                        )}
                        {dimD && (
                          <div className="flex flex-col gap-1 text-right">
                            <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Dim D (in/mm)</span>
                            <span className="text-xs font-bold text-foreground">{dimD} / {dimDmm || "-"}</span>
                          </div>
                        )}
                        {wtLb && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Weight (lb/kg)</span>
                            <span className="text-xs font-bold text-foreground">{wtLb} / {wtKg || "-"}</span>
                          </div>
                        )}
                        {res["Working Pressure"] && (
                          <div className="flex flex-col gap-1 text-right col-span-2 mt-2 pt-2 border-t border-muted/20">
                            <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Rated Pressure</span>
                            <span className="text-xs font-bold text-muted-foreground italic">{res["Working Pressure"]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Superior Result Rendering — show each valve with its matched pressure/capacity
                lookupResults?.map((res, idx) => (
                  <div key={idx} className="border border-muted/50 rounded-xl overflow-hidden shadow-sm bg-white/50">
                    <div className="bg-sidebar-tool-active/10 px-3 py-2 border-b border-sidebar-tool-active/20 flex justify-between items-center">
                      <span className="text-[11px] font-black text-sidebar-tool-active tracking-tight uppercase">PART NO: {res["Part Number"]}</span>
                      <span className="text-[9px] font-bold text-foreground/50 bg-sidebar-tool-active/5 px-1.5 py-0.5 rounded">{res.foundPressure} psig → Cap: {res.foundCapacity}</span>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-y-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Port Diameter</span>
                        <span className="text-xs font-bold text-foreground">{res["Port Diameter"]}</span>
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Inlet NPT</span>
                        <span className="text-xs font-bold text-foreground">{res["Size (Inches)"]?.["Inlet NPT"]}</span>
                      </div>
                      {res["Size (Inches)"]?.["Outlet SAE"] && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Outlet SAE</span>
                          <span className="text-xs font-bold text-foreground">{res["Size (Inches)"]["Outlet SAE"]}</span>
                        </div>
                      )}
                      {res["Size (Inches)"]?.["Outlet FPT"] && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Outlet FPT</span>
                          <span className="text-xs font-bold text-foreground">{res["Size (Inches)"]["Outlet FPT"]}</span>
                        </div>
                      )}
                      <div className="flex flex-col gap-1 text-right">
                          <span className="text-[9px] uppercase tracking-widest text-foreground/50 font-black">Dimensions (A / B)</span>
                          <span className="text-xs font-bold text-foreground">{res["Dimensions"]?.["A (inches)"]} / {res["Dimensions"]?.["B (inches)"] || "-"}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-secondary/20 border-t border-muted/30 flex gap-2">
            <Button variant="outline" onClick={() => setShowResults(false)} className="flex-1 h-9 text-[10px] uppercase font-bold tracking-widest border-muted/50">
              Change Input
            </Button>
            <Button onClick={handleSave} className="flex-1 h-9 bg-sidebar-tool-active hover:bg-sidebar-tool-active/90 text-white font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-sidebar-tool-active/20 transition-all active:scale-[0.98]">
              Apply & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}