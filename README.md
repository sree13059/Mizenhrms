# Mizen HRMS

Independent HRMS frontend for Mizen Tech Solutions. It contains the login, admin dashboard, and employee dashboard and connects to the existing backend API.

## Development

1. Copy `.env.example` to `.env` and update URLs when needed.
2. In `D:\Mizen\Backend`, run `npm run dev` first.
3. In `D:\Mizen\HRMS`, run `npm run dev`.

Both terminals must remain running. If the Backend is stopped, the login page displays an offline API message.

The HRMS app runs at `http://localhost:5174` by default. The public website runs separately from the `mizen` folder at `http://localhost:5173`.

The local HRMS automatically uses the backend at `http://localhost:5000/api`. A production build uses the hosted backend unless `VITE_API_BASE_URL` is configured.

## Management login

- Role: Management
- Username: `Mizen7086`
- Password: `Mizen3435`
- Dashboard: `http://localhost:5174/management`

Change the management credentials through backend environment variables before a public production deployment.
