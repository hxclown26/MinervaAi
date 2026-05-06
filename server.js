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
 * Valida un código de bienvenida antes del checkout
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
    const result = await supabaseRpc("validate_welcome_code", {
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
 * POST /api/request-welcome-code
 * Solicita un código de bienvenida personalizado y lo envía por email.
 * 1 código por usuario por plan_base.
 * Body: { userId, email, planBase }
 */
app.post("/api/request-welcome-code", async (req, res) => {
  const { userId, email, planBase } = req.body;
  if (!userId || !email || !planBase) {
    return res.status(400).json({ ok: false, error: "Faltan datos" });
  }
  if (!["starter","imperium"].includes(planBase)) {
    return res.status(400).json({ ok: false, error: "Plan inválido" });
  }

  try {
    const result = await supabaseRpc("request_welcome_code", {
      p_user_id: userId,
      p_email: email,
      p_plan_base: planBase,
    }, true);

    if (!result?.ok) {
      return res.json(result);
    }

    // Enviar email con el código
    sendWelcomeCodeEmail(email, result.code, planBase, result.expires_at, result.resent).catch(console.error);

    return res.json({
      ok: true,
      message: result.resent ? "Te reenviamos tu código por email" : "Te enviamos tu código por email",
    });
  } catch (err) {
    console.error("REQUEST WELCOME CODE ERROR:", err);
    return res.status(500).json({ ok: false, error: "Error generando código" });
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

  // Si hay código de bienvenida, validarlo y aplicar descuento
  if (couponCode) {
    try {
      const validation = await supabaseRpc("validate_welcome_code", {
        p_code: couponCode,
        p_user_id: userId,
        p_plan_code: appPlanCode,
        p_original_amount: amount,
      }, true);

      if (validation?.valid) {
        amount = validation.final_amount;
        appliedCoupon = validation.code;
        console.log(`WELCOME CODE APPLIED: ${couponCode} → ${amount} CLP`);
      } else {
        console.log(`WELCOME CODE REJECTED: ${couponCode} → ${validation?.error}`);
      }
    } catch (err) {
      console.error("WELCOME CODE VALIDATION ERROR:", err);
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

    // Si hay código aplicado: marcar como usado
    if (couponCode && userId) {
      await supabaseRpc("mark_welcome_code_used", {
        p_code: couponCode,
        p_user_id: userId,
      }, true).catch(err => console.error("ERROR MARK CODE USED:", err));
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
    from:    `"MINERVA Deal Engine" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
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
    from:    `"MINERVA Sales" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
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

async function sendWelcomeCodeEmail(email, code, planBase, expiresAt, isResent) {
  if (!process.env.SMTP_USER) return;
  const planLabel = planBase === "starter" ? "Starter" : "Imperium";
  const expDate = new Date(expiresAt).toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });
  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
    to:      email,
    subject: `Tu código de bienvenida · MINERVA ${planLabel}`,
    html: `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:auto;background:#0A1628;color:#C8D8F0;padding:40px;border-radius:14px;border:1px solid #1B3A6B">
      <div style="font-family:'Courier New',monospace;font-size:10px;color:#2997FF;letter-spacing:.18em;margin-bottom:14px">CÓDIGO DE BIENVENIDA</div>
      <h2 style="color:#fff;margin:0 0 8px;font-size:24px;letter-spacing:-.02em">${isResent ? "Te reenviamos tu código" : "¡Bienvenido!"}</h2>
      <p style="color:#8FA8C8;font-size:14px;margin:0 0 24px;line-height:1.5">
        Aquí está tu código exclusivo de 50% OFF para tu primer mes del plan <strong style="color:#fff">${planLabel} Mensual</strong>.
      </p>
      <div style="background:rgba(255,193,7,.08);border:2px dashed #FFC107;border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
        <div style="font-family:'Courier New',monospace;font-size:11px;color:#FFC107;letter-spacing:.15em;margin-bottom:8px">TU CÓDIGO</div>
        <div style="font-family:'Courier New',monospace;font-size:28px;color:#fff;font-weight:700;letter-spacing:.08em">${code}</div>
      </div>
      <p style="color:#8FA8C8;font-size:13px;margin:0 0 18px;line-height:1.6">
        <strong style="color:#fff">¿Cómo usarlo?</strong><br/>
        1. Vuelve a la app de MINERVA<br/>
        2. Selecciona el plan ${planLabel} Mensual<br/>
        3. Pega este código en el campo "Código de bienvenida"<br/>
        4. Aplica y procede al pago con 50% de descuento
      </p>
      <p style="color:#8FA8C8;font-size:12px;margin:18px 0 0;padding:14px;background:rgba(255,255,255,.04);border-radius:8px">
        ⏱ Tu código expira el <strong style="color:#fff">${expDate}</strong>. Es de un solo uso.
      </p>
      <p style="color:#3A5070;font-size:11px;margin-top:24px;text-align:center">
        Si no solicitaste este código, puedes ignorar este correo.
      </p>
    </div>`,
  });
  console.log("WELCOME CODE EMAIL ENVIADO A:", email);
}

async function sendQuoteConfirmationEmail(email, name, plan) {
  if (!process.env.SMTP_USER) return;
  const planLabel = plan === "pyme" ? "PYME" : "Enterprise";
  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
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