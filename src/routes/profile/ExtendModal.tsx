import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { sb } from "../../lib/supabase";
import { C } from "../../lib/constants";
import { formatDate } from "../../lib/helpers";

export function ExtendModal({ sim, onClose, onSuccess }:any) {
  const { session } = useAuth();
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!date) { setErr("Selecciona una nueva fecha"); return; }
    setLoading(true);
    try {
      const result = await sb.extendSimulationDeadline(session!.access_token, sim.id, date);
      if (result?.message || result?.code) { setErr(result.message || "Error al extender"); setLoading(false); return; }
      onSuccess();
    } catch { setErr("Error de conexión"); setLoading(false); }
  };

  const minDate = new Date(Date.now()+86400000).toISOString().split("T")[0];

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:C.lightCard,borderRadius:14,padding:"28px 32px",maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:36,marginBottom:10,textAlign:"center" as const}}>📅</div>
        <div style={{fontSize:17,fontWeight:800,color:C.textDark,marginBottom:6,textAlign:"center" as const}}>Extender plazo</div>
        <div style={{fontSize:12,color:C.textGray,marginBottom:18,textAlign:"center" as const,lineHeight:1.6}}>
          Fecha original: <strong>{formatDate(sim.estimated_close)}</strong><br/>
          Asume el compromiso con una nueva fecha realista.
        </div>
        <label style={{fontSize:11,color:C.textGray,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em",display:"block",marginBottom:5}}>NUEVA FECHA DE CIERRE</label>
        <input
          type="date"
          value={date}
          min={minDate}
          onChange={e=>setDate(e.target.value)}
          style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.lightBorder}`,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const,marginBottom:18}}
        />
        {err && <div style={{padding:"8px 12px",background:C.error+"15",border:`1px solid ${C.error}40`,borderRadius:8,fontSize:11,color:C.error,marginBottom:14}}>{err}</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} disabled={loading} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.lightBorder}`,borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:C.textGray}}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{flex:2,padding:"11px",background:loading?C.lightBorder:C.gold,border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13}}>
            {loading?"Guardando...":"Confirmar nueva fecha"}
          </button>
        </div>
      </div>
    </div>
  );
}

