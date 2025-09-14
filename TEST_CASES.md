# Test Case Documentation

This document lists the positive and negative scenarios covered by the Playwright Gmail automation suite.

## Conventions
- Data source: `tests/data/config.json` (config-only parameterization)
- Browser: Playwright projects (e.g., chromium/chrome); videos enabled in report
- Preconditions (common): Network access, valid Gmail account for positive tests

---

## TC-01 (Positive): Login with valid credentials → Inbox loads
- Preconditions: `validCredentials` present in `.env`
- Steps:
  1. Navigate to Gmail
  2. Enter valid username, click Next
  3. Handle interstitials if shown (passkey/recovery)
  4. Enter valid password, click Next
- Expected:
  - Inbox loads; `Compose` button visible
  - No error or block page

## TC-02 (Positive): Compose & send emails (x3) with parameterized data
- Data: `emails[]` in `.env` (to, subject, body)
- Steps (repeat for each payload):
  1. From Inbox, click `Compose`
  2. Fill `To`, `Subject`, `Body`
  3. Click `Send`
  4. Navigate to `Sent` and verify message with matching `Subject` exists
  5. Return to `Inbox`
- Expected:
  - Toast "Message sent" appears (or visible in report)
  - Email is listed in `Sent` with correct subject (and recipient where visible)

## TC-03 (Positive): Email navigation – open first email and back to Inbox
- Preconditions: At least one email exists in Inbox (test guards for empty)
- Steps:
  1. From Inbox, open first conversation row
  2. Verify message/thread view is shown
  3. Navigate back to Inbox (Back to Inbox button or go to `#inbox`)
- Expected:
  - Message view loads, then Inbox visible again

## TC-04 (Negative): Login with invalid credentials → error shown
- Data: `invalidCredentials` in `tests/data/config.json`
- Steps:
  1. Navigate to Gmail
  2. Enter invalid username, click Next
  3. If password requested, enter invalid password, click Next
- Expected:
  - Error/blocked sign-in heading visible (e.g., "Couldn’t sign you in")
  - Inbox does not load

## TC-05 (Negative): Compose without recipient → prevent send with warning
- Preconditions: Logged in with valid credentials
- Steps:
  1. From Inbox, click `Compose`
  2. Leave `To` empty; fill `Subject` and `Body`
  3. Click `Send`
- Expected:
  - Error dialog (e.g., "Please specify at least one recipient")
  - Draft remains or is discarded by cleanup; no success toast

---

## Notes
- Parameterization: All credentials and email payloads come from `tests/data/config.json` or `.env`.
- Artifacts:
  - Videos and traces available via the Playwright HTML report (`npm run show-report`).
- Interstitials: Passkey & recovery prompts are auto-dismissed when shown to keep tests stable.
