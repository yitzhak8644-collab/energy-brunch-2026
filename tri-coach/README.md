# מאמן טריאתלון אדפטיבי (PWA)

אפליקציה אישית בעברית (RTL) שבונה תוכנית אימונים לטריאתלון אולימפי (1.5 / 40 / 10 ק״מ) ומתאימה אותה לפי מה שנרשם בפועל.
Local-first: אין שרת. הנתונים נשמרים ב-IndexedDB של הדפדפן.

## הרצה
```bash
npm install
npm run dev        # פיתוח
npm test           # בדיקות המנוע והסטור
npm run build      # בנייה + PWA
npm run preview    # הגשת הבנייה (מומלץ לבדיקת אופליין)
```

## מבנה
- `src/engine/` — מנוע טהור (ללא React/רשת/DOM; `today` מועבר כפרמטר): `periodize` (שלבים), `volume` (נפח ומגבלות עומס), `zones`, `templates` + `generate` (אימונים כ-`WorkoutStep[]`), `adapt` (התאמה לפי רישומים), `calibrate` (כיול מהיסטוריה), `toFit` (ייצוא אימון ל-FIT).
- `src/store/` — Zustand + `StorageAdapter` (`storage.ts`). IndexedDB הוא מימוש אחד; מעבר ל-Supabase = מימוש נוסף של אותו ממשק. לכל רשומה יש `userId` (ברירת מחדל `me`).
- `src/lib/fitImport.ts` — פענוח קבצי FIT/ZIP (טעינה עצלה).
- `src/features/` — מסכים: onboarding, היום, שבוע, תוכנית, הגדרות.

## Garmin (שלב 1, ללא API)
- **כיול:** הגדרות ← "ייבוא קבצי FIT / ZIP". מייצאים מ-Garmin Connect (אתר) ← הגדרות ← ניהול נתונים ← ייצוא. 6 החודשים האחרונים מכיילים קצב שחייה, רכיבה, 5K/10K ונפח שבועי (הערכות — אפשר לתקן).
- **לשעון:** בכרטיס האימון לחץ "FIT" והעתק את הקובץ לתיקיית `GARMIN/NewFiles` בשעון (כבל USB). אימון Brick מיוצא כשני קבצים (אופניים, ריצה).
- **בעתיד:** ממשק סנכרון לחיבור Intervals.icu (לא ממומש).

## עיצוב
פונטים self-hosted: Rubik (כותרות/מספרים) ו-Heebo (גוף) דרך `@fontsource-variable`. מצב כהה/בהיר לפי המערכת. מאפיינים לוגיים של Tailwind (`ms-`/`ps-`/`start-`).

> הנחיות כלליות בלבד ואינן ייעוץ רפואי.
