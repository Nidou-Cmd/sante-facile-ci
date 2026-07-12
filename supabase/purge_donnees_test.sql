-- ============================================================
-- SANTÉ FACILE — PURGE DES DONNÉES DE TEST (préparation pilote P2)
-- Fichier : supabase/purge_donnees_test.sql
--
-- ⚠️ IRRÉVERSIBLE. À exécuter dans le SQL Editor UNIQUEMENT quand
-- vous voulez repartir sur une base propre avant le pilote réel.
-- Supprime : comptes de test @santefacile.test (et toutes leurs
-- données en cascade : profils, RDV, ordonnances, livraisons,
-- polices, messages, notifications) + pharmacies fictives de seed.
-- Conserve : le schéma, les paramètres système (sante_settings),
-- et tous les comptes/fiches réels.
-- ============================================================

-- 1. Comptes de test (cascade complète via auth.users → profiles → …)
delete from auth.users
where email like '%@santefacile.test'
   or email = 'pirate.admin@santefacile.test';

-- 2. Pharmacies fictives de démonstration (seed 002/010)
delete from public.pharmacies
where owner_profile_id is null
  and name like '%(fictive)%';

-- 3. Documents de test dans le Storage (bucket medical-documents)
--    Les objets appartenant aux comptes supprimés :
delete from storage.objects
where bucket_id = 'medical-documents'
  and owner is null  -- objets orphelins après suppression des comptes
   or (bucket_id = 'medical-documents'
       and owner not in (select id from auth.users));

-- 4. Contrôle post-purge
select
  (select count(*) from public.profiles)          as profils_restants,
  (select count(*) from public.pharmacies)        as pharmacies_restantes,
  (select count(*) from public.prescriptions)     as ordonnances_restantes,
  (select count(*) from public.sante_deliveries)  as livraisons_restantes,
  (select count(*) from public.sante_notifications) as notifications_restantes;
