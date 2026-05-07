"""
Phishing Link Analyzer
======================
Analyzes a URL for phishing and social engineering indicators by:
  1. Checking domain registration age via WHOIS
  2. Validating the SSL certificate
  3. Tracing HTTP redirects
  4. Sending all findings to Claude API for social engineering analysis
"""

import os
import re
import ssl
import socket
import json
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

# Load .env file created by setup.py before reading any env vars
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import requests
import whois
import anthropic


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_domain(url: str) -> str:
    """Return the bare domain (netloc) from a URL string."""
    parsed = urlparse(url)
    return parsed.netloc or parsed.path


# ---------------------------------------------------------------------------
# Check 1: WHOIS — domain registration age
# ---------------------------------------------------------------------------

def check_whois(domain: str) -> dict:
    """
    Query WHOIS for the domain and compute its age in days.
    Domains younger than 30 days are flagged as newly registered,
    a strong phishing indicator.
    """
    try:
        w = whois.whois(domain)
        creation_date = w.creation_date

        # python-whois sometimes returns a list; take the earliest date
        if isinstance(creation_date, list):
            creation_date = min(creation_date)

        if creation_date is None:
            return {"error": "No creation date found", "is_newly_registered": None}

        # Normalise to UTC-aware datetime
        if creation_date.tzinfo is None:
            creation_date = creation_date.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        age_days = (now - creation_date).days

        expiration_date = w.expiration_date
        if isinstance(expiration_date, list):
            expiration_date = expiration_date[0]

        return {
            "registrar": w.registrar,
            "creation_date": str(creation_date),
            "age_days": age_days,
            "is_newly_registered": age_days < 30,
            "expiration_date": str(expiration_date),
            "country": w.country,
        }

    except Exception as exc:
        return {"error": str(exc), "is_newly_registered": None}


# ---------------------------------------------------------------------------
# Check 2: SSL — certificate validity
# ---------------------------------------------------------------------------

def check_ssl(url: str, domain: str) -> dict:
    """
    Verify the SSL certificate for a domain.
    Returns issuer, expiry date, days until expiry, and whether it is valid.
    """
    result = {
        "has_ssl": url.startswith("https://"),
        "certificate_valid": False,
        "issuer": None,
        "expiry_date": None,
        "days_until_expiry": None,
        "error": None,
    }

    if not result["has_ssl"]:
        result["error"] = "URL does not use HTTPS"
        return result

    try:
        context = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()

                # Issuer organisation
                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                result["issuer"] = issuer_dict.get("organizationName", "Unknown")

                # Expiry date and countdown
                expiry_str = cert.get("notAfter", "")
                if expiry_str:
                    expiry_dt = datetime.strptime(expiry_str, "%b %d %H:%M:%S %Y %Z")
                    expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                    result["expiry_date"] = str(expiry_dt)
                    result["days_until_expiry"] = (expiry_dt - datetime.now(timezone.utc)).days

                result["certificate_valid"] = True

    except ssl.SSLCertVerificationError as exc:
        result["error"] = f"SSL verification failed: {exc}"
    except Exception as exc:
        result["error"] = str(exc)

    return result


# ---------------------------------------------------------------------------
# Check 3: Redirects — using the requests library
# ---------------------------------------------------------------------------

def check_redirects(url: str) -> dict:
    """
    Follow the URL through any redirect chain and record each hop.
    A cross-domain redirect (landing on a different domain than the one
    originally requested) is a common phishing tactic.
    """
    result = {
        "redirect_count": 0,
        "redirect_chain": [],
        "final_url": url,
        "status_code": None,
        "cross_domain_redirect": False,
        "error": None,
    }

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0 Safari/537.36"
        )
    }

    try:
        response = requests.get(url, allow_redirects=True, timeout=10, headers=headers)

        result["status_code"] = response.status_code
        result["final_url"] = response.url
        result["redirect_count"] = len(response.history)

        original_domain = extract_domain(url)

        for hop in response.history:
            result["redirect_chain"].append({
                "from_url": hop.url,
                "status_code": hop.status_code,
                "location_header": hop.headers.get("Location", ""),
            })

        # Flag if the redirect chain lands on a completely different domain
        final_domain = extract_domain(result["final_url"])
        result["cross_domain_redirect"] = (
            original_domain != final_domain and result["redirect_count"] > 0
        )

    except requests.exceptions.SSLError as exc:
        result["error"] = f"SSL error during request: {exc}"
    except requests.exceptions.ConnectionError as exc:
        result["error"] = f"Connection error: {exc}"
    except requests.exceptions.Timeout:
        result["error"] = "Request timed out after 10 seconds"
    except Exception as exc:
        result["error"] = str(exc)

    return result


# ---------------------------------------------------------------------------
# Check 4: Claude API — social engineering analysis
# ---------------------------------------------------------------------------

def analyze_with_claude(
    url: str,
    whois_data: dict,
    ssl_data: dict,
    redirect_data: dict,
) -> str:
    """
    Send the gathered technical data to Claude (claude-opus-4-7) and ask it
    to identify social engineering tactics and produce a phishing risk verdict.

    Uses adaptive thinking so Claude can reason deeply about subtle indicators
    before producing the final structured report.
    """
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from environment

    payload = {
        "url_analyzed": url,
        "whois": whois_data,
        "ssl": ssl_data,
        "redirects": redirect_data,
    }

    prompt = f"""You are a cybersecurity expert specialising in phishing detection \
and social engineering analysis.

Analyse the URL and its technical metadata below for phishing and social engineering \
indicators. Produce a structured report with the following sections:

1. **Phishing Risk Score** — integer 1–10 (10 = highest risk)
2. **Social Engineering Indicators** — list any tactics detected (urgency, impersonation, \
brand spoofing, misleading subdomains, lookalike domains, etc.)
3. **Technical Red Flags** — findings derived from the WHOIS, SSL, and redirect data
4. **Domain Analysis** — age, registration patterns, legitimacy assessment
5. **SSL Assessment** — whether the certificate configuration is suspicious
6. **Redirect Analysis** — whether the redirect chain suggests malicious intent
7. **Verdict** — one of: SAFE / SUSPICIOUS / LIKELY PHISHING
8. **Recommended Action** — what the end user should do

Be concise but thorough. Focus on actionable insights.

---
URL: {url}

Technical data:
{json.dumps(payload, indent=2, default=str)}
"""

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=4096,
        thinking={"type": "adaptive"},  # let Claude reason before answering
        messages=[{"role": "user", "content": prompt}],
    )

    # With adaptive thinking the response may contain a thinking block followed
    # by the text block; extract only the final text answer.
    for block in message.content:
        if block.type == "text":
            return block.text

    return "(No text response returned by Claude.)"


# ---------------------------------------------------------------------------
# Webhook alert — forward high-risk findings to n8n
# ---------------------------------------------------------------------------

def send_webhook_alert(webhook_url: str, payload: dict) -> None:
    """POST a high-risk phishing alert payload to the n8n webhook URL."""
    try:
        response = requests.post(webhook_url, json=payload, timeout=10)
        print(f"  [Webhook] Alert sent → HTTP {response.status_code}")
    except Exception as exc:
        print(f"  [Webhook] Failed to send alert: {exc}")


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

def print_section(title: str, data: dict) -> None:
    """Pretty-print a labelled dictionary section to stdout."""
    bar = "=" * 60
    print(f"\n{bar}")
    print(f"  {title}")
    print(bar)
    for key, value in data.items():
        if isinstance(value, list) and value:
            print(f"  {key}:")
            for item in value:
                print(f"    • {item}")
        else:
            print(f"  {key:<28}: {value}")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def analyze_url(url: str) -> None:
    """Run all four checks against a URL and print the results."""

    # Ensure the URL has a scheme so urlparse works correctly
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    domain = extract_domain(url)

    print(f"\n{'#' * 62}")
    print(f"  Phishing Link Analyzer")
    print(f"{'#' * 62}")
    print(f"  URL    : {url}")
    print(f"  Domain : {domain}")

    # --- Step 1: WHOIS ---
    print("\n[1/4] Querying WHOIS data …")
    whois_data = check_whois(domain)
    print_section("WHOIS — Domain Registration", whois_data)

    # --- Step 2: SSL ---
    print("\n[2/4] Checking SSL certificate …")
    ssl_data = check_ssl(url, domain)
    print_section("SSL Certificate", ssl_data)

    # --- Step 3: Redirects ---
    print("\n[3/4] Tracing HTTP redirects …")
    redirect_data = check_redirects(url)
    print_section("HTTP Redirects", redirect_data)

    # --- Step 4: Claude analysis ---
    print("\n[4/4] Sending data to Claude for social engineering analysis …")
    analysis = analyze_with_claude(url, whois_data, ssl_data, redirect_data)

    print(f"\n{'=' * 60}")
    print("  Claude AI — Social Engineering Analysis")
    print(f"{'=' * 60}")
    print(analysis)
    print(f"\n{'#' * 62}\n")

    # --- Step 5: Webhook alert (optional, only when N8N_WEBHOOK_URL is set) ---
    webhook_url = os.environ.get("N8N_WEBHOOK_URL")
    if webhook_url:
        score_match = re.search(r'(?i)risk\s+score[^\d]*(\d+)', analysis)
        risk_score = int(score_match.group(1)) if score_match else 0

        verdict_match = re.search(
            r'(?i)\*{0,2}verdict\*{0,2}[^:]*:\s*\*{0,2}(SAFE|SUSPICIOUS|LIKELY\s+PHISHING)\*{0,2}',
            analysis,
        )
        verdict = re.sub(r'\s+', ' ', verdict_match.group(1).upper()) if verdict_match else "UNKNOWN"

        if risk_score >= 7 or "LIKELY PHISHING" in verdict:
            alert_payload = {
                "url": url,
                "domain": domain,
                "verdict": verdict,
                "risk_score": risk_score,
                "whois": whois_data,
                "ssl": ssl_data,
                "redirects": redirect_data,
                "analysis": analysis,
            }
            print("[Alert] High-risk verdict detected — sending webhook alert …")
            send_webhook_alert(webhook_url, alert_payload)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage:   python phishing_analyzer.py <url>")
        print("Example: python phishing_analyzer.py https://example.com")
        sys.exit(1)

    analyze_url(sys.argv[1])


if __name__ == "__main__":
    main()
