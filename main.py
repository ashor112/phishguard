"""
CLI entry point — python main.py <url>
All analysis logic lives in analyzer.py and is shared with the web app.
"""

import json
import os
import re
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from analyzer import (
    extract_domain,
    check_whois,
    check_ssl,
    check_redirects,
    analyze_with_claude,
    send_webhook_alert,
    parse_verdict,
)


def print_section(title: str, data: dict) -> None:
    bar = "=" * 62
    print(f"\n{bar}\n  {title}\n{bar}")
    for key, value in data.items():
        if isinstance(value, list) and value:
            print(f"  {key}:")
            for item in value:
                print(f"    - {item}")
        else:
            print(f"  {key:<30}: {value}")


def analyze_url(url: str) -> None:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    domain = extract_domain(url)

    print(f"\n{'#' * 62}\n  Phishing Link Analyzer\n{'#' * 62}")
    print(f"  URL    : {url}\n  Domain : {domain}")

    print("\n[1/4] Querying WHOIS ...")
    whois_data = check_whois(domain)
    print_section("WHOIS — Domain Registration", whois_data)

    print("\n[2/4] Checking SSL certificate ...")
    ssl_data = check_ssl(url, domain)
    print_section("SSL Certificate", ssl_data)

    print("\n[3/4] Tracing HTTP redirects ...")
    redirect_data = check_redirects(url)
    print_section("HTTP Redirects", redirect_data)

    print("\n[4/4] Sending to Claude AI ...")
    analysis = analyze_with_claude(url, whois_data, ssl_data, redirect_data)
    verdict, risk_score = parse_verdict(analysis)

    print(f"\n{'=' * 62}\n  Claude AI Analysis\n{'=' * 62}")
    print(analysis)
    print(f"\n  Verdict: {verdict}   Risk Score: {risk_score}/10")
    print(f"\n{'#' * 62}\n")

    webhook_url = os.environ.get("N8N_WEBHOOK_URL")
    if webhook_url and (risk_score >= 7 or "LIKELY PHISHING" in verdict):
        print("[Alert] Sending webhook alert ...")
        send_webhook_alert(webhook_url, {
            "url": url, "domain": domain, "verdict": verdict,
            "risk_score": risk_score, "whois": whois_data,
            "ssl": ssl_data, "redirects": redirect_data,
            "analysis": analysis,
        })


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage:   python main.py <url>")
        print("Example: python main.py https://suspicious-site.com")
        sys.exit(1)
    analyze_url(sys.argv[1])


if __name__ == "__main__":
    main()
