/**
 * Public analytics identifiers — they ship in the page HTML, so constants
 * beat env plumbing. Umami is the always-on, cookieless baseline; GA4 loads
 * only after banner consent (see CookieBanner.astro; design spec lives in
 * .codex/private/specs/, intentionally untracked).
 */
export const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js'
export const UMAMI_WEBSITE_ID = '9ec42c47-6d88-44d0-887d-4b9b40543f80'
export const GA_MEASUREMENT_ID = 'G-P1JN5PWXEF'
