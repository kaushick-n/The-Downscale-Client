const now = new Date();

const snapshots = [
  {
    id: 'demo-snapshot-alpha-001',
    instance_id: 'local-demo-alpha',
    filename: 'SNAPSHOT_DEV-SANDBOX-ALPHA_demo.img',
    size_mb: 412,
    tmux_panes: 3,
    created_at: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    simulated_at: null,
    memory_footprint_mb: 768,
    snapshot_ref: 'local-demo://checkpoints/alpha/latest',
    process_tree: 'node dev-server.js\nvite --host 0.0.0.0\npython -m pytest -q',
  },
  {
    id: 'demo-snapshot-beta-001',
    instance_id: 'local-demo-beta',
    filename: 'SNAPSHOT_FASTAPI-MICROSERVICE-STAGING_demo.img',
    size_mb: 286,
    tmux_panes: 2,
    created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    simulated_at: null,
    memory_footprint_mb: 512,
    snapshot_ref: 'local-demo://checkpoints/fastapi/latest',
    process_tree: 'uvicorn app:app --reload\nredis-server',
  },
];

export const localDemoFleet = {
  timezone: 'Asia/Kolkata',
  demo_available: false,
  aws_lifecycle_enabled: false,
  fleet: [
    {
      id: 'local-demo-alpha',
      name: 'DEV-SANDBOX-ALPHA',
      owner: 'LOCAL-DEMO',
      type: 't3.medium',
      state: 'running',
      cpu: 38.4,
      memory_mb: 768,
      memory_percent: 58.6,
      region: 'us-east-1 (demo)',
      private_ip: '10.0.12.24 (demo)',
      shift: '09:00 - 18:00',
      shift_start: '09:00',
      shift_end: '18:00',
      shift_active: true,
      demo_enabled: true,
      local_demo: true,
      demo_shift_ends_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      state_since: new Date(now.getTime() - 3 * 60 * 60 * 1000 - 42 * 60 * 1000 - 15 * 1000).toISOString(),
      telemetry_updated_at: now.toISOString(),
      demo_time: null,
      exempt: false,
      snoozed: false,
      anomaly: false,
    },
    {
      id: 'local-demo-beta',
      name: 'FASTAPI-MICROSERVICE-STAGING',
      owner: 'LOCAL-DEMO',
      type: 't3.medium',
      state: 'hibernated',
      cpu: 0,
      memory_mb: 512,
      memory_percent: 41.2,
      region: 'us-east-1 (demo)',
      private_ip: '10.0.18.31 (demo)',
      shift: '09:00 - 18:00',
      shift_start: '09:00',
      shift_end: '18:00',
      shift_active: true,
      demo_enabled: true,
      local_demo: true,
      demo_shift_ends_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
      state_since: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
      telemetry_updated_at: now.toISOString(),
      demo_time: null,
      exempt: false,
      snoozed: false,
      anomaly: false,
    },
  ],
  snapshots,
  analytics: {
    currency: 'USD',
    compute_hourly: 0.0416,
    compute_daily: 0.9984,
    total_daily: 1.0484,
    daily_savings: 0.9488,
    snapshot_monthly: 0.05,
  },
};

export const localDemoInbox = {
  announcements: [
    {
      id: 'demo-announcement-shift',
      category: 'shift',
      title: 'Shift ends in 15 minutes',
      body: 'Save your work or request overtime approval before your workspace enters hibernation.',
      created_at: now.toISOString(),
    },
    {
      id: 'demo-announcement-maintenance',
      category: 'maintenance',
      title: 'Routine maintenance at 18:00',
      body: 'The staging fleet will receive routine platform updates after the standard shift window.',
      created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
  ],
  requests: [],
};

export function isLocalDemoHost() {
  return typeof window !== 'undefined'
    && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    && import.meta.env.VITE_LOCAL_DEMO !== '0';
}
