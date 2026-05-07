"""
Core analysis module — imported by both app.py (web) and main.py (CLI).
All functions are pure: they take input, return dicts/strings, no side effects.
"""

import re
import ssl
import socket
import json
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
import whois
import anthropic


def extract_domain(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc or parsed.path


# ---------------------------------------------------------------------------
# Check 1: WHOIS
# ---------------------------------------------------------------------------

def check_whois(domain: str) -> dict:
    try:
        w = whois.whois(domain)
        creation_date = w.creation_date

        if isinstance(creation_date, list):
            creation_date = min(creation_date)

        if creation_date is None:
            return {"error": "No creation date found", "is_newly_registered": None}

        if creation_date.tzinfo is None:
            creation_date = creation_date.replace(tzinfo=timezone.utc)

        age_days = (datetime.now(timezone.utc) - creation_date).days

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
# Check 2: SSL
# ---------------------------------------------------------------------------

def check_ssl(url: str, domain: str) -> dict:
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

                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                result["issuer"] = issuer_dict.get("organizationName", "Unknown")

                expiry_str = cert.get("notAfter", "")
                if expiry_str:
                    expiry_dt = datetime.strptime(expiry_str, "%b %d %H:%M:%S %Y %Z")
                    expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
                    result["expiry_date"] = str(expiry_dt)
                    result["days_until_expiry"] = (
                        expiry_dt - datetime.now(timezone.utc)
                    ).days

                result["certificate_valid"] = True

    except ssl.SSLCertVerificationError as exc:
        result["error"] = f"SSL verification failed: {exc}"
    except Exception as exc:
        result["error"] = str(exc)

    return result


# ---------------------------------------------------------------------------
# Check 3: Redirects
# ---------------------------------------------------------------------------

def check_redirects(url: str) -> dict:
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
# Check 4: Claude AI analysis
# ---------------------------------------------------------------------------

def analyze_with_claude(url: str, whois_data: dict, ssl_data: dict, redirect_data: dict) -> str:
    client = anthropic.Anthropic()

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

1. **Phishing Risk Score** — integer 1-10 (10 = highest risk)
2. **Social Engineering Indicators** — list any tactics detected
3. **Technical Red Flags** — findings from WHOIS, SSL, and redirect data
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
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    )

    for block in message.content:
        if block.type == "text":
            return block.text

    return "(No text response returned by Claude.)"


# ---------------------------------------------------------------------------
# Webhook alert — n8n → Telegram
# ---------------------------------------------------------------------------

def send_webhook_alert(webhook_url: str, payload: dict) -> None:
    try:
        requests.post(webhook_url, json=payload, timeout=10)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Parse verdict + risk score from Claude output
# ---------------------------------------------------------------------------

def parse_verdict(analysis: str) -> tuple:
    """Return (verdict, risk_score) parsed from Claude's analysis text."""
    score_match = re.search(r'(?i)risk\s+score[^\d]*(\d+)', analysis)
    risk_score = int(score_match.group(1)) if score_match else 0

    verdict_match = re.search(
        r'(?i)\*{0,2}verdict\*{0,2}[^:]*:\s*\*{0,2}(SAFE|SUSPICIOUS|LIKELY\s+PHISHING)\*{0,2}',
        analysis,
    )
    verdict = (
        re.sub(r'\s+', ' ', verdict_match.group(1).upper())
        if verdict_match
        else "UNKNOWN"
    )

    return verdict, risk_score
