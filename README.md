# Vercel edition — DB Browser workflow

The owner chose a **public static Vercel deployment**, managed through DB Browser for SQLite. It does not offer an online Studio, file-upload API, or server inbox. The in-page contact form sends to the FormSubmit email relay via AJAX without navigating away; email and telephone links remain available as alternatives. The original server-backed edition remains available separately and its private data was not replaced.

- Public editable file: `content/portfolio-public.sqlite` — public content only; never secrets, accounts, sessions, inboxes, or private drafts.
- Vercel build: `npm run build:static`; output directory: `dist`; framework: Vite. `vercel.json` supplies the routing and sandbox headers.
- Edit the public file in DB Browser → **Write Changes** → **Close Database** → commit to GitHub → wait for Vercel’s deployment.
- Hiding a row with `published=0` does not make it secret: the SQLite file is in a public repository.
- The JSON used by the website is generated **at build time**. No function writes a database to temporary Vercel storage.
- Node.js is used for the build/local preview, not as an always-running backend on Vercel.

[Detailed DB Browser instructions (Arabic)](docs/DB_BROWSER_AR.md)

```bash
npm ci
npm run build:static
npm run preview:static
```

The public page uses `/portfolio.snapshot.json`. `/api/portfolio` is a read-only rewrite to that snapshot; `/api/health` explicitly reports static mode with Studio/inbox disabled. `/admin` explains offline editing instead of pretending to provide a working login. The form displays an inline submission result only after explicit provider acceptance. Activation, rejection, timeout, and network failures retain the visitor’s text and are not shown as sent messages. HTTP 200 alone is not sufficient. See [contact-form details](docs/CONTACT_FORM_AR.md).

For the original Node.js edition, stop the static preview and run `npm start` on a persistent Node host. The existing `data/portfolio.sqlite` is private and is **not** the file to commit or use in the public workflow. `npm run content:init` is only for first-time setup from public seed content and refuses to overwrite an existing public file.

---

## Original server-backed edition (not the static Vercel runtime)

# Portfolio-hazem

Hazem Ahmed’s English-language full-stack developer portfolio: a light visual theme, original portrait, motion controls, selected work, training, résumé, email/telephone contact, and a password-protected content Studio.

![Portfolio preview](public/images/social-preview.png)

## Stack

React + Vite + Motion; Express + SQLite. Fonts and portfolio images are hosted locally.

## Run

Requires Node.js 20.19+ (Node 22 LTS recommended).

```bash
npm ci
npm start
```

The server binds to `0.0.0.0:3000`; set `PORT` to change the port. Browser API calls use relative same-origin URLs.

## Studio and persistence

Open `/admin`. The initial username is `hazem`.

On the **first** start, a random password is written to the server’s private `private/ADMIN_ACCESS.md` file. It is not served by the website. Change it in Studio → Settings → Security. Alternatively, supply a strong `ADMIN_PASSWORD` through your hosting provider’s secret environment settings before the first initialization. It does not override an existing account.

- Portfolio content, users, sessions, and inquiries are stored in `data/portfolio.sqlite`.
- Public uploads are stored in `data/uploads/`.
- Set `DATA_DIR` to a persistent mounted directory when deploying.
- Keep a private, consistent backup of the complete data directory. Studio’s JSON export is a content-only backup.
- No live database, inbox, user/session data, account passwords, email credentials, GitHub tokens, or private test-account files are included in this repository.

This clean source snapshot seeds **only published portfolio content**. Unpublished local drafts are intentionally excluded. Hidden project repository URLs are omitted from the public seed, and the `showSource` setting remains disabled for CONFIT. This repository is not a backup of the owner’s private running Studio account.

## Contact and Gmail

The Contact section includes the owner’s public email and CV-sourced phone number with a `tel:` link. Contact form submissions are saved to Studio.

Gmail forwarding is optional and **inactive without owner configuration**. Configure a dedicated Google App Password privately in Studio → Settings → Gmail forwarding, or supply `GMAIL_USER` and `GMAIL_APP_PASSWORD` as hosting secrets. Never use a normal Google account password or put credentials into source control. See [the setup guide](docs/GMAIL_SETUP_AR.md).

## Deployment

**GitHub stores the source; GitHub Pages alone cannot run this full application.** Express APIs, SQLite persistence, Studio authentication, uploads, and Gmail forwarding require a Node.js host, persistent storage, HTTPS, and (for SMTP) outbound port 465 access.

Do not publish the `private/` or `data/` directories. Environment variables must be configured in the host environment; the application does not automatically load a `.env` file.

## Project and training presentation

- Madar uses an actual signed-in student-workspace capture from a synthetic review account. Its credentials are not published.
- CONFIT is shown as an e-commerce case study. Its source button is hidden at the owner’s request; the previously checked deployment is marked paused.
- Other project links distinguish public demos from sign-in-required applications.
- ITI, NTI, MCIT, and Africa Matters use the supplied provider marks. Logos are branding, not substitute certificate scans.

See [project and asset provenance](docs/PROVENANCE.md). Internal review notes and private account records are not part of this public snapshot.

## ZoomTech preview

`public/demos/zoomtech/index.html` is a labeled preview of the public Basics12 build, with embedded credentials removed and live AI disabled. Chat uses the project’s local curriculum fallback. The Node server enforces a dedicated opaque-origin sandbox and restricted Content Security Policy for this preview. **Preserve this response policy if changing hosting.** Do not treat this modified preview as the original production deployment.

Local read-only browser checks are provided under `scripts/`; they require a running local server and Playwright Chromium. No external account-creation or publication-credential helpers are included.

## Tests

```bash
npm test
```

Tests use temporary databases and a fake SMTP transport. They do not send real Gmail messages or create accounts on the showcased applications.

## Content and attribution

The owner chose to publish the portfolio’s profile, résumé, portrait, contact details, and project descriptions. Third-party provider logos, project captures, fonts, and dependencies retain their respective rights and attribution. No broader license for those assets is implied by making this source repository public.

## In-page email delivery

The static/Vercel contact form sends directly to FormSubmit’s documented AJAX endpoint for the owner’s public profile email. The owner completed the one-time email activation. There is no Gmail password or email API secret in the client code, no navigation to an email composer, and no on-site message database. The provider may retain submissions under its own policy; the form links that policy. Service acceptance is not an inbox-placement guarantee. If the profile email is changed, the new address may need activation.

Only explicit `success=true` (or the string `"true"`) is treated as accepted. A string `"false"`, an activation-required reply, HTTP errors, and ambiguous responses are never shown as success. Requests are not automatically retried, and fields stay populated on error. The original Node edition keeps its separate `/api/contact` and Studio/Gmail behavior.
