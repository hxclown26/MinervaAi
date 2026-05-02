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

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON         = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APP_URL     = process.env.APP_URL     || "https://app.minervadeal.com";
const SALES_EMAIL = process.env.SALES_EMAIL || "hola@minervadeal.com";

// ── PLAN MAPPING (debe coincidir con lib/constants.ts del frontend) ───────────
const APP_PLAN_TO_INTERNAL = {
  starter_monthly:  { plan:"starter",  billing_cycle:"monthly", simulations_limit:20, amount_clp: 32700  },
  starter_annual:   { plan:"starter",  billing_cycle:"annual",  simulations_limit:20, amount_clp: 163800 },
  imperium_monthly: { plan:"imperium", billing_cycle:"monthly", simulations_limit:60, amount_clp: 63700  },
  imperium_annual:  { plan:"imperium", billing_cycle:"annual",  simulations_limit:60, amount_clp: 364000 },
};

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

  const res = await fetch(`${FLOW_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flow ${endpoint} error ${res.status}: ${text}`);
  }
  return res.json();
}

async function flowGet(endpoint, params) {
  const signed = signParams({ apiKey: FLOW_API_KEY, ...params });
  const qs     = new URLSearchParams(signed).toString();
  const res    = await fetch(`${FLOW_BASE_URL}/${endpoint}?${qs}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flow GET ${endpoint} error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── SUPABASE REST ─────────────────────────────────────────────────────────────
// Para queries de lectura/escritura que respeten RLS usamos ANON.
// Para inserciones críticas server-side (activar suscripción del usuario, registrar cupón)
// usamos SERVICE_ROLE.

async function supabaseInsert(table, data, useServiceRole = false) {
  const key = useServiceRole ? SUPABASE_SERVICE_ROLE : SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer:         "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function supabaseUpdate(table, filter, data, useServiceRole = false) {
  const key = useServiceRole ? SUPABASE_SERVICE_ROLE : SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer:         "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function supabaseRpc(fnName, args, useServiceRole = false) {
  const key = useServiceRole ? SUPABASE_SERVICE_ROLE : SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey:         key,
      Authorization:  `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return res.json();
}

// ═════════════════════════════════════════════════════════════════════════════
// RUTAS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/ping
 */
app.get("/api/ping", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/**
 * POST /api/validate-coupon
 * Body: { code, userId, planCode }
 * Devuelve { valid, discount_percent, final_amount, error?... }
 */
app.post("/api/validate-coupon", async (req, res) => {
  const { code, userId, planCode } = req.body;
  if (!code || !userId || !planCode) {
    return res.status(400).json({ valid: false, error: "Faltan datos" });
  }
  const planConfig = APP_PLAN_TO_INTERNAL[planCode];
  if (!planConfig) {
    return res.status(400).json({ valid: false, error: "Plan inválido" });
  }
  try {
    const result = await supabaseRpc("validate_coupon", {
      p_code: code,
      p_user_id: userId,
      p_plan_code: planCode,
      p_original_amount: planConfig.amount_clp,
    }, true);
    return res.json(result);
  } catch (err) {
    console.error("VALIDATE COUPON ERROR:", err);
    return res.status(500).json({ valid: false, error: "Error validando cupón" });
  }
});

/**
 * POST /api/subscribe
 * Body: { email, name, appPlanCode, userId, couponCode? }
 * Crea un pago único en Flow, aplicando descuento si el cupón es válido.
 */
app.post("/api/subscribe", async (req, res) => {
  const { email, name, appPlanCode, userId, couponCode } = req.body;

  if (!email || !appPlanCode || !userId) {
    return res.status(400).json({ error: "email, appPlanCode y userId son requeridos" });
  }

  const planConfig = APP_PLAN_TO_INTERNAL[appPlanCode];
  if (!planConfig) {
    return res.status(400).json({ error: `Plan desconocido: ${appPlanCode}` });
  }

  let amount = planConfig.amount_clp;
  let appliedCoupon = null;

  // Si hay cupón, validarlo y aplicar descuento
  if (couponCode) {
    try {
      const validation = await supabaseRpc("validate_coupon", {
        p_code: couponCode,
        p_user_id: userId,
        p_plan_code: appPlanCode,
        p_original_amount: amount,
      }, true);

      if (validation?.valid) {
        amount = validation.final_amount;
        appliedCoupon = validation.code;
        console.log(`COUPON APPLIED: ${couponCode} → ${amount} CLP`);
      } else {
        // Cupón inválido: no se aplica descuento, se cobra precio normal
        console.log(`COUPON REJECTED: ${couponCode} → ${validation?.error}`);
      }
    } catch (err) {
      console.error("COUPON VALIDATION ERROR:", err);
      // No bloqueamos el checkout si falla la validación, simplemente cobramos full
    }
  }

  console.log("SUBSCRIBE:", { email, appPlanCode, amount, appliedCoupon });

  try {
    const commerceOrder = `${appPlanCode}_${userId.slice(0,8)}_${Date.now()}`;
    const planConfigKey = appPlanCode;

    // Subject del pago
    const subject = `MINERVA ${planConfig.plan.toUpperCase()} ${planConfig.billing_cycle === "annual" ? "Anual" : "Mensual"}`;

    // Optional fields para guardar info que recuperamos en confirm
    const optional = JSON.stringify({
      app_plan_code: planConfigKey,
      user_id: userId,
      coupon_code: appliedCoupon,
      original_amount: planConfig.amount_clp,
    });

    const payment = await flowPost("payment/create", {
      commerceOrder,
      subject,
      currency: "CLP",
      amount,
      email,
      optional,
      urlConfirmation: `${APP_URL}/api/payment/confirm`,
      urlReturn:       `${APP_URL}/api/payment/return`,
    });

    console.log("FLOW payment/create:", payment);

    // Guardar registro pendiente
    await supabaseInsert("payments", {
      email,
      user_id: userId,
      amount,
      original_amount: planConfig.amount_clp,
      status: "pending",
      commerce_order: commerceOrder,
      plan_code: planConfigKey,
      coupon_used: appliedCoupon,
      created_at: new Date().toISOString(),
    }, true).catch(err => console.error("ERROR INSERT PAYMENT:", err));

    if (payment.url && payment.token) {
      const paymentUrl = `${payment.url}?token=${payment.token}`;
      return res.json({ paymentUrl, finalAmount: amount, appliedCoupon });
    }

    return res.status(500).json({ error: "Flow no devolvió URL de pago" });

  } catch (err) {
    console.error("ERROR EN SUBSCRIBE:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Handler compartido GET y POST de /api/payment/confirm
 */
async function handlePaymentConfirm(req, res) {
  const token = req.body?.token || req.query?.token;
  console.log("FLOW CALLBACK:", req.method, { token });

  if (!token) {
    if (req.method === "POST") return res.status(200).send("OK");
    return res.redirect(APP_URL);
  }

  try {
    const status = await flowGet("payment/getStatus", { token });
    console.log("FLOW STATUS:", status);

    if (status.status !== 2) {
      // Pago no completado
      if (req.method === "POST") return res.status(200).send("OK");
      return res.redirect(`${APP_URL}/?payment=failed`);
    }

    // Pago confirmado
    const email         = status.payer;
    const amount        = status.amount;
    const commerceOrder = status.commerceOrder;
    let optional        = {};
    try { optional = status.optional ? JSON.parse(status.optional) : {}; } catch {}

    const appPlanCode    = optional.app_plan_code;
    const userId         = optional.user_id;
    const couponCode     = optional.coupon_code;
    const originalAmount = optional.original_amount;
    const planConfig     = appPlanCode ? APP_PLAN_TO_INTERNAL[appPlanCode] : null;

    // Idempotencia: ya procesado?
    const existing = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?commerce_order=eq.${encodeURIComponent(commerceOrder)}&status=eq.paid&select=id&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}` } }
    ).then(r => r.json()).catch(() => []);

    if (Array.isArray(existing) && existing.length > 0) {
      console.log("PAGO YA PROCESADO:", commerceOrder);
      if (req.method === "POST") return res.status(200).send("OK");
      return res.redirect(`${APP_URL}/?payment=success`);
    }

    // Marcar pago como pagado (UPDATE, sino INSERT)
    const updateRes = await supabaseUpdate(
      "payments",
      `commerce_order=eq.${encodeURIComponent(commerceOrder)}`,
      { status: "paid", paid_at: new Date().toISOString() },
      true
    ).catch(() => null);

    if (!updateRes || updateRes.length === 0) {
      await supabaseInsert("payments", {
        email,
        user_id: userId || null,
        amount,
        original_amount: originalAmount || amount,
        status: "paid",
        commerce_order: commerceOrder,
        plan_code: appPlanCode || null,
        coupon_used: couponCode || null,
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }, true);
    }

    // Si hay cupón aplicado: registrar uso
    if (couponCode && userId) {
      await supabaseRpc("register_coupon_use", {
        p_code: couponCode,
        p_user_id: userId,
        p_email: email,
        p_plan_code: appPlanCode,
        p_original_amount: originalAmount,
        p_final_amount: amount,
      }, true).catch(err => console.error("ERROR REGISTER COUPON:", err));
    }

    // Activar suscripción para el usuario (vía RPC)
    if (planConfig && userId) {
      // Usamos SERVICE_ROLE para poder activar como ese usuario
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/activate_paid_subscription`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_plan: planConfig.plan,
          p_billing_cycle: planConfig.billing_cycle,
          p_simulations_limit: planConfig.simulations_limit,
          p_flow_subscription_id: commerceOrder,
          p_coupon_used: couponCode || null,
          p_coupon_remaining: 0,
        }),
      }).then(async r => {
        const text = await r.text();
        console.log("ACTIVATE SUBSCRIPTION:", r.status, text);
      }).catch(err => console.error("ERROR ACTIVATE:", err));
    }

    sendPaymentReceiptEmail(email, amount, planConfig).catch(console.error);

    if (req.method === "POST") return res.status(200).send("OK");
    return res.redirect(`${APP_URL}/?payment=success`);

  } catch (err) {
    console.error("ERROR EN CONFIRM:", err);
    if (req.method === "POST") return res.status(200).send("OK");
    return res.redirect(`${APP_URL}/?payment=error`);
  }
}

app.post("/api/payment/confirm", handlePaymentConfirm);
app.get("/api/payment/confirm",  handlePaymentConfirm);

/**
 * GET /api/payment/return — usuario vuelve a la app
 */
app.get("/api/payment/return", (_req, res) => {
  return res.redirect(`${APP_URL}/?payment=return`);
});

/**
 * POST /api/quote-request
 */
app.post("/api/quote-request", async (req, res) => {
  const { full_name, email, empresa, pais, telefono, cargo, plan_requested, team_size, use_case, message, user_id } = req.body;

  if (!full_name || !email || !empresa || !plan_requested) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  if (!["pyme","enterprise"].includes(plan_requested)) {
    return res.status(400).json({ error: "plan_requested inválido" });
  }

  console.log("QUOTE REQUEST:", { email, empresa, plan_requested });

  try {
    const inserted = await supabaseInsert("quote_requests", {
      user_id: user_id || null,
      email, full_name, empresa,
      pais: pais || null,
      telefono: telefono || null,
      cargo: cargo || null,
      plan_requested,
      team_size: team_size || null,
      use_case: use_case || null,
      message: message || null,
      status: "new",
    }, true);

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

async function sendPaymentReceiptEmail(email, amount, planConfig) {
  if (!process.env.SMTP_USER) return;
  const planLabel = planConfig ? `${planConfig.plan.toUpperCase()} ${planConfig.billing_cycle === "annual" ? "Anual" : "Mensual"}` : "MINERVA";
  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `Pago confirmado · MINERVA ${planLabel}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:30px;background:#0A1628;color:#C8D8F0;border-radius:12px">
      <h2 style="color:#fff">¡Pago confirmado!</h2>
      <p>Tu pago de $${amount?.toLocaleString("es-CL") || "—"} CLP fue recibido.</p>
      <p>Plan: <strong>${planLabel}</strong></p>
      <p style="margin-top:20px"><a href="${APP_URL}" style="background:#2997FF;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none">Ingresar a MINERVA →</a></p>
    </div>`,
  });
  console.log("RECIBO ENVIADO:", email);
}

async function sendSalesNotificationEmail(data) {
  if (!process.env.SMTP_USER) return;
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
  console.log("EMAIL VENTAS PARA:", data.email);
}

async function sendQuoteConfirmationEmail(email, name, plan) {
  if (!process.env.SMTP_USER) return;
  const planLabel = plan === "pyme" ? "PYME" : "Enterprise";
  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `Recibimos tu solicitud · ${planLabel} MINERVA`,
    html: `
      <p>Hola ${name},</p>
      <p>Gracias por tu interés en MINERVA <strong>${planLabel}</strong>.</p>
      <p>Recibimos tu solicitud y un consultor te contactará en las próximas <strong>24 horas hábiles</strong>.</p>
      <p>Saludos,<br/>El equipo de MINERVA</p>
    `,
  });
  console.log("CONFIRMACIÓN ENVIADA A:", email);
}

// ═════════════════════════════════════════════════════════════════════════════
// SERVIR FRONTEND ESTÁTICO (Vite build)
// ═════════════════════════════════════════════════════════════════════════════
app.use(sirv(join(__dirname, "dist"), { single: true }));

// ── SERVIDOR ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`MINERVA running on http://localhost:${PORT} — APP_URL=${APP_URL}`);
});