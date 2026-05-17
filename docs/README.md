# ✨ Fillora — Smart Form Autofill & Learning Engine

> An ultra-premium, privacy-first Chrome Extension that intelligently learns from your inputs, adapts to any form structure, and completes fields instantly with zero-latency.

---

## 🌟 Visual Preview & Experience
Fillora features a custom-designed **Glassmorphic Obsidian** user interface built with radial deep-space gradients, frosted translucent cards, iOS-style springy toggles, and smooth CSS micro-animations. It fits seamlessly inside the browser popup window with elegant rounded layout borders.

---

## 🚀 Key Architectural Capabilities

### 🧠 1. DOM-Climbing Heuristic Engine
Instead of relying on rigid, pre-defined selector templates, Fillora climbs the DOM tree dynamically from any input field to discover context:
* **Synonym Mapping**: Analyzes `id`, `name`, `placeholder`, `aria-label`, and text nodes using robust regular expressions to match fields like `"fname"`, `"first_name"`, `"given-name"` to your stored `First Name` entry.
* **Layout Interception**: Gracefully parses elements and form submission events to detect newly typed information and prompt you to save it instantly.

### ⚡ 2. Zero-Latency Caching
* **Synchronous Local Memory**: Avoids Chrome's storage read/write bottlenecks by managing operations within a fast in-memory controller class.
* **Instantaneous UI Redraws**: Saved field lists, searches, and configurations render in real-time, matching your exact inputs with zero stutter.
* **50ms Debounced Searches**: Filters large credential databases dynamically without thrashing layout execution threads.

### 🎨 3. Frosted Obsidian Glassmorphism
* Beautiful high-contrast visual layers utilizing a luxurious space gradient (`#1e1b4b` to `#030712`).
* Smooth spring-physics animations (`cubic-bezier(0.34, 1.56, 0.64, 1)`) for card hovers, tab switches, and slide-in alert boxes.
* Custom, crisp vector SVG indicators for all field types, removing generic emojis.

### 🛡️ 4. Bulletproof Cross-Browser Compatibility
* **Universal Clipboard Copy**: Automatically detects and falls back to a secure invisible textarea copy context if browser clipboard APIs are restricted.
* **Safe Runtime Dispatches**: All inter-script dispatches are encapsulated in active `chrome.runtime.lastError` and `try-catch` monitors to guarantee crash-free operation on Brave, Edge, Opera, and Chrome.

---

## 📂 Project Directory Structure
The repository is structured cleanly to separate active extension codes in the root from documentation and legacy archive resources:

```
Fillora-Extension/
├── docs/                         # 📁 Technical Documentation & Resources
│   ├── archive/                  # 🗃️ Legacy outdated backup files
│   │   ├── manifest.json
│   │   ├── background.js
│   │   ├── content-script.js
│   │   ├── popup.html
│   │   └── popup.js
│   ├── QUICK_START.md            # 📖 Step-by-step developer start guide
│   └── README.md                 # 🏆 This master documentation file
├── icons/                        # 🎨 Brand Icon Pack (16px, 48px, 128px)
├── background.js                 # ⚙️ Service Worker handling background tasks
├── content-script.js             # 🧬 Content script detecting and filling forms
├── popup.html                    # 🖼️ Breathtaking Glassmorphic Popup UI
├── popup.js                      # 🕹️ Zero-Latency Extension controller
├── manifest.json                 # 📜 Extension manifest specifications
└── kiranteja_resume_fields.json  # 💾 Custom resume fields seed data JSON
```

---

## 💻 Developer Installation Guide

### Step 1: Clone or Download the Source
```bash
git clone https://github.com/KiranTejz20005/Fillora-Extension.git
cd Fillora-Extension
```

### Step 2: Load the Unpacked Extension into Chrome
1. Open Google Chrome and type `chrome://extensions/` into the URL bar.
2. Toggle the **Developer mode** switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the project root folder (**`Fillora-Extension`**) containing the active extension codes.
5. The Fillora Extension is now loaded and fully active on your browser! Pin the extension to your toolbar for the best experience.

---

## 💾 Stored Fields JSON Format
You can seed or restore your autofill details by uploading a custom JSON backup. The schema follows this clean configuration:

```json
[
  {
    "label": "Full Name",
    "value": "Kiran Teja",
    "fieldType": "text",
    "patterns": ["name", "fullname", "first_last"]
  },
  {
    "label": "Email Address",
    "value": "kirnlanke824@gmail.com",
    "fieldType": "email",
    "patterns": ["email", "mail_id", "email_address"]
  }
]
```

To import this data:
1. Open the extension popup.
2. Navigate to the **Settings** tab.
3. Click **Import Fields from JSON** and select `kiranteja_resume_fields.json` from the repository root.

---

## 🔒 Security & Offline Promise
Fillora is built to be a **100% offline, privacy-first** engine. 
* **Zero Remote Servers**: All forms, inputs, and credentials are saved locally in the browser's sandbox using `chrome.storage.local`.
* **Zero Tracking**: No analytics, telemetry, or remote dependencies are loaded.
* **No Leaks**: Sensitive input forms (like passwords, card numbers, or hidden field tags) are strictly bypassed.

---

*Made with ❤️ for form-filling sanity and visual perfection.*
