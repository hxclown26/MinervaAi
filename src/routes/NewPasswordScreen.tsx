import { useState } from "react";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";

// ── NEW PASSWORD SCREEN ────────────────────────────────────────────
export function NewPasswordScreen({ recoveryToken, onSuccess }: any) {
  const [pwd, setPwd]         = useState("");
  const [pwd2, setPwd2]       = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState<any>(null);

  const inp = {
    width:"100%", padding:"12px 16px", borderRadius:10, fontSize:14,
    border:`1.5px solid ${C.lightBorder}`, background:C.lightCard, color:C.textDark,
    fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const,
    transition:"border-color .15s"
  };

  const strength = (() => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8)          score++;
    if (/[A-Z]/.test(pwd))        score++;
    if (/[0-9]/.test(pwd))        score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1)  return { label:"Débil",  color:C.error,   pct:25 };
    if (score === 2) return { label:"Media",  color:C.gold,    pct:55 };
    if (score === 3) return { label:"Buena",  color:"#0EA5E9", pct:80 };
    return                  { label:"Fuerte", color:C.success, pct:100 };
  })();

  const handleSubmit = async () => {
    setMsg(null);
    if (!recoveryToken) { setMsg({type:"error",text:"El enlace de recuperación expiró. Solicita uno nuevo desde el login."}); return; }
    if (pwd.length < 6) { setMsg({type:"error",text:"La contraseña debe tener al menos 6 caracteres"}); return; }
    if (pwd !== pwd2)   { setMsg({type:"error",text:"Las contraseñas no coinciden"}); return; }
    setLoading(true);
    try {
      const result = await sb.updatePassword(recoveryToken, pwd);
      const ok = result?.id || result?.email;
      if (!ok) {
        setMsg({type:"error", text: result?.msg || result?.error_description || result?.message || "No pudimos actualizar la contraseña"});
        setLoading(false);
        return;
      }
      const sess = { access_token: recoveryToken, refresh_token: null, user: result };
      onSuccess(sess);
    } catch {
      setMsg({type:"error",text:"Error de conexión. Verifica tu internet e intenta nuevamente."});
      setLoading(false);
    }
  };

  const handleCancel = () => {
    localStorage.removeItem("minerva_session");
    window.location.href = window.location.pathname;
  };

  return (
    <div style={{minHeight:"100vh",background:C.lightBg,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px",fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');*{box-sizing:border-box}@keyframes mFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28,justifyContent:"center"}}>
          <div style={{width:36,height:36,borderRadius:9,background:C.darkBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:C.textLight,fontWeight:800}}>M</div>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:C.textDark}}>MINERVA</div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.blueMain,letterSpacing:".1em"}}>DEAL.ENGINE</div>
          </div>
        </div>

        <div style={{background:C.lightCard,borderRadius:20,padding:"36px 32px",border:`1px solid ${C.lightBorder}`,boxShadow:"0 4px 40px rgba(0,0,0,.06)",animation:"mFadeUp .35s ease"}}>
          <div style={{fontSize:22,fontWeight:800,color:C.textDark,letterSpacing:"-.03em",marginBottom:6}}>Crear nueva contraseña</div>
          <div style={{fontSize:13,color:C.textGray,lineHeight:1.6,marginBottom:24}}>Estás a un paso de recuperar tu cuenta. Mínimo 6 caracteres.</div>

          {msg && (
            <div style={{
              padding:"10px 14px",borderRadius:8,marginBottom:16,fontSize:12,
              background: msg.type==="error" ? C.error+"10" : C.success+"10",
              border:`1px solid ${msg.type==="error" ? C.error+"30" : C.success+"30"}`,
              color: msg.type==="error" ? C.error : C.success
            }}>{msg.text}</div>
          )}

          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>NUEVA CONTRASEÑA</label>
            <div style={{position:"relative"}}>
              <input
                type={showPwd ? "text" : "password"}
                value={pwd}
                onChange={e=>setPwd(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{...inp,paddingRight:64}}
                onFocus={e=>(e.target.style.borderColor=C.blueMain)}
                onBlur={e=>(e.target.style.borderColor=C.lightBorder)}
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
              />
              <button
                onClick={()=>setShowPwd(s=>!s)}
                type="button"
                style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.textHint,fontSize:10,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em",padding:6}}
              >{showPwd ? "OCULTAR" : "VER"}</button>
            </div>
            {strength && (
              <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,height:4,background:C.lightBorder2,borderRadius:20,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${strength.pct}%`,background:strength.color,borderRadius:20,transition:"width .25s"}}/>
                </div>
                <span style={{fontSize:10,color:strength.color,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,minWidth:48,textAlign:"right" as const}}>{strength.label}</span>
              </div>
            )}
          </div>

          <div style={{marginBottom:22}}>
            <label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>CONFIRMAR CONTRASEÑA</label>
            <input
              type={showPwd ? "text" : "password"}
              value={pwd2}
              onChange={e=>setPwd2(e.target.value)}
              placeholder="Repite la contraseña"
              style={inp}
              onFocus={e=>(e.target.style.borderColor=C.blueMain)}
              onBlur={e=>(e.target.style.borderColor=C.lightBorder)}
              onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
            />
          </div>

          <button onClick={handleSubmit} disabled={loading} style={{
            width:"100%",padding:"14px",
            background: loading ? C.lightBorder : C.textDark,
            border:"none",borderRadius:10,color:"#fff",
            fontSize:14,fontWeight:700,
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily:"inherit",marginBottom:14
          }}>
            {loading ? "Guardando..." : "Guardar y entrar →"}
          </button>

          <div style={{textAlign:"center" as const}}>
            <button onClick={handleCancel} style={{background:"none",border:"none",color:C.textHint,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>← Volver al login</button>
          </div>
        </div>
      </div>
    </div>
  );
}

