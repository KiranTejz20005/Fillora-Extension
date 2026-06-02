// popup.js — Fillora Extension Controller (Zero-Latency Edition)

// High-Fidelity Premium SVG Icons for Field Types
const FIELD_TYPE_ICONS = {
  email: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
  tel: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
  url: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
  number: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>`,
  textarea: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  select: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`,
  text: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>`,
  default: `<svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>`
};

function getFieldIcon(type) {
  return FIELD_TYPE_ICONS[type] || FIELD_TYPE_ICONS.default;
}

class FilloraPopup {
  constructor() {
    this.pendingFields = null;
    this.allSavedFields = [];
    this.searchQuery = '';
    this.searchDebounceTimer = null;
    
    // Cached configuration to guarantee instantaneous performance
    this.settings = {
      autofill_enabled: true,
      show_indicators: true,
      instant_autofill: false
    };

    this.init();
  }

  // ─── Initialization ──────────────────────────────────────────────

  init() {
    this.setupTabs();
    this.setupButtons();
    this.loadCacheAndRender();
    this.setupMessageListener();
    this.setupSearch();
    this.setupCentralizedCardEvents();
  }

  // ─── Zero-Latency Sync Loader ────────────────────────────────────

  loadCacheAndRender() {
    try {
      chrome.storage.local.get([
        'saved_fields', 
        'autofill_enabled', 
        'show_indicators', 
        'instant_autofill',
        'has_pending',
        'pending_fields'
      ], (result) => {
        if (chrome.runtime.lastError) return;

        this.allSavedFields = result.saved_fields || [];
        this.settings.autofill_enabled = result.autofill_enabled !== false;
        this.settings.show_indicators = result.show_indicators !== false;
        this.settings.instant_autofill = result.instant_autofill === true;

        // Update settings checkboxes
        document.getElementById('enableAutofill').checked = this.settings.autofill_enabled;
        document.getElementById('showIndicators').checked = this.settings.show_indicators;
        document.getElementById('instantAutofill').checked = this.settings.instant_autofill;

        // Check and show pending form fields save prompt
        if (result.has_pending && result.pending_fields?.length > 0) {
          this.showSavePrompt(result.pending_fields);
        }

        // Render current list of fields
        this.renderFieldsList();
      });
    } catch (e) {
      console.warn('[Fillora] Local storage query skipped outside of extension lifecycle.', e);
    }
  }

  // ─── Tabs Navigation ─────────────────────────────────────────────

  setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');

    // Smooth scroll back to top of tab content
    if (activeContent) activeContent.scrollTop = 0;

    // Refresh elements or close form pane when navigating
    if (tabName === 'saved') {
      this.closeAddFieldPane();
    }
  }

  // ─── Centralized Button Click Listeners ──────────────────────────

  setupButtons() {
    // ── Brand click scrolls back to main ──
    document.getElementById('brandHeader').addEventListener('click', () => {
      this.switchTab('autofill');
    });

    // ── Autofill Active Tab ──
    document.getElementById('autofillBtn').addEventListener('click', () => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (!tabs || !tabs[0]) {
            this.showStatus('Unable to detect active browser tab.', 'error');
            return;
          }
          chrome.tabs.sendMessage(tabs[0].id, { action: 'autofill_all' }, (response) => {
            if (chrome.runtime.lastError) {
              this.showStatus('Could not find form inputs on this web page.', 'error');
              return;
            }
            const count = response?.count ?? 0;
            if (count > 0) {
              this.showStatus(`Successfully filled ${count} field${count !== 1 ? 's' : ''}!`, 'success');
            } else {
              this.showStatus('No matching form inputs found.', 'error');
            }
          });
        });
      } catch (e) {
        this.showStatus('Failed to communicate with browser tab.', 'error');
      }
    });

    // ── Save Prompt confirmations ──
    document.getElementById('confirmSaveBtn').addEventListener('click', () => this.savePendingFields());
    document.getElementById('rejectSaveBtn').addEventListener('click', () => this.rejectSavePrompt());

    // ── Toggle Pane for Adding Custom Field ──
    document.getElementById('addFieldTrigger').addEventListener('click', () => this.toggleAddFieldPane());
    document.getElementById('cancelAddFieldBtn').addEventListener('click', () => this.closeAddFieldPane());
    document.getElementById('saveCustomFieldBtn').addEventListener('click', () => this.saveCustomField());

    // ── Backup & storage ──
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', (e) => this.handleImport(e));
    document.getElementById('clearBtn').addEventListener('click', () => this.clearAllData());

    // ── Storage settings triggers ──
    document.getElementById('enableAutofill').addEventListener('change', (e) => {
      this.settings.autofill_enabled = e.target.checked;
      chrome.storage.local.set({ autofill_enabled: e.target.checked });
      this.showStatus(e.target.checked ? 'Form detection enabled' : 'Form detection disabled', 'success');
    });

    document.getElementById('showIndicators').addEventListener('change', (e) => {
      this.settings.show_indicators = e.target.checked;
      chrome.storage.local.set({ show_indicators: e.target.checked });
      this.showStatus(e.target.checked ? 'Field badges visible' : 'Field badges hidden', 'success');
    });

    document.getElementById('instantAutofill').addEventListener('change', (e) => {
      this.settings.instant_autofill = e.target.checked;
      chrome.storage.local.set({ instant_autofill: e.target.checked });
      this.showStatus(e.target.checked ? 'Instant Auto-Fill enabled' : 'Instant Auto-Fill disabled', 'success');
    });

    document.getElementById('resetTutorialBtn').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchTab('autofill');
      this.showStatus('Quick guide activated.', 'success');
    });
  }

  // ─── Add Custom Field Flow ──────────────────────────────────────

  toggleAddFieldPane() {
    const pane = document.getElementById('addFieldPane');
    const trigger = document.getElementById('addFieldTrigger');
    
    if (pane.classList.contains('show')) {
      this.closeAddFieldPane();
    } else {
      pane.classList.add('show');
      trigger.classList.add('active');
      document.getElementById('newFieldLabel').focus();
    }
  }

  closeAddFieldPane() {
    const pane = document.getElementById('addFieldPane');
    const trigger = document.getElementById('addFieldTrigger');
    pane.classList.remove('show');
    trigger.classList.remove('active');
    
    // Reset forms
    document.getElementById('newFieldLabel').value = '';
    document.getElementById('newFieldValue').value = '';
    document.getElementById('newFieldType').value = 'text';
  }

  saveCustomField() {
    const label = document.getElementById('newFieldLabel').value.trim();
    const value = document.getElementById('newFieldValue').value.trim();
    const type = document.getElementById('newFieldType').value;

    if (!label || !value) {
      this.showStatus('Both label and value are required.', 'error');
      return;
    }

    const newField = {
      label: label,
      value: value,
      fieldType: type,
      patterns: [label.toLowerCase().replace(/\s+/g, '_')]
    };

    // Upsert — update if exact label match already exists, else append (no duplicates)
    const existingIndex = this.allSavedFields.findIndex(
      f => f.label.toLowerCase() === label.toLowerCase()
    );
    const isUpdate = existingIndex >= 0;

    if (isUpdate) {
      this.allSavedFields = [
        ...this.allSavedFields.slice(0, existingIndex),
        newField,
        ...this.allSavedFields.slice(existingIndex + 1)
      ];
    } else {
      this.allSavedFields = [...this.allSavedFields, newField];
    }

    this.renderFieldsList();
    this.closeAddFieldPane();

    chrome.storage.local.set({ saved_fields: this.allSavedFields }, () => {
      this.showStatus(
        isUpdate ? `Updated "${label}"` : `Field "${label}" saved!`,
        'success'
      );
    });
  }

  // ─── Search Debouncer ───────────────────────────────────────────

  setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchQuery = searchInput.value.toLowerCase().trim();
        this.renderFieldsList();
      }, 50); // Minimal 50ms latency guard to prevent keydown stutters
    });
  }

  // ─── Centralized Card Event Delegation ──────────────────────────
  
  setupCentralizedCardEvents() {
    const listContainer = document.getElementById('savedFieldsList');
    
    // Binding a single centralized click listener to the list container
    listContainer.addEventListener('click', (e) => {
      const target = e.target.closest('button, .field-value-text');
      if (!target) return;

      const actionId = target.id || '';
      const [type, indexStr] = actionId.split('-');
      
      // Secondary extraction logic for elements without a direct ID but within a target
      let typeAction = type;
      let index = parseInt(indexStr);

      if (target.classList.contains('field-value-text')) {
        const idParts = target.id.split('-');
        typeAction = 'edit';
        index = parseInt(idParts[idParts.length - 1]);
      } else if (actionId.startsWith('copy-btn')) {
        typeAction = 'copy';
        index = parseInt(actionId.replace('copy-btn-', ''));
      } else if (actionId.startsWith('edit-btn')) {
        typeAction = 'edit';
        index = parseInt(actionId.replace('edit-btn-', ''));
      } else if (actionId.startsWith('del-btn')) {
        typeAction = 'delete';
        index = parseInt(actionId.replace('del-btn-', ''));
      } else if (actionId.startsWith('save-edit-btn')) {
        typeAction = 'saveedit';
        index = parseInt(actionId.replace('save-edit-btn-', ''));
      } else if (actionId.startsWith('cancel-edit-btn')) {
        typeAction = 'canceledit';
        index = parseInt(actionId.replace('cancel-edit-btn-', ''));
      }

      if (isNaN(index)) return;

      e.preventDefault();
      e.stopPropagation();

      if (typeAction === 'copy') {
        this.copyToClipboard(this.allSavedFields[index].value, `copy-btn-${index}`);
      } else if (typeAction === 'edit') {
        this.startInlineEditing(index);
      } else if (typeAction === 'delete') {
        this.deleteField(index);
      } else if (typeAction === 'saveedit') {
        this.saveInlineEdit(index);
      } else if (typeAction === 'canceledit') {
        this.renderFieldsList();
      }
    });
  }

  // ─── Render List ─────────────────────────────────────────────────

  renderFieldsList() {
    const container = document.getElementById('savedFieldsList');
    
    const filtered = this.allSavedFields.filter(f => {
      const labelMatch = f.label.toLowerCase().includes(this.searchQuery);
      const valueMatch = f.value.toLowerCase().includes(this.searchQuery);
      return labelMatch || valueMatch;
    });

    if (filtered.length === 0) {
      if (this.searchQuery) {
        container.innerHTML = `
          <div class="empty-state">
            <h3>No search matches</h3>
            <p>Try searching for a different keyword or value.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <h3>No saved fields yet</h3>
            <p>Click the <strong>+</strong> button above to add your first field manually, or submit form fields to save them.</p>
          </div>
        `;
      }
      return;
    }

    container.innerHTML = '';
    filtered.forEach((field) => {
      // Find the absolute original index in allSavedFields
      const originalIndex = this.allSavedFields.findIndex(f => f.label === field.label);
      if (originalIndex === -1) return;

      const card = document.createElement('div');
      card.className = 'field-card';
      card.id = `field-card-${originalIndex}`;
      
      card.innerHTML = `
        <div class="field-card-main">
          <div class="field-type-indicator" title="Type: ${field.fieldType}">
            ${getFieldIcon(field.fieldType)}
          </div>
          <div class="field-details" id="details-container-${originalIndex}">
            <div class="field-label-text" id="label-text-${originalIndex}">${this.escapeHtml(field.label)}</div>
            <div class="field-value-text" id="value-text-${originalIndex}" title="Click to edit inline">${this.escapeHtml(field.value)}</div>
          </div>
        </div>
        <div class="field-card-actions">
          <button class="card-btn" id="copy-btn-${originalIndex}" title="Copy to clipboard">
            <svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
          <button class="card-btn" id="edit-btn-${originalIndex}" title="Edit field">
            <svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="card-btn card-btn-delete" id="del-btn-${originalIndex}" title="Delete field">
            <svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      container.appendChild(card);
    });
  }

  // ─── Inline Card Editing ──────────────────────────────────────────

  startInlineEditing(index) {
    const detailsContainer = document.getElementById(`details-container-${index}`);
    if (!detailsContainer) return;

    const originalLabel = this.allSavedFields[index].label;
    const originalValue = this.allSavedFields[index].value;
    
    // Check if already editing
    if (detailsContainer.querySelector('.inline-edit-input')) return;

    detailsContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
        <input type="text" class="inline-edit-input" id="edit-input-label-${index}" value="${this.escapeHtml(originalLabel)}" placeholder="Label" style="font-weight: 700; margin-bottom: 2px;">
        <input type="text" class="inline-edit-input" id="edit-input-value-${index}" value="${this.escapeHtml(originalValue)}" placeholder="Value">
        <div style="display: flex; gap: 8px; margin-top: 4px;">
          <button class="btn-solid" id="save-edit-btn-${index}" style="padding: 4px 10px; font-size: 10.5px; border-radius: 4px; flex: none;">Save</button>
          <button class="btn-outline" id="cancel-edit-btn-${index}" style="padding: 4px 10px; font-size: 10.5px; border-radius: 4px; flex: none;">Cancel</button>
        </div>
      </div>
    `;

    const valueInput = document.getElementById(`edit-input-value-${index}`);
    valueInput.focus();
    valueInput.select();

    // Keydown shortcuts inside inputs (Enter: Save, Escape: Cancel)
    const handleKey = (e) => {
      if (e.key === 'Enter') {
        this.saveInlineEdit(index);
      } else if (e.key === 'Escape') {
        this.renderFieldsList();
      }
    };

    document.getElementById(`edit-input-label-${index}`).addEventListener('keydown', handleKey);
    valueInput.addEventListener('keydown', handleKey);
  }

  saveInlineEdit(index) {
    const newLabel = document.getElementById(`edit-input-label-${index}`).value.trim();
    const newValue = document.getElementById(`edit-input-value-${index}`).value.trim();

    if (!newLabel || !newValue) {
      this.showStatus('Label and value must not be empty.', 'error');
      return;
    }

    // Check if the new label already exists on a DIFFERENT card
    const collision = this.allSavedFields.findIndex(
      (f, i) => i !== index && f.label.toLowerCase() === newLabel.toLowerCase()
    );
    if (collision >= 0) {
      this.showStatus(`A field named "${newLabel}" already exists.`, 'error');
      return;
    }

    // Immutable update
    this.allSavedFields = this.allSavedFields.map((f, i) =>
      i === index
        ? { ...f, label: newLabel, value: newValue, patterns: [newLabel.toLowerCase().replace(/\s+/g, '_')] }
        : f
    );

    this.renderFieldsList();

    chrome.storage.local.set({ saved_fields: this.allSavedFields }, () => {
      this.showStatus('Saved updates successfully.', 'success');
    });
  }

  copyToClipboard(text, btnId) {
    const performFeedback = () => {
      const btn = document.getElementById(btnId);
      if (!btn) return;

      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<svg style="width:14px; height:14px; fill:none; stroke:var(--success); stroke-width:2.5;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      this.showStatus('Copied value to clipboard.', 'success');
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 1500);
    };

    // Universal browser support check for clipboard APIs
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(performFeedback).catch(() => this.fallbackCopyToClipboard(text, performFeedback));
    } else {
      this.fallbackCopyToClipboard(text, performFeedback);
    }
  }

  fallbackCopyToClipboard(text, callback) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed'; // Avoid scrolling to bottom
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        callback();
      } else {
        this.showStatus('Unable to copy value.', 'error');
      }
    } catch (e) {
      this.showStatus('Clipboard copy blocked by browser.', 'error');
    }
  }

  deleteField(index) {
    const field = this.allSavedFields[index];

    // Immutable remove
    this.allSavedFields = [
      ...this.allSavedFields.slice(0, index),
      ...this.allSavedFields.slice(index + 1)
    ];
    this.renderFieldsList();

    chrome.storage.local.set({ saved_fields: this.allSavedFields }, () => {
      this.showStatus(`Deleted "${field.label}"`, 'success');
    });
  }

  // ─── Save Prompt Handler ──────────────────────────────────────────

  showSavePrompt(fields) {
    // Filter out empty / unlabelled fields
    const safe = fields.filter(f => f.value && f.label && f.label.length > 0);
    if (safe.length === 0) return;

    // De-duplicate incoming fields by label (keep last occurrence)
    const deduped = [];
    const seenLabels = new Map();
    safe.forEach(f => seenLabels.set(f.label.toLowerCase(), f));
    seenLabels.forEach(f => deduped.push(f));

    this.pendingFields = deduped;

    const container = document.getElementById('fieldsToSaveList');

    // Count truly new fields (not already saved with identical label+value)
    const newCount = deduped.filter(f => {
      const existing = this.allSavedFields.find(
        s => s.label.toLowerCase() === f.label.toLowerCase()
      );
      return !existing || existing.value !== f.value;
    }).length;

    document.getElementById('savePromptCount').textContent =
      `${newCount} new${deduped.length !== newCount ? `, ${deduped.length - newCount} update${deduped.length - newCount !== 1 ? 's' : ''}` : ''}`;

    container.innerHTML = deduped.map((f) => {
      const existing = this.allSavedFields.find(
        s => s.label.toLowerCase() === f.label.toLowerCase()
      );
      const isDuplicate = existing && existing.value === f.value;
      const isUpdate    = existing && existing.value !== f.value;

      return `
        <div class="save-prompt-item">
          <span class="save-prompt-label">
            ${this.escapeHtml(f.label)}
            ${isDuplicate ? '<span class="duplicate-badge">already saved</span>' : ''}
            ${isUpdate    ? '<span class="duplicate-badge" style="color:#86efac;background:rgba(134,239,172,0.1);border-color:rgba(134,239,172,0.25);">update</span>' : ''}
          </span>
          <span class="save-prompt-value" title="${this.escapeHtml(f.value)}">${this.escapeHtml(f.value)}</span>
        </div>
      `;
    }).join('');

    document.getElementById('savePrompt').style.display = 'block';
    this.switchTab('autofill');
  }

  savePendingFields() {
    if (!this.pendingFields) return;

    // Skip fields that are exact duplicates (same label + same value)
    const toSave = this.pendingFields.filter(newField => {
      const existing = this.allSavedFields.find(
        f => f.label.toLowerCase() === newField.label.toLowerCase()
      );
      return !existing || existing.value !== newField.value;
    });

    // Immutable upsert — build a new array from scratch
    const updated = [...this.allSavedFields];
    toSave.forEach(newField => {
      const idx = updated.findIndex(
        f => f.label.toLowerCase() === newField.label.toLowerCase()
      );
      const cleaned = {
        label: newField.label,
        value: newField.value,
        fieldType: newField.fieldType || 'text',
        patterns: [newField.label.toLowerCase().replace(/\s+/g, '_')]
      };
      if (idx >= 0) {
        updated[idx] = cleaned;
      } else {
        updated.push(cleaned);
      }
    });

    this.allSavedFields = updated;
    this.renderFieldsList();
    document.getElementById('savePrompt').style.display = 'none';

    const skipped = this.pendingFields.length - toSave.length;
    const savedCount = toSave.length;

    chrome.storage.local.set({
      saved_fields: this.allSavedFields,
      has_pending: false,
      pending_fields: []
    }, () => {
      if (savedCount === 0) {
        this.showStatus('All fields were already saved — nothing new.', 'success');
      } else {
        this.showStatus(
          `Saved ${savedCount} field${savedCount !== 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped` : ''}.`,
          'success'
        );
      }
      this.pendingFields = null;
    });
  }

  rejectSavePrompt() {
    document.getElementById('savePrompt').style.display = 'none';
    this.pendingFields = null;
    chrome.storage.local.set({ has_pending: false, pending_fields: [] }, () => {
      this.showStatus('Discarded detected fields.', 'success');
    });
  }

  // ─── Chrome Message Listener ──────────────────────────────────────

  setupMessageListener() {
    try {
      chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'show_save_prompt') {
          this.showSavePrompt(message.fields);
        }
      });
    } catch (e) {
      console.warn('[Fillora] Message listener registration skipped.', e);
    }
  }

  // ─── Export & Import ──────────────────────────────────────────────

  exportData() {
    if (this.allSavedFields.length === 0) {
      this.showStatus('No saved fields found to export.', 'error');
      return;
    }

    try {
      const json = JSON.stringify(this.allSavedFields, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fillora-fields-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showStatus(`Successfully exported ${this.allSavedFields.length} fields.`, 'success');
    } catch (e) {
      this.showStatus('Failed to generate export file.', 'error');
    }
  }

  handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error('Not an array');

        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        // Build a fresh copy so we never mutate in place
        const updated = [...this.allSavedFields];

        imported.forEach(importedField => {
          if (!importedField.label || !importedField.value) return;

          const cleaned = {
            label: importedField.label,
            value: importedField.value,
            fieldType: importedField.fieldType || 'text',
            patterns: importedField.patterns || [importedField.label.toLowerCase().replace(/\s+/g, '_')]
          };

          const idx = updated.findIndex(
            f => f.label.toLowerCase() === cleaned.label.toLowerCase()
          );

          if (idx >= 0) {
            if (updated[idx].value === cleaned.value) {
              skippedCount++;   // exact duplicate — skip silently
            } else {
              updated[idx] = cleaned;
              updatedCount++;   // same label, different value — update
            }
          } else {
            updated.push(cleaned);
            addedCount++;
          }
        });

        this.allSavedFields = updated;
        this.renderFieldsList();

        chrome.storage.local.set({ saved_fields: this.allSavedFields }, () => {
          const parts = [];
          if (addedCount)   parts.push(`${addedCount} added`);
          if (updatedCount) parts.push(`${updatedCount} updated`);
          if (skippedCount) parts.push(`${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped`);
          this.showStatus(parts.length ? parts.join(', ') + '.' : 'Nothing imported.', 'success');
        });
      } catch {
        this.showStatus('Invalid backup file format.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  clearAllData() {
    if (!confirm('Are you sure you want to permanently delete all saved fields?')) return;
    
    // Update local cache synchronously first (Zero Latency!)
    this.allSavedFields = [];
    this.renderFieldsList();

    chrome.storage.local.set({ saved_fields: [], has_pending: false, pending_fields: [] }, () => {
      this.showStatus('Successfully cleared all stored data.', 'success');
    });
  }

  // ─── Status Notifications ────────────────────────────────────────

  showStatus(message, type = 'success') {
    const bar = document.getElementById('statusBar');
    if (!bar) return;
    
    bar.textContent = message;
    bar.className = `status-bar show ${type}`;
    
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      bar.classList.remove('show');
    }, 2500);
  }

  // ─── General Helpers ──────────────────────────────────────────────

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// ── Instantiate Controller ──────────────────────────────────────────
const popup = new FilloraPopup();
window.popup = popup;
