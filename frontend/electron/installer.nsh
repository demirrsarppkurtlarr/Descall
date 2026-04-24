!macro customHeader
  ; Custom installer header
!macroend

!macro customWelcomePage
  ; Show welcome page with app info
!macroend

!macro customInstallMode
  ; Allow user to choose install mode
!macroend

!macro customInstall
  ; Post-install actions
  DetailPrint "Installing Descall..."
  
  ; Create app data directory
  CreateDirectory "$LOCALAPPDATA\Descall"
  
  ; Write uninstall info
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Descall" \
    "DisplayName" "Descall"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Descall" \
    "DisplayIcon" "$INSTDIR\Descall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Descall" \
    "UninstallString" "$INSTDIR\Uninstall Descall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Descall" \
    "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Descall" \
    "Publisher" "Descall Team"
!macroend

!macro customUnInstall
  ; Pre-uninstall actions
  DetailPrint "Removing Descall..."
  
  ; Remove app data (optional - keep user data)
  ; RMDir /r "$LOCALAPPDATA\Descall"
  
  ; Remove registry entries
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Descall"
!macroend
