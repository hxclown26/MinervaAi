import { C } from "../../lib/constants";
import { ContextBar } from "../../components/ContextBar";

// ── CLIENT SCREEN ──────────────────────────────────────────────────
export function ClientScreen({ market, model, data, onChange }:any) {
  const inp:any = { background:C.lightCard, border:`1px solid ${C.lightBorder}`, color:C.textDark, borderRadius:8, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color .15s" };
  const lbl:any = { fontSize:10, letterSpacing:".08em", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", color:C.textGray, marginBottom:6, display:"block" };
  const upd = (k:string) => (e:any) => onChange({...data,[k]:e.target.value});
  const focus = (e:any) => e.target.style.borderColor=C.blueMain;
  const blur  = (e:any) => e.target.style.borderColor=C.lightBorder;
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <ContextBar market={market} model={model} offerName={data.offerName}/>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:8,textTransform:"uppercase" as const}}>Paso 3 de 5</div>
        <div style={{fontSize:"clamp(22px,4vw,32px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1}}>Cuéntame sobre el cliente<br/>y la propuesta</div>
      </div>
      <div style={{marginBottom:18,padding:"16px 18px",borderRadius:14,background:`${model.accent}07`,border:`1.5px solid ${model.accent}30`}}>
        <label style={{...lbl,color:model.accent}}>Nombre comercial de la propuesta</label>
        <input value={data.offerName||""} onChange={upd("offerName")} placeholder="Ej: Programa Integral, Contrato 360..." style={{...inp,fontSize:14,padding:"12px 16px",fontWeight:600,border:`1.5px solid ${model.accent}30`}} onFocus={e=>(e.target.style.borderColor=model.accent)} onBlur={e=>(e.target.style.borderColor=`${model.accent}30`)}/>
        <div style={{fontSize:10,color:C.textHint,marginTop:5,fontFamily:"'JetBrains Mono',monospace"}}>Este nombre alimenta todos los prompts de agentes y el informe final</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><label style={lbl}>Nombre del cliente</label><input value={data.name||""} onChange={upd("name")} placeholder="Ej: Empresa del Norte S.A." style={inp} onFocus={focus} onBlur={blur}/></div>
        <div><label style={lbl}>Sector específico</label><input value={data.sector||""} onChange={upd("sector")} placeholder={market.shortDesc.split("·")[0].trim()+"..."} style={inp} onFocus={focus} onBlur={blur}/></div>
      </div>
      <div style={{marginBottom:12}}><label style={lbl}>Situación actual del cliente</label><textarea value={data.situation||""} onChange={upd("situation")} rows={2} placeholder={`Ej: Tiene proveedor consolidado. Contexto: ${market.keywords[0]}...`} style={{...inp,resize:"vertical" as const}} onFocus={focus} onBlur={blur}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <div><label style={lbl}>Valor de la oportunidad</label><input value={data.budget||""} onChange={upd("budget")} placeholder="Ej: USD 120K, MM$ 85, €50K..." style={inp} onFocus={focus} onBlur={blur}/></div>
        <div><label style={lbl}>Principal dolor del cliente</label><input value={data.pain||""} onChange={upd("pain")} placeholder={market.keywords[1]||"variabilidad de costos..."} style={inp} onFocus={focus} onBlur={blur}/></div>
      </div>
      <div style={{padding:"16px 18px",borderRadius:14,background:C.gold+"08",border:`1.5px solid ${C.gold}40`,marginBottom:18}}>
        <label style={{...lbl,color:C.gold,marginBottom:8}}>📅 Fecha estimada de cierre · Compromiso del vendedor</label>
        <input
          type="date"
          value={data.estimatedClose||""}
          onChange={upd("estimatedClose")}
          min={new Date(Date.now()+86400000).toISOString().split("T")[0]}
          style={{...inp,fontSize:14,padding:"12px 16px",fontWeight:600,border:`1.5px solid ${C.gold}40`,colorScheme:"light"}}
          onFocus={e=>(e.target.style.borderColor=C.gold)}
          onBlur={e=>(e.target.style.borderColor=`${C.gold}40`)}
        />
        <div style={{fontSize:10,color:C.textHint,marginTop:5,fontFamily:"'JetBrains Mono',monospace",lineHeight:1.5}}>
          ⚠ Si llega la fecha y no marcas resultado, la simulación pasará a estado ATRASADA
        </div>
      </div>
      <div style={{background:C.lightBg,border:`1px solid ${market.accent}24`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:market.accent,letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:7}}>{market.icon} Contexto del mercado — {market.name}</div>
        <div style={{fontSize:12,color:C.textGray,lineHeight:1.65,marginBottom:9}}>{market.context}</div>
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>{market.keywords.map((k:string,i:number)=><span key={i} style={{padding:"2px 9px",borderRadius:20,fontSize:10,fontFamily:"'JetBrains Mono',monospace",background:market.accent+"12",color:market.accent,border:`1px solid ${market.accent}28`}}>{k}</span>)}</div>
      </div>
    </div>
  );
}

