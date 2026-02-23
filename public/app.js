const connectBtn = document.getElementById('connectBtn');
const authStatus = document.getElementById('authStatus');
const previewForm = document.getElementById('previewForm');
const previewOutput = document.getElementById('previewOutput');
const campaignForm = document.getElementById('campaignForm');
const campaignOutput = document.getElementById('campaignOutput');

const params = new URLSearchParams(window.location.search);
if (params.get('connected') === '1') {
  authStatus.textContent = 'Connected ✅';
}

connectBtn.addEventListener('click', async () => {
  try {
    const response = await fetch('/api/auth/url');
    const data = await response.json();
    window.location.href = data.authUrl;
  } catch (error) {
    authStatus.textContent = `Failed: ${error.message}`;
  }
});

previewForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  previewOutput.textContent = 'Loading...';

  const formData = new FormData(previewForm);

  try {
    const response = await fetch('/api/preview-contacts', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    previewOutput.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    previewOutput.textContent = `Failed: ${error.message}`;
  }
});

campaignForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  campaignOutput.textContent = 'Sending emails...';

  const formData = new FormData(campaignForm);

  try {
    const response = await fetch('/api/send-campaign', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    campaignOutput.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    campaignOutput.textContent = `Failed: ${error.message}`;
  }
});
