# YouTube to Drive via Codespaces API

פרויקט להורדת סרטונים מ-YouTube/Vimeo והעלאתם אוטומטית ל-Google Drive דרך GitHub Codespaces API, ללא צורך ב-SSH.

## מה זה עושה?

- יוצר codespace חדש דרך GitHub API
- מגדיר environment variables דינמיים עבור secrets
- מריץ סקריפט הורדה והעלאה אוטומטית
- עוקב אחרי הסטטוס והלוגים ללא גישה ידנית
- **חדש!** מריץ פקודות דרך HTTP Server ללא SSH
- **חדש!** מעדכן משתני סביבה בזמן אמת ללא מחיקת codespace

## דרישות

- Node.js ו-npm
- GitHub Personal Access Token עם הרשאות:
  - `codespace` - לניהול codespaces
  - `repo` - לגישה ל-repository
- Google Drive OAuth credentials (אופציונלי - אם לא מסופק, הקבצים יישמרו ב-codespace)

## התקנה

```bash
npm install
```

## שימוש

### שיטה 1: דרך Environment Variables

```bash
export GITHUB_TOKEN="your_github_token"
export GITHUB_OWNER="your_github_username"
export GITHUB_REPO="your_repository_name"

node codespace-manager.js create
node codespace-manager.js list
node codespace-manager.js start <codespace_name>
node codespace-manager.js stop <codespace_name>
node codespace-manager.js delete <codespace_name>
node codespace-manager.js status <codespace_name>
```

### שיטה 2: דרך Command Line Arguments

```bash
node codespace-manager.js create <github_token> <owner> <repo>
node codespace-manager.js list <github_token> <owner> <repo>
node codespace-manager.js start <github_token> <owner> <repo> <codespace_name>
node codespace-manager.js stop <github_token> <owner> <repo> <codespace_name>
node codespace-manager.js delete <github_token> <owner> <repo> <codespace_name>
node codespace-manager.js status <github_token> <owner> <repo> <codespace_name>
```

### דוגמאות מתקדמות

#### יצירת codespace ועקיבה אחרי הסטטוס
```bash
# יוצר codespace ומחכה שיגיע למצב Available
node codespace-manager.js create-and-watch <github_token> <owner> <repo> Available

# יוצר codespace ומחכה שיגיע למצב Shutdown
node codespace-manager.js create-and-watch <github_token> <owner> <repo> Shutdown
```

#### עקיבה אחרי סטטוס של codespace קיים
```bash
# עוקב אחרי codespace עד שיגיע למצב Available
node codespace-manager.js watch <github_token> <owner> <repo> <codespace_name> Available

# עוקב אחרי codespace עד שיגיע למצב Shutdown
node codespace-manager.js watch <github_token> <owner> <repo> <codespace_name> Shutdown
```

#### ניהול Environment Variables ו-Secrets
```bash
# הגדרת secret
node codespace-manager.js set-secret <github_token> <owner> <repo> MY_API_KEY "my_secret_value"

# הגדרת environment variable
node codespace-manager.js set-env <github_token> <owner> <repo> VIDEO_URL "https://youtube.com/watch?v=123"

# רשימת secrets
node codespace-manager.js list-secrets <github_token> <owner> <repo>

# מחיקת secret
node codespace-manager.js delete-secret <github_token> <owner> <repo> MY_API_KEY
```

#### החלת שינויי Environment Variables
```bash
# מחיקה ויצירה מחדש של codespace כדי להחיל שינויי environment variables
node codespace-manager.js recreate <github_token> <owner> <repo> <codespace_name>

# מחיקה ויצירה מחדש עם עקיבה אחרי הסטטוס
node codespace-manager.js recreate-and-watch <github_token> <owner> <repo> <codespace_name> Available
```

#### ניהול קבצים ולוגים
```bash
# העלאת קובץ ל-repository
node codespace-manager.js upload-file <github_token> <owner> <repo> <file_path> "file content"

# הורדת קובץ מ-repository
node codespace-manager.js download-file <github_token> <owner> <repo> <file_path>

# העלאת לוג
node codespace-manager.js upload-log <github_token> <owner> <repo> "Log content here" "script-name"

# רשימת קבצים ב-repository
node codespace-manager.js list-files <github_token> <owner> <repo> [path]
```

## YouTube to Drive Workflow

### הורדת סרטון והעלאה ל-Drive

```bash
# שיטה מלאה עם כל הפרמטרים
node youtube-drive-manager.js run <github_token> <owner> <repo> <video_url> [platform] [cookies] [drive_token] [drive_refresh_token] [drive_client_id] [drive_client_secret]

# שיטה מהירה (ללא Google Drive - הקובץ יישמר ב-codespace)
node youtube-drive-manager.js quick <github_token> <owner> <repo> <video_url>
```

### דוגמאות

```bash
# הורדת סרטון YouTube ללא Google Drive
node youtube-drive-manager.js quick $GITHUB_TOKEN M20291 codespaces-api-test "https://www.youtube.com/watch?v=VIDEO_ID"

# הורדה עם Google Drive
node youtube-drive-manager.js run $GITHUB_TOKEN M20291 codespaces-api-test "https://www.youtube.com/watch?v=VIDEO_ID" youtube "" $DRIVE_TOKEN $DRIVE_REFRESH_TOKEN $DRIVE_CLIENT_ID $DRIVE_CLIENT_SECRET

# הורדה מ-Vimeo
node youtube-drive-manager.js run $GITHUB_TOKEN M20291 codespaces-api-test "https://vimeo.com/VIDEO_ID" vimeo "" $DRIVE_TOKEN $DRIVE_REFRESH_TOKEN $DRIVE_CLIENT_ID $DRIVE_CLIENT_SECRET

# הורדה עם Cookies (לסרטונים מוגנים)
node youtube-drive-manager.js run $GITHUB_TOKEN M20291 codespaces-api-test "https://www.youtube.com/watch?v=VIDEO_ID" youtube "$(cat cookies.txt)" $DRIVE_TOKEN $DRIVE_REFRESH_TOKEN $DRIVE_CLIENT_ID $DRIVE_CLIENT_SECRET
```

### Cookies

לסרטונים מוגנים או פרטיים, ניתן להשתמש ב-cookies בפורמט Netscape:

```bash
# הורדת cookies עם extension
# השתמש ב-browser extension כמו "Get cookies.txt" לייצוא cookies

# העברת ה-cookies לפקודה
node youtube-drive-manager.js run $GITHUB_TOKEN M20291 codespaces-api-test "https://www.youtube.com/watch?v=VIDEO_ID" youtube "$(cat cookies.txt)" $DRIVE_TOKEN $DRIVE_REFRESH_TOKEN $DRIVE_CLIENT_ID $DRIVE_CLIENT_SECRET
```

### איך זה עובד?

1. הסקריפט מגדיר environment variables כ-secrets ב-repository
2. יוצר codespace חדש עם ה-environment variables
3. ה-codespace מריץ אוטומטית את `download_and_upload.sh`
4. הסקריפט מוריד את הסרטון עם yt-dlp
5. אם סופקו credentials ל-Google Drive, הקובץ מועלה אוטומטית
6. הלוגים מועלים ל-repository לניטור
7. ה-codespace נשאר זמין לבדיקה ידנית

### הגדרת Google Drive OAuth

1. צור project ב- [Google Cloud Console](https://console.cloud.google.com/)
2. הפעל את Google Drive API
3. צור OAuth 2.0 credentials
4. הורד את ה-credentials וקבל:
   - Client ID
   - Client Secret
   - Refresh Token (דרך OAuth playground)

## פקודות זמינות

- `create` - יוצר codespace חדש
- `create-and-watch` - יוצר codespace חדש ועוקב אחרי הסטטוס עד שמגיע למצב רצוי
- `start` - מפעיל codespace קיים
- `stop` - מפסיק codespace
- `delete` - מוחק codespace
- `list` - מציג רשימת codesspaces
- `status` - מציג סטטוס של codespace ספציפי
- `watch` - עוקב אחרי סטטוס של codespace עד שמגיע למצב רצוי
- `recreate` - מוחק ויוצר מחדש codespace (להחלת שינויי environment variables)
- `recreate-and-watch` - מוחק ויוצר מחדש codespace ועוקב אחרי הסטטוס
- `set-secret` - מגדיר secret ב-repository
- `list-secrets` - מציג רשימת secrets ב-repository
- `delete-secret` - מוחק secret מ-repository
- `set-env` - מגדיר environment variable כ-secret
- `upload-file` - מעלה קובץ ל-repository
- `download-file` - מוריד קובץ מ-repository
- `upload-log` - מעלה לוג ל-repository
- `list-files` - מציג רשימת קבצים ב-repository

## הגדרת GitHub Token

1. גש ל- https://github.com/settings/tokens
2. לחץ על "Generate new token (classic)"
3. בחר את ההרשאות הבאות:
   - `codespace` (Full control of codespaces)
   - `repo` (Full control of private repositories)
4. צור את ה-token ושמור אותו

## הערה חשובה

לפני שתוכל להשתמש בסקריפט, עליך לדחוף את הפרויקט ל-GitHub repository שברשותך, כי ה-API מחייב repository קיים.

## יתרונות הגישה הזו

- ✅ שליטה מלאה דרך API ללא SSH
- ✅ Environment variables דינמיים
- ✅ ניטור לוגים מרחוק
- ✅ ניהול secrets מוצפנים
- ✅ עקיבה אחרי סטטוס בזמן אמת
- ✅ ניקוי אוטומטי של codespaces
- ✅ **חדש!** הרצת פקודות דרך HTTP Server ללא SSH
- ✅ **חדש!** עדכון משתני סביבה בזמן אמת ללא מחיקה

## פתרון חדש ללא SSH: HTTP Command Server

### איך זה עובד?

הפתרון החדש משתמש בשרת HTTP שרץ ב-codespace ומאפשר:
1. **הרצת פקודות** דרך בקשות HTTP ללא SSH
2. **עדכון משתני סביבה** בזמן אמת ללא צורך במחיקת codespace
3. **שימוש חוזר** ב-codespace הקיים עם משתנים שונים בכל פעם

### שימוש ב-Smart Workflow Manager

```bash
# הרצת workflow מלא ללא SSH
node smart-workflow-manager.js run <github_token> <owner> <repo> <video_url> [platform] [cookies] [drive_credentials...]

# הרצת פקודה ספציפית דרך HTTP
node smart-workflow-manager.js exec-http <github_token> <owner> <repo> <codespace_name> "command"

# עדכון משתנה סביבה דרך HTTP
node smart-workflow-manager.js update-env-http <github_token> <owner> <repo> <codespace_name> VAR_NAME "value"

# בדיקת בריאות שרת HTTP
node smart-workflow-manager.js health-http <github_token> <owner> <repo> <codespace_name>
```

### דוגמה מלאה

```bash
# יצירת codespace ראשוני (פעם אחת בלבד)
node codespace-manager.js create <github_token> <owner> <repo>

# הרצת סרטון ראשון
node smart-workflow-manager.js run <github_token> <owner> <repo> "https://youtube.com/watch?v=VIDEO1"

# הרצת סרטון שני באותו codespace עם משתנים שונים
node smart-workflow-manager.js run <github_token> <owner> <repo> "https://youtube.com/watch?v=VIDEO2"

# עדכון משתנה ספציפי והרצת פקודה
node smart-workflow-manager.js update-env-http <github_token> <owner> <repo> smart-codespace VIDEO_URL "https://youtube.com/watch?v=VIDEO3"
node smart-workflow-manager.js exec-http <github_token> <owner> <repo> smart-codespace "bash /workspaces/codespaces-api-test/download_and_upload.sh"
```

### יתרונות הפתרון החדש

- **ללא SSH:** כל התקשורת דרך HTTP API
- **מהיר:** ללא צורך במחיקה ויצירה מחדש של codespace
- **גמיש:** ניתן להריץ כל פקודה דרך HTTP
- **מעקב:** בדיקת בריאות וסטטוס שרת
- **ניהול:** עדכון משתני סביבה בזמן אמת
