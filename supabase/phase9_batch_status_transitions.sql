-- Expand existing batch status constraint for pause/resume and mixed-result terminal states.
alter table public.batches drop constraint if exists batches_status_check;
alter table public.batches drop constraint if exists batches_phase9_status_check;
alter table public.batches add constraint batches_status_check check (status in ('pending','queued','running','processing','pausing','paused','completed','completed_with_errors','failed','needs_review','cancelled'));