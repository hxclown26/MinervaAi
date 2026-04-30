import { useState, useEffect, createContext, useContext } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { LoginScreen } from "../routes/LoginScreen";
import { NewPasswordScreen } from "../routes/NewPasswordScreen";
import { OnboardingRoute } from "../routes/OnboardingRoute";
import { PricingRoute } from "../routes/PricingRoute";
import { DashboardScreen } from "../routes/DashboardScreen";
import { ProfileScreen } from "../routes/ProfileScreen";

// ── AUTH CONTEXT ───────────────────────────────────────────────────
export type Route = "login" | "new-password" | "onboarding" | "pricing" | "dashboard" | "profile";

export interface AuthState {
  session: any;
  profile: any;
  subscription: any;
  loading: boolean;
  route: Route;
  navigate: (r: Route) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
export const AuthCtx = createContext<AuthState>({
  session:null, profile:null, subscription:null, loading:true,
  route:"login", navigate:()=>{}, refresh:async()=>{}, signOut:async()=>{},
});
export const useAuth = () => useContext(AuthCtx);

export function resolveRoute(session:any, profile:any, subscription:any): Route {
  if (!session) return "login";
  if (!profile?.profile_completed) return "onboarding";
  if (!subscription) return "pricing";
  return "dashboard";
}


// ── AUTH GATE ──────────────────────────────────────────────────────
export function AuthGate() {
  const [session,      setSession]      = useState<any>(null);
  const [profile,      setProfile]      = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [route,        setRoute]        = useState<Route>("login");
  const [recoveryToken, setRecoveryToken] = useState<string|null>(null);

  const load = async (sess:any) => {
    if (!sess) {
      setProfile(null); setSubscription(null);
      setRoute("login"); setLoading(false); return;
    }
    try {
      const [prof, sub] = await Promise.all([
        sb.getProfile(sess.access_token, sess.user.id),
        sb.getSubscription(sess.access_token, sess.user.id),
      ]);
      setProfile(prof || null);
      setSubscription(sub || null);
      setRoute(resolveRoute(sess, prof, sub));
    } catch {
      setProfile(null); setSubscription(null); setRoute("login");
    }
    setLoading(false);
  };

  useEffect(() => {
    const initAuth = async () => {
      // Detectar callback de confirmación de email o reset de password (hash en URL)
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const access_token  = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const type          = params.get("type");
        // Limpiar el hash de inmediato para que no quede en history/refresh
        window.history.replaceState({}, document.title, window.location.pathname);

        // Si viene de "olvidé mi contraseña", NO loguear: ir a NewPasswordScreen
        if (type === "recovery" && access_token) {
          setRecoveryToken(access_token);
          setRoute("new-password");
          setLoading(false);
          return;
        }

        // Confirmación normal de email
        if (access_token) {
          try {
            const user = await sb.getUser(access_token);
            if (user && user.id) {
              const sess = { access_token, refresh_token, user };
              localStorage.setItem("minerva_session", JSON.stringify(sess));
              setSession(sess);
              await load(sess);
              return;
            }
          } catch {}
        }
      }

      // Leer sesión guardada
      const stored = localStorage.getItem("minerva_session");
      if (!stored) { setLoading(false); return; }
      try {
        const sess = JSON.parse(stored);
        setSession(sess);
        await load(sess);
      } catch { setLoading(false); }
    };
    initAuth();
  }, []);

  const refresh = async () => {
    // Refresh silencioso: actualiza profile y subscription SIN tocar la ruta ni mostrar loading.
    // De lo contrario re-monta DashboardScreen y pierde simScreen, responses, report, etc.
    if (!session) return;
    try {
      const [prof, sub] = await Promise.all([
        sb.getProfile(session.access_token, session.user.id),
        sb.getSubscription(session.access_token, session.user.id),
      ]);
      setProfile(prof || null);
      setSubscription(sub || null);
    } catch {
      // Silencioso: si falla el refresh no reseteamos la sesión
    }
  };

  const signOut = async () => {
    if (session?.access_token) { try { await sb.signOut(session.access_token); } catch {} }
    localStorage.removeItem("minerva_session");
    setSession(null); setProfile(null); setSubscription(null);
    setRoute("login"); setLoading(false);
  };

  const updateSession = (sess:any) => {
    setSession(sess);
    if (sess) localStorage.setItem("minerva_session", JSON.stringify(sess));
    else localStorage.removeItem("minerva_session");
    setLoading(true);
    load(sess);
  };

  const navigate = (r: Route) => setRoute(r);

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.darkBg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:48,height:48,border:`3px solid ${C.darkBorder}`,borderTopColor:C.nodeCyan,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.nodeCyan,letterSpacing:".2em"}}>CARGANDO...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <AuthCtx.Provider value={{session,profile,subscription,loading,route,navigate,refresh,signOut}}>
      {route==="login"      && <LoginScreen onAuth={updateSession}/>}
      {route==="new-password" && <NewPasswordScreen recoveryToken={recoveryToken} onSuccess={updateSession}/>}
      {route==="onboarding" && <OnboardingRoute/>}
      {route==="pricing"    && <PricingRoute/>}
      {route==="dashboard"  && <DashboardScreen/>}
      {route==="profile"    && <ProfileScreen/>}
    </AuthCtx.Provider>
  );
}