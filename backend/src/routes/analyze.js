import { Router } from 'express';
import { parse } from '../utils/urlParser.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { calculateScore } from '../services/scorer.js';
import { logAnalysis } from '../utils/activityLog.js';

import schemeCheck from '../services/schemeCheck.js';
import domainPatternCheck from '../services/domainPatternCheck.js';
import shortenerCheck from '../services/shortenerCheck.js';
import urlStructureCheck from '../services/urlStructureCheck.js';
import blacklistCheck from '../services/blacklistCheck.js';
import tldCheck from '../services/tldCheck.js';
import keywordCheck from '../services/keywordCheck.js';
import whoisCheck from '../services/whoisCheck.js';
import sslCheck from '../services/sslCheck.js';
import redirectCheck from '../services/redirectCheck.js';

const router = Router();

router.post('/analyze', validateRequest, async (req, res, next) => {
  const start = Date.now();
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  try {
    const parsed = parse(req.body.url.trim());

    // Fast synchronous checks run concurrently (all < 1ms)
    const [scheme, domain, shortener, structure, blacklist, tld, keyword] =
      await Promise.all([
        schemeCheck.run(parsed),
        domainPatternCheck.run(parsed),
        shortenerCheck.run(parsed),
        urlStructureCheck.run(parsed),
        blacklistCheck.run(parsed),
        tldCheck.run(parsed),
        keywordCheck.run(parsed),
      ]);

    // I/O-bound checks with individual timeouts — one failure doesn't block the others
    const [whoisResult, sslResult, redirectResult] = await Promise.allSettled([
      whoisCheck.run(parsed),
      sslCheck.run(parsed),
      redirectCheck.run(parsed),
    ]).then(results =>
      results.map(r =>
        r.status === 'fulfilled'
          ? r.value
          : {
              checkName: r.reason?.checkName || 'Unknown',
              passed: null,
              riskPoints: 0,
              details: `Check failed: ${r.reason?.message || 'Unknown error'}`,
              error: true,
            }
      )
    );

    const checks = {
      scheme,
      domain,
      shortener,
      structure,
      blacklist,
      tld,
      keyword,
      whois: whoisResult,
      ssl: sslResult,
      redirect: redirectResult,
    };

    const { score, verdict, breakdown } = calculateScore(checks);

    const unavailableCount = Object.values(checks).filter(c => c?.passed === null).length;
    const flags = breakdown.filter(c => c.passed === false).map(c => c.checkName);

    logAnalysis({
      url: parsed.href,
      score,
      verdict,
      flags,
      durationMs: Date.now() - start,
      ip,
      unavailableChecks: unavailableCount,
    });

    res.json({
      url: parsed.href,
      score,
      verdict,
      analyzedAt: new Date().toISOString(),
      breakdown,
      checks,
      meta: {
        unavailableChecks: unavailableCount,
        totalChecks: Object.keys(checks).length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
