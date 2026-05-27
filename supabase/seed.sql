-- Seed : à exécuter après avoir créé le compte admin via /setup ou le dashboard Supabase
-- Remplacer <ADMIN_UUID> par l'UUID du compte Supabase créé

-- Vérifier que le profil admin existe (le trigger le crée normalement)
-- Si besoin, créer manuellement :
-- insert into public.profiles (id, pseudo, role, target_lph)
-- values ('<ADMIN_UUID>', 'admin', 'admin', 80)
-- on conflict (id) do update set role = 'admin';

-- Créer les pauses par défaut pour l'admin
-- select public.create_default_pause_schedules('<ADMIN_UUID>');
