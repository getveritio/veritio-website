import {
  type AuditEventInput,
  type AuditTemplateSetName,
  auditTemplateSets,
  auditTemplates,
  episodeStartedTemplate,
} from '@veritio/core'

/**
 * Proves the audit-template catalogue invariant: every builder registered under
 * `auditTemplates` emits exactly the canonical action string advertised by
 * `auditTemplateSets`, and every advertised action is produced by exactly one
 * builder. The reference documentation page is generated from this output, so
 * the fixture calls the complete registry rather than a sample, and pins every
 * id, timestamp, hash, and scope so the emitted catalogue is byte-stable.
 *
 * Templates are pure builders: they return an `AuditEventInput` and never hash,
 * store, or sequence anything. That is why the catalogue can be produced without
 * a store and why nothing here depends on wall-clock time.
 */

const scope = { tenantId: 'org_acme', environment: 'production' } as const
const occurredAt = '2026-08-09T10:00:00.000Z'

const userActor = { type: 'user', id: 'usr_owner' } as const
const agentActor = { type: 'ai_agent', id: 'agt_reviewer' } as const
const serviceActor = { type: 'service', id: 'svc_ci' } as const

/** One catalogue row: the registry path that was called and the event it built. */
interface CatalogueEntry {
  builder: string
  event: AuditEventInput
}

/**
 * Invokes every builder in one template set with pinned inputs. Each set is
 * enumerated explicitly (rather than reflectively) so the fixture fails to
 * compile if the published package changes a builder's required input shape.
 */
const catalogue: Record<AuditTemplateSetName, CatalogueEntry[]> = {
  auth: [
    {
      builder: 'auditTemplates.auth.userCreated',
      event: auditTemplates.auth.userCreated({
        id: 'evt_auth_user_created',
        occurredAt,
        scope,
        userId: 'usr_owner',
      }),
    },
    {
      builder: 'auditTemplates.auth.signedIn',
      event: auditTemplates.auth.signedIn({
        id: 'evt_auth_session_created',
        occurredAt,
        scope,
        userId: 'usr_owner',
        sessionId: 'ses_01',
        securityContext: { method: 'password', provider: 'local' },
      }),
    },
    {
      builder: 'auditTemplates.auth.signedOut',
      event: auditTemplates.auth.signedOut({
        id: 'evt_auth_session_revoked',
        occurredAt,
        scope,
        userId: 'usr_owner',
        sessionId: 'ses_01',
      }),
    },
    {
      builder: 'auditTemplates.auth.passwordResetRequested',
      event: auditTemplates.auth.passwordResetRequested({
        id: 'evt_auth_password_reset',
        occurredAt,
        scope,
        userId: 'usr_owner',
        resetRequestId: 'rst_01',
      }),
    },
  ],
  organization: [
    {
      builder: 'auditTemplates.organization.created',
      event: auditTemplates.organization.created({
        id: 'evt_org_created',
        occurredAt,
        scope,
        organizationId: 'org_acme',
        actor: userActor,
      }),
    },
    {
      builder: 'auditTemplates.organization.memberInvited',
      event: auditTemplates.organization.memberInvited({
        id: 'evt_org_member_invited',
        occurredAt,
        scope,
        organizationId: 'org_acme',
        invitationId: 'inv_01',
        inviter: userActor,
        role: 'viewer',
      }),
    },
    {
      builder: 'auditTemplates.organization.memberJoined',
      event: auditTemplates.organization.memberJoined({
        id: 'evt_org_member_joined',
        occurredAt,
        scope,
        organizationId: 'org_acme',
        memberId: 'mem_01',
        actor: userActor,
        role: 'viewer',
      }),
    },
    {
      builder: 'auditTemplates.organization.memberRemoved',
      event: auditTemplates.organization.memberRemoved({
        id: 'evt_org_member_removed',
        occurredAt,
        scope,
        organizationId: 'org_acme',
        memberId: 'mem_01',
        actor: userActor,
      }),
    },
    {
      builder: 'auditTemplates.organization.memberRoleChanged',
      event: auditTemplates.organization.memberRoleChanged({
        id: 'evt_org_member_role_changed',
        occurredAt,
        scope,
        organizationId: 'org_acme',
        memberId: 'mem_01',
        actor: userActor,
        role: ['admin'],
      }),
    },
  ],
  data: [
    {
      builder: 'auditTemplates.data.consentGranted',
      event: auditTemplates.data.consentGranted({
        id: 'evt_consent_granted',
        occurredAt,
        scope,
        actor: userActor,
        consentId: 'cns_01',
        subjectId: 'sub_01',
        purposeId: 'marketing_email',
      }),
    },
    {
      builder: 'auditTemplates.data.consentRevoked',
      event: auditTemplates.data.consentRevoked({
        id: 'evt_consent_revoked',
        occurredAt,
        scope,
        actor: userActor,
        consentId: 'cns_01',
        subjectId: 'sub_01',
        purposeId: 'marketing_email',
      }),
    },
    {
      builder: 'auditTemplates.data.subjectRequestCreated',
      event: auditTemplates.data.subjectRequestCreated({
        id: 'evt_subject_request_created',
        occurredAt,
        scope,
        actor: userActor,
        subjectRequestId: 'dsr_01',
        requestType: 'access',
        subjectId: 'sub_01',
      }),
    },
    {
      builder: 'auditTemplates.data.exportBundleCreated',
      event: auditTemplates.data.exportBundleCreated({
        id: 'evt_export_bundle_created',
        occurredAt,
        scope,
        actor: userActor,
        exportBundleId: 'exp_01',
        format: 'jsonl',
      }),
    },
    {
      builder: 'auditTemplates.data.retentionPolicyApplied',
      event: auditTemplates.data.retentionPolicyApplied({
        id: 'evt_retention_policy_applied',
        occurredAt,
        scope,
        actor: serviceActor,
        policyId: 'security_1y',
        resourceId: 'res_01',
      }),
    },
  ],
  agent: [
    {
      builder: 'auditTemplates.agent.sessionStarted',
      event: auditTemplates.agent.sessionStarted({
        id: 'evt_agent_session_started',
        occurredAt,
        scope,
        sessionId: 'ses_agent_01',
        agentActor,
        initiatedBy: userActor,
        agent: { name: 'claude-code', version: '0.4.7' },
        model: { provider: 'anthropic', name: 'claude-opus-4' },
      }),
    },
    {
      builder: 'auditTemplates.agent.promptRecorded',
      event: auditTemplates.agent.promptRecorded({
        id: 'evt_agent_prompt_recorded',
        occurredAt,
        scope,
        sessionId: 'ses_agent_01',
        promptId: 'prm_01',
        promptHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        agentActor,
      }),
    },
    {
      builder: 'auditTemplates.agent.toolCalled',
      event: auditTemplates.agent.toolCalled({
        id: 'evt_agent_tool_called',
        occurredAt,
        scope,
        sessionId: 'ses_agent_01',
        toolCallId: 'tc_01',
        tool: 'Edit',
        status: 'succeeded',
        agentActor,
        inputHash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      }),
    },
  ],
  code: [
    {
      builder: 'auditTemplates.code.changeProposalCreated',
      event: auditTemplates.code.changeProposalCreated({
        id: 'evt_change_proposal_created',
        occurredAt,
        scope,
        proposalId: 'pr_01',
        actor: agentActor,
        sessionId: 'ses_agent_01',
        repositoryId: 'repo_01',
        branch: 'feature/templates',
      }),
    },
    {
      builder: 'auditTemplates.code.filesChanged',
      event: auditTemplates.code.filesChanged({
        id: 'evt_change_files_changed',
        occurredAt,
        scope,
        sourceTreeId: 'tree_01',
        actor: agentActor,
        sessionId: 'ses_agent_01',
        fileCount: 2,
        filePathHashes: [
          'sha256:3333333333333333333333333333333333333333333333333333333333333333',
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
        ],
      }),
    },
    {
      builder: 'auditTemplates.code.reviewApprovalRecorded',
      event: auditTemplates.code.reviewApprovalRecorded({
        id: 'evt_review_approval_recorded',
        occurredAt,
        scope,
        pullRequestId: 'pr_01',
        reviewer: userActor,
        sessionId: 'ses_agent_01',
        proposalId: 'pr_01',
      }),
    },
    {
      builder: 'auditTemplates.code.reviewFindingCreated',
      event: auditTemplates.code.reviewFindingCreated({
        id: 'evt_review_finding_created',
        occurredAt,
        scope,
        pullRequestId: 'pr_01',
        reviewer: userActor,
        proposalId: 'pr_01',
        findingCount: 1,
      }),
    },
    {
      builder: 'auditTemplates.code.reviewWaiverRecorded',
      event: auditTemplates.code.reviewWaiverRecorded({
        id: 'evt_review_waiver_recorded',
        occurredAt,
        scope,
        pullRequestId: 'pr_01',
        reviewer: userActor,
        proposalId: 'pr_01',
        waiverCount: 1,
      }),
    },
    {
      builder: 'auditTemplates.code.ciJobCompleted',
      event: auditTemplates.code.ciJobCompleted({
        id: 'evt_ci_job_completed',
        occurredAt,
        scope,
        ciRunId: 'ci_01',
        service: serviceActor,
        status: 'succeeded',
        artifactId: 'art_01',
      }),
    },
    {
      builder: 'auditTemplates.code.deploymentCreated',
      event: auditTemplates.code.deploymentCreated({
        id: 'evt_deploy_deployed',
        occurredAt,
        scope,
        deploymentId: 'dep_01',
        service: serviceActor,
        artifactId: 'art_01',
        policyId: 'pol_01',
      }),
    },
    {
      builder: 'auditTemplates.code.runtimeObserved',
      event: auditTemplates.code.runtimeObserved({
        id: 'evt_audit_runtime_observed',
        occurredAt,
        scope,
        runtimeEventId: 'rt_01',
        actor: serviceActor,
        deploymentId: 'dep_01',
        observedOutcome: 'ok',
      }),
    },
  ],
}

/**
 * `episodeStartedTemplate` is exported from `@veritio/core` in 0.4.7 but is NOT
 * reachable through the `auditTemplates` registry and its action is not listed
 * in any `auditTemplateSets` group. The catalogue records it separately so the
 * reference page documents the full exported builder surface without pretending
 * the action belongs to a published set.
 */
const unregisteredBuilders: CatalogueEntry[] = [
  {
    builder: 'episodeStartedTemplate',
    event: episodeStartedTemplate({
      id: 'evt_activity_episode_started',
      occurredAt,
      scope,
      activityEpisodeId: 'ep_01',
      actor: userActor,
      domain: 'code',
      startReason: 'agent_session',
    }),
  },
]

/** Flattens one builder result into the stable catalogue row shape. */
function row(entry: CatalogueEntry) {
  return {
    builder: entry.builder,
    action: entry.event.action,
    actorType: entry.event.actor.type,
    targetType: entry.event.target.type,
    purpose: entry.event.purpose ?? null,
    lawfulBasis: entry.event.lawfulBasis ?? null,
    retention: entry.event.retention ?? null,
  }
}

const setNames = Object.keys(auditTemplateSets) as AuditTemplateSetName[]

const bySet = setNames.map((set) => {
  const entries = catalogue[set]
  const emitted = entries.map((entry) => entry.event.action)
  const declared = [...auditTemplateSets[set]] as string[]
  return {
    set,
    declaredActions: declared,
    builders: entries.map(row),
    // Coverage is the invariant: declared order, emitted order, and builder
    // count must line up exactly, with no duplicate action strings.
    coverage: {
      declaredCount: declared.length,
      builderCount: entries.length,
      emittedMatchesDeclared: JSON.stringify(emitted) === JSON.stringify(declared),
      duplicateActions: emitted.length !== new Set(emitted).size,
    },
  }
})

const output = {
  auditTemplateSets,
  catalogue: bySet,
  unregisteredBuilders: unregisteredBuilders.map(row),
  totals: {
    sets: setNames.length,
    declaredActions: setNames.reduce((total, set) => total + auditTemplateSets[set].length, 0),
    registeredBuilders: setNames.reduce((total, set) => total + catalogue[set].length, 0),
    unregisteredBuilders: unregisteredBuilders.length,
    everySetFullyCovered: bySet.every(
      (group) => group.coverage.emittedMatchesDeclared && !group.coverage.duplicateActions,
    ),
  },
}

console.log(JSON.stringify(output, null, 2))
