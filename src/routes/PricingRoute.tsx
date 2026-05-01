import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { sb } from "../lib/supabase";
import { C, PLANS } from "../lib/constants";
import { planLabel } from "../lib/helpers";
import { AuthHeader } from "../components/AuthHeader";
import { QuoteRequestModal } from "./QuoteRequestModal";
 
export function PricingRoute() {
  const { session, profile, subscription, refresh, navigate } = useAuth();
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState<string|null>(null);
  const [quoteModal, setQuoteModal] = useState<"pyme"|"enterprise"|null>(null);
  const [billingPref, setBillingPref] = useState<"monthly"|"annual">("monthly");
 
  useEffect(() => {
    if (!session) navigate("login");
    else if (!profile?.profile_completed) navigate("onboarding");
  }, [session, profile]);
 
  if (!session || !profile?.profile_completed) return null;
 
  const hasActiveSubscription = !!subscription && subscription.status === "active";
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
 
  const startCheckout = async (planId:string) => {
    if (!session?.user?.email) return;
    setCheckoutLoading(planId);
    try {
      const plan:any = (PLANS as any)[planId];
      const result = await sb.startCheckout({
        email: session.user.email,
        name: profile?.empresa || session.user.email,
        planId: plan.flow_plan_id,
        couponId: plan.coupon_id || null,
        appPlanCode: planId,
        userId: session.user.id,
      });
      if (result?.registerUrl) {
        window.location.href = result.registerUrl;
      } else {
        alert(result?.error || "No pudimos iniciar el pago. Intenta nuevamente.");
        setCheckoutLoading(null);
      }
    } catch {
      alert("Error de conexión. Intenta nuevamente.");
      setCheckoutLoading(null);
    }
  };
 
  // Tarjetas a mostrar según preferencia mensual/anual
  const visiblePaidPlans = billingPref === "monthly"
    ? [PLANS.starter_monthly, PLANS.imperium_monthly]
    : [PLANS.starter_annual, PLANS.imperium_annual];
 
  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(180deg, ${C.darkBg} 0%, #0F2545 60%)`,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');@keyframes pFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}*{box-sizing:border-box}`}</style>
      <AuthHeader theme="dark"/>
 
      <div style={{padding:"40px 24px 80px"}}>
        <div style={{maxWidth:1100,margin:"0 auto",textAlign:"center" as const}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.nodeCyan,letterSpacing:".18em",textTransform:"uppercase" as const,marginBottom:12}}>Elige tu plan</div>
          <h1 style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:800,letterSpacing:"-.04em",color:C.textLight,margin:"0 0 10px",lineHeight:1.1}}>Simple, transparente,<br/>sin sorpresas.</h1>
          <p style={{fontSize:15,color:C.textLight,opacity:.5,marginBottom:32}}>Un vendedor que cierra una sola venta adicional al mes paga el plan 50 veces.</p>
 
          {/* Banner Free Trial */}
          {canStartTrial && (
            <div style={{
              background:"linear-gradient(135deg, rgba(0,168,255,.15), rgba(0,102,204,.08))",
              border:`1.5px solid ${C.nodeCyan}55`,
              borderRadius:16,
              padding:"22px 26px",
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
                <div style={{fontSize:20,fontWeight:800,color:C.textLight,marginBottom:6,letterSpacing:"-.02em"}}>Probá gratis 7 días</div>
                <div style={{fontSize:13,color:"rgba(200,216,240,.7)",lineHeight:1.5}}>5 simulaciones completas con todos los agentes. Sin tarjeta de crédito.</div>
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
 
          {/* Toggle Mensual / Anual */}
          <div style={{display:"inline-flex",background:"rgba(255,255,255,.06)",border:`1px solid ${C.nodeCyan}33`,borderRadius:980,padding:4,marginBottom:24}}>
            {(["monthly","annual"] as const).map(p => (
              <button
                key={p}
                onClick={()=>setBillingPref(p)}
                style={{
                  padding:"8px 22px",
                  border:"none",
                  background: billingPref === p ? C.nodeCyan : "transparent",
                  color: billingPref === p ? "#000" : C.textLight,
                  fontSize:12, fontWeight:700,
                  borderRadius:980, cursor:"pointer",
                  fontFamily:"'JetBrains Mono',monospace",
                  letterSpacing:".05em",
                  transition:"all .15s"
                }}
              >
                {p === "monthly" ? "MENSUAL" : "ANUAL · -16%"}
              </button>
            ))}
          </div>
 
          {/* Tarjetas de planes pagos (Starter + Imperium) */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:18,marginBottom:36}}>
            {visiblePaidPlans.map((plan:any)=>(
              <PlanCard
                key={plan.id}
                plan={plan}
                onCheckout={()=>startCheckout(plan.id)}
                loading={checkoutLoading === plan.id}
                disabled={hasActiveSubscription}
              />
            ))}
          </div>
 
          {/* Tarjetas de cotización (Pyme + Enterprise) */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:18,marginBottom:24}}>
            {[PLANS.pyme, PLANS.enterprise].map((plan:any)=>(
              <QuotePlanCard
                key={plan.id}
                plan={plan}
                onRequest={()=>setQuoteModal(plan.id)}
              />
            ))}
          </div>
 
          <p style={{marginTop:24,fontSize:11,color:"rgba(200,216,240,.4)",fontFamily:"'JetBrains Mono',monospace",lineHeight:1.7}}>
            Precios en USD referenciales. Facturación en CLP equivalente vía Flow. Cancelas cuando quieras.<br/>
            ¿Tienes preguntas? Escríbenos a <a href="mailto:hola@minervadeal.com" style={{color:C.nodeCyan,textDecoration:"none"}}>hola@minervadeal.com</a>
          </p>
        </div>
      </div>
 
      {/* Modal de cotización */}
      {quoteModal && (
        <QuoteRequestModal
          plan={quoteModal}
          onClose={()=>setQuoteModal(null)}
        />
      )}
    </div>
  );
}
 
// ── PLAN CARD (Starter / Imperium) ────────────────────────────────
function PlanCard({ plan, onCheckout, loading, disabled }:any) {
  const isImperium = plan.id.startsWith("imperium");
  const hasPromo = !!plan.promoUSD;
  const isAnnual = plan.period === "annual";
 
  return (
    <div style={{
      background: isImperium
        ? "linear-gradient(180deg, rgba(0,168,255,.12), rgba(11,72,148,.06))"
        : "rgba(255,255,255,.04)",
      border:`1.5px solid ${isImperium ? C.nodeCyan + "55" : "rgba(255,255,255,.12)"}`,
      borderRadius:16,
      padding:"24px 22px",
      textAlign:"left" as const,
      position:"relative" as const,
      transition:"all .2s",
      boxShadow: isImperium ? `0 8px 32px ${C.nodeCyan}15` : "none"
    }}>
      {plan.badge && (
        <div style={{
          position:"absolute" as const, top:-10, right:18,
          background:C.gold, color:"#000",
          fontSize:9, fontWeight:800, letterSpacing:".1em",
          padding:"4px 10px", borderRadius:980,
          fontFamily:"'JetBrains Mono',monospace"
        }}>{plan.badge.toUpperCase()}</div>
      )}
 
      <div style={{fontSize:11,color:isImperium?C.nodeCyan:"rgba(200,216,240,.5)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".15em",marginBottom:6}}>
        {plan.name.toUpperCase()}{isAnnual?" · ANUAL":""}
      </div>
      <div style={{fontSize:13,color:"rgba(200,216,240,.7)",marginBottom:18,lineHeight:1.4}}>{plan.tagline}</div>
 
      <div style={{marginBottom:20,minHeight:80}}>
        {hasPromo ? (
          <>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
              <span style={{fontSize:32,fontWeight:800,color:C.textLight,letterSpacing:"-.03em"}}>${plan.promoUSD}</span>
              <span style={{fontSize:13,color:"rgba(200,216,240,.5)"}}>USD/mes</span>
            </div>
            <div style={{fontSize:11,color:C.gold,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".04em"}}>
              50% OFF × {plan.promoMonths} meses · luego ${plan.priceUSD}/mes
            </div>
            <div style={{fontSize:10,color:"rgba(200,216,240,.4)",marginTop:4}}>
              ≈ ${plan.promoCLP.toLocaleString("es-CL")} CLP/mes (luego ${plan.priceCLP.toLocaleString("es-CL")} CLP)
            </div>
          </>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:4}}>
              <span style={{fontSize:32,fontWeight:800,color:C.textLight,letterSpacing:"-.03em"}}>${plan.priceUSD}</span>
              <span style={{fontSize:13,color:"rgba(200,216,240,.5)"}}>USD/año</span>
            </div>
            <div style={{fontSize:11,color:C.success,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".04em"}}>
              Equivale a ${(plan.priceUSD/12).toFixed(2)}/mes
            </div>
            <div style={{fontSize:10,color:"rgba(200,216,240,.4)",marginTop:4}}>
              ≈ ${plan.priceCLP.toLocaleString("es-CL")} CLP
            </div>
          </>
        )}
      </div>
 
      <ul style={{listStyle:"none",padding:0,margin:"0 0 22px",fontSize:12,color:"rgba(200,216,240,.85)",lineHeight:1.7}}>
        {plan.features.map((f:string,i:number)=>(
          <li key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
            <span style={{color:isImperium?C.nodeCyan:C.success,flexShrink:0,marginTop:1}}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
 
      <button
        onClick={onCheckout}
        disabled={loading || disabled}
        style={{
          width:"100%",
          padding:"13px",
          background: disabled ? "rgba(255,255,255,.05)" : (loading ? "rgba(0,168,255,.4)" : (isImperium ? C.nodeCyan : C.textLight)),
          color: disabled ? "rgba(200,216,240,.4)" : (isImperium ? "#000" : C.textDark),
          border:"none",
          borderRadius:10,
          fontSize:13,fontWeight:700,
          cursor: (loading || disabled) ? "not-allowed" : "pointer",
          fontFamily:"inherit",
          letterSpacing:".02em",
          transition:"all .15s"
        }}
      >
        {disabled ? "Plan activo" : (loading ? "Redirigiendo a Flow..." : `${plan.cta} →`)}
      </button>
    </div>
  );
}
 
// ── QUOTE PLAN CARD (Pyme / Enterprise) ───────────────────────────
function QuotePlanCard({ plan, onRequest }:any) {
  return (
    <div style={{
      background:"rgba(255,255,255,.03)",
      border:`1px solid rgba(255,255,255,.1)`,
      borderRadius:16,
      padding:"22px 22px",
      textAlign:"left" as const,
    }}>
      <div style={{fontSize:11,color:"rgba(200,216,240,.5)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".15em",marginBottom:6}}>
        {plan.name}
      </div>
      <div style={{fontSize:13,color:"rgba(200,216,240,.7)",marginBottom:18,lineHeight:1.4}}>{plan.tagline}</div>
 
      <div style={{marginBottom:18,minHeight:80,display:"flex",alignItems:"center"}}>
        <div>
          <div style={{fontSize:24,fontWeight:800,color:C.textLight,letterSpacing:"-.02em",marginBottom:4}}>A medida</div>
          <div style={{fontSize:11,color:"rgba(200,216,240,.5)",fontFamily:"'JetBrains Mono',monospace"}}>Conversamos tu caso</div>
        </div>
      </div>
 
      <ul style={{listStyle:"none",padding:0,margin:"0 0 22px",fontSize:12,color:"rgba(200,216,240,.85)",lineHeight:1.7}}>
        {plan.features.map((f:string,i:number)=>(
          <li key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
            <span style={{color:"rgba(200,216,240,.4)",flexShrink:0,marginTop:1}}>·</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
 
      <button
        onClick={onRequest}
        style={{
          width:"100%",
          padding:"13px",
          background:"transparent",
          border:`1px solid ${C.nodeCyan}66`,
          borderRadius:10,
          color:C.nodeCyan,
          fontSize:13,fontWeight:700,
          cursor:"pointer",
          fontFamily:"inherit",
          letterSpacing:".02em",
          transition:"all .15s"
        }}
        onMouseEnter={(e:any)=>{e.currentTarget.style.background=`${C.nodeCyan}15`;e.currentTarget.style.borderColor=C.nodeCyan;}}
        onMouseLeave={(e:any)=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=`${C.nodeCyan}66`;}}
      >
        {plan.cta} →
      </button>
    </div>
  );
}