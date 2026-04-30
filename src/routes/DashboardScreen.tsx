import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { C } from "../lib/constants";
import { canSimulate, planLabel } from "../lib/helpers";
import { AppHeader } from "../components/AppHeader";
import { MarketScreen } from "./dashboard/MarketScreen";
import { ModelScreen } from "./dashboard/ModelScreen";
import { ClientScreen } from "./dashboard/ClientScreen";
import { NeuralMapScreen } from "./dashboard/NeuralMapScreen";
import { SimulationScreen } from "./dashboard/SimulationScreen";

// ── DASHBOARD SCREEN ───────────────────────────────────────────────
export function DashboardScreen() {
  const { session, profile, subscription, signOut, navigate } = useAuth();

  const [simScreen, setSimScreen]   = useState("market");
  const [market,    setMarket]      = useState<any>(null);
  const [model,     setModel]       = useState<any>(null);
  const [clientData,setClientData]  = useState({offerName:"",name:"",sector:"",situation:"",budget:"",pain:"",estimatedClose:""});
  const [weights,   setWeights]     = useState<any>({});
  const [marketCustomContext, setMarketCustomContext] = useState("");
  const [modelCustomDesc,     setModelCustomDesc]     = useState("");

  if (!session) { navigate("login"); return null; }
  if (!profile?.profile_completed) { navigate("onboarding"); return null; }
  if (!subscription) { navigate("pricing"); return null; }

  const SCREENS = ["market","model","client","neural","sim"];
  const step = SCREENS.indexOf(simScreen);

  const handleSignOut = async () => { await signOut(); };

  const handleMarketSelect = (m:any) => {
    const withCtx = m.id==="otro" ? {...m, customContext: marketCustomContext} : m;
    setMarket(withCtx); setSimScreen("model");
  };
  const handleModelSelect = (m:any) => {
    const withDesc = m.id==="otro" ? {...m, customModelDesc: modelCustomDesc} : m;
    setModel(withDesc);
    const initW:any = {};
    withDesc.stakeholders.forEach((s:any) => { initW[s.id]=s.weight; });
    setWeights(initW); setSimScreen("client");
  };
  const handleWeightChange = (id:string, val:number) => setWeights((p:any)=>({...p,[id]:val}));

  const canNext = () => {
    if (simScreen==="market") return !!market;
    if (simScreen==="model")  return !!model;
    if (simScreen==="client") return !!(clientData.offerName && clientData.estimatedClose);
    if (simScreen==="neural") return true;
    return false;
  };
  const goNext = () => {
    if (!canNext()) return;
    if (simScreen==="market" && market?.id==="otro") setMarket((m:any)=>({...m,customContext:marketCustomContext}));
    if (simScreen==="model"  && model?.id==="otro")  setModel((m:any)=>({...m,customModelDesc:modelCustomDesc}));
    const idx = SCREENS.indexOf(simScreen);
    if (idx<SCREENS.length-1) setSimScreen(SCREENS[idx+1]);
  };
  const goBack = () => { const idx=SCREENS.indexOf(simScreen); if(idx>0) setSimScreen(SCREENS[idx-1]); };
  const goToStep = (i:number) => { if(i<step) setSimScreen(SCREENS[i]); };

  const nextLabel = simScreen==="market"?"Continuar → Modelo":simScreen==="model"?"Continuar → Datos del cliente":simScreen==="client"?"Ver Mapa Neural →":simScreen==="neural"?"Iniciar Simulación →":"";

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
    @keyframes mFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes mFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${C.lightBg}}
    input::placeholder,textarea::placeholder{color:${C.textHint}}
    select option{color:${C.textDark}}
    ::-webkit-scrollbar{width:0}
    input:focus,textarea:focus,select:focus{outline:none}
  `;

  return (
    <div style={{minHeight:"100vh",background:C.lightBg,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{STYLES}</style>
      <AppHeader step={step} onNav={goToStep} user={session?.user} onSignOut={handleSignOut}/>

      {profile?.empresa&&(
        <div style={{background:C.lightCard,borderBottom:`1px solid ${C.lightBorder}`,padding:"7px 28px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:C.textGray,fontFamily:"'JetBrains Mono',monospace"}}>SIMULANDO COMO</span>
          <span style={{fontSize:11,fontWeight:700,color:C.textDark}}>{profile.empresa}</span>
          <span style={{fontSize:10,color:C.lightBorder}}>·</span>
          <span style={{fontSize:10,color:C.textGray}}>{profile.pais}</span>
          <span style={{fontSize:10,color:C.lightBorder}}>·</span>
          <span style={{fontSize:10,color:C.textGray}}>{profile.giro}</span>
          {subscription?.plan&&<><span style={{fontSize:10,color:C.lightBorder}}>·</span><span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:C.blueMain,background:C.blueMain+"12",border:`1px solid ${C.blueMain}22`,padding:"1px 8px",borderRadius:20,textTransform:"uppercase" as const}}>{planLabel(subscription.plan)}</span></>}
          {profile?.is_master&&<span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:C.gold,background:C.gold+"15",border:`1px solid ${C.gold}40`,padding:"1px 8px",borderRadius:20,letterSpacing:".06em"}}>★ MASTER</span>}
        </div>
      )}

      {/* Banner de uso del plan — sólo si NO es master Y tiene contador */}
      {!profile?.is_master && subscription?.simulations_limit != null && (() => {
        const used = subscription.simulations_used || 0;
        const limit = subscription.simulations_limit;
        const pct = Math.min(100, (used/limit)*100);
        const remaining = Math.max(0, limit - used);
        const status = canSimulate(subscription, profile);
        const periodExpired = status.reason === "period_expired";
        const limitReached = status.reason === "limit_reached";
        const warning = limitReached || periodExpired;
        const barColor = warning ? C.error : pct >= 75 ? C.gold : C.success;
        const daysLeft = status.daysLeft;

        return (
          <div style={{background:warning?C.error+"08":C.lightBg,borderBottom:`1px solid ${warning?C.error+"30":C.lightBorder}`,padding:"10px 28px"}}>
            <div style={{maxWidth:860,margin:"0 auto",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap" as const}}>
              <div style={{flex:1,minWidth:220}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                  <span style={{fontSize:11,fontWeight:700,color:warning?C.error:C.textDark}}>
                    {periodExpired ? "Tu trial expiró"
                      : limitReached ? "Llegaste al límite del trial"
                      : `${used} de ${limit} simulaciones usadas`}
                  </span>
                  {daysLeft !== undefined && !periodExpired && (
                    <span style={{fontSize:10,color:C.textGray,fontFamily:"'JetBrains Mono',monospace"}}>
                      · {daysLeft} {daysLeft===1?"día restante":"días restantes"}
                    </span>
                  )}
                </div>
                <div style={{height:5,background:C.lightBorder2,borderRadius:20,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:barColor,borderRadius:20,transition:"width .3s"}}/>
                </div>
                {!warning && remaining <= 1 && (
                  <div style={{fontSize:10,color:C.textGray,marginTop:5}}>
                    {remaining === 0 ? "Sin simulaciones restantes" : "Te queda 1 simulación. Considera contratar un plan."}
                  </div>
                )}
              </div>
              <button onClick={()=>navigate("pricing")} style={{
                padding:"8px 16px",
                background:warning?C.error:"transparent",
                border:warning?"none":`1px solid ${C.lightBorder}`,
                color:warning?"#fff":C.textDark,
                borderRadius:8,fontSize:11,fontWeight:700,
                cursor:"pointer",fontFamily:"inherit",
                whiteSpace:"nowrap" as const
              }}>
                {warning ? "Ver planes →" : "Hacer upgrade"}
              </button>
            </div>
          </div>
        );
      })()}

      <div style={{maxWidth:860,margin:"0 auto",padding:`0 24px ${simScreen==="sim"?"40px":"100px"}`}}>
        {simScreen==="market" && <MarketScreen selected={market} onSelect={handleMarketSelect} customContext={marketCustomContext} onCustomContext={setMarketCustomContext}/>}
        {simScreen==="model"  && <ModelScreen  market={market} selected={model} onSelect={handleModelSelect} customModel={modelCustomDesc} onCustomModel={setModelCustomDesc}/>}
        {simScreen==="client" && <ClientScreen market={market} model={model} data={clientData} onChange={setClientData}/>}
        {simScreen==="neural" && <NeuralMapScreen market={market} model={model} clientData={clientData} weights={weights} onWeightChange={handleWeightChange}/>}
        {simScreen==="sim"    && <SimulationScreen market={market} model={model} clientData={clientData} weights={weights} profile={profile}/>}
      </div>

      {simScreen!=="sim"&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.94)",backdropFilter:"saturate(180%) blur(20px)",WebkitBackdropFilter:"saturate(180%) blur(20px)",borderTop:`1px solid ${C.lightBorder}`,padding:"12px 28px"}}>
          <div style={{maxWidth:860,margin:"0 auto",display:"flex",gap:10}}>
            {step>0&&<button onClick={goBack} style={{padding:"12px 20px",background:"transparent",border:`1px solid ${C.lightBorder}`,color:C.textGray,borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← Volver</button>}
            {nextLabel&&<button onClick={goNext} disabled={!canNext()} style={{flex:1,padding:"13px 0",background:canNext()?C.textDark:C.lightBorder2,border:"none",borderRadius:10,color:canNext()?"#fff":C.textHint,fontSize:13,fontWeight:700,cursor:canNext()?"pointer":"not-allowed",fontFamily:"inherit",letterSpacing:"-.01em",transition:"all .2s"}}>{nextLabel}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

