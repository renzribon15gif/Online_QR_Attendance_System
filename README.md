# Attendly — QR Attendance Monitoring System

Node.js, Express, EJS, MongoDB Atlas, and QR Code attendance.

## Separate account roles
- **Administrator**: separate `/admin/login` portal. Can monitor all teacher accounts, student accounts, system attendance statistics, and system-wide reports. Administrator does not use the teacher account.
- **Teacher**: `/teacher/login`. Can create time-limited QR attendance sessions, view students, and review/export attendance reports.
- **Student**: `/student/login`. Can scan a teacher's active QR code and view their own attendance history.

## Setup
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`.
3. Add your MongoDB Atlas URI and strong, private secrets in `.env`.
4. Run `npm install`.
5. Configure a teacher account in `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, then run `npm run seed:admin`.
6. Configure a separate administrator account in `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL`, and `SUPERADMIN_PASSWORD` (minimum 12 characters), then run `npm run seed:superadmin`.
7. Run `npm run dev` and open `http://localhost:3000`.

## Portals
- Portal selector: `/login`
- Administrator: `/admin/login`
- Teacher: `/teacher/login`
- Student: `/student/login`
- Student registration: `/register`

## QR attendance flow
Teacher creates a time-limited attendance session. The app generates a QR code containing a one-time session token. A student must sign in and scan/open that QR code while the session is active. The database's unique student/session index prevents duplicate attendance for the same session. Attendance is recorded automatically as Present.

## Render deployment
Create a Render Web Service from the repository. Build command: `npm install`; start command: `npm start`. Add `MONGODB_URI`, `SESSION_SECRET`, `NODE_ENV=production`, `APP_URL`, and the teacher/admin seed variables as environment variables in Render. After deployment, run the seed commands from a secure local environment using the production MongoDB URI, or use a protected one-off shell. Do not commit `.env`.

## Security notes
- `.env` is excluded from this distribution. Never commit credentials.
- Use strong unique passwords and rotate any credentials that have been shared or exposed.
- Atlas network access should be restricted where practical. `0.0.0.0/0` is convenient for dynamic hosting but permits connection attempts from any IPv4 address; use strong database credentials and least-privilege database users.
- QR scanning requires the student to be authenticated. This is a basic QR attendance workflow, not proof of physical presence; a student could share a QR image. For stronger verification, add rotating short-lived QR tokens and teacher-supervised checks.
