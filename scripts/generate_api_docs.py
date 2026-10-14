"""Generate docs/API.md from OpenAPI specification."""
import json
from pathlib import Path
from app.main import app

spec = app.openapi()
by_tag = {}

for path, methods in sorted(spec["paths"].items()):
    for method, details in sorted(methods.items()):
        tags = details.get("tags") or ["General"]
        tag = tags[0]
        summary = details.get("summary") or ""
        
        # Determine authentication requirement
        is_public = (
            path.startswith("/health")
            or path.startswith("/api/health")
            or path in ["/api/v1/health/live", "/api/v1/health/ready"]
            or path.startswith("/api/v1/public/")
            or path in [
                "/api/v1/auth/sign-in",
                "/api/v1/auth/sign-up",
                "/api/v1/auth/reset-password",
                "/api/v1/auth/confirm-email",
                "/api/v1/auth/resend",
            ]
        )
        auth = "Public" if is_public else "Bearer JWT (Required)"
        
        entry = {
            "method": method.upper(),
            "path": path,
            "summary": summary,
            "auth": auth,
        }
        by_tag.setdefault(tag, []).append(entry)

out_lines = [
    "# Career Copilot API Reference\n\n",
    "This document is extracted directly from the verified FastAPI routes and OpenAPI specifications.\n\n",
    "- **Base Prefix**: `/api/v1`\n",
    "- **Liveness Probes**: `/health/live`, `/api/health/live`, `/api/v1/health/live`\n",
    "- **Response Error Envelope**: `{ \"error\": { \"code\": string, \"message\": string, \"details\": any, \"request_id\": string } }`\n\n",
]

for tag, endpoints in sorted(by_tag.items()):
    clean_tag = tag.replace("-", " ").title()
    out_lines.append(f"## {clean_tag}\n\n")
    out_lines.append("| Method | Path | Authentication | Description |\n")
    out_lines.append("|:---|:---|:---|:---|\n")
    for ep in endpoints:
        out_lines.append(f"| `{ep['method']}` | `{ep['path']}` | {ep['auth']} | {ep['summary']} |\n")
    out_lines.append("\n")

out_path = Path("docs/API.md")
out_path.write_text("".join(out_lines), encoding="utf-8")
print(f"Generated {out_path} with {len(spec['paths'])} paths.")
