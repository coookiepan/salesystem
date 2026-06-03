/* DUSKIN field-app UI kit — seed data (plain JS, attaches to window) */
window.DUSKIN_DATA = (function () {
  // status: bg / fg pairs (lifted from source SS_STYLE)
  const STATUS_STYLE = {
    '未拜訪': ['#F1EFE8', '#444441', '#6E6E66'],
    '初訪':   ['#E6F1FB', '#0C447C', '#2A6BB0'],
    '複訪':   ['#FAEEDA', '#633806', '#B5701A'],
    '試用中': ['#E6F1FB', '#0C447C', '#2A6BB0'],
    '報價':   ['#FAEEDA', '#633806', '#B5701A'],
    '將成約': ['#EEEDFE', '#3C3489', '#5B4FB0'],
    '已成約': ['#E1F5EE', '#085041', '#12A673'],
    '已轉交': ['#D4EDDA', '#155724', '#2E8B57'],
    '拒絕':   ['#FCEBEB', '#A32D2D', '#C94545'],
  };
  // distinct category hues (revised in the design system)
  const CAT_STYLE = {
    '拖把': '#B5701A', // mops — amber
    '地墊': '#0C447C', // mats — blue
    '芳香': '#085041', // fragrance — green
  };
  const STATUS_ORDER = ['未拜訪','初訪','複訪','試用中','報價','將成約','已成約','已轉交','拒絕'];

  const PRODUCTS = [
    { code:'NH-S',   cat:'拖把', desc:'紫色除塵抹布',          price:120, cycle:'2W' },
    { code:'SHH',    cat:'拖把', desc:'家庭用握把式抹布',      price:140, cycle:'4W' },
    { code:'LALA-R', cat:'拖把', desc:'LALA拖把',             price:190, cycle:'2W' },
    { code:'M-120',  cat:'拖把', desc:'業務用除塵超大拖把',    price:280, cycle:'2W' },
    { code:'DECSLR', cat:'地墊', desc:'中英歡迎地墊 SL 85x120', price:220, cycle:'2W' },
    { code:'DECLR',  cat:'地墊', desc:'中英歡迎地墊 L 85x150',  price:280, cycle:'2W' },
    { code:'DWLH',   cat:'地墊', desc:'吸塵吸水地墊 L',        price:390, cycle:'2W' },
    { code:'TJSR',   cat:'地墊', desc:'豪華地墊 S（紅）',       price:170, cycle:'2W' },
    { code:'DOME',   cat:'芳香', desc:'大型香水芳香劑 300ml',   price:220, cycle:'4W' },
    { code:'AFDW',   cat:'芳香', desc:'大型香水芳香機台 300ml', price:400, cycle:'4W' },
    { code:'FNWT',   cat:'芳香', desc:'Prime D氛香機 白 80ml',  price:350, cycle:'4W' },
  ];

  const INVENTORY = [
    { code:'NH-S',   cat:'拖把', stock:8,  std:12 },
    { code:'LALA-R', cat:'拖把', stock:3,  std:8 },
    { code:'M-120',  cat:'拖把', stock:5,  std:6 },
    { code:'DECSLR', cat:'地墊', stock:2,  std:10 },
    { code:'DECLR',  cat:'地墊', stock:11, std:10 },
    { code:'DWLH',   cat:'地墊', stock:6,  std:8 },
    { code:'DOME',   cat:'芳香', stock:14, std:12 },
    { code:'AFDW',   cat:'芳香', stock:1,  std:4 },
    { code:'FNWT',   cat:'芳香', stock:7,  std:6 },
  ];

  const CLIENTS = [
    { id:'c1', name:'陽光餐廳', addr:'中正區忠孝東路100號', contact:'王老闆', phone:'06-1234567',
      type:'餐廳', status:'試用中', nextdate:'2026-05-01', fw4:1620, env:'門口菜口飲料機',
      cats:['拖把','芳香'], visits:3,
      trial:[{code:'NH-S',desc:'紫色除塵抹布',price:120},{code:'DOME',desc:'大型香水芳香劑',price:220}],
      log:[{date:'2026-04-18',mood:3,note:'老闆對芳香機反應不錯，下次帶口味樣品。'},
           {date:'2026-04-04',mood:2,note:'初次試用除塵抹布，門口放一張。'}],
      todos:[{t:'補送 5 月報價單',done:false},{t:'帶 DOME 口味樣品',done:false}] },
    { id:'c2', name:'快樂補習班', addr:'大安區和平東路50號', contact:'李主任', phone:'02-27000111',
      type:'補習班', status:'報價', nextdate:'2026-04-28', fw4:480, env:'教室約十人大小',
      cats:['地墊'], visits:2,
      trial:[{code:'DECSLR',desc:'中英歡迎地墊 SL',price:220},{code:'DECLR',desc:'中英歡迎地墊 L',price:280}],
      log:[{date:'2026-04-15',mood:3,note:'主任要兩張地墊報價，已口頭報 9 折。'}],
      todos:[{t:'回覆地墊折扣',done:false}] },
    { id:'c3', name:'美美沙龍', addr:'信義區松仁路88號', contact:'陳小姐', phone:'02-87801234',
      type:'美容美甲', status:'已成約', nextdate:'2026-05-10', fw4:280, env:'店內裝潢精美',
      cats:['地墊','芳香'], visits:5,
      trial:[{code:'TJSR',desc:'豪華地墊 S（紅）',price:170},{code:'FNWT',desc:'Prime D氛香機',price:350}],
      log:[{date:'2026-04-20',mood:4,note:'正式成約！兩週一換，客戶很滿意香氛。'},
           {date:'2026-04-06',mood:3,note:'換豪華紅地墊，質感符合店面。'}],
      todos:[{t:'首次配送排程',done:true}] },
    { id:'c4', name:'永和早餐店', addr:'永和區中正路200號', contact:'', phone:'',
      type:'餐廳', status:'未拜訪', nextdate:'', fw4:0, env:'',
      cats:[], visits:0, trial:[], log:[], todos:[] },
    { id:'c5', name:'大樓管委會', addr:'板橋區文化路300號', contact:'張經理', phone:'02-29551200',
      type:'接待中心', status:'複訪', nextdate:'2026-04-20', fw4:0, env:'門口有舊地墊',
      cats:['地墊'], visits:1,
      trial:[], log:[{date:'2026-04-10',mood:2,note:'門口舊地墊待換，經理需開會討論。'}],
      todos:[{t:'下次帶 DECLR 樣品',done:false}] },
    { id:'c6', name:'精密工廠', addr:'中壢區工業路500號', contact:'', phone:'03-4521000',
      type:'工廠', status:'拒絕', nextdate:'', fw4:0, env:'門口無',
      cats:[], visits:1, trial:[], log:[{date:'2026-03-28',mood:1,note:'目前沒有需求，婉拒。'}], todos:[] },
  ];

  const MOODS = ['frown','frown','meh','smile','grin']; // index 1..4 used

  return { STATUS_STYLE, CAT_STYLE, STATUS_ORDER, PRODUCTS, INVENTORY, CLIENTS, MOODS };
})();
