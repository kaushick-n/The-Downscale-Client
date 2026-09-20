import {test, expect} from '@playwright/test';

test('demo controls apply time and metrics, immediate cutoff updates session and vault', async ({page}) => {
  const user={id:'001',name:'Employee',role:'employee',team_id:'platform'};
  const instance={id:'i-demo',name:'hail mary',owner:'001',type:'t3.medium',cpu:4.2,state:'running',shift:'09:00 - 18:00',shift_start:'09:00',shift_end:'18:00',demo_enabled:false,demo_time:null};
  const snapshots=[{id:'legacy-one',instance_id:instance.id,filename:'SNAPSHOT_hail_mary_20260920.IMG',size_mb:34.2,tmux_panes:2,created_at:null,legacy_date:'2026-09-20'}];
  const calls=[];
  await page.route('**/api/**',async route=>{
    const req=route.request(), path=new URL(req.url()).pathname;
    const body=req.postDataJSON();
    const reply=data=>route.fulfill({json:data});
    if(path==='/api/auth/login')return reply({access_token:'demo-test',user});
    expect(req.headers().authorization).toBe('Bearer demo-test');
    if(path==='/api/me')return reply(user);
    if(path==='/api/instances')return reply({fleet:[instance],snapshots,analytics:{},timezone:'Asia/Kolkata',demo_available:true});
    if(path==='/api/instance/state')return reply({status:'SUCCESS'});
    if(path==='/api/instance/demo'){
      calls.push(body);
      instance.demo_enabled=body.enabled;instance.demo_time=body.enabled && body.simulated_time ? body.simulated_time+'+05:30' : null;
      instance.cpu=body.cpu;
      if(body.evaluate_now){instance.state='hibernated';snapshots.push({id:'new-one',instance_id:instance.id,filename:'SNAPSHOT_hail_mary_20260920_180000_abc123.IMG',size_mb:34.2,tmux_panes:2,created_at:'2026-09-20T12:30:00Z',simulated_at:'2026-09-20T18:00:00+05:30'});}
      return reply({instance,outcome:body.evaluate_now ? 'Outside shift: workspace hibernated and snapshot recorded':'Demo settings applied'});
    }
    return route.fulfill({status:404,json:{detail:'Unexpected request'}});
  });
  await page.routeWebSocket('**/ws/fleet',()=>{});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Employee ID').fill('001');await page.getByLabel('Password',{exact:true}).fill('demo-password');
  await page.getByRole('button',{name:'SIGN IN',exact:true}).last().click();
  await page.getByLabel('Your workspace').selectOption(instance.id);await page.getByRole('button',{name:'START / RESTORE'}).click();
  await expect(page.getByText('DEV SANDBOX ACTIVE')).toBeVisible();
  await page.getByRole('switch',{name:'Enable demo for this workspace'}).click();
  await expect(page.getByText('DEMO ACTIVE',{exact:true})).toBeVisible();
  await page.getByLabel('Demo date and time',{exact:false}).fill('2026-09-20T18:00');
  await page.getByRole('button',{name:'CPU spike',exact:true}).click();
  await expect(page.getByLabel('CPU usage (%)',{exact:true})).toHaveValue('99.8');
  await page.getByRole('button',{name:'Apply & evaluate now'}).click();
  await expect(page.getByLabel('Your workspace')).toBeVisible();
  expect(calls.at(-1)).toMatchObject({instance_id:'i-demo',enabled:true,simulated_time:'2026-09-20T18:00',cpu:99.8,evaluate_now:true});
  await expect(page.locator('.snapshot-card')).toHaveCount(1);
  const history = page.getByRole('combobox', {name:'Snapshot history for hail mary'});
  await expect(history).toHaveValue('new-one');
  expect(await history.locator('option').evaluateAll(options => options.map(option => option.value))).toEqual(['new-one','legacy-one']);
  await history.selectOption('legacy-one');
  await expect(page.getByText('/ time not recorded',{exact:true})).toBeVisible();
  await history.selectOption('new-one');
  await expect(page.locator('time[datetime="2026-09-20T12:30:00Z"]')).toBeVisible();
  await page.getByLabel('Search snapshots').fill('abc123');await expect(page.locator('.snapshot-card')).toHaveCount(1);
  await page.getByLabel('Search snapshots').fill('no-match');await expect(page.getByText('No snapshots match your search.')).toBeVisible();
  await page.getByLabel('Search snapshots').fill('');
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.getByRole('switch',{name:'Enable demo for this workspace'}).click();
  await expect(page.getByText('REAL CLOCK',{exact:true})).toBeVisible();expect(calls.at(-1).enabled).toBe(false);
  expect(errors).toEqual([]);
});
