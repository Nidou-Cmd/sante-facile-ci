import { useEffect, useState } from 'react'
import { useSettings } from '../lib/settings'

const STORAGE_KEY = 'sf_onboarding_v1'

interface Step {
  icon: string
  title: string
  text: (samu: string) => string
}

const STEPS: Step[] = [
  {
    icon: '📅',
    title: 'Consultez sans vous déplacer',
    text: () =>
      "Réservez une consultation vidéo avec un médecin, ou utilisez le bouton 🚨 Urgence pour une prise en charge prioritaire par le premier médecin disponible.",
  },
  {
    icon: '💊',
    title: 'Votre pharmacie vient à vous',
    text: () =>
      "Enregistrez votre adresse une seule fois : vos ordonnances partent automatiquement à la pharmacie partenaire la plus proche, et vous suivez la livraison en direct (préparation → en route → livré).",
  },
  {
    icon: '🔒',
    title: 'Confiance & sécurité',
    text: (samu) =>
      `Tous les médecins et pharmacies sont vérifiés par l'équipe Santé Facile. Vos échanges et documents médicaux sont protégés et réservés à vous et votre médecin. En cas d'urgence vitale, appelez d'abord le SAMU (${samu}).`,
  },
]

/**
 * P1 Onboarding confiance — mini-tutoriel affiché au premier usage
 * (3 étapes, mémorisé en local, jamais bloquant).
 */
export default function OnboardingTour() {
  const { settings } = useSettings()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      /* stockage local indisponible → ne rien afficher */
    }
  }, [])

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'done')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <div className="text-4xl">{current.icon}</div>
        <h2 className="mt-3 text-lg font-extrabold text-gray-900">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          {current.text(settings.emergencyNumbers.samu)}
        </p>

        {/* Points d'étape */}
        <div className="mt-5 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${i === step ? 'bg-emerald-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button onClick={close} className="text-xs font-semibold text-gray-400 hover:text-gray-600">
            Passer
          </button>
          <button
            onClick={() => (isLast ? close() : setStep((s) => s + 1))}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            {isLast ? "C'est parti ✅" : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>
  )
}
