"""Regression tests for orchestration and release governance.

These tests intentionally use temporary folders and only synthetic requests.
They exercise the complete pipeline rather than simply inspecting source text.
"""
import json
import tempfile
import unittest
from pathlib import Path

from pdlc import approve, read_json, run, validate_request


class PdlcPipelineTests(unittest.TestCase):
    """Verify success, failed validation and tampering with implementation evidence."""

    def setUp(self):
        """Build a fresh isolated workspace for each scenario."""
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.output = self.root / "out"
        self.request = self.root / "request.json"
        self.example = {
            "feature_id": "TEST-001",
            "title": "Synthetic example",
            "description": "Fixture only",
            "data_classification": "SYNTHETIC",
            "thresholds": {"amber": 40, "red": 75},
            "examples": [
                {"score": 39, "expected": "GREEN"},
                {"score": 40, "expected": "AMBER"},
                {"score": 75, "expected": "RED"},
            ],
        }
        self.request.write_text(json.dumps(self.example), encoding="utf-8")

    def test_human_gate_is_required_even_after_tests_pass(self):
        """A passing automated pipeline must not mark itself approved."""
        run(self.request, self.output)
        self.assertTrue(read_json(self.output / "test-results.json")["passed"])
        self.assertEqual(read_json(self.output / "governance.json")["decision"], "PASS")
        self.assertFalse((self.output / "release.json").exists())
        approve(self.output, "Synthetic Reviewer", "approve")
        self.assertEqual(read_json(self.output / "release.json")["status"], "APPROVED_FOR_DEMO")
        self.assertFalse(read_json(self.output / "release.json")["deploy_performed"])

    def test_tampered_code_cannot_be_approved(self):
        """Evidence hashes invalidate any implementation altered after testing."""
        run(self.request, self.output)
        (self.output / "scoring.py").write_text("def classify(x): return 'RED'\n", encoding="utf-8")
        approve(self.output, "Synthetic Reviewer", "approve")
        self.assertEqual(read_json(self.output / "release.json")["status"], "BLOCKED")
        self.assertFalse(read_json(self.output / "approval.json")["evidence_current"])

    def test_human_rejection_blocks_release(self):
        """A reviewer can decline a perfectly passing automation result."""
        run(self.request, self.output)
        approve(self.output, "Synthetic Reviewer", "reject")
        self.assertEqual(read_json(self.output / "release.json")["status"], "BLOCKED")

    def test_non_synthetic_request_is_rejected(self):
        """Protect the demonstration from accidental confidential input."""
        self.example["data_classification"] = "CONFIDENTIAL"
        with self.assertRaises(ValueError):
            validate_request(self.example)

    def test_invalid_thresholds_are_rejected(self):
        """Prevent nonsensical parameter combinations before any generation."""
        self.example["thresholds"] = {"amber": 75, "red": 40}
        with self.assertRaises(ValueError):
            validate_request(self.example)


if __name__ == "__main__":
    unittest.main()
