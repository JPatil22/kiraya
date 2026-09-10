document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['apiEndpoint', 'apiKey'], (result) => {
    if (result.apiEndpoint) document.getElementById('apiEndpoint').value = result.apiEndpoint;
    if (result.apiKey) document.getElementById('apiKey').value = result.apiKey;
  });

  document.getElementById('saveBtn').addEventListener('click', () => {
    const apiEndpoint = document.getElementById('apiEndpoint').value;
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.local.set({ apiEndpoint, apiKey }, () => {
      document.getElementById('status').innerText = 'Saved successfully!';
      setTimeout(() => { document.getElementById('status').innerText = ''; }, 2000);
    });
  });
});
