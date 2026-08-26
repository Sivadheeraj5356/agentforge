# Data governance

## Classification

| Class                | Examples                          | Handling                            |
| -------------------- | --------------------------------- | ----------------------------------- |
| Public               | Marketing docs                    | CDN ok                              |
| Tenant confidential  | Projects, task text, scores       | Org RLS, encrypted in transit       |
| Secrets              | Service role, R2 keys, model keys | Server-only / secret manager        |
| Evaluation artifacts | Logs, traces, bundles             | R2 with org prefixes; retention TBD |

## Retention & deletion (future)

- Org deletion cascades metadata and schedules artifact purge.
- Immutable versions are retained until explicit purge policies apply.

## Logging

- Redact secrets with `@agentforge/security` helpers before log ship.
- Do not log full task bundles or raw model API keys.
