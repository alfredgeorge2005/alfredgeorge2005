# Gmail Excel Automation Site

A simple web app that lets users:

1. Connect a Gmail account with OAuth.
2. Upload an Excel/CSV file of contacts.
3. Preview extracted emails.
4. Send personalized automated email campaigns through Gmail API.

> ⚠️ Use this only for permission-based messaging and in compliance with Google policies and anti-spam laws.

## Contact file format

Use `.xlsx`, `.xls`, or `.csv` with at least one of these email column names:

- `email`
- `gmail`
- `e-mail`

Optional name columns:

- `name`
- `fullname`
- `full name`

## Setup

1. Create Google OAuth credentials in Google Cloud Console.
2. Add authorized redirect URI:
   - `http://localhost:3000/oauth2callback`
3. Create `.env` from `.env.example` and fill values.
4. Install and run:

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Template placeholders

You can use these placeholders in subject/body:

- `{{name}}`
- `{{email}}`

## Endpoints

- `GET /api/auth/url` - OAuth URL for Gmail connect
- `GET /oauth2callback` - OAuth callback
- `POST /api/preview-contacts` - Preview uploaded contacts file
- `POST /api/send-campaign` - Send campaign to uploaded contacts
