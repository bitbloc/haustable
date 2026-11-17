import { Navigate } from 'react-router-dom'
import { isAllowedPosDevice } from '../../utils/posDevice'

// Wraps /pos and /pos/cfd. An unregistered browser is sent home at once:
// the POS chunk is never rendered, so it fetches nothing and broadcasts nothing.
export default function PosDeviceGate({ children }) {
    if (!isAllowedPosDevice()) return <Navigate to="/" replace />
    return children
}
