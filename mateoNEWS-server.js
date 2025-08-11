const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

// Load environment variables
try {
    require('dotenv').config();
    console.log('✅ Environment loaded');
} catch (error) {
    console.log('⚠️ dotenv not found, using process.env');
}

const app = express();
const PORT = 12014;
const ADMIN_PASSWORD = 'mateoWS303!';

console.log('🔧 Starting mateoNEWS server...');

// OAuth 1.0a signature generation for Instapaper
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
    const percentEncode = (str) => {
        return encodeURIComponent(str)
            .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    };
    
    const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
        .join('&');

    const baseString = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
    const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
    
    return crypto
        .createHmac('sha1', signingKey)
        .update(baseString)
        .digest('base64');
}

// Cache for Instapaper OAuth tokens
let instapaperTokenCache = {
    token: null,
    secret: null,
    expires: 0
};

// Instapaper API helper
async function getInstapaperToken() {
    const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
    const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
    const username = process.env.INSTAPAPER_USERNAME;
    const password = process.env.INSTAPAPER_PASSWORD;

    if (!consumerKey || !consumerSecret || !username || !password) {
        throw new Error('Instapaper credentials not configured');
    }

    // Check if we have a cached token (valid for 1 hour)
    if (instapaperTokenCache.token && Date.now() < instapaperTokenCache.expires) {
        return {
            token: instapaperTokenCache.token,
            secret: instapaperTokenCache.secret
        };
    }

    console.log('🔑 Getting fresh Instapaper OAuth token');
    
    const oauthParams = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_version: '1.0'
    };

    const tokenRequestParams = {
        ...oauthParams,
        x_auth_mode: 'client_auth',
        x_auth_username: username,
        x_auth_password: password
    };

    const tokenSignature = generateOAuthSignature(
        'POST',
        'https://www.instapaper.com/api/1/oauth/access_token',
        tokenRequestParams,
        consumerSecret
    );

    tokenRequestParams.oauth_signature = tokenSignature;

    const tokenResponse = await axios.post(
        'https://www.instapaper.com/api/1/oauth/access_token',
        new URLSearchParams(tokenRequestParams).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    const tokenData = new URLSearchParams(tokenResponse.data);
    const oauthToken = tokenData.get('oauth_token');
    const oauthTokenSecret = tokenData.get('oauth_token_secret');

    // Cache the token for 1 hour
    instapaperTokenCache = {
        token: oauthToken,
        secret: oauthTokenSecret,
        expires: Date.now() + (60 * 60 * 1000)
    };

    return { token: oauthToken, secret: oauthTokenSecret };
}

// Get bookmarks from Instapaper
async function getInstapaperBookmarks(folder = 'archive', limit = 1000) {
    const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
    const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
    
    console.log(`🔑 Connecting to Instapaper folder: ${folder}...`);
    
    if (!consumerKey || !consumerSecret) {
        console.log('❌ Instapaper credentials missing, using mock data');
        return generateMockData();
    }
    
    try {
        const { token, secret } = await getInstapaperToken();

        const bookmarkParams = {
            oauth_consumer_key: consumerKey,
            oauth_nonce: crypto.randomBytes(16).toString('hex'),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_version: '1.0',
            oauth_token: token,
            folder: folder,
            limit: limit.toString()
        };

        const bookmarkSignature = generateOAuthSignature(
            'POST',
            'https://www.instapaper.com/api/1/bookmarks/list',
            bookmarkParams,
            consumerSecret,
            secret
        );

        bookmarkParams.oauth_signature = bookmarkSignature;

        const response = await axios.post(
            'https://www.instapaper.com/api/1/bookmarks/list',
            new URLSearchParams(bookmarkParams).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000
            }
        );

        // Instapaper returns data in a specific format
        const bookmarks = response.data;
        if (Array.isArray(bookmarks)) {
            console.log(`📚 Retrieved ${bookmarks.length} items from Instapaper`);
            
            // Debug: Log first few items to see structure
            console.log('🔍 First 3 items structure:', JSON.stringify(bookmarks.slice(0, 3), null, 2));
            
            // Filter and process bookmarks - NEW FORMAT HANDLING
            const processedBookmarks = bookmarks
                .filter(item => item && item.type === 'bookmark')
                .map(item => ({
                    id: item.bookmark_id,
                    url: item.url && item.url !== 'undefined' ? item.url : '#',
                    title: item.title || 'Bez tytułu',
                    description: item.description || '',
                    time: item.time ? new Date(item.time * 1000) : new Date(),
                    starred: item.starred === '1',
                    progress: item.progress || 0
                }))
                .filter(item => item.url !== '#' && item.title !== 'Bez tytułu') // Filter out invalid items
                .sort((a, b) => b.time - a.time); // Sort by newest first
            
            console.log(`✅ Processed ${processedBookmarks.length} bookmarks`);
            
            // If empty, return mock data for development
            if (processedBookmarks.length === 0) {
                console.log('🔄 Empty Instapaper response, using mock data');
                return generateMockData();
            }
            
            return processedBookmarks;
        }

        console.log('🔄 Invalid Instapaper response format, using mock data');
        return generateMockData();
    } catch (error) {
        console.error('Instapaper API Error:', error.response?.data || error.message);
        console.log('🔄 Falling back to mock data');
        return generateMockData();
    }
}

// Generate mock data for testing
function generateMockData() {
    const mockArticles = [
        {
            id: 1,
            url: 'https://www.poznań.pl/aktualności/miasto-inwestuje-w-zielen',
            title: 'Poznań inwestuje w zieleń miejską - nowe parki i skwery',
            description: 'Władze miasta Poznania ogłosiły ambitny plan rozwoju terenów zielonych. W ramach inicjatywy powstanie 15 nowych parków i skwerów.',
            time: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
            starred: false,
            progress: 0,
            image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=400&fit=crop'
        },
        {
            id: 2,
            url: 'https://technologia.wp.pl/ai-rewolucja-2025',
            title: 'Sztuczna inteligencja w 2025 roku - przełomowe zmiany',
            description: 'Eksperci przewidują, że rok 2025 będzie kluczowy dla rozwoju AI. Nowe modele językowe oraz zastosowania w medycynie.',
            time: new Date(Date.now() - 1000 * 60 * 60 * 1), // 1 hour ago
            starred: true,
            progress: 50,
            image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop'
        },
        {
            id: 3,
            url: 'https://businessinsider.com.pl/gospodarka/ekologia-w-biznesie',
            title: 'Ekologia w biznesie - trendy na 2025 rok',
            description: 'Coraz więcej firm stawia na zrównoważony rozwój. Analiza najważniejszych trendów ekologicznych w świecie biznesu.',
            time: new Date(Date.now() - 1000 * 60 * 45), // 45 min ago
            starred: false,
            progress: 100,
            image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=400&fit=crop'
        },
        {
            id: 4,
            url: 'https://nauka.gov.pl/badania-kosmiczne-polska',
            title: 'Polskie badania kosmiczne zyskują na znaczeniu',
            description: 'Polska coraz aktywniej uczestniczy w międzynarodowych misjach kosmicznych. Najnowsze osiągnięcia i plany na przyszłość.',
            time: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
            starred: true,
            progress: 75,
            image: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&h=400&fit=crop'
        },
        {
            id: 5,
            url: 'https://sport.pl/liga-mistrzów-lech-poznań',
            title: 'Lech Poznań w Lidze Mistrzów - historyczny moment',
            description: 'Po latach starań Lech Poznań ponownie zagra w prestiżowych rozgrywkach europejskich. Analiza szans i przeciwników.',
            time: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
            starred: false,
            progress: 20,
            image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop'
        },
        {
            id: 6,
            url: 'https://kultura.wp.pl/nowe-trendy-sztuka-2025',
            title: 'Sztuka cyfrowa i NFT - rewolucja w świecie kultury',
            description: 'Jak technologia blockchain zmienia sposób postrzegania i sprzedawania dzieł sztuki. Najciekawsze projekty roku.',
            time: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            starred: true,
            progress: 60,
            image: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=400&fit=crop'
        },
        {
            id: 5,
            url: 'https://sport.onet.pl/pilka-nozna/lech-poznan-transfery',
            title: 'Lech Poznań planuje zimowe transfery',
            description: 'Kolejorz szykuje się do zimowego okna transferowego. Klub jest blisko pozyskania nowego napastnika.',
            time: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
            starred: false,
            progress: 0,
            image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop'
        },
        {
            id: 6,
            url: 'https://www.rp.pl/ekonomia/inflacja-stopy-procentowe',
            title: 'NBP: Stopy procentowe bez zmian w styczniu',
            description: 'Rada Polityki Pieniężnej utrzymała stopy procentowe na niezmienionym poziomie. Analiza wpływu na gospodarkę.',
            time: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
            starred: false,
            progress: 25,
            image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=400&fit=crop'
        },
        {
            id: 7,
            url: 'https://kultura.onet.pl/muzyka/koncerty-2025',
            title: 'Najciekawsze koncerty w Polsce w 2025 roku',
            description: 'Przegląd najważniejszych wydarzeń muzycznych nadchodzącego roku. Od rocka po klasykę.',
            time: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
            starred: true,
            progress: 90,
            image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop'
        },
        {
            id: 8,
            url: 'https://www.tvn24.pl/swiat/polityka-międzynarodowa',
            title: 'Szczyt UE: Kluczowe decyzje ws. obrony',
            description: 'Liderzy Unii Europejskiej podjęli ważne decyzje dotyczące wspólnej polityki obronnej i bezpieczeństwa.',
            time: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
            starred: false,
            progress: 60,
            image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop'
        }
    ];
    
    return mockArticles;
}

// Extract image from article URL
async function extractImageFromUrl(url) {
    try {
        // Use same site-specific headers as extractArticleContent
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };

        // Special cases for different sites (same as extractArticleContent)
        if (url.includes('wyborcza.pl')) {
            headers['User-Agent'] = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
            headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
        } else if (url.includes('x.com') || url.includes('twitter.com')) {
            headers['User-Agent'] = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
            headers['Accept'] = '*/*';
        } else if (url.includes('aljazeera.com')) {
            headers['User-Agent'] = 'Mozilla/5.0 (compatible; WhatsApp/2.0)';
            headers['Referer'] = 'https://www.google.com/';
        } else if (url.includes('mastodon') || url.includes('101010.pl')) {
            headers['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            headers['Accept'] = 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", text/html';
        }
        
        const response = await axios.get(url, {
            timeout: 5000,
            headers: headers
        });
        
        const html = response.data;
        
        // Try og:image first
        const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        if (ogImageMatch) {
            return ogImageMatch[1];
        }
        
        // Try twitter:image as fallback
        const twitterImageMatch = html.match(/<meta name="twitter:image" content="([^"]+)"/i);
        if (twitterImageMatch) {
            return twitterImageMatch[1];
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

// Add bookmark to Instapaper
async function addToInstapaper(url, title) {
    const consumerKey = process.env.INSTAPAPER_CONSUMER_KEY;
    const consumerSecret = process.env.INSTAPAPER_CONSUMER_SECRET;
    
    try {
        const { token, secret } = await getInstapaperToken();

        const bookmarkParams = {
            oauth_consumer_key: consumerKey,
            oauth_nonce: crypto.randomBytes(16).toString('hex'),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_version: '1.0',
            oauth_token: token,
            url: url,
            ...(title && { title })
        };

        const bookmarkSignature = generateOAuthSignature(
            'POST',
            'https://www.instapaper.com/api/1/bookmarks/add',
            bookmarkParams,
            consumerSecret,
            secret
        );

        bookmarkParams.oauth_signature = bookmarkSignature;

        const response = await axios.post(
            'https://www.instapaper.com/api/1/bookmarks/add',
            new URLSearchParams(bookmarkParams).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        console.log('✅ Successfully added to Instapaper');
        return true;
    } catch (error) {
        console.error('Instapaper add error:', error.response?.data || error.message);
        throw error;
    }
}

// Middleware
app.use(cors());
app.use(express.json());

// Custom middleware for .shortcut files
app.use('/mateoNEWS-Story.shortcut', (req, res, next) => {
    res.setHeader('Content-Type', 'application/vnd.apple.shortcuts');
    res.setHeader('Content-Disposition', 'attachment; filename="mateoNEWS-Story.shortcut"');
    next();
});

// Cache control middleware for static files
app.use(express.static(path.join(__dirname, 'mateoNEWS-public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            // No cache for HTML files
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (path.endsWith('.js') || path.endsWith('.css')) {
            // Short cache for JS/CSS files
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
        }
    }
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mateoNEWS-public', 'index.html'));
});

app.get('/admin', (req, res) => {
    // Agresywnie wyłącz cache dla generatora story
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Last-Modified', new Date().toUTCString());
    res.setHeader('ETag', ''); // Usuń ETag
    res.sendFile(path.join(__dirname, 'mateoNEWS-public', 'admin.html'));
});

app.get('/ciekawe', (req, res) => {
    res.sendFile(path.join(__dirname, 'mateoNEWS-public', 'ciekawe.html'));
});

app.get('/bookmarklet', (req, res) => {
    res.sendFile(path.join(__dirname, 'mateoNEWS-public', 'bookmarklet.html'));
});

// API Routes
app.get('/api/articles', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 30; // 30 articles per page
        const offset = (page - 1) * limit;
        
        // mateoNEWS v0.5 uses 'archive' folder for archived articles (properly read articles)
        const allArticles = await getInstapaperBookmarks('archive', 1000);
        const paginatedArticles = allArticles.slice(offset, offset + limit);
        
        // Add images to articles - FALLBACK TO MOCK if URLs are undefined
        const articlesWithImages = await Promise.all(
            paginatedArticles.map(async (article, index) => {
                let imageUrl = 'http://x.mateopoznan.pl/mateoNEWS.png'; // default
                
                // Skip image extraction if URL is undefined/invalid - use placeholder
                if (article.url && article.url !== 'undefined' && article.url !== '#' && article.url.startsWith('http')) {
                    try {
                        // Quick timeout for image extraction
                        const imageResponse = await Promise.race([
                            extractImageFromUrl(article.url),
                            new Promise(resolve => setTimeout(() => resolve(null), 2000))
                        ]);
                        if (imageResponse) {
                            imageUrl = imageResponse;
                        }
                    } catch (error) {
                        console.log(`⚠️ Image extraction failed for ${article.title}`);
                    }
                } else {
                    // Use mock images for articles with undefined URLs
                    const mockImages = [
                        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=400&fit=crop',
                        'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
                        'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=400&fit=crop',
                        'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&h=400&fit=crop',
                        'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop'
                    ];
                    imageUrl = mockImages[index % mockImages.length];
                }
                
                return {
                    ...article,
                    image: imageUrl,
                    excerpt: article.description || '',
                    category: 'Wiadomość'
                };
            })
        );
        
        res.json({
            articles: articlesWithImages,
            currentPage: page,
            totalPages: Math.ceil(allArticles.length / limit),
            totalArticles: allArticles.length,
            hasNextPage: offset + limit < allArticles.length,
            hasPrevPage: page > 1
        });
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

app.get('/api/articles/starred', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 30; // 30 articles per page
        const offset = (page - 1) * limit;
        
        // mateoNEWS v0.5 Ciekawe uses 'starred' folder for liked articles
        const allStarredArticles = await getInstapaperBookmarks('starred', 1000);
        const paginatedArticles = allStarredArticles.slice(offset, offset + limit);
        
        // Add images to starred articles - FALLBACK TO MOCK if URLs are undefined  
        const articlesWithImages = await Promise.all(
            paginatedArticles.map(async (article, index) => {
                let imageUrl = 'http://x.mateopoznan.pl/mateoNEWS.png'; // default
                
                // Skip image extraction if URL is undefined/invalid - use placeholder
                if (article.url && article.url !== 'undefined' && article.url !== '#' && article.url.startsWith('http')) {
                    try {
                        // Quick timeout for image extraction
                        const imageResponse = await Promise.race([
                            extractImageFromUrl(article.url),
                            new Promise(resolve => setTimeout(() => resolve(null), 2000))
                        ]);
                        if (imageResponse) {
                            imageUrl = imageResponse;
                        }
                    } catch (error) {
                        console.log(`⚠️ Image extraction failed for ${article.title}`);
                    }
                } else {
                    // Use mock images for starred articles with undefined URLs
                    const mockImages = [
                        'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop',
                        'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&h=400&fit=crop',
                        'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=400&fit=crop',
                        'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=400&fit=crop'
                    ];
                    imageUrl = mockImages[index % mockImages.length];
                }
                
                return {
                    ...article,
                    image: imageUrl,
                    excerpt: article.description || '',
                    category: 'Ciekawe'
                };
            })
        );
        
        res.json({
            articles: articlesWithImages,
            currentPage: page,
            totalPages: Math.ceil(allStarredArticles.length / limit),
            totalArticles: allStarredArticles.length,
            hasNextPage: offset + limit < allStarredArticles.length,
            hasPrevPage: page > 1
        });
    } catch (error) {
        console.error('Error fetching starred articles:', error);
        // Fallback to mock starred articles
        const mockArticles = generateMockData();
        const starredMock = mockArticles.filter(article => article.starred);
        res.json({
            articles: starredMock,
            currentPage: 1,
            totalPages: 1,
            totalArticles: starredMock.length,
            hasNextPage: false,
            hasPrevPage: false
        });
    }
});

// Extract image from URL (Open Graph, meta tags, etc.)
app.get('/api/extract-image', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
            const response = await axios.get(url, { 
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                }
            });        const html = response.data;
        
        // Extract Open Graph image
        let imageUrl = null;
        
        // Try og:image first
        const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
        if (ogImageMatch) {
            imageUrl = ogImageMatch[1];
        }
        
        // Try twitter:image as fallback
        if (!imageUrl) {
            const twitterImageMatch = html.match(/<meta name="twitter:image" content="([^"]+)"/i);
            if (twitterImageMatch) {
                imageUrl = twitterImageMatch[1];
            }
        }
        
        // Try meta image as fallback
        if (!imageUrl) {
            const metaImageMatch = html.match(/<meta name="image" content="([^"]+)"/i);
            if (metaImageMatch) {
                imageUrl = metaImageMatch[1];
            }
        }
        
        if (imageUrl) {
            // Make absolute URL if relative
            if (imageUrl.startsWith('/')) {
                const urlObj = new URL(url);
                imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
            }
            
            res.json({ image: imageUrl });
        } else {
            // Return null instead of placeholder
            res.json({ image: null });
        }
        
    } catch (error) {
        console.error('Error extracting image:', error);
        res.json({ image: null });
    }
});

// Image proxy endpoint for CORS
app.get('/api/image-proxy', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        if (!imageUrl) {
            return res.status(400).json({ error: 'URL parameter required' });
        }
        
        console.log('🖼️ Proxying image:', imageUrl);
        
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; mateoNEWS/1.0)'
            }
        });
        
        // Set proper headers
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        
        // Pipe the image
        response.data.pipe(res);
        
    } catch (error) {
        console.error('Image proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch image' });
    }
});

// Extract article metadata for generator
app.get('/api/extract-article', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        console.log('🔍 Extracting article from:', url);
        
        // Special handling for problematic sites
        let headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };

        // Special cases for different sites
        if (url.includes('wyborcza.pl')) {
            headers['User-Agent'] = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
            headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
        } else if (url.includes('x.com') || url.includes('twitter.com')) {
            headers['User-Agent'] = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
            headers['Accept'] = '*/*';
        } else if (url.includes('aljazeera.com')) {
            headers['User-Agent'] = 'Mozilla/5.0 (compatible; WhatsApp/2.0)';
            headers['Referer'] = 'https://www.google.com/';
        } else if (url.includes('mastodon') || url.includes('101010.pl')) {
            headers['User-Agent'] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            headers['Accept'] = 'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams", text/html';
        }

        const response = await axios.get(url, {
            timeout: 10000,
            headers: headers
        });
        
        const html = response.data;
        console.log('✅ HTML fetched, length:', typeof html === 'string' ? html.length : 'non-string');
        console.log('🔍 HTML preview:', typeof html === 'string' ? html.substring(0, 500) : 'Data type: ' + typeof html);

        // Handle non-string responses (like JSON from Mastodon)
        if (typeof html !== 'string') {
            console.log('📄 Non-HTML response detected, attempting fallback extraction');
            let title = 'Bez tytułu';
            let description = '';
            let image = null;

            // Try to extract from JSON if it's an object
            if (typeof html === 'object' && html !== null) {
                if (html.name || html.summary || html.content) {
                    title = html.name || html.summary || 'Bez tytułu';
                    description = html.content || html.summary || '';
                    if (html.icon && html.icon.url) {
                        image = html.icon.url;
                    }
                }
            }

            // Don't use fallback - return null if no image found
            // if (!image) {
            //     image = 'https://x.mateopoznan.pl/mateoNEWS.png';
            // }

            return res.json({
                url: url,
                title: title,
                description: description,
                image: image, // Can be null
                time: new Date()
            });
        }
        
        // Extract title - improved regex for BBC and other sites
        let title = '';
        const ogTitleMatch = html.match(/property="og:title"[^>]*content="([^"]+)"/i) || 
                           html.match(/content="([^"]+)"[^>]*property="og:title"/i);
        if (ogTitleMatch) {
            title = ogTitleMatch[1];
        } else {
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
                title = titleMatch[1];
            }
        }

        // Extract description - improved regex
        let description = '';
        const ogDescMatch = html.match(/property="og:description"[^>]*content="([^"]+)"/i) || 
                          html.match(/content="([^"]+)"[^>]*property="og:description"/i);
        if (ogDescMatch) {
            description = ogDescMatch[1];
        } else {
            const metaDescMatch = html.match(/name="description"[^>]*content="([^"]+)"/i) || 
                                html.match(/content="([^"]+)"[^>]*name="description"/i);
            if (metaDescMatch) {
                description = metaDescMatch[1];
            }
        }

        // Extract image - improved regex
        let image = null;
        const ogImageMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i) || 
                           html.match(/content="([^"]+)"[^>]*property="og:image"/i);
        if (ogImageMatch) {
            image = ogImageMatch[1];
            if (image.startsWith('/')) {
                const urlObj = new URL(url);
                image = `${urlObj.protocol}//${urlObj.host}${image}`;
            }
        }

        // Don't use fallback - return null if no image found
        // if (!image) {
        //     image = 'https://x.mateopoznan.pl/mateoNEWS.png';
        // }

        res.json({
            url: url,
            title: title || 'Bez tytułu',
            description: description || '',
            image: image, // Can be null
            time: new Date()
        });
        
    } catch (error) {
        console.error('Error extracting article:', error);
        res.status(500).json({ error: 'Failed to extract article data' });
    }
});

app.post('/api/add', async (req, res) => {
    const { url, title, password } = req.body;
    
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Nieprawidłowe hasło' });
    }
    
    if (!url) {
        return res.status(400).json({ error: 'URL jest wymagany' });
    }
    
    try {
        await addToInstapaper(url, title);
        res.json({ success: true, message: 'Artykuł dodany pomyślnie' });
    } catch (error) {
        res.status(500).json({ error: 'Błąd podczas dodawania artykułu' });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 mateoNEWS Server running on http://localhost:${PORT}`);
    console.log(`🌐 Available at: news.mateopoznan.pl (with Caddy proxy)`);
    console.log(`📚 Features: Instapaper integration, starred articles`);
    console.log('');
    
    // Test Instapaper connection (non-blocking)
    setTimeout(async () => {
        try {
            console.log('🔄 Testing Instapaper connection...');
            const testBookmarks = await getInstapaperBookmarks('archive', 5);
            console.log(`✅ Instapaper connected - found ${testBookmarks.length} articles`);
        } catch (error) {
            console.error('❌ Instapaper connection failed:', error.message);
            console.log('🔄 Using mock data for development');
        }
    }, 1000);
});
