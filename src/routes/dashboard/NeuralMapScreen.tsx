import { C, NODE_TYPES } from "../../lib/constants";
import { ContextBar } from "../../components/ContextBar";
import { NeuralMapSVG } from "../../components/NeuralMapSVG";
import { Tag } from "../../components/Tag";

// ── NEURAL MAP SCREEN ──────────────────────────────────────────────
export function NeuralMapScreen({ market, model, clientData, weights, onWeightChange }:any) {
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <ContextBar market={market} model={model} offerName={clientData?.offerName}/>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:6,textTransform:"uppercase" as const}}>Paso 4 de 5</div>
      <div style={{fontSize:"clamp(20px,4vw,30px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1,marginBottom:6}}>Mapa Neural de Influencia</div>
      <div style={{fontSize:13,color:C.textGray,marginBottom:22,lineHeight:1.6}}>Ajusta el peso de influencia de cada stakeholder según tu conocimiento del cliente. Los porcentajes afectan directamente los prompts de los agentes.</div>

      <div style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:16,padding:20,marginBottom:20,boxShadow:"0 2px 12px rgba(0,0,0,.05)"}}>
        <NeuralMapSVG model={model} weights={weights} activeId={null}/>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,marginBottom:20}}>
        {Object.entries(NODE_TYPES).map(([k,v]:any)=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 11px",background:v.color+"10",border:`1px solid ${v.color}28`,borderRadius:20}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:v.color}}/>
            <span style={{color:v.color,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{v.label}</span>
          </div>
        ))}
      </div>

      <div style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:14,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.blueMain,letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:16}}>Calibrar pesos de influencia</div>
        {model.stakeholders.map((s:any)=>{
          const nt=NODE_TYPES[s.type];
          const w=weights[s.id]!==undefined?weights[s.id]:s.weight;
          return (
            <div key={s.id} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${C.lightBorder2}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:nt.color,flexShrink:0}}/>
                  <span style={{color:C.textDark,fontSize:12,fontWeight:600}}>{s.name}</span>
                  <Tag color={nt.color} small>{nt.label}</Tag>
                </div>
                <span style={{color:nt.color,fontSize:16,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{w}%</span>
              </div>
              <input type="range" min={5} max={100} value={w}
                onChange={e=>onWeightChange(s.id,Number(e.target.value))}
                style={{width:"100%",accentColor:nt.color,height:4,cursor:"pointer"}}/>
              <div style={{fontSize:10,color:C.textGray,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{s.trigger}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

