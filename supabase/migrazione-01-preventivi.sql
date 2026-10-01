-- =====================================================================
-- Casa ID · migrazione 01 (1 ottobre 2026)
-- Servizi tecnici con preventivo: il professionista indica il costo totale,
-- il proprietario accetta o rifiuta prima che la pratica parta.
-- Da eseguire UNA volta in Supabase › SQL Editor › New query › Run.
-- =====================================================================

alter table public.richieste add column if not exists preventivo_importo numeric(10,2);
alter table public.richieste add column if not exists preventivo_note text;
alter table public.richieste add column if not exists preventivo_il timestamptz;
alter table public.richieste add column if not exists accettata_il timestamptz;
alter table public.richieste drop constraint if exists richieste_stato_check;
alter table public.richieste add constraint richieste_stato_check
  check (stato in ('inviata','preventivo','lavorazione','consegnata','annullata'));

create or replace function public.is_owner_like(imm uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.accessi a where a.immobile_id = imm and a.email = public.my_email()
                 and a.livello in ('titolare','delegato')) $$;

-- Il professionista invia (o aggiorna) il preventivo per una richiesta.
create or replace function public.invia_preventivo(rid uuid, p_importo numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.richieste; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into r from public.richieste where id = rid for update;
  if r.id is null then raise exception 'Richiesta non trovata'; end if;
  if p_importo is null or p_importo < 0 then raise exception 'Importo non valido'; end if;
  if r.stato not in ('inviata','preventivo') then raise exception 'La richiesta non accetta preventivi'; end if;
  if r.assegnato_a is not null and r.assegnato_a <> me.id then raise exception 'Richiesta già affidata'; end if;
  if r.assegnato_a is null and r.ruolo_richiesto <> me.ruolo then raise exception 'Richiesta per un altro tipo di professionista'; end if;
  update public.richieste
     set assegnato_a = me.id, stato = 'preventivo', preventivo_importo = p_importo,
         preventivo_note = nullif(trim(p_note),''), preventivo_il = now()
   where id = rid;
  insert into public.eventi (immobile_id, user_id, azione)
  values (r.immobile_id, me.id, 'ha inviato un preventivo di ' || to_char(p_importo,'FM999G990D00') || ' € per: ' || r.servizio);
end $$;

-- Il proprietario (o un delegato) accetta o rifiuta il preventivo.
create or replace function public.rispondi_preventivo(rid uuid, accetta boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.richieste; pro public.profiles;
begin
  select * into r from public.richieste where id = rid for update;
  if r.id is null then raise exception 'Richiesta non trovata'; end if;
  if not public.is_owner_like(r.immobile_id) then raise exception 'Operazione non consentita'; end if;
  if r.stato <> 'preventivo' then raise exception 'Nessun preventivo da valutare'; end if;
  select * into pro from public.profiles where id = r.assegnato_a;
  if accetta then
    update public.richieste set stato = 'lavorazione', accettata_il = now() where id = rid;
    insert into public.accessi (immobile_id, email, livello, sezioni, scadenza)
    values (r.immobile_id, pro.email, 'professionista', array[r.sezione], current_date + 60)
    on conflict (immobile_id, email) do update
      set sezioni = (select array(select distinct unnest(coalesce(public.accessi.sezioni,'{}') || excluded.sezioni))),
          scadenza = greatest(public.accessi.scadenza, excluded.scadenza)
      where public.accessi.livello = 'professionista';
    insert into public.eventi (immobile_id, user_id, azione)
    values (r.immobile_id, auth.uid(), 'ha accettato il preventivo di ' || coalesce(pro.nome,'un professionista') || ' per: ' || r.servizio);
  else
    update public.richieste set stato = 'inviata', assegnato_a = null, preventivo_importo = null,
           preventivo_note = null, preventivo_il = null where id = rid;
    insert into public.eventi (immobile_id, user_id, azione)
    values (r.immobile_id, auth.uid(), 'ha rifiutato il preventivo per: ' || r.servizio);
  end if;
end $$;

-- Il proprietario annulla una richiesta non ancora accettata.
create or replace function public.annulla_richiesta(rid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.richieste;
begin
  select * into r from public.richieste where id = rid for update;
  if r.id is null then raise exception 'Richiesta non trovata'; end if;
  if not public.is_owner_like(r.immobile_id) then raise exception 'Operazione non consentita'; end if;
  if r.stato not in ('inviata','preventivo') then raise exception 'La richiesta è già in lavorazione'; end if;
  update public.richieste set stato = 'annullata' where id = rid;
  insert into public.eventi (immobile_id, user_id, azione) values (r.immobile_id, auth.uid(), 'ha annullato la richiesta: ' || r.servizio);
end $$;

grant execute on function public.invia_preventivo(uuid, numeric, text), public.rispondi_preventivo(uuid, boolean),
  public.annulla_richiesta(uuid) to authenticated;
revoke execute on function public.invia_preventivo(uuid, numeric, text), public.rispondi_preventivo(uuid, boolean),
  public.annulla_richiesta(uuid) from anon;
