#!/usr/bin/env node
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { renderAutodata } from "./renderer";

function usage() {
  console.log(`dfa-render

Usage:
  dfa-render input.md --out out.md
  dfa-render input.md --html out.html

It replaces \`\`\`autodata fences with inline SVG so Typora export works perfectly.
`);
}

function renderInMarkdown(md: string): string {
  return md.replace(/```autodata\s+([\s\S]*?)```/g, (_m, block: string) => {
    try {
      const spec = yaml.load(block);
      const svg = renderAutodata(spec as any);
      return svg;
    } catch (e: any) {
      return `<pre class="autodata-error">${e.message}</pre>`;
    }
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) { usage(); return; }

  const input = args[0];
  const outIdx = args.indexOf("--out");
  const htmlIdx = args.indexOf("--html");

  const raw = fs.readFileSync(input, "utf-8");
  const processed = renderInMarkdown(raw);

  if (htmlIdx !== -1 && args[htmlIdx + 1]) {
    const htmlPath = args[htmlIdx + 1];
    const html = `<!doctype html><meta charset="utf-8"><style>svg{max-width:100%}</style><article class="markdown-body">${processed}</article>`;
    fs.writeFileSync(htmlPath, html);
    console.log(`Wrote ${htmlPath}`);
    return;
  }

  const outPath = (outIdx !== -1 && args[outIdx + 1])
    ? args[outIdx + 1]
    : path.join(path.dirname(input), path.basename(input, path.extname(input)) + ".autodata.md");
  fs.writeFileSync(outPath, processed);
  console.log(`Wrote ${outPath}`);
}

main();
