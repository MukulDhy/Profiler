' ProfileGPT portable launcher — starts launcher.js without a console window.
Option Explicit

Dim shell, fso, root, quote, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
quote = Chr(34)
shell.CurrentDirectory = root

command = quote & root & "\runtime\node.exe" & quote & " " & _
          quote & root & "\launcher.js" & quote

On Error Resume Next
shell.Run command, 0, False
If Err.Number <> 0 Then
  MsgBox "ProfileGPT could not start." & vbCrLf & vbCrLf & _
         "Extract the whole ZIP and try again. Details: " & Err.Description, _
         vbCritical, "ProfileGPT"
End If
