// functions/api/popular.js
export async function onRequestGet({ env }) {
  const KV = env.WIKI_CACHE;
  const cacheKey = 'popular';
  const relays = ['wss://relay.damus.io', 'wss://nos.lol'];
  const TTL = 3600 * 1000 * 24; // 24 hours

  let cached = await KV.get(cacheKey);
  if (cached) {
    cached = JSON.parse(cached);
    if (Date.now() - cached.lastUpdated < TTL) {
      return new Response(JSON.stringify({ articles: cached.articles, fromCache: true }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Hardcoded list of known popular d tags, deduplicated
  const popularDsSet = new Set([
    'nostr', 'bitcoin', 'zaps', 'nip-01', 'nip-05', 'nip-07', 'nip-19', 'nip-26', 'nip-51', 'nip-54',
    'lightning', 'satoshi', 'pubkey', 'relays', 'notes', 'events', 'kind-1', 'kind-7', 'damus', 'primal',
    'coracle', 'iris', 'snort', 'yakihonne', 'zapddit', 'habla', 'highlighter', 'nostrudel', 'nostrich',
    'plebstr', 'satellite', 'zapstream', 'zapstr', 'zapper', 'zapplepay', 'zapthread', 'web-of-trust',
    'wot', 'wss', 'websocket', 'verification', 'user', 'trends', 'torrent', 'torrents', 'text', 'tags',
    'tag', 'subscription', 'subscriptions', 'stream', 'stories', 'story', 'social', 'snort-social',
    'simple', 'search', 'seal', 'satoshis', 'sat', 'satoshis-per-dollar', 'satoshis-per-usd',
    'satoshis-per-btc', 'satoshis-per-bitcoin', 'satoshis-per-unit', 'satoshis-per-fiat', 'satoshis-per',
    'sats-per-dollar', 'sats-per-usd', 'sats-per-btc', 'sats-per-bitcoin', 'sats-per-unit', 'sats-per-fiat',
    'sats-per', 'sats', 'relay-list', 'relay-lists', 'relay-selection', 'relay-selection-algorithm',
    'relay-selection-algorithms', 'relay-selection-strategy', 'relay-selection-strategies',
    'relay-selection-method', 'relay-selection-methods', 'relay-selection-technique',
    'relay-selection-techniques', 'relay-selection-approach', 'relay-selection-approaches',
    'relay-selection-model', 'relay-selection-models', 'relay-selection-framework',
    'relay-selection-frameworks', 'relay-selection-system', 'relay-selection-systems',
    'relay-selection-tool', 'relay-selection-tools', 'relay-selection-software',
    'relay-selection-softwares', 'relay-selection-app', 'relay-selection-apps',
    'relay-selection-application', 'relay-selection-applications', 'relay-selection-service',
    'relay-selection-services', 'relay-selection-platform', 'relay-selection-platforms',
    'relay-selection-website', 'relay-selection-websites', 'relay-selection-webapp',
    'relay-selection-webapps', 'relay-selection-api', 'relay-selection-apis',
    'relay-selection-library', 'relay-selection-libraries', 'relay-selection-module',
    'relay-selection-modules', 'relay-selection-plugin', 'relay-selection-plugins',
    'relay-selection-extension', 'relay-selection-extensions', 'relay-selection-script',
    'relay-selection-scripts', 'relay-selection-code', 'relay-selection-codes',
    'relay-selection-program', 'relay-selection-programs', 'relay-selection-toolkit',
    'relay-selection-toolkits', 'relay-selection-package', 'relay-selection-packages',
    'relay-selection-utility', 'relay-selection-utilities', 'relay-selection-function',
    'relay-selection-functions', 'relay-selection-methodology', 'relay-selection-methodologies',
    'pubkeys', 'public-key', 'public-keys', 'private-key', 'private-keys', 'profile', 'profiles',
    'post', 'posts', 'note', 'nip', 'nips', 'nak', 'nakamoto', 'lightning-network', 'kind', 'kinds',
    'kind-30818', 'dm', 'dms', 'direct-message', 'direct-messages', 'decentralized',
    'censorship-resistant', 'btc', 'blockchain', 'author', 'authors', 'article', 'articles', 'wiki',
    'wikis', 'nip-54-wiki', 'nip-54-wikis', 'nostipedia', 'nostr-wiki', 'nostr-wikis',
    'nostr-protocol', 'zap-request', 'zap-requests', 'zap-note', 'zap-notes', 'zap-article',
    'zap-articles', 'zap-thread', 'zap-threads', 'zap-stream', 'zap-streams', 'zap-str',
    'zap-strs', 'zap-ddit', 'zap-ddits', 'zap-pleb', 'zap-plebs', 'zap-satellite', 'zap-satellites',
    'zap-habla', 'zap-hablas', 'zap-highlighter', 'zap-highlighters', 'zap-nostrudel',
    'zap-nostrudels', 'zap-nostrich', 'zap-nostriches', 'zap-plebstr', 'zap-plebstrs',
    'zap-zapstream', 'zap-zapstreams', 'zap-zapstr', 'zap-zapstrs', 'zap-zapper', 'zap-zappers',
    'zap-zapplepay', 'zap-zapplepays', 'zap-zapthread', 'zap-zapthreads'
  ]);
  const popularDs = Array.from(popularDsSet);

  const articles = [];
  for (const d of popularDs) {
    const events = [];
    for (const relay of relays) {
      const ws = new WebSocket(relay);
      await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));

      const subId = 'pop-' + Math.random().toString(36).slice(2);
      ws.send(JSON.stringify(['REQ', subId, { kinds: [30818], '#d': [d], limit: 1 }]));

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

    if (events.length) {
      let reactionCount = 0;
      for (const relay of relays) {
        const ws = new WebSocket(relay);
        await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));

        const reactionSub = 'reax-' + events[0].id;
        ws.send(JSON.stringify(['REQ', reactionSub, { kinds: [7], '#e': [events[0].id], limit: 100 }]));

        const reaxPromise = new Promise(resolve => {
          const handler = msg => {
            const data = JSON.parse(msg.data);
            if (data[0] === 'EVENT' && data[2].content === '+') reactionCount++;
            if (data[0] === 'EOSE') {
              ws.removeEventListener('message', handler);
              ws.send(JSON.stringify(['CLOSE', reactionSub]));
              resolve();
            }
          };
          ws.addEventListener('message', handler);
          setTimeout(() => {
            ws.removeEventListener('message', handler);
            ws.send(JSON.stringify(['CLOSE', reactionSub]));
            resolve();
          }, 3000);
        });
        await reaxPromise;
        ws.close();
      }
      articles.push({ d, title: events[0].tags.find(t => t[0] === 'title')?.[1] || d, created_at: events[0].created_at, pubkey: events[0].pubkey, reactionCount });
    }
  }

  const uniqueArticles = articles.sort((a, b) => b.reactionCount - a.reactionCount);
  await KV.put(cacheKey, JSON.stringify({ articles: uniqueArticles, lastUpdated: Date.now() }));

  return new Response(JSON.stringify({ articles: uniqueArticles, fromCache: false }), { headers: { 'Content-Type': 'application/json' } });
}