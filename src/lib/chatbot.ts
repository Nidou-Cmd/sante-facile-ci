// ============================================================
// Module 10 — Chatbot d'assistance (réponses pré-définies, FR)
// Moteur à règles : mots-clés normalisés → réponse.
// ============================================================

export interface ChatbotEntry {
  keywords: string[]
  answer: string
}

export const CHATBOT_GREETING =
  "Bonjour 👋 Je suis l'assistant Santé Facile. Posez-moi une question sur les rendez-vous, l'urgence, les ordonnances, la livraison, l'assurance ou votre compte."

export const CHATBOT_FALLBACK =
  "Je n'ai pas compris votre question 🤔. Essayez avec des mots comme « rendez-vous », « urgence », « ordonnance », « livraison », « pharmacie », « assurance » ou « compte ». Pour toute urgence vitale, appelez immédiatement le 185 (SAMU Côte d'Ivoire — numéro à vérifier localement)."

export const CHATBOT_QUICK_QUESTIONS = [
  'Comment prendre rendez-vous ?',
  'Comment fonctionne le bouton Urgence ?',
  'Où est ma livraison ?',
  'Comment marche la prise en charge assurance ?',
]

const ENTRIES: ChatbotEntry[] = [
  {
    keywords: ['rendez-vous', 'rendez vous', 'rdv', 'reserver', 'réserver', 'reservation', 'consultation', 'medecin', 'médecin', 'docteur'],
    answer:
      "📅 Pour consulter un médecin : ouvrez « Rendez-vous & Urgence » depuis votre tableau de bord, choisissez un médecin vérifié, proposez une date et un motif. Le médecin confirme, puis la consultation se fait en vidéo — sans déplacement ni salle d'attente.",
  },
  {
    keywords: ['urgence', 'urgent', 'immediat', 'immédiat', 'grave'],
    answer:
      "🚨 Le bouton Urgence crée une demande PRIORITAIRE visible par tous les médecins disponibles : le premier qui l'accepte vous prend en charge immédiatement en vidéo. ⚠️ En cas d'urgence vitale (accident grave, détresse respiratoire…), appelez d'abord les secours (SAMU : 185 — numéro à vérifier localement).",
  },
  {
    keywords: ['ordonnance', 'prescription', 'medicament', 'médicament'],
    answer:
      "📄 Après la consultation, votre médecin rédige une ordonnance électronique envoyée automatiquement à la pharmacie partenaire la plus proche de chez vous (ou votre pharmacie préférée). Retrouvez toutes vos ordonnances dans « Mes ordonnances », avec impression PDF possible.",
  },
  {
    keywords: ['livraison', 'livreur', 'colis', 'suivi', 'livre', 'livré'],
    answer:
      '🛵 Vos médicaments sont livrés depuis la pharmacie partenaire. Suivez chaque étape en temps réel dans « Suivi de livraison » : préparation → en route → livré. Le nom et le téléphone du livreur y sont affichés dès le départ de la course.',
  },
  {
    keywords: ['pharmacie', 'officine', 'proche', 'preferee', 'préférée'],
    answer:
      "💊 Renseignez votre adresse et votre position GPS dans « Mon profil & ma pharmacie » : nous calculons automatiquement les pharmacies partenaires les plus proches et vous choisissez votre préférée. C'est elle qui recevra vos ordonnances en priorité.",
  },
  {
    keywords: ['assurance', 'assureur', 'prise en charge', 'remboursement', 'mutuelle', 'couverture', 'eligibilite', 'éligibilité'],
    answer:
      "🛡️ Si votre assureur partenaire vous a enregistré, une police apparaît dans votre espace. Sur chaque ordonnance, cliquez « Demander la prise en charge » : l'assureur valide une couverture totale ou partielle et vous suivez la décision dans « Mes ordonnances ».",
  },
  {
    keywords: ['compte', 'mot de passe', 'connexion', 'inscription', 'email', 'e-mail', 'profil'],
    answer:
      "👤 Votre compte : l'inscription se fait avec votre e-mail et un rôle (patient, médecin, pharmacie, assureur). Les comptes professionnels sont vérifiés par un administrateur avant activation complète. Mot de passe oublié ? Utilisez « Se déconnecter » puis la réinitialisation depuis l'écran de connexion (fonction e-mail de Supabase).",
  },
  {
    keywords: ['video', 'vidéo', 'camera', 'caméra', 'micro', 'jitsi'],
    answer:
      "🎥 La consultation vidéo s'ouvre directement dans l'application (technologie Jitsi). Autorisez la caméra et le micro quand le navigateur le demande. Une connexion 3G/4G stable suffit ; en cas de coupure, rechargez simplement la page de consultation.",
  },
  {
    keywords: ['prix', 'tarif', 'cout', 'coût', 'payer', 'paiement', 'fcfa'],
    answer:
      "💰 Les tarifs de consultation et des médicaments dépendent des praticiens et officines partenaires. Le paiement mobile (Orange Money, MTN MoMo, Wave) est prévu dans une prochaine version — pour l'instant, le règlement se fait selon les modalités convenues avec votre praticien/pharmacie.",
  },
  {
    keywords: ['contact', 'aide', 'support', 'assistance', 'probleme', 'problème', 'bug'],
    answer:
      "🤝 Besoin d'aide humaine ? Écrivez à support@santefacile.ci (exemple à configurer) ou utilisez la messagerie sécurisée avec votre médecin pour toute question médicale. Ce chatbot ne remplace jamais un avis médical.",
  },
]

/** Normalise : minuscules + sans accents, pour une correspondance robuste. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Retourne la meilleure réponse pré-définie pour une question donnée. */
export function chatbotAnswer(question: string): string {
  const q = normalize(question)
  let best: { score: number; answer: string } | null = null
  for (const entry of ENTRIES) {
    let score = 0
    for (const kw of entry.keywords) {
      if (q.includes(normalize(kw))) score += kw.length
    }
    if (score > 0 && (!best || score > best.score)) best = { score, answer: entry.answer }
  }
  return best ? best.answer : CHATBOT_FALLBACK
}
