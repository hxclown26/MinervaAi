import { C } from "../lib/constants";

// ── APP HEADER ─────────────────────────────────────────────────────
export function AppHeader({ step, onNav, user, onSignOut }:any) {
  const NAV = ["Mercado","Modelo","Cliente","Mapa Neural","Simulación"];
  return (
    <div style={{ position:"sticky", top:0, zIndex:200, background:"rgba(255,255,255,0.92)", backdropFilter:"saturate(180%) blur(20px)", WebkitBackdropFilter:"saturate(180%) blur(20px)", borderBottom:`1px solid ${C.lightBorder}`, padding:"0 28px", height:54, display:"flex", alignItems:"center", gap:14 }}>
      <div style={{display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
        <div style={{width:30,height:30,borderRadius:8,background:C.darkBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>🧠</div>
        <div>
          <div style={{fontSize:13,fontWeight:800,color:C.textDark,letterSpacing:"-.02em",lineHeight:1.1}}>MINERVA</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.blueMain,letterSpacing:".1em"}}>DEAL.ENGINE</div>
        </div>
      </div>
      <div style={{display:"flex",gap:2,marginLeft:"auto"}}>
        {NAV.map((s,i)=>{
          const active=step===i, done=step>i;
          return <div key={i} onClick={()=>done&&onNav(i)} style={{ padding:"4px 9px", borderRadius:20, fontSize:9, fontFamily:"'JetBrains Mono',monospace", background:active?C.blueMain:"transparent", color:active?"#fff":done?C.blueMain:C.lightBorder, cursor:done?"pointer":"default", letterSpacing:".04em", transition:"all .15s" }}>{s}</div>;
        })}
      </div>
      {user && (
        <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:8,flexShrink:0}}>
          <div style={{width:28,height:28,borderRadius:"50%",background:C.blueMain+"22",border:`1px solid ${C.blueMain}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:C.blueMain,fontWeight:700}}>{user.email?.[0]?.toUpperCase()}</div>
          <button onClick={onSignOut} style={{padding:"4px 10px",border:`1px solid ${C.lightBorder}`,borderRadius:20,background:"transparent",color:C.textGray,fontSize:10,cursor:"pointer",fontFamily:"'JetBrains Mono',monospace"}}>salir</button>
        </div>
      )}
    </div>
  );
}

