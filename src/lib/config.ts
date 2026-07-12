// ============================================================
// Configuration métier de Santé Facile
// ============================================================

/**
 * 💰 MODÈLE DE REVENU — EXEMPLE À VALIDER avec les partenaires.
 * Stratégie retenue (analyse 07/2026) : hybride freemium patient
 * + commission par transaction validée (pharmacie/assurance).
 * Le taux ci-dessous est un exemple à négocier, non facturé.
 */
export const COMMISSION_PERCENT_EXAMPLE = 2

/** Préfixe des salles de vidéoconsultation Jitsi. */
export const JITSI_ROOM_PREFIX = 'SanteFacileCI'

/**
 * Serveur Jitsi : configurable par variable d'environnement pour
 * brancher un serveur dédié/JaaS en production (confidentialité
 * des consultations — recommandé avant lancement réel).
 * Défaut : serveur public meet.jit.si (prototype uniquement).
 */
export const JITSI_BASE_URL: string =
  (import.meta.env.VITE_JITSI_URL as string | undefined)?.replace(/\/$/, '') || 'https://meet.jit.si'

/**
 * ☎️ NUMÉROS D'URGENCE — CÔTE D'IVOIRE (courts et gratuits).
 * Vérifiés via sources publiques (Orange CI, guides officiels, 07/2026) :
 *   SAMU 185 · Sapeurs-pompiers (GSPM) 180 · Police secours 110/111/170.
 * ⚠️ À faire confirmer officiellement (ministère de la Santé) avant
 * production, et à adapter par pays lors de l'expansion régionale.
 */
export const EMERGENCY_NUMBERS = {
  samu: '185',
  pompiers: '180',
  police: '110',
} as const

/**
 * Délai (secondes) au-delà duquel une urgence non prise en charge
 * déclenche l'affichage renforcé des numéros de secours (fallback).
 */
export const EMERGENCY_FALLBACK_SECONDS = 240
