// --- GLOBALNA FUNKCJA DLA ADMIN.HTML ---
// Pozwala na automatyczne generowanie story po autofill/bookmarklet
window.generateStoryFromUrl = async function generateStoryFromUrl() {
    const urlInput = document.getElementById('article-url');
    const titleInput = document.getElementById('article-title');
    const descInput = document.getElementById('article-description');
    const selectedBgOption = document.querySelector('.bg-option.selected');

    const url = urlInput ? urlInput.value.trim() : '';
    const title = titleInput ? titleInput.value.trim() : '';
    const description = descInput ? descInput.value.trim() : '';
    const background = selectedBgOption ? selectedBgOption.dataset.bg : 'mateoNEWS1.png';

    if (!url) {
        if (window.showStatus) window.showStatus('❌ Brak URL artykułu!', 'error');
        return;
    }

    // Pobierz dane artykułu z API, jeśli tytuł lub opis są puste
    let article = { url, title, description, background };
    if (!title || !description) {
        try {
            const response = await fetch(`/api/extract-article?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            article.title = title || data.title || '';
            article.description = description || data.description || '';
            article.image = data.image || '';
        } catch (e) {
            if (window.showStatus) window.showStatus('❌ Nie udało się pobrać danych artykułu', 'error');
        }
    }
    window.generateStoryWithCustomArticle(article);
};
// Global variables
let articles = [];
let refreshInterval;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Determine page type
    isStarredPage = window.location.pathname === '/ciekawe';
    
    // Apply light theme for Ciekawe page
    if (isStarredPage) {
        document.body.classList.add('light-theme');
    }
    
    // Load articles
    loadArticles(1);
    startAutoRefresh();
});

// Extract domain from URL
function extractDomain(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '');
    } catch (e) {
        return 'unknown';
    }
}

// Get favicon URL for domain
function getFaviconUrl(domain) {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
}

// Extract image from article or generate placeholder
function getArticleImage(article) {
    // Check if article has image from API
    if (article.image) {
        return article.image;
    }
    
    // Try to get Open Graph image (will implement server-side)
    return `/api/extract-image?url=${encodeURIComponent(article.url)}`;
}

// Load main articles (all archived articles from Instapaper)
// Global variables
let articlesData = [];
let currentPage = 1;
let totalPages = 1;
let isStarredPage = false;

// Load articles with pagination - mateoNEWS v0.5
async function loadArticles(page = 1) {
    const loadingElement = document.getElementById('loading');
    const articlesContainer = document.getElementById('articles-grid');
    
    // Show loading initially, hide articles
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
    if (articlesContainer) {
        articlesContainer.style.display = 'none';
    }
    
    try {
        const endpoint = isStarredPage ? '/api/articles/starred' : '/api/articles';
        const response = await fetch(`${endpoint}?page=${page}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Handle both old format (array) and new format (object with pagination)
        if (Array.isArray(data)) {
            articlesData = data;
            currentPage = 1;
            totalPages = 1;
        } else {
            articlesData = data.articles || [];
            currentPage = data.currentPage || 1;
            totalPages = data.totalPages || 1;
        }
        
        renderArticles();
        updatePaginationControls();
        
        // Hide loading, show articles
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        if (articlesContainer) {
            articlesContainer.style.display = 'grid';
        }
        
    } catch (error) {
        console.error('Error loading articles:', error);
        showToast('Błąd podczas ładowania artykułów', 'error');
        
        // Hide loading on error too
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        if (articlesContainer) {
            articlesContainer.style.display = 'grid';
        }
    }
}

// Render articles to container
function renderArticles() {
    const container = document.getElementById('articles-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!Array.isArray(articlesData) || articlesData.length === 0) {
        container.innerHTML = '<div class="no-articles">Brak artykułów do wyświetlenia</div>';
        return;
    }
    
    articlesData.forEach(article => {
        const articleElement = createArticleElement(article);
        container.appendChild(articleElement);
    });
}

// Update pagination controls
function updatePaginationControls() {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    
    paginationContainer.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Poprzednia';
        prevBtn.className = 'pagination-btn';
        prevBtn.onclick = () => loadArticles(currentPage - 1);
        paginationContainer.appendChild(prevBtn);
    }
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.className = 'pagination-btn';
        firstBtn.onclick = () => loadArticles(1);
        paginationContainer.appendChild(firstBtn);
        
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-dots';
            paginationContainer.appendChild(dots);
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.onclick = () => loadArticles(i);
        paginationContainer.appendChild(pageBtn);
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-dots';
            paginationContainer.appendChild(dots);
        }
        
        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.className = 'pagination-btn';
        lastBtn.onclick = () => loadArticles(totalPages);
        paginationContainer.appendChild(lastBtn);
    }
    
    // Next button
    if (currentPage < totalPages) {
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Następna →';
        nextBtn.className = 'pagination-btn';
        nextBtn.onclick = () => loadArticles(currentPage + 1);
        paginationContainer.appendChild(nextBtn);
    }
}

// Create article element with new design
function createArticleElement(article) {
    const div = document.createElement('div');
    div.className = 'article-card';
    div.setAttribute('data-article-id', article.id); // Add data attribute for story selection
    
    const timeAgo = getTimeAgo(new Date(article.time));
    const domain = extractDomain(article.url);
    const faviconUrl = getFaviconUrl(domain);
    const articleImage = getArticleImage(article);
    
    // Format date and time
    const articleDate = new Date(article.time);
    const formattedDate = articleDate.toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    const formattedTime = articleDate.toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    div.innerHTML = `
        <div class="article-source">
            <img src="${faviconUrl}" alt="${domain}" class="source-favicon" onerror="this.style.display='none'">
            <span class="source-name">${domain}</span>
            <span class="article-date">${formattedDate} ${formattedTime}</span>
        </div>
        
        <div class="article-content">
            <div class="article-thumbnail" style="background-image: url('${articleImage}')">
                <h3 class="article-title">${escapeHtml(article.title)}</h3>
                ${article.starred ? '<span class="star-badge">Ulubione</span>' : ''}
            </div>
            
            ${article.description ? `<div class="article-description">${escapeHtml(article.description).substring(0, 200)}${article.description.length > 200 ? '...' : ''}</div>` : ''}
        </div>
        
        <div class="article-footer">
            <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer" class="article-url">
                ${escapeHtml(article.url)}
            </a>
            <button class="share-btn" onclick="shareArticle('${escapeHtml(article.url)}', '${escapeHtml(article.title)}')">
                📤 Udostępnij
            </button>
            <button class="story-btn" onclick="selectForStory(${article.id})" title="Generuj Story (Ctrl+G)">
                🎨 Story
            </button>
        </div>
    `;
    
    return div;
}

// Share article function
function shareArticle(url, title) {
    if (navigator.share) {
        navigator.share({
            title: title,
            url: url
        }).catch(console.error);
    } else {
        // Fallback to clipboard
        navigator.clipboard.writeText(url).then(() => {
            alert('Link skopiowany do schowka!');
        }).catch(() => {
            // Fallback to prompt
            prompt('Skopiuj link:', url);
        });
    }
}

// Show empty state
function showEmptyState(container, title, message) {
    container.innerHTML = `
        <div class="empty-state">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// Show error
function showError(container, message) {
    container.innerHTML = `
        <div class="empty-state">
            <h3>Błąd</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// Initialize admin panel
function initAdminPanel() {
    const form = document.getElementById('add-form');
    const messageDiv = document.getElementById('message');
    
    // Replace the form with mateoNEWS generator
    const adminPanel = document.querySelector('.admin-panel');
    adminPanel.innerHTML = `
        <h2>Generator mateoNEWS</h2>
        <div class="generator-section">
            <div class="form-group">
                <label for="article-select">Wybierz artykuł z mateoNEWS:</label>
                <select id="article-select">
                    <option value="">Ładowanie artykułów...</option>
                </select>
            </div>
            
            <div class="form-group">
                <label for="custom-url">Lub podaj własny link:</label>
                <input type="url" id="custom-url" placeholder="https://example.com/article">
            </div>
            
            <div class="form-group">
                <label for="background-select">Wybierz tło:</label>
                <select id="background-select">
                    <option value="mateoNEWS1.png">Standard</option>
                    <option value="mateoNEWSpilne.png">Pilne</option>
                    <option value="mateoNEWSwazne.png">Ważne</option>
                    <option value="mateoNEWSopinia.png">Opinia</option>
                    <option value="mateoNEWSpublicystyka.png">Publicystyka</option>
                </select>
            </div>
            
            <button type="button" onclick="generateStory()">Generuj grafikę</button>
            
            <div id="preview-container" style="margin-top: 30px; text-align: center; display: none;">
                <h3>Podgląd:</h3>
                <canvas id="story-canvas" width="1080" height="1920" style="max-width: 300px; border: 1px solid var(--border); border-radius: 8px;"></canvas>
                <br><br>
                <button type="button" onclick="downloadStory()">Pobierz grafikę</button>
            </div>
        </div>
        
        <div id="message" class="message"></div>
    `;
    
    // Load articles for selection
    loadArticlesForGenerator();
}

// Load articles for generator dropdown
async function loadArticlesForGenerator() {
    try {
        const response = await fetch('/api/articles');
        const articles = await response.json();
        
        const select = document.getElementById('article-select');
        select.innerHTML = '<option value="">-- Wybierz artykuł --</option>';
        
        articles.forEach((article, index) => {
            const option = document.createElement('option');
            option.value = JSON.stringify(article);
            option.textContent = article.title.length > 60 ? 
                article.title.substring(0, 60) + '...' : 
                article.title;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading articles for generator:', error);
    }
}

// Generate Instagram Story
async function generateStory() {
    const articleSelect = document.getElementById('article-select');
    const customUrl = document.getElementById('custom-url').value;
    const backgroundSelect = document.getElementById('background-select');
    
    let article;
    
    if (customUrl) {
        // Fetch article data from custom URL
        try {
            console.log('🔍 Fetching article from:', customUrl);
            const response = await fetch(`/api/extract-article?url=${encodeURIComponent(customUrl)}`);
            article = await response.json();
            console.log('📄 Article data received:', article);
        } catch (error) {
            console.error('❌ Error fetching article:', error);
            alert('Błąd podczas pobierania danych artykułu');
            return;
        }
    } else if (articleSelect.value) {
        const selectedArticle = JSON.parse(articleSelect.value);
        console.log('📰 Using selected article:', selectedArticle);
        
        // Re-extract article data to get fresh image (avoid Unsplash fallbacks)
        if (selectedArticle.url && selectedArticle.url.startsWith('http')) {
            try {
                console.log('🔍 Re-extracting article from:', selectedArticle.url);
                const response = await fetch(`/api/extract-article?url=${encodeURIComponent(selectedArticle.url)}`);
                article = await response.json();
                console.log('📄 Fresh article data received:', article);
            } catch (error) {
                console.warn('⚠️ Failed to re-extract, using cached article');
                article = selectedArticle;
            }
        } else {
            article = selectedArticle;
        }
    } else {
        alert('Wybierz artykuł lub podaj link');
        return;
    }
    
    const canvas = document.getElementById('story-canvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Load background
    const bgImage = new Image();
    bgImage.crossOrigin = 'anonymous';
    bgImage.onload = async () => {
        // Draw background
        ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        
        // Load article thumbnail if available
        if (article.image && article.image !== 'null' && article.image.trim() !== '') {
            console.log('🖼️ Loading article image:', article.image);
            try {
                const thumbImage = new Image();
                thumbImage.crossOrigin = 'anonymous';
                thumbImage.onload = () => {
                    console.log('✅ Article image loaded successfully');
                    // Draw thumbnail (similar to feedlizer logic)
                    const thumbHeight = 400;
                    const thumbY = canvas.height - thumbHeight - 200;
                    
                    // Calculate aspect ratio and draw
                    const aspectRatio = thumbImage.width / thumbImage.height;
                    const thumbWidth = thumbHeight * aspectRatio;
                    const thumbX = (canvas.width - thumbWidth) / 2;
                    
                    ctx.drawImage(thumbImage, thumbX, thumbY, thumbWidth, thumbHeight);
                    
                    // Draw text overlay
                    drawTextOverlay(ctx, article, canvas);
                };
                thumbImage.onerror = () => {
                    console.warn('❌ Failed to load article image:', article.image);
                    console.log('📝 Drawing story without image');
                    // Draw without thumbnail
                    drawTextOverlay(ctx, article, canvas);
                };
                const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(article.image)}`;
                console.log('🔗 Using proxy URL:', proxyUrl);
                thumbImage.src = proxyUrl;
            } catch (error) {
                console.error('❌ Error in image loading:', error);
                console.log('📝 Drawing story without image');
                // Draw without thumbnail
                drawTextOverlay(ctx, article, canvas);
            }
        } else {
            console.log('📝 No article image available, drawing story without image');
            // Draw without thumbnail
            drawTextOverlay(ctx, article, canvas);
        }
        
        // Show preview
        document.getElementById('preview-container').style.display = 'block';
    };
    
    bgImage.src = `http://x.mateopoznan.pl/${backgroundSelect.value}`;
}

// Draw text overlay on canvas
function drawTextOverlay(ctx, article, canvas) {
    // Set text properties
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // Draw title (similar to feedlizer)
    const titleFontSize = 48;
    ctx.font = `bold ${titleFontSize}px Arial, sans-serif`;
    
    const maxWidth = canvas.width - 80;
    const words = article.title.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (let word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    
    // Draw title lines
    const titleY = canvas.height - 300;
    lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, titleY + (index * 60));
    });
    
    // Draw source domain
    ctx.font = '24px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    const domain = extractDomain(article.url);
    ctx.fillText(domain, canvas.width / 2, canvas.height - 100);
}

// Download generated story
function downloadStory() {
    const canvas = document.getElementById('story-canvas');
    const link = document.createElement('a');
    link.download = `mateoNEWS_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
}

// Auto-refresh functionality for main page - DISABLED
function startAutoRefresh() {
    // Auto-refresh disabled to prevent UI interference
    return;
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'przed chwilą';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffHours < 24) return `${diffHours} godz. temu`;
    if (diffDays < 7) return `${diffDays} dni temu`;
    
    return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
});

// New enhanced story generator for grid layout - LIKE FEEDLIZER v0.5
async function generateStoryFromGrid(articleId = null) {
    let selectedCard = null;
    let article = null;
    
    if (articleId) {
        // If articleId provided, find that specific article
        article = articlesData.find(a => a.id == articleId);
        selectedCard = document.querySelector(`[data-article-id="${articleId}"]`);
        
        if (selectedCard) {
            // Remove previous selection
            document.querySelectorAll('.article-card').forEach(card => {
                card.classList.remove('selected');
            });
            // Select current article
            selectedCard.classList.add('selected');
        }
    } else {
        // If no articleId, look for already selected card
        selectedCard = document.querySelector('.article-card.selected');
        if (selectedCard) {
            const selectedId = selectedCard.dataset.articleId;
            article = articlesData.find(a => a.id == selectedId);
        }
    }
    
    // If still no article, use the first available article
    if (!article && articlesData.length > 0) {
        article = articlesData[0];
        console.log('📄 Using first available article for story generation');
    }
    
    if (!article) {
        showToast('Brak dostępnych artykułów do generowania story', 'error');
        return;
    }

    try {
        console.log('🎨 Generating story for:', article.title);
        
        // Show loading indicator
        const loadingElement = document.getElementById('story-loading');
        const previewElement = document.getElementById('story-preview');
        
        if (loadingElement) {
            loadingElement.style.display = 'block';
        }
        if (previewElement) {
            previewElement.style.display = 'none';
        }
        
        // Create canvas like in feedlizer
        const canvas = document.getElementById('story-canvas') || document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, 1080, 1920);
        
        // Load and draw background - same as feedlizer
        const selectedBg = document.body.classList.contains('dark-theme') ? 'mateoNEWS1.png' : 'Ciekawe1.png';
        const bgImage = await loadImage(`http://x.mateopoznan.pl/${selectedBg}`);
        ctx.drawImage(bgImage, 0, 0, 1080, 1920);
        
        // Load and draw article image if available - exactly like feedlizer
        if (article.image) {
            console.log('🖼️ Attempting to load article image:', article.image);
            try {
                const articleImage = await loadImage(article.image);
                console.log('🖼️ Article image loaded, dimensions:', articleImage.width, 'x', articleImage.height);
                
                // Draw image in the designated area - feedlizer style
                const imageX = 80;
                const imageY = 400;
                const imageWidth = 920;
                const imageHeight = 500;
                
                ctx.save();
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(imageX, imageY, imageWidth, imageHeight, 20);
                } else {
                    ctx.rect(imageX, imageY, imageWidth, imageHeight);
                }
                ctx.clip();
                
                // Scale and center the image - feedlizer logic
                const scale = Math.max(imageWidth / articleImage.width, imageHeight / articleImage.height);
                const scaledWidth = articleImage.width * scale;
                const scaledHeight = articleImage.height * scale;
                const offsetX = (imageWidth - scaledWidth) / 2;
                const offsetY = (imageHeight - scaledHeight) / 2;
                
                ctx.drawImage(articleImage, imageX + offsetX, imageY + offsetY, scaledWidth, scaledHeight);
                ctx.restore();
                console.log('✅ Article image drawn successfully');
            } catch (error) {
                console.warn('❌ Could not load article image:', error);
                // Draw placeholder - feedlizer style
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(80, 400, 920, 500);
                ctx.fillStyle = '#666666';
                ctx.font = '32px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('📸 Obrazek niedostępny', 540, 650);
                ctx.textAlign = 'left';
            }
        } else {
            console.log('ℹ️ No article image provided');
        }
        
        // Draw title with background - exactly like feedlizer
        ctx.font = 'bold 56px Inter, sans-serif';
        ctx.textAlign = 'left';
        
        const titleLines = wrapText(ctx, article.title, 920);
        let titleY = 1000;
        
        // Calculate title dimensions for better centering
        const titleHeight = titleLines.length * 70;
        const titleBgPadding = 25;
        const titleBgHeight = titleHeight + (titleBgPadding * 2);
        
        // Draw semi-transparent background for title (70% opacity) - feedlizer style
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(60, titleY - titleBgPadding - 35, 960, titleBgHeight, 15);
        } else {
            ctx.rect(60, titleY - titleBgPadding - 35, 960, titleBgHeight);
        }
        ctx.fill();
        
        // Draw title text (centered vertically in the background)
        ctx.fillStyle = '#FFFFFF';
        titleLines.forEach((line, index) => {
            ctx.fillText(line, 80, titleY + (index * 70));
        });
        
        // Draw description with background - feedlizer style
        if (article.description) {
            ctx.font = '32px Inter, sans-serif';
            
            const descLines = wrapText(ctx, article.description, 920);
            let descY = titleY + titleHeight + 60;
            
            // Calculate description dimensions for better centering
            const descHeight = descLines.length * 40;
            const descBgPadding = 20;
            const descBgHeight = descHeight + (descBgPadding * 2);
            
            // Draw semi-transparent background for description (70% opacity)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(60, descY - descBgPadding - 20, 960, descBgHeight, 12);
            } else {
                ctx.rect(60, descY - descBgPadding - 20, 960, descBgHeight);
            }
            ctx.fill();
            
            // Draw description text (centered vertically in the background)
            ctx.fillStyle = '#E0E0E0';
            descLines.forEach((line, index) => {
                ctx.fillText(line, 80, descY + (index * 40));
            });
        }
        
        // Draw URL if available - feedlizer style
        if (article.url) {
            const urlY = 1780;
            ctx.fillStyle = '#B0B0B0';
            ctx.font = '28px Inter, sans-serif';
            
            // Create a rounded rectangle for URL background
            const urlBg = { x: 80, y: urlY - 35, width: 920, height: 50 };
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(urlBg.x, urlBg.y, urlBg.width, urlBg.height, 10);
            } else {
                ctx.rect(urlBg.x, urlBg.y, urlBg.width, urlBg.height);
            }
            ctx.fill();
            
            // Draw URL text
            ctx.fillStyle = '#FFFFFF';
            const displayUrl = article.url.replace(/^https?:\/\//, '').substring(0, 50);
            ctx.fillText('🔗 ' + displayUrl, 100, urlY);
        }
        
        // Show preview if in admin panel
        const previewElement = document.getElementById('story-preview');
        if (previewElement) {
            previewElement.style.display = 'block';
        }
        
        // Hide loading indicator
        const loadingElement = document.getElementById('story-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        
        // Download - feedlizer style
        const link = document.createElement('a');
        link.download = `mateoNEWS_v0.5_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('✅ Story wygenerowane! Pobieranie...', 'success');
        
    } catch (error) {
        console.error('Error generating story:', error);
        showToast('Błąd podczas generowania story', 'error');
        
        // Hide loading on error
        const loadingElement = document.getElementById('story-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Helper functions from feedlizer
window.loadImage = function loadImage(src) {
    return new Promise((resolve, reject) => {
        console.log('🔄 Attempting to load image:', src);
        
        // Check if it's an external URL that needs proxying
        const needsProxy = src.startsWith('http') && 
                          !src.includes('localhost') && 
                          !src.includes('127.0.0.1') &&
                          !src.includes('x.mateopoznan.pl'); // Our backgrounds don't need proxy
        
        let imageUrl = src;
        
        if (needsProxy) {
            // Use our image proxy
            imageUrl = `/api/image-proxy?url=${encodeURIComponent(src)}`;
            console.log('🔄 Using image proxy:', imageUrl);
        }
        
        const img = new Image();
        
        // Don't set CORS for proxy requests since they're from our domain
        if (!needsProxy) {
            img.crossOrigin = 'anonymous';
        }
        
        img.onload = () => {
            console.log('✅ Image loaded successfully:', src);
            resolve(img);
        };
        
        img.onerror = (error) => {
            console.error('❌ Failed to load image:', src, error);
            
            if (needsProxy) {
                // If proxy failed, try original URL as fallback
                console.log('🔄 Proxy failed, trying original URL:', src);
                
                const fallbackImg = new Image();
                fallbackImg.crossOrigin = 'anonymous';
                
                fallbackImg.onload = () => {
                    console.log('✅ Fallback image loaded:', src);
                    resolve(fallbackImg);
                };
                
                fallbackImg.onerror = () => {
                    console.error('❌ Complete failure loading image:', src);
                    reject(new Error(`Failed to load image: ${src}`));
                };
                
                fallbackImg.src = src;
            } else {
                reject(new Error(`Failed to load image: ${src}`));
            }
        };
        
        img.src = imageUrl;
    });
}

window.wrapText = function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

// Add keyboard shortcut for story generation
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        generateStoryFromGrid();
    }
});

// Select article for story generation - mateoNEWS v0.5
function selectForStory(articleId) {
    console.log('🎯 Selecting article for story:', articleId);
    
    // Remove previous selection
    document.querySelectorAll('.article-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Select current article
    const selectedCard = document.querySelector(`[data-article-id="${articleId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Generate story immediately with the selected article ID
    setTimeout(() => {
        generateStoryFromGrid(articleId);
    }, 100);
}

// Simple toast notification - mateoNEWS v0.5
function showToast(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#ff4444' : '#44ff44'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 3000);
}


// Generate story with custom article data - mateoNEWS v0.5 FULL VERSION
window.generateStoryWithCustomArticle = async function generateStoryWithCustomArticle(article) {
    console.log('🎬 Starting generateStoryWithCustomArticle...');
    
    try {
        // Create canvas
        let canvas = document.getElementById('story-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'story-canvas';
            canvas.width = 1080;
            canvas.height = 1920;
            canvas.style.maxWidth = '300px';
            canvas.style.border = '1px solid #ccc';
            
            const previewDiv = document.getElementById('story-preview');
            if (previewDiv) {
                previewDiv.appendChild(canvas);
            } else {
                document.body.appendChild(canvas);
            }
        }
        
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            throw new Error('Cannot get 2D context from canvas');
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, 1080, 1920);
        
        // Load and draw background
        const selectedBg = article.background || 'mateoNEWS1.png';
        console.log('Loading background:', selectedBg);
        
        try {
            const bgImage = await loadImage(`http://x.mateopoznan.pl/${selectedBg}`);
            ctx.drawImage(bgImage, 0, 0, 1080, 1920);
            console.log('✅ Background drawn');
        } catch (error) {
            console.error('Background loading failed, using fallback');
            // Fallback gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
            gradient.addColorStop(0, '#1a1a1a');
            gradient.addColorStop(1, '#2d2d2d');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 1080, 1920);
            
            // Add mateoNEWS logo
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 64px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('mateoNEWS', 540, 1800);
            ctx.textAlign = 'left';
        }
        
        // Load and draw article image
        if (article.image) {
            console.log('Loading article image:', article.image);
            try {
                const articleImage = await loadImage(article.image);
                console.log('✅ Article image loaded');
                
                const imageX = 80;
                const imageY = 400;
                const imageWidth = 920;
                const imageHeight = 500;
                
                // Draw image with clipping
                ctx.save();
                ctx.beginPath();
                ctx.rect(imageX, imageY, imageWidth, imageHeight);
                ctx.clip();
                
                const scale = Math.max(imageWidth / articleImage.width, imageHeight / articleImage.height);
                const scaledWidth = articleImage.width * scale;
                const scaledHeight = articleImage.height * scale;
                const offsetX = (imageWidth - scaledWidth) / 2;
                const offsetY = (imageHeight - scaledHeight) / 2;
                
                ctx.drawImage(articleImage, imageX + offsetX, imageY + offsetY, scaledWidth, scaledHeight);
                ctx.restore();
                console.log('✅ Article image drawn');
            } catch (error) {
                console.warn('Could not load article image, drawing placeholder');
                // Draw placeholder
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(80, 400, 920, 500);
                ctx.fillStyle = '#666666';
                ctx.font = '32px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('📸 Obrazek niedostępny', 540, 650);
                ctx.textAlign = 'left';
            }
        }
        
        // Draw title with background - SIMPLIFIED
        console.log('Drawing title:', article.title);
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'left';
        
        // Truncate title if too long
        const maxTitleLength = 60;
        const displayTitle = article.title.length > maxTitleLength ? 
            article.title.substring(0, maxTitleLength) + '...' : article.title;
        
        const titleY = 1000;
        
        // Title background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(60, titleY - 60, 960, 120);
        
        // Title text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(displayTitle, 80, titleY);
        
        // Draw description - SIMPLIFIED
        if (article.description) {
            console.log('Drawing description');
            ctx.font = '32px Arial';
            
            // Truncate description
            const maxDescLength = 120;
            const displayDesc = article.description.length > maxDescLength ?
                article.description.substring(0, maxDescLength) + '...' : article.description;
            
            const descY = titleY + 120;
            
            // Description background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(60, descY - 40, 960, 80);
            
            // Description text
            ctx.fillStyle = '#E0E0E0';
            ctx.fillText(displayDesc, 80, descY);
        }
        
        // Draw URL
        if (article.url) {
            console.log('Drawing URL');
            const urlY = 1780;
            ctx.font = '28px Arial';
            
            // URL background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(80, urlY - 35, 920, 50);
            
            // URL text
            ctx.fillStyle = '#FFFFFF';
            const displayUrl = article.url.replace(/^https?:\/\//, '').substring(0, 50);
            ctx.fillText('🔗 ' + displayUrl, 100, urlY);
        }
        
        console.log('🎨 Story generation complete!');
        
        // Show preview
        const previewElement = document.getElementById('story-preview');
        if (previewElement) {
            previewElement.style.display = 'block';
        }
        
        // Auto download
        console.log('💾 Starting download...');
        const link = document.createElement('a');
        link.download = `mateoNEWS_story_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('✅ Download triggered');
        
    } catch (error) {
        console.error('❌ Error generating story:', error);
        throw error;
    }
}
