import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';

const API = (
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  'http://3.27.211.126:8000'
).replace(/\/$/, '');

const AppContext = createContext(null);

export function AppProvider({children}) {
  const [auth, setAuth] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [connection, setConnection] = useState('Disconnected');
  const [telemetry, setTelemetry] = useState([]);
  const [pingMs, setPingMs] = useState(null);
  const [backgroundError, setBackgroundError] = useState('');
  const [inbox, setInbox] = useState({announcements: [], requests: []});
  const [inboxRevision, setInboxRevision] = useState(0);
  const socketRef = useRef(null);
  const authRef = useRef(auth);
  const inboxRef = useRef(inbox);
  authRef.current = auth;
  inboxRef.current = inbox;

  const request = useCallback(async (path, body, token = auth?.access_token) => {
    const response = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(token ? {Authorization: `Bearer ${token}`} : {}),
        ...(body === undefined ? {} : {'Content-Type': 'application/json'}),
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && token) {
        setAuth(null);
        setFleet(null);
        setTelemetry([]);
      }
      const detail = Array.isArray(data.detail)
        ? data.detail.map(item => `${(item.loc || []).filter(part => part !== 'body').join('.')}: ${item.msg}`).join('; ')
        : data.detail;
      throw new Error(typeof detail === 'string' ? detail : data.reason || `Request failed (${response.status})`);
    }
    return data;
  }, [auth?.access_token]);

  const refreshFleet = useCallback(async () => {
    if (!authRef.current) return null;
    const data = await request('/api/instances', undefined, authRef.current.access_token);
    setFleet(data);
    setBackgroundError('');
    setTelemetry(previous => {
      const byId = new Map(previous.map(item => [item.instance_id, item]));
      return data.fleet.map(instance => ({
        instance_id: instance.id,
        state: instance.state,
        cpu_percent: instance.cpu,
        memory_mb: instance.memory_mb ?? null,
        memory_percent: instance.memory_percent ?? null,
        observed_at: instance.telemetry_updated_at ?? null,
        ...byId.get(instance.id),
      }));
    });
    return data;
  }, [request]);

  useEffect(() => {
    if (!auth) {
      setFleet(null);
      setTelemetry([]);
      setConnection('Disconnected');
      setBackgroundError('');
      socketRef.current?.close();
      socketRef.current = null;
      return undefined;
    }
    let disposed = false;
    let socket;
    let retry;
    let pingTimer;
    let delay = 1000;
    let requestSequence = 0;
    const refresh = () => refreshFleet().catch(error => {
      if (!disposed) setBackgroundError(error.message);
    });
    const connect = () => {
      if (disposed) return;
      setConnection('Connecting');
      socket = new WebSocket(`${API.replace(/^http/, 'ws')}/ws/fleet`);
      socketRef.current = socket;
      socket.onopen = () => {
        if (disposed) return;
        delay = 1000;
        socket.send(JSON.stringify({token: auth.access_token}));
        setConnection('Connected');
        refresh();
        pingTimer = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const sentAt = Date.now();
          requestSequence = sentAt;
          socket.send(JSON.stringify({type: 'PING', sent_at: sentAt}));
        }, 15000);
      };
      socket.onmessage = event => {
        if (disposed) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'PONG' && message.sent_at === requestSequence) {
          setPingMs(Math.max(0, Date.now() - message.sent_at));
        }
        if (Array.isArray(message.telemetry)) setTelemetry(message.telemetry);
        if (['SUPPORT_REQUEST_CREATED', 'SUPPORT_REQUEST_UPDATED', 'ANNOUNCEMENT_CREATED'].includes(message.type)) {
          setInboxRevision(value => value + 1);
        }
        if (message.analytics) {
          setFleet(previous => previous ? {...previous, analytics: message.analytics} : previous);
        }
        if (['FLEET_UPDATED', 'SESSION_TERMINATED', 'SUPPORT_REQUEST_CREATED', 'SUPPORT_REQUEST_UPDATED'].includes(message.type)) refresh();
      };
      socket.onclose = event => {
        clearInterval(pingTimer);
        if (disposed) return;
        if (event.code === 4401) {
          setAuth(null);
          setFleet(null);
          setTelemetry([]);
          setConnection('Disconnected');
          return;
        }
        setConnection('Reconnecting');
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      };
      socket.onerror = () => socket.close();
    };
    refresh();
    connect();
    window.addEventListener('focus', refresh);
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(pingTimer);
      socket?.close();
      if (socketRef.current === socket) socketRef.current = null;
      window.removeEventListener('focus', refresh);
    };
  }, [auth, refreshFleet]);

  return <AppContext.Provider value={{
    auth, setAuth, fleet, setFleet, request, refreshFleet, connection,
    telemetry, pingMs, setPingMs, backgroundError, setBackgroundError, inboxRevision,
  }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used inside AppProvider');
  return context;
}