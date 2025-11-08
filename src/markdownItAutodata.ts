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

  const escapeHtml = (str: string) =>
    str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      "'": '&#39;', '"': '&quot;',
    }[tag] || tag));

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
      // 对每个代码块使用独立的 try-catch，确保单个图表的错误不会影响其他图表
      try {
        log.log("=== fence start ===");
        log.log("md.env.path", { envPath: state.env?.path });

        // 1) YAML 解析
        const spec = yaml.load(t.content);
        if (typeof spec !== "object" || spec === null) {
          throw new Error("YAML content must result in an object.");
        }
        log.log("yaml ok", { keys: Object.keys(spec) });

        // 2) SVG 渲染
        const svg = renderAutodata(spec as any);
        log.log("render ok", { svgLen: svg.length });

        // 3) 准备路径和最终的 Data URI
        let srcDataUri = "";
        const docPathFromOpt = typeof opts?.getDocPath === "function" ? opts.getDocPath() : undefined;
        const docPath = state.env?.path || docPathFromOpt;

        // 4) 尝试栅格化为 PNG Data URI
        if (rasterize === "png" && docPath && path.isAbsolute(docPath)) {
          const dir = path.dirname(docPath);
          const outDir = path.join(dir, outSubdir);
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

          const debugFile = path.join(outDir, "_autodata-debug.log");
          log.setOut(debugFile);

          const hash = crypto.createHash("sha1").update(svg).digest("hex").slice(0, 16);
          const pngName = `autodata-${hash}.png`;
          const pngPath = path.join(outDir, pngName);

          if (!fs.existsSync(pngPath)) {
            log.log(`png not cached, rasterizing to ${pngPath}`);
            const startDirs = [dir, __dirname || "", process.cwd() || ""].filter(Boolean);
            const rr = rasterizeSvgToPngSync(svg, pngPath, log, 320, startDirs);
            log.log("rasterize result", rr);
          } else {
            log.log(`using cached png from ${pngPath}`);
          }

          if (fs.existsSync(pngPath)) {
            const bin = fs.readFileSync(pngPath);
            srcDataUri = `data:image/png;base64,${bin.toString("base64")}`;
            log.log("embed png data-uri ok", { length: srcDataUri.length });
          } else {
            log.log("png not available after rasterize attempt, will fallback to svg");
          }
        } else {
          log.log("rasterize skipped (no docPath, or disabled)", { docPath, rasterize });
        }

        // 5) 如果栅格化失败或被禁用，退回到 SVG Data URI
        if (!srcDataUri) {
          srcDataUri = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
          log.log("fallback to svg data-uri", { length: srcDataUri.length });
        }

        // 6) 创建并替换 Token
        const html = new Token("html_block", "", 0);
        html.block = true;
        html.content = `<p class="autodata-diagram"><img src="${srcDataUri}" alt="autodata diagram" style="max-width:100%;height:auto;"/></p>`;
        tokens.splice(i, 1, html);

      } catch (e: any) {
        log.log("fence processor FAILED", { error: e.stack || e.message });
        const errToken = new Token("html_block", "", 0);
        errToken.block = true;
        errToken.content = `<pre class="autodata-error" style="color:red; background-color:#fdd; border:1px solid red; padding:1em;">[autodata] Render Error:\n${escapeHtml(e.message)}</pre>`;
        tokens.splice(i, 1, errToken);
      } finally {
        log.log("=== fence end ===");
        log.flush();
      }
    }
  });

  return md;
}
