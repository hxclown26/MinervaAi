// ── SUPABASE CONFIG ────────────────────────────────────────────────
export const SUPABASE_URL  = "https://tohfuokcngavbmbjsdru.supabase.co";
export const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaGZ1b2tjbmdhdmJtYmpzZHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDIyMTksImV4cCI6MjA5MjYxODIxOX0.gRc-Uv4NaT18SkjFupw6krvT_Nmqt7xt4zfH235siH8";

export const sb = {
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
  signInWithGoogle() {
    // Redirige al usuario a Google OAuth. Cuando vuelve, AuthGate detecta el hash y lo loguea.
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
    window.location.href = url;
  },
  async signOut(token:string) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method:"POST", headers:this.authH(token) });
  },
  async resetPassword(email:string) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, { method:"POST", headers:this.h, body:JSON.stringify({email}) });
    return r.json();
  },
  async getUser(token:string) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers:this.authH(token) });
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
  },
  async updatePassword(token:string, newPassword:string) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method:"PUT",
      headers:this.authH(token),
      body:JSON.stringify({password:newPassword})
    });
    return r.json();
  },
  async getSubscription(token:string, userId:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active&select=*&limit=1`, { headers:this.authH(token) });
    const d = await r.json(); return Array.isArray(d)?d[0]:null;
  },
  async startFreeTrial(token:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/start_free_trial`, {
      method:"POST",
      headers:this.authH(token),
      body:JSON.stringify({})
    });
    return r.json();
  },
  async incrementSimulationCount(token:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_simulation_count`, {
      method:"POST",
      headers:this.authH(token),
      body:JSON.stringify({})
    });
    return r.json();
  },
  async listSimulations(token:string, userId:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/simulations_with_status?user_id=eq.${userId}&order=created_at.desc&select=*`, { headers:this.authH(token) });
    const d = await r.json(); return Array.isArray(d) ? d : [];
  },
  async saveSimulation(token:string, params:any) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_simulation`, {
      method:"POST",
      headers:this.authH(token),
      body:JSON.stringify(params)
    });
    return r.json();
  },
  async markSimulationWon(token:string, simulationId:string, budgetFinal:number) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_simulation_won`, {
      method:"POST",
      headers:this.authH(token),
      body:JSON.stringify({p_simulation_id:simulationId, p_budget_final:budgetFinal})
    });
    return r.json();
  },
  async markSimulationLost(token:string, simulationId:string, reason?:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_simulation_lost`, {
      method:"POST",
      headers:this.authH(token),
      body:JSON.stringify({p_simulation_id:simulationId, p_reason:reason||null})
    });
    return r.json();
  },
  async extendSimulationDeadline(token:string, simulationId:string, newDate:string) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/extend_simulation_deadline`, {
      method:"POST",
      headers:this.authH(token),
      body:JSON.stringify({p_simulation_id:simulationId, p_new_date:newDate})
    });
    return r.json();
  },
  async saveProfile(token:string, userId:string, profile:any) {
    return this.upsertProfile(token, userId, profile);
  },
};