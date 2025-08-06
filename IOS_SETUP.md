# 📱 Feedlizer iOS App Setup

## Opcja 1: PWA (Najprostsze - już gotowe!)

1. **Otwórz Safari na iPhone**
2. **Idź na feedly.mateopoznan.pl**
3. **Kliknij przycisk "Share" (kwadrat ze strzałką)**
4. **Wybierz "Add to Home Screen"**
5. **Gotowe! Masz natywną ikonę aplikacji**

✅ **Zalety PWA:**
- Działa jak natywna aplikacja
- Pełny ekran, bez paska Safari
- Ikona na home screen
- Offline cache (można dodać)
- Push notifications (można dodać)

## Opcja 2: Capacitor (Bardziej zaawansowane)

### Wymagania:
- macOS z Xcode
- iPhone/iPad do testów
- Free Apple ID

### Setup:
```bash
# 1. Zainstaluj Capacitor
npm install -g @capacitor/cli
npm install @capacitor/core @capacitor/ios

# 2. Zainicjalizuj projekt
npx cap init "Feedlizer" "com.mateopoznan.feedlizer"

# 3. Skonfiguruj web assets
npx cap add ios
npx cap copy
npx cap sync

# 4. Otwórz w Xcode
npx cap open ios
```

### W Xcode:
1. **Połącz iPhone przez USB**
2. **Wybierz swoje urządzenie jako target**
3. **Zmień Bundle Identifier** na unikalny (np. com.twojnazwa.feedlizer)
4. **Zaloguj się swoim Apple ID** w Xcode -> Preferences -> Accounts
5. **Kliknij "Build and Run"**
6. **Na iPhone: Settings -> General -> VPN & Device Management**
7. **Trust developer certificate**

✅ **Zalety Capacitor:**
- Natywna aplikacja w App Store (gdybyś chciał)
- Pełny dostęp do iOS API
- Haptic feedback, Face ID, itp.
- Offline-first architecture
- Background sync

## Opcja 3: Expo (React Native)

Jeśli chciałbyś przepisać na React Native:
```bash
npx create-expo-app@latest feedlizer-mobile
# Przepisz logikę z JavaScript na React Native
```

## 🎯 Moja rekomendacja:

**Zacznij od PWA** - już masz gotową aplikację!
1. Dodaj manifest.json (✅ zrobione)
2. Przetestuj na iPhone
3. Jeśli chcesz więcej - przejdź na Capacitor

**PWA na iOS daje ci:**
- Pełnoekranową aplikację
- Offline cache (Service Worker)
- Push notifications
- Home screen icon
- App-like experience

Chcesz żebym pomógł z którąś opcją?
