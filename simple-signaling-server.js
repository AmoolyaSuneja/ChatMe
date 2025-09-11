// Simple WebSocket signaling server for LocalChat
// Run with: node simple-signaling-server.js

const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

const server = http.createServer((req, res) => {
    // Add CORS headers for Railway deployment
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
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
            environment: process.env.NODE_ENV || 'development'
        }));
        return;
    }
    
    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
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

const wss = new WebSocket.Server({ server });

const rooms = new Map(); // roomId -> Set of WebSocket connections

wss.on('connection', (ws, req) => {
    const query = url.parse(req.url, true).query;
    const roomId = query.roomId;
    const userId = query.userId || `user_${Math.random().toString(36).substring(2, 15)}`;
    
    console.log(`User ${userId} connected to room ${roomId}`);
    
    // Add user to room
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(ws);
    
    // Send user ID back to client
    ws.send(JSON.stringify({
        type: 'user-id',
        userId: userId
    }));
    
    // Notify other users in the room
    rooms.get(roomId).forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'user-joined',
                userId: userId
            }));
        }
    });
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`Message from ${userId} in room ${roomId}:`, data.type);
            
            // Broadcast message to all other users in the room
            rooms.get(roomId).forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        ...data,
                        from: userId
                    }));
                }
            });
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log(`User ${userId} disconnected from room ${roomId}`);
        
        // Remove user from room
        if (rooms.has(roomId)) {
            rooms.get(roomId).delete(ws);
            
            // Notify other users
            rooms.get(roomId).forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'user-left',
                        userId: userId
                    }));
                }
            });
            
            // Clean up empty rooms
            if (rooms.get(roomId).size === 0) {
                rooms.delete(roomId);
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
    });
});

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Signaling server running on ${HOST}:${PORT}`);
    console.log(`WebSocket endpoint: ws://${HOST}:${PORT}`);
    console.log('Server is accessible from anywhere!');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Railway deployment detected:', !!process.env.RAILWAY_ENVIRONMENT);
});
