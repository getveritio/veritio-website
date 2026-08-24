"""Cross-language parity twin of ``src/examples/risk/score-and-explain.ts``.

The invariant this fixture proves: risk scoring is language-neutral protocol
math, not a TypeScript implementation detail. It scores the SAME three pinned
signal sets as the TypeScript fixture, under the same reference policy
(``veritio.reference.v1``), and prints the score, level, policyVersion and the
ordered factor contributions. Every printed number must match the corresponding
value in ``src/examples/risk/expected/score-and-explain.txt`` exactly — if the
Python port of ``round4`` / ``_sat`` / ``clamp01`` ever drifts from the
TypeScript one, a documented score moves here and the two expected outputs stop
agreeing.

Two details make the comparison honest rather than cosmetic:

* The signal dicts are copied verbatim from the TypeScript fixture, including
  the deliberately sparse first case, so the fail-closed normalization defaults
  (recoverable / production / magnitude 0) are exercised in both languages.
* Numbers are rendered through ``canonical_json``, the cross-language byte
  contract, so a whole-valued float prints as ``1`` the way TS and Go emit it
  instead of Python's ``1.0``. Comparing raw ``repr()`` would report a false
  divergence on a score that is in fact byte-identical.

Deterministic by construction: literal inputs, pinned policy constants, no
clock, no randomness, no filesystem.

Run with the sibling SDK on the path:

    PYTHONPATH=../veritio/sdks/python/src python3 src/examples/risk/parity.py
"""

from typing import Any

from veritio import (
    DEFAULT_RISK_POLICY,
    canonical_json,
    normalize_risk_signals,
    score_risk_signals,
)

# Pinned verbatim from src/examples/risk/score-and-explain.ts. Do not "improve"
# these values: their only job is to be the same bytes the TypeScript fixture
# scores, so the two expected outputs can be diffed field by field.
RISK_SCENARIOS: list[dict[str, Any]] = [
    {
        "name": "read-config-lookup",
        "signals": {"operationType": "read"},
    },
    {
        "name": "bulk-export-staging",
        "signals": {
            "operationType": "bulk",
            "reversibility": "reversible",
            "envCriticality": "staging",
            "dataVolume": 5000,
            "fanOut": 3,
            "referenceCount": 12,
        },
    },
    {
        "name": "destructive-drop-production",
        "signals": {
            "operationType": "destructive",
            "reversibility": "irreversible",
            "envCriticality": "production",
            "dataVolume": 250000,
            "fanOut": 40,
            "referenceCount": 180,
        },
    },
]


def canonical_number(value: float) -> str:
    """Render one score/contribution the way canonical JSON hashes it.

    Parity is a claim about bytes, so the fixture must not print Python's float
    repr: ``clamp01`` returns ``1.0`` for a saturated score while TypeScript
    emits ``1``. ``canonical_json`` already coerces whole-valued finite floats to
    int for exactly this reason, so routing every number through it makes the
    printed line comparable to the TypeScript expected output instead of
    manufacturing a difference that no hash would ever see.
    """
    return canonical_json(value)


def factor_line(assessment: dict[str, Any]) -> str:
    """Flatten the ordered factor breakdown into one comparable line.

    Factor ORDER is part of the cross-language conformance contract, not a
    presentation choice, so the line is emitted in the order the scorer returns
    rather than sorted: a reordered breakdown must show up as a diff here.
    """
    return " ".join(
        f"{factor['key']}:{canonical_number(factor['contribution'])}"
        for factor in assessment["factors"]
    )


def main() -> None:
    """Print the parity report for every pinned scenario under the reference policy.

    Kept free of any ambient input (clock, environment, argv) so the program is
    byte-identical across runs and machines; the documentation pipeline diffs
    this stdout against expected/parity.txt.
    """
    print(f"policyVersion={DEFAULT_RISK_POLICY['policyVersion']}")
    print(f"bands={canonical_json(DEFAULT_RISK_POLICY['bands'])}")
    for scenario in RISK_SCENARIOS:
        assessment = score_risk_signals(scenario["signals"], DEFAULT_RISK_POLICY)
        print("")
        print(f"scenario={scenario['name']}")
        print(f"  signals={canonical_json(scenario['signals'])}")
        print(f"  normalized={canonical_json(normalize_risk_signals(scenario['signals']))}")
        print(f"  score={canonical_number(assessment['score'])}")
        print(f"  level={assessment['level']}")
        print(f"  policyVersion={assessment['policyVersion']}")
        print(f"  factors={factor_line(assessment)}")


if __name__ == "__main__":
    main()
