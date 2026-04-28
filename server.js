import express from "express";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5173;
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.use(express.json());

// ── PROXY CLAUDE ────────────────────────────────────────────────────
app.post("/api/claude", async (req, res) => {
  const { system, user } = req.body;
  if (!system || !user) {
    return res.status(400).json({ error: "Missing system or user" });
  }
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    const data = await response.json();
    console.log("RAW ANTHROPIC:", JSON.stringify(data));
    const text = data?.content?.[0]?.text || data?.completion || data?.text || "Sin respuesta.";
    res.json({ content: text });
  } catch (err) {
    console.error("Claude API error:", err);
    res.status(500).json({ error: "Error connecting to Claude API" });
  }
});

// ── STATIC (production) or VITE DEV ────────────────────────────────
async function start() {
  if (isProd || existsSync(join(__dirname, "dist"))) {
    const { default: sirv } = await import("sirv");
    app.use(sirv(join(__dirname, "dist"), { single: true }));
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`MINERVA running on http://localhost:${PORT}`);
  });
}

start();
