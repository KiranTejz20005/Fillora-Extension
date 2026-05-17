// background.js — Fillora Service Worker
// Handles cross-context messaging and lifecycle events

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'prompt_save_fields') {
    // Forward to popup if it's open; otherwise store pending fields
    chrome.storage.local.set({ pending_fields: message.fields, has_pending: true }, () => {
      chrome.runtime.sendMessage({
        action: 'show_save_prompt',
        fields: message.fields
      }).catch(() => {
        // Popup is closed — pending_fields stored so popup can pick them up on next open
      });
    });
  }

  // Always return true for async responses
  return true;
});

// Extension installed / updated lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      saved_fields: [],
      autofill_enabled: true,
      show_indicators: true,
      has_pending: false,
      pending_fields: [],
      install_date: new Date().toISOString()
    });
    console.log('[Fillora] Extension installed and initialized.');
  }

  // Pre-inject content script into open tabs to prevent "Extension context invalidated" errors
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach(tab => {
      // Avoid injecting into restricted pages
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
      
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content-script.js']
      }).then(() => {
        console.log(`[Fillora] Successfully auto-injected content script into tab ${tab.id} (${tab.url})`);
      }).catch(err => {
        // Suppress errors on tabs without host permissions
      });
    });
  });

  if (details.reason === 'update') {
    console.log(`[Fillora] Extension updated to v${chrome.runtime.getManifest().version}`);
  }
});
