# System Architecture - BookConnect Platform

## 1. Overview
**BookConnect** is an integrated digital publishing, author collaboration, and manuscript evaluation platform. It bridges the gap between **Authors**, **Publishers**, **Readers**, and **Administrators** by leveraging modern web technologies, AI-powered evaluation (readability analysis, automated review, synopsis generation), cryptographic manuscript verification (blockchain-style ledger integrity hashing), and real-time communication via WebSockets.

---

## 2. High-Level Architecture Diagram

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (Frontend - React + Vite)"]
        UI_Author["Author Portal"]
        UI_Publisher["Publisher Workspace"]
        UI_Reader["Reader Hub & Store"]
        UI_Admin["Admin Management Dashboard"]
        Socket_Client["Socket.io Client (Real-time Chat & Alerts)"]
    end

    subgraph GatewayLayer ["Network & Security Layer"]
        CORS["CORS Policy & Headers"]
        JWT_Auth["JWT Authentication Guard & Role-Based Access Control"]
    end

    subgraph ServiceLayer ["Application Server Layer (Node.js & Express)"]
        AuthService["Auth Controller (Register, Login, Token Gen)"]
        BookService["Book & Manuscript Controller"]
        AIService["AI Evaluation Engine (Google Gemini / Readability / Plagiarism)"]
        LedgerService["Blockchain & Cryptographic Ledger Engine (SHA-256)"]
        ChatService["Socket.io Real-Time Messaging & Typing Engine"]
        AdminService["Admin Analytics & User/Book Moderation"]
    end

    subgraph DataLayer ["Data & Storage Layer"]
        MongoDB[("MongoDB Database (Mongoose ORM)")]
        LocalUploads["File System / Upload Storage"]
    end

    subgraph ExternalServices ["External Third-Party APIs"]
        GeminiAPI["Google Gemini AI API"]
        EmailService["Nodemailer / SMTP Provider"]
    end

    %% Flow connections
    ClientLayer -->|HTTPS / REST API| GatewayLayer
    Socket_Client <-->|WSS (WebSocket)| ChatService
    GatewayLayer --> ServiceLayer
    
    ServiceLayer -->|Queries & Updates| MongoDB
    ServiceLayer -->|Store/Retrieve Files| LocalUploads
    AIService -->|Prompts & Summaries| GeminiAPI
    AuthService -->|Notifications / Verification| EmailService
```

---

## 3. Architecture Layers Breakdown

### 3.1 Presentation Layer (Frontend)
- **Framework**: React.js 18+ bundled with Vite.
- **Routing**: React Router v6 with `PrivateRoute` role checks (`author`, `publisher`, `reader`, `admin`).
- **State Management**: React Context (`AuthContext`) combined with localized hooks for real-time messages and dashboards.
- **Communication Protocols**:
  - **REST API** using Axios/Fetch for CRUD operations and report generation.
  - **WebSocket (Socket.io Client)** for peer-to-peer real-time communication between Authors and Publishers, typing notifications, and instant online presence indicators.
- **Key Modules**:
  - `AuthorDashboard`: Manuscript creation, AI quality checks, copyright ledger hashing, pitch status.
  - `PublisherDashboard`: Manuscript submission review, deal proposals, author communications.
  - `ReaderDashboard`: Book browsing, reviews, reading progress, and recommendations.
  - `AdminDashboard`: Platform analytics, user role management, system health, and book moderation.

---

### 3.2 Gateway & Middleware Layer
- **CORS Handling**: Dynamic origin configuration enabling secure cross-origin communication between frontend dev/production servers and API servers.
- **Token Verification (`authMiddleware`)**: Validates JSON Web Tokens (JWT) in Authorization headers, attaching user roles and identity to requests.
- **Role Guarding**: Granular middleware enforcing strict role separation (`author`, `publisher`, `reader`, `admin`).

---

### 3.3 Application & Logic Layer (Backend)
- **Framework**: Node.js with Express.js.
- **Entry Point**: `server.js` orchestrating Express endpoints and Socket.io server.
- **Subsystems & Routes**:
  1. **Authentication (`/api/auth`)**:
     - Password hashing with Bcrypt.
     - Role assignment and profile management.
  2. **Manuscripts & Books (`/api/books`, `/api/manuscripts`)**:
     - Manuscript submission lifecycle (Draft -> Submitted -> Under Review -> Accepted/Published).
     - Filtering, genre categorization, book status management.
  3. **AI Services (`/api/ai`)**:
     - Algorithmic Flesch-Kincaid readability scoring.
     - Plagiarism heuristic scanning and duplicate token checks.
     - Google Gemini Generative AI integration for synopsis generation, grammar recommendations, and critique feedback.
  4. **Cryptographic Blockchain & Integrity (`/api/blockchain`)**:
     - Generates tamper-proof SHA-256 cryptographic signatures of manuscripts combining content, author ID, and metadata.
     - Content integrity verification guaranteeing proof of original authorship.
  5. **Real-time Messaging (`/api/messages` & Socket.io)**:
     - Bi-directional chat between Authors and Publishers.
     - Socket rooms mapped to authenticated user IDs with automated status broadcasts.
  6. **Reader Services (`/api/reader`)**:
     - Shelf tracking (Want to Read, Currently Reading, Completed).
     - Rating, review submission, and reader activity feeds.
  7. **Platform Administration (`/api/admin`)**:
     - Metrics aggregation (total active users, manuscripts submitted, verification rates).
     - User activation/deactivation and flagged content moderation.

---

### 3.4 Data & Storage Layer
- **Primary Database**: MongoDB.
- **Object Data Modeling (ODM)**: Mongoose.
- **Core Entities & Schemas**:
  - `User`: Handles identity, roles (`reader`, `author`, `publisher`, `admin`), profile details, and authentication credentials.
  - `Book / Manuscript`: Contains metadata, full content/manuscript text, genres, status, AI metrics, blockchain signature, pricing, and publisher assignment.
  - `Message`: Chat history storing sender, receiver, content, read status, and timestamps.
  - `Transaction`: Financial or contract records, proposals, and manuscript license transactions.

---

## 4. Security Architecture
- **Authentication**: JWT stateless authentication with standard expiry policies.
- **Data Protection**: Sensitive password strings hashed using Bcrypt before database persistence.
- **Role Isolation**: Strict server-side route guards prevent unauthorized access to publishing or admin functions.
- **Integrity Verification**: Cryptographic hashing allows authors to prove copyright priority without disclosing unreleased content.

---

## 5. Technology Stack Summary

| Layer | Technology |
|---|---|
| **Frontend Framework** | React.js (Vite), React Router |
| **Real-time Engine** | Socket.io (Client & Server) |
| **Backend Runtime** | Node.js, Express.js |
| **Database** | MongoDB (Mongoose ORM) |
| **AI Integration** | Google Generative AI (Gemini Pro / Flash) |
| **Security & Auth** | JSON Web Tokens (JWT), Bcrypt, Crypto (SHA-256) |
| **Mailing / Alerts** | Nodemailer (SMTP) |
