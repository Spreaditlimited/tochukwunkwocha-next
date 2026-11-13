import { AwsClient } from 'aws4fetch';
import { parseVaultAccess, parseVaultCatalog, VAULT_ACCESS_KEY, VAULT_CATALOG_KEY } from '../../lib/vault-catalog.ts';
import { normalizeSubscriberEmail, parseVaultSubscribers, VAULT_SUBSCRIBERS_KEY } from '../../lib/vault-subscribers.ts';
import { createMemberSession, memberSessionEmail } from './member-session.js';

export const TEMPLATES = [
  {
    id: 'reunion-roadmap',
    title: '12-to-18 Month Family Reunification & Budget Tracker',
    desc: 'Map your family reunion timeline, plan monthly savings, and keep your budget in one place.',
    category: 'Family & planning',
    file: '12-month-reunion-budget.xlsx',
  },
  {
    id: 'hr-swipe-file',
    title: 'UK Workplace Documentation & Email Trail Swipe File',
    desc: 'Keep a clear paper trail with practical workplace records and adaptable email templates.',
    category: 'Work & career',
    file: 'uk-hr-paper-trail-templates.pdf',
  },
  {
    id: 'brand-margin-calc',
    title: 'UK Private-Label Product & Landed Margin Calculator',
    desc: 'Bring product costs, shipping, and landed margins together before your next sourcing decision.',
    category: 'Business & importing',
    file: 'uk-brand-margin-calculator.xlsx',
  },
];

const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Strict-Transport-Security': 'max-age=31536000',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const COOKIE_FLAGS = 'Path=/; HttpOnly; Secure; SameSite=Strict';
function localPreview(request, env) {
  const url = new URL(request.url);
  return env.VAULT_LOCAL_PREVIEW === 'true' && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}
function cookieFlags(request, env) {
  return localPreview(request, env) ? 'Path=/; HttpOnly; SameSite=Strict' : COOKIE_FLAGS;
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...SECURITY_HEADERS, ...headers } });
}
function html(body, status = 200) {
  return response(body, status, { 'Content-Type': 'text/html; charset=utf-8' });
}
function redirect(location, cookie) {
  return response(null, 302, { Location: location, ...(cookie ? { 'Set-Cookie': cookie } : {}) });
}
async function subscriberEmails(env, request) {
  const record = await privateVaultJson(env, request, VAULT_SUBSCRIBERS_KEY);
  return record === null ? [] : parseVaultSubscribers(record).emails;
}
async function authenticated(request, env, code) {
  const email = await memberSessionEmail(request, code);
  return email !== null && (await subscriberEmails(env, request)).includes(email);
}

const CSS = `
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#101412;color:#f4f6f1}
.brand-logo{display:block;width:230px;max-width:100%;height:auto}.masthead .brand{min-width:0;flex:1}.sidebar .brand-logo{width:196px}*{box-sizing:border-box}body{margin:0;min-height:100svh;background:radial-gradient(ellipse at 90% 0%,#24362b66,transparent 55%)}
a{color:inherit}button,input{font:inherit}button,.download{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #c1ec8e;outline-offset:4px}
.shell{max-width:1120px;margin:auto;padding:36px 24px 28px}.masthead{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:28px;border-bottom:1px solid #ffffff18}.brand{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:650}.mark{display:grid;place-items:center;width:40px;height:40px;border:1px solid #c1ec8e66;border-radius:50%;color:#c1ec8e;font-family:Georgia,serif;font-size:23px}.eyebrow{color:#c1ec8e;text-transform:uppercase;font-size:11px;letter-spacing:.18em;font-weight:700}.muted,footer{color:#a5b0a9;line-height:1.7}.hero{padding:64px 0 32px;max-width:680px}h1{font-size:clamp(36px,6vw,60px);line-height:1.08;letter-spacing:-.045em;font-weight:550;margin:14px 0 20px}h2{font-size:21px;line-height:1.35;letter-spacing:-.02em;margin:18px 0 12px}p{line-height:1.7}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;padding:10px 0 56px}.card{display:flex;flex-direction:column;background:#1b221e;border:1px solid #ffffff15;border-radius:18px;padding:26px}.card p{color:#a5b0a9;font-size:14px;margin:0 0 28px}.card .download{margin-top:auto}.tag{font-size:11px;letter-spacing:.06em;color:#c1ec8e}.format{color:#87968b;font-size:11px;margin-bottom:16px;letter-spacing:.08em}.download,.primary{display:block;text-align:center;background:#c1ec8e;color:#172013;border:0;border-radius:9px;padding:14px 18px;font-weight:700;text-decoration:none}.download:hover,.primary:hover{background:#d0f7a4}.quiet{background:transparent;border:1px solid #ffffff26;color:#c3ccc5;border-radius:8px;padding:9px 14px;font-size:13px}.login{max-width:480px;margin:70px auto 90px}.login h1{font-size:clamp(34px,6vw,44px)}.login-card{margin-top:28px;padding:28px;background:#1b221e;border:1px solid #ffffff18;border-radius:18px}label{display:block;font-size:14px;margin-bottom:10px;font-weight:600}input{width:100%;min-width:0;padding:14px;background:#101713;color:#f4f6f1;border:1px solid #ffffff35;border-radius:8px;margin-bottom:16px}.primary{width:100%}.hint{font-size:13px;color:#a5b0a9;margin-bottom:0}.error{background:#472a27;color:#ffd0c6;padding:14px;border-radius:8px;font-size:14px;margin:0 0 20px}footer{border-top:1px solid #ffffff18;padding-top:22px;font-size:12px;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}
/* Width and type scale match the current Sure Imports homepage. */
.shell.landing-shell{width:min(100%,1440px);max-width:1440px;padding:36px 32px 28px}
.landing-member-link{font-size:14px;font-weight:500;text-decoration:none;color:#c1ec8e;white-space:nowrap}.landing-member-link:hover{text-decoration:underline}
.landing-columns{display:grid;grid-template-columns:minmax(0,1fr) 440px;grid-template-areas:"story access";gap:clamp(32px,4vw,60px);padding:56px 0 40px;align-items:start}
.landing-story{grid-area:story}.landing-access{grid-area:access}
.landing-story>.eyebrow{font-size:12px;font-weight:500;letter-spacing:.035em;line-height:1.7}
.landing-story h1{font-size:clamp(40px,5vw,72px);line-height:1.08;margin:20px 0 24px;letter-spacing:-.045em;font-weight:600}
.landing-story h1 span{color:#c1ec8e}.landing-lead{max-width:660px;font-size:18px;line-height:1.7;color:#a8b8ac;margin:0 0 32px}
.landing-focus h2{font-size:21px;line-height:1.35;font-weight:500;letter-spacing:-.025em;margin:0 0 24px;color:#e4ebe0}
.focus-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:24px 28px}.focus-list li{border-top:1px solid #ffffff16;padding-top:16px}.focus-list strong{display:block;font-size:18px;line-height:1.35;color:#cfe2be;font-weight:500;margin-bottom:9px}.focus-list span{display:block;font-size:16px;line-height:1.7;color:#93a797}.focus-list li:last-child{grid-column:1/-1}
.landing-access .login-card{margin:0;padding:30px;border-radius:14px;border-color:#c1ec8e25;background:#1b241e;scroll-margin-top:24px}.landing-access .eyebrow{font-size:12px;font-weight:500;letter-spacing:.035em}.landing-access h2{font-size:clamp(28px,3vw,38px);line-height:1.2;margin:20px 0 16px;font-weight:500;letter-spacing:-.035em}.access-intro{font-size:16px;line-height:1.7;color:#a4b5a7;margin:0 0 28px}
.landing-access label{font-size:14px}.landing-access input{font-size:16px;padding:14px}.landing-access .primary{font-size:14px;font-weight:500;min-height:48px;padding:12px 20px}.landing-access .hint{font-size:13px;line-height:1.7;margin-top:20px}
.landing-membership{padding:24px 4px 0}.landing-membership>p:first-child{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 16px}.landing-membership strong{font-size:28px;font-weight:500;white-space:nowrap;color:#e8f1e2}.landing-membership strong span{font-size:14px;color:#9aaf9e;font-weight:400}.membership-via{font-size:12px;color:#8fa594;text-align:right;max-width:140px;line-height:1.7}.landing-membership>p:last-child{font-size:16px;line-height:1.7;color:#9aaf9e;margin:0}
.landing-shell footer{font-size:13px}
@media(max-width:1000px){.landing-columns{grid-template-columns:minmax(0,1fr) 360px;gap:36px}.landing-access .login-card{padding:24px}.focus-list{gap:20px}}
@media(max-width:760px){.shell.landing-shell{padding:24px 20px 28px}.landing-columns{grid-template-columns:1fr;grid-template-areas:"access" "story";padding:24px 0 40px;gap:40px}.landing-story h1{max-width:520px}.landing-lead{max-width:none}.landing-member-link{font-size:14px}.landing-membership{padding:24px 4px 0}.masthead .brand-logo{width:200px}}

@media(max-width:800px){.grid{grid-template-columns:1fr}.hero{padding-top:40px}.card{padding:24px}.login{margin-top:44px}.shell{padding:24px 18px}.login-card{padding:22px}}`;

function layout(content, member = false, landing = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><link rel="icon" href="/brand/inner-circle-app-icon.svg" type="image/svg+xml"><link rel="alternate icon" href="/brand/favicon.png" type="image/png"><link rel="apple-touch-icon" href="/brand/apple-touch-icon.png"><title>Tochukwu's Inner Circle — Member Vault</title><style>${CSS}</style></head><body><div class="shell${landing ? ' landing-shell' : ''}"><header class="masthead"><div class="brand"><img class="brand-logo" src="/brand/inner-circle-logo.svg" alt="Tochukwu’s Inner Circle" width="779" height="256"></div>${member ? '<form action="/logout" method="post"><button class="quiet" type="submit">Sign out</button></form>' : landing ? '<a class="landing-member-link" href="#member-login">Member sign in &rarr;</a>' : '<span class="eyebrow">Members only</span>'}</header><main>${content}</main><footer><span>Made for your next step.</span><span>Private resources · Inner Circle members</span></footer></div></body></html>`;
}

function loginPage(error = '') {
  return layout(`<section class="landing-columns" aria-label="About Tochukwu’s Inner Circle"><aside class="landing-access" aria-label="Membership and vault access"><div class="login-card" id="member-login"><div class="eyebrow">Already in the Inner Circle?</div><h2>Open your member vault.</h2><p class="access-intro">Your Excel calculators, planners, HR email templates, and anti-scam audits are inside.</p>${error ? `<p class="error" id="login-error" role="alert">${escapeHtml(error)}</p>` : ''}<form action="/login" method="post"><label for="email">Facebook account email address</label><input id="email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="Email tied to your Facebook account" required maxlength="254"><label for="passcode">Monthly access code</label><input id="passcode" name="passcode" type="password" autocomplete="current-password" placeholder="Enter this month’s code" required maxlength="512"${error ? ' aria-invalid="true" aria-describedby="login-error"' : ''}><button class="primary" type="submit">Unlock the vault &rarr;</button></form><p class="hint">Use the email address tied to your Facebook account, even if you normally use a different email. Find the monthly code in the pinned group post. New subscriptions are added to the vault each evening.</p></div><section class="landing-membership" aria-label="Join the membership"><p><strong>$4.99<span>/month</span></strong><span class="membership-via">Through Facebook Subscriptions</span></p><p>New here? Subscribe to Tochukwu’s Inner Circle on Facebook and join the private group for candid discussions, Q&amp;A, and accountability. The vault is included.</p></section></aside><div class="landing-story"><div class="eyebrow">For Africans in the UK &amp; preparing to move</div><h1>Build your UK life.<br><span>Avoid costly mistakes.</span></h1><p class="landing-lead">Tochukwu’s Inner Circle is a private community and resource vault for the decisions that affect your work, money, family, and future. Candid conversations. Practical tools. A clearer next step.</p><section class="landing-focus" aria-labelledby="focus-title"><h2 id="focus-title">The conversations that matter. The tools to act.</h2><ul class="focus-list"><li><strong>Work &amp; your CoS</strong><span>Workplace politics, paper trails, and employment protection.</span></li><li><strong>Money &amp; burnout</strong><span>Shift maths, remittance boundaries, and a plan beyond overtime.</span></li><li><strong>Business &amp; importing</strong><span>Lean UK brands, real buyer demand, and landed margins.</span></li><li><strong>Family &amp; relationships</strong><span>Long-distance life, reunification budgets, and starting together again.</span></li><li><strong>Relocation &amp; cultural reality</strong><span>Readiness checks, sponsorship scams, and the realities of starting over.</span></li></ul></section></div></section>`, false, true);
}

async function privateVaultJson(env, request, key) {
  if (localPreview(request, env)) {
    if (!/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID || '') || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) throw new Error('Local R2 credentials missing');
    const client = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
    const result = await client.fetch(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/inner-circle-vault/${key}`);
    if (result.status === 404) return null;
    if (!result.ok) throw new Error('Private vault configuration unavailable');
    return result.json();
  }
  if (!env.VAULT_BUCKET) throw new Error('Private vault binding missing');
  const object = await env.VAULT_BUCKET.get(key);
  return object ? object.json() : null;
}

async function configuredPasscode(env, request) {
  if (env.VAULT_MANAGED_ACCESS === 'true') {
    const record = await privateVaultJson(env, request, VAULT_ACCESS_KEY);
    // Bootstrap compatibility only. Once activated, the R2 record is authoritative.
    // A corrupt/unavailable record must never fall back to an old code.
    if (record !== null) return parseVaultAccess(record).code;
  }
  return env.VAULT_PASSCODE;
}

async function publishedTemplates(env, request) {
  if (!localPreview(request, env) && !env.VAULT_BUCKET) return TEMPLATES;
  const catalog = await privateVaultJson(env, request, VAULT_CATALOG_KEY);
  return catalog ? parseVaultCatalog(catalog).templates.filter(item => item.published) : [];
}

const ICONS = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  library: '<path d="M4 6h6l2 2h8v12H4z"/><path d="M4 6V4h7l2 2h7v2"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  exit: '<path d="M9 4H4v16h5m5-13 5 5-5 5m-5-5h10"/>',
};
const icon = (name) => `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.file}</svg>`;
const resourceUrl = (params = {}) => '/?' + new URLSearchParams({ view: 'library', ...params }).toString();
const DASHBOARD_CSS = `
.workspace{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100svh;background:#101512}.sidebar{position:sticky;top:0;height:100svh;display:flex;flex-direction:column;border-right:1px solid #ffffff12;background:#141b17;padding:30px 20px}.workspace a{text-decoration:none}.sidebar .brand{padding:0 6px 34px;align-items:center}.brand-name{font-size:14px;line-height:1.5}.brand-name small{display:block;font-size:11px;font-weight:450;color:#8d9d92}.nav-label{font-size:10px;letter-spacing:.17em;font-weight:650;color:#83958a;margin:22px 12px 12px}.side-nav{display:grid;gap:5px}.nav-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;color:#9eafa3;font-size:13px}.nav-item:hover{background:#ffffff07;color:#eef3ed}.nav-item.active{background:#c1ec8e14;color:#c1ec8e;box-shadow:inset 2px 0 #c1ec8e}.nav-item .count{margin-left:auto;font-size:11px;color:#a5b8ab}.category-dot{width:6px;height:6px;border-radius:50%;background:#869c77}.sidebar-note{margin:0 12px;color:#7f9286;font-size:12px;line-height:1.7}.side-bottom{margin-top:auto;padding-top:32px}.access-note{padding:16px;border:1px solid #ffffff15;border-radius:10px;background:#1b251d}.access-note>span{display:flex;gap:8px;align-items:center;color:#c1ec8e;font-size:12px;font-weight:600}.access-note p{font-size:11px;color:#9aaa9e;line-height:1.7;margin:10px 0}.access-note a{font-size:11px;color:#dbe7d4}.workspace-main{min-width:0}.topbar{height:84px;border-bottom:1px solid #ffffff12;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 40px}.breadcrumb{display:flex;align-items:center;gap:12px;font-size:12px;color:#8c9f92}.breadcrumb strong{color:#dce6de;font-weight:500}.member-tools{display:flex;align-items:center;gap:20px}.member-badge{display:flex;align-items:center;gap:7px;font-size:11px;color:#c5d5c6}.member-badge:before{content:'';width:6px;height:6px;background:#b6dc8a;border-radius:50%}.logout-button{display:flex;align-items:center;gap:8px;border:0;background:transparent;color:#9bae9f;font-size:12px;padding:8px;cursor:pointer}.logout-button:hover{color:#fff}.workspace-content{max-width:1400px;margin:0 auto;padding:38px 40px 24px}.page-heading{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:30px}.page-heading h1{font-size:30px;letter-spacing:-.035em;margin:8px 0 10px;font-weight:600}.page-heading p{font-size:13px;color:#91a597;margin:0}.page-heading .eyebrow{font-size:10px}.subtle-link{display:inline-flex;gap:8px;align-items:center;color:#c1ec8e;font-size:12px;white-space:nowrap}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:30px}.stat{border:1px solid #ffffff12;border-radius:12px;background:#19211b;padding:20px}.stat-top{display:flex;justify-content:space-between;align-items:center;color:#8fa995;font-size:12px}.stat-top svg{color:#718d77;width:18px}.stat strong{display:block;font-size:29px;line-height:1.2;font-weight:550;letter-spacing:-.04em;color:#eff5ec;margin-top:17px}.stat small{display:block;color:#7f9485;font-size:11px;margin-top:8px}.dashboard-columns{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:24px;align-items:start}.panel{border:1px solid #ffffff12;border-radius:12px;background:#161e19;overflow:hidden}.panel-heading{padding:22px 24px;display:flex;gap:12px;justify-content:space-between;align-items:center;border-bottom:1px solid #ffffff10}.panel-heading h2{font-size:15px;font-weight:600;margin:0;letter-spacing:-.015em}.panel-heading p{font-size:11px;color:#819989;margin:7px 0 0}.panel-heading .result-count{font-size:11px;color:#a0b29f}.filters{display:flex;gap:12px;padding:18px 24px;border-bottom:1px solid #ffffff10;flex-wrap:wrap}.search-field{display:flex;flex:1;align-items:center;gap:10px;min-width:180px;background:#101713;border:1px solid #ffffff18;border-radius:7px;padding:0 12px;color:#7d9283}.search-field input{margin:0;padding:11px 0;background:transparent;border:0;font-size:12px;outline-offset:2px}.filters select{color:#b7c8ba;background:#101713;border:1px solid #ffffff18;border-radius:7px;padding:10px;font:inherit;font-size:11px;max-width:100%}.filter-submit{background:#c1ec8e;color:#172013;border:0;border-radius:7px;padding:10px 15px;font-size:12px;font-weight:650;cursor:pointer}.filter-submit:hover{background:#d1f7a5}.list-labels{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;background:#ffffff02;border-bottom:1px solid #ffffff0d;font-size:9px;color:#82988a;font-weight:650;letter-spacing:.12em;text-transform:uppercase}.resource-list{display:grid}.resource-row{display:flex;align-items:center;gap:16px;padding:23px 24px;border-bottom:1px solid #ffffff0c}.resource-row:last-child{border-bottom:0}.file-icon{height:46px;width:42px;flex-shrink:0;display:grid;place-items:center;background:#c1ec8e0b;border:1px solid #c1ec8e20;border-radius:8px;color:#b6d49d}.file-icon.pdf{color:#deb89f;background:#cdaa8c0b;border-color:#cdaa8c22}.resource-copy{flex:1;min-width:0}.resource-copy h3{font-size:13px;line-height:1.5;font-weight:550;color:#e6eee4;margin:0 0 6px;letter-spacing:-.01em}.resource-copy p{font-size:11px;color:#8da394;line-height:1.7;margin:0;max-width:660px}.resource-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:9px;color:#9fb397;margin-top:10px}.resource-meta .type-label{border:1px solid #ffffff1a;border-radius:4px;padding:2px 5px;font-size:8px;color:#c2d0c1;letter-spacing:.06em}.download-action{display:flex;align-items:center;justify-content:center;gap:8px;flex-shrink:0;border:1px solid #c1ec8e30;color:#c1ec8e;border-radius:7px;padding:10px 12px;font-size:11px;font-weight:550}.download-action:hover{background:#c1ec8e13}.download-action svg{width:15px;height:15px}.library-bottom{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px 24px;border-top:1px solid #ffffff10;color:#82988a;font-size:10px}.side-panels{display:grid;gap:18px}.guide-card{background:linear-gradient(140deg,#293d2b,#1b2b20);border:1px solid #bddc8a23;border-radius:12px;padding:24px}.guide-card>.guide-icon{display:flex;color:#c1ec8e;margin-bottom:24px}.guide-card h2{font-size:18px;line-height:1.35;margin:0 0 12px;font-weight:550}.guide-card p{color:#a3b7a5;font-size:12px;line-height:1.8;margin:0 0 24px}.guide-card a{font-size:11px;display:flex;align-items:center;justify-content:space-between;color:#d1edb3;border-top:1px solid #ffffff18;padding-top:16px}.steps-card{padding:22px;background:#161e19;border:1px solid #ffffff12;border-radius:12px}.steps-card h2{font-size:13px;margin:0 0 20px;font-weight:550}.steps-card ol{list-style:none;counter-reset:steps;padding:0;margin:0;display:grid;gap:18px}.steps-card li{counter-increment:steps;display:flex;gap:10px;font-size:11px;line-height:1.65;color:#8fa695}.steps-card li:before{content:counter(steps);flex-shrink:0;width:20px;height:20px;border:1px solid #ffffff19;border-radius:50%;display:grid;place-items:center;color:#c4d4bb;font-size:9px}.steps-card li strong{display:block;color:#ccd9c8;font-weight:500}.library-empty{display:grid;place-items:center;text-align:center;padding:64px 28px;min-height:300px}.empty-icon{display:grid;place-items:center;width:56px;height:56px;border:1px solid #c1ec8e23;border-radius:14px;color:#a8c794;background:#c1ec8e08;margin-bottom:20px}.empty-icon svg{width:26px;height:26px}.library-empty h3{font-size:17px;color:#dfe9da;margin:0 0 10px;font-weight:550}.library-empty p{font-size:12px;line-height:1.8;color:#8ba08d;max-width:330px;margin:0 0 18px}.dashboard-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:10px;color:#728a78;padding:28px 0 4px}.dashboard-footer>span{display:flex;gap:6px;align-items:center}.dashboard-footer svg{width:12px;height:12px}.help-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.help-card{padding:28px}.help-card h2{font-size:17px;margin:0 0 14px;font-weight:550}.help-card p{color:#96ab9a;font-size:13px;margin:0;line-height:1.9}.help-card .eyebrow{display:block;margin-bottom:16px}.skip-link{position:absolute;left:260px;top:-60px;background:#c1ec8e;color:#172013;padding:12px;z-index:10}.skip-link:focus{top:10px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(min-width:1500px){.workspace-content{padding-top:44px}.resource-row{padding-top:28px;padding-bottom:28px}}
@media(max-width:1100px){.workspace{grid-template-columns:210px minmax(0,1fr)}.sidebar{padding:26px 14px}.topbar{padding:0 26px}.workspace-content{padding:30px 26px 22px}.dashboard-columns{grid-template-columns:minmax(0,1fr)}.side-panels{grid-template-columns:1fr 1fr}.guide-card>.guide-icon{margin-bottom:15px}.guide-card h2{font-size:17px}}
@media(max-width:700px){.workspace{display:block}.sidebar{position:static;height:auto;padding:18px 18px 12px;border-right:0;border-bottom:1px solid #ffffff12}.sidebar .brand{padding:0 0 18px}.side-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.nav-item{flex-direction:column;justify-content:center;text-align:center;padding:10px 4px;font-size:11px;gap:6px}.nav-item .count{display:none}.nav-item.active{box-shadow:inset 0 -2px #c1ec8e}.nav-item svg{height:16px;width:16px}.sidebar .nav-label,.category-nav,.side-bottom{display:none}.topbar{height:61px;padding:0 20px}.breadcrumb{font-size:10px;gap:8px;white-space:nowrap}.breadcrumb>span{display:none}.member-tools{gap:12px;flex-shrink:0}.member-badge{font-size:10px}.logout-button{font-size:10px;white-space:nowrap}.logout-button svg{width:15px}.workspace-content{padding:28px 18px 18px}.page-heading{align-items:flex-start;gap:12px;margin-bottom:24px}.page-heading h1{font-size:26px}.page-heading p{font-size:12px;line-height:1.7}.page-heading>.subtle-link{display:none}.stats{gap:8px;margin-bottom:22px}.stat{padding:14px 12px}.stat-top{font-size:10px}.stat-top svg{display:none}.stat strong{font-size:25px;margin-top:14px}.stat small{font-size:9px;line-height:1.6}.dashboard-columns{gap:20px}.panel-heading{padding:18px}.filters{padding:14px;gap:8px}.search-field{flex-basis:100%;min-width:0}.filters select{flex:1;min-width:0}.list-labels{padding:12px 18px}.resource-row{padding:20px 16px;gap:12px;align-items:flex-start;flex-wrap:wrap}.file-icon{width:34px;height:40px}.resource-copy{width:calc(100% - 50px)}.resource-copy h3{font-size:13px}.download-action{margin-left:46px;font-size:11px}.resource-copy p{font-size:11px}.library-bottom{padding:14px 18px;line-height:1.7;flex-wrap:wrap}.side-panels,.help-grid{grid-template-columns:1fr}.steps-card{padding:22px}.library-empty{padding:45px 20px;min-height:280px}.dashboard-footer{font-size:9px;align-items:flex-start;line-height:1.8}.skip-link{left:20px}.help-card{padding:24px}}
`;

function dashboard(templates, url) {
  const view = ['overview', 'library', 'help'].includes(url.searchParams.get('view')) ? url.searchParams.get('view') : 'overview';
  const query = (url.searchParams.get('q') || '').trim().slice(0, 200);
  const category = (url.searchParams.get('category') || '').slice(0, 80);
  const sort = url.searchParams.get('sort') === 'title' ? 'title' : 'default';
  const categories = [...new Set(templates.map(item => item.category))].sort((a, b) => a.localeCompare(b));
  const formats = new Set(templates.map(item => item.file.split('.').pop().toLowerCase()));
  const filtered = templates.filter(item => (!category || item.category === category) && (!query || `${item.title} ${item.desc} ${item.category}`.toLowerCase().includes(query.toLowerCase())));
  if (sort === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));
  const viewName = view === 'help' ? 'Help & access' : view === 'library' ? 'Resource library' : 'Overview';
  const nav = [['overview', 'Overview', 'overview'], ['library', 'Resource library', 'library'], ['help', 'Help & access', 'help']].map(([key, name, glyph]) => `<a class="nav-item${view === key ? ' active' : ''}" href="/?view=${key}"${view === key ? ' aria-current="page"' : ''}>${icon(glyph)}<span>${name}</span>${key === 'library' ? `<span class="count">${templates.length}</span>` : ''}</a>`).join('');
  const stats = `<section class="stats" aria-label="Library overview"><article class="stat"><div class="stat-top"><span>Resources available</span>${icon('file')}</div><strong>${templates.length}</strong><small>Ready for you to download</small></article><article class="stat"><div class="stat-top"><span>Categories</span>${icon('library')}</div><strong>${categories.length}</strong><small>For life, work & business</small></article><article class="stat"><div class="stat-top"><span>File formats</span>${icon('download')}</div><strong>${formats.size}</strong><small>${formats.size ? [...formats].map(type => escapeHtml(type.toUpperCase())).join(' · ') : 'PDFs, workbooks & more'}</small></article></section>`;
  const guide = `<aside class="side-panels" aria-label="Member guidance"><section class="guide-card"><span class="guide-icon">${icon('lock')}</span><div class="eyebrow">A little more prepared</div><h2 style="margin-top:12px">Tools for your<br>next chapter.</h2><p>Your membership brings practical resources together in one place. Find what you need, then make it your own.</p><a href="/?view=help">Make the most of your vault ${icon('arrow')}</a></section><section class="steps-card"><h2>From download to done</h2><ol><li><span><strong>Find your resource</strong>Browse a category or search the library.</span></li><li><span><strong>Save your own copy</strong>Download the file to your device.</span></li><li><span><strong>Put it to work</strong>Open it in a compatible app and adapt it to your plans.</span></li></ol></section></aside>`;
  const rows = filtered.map(item => {
    const type = item.file.split('.').pop().toUpperCase();
    return `<article class="resource-row"><span class="file-icon${type === 'PDF' ? ' pdf' : ''}">${icon('file')}</span><div class="resource-copy"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.desc)}</p><div class="resource-meta"><span>${escapeHtml(item.category)}</span><span aria-hidden="true">·</span><span class="type-label">${escapeHtml(type)}</span></div></div><a class="download-action" href="/download/${encodeURIComponent(item.id)}" aria-label="Download ${escapeHtml(item.title)}">${icon('download')}<span>Download</span></a></article>`;
  }).join('');
  const empty = templates.length ? `<div class="library-empty"><span class="empty-icon">${icon('search')}</span><h3>No matching resources</h3><p>Try a different search or category to find what you need.</p><a class="subtle-link" href="${resourceUrl()}">Clear filters ${icon('arrow')}</a></div>` : `<div class="library-empty"><span class="empty-icon">${icon('library')}</span><h3>Your library is taking shape.</h3><p>Your member resources are being prepared. Check back soon, or look out for updates in the Inner Circle Facebook Group.</p><a class="subtle-link" href="/?view=help">About your member access ${icon('arrow')}</a></div>`;
  const library = `<section class="panel" aria-labelledby="library-title"><div class="panel-heading"><div><h2 id="library-title">${view === 'overview' ? 'Your member library' : 'All resources'}</h2><p>Practical templates. Ready when you are.</p></div><span class="result-count">${filtered.length} ${filtered.length === 1 ? 'resource' : 'resources'}</span></div><form class="filters" action="/" method="get" role="search"><input type="hidden" name="view" value="library"><label class="search-field"><span class="sr-only">Search resources</span>${icon('search')}<input type="search" name="q" placeholder="Search your resources…" value="${escapeHtml(query)}" maxlength="200"></label><label class="sr-only" for="category">Filter by category</label><select id="category" name="category"><option value="">All categories</option>${categories.map(name => `<option value="${escapeHtml(name)}"${category === name ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select><label class="sr-only" for="sort">Sort resources</label><select id="sort" name="sort"><option value="default"${sort === 'default' ? ' selected' : ''}>Library order</option><option value="title"${sort === 'title' ? ' selected' : ''}>Title: A–Z</option></select><button class="filter-submit" type="submit">Search</button></form>${filtered.length ? '<div class="list-labels" aria-hidden="true"><span>Resource</span><span>Get your copy</span></div>' : ''}<div class="resource-list" aria-label="Downloadable templates">${rows || empty}</div><div class="library-bottom"><span>${templates.length ? `Showing ${filtered.length} of ${templates.length} resources` : 'New resources appear here when published'}</span><span>Included with your Inner Circle access</span></div></section>`;
  const help = `<section class="help-grid" aria-label="Help and access"><article class="panel help-card"><span class="eyebrow">01 / Monthly access</span><h2>Your email and code open the vault</h2><p>Sign in with the email address tied to your Facebook account and the current monthly access code in the pinned post in the private Inner Circle Facebook Group. When the code changes, sign in with the new one to keep using your library.</p></article><article class="panel help-card"><span class="eyebrow">02 / Downloading</span><h2>A copy you can make your own</h2><p>Choose Download beside a resource to save it to your device. Open spreadsheets in Excel or a compatible app, and PDF documents in your preferred PDF reader. On mobile, check your Files or Downloads folder.</p></article><article class="panel help-card"><span class="eyebrow">03 / Your library</span><h2>Find the right starting point</h2><p>Search by a title, topic, or description. Use the category filter to narrow the library, or sort by title. Resources appear as they are published, so check back for new additions.</p></article><article class="panel help-card"><span class="eyebrow">04 / Need a hand?</span><h2>Bring it to the group</h2><p>If you have trouble opening a file or finding the current code, ask in the Inner Circle Facebook Group. Include the resource title and the app or device you’re using so we can help.</p></article></section>`;
  const content = `<div class="page-heading"><div><div class="eyebrow">Your Inner Circle workspace</div><h1>${view === 'overview' ? 'Welcome to your vault.' : viewName}</h1><p>${view === 'help' ? 'Everything you need to access and use your member resources.' : view === 'library' ? 'Find a useful starting point. Make it your own.' : 'Your resources for life, work, and business, all in one place.'}</p></div>${view === 'overview' ? `<a class="subtle-link" href="${resourceUrl()}">Browse the library ${icon('arrow')}</a>` : ''}</div>${view === 'help' ? help : `${view === 'overview' ? stats : ''}<div class="${view === 'overview' ? 'dashboard-columns' : 'library-full'}">${library}${view === 'overview' ? guide : ''}</div>`}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><link rel="icon" href="/brand/inner-circle-app-icon.svg" type="image/svg+xml"><link rel="alternate icon" href="/brand/favicon.png" type="image/png"><link rel="apple-touch-icon" href="/brand/apple-touch-icon.png"><title>${viewName} — Inner Circle Vault</title><style>${CSS}${DASHBOARD_CSS}</style></head><body><a class="skip-link" href="#main-content">Skip to content</a><div class="workspace"><aside class="sidebar" aria-label="Member navigation"><a class="brand" href="/"><img class="brand-logo" src="/brand/inner-circle-logo.svg" alt="Tochukwu’s Inner Circle" width="779" height="256"></a><div class="nav-label">WORKSPACE</div><nav class="side-nav" aria-label="Main navigation">${nav}</nav><div class="category-nav"><div class="nav-label">YOUR CATEGORIES</div>${categories.length ? categories.map(name => `<a class="nav-item${category === name && view === 'library' ? ' active' : ''}" href="${escapeHtml(resourceUrl({ category: name }))}"><span class="category-dot" aria-hidden="true"></span><span>${escapeHtml(name)}</span><span class="count">${templates.filter(item => item.category === name).length}</span></a>`).join('') : '<p class="sidebar-note">Categories will appear as resources are added.</p>'}</div><div class="side-bottom"><section class="access-note"><span>${icon('lock')}A space for members</span><p>Sign in with your subscriber email and monthly code. Find the latest code in the group.</p><a href="/?view=help">About your access ↗</a></section></div></aside><div class="workspace-main"><header class="topbar"><div class="breadcrumb"><span>Member vault</span><span aria-hidden="true">/</span><strong>${viewName}</strong></div><div class="member-tools"><span class="member-badge">Member access</span><form action="/logout" method="post"><button class="logout-button" type="submit">${icon('exit')}Sign out</button></form></div></header><main id="main-content" class="workspace-content">${content}<div class="dashboard-footer"><span>${icon('lock')}Private resources · Inner Circle members</span><span>Made for your next step.</span></div></main></div></div></body></html>`;
}

async function handle(request, env) {
  const url = new URL(request.url);
  if (request.method === 'POST') {
    const origin = request.headers.get('Origin');
    const site = request.headers.get('Sec-Fetch-Site');
    // Safari may omit the origin under no-referrer. Sec-Fetch-Site is set by
    // the browser, so only an explicit same-origin context permits null here.
    const safariSameOrigin = origin === 'null' && site === 'same-origin';
    if ((origin && origin !== url.origin && !safariSameOrigin) || site === 'cross-site') {
      return response('Forbidden', 403);
    }
  }
  if (url.pathname === '/logout') {
    if (request.method !== 'POST') return response('Method not allowed', 405, { Allow: 'POST' });
    return redirect('/', `vault_auth=; ${cookieFlags(request, env)}; Max-Age=0`);
  }
  const activePasscode = await configuredPasscode(env, request);
  if (typeof activePasscode !== 'string' || !activePasscode.trim() || activePasscode !== activePasscode.trim() || activePasscode.length > 512) {
    return html(layout('<section class="login"><h1>We’ll be right back.</h1><p class="muted">The member vault is being prepared. Please try again shortly.</p></section>'), 503);
  }
  if (url.pathname === '/') {
    if (request.method !== 'GET') return response('Method not allowed', 405, { Allow: 'GET' });
    return html(await authenticated(request, env, activePasscode) ? dashboard(await publishedTemplates(env, request), url) : loginPage());
  }
  if (url.pathname === '/login') {
    if (request.method !== 'POST') return response('Method not allowed', 405, { Allow: 'POST' });
    const type = request.headers.get('Content-Type') || '';
    if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(type) && !/^multipart\/form-data(?:;|$)/i.test(type)) return response('Expected a form submission', 415);
    // Bound the body while streaming, including clients without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return response('Invalid form submission', 400);
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return response('Form too large', 413); }
      chunks.push(value);
    }
    let form;
    try {
      form = await new Response(new Blob(chunks), { headers: { 'Content-Type': type } }).formData();
    } catch {
      return response('Invalid form submission', 400);
    }
    const passcode = form.get('passcode');
    const email = normalizeSubscriberEmail(form.get('email'));
    if (typeof passcode === 'string' && passcode.trim() === activePasscode) {
      if (email && (await subscriberEmails(env, request)).includes(email)) {
        const token = await createMemberSession(email, activePasscode);
        return redirect('/', `vault_auth=${token}; ${cookieFlags(request, env)}; Max-Age=2592000`);
      }
    }
    return html(loginPage('We couldn’t match that email and code. Use the email address tied to your Facebook account and the code in the group’s pinned post. New subscriber? The list is updated each evening; contact us in the group if you still need help.'), 401);
  }
  if (url.pathname.startsWith('/download/')) {
    if (request.method !== 'GET') return response('Method not allowed', 405, { Allow: 'GET' });
    if (!await authenticated(request, env, activePasscode)) return redirect('/');
    const item = (await publishedTemplates(env, request)).find((template) => url.pathname === `/download/${template.id}`);
    if (!item) return response('Template not found', 404);
    if (!/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID || '') || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      return html(layout('<section class="login"><h1>Download unavailable.</h1><p class="muted">Please try again shortly.</p><a href="/">Back to your vault</a></section>', true), 503);
    }
    const client = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
    const objectUrl = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/inner-circle-vault/${item.file.split('/').map(encodeURIComponent).join('/')}`);
    objectUrl.searchParams.set('X-Amz-Expires', '60');
    // All response overrides must be present BEFORE signing.
    objectUrl.searchParams.set('response-content-disposition', `attachment; filename="${item.file.split('/').pop()}"`);
    const signed = await client.sign(objectUrl.toString(), { method: 'GET', aws: { signQuery: true } });
    return redirect(signed.url);
  }
  return response('Not found', 404);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch {
      // Do not log request cookies, passcodes, credentials, or signed URLs.
      return html(layout('<section class="login"><h1>Something went wrong.</h1><p class="muted">Please try again shortly.</p><a href="/">Return to the vault</a></section>'), 500);
    }
  },
};
