import {useEffect, useState} from 'react';
import './DemoControls.css';

export default function DemoControls({instances, onApply, timezone = 'UTC'}) {
  const [selected, setSelected] = useState('');
  const instance = instances.find(i => i.id === selected) || instances[0];
  const [clock, setClock] = useState('');
  const [cpu, setCpu] = useState(4.2);
  const [activity, setActivity] = useState('running');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setClock(instance?.demo_time?.slice(0,16) || '');
    setCpu(instance?.cpu || 0);
    setActivity(instance?.state === 'idle' ? 'idle' : 'running');
    setFeedback(''); setError('');
  }, [instance?.id, instance?.demo_enabled, instance?.demo_time]);
  if (!instance) return null;
  const enabled = !!instance.demo_enabled;
  const apply = async (nextEnabled = enabled, evaluate = false) => {
    setBusy(true); setError(''); setFeedback('');
    try {
      const result = await onApply({instance_id: instance.id, enabled: nextEnabled,
        simulated_time: nextEnabled && clock ? clock : null, cpu: Number(cpu), activity, evaluate_now: evaluate});
      setFeedback(result.outcome);
    } catch (err) {setError(err.message);} finally {setBusy(false);}
  };
  const presetClock = time => {
    const date = clock.slice(0,10) || new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
    setClock(`${date}T${time}`);
  };
  return <section className="demo-panel" aria-label="Demo controls">
    <header><div><h2>Demo controls</h2><p>Test a shift or CPU scenario without waiting.</p></div><span className="demo-badge">{enabled ? 'DEMO ACTIVE' : 'REAL CLOCK'}</span></header>
    <label>Workspace<select value={instance.id} disabled={busy} onChange={e => setSelected(e.target.value)}>{instances.map(i => <option value={i.id} key={i.id}>{i.name}</option>)}</select></label>
    <label className="demo-toggle"><input type="checkbox" role="switch" checked={enabled} disabled={busy} onChange={e => apply(e.target.checked)}/>Enable demo for this workspace</label>
    <p className="demo-help">Settings are shared with the command center and remain active until disabled. Other workspaces and account expiry keep their own clocks. Disabling demo rechecks the real shift and may hibernate this workspace.</p>
    {enabled && <form onSubmit={e => {e.preventDefault(); apply(true);}}>
      <fieldset disabled={busy}>
        <div className="demo-fields">
          <label>Demo date and time ({timezone})<input type="datetime-local" value={clock} onChange={e => setClock(e.target.value)}/><span className="demo-help">Fixed simulation time. Leave blank to use the real clock.</span></label>
          <label>CPU usage (%)<input type="number" min="0" max="100" step="0.1" required value={cpu} onChange={e => setCpu(e.target.value)}/></label>
          <label>Activity<select value={activity} onChange={e => setActivity(e.target.value)}><option value="running">Running</option><option value="idle">Idle (still powered on)</option></select></label>
        </div>
        <div className="demo-presets"><button type="button" onClick={() => presetClock(instance.shift_start)}>Use shift start</button><button type="button" onClick={() => presetClock(instance.shift_end)}>Use shift end</button><button type="button" onClick={() => {setCpu(99.8); setActivity('running');}}>CPU spike</button><button type="button" onClick={() => {setCpu(0); setActivity('idle');}}>Idle activity</button></div>
        <p className="demo-help">CPU and activity apply to a powered-on workspace. Use Start / Restore after setting an in-shift time to wake it. CPU at 90% or above outside shift flags an anomaly. Idle remains billable; the current cutoff rule uses shift hours, not a CPU threshold.</p>
        <div className="demo-actions"><button type="submit">Apply settings</button><button type="button" onClick={() => apply(true, true)}>Apply &amp; evaluate now</button></div>
        <p className="demo-help">Evaluate now runs the shift check immediately. Outside-shift running workspaces hibernate and create a snapshot; the regular scheduler also checks every 30 seconds. Exempt/snoozed workspaces bypass the cutoff.</p>
      </fieldset>
    </form>}
    {feedback && <p className="demo-feedback" role="status">{feedback}</p>}
    {error && <p className="demo-error" role="alert">{error}</p>}
  </section>;
}
