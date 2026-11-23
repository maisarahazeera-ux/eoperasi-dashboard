# e-Operasi Dashboard

A web dashboard built during my industrial training at Pejabat Pendidikan Daerah (PPD) Johor Bahru, Sektor Pengurusan Sekolah (Sep–Dec 2026). It turns SEPADU teacher data into charts, summaries and searchable records for nearly 8,900 teachers in 139 schools in the Johor Bahru district.

Before this, officers who needed a quick figure (teachers retiring soon, teachers by subject, grade distribution) had to open large SEPADU text files in Excel and filter them by hand.

> Teacher data is personal data under the PDPA, so no real data is stored in this repository. See `.gitignore`.

## Features

**For all officers**
- Overview: total teachers, total schools, teachers retiring within five years, average age
- Find Teacher: search and view a teacher's personal, service, academic, subject and contact details
- Demographics, Grade, Subject and Retirement analysis pages
- Filters by school type, school, gender, subject and employment status
- Download reports as Excel or PDF
- Bahasa Melayu / English and light / dark mode

**For administrators**
- Update Data: upload new SEPADU files, preview the changes, then replace the data
- User Management: approve or reject new accounts, activate or deactivate users, assign roles
- Activity Log: logins, report downloads, data updates and admin actions

**Security**
- JWT login with BCrypt password hashing, email verification and password reset by email
- New accounts must be approved by an admin
- Every request checks that the account is still active, so a deactivated user loses access immediately
- Rate limiting on login, register and reset (10 requests per minute per IP)
- The API refuses to start with unsafe settings, such as an empty or example JWT key

## Tech stack

| Part | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | ASP.NET Core Web API (.NET 10, C#), Entity Framework Core |
| Database | PostgreSQL 17 (Docker for development), with EF Core migrations |
| Data preparation | Python (pandas) in Jupyter notebooks, plus a SEPADU parser in the API for uploads |

## How it works

1. **Data:** the notebooks clean the raw SEPADU export (remove duplicates, standardise dates, split subjects, calculate age and retirement date) and load it into PostgreSQL. Later updates go through the Update Data page.
2. **API** (`EOperasiAPI/`): controllers for authentication, teachers, profiles, users, data updates and the activity log.
3. **Frontend** (`e-Operasi prototype/`): calls the API through `src/lib/api.ts`. If the session expires, the user is logged out automatically.

## My contribution

I built this project individually under the supervision of my industrial supervisor. I wrote the design brief and used Figma Make to generate an early UI prototype with mock data for feedback. I then built the full system: I gathered requirements from PPD officers, cleaned the SEPADU data with Python, designed the PostgreSQL database, built the ASP.NET Core API, connected the React frontend to real data, added the admin features, and redesigned the interface based on feedback.

I used AI coding tools for parts of the code, and reviewed and tested all of it before use.

## Run it locally

Requirements: .NET 10 SDK, Node.js, Docker.

```bash
# 1. Start the database
cd EOperasiAPI
docker compose up -d

# 2. Copy appsettings.Development.example.json to appsettings.Development.json
#    and fill in the connection string and a JWT key (32+ characters)

# 3. Start the API (http://localhost:5276)
dotnet ef database update
dotnet run

# 4. Start the frontend (http://localhost:8443)
cd "../e-Operasi prototype"
npm install
npm run dev
```

For deploying to a server, see `DEPLOYMENT.md`.
