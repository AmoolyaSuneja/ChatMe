// Global variables
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentRoom = null;
let userLocation = null;
let nearbyRooms = [];
let isMuted = false;
let isVideoOff = false;
let socket = null;
let isInitiator = false;
let roomParticipants = new Set();
let currentUserId = null;
let useWebSocket = false; // Flag to use WebSocket or localStorage

// WebRTC configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Simple signaling server simulation using localStorage and polling
const SIGNALING_INTERVAL = 500; // Check for signals every 500ms
const ROOM_CLEANUP_INTERVAL = 30000; // Clean up rooms every 30 seconds
// Auto-detect Socket.IO URL based on current context (handle file:// and invalid origins)
// Allow override via query param: ?signalUrl=https://your-railway-app.up.railway.app
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

const SOCKET_IO_URL = (() => {
    const override = getQueryParam('signalUrl');
    if (override) {
        try {
            const u = new URL(override);
            if (u.protocol === 'http:' || u.protocol === 'https:') {
                console.log('Using override Socket.IO URL:', u.origin);
                return u.origin;
            }
        } catch (e) {
            console.warn('Invalid signalUrl override, ignoring:', override);
        }
    }
    
    try {
        const origin = window.location.origin;
        console.log('Detected origin:', origin);
        
        if (!origin || origin === 'null' || origin.startsWith('file://')) {
            console.log('Using localhost fallback for file:// or null origin');
            return 'http://localhost:8080';
        }
        
        // Some Android/iOS webviews can report 'null' or empty origins
        if (origin === 'file://' || origin === 'about:blank') {
            console.log('Using localhost fallback for about:blank');
            return 'http://localhost:8080';
        }
        
        // For deployed sites, try to use the same origin
        console.log('Using same origin for Socket.IO:', origin);
        return origin;
    } catch (e) {
        console.error('Error detecting origin, using localhost:', e);
        return 'http://localhost:8080';
    }
})();

console.log('=== LocalChat Debug Info ===');
console.log('Socket.IO URL configured as:', SOCKET_IO_URL);
console.log('Current location:', window.location.href);
console.log('Protocol:', window.location.protocol);
console.log('Host:', window.location.host);
console.log('User Agent:', navigator.userAgent);
console.log('============================');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    requestLocationPermission();
    setupCrossTabCommunication();
});

// Setup cross-tab communication for localStorage fallback
function setupCrossTabCommunication() {
    // Listen for messages from other tabs
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'localChatSignal') {
            const signal = event.data.signal;
            if (signal.roomId === currentRoom?.id && signal.from !== currentUserId) {
                console.log('Received cross-tab signal:', signal);
                handleSignalingMessage(signal);
            }
        }
    });
    
    // Listen for storage changes (localStorage events)
    window.addEventListener('storage', (event) => {
        if (event.key && event.key.startsWith('signals_') && event.newValue) {
            const roomId = event.key.replace('signals_', '');
            if (roomId === currentRoom?.id) {
                console.log('Storage change detected for room:', roomId);
                // Trigger a check for new signals
                setTimeout(() => {
                    checkForSignalingMessages();
                }, 100);
            }
        }
    });
}

// Initialize app
function initializeApp() {
    showScreen('welcome-screen');
    updateLocationStatus('Getting your location...');
    
    // Always try to discover nearby rooms on startup
    setTimeout(() => {
        discoverNearbyRooms();
    }, 1000);
}

// Setup event listeners
function setupEventListeners() {
    // Welcome screen buttons
    document.getElementById('create-room-btn').addEventListener('click', () => {
        showScreen('create-room-screen');
    });
    
    document.getElementById('join-room-btn').addEventListener('click', () => {
        showScreen('join-room-screen');
    });
    
    // Create room screen
    document.getElementById('start-room-btn').addEventListener('click', createRoom);
    document.getElementById('back-to-welcome').addEventListener('click', () => {
        showScreen('welcome-screen');
    });
    
    // Join room screen
    document.getElementById('join-room-code-btn').addEventListener('click', joinRoomByCode);
    document.getElementById('back-to-welcome-join').addEventListener('click', () => {
        showScreen('welcome-screen');
    });
    
    // Video chat controls
    document.getElementById('mute-btn').addEventListener('click', toggleMute);
    document.getElementById('video-btn').addEventListener('click', toggleVideo);
    document.getElementById('end-call-btn').addEventListener('click', endCall);
    
    // Room name input
    document.getElementById('room-name').addEventListener('input', function() {
        this.value = this.value.replace(/[^a-zA-Z0-9\s]/g, '');
    });
    
    // Room code input
    document.getElementById('room-code').addEventListener('input', function() {
        this.value = this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    });
    
    // Refresh nearby rooms button
    document.getElementById('refresh-rooms-btn').addEventListener('click', function() {
        this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
        refreshNearbyRooms();
        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        }, 1000);
    });
}

// Screen management
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Location handling
function requestLocationPermission() {
    if (navigator.geolocation) {
        console.log('Requesting location permission...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                console.log('Location obtained:', userLocation);
                updateLocationStatus('Location found! You can now create or join rooms.');
                enableButtons();
                discoverNearbyRooms();
            },
            (error) => {
                console.error('Geolocation error:', error);
                updateLocationStatus('Location access denied. You can still join rooms with codes.');
                enableButtons();
                // Still try to discover rooms in case there are some without location requirements
                discoverNearbyRooms();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    } else {
        console.log('Geolocation not supported');
        updateLocationStatus('Geolocation not supported. You can still join rooms with codes.');
        enableButtons();
    }
}

function updateLocationStatus(message) {
    document.getElementById('location-text').textContent = message;
}

function enableButtons() {
    document.getElementById('create-room-btn').disabled = false;
    document.getElementById('join-room-btn').disabled = false;
}

// Room management
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function createRoom() {
    const roomName = document.getElementById('room-name').value.trim();
    const radius = parseInt(document.getElementById('room-radius').value);
    const allowDiscovery = document.getElementById('allow-discovery').checked;
    
    if (!roomName) {
        alert('Please enter a room name');
        return;
    }
    
    if (!userLocation && allowDiscovery) {
        alert('Location is required for room discovery');
        return;
    }
    
    const roomCode = generateRoomCode();
    currentRoom = {
        id: roomCode,
        name: roomName,
        radius: radius,
        allowDiscovery: allowDiscovery,
        location: userLocation,
        createdAt: Date.now(),
        participants: [],
        creatorId: generateUserId()
    };
    
    // Store room in localStorage for discovery
    if (allowDiscovery) {
        const rooms = JSON.parse(localStorage.getItem('localChatRooms') || '[]');
        // Remove any existing room with the same ID
        const filteredRooms = rooms.filter(room => room.id !== roomCode);
        filteredRooms.push(currentRoom);
        localStorage.setItem('localChatRooms', JSON.stringify(filteredRooms));
        
        console.log('Room created and stored:', currentRoom);
        
        // Force update nearby rooms display
        setTimeout(() => {
            discoverNearbyRooms();
        }, 500);
    }
    
    document.getElementById('current-room-name').textContent = roomName;
    document.getElementById('current-room-code').textContent = roomCode;
    
    startVideoChat();
}

function joinRoomByCode() {
    const roomCode = document.getElementById('room-code').value.trim().toUpperCase();
    
    if (!roomCode) {
        alert('Please enter a room code');
        return;
    }
    
    // Check if room exists in localStorage
    const rooms = JSON.parse(localStorage.getItem('localChatRooms') || '[]');
    const room = rooms.find(r => r.id === roomCode);
    
    if (room) {
        currentRoom = room;
        document.getElementById('current-room-name').textContent = room.name;
        document.getElementById('current-room-code').textContent = room.id;
        console.log('Joined existing room:', room);
        startVideoChat();
    } else {
        // Still allow joining with code (room might be created by someone else)
        currentRoom = {
            id: roomCode,
            name: `Room ${roomCode}`,
            participants: [],
            allowDiscovery: false
        };
        document.getElementById('current-room-name').textContent = currentRoom.name;
        document.getElementById('current-room-code').textContent = roomCode;
        console.log('Created new room for code:', roomCode);
        startVideoChat();
    }
}

function discoverNearbyRooms() {
    // Get rooms from localStorage
    const rooms = JSON.parse(localStorage.getItem('localChatRooms') || '[]');
    const currentTime = Date.now();
    
    console.log('Total rooms found:', rooms.length);
    console.log('User location:', userLocation);
    
    // Filter out old rooms (older than 1 hour) and rooms not allowing discovery
    const activeRooms = rooms.filter(room => {
        const isRecent = (currentTime - room.createdAt) < 3600000;
        const allowsDiscovery = room.allowDiscovery;
        
        console.log(`Room ${room.name}: recent=${isRecent}, discovery=${allowsDiscovery}`);
        
        return allowsDiscovery && isRecent;
    });
    
    console.log('Active rooms:', activeRooms.length);
    
    if (!userLocation) {
        console.log('No user location - showing all discoverable rooms');
        nearbyRooms = activeRooms;
    } else {
        // Filter rooms by distance
        nearbyRooms = activeRooms.filter(room => {
            if (!room.location) {
                console.log(`Room ${room.name}: no location data, including anyway`);
                return true;
            }
            
            const distance = calculateDistance(
                userLocation.latitude, userLocation.longitude,
                room.location.latitude, room.location.longitude
            );
            const withinRadius = distance <= room.radius;
            
            console.log(`Room ${room.name}: distance=${distance.toFixed(2)}km, radius=${room.radius}km, within=${withinRadius}`);
            
            return withinRadius;
        });
    }
    
    console.log('Nearby rooms found:', nearbyRooms.length);
    displayNearbyRooms();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function displayNearbyRooms() {
    const roomsList = document.getElementById('rooms-list');
    const nearbyRoomsDiv = document.getElementById('nearby-rooms');
    
    console.log('Displaying nearby rooms:', nearbyRooms.length);
    console.log('Nearby rooms data:', nearbyRooms);
    
    // Always show the nearby rooms section if there are any rooms
    if (nearbyRooms.length === 0) {
        nearbyRoomsDiv.style.display = 'block'; // Show section even with no rooms
        roomsList.innerHTML = '<p style="text-align: center; color: #71717a; padding: 20px;">No nearby rooms found. Create a test room to see how it works!</p>';
        console.log('No nearby rooms found, but showing section');
        return;
    }
    
    nearbyRoomsDiv.style.display = 'block';
    roomsList.innerHTML = '';
    
    nearbyRooms.forEach(room => {
        const distance = calculateDistance(
            userLocation.latitude, userLocation.longitude,
            room.location.latitude, room.location.longitude
        );
        
        const roomElement = document.createElement('div');
        roomElement.className = 'room-item';
        roomElement.innerHTML = `
            <div class="room-info">
                <div class="room-name">${room.name}</div>
                <div class="room-details">
                    <span class="room-distance">${userLocation ? distance.toFixed(1) + ' km away' : 'Location-based'}</span>
                    <span class="room-code">Code: ${room.id}</span>
                </div>
            </div>
            <button class="btn btn-primary" onclick="joinNearbyRoom('${room.id}')">
                <i class="fas fa-sign-in-alt"></i> Join
            </button>
        `;
        roomsList.appendChild(roomElement);
    });
}

function refreshNearbyRooms() {
    if (userLocation) {
        discoverNearbyRooms();
    }
}

// Test function to create a sample room (for debugging)
function createTestRoom() {
    const testRoom = {
        id: 'TEST' + Math.random().toString(36).substring(2, 6).toUpperCase(),
        name: 'Test Room - ' + new Date().toLocaleTimeString(),
        radius: 100, // Large radius to ensure it shows up
        allowDiscovery: true,
        location: userLocation || {
            latitude: 40.7128 + (Math.random() - 0.5) * 0.001, // Default to NYC area if no location
            longitude: -74.0060 + (Math.random() - 0.5) * 0.001
        },
        createdAt: Date.now(),
        participants: [],
        creatorId: 'test_creator'
    };
    
    // Add to localStorage
    const rooms = JSON.parse(localStorage.getItem('localChatRooms') || '[]');
    
    // Remove old test rooms
    const filteredRooms = rooms.filter(room => !room.id.startsWith('TEST'));
    filteredRooms.push(testRoom);
    
    localStorage.setItem('localChatRooms', JSON.stringify(filteredRooms));
    
    console.log('Test room created:', testRoom);
    console.log('All rooms in localStorage:', filteredRooms);
    
    // Force refresh nearby rooms immediately
    setTimeout(() => {
        discoverNearbyRooms();
    }, 100);
    
    alert('Test room created! It should appear in the nearby rooms list below.');
}

function joinNearbyRoom(roomId) {
    const room = nearbyRooms.find(r => r.id === roomId);
    if (room) {
        currentRoom = room;
        document.getElementById('current-room-name').textContent = room.name;
        document.getElementById('current-room-code').textContent = room.id;
        startVideoChat();
    }
}

// Test Socket.IO connection before using it
async function testSocketIOConnection() {
    return new Promise((resolve) => {
        console.log('Testing Socket.IO connection to:', SOCKET_IO_URL);
        
        const testSocket = io(SOCKET_IO_URL, {
            timeout: 8000,
            forceNew: true,
            transports: ['websocket', 'polling']
        });
        
        const timeout = setTimeout(() => {
            console.log('Socket.IO test timeout after 8 seconds');
            testSocket.disconnect();
            resolve(false);
        }, 8000);
        
        testSocket.on('connect', () => {
            console.log('✅ Socket.IO test successful!');
            clearTimeout(timeout);
            testSocket.disconnect();
            resolve(true);
        });
        
        testSocket.on('connect_error', (error) => {
            console.error('❌ Socket.IO test failed:', error);
            console.error('Socket.IO URL attempted:', SOCKET_IO_URL);
            console.error('Error details:', error.message);
            clearTimeout(timeout);
            resolve(false);
        });
        
        testSocket.on('disconnect', () => {
            console.log('Socket.IO test disconnected');
        });
    });
}

// Socket.IO signaling functions
async function initializeSocketIOSignaling() {
    if (!currentRoom) return;
    
    try {
        // Test Socket.IO connection first
        const socketIOAvailable = await testSocketIOConnection();
        
        if (!socketIOAvailable) {
            console.log('Socket.IO not available, using localStorage fallback');
            updateConnectionStatus('Socket.IO unavailable - using localStorage');
            useWebSocket = false;
            initializeLocalStorageSignaling();
            
            // Connection failed, using localStorage fallback
            return;
        }
        
        // Generate unique user ID
        currentUserId = generateUserId();
        
        // Connect to Socket.IO server
        console.log('Connecting to Socket.IO:', SOCKET_IO_URL);
        socket = io(SOCKET_IO_URL);
        
        socket.on('connect', () => {
            console.log('Socket.IO connected successfully');
            console.log('Socket.IO URL:', SOCKET_IO_URL);
            updateConnectionStatus('Connected to signaling server');
            
            // Join the room
            socket.emit('join-room', {
                roomId: currentRoom.id,
                userId: currentUserId
            });
        });
        
        socket.on('user-id', (data) => {
            console.log('Received user ID:', data.userId);
            currentUserId = data.userId;
        });
        
        socket.on('user-joined', (data) => {
            console.log('User joined:', data.userId);
            updateConnectionStatus('User joined! Initiating connection...');
            setTimeout(() => {
                initiateConnection();
            }, 1000);
        });
        
        socket.on('user-left', (data) => {
            console.log('User left:', data.userId);
            updateConnectionStatus('User left the room');
        });
        
        socket.on('signaling-message', (data) => {
            console.log('Received signaling message:', data);
            handleSocketIOMessage(data);
        });
        
        socket.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            updateConnectionStatus('Signaling server disconnected');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            updateConnectionStatus('Signaling server error - falling back to localStorage');
            useWebSocket = false;
            initializeLocalStorageSignaling();
        });
        
        useWebSocket = true;
        
    } catch (error) {
        console.error('Failed to initialize Socket.IO:', error);
        updateConnectionStatus('Socket.IO failed - using localStorage');
        useWebSocket = false;
        initializeLocalStorageSignaling();
    }
}

function handleSocketIOMessage(data) {
    const { type, payload, from } = data;
    
    switch (type) {
        case 'offer':
            handleOffer(payload);
            break;
        case 'answer':
            handleAnswer(payload);
            break;
        case 'ice-candidate':
            handleIceCandidate(payload);
            break;
        case 'user-joined':
            handleUserJoined(payload);
            break;
    }
}

function sendWebSocketMessage(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        console.log('Sent WebSocket message:', message);
    } else {
        console.error('WebSocket not connected');
    }
}

// Simplified signaling functions (localStorage fallback)
function initializeLocalStorageSignaling() {
    if (!currentRoom) return;
    
    // Generate unique user ID
    const userId = generateUserId();
    localStorage.setItem('currentUserId', userId);
    localStorage.setItem('currentRoomId', currentRoom.id);
    
    console.log('Initialized localStorage signaling for user:', userId, 'in room:', currentRoom.id);
    
    // Start polling for signaling messages
    startSignalingPolling();
}

function initializeSignaling() {
    // Try Socket.IO first, fallback to localStorage
    initializeSocketIOSignaling();
}

function generateUserId() {
    return 'user_' + Math.random().toString(36).substring(2, 15);
}

function startSignalingPolling() {
    if (signalingInterval) {
        clearInterval(signalingInterval);
    }
    
    signalingInterval = setInterval(() => {
        checkForSignalingMessages();
    }, SIGNALING_INTERVAL);
}

function checkForSignalingMessages() {
    if (!currentRoom) return;
    
    const signals = JSON.parse(localStorage.getItem(`signals_${currentRoom.id}`) || '[]');
    const currentUserId = localStorage.getItem('currentUserId');
    
    // Process new signals
    signals.forEach(signal => {
        if (signal.from !== currentUserId && !signal.processed) {
            handleSignalingMessage(signal);
            signal.processed = true;
        }
    });
    
    // Clean up old signals (older than 30 seconds)
    const recentSignals = signals.filter(signal => 
        (Date.now() - signal.timestamp) < 30000
    );
    
    localStorage.setItem(`signals_${currentRoom.id}`, JSON.stringify(recentSignals));
}

function sendSignalingMessage(message) {
    if (!currentRoom) return;
    
    if (useWebSocket && socket && socket.connected) {
        // Use Socket.IO signaling
        console.log('📡 Sending via Socket.IO:', message.type);
        socket.emit('signaling-message', {
            type: message.type,
            payload: message.data
        });
    } else {
        // Use localStorage signaling (fallback) - but this won't work cross-device
        console.log('⚠️ Socket.IO not available, using localStorage (limited to same device)');
        const signals = JSON.parse(localStorage.getItem(`signals_${currentRoom.id}`) || '[]');
        const userId = localStorage.getItem('currentUserId') || currentUserId;
        
        const newSignal = {
            ...message,
            from: userId,
            timestamp: Date.now(),
            processed: false,
            roomId: currentRoom.id
        };
        
        signals.push(newSignal);
        localStorage.setItem(`signals_${currentRoom.id}`, JSON.stringify(signals));
        
        console.log('📝 Sent localStorage signal:', newSignal);
        
        // Also try to broadcast to other tabs/windows
        try {
            window.postMessage({
                type: 'localChatSignal',
                signal: newSignal
            }, '*');
        } catch (e) {
            console.log('Could not broadcast to other tabs:', e);
        }
        
        // Show warning to user
        updateConnectionStatus('⚠️ Socket.IO unavailable - connection limited to same device');
    }
}

function handleSignalingMessage(signal) {
    console.log('Received signaling message:', signal);
    
    switch (signal.type) {
        case 'offer':
            handleOffer(signal.data);
            break;
        case 'answer':
            handleAnswer(signal.data);
            break;
        case 'ice-candidate':
            handleIceCandidate(signal.data);
            break;
        case 'user-joined':
            handleUserJoined(signal.data);
            break;
    }
}

// Video chat functionality
async function startVideoChat() {
    try {
        showScreen('video-chat-screen');
        updateConnectionStatus('Initializing video chat...');
        
        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        // Display local video
        const localVideo = document.getElementById('local-video');
        localVideo.srcObject = localStream;
        
        // Ensure local video plays
        localVideo.onloadedmetadata = () => {
            console.log('Local video metadata loaded');
            localVideo.play().catch(e => {
                console.error('Error playing local video:', e);
                // Try to play again after a short delay
                setTimeout(() => {
                    localVideo.play().catch(e2 => console.error('Retry failed:', e2));
                }, 100);
            });
        };
        
        // Fallback: try to play after a short delay
        setTimeout(() => {
            if (localVideo.paused) {
                localVideo.play().catch(e => console.error('Fallback play failed:', e));
            }
        }, 500);
        
        // Initialize signaling
        initializeSignaling();
        
        // Initialize peer connection
        await initializePeerConnection();
        
        updateConnectionStatus('Waiting for another user to join...');
        
        // Debug functionality removed for public deployment
        
        // Notify other users that this user joined
        sendSignalingMessage({
            type: 'user-joined',
            data: { roomId: currentRoom.id }
        });
        
        // Check if there are already users in the room and try to connect
        setTimeout(() => {
            checkForExistingUsers();
        }, 2000);
        
    } catch (error) {
        console.error('Error starting video chat:', error);
        alert('Error accessing camera/microphone. Please check permissions.');
        showScreen('welcome-screen');
    }
}

async function initializePeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Add local stream to peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
    
        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote stream:', event.streams[0]);
            console.log('Remote stream tracks:', event.streams[0].getTracks());
            
            remoteStream = event.streams[0];
            const remoteVideo = document.getElementById('remote-video');
            remoteVideo.srcObject = remoteStream;
            
            // Ensure audio is enabled for remote video
            remoteVideo.muted = false;
        
        // Force video to play
        remoteVideo.onloadedmetadata = () => {
            console.log('Remote video metadata loaded, attempting to play...');
            remoteVideo.play().then(() => {
                console.log('Remote video playing successfully');
                updateConnectionStatus('Connected! Remote video active.');
            }).catch(e => {
                console.error('Error playing remote video:', e);
                // Try multiple fallback attempts
                setTimeout(() => {
                    remoteVideo.play().catch(e2 => {
                        console.error('Retry 1 failed:', e2);
                        setTimeout(() => {
                            remoteVideo.play().catch(e3 => {
                                console.error('Retry 2 failed:', e3);
                                // Last attempt with muted
                                remoteVideo.muted = true;
                                remoteVideo.play().catch(e4 => console.error('Final retry failed:', e4));
                            });
                        }, 500);
                    });
                }, 200);
            });
        };
        
        // Multiple fallback attempts
        setTimeout(() => {
            if (remoteVideo.paused) {
                console.log('Remote video still paused, attempting fallback play...');
                remoteVideo.play().catch(e => console.error('Fallback play failed:', e));
            }
        }, 1000);
        
        setTimeout(() => {
            if (remoteVideo.paused) {
                console.log('Remote video still paused, attempting muted play...');
                remoteVideo.muted = true;
                remoteVideo.play().catch(e => console.error('Muted fallback failed:', e));
            }
        }, 2000);
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // Send ICE candidate to other users
            sendSignalingMessage({
                type: 'ice-candidate',
                data: event.candidate
            });
        }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        switch (peerConnection.connectionState) {
            case 'connected':
                updateConnectionStatus('Connected! Video should be visible now.');
                break;
            case 'connecting':
                updateConnectionStatus('Connecting...');
                break;
            case 'disconnected':
                updateConnectionStatus('Connection lost');
                break;
            case 'failed':
                updateConnectionStatus('Connection failed - trying to reconnect...');
                // Try to reconnect
                setTimeout(() => {
                    if (peerConnection && peerConnection.connectionState === 'failed') {
                        initiateConnection();
                    }
                }, 3000);
                break;
            case 'closed':
                updateConnectionStatus('Connection closed');
                break;
        }
    };
    
    // Handle ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
        switch (peerConnection.iceConnectionState) {
            case 'connected':
            case 'completed':
                updateConnectionStatus('ICE connection established!');
                break;
            case 'connecting':
                updateConnectionStatus('ICE connecting...');
                break;
            case 'failed':
                updateConnectionStatus('ICE connection failed');
                break;
            case 'disconnected':
                updateConnectionStatus('ICE disconnected');
                break;
        }
    };
}

// Signaling message handlers
async function handleOffer(offer) {
    if (!peerConnection) {
        console.log('No peer connection available for offer');
        return;
    }
    
    try {
        console.log('Handling offer:', offer);
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Send answer back
        sendSignalingMessage({
            type: 'answer',
            data: answer
        });
        
        console.log('Answer sent:', answer);
        updateConnectionStatus('Answer sent, establishing connection...');
    } catch (error) {
        console.error('Error handling offer:', error);
        updateConnectionStatus('Error handling connection offer');
    }
}

async function handleAnswer(answer) {
    if (!peerConnection) {
        console.log('No peer connection available for answer');
        return;
    }
    
    try {
        console.log('Handling answer:', answer);
        await peerConnection.setRemoteDescription(answer);
        updateConnectionStatus('Answer received, finalizing connection...');
    } catch (error) {
        console.error('Error handling answer:', error);
        updateConnectionStatus('Error handling connection answer');
    }
}

async function handleIceCandidate(candidate) {
    if (!peerConnection) return;
    
    try {
        await peerConnection.addIceCandidate(candidate);
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

function handleUserJoined(data) {
    console.log('User joined room:', data);
    updateConnectionStatus('User joined! Initiating connection...');
    
    // Try to initiate connection when someone joins
    setTimeout(() => {
        initiateConnection();
    }, 2000);
}

function checkForExistingUsers() {
    // Check if there are other users already in the room
    const signals = JSON.parse(localStorage.getItem(`signals_${currentRoom.id}`) || '[]');
    const currentUserId = localStorage.getItem('currentUserId');
    
    const otherUsers = signals.filter(signal => 
        signal.type === 'user-joined' && 
        signal.from !== currentUserId &&
        (Date.now() - signal.timestamp) < 15000 // Within last 15 seconds
    );
    
    if (otherUsers.length > 0) {
        updateConnectionStatus('Found existing users! Connecting...');
        setTimeout(() => {
            initiateConnection();
        }, 1000);
    }
}

async function initiateConnection() {
    if (!peerConnection) {
        console.log('No peer connection available');
        return;
    }
    
    try {
        console.log('Initiating connection...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send offer to other users
        sendSignalingMessage({
            type: 'offer',
            data: offer
        });
        
        updateConnectionStatus('Connection initiated...');
        console.log('Offer sent:', offer);
    } catch (error) {
        console.error('Error initiating connection:', error);
        updateConnectionStatus('Connection failed to initiate');
    }
}

// Global variable for signaling interval
let signalingInterval = null;

// Control functions
function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            isMuted = !audioTrack.enabled;
            
            const muteBtn = document.getElementById('mute-btn');
            if (isMuted) {
                muteBtn.classList.add('muted');
                muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            } else {
                muteBtn.classList.remove('muted');
                muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            isVideoOff = !videoTrack.enabled;
            
            const videoBtn = document.getElementById('video-btn');
            if (isVideoOff) {
                videoBtn.classList.add('video-off');
                videoBtn.innerHTML = '<i class="fas fa-video-slash"></i>';
            } else {
                videoBtn.classList.remove('video-off');
                videoBtn.innerHTML = '<i class="fas fa-video"></i>';
            }
        }
    }
}

function endCall() {
    // Stop signaling
    if (signalingInterval) {
        clearInterval(signalingInterval);
        signalingInterval = null;
    }
    
    // Close WebSocket connection
    if (socket) {
        socket.close();
        socket = null;
    }
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Close peer connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Clear video elements
    document.getElementById('local-video').srcObject = null;
    document.getElementById('remote-video').srcObject = null;
    
    // Clean up signaling data
    if (currentRoom) {
        const signals = JSON.parse(localStorage.getItem(`signals_${currentRoom.id}`) || '[]');
        const currentUserId = localStorage.getItem('currentUserId');
        
        // Remove signals from this user
        const updatedSignals = signals.filter(signal => signal.from !== currentUserId);
        localStorage.setItem(`signals_${currentRoom.id}`, JSON.stringify(updatedSignals));
        
        // Remove room from localStorage if it was created by this user
        if (currentRoom && currentRoom.allowDiscovery) {
            const rooms = JSON.parse(localStorage.getItem('localChatRooms') || '[]');
            const updatedRooms = rooms.filter(room => room.id !== currentRoom.id);
            localStorage.setItem('localChatRooms', JSON.stringify(updatedRooms));
        }
    }
    
    // Reset state
    currentRoom = null;
    isInitiator = false;
    roomParticipants.clear();
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('currentRoomId');
    
    showScreen('welcome-screen');
    
    // Refresh nearby rooms
    setTimeout(() => {
        refreshNearbyRooms();
    }, 500);
}

function updateConnectionStatus(message) {
    document.getElementById('connection-status').textContent = message;
    console.log('Connection status:', message);
}



// Debug functions removed for cleaner public interface

// Clean up old rooms and refresh nearby rooms periodically
setInterval(() => {
    const currentTime = Date.now();
    
    // Clean up local rooms
    const rooms = JSON.parse(localStorage.getItem('localChatRooms') || '[]');
    const activeRooms = rooms.filter(room => (currentTime - room.createdAt) < 3600000);
    localStorage.setItem('localChatRooms', JSON.stringify(activeRooms));
    
    // Clean up old signaling data
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith('signals_')) {
            const signals = JSON.parse(localStorage.getItem(key) || '[]');
            const recentSignals = signals.filter(signal => (currentTime - signal.timestamp) < 300000); // 5 minutes
            localStorage.setItem(key, JSON.stringify(recentSignals));
        }
    });
    
    // Refresh nearby rooms every 30 seconds
    refreshNearbyRooms();
}, ROOM_CLEANUP_INTERVAL);

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && currentRoom) {
        // Page is hidden, but keep the connection alive
        console.log('Page hidden, maintaining connection...');
    } else if (!document.hidden && currentRoom) {
        // Page is visible again
        console.log('Page visible, connection active');
    }
});

// Handle beforeunload to clean up
window.addEventListener('beforeunload', () => {
    if (currentRoom) {
        endCall();
    }
});
