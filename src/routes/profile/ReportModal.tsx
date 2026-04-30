import { C } from "../../lib/constants";

// ── MODALES DEL PROFILE ────────────────────────────────────────────
export function ReportModal({ sim, onClose }:any) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:C.lightCard,borderRadius:14,padding:"24px 28px",maxWidth:680,width:"100%",maxHeight:"85vh",overflowY:"auto" as const,boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,gap:14}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:C.textDark,letterSpacing:"-.02em",marginBottom:3}}>{sim.offer_name || "Propuesta"}</div>
            <div style={{fontSize:12,color:C.textGray}}>{sim.client_name} · {sim.market_name} · {sim.model_name}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textGray,padding:4}}>✕</button>
        </div>
        <div style={{padding:"14px 16px",background:C.lightBg,borderRadius:10,fontSize:12,color:C.textDark,lineHeight:1.7,whiteSpace:"pre-wrap" as const,fontFamily:"'JetBrains Mono',monospace"}}>
          {sim.report || "Sin informe disponible"}
        </div>
      </div>
    </div>
  );
}

