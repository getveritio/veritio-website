// Package main is the Go half of the governed-action parity fixture.
//
// It runs CreateGovernedActionDraft over the SAME pinned entity definition,
// before/after rows, actor refs, occurredAt, and idempotency key as the
// TypeScript fixture in src/examples/governed/action-draft.ts, and prints the
// derived values in the identical JSON shape. The invariant it proves is
// cross-language determinism of the governed-action derivation:
//
//   - The change id and the activity id come from ONE seed —
//     sha256("<tenantId>:<idempotencyKey>") truncated to 16 hex chars — so a
//     replayed mutation reproduces the same change/activity pair in Go as in
//     TypeScript instead of forking the evidence graph per language.
//   - The revision id is content-addressed by the state digest and scoped by
//     the change id, so both SDKs land on the same rev_... identifier.
//   - The state commitment is built from the entity capture policy alone: an
//     `omit` field never reaches the commitment or the changed paths, and a
//     `content_digest` field is committed as a digest, so the Go outbox is
//     byte-comparable with the TypeScript one rather than a copy of the row.
//   - Changed paths are inferred only from governed fields, and the draft emits
//     the same three event actions and four edge relations in the same order.
//   - The draft is INPUT ONLY in Go too: AuditEventInput carries no
//     store-assigned sequence and no record hash, which this fixture shows by
//     marshalling each event and looking for those keys.
//
// Every id, timestamp, and idempotency key is pinned, so stdout is byte-stable
// across runs and byte-identical to
// src/examples/governed/expected/action-draft.txt (the TypeScript fixture's
// expected output).
package main

import (
	"encoding/json"
	"fmt"
	"sort"

	veritio "github.com/getveritio/veritio/sdks/go"
)

// derivedIDs mirrors the TypeScript fixture's `derivedIds` object field order
// so the two outputs can be compared byte-for-byte instead of semantically.
type derivedIDs struct {
	ChangeID                     string `json:"changeId"`
	ActivityID                   string `json:"activityId"`
	EntityID                     string `json:"entityId"`
	RevisionID                   string `json:"revisionId"`
	IDSeed                       string `json:"idSeed"`
	ChangeAndActivityShareOneSed bool   `json:"changeAndActivityShareOneSeed"`
}

// fieldCommitment is the committed shape of a `content_digest` governed field:
// the capture mode plus the digest of the canonical value, never the value.
type fieldCommitment struct {
	CaptureMode string `json:"captureMode"`
	Digest      string `json:"digest"`
}

// stateCommitmentView projects the draft's state commitment down to the fields
// the parity comparison depends on, in the TypeScript fixture's key order.
type stateCommitmentView struct {
	Algorithm              string          `json:"algorithm"`
	Canonicalization       string          `json:"canonicalization"`
	SchemaRef              string          `json:"schemaRef"`
	FieldSetRef            string          `json:"fieldSetRef"`
	Digest                 string          `json:"digest"`
	CommittedFields        []string        `json:"committedFields"`
	OmittedFieldPresent    bool            `json:"omittedFieldPresent"`
	AccountEmailCommitment fieldCommitment `json:"accountEmailCommitment"`
}

// draftIsInputOnlyView records that a draft is not yet evidence: it reports
// whether any emitted event already carries a store-assigned sequence or a
// record hash (both must be false until a conforming AuditStore appends them).
type draftIsInputOnlyView struct {
	Note                             string `json:"note"`
	EventsCarryStoreAssignedSequence bool   `json:"eventsCarryStoreAssignedSequence"`
	EventsCarryRecordHash            bool   `json:"eventsCarryRecordHash"`
	OutboxMutationBinding            string `json:"outboxMutationBinding"`
	OutboxSchemaVersion              string `json:"outboxSchemaVersion"`
}

// fixtureOutput is the whole printed document, ordered to match the TypeScript
// fixture's console output exactly.
type fixtureOutput struct {
	DerivedIDs      derivedIDs           `json:"derivedIds"`
	ChangedPaths    []string             `json:"changedPaths"`
	StateCommitment stateCommitmentView  `json:"stateCommitment"`
	EventActions    []string             `json:"eventActions"`
	EdgeRelations   []string             `json:"edgeRelations"`
	DraftIsInput    draftIsInputOnlyView `json:"draftIsInputOnly"`
}

// governedScope pins the tenant the idempotency seed is scoped by. The seed is
// sha256("<tenantId>:<idempotencyKey>"), so tenantId is hash-affecting input,
// not decoration.
var governedScope = veritio.EvidenceScope{TenantID: "org_acme", Environment: "production"}

// subscriptionBefore is the pinned pre-mutation row. Go rows are plain maps;
// seatCount stays an int so its canonical JSON encoding ("12") matches the
// TypeScript number literal rather than a float rendering.
var subscriptionBefore = map[string]any{
	"id":            "sub_9f31",
	"accountEmail":  "billing@acme.example",
	"plan":          "team",
	"seatCount":     12,
	"status":        "active",
	"internalNotes": "renewal call scheduled",
}

// subscriptionAfter is the pinned post-mutation row. Only `plan`, `seatCount`,
// and the ungoverned `internalNotes` differ, so exactly two governed changed
// paths must be inferred.
var subscriptionAfter = map[string]any{
	"id":            "sub_9f31",
	"accountEmail":  "billing@acme.example",
	"plan":          "enterprise",
	"seatCount":     25,
	"status":        "active",
	"internalNotes": "upgrade approved on the renewal call",
}

/*
defineSubscriptionEntity declares the governed entity. DefineEntity is the only
place field capture is decided: `internalNotes` is `omit` so operator prose can
never reach the commitment or the changed paths, and `accountEmail` is
`content_digest` so the PII value is committed as a digest. The capture policy
is hash-affecting, so it must be declared identically to the TypeScript fixture
for the digests to agree.
*/
func defineSubscriptionEntity() (veritio.GovernedEntityDefinition, error) {
	return veritio.DefineEntity(veritio.GovernedEntityDefinition{
		Authority:   "acme-billing",
		Type:        "subscription",
		SchemaRef:   "acme://schemas/subscription@3",
		FieldSetRef: "acme://fieldsets/subscription-governed@1",
		Identity: func(row map[string]any) string {
			id, _ := row["id"].(string)
			return id
		},
		Fields: map[string]veritio.EntityFieldPolicy{
			"id":            {Capture: "full"},
			"plan":          {Capture: "full"},
			"seatCount":     {Capture: "full"},
			"status":        {Capture: "full"},
			"accountEmail":  {Capture: "content_digest"},
			"internalNotes": {Capture: "omit"},
		},
	})
}

/*
buildSubscriptionUpgradeDraft builds the pinned upgrade draft. Every input that
feeds an id, a digest, or a changed path is fixed here — no clock, no random
source — so the derivation is reproducible and directly comparable with the
TypeScript and Python SDKs.
*/
func buildSubscriptionUpgradeDraft() (veritio.GovernedChangeDraft, error) {
	entity, err := defineSubscriptionEntity()
	if err != nil {
		return veritio.GovernedChangeDraft{}, err
	}
	return veritio.CreateGovernedActionDraft(veritio.GovernedActionDraftInput{
		Scope:           governedScope,
		Entity:          entity,
		Before:          subscriptionBefore,
		After:           subscriptionAfter,
		ActionType:      "subscription.upgraded",
		ActivityType:    "billing.plan_change",
		InitiatedBy:     veritio.EvidenceRef{Authority: "acme-billing", Kind: "principal", Type: "user", ID: "usr_owner"},
		PerformedBy:     veritio.EvidenceRef{Authority: "acme-billing", Kind: "principal", Type: "service", ID: "svc_billing_api"},
		Producer:        veritio.EvidenceRef{Authority: "acme-billing", Kind: "principal", Type: "service", ID: "svc_billing_api"},
		OccurredAt:      "2026-08-09T10:00:00.000Z",
		IdempotencyKey:  "subscription.upgraded:sub_9f31:req_7c2a",
		MutationBinding: "same_transaction",
	})
}

/*
eventCarriesKey reports whether any drafted event serializes the given key. It
is the Go equivalent of the TypeScript fixture's `'sequence' in event` probe:
AuditEventInput has no sequence or hash member at all, so a draft can never
present itself as an appended record.
*/
func eventCarriesKey(events []veritio.AuditEventInput, key string) (bool, error) {
	for _, event := range events {
		encoded, err := json.Marshal(event)
		if err != nil {
			return false, err
		}
		var decoded map[string]any
		if err := json.Unmarshal(encoded, &decoded); err != nil {
			return false, err
		}
		if _, ok := decoded[key]; ok {
			return true, nil
		}
	}
	return false, nil
}

/*
main prints the parity document. Failures panic rather than printing a partial
document, so a fixture that cannot derive the pinned draft fails the CI byte
comparison loudly instead of silently drifting.
*/
func main() {
	draft, err := buildSubscriptionUpgradeDraft()
	if err != nil {
		panic(err)
	}

	changeID := draft.ChangeRef.ID
	idSeed := changeID[len("chg_subscription_")+len(draft.EntityRef.ID)+1:]

	committedFields := make([]string, 0, len(draft.Revision.StateCommitment.Fields))
	for field := range draft.Revision.StateCommitment.Fields {
		committedFields = append(committedFields, field)
	}
	sort.Strings(committedFields)

	_, omittedFieldPresent := draft.Revision.StateCommitment.Fields["internalNotes"]

	accountEmail, ok := draft.Revision.StateCommitment.Fields["accountEmail"].(map[string]any)
	if !ok {
		panic("accountEmail must be committed as a content digest")
	}
	captureMode, _ := accountEmail["captureMode"].(string)
	accountEmailDigest, _ := accountEmail["digest"].(string)

	eventActions := make([]string, 0, len(draft.Events))
	for _, event := range draft.Events {
		eventActions = append(eventActions, event.Action)
	}
	edgeRelations := make([]string, 0, len(draft.Edges))
	for _, edge := range draft.Edges {
		edgeRelations = append(edgeRelations, edge.Relation)
	}

	carriesSequence, err := eventCarriesKey(draft.Events, "sequence")
	if err != nil {
		panic(err)
	}
	carriesHash, err := eventCarriesKey(draft.Events, "hash")
	if err != nil {
		panic(err)
	}

	output := fixtureOutput{
		DerivedIDs: derivedIDs{
			ChangeID:   changeID,
			ActivityID: draft.ActivityRef.ID,
			EntityID:   draft.EntityRef.ID,
			RevisionID: draft.Revision.Ref.ID,
			IDSeed:     idSeed,
			ChangeAndActivityShareOneSed: changeID == fmt.Sprintf("chg_subscription_%s_%s", draft.EntityRef.ID, idSeed) &&
				draft.ActivityRef.ID == fmt.Sprintf("act_subscription_%s_%s", draft.EntityRef.ID, idSeed),
		},
		ChangedPaths: draft.Revision.ChangedPaths,
		StateCommitment: stateCommitmentView{
			Algorithm:              draft.Revision.StateCommitment.Algorithm,
			Canonicalization:       draft.Revision.StateCommitment.Canonicalization,
			SchemaRef:              draft.Revision.StateCommitment.SchemaRef,
			FieldSetRef:            draft.Revision.StateCommitment.FieldSetRef,
			Digest:                 draft.Revision.StateCommitment.Digest,
			CommittedFields:        committedFields,
			OmittedFieldPresent:    omittedFieldPresent,
			AccountEmailCommitment: fieldCommitment{CaptureMode: captureMode, Digest: accountEmailDigest},
		},
		EventActions:  eventActions,
		EdgeRelations: edgeRelations,
		DraftIsInput: draftIsInputOnlyView{
			Note:                             "CreateGovernedActionDraft returns evidence INPUTS, not persisted records. Append draft.OutboxEntry through a conforming AuditStore inside the same mutation to make it evidence.",
			EventsCarryStoreAssignedSequence: carriesSequence,
			EventsCarryRecordHash:            carriesHash,
			OutboxMutationBinding:            draft.OutboxEntry.MutationBinding,
			OutboxSchemaVersion:              draft.OutboxEntry.SchemaVersion,
		},
	}

	encoded, err := json.MarshalIndent(output, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(encoded))
}
