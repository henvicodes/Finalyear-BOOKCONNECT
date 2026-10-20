# 📚 BookConnect: A Blockchain-Enabled AI-Driven Digital Publishing Platform

BookConnect is an integrated, role-based digital publishing ecosystem designed to enable secure, intelligent, and community-driven knowledge exchange. It bridges the gap between authors, readers, and publishers by combining **Artificial Intelligence (AI)** with **Blockchain technology** to streamline publishing workflows, protect intellectual property, and deliver personalized reading experiences.

> **Academic Context:** Developed as a B.Tech Major Project for the Department of Computer Science & Technology at Usha Mittal Institute of Technology, SNDT Women's University, Mumbai, during the academic year 2026–27.

---

## ✨ Key Features

### 🤖 Artificial Intelligence Integration

- **AI Writing Assistant:** Provides real-time grammar, writing style, and readability suggestions to help authors improve their manuscripts.
- **Plagiarism Detection:** Analyzes content similarity to help assess originality before publication.
- **Automated Summaries:** Generates summaries, synopses, and promotional blurbs for manuscripts.
- **Smart Book Recommendations:** Uses TF-IDF and cosine similarity to recommend relevant books based on reader interests.
- **Author–Publisher Matchmaking:** Identifies potential publishing opportunities based on author profiles and genre similarities.
- **Conversational AI Chatbot:** Assists users with platform navigation, frequently asked questions, and book discovery.

### ⛓️ Blockchain and Security

- **Digital Ownership Verification:** Generates SHA-256 hashes of manuscripts to create tamper-evident digital fingerprints.
- **Web3 Integration:** Supports MetaMask wallet connectivity to associate blockchain identities with ownership verification.
- **Immutable Ownership Records:** Records timestamped ownership information on a blockchain to support transparent verification of content integrity.

### 👥 Multi-Role Ecosystem

BookConnect provides dedicated functionality for four types of users:

1. **Author:** Create and manage manuscripts, use AI-powered writing tools, register blockchain ownership, and submit manuscripts to publishers.
2. **Reader:** Discover books, filter by genre, track reading progress, purchase premium content, submit reviews, and interact with the AI chatbot.
3. **Publisher:** Review manuscript submissions, perform AI-assisted quality checks, negotiate publishing fees, and manage book catalogs.
4. **Administrator:** Oversee platform operations, verify users, and manage book listings.

### 💳 Secure Monetization

- **Payment Gateway:** Supports payment processing for premium books and subscription-based services.
- **PIN-Based Authorization:** Adds an additional security layer by requiring a four-digit PIN for wallet balance access and transaction approvals.

---

## 🛠️ Technology Stack

### Frontend

- React.js with Vite
- React Router DOM
- Lucide React
- Ethers.js / Web3.js for blockchain interactions

### Backend

- Node.js
- Express.js
- MongoDB with Mongoose
- JSON Web Tokens (JWT) for authentication
- Socket.IO for real-time messaging and notifications
- Nodemailer for OTP verification and email services

### Artificial Intelligence and NLP

- Python and NLP libraries for text processing and similarity analysis
- TF-IDF and cosine similarity for recommendations and matchmaking
- External Large Language Model (LLM) APIs for chatbot and advanced writing assistance

### Blockchain

- Ethereum
- Solidity for smart contract development
- MetaMask for wallet connectivity and Web3 interactions

---

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

Ensure that the following tools and services are available on your system:

- [Node.js](https://nodejs.org/) — Version 16.x or higher
- [MongoDB](https://www.mongodb.com/) — Local installation or MongoDB Atlas
- [MetaMask](https://metamask.io/) — Browser extension
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/henvicodes/Finalyear-BOOKCONNECT.git
cd Finalyear-BOOKCONNECT
```

### 2. Backend Setup

Navigate to the backend directory and install the dependencies:

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Configuration
MONGO_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_secure_jwt_secret

# Email Service
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password

# Blockchain Configuration
CONTRACT_ADDRESS=your_deployed_contract_address
PAYMENT_LEDGER_ADDRESS=your_payment_ledger_contract_address
```

Start the backend development server:

```bash
npm run dev
```

### 3. Frontend Setup

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend
npm install
```

Create a `.env` file inside the `frontend` directory:

```env
VITE_API_URL=http://localhost:5000
VITE_CONTRACT_ADDRESS=your_deployed_contract_address
VITE_PAYMENT_LEDGER_ADDRESS=your_payment_ledger_contract_address
```

Start the frontend development server:

```bash
npm run dev
```

### 4. Access the Application

Open your browser and navigate to:

**http://localhost:5173**

Ensure that the backend server and MongoDB connection are running before using the application.

---

## 🧪 Testing

The platform's core workflows have been validated through functional testing. Key test areas include:

- **Authentication:** Email validation, password requirements, and JWT-based role assignment.
- **AI Features:** Plagiarism threshold checks, readability assessment, and chatbot fallback responses.
- **Publishing Workflow:** Publisher acceptance and rejection actions, manuscript submissions, and fee negotiations.
- **Blockchain:** SHA-256 hash generation, ownership registration, and tamper detection during verification.
- **Payments:** Transaction status validation and access restrictions following unsuccessful transactions.

---

## 🔮 Future Scope

- **Hybrid Recommendation Engine:** Combine content-based filtering with collaborative filtering and user behavior analysis.
- **Advanced AI Plagiarism Detection:** Incorporate semantic similarity analysis and larger reference datasets to improve contextual matching.
- **Real-Time Collaborative Editing:** Enable multiple authors to collaborate on manuscripts simultaneously.
- **Scalable Blockchain Infrastructure:** Explore Layer-2 blockchain networks to improve transaction throughput and reduce gas fees.
- **Enhanced Personalization:** Improve book discovery using reading history, preferences, and engagement patterns.
- **Expanded Publishing Ecosystem:** Introduce author analytics, publisher performance tracking, and reader engagement tools.

---

## 👥 The Team

| Team Member     | Roll Number |
| --------------- | ----------: |
| Arpita Gupta    |          22 |
| Alfiya Inamdar  |          25 |
| Sarika Mahalnar |          43 |
| Henvi Patel     |          53 |

**Project Guide:** Dr. Sumedh Pundkar

**Institution:** Usha Mittal Institute of Technology, SNDT Women's University, Mumbai, India.

---

## 📄 License

This project was developed for academic purposes as part of the B.Tech Major Project for the academic year 2026–27.

**Copyright © 2026 BookConnect. All rights reserved.**

---

_BookConnect — Empowering authors, connecting readers, and transforming digital publishing through AI and blockchain technology._
