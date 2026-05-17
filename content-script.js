// content-script.js — Fillora
// Runs on every webpage: detects form fields, autofills, and watches submissions

class Fillora {
  constructor() {
    this.savedFields = [];
    this.fieldsToSave = new Map(); // Tracks what the user fills during the session
    this.indicators = new WeakMap(); // Maps field elements to their indicator DOM nodes
    this.observer = null;
    this.loadSavedFields().then(() => this.init());
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async loadSavedFields() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['saved_fields', 'autofill_enabled', 'show_indicators', 'instant_autofill'], (result) => {
        this.savedFields = result.saved_fields || [];
        this.autofillEnabled = result.autofill_enabled !== false;
        this.showIndicators = result.show_indicators !== false;
        this.instantAutofill = result.instant_autofill === true;
        resolve();
      });
    });
  }

  init() {
    this.injectStyles();
    this.detectFormFields();
    this.watchFormSubmissions();
    this.addMessageListener();
    this.startMutationObserver();

    // Trigger instant fill for initially loaded elements on page load
    if (this.instantAutofill) {
      setTimeout(() => {
        this.autofillAllVisible();
      }, 300);
    }

    // Listen for storage changes (e.g. settings updated in popup)
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.saved_fields) {
        this.savedFields = changes.saved_fields.newValue || [];
        this.refreshIndicators();
        if (this.instantAutofill) {
          this.autofillAllVisible();
        }
      }
      if (changes.autofill_enabled) {
        this.autofillEnabled = changes.autofill_enabled.newValue;
      }
      if (changes.show_indicators) {
        this.showIndicators = changes.show_indicators.newValue;
        this.refreshIndicators();
      }
      if (changes.instant_autofill) {
        this.instantAutofill = changes.instant_autofill.newValue === true;
        if (this.instantAutofill) {
          this.autofillAllVisible();
        }
      }
    });
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  injectStyles() {
    if (document.getElementById('fillora-styles')) return;
    const style = document.createElement('style');
    style.id = 'fillora-styles';
    style.textContent = `
      .fillora-indicator {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%) scale(1);
        background: #0f172a;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        cursor: pointer;
        z-index: 2147483647;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
        pointer-events: all;
        box-shadow: 0 0 0 0px rgba(15, 23, 42, 0.15);
      }

      .fillora-indicator:hover {
        transform: translateY(-50%) scale(1.6);
        background: #000000;
        box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.15);
      }

      .fillora-indicator:active {
        transform: translateY(-50%) scale(1.3);
      }

      .fillora-filled {
        animation: fillora-flash 0.4s ease;
        outline: 1.5px solid #0f172a !important;
        outline-offset: 2px !important;
      }

      @keyframes fillora-flash {
        0%   { background-color: rgba(15, 23, 42, 0.15); }
        100% { background-color: transparent; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Field Detection ──────────────────────────────────────────────────────

  detectFormFields() {
    if (!this.autofillEnabled) return;

    const selector = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="tel"]',
      'input[type="number"]',
      'input[type="url"]',
      'input[type="search"]',
      'textarea',
      'select'
    ].join(', ');

    const inputs = document.querySelectorAll(selector);
    inputs.forEach((field) => {
      if (!field.dataset.filloraMarked) {
        field.dataset.filloraMarked = 'true';
        if (this.showIndicators) this.addFieldIndicator(field);
        this.watchFieldChanges(field);

        // INSTANT AUTO-FILL: Automatically fill the detected field if a saved field matches
        if (this.instantAutofill && !field.value) {
          setTimeout(() => {
            if (!field.value) {
              const match = this.findMatch(field);
              if (match) {
                this.autofillField(field, match);
              }
            }
          }, 100);
        }
      }
    });
  }

  addFieldIndicator(field) {
    // Skip hidden, password, or credit-card-like fields
    if (field.offsetParent === null) return;
    if (field.type === 'password') return;
    if (this.isSensitiveField(field)) return;

    const match = this.findMatch(field);
    if (!match) return;

    // Avoid duplicate indicators
    if (this.indicators.has(field)) return;

    const indicator = document.createElement('div');
    indicator.className = 'fillora-indicator';
    indicator.title = `Fillora: Click to fill "${match.label}"`;
    indicator.innerHTML = '';
    indicator.setAttribute('data-fillora-indicator', 'true');

    indicator.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.autofillField(field, match);
    });

    // Make parent relative so absolute positioning works
    const parent = field.parentElement;
    if (!parent) return;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    parent.appendChild(indicator);
    this.indicators.set(field, indicator);
  }

  refreshIndicators() {
    // Remove all existing indicators
    document.querySelectorAll('[data-fillora-indicator]').forEach(el => el.remove());
    this.indicators = new WeakMap();

    // Re-add if enabled
    if (this.showIndicators && this.autofillEnabled) {
      document.querySelectorAll('[data-fillora-marked]').forEach(field => {
        this.addFieldIndicator(field);
      });
    }
  }

  // ─── Smart Field Matching ─────────────────────────────────────────────────

  findMatch(fieldElement) {
    if (this.savedFields.length === 0) return null;

    const fieldName = (
      fieldElement.name ||
      fieldElement.id ||
      fieldElement.getAttribute('autocomplete') ||
      fieldElement.placeholder ||
      ''
    ).toLowerCase();

    const fieldLabel = this.getVisibleLabel(fieldElement).toLowerCase();

    // Clean labels for robust matching (e.g. remove "*", ":", "?" and extra spaces)
    const cleanString = (str) => str.replace(/[*?:()]/g, '').replace(/\s+/g, ' ').trim();
    const cleanFieldLabel = cleanString(fieldLabel);

    let bestMatch = null;
    let bestScore = 0;

    console.log(`[Fillora] Matching field. Name: "${fieldName}", Label: "${fieldLabel}" (Cleaned: "${cleanFieldLabel}")`);

    for (const saved of this.savedFields) {
      let score = 0;

      const savedLabelLower = saved.label.toLowerCase();
      const cleanSavedLabel = cleanString(savedLabelLower);
      const patterns = saved.patterns || [cleanSavedLabel.replace(/\s+/g, '_'), cleanSavedLabel.replace(/\s+/g, '-')];

      // Pattern / name attribute match (highest signal)
      if (patterns.some(p => fieldName.includes(p))) {
        score += 5;
      }

      // Exact or partial label text match
      if (cleanFieldLabel && cleanFieldLabel.includes(cleanSavedLabel)) {
        score += 4;
      }
      if (cleanSavedLabel && cleanSavedLabel.includes(cleanFieldLabel) && cleanFieldLabel.length > 1) {
        score += 3;
      }

      // Type matching (email vs email, tel vs phone, etc.)
      if (fieldElement.type === 'email' && cleanSavedLabel.includes('email')) score += 2;
      if (fieldElement.type === 'tel' && cleanSavedLabel.includes('phone')) score += 2;
      if (fieldElement.type === 'url' && cleanSavedLabel.includes('url')) score += 2;

      // Autocomplete attribute match
      const ac = (fieldElement.getAttribute('autocomplete') || '').toLowerCase();
      if (ac && cleanSavedLabel.includes(ac)) score += 3;

      // ─── Semantic Synonym Matching ───
      
      // 1. Phone / Mobile / Contact Numbers (Phone, Mobile, Tel, Cell, Contact, Whatsapp)
      const phoneKeywords = ['phone', 'mobile', 'tel', 'cell', 'contact', 'whatsapp', 'telephone'];
      const isSavedPhone = phoneKeywords.some(kw => cleanSavedLabel.includes(kw));
      const isFieldPhone = phoneKeywords.some(kw => cleanFieldLabel.includes(kw) || fieldName.includes(kw) || fieldElement.type === 'tel');
      if (isSavedPhone && isFieldPhone) {
        score += 5; // Direct synonym hit!
      }

      // 2. Email Address Synonyms (Email, Mail, Email ID)
      const emailKeywords = ['email', 'mail'];
      const isSavedEmail = emailKeywords.some(kw => cleanSavedLabel.includes(kw)) && !cleanSavedLabel.includes('address');
      const isFieldEmail = emailKeywords.some(kw => cleanFieldLabel.includes(kw) || fieldName.includes(kw) || fieldElement.type === 'email') && !cleanFieldLabel.includes('address') && !fieldName.includes('address');
      if (isSavedEmail && isFieldEmail) {
        score += 5;
      }

      // 3. College / University / School Synonyms (College, University, School, Institute, Institution)
      const collegeKeywords = ['college', 'university', 'school', 'institute', 'institution', 'education'];
      const isSavedCollege = collegeKeywords.some(kw => cleanSavedLabel.includes(kw));
      const isFieldCollege = collegeKeywords.some(kw => cleanFieldLabel.includes(kw) || fieldName.includes(kw));
      if (isSavedCollege && isFieldCollege) {
        score += 5;
      }

      // 4. Zip / Postal Code Synonyms (Zip, Postal, Pincode, Pin code)
      const zipKeywords = ['zip', 'postal', 'pincode', 'pin code'];
      const isSavedZip = zipKeywords.some(kw => cleanSavedLabel.includes(kw));
      const isFieldZip = zipKeywords.some(kw => cleanFieldLabel.includes(kw) || fieldName.includes(kw));
      if (isSavedZip && isFieldZip) {
        score += 5;
      }

      // ─── Heuristic Exclusions for Crossover Matching ───
      
      // 1. Person Name fields (Name, Full Name, etc.) vs Entity Names (College, Company, etc.)
      const personNameLabels = ['name', 'full name', 'first name', 'last name', 'middle name', 'your name', 'display name'];
      if (personNameLabels.includes(cleanSavedLabel)) {
        const entityModifiers = [
          'college', 'university', 'school', 'company', 'business', 'employer',
          'organization', 'org', 'project', 'server', 'host', 'domain', 'file',
          'product', 'item', 'event', 'class', 'department', 'dept', 'card', 'bank', 'holder',
          'parent', 'guardian', 'father', 'mother', 'spouse', 'emergency', 'referee', 'reference',
          'sibling', 'brother', 'sister', 'relative', 'kin', 'nominee'
        ];
        if (entityModifiers.some(mod => cleanFieldLabel.includes(mod) || fieldName.includes(mod))) {
          score -= 10; // Severely penalize to prevent mismatch
        }
      }

      // 2. Street Address vs Non-street addresses (Email Address, IP Address, etc.)
      if (cleanSavedLabel === 'address') {
        const nonStreetAddressModifiers = ['email', 'mail', 'ip', 'mac', 'server', 'web'];
        if (nonStreetAddressModifiers.some(mod => cleanFieldLabel.includes(mod) || fieldName.includes(mod))) {
          score -= 10;
        }
      }

      // 3. Generic Numbers vs Specific Numbers (Card Number, Phone Number, etc.)
      if (cleanSavedLabel === 'number') {
        const nonGenericNumberModifiers = ['card', 'phone', 'mobile', 'tel', 'ssn', 'social', 'cvv', 'cvc', 'zip', 'pin'];
        if (nonGenericNumberModifiers.some(mod => cleanFieldLabel.includes(mod) || fieldName.includes(mod))) {
          score -= 10;
        }
      }

      if (score > bestScore) {
        bestMatch = saved;
        bestScore = score;
      }
    }

    console.log(`[Fillora] Best match for "${fieldLabel || fieldName}":`, bestMatch ? `"${bestMatch.label}" (Score: ${bestScore})` : 'None');

    return bestScore >= 2 ? bestMatch : null;
  }

  getVisibleLabel(fieldElement) {
    // 1. Explicit <label for="...">
    if (fieldElement.id) {
      const label = document.querySelector(`label[for="${CSS.escape(fieldElement.id)}"]`);
      if (label) return label.textContent.trim();
    }

    // 2. aria-label (Filter out generic placeholder values like "Your answer")
    const ariaLabel = fieldElement.getAttribute('aria-label');
    if (ariaLabel) {
      const cleanAL = ariaLabel.toLowerCase().trim();
      const genericLabels = ['your answer', 'answer', 'enter answer', 'type answer', 'write answer', 'input', 'value', 'text', 'field', 'placeholder', 'optional'];
      if (!genericLabels.includes(cleanAL)) {
        return ariaLabel;
      }
    }

    // 3. aria-labelledby (handles space-separated list of IDs)
    const labelledBy = fieldElement.getAttribute('aria-labelledby');
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/);
      const labels = ids.map(id => {
        const el = document.getElementById(id);
        return el ? el.textContent.trim() : '';
      }).filter(Boolean);
      if (labels.length > 0) return labels.join(' ');
    }

    // 4. Google Forms / Modern form question titles (climbing up the DOM tree)
    // Limits the climb to avoid hitting the top-level form-wide body and matching the wrong question card
    let current = fieldElement;
    for (let i = 0; i < 5; i++) {
      if (!current || current === document.body) break;
      
      const potentialLabel = current.querySelector('[role="heading"], .freebirdFormviewerComponentsQuestionBaseHeaderTitle, .M7eMe, .Qbrrwd');
      if (potentialLabel && potentialLabel.textContent.trim()) {
        // Enforce block containment: Verify that this label belongs to the same question block as our input
        const inputBlock = fieldElement.closest('.geS5qb, .QrM3Bc, [role="listitem"], .form-group, .form-field, .form-row');
        const labelBlock = potentialLabel.closest('.geS5qb, .QrM3Bc, [role="listitem"], .form-group, .form-field, .form-row');
        if (!inputBlock || !labelBlock || inputBlock === labelBlock) {
          return potentialLabel.textContent.trim();
        }
      }

      // Check preceding siblings at this level for label text elements
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName !== 'INPUT' && sibling.textContent.trim()) {
          const txt = sibling.textContent.trim();
          if (txt.length > 1 && !txt.includes('* Indicates required')) return txt;
        }
        sibling = sibling.previousElementSibling;
      }

      current = current.parentElement;
    }

    // 5. Placeholder
    if (fieldElement.placeholder) return fieldElement.placeholder;

    // 6. Wrapping <label>
    const parentLabel = fieldElement.closest('label');
    if (parentLabel) return parentLabel.textContent.replace(fieldElement.value, '').trim();

    // 7. Preceding sibling text
    const prev = fieldElement.previousElementSibling;
    if (prev && prev.tagName !== 'INPUT') return prev.textContent.trim();

    return fieldElement.name || fieldElement.id || '';
  }

  isSensitiveField(field) {
    const name = (field.name + field.id + (field.getAttribute('autocomplete') || '')).toLowerCase();
    const sensitivePatterns = ['credit', 'card', 'cvv', 'cvc', 'ssn', 'social', 'passport'];
    return sensitivePatterns.some(p => name.includes(p));
  }

  // ─── Autofill ─────────────────────────────────────────────────────────────

  autofillField(field, data) {
    // Bring element into focus to trigger framework focus listeners
    try {
      field.focus();
    } catch (e) {
      // Ignore focus errors on non-interactive inputs
    }

    if (field.tagName === 'SELECT') {
      // Try to match value or text for dropdowns
      const options = Array.from(field.options);
      const match = options.find(o =>
        o.value.toLowerCase() === data.value.toLowerCase() ||
        o.text.toLowerCase() === data.value.toLowerCase()
      );
      if (match) field.value = match.value;
    } else {
      // Use native input value setter so React/Vue controlled inputs work
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      const setter = field.tagName === 'TEXTAREA' ? nativeTextareaSetter?.set : nativeInputValueSetter?.set;
      if (setter) {
        setter.call(field, data.value);
      } else {
        field.value = data.value;
      }
    }

    // Dispatch full suite of events for framework state synchronization
    ['focus', 'input', 'change', 'blur'].forEach(eventType => {
      try {
        field.dispatchEvent(new Event(eventType, { bubbles: true }));
      } catch (e) {
        // Ignore dispatch errors
      }
    });

    // Blurring triggers standard framework validation handlers
    try {
      field.blur();
    } catch (e) {}

    // Visual flash feedback
    field.classList.add('fillora-filled');
    setTimeout(() => field.classList.remove('fillora-filled'), 600);
  }

  autofillAllVisible() {
    if (!this.autofillEnabled) return 0;

    const selector = 'input[type="text"], input[type="email"], input[type="tel"], input[type="url"], textarea';
    const inputs = document.querySelectorAll(selector);
    let filled = 0;

    inputs.forEach((field) => {
      if (!field.value && field.offsetParent !== null) {
        const match = this.findMatch(field);
        if (match) {
          this.autofillField(field, match);
          filled++;
        }
      }
    });

    return filled;
  }

  // ─── Field Change Watching ────────────────────────────────────────────────

  watchFieldChanges(field) {
    if (field.type === 'password') return;
    if (this.isSensitiveField(field)) return;

    const handleInput = () => {
      const val = field.value.trim();
      const label = this.getVisibleLabel(field) || field.name || field.id || 'Field';
      if (val) {
        this.fieldsToSave.set(label, {
          element: field,
          label: label,
          value: val,
          fieldType: field.type || field.tagName.toLowerCase()
        });
        console.log(`[Fillora] Tracked field change: "${label}" = "${val}"`);
      } else {
        this.fieldsToSave.delete(label);
      }
    };

    field.addEventListener('input', handleInput);
    field.addEventListener('change', handleInput);
  }

  watchFormSubmissions() {
    // 1. Traditional HTML form submission event
    document.addEventListener('submit', () => {
      if (this.fieldsToSave.size > 0 && this.autofillEnabled) {
        this.promptSaveFields();
      }
    }, true);

    // 2. Modern AJAX / Single Page Application / Google Forms submissions (Click interceptor)
    document.addEventListener('click', (e) => {
      if (this.fieldsToSave.size === 0 || !this.autofillEnabled) return;

      let current = e.target;
      let clickedSubmit = false;

      // Climb up 4 levels to check if they clicked a button/submit element
      for (let i = 0; i < 4; i++) {
        if (!current || current === document.body) break;

        const tag = current.tagName.toLowerCase();
        const role = current.getAttribute('role') || '';
        const cls = typeof current.className === 'string' ? current.className : (current.getAttribute('class') || '');
        const txt = (current.textContent || '').toLowerCase().trim();

        const isSubmitType = current.type === 'submit' || tag === 'button' || role === 'button';
        const hasSubmitText = txt === 'submit' || txt === 'next' || txt === 'save' || txt === 'continue' || txt === 'send' || txt === 'submit request';
        const isGoogleSubmit = cls.includes('uArJ5e') && (txt.includes('submit') || txt.includes('next'));

        if (isSubmitType || hasSubmitText || isGoogleSubmit) {
          clickedSubmit = true;
          break;
        }

        current = current.parentElement;
      }

      if (clickedSubmit) {
        console.log('[Fillora] Submit action detected. Prompting to save...');
        // Let React/framework click handlers run first, then prompt
        setTimeout(() => {
          this.promptSaveFields();
        }, 150);
      }
    }, true);
  }

  promptSaveFields() {
    const fieldsArray = Array.from(this.fieldsToSave.values())
      .filter(f => f.value && f.label) // only save non-empty, labeled fields
      .map(f => ({
        label: f.label,
        value: f.value,
        fieldType: f.fieldType
      }));

    if (fieldsArray.length === 0) return;

    chrome.runtime.sendMessage({
      action: 'prompt_save_fields',
      fields: fieldsArray
    });

    this.fieldsToSave.clear();
  }

  // ─── Message Listener ─────────────────────────────────────────────────────

  addMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'autofill_all') {
        const count = this.autofillAllVisible();
        sendResponse({ status: 'filled', count });
        return true;
      }
      if (message.action === 'reload_fields') {
        this.loadSavedFields().then(() => {
          this.detectFormFields();
          sendResponse({ status: 'reloaded' });
        });
        return true;
      }
      if (message.action === 'get_page_fields') {
        const selector = 'input[type="text"], input[type="email"], input[type="tel"], textarea, select';
        const fields = Array.from(document.querySelectorAll(selector))
          .filter(f => f.offsetParent !== null && f.type !== 'password')
          .map(f => ({
            label: this.getVisibleLabel(f),
            type: f.type,
            name: f.name
          }));
        sendResponse({ fields });
        return true;
      }
    });
  }

  // ─── MutationObserver (Dynamic Forms) ────────────────────────────────────

  startMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldRescan = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            if (node.matches?.('input, textarea, select, form') ||
                node.querySelector?.('input, textarea, select')) {
              shouldRescan = true;
              break;
            }
          }
        }
        if (shouldRescan) break;
      }
      if (shouldRescan) {
        this.detectFormFields();
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────
window.filloraInstance = null;

function bootstrap() {
  if (!window.filloraInstance) {
    window.filloraInstance = new Fillora();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
