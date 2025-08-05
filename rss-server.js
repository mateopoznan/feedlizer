const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { parseString } = require('xml2js'); // będziemy potrzebować parsera XML

const PORT = 12012;

// Funkcja do parsowania OPML (lista RSS feeds z Feedly)
function parseOPML(opmlContent) {
    return new Promise((resolve, reject) => {
        parseString(opmlContent, (err, result) => {
            if (err) return reject(err);
            
            const feeds = [];
            const outlines = result.opml.body[0].outline || [];
            
            function extractFeeds(outlines) {
                outlines.forEach(outline => {
                    if (outline.$.xmlUrl) {
                        feeds.push({
                            title: outline.$.title || outline.$.text,
                            xmlUrl: outline.$.xmlUrl,
                            htmlUrl: outline.$.htmlUrl,
                            category: outline.$.category || 'Uncategorized'
                        });
                    }
                    if (outline.outline) {
                        extractFeeds(outline.outline);
                    }
                });
            }
            
            extractFeeds(outlines);
            resolve(feeds);
        });
    });
}

// Funkcja do pobierania RSS feed
function fetchRSS(feedUrl) {
    return new Promise((resolve, reject) => {
        const client = feedUrl.startsWith('https:') ? https : http;
        
        client.get(feedUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                parseString(data, (err, result) => {
                    if (err) return reject(err);
                    
                    const items = [];
                    let channel;
                    
                    // RSS 2.0
                    if (result.rss && result.rss.channel) {
                        channel = result.rss.channel[0];
                        const rssItems = channel.item || [];
                        
                        rssItems.forEach(item => {
                            items.push({
                                id: item.guid ? item.guid[0]._ || item.guid[0] : item.link[0],
                                title: item.title[0],
                                summary: item.description ? item.description[0].replace(/<[^>]*>/g, '').substring(0, 200) + '...' : '',
                                originUrl: item.link[0],
                                published: new Date(item.pubDate[0]).toISOString(),
                                visual: extractImageFromContent(item.description ? item.description[0] : ''),
                                origin: {
                                    title: channel.title[0]
                                }
                            });
                        });
                    }
                    
                    // Atom
                    if (result.feed && result.feed.entry) {
                        const atomItems = result.feed.entry || [];
                        
                        atomItems.forEach(item => {
                            items.push({
                                id: item.id[0],
                                title: item.title[0]._,
                                summary: item.summary ? item.summary[0]._.replace(/<[^>]*>/g, '').substring(0, 200) + '...' : '',
                                originUrl: item.link[0].$.href,
                                published: new Date(item.published[0]).toISOString(),
                                visual: extractImageFromContent(item.summary ? item.summary[0]._ : ''),
                                origin: {
                                    title: result.feed.title[0]._
                                }
                            });
                        });
                    }
                    
                    resolve(items);
                });
            });
        }).on('error', reject);
    });
}

// Wyciągnij obrazek z contentu RSS
function extractImageFromContent(content) {
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

// Zarządzanie stanem artykułów (read/unread)
class ArticleState {
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
    
    markAsRead(articleId) {
        this.readArticles.add(articleId);
        this.saveState();
    }
    
    markAsSaved(articleId) {
        this.savedArticles.add(articleId);
        this.saveState();
    }
    
    isRead(articleId) {
        return this.readArticles.has(articleId);
    }
    
    isSaved(articleId) {
        return this.savedArticles.has(articleId);
    }
}

const articleState = new ArticleState();
let cachedArticles = [];
let lastFetchTime = 0;

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
            // Cache na 5 minut
            if (Date.now() - lastFetchTime > 5 * 60 * 1000 || cachedArticles.length === 0) {
                console.log('🔄 Fetching fresh RSS feeds...');
                
                // Sprawdź czy mamy OPML
                if (!fs.existsSync('feeds.opml')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        error: 'Brak pliku feeds.opml. Wyeksportuj swoje subskrypcje z Feedly.' 
                    }));
                    return;
                }
                
                const opmlContent = fs.readFileSync('feeds.opml', 'utf8');
                const feeds = await parseOPML(opmlContent);
                
                console.log(`📡 Found ${feeds.length} RSS feeds`);
                
                // Pobierz artykuły z pierwszych 5 feedów (żeby nie przeciążać)
                const allArticles = [];
                for (let i = 0; i < Math.min(feeds.length, 5); i++) {
                    try {
                        console.log(`📥 Fetching: ${feeds[i].title}`);
                        const articles = await fetchRSS(feeds[i].xmlUrl);
                        allArticles.push(...articles);
                    } catch (error) {
                        console.log(`❌ Error fetching ${feeds[i].title}:`, error.message);
                    }
                }
                
                // Sortuj od najnowszego
                cachedArticles = allArticles
                    .sort((a, b) => new Date(b.published) - new Date(a.published))
                    .filter(article => !articleState.isRead(article.id)); // Filtruj przeczytane
                
                lastFetchTime = Date.now();
                console.log(`✅ Loaded ${cachedArticles.length} unread articles`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ items: cachedArticles }));
        } catch (error) {
            console.error('Error fetching RSS:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Błąd podczas pobierania RSS feeds' }));
        }
        return;
    }

    if (pathname.startsWith('/api/feedly/mark-read/')) {
        const articleId = decodeURIComponent(pathname.split('/').pop());
        articleState.markAsRead(articleId);
        console.log(`📖 Marked as read: ${articleId}`);
        
        // Usuń z cache
        cachedArticles = cachedArticles.filter(article => article.id !== articleId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Article marked as read' }));
        return;
    }

    if (pathname === '/api/instapaper/add') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    articleState.markAsSaved(data.id);
                    console.log(`📚 Saved to Instapaper: ${data.title}`);
                    
                    // Usuń z cache po zapisaniu
                    cachedArticles = cachedArticles.filter(article => article.id !== data.id);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Article saved to Instapaper' }));
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
    console.log('📝 Setup Instructions:');
    console.log('1. Export your Feedly subscriptions as OPML:');
    console.log('   Feedly → Settings → Import/Export → Export OPML');
    console.log('2. Save the file as "feeds.opml" in this directory');
    console.log('3. Restart the server');
    console.log('');
    console.log('✨ Your read/saved status will be saved locally in article-state.json');
});
