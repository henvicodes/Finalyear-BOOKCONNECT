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
- **Built-in help** — a "Help & Guide" tab in every dashboard (where each feature is, with "Take me there" buttons, a searchable list, and a plain-language glossary), a first-visit welcome tour, and small "?" tips beside the confusing parts (wallet PIN, MetaMask, Sepolia testnet, publishing fee). All wording lives in [`frontend/src/content/helpContent.jsx`](frontend/src/content/helpContent.jsx)
- **Trained ML models** (see [`ml/`](ml/README.md)) — a genre classifier trained on the CMU Book Summary Dataset (78.7% top-1 / 93.7% top-3 on held-out books; used live via the "Suggest genre" button), and a collaborative-filtering recommender trained and evaluated on Goodbooks-10k (≈3× the ranking quality of a "most-liked" baseline; not yet wired into the live app — see the ml README for why)
- **Weighted book ranking** — `Final Score = α·UserRating + β·AIQualityScore + γ·EngagementScore`, computed via a MongoDB aggregation pipeline (`sort=ranked` on `GET /api/books`)
- **Manuscript version history** — a SHA-256 content-hash snapshot recorded on every create/edit/publish, viewable in the Author Dashboard's Blockchain tab
- **Multilingual translation** — Claude if configured, else Gemini, else the free MyMemory API — translate any chapter into Hindi, Marathi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Spanish, French, German, Chinese, Japanese, or Arabic
- **Real blockchain anchoring** — two Solidity smart contracts deployed to the public Ethereum Sepolia testnet (see [`blockchain/`](blockchain)): `ManuscriptRegistry` for content-hash proof-of-authorship, and `PaymentLedger` for P2P wallet transfers. Both are called directly from the user's own connected MetaMask wallet — the app never holds or signs with a private key
- **Wallet & payments** — an in-app USD-style wallet balance; P2P transfers between users with a linked MetaMask wallet move real Sepolia ETH and record the payment on-chain in one atomic transaction via `PaymentLedger.makePayment` (see note below)
- **Recommendations** — a hybrid of content-based TF-IDF similarity and item-based collaborative filtering ("readers who liked X also liked this") computed live from BookConnect's own ratings and purchases (`backend/utils/itemCF.js`; the same method that won the offline Goodbooks-10k comparison in `ml/`). With too little rating data it quietly falls back to content-only, then to trending
- **Publisher decisions** — a publisher can read the draft, make an offer, or decline with a reason; the author is told and can send the manuscript to someone else
- **Admin dashboard** — an overview with a headline figure, KPI tiles with change vs the previous period, trend charts (money by type, sign-ups, new books; 7/30/90 days, each with a table view), top books/earners/publishers and a live activity feed; plus user management (search, suspend/reinstate, change role), publisher verification review, content moderation (unpublish/delete with a reason, similarity-flagged manuscripts), a read-only payments list, platform health (stuck submissions, failed payments) and an audit log of every admin action. Admin routes are `/api/admin/*` and admin-only
- **Publisher verification** — a publisher submits a company name, a registration number (CIN, LLPIN, GSTIN, Udyam, or an ISBN-13 of one of their books — format-checked, GSTIN also check-digit-checked) and a document link; an admin looks the number up on the official register, then approves or rejects. Approval sets the Verified badge authors see and stores a SHA-256 fingerprint of what was approved. Nobody can verify themselves
- **Real-time chat** — Socket.io messaging between authors/readers/publishers, plus a built-in AI assistant contact
- **Light/dark theme** — a full design-system token system with a persisted toggle

### Note on "blockchain"
Two parts of this app are genuinely on-chain, and one is a fingerprint stored in MongoDB — kept distinct rather than blurred together:

- **Real on-chain (Sepolia testnet, verifiable on Etherscan):**
  - `ManuscriptRegistry.sol` — an author's own MetaMask wallet registers/updates a manuscript's content hash on-chain (see [`frontend/src/services/manuscriptRegistry.js`](frontend/src/services/manuscriptRegistry.js))
  - `PaymentLedger.sol` — when a sender pays another user who has a linked wallet, their MetaMask signs a single transaction that both forwards the real ETH and records the structured payment on-chain (see [`frontend/src/services/paymentLedger.js`](frontend/src/services/paymentLedger.js)); if the forward fails, the whole transaction — including the record — reverts, so the two can never go out of sync
- **Simulated ledger (MongoDB, not a distributed ledger):** the default "manuscript registered on the blockchain" flow (`POST /api/blockchain/register/:id`) and version-history snapshots compute a SHA-256 hash and store it in Mongo — a genuine content fingerprint, but not a write to Ethereum. Off-chain-only wallet transfers (when the recipient hasn't linked a wallet yet) are recorded the same way, clearly marked `onChain: false` in the transaction ledger rather than given a fake-looking hash.

Both contracts' source is in [`blockchain/contracts/`](blockchain/contracts), with Hardhat tests in [`blockchain/test/`](blockchain/test).

**The server never trusts a transaction hash from the browser.** It looks the transaction up on Sepolia (read-only, via `SEPOLIA_RPC_URL`) and only marks a payment `onChain: true` if it is a real `PaymentLedger` payment between the two users' linked wallets; a manuscript registration is only recorded if it really came from the author's wallet in `ManuscriptRegistry`. Each hash can be used once. The backend holds no private key and signs nothing. Set `SEPOLIA_RPC_URL`, `PAYMENT_LEDGER_ADDRESS` and `MANUSCRIPT_REGISTRY_ADDRESS` in `backend/.env` (see `backend/.env.example`).

### Security measures
- **Passwords** bcrypt-hashed; **wallet PIN** bcrypt-hashed, 5 wrong tries lock it for 15 minutes, and changing/resetting it needs the current PIN or the account password (`backend/scripts/hashExistingPins.js` upgrades any old plain-text PINs)
- **Sign-up codes (OTP)** stored only as a SHA-256 hash, compared in constant time, burned after 5 wrong guesses; login requires a verified e-mail; codes are only printed to the console outside production
- **Money moves are atomic**: balances change with guarded single-document updates (`backend/utils/wallet.js`), so parallel requests can't double-spend, and a failed step is rolled back. Paying (book purchase, publishing fee, transfer) requires the wallet PIN
- **Browser sessions** use an httpOnly, SameSite cookie, so page scripts (and any injected script) can never read the login token; state-changing requests must also carry an `X-Requested-With` header (CSRF guard). Logging out clears the cookie. API clients may still send `Authorization: Bearer <jwt>`
- **Chat sockets** are authenticated with that same cookie (or a JWT in the handshake); the user id comes from the verified token
- Rate limiting on login / OTP / wallet routes, `helmet` headers, a sanitizer that strips MongoDB operators from input, 7-day JWTs, and no internal error text sent to the browser
- Known limits: the "quality score" is a readability formula, not AI; sessions last 7 days with no refresh-token rotation; standalone MongoDB has no multi-document transactions, so atomicity relies on guarded updates and compensation

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

### Creating the first admin
Admins can't sign up through the website (by design). Create one from the server:

```bash
cd backend
node scripts/createAdmin.js you@example.com "Your Name"
```

The password is typed at a hidden prompt, not on the command line. Run it with an existing account's email to promote that account instead (its password is unchanged).

### Seeing the admin dashboard with data (optional)
A demo script fills a separate database with 90 days of sample users, books and payments so the charts have something to show. It refuses to run unless the database name ends in `_demo`, and wipes that database first, so it can never touch real data:

```bash
cd backend
MONGO_URI=mongodb://localhost:27017/bookConnect_demo node scripts/seedAdminDemo.js
MONGO_URI=mongodb://localhost:27017/bookConnect_demo npm start
```

Then log in as `demo-admin@example.com` / `DemoAdmin123` (demo database only).

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

See [`backend/tests`](backend/tests) for coverage of auth, the publishing workflow, purchases, the genre classifier, and security (OTP/PIN lockouts, atomic payments, on-chain verification with a mocked chain, ownership checks, authenticated sockets).

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
