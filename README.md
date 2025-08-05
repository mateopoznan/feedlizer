# 📱 Feedlizer v0.2

> Tinder dla artykułów z Feedly - swipuj przez swoje newsy jak na randkach!

## ✨ Funkcje

- **🔥 Swipe gestures**: Przeciągnij w górę aby zapisać, w dół aby oznaczać jako przeczytane
- **⌨️ Keyboard shortcuts**: Strzałki + R do odświeżania
- **🌙 Dark theme**: Minimalistyczny, elegancki design
- **📱 Responsive**: Działa na PC i mobile
- **🎯 Toast notifications**: Feedback dla każdej akcji
- **🔐 Simple authentication**: Opcjonalne zabezpieczenie hasłem

## 🚀 Szybki start

### 1. Pobierz token z Feedly

1. Zaloguj się na [feedly.com](https://feedly.com)
2. Przejdź do [Developer Token](https://feedly.com/v3/auth/dev)
3. Skopiuj swój token

### 2. Konfiguracja

```bash
# Sklonuj repozytorium
git clone https://github.com/mateopoznan/feedlizer.git
cd feedlizer

# Skopiuj i edytuj konfigurację
cp feedly-config.example.json feedly-config.json
# Wklej swój token do feedly-config.json

# Opcjonalnie: ustaw hasło
cp auth.example.json auth.json
# Zmień hasło w auth.json
```

### 3. Uruchomienie

```bash
# Uruchom serwer (Node.js 14+ wymagany)
node feedly-token-server.js

# Otwórz w przeglądarce
# http://localhost:12012
```

## 🎮 Jak używać

### Gestures
- **Swipe ↑** lub **↑** - Zapisz do "Read Later" w Feedly
- **Swipe ↓** lub **↓** - Oznacz jako przeczytane
- **Swipe ←** lub **←** - Cofnij do poprzedniego artykułu
- **R** - Odśwież artykuły

### Przyciski
- **�** - Zapisz do Read Later
- **✅** - Oznacz jako przeczytane  
- **↩️** - Cofnij
- **🔄** - Odśwież

## ⚙️ Konfiguracja

### feedly-config.json
```json
{
    "token": "twój_feedly_token_tutaj"
}
```

### auth.json (opcjonalne)
```json
{
    "password": "twoje_hasło"
}
```

## 🔧 Mechanika

### Zapisywanie artykułów
Gdy klikniesz **Save** (💚) lub swipe w górę:
- Artykuł trafia do **Feedly "Saved for Later"** (nie Instapaper!)
- Używa oficjalnego Feedly API
- Artykuł jest dostępny w sekcji "Read Later" w Feedly

### Oznaczanie jako przeczytane
- Artykuł jest oznaczany jako przeczytany w Feedly
- Znika z głównego strumienia
- Synchronizuje się ze wszystkimi urządzeniami

## 🏗️ Architektura

```
├── feedly-token-server.js     # Główny serwer Node.js
├── public/
│   ├── index.html            # Główna aplikacja
│   ├── login.html           # Strona logowania
│   ├── app.js              # JavaScript frontend
│   └── styles.css          # Style CSS
├── feedly-config.json       # Konfiguracja API (nie w repo)
└── auth.json               # Hasło (nie w repo)
```

## 🌐 API Endpoints

- `GET /` - Główna aplikacja
- `GET /login.html` - Strona logowania
- `POST /api/login` - Uwierzytelnienie
- `GET /api/feedly/stream` - Pobierz artykuły
- `POST /api/feedly/mark-read/{id}` - Oznacz jako przeczytane
- `POST /api/instapaper/add` - Zapisz do Read Later

## 🚀 Deployment

### Z Caddy (zalecane)
```caddy
feedlizer.twoja-domena.pl {
    reverse_proxy localhost:12012
}
```

### PM2
```bash
npm install -g pm2
pm2 start feedly-token-server.js --name feedlizer
pm2 startup
pm2 save
```

## 🛠️ Wymagania

- **Node.js** 14+
- **Feedly Developer Token**
- **Nowoczesna przeglądarka** (Chrome, Firefox, Safari, Edge)

## 📱 Kompatybilność

- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

## 🤝 Contributing

1. Fork projektu
2. Stwórz branch (`git checkout -b feature/amazing-feature`)
3. Commit zmian (`git commit -m 'Add amazing feature'`)
4. Push do branch (`git push origin feature/amazing-feature`)
5. Otwórz Pull Request

## 📝 Changelog

### v0.2 (Sierpień 2025)
- 🔄 Dodano przycisk odświeżania artykułów
- 🔐 System logowania z hasłem
- 🎨 Toast notifications
- 📱 Responsywny design
- 🏷️ Zmiana nazwy na "Feedlizer"

### v0.1 (Sierpień 2025)
- 🎯 Podstawowa funkcjonalność swipe
- 🔌 Integracja z Feedly API
- 🌙 Dark theme
- ⌨️ Keyboard shortcuts

## 📄 Licencja

MIT License - zobacz [LICENSE](LICENSE) po szczegóły.

## 👤 Autor

**@mateopoznan**

---

<div align="center">
📱⚡ <strong>Feedlizer v0.2</strong> - Swipe your way through the news! ⚡📱
</div>
- 🖼️ Tło z obrazkami artykułów

## Gestures
- **Swipe UP** / **↑** - Wyślij do Instapaper
- **Swipe DOWN** / **↓** - Oznacz jako przeczytane
- **Swipe LEFT** / **←** - Cofnij do poprzedniego artykułu

## Setup

1. Zainstaluj dependencies:
```bash
npm install
```

2. Skonfiguruj zmienne środowiskowe w `.env`:
```
FEEDLY_ACCESS_TOKEN=your_feedly_token
INSTAPAPER_CONSUMER_KEY=your_instapaper_key
INSTAPAPER_CONSUMER_SECRET=your_instapaper_secret
INSTAPAPER_USERNAME=your_username
INSTAPAPER_PASSWORD=your_password
```

3. Uruchom aplikację:
```bash
npm run dev
```

## Konfiguracja API

### Feedly API
1. Idź na https://developer.feedly.com/
2. Utwórz aplikację i zdobądź access token

### Instapaper API  
1. Idź na https://www.instapaper.com/api
2. Zarejestruj aplikację i zdobądź credentials

## Technologie
- Frontend: Vanilla JavaScript, CSS3, HTML5
- Backend: Node.js, Express
- APIs: Feedly, Instapaper
