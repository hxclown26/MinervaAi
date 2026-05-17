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

// IMPORTANTE: capturar rawBody para validar HMAC del webhook ANTES del parseo JSON
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); }
}));
app.use(express.urlencoded({ extended: true }));

// ── CONFIG ────────────────────────────────────────────────────────────────────
const FLOW_API_KEY    = process.env.FLOW_API_KEY;
const FLOW_SECRET_KEY = process.env.FLOW_SECRET_KEY;
const FLOW_BASE_URL   = process.env.FLOW_BASE_URL || "https://www.flow.cl/api";

const SUPABASE_URL          = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON         = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APP_URL     = process.env.APP_URL || process.env.APP_BASE_URL || "https://www.minervadeal.com";
const SALES_EMAIL = process.env.SALES_EMAIL || "hola@minervadeal.com";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL      = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
const MAIL_FROM      = process.env.MAIL_FROM || "MINERVA Deal Engine <no-reply@minervadeal.com>";

// ── PLAN MAPPING ──────────────────────────────────────────────────────────────
const APP_PLAN_TO_INTERNAL = {
  starter_monthly:  { plan:"starter",  billing_cycle:"monthly", simulations_limit:20, amount_clp: 32700,  flow_plan_id: 36287 },
  starter_annual:   { plan:"starter",  billing_cycle:"annual",  simulations_limit:20, amount_clp: 163800, flow_plan_id: 36288 },
  imperium_monthly: { plan:"imperium", billing_cycle:"monthly", simulations_limit:60, amount_clp: 63700,  flow_plan_id: 36289 },
  imperium_annual:  { plan:"imperium", billing_cycle:"annual",  simulations_limit:60, amount_clp: 364000, flow_plan_id: 36290 },
};

// ── EMAIL VIA RESEND ─────────────────────────────────────────────────────────
const transporter = {
  async sendMail({ from, to, subject, html, replyTo }) {
    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY no configurada — email no enviado:", subject);
      return;
    }
    const payload = {
      from: from || MAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject, html,
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
      throw new Error(`Resend API error ${res.status}`);
    }
    return data;
  }
};

// ── FLOW HMAC + REQUEST HELPERS ──────────────────────────────────────────────
function signParams(params) {
  const sorted = Object.keys(params).sort();
  const chain  = sorted.map(k => `${k}${params[k]}`).join("");
  const sig    = crypto.createHmac("sha256", FLOW_SECRET_KEY).update(chain).digest("hex");
  return { ...params, s: sig };
}

// PARCHE 1: logging mejorado en flowPost
async function flowPost(endpoint, params) {
  const signed = signParams({ apiKey: FLOW_API_KEY, ...params });
  const body   = new URLSearchParams(signed).toString();
  const res = await fetch(`${FLOW_BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error("FLOW ERROR");
    console.error("ENDPOINT:", endpoint);
    console.error("STATUS:", res.status);
    console.error("BODY:", json);
    throw new Error(
      `Flow ${endpoint} error ${res.status}: ${JSON.stringify(json)}`
    );
  }
  return json;
}

async function flowGet(endpoint, params) {
  const signed = signParams({ apiKey: FLOW_API_KEY, ...params });
  const qs     = new URLSearchParams(signed).toString();
  const res    = await fetch(`${FLOW_BASE_URL}/${endpoint}?${qs}`);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    console.error(`Flow GET ${endpoint} → ${res.status}`, json);
    throw new Error(`Flow GET ${endpoint} error ${res.status}: ${text}`);
  }
  return json;
}

// Valida que un payload de webhook Flow tenga firma HMAC correcta.
// Flow firma la concatenación key+value de todos los params (excepto `s`) ordenados.
function verifyFlowWebhookSignature(params) {
  if (!params || !params.s) return false;
  const { s: sigReceived, ...rest } = params;
  const sorted = Object.keys(rest).sort();
  const chain  = sorted.map(k => `${k}${rest[k]}`).join("");
  const expected = crypto.createHmac("sha256", FLOW_SECRET_KEY).update(chain).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(sigReceived), Buffer.from(expected)); }
  catch { return false; }
}

// ── SUPABASE REST HELPERS ─────────────────────────────────────────────────────
async function sbInsert(table, data, service = false) {
  const key = service ? SUPABASE_SERVICE_ROLE : SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function sbUpdate(table, filter, data, service = false) {
  const key = service ? SUPABASE_SERVICE_ROLE : SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function sbSelect(query, service = false) {
  const key = service ? SUPABASE_SERVICE_ROLE : SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return res.json();
}

async function sbRpc(fnName, args, service = false) {
  const key = service ? SUPABASE_SERVICE_ROLE : SUPABASE_ANON;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  return res.json();
}

// Valida el JWT del cliente y devuelve el user de Supabase. null si inválido.
async function getUserFromBearerToken(authHeader) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.id ? d : null;
}

// ═════════════════════════════════════════════════════════════════════════════
// RUTAS
// ═════════════════════════════════════════════════════════════════════════════

app.get("/api/ping", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

/**
 * GET /api/plans  (público, lectura desde Supabase con ANON)
 */
app.get("/api/plans", async (_req, res) => {
  try {
    const plans = await sbSelect("plans?is_active=eq.true&order=sort_order&select=*", false);
    return res.json({ plans });
  } catch (err) {
    console.error("GET PLANS ERROR:", err);
    return res.status(500).json({ error: "internal" });
  }
});

/**
 * POST /api/validate-coupon
 * Valida un código de bienvenida antes de mostrar el descuento en CheckoutSummary.
 * Body: { code, userId, planCode }
 */
app.post("/api/validate-coupon", async (req, res) => {
  const { code, userId, planCode } = req.body || {};
  if (!code || !userId || !planCode) {
    return res.status(400).json({ valid: false, error: "Faltan datos" });
  }
  const planConfig = APP_PLAN_TO_INTERNAL[planCode];
  if (!planConfig) return res.status(400).json({ valid: false, error: "Plan inválido" });

  try {
    const result = await sbRpc("validate_welcome_code", {
      p_code: code,
      p_user_id: userId,
      p_plan_code: planCode,
      p_original_amount: planConfig.amount_clp,
    }, true);
    return res.json(result || { valid: false, error: "Error" });
  } catch (err) {
    console.error("VALIDATE COUPON ERROR:", err);
    return res.status(500).json({ valid: false, error: "Error validando cupón" });
  }
});

/**
 * POST /api/subscribe
 * Crea suscripción recurrente en Flow:
 *  1. Crea o reusa customer en Flow (externalId = supabase user_id)
 *  2. Si hay couponCode → valida + obtiene flow_coupon_id
 *  3. Crea subscription en Flow con planId y opcionalmente couponId
 *  4. Guarda subscriptions en Supabase con status='incomplete'
 *  5. Devuelve paymentUrl al cliente
 *
 * Body: { appPlanCode, couponCode? }  (auth Bearer JWT requerido)
 */
// PARCHE 2: /api/subscribe corregido
app.post("/api/subscribe", async (req, res) => {
  const user = await getUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  const { appPlanCode, couponCode } = req.body || {};
  const planConfig = APP_PLAN_TO_INTERNAL[appPlanCode];
  if (!planConfig) return res.status(400).json({ error: "plan_invalid" });

  let appliedCoupon = null;
  let appliedFlowCouponId = null;

  // Validar cupón si vino
  if (couponCode) {
    try {
      const v = await sbRpc("validate_welcome_code", {
        p_code: couponCode,
        p_user_id: user.id,
        p_plan_code: appPlanCode,
        p_original_amount: planConfig.amount_clp,
      }, true);
      if (v?.valid) {
        appliedCoupon = v.code;
        appliedFlowCouponId = v.flow_coupon_id;
      }
    } catch (err) {
      console.error("Coupon validation error during subscribe:", err);
    }
  }

  try {
    // 1. Crear/recuperar customer en Flow
    //    Usamos externalId = user.id de Supabase para idempotencia
    let flowCustomerId;
    try {
      // Si ya existe un customer con este externalId, Flow devuelve error → buscar
      const created = await flowPost("customer/create", {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.empresa || user.email,
        externalId: user.id,
      });
      flowCustomerId = created.customerId;
    } catch (err) {
      // Flow devuelve 501 cuando el customer ya existe con ese externalId.
      // Recuperamos el customer via customer/list buscando por email.
      console.warn("customer/create falló, iniciando fallback por email:", err.message);

      let listResult;
      try {
        listResult = await flowGet("customer/list", {
          filter: user.email,
          start: 0,
          limit: 10,
        });
        console.log("customer/list raw result:", JSON.stringify(listResult));
      } catch (listErr) {
        console.error("customer/list falló:", listErr.message);
        throw new Error(
          `customer/create falló y customer/list también falló. Error original: ${err.message}. Error list: ${listErr.message}`
        );
      }

      const customers = listResult?.data || listResult?.items || [];
      console.log("Customers encontrados:", customers.length, JSON.stringify(customers));

      const match = customers.find(
        c => c.externalId === user.id || c.email === user.email
      );

      if (match?.customerId) {
        console.log("Fallback customer/list OK, customerId:", match.customerId);
        flowCustomerId = match.customerId;
      } else {
        throw new Error(
          `customer/create falló y no se encontró el customer en customer/list para email=${user.email} / externalId=${user.id}. Error original: ${err.message}. Lista recibida: ${JSON.stringify(listResult)}`
        );
      }
    }

    // 2. Crear suscripción en Flow
    const subParams = {
      planId: String(planConfig.flow_plan_id),
      customerId: flowCustomerId,
    };
    if (appliedFlowCouponId) subParams.couponId = String(appliedFlowCouponId);

    const flowSub = await flowPost("subscription/create", subParams);

    // 3. Guardar en Supabase con status='incomplete'
    const expectedFirstAmount = appliedCoupon
      ? Math.round(planConfig.amount_clp * 0.5)
      : planConfig.amount_clp;

    const inserted = await sbInsert("subscriptions", {
      user_id: user.id,
      plan: planConfig.plan,
      plan_code: appPlanCode,
      billing_cycle: planConfig.billing_cycle,
      simulations_used: 0,
      simulations_limit: planConfig.simulations_limit,
      status: "incomplete",
      flow_customer_id: flowCustomerId,
      flow_subscription_id: flowSub.subscriptionId || flowSub.id,
      coupon_used: appliedCoupon,
      coupon_remaining_uses: appliedCoupon ? 3 : 0,
      next_charge_amount_clp: expectedFirstAmount,
    }, true);

    const subRecord = Array.isArray(inserted) ? inserted[0] : inserted;

    // 4. Registrar redención si hubo cupón
    if (appliedCoupon && subRecord?.id) {
      await sbRpc("mark_welcome_code_used", {
        p_code: appliedCoupon,
        p_user_id: user.id,
        p_subscription_id: subRecord.id,
      }, true).catch(e => console.error("mark_welcome_code_used:", e));
    }

    // 5. Devolver URL de pago
    //    Flow puede devolver `paymentUrl` (para primer pago) o `card_register_url` para enrolamiento
    const paymentUrl = flowSub.paymentUrl || flowSub.url || flowSub.card_register_url;

    if (!paymentUrl) {
      return res.status(502).json({
        error: "flow_no_url",
        message: "Flow no devolvió URL de pago. Verifica el plan en Flow.",
        debug: flowSub,
      });
    }

    return res.json({
      paymentUrl,
      subscriptionId: subRecord?.id,
      finalAmount: expectedFirstAmount,
      appliedCoupon,
    });

  } catch (err) {
    console.error("SUBSCRIBE ERROR:", err);
    return res.status(500).json({ error: "internal", message: String(err.message || err) });
  }
});

/**
 * POST /api/subscription/cancel
 * Cancela la suscripción al final del período actual.
 * Llama a Flow para detener cobros automáticos + actualiza Supabase.
 */
app.post("/api/subscription/cancel", async (req, res) => {
  const user = await getUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const { reason } = req.body || {};

  try {
    const subs = await sbSelect(
      `subscriptions?user_id=eq.${user.id}&status=in.(active,past_due)&order=created_at.desc&limit=1`,
      true
    );
    const sub = subs?.[0];
    if (!sub) return res.status(404).json({ error: "no_active_subscription" });

    // Cancelar en Flow al final del período
    if (sub.flow_subscription_id) {
      try {
        await flowPost("subscription/cancel", {
          subscriptionId: sub.flow_subscription_id,
          at_period_end: 1,
        });
      } catch (err) {
        console.error("Flow cancel error (no abortamos):", err);
      }
    }

    // Marcar en Supabase
    await sbUpdate(
      "subscriptions",
      `id=eq.${sub.id}`,
      {
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
      },
      true
    );

    // Evento auditable
    await sbInsert("subscription_events", {
      subscription_id: sub.id,
      user_id: user.id,
      event_type: "cancellation_scheduled",
      status_before: sub.status,
      source: "user",
      metadata: { reason: reason || null },
    }, true);

    return res.json({ ok: true, access_until: sub.current_period_end });
  } catch (err) {
    console.error("CANCEL ERROR:", err);
    return res.status(500).json({ error: "internal" });
  }
});

/**
 * POST /api/subscription/reactivate
 * Revierte la cancelación si todavía estamos dentro del período pagado.
 */
app.post("/api/subscription/reactivate", async (req, res) => {
  const user = await getUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  try {
    const subs = await sbSelect(
      `subscriptions?user_id=eq.${user.id}&cancel_at_period_end=eq.true&order=created_at.desc&limit=1`,
      true
    );
    const sub = subs?.[0];
    if (!sub) return res.status(404).json({ error: "no_cancellable_subscription" });
    if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) {
      return res.status(400).json({ error: "period_already_ended" });
    }

    // Reactivar en Flow (si Flow soporta este endpoint; si no, crear nueva)
    if (sub.flow_subscription_id) {
      try {
        await flowPost("subscription/reactivate", { subscriptionId: sub.flow_subscription_id });
      } catch (err) {
        console.error("Flow reactivate error (no abortamos):", err);
      }
    }

    await sbUpdate(
      "subscriptions",
      `id=eq.${sub.id}`,
      { cancel_at_period_end: false, cancelled_at: null, cancellation_reason: null },
      true
    );

    await sbInsert("subscription_events", {
      subscription_id: sub.id,
      user_id: user.id,
      event_type: "reactivated",
      source: "user",
    }, true);

    return res.json({ ok: true });
  } catch (err) {
    console.error("REACTIVATE ERROR:", err);
    return res.status(500).json({ error: "internal" });
  }
});

/**
 * GET /api/account/summary
 * Devuelve subscription + plan + invoices + métodos de pago en un solo request
 */
app.get("/api/account/summary", async (req, res) => {
  const user = await getUserFromBearerToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: "unauthorized" });

  try {
    const [subs, invoices] = await Promise.all([
      sbSelect(
        `subscriptions?user_id=eq.${user.id}&status=in.(trial,trialing,active,past_due,cancelled)&order=created_at.desc&limit=1`,
        true
      ),
      sbSelect(
        `invoices?user_id=eq.${user.id}&order=created_at.desc&limit=12`,
        true
      ),
    ]);

    const subscription = subs?.[0] || null;
    let plan = null;
    if (subscription?.plan_code) {
      const plans = await sbSelect(`plans?id=eq.${subscription.plan_code}&select=*`, true);
      plan = plans?.[0] || null;
    }

    return res.json({ subscription, plan, invoices: invoices || [] });
  } catch (err) {
    console.error("ACCOUNT SUMMARY ERROR:", err);
    return res.status(500).json({ error: "internal" });
  }
});

/**
 * POST /api/webhooks/flow
 * Recibe eventos de Flow: payment.succeeded, payment.failed, subscription.*
 *
 * Flow envía POST con body application/x-www-form-urlencoded.
 * Validamos firma HMAC, registramos en webhook_events para idempotencia,
 * y aplicamos el cambio correspondiente.
 */
app.post("/api/webhooks/flow", express.urlencoded({ extended: true }), async (req, res) => {
  const params = req.body || {};
  const eventType = params.event_type || params.type || "unknown";

  // 1. Validar firma
  const valid = verifyFlowWebhookSignature(params);

  // 2. Idempotencia: insertar en webhook_events
  const externalEventId = params.event_id || params.token || `${eventType}-${Date.now()}`;
  const existing = await sbSelect(
    `webhook_events?source=eq.flow&external_event_id=eq.${encodeURIComponent(externalEventId)}&select=id,processed`,
    true
  );

  if (Array.isArray(existing) && existing.length > 0 && existing[0].processed) {
    console.log(`Webhook ya procesado: ${externalEventId}`);
    return res.status(200).send("OK");
  }

  const evInserted = await sbInsert("webhook_events", {
    source: "flow",
    external_event_id: externalEventId,
    event_type: eventType,
    payload: params,
    signature: params.s || null,
    signature_valid: valid,
  }, true).catch(err => { console.error("Insert webhook_event:", err); return null; });

  const webhookEventId = Array.isArray(evInserted) ? evInserted[0]?.id : evInserted?.id;

  if (!valid) {
    console.warn("Webhook con firma INVÁLIDA:", externalEventId);
    return res.status(401).send("invalid signature");
  }

  // 3. Procesar el evento
  try {
    await processFlowWebhook(eventType, params);

    if (webhookEventId) {
      await sbUpdate("webhook_events", `id=eq.${webhookEventId}`,
        { processed: true, processed_at: new Date().toISOString() }, true);
    }
  } catch (err) {
    console.error("Error procesando webhook:", err);
    if (webhookEventId) {
      await sbUpdate("webhook_events", `id=eq.${webhookEventId}`,
        { error_message: String(err.message || err), processing_attempts: 1 }, true);
    }
  }

  // Siempre 200 a Flow (idempotencia ya nos protege; errores se procesan offline)
  return res.status(200).send("OK");
});

/**
 * Lógica de procesamiento de webhook Flow
 */
async function processFlowWebhook(eventType, params) {
  const subscriptionId = params.subscriptionId || params.subscription_id;
  const paymentId = params.paymentId || params.payment_id || params.flowOrder;
  const status = params.status; // 1=pending, 2=paid, 3=rejected, 4=cancelled

  console.log(`Webhook Flow: ${eventType}`, { subscriptionId, paymentId, status });

  if (!subscriptionId) {
    console.warn("Webhook sin subscriptionId, skip");
    return;
  }

  // Buscar la suscripción local
  const subs = await sbSelect(
    `subscriptions?flow_subscription_id=eq.${encodeURIComponent(subscriptionId)}&limit=1`,
    true
  );
  const sub = subs?.[0];
  if (!sub) {
    console.warn(`Suscripción Flow no encontrada localmente: ${subscriptionId}`);
    return;
  }

  // ── PAGO EXITOSO ──
  if (status === "2" || status === 2 || eventType.includes("succeeded") || eventType.includes("paid")) {
    const amount = parseInt(params.amount || 0, 10);
    const now = new Date();
    const isFirst = sub.status === "incomplete";

    const nextChargeAt = new Date(now);
    if (sub.billing_cycle === "annual") nextChargeAt.setFullYear(nextChargeAt.getFullYear() + 1);
    else nextChargeAt.setMonth(nextChargeAt.getMonth() + 1);

    // Calcular si el cupón sigue activo
    const newCouponRemaining = Math.max(0, (sub.coupon_remaining_uses || 0) - 1);
    const planConfig = APP_PLAN_TO_INTERNAL[sub.plan_code];
    const nextAmount = newCouponRemaining > 0 && planConfig
      ? Math.round(planConfig.amount_clp * 0.5)
      : planConfig?.amount_clp || amount;

    await sbUpdate("subscriptions", `id=eq.${sub.id}`, {
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: nextChargeAt.toISOString(),
      period_start: sub.period_start || now.toISOString(),
      period_end: nextChargeAt.toISOString(),
      subscription_end: nextChargeAt.toISOString(),
      next_charge_at: nextChargeAt.toISOString(),
      next_charge_amount_clp: nextAmount,
      coupon_remaining_uses: newCouponRemaining,
      simulations_used: isFirst ? 0 : sub.simulations_used,
    }, true);

    // Crear invoice
    await sbInsert("invoices", {
      subscription_id: sub.id,
      user_id: sub.user_id,
      flow_payment_id: paymentId || `${subscriptionId}-${Date.now()}`,
      amount_clp: amount,
      base_amount_clp: planConfig?.amount_clp || amount,
      discount_amount_clp: (planConfig?.amount_clp || amount) - amount,
      coupon_used: sub.coupon_used,
      status: "paid",
      period_start: now.toISOString(),
      period_end: nextChargeAt.toISOString(),
      scheduled_at: now.toISOString(),
      paid_at: now.toISOString(),
    }, true).catch(e => console.error("Insert invoice:", e));

    await sbInsert("subscription_events", {
      subscription_id: sub.id,
      user_id: sub.user_id,
      event_type: isFirst ? "subscription_activated" : "payment_succeeded",
      status_after: "active",
      source: "webhook",
      metadata: { amount, paymentId },
    }, true);

    // Email
    const userData = await sbSelect(`profiles?id=eq.${sub.user_id}&select=email,nombre`, true).catch(() => []);
    const email = userData?.[0]?.email;
    if (email) {
      const planLabel = `${sub.plan === "imperium" ? "Imperium" : "Starter"} ${sub.billing_cycle === "annual" ? "Anual" : "Mensual"}`;
      sendPaymentReceiptEmail(email, amount, planLabel, isFirst).catch(console.error);
    }
    return;
  }

  // ── PAGO FALLIDO ──
  if (status === "3" || status === 3 || eventType.includes("failed") || eventType.includes("rejected")) {
    await sbUpdate("subscriptions", `id=eq.${sub.id}`, { status: "past_due" }, true);
    await sbInsert("subscription_events", {
      subscription_id: sub.id,
      user_id: sub.user_id,
      event_type: "payment_failed",
      status_after: "past_due",
      source: "webhook",
      metadata: params,
    }, true);
    return;
  }

  // ── CANCELACIÓN CONFIRMADA ──
  if (eventType.includes("cancel")) {
    await sbUpdate("subscriptions", `id=eq.${sub.id}`,
      { status: "cancelled", cancelled_at: new Date().toISOString() }, true);
    await sbInsert("subscription_events", {
      subscription_id: sub.id,
      user_id: sub.user_id,
      event_type: "subscription_cancelled",
      status_after: "cancelled",
      source: "webhook",
    }, true);
    return;
  }

  console.log(`Evento Flow no manejado: ${eventType}`);
}

/**
 * POST /api/quote-request — sin cambios (formularios PYME/Enterprise)
 */
app.post("/api/quote-request", async (req, res) => {
  const { full_name, email, empresa, pais, telefono, cargo, plan_requested, team_size, use_case, message, user_id } = req.body;
  if (!full_name || !email || !empresa || !plan_requested) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  if (!["pyme","enterprise"].includes(plan_requested)) {
    return res.status(400).json({ error: "plan_requested inválido" });
  }
  try {
    const inserted = await sbInsert("quote_requests", {
      user_id: user_id || null,
      email, full_name, empresa,
      pais: pais || null, telefono: telefono || null, cargo: cargo || null,
      plan_requested, team_size: team_size || null,
      use_case: use_case || null, message: message || null,
      status: "new",
    }, true);
    sendSalesNotificationEmail({ full_name, email, empresa, pais, telefono, cargo, plan_requested, team_size, use_case, message }).catch(console.error);
    return res.json({ ok: true, request_id: inserted?.[0]?.id });
  } catch (err) {
    console.error("QUOTE REQUEST ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint legacy /api/payment/confirm — lo mantenemos por si Flow envía aún
 * webhooks viejos. Solo loggea y retorna OK.
 */
app.all("/api/payment/confirm", (req, res) => {
  console.log("LEGACY payment/confirm llamado:", req.method, req.query, req.body);
  return res.status(200).send("OK");
});

app.get("/api/payment/return", (_req, res) => res.redirect(`${APP_URL}/?payment=return`));

// ═════════════════════════════════════════════════════════════════════════════
// EMAILS
// ═════════════════════════════════════════════════════════════════════════════

function emailLayout({ preheader, contentHtml }) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>MINERVA</title></head>
<body style="margin:0;padding:0;background:#040D1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${preheader || ""}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#040D1A;padding:40px 16px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:linear-gradient(180deg,#0A1628 0%,#091428 100%);border:1px solid rgba(11,72,148,.5);border-radius:16px;overflow:hidden">
<tr><td style="padding:36px 40px 28px;background:linear-gradient(135deg,rgba(0,168,255,.08) 0%,rgba(255,193,7,.04) 100%);border-bottom:1px solid rgba(0,168,255,.15)">
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:.04em">MINERVA</td>
<td align="right" style="font-family:'Courier New',monospace;font-size:9px;color:#00A8FF;letter-spacing:.25em">DEAL · ENGINE</td>
</tr></table></td></tr>
<tr><td style="padding:36px 40px 32px;color:#C8D8F0;font-size:14px;line-height:1.6">${contentHtml}</td></tr>
<tr><td style="padding:20px 40px 24px;background:rgba(0,0,0,.2);border-top:1px solid rgba(0,168,255,.1);text-align:center">
<p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:9px;color:#FFC107;letter-spacing:.2em">SAPIENTIA · VICTORIA</p>
<p style="margin:0;font-size:11px;color:#3A5070">MINERVA Deal Engine · <a href="https://minervadeal.com" style="color:#3A5070;text-decoration:none">minervadeal.com</a></p>
</td></tr></table></td></tr></table></body></html>`;
}

async function sendPaymentReceiptEmail(email, amount, planLabel, isFirst) {
  if (!RESEND_API_KEY) return;
  const amountFmt = amount?.toLocaleString("es-CL") || "—";
  const today = new Date().toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });
  const title = isFirst ? `Tu plan ${planLabel} está activo` : `Cobro confirmado · ${planLabel}`;
  const content = `
    <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;color:#00A8FF;letter-spacing:.2em">${isFirst ? "SUSCRIPCIÓN ACTIVADA" : "PAGO CONFIRMADO"}</p>
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#FFFFFF;letter-spacing:-.02em;line-height:1.2">${title}</h1>
    <p style="margin:0 0 24px;color:#8FA8C8;font-size:14px;line-height:1.6">
      ${isFirst ? "Bienvenido. Ya puedes simular sin restricciones desde tu dashboard." : "Recibimos tu cobro automático. Tu suscripción sigue activa."}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(0,168,255,.06);border:1px solid rgba(0,168,255,.25);border-radius:12px;margin-bottom:28px"><tr><td style="padding:20px 24px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;color:#C8D8F0">
        <tr><td style="padding:6px 0;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em">PLAN</td><td align="right" style="padding:6px 0;color:#FFFFFF;font-weight:600">${planLabel}</td></tr>
        <tr><td style="padding:6px 0;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em">FECHA</td><td align="right" style="padding:6px 0;color:#FFFFFF;font-weight:600">${today}</td></tr>
        <tr><td style="padding:10px 0 6px;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;border-top:1px solid rgba(0,168,255,.15)">MONTO</td><td align="right" style="padding:10px 0 6px;color:#FFC107;font-weight:700;font-size:18px;border-top:1px solid rgba(0,168,255,.15)">$${amountFmt} CLP</td></tr>
      </table>
    </td></tr></table>
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px"><tr><td style="border-radius:10px;background:#00A8FF"><a href="${APP_URL}" style="display:inline-block;padding:14px 36px;color:#000000;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:.02em">Ir al dashboard →</a></td></tr></table>
    <p style="margin:28px 0 0;color:#5E7BA4;font-size:12px;line-height:1.6;text-align:center">¿Necesitas ayuda? <a href="mailto:hola@minervadeal.com" style="color:#00A8FF;text-decoration:none">hola@minervadeal.com</a></p>`;
  await transporter.sendMail({
    to: email,
    subject: isFirst ? `✓ Bienvenido · ${planLabel}` : `✓ Cobro confirmado · ${planLabel}`,
    html: emailLayout({ preheader: title, contentHtml: content }),
  });
}

async function sendSalesNotificationEmail(data) {
  if (!RESEND_API_KEY) return;
  const planLabel = data.plan_requested === "pyme" ? "PYME" : "Enterprise";
  const row = (label, value) => `<tr><td style="padding:8px 0;color:#5E7BA4;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.12em;width:35%;vertical-align:top">${label}</td><td style="padding:8px 0;color:#FFFFFF;font-size:13px;vertical-align:top">${value || "<span style='color:#3A5070'>—</span>"}</td></tr>`;
  const content = `
    <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;color:#FFC107;letter-spacing:.2em">NUEVA COTIZACIÓN · ${planLabel.toUpperCase()}</p>
    <h1 style="margin:0 0 28px;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-.02em;line-height:1.2">${data.empresa}</h1>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(0,168,255,.05);border:1px solid rgba(0,168,255,.2);border-radius:12px;margin-bottom:24px"><tr><td style="padding:18px 22px"><table width="100%" cellpadding="0" cellspacing="0" border="0">
    ${row("CONTACTO", data.full_name)}${row("EMAIL", `<a href="mailto:${data.email}" style="color:#00A8FF;text-decoration:none">${data.email}</a>`)}${row("CARGO", data.cargo)}${row("PAÍS", data.pais)}${row("TELÉFONO", data.telefono)}${row("EQUIPO", data.team_size ? `${data.team_size} personas` : null)}${row("CASO DE USO", data.use_case)}
    </table></td></tr></table>
    ${data.message ? `<div style="background:rgba(0,0,0,.25);border-left:2px solid #00A8FF;padding:14px 18px;border-radius:0 8px 8px 0;color:#C8D8F0;font-size:13px;line-height:1.6;margin-bottom:24px">${data.message.replace(/\n/g,"<br/>")}</div>` : ""}`;
  await transporter.sendMail({
    replyTo: data.email,
    to: SALES_EMAIL,
    subject: `[${planLabel}] Cotización: ${data.empresa}`,
    html: emailLayout({ preheader: `${data.full_name} - ${planLabel}`, contentHtml: content }),
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// CLAUDE PROXY (sin cambios)
// ═════════════════════════════════════════════════════════════════════════════
app.post("/api/claude", async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "missing_api_key", content: "" });
    const { system, user } = req.body || {};
    if (!user || typeof user !== "string") return res.status(400).json({ error: "missing_user_message", content: "" });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL, max_tokens: 1024,
        system: system || "", messages: [{ role: "user", content: user }],
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error(`[/api/claude] Anthropic ${r.status}:`, detail.slice(0, 500));
      return res.status(502).json({ error: "anthropic_error", status: r.status, content: "" });
    }
    const data = await r.json();
    const content = Array.isArray(data?.content)
      ? data.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim() : "";
    return res.json({ content });
  } catch (err) {
    console.error("[/api/claude]:", err);
    return res.status(500).json({ error: "server_exception", content: "" });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// FRONTEND ESTÁTICO
// ═════════════════════════════════════════════════════════════════════════════
app.use(sirv(join(__dirname, "dist"), { single: true }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`MINERVA running on http://localhost:${PORT} — APP_URL=${APP_URL}`);
});
