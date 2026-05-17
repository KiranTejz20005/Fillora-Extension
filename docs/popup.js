// popup.js - Handles popup UI interactions

class FormAutofillPopup {
  constructor() {
    this.pendingFields = null;
    this.init();
  }

  init() {
    this.setupTabs();
    this.setupButtons();
    this.loadSavedFields();
    this.setupMessageListener();
    this.loadSettings();
  }

  setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
  }

  setupButtons() {
    // Autofill button
    document.getElementById('autofillBtn').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'autofill_all' }, (response) => {
          this.showStatus('Fields autofilled!', 'success');
        });
      });
    });

    // Save fields
    document.getElementById('confirmSaveBtn')?.addEventListener('click', () => this.saveFields());
    document.getElementById('rejectSaveBtn')?.addEventListener('click', () => this.rejectSave());

    // Settings
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('importBtn').addEventListener('click', () => this.importData());
    document.getElementById('clearBtn').addEventListener('click', () => this.clearData());

    document.getElementById('enableAutofill').addEventListener('change', (e) => {
      chrome.storage.local.set({ autofill_enabled: e.target.checked });
    });

    document.getElementById('showIndicators').addEventListener('change', (e) => {
      chrome.storage.local.set({ show_indicators: e.target.checked });
    });
  }

  loadSavedFields() {
    chrome.storage.local.get(['saved_fields'], (result) => {
      const fields = result.saved_fields || [];
      const container = document.getElementById('savedFieldsList');

      if (fields.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No saved fields yet</p>
            <p style="font-size: 12px;">Fill a form and save your data to get started</p>
          </div>
        `;
        return;
      }

      container.innerHTML = fields.map((field, index) => `
        <div class="field-item">
          <div class="field-info">
            <div class="field-label">${field.label}</div>
            <div class="field-value">${field.value}</div>
          </div>
          <div class="field-actions">
            <button class="btn btn-danger" onclick="popup.deleteField(${index})">Delete</button>
          </div>
        </div>
      `).join('');
    });
  }

  deleteField(index) {
    if (!confirm('Delete this field?')) return;

    chrome.storage.local.get(['saved_fields'], (result) => {
      const fields = result.saved_fields || [];
      fields.splice(index, 1);
      chrome.storage.local.set({ saved_fields: fields }, () => {
        this.loadSavedFields();
        this.showStatus('Field deleted', 'success');
      });
    });
  }

  saveFields() {
    if (!this.pendingFields) return;

    chrome.storage.local.get(['saved_fields'], (result) => {
      let fields = result.saved_fields || [];

      // Add new fields, update existing ones
      this.pendingFields.forEach(newField => {
        const existingIndex = fields.findIndex(f => f.label === newField.label);
        if (existingIndex >= 0) {
          fields[existingIndex] = newField;
        } else {
          fields.push(newField);
        }
      });

      chrome.storage.local.set({ saved_fields: fields }, () => {
        document.getElementById('savePrompt').style.display = 'none';
        this.showStatus(`Saved ${this.pendingFields.length} field(s)!`, 'success');
        this.pendingFields = null;
      });
    });
  }

  rejectSave() {
    document.getElementById('savePrompt').style.display = 'none';
    this.pendingFields = null;
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'show_save_prompt') {
        this.showSavePrompt(message.fields);
      }
    });
  }

  showSavePrompt(fields) {
    this.pendingFields = fields;
    const container = document.getElementById('fieldsToSave');
    container.innerHTML = fields.map(f => `
      <div class="save-field-item">
        <strong>${f.label}:</strong>
        <div class="value">${f.value}</div>
      </div>
    `).join('');

    document.getElementById('savePrompt').style.display = 'block';
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status-message show status-${type}`;
    setTimeout(() => status.classList.remove('show'), 3000);
  }

  exportData() {
    chrome.storage.local.get(['saved_fields'], (result) => {
      const data = result.saved_fields || [];
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-autofill-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      this.showStatus('Data exported!', 'success');
    });
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (!Array.isArray(imported)) throw new Error('Invalid format');

          chrome.storage.local.get(['saved_fields'], (result) => {
            const current = result.saved_fields || [];
            const merged = [...current];

            imported.forEach(importedField => {
              const index = merged.findIndex(f => f.label === importedField.label);
              if (index >= 0) {
                merged[index] = importedField;
              } else {
                merged.push(importedField);
              }
            });

            chrome.storage.local.set({ saved_fields: merged }, () => {
              this.loadSavedFields();
              this.showStatus(`Imported ${imported.length} field(s)!`, 'success');
            });
          });
        } catch (err) {
          this.showStatus('Invalid file format', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  clearData() {
    if (!confirm('Delete all saved fields? This cannot be undone.')) return;

    chrome.storage.local.set({ saved_fields: [] }, () => {
      this.loadSavedFields();
      this.showStatus('All data deleted', 'success');
    });
  }

  loadSettings() {
    chrome.storage.local.get(['autofill_enabled', 'show_indicators'], (result) => {
      document.getElementById('enableAutofill').checked = result.autofill_enabled !== false;
      document.getElementById('showIndicators').checked = result.show_indicators !== false;
    });
  }
}

const popup = new FormAutofillPopup();
