// Builds a single self-contained HTML page (JS inlined) for the Claude artifact viewer.
// Usage: npm run build:artifact  →  dist-artifact/timezone-sync.html
import { build } from "vite";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const outDir = "dist-artifact/build";
await build({ mode: "artifact", base: "./", logLevel: "warn", build: { outDir, emptyOutDir: true } });

const assets = `${outDir}/assets`;
const jsFile = readdirSync(assets).find(f => f.endsWith(".js"));
// keep "</script" inside the bundle from closing the inline tag
const js = readFileSync(`${assets}/${jsFile}`, "utf8").replace(/<\/script/gi, "<\\/script");
const head = readFileSync("index.html", "utf8");
const fontLinks = head.match(/<link[^>]+fonts\.(googleapis|gstatic)[^>]*>/g).join("\n");

const html = `<title>Timezone Sync</title>
<meta name="description" content="Найди общее время для созвона в разных часовых поясах" />
${fontLinks}
<style>
  :root { color-scheme: dark; --bg: #08080a; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: var(--bg); }
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
mkdirSync("dist-artifact", { recursive: true });
writeFileSync("dist-artifact/timezone-sync.html", html);
console.log(`dist-artifact/timezone-sync.html  ${(html.length / 1024).toFixed(0)} kB`);
