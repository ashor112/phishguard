/* ── State ─────────────────────────────────────────────────────────────── */
let eventSource = null;
const collected = {};   // accumulates data from step_done events

/* ── Boot ──────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('analyze-btn').addEventListener('click', startAnalysis);
  document.getElementById('url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startAnalysis();
  });
});

/* ── Start analysis ────────────────────────────────────────────────────── */
function startAnalysis() {
  const url = document.getElementById('url-input').value.trim();
  hide('input-error');

  if (!url) {
    showError('Please enter a URL to analyze.');
    return;
  }

  // Close any previous stream
  if (eventSource) { eventSource.close(); eventSource = null; }

  // Reset state
  Object.keys(collected).forEach(k => delete collected[k]);

  // Reset step icons
  ['whois', 'ssl', 'redirects', 'claude'].forEach(s => setStepStatus(s, 'pending'));

  // Show progress, hide results and any previous error
  hide('results-section');
  hide('error-panel');
  show('progress-section');
  setAnalyzingLabel('Connecting...');
  setButtonLoading(true);

  // Open SSE stream
  eventSource = new EventSource('/analyze?url=' + encodeURIComponent(url));

  eventSource.onmessage = (e) => {
    try { handleEvent(JSON.parse(e.data)); }
    catch (err) { console.error('Parse error:', err); }
  };

  eventSource.onerror = () => {
    eventSource.close();
    eventSource = null;
    setAnalyzingLabel('Connection lost. Please try again.');
    setButtonLoading(false);
  };
}

/* ── Event dispatcher ──────────────────────────────────────────────────── */
function handleEvent(data) {
  switch (data.type) {

    case 'start':
      setAnalyzingLabel('Analyzing: ' + data.domain);
      break;

    case 'step_start':
      setStepStatus(data.step, 'running');
      break;

    case 'step_done':
      setStepStatus(data.step, 'done');
      if (data.step === 'claude') {
        collected.analysis = data.data;
      } else {
        collected[data.step] = data.data;
      }
      break;

    case 'complete':
      collected.verdict    = data.verdict;
      collected.risk_score = data.risk_score;
      renderResults();
      hide('progress-section');
      show('results-section');
      setButtonLoading(false);
      eventSource.close();
      eventSource = null;
      break;

    case 'alert_sent':
      show('alert-badge');
      break;

    case 'error':
      // Mark the failing step (or any spinning step) as error
      if (data.step) {
        setStepStatus(data.step, 'error');
      } else {
        ['whois', 'ssl', 'redirects', 'claude'].forEach(s => {
          const icon = document.getElementById('icon-' + s);
          if (icon && icon.classList.contains('running')) setStepStatus(s, 'error');
        });
      }
      setAnalyzingLabel('Analysis stopped due to an error.');
      showErrorPanel(data.message, data.hint || '');
      setButtonLoading(false);
      if (eventSource) { eventSource.close(); eventSource = null; }
      break;
  }
}

/* ── Render all results ────────────────────────────────────────────────── */
function renderResults() {
  renderVerdict(collected.verdict, collected.risk_score);
  renderWhois(collected.whois || {});
  renderSsl(collected.ssl || {});
  renderRedirects(collected.redirects || {});
  renderAnalysis(collected.analysis || '');
  hide('alert-badge');
}

/* ── Verdict banner ────────────────────────────────────────────────────── */
function renderVerdict(verdict, score) {
  const banner = document.getElementById('verdict-banner');
  const vText  = document.getElementById('verdict-text');
  const sNum   = document.getElementById('score-number');
  const sFill  = document.getElementById('score-fill');

  vText.textContent = verdict;
  sNum.textContent  = score + ' / 10';

  // Animate score bar after a tick so CSS transition triggers
  setTimeout(() => { sFill.style.width = (score * 10) + '%'; }, 50);

  banner.className = 'verdict-banner';
  if (verdict === 'SAFE')             banner.classList.add('safe');
  else if (verdict === 'SUSPICIOUS')  banner.classList.add('suspicious');
  else                                banner.classList.add('danger');
}

/* ── WHOIS card ────────────────────────────────────────────────────────── */
function renderWhois(d) {
  const rows = [];

  if (d.error) {
    rows.push(row('Status', badge('neutral', 'Lookup failed')));
    rows.push(row('Detail', esc(d.error)));
  } else {
    rows.push(row('Registrar',  esc(d.registrar || 'Unknown')));
    rows.push(row('Created',    esc(shortDate(d.creation_date))));
    rows.push(row('Expires',    esc(shortDate(d.expiration_date))));
    rows.push(row('Domain Age', ageBadge(d.age_days)));
    rows.push(row('Country',    esc(d.country || '—')));
  }

  document.getElementById('whois-body').innerHTML = rows.join('');
}

function ageBadge(days) {
  if (days == null) return badge('neutral', 'Unknown');
  if (days < 30)    return badge('danger', days + ' days — NEW');
  if (days < 180)   return badge('warn',   days + ' days');
  return badge('safe', days + ' days');
}

/* ── SSL card ──────────────────────────────────────────────────────────── */
function renderSsl(d) {
  const rows = [];

  rows.push(row('Protocol', d.has_ssl ? badge('safe', 'HTTPS') : badge('danger', 'HTTP only')));
  rows.push(row('Certificate', d.certificate_valid ? badge('safe', 'Valid') : badge('danger', 'Invalid')));

  if (d.issuer)            rows.push(row('Issuer',    esc(d.issuer)));
  if (d.expiry_date)       rows.push(row('Expires',   esc(shortDate(d.expiry_date))));
  if (d.days_until_expiry != null) {
    const days = d.days_until_expiry;
    const b = days < 14 ? badge('danger', days + ' days') :
              days < 30 ? badge('warn',   days + ' days') :
                          badge('safe',   days + ' days');
    rows.push(row('Days Left', b));
  }
  if (d.error && !d.certificate_valid) rows.push(row('Error', '<span class="row-val" style="color:var(--danger-text);font-size:0.78rem">' + esc(d.error.substring(0, 80)) + '</span>'));

  document.getElementById('ssl-body').innerHTML = rows.join('');
}

/* ── Redirects card ────────────────────────────────────────────────────── */
function renderRedirects(d) {
  const rows = [];

  rows.push(row('Hops',       String(d.redirect_count || 0)));
  rows.push(row('Status',     d.status_code ? esc(String(d.status_code)) : '—'));
  rows.push(row('Cross-domain', d.cross_domain_redirect ? badge('danger', 'Yes') : badge('safe', 'No')));

  if (d.final_url && d.final_url !== collected.url) {
    rows.push(row('Final URL', '<span class="row-val" style="font-family:var(--font-mono);font-size:0.75rem">' + esc(d.final_url.substring(0, 60)) + '</span>'));
  }

  let html = rows.join('');

  if (d.redirect_chain && d.redirect_chain.length > 0) {
    html += '<div style="margin-top:10px;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">Hop chain:</div>';
    d.redirect_chain.forEach((hop, i) => {
      html += '<div class="redirect-hop"><span class="hop-status">' + esc(String(hop.status_code)) + '</span>' + esc(hop.from_url.substring(0, 70)) + '</div>';
    });
  }

  if (d.error) rows.push(row('Error', '<span style="color:var(--danger-text)">' + esc(d.error.substring(0, 80)) + '</span>'));

  document.getElementById('redirects-body').innerHTML = html;
}

/* ── Claude analysis ───────────────────────────────────────────────────── */
function renderAnalysis(text) {
  document.getElementById('analysis-body').innerHTML = mdToHtml(text);
}

/* ── Markdown → HTML ───────────────────────────────────────────────────── */
function mdToHtml(text) {
  if (!text) return '';

  const lines = text.split('\n');
  let html = '';
  let inOl = false, inUl = false;

  function closeLists() {
    if (inOl) { html += '</ol>'; inOl = false; }
    if (inUl) { html += '</ul>'; inUl = false; }
  }

  function inline(s) {
    return s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,     '<em>$1</em>')
      .replace(/`(.+?)`/g,       '<code>$1</code>');
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^### /.test(trimmed)) {
      closeLists();
      html += '<h3>' + inline(trimmed.slice(4)) + '</h3>';
    } else if (/^## /.test(trimmed)) {
      closeLists();
      html += '<h2>' + inline(trimmed.slice(3)) + '</h2>';
    } else if (/^# /.test(trimmed)) {
      closeLists();
      html += '<h2>' + inline(trimmed.slice(2)) + '</h2>';
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (inUl) { html += '</ul>'; inUl = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += '<li>' + inline(trimmed.replace(/^\d+\.\s/, '')) + '</li>';
    } else if (/^[-*•]\s/.test(trimmed)) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inUl) { html += '<ul>'; inUl = true; }
      html += '<li>' + inline(trimmed.replace(/^[-*•]\s/, '')) + '</li>';
    } else if (trimmed === '') {
      closeLists();
      html += '<br>';
    } else {
      closeLists();
      html += '<p>' + inline(trimmed) + '</p>';
    }
  }

  closeLists();
  return html;
}

/* ── DOM helpers ───────────────────────────────────────────────────────── */
function row(key, valHtml) {
  return '<div class="row"><span class="row-key">' + key + '</span><span class="row-val">' + valHtml + '</span></div>';
}

function badge(type, text) {
  return '<span class="badge badge-' + type + '">' + esc(text) + '</span>';
}

function esc(str) {
  if (str == null) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function shortDate(str) {
  if (!str || str === 'None') return '—';
  try { return new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return str.substring(0, 10); }
}

/* ── Step icons ────────────────────────────────────────────────────────── */
function setStepStatus(step, status) {
  const icon = document.getElementById('icon-' + step);
  if (!icon) return;
  icon.className = 'step-icon ' + (status === 'pending' ? '' : status);
}

/* ── UI helpers ────────────────────────────────────────────────────────── */
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }

function setAnalyzingLabel(text) {
  document.getElementById('analyzing-label').textContent = text;
}

function setButtonLoading(loading) {
  const btn     = document.getElementById('analyze-btn');
  const txt     = document.getElementById('btn-text');
  const spinner = document.getElementById('btn-spinner');
  btn.disabled  = loading;
  loading ? hide('btn-text')    : show('btn-text');
  loading ? show('btn-spinner') : hide('btn-spinner');
}

function showError(msg) {
  const el = document.getElementById('input-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showErrorPanel(message, hint) {
  document.getElementById('error-message').textContent = message;
  const hintEl = document.getElementById('error-hint');
  if (hint) {
    hintEl.innerHTML = hint.replace(
      /(python\s+\S+\.py)/g,
      '<code>$1</code>'
    );
  } else {
    hintEl.textContent = '';
  }
  show('error-panel');
}

function resetAndFocus() {
  hide('results-section');
  hide('progress-section');
  hide('error-panel');
  hide('alert-badge');
  document.getElementById('url-input').value = '';
  document.getElementById('url-input').focus();
  document.getElementById('verdict-banner').className = 'verdict-banner';
  document.getElementById('score-fill').style.width = '0%';
}
