import type { StateSpec } from "./types";

// 布局参数
const P = {
  HorizGap: 280,
  VertGap: 240,
  CircRadius: 220
};

export function doLayout(specStates: Record<string, StateSpec>): boolean {
  const states = Object.values(specStates);
  const n = states.length;
  if (n === 0) return true;

  // 检查是否需要布局
  const needsLayout = states.some(s => s.x === undefined || s.y === undefined);
  if (!needsLayout) return true;

  // 布局算法
  if (n === 1) {
    states[0].x = 0;
    states[0].y = 0;
  } else if (n === 2) {
    // 水平排列
    states[0].x = -P.HorizGap / 2;
    states[0].y = 0;
    states[1].x = P.HorizGap / 2;
    states[1].y = 0;
  } else {
    // 环形排列
    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2; // 从顶部开始
      states[i].x = P.CircRadius * Math.cos(angle);
      states[i].y = P.CircRadius * Math.sin(angle);
    }
  }

  return true;
}
