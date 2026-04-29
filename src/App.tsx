import { useState, useRef, useEffect, createContext, useContext } from "react";

// ── SUPABASE CONFIG ────────────────────────────────────────────────
const SUPABASE_URL  = "https://tohfuokcngavbmbjsdru.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaGZ1b2tjbmdhdmJtYmpzZHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDIyMTksImV4cCI6MjA5MjYxODIxOX0.gRc-Uv4NaT18SkjFupw6krvT_Nmqt7xt4zfH235siH8";

const sb = {
  h: { "Content-Type":"application/json", "apikey":SUPABASE_ANON, "Authorization":`Bearer ${SUPABASE_ANON}` },
  authH(token:string){ return {...this.h,"Authorization":`Bearer ${token}`}; },
  async signUp(email:string, password:string) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, { method:"POST", headers:this.h, body:JSON.stringify({email,password}) });
    return r.json();
  },
  async signIn(email:string, password:string) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method:"POST", headers:this.h, body:JSON.stringify({email,password}) });
    return r.json();
  },
  async signOut(token:string) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers:this.authH(token) });
  },
  async resetPassword(email:string) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, { method:"POST", headers:this.h, body:JSON.stringify({email}) });
    return r.json();
  },
  async getProfile(token:string, userId:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`, { headers:this.authH(token) });
    const d = await r.json(); return Array.isArray(d)?d[0]:null;
  },
  async upsertProfile(token:string, userId:string, data:any) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method:"POST",
      headers:{...this.authH(token),"Prefer":"resolution=merge-duplicates,return=representation"},
      body:JSON.stringify({id:userId,...data})
    });
    return r.json();
  },async updatePassword(token: string, newPassword: string) {
     const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
       method: "PUT",
       headers: this.authH(token),
       body: JSON.stringify({ password: newPassword })
     });
     return r.json();
   },
  async getSubscription(token:string, userId:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active&select=*&limit=1`, { headers:this.authH(token) });
    const d = await r.json(); return Array.isArray(d)?d[0]:null;
  },
  async saveProfile(token:string, userId:string, profile:any) {
    return this.upsertProfile(token, userId, profile);
  },
};

// ── PALETTE ────────────────────────────────────────────────────────
const C:any = {
  darkBg:"#040D1A", darkSurface:"#0A1628", darkBorder:"#1B3A6B",
  nodeBlue:"#4D9FFF", nodeCyan:"#00A8FF", textLight:"#C8D8F0", textDim:"#3A5070",
  lightBg:"#F5F5F7", lightCard:"#FFFFFF", lightBorder:"#D2D2D7", lightBorder2:"#E8E8ED",
  textDark:"#1D1D1F", textGray:"#6E6E73", textHint:"#86868B",
  blueMain:"#0066CC", blueLight:"#2997FF", error:"#DC2626", success:"#059669",
  gold:"#F0B429", green:"#2ECC71", red:"#E05252", orange:"#E8843A", purple:"#9B59B6",
};

const NODE_TYPES:any = {
  decision:  {color:C.gold,   label:"DECISOR",    sz:28},
  champion:  {color:C.green,  label:"CAMPEÓN",    sz:24},
  gatekeeper:{color:C.red,    label:"BLOQUEADOR", sz:22},
  validator: {color:C.orange, label:"VALIDADOR",  sz:20},
  passive:   {color:C.textDim,label:"PASIVO",     sz:15},
};

// ── DATA ───────────────────────────────────────────────────────────
const COUNTRIES = ["Chile","Argentina","Colombia","México","Perú","Brasil","Uruguay","Ecuador","Bolivia","Paraguay","Venezuela","España","Panamá","Costa Rica","Guatemala","Honduras","El Salvador","Nicaragua","Rep. Dominicana","Cuba","Estados Unidos","Canadá","Otro"];
const INDUSTRIES = ["Alimentaria & Bebidas","Minería & Metalurgia","Farmacéutica & Laboratorio","Hotelería & Hospitalidad","Manufactura Industrial","Petroquímica & Energía","Papel & Celulosa","Salud & Clínicas","Construcción & Contratistas","Facility Services","Retail & Distribución","Tecnología & Software","Agroindustria","Logística & Transporte","Otro"];

const MARKETS:any = {
  alimentaria:{ id:"alimentaria", name:"Alimentaria & Bebidas", icon:"🥛", accent:"#E8A838", shortDesc:"Lácteos · Cárnicos · Snacks · Bebidas", context:"planta de producción alimentaria con procesos CIP/COP, normativa de inocuidad y alta rotación de líneas productivas", keywords:["inocuidad alimentaria","CIP/COP","downtime de línea","mermas de proceso","auditorías sanitarias"] },
  mineria:{ id:"mineria", name:"Minería & Metalurgia", icon:"⛏️", accent:"#C47A3A", shortDesc:"Cobre · Litio · Hierro · Flotación", context:"operación minera con procesos de flotación o lixiviación, alta presión en OPEX y continuidad operacional crítica", keywords:["recuperación metalúrgica","OPEX minero","continuidad operacional","agua de proceso","reactivos"] },
  farmaceutica:{ id:"farmaceutica", name:"Farmacéutica & Lab", icon:"💊", accent:"#2E86AB", shortDesc:"Laboratorios · Farma · Biotech · Dispositivos", context:"planta farmacéutica bajo GMP, validación estricta de procedimientos y trazabilidad de insumos obligatoria", keywords:["GMP","validación de procesos","trazabilidad de lote","cleanroom","cumplimiento normativo"] },
  hoteleria:{ id:"hoteleria", name:"Hotelería & Hospitalidad", icon:"🏨", accent:"#6C5CE7", shortDesc:"Hoteles · Casinos · Resorts · Cadenas", context:"operación hotelera con múltiples propiedades, alta rotación de personal y presión en costos de housekeeping", keywords:["housekeeping","F&B","costo por habitación","estándares de marca","satisfacción del huésped"] },
  manufactura:{ id:"manufactura", name:"Manufactura Industrial", icon:"🏭", accent:"#00B894", shortDesc:"Metalmecánica · Automotriz · Packaging", context:"planta de manufactura con producción continua, mantenimiento de equipos y gestión de efluentes industriales", keywords:["OEE","mantenimiento preventivo","efluentes industriales","costo de conversión","productividad"] },
  petroquimica:{ id:"petroquimica", name:"Petroquímica & Energía", icon:"🛢️", accent:"#E17055", shortDesc:"Refinería · Petroquímica · Generación", context:"planta petroquímica o energética con procesos de alta criticidad y normativa ambiental estricta", keywords:["SIL","HAZOP","normativa ambiental","CAPEX diferido","criticidad de activos"] },
  papel:{ id:"papel", name:"Papel & Celulosa", icon:"📄", accent:"#00CEC9", shortDesc:"Celulosa · Papel · Cartón · Forestales", context:"planta de celulosa o papel con procesos continuos de alta demanda y máxima sensibilidad a continuidad operacional", keywords:["blanqueo","recuperación química","efluentes de proceso","factor de marcha","OPEX de máquina"] },
  salud:{ id:"salud", name:"Salud & Clínicas", icon:"🏥", accent:"#E84393", shortDesc:"Hospitales · Clínicas · Centros médicos", context:"hospital o clínica con esterilización central, cocina y lavandería hospitalaria bajo normativa sanitaria estricta", keywords:["IAAS","esterilización central","normativa sanitaria","residuos hospitalarios","acreditación"] },
  telecom:{ id:"telecom", name:"Telecomunicaciones & IT", icon:"📡", accent:"#0984E3", shortDesc:"Operadoras · Telefonía · ISP · Infraestructura IT", context:"empresa de telecomunicaciones o tecnología con infraestructura crítica, alta exigencia de continuidad de servicio y procesos de licitación formales", keywords:["SLA de red","uptime","licitación","contratos marco","infraestructura crítica"] },
  retail:{ id:"retail", name:"Retail & Logística", icon:"🛒", accent:"#E84393", shortDesc:"Supermercados · Tiendas · Distribuidoras · Logística", context:"operación retail o logística con alta rotación de personal, múltiples puntos de venta o bodegas y presión constante en costos operacionales", keywords:["costo por punto de venta","rotación de inventario","logística last mile","gestión de bodegas","shrinkage"] },
  otro:{ id:"otro", name:"Otro", icon:"✳️", accent:"#636E72", shortDesc:"Describe tu propio mercado", context:"", keywords:[] },
};

const MODELS:any = {
  transaccional:{
    id:"transaccional", name:"Venta Transaccional", icon:"📦",
    accent:C.blueMain, badge:"TRANSACCIONAL",
    tagline:"Precio por unidad · Competencia directa en precio, calidad y servicio",
    decisionType:"OPERACIONAL · PRECIO", timeToClose:"2–6 sem", riskLevel:"BAJO",
    objections:["Ya tenemos proveedor consolidado — cambiar genera riesgo operacional","El precio de su propuesta es mayor al de mi proveedor actual","¿Qué garantías de continuidad de suministro tienen ante quiebres?"],
    proposalSteps:[{n:1,title:"Benchmark directo",detail:"Tabla comparativa precio actual vs propuesta + total cost of ownership."},{n:2,title:"Prueba técnica sin costo",detail:"Producto o servicio en prueba en proceso menor, sin compromiso de compra."},{n:3,title:"Validación técnica",detail:"Fichas y certificados listos para Calidad antes de la reunión de avance."},{n:4,title:"Cierre con Compras",detail:"Contrato marco: precio fijo, SLA de entrega, mínimo de compra negociado."}],
    stakeholders:[
      {id:"compras", name:"Jefe de Compras",  weight:90, type:"decision",   trigger:"Precio · Condiciones · Supply continuo", x:300, y:80},
      {id:"planta",  name:"Jefe de Planta",   weight:60, type:"validator",  trigger:"Calidad técnica · Disponibilidad",        x:130, y:230},
      {id:"calidad", name:"Jefe de Calidad",  weight:50, type:"gatekeeper", trigger:"Fichas técnicas · Aprobaciones",          x:470, y:230},
      {id:"gerencia",name:"Gerencia",         weight:15, type:"passive",    trigger:"Impacto en costo total anual",            x:300, y:360},
    ],
    connections:[{f:"compras",t:"planta",w:.7},{f:"compras",t:"calidad",w:.6},{f:"planta",t:"calidad",w:.4},{f:"calidad",t:"gerencia",w:.3},{f:"compras",t:"gerencia",w:.35}],
    entryNode:"compras",
    agentDefs:[
      {id:"compras_ag", name:"Jefe de Compras",  company:"CLIENTE",    side:"cliente",    icon:"🛒", accent:C.orange,
       sys:(m:any,cl:any)=>`Eres el Jefe de Compras de ${cl.name||"la empresa cliente"} en el sector ${m.name} de Chile. Un proveedor externo presenta "${cl.offerName||"una propuesta comercial"}" para reemplazar a tu proveedor actual. Situación actual: ${cl.situation||"evaluando cambio de proveedor"}. Presupuesto: ${cl.budget||"no especificado"}. Prioridades: precio final vs proveedor actual, condiciones de pago, garantía de suministro continuo, costo real del cambio. Responde en español (máx 140 palabras): objeciones principales y condiciones mínimas para avanzar. Sin protocolo, directo al punto.`},
      {id:"planta_ag",  name:"Jefe de Planta",   company:"CLIENTE",    side:"cliente",    icon:"⚙️", accent:C.orange,
       sys:(m:any,cl:any)=>`Eres el Jefe de Planta de ${cl.name||"la empresa cliente"} (${m.name}, Chile). Un proveedor propone "${cl.offerName||"una propuesta"}". Principal dolor: ${cl.pain||"optimización operacional"}. Prioridades: continuidad operacional, validación técnica, tiempo de transición, impacto en línea de producción. Responde en español (máx 140 palabras): exigencias técnicas concretas y riesgos operacionales que identificas.`},
      {id:"calidad_ag", name:"Jefe de Calidad",  company:"CLIENTE",    side:"cliente",    icon:"🔬", accent:C.green,
       sys:(m:any,cl:any)=>`Eres el Jefe de Calidad de ${cl.name||"la empresa cliente"} (${m.name}, Chile). Un proveedor presenta "${cl.offerName||"una propuesta"}". Palabras clave del sector: ${m.keywords?.join(", ")||"normativa sectorial"}. No apruebas nada sin documentación en regla. Responde en español (máx 140 palabras): documentación exigida y riesgos normativos que identificas.`},
      {id:"rival_ag",   name:"Competidor",        company:"COMPETENCIA", side:"competidor", icon:"⚔️", accent:C.red,
       sys:(m:any,cl:any)=>`Eres el ejecutivo comercial del principal competidor en el segmento ${m.name} en Chile. No representas ninguna empresa específica — nunca menciones nombres de empresas o marcas. Te enteras de que otro proveedor avanza en ${cl.name||"una empresa del sector"} con una propuesta de venta transaccional. Responde en español (máx 140 palabras): qué movimientos harías en los próximos 15 días, cómo te diferenciarías y qué argumento usarías con el decisor clave. Sin nombres de empresas.`},
      {id:"vendedor_ag",name:"Ejecutivo Comercial",company:"TU EMPRESA",  side:"vendedor",   icon:"🎯", accent:C.blueMain,
       sys:(m:any,cl:any)=>`Eres el ejecutivo comercial que presenta "${cl.offerName||"tu propuesta"}" — venta transaccional — a ${cl.name||"el cliente"} en ${m.name}, Chile. Ya escuchaste las objeciones de Compras, Planta y Calidad. El competidor ya se mueve en esta cuenta. Responde en español (máx 160 palabras): cómo manejas las 3 objeciones más duras, qué concesiones harías y cuáles no cederías bajo ningún concepto, y cómo llevas esto a un cierre concreto en las próximas 3 semanas.`},
    ],
  },
  servicio:{
    id:"servicio", name:"Venta de Servicio", icon:"🔧",
    accent:"#00B894", badge:"SERVICIO",
    tagline:"Expertise como producto · El cliente paga por resultado, no por insumo",
    decisionType:"RELACIONAL · ROI BLANDO", timeToClose:"1–4 meses", riskLevel:"MEDIO",
    objections:["Podemos hacer esto internamente — ¿para qué pagar a un externo?","¿Cómo medimos el valor real del servicio? El ROI no es tangible","No queremos compartir datos sensibles de producción con un proveedor"],
    proposalSteps:[{n:1,title:"Diagnóstico gratuito",detail:"Demuestra expertise antes de vender. El diagnóstico ya genera valor."},{n:2,title:"Propuesta con KPIs claros",detail:"Uptime, reducción de incidentes, horas ahorradas. Métricas acordadas."},{n:3,title:"Contrato trimestral + SLA",detail:"Cláusula de salida sin penalidad en período inicial. Reduce el riesgo."},{n:4,title:"Precio por outcome",detail:"Parte del fee ligada a resultados. Alinea incentivos, genera confianza."}],
    stakeholders:[
      {id:"gerencia", name:"Gerencia General",  weight:90, type:"decision",   trigger:"Foco estratégico · Liberar OPEX",    x:300, y:80},
      {id:"planta",   name:"Jefe de Planta",    weight:85, type:"champion",   trigger:"Dolor operacional · Expertise",      x:130, y:230},
      {id:"legal",    name:"Legal / Contratos", weight:45, type:"gatekeeper", trigger:"SLA · Confidencialidad · Penalidades",x:470, y:230},
      {id:"compras",  name:"Jefe de Compras",   weight:25, type:"passive",    trigger:"Precio del servicio contratado",     x:300, y:360},
    ],
    connections:[{f:"planta",t:"gerencia",w:.9},{f:"gerencia",t:"legal",w:.7},{f:"legal",t:"compras",w:.5},{f:"planta",t:"legal",w:.4},{f:"gerencia",t:"compras",w:.3}],
    entryNode:"planta",
    agentDefs:[
      {id:"ger_ag",     name:"Gerente General",   company:"CLIENTE",    side:"cliente",    icon:"🏢", accent:C.purple,
       sys:(m:any,cl:any)=>`Eres el Gerente General de ${cl.name||"la empresa cliente"} (${m.name}, Chile). Un proveedor externo ofrece "${cl.offerName||"un servicio especializado"}" — sin producto físico, prometiendo liberar capacidad interna. Situación actual: ${cl.situation||"evaluando proveedor externo"}. Prioridades: si el ROI es real y medible, si libera recursos para el negocio core. Responde en español (máx 140 palabras): qué argumentos te convencerían y qué condiciones pondría tu empresa para firmar.`},
      {id:"planta_ag",  name:"Jefe de Planta",    company:"CLIENTE",    side:"cliente",    icon:"⚙️", accent:C.orange,
       sys:(m:any,cl:any)=>`Eres el Jefe de Planta de ${cl.name||"la empresa cliente"} (${m.name}, Chile). Un proveedor ofrece "${cl.offerName||"un servicio"}". Dolor principal: ${cl.pain||"ineficiencia operacional"}. Podrías ser el campeón si el proveedor demuestra valor real. Responde en español (máx 140 palabras): qué problema real resolvería y qué reservas genuinas tienes hoy.`},
      {id:"legal_ag",   name:"Legal / Contratos", company:"CLIENTE",    side:"cliente",    icon:"⚖️", accent:C.red,
       sys:(m:any,cl:any)=>`Eres el responsable legal de ${cl.name||"la empresa cliente"} (${m.name}, Chile). Un proveedor propone "${cl.offerName||"un contrato de servicio"}". Debes revisar: SLA y penalidades, confidencialidad, condiciones de salida anticipada, responsabilidad legal por resultados. Responde en español (máx 130 palabras): cláusulas que exigirías y red flags contractuales que identificas.`},
      {id:"rival_ag",   name:"Competidor",         company:"COMPETENCIA", side:"competidor", icon:"⚔️", accent:C.red,
       sys:(m:any,cl:any)=>`Eres el ejecutivo comercial del principal competidor en servicios para el sector ${m.name} en Chile. Nunca menciones nombres de empresas o marcas. Te enteras de que otro proveedor avanza en ${cl.name||"una empresa"} con una propuesta de venta de servicio. Responde en español (máx 140 palabras): movimientos que harías en los próximos 15 días y cómo te diferenciarías. Sin nombres de empresas.`},
      {id:"vendedor_ag",name:"Ejecutivo Comercial", company:"TU EMPRESA",  side:"vendedor",   icon:"🎯", accent:C.blueMain,
       sys:(m:any,cl:any)=>`Eres el ejecutivo comercial que presenta "${cl.offerName||"tu propuesta de servicio"}" a ${cl.name||"el cliente"} en ${m.name}, Chile. El ROI es difícil de demostrar tangiblemente, el cliente cree que puede hacerlo internamente y Legal tiene reservas serias. Responde en español (máx 170 palabras): cómo construyes el caso de valor con datos concretos, qué concesiones harías en el contrato para destrabar la firma, y cómo demuestras el expertise diferencial antes de que firmen.`},
    ],
  },
  otro:{
    id:"otro", name:"Modelo Personalizado", icon:"⚙️",
    accent:"#636E72", badge:"PERSONALIZADO",
    tagline:"Define tu propio modelo comercial",
    decisionType:"PERSONALIZADO", timeToClose:"A definir", riskLevel:"VARIABLE",
    objections:["Define las objeciones clave de tu modelo en el campo de descripción","La simulación adaptará los agentes al contexto que describas","Cuanto más detallado el contexto, más preciso el análisis"],
    proposalSteps:[{n:1,title:"Define tu propuesta de valor",detail:"Describe el valor diferencial y cómo lo comunicarás al cliente."},{n:2,title:"Identifica los decisores clave",detail:"Mapea quién decide, quién valida y quién puede bloquear."},{n:3,title:"Construye el caso de negocio",detail:"ROI, métricas de éxito y condiciones de cierre."},{n:4,title:"Cierra con claridad",detail:"Propuesta formal, SLA y próximos pasos acordados."}],
    stakeholders:[
      {id:"gerencia",  name:"Gerencia",      weight:80, type:"decision",   trigger:"Impacto estratégico · ROI",          x:300, y:80},
      {id:"compras",   name:"Compras",        weight:60, type:"validator",  trigger:"Precio · Condiciones comerciales",   x:130, y:230},
      {id:"tecnico",   name:"Área Técnica",   weight:70, type:"champion",   trigger:"Viabilidad técnica · Implementación",x:470, y:230},
      {id:"legal",     name:"Legal",          weight:40, type:"gatekeeper", trigger:"Contrato · Cumplimiento normativo",  x:300, y:360},
    ],
    connections:[{f:"gerencia",t:"compras",w:.7},{f:"gerencia",t:"tecnico",w:.8},{f:"tecnico",t:"compras",w:.5},{f:"compras",t:"legal",w:.6},{f:"gerencia",t:"legal",w:.4}],
    entryNode:"gerencia",
    agentDefs:[
      {id:"gerencia_ag", name:"Gerencia",     company:"CLIENTE",    side:"cliente",    icon:"🏢", accent:"#636E72",
       sys:(m:any,cl:any)=>`Eres el Gerente de ${cl.name||"la empresa cliente"} en ${m.name||"el mercado"}, Chile. Un proveedor presenta "${cl.offerName||"una propuesta"}". Modelo comercial: ${(cl as any).customModel||"no especificado"}. Contexto de mercado: ${m.customContext||m.context||"sector industrial"}. Situación: ${cl.situation||"evaluando proveedor"}. Responde en español (máx 140 palabras): qué argumentos te convencerían y qué condiciones exigirías para avanzar.`},
      {id:"compras_ag",  name:"Compras",      company:"CLIENTE",    side:"cliente",    icon:"🛒", accent:"#636E72",
       sys:(m:any,cl:any)=>`Eres el responsable de Compras de ${cl.name||"la empresa cliente"} (${m.name||"mercado"}, Chile). Evalúas "${cl.offerName||"una propuesta"}". Modelo: ${(cl as any).customModel||"no especificado"}. Prioridades: precio, condiciones, garantías. Responde en español (máx 130 palabras): objeciones y condiciones mínimas para avanzar.`},
      {id:"tecnico_ag",  name:"Área Técnica", company:"CLIENTE",    side:"cliente",    icon:"⚙️", accent:"#636E72",
       sys:(m:any,cl:any)=>`Eres el responsable técnico de ${cl.name||"la empresa cliente"} (${m.name||"mercado"}, Chile). Evalúas la viabilidad de "${cl.offerName||"una propuesta"}". Modelo: ${(cl as any).customModel||"no especificado"}. Responde en español (máx 130 palabras): exigencias técnicas y riesgos de implementación.`},
      {id:"rival_ag",    name:"Competidor",   company:"COMPETENCIA", side:"competidor", icon:"⚔️", accent:C.red,
       sys:(_m:any,cl:any)=>`Eres el ejecutivo del principal competidor en el mercado de ${cl.name||"este cliente"}, Chile. Nunca menciones nombres de empresas. Te enteras de que otro proveedor avanza con "${cl.offerName||"una propuesta"}". Modelo: ${(cl as any).customModel||"no especificado"}. Responde en español (máx 130 palabras): movimientos que harías y cómo te diferenciarías.`},
      {id:"vendedor_ag", name:"Ejecutivo Comercial", company:"TU EMPRESA", side:"vendedor", icon:"🎯", accent:C.blueMain,
       sys:(m:any,cl:any)=>`Eres el ejecutivo comercial que presenta "${cl.offerName||"tu propuesta"}" a ${cl.name||"el cliente"}, Chile. Modelo comercial propio: ${(cl as any).customModel||"no especificado"}. Contexto de mercado: ${m.customContext||m.context||"sector industrial"}. Dolor del cliente: ${cl.pain||"no especificado"}. Responde en español (máx 160 palabras): cómo manejas las objeciones principales, qué concesiones harías y cómo llevas esto a un cierre concreto.`},
    ],
  },
};

// ── API CALL ───────────────────────────────────────────────────────
async function callClaude(system: string, user: string): Promise<string> {
  try {
    const r = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, user }),
    });
    if (!r.ok) throw new Error("API error");
    const d = await r.json();
    return d.content || "Sin respuesta.";
  } catch(e) {
    return "Error al conectar con el motor de IA.";
  }
}

// ── HELPERS ────────────────────────────────────────────────────────
function Tag({ children, color, small }:any) {
  return <span style={{ background:color+"18", border:`1px solid ${color}40`, color, fontSize:small?9:10, padding:small?"2px 8px":"3px 11px", borderRadius:20, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:".08em", textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>{children}</span>;
}

function ContextBar({ market, model, offerName }:any) {
  if (!market) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 14px", marginBottom:24, background:C.lightBg, borderRadius:10, border:`1px solid ${C.lightBorder}`, flexWrap:"wrap" as const }}>
      <span style={{fontSize:15}}>{market.icon}</span>
      <Tag color={market.accent} small>{market.name}</Tag>
      {model && <><span style={{color:C.lightBorder,fontSize:12}}>→</span><span style={{fontSize:14}}>{model.icon}</span><Tag color={model.accent} small>{model.badge}</Tag></>}
      {offerName && <><span style={{color:C.lightBorder,fontSize:12}}>→</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.blueMain}}>"{offerName}"</span></>}
    </div>
  );
}

// ── APP HEADER ─────────────────────────────────────────────────────
function AppHeader({ step, onNav, user, onSignOut }:any) {
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

// ── BG NODES ───────────────────────────────────────────────────────
const BGN=[{x:12,y:18,r:3,d:0},{x:35,y:8,r:2,d:.4},{x:58,y:22,r:4,d:.8},{x:78,y:12,r:2,d:.2},{x:88,y:35,r:3,d:1.1},{x:92,y:60,r:2,d:.6},{x:70,y:80,r:3,d:.9},{x:45,y:92,r:2,d:.3},{x:20,y:78,r:4,d:1.4},{x:8,y:55,r:2,d:.7},{x:25,y:42,r:3,d:1.0},{x:62,y:55,r:2,d:.5},{x:48,y:35,r:5,d:.1},{x:72,y:45,r:2,d:1.3},{x:35,y:62,r:3,d:.8}];
const BGE=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,12],[1,12],[12,11],[11,13],[13,2],[4,9],[9,8],[8,7],[7,6],[6,13],[5,10],[10,9],[10,14],[14,11],[14,3]];
const HEX=[{cx:50,cy:20},{cx:80,cy:36},{cx:80,cy:64},{cx:50,cy:80},{cx:20,cy:64},{cx:20,cy:36}];

// ── AUTH CONTEXT ───────────────────────────────────────────────────
type Route = "login" | "onboarding" | "pricing" | "dashboard";

interface AuthState {
  session: any;
  profile: any;
  subscription: any;
  loading: boolean;
  route: Route;
  navigate: (r: Route) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthCtx = createContext<AuthState>({
  session:null, profile:null, subscription:null, loading:true,
  route:"login", navigate:()=>{}, refresh:async()=>{}, signOut:async()=>{},
});
const useAuth = () => useContext(AuthCtx);

function resolveRoute(session:any, profile:any, subscription:any): Route {
  if (!session) return "login";
  if (!profile?.profile_completed) return "onboarding";
  if (!subscription) return "pricing";
  return "dashboard";
}

// ── AUTH GATE ──────────────────────────────────────────────────────
function AuthGate() {
  const [session,      setSession]      = useState<any>(null);
  const [profile,      setProfile]      = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [route,        setRoute]        = useState<Route>("login");

  const load = async (sess:any) => {
    if (!sess) {
      setProfile(null); setSubscription(null);
      setRoute("login"); setLoading(false); return;
    }
    try {
      const [prof, sub] = await Promise.all([
        sb.getProfile(sess.access_token, sess.user.id),
        sb.getSubscription(sess.access_token, sess.user.id),
      ]);
      setProfile(prof || null);
      setSubscription(sub || null);
      setRoute(resolveRoute(sess, prof, sub));
    } catch {
      setProfile(null); setSubscription(null); setRoute("login");
    }
    setLoading(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem("minerva_session");
    if (stored) {
      try { const sess = JSON.parse(stored); setSession(sess); load(sess); }
      catch { setLoading(false); }
    } else { setLoading(false); }
  }, []);

  const refresh = async () => { setLoading(true); await load(session); };

  const signOut = async () => {
    if (session?.access_token) { try { await sb.signOut(session.access_token); } catch {} }
    localStorage.removeItem("minerva_session");
    setSession(null); setProfile(null); setSubscription(null);
    setRoute("login"); setLoading(false);
  };

  const updateSession = (sess:any) => {
    setSession(sess);
    if (sess) localStorage.setItem("minerva_session", JSON.stringify(sess));
    else localStorage.removeItem("minerva_session");
    setLoading(true);
    load(sess);
  };

  const navigate = (r: Route) => setRoute(r);

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.darkBg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:48,height:48,border:`3px solid ${C.darkBorder}`,borderTopColor:C.nodeCyan,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 16px"}}/>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.nodeCyan,letterSpacing:".2em"}}>CARGANDO...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <AuthCtx.Provider value={{session,profile,subscription,loading,route,navigate,refresh,signOut}}>
      {route==="login"      && <LoginScreen onAuth={updateSession}/>}
      {route==="onboarding" && <OnboardingRoute/>}
      {route==="pricing"    && <PricingRoute/>}
      {route==="dashboard"  && <DashboardScreen/>}
    </AuthCtx.Provider>
  );
}

// ── LOGIN SCREEN ───────────────────────────────────────────────────
function LoginScreen({ onAuth }:any) {
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

// ── ONBOARDING ROUTE ───────────────────────────────────────────────
function OnboardingRoute() {
  const { session, subscription, refresh, navigate } = useAuth();
  const [empresa, setEmpresa] = useState(""); const [pais, setPais] = useState(""); const [giro, setGiro] = useState(""); const [loading, setLoading] = useState(false); const [err, setErr] = useState("");
  const sel = { width:"100%", padding:"11px 14px", borderRadius:10, fontSize:13, border:`1.5px solid ${C.lightBorder}`, background:C.lightCard, color:C.textDark, fontFamily:"inherit", outline:"none", boxSizing:"border-box" as const };

  if (!session) { navigate("login"); return null; }

  const handleSave = async () => {
    if (!empresa.trim()) { setErr("Ingresa el nombre de tu empresa"); return; }
    if (!pais) { setErr("Selecciona tu país"); return; }
    if (!giro) { setErr("Selecciona el giro"); return; }
    setLoading(true);
    try {
      await sb.upsertProfile(session.access_token, session.user.id, {
        empresa, pais, giro, onboarding_done:true, profile_completed:true
      });
      await refresh();
      navigate(subscription ? "dashboard" : "pricing");
    } catch { setErr("Error al guardar. Intenta nuevamente."); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.lightBg,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px",fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');*{box-sizing:border-box}`}</style>
      <div style={{width:"100%",maxWidth:460}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:32,justifyContent:"center"}}>
          <div style={{width:36,height:36,borderRadius:9,background:C.darkBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🧠</div>
          <div><div style={{fontSize:13,fontWeight:800,color:C.textDark}}>MINERVA</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.blueMain,letterSpacing:".1em"}}>DEAL.ENGINE</div></div>
        </div>

        {/* Progress steps */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:32,justifyContent:"center"}}>
          {["Cuenta","Perfil","Plan","Dashboard"].map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:24,height:24,borderRadius:"50%",background:i===0?C.success:i===1?C.blueMain:C.lightBorder2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:i<=1?"#fff":C.textHint,fontFamily:"'JetBrains Mono',monospace"}}>{i===0?"✓":i+1}</div>
                <span style={{fontSize:11,fontWeight:i===1?700:400,color:i===1?C.textDark:C.textHint}}>{s}</span>
              </div>
              {i<3&&<div style={{width:20,height:1,background:C.lightBorder,marginLeft:2}}/>}
            </div>
          ))}
        </div>

        <div style={{background:C.lightCard,borderRadius:20,padding:"40px 36px",border:`1px solid ${C.lightBorder}`,boxShadow:"0 4px 40px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:22,fontWeight:800,color:C.textDark,letterSpacing:"-.03em",marginBottom:6}}>Cuéntanos sobre<br/>tu empresa</div>
          <div style={{fontSize:13,color:C.textGray,lineHeight:1.6,marginBottom:24}}>3 datos que personalizan todos los agentes de tus simulaciones.</div>
          {err&&<div style={{padding:"9px 13px",borderRadius:8,marginBottom:14,fontSize:12,background:C.error+"10",border:`1px solid ${C.error}30`,color:C.error}}>{err}</div>}
          <div style={{marginBottom:12}}><label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>NOMBRE DE TU EMPRESA</label><input value={empresa} onChange={e=>setEmpresa(e.target.value)} placeholder="Ej: Soluciones Industriales..." style={{...sel,appearance:"none" as any}} onFocus={e=>(e.target.style.borderColor=C.blueMain)} onBlur={e=>(e.target.style.borderColor=C.lightBorder)}/></div>
          <div style={{marginBottom:12}}><label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>PAÍS DE OPERACIÓN</label><select value={pais} onChange={e=>setPais(e.target.value)} style={sel}><option value="">Selecciona un país...</option>{COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{marginBottom:28}}><label style={{fontSize:11,color:C.textGray,display:"block",marginBottom:5,fontFamily:"'JetBrains Mono',monospace",letterSpacing:".06em"}}>GIRO DE TU EMPRESA</label><select value={giro} onChange={e=>setGiro(e.target.value)} style={sel}><option value="">Selecciona un giro...</option>{INDUSTRIES.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
          <button onClick={handleSave} disabled={loading} style={{width:"100%",padding:"14px",background:C.textDark,border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",opacity:loading?.7:1}}>
            {loading?"Guardando...":"Continuar → Elegir plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== CHECKOUT ROUTE COMPLETO =====
app.get('/checkout', (req, res) => {
  const { plan } = req.query;
  
  // Validar plan
  if (!plan || !['salesman', 'pyme'].includes(plan)) {
    return res.redirect('https://minervaai-production-9c2d.up.railway.app');
  }

  // Configuración de planes
  const planDetails = {
    salesman: { 
      name: 'Plan Salesman', 
      price: 30000,
      originalPrice: 60000,
      discount: 50,
      features: '1 usuario, 20 simulaciones/mes, Dashboard personal',
      badge: '🔥 OFERTA 50% OFF',
      popular: false
    },
    pyme: { 
      name: 'Plan Pyme Enterprise', 
      price: 300000, 
      features: '5 usuarios, 100 simulaciones/mes, Dashboard empresa + vendedor',
      badge: '⭐ MÁS POPULAR',
      popular: true
    }
  };

  const selectedPlan = planDetails[plan];
  
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Checkout · ${selectedPlan.name} · MINERVA</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #040D1A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #F0F4FF; min-height: 100vh; }
.container { max-width: 500px; margin: 40px auto; padding: 20px; }
.header { text-align: center; margin-bottom: 32px; }
.brand { font-size: 22px; font-weight: 800; margin-bottom: 4px; letter-spacing: -.02em; }
.subtitle { font-size: 10px; color: #00A8FF; letter-spacing: .2em; font-family: monospace; }
.card { background: #0A1628; border: 1px solid #1B3A6B; border-radius: 16px; padding: 24px; margin-bottom: 24px; position: relative; }
.plan-badge { 
  position: absolute; top: -12px; left: 50%; transform: translateX(-50%); 
  background: ${selectedPlan.popular ? '#0066CC' : '#ff6b35'}; 
  color: #fff; font-size: 10px; font-weight: 700; 
  padding: 4px 12px; border-radius: 20px; 
  letter-spacing: .05em; white-space: nowrap;
}
.plan-name { font-size: 18px; font-weight: 700; margin: 16px 0 8px; }
.original-price { 
  font-size: 16px; color: #ff6b6b; text-decoration: line-through; 
  margin-bottom: 4px; opacity: .8;
}
.plan-price { font-size: 32px; font-weight: 800; margin-bottom: 6px; }
.plan-price span { font-size: 16px; opacity: .6; font-weight: 400; }
.discount-text { 
  font-size: 13px; color: #059669; font-weight: 600; 
  margin-bottom: 12px; display: flex; align-items: center; gap: 6px;
}
.plan-features { font-size: 14px; color: #C8D8F0; line-height: 1.5; }
.form-group { margin-bottom: 18px; }
.form-label { display: block; margin-bottom: 8px; font-size: 13px; color: #C8D8F0; font-weight: 600; }
.form-input { 
  width: 100%; padding: 14px; border: 1px solid #1B3A6B; border-radius: 10px; 
  background: #040D1A; color: #F0F4FF; font-size: 14px; transition: border-color .2s;
}
.form-input:focus { outline: none; border-color: #0066CC; box-shadow: 0 0 0 3px rgba(0,102,204,.1); }
.discount-input { background: rgba(0,102,204,.06); border-color: rgba(0,102,204,.3); }
.discount-hint { font-size: 11px; color: rgba(200,216,240,.4); margin-top: 4px; }
.price-summary { 
  border-top: 1px solid #1B3A6B; padding-top: 20px; margin-bottom: 24px; 
  background: rgba(0,102,204,.03); border-radius: 8px; padding: 16px;
}
.price-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 14px; }
.discount-row { color: #059669; display: none; font-weight: 600; }
.total-row { 
  font-size: 20px; font-weight: 800; color: #F0F4FF; 
  border-top: 1px solid rgba(255,255,255,.1); padding-top: 12px; margin-top: 12px;
}
.submit-btn { 
  width: 100%; padding: 18px; background: linear-gradient(135deg, #0066CC 0%, #0052A3 100%); 
  color: #fff; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; 
  cursor: pointer; transition: all .3s; box-shadow: 0 4px 15px rgba(0,102,204,.3);
}
.submit-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,102,204,.4); }
.submit-btn:active { transform: translateY(0); }
.loading { opacity: .7; pointer-events: none; cursor: not-allowed; }
.security-badge { 
  text-align: center; margin-top: 16px; font-size: 11px; color: rgba(200,216,240,.3); 
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
</style>
</head>
<body>

<div class="container">
  
  <!-- Header -->
  <div class="header">
    <div class="brand">MINERVA</div>
    <div class="subtitle">CHECKOUT SEGURO</div>
  </div>

  <!-- Plan Details -->
  <div class="card">
    <div class="plan-badge">${selectedPlan.badge}</div>
    <div class="plan-name">${selectedPlan.name}</div>
    
    ${selectedPlan.originalPrice ? `
      <div class="original-price">$${selectedPlan.originalPrice.toLocaleString()} CLP/mes</div>
      <div class="plan-price" style="color:#059669;">$${selectedPlan.price.toLocaleString()} <span>CLP/mes</span></div>
      <div class="discount-text">
        <span>💰</span> ¡Ahorras $${(selectedPlan.originalPrice - selectedPlan.price).toLocaleString()} CLP mensuales!
      </div>
    ` : `
      <div class="plan-price">$${selectedPlan.price.toLocaleString()} <span>CLP/mes</span></div>
    `}
    
    <div class="plan-features">${selectedPlan.features}</div>
  </div>

  <!-- Checkout Form -->
  <div class="card">
    <form id="checkoutForm">
      
      <div class="form-group">
        <label class="form-label">📧 Email</label>
        <input type="email" id="email" class="form-input" required placeholder="tu@empresa.com" autocomplete="email">
      </div>

      <div class="form-group">
        <label class="form-label">👤 Nombre completo</label>
        <input type="text" id="name" class="form-input" required placeholder="Juan Pérez" autocomplete="name">
      </div>

      <div class="form-group">
        <label class="form-label">🎁 Código de descuento (opcional)</label>
        <input type="text" id="discountCode" class="form-input discount-input" placeholder="PRUEBA o PRUEBA1" autocomplete="off">
        <div class="discount-hint">Usa PRUEBA o PRUEBA1 para acceso demo ($350 CLP)</div>
      </div>

      <!-- Price Summary -->
      <div class="price-summary">
        <div class="price-row">
          <span>💳 Precio base</span>
          <span>$${selectedPlan.price.toLocaleString()} CLP</span>
        </div>
        <div class="price-row discount-row" id="discountRow">
          <span>🎯 Descuento demo aplicado</span>
          <span id="discountAmount">-</span>
        </div>
        <div class="price-row total-row">
          <span>💰 Total a pagar</span>
          <span id="finalPrice">$${selectedPlan.price.toLocaleString()} CLP</span>
        </div>
      </div>

      <button type="submit" class="submit-btn" id="submitBtn">
        🔒 Pagar con WebPay →
      </button>

      <div class="security-badge">
        <span>🔐</span> Pago seguro encriptado · Procesado por Flow
      </div>

    </form>
  </div>
</div>

<script>
const basePrice = ${selectedPlan.price};
const plan = '${plan}';

// Discount code logic con animación
document.getElementById('discountCode').addEventListener('input', function() {
  const code = this.value.trim().toUpperCase();
  const discountRow = document.getElementById('discountRow');
  const discountAmount = document.getElementById('discountAmount');
  const finalPrice = document.getElementById('finalPrice');
  
  if (code === 'PRUEBA' || code === 'PRUEBA1') {
    const discount = basePrice - 350;
    discountRow.style.display = 'flex';
    discountRow.style.animation = 'fadeIn 0.3s ease';
    discountAmount.textContent = '-$' + discount.toLocaleString() + ' CLP';
    finalPrice.textContent = '$350 CLP';
    finalPrice.style.color = '#059669';
    
    // Efecto visual en el campo
    this.style.borderColor = '#059669';
    this.style.background = 'rgba(5,150,105,.1)';
  } else {
    discountRow.style.display = 'none';
    finalPrice.textContent = '$' + basePrice.toLocaleString() + ' CLP';
    finalPrice.style.color = '#F0F4FF';
    
    // Restaurar estilo original
    this.style.borderColor = 'rgba(0,102,204,.3)';
    this.style.background = 'rgba(0,102,204,.06)';
  }
});

// Form submission con validación mejorada
document.getElementById('checkoutForm').addEventListener('submit', function(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submitBtn');
  const email = document.getElementById('email').value.trim();
  const name = document.getElementById('name').value.trim();
  const discountCode = document.getElementById('discountCode').value.trim();
  
  // Validaciones
  if (!email || !name) {
    alert('⚠️ Por favor completa todos los campos requeridos');
    return;
  }
  
  if (!email.includes('@') || !email.includes('.')) {
    alert('⚠️ Por favor ingresa un email válido');
    document.getElementById('email').focus();
    return;
  }
  
  // Show loading con animación
  submitBtn.innerHTML = '⏳ Procesando pago...';
  submitBtn.classList.add('loading');
  
  // Calculate final amount
  let amount = basePrice;
  if (discountCode.toUpperCase() === 'PRUEBA' || discountCode.toUpperCase() === 'PRUEBA1') {
    amount = 350;
  }
  
  // Simular delay para mostrar loading
  setTimeout(() => {
    // Redirect to Flow
    const params = new URLSearchParams({
      plan: plan,
      email: email,
      name: name,
      amount: amount,
      discount_code: discountCode
    });
    
    window.location.href = '/api/flow-create-order?' + params.toString();
  }, 800);
});

// Animación CSS
const style = document.createElement('style');
style.textContent = \`
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
\`;
document.head.appendChild(style);
</script>

</body>
</html>`);
});
// ── MARKET SCREEN ──────────────────────────────────────────────────
function MarketScreen({ selected, onSelect, customContext, onCustomContext }:any) {
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:8,textTransform:"uppercase" as const}}>Paso 1 de 5</div>
        <div style={{fontSize:"clamp(22px,4vw,32px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1,marginBottom:8}}>¿En qué industria opera<br/>tu cliente?</div>
        <div style={{fontSize:14,color:C.textGray,lineHeight:1.6}}>Selecciona el mercado para adaptar los agentes y el contexto de la simulación.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(188px,1fr))",gap:10}}>
        {Object.values(MARKETS).map((m:any)=>{
          const sel=selected?.id===m.id;
          return <div key={m.id} onClick={()=>onSelect(m)} style={{background:sel?m.accent+"12":C.lightCard,border:`2px solid ${sel?m.accent:C.lightBorder}`,borderRadius:14,padding:"18px 16px",cursor:"pointer",transition:"all .18s",boxShadow:sel?`0 0 0 4px ${m.accent}16`:"none"}} onMouseEnter={e=>{if(!sel){(e.currentTarget as any).style.borderColor=m.accent+"70";(e.currentTarget as any).style.background=m.accent+"08";}}} onMouseLeave={e=>{if(!sel){(e.currentTarget as any).style.borderColor=C.lightBorder;(e.currentTarget as any).style.background=C.lightCard;}}}>
            <div style={{fontSize:26,marginBottom:9}}>{m.icon}</div>
            <div style={{fontSize:13,fontWeight:700,color:C.textDark,marginBottom:4}}>{m.name}</div>
            <div style={{fontSize:11,color:C.textGray,lineHeight:1.5}}>{m.shortDesc}</div>
            {sel&&<div style={{marginTop:9,display:"inline-flex",alignItems:"center",gap:5,padding:"2px 9px",borderRadius:20,background:m.accent,color:"#fff",fontSize:9,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>✓ SELECCIONADO</div>}
          </div>;
        })}
      </div>
      {selected?.id==="otro"&&(
        <div style={{marginTop:16,animation:"mFadeUp .3s ease"}}>
          <label style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase" as const,fontFamily:"'JetBrains Mono',monospace",color:C.textGray,marginBottom:6,display:"block"}}>Describe el mercado / contexto del cliente</label>
          <textarea
            value={customContext||""}
            onChange={e=>onCustomContext(e.target.value)}
            rows={3}
            placeholder="Ej: Empresa constructora con proyectos en minería y obras civiles, alta presión en costos y plazos, decisiones centralizadas en gerencia de proyectos..."
            style={{width:"100%",padding:"12px 14px",borderRadius:10,fontSize:13,border:`1.5px solid ${C.lightBorder}`,background:C.lightCard,color:C.textDark,fontFamily:"inherit",outline:"none",resize:"vertical" as const,boxSizing:"border-box" as const,lineHeight:1.6}}
            onFocus={e=>(e.target.style.borderColor=C.blueMain)}
            onBlur={e=>(e.target.style.borderColor=C.lightBorder)}
          />
        </div>
      )}
    </div>
  );
}

// ── MODEL SCREEN ───────────────────────────────────────────────────
function ModelScreen({ market, selected, onSelect, customModel, onCustomModel }:any) {
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <ContextBar market={market} model={null} offerName={null}/>
      <div style={{marginBottom:28}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:8,textTransform:"uppercase" as const}}>Paso 2 de 5</div>
        <div style={{fontSize:"clamp(22px,4vw,32px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1,marginBottom:8}}>¿Cómo vas a generar<br/>valor en esta cuenta?</div>
        <div style={{fontSize:14,color:C.textGray,lineHeight:1.6}}>El modelo define el mapa de stakeholders, los agentes y el blueprint de propuesta.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(275px,1fr))",gap:14,marginBottom:14}}>
        {Object.values(MODELS).map((m:any)=>{
          const sel=selected?.id===m.id;
          return <div key={m.id} onClick={()=>onSelect(m)} style={{background:sel?m.accent+"0e":C.lightCard,border:`2px solid ${sel?m.accent:C.lightBorder}`,borderRadius:16,padding:24,cursor:"pointer",transition:"all .18s",boxShadow:sel?`0 0 0 4px ${m.accent}14`:"none"}} onMouseEnter={e=>{if(!sel)(e.currentTarget as any).style.borderColor=m.accent+"66";}} onMouseLeave={e=>{if(!sel)(e.currentTarget as any).style.borderColor=C.lightBorder;}}>
            <div style={{fontSize:30,marginBottom:11}}>{m.icon}</div>
            <Tag color={m.accent}>{m.badge}</Tag>
            <div style={{fontSize:16,fontWeight:800,color:C.textDark,margin:"10px 0 6px"}}>{m.name}</div>
            <div style={{fontSize:12,color:C.textGray,lineHeight:1.6,marginBottom:14}}>{m.tagline}</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap" as const,marginBottom:14}}>
              <Tag color={C.textHint} small>⏱ {m.timeToClose}</Tag>
              <Tag color={m.riskLevel==="BAJO"?"#059669":m.riskLevel==="ALTO"?"#DC2626":"#D97706"} small>Riesgo {m.riskLevel}</Tag>
            </div>
            <div style={{padding:"10px 12px",background:C.lightBg,borderRadius:8,borderLeft:`3px solid ${m.accent}`}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textHint,letterSpacing:".08em",marginBottom:3}}>TIPO DE DECISIÓN</div>
              <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:m.accent}}>{m.decisionType}</div>
            </div>
          </div>;
        })}
      </div>
      {selected?.id==="otro"&&(
        <div style={{marginBottom:14,animation:"mFadeUp .3s ease"}}>
          <label style={{fontSize:10,letterSpacing:".08em",textTransform:"uppercase" as const,fontFamily:"'JetBrains Mono',monospace",color:C.textGray,marginBottom:6,display:"block"}}>Describe tu modelo comercial</label>
          <textarea
            value={customModel||""}
            onChange={e=>onCustomModel(e.target.value)}
            rows={3}
            placeholder="Ej: Venta consultiva de soluciones de eficiencia energética con contratos anuales, modelo de ahorro garantizado, con ingeniería en campo durante implementación..."
            style={{width:"100%",padding:"12px 14px",borderRadius:10,fontSize:13,border:`1.5px solid ${C.lightBorder}`,background:C.lightCard,color:C.textDark,fontFamily:"inherit",outline:"none",resize:"vertical" as const,boxSizing:"border-box" as const,lineHeight:1.6}}
            onFocus={e=>(e.target.style.borderColor=C.blueMain)}
            onBlur={e=>(e.target.style.borderColor=C.lightBorder)}
          />
        </div>
      )}
      {selected&&<>
        <div style={{background:C.lightBg,border:`1px solid ${C.lightBorder}`,borderRadius:14,padding:20,marginBottom:12,animation:"mFadeUp .3s ease"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:selected.accent,letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:12}}>Blueprint — {selected.badge}</div>
          {selected.proposalSteps.map((ps:any,i:number)=><div key={i} style={{display:"flex",gap:11,alignItems:"flex-start",padding:"8px 0",borderBottom:i<selected.proposalSteps.length-1?`1px solid ${C.lightBorder2}`:"none"}}>
            <div style={{minWidth:22,height:22,borderRadius:"50%",flexShrink:0,background:selected.accent+"16",border:`1.5px solid ${selected.accent}`,color:selected.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,fontFamily:"'JetBrains Mono',monospace"}}>{ps.n}</div>
            <div><div style={{fontSize:12,fontWeight:700,color:C.textDark,marginBottom:2}}>{ps.title}</div><div style={{fontSize:11,color:C.textGray,lineHeight:1.55}}>{ps.detail}</div></div>
          </div>)}
        </div>
        <div style={{background:C.lightBg,border:`1px solid #FCA5A520`,borderRadius:14,padding:"14px 18px",animation:"mFadeUp .35s ease"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:"#DC2626",letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:9}}>Objeciones típicas</div>
          {selected.objections.map((o:string,i:number)=><div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<selected.objections.length-1?`1px solid ${C.lightBorder2}`:"none"}}><span style={{color:"#DC2626",flexShrink:0}}>⚠</span><span style={{fontSize:12,color:C.textGray,lineHeight:1.6}}>{o}</span></div>)}
        </div>
      </>}
    </div>
  );
}

// ── CLIENT SCREEN ──────────────────────────────────────────────────
function ClientScreen({ market, model, data, onChange }:any) {
  const inp:any = { background:C.lightCard, border:`1px solid ${C.lightBorder}`, color:C.textDark, borderRadius:8, padding:"10px 14px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", transition:"border-color .15s" };
  const lbl:any = { fontSize:10, letterSpacing:".08em", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", color:C.textGray, marginBottom:6, display:"block" };
  const upd = (k:string) => (e:any) => onChange({...data,[k]:e.target.value});
  const focus = (e:any) => e.target.style.borderColor=C.blueMain;
  const blur  = (e:any) => e.target.style.borderColor=C.lightBorder;
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <ContextBar market={market} model={model} offerName={data.offerName}/>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:8,textTransform:"uppercase" as const}}>Paso 3 de 5</div>
        <div style={{fontSize:"clamp(22px,4vw,32px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1}}>Cuéntame sobre el cliente<br/>y la propuesta</div>
      </div>
      <div style={{marginBottom:18,padding:"16px 18px",borderRadius:14,background:`${model.accent}07`,border:`1.5px solid ${model.accent}30`}}>
        <label style={{...lbl,color:model.accent}}>Nombre comercial de la propuesta</label>
        <input value={data.offerName||""} onChange={upd("offerName")} placeholder="Ej: Programa Integral, Contrato 360..." style={{...inp,fontSize:14,padding:"12px 16px",fontWeight:600,border:`1.5px solid ${model.accent}30`}} onFocus={e=>(e.target.style.borderColor=model.accent)} onBlur={e=>(e.target.style.borderColor=`${model.accent}30`)}/>
        <div style={{fontSize:10,color:C.textHint,marginTop:5,fontFamily:"'JetBrains Mono',monospace"}}>Este nombre alimenta todos los prompts de agentes y el informe final</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div><label style={lbl}>Nombre del cliente</label><input value={data.name||""} onChange={upd("name")} placeholder="Ej: Empresa del Norte S.A." style={inp} onFocus={focus} onBlur={blur}/></div>
        <div><label style={lbl}>Sector específico</label><input value={data.sector||""} onChange={upd("sector")} placeholder={market.shortDesc.split("·")[0].trim()+"..."} style={inp} onFocus={focus} onBlur={blur}/></div>
      </div>
      <div style={{marginBottom:12}}><label style={lbl}>Situación actual del cliente</label><textarea value={data.situation||""} onChange={upd("situation")} rows={2} placeholder={`Ej: Tiene proveedor consolidado. Contexto: ${market.keywords[0]}...`} style={{...inp,resize:"vertical" as const}} onFocus={focus} onBlur={blur}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:18}}>
        <div><label style={lbl}>Valor de la oportunidad</label><input value={data.budget||""} onChange={upd("budget")} placeholder="Ej: USD 120K, MM$ 85, €50K..." style={inp} onFocus={focus} onBlur={blur}/></div>
        <div><label style={lbl}>Principal dolor del cliente</label><input value={data.pain||""} onChange={upd("pain")} placeholder={market.keywords[1]||"variabilidad de costos..."} style={inp} onFocus={focus} onBlur={blur}/></div>
      </div>
      <div style={{background:C.lightBg,border:`1px solid ${market.accent}24`,borderRadius:12,padding:"14px 16px"}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:market.accent,letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:7}}>{market.icon} Contexto del mercado — {market.name}</div>
        <div style={{fontSize:12,color:C.textGray,lineHeight:1.65,marginBottom:9}}>{market.context}</div>
        <div style={{display:"flex",flexWrap:"wrap" as const,gap:5}}>{market.keywords.map((k:string,i:number)=><span key={i} style={{padding:"2px 9px",borderRadius:20,fontSize:10,fontFamily:"'JetBrains Mono',monospace",background:market.accent+"12",color:market.accent,border:`1px solid ${market.accent}28`}}>{k}</span>)}</div>
      </div>
    </div>
  );
}

// ── NEURAL MAP SVG ─────────────────────────────────────────────────
function NeuralMapSVG({ model, weights, activeId }:any) {
  const sm:any = Object.fromEntries(model.stakeholders.map((s:any)=>[s.id,s]));
  return (
    <svg viewBox="0 0 600 460" style={{width:"100%",maxWidth:580,display:"block",margin:"0 auto"}}>
      <defs>
        {model.stakeholders.map((s:any)=>(
          <radialGradient key={s.id} id={`ng${s.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={NODE_TYPES[s.type].color} stopOpacity=".25"/>
            <stop offset="100%" stopColor={NODE_TYPES[s.type].color} stopOpacity="0"/>
          </radialGradient>
        ))}
        <filter id="nglow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="600" height="460" fill={C.lightCard} rx="12"/>
      {[80,160,240,320,400].map((y:number)=><line key={y} x1="0" y1={y} x2="600" y2={y} stroke={C.lightBorder} strokeWidth=".4" strokeOpacity=".8"/>)}
      {model.connections.map((conn:any,i:number)=>{
        const a=sm[conn.f],b=sm[conn.t]; if(!a||!b) return null;
        const w=conn.w;
        return <g key={i}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={model.accent} strokeOpacity={.08+w*.32} strokeWidth={w*5} strokeLinecap="round"/>
          <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-6} fill={model.accent} fontSize={8} fontFamily="monospace" textAnchor="middle" opacity={.55}>{Math.round(w*100)}%</text>
        </g>;
      })}
      {model.stakeholders.map((s:any)=>{
        const nt=NODE_TYPES[s.type], r=nt.sz, isEntry=s.id===model.entryNode, isActive=s.id===activeId;
        const w=weights[s.id]!==undefined?weights[s.id]:s.weight;
        return <g key={s.id} filter={isActive?"url(#nglow)":undefined}>
          <circle cx={s.x} cy={s.y} r={r*2.8} fill={`url(#ng${s.id})`} opacity={isActive?1:.5}/>
          {isEntry&&<circle cx={s.x} cy={s.y} r={r+12} fill="none" stroke={model.accent} strokeWidth={1} strokeOpacity={.5} strokeDasharray="5 3"/>}
          {s.type==="decision"&&<circle cx={s.x} cy={s.y} r={r+7} fill="none" stroke={nt.color} strokeWidth={1.5} strokeOpacity={.3} strokeDasharray="3 2"/>}
          <circle cx={s.x} cy={s.y} r={r} fill={nt.color} fillOpacity={isActive?.22:.1} stroke={nt.color} strokeWidth={isActive?2.5:1.8}/>
          <text x={s.x} y={s.y+1} textAnchor="middle" dominantBaseline="middle" fill={nt.color} fontSize={9} fontWeight="700" fontFamily="monospace">{w}%</text>
          <text x={s.x} y={s.y+r+13} textAnchor="middle" fill={C.textDark} fontSize={10} fontFamily="monospace" fontWeight="600">{s.name}</text>
          <rect x={s.x-26} y={s.y+r+18} width={52} height={13} rx={3} fill={nt.color} fillOpacity={.15}/>
          <text x={s.x} y={s.y+r+27} textAnchor="middle" fill={nt.color} fontSize={7.5} fontFamily="monospace" fontWeight="700">{nt.label}</text>
        </g>;
      })}
      <text x={8} y={452} fill={model.accent} fontSize={8.5} fontFamily="monospace" opacity={.7}>▶ ENTRADA: {model.stakeholders.find((s:any)=>s.id===model.entryNode)?.name?.toUpperCase()} · CIERRE EST.: {model.timeToClose}</text>
    </svg>
  );
}

// ── NEURAL MAP SCREEN ──────────────────────────────────────────────
function NeuralMapScreen({ market, model, clientData, weights, onWeightChange }:any) {
  return (
    <div style={{animation:"mFadeUp .4s ease",padding:"32px 0"}}>
      <ContextBar market={market} model={model} offerName={clientData?.offerName}/>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,letterSpacing:".15em",color:C.blueMain,marginBottom:6,textTransform:"uppercase" as const}}>Paso 4 de 5</div>
      <div style={{fontSize:"clamp(20px,4vw,30px)",fontWeight:800,letterSpacing:"-.03em",color:C.textDark,lineHeight:1.1,marginBottom:6}}>Mapa Neural de Influencia</div>
      <div style={{fontSize:13,color:C.textGray,marginBottom:22,lineHeight:1.6}}>Ajusta el peso de influencia de cada stakeholder según tu conocimiento del cliente. Los porcentajes afectan directamente los prompts de los agentes.</div>

      <div style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:16,padding:20,marginBottom:20,boxShadow:"0 2px 12px rgba(0,0,0,.05)"}}>
        <NeuralMapSVG model={model} weights={weights} activeId={null}/>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,marginBottom:20}}>
        {Object.entries(NODE_TYPES).map(([k,v]:any)=>(
          <div key={k} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 11px",background:v.color+"10",border:`1px solid ${v.color}28`,borderRadius:20}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:v.color}}/>
            <span style={{color:v.color,fontSize:10,fontFamily:"'JetBrains Mono',monospace",fontWeight:700}}>{v.label}</span>
          </div>
        ))}
      </div>

      <div style={{background:C.lightCard,border:`1px solid ${C.lightBorder}`,borderRadius:14,padding:20,boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.blueMain,letterSpacing:".12em",textTransform:"uppercase" as const,marginBottom:16}}>Calibrar pesos de influencia</div>
        {model.stakeholders.map((s:any)=>{
          const nt=NODE_TYPES[s.type];
          const w=weights[s.id]!==undefined?weights[s.id]:s.weight;
          return (
            <div key={s.id} style={{marginBottom:16,paddingBottom:16,borderBottom:`1px solid ${C.lightBorder2}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:nt.color,flexShrink:0}}/>
                  <span style={{color:C.textDark,fontSize:12,fontWeight:600}}>{s.name}</span>
                  <Tag color={nt.color} small>{nt.label}</Tag>
                </div>
                <span style={{color:nt.color,fontSize:16,fontWeight:800,fontFamily:"'JetBrains Mono',monospace"}}>{w}%</span>
              </div>
              <input type="range" min={5} max={100} value={w}
                onChange={e=>onWeightChange(s.id,Number(e.target.value))}
                style={{width:"100%",accentColor:nt.color,height:4,cursor:"pointer"}}/>
              <div style={{fontSize:10,color:C.textGray,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{s.trigger}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── AGENT CARD ─────────────────────────────────────────────────────
function AgentCard({ agent, response, isActive }:any) {
  return (
    <div style={{background:C.lightCard,border:`1px solid ${isActive?agent.accent:C.lightBorder}`,borderLeft:`4px solid ${agent.accent}`,borderRadius:12,padding:"16px 18px",boxShadow:isActive?`0 4px 20px ${agent.accent}20`:"0 1px 4px rgba(0,0,0,.04)",transition:"all .35s ease",marginBottom:12}}>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
        <div style={{width:40,height:40,borderRadius:9,fontSize:18,background:agent.accent+"12",border:`2px solid ${isActive?agent.accent:agent.accent+"44"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{isActive?"⚡":agent.icon}</div>
        <div style={{flex:1}}>
          <div style={{color:C.textDark,fontWeight:700,fontSize:13,fontFamily:"monospace"}}>{agent.name}</div>
          <div style={{color:agent.accent,fontSize:10,letterSpacing:".08em",textTransform:"uppercase" as const}}>{agent.company}</div>
        </div>
        <Tag color={agent.side==="cliente"?C.green:agent.side==="competidor"?C.red:C.blueMain} small>
          {agent.side==="cliente"?"CLIENTE":agent.side==="competidor"?"COMPETIDOR":"VENDEDOR"}
        </Tag>
      </div>
      {isActive&&<div style={{display:"flex",alignItems:"center",gap:8,color:agent.accent,fontSize:12,fontFamily:"monospace"}}><div style={{width:7,height:7,borderRadius:"50%",background:agent.accent,animation:"blink .7s infinite"}}/>Analizando escenario...</div>}
      {response&&!isActive&&<div style={{borderTop:`1px solid ${C.lightBorder2}`,paddingTop:11,color:C.textDark,fontSize:12.5,lineHeight:1.75,fontFamily:"'IBM Plex Sans',system-ui,sans-serif",whiteSpace:"pre-wrap" as const}}>{response}</div>}
    </div>
  );
}

// ── SIMULATION SCREEN ──────────────────────────────────────────────
function SimulationScreen({ market, model, clientData, weights, profile }:any) {
  const [phase, setPhase] = useState<"idle"|"running"|"complete">("idle");
  const [responses, setResponses] = useState<any>({});
  const [activeId, setActiveId] = useState<string|null>(null);
  const [report, setReport] = useState<string|null>(null);
  const [progress, setProgress] = useState({current:0,total:0});
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

      {phase==="idle"&&(
        <div style={{textAlign:"center",padding:"48px 20px",background:C.lightCard,borderRadius:16,border:`1px solid ${C.lightBorder}`,boxShadow:"0 2px 12px rgba(0,0,0,.05)"}}>
          <div style={{fontSize:48,marginBottom:16}}>🧠</div>
          <div style={{color:C.textDark,fontSize:18,fontWeight:700,marginBottom:8}}>Todo listo para simular</div>
          <div style={{color:C.textGray,fontSize:13,marginBottom:28,lineHeight:1.7}}>{agents.length} agentes activados · {model.stakeholders.length} stakeholders mapeados<br/>Competidor sin nombre · Vendedor como {empresa}</div>
          <button onClick={runSim} style={{padding:"16px 48px",background:C.textDark,border:"none",color:"#fff",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",letterSpacing:".04em",transition:"opacity .15s"}}
            onMouseEnter={e=>(e.currentTarget as any).style.opacity=".85"}
            onMouseLeave={e=>(e.currentTarget as any).style.opacity="1"}>
            ⚡ Ejecutar Red Neural →
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
        <div style={{textAlign:"center",marginTop:24,padding:"24px",background:C.lightCard,border:`1px solid ${C.success}33`,borderRadius:14,boxShadow:"0 2px 12px rgba(5,150,105,.06)"}}>
          <div style={{color:C.success,fontSize:13,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,marginBottom:6}}>✓ SIMULACIÓN COMPLETA</div>
          <div style={{color:C.textGray,fontSize:12,marginBottom:20}}>El informe está listo para descargar e imprimir como PDF</div>
          <button onClick={downloadHTML} style={{padding:"14px 36px",background:C.textDark,border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginRight:12}}>
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

// ── DASHBOARD SCREEN ───────────────────────────────────────────────
function DashboardScreen() {
  const { session, profile, subscription, signOut, navigate } = useAuth();

  const [simScreen, setSimScreen]   = useState("market");
  const [market,    setMarket]      = useState<any>(null);
  const [model,     setModel]       = useState<any>(null);
  const [clientData,setClientData]  = useState({offerName:"",name:"",sector:"",situation:"",budget:"",pain:""});
  const [weights,   setWeights]     = useState<any>({});
  const [marketCustomContext, setMarketCustomContext] = useState("");
  const [modelCustomDesc,     setModelCustomDesc]     = useState("");

  if (!session) { navigate("login"); return null; }
  if (!profile?.profile_completed) { navigate("onboarding"); return null; }
  if (!subscription) { navigate("pricing"); return null; }

  const SCREENS = ["market","model","client","neural","sim"];
  const step = SCREENS.indexOf(simScreen);

  const handleSignOut = async () => { await signOut(); };

  const handleMarketSelect = (m:any) => {
    const withCtx = m.id==="otro" ? {...m, customContext: marketCustomContext} : m;
    setMarket(withCtx); setSimScreen("model");
  };
  const handleModelSelect = (m:any) => {
    const withDesc = m.id==="otro" ? {...m, customModelDesc: modelCustomDesc} : m;
    setModel(withDesc);
    const initW:any = {};
    withDesc.stakeholders.forEach((s:any) => { initW[s.id]=s.weight; });
    setWeights(initW); setSimScreen("client");
  };
  const handleWeightChange = (id:string, val:number) => setWeights((p:any)=>({...p,[id]:val}));

  const canNext = () => {
    if (simScreen==="market") return !!market;
    if (simScreen==="model")  return !!model;
    if (simScreen==="client"||simScreen==="neural") return true;
    return false;
  };
  const goNext = () => {
    if (!canNext()) return;
    if (simScreen==="market" && market?.id==="otro") setMarket((m:any)=>({...m,customContext:marketCustomContext}));
    if (simScreen==="model"  && model?.id==="otro")  setModel((m:any)=>({...m,customModelDesc:modelCustomDesc}));
    const idx = SCREENS.indexOf(simScreen);
    if (idx<SCREENS.length-1) setSimScreen(SCREENS[idx+1]);
  };
  const goBack = () => { const idx=SCREENS.indexOf(simScreen); if(idx>0) setSimScreen(SCREENS[idx-1]); };
  const goToStep = (i:number) => { if(i<step) setSimScreen(SCREENS[i]); };

  const nextLabel = simScreen==="market"?"Continuar → Modelo":simScreen==="model"?"Continuar → Datos del cliente":simScreen==="client"?"Ver Mapa Neural →":simScreen==="neural"?"Iniciar Simulación →":"";

  const STYLES = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
    @keyframes mFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes mFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${C.lightBg}}
    input::placeholder,textarea::placeholder{color:${C.textHint}}
    select option{color:${C.textDark}}
    ::-webkit-scrollbar{width:0}
    input:focus,textarea:focus,select:focus{outline:none}
  `;

  return (
    <div style={{minHeight:"100vh",background:C.lightBg,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif"}}>
      <style>{STYLES}</style>
      <AppHeader step={step} onNav={goToStep} user={session?.user} onSignOut={handleSignOut}/>

      {profile?.empresa&&(
        <div style={{background:C.lightCard,borderBottom:`1px solid ${C.lightBorder}`,padding:"7px 28px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:C.textGray,fontFamily:"'JetBrains Mono',monospace"}}>SIMULANDO COMO</span>
          <span style={{fontSize:11,fontWeight:700,color:C.textDark}}>{profile.empresa}</span>
          <span style={{fontSize:10,color:C.lightBorder}}>·</span>
          <span style={{fontSize:10,color:C.textGray}}>{profile.pais}</span>
          <span style={{fontSize:10,color:C.lightBorder}}>·</span>
          <span style={{fontSize:10,color:C.textGray}}>{profile.giro}</span>
          {subscription?.plan&&<><span style={{fontSize:10,color:C.lightBorder}}>·</span><span style={{fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:C.blueMain,background:C.blueMain+"12",border:`1px solid ${C.blueMain}22`,padding:"1px 8px",borderRadius:20,textTransform:"uppercase" as const}}>{subscription.plan}</span></>}
        </div>
      )}

      <div style={{maxWidth:860,margin:"0 auto",padding:`0 24px ${simScreen==="sim"?"40px":"100px"}`}}>
        {simScreen==="market" && <MarketScreen selected={market} onSelect={handleMarketSelect} customContext={marketCustomContext} onCustomContext={setMarketCustomContext}/>}
        {simScreen==="model"  && <ModelScreen  market={market} selected={model} onSelect={handleModelSelect} customModel={modelCustomDesc} onCustomModel={setModelCustomDesc}/>}
        {simScreen==="client" && <ClientScreen market={market} model={model} data={clientData} onChange={setClientData}/>}
        {simScreen==="neural" && <NeuralMapScreen market={market} model={model} clientData={clientData} weights={weights} onWeightChange={handleWeightChange}/>}
        {simScreen==="sim"    && <SimulationScreen market={market} model={model} clientData={clientData} weights={weights} profile={profile}/>}
      </div>

      {simScreen!=="sim"&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.94)",backdropFilter:"saturate(180%) blur(20px)",WebkitBackdropFilter:"saturate(180%) blur(20px)",borderTop:`1px solid ${C.lightBorder}`,padding:"12px 28px"}}>
          <div style={{maxWidth:860,margin:"0 auto",display:"flex",gap:10}}>
            {step>0&&<button onClick={goBack} style={{padding:"12px 20px",background:"transparent",border:`1px solid ${C.lightBorder}`,color:C.textGray,borderRadius:10,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← Volver</button>}
            {nextLabel&&<button onClick={goNext} disabled={!canNext()} style={{flex:1,padding:"13px 0",background:canNext()?C.textDark:C.lightBorder2,border:"none",borderRadius:10,color:canNext()?"#fff":C.textHint,fontSize:13,fontWeight:700,cursor:canNext()?"pointer":"not-allowed",fontFamily:"inherit",letterSpacing:"-.01em",transition:"all .2s"}}>{nextLabel}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── APP ROOT ───────────────────────────────────────────────────────
export default function App() {
  return <AuthGate/>;
}
