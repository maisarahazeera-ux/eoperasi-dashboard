# e-Operasi: Deploying to a Server

How to run e-Operasi on a real server for PPD Johor Bahru. On a developer's own laptop nothing here is needed: keep using `dotnet run` and `npm run dev`.

## What the server needs

- .NET 10 runtime (ASP.NET Core)
- PostgreSQL 15 or newer
- An HTTPS certificate and a web server in front (IIS on Windows, or nginx on Linux), so passwords and teacher data are encrypted
- An official mailbox for sending emails (verification, password reset, account approved)

## 1. Database

Create a database and a user with a **strong password** (not `devpassword123`):

```sql
CREATE USER eoperasi WITH PASSWORD 'a-strong-password';
CREATE DATABASE eoperasi OWNER eoperasi;
```

## 2. Settings and secrets

Copy `EOperasiAPI/appsettings.Production.example.json` to `appsettings.Production.json` **on the server** and fill in every `CHANGE_ME`. This file is in `.gitignore` and must never go to GitHub.

Each value can instead be set as an environment variable (a double underscore means one level down):

| Setting | Environment variable |
|---|---|
| Database connection | `ConnectionStrings__Default` |
| Login token key | `Jwt__Key` |
| Address people open e-Operasi with | `FrontendUrl` |
| Email password | `Smtp__Password` |

Make a **new** random key for `Jwt:Key` (PowerShell):

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

The API refuses to start, with a clear message, if the key is missing, shorter than 32 characters, or still the development key, or if the database setting is empty.

## 3. Build

From the project folder:

```powershell
# Dashboard: built straight into the API's wwwroot folder (dashboard and API on one address)
cd "e-Operasi prototype"
npm install
npm run build:server

# API
cd ..\EOperasiAPI
dotnet publish -c Release -o ..\publish
```

Copy the `publish` folder to the server. It already contains the dashboard.

## 4. Create the tables

Run the migrations against the production database, either from a developer PC that can reach it:

```powershell
cd EOperasiAPI
$env:ConnectionStrings__Default = "Host=...;Database=eoperasi;Username=eoperasi;Password=..."
dotnet ef database update
```

or build a bundle and run it on the server (no .NET SDK needed there):

```powershell
dotnet ef migrations bundle -o efbundle.exe
.\efbundle.exe --connection "Host=...;Database=eoperasi;Username=eoperasi;Password=..."
```

Run this again after every update that includes new migrations.

## 5. Run

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Production"
$env:ASPNETCORE_URLS = "http://localhost:5000"
dotnet EOperasiApi.dll
```

Put IIS (with the ASP.NET Core Hosting Bundle) or nginx in front with the HTTPS certificate, forwarding to `http://localhost:5000`. Then set `"Https": { "Enabled": true }` in `appsettings.Production.json`. Set it up as a Windows service or IIS site so it starts again after a restart.

## 6. First administrator

A new database has no users. Register normally on the website (with an `@moe.gov.my` email and click the verification link), then make that account an administrator once, directly in the database:

```sql
UPDATE "Users" SET "Role" = 'admin', "Status" = 'active' WHERE "Username" = 'the-username';
```

After that, administrators manage everyone else on the **Pengguna** page.

## 7. First data

Log in as the administrator, open **Kemas Kini Data**, and upload the SK and SMK files from SEPADU. The Jupyter notebooks are no longer needed.

## Checklist

- [ ] Strong database password, not the development one
- [ ] New `Jwt:Key` for this server
- [ ] `FrontendUrl` set to the real address (email links use it)
- [ ] HTTPS working, and `Https:Enabled` set to `true`
- [ ] Emails sent from an official mailbox; test one registration and one password reset
- [ ] `appsettings.Production.json` exists only on the server, never in GitHub
- [ ] Database backups scheduled (for example a daily `pg_dump`)
