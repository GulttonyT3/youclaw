; Kill app and sidecar processes before install/uninstall
!macro KillAppProcesses
  ; Kill main app
  nsExec::ExecToLog 'taskkill /F /IM "You Claw.exe"'
  ; Kill sidecar (compiled bun binary)
  nsExec::ExecToLog 'taskkill /F /IM "youclaw-server.exe"'
  ; Wait for processes to exit
  Sleep 1000
!macroend

; Called before install — silently remove old version + kill processes
!macro NSIS_HOOK_PREINSTALL
  !insertmacro KillAppProcesses
!macroend

; Called before uninstall — kill processes so files can be deleted
!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro KillAppProcesses
!macroend
