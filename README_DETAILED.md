# Feedly Tinder 📱

Interfejs typu "Tinder" dla artykułów z Feedly z integracją Instapaper. Przesuwaj artykuły gestem - w górę żeby zapisać do Instapaper, w dół żeby oznaczyć jako przeczytane, w lewo żeby cofnąć.

## 🚀 Funkcje

- **Interfejs typu Tinder** - intuicyjne przesuwanie kart
- **Integracja Feedly** - pobieranie najnowszych artykułów
- **Integracja Instapaper** - zapis artykułów na później
- **Responsywny design** - działa na PC i mobile
- **Ciemny motyw** - minimalistyczny design
- **Obrazy w tle** - piękne tła z artykułów

## 🛠 Instalacja

1. **Klonuj projekt**
```bash
git clone <repo-url>
cd feedly-tinder
```

2. **Zainstaluj dependencies**
```bash
npm install
```

3. **Skonfiguruj zmienne środowiskowe**
```bash
cp .env.example .env
```

4. **Skonfiguruj API (zobacz instrukcje poniżej)**

5. **Uruchom serwer**
```bash
npm start
# lub w trybie development
npm run dev
```

Aplikacja będzie dostępna na `http://localhost:12012`

## 🔑 Konfiguracja API

### Feedly API

1. **Zarejestruj się na [Feedly Developer](https://developer.feedly.com/)**
2. **Utwórz nową aplikację**
   - Kliknij "Create Application"
   - Nazwa: "Feedly Tinder"
   - Description: "Personal Tinder-like interface for Feedly"
   - Redirect URI: `http://localhost:12012/auth/callback`
3. **Skopiuj Client ID i Client Secret**
4. **Wykonaj OAuth flow**:

```bash
# 1. Otwórz w przeglądarce (zastąp YOUR_CLIENT_ID):
https://feedly.com/v3/auth/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:12012/auth/callback&scope=https://cloud.feedly.com/subscriptions&response_type=code

# 2. Po autoryzacji dostaniesz code - użyj go do pobrania tokena:
curl -X POST https://cloud.feedly.com/v3/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET", 
    "grant_type": "authorization_code",
    "redirect_uri": "http://localhost:12012/auth/callback",
    "code": "RECEIVED_CODE"
  }'
```

5. **Z odpowiedzi skopiuj `access_token` i `id` (user ID) do .env**

### Instapaper API

1. **Idź na [Instapaper API](https://www.instapaper.com/main/request_oauth_consumer_token)**
2. **Wypełnij formularz**:
   - Application name: "Feedly Tinder"
   - Description: "Personal app for saving articles"
   - Contact email: twój email
3. **Otrzymasz Consumer Key i Consumer Secret**
4. **Wykonaj OAuth 1.0 flow** (lub użyj prostszego xAuth):

```bash
# Opcja A: OAuth 1.0 (rekomendowane)
# Użyj biblioteki OAuth 1.0 lub narzędzia jak Postman

# Opcja B: xAuth (prostsze, jeśli dostępne)
curl -X POST https://www.instapaper.com/api/1/oauth/access_token \
  -u "CONSUMER_KEY:CONSUMER_SECRET" \
  -d "x_auth_mode=client_auth&x_auth_username=YOUR_INSTAPAPER_EMAIL&x_auth_password=YOUR_INSTAPAPER_PASSWORD"
```

5. **Skopiuj tokeny do .env**

## 🎮 Jak używać

### Gesty

- **Przesunięcie w górę** ⬆️ - Zapisz do Instapaper
- **Przesunięcie w dół** ⬇️ - Oznacz jako przeczytane  
- **Przesunięcie w lewo** ⬅️ - Cofnij (powrót do poprzedniego)
- **Kliknięcie/tap** - Otwórz artykuł w nowej karcie

### Klawiatura (desktop)

- **Strzałka w górę** - Zapisz do Instapaper
- **Strzałka w dół** - Oznacz jako przeczytane
- **Strzałka w lewo** - Cofnij
- **Spacja** - Otwórz artykuł

## 🌐 Konfiguracja Caddy

Dodaj do Caddyfile:

```caddy
feedly.mateopoznan.pl {
    reverse_proxy localhost:12012
}
```

## 🎨 Personalizacja

- Zmień kolory w `public/styles.css`
- Dostosuj animacje w sekcji `.card` 
- Modyfikuj layout w `public/index.html`

## 🔧 Rozwój

```bash
# Development mode z auto-reload
npm run dev

# Logi serwera
npm start

# Build dla produkcji
npm install --production
```

## 📱 Funkcje mobilne

- **Touch gestures** - pełne wsparcie dla przesuwania palcem
- **Responsive design** - automatyczne dopasowanie do ekranu
- **PWA ready** - można dodać do ekranu głównego

## 🐛 Troubleshooting

### Problem z tokenami Feedly
- Sprawdź czy token nie wygasł (ważne 30 dni)
- Upewnij się że scope zawiera wymagane uprawnienia

### Problem z Instapaper  
- Sprawdź czy xAuth jest włączony dla twojej aplikacji
- Użyj OAuth 1.0 jeśli xAuth nie działa

### Błędy CORS
- Upewnij się że server działa na porcie 12012
- Sprawdź konfigurację reverse proxy

## 📄 Licencja

MIT License - użyj jak chcesz! 🎉
