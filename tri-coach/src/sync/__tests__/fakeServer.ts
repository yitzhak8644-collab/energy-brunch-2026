/** שרת Intervals.icu מדומה בזיכרון, לבדיקות. */
export interface FakeOpts { dropExternalId?: boolean; activities?: unknown[]; wellness?: unknown[]; status?: number; wellnessStatus?: number; offline?: boolean }
export interface Call { method: string; path: string; query: URLSearchParams; headers: Record<string, string>; body?: any }

export function fakeServer(opts: FakeOpts = {}, athlete = 'i1') {
  const events: any[] = [];
  const calls: Call[] = [];
  let nextId = 100;
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'content-type': 'application/json' } });
  const store = (e: any) => { const x = { ...e, id: nextId++ }; if (opts.dropExternalId) delete x.external_id; events.push(x); return x; };

  const fetchImpl = (async (url: string, init?: RequestInit) => {
    if (opts.offline) throw new TypeError('Failed to fetch');
    const u = new URL(url);
    const method = init?.method ?? 'GET';
    const path = u.pathname.replace(`/api/v1/athlete/${athlete}`, '') || '/';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, query: u.searchParams, headers: (init?.headers ?? {}) as Record<string, string>, body });
    if (opts.status) return json({}, opts.status);
    if (method === 'GET' && path === '/') return json({ athlete: { name: 'Test Athlete' } });
    if (method === 'GET' && path === '/wellness') return opts.wellnessStatus ? json({}, opts.wellnessStatus) : json(opts.wellness ?? []);
    if (method === 'GET' && path === '/activities') return json(opts.activities ?? []);
    if (method === 'GET' && path === '/events') {
      const o = u.searchParams.get('oldest')!, n = u.searchParams.get('newest') ?? '9999-12-31';
      return json(events.filter((e) => e.start_date_local.slice(0, 10) >= o && e.start_date_local.slice(0, 10) <= n));
    }
    if (method === 'POST' && path === '/events/bulk') return json((body as any[]).map(store));
    if (method === 'POST' && path === '/events') return json(store(body));
    if (method === 'PUT' && path === '/events/bulk-delete') {
      for (const d of body as { id: number }[]) { const i = events.findIndex((e) => e.id === d.id); if (i >= 0) events.splice(i, 1); }
      return json({});
    }
    const m = path.match(/^\/events\/(\d+)$/);
    if (m) {
      const i = events.findIndex((e) => e.id === Number(m[1]));
      if (i < 0) return json({}, 404);
      if (method === 'GET') return json({ ...events[i], moving_time: events[i].moving_time ?? 0, workout_doc: { steps: [{}, {}] }, push_errors: [] });
      if (method === 'PUT') { events[i] = { ...events[i], ...body, ...(opts.dropExternalId ? { external_id: undefined } : {}) }; return json(events[i]); }
      if (method === 'DELETE') { events.splice(i, 1); return json({}); }
    }
    return json({ error: 'unhandled ' + method + ' ' + path }, 500);
  }) as unknown as typeof fetch;

  return { fetchImpl, events, calls, json };
}
