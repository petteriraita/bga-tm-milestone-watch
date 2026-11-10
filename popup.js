const enabled = document.getElementById('enabled');

chrome.storage.sync.get({ enabled: true }, (saved) => {
  enabled.checked = saved.enabled;
});

enabled.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabled.checked });
});

document.getElementById('refresh-tab').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.id) chrome.tabs.reload(tab.id);
    window.close();
  });
});

document.getElementById('reload-extension').addEventListener('click', () => {
  chrome.runtime.reload();
});
