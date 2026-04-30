import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import { planLabel } from "../lib/helpers";
import { AuthHeader } from "../components/AuthHeader";

// ── PRICING ROUTE ──────────────────────────────────────────────────
export function PricingRoute() {
  const { session, profile, subscription, refresh, navigate } = useAuth();
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState("");

  useEffect(() => {
    if (!session) navigate("login");
    else if (!profile?.profile_completed) navigate("onboarding");
  }, [session, profile]);

  if (!session || !profile?.profile_completed) return null;

  const hasActiveSubscription = !!subscription;
  const canStartTrial = !hasActiveSubscription;

  const startTrial = async () => {
    if (!session?.access_token) return;
    setTrialError(""); setTrialLoading(true);
    try {
      const result = await sb.startFreeTrial(session.access_token);
      if (result?.message || result?.code) {
        setTrialError(result.message || "No pudimos activar el trial. Intenta nuevamente.");
        setTrialLoading(false);
        return;
      }
      await refresh();
      navigate("dashboard");
    } catch {
      setTrialError("Error de conexión. Intenta nuevamente.");
      setTrialLoading(false);
    }
  };

  const plans = [
    {
      id:"salesman", name:"Salesman", badge:"INDIVIDUAL",
      price:"$30.000", currency:"CLP/mes",
      tagline:"Brilla en tu organización con inteligencia estratégica",
      features:["1 usuario","20 simulaciones al mes","11 mercados verticales","3 modelos comerciales","Informe ejecutivo PDF","Dashboard personal"],
      cta:"Contratar Salesman →", featured:false,
    },
    {
      id:"pyme", name:"Pyme Enterprise", badge:"MÁS POPULAR",
      price:"$300.000", currency:"CLP/mes",
      tagline:"Equipa a todo tu equipo comercial",
      features:["Hasta 5 usuarios","100 simulaciones al mes","11 mercados verticales","3 modelos comerciales","Informe ejecutivo PDF","Dashboard empresa + vendedor","Gestión de equipo"],
      cta:"Contratar Pyme →", featured:true,
    },
    {
      id:"enterprise", name:"Business Enterprise", badge:"PREMIUM",
      price:"A cotizar", currency:"según requerimientos",
      tagline:"Solución a medida para grandes equipos",
      features:["Usuarios ilimitados","Simulaciones ilimitadas","Integración CRM","Dashboard enterprise","Desarrollo a medida","Soporte prioritario"],
      cta:"Contactar →", featured:false,
    },
  ];

  return (
    <div style={{minHeight:"100vh",background:C.darkBg,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');*{box-sizing:border-box}`}</style>
      <AuthHeader step={2} theme="dark"/>
      <div style={{padding:"48px 24px 80px"}}>
        <div style={{maxWidth:900,margin:"0 auto",textAlign:"center" as const}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.nodeCyan,letterSpacing:".18em",textTransform:"uppercase" as const,marginBottom:12}}>Elige tu plan</div>
          <h1 style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:800,letterSpacing:"-.04em",color:C.textLight,margin:"0 0 10px",lineHeight:1.1}}>Simple, transparente,<br/>sin sorpresas.</h1>
          <p style={{fontSize:15,color:C.textLight,opacity:.5,marginBottom:32}}>Un vendedor que cierra una sola venta adicional al mes paga el plan 10 veces.</p>

          {/* Banner Free Trial — solo si NO tiene subscription activa */}
          {canStartTrial && (
            <div style={{
              background:"linear-gradient(135deg, rgba(0,168,255,.15), rgba(0,102,204,.08))",
              border:`1.5px solid ${C.nodeCyan}55`,
              borderRadius:16,
              padding:"24px 28px",
              marginBottom:32,
              display:"flex",
              alignItems:"center",
              justifyContent:"space-between",
              gap:20,
              flexWrap:"wrap" as const,
              textAlign:"left" as const
            }}>
              <div style={{flex:1,minWidth:240}}>
                <div style={{display:"inline-block",fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.nodeCyan,letterSpacing:".15em",background:C.nodeCyan+"22",border:`1px solid ${C.nodeCyan}55`,padding:"3px 10px",borderRadius:980,marginBottom:10}}>RECOMENDADO PARA EMPEZAR</div>
                <div style={{fontSize:20,fontWeight:800,color:C.textLight,marginBottom:6,letterSpacing:"-.02em"}}>Probá gratis 30 días</div>
                <div style={{fontSize:13,color:"rgba(200,216,240,.7)",lineHeight:1.5}}>2 simulaciones completas con todos los agentes. Sin tarjeta de crédito.</div>
                {trialError && <div style={{marginTop:10,padding:"8px 12px",background:C.error+"15",border:`1px solid ${C.error}40`,borderRadius:8,fontSize:12,color:C.error}}>{trialError}</div>}
              </div>
              <button
                onClick={startTrial}
                disabled={trialLoading}
                style={{
                  padding:"14px 28px",
                  background:trialLoading?"rgba(255,255,255,.1)":C.nodeCyan,
                  border:"none",borderRadius:12,
                  color:trialLoading?"rgba(255,255,255,.4)":"#000",
                  fontSize:14,fontWeight:700,
                  cursor:trialLoading?"not-allowed":"pointer",
                  fontFamily:"inherit",
                  whiteSpace:"nowrap" as const,
                  transition:"all .15s"
                }}
              >{trialLoading?"Activando...":"Empezar trial gratis →"}</button>
            </div>
          )}

          {hasActiveSubscription && (
            <div style={{
              background:"rgba(0,200,150,.08)",
              border:`1px solid ${C.success}40`,
              borderRadius:12,padding:"12px 18px",marginBottom:32,
              fontSize:13,color:"rgba(200,216,240,.85)"
            }}>
              ✓ Ya tienes una suscripción <strong>{planLabel(subscription.plan)}</strong> activa.
              <button onClick={()=>navigate("dashboard")} style={{marginLeft:10,background:"none",border:"none",color:C.nodeCyan,cursor:"pointer",fontSize:13,fontFamily:"inherit",textDecoration:"underline"}}>Ir al dashboard →</button>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16,textAlign:"left" as const}}>
            {plans.map(p=>(
              <div key={p.id} style={{position:"relative",background:p.featured?"rgba(0,102,204,.12)":C.darkSurface,border:`1.5px solid ${p.featured?"rgba(0,102,204,.5)":C.darkBorder}`,borderRadius:20,padding:"32px 28px",display:"flex",flexDirection:"column" as const,gap:0}}>
                {p.featured&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",background:C.blueMain,color:"#fff",fontSize:9,fontWeight:700,padding:"3px 14px",borderRadius:980,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em",whiteSpace:"nowrap" as const}}>{p.badge}</div>}
                {!p.featured&&<div style={{display:"inline-block",background:"rgba(0,168,255,.1)",border:"1px solid rgba(0,168,255,.25)",borderRadius:980,padding:"3px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"rgba(0,168,255,.9)",letterSpacing:".1em",marginBottom:14}}>{p.badge}</div>}
                {p.featured&&<div style={{height:14}}/>}
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"rgba(200,216,240,.6)",letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:12}}>{p.name}</div>
                <div style={{fontSize:p.id==="enterprise"?28:40,fontWeight:800,color:C.textLight,letterSpacing:"-.04em",lineHeight:1,marginBottom:4}}>{p.price} <span style={{fontSize:14,fontWeight:400,color:"rgba(200,216,240,.4)"}}>{p.currency}</span></div>
                <div style={{fontSize:12,color:"rgba(200,216,240,.45)",marginBottom:20,lineHeight:1.5}}>{p.tagline}</div>
                <div style={{height:1,background:"rgba(255,255,255,.08)",marginBottom:20}}/>
                <div style={{display:"flex",flexDirection:"column" as const,gap:10,marginBottom:28,flex:1}}>
                  {p.features.map((f,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10}}>
                      <span style={{color:C.success,fontSize:13,flexShrink:0,marginTop:1}}>✓</span>
                      <span style={{fontSize:13,color:"rgba(200,216,240,.8)",lineHeight:1.5}}>{f}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={p.id==="enterprise"
                    ? `https://minervaai-production-9c2d.up.railway.app/enterprise?uid=${session?.user?.id}`
                    : `https://minervaai-production-9c2d.up.railway.app/checkout?plan=${p.id}&uid=${session?.user?.id}&email=${encodeURIComponent(session?.user?.email||"")}`}
                  style={{display:"block",textAlign:"center" as const,padding:"14px",borderRadius:12,fontSize:14,fontWeight:700,textDecoration:"none",background:p.featured?C.blueMain:"transparent",color:p.featured?"#fff":"rgba(200,216,240,.7)",border:p.featured?"none":"1px solid rgba(255,255,255,.15)",transition:"all .2s",fontFamily:"inherit"}}
                  onMouseEnter={e=>{if(!p.featured)(e.currentTarget as any).style.borderColor="rgba(255,255,255,.4)";}}
                  onMouseLeave={e=>{if(!p.featured)(e.currentTarget as any).style.borderColor="rgba(255,255,255,.15)";}}
                >{p.cta}</a>
              </div>
            ))}
          </div>

          <p style={{marginTop:32,fontSize:12,color:"rgba(200,216,240,.3)",fontFamily:"'JetBrains Mono',monospace"}}>Todos los planes incluyen acceso completo a la plataforma. Cancela cuando quieras.</p>
        </div>
      </div>
    </div>
  );
}

