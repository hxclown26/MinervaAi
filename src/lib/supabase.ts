// ── SUPABASE CONFIG ────────────────────────────────────────────────
export const SUPABASE_URL  = (import.meta as any).env?.VITE_SUPABASE_URL  as string
  ?? "https://tohfuokcngavbmbjsdru.supabase.co";
export const SUPABASE_ANON = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaGZ1b2tjbmdhdmJtYmpzZHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDIyMTksImV4cCI6MjA5MjYxODIxOX0.gRc-Uv4NaT18SkjFupw6krvT_Nmqt7xt4zfH235siH8";

// ── TIPOS ──────────────────────────────────────────────────────────
export interface SbSession {
  access_token:  string;
  refresh_token: string | null;
  expires_at?:   number;
  user:          SbUser;
}

export interface SbUser {
  id:             string;
  email:          string;
  user_metadata?: Record<string, any>;
}

export interface SbAuthResponse {
  access_token?:  string;
  refresh_token?: string;
  expires_in?:    number;
  user?:          SbUser;
  error?:         { message: string; status?: number };
  id?:            string;
  email?:         string;
  identities?:    any[];
  email_confirmed_at?: string | null;
}

// ── TOKEN EXPIRY ───────────────────────────────────────────────────
function isTokenExpired(sess: SbSession): boolean {
  if (!sess.expires_at) return false;
  return Date.now() / 1000 > sess.expires_at - 60;
}

// ── CLIENTE ────────────────────────────────────────────────────────
export const sb = {

  h: {
    "Content-Type": "application/json",
    "apikey":        SUPABASE_ANON,
    "Authorization": `Bearer ${SUPABASE_ANON}`,
  } as Record<string, string>,

  authH(token: string): Record<string, string> {
    return { ...this.h, "Authorization": `Bearer ${token}` };
  },

  normalizeSession(raw: SbAuthResponse): SbSession | null {
    if (!raw.access_token || !raw.user?.id) return null;
    const expires_at = raw.expires_in
      ? Math.floor(Date.now() / 1000) + raw.expires_in
      : undefined;
    return {
      access_token:  raw.access_token,
      refresh_token: raw.refresh_token ?? null,
      expires_at,
      user: raw.user,
    };
  },

  // ── AUTH ──────────────────────────────────────────────────────────

  async signUp(email: string, password: string): Promise<SbAuthResponse> {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: this.h,
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async signIn(email: string, password: string): Promise<SbAuthResponse> {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: this.h,
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async refreshSession(refreshToken: string): Promise<SbSession | null> {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: this.h,
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data: SbAuthResponse = await r.json();
      return this.normalizeSession(data);
    } catch { return null; }
  },

  async ensureFreshSession(sess: SbSession): Promise<SbSession | null> {
    if (!isTokenExpired(sess)) return sess;
    if (!sess.refresh_token)   return null;
    return this.refreshSession(sess.refresh_token);
  },

  signInWithGoogle(): void {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
    window.location.href = url;
  },

  async signOut(token: string): Promise<void> {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST", headers: this.authH(token),
    });
  },

  async resetPassword(email: string): Promise<void> {
    await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST", headers: this.h,
      body: JSON.stringify({ email }),
    });
  },

  async resendConfirmation(email: string): Promise<void> {
    await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: "POST", headers: this.h,
      body: JSON.stringify({ type: "signup", email }),
    });
  },

  async getUser(token: string): Promise<SbUser | null> {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: this.authH(token) });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.id ? (d as SbUser) : null;
    } catch { return null; }
  },

  async updatePassword(token: string, newPassword: string): Promise<SbAuthResponse> {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT", headers: this.authH(token),
      body: JSON.stringify({ password: newPassword }),
    });
    return r.json();
  },

  // ── PERFIL ────────────────────────────────────────────────────────

  async getProfile(token: string, userId: string): Promise<any | null> {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`,
      { headers: this.authH(token) }
    );
    const d = await r.json();
    return Array.isArray(d) ? (d[0] ?? null) : null;
  },

  async upsertProfile(token: string, userId: string, data: Record<string, any>): Promise<any> {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: "POST",
      headers: { ...this.authH(token), "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ id: userId, ...data }),
    });
    return r.json();
  },

  saveProfile(token: string, userId: string, profile: Record<string, any>): Promise<any> {
    return this.upsertProfile(token, userId, profile);
  },

  // ── SUSCRIPCIÓN ───────────────────────────────────────────────────

  async getSubscription(token: string, userId: string): Promise<any | null> {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&status=in.(trial,trialing,active,past_due,cancelled)&order=created_at.desc&select=*&limit=1`,
      { headers: this.authH(token) }
    );
    const d = await r.json();
    return Array.isArray(d) ? (d[0] ?? null) : null;
  },

  async startFreeTrial(token: string): Promise<any> {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_free_trial`, {
      method: "POST", headers: this.authH(token), body: JSON.stringify({}),
    });
    return r.json();
  },

  // ── ACCOUNT (Netflix-style) ───────────────────────────────────────

  async getAccountSummary(token: string): Promise<any> {
    const r = await fetch("/api/account/summary", {
      headers: { "Authorization": `Bearer ${token}` },
    });
    return r.json();
  },

  async cancelSubscription(token: string, reason?: string): Promise<any> {
    const r = await fetch("/api/subscription/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ reason: reason || null }),
    });
    return r.json();
  },

  async reactivateSubscription(token: string): Promise<any> {
    const r = await fetch("/api/subscription/reactivate", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
    return r.json();
  },

  // ── SIMULACIONES ──────────────────────────────────────────────────

  async incrementSimulationCount(token: string): Promise<any> {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_simulation_count`, {
      method: "POST", headers: this.authH(token), body: JSON.stringify({}),
    });
    return r.json();
  },

  async listSimulations(token: string, userId: string): Promise<any[]> {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/simulations_with_status?user_id=eq.${userId}&order=created_at.desc&select=*`,
      { headers: this.authH(token) }
    );
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  },

  async saveSimulation(token: string, params: any): Promise<any> {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_simulation`, {
      method: "POST", headers: this.authH(token), body: JSON.stringify(params),
    });
    return r.json();
  },

  async markSimulationWon(token: string, simulationId: string, budgetFinal: number): Promise<any> {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_simulation_won`, {
      method: "POST", headers: this.authH(token),
      body: JSON.stringify({ p_simulation_id: simulationId, p_budget_final: budgetFinal }),
    });
    return r.json();
  },

  async markSimulationLost(token: string, simulationId: string, reason?: string): Promise<any> {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_simulation_lost`, {
      method: "POST", headers: this.authH(token),
      body: JSON.stringify({ p_simulation_id: simulationId, p_reason: reason ?? null }),
    });
    return r.json();
  },

  async extendSimulationDeadline(token: string, simulationId: string, newDate: string): Promise<any> {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/extend_simulation_deadline`, {
      method: "POST", headers: this.authH(token),
      body: JSON.stringify({ p_simulation_id: simulationId, p_new_date: newDate }),
    });
    return r.json();
  },

  // ── CHECKOUT (suscripción recurrente) ─────────────────────────────

  async validateCoupon(payload: { code: string; userId: string; planCode: string }): Promise<any> {
    const r = await fetch("/api/validate-coupon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.json();
  },

  async startCheckout(token: string, payload: {
    appPlanCode: string;
    couponCode?: string | null;
  }): Promise<{ paymentUrl?: string; subscriptionId?: string; finalAmount?: number; appliedCoupon?: string; error?: string; message?: string }> {
    const r = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return r.json();
  },

  async submitQuoteRequest(payload: any): Promise<any> {
    const r = await fetch("/api/quote-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.json();
  },
};
