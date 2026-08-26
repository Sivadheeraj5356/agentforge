-- Chunk 6: report-grade validation persistence.
-- Additive only. The Chunk 5 migration is history and is never rewritten.
--
-- validation_runs.status stays the job lifecycle (queued/running/succeeded/...).
-- validation_runs.outcome is the policy decision (pass/warn/fail) computed from findings.
--
-- New enumerated columns use text + CHECK rather than Postgres enums so future
-- policies, categories, and validator ids ship without a type migration. This
-- follows the existing adapter_id / validator_id columns on the same tables.

alter table public.validation_runs
  add column adapter_version text,
  add column task_version text,
  add column artifact_content_hash text,
  add column policy text not null default 'strict',
  add column outcome text,
  add column validators jsonb not null default '[]'::jsonb,
  add column validator_error_count integer not null default 0,
  add column duration_ms integer;

alter table public.validation_runs
  add constraint validation_runs_adapter_version_format check (
    adapter_version is null
    or (
      adapter_version ~ '^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*$'
      and char_length(adapter_version) <= 64
    )
  ),
  add constraint validation_runs_task_version_format check (
    task_version is null
    or (
      task_version ~ '^[A-Za-z0-9]+([._-][A-Za-z0-9]+)*$'
      and char_length(task_version) <= 64
    )
  ),
  add constraint validation_runs_artifact_content_hash_format check (
    artifact_content_hash is null or artifact_content_hash ~ '^[a-f0-9]{64}$'
  ),
  add constraint validation_runs_policy_allowed check (policy in ('strict', 'lenient')),
  add constraint validation_runs_outcome_allowed check (
    outcome is null or outcome in ('pass', 'warn', 'fail')
  ),
  add constraint validation_runs_validators_array check (jsonb_typeof(validators) = 'array'),
  add constraint validation_runs_validators_size check (
    octet_length(validators::text) <= 8192
  ),
  add constraint validation_runs_validator_error_count_nonneg check (validator_error_count >= 0),
  add constraint validation_runs_duration_nonneg check (duration_ms is null or duration_ms >= 0),
  add constraint validation_runs_outcome_requires_completion check (
    outcome is null or status in ('succeeded', 'failed', 'cancelled')
  );

comment on column public.validation_runs.outcome is
  'Policy decision for the run (pass/warn/fail). Distinct from status, which is the job lifecycle.';
comment on column public.validation_runs.validators is
  'Validator descriptors that produced this report: [{id, name, version}].';

alter table public.validation_findings
  add column category text,
  add column fingerprint text,
  add column ordinal integer;

-- Backfill historical rows from the code prefix rather than guessing a single value.
update public.validation_findings
set category = case
  when code like 'ARCHIVE\_%' then 'archive'
  when code like 'VALIDATION\_%' then 'configuration'
  when code like 'TASK\_STRUCTURE\_%' then 'structure'
  when code like 'TASK\_METADATA\_%' then 'metadata'
  when code like 'TASK\_INSTRUCTION\_%' then 'instructions'
  when code like 'TASK\_ENVIRONMENT\_%' then 'environment'
  when code like 'TASK\_VERIFIER\_%' then 'verifier'
  when code like 'TASK\_TEST\_%' then 'tests'
  when code like 'TASK\_DOCUMENTATION\_%' then 'documentation'
  when code like 'TASK\_SECURITY\_%' then 'security'
  when code like 'TASK\_REPRODUCIBILITY\_%' then 'reproducibility'
  else 'structure'
end
where category is null;

-- Same construction as fingerprintFinding() in @agentforge/validation: UTF-8 parts
-- joined by a 0x00 byte, SHA-256, lowercase hex.
update public.validation_findings
set fingerprint = encode(
  sha256(
    convert_to(code, 'utf8')
      || '\x00'::bytea
      || convert_to(coalesce(validator_id, ''), 'utf8')
      || '\x00'::bytea
      || convert_to(coalesce(evidence ->> 'path', ''), 'utf8')
      || '\x00'::bytea
      || convert_to(coalesce(evidence ->> 'line', ''), 'utf8')
      || '\x00'::bytea
      || convert_to(coalesce(evidence ->> 'fieldPath', ''), 'utf8')
  ),
  'hex'
)
where fingerprint is null;

update public.validation_findings f
set ordinal = ranked.position
from (
  select
    id,
    row_number() over (partition by validation_run_id order by created_at, id) - 1 as position
  from public.validation_findings
) as ranked
where ranked.id = f.id
  and f.ordinal is null;

alter table public.validation_findings
  alter column category set not null,
  alter column fingerprint set not null,
  alter column ordinal set not null;

alter table public.validation_findings
  add constraint validation_findings_category_allowed check (
    category in (
      'archive',
      'configuration',
      'structure',
      'metadata',
      'instructions',
      'environment',
      'tests',
      'verifier',
      'documentation',
      'security',
      'reproducibility'
    )
  ),
  add constraint validation_findings_fingerprint_format check (fingerprint ~ '^[a-f0-9]{64}$'),
  add constraint validation_findings_ordinal_nonneg check (ordinal >= 0),
  add constraint validation_findings_ordinal_unique unique (validation_run_id, ordinal);

comment on column public.validation_findings.fingerprint is
  'Stable logical identity (code + validator + evidence location) for run-to-run diffing.';
comment on column public.validation_findings.ordinal is
  'Deterministic report position: severity, category, validator id, code, source location.';

create index validation_findings_fingerprint_idx on public.validation_findings (fingerprint);

-- Keep the denormalized digest honest: it must match the pinned artifact.
create or replace function public.validation_runs_enforce_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_artifact_org uuid;
  v_artifact_hash text;
  v_project_org uuid;
  v_submission_project uuid;
begin
  select p.organization_id into v_project_org
  from public.projects p
  where p.id = new.project_id;

  select a.organization_id, a.content_hash into v_artifact_org, v_artifact_hash
  from public.artifacts a
  where a.id = new.artifact_id;

  if v_artifact_org is distinct from v_project_org then
    raise exception 'artifact does not belong to project organization'
      using errcode = '23514';
  end if;

  if new.artifact_content_hash is not null
    and new.artifact_content_hash is distinct from v_artifact_hash then
    raise exception 'artifact_content_hash does not match the pinned artifact'
      using errcode = '23514';
  end if;

  if new.submission_id is not null then
    select s.project_id into v_submission_project
    from public.submissions s
    where s.id = new.submission_id;

    if v_submission_project is distinct from new.project_id then
      raise exception 'submission does not belong to project'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- The recorded digest is part of the run's provenance, so it is immutable once set.
create or replace function public.validation_runs_protect_pins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id
    or new.artifact_id is distinct from old.artifact_id then
    raise exception 'validation run pins are immutable'
      using errcode = '23514';
  end if;

  if old.artifact_content_hash is not null
    and new.artifact_content_hash is distinct from old.artifact_content_hash then
    raise exception 'validation run artifact hash is immutable'
      using errcode = '23514';
  end if;

  return new;
end;
$$;
