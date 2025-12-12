create table if not exists rooms (
  room_code text primary key,
  game_state jsonb not null,
  created_at timestamptz default now()
);

alter table rooms enable row level security;

-- Allow public access (or restrict as needed, for now public for the function to access via service role)
-- Actually, the Edge Function uses Service Role Key, which bypasses RLS.
-- But for Realtime, if clients want to subscribe to changes on this table (Postgres Changes), they need policy.
-- However, we are using Broadcast, so clients don't need to read this table directly.
-- To be safe, we can add a policy creating read access for players if needed later.
drop policy if exists "Enable read access for all users" on rooms;
create policy "Enable read access for all users" on rooms for select using (true);
