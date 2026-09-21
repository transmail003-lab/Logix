-- =====================================================================
-- USUARIOS DE PRUEBA — Logix
-- Ejecutar DESPUÉS de schema.sql, en el SQL Editor de Supabase.
-- Crea usuarios directamente en auth.users con contraseña ya hasheada
-- (el trigger on_auth_user_created crea el perfil y toma el rol de
-- raw_user_meta_data ->> 'role').
--
-- Contraseña para TODOS los usuarios de prueba: Logix2026!
-- =====================================================================

do $$
declare
  v_password text := crypt('Logix2026!', gen_salt('bf'));
begin

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) values
  (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'admin@logix.com', v_password, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ana Administradora","role":"admin"}',
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'coordinador@logix.com', v_password, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Carlos Coordinador","role":"coordinador"}',
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'bodega@logix.com', v_password, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Beatriz Bodega","role":"bodega"}',
    now(), now(), '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    'motorista@logix.com', v_password, now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Mario Motorista","role":"motorista"}',
    now(), now(), '', ''
  );

end $$;

-- También necesitan una fila en auth.identities para poder iniciar sesión
-- con email/password en algunas versiones de GoTrue. Supabase reciente
-- lo maneja automáticamente vía trigger interno; si el login falla con
-- "Database error querying schema", crea los usuarios en su lugar desde
-- Authentication > Users > Add User en el dashboard (más confiable),
-- usando el mismo email/rol indicados arriba en raw_user_meta_data.
