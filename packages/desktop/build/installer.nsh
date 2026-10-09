; installer.nsh — ARIESPos NSIS custom macros
; Se ejecuta durante la instalación (que ya corre con privilegios de Administrador)
; Abre los puertos 3001 y 3002 en Windows Firewall para todas las redes

!macro customInstall
  DetailPrint "Abriendo puertos de red para ARIESPos..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="ARIESPos-3001"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="ARIESPos-3001" dir=in action=allow protocol=TCP localport=3001 profile=any'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="ARIESPos-3002"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="ARIESPos-3002" dir=in action=allow protocol=TCP localport=3002 profile=any'
  DetailPrint "Puertos de red configurados."
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="ARIESPos-3001"'
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="ARIESPos-3002"'
!macroend
