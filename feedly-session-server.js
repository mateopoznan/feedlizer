const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const PORT = 12012;

// System do komunikacji z Feedly przez web scraping/session
class FeedlySession {
    constructor() {
        this.cookies = '';
        this.csrfToken = '';
        this.userId = '';
        this.isLoggedIn = false;
    }

    // Logowanie do Feedly
    async login(email, password) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('🔐 Attempting to login to Feedly...');
                
                // Krok 1: Pobierz stronę logowania
                console.log('📥 Getting login page...');
                const loginPageResponse = await this.makeRequest('https://feedly.com/i/login', 'GET');
                
                // Wyciągnij CSRF token i inne potrzebne dane
                const csrfMatch = loginPageResponse.match(/name=["\']_token["\'] value=["\']([^"\']+)["\']/) ||
                               loginPageResponse.match(/csrf["\']?\s*:\s*["\']([^"\']+)["\']/) ||
                               loginPageResponse.match(/token["\']?\s*:\s*["\']([^"\']+)["\']/);
                
                if (csrfMatch) {
                    this.csrfToken = csrfMatch[1];
                    console.log('🔑 Found CSRF token');
                }

                // Krok 2: Spróbuj różnych endpointów logowania
                const loginEndpoints = [
                    'https://feedly.com/v3/auth/login',
                    'https://feedly.com/i/login',
                    'https://cloud.feedly.com/v3/auth/login',
                    'https://feedly.com/login'
                ];

                let loginSuccess = false;
                let lastError = null;

                for (const endpoint of loginEndpoints) {
                    try {
                        console.log(`🔄 Trying login endpoint: ${endpoint}`);
                        
                        // Przygotuj dane logowania w różnych formatach
                        const loginDataFormats = [
                            // Format 1: JSON
                            {
                                data: JSON.stringify({
                                    email: email,
                                    password: password,
                                    _token: this.csrfToken
                                }),
                                headers: { 'Content-Type': 'application/json' }
                            },
                            // Format 2: Form data
                            {
                                data: querystring.stringify({
                                    email: email,
                                    password: password,
                                    _token: this.csrfToken || '',
                                    remember: '1'
                                }),
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                            }
                        ];

                        for (const format of loginDataFormats) {
                            try {
                                const loginResponse = await this.makeRequest(endpoint, 'POST', format.data, {
                                    ...format.headers,
                                    'Content-Length': format.data.length,
                                    'X-Requested-With': 'XMLHttpRequest',
                                    'Referer': 'https://feedly.com/i/login'
                                });

                                // Sprawdź czy logowanie się udało
                                if (this.checkLoginSuccess(loginResponse)) {
                                    loginSuccess = true;
                                    console.log('✅ Successfully logged in to Feedly');
                                    
                                    // Pobierz user ID z odpowiedzi lub cookies
                                    this.extractUserInfo(loginResponse);
                                    this.isLoggedIn = true;
                                    resolve(true);
                                    return;
                                }
                            } catch (formatError) {
                                lastError = formatError;
                                console.log(`❌ Format failed: ${formatError.message}`);
                            }
                        }
                    } catch (endpointError) {
                        lastError = endpointError;
                        console.log(`❌ Endpoint failed: ${endpointError.message}`);
                    }
                }

                if (!loginSuccess) {
                    throw new Error(`All login attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
                }
                
            } catch (error) {
                console.error('❌ Login failed:', error.message);
                reject(error);
            }
        });
    }

    // Sprawdź czy logowanie się udało
    checkLoginSuccess(response) {
        // Różne wskaźniki sukcesu logowania
        const successIndicators = [
            'dashboard',
            'stream',
            'user/profile',
            'subscriptions',
            '"success":true',
            '"authenticated":true',
            'cloud.feedly.com',
            'global.all'
        ];

        const errorIndicators = [
            'error',
            'invalid',
            'wrong',
            'incorrect',
            'failed',
            'errorCode'
        ];

        const responseText = response.toLowerCase();
        
        // Sprawdź błędy
        for (const error of errorIndicators) {
            if (responseText.includes(error)) {
                return false;
            }
        }
        
        // Sprawdź wskaźniki sukcesu
        for (const indicator of successIndicators) {
            if (responseText.includes(indicator)) {
                return true;
            }
        }
        
        // Sprawdź czy dostaliśmy redirect do dashboard
        return response.includes('location.href') || response.includes('window.location');
    }

    // Wyciągnij informacje o użytkowniku
    extractUserInfo(response) {
        // Spróbuj wyciągnąć user ID
        const userIdPatterns = [
            /user[\/\\]([a-f0-9-]{8,})/i,
            /"userId":\s*"([^"]+)"/i,
            /"id":\s*"([^"]+)"/i,
            /profile[\/\\]([a-f0-9-]{8,})/i
        ];

        for (const pattern of userIdPatterns) {
            const match = response.match(pattern);
            if (match && match[1]) {
                this.userId = match[1];
                console.log(`👤 Found user ID: ${this.userId}`);
                break;
            }
        }
    }

    // Pobierz strumień artykułów
    async getStream(streamUrl = 'user/global.all', count = 50, unreadOnly = true) {
        if (!this.isLoggedIn) {
            throw new Error('Not logged in to Feedly');
        }

        return new Promise(async (resolve, reject) => {
            try {
                let apiUrl = `https://cloud.feedly.com/v3/streams/contents?streamId=${encodeURIComponent(streamUrl)}&count=${count}`;
                if (unreadOnly) {
                    apiUrl += '&unreadOnly=true';
                }

                console.log(`📥 Fetching stream: ${streamUrl}`);
                const response = await this.makeRequest(apiUrl, 'GET');
                
                try {
                    const data = JSON.parse(response);
                    console.log(`✅ Fetched ${data.items ? data.items.length : 0} articles`);
                    resolve(data);
                } catch (parseError) {
                    // Jeśli to nie JSON, może to być błąd autoryzacji
                    if (response.includes('login')) {
                        throw new Error('Session expired - need to login again');
                    }
                    throw new Error('Invalid response format');
                }
                
            } catch (error) {
                console.error('❌ Error fetching stream:', error.message);
                reject(error);
            }
        });
    }

    // Oznacz artykuł jako przeczytany
    async markAsRead(articleIds) {
        if (!this.isLoggedIn) {
            throw new Error('Not logged in to Feedly');
        }

        return new Promise(async (resolve, reject) => {
            try {
                const postData = JSON.stringify({
                    action: 'markAsRead',
                    type: 'entries',
                    entryIds: Array.isArray(articleIds) ? articleIds : [articleIds]
                });

                const response = await this.makeRequest('https://cloud.feedly.com/v3/markers', 'POST', postData, {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length
                });

                console.log(`📖 Marked ${Array.isArray(articleIds) ? articleIds.length : 1} articles as read`);
                resolve(true);
                
            } catch (error) {
                console.error('❌ Error marking as read:', error.message);
                reject(error);
            }
        });
    }

    // Zapisz do "Read Later" (Feedly's saved)
    async saveForLater(articleId, articleUrl, title) {
        if (!this.isLoggedIn) {
            throw new Error('Not logged in to Feedly');
        }

        return new Promise(async (resolve, reject) => {
            try {
                const postData = JSON.stringify({
                    entryId: articleId
                });

                const response = await this.makeRequest(`https://cloud.feedly.com/v3/tags/user%2F${this.userId}%2Ftag%2Fglobal.saved/`, 'PUT', postData, {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length
                });

                console.log(`📚 Saved article: ${title}`);
                resolve(true);
                
            } catch (error) {
                console.error('❌ Error saving article:', error.message);
                reject(error);
            }
        });
    }

    // Pomocnicza funkcja do HTTP requestów
    makeRequest(requestUrl, method = 'GET', postData = null, additionalHeaders = {}) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(requestUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const client = isHttps ? https : http;

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: method,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'application/json, text/html, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Cookie': this.cookies,
                    ...additionalHeaders
                }
            };

            const req = client.request(options, (res) => {
                // Zbierz cookies z odpowiedzi
                if (res.headers['set-cookie']) {
                    const newCookies = res.headers['set-cookie'].map(cookie => cookie.split(';')[0]).join('; ');
                    this.cookies = this.mergeCookies(this.cookies, newCookies);
                }

                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        // Follow redirects
                        this.makeRequest(res.headers.location, method, postData, additionalHeaders)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', reject);

            if (postData) {
                req.write(postData);
            }

            req.end();
        });
    }

    // Pomocnicza funkcja do mergowania cookies
    mergeCookies(existing, newCookies) {
        if (!existing) return newCookies;
        if (!newCookies) return existing;
        
        const existingMap = {};
        existing.split('; ').forEach(cookie => {
            const [key, value] = cookie.split('=');
            if (key) existingMap[key] = value;
        });
        
        newCookies.split('; ').forEach(cookie => {
            const [key, value] = cookie.split('=');
            if (key) existingMap[key] = value;
        });
        
        return Object.entries(existingMap).map(([key, value]) => `${key}=${value}`).join('; ');
    }
}

// Instance Feedly session
const feedlySession = new FeedlySession();
let cachedArticles = [];
let lastFetchTime = 0;

// Załaduj credentials
let feedlyCredentials = null;
if (fs.existsSync('feedly-credentials.json')) {
    try {
        feedlyCredentials = JSON.parse(fs.readFileSync('feedly-credentials.json', 'utf8'));
    } catch (error) {
        console.log('Could not load Feedly credentials');
    }
}

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
    if (pathname === '/api/feedly/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { email, password } = JSON.parse(body);
                await feedlySession.login(email, password);
                
                // Zapisz credentials (opcjonalnie)
                fs.writeFileSync('feedly-credentials.json', JSON.stringify({ email, password }, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Logged in successfully' }));
            } catch (error) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // API Routes
    if (pathname === '/api/feedly/stream') {
        try {
            // Auto-login jeśli mamy credentials
            if (!feedlySession.isLoggedIn && feedlyCredentials) {
                console.log('🔄 Auto-logging in...');
                await feedlySession.login(feedlyCredentials.email, feedlyCredentials.password);
            }

            if (!feedlySession.isLoggedIn) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Not logged in. Please login first.',
                    needLogin: true 
                }));
                return;
            }

            // Cache na 2 minuty
            if (Date.now() - lastFetchTime > 2 * 60 * 1000 || cachedArticles.length === 0) {
                console.log('🔄 Fetching fresh articles from Feedly...');
                
                const streamData = await feedlySession.getStream('user/global.all', 50, true);
                cachedArticles = streamData.items || [];
                
                // Sortuj od najnowszego
                cachedArticles.sort((a, b) => new Date(b.published) - new Date(a.published));
                
                lastFetchTime = Date.now();
                console.log(`✅ Loaded ${cachedArticles.length} articles from Feedly`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ items: cachedArticles }));
        } catch (error) {
            console.error('Error fetching Feedly stream:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (pathname.startsWith('/api/feedly/mark-read/')) {
        try {
            const articleId = decodeURIComponent(pathname.split('/').pop());
            await feedlySession.markAsRead(articleId);
            
            // Usuń z cache
            cachedArticles = cachedArticles.filter(article => article.id !== articleId);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Article marked as read' }));
        } catch (error) {
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
                    const data = JSON.parse(body);
                    // Zapisz do Feedly "Read Later" zamiast Instapaper
                    await feedlySession.saveForLater(data.id, data.url, data.title);
                    
                    // Usuń z cache po zapisaniu
                    cachedArticles = cachedArticles.filter(article => article.id !== data.id);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Article saved to Feedly Read Later' }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
        }
        return;
    }

    // Static file serving
    let filePath = pathname === '/' ? '/public/index.html' : `/public${pathname}`;
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
    console.log(`🚀 Feedly Tinder Server running on http://localhost:${PORT}`);
    console.log(`📱 Open in browser to start swiping articles!`);
    console.log(`🌐 Available at: feedly.mateopoznan.pl (with Caddy proxy)`);
    console.log('');
    if (feedlyCredentials) {
        console.log('✅ Feedly credentials loaded - will auto-login');
    } else {
        console.log('🔐 No credentials found - you will need to login first');
        console.log('💡 Create feedly-credentials.json with your email/password');
    }
});
