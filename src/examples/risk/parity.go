// Command parity is the Go cross-language twin of
// src/examples/risk/score-and-explain.ts (and of src/examples/risk/parity.py).
//
// The invariant this fixture proves: risk scoring is language-neutral protocol
// math, not a TypeScript implementation detail. It scores the SAME three pinned
// signal sets as the TypeScript fixture, under the same reference policy
// (veritio.reference.v1), and prints the score, level, policyVersion and the
// ordered factor contributions. Every printed number must match the
// corresponding value in src/examples/risk/expected/score-and-explain.txt
// exactly — if the Go port of round4 / sat / clamp01 ever drifts from the
// TypeScript one, a documented score moves here and the two expected outputs
// stop agreeing. The stdout is deliberately byte-identical to the Python twin's
// expected output, so all three SDKs share one comparable artifact.
//
// Three details make the comparison honest rather than cosmetic:
//
//   - The signal sets are copied verbatim from the TypeScript fixture,
//     including the deliberately sparse first case, so the fail-closed
//     normalization defaults (recoverable / production / magnitude 0) are
//     exercised in every language.
//   - Numbers are rendered through CanonicalJSON, the cross-language byte
//     contract, rather than through Go's %v or strconv, so the printed digits
//     are the digits a hash would see.
//   - ScoreRiskSignals returns an error in Go where TS/Python throw; the
//     fixture aborts instead of printing a degraded score, because a fixture
//     that silently prints score=0 for a rejected signal would document the
//     opposite of the fail-closed contract.
//
// Deterministic by construction: literal inputs, pinned policy constants, no
// clock, no randomness, no filesystem, no map-iteration order in the output
// (CanonicalJSON sorts keys).
//
// Run with the sibling SDK wired in via a replace directive:
//
//	cp src/examples/risk/parity.go <tmpmod>/main.go && go run .
package main

import (
	"fmt"
	"os"
	"strings"

	veritio "github.com/getveritio/veritio/sdks/go"
)

// riskScenario is one pinned, named signal set. The name is part of the printed
// output so a diff points at the scenario that moved rather than at a line
// number.
type riskScenario struct {
	name    string
	signals veritio.RiskSignals
}

// riskScenarios is pinned verbatim from src/examples/risk/score-and-explain.ts.
// Do not "improve" these values: their only job is to be the same inputs the
// TypeScript and Python fixtures score, so the three expected outputs can be
// diffed field by field. Omitted fields stay at Go's zero value, which is
// exactly how this SDK spells "signal not supplied".
var riskScenarios = []riskScenario{
	{
		name:    "read-config-lookup",
		signals: veritio.RiskSignals{OperationType: "read"},
	},
	{
		name: "bulk-export-staging",
		signals: veritio.RiskSignals{
			OperationType:  "bulk",
			Reversibility:  "reversible",
			EnvCriticality: "staging",
			DataVolume:     5000,
			FanOut:         3,
			ReferenceCount: 12,
		},
	},
	{
		name: "destructive-drop-production",
		signals: veritio.RiskSignals{
			OperationType:  "destructive",
			Reversibility:  "irreversible",
			EnvCriticality: "production",
			DataVolume:     250000,
			FanOut:         40,
			ReferenceCount: 180,
		},
	},
}

// fatal aborts the fixture on any error from the SDK.
//
// Risk normalization and scoring fail closed by design, so swallowing an error
// and printing a partial line would turn this fixture into documentation for
// behavior the SDK does not have. Exiting non-zero also makes the CI harness
// treat a regression as a failure instead of recording a new expected output.
func fatal(err error) {
	fmt.Fprintln(os.Stderr, "risk parity fixture failed:", err)
	os.Exit(1)
}

// canonicalJSON renders a value through the cross-language canonical byte
// contract, aborting if it cannot be encoded.
//
// Parity is a claim about bytes, so the fixture must never fall back to Go's
// default formatting: CanonicalJSON sorts object keys and emits whole-valued
// floats as "1" rather than "1.0", which is what makes these lines comparable
// to the TypeScript and Python outputs instead of manufacturing a difference no
// hash would ever see.
func canonicalJSON(value any) string {
	encoded, err := veritio.CanonicalJSON(value)
	if err != nil {
		fatal(err)
	}
	return encoded
}

// bandsJSON renders the policy bands under their protocol JSON key names.
//
// veritio.RiskBands is a plain Go struct with exported fields and no JSON tags,
// so encoding it directly would print "Low"/"Medium"/… and falsely diverge from
// the TypeScript and Python fixtures. The band thresholds — not the Go field
// spelling — are the protocol surface being pinned here.
func bandsJSON(bands veritio.RiskBands) string {
	return canonicalJSON(map[string]any{
		"low":      bands.Low,
		"medium":   bands.Medium,
		"high":     bands.High,
		"critical": bands.Critical,
	})
}

// rawSignalsJSON renders the caller-supplied signals as the sparse literal the
// TypeScript and Python fixtures declare.
//
// Go has no way to spell "field absent" in a struct: the zero value IS absence,
// which is precisely why NormalizeRiskSignals defaults an empty enum and treats
// a zero magnitude as unsupplied. Omitting zero-valued optional fields here
// reproduces the sparse TS/Python input object, so the following "normalized"
// line demonstrably shows defaults being FILLED IN rather than echoed back.
func rawSignalsJSON(signals veritio.RiskSignals) string {
	raw := map[string]any{"operationType": signals.OperationType}
	if signals.Reversibility != "" {
		raw["reversibility"] = signals.Reversibility
	}
	if signals.EnvCriticality != "" {
		raw["envCriticality"] = signals.EnvCriticality
	}
	if signals.DataVolume != 0 {
		raw["dataVolume"] = signals.DataVolume
	}
	if signals.FanOut != 0 {
		raw["fanOut"] = signals.FanOut
	}
	if signals.ReferenceCount != 0 {
		raw["referenceCount"] = signals.ReferenceCount
	}
	return canonicalJSON(raw)
}

// factorLine flattens the ordered factor breakdown into one comparable line.
//
// Factor ORDER is part of the cross-SDK explainability contract, not a
// presentation choice, so the line is emitted in the order ScoreRiskSignals
// returns rather than sorted: a reordered breakdown must show up as a diff here.
func factorLine(assessment veritio.RiskAssessment) string {
	parts := make([]string, len(assessment.Factors))
	for index, factor := range assessment.Factors {
		parts[index] = factor.Key + ":" + canonicalJSON(factor.Contribution)
	}
	return strings.Join(parts, " ")
}

// main prints the parity report for every pinned scenario under the reference
// policy.
//
// Kept free of any ambient input (clock, environment, argv) so the program is
// byte-identical across runs and machines; the documentation pipeline diffs this
// stdout against the checked-in expected output.
func main() {
	fmt.Printf("policyVersion=%s\n", veritio.DefaultRiskPolicy.PolicyVersion)
	fmt.Printf("bands=%s\n", bandsJSON(veritio.DefaultRiskPolicy.Bands))
	for _, scenario := range riskScenarios {
		normalized, err := veritio.NormalizeRiskSignals(scenario.signals)
		if err != nil {
			fatal(err)
		}
		assessment, err := veritio.ScoreRiskSignals(scenario.signals, veritio.DefaultRiskPolicy)
		if err != nil {
			fatal(err)
		}
		fmt.Println("")
		fmt.Printf("scenario=%s\n", scenario.name)
		fmt.Printf("  signals=%s\n", rawSignalsJSON(scenario.signals))
		fmt.Printf("  normalized=%s\n", canonicalJSON(normalized))
		fmt.Printf("  score=%s\n", canonicalJSON(assessment.Score))
		fmt.Printf("  level=%s\n", assessment.Level)
		fmt.Printf("  policyVersion=%s\n", assessment.PolicyVersion)
		fmt.Printf("  factors=%s\n", factorLine(assessment))
	}
}
