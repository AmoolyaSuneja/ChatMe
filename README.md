# LocalChat - Video Chat with Nearby Users

A modern web application that allows users to create video chat rooms and connect with people in their local area. No registration required, no data stored, and completely privacy-focused.

## Features

- 🎥 **Real-time Video Chat** - High-quality WebRTC video and audio
- 📍 **Location-based Discovery** - Find and join rooms created by nearby users
- 🔒 **Privacy First** - No data is stored or saved anywhere
- 🚀 **Easy to Use** - Just create a room or join with a code
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🎛️ **Full Controls** - Mute, video toggle, and call management

## How to Use

### Getting Started

1. Open `index.html` in a modern web browser
2. Allow location access when prompted (optional but recommended)
3. Choose to either create a new room or join an existing one

### Creating a Room

1. Click "Create Room"
2. Enter a room name
3. Set the discovery radius (1-25 km)
4. Choose whether to allow nearby users to discover your room
5. Click "Start Room" to begin

### Joining a Room

**Method 1: Join by Code**
1. Click "Join Room"
2. Enter the room code provided by the room creator
3. Click "Join Room"

**Method 2: Join Nearby Room**
1. If location is enabled, nearby rooms will appear automatically
2. Click "Join" next to any room you want to join

### During Video Chat

- **Mute/Unmute**: Click the microphone button
- **Turn Video On/Off**: Click the video camera button
- **End Call**: Click the red phone button
- **Room Code**: Share the room code with others to let them join

## Technical Details

### Technologies Used

- **HTML5** - Structure and semantic markup
- **CSS3** - Modern styling with gradients and animations
- **JavaScript (ES6+)** - Core functionality and WebRTC
- **WebRTC** - Real-time video and audio communication
- **Geolocation API** - Location-based room discovery
- **LocalStorage** - Temporary room registry (cleared automatically)

### Browser Requirements

- Modern browser with WebRTC support
- HTTPS connection (required for camera/microphone access)
- JavaScript enabled

### Privacy & Security

- **No Server Required** - Everything runs in the browser
- **No Data Storage** - Rooms are temporary and auto-delete after 1 hour
- **No Registration** - No accounts or personal information required
- **Local Only** - Room discovery uses browser's localStorage
- **Secure** - Uses WebRTC's built-in encryption

## File Structure

```
LocalChat/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript functionality
└── README.md           # This file
```

## Setup Instructions

1. Download all files to a folder
2. Open `index.html` in a web browser
3. For best experience, serve via HTTPS (required for camera access)

### Local HTTPS Server (Optional)

If you need to serve over HTTPS locally:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (if you have it installed)
npx serve -s . -l 8000
```

## Features Explained

### Room Discovery
- Rooms are discovered based on GPS location
- Users can set discovery radius from 1-25 km
- Rooms automatically expire after 1 hour
- No personal information is shared

### Video Chat
- Uses WebRTC for peer-to-peer connection
- Supports multiple video/audio codecs
- Automatic fallback for network issues
- Real-time connection status updates

### Privacy Features
- No server-side storage
- No user accounts or registration
- Temporary room data only
- Automatic cleanup of old rooms

## Troubleshooting

### Camera/Microphone Not Working
- Ensure you're using HTTPS
- Check browser permissions
- Try refreshing the page
- Use a modern browser (Chrome, Firefox, Safari, Edge)

### Location Not Working
- Allow location access in browser
- Check if location services are enabled
- You can still join rooms with codes without location

### Connection Issues
- Check your internet connection
- Try refreshing the page
- Ensure both users have stable connections

## Browser Compatibility

- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 11+
- ✅ Edge 79+

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to fork this project and submit pull requests for improvements!

---

**Note**: This is a demo application. For production use, consider implementing a proper signaling server for better reliability and scalability.
