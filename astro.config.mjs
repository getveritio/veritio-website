import { defineConfig } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'
import sitemap from '@astrojs/sitemap'
import starlight from '@astrojs/starlight'

export default defineConfig({
  site: 'https://getveritio.com',
  trailingSlash: 'always',
  build: {
    // Avoid a render-blocking stylesheet round-trip. The generated HTML is
    // compressed by Cloudflare's static asset pipeline.
    inlineStylesheets: 'always',
  },
  // Localized marketing routes are explicit files under /de/ and /ko/. We do
  // not configure Astro-wide i18n because that would create fallback copies
  // of the English-only Starlight documentation tree.
  // Fully static; the only client JS is the analytics/consent script pair
  // (Umami + CookieBanner). sitemap emits /sitemap-index.xml at build time;
  // it is submitted to Google
  // Search Console (sc-domain:getveritio.com), so keep the integration in place.
  integrations: [
    starlight({
      title: 'Veritio',
      description: 'Open-source documentation for recording, linking, verifying, and exporting application evidence.',
      favicon: '/favicon.svg',
      logo: {
        src: './public/favicon.svg',
        replacesTitle: false,
      },
      pagefind: true,
      lastUpdated: true,
      editLink: {
        baseUrl: 'https://github.com/getveritio/veritio-website/edit/main/',
      },
      social: [
        {
          icon: 'github',
          label: 'Veritio on GitHub',
          href: 'https://github.com/getveritio/veritio',
        },
      ],
      head: [
        { tag: 'meta', attrs: { name: 'theme-color', content: '#f6f3ea' } },
        { tag: 'link', attrs: { rel: 'sitemap', href: '/sitemap-index.xml' } },
      ],
      customCss: ['./src/styles/docs.css'],
      components: {
        Header: './src/components/docs/DocsHeader.astro',
        Footer: './src/components/docs/DocsFooter.astro',
        Head: './src/components/docs/DocsHead.astro',
        PageTitle: './src/components/docs/DocsPageTitle.astro',
        ThemeProvider: './src/components/docs/DocsThemeProvider.astro',
        ThemeSelect: './src/components/docs/DocsThemeToggle.astro',
      },
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Overview', slug: 'docs' },
            { label: 'Installation', slug: 'docs/start/installation' },
            { label: 'Record your first event', slug: 'docs/start/record-first-event' },
            { label: 'Verify a chain', slug: 'docs/start/verify-a-chain' },
            { label: 'Choose your path', slug: 'docs/start/choose-your-path' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Audit events', slug: 'docs/concepts/audit-events' },
            { label: 'Hash chain', slug: 'docs/concepts/hash-chain' },
            { label: 'Evidence graph', slug: 'docs/concepts/evidence-graph' },
            { label: 'Evidence commits', slug: 'docs/concepts/evidence-commits' },
            { label: 'Changes, activities, and revisions', slug: 'docs/concepts/governed-changes' },
            { label: 'Risk scoring', slug: 'docs/concepts/risk-scoring' },
            { label: 'Activity episodes', slug: 'docs/concepts/activity-episodes' },
            { label: 'Redaction', slug: 'docs/concepts/redaction' },
            { label: 'Retention', slug: 'docs/concepts/retention' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Governed actions', slug: 'docs/guides/governed-actions' },
            { label: 'Transactional outbox', slug: 'docs/guides/transactional-outbox' },
            { label: 'Audit templates', slug: 'docs/guides/audit-templates' },
            { label: 'Consent history', slug: 'docs/guides/consent-history' },
            { label: 'DSAR fulfillment', slug: 'docs/guides/dsar-fulfillment' },
            { label: 'Risk policy tuning', slug: 'docs/guides/risk-policy-tuning' },
            { label: 'Security risk assertions', slug: 'docs/guides/security-risk-assertions' },
          ],
        },
        {
          label: 'SDKs & Tools',
          items: [
            { label: 'TypeScript', slug: 'docs/sdks/typescript' },
            { label: 'Python', slug: 'docs/sdks/python' },
            { label: 'Go', slug: 'docs/sdks/go' },
            { label: 'CLI', slug: 'docs/sdks/cli' },
          ],
        },
        {
          label: 'Frameworks',
          items: [
            { label: 'Next.js', slug: 'docs/frameworks/nextjs' },
            { label: 'FastAPI', slug: 'docs/frameworks/fastapi' },
            { label: 'Hono', slug: 'docs/frameworks/hono' },
            { label: 'Better Auth', slug: 'docs/frameworks/better-auth' },
            { label: 'TanStack Start', slug: 'docs/frameworks/tanstack-start' },
            { label: 'SvelteKit', slug: 'docs/frameworks/sveltekit' },
            { label: 'Express', slug: 'docs/frameworks/express' },
          ],
        },
        {
          label: 'Storage & Self-hosting',
          items: [
            { label: 'Storage overview', slug: 'docs/storage/overview' },
            { label: 'Postgres & Neon', slug: 'docs/storage/postgres' },
            { label: 'MySQL & MariaDB', slug: 'docs/storage/mysql-mariadb' },
            { label: 'MongoDB', slug: 'docs/storage/mongodb' },
            { label: 'File store', slug: 'docs/storage/file-store' },
            { label: 'Transactional outbox', slug: 'docs/storage/outbox' },
            { label: 'Store conformance', slug: 'docs/storage/conformance' },
            { label: 'Self-hosting', slug: 'docs/storage/self-hosting' },
          ],
        },
        {
          label: 'AI & Agents',
          items: [
            { label: 'Agent events', slug: 'docs/ai/agent-events' },
            { label: 'Provenance recorder', slug: 'docs/ai/provenance-recorder' },
            { label: 'Risk signals', slug: 'docs/ai/risk-signals' },
            { label: 'AI gateway', slug: 'docs/ai/gateway' },
            { label: 'Claude Code', slug: 'docs/ai/claude-code' },
            { label: 'Codex', slug: 'docs/ai/codex' },
          ],
        },
        {
          label: 'Veritio Cloud',
          items: [
            { label: 'Cloud overview', slug: 'docs/cloud/overview' },
            { label: 'Getting started', slug: 'docs/cloud/getting-started' },
            { label: 'Exports', slug: 'docs/cloud/exports' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Event schema', slug: 'docs/reference/event-schema' },
            { label: 'Governed change API', slug: 'docs/reference/governed-change-api' },
            { label: 'Template catalogue', slug: 'docs/reference/template-catalogue' },
            { label: 'Risk policy', slug: 'docs/reference/risk-policy' },
            { label: 'Evidence commit hashing', slug: 'docs/reference/evidence-commit-hashing' },
            { label: 'Evidence vocabulary', slug: 'docs/reference/evidence-vocabulary' },
            { label: 'SDK parity matrix', slug: 'docs/reference/parity-matrix' },
            { label: 'Verifier', slug: 'docs/reference/verifier' },
            { label: 'Export format', slug: 'docs/reference/export-format' },
            { label: 'Troubleshooting', slug: 'docs/reference/troubleshooting' },
            { label: 'Glossary', slug: 'docs/reference/glossary' },
          ],
        },
      ],
    }),
    sitemap({
      filter: (page) =>
        !page.endsWith('.md') &&
        !page.endsWith('/docs/cloud-getting-started/') &&
        !page.endsWith('/docs/connect-agents/'),
    }),
  ],
  redirects: {
    '/docs/cloud-getting-started/': {
      status: 301,
      destination: '/docs/cloud/getting-started/',
    },
    '/docs/connect-agents/': {
      status: 301,
      destination: '/docs/ai/agent-events/',
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
