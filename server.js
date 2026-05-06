import express from "express";
import crypto from "crypto";
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

// ── EMAIL SENDER (Resend HTTP API · evita problemas de puertos SMTP en Railway) ──
const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
const MAIL_FROM      = process.env.MAIL_FROM || "MINERVA Deal Engine <no-reply@minervadeal.com>";

const transporter = {
  async sendMail({ from, to, subject, html, replyTo }) {
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY no configurada — email no enviado:", subject);
      return;
    }
    const payload = {
      from: from || MAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (replyTo) payload.reply_to = replyTo;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("RESEND ERROR:", res.status, data);
      throw new Error(`Resend API error ${res.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }
};

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

// Helper: layout base reutilizable para todos los emails
function emailLayout({ preheader, contentHtml }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>MINERVA</title>
</head>
<body style="margin:0;padding:0;background:#040D1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader || ""}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#040D1A;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:linear-gradient(180deg,#0A1628 0%,#091428 100%);border:1px solid rgba(11,72,148,.5);border-radius:16px;overflow:hidden">

        <!-- Header con gradiente y logo -->
        <tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,rgba(0,168,255,.08) 0%,rgba(255,193,7,.04) 100%);border-bottom:1px solid rgba(0,168,255,.15)">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:.04em">MINERVA</td>
              <td align="right" style="font-family:'Courier New',monospace;font-size:9px;color:#00A8FF;letter-spacing:.25em">DEAL · ENGINE</td>
            </tr>
          </table>
        </td></tr>

        <!-- Body content -->
        <tr><td style="padding:36px 40px 32px;color:#C8D8F0;font-size:14px;line-height:1.6">
          ${contentHtml}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px 24px;background:rgba(0,0,0,.2);border-top:1px solid rgba(0,168,255,.1);text-align:center">
          <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:9px;color:#FFC107;letter-spacing:.2em">SAPIENTIA · VICTORIA</p>
          <p style="margin:0;font-size:11px;color:#3A5070">
            MINERVA Deal Engine · <a href="https://minervadeal.com" style="color:#3A5070;text-decoration:none">minervadeal.com</a>
          </p>
        </td></tr>

      </table>
      <p style="margin:18px 0 0;font-size:10px;color:#2A3D5C;text-align:center">
        Recibiste este correo porque interactuaste con MINERVA. Si no fuiste tú, simplemente ignóralo.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

// 1) RECIBO DE PAGO
async function sendPaymentReceiptEmail(email, amount, planConfig) {
  if (!RESEND_API_KEY) return;
  const planName    = planConfig?.plan === "imperium" ? "Imperium" : "Starter";
  const cycleLabel  = planConfig?.billing_cycle === "annual" ? "Anual" : "Mensual";
  const fullLabel   = `${planName} ${cycleLabel}`;
  const amountFmt   = amount?.toLocaleString("es-CL") || "—";
  const today       = new Date().toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });

  const content = `
    <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;color:#00A8FF;letter-spacing:.2em">PAGO CONFIRMADO</p>
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:-.02em;line-height:1.2">
      Tu plan ${fullLabel} está activo
    </h1>
    <p style="margin:0 0 24px;color:#8FA8C8;font-size:14px;line-height:1.6">
      Recibimos tu pago correctamente. Ya puedes simular sin restricciones desde tu dashboard.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(0,168,255,.06);border:1px solid rgba(0,168,255,.25);border-radius:12px;margin-bottom:28px">
      <tr><td style="padding:20px 24px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#C8D8F0">
          <tr>
            <td style="padding:6px 0;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em">PLAN</td>
            <td align="right" style="padding:6px 0;color:#FFFFFF;font-weight:600">${fullLabel}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em">FECHA</td>
            <td align="right" style="padding:6px 0;color:#FFFFFF;font-weight:600">${today}</td>
          </tr>
          <tr>
            <td style="padding:10px 0 6px;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;border-top:1px solid rgba(0,168,255,.15)">MONTO</td>
            <td align="right" style="padding:10px 0 6px;color:#FFC107;font-weight:700;font-size:18px;border-top:1px solid rgba(0,168,255,.15)">$${amountFmt} CLP</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px">
      <tr><td style="border-radius:10px;background:#00A8FF">
        <a href="${APP_URL}" style="display:inline-block;padding:14px 36px;color:#000000;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:.02em">
          Ir al dashboard →
        </a>
      </td></tr>
    </table>

    <p style="margin:28px 0 0;color:#5E7BA4;font-size:12px;line-height:1.6;text-align:center">
      ¿Necesitas ayuda? Escríbenos a <a href="mailto:hola@minervadeal.com" style="color:#00A8FF;text-decoration:none">hola@minervadeal.com</a>
    </p>
  `;

  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
    to:      email,
    subject: `✓ Pago confirmado · ${fullLabel}`,
    html:    emailLayout({ preheader: `Tu plan ${fullLabel} está activo. Monto: $${amountFmt} CLP.`, contentHtml: content }),
  });
  console.log("RECIBO ENVIADO:", email);
}

// 2) NOTIFICACIÓN INTERNA AL EQUIPO DE VENTAS
async function sendSalesNotificationEmail(data) {
  if (!RESEND_API_KEY) return;
  const planLabel = data.plan_requested === "pyme" ? "PYME" : "Enterprise";

  const row = (label, value) => `
    <tr>
      <td style="padding:8px 0;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;width:35%;vertical-align:top">${label}</td>
      <td style="padding:8px 0;color:#FFFFFF;font-size:13px;vertical-align:top">${value || "<span style='color:#3A5070'>—</span>"}</td>
    </tr>`;

  const content = `
    <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;color:#FFC107;letter-spacing:.2em">NUEVA COTIZACIÓN · ${planLabel.toUpperCase()}</p>
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-.02em;line-height:1.2">
      ${data.empresa}
    </h1>
    <p style="margin:0 0 28px;color:#8FA8C8;font-size:14px">
      Solicita una propuesta para ${planLabel}.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(0,168,255,.05);border:1px solid rgba(0,168,255,.2);border-radius:12px;margin-bottom:24px">
      <tr><td style="padding:18px 22px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${row("CONTACTO",     data.full_name)}
          ${row("EMAIL",        `<a href="mailto:${data.email}" style="color:#00A8FF;text-decoration:none">${data.email}</a>`)}
          ${row("CARGO",        data.cargo)}
          ${row("PAÍS",         data.pais)}
          ${row("TELÉFONO",     data.telefono)}
          ${row("EQUIPO",       data.team_size ? `${data.team_size} personas` : null)}
          ${row("CASO DE USO",  data.use_case)}
        </table>
      </td></tr>
    </table>

    ${data.message ? `
    <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;color:#5E7BA4;letter-spacing:.12em">MENSAJE</p>
    <div style="background:rgba(0,0,0,.25);border-left:2px solid #00A8FF;padding:14px 18px;border-radius:0 8px 8px 0;color:#C8D8F0;font-size:13px;line-height:1.6;margin-bottom:24px">
      ${data.message.replace(/\n/g, "<br/>")}
    </div>` : ""}

    <p style="margin:24px 0 0;color:#5E7BA4;font-size:12px;text-align:center">
      Responde directamente a este correo o contacta a <strong style="color:#FFFFFF">${data.email}</strong>
    </p>
  `;

  await transporter.sendMail({
    from:    `"MINERVA Sales" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
    replyTo: data.email,
    to:      SALES_EMAIL,
    subject: `[${planLabel}] Cotización: ${data.empresa}`,
    html:    emailLayout({ preheader: `${data.full_name} de ${data.empresa} solicita ${planLabel}`, contentHtml: content }),
  });
  console.log("EMAIL VENTAS PARA:", data.email);
}

// 3) WELCOME CODE
async function sendWelcomeCodeEmail(email, code, planBase, expiresAt, isResent) {
  if (!RESEND_API_KEY) return;
  const planLabel = planBase === "starter" ? "Starter" : "Imperium";
  const expDate   = new Date(expiresAt).toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });

  const heading = isResent
    ? "Aquí tienes tu código nuevamente"
    : `Bienvenido al ${planLabel === "Starter" ? "camino del" : "rango de"} ${planLabel}`;

  const intro = isResent
    ? `Reenviamos el código que solicitaste. Recuerda que es válido para una sola activación.`
    : `Has dado el primer paso. Aquí tienes tu código exclusivo de <strong style="color:#FFFFFF">50% de descuento</strong> sobre el primer pago de tu plan <strong style="color:#FFFFFF">${planLabel} Mensual</strong>.`;

  const content = `
    <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;color:#FFC107;letter-spacing:.2em">CÓDIGO DE BIENVENIDA</p>
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:-.02em;line-height:1.25">
      ${heading}
    </h1>
    <p style="margin:0 0 28px;color:#8FA8C8;font-size:14px;line-height:1.6">
      ${intro}
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(255,193,7,.12) 0%,rgba(255,193,7,.04) 100%);border:2px dashed #FFC107;border-radius:14px;margin-bottom:24px">
      <tr><td style="padding:28px 20px;text-align:center">
        <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:10px;color:#FFC107;letter-spacing:.25em">TU CÓDIGO ÚNICO</p>
        <p style="margin:0;font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#FFFFFF;letter-spacing:.12em">
          ${code}
        </p>
        <p style="margin:14px 0 0;font-size:11px;color:#8FA8C8">
          Válido hasta el <strong style="color:#FFFFFF">${expDate}</strong>
        </p>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(0,168,255,.05);border:1px solid rgba(0,168,255,.2);border-radius:12px;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:10px;color:#00A8FF;letter-spacing:.18em">CÓMO USARLO</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#C8D8F0;line-height:1.55">
          <tr><td style="padding:4px 0"><span style="color:#FFC107;font-weight:700">1.</span> &nbsp; Vuelve a la app de MINERVA</td></tr>
          <tr><td style="padding:4px 0"><span style="color:#FFC107;font-weight:700">2.</span> &nbsp; Selecciona el plan <strong style="color:#FFFFFF">${planLabel} Mensual</strong></td></tr>
          <tr><td style="padding:4px 0"><span style="color:#FFC107;font-weight:700">3.</span> &nbsp; Pega tu código en el campo correspondiente</td></tr>
          <tr><td style="padding:4px 0"><span style="color:#FFC107;font-weight:700">4.</span> &nbsp; Aplica y procede al pago con 50% OFF</td></tr>
        </table>
      </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px">
      <tr><td style="border-radius:10px;background:#FFC107">
        <a href="${APP_URL}/pricing" style="display:inline-block;padding:14px 36px;color:#000000;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:.02em">
          Activar mi descuento →
        </a>
      </td></tr>
    </table>

    <p style="margin:28px 0 0;color:#5E7BA4;font-size:11px;line-height:1.6;text-align:center">
      Este código es de un solo uso y personal.<br/>
      Si no fuiste tú quien lo solicitó, simplemente ignora este correo.
    </p>
  `;

  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
    to:      email,
    subject: `🎁 Tu código de bienvenida · MINERVA ${planLabel}`,
    html:    emailLayout({ preheader: `Tu código ${code} de 50% OFF para ${planLabel} Mensual`, contentHtml: content }),
  });
  console.log("WELCOME CODE EMAIL ENVIADO A:", email);
}

// 4) CONFIRMACIÓN DE COTIZACIÓN AL CLIENTE
async function sendQuoteConfirmationEmail(email, name, plan) {
  if (!RESEND_API_KEY) return;
  const planLabel = plan === "pyme" ? "PYME" : "Enterprise";

  const content = `
    <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;color:#00A8FF;letter-spacing:.2em">SOLICITUD RECIBIDA</p>
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:-.02em;line-height:1.2">
      Gracias, ${name}
    </h1>
    <p style="margin:0 0 24px;color:#8FA8C8;font-size:14px;line-height:1.6">
      Recibimos tu interés en el plan <strong style="color:#FFFFFF">${planLabel}</strong>. Un consultor de MINERVA revisará tu caso y te contactará personalmente.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(0,168,255,.06);border:1px solid rgba(0,168,255,.25);border-radius:12px;margin-bottom:24px">
      <tr><td style="padding:18px 22px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;width:48px;padding-right:14px">
              <div style="width:38px;height:38px;background:rgba(0,168,255,.15);border:1px solid rgba(0,168,255,.4);border-radius:10px;text-align:center;line-height:36px;font-size:18px">⏱</div>
            </td>
            <td style="vertical-align:middle">
              <p style="margin:0 0 2px;color:#FFFFFF;font-size:14px;font-weight:600">Te contactaremos en 24 horas hábiles</p>
              <p style="margin:0;color:#8FA8C8;font-size:12px">Lunes a viernes, horario chileno</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 24px;color:#8FA8C8;font-size:13px;line-height:1.6">
      Mientras tanto, si quieres explorar el motor con tu cuenta actual, puedes seguir usando tu trial.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto">
      <tr><td style="border-radius:10px;background:rgba(0,168,255,.12);border:1px solid rgba(0,168,255,.4)">
        <a href="${APP_URL}" style="display:inline-block;padding:13px 32px;color:#00A8FF;font-weight:700;font-size:13px;text-decoration:none;letter-spacing:.02em">
          Volver a MINERVA →
        </a>
      </td></tr>
    </table>

    <p style="margin:28px 0 0;color:#5E7BA4;font-size:12px;line-height:1.6;text-align:center">
      ¿Tienes algo urgente? Escríbenos a <a href="mailto:hola@minervadeal.com" style="color:#00A8FF;text-decoration:none">hola@minervadeal.com</a>
    </p>
  `;

  await transporter.sendMail({
    from:    `"MINERVA Deal Engine" <${process.env.MAIL_FROM || "no-reply@minervadeal.com"}>`,
    to:      email,
    subject: `Recibimos tu solicitud · ${planLabel}`,
    html:    emailLayout({ preheader: `Un consultor MINERVA te contactará en 24 horas hábiles.`, contentHtml: content }),
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