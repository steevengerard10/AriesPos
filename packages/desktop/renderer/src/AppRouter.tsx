// packages/desktop/renderer/src/AppRouter.tsx
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { SetupScreen } from './screens/SetupScreen'
import { ConnectionLostScreen } from './screens/ConnectionLostScreen'
// ...otros imports de pantallas principales...

function AppRouterInner() {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected')
  const [serverIP, setServerIP] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Escuchar cambios de conexión desde preload
    const remove = (window as any).electron.onConnectionChange((status: string) => {
      setConnectionStatus(status as any)
      if ((status === 'disconnected' || status === 'reconnecting') && location.pathname !== '/offline') {
        // Obtener IP del servidor desde config
        ;(window as any).electron.invoke('app:getAppConfig').then((config: any) => {
          setServerIP(config.serverIP || '')
          navigate('/offline', { replace: true })
        })
      }
      if (status === 'connected' && location.pathname === '/offline') {
        navigate('/', { replace: true })
      }
    })
    return remove
  }, [navigate, location])

  return (
    <Routes>
      <Route path="/setup" element={<SetupScreen onComplete={() => {}} />} />
      <Route path="/offline" element={<ConnectionLostScreen serverIP={serverIP} />} />
      {/* Otras rutas principales de la app aquí */}
    </Routes>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRouterInner />
    </BrowserRouter>
  )
}
