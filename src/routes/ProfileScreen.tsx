import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { sb } from "../lib/supabase";
import { C } from "../lib/constants";
import {
  planLabel,
  calculateLevel,
  calculateAchievements,
  formatMoney,
  formatDate,
  outcomeLabel,
  LEVEL_NAMES,
} from "../lib/helpers";
import { AuthHeader } from "../components/AuthHeader";
import { ReportModal } from "./profile/ReportModal";
import { WinModal } from "./profile/WinModal";
import { ExtendModal } from "./profile/ExtendModal";

// ── PROFILE SCREEN ─────────────────────────────────────────────────
export function ProfileScreen() {
  const { session, profile, subscription, navigate, refresh } = useAuth();
  const [tab, setTab] = useState<"actividad"|"datos">("actividad");
  const [sims, setSims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSim, setSelectedSim] = useState<any>(null);
  const [winModalSim, setWinModalSim] = useState<any>(null);
  const [extendModalSim, setExtendModalSim] = useState<any>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!session) { navigate("login"); return; }
    if (!profile?.profile_completed) { navigate("onboarding"); return; }
    const fetchSims = async () => {
      setLoading(true);
      try {
        const data = await sb.listSimulations(session.access_token, session.user.id);
        setSims(data);
      } catch (e) {
        console.error("Error cargando simulaciones:", e);
      }
      setLoading(false);
    };
    fetchSims();
  }, [session, profile, reload]);

  const wins   = sims.filter(s => s.outcome === "won");
  const lost   = sims.filter(s => s.outcome === "lost");
  const pending = sims.filter(s => s.effective_outcome === "pending" || s.effective_outcome === "overdue");
  const winRate = sims.length > 0 ? Math.round((wins.length / (wins.length + lost.length || 1)) * 100) : 0;
  const totalRevenue = wins.reduce((sum, s) => sum + (Number(s.budget_final) || 0), 0);
  const avgCloseTime = wins.length > 0
    ? Math.round(wins.reduce((sum, s) => sum + (s.days_to_close || 0), 0) / wins.length)
    : null;
  const levelInfo = calculateLevel(wins.length);
  const achievements = calculateAchievements(sims);
  const initials = (profile?.empresa || session?.user?.email || "?").charAt(0).toUpperCase();
  const userName = session?.user?.email?.split("@")[0] || "usuario";

  const STYLES = `*{box-sizing:border-box}@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');@keyframes pFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;

  return (
    <div style={{minHeight:"100vh",background:C.lightBg,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{STYLES}</style>
      <AuthHeader theme="light"/>

      <div style={{maxWidth:980,margin:"0 auto",padding:"32px 24px 80px",animation:"pFade .35s ease"}}>
        {/* Header del perfil con avatar + nivel */}
        <div style={{background:C.lightCard,borderRadius:16,padding:"24px 28px",border:`1px solid ${C.lightBorder}`,marginBottom:20,display:"flex",alignItems:"center",gap:18,flexWrap:"wrap" as const}}>
          <div style={{
            width:64,height:64,borderRadius:"50%",
            background:`linear-gradient(135deg, ${C.blueMain}, ${C.nodeCyan})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:24,color:"#fff",fontWeight:800,letterSpacing:"-.02em",
            flexShrink:0
          }}>{initials}</div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:18,fontWeight:800,color:C.textDark,letterSpacing:"-.02em",marginBottom:4}}>{userName}</div>
            <div style={{fontSize:12,color:C.textGray}}>
              {profile?.empresa || "—"} · {profile?.pais || "—"} · {profile?.giro || "—"}
            </div>
          </div>
          <div style={{textAlign:"right" as const,flexShrink:0}}>
            {subscription?.plan && (
              <div style={{display:"inline-block",background:C.blueMain+"15",color:C.blueMain,fontSize:10,padding:"3px 10px",borderRadius:8,fontWeight:700,marginBottom:6,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>
                {planLabel(subscription.plan)}
              </div>
            )}
            {profile?.is_master && (
              <div style={{display:"inline-block",marginLeft:6,background:C.gold+"20",color:C.gold,fontSize:10,padding:"3px 10px",borderRadius:8,fontWeight:700,marginBottom:6,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>
                ★ MASTER
              </div>
            )}
            <div style={{fontSize:10,color:C.textHint,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>
              NIVEL {levelInfo.level} · {levelInfo.name.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:18,borderBottom:`1px solid ${C.lightBorder}`,paddingBottom:0}}>
          {[{id:"actividad",label:"📊 Actividad"},{id:"datos",label:"⚙️ Datos personales"}].map((t:any)=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"10px 18px",
              background:tab===t.id?C.lightCard:"transparent",
              border:"none",
              borderBottom:tab===t.id?`2px solid ${C.blueMain}`:"2px solid transparent",
              fontSize:13,
              fontWeight:tab===t.id?700:500,
              color:tab===t.id?C.textDark:C.textGray,
              cursor:"pointer",
              fontFamily:"inherit",
              transition:"all .15s",
              borderTopLeftRadius:8,borderTopRightRadius:8,
              marginBottom:-1
            }}>{t.label}</button>
          ))}
        </div>

        {tab === "actividad" && (
          <div>
            {/* 4 tarjetas de métricas */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:10,marginBottom:18}}>
              {[
                { label:"SIMULACIONES", value:String(sims.length), sub:`${pending.length} en curso`,                color:C.blueMain },
                { label:"WIN RATE",     value:`${winRate}%`,        sub:`${wins.length} de ${wins.length+lost.length||0} cerradas`, color:wins.length>0?C.success:C.textGray },
                { label:"REVENUE GANADO",value:formatMoney(totalRevenue), sub:totalRevenue>0?"Histórico":"Aún sin wins",            color:C.gold },
                { label:"CICLO PROMEDIO",value:avgCloseTime!=null?`${avgCloseTime}d`:"—",  sub:avgCloseTime!=null?"Días al cierre":"Sin datos aún", color:C.nodeCyan }
              ].map((m,i)=>(
                <div key={i} style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{fontSize:10,color:C.textGray,marginBottom:6,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>{m.label}</div>
                  <div style={{fontSize:24,fontWeight:800,color:m.color,letterSpacing:"-.02em",lineHeight:1}}>{m.value}</div>
                  <div style={{fontSize:11,color:C.textHint,marginTop:4}}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Progreso al siguiente nivel + logros */}
            <div style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:14,padding:"18px 20px",marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap" as const,gap:6}}>
                <div style={{fontSize:13,fontWeight:700,color:C.textDark}}>
                  Progreso al siguiente nivel: {LEVEL_NAMES[levelInfo.level] || "Ascended Minerva"}
                </div>
                <div style={{fontSize:11,color:C.textGray,fontFamily:"'JetBrains Mono',monospace"}}>
                  {levelInfo.wins} / {levelInfo.nextAt} wins · {levelInfo.progress}%
                </div>
              </div>
              <div style={{height:6,background:C.lightBorder2,borderRadius:20,overflow:"hidden",marginBottom:14}}>
                <div style={{height:"100%",width:`${levelInfo.progress}%`,background:`linear-gradient(90deg,${C.blueMain},${C.nodeCyan})`,borderRadius:20,transition:"width .4s"}}/>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                {achievements.map((a:any)=>(
                  <div key={a.id} title={a.desc} style={{
                    background: a.unlocked ? C.success+"15" : C.lightBg,
                    color:      a.unlocked ? C.success      : C.textHint,
                    border:    `1px solid ${a.unlocked ? C.success+"40" : C.lightBorder}`,
                    fontSize:11,padding:"4px 10px",borderRadius:8,fontWeight:600,
                    display:"inline-flex",alignItems:"center",gap:5,cursor:"help"
                  }}>
                    <span>{a.unlocked ? a.icon : "🔒"}</span>
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Histórico */}
            <div style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:14,padding:"18px 20px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.textDark,marginBottom:12}}>Historial de simulaciones</div>
              {loading && <div style={{padding:"32px 0",textAlign:"center" as const,color:C.textGray,fontSize:12}}>Cargando...</div>}
              {!loading && sims.length === 0 && (
                <div style={{padding:"40px 20px",textAlign:"center" as const}}>
                  <div style={{fontSize:36,marginBottom:8}}>🚀</div>
                  <div style={{fontSize:14,color:C.textDark,fontWeight:700,marginBottom:4}}>Aún no tienes simulaciones</div>
                  <div style={{fontSize:12,color:C.textGray,marginBottom:18}}>Inicia tu primera simulación para empezar a construir tu histórico</div>
                  <button onClick={()=>navigate("dashboard")} style={{padding:"10px 20px",background:C.blueMain,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    Iniciar simulación →
                  </button>
                </div>
              )}
              {!loading && sims.length > 0 && (
                <div style={{overflowX:"auto" as const}}>
                  <table style={{width:"100%",fontSize:12,borderCollapse:"collapse" as const,minWidth:600}}>
                    <thead>
                      <tr style={{color:C.textGray,fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".06em"}}>
                        <th style={{textAlign:"left" as const,padding:"8px 6px",fontWeight:600}}>CLIENTE</th>
                        <th style={{textAlign:"left" as const,padding:"8px 6px",fontWeight:600}}>MERCADO</th>
                        <th style={{textAlign:"right" as const,padding:"8px 6px",fontWeight:600}}>PROB.</th>
                        <th style={{textAlign:"left" as const,padding:"8px 6px",fontWeight:600}}>FECHA EST.</th>
                        <th style={{textAlign:"left" as const,padding:"8px 6px",fontWeight:600}}>ESTADO</th>
                        <th style={{textAlign:"right" as const,padding:"8px 6px",fontWeight:600}}>ACCIONES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sims.map((s:any)=>{
                        const status = outcomeLabel(s.effective_outcome);
                        const isOpen = s.effective_outcome === "pending" || s.effective_outcome === "overdue";
                        const isOverdue = s.effective_outcome === "overdue";
                        return (
                          <tr key={s.id} style={{borderTop:`1px solid ${C.lightBorder2}`}}>
                            <td style={{padding:"10px 6px"}}>
                              <div style={{fontWeight:600,color:C.textDark}}>{s.client_name}</div>
                              <div style={{fontSize:10,color:C.textHint,marginTop:1}}>{s.offer_name}</div>
                            </td>
                            <td style={{padding:"10px 6px",color:C.textGray}}>{s.market_name}</td>
                            <td style={{padding:"10px 6px",textAlign:"right" as const,fontWeight:600,color:C.textDark}}>{s.probability != null ? `${s.probability}%` : "—"}</td>
                            <td style={{padding:"10px 6px",color:isOverdue?C.error:C.textGray,fontWeight:isOverdue?700:400}}>
                              {formatDate(s.estimated_close)}
                              {isOverdue && <div style={{fontSize:10,color:C.error,marginTop:2}}>⚠ Vencida</div>}
                            </td>
                            <td style={{padding:"10px 6px"}}>
                              <span style={{color:status.color,fontWeight:700,fontSize:11}}>{status.icon} {status.label}</span>
                              {s.budget_final && (
                                <div style={{fontSize:10,color:C.textHint,marginTop:1}}>{formatMoney(s.budget_final)}</div>
                              )}
                            </td>
                            <td style={{padding:"10px 6px",textAlign:"right" as const}}>
                              <div style={{display:"flex",gap:4,justifyContent:"flex-end" as const,flexWrap:"wrap" as const}}>
                                <button onClick={()=>setSelectedSim(s)} style={{padding:"4px 8px",background:"transparent",border:`1px solid ${C.lightBorder}`,borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"inherit",color:C.textGray}}>Ver</button>
                                {isOpen && !isOverdue && (
                                  <>
                                    <button onClick={()=>setWinModalSim(s)} style={{padding:"4px 8px",background:C.success,border:"none",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"inherit",color:"#fff",fontWeight:700}}>✓ Ganada</button>
                                    <button onClick={async()=>{
                                      if(!confirm(`¿Marcar "${s.client_name}" como perdida?`))return;
                                      try{ await sb.markSimulationLost(session!.access_token, s.id); setReload(r=>r+1);}catch(e){alert("Error al marcar como perdida");}
                                    }} style={{padding:"4px 8px",background:"transparent",border:`1px solid ${C.error}40`,borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"inherit",color:C.error,fontWeight:600}}>✗ Perdida</button>
                                  </>
                                )}
                                {isOverdue && (
                                  <>
                                    <button onClick={()=>setExtendModalSim(s)} style={{padding:"4px 8px",background:C.gold,border:"none",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"inherit",color:"#fff",fontWeight:700}}>📅 Extender</button>
                                    <button onClick={()=>setWinModalSim(s)} style={{padding:"4px 8px",background:C.success,border:"none",borderRadius:6,fontSize:10,cursor:"pointer",fontFamily:"inherit",color:"#fff",fontWeight:700}}>✓ Ganada</button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "datos" && (
          <div style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:14,padding:"24px 28px",maxWidth:560}}>
            <div style={{fontSize:14,fontWeight:700,color:C.textDark,marginBottom:18}}>Datos personales</div>
            {[
              { label:"Email",    value: session?.user?.email },
              { label:"Empresa",  value: profile?.empresa },
              { label:"País",     value: profile?.pais },
              { label:"Giro",     value: profile?.giro },
              { label:"Plan",     value: planLabel(subscription?.plan) },
              { label:"Ciclo",    value: subscription?.billing_cycle ? subscription.billing_cycle.toUpperCase() : "—" },
            ].map((f,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.lightBorder2}`,fontSize:13}}>
                <span style={{color:C.textGray,fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:".04em"}}>{f.label.toUpperCase()}</span>
                <span style={{fontWeight:600,color:C.textDark}}>{f.value || "—"}</span>
              </div>
            ))}

            {/* Estado de suscripción */}
            {subscription && subscription.status === "active" && subscription.billing_cycle !== "trial" && (
              <div style={{marginTop:18,padding:"14px 16px",background:subscription.cancel_at_period_end?C.error+"08":C.success+"08",border:`1px solid ${subscription.cancel_at_period_end?C.error:C.success}33`,borderRadius:10}}>
                {subscription.cancel_at_period_end ? (
                  <>
                    <div style={{fontSize:12,fontWeight:700,color:C.error,marginBottom:5}}>⚠ Suscripción cancelada</div>
                    <div style={{fontSize:11,color:C.textGray,lineHeight:1.5}}>
                      Tu acceso continúa hasta {formatDate(subscription.period_end)}.
                      Después de esa fecha no podrás simular hasta contratar de nuevo.
                    </div>
                    <button
                      onClick={async()=>{
                        if (!session?.access_token) return;
                        if (!confirm("¿Reactivar tu suscripción? Continuará el cobro automático.")) return;
                        try {
                          await sb.reactivateSubscription(session.access_token);
                          await refresh();
                        } catch { alert("Error al reactivar"); }
                      }}
                      style={{marginTop:10,padding:"8px 14px",background:C.success,border:"none",borderRadius:8,fontSize:11,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"inherit"}}
                    >
                      Reactivar suscripción
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{fontSize:12,fontWeight:700,color:C.success,marginBottom:5}}>✓ Suscripción activa</div>
                    <div style={{fontSize:11,color:C.textGray,lineHeight:1.5}}>
                      Próximo cobro: {formatDate(subscription.period_end)}
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{marginTop:18,display:"flex",gap:10,flexWrap:"wrap" as const}}>
              <button onClick={()=>navigate("pricing")} style={{padding:"10px 16px",background:"transparent",border:`1px solid ${C.lightBorder}`,borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit",color:C.textDark,fontWeight:600}}>
                {subscription?.status === "active" && subscription.billing_cycle !== "trial" ? "Cambiar plan" : "Ver planes"}
              </button>
              {subscription?.status === "active" && subscription.billing_cycle !== "trial" && !subscription.cancel_at_period_end && (
                <button
                  onClick={async()=>{
                    if (!session?.access_token) return;
                    if (!confirm(`¿Cancelar tu suscripción ${planLabel(subscription.plan)}?\n\nMantendrás acceso hasta ${formatDate(subscription.period_end)}. No habrá más cobros.`)) return;
                    try {
                      await sb.cancelSubscription(session.access_token);
                      await refresh();
                    } catch { alert("Error al cancelar. Intenta nuevamente."); }
                  }}
                  style={{padding:"10px 16px",background:"transparent",border:`1px solid ${C.error}55`,borderRadius:8,fontSize:12,cursor:"pointer",fontFamily:"inherit",color:C.error,fontWeight:600}}
                >
                  Cancelar suscripción
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Ver informe */}
      {selectedSim && <ReportModal sim={selectedSim} onClose={()=>setSelectedSim(null)}/>}

      {/* Modal: Marcar como ganada (pide monto final) */}
      {winModalSim && (
        <WinModal
          sim={winModalSim}
          onClose={()=>setWinModalSim(null)}
          onSuccess={()=>{ setWinModalSim(null); setReload(r=>r+1); }}
        />
      )}

      {/* Modal: Extender plazo */}
      {extendModalSim && (
        <ExtendModal
          sim={extendModalSim}
          onClose={()=>setExtendModalSim(null)}
          onSuccess={()=>{ setExtendModalSim(null); setReload(r=>r+1); }}
        />
      )}
    </div>
  );
}

