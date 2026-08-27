# LumaWear Monorepo Structure

The project is now separated into:

- `frontend/` – React + Tailwind storefront
- `backend/` – Node.js + Express API server

## Environment Files

### Frontend

- `frontend/.env`
- `frontend/.env.example`

Variables:

- `VITE_APP_NAME` – brand/app label shown in UI
- `VITE_API_BASE_URL` – backend API base URL used by the frontend

### Backend

- `backend/.env`
- `backend/.env.example`

Variables:

- `PORT` – backend port
- `NODE_ENV` – runtime environment
- `CLIENT_ORIGIN` – CORS origin allowed to call backend APIs

The included local configuration creates this initial administrator account:

- Email: `admin@lumawear.local`

The password comes from `backend/.env` via `ADMIN_PASSWORD`.

Change `ADMIN_PASSWORD` and `SESSION_SECRET` in `backend/.env` before deployment.
Customer accounts are created through the Create account screen and passwords are
hashed before storage. The administrator signs in on the normal sign-in page and
is taken to `/admin` automatically.

## Run the Project

Open two terminals:

### Terminal 1 – Backend

```bash
cd backend
npm install
npm run dev
```

### Terminal 2 – Frontend

```bash
cd frontend
npm install
npm run dev
```

To Visit :https://luma-wear-ecommerce-seven.vercel.app/
