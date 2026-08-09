-- CORRECCIÓN. El proyecto ya tenía un trigger on_auth_user_created ->
-- handle_new_user que insertaba en public.profiles. La migración de la capa de
-- lector añadió un segundo trigger (al_crear_usuario -> crear_perfil) que hacía
-- lo mismo. Al registrarse un usuario se disparaban los dos: el primero
-- insertaba la fila y el segundo chocaba con la clave primaria, devolviendo
-- "Database error saving new user".
--
-- Se elimina el duplicado y se hace idempotente y a prueba de fallos el original.

drop trigger if exists al_crear_usuario on auth.users;
drop function if exists public.crear_perfil();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
exception when others then
  -- Nunca bloquear el alta de un usuario porque falle la creación del perfil.
  raise warning 'No se pudo crear el perfil de %: %', new.id, sqlerrm;
  return new;
end;
$$;
