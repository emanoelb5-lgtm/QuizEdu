import { cp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
const require = createRequire(import.meta.resolve("wrangler"));
const { build } = require("esbuild");
const output = new URL("../../dist/pages/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(new URL("../../dist/client/", import.meta.url), output, { recursive: true });
// Bundle the existing Vinext Worker and its RSC/SSR modules for Pages advanced
// mode. D1, R2 and ASSETS are injected by the user's Cloudflare project.
await build({ entryPoints: ["dist/server/index.js"], outfile: "dist/pages/_worker.js", bundle: true, format: "esm", platform: "node", target: "es2022", minify: true, external: ["cloudflare:*", "node:*"], logLevel: "warning" });
await writeFile(new URL("_routes.json", output), JSON.stringify({ version: 1, include: ["/*"], exclude: ["/_next/static/*", "/assets/*", "/avatars/*", "/examples/*", "/lessons/*", "/app-icon-192.png", "/app-icon-512.png", "/favicon.svg", "/sw.js", "/offline.html"] }, null, 2));
await writeFile(new URL("_headers", output), "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/sw.js\n  Cache-Control: no-cache\n");
const size = gzipSync(await readFile(new URL("_worker.js", output))).byteLength;
if (size > 3 * 1024 * 1024) throw new Error("The Worker exceeds the free deployment size limit.");
console.log(`Cloudflare Pages package ready: ${(size / 1024).toFixed(0)} KiB compressed Worker.`);
