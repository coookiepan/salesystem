/* DUSKIN field-app UI kit — shared components */
const { STATUS_STYLE, CAT_STYLE } = window.DUSKIN_DATA;

/* status = a live state pill (tint bg + deep fg + leading dot) */
function StatusPill({ status }) {
  const [bg, fg] = STATUS_STYLE[status] || ['#F1EFE8', '#444441'];
  return (
    <span className="status" style={{ background: bg, color: fg }}>
      <span className="sdot"></span>{status}
    </span>
  );
}

/* category = a uniform classification tag with a colour swatch */
function CategoryTag({ cat }) {
  return (
    <span className="cat">
      <span className="csq" style={{ background: CAT_STYLE[cat] || '#8F8F87' }}></span>{cat}
    </span>
  );
}

function MoodIcon({ mood, size = 18 }) {
  const name = window.DUSKIN_DATA.MOODS[mood] || 'meh';
  const C = Icon[name];
  return <C width={size} height={size} />;
}

function StatCard({ num, label, accent }) {
  return (
    <div className="scard">
      <div className="snum" style={accent ? { color: 'var(--green)' } : null}>{num}</div>
      <div className="slbl">{label}</div>
    </div>
  );
}

function AppBar({ title }) {
  return (
    <div className="appbar">
      <div className="brand">
        <span className="mk"><Icon.duck width={18} height={18} style={{ color: '#fff' }} /></span>
        {title}
      </div>
      <Icon.refresh width={17} height={17} style={{ color: 'var(--text3)' }} />
    </div>
  );
}

function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <span className="sb-r">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="6" width="3" height="5" rx="1"/><rect x="4" y="4" width="3" height="7" rx="1"/><rect x="8" y="2" width="3" height="9" rx="1"/><rect x="12" y="0" width="3" height="11" rx="1"/></svg>
        <svg width="22" height="11" viewBox="0 0 22 11" fill="none" stroke="currentColor" strokeWidth="1"><rect x="1" y="1" width="17" height="9" rx="2.5"/><rect x="2.5" y="2.5" width="12" height="6" rx="1.2" fill="currentColor" stroke="none"/><rect x="19.5" y="4" width="1.5" height="3" rx="1" fill="currentColor" stroke="none"/></svg>
      </span>
    </div>
  );
}

const NAV = [
  ['clients', '客戶', 'users'],
  ['daily', '日報', 'calendar'],
  ['todos', '待辦', 'check'],
  ['shops', '查詢', 'search'],
  ['inventory', '庫存', 'box'],
  ['settings', '設定', 'settings'],
];

function BottomNav({ tab, onNav }) {
  return (
    <nav className="nav">
      {NAV.map(([id, label, icon]) => {
        const C = Icon[icon];
        return (
          <button key={id} className={'nav-btn' + (tab === id ? ' on' : '')} onClick={() => onNav(id)}>
            <C />{label}
          </button>
        );
      })}
    </nav>
  );
}

function Empty({ title, children }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>;
}

Object.assign(window, { StatusPill, CategoryTag, MoodIcon, StatCard, AppBar, StatusBar, BottomNav, Empty, NAV });
