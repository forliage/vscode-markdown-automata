export function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function normal(a: Pt, b: Pt, d: number): Pt {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  return { x: -dy / L * d, y: dx / L * d };
}

export function lineAngle(p: Pt, q: Pt) {
  return Math.atan2(q.y - p.y, q.x - p.x);
}

export function offsetPoint(p: Pt, ang: number, r: number): Pt {
  return { x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r };
}

export function boundsPadding(minX: number, minY: number, maxX: number, maxY: number, pad: number) {
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

export type Pt = { x: number; y: number };
