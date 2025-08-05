#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 12012;

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

// Mock data dla testów (bez Feedly API na razie)
const mockArticles = [
    {
        id: '1',
        title: 'Test Article 1 - Exploring Modern Web Development',
        summary: 'This is a test article about modern web development techniques and best practices for creating responsive applications.',
        originUrl: 'https://example.com/article1',
        published: new Date().toISOString(),
        visual: {
            url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop'
        },
        origin: {
            title: 'Tech Blog'
        }
    },
    {
        id: '2', 
        title: 'Understanding JavaScript Async/Await',
        summary: 'Deep dive into asynchronous JavaScript programming with async/await patterns and error handling strategies.',
        originUrl: 'https://example.com/article2',
        published: new Date(Date.now() - 3600000).toISOString(),
        visual: {
            url: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=600&fit=crop'
        },
        origin: {
            title: 'JavaScript Weekly'
        }
    },
    {
        id: '3',
        title: 'The Future of Mobile App Development',
        summary: 'Trends and technologies shaping the future of mobile application development including PWAs and cross-platform frameworks.',
        originUrl: 'https://example.com/article3', 
        published: new Date(Date.now() - 7200000).toISOString(),
        visual: {
            url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=600&fit=crop'
        },
        origin: {
            title: 'Mobile Dev Weekly'
        }
    }
];

const server = http.createServer((req, res) => {
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
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ items: mockArticles }));
        return;
    }

    if (pathname.startsWith('/api/feedly/mark-read/')) {
        const articleId = pathname.split('/').pop();
        console.log(`📖 Marking article ${articleId} as read`);
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
                    console.log(`📚 Saving to Instapaper: ${data.title}`);
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
    console.log(`🚀 Feedly Tinder Server running on http://localhost:${PORT}`);
    console.log(`📱 Open in browser to start swiping articles!`);
    console.log(`🌐 Available at: feedly.mateopoznan.pl (with Caddy proxy)`);
    console.log('');
    console.log('📝 Note: Using mock data - configure Feedly & Instapaper APIs in .env for real data');
});
