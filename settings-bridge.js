const DEFAULTS = { enabled: true };

function publish(enabled) {
  document.dispatchEvent(new CustomEvent('tm-watch-config', { detail: { enabled } }));
}

function loadAndPublish() {
  chrome.storage.sync.get(DEFAULTS, ({ enabled }) => publish(enabled));
}

document.addEventListener('tm-watch-request-config', loadAndPublish);
document.addEventListener('tm-watch-set-enabled', (event) => {
  chrome.storage.sync.set({ enabled: event.detail?.enabled !== false });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.enabled) publish(changes.enabled.newValue);
});
loadAndPublish();
