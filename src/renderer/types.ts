export type StateSpec = {
  x: number; y: number;
  label?: string;
  radius?: number;
  initial?: boolean;
  final?: boolean;
};

export type TransitionSpec = {
  from: string;
  to: string;
  label?: string;
  bend?: number;
  loop?: boolean;
  loopDir?: "N" | "E" | "S" | "W";
};

export type DiagramSpec = {
  states: Record<string, StateSpec>;
  transitions: TransitionSpec[];
  style?: {
    stateRadius?: number;
    strokeWidth?: number;
    fontFamily?: string;
    labelItalic?: boolean;
    arrowSize?: number;
    padding?: number;
    background?: string;
    labelOffset?: number;
  };
};
