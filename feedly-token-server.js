const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = 12012;

// Simple authentication system
let authConfig = {};
try {
    authConfig = JSON.parse(fs.readFileSync('auth.json', 'utf8'));
} catch (error) {
    console.log('⚠️ No auth.json found, authentication disabled');
}

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
let activeSessions = new Map();

// Authentication helper functions
function generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
}

function isAuthenticated(req) {
    if (!authConfig.password) return true; // No auth configured
    
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = cookies.feedlizer_session;
    
    if (!sessionId || !activeSessions.has(sessionId)) {
        return false;
    }
    
    const session = activeSessions.get(sessionId);
    if (Date.now() - session.created > SESSION_TIMEOUT) {
        activeSessions.delete(sessionId);
        return false;
    }
    
    return true;
}

function parseCookies(cookieHeader) {
    const cookies = {};
    cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) cookies[name] = value;
    });
    return cookies;
}

// Klasa do komunikacji z Feedly API używając tokenu
class FeedlyAPI {
    constructor(token) {
        this.token = token;
        this.userId = null;
    }

    // Pobierz profil użytkownika (żeby dostać userId)
    async getProfile() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'cloud.feedly.com',
                path: '/v3/profile',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'FeedlyTinder/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const profile = JSON.parse(data);
                            this.userId = profile.id;
                            console.log(`👤 Logged in as: ${profile.fullName || profile.email}`);
                            console.log(`🆔 User ID: ${this.userId}`);
                            resolve(profile);
                        } catch (error) {
                            reject(new Error('Invalid profile response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }

    // Pobierz strumień artykułów
    async getStream(streamId = null, count = 200, unreadOnly = true) {
        return new Promise((resolve, reject) => {
            // Jeśli nie podano streamId, użyj globalnego
            const finalStreamId = streamId || `user/${this.userId}/category/global.all`;
            
            let apiPath = `/v3/streams/contents?streamId=${encodeURIComponent(finalStreamId)}&count=${count}`;
            if (unreadOnly) {
                apiPath += '&unreadOnly=true';
            }

            console.log(`📥 Fetching ${count} articles from stream: ${finalStreamId}`);

            const options = {
                hostname: 'cloud.feedly.com',
                path: apiPath,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'FeedlyTinder/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const streamData = JSON.parse(data);
                            console.log(`✅ Fetched ${streamData.items ? streamData.items.length : 0} articles`);
                            resolve(streamData);
                        } catch (error) {
                            reject(new Error('Invalid stream response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }

    // Oznacz artykuły jako przeczytane
    async markAsRead(entryIds) {
        return new Promise((resolve, reject) => {
            const entries = Array.isArray(entryIds) ? entryIds : [entryIds];
            
            const postData = JSON.stringify({
                action: 'markAsRead',
                type: 'entries',
                entryIds: entries
            });

            console.log(`📖 Marking ${entries.length} article(s) as read`);

            const options = {
                hostname: 'cloud.feedly.com',
                path: '/v3/markers',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length,
                    'User-Agent': 'FeedlyTinder/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Successfully marked ${entries.length} article(s) as read`);
                        resolve(true);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    // Zapisz artykuł do "Saved for Later"
    async saveForLater(entryId) {
        return new Promise((resolve, reject) => {
            const tagId = `user/${this.userId}/tag/global.saved`;
            
            const postData = JSON.stringify({
                entryId: entryId
            });

            console.log(`📚 Saving article to "Read Later"`);

            const options = {
                hostname: 'cloud.feedly.com',
                path: `/v3/tags/${encodeURIComponent(tagId)}`,
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length,
                    'User-Agent': 'FeedlyTinder/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Successfully saved article`);
                        resolve(true);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    // Pobierz subskrypcje użytkownika
    async getSubscriptions() {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'cloud.feedly.com',
                path: '/v3/subscriptions',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'User-Agent': 'FeedlyTinder/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const subscriptions = JSON.parse(data);
                            console.log(`📡 Found ${subscriptions.length} subscriptions`);
                            resolve(subscriptions);
                        } catch (error) {
                            reject(new Error('Invalid subscriptions response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }
}

// Załaduj token z pliku konfiguracyjnego
let feedlyToken = null;
if (fs.existsSync('feedly-config.json')) {
    try {
        const config = JSON.parse(fs.readFileSync('feedly-config.json', 'utf8'));
        feedlyToken = config.token || config.feedlyToken;
    } catch (error) {
        console.log('Could not load Feedly config');
    }
}

// Jeśli nie ma tokenu w pliku, pokaż błąd
if (!feedlyToken) {
    console.error('❌ Brak tokenu Feedly! Dodaj token do pliku feedly-config.json');
    console.error('Przykład pliku feedly-config.json:');
    console.error(JSON.stringify({ "token": "YOUR_FEEDLY_TOKEN_HERE" }, null, 2));
    process.exit(1);
}

const feedlyAPI = new FeedlyAPI(feedlyToken);
let cachedArticles = [];
let lastFetchTime = 0;
let isInitialized = false;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon'
};

// Inicjalizacja - pobierz profil użytkownika
async function initialize() {
    if (isInitialized) return;
    
    try {
        console.log('🔄 Initializing Feedly API...');
        await feedlyAPI.getProfile();
        isInitialized = true;
        console.log('✅ Feedly API initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Feedly API:', error.message);
        throw error;
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Login endpoint
    if (pathname === '/api/login' && req.method === 'POST') {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
            try {
                const loginData = JSON.parse(data);
                if (authConfig.password && loginData.password === authConfig.password) {
                    const sessionId = generateSessionId();
                    activeSessions.set(sessionId, { created: Date.now() });
                    
                    res.setHeader('Set-Cookie', `feedlizer_session=${sessionId}; Path=/; Max-Age=${SESSION_TIMEOUT/1000}; HttpOnly`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid password' }));
                }
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Check authentication for API routes
    if (pathname.startsWith('/api/') && pathname !== '/api/login') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Authentication required', needLogin: true }));
            return;
        }
    }

    // API Routes
    if (pathname === '/api/feedly/stream') {
        try {
            // Upewnij się że API jest zainicjalizowane
            if (!isInitialized) {
                await initialize();
            }

            // Get count parameter from query string (default 200)
            const count = parseInt(parsedUrl.query.count) || 200;

            // Cache na 2 minuty
            if (Date.now() - lastFetchTime > 2 * 60 * 1000 || cachedArticles.length === 0) {
                console.log(`🔄 Fetching fresh articles from Feedly (count: ${count})...`);
                
                const streamData = await feedlyAPI.getStream(null, count);
                cachedArticles = streamData.items || [];
                
                // Sortuj od najnowszego
                cachedArticles.sort((a, b) => new Date(b.published) - new Date(a.published));
                
                lastFetchTime = Date.now();
                console.log(`✅ Cached ${cachedArticles.length} articles`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ items: cachedArticles }));
        } catch (error) {
            console.error('Error fetching Feedly stream:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: error.message,
                help: 'Check your Feedly token in feedly-config.json'
            }));
        }
        return;
    }

    if (pathname.startsWith('/api/feedly/mark-read/')) {
        try {
            if (!isInitialized) {
                await initialize();
            }

            const articleId = decodeURIComponent(pathname.split('/').pop());
            await feedlyAPI.markAsRead(articleId);
            
            // Usuń z cache
            cachedArticles = cachedArticles.filter(article => article.id !== articleId);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Article marked as read in Feedly' }));
        } catch (error) {
            console.error('Error marking as read:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (pathname === '/api/instapaper/add') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    if (!isInitialized) {
                        await initialize();
                    }

                    const data = JSON.parse(body);
                    await feedlyAPI.saveForLater(data.id);
                    
                    // Usuń z cache po zapisaniu
                    cachedArticles = cachedArticles.filter(article => article.id !== data.id);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Article saved to Feedly "Read Later"' }));
                } catch (error) {
                    console.error('Error saving article:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
        }
        return;
    }

    // Endpoint do pobierania subskrypcji (bonus)
    if (pathname === '/api/feedly/subscriptions') {
        try {
            if (!isInitialized) {
                await initialize();
            }

            const subscriptions = await feedlyAPI.getSubscriptions();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ subscriptions }));
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Static file serving
    let filePath = pathname === '/' ? '/public/index.html' : `/public${pathname}`;
    
    // Redirect to login if not authenticated and trying to access main app
    if (pathname === '/' && !isAuthenticated(req)) {
        filePath = '/public/login.html';
    }
    
    filePath = path.join(__dirname, filePath);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 Internal Server Error</h1>');
                return;
            }

            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        });
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Feedly Token-based Tinder Server running on http://localhost:${PORT}`);
    console.log(`📱 Open in browser to start swiping articles!`);
    console.log(`🌐 Available at: feedly.mateopoznan.pl (with Caddy proxy)`);
    console.log('');
    
    if (feedlyToken) {
        console.log('✅ Feedly token configured');
        console.log('🔑 Will authenticate with official Feedly API');
        console.log('📝 Full functionality: read, mark as read, save for later');
        
        // Spróbuj zainicjalizować w tle
        initialize().catch(error => {
            console.error('❌ Token may be invalid:', error.message);
            console.log('💡 Update your token in feedly-config.json');
        });
    } else {
        console.log('🔧 SETUP REQUIRED:');
        console.log('Create feedly-config.json:');
        console.log('{"token": "YOUR_FEEDLY_TOKEN_HERE"}');
    }
});
