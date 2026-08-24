from veritio import create_audit_event, hash_audit_event

event = create_audit_event(
    {
        "id": "evt_member_invited_01",
        "occurredAt": "2026-08-09T10:00:00.000Z",
        "actor": {"type": "user", "id": "usr_123"},
        "action": "organization.member.invited",
        "target": {"type": "organization", "id": "org_acme"},
        "scope": {"tenantId": "org_acme", "environment": "production"},
        "purpose": "access_management",
        "lawfulBasis": "contract",
        "retention": "security_1y",
        "metadata": {"role": "viewer"},
    }
)

event_hash = hash_audit_event(event)
print({"eventId": event["id"], "hashPrefix": event_hash[:12]})
