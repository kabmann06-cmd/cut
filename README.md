# Cut

A cutting app for iPhone that tracks calories, protein, training, cardio, steps and sleep, built around Friday/Saturday night shifts. It runs as a Home Screen web app, so you don't need a Mac or the App Store. Your logs stay on your phone; this repo only holds the app's code.

## 1. Put it online (GitHub Pages, about 5 minutes, free)

1. On github.com, click **New repository**, name it `cut`, set it to **Public**, and click **Create repository**.
2. Click **uploading an existing file**. Drag in **all the files inside this folder** (not the folder itself), then click **Commit changes**.
3. Go to **Settings → Pages**. Under Build and deployment, set **Deploy from a branch**, choose `main` and `/ (root)`, and click **Save**.
4. Wait about a minute. Your app will be at `https://YOUR-USERNAME.github.io/cut/`.

## 2. Install it on your iPhone

1. Open that link in **Safari**.
2. Tap **Share → Add to Home Screen**. Leave **Open as Web App** on, then tap **Add**.
3. Always open Cut from the Home Screen icon. Safari and the icon keep separate data.
4. On first launch, enter your current weight, height and body-fat estimate.

## 3. Reminders (Calendar)

1. In the **Calendar** app, tap **Calendars → Add Calendar** and name it `Cut`. This lets you hide or delete every reminder at once.
2. In **Safari**, open `https://YOUR-USERNAME.github.io/cut/reminders.ics`, tap **Add All**, and pick the **Cut** calendar.
3. Gym times default to 15:00 Mon–Thu and 11:00 Fri. To change one, open the event, tap **Edit**, change the time, and choose **Save for future events**.

| When | Reminder |
|---|---|
| Mon–Thu 08:05 / Fri 09:35 | Weigh in |
| Mon–Thu 08:30 / Fri 10:00 | Breakfast + creatine |
| 12:30 (Fri 13:15) | Lunch, ~60 g protein |
| Mon–Thu 15:00 / Fri 11:00 | Gym session + 45 min cardio |
| Mon–Thu 18:00, Sun 16:00, shift nights 05:00 | Caffeine cutoff |
| 19:30 (Fri/Sat 21:00 + pack food) | Dinner, ~50 g protein |
| Daily 20:00 | Steps check + log food |
| Mon–Thu nights 00:30 / Sun 23:00 | Wind down |
| Fri 17:45 | Pre-shift nap 18:00–20:30 |
| Fri/Sat 22:15 | Leave for work (packed meal + shake) |
| Shift nights 03:00 / 07:00 | Shift meal / shake |
| Sat 11:45 / Sun 11:45 | Day sleep 12:00–19:00 / short sleep 12:00–15:00 |
| Sun 15:15 | Sunlight + 45–60 min walk |
| Mon 08:15 | Weekly check-in in Cut |
| Every 2nd Mon 08:10 | Progress photos + waist |
| Dec 24 / Jan 1 | Maintenance week starts / cut resumes |

## 4. Steps Shortcut (Apple Health → 12k)

A web app can't read Apple Health, so a short Shortcut does it for you.

1. Open **Shortcuts**, tap **+**, and name the shortcut **Steps**. Use that exact name so the app's button can run it.
2. Add **Find Health Samples**. Set Type to **Steps** and add the filter **Start Date is Today**.
3. Add **Calculate Statistics → Sum**.
4. Add **Round Number** (Ones).
5. Add **Copy to Clipboard** (Rounded Number).
6. Add **Number** set to `12000`, then **Calculate**: Number − Rounded Number.
7. Add **If** Calculation Result **is greater than 0**. Inside it, add **Show Notification** with "[Rounded Number] steps, [Calculation Result] left". Under **Otherwise**, add **Show Notification** with "12k done".
8. Go to the **Automation** tab, tap **+**, choose **Time of Day**, set 20:00 Daily, pick **Run Immediately**, and select **Steps**. Add a second one at 22:00 if you want.

In the app, go to Today → Steps → **Run Steps Shortcut**, come back and tap **Paste**.

- If you wear an Apple Watch and the count looks doubled, add the filter **Source is** your iPhone.
- iOS can block Health reads while the phone is locked, which can make the automation fail. If that happens, add the Shortcut as a widget and tap it instead.

## 5. Backups

All your data lives on the phone. Once a week, go to **Plan → Export** and save the file to Files or iCloud Drive. On a new phone, use **Import a backup** on the first screen.

## Updating the app

1. Replace the changed files in the repo.
2. Bump `VERSION` in `sw.js` (for example to `cut-1.0.1`) so phones pick up the new files.

Once the phone has the update, the app shows **Cut updated → Reload**.

## Files

| File | What it does |
|---|---|
| `index.html`, `styles.css` | App shell and look |
| `app.js` | Routing, onboarding, events, offline setup |
| `data.js` | The program (split, swaps, cues), default foods and meals, rules |
| `logic.js` | Shift-aware schedule, weekly session queue, check-in rules, projections, body-fat math |
| `store.js` | On-phone storage, backup export/import |
| `ui.js` | Shared UI pieces |
| `view-*.js` | The five screens |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Home Screen install + offline |
| `zxing.min.js` | Barcode scanner ([ZXing](https://github.com/zxing-js/library), MIT) |
| `reminders.ics` | Calendar reminders |

Food search and barcode data come from [Open Food Facts](https://world.openfoodfacts.org) and need an internet connection. Everything else works offline.
