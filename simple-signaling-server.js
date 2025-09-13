// Socket.IO signaling server for LocalChat
// Run with: node simple-signaling-server.js

const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const fs = require('fs');

const server = http.createServer((req, res) => {
    // Add CORS headers for Railway deployment
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Log all requests for debugging
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - IP: ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Handle health check endpoint
    if (req.url === '/health' || req.url === '/healthcheck') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            rooms: rooms.size,
            environment: process.env.NODE_ENV || 'development',
            railway: !!process.env.RAILWAY_ENVIRONMENT,
            port: PORT
        }));
        return;
    }
    
    // Simple test endpoint
    if (req.url === '/test') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>LocalChat Server Test</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                    .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .success { color: #28a745; }
                    .info { color: #17a2b8; }
                    .warning { color: #ffc107; }
                    a { color: #007bff; text-decoration: none; }
                    a:hover { text-decoration: underline; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1 class="success">✅ LocalChat Server is Running!</h1>
                    <h2>Server Information:</h2>
                    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
                    <p><strong>Railway:</strong> ${process.env.RAILWAY_ENVIRONMENT ? 'Yes ✅' : 'No ❌'}</p>
                    <p><strong>Port:</strong> ${PORT}</p>
                    <p><strong>Active Rooms:</strong> ${rooms.size}</p>
                    <p><strong>Request IP:</strong> ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}</p>
                    <p><strong>User Agent:</strong> ${req.headers['user-agent']}</p>
                    
                    <h2>Test Links:</h2>
                    <p><a href="/">🏠 Go to LocalChat App</a></p>
                    <p><a href="/health">🔍 Health Check (JSON)</a></p>
                    
                    <h2>If you can see this page:</h2>
                    <p class="info">✅ The server is accessible and working correctly!</p>
                    <p class="warning">⚠️ If LocalChat doesn't work, the issue is likely with WebRTC/WebSocket connections.</p>
                </div>
            </body>
            </html>
        `);
        return;
    }
    
    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    // Add a simple root test endpoint
    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('PONG - Server is working!');
        return;
    }
    
    // Socket.IO connection test endpoint
    if (req.url === '/socketio-test') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Socket.IO Test</title>
                <script src="https://cdn.socket.io/4.7.4/socket.io.min.js"></script>
            </head>
            <body>
                <h1>Socket.IO Connection Test</h1>
                <div id="status">Testing connection...</div>
                <div id="log"></div>
                <script>
                    const socket = io();
                    const status = document.getElementById('status');
                    const log = document.getElementById('log');
                    
                    socket.on('connect', () => {
                        status.innerHTML = '✅ Socket.IO Connected Successfully!';
                        log.innerHTML += '<p>Connected to server</p>';
                        socket.emit('join-room', { roomId: 'test', userId: 'test-user' });
                    });
                    
                    socket.on('connect_error', (error) => {
                        status.innerHTML = '❌ Socket.IO Connection Failed';
                        log.innerHTML += '<p>Error: ' + error.message + '</p>';
                    });
                    
                    socket.on('user-id', (data) => {
                        log.innerHTML += '<p>Received user ID: ' + data.userId + '</p>';
                    });
                </script>
            </body>
            </html>
        `);
        return;
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };
    
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Initialize Socket.IO server
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map(); // roomId -> Set of socket connections

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Handle joining a room
    socket.on('join-room', (data) => {
        const { roomId, userId } = data;
        const user = userId || `user_${Math.random().toString(36).substring(2, 15)}`;
        
        console.log(`User ${user} joining room ${roomId}`);
        
        // Join the socket room
        socket.join(roomId);
        
        // Add user to our room tracking
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket);
        
        // Store user info on socket
        socket.userId = user;
        socket.roomId = roomId;
        
        // Send user ID back to client
        socket.emit('user-id', { userId: user });
        
        // Notify other users in the room
        socket.to(roomId).emit('user-joined', { userId: user });
        
        console.log(`User ${user} joined room ${roomId}. Room now has ${rooms.get(roomId).size} users.`);
    });
    
    // Handle signaling messages
    socket.on('signaling-message', (data) => {
        const { type, payload } = data;
        console.log(`Signaling message from ${socket.userId}:`, type);
        
        // Broadcast to other users in the same room
        socket.to(socket.roomId).emit('signaling-message', {
            type,
            payload,
            from: socket.userId
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);
        
        if (socket.roomId) {
            // Remove from room tracking
            if (rooms.has(socket.roomId)) {
                rooms.get(socket.roomId).delete(socket);
                
                // Notify other users
                socket.to(socket.roomId).emit('user-left', { userId: socket.userId });
                
                // Clean up empty rooms
                if (rooms.get(socket.roomId).size === 0) {
                    rooms.delete(socket.roomId);
                    console.log(`Room ${socket.roomId} deleted (empty)`);
                }
            }
        }
    });
    
    // Handle errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.userId}:`, error);
    });
});

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Socket.IO signaling server running on ${HOST}:${PORT}`);
    console.log(`Socket.IO endpoint: http://${HOST}:${PORT}`);
    console.log('Server is accessible from anywhere!');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Railway deployment detected:', !!process.env.RAILWAY_ENVIRONMENT);
    console.log('Socket.IO server initialized successfully!');
    console.log('Available endpoints:');
    console.log('  - Main app: http://' + HOST + ':' + PORT + '/');
    console.log('  - Test page: http://' + HOST + ':' + PORT + '/test');
    console.log('  - Ping: http://' + HOST + ':' + PORT + '/ping');
    console.log('  - Health: http://' + HOST + ':' + PORT + '/health');
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
