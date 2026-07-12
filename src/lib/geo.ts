// Utilitaires de géolocalisation — Module 2

/** Les communes du District d'Abidjan (suggestions, saisie libre possible). */
export const COMMUNES_ABIDJAN = [
  'Abobo',
  'Adjamé',
  'Anyama',
  'Attécoubé',
  'Bingerville',
  'Cocody',
  'Koumassi',
  'Marcory',
  'Plateau',
  'Port-Bouët',
  'Songon',
  'Treichville',
  'Yopougon',
]

/** Enveloppe promesse de l'API Geolocation du navigateur. */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    })
  })
}

/** Message d'erreur en français pour l'API Geolocation. */
export function geoErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as GeolocationPositionError).code
    if (code === 1)
      return 'Autorisation refusée : autorisez la localisation dans votre navigateur, ou saisissez les coordonnées manuellement.'
    if (code === 2)
      return 'Position indisponible : réessayez, ou saisissez les coordonnées manuellement.'
    if (code === 3) return 'Délai dépassé : réessayez, ou saisissez les coordonnées manuellement.'
  }
  return "La géolocalisation n'est pas disponible sur cet appareil — saisissez les coordonnées manuellement."
}

/** Formate une distance en km (ex : 0.85 → "850 m", 3.2 → "3,2 km"). */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`
}
