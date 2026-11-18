import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("apps/mobile/dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    let path = resolve(root, "." + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!(await stat(path)).isFile()) path = resolve(root, "index.html");
    } catch {
      path = resolve(root, "index.html");
    }
    const content = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end("Build the web client with npm run export -w @tracksy/mobile");
  }
}).listen(4317, "127.0.0.1", () =>
  console.log("Tracksy local preview: http://127.0.0.1:4317"),
);
