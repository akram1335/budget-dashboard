# Budget Dashboard

A full-stack budget tracking app with currency conversion. FastAPI backend, React frontend, SQLite database, and PWA support.

## Deployment (Single Container)

Build and run a single container that serves both the API and the React SPA:

```bash
# Build
docker build -f Dockerfile.deploy -t budget-dashboard:deploy .

# Run
docker run -p 8000:8000 -v $(pwd)/data:/data budget-dashboard:deploy
```

Then open http://localhost:8000

### Deploy to Cloud (e.g. Claw Cloud)

```bash
docker tag budget-dashboard:deploy your-registry/budget-dashboard:latest
docker push your-registry/budget-dashboard:latest
```

- Expose port **8000**
- Attach a **persistent volume** at `/data` (SQLite database + rate files)

## Project Structure

```
budget-dashboard/
├── backend/
│   ├── main.py               # FastAPI app + API router + SPA serving
│   ├── auth.py               # JWT authentication
│   ├── database.py           # SQLite config
│   ├── models.py             # User & Transaction models
│   ├── requirements.txt
│   └── services/
│       └── rates_scraper.py  # Currency rate scraper
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/               # PWA manifest, service worker, icons
│   └── src/                  # React source
├── Dockerfile.deploy         # Production (single container)
└── README.md
```

## API Endpoints

All API routes are under the `/api/` prefix:

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | — | Register new user |
| POST | `/api/login` | — | Login (returns JWT) |
| GET | `/api/me` | ✅ | Get current user |
| PUT | `/api/me` | ✅ | Update profile |
| DELETE | `/api/me` | ✅ | Delete account |
| GET | `/api/transactions` | ✅ | List transactions |
| POST | `/api/transactions` | ✅ | Create transaction |
| DELETE | `/api/transactions/{id}` | ✅ | Delete transaction |
| GET | `/api/rates` | — | Current currency rates |
| GET | `/api/rates/history` | — | Historical rates (30 days) |
| GET | `/health` | — | Health check |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI, SQLAlchemy, SQLite |
| Frontend | React, Vite |
| Auth | JWT (python-jose, passlib/bcrypt) |
| Rates | Web scraping (BeautifulSoup) + scheduled updates (APScheduler) |
| PWA | Service worker, manifest, app icons |
| Deploy | Docker (single container) |
