"""
Flask web application — Phishing Link Analyzer
Run with:  python app.py
Visit:     http://localhost:5000
"""

import json
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flask import Flask, render_template, request, Response, stream_with_context
from analyzer import (
    extract_domain,
    check_whois,
    check_ssl,
    check_redirects,
    analyze_with_claude,
    send_webhook_alert,
    parse_verdict,
)

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze")
def analyze():
    url = request.args.get("url", "").strip()

    if not url:
        return Response(
            _event("error", {"message": "No URL provided"}),
            content_type="text/event-stream",
        )

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    domain = extract_domain(url)

    def generate():
        whois_data = ssl_data = redirect_data = analysis = None
        current_step = None

        # Pre-flight: catch missing API key immediately so the user gets a
        # clear message rather than a cryptic auth error after waiting.
        if not os.environ.get("ANTHROPIC_API_KEY"):
            yield _event("error", {
                "step": "claude",
                "message": (
                    "ANTHROPIC_API_KEY is not set. "
                    "Add it to your .env file and restart the server."
                ),
                "hint": "Run  python setup.py  to configure your keys.",
            })
            return

        try:
            yield _event("start", {"url": url, "domain": domain})

            # Step 1 — WHOIS
            current_step = "whois"
            yield _event("step_start", {"step": "whois"})
            whois_data = check_whois(domain)
            yield _event("step_done", {"step": "whois", "data": whois_data})

            # Step 2 — SSL
            current_step = "ssl"
            yield _event("step_start", {"step": "ssl"})
            ssl_data = check_ssl(url, domain)
            yield _event("step_done", {"step": "ssl", "data": ssl_data})

            # Step 3 — Redirects
            current_step = "redirects"
            yield _event("step_start", {"step": "redirects"})
            redirect_data = check_redirects(url)
            yield _event("step_done", {"step": "redirects", "data": redirect_data})

            # Step 4 — Claude AI
            current_step = "claude"
            yield _event("step_start", {"step": "claude"})
            analysis = analyze_with_claude(url, whois_data, ssl_data, redirect_data)
            verdict, risk_score = parse_verdict(analysis)
            yield _event("step_done", {"step": "claude", "data": analysis})

            # Final summary
            yield _event("complete", {"verdict": verdict, "risk_score": risk_score})

            # Webhook alert for high-risk verdicts
            webhook_url = os.environ.get("N8N_WEBHOOK_URL")
            if webhook_url and (risk_score >= 7 or "LIKELY PHISHING" in verdict):
                send_webhook_alert(webhook_url, {
                    "url": url, "domain": domain, "verdict": verdict,
                    "risk_score": risk_score, "whois": whois_data,
                    "ssl": ssl_data, "redirects": redirect_data,
                    "analysis": analysis,
                })
                yield _event("alert_sent", {})

        except Exception as exc:
            yield _event("error", {"step": current_step, "message": str(exc)})

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _event(event_type: str, payload: dict) -> str:
    payload["type"] = event_type
    return f"data: {json.dumps(payload, default=str)}\n\n"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n  Phishing Link Analyzer running at http://localhost:{port}\n")
    app.run(debug=True, host="0.0.0.0", port=port, threaded=True)
