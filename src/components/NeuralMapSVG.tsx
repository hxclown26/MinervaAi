import { C, NODE_TYPES } from "../lib/constants";

// ── NEURAL MAP SVG ─────────────────────────────────────────────────
export function NeuralMapSVG({ model, weights, activeId }:any) {
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

