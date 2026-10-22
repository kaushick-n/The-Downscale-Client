import { test, expect } from '@playwright/test';

const user = { id: 'EMP-100', name: 'Alex', role: 'employee', team_id: 'platform' };
const workspace = id => ({ id, name: `Workspace ${id}`, owner: user.id, state: 'hibernated', type: 't3.medium', shift: '22:00 - 06:00' });

async function setup(page) {
  const state = { fleet: [workspace('i-one'), workspace('i-two')], calls: [], sockets: [], frames: [], reads: 0, deny: null, expired: false, signupError: null, requests: [] };
  await page.route('http://localhost:8000/api/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postDataJSON();
    state.calls.push({ path, body, authorization: req.headers().authorization });
    const reply = (status, data) => route.fulfill({ status, json: data });
    if (path === '/api/auth/signup' && state.signupError) return reply(state.signupError.status, { detail: state.signupError.detail });
    if (path === '/api/auth/login' || path === '/api/auth/signup') {
      if (body.password === 'incorrect') return reply(401, { detail: 'Invalid credentials' });
      return reply(path.endsWith('signup') ? 201 : 200, { access_token: 'test-token', user });
    }
    expect(req.headers().authorization).toBe('Bearer test-token');
    if (state.expired) return reply(401, { detail: 'Session expired' });
    if (path === '/api/me') return reply(200, user);
    if (path === '/api/employee/inbox') return reply(200, { announcements: [], requests: state.requests });
    if (path === '/api/instances') {
      state.reads++;
      return reply(200, { fleet: state.fleet, analytics: { compute_hourly: 0, compute_daily: 0, snapshot_monthly: 0.05, total_daily: 0.001667, daily_savings: 1.99, billing_basis: 'current-state projection; 30-day month' }, snapshots: [{ id: 'snapshot-uuid', instance_id: 'i-one', filename: 'SNAPSHOT_Workspace_20260914.IMG', size_mb: 1024, tmux_panes: 3 }] });
    }
    if (path.startsWith('/api/instance/session-state/')) return reply(200, { available: false, reason: 'Live process and tmux inspection requires the AWS lifecycle connection.' });
    if (path === '/api/instance/state') {
      if (state.deny) return reply(403, { detail: state.deny });
      state.fleet.find(i => i.id === body.instance_id).state = body.target_state;
      return reply(200, { status: 'SUCCESS', new_state: body.target_state });
    }
    if (path === '/api/logout') {
      state.fleet.find(i => i.id === body.instance_id).state = 'hibernated';
      return reply(200, { status: 'SUCCESS', new_state: 'hibernated' });
    }
    if (path === '/api/support/requests') {
      const request = { id: 'request-1', owner_id: user.id, team_id: user.team_id, status: 'open', created_at: new Date().toISOString(), ...body };
      state.requests.unshift(request);
      return reply(201, request);
    }
    return reply(404, { detail: 'Unexpected endpoint' });
  });
  await page.routeWebSocket('ws://localhost:8000/ws/fleet', socket => {
    state.sockets.push(socket);
    socket.onMessage(message => { state.frames.push(JSON.parse(message)); socket.send(JSON.stringify({ type: 'FLEET_UPDATED', reason: 'connected', instance_id: null })); });
  });
  await page.goto('/');
  return state;
}

async function login(page, password = 'valid-password-123') {
  await page.getByLabel('Employee ID').fill(user.id);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
}

async function start(page, id = 'i-two') {
  await page.getByLabel('Your workspace').selectOption(id);
  await page.getByRole('button', { name: 'START / RESTORE' }).click();
}

test('invitation signup creates account, shows picker without waking; lifecycle uses bearer', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Invitation sign up', exact: true }).click();
  await page.getByLabel('Employee ID').fill(user.id);
  await page.getByLabel('Name', { exact: true }).fill('Alex');
  await page.getByLabel('Password', { exact: true }).fill('valid-password-123');
  await page.getByLabel('Invitation code').fill('invitation');
  await page.getByRole('button', { name: 'Create employee account', exact: true }).click();
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  const signup = state.calls.find(c => c.path.endsWith('signup'));
  expect(signup.body).toEqual({ user_id: user.id, name: 'Alex', password: 'valid-password-123', invitation_token: 'invitation' });
  expect(signup.authorization).toBeUndefined();
  expect(state.calls.some(c => c.path === '/api/instance/state')).toBe(false);
  await start(page);
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
  expect(state.calls.find(c => c.path === '/api/instance/state').body).toEqual({ instance_id: 'i-two', target_state: 'running' });
  expect(state.frames[0]).toEqual({ token: 'test-token' });
  await page.getByRole('button', { name: 'Manual Pause / Hibernate' }).click();
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  expect(state.calls.filter(c => c.path === '/api/instance/state').at(-1).body).toEqual({ instance_id: 'i-two', target_state: 'hibernated' });
  await page.getByRole('button', { name: 'Session History' }).click();
  await page.getByText('Snapshot filename', {exact:true}).click();
  await expect(page.getByText(/SNAPSHOT_Workspace_20260914.IMG/)).toBeVisible();
  await expect(page.getByText(/Total \$0.001667/)).toBeVisible();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('invalid credentials, off-hours denial and expired REST authentication', async ({ page }) => {
  const state = await setup(page);
  await login(page, 'incorrect');
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
  await login(page);
  state.deny = 'SHIFT LOCKED';
  await start(page);
  await expect(page.getByRole('alert')).toContainText('SHIFT LOCKED');
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toHaveCount(0);
  state.expired = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Employee ID')).toBeVisible();
});

test('targeted termination, reconnect reconciliation, focus refresh and socket expiry', async ({ page }) => {
  const state = await setup(page);
  await login(page);
  await start(page);
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
  state.sockets.at(-1).send(JSON.stringify({ type: 'SESSION_TERMINATED', instance_id: 'i-one' }));
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
  state.fleet[1].state = 'hibernated';
  state.sockets.at(-1).close({ code: 1012, reason: 'restart' });
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  await expect.poll(() => state.sockets.length).toBeGreaterThan(1);
  await start(page);
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
  state.fleet[1].state = 'hibernated';
  state.sockets.at(-1).send(JSON.stringify({ type: 'SESSION_TERMINATED', instance_id: 'i-two' }));
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  expect(state.calls.some(c => c.path === '/api/logout')).toBe(false);
  await start(page);
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
  state.fleet[1].state = 'stopped';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  state.sockets.at(-1).close({ code: 4401, reason: 'expired' });
  await expect(page.getByLabel('Employee ID')).toBeVisible();
});

for (const detail of ['Invitation expired', 'Invitation already used', 'Invitation is for a different user', [{ loc: ['body', 'password'], msg: 'String should have at least 12 characters' }]]) {
  test(`signup renders ${JSON.stringify(detail)}`, async ({ page }) => {
    const state = await setup(page);
    state.signupError = { status: Array.isArray(detail) ? 422 : 400, detail };
    await page.getByRole('button', { name: 'Invitation sign up', exact: true }).click();
    await page.getByLabel('Employee ID').fill(user.id);
    await page.getByLabel('Name', { exact: true }).fill('Alex');
    await page.getByLabel('Password', { exact: true }).fill('valid-password-123');
    await page.getByLabel('Invitation code').fill('invalid-code');
    await page.getByRole('button', { name: 'Create employee account', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText(Array.isArray(detail) ? 'password: String should have at least 12 characters' : detail);
  });
}

test('empty fleet and live provisioning use only server workspaces', async ({ page }) => {
  const state = await setup(page);
  state.fleet = [];
  await login(page);
  await expect(page.getByText('No workspaces returned')).toBeVisible();
  state.fleet = [workspace('i-provisioned')];
  state.sockets.at(-1).send(JSON.stringify({ type: 'FLEET_UPDATED', instance_id: 'i-provisioned' }));
  await expect(page.getByLabel('Your workspace').locator('option')).toHaveCount(2);
  await start(page, 'i-provisioned');
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
});

test('scoped fleet renders without an owner field and assignment denial is actionable', async ({ page }) => {
  const state = await setup(page);
  state.fleet = [{...workspace('i-assigned'), owner: undefined}];
  await login(page);
  await expect(page.getByRole('button', {name: /Workspace i-assigned/})).toBeVisible();
  state.deny = 'Not authorized for this instance';
  await start(page, 'i-assigned');
  await expect(page.getByRole('alert')).toContainText('Check this workspace\'s assignment in the Admin Portal');
  expect(state.calls.filter(c => c.path === '/api/instance/state').at(-1).body)
    .toEqual({instance_id: 'i-assigned', target_state: 'running'});
});

test('socket telemetry updates the selected workspace metrics', async ({page}) => {
  const state = await setup(page);
  await login(page);
  await page.getByLabel('Your workspace').selectOption('i-one');
  state.sockets.at(-1).send(JSON.stringify({
    type: 'TELEMETRY_UPDATED',
    telemetry: [{instance_id: 'i-one', state: 'hibernated', cpu_percent: 42.5,
      memory_mb: 1024, memory_percent: 50, observed_at: new Date().toISOString()}],
  }));
  await expect(page.getByLabel('Workspace telemetry')).toContainText('42.5%');
  await expect(page.getByLabel('Workspace telemetry')).toContainText('1,024 MB');
});

test('admin test ping appears on the client dashboard', async ({page}) => {
  const state = await setup(page);
  await login(page);
  await expect.poll(() => state.sockets.length).toBe(1);
  state.sockets.at(-1).send(JSON.stringify({type: 'ADMIN_TEST_PING', actor_id: 'CA001', details: 'a1b2c3d4'}));
  await expect(page.getByRole('status')).toContainText('Admin test ping a1b2c3d4 received from CA001');
  await page.getByRole('button', {name: 'Dismiss test ping'}).click();
  await expect(page.getByText(/Admin test ping a1b2c3d4/)).toHaveCount(0);
});

test('employee support request is submitted through the helpdesk API', async ({ page }) => {
  const state = await setup(page);
  await login(page);
  await page.getByRole('button', { name: 'Contact IT' }).click();
  await page.getByLabel('Request type').selectOption('storage');
  await page.getByLabel('Related workspace').selectOption('i-one');
  await page.getByLabel('Subject').fill('Expand workspace storage');
  await page.getByLabel('Details').fill('Please increase the workspace volume for build artifacts.');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('status')).toContainText('sent to the Team Lead queue');
  expect(state.calls.find(call => call.path === '/api/support/requests').body).toEqual({
    request_type: 'storage',
    subject: 'Expand workspace storage',
    details: 'Please increase the workspace volume for build artifacts.',
    instance_id: 'i-one',
  });
  await page.getByRole('button', { name: 'Inbox & Requests' }).click();
  await expect(page.getByText('Expand workspace storage')).toBeVisible();
});

test('Chief Architect signup has no invitation and uses dedicated endpoint', async ({ page }) => {
  await setup(page);
  let payload;
  await page.route('http://localhost:8000/api/auth/signup/chief-architect', route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { access_token: 'test-token', user: { ...user, role: 'admin' } } });
  });
  await page.getByRole('button', { name: 'Chief Architect setup' }).click();
  await expect(page.getByLabel('Invitation code')).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill('Chief');
  await page.getByLabel('Chief Architect ID').fill('CHIEF-1');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('status')).toContainText('Chief Architect account created');
  expect(payload).toEqual({ user_id: 'CHIEF-1', name: 'Chief', password: 'test-password-123' });
});
