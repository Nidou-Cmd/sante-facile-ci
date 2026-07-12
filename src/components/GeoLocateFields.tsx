import { useState } from 'react'
import { geoErrorMessage, getCurrentPosition } from '../lib/geo'

interface GeoLocateFieldsProps {
  lat: number | null
  lng: number | null
  onChange: (lat: number | null, lng: number | null) => void
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

function parseCoord(value: string): number | null {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '' || trimmed === '-') return null
  const n = Number(trimmed)
  return Number.isNaN(n) ? null : n
}

/**
 * Position GPS : bouton "Me localiser" (API du navigateur) +
 * champs latitude/longitude en saisie manuelle (secours).
 */
export default function GeoLocateFields({ lat, lng, onChange }: GeoLocateFieldsProps) {
  const [locating, setLocating] = useState(false)
  const [geoMessage, setGeoMessage] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  const locate = async () => {
    setLocating(true)
    setGeoMessage(null)
    try {
      const pos = await getCurrentPosition()
      onChange(Number(pos.coords.latitude.toFixed(6)), Number(pos.coords.longitude.toFixed(6)))
      setAccuracy(Math.round(pos.coords.accuracy))
    } catch (err) {
      setGeoMessage(geoErrorMessage(err))
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">Position GPS</p>
          <p className="text-xs text-gray-500">
            Utilisée pour trouver la pharmacie partenaire la plus proche.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void locate()}
          disabled={locating}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {locating ? 'Localisation…' : '📍 Me localiser'}
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="lat" className="mb-1 block text-xs font-semibold text-gray-600">
            Latitude
          </label>
          <input
            id="lat"
            type="text"
            inputMode="decimal"
            value={lat ?? ''}
            onChange={(e) => onChange(parseCoord(e.target.value), lng)}
            placeholder="Ex : 5.344400"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lng" className="mb-1 block text-xs font-semibold text-gray-600">
            Longitude
          </label>
          <input
            id="lng"
            type="text"
            inputMode="decimal"
            value={lng ?? ''}
            onChange={(e) => onChange(lat, parseCoord(e.target.value))}
            placeholder="Ex : -3.987400"
            className={inputClass}
          />
        </div>
      </div>

      {accuracy !== null && !geoMessage && (
        <p className="mt-2 text-xs text-emerald-700">
          ✓ Position captée (précision ≈ {accuracy} m)
        </p>
      )}
      {geoMessage && <p className="mt-2 text-xs text-amber-700">{geoMessage}</p>}
    </div>
  )
}
