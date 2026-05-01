// ── PALETTE & DATA ─────────────────────────────────────────────────

// ── PALETTE ────────────────────────────────────────────────────────
export const C:any = {
  darkBg:"#040D1A", darkSurface:"#0A1628", darkBorder:"#1B3A6B",
  nodeBlue:"#4D9FFF", nodeCyan:"#00A8FF", textLight:"#C8D8F0", textDim:"#3A5070",
  lightBg:"#F5F5F7", lightCard:"#FFFFFF", lightBorder:"#D2D2D7", lightBorder2:"#E8E8ED",
  textDark:"#1D1D1F", textGray:"#6E6E73", textHint:"#86868B",
  blueMain:"#0066CC", blueLight:"#2997FF", error:"#DC2626", success:"#059669",
  gold:"#F0B429", green:"#2ECC71", red:"#E05252", orange:"#E8843A", purple:"#9B59B6",
};

export const NODE_TYPES:any = {
  decision:  {color:C.gold,   label:"DECISOR",    sz:28},
  champion:  {color:C.green,  label:"CAMPEÓN",    sz:24},
  gatekeeper:{color:C.red,    label:"BLOQUEADOR", sz:22},
  validator: {color:C.orange, label:"VALIDADOR",  sz:20},
  passive:   {color:C.textDim,label:"PASIVO",     sz:15},
};


// ── DATA ───────────────────────────────────────────────────────────
export const COUNTRIES = ["Chile","Argentina","Colombia","México","Perú","Brasil","Uruguay","Ecuador","Bolivia","Paraguay","Venezuela","España","Panamá","Costa Rica","Guatemala","Honduras","El Salvador","Nicaragua","Rep. Dominicana","Cuba","Estados Unidos","Canadá","Otro"];
export const INDUSTRIES = ["Alimentaria & Bebidas","Minería & Metalurgia","Farmacéutica & Laboratorio","Hotelería & Hospitalidad","Manufactura Industrial","Petroquímica & Energía","Papel & Celulosa","Salud & Clínicas","Construcción & Contratistas","Facility Services","Retail & Distribución","Tecnología & Software","Agroindustria","Logística & Transporte","Otro"];

export const MARKETS:any = {
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

export const MODELS:any = {
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


// ── BG NODES ───────────────────────────────────────────────────────
export const BGN=[{x:12,y:18,r:3,d:0},{x:35,y:8,r:2,d:.4},{x:58,y:22,r:4,d:.8},{x:78,y:12,r:2,d:.2},{x:88,y:35,r:3,d:1.1},{x:92,y:60,r:2,d:.6},{x:70,y:80,r:3,d:.9},{x:45,y:92,r:2,d:.3},{x:20,y:78,r:4,d:1.4},{x:8,y:55,r:2,d:.7},{x:25,y:42,r:3,d:1.0},{x:62,y:55,r:2,d:.5},{x:48,y:35,r:5,d:.1},{x:72,y:45,r:2,d:1.3},{x:35,y:62,r:3,d:.8}];
export const BGE=[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,12],[1,12],[12,11],[11,13],[13,2],[4,9],[9,8],[8,7],[7,6],[6,13],[5,10],[10,9],[10,14],[14,11],[14,3]];
export const HEX=[{cx:50,cy:20},{cx:80,cy:36},{cx:80,cy:64},{cx:50,cy:80},{cx:20,cy:64},{cx:20,cy:36}];

// ── PLANS ──────────────────────────────────────────────────────────
// Definición de planes. Los flow_plan_id son los IDs reales de Flow.
// Todos los precios CLP coinciden con lo configurado en Flow Dashboard.
export const PLANS = {
  free: {
    id: "free",
    name: "Free Trial",
    tagline: "Probá MINERVA 7 días",
    priceCLP: 0,
    priceUSD: 0,
    period: "trial",
    durationDays: 7,
    simulations: 5,
    features: [
      "5 simulaciones en 7 días",
      "Acceso completo al motor de IA",
      "Informes ejecutivos descargables",
      "Sin tarjeta de crédito",
    ],
    cta: "Empezar trial gratis",
    flow_plan_id: null,
  },
  starter_monthly: {
    id: "starter_monthly",
    name: "Starter",
    tagline: "Para vendedores que arrancan",
    priceCLP: 32700,
    priceUSD: 36,
    promoCLP: 16500,
    promoUSD: 18,
    promoMonths: 3,
    period: "monthly",
    simulations: 20,
    features: [
      "20 simulaciones por mes",
      "Histórico ilimitado",
      "Métricas de Win Rate y Revenue",
      "Sistema de niveles + logros",
      "Cancelas cuando quieras",
    ],
    cta: "Contratar Starter",
    flow_plan_id: 36287,
    coupon_id: 6371,            // WelcomeliteM
    coupon_code: "WelcomeliteM",
  },
  starter_annual: {
    id: "starter_annual",
    name: "Starter Anual",
    tagline: "Ahorra con pago anual",
    priceCLP: 163800,
    priceUSD: 180,
    period: "annual",
    simulations: 20,
    features: [
      "20 simulaciones por mes × 12",
      "Equivale a $15 USD/mes",
      "Histórico ilimitado",
      "Sin sorpresas el mes 4",
      "Renueva automáticamente",
    ],
    cta: "Contratar Starter Anual",
    flow_plan_id: 36288,
    badge: "Mejor valor",
  },
  imperium_monthly: {
    id: "imperium_monthly",
    name: "Imperium",
    tagline: "Para closers de alto volumen",
    priceCLP: 63700,
    priceUSD: 70,
    promoCLP: 32100,
    promoUSD: 35,
    promoMonths: 3,
    period: "monthly",
    simulations: 60,
    features: [
      "60 simulaciones por mes",
      "Todo lo de Starter +",
      "Soporte prioritario",
      "Reportes avanzados (próximamente)",
      "Cancelas cuando quieras",
    ],
    cta: "Contratar Imperium",
    flow_plan_id: 36289,
    coupon_id: 6370,            // WelcomePlusM
    coupon_code: "WelcomePlusM",
  },
  imperium_annual: {
    id: "imperium_annual",
    name: "Imperium Anual",
    tagline: "Máximo poder, máximo ahorro",
    priceCLP: 364000,
    priceUSD: 400,
    period: "annual",
    simulations: 60,
    features: [
      "60 simulaciones por mes × 12",
      "Equivale a $33 USD/mes",
      "Todo lo de Imperium +",
      "Soporte prioritario",
      "Renueva automáticamente",
    ],
    cta: "Contratar Imperium Anual",
    flow_plan_id: 36290,
    badge: "Mejor valor",
  },
  pyme: {
    id: "pyme",
    name: "PYME",
    tagline: "Para equipos comerciales",
    priceCLP: null,
    priceUSD: null,
    period: "quote",
    simulations: null,
    features: [
      "Múltiples vendedores",
      "Dashboard de equipo",
      "Reportes consolidados",
      "Onboarding personalizado",
      "Facturación empresarial",
    ],
    cta: "Solicitar cotización",
    flow_plan_id: null,
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Solución corporativa a medida",
    priceCLP: null,
    priceUSD: null,
    period: "quote",
    simulations: null,
    features: [
      "Usuarios ilimitados",
      "Integración con tu CRM",
      "API y conectores custom",
      "SLA garantizado",
      "Account manager dedicado",
    ],
    cta: "Solicitar cotización",
    flow_plan_id: null,
  },
};
