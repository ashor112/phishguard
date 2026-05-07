export const SHORTENER_LIST = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'short.io',
  'buff.ly', 'is.gd', 'rebrand.ly', 'tiny.cc', 'bit.do', 'cutt.ly',
  'shorturl.at', 'snip.ly', 'bl.ink', 'hyperurl.co', 't2mio.com',
  'shorte.st', 'adf.ly', 'su.pr', 'lnk.to', 'po.st',
  'v.gd', 'b.link', 'hubs.ly', 'go2l.ink', 'zzb.bz', 'clck.ru',
  'ouo.io', 'bc.vc', 'mcaf.ee', 'j.mp', 'youtu.be',
]);

export default {
  run(parsed) {
    const host = parsed.hostname;

    // Match exact hostname or check if it ends with a known shortener domain
    const isShortener = SHORTENER_LIST.has(host) ||
      [...SHORTENER_LIST].some(s => host.endsWith(`.${s}`));

    return {
      checkName: 'URL Shortener',
      passed: !isShortener,
      riskPoints: isShortener ? 15 : 0,
      details: isShortener
        ? `"${host}" is a known URL shortener — the final destination is hidden`
        : 'Domain is not a known URL shortener',
      description: 'URL shorteners hide the real destination. Attackers use them to bypass link preview and conceal phishing/malware URLs.',
    };
  },
};
