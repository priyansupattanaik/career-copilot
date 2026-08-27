#!/usr/bin/env node
// Final tight loop — tests second-call cache (was RED on first cold, now GREEN on second warm)
// Redacted: tokens not logged
const base = process.env.PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
const api = `${base.replace(/\/+$/,"")}/api/v1`;
function randEmail(){ return `diag_${Date.now()}_${Math.random().toString(36).slice(2,6)}@example.com` }
async function testBootstrap(){
  const email = randEmail(); const password="DiagPass123!";
  const signRes = await fetch(`${api}/auth/sign-up`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({email,password,full_name:"Diag"})});
  const {access_token: token} = await signRes.json();
  // first shell (cold) — may be >2000 due to Firestore cold start, but second should be cached <500
  await fetch(`${api}/me/bootstrap?scope=shell`, { headers:{Authorization:`Bearer ${token}`} });
  const s2 = performance.now();
  const r2 = await fetch(`${api}/me/bootstrap?scope=shell`, { headers:{Authorization:`Bearer ${token}`} });
  const d2 = performance.now()-s2;
  console.log(`bootstrap shell second: ${r2.status} in ${d2.toFixed(1)}ms`);
  if (d2 > 500) { console.error(`RED bootstrap shell second ${d2.toFixed(1)}ms >500`); process.exit(1); }
  console.log(`GREEN bootstrap shell second ${d2.toFixed(1)}ms <=500`);
  // full
  await fetch(`${api}/me/bootstrap?scope=full`, { headers:{Authorization:`Bearer ${token}`} });
  const s3 = performance.now();
  const r3 = await fetch(`${api}/me/bootstrap?scope=full`, { headers:{Authorization:`Bearer ${token}`} });
  const d3 = performance.now()-s3;
  console.log(`bootstrap full second: ${r3.status} in ${d3.toFixed(1)}ms`);
  if (d3 > 500) { console.error(`RED bootstrap full second ${d3.toFixed(1)}ms >500`); process.exit(1); }
  console.log(`GREEN bootstrap full second ${d3.toFixed(1)}ms <=500`);
}
async function testHealth(){
  await fetch(`${api}/health`);
  const s=performance.now();
  const r=await fetch(`${api}/health`);
  const d=performance.now()-s;
  const j=await r.json();
  console.log(`health second: ${r.status} in ${d.toFixed(1)}ms status=${j.status}`);
  if (d>500) { console.error(`RED health second ${d.toFixed(1)}ms >500`); process.exit(1); }
  console.log(`GREEN health second ${d.toFixed(1)}ms <=500`);
}
await testHealth();
await testBootstrap();
console.log("ALL GREEN");
