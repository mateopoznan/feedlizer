# 🔐 Feedly Session Authentication

To rozwiązanie umożliwia logowanie się do Feedly przez sesję webową i pobieranie artykułów bez płatnego API.

## 🚀 Jak to działa

1. **Logowanie sesyjne** - Aplikacja loguje się do Feedly jak zwykły użytkownik
2. **Pobieranie danych** - Używa wewnętrznych API Feedly dostępnych po zalogowaniu  
3. **Synchronizacja stanu** - Oznaczanie jako przeczytane/zapisane synchronizuje się z Feedly
4. **Cache lokalny** - Artykuły są cache'owane żeby nie przeciążać Feedly

## 🛠 Setup

### Opcja 1: Logowanie przez interfejs
1. Uruchom serwer: `node feedly-session-server.js`
2. Otwórz aplikację w przeglądarce
3. Kliknij "Potrzebuję się zalogować" gdy się pojawi
4. Wprowadź swoje dane Feedly

### Opcja 2: Automatyczne logowanie
1. Skopiuj plik example: `cp feedly-credentials.example.json feedly-credentials.json`
2. Edytuj `feedly-credentials.json`:
```json
{
  "email": "twoj-email@example.com", 
  "password": "twoje-haslo-do-feedly"
}
```
3. Uruchom serwer - automatycznie się zaloguje

## ⚡ Funkcje

### ✅ Co działa
- **Pobieranie nieczytanych artykułów** z twojego Feedly
- **Oznaczanie jako przeczytane** - synchronizuje z Feedly
- **Zapisywanie "na później"** - dodaje do Feedly Saved 
- **Sortowanie** od najnowszego do najstarszego
- **Cache artykułów** (2 minuty) żeby nie spamować Feedly
- **Auto-login** jeśli masz zapisane credentials

### 🔄 Gesty (tak jak wcześniej)
- **Swipe UP** ⬆️ - Zapisz do "Read Later" w Feedly
- **Swipe DOWN** ⬇️ - Oznacz jako przeczytane w Feedly  
- **Swipe LEFT** ⬅️ - Cofnij do poprzedniego artykułu
- **Click/Tap** - Otwórz artykuł w nowej karcie

## 🔒 Bezpieczeństwo

- **Dane lokalne** - Credentials są zapisywane tylko lokalnie
- **HTTPS** - Wszystkie połączenia z Feedly przez HTTPS
- **Session cookies** - Automatycznie zarządzane
- **Brak zewnętrznych serwisów** - Wszystko działa na twoim serwerze

## 🐛 Troubleshooting

### "Need to login first"
- Sprawdź czy `feedly-credentials.json` ma poprawne dane
- Sprawdź czy Feedly nie wymaga 2FA (może nie działać)
- Spróbuj zalogować się ręcznie przez interfejs

### "Session expired"  
- Automatycznie spróbuje ponownie się zalogować
- Jeśli to nie pomoże, usuń `feedly-credentials.json` i zaloguj się ponownie

### Brak artykułów
- Sprawdź czy masz nieczytane artykuły w Feedly
- Sprawdź logi serwera czy nie ma błędów
- Może Feedly zmieniło struktur API - będzie trzeba zaktualizować

## ⚠️ Ograniczenia

- **Może przestać działać** jeśli Feedly zmieni strukturę stron
- **2FA może nie działać** - używaj hasła aplikacji jeśli masz
- **Rate limiting** - nie spamuj requestów żeby nie zostać zablokowanym
- **Nieoficjalne** - to nie jest oficjalnie wspierane przez Feedly

## 🚀 Uruchamianie

```bash
# Development
node feedly-session-server.js

# Production z auto-restart
nodemon feedly-session-server.js

# W tle
nohup node feedly-session-server.js &
```

## 🌐 Caddy Configuration

Dodaj do Caddyfile:
```caddy
feedly.mateopoznan.pl {
    reverse_proxy localhost:12012
}
```

To rozwiązanie powinno dać Ci pełny dostęp do swoich artykułów Feedly bez płacenia za API! 🎉
