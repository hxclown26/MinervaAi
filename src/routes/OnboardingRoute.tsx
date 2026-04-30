import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { sb } from "../lib/supabase";
import { C, COUNTRIES, INDUSTRIES } from "../lib/constants";
import { AuthHeader } from "../components/AuthHeader";

// ── ONBOARDING ROUTE ───────────────────────────────────────────────
export function OnboardingRoute() {
  const { session, subscription, refresh, navigate } = useAuth();
  const [empresa, setEmpresa] = useState(""); const [pais, setPais] = useState(""); const [giro, setGiro] = useState(""); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const sel = { width:"100%", padding:"11px 14px", borderRadius:10, fontSize:13, border:`1.5px solid ${C.lightBorder}`, background:C.lightCard, color:C.textDark, fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const };

  if (!session) { navigate("login"); return null; }

  const handleSave = async () => {
    if (!empresa.trim()) { setErr("Ingresa el nombre de tu empresa"); return; }
    if (!pais) { setErr("Selecciona tu país"); return; }
    if (!giro) { setErr("Selecciona el giro"); return; }
    setLoading(true);
    try {
      await sb.upsertProfile(session.access_token, session.user.id, {
        empresa, pais, giro, onboarding_done:true, profile_completed:true
      });
      await refresh();
      navigate(subscription ? "dashboard" : "pricing");
    } catch { setErr("Error al guardar. Intenta nuevamente."); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.lightBg,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');*{box-sizing:border-box}`}</style>
      <AuthHeader step={1} theme="light"/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px",minHeight:"calc(100vh - 54px)"}}>
        <div style={{width:"100%",maxWidth:460}}>
          <div style={{background:C.lightCard,borderRadius:20,padding:"40px 36px",border:`1px solid ${C.lightBorder}`,boxShadow:"0 4px 40px rgba(0,0,0,.06)"}}>
            <div style={{fontSize:22,fontWeight:800,color:C.textDark,letterSpacing:"-.03em",marginBottom:6}}>Cuéntanos sobre<br/>tu empresa</div>
            <div style={{fontSize:13,color:C.textGray,lineHeight:1.6,marginBottom:24}}>3 datos que personalizan todos los agentes de tus simulaciones.</div>
            {err&&<div style={{padding:"9px 13px",borderRadius:8,marginBottom:14,fontSize:12,background:C.error+"10",border:`1px solid ${C.error}30`,color:C.error}}>{err}</div>}
            <div style={{marginBottom:12}}><label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>NOMBRE DE TU EMPRESA</label><input value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Ej: Soluciones Industriales..." style={{...sel,appearance:"none" as any}} onFocus={e=>(e.target.style.borderColor=C.blueMain)} onBlur={e=>(e.target.style.borderColor=C.lightBorder)}/></div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>PAÍS DE OPERACIÓN</label><select value={pais} onChange={e=>setPais(e.target.value)} style={sel}><option value="">Selecciona un país...</option>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            <div style={{marginBottom:28}}><label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>GIRO DE TU EMPRESA</label><select value={giro} onChange={e=>setGiro(e.target.value)} style={sel}><option value="">Selecciona un giro...</option>{INDUSTRIES.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
            <button onClick={handleSave} disabled={loading} style={{width:"100%",padding:"14px",background:C.textDark,border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",opacity:loading?.7:1}}>
              {loading?"Guardando...":"Continuar → Elegir plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

