import { useEffect, useRef, useState } from 'react';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const roles = { employee: 'Employee', manager: 'Team Lead', admin: 'Chief Architect' };
const field = 'w-full bg-slate-950 border border-slate-600 rounded p-2 text-sm';
const button = 'rounded px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold';

export default function App() {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [invitation, setInvitation] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [auth, setAuth] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [session, setSession] = useState(null);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState('Connecting');
  const active = useRef(null);
  const lifecycle = useRef(0);

  function endSession() {
    active.current = null;
    setSession(null);
  }

  async function request(path, token, body) {
    const response = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) {
        setAuth(null);
        setFleet(null);
        endSession();
      }
      const detail = Array.isArray(data.detail)
        ? data.detail.map(item => `${(item.loc || []).filter(part => part !== 'body').join('.')}: ${item.msg}`).join('; ')
        : data.detail;
      throw new Error(typeof detail === 'string' ? detail : data.reason || `Request failed (${response.status})`);
    }
    return data;
  }

  useEffect(() => {
    if (!auth) return;
    let disposed = false;
    let socket;
    let retry;
    let version = 0;
    let delay = 1000;
    async function refresh() {
      const current = ++version;
      const revision = lifecycle.current;
      try {
        const data = await request('/api/instances', auth.access_token);
        if (disposed || current !== version || revision !== lifecycle.current) return;
        setFleet(data);
        if (active.current && !data.fleet.some(i => i.id === active.current && ['running', 'idle'].includes(i.state))) {
          endSession();
          setNotice('Your workspace session has ended.');
        }
      } catch (err) {
        if (!disposed) setError(err.message);
      }
    }
    function connect() {
      if (disposed) return;
      setConnection('Connecting');
      socket = new WebSocket(`${API.replace(/^http/, 'ws')}/ws/fleet`);
      socket.onopen = () => {
        if (disposed) return;
        delay = 1000;
        socket.send(JSON.stringify({ token: auth.access_token }));
        setConnection('Connected');
        refresh();
      };
      socket.onmessage = event => {
        if (disposed) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'SESSION_TERMINATED' && message.instance_id === active.current) {
          endSession();
          setNotice('Your workspace was hibernated or stopped. Its session has ended.');
        }
        if (['FLEET_UPDATED', 'SESSION_TERMINATED'].includes(message.type)) refresh();
      };
      socket.onclose = event => {
        if (disposed) return;
        if (event.code === 4401) {
          setAuth(null);
          setFleet(null);
          endSession();
          setError('Authentication expired. Please sign in again.');
          return;
        }
        setConnection('Disconnected — retrying');
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      };
      socket.onerror = () => socket.close();
    }
    refresh();
    connect();
    window.addEventListener('focus', refresh);
    return () => { disposed = true; clearTimeout(retry); socket?.close(); window.removeEventListener('focus', refresh); };
  }, [auth]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!auth) {
        const data = await request(mode === 'chief' ? '/api/auth/signup/chief-architect' : mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', null, {
          user_id: userId.trim(), password,
          ...(mode !== 'signin' ? { name: name.trim() } : {}),
          ...(mode === 'signup' ? { invitation_token: invitation.trim() } : {}),
        });
        const user = await request('/api/me', data.access_token);
        setAuth({ access_token: data.access_token, user });
        setPassword('');
        setInvitation('');
        if (mode === 'chief') setNotice('Chief Architect account created. Sign in to the Admin Command Center with these credentials to invite your team.');
        if (mode === 'signup') setNotice('Account created. Select a workspace to start or restore it.');
      } else {
        const workspace = fleet.fleet.find(i => i.id === selected && i.owner === auth.user.id);
        if (!workspace) throw new Error('Select an allocated workspace.');
        await request('/api/instance/state', auth.access_token, { instance_id: selected, target_state: 'running' });
        lifecycle.current += 1;
        active.current = workspace.id;
        setSession({ instance_id: workspace.id, instance_name: workspace.name, shift: workspace.shift });
        const latest = await request('/api/instances', auth.access_token);
        setFleet(latest);
        if (!latest.fleet.some(i => i.id === workspace.id && ['running', 'idle'].includes(i.state))) {
          endSession();
          setNotice('Your workspace session has ended.');
        }
      }
    } catch (err) { setError(err.message || 'Unable to reach the local backend.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await request('/api/logout', auth.access_token, { instance_id: session.instance_id });
      endSession();
      setFleet(await request('/api/instances', auth.access_token));
      setNotice('Workspace hibernated. Retained snapshots remain available.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const owned = fleet?.fleet.filter(i => i.owner === auth?.user.id) || [];
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-mono flex items-center justify-center p-6">
      <section className="bg-slate-800 border border-slate-600 p-6 rounded-lg w-full max-w-3xl space-y-5 shadow-xl">
        <h1 className="text-xl font-bold text-red-400">EMPLOYEE WORKSPACE PORTAL</h1>
        {error && <p role="alert" className="text-red-300">{error}</p>}
        {notice && <p role="status" className="text-emerald-300">{notice}</p>}
        {!auth ? (
          <form onSubmit={submit} className="space-y-4">
            <nav aria-label="Account access" className="flex flex-wrap gap-4">{['signin', 'signup', 'chief'].map(value => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} className={mode === value ? 'text-red-400 underline' : 'text-slate-300'} onClick={() => { setMode(value); setError(''); setPassword(''); }}>{value === 'chief' ? 'Chief Architect Sign Up' : value === 'signin' ? 'Sign In' : 'Sign Up'}</button>)}</nav>
            <p className="text-sm text-slate-400">{mode === 'chief' ? 'Create the first Chief Architect account. No invitation code is required. If an administrator already exists, use Sign In.' : mode === 'signup' ? 'Use the invitation from your Team Lead or Chief Architect.' : 'Sign in to view your allocated workspaces.'}</p>
            {mode !== 'signin' && <label className="block">Name<input required maxLength={80} autoComplete="name" className={field} value={name} onChange={e => setName(e.target.value)} /></label>}
            <label className="block">{mode === 'chief' ? 'Chief Architect ID' : 'Employee ID'}<input required maxLength={80} autoComplete="username" className={field} value={userId} onChange={e => setUserId(e.target.value)} /></label>
            <label className="block">Password<input required type="password" minLength={mode !== 'signin' ? 12 : undefined} maxLength={mode !== 'signin' ? 128 : undefined} autoComplete={mode !== 'signin' ? 'new-password' : 'current-password'} className={field} value={password} onChange={e => setPassword(e.target.value)} /></label>
            {mode === "signup" && <label className="block">Invitation code<input required autoComplete="off" className={field} value={invitation} onChange={e => setInvitation(e.target.value)} /></label>}
            <button disabled={busy} className={button}>{busy ? "Please wait..." : mode === "chief" ? "CREATE CHIEF ARCHITECT ACCOUNT" : mode === "signup" ? "SIGN UP" : "SIGN IN"}</button>
          </form>
        ) : <>
          <div className="text-sm text-slate-300">{auth.user.name} ({auth.user.id}) · {roles[auth.user.role] || auth.user.role}<p className="text-xs mt-2">Fleet updates: {connection}</p></div>
          {session ? <div className="space-y-3 border border-emerald-600 p-4">
            <h2 className="text-emerald-400 font-bold">DEV SANDBOX ACTIVE</h2>
            <p>{session.instance_name} ({session.instance_id})</p>
            <p>Shift: {session.shift} · Asia/Kolkata</p>
            <button onClick={logout} disabled={busy} className={button}>LOGOUT & HIBERNATE</button>
          </div> : <form onSubmit={submit} className="space-y-3">
            <label className="block">Your workspace<select required className={field} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select workspace</option>{owned.map(i => <option key={i.id} value={i.id}>{i.name} · {i.state} · {i.shift}</option>)}</select></label>
            {fleet && !owned.length && <p className="text-sm text-slate-400">{auth.user.role === 'admin' ? 'Manage invitations and provision workspaces in the Admin Command Center.' : 'No owned workspaces. Ask your Team Lead or Chief Architect to provision one.'}</p>}
            <p className="text-xs text-slate-400">The server enforces authorized shifts, including overnight shifts. Backend timezone: Asia/Kolkata in Compose; UTC by default.</p>
            <button disabled={busy || !owned.some(i => i.id === selected)} className={button}>START / RESTORE</button>
            <button type="button" disabled={busy} className="ml-3 text-sm underline" onClick={() => { setAuth(null); setFleet(null); setPassword(''); setSelected(''); setNotice(''); }}>Sign out of portal</button>
          </form>}
          {fleet && <>
            <h2 className="font-bold">Authorized fleet</h2>
            <ul className="space-y-2 text-sm">{fleet.fleet.map(i => <li key={i.id} className="p-3 bg-slate-950 rounded">{i.name} · {i.id} · {i.state}<p className="text-slate-400">{i.owner} · {i.type} · {i.shift}</p>{i.anomaly && <p className="text-red-300">Off-Hours Threat</p>}</li>)}</ul>
            <p className="text-xs text-slate-400">{fleet.analytics.currency || "USD"} current-state projections: compute ${fleet.analytics.compute_hourly}/hour | compute ${fleet.analytics.compute_daily}/day | snapshots ${fleet.analytics.snapshot_monthly}/month | total ${fleet.analytics.total_daily}/day | net savings ${fleet.analytics.daily_savings}/day. Billing basis: {fleet.analytics.billing_basis}.</p>
            <details className="text-sm"><summary>Retained snapshots ({fleet.snapshots.length})</summary><p className="text-xs text-slate-400 my-2">CRIU is simulated. Snapshots persist after restore and continue to incur storage charges.</p><ul>{fleet.snapshots.map(s => <li key={s.id} className="break-all">{s.filename} · {s.size_mb} MiB</li>)}</ul></details>
          </>}
        </>}
      </section>
    </main>
  );
}
