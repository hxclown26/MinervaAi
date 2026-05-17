import { useState, useEffect, createContext, useContext } from "react";
import { sb, type SbSession } from "../lib/supabase";
import { C } from "../lib/constants";
import { LoginScreen }       from "../routes/LoginScreen";
import { NewPasswordScreen } from "../routes/NewPasswordScreen";
import { OnboardingRoute }   from "../routes/OnboardingRoute";
import { PricingRoute }      from "../routes/PricingRoute";
import { DashboardScreen }   from "../routes/DashboardScreen";
import { ProfileScreen }     from "../routes/ProfileScreen";
import { CheckoutRoute }     from "../routes/CheckoutRoute";
import { WelcomeRoute }      from "../routes/WelcomeRoute";
import { AccountRoute }      from "../routes/AccountRoute";

// ── TIPOS ──────────────────────────────────────────────────────────
export type Route =
  | "login" | "new-password" | "onboarding"
  | "pricing" | "checkout" | "welcome"
  | "dashboard" | "profile" | "account";

export interface CheckoutContext {
  planCode: string;   // ej "imperium_monthly"
}

export interface AuthState {
  session:      SbSession | null;
  profile:      any;
  subscription: any;
  loading:      boolean;
  route:        Route;
  navigate:     (r: Route, ctx?: any) => void;
  refresh:      () => Promise<void>;
  signOut:      () => Promise<void>;
  checkoutCtx:  CheckoutContext | null;
}

// ── CONTEXT ────────────────────────────────────────────────────────
export const AuthCtx = createContext<AuthState>({
  session: null, profile: null, subscription: null, loading: true,
  route: "login", navigate: () => {}, refresh: async () => {}, signOut: async () => {},
  checkoutCtx: null,
});
export const useAuth = () => useContext(AuthCtx);

// ── RUTA BASADA EN ESTADO ──────────────────────────────────────────
export function resolveRoute(
  session:      SbSession | null,
  profile:      any,
  subscription: any
): Route {
  if (!session)                                          return "login";
  if (!profile?.profile_completed)                       return "onboarding";
  if (!subscription)                                     return "pricing";
  // Estados que dan acceso al producto: trial, active, past_due, y cancelled (mientras current_period_end no pase)
  const activeStates = ["trial", "trialing", "active", "past_due"];
  if (activeStates.includes(subscription.status))        return "dashboard";
  if (subscription.status === "cancelled" && subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
    return "dashboard";
  }
  return "pricing";
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
  } catch { return null; }
}

// ── AUTH GATE ──────────────────────────────────────────────────────
export function AuthGate() {
  const [session,       setSession]       = useState<SbSession | null>(null);
  const [profile,       setProfile]       = useState<any>(null);
  const [subscription,  setSubscription]  = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [route,         setRoute]         = useState<Route>("login");
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [checkoutCtx,   setCheckoutCtx]   = useState<CheckoutContext | null>(null);

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

  useEffect(() => {
    const init = async () => {
      const hash = window.location.hash;
      const search = window.location.search;

      // Detectar callback de Flow después del pago
      if (search.includes("payment=success")) {
        window.history.replaceState({}, document.title, window.location.pathname);
        const stored = loadPersistedSession();
        if (stored) {
          const fresh = await sb.ensureFreshSession(stored);
          if (fresh) {
            const user = await sb.getUser(fresh.access_token);
            if (user) {
              const validSess = { ...fresh, user };
              persistSession(validSess);
              setSession(validSess);
              // Cargar datos pero forzar ruta a /welcome
              const [prof, sub] = await Promise.all([
                sb.getProfile(validSess.access_token, validSess.user.id),
                sb.getSubscription(validSess.access_token, validSess.user.id),
              ]);
              setProfile(prof ?? null);
              setSubscription(sub ?? null);
              setRoute("welcome");
              setLoading(false);
              return;
            }
          }
        }
      }

      if (hash && hash.includes("access_token")) {
        const params        = new URLSearchParams(hash.substring(1));
        const access_token  = params.get("access_token")  ?? "";
        const refresh_token = params.get("refresh_token") ?? null;
        const expires_in    = Number(params.get("expires_in") ?? 0) || undefined;
        const type          = params.get("type");

        window.history.replaceState({}, document.title, window.location.pathname);

        if (type === "recovery" && access_token) {
          setRecoveryToken(access_token);
          setRoute("new-password");
          setLoading(false);
          return;
        }

        if (access_token) {
          const user = await sb.getUser(access_token);
          if (user) {
            const expires_at = expires_in ? Math.floor(Date.now() / 1000) + expires_in : undefined;
            const sess: SbSession = { access_token, refresh_token, expires_at, user };
            persistSession(sess);
            setSession(sess);
            await load(sess);
            return;
          }
        }
      }

      const stored = loadPersistedSession();
      if (!stored) { setLoading(false); return; }

      const fresh = await sb.ensureFreshSession(stored);
      if (!fresh) { persistSession(null); setLoading(false); return; }

      const user = await sb.getUser(fresh.access_token);
      if (!user) { persistSession(null); setLoading(false); return; }

      const validSess = { ...fresh, user };
      persistSession(validSess);
      setSession(validSess);
      await load(validSess);
    };

    init();
  }, []);

  const refresh = async () => {
    if (!session) return;
    try {
      const [prof, sub] = await Promise.all([
        sb.getProfile(session.access_token, session.user.id),
        sb.getSubscription(session.access_token, session.user.id),
      ]);
      setProfile(prof ?? null);
      setSubscription(sub ?? null);
    } catch {}
  };

  const signOut = async () => {
    if (session?.access_token) { try { await sb.signOut(session.access_token); } catch {} }
    persistSession(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
    setCheckoutCtx(null);
    setRoute("login");
    setLoading(false);
  };

  const updateSession = async (newSess: SbSession) => {
    persistSession(newSess);
    setSession(newSess);
    setLoading(true);
    await load(newSess);
  };

  const navigate = (r: Route, ctx?: any) => {
    if (r === "checkout" && ctx?.planCode) setCheckoutCtx({ planCode: ctx.planCode });
    setRoute(r);
  };

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.darkBg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:44,height:44,border:`2.5px solid ${C.darkBorder}`,borderTopColor:C.nodeCyan,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.nodeCyan,letterSpacing:".2em"}}>CARGANDO...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <AuthCtx.Provider value={{ session, profile, subscription, loading, route, navigate, refresh, signOut, checkoutCtx }}>
      {route === "login"        && <LoginScreen       onAuth={updateSession} />}
      {route === "new-password" && <NewPasswordScreen recoveryToken={recoveryToken} onSuccess={updateSession} />}
      {route === "onboarding"   && <OnboardingRoute   />}
      {route === "pricing"      && <PricingRoute      />}
      {route === "checkout"     && <CheckoutRoute     />}
      {route === "welcome"      && <WelcomeRoute      />}
      {route === "dashboard"    && <DashboardScreen   />}
      {route === "profile"      && <ProfileScreen     />}
      {route === "account"      && <AccountRoute      />}
    </AuthCtx.Provider>
  );
}
