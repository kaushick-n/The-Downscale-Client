import SnapshotVault from './components/SnapshotVault';
import DemoControls from './components/DemoControls';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useAppContext} from './context/AppContext';
import './App.css';

const roles = {employee: 'Employee', manager: 'Team Lead', team_lead: 'Team Lead', admin: 'Chief Architect', chief_architect: 'Chief Architect'};
const navItems = [
  {id: 'overview', label: 'Overview', mark: '⌂'},
  {id: 'workspaces', label: 'Workspaces', mark: '▦'},
  {id: 'inbox', label: 'Inbox & Requests', mark: '✉'},
  {id: 'snapshots', label: 'Session History', mark: '◷'},
];

function timeParts(timezone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
}

function shiftRemaining(instance, timezone) {
  if (!instance) return null;
  if (instance.local_demo && instance.shift_active && instance.demo_shift_ends_at) {
    const seconds = Math.max(0, Math.ceil((Date.parse(instance.demo_shift_ends_at) - Date.now()) / 1000));
    return {active: seconds > 0, minutes: seconds / 60, seconds, endText: instance.shift_end};
  }
  const [startText, endText] = instance.shift
    ? instance.shift.split(' - ')
    : [instance.shift_start, instance.shift_end];
  if (!startText || !endText || startText === endText) return null;
  const local = timeParts(timezone);
  const current = Number(local.hour) * 60 + Number(local.minute) + Number(local.second) / 60;
  const [startHour, startMinute] = startText.split(':').map(Number);
  const [endHour, endMinute] = endText.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const active = start < end ? current >= start && current < end : current >= start || current < end;
  const minutes = active ? (end - current + 1440) % 1440 : null;
  return {active, minutes, seconds: minutes == null ? null : Math.max(0, Math.ceil(minutes * 60 - Number(local.second))), endText};
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(Math.floor(value / 60) % 60).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function formatAge(timestamp) {
  if (!timestamp) return 'Waiting for telemetry';
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 1000));
  return seconds < 60 ? `Updated ${seconds}s ago` : `Updated ${Math.floor(seconds / 60)}m ago`;
}

function Login({mode, setMode, busy, error, submit, userId, setUserId, name, setName, password, setPassword, invitation, setInvitation}) {
  return <main className="login-screen">
    <section className="login-card">
      <div className="login-brand"><span className="brand-mark">C</span><span>Corporate Tech Portal</span></div>
      <p className="eyebrow">Employee technology services</p>
      <h1>{mode === 'chief' ? 'Create your Chief Architect account' : mode === 'signup' ? 'Accept your workspace invitation' : 'Welcome back'}</h1>
      <p className="login-subtitle">Sign in to access your assigned development workspaces and support.</p>
      <nav className="login-mode" aria-label="Account access">
        {['signin', 'signup', 'chief'].map(value => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} onClick={() => setMode(value)}>
          {value === 'chief' ? 'Chief Architect setup' : value === 'signin' ? 'Sign in' : 'Invitation sign up'}
        </button>)}
      </nav>
      <form onSubmit={submit} className="login-form">
        {mode !== 'signin' && <label>Name<input required maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)}/></label>}
        <label>{mode === 'chief' ? 'Chief Architect ID' : 'Employee ID'}<input required maxLength={80} autoComplete="username" value={userId} onChange={event => setUserId(event.target.value)}/></label>
        <label>Password<input required type="password" minLength={mode !== 'signin' ? 12 : undefined} maxLength={mode !== 'signin' ? 128 : undefined} autoComplete={mode !== 'signin' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)}/></label>
        {mode === 'signup' && <label>Invitation code<input required autoComplete="off" value={invitation} onChange={event => setInvitation(event.target.value)}/></label>}
        {mode !== 'signin' && <p className="form-helper">{mode === 'chief' ? 'First Chief Architect account only. If one already exists, sign in instead.' : 'Use the single-use invitation provided by your Team Lead or Chief Architect.'}</p>}
        {error && <p role="alert" className="inline-error">{error}</p>}
        <button className="button button-primary login-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'chief' ? 'Create account' : mode === 'signup' ? 'Create employee account' : 'Sign in to workspace'}</button>
      </form>
      <p className="privacy-note">Your session is held in memory and cleared when you sign out.</p>
    </section>
  </main>;
}

function ResourceMetric({label, value, unit, percent, tone = ''}) {
  const available = value !== null && value !== undefined && Number.isFinite(Number(value));
  const width = Math.max(0, Math.min(100, Number(percent ?? (unit === '%' ? value : 0)) || 0));
  return <div className="metric-card">
    <div className="metric-head"><span>{label}</span><span className={tone}>{available ? `${Number(value).toLocaleString(undefined, {maximumFractionDigits: 1})}${unit}` : '—'}</span></div>
    <div className="metric-track" aria-hidden="true"><span style={{width: `${available ? width : 0}%`}}/></div>
    <p>{available ? (label === 'CPU' ? 'Cloud instance utilization' : 'CloudWatch Agent reading') : 'No live sample reported'}</p>
  </div>;
}

function TerminalPanel({instance, snapshot, telemetry, liveState, loading, connection, onRefresh}) {
  if (!instance) return <section className="panel terminal-panel"><div className="panel-title"><div><p className="eyebrow">Session stream</p><h2>Workspace terminal</h2></div></div><p className="empty-state">Choose an assigned workspace to view session details.</p></section>;
  const processTree = snapshot?.process_tree;
  return <section className="panel terminal-panel">
    <div className="panel-title"><div><p className="eyebrow">Session stream</p><h2>Workspace terminal</h2></div><div className="terminal-actions"><span className={`connection-indicator ${connection === 'Connected' ? 'is-live' : ''}`}>{connection === 'Connected' ? 'Synced live via WebSocket' : connection}</span><button type="button" className="terminal-refresh" onClick={onRefresh} disabled={loading || !['running', 'idle'].includes(instance.state)}>{loading ? 'Reading…' : 'Refresh live state'}</button></div></div>
    <div className="terminal-output" role="log" aria-live="polite">
      <p><span className="terminal-prompt">workspace$</span> session status --workspace {instance.id}</p>
      <p>state: <strong>{instance.state}</strong> · shift: {instance.shift}</p>
      <p>cpu: {telemetry?.cpu_percent ?? instance.cpu ?? '—'}{telemetry?.cpu_percent != null || instance.cpu != null ? '%' : ''} · memory: {telemetry?.memory_mb != null ? `${Number(telemetry.memory_mb).toLocaleString()} MB` : 'not reported'}</p>
      <p><span className="terminal-prompt">workspace$</span> checkpoint history --latest</p>
      {liveState?.available ? <>
        <p>connected tmux sessions: {liveState.tmux_sessions.length ? liveState.tmux_sessions.join(' · ') : 'none reported'}</p>
        <pre>{liveState.processes || 'No process list returned.'}</pre>
      </> : <p>Live process and tmux inspection is unavailable in this environment.</p>}
      {snapshot ? <>
        <p>last checkpoint: {snapshot.filename}</p>
        <p>saved tmux panes: {snapshot.tmux_panes ?? 'not recorded'} · restored RAM history: {liveState?.restored_ram_history_mb ?? snapshot.memory_footprint_mb ?? 'not recorded'}{liveState?.restored_ram_history_mb != null || snapshot.memory_footprint_mb != null ? ' MiB' : ''}</p>
        {!liveState?.available && processTree && <pre>{typeof processTree === 'string' ? processTree : JSON.stringify(processTree, null, 2)}</pre>}
      </> : <p>No checkpoint metadata is available for this workspace.</p>}
      <p className="terminal-cursor">_</p>
    </div>
    <p className="panel-footnote">Process and tmux details reflect the latest saved checkpoint. A live remote shell is not attached to this portal.</p>
  </section>;
}

function RequestModal({instances, selectedId, busy, onClose, onSubmit}) {
  const [requestType, setRequestType] = useState('overtime');
  const [instanceId, setInstanceId] = useState(selectedId || '');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault();
    setError('');
    try {
      await onSubmit({request_type: requestType, subject, details, instance_id: instanceId || null});
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  return <div className="modal-backdrop" onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="request-title">
      <header className="modal-heading"><div><p className="eyebrow">Employee support</p><h2 id="request-title">New Team Lead request</h2></div><button type="button" className="icon-button" aria-label="Close request form" onClick={onClose}>×</button></header>
      <form className="request-form" onSubmit={submit}>
        <label>Request type<select value={requestType} onChange={event => setRequestType(event.target.value)}><option value="overtime">Overtime approval</option><option value="storage">Storage expansion</option><option value="issue">Report an issue</option></select></label>
        <label>Related workspace<select value={instanceId} onChange={event => setInstanceId(event.target.value)}><option value="">No specific workspace</option>{instances.map(instance => <option key={instance.id} value={instance.id}>{instance.name}</option>)}</select></label>
        <label>Subject<input required minLength={4} maxLength={120} value={subject} onChange={event => setSubject(event.target.value)}/></label>
        <label>Details<textarea required minLength={10} maxLength={3000} rows="5" value={details} onChange={event => setDetails(event.target.value)} placeholder="Include timing, impact, or requested capacity."/></label>
        {error && <p role="alert" className="inline-error">{error}</p>}
        <footer className="modal-actions"><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>Send request</button></footer>
      </form>
    </section>
  </div>;
}

function EmployeeStation() {
  const {auth, setAuth, fleet: fleetData, request, refreshFleet, connection, telemetry, pingMs, backgroundError, setBackgroundError, inboxRevision, testPing, setTestPing} = useAppContext();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [invitation, setInvitation] = useState('');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('overview');
  const [inbox, setInbox] = useState({announcements: [], requests: []});
  const [inboxError, setInboxError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [runtimeNow, setRuntimeNow] = useState(Date.now());
  const [liveSessionState, setLiveSessionState] = useState(null);
  const [sessionStateBusy, setSessionStateBusy] = useState(false);

  useEffect(() => {
    if (auth) return;
    setActiveSession(null);
    setSelected('');
    setLiveSessionState(null);
  }, [auth]);

  const fleet = fleetData?.fleet || [];
  const owned = fleet;
  const isArchitect = ['admin', 'chief_architect'].includes(auth?.user.role);
  const selectedInstance = owned.find(instance => instance.id === selected) || owned.find(instance => instance.id === activeSession?.instance_id) || null;
  const activeTelemetry = telemetry.find(item => item.instance_id === selectedInstance?.id);
  const latestSnapshot = useMemo(() => {
    const snapshots = (fleetData?.snapshots || []).filter(item => item.instance_id === selectedInstance?.id);
    return snapshots.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''))[0] || null;
  }, [fleetData?.snapshots, selectedInstance?.id]);
  const shiftInfo = shiftRemaining(selectedInstance, fleetData?.timezone || 'UTC');
  const shiftActive = selectedInstance?.demo_enabled
    ? (selectedInstance.shift_active ?? shiftInfo?.active ?? false)
    : (shiftInfo?.active ?? selectedInstance?.shift_active ?? false);
  const statusText = selectedInstance?.state === 'isolated'
    ? 'QUARANTINED'
    : ['running', 'idle'].includes(selectedInstance?.state)
      ? shiftActive ? 'ONLINE · SHIFT ACTIVE' : 'ONLINE'
      : selectedInstance?.state === 'stopped' ? 'HIBERNATED' : (selectedInstance?.state || 'NO WORKSPACE').toUpperCase();

  const refreshInbox = useCallback(async () => {
    if (!auth) return;
    try {
      setInbox(await request('/api/employee/inbox'));
      setInboxError('');
    } catch (inboxRequestError) {
      setInboxError(inboxRequestError.message);
    }
  }, [auth, request]);

  useEffect(() => {
    if (!auth) return undefined;
    refreshInbox();
    const timer = setInterval(refreshInbox, 30000);
    return () => clearInterval(timer);
  }, [auth, refreshInbox, inboxRevision]);

  useEffect(() => {
    if (!auth) return undefined;
    const timer = setInterval(() => setRuntimeNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [auth]);

  useEffect(() => {
    if (!activeSession) return;
    const instance = fleet.find(item => item.id === activeSession.instance_id);
    if (!instance || !['running', 'idle'].includes(instance.state)) {
      setActiveSession(null);
      setNotice('The active workspace session ended.');
    }
  }, [fleet, activeSession]);

  useEffect(() => {
    setLiveSessionState(null);
  }, [selectedInstance?.id]);

  useEffect(() => {
    if (activeSession && selectedInstance?.id === activeSession.instance_id) refreshSessionState();
  }, [activeSession?.instance_id, selectedInstance?.id]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (!auth) {
        const data = await request(mode === 'chief' ? '/api/auth/signup/chief-architect' : mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
          user_id: userId.trim(), password,
          ...(mode !== 'signin' ? {name: name.trim()} : {}),
          ...(mode === 'signup' ? {invitation_token: invitation.trim()} : {}),
        }, null);
        const user = await request('/api/me', undefined, data.access_token);
        setAuth({access_token: data.access_token, user});
        setPassword('');
        setInvitation('');
        if (mode === 'chief') setNotice('Chief Architect account created. Sign in to the Admin Command Center to invite your team.');
        if (mode === 'signup') setNotice('Account created. Choose an assigned workspace to begin.');
      } else {
        await wakeSelectedWorkspace();
      }
    } catch (submitError) {
      setError(submitError.message || 'Unable to reach the workspace service.');
    } finally {
      setBusy(false);
    }
  }

  async function wakeSelectedWorkspace(workspaceId = selected) {
    const target = owned.find(instance => instance.id === workspaceId);
    if (!target) throw new Error('Select an assigned workspace.');
    if (target.state === 'isolated') throw new Error('This workspace is quarantined. Contact your Team Lead or Chief Architect.');
    if (activeSession && activeSession.instance_id !== target.id) {
      await request('/api/logout', {instance_id: activeSession.instance_id});
      setActiveSession(null);
    }
    try {
      await request('/api/instance/state', {instance_id: target.id, target_state: 'running'});
    } catch (wakeError) {
      if (wakeError.status === 403 && !/shift locked/i.test(wakeError.message)) {
        throw new Error(`${wakeError.message}. Check this workspace's assignment in the Admin Portal.`);
      }
      throw wakeError;
    }
    await refreshFleet();
    setActiveSession({instance_id: target.id, started_at: Date.now()});
    setSelected(target.id);
    setNotice(`Session ready for ${target.name}.`);
  }

  async function pauseWorkspace() {
    if (!activeSession) return;
    setBusy(true);
    setError('');
    try {
      await request('/api/instance/state', {instance_id: activeSession.instance_id, target_state: 'hibernated'});
      setActiveSession(null);
      await refreshFleet();
      await refreshInbox();
      setNotice('Workspace hibernated. Session state was saved when the lifecycle configuration supports snapshots.');
    } catch (pauseError) {
      setError(pauseError.status === 403 ? `${pauseError.message}. Check this workspace's assignment in the Admin Portal.` : pauseError.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSessionState() {
    if (!selectedInstance) return;
    setBusy(true);
    setError('');
    try {
      await request('/api/instance/state', {instance_id: selectedInstance.id, target_state: 'hibernated'});
      setActiveSession(null);
      await refreshFleet();
      setNotice('Session checkpoint request completed. Check Session history for saved metadata.');
    } catch (snapshotError) {
      setError(snapshotError.status === 403 ? `${snapshotError.message}. Check this workspace's assignment in the Admin Portal.` : snapshotError.message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshSessionState() {
    if (!selectedInstance) return;
    setSessionStateBusy(true);
    setError('');
    try {
      setLiveSessionState(await request(`/api/instance/session-state/${encodeURIComponent(selectedInstance.id)}`));
    } catch (inspectionError) {
      setError(inspectionError.message);
    } finally {
      setSessionStateBusy(false);
    }
  }

  async function applyDemo(body) {
    const result = await request('/api/instance/demo', body);
    await refreshFleet();
    await refreshInbox();
    return result;
  }

  async function createSupportRequest(body) {
    setBusy(true);
    setError('');
    try {
      await request('/api/support/requests', body);
      setRequestOpen(false);
      await refreshInbox();
      setNotice('Your request was sent to the Team Lead queue.');
    } finally {
      setBusy(false);
    }
  }

  async function decideRequest(requestId, status) {
    setBusy(true);
    setError('');
    try {
      await request(`/api/support/requests/${encodeURIComponent(requestId)}/decision`, {status});
      await refreshInbox();
      setNotice(`Request marked ${status.replace('_', ' ')}.`);
    } catch (decisionError) {
      setError(decisionError.message);
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    setAuth(null);
    setActiveSession(null);
    setSelected('');
    setPassword('');
    setNotice('');
    setError('');
  }

  if (!auth) return <Login {...{
    mode, setMode, busy, error, userId, setUserId, name, setName, password, setPassword,
    invitation, setInvitation,
  }} submit={submit}/>;

  const selectedSession = activeSession?.instance_id === selectedInstance?.id ? activeSession : null;
  const elapsed = selectedSession ? Math.floor((runtimeNow - selectedSession.started_at) / 1000) : null;
  const nav = <nav className="station-nav" aria-label="Employee station">
    {navItems.map(item => <button key={item.id} type="button" className={tab === item.id ? 'nav-item is-selected' : 'nav-item'} aria-current={tab === item.id ? 'page' : undefined} onClick={() => {setTab(item.id); if (item.id === 'inbox') refreshInbox();}}>
      <span className="nav-mark" aria-hidden="true">{item.mark}</span><span>{item.label}</span>
      {item.id === 'inbox' && inbox.announcements.length > 0 && <span className="nav-count">{inbox.announcements.length}</span>}
    </button>)}
  </nav>;

  return <div className="station-app">
    <aside className="sidebar">
      <a className="brand-lockup" href="#overview" onClick={event => {event.preventDefault(); setTab('overview');}}>
        <span className="brand-mark">C</span><span><strong>Corporate Tech Portal</strong><small>EMPLOYEE WORKSPACE</small></span>
      </a>
      <div className="sidebar-identity"><span className="avatar">{auth.user.name.slice(0, 1).toUpperCase()}</span><span><strong>{auth.user.name}</strong><small>{roles[auth.user.role] || auth.user.role} · {auth.user.team_id || 'Workspace'}</small></span></div>
      {nav}
      <div className="sidebar-workspace">
        <label htmlFor="workspace-switcher">Current workspace</label>
        <select id="workspace-switcher" aria-label="Your workspace" value={selected} onChange={event => setSelected(event.target.value)}>
          <option value="">Select workspace</option>
          {owned.map(instance => <option key={instance.id} value={instance.id}>{instance.name}</option>)}
        </select>
        {selectedInstance && <div className="sidebar-state"><span className={`status-dot state-${selectedInstance.state}`}/><span>{statusText}</span></div>}
        <p className="shift-caption">{selectedInstance?.shift || 'No workspace selected'} · {fleetData?.timezone || 'UTC'}</p>
        {shiftInfo?.active && <p className="shift-countdown">Shift ends in {formatDuration(shiftInfo.seconds)}</p>}
      </div>
      <div className="sidebar-bottom">
        <div className={`socket-status ${connection === 'Connected' ? 'connected' : ''}`}><span className="status-dot"/><span>Live connection: {connection}</span></div>
        <button className="signout-button" type="button" onClick={signOut}>Sign out</button>
      </div>
    </aside>

    <main className="station-main">
      <header className="topbar">
        <div><p className="eyebrow">Employee technology services</p><p className="breadcrumb">{navItems.find(item => item.id === tab)?.label}</p></div>
        <div className="topbar-actions">
          <span className={`header-shift-status ${shiftActive ? 'is-active' : ''}`}><span className="status-dot"/>{shiftActive ? 'SHIFT ACTIVE' : 'SHIFT INACTIVE'}</span>
          <span className="header-runtime">Active Runtime <strong className="mono">{elapsed == null ? '—' : formatDuration(elapsed)}</strong></span>
          <span className={`connection-pill ${connection === 'Connected' ? 'is-connected' : ''}`}><span className="status-dot"/>{connection}</span>
          <span className="topbar-profile"><span className="avatar">{auth.user.name.slice(0, 1).toUpperCase()}</span><span><strong>{auth.user.name}</strong><small>{roles[auth.user.role] || auth.user.role}</small></span></span>
          <button type="button" className="button" onClick={() => setRequestOpen(true)}>Contact IT</button>
        </div>
      </header>
      {(error || backgroundError || notice) && <div className={`station-banner ${error || backgroundError ? 'banner-error' : 'banner-success'}`} role={error || backgroundError ? 'alert' : 'status'}>
        <span>{error || backgroundError || notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => {setError(''); setBackgroundError(''); setNotice('');}}>×</button>
      </div>}
      {testPing && <div className="station-banner banner-success" role="status"><span>Admin test ping {testPing.id} received from {testPing.actor} at {testPing.receivedAt}.</span><button type="button" aria-label="Dismiss test ping" onClick={() => setTestPing(null)}>×</button></div>}

      {tab === 'overview' && <div className="page-content">
        <section className="welcome-row">
          <div><p className="eyebrow">Personal workspace</p><h1>Good day, {auth.user.name.split(' ')[0]}</h1><p>Your assigned compute, shift and session status in one place.</p></div>
          <div className={`status-chip ${selectedInstance?.state === 'isolated' ? 'chip-danger' : ['running', 'idle'].includes(selectedInstance?.state) ? 'chip-good' : 'chip-muted'}`}><span className="status-dot"/>{statusText}</div>
        </section>
        {fleetData && !owned.length && <section className="panel empty-workspaces"><h2>No workspaces returned</h2><p>{isArchitect ? 'The connected Demon server returned an empty fleet for this Chief Architect account. Check that the Admin Dashboard is connected to the same server.' : 'Ask your Team Lead or Chief Architect to assign a workspace to your account in the Admin Portal.'}</p></section>}
        {owned.length > 0 && <section className="workspace-quick-grid" aria-label="Assigned workspace cards">
          {owned.map(instance => <button key={instance.id} type="button" className={`panel workspace-quick-card ${selectedInstance?.id === instance.id ? 'is-selected' : ''}`} aria-pressed={selectedInstance?.id === instance.id} onClick={() => setSelected(instance.id)}>
            <span className={`status-tag tag-${instance.state}`}>{instance.state === 'isolated' ? 'QUARANTINED' : instance.state === 'stopped' ? 'HIBERNATED' : instance.state.toUpperCase()}</span>
            <strong>{instance.name}</strong>
            <span>{instance.type} · {instance.region}</span>
            <span>CPU {Number(instance.cpu || 0).toFixed(1)}% · Memory {Number(instance.memory_mb || 0).toLocaleString()} MB</span>
            <span>Shift {instance.shift}</span>
          </button>)}
        </section>}
        {selectedInstance && <section className="panel workspace-hero">
          <div className="workspace-hero-top">
            <div><p className="eyebrow">Selected environment</p><h2>{selectedInstance.name}</h2><p className="workspace-ref">{selectedInstance.id} <span>·</span> {selectedInstance.type}</p></div>
            <div className="hero-tags"><span className={`status-tag tag-${selectedInstance.state}`}>{selectedInstance.state === 'isolated' ? 'QUARANTINED' : selectedInstance.state.toUpperCase()}</span>{activeSession?.instance_id === selectedInstance.id && <span className="session-mode">{fleetData?.aws_lifecycle_enabled ? 'WORKSPACE ACTIVE' : 'DEV SANDBOX ACTIVE'}</span>}</div>
          </div>
          <div className="workspace-meta">
            <div><span>Machine type</span><strong>{selectedInstance.type || 'Not reported'}</strong><small>{selectedInstance.id}</small></div>
            <div><span>AWS region</span><strong>{selectedInstance.region || selectedInstance.aws_region || 'Not reported'}</strong><small>Instance configuration</small></div>
            <div><span>Private IP</span><strong>{selectedInstance.private_ip || selectedInstance.private_ip_address || 'Not reported'}</strong><small>Available when reported by the service</small></div>
            <div><span>Shift window</span><strong>{selectedInstance.shift}</strong><small>{fleetData?.timezone || 'UTC'}</small></div>
            <div><span>Shift status</span><strong>{shiftActive ? 'Active now' : 'Outside scheduled hours'}</strong><small>{shiftInfo?.active ? `Ends at ${shiftInfo.endText}` : 'Wake requests are checked by the server'}</small></div>
            <div><span>Session runtime</span><strong className="mono">{elapsed == null ? '—' : formatDuration(elapsed)}</strong><small>{activeSession ? 'This browser session' : 'No active portal session'}</small></div>
            <div><span>Workspace connection</span><strong>{['running', 'idle'].includes(selectedInstance.state) ? 'Available' : 'Paused'}</strong><small>Ping {pingMs == null ? '—' : `${pingMs} ms`}</small></div>
          </div>
          <div className="workspace-operations">
            <button type="button" className="button button-primary" aria-label="START / RESTORE" disabled={busy || selectedInstance.state === 'isolated' || activeSession?.instance_id === selectedInstance.id} onClick={() => {
              setBusy(true); setError('');
              wakeSelectedWorkspace().catch(wakeError => setError(wakeError.message)).finally(() => setBusy(false));
            }}>Request Shift Wake-Up</button>
            <button type="button" className="button" disabled={busy || !activeSession} onClick={pauseWorkspace}>Manual Pause / Hibernate</button>
            <button type="button" className="button button-secondary" disabled={busy || !['running', 'idle'].includes(selectedInstance.state)} onClick={saveSessionState}>Save Session State (CRIU Snapshot)</button>
          </div>
          {selectedInstance.state === 'isolated' && <p className="quarantine-note">This workspace is quarantined after an anomaly. Contact your Team Lead or Chief Architect for review.</p>}
        </section>}

        {selectedInstance && <section className="telemetry-grid" aria-label="Workspace telemetry">
          <ResourceMetric label="CPU" value={activeTelemetry?.cpu_percent ?? selectedInstance.cpu ?? null} unit="%" tone="metric-accent"/>
          <ResourceMetric label="Memory" value={activeTelemetry?.memory_mb ?? selectedInstance.memory_mb ?? null} unit=" MB" percent={activeTelemetry?.memory_percent ?? selectedInstance.memory_percent}/>
          <article className="metric-card metric-connection"><div className="metric-head"><span>Network round trip</span><strong>{pingMs == null ? '—' : `${pingMs} ms`}</strong></div><div className="metric-track"><span style={{width: pingMs == null ? '0%' : `${Math.max(5, Math.min(100, 100 - pingMs / 5))}%`}}/></div><p>{connection === 'Connected' ? 'Measured over the authenticated WebSocket' : 'Waiting for live connection'}</p></article>
          <p className="telemetry-age">{formatAge(activeTelemetry?.observed_at || selectedInstance.telemetry_updated_at)}</p>
        </section>}

        {selectedInstance && <TerminalPanel instance={selectedInstance} snapshot={latestSnapshot} telemetry={activeTelemetry} liveState={liveSessionState} loading={sessionStateBusy} connection={connection} onRefresh={refreshSessionState}/>}
        {fleetData?.demo_available && <details className="demo-disclosure" open><summary>Workspace simulation tools</summary><DemoControls instances={owned} timezone={fleetData.timezone || 'UTC'} onApply={applyDemo}/></details>}
        {fleetData && !fleetData.demo_available && <p className="environment-note">Simulation tools are disabled by this environment.</p>}
      </div>}

      {tab === 'workspaces' && <div className="page-content">
        <section className="page-heading"><div><p className="eyebrow">Assigned environments</p><h1>Your workspaces</h1><p>Switch environments from the selector or choose a workspace below.</p></div><button className="button button-primary" onClick={() => setRequestOpen(true)}>Request support</button></section>
        {!owned.length && <section className="panel empty-workspaces"><h2>{isArchitect ? 'No workspaces returned' : 'No assigned workspaces'}</h2><p>{isArchitect ? 'The connected Demon server returned an empty fleet for this Chief Architect account. Check that the Admin Dashboard is connected to the same server.' : 'Contact your Team Lead to request an environment.'}</p></section>}
        <div className="workspace-list">{owned.map(instance => <article className="panel workspace-list-card" key={instance.id}>
          <div className="list-card-main"><span className={`workspace-icon state-${instance.state}`}>⌘</span><div><h2>{instance.name}</h2><p>{instance.id} · {instance.type} · {instance.shift}</p></div><span className={`status-tag tag-${instance.state}`}>{instance.state === 'isolated' ? 'QUARANTINED' : instance.state.toUpperCase()}</span></div>
          <div className="list-card-stats"><span>CPU <strong>{instance.cpu ?? '—'}{instance.cpu == null ? '' : '%'}</strong></span><span>Memory <strong>{instance.memory_mb == null ? '—' : `${instance.memory_mb} MB`}</strong></span><span>Shift <strong>{instance.shift_active ? 'Active' : 'Scheduled'}</strong></span></div>
          <button type="button" className="button" onClick={() => {setSelected(instance.id); setTab('overview');}}>Select workspace</button>
        </article>)}</div>
      </div>}

      {tab === 'inbox' && <div className="page-content">
        <section className="page-heading"><div><p className="eyebrow">Company updates and helpdesk</p><h1>Inbox &amp; requests</h1><p>Announcements, shift notices and requests routed to your Team Lead.</p></div><button className="button button-primary" onClick={() => setRequestOpen(true)}>New request</button></section>
        {inboxError && <p role="alert" className="inline-error">{inboxError}</p>}
        <section className="panel inbox-panel"><div className="panel-title"><div><p className="eyebrow">Internal communications</p><h2>Announcements</h2></div><span className="quiet-label">{inbox.announcements.length} updates</span></div>
          {inbox.announcements.length ? <div className="announcement-list">{inbox.announcements.map(item => <article className="announcement-item" key={item.id}><span className={`announcement-icon announcement-${item.category}`}>{item.category === 'shift' ? '◷' : item.category === 'maintenance' ? '⚙' : '•'}</span><div><div className="announcement-title-line"><h3>{item.title}</h3><time>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</time></div><p>{item.body}</p><small>{item.category.replace('_', ' ')}</small></div></article>)}</div> : <p className="empty-state">No current announcements. Team notices and eligible shift alerts will appear here.</p>}
        </section>
        <section className="panel requests-panel"><div className="panel-title"><div><p className="eyebrow">IT helpdesk</p><h2>{['manager', 'team_lead', 'admin', 'chief_architect'].includes(auth.user.role) ? 'Team requests' : 'Your requests'}</h2></div><button className="button" onClick={() => setRequestOpen(true)}>Create request</button></div>
          {inbox.requests.length ? <div className="request-list">{inbox.requests.map(item => <article className="request-item" key={item.id}>
            <div className="request-main"><span className={`request-type type-${item.request_type}`}>{item.request_type.replace('_', ' ')}</span><h3>{item.subject}</h3><p>{item.details}</p><small>{item.owner_id} · {item.instance_id || 'No workspace'} · {new Date(item.created_at).toLocaleString()}</small>{item.response && <p className="request-response"><strong>Team Lead response:</strong> {item.response}</p>}</div>
            <div className="request-state"><span className={`ticket-status status-${item.status}`}>{item.status.replace('_', ' ')}</span>
              {['manager', 'team_lead', 'admin', 'chief_architect'].includes(auth.user.role) && item.status === 'open' && <div className="decision-actions"><button type="button" disabled={busy} onClick={() => decideRequest(item.id, item.request_type === 'overtime' ? 'approved' : 'in_progress')}>{item.request_type === 'overtime' ? 'Approve overtime' : 'Start review'}</button><button type="button" disabled={busy} onClick={() => decideRequest(item.id, 'rejected')}>Decline</button></div>}
            </div>
          </article>)}</div> : <p className="empty-state">No requests yet. Overtime, storage and issue requests will be routed to your Team Lead.</p>}
        </section>
      </div>}

      {tab === 'snapshots' && <div className="page-content">
        <section className="page-heading"><div><p className="eyebrow">Session continuity</p><h1>Session History</h1><p>Review saved checkpoint metadata and restore an assigned workspace.</p></div></section>
        {fleetData?.analytics && <section className="panel history-finops"><span>{fleetData.analytics.currency || 'USD'} current-state projection</span><strong>Total {fleetData.analytics.total_daily == null ? '—' : `$${fleetData.analytics.total_daily}`}/day</strong><small>Net savings ${fleetData.analytics.daily_savings ?? '—'}/day · Not billed usage</small></section>}
        {fleetData && <SnapshotVault snapshots={fleetData.snapshots || []} fleet={fleet} timezone={fleetData.timezone || 'UTC'} onRestore={id => {
          setSelected(id); setTab('overview'); setBusy(true); setError('');
          wakeSelectedWorkspace(id).catch(wakeError => setError(wakeError.message)).finally(() => setBusy(false));
        }} busy={busy}/>}
      </div>}

      <footer className="station-footer"><span>Corporate Tech Portal · Employee Workspace</span><span>Live rates and telemetry depend on backend and cloud-agent availability.</span></footer>
    </main>
    {requestOpen && <RequestModal instances={owned} selectedId={selectedInstance?.id} busy={busy} onClose={() => setRequestOpen(false)} onSubmit={createSupportRequest}/>}
  </div>;
}

export default function App() {
  return <EmployeeStation/>;
}
