-- ======================================================================================
-- Migration 023: Seed Default Admin Account & Profile
-- ======================================================================================
-- Akun Admin Default:
-- Email: admin@bpbd.com
-- Password: admin123
-- ======================================================================================

DO $$
DECLARE
  new_admin_id uuid;
  admin_email_input text := 'admin@bpbd.com';
  admin_password_input text := 'admin123';
  admin_name_input text := 'Administrator SiLahar';
BEGIN
  -- 1. Cek apakah user sudah terdaftar di auth.users
  SELECT id INTO new_admin_id
  FROM auth.users
  WHERE email = admin_email_input;

  IF new_admin_id IS NULL THEN
    new_admin_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      new_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      admin_email_input,
      crypt(admin_password_input, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', admin_name_input),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Daftarkan identity provider email jika tabel identities tersedia
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'auth' AND table_name = 'identities'
    ) THEN
      INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        new_admin_id,
        new_admin_id,
        jsonb_build_object('sub', new_admin_id::text, 'email', admin_email_input),
        'email',
        new_admin_id::text,
        now(),
        now(),
        now()
      )
      ON CONFLICT (provider, provider_id) DO NOTHING;
    END IF;
  ELSE
    -- Jika sudah ada, pastikan email terkonfirmasi dan password diperbarui
    UPDATE auth.users
    SET encrypted_password = crypt(admin_password_input, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = new_admin_id;
  END IF;

  -- 2. Tambahkan / perbarui profil di public.admin_profiles
  INSERT INTO public.admin_profiles (
    id,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    new_admin_id,
    admin_name_input,
    'admin',
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = excluded.full_name,
      role = excluded.role,
      is_active = true,
      updated_at = now();

END $$;
