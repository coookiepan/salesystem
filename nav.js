/* ═══ 全域底部導覽（四頁共用，與 tokens.css 同級的共用檔） ═══
   使用：<script src="nav.js" data-page="home|clients|trip|site|iz"></script>
   - 五格固定：首頁／客戶／行程／工地／工業區，走到哪都一樣（單色線條圖示，無 emoji）
   - 在主系統內點「客戶/行程」走頁內切換（不重載）；其他頁用連結
   - index.html 可呼叫 window.setGlobalTab('clients'|'trip') 動態更新高亮 */
(function(){
  var PAGE=(document.currentScript&&document.currentScript.dataset.page)||'home';
  var IC={
    home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    clients:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    trip:'<circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/>',
    site:'<path d="M2 20h20"/><path d="M4 20V9l6-4v15"/><path d="M10 9h6l4 4v7"/><line x1="13" y1="13" x2="13" y2="13.01"/><line x1="16" y1="16" x2="16" y2="16.01"/>',
    iz:'<path d="M2 20h20"/><path d="M4 20V8l5 3V8l5 3V8l5 3v9"/><line x1="17" y1="20" x2="17" y2="16"/><line x1="7" y1="20" x2="7" y2="16"/><line x1="12" y1="20" x2="12" y2="16"/>'
  };
  var TABS=[
    {id:'home',    label:'首頁',   href:'home.html'},
    {id:'clients', label:'客戶',   href:'index.html#clients'},
    {id:'trip',    label:'行程',   href:'index.html#trip'},
    {id:'site',    label:'工地',   href:'sitemap.html'},
    {id:'iz',      label:'工業區', href:'izcrm.html'}
  ];
  function build(){
    var nav=document.createElement('nav');
    nav.id='global-nav';
    nav.setAttribute('aria-label','系統切換');
    nav.innerHTML=TABS.map(function(t){
      return '<a href="'+t.href+'" data-tab="'+t.id+'" class="gn-btn'+(t.id===PAGE?' on':'')+'">'+
        '<svg aria-hidden="true" viewBox="0 0 24 24">'+IC[t.id]+'</svg>'+t.label+'</a>';
    }).join('');
    // 主系統頁內：客戶/行程 直接切分頁，不重載
    nav.addEventListener('click',function(e){
      var a=e.target.closest?e.target.closest('a'):null;
      if(!a)return;
      var tab=a.dataset.tab;
      if((tab==='clients'||tab==='trip')&&typeof window.navTo==='function'){
        e.preventDefault();
        if(tab==='trip'){window.navTo('todos',document.getElementById('nav-todos'));if(typeof window.setTodosMode==='function')window.setTodosMode('trip');}
        else{window.navTo('clients',document.getElementById('nav-clients'));}
        setTab(tab);
      }
    });
    var css=document.createElement('style');
    css.textContent=
      '#global-nav{position:fixed;bottom:0;left:0;right:0;z-index:120;background:var(--bg);border-top:1px solid var(--border);display:flex;padding-bottom:env(safe-area-inset-bottom)}'+
      '#global-nav .gn-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px 7px;font-size:10.5px;font-weight:500;color:var(--text3);text-decoration:none;font-family:inherit;letter-spacing:.01em}'+
      '#global-nav .gn-btn.on{color:var(--text)}'+
      '#global-nav .gn-btn.on svg{color:var(--green)}'+
      '#global-nav .gn-btn:active{background:var(--bg2)}'+
      '#global-nav svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'+
      'body{padding-bottom:calc(64px + env(safe-area-inset-bottom))}';
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
