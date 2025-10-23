// functions/api/article/[title].js
export async function onRequestGet({ params, env }) {
  const title = params.title;
  const KV = env.WIKI_CACHE;
  const cacheKey = `article_${title}`;
  const relays = ['wss://relay.damus.io', 'wss://nos.lol'];
  const TTL = 3600 * 1000; // 1 hour for individual articles

  let cached = await KV.get(cacheKey);
  if (cached) {
    cached = JSON.parse(cached);
    if (Date.now() - cached.lastUpdated < TTL) {
      return new Response(JSON.stringify({ events: cached.events, fromCache: true }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  const events = [];
  for (const relay of relays) {
    const ws = new WebSocket(relay);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));

    const subId = 'art-' + Math.random().toString(36).slice(2);
    ws.send(JSON.stringify(['REQ', subId, { kinds: [30818], '#d': [title], limit: 100 }]));

    const eventsPromise = new Promise(resolve => {
      const handler = msg => {
        const data = JSON.parse(msg.data);
        if (data[0] === 'EVENT') events.push(data[2]);
        if (data[0] === 'EOSE') {
          ws.removeEventListener('message', handler);
          ws.send(JSON.stringify(['CLOSE', subId]));
          resolve();
        }
      };
      ws.addEventListener('message', handler);
      setTimeout(() => {
        ws.removeEventListener('message', handler);
        ws.send(JSON.stringify(['CLOSE', subId]));
        resolve();
      }, 5000);
    });
    await eventsPromise;
    ws.close();
  }

  // Deduplicate events by id
  const uniqueEvents = Array.from(new Map(events.map(e => [e.id, e])).values());

  // Sort by created_at desc
  uniqueEvents.sort((a, b) => b.created_at - a.created_at);

  await KV.put(cacheKey, JSON.stringify({ events: uniqueEvents, lastUpdated: Date.now() }));

  return new Response(JSON.stringify({ events: uniqueEvents, fromCache: false }), { headers: { 'Content-Type': 'application/json' } });
}