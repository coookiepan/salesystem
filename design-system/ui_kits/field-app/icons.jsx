/* DUSKIN field-app UI kit — line icons (Feather/Lucide family) */
const Svg = (p) => React.createElement('svg', Object.assign({
  viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.8,
  strokeLinecap:'round', strokeLinejoin:'round'
}, p));

const Icon = {
  users:    (p)=>Svg({...p,children:[<path key="a" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>,<circle key="b" cx="9" cy="7" r="4"/>,<path key="c" d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>]}),
  calendar: (p)=>Svg({...p,children:[<rect key="a" x="3" y="4" width="18" height="18" rx="2"/>,<line key="b" x1="16" y1="2" x2="16" y2="6"/>,<line key="c" x1="8" y1="2" x2="8" y2="6"/>,<line key="d" x1="3" y1="10" x2="21" y2="10"/>]}),
  check:    (p)=>Svg({...p,children:[<path key="a" d="M9 11l3 3L22 4"/>,<path key="b" d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>]}),
  search:   (p)=>Svg({...p,children:[<circle key="a" cx="11" cy="11" r="8"/>,<line key="b" x1="21" y1="21" x2="16.65" y2="16.65"/>]}),
  box:      (p)=>Svg({...p,children:[<path key="a" d="M3 7l9-4 9 4v10l-9 4-9-4z"/>,<path key="b" d="M3 7l9 4 9-4"/>,<line key="c" x1="12" y1="11" x2="12" y2="21"/>]}),
  settings: (p)=>Svg({...p,children:[<circle key="a" cx="12" cy="12" r="3"/>,<path key="b" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>]}),
  back:     (p)=>Svg({...p,strokeWidth:2,children:[<polyline key="a" points="15 18 9 12 15 6"/>]}),
  plus:     (p)=>Svg({...p,strokeWidth:2,children:[<line key="a" x1="12" y1="5" x2="12" y2="19"/>,<line key="b" x1="5" y1="12" x2="19" y2="12"/>]}),
  fileText: (p)=>Svg({...p,strokeWidth:2,children:[<path key="a" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>,<polyline key="b" points="14 2 14 8 20 8"/>,<line key="c" x1="16" y1="13" x2="8" y2="13"/>,<line key="d" x1="16" y1="17" x2="8" y2="17"/>]}),
  zap:      (p)=>Svg({...p,strokeWidth:2,children:[<polygon key="a" points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>]}),
  refresh:  (p)=>Svg({...p,strokeWidth:2,children:[<polyline key="a" points="23 4 23 10 17 10"/>,<polyline key="b" points="1 20 1 14 7 14"/>,<path key="c" d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>]}),
  map:      (p)=>Svg({...p,children:[<path key="a" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>,<circle key="b" cx="12" cy="10" r="3"/>]}),
  phone:    (p)=>Svg({...p,children:[<path key="a" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>]}),
  info:     (p)=>Svg({...p,strokeWidth:2,children:[<circle key="a" cx="12" cy="12" r="10"/>,<line key="b" x1="12" y1="16" x2="12" y2="12"/>,<line key="c" x1="12" y1="8" x2="12.01" y2="8"/>]}),
  cloud:    (p)=>Svg({...p,strokeWidth:2,children:[<path key="a" d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>]}),
  // mood faces
  frown:(p)=>Svg({...p,children:[<circle key="a" cx="12" cy="12" r="9.5"/>,<path key="b" d="M8.5 16s1.3-2 3.5-2 3.5 2 3.5 2"/>,<line key="c" x1="9" y1="10" x2="9.01" y2="10"/>,<line key="d" x1="15" y1="10" x2="15.01" y2="10"/>]}),
  meh:  (p)=>Svg({...p,children:[<circle key="a" cx="12" cy="12" r="9.5"/>,<line key="b" x1="8.5" y1="15" x2="15.5" y2="15"/>,<line key="c" x1="9" y1="10" x2="9.01" y2="10"/>,<line key="d" x1="15" y1="10" x2="15.01" y2="10"/>]}),
  smile:(p)=>Svg({...p,children:[<circle key="a" cx="12" cy="12" r="9.5"/>,<path key="b" d="M8.5 14s1.3 2 3.5 2 3.5-2 3.5-2"/>,<line key="c" x1="9" y1="10" x2="9.01" y2="10"/>,<line key="d" x1="15" y1="10" x2="15.01" y2="10"/>]}),
  grin: (p)=>Svg({...p,children:[<circle key="a" cx="12" cy="12" r="9.5"/>,<path key="b" d="M8 13.5c0 2.2 1.8 3.6 4 3.6s4-1.4 4-3.6z"/>,<line key="c" x1="9" y1="10" x2="9.01" y2="10"/>,<line key="d" x1="15" y1="10" x2="15.01" y2="10"/>]}),
  duck: (p)=>React.createElement('svg',Object.assign({viewBox:'0 0 512 512'},p),[
    <path key="a" fillRule="evenodd" fill="currentColor" d="M150 122 L300 122 C356 122 394 154 394 192 C394 230 356 262 300 262 L210 262 L210 392 L150 392 Z M308 154 a34 34 0 1 0 0.1 0 Z"/>,
    <path key="b" fill="#EF9F27" d="M390 170 L460 164 Q474 190 460 214 L390 212 Z"/>]),
};
window.Icon = Icon;
