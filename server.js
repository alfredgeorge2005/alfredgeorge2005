const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    cb(null, `${timestamp}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(extension)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, or .csv files are allowed.'));
    }
  }
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

let oauthTokens = null;

function createGmailClient() {
  if (!oauthTokens) {
    throw new Error('Gmail account is not connected yet. Use OAuth connect first.');
  }
  oauth2Client.setCredentials(oauthTokens);
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  return rows
    .map((row) => {
      const normalized = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), String(v).trim()])
      );

      return {
        email: normalized.email || normalized.gmail || normalized['e-mail'] || '',
        name: normalized.name || normalized.fullname || normalized['full name'] || ''
      };
    })
    .filter((contact) => contact.email);
}

function createRawEmail({ to, subject, message }) {
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    message
  ];

  return Buffer.from(emailLines.join('\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function applyTemplate(template, contact) {
  return template
    .replace(/{{\s*name\s*}}/gi, contact.name || '')
    .replace(/{{\s*email\s*}}/gi, contact.email || '');
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/auth/url', (_req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    prompt: 'consent'
  });

  res.json({ authUrl });
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Missing OAuth code.');
    }

    const { tokens } = await oauth2Client.getToken(code);
    oauthTokens = tokens;

    return res.redirect('/?connected=1');
  } catch (error) {
    return res.status(500).send(`OAuth setup failed: ${error.message}`);
  }
});

app.post('/api/preview-contacts', upload.single('contactsFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const contacts = parseExcel(req.file.path);
    return res.json({
      count: contacts.length,
      sample: contacts.slice(0, 10)
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/send-campaign', upload.single('contactsFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Contacts file is required.' });
    }

    const { subject, messageTemplate } = req.body;
    if (!subject || !messageTemplate) {
      return res.status(400).json({ error: 'Subject and message template are required.' });
    }

    const contacts = parseExcel(req.file.path);
    if (!contacts.length) {
      return res.status(400).json({ error: 'No valid contacts found. Include an email column.' });
    }

    const gmail = createGmailClient();

    const results = [];
    for (const contact of contacts) {
      const personalizedMessage = applyTemplate(messageTemplate, contact);
      const raw = createRawEmail({
        to: contact.email,
        subject: applyTemplate(subject, contact),
        message: personalizedMessage
      });

      try {
        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw }
        });

        results.push({ email: contact.email, status: 'sent', id: response.data.id });
      } catch (sendError) {
        results.push({ email: contact.email, status: 'failed', error: sendError.message });
      }
    }

    return res.json({ total: contacts.length, results });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }

  if (err) {
    return res.status(400).json({ error: err.message || 'Unexpected error' });
  }

  return res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
