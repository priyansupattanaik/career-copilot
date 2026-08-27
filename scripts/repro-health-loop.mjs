#!/usr/bin/env node
// Tight loop for health latency — goes red when /health > 2000ms (currently 3000-5000ms)
// Redacted: no secrets, unauthenticated endpoint
const base = process.env.PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "http://127.0.0.1:8000";
const url = `${base.replace(/\/+$/,"")}/api/v1/health`;
const thresholdMs = 2000;
async function once() {
  const start = performance.now();
  const res = await fetch(url);
  const dur = performance.now() - start;
  const body = await res.json().catch(()=>({}));
  return { status: res.status, dur, body };
}
const r = await once();
console.log(`GET ${url} -> ${r.status} in ${r.dur.toFixed(1)}ms`);
console.log(`probe status=${r.body.status} db=${r.body.database_status} storage=${r.body.storage_status}`);
if (r.dur > thresholdMs) {
  console.error(`RED: health latency ${r.dur.toFixed(1)}ms > ${thresholdMs}ms`);
  process.exit(1);
} else {
  console.log(`GREEN: health latency ${r.dur.toFixed(1)}ms <= ${thresholdMs}ms`);
}
