export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function svgEl(tag: string, attrs: Record<string, string>, inner = "") {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
  return `<${tag} ${a}>${inner}</${tag}>`;
}

export function svgSelf(tag: string, attrs: Record<string, string>) {
  const a = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ");
  return `<${tag} ${a}/>`;
}
