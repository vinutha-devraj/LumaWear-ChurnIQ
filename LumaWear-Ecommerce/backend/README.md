# LumaWear Backend

Express API server for environment-based backend configuration.

## Run

```bash
cd backend
npm install
npm run dev
```

## Available Endpoints

- `GET /api/health`
- `GET /api/config`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/activity`
- `GET /api/admin/users`
- `GET /api/admin/activity`

## Environment

Use `.env`:

- `PORT`
- `NODE_ENV`
- `CLIENT_ORIGIN`
- `MONGODB_URI`
- `MONGODB_DB`
- `DNS_SERVERS` optional, comma-separated DNS resolvers for Atlas SRV lookups
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
