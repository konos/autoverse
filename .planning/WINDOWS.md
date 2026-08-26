---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-26T07:46:51.486Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 06-ui | deviation | src/main/services/auth-service.ts |  | 06-09 Task 2 acceptance criterion expected exactly 2 raw _emit() left in validateToken(), but the same task explicitly forbids touching the local-JWT-expiry branch's pre-existing hardcoded _emit — actual count is 3. Gap substance (rawBody leak removal, 4-point rewiring) verified independently and passes. | open |  | 2026-08-26T07:46:51.486Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "06-ui",
    "file": "src/main/services/auth-service.ts",
    "line": null,
    "description": "06-09 Task 2 acceptance criterion expected exactly 2 raw _emit() left in validateToken(), but the same task explicitly forbids touching the local-JWT-expiry branch's pre-existing hardcoded _emit — actual count is 3. Gap substance (rawBody leak removal, 4-point rewiring) verified independently and passes.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T07:46:51.486Z",
    "resolved_at": null
  }
]
````
