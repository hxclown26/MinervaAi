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

// ── CHECKOUT ROUTE → FLOW ─────────────────────────────────────────
app.get('/checkout', (req, res) => {
  const { plan } = req.query;
  
  if (!plan || !['salesman', 'pyme'].includes(plan)) {
    return res.redirect('/');
  }

  const planData = {
    salesman: { amount: 30000, name: 'Plan Salesman' },
    pyme: { amount: 300000, name: 'Plan Pyme Enterprise' }
  };

  const selectedPlan = planData[plan];
  
  // Construir URL para el Flow API existente
  const params = new URLSearchParams({
    plan: plan,
    amount: selectedPlan.amount,
    name: selectedPlan.name,
    // Agregar parámetros adicionales si tu Flow API los necesita
    currency: 'CLP',
    subject: `Suscripción ${selectedPlan.name}`
  });
  
  // Redirigir al endpoint de Flow que ya tienes funcionando
  res.redirect(`/api/flow-create-order?${params.toString()}`);
});

// ── ENTERPRISE CONTACT (si no lo tienes ya) ───────────────────────
app.get('/enterprise', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Business Enterprise · MINERVA</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #040D1A; font-family: system-ui; color: #F0F4FF; min-height: 100vh; padding: 40px 20px; }
.container { max-width: 600px; margin: 0 auto; }
.card { background: #0A1628; border: 1px solid #1B3A6B; border-radius: 16px; padding: 32px; }
.brand { text-align: center; margin-bottom: 32px; font-size: 20px; font-weight: 800; }
.form-input { width: 100%; padding: 14px; border: 1px solid #1B3A6B; border-radius: 8px; background: #040D1A; color: #F0F4FF; font-size: 14px; margin-bottom: 16px; }
.submit-btn { width: 100%; padding: 16px; background: #F0B429; color: #040D1A; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; }
textarea { resize: vertical; min-height: 100px; }
</style>
</head>
<body>
<div class="container">
  <div class="brand">MINERVA</div>
  <div class="card">
    <h1 style="font-size:24px;margin-bottom:8px;">Business Enterprise</h1>
    <p style="color:#C8D8F0;margin-bottom:24px;">Solución a medida para grandes equipos comerciales</p>
    
    <form action="/api/enterprise-contact" method="POST">
      <input type="text" name="nombre" class="form-input" placeholder="Nombre completo" required>
      <input type="text" name="empresa" class="form-input" placeholder="Empresa" required>
      <input type="text" name="cargo" class="form-input" placeholder="Cargo" required>
      <input type="email" name="email" class="form-input" placeholder="Email corporativo" required>
      <input type="tel" name="telefono" class="form-input" placeholder="Teléfono">
      <select name="pais" class="form-input" required>
        <option value="">Selecciona país...</option>
        <option value="Chile">Chile</option>
        <option value="Argentina">Argentina</option>
        <option value="Colombia">Colombia</option>
        <option value="México">México</option>
        <option value="Perú">Perú</option>
      </select>
      <input type="number" name="num_vendedores" class="form-input" placeholder="Número de vendedores en el equipo" min="1">
      <select name="crm_actual" class="form-input">
        <option value="">CRM actual (opcional)</option>
        <option value="HubSpot">HubSpot</option>
        <option value="Salesforce">Salesforce</option>
        <option value="Pipedrive">Pipedrive</option>
        <option value="Zoho">Zoho</option>
        <option value="Otro">Otro</option>
        <option value="Ninguno">Ninguno</option>
      </select>
      <textarea name="desafio" class="form-input" placeholder="Principal desafío comercial que necesitas resolver..." required></textarea>
      
      <button type="submit" class="submit-btn">Solicitar reunión estratégica →</button>
    </form>
  </div>
</div>
</body>
</html>`);
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