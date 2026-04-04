// packages/desktop/renderer/src/screens/ConnectionLostScreen.tsx
import { useState, useEffect } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import styles from './ConnectionLostScreen.module.css'

export const ConnectionLostScreen = ({ serverIP }: { serverIP: string }) => {
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setAttempts(a => a + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={styles.container}>
      <WifiOff size={48} color="#ef4444" className={styles.icon} />
      <h2 className={styles.title}>Conexión perdida con el servidor</h2>
      <p className={styles.desc}>
        No se puede conectar a <strong style={{ color: '#4f8ef7', fontFamily: 'DM Mono, monospace' }}>{serverIP}:3001</strong><br />
        Verificá que la PC servidor esté encendida y con ARIESPos abierto.
      </p>
      <div className={styles.retry}>
        <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
        Reintentando conexión... (intento {attempts})
      </div>
      <button
        onClick={() => {
        ;(window as any).electron.invoke('app:resetAppConfig').then(() => {
          ;(window as any).electron.invoke('app:restart')
        })
      }}
        className={styles.button}
      >
        Cambiar configuración de servidor
      </button>
    </div>
  )
}
