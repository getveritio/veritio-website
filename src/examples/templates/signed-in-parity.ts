import {
  type AuditEvent,
  type AuditEventInput,
  authSessionCreatedTemplate,
  canonicalJson,
  createAuditEvent,
  hashAuditEvent,
} from '@veritio/core'

export const templateScope = { tenantId: 'org_acme', environment: 'production' } as const

/**
 * Proves that `authSessionCreatedTemplate` is pure convenience: it only fills in
 * the canonical action, target, purpose, lawful basis, retention, and compacted
 * security-context metadata that a host could have typed by hand. Both paths are
 * funnelled through the same `createAuditEvent` constructor with a pinned id and
 * `occurredAt`, so any hidden field, silent default, or extra metadata key the
 * template injected would change `hashAuditEvent` and break this fixture.
 */
export function buildSignedInParity(): {
  templateEvent: AuditEvent
  handBuiltEvent: AuditEvent
  templateHash: string
  handBuiltHash: string
} {
  // Template path: the host names the concepts, not the protocol strings.
  const templateInput: AuditEventInput = authSessionCreatedTemplate({
    id: 'evt_session_created_01',
    occurredAt: '2026-08-09T10:00:00.000Z',
    scope: templateScope,
    userId: 'usr_314',
    sessionId: 'ses_918',
    metadata: { mfa: true },
    securityContext: {
      ipAddressHash: 'sha256:ip-address-hash',
      userAgentHash: 'sha256:user-agent-hash',
      location: { country: 'DE', region: 'BE' },
      method: 'password',
      provider: 'credentials',
    },
  })

  // Hand-built path: every field the template would have chosen, spelled out.
  const handBuiltInput: AuditEventInput = {
    id: 'evt_session_created_01',
    occurredAt: '2026-08-09T10:00:00.000Z',
    actor: { type: 'user', id: 'usr_314' },
    action: 'auth.session.created',
    target: { type: 'session', id: 'ses_918' },
    scope: templateScope,
    purpose: 'access_management',
    lawfulBasis: 'contract',
    retention: 'security_1y',
    metadata: {
      mfa: true,
      securityContext: {
        ipAddressHash: 'sha256:ip-address-hash',
        userAgentHash: 'sha256:user-agent-hash',
        location: { country: 'DE', region: 'BE' },
        method: 'password',
        provider: 'credentials',
      },
    },
  }

  const templateEvent = createAuditEvent(templateInput)
  const handBuiltEvent = createAuditEvent(handBuiltInput)

  return {
    templateEvent,
    handBuiltEvent,
    templateHash: hashAuditEvent(templateEvent),
    handBuiltHash: hashAuditEvent(handBuiltEvent),
  }
}

if (import.meta.main) {
  const { templateEvent, handBuiltEvent, templateHash, handBuiltHash } = buildSignedInParity()

  console.log(
    JSON.stringify(
      {
        templateEvent,
        handBuiltEvent,
        canonicalJsonIdentical: canonicalJson(templateEvent) === canonicalJson(handBuiltEvent),
        templateHash,
        handBuiltHash,
        hashesIdentical: templateHash === handBuiltHash,
      },
      null,
      2,
    ),
  )
}
