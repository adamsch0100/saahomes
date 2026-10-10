/** A tiny cookie-keeping client, so tests can act like one browser. */
export function browser(baseUrl) {
  const jar = new Map();
  function store(res) {
    for (const line of res.headers.getSetCookie?.() || []) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  async function request(method, path, body) {
    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(jar.size ? { Cookie: cookieHeader() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    store(res);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  }
  return {
    jar,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
  };
}
