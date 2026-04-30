import { C, NODE_TYPES } from "../lib/constants";
import { Tag } from "./Tag";

// ── AGENT CARD ─────────────────────────────────────────────────────
export function AgentCard({ agent, response, isActive }:any) {
  return (
    <div style={{background:C.lightCard,border:`1px solid ${isActive?agent.accent:C.lightBorder}`,borderLeft:`4px solid ${agent.accent}`,borderRadius:12,padding:"16px 18px",boxShadow:isActive?`0 4px 20px ${agent.accent}20`:"0 1px 4px rgba(0,0,0,.04)",transition:"all .35s ease",marginBottom:12}}>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
        <div style={{width:40,height:40,borderRadius:9,fontSize:18,background:agent.accent+"12",border:`2px solid ${isActive?agent.accent:agent.accent+"44"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{isActive?"⚡":agent.icon}</div>
        <div style={{flex:1}}>
          <div style={{color:C.textDark,fontWeight:700,fontSize:13,fontFamily:"monospace"}}>{agent.name}</div>
          <div style={{color:agent.accent,fontSize:10,letterSpacing:".08em",textTransform:"uppercase" as const}}>{agent.company}</div>
        </div>
        <Tag color={agent.side==="cliente"?C.green:agent.side==="competidor"?C.red:C.blueMain} small>
          {agent.side==="cliente"?"CLIENTE":agent.side==="competidor"?"COMPETIDOR":"VENDEDOR"}
        </Tag>
      </div>
      {isActive&&<div style={{display:"flex",alignItems:"center",gap:8,color:agent.accent,fontSize:12,fontFamily:"monospace"}}><div style={{width:7,height:7,borderRadius:"50%",background:agent.accent,animation:"blink .7s infinite"}}/>Analizando escenario...</div>}
      {response&&!isActive&&<div style={{borderTop:`1px solid ${C.lightBorder2}`,paddingTop:11,color:C.textDark,fontSize:12.5,lineHeight:1.75,fontFamily:"'IBM Plex Sans',system-ui,sans-serif",whiteSpace:"pre-wrap" as const}}>{response}</div>}
    </div>
  );
}

