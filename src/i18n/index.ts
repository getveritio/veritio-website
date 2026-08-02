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

export const navStrings: Record<Locale, {
  overview: string
  cloud: string
  pricing: string
  docs: string
  examples: string
  signIn: string
  startFree: string
  menu: string
  openMenu: string
  closeMenu: string
  banner: string
  viewOnGitHub: string
}> = {
  en: {
    overview: 'Overview', cloud: 'Cloud', pricing: 'Pricing', docs: 'Docs', examples: 'Examples',
    signIn: 'Sign in', startFree: 'Start free', menu: 'Menu', openMenu: 'Open menu', closeMenu: 'Close menu',
    banner: 'Open-source. Self-hosted. Compliance by design.', viewOnGitHub: 'View on GitHub',
  },
  de: {
    overview: 'Überblick', cloud: 'Cloud', pricing: 'Preise', docs: 'Docs', examples: 'Beispiele',
    signIn: 'Anmelden', startFree: 'Kostenlos starten', menu: 'Menü', openMenu: 'Menü öffnen', closeMenu: 'Menü schließen',
    banner: 'Open Source. Self-Hosted. Compliance by Design.', viewOnGitHub: 'Auf GitHub ansehen',
  },
  ko: {
    overview: '개요', cloud: '클라우드', pricing: '요금', docs: '문서', examples: '예제',
    signIn: '로그인', startFree: '무료로 시작', menu: '메뉴', openMenu: '메뉴 열기', closeMenu: '메뉴 닫기',
    banner: '오픈 소스. 셀프 호스팅. 컴플라이언스 중심 설계.', viewOnGitHub: 'GitHub에서 보기',
  },
}

export const cookieBannerStrings: Record<Locale, {
  ariaLabel: string
  message: string
  privacy: string
  accept: string
  decline: string
  settings: string
}> = {
  en: {
    ariaLabel: 'Cookie consent',
    message:
      'This site uses cookieless, anonymous analytics (Umami) by default. With your consent, we also enable Google Analytics, which sets cookies and sends usage data to Google.',
    privacy: 'Privacy Policy',
    accept: 'Accept',
    decline: 'Decline',
    settings: 'Cookie settings',
  },
  de: {
    ariaLabel: 'Cookie-Einwilligung',
    message:
      'Diese Website nutzt standardmäßig eine cookielose, anonyme Webanalyse (Umami). Mit Ihrer Einwilligung aktivieren wir zusätzlich Google Analytics; dabei werden Cookies gesetzt und Nutzungsdaten an Google übertragen.',
    privacy: 'Datenschutzerklärung',
    accept: 'Akzeptieren',
    decline: 'Ablehnen',
    settings: 'Cookie-Einstellungen',
  },
  ko: {
    ariaLabel: '쿠키 동의',
    message:
      '이 웹사이트는 기본적으로 쿠키 없는 익명 분석 도구(Umami)를 사용합니다. 동의하시면 Google Analytics도 활성화되며, 이 경우 쿠키가 설정되고 사용 데이터가 Google로 전송됩니다.',
    privacy: '개인정보 처리방침',
    accept: '동의',
    decline: '거부',
    settings: '쿠키 설정',
  },
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
