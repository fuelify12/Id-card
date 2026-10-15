create index if not exists idx_student_photos_approved_by on public.student_photos(approved_by);
create index if not exists idx_student_photos_duplicate_of on public.student_photos(duplicate_of_id);
create index if not exists idx_student_photos_student_project_fk on public.student_photos(student_id,project_id);
create index if not exists idx_student_photos_project_owner_fk on public.student_photos(project_id,owner_id);
