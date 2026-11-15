/* ═══ 全域底部導覽（主系統與工地地圖共用，與 tokens.css 同級的共用檔） ═══
   使用：<script src="nav.js" data-page="main|site"></script>
   - 三格固定：待辦／客戶／工地，走到哪都一樣（單色線條圖示，無 emoji）
   - 在主系統內點「待辦/客戶」走頁內切換（不重載）；其他頁用連結
   - index.html 的 navTo() 會呼叫 window.setGlobalTab(分頁 id) 更新高亮
     （待辦、客戶以外的分頁——日報、查詢、庫存、設定——底部不亮任何一格） */
(function(){
  var PAGE=(document.currentScript&&document.currentScript.dataset.page)||'main';
  var IC={
    todos:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    clients:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    site:'<path d="M2 20h20"/><path d="M4 20V9l6-4v15"/><path d="M10 9h6l4 4v7"/><line x1="13" y1="13" x2="13" y2="13.01"/><line x1="16" y1="16" x2="16" y2="16.01"/>'
  };
  var TABS=[
    {id:'todos',   label:'待辦', href:'index.html'},
    {id:'clients', label:'客戶', href:'index.html#clients'},
    {id:'site',    label:'工地', href:'sitemap.html'}
  ];
  // 主系統：亮的是目前開著的分頁（nav.js 是 defer，載入時主系統已依網址決定好分頁）
  function current(){
    if(PAGE!=='main')return PAGE;
    var p=document.querySelector('.panel.on');
    return p?p.id.replace('panel-',''):'todos';
  }
  function build(){
    var cur=current();
    var nav=document.createElement('nav');
    nav.id='global-nav';
    nav.setAttribute('aria-label','系統切換');
    nav.innerHTML=TABS.map(function(t){
      return '<a href="'+t.href+'" data-tab="'+t.id+'" class="gn-btn'+(t.id===cur?' on':'')+'">'+
        '<svg aria-hidden="true" viewBox="0 0 24 24">'+IC[t.id]+'</svg>'+t.label+'</a>';
    }).join('');
    // 主系統頁內：待辦/客戶 直接切分頁，不重載（navTo 會順手更新高亮）
    nav.addEventListener('click',function(e){
      var a=e.target.closest?e.target.closest('a'):null;
      if(!a)return;
      var tab=a.dataset.tab;
      if((tab==='todos'||tab==='clients')&&PAGE==='main'&&typeof window.navTo==='function'){ // 只在主系統做頁內切換；其他頁走連結
        e.preventDefault();
        window.navTo(tab,document.getElementById('nav-'+tab));
      }
    });
    var css=document.createElement('style');
    css.textContent=
      '#global-nav{position:fixed;bottom:0;left:0;right:0;z-index:120;background:var(--bg);border-top:1px solid var(--border);display:flex;padding-bottom:env(safe-area-inset-bottom)}'+
      '#global-nav .gn-btn{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:60px;padding:8px 2px 7px;font-size:11px;font-weight:600;color:var(--text3);text-decoration:none;font-family:inherit;letter-spacing:.01em}'+
      '#global-nav .gn-btn.on{color:var(--text)}'+
      // 作用中的分頁：上緣一條綠色標記（顏色之外多一個形狀線索）
      '#global-nav .gn-btn.on::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:26px;height:2px;background:var(--green)}'+
      '#global-nav .gn-btn.on svg{color:var(--green)}'+
      '#global-nav .gn-btn:active{background:var(--surface-hover)}'+
      '#global-nav .gn-btn:focus-visible{outline:2px solid var(--green);outline-offset:-2px}'+
      '#global-nav svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
      'body{padding-bottom:calc(68px + env(safe-area-inset-bottom))}';
    document.head.appendChild(css);
    document.body.appendChild(nav);
  }
  function setTab(id){
    var nav=document.getElementById('global-nav');if(!nav)return;
    nav.querySelectorAll('.gn-btn').forEach(function(b){b.classList.toggle('on',b.dataset.tab===id);});
  }
  window.setGlobalTab=setTab;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);
  else build();
})();
