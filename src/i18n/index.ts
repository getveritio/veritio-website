/**
 * Minimal i18n helpers. EN is the default (unprefixed) locale; DE and KO
 * live under /de/ and /ko/ for the money pages only (home, cloud, pricing).
 * Docs, examples, comparisons, and legal stay EN — deliberate: partial or
 * stale translations of claims-heavy pages hurt more than they help.
 */
export type Locale = 'en' | 'de' | 'ko'

export const locales: Locale[] = ['en', 'de', 'ko']
export const defaultLocale: Locale = 'en'

/** Base (EN) paths that have DE/KO counterparts. */
export const translatedPaths = ['/', '/cloud', '/pricing']

export function localeFromPathname(pathname: string): Locale {
  if (pathname === '/de' || pathname.startsWith('/de/')) return 'de'
  if (pathname === '/ko' || pathname.startsWith('/ko/')) return 'ko'
  return 'en'
}

/** Strip a locale prefix, returning the EN base path. */
export function basePath(pathname: string): string {
  const stripped = pathname.replace(/^\/(de|ko)(?=\/|$)/, '')
  const noSlash = stripped === '' ? '/' : stripped
  return noSlash !== '/' ? noSlash.replace(/\/$/, '') : '/'
}

/** Localized href for a base path; falls back to EN for untranslated pages. */
export function localizePath(path: string, locale: Locale): string {
  if (locale === 'en' || !translatedPaths.includes(path)) return path
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

export const ogLocale: Record<Locale, string> = {
  en: 'en_US',
  de: 'de_DE',
  ko: 'ko_KR',
}

export const navStrings: Record<Locale, { overview: string; cloud: string; pricing: string; docs: string; examples: string; signIn: string }> = {
  en: { overview: 'Overview', cloud: 'Cloud', pricing: 'Pricing', docs: 'Docs', examples: 'Examples', signIn: 'Sign in' },
  de: { overview: 'Überblick', cloud: 'Cloud', pricing: 'Preise', docs: 'Docs', examples: 'Beispiele', signIn: 'Anmelden' },
  ko: { overview: '개요', cloud: '클라우드', pricing: '요금', docs: '문서', examples: '예제', signIn: '로그인' },
}

export const footerStrings: Record<Locale, {
  blurb: string
  product: string
  openSource: string
  legal: string
  disclaimer: string
}> = {
  en: {
    blurb: 'Open-source evidence layer for audit trails, change provenance, and governance workflows.',
    product: 'Product',
    openSource: 'Open source',
    legal: 'Legal',
    disclaimer:
      'Veritio provides evidence support. It is not legal advice and does not make an application automatically compliant with GDPR, CCPA, SOC 2, HIPAA, DORA, NIS2, or any other framework.',
  },
  de: {
    blurb: 'Open-Source-Evidence-Layer für Audit-Trails, Änderungs-Provenienz und Governance-Workflows.',
    product: 'Produkt',
    openSource: 'Open Source',
    legal: 'Rechtliches',
    disclaimer:
      'Veritio bietet Unterstützung durch Nachweise (Evidence Support). Es ist keine Rechtsberatung und macht eine Anwendung nicht automatisch konform mit DSGVO, CCPA, SOC 2, HIPAA, DORA, NIS2 oder anderen Rahmenwerken.',
  },
  ko: {
    blurb: '감사 추적, 변경 프로버넌스, 거버넌스 워크플로를 위한 오픈 소스 에비던스 레이어.',
    product: '제품',
    openSource: '오픈 소스',
    legal: '법적 고지',
    disclaimer:
      'Veritio는 에비던스(증적) 지원을 제공합니다. 법률 자문이 아니며, 애플리케이션이 GDPR, CCPA, SOC 2, HIPAA, DORA, NIS2 등 어떠한 프레임워크도 자동으로 준수하도록 만들지 않습니다.',
  },
}
