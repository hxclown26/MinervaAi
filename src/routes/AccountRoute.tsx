import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { sb } from "../lib/supabase";
import { C, PLANS } from "../lib/constants";
import { AuthHeader } from "../components/AuthHeader";

export function AccountRoute() {
  const { session, navigate, refresh } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState<string|null>(null);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string|null>(null);

  useEffect(() => {
    if (!session) navigate("login");
  }, [session]);

  const loadSummary = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await sb.getAccountSummary(session.access_token);
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, [session?.access_token]);

  if (!session) return null;

  const sub = summary?.subscription;
  const plan = summary?.plan || (sub?.plan_code ? (PLANS as any)[sub.plan_code] : null);
  const invoices = summary?.invoices || [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(()=>setToast(null), 3500);
  };

  const handleCancel = async () => {
    if (!session?.access_token) return;
    setWorking(true);
    try {
      const result = await sb.cancelSubscription(session.access_token, cancelReason || undefined);
      if (result?.ok) {
        showToast("Tu suscripción quedó cancelada. Sigues con acceso hasta el fin del período.");
        setCancelModal(false);
        await Promise.all([loadSummary(), refresh()]);
      } else {
        showToast(result?.error || "No pudimos cancelar. Intenta de nuevo.");
      }
    } catch {
      showToast("Error de conexión");
    } finally {
      setWorking(false);
    }
  };

  const handleReactivate = async () => {
    if (!session?.access_token) return;
    setWorking(true);
    try {
      const result = await sb.reactivateSubscription(session.access_token);
      if (result?.ok) {
        showToast("✓ Tu suscripción está activa nuevamente");
        await Promise.all([loadSummary(), refresh()]);
      } else {
        showToast(result?.error || "No pudimos reactivar");
      }
    } catch {
      showToast("Error de conexión");
    } finally {
      setWorking(false);
    }
  };

  const formatDate = (d: string|null|undefined) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-CL", { day:"numeric", month:"long", year:"numeric" });
  };
  const formatCLP = (n: number|null|undefined) => n == null ? "—" : `$${n.toLocaleString("es-CL")} CLP`;

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(180deg, ${C.darkBg} 0%, #0F2545 60%)`,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <AuthHeader theme="dark"/>

      <div style={{padding:"40px 24px 80px"}}>
        <div style={{maxWidth:680,margin:"0 auto"}}>

          <button
            onClick={()=>navigate("dashboard")}
            style={{background:"none",border:"none",color:"rgba(200,216,240,.5)",cursor:"pointer",fontSize:13,fontFamily:"inherit",marginBottom:18}}
          >← Volver al dashboard</button>

          <h1 style={{fontSize:28,fontWeight:800,color:C.textLight,margin:"0 0 28px",letterSpacing:"-.02em"}}>Mi cuenta</h1>

          {loading && (
            <div style={{padding:"60px 20px",textAlign:"center" as const,color:"rgba(200,216,240,.5)"}}>Cargando…</div>
          )}

          {!loading && !sub && (
            <Card title="No tienes suscripción activa">
              <p style={{margin:"0 0 16px",color:"rgba(200,216,240,.7)",fontSize:14,lineHeight:1.6}}>Para volver a usar MINERVA, elige un plan.</p>
              <button onClick={()=>navigate("pricing")} style={{padding:"12px 24px",background:C.nodeCyan,color:"#000",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Ver planes →</button>
            </Card>
          )}

          {!loading && sub && (
            <>
              {/* Banner de estado */}
              {sub.status === "past_due" && (
                <Banner color="red">
                  <strong>No pudimos cobrar tu última cuota.</strong> Actualiza tu tarjeta para mantener tu acceso.
                </Banner>
              )}
              {sub.cancel_at_period_end && (
                <Banner color="amber">
                  Tu suscripción está cancelada. Sigues con acceso hasta el <strong>{formatDate(sub.current_period_end)}</strong>.
                  <button onClick={handleReactivate} disabled={working} style={{marginLeft:10,background:"none",border:"none",color:C.gold,fontWeight:700,cursor:"pointer",textDecoration:"underline",fontFamily:"inherit",fontSize:13}}>
                    Reactivar
                  </button>
                </Banner>
              )}
              {sub.status === "expired" && (
                <Banner color="gray">
                  Tu suscripción terminó. <button onClick={()=>navigate("pricing")} style={{background:"none",border:"none",color:C.nodeCyan,textDecoration:"underline",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Ver planes</button>
                </Banner>
              )}

              {/* Plan actual */}
              <Card title="Plan actual">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,flexWrap:"wrap" as const,gap:8}}>
                  <div style={{fontSize:20,fontWeight:700,color:C.textLight}}>{plan?.display_name || plan?.name || sub.plan}</div>
                  <div style={{fontSize:14,color:"rgba(200,216,240,.7)"}}>
                    {formatCLP(sub.next_charge_amount_clp || plan?.amount_clp || plan?.priceCLP)}/{sub.billing_cycle==="annual"?"año":"mes"}
                  </div>
                </div>
                {sub.coupon_remaining_uses > 0 && (
                  <div style={{fontSize:12,color:C.gold,marginTop:4}}>
                    🎁 Con descuento de bienvenida ({sub.coupon_remaining_uses} {sub.coupon_remaining_uses===1?"cobro":"cobros"} más con descuento)
                  </div>
                )}
                <div style={{fontSize:12,color:"rgba(200,216,240,.5)",marginTop:8}}>
                  {sub.simulations_used} de {sub.simulations_limit || "∞"} simulaciones usadas este período
                </div>
              </Card>

              {/* Próximo cobro */}
              {sub.next_charge_at && !sub.cancel_at_period_end && (
                <Card title="Próximo cobro">
                  <div style={{fontSize:16,color:C.textLight,fontWeight:600}}>
                    {formatDate(sub.next_charge_at)} — {formatCLP(sub.next_charge_amount_clp)}
                  </div>
                  <div style={{fontSize:12,color:"rgba(200,216,240,.5)",marginTop:6}}>Se cobra automáticamente en la tarjeta registrada.</div>
                </Card>
              )}

              {/* Tarjeta */}
              {(sub.flow_card_last4 || sub.flow_card_brand) && (
                <Card title="Método de pago">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap" as const}}>
                    <div style={{fontSize:14,color:C.textLight}}>
                      {sub.flow_card_brand?.toUpperCase() || "Tarjeta"} •••• {sub.flow_card_last4 || "—"}
                      {sub.flow_card_expires_month && sub.flow_card_expires_year && (
                        <span style={{marginLeft:8,color:"rgba(200,216,240,.5)",fontSize:12}}>vence {String(sub.flow_card_expires_month).padStart(2,"0")}/{sub.flow_card_expires_year}</span>
                      )}
                    </div>
                    <button
                      onClick={()=>showToast("Para actualizar tu tarjeta, escríbenos a hola@minervadeal.com (próximamente self-service)")}
                      style={{padding:"8px 16px",background:"transparent",border:`1px solid ${C.darkBorder}`,borderRadius:8,color:C.textLight,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}
                    >Actualizar</button>
                  </div>
                </Card>
              )}

              {/* Historial */}
              {invoices.length > 0 && (
                <Card title="Historial de cobros">
                  <div style={{display:"flex",flexDirection:"column" as const,gap:0}}>
                    {invoices.slice(0,10).map((inv:any) => (
                      <div key={inv.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderTop:`1px solid ${C.darkBorder}`,fontSize:13}}>
                        <div>
                          <div style={{color:C.textLight}}>{formatDate(inv.paid_at || inv.created_at)}</div>
                          <div style={{fontSize:11,color:"rgba(200,216,240,.5)",marginTop:2}}>
                            {inv.status === "paid" ? "✓ Pagado" : inv.status === "failed" ? "✗ Fallido" : "Pendiente"}
                            {inv.coupon_used && <span style={{marginLeft:6,color:C.gold}}>· con descuento</span>}
                          </div>
                        </div>
                        <div style={{color:C.textLight,fontWeight:600}}>{formatCLP(inv.amount_clp)}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Acciones bottom */}
              {!sub.cancel_at_period_end && ["active","past_due"].includes(sub.status) && (
                <div style={{textAlign:"center" as const,marginTop:32}}>
                  <button
                    onClick={()=>setCancelModal(true)}
                    style={{background:"none",border:"none",color:"rgba(200,216,240,.5)",fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}
                  >Cancelar suscripción</button>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* Modal cancelar */}
      {cancelModal && (
        <Modal onClose={()=>setCancelModal(false)}>
          <h3 style={{fontSize:20,fontWeight:700,color:C.textLight,margin:"0 0 14px"}}>¿Seguro que quieres cancelar?</h3>
          <div style={{fontSize:13,color:"rgba(200,216,240,.75)",lineHeight:1.7,marginBottom:18}}>
            Si cancelas hoy:<br/>
            <span style={{color:C.success}}>▸</span> Sigues teniendo acceso completo hasta el <strong style={{color:C.textLight}}>{formatDate(sub?.current_period_end)}</strong>.<br/>
            <span style={{color:C.success}}>▸</span> No se te volverá a cobrar.<br/>
            <span style={{color:C.success}}>▸</span> Puedes reactivar antes de esa fecha sin perder tu cuenta.
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"rgba(200,216,240,.5)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".1em",marginBottom:8}}>¿POR QUÉ CANCELAS? (OPCIONAL)</div>
            {["Muy caro","Lo uso poco","Encontré otra herramienta","Otro"].map(r => (
              <label key={r} style={{display:"block",padding:"7px 0",cursor:"pointer",fontSize:13,color:C.textLight}}>
                <input type="radio" name="reason" value={r} checked={cancelReason===r} onChange={()=>setCancelReason(r)} style={{marginRight:8}}/>
                {r}
              </label>
            ))}
          </div>

          <div style={{display:"flex",gap:8}}>
            <button
              onClick={()=>setCancelModal(false)}
              disabled={working}
              style={{flex:1,padding:"12px",background:"transparent",border:`1px solid ${C.darkBorder}`,borderRadius:10,color:C.textLight,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}
            >Mantener mi suscripción</button>
            <button
              onClick={handleCancel}
              disabled={working}
              style={{flex:1,padding:"12px",background:working?"rgba(220,38,38,.4)":C.error,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:working?"not-allowed":"pointer",fontFamily:"inherit"}}
            >{working ? "Procesando..." : "Sí, cancelar"}</button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{position:"fixed" as const,bottom:24,left:"50%",transform:"translateX(-50%)",background:C.darkSurface,border:`1px solid ${C.nodeCyan}55`,padding:"14px 22px",borderRadius:12,color:C.textLight,fontSize:13,boxShadow:"0 8px 32px rgba(0,0,0,.4)",zIndex:60,maxWidth:480}}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{background:"rgba(255,255,255,.04)",border:`1px solid ${C.darkBorder}`,borderRadius:14,padding:"20px 22px",marginBottom:14}}>
      <div style={{fontSize:10,color:"rgba(200,216,240,.5)",fontFamily:"'JetBrains Mono',monospace",letterSpacing:".15em",marginBottom:12}}>{title.toUpperCase()}</div>
      {children}
    </div>
  );
}

function Banner({ color, children }: { color: "red"|"amber"|"gray"; children: React.ReactNode }) {
  const styles: Record<string, any> = {
    red:   { bg: C.error+"15",   border: C.error+"40",   text: C.error },
    amber: { bg: C.gold+"15",    border: C.gold+"40",    text: C.gold },
    gray:  { bg: "rgba(255,255,255,.04)", border: C.darkBorder, text: C.textLight },
  };
  const s = styles[color];
  return (
    <div style={{padding:"12px 16px",background:s.bg,border:`1px solid ${s.border}`,borderRadius:10,fontSize:13,color:s.text,marginBottom:14,lineHeight:1.6}}>
      {children}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:16}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.darkSurface,border:`1px solid ${C.darkBorder}`,borderRadius:16,padding:"28px 28px",maxWidth:440,width:"100%"}}>
        {children}
      </div>
    </div>
  );
}
