export default function LoadingScreen({ message = 'Chargement…' }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white">
        +
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
