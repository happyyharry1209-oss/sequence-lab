import { handleTutor } from "../backend/tutor.mjs";
export default async function handler(req, res) {
  try {
    const host = req.headers.host || "localhost",
      body = req.body;
    const request = new Request(`https://${host}/api/tutor`, {
      method: req.method,
      headers: req.headers,
      ...(!["GET", "HEAD"].includes(req.method)
        ? { body: typeof body === "string" ? body : JSON.stringify(body ?? {}) }
        : {}),
    });
    const response = await handleTutor(request, process.env, {
      ip: String(
        req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "unknown",
      )
        .split(",")[0]
        .trim(),
    });
    res.statusCode = response.status;
    for (const [key, value] of response.headers) res.setHeader(key, value);
    res.end(await response.text());
  } catch {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "後端暫時無法處理請求。" }));
  }
}
