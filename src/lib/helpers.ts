/ ── HELPERS DE PLAN / LÍMITES ──────────────────────────────────────
// Para Free trial: período = 7 días + 5 sims totales (no se resetean)
// Para Starter/Imperium: período mensual recurrente, contador se resetea cada 30 días
// Master: acceso ilimitado siempre

export function canSimulate(subscription:any, profile:any): {
  ok:boolean;
  reason?:string;
  daysLeft?:number;
  daysToPeriodReset?:number;
  isPeriodExpired?:boolean;
} {
  // Master: acceso ilimitado
  if (profile?.is_master) return { ok:true, reason:"master" };

  // Sin suscripción
  if (!subscription) return { ok:false, reason:"no_plan" };

  // Cancelada explícitamente
  if (subscription.status === "canceled") return { ok:false, reason:"canceled" };

  const now = Date.now();
  const isFreeTrial = subscription.plan === "free" || subscription.billing_cycle === "trial";

  // ── Para Free Trial: usar period_end (7 días) ──
  if (isFreeTrial) {
    let daysLeft;
    if (subscription.period_end) {
      const end = new Date(subscription.period_end).getTime();
      daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
      if (end < now) return { ok:false, reason:"trial_expired", daysLeft:0, isPeriodExpired:true };
    }
    // Verificar límite de simulaciones del trial
    if (subscription.simulations_limit != null &&
        subscription.simulations_used >= subscription.simulations_limit) {
      return { ok:false, reason:"trial_limit_reached", daysLeft };
    }
    return { ok:true, daysLeft };
  }

  // ── Para planes pagos (Starter/Imperium mensual o anual) ──
  // current_period_end = ventana actual de 30 días para reset mensual de contador
  let daysToPeriodReset;
  if (subscription.current_period_end) {
    const periodEnd = new Date(subscription.current_period_end).getTime();
    daysToPeriodReset = Math.max(0, Math.ceil((periodEnd - now) / 86400000));
  }

  // Verificar si la suscripción global venció (period_end = 30 días para mensual, 365 para anual)
  if (subscription.period_end) {
    const subEnd = new Date(subscription.period_end).getTime();
    if (subEnd < now) return { ok:false, reason:"subscription_expired", isPeriodExpired:true };
  }

  // Verificar límite de simulaciones del mes actual
  if (subscription.simulations_limit != null &&
      subscription.simulations_used >= subscription.simulations_limit) {
    return {
      ok:false,
      reason:"monthly_limit_reached",
      daysToPeriodReset,
    };
  }

  return { ok:true, daysToPeriodReset };
}

export function planLabel(plan?:string): string {
  if (!plan) return "—";
  const map:any = {
    free: "FREE TRIAL",
    starter: "STARTER",
    imperium: "IMPERIUM",
    pyme: "PYME",
    enterprise: "ENTERPRISE",
    demo: "DEMO",
    salesman: "SALESMAN",  // legacy
  };
  return map[plan] || plan.toUpperCase();
}

// Helper para mostrar cycle: "Mensual" / "Anual" / "Trial"
export function cycleLabel(billing_cycle?:string): string {
  if (!billing_cycle) return "—";
  const map:any = { monthly:"MENSUAL", annual:"ANUAL", trial:"TRIAL", none:"—" };
  return map[billing_cycle] || billing_cycle.toUpperCase();
}


// ── HELPERS DE SIMULACIONES / GAMIFICACIÓN ─────────────────────────

// Niveles: cada N wins se sube de nivel. Solo wins suman, lost neutros.
export const LEVEL_THRESHOLDS = [0, 1, 3, 6, 10, 15, 21, 30];
export const LEVEL_NAMES = ["Acolyte of Minerva","Messenger of Mercury","Orator of Apollo","Champion of Mars","Chosen of Diana","Consul of Rome","Imperator","Ascended Minerva"];

export function calculateLevel(wins:number) {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (wins >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold    = LEVEL_THRESHOLDS[level] || (currentThreshold + 10);
  const progress = nextThreshold === currentThreshold ? 100
    : Math.round(((wins - currentThreshold) / (nextThreshold - currentThreshold)) * 100);
  return {
    level,
    name: LEVEL_NAMES[level - 1] || "Ascended Minerva",
    wins,
    nextAt: nextThreshold,
    progress: Math.min(100, Math.max(0, progress)),
    winsToNext: Math.max(0, nextThreshold - wins),
  };
}

export function calculateAchievements(sims:any[]): any[] {
  const won = sims.filter(s => s.outcome === "won");
  const markets = new Set(sims.map(s => s.market_id).filter(Boolean));
  const fastWins = won.filter(s => s.days_to_close != null && s.days_to_close <= 7);
  const totalRevenue = won.reduce((sum,s)=>sum + (Number(s.budget_final)||0), 0);

  return [
    { id:"first_win",   name:"First Win",     icon:"🏆", unlocked: won.length >= 1,    desc:"Cerrar tu primera venta" },
    { id:"speed_close", name:"Speed Closer",  icon:"⚡", unlocked: fastWins.length >= 1, desc:"Cerrar un deal en <7 días" },
    { id:"five_mkts",   name:"5 Mercados",    icon:"🎯", unlocked: markets.size >= 5,    desc:"Simular en 5 mercados distintos" },
    { id:"streak_3",    name:"Hot Streak",    icon:"🔥", unlocked: won.length >= 3 && checkStreak(sims, 3), desc:"3 wins consecutivos" },
    { id:"big_hunter",  name:"Big Hunter",    icon:"🦣", unlocked: totalRevenue >= 100_000_000, desc:"$100M+ acumulados en wins" },
    { id:"ten_wins",    name:"Decena",        icon:"💎", unlocked: won.length >= 10,    desc:"10 deals ganados" },
  ];
}

function checkStreak(sims:any[], n:number): boolean {
  // sims viene ordenado created_at desc. Verifica si los últimos N wins son consecutivos.
  const closed = sims.filter(s => s.outcome === "won" || s.outcome === "lost")
                     .sort((a,b)=> new Date(b.actual_close||b.created_at).getTime() - new Date(a.actual_close||a.created_at).getTime());
  if (closed.length < n) return false;
  return closed.slice(0, n).every(s => s.outcome === "won");
}

export function formatMoney(amount:any): string {
  const n = Number(amount);
  if (!n || isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n/1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `$${(n/1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function extractProbability(report:string): number | null {
  if (!report) return null;
  // Busca patrones tipo "78%", "PROBABILIDAD: 65%", "65 %"
  const match = report.match(/(\d{1,3})\s*%/);
  if (match) {
    const v = parseInt(match[1], 10);
    if (v >= 0 && v <= 100) return v;
  }
  return null;
}

export function formatDate(iso?:string|null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-CL", { day:"2-digit", month:"short", year:"numeric" });
  } catch { return "—"; }
}

export function outcomeLabel(outcome?:string): { label:string; color:string; icon:string } {
  switch (outcome) {
    case "won":     return { label:"Ganado",   color:"#3B6D11", icon:"✓" };
    case "lost":    return { label:"Perdido",  color:"#A32D2D", icon:"✗" };
    case "overdue": return { label:"Atrasada", color:"#A32D2D", icon:"⚠" };
    default:        return { label:"En curso", color:"#BA7517", icon:"⏱" };
  }
}
