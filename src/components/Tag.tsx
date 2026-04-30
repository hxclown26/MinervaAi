export function Tag({ children, color, small }:any) {
  return <span style={{ background:color+"18", border:`1px solid ${color}40`, color, fontSize:small?9:10, padding:small?"2px 8px":"3px 11px", borderRadius:20, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:".08em", textTransform:"uppercase" as const, whiteSpace:"nowrap" as const }}>{children}</span>;
}
