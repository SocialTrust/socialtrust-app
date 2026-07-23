type StatPillProps = {
  label: string
  value: string
  helper?: string
}

export function StatPill({ label, value, helper }: StatPillProps) {
  return (
    <div className="statPill">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  )
}
