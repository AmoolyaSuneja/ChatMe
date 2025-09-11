@echo off
echo Starting LocalChat for Network Testing...
echo.

echo Your computer's IP address: 10.111.236.197
echo.

echo Installing dependencies...
npm install

echo.
echo Starting signaling server (accessible from network)...
start "Signaling Server" cmd /k "npm start"

echo.
echo Waiting for server to start...
timeout /t 5 /nobreak > nul

echo.
echo Starting web server (accessible from network)...
start "Web Server" cmd /k "python -m http.server 8000"

echo.
echo ========================================
echo LocalChat is now accessible from network!
echo ========================================
echo.
echo On your computer: http://localhost:8000
echo On other devices: http://10.111.236.197:8000
echo.
echo Network test page: http://10.111.236.197:8000/network-test.html
echo.
echo Make sure both devices are on the same WiFi network!
echo.
echo Press any key to exit...
pause > nul
