import React from "react";
import { getStencilsByCategory, StencilDefinition } from "@/lib/stencilRegistry";
import { Search, ChevronDown, ChevronRight } from "lucide-react";

interface StencilPanelProps {
  onDragStart: (stencilId: string) => void;
}

const StencilPanel: React.FC<StencilPanelProps> = ({ onDragStart }) => {
  const [search, setSearch] = React.useState("");
  const categories = getStencilsByCategory();
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>(() => {
    // Initially expand all categories
    return Object.keys(categories).reduce((acc, cat) => ({ ...acc, [cat]: true }), {});
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const filteredCategories = Object.entries(categories).reduce<Record<string, StencilDefinition[]>>(
    (acc, [cat, stencils]) => {
      const filtered = stencils.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase())
      );
      if (filtered.length > 0) acc[cat] = filtered;
      return acc;
    },
    {}
  );

  // If searching, ensure matching categories are shown
  React.useEffect(() => {
    if (search) {
      const newExpanded = { ...expandedCategories };
      Object.keys(filteredCategories).forEach(cat => {
        newExpanded[cat] = true;
      });
      setExpandedCategories(newExpanded);
    }
  }, [search]);

  // Master toggle for all categories
  const isAnyExpanded = Object.values(expandedCategories).some(v => v);
  const toggleAll = () => {
    const nextState = !isAnyExpanded;
    const newState = Object.keys(categories).reduce((acc, cat) => ({ ...acc, [cat]: nextState }), {});
    setExpandedCategories(newState);
  };

  return (
    <div className="stencil-panel w-72 flex flex-col h-full select-none bg-sidebar-tool-bg border-r border-sidebar-tool-border shadow-2xl z-20">
      <div className="p-5 border-b border-sidebar-tool-border/50 bg-gradient-to-b from-sidebar-tool-bg to-sidebar-tool-bg/95 backdrop-blur-md">
        <button 
          onClick={toggleAll}
          className="flex items-center justify-between w-full group mb-4 focus:outline-none"
        >
          <div className="flex flex-col items-start leading-none">
            <h2 className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase text-sidebar-tool-active mb-1">
              CryoSim Engine
            </h2>
            <h1 className="text-lg font-bold tracking-tight text-sidebar-tool-fg">
              Library
            </h1>
          </div>
          <div className="p-1.5 rounded-full hover:bg-sidebar-tool-hover text-sidebar-tool-muted hover:text-sidebar-tool-fg transition-all">
            {isAnyExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </button>
        <div className="relative group">
          <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-sidebar-tool-muted group-focus-within:text-sidebar-tool-active transition-colors" />
          <input
            type="text"
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-sidebar-tool-hover/50 border border-sidebar-tool-border focus:border-sidebar-tool-active rounded-lg pl-9 pr-3 py-2.5 text-xs text-sidebar-tool-fg placeholder:text-sidebar-tool-muted/50 focus:outline-none focus:ring-1 focus:ring-sidebar-tool-active/30 transition-all font-medium"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {Object.entries(filteredCategories).map(([category, stencils]) => {
          const isExpanded = expandedCategories[category] !== false;
          return (
            <div key={category} className="category-group">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between font-mono text-[9px] font-bold tracking-[0.15em] uppercase text-sidebar-tool-muted/70 py-1.5 px-2 hover:text-sidebar-tool-fg hover:bg-sidebar-tool-hover/50 rounded-lg transition-all focus:outline-none group mb-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                    <ChevronDown className="h-3 w-3" />
                  </div>
                  {category}
                </div>
                <div className="text-[8px] border border-sidebar-tool-border bg-sidebar-tool-hover/30 text-sidebar-tool-muted px-2 py-0.5 rounded-full group-hover:bg-sidebar-tool-active group-hover:text-white transition-all">
                  {stencils.length}
                </div>
              </button>
              
              {isExpanded && (
                <div className="grid grid-cols-2 gap-2.5 p-1 animate-in fade-in slide-in-from-top-1 duration-300">
                  {stencils.map((stencil) => (
                    <div
                      key={stencil.id}
                      className="stencil-item rounded-xl p-3.5 flex flex-col items-center gap-2.5 bg-sidebar-tool-hover/20 hover:bg-sidebar-tool-hover/50 transition-all cursor-grab active:cursor-grabbing border border-sidebar-tool-border group relative active:scale-95 hover:shadow-lg hover:shadow-primary/5 active:shadow-none"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("stencilId", stencil.id);
                        onDragStart(stencil.id);
                      }}
                    >
                      <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 ease-out">
                        <img
                          src={stencil.svgPath}
                          alt={stencil.name}
                          className="w-full h-full object-contain filter drop-shadow-md brightness-110 contrast-125"
                          draggable={false}
                        />
                      </div>
                      <span className="text-[9px] font-semibold text-center leading-[1.3] text-sidebar-tool-fg/80 group-hover:text-sidebar-tool-fg transition-all uppercase tracking-tight">
                        {stencil.name.replace(/_/g, ' ')}
                      </span>
                      {/* Subtle Glow Effect on Hover */}
                      <div className="absolute inset-0 rounded-xl bg-sidebar-tool-active/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Sidebar Footer Branding */}
      <div className="p-4 border-t border-sidebar-tool-border/30 bg-sidebar-tool-bg/80 backdrop-blur-sm">
        <div className="flex items-center justify-between opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
          <span className="text-[8px] font-mono tracking-tighter text-sidebar-tool-fg">v2.4.0 CRYOTECH</span>
          <div className="h-1.5 w-1.5 rounded-full bg-sidebar-tool-active animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export default StencilPanel;
