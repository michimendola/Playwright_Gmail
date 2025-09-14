# Playwright Gmail E2E Tests

## About the Author
Hi! I'm Michiko Mendola, a results-driven QA Engineer with 6+ years across automation and manual testing. I build maintainable automation frameworks (Cypress/Playwright JS/TS, POM, fixtures, network intercepts), run cross-browser/device on BrowserStack, and integrate with CI (Cypress Cloud, Bitbucket Pipelines) and rich reporting (Mochawesome). I also lead test planning/execution, exploratory and cross-browser testing, UAT coordination, and crisp Jira triage in regulated domains.

- Skills: STLC, Jira, SQL, Web/Mobile Testing, Manual + Automation (Cypress/Playwright), RCA, Agile/Scrum
- Tools: BrowserStack, Jira, Bitbucket, VSCode, SharePoint, Git, Outlook, Slack, Time Doctor
- Contact: (+63) 9951693397 · michimendola@gmail.com · [LinkedIn](www.linkedin.com/in/michikomendola)

This repo showcases a maintainable Playwright test suite for Gmail using the Page Object Model (POM) and parameterized test data.

## What This Project Covers
- Login (valid/invalid), interstitial handling (passkeys, recovery prompt)
- Inbox navigation and reading
- Compose and send emails (3x) with parameterized data
- Validation for negative flows (invalid login, missing recipient)
- Video traces/screenshots on failure (Playwright config)
- Page Object Model structure for reuse and readability

## Requirements
- Node.js 18+ (recommended LTS)
- npm 9+
- Chrome installed (optional but recommended: tests include a `chrome` project/channel)

## Install
```bash
npm install
npx playwright install
```

## Environment Variables (.env)
Create a `.env` at the project root:
```
GMAIL_USERNAME=your.email@gmail.com
GMAIL_PASSWORD=your_app_password
RECIPIENT_EMAIL=recipient@example.com
# Optional: disable interstitial auto-handling
# GMAIL_HANDLE_INTERSTITIALS=false
```
Note: For Gmail, an app password or proper 2FA configuration may be required. Captcha/challenge pages can intermittently block automation.

## Parameterized Test Data (tests/data/config.json)
- `emails`: array of email payloads (to/subject/body) used by the positive scenario.
- `invalidCredentials`: used by the invalid login scenario.

Edit `tests/data/config.json` to change subjects/bodies or invalid creds without code changes.

## Run Tests
Headless (default):
```bash
npm test
```
Headed mode:
```bash
npm run test:headed
```
UI mode:
```bash
npm run test:ui
```
Run using Chrome channel (helps bypass Google interstitials):
```bash
npx playwright test --project=chrome
```
Open the HTML report:
```bash
npm run show-report
```

## Project Structure (POM)
```
tests/
  pages/
    LoginPage.js        # login flow + interstitial handling
    InboxPage.js        # inbox nav, sent verification, logout
    ComposeDialog.js    # compose, fill, send, negative handling
  gmail.spec.js         # scenarios using POM
  data/config.json      # parameterized data
playwright.config.js     # env loader (dotenv), video/screenshot config
```

## Scenarios Implemented
- Positive
  - Valid login → Inbox visible (Compose button)
  - Compose & send 3 emails (recipient/subject/body from config or env)
  - After each send, navigate to Sent and verify the subject exists
- Negative
  - Invalid login → error page/heading detected
  - Compose without recipient → blocking dialog handled and verified

## Tips for Gmail Automation
- Prefer `--project=chrome` to reduce “not secure” interstitials.
- Replace `networkidle` waits with explicit UI waits (e.g., Compose button).
- If challenges persist, consider recording a `storageState` after a manual login and reusing it.

## Troubleshooting
- Missing dotenv: `npm i -D dotenv`
- Browsers not installed: `npx playwright install`
- Env not picked up in UI mode: restart the UI (`npm run test:ui`) after creating `.env`.

## License
MIT (for this sample project).
