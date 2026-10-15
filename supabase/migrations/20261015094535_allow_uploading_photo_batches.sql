-- Photo uploads reserve bytes while a batch is actively receiving files.
-- reserve_photo_upload() requires status='uploading', so the batches status
-- constraint must permit that state.
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE public.batches
  ADD CONSTRAINT batches_status_check
  CHECK (status = ANY (ARRAY[
    'pending',
    'queued',
    'running',
    'processing',
    'uploading',
    'pausing',
    'paused',
    'completed',
    'completed_with_errors',
    'failed',
    'needs_review',
    'cancelled'
  ]::text[]));
