import { C } from "../lib/constants";

// ── HELPERS ────────────────────────────────────────────────────────
function Tag({ children, color, small }:any) {
  return <span style={{ background:color+"18", border:`1px solid ${color}40`, color, fontSize:small?9:10, padding:small?"2px 8px":"3px 11px", borderRadius:20, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:".08em", textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>{children}</span>;
}

export function ContextBar({ market, model, offerName }:any) {
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

