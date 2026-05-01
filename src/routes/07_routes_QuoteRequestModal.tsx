import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";

export function QuoteRequestModal({ plan, onClose }:{ plan:"pyme"|"enterprise"; onClose:()=>void }) {
  const { session, profile } = useAuth();
  const [form, setForm] = useState({
    full_name: profile?.empresa || "",
    empresa: profile?.empresa || "",
    email: session?.user?.email || "",
    pais: profile?.pais || "Chile",
    telefono: "",
    cargo: "",
    team_size: "",
    use_case: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const upd = (k:string)=>(e:any)=>setForm({...form,[k]:e.target.value});

  const submit = async () => {
    setError("");
    if (!form.full_name || !form.email || !form.empresa) {
      setError("Por favor completa nombre, empresa y email");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("El formato del email no es válido");
      return;
    }
    setLoading(true);
    try {
      const result = await sb.submitQuoteRequest({
        ...form,
        plan_requested: plan,
        team_size: form.team_size ? parseInt(form.team_size,10) : null,
        user_id: session?.user?.id || null,
      });
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}}>
        <div onClick={(e:any)=>e.stopPropagation()} style={{background:C.lightCard,borderRadius:16,padding:"36px 32px",maxWidth:440,width:"100%",textAlign:"center" as const,boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
          <div style={{fontSize:48,marginBottom:14}}>✓</div>
          <div style={{fontSize:20,fontWeight:800,color:C.textDark,letterSpacing:"-.02em",marginBottom:8}}>¡Solicitud recibida!</div>
          <div style={{fontSize:13,color:C.textGray,marginBottom:24,lineHeight:1.6}}>
            Te contactaremos a <strong style={{color:C.textDark}}>{form.email}</strong> en las próximas <strong>24 horas hábiles</strong> para conversar tu caso.
          </div>
          <button onClick={onClose} style={{padding:"12px 28px",background:C.blueMain,border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  const planLabel = plan === "pyme" ? "PYME" : "Enterprise";
  const planSubtitle = plan === "pyme" ? "Equipos comerciales con múltiples vendedores" : "Solución corporativa a medida";

  const lbl = { fontSize:11, fontWeight:700, color:C.textDark, marginBottom:5, display:"block" as const, fontFamily:"'JetBrains Mono',monospace", letterSpacing:".06em" };
  const inp = { width:"100%", padding:"11px 13px", borderRadius:9, border:`1px solid ${C.lightBorder}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const, background:C.lightBg };
  const focus = (e:any)=>(e.target.style.borderColor = C.blueMain);
  const blur  = (e:any)=>(e.target.style.borderColor = C.lightBorder);

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000,overflow:"auto" as const}}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:C.lightCard,borderRadius:16,padding:"28px 32px",maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto" as const,boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.blueMain,letterSpacing:".15em",marginBottom:5}}>SOLICITAR COTIZACIÓN · {planLabel.toUpperCase()}</div>
            <div style={{fontSize:18,fontWeight:800,color:C.textDark,letterSpacing:"-.02em",marginBottom:4}}>Hablemos de tu caso</div>
            <div style={{fontSize:12,color:C.textGray}}>{planSubtitle}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:C.textGray,padding:4}}>✕</button>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={lbl}>NOMBRE COMPLETO *</label>
            <input value={form.full_name} onChange={upd("full_name")} style={inp} onFocus={focus} onBlur={blur} placeholder="Tu nombre"/>
          </div>
          <div>
            <label style={lbl}>EMAIL *</label>
            <input type="email" value={form.email} onChange={upd("email")} style={inp} onFocus={focus} onBlur={blur} placeholder="tu@empresa.com"/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={lbl}>EMPRESA *</label>
            <input value={form.empresa} onChange={upd("empresa")} style={inp} onFocus={focus} onBlur={blur} placeholder="Razón social"/>
          </div>
          <div>
            <label style={lbl}>CARGO</label>
            <input value={form.cargo} onChange={upd("cargo")} style={inp} onFocus={focus} onBlur={blur} placeholder="Gerente Comercial"/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={lbl}>PAÍS</label>
            <input value={form.pais} onChange={upd("pais")} style={inp} onFocus={focus} onBlur={blur} placeholder="Chile"/>
          </div>
          <div>
            <label style={lbl}>TELÉFONO</label>
            <input value={form.telefono} onChange={upd("telefono")} style={inp} onFocus={focus} onBlur={blur} placeholder="+56 9 ..."/>
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <label style={lbl}>TAMAÑO DEL EQUIPO COMERCIAL</label>
          <input type="number" min="1" value={form.team_size} onChange={upd("team_size")} style={inp} onFocus={focus} onBlur={blur} placeholder="Cantidad de vendedores"/>
        </div>

        <div style={{marginBottom:12}}>
          <label style={lbl}>CASO DE USO PRINCIPAL</label>
          <input value={form.use_case} onChange={upd("use_case")} style={inp} onFocus={focus} onBlur={blur} placeholder="Ej: Ventas industriales B2B en mercado chileno"/>
        </div>

        <div style={{marginBottom:18}}>
          <label style={lbl}>MENSAJE (OPCIONAL)</label>
          <textarea
            value={form.message}
            onChange={upd("message")}
            rows={3}
            placeholder="Cuéntanos brevemente lo que necesitas..."
            style={{...inp,resize:"vertical" as const,fontFamily:"inherit",minHeight:80}}
            onFocus={focus} onBlur={blur}
          />
        </div>

        {error && (
          <div style={{padding:"10px 14px",background:C.error+"15",border:`1px solid ${C.error}40`,borderRadius:8,fontSize:12,color:C.error,marginBottom:14}}>
            {error}
          </div>
        )}

        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} disabled={loading} style={{flex:1,padding:"12px",background:"transparent",border:`1px solid ${C.lightBorder}`,borderRadius:10,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:C.textGray}}>
            Cancelar
          </button>
          <button onClick={submit} disabled={loading} style={{flex:2,padding:"12px",background:loading?C.lightBorder:C.blueMain,border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",fontSize:13}}>
            {loading?"Enviando...":"Enviar solicitud →"}
          </button>
        </div>

        <div style={{marginTop:12,fontSize:10,color:C.textHint,textAlign:"center" as const,fontFamily:"'JetBrains Mono',monospace"}}>
          Te contactaremos en 24 hs hábiles
        </div>
      </div>
    </div>
  );
}
