# Deploying BookConnect

One free web service on **Render** runs everything (the website, the API and the
live chat). The data lives in **MongoDB Atlas**, and verification e-mails go out
through **Brevo**. Allow about 45 minutes the first time.

```
 Browser ──► Render (Express: website + API + Socket.io) ──► MongoDB Atlas
                         │
                         ├──► Brevo   (sign-up e-mails)
                         └──► Sepolia (read-only, to check payments)
```

You do the account steps (they need your e-mail and passwords); everything else
is already in the repository (`render.yaml`).

---

## 1. Database: MongoDB Atlas

1. Sign up at <https://www.mongodb.com/cloud/atlas/register> and create a free **M0** cluster.
2. **Database Access** → *Add New Database User* → choose a username + password
   (letters and numbers only keeps the address simple). Role: *Read and write to any database*.
3. **Network Access** → *Add IP Address* → **Allow access from anywhere** (`0.0.0.0/0`).
   Render's free plan has no fixed address, so this is required; the password protects the data.
4. **Database** → *Connect* → *Drivers* → copy the address. Put your database name
   before the `?`, so it looks like:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/bookConnect?retryWrites=true&w=majority
   ```

   This is your **`MONGO_URI`**. Keep it secret.

## 2. Put the books and the admin account into Atlas

Run these once **on your own computer**, in the `backend` folder, pointing at Atlas.
PowerShell:

```powershell
cd backend
$env:MONGO_URI = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/bookConnect?retryWrites=true&w=majority"

node scripts/downloadLibrary.js      # only if you have not downloaded the texts yet
node scripts/importLibrary.js        # the real book library (about 340 books)
node scripts/createAdmin.js you@example.com Your Name   # asks for a password
```

The admin is the only account that can open the Admin dashboard; it cannot be
created from the website.

## 3. E-mail: Brevo

Render's free plan blocks the normal mail ports, so the app sends mail through
Brevo's web API instead.

1. Sign up at <https://www.brevo.com> (free plan: 300 e-mails/day).
2. **Senders, Domains & Dedicated IPs → Senders** → add and **verify** the e-mail
   address you want mail to come from (Brevo e-mails you a link). This is **`EMAIL_FROM`**.
3. **SMTP & API → API Keys** → *Generate a new API key*. This is **`BREVO_API_KEY`**.

If sign-up e-mails never arrive, the sender address in step 2 is not verified yet.

## 4. Sepolia access (payments and on-chain registration)

Create a free Sepolia endpoint at Alchemy or Infura. This is **`SEPOLIA_RPC_URL`**
(keep it private). The server only *reads* the chain; it never holds a private key.

## 5. Render

1. Push this repository to GitHub (the Blueprint reads `render.yaml` from there).
2. <https://dashboard.render.com> → **New → Blueprint** → pick the repository → *Apply*.
3. When asked, fill in the values that are not stored in the file:

   | Setting | Value |
   |---|---|
   | `MONGO_URI` | the Atlas address from step 1 |
   | `SEPOLIA_RPC_URL` | from step 4 |
   | `BREVO_API_KEY` | from step 3 |
   | `EMAIL_FROM` | the verified sender from step 3 |
   | `CLAUDE_API_KEY` | optional (translation, open-ended AI chat) |
   | `GEMINI_API_KEY` | optional |

   Already filled in by `render.yaml`: `NODE_ENV=production`, `TRUST_PROXY=1`,
   `NODE_VERSION=22`, a random `JWT_SECRET`, and the two public contract addresses.
4. Wait for the first build (several minutes). Render gives you an address like
   `https://bookconnect.onrender.com`. Open it.

**Not using the Blueprint?** Create a *Web Service* by hand with:

* Build command: `npm --prefix frontend ci --include=dev && npm --prefix frontend run build && npm --prefix backend ci`
* Start command: `npm --prefix backend start`
* Health check path: `/api/health`
* The environment variables from the table above plus `NODE_ENV=production`, `TRUST_PROXY=1`, `NODE_VERSION=22` and `JWT_SECRET` (any long random text).

## 6. Check it works

* The home page loads, and refreshing on `/dashboard` still works.
* `https://YOUR-ADDRESS/api/health` shows `{"status":"ok"}`.
* Sign up with a real e-mail and receive the code.
* Log in as the admin and open the Admin dashboard.
* MetaMask works because the site is on HTTPS; make sure it is on the **Sepolia** network.

## Things to know about the free plans

* **Render sleeps after 15 minutes without visitors.** The next visit waits roughly
  a minute while it wakes up. Fine for a demo; not for real users. A paid instance
  (about $7/month) stays awake.
* Render's free service has 512 MB of memory.
* Atlas M0 has 512 MB of storage, so the book library (text is stored in the
  database) uses a good part of it. Check *Database → Browse Collections → Storage Size*
  if imports start failing.
* Deploys happen automatically whenever you push to the connected branch.
* Rotate `JWT_SECRET` to log everyone out. Never commit your `.env` files.

## Running the production build on your own computer

```powershell
npm --prefix frontend run build
cd backend
$env:NODE_ENV = "production"; npm start
```

Open <http://localhost:5000>. The server serves the built site whenever
`frontend/dist` exists, so `npm run dev` for development is unchanged.
