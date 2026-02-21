<div align="center">

# 🎵 MelodyChief

### Musician Collaboration Platform

*Find your bandmates. Build something legendary.*

[![GitHub Stars](https://img.shields.io/github/stars/nick0410/melody-chief?style=for-the-badge&color=7c3aed)](https://github.com/nick0410/melody-chief/stargazers)
[![License](https://img.shields.io/badge/license-ISC-06b6d4?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?style=for-the-badge&logo=socket.io)](https://socket.io)

</div>

---

## ✨ What is MelodyChief?

**MelodyChief** is a real-time musician collaboration platform where artists can discover bandmates, jam together, and build music communities. Powered by a **hybrid ML recommendation engine** that matches you with musicians based on genre, skill level, and instrument — no random browsing, just perfect fits.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🤖 **Smart Recommendations** | Hybrid content-based + collaborative filtering using cosine similarity |
| 💬 **Live Room Chat** | Real-time messaging via Socket.io |
| 👤 **Musician Profiles** | Genre, instruments, skill level, availability |
| 🔐 **Secure Auth** | Session-based login with bcrypt password hashing |
| 🎨 **Dark Glassmorphism UI** | Stunning purple/cyan design with animated orbs |
| 📊 **ML Notebook** | Full Python pipeline in `recommendations_ml.ipynb` |

---

## 🧠 Recommendation Engine

Two algorithms work together to surface the best matches:

```
Query (instrument + genre + skill)
        │
        ├── Content-Based Filter ──────► Filter by exact attributes
        │                                  Genre match · Skill proximity · Instrument overlap
        │
        └── Collaborative Filter ──────► Cosine similarity on feature vectors
                                           Genre one-hot · Skill rank · Experience score
                                                    │
                                                    ▼
                                         Hybrid Merge & Deduplicate
                                                    │
                                                    ▼
                                          Ranked Results (up to 24)
                                       [content] · [collab] · [hybrid]
```

The Python notebook (`recommendations_ml.ipynb`) runs the full pipeline and exports results to `data/rec_output.json`. The Node.js server mirrors the same logic at `/api/recommendations` for live queries.

---

## 🛠️ Tech Stack

**Backend**
- [Node.js](https://nodejs.org) + [Express](https://expressjs.com)
- [Socket.io](https://socket.io) — real-time rooms & chat
- [express-session](https://www.npmjs.com/package/express-session) + [bcryptjs](https://www.npmjs.com/package/bcryptjs)
- [compression](https://www.npmjs.com/package/compression) — gzip middleware

**Frontend**
- Vanilla HTML / CSS / JavaScript
- Dark glassmorphism design system
- Google Fonts: Inter + Plus Jakarta Sans

**ML / Data Science**
- Python · pandas · numpy · scikit-learn
- Cosine similarity via `sklearn.metrics.pairwise`
- 50-record musician dataset (`data/musicians.json`)

---

## ⚡ Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Run locally

```bash
# Clone the repo
git clone https://github.com/nick0410/melody-chief.git
cd melody-chief

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:8080** in your browser.

### Development (auto-reload)

```bash
npm run dev
```

---

## 📁 Project Structure

```
melody-chief/
├── server.js                  # Express server + Socket.io + ML API
├── package.json
├── vercel.json                # Vercel deployment config
├── render.yaml                # Render deployment config
│
├── public/
│   ├── index.html             # Login page
│   ├── signup.html            # Sign up page
│   ├── dashboard.html         # Main dashboard
│   ├── style.css              # All styles (dark glassmorphism)
│   └── app.js                 # Shared frontend utilities
│
├── data/
│   └── musicians.json         # 50-record musician dataset
│
└── recommendations_ml.ipynb   # Full ML recommendation pipeline
```

---

## 🔌 API Reference

All endpoints require an authenticated session (login first).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/login` | Login with email + password |
| `POST` | `/signup` | Create new account |
| `GET` | `/api/me` | Current user info |
| `GET` | `/api/profiles` | All musician profiles |
| `POST` | `/api/profiles` | Create / update your profile |
| `GET` | `/api/rooms` | List all rooms |
| `POST` | `/api/rooms` | Create a new room |
| `GET` | `/api/recommendations` | **Hybrid ML recommendations** |
| `POST` | `/logout` | End session |

### `/api/recommendations` query params

```
GET /api/recommendations?instrument=Guitar&genre=Jazz&skill=intermediate
```

| Param | Optional | Example |
|---|---|---|
| `instrument` | ✅ | `Guitar`, `Piano`, `Violin` |
| `genre` | ✅ | `Jazz`, `Rock`, `Classical` |
| `skill` | ✅ | `Beginner`, `Intermediate`, `Advanced`, `Expert` |

Returns up to **24 musicians** scored and tagged with `algo: "content" | "collab" | "hybrid"`.

---

## 🚢 Deployment

### Vercel (recommended for fast deploys)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/nick0410/melody-chief)

1. Import repo at [vercel.com/new](https://vercel.com/new)
2. Add env var: `SESSION_SECRET` = any random string
3. Deploy — done ✅

> ⚠️ Socket.io real-time features require a persistent server. Use Render for full functionality.

### Render (full-stack with Socket.io)

1. Create Web Service at [render.com](https://render.com)
2. Connect `nick0410/melody-chief` — `render.yaml` is auto-detected
3. `SESSION_SECRET` is auto-generated
4. Deploy ✅

---

## 🌟 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | ✅ | Secret key for session signing |
| `PORT` | ❌ | Server port (default: `8080`) |
| `NODE_ENV` | ❌ | Set to `production` on deploy |

---

## 📓 ML Notebook

The Jupyter notebook covers the full recommendation pipeline:

1. **Data Loading** — loads `data/musicians.json`
2. **EDA** — genre distribution, skill breakdown
3. **Feature Engineering** — genre one-hot + skill rank + experience
4. **Cosine Similarity Matrix**
5. **Content-Based Recommendations**
6. **Collaborative Filtering**
7. **Hybrid Engine** — merged, deduplicated, scored
8. **Visualizations** — similarity heatmap, genre/skill charts
9. **Export** — saves results to `data/rec_output.json`

```bash
# Run notebook (requires Python + Jupyter)
pip install pandas numpy scikit-learn matplotlib seaborn jupyter
jupyter notebook recommendations_ml.ipynb
```

---

## 🤝 Contributing

1. Fork the repo
2. Create your branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: your feature"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

---

## 📄 License

ISC © [nick0410](https://github.com/nick0410)

---

<div align="center">
  Made with 🎶 for musicians everywhere
</div>
