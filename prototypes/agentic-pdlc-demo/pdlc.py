#!/usr/bin/env python3
"""Self-contained evidence-driven PDLC prototype (Python standard library only).

The 'agents' below are deterministic roles, not genuine LLMs. This makes the
control gates demonstrable without an external model, network or credentials.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def write_json(path: Path, value: dict) -> None:
    """Persist an evidence artifact with stable human-readable formatting."""
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def read_json(path: Path) -> dict:
    """Load a previously emitted evidence artifact from a local folder."""
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    """Hash an artifact so the reviewer can identify precisely what was tested."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_request(request: dict) -> tuple[int, int]:
    """Apply strict scope, confidentiality and input-validation constraints."""
    required = {"feature_id", "title", "description", "data_classification", "thresholds", "examples"}
    if not required.issubset(request):
        raise ValueError("Request missing fields: " + ", ".join(sorted(required - set(request))))
    if request["data_classification"] != "SYNTHETIC":
        raise ValueError("Only SYNTHETIC requests are allowed in this demonstration")
    thresholds = request["thresholds"]
    amber, red = thresholds["amber"], thresholds["red"]
    if type(amber) is not int or type(red) is not int or not (0 < amber < red <= 100):
        raise ValueError("Require integer thresholds with 0 < amber < red <= 100")
    if not isinstance(request["examples"], list) or not request["examples"]:
        raise ValueError("At least one synthetic acceptance example is required")
    for case in request["examples"]:
        if type(case.get("score")) is not int or not 0 <= case["score"] <= 100:
            raise ValueError("Acceptance scores must be integers between 0 and 100")
        if case.get("expected") not in {"GREEN", "AMBER", "RED"}:
            raise ValueError("Each example must specify a valid expected label")
    return amber, red


def planner(request: dict, folder: Path) -> tuple[int, int]:
    """Translate the feature request into a traceable, explicit delivery plan."""
    amber, red = validate_request(request)
    write_json(folder / "plan.json", {
        "feature_id": request["feature_id"],
        "title": request["title"],
        "role": "planner (deterministic simulation)",
        "scope": "Pure function classifying scores 0..100; no systems integration",
        "acceptance_criteria": [
            "score below amber => GREEN",
            "amber <= score < red => AMBER",
            "score >= red => RED",
            "noninteger/out-of-range input raises ValueError",
            "all example scenarios pass",
        ],
        "data_classification": request["data_classification"],
        "handoff": "Developer implements only the validated scoring contract",
    })
    return amber, red


def developer(amber: int, red: int, folder: Path) -> None:
    """Fill a reviewed Python template: no arbitrary generated code execution."""
    source = (
        '"""Synthetic risk classifier generated from a validated specification."""\n'
        "AMBER = " + str(amber) + "\nRED = " + str(red) + "\n\n"
        "def classify(score: int) -> str:\n"
        '    """Classify integer score 0..100 with inclusive threshold transitions."""\n'
        "    if type(score) is not int or not 0 <= score <= 100:\n"
        '        raise ValueError("score must be an integer in [0, 100]")\n'
        '    if score >= RED:\n        return "RED"\n'
        '    if score >= AMBER:\n        return "AMBER"\n'
        '    return "GREEN"\n'
    )
    (folder / "scoring.py").write_text(source, encoding="utf-8")


def tester(request: dict, amber: int, red: int, folder: Path) -> dict:
    """Generate acceptance tests and run them in a local isolated subprocess."""
    cases = [(case["score"], case["expected"]) for case in request["examples"]]
    # Include boundary cases even when the requester omits them.
    cases += [(amber - 1, "GREEN"), (amber, "AMBER"), (red - 1, "AMBER"), (red, "RED")]
    test_source = (
        "import unittest\nfrom scoring import classify\n\n"
        "class AcceptanceTests(unittest.TestCase):\n"
        "    def test_examples_and_boundaries(self):\n"
        "        for score, expected in " + repr(cases) + ":\n"
        "            with self.subTest(score=score):\n"
        "                self.assertEqual(classify(score), expected)\n\n"
        "    def test_invalid_inputs(self):\n"
        "        for value in (-1, 101, 3.14, True, None, '50'):\n"
        "            with self.subTest(value=value):\n"
        "                with self.assertRaises(ValueError):\n"
        "                    classify(value)\n\n"
        "if __name__ == '__main__':\n    unittest.main()\n"
    )
    (folder / "test_scoring.py").write_text(test_source, encoding="utf-8")
    completed = subprocess.run(
        [sys.executable, "-m", "unittest", "discover", "-s", str(folder.resolve()),
         "-p", "test_scoring.py", "-v"],
        capture_output=True, text=True, timeout=30, check=False, cwd=folder.resolve(),
    )
    result = {
        "role": "tester (deterministic simulation)",
        "passed": completed.returncode == 0,
        "exit_code": completed.returncode,
        "stdout": completed.stdout[-5000:],
        "stderr": completed.stderr[-5000:],
        "implementation_sha256": digest(folder / "scoring.py"),
        "test_sha256": digest(folder / "test_scoring.py"),
        "example_count": len(request["examples"]),
        "additional_boundary_count": 4,
    }
    write_json(folder / "test-results.json", result)
    return result


def reviewer(request: dict, folder: Path, result: dict) -> dict:
    """Enforce independent controls against current evidence, without approving."""
    plan = read_json(folder / "plan.json")
    expected = digest(folder / "scoring.py")
    checks = {
        "synthetic_data_only": request["data_classification"] == "SYNTHETIC",
        "feature_traceability": plan["feature_id"] == request["feature_id"],
        "acceptance_tests_pass": result["passed"],
        "tested_implementation_is_current": result["implementation_sha256"] == expected,
        "test_evidence_is_current": result["test_sha256"] == digest(folder / "test_scoring.py"),
        "no_external_dependencies": True,  # Fixed standard-library-only template.
    }
    evidence = {
        "role": "governance reviewer (deterministic simulation)",
        "checks": checks,
        "decision": "PASS" if all(checks.values()) else "BLOCK",
        "note": "Governance PASS permits human review; it does not release software.",
    }
    write_json(folder / "governance.json", evidence)
    return evidence


def run(request_path: Path, folder: Path) -> None:
    """Execute one end-to-end run and reset any prior human approval."""
    request = read_json(request_path)
    # Validate before resetting the output directory's approval artifact.
    validate_request(request)
    folder.mkdir(parents=True, exist_ok=True)
    for name in ("approval.json", "release.json"):
        (folder / name).unlink(missing_ok=True)
    (folder / "request.json").write_text(
        json.dumps(request, sort_keys=True, indent=2) + "\n", encoding="utf-8"
    )
    amber, red = planner(request, folder)
    developer(amber, red, folder)
    tests = tester(request, amber, red, folder)
    review = reviewer(request, folder, tests)
    print("Tests:", "PASS" if tests["passed"] else "FAIL")
    print("Governance:", review["decision"])
    print("Release: PENDING HUMAN APPROVAL" if review["decision"] == "PASS" else "Release: BLOCKED")


def approve(folder: Path, reviewer_name: str, decision: str) -> None:
    """Record a named manual decision bound to the hashes of current artifacts."""
    if not reviewer_name.strip():
        raise ValueError("Reviewer name must not be empty")
    gov = read_json(folder / "governance.json")
    tests = read_json(folder / "test-results.json")
    # Re-check evidence to catch local modifications between run and approval.
    evidence_current = (
        tests["implementation_sha256"] == digest(folder / "scoring.py")
        and tests["test_sha256"] == digest(folder / "test_scoring.py")
        and gov["decision"] == "PASS"
        and tests["passed"]
    )
    accepted = decision == "approve" and evidence_current
    approval = {
        "reviewer": reviewer_name.strip(),
        "decision": decision.upper(),
        "time_utc": datetime.now(timezone.utc).isoformat(),
        "evidence_current": evidence_current,
        "implementation_sha256": digest(folder / "scoring.py"),
        "note": "Demo attestation only: identity is not authenticated.",
    }
    write_json(folder / "approval.json", approval)
    release = {
        "status": "APPROVED_FOR_DEMO" if accepted else "BLOCKED",
        "reason": "Human-approved, matching checks" if accepted else "Rejected or stale/failed evidence",
        "deploy_performed": False,
    }
    write_json(folder / "release.json", release)
    print("Release:", release["status"])


def status(folder: Path) -> None:
    """Provide a concise stage report from persisted artifacts."""
    for filename in ("plan.json", "scoring.py", "test-results.json", "governance.json",
                     "approval.json", "release.json"):
        path = folder / filename
        label = filename
        if path.exists() and filename.endswith(".json"):
            obj = read_json(path)
            label += " (" + str(obj.get("status", obj.get("decision", "recorded"))) + ")"
        print(("[x] " if path.exists() else "[ ] ") + label)


def main() -> None:
    """Parse demonstration commands and translate errors into nonzero exit codes."""
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    run_cmd = sub.add_parser("run")
    run_cmd.add_argument("--request", type=Path, default=Path("example_request.json"))
    run_cmd.add_argument("--output", type=Path, default=Path("out"))
    status_cmd = sub.add_parser("status")
    status_cmd.add_argument("--output", type=Path, default=Path("out"))
    approve_cmd = sub.add_parser("approve")
    approve_cmd.add_argument("--output", type=Path, default=Path("out"))
    approve_cmd.add_argument("--reviewer", required=True)
    approve_cmd.add_argument("--decision", choices=["approve", "reject"], required=True)
    args = parser.parse_args()
    try:
        if args.command == "run":
            run(args.request, args.output)
        elif args.command == "status":
            status(args.output)
        else:
            approve(args.output, args.reviewer, args.decision)
    except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        parser.exit(1, "ERROR: " + str(error) + "\n")


if __name__ == "__main__":
    main()
