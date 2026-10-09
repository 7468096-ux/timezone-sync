// Builds a single self-contained HTML page (JS and CSS inlined) for the Claude artifact viewer.
// Usage: npm run build:artifact        → dist-artifact/timezone-sync.html     (v1, v1.html)
//        npm run build:artifact -- v2  → dist-artifact/timezone-sync-v2.html  (v2, index.html)
import { build } from "vite";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const version = process.argv[2] === "v2" ? "v2" : "v1";
const entry = version === "v2" ? "index.html" : "v1.html";
const outFile = `dist-artifact/timezone-sync${version === "v2" ? "-v2" : ""}.html`;
const outDir = `dist-artifact/build-${version}`;

await build({
  mode: "artifact", base: "./", logLevel: "warn",
  build: { outDir, emptyOutDir: true, rollupOptions: { input: entry } },
});

const assets = `${outDir}/assets`;
const files = readdirSync(assets);
// keep "</script" / "</style" inside the bundle from closing the inline tag
const js = files.filter(f => f.endsWith(".js"))
  .map(f => readFileSync(`${assets}/${f}`, "utf8").replace(/<\/script/gi, "<\\/script")).join("\n");
const css = files.filter(f => f.endsWith(".css"))
  .map(f => readFileSync(`${assets}/${f}`, "utf8").replace(/<\/style/gi, "<\\/style")).join("\n");
const head = readFileSync(entry, "utf8");
const fontLinks = head.match(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g).join("\n");

// v1 is a single dark look; v2 carries its own light/dark tokens in its CSS
const baseCss = version === "v2"
  ? ""
  : ":root { color-scheme: dark; --bg: #08080a; }\n  * { margin: 0; padding: 0; box-sizing: border-box; }\n  html, body { background: var(--bg); }";

const html = `<title>${version === "v2" ? "Timezone Sync v2" : "Timezone Sync"}</title>
<meta name="description" content="${version === "v2" ? "Find a meeting time that works across time zones" : "Найди общее время для созвона в разных часовых поясах"}" />
${fontLinks}
<style>
  ${baseCss}
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
