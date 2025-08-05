const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 12012;

// Prosty parser RSS/XML (bez external dependencies)
class SimpleRSSParser {
    static parseRSS(xmlData) {
        const articles = [];
        
        try {
            // Znajdź wszystkie <item> elementy
            const itemMatches = xmlData.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
            
            if (!itemMatches) return articles;
            
            itemMatches.forEach(itemXml => {
                try {
                    const article = {
                        id: this.extractTag(itemXml, 'guid') || this.extractTag(itemXml, 'link'),
                        title: this.extractTag(itemXml, 'title'),
                        summary: this.cleanDescription(this.extractTag(itemXml, 'description')),
                        originUrl: this.extractTag(itemXml, 'link'),
                        published: new Date(this.extractTag(itemXml, 'pubDate')).toISOString(),
                        visual: this.extractImage(itemXml),
                        origin: {
                            title: this.extractSource(itemXml)
                        }
                    };
                    
                    if (article.id && article.title) {
                        articles.push(article);
                    }
                } catch (error) {
                    console.log('Error parsing item:', error.message);
                }
            });
            
        } catch (error) {
            console.error('Error parsing RSS:', error.message);
        }
        
        return articles;
    }
    
    static extractTag(xml, tagName) {
        const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
        const match = xml.match(regex);
        
        if (match && match[1]) {
            // Usuń CDATA jeśli istnieje
            return match[1]
                .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .trim();
        }
        
        return '';
    }
    
    static cleanDescription(description) {
        if (!description) return '';
        
        // Usuń HTML tags
        let text = description.replace(/<[^>]*>/g, ' ');
        
        // Usuń wielokrotne spacje
        text = text.replace(/\s+/g, ' ').trim();
        
        // Ogranicz długość
        return text.substring(0, 200) + (text.length > 200 ? '...' : '');
    }
    
    static extractImage(itemXml) {
        // Spróbuj znaleźć obrazek w różnych miejscach
        const imgPatterns = [
            /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
            /<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i,
            /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^>]*>/i
        ];
        
        for (const pattern of imgPatterns) {
            const match = itemXml.match(pattern);
            if (match && match[1]) {
                return { url: match[1] };
            }
        }
        
        // Fallback do unsplash
        const randomId = Math.floor(Math.random() * 1000);
        return { 
            url: `https://images.unsplash.com/photo-${1461749280684 + randomId}?w=800&h=600&fit=crop` 
        };
    }
    
    static extractSource(itemXml) {
        // Spróbuj wyciągnąć źródło z różnych miejsc
        const sourcePatterns = [
            /<source[^>]*>([^<]+)<\/source>/i,
            /<dc:creator[^>]*>([^<]+)<\/dc:creator>/i,
            /-- ([^<-]+?)(?:\s|<|$)/i
        ];
        
        for (const pattern of sourcePatterns) {
            const match = itemXml.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return 'Feedly';
    }
}

// Klasa do zarządzania RSS feeds z Feedly
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
    async getFeedlyRSS(userId, category = 'global.all') {
        return new Promise((resolve, reject) => {
            if (!userId) {
                reject(new Error('User ID is required. Get it from: https://feedly.com/i/opml'));
                return;
            }
            
            // Różne formaty URL do wypróbowania
            const feedUrls = [
                `https://cloud.feedly.com/v3/streams/contents?streamId=user%2F${userId}%2Fcategory%2F${category}&count=50`,
                `https://feedly.com/f/${userId}/${category}.rss`,
                `https://cloud.feedly.com/v3/streams/user%2F${userId}%2Fcategory%2F${category}/contents.rss`,
            ];
            
            let lastError = null;
            let urlIndex = 0;
            
            const tryNextUrl = () => {
                if (urlIndex >= feedUrls.length) {
                    reject(new Error(`All feed URLs failed. Last error: ${lastError?.message || 'Unknown'}`));
                    return;
                }
                
                const feedUrl = feedUrls[urlIndex++];
                console.log(`📡 Trying Feedly feed: ${feedUrl}`);
                
                const request = feedUrl.startsWith('https:') ? https : http;
                
                request.get(feedUrl, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                let articles;
                                
                                // Sprawdź czy to JSON czy RSS
                                if (data.trim().startsWith('{')) {
                                    // JSON response
                                    const jsonData = JSON.parse(data);
                                    articles = this.parseJSONResponse(jsonData);
                                } else {
                                    // RSS response
                                    articles = SimpleRSSParser.parseRSS(data);
                                }
                                
                                // Filtruj przeczytane artykuły
                                const unreadArticles = articles.filter(article => !this.readArticles.has(article.id));
                                
                                console.log(`✅ Successfully loaded ${unreadArticles.length} unread articles`);
                                resolve(unreadArticles);
                                return;
                                
                            } catch (parseError) {
                                lastError = parseError;
                                console.log(`❌ Parse error: ${parseError.message}`);
                                tryNextUrl();
                            }
                        } else {
                            lastError = new Error(`HTTP ${res.statusCode}: ${data}`);
                            console.log(`❌ HTTP error: ${res.statusCode}`);
                            tryNextUrl();
                        }
                    });
                }).on('error', (error) => {
                    lastError = error;
                    console.log(`❌ Request error: ${error.message}`);
                    tryNextUrl();
                });
            };
            
            tryNextUrl();
        });
    }
    
    // Parsuj odpowiedź JSON z Feedly API
    parseJSONResponse(jsonData) {
        const articles = [];
        
        if (jsonData.items && Array.isArray(jsonData.items)) {
            jsonData.items.forEach(item => {
                try {
                    const article = {
                        id: item.id,
                        title: item.title || 'Untitled',
                        summary: this.extractSummary(item.summary?.content || item.content?.content || ''),
                        originUrl: item.canonicalUrl || item.alternate?.[0]?.href || '#',
                        published: new Date(item.published || Date.now()).toISOString(),
                        visual: item.visual || this.generateRandomImage(),
                        origin: {
                            title: item.origin?.title || 'Unknown Source'
                        }
                    };
                    
                    articles.push(article);
                } catch (error) {
                    console.log('Error parsing JSON item:', error.message);
                }
            });
        }
        
        return articles;
    }
    
    extractSummary(content) {
        if (!content) return '';
        
        // Usuń HTML tags
        let text = content.replace(/<[^>]*>/g, ' ');
        
        // Usuń wielokrotne spacje
        text = text.replace(/\s+/g, ' ').trim();
        
        // Ogranicz długość
        return text.substring(0, 200) + (text.length > 200 ? '...' : '');
    }
    
    generateRandomImage() {
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
                console.log('🔄 Fetching fresh articles from Feedly...');
                
                const articles = await feedlyManager.getFeedlyRSS(config.userId);
                
                // Sortuj od najnowszego
                cachedArticles = articles.sort((a, b) => new Date(b.published) - new Date(a.published));
                
                lastFetchTime = Date.now();
                console.log(`✅ Cached ${cachedArticles.length} articles`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ items: cachedArticles }));
        } catch (error) {
            console.error('Error fetching Feedly:', error);
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
        console.log('📡 Will fetch articles from your Feedly feed');
    } else {
        console.log('🔧 SETUP REQUIRED:');
        console.log('1. Go to: https://feedly.com/i/opml');
        console.log('2. Copy your User ID from the URL (user/YOUR_ID/...)');
        console.log('3. Create feedly-config.json:');
        console.log('   {"userId": "YOUR_USER_ID_HERE"}');
        console.log('4. Restart the server');
    }
    
    console.log('');
    console.log('💡 This version uses Feedly public feeds - no login required!');
    console.log('📝 Read/saved status is tracked locally');
});
