import { C, MARKETS } from "../../lib/constants";

// ── MARKET SCREEN ──────────────────────────────────────────────────
export function MarketScreen({ selected, onSelect, customContext, onCustomContext }:any) {
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:8,textTransform:"uppercase" as const}}>Paso 1 de 5</div>
        <div style={{fontSize:"clamp(22px,4vw,32px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1,marginBottom:8}}>¿En qué industria opera<br/>tu cliente?</div>
        <div style={{fontSize:14,color:C.textGray,lineHeight:1.6}}>Selecciona el mercado para adaptar los agentes y el contexto de la simulación.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(188px,1fr))",gap:10}}>
        {Object.values(MARKETS).map((m:any)=>{
          const sel=selected?.id===m.id;
          return <div key={m.id} onClick={()=>onSelect(m)} style={{background:sel?m.accent+"12":C.lightCard,border:`2px solid ${sel?m.accent:C.lightBorder}`,borderRadius:14,padding:"18px 16px",cursor:"pointer",transition:"all .18s",boxShadow:sel?`0 0 0 4px ${m.accent}16`:"none"}} onMouseEnter={e=>{if(!sel){(e.currentTarget as any).style.borderColor=m.accent+"70";(e.currentTarget as any).style.background=m.accent+"08";}}} onMouseLeave={e=>{if(!sel){(e.currentTarget as any).style.borderColor=C.lightBorder;(e.currentTarget as any).style.background=C.lightCard;}}}>
            <div style={{fontSize:26,marginBottom:9}}>{m.icon}</div>
            <div style={{fontSize:13,fontWeight:700,color:C.textDark,marginBottom:4}}>{m.name}</div>
            <div style={{fontSize:11,color:C.textGray,lineHeight:1.5}}>{m.shortDesc}</div>
            {sel&&<div style={{marginTop:9,display:"inline-flex",alignItems:"center",gap:5,padding:"2px 9px",borderRadius:20,background:m.accent,color:"#fff",fontSize:9,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>✓ SELECCIONADO</div>}
          </div>;
        })}
      </div>
      {selected?.id==="otro"&&(
        <div style={{marginTop:16,animation:"mFadeUp .3s ease"}}>
          <label style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase" as const,fontFamily:"'JetBrains Mono',monospace",color:C.textGray,marginBottom:6,display:"block"}}>Describe el mercado / contexto del cliente</label>
          <textarea
            value={customContext||""}
            onChange={e=>onCustomContext(e.target.value)}
            rows={3}
            placeholder="Ej: Empresa constructora con proyectos en minería y obras civiles, alta presión en costos y plazos, decisiones centralizadas en gerencia de proyectos..."
            style={{width:"100%",padding:"12px 14px",borderRadius:10,fontSize:13,border:`1.5px solid ${C.lightBorder}`,background:C.lightCard,color:C.textDark,fontFamily:"inherit",outline:"none",resize:"vertical" as const,boxSizing:"border-box" as const,lineHeight:1.6}}
            onFocus={e=>(e.target.style.borderColor=C.blueMain)}
            onBlur={e=>(e.target.style.borderColor=C.lightBorder)}
          />
        </div>
      )}
    </div>
  );
}

