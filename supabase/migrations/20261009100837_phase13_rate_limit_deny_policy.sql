-- Make the private rate-limit table's no-client-access intent explicit to policy linting.
drop policy if exists security_rate_limits_deny_client on public.security_rate_limits;
create policy security_rate_limits_deny_client
  on public.security_rate_limits
  for all to anon, authenticated
  using (false)
  with check (false);
