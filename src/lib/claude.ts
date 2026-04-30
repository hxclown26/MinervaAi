// ── API CALL ───────────────────────────────────────────────────────
export async function callClaude(system: string, user: string): Promise<string> {
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

