-- verify-glass rejects any request without a ROBOT_API_KEY header, so check_frame got a 401 on
-- every call. Send the key, read from Vault. Store it once per project with:
--   select vault.create_secret('<same value as the ROBOT_API_KEY edge secret>', 'robot_api_key');
-- With no Vault secret the header is empty and verify-glass still fails closed.
create or replace function internal.check_frame(frame_b64 text, frame_label text, mime text default 'image/jpeg')
returns bigint language plpgsql security definer set search_path = '' as $$
declare rid bigint; fid bigint;
begin
  select net.http_post(
    url := 'https://fvvxmvtoozpxmdkdumrx.supabase.co/functions/v1/verify-glass',
    body := jsonb_build_object('frameB64', frame_b64, 'mimeType', mime),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dnhtdnRvb3pweG1ka2R1bXJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NTc0MTEsImV4cCI6MjEwNzIzMzQxMX0.uP7WfaLH2OWMl6ipoR_54inY7JU2b-T_LVzeSy3Xv-0',
      'ROBOT_API_KEY', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'robot_api_key'), '')),
    timeout_milliseconds := 60000) into rid;
  insert into public.frame_checks (label, request_id) values (frame_label, rid) returning id into fid;
  return fid;
end $$;

revoke all on function internal.check_frame(text, text, text) from public, anon, authenticated;
