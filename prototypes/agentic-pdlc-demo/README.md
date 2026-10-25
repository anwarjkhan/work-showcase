# Agentic PDLC: controlled delivery demonstration

A **runnable, self-contained, synthetic** example of a Product Development Lifecycle with specialised roles and evidence-based release gates.

**Important:** The roles are deterministic simulations of agents, not LLM-driven autonomous agents. The purpose is to demonstrate the **orchestration and control architecture** without API keys, model dependencies or confidential bank data. An actual LLM/tool-calling adapter is a future extension.

## What it demonstrates

A fictional request to classify delivery-risk exposure moves through five stages:

1. **Planner** translates a structured request into an implementation plan and acceptance criteria.
2. **Developer** generates a small, executable Python scoring module.
3. **Tester** generates and executes acceptance tests against the implementation.
4. **Governance reviewer** checks the scope, provenance, automated test evidence, and policy constraints.
5. **Human approver** explicitly approves or rejects the run. No automatic deployment is performed.

Each stage leaves versionable evidence. A failed test, invalid request or missing approval blocks release.

## Run the demonstration

Requirements: Python **3.10+**, no third-party packages. From this directory:

```bash
python pdlc.py run --request example_request.json --output ./out
python pdlc.py status --output ./out
python pdlc.py approve --output ./out --reviewer "Demo Reviewer" --decision approve
python pdlc.py status --output ./out
```

To see a governance hold instead:

```bash
python pdlc.py approve --output ./out --reviewer "Demo Reviewer" --decision reject
```

Approval must be supported by the actual evidence. This is a **demonstration approval**, not a corporate change-control authorisation.

Inspect `out/plan.json`, `out/scoring.py`, `out/test_scoring.py`, `out/test-results.json`, `out/governance.json`, `out/approval.json` and `out/release.json`. The generated `out/` folder is local and should not be committed.

## Business case to show stakeholders

| Conventional handoffs | Controlled agent workflow |
| --- | --- |
| Manual restatement of requirements | Structured plan and explicit acceptance criteria |
| Development and testing evidence scattered | Generated implementation plus repeatable tests |
| Governance often retrospective | Evidence checks before any approval |
| Release status assembled manually | Machine-readable status and blockers |
| Unclear decision accountability | Explicit named human approval gate |

These are **capability illustrations**, not measured savings or performance claims.

## Architecture

```text
Synthetic feature request
        |
   [Planner] ---> plan.json
        |
  [Developer] --> scoring.py
        |
   [Tester] ---> test_scoring.py + test-results.json
        |
  [Reviewer] --> governance.json (PASS/BLOCK)
        |
 [Human gate] --> approval.json --> release.json (APPROVED/BLOCKED)
```

## Controls and limitations

- No live banking systems, customer records or external APIs.
- The developer fills a vetted template instead of authoring arbitrary code.
- Tester derives cases from request examples plus boundary checks.
- An executed test result is required before governance may pass.
- Test passing alone is not human approval.
- A human name in the CLI is **not authenticated**; a real system needs SSO, RBAC, audit storage and segregation of duties.
- No measured time/cost reduction is implied. The repository is a demonstrator, not production infrastructure.
- A production PDLC should add signed evidence, model evaluations, prompt/version tracking, traceability to change tickets, secure sandboxes and policy-as-code.

## Extension path

Replace the role implementations with controlled LLM calls that generate **proposals**, validate against strict schemas, execute only through scoped tools, and retain the same independent governance and human gates. Keep testers and reviewers separate from the code-generating role.
