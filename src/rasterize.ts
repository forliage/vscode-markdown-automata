// 运行方式：node rasterize.js <pngPath> <density>
// 从 stdin 读入 SVG 字符串，使用 sharp 栅格化为 PNG
import fs from "fs";
import sharp from "sharp";

async function main() {
  const [, , pngPath, densityRaw] = process.argv;
  const density = Number(densityRaw || 288);

  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  const svgBuf = Buffer.concat(chunks);

  await sharp(svgBuf, { density }).png().toFile(pngPath);
}

main().catch((e) => {
  console.error(e && (e.stack || e));
  process.exit(1);
});
