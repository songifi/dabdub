# Annual Security Review Schedule

## Review cadence

This schedule defines recurring annual security reviews for PCI and access controls.

| Review activity | Frequency | Responsible party | Notes |
|---|---|---|---|
| PCI compliance validation | Annually | Security owner + engineering lead | Validate SAQ scope and supporting evidence.
| RBAC and access control audit | Annually | Security owner + platform architect | Review roles, permissions, least privilege, and sensitive route protections.
| Security policy updates | Annually | Security owner | Update process docs, incident response, and vulnerability management.
| TLS / transport security review | Annually | Infrastructure / backend team | Confirm TLS 1.2+ only, HSTS enabled, and insecure ciphers/protocols disabled.
| Dependency and patching process review | Annually | Engineering lead | Verify update cadence, patch windows, and scan coverage.
| Incident response rehearsal | Annually | Security and operations teams | Test incident response workflow and communication plan.

## Calendar guidance

- Schedule reviews in the first quarter of the calendar year.
- Perform additional reviews after major architecture changes, new payment integrations, or security incidents.
- Record completed reviews in internal documentation or the project security tracker.

## Review checklist

- Confirm PCI scope documentation and payment handling assumptions.
- Verify authentication and RBAC controls for administrative and sensitive endpoints.
- Validate HTTPS/TLS enforcement across APIs and external services.
- Confirm vulnerability scanning tools are active and findings are tracked.
- Ensure incident response procedures remain up to date.
