@echo off
echo Starting LocalChat...
echo.

echo Installing dependencies...
npm install

echo.
echo Starting signaling server...
start "Signaling Server" cmd /k "npm start"

echo.
echo Waiting for server to start...
timeout /t 3 /nobreak > nul

echo.
echo Starting web server...
start "Web Server" cmd /k "python -m http.server 8000"

echo.
echo LocalChat is starting up!
echo.
echo Open http://localhost:8000 in your browser
echo.
echo Press any key to exit...
pause > nul
