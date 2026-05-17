# Form Autofill Extension

A smart Chrome extension that learns from forms you fill and auto-completes similar fields across the web. Completely free and runs locally on your machine.

## Features

✅ **Learn from any form** — Fill a form once, extension asks to save your data  
✅ **Smart matching** — Recognizes field names, labels, and types  
✅ **One-click autofill** — Click the green indicator to fill matched fields  
✅ **Bulk autofill** — Fill all detected fields on a page instantly  
✅ **Secure storage** — All data stored locally in Chrome, never uploaded  
✅ **Import/Export** — Backup and transfer your saved fields as JSON  
✅ **No external API** — Works completely offline

## Installation

### Step 1: Get the Code

Clone or download this repository to your computer:
```bash
git clone <repo-url>
cd form-autofill-extension
```

Or just copy these files into a folder:
- `manifest.json`
- `content-script.js`
- `popup.html`
- `popup.js`
- `background.js`

### Step 2: Load Extension into Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Turn on **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the folder containing your extension files
5. Done! The extension is now active

You should see the extension icon in your toolbar.

## How to Use

### Saving Fields

1. **Find a form** (Google Form, job application, signup, etc.)
2. **Fill it normally** with your information
3. **Submit the form** — Extension will ask: "Save these fields?"
4. **Click Save** — Your data is stored locally

### Autofilling Forms

Two methods:

**Method 1: Click the indicator**
- Green checkmark appears next to detected fields
- Click it to auto-fill that specific field

**Method 2: Autofill all at once**
- Click the extension icon → Click "Autofill All Fields"
- All matching fields on the page fill instantly

### Managing Saved Data

Click the extension icon, go to **Saved Fields** tab:
- View all your saved information
- Delete individual fields
- See exactly what's stored

### Backup & Restore

**Export your data:**
1. Click extension icon → Settings tab
2. Click "Export Data"
3. JSON file downloads to your computer

**Import data:**
1. Click "Import Data"
2. Select a JSON file
3. Your fields are restored

**Clear everything:**
1. Click "Delete All Data" in Settings
2. All saved fields are permanently removed

## What Fields Get Saved?

The extension captures:
- **Name fields** (full name, first name, last name)
- **Email addresses**
- **Phone numbers**
- **Addresses** (street, city, state, zip)
- **Education** (school, college, degree)
- **Professional info** (company, job title, skills)
- Literally any text field you fill

**What it WON'T save:**
- Passwords
- Credit card numbers
- Hidden fields
- File uploads

## File Structure

```
form-autofill-extension/
├── manifest.json           # Chrome extension config
├── content-script.js       # Runs on web pages (detects + fills)
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── background.js          # Background service worker
└── README.md              # This file
```

## How Matching Works

The extension matches fields using:

1. **Name matching** (highest priority)
   - Looks for keywords like "email", "phone", "name" in field ID/name
   
2. **Label matching**
   - Compares visible field labels with saved field names
   
3. **Type matching**
   - Email input → email data
   - Phone input → phone data
   
4. **Confidence threshold**
   - Only fills if match score ≥ 2/10 (80%+ confident)
   - Prevents wrong data going into wrong fields

## Customization

### Change Colors

Edit `popup.html` in the `<style>` section:

```css
.btn-primary {
  background: #667eea;  /* Change this color */
}
```

### Change Confidence Threshold

In `content-script.js`, find this line:
```javascript
return bestScore >= 2 ? bestMatch : null; // Higher = stricter
```

Change `2` to:
- `1` = more aggressive matching
- `3` = stricter, fewer false positives

### Exclude Certain Websites

Add to `manifest.json` content_scripts:
```json
"exclude_matches": [
  "*://bank.com/*",
  "*://crypto-wallet.com/*"
]
```

## Troubleshooting

**Fields not detected?**
- Refresh the page
- Check that fields aren't hidden
- Some dynamic forms may need JavaScript execution

**Autofill not working?**
- Click extension icon → Autofill tab
- Check "Saved Fields" tab — data actually saved?
- Try manually clicking the green indicator

**Data lost after restart?**
- Chrome local storage persists — shouldn't happen
- Try export/import to backup

**Chrome says "Unsafe extension"?**
- It's just a warning for unpacked extensions
- Perfectly safe — you control the code
- Install normally with official Chrome Web Store release (not in scope)

## Privacy & Security

✅ **All data stored locally** — Never leaves your computer  
✅ **No tracking** — No analytics, no servers  
✅ **Open source** — Code is visible, can be audited  
✅ **No permissions** — Only accesses form fields on pages you visit  

## Future Improvements (DIY)

Ideas to extend the extension:

1. **Password field detection** — Skip sensitive fields intelligently
2. **Form templates** — Save "full address" as one bundle
3. **Context awareness** — Different data for work vs personal
4. **Keyboard shortcuts** — Ctrl+Shift+L to autofill
5. **Sync across devices** — Store in cloud (requires backend)
6. **Multi-language support** — Detect "Nombre" = "Name"

## FAQ

**Q: Is this legal?**  
A: Yes. You own your data, stored locally, used only where you want.

**Q: Can websites detect I'm using this?**  
A: No, it just fills form fields like a real user would.

**Q: What if I want to clear data?**  
A: Settings → "Delete All Data" wipes everything instantly.

**Q: Can I use this on mobile?**  
A: Chrome Extensions don't work on mobile browsers yet. Desktop only.

**Q: How much disk space does it use?**  
A: Typically <1 MB. Chrome limits storage to 5-10 MB per extension.

## Support

If something breaks:

1. Check Chrome console for errors (`Ctrl+Shift+J` on the page)
2. Reload the extension: `chrome://extensions/` → Reload button
3. Try clearing all data and starting fresh
4. Check field names in "Inspect" → right-click field → Inspect

## License

Free to use, modify, and distribute. No restrictions.

---

**Made with ❤️ for form-filling sanity.**
