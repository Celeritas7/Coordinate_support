@echo off
setlocal
cd /d "%~dp0"
set "PORT=8765"
set "URL=http://localhost:%PORT%/index.html"
title Route Studio  -  %URL%

if not exist "index.html" (
  echo index.html was not found next to this file.
  echo Put this .bat in the same folder as index.html (with its css\ and js\ folders).
  pause
  exit /b 1
)
for %%F in (js\route-studio.js js\analysis.js js\refine.js css\route-studio.css) do if not exist "%%F" echo Warning: %%F is missing, the app will not work fully.

netstat -ano | findstr /c:":%PORT% " | findstr /c:"LISTENING" >nul
if not errorlevel 1 (
  echo Route Studio is already running on port %PORT%. Opening it.
  start "" "%URL%"
  exit /b 0
)

set "PY="
py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY python -c "import sys" >nul 2>nul && set "PY=python"

echo.
echo   Route Studio  -  %URL%
echo   Keep this window open while you work. Close it to stop the app.
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process '%URL%'"

if defined PY (
  %PY% -m http.server %PORT% --bind 127.0.0.1
) else (
  echo   Python not found, using the built-in PowerShell server.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$r=(Get-Location).Path;$l=New-Object Net.HttpListener;$l.Prefixes.Add('http://localhost:%PORT%/');$l.Start();Write-Host '  Serving' $r;while($l.IsListening){$c=$l.GetContext();$p=[Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'));if(!$p){$p='index.html'};$f=[IO.Path]::GetFullPath((Join-Path $r $p));$o=$c.Response;if($f.StartsWith($r) -and (Test-Path $f -PathType Leaf)){$e=[IO.Path]::GetExtension($f);$t=@{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.css'='text/css';'.svg'='image/svg+xml';'.json'='application/json'}[$e];if($t){$o.ContentType=$t};$b=[IO.File]::ReadAllBytes($f)}else{$o.StatusCode=404;$b=[Text.Encoding]::UTF8.GetBytes('Not found')};$o.OutputStream.Write($b,0,$b.Length);$o.Close()}"
)

if errorlevel 1 (
  echo.
  echo The server stopped with an error. If port %PORT% is taken, change PORT at the top of this file.
  pause
)
endlocal
