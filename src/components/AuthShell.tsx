import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'

/** Mise en page partagée des écrans Connexion / Inscription. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Panneau de marque (desktop uniquement) */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-emerald-700 to-emerald-900 p-10 text-white lg:flex">
        <Logo light />
        <div>
          <h1 className="max-w-md text-4xl font-extrabold leading-tight">
            Le médecin et la pharmacie viennent à vous.
          </h1>
          <p className="mt-4 max-w-md text-emerald-100">
            Plus jamais de salle d'attente. Téléconsultation, e-prescription, livraison de
            médicaments et prise en charge assurance — dans une seule application.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-emerald-50">
            <li>🎥 Consultation vidéo sans déplacement</li>
            <li>💊 Médicaments livrés depuis la pharmacie la plus proche</li>
            <li>🛡️ Prise en charge assurance intégrée</li>
          </ul>
        </div>
        <p className="text-xs text-emerald-200">Côte d'Ivoire 🇨🇮 — bientôt en Afrique de l'Ouest</p>
      </div>

      {/* Zone formulaire */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo size="lg" />
          </div>
          {children}
          <p className="mt-8 flex flex-wrap justify-center gap-x-3 gap-y-1 text-center text-[11px] text-gray-400">
            <Link to="/mentions-legales" className="hover:underline">Mentions légales</Link>
            <Link to="/confidentialite" className="hover:underline">Confidentialité</Link>
            <Link to="/cgu" className="hover:underline">CGU</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
