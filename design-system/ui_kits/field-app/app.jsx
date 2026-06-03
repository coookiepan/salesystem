/* DUSKIN field-app UI kit — app shell */
function App() {
  const [tab, setTab] = React.useState('clients');
  const [view, setView] = React.useState({ name: 'list' }); // list | detail | form
  const [clients, setClients] = React.useState(() => JSON.parse(JSON.stringify(window.DUSKIN_DATA.CLIENTS)));
  const [inventory, setInventory] = React.useState(() => JSON.parse(JSON.stringify(window.DUSKIN_DATA.INVENTORY)));

  const nav = (t) => { setTab(t); setView({ name: 'list' }); };

  const openClient = (c) => setView({ name: 'detail', id: c.id });
  const back = () => setView({ name: 'list' });

  const toggleTodo = (cid, idx) => setClients(cs => cs.map(c =>
    c.id === cid ? { ...c, todos: c.todos.map((t, i) => i === idx ? { ...t, done: !t.done } : t) } : c));

  const addVisit = (cid, mood, note) => setClients(cs => cs.map(c =>
    c.id === cid ? { ...c, visits: c.visits + 1, log: [{ date: '2026-04-20', mood, note }, ...c.log] } : c));

  const saveClient = (f) => {
    const c = { id: 'c' + Date.now(), name: f.name, addr: f.addr, contact: f.contact, phone: f.phone,
      type: f.type, status: f.status, nextdate: f.nextdate, fw4: 0, env: '', cats: [], visits: 0, trial: [], log: [], todos: [] };
    setClients(cs => [c, ...cs]);
    setView({ name: 'list' });
  };

  const invStep = (code, d) => setInventory(inv => inv.map(i =>
    i.code === code ? { ...i, stock: Math.max(0, i.stock + d) } : i));

  let body;
  if (tab === 'clients') {
    if (view.name === 'form') body = <ClientForm onBack={back} onSave={saveClient} />;
    else if (view.name === 'detail') {
      const c = clients.find(x => x.id === view.id);
      body = c ? <ClientDetail client={c} onBack={back} onToggleTodo={toggleTodo} onAddVisit={addVisit} />
               : <ClientList clients={clients} onOpen={openClient} onAdd={() => setView({ name: 'form' })} />;
    } else body = <ClientList clients={clients} onOpen={openClient} onAdd={() => setView({ name: 'form' })} />;
  }
  else if (tab === 'daily') body = <DailyReport clients={clients} />;
  else if (tab === 'todos') body = <Todos clients={clients} onToggleTodo={toggleTodo} />;
  else if (tab === 'shops') body = <Shops />;
  else if (tab === 'inventory') body = <Inventory inventory={inventory} onStep={invStep} />;
  else if (tab === 'settings') body = <Settings />;

  const showAppBar = !(tab === 'clients' && view.name !== 'list');

  return (
    <div className="phone">
      <StatusBar />
      {showAppBar && <AppBar title="DUSKIN" />}
      {body}
      <BottomNav tab={tab} onNav={nav} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
