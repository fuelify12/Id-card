-- One active template per project side, allowing front and back designs to coexist.
create unique index if not exists templates_one_active_per_side_idx
on public.templates (project_id, coalesce(render_config->>'side','front'))
where is_active = true;