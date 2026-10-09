# Vighna-Darshi — integrated demo

This folder contains the HTML/CSS/JavaScript frontend and FastAPI backend. The backend serves the frontend and uses Supabase to persist alerts and partner incident reports. The dashboard checks the API every 5 seconds so alerts/incidents show on other devices using the same deployed backend.

## 1. Configure Supabase

1. Open your Supabase project.
2. Go to SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy `vighna-bodha-v2/app/.env.example` to `vighna-bodha-v2/app/.env`.
5. Fill in `SUPABASE_KEY` with a server-side secret/service-role key from Supabase. Keep this key private and only on the backend. Do not put it in `script.js`.

The project URL is prefilled in `.env.example`. Confirm it matches your Supabase project.

## 2. Install and run locally (Windows PowerShell)

From the `Vighna-Darshi` folder:

```powershell
cd .\vighna-bodha-v2
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/index.html`. API documentation is at `http://127.0.0.1:8000/docs`; health check is at `http://127.0.0.1:8000/api/health`.

If PowerShell blocks activation, you can skip activation and run:
`python -m pip install -r requirements.txt`
then `python -m uvicorn app.main:app --reload`.

## 3. Demo login

The existing frontend demo login is retained:
- Admin: `admin` / `Admin@123`
- Partner: `partner` / `Partner@123`, vehicle `KA01AB1234`

These are demo-only credentials hard-coded in the frontend. Do not deploy publicly with these credentials. Before production, replace them with Supabase Auth and enforce authorization in backend endpoints.

## 4. What is integrated

- Admin disruption broadcasts are stored in `public.alerts`.
- Partner incident reports are stored in `public.incidents`.
- Admin and partner dashboards poll the shared API every 5 seconds, enabling cross-device updates when both devices use the same deployed backend.
- The backend serves the frontend, so use the FastAPI URL rather than Live Server when testing integration.

## Important limitations

- This is a demo integration, not production-secure authentication.
- API CORS is permissive for local development; restrict it to your frontend domain before deployment.
- The existing map/GPS/fleet values remain simulated.
- Polling is used for cross-device sync (not a Supabase Realtime WebSocket subscription); it does require a running backend and internet access to Supabase.
- Keep `.env` out of ZIPs, Git, and frontend assets. If a real key was included in a previously shared ZIP, rotate it in Supabase.
