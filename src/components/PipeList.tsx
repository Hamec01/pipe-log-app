interface PipeListProps {
  pipes: string[]
}

export function PipeList({ pipes }: PipeListProps) {
  if (pipes.length === 0) {
    return <p className="muted">No pipes in the list.</p>
  }

  return (
    <ul className="pipe-list">
      {pipes.map((pipe) => (
        <li key={pipe}>{pipe}</li>
      ))}
    </ul>
  )
}
