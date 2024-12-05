; Basic script
Name "OpenLauncher"

; Definitions
!define FILE_DIR "..\output-build"
Icon "logo.ico"
OutFile "..\OpenLauncher.exe"

; Include files
!include "MUI2.nsh"
!include "LogicLib.nsh"

; Additional definitions
!define APPNAME "OpenLauncher"
!define DESCRIPTION "OpenLauncher is an open-source Minecraft launcher developed in Python using PyQt5 and the minecraft_launcher_lib library."
!define DEVELOPER "CesarGarza55"
!define LOGO_ICON_FILE "logo.ico"
!define LICENSE_TEXT_FILE "LICENSE.txt"
!define HEADER_IMG_FILE "header.bmp"
!define VERSIONMAJOR 1
!define VERSIONMINOR 5
!define VERSIONBUILD 5
!define BUILDNUMBER 0
!define HELPURL "https://github.com/CesarGarza55/OpenLauncher"
!define UPDATEURL "https://github.com/CesarGarza55/OpenLauncher/releases/latest/download/OpenLauncher.exe"
!define ABOUTURL "https://github.com/CesarGarza55/OpenLauncher"
!define INSTALLSIZE 257396

; General settings
InstallDir "$PROGRAMFILES\${APPNAME}"
InstallDirRegKey HKCU "Software\${APPNAME}" ""
RequestExecutionLevel admin

; Variables
Var StartMenuFolder

; GUI
!define MUI_ICON "logo.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${HEADER_IMG_FILE}"
!define MUI_ABORTWARNING

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE_TEXT_FILE}"
!insertmacro MUI_PAGE_DIRECTORY
!define MUI_STARTMENUPAGE_REGISTRY_ROOT "HKCU"
!define MUI_STARTMENUPAGE_REGISTRY_KEY "Software\${APPNAME}"
!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "Start Menu Folder"
!insertmacro MUI_PAGE_STARTMENU Application $StartMenuFolder
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Language
!insertmacro MUI_LANGUAGE "English"

; Administrator verification
!macro VerifyUserIsAdmin
  UserInfo::GetAccountType
  pop $0
  ${If} $0 != "admin"
    messageBox mb_iconstop "Administrator rights required!"
    setErrorLevel 740
    quit
  ${EndIf}
!macroend

; Install section
Section "install"
  SetOutPath $INSTDIR
  file /r "${FILE_DIR}\*.*"
  file "${LOGO_ICON_FILE}"
  writeUninstaller "$INSTDIR\uninstall.exe"
  SetOutPath $INSTDIR
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\OpenLauncher.exe"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\uninstall.lnk" "$INSTDIR\uninstall.exe"
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\OpenLauncher.exe"
  WriteRegStr HKCU "Software\${APPNAME}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayName" "${APPNAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "QuitUninstallString" "$INSTDIR\uninstall.exe /S"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayIcon" "$INSTDIR\OpenLauncher.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "Publisher" "${DEVELOPER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "HelpLink" "${HELPURL}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLUpdateInfo" "${UPDATEURL}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "URLInfoAbout" "${ABOUTURL}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "DisplayVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.${BUILDNUMBER}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMajor" ${VERSIONMAJOR}
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "VersionMinor" ${VERSIONMINOR}
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "NoRepair" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "EstimatedSize" ${INSTALLSIZE}
SectionEnd

; Version info
VIProductVersion "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.${BUILDNUMBER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "Comments" "${DESCRIPTION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${DEVELOPER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "${DEVELOPER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "${APPNAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion" "${VERSIONMAJOR}.${VERSIONMINOR}.${VERSIONBUILD}.${BUILDNUMBER}"

; Verify uninstall
function un.onInit
  MessageBox MB_OKCANCEL "Permanently remove ${APPNAME}?" IDOK next
    Abort
  next:
  !insertmacro VerifyUserIsAdmin
functionEnd

; Uninstall section
Section "uninstall"
  delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  delete "$SMPROGRAMS\${APPNAME}\uninstall.lnk"
  delete "$DESKTOP\${APPNAME}.lnk"
  rmDir "$SMPROGRAMS\${APPNAME}"
  delete $INSTDIR\OpenLauncher.exe
  delete $INSTDIR\logo.ico
  delete $INSTDIR\uninstall.exe
  rmDir /r $INSTDIR\_internal
  rmDir $INSTDIR
  DeleteRegKey /ifempty HKCU "Software\${APPNAME}"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
SectionEnd