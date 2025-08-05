const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { parseString } = require('xml2js');

const PORT = 12012;

// Klasa do zarządzania RSS feeds z Feedly (bez logowania)
class FeedlyRSSManager {
    constructor() {
        this.readArticles = new Set();
        this.savedArticles = new Set();
        this.loadState();
    }
    
    loadState() {
        try {
            if (fs.existsSync('article-state.json')) {
                const data = JSON.parse(fs.readFileSync('article-state.json', 'utf8'));
                this.readArticles = new Set(data.read || []);
                this.savedArticles = new Set(data.saved || []);
            }
        } catch (error) {
            console.log('Could not load article state:', error.message);
        }
    }
    
    saveState() {
        try {
            const data = {
                read: Array.from(this.readArticles),
                saved: Array.from(this.savedArticles)
            };
            fs.writeFileSync('article-state.json', JSON.stringify(data, null, 2));
        } catch (error) {
            console.log('Could not save article state:', error.message);
        }
    }
    
    // Pobierz artykuły z publicznego RSS feed Feedly
    async getFeedlyRSS(userId, feedName = 'global.all') {
        return new Promise((resolve, reject) => {
            if (!userId) {
                reject(new Error('User ID is required. Get it from: https://feedly.com/i/opml'));
                return;
            }
            
            // URL publicznego RSS feeda z Feedly
            const feedUrl = `https://cloud.feedly.com/v3/streams/contents?streamId=user%2F${userId}%2Fcategory%2F${feedName}&count=50&format=rss`;
            
            console.log(`📡 Fetching Feedly RSS: ${feedUrl}`);
            
            https.get(feedUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                        return;
                    }
                    
                    this.parseRSSData(data)
                        .then(resolve)
                        .catch(reject);
                });
            }).on('error', reject);
        });
    }
    
    // Parsuj dane RSS
    async parseRSSData(rssData) {
        return new Promise((resolve, reject) => {
            parseString(rssData, (err, result) => {
                if (err) return reject(err);
                
                const articles = [];
                
                try {
                    if (result.rss && result.rss.channel && result.rss.channel[0].item) {
                        const items = result.rss.channel[0].item;
                        
                        items.forEach(item => {
                            const article = {
                                id: item.guid ? item.guid[0]._ || item.guid[0] : item.link[0],
                                title: item.title[0],
                                summary: this.extractSummary(item.description ? item.description[0] : ''),
                                originUrl: item.link[0],
                                published: new Date(item.pubDate[0]).toISOString(),
                                visual: this.extractImageFromContent(item.description ? item.description[0] : ''),
                                origin: {
                                    title: this.extractSource(item.description ? item.description[0] : item.title[0])
                                }
                            };
                            
                            // Dodaj tylko jeśli nie jest przeczytany
                            if (!this.readArticles.has(article.id)) {
                                articles.push(article);
                            }
                        });
                    }
                    
                    resolve(articles);
                } catch (parseError) {
                    reject(parseError);
                }
            });
        });
    }
    
    // Wyciągnij krótkie streszczenie
    extractSummary(description) {
        if (!description) return '';
        
        // Usuń HTML tags
        let text = description.replace(/<[^>]*>/g, '');
        
        // Wyciągnij główny tekst (często po "-- ")
        const parts = text.split('--');
        if (parts.length > 1) {
            text = parts[1].trim();
        }
        
        // Ogranicz długość
        return text.substring(0, 200) + (text.length > 200 ? '...' : '');
    }
    
    // Wyciągnij źródło
    extractSource(content) {
        // Spróbuj wyciągnąć nazwę źródła z treści
        const sourceMatch = content.match(/--\s*([^<-]+?)(?:\s*<|$)/);
        if (sourceMatch) {
            return sourceMatch[1].trim();
        }
        return 'Feedly';
    }
    
    // Wyciągnij obrazek z contentu
    extractImageFromContent(content) {
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (imgMatch) {
            return { url: imgMatch[1] };
        }
        
        // Fallback do unsplash
        const randomId = Math.floor(Math.random() * 1000);
        return { 
            url: `https://images.unsplash.com/photo-${1461749280684 + randomId}?w=800&h=600&fit=crop` 
        };
    }
    
    markAsRead(articleId) {
        this.readArticles.add(articleId);
        this.saveState();
        console.log(`📖 Marked as read: ${articleId}`);
    }
    
    markAsSaved(articleId) {
        this.savedArticles.add(articleId);
        this.saveState();
        console.log(`📚 Saved article: ${articleId}`);
    }
}

const feedlyManager = new FeedlyRSSManager();
let cachedArticles = [];
let lastFetchTime = 0;

// Załaduj konfigurację
let config = { userId: '' };
if (fs.existsSync('feedly-config.json')) {
    try {
        config = JSON.parse(fs.readFileSync('feedly-config.json', 'utf8'));
    } catch (error) {
        console.log('Could not load Feedly config');
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

    // API Routes
    if (pathname === '/api/feedly/stream') {
        try {
            if (!config.userId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'Brak User ID. Skonfiguruj feedly-config.json z twoim User ID.',
                    help: 'Znajdź User ID na: https://feedly.com/i/opml (w URL: user/TWOJE_ID/...)'
                }));
                return;
            }

            // Cache na 5 minut
            if (Date.now() - lastFetchTime > 5 * 60 * 1000 || cachedArticles.length === 0) {
                console.log('🔄 Fetching fresh articles from Feedly RSS...');
                
                const articles = await feedlyManager.getFeedlyRSS(config.userId);
                
                // Sortuj od najnowszego
                cachedArticles = articles.sort((a, b) => new Date(b.published) - new Date(a.published));
                
                lastFetchTime = Date.now();
                console.log(`✅ Loaded ${cachedArticles.length} unread articles from Feedly`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ items: cachedArticles }));
        } catch (error) {
            console.error('Error fetching Feedly RSS:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: error.message,
                help: error.message.includes('User ID') ? 'Znajdź User ID na: https://feedly.com/i/opml' : ''
            }));
        }
        return;
    }

    if (pathname.startsWith('/api/feedly/mark-read/')) {
        const articleId = decodeURIComponent(pathname.split('/').pop());
        feedlyManager.markAsRead(articleId);
        
        // Usuń z cache
        cachedArticles = cachedArticles.filter(article => article.id !== articleId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Article marked as read locally' }));
        return;
    }

    if (pathname === '/api/instapaper/add') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    feedlyManager.markAsSaved(data.id);
                    
                    // Usuń z cache po zapisaniu
                    cachedArticles = cachedArticles.filter(article => article.id !== data.id);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Article saved locally' }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
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
    console.log(`🚀 Feedly RSS Tinder Server running on http://localhost:${PORT}`);
    console.log(`📱 Open in browser to start swiping articles!`);
    console.log(`🌐 Available at: feedly.mateopoznan.pl (with Caddy proxy)`);
    console.log('');
    
    if (config.userId) {
        console.log(`✅ Feedly User ID configured: ${config.userId}`);
        console.log('📡 Will fetch articles from your Feedly RSS feed');
    } else {
        console.log('🔧 SETUP REQUIRED:');
        console.log('1. Go to: https://feedly.com/i/opml');
        console.log('2. Copy your User ID from the URL (user/YOUR_ID/...)');
        console.log('3. Create feedly-config.json:');
        console.log('   {"userId": "YOUR_USER_ID_HERE"}');
        console.log('4. Restart the server');
    }
    
    console.log('');
    console.log('💡 This version uses public RSS feeds - no login required!');
    console.log('📝 Read/saved status is tracked locally only');
});
