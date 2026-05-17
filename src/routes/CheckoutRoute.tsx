import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { sb } from "../lib/supabase";
import { C, PLANS } from "../lib/constants";
import { AuthHeader } from "../components/AuthHeader";

export function CheckoutRoute() {
  const { session, checkoutCtx, navigate } = useAuth();
  const planCode = checkoutCtx?.planCode;
  const plan: any = planCode ? (PLANS as any)[planCode] : null;

  const [couponInput,  setCouponInput]  = useState("");
  const [couponState,  setCouponState]  = useState<"idle"|"validating"|"valid"|"invalid">("idle");
  const [couponMsg,    setCouponMsg]    = useState("");
  const [discountPct,  setDiscountPct]  = useState(0);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string|null>(null);

  useEffect(() => {
    if (!session) navigate("login");
    else if (!plan) navigate("pricing");
  }, [session, plan]);

  if (!session || !plan) return null;

  const basePrice = plan.priceCLP;
  const isMonthly = plan.period === "monthly";
  const isAnnual  = plan.period === "annual";
  const finalFirstAmount = couponState === "valid"
    ? Math.round(basePrice * (1 - discountPct/100))
    : basePrice;

  const validateCoupon = async () => {
    if (!couponInput.trim() || !session.user?.id) return;
    setCouponState("validating");
    setCouponMsg("");
    try {
      const result = await sb.validateCoupon({
        code: couponInput.trim(),
        userId: session.user.id,
        planCode: plan.id,
      });
      if (result?.valid) {
        setCouponState("valid");
        setDiscountPct(result.discount_percent || 0);
        setCouponMsg(`✓ ${result.discount_percent}% OFF aplicado por ${result.duration_in_periods} meses`);
      } else {
        setCouponState("invalid");
        setDiscountPct(0);
        setCouponMsg(result?.error || "Código no válido");
      }
    } catch {
      setCouponState("invalid");
      setCouponMsg("Error validando el código");
    }
  };

  const goToPayment = async () => {
    if (!session?.access_token) return;
    setSubmitting(true); setError(null);
    try {
      const result = await sb.startCheckout(session.access_token, {
        appPlanCode: plan.id,
        couponCode: couponState === "valid" ? couponInput.trim() : null,
      });
      if (result?.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        setError(result?.message || result?.error || "No pudimos iniciar el pago");
        setSubmitting(false);
      }
    } catch {
      setError("Error de conexión");
      setSubmitting(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(180deg, ${C.darkBg} 0%, #0F2545 60%)`,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <AuthHeader theme="dark"/>

      <div style={{padding:"40px 24px 80px"}}>
        <div style={{maxWidth:560,margin:"0 auto"}}>

          <button
            onClick={()=>navigate("pricing")}
            style={{background:"none",border:"none",color:"rgba(200,216,240,.5)",cursor:"pointer",fontSize:13,fontFamily:"inherit",marginBottom:18}}
          >← Volver a planes</button>

          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.nodeCyan,letterSpacing:".18em",marginBottom:8}}>PASO 1 DE 2 · RESUMEN</div>
          <h1 style={{fontSize:28,fontWeight:800,letterSpacing:"-.03em",color:C.textLight,margin:"0 0 24px",lineHeight:1.2}}>
            Estás un paso de empezar<br/>con {plan.name}.
          </h1>

          {/* Card de resumen */}
          <div style={{background:"rgba(255,255,255,.04)",border:`1px solid ${C.darkBorder}`,borderRadius:14,padding:"22px 24px",marginBottom:18}}>

            {/* Plan elegido */}
            <div style={{paddingBottom:18,borderBottom:`1px solid ${C.darkBorder}`,marginBottom:18}}>
              <div style={{fontSize:11,color:"rgba(200,216,240,.5)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".12em",marginBottom:6}}>TU PLAN</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12}}>
                <div style={{fontSize:18,fontWeight:700,color:C.textLight}}>{plan.name}</div>
                <div style={{fontSize:14,color:"rgba(200,216,240,.7)"}}>${basePrice.toLocaleString("es-CL")} CLP{isMonthly?"/mes":"/año"}</div>
              </div>
              <div style={{fontSize:12,color:"rgba(200,216,240,.5)",marginTop:4}}>{plan.simulations} simulaciones por mes · cobro automático {isAnnual?"anual":"mensual"}</div>
            </div>

            {/* Cupón opcional */}
            {isMonthly && couponState !== "valid" && (
              <div style={{paddingBottom:18,borderBottom:`1px solid ${C.darkBorder}`,marginBottom:18}}>
                <div style={{fontSize:11,color:C.gold,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".12em",marginBottom:8}}>¿TIENES UN CÓDIGO DE BIENVENIDA?</div>
                <div style={{display:"flex",gap:8}}>
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e)=>{setCouponInput(e.target.value.toUpperCase());setCouponState("idle");setCouponMsg("");}}
                    placeholder="MINERVASTARTER2026"
                    disabled={couponState === "validating"}
                    style={{
                      flex:1,padding:"10px 12px",
                      background:"rgba(0,0,0,.25)",
                      border:`1px solid ${couponState==="invalid"?C.error:"rgba(255,255,255,.15)"}`,
                      borderRadius:8,
                      fontSize:13,color:C.textLight,outline:"none",
                      fontFamily:"'JetBrains Mono',monospace",letterSpacing:".05em"
                    }}
                  />
                  <button
                    onClick={validateCoupon}
                    disabled={!couponInput.trim() || couponState === "validating"}
                    style={{padding:"10px 18px",background:C.gold,border:"none",borderRadius:8,fontSize:12,fontWeight:700,color:"#000",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" as const}}
                  >{couponState === "validating" ? "..." : "Aplicar"}</button>
                </div>
                {couponMsg && couponState === "invalid" && (
                  <div style={{marginTop:8,fontSize:11,color:C.error,fontFamily:"'JetBrains Mono',monospace"}}>{couponMsg}</div>
                )}
                <div style={{marginTop:8,fontSize:11,color:"rgba(200,216,240,.4)"}}>Es opcional. Si no tenés, simplemente continuá al pago.</div>
              </div>
            )}

            {/* Cupón aplicado */}
            {couponState === "valid" && (
              <div style={{paddingBottom:18,borderBottom:`1px solid ${C.darkBorder}`,marginBottom:18,background:"rgba(255,193,7,.06)",padding:"14px 16px",borderRadius:10,border:`1px solid ${C.gold}33`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:C.gold,fontSize:14}}>✓</span>
                  <div>
                    <div style={{fontSize:13,color:C.textLight,fontWeight:600}}>Código aplicado: {couponInput}</div>
                    <div style={{fontSize:11,color:"rgba(200,216,240,.7)",marginTop:2}}>{couponMsg}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Desglose final */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                <span style={{fontSize:13,color:"rgba(200,216,240,.7)"}}>Precio normal:</span>
                <span style={{fontSize:13,color:"rgba(200,216,240,.5)",textDecoration:couponState==="valid"?"line-through":"none"}}>${basePrice.toLocaleString("es-CL")} CLP</span>
              </div>

              {couponState === "valid" && (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                    <span style={{fontSize:13,color:C.gold}}>Tu precio por 3 meses:</span>
                    <span style={{fontSize:16,color:C.gold,fontWeight:700}}>${finalFirstAmount.toLocaleString("es-CL")} CLP/mes</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(200,216,240,.5)",marginBottom:8,fontStyle:"italic" as const}}>
                    Después del mes 3: ${basePrice.toLocaleString("es-CL")} CLP/mes (precio normal)
                  </div>
                </>
              )}

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingTop:12,borderTop:`1px solid ${C.darkBorder}`}}>
                <span style={{fontSize:14,color:C.textLight,fontWeight:600}}>Hoy pagas:</span>
                <span style={{fontSize:22,fontWeight:800,color:couponState==="valid"?C.gold:C.textLight,letterSpacing:"-.02em"}}>
                  ${finalFirstAmount.toLocaleString("es-CL")} CLP
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div style={{padding:"12px 14px",background:C.error+"15",border:`1px solid ${C.error}40`,borderRadius:8,fontSize:13,color:C.error,marginBottom:14}}>
              {error}
            </div>
          )}

          {/* Disclaimer */}
          <div style={{fontSize:11,color:"rgba(200,216,240,.45)",lineHeight:1.6,marginBottom:18,padding:"12px 14px",background:"rgba(0,0,0,.2)",borderRadius:8}}>
            En el siguiente paso pondrás tu tarjeta de forma segura.<br/>
            Te cobraremos automáticamente cada {isAnnual?"año":"mes"} en la misma tarjeta. Podés cancelar cuando quieras desde tu cuenta.
          </div>

          <button
            onClick={goToPayment}
            disabled={submitting}
            style={{
              width:"100%",padding:"15px",
              background: submitting ? "rgba(0,168,255,.4)" : C.nodeCyan,
              color:"#000",border:"none",borderRadius:12,
              fontSize:14,fontWeight:700,
              cursor: submitting ? "not-allowed" : "pointer",
              fontFamily:"inherit",letterSpacing:".02em"
            }}
          >
            {submitting ? "Preparando pago..." : "Continuar al pago →"}
          </button>
        </div>
      </div>
    </div>
  );
}
