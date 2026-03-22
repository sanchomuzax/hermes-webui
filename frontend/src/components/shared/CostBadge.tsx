interface CostBadgeProps {
  cost: number | null | undefined
}

export function CostBadge({ cost }: CostBadgeProps) {
  if (!cost) return null

  const formatted = cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`

  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-mono"
      style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: 'var(--color-primary)' }}>
      {formatted}
    </span>
  )
}
