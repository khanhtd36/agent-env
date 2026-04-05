create table if not exists heartbeat (
  id serial primary key,
  note text not null,
  created_at timestamptz not null default now()
);

insert into heartbeat (note) values ('demo sandbox initialized');
