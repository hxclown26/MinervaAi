import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { C } from "../lib/constants";

// ── AUTH HEADER ────────────────────────────────────────────────────
export function AuthHeader({ step, theme = "light" }: { step?: number; theme?: "light" | "dark" }) {
  const { session, profile, signOut, navigate, route } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isDark    = theme === "dark";
  const headerBg  = isDark ? "rgba(10,22,40,0.7)" : "rgba(255,255,255,0.94)";
  const borderCol = isDark ? C.darkBorder : C.lightBorder;
  const brandCol  = isDark ? C.textLight  : C.textDark;
  const subBrand  = isDark ? C.nodeCyan   : C.blueMain;
  const stepDim   = isDark ? C.darkBorder : C.lightBorder2;
  const stepText  = isDark ? "rgba(200,216,240,.5)" : C.textHint;
  const initials  = session?.user?.email?.[0]?.toUpperCase() || "?";

  return (
    <div style={{
      position:"sticky", top:0, zIndex:200,
      background: headerBg,
      backdropFilter:"saturate(180%) blur(20px)",
      WebkitBackdropFilter:"saturate(180%) blur(20px)",
      borderBottom:`1px solid ${borderCol}`,
      padding:"0 28px", height:54,
      display:"flex", alignItems:"center", gap:14
    }}>
      <div style={{display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
        <div style={{width:30,height:30,borderRadius:8,background:C.darkBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:C.textLight,fontWeight:800}}>M</div>
        <div>
          <div style={{fontSize:13,fontWeight:800,color:brandCol,letterSpacing:"-.02em",lineHeight:1.1}}>MINERVA</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:subBrand,letterSpacing:".1em"}}>DEAL.ENGINE</div>
        </div>
      </div>

      {step !== undefined && (
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:24,flexWrap:"wrap" as const}}>
          {["Cuenta","Perfil","Plan","Dashboard"].map((s,i)=>{
            const done = step > i, active = step === i;
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{
                  width:22,height:22,borderRadius:"50%",
                  background: done ? C.success : active ? C.blueMain : stepDim,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:9,fontWeight:700,
                  color: (done || active) ? "#fff" : stepText,
                  fontFamily:"'JetBrains Mono',monospace"
                }}>{done ? "✓" : i+1}</div>
                <span style={{fontSize:11,fontWeight: active ? 700 : 400,color: active ? brandCol : stepText}}>{s}</span>
                {i<3 && <div style={{width:14,height:1,background:borderCol,marginLeft:2}}/>}
              </div>
            );
          })}
        </div>
      )}

      <div ref={menuRef} style={{position:"relative",marginLeft:"auto"}}>
        <button onClick={()=>setMenuOpen(o=>!o)} style={{
          display:"flex",alignItems:"center",gap:8,padding:"4px 10px 4px 4px",
          background: menuOpen ? (isDark ? "rgba(255,255,255,.06)" : C.lightBg) : "transparent",
          border:`1px solid ${menuOpen ? borderCol : "transparent"}`,
          borderRadius:24, cursor:"pointer", fontFamily:"inherit", transition:"all .15s"
        }}>
          <div style={{
            width:28,height:28,borderRadius:"50%",
            background:C.blueMain+"22",border:`1px solid ${C.blueMain}55`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,color:C.blueMain,fontWeight:700
          }}>{initials}</div>
          <span style={{fontSize:10,color:stepText,fontFamily:"'JetBrains Mono',monospace"}}>▾</span>
        </button>

        {menuOpen && (
          <div style={{
            position:"absolute", top:"calc(100% + 6px)", right:0,
            background:C.lightCard, border:`1px solid ${C.lightBorder}`,
            borderRadius:12, padding:"6px 0", minWidth:260,
            boxShadow:"0 10px 30px rgba(0,0,0,.14)", zIndex:300
          }}>
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.lightBorder2}`}}>
              <div style={{fontSize:12,fontWeight:700,color:C.textDark,marginBottom:3,wordBreak:"break-all" as const}}>
                {session?.user?.email || "—"}
              </div>
              {profile?.empresa && (
                <div style={{fontSize:10,color:C.textGray,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".04em"}}>
                  {profile.empresa}{profile.pais ? ` · ${profile.pais}` : ""}
                </div>
              )}
            </div>
            {route !== "profile" && (
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
            )}
            {route === "profile" && (
              <button
                onClick={()=>{ setMenuOpen(false); navigate("dashboard"); }}
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
                <span style={{fontSize:13}}>⚡</span> Volver al simulador
              </button>
            )}
            <button
              onClick={async()=>{ setMenuOpen(false); await signOut(); }}
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
    </div>
  );
}