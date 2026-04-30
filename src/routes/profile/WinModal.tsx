import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { sb } from "../../lib/supabase";
import { C } from "../../lib/constants";
import { formatMoney } from "../../lib/helpers";

export function WinModal({ sim, onClose, onSuccess }:any) {
  const { session } = useAuth();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    const n = parseFloat(amount.replace(/[^\d.,]/g,"").replace(/,/g,"."));
    if (!n || isNaN(n) || n <= 0) { setErr("Ingresa un monto válido"); return; }
    setLoading(true);
    try {
      const result = await sb.markSimulationWon(session!.access_token, sim.id, n);
      if (result?.message || result?.code) { setErr(result.message || "Error al marcar como ganada"); setLoading(false); return; }
      onSuccess();
    } catch { setErr("Error de conexión"); setLoading(false); }
  };

  const initialBudget = sim.budget_initial;

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:C.lightCard,borderRadius:14,padding:"28px 32px",maxWidth:420,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{fontSize:42,marginBottom:12,textAlign:"center" as const}}>🏆</div>
        <div style={{fontSize:18,fontWeight:800,color:C.textDark,letterSpacing:"-.02em",marginBottom:6,textAlign:"center" as const}}>¡Felicitaciones por el cierre!</div>
        <div style={{fontSize:12,color:C.textGray,marginBottom:18,textAlign:"center" as const,lineHeight:1.6}}>
          Para mantener la transparencia de tu pipeline, ingresa el monto real con el que cerraste.
        </div>
        {initialBudget && (
          <div style={{padding:"10px 14px",background:C.lightBg,borderRadius:8,marginBottom:14,fontSize:12,color:C.textGray}}>
            Monto inicial estimado: <strong style={{color:C.textDark}}>{formatMoney(initialBudget)}</strong>
          </div>
        )}
        <label style={{fontSize:11,color:C.textGray,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em",display:"block",marginBottom:5}}>MONTO FINAL CERRADO</label>
        <input
          type="text"
          value={amount}
          onChange={e=>setAmount(e.target.value)}
          placeholder="Ej: 8000000 o 8,5M"
          autoFocus
          style={{width:"100%",padding:"12px 14px",borderRadius:10,border:`1.5px solid ${C.lightBorder}`,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box" as const,marginBottom:6}}
          onFocus={e=>(e.target.style.borderColor=C.success)}
          onBlur={e=>(e.target.style.borderColor=C.lightBorder)}
          onKeyDown={e=>e.key==="Enter"&&submit()}
        />
        <div style={{fontSize:10,color:C.textHint,marginBottom:18,fontFamily:"'JetBrains Mono',monospace"}}>Ingresa solo el número (sin símbolos)</div>
        {err && <div style={{padding:"8px 12px",background:C.error+"15",border:`1px solid ${C.error}40`,borderRadius:8,fontSize:11,color:C.error,marginBottom:14}}>{err}</div>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} disabled={loading} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.lightBorder}`,borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:C.textGray}}>Cancelar</button>
          <button onClick={submit} disabled={loading} style={{flex:2,padding:"11px",background:loading?C.lightBorder:C.success,border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13}}>
            {loading?"Guardando...":"Confirmar venta ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

