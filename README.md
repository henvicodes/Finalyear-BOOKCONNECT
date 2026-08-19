# BookConnect

A blockchain-enabled, AI-driven digital publishing platform connecting authors, publishers, and readers — with AI writing assistance, content recommendations, reader–writer matching, plagiarism detection, and Web3 wallet payments.

MERN stack (MongoDB, Express, React, Node) + Socket.io for real-time chat + Web3/MetaMask for wallet payments + Claude/Google Gemini for AI features.

## Features

- **Auth** — OTP email verification, JWT sessions, role-based access (reader / author / publisher)
- **Publishing pipeline** — authors upload manuscripts → submit to a publisher → publisher proposes a fee → author pays from their wallet → book goes live, chapter by chapter
- **AI writing assistant** — Gemini-backed rewriting (simplify / formalize / summarize), with an offline rule-based fallback when no API key is configured
- **Plagiarism detection** — TF-IDF + cosine similarity against other published manuscripts' actual text (see [`backend/utils/textSimilarity.js`](backend/utils/textSimilarity.js))
- **Personalized recommendations** — content-based filtering (TF-IDF + cosine similarity) over a reader's purchase/rating history and stated interests, at `/recommendations`
- **Reader–writer/publisher matching** — profile-similarity matching (same TF-IDF approach applied to bios/interests) at `/matching`
- **Weighted book ranking** — `Final Score = α·UserRating + β·AIQualityScore + γ·EngagementScore`, computed via a MongoDB aggregation pipeline (`sort=ranked` on `GET /api/books`)
- **Manuscript version history** — a SHA-256 content-hash snapshot recorded on every create/edit/publish, viewable in the Author Dashboard's Blockchain tab
- **Multilingual translation** — Claude if configured, else Gemini, else the free MyMemory API — translate any chapter into Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Spanish, French, German, Chinese, Japanese, or Arabic
- **Real blockchain anchoring** — two Solidity smart contracts deployed to the public Ethereum Sepolia testnet (see [`blockchain/`](blockchain)): `ManuscriptRegistry` for content-hash proof-of-authorship, and `PaymentLedger` for P2P wallet transfers. Both are called directly from the user's own connected MetaMask wallet — the app never holds or signs with a private key
- **Wallet & payments** — an in-app USD-style wallet balance; P2P transfers between users with a linked MetaMask wallet move real Sepolia ETH and record the payment on-chain in one atomic transaction via `PaymentLedger.makePayment` (see note below)
- **Real-time chat** — Socket.io messaging between authors/readers/publishers, plus a built-in AI assistant contact
- **Light/dark theme** — a full design-system token system with a persisted toggle

### Note on "blockchain"
Two parts of this app are genuinely on-chain, and one is a fingerprint stored in MongoDB — kept distinct rather than blurred together:

- **Real on-chain (Sepolia testnet, verifiable on Etherscan):**
  - `ManuscriptRegistry.sol` — an author's own MetaMask wallet registers/updates a manuscript's content hash on-chain (see [`frontend/src/services/manuscriptRegistry.js`](frontend/src/services/manuscriptRegistry.js))
  - `PaymentLedger.sol` — when a sender pays another user who has a linked wallet, their MetaMask signs a single transaction that both forwards the real ETH and records the structured payment on-chain (see [`frontend/src/services/paymentLedger.js`](frontend/src/services/paymentLedger.js)); if the forward fails, the whole transaction — including the record — reverts, so the two can never go out of sync
- **Simulated ledger (MongoDB, not a distributed ledger):** the default "manuscript registered on the blockchain" flow (`POST /api/blockchain/register/:id`) and version-history snapshots compute a SHA-256 hash and store it in Mongo — a genuine content fingerprint, but not a write to Ethereum. Off-chain-only wallet transfers (when the recipient hasn't linked a wallet yet) are recorded the same way, clearly marked `onChain: false` in the transaction ledger rather than given a fake-looking hash.

Both contracts' source is in [`blockchain/contracts/`](blockchain/contracts), with Hardhat tests in [`blockchain/test/`](blockchain/test).

## Project structure

```
backend/    Express API, MongoDB models, Socket.io server
frontend/   React (Vite) app
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://localhost:27017`) or an Atlas connection string
- A Gmail account with an [App Password](https://myaccount.google.com/apppasswords) (for OTP emails) — 2-Step Verification must be enabled first
- Optional: a [Gemini API key](https://aistudio.google.com/apikey) for higher-quality AI writing assistance and translation (the app works without one — it falls back to offline/free alternatives)

### Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT_SECRET, EMAIL_USER, EMAIL_PASS
npm run start
```

Runs on `http://localhost:5000`. Confirm it's up: `curl http://localhost:5000/api/health`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`. No `.env` needed for local dev — it talks to `http://localhost:5000` by default.

### Seed data (optional)

```bash
cd backend
node seed.js
```

Populates the database with demo users, books, and chapters. Check `backend/seed.js` for the seeded account credentials.

## Testing

```bash
cd backend
npm test
```

See [`backend/tests`](backend/tests) for coverage of auth, the publishing workflow, and purchases.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Vite, Axios |
| Backend | Node.js, Express 5, Socket.io |
| Database | MongoDB (Mongoose) |
| Auth | JWT, bcrypt, email OTP |
| AI | Claude or Google Gemini API (both optional), plain-JS TF-IDF/cosine similarity for recommendations/matching/plagiarism |
| Translation | Claude (optional) → Google Gemini (optional) → the free MyMemory API |
| Web3 | MetaMask (`window.ethereum`) for wallet connect and transfers |
