import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../../components/Logo'
import { useSettings } from '../../lib/settings'

/**
 * P0 Confiance — Pages légales publiques.
 * Le CONTENU est désormais éditable par l'admin (/admin/parametres,
 * table sante_settings). Si la base ne fournit pas encore de texte
 * (migration 010 non exécutée), un modèle intégré s'affiche.
 * ⚠️ Dans tous les cas : à faire valider par un juriste ivoirien.
 */

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/">
            <Logo />
          </Link>
          <Link to="/connexion" className="text-sm font-semibold text-emerald-700 hover:underline">
            Connexion
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ <strong>Document modèle</strong> — contenu à faire valider et compléter par un juriste
          ivoirien avant publication (droit de la santé, protection des données, ARTCI).
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900">{title}</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-700">{children}</div>
        <nav className="mt-10 flex flex-wrap gap-4 border-t border-gray-200 pt-4 text-xs text-gray-500">
          <Link to="/mentions-legales" className="hover:underline">Mentions légales</Link>
          <Link to="/confidentialite" className="hover:underline">Confidentialité & données de santé</Link>
          <Link to="/cgu" className="hover:underline">CGU</Link>
          <Link to="/" className="hover:underline">Retour à l'application</Link>
        </nav>
      </main>
    </div>
  )
}

/**
 * Rend un texte légal administré : paragraphes séparés par une ligne
 * vide ; une ligne entièrement EN MAJUSCULES devient un titre.
 */
function LegalText({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n')
        const first = (lines[0] ?? '').trim()
        const isTitle = first.length >= 3 && first === first.toUpperCase() && /[A-ZÀ-Ü]/.test(first)
        const body = (isTitle ? lines.slice(1) : lines).join('\n').trim()
        return (
          <div key={i}>
            {isTitle && (
              <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-gray-900">{first}</h2>
            )}
            {body && <p className="mt-1 whitespace-pre-line">{body}</p>}
          </div>
        )
      })}
    </>
  )
}

// ---------- Modèles intégrés (repli si la base est vide) ----------

function H2({ children }: { children: ReactNode }) {
  return <h2 className="pt-2 text-base font-bold text-gray-900">{children}</h2>
}

function DefaultMentions() {
  return (
    <>
      <H2>Éditeur de la plateforme</H2>
      <p>
        Santé Facile (sante-facile-ci) — [À COMPLÉTER : raison sociale, forme juridique, capital,
        RCCM, siège social à Abidjan, téléphone, e-mail de contact].
      </p>
      <H2>Directeur de la publication</H2>
      <p>[À COMPLÉTER : nom du représentant légal].</p>
      <H2>Hébergement</H2>
      <p>
        Application hébergée par Vercel Inc. (frontend) et Supabase Inc. (données, région Europe —
        Francfort). [À VALIDER : conformité de l'hébergement des données de santé ivoiriennes hors
        du territoire national.]
      </p>
      <H2>Activité</H2>
      <p>
        Plateforme de mise en relation pour la télémédecine, la transmission d'ordonnances
        électroniques aux pharmacies partenaires et la prise en charge par des organismes
        d'assurance. Santé Facile n'est ni un établissement de santé, ni une pharmacie, ni un
        assureur.
      </p>
      <H2>Urgences</H2>
      <p>
        En cas d'urgence vitale, appelez immédiatement le SAMU (185), les sapeurs-pompiers (180)
        ou la police secours (110).
      </p>
    </>
  )
}

function DefaultConfidentialite() {
  return (
    <>
      <H2>Données collectées</H2>
      <p>
        Compte (nom, e-mail, téléphone, rôle), profil médical déclaratif, adresse et position GPS,
        rendez-vous, ordonnances, livraisons, messagerie et documents médicaux téléversés.
      </p>
      <H2>Protection</H2>
      <p>
        Chiffrement en transit, cloisonnement des accès par rôle (RLS), documents privés à liens
        signés, salles vidéo à identifiant unique. Cadre : loi ivoirienne n° 2013-450, ARTCI [À
        VALIDER par un juriste].
      </p>
      <H2>Vos droits</H2>
      <p>Accès, rectification, suppression : [À COMPLÉTER : e-mail du responsable de traitement].</p>
    </>
  )
}

function DefaultCGU() {
  return (
    <>
      <H2>Rôle de la plateforme</H2>
      <p>
        Outil technique de mise en relation et de transmission sécurisée. Les actes médicaux
        relèvent des médecins ; la délivrance des pharmacies ; les prises en charge des assureurs.
      </p>
      <H2>Urgences</H2>
      <p>
        Le bouton « Urgence » ne remplace pas les services de secours : en urgence vitale, appelez
        le 185 (SAMU).
      </p>
      <H2>Droit applicable</H2>
      <p>Droit ivoirien. Juridictions compétentes : tribunaux d'Abidjan. [À VALIDER.]</p>
    </>
  )
}

// ---------- Pages ----------

export function MentionsLegalesPage() {
  const { settings } = useSettings()
  return (
    <LegalShell title="Mentions légales">
      {settings.legalMentions ? <LegalText text={settings.legalMentions} /> : <DefaultMentions />}
    </LegalShell>
  )
}

export function ConfidentialitePage() {
  const { settings } = useSettings()
  return (
    <LegalShell title="Politique de confidentialité & données de santé">
      {settings.legalConfidentialite ? (
        <LegalText text={settings.legalConfidentialite} />
      ) : (
        <DefaultConfidentialite />
      )}
    </LegalShell>
  )
}

export function CGUPage() {
  const { settings } = useSettings()
  return (
    <LegalShell title="Conditions générales d'utilisation">
      {settings.legalCgu ? <LegalText text={settings.legalCgu} /> : <DefaultCGU />}
    </LegalShell>
  )
}
