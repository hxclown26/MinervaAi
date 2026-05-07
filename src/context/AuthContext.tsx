import { useState, useEffect, createContext, useContext } from "react";
import { sb, type SbSession } from "../lib/supabase";
import { C } from "../lib/constants";
import { LoginScreen }      from "../routes/LoginScreen";
import { NewPasswordScreen } from "../routes/NewPasswordScreen";
import { OnboardingRoute }  from "../routes/OnboardingRoute";
import { PricingRoute }     from "../routes/PricingRoute";
import { DashboardScreen }  from "../routes/DashboardScreen";
import { ProfileScreen }    from "../routes/ProfileScreen";

// ── TIPOS ──────────────────────────────────────────────────────────
export type Route = "login" | "new-password" | "onboarding" | "pricing" | "dashboard" | "profile";

export interface AuthState {
  session:      SbSession | null;
  profile:      any;
  subscription: any;
  loading:      boolean;
  route:        Route;
  navigate:     (r: Route) => void;
  refresh:      () => Promise<void>;
  signOut:      () => Promise<void>;
}

// ── CONTEXT ────────────────────────────────────────────────────────
export const AuthCtx = createContext<AuthState>({
  session: null, profile: null, subscription: null, loading: true,
  route: "login", navigate: () => {}, refresh: async () => {}, signOut: async () => {},
});
export const useAuth = () => useContext(AuthCtx);

// ── RUTA BASADA EN ESTADO ──────────────────────────────────────────
export function resolveRoute(
  session:      SbSession | null,
  profile:      any,
  subscription: any
): Route {
  if (!session)                        return "login";
  if (!profile?.profile_completed)     return "onboarding";
  if (!subscription || subscription.status !== "active") return "pricing";
  return "dashboard";
}

// ── PERSISTENCIA DE SESIÓN ─────────────────────────────────────────
const SESSION_KEY = "minerva_session";

function persistSession(sess: SbSession | null): void {
  if (sess) localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
  else      localStorage.removeItem(SESSION_KEY);
}

function loadPersistedSession(): SbSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SbSession;
  } catch {
    return null;
  }
}

// ── AUTH GATE ──────────────────────────────────────────────────────
export function AuthGate() {
  const [session,       setSession]       = useState<SbSession | null>(null);
  const [profile,       setProfile]       = useState<any>(null);
  const [subscription,  setSubscription]  = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [route,         setRoute]         = useState<Route>("login");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);

  // ── Carga perfil + suscripción y determina la ruta ──────────────
  const load = async (sess: SbSession) => {
    try {
      const [prof, sub] = await Promise.all([
        sb.getProfile(sess.access_token, sess.user.id),
        sb.getSubscription(sess.access_token, sess.user.id),
      ]);
      setProfile(prof ?? null);
      setSubscription(sub ?? null);
      setRoute(resolveRoute(sess, prof, sub));
    } catch {
      setProfile(null);
      setSubscription(null);
      setRoute("login");
    }
    setLoading(false);
  };

  // ── Inicialización: OAuth hash / recovery / sesión persistida ───
  useEffect(() => {
    const init = async () => {
      // 1. Callback de OAuth o confirmación de email (hash en URL)
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const params        = new URLSearchParams(hash.substring(1));
        const access_token  = params.get("access_token")  ?? "";
        const refresh_token = params.get("refresh_token") ?? null;
        const expires_in    = Number(params.get("expires_in") ?? 0) || undefined;
        const type          = params.get("type");

        // Limpiar hash de la URL para que no persista en historial
        window.history.replaceState({}, document.title, window.location.pathname);

        // a) Recovery password → NewPasswordScreen (NO loguear)
        if (type === "recovery" && access_token) {
          setRecoveryToken(access_token);
          setRoute("new-password");
          setLoading(false);
          return;
        }

        // b) Confirmación de email / OAuth exitoso
        if (access_token) {
          const user = await sb.getUser(access_token);
          if (user) {
            const expires_at = expires_in
              ? Math.floor(Date.now() / 1000) + expires_in
              : undefined;
            const sess: SbSession = { access_token, refresh_token, expires_at, user };
            persistSession(sess);
            setSession(sess);
            await load(sess);
            return;
          }
        }
      }

      // 2. Sesión persistida en localStorage
      const stored = loadPersistedSession();
      if (!stored) { setLoading(false); return; }

      // 2a. Intentar refrescar si el token está próximo a expirar
      const fresh = await sb.ensureFreshSession(stored);
      if (!fresh) {
        // Token inválido o refresh fallido → limpiar sesión
        persistSession(null);
        setLoading(false);
        return;
      }

      // 2b. Validar contra Supabase (detecta tokens revocados)
      const user = await sb.getUser(fresh.access_token);
      if (!user) {
        persistSession(null);
        setLoading(false);
        return;
      }

      // 2c. Sesión válida
      const validSess = { ...fresh, user };
      persistSession(validSess);
      setSession(validSess);
      await load(validSess);
    };

    init();
  }, []);

  // ── Refresh silencioso (no desmonta DashboardScreen) ────────────
  const refresh = async () => {
    if (!session) return;
    try {
      const [prof, sub] = await Promise.all([
        sb.getProfile(session.access_token, session.user.id),
        sb.getSubscription(session.access_token, session.user.id),
      ]);
      setProfile(prof ?? null);
      setSubscription(sub ?? null);
    } catch {
      // Fallo silencioso — no cortar la sesión por un error de red
    }
  };

  // ── Sign out completo ────────────────────────────────────────────
  const signOut = async () => {
    if (session?.access_token) {
      try { await sb.signOut(session.access_token); } catch {}
    }
    persistSession(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
    setRoute("login");
    setLoading(false);
  };

  // ── Actualizar sesión (usado por LoginScreen y NewPasswordScreen) 
  const updateSession = async (newSess: SbSession) => {
    persistSession(newSess);
    setSession(newSess);
    setLoading(true);
    await load(newSess);
  };

  const navigate = (r: Route) => setRoute(r);

  // ── Pantalla de carga ────────────────────────────────────────────
  if (loading) return (
    <div style={{
      minHeight: "100vh",
      background: C.darkBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans',-apple-system,sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 44, height: 44,
          border: `2.5px solid ${C.darkBorder}`,
          borderTopColor: C.nodeCyan,
          borderRadius: "50%",
          animation: "spin .8s linear infinite",
          margin: "0 auto 16px",
        }}/>
        <div style={{
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 10, color: C.nodeCyan, letterSpacing: ".2em",
        }}>CARGANDO...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <AuthCtx.Provider value={{ session, profile, subscription, loading, route, navigate, refresh, signOut }}>
      {route === "login"        && <LoginScreen      onAuth={updateSession} />}
      {route === "new-password" && <NewPasswordScreen recoveryToken={recoveryToken} onSuccess={updateSession} />}
      {route === "onboarding"   && <OnboardingRoute  />}
      {route === "pricing"      && <PricingRoute     />}
      {route === "dashboard"    && <DashboardScreen  />}
      {route === "profile"      && <ProfileScreen    />}
    </AuthCtx.Provider>
  );
}
