import type { DiagramSpec, StateSpec, TransitionSpec } from "./types";
import { svgEl, svgSelf, esc } from "./svg";

/* —— 基本几何 —— */
type Pt = { x: number; y: number };
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const len = (v: Pt) => Math.hypot(v.x, v.y) || 1;
const nrm = (v: Pt): Pt => { const L = len(v); return { x: v.x / L, y: v.y / L }; };
const normal = (a: Pt, b: Pt, d: number): Pt => { const v = sub(b, a); const L = len(v); return { x: -v.y / L * d, y: v.x / L * d }; };
const pointToward = (center: Pt, toward: Pt, r: number): Pt => { const d = nrm(sub(toward, center)); return add(center, { x: d.x * r, y: d.y * r }); };
const boundsPadding = (minX: number, minY: number, maxX: number, maxY: number, pad: number) =>
  ({ x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 });

/* —— 样式 —— */
type Style = {
  // stateRadius: number; strokeWidth: number; fontFamily: string;
  // labelItalic: boolean; arrowSize: number; padding: number; background: string; labelOffset: number;
  stateRadius: number;
  strokeWidth: number;
  fontFamily: string;
  labelItalic: boolean;
  arrowSize: number;
  padding: number;
  background: string;
  labelOffset: number;
  stateLabelOffset: number;
  stateLabelSize: number;
  transitionLabelSize: number;
  finalRingGap: number;
  initialArrowLength: number;
  initialArrowSpread: number;
};

export function renderAutodata(spec: DiagramSpec): string {
  const st: Style = {
    // stateRadius: spec.style?.stateRadius ?? 22,
    // strokeWidth: spec.style?.strokeWidth ?? 1.6,
    // fontFamily: spec.style?.fontFamily ?? "Times New Roman, Noto Serif, serif",
    stateRadius: spec.style?.stateRadius ?? 28,
    strokeWidth: spec.style?.strokeWidth ?? 2,
    fontFamily: spec.style?.fontFamily ?? '"Times New Roman", Times, serif',
    labelItalic: spec.style?.labelItalic ?? true,
    // arrowSize: spec.style?.arrowSize ?? 8,
    // padding: spec.style?.padding ?? 44,
    // background: spec.style?.background ?? "transparent",
    // labelOffset: spec.style?.labelOffset ?? 12
    arrowSize: spec.style?.arrowSize ?? 8,
    padding: spec.style?.padding ?? 56,
    background: spec.style?.background ?? "#ffffff",
    labelOffset: spec.style?.labelOffset ?? 18,
    stateLabelOffset: spec.style?.stateLabelOffset ?? 20,
    stateLabelSize: spec.style?.stateLabelSize ?? 16,
    transitionLabelSize: spec.style?.transitionLabelSize ?? 16,
    finalRingGap: spec.style?.finalRingGap ?? 6,
    initialArrowLength: spec.style?.initialArrowLength ?? 20,
    initialArrowSpread: spec.style?.initialArrowSpread ?? 12
  };

  // 包围盒
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const S: Record<string, StateSpec> = spec.states || {};
  Object.values(S).forEach(s => {
    const r = s.radius ?? st.stateRadius;
    minX = Math.min(minX, s.x - r - 70);
    minY = Math.min(minY, s.y - r - 70);
    maxX = Math.max(maxX, s.x + r + 70);
    maxY = Math.max(maxY, s.y + r + 70);
  });
  const b = boundsPadding(minX, minY, maxX, maxY, st.padding);

  const defs = `
  <defs>
    <marker id="ad-arrow" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="${st.arrowSize}" markerHeight="${st.arrowSize}" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
    </marker>
  </defs>`;

  const g: string[] = [];
  g.push(svgSelf("rect", { x: String(b.x), y: String(b.y), width: String(b.w), height: String(b.h), fill: st.background }));

  // 先画边
  (spec.transitions || []).forEach(tr => g.push(drawTransition(tr, S, st)));
  // 后画节点
  Object.entries(S).forEach(([name, s]) => g.push(drawState(name, s, st)));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.w}" height="${b.h}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}"
    style="color:#000; font-family:${esc(st.fontFamily)}">
    ${defs}
    <g stroke="#000" stroke-width="${st.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${g.join("\n")}
    </g>
  </svg>`;
}

/* —— 节点 —— */
function drawState(name: string, s: StateSpec, st: Style): string {
  const r = s.radius ?? st.stateRadius, cx = s.x, cy = s.y;
  const out: string[] = [];
  out.push(svgSelf("circle", { cx: String(cx), cy: String(cy), r: String(r) }));
  // if (s.final) out.push(svgSelf("circle", { cx: String(cx), cy: String(cy), r: String(r - 4) }));
  if (s.final) {
    const inner = Math.max(r - st.finalRingGap, 4);
    out.push(svgSelf("circle", { cx: String(cx), cy: String(cy), r: String(inner) }));
  }

  // 初态：箭头
  if (s.initial) {
    const gap = st.strokeWidth * 1.5;
    const tip = { x: cx - r - gap, y: cy };
    const angle = Math.PI / 6;  // 30deg
    const L = st.initialArrowLength;
    const upper = { x: tip.x - L * Math.cos(angle), y: tip.y - L * Math.sin(angle) };
    const lower = { x: tip.x - L * Math.cos(angle), y: tip.y + L * Math.sin(angle) };
    out.push(`<path d="M ${upper.x} ${upper.y} L ${tip.x} ${tip.y} L ${lower.x} ${lower.y}"/>`);
  }

  // 状态名
  const label = s.label ?? name;
  out.push(svgEl("text", {
    // x: String(cx), y: String(cy + r + 18),
    // "text-anchor": "middle", "font-style": "normal", "font-size": "14", "font-weight": "600"
    x: String(cx), y: String(cy + r + st.stateLabelOffset),
    "text-anchor": "middle",
    "font-style": "normal",
    "font-size": String(st.stateLabelSize),
    "font-weight": "600",
    fill: "currentColor",
    stroke: "none"
  }, esc(label)));

  return out.join("\n");
}

/* —— 边 —— */
function drawTransition(tr: TransitionSpec, S: Record<string, StateSpec>, st: Style): string {
  const A = S[String(tr.from)], B = S[String(tr.to)];
  if (!A || !B) return "";
  const label = tr.label ?? "", out: string[] = [];

  // 自环
  if (tr.loop) {
    const r = A.radius ?? st.stateRadius;
    const arcHeight = r * 2.5; // 弧线的高度
    const arcWidth = r * 2;   // 弧线的宽度

    // 定义弧线的起点和终点，稍微错开以避免与状态圆的切点完全重合
    const startAngle = -Math.PI / 3;
    const endAngle = -2 * Math.PI / 3;
    const start = { x: A.x + r * Math.cos(startAngle), y: A.y + r * Math.sin(startAngle) };
    const end = { x: A.x + r * Math.cos(endAngle), y: A.y + r * Math.sin(endAngle) };

    // 定义两个控制点，以创建优弧
    const control1 = { x: A.x + arcWidth / 2, y: A.y - arcHeight };
    const control2 = { x: A.x - arcWidth / 2, y: A.y - arcHeight };

    out.push(`<path d="M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}" marker-end="url(#ad-arrow)"/>`);
    const lt = { x: A.x, y: A.y - arcHeight - st.labelOffset * 0.5 };
    out.push(svgEl("text", {
      x: String(lt.x), y: String(lt.y),
      "text-anchor": "middle",
      "font-size": String(st.transitionLabelSize),
      "font-style": st.labelItalic ? "italic" : "normal",
      fill: "currentColor",
      stroke: "none"
    }, esc(label)));
    return out.join("\n");
  }

  // 普通边：二次贝塞尔 + 两端按“圆心→控制点”方向均取 +r 裁剪（修正错位）
  const a = { x: A.x, y: A.y }, b = { x: B.x, y: B.y };
  const bend = tr.bend ?? 0.24;
  const m = mid(a, b);
  const c = add(m, normal(a, b, Math.hypot(b.x - a.x, b.y - a.y) * bend));

  const ra = A.radius ?? st.stateRadius;
  const rb = B.radius ?? st.stateRadius;

  const start = pointToward(a, c, ra); // +r
  const end   = pointToward(b, c, rb); // +r（修正：以前用了 -r 导致箭头切线错位）

  out.push(`<path d="M ${start.x} ${start.y} Q ${c.x} ${c.y}, ${end.x} ${end.y}" marker-end="url(#ad-arrow)"/>`);

  // 标签：曲线中点沿法线外推
  const lm = mid(start, end);
  const tn = normal(start, end, st.labelOffset);
  const lp = add(lm, tn);
  out.push(svgEl("text", {
    x: String(lp.x), y: String(lp.y),
    // "text-anchor": "middle", "font-size": "16", "font-style": "italic"
    "text-anchor": "middle",
    "font-size": String(st.transitionLabelSize),
    "font-style": st.labelItalic ? "italic" : "normal",
    fill: "currentColor",
    stroke: "none"
  }, esc(label)));

  return out.join("\n");
}