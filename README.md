# Mizen HRMS

Independent HRMS frontend for Mizen Tech Solutions. It contains the login, admin dashboard, and employee dashboard and connects to the existing backend API.

## Development

1. Copy `.env.example` to `.env` only when you need to override URLs.
2. In `D:\Mizen\HRMS`, run `npm run dev`.

The HRMS uses the hosted backend by default. If you override `VITE_API_BASE_URL`, make sure it points to a running API server.

The HRMS app runs at `http://localhost:5174` by default. The public website runs separately from the `mizen` folder at `http://localhost:5173`.

The HRMS uses the hosted backend at `https://mizenbackendfile.onrender.com/api` by default. Set `VITE_API_BASE_URL` only when you want to override it.

## Management login

- Role: Management
- Username: `Mizen7086`
- Password: `Mizen3435`
- Dashboard: `http://localhost:5174/management`

Change the management credentials through backend environment variables before a public production deployment.
