// functions/_scheduled.js - For cron, configure in Cloudflare dashboard as a scheduled event pointing to this
export default {
  async scheduled(event, env, ctx) {
    // Trigger popular refresh
    await fetch('https://your-domain.pages.dev/functions/api/popular', { method: 'GET' });
  },
};