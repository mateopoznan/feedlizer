// Feedlizer App - Main JavaScript
class Feedlizer {
    constructor() {
        this.articles = [];
        this.currentIndex = 0;
        this.history = [];
        this.isLoading = false;
        this.isDragging = false;
        this.startPos = { x: 0, y: 0 };
        this.currentPos = { x: 0, y: 0 };
        this.dragDistance = 0;
        
        this.init();
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
        await this.loadArticles();
    }

    bindEvents() {
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
        
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
            const response = await fetch(`/api/feedly/stream?count=${count}`);
            
            if (!response.ok) {
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
            
            const data = await response.json();
            
            // Check if we need to login
            if (data.needLogin) {
                this.showLoading(false);
                showLoginModal();
                return;
            }
            
            // Sort articles from newest to oldest (already sorted by server, but double-check)
            this.articles = (data.items || []).sort((a, b) => new Date(b.published) - new Date(a.published));
            
            if (this.articles.length === 0) {
                this.showToast('📭 Brak nowych artykułów do wyświetlenia', 'info');
                this.showError('Brak nowych artykułów do wyświetlenia.');
                return;
            }

            this.currentIndex = 0;
            this.renderCards();
            this.updateStats();
            this.showLoading(false);
            this.showToast(`📚 Załadowano ${this.articles.length} artykułów`, 'success');

        } catch (error) {
            console.error('Error loading articles:', error);
            this.showToast('❌ Błąd podczas ładowania artykułów', 'error');
            this.showError('Nie udało się załadować artykułów. Sprawdź połączenie z Feedly.');
        }
    }

    renderCards() {
        const cardStack = document.getElementById('card-stack');
        cardStack.innerHTML = '';
        
        // Render current and next few cards for smooth transitions
        for (let i = 0; i < Math.min(3, this.articles.length - this.currentIndex); i++) {
            const articleIndex = this.currentIndex + i;
            const article = this.articles[articleIndex];
            const card = this.createCard(article, i);
            cardStack.appendChild(card);
        }
    }

    createCard(article, stackIndex = 0) {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.style.zIndex = 10 - stackIndex;
        card.style.transform = `scale(${1 - stackIndex * 0.05}) translateY(${stackIndex * 10}px)`;
        card.dataset.articleId = article.id;
        
        // Get a good summary
        let summary = '';
        if (article.summary && article.summary.content) {
            summary = article.summary.content.replace(/<[^>]*>/g, '').trim();
        } else if (article.summary) {
            summary = article.summary.replace(/<[^>]*>/g, '').trim();
        }
        
        if (summary.length > 300) {
            summary = summary.substring(0, 300) + '...';
        }
        
        // Format date
        const publishedDate = article.published ? 
            new Date(article.published).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Nieznana data';
        
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
                    ${articleUrl ? `<button class="open-article-btn" onclick="window.open('${articleUrl}', '_blank'); event.stopPropagation();">🔗 Otwórz artykuł</button>` : ''}
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
                    window.open(articleUrl, '_blank');
                    this.showToast('🔗 Artykuł otwarty w nowej karcie', 'info');
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
                    window.open(articleUrl, '_blank');
                    this.showToast('🔗 Artykuł otwarty w nowej karcie', 'info');
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
                this.goBack();
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
            'back-btn': this.currentPos.x < -threshold
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
        const loadingScreen = document.getElementById('loading-screen');
        const mainContent = document.getElementById('main-content');
        
        if (show) {
            loadingScreen.style.display = 'flex';
            mainContent.style.display = 'none';
        } else {
            loadingScreen.style.display = 'none';
            mainContent.style.display = 'flex';
        }
    }

    showError(message) {
        const errorScreen = document.getElementById('error-screen');
        const errorMessage = document.getElementById('error-message');
        const mainContent = document.getElementById('main-content');
        const loadingScreen = document.getElementById('loading-screen');
        
        errorMessage.textContent = message;
        errorScreen.style.display = 'flex';
        mainContent.style.display = 'none';
        loadingScreen.style.display = 'none';
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
    setupLoginModal();
});
