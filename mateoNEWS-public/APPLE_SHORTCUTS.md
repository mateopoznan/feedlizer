# Apple Shortcuts - mateoNEWS Story Generator

## 🍎 Skrót do udostępniania URL do mateoNEWS Story Generator

### ⚠️ Ważne: Skrót należy utworzyć ręcznie

Apple Shortcuts nie pozwala na automatyczną instalację plików `.shortcut` ze względów bezpieczeństwa. 
**Stwórz skrót ręcznie** używając poniższych instrukcji:

### 📱 Instrukcja krok po kroku:

#### **Krok 1: Utwórz nowy skrót**
1. Otwórz aplikację **"Skróty"** na iOS
2. Kliknij **"+"** (plus) aby utworzyć nowy skrót
3. Nadaj nazwę: **"mateoNEWS Story"**

#### **Krok 2: Dodaj akcje (dokładnie w tej kolejności)**
1. **Kliknij "Dodaj akcję"**
2. **Znajdź i dodaj "Pobierz URL z wejścia"** (Get URLs from Input)
3. **Znajdź i dodaj "Tekst"** (Text), wpisz:
   ```
   https://news.mateopoznan.pl/admin?url=
   ```
4. **Znajdź i dodaj "Połącz tekst"** (Combine Text):
   - Zostaw domyślny separator (brak)
   - Połączy automatycznie URL z poprzednich kroków
5. **Znajdź i dodaj "Otwórz URL"** (Open URLs)

#### **Krok 3: Konfiguracja udostępniania**
1. Kliknij ⚙️ **"Ustawienia"** (na górze ekranu)
2. Włącz **"Użyj z arkuszem udostępniania"** (Use with Share Sheet)
3. W sekcji **"Arkusz udostępniania"**:
   - Włącz **"URL"**
   - Wyłącz inne typy (jeśli są włączone)

#### **Krok 4: Dodaj ikonę (opcjonalnie)**
1. Kliknij obecną ikonę skrótu
2. Wybierz kolor i symbol (np. 📰, 🎨, lub 📱)

#### **Krok 5: Testowanie**
1. Otwórz **Safari**
2. Idź na dowolną stronę z artykułem (np. wiadomości)
3. Kliknij przycisk **"Udostępnij"** 📤 (na dolnym pasku)
4. Przesuń w dół i znajdź **"mateoNEWS Story"**
5. Kliknij - automatycznie otworzy się generator z URL artykułu!

---

## 🔍 **Jak wygląda prawidłowy skrót:**

```
Akcja 1: Pobierz URL z wejścia
    ↓
Akcja 2: Tekst ("https://news.mateopoznan.pl/admin?url=")
    ↓
Akcja 3: Połącz tekst (połączy powyższe)
    ↓
Akcja 4: Otwórz URL
```

## ✅ **Po utworzeniu skrótu:**
- Udostępnianie z Safari → mateoNEWS Story
- Udostępnianie z Chrome → mateoNEWS Story  
- Udostępnianie z aplikacji newsowych → mateoNEWS Story
- Udostępnianie z Twittera/Facebook → mateoNEWS Story

---

## 📋 **Szybkie kopiowanie akcji:**

### 1️⃣ Pobierz URL z wejścia (Get URLs from Input)
- Typ: **URL**
- Ustawienia: **Domyślne**

### 2️⃣ Tekst (Text)  
- Zawartość: `https://news.mateopoznan.pl/admin?url=`

### 3️⃣ Połącz tekst (Combine Text)
- Separator: **Brak** (puste pole)
- Dane wejściowe: **Automatyczne z poprzednich akcji**

### 4️⃣ Otwórz URL (Open URLs)
- URL: **Z poprzedniej akcji (połączony tekst)**

---

## 🎯 **Przykłady użycia:**

**Z Safari:**
- Otwórz artykuł → Udostępnij → "mateoNEWS Story"

**Z Chrome/Firefox:**
- Otwórz artykuł → Udostępnij → "mateoNEWS Story"

**Z aplikacji newsowych:**
- Znajdź artykuł → Udostępnij → "mateoNEWS Story"

**Z mediów społecznościowych:**
- Post z linkiem → Udostępnij → "mateoNEWS Story"

---

## ⚡ **Co się dzieje automatycznie:**

Po uruchomieniu skrótu mateoNEWS:
✅ Otwiera `news.mateopoznan.pl/admin`  
✅ Wypełnia pole URL artykułem  
✅ Pokazuje powiadomienie "URL załadowany z udostępnienia!"  
✅ Po 1 sekundzie automatycznie rozpoczyna generowanie  
✅ Pobiera tytuł, opis i obraz artykułu  
✅ Tworzy Instagram Story gotowe do udostępnienia  

---

## 🔧 **Rozwiązywanie problemów:**

**❌ Problem:** Skrót się nie pojawia w arkuszu udostępniania  
**✅ Rozwiązanie:** Sprawdź czy w ustawieniach skrótu włączone jest "Użyj z arkuszem udostępniania" i typ "URL"

**❌ Problem:** Otwiera się pusta strona generatora  
**✅ Rozwiązanie:** Sprawdź czy udostępniasz prawidłowy URL (nie plik/obraz)

**❌ Problem:** Generator nie pobiera metadanych  
**✅ Rozwiązanie:** Sprawdź połączenie internetowe, niektóre strony mogą blokować automatyczne pobieranie

**❌ Problem:** "Skrót nie może być uruchomiony"  
**✅ Rozwiązanie:** Upewnij się, że wszystkie 4 akcje są dodane w prawidłowej kolejności

---

## 📱 **Dla zaawansowanych - głosowe uruchamianie:**

1. W ustawieniach skrótu dodaj **"Fraza dla Siri"**
2. Nagraj frazę: **"mateoNEWS Story"** lub **"Utwórz story"**
3. Teraz możesz powiedzieć Siri: "mateoNEWS Story" gdy masz skopiowany URL

---

## 💡 **Wskazówka:**
Po pierwszym użyciu skrót pojawi się na górze arkusza udostępniania jako sugerowany dla artykułów newsowych!
