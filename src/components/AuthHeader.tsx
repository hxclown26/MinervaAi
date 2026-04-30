import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { C } from "../lib/constants";

// ── APP HEADER ─────────────────────────────────────────────────────
// Header del wizard de simulación, con stepper de los 5 pasos
// y dropdown del avatar (Mi Perfil + Cerrar sesión).
export function AppHeader({ step, onNav, user, onSignOut }:any) {
  const { profile, navigate } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<any>(null);

  useEffect(() => {
    const handler = (e:any) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const NAV = ["Mercado","Modelo","Cliente","Mapa Neural","Simulación"];
  const initials = user?.email?.[0]?.toUpperCase() || "?";

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
        <div ref={menuRef} style={{position:"relative",marginLeft:8,flexShrink:0}}>
          <button onClick={()=>setMenuOpen(o=>!o)} style={{
            display:"flex",alignItems:"center",gap:6,
            padding:"3px 9px 3px 3px",
            background: menuOpen ? C.lightBg : "transparent",
            border:`1px solid ${menuOpen ? C.lightBorder : "transparent"}`,
            borderRadius:24, cursor:"pointer", fontFamily:"inherit",
            transition:"all .15s"
          }}>
            <div style={{
              width:28,height:28,borderRadius:"50%",
              background:C.blueMain+"22",border:`1px solid ${C.blueMain}44`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:12,color:C.blueMain,fontWeight:700
            }}>{initials}</div>
            <span style={{fontSize:9,color:C.textHint,fontFamily:"'JetBrains Mono',monospace"}}>▾</span>
          </button>

          {menuOpen && (
            <div style={{
              position:"absolute", top:"calc(100% + 6px)", right:0,
              background:C.lightCard, border:`1px solid ${C.lightBorder}`,
              borderRadius:12, padding:"6px 0", minWidth:240,
              boxShadow:"0 10px 30px rgba(0,0,0,.14)", zIndex:300
            }}>
              <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.lightBorder2}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.textDark,marginBottom:3,wordBreak:"break-all" as const}}>
                  {user?.email || "—"}
                </div>
                {profile?.empresa && (
                  <div style={{fontSize:10,color:C.textGray,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".04em"}}>
                    {profile.empresa}{profile.pais ? ` · ${profile.pais}` : ""}
                  </div>
                )}
                {profile?.is_master && (
                  <div style={{display:"inline-block",marginTop:5,background:C.gold+"20",color:C.gold,fontSize:9,padding:"2px 8px",borderRadius:8,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>
                    ★ MASTER
                  </div>
                )}
              </div>

              <button
                onClick={()=>{ setMenuOpen(false); navigate("profile"); }}
                style={{
                  width:"100%", padding:"11px 16px",
                  display:"flex",alignItems:"center",gap:10,
                  background:"transparent", border:"none", textAlign:"left" as const,
                  cursor:"pointer", fontFamily:"inherit",
                  fontSize:12, color:C.textDark, fontWeight:600,
                  transition:"background .12s",
                  borderBottom:`1px solid ${C.lightBorder2}`
                }}
                onMouseEnter={e=>(e.currentTarget as any).style.background=C.lightBg}
                onMouseLeave={e=>(e.currentTarget as any).style.background="transparent"}
              >
                <span style={{fontSize:13}}>👤</span> Mi Perfil
              </button>

              <button
                onClick={async()=>{ setMenuOpen(false); await onSignOut(); }}
                style={{
                  width:"100%", padding:"11px 16px",
                  display:"flex",alignItems:"center",gap:10,
                  background:"transparent", border:"none", textAlign:"left" as const,
                  cursor:"pointer", fontFamily:"inherit",
                  fontSize:12, color:C.error, fontWeight:600,
                  transition:"background .12s"
                }}
                onMouseEnter={e=>(e.currentTarget as any).style.background=C.error+"08"}
                onMouseLeave={e=>(e.currentTarget as any).style.background="transparent"}
              >
                <span style={{fontSize:13}}>↗</span> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}