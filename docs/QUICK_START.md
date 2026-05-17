# Quick Start Guide — 5 Minutes to Done

## What You Need
- Chrome browser
- This extension code

## Step 1: Create the Folder (1 min)

Create a new folder anywhere. Let's call it `form-autofill`:

```
form-autofill/
```

## Step 2: Copy Files (2 min)

Copy these 5 files into that folder:

1. **manifest.json** (from above)
2. **content-script.js** (from above)
3. **popup.html** (from above)
4. **popup.js** (from above)
5. **background.js** (from above)

Exact file structure should look like:
```
form-autofill/
├── manifest.json
├── content-script.js
├── popup.html
├── popup.js
└── background.js
```

## Step 3: Install in Chrome (2 min)

1. Open Chrome
2. Go to `chrome://extensions/` (copy-paste in address bar)
3. Toggle **Developer mode** (top-right corner)
4. Click **Load unpacked**
5. Select your `form-autofill` folder
6. Done! 🎉

You should see the extension icon appear in Chrome toolbar (upper right).

## Step 4: Test It (Works immediately)

1. Open any website with a form (Google Forms, job site, signup page)
2. Fill a field → submit the form
3. You'll see a prompt: "Save these fields?"
4. Click **Save**
5. Go to another similar form
6. You'll see a green ✓ next to matching fields
7. Click it to auto-fill!

---

## That's it!

Your extension is now:
- ✅ Detecting forms
- ✅ Learning your data
- ✅ Autofilling new forms
- ✅ Storing everything locally
- ✅ 100% free
- ✅ No external APIs

---

## Next Steps

**Want to customize it?**
- Edit colors in `popup.html` → `<style>`
- Adjust confidence threshold in `content-script.js`
- Change indicator text/position

**Want more features?**
- Add keyboard shortcuts
- Bulk save templates
- Exclude certain websites
- Auto-detect field types better

See **README.md** for full customization guide.

---

## Troubleshooting Quick Fixes

**Extension not showing up?**
- Refresh Chrome
- Make sure all 5 files are in the folder
- Check you clicked "Load unpacked" correctly

**Fields not detected?**
- Refresh the page
- Make sure form fields aren't hidden with CSS

**Fields not saving?**
- Check browser console for errors (Ctrl+Shift+J)
- Click extension → autofill tab to confirm data was saved

**Tired of it?**
- Go to `chrome://extensions`
- Click "Remove" next to the extension
- Delete the folder
- Done

---

That's literally all you need. Go build! 🚀
