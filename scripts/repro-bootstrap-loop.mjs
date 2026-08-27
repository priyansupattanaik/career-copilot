#!/usr/bin/env node
// Tight loop for bootstrap latency — goes red when >2000ms (logs show 18537ms)
// Redacted: token is generated per run, never logged fully
const base = process.env.PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "http://127.0.0.1:8000";
const api = `${base.replace(/\/+$/,"")}/api/v1`;
function randEmail(){ return `diag_${Date.now()}_${Math.random().toString(36).slice(2,6)}@example.com` }
const email = randEmail();
const password = "DiagPass123!";
console.log(`Using email=<REDACTED> base=${api}`);
let token;
{
  const res = await fetch(`${api}/auth/sign-up`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email, password, full_name:"Diag User"}) });
  const body = await res.json().catch(()=>({}));
  if (!res.ok) { console.error(`sign-up failed ${res.status}`, JSON.stringify(body).slice(0,200)); process.exit(2); }
  token = body.access_token;
  console.log(`sign-up ok token=<REDACTED> len=${token?.length}`);
}
async function measure(scope){
  const url = `${api}/me/bootstrap?scope=${scope}`;
  const start = performance.now();
  const res = await fetch(url, { headers:{ Authorization:`Bearer ${token}` }});
  const dur = performance.now() - start;
  const body = await res.json().catch(()=>({}));
  return { status: res.status, dur, body };
}
for (const scope of ["shell","full"]) {
  const r = await measure(scope);
  console.log(`GET /me/bootstrap?scope=${scope} -> ${r.status} in ${r.dur.toFixed(1)}ms`);
  if (r.status!==200) console.log(`body=${JSON.stringify(r.body).slice(0,300)}`);
  const threshold = 2000;
  if (r.dur > threshold) {
    console.error(`RED: bootstrap ${scope} ${r.dur.toFixed(1)}ms > ${threshold}ms`);
    // keep going to show both
  } else {
    console.log(`GREEN: bootstrap ${scope} ${r.dur.toFixed(1)}ms <= ${threshold}ms`);
  }
  if (scope==="full" && r.dur>2000) process.exit(1);
}
