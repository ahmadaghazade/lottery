import { Navigate, useParams } from 'react-router-dom'

/** Admin draw control now lives on the cinematic public live route. */
export default function RaffleDrawPage() {
  const { raffleId } = useParams()
  return <Navigate to={`/live/${raffleId}`} replace />
}
