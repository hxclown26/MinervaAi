import { C, MODELS } from "../../lib/constants";
import { ContextBar } from "../../components/ContextBar";
import { Tag } from "../../components/Tag";

// ── MODEL SCREEN ───────────────────────────────────────────────────
export function ModelScreen({ market, selected, onSelect, customModel, onCustomModel }:any) {
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <ContextBar market={market} model={null} offerName={null}/>
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:8,textTransform:"uppercase" as const}}>Paso 2 de 5</div>
        <div style={{fontSize:"clamp(22px,4vw,32px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1,marginBottom:8}}>¿Cómo vas a generar<br/>valor en esta cuenta?</div>
        <div style={{fontSize:14,color:C.textGray,lineHeight:1.6}}>El modelo define el mapa de stakeholders, los agentes y el blueprint de propuesta.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(275px,1fr))",gap:14,marginBottom:14}}>
        {Object.values(MODELS).map((m:any)=>{
          const sel=selected?.id===m.id;
          return <div key={m.id} onClick={()=>onSelect(m)} style={{background:sel?m.accent+"0e":C.lightCard,border:`2px solid ${sel?m.accent:C.lightBorder}`,borderRadius:16,padding:24,cursor:"pointer",transition:"all .18s",boxShadow:sel?`0 0 0 4px ${m.accent}14`:"none"}} onMouseEnter={e=>{if(!sel)(e.currentTarget as any).style.borderColor=m.accent+"66";}} onMouseLeave={e=>{if(!sel)(e.currentTarget as any).style.borderColor=C.lightBorder;}}>
            <div style={{fontSize:30,marginBottom:11}}>{m.icon}</div>
            <Tag color={m.accent}>{m.badge}</Tag>
            <div style={{fontSize:16,fontWeight:800,color:C.textDark,margin:"10px 0 6px"}}>{m.name}</div>
            <div style={{fontSize:12,color:C.textGray,lineHeight:1.6,marginBottom:14}}>{m.tagline}</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap" as const,marginBottom:14}}>
              <Tag color={C.textHint} small>⏱ {m.timeToClose}</Tag>
              <Tag color={m.riskLevel==="BAJO"?"#059669":m.riskLevel==="ALTO"?"#DC2626":"#D97706"} small>Riesgo {m.riskLevel}</Tag>
            </div>
            <div style={{padding:"10px 12px",background:C.lightBg,borderRadius:8,borderLeft:`3px solid ${m.accent}`}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textHint,letterSpacing:".08em",marginBottom:3}}>TIPO DE DECISIÓN</div>
              <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:m.accent}}>{m.decisionType}</div>
            </div>
          </div>;
        })}
      </div>
      {selected?.id==="otro"&&(
        <div style={{marginBottom:14,animation:"mFadeUp .3s ease"}}>
          <label style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase" as const,fontFamily:"'JetBrains Mono',monospace",color:C.textGray,marginBottom:6,display:"block"}}>Describe tu modelo comercial</label>
          <textarea
            value={customModel||""}
            onChange={e=>onCustomModel(e.target.value)}
            rows={3}
            placeholder="Ej: Venta consultiva de soluciones de eficiencia energética con contratos anuales, modelo de ahorro garantizado, con ingeniería en campo durante implementación..."
            style={{width:"100%",padding:"12px 14px",borderRadius:10,fontSize:13,border:`1.5px solid ${C.lightBorder}`,background:C.lightCard,color:C.textDark,fontFamily:"inherit",outline:"none",resize:"vertical" as const,boxSizing:"border-box" as const,lineHeight:1.6}}
            onFocus={e=>(e.target.style.borderColor=C.blueMain)}
            onBlur={e=>(e.target.style.borderColor=C.lightBorder)}
          />
        </div>
      )}
      {selected&&<>
        <div style={{background:C.lightBg,border:`1px solid ${C.lightBorder}`,borderRadius:14,padding:20,marginBottom:12,animation:"mFadeUp .3s ease"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:selected.accent,letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:12}}>Blueprint — {selected.badge}</div>
          {selected.proposalSteps.map((ps:any,i:number)=><div key={i} style={{display:"flex",gap:11,alignItems:"flex-start",padding:"8px 0",borderBottom:i<selected.proposalSteps.length-1?`1px solid ${C.lightBorder2}`:"none"}}>
            <div style={{minWidth:22,height:22,borderRadius:"50%",flexShrink:0,background:selected.accent+"16",border:`1.5px solid ${selected.accent}`,color:selected.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{ps.n}</div>
            <div><div style={{fontSize:12,fontWeight:700,color:C.textDark,marginBottom:2}}>{ps.title}</div><div style={{fontSize:11,color:C.textGray,lineHeight:1.55}}>{ps.detail}</div></div>
          </div>)}
        </div>
        <div style={{background:C.lightBg,border:`1px solid #FCA5A520`,borderRadius:14,padding:"14px 18px",animation:"mFadeUp .35s ease"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#DC2626",letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:9}}>Objeciones típicas</div>
          {selected.objections.map((o:string,i:number)=><div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<selected.objections.length-1?`1px solid ${C.lightBorder2}`:"none"}}><span style={{color:"#DC2626",flexShrink:0}}>⚠</span><span style={{fontSize:12,color:C.textGray,lineHeight:1.6}}>{o}</span></div>)}
        </div>
      </>}
    </div>
  );
}

