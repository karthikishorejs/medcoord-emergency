# Kaathu

A healthcare PWA that lets elderly patients manage medications and generate emergency QR codes for first responders.

**Live:** [kaathu.vercel.app](https://kaathu.vercel.app)

## Features

- **Voice-First Medication Entry** – Tap the mic, say your medication name and dosage; AI parses it into structured data
- **Schedule Picker** – Choose Morning (8 AM), Afternoon (1 PM), Night (8 PM), or As Needed (PRN) for each medication
- **AI Condition Detection** – Automatically identifies the medical condition each medication treats (e.g., Metformin → Diabetes)
- **Today's View** – Daily medication checklist with adherence tracking, status badges (Taken, Due, Overdue), and a separate As Needed section for PRN medications
- **Prescription Scan** – Capture or upload a prescription photo; extract medications via Claude OCR
- **Emergency QR Code** – Generate a scannable QR code that opens the responder view directly
- **Responder View** – Emergency responders scan the QR to see patient medications instantly
- **Drug Interaction Check** – Flags potential interactions between medications (via You.com)
- **Offline Support** – Service worker caches the app for offline access

## Tech Stack

- Vanilla JavaScript (no frameworks)
- Tailwind CSS via CDN
- QR generation: qrcode.js / QR scanning: jsQR
- Vercel serverless functions for API routes
- APIs:
  - **Anthropic Claude Sonnet 4** – Prescription OCR
  - **Anthropic Claude Haiku 4.5** – Medication parsing and condition detection
  - **Deepgram Nova 2** – Voice-to-text transcription
  - **You.com** – Drug interaction search

## Setup

```bash
# 1. Clone the repo
git clone https://github.com/karthikishorejs/kaathu.git
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
│   ├── parse-medication.js      AI transcript parser (Claude Haiku 4.5)
│   ├── drug-condition.js        AI condition lookup (Claude Haiku 4.5)
│   ├── extract-prescription.js  Prescription OCR (Claude Sonnet 4)
│   ├── voice-to-med.js          Voice transcription (Deepgram)
│   └── drug-interactions.js     Interaction search (You.com)
├── public/
│   ├── index.html               Main app (patient view)
│   ├── emergency.html           Responder QR scanner
│   ├── sw.js                    Service worker (offline)
│   └── manifest.json            PWA manifest
├── tests/
│   ├── api/
│   │   ├── parse-medication.test.js
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
# Run all tests (89 tests across 5 suites)
npm test
```

## Deployment

```bash
# Deploy to Vercel
npx vercel --prod
```

Set the environment variables in the Vercel dashboard under **Settings > Environment Variables**:
- `ANTHROPIC_API_KEY` – Claude AI for prescription OCR, medication parsing, and condition detection
- `DEEPGRAM_API_KEY` – Deepgram for voice-to-text transcription
- `YOU_API_KEY` – You.com for drug interaction searches

## Pages

| URL              | Purpose                        |
|------------------|--------------------------------|
| `/`              | Patient medication manager     |
| `/emergency.html`| Emergency responder QR scanner |

## Design Principles

- Voice-first input for accessibility
- Large touch targets (minimum 56px) for elderly users
- High contrast color scheme
- Mobile-first responsive layout
- Installable as PWA on iOS and Android
