// background.js - Service worker for handling messages

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'prompt_save_fields') {
    // Forward to popup if it's open, otherwise store for later
    chrome.runtime.sendMessage({
      action: 'show_save_prompt',
      fields: message.fields
    }).catch(() => {
      // Popup not open, could store in IndexedDB for persistence
      // For now, we'll just skip
    });
  }
});

// Optional: Listen for install event
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      saved_fields: [],
      autofill_enabled: true,
      show_indicators: true
    });
  }
});
