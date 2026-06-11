// Build step: obfuscate inline JavaScript in index.html and emit dist/.
//
// The source index.html stays human-readable for development. Only the
// generated dist/index.html (deployed to GitHub Pages) has its inline
// <script> blocks obfuscated, so the published code is hard to read in
// devtools while local editing is unaffected.
//
// NOTE: client-side code can never be fully hidden — this only raises the
// effort required to read it. Do not put real secrets in the client.

const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

// Files copied verbatim into dist/ alongside the built index.html.
const STATIC_ASSETS = ["og-image.png"];

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  identifierNamesGenerator: "hexadecimal",
  // Rename top-level function/variable names too. Safe here because the
  // page has no inline event handlers and exposes nothing on window — all
  // references stay inside their own <script> block (obfuscated together).
  renameGlobals: true,
  numbersToExpressions: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

// Match inline <script> ... </script> blocks (no src attribute).
const INLINE_SCRIPT_RE = /<script>([\s\S]*?)<\/script>/g;

function obfuscate(source) {
  return JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS).getObfuscatedCode();
}

function build() {
  const htmlPath = path.join(ROOT, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  let count = 0;
  const out = html.replace(INLINE_SCRIPT_RE, (_match, code) => {
    count += 1;
    const obfuscated = obfuscate(code);
    return `<script>${obfuscated}</script>`;
  });

  if (count === 0) {
    throw new Error("No inline <script> blocks found in index.html");
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, "index.html"), out, "utf8");

  for (const asset of STATIC_ASSETS) {
    const src = path.join(ROOT, asset);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST, asset));
    } else {
      console.warn(`[build] static asset missing, skipped: ${asset}`);
    }
  }

  console.log(`[build] obfuscated ${count} inline script block(s) -> dist/index.html`);
}

build();
