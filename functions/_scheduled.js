// functions/_scheduled.js - For cron, configure in Cloudflare dashboard as a scheduled event pointing to this
export default {
  async scheduled(event, env, ctx) {
    // Trigger popular refresh
    await fetch('https://nostipedia-claude-grok.pages.dev/api/popular', { method: 'GET' });
  },
};