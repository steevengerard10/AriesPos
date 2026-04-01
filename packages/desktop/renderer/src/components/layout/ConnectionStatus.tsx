// packages/desktop/renderer/src/components/layout/ConnectionStatus.tsx
import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Server, Monitor } from 'lucide-react'

export const ConnectionStatus = () => {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected')
  const [mode, setMode] = useState<'server' | 'client'>('server')
  const [serverInfo, setServerInfo] = useState<{ ip: string; clients: number } | null>(null)

  useEffect(() => {
    // Obtener modo de configuración
    window.electronAPI.getAppMode().then((config: any) => {
      setMode(config.mode)
      if (config.mode === 'server') {
        setServerInfo({ ip: config.localIP, clients: 0 })
      }
    })

    // Escuchar cambios de conexión
    window.electronAPI.onConnectionChange((newStatus: string) => {
      setStatus(newStatus as any)
    })

    // Actualizar cantidad de clientes conectados (solo en servidor)
    window.electronAPI.onClientsUpdate((count: number) => {
      setServerInfo(prev => prev ? { ...prev, clients: count } : null)
    })
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 20,
      background: status === 'connected'
        ? 'rgba(16,185,129,0.1)'
        : status === 'reconnecting'
          ? 'rgba(245,158,11,0.1)'
          : 'rgba(239,68,68,0.1)',
      border: `1px solid ${
        status === 'connected' ? 'rgba(16,185,129,0.25)' :
        status === 'reconnecting' ? 'rgba(245,158,11,0.25)' :
        'rgba(239,68,68,0.25)'
      }`,
    }}>
      {mode === 'server'
        ? <Server size={11} color={status === 'connected' ? '#10b981' : '#ef4444'} />
        : status === 'connected'
          ? <Wifi size={11} color="#10b981" />
          : <WifiOff size={11} color="#ef4444" />
      }
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        color: status === 'connected' ? '#10b981' :
               status === 'reconnecting' ? '#f59e0b' : '#ef4444',
        fontFamily: 'DM Mono, monospace',
      }}>
        {mode === 'server'
          ? `SERVIDOR${serverInfo ? ` · ${serverInfo.clients} PC${serverInfo.clients !== 1 ? 's' : ''} conectadas` : ''}`
          : status === 'connected' ? 'CONECTADO AL SERVIDOR'
          : status === 'reconnecting' ? 'RECONECTANDO...'
          : 'SIN CONEXIÓN'
        }
      </span>
    </div>
  )
}
