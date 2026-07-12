import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import GeoLocateFields from '../../components/GeoLocateFields'
import { useAuth } from '../../contexts/AuthContext'
import { COMMUNES_ABIDJAN, formatDistance } from '../../lib/geo'
import { supabase } from '../../lib/supabaseClient'
import type { NearbyPharmacy } from '../../lib/database.types'

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

export default function PatientProfilePage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  // Formulaire adresse
  const [addressLine, setAddressLine] = useState('')
  const [commune, setCommune] = useState('')
  const [city, setCity] = useState('Abidjan')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [preferredId, setPreferredId] = useState<string | null>(null)
  const [hasRow, setHasRow] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Pharmacies proches
  const [nearby, setNearby] = useState<NearbyPharmacy[]>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyError, setNearbyError] = useState<string | null>(null)
  const [choosingId, setChoosingId] = useState<string | null>(null)

  const loadNearby = useCallback(async (latValue: number, lngValue: number) => {
    setNearbyLoading(true)
    setNearbyError(null)
    const { data, error } = await supabase.rpc('nearest_pharmacies', {
      p_lat: latValue,
      p_lng: lngValue,
      p_limit: 5,
    })
    if (error) {
      setNearbyError(`Recherche impossible : ${error.message}`)
      setNearby([])
    } else {
      setNearby(data ?? [])
    }
    setNearbyLoading(false)
  }, [])

  // Chargement du profil patient existant
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled) return
      if (error) setMessage({ type: 'error', text: `Erreur de chargement : ${error.message}` })
      if (data) {
        setAddressLine(data.address_line)
        setCommune(data.commune)
        setCity(data.city)
        setLat(data.lat)
        setLng(data.lng)
        setPreferredId(data.preferred_pharmacy_id)
        setHasRow(true)
        if (data.lat !== null && data.lng !== null) void loadNearby(data.lat, data.lng)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [userId, loadNearby])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!addressLine.trim()) {
      setMessage({ type: 'error', text: 'Veuillez renseigner votre adresse (rue, quartier…).' })
      return
    }
    if ((lat === null) !== (lng === null)) {
      setMessage({ type: 'error', text: 'Latitude et longitude doivent être renseignées ensemble.' })
      return
    }
    setSaving(true)
    setMessage(null)
    const { error } = await supabase.from('patient_profiles').upsert({
      id: userId,
      address_line: addressLine.trim(),
      commune: commune.trim(),
      city: city.trim() || 'Abidjan',
      lat,
      lng,
    })
    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: `Enregistrement impossible : ${error.message}` })
      return
    }
    setHasRow(true)
    setMessage({ type: 'success', text: 'Adresse enregistrée ✔' })
    if (lat !== null && lng !== null) void loadNearby(lat, lng)
  }

  const choosePreferred = async (pharmacyId: string) => {
    if (!userId) return
    setChoosingId(pharmacyId)
    setMessage(null)
    const { error } = await supabase
      .from('patient_profiles')
      .update({ preferred_pharmacy_id: pharmacyId })
      .eq('id', userId)
    if (error) {
      setMessage({ type: 'error', text: `Sélection impossible : ${error.message}` })
    } else {
      setPreferredId(pharmacyId)
      setMessage({ type: 'success', text: 'Pharmacie préférée mise à jour ✔' })
    }
    setChoosingId(null)
  }

  return (
    <DashboardLayout
      title="Mon profil & ma pharmacie"
      subtitle="Votre adresse permet de trouver la pharmacie partenaire la plus proche de chez vous."
    >
      <Link to="/patient" className="text-sm font-semibold text-emerald-700 hover:underline">
        ← Retour au tableau de bord
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* ---------- Carte adresse ---------- */}
        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          noValidate
        >
          <h2 className="font-bold text-gray-900">📍 Mon adresse</h2>

          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Chargement…</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="addressLine" className="mb-1 block text-sm font-semibold text-gray-700">
                  Adresse (rue, quartier, repère)
                </label>
                <input
                  id="addressLine"
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Ex : Rue des Jardins, Deux-Plateaux, près de la station Total"
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="commune" className="mb-1 block text-sm font-semibold text-gray-700">
                    Commune
                  </label>
                  <input
                    id="commune"
                    type="text"
                    list="communes"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    placeholder="Ex : Cocody"
                    className={inputClass}
                  />
                  <datalist id="communes">
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
              </div>

              <GeoLocateFields lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln) }} />

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
                {saving ? 'Enregistrement…' : 'Enregistrer mon adresse'}
              </button>
            </div>
          )}
        </form>

        {/* ---------- Carte pharmacies proches ---------- */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-900">💊 Pharmacies partenaires proches</h2>

          {!hasRow || lat === null || lng === null ? (
            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
              Enregistrez votre adresse avec une position GPS pour découvrir les pharmacies
              partenaires les plus proches de chez vous.
            </p>
          ) : nearbyLoading ? (
            <p className="mt-4 text-sm text-gray-500">Recherche des pharmacies proches…</p>
          ) : nearbyError ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{nearbyError}</p>
          ) : nearby.length === 0 ? (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-800">
              Aucune pharmacie partenaire trouvée pour le moment. (En test : décommentez le bloc de
              pharmacies fictives du script SQL 002.)
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {nearby.map((ph, index) => {
                const isPreferred = ph.id === preferredId
                return (
                  <li
                    key={ph.id}
                    className={`rounded-xl border p-4 ${
                      isPreferred ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {index === 0 && !isPreferred ? '🥇 ' : ''}
                          {ph.name}
                          {isPreferred && (
                            <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                              ⭐ Préférée
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ph.address_line && `${ph.address_line} · `}
                          {ph.commune}, {ph.city}
                          {ph.phone && ` · ${ph.phone}`}
                        </p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                        {formatDistance(ph.distance_km)}
                      </span>
                    </div>
                    {!isPreferred && (
                      <button
                        onClick={() => void choosePreferred(ph.id)}
                        disabled={choosingId === ph.id}
                        className="mt-3 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                      >
                        {choosingId === ph.id ? 'Sélection…' : 'Choisir comme préférée'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-4 text-xs text-gray-400">
            🤝 Les pharmacies affichées sont des fiches partenaires (ou des données de test) — les
            vrais partenariats sont à négocier séparément.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
