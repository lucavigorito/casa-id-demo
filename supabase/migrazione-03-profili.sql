-- Casa ID · migrazione 03: doppio profilo (personale + professionale) sulla stessa email.
-- Da eseguire una sola volta in Supabase › SQL Editor › New query › Run.
-- Senza questa migrazione il cambio profilo funziona già; con la migrazione gli altri utenti
-- continuano a vedere il professionista con la sua qualifica anche mentre usa il profilo da proprietario.

alter table public.profiles add column if not exists ruoli text[];
update public.profiles set ruoli = array[ruolo] where ruoli is null;
