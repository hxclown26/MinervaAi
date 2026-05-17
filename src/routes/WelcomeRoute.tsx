import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C, PLANS } from "../lib/constants";
import { AuthHeader } from "../components/AuthHeader";

export function WelcomeRoute() {
  const { session, subscription, refresh, navigate } = useAuth();
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!session) navigate("login");
  }, [session]);

  // Polling: refresca cada 2s hasta que subscription esté active (máx 30s)
  useEffect(() => {
    if (!session) return;
    if (subscription?.status === "active") return;
    if (attempts >= 15) { setTimedOut(true); return; }

    const t = setTimeout(() => {
      refresh();
      setAttempts(a => a + 1);
    }, 2000);
    return () => clearTimeout(t);
  }, [session, subscription, attempts]);

  const isActive = subscription?.status === "active";
  const plan: any = subscription?.plan_code ? (PLANS as any)[subscription.plan_code] : null;
  const nextChargeDate = subscription?.next_charge_at
    ? new Date(subscription.next_charge_at).toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" })
    : null;

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(180deg, ${C.darkBg} 0%, #0F2545 60%)`,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <AuthHeader theme="dark"/>

      <div style={{padding:"80px 24px",display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
        <div style={{maxWidth:520,width:"100%",textAlign:"center" as const}}>

          {/* Loading */}
          {!isActive && !timedOut && (
            <>
              <div style={{width:60,height:60,border:`3px solid ${C.darkBorder}`,borderTopColor:C.nodeCyan,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 24px"}}/>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <h1 style={{fontSize:24,fontWeight:700,color:C.textLight,margin:"0 0 12px"}}>Procesando tu suscripción…</h1>
              <p style={{fontSize:14,color:"rgba(200,216,240,.6)",lineHeight:1.6}}>
                Estamos confirmando tu pago con Flow. Esto toma unos segundos.
              </p>
            </>
          )}

          {/* Activado */}
          {isActive && (
            <>
              <div style={{width:80,height:80,background:`${C.success}22`,border:`2px solid ${C.success}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 28px",fontSize:36,color:C.success}}>
                ✓
              </div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.success,letterSpacing:".18em",marginBottom:8}}>SUSCRIPCIÓN ACTIVA</div>
              <h1 style={{fontSize:28,fontWeight:800,color:C.textLight,margin:"0 0 14px",letterSpacing:"-.02em",lineHeight:1.2}}>
                ¡Bienvenido a MINERVA{session?.user?.user_metadata?.full_name ? `, ${session.user.user_metadata.full_name.split(" ")[0]}` : ""}!
              </h1>
              <p style={{fontSize:15,color:"rgba(200,216,240,.7)",lineHeight:1.6,marginBottom:28}}>
                Tu plan <strong style={{color:C.textLight}}>{plan?.name || subscription?.plan}</strong> está activo.<br/>
                Podés empezar a simular sin restricciones.
              </p>

              {nextChargeDate && (
                <div style={{background:"rgba(0,168,255,.06)",border:`1px solid ${C.nodeCyan}33`,borderRadius:12,padding:"16px 20px",marginBottom:28,textAlign:"left" as const}}>
                  <div style={{fontSize:11,color:C.nodeCyan,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".12em",marginBottom:6}}>PRÓXIMO COBRO</div>
                  <div style={{fontSize:15,color:C.textLight,fontWeight:600}}>
                    {nextChargeDate} — ${subscription?.next_charge_amount_clp?.toLocaleString("es-CL") || "—"} CLP
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:10,flexDirection:"column" as const}}>
                <button
                  onClick={()=>navigate("dashboard")}
                  style={{padding:"15px",background:C.nodeCyan,color:"#000",border:"none",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:".02em"}}
                >Ir al simulador →</button>
                <button
                  onClick={()=>navigate("account")}
                  style={{padding:"13px",background:"transparent",color:C.textLight,border:`1px solid ${C.darkBorder}`,borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
                >Ver mi cuenta</button>
              </div>
            </>
          )}

          {/* Timeout */}
          {timedOut && !isActive && (
            <>
              <div style={{width:60,height:60,background:`${C.gold}22`,border:`2px solid ${C.gold}`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px",fontSize:28,color:C.gold}}>⏱</div>
              <h1 style={{fontSize:22,fontWeight:700,color:C.textLight,margin:"0 0 12px"}}>Estamos procesando tu pago</h1>
              <p style={{fontSize:14,color:"rgba(200,216,240,.6)",lineHeight:1.6,marginBottom:24}}>
                El cobro está tardando un poco más de lo normal. Te enviaremos un email a <strong style={{color:C.textLight}}>{session?.user?.email}</strong> apenas se confirme.
              </p>
              <button
                onClick={()=>navigate("account")}
                style={{padding:"13px 28px",background:C.nodeCyan,color:"#000",border:"none",borderRadius:12,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
              >Ver mi cuenta</button>
              <p style={{marginTop:18,fontSize:11,color:"rgba(200,216,240,.4)"}}>
                ¿Algo salió mal? <a href="mailto:hola@minervadeal.com" style={{color:C.nodeCyan,textDecoration:"none"}}>hola@minervadeal.com</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
