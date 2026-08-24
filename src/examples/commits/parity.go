/*
Package main proves cross-language parity of the veritio-merkle-v1 evidence
commit tree.

This fixture rebuilds, with the Go SDK, the exact pinned commit that
src/examples/commits/merkle-root.ts builds with the TypeScript SDK: the same
three membership events, the same pinned appendedAt, the same tenant-scoped
idempotency keys, the same commit id / stream / sequence / committedAt. If the
canonical JSON, the audit-record envelope hash, the Merkle leaf/parent domain
separation, or the commit hash preimage drifted between languages, the printed
recordHash values, recordsRoot, or commitHash would differ from the TypeScript
expected output. Byte-identical values are the proof that they have not.

It also re-proves in Go the ordering invariant the TypeScript fixture proves:
EvidenceCommit member order is protocol-canonical, not caller-dependent, so two
callers handing the same manifest in different slice orders get the same root
and the same commit hash.

Scope note: chain verification over audit records (verifyAuditRecords) exists
only in the TypeScript SDK. Go implements VerifyEvidenceCommits, which proves
the commit ledger's internal consistency, so that is what this fixture asserts.
Every value below is pinned; the program is deterministic across runs.
*/
package main

import (
	"encoding/json"
	"fmt"

	veritio "github.com/getveritio/veritio/sdks/go"
)

// commitTenantID is the tenant scope every pinned record and idempotency key is
// bound to. It matches commitScope.tenantId in merkle-root.ts.
const commitTenantID = "org_acme"

// pinnedAppendedAt stands in for the wall-clock stamp a conforming AuditStore
// would write. It is pinned because it is hash-affecting: a live value would
// move every record hash between runs and defeat the parity comparison.
const pinnedAppendedAt = "2026-08-09T10:03:00.000Z"

// membershipEntry pairs one pinned audit event input with the host idempotency
// key the store would bind to it.
type membershipEntry struct {
	input          veritio.AuditEventInput
	idempotencyKey string
}

// commitScope is the shared evidence scope of the pinned membership stream.
func commitScope() *veritio.EvidenceScope {
	return &veritio.EvidenceScope{TenantID: commitTenantID, Environment: "production"}
}

// membershipEntries returns the same three membership events, in the same
// order and with the same field values, that the TypeScript fixture pins. Any
// divergence here invalidates the parity claim, so these literals must stay in
// lockstep with merkle-root.ts.
func membershipEntries() []membershipEntry {
	return []membershipEntry{
		{
			input: veritio.AuditEventInput{
				ID:          "evt_member_invited_01",
				OccurredAt:  "2026-08-09T10:00:00.000Z",
				Actor:       veritio.Principal{Type: "user", ID: "usr_owner"},
				Action:      "organization.member.invited",
				Target:      veritio.Resource{Type: "organization", ID: "org_acme"},
				Scope:       commitScope(),
				Purpose:     "access_management",
				LawfulBasis: "contract",
				Retention:   "security_1y",
				Metadata:    map[string]any{"role": "viewer"},
			},
			idempotencyKey: "invitation:inv_123",
		},
		{
			input: veritio.AuditEventInput{
				ID:          "evt_member_joined_01",
				OccurredAt:  "2026-08-09T10:01:00.000Z",
				Actor:       veritio.Principal{Type: "user", ID: "usr_member"},
				Action:      "organization.member.joined",
				Target:      veritio.Resource{Type: "organization", ID: "org_acme"},
				Scope:       commitScope(),
				Purpose:     "access_management",
				LawfulBasis: "contract",
				Retention:   "security_1y",
				Metadata:    map[string]any{"role": "viewer"},
			},
			idempotencyKey: "membership:mem_123",
		},
		{
			input: veritio.AuditEventInput{
				ID:          "evt_member_promoted_01",
				OccurredAt:  "2026-08-09T10:02:00.000Z",
				Actor:       veritio.Principal{Type: "user", ID: "usr_owner"},
				Action:      "organization.member.promoted",
				Target:      veritio.Resource{Type: "organization", ID: "org_acme"},
				Scope:       commitScope(),
				Purpose:     "access_management",
				LawfulBasis: "contract",
				Retention:   "security_1y",
				Metadata:    map[string]any{"role": "admin"},
			},
			idempotencyKey: "promotion:mem_123",
		},
	}
}

// pinnedMembershipRecords builds the three audit records the commit manifest
// binds, the way a conforming store builds a chain: sequence starts at 1,
// previousHash links to the prior record hash, and the envelope hash comes from
// the protocol helper rather than a placeholder. Only appendedAt is pinned.
func pinnedMembershipRecords() ([]veritio.AuditRecord, error) {
	entries := membershipEntries()
	records := make([]veritio.AuditRecord, 0, len(entries))
	var previousHash *string

	for position, entry := range entries {
		event, err := veritio.CreateAuditEvent(entry.input)
		if err != nil {
			return nil, err
		}
		idempotencyKeyHash, err := veritio.HashIdempotencyKey(commitTenantID, entry.idempotencyKey)
		if err != nil {
			return nil, err
		}

		record := veritio.AuditRecord{
			Event:              event,
			Sequence:           position + 1,
			PreviousHash:       previousHash,
			HashAlgorithm:      veritio.HashAlgorithm,
			Canonicalization:   veritio.Canonicalization,
			AppendedAt:         pinnedAppendedAt,
			IdempotencyKeyHash: idempotencyKeyHash,
		}
		hash, err := veritio.HashAuditRecord(record)
		if err != nil {
			return nil, err
		}
		record.Hash = hash
		records = append(records, record)

		linked := hash
		previousHash = &linked
	}

	return records, nil
}

// commitMembersFor projects persisted records into a commit manifest.
// recordHash must be the algorithm-qualified sha256:<hex> form even though v1
// audit record hashes are stored bare, and index — not slice position — is the
// field the protocol canonicalizes and sorts on.
func commitMembersFor(records []veritio.AuditRecord) []veritio.EvidenceCommitMember {
	members := make([]veritio.EvidenceCommitMember, 0, len(records))
	for position, record := range records {
		members = append(members, veritio.EvidenceCommitMember{
			Index:      position,
			RecordType: "audit.record",
			RecordID:   record.Event.ID,
			RecordHash: "sha256:" + record.Hash,
		})
	}
	return members
}

// commitOf commits a manifest in whatever slice order the caller happens to
// hold it. Commit id, stream, sequence, previousCommitHash, and committedAt are
// pinned to the TypeScript fixture's values so the Merkle root and commit hash
// are reproducible across runs and across languages.
func commitOf(members []veritio.EvidenceCommitMember) (veritio.EvidenceCommit, error) {
	ordered := make([]veritio.EvidenceCommitMember, len(members))
	copy(ordered, members)
	return veritio.CreateEvidenceCommit(veritio.EvidenceCommitInput{
		CommitID:           "cmt_membership_01",
		StreamID:           "org_acme:production",
		Sequence:           1,
		PreviousCommitHash: nil,
		Members:            ordered,
		CommittedAt:        "2026-08-09T10:05:00.000Z",
	})
}

// suppliedMember is the compact projection of a caller-supplied member used to
// show the deliberately non-canonical input ordering.
type suppliedMember struct {
	Index    int    `json:"index"`
	RecordID string `json:"recordId"`
}

// canonicalMember mirrors the member fields the protocol canonicalizes, so the
// printed manifest can be diffed field-for-field against the TypeScript output.
type canonicalMember struct {
	Index      int    `json:"index"`
	RecordType string `json:"recordType"`
	RecordID   string `json:"recordId"`
	RecordHash string `json:"recordHash"`
}

// parityReport fixes the output key order to match the TypeScript fixture's
// object literal, so the two expected files can be diffed directly. Go maps
// would serialize in alphabetical order and break that comparison.
type parityReport struct {
	SuppliedOrder        []suppliedMember                         `json:"suppliedOrder"`
	CanonicalMemberOrder []canonicalMember                        `json:"canonicalMemberOrder"`
	RecordCount          int                                      `json:"recordCount"`
	TreeAlgorithm        string                                   `json:"treeAlgorithm"`
	RecordsRoot          string                                   `json:"recordsRoot"`
	CommitHash           string                                   `json:"commitHash"`
	HashSelfConsistent   bool                                     `json:"hashSelfConsistent"`
	OrderIndependent     bool                                     `json:"orderIndependent"`
	CommitVerification   veritio.EvidenceCommitVerificationResult `json:"commitVerification"`
}

// main builds the pinned commit twice from two different caller orderings and
// prints the canonical manifest, the veritio-merkle-v1 recordsRoot, and the
// commit hash. The printed digests must equal the ones in
// src/examples/commits/expected/merkle-root.txt.
func main() {
	records, err := pinnedMembershipRecords()
	if err != nil {
		panic(err)
	}
	members := commitMembersFor(records)

	// Two deliberately different caller orderings of the same three members.
	shuffled := []veritio.EvidenceCommitMember{members[2], members[0], members[1]}
	reversed := []veritio.EvidenceCommitMember{members[2], members[1], members[0]}

	commit, err := commitOf(shuffled)
	if err != nil {
		panic(err)
	}
	rebuilt, err := commitOf(reversed)
	if err != nil {
		panic(err)
	}

	recomputed, err := veritio.HashEvidenceCommit(commit)
	if err != nil {
		panic(err)
	}

	supplied := make([]suppliedMember, 0, len(shuffled))
	for _, member := range shuffled {
		supplied = append(supplied, suppliedMember{Index: member.Index, RecordID: member.RecordID})
	}
	canonical := make([]canonicalMember, 0, len(commit.Members))
	for _, member := range commit.Members {
		canonical = append(canonical, canonicalMember{
			Index:      member.Index,
			RecordType: member.RecordType,
			RecordID:   member.RecordID,
			RecordHash: member.RecordHash,
		})
	}

	report := parityReport{
		SuppliedOrder:        supplied,
		CanonicalMemberOrder: canonical,
		RecordCount:          commit.RecordCount,
		TreeAlgorithm:        commit.TreeAlgorithm,
		RecordsRoot:          commit.RecordsRoot,
		CommitHash:           commit.Hash,
		HashSelfConsistent:   recomputed == commit.Hash,
		OrderIndependent:     rebuilt.Hash == commit.Hash && rebuilt.RecordsRoot == commit.RecordsRoot,
		CommitVerification:   veritio.VerifyEvidenceCommits([]veritio.EvidenceCommit{commit}),
	}

	encoded, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(encoded))
}
