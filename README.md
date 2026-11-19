# wmhb enquiry page

The page people open from the link in the wmhb Instagram bio. They fill in a short letter and send it. Each enquiry lands as a new row on the **Enquiries** tab of the wmhb business tracker, with status New, and an alert email goes to the business inbox.

**Live page:** https://wmhb.co.nz (the old address, whatmyhusbandbuilds.github.io/enquire/, forwards there)

## What each file is

| File | What it does |
|---|---|
| `docs/index.html` | The page itself: header, photo, the letter, the two pickers, the sent and could-not-send screens. Text you might want to change (headline, the line under it, "what happens next") is here. |
| `docs/styles.css` | How it looks: colours, sizes, spacing. Brand colours are at the top. |
| `docs/app.js` | How it behaves: the blanks opening one after another, checking answers, saving on the phone, sending. |
| `docs/assets/` | The guestbook photo (two sizes), the favicon and the link preview picture. |
| `docs/fonts/` | Inter Tight, cut down to the letters and weights the page uses. |
| `design/` | The approved screens (F1 to F9) and the wmhb design system. Reference only, not served. |
| `assets/` | The original guestbook photo. Reference only. |

Only the `docs/` folder is published. `backend/`, `CLAUDE.md` and `START-HERE.md` stay on the laptop and are never pushed, because they name the private tracker.

## Where the enquiries go

Near the top of `docs/app.js` is this line:

```js
const ENQUIRY_ENDPOINT = 'https://script.google.com/macros/s/.../exec';
```

That is the web address of the **wmhb enquiries** Google Apps Script (its own project, separate from the wmhb app dashboard). The script is in `backend/Code.gs` on the laptop. It adds one row to the Enquiries tab and emails the alert. It never touches any other tab. The venue goes on the first line of the Message column ("Venue: Hamilton Gardens"), with their note underneath.

## Update the page

1. Change the file (or open Claude Code in this folder and say what you want, for example "change the line under the headline").
2. In a terminal in this folder, run:

   ```
   git add -A && git commit -m "what changed" && git push
   ```

3. The live page updates in about a minute. If a phone still shows the old version, close the page and open the link again.

## Update the backend (Code.gs)

**Easiest: from the laptop.** The `backend/` folder is linked to the Apps Script project (it's called "wmhb enquires" in Apps Script) with Google's `clasp` tool, signed in as the business account. Open Claude Code in this folder and say what to change, or run these in a terminal in `backend/`:

```
clasp push
clasp create-version "what changed"
clasp update-deployment AKfycbzo0kqI5dWam4mH3wij__ZmD4DDeDOioQPCmlLMHHHVSk7FdgxnQcS1rKfyBqdYhROrtg --versionNumber <the new version number>
```

The last step keeps the same web address. To unlink the laptop from Google, run `clasp logout` (or remove "clasp" under Security → Third-party connections in the Google Account).

**By hand in the browser:**

1. Open the **wmhb enquiries** project at https://script.google.com, signed in as the business Google account only (an incognito window is easiest).
2. Paste in the new code and save.
3. **Deploy → Manage deployments → pencil (edit) → Version: New version → Deploy.**

This keeps the same web address, so the page keeps working. Never use "New deployment" for an update: that makes a new address and the page would stop sending until `ENQUIRY_ENDPOINT` is changed.

To add another alert address (for example Sara's), change `ALERT_TO` in `Code.gs` (addresses separated by commas) and redeploy as above.

## The wmhb.co.nz address

- Bought on Cloudflare (renews yearly: keep auto-renew on, or the link stops working).
- Cloudflare DNS has four A records for `wmhb.co.nz` (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153) and a `www` CNAME to `whatmyhusbandbuilds.github.io`, all set to **DNS only** (grey cloud). Don't turn the orange cloud on.
- `docs/CNAME` tells GitHub Pages to serve the page at wmhb.co.nz. Don't delete it.

## Good to know

- Each letter is saved on the person's phone as they type, so a reload or a dropped connection loses nothing. It is cleared once the enquiry is sent.
- If sending fails, people can try again or tap "Copy & send as a DM", which copies their letter and opens a DM to @whatmyhusbandbuilds.
- No analytics or trackers.
