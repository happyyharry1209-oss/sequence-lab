import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { handleTutor } from "./backend/tutor.mjs";
const root = path.resolve(fileURLToPath(new URL("./docs/", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};
export const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
const server = http.createServer(async (req, res) => {
  const secureHeaders = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": CSP,
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/tutor") {
      let size = 0,
        chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16000) {
          res.writeHead(413, {
            ...secureHeaders,
            "Content-Type": "application/json",
          });
          res.end(JSON.stringify({ error: "請求內容過長。" }));
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
      const request = new Request(url, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: Buffer.concat(chunks) }
          : {}),
      });
      const result = await handleTutor(request, process.env, {
        ip: req.socket.remoteAddress || "local",
      });
      res.writeHead(result.status, {
        ...secureHeaders,
        ...Object.fromEntries(result.headers),
      });
      res.end(await result.text());
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { ...secureHeaders, Allow: "GET, HEAD" });
      res.end();
      return;
    }
    const decoded = decodeURIComponent(url.pathname),
      filename = path.resolve(
        root,
        "." + (decoded === "/" ? "/index.html" : decoded),
      );
    if (
      !filename.startsWith(root + path.sep) ||
      decoded.split("/").some((s) => s.startsWith("."))
    ) {
      res.writeHead(403, secureHeaders);
      res.end("Forbidden");
      return;
    }
    const info = await stat(filename);
    if (!info.isFile()) throw new Error("Not file");
    res.writeHead(200, {
      ...secureHeaders,
      "Content-Type":
        types[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : await readFile(filename));
  } catch {
    res.writeHead(404, {
      ...secureHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    });
    res.end("找不到頁面");
  }
});
const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () =>
  console.log(`Sequence Lab: http://localhost:${port}`),
);
