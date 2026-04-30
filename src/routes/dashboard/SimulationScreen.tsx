import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { sb } from "../../lib/supabase";
import { C, NODE_TYPES } from "../../lib/constants";
import { canSimulate, extractProbability } from "../../lib/helpers";
import { callClaude } from "../../lib/claude";
import { AgentCard } from "../../components/AgentCard";
import { ContextBar } from "../../components/ContextBar";

// ── SIMULATION SCREEN ──────────────────────────────────────────────
export function SimulationScreen({ market, model, clientData, weights, profile }:any) {
  const { session, subscription, refresh, navigate } = useAuth();
  const [phase, setPhase] = useState<"idle"|"running"|"complete">("idle");
  const [responses, setResponses] = useState<any>({});
  const [activeId, setActiveId] = useState<string|null>(null);
  const [report, setReport] = useState<string|null>(null);
  const [progress, setProgress] = useState({current:0,total:0});
  const [blockReason, setBlockReason] = useState<string|null>(null);
  const endRef = useRef<any>(null);

  const empresa = profile?.empresa || "Tu Empresa";
  const enrichedClient = {...clientData, customModel: model.customModelDesc||""};
  const agents = model.agentDefs.map((a:any,i:number)=>({
    ...a,
    id:`${a.id}_${i}`,
    company: a.side==="vendedor" ? empresa.toUpperCase() : a.company,
    systemPrompt: a.sys(market, enrichedClient),
  }));

  const scene = `Mercado: ${market.name}${market.customContext?" — "+market.customContext:""} | Modelo: ${model.name}${model.customModelDesc?" — "+model.customModelDesc:""}
Empresa vendedora: ${empresa}
Cliente: ${clientData.name||"empresa del sector"} | País: Chile
Propuesta: ${clientData.offerName||"propuesta comercial"}
Situación actual: ${clientData.situation||"en evaluación"}
Valor de la oportunidad: ${clientData.budget||"no especificado"}
Dolor principal: ${clientData.pain||"optimización operacional"}
Palabras clave del sector: ${market.keywords?.length ? market.keywords.join(", ") : market.customContext||"sector comercial"}
Pesos de influencia: ${model.stakeholders.map((s:any)=>`${s.name}: ${weights[s.id]||s.weight}%`).join(", ")}`;

  const runSim = async () => {
    // Verificar permisos antes de iniciar
    const status = canSimulate(subscription, profile);
    if (!status.ok) {
      setBlockReason(status.reason || "no_plan");
      return;
    }

    setPhase("running"); setResponses({}); setReport(null);
    setProgress({current:0,total:agents.length});
    const reps:any = {};
    for(let i=0;i<agents.length;i++){
      const ag=agents[i];
      setActiveId(ag.id);
      setProgress({current:i+1,total:agents.length});
      endRef.current?.scrollIntoView({behavior:"smooth"});
      const r = await callClaude(ag.systemPrompt, `Contexto del escenario:\n${scene}\n\nDa tu reacción honesta como ${ag.name} de ${ag.company}.`);
      reps[ag.id]=r;
      setResponses((p:any)=>({...p,[ag.id]:r}));
    }
    setActiveId("report");
    endRef.current?.scrollIntoView({behavior:"smooth"});
    const rep = await callClaude(
      "Eres analista estratégico senior en ventas B2B industriales. Generas informes ejecutivos accionables, directos, sin adornos. Nunca menciones nombres de empresas proveedoras ni marcas comerciales específicas.",
      `MODELO: ${model.name} | MERCADO: ${market.name} | CLIENTE: ${clientData.name||"empresa"}
PROPUESTA: ${clientData.offerName||"propuesta comercial"} | VENDEDOR: ${empresa}

REACCIONES DE STAKEHOLDERS:
${agents.map((a:any)=>`[${a.name} — ${a.company}]:\n${reps[a.id]}`).join("\n\n")}

Genera informe ejecutivo en español con estas 5 secciones EXACTAS:

1. PROBABILIDAD DE AVANCE
(% estimado para avanzar a siguiente etapa en 60–90 días + 2 frases de justificación)

2. OBJECIÓN CRÍTICA
(La más difícil de resolver + táctica específica para manejarla)

3. NODO NEURONAL CLAVE
(El stakeholder que define el resultado + por qué + cómo activarlo)

4. MOVIMIENTO COMPETIDOR
(Qué hará la competencia, cuándo y cómo neutralizarlo)

5. PRÓXIMOS 3 PASOS
(Ordenados por urgencia, con acción concreta y responsable)

Máx. 420 palabras. Directo, ejecutivo, sin relleno.`
    );
    setReport(rep); setActiveId(null); setPhase("complete");
    endRef.current?.scrollIntoView({behavior:"smooth"});

    // Guardar simulación + incrementar contador
    if (session?.access_token) {
      try {
        // Parsear monto inicial del campo budget (texto libre)
        const budgetMatch = String(clientData.budget||"").match(/[\d.,]+/);
        let budgetInitial:number|null = null;
        if (budgetMatch) {
          let raw = budgetMatch[0].replace(/\./g,"").replace(/,/g,".");
          const n = parseFloat(raw);
          if (!isNaN(n)) {
            // Detectar unidades: K, M, MM, B
            const upper = String(clientData.budget).toUpperCase();
            if (upper.includes("MM") || upper.includes("M$") || upper.includes("MILL")) budgetInitial = n * 1_000_000;
            else if (upper.includes("K"))                                               budgetInitial = n * 1_000;
            else if (upper.includes("B"))                                               budgetInitial = n * 1_000_000_000;
            else                                                                        budgetInitial = n;
          }
        }

        await sb.saveSimulation(session.access_token, {
          p_market_id:        market.id,
          p_market_name:      market.name,
          p_model_id:         model.id,
          p_model_name:       model.name,
          p_client_name:      clientData.name || "Sin nombre",
          p_offer_name:       clientData.offerName || "",
          p_budget_initial:   budgetInitial,
          p_estimated_close:  clientData.estimatedClose,
          p_probability:      extractProbability(rep),
          p_report:           rep,
          p_agent_responses:  reps
        });

        if (!profile?.is_master) {
          await sb.incrementSimulationCount(session.access_token);
        }
        await refresh();
      } catch (e) {
        console.error("Error guardando simulación:", e);
      }
    }
  };

  const downloadHTML = () => {
    const date = new Date().toLocaleDateString("es-CL",{year:"numeric",month:"long",day:"numeric"});
    const footer = `<div class="footer">CONFIDENCIAL &middot; MINERVA DEAL ENGINE &middot; Strategic Decision Simulator &middot; ${date}</div>`;

    const coverPage = `
<div class="cover page-break">
  <div class="cover-badge">🧠 MINERVA DEAL ENGINE &middot; SIMULADOR ESTRATÉGICO B2B</div>
  <div class="cover-brain">🧠</div>
  <div class="cover-title">Informe de Simulación<br/>Estratégica</div>
  <div class="cover-sub">${model.name} &middot; ${market.name}</div>
  <div class="cover-card">
    ${[["Cliente",clientData.name||"—"],["Propuesta",clientData.offerName||"—"],["Mercado",market.name],["Modelo",model.name],["Valor de la oportunidad",clientData.budget||"—"],["Dolor principal",clientData.pain||"—"],["Vendedor",empresa],["Fecha",date]].map(([k,v])=>`<div class="cover-row"><span class="cover-key">${k}</span><span class="cover-val">${v}</span></div>`).join("")}
  </div>
  ${footer}
</div>`;

    const reportSections = (report||"").split(/\n(?=\d\.\s)/).map((sec:string)=>{
      const lines = sec.trim().split("\n");
      const header = lines[0];
      const body = lines.slice(1).join("\n").trim();
      return `<div class="report-section"><div class="report-section-title">${header}</div><div class="report-section-body">${body.replace(/\n/g,"<br/>")}</div></div>`;
    }).join("");

    const executivePage = `
<div class="content-page page-break">
  <div class="section-label">02</div>
  <div class="section-title">Informe Ejecutivo</div>
  <div class="report-box">${reportSections||report||""}</div>
  ${footer}
</div>`;

    const stakeRows = model.stakeholders.map((s:any)=>{
      const nt = NODE_TYPES[s.type];
      const w = weights[s.id]!==undefined ? weights[s.id] : s.weight;
      return `<tr><td><strong>${s.name}</strong></td><td><span class="role-badge" style="background:${nt.color}18;color:${nt.color};border:1px solid ${nt.color}44">${nt.label}</span></td><td style="text-align:center;font-weight:700;color:${nt.color}">${w}%</td><td>${s.trigger}</td><td>${s.id===model.entryNode?"<strong style='color:#0066CC'>Nodo de entrada</strong>":"—"}</td></tr>`;
    }).join("");

    const mapPage = `
<div class="content-page page-break">
  <div class="section-label">03</div>
  <div class="section-title">Mapa de Stakeholders</div>
  <table class="stake-table">
    <thead><tr><th>Stakeholder</th><th>Rol Neural</th><th>Influencia %</th><th>Trigger Principal</th><th>Punto de Entrada</th></tr></thead>
    <tbody>${stakeRows}</tbody>
  </table>
  ${footer}
</div>`;

    const blueprintSteps = model.proposalSteps.map((ps:any)=>`
<div class="blueprint-step">
  <div class="blueprint-num" style="background:${model.accent}18;border:2px solid ${model.accent};color:${model.accent}">${ps.n}</div>
  <div><div class="blueprint-step-title">${ps.title}</div><div class="blueprint-step-detail">${ps.detail}</div></div>
</div>`).join("");

    const blueprintPage = `
<div class="content-page page-break">
  <div class="section-label">04</div>
  <div class="section-title">Proposal Blueprint — ${model.badge}</div>
  <div class="blueprint-container">${blueprintSteps}</div>
  ${footer}
</div>`;

    const agentCards = agents.map((ag:any)=>{
      const roleColor = ag.side==="cliente"?"#059669":ag.side==="competidor"?"#DC2626":"#0066CC";
      const roleBg = ag.side==="cliente"?"#dcfce7":ag.side==="competidor"?"#fee2e2":"#dbeafe";
      const roleLabel = ag.side==="cliente"?"CLIENTE":ag.side==="competidor"?"COMPETIDOR":"VENDEDOR";
      return `
<div class="agent-card" style="border-left:4px solid ${ag.accent}">
  <div class="agent-header">
    <div class="agent-icon">${ag.icon}</div>
    <div class="agent-info"><div class="agent-name">${ag.name}</div><div class="agent-company">${ag.company}</div></div>
    <span class="agent-badge" style="background:${roleBg};color:${roleColor}">${roleLabel}</span>
  </div>
  <div class="agent-response">${(responses[ag.id]||"").replace(/\n/g,"<br/>")}</div>
</div>`;
    }).join("");

    const agentsPage = `
<div class="content-page">
  <div class="section-label">05</div>
  <div class="section-title">Análisis por Agente</div>
  ${agentCards}
  ${footer}
</div>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>MINERVA &mdash; ${model.name} &middot; ${clientData.name||"Cliente"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#F5F5F7;color:#1D1D1F;font-size:13px;line-height:1.65}
  .toolbar{position:fixed;top:0;left:0;right:0;background:#fff;border-bottom:2px solid #0066CC;padding:12px 28px;display:flex;align-items:center;gap:12px;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,.06)}
  .toolbar-info{flex:1}
  .toolbar-title{font-size:12px;font-weight:700;color:#0066CC}
  .toolbar-hint{font-size:11px;color:#666;margin-top:2px}
  .btn{background:#0066CC;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:-.01em}
  .btn:hover{background:#0055a8}
  .page-wrap{margin-top:62px;max-width:860px;margin-left:auto;margin-right:auto;padding:0 0 60px}
  .cover{background:linear-gradient(160deg,#004B87 0%,#001a35 100%);color:#fff;padding:64px 56px 48px;position:relative;min-height:680px;display:flex;flex-direction:column;justify-content:center}
  .cover-badge{font-size:10px;letter-spacing:.18em;color:#4D9FFF;margin-bottom:32px;font-family:monospace}
  .cover-brain{font-size:72px;margin-bottom:24px;line-height:1}
  .cover-title{font-size:38px;font-weight:300;line-height:1.2;margin-bottom:10px}
  .cover-title strong{color:#4D9FFF;font-weight:700}
  .cover-sub{font-size:18px;font-weight:600;color:rgba(255,255,255,.7);margin-bottom:40px}
  .cover-card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:20px 26px;max-width:440px}
  .cover-row{display:flex;gap:16px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}
  .cover-row:last-child{border-bottom:none}
  .cover-key{font-size:9px;color:#4D9FFF;min-width:130px;text-transform:uppercase;letter-spacing:.08em;padding-top:2px;font-family:monospace}
  .cover-val{color:#e0eaf5;font-size:13px}
  .content-page{background:#fff;padding:52px 56px 48px}
  .section-label{font-family:monospace;font-size:10px;letter-spacing:.18em;color:#0066CC;margin-bottom:6px;text-transform:uppercase}
  .section-title{font-size:26px;font-weight:700;color:#1D1D1F;letter-spacing:-.02em;margin-bottom:28px;padding-bottom:12px;border-bottom:2px solid #0066CC}
  .report-box{background:#F8FAFF;border:1.5px solid #D0E4FF;border-radius:12px;padding:24px 28px}
  .report-section{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #E8E8ED}
  .report-section:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0}
  .report-section-title{font-size:13px;font-weight:700;color:#0066CC;letter-spacing:.03em;margin-bottom:8px;text-transform:uppercase}
  .report-section-body{font-size:13px;line-height:1.8;color:#1D1D1F}
  .stake-table{width:100%;border-collapse:collapse;font-size:12px}
  .stake-table th{background:#F5F5F7;padding:10px 12px;text-align:left;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6E6E73;border-bottom:2px solid #D2D2D7;font-family:monospace}
  .stake-table td{padding:11px 12px;border-bottom:1px solid #E8E8ED;vertical-align:middle}
  .stake-table tr:nth-child(even) td{background:#FAFAFA}
  .role-badge{padding:2px 9px;border-radius:20px;font-size:9px;font-weight:700;font-family:monospace;letter-spacing:.06em}
  .blueprint-container{display:flex;flex-direction:column;gap:14px}
  .blueprint-step{display:flex;gap:16px;align-items:flex-start;padding:18px 20px;background:#F8FAFF;border-radius:12px;border:1px solid #E8F0FF}
  .blueprint-num{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:monospace}
  .blueprint-step-title{font-size:14px;font-weight:700;color:#1D1D1F;margin-bottom:4px}
  .blueprint-step-detail{font-size:12px;color:#6E6E73;line-height:1.6}
  .agent-card{background:#fff;border:1px solid #E8E8ED;border-radius:12px;padding:18px 20px;margin-bottom:16px;overflow:hidden}
  .agent-header{display:flex;gap:12px;align-items:center;margin-bottom:12px}
  .agent-icon{width:40px;height:40px;border-radius:9px;background:#F5F5F7;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .agent-info{flex:1}
  .agent-name{font-weight:700;font-size:13px;color:#1D1D1F}
  .agent-company{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#6E6E73;font-family:monospace}
  .agent-badge{padding:3px 10px;border-radius:20px;font-size:9px;font-weight:700;font-family:monospace;letter-spacing:.06em}
  .agent-response{font-size:12.5px;line-height:1.8;color:#3A3A3C;padding-top:12px;border-top:1px solid #E8E8ED}
  .footer{margin-top:48px;padding-top:14px;border-top:1px solid #E8E8ED;text-align:center;font-size:9px;color:#86868B;letter-spacing:.1em;font-family:monospace;text-transform:uppercase}
  .page-break{page-break-after:always}
  @media print{
    .toolbar{display:none!important}
    .page-wrap{margin-top:0}
    body{background:#fff}
    @page{size:A4;margin:14mm 12mm}
    .cover{min-height:auto;padding:48px 44px 40px}
    .content-page{padding:40px 44px 36px}
  }
</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar-info">
    <div class="toolbar-title">MINERVA DEAL ENGINE &middot; ${model.badge} &middot; ${market.name} &middot; ${clientData.name||"CLIENTE"}</div>
    <div class="toolbar-hint">Usa <strong>Ctrl+P</strong> (o el botón) &rarr; Guardar como PDF para exportar</div>
  </div>
  <button class="btn" onclick="window.print()">Imprimir / Guardar como PDF</button>
</div>
<div class="page-wrap">
  ${coverPage}
  ${executivePage}
  ${mapPage}
  ${blueprintPage}
  ${agentsPage}
</div>
</body></html>`;

    const blob = new Blob([html],{type:"text/html;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;
    a.download=`MINERVA_${model.badge}_${(clientData.name||"Cliente").replace(/\s+/g,"_")}_${date.replace(/\s/g,"_")}.html`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <ContextBar market={market} model={model} offerName={clientData.offerName}/>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:6,textTransform:"uppercase" as const}}>Paso 5 de 5</div>
      <div style={{fontSize:"clamp(20px,4vw,30px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1,marginBottom:6}}>Simulación Multiagente</div>
      <div style={{fontSize:13,color:C.textGray,marginBottom:22,lineHeight:1.6}}>{clientData.offerName||"Propuesta"} · {clientData.name||"Cliente"} · {market.name}</div>

      {phase==="idle" && !blockReason && (() => {
        // Verificar si puede simular ANTES de mostrar el botón
        const status = canSimulate(subscription, profile);
        if (!status.ok) {
          // No puede simular: mostrar mensaje de bloqueo en lugar del botón
          const isExpired = status.reason === "period_expired";
          const isLimit   = status.reason === "limit_reached";
          return (
            <div style={{textAlign:"center" as const,padding:"48px 24px",background:C.lightCard,borderRadius:16,border:`1.5px solid ${C.error}30`,boxShadow:"0 2px 12px rgba(0,0,0,.05)"}}>
              <div style={{fontSize:42,marginBottom:14}}>🔒</div>
              <div style={{color:C.textDark,fontSize:19,fontWeight:800,marginBottom:8,letterSpacing:"-.02em"}}>
                {isExpired ? "Tu trial gratis expiró" : isLimit ? "Llegaste al límite del trial" : "Necesitas un plan activo"}
              </div>
              <div style={{color:C.textGray,fontSize:13,marginBottom:24,lineHeight:1.6,maxWidth:380,margin:"0 auto 24px"}}>
                {isExpired
                  ? "Pasaron los 30 días del trial gratis. Para seguir simulando, contrata un plan."
                  : isLimit
                  ? `Ya usaste tus ${subscription?.simulations_limit || 2} simulaciones del trial gratis. Contrata un plan para acceso ilimitado.`
                  : "Para correr simulaciones necesitas tener un plan activo."}
              </div>
              <button onClick={()=>navigate("pricing")} style={{padding:"14px 36px",background:C.blueMain,border:"none",color:"#fff",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:".02em"}}>
                Ver planes →
              </button>
            </div>
          );
        }
        // Puede simular: botón normal
        const remaining = subscription?.simulations_limit != null
          ? Math.max(0, subscription.simulations_limit - (subscription.simulations_used || 0))
          : null;
        return (
          <div style={{textAlign:"center" as const,padding:"48px 20px",background:C.lightCard,borderRadius:16,border:`1px solid ${C.lightBorder}`,boxShadow:"0 2px 12px rgba(0,0,0,.05)"}}>
            <div style={{fontSize:48,marginBottom:16}}>🧠</div>
            <div style={{color:C.textDark,fontSize:18,fontWeight:700,marginBottom:8}}>Todo listo para simular</div>
            <div style={{color:C.textGray,fontSize:13,marginBottom:24,lineHeight:1.7}}>{agents.length} agentes activados · {model.stakeholders.length} stakeholders mapeados<br/>Competidor sin nombre · Vendedor como {empresa}</div>
            {!profile?.is_master && remaining != null && remaining <= 1 && (
              <div style={{fontSize:11,color:C.gold,marginBottom:16,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".04em"}}>
                ⚠ Esta {remaining === 0 ? "será tu" : "es tu última"} simulación del trial
              </div>
            )}
            <button onClick={runSim} style={{padding:"16px 48px",background:C.textDark,border:"none",color:"#fff",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:".04em",transition:"opacity .15s"}}
              onMouseEnter={e=>(e.currentTarget as any).style.opacity=".85"}
              onMouseLeave={e=>(e.currentTarget as any).style.opacity="1"}>
              ⚡ Ejecutar Red Neural →
            </button>
          </div>
        );
      })()}

      {phase==="idle" && blockReason && (
        <div style={{textAlign:"center" as const,padding:"48px 24px",background:C.lightCard,borderRadius:16,border:`1.5px solid ${C.error}30`}}>
          <div style={{fontSize:42,marginBottom:14}}>🔒</div>
          <div style={{color:C.textDark,fontSize:19,fontWeight:800,marginBottom:8}}>No se pudo iniciar la simulación</div>
          <div style={{color:C.textGray,fontSize:13,marginBottom:24,lineHeight:1.6}}>
            {blockReason === "period_expired" ? "Tu trial gratis expiró."
              : blockReason === "limit_reached" ? "Ya usaste todas tus simulaciones del trial."
              : "Necesitas un plan activo para simular."}
          </div>
          <button onClick={()=>navigate("pricing")} style={{padding:"14px 36px",background:C.blueMain,border:"none",color:"#fff",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            Ver planes →
          </button>
        </div>
      )}

      {phase==="running"&&(
        <div style={{marginBottom:20,background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:12,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.04)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:C.blueMain,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>Procesando agente {progress.current} de {progress.total}</span>
            <span style={{color:C.textGray,fontSize:10,fontFamily:"'JetBrains Mono',monospace"}}>{Math.round(progress.current/progress.total*100)||0}%</span>
          </div>
          <div style={{background:C.lightBg,borderRadius:20,height:6,overflow:"hidden"}}>
            <div style={{height:"100%",background:`linear-gradient(90deg,${C.blueMain},${C.blueLight})`,borderRadius:20,width:`${Math.round(progress.current/progress.total*100)||0}%`,transition:"width .4s ease"}}/>
          </div>
        </div>
      )}

      {agents.map((ag:any)=>(
        <AgentCard key={ag.id} agent={ag} response={responses[ag.id]} isActive={activeId===ag.id}/>
      ))}

      {(activeId==="report"||report)&&(
        <div style={{background:C.lightCard,border:`1px solid ${C.blueMain}33`,borderLeft:`4px solid ${C.blueMain}`,borderRadius:12,padding:"18px 20px",marginTop:8,marginBottom:12,boxShadow:"0 2px 12px rgba(0,102,204,.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{width:36,height:36,borderRadius:8,background:C.blueMain+"14",border:`1.5px solid ${C.blueMain}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📊</div>
            <div>
              <div style={{color:C.textDark,fontWeight:700,fontSize:13,fontFamily:"monospace"}}>Informe Ejecutivo</div>
              <div style={{color:C.blueMain,fontSize:10,letterSpacing:".08em",textTransform:"uppercase" as const}}>MINERVA Deal Engine</div>
            </div>
          </div>
          {activeId==="report"&&!report&&<div style={{display:"flex",alignItems:"center",gap:8,color:C.blueMain,fontSize:12,fontFamily:"monospace"}}><div style={{width:7,height:7,borderRadius:"50%",background:C.blueMain,animation:"blink .7s infinite"}}/>Generando análisis estratégico...</div>}
          {report&&<div style={{color:C.textDark,fontSize:13,lineHeight:1.85,whiteSpace:"pre-wrap" as const,borderTop:`1px solid ${C.lightBorder2}`,paddingTop:14}}>{report}</div>}
        </div>
      )}

      {phase==="complete"&&(
        <div style={{textAlign:"center" as const,marginTop:24,padding:"24px",background:C.lightCard,border:`1px solid ${C.success}33`,borderRadius:14,boxShadow:"0 2px 12px rgba(5,150,105,.06)"}}>
          <div style={{color:C.success,fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginBottom:6}}>✓ SIMULACIÓN GUARDADA EN TU HISTÓRICO</div>
          <div style={{color:C.textGray,fontSize:12,marginBottom:20,lineHeight:1.6}}>
            Cuando cierres el deal, marca el resultado desde <strong>Mi Perfil → Actividad</strong>.<br/>
            Mientras tanto, puedes descargar el informe como PDF.
          </div>
          <button onClick={downloadHTML} style={{padding:"14px 36px",background:C.textDark,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginRight:12,marginBottom:8}}>
            ⬇ Descargar Informe PDF
          </button>
          <button onClick={()=>{setPhase("idle");setResponses({});setReport(null);setActiveId(null);}} style={{padding:"14px 24px",background:"transparent",border:`1px solid ${C.lightBorder}`,borderRadius:10,color:C.textGray,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
            Nueva simulación
          </button>
        </div>
      )}
      <div ref={endRef}/>
    </div>
  );
}

