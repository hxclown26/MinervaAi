import { useState, useEffect } from "react";
import { sb, type SbSession } from "../lib/supabase";
import { C, BGN, BGE, HEX } from "../lib/constants";

// ── TIPOS INTERNOS ──────────────────────────────────────────────────
type Mode  = "login" | "register" | "recover";
type MsgType = "error" | "ok" | "info";
interface Msg { type: MsgType; text: string }

// Traduce los errores de Supabase a mensajes claros en español.
function translateAuthError(raw: string | undefined): string {
  if (!raw) return "Ocurrió un error inesperado. Intenta nuevamente.";
  const r = raw.toLowerCase();
  if (r.includes("email not confirmed"))
    return "Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.";
  if (r.includes("invalid login credentials") || r.includes("invalid password"))
    return "Correo o contraseña incorrectos.";
  if (r.includes("user already registered") || r.includes("already been registered"))
    return "Ya existe una cuenta con este correo. Inicia sesión en su lugar.";
  if (r.includes("password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (r.includes("rate limit"))
    return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
  if (r.includes("network") || r.includes("fetch"))
    return "Sin conexión. Verifica tu internet e intenta nuevamente.";
  return raw;
}

// ── ESTILOS COMPARTIDOS ────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');`;

const ANIMATIONS = `
  @keyframes mFloat  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  @keyframes pulse   { 0%,100%{opacity:.6} 50%{opacity:1} }
  @keyframes spin    { to{transform:rotate(360deg)} }
  * { box-sizing: border-box; }
  input:focus { outline: none; }
  button:focus-visible { outline: 2px solid ${C.nodeCyan}; outline-offset: 2px; }
`;

// ── INPUT HELPER ───────────────────────────────────────────────────
function Field({
  label, type = "text", value, onChange, placeholder, disabled, autoFocus,
  onEnter, error,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; autoFocus?: boolean;
  onEnter?: () => void; error?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? C.error : focused ? C.blueMain : C.lightBorder;
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        fontSize: 10, color: C.textGray, display: "block",
        marginBottom: 6, fontFamily: "'JetBrains Mono',monospace",
        letterSpacing: ".08em", textTransform: "uppercase" as const,
      }}>{label}</label>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={e => e.key === "Enter" && onEnter?.()}
        style={{
          width: "100%", padding: "12px 16px",
          borderRadius: 10, fontSize: 14,
          border: `1.5px solid ${borderColor}`,
          background: C.lightCard, color: C.textDark,
          fontFamily: "inherit", outline: "none",
          boxSizing: "border-box" as const,
          transition: "border-color .15s",
          opacity: disabled ? .55 : 1,
        }}
      />
    </div>
  );
}

// ── TOAST / MENSAJE ────────────────────────────────────────────────
function Toast({ msg, onDismiss }: { msg: Msg; onDismiss?: () => void }) {
  const palettes: Record<MsgType, { bg: string; border: string; text: string; icon: string }> = {
    error: { bg: C.error + "0E", border: C.error + "30", text: C.error,   icon: "✕" },
    ok:    { bg: "#05966910",    border: "#05966930",    text: C.success,  icon: "✓" },
    info:  { bg: C.nodeBlue+"10", border: C.nodeBlue+"30", text: C.nodeBlue, icon: "ℹ" },
  };
  const p = palettes[msg.type];
  return (
    <div style={{
      padding: "11px 14px", borderRadius: 10, marginBottom: 18,
      fontSize: 13, lineHeight: 1.5,
      background: p.bg, border: `1px solid ${p.border}`, color: p.text,
      display: "flex", alignItems: "flex-start", gap: 10,
      animation: "fadeUp .2s ease",
    }}>
      <span style={{ fontWeight: 700, flexShrink: 0, fontSize: 11, marginTop: 1 }}>{p.icon}</span>
      <span style={{ flex: 1 }}>{msg.text}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: "none", border: "none", cursor: "pointer",
          color: p.text, fontSize: 14, padding: 0, opacity: .6, flexShrink: 0,
        }}>×</button>
      )}
    </div>
  );
}

// ── DIVIDER ────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
      <div style={{ flex: 1, height: 1, background: C.lightBorder }} />
      <span style={{
        fontSize: 10, color: C.textHint,
        fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".08em",
      }}>O CONTINÚA CON</span>
      <div style={{ flex: 1, height: 1, background: C.lightBorder }} />
    </div>
  );
}

// ── BOTÓN GOOGLE ───────────────────────────────────────────────────
function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%", padding: "13px",
        background: hovered ? "#F8F8F8" : "#fff",
        border: `1.5px solid ${hovered ? C.blueMain : C.lightBorder}`,
        borderRadius: 10, fontSize: 14, fontWeight: 600, color: C.textDark,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit", marginBottom: 4,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        transition: "all .15s", opacity: disabled ? .6 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continuar con Google
    </button>
  );
}

// ── PRIMARY BUTTON ─────────────────────────────────────────────────
function PrimaryButton({
  onClick, disabled, loading, children,
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: "100%", padding: "14px",
        background: (disabled || loading) ? C.lightBorder2 : C.textDark,
        border: "none", borderRadius: 10,
        color: (disabled || loading) ? C.textHint : "#fff",
        fontSize: 14, fontWeight: 700,
        cursor: (disabled || loading) ? "not-allowed" : "pointer",
        fontFamily: "inherit", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        transition: "all .15s",
      }}
    >
      {loading && (
        <span style={{
          width: 14, height: 14, border: "2px solid rgba(255,255,255,.3)",
          borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite",
          display: "inline-block", flexShrink: 0,
        }}/>
      )}
      {children}
    </button>
  );
}

// ── HERO (PANEL IZQUIERDO / SUPERIOR) ─────────────────────────────
function Hero() {
  return (
    <div style={{
      background: C.darkBg, position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "52px 40px 72px", minHeight: "44vh",
    }}>
      {/* Fondo animado */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        opacity: .14, pointerEvents: "none",
      }}>
        {BGE.map(([a, b], i) => {
          const na = BGN[a], nb = BGN[b];
          return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke={C.nodeBlue} strokeWidth=".4"/>;
        })}
        {BGN.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r * .6} fill={C.nodeBlue}>
            <animate attributeName="opacity" values=".15;.7;.15"
              dur={`${2.5 + n.d}s`} repeatCount="indefinite"/>
          </circle>
        ))}
      </svg>

      {/* Logo animado */}
      <div style={{ animation: "mFloat 5s ease-in-out infinite", position: "relative", zIndex: 1, marginBottom: 20 }}>
        <svg width="80" height="80" viewBox="0 0 100 100">
          <defs>
            <radialGradient id="hG" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={C.nodeBlue} stopOpacity=".12"/>
              <stop offset="100%" stopColor={C.nodeBlue} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill="url(#hG)"/>
          <circle cx="50" cy="50" r="44" fill="none" stroke={C.darkBorder} strokeWidth="1"/>
          <circle cx="50" cy="50" r="44" fill="none" stroke={C.nodeBlue}
            strokeWidth=".5" strokeDasharray="3 3" strokeOpacity=".35">
            <animateTransform attributeName="transform" type="rotate"
              from="0 50 50" to="360 50 50" dur="22s" repeatCount="indefinite"/>
          </circle>
          {HEX.map((n, i) => (
            <g key={i}>
              <line x1="50" y1="50" x2={n.cx} y2={n.cy}
                stroke={C.nodeBlue} strokeWidth=".7" strokeOpacity=".28"/>
              <circle cx={n.cx} cy={n.cy} r="4" fill={C.darkBg} stroke={C.nodeBlue} strokeWidth="1"/>
              <circle cx={n.cx} cy={n.cy} r="2" fill={C.nodeBlue}>
                <animate attributeName="opacity" values=".25;1;.25"
                  dur={`${1.8 + i * .35}s`} repeatCount="indefinite"/>
              </circle>
            </g>
          ))}
          <circle cx="50" cy="50" r="19" fill={C.darkSurface} stroke={C.darkBorder} strokeWidth="1.5"/>
          <text x="50" y="55" textAnchor="middle" fill={C.textLight}
            fontSize="14" fontWeight="800" fontFamily="'Plus Jakarta Sans',sans-serif">M</text>
        </svg>
      </div>

      {/* Wordmark */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          fontSize: 28, fontWeight: 800, letterSpacing: "-.03em",
          color: C.textLight, lineHeight: 1, marginBottom: 6,
        }}>MINERVA</div>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 11, letterSpacing: ".2em", color: C.nodeCyan,
        }}>DEAL.ENGINE</div>
      </div>

      {/* Fade hacia el panel blanco */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 70,
        pointerEvents: "none",
        background: `linear-gradient(to bottom, transparent, ${C.lightCard})`,
      }}/>
    </div>
  );
}

// ── PANEL: VERIFICACIÓN PENDIENTE ─────────────────────────────────
function PendingVerification({
  email,
  onResend,
  onBack,
}: { email: string; onResend: () => Promise<void>; onBack: () => void }) {
  const [resending, setResending] = useState(false);
  const [resent,    setResent]    = useState(false);
  const [cooldown,  setCooldown]  = useState(0);

  // Countdown para evitar spam de reenvíos
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    await onResend();
    setResending(false);
    setResent(true);
    setCooldown(60);
  };

  return (
    <div style={{ animation: "fadeUp .25s ease" }}>
      {/* Ícono de mail */}
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: C.blueMain + "12",
        border: `1.5px solid ${C.blueMain}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, marginBottom: 20,
      }}>✉</div>

      <div style={{
        fontSize: 22, fontWeight: 800, color: C.textDark,
        letterSpacing: "-.03em", marginBottom: 8,
      }}>Confirma tu correo</div>

      <div style={{ fontSize: 14, color: C.textGray, lineHeight: 1.6, marginBottom: 24 }}>
        Enviamos un enlace de confirmación a{" "}
        <strong style={{ color: C.textDark, wordBreak: "break-all" }}>{email}</strong>.
        <br/>Haz clic en el enlace y luego inicia sesión.
      </div>

      {resent && (
        <Toast msg={{ type: "ok", text: "Correo reenviado. Revisa tu bandeja (y el spam)." }}/>
      )}

      <div style={{
        background: C.lightBg, borderRadius: 12, padding: "14px 16px",
        marginBottom: 20, fontSize: 13, color: C.textGray, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.textDark }}>¿No llega el correo?</strong> Revisa tu carpeta de spam
        o correo no deseado. El enlace expira en 24 horas.
      </div>

      {/* Reenviar */}
      <button
        onClick={handleResend}
        disabled={resending || cooldown > 0}
        style={{
          width: "100%", padding: "13px",
          background: "transparent",
          border: `1.5px solid ${(resending || cooldown > 0) ? C.lightBorder : C.textDark}`,
          borderRadius: 10, fontSize: 14, fontWeight: 600,
          color: (resending || cooldown > 0) ? C.textHint : C.textDark,
          cursor: (resending || cooldown > 0) ? "not-allowed" : "pointer",
          fontFamily: "inherit", marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all .15s",
        }}
      >
        {resending
          ? <><span style={{ width: 13, height: 13, border: `2px solid ${C.textHint}`, borderTopColor: C.textDark, borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }}/> Enviando...</>
          : cooldown > 0
            ? `Reenviar en ${cooldown}s`
            : "Reenviar correo de confirmación"
        }
      </button>

      <button
        onClick={onBack}
        style={{
          background: "none", border: "none", color: C.textHint,
          fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          display: "block", margin: "0 auto",
        }}
      >← Volver al login</button>
    </div>
  );
}

// ── PANEL: RECOVERY ENVIADO ────────────────────────────────────────
function RecoverySent({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div style={{ animation: "fadeUp .25s ease" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: C.success + "12", border: `1.5px solid ${C.success}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, marginBottom: 20,
      }}>🔑</div>

      <div style={{
        fontSize: 22, fontWeight: 800, color: C.textDark,
        letterSpacing: "-.03em", marginBottom: 8,
      }}>Revisa tu correo</div>

      <div style={{ fontSize: 14, color: C.textGray, lineHeight: 1.6, marginBottom: 24 }}>
        Enviamos las instrucciones para restablecer tu contraseña a{" "}
        <strong style={{ color: C.textDark, wordBreak: "break-all" }}>{email}</strong>.
        <br/>El enlace expira en 1 hora.
      </div>

      <button
        onClick={onBack}
        style={{
          background: "none", border: "none", color: C.blueMain,
          fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          fontWeight: 600,
        }}
      >← Volver al login</button>
    </div>
  );
}

// ── LOGIN SCREEN (COMPONENTE PRINCIPAL) ───────────────────────────
export function LoginScreen({ onAuth }: { onAuth: (sess: SbSession) => void }) {
  const [mode,    setMode]    = useState<Mode>("login");
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<Msg | null>(null);

  // Estados de post-acción
  const [pendingEmail,    setPendingEmail]    = useState<string | null>(null);
  const [recoverySent,    setRecoverySent]    = useState(false);

  const clearMsg = () => setMsg(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setMsg(null);
    setPendingEmail(null);
    setRecoverySent(false);
    setPass("");
  };

  // ── LOGIN ─────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim())  { setMsg({ type: "error", text: "Ingresa tu correo electrónico." }); return; }
    if (!pass)          { setMsg({ type: "error", text: "Ingresa tu contraseña." }); return; }
    setLoading(true); setMsg(null);
    try {
      const d = await sb.signIn(email.trim(), pass);
      if (d.error) {
        setMsg({ type: "error", text: translateAuthError(d.error.message) });
        // Si el error es email sin confirmar, mostramos el panel de reenvío
        if (d.error.message?.toLowerCase().includes("email not confirmed")) {
          setPendingEmail(email.trim());
        }
      } else {
        const sess = sb.normalizeSession(d);
        if (sess) onAuth(sess);
        else setMsg({ type: "error", text: "No pudimos iniciar sesión. Intenta nuevamente." });
      }
    } catch {
      setMsg({ type: "error", text: "Sin conexión. Verifica tu internet." });
    }
    setLoading(false);
  };

  // ── REGISTER ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!email.trim()) { setMsg({ type: "error", text: "Ingresa tu correo electrónico." }); return; }
    if (pass.length < 6) { setMsg({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." }); return; }
    setLoading(true); setMsg(null);
    try {
      const d = await sb.signUp(email.trim(), pass);
      if (d.error) {
        setMsg({ type: "error", text: translateAuthError(d.error.message) });
      } else if (d.access_token) {
        // Email confirmation desactivado: inicio de sesión inmediato
        const sess = sb.normalizeSession(d);
        if (sess) onAuth(sess);
      } else {
        // Email confirmation activado: mostrar pantalla de verificación pendiente
        setPendingEmail(email.trim());
      }
    } catch {
      setMsg({ type: "error", text: "Sin conexión. Verifica tu internet." });
    }
    setLoading(false);
  };

  // ── RECOVER ───────────────────────────────────────────────────────
  const handleRecover = async () => {
    if (!email.trim()) { setMsg({ type: "error", text: "Ingresa tu correo electrónico." }); return; }
    setLoading(true); setMsg(null);
    try {
      await sb.resetPassword(email.trim());
      setRecoverySent(true);
    } catch {
      setMsg({ type: "error", text: "Sin conexión. Verifica tu internet." });
    }
    setLoading(false);
  };

  // ── REENVIAR CONFIRMACIÓN ─────────────────────────────────────────
  const handleResendConfirmation = async () => {
    if (!pendingEmail) return;
    await sb.resendConfirmation(pendingEmail);
  };

  const handleSubmit = () => {
    if (mode === "login")    handleLogin();
    else if (mode === "register") handleRegister();
    else                     handleRecover();
  };

  const titles: Record<Mode, { h: string; sub: string }> = {
    login:   { h: "Bienvenido de vuelta",    sub: "Accede a tu simulador de negociación" },
    register:{ h: "Crea tu cuenta",          sub: "Sin tarjeta de crédito · 7 días gratis" },
    recover: { h: "Recuperar contraseña",    sub: "Te enviamos un enlace a tu correo" },
  };

  const t = titles[mode];
  const showPassField  = mode !== "recover";
  const showGoogleBtn  = mode !== "recover";
  const ctaLabel = mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Enviar enlace";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif",
    }}>
      <style>{FONTS + ANIMATIONS}</style>

      <Hero/>

      {/* ── FORMULARIO ── */}
      <div style={{
        background: C.lightCard, flex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", padding: "40px 24px 60px",
      }}>
        <div style={{ width: "100%", maxWidth: 380, animation: "fadeUp .3s ease" }}>

          {/* ── ESTADO: EMAIL PENDIENTE DE CONFIRMACIÓN ── */}
          {pendingEmail && (
            <PendingVerification
              email={pendingEmail}
              onResend={handleResendConfirmation}
              onBack={() => { setPendingEmail(null); switchMode("login"); }}
            />
          )}

          {/* ── ESTADO: RECOVERY ENVIADO ── */}
          {!pendingEmail && recoverySent && (
            <RecoverySent
              email={email}
              onBack={() => { setRecoverySent(false); switchMode("login"); }}
            />
          )}

          {/* ── FORMULARIO PRINCIPAL ── */}
          {!pendingEmail && !recoverySent && (
            <>
              {/* Encabezado */}
              <div style={{ marginBottom: 26, textAlign: "center" }}>
                <div style={{
                  fontSize: 22, fontWeight: 800, color: C.textDark,
                  letterSpacing: "-.03em", marginBottom: 6,
                }}>{t.h}</div>
                <div style={{ fontSize: 13, color: C.textGray }}>{t.sub}</div>
              </div>

              {/* Google OAuth — arriba en register para mejor conversión */}
              {showGoogleBtn && mode === "register" && (
                <>
                  <GoogleButton onClick={() => sb.signInWithGoogle()} disabled={loading}/>
                  <OrDivider/>
                </>
              )}

              {/* Mensaje de feedback */}
              {msg && <Toast msg={msg} onDismiss={clearMsg}/>}

              {/* Campos */}
              <Field
                label="Correo electrónico"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="tu@empresa.com"
                disabled={loading}
                autoFocus
                onEnter={handleSubmit}
                error={msg?.type === "error" && msg.text.toLowerCase().includes("correo")}
              />
              {showPassField && (
                <Field
                  label="Contraseña"
                  type="password"
                  value={pass}
                  onChange={setPass}
                  placeholder={mode === "register" ? "Mínimo 6 caracteres" : "••••••••"}
                  disabled={loading}
                  onEnter={handleSubmit}
                  error={msg?.type === "error" && msg.text.toLowerCase().includes("contraseña")}
                />
              )}

              {/* Olvidé mi contraseña (solo login) */}
              {mode === "login" && (
                <div style={{ textAlign: "right", marginTop: -8, marginBottom: 18 }}>
                  <button
                    onClick={() => switchMode("recover")}
                    style={{
                      background: "none", border: "none",
                      color: C.textHint, fontSize: 12,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >¿Olvidaste tu contraseña?</button>
                </div>
              )}

              {/* CTA principal */}
              <PrimaryButton onClick={handleSubmit} loading={loading} disabled={!email}>
                {loading ? "Procesando..." : `${ctaLabel} →`}
              </PrimaryButton>

              {/* Google OAuth — abajo en login */}
              {showGoogleBtn && mode === "login" && (
                <>
                  <OrDivider/>
                  <GoogleButton onClick={() => sb.signInWithGoogle()} disabled={loading}/>
                </>
              )}

              {/* Links de cambio de modo */}
              <div style={{
                display: "flex", flexDirection: "column",
                gap: 10, alignItems: "center", marginTop: 8,
              }}>
                {mode === "login" && (
                  <button
                    onClick={() => switchMode("register")}
                    style={{
                      background: "none", border: "none",
                      color: C.blueMain, fontSize: 13,
                      cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                    }}
                  >¿No tienes cuenta? Regístrate gratis →</button>
                )}
                {mode !== "login" && (
                  <button
                    onClick={() => switchMode("login")}
                    style={{
                      background: "none", border: "none",
                      color: C.textHint, fontSize: 12,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >← Volver a iniciar sesión</button>
                )}
              </div>

              {/* Footer legal */}
              {mode === "register" && (
                <p style={{
                  fontSize: 11, color: C.textHint, textAlign: "center",
                  marginTop: 24, lineHeight: 1.6,
                }}>
                  Al crear una cuenta aceptas nuestros{" "}
                  <a href="/terminos" style={{ color: C.blueMain, textDecoration: "none" }}>Términos</a>
                  {" "}y{" "}
                  <a href="/privacidad" style={{ color: C.blueMain, textDecoration: "none" }}>Privacidad</a>.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
