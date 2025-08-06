// Feedlizer App - Main JavaScript
console.log('🚀 app.js loaded!');

// PWA detection and link handling
function isPWA() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
}

function openExternalLink(url) {
    if (isPWA()) {
        // W PWA - otwórz w systemowej przeglądarce
        if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
            // iOS - użyj window.open, który automatycznie otworzy Safari
            window.open(url, '_blank');
        } else {
            // Android - użyj window.open z noopener
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } else {
        // W zwykłej przeglądarce - otwórz w nowej karcie
        window.open(url, '_blank');
    }
}

class Feedlizer {
    constructor() {
        console.log('🏗️ Feedlizer constructor called');
        this.articles = [];
        this.currentIndex = 0;
        this.history = [];
        this.isLoading = false;
        this.isDragging = false;
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.dragDistance = 0;
        this.originalFavicon = null;
        
        console.log('🔧 About to call init()');
        this.init();
    }

    // Badge functionality for PWA and favicon
    async updateAppBadge(count = null) {
        const unreadCount = count !== null ? count : this.getUnreadCount();
        
        // 1. PWA Badge API (Chrome/Edge on Android)
        if ('setAppBadge' in navigator) {
            try {
                if (unreadCount > 0) {
                    await navigator.setAppBadge(unreadCount);
                    console.log(`🔴 App badge set to: ${unreadCount}`);
                } else {
                    await navigator.clearAppBadge();
                    console.log('⚪ App badge cleared');
                }
            } catch (error) {
                console.log('Badge API not supported:', error);
            }
        }
        
        // 2. Favicon with badge (fallback for all browsers)
        this.updateFaviconBadge(unreadCount);
        
        // 3. Update document title
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) Feedlizer - Tinder dla artykułów`;
        } else {
            document.title = 'Feedlizer - Tinder dla artykułów';
        }
    }
    
    updateFaviconBadge(count) {
        // Store original favicon if not stored yet
        if (!this.originalFavicon) {
            const faviconLink = document.querySelector('link[rel="icon"]') || 
                              document.querySelector('link[rel="shortcut icon"]');
            if (faviconLink) {
                this.originalFavicon = faviconLink.href;
            }
        }
        
        if (count > 0) {
            // Create canvas to draw favicon with badge
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 32;
            canvas.height = 32;
            
            // Create base favicon (simple RSS icon)
            ctx.fillStyle = '#FF6600';
            ctx.fillRect(0, 0, 32, 32);
            
            // RSS circles
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(8, 24, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // RSS arcs
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(8, 24, 8, 0, Math.PI / 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(8, 24, 14, 0, Math.PI / 2);
            ctx.stroke();
            
            // Badge circle
            if (count > 0) {
                const badgeSize = count > 99 ? 16 : count > 9 ? 14 : 12;
                ctx.fillStyle = '#FF3B30';
                ctx.beginPath();
                ctx.arc(26, 6, badgeSize/2, 0, Math.PI * 2);
                ctx.fill();
                
                // Badge text
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `bold ${badgeSize > 12 ? '8px' : '9px'} sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const badgeText = count > 99 ? '99+' : count.toString();
                ctx.fillText(badgeText, 26, 6);
            }
            
            // Convert to data URL and update favicon
            const dataURL = canvas.toDataURL('image/png');
            this.setFavicon(dataURL);
        } else {
            // Restore original favicon
            if (this.originalFavicon) {
                this.setFavicon(this.originalFavicon);
            }
        }
    }
    
    setFavicon(url) {
        let faviconLink = document.querySelector('link[rel="icon"]');
        if (!faviconLink) {
            faviconLink = document.createElement('link');
            faviconLink.rel = 'icon';
            document.head.appendChild(faviconLink);
        }
        faviconLink.href = url;
    }
    
    getUnreadCount() {
        // Count remaining unread articles
        return Math.max(0, this.articles.length - this.currentIndex);
    }

    // Toast notification system
    showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✗',
            info: 'ℹ',
            warning: '⚠'
        };
        
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">${icons[type] || icons.info}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after duration
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 300);
        }, duration);
    }

    async init() {
        this.bindEvents();
        
        // Initialize badge (clear it first)
        await this.updateAppBadge(0);
        
        await this.loadArticles();
    }

    bindEvents() {
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
        
        // Visibility change - update badge when user returns to app
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateAppBadge();
            }
        });
        
        // Button events
        document.getElementById('back-btn').addEventListener('click', this.goBack.bind(this));
        document.getElementById('read-btn').addEventListener('click', this.markAsRead.bind(this));
        document.getElementById('save-btn').addEventListener('click', this.saveToInstapaper.bind(this));
        document.getElementById('refresh-btn').addEventListener('click', this.refreshArticles.bind(this));
        document.getElementById('load-more-btn').addEventListener('click', this.loadMoreArticles.bind(this));
        
        // Touch/Mouse events will be bound to individual cards
        this.bindCardEvents();
    }

    bindCardEvents() {
        const cardStack = document.getElementById('card-stack');
        
        // Mouse events
        cardStack.addEventListener('mousedown', this.handlePointerStart.bind(this));
        cardStack.addEventListener('mousemove', this.handlePointerMove.bind(this));
        cardStack.addEventListener('mouseup', this.handlePointerEnd.bind(this));
        cardStack.addEventListener('mouseleave', this.handlePointerEnd.bind(this));
        
        // Touch events
        cardStack.addEventListener('touchstart', this.handlePointerStart.bind(this), { passive: false });
        cardStack.addEventListener('touchmove', this.handlePointerMove.bind(this), { passive: false });
        cardStack.addEventListener('touchend', this.handlePointerEnd.bind(this));
    }

    async loadArticles(count = 200) {
        this.showLoading(true);
        
        try {
            console.log('🔄 Fetching articles from API...');
            const response = await fetch(`/api/feedly/stream?count=${count}`);
            console.log('📡 Response status:', response.status);
            console.log('📡 Response headers:', response.headers);
            
            if (!response.ok) {
                console.error('❌ Response not OK:', response.status, response.statusText);
                if (response.status === 401) {
                    // Need to login
                    const errorData = await response.json();
                    if (errorData.needLogin) {
                        this.showLoading(false);
                        showLoginModal();
                        return;
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log('📥 Parsing JSON...');
            const data = await response.json();
            console.log('✅ Received data:', data);
            console.log('📊 Articles count:', data.items ? data.items.length : 'NO ITEMS');
            console.log('📋 Data structure check:', {
                hasItems: !!data.items,
                isArray: Array.isArray(data.items),
                dataKeys: Object.keys(data)
            });
            
            // Check if we need to login
            if (data.needLogin) {
                this.showLoading(false);
                showLoginModal();
                return;
            }
            
            // Sort articles from newest to oldest (already sorted by server, but double-check)
            this.articles = (data.items || []).sort((a, b) => new Date(b.published) - new Date(a.published));
            
            if (this.articles.length === 0) {
                console.warn('⚠️ No articles found');
                this.showToast('📭 Brak nowych artykułów do wyświetlenia', 'info');
                this.showError('Brak nowych artykułów do wyświetlenia.');
                return;
            }

            console.log('🎯 Setting up articles:', this.articles.length);
            this.currentIndex = 0;
            console.log('🔧 About to call renderCards()...');
            try {
                this.renderCards();
                console.log('✅ renderCards() completed successfully');
            } catch (renderError) {
                console.error('� Error in renderCards():', renderError);
                throw new Error(`renderCards failed: ${renderError.message}`);
            }
            
            console.log('�📊 About to call updateStats()...');
            try {
                this.updateStats();
                console.log('✅ updateStats() completed successfully');
            } catch (statsError) {
                console.error('💥 Error in updateStats():', statsError);
                // Continue even if stats fail
            }
            console.log('🔄 About to hide loading screen...');
            this.showLoading(false);
            console.log('🎉 About to show success toast...');
            this.showToast(`📚 Załadowano ${this.articles.length} artykułów`, 'success');
            
            // Update app badge with unread count
            await this.updateAppBadge();
            
            console.log('✅ loadArticles() completed successfully!');

        } catch (error) {
            console.error('💥 Error loading articles:', error);
            console.error('💥 Error stack:', error.stack);
            console.error('💥 Error name:', error.name);
            console.error('💥 Error message:', error.message);
            
            // Show detailed error information
            this.showToast(`❌ Błąd: ${error.message}`, 'error');
            this.showError(`Błąd JavaScript: ${error.message}`);
            
            // Also try to show loading screen off in case it's stuck
            setTimeout(() => {
                this.showLoading(false);
            }, 100);
        }
    }

    renderCards() {
        console.log('🎨 renderCards() START');
        console.log('🔢 articles.length:', this.articles.length);
        console.log('🎯 currentIndex:', this.currentIndex);
        console.log('📋 First few articles:', this.articles.slice(0, 3).map(a => ({
            id: a.id,
            title: a.title?.substring(0, 50) + '...',
            hasTitle: !!a.title,
            hasId: !!a.id
        })));
        
        const cardStack = document.getElementById('card-stack');
        if (!cardStack) {
            console.error('❌ card-stack element not found!');
            throw new Error('card-stack element not found');
        }
        console.log('✅ card-stack element found');
        
        try {
            cardStack.innerHTML = '';
            console.log('✅ cardStack cleared');
        } catch (clearError) {
            console.error('💥 Error clearing cardStack:', clearError);
            throw clearError;
        }
        
        // Render current and next few cards for smooth transitions
        console.log('🔄 About to render cards, currentIndex:', this.currentIndex);
        const cardsToRender = Math.min(3, this.articles.length - this.currentIndex);
        console.log('📊 Will render', cardsToRender, 'cards');
        
        for (let i = 0; i < cardsToRender; i++) {
            const articleIndex = this.currentIndex + i;
            const article = this.articles[articleIndex];
            console.log(`🎯 Creating card ${i} for article ${articleIndex}:`, {
                title: article?.title?.substring(0, 50) + '...',
                id: article?.id,
                hasRequiredFields: !!(article?.id && article?.title)
            });
            
            try {
                const card = this.createCard(article, i);
                if (card) {
                    cardStack.appendChild(card);
                    console.log(`✅ Card ${i} added successfully`);
                } else {
                    console.error(`❌ Card ${i} creation returned null/undefined`);
                }
            } catch (error) {
                console.error(`💥 Error creating card ${i}:`, error);
                console.error('🔍 Problematic article:', article);
                // Skip this article and continue with next
                continue;
            }
        }
        
        console.log('✅ renderCards() COMPLETED');
    }

    createCard(article, stackIndex = 0) {
        // Validate article data
        if (!article || !article.id) {
            console.error('❌ Invalid article data:', article);
            return null;
        }
        
        console.log('🔧 Creating card for article:', {
            id: article.id,
            title: article.title,
            hasTitle: !!article.title,
            hasOrigin: !!article.origin,
            hasSummary: !!article.summary,
            hasPublished: !!article.published
        });
        
        const card = document.createElement('div');
        card.className = 'article-card';
        card.style.zIndex = 10 - stackIndex;
        card.style.transform = `scale(${1 - stackIndex * 0.05}) translateY(${stackIndex * 10}px)`;
        card.dataset.articleId = article.id;
        
        // Get a good summary
        let summary = '';
        try {
            if (article.summary && article.summary.content) {
                summary = article.summary.content.replace(/<[^>]*>/g, '').trim();
            } else if (article.summary) {
                summary = String(article.summary).replace(/<[^>]*>/g, '').trim();
            }
            
            if (summary.length > 300) {
                summary = summary.substring(0, 300) + '...';
            }
        } catch (error) {
            console.error('❌ Error processing summary:', error, 'for article:', article.id);
            summary = 'Brak opisu artykułu.';
        }

        // Format date
        let publishedDate = 'Nieznana data';
        try {
            publishedDate = article.published ? 
                new Date(article.published).toLocaleDateString('pl-PL', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'Nieznana data';
        } catch (error) {
            console.error('❌ Error formatting date:', error, 'for article:', article.id);
            publishedDate = 'Nieznana data';
        }
        
        // Get image URL
        const imageUrl = article.visual?.url || article.visual;
        
        // Add click handler to open article
        const articleUrl = article.originUrl || article.canonicalUrl || article.alternate?.[0]?.href;
        console.log('Article URL:', articleUrl, 'from article:', {
            originUrl: article.originUrl,
            canonicalUrl: article.canonicalUrl,
            alternate: article.alternate
        });
        
        card.innerHTML = `
            ${imageUrl ? `<div class="card-background" style="background-image: url('${imageUrl}')"></div>` : ''}
            <div class="card-content">
                <div class="card-meta">
                    <div class="article-source">
                        📰 ${article.origin?.title || 'Nieznane źródło'}
                    </div>
                    <h2 class="article-title">${article.title || 'Bez tytułu'}</h2>
                    ${summary ? `<p class="article-summary">${summary}</p>` : ''}
                    <div class="article-date">${publishedDate}</div>
                    ${articleUrl ? `<button class="open-article-btn" onclick="openExternalLink('${articleUrl}'); event.stopPropagation();">🔗 Otwórz artykuł</button>` : ''}
                </div>
            </div>
        `;
        
        // Add click handler to open article in new tab
        if (articleUrl) {
            console.log('Adding click handler for:', articleUrl);
            
            let startTime = 0;
            let wasDragged = false;
            
            card.addEventListener('mousedown', (e) => {
                startTime = Date.now();
                wasDragged = false;
            });
            
            card.addEventListener('mousemove', (e) => {
                if (startTime > 0) {
                    wasDragged = true;
                }
            });
            
            card.addEventListener('mouseup', (e) => {
                const duration = Date.now() - startTime;
                console.log('Mouse up - duration:', duration, 'wasDragged:', wasDragged);
                
                // Consider it a click if it was quick and not dragged
                if (duration < 300 && !wasDragged) {
                    console.log('Opening article:', articleUrl);
                    openExternalLink(articleUrl);
                    this.showToast('🔗 Artykuł otwarty w przeglądarce', 'info');
                }
                
                startTime = 0;
                wasDragged = false;
            });
            
            // Touch events for mobile
            card.addEventListener('touchstart', (e) => {
                startTime = Date.now();
                wasDragged = false;
            });
            
            card.addEventListener('touchmove', (e) => {
                if (startTime > 0) {
                    wasDragged = true;
                }
            });
            
            card.addEventListener('touchend', (e) => {
                const duration = Date.now() - startTime;
                console.log('Touch end - duration:', duration, 'wasDragged:', wasDragged);
                
                // Consider it a tap if it was quick and not dragged
                if (duration < 300 && !wasDragged) {
                    console.log('Opening article:', articleUrl);
                    openExternalLink(articleUrl);
                    this.showToast('🔗 Artykuł otwarty w przeglądarce', 'info');
                }
                
                startTime = 0;
                wasDragged = false;
            });
            
            card.style.cursor = 'pointer';
        }
        
        return card;
    }

    handleKeyboard(e) {
        if (this.isLoading || this.articles.length === 0) return;
        
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                this.saveToInstapaper();
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.markAsRead();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.goBack();
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                this.refreshArticles();
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                this.loadMoreArticles();
                break;
        }
    }

    handlePointerStart(e) {
        if (this.isLoading || this.articles.length === 0) return;
        
        const card = e.target.closest('.article-card');
        if (!card || card !== document.querySelector('.article-card')) return;
        
        e.preventDefault();
        this.isDragging = true;
        this.dragDistance = 0;
        card.classList.add('dragging');
        
        const pointer = e.type.includes('touch') ? e.touches[0] : e;
        this.startPos = { x: pointer.clientX, y: pointer.clientY };
        this.currentPos = { x: 0, y: 0 };
    }

    handlePointerMove(e) {
        if (!this.isDragging) return;
        
        e.preventDefault();
        const card = document.querySelector('.article-card.dragging');
        if (!card) return;
        
        const pointer = e.type.includes('touch') ? e.touches[0] : e;
        this.currentPos = {
            x: pointer.clientX - this.startPos.x,
            y: pointer.clientY - this.startPos.y
        };
        
        // Calculate drag distance
        this.dragDistance = Math.sqrt(this.currentPos.x ** 2 + this.currentPos.y ** 2);
        
        const rotation = this.currentPos.x * 0.1;
        const opacity = 1 - Math.abs(this.currentPos.x) / 300;
        
        card.style.transform = `translate(${this.currentPos.x}px, ${this.currentPos.y}px) rotate(${rotation}deg)`;
        card.style.opacity = Math.max(0.5, opacity);
        
        // Visual feedback for actions
        this.updateActionFeedback();
    }

    handlePointerEnd(e) {
        if (!this.isDragging) return;
        
        const card = document.querySelector('.article-card.dragging');
        if (!card) return;
        
        this.isDragging = false;
        card.classList.remove('dragging');
        
        // Don't reset dragDistance here - we need it for click detection
        
        const threshold = 100;
        const absX = Math.abs(this.currentPos.x);
        const absY = Math.abs(this.currentPos.y);
        
        // Determine action based on swipe direction
        if (absY > threshold && absY > absX) {
            if (this.currentPos.y < -threshold) {
                this.saveToInstapaper();
            } else if (this.currentPos.y > threshold) {
                this.markAsRead();
            } else {
                this.resetCard(card);
            }
        } else if (absX > threshold) {
            if (this.currentPos.x < -threshold) {
                this.goBack(); // Swipe LEFT = Go Back
            } else if (this.currentPos.x > threshold) {
                this.goBack(); // Swipe RIGHT = Go Back too (for convenience)
            } else {
                this.resetCard(card);
            }
        } else {
            this.resetCard(card);
        }
    }

    resetCard(card) {
        card.style.transform = '';
        card.style.opacity = '';
        
        // Reset drag distance after a short delay to allow click detection
        setTimeout(() => {
            this.dragDistance = 0;
        }, 100);
    }

    updateActionFeedback() {
        const threshold = 50;
        const buttons = {
            'save-btn': this.currentPos.y < -threshold,
            'read-btn': this.currentPos.y > threshold,
            'back-btn': Math.abs(this.currentPos.x) > threshold // Both left AND right swipe show back button feedback
        };
        
        Object.entries(buttons).forEach(([id, active]) => {
            const btn = document.getElementById(id);
            if (active) {
                btn.style.transform = 'scale(1.1)';
                btn.style.boxShadow = '0 0 20px currentColor';
            } else {
                btn.style.transform = '';
                btn.style.boxShadow = '';
            }
        });
    }

    async saveToInstapaper() {
        if (this.currentIndex >= this.articles.length) return;
        
        const article = this.articles[this.currentIndex];
        this.animateCard('up');
        
        try {
            // Save to Read Later
            const saveResponse = await fetch('/api/instapaper/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: article.id,
                    url: article.originUrl || article.canonicalUrl,
                    title: article.title,
                    description: article.summary?.content || article.summary
                })
            });
            
            if (!saveResponse.ok) {
                throw new Error('Failed to save article');
            }

            // Mark as read simultaneously
            const readResponse = await fetch(`/api/feedly/mark-read/${encodeURIComponent(article.id)}`, {
                method: 'POST'
            });

            if (readResponse.ok) {
                this.showToast('📚 Zapisano i oznaczono jako przeczytane!', 'success');
            } else {
                // Even if marking as read fails, show success for save
                this.showToast('📚 Zapisano do "Read Later"!', 'success');
                console.warn('Article saved but failed to mark as read');
            }
            
        } catch (error) {
            console.error('Error saving article:', error);
            this.showToast('❌ Błąd podczas zapisywania', 'error');
        }
        
        this.nextArticle();
        
        // Update badge after saving to Instapaper
        await this.updateAppBadge();
    }

    async markAsRead() {
        if (this.currentIndex >= this.articles.length) return;
        
        const article = this.articles[this.currentIndex];
        this.animateCard('down');
        
        try {
            const response = await fetch(`/api/feedly/mark-read/${encodeURIComponent(article.id)}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.showToast('✅ Oznaczono jako przeczytane', 'success');
            } else {
                throw new Error('Failed to mark as read');
            }
        } catch (error) {
            console.error('Error marking as read:', error);
            this.showToast('❌ Błąd podczas oznaczania', 'error');
        }
        
        this.nextArticle();
        
        // Update badge after marking as read
        await this.updateAppBadge();
    }

    goBack() {
        if (this.history.length === 0) {
            this.showToast('ℹ️ Brak artykułów do cofnięcia', 'info');
            return;
        }
        
        this.currentIndex = this.history.pop();
        this.animateCard('left');
        
        setTimeout(() => {
            this.renderCards();
            this.updateStats();
        }, 250);
        
        this.showToast('↩️ Cofnięto do poprzedniego', 'info');
    }

    async refreshArticles() {
        if (this.isLoading) {
            this.showToast('⏳ Oczekuj, już ładuję...', 'warning');
            return;
        }
        
        this.showToast('🔄 Odświeżanie artykułów...', 'info');
        this.currentIndex = 0;
        this.history = [];
        
        await this.loadArticles();
    }

    async loadMoreArticles() {
        if (this.isLoading) {
            this.showToast('⏳ Oczekuj, już ładuję...', 'warning');
            return;
        }
        
        this.showToast('📦 Ładuję więcej artykułów...', 'info');
        this.currentIndex = 0;
        this.history = [];
        
        await this.loadArticles(400); // Load more articles
    }

    nextArticle() {
        this.history.push(this.currentIndex);
        this.currentIndex++;
        
        setTimeout(() => {
            if (this.currentIndex >= this.articles.length) {
                this.showCompleted();
            } else {
                this.renderCards();
                this.updateStats();
            }
        }, 500);
    }

    animateCard(direction) {
        const card = document.querySelector('.article-card');
        if (!card) return;
        
        card.classList.add(`swiped-${direction}`);
    }

    updateStats() {
        const remaining = this.articles.length - this.currentIndex;
        document.getElementById('remaining-count').textContent = remaining;
        
        // Update buttons state
        document.getElementById('back-btn').disabled = this.history.length === 0;
    }

    showCompleted() {
        document.getElementById('main-content').innerHTML = `
            <div class="error-content">
                <h2>🎉 Świetna robota!</h2>
                <p>Przejrzałeś wszystkie artykuły!</p>
                <button class="retry-btn" onclick="location.reload()">Załaduj więcej</button>
            </div>
        `;
    }

    showLoading(show) {
        console.log('🔄 showLoading called with:', show);
        const loadingScreen = document.getElementById('loading-screen');
        const mainContent = document.getElementById('main-content');
        
        if (!loadingScreen) {
            console.error('❌ loading-screen element not found!');
            return;
        }
        if (!mainContent) {
            console.error('❌ main-content element not found!');
            return;
        }
        
        if (show) {
            console.log('📱 Showing loading screen, hiding main content');
            loadingScreen.style.display = 'flex';
            mainContent.style.display = 'none';
        } else {
            console.log('📱 Hiding loading screen, showing main content');
            loadingScreen.style.display = 'none';
            mainContent.style.display = 'flex';
        }
        
        console.log('✅ showLoading completed:', {
            loadingDisplay: loadingScreen.style.display,
            mainDisplay: mainContent.style.display
        });
    }

    showError(message) {
        console.log('💥 showError called with:', message);
        const errorScreen = document.getElementById('error-screen');
        const errorMessage = document.getElementById('error-message');
        const mainContent = document.getElementById('main-content');
        const loadingScreen = document.getElementById('loading-screen');
        
        if (!errorScreen || !errorMessage || !mainContent || !loadingScreen) {
            console.error('❌ Some error screen elements not found:', {
                errorScreen: !!errorScreen,
                errorMessage: !!errorMessage,
                mainContent: !!mainContent,
                loadingScreen: !!loadingScreen
            });
            return;
        }
        
        errorMessage.textContent = message;
        errorScreen.style.display = 'flex';
        mainContent.style.display = 'none';
        loadingScreen.style.display = 'none';
        
        console.log('📱 Error screen shown, other screens hidden');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.feedlizer = new Feedlizer();
});

// Global function for retry button
function loadArticles() {
    if (window.feedlyTinder) {
        window.feedlyTinder.loadArticles();
    }
}

// Login functionality
function setupLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const loginForm = document.getElementById('loginForm');
    
    if (!loginModal || !loginForm) return;
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('emailInput').value;
        const password = document.getElementById('passwordInput').value;
        
        if (!email || !password) return;
        
        try {
            // Show loading
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Logowanie...';
            submitBtn.disabled = true;
            
            const response = await fetch('/api/feedly/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                // Success - hide modal and load articles
                loginModal.classList.add('hidden');
                if (window.feedlyTinder) {
                    window.feedlyTinder.loadArticles();
                }
            } else {
                alert('Błąd logowania: ' + result.error);
            }
            
        } catch (error) {
            alert('Błąd połączenia: ' + error.message);
        } finally {
            // Reset button
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Zaloguj się';
            submitBtn.disabled = false;
        }
    });
}

// Show login modal when needed
function showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.remove('hidden');
    }
}

// Setup on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 DOM loaded, setting up application...');
    setupLoginModal();
    
    // Initialize Feedlizer app
    console.log('🚀 Creating Feedlizer instance...');
    window.feedlyTinder = new Feedlizer();
    console.log('✅ Feedlizer instance created and assigned to window.feedlyTinder');
});
