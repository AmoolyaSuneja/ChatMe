// Test script to verify deployment
const http = require('http');

function testServer(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url + '/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve({ success: true, data: result });
                } catch (e) {
                    resolve({ success: false, error: 'Invalid JSON response' });
                }
            });
        });
        
        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ success: false, error: 'Timeout' });
        });
    });
}

async function main() {
    const urls = [
        'http://localhost:8080',
        // Add your Railway URL here when you get it
        // 'https://your-app-name.up.railway.app'
    ];
    
    console.log('Testing server endpoints...\n');
    
    for (const url of urls) {
        console.log(`Testing: ${url}`);
        const result = await testServer(url);
        
        if (result.success) {
            console.log('✅ Server is running!');
            console.log(`   Status: ${result.data.status}`);
            console.log(`   Rooms: ${result.data.rooms}`);
            console.log(`   Environment: ${result.data.environment}`);
        } else {
            console.log(`❌ Server failed: ${result.error}`);
        }
        console.log('');
    }
}

main().catch(console.error);
