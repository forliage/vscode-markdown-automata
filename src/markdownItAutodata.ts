import type MarkdownIt from "markdown-it";
import yaml from "js-yaml";
import { renderAutodata } from "./renderer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import crypto from "crypto";
import { execFileSync } from "child_process";

/* ---------------- DEBUG ---------------- */
const DEBUG_TAG = "[AUTODATA DEBUG]";
function tstr() {
  const d = new Date();
  return d.toISOString().replace("T", " ").replace("Z", "");
}
class FenceLogger {
  private buf: string[] = [];
  private outFile: string | null = null;
  log(msg: string, obj?: any) {
    const line = `${DEBUG_TAG} ${tstr()} ${msg}${obj !== undefined ? " " + JSON.stringify(obj, null, 2) : ""}`;
    console.log(line);
    this.buf.push(line);
  }
  setOut(file: string) { this.outFile = file; }
  flush() {
    try { if (this.outFile) fs.appendFileSync(this.outFile, this.buf.join("\n") + "\n", "utf-8"); }
    catch (e) { console.log(`${DEBUG_TAG} flush-error`, e); }
    this.buf = [];
  }
}

/* ---------------- helper 脚本（加白底） ---------------- */
function ensureHelperScript(log: FenceLogger): string {
  const helperPath = path.join(os.tmpdir(), "autodata_rasterize_helper.js");
  if (!fs.existsSync(helperPath)) {
    const helperCode = `
      (function () {
        try {
          const Module = require('module');
          if (process.env.AUTODATA_NODE_PATH) {
            process.env.NODE_PATH = process.env.AUTODATA_NODE_PATH;
            Module._initPaths();
          }
          const fs = require('fs');
          const sharp = require('sharp');
          const out = process.argv[2];
          const density = Number(process.argv[3] || 320);

          const chunks = [];
          process.stdin.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          process.stdin.on('end', async () => {
            try {
              const buf = Buffer.concat(chunks);
              // 关键：flatten 白底，避免透明像素在深色主题里变“黑底黑字”
              await sharp(buf, { density })
                .flatten({ background: '#ffffff' })
                .png({ compressionLevel: 9 })
                .toFile(out);
              process.exit(0);
            } catch (e) {
              console.error('[helper] sharp-error', e && (e.stack || e));
              process.exit(1);
            }
          });
        } catch (e) {
          console.error('[helper] init-error', e && (e.stack || e));
          process.exit(1);
        }
      })();
    `;
    fs.writeFileSync(helperPath, helperCode, "utf-8");
  }
  log.log("helperScript", { helperPath });
  return helperPath;
}

/* ---------------- 解析 sharp 的绝对路径（上一轮已修好） ---------------- */
function resolveSharpPkgAbs(startDirs: string[], log: FenceLogger): string | null {
  let nodeRequire: NodeRequire | null = null;
  try { nodeRequire = (eval("require") as NodeRequire); } catch {}
  let ModuleMod: any = null;
  try { ModuleMod = nodeRequire ? (nodeRequire as any)("module") : null; } catch {}

  const tried: any[] = [];
  for (const base of startDirs) {
    if (ModuleMod?.createRequire) {
      try {
        const cr = ModuleMod.createRequire(path.join(base, "package.json"));
        const p = cr.resolve("sharp/package.json");
        if (path.isAbsolute(p) && fs.existsSync(p)) {
          log.log("sharp resolved via createRequire", { base, resolved: p });
          return p;
        }
        tried.push({ via: "createRequire", base, resolved: p });
      } catch (e: any) { tried.push({ via: "createRequire", base, error: e?.message }); }
    }
    if (nodeRequire && typeof (nodeRequire as any).resolve === "function") {
      try {
        const p = (nodeRequire as any).resolve("sharp/package.json", { paths: [base] });
        if (path.isAbsolute(p) && fs.existsSync(p)) {
          log.log("sharp resolved via native resolve", { base, resolved: p });
          return p;
        }
        tried.push({ via: "native-resolve", base, resolved: p });
      } catch (e: any) { tried.push({ via: "native-resolve", base, error: e?.message }); }
    }
    try {
      let cur = base;
      for (let i = 0; i < 12; i++) {
        const p = path.join(cur, "node_modules", "sharp", "package.json");
        if (fs.existsSync(p)) {
          log.log("sharp resolved via find-up", { base, resolved: p });
          return p;
        }
        const up = path.dirname(cur);
        if (up === cur) break;
        cur = up;
      }
      tried.push({ via: "find-up", base, note: "not found" });
    } catch (e: any) { tried.push({ via: "find-up", base, error: e?.message }); }
  }
  log.log("sharp resolve failed (tried)", tried);
  return null;
}

/* ---------------- 栅格化（加入 data-uri 方案） ---------------- */
function rasterizeSvgToPngSync(
  svg: string,
  pngPath: string,
  log: FenceLogger,
  density = 320,
  startDirs: string[]
) {
  const res = { ok: false, error: "" as string | null };
  try {
    const sharpPkgAbs = resolveSharpPkgAbs(startDirs, log);
    if (!sharpPkgAbs) {
      res.error = "sharp package absolute path not found";
      log.log("sharpPkgAbs not found", { startDirs });
      return res;
    }
    const nodeModulesRoot = path.dirname(path.dirname(sharpPkgAbs));
    log.log("sharpPaths(abs)", { sharpPkgAbs, nodeModulesRoot });

    const helper = ensureHelperScript(log);
    const env = {
      ...process.env,
      AUTODATA_NODE_PATH: nodeModulesRoot,
      ELECTRON_RUN_AS_NODE: "1"
    };

    log.log("execFileSync start", { exe: process.execPath, pngPath, density, env_NODE_PATH: env.AUTODATA_NODE_PATH });
    execFileSync(process.execPath, [helper, pngPath, String(density)], {
      input: svg, stdio: ["pipe", "pipe", "pipe"], env
    });
    const ok = fs.existsSync(pngPath);
    log.log("execFileSync end", { pngExists: ok });
    res.ok = ok;
    return res;
  } catch (e: any) {
    res.error = e && (e.stack || e.message || String(e));
    log.log("execFileSync error", { error: res.error });
    return res;
  }
}

/* ---------------- MarkdownIt 插件 ---------------- */
type Options = {
  getDocPath?: () => string | undefined;
  outSubdir?: string;
  rasterize?: "png" | "none";
  embedPngAsDataUri?: boolean; // 新增：true 时强制内嵌 data-uri
};

export default function plugin(md: MarkdownIt, opts?: Options) {
  const outSubdir = (opts?.outSubdir ?? ".autodata").replace(/[/\\]+$/, "");
  const rasterize = opts?.rasterize ?? "png";
  const embedPngAsDataUri = opts?.embedPngAsDataUri ?? true; // 默认开启 data-uri

  md.core.ruler.push("autodata-fence-to-image", (state: any) => {
    const tokens: any[] = state.tokens;
    if (!Array.isArray(tokens)) return;
    const Token = state.Token;

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== "fence") continue;
      const info = (t.info || "").trim();
      if (info.split(/\s+/)[0] !== "autodata") continue;

      const log = new FenceLogger();
      log.log("=== fence start ===");
      log.log("md.env.path", { envPath: state.env?.path });

      const envPath: string | undefined = state.env?.path;
      const docPathFromOpt = typeof opts?.getDocPath === "function" ? opts!.getDocPath() : undefined;
      const docPath = envPath || docPathFromOpt;

      // 1) YAML
      let spec: unknown;
      try {
        spec = yaml.load(t.content);
        log.log("yaml ok", { keys: Object.keys((spec as any) || {}) });
      } catch (e: any) {
        log.log("yaml error", { error: e?.message });
        const err = new Token("html_block", "", 0);
        err.block = true;
        err.content = `<pre class="autodata-error">YAML parse error: ${e.message}</pre>`;
        tokens.splice(i, 1, err);
        continue;
      }

      // 2) SVG
      let svg = "";
      try {
        svg = renderAutodata(spec as any);
        log.log("render ok", { svgLen: svg.length });
      } catch (e: any) {
        log.log("render error", { error: e?.message });
        const err = new Token("html_block", "", 0);
        err.block = true;
        err.content = `<pre class="autodata-error">Render error: ${e.message}</pre>`;
        tokens.splice(i, 1, err);
        continue;
      }

      // 3) 落盘 & 栅格化
      const hash = crypto.createHash("sha1").update(svg).digest("hex").slice(0, 16);
      const svgName = `autodata-${hash}.svg`;
      const pngName = `autodata-${hash}.png`;

      let htmlImg = "";
      try {
        if (docPath && path.isAbsolute(docPath)) {
          const dir = path.dirname(docPath);
          const outDir = path.join(dir, outSubdir);
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

          const debugFile = path.join(outDir, "_autodata-debug.log");
          log.setOut(debugFile);
          log.log("out paths", { dir, outDir, svgName, pngName, debugFile });

          const svgPath = path.join(outDir, svgName);
          if (!fs.existsSync(svgPath)) fs.writeFileSync(svgPath, svg, "utf-8");
          log.log("write svg ok", { svgPath });

          // 生成 PNG
          // let useRel = path.posix.join(outSubdir, svgName);
          // let usedDataUri = false;
          let srcAttr = "";
          let inlineDataUri: string | null = null;
          if (rasterize === "png") {
            const pngPath = path.join(outDir, pngName);
            // 解析 sharp 起点：文档目录 / 插件目录 / CWD
            const startDirs = [dir, __dirname || "", process.cwd() || ""].filter(Boolean);
            if (!fs.existsSync(pngPath)) {
              const rr = rasterizeSvgToPngSync(svg, pngPath, log, 320, startDirs);
              log.log("rasterize result", rr);
            }
            if (fs.existsSync(pngPath)) {
              const relPng = path.posix.join(outSubdir, pngName).replace(/\\/g, "/");
              srcAttr = encodeURI(relPng).replace(/#/g, "%23");
              if (embedPngAsDataUri) {
                try {
                  const bin = fs.readFileSync(pngPath);
                  // const b64 = bin.toString("base64");
                  // useRel = `data:image/png;base64,${b64}`;
                  // usedDataUri = true;
                  // log.log("embed data-uri", { length: b64.length });
                  inlineDataUri = `data:image/png;base64,${bin.toString("base64")}`;
                  log.log("embed data-uri prepared", { length: inlineDataUri.length });
                } catch (e: any) {
                  inlineDataUri = null;
                  log.log("embed data-uri readFile error", { error: e?.message });
                  // useRel = path.posix.join(outSubdir, pngName); // 退回文件路径
                }
              // } else {
                // useRel = path.posix.join(outSubdir, pngName);
              }
            } else {
              log.log("png not exists after rasterize", { expect: pngName });
            }
          } else {
            log.log("rasterize disabled", { rasterize });
          }

          // htmlImg = `<p><img src="${useRel}" alt="autodata" style="max-width:100%;"/></p>`;
          // log.log("html <img> injected", { src: useRel, usedDataUri });
          if (!srcAttr) {
            const relSvg = path.posix.join(outSubdir, svgName).replace(/\\/g, "/");
            srcAttr = encodeURI(relSvg).replace(/#/g, "%23");
          }

          const attrs: string[] = [
            `src="${srcAttr}"`,
            'alt="autodata"',
            'style="max-width:100%;height:auto;"'
          ];
          if (inlineDataUri) {
            attrs.push(`data-autodata-inline="${inlineDataUri}"`);
          }
          htmlImg = `<p class="autodata-diagram"><img ${attrs.join(" ")} loading="lazy" decoding="async"/></p>`;
          log.log("html <img> injected", { src: srcAttr, hasInline: Boolean(inlineDataUri) });

          try {
            const files = fs.readdirSync(outDir);
            log.log("outDir list", { files });
          } catch (e: any) {
            log.log("readdir error", { error: e?.message });
          }
        } else {
          log.log("docPath not absolute, fallback to data-uri", { docPath });
          const uri = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
          // htmlImg = `<p><img src="${uri}" alt="autodata" style="max-width:100%;"/></p>`;
          htmlImg = `<p class="autodata-diagram"><img src="${uri}" alt="autodata" style="max-width:100%;height:auto;" loading="lazy" decoding="async"/></p>`;
        }
      } catch (e: any) {
        log.log("write/rasterize outer error", { error: e?.message });
      }

      if (!htmlImg) {
        const uri = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
        // htmlImg = `<p><img src="${uri}" alt="autodata" style="max-width:100%;"/></p>`;
        htmlImg = `<p class="autodata-diagram"><img src="${uri}" alt="autodata" style="max-width:100%;height:auto;" loading="lazy" decoding="async"/></p>`;
        log.log("fallback to data-uri", { len: uri.length });
      }

      const html = new Token("html_block", "", 0);
      html.block = true;
      html.content = htmlImg;
      tokens.splice(i, 1, html);

      log.log("=== fence end ===");
      log.flush();
    }
  });

  return md;
}
