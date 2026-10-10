// Builds ONE self-contained HTML page (JS and CSS inlined) for the Claude artifact viewer.
// Usage: npm run build:artifact → dist-artifact/<slug>.html   (publish that file as the artifact)
import { build } from "vite";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const outDir = "dist-artifact/build";
const outFile = `dist-artifact/${pkg.name}.html`;

await build({
  mode: "artifact", base: "./", logLevel: "warn",   // mode "artifact" → EMBED = true in src/lib/config.js
  build: { outDir, emptyOutDir: true, rollupOptions: { input: "index.html" } },
});

const assets = `${outDir}/assets`;
const files = readdirSync(assets);
// keep "</script" / "</style" inside the bundle from closing the inline tag
const js = files.filter(f => f.endsWith(".js"))
  .map(f => readFileSync(`${assets}/${f}`, "utf8").replace(/<\/script/gi, "<\\/script")).join("\n");
const css = files.filter(f => f.endsWith(".css"))
  .map(f => readFileSync(`${assets}/${f}`, "utf8").replace(/<\/style/gi, "<\\/style")).join("\n");
const head = readFileSync("index.html", "utf8");
const title = head.match(/<title>([^<]*)<\/title>/)?.[1] || pkg.name;
const desc = head.match(/name="description" content="([^"]*)"/)?.[1] || "";
const fontLinks = (head.match(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g) || []).join("\n");

const html = `<title>${title}</title>
<meta name="description" content="${desc}" />
${fontLinks}
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
mkdirSync("dist-artifact", { recursive: true });
writeFileSync(outFile, html);
console.log(`${outFile}  ${(html.length / 1024).toFixed(0)} kB`);
