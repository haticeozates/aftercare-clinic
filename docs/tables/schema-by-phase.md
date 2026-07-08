---
type: Schema
title: Schema by Phase
description: Postgres tables, storage buckets, and migration files organized by delivery phase.
resource: supabase/migrations/
tags: [schema, postgres, migrations]
timestamp: 2026-07-08T21:31:00Z
---

# Migration Index

| Migration file | Phase |
|----------------|-------|
| `20260706000000_foundation.sql` | Faz 0–1 |
| `20260706010000_clients_procedures.sql` | Faz 2 |
| `20260706020000_care_templates.sql` | Faz 3 |
| `20260706030000_care_plans_secure_links.sql` | Faz 4 |
| `20260706040000_portal_daily_tasks.sql` | Faz 5 |
| `20260706050000_structured_checkins_alerts.sql` | Faz 6 |
| `20260706060000_photo_storage_foundation.sql` | Faz 7.1 |
| `20260706070000_photo_upload_finalize.sql` | Faz 7.2 |
| `20260706071000_photo_upload_intent_rpc.sql` | Faz 7.2 |
| `20260706072000_portal_photo_request_dto.sql` | Faz 7.3 |
| `20260706073000_clinic_photo_view_authorization.sql` | Faz 7.3B |
| `20260706074000_photo_cleanup_foundation.sql` | Faz 7.4 |
| `20260706080000_consent_data_request_foundation.sql` | Faz 8.1 |
| `20260706081000_portal_consent_data_requests.sql` | Faz 8.2 |
| `20260706082000_clinic_consent_management.sql` | Faz 8.3A |
| `20260706082100_clinic_consent_management_corrections.sql` | Faz 8.3A |
| `20260706082200_phase8_3b_clinic_assignment_and_data_request_review.sql` | Faz 8.3B |

# Foundation (Faz 0–1)

| Table | Purpose |
|-------|---------|
| `organizations` | Tenant root |
| `user_profiles` | User display metadata |
| `roles` | `organization_owner`, `organization_admin`, `staff` |
| `permissions` | Fine-grained permission keys |
| `role_permissions` | Role → permission mapping |
| `organization_memberships` | User ↔ org ↔ role binding |
| `audit_logs` | Append-only security audit |

# Clients and Procedures (Faz 2)

| Table | Purpose |
|-------|---------|
| `clients` | Tenant-safe client records |
| `procedures` | Procedure catalog |

# Care Templates (Faz 3)

| Table | Purpose |
|-------|---------|
| `care_templates` | Template header |
| `care_template_versions` | Draft/published/retired versions |
| `care_template_days` | Day definitions per version |
| `care_template_tasks` | Tasks per day |
| `symptom_options` | Check-in symptom choices |
| `alert_rules` | Deterministic alert triggers |

# Care Plans and Secure Links (Faz 4)

| Table | Purpose |
|-------|---------|
| `care_plans` | Plan snapshot from published template |
| `care_plan_days` | Snapshot days with scheduled dates |
| `care_plan_tasks` | Snapshot tasks |
| `secure_links` | Hashed access tokens for portal entry |

# Portal Daily Tasks (Faz 5)

| Table | Purpose |
|-------|---------|
| `portal_sessions` | Short-lived portal session records |
| `care_plan_task_events` | Append-only task complete/reopen history |

# Check-ins and Alerts (Faz 6)

| Table | Purpose |
|-------|---------|
| `care_plan_symptom_options` | Plan-specific symptom snapshot |
| `care_plan_alert_rules` | Plan-specific rule snapshot |
| `symptom_reports` | Portal check-in header |
| `symptom_report_items` | Selected symptoms + severity |
| `alerts` | Generated alerts for clinic review |
| `alert_events` | Append-only alert status history |

# Photos (Faz 7)

| Table | Purpose |
|-------|---------|
| `photo_requests` | Staff-initiated photo request on a plan |
| `photo_upload_intents` | Short-lived upload intent + claim state |
| `photo_records` | Finalized sanitized photo metadata |
| `photo_cleanup_locks` | Advisory lock for cleanup job |

| Bucket | Purpose |
|--------|---------|
| `care-photo-incoming` | Raw upload staging (private) |
| `care-photos` | Finalized WebP output (private) |

# Consent and Data Requests (Faz 8)

| Table | Purpose |
|-------|---------|
| `consent_documents` | Document header (notice/consent type) |
| `consent_document_versions` | Immutable draft/published/retired versions |
| `client_document_assignments` | Assign version to client |
| `client_document_events` | Append-only notice/consent events |
| `data_requests` | Workflow record |
| `data_request_events` | Append-only status/assignment history |

# pgTAP Test Mapping

| Test file | Phase coverage |
|-----------|----------------|
| `foundation_rls.test.sql` | Faz 0–1 |
| `phase2_clients_procedures.test.sql` | Faz 2 |
| `phase3_care_templates.test.sql` | Faz 3 |
| `phase4_care_plans_secure_links.test.sql` | Faz 4 |
| `phase5_portal_daily_tasks.test.sql` | Faz 5 |
| `phase6_structured_checkins_alerts.test.sql` | Faz 6 |
| `phase7_photo_storage_foundation.test.sql` | Faz 7 |
| `phase8_consent_data_requests.test.sql` | Faz 8.1 |
| `phase8_portal_document_decisions.test.sql` | Faz 8.2 |
| `phase8_3a_clinic_consent_management.test.sql` | Faz 8.3A |
| `phase8_3b_clinic_assignment_and_data_request_review.test.sql` | Faz 8.3B |

# Related

- [Tenant Isolation](../architecture/tenant-isolation.md)
- [Verification Gates](../playbooks/verification-gates.md)
