-- =====================================================================
-- Casa ID · migrazione 02 (1 ottobre 2026)
-- 1. Collegamento del professionista con QR code (codice temporaneo, monouso).
-- 2. Condivisione di singoli documenti o di una selezione di documenti.
-- 3. Lista dei documenti di base (percentuale di completamento).
-- 4. Passaggio di proprietà: il fascicolo resta all'immobile e passa al nuovo proprietario.
-- Da eseguire UNA volta in Supabase › SQL Editor › New query › Run,
-- dopo la migrazione 01.
-- =====================================================================

-- ---------- 1. Collegamento con QR code ----------

create table if not exists public.collegamenti (
  id uuid primary key default gen_random_uuid(),
  immobile_id uuid not null references public.immobili(id) on delete cascade,
  codice text not null unique,
  sezioni text[] not null,
  giorni int not null check (giorni between 1 and 365),
  valido_fino timestamptz not null,
  creato_da uuid references public.profiles(id) on delete set null,
  usato_da uuid references public.profiles(id) on delete set null,
  usato_il timestamptz,
  created_at timestamptz not null default now()
);
alter table public.collegamenti enable row level security;
drop policy if exists col_sel on public.collegamenti;
create policy col_sel on public.collegamenti for select to authenticated using (public.can_invite(immobile_id));
-- Nessuna policy di scrittura: si crea e si usa solo con le funzioni qui sotto.

-- Codice di 10 caratteri senza simboli ambigui (niente 0/O, 1/I), circa 50 bit casuali.
create or replace function public.nuovo_codice_collegamento() returns text
language plpgsql volatile set search_path = public as $$
declare b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
        a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; s text := ''; i int;
begin
  foreach i in array array[0,1,2,3,4,5,7,9,10,11] loop
    s := s || substr(a, (get_byte(b, i) % 32) + 1, 1);
  end loop;
  return s;
end $$;

-- Il titolare (o un delegato che può invitare) genera il codice da mostrare come QR.
-- Vale 15 minuti e per una sola persona; i codici precedenti non usati vengono annullati.
create or replace function public.crea_collegamento(imm uuid, p_sezioni text[], p_giorni int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.collegamenti; cod text;
begin
  if not public.can_invite(imm) then raise exception 'Operazione non consentita'; end if;
  if p_sezioni is null or cardinality(p_sezioni) = 0 then raise exception 'Scegli almeno una sezione'; end if;
  if not (p_sezioni <@ array['atti','catasto','urbanistica','impianti','condominio','contratti']) then raise exception 'Sezione non valida'; end if;
  if p_giorni is null or p_giorni < 1 or p_giorni > 365 then raise exception 'Durata non valida'; end if;
  update public.collegamenti set valido_fino = now()
   where immobile_id = imm and creato_da = auth.uid() and usato_il is null and valido_fino > now();
  loop
    cod := public.nuovo_codice_collegamento();
    exit when not exists (select 1 from public.collegamenti where codice = cod);
  end loop;
  insert into public.collegamenti (immobile_id, codice, sezioni, giorni, valido_fino, creato_da)
  values (imm, cod, p_sezioni, p_giorni, now() + interval '15 minutes', auth.uid())
  returning * into c;
  return jsonb_build_object('id', c.id, 'codice', c.codice, 'valido_fino', c.valido_fino);
end $$;

-- Il professionista usa il codice (scansionando il QR o digitandolo) e ottiene l'accesso.
create or replace function public.usa_collegamento(p_codice text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles; c public.collegamenti; i public.immobili; cod text; liv text; scad date;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Accedi per collegarti'; end if;
  if me.ruolo not in ('agenzia','broker','tecnico','notaio') then
    raise exception 'Il collegamento con QR code è riservato ai professionisti'; end if;
  cod := regexp_replace(upper(coalesce(p_codice, '')), '[^A-Z0-9]', '', 'g');
  select * into c from public.collegamenti where codice = cod for update;
  if c.id is null or c.usato_il is not null or c.valido_fino < now() then
    raise exception 'Codice non valido o scaduto: chiedi al proprietario di generarne uno nuovo'; end if;
  select livello into liv from public.accessi where immobile_id = c.immobile_id and email = me.email;
  if liv in ('titolare','delegato') then raise exception 'Hai già accesso completo a questo fascicolo'; end if;
  scad := current_date + c.giorni;
  insert into public.accessi (immobile_id, email, livello, sezioni, scadenza, invitato_da)
  values (c.immobile_id, me.email, 'professionista', c.sezioni, scad, c.creato_da)
  on conflict (immobile_id, email) do update
    set sezioni = (select array(select distinct unnest(coalesce(public.accessi.sezioni, '{}') || excluded.sezioni))),
        scadenza = greatest(public.accessi.scadenza, excluded.scadenza)
    where public.accessi.livello = 'professionista';
  update public.collegamenti set usato_da = me.id, usato_il = now() where id = c.id;
  insert into public.eventi (immobile_id, user_id, azione)
  values (c.immobile_id, me.id, 'si è collegato con il QR code (' || array_to_string(c.sezioni, ', ') || ', fino al ' || to_char(scad, 'DD/MM/YYYY') || ')');
  select * into i from public.immobili where id = c.immobile_id;
  return jsonb_build_object('immobile_id', i.id, 'tipo', i.tipo, 'indirizzo', i.indirizzo, 'comune', i.comune,
                            'sezioni', to_jsonb(c.sezioni), 'scadenza', scad);
end $$;

revoke execute on function public.nuovo_codice_collegamento() from public, anon, authenticated;
grant execute on function public.crea_collegamento(uuid, text[], int), public.usa_collegamento(text) to authenticated;
revoke execute on function public.crea_collegamento(uuid, text[], int), public.usa_collegamento(text) from anon;

-- ---------- 2. Condivisione di documenti scelti ----------
-- Se "documenti" è valorizzato, il link mostra solo quei documenti; altrimenti le sezioni.

alter table public.condivisioni add column if not exists documenti uuid[];

create or replace function public.guest_file_ok(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.documenti d join public.condivisioni c on c.immobile_id = d.immobile_id
                 where d.file_path = path and c.attivo and c.scadenza >= current_date and d.sezione = any(c.sezioni)
                   and (c.documenti is null or d.id = any(c.documenti))) $$;

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
                  from public.documenti d where d.immobile_id = c.immobile_id and d.sezione = any(c.sezioni) and d.stato <> 'richiesto'
                    and (c.documenti is null or d.id = any(c.documenti))), '[]'::jsonb))
  into res;
  return res;
end $$;

-- ---------- 3. Lista dei documenti di base ----------

alter table public.documenti add column if not exists voce text;
alter table public.immobili add column if not exists voci_na text[] not null default '{}';

-- ---------- 4. Passaggio di proprietà ----------
-- Il fascicolo è dell'immobile: documenti, scadenze e codice restano; cambia il titolare.
-- Registro, link, richieste e preventivi del vecchio proprietario non sono visibili al nuovo.

alter table public.immobili add column if not exists storia_dal timestamptz;

create table if not exists public.passaggi (
  id uuid primary key default gen_random_uuid(),
  immobile_id uuid not null references public.immobili(id) on delete cascade,
  da_utente uuid references public.profiles(id) on delete set null,
  da_nome text,
  a_email text not null check (a_email = lower(a_email)),
  data_atto date,
  tipo text, indirizzo text, comune text,
  n_documenti int,
  stato text not null default 'in_attesa' check (stato in ('in_attesa','accettato','rifiutato','annullato')),
  created_at timestamptz not null default now(),
  chiuso_il timestamptz
);
create unique index if not exists passaggi_aperto_idx on public.passaggi(immobile_id) where stato = 'in_attesa';
alter table public.passaggi enable row level security;
drop policy if exists pas_sel on public.passaggi;
create policy pas_sel on public.passaggi for select to authenticated using (
  a_email = public.my_email() or (public.is_titolare(immobile_id) and created_at >= coalesce((select storia_dal from public.immobili where id = immobile_id), '-infinity')));

create or replace function public.avvia_passaggio(imm uuid, p_email text, p_data date) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.profiles; i public.immobili; em text := lower(trim(coalesce(p_email,''))); pid uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not public.is_titolare(imm) then raise exception 'Solo il titolare può avviare il passaggio di proprietà'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email del nuovo proprietario non valida'; end if;
  if em = me.email then raise exception 'Indica l''email del nuovo proprietario, non la tua'; end if;
  if exists (select 1 from public.passaggi where immobile_id = imm and stato = 'in_attesa') then
    raise exception 'C''è già un passaggio in attesa: annullalo per avviarne un altro'; end if;
  select * into i from public.immobili where id = imm;
  insert into public.passaggi (immobile_id, da_utente, da_nome, a_email, data_atto, tipo, indirizzo, comune, n_documenti)
  values (imm, me.id, me.nome, em, p_data, i.tipo, i.indirizzo, i.comune,
          (select count(*) from public.documenti where immobile_id = imm and stato <> 'richiesto'))
  returning id into pid;
  insert into public.eventi (immobile_id, user_id, azione) values (imm, me.id, 'ha avviato il passaggio di proprietà a ' || em);
  return pid;
end $$;

create or replace function public.annulla_passaggio(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p public.passaggi;
begin
  select * into p from public.passaggi where id = pid for update;
  if p.id is null or p.stato <> 'in_attesa' then raise exception 'Nessun passaggio in attesa'; end if;
  if not public.is_titolare(p.immobile_id) then raise exception 'Operazione non consentita'; end if;
  update public.passaggi set stato = 'annullato', chiuso_il = now() where id = pid;
  insert into public.eventi (immobile_id, user_id, azione) values (p.immobile_id, auth.uid(), 'ha annullato il passaggio di proprietà');
end $$;

create or replace function public.rispondi_passaggio(pid uuid, accetta boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.passaggi; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into p from public.passaggi where id = pid for update;
  if p.id is null or p.stato <> 'in_attesa' then raise exception 'Questo passaggio non è più in attesa'; end if;
  if p.a_email <> me.email then raise exception 'Il passaggio è destinato a un altro indirizzo email'; end if;
  if not accetta then
    update public.passaggi set stato = 'rifiutato', chiuso_il = now() where id = pid;
    insert into public.eventi (immobile_id, attore, azione) values (p.immobile_id, me.nome, 'ha rifiutato il passaggio di proprietà');
    return null;
  end if;
  if exists (select 1 from public.richieste where immobile_id = p.immobile_id and stato = 'lavorazione') then
    raise exception 'Ci sono pratiche in lavorazione su questo immobile: il venditore deve attenderne la consegna prima del passaggio'; end if;
  update public.richieste set stato = 'annullata' where immobile_id = p.immobile_id and stato in ('inviata','preventivo');
  update public.condivisioni set attivo = false where immobile_id = p.immobile_id;
  update public.collegamenti set valido_fino = now() where immobile_id = p.immobile_id and usato_il is null and valido_fino > now();
  delete from public.accessi where immobile_id = p.immobile_id and email <> me.email;
  insert into public.accessi (immobile_id, email, livello, sezioni, scadenza, puo_invitare, invitato_da)
  values (p.immobile_id, me.email, 'titolare', null, null, true, null)
  on conflict (immobile_id, email) do update set livello = 'titolare', sezioni = null, scadenza = null, puo_invitare = true, invitato_da = null;
  update public.immobili set storia_dal = now(), voci_na = '{}' where id = p.immobile_id;
  update public.passaggi set stato = 'accettato', chiuso_il = now() where id = pid;
  insert into public.eventi (immobile_id, user_id, azione)
  values (p.immobile_id, me.id, 'è diventato titolare con il passaggio di proprietà da ' || coalesce(p.da_nome, 'il precedente proprietario')
          || case when p.data_atto is not null then ' (atto del ' || to_char(p.data_atto, 'DD/MM/YYYY') || ')' else '' end);
  return p.immobile_id;
end $$;

grant execute on function public.avvia_passaggio(uuid, text, date), public.annulla_passaggio(uuid), public.rispondi_passaggio(uuid, boolean) to authenticated;
revoke execute on function public.avvia_passaggio(uuid, text, date), public.annulla_passaggio(uuid), public.rispondi_passaggio(uuid, boolean) from anon;

-- Il vecchio proprietario non vede più l'immobile, nemmeno se l'aveva creato lui.
drop policy if exists imm_sel on public.immobili;
create policy imm_sel on public.immobili for select to authenticated using (
  public.has_access(id) or (creato_da = auth.uid() and storia_dal is null));

-- Il nuovo proprietario non vede registro, richieste e link del precedente.
drop policy if exists eve_sel on public.eventi;
create policy eve_sel on public.eventi for select to authenticated using (
  public.has_access(immobile_id) and ts >= coalesce((select storia_dal from public.immobili where id = immobile_id), '-infinity'));
drop policy if exists ric_sel on public.richieste;
create policy ric_sel on public.richieste for select to authenticated using (
  (public.has_access(immobile_id) and created_at >= coalesce((select storia_dal from public.immobili where id = immobile_id), '-infinity'))
  or assegnato_a = auth.uid() or (assegnato_a is null and ruolo_richiesto = public.my_role() and stato = 'inviata'));
drop policy if exists con_sel on public.condivisioni;
create policy con_sel on public.condivisioni for select to authenticated using (
  public.has_access(immobile_id) and created_at >= coalesce((select storia_dal from public.immobili where id = immobile_id), '-infinity'));

do $$
begin
  begin execute 'alter publication supabase_realtime add table public.passaggi';
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;
