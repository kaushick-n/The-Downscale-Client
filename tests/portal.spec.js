import { test, expect } from '@playwright/test';

const user = { id: 'EMP-100', name: 'Alex', role: 'employee', team_id: 'platform' };
const workspace = id => ({ id, name: `Workspace ${id}`, owner: user.id, state: 'hibernated', type: 't3.medium', shift: '22:00 - 06:00' });

async function setup(page) {
  const state = { fleet: [workspace('i-one'), workspace('i-two')], calls: [], sockets: [], frames: [], reads: 0, deny: false, expired: false, signupError: null };
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
    if (path === '/api/instances') {
      state.reads++;
      return reply(200, { fleet: state.fleet, analytics: { compute_hourly: 0, compute_daily: 0, snapshot_monthly: 0.05, total_daily: 0.001667, daily_savings: 1.99, billing_basis: 'current-state projection; 30-day month' }, snapshots: [{ id: 'snapshot-uuid', instance_id: 'i-one', filename: 'SNAPSHOT_Workspace_20260914.IMG', size_mb: 1024, tmux_panes: 3 }] });
    }
    if (path === '/api/instance/state') {
      if (state.deny) return reply(403, { detail: 'SHIFT LOCKED' });
      state.fleet.find(i => i.id === body.instance_id).state = 'running';
      return reply(200, { status: 'SUCCESS', new_state: 'running' });
    }
    if (path === '/api/logout') {
      state.fleet.find(i => i.id === body.instance_id).state = 'hibernated';
      return reply(200, { status: 'SUCCESS', new_state: 'hibernated' });
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
  await page.getByRole('button', { name: 'SIGN IN', exact: true }).last().click();
}

async function start(page, id = 'i-two') {
  await page.getByLabel('Your workspace').selectOption(id);
  await page.getByRole('button', { name: 'START / RESTORE' }).click();
}

test('invitation signup creates account, shows picker without waking; lifecycle uses bearer', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
  await page.getByLabel('Employee ID').fill(user.id);
  await page.getByLabel('Name', { exact: true }).fill('Alex');
  await page.getByLabel('Password', { exact: true }).fill('valid-password-123');
  await page.getByLabel('Invitation code').fill('invitation');
  await page.getByRole('button', { name: 'SIGN UP', exact: true }).last().click();
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  const signup = state.calls.find(c => c.path.endsWith('signup'));
  expect(signup.body).toEqual({ user_id: user.id, name: 'Alex', password: 'valid-password-123', invitation_token: 'invitation' });
  expect(signup.authorization).toBeUndefined();
  expect(state.calls.some(c => c.path === '/api/instance/state')).toBe(false);
  await start(page);
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
  expect(state.calls.find(c => c.path === '/api/instance/state').body).toEqual({ instance_id: 'i-two', target_state: 'running' });
  expect(state.frames[0]).toEqual({ token: 'test-token' });
  await page.getByRole('button', { name: 'LOGOUT & HIBERNATE' }).click();
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  await page.getByText('Retained snapshots (1)').click();
  await expect(page.getByText(/SNAPSHOT_Workspace_20260914.IMG/)).toBeVisible();
  await expect(page.getByText(/total \$0.001667/)).toBeVisible();
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('invalid credentials, off-hours denial and expired REST authentication', async ({ page }) => {
  const state = await setup(page);
  await login(page, 'incorrect');
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
  await login(page);
  state.deny = true;
  await start(page);
  await expect(page.getByRole('alert')).toHaveText('SHIFT LOCKED');
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
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await page.getByLabel('Employee ID').fill(user.id);
    await page.getByLabel('Name', { exact: true }).fill('Alex');
    await page.getByLabel('Password', { exact: true }).fill('valid-password-123');
    await page.getByLabel('Invitation code').fill('invalid-code');
    await page.getByRole('button', { name: 'SIGN UP', exact: true }).last().click();
    await expect(page.getByRole('alert')).toHaveText(Array.isArray(detail) ? 'password: String should have at least 12 characters' : detail);
  });
}

test('empty fleet and live provisioning use only server workspaces', async ({ page }) => {
  const state = await setup(page);
  state.fleet = [];
  await login(page);
  await expect(page.getByText(/No owned workspaces/)).toBeVisible();
  state.fleet = [workspace('i-provisioned')];
  state.sockets.at(-1).send(JSON.stringify({ type: 'FLEET_UPDATED', instance_id: 'i-provisioned' }));
  await expect(page.getByLabel('Your workspace').locator('option')).toHaveCount(2);
  await start(page, 'i-provisioned');
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
});

test('Chief Architect signup has no invitation and uses dedicated endpoint', async ({ page }) => {
  await setup(page);
  let payload;
  await page.route('http://localhost:8000/api/auth/signup/chief-architect', route => {
    payload = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { access_token: 'test-token', user: { ...user, role: 'admin' } } });
  });
  await page.getByRole('button', { name: 'Chief Architect Sign Up' }).click();
  await expect(page.getByLabel('Invitation code')).toHaveCount(0);
  await page.getByLabel('Name', { exact: true }).fill('Chief');
  await page.getByLabel('Chief Architect ID').fill('CHIEF-1');
  await page.getByLabel('Password', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'CREATE CHIEF ARCHITECT ACCOUNT' }).click();
  await expect(page.getByRole('status')).toContainText('Chief Architect account created');
  expect(payload).toEqual({ user_id: 'CHIEF-1', name: 'Chief', password: 'test-password-123' });
});
