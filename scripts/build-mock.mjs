// デモ版（サーバー不要の1ファイルHTML）を生成する: npm run build:mock
// 本番と同じ画面コンポーネントと計算ロジックを、疑似APIとともに1つのHTMLにまとめる。
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const root = process.cwd();
const outDir = path.join(root, "mock", "dist");
await mkdir(outDir, { recursive: true });

// 1) Tailwind CSS（src と mock を走査して使用クラスだけを生成）
const cssSrc = (await readFile(path.join(root, "src/app/globals.css"), "utf8")) + '\n@source "../../mock";\n';
const css = await postcss([tailwind({ base: root, optimize: { minify: true } })]).process(cssSrc, {
  from: path.join(root, "src/app/globals.css"),
});

// 2) JS バンドル
const js = await build({
  entryPoints: [path.join(root, "mock/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  write: false,
  jsx: "automatic",
  target: "es2020",
  tsconfig: path.join(root, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const html = `<title>Gooner5 PLダッシュボード デモ</title>
<style>${css.css}</style>
<div id="root"></div>
<script>${code}</script>
`;
const out = path.join(outDir, "gooner5-demo.html");
await writeFile(out, html);
console.log(`生成しました: ${path.relative(root, out)} (${(html.length / 1024).toFixed(0)} KB)`);
