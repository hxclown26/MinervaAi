import { useState } from "react";
import { sb } from "../lib/supabase";
import { C, BGN, BGE, HEX } from "../lib/constants";

// ── LOGIN SCREEN ───────────────────────────────────────────────────
export function LoginScreen({ onAuth }:any) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<any>(null);
  const inp = { width:"100%", padding:"12px 16px", borderRadius:10, fontSize:14, border:`1.5px solid ${C.lightBorder}`, background:C.lightCard, color:C.textDark, fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const, transition:"border-color .15s" };

  const handleSubmit = async () => {
    setMsg(null);
    if (!email) { setMsg({type:"error",text:"Ingresa tu correo electrónico"}); return; }
    if (mode!=="recover" && !pass) { setMsg({type:"error",text:"Ingresa tu contraseña"}); return; }
    setLoading(true);
    try {
      if (mode==="login") {
        const d = await sb.signIn(email, pass);
        if (d.error) setMsg({type:"error",text:"Correo o contraseña incorrectos"});
        else onAuth(d);
      } else if (mode==="register") {
        if (pass.length<6) { setMsg({type:"error",text:"La contraseña debe tener al menos 6 caracteres"}); setLoading(false); return; }
        const d = await sb.signUp(email, pass);
        if (d.error) setMsg({type:"error",text:d.error.message||"Error al crear cuenta"});
        else if (d.access_token) { onAuth(d); }
        else setMsg({type:"ok",text:"Cuenta creada. Inicia sesión para continuar."});
      } else {
        await sb.resetPassword(email);
        setMsg({type:"ok",text:"Te enviamos un enlace para restablecer tu contraseña"});
      }
    } catch { setMsg({type:"error",text:"Error de conexión"}); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');@keyframes mFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}*{box-sizing:border-box}input:focus{outline:none}`}</style>
      <div style={{background:C.darkBg,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"52px 40px 72px",minHeight:"44vh"}}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.14,pointerEvents:"none"}}>
          {BGE.map(([a,b],i)=>{const na=BGN[a],nb=BGN[b];return<line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke={C.nodeBlue} strokeWidth=".4"/>;})  }
          {BGN.map((n,i)=><circle key={i} cx={n.x} cy={n.y} r={n.r*.6} fill={C.nodeBlue}><animate attributeName="opacity" values=".15;.7;.15" dur={`${2.5+n.d}s`} repeatCount="indefinite"/></circle>)}
        </svg>
        <div style={{animation:"mFloat 5s ease-in-out infinite",position:"relative",zIndex:1,marginBottom:20}}>
          <svg width="80" height="80" viewBox="0 0 100 100">
            <defs><radialGradient id="aA" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={C.nodeBlue} stopOpacity=".12"/><stop offset="100%" stopColor={C.nodeBlue} stopOpacity="0"/></radialGradient></defs>
            <circle cx="50" cy="50" r="50" fill="url(#aA)"/>
            <circle cx="50" cy="50" r="44" fill="none" stroke={C.darkBorder} strokeWidth="1"/>
            <circle cx="50" cy="50" r="44" fill="none" stroke={C.nodeBlue} strokeWidth=".5" strokeDasharray="3 3" strokeOpacity=".35"><animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="22s" repeatCount="indefinite"/></circle>
            {HEX.map((n,i)=><g key={i}><line x1="50" y1="50" x2={n.cx} y2={n.cy} stroke={C.nodeBlue} strokeWidth=".7" strokeOpacity=".28"/><circle cx={n.cx} cy={n.cy} r="4" fill={C.darkBg} stroke={C.nodeBlue} strokeWidth="1"/><circle cx={n.cx} cy={n.cy} r="2" fill={C.nodeBlue}><animate attributeName="opacity" values=".25;1;.25" dur={`${1.8+i*.35}s`} repeatCount="indefinite"/></circle></g>)}
            <circle cx="50" cy="50" r="19" fill={C.darkSurface} stroke={C.darkBorder} strokeWidth="1.5"/>
            <text x="50" y="55" textAnchor="middle" fill={C.textLight} fontSize="14" fontWeight="800" fontFamily="'Plus Jakarta Sans',sans-serif">M</text>
          </svg>
        </div>
        <div style={{textAlign:"center",position:"relative",zIndex:1}}>
          <div style={{fontSize:28,fontWeight:800,letterSpacing:"-.03em",color:C.textLight,lineHeight:1,marginBottom:6}}>MINERVA</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:".2em",color:C.nodeCyan}}>DEAL.ENGINE</div>
        </div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:70,pointerEvents:"none",background:`linear-gradient(to bottom,transparent,${C.lightCard})`}}/>
      </div>
      <div style={{background:C.lightCard,flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"40px 24px 60px"}}>
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{marginBottom:24,textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:C.textDark,letterSpacing:"-.03em",marginBottom:6}}>
              {mode==="login"?"Iniciar sesión":mode==="register"?"Crear cuenta":"Recuperar contraseña"}
            </div>
            <div style={{fontSize:13,color:C.textGray}}>{mode==="login"?"Bienvenido de vuelta":mode==="register"?"Empieza hoy":"Te enviamos un enlace"}</div>
          </div>
          {msg&&<div style={{padding:"10px 14px",borderRadius:8,marginBottom:16,fontSize:12,background:msg.type==="error"?C.error+"10":"#05966910",border:`1px solid ${msg.type==="error"?C.error+"30":"#05966930"}`,color:msg.type==="error"?C.error:C.success}}>{msg.text}</div>}
          <div style={{marginBottom:12}}>
            <label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>CORREO ELECTRÓNICO</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com" style={inp} onFocus={e=>(e.target.style.borderColor=C.blueMain)} onBlur={e=>(e.target.style.borderColor=C.lightBorder)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
          </div>
          {mode!=="recover"&&<div style={{marginBottom:20}}>
            <label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>CONTRASEÑA</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder={mode==="register"?"Mínimo 6 caracteres":"••••••••"} style={inp} onFocus={e=>(e.target.style.borderColor=C.blueMain)} onBlur={e=>(e.target.style.borderColor=C.lightBorder)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()}/>
          </div>}
          <button onClick={handleSubmit} disabled={loading} style={{width:"100%",padding:"14px",background:loading?C.lightBorder:C.textDark,border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",marginBottom:16}}>
            {loading?"Procesando...":(mode==="login"?"Iniciar sesión →":mode==="register"?"Crear cuenta →":"Enviar enlace")}
          </button>
          <div style={{display:"flex",flexDirection:"column",gap:10,alignItems:"center"}}>
            {mode==="login"&&<><button onClick={()=>{setMode("register");setMsg(null);}} style={{background:"none",border:"none",color:C.blueMain,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>¿No tienes cuenta? Regístrate</button><button onClick={()=>{setMode("recover");setMsg(null);}} style={{background:"none",border:"none",color:C.textHint,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Olvidé mi contraseña</button></>}
            {mode!=="login"&&<button onClick={()=>{setMode("login");setMsg(null);}} style={{background:"none",border:"none",color:C.blueMain,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Volver a iniciar sesión</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

