// popup.js — Fillora Extension Controller

const FIELD_TYPE_ICONS = {
  email: '📧',
  tel: '📱',
  url: '🔗',
  number: '🔢',
  textarea: '📝',
  select: '📋',
  text: '📄',
  default: '📄'
};

function getFieldIcon(type) {
  return FIELD_TYPE_ICONS[type] || FIELD_TYPE_ICONS.default;
}

class FilloraPopup {
  constructor() {
    this.pendingFields = null;
    this.allSavedFields = [];
    this.init();
  }

  // ─── Initialization ──────────────────────────────────────────────

  init() {
    this.setupTabs();
    this.setupButtons();
    this.loadSavedFields();
    this.loadSettings();
    this.setupMessageListener();
    this.checkPendingFields();
    this.setupSearch();
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

    // Refresh saved fields list if visiting Saved tab
    if (tabName === 'saved') {
      this.loadSavedFields();
      this.closeAddFieldPane();
    }
  }

  // ─── Button Events & Interactions ───────────────────────────────

  setupButtons() {
    // ── Autofill Active Tab ──
    document.getElementById('autofillBtn').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
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
    });

    // ── Save Prompt confirmation ──
    document.getElementById('confirmSaveBtn').addEventListener('click', () => this.savePendingFields());
    document.getElementById('rejectSaveBtn').addEventListener('click', () => this.rejectSavePrompt());

    // ── Toggle Pane for Adding Custom Field ──
    const trigger = document.getElementById('addFieldTrigger');
    trigger.addEventListener('click', () => this.toggleAddFieldPane());

    document.getElementById('cancelAddFieldBtn').addEventListener('click', () => this.closeAddFieldPane());
    document.getElementById('saveCustomFieldBtn').addEventListener('click', () => this.saveCustomField());

    // ── Settings preferences ──
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', (e) => this.handleImport(e));
    document.getElementById('clearBtn').addEventListener('click', () => this.clearAllData());

    document.getElementById('enableAutofill').addEventListener('change', (e) => {
      chrome.storage.local.set({ autofill_enabled: e.target.checked });
      this.showStatus(e.target.checked ? 'Form detection enabled' : 'Form detection disabled', 'success');
    });

    document.getElementById('showIndicators').addEventListener('change', (e) => {
      chrome.storage.local.set({ show_indicators: e.target.checked });
      this.showStatus(e.target.checked ? 'Field badges visible' : 'Field badges hidden', 'success');
    });

    document.getElementById('instantAutofill').addEventListener('change', (e) => {
      chrome.storage.local.set({ instant_autofill: e.target.checked });
      this.showStatus(e.target.checked ? 'Instant Auto-Fill enabled' : 'Instant Auto-Fill disabled', 'success');
    });

    document.getElementById('resetTutorialBtn').addEventListener('click', (e) => {
      e.preventDefault();
      this.switchTab('autofill');
      this.showStatus('Guide tab active', 'success');
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
    
    // Reset fields
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

    chrome.storage.local.get(['saved_fields'], (result) => {
      const fields = result.saved_fields || [];
      const newField = {
        label: label,
        value: value,
        fieldType: type,
        patterns: [label.toLowerCase().replace(/\s+/g, '_')]
      };

      const existingIndex = fields.findIndex(f => f.label.toLowerCase() === label.toLowerCase());
      if (existingIndex >= 0) {
        fields[existingIndex] = newField;
      } else {
        fields.push(newField);
      }

      chrome.storage.local.set({ saved_fields: fields }, () => {
        this.closeAddFieldPane();
        this.loadSavedFields();
        this.showStatus(`Field "${label}" saved!`, 'success');
      });
    });
  }

  // ─── Search Functionality ────────────────────────────────────────

  setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      this.renderFieldsList(query);
    });
  }

  // ─── Saved Fields Loading & Rendering ────────────────────────────

  loadSavedFields() {
    chrome.storage.local.get(['saved_fields'], (result) => {
      this.allSavedFields = result.saved_fields || [];
      this.renderFieldsList();
    });
  }

  renderFieldsList(filterQuery = '') {
    const container = document.getElementById('savedFieldsList');
    
    const filtered = this.allSavedFields.filter(f => {
      const labelMatch = f.label.toLowerCase().includes(filterQuery);
      const valueMatch = f.value.toLowerCase().includes(filterQuery);
      return labelMatch || valueMatch;
    });

    if (filtered.length === 0) {
      if (filterQuery) {
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
    filtered.forEach((field, index) => {
      // Find the absolute original index in allSavedFields for deletion/updating
      const originalIndex = this.allSavedFields.findIndex(f => f.label === field.label);
      
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
            <svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2;" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
          <button class="card-btn" id="edit-btn-${originalIndex}" title="Edit field">
            <svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2;" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="card-btn card-btn-delete" id="del-btn-${originalIndex}" title="Delete field">
            <svg style="width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      container.appendChild(card);

      // Attach event listeners to card actions
      document.getElementById(`copy-btn-${originalIndex}`).addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(field.value, `copy-btn-${originalIndex}`);
      });

      document.getElementById(`edit-btn-${originalIndex}`).addEventListener('click', (e) => {
        e.stopPropagation();
        this.startInlineEditing(originalIndex);
      });

      document.getElementById(`value-text-${originalIndex}`).addEventListener('click', (e) => {
        e.stopPropagation();
        this.startInlineEditing(originalIndex);
      });

      document.getElementById(`del-btn-${originalIndex}`).addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteField(originalIndex);
      });
    });
  }

  // ─── Inline Card Editing ──────────────────────────────────────────

  startInlineEditing(index) {
    const detailsContainer = document.getElementById(`details-container-${index}`);
    const originalLabel = this.allSavedFields[index].label;
    const originalValue = this.allSavedFields[index].value;
    
    // Check if already editing to avoid duplicate input generation
    if (detailsContainer.querySelector('.inline-edit-input')) return;

    detailsContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
        <input type="text" class="inline-edit-input" id="edit-input-label-${index}" value="${this.escapeHtml(originalLabel)}" placeholder="Label" style="font-weight: 600; margin-bottom: 2px;">
        <input type="text" class="inline-edit-input" id="edit-input-value-${index}" value="${this.escapeHtml(originalValue)}" placeholder="Value">
        <div style="display: flex; gap: 6px; margin-top: 4px;">
          <button class="btn-solid" id="save-edit-btn-${index}" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; flex: none;">Save</button>
          <button class="btn-outline" id="cancel-edit-btn-${index}" style="padding: 3px 8px; font-size: 10px; border-radius: 4px; flex: none;">Cancel</button>
        </div>
      </div>
    `;

    document.getElementById(`edit-input-value-${index}`).focus();

    // Save click handler
    document.getElementById(`save-edit-btn-${index}`).addEventListener('click', (e) => {
      e.stopPropagation();
      this.saveInlineEdit(index);
    });

    // Cancel click handler
    document.getElementById(`cancel-edit-btn-${index}`).addEventListener('click', (e) => {
      e.stopPropagation();
      this.renderFieldsList(document.getElementById('searchInput').value.toLowerCase().trim());
    });

    // Keydown handlers inside inline inputs
    const handleKey = (e) => {
      if (e.key === 'Enter') this.saveInlineEdit(index);
      if (e.key === 'Escape') this.renderFieldsList(document.getElementById('searchInput').value.toLowerCase().trim());
    };

    document.getElementById(`edit-input-label-${index}`).addEventListener('keydown', handleKey);
    document.getElementById(`edit-input-value-${index}`).addEventListener('keydown', handleKey);
  }

  saveInlineEdit(index) {
    const newLabel = document.getElementById(`edit-input-label-${index}`).value.trim();
    const newValue = document.getElementById(`edit-input-value-${index}`).value.trim();

    if (!newLabel || !newValue) {
      this.showStatus('Label and value must not be empty.', 'error');
      return;
    }

    chrome.storage.local.get(['saved_fields'], (result) => {
      const fields = result.saved_fields || [];
      fields[index].label = newLabel;
      fields[index].value = newValue;
      // Re-generate basic matching patterns based on the new label
      fields[index].patterns = [newLabel.toLowerCase().replace(/\s+/g, '_')];

      chrome.storage.local.set({ saved_fields: fields }, () => {
        this.loadSavedFields();
        this.showStatus('Saved updates successfully.', 'success');
      });
    });
  }

  copyToClipboard(text, btnId) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById(btnId);
      const originalHTML = btn.innerHTML;
      
      btn.innerHTML = `<svg style="width:14px; height:14px; fill:none; stroke:var(--success); stroke-width:2.5;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      this.showStatus('Copied value to clipboard.', 'success');
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
      }, 1500);
    }).catch(() => {
      this.showStatus('Unable to copy clipboard value.', 'error');
    });
  }

  deleteField(index) {
    const field = this.allSavedFields[index];
    chrome.storage.local.get(['saved_fields'], (result) => {
      const fields = result.saved_fields || [];
      fields.splice(index, 1);
      chrome.storage.local.set({ saved_fields: fields }, () => {
        this.loadSavedFields();
        this.showStatus(`Deleted "${field.label}"`, 'success');
      });
    });
  }

  // ─── Save Prompt Handler ──────────────────────────────────────────

  showSavePrompt(fields) {
    const safe = fields.filter(f => f.value && f.label && f.label.length > 0);
    if (safe.length === 0) return;

    this.pendingFields = safe;
    const container = document.getElementById('fieldsToSaveList');
    document.getElementById('savePromptCount').textContent = `${safe.length} field${safe.length !== 1 ? 's' : ''}`;

    container.innerHTML = safe.map((f, i) => `
      <div class="save-prompt-item">
        <span class="save-prompt-label">${this.escapeHtml(f.label)}</span>
        <span class="save-prompt-value" title="${this.escapeHtml(f.value)}">${this.escapeHtml(f.value)}</span>
      </div>
    `).join('');

    document.getElementById('savePrompt').style.display = 'block';
    this.switchTab('autofill');
  }

  savePendingFields() {
    if (!this.pendingFields) return;

    chrome.storage.local.get(['saved_fields'], (result) => {
      const fields = result.saved_fields || [];

      this.pendingFields.forEach(newField => {
        const idx = fields.findIndex(f => f.label.toLowerCase() === newField.label.toLowerCase());
        const cleaned = {
          label: newField.label,
          value: newField.value,
          fieldType: newField.fieldType || 'text',
          patterns: [newField.label.toLowerCase().replace(/\s+/g, '_')]
        };
        
        if (idx >= 0) {
          fields[idx] = cleaned;
        } else {
          fields.push(cleaned);
        }
      });

      chrome.storage.local.set({ saved_fields: fields, has_pending: false, pending_fields: [] }, () => {
        document.getElementById('savePrompt').style.display = 'none';
        this.showStatus(`Successfully saved ${this.pendingFields.length} field${this.pendingFields.length !== 1 ? 's' : ''}!`, 'success');
        this.pendingFields = null;
        this.loadSavedFields();
      });
    });
  }

  rejectSavePrompt() {
    document.getElementById('savePrompt').style.display = 'none';
    chrome.storage.local.set({ has_pending: false, pending_fields: [] });
    this.pendingFields = null;
    this.showStatus('Discarded detected fields.', 'success');
  }

  checkPendingFields() {
    chrome.storage.local.get(['has_pending', 'pending_fields'], (result) => {
      if (result.has_pending && result.pending_fields?.length > 0) {
        this.showSavePrompt(result.pending_fields);
      }
    });
  }

  // ─── Chrome Message Listener ──────────────────────────────────────

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === 'show_save_prompt') {
        this.showSavePrompt(message.fields);
      }
    });
  }

  // ─── Settings Storage & Preferences ──────────────────────────────

  loadSettings() {
    chrome.storage.local.get(['autofill_enabled', 'show_indicators', 'instant_autofill'], (result) => {
      document.getElementById('enableAutofill').checked = result.autofill_enabled !== false;
      document.getElementById('showIndicators').checked = result.show_indicators !== false;
      document.getElementById('instantAutofill').checked = result.instant_autofill === true;
    });
  }

  // ─── Export & Import ──────────────────────────────────────────────

  exportData() {
    chrome.storage.local.get(['saved_fields'], (result) => {
      const data = result.saved_fields || [];
      if (data.length === 0) {
        this.showStatus('No saved fields found to export.', 'error');
        return;
      }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fillora-fields-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showStatus(`Successfully exported ${data.length} fields.`, 'success');
    });
  }

  handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error();

        chrome.storage.local.get(['saved_fields'], (result) => {
          const current = result.saved_fields || [];
          const merged = [...current];

          imported.forEach(importedField => {
            if (!importedField.label || !importedField.value) return;
            const idx = merged.findIndex(f => f.label.toLowerCase() === importedField.label.toLowerCase());
            const cleaned = {
              label: importedField.label,
              value: importedField.value,
              fieldType: importedField.fieldType || 'text',
              patterns: importedField.patterns || [importedField.label.toLowerCase().replace(/\s+/g, '_')]
            };
            if (idx >= 0) {
              merged[idx] = cleaned;
            } else {
              merged.push(cleaned);
            }
          });

          chrome.storage.local.set({ saved_fields: merged }, () => {
            this.loadSavedFields();
            this.showStatus(`Successfully imported ${imported.length} fields.`, 'success');
          });
        });
      } catch {
        this.showStatus('Invalid backup file format.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  }

  clearAllData() {
    if (!confirm('Are you sure you want to permanently delete all saved fields?')) return;
    chrome.storage.local.set({ saved_fields: [], has_pending: false, pending_fields: [] }, () => {
      this.loadSavedFields();
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
    }, 3000);
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
// Expose popup to window context to make inline onclick triggers work if any exist
window.popup = popup;
