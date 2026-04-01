// packages/desktop/renderer/src/screens/SetupScreen.tsx
import { useState } from 'react'
import { Monitor, Server, Wifi, ArrowRight, CheckCircle } from 'lucide-react'
import styles from './SetupScreen.module.css'

type Mode = 'server' | 'client'

interface SetupScreenProps {
  onComplete: (config: ServerConfig) => void
}

interface ServerConfig {
  mode: Mode
  serverIP?: string
  serverPort: number
  negocioNombre?: string
}

export const SetupScreen = ({ onComplete }: SetupScreenProps) => {
  const [mode, setMode] = useState<Mode | null>(null)
  const [serverIP, setServerIP] = useState('')
  const [serverPort, setServerPort] = useState('3001')
  const [negocioNombre, setNegocioNombre] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null)
  const [step, setStep] = useState<1 | 2>(1)

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(
        `http://${serverIP}:${serverPort}/api/ping`,
        { signal: AbortSignal.timeout(5000) }
      )
      const data = await res.json()
      if (data.status === 'ok') {
        setTestResult('ok')
        setNegocioNombre(data.negocio)
      } else {
        setTestResult('error')
      }
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  const handleComplete = () => {
    if (mode === 'server') {
      onComplete({ mode: 'server', serverPort: parseInt(serverPort), negocioNombre })
    } else {
      onComplete({ mode: 'client', serverIP, serverPort: parseInt(serverPort), negocioNombre })
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>A</div>
          <h1 className={styles.logoTitle}>
            ARIES<span className={styles.logoTitleAccent}>POS</span>
          </h1>
          <p className={styles.logoDesc}>
            Configuración inicial — primera vez
          </p>
        </div>
        {/* PASO 1 — Elegir modo */}
        {step === 1 && (
          <div>
            <p className={styles.modeQuestion}>¿Esta PC es el servidor o un cliente?</p>
            <div className={styles.modeGrid}>
              {/* Opción Servidor */}
              <div
                className={[
                  styles.modeOption,
                  mode === 'server' ? styles.modeOptionActiveServer : '',
                ].join(' ')}
                onClick={() => setMode('server')}
              >
                <Server size={32} color={mode === 'server' ? '#4f8ef7' : '#64748b'} style={{ margin: '0 auto 10px' }} />
                <p className={[
                  styles.modeOptionTitle,
                  mode === 'server' ? styles.modeOptionTitleServer : styles.modeOptionTitleDefault,
                ].join(' ')}>
                  Servidor
                </p>
                <p className={styles.modeOptionDesc}>
                  Esta PC tiene la base de datos. Las otras se conectan a esta.
                </p>
                <p className={styles.modeOptionNoteServer}>
                  Elegí esta en UNA sola PC
                </p>
              </div>
              {/* Opción Cliente */}
              <div
                className={[
                  styles.modeOption,
                  mode === 'client' ? styles.modeOptionActiveClient : '',
                ].join(' ')}
                onClick={() => setMode('client')}
              >
                <Monitor size={32} color={mode === 'client' ? '#10b981' : '#64748b'} style={{ margin: '0 auto 10px' }} />
                <p className={[
                  styles.modeOptionTitle,
                  mode === 'client' ? styles.modeOptionTitleClient : styles.modeOptionTitleDefault,
                ].join(' ')}>
                  Cliente
                </p>
                <p className={styles.modeOptionDesc}>
                  Esta PC se conecta al servidor. Podés tener todas las que quieras.
                </p>
                <p className={styles.modeOptionNoteClient}>
                  Elegí esta en las demás PC
                </p>
              </div>
            </div>
            {/* Info adicional según modo */}
            {mode === 'server' && (
              <div className={styles.infoBoxServer}>
                <p className={styles.infoBoxText}>
                  ✓ Esta PC debe estar <span className={styles.infoBoxStrong}>siempre encendida</span> mientras las otras trabajan.<br />
                  ✓ La base de datos queda guardada acá.<br />
                  ✓ Después de configurar, anotá la IP de esta PC para conectar las demás.
                </p>
              </div>
            )}
            {mode === 'client' && (
              <div className={styles.infoBoxClient}>
                <p className={styles.infoBoxText}>
                  ✓ Necesitás la <span className={styles.infoBoxStrong}>IP de la PC servidor</span> para continuar.<br />
                  ✓ El servidor tiene que estar encendido y con ARIESPos abierto.<br />
                  ✓ Ambas PC deben estar en la <span className={styles.infoBoxStrong}>misma red WiFi o cable</span>.
                </p>
              </div>
            )}
            <button
              disabled={!mode}
              onClick={() => setStep(2)}
              className={mode ? styles.buttonPrimary : [styles.buttonPrimary, styles.buttonPrimaryDisabled].join(' ')}
            >
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        )}
        {/* PASO 2 — Configuración según modo */}
        {step === 2 && mode === 'server' && (
          <div>
            <div className={styles.formGroup}>
              <p className={styles.formGroupTitle}>⚙️ Configuración del servidor</p>
              <label className={styles.formLabel}>Nombre del negocio</label>
              <input
                value={negocioNombre}
                onChange={e => setNegocioNombre(e.target.value)}
                placeholder="Ej: Almacén Don José"
                className={styles.formInput}
              />
              <label className={styles.formLabel}>Puerto del servidor (default: 3001)</label>
              <input
                value={serverPort}
                onChange={e => setServerPort(e.target.value)}
                placeholder="3001"
                className={[styles.formInput, styles.formInputMono].join(' ')}
              />
            </div>
            {/* Mostrar IP de esta PC */}
            <div className={styles.infoBoxServer}>
              <p className={styles.infoBoxText}>📋 IP de esta PC (para las otras PCs):</p>
              <p className={styles.infoBoxIP} id="localIP">Cargando...</p>
              <p className={styles.infoBoxNote}>Anotá este número. Las otras PCs lo necesitan para conectarse.</p>
            </div>
            <button
              onClick={handleComplete}
              className={styles.buttonPrimary}
            >
              <Server size={16} /> Iniciar como Servidor
            </button>
          </div>
        )}
        {step === 2 && mode === 'client' && (
          <div>
            <div className={styles.formGroup}>
              <p className={styles.formGroupTitle}>🔌 Conectar al servidor</p>
              <label className={styles.formLabel}>IP de la PC servidor</label>
              <div className={styles.flexRow}>
                <input
                  value={serverIP}
                  onChange={e => { setServerIP(e.target.value); setTestResult(null) }}
                  placeholder="192.168.1.63"
                  className={[styles.formInput, styles.formInputMono].join(' ')}
                  style={{ flex: 1, borderColor: testResult === 'ok' ? '#10b981' : testResult === 'error' ? '#ef4444' : undefined }}
                />
                <input
                  value={serverPort}
                  onChange={e => setServerPort(e.target.value)}
                  placeholder="3001"
                  className={[styles.formInput, styles.formInputMono, styles.inputShort].join(' ')}
                />
              </div>
              <button
                onClick={testConnection}
                disabled={!serverIP || testing}
                className={styles.buttonPrimary}
                style={{ background: 'transparent', border: '1px solid #3a4460', color: '#94a3b8', fontSize: 12, fontWeight: 500 }}
              >
                <Wifi size={13} />
                {testing ? 'Probando conexión...' : 'Probar conexión'}
              </button>
              {testResult === 'ok' && (
                <div className={styles.statusBoxOk}>
                  <p className={styles.statusBoxTextOk}>
                    <CheckCircle size={14} /> Conectado a: <strong>{negocioNombre}</strong>
                  </p>
                </div>
              )}
              {testResult === 'error' && (
                <div className={styles.statusBoxError}>
                  <p className={styles.statusBoxTextError}>
                    ✗ No se pudo conectar. Verificá:<br />
                    • Que la PC servidor esté encendida y con ARIESPos abierto<br />
                    • Que la IP sea correcta<br />
                    • Que ambas PC estén en el mismo WiFi
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleComplete}
              disabled={testResult !== 'ok'}
              className={testResult === 'ok' ? styles.buttonPrimary : [styles.buttonPrimary, styles.buttonPrimaryDisabled].join(' ')}
            >
              <Monitor size={16} /> Conectar y abrir ARIESPos
            </button>
          </div>
        )}
        {/* Botón volver */}
        {step === 2 && (
          <button
            onClick={() => { setStep(1); setTestResult(null) }}
            className={styles.buttonSecondary}
          >
            ← Volver
          </button>
        )}
      </div>
    </div>
  )
}
