# Kaathu

A healthcare PWA that lets users manage medications and generate emergency QR codes for first responders.

## Features

- **Medication Entry** – Add medications with name, dosage, and instructions
- **Prescription Scan** – Capture or upload a prescription photo; extract medications via Claude OCR
- **Voice Input** – Dictate medications using Deepgram speech-to-text
- **Emergency QR Code** – Generate a scannable QR code that opens the responder view directly
- **Responder View** – Emergency responders scan the QR to see patient medications instantly
- **Drug Interaction Check** – Automatically flags potential interactions on medication cards (via You.com)
- **Offline Support** – Service worker caches the app for offline access

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Tailwind CSS via CDN
- QR generation: qrcode.js / QR scanning: jsQR
- Vercel serverless functions for API routes
- APIs: Anthropic (Claude), Deepgram, You.com

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd kaathu

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env

# 4. Fill in your API keys in .env
#    - ANTHROPIC_API_KEY  (https://console.anthropic.com/)
#    - DEEPGRAM_API_KEY   (https://console.deepgram.com/)
#    - YOU_API_KEY         (https://api.you.com/)

# 5. Run locally
npx vercel dev
```

## Project Structure

```
kaathu/
├── api/
│   ├── extract-prescription.js   Prescription OCR (Claude)
│   ├── voice-to-med.js           Voice transcription (Deepgram)
│   └── drug-interactions.js      Interaction search (You.com)
├── public/
│   ├── index.html                Main app (patient view)
│   ├── emergency.html            Responder QR scanner
│   ├── sw.js                     Service worker (offline)
│   └── manifest.json             PWA manifest
├── tests/
│   ├── api/
│   │   ├── drug-interactions.test.js
│   │   ├── extract-prescription.test.js
│   │   └── voice-to-med.test.js
│   └── frontend/
│       └── helpers.test.js
├── .env.example
├── .gitignore
├── jest.config.js
├── vercel.json
├── package.json
└── README.md
```

## Testing

```bash
# Run all tests (63 tests across 4 suites)
npm test
```

## Deployment

```bash
# Deploy to Vercel
npx vercel --prod
```

Set the environment variables in the Vercel dashboard under **Settings > Environment Variables**:
- `ANTHROPIC_API_KEY`
- `DEEPGRAM_API_KEY`
- `YOU_API_KEY`

## Pages

| URL              | Purpose                        |
|------------------|--------------------------------|
| `/`              | Patient medication manager     |
| `/emergency.html`| Emergency responder QR scanner |

## Design Principles

- Maximum 3 buttons per screen (elderly-friendly)
- Large touch targets (minimum 56px)
- High contrast color scheme
- Mobile-first responsive layout
- Installable as PWA on iOS and Android

## Demo

<!-- Add demo video or screenshots here -->
