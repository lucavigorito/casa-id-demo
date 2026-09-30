-- =====================================================================
-- Casa ID · versione demo
-- Schema del database Supabase: tabelle, permessi (RLS), archivio file.
-- Da eseguire una sola volta in Supabase › SQL Editor › New query › Run.
-- =====================================================================


-- ---------- Tabelle ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nome text not null,
  ruolo text not null check (ruolo in ('proprietario','familiare','agenzia','broker','tecnico','notaio')),
  studio text,
  created_at timestamptz not null default now()
);

create table if not exists public.immobili (
  id uuid primary key default gen_random_uuid(),
  codice text unique not null,
  tipo text not null,
  indirizzo text not null,
  comune text not null,
  foglio text, particella text, sub text, categoria text,
  esempio boolean not null default false,
  creato_da uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- L'accesso è legato all'email: si può invitare anche chi non è ancora registrato.
create table if not exists public.accessi (
  id uuid primary key default gen_random_uuid(),
  immobile_id uuid not null references public.immobili(id) on delete cascade,
  email text not null check (email = lower(email)),
  livello text not null check (livello in ('titolare','delegato','professionista')),
  sezioni text[],
  scadenza date,
  puo_invitare boolean not null default false,
  invitato_da uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (immobile_id, email)
);

create table if not exists public.documenti (
  id uuid primary key default gen_random_uuid(),
  immobile_id uuid not null references public.immobili(id) on delete cascade,
  titolo text not null,
  sezione text not null check (sezione in ('atti','catasto','urbanistica','impianti','condominio','contratti')),
  data_documento date,
  scadenza date,
  note text,
  caricato_da uuid references public.profiles(id) on delete set null,
  caricato_ruolo text,
  stato text not null default 'caricato' check (stato in ('verificato','caricato','richiesto')),
  file_path text unique,
  file_name text, file_type text, size bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.richieste (
  id uuid primary key default gen_random_uuid(),
  immobile_id uuid not null references public.immobili(id) on delete cascade,
  servizio text not null,
  sezione text not null,
  ruolo_richiesto text not null,
  note text,
  richiesto_da uuid references public.profiles(id) on delete set null,
  assegnato_a uuid references public.profiles(id) on delete set null,
  stato text not null default 'inviata' check (stato in ('inviata','lavorazione','consegnata')),
  documento_id uuid references public.documenti(id) on delete set null,
  presa_il timestamptz, consegnata_il timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.condivisioni (
  id text primary key check (id ~ '^[a-z0-9]{8,32}$'),
  immobile_id uuid not null references public.immobili(id) on delete cascade,
  etichetta text not null,
  sezioni text[] not null,
  scadenza date not null,
  creato_da uuid references public.profiles(id) on delete set null,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.eventi (
  id uuid primary key default gen_random_uuid(),
  immobile_id uuid not null references public.immobili(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  attore text,
  azione text not null,
  ts timestamptz not null default now()
);

create index if not exists accessi_email_idx on public.accessi(email);
create index if not exists documenti_imm_idx on public.documenti(immobile_id);
create index if not exists eventi_imm_idx on public.eventi(immobile_id, ts desc);

-- ---------- Funzioni di controllo (usate dai permessi) ----------

create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email','')) $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select ruolo from public.profiles where id = auth.uid() $$;

create or replace function public.has_access(imm uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accessi a where a.immobile_id = imm and a.email = public.my_email()
                 and (a.scadenza is null or a.scadenza >= current_date)) $$;

create or replace function public.sez_ok(imm uuid, sez text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accessi a where a.immobile_id = imm and a.email = public.my_email()
                 and (a.scadenza is null or a.scadenza >= current_date)
                 and (a.livello in ('titolare','delegato') or sez = any(coalesce(a.sezioni,'{}')))) $$;

create or replace function public.is_titolare(imm uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accessi a where a.immobile_id = imm and a.email = public.my_email() and a.livello = 'titolare') $$;

create or replace function public.can_invite(imm uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accessi a where a.immobile_id = imm and a.email = public.my_email()
                 and (a.livello = 'titolare' or (a.livello = 'delegato' and a.puo_invitare))) $$;

create or replace function public.file_ok(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documenti d where d.file_path = path and public.sez_ok(d.immobile_id, d.sezione)) $$;

create or replace function public.guest_file_ok(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documenti d join public.condivisioni c on c.immobile_id = d.immobile_id
                 where d.file_path = path and c.attivo and c.scadenza >= current_date and d.sezione = any(c.sezioni)) $$;

-- ---------- Profilo creato automaticamente alla registrazione ----------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome, ruolo, studio)
  values (new.id, lower(new.email),
          coalesce(nullif(new.raw_user_meta_data ->> 'nome',''), split_part(new.email,'@',1)),
          coalesce(nullif(new.raw_user_meta_data ->> 'ruolo',''), 'proprietario'),
          nullif(new.raw_user_meta_data ->> 'studio',''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Operazioni composte ----------

-- Crea un fascicolo: il titolare è chi lo crea, oppure il cliente indicato se lo crea un professionista.
create or replace function public.crea_immobile(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles; new_id uuid; tit text; pro boolean;
  alfa text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; cod text;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Profilo non trovato'; end if;
  pro := me.ruolo in ('agenzia','broker','tecnico','notaio');
  tit := lower(coalesce(nullif(trim(p ->> 'titolare_email'),''), me.email));
  if not pro then tit := me.email; end if;
  cod := 'CID-';
  for i in 1..8 loop
    cod := cod || substr(alfa, 1 + floor(random()*length(alfa))::int, 1);
    if i = 4 then cod := cod || '-'; end if;
  end loop;
  insert into public.immobili (codice, tipo, indirizzo, comune, foglio, particella, sub, categoria, esempio, creato_da)
  values (cod, p ->> 'tipo', p ->> 'indirizzo', p ->> 'comune', nullif(p ->> 'foglio',''), nullif(p ->> 'particella',''),
          nullif(p ->> 'sub',''), nullif(p ->> 'categoria',''), coalesce((p ->> 'esempio')::boolean, false), me.id)
  returning id into new_id;
  insert into public.accessi (immobile_id, email, livello, puo_invitare, invitato_da)
  values (new_id, tit, 'titolare', true, me.id);
  if pro and tit <> me.email then
    insert into public.accessi (immobile_id, email, livello, sezioni, scadenza, invitato_da)
    values (new_id, me.email, 'professionista',
            case me.ruolo when 'agenzia' then array['catasto','contratti','condominio']
                          when 'broker' then array['atti','catasto','contratti']
                          when 'tecnico' then array['urbanistica','impianti','catasto']
                          else array['atti'] end,
            current_date + 365, me.id);
  end if;
  insert into public.eventi (immobile_id, user_id, azione)
  values (new_id, me.id, case when pro and tit <> me.email then 'ha creato il fascicolo per ' || tit else 'ha creato il fascicolo' end);
  return new_id;
end $$;

-- Un professionista prende in carico una richiesta di servizio e ottiene l'accesso alla sezione che serve.
create or replace function public.prendi_incarico(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.richieste; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into r from public.richieste where id = rid for update;
  if r.id is null then raise exception 'Richiesta non trovata'; end if;
  if r.stato = 'consegnata' then raise exception 'Richiesta già consegnata'; end if;
  if r.assegnato_a is not null and r.assegnato_a <> me.id then raise exception 'Richiesta già affidata'; end if;
  if r.assegnato_a is null and r.ruolo_richiesto <> me.ruolo then raise exception 'Richiesta per un altro tipo di professionista'; end if;
  update public.richieste set assegnato_a = me.id, stato = 'lavorazione', presa_il = now() where id = rid;
  insert into public.accessi (immobile_id, email, livello, sezioni, scadenza)
  values (r.immobile_id, me.email, 'professionista', array[r.sezione], current_date + 60)
  on conflict (immobile_id, email) do update
    set sezioni = (select array(select distinct unnest(coalesce(public.accessi.sezioni,'{}') || excluded.sezioni))),
        scadenza = greatest(public.accessi.scadenza, excluded.scadenza)
    where public.accessi.livello = 'professionista';
  insert into public.eventi (immobile_id, user_id, azione) values (r.immobile_id, me.id, 'ha preso in carico: ' || r.servizio);
end $$;

-- Vista per chi apre un link di sola lettura, senza account.
create or replace function public.guest_view(token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.condivisioni; res jsonb;
begin
  select * into c from public.condivisioni where id = token;
  if c.id is null or not c.attivo or c.scadenza < current_date then return null; end if;
  select jsonb_build_object(
    'link', to_jsonb(c) || jsonb_build_object('creato_da_nome', (select nome from public.profiles where id = c.creato_da)),
    'immobile', (select to_jsonb(i) from public.immobili i where i.id = c.immobile_id),
    'documenti', coalesce((select jsonb_agg(to_jsonb(d) order by d.data_documento desc nulls last)
                  from public.documenti d where d.immobile_id = c.immobile_id and d.sezione = any(c.sezioni) and d.stato <> 'richiesto'), '[]'::jsonb))
  into res;
  return res;
end $$;

create or replace function public.guest_log(token text, azione text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.condivisioni;
begin
  select * into c from public.condivisioni where id = token and attivo and scadenza >= current_date;
  if c.id is null then return; end if;
  insert into public.eventi (immobile_id, attore, azione) values (c.immobile_id, 'Link «' || c.etichetta || '»', left(azione, 200));
end $$;

-- Crea un fascicolo di esempio già compilato per chi sta provando la demo.
create or replace function public.crea_esempio() returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; me uuid := auth.uid();
begin
  new_id := public.crea_immobile(jsonb_build_object('tipo','Appartamento','indirizzo','Via dei Mille 14 (esempio)','comune','Salerno',
            'foglio','12','particella','348','sub','7','categoria','A/2','esempio',true));
  insert into public.documenti (immobile_id, titolo, sezione, data_documento, scadenza, note, caricato_da, caricato_ruolo, stato) values
   (new_id,'Atto di compravendita','atti','2024-03-14',null,'Documento di esempio, senza file',me,'notaio','verificato'),
   (new_id,'Nota di trascrizione','atti','2024-04-02',null,'Documento di esempio, senza file',me,'notaio','verificato'),
   (new_id,'Visura catastale storica','catasto','2024-01-15',null,'Documento di esempio, senza file',me,'agenzia','verificato'),
   (new_id,'Planimetria catastale','catasto','2024-01-15',null,'Documento di esempio, senza file',me,'agenzia','verificato'),
   (new_id,'Relazione di conformità urbanistica','urbanistica','2024-02-20',null,'Documento di esempio, senza file',me,'tecnico','verificato'),
   (new_id,'Attestato di prestazione energetica (classe D)','impianti','2018-03-20','2028-03-20','Documento di esempio, senza file',me,'tecnico','verificato'),
   (new_id,'Libretto d''impianto caldaia','impianti','2024-11-15',(current_date + 45),'Documento di esempio, senza file',me,'tecnico','verificato'),
   (new_id,'Regolamento condominiale','condominio','2019-06-01',null,'Documento di esempio, senza file',me,'agenzia','verificato'),
   (new_id,'Certificato di agibilità','urbanistica',null,null,'Da richiedere al tecnico',me,'proprietario','richiesto');
  return new_id;
end $$;

-- ---------- Permessi (Row Level Security) ----------

alter table public.profiles enable row level security;
alter table public.immobili enable row level security;
alter table public.accessi enable row level security;
alter table public.documenti enable row level security;
alter table public.richieste enable row level security;
alter table public.condivisioni enable row level security;
alter table public.eventi enable row level security;

drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select to authenticated using (true);
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists imm_sel on public.immobili;
create policy imm_sel on public.immobili for select to authenticated using (public.has_access(id) or creato_da = auth.uid());
drop policy if exists imm_upd on public.immobili;
create policy imm_upd on public.immobili for update to authenticated using (public.is_titolare(id));
drop policy if exists imm_del on public.immobili;
create policy imm_del on public.immobili for delete to authenticated using (public.is_titolare(id));

drop policy if exists acc_sel on public.accessi;
create policy acc_sel on public.accessi for select to authenticated using (public.has_access(immobile_id) or email = public.my_email());
drop policy if exists acc_ins on public.accessi;
create policy acc_ins on public.accessi for insert to authenticated with check (
  public.can_invite(immobile_id) and invitato_da = auth.uid()
  and (livello = 'professionista' or (livello = 'delegato' and public.is_titolare(immobile_id))));
drop policy if exists acc_del on public.accessi;
create policy acc_del on public.accessi for delete to authenticated using (
  livello <> 'titolare' and (public.is_titolare(immobile_id) or (public.can_invite(immobile_id) and invitato_da = auth.uid())));

drop policy if exists doc_sel on public.documenti;
create policy doc_sel on public.documenti for select to authenticated using (public.sez_ok(immobile_id, sezione));
drop policy if exists doc_ins on public.documenti;
create policy doc_ins on public.documenti for insert to authenticated with check (public.sez_ok(immobile_id, sezione) and caricato_da = auth.uid());
drop policy if exists doc_upd on public.documenti;
create policy doc_upd on public.documenti for update to authenticated using (public.sez_ok(immobile_id, sezione)) with check (public.sez_ok(immobile_id, sezione));
drop policy if exists doc_del on public.documenti;
create policy doc_del on public.documenti for delete to authenticated using (public.is_titolare(immobile_id) or caricato_da = auth.uid());

drop policy if exists ric_sel on public.richieste;
create policy ric_sel on public.richieste for select to authenticated using (
  public.has_access(immobile_id) or assegnato_a = auth.uid() or (assegnato_a is null and ruolo_richiesto = public.my_role()));
drop policy if exists ric_ins on public.richieste;
create policy ric_ins on public.richieste for insert to authenticated with check (public.has_access(immobile_id) and richiesto_da = auth.uid());
drop policy if exists ric_upd on public.richieste;
create policy ric_upd on public.richieste for update to authenticated using (assegnato_a = auth.uid()) with check (assegnato_a = auth.uid());

drop policy if exists con_sel on public.condivisioni;
create policy con_sel on public.condivisioni for select to authenticated using (public.has_access(immobile_id));
drop policy if exists con_ins on public.condivisioni;
create policy con_ins on public.condivisioni for insert to authenticated with check (public.can_invite(immobile_id) and creato_da = auth.uid());
drop policy if exists con_upd on public.condivisioni;
create policy con_upd on public.condivisioni for update to authenticated using (public.can_invite(immobile_id));

drop policy if exists eve_sel on public.eventi;
create policy eve_sel on public.eventi for select to authenticated using (public.has_access(immobile_id));
drop policy if exists eve_ins on public.eventi;
create policy eve_ins on public.eventi for insert to authenticated with check (public.has_access(immobile_id) and user_id = auth.uid());

grant execute on function public.crea_immobile(jsonb), public.prendi_incarico(uuid), public.crea_esempio() to authenticated;
grant execute on function public.guest_view(text), public.guest_log(text, text) to anon, authenticated;
revoke execute on function public.crea_immobile(jsonb), public.prendi_incarico(uuid), public.crea_esempio() from anon;

-- ---------- Archivio file (Storage) ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documenti', 'documenti', false, 20971520, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "casaid carica" on storage.objects;
create policy "casaid carica" on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti' and public.has_access(((storage.foldername(name))[1])::uuid));
drop policy if exists "casaid leggi" on storage.objects;
create policy "casaid leggi" on storage.objects for select to authenticated
  using (bucket_id = 'documenti' and (public.file_ok(name) or owner = auth.uid()));
drop policy if exists "casaid ospite" on storage.objects;
create policy "casaid ospite" on storage.objects for select to anon
  using (bucket_id = 'documenti' and public.guest_file_ok(name));
drop policy if exists "casaid elimina" on storage.objects;
create policy "casaid elimina" on storage.objects for delete to authenticated
  using (bucket_id = 'documenti' and owner = auth.uid());

-- ---------- Aggiornamenti in tempo reale ----------

do $$
declare t text;
begin
  foreach t in array array['immobili','accessi','documenti','richieste','condivisioni','eventi','profiles'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
             when undefined_object then null;
    end;
  end loop;
end $$;
