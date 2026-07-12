interface StatusBadgeProps {
  label: string
  cls: string
}

export default function StatusBadge({ label, cls }: StatusBadgeProps) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}
