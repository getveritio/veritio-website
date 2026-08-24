package main

import (
	"fmt"

	veritio "github.com/getveritio/veritio/sdks/go"
)

func main() {
	event, err := veritio.CreateAuditEvent(veritio.AuditEventInput{
		ID:          "evt_member_invited_01",
		OccurredAt:  "2026-08-09T10:00:00.000Z",
		Actor:       veritio.Principal{Type: "user", ID: "usr_123"},
		Action:      "organization.member.invited",
		Target:      veritio.Resource{Type: "organization", ID: "org_acme"},
		Scope:       &veritio.EvidenceScope{TenantID: "org_acme", Environment: "production"},
		Purpose:     "access_management",
		LawfulBasis: "contract",
		Retention:   "security_1y",
		Metadata:    map[string]any{"role": "viewer"},
	})
	if err != nil {
		panic(err)
	}

	hash, err := veritio.HashAuditEvent(event, nil)
	if err != nil {
		panic(err)
	}
	fmt.Printf("event=%s hash=%s\n", event.ID, hash[:12])
}
