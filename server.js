import express from "express";
import crypto from "crypto";
import nodemailer from "nodemailer";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import sirv from "sirv";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CONFIG ────────────────────────────────────────────────────────────────────
const FLOW_API_KEY    = process.env.FLOW_API_KEY;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY;
const FLOW_BASE_URL   = "https://www.flow.cl/api";

const SUPABASE_URL  = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY;

const APP_URL      = process.env.APP_URL      || "https://app.minervadeal.com";
const SALES_EMAIL  = process.env.SALES_EMAIL  || "hola@minervadeal.com";

// ── NODEMAILER ────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ── FIRMA HMAC-SHA256 (requerida por Flow) ────────────────────────────────────
function signParams(params) {
  const sorted = Object.keys(params).sort();
  const chain  = sorted.map(k => `${k}${params[k]}`).join("");
  const sig    = crypto.createHmac("sha256", FLOW_SECRET_KEY).update(chain).digest("hex");
  return { ...params, s: sig };
}

async function flowPost(endpoint, params) {
  const signed = signParams({ apiKey: FLOW_API_KEY, ...params });
  const body   = new URLSearchParams(signed).toString();

  // ── DEBUG LOG ──────────────────────────────────────────────────────────────
  console.log(`FLOW POST → ${endpoint}`);
  console.log("FLOW POST PARAMS (sin firma):", JSON.stringify(params));
  console.log("FLOW POST BODY:", body);
  // ──────────────────────────────────────────────────────────────────────────

  const res = await fetch(`${FLOW_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const responseText = await res.text();
  console.log(`FLOW RESPONSE [${res.status}] ${endpoint}:`, responseText);

  if (!res.ok) {
    throw new Error(`Flow ${endpoint} error ${res.status}: ${responseText}`);
  }
  return JSON.parse(responseText);
}

async function flowGet(endpoint, params) {
  const signed = signParams({ apiKey: FLOW_API_KEY, ...params });
  const qs     = new URLSearchParams(signed).toString();

  // ── DEBUG LOG ──────────────────────────────────────────────────────────────
  console.log(`FLOW GET → ${endpoint}`, JSON.stringify(params));
  // ──────────────────────────────────────────────────────────────────────────

  const res = await fetch(`${FLOW_BASE_URL}/${endpoint}?${qs}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flow GET ${endpoint} error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── SUPABASE REST ─────────────────────────────────────────────────────────────
async function supabaseInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey:         SUPABASE_ANON,
      Authorization:  `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer:         "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function supabaseUpdate(table, filter, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey:         SUPABASE_ANON,
      Authorization:  `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
      Prefer:         "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ── PLAN MAPPING (debe coincidir con lib/constants.ts del frontend) ───────────
const APP_PLAN_TO_INTERNAL = {
  starter_monthly:  { plan:"starter",  billing_cycle:"monthly", simulations_limit:20, flow_plan_id: 36287 },
  starter_annual:   { plan:"starter",  billing_cycle:"annual",  simulations_limit:20, flow_plan_id: 36288 },
  imperium_monthly: { plan:"imperium", billing_cycle:"monthly", simulations_limit:60, flow_plan_id: 36289 },
  imperium_annual:  { plan:"imperium", billing_cycle:"annual",  simulations_limit:60, flow_plan_id: 36290 },
};

// ═════════════════════════════════════════════════════════════════════════════
// RUTAS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/ping — health check
 */
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * POST /api/subscribe
 * Inicia el flujo de pago en Flow.
 * Body: { email, name, planId, couponId, appPlanCode, userId }
 */
app.post("/api/subscribe", async (req, res) => {
  const { email, name, planId, couponId, appPlanCode, userId } = req.body;

  // ── DEBUG LOG ──────────────────────────────────────────────────────────────
  console.log("SUBSCRIBE BODY RECIBIDO:", JSON.stringify(req.body));
  console.log("FLOW_API_KEY definida:", !!FLOW_API_KEY);
  console.log("FLOW_SECRET_KEY definida:", !!FLOW_SECRET_KEY);
  // ──────────────────────────────────────────────────────────────────────────

  if (!email || !planId || !appPlanCode) {
    return res.status(400).json({ error: "email, planId y appPlanCode son requeridos" });
  }

  const planConfig = APP_PLAN_TO_INTERNAL[appPlanCode];
  if (!planConfig) {
    return res.status(400).json({ error: `Plan desconocido: ${appPlanCode}` });
  }
  if (planConfig.flow_plan_id !== Number(planId)) {
    return res.status(400).json({ error: "El planId no coincide con appPlanCode" });
  }

  console.log("SUBSCRIBE REQUEST:", { email, appPlanCode, planId: Number(planId), couponId });

  try {
    // Paso 1: registrar al cliente en Flow (createCustomer)
    let customerId;
    try {
      const customer = await flowPost("customer/create", {
        email,
        name: name || email,
        externalId: userId || email,
      });
      customerId = customer.customerId;
      console.log("FLOW CUSTOMER CREATED:", customerId);
    } catch (err) {
      // Si ya existe, lo buscamos
      try {
        const existing = await flowGet("customer/getByEmail", { email });
        customerId = existing.customerId;
        console.log("FLOW CUSTOMER EXISTING:", customerId);
      } catch (innerErr) {
        console.error("FLOW CUSTOMER ERROR:", err);
        return res.status(500).json({ error: "No pudimos registrar el cliente en Flow" });
      }
    }

    // Paso 2: crear suscripción en Flow
    const subscriptionParams = {
      planId: Number(planId),
      customerId,
      ...(couponId ? { couponId: Number(couponId) } : {}),
    };

    console.log("SUBSCRIPTION PARAMS FINALES:", JSON.stringify(subscriptionParams));

    const subscription = await flowPost("subscription/create", subscriptionParams);
    console.log("FLOW SUBSCRIPTION CREATED:", JSON.stringify(subscription));

    // Flow devuelve la suscripción con un paymentLink para el primer cobro
    if (subscription.payment_link) {
      await supabaseInsert("payments", {
        email,
        amount:         subscription.amount || 0,
        status:         "pending",
        commerce_order: subscription.subscriptionId || `sub_${Date.now()}`,
        plan_code:      appPlanCode,
        flow_subscription_id: subscription.subscriptionId,
        coupon_used:    couponId ? `coupon_${couponId}` : null,
        created_at:     new Date().toISOString(),
      }).catch(err => console.error("ERROR INSERT PAYMENT:", err));

      return res.json({ paymentUrl: subscription.payment_link });
    }

    return res.json({
      paymentUrl: `${APP_URL}/api/payment/return?subscription_id=${subscription.subscriptionId}`,
      subscriptionId: subscription.subscriptionId
    });

  } catch (err) {
    console.error("ERROR EN SUBSCRIBE:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/payment/confirm
 * Callback que Flow llama después de cada cobro (server-to-server).
 * Siempre debe responder HTTP 200 o Flow reintentará.
 */
app.post("/api/payment/confirm", async (req, res) => {
  const token = req.body?.token || req.query?.token;
  console.log("FLOW CALLBACK RECEIVED:", req.method, { token });

  if (!token) return res.status(200).send("OK");

  try {
    const status = await flowGet("payment/getStatus", { token });
    console.log("FLOW STATUS:", status);

    /* status.status: 1=pendiente, 2=pagado, 3=rechazado, 4=anulado */
    if (status.status === 2) {
      const email         = status.payer;
      const amount        = status.amount;
      const commerceOrder = status.commerceOrder;

      const existing = await fetch(
        `${SUPABASE_URL}/rest/v1/payments?commerce_order=eq.${encodeURIComponent(commerceOrder)}&status=eq.paid&select=id&limit=1`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      ).then(r => r.json()).catch(() => []);

      if (Array.isArray(existing) && existing.length > 0) {
        console.log("PAGO YA PROCESADO:", commerceOrder);
        return res.status(200).send("OK");
      }

      await supabaseUpdate(
        "payments",
        `commerce_order=eq.${encodeURIComponent(commerceOrder)}`,
        { status: "paid", paid_at: new Date().toISOString(), amount }
      ).catch(() => {
        return supabaseInsert("payments", {
          email,
          amount,
          status: "paid",
          commerce_order: commerceOrder,
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
      });

      console.log("PAGO CONFIRMADO:", email, amount);
      sendPaymentReceiptEmail(email, amount).catch(console.error);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("ERROR EN CONFIRM:", err);
    return res.status(200).send("OK");
  }
});

/**
 * GET /api/payment/confirm  — Redirect del navegador post-pago
 */
app.get("/api/payment/confirm", async (req, res) => {
  const token = req.query?.token;
  if (!token) return res.redirect(APP_URL);

  try {
    const status = await flowGet("payment/getStatus", { token });
    if (status.status === 2) {
      return res.redirect(`${APP_URL}/?payment=success`);
    }
    return res.redirect(`${APP_URL}/?payment=failed`);
  } catch {
    return res.redirect(`${APP_URL}/?payment=error`);
  }
});

/**
 * GET /api/payment/return  — Redirect cuando Flow ya autorizó la suscripción
 */
app.get("/api/payment/return", (req, res) => {
  return res.redirect(`${APP_URL}/?payment=return`);
});

/**
 * POST /api/quote-request
 * Recibe solicitud de cotización Pyme/Enterprise.
 */
app.post("/api/quote-request", async (req, res) => {
  const {
    full_name, email, empresa, pais, telefono, cargo,
    plan_requested, team_size, use_case, message, user_id
  } = req.body;

  if (!full_name || !email || !empresa || !plan_requested) {
    return res.status(400).json({ error: "full_name, email, empresa y plan_requested son requeridos" });
  }
  if (!["pyme","enterprise"].includes(plan_requested)) {
    return res.status(400).json({ error: "plan_requested debe ser pyme o enterprise" });
  }

  console.log("QUOTE REQUEST:", { email, empresa, plan_requested });

  try {
    const inserted = await supabaseInsert("quote_requests", {
      user_id: user_id || null,
      email,
      full_name,
      empresa,
      pais: pais || null,
      telefono: telefono || null,
      cargo: cargo || null,
      plan_requested,
      team_size: team_size || null,
      use_case: use_case || null,
      message: message || null,
      status: "new",
    });

    sendSalesNotificationEmail({
      full_name, email, empresa, pais, telefono, cargo,
      plan_requested, team_size, use_case, message
    }).catch(console.error);

    sendQuoteConfirmationEmail(email, full_name, plan_requested).catch(console.error);

    return res.json({ ok: true, request_id: inserted?.[0]?.id });

  } catch (err) {
    console.error("ERROR EN QUOTE REQUEST:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// EMAILS
// ═════════════════════════════════════════════════════════════════════════════

async function sendPaymentReceiptEmail(email, amount) {
  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: "Pago confirmado · MINERVA Deal Engine",
    html: `<p>Hola,</p>
           <p>Tu pago de $${amount?.toLocaleString("es-CL") || "—"} CLP fue confirmado.</p>
           <p><a href="${APP_URL}">Ingresar a MINERVA →</a></p>`,
  });
  console.log("EMAIL DE PAGO ENVIADO:", email);
}

async function sendSalesNotificationEmail(data) {
  await transporter.sendMail({
    from:    `"MINERVA Sales" <${process.env.SMTP_USER}>`,
    to:      SALES_EMAIL,
    subject: `Nueva cotización ${data.plan_requested.toUpperCase()}: ${data.empresa}`,
    html: `
      <h2>Nueva solicitud de cotización</h2>
      <p><strong>Plan:</strong> ${data.plan_requested.toUpperCase()}</p>
      <hr/>
      <p><strong>Nombre:</strong> ${data.full_name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Empresa:</strong> ${data.empresa}</p>
      <p><strong>Cargo:</strong> ${data.cargo || "—"}</p>
      <p><strong>País:</strong> ${data.pais || "—"}</p>
      <p><strong>Teléfono:</strong> ${data.telefono || "—"}</p>
      <p><strong>Tamaño equipo:</strong> ${data.team_size || "—"}</p>
      <p><strong>Caso de uso:</strong> ${data.use_case || "—"}</p>
      <p><strong>Mensaje:</strong></p>
      <p>${data.message ? data.message.replace(/\n/g,"<br/>") : "—"}</p>
    `,
  });
  console.log("EMAIL DE VENTAS ENVIADO PARA:", data.email);
}

async function sendQuoteConfirmationEmail(email, name, plan) {
  const planLabel = plan === "pyme" ? "PYME" : "Enterprise";
  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `Recibimos tu solicitud · ${planLabel} MINERVA`,
    html: `
      <p>Hola ${name},</p>
      <p>Gracias por tu interés en MINERVA <strong>${planLabel}</strong>.</p>
      <p>Recibimos tu solicitud y un consultor se pondrá en contacto contigo en las próximas <strong>24 horas hábiles</strong>.</p>
      <p>Mientras tanto, puedes seguir explorando MINERVA con el trial gratuito en <a href="${APP_URL}">${APP_URL}</a>.</p>
      <p>Saludos,<br/>El equipo de MINERVA</p>
    `,
  });
  console.log("EMAIL DE CONFIRMACIÓN ENVIADO A:", email);
}

// ═════════════════════════════════════════════════════════════════════════════
// SERVIR FRONTEND ESTÁTICO (Vite build)
// ═════════════════════════════════════════════════════════════════════════════
app.use(sirv(join(__dirname, "dist"), { single: true }));

// ── SERVIDOR ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`MINERVA running on http://localhost:${PORT}`);
});