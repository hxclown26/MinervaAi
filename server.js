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

const APP_URL     = process.env.APP_URL     || "https://app.minervadeal.com";
const SALES_EMAIL = process.env.SALES_EMAIL || "hola@minervadeal.com";

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

  console.log(`FLOW POST → ${endpoint} | PARAMS:`, JSON.stringify(params));

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

  console.log(`FLOW GET → ${endpoint} | PARAMS:`, JSON.stringify(params));

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

// ── PLAN MAPPING ──────────────────────────────────────────────────────────────
const APP_PLAN_TO_INTERNAL = {
  starter_monthly:  { plan:"starter",  billing_cycle:"monthly", simulations_limit:20, flow_plan_id: 36287 },
  starter_annual:   { plan:"starter",  billing_cycle:"annual",  simulations_limit:20, flow_plan_id: 36288 },
  imperium_monthly: { plan:"imperium", billing_cycle:"monthly", simulations_limit:60, flow_plan_id: 36289 },
  imperium_annual:  { plan:"imperium", billing_cycle:"annual",  simulations_limit:60, flow_plan_id: 36290 },
};

// ── HELPER: obtener o crear cliente en Flow ───────────────────────────────────
async function getOrCreateFlowCustomer(email, name, userId) {
  // 1. Intentar crear
  try {
    const customer = await flowPost("customer/create", {
      email,
      name: name || email,
      externalId: userId || email,
    });
    console.log("FLOW CUSTOMER CREATED:", customer.customerId);
    return customer.customerId;
  } catch (err) {
    console.log("customer/create falló, intentando recuperar...", err.message);
  }

  // 2. Intentar por externalId (customerId en Flow = externalId que enviamos)
  try {
    const byExternal = await flowGet("customer/get", { customerId: userId || email });
    console.log("FLOW CUSTOMER BY EXTERNALID:", byExternal.customerId);
    return byExternal.customerId;
  } catch {
    // continuar al siguiente intento
  }

  // 3. Fallback: buscar por email
  try {
    const byEmail = await flowGet("customer/getByEmail", { email });
    console.log("FLOW CUSTOMER BY EMAIL:", byEmail.customerId);
    return byEmail.customerId;
  } catch (err) {
    console.error("FLOW CUSTOMER ERROR FINAL:", err.message);
    throw new Error("No pudimos registrar el cliente en Flow");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// RUTAS
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/ping — health check
app.get("/api/ping", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLUJO DE SUSCRIPCIÓN FLOW (según documentación oficial):
//
//  1. POST /api/subscribe
//     → Crea/recupera cliente en Flow
//     → Llama customer/register → obtiene URL para registrar tarjeta
//     → Guarda pending_card en Supabase
//     → Devuelve { registerUrl } → frontend redirige al usuario a Flow
//
//  2. Usuario ingresa tarjeta en portal Flow
//     → Flow hace POST a /api/card/confirm con el token
//     → Server llama customer/getRegisterStatus
//     → Si tarjeta ok → llama subscription/create
//     → Actualiza Supabase con suscripción activa
//
//  3. GET /api/card/return — redirect navegador post-registro
//     → Redirige al frontend con ?payment=success o ?payment=failed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/subscribe
 * Body: { email, name, planId, couponId, appPlanCode, userId }
 * Responde: { registerUrl }
 */
app.post("/api/subscribe", async (req, res) => {
  const { email, name, planId, couponId, appPlanCode, userId } = req.body;

  console.log("SUBSCRIBE BODY:", JSON.stringify(req.body));
  console.log("FLOW_API_KEY definida:", !!FLOW_API_KEY);
  console.log("FLOW_SECRET_KEY definida:", !!FLOW_SECRET_KEY);

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

  try {
    // Paso 1: obtener customerId en Flow
    const customerId = await getOrCreateFlowCustomer(email, name, userId);

    // Paso 2: iniciar registro de tarjeta (requerido antes de subscription/create)
    const registerResult = await flowPost("customer/register", {
      customerId,
      url_return: `${APP_URL}/api/card/return`,
    });

    console.log("FLOW REGISTER RESULT:", JSON.stringify(registerResult));

    // URL de redirección: url + "?token=" + token (según docs Flow)
    const registerUrl = `${registerResult.url}?token=${registerResult.token}`;

    // Guardar pendiente en Supabase para correlacionar cuando llegue el callback
    await supabaseInsert("payments", {
      email,
      amount:         0,
      status:         "pending_card",
      commerce_order: `reg_${registerResult.token}`,
      plan_code:      appPlanCode,
      flow_plan_id:   Number(planId),
      customer_id:    customerId,
      coupon_id:      couponId ? Number(couponId) : null,
      user_id:        userId || null,
      created_at:     new Date().toISOString(),
    }).catch(err => console.error("ERROR INSERT PAYMENT PENDING:", err));

    return res.json({ registerUrl });

  } catch (err) {
    console.error("ERROR EN SUBSCRIBE:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/card/confirm
 * Callback server-to-server de Flow tras registro de tarjeta.
 * Flow envía: { token }
 */
app.post("/api/card/confirm", async (req, res) => {
  const token = req.body?.token || req.query?.token;
  console.log("CARD CONFIRM CALLBACK:", { token });

  if (!token) return res.status(200).send("OK");

  try {
    const status = await flowGet("customer/getRegisterStatus", { token });
    console.log("CARD REGISTER STATUS:", JSON.stringify(status));

    // status 1 = tarjeta registrada exitosamente
    if (status.status !== 1) {
      console.log("Tarjeta NO registrada, status:", status.status);
      return res.status(200).send("OK");
    }

    const customerId = status.customerId;

    // Buscar el plan pendiente en Supabase
    const pending = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?commerce_order=eq.reg_${encodeURIComponent(token)}&status=eq.pending_card&select=*&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
    ).then(r => r.json()).catch(() => []);

    if (!Array.isArray(pending) || pending.length === 0) {
      console.error("No se encontró pago pendiente para token:", token);
      return res.status(200).send("OK");
    }

    const { plan_code, flow_plan_id, coupon_id, email } = pending[0];

    // Paso 3: crear suscripción ahora que la tarjeta está registrada
    const subscriptionParams = {
      planId:     flow_plan_id,
      customerId,
      ...(coupon_id ? { couponId: coupon_id } : {}),
    };

    console.log("CREATING SUBSCRIPTION:", JSON.stringify(subscriptionParams));

    const subscription = await flowPost("subscription/create", subscriptionParams);
    console.log("FLOW SUBSCRIPTION CREATED:", JSON.stringify(subscription));

    // Actualizar Supabase
    await supabaseUpdate(
      "payments",
      `commerce_order=eq.reg_${encodeURIComponent(token)}`,
      {
        status:               "active",
        flow_subscription_id: subscription.subscriptionId,
        amount:               subscription.amount || 0,
        paid_at:              new Date().toISOString(),
      }
    ).catch(err => console.error("ERROR UPDATE PAYMENT:", err));

    sendPaymentReceiptEmail(email, subscription.amount).catch(console.error);

    return res.status(200).send("OK");

  } catch (err) {
    console.error("ERROR EN CARD CONFIRM:", err);
    return res.status(200).send("OK"); // siempre 200 a Flow
  }
});

/**
 * GET /api/card/return
 * Redirect del navegador tras registrar tarjeta en Flow.
 */
app.get("/api/card/return", async (req, res) => {
  const token = req.query?.token;
  if (!token) return res.redirect(APP_URL);

  try {
    const status = await flowGet("customer/getRegisterStatus", { token });
    console.log("CARD RETURN STATUS:", JSON.stringify(status));

    if (status.status === 1) {
      return res.redirect(`${APP_URL}/?payment=success`);
    }
    return res.redirect(`${APP_URL}/?payment=failed`);
  } catch (err) {
    console.error("ERROR EN CARD RETURN:", err);
    return res.redirect(`${APP_URL}/?payment=error`);
  }
});

/**
 * POST /api/payment/confirm
 * Callback de Flow para cobros recurrentes de suscripción.
 */
app.post("/api/payment/confirm", async (req, res) => {
  const token = req.body?.token || req.query?.token;
  console.log("PAYMENT CONFIRM CALLBACK:", { token });

  if (!token) return res.status(200).send("OK");

  try {
    const status = await flowGet("payment/getStatus", { token });
    console.log("PAYMENT STATUS:", JSON.stringify(status));

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
          status:         "paid",
          commerce_order: commerceOrder,
          paid_at:        new Date().toISOString(),
          created_at:     new Date().toISOString(),
        });
      });

      console.log("PAGO RECURRENTE CONFIRMADO:", email, amount);
      sendPaymentReceiptEmail(email, amount).catch(console.error);
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("ERROR EN PAYMENT CONFIRM:", err);
    return res.status(200).send("OK");
  }
});

/**
 * GET /api/payment/confirm — Redirect navegador post-pago (compatibilidad)
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
 * POST /api/quote-request
 * Solicitud de cotización Pyme/Enterprise.
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
      user_id:        user_id || null,
      email,
      full_name,
      empresa,
      pais:           pais || null,
      telefono:       telefono || null,
      cargo:          cargo || null,
      plan_requested,
      team_size:      team_size || null,
      use_case:       use_case || null,
      message:        message || null,
      status:         "new",
    });

    sendSalesNotificationEmail({ full_name, email, empresa, pais, telefono, cargo, plan_requested, team_size, use_case, message }).catch(console.error);
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
// FRONTEND ESTÁTICO
// ═════════════════════════════════════════════════════════════════════════════
app.use(sirv(join(__dirname, "dist"), { single: true }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`MINERVA running on http://localhost:${PORT}`);
});