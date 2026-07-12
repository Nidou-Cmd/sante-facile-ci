import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import GeoLocateFields from '../../components/GeoLocateFields'
import { useAuth } from '../../contexts/AuthContext'
import { COMMUNES_ABIDJAN } from '../../lib/geo'
import { supabase } from '../../lib/supabaseClient'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

/**
 * Fiche officine : la pharmacie renseigne son adresse et sa position GPS
 * pour devenir visible des patients dans le calcul de proximité.
 */
export default function PharmacieFichePage() {
  const { user, profile } = useAuth()
  const userId = user?.id ?? null

  const [pharmacyRowId, setPharmacyRowId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [commune, setCommune] = useState('')
  const [city, setCity] = useState('Abidjan')
  const [phone, setPhone] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [isActive, setIsActive] = useState(true)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Chargement de la fiche existante
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('*')
        .eq('owner_profile_id', userId)
        .maybeSingle()
      if (cancelled) return
      if (error) setMessage({ type: 'error', text: `Erreur de chargement : ${error.message}` })
      if (data) {
        setPharmacyRowId(data.id)
        setName(data.name)
        setAddressLine(data.address_line)
        setCommune(data.commune)
        setCity(data.city)
        setPhone(data.phone ?? '')
        setLat(data.lat)
        setLng(data.lng)
        setIsActive(data.is_active)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  // Pré-remplissage du nom avec celui du compte
  useEffect(() => {
    if (!loading && !pharmacyRowId && !name && profile?.full_name) setName(profile.full_name)
  }, [loading, pharmacyRowId, name, profile])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!name.trim()) {
      setMessage({ type: 'error', text: "Veuillez renseigner le nom de l'officine." })
      return
    }
    if ((lat === null) !== (lng === null)) {
      setMessage({ type: 'error', text: 'Latitude et longitude doivent être renseignées ensemble.' })
      return
    }
    setSaving(true)
    setMessage(null)

    const values = {
      name: name.trim(),
      address_line: addressLine.trim(),
      commune: commune.trim(),
      city: city.trim() || 'Abidjan',
      phone: phone.trim() || null,
      lat,
      lng,
      is_active: isActive,
    }

    let saveError: string | null = null
    if (pharmacyRowId) {
      const { error } = await supabase.from('pharmacies').update(values).eq('id', pharmacyRowId)
      saveError = error?.message ?? null
    } else {
      const { data, error } = await supabase
        .from('pharmacies')
        .insert({ ...values, owner_profile_id: userId })
        .select('id')
        .single()
      saveError = error?.message ?? null
      if (data) setPharmacyRowId(data.id)
    }

    setSaving(false)
    if (saveError) {
      setMessage({ type: 'error', text: `Enregistrement impossible : ${saveError}` })
    } else {
      setMessage({ type: 'success', text: 'Fiche officine enregistrée ✔' })
    }
  }

  return (
    <DashboardLayout
      title="Ma fiche officine"
      subtitle="Renseignez votre adresse et votre position GPS pour être visible des patients proches."
    >
      <Link to="/pharmacie" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      <form
        onSubmit={handleSave}
        className="mt-4 max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        noValidate
      >
        {profile && !profile.is_verified && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⏳ Votre fiche ne sera proposée aux patients qu'après vérification de votre compte par
            un administrateur Santé Facile.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-semibold text-gray-700">
                Nom de l'officine
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Pharmacie de Cocody"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="addressLine" className="mb-1 block text-sm font-semibold text-gray-700">
                Adresse (rue, quartier, repère)
              </label>
              <input
                id="addressLine"
                type="text"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Ex : Boulevard Latrille, face au marché"
                className={inputClass}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="commune" className="mb-1 block text-sm font-semibold text-gray-700">
                  Commune
                </label>
                <input
                  id="commune"
                  type="text"
                  list="communes-pharmacie"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="Ex : Cocody"
                  className={inputClass}
                />
                <datalist id="communes-pharmacie">
                  {COMMUNES_ABIDJAN.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="city" className="mb-1 block text-sm font-semibold text-gray-700">
                  Ville
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Abidjan"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-gray-700">
                  Téléphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 27 00 00 00 00"
                  className={inputClass}
                />
              </div>
            </div>

            <GeoLocateFields lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} />

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              Officine active (visible dans la recherche de proximité)
            </label>

            {message && (
              <p
                role="alert"
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer ma fiche'}
            </button>
          </div>
        )}
      </form>
    </DashboardLayout>
  )
}
