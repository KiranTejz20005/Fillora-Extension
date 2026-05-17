// content-script.js - Runs on every webpage
// Detects form fields and enables autofill

class FormAutofill {
  constructor() {
    this.savedFields = [];
    this.fieldsToSave = new Map(); // Track what user fills
    this.loadSavedFields();
    this.init();
  }

  init() {
    this.detectFormFields();
    this.watchFormSubmissions();
    this.addMessageListener();
  }

  loadSavedFields() {
    chrome.storage.local.get(['saved_fields'], (result) => {
      this.savedFields = result.saved_fields || [];
    });
  }

  detectFormFields() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea, select');
    
    inputs.forEach((field) => {
      if (!field.dataset.autofillMarked) {
        field.dataset.autofillMarked = 'true';
        this.addFieldUI(field);
        this.watchFieldChanges(field);
      }
    });
  }

  addFieldUI(field) {
    // Skip if already has UI or is hidden
    if (field.offsetParent === null) return;

    const match = this.findMatch(field);
    if (!match) return;

    // Add visual indicator
    const indicator = document.createElement('div');
    indicator.className = 'autofill-indicator';
    indicator.title = `Click to fill: ${match.label}`;
    indicator.innerHTML = '✓';
    indicator.style.cssText = `
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: #4CAF50;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
    `;

    indicator.addEventListener('click', () => this.autofillField(field, match));

    // Position parent relatively if needed
    const parent = field.parentElement;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    parent.appendChild(indicator);
  }

  findMatch(fieldElement) {
    const fieldName = (fieldElement.name || fieldElement.id || fieldElement.placeholder || '').toLowerCase();
    const fieldLabel = this.getVisibleLabel(fieldElement).toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const saved of this.savedFields) {
      let score = 0;

      // Pattern matching
      const patterns = saved.patterns || [saved.label.toLowerCase().replace(/\s+/g, '_')];
      if (patterns.some(p => fieldName.includes(p))) score += 5;

      // Label matching
      if (fieldLabel.includes(saved.label.toLowerCase())) score += 3;
      if (saved.label.toLowerCase().includes(fieldLabel.split(' ')[0])) score += 2;

      // Type matching (email field vs email value, etc.)
      if (fieldElement.type === 'email' && saved.label.toLowerCase().includes('email')) score += 2;
      if (fieldElement.type === 'tel' && saved.label.toLowerCase().includes('phone')) score += 2;

      if (score > bestScore) {
        bestMatch = saved;
        bestScore = score;
      }
    }

    return bestScore >= 2 ? bestMatch : null;
  }

  getVisibleLabel(fieldElement) {
    // Check for associated label
    if (fieldElement.id) {
      const label = document.querySelector(`label[for="${fieldElement.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check aria-label
    if (fieldElement.getAttribute('aria-label')) {
      return fieldElement.getAttribute('aria-label');
    }

    // Check placeholder
    if (fieldElement.placeholder) return fieldElement.placeholder;

    // Check parent label
    const parentLabel = fieldElement.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();

    return fieldElement.name || '';
  }

  autofillField(field, data) {
    field.value = data.value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Visual feedback
    field.style.backgroundColor = '#e8f5e9';
    setTimeout(() => field.style.backgroundColor = '', 500);
  }

  watchFieldChanges(field) {
    field.addEventListener('input', (e) => {
      this.fieldsToSave.set(field.name || field.id, {
        element: field,
        label: this.getVisibleLabel(field),
        value: field.value
      });
    });
  }

  watchFormSubmissions() {
    document.addEventListener('submit', (e) => {
      if (this.fieldsToSave.size > 0) {
        this.promptSaveFields();
      }
    });
  }

  promptSaveFields() {
    const fieldsArray = Array.from(this.fieldsToSave.values());
    
    // Send to background script to show save prompt
    chrome.runtime.sendMessage({
      action: 'prompt_save_fields',
      fields: fieldsArray.map(f => ({
        label: f.label,
        value: f.value,
        fieldType: f.element.type
      }))
    });

    this.fieldsToSave.clear();
  }

  addMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'autofill_all') {
        this.autofillVisibleFields();
        sendResponse({ status: 'filled' });
      }
      if (message.action === 'reload_fields') {
        this.loadSavedFields();
        this.detectFormFields();
        sendResponse({ status: 'reloaded' });
      }
    });
  }

  autofillVisibleFields() {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea');
    let filled = 0;

    inputs.forEach((field) => {
      if (!field.value) {
        const match = this.findMatch(field);
        if (match) {
          this.autofillField(field, match);
          filled++;
        }
      }
    });

    console.log(`Autofilled ${filled} fields`);
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new FormAutofill());
} else {
  new FormAutofill();
}

// Re-scan for new forms added dynamically
const observer = new MutationObserver(() => {
  if (window.formAutofill) {
    window.formAutofill.detectFormFields();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
