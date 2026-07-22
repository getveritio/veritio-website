/**
 * Canonical-host boundary for the otherwise assets-only website Worker. Both
 * getveritio.com and www.getveritio.com custom domains route here, so without
 * this script www served the whole site as duplicate content (SEO). Workers
 * static-assets `_redirects` files reject host-based rules (relative sources
 * only — deploy fails with code 100324), so the redirect must live in Worker
 * code with `assets.run_worker_first: true`. Everything that is not a www
 * request defers straight to the static assets binding; keep it that way —
 * this site has no other server logic.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.hostname === 'www.getveritio.com') {
      url.hostname = 'getveritio.com'
      return Response.redirect(url.toString(), 301)
    }
    return env.ASSETS.fetch(request)
  },
}
