interface LogoProps {
  size?: 'md' | 'lg'
  light?: boolean
}

export default function Logo({ size = 'md', light = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-xl font-bold ${
          light ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
        } ${size === 'lg' ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg'}`}
      >
        +
      </div>
      <span
        className={`font-extrabold leading-tight ${light ? 'text-white' : 'text-gray-900'} ${
          size === 'lg' ? 'text-2xl' : 'text-lg'
        }`}
      >
        Santé <span className={light ? 'text-emerald-200' : 'text-emerald-600'}>Facile</span>
      </span>
    </div>
  )
}
