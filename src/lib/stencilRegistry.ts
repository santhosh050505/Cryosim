export interface SnapPoint {
  id: string;
  x: number; // relative 0-1
  y: number; // relative 0-1
  label?: string;
}

export interface StencilDefinition {
  id: string;
  name: string;
  category: string;
  svgPath: string;
  width: number;
  height: number;
  snapPoints: SnapPoint[];
}

export const stencilRegistry: StencilDefinition[] = [
  {
    id: "check-valve",
    name: "Check Valve",
    category: "CryoControl",
    svgPath: "/stencils/check-valve.svg",
    // Cropped SVG: 1100 x 705 viewBox → aspect ratio ~1.56:1
    width: 96,
    height: 83,
    snapPoints: [
      { id: "left", x: 0, y: 0.725, label: "Left" },
      { id: "right", x: 1, y: 0.725, label: "Right" },
    ],
  },
  {
    id: "Solenoid Valve",
    name: "Solenoid Valve",
    category: "CryoControl",
    svgPath: "/stencils/Solenoid_Valve.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 100,
    height: 97,
    snapPoints: [
      { id: "left", x: 0.15, y: 0.77, label: "Left" },
      { id: "right", x: 1, y: 0.875, label: "Right" },
    ],
  },
  {
    id: "Flow_Switch_1",
    name: "Flow_Switch_1",
    category: "CryoHydro",
    svgPath: "/stencils/Flow_Switch_.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 30,
    height: 95,
    snapPoints: [
      { id: "left", x: 0.5, y: 0.6, label: "Left" },

    ],
  },
  {
    id: "Actuated_Valve",
    name: "Actuated_Valve",
    category: "CryoHydro",
    svgPath: "/stencils/Actuated_Valve.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 95,
    height: 107,
    snapPoints: [
      { id: "left", x: 0.6, y: 0.77, label: "Left" },
      { id: "right", x: 0.92, y: 0.77, label: "Right" },
    ],
  },
  {
    id: "4-Way Valve",
    name: "4-Way Valve",
    category: "CryoVault",
    svgPath: "/stencils/4-Way_Valve.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 100,
    height: 97,
    snapPoints: [
      { id: "top-left", x: 0.355, y: 0.1, label: "Top Left" },
      { id: "top-center", x: 0.50, y: 0, label: "Top Center" },
      { id: "top-right", x: 0.64, y: 0.1, label: "Top Right" },
      { id: "bottom", x: 0.50, y: 1, label: "Bottom" },
    ],
  },
  {
    id: "Safety_Flow_Switch_",
    name: "Safety_Flow_Switch_",
    category: "CryoHydro",
    svgPath: "/stencils/Safety_Flow_Switch_.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 30,
    height: 95,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "bottom", x: 0.285, y: 0.78, label: "Bottom" },
  
    ],
  },
 {
    id: "Strainer",
    name: "Strainer",
    category: "CryoHydro",
    svgPath: "/stencils/Strainer.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 108,
    height: 104,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "left", x: 0, y: 0.2, label: "Left" },
      { id: "right", x: 1, y: 0.2, label: "Right" },
  
    ],
  },
  {
    id: "Victaulic_Coupling",
    name: "Victaulic_Coupling",
    category: "CryoHydro",
    svgPath: "/stencils/Victaulic_Coupling.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 30,
    height: 95,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "left", x: 0, y: 0.5, label: "Left" },
      { id: "right", x: 1, y: 0.495, label: "Right" },
  
    ],
  },
  {
    id: "Temperature_Sensor_",
    name: "Temperature_Sensor_",
    category: "CryoHydro",
    svgPath: "/stencils/Temperature_Sensor_.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 30,
    height: 95,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "left", x: 0.1, y: 0.55, label: "Left" },
      { id: "right", x: 0.95, y: 0.55, label: "Right" },
  
    ],
  },
  {
    id: "Manual Valve",
    name: "Manual Valve",
    category: "CryoControl",
    svgPath: "/stencils/Manual_Valve_.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 30,
    height: 95,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "left", x: 0, y: 0.7, label: "Left" },
      { id: "right", x: 0.43, y: 0.7, label: "Right" },
  
    ],
  },
  {
    id: "Pressure Switch",
    name: "Pressure Switch",
    category: "CryoControl",
    svgPath: "/stencils/Pressure_Switch.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 20,
    height: 60,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "bottom", x: 0.51, y: 1, label: "Bottom" },
      // Right pipe (copper) — user marked at ~x=1 (right edge), ~y=0.67
      { id: "top", x: 0.48, y: 0, label: "Top" },

    ],
  },

  {
    id: "Ball Valve",
    name: "Ball Valve",
    category: "CryoControl",
    svgPath: "/stencils/Ball_Valve.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 106,
    height: 43,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "left", x: 0, y: 0.655, label: "Left" },
      // Right pipe (copper) — user marked at ~x=1 (right edge), ~y=0.67
      { id: "right", x: 1, y: 0.645, label: "Right" },
    ],
  },

  {
    id: "Compressor",
    name: "Compressor",
    category: "CryoVault",
    svgPath: "/stencils/Compressor.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 115,
    height: 146,
    snapPoints: [
      { id: "right", x: 1, y: 0.06, label: "Right" },
      { id: "right1", x: 0.9, y: 0.71, label: "Right1" },
    ],
  },
  {
    id: "Condenser",
    name: "Condenser",
    category: "CryoVault",
    svgPath: "/stencils/Condenser.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 104,
    height: 140,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "left", x: 0, y: 0.95, label: "Left" },
      { id: "left 1", x: 0, y: 0.82, label: "Left 1" },
      { id: "left 2", x: 0, y: 0.06, label: "Left 2" },
      { id: "left 3", x: 0, y: 0.18, label: "Left 3" },

      // Right pipe (copper) — user marked at ~x=1 (right edge), ~y=0.67
      { id: "right1", x: 1, y: 0.9, label: "Right 1" },
      { id: "right2", x: 1, y: 0.1, label: "Right 2" },
    ],
  },
  {
    id: "exv",
    name: "EXV",
    category: "CryoVault",
    svgPath: "/stencils/EXV.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 100,
    height: 83,
    snapPoints: [
      { id: "left", x: 0, y: 0.72, label: "Left" },
      { id: "right", x: 1, y: 0.89, label: "Right" },
    ],
  },
  {
    id: "filter drier",
    name: "Filter Drier",
    category: "CryoVault",
    svgPath: "/stencils/Filter-Drier.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 72,
    height: 137,
    snapPoints: [
      { id: "left", x: 1, y: 0.78, label: "Left" },
      { id: "top", x: 0.43, y: 0, label: "Top" },
    ],
  },
  {
    id: "Filter-Drier 1",
    name: "Filter-Drier 1",
    category: "CryoVault",
    svgPath: "/stencils/Filter-Drier 1.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 44,
    height: 101,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "bottom", x: 0.5, y: 1, label: "Bottom" },
      // Right pipe (copper) — user marked at ~x=1 (right edge), ~y=0.67
      { id: "top", x: 0.5, y: 0, label: "Top" },

    ],
  },
  {
    id: "HGB-Valve",
    name: "HGB-Valve",
    category: "CryoVault",
    svgPath: "/stencils/HGB-Valve.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 90,
    height: 54,
    snapPoints: [
      { id: "left", x: 0, y: 0.88, label: "Left" },
      { id: "right", x: 0.88, y: 0.87, label: "Right" },
    ],
  },
  {
    id: "Oil_Seperator 1",
    name: "Oil_Seperator 1",
    category: "CryoVault",
    svgPath: "/stencils/Oil_Seperator 1.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 101,
    height: 137,
    snapPoints: [
      { id: "top-left", x: 0.16, y: 0, label: "Top Left" },
      { id: "top-right", x: 0.6, y: 0, label: "Top Right" },
    ],
  },
  {
    id: "Oil_Seperator",
    name: "Oil_Seperator",
    category: "CryoVault",
    svgPath: "/stencils/Oil_Seperator.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 91,
    height: 168,
    snapPoints: [
      { id: "left1", x: 0, y: 0.32, label: "Left1" },
      { id: "left2", x: 0, y: 0.51, label: "Left2" },
      { id: "top", x: 0.59, y: 0, label: "Top" },
    ],
  },
  {
    id: "PRV",
    name: "PRV",
    category: "CryoControl",
    svgPath: "/stencils/PRV.svg",
    width: 65,
    height: 25,
    snapPoints: [
      { id: "left", x: 0, y: 0.49, label: "Left" },
      { id: "right", x: 1, y: 0.51, label: "Right" },
    ],
  },
  {
    id: "Suction_Accumulator",
    name: "Suction_Accumulator",
    category: "CryoVault",
    svgPath: "/stencils/Suction_Accumulator.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 96,
    height: 160,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "top-left", x: 0.21, y: 0, label: "Top Left" },
      { id: "center", x: 0.5, y: 0.1, label: "Center" },
      { id: "top-right", x: 0.79, y: 0, label: "Top Right" },
    ],
  },
  {
    id: "Suction_Accumulator_1",
    name: "Suction_Accumulator_1",
    category: "CryoVault",
    svgPath: "/stencils/Suction_Accumulator_1.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 106,
    height: 156,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "top-left", x: 0.41, y: 0, label: "Top Left" },

      { id: "top-right", x: 0.73, y: 0, label: "Top Right" },

      { id: "left", x: 0, y: 0.8, label: "Leftt" },
    ],
  },
  {
    id: "TXV",
    name: "TXV",
    category: "CryoControl",
    svgPath: "/stencils/TXV.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 100,
    height: 97,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)


      { id: "right", x: 1, y: 0.38, label: "Right" },

      { id: "left", x: 0, y: 0.25, label: "Leftt" },
    ],
  },
  {
    id: "Vibration_Isolator",
    name: "Vibration_Isolator",
    category: "CryoVault",
    svgPath: "/stencils/Vibration_Isolator_.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 20,
    height: 95,
    snapPoints: [
      // Left pipe (copper) — user marked at ~x=0 (left edge), ~y=0.67 (lower 2/3)
      { id: "bottom", x: 0.51, y: 1, label: "Bottom" },
      // Right pipe (copper) — user marked at ~x=1 (right edge), ~y=0.67
      { id: "top", x: 0.48, y: 0, label: "Top" },

    ],
  },
  {
    id: "Evaporator",
    name: "Evaporator",
    category: "CryoVault",
    svgPath: "/stencils/Evaporator.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 114,
    height: 156,
    snapPoints: [
      { id: "left", x: 1, y: 0.95, label: "Left" },
      { id: "left 1", x: 1, y: 0.82, label: "Left 1" },
      { id: "left 2", x: 1, y: 0.06, label: "Left 2" },
      { id: "left 3", x: 1, y: 0.18, label: "Left 3" },
      { id: "right 1", x: 0, y: 0.9, label: "Right 1" },
      { id: "right 2", x: 0, y: 0.1, label: "Right 2" },
    ],
  },
  {
    id: "Liquid_Receiver_",
    name: "Liquid_Receiver_",
    category: "CryoVault",
    svgPath: "/stencils/Liquid_Receiver_.svg",
    // Cropped SVG: 760 x 735 viewBox → nearly square
    width: 120,
    height: 166,
    snapPoints: [
      { id: "right", x: 1, y: 0.32, label: "Right" },
      { id: "right 1", x: 1, y: 0.71, label: "Right 1" },
      { id: "top", x: 0.50, y: 0, label: "Top" },
    ],
  },

  // ── Pipe connectors ──────────────────────────────────────────────────────
  {
    id: "pipe-suction",
    name: "Suction Line",
    category: "Cryoline",
    svgPath: "/stencils/pipe-suction.svg",
    width: 80,
    height: 24,
    snapPoints: [
      { id: "left", x: 0, y: 0.5, label: "Left" },
      { id: "right", x: 1, y: 0.5, label: "Right" },
    ],
  },
  {
    id: "pipe-discharge",
    name: "Discharge Line",
    category: "Cryoline",
    svgPath: "/stencils/pipe-discharge.svg",
    width: 80,
    height: 24,
    snapPoints: [
      { id: "left", x: 0, y: 0.5, label: "Left" },
      { id: "right", x: 1, y: 0.5, label: "Right" },
    ],
  },
  {
    id: "pipe-liquid",
    name: "Liquid Line",
    category: "Cryoline",
    svgPath: "/stencils/pipe-liquid.svg",
    width: 80,
    height: 24,
    snapPoints: [
      { id: "left", x: 0, y: 0.5, label: "Left" },
      { id: "right", x: 1, y: 0.5, label: "Right" },
    ],
  },
  {
    id: "pipe-water",
    name: "Water Line",
    category: "Cryoline",
    svgPath: "/stencils/pipe-water.svg",
    width: 80,
    height: 17,
    snapPoints: [
      { id: "left", x: 0, y: 0.5, label: "Left" },
      { id: "right", x: 1, y: 0.5, label: "Right" },
    ],
  },
];

export function getStencilsByCategory(): Record<string, StencilDefinition[]> {
  const map: Record<string, StencilDefinition[]> = {};
  for (const s of stencilRegistry) {
    if (!map[s.category]) map[s.category] = [];
    map[s.category].push(s);
  }
  return map;
}
