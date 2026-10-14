-- Private bucket for uploaded task ZIPs. Accessed only with the service role from the server.
insert into storage.buckets (id, name, public, file_size_limit)
values ('agentforge-artifacts', 'agentforge-artifacts', false, 52428800)
on conflict (id) do nothing;
