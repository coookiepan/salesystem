/* DUSKIN field-app UI kit — screens */
const { STATUS_ORDER, STATUS_STYLE } = window.DUSKIN_DATA;
const TYPES = ['餐廳','診所','寵物','工廠','汽車','眼鏡行','接待中心','房仲','補習班','美容美甲','零售店','辦公室','其他'];

/* ─────────────────────────── CLIENT LIST ─────────────────────────── */
function ClientList({ clients, onOpen, onAdd }) {
  const [filter, setFilter] = React.useState('全部');
  const [q, setQ] = React.useState('');
  const count = (s) => clients.filter(c => c.status === s).length;

  let list = clients;
  if (filter !== '全部') list = list.filter(c => c.status === filter);
  if (q.trim()) list = list.filter(c => (c.name + c.addr + c.contact).includes(q.trim()));

  const Pill = ({ s, hot }) => {
    const on = filter === s;
    if (hot) {
      const c = STATUS_STYLE[s][2];
      return (
        <button className={'pill hot' + (on ? ' on' : '')} style={{ '--c': c }} onClick={() => setFilter(s)}>
          <span className="pdot"></span>{s}<span className="pcount">{count(s)}</span>
        </button>
      );
    }
    return <button className={'pill' + (on ? ' on' : '')} onClick={() => setFilter(s)}>{s}</button>;
  };

  return (
    <div className="scroll">
      <div className="page-title">客戶</div>
      <div className="page-sub">{clients.length} 家 · 本週要拜訪 4 家</div>
      <div className="toolbar">
        <div className="pill-row">
          <button className={'pill' + (filter === '全部' ? ' on' : '')} onClick={() => setFilter('全部')}>全部</button>
          <Pill s="未拜訪" hot />
          <Pill s="初訪" /><Pill s="複訪" />
          <Pill s="試用中" hot />
          <Pill s="報價" /><Pill s="將成約" /><Pill s="已成約" /><Pill s="拒絕" />
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}><Icon.plus />新增</button>
      </div>
      <div className="search-bar"><input className="field" placeholder="搜尋客戶…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {list.length === 0
        ? <Empty title="沒有符合的客戶">換個篩選或搜尋關鍵字試試。</Empty>
        : list.map(c => (
          <div key={c.id} className="cc" onClick={() => onOpen(c)}>
            <div className="cc-head">
              <div className="cc-name">{c.name}</div>
              <StatusPill status={c.status} />
            </div>
            <div className="cc-sub">{c.addr}{c.contact ? ' · ' + c.contact : ''}</div>
            {c.cats.length > 0 && <div className="cats">{c.cats.map(cat => <CategoryTag key={cat} cat={cat} />)}</div>}
            <div className="cc-meta">
              {c.nextdate && <span>下次拜訪 {c.nextdate}</span>}
              {c.fw4 > 0 && <span>試用 ${c.fw4.toLocaleString()}</span>}
              {c.visits > 0 && <span>拜訪 {c.visits} 次</span>}
            </div>
          </div>
        ))}
    </div>
  );
}

/* ─────────────────────────── CLIENT DETAIL ───────────────────────── */
function ClientDetail({ client, onBack, onToggleTodo, onAddVisit }) {
  const [mood, setMood] = React.useState(3);
  const [note, setNote] = React.useState('');
  const Field = ({ label, children }) => (
    <div><div className="detail-label">{label}</div><div className="detail-val">{children || '—'}</div></div>
  );
  return (
    <div className="scroll">
      <div className="back-header">
        <button className="back-btn" onClick={onBack}><Icon.back />返回</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{client.name}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="btn btn-primary btn-sm"><Icon.fileText />報價／合約</button>
        <button className="btn btn-outline btn-sm"><Icon.zap />快速報價</button>
        <button className="btn btn-outline btn-sm">編輯</button>
        <button className="btn btn-danger btn-sm">刪除</button>
      </div>

      <div className="card">
        <div className="form-section">基本資料</div>
        <div className="detail-grid">
          <Field label="類型">{client.type}</Field>
          <div><div className="detail-label">狀態</div><div style={{ marginTop: 2 }}><StatusPill status={client.status} /></div></div>
          <Field label="窗口／職稱">{client.contact}</Field>
          <Field label="電話">{client.phone}</Field>
          <Field label="下次拜訪">{client.nextdate}</Field>
          <Field label="試用金額">{client.fw4 > 0 ? '$' + client.fw4.toLocaleString() : '—'}</Field>
        </div>
        <div style={{ marginTop: 12 }}><Field label="地址">{client.addr}</Field></div>
        <div style={{ marginTop: 12 }}><Field label="環境觀察">{client.env}</Field></div>
      </div>

      {client.trial.length > 0 && (
        <div className="card">
          <div className="form-section">試用品項</div>
          {client.trial.map((t, i) => (
            <div key={i} className="ti-row">
              <div><div className="ti-code">{t.code}</div><div className="ti-desc">{t.desc}</div></div>
              <div className="ti-price">${t.price} <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}>/4W</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="form-section">拜訪記錄</div>
        <div style={{ marginBottom: 14 }}>
          <div className="lbl">這次拜訪心情</div>
          <div className="mood-row" style={{ marginBottom: 10 }}>
            {[1, 2, 3, 4].map(m => {
              const C = Icon[window.DUSKIN_DATA.MOODS[m]];
              return <button key={m} className={'mood-btn' + (mood === m ? ' on' : '')} onClick={() => setMood(m)}><C /></button>;
            })}
          </div>
          <textarea className="field" rows="2" placeholder="這次拜訪的筆記…" value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'none' }} />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} disabled={!note.trim()}
            onClick={() => { onAddVisit(client.id, mood, note.trim()); setNote(''); }}>記錄拜訪</button>
        </div>
        {client.log.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--text3)' }}>尚無拜訪記錄</div>
          : client.log.map((v, i) => (
            <div key={i} className="visit-log">
              <div className="vl-head"><span className="vl-mood"><MoodIcon mood={v.mood} /></span><span className="vl-date">{v.date}</span></div>
              <div className="vl-note">{v.note}</div>
            </div>
          ))}
      </div>

      {client.todos.length > 0 && (
        <div className="card">
          <div className="form-section">待辦事項</div>
          {client.todos.map((t, i) => (
            <label key={i} className="todo-row">
              <input type="checkbox" checked={t.done} onChange={() => onToggleTodo(client.id, i)} />
              <span className={t.done ? 'todo-done' : ''}>{t.t}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── CLIENT FORM ─────────────────────────── */
function ClientForm({ onBack, onSave }) {
  const [f, setF] = React.useState({ name: '', contact: '', phone: '', addr: '', type: '餐廳', status: '未拜訪', nextdate: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="scroll">
      <div className="back-header">
        <button className="back-btn" onClick={onBack}><Icon.back />返回</button>
        <span style={{ fontSize: 16, fontWeight: 600 }}>新增客戶</span>
      </div>
      <div className="card">
        <div className="form-section">基本資料</div>
        <div className="g2">
          <div className="f"><label className="lbl">客戶名稱</label><input className="field" value={f.name} onChange={set('name')} placeholder="例：陽光餐廳" /></div>
          <div className="f"><label className="lbl">窗口／職稱</label><input className="field" value={f.contact} onChange={set('contact')} placeholder="陳小姐 / 老闆" /></div>
          <div className="f"><label className="lbl">電話</label><input className="field" value={f.phone} onChange={set('phone')} placeholder="06-1234567" /></div>
          <div className="f"><label className="lbl">類型</label>
            <select className="field" value={f.type} onChange={set('type')}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div className="f"><label className="lbl">地址</label><input className="field" value={f.addr} onChange={set('addr')} placeholder="中正區忠孝東路 100 號" /></div>
        <div className="g2">
          <div className="f"><label className="lbl">狀態</label>
            <select className="field" value={f.status} onChange={set('status')}>{STATUS_ORDER.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="f"><label className="lbl">下次拜訪日</label><input className="field" type="date" value={f.nextdate} onChange={set('nextdate')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn btn-primary" disabled={!f.name.trim()} onClick={() => onSave(f)} style={{ flex: 1 }}>儲存客戶</button>
          <button className="btn btn-outline" onClick={onBack}>取消</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── INVENTORY ───────────────────────────── */
function Inventory({ inventory, onStep }) {
  const [cat, setCat] = React.useState('');
  const [q, setQ] = React.useState('');
  const products = window.DUSKIN_DATA.PRODUCTS;
  const desc = (code) => (products.find(p => p.code === code) || {}).desc || '';
  let list = inventory;
  if (cat) list = list.filter(i => i.cat === cat);
  if (q.trim()) list = list.filter(i => i.code.toLowerCase().includes(q.trim().toLowerCase()));
  const lowCount = inventory.filter(i => i.stock < i.std).length;
  return (
    <div className="scroll">
      <div className="page-title">庫存</div>
      <div className="page-sub">車上庫存 · {lowCount} 項需補貨</div>
      <div className="toolbar">
        <div className="pill-row">
          {['', '地墊', '拖把', '芳香'].map(c => (
            <button key={c || 'all'} className={'pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c || '全部'}</button>
          ))}
        </div>
      </div>
      <div className="search-bar"><input className="field" placeholder="搜尋品項代號…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {list.map(i => (
        <div key={i.code} className="inv-item">
          <div style={{ flex: 1 }}>
            <span className="inv-code">{i.code}</span>
            <span className="inv-desc"> · {desc(i.code)}</span>
          </div>
          <button className="step" onClick={() => onStep(i.code, -1)}>−</button>
          <span className={'inv-stock' + (i.stock < i.std ? ' low' : '')}>{i.stock}</span>
          <button className="step" onClick={() => onStep(i.code, 1)}>+</button>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── DAILY REPORT ────────────────────────── */
function DailyReport({ clients }) {
  const visits = clients.flatMap(c => c.log.map(v => ({ ...v, name: c.name, status: c.status })))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const won = clients.filter(c => c.status === '已成約').reduce((s, c) => s + c.fw4, 0);
  return (
    <div className="scroll">
      <div className="page-title">日報</div>
      <div className="page-sub">2026-04-20（星期一）</div>
      <div className="stat-grid">
        <StatCard num="12" label="今日拜訪" />
        <StatCard num="3" label="新客戶" />
        <StatCard num={'$' + won.toLocaleString()} label="成約金額" accent />
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 2 }}>
          <span>成約轉換率</span><span className="snum" style={{ fontSize: 14 }}>38%</span>
        </div>
        <div className="prog"><div className="prog-f" style={{ width: '38%' }}></div></div>
      </div>
      <div className="sec-label" style={{ marginTop: 4 }}>今日拜訪記錄</div>
      {visits.map((v, i) => (
        <div key={i} className="cc" style={{ cursor: 'default' }}>
          <div className="cc-top">
            <div><div className="cc-name" style={{ fontSize: 14.5 }}>{v.name}</div>
              <div className="vl-note" style={{ marginTop: 3 }}>{v.note}</div></div>
            <span className="vl-mood"><MoodIcon mood={v.mood} /></span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── SHOPS (查詢) ────────────────────────── */
function Shops() {
  const rows = [
    { name: '老地方麵館', phone: '06-2233445', addr: '中西區民族路 12 號', owner: '林先生' },
    { name: '康橋牙醫診所', phone: '06-2901122', addr: '東區東寧路 88 號', owner: '黃醫師' },
    { name: '寵愛動物醫院', phone: '06-3387766', addr: '永康區中華路 55 號', owner: '吳院長' },
  ];
  const [q, setQ] = React.useState('');
  const list = q.trim() ? rows.filter(r => (r.name + r.addr + r.owner + r.phone).includes(q.trim())) : rows;
  return (
    <div className="scroll">
      <div className="page-title">查詢</div>
      <div className="alert alert-info"><Icon.info /><span>公司現有客戶名單（從雲端載入）</span></div>
      <div className="search-bar"><input className="field" placeholder="店名／地址／電話／負責人…" value={q} onChange={e => setQ(e.target.value)} /></div>
      {list.map((r, i) => (
        <div key={i} className="cc" style={{ cursor: 'default' }}>
          <div className="cc-top">
            <div><div className="cc-name" style={{ fontSize: 14.5 }}>{r.name}</div>
              <div className="cc-sub">{r.addr} · {r.owner}</div></div>
            <a className="btn btn-outline btn-xs" href={'tel:' + r.phone} onClick={e => e.preventDefault()}><Icon.phone width={13} height={13} />{r.phone}</a>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── TODOS ───────────────────────────────── */
function Todos({ clients, onToggleTodo }) {
  const items = clients.flatMap(c => c.todos.map((t, i) => ({ ...t, name: c.name, cid: c.id, idx: i })));
  const [showDone, setShowDone] = React.useState(true);
  const list = showDone ? items : items.filter(t => !t.done);
  return (
    <div className="scroll">
      <div className="page-title">待辦</div>
      <div className="page-sub">{items.filter(t => !t.done).length} 項未完成</div>
      <div className="toolbar">
        <div className="pill-row">
          <button className={'pill' + (showDone ? ' on' : '')} onClick={() => setShowDone(true)}>全部</button>
          <button className={'pill' + (!showDone ? ' on' : '')} onClick={() => setShowDone(false)}>未完成</button>
        </div>
      </div>
      <div className="card">
        {list.length === 0 ? <Empty title="沒有待辦事項">所有事項都完成了 👍</Empty> :
          list.map((t, i) => (
            <label key={i} className="todo-row">
              <input type="checkbox" checked={t.done} onChange={() => onToggleTodo(t.cid, t.idx)} />
              <span style={{ flex: 1 }}>
                <span className={t.done ? 'todo-done' : ''}>{t.t}</span>
                <div className="todo-meta">{t.name}</div>
              </span>
            </label>
          ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── SETTINGS ────────────────────────────── */
function Settings() {
  return (
    <div className="scroll">
      <div className="page-title">設定</div>
      <div className="alert alert-info"><Icon.cloud /><span>已連接 Google Sheets · 最後同步 3 分鐘前</span></div>
      <div className="card">
        <div className="form-section">商品資料庫</div>
        {window.DUSKIN_DATA.PRODUCTS.slice(0, 5).map(p => (
          <div key={p.code} className="inv-item" style={{ border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, margin: 0 }}>
            <div style={{ flex: 1 }}><span className="inv-code">{p.code}</span><span className="inv-desc"> · {p.desc}</span></div>
            <span className="ti-price">${p.price} <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}>/{p.cycle}</span></span>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="form-section">版本資訊</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>目前版本 v2026.06.03-m1</span>
          <button className="btn btn-outline btn-sm"><Icon.refresh />強制重新載入</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ClientList, ClientDetail, ClientForm, Inventory, DailyReport, Shops, Todos, Settings });
