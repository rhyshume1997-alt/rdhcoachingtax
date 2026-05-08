import { useState, useRef, useMemo, useCallback, useEffect } from "react";

/* ─── PERSISTENCE ───────────────────────────────────────────────────── */
const STORAGE_KEY = 'rdh_tax_dashboard_v1';
const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const saveState = (state) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.error('Save failed', e); }
};
const exportJSON = (state) => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rdh-tax-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/* ─── DESIGN TOKENS ─────────────────────────────────────────────────── */
const G = {
  bg:    'linear-gradient(135deg, #06060F 0%, #0A0818 50%, #080614 100%)',
  glass: 'rgba(255,255,255,0.04)',
  glassHi: 'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.09)',
  glassBorderHi: 'rgba(255,255,255,0.16)',
  blue:   '#5B7CFA',
  blueGlow: 'rgba(91,124,250,0.25)',
  green:  '#34D399',
  greenGlow: 'rgba(52,211,153,0.2)',
  red:    '#F87171',
  redGlow: 'rgba(248,113,113,0.2)',
  gold:   '#FBBF24',
  goldGlow: 'rgba(251,191,36,0.2)',
  purple: '#C084FC',
  purpleGlow: 'rgba(192,132,252,0.2)',
  teal:   '#22D3EE',
  text:   '#F1F1F5',
  textDim:'#9494A8',
  muted:  '#55556A',
};

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_NUM = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const glass = (extra = {}) => ({
  background: G.glass,
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${G.glassBorder}`,
  borderRadius: 16,
  ...extra,
});

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '255,255,255';
}

const pill = (color) => ({
  background: `rgba(${hexToRgb(color)},0.15)`,
  border: `1px solid rgba(${hexToRgb(color)},0.3)`,
  color,
  borderRadius: 999,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.15s',
  fontFamily: FONT,
  whiteSpace: 'nowrap',
});

/* ─── EXPENSE SUBCATEGORIES ──────────────────────────────────────────── */
const EXPENSE_CATS = [
  { id:'software',       label:'Software & Subscriptions', note:'Canva, CapCut, Loom, Kahunas, Notion, ClickUp',           pct:false },
  { id:'marketing',      label:'Marketing & Ads',          note:'Meta ads, Instagram boosts, TikTok promotions',           pct:false },
  { id:'website',        label:'Website & Hosting',        note:'Vercel, Namecheap, Mailchimp, Formspree',                 pct:false },
  { id:'paymentfees',    label:'Payment Processing Fees',  note:'Stripe fees, GoCardless, PayPal fees, card processing',   pct:false },
  { id:'bankfees',       label:'Bank Charges & Fees',      note:'Business account fees, transfer fees, FX charges',        pct:false },
  { id:'equipment',      label:'Equipment',                note:'Camera, mic, ring light, laptop, gym gear for content',   pct:false },
  { id:'cpd',            label:'Professional Development', note:'Courses, certifications, books, mentorship',              pct:false },
  { id:'phone',          label:'Phone Bill',               note:'Business % of mobile bill',                               pct:true,  defaultPct:60 },
  { id:'internet',       label:'Internet / Broadband',     note:'Business % of broadband',                                 pct:true,  defaultPct:50 },
  { id:'homeoffice',     label:'Home Office',              note:'Council tax, utilities, rent — business %',               pct:true,  defaultPct:20 },
  { id:'car',            label:'Car & Mileage',            note:'45p/mile first 10k, 25p after — track in Deductions',     pct:false },
  { id:'travel',         label:'Travel (Public Transport)', note:'Train, bus, taxi for business journeys',                 pct:false },
  { id:'parking',        label:'Parking',                  note:'Business parking — not at regular workplace',             pct:false },
  { id:'profees',        label:'Professional Fees',        note:'Accountant, bookkeeper, legal advice',                    pct:false },
  { id:'insurance',      label:'Business Insurance',       note:'PI insurance, public liability cover',                    pct:false },
  { id:'memberships',    label:'Memberships',              note:'REPs, CIMSPA, industry bodies',                           pct:false },
  { id:'stationery',     label:'Stationery & Printing',    note:'Postage, printing, office supplies',                      pct:false },
  { id:'other',          label:'Other Business Cost',      note:'Any other wholly business expense',                       pct:false },
];

/* ─── HELPERS ────────────────────────────────────────────────────────── */
const fmt = (n, sign = false) => {
  const abs = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (sign && n > 0) return '+£' + abs;
  return (n < 0 ? '-' : '') + '£' + abs;
};
const pct = (n, total) => total ? Math.round((n / total) * 100) : 0;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const monthLabel = k => {
  if (!k || k === 'Unknown') return 'Unknown';
  const [y, m] = k.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
};
const toMonthKey = d => {
  const dt = new Date(d);
  return isNaN(dt) ? 'Unknown' : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
};

const parseCSV = (text, bank) => {
  const lines = text.trim().split('\n'); if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  const get = (row, keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k]; return ''; };
  const toAmt = s => { if (!s) return 0; const n = parseFloat(String(s).replace(/[£,$\s]/g,'')); return isNaN(n) ? 0 : n; };
  return lines.slice(1).filter(l => l.trim()).map((line, idx) => {
    const vals = []; let cur = '', inQ = false;
    for (const ch of line) { if (ch === '"') inQ = !inQ; else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; } else cur += ch; }
    vals.push(cur);
    const row = {}; headers.forEach((h, i) => row[h] = (vals[i] || '').replace(/"/g,'').trim());
    let date = '', desc = '', amount = 0;
    if (bank === 'monzo') { date=get(row,['date']); desc=get(row,['name','description','merchant name']); amount=toAmt(get(row,['amount'])); }
    else if (bank === 'starling') { date=get(row,['date']); desc=get(row,['counter party','reference','description']); amount=toAmt(get(row,['amount (gbp)','amount'])); }
    else if (bank === 'rbs') { date=get(row,['date','transaction date']); desc=get(row,['description','merchant name','reference']); const cr=toAmt(get(row,['credit amount','credit'])),db=toAmt(get(row,['debit amount','debit'])); amount=cr>0?cr:db>0?-db:toAmt(get(row,['amount'])); }
    else if (bank === 'amex') { date=get(row,['date','transaction date']); desc=get(row,['description','merchant']); amount=-toAmt(get(row,['amount'])); }
    if (!desc || amount === 0) return null;
    return { id:`${bank}-${idx}-${Date.now()}-${Math.random()}`, date, description:desc, amount, bank, status:'pending', subcat:null, claimPct:100, claimable:0, note:'' };
  }).filter(Boolean);
};

/* ─── SUBCOMPONENTS ──────────────────────────────────────────────────── */
const GlassCard = ({ children, style = {}, glow, onClick }) => (
  <div onClick={onClick} style={{ ...glass(), boxShadow: glow ? `0 8px 40px ${glow}` : '0 4px 24px rgba(0,0,0,0.4)', cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s, box-shadow 0.15s', ...style }}
    onMouseEnter={onClick ? e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 12px 48px ${glow || 'rgba(0,0,0,0.5)'}`; } : undefined}
    onMouseLeave={onClick ? e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = glow ? `0 8px 40px ${glow}` : '0 4px 24px rgba(0,0,0,0.4)'; } : undefined}>
    {children}
  </div>
);

const StatTile = ({ label, value, color, sub, glow, onClick, badge }) => (
  <GlassCard glow={glow} onClick={onClick} style={{ padding: '20px 22px', position: 'relative' }}>
    {badge && <div style={{ position: 'absolute', top: 14, right: 14, background: `rgba(${hexToRgb(color || G.blue)},0.2)`, color: color || G.blue, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>{badge}</div>}
    <div style={{ fontSize: 11, color: G.muted, fontWeight: 500, marginBottom: 10, letterSpacing: '0.02em' }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color || G.text, letterSpacing: '-0.02em', fontFamily: FONT_NUM, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: G.textDim, marginTop: 6 }}>{sub}</div>}
    {onClick && <div style={{ position: 'absolute', bottom: 14, right: 16, fontSize: 12, color: G.muted }}>→</div>}
  </GlassCard>
);

const PctBar = ({ label, value, total, color, count }) => {
  const p = pct(value, total);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: G.text, fontWeight: 500 }}>{label}{count !== undefined && <span style={{ color: G.muted, marginLeft: 6, fontSize: 11 }}>({count})</span>}</span>
        <span style={{ fontSize: 13, color, fontFamily: FONT_NUM, fontWeight: 600 }}>{fmt(value)} <span style={{ color: G.muted, fontWeight: 400 }}>({p}%)</span></span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
};

/* ─── MILEAGE TRACKER ────────────────────────────────────────────────── */
const MileageTracker = ({ miles, setMiles }) => {
  const claimable = miles <= 10000 ? miles * 0.45 : (10000 * 0.45) + ((miles - 10000) * 0.25);
  return (
    <GlassCard style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 11, color: G.muted, fontWeight: 500, marginBottom: 14, letterSpacing: '0.02em' }}>CAR & MILEAGE LOG</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <input type="number" value={miles} onChange={e => setMiles(Number(e.target.value))}
          style={{ width: 130, background: 'rgba(255,255,255,0.06)', border: `1px solid ${G.glassBorderHi}`, borderRadius: 10, color: G.text, padding: '11px 16px', fontSize: 18, fontWeight: 600, fontFamily: FONT_NUM, outline: 'none' }} />
        <span style={{ fontSize: 13, color: G.textDim }}>business miles this year</span>
      </div>
      <div style={{ fontSize: 14, color: G.textDim, lineHeight: 1.6 }}>
        <span style={{ color: G.gold, fontWeight: 700, fontSize: 22, fontFamily: FONT_NUM }}>{fmt(claimable)}</span>
        <span style={{ marginLeft: 10, color: G.textDim, fontSize: 13 }}>claimable at HMRC rate</span>
      </div>
      <div style={{ fontSize: 12, color: G.muted, marginTop: 10, lineHeight: 1.5 }}>45p/mile first 10,000 miles · 25p/mile after · keep a written log of every business journey</div>
    </GlassCard>
  );
};

/* ─── HOME OFFICE CALCULATOR ─────────────────────────────────────────── */
const HomeOfficeCalc = ({ homeData, setHomeData }) => {
  const items = [
    { key: 'councilTax', label: 'Council Tax (annual)' },
    { key: 'electricity', label: 'Electricity (annual)' },
    { key: 'gas', label: 'Gas (annual)' },
    { key: 'broadband', label: 'Broadband (annual)' },
    { key: 'rent', label: 'Rent / Mortgage interest (annual)' },
  ];
  const totalBills = items.reduce((s, i) => s + (homeData[i.key] || 0), 0);
  const claimable = (totalBills * (homeData.roomPct || 20)) / 100;
  return (
    <GlassCard style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 11, color: G.muted, fontWeight: 500, marginBottom: 14, letterSpacing: '0.02em' }}>HOME OFFICE CALCULATOR</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
        <span style={{ fontSize: 12, color: G.textDim }}>Business use of home</span>
        <input type="range" min="5" max="60" value={homeData.roomPct || 20} onChange={e => setHomeData(d => ({ ...d, roomPct: Number(e.target.value) }))}
          style={{ flex: 1, accentColor: G.blue }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: G.blue, fontFamily: FONT_NUM, minWidth: 46, textAlign: 'right' }}>{homeData.roomPct || 20}%</span>
      </div>
      {items.map(({ key, label }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12 }}>
          <span style={{ fontSize: 12, color: G.textDim, flex: 1 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: G.muted }}>£</span>
            <input type="number" value={homeData[key] || ''} onChange={e => setHomeData(d => ({ ...d, [key]: Number(e.target.value) }))}
              placeholder="0"
              style={{ width: 100, background: 'rgba(255,255,255,0.05)', border: `1px solid ${G.glassBorder}`, borderRadius: 8, color: G.text, padding: '7px 10px', fontSize: 13, fontFamily: FONT_NUM, outline: 'none', textAlign: 'right' }} />
          </div>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${G.glassBorder}`, marginTop: 14, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: G.textDim }}>Claimable ({homeData.roomPct || 20}% of {fmt(totalBills)})</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: G.green, fontFamily: FONT_NUM }}>{fmt(claimable)}</span>
      </div>
      <div style={{ fontSize: 12, color: G.muted, marginTop: 8 }}>Council tax proportion fully HMRC-allowable for home-based business</div>
    </GlassCard>
  );
};

/* ─── TRANSACTION CARD ───────────────────────────────────────────────── */
const TCard = ({ t, onStatus, onSubcat, onPct, onNote, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [showNote, setShowNote] = useState(!!t.note);
  const cat = EXPENSE_CATS.find(c => c.id === t.subcat);
  const statusColor = t.status === 'income' ? G.green : t.status === 'expense' ? G.blue : t.status === 'personal' ? G.muted : G.gold;
  const isPending = t.status === 'pending';

  return (
    <div style={{
      borderBottom: `1px solid ${G.glassBorder}`,
      background: isPending ? `rgba(${hexToRgb(G.gold)},0.04)` : 'transparent',
      borderLeft: isPending ? `3px solid ${G.gold}` : `3px solid ${statusColor}`,
      transition: 'background 0.15s',
    }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, color: G.text, fontWeight: 500, lineHeight: 1.3 }}>{t.description}</div>
          <div style={{ fontSize: 11, color: G.muted, marginTop: 4 }}>
            {t.date} · {t.bank.toUpperCase()}
            {cat && <span style={{ color: G.blue }}> · {cat.label}{cat.pct ? ` (${t.claimPct}%)` : ''}</span>}
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.amount >= 0 ? G.green : G.red, fontFamily: FONT_NUM, flexShrink: 0, minWidth: 90, textAlign: 'right' }}>{fmt(t.amount)}</div>

        {/* Status buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
          {[
            { key: 'income',   label: 'Income',   color: G.green  },
            { key: 'expense',  label: 'Expense',  color: G.blue   },
            { key: 'personal', label: 'Personal', color: G.muted  },
          ].map(({ key, label, color }) => (
            <button key={key} onClick={(e) => { e.stopPropagation(); onStatus(t.id, key); if (key === 'expense') setOpen(true); else setOpen(false); }}
              style={{ ...pill(color), opacity: t.status === key ? 1 : 0.4, fontWeight: t.status === key ? 700 : 600, transform: t.status === key ? 'scale(1.05)' : 'scale(1)' }}>
              {label}
            </button>
          ))}
          {t.status === 'expense' && (
            <button onClick={() => setOpen(!open)}
              style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${G.glassBorder}`, borderRadius: 999, width: 32, height: 32, color: G.textDim, fontSize: 14, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {open ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {/* Expense detail panel */}
      {open && t.status === 'expense' && (
        <div style={{ padding: '14px 18px 18px', background: `rgba(${hexToRgb(G.blue)},0.04)`, borderTop: `1px solid ${G.glassBorder}` }}>
          <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, marginBottom: 10, letterSpacing: '0.04em' }}>EXPENSE TYPE</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {EXPENSE_CATS.map(ec => (
              <button key={ec.id} onClick={() => onSubcat(t.id, ec.id, ec.defaultPct || 100)}
                style={{
                  background: t.subcat === ec.id ? `rgba(${hexToRgb(G.blue)},0.25)` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${t.subcat === ec.id ? G.blue : G.glassBorder}`,
                  color: t.subcat === ec.id ? G.blue : G.textDim,
                  borderRadius: 999, padding: '6px 12px', fontSize: 11, fontWeight: t.subcat === ec.id ? 700 : 500, cursor: 'pointer', fontFamily: FONT
                }}>
                {ec.label}
              </button>
            ))}
          </div>

          {/* Percentage slider — always visible for expenses */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
            <span style={{ fontSize: 12, color: G.textDim, minWidth: 95 }}>Business use</span>
            <input type="range" min="0" max="100" step="5" value={t.claimPct} onChange={e => onPct(t.id, Number(e.target.value))}
              style={{ flex: 1, accentColor: G.blue }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: G.blue, fontFamily: FONT_NUM, minWidth: 46, textAlign: 'right' }}>{t.claimPct}%</span>
            <span style={{ fontSize: 13, color: G.green, fontFamily: FONT_NUM, fontWeight: 600, minWidth: 100, textAlign: 'right' }}>{fmt(Math.abs(t.amount) * t.claimPct / 100)}</span>
          </div>

          {/* Note for HMRC */}
          {!showNote ? (
            <button onClick={() => setShowNote(true)}
              style={{ background: 'transparent', border: `1px dashed ${G.glassBorderHi}`, borderRadius: 10, color: G.textDim, padding: '9px 14px', fontSize: 12, cursor: 'pointer', fontFamily: FONT, width: '100%' }}>
              + Add note for HMRC justification
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, marginBottom: 6 }}>HMRC NOTE</div>
              <textarea value={t.note} onChange={e => onNote(t.id, e.target.value)} rows={2}
                placeholder="e.g. Camera used 100% for client demo videos and reels"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${G.glassBorder}`, borderRadius: 10, color: G.text, padding: '10px 14px', fontSize: 12, fontFamily: FONT, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11, color: G.muted, marginTop: 6 }}>HMRC can request justification up to 5 years after filing. A short note now saves stress later.</div>
            </div>
          )}

          {cat && <div style={{ fontSize: 11, color: G.muted, marginTop: 10 }}>{cat.note}</div>}
        </div>
      )}
    </div>
  );
};

/* ─── MAIN ───────────────────────────────────────────────────────────── */
export default function RDHTaxDashboard() {
  // Load saved state on first render
  const saved = loadState() || {};
  const [transactions, setTransactions]   = useState(saved.transactions || []);
  const [payslips, setPayslips]           = useState(saved.payslips || []);
  const [tab, setTab]                     = useState('Dashboard');
  const [busySlip, setBusySlip]           = useState(false);
  const [busyAI, setBusyAI]               = useState(false);
  const [aiProgress, setAIProgress]       = useState('');
  const [miles, setMiles]                 = useState(saved.miles || 0);
  const [homeData, setHomeData]           = useState(saved.homeData || { roomPct: 20, councilTax: 0, electricity: 0, gas: 0, broadband: 0, rent: 0 });
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [savedAt, setSavedAt]             = useState(saved.savedAt || null);

  // Auto-save to localStorage on any change to persistent fields
  useEffect(() => {
    const now = new Date().toISOString();
    saveState({ transactions, payslips, miles, homeData, savedAt: now });
    setSavedAt(now);
  }, [transactions, payslips, miles, homeData]);

  const monzoRef = useRef(), starlingRef = useRef(), rbsRef = useRef(), amexRef = useRef(), payslipRef = useRef();
  const bankRefs = { monzo: monzoRef, starling: starlingRef, rbs: rbsRef, amex: amexRef };
  const BANKS = [{ id:'monzo',label:'Monzo' },{ id:'starling',label:'Starling' },{ id:'rbs',label:'RBS' },{ id:'amex',label:'Amex' }];

  // Backup / restore handlers
  const handleExport = () => exportJSON({ transactions, payslips, miles, homeData, savedAt: new Date().toISOString() });
  const handleImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.transactions) setTransactions(data.transactions);
        if (data.payslips) setPayslips(data.payslips);
        if (typeof data.miles === 'number') setMiles(data.miles);
        if (data.homeData) setHomeData(data.homeData);
        alert('Backup restored successfully');
      } catch { alert('Invalid backup file'); }
    };
    reader.readAsText(file); e.target.value = '';
  };
  const handleReset = () => {
    if (confirm('This will delete ALL your data permanently. Make sure you have exported a backup first. Continue?')) {
      setTransactions([]); setPayslips([]); setMiles(0);
      setHomeData({ roomPct: 20, councilTax: 0, electricity: 0, gas: 0, broadband: 0, rent: 0 });
    }
  };
  const importRef = useRef();

  const handleUpload = useCallback((bank) => (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const newOnes = parseCSV(ev.target.result, bank);
      setTransactions(prev => {
        // Build a fingerprint set of existing transactions to dedupe
        const fingerprint = (t) => `${t.bank}|${t.date}|${t.description}|${t.amount.toFixed(2)}`;
        const existing = new Set(prev.map(fingerprint));
        const fresh = newOnes.filter(t => !existing.has(fingerprint(t)));
        return [...prev, ...fresh];
      });
    };
    reader.readAsText(file); e.target.value = '';
  }, []);

  const handlePayslip = useCallback(async (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    e.target.value = ''; setBusySlip(true);
    for (const file of files) {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      const block = file.type === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
        : { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } };
      try {
        const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: [block, { type: 'text', text: 'Extract payslip. Return ONLY JSON, no preamble:\n{"month":"YYYY-MM","grossPay":number,"netPay":number,"incomeTaxPaid":number,"niPaid":number,"period":"Month YYYY"}' }] }] }) });
        const data = await res.json();
        const slip = JSON.parse((data.content?.[0]?.text || '{}').replace(/```json|```/g, '').trim());
        if (slip.grossPay || slip.netPay) setPayslips(prev => [...prev.filter(p => p.month !== slip.month), { ...slip, label: slip.period || monthLabel(slip.month) }].sort((a,b) => a.month?.localeCompare(b.month)));
      } catch(err) { console.error(err); }
    }
    setBusySlip(false);
  }, []);

  const aiCategorise = async () => {
    const pending = transactions.filter(t => t.status === 'pending');
    if (!pending.length) return;
    setBusyAI(true);
    const updated = [...transactions];
    for (let i = 0; i < pending.length; i += 15) {
      const batch = pending.slice(i, i + 15);
      setAIProgress(`${Math.min(i+15, pending.length)} / ${pending.length}`);
      const prompt = `Categorise transactions for Rhys — online personal trainer (RDH Coaching) and PAYE employee at Terumo Aortic.

Status: "income", "expense", "personal"
Subcat (only if expense): software, marketing, website, paymentfees, bankfees, equipment, cpd, phone, internet, homeoffice, car, travel, parking, profees, insurance, memberships, stationery, other
ClaimPct: 100 fully claimable, 60 phone, 50 broadband, 20 home office, 0 personal.
Note: short HMRC justification (max 12 words). E.g. "Stripe processing fee on client coaching payment."

Return ONLY JSON array:
[{"id":"...","status":"...","subcat":"...or null","claimPct":100,"note":"..."}]

${JSON.stringify(batch.map(({id,description,amount,bank})=>({id,description,amount,bank})))}`;
      try {
        const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }) });
        const data = await res.json();
        const results = JSON.parse((data.content?.[0]?.text || '[]').replace(/```json|```/g, '').trim());
        results.forEach(({ id, status, subcat, claimPct, note }) => {
          const idx = updated.findIndex(t => t.id === id);
          if (idx !== -1) {
            const amt = Math.abs(updated[idx].amount);
            updated[idx] = { ...updated[idx], status, subcat: subcat || null, claimPct: claimPct ?? 100, claimable: status === 'expense' ? amt * ((claimPct ?? 100) / 100) : 0, note: note || updated[idx].note };
          }
        });
      } catch(err) { console.error(err); }
    }
    setTransactions(updated); setBusyAI(false); setAIProgress('');
  };

  const onStatus = useCallback((id, status) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status, subcat: status !== 'expense' ? null : t.subcat, claimable: status === 'expense' ? Math.abs(t.amount) * t.claimPct / 100 : 0 } : t));
  }, []);

  const onSubcat = useCallback((id, subcat, defaultPct) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, subcat, claimPct: defaultPct ?? t.claimPct ?? 100, claimable: Math.abs(t.amount) * (defaultPct ?? t.claimPct ?? 100) / 100 } : t));
  }, []);

  const onPct = useCallback((id, claimPct) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, claimPct, claimable: Math.abs(t.amount) * claimPct / 100 } : t));
  }, []);

  const onNote = useCallback((id, note) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, note } : t));
  }, []);

  const mileageClaimable = miles <= 10000 ? miles * 0.45 : (10000 * 0.45) + ((miles - 10000) * 0.25);
  const homeClaimable = (Object.entries(homeData).filter(([k]) => k !== 'roomPct').reduce((s,[,v]) => s + (v||0), 0)) * (homeData.roomPct / 100);

  const summary = useMemo(() => {
    const income    = transactions.filter(t => t.status === 'income').reduce((s,t) => s + t.amount, 0);
    const claimable = transactions.filter(t => t.status === 'expense').reduce((s,t) => s + t.claimable, 0) + mileageClaimable + homeClaimable;
    const personal  = transactions.filter(t => t.status === 'personal').reduce((s,t) => s + Math.abs(t.amount), 0);
    const netProfit = income - claimable;
    const slipGross = payslips.reduce((s,p) => s + p.grossPay, 0);
    const annSalary = payslips.length >= 12 ? slipGross : slipGross > 0 ? slipGross / payslips.length * 12 : 0;
    const remainPA  = Math.max(0, 12570 - annSalary);
    const taxableAfterPA = Math.max(0, netProfit - remainPA);
    const rateAtMax = Math.min(annSalary, 50270);
    const basicBand = Math.max(0, Math.min(taxableAfterPA, 50270 - rateAtMax));
    const higherBand = Math.max(0, taxableAfterPA - basicBand);
    const rdhTax = basicBand * 0.20 + higherBand * 0.40;
    const niBase = Math.max(0, netProfit - 12570);
    const rdhNI = Math.min(niBase, 37700) * 0.06 + Math.max(0, niBase - 37700) * 0.02;
    const totalTax = rdhTax + rdhNI;
    const pending = transactions.filter(t => t.status === 'pending').length;
    const incomeCount = transactions.filter(t => t.status === 'income').length;
    const expenseCount = transactions.filter(t => t.status === 'expense').length;
    const personalCount = transactions.filter(t => t.status === 'personal').length;

    const byCat = {};
    EXPENSE_CATS.forEach(ec => { byCat[ec.id] = { value: 0, count: 0 }; });
    transactions.filter(t => t.status === 'expense' && t.subcat).forEach(t => {
      if (!byCat[t.subcat]) byCat[t.subcat] = { value: 0, count: 0 };
      byCat[t.subcat].value += t.claimable;
      byCat[t.subcat].count += 1;
    });

    return { income, claimable, personal, netProfit, rdhTax, rdhNI, totalTax, annSalary, pending, incomeCount, expenseCount, personalCount, byCat, monthlyPutAside: totalTax / 12 };
  }, [transactions, payslips, mileageClaimable, homeClaimable]);

  const filtered = useMemo(() => transactions.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase()) && !(t.note || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a,b) => {
    // Pending first, then by date desc
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (b.status === 'pending' && a.status !== 'pending') return 1;
    return new Date(b.date) - new Date(a.date);
  }), [transactions, statusFilter, search]);

  const bankCounts = useMemo(() => { const c={}; BANKS.forEach(b => c[b.id]=transactions.filter(t=>t.bank===b.id).length); return c; }, [transactions]);

  const tabs = ['Dashboard','Transactions','Deductions','Monthly'];

  return (
    <div style={{ minHeight: '100vh', background: G.bg, fontFamily: FONT, color: G.text, fontSize: 14 }}>

      {/* ── HEADER ── */}
      <div style={{ ...glass({ borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }), position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${G.blue}, ${G.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, boxShadow: `0 0 24px ${G.blueGlow}`, color: '#fff' }}>R</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>RDH Tax</div>
            <div style={{ fontSize: 11, color: G.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              2026/27 Self Assessment
              {savedAt && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: G.green }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: G.green, boxShadow: `0 0 8px ${G.green}` }} />
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={payslipRef} type="file" accept=".pdf,image/*" multiple onChange={handlePayslip} style={{ display: 'none' }} />
          {BANKS.map(b => (
            <div key={b.id}>
              <input ref={bankRefs[b.id]} type="file" accept=".csv" onChange={handleUpload(b.id)} style={{ display: 'none' }} />
              <button onClick={() => bankRefs[b.id].current.click()}
                style={{ background: bankCounts[b.id] > 0 ? `rgba(${hexToRgb(G.blue)},0.15)` : G.glass, border: `1px solid ${bankCounts[b.id] > 0 ? G.blue : G.glassBorder}`, borderRadius: 9, color: bankCounts[b.id] > 0 ? G.blue : G.textDim, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s' }}>
                {b.label}{bankCounts[b.id] > 0 ? ` · ${bankCounts[b.id]}` : ''}
              </button>
            </div>
          ))}
          <button onClick={() => payslipRef.current.click()} disabled={busySlip}
            style={{ background: payslips.length > 0 ? `rgba(${hexToRgb(G.gold)},0.15)` : G.glass, border: `1px solid ${payslips.length > 0 ? G.gold : G.glassBorder}`, borderRadius: 9, color: payslips.length > 0 ? G.gold : G.textDim, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
            {busySlip ? 'Reading…' : `Payslips${payslips.length > 0 ? ` · ${payslips.length}` : ''}`}
          </button>
        </div>
      </div>

      {/* ── TAB NAV ── */}
      <div style={{ display: 'flex', padding: '14px 24px', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '9px 22px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: FONT, borderRadius: 999, transition: 'all 0.15s',
              background: tab === t ? `linear-gradient(135deg, ${G.blue}, ${G.purple})` : G.glass,
              color: tab === t ? '#fff' : G.textDim,
              boxShadow: tab === t ? `0 4px 20px ${G.blueGlow}` : 'none',
              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              border: `1px solid ${tab === t ? 'transparent' : G.glassBorder}` }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 24px 40px', maxWidth: 1240, margin: '0 auto' }}>

        {/* ══ DASHBOARD ══ */}
        {tab === 'Dashboard' && (
          <div>
            {/* Top stats — clickable */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 16 }}>
              <StatTile label="RDH Income" value={fmt(summary.income)} color={G.green} glow={G.greenGlow}
                badge={`${summary.incomeCount}`} sub="Click to view income transactions"
                onClick={() => { setStatusFilter('income'); setTab('Transactions'); }} />
              <StatTile label="Claimable Expenses" value={fmt(summary.claimable)} color={G.blue} glow={G.blueGlow}
                badge={`${summary.expenseCount}`} sub="Includes mileage & home office"
                onClick={() => { setStatusFilter('expense'); setTab('Transactions'); }} />
              <StatTile label="Net Trading Profit" value={fmt(summary.netProfit)} color={summary.netProfit >= 0 ? G.green : G.red}
                sub="Income minus claimable" />
              <StatTile label="Tax to Set Aside" value={fmt(summary.totalTax)} color={G.gold} glow={G.goldGlow}
                sub="Income tax + Class 4 NI" />
            </div>

            {/* Action bar — needs categorising */}
            {summary.pending > 0 && (
              <GlassCard style={{ padding: '18px 22px', marginBottom: 16, borderColor: `rgba(${hexToRgb(G.gold)},0.3)`, background: `linear-gradient(135deg, rgba(${hexToRgb(G.gold)},0.08), rgba(${hexToRgb(G.gold)},0.02))` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 15, color: G.text, fontWeight: 600, marginBottom: 4 }}>{summary.pending} transactions need categorising</div>
                    <div style={{ fontSize: 12, color: G.textDim }}>Use AI to auto-classify, or click any card to choose Income / Expense / Personal</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setStatusFilter('pending'); setTab('Transactions'); }}
                      style={{ background: G.glass, color: G.text, border: `1px solid ${G.glassBorderHi}`, borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                      Review manually
                    </button>
                    <button onClick={aiCategorise} disabled={busyAI}
                      style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.purple})`, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, boxShadow: `0 4px 20px ${G.blueGlow}`, opacity: busyAI ? 0.7 : 1 }}>
                      {busyAI ? `AI working… ${aiProgress}` : 'AI Auto-Categorise'}
                    </button>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Activity breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 16 }}>
              <GlassCard style={{ padding: '20px 22px' }}>
                <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, marginBottom: 18, letterSpacing: '0.02em' }}>ACTIVITY BREAKDOWN</div>
                <PctBar label="RDH Income"         value={summary.income}    total={summary.income + summary.claimable + summary.personal} color={G.green} count={summary.incomeCount} />
                <PctBar label="Claimable Expenses" value={summary.claimable} total={summary.income + summary.claimable + summary.personal} color={G.blue}  count={summary.expenseCount} />
                <PctBar label="Personal Spend"     value={summary.personal}  total={summary.income + summary.claimable + summary.personal} color={G.muted} count={summary.personalCount} />
              </GlassCard>

              <GlassCard style={{ padding: '20px 22px', background: `linear-gradient(135deg, rgba(${hexToRgb(G.gold)},0.08), rgba(${hexToRgb(G.purple)},0.04))`, borderColor: `rgba(${hexToRgb(G.gold)},0.2)` }}>
                <div style={{ fontSize: 11, color: G.gold, fontWeight: 600, marginBottom: 10, letterSpacing: '0.02em' }}>MONTHLY SET-ASIDE</div>
                <div style={{ fontSize: 36, fontWeight: 700, color: G.gold, letterSpacing: '-0.03em', fontFamily: FONT_NUM, lineHeight: 1.1, marginBottom: 8 }}>{fmt(summary.monthlyPutAside)}</div>
                <div style={{ fontSize: 12, color: G.textDim, lineHeight: 1.6 }}>Or use the 25% rule — set aside 25% of every RDH payment immediately.</div>
                <div style={{ fontSize: 11, color: G.muted, marginTop: 10 }}>Bill due 31 January 2027</div>
              </GlassCard>
            </div>

            {/* P&L */}
            <GlassCard style={{ padding: '20px 22px' }}>
              <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, marginBottom: 16, letterSpacing: '0.02em' }}>PROFIT & LOSS</div>
              {[
                { label: 'Gross RDH Income',         value: summary.income,           color: G.green },
                { label: 'Less: Claimable Expenses', value: -summary.claimable,       color: G.blue  },
                { label: 'Net Trading Profit',       value: summary.netProfit,        color: G.text,  bold: true, div: true },
                { label: 'Less: Income Tax (est.)',  value: -summary.rdhTax,          color: G.red   },
                { label: 'Less: Class 4 NI (est.)',  value: -summary.rdhNI,           color: G.red   },
                { label: 'Profit After Tax',         value: summary.netProfit - summary.totalTax, color: G.text, bold: true, div: true },
              ].map(({ label, value, color, bold, div }, i) => (
                <div key={i}>
                  {div && <div style={{ borderTop: `1px solid ${G.glassBorder}`, margin: '10px 0' }} />}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ fontSize: 13, color: bold ? G.text : G.textDim, fontWeight: bold ? 600 : 400 }}>{label}</span>
                    <span style={{ fontSize: 13, color, fontWeight: bold ? 600 : 400, fontFamily: FONT_NUM }}>{fmt(value, true)}</span>
                  </div>
                </div>
              ))}
            </GlassCard>
          </div>
        )}

        {/* ══ TRANSACTIONS ══ */}
        {tab === 'Transactions' && (
          <div>
            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <input placeholder="Search transactions or notes…" value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, background: G.glass, border: `1px solid ${G.glassBorder}`, borderRadius: 10, color: G.text, padding: '11px 16px', fontSize: 14, fontFamily: FONT, outline: 'none', backdropFilter: 'blur(10px)' }} />
              {[
                { key: 'all',      label: 'All',      color: G.text  },
                { key: 'pending',  label: `Pending${summary.pending > 0 ? ` (${summary.pending})` : ''}`, color: G.gold },
                { key: 'income',   label: 'Income',   color: G.green },
                { key: 'expense',  label: 'Expense',  color: G.blue  },
                { key: 'personal', label: 'Personal', color: G.muted },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  style={{ ...pill(color), opacity: statusFilter === key ? 1 : 0.4 }}>
                  {label}
                </button>
              ))}
              {summary.pending > 0 && (
                <button onClick={aiCategorise} disabled={busyAI}
                  style={{ background: `linear-gradient(135deg, ${G.blue}, ${G.purple})`, color: '#fff', border: 'none', borderRadius: 999, padding: '8px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, opacity: busyAI ? 0.7 : 1 }}>
                  {busyAI ? aiProgress : `AI Auto-Categorise (${summary.pending})`}
                </button>
              )}
            </div>

            {filtered.length > 0 ? (
              <GlassCard style={{ overflow: 'hidden', padding: 0 }}>
                {filtered.map(t => (
                  <TCard key={t.id} t={t} onStatus={onStatus} onSubcat={onSubcat} onPct={onPct} onNote={onNote} />
                ))}
              </GlassCard>
            ) : (
              <GlassCard style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: G.textDim }}>
                  {transactions.length === 0 ? 'Upload a CSV from any bank in the header to get started' : 'No transactions match the current filter'}
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* ══ DEDUCTIONS ══ */}
        {tab === 'Deductions' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 14 }}>
              <MileageTracker miles={miles} setMiles={setMiles} />
              <HomeOfficeCalc homeData={homeData} setHomeData={setHomeData} />
            </div>

            {/* Expense breakdown by type */}
            <GlassCard style={{ padding: '20px 22px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, marginBottom: 18, letterSpacing: '0.02em' }}>CLAIMABLE BY CATEGORY</div>
              {(() => {
                const total = Object.values(summary.byCat).reduce((s,v) => s+v.value, 0) + mileageClaimable + homeClaimable;
                const items = [];
                if (mileageClaimable > 0) items.push({ label: 'Car & Mileage', value: mileageClaimable, color: G.teal });
                if (homeClaimable > 0)    items.push({ label: 'Home Office (calculator)', value: homeClaimable, color: G.purple });
                EXPENSE_CATS.forEach(ec => {
                  const v = summary.byCat[ec.id];
                  if (v && v.value > 0) items.push({ label: ec.label, value: v.value, color: G.blue, count: v.count });
                });
                return items.length > 0
                  ? items.map(({label, value, color, count}) => <PctBar key={label} label={label} value={value} total={total} color={color} count={count} />)
                  : <div style={{ fontSize: 13, color: G.textDim, textAlign: 'center', padding: '20px 0' }}>Categorise some expenses to see the breakdown here.</div>;
              })()}
            </GlassCard>

            {/* Reference guide */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
              <GlassCard style={{ padding: '20px 22px' }}>
                <div style={{ fontSize: 11, color: G.green, fontWeight: 600, marginBottom: 16, letterSpacing: '0.02em' }}>YOU CAN CLAIM</div>
                {[
                  ['Software & subscriptions',   'Canva, Kahunas, Loom, CapCut, Notion'],
                  ['Marketing & ads',            'Meta, Instagram, Google ads'],
                  ['Website',                    'Vercel, Namecheap, Formspree, Mailchimp'],
                  ['Payment processing fees',    'Stripe, GoCardless, PayPal — fully claimable'],
                  ['Bank charges',               'Business account fees, FX charges'],
                  ['Equipment',                  'Camera, mic, ring light, laptop'],
                  ['Professional development',   'PT courses, certifications, books'],
                  ['Phone (business %)',         'Your business-use percentage of the bill'],
                  ['Broadband (business %)',     'Your business-use percentage'],
                  ['Home office %',              'Council tax, utilities, broadband proportion'],
                  ['Car mileage',                '45p/mile (first 10k), 25p/mile after'],
                  ['Public transport',           'Train, bus, taxi for business journeys'],
                  ['Parking',                    'Business parking — not regular workplace'],
                  ['Professional fees',          'Accountant, bookkeeper, legal'],
                  ['PI insurance',               'Professional indemnity cover'],
                  ['Industry memberships',       'REPs, CIMSPA, professional bodies'],
                ].map(([item, detail]) => (
                  <div key={item} style={{ padding: '10px 0', borderBottom: `1px solid ${G.glassBorder}` }}>
                    <div style={{ fontSize: 13, color: G.text, fontWeight: 500, marginBottom: 3 }}>{item}</div>
                    <div style={{ fontSize: 12, color: G.textDim, lineHeight: 1.5 }}>{detail}</div>
                  </div>
                ))}
              </GlassCard>

              <GlassCard style={{ padding: '20px 22px' }}>
                <div style={{ fontSize: 11, color: G.red, fontWeight: 600, marginBottom: 16, letterSpacing: '0.02em' }}>YOU CANNOT CLAIM</div>
                {[
                  ['Personal gym membership',  'HMRC classes this as personal'],
                  ['Gym clothing',             'Regular sportswear is disallowed'],
                  ['Food & drink',             'Personal meals — only if away overnight on business'],
                  ['Client entertainment',     'Specifically blocked — coffees, meals with clients'],
                  ['Daily commute',            'Home to regular workplace is personal'],
                  ['Personal subscriptions',   'Netflix, Spotify, personal apps'],
                  ['Supplements & protein',    'Personal health, not a business cost'],
                  ['Speeding / parking fines', 'Never claimable'],
                  ['Clothing (unbranded)',     'Only branded uniforms or PPE qualify'],
                  ['Mortgage capital',         'Only mortgage interest is claimable'],
                ].map(([item, detail]) => (
                  <div key={item} style={{ padding: '10px 0', borderBottom: `1px solid ${G.glassBorder}` }}>
                    <div style={{ fontSize: 13, color: G.text, fontWeight: 500, marginBottom: 3 }}>{item}</div>
                    <div style={{ fontSize: 12, color: G.textDim, lineHeight: 1.5 }}>{detail}</div>
                  </div>
                ))}

                <div style={{ marginTop: 18, padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: G.blue, fontWeight: 600, marginBottom: 12, letterSpacing: '0.02em' }}>2026/27 KEY RATES</div>
                  {[
                    ['Personal allowance', '£12,570'],
                    ['Basic rate (20%)', '£12,571 – £50,270'],
                    ['Higher rate (40%)', '£50,271 – £125,140'],
                    ['Class 4 NI (6%)', '£12,570 – £50,270 profit'],
                    ['SA deadline', '31 January 2027'],
                    ['VAT threshold', '£90,000 turnover'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
                      <span style={{ fontSize: 12, color: G.textDim }}>{l}</span>
                      <span style={{ fontSize: 12, color: G.text, fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* Data Management */}
            <GlassCard style={{ padding: '20px 22px', marginTop: 14 }}>
              <div style={{ fontSize: 11, color: G.muted, fontWeight: 600, marginBottom: 14, letterSpacing: '0.02em' }}>YOUR DATA</div>
              <div style={{ fontSize: 13, color: G.textDim, marginBottom: 16, lineHeight: 1.6 }}>
                All your data is saved automatically to this browser. It stays here until you clear it.
                {savedAt && <span style={{ display: 'block', marginTop: 6, color: G.muted, fontSize: 12 }}>Last saved: {new Date(savedAt).toLocaleString('en-GB')}</span>}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input ref={importRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                <button onClick={handleExport}
                  style={{ background: `rgba(${hexToRgb(G.blue)},0.15)`, color: G.blue, border: `1px solid rgba(${hexToRgb(G.blue)},0.3)`, borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                  Download backup
                </button>
                <button onClick={() => importRef.current.click()}
                  style={{ background: G.glass, color: G.text, border: `1px solid ${G.glassBorderHi}`, borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                  Restore from backup
                </button>
                <button onClick={handleReset}
                  style={{ background: `rgba(${hexToRgb(G.red)},0.1)`, color: G.red, border: `1px solid rgba(${hexToRgb(G.red)},0.3)`, borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, marginLeft: 'auto' }}>
                  Reset all data
                </button>
              </div>
              <div style={{ fontSize: 11, color: G.muted, marginTop: 12, lineHeight: 1.6 }}>
                Tip: download a backup at the end of each month and save it to Google Drive. Browser data can be wiped if you clear cookies or switch devices.
              </div>
            </GlassCard>
          </div>
        )}

        {/* ══ MONTHLY ══ */}
        {tab === 'Monthly' && (() => {
          const map = {};
          transactions.forEach(t => {
            const k = toMonthKey(t.date);
            if (!map[k]) map[k] = { k, label: monthLabel(k), income: 0, claimable: 0, personal: 0 };
            if (t.status === 'income')   map[k].income    += t.amount;
            if (t.status === 'expense')  map[k].claimable += t.claimable;
            if (t.status === 'personal') map[k].personal  += Math.abs(t.amount);
          });
          payslips.forEach(p => {
            if (!map[p.month]) map[p.month] = { k: p.month, label: p.label || monthLabel(p.month), income: 0, claimable: 0, personal: 0 };
            map[p.month].slip = p;
          });
          const rows = Object.values(map).sort((a,b) => a.k.localeCompare(b.k)).map(m => ({
            ...m, netProfit: m.income - m.claimable, putAside: Math.max(0, (m.income - m.claimable) * 0.25),
          }));
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
                <StatTile label="Total Income"     value={fmt(rows.reduce((s,m)=>s+m.income,0))}    color={G.green} />
                <StatTile label="Total Claimable"  value={fmt(rows.reduce((s,m)=>s+m.claimable,0))} color={G.blue} />
                <StatTile label="Total Net Profit" value={fmt(rows.reduce((s,m)=>s+m.netProfit,0))} color={G.text} />
                <StatTile label="Total Put Aside"  value={fmt(rows.reduce((s,m)=>s+m.putAside,0))}  color={G.gold} sub="25% rule" />
              </div>

              {rows.length > 0 ? (
                <GlassCard style={{ overflow: 'hidden', padding: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: `1px solid ${G.glassBorder}`, gap: 12 }}>
                    {['Month','RDH Income','Claimable','Net Profit','Put Aside (25%)','PAYE Net'].map((h,i) => (
                      <div key={h} style={{ fontSize: 11, color: G.muted, fontWeight: 600, letterSpacing: '0.02em', textAlign: i===0?'left':'right' }}>{h}</div>
                    ))}
                  </div>
                  {rows.map((m, i) => (
                    <div key={m.k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', padding: '13px 20px', borderBottom: `1px solid ${G.glassBorder}`, gap: 12, transition: 'background 0.1s', background: i%2===0?'transparent':'rgba(255,255,255,0.02)' }}
                      onMouseEnter={e => e.currentTarget.style.background = G.glassHi}
                      onMouseLeave={e => e.currentTarget.style.background = i%2===0?'transparent':'rgba(255,255,255,0.02)'}>
                      <div style={{ fontSize: 13, color: G.text, fontWeight: 500 }}>{m.label}</div>
                      <div style={{ textAlign:'right', fontSize:13, color:G.green, fontFamily: FONT_NUM }}>{m.income>0?fmt(m.income):'—'}</div>
                      <div style={{ textAlign:'right', fontSize:13, color:G.blue, fontFamily: FONT_NUM }}>{m.claimable>0?fmt(m.claimable):'—'}</div>
                      <div style={{ textAlign:'right', fontSize:13, color:m.netProfit>=0?G.green:G.red, fontFamily: FONT_NUM }}>{m.income>0||m.claimable>0?fmt(m.netProfit):'—'}</div>
                      <div style={{ textAlign:'right', fontSize:14, color:G.gold, fontWeight:600, fontFamily: FONT_NUM }}>{m.putAside>0?fmt(m.putAside):'—'}</div>
                      <div style={{ textAlign:'right', fontSize:13, color:G.textDim, fontFamily: FONT_NUM }}>{m.slip?fmt(m.slip.netPay):'—'}</div>
                    </div>
                  ))}
                  <div style={{ display:'grid', gridTemplateColumns:'130px 1fr 1fr 1fr 1fr 1fr', padding:'13px 20px', gap:12, background:'rgba(255,255,255,0.05)', borderTop:`1px solid ${G.glassBorderHi}` }}>
                    <div style={{ fontSize:11, color:G.text, fontWeight:700, display:'flex', alignItems:'center', letterSpacing:'0.02em' }}>TOTAL</div>
                    {[
                      {v:rows.reduce((s,m)=>s+m.income,0),    c:G.green},
                      {v:rows.reduce((s,m)=>s+m.claimable,0), c:G.blue},
                      {v:rows.reduce((s,m)=>s+m.netProfit,0), c:G.text},
                      {v:rows.reduce((s,m)=>s+m.putAside,0),  c:G.gold},
                      {v:payslips.reduce((s,p)=>s+p.netPay,0),c:G.textDim},
                    ].map(({v,c},i) => <div key={i} style={{ textAlign:'right', fontSize:13, color:c, fontWeight:700, fontFamily: FONT_NUM }}>{v>0?fmt(v):'—'}</div>)}
                  </div>
                </GlassCard>
              ) : (
                <GlassCard style={{ padding:'60px 20px', textAlign:'center' }}>
                  <div style={{ fontSize: 14, color: G.textDim }}>Upload transactions or payslips to see the monthly breakdown</div>
                </GlassCard>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
