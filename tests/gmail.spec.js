// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { LoginPage } from './pages/LoginPage.js';
import { InboxPage } from './pages/InboxPage.js';
import { ComposeDialog } from './pages/ComposeDialog.js';

const configPath = path.resolve(process.cwd(), 'tests/data/config.json');
const testData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const VALID_USERNAME = process.env.GMAIL_USERNAME || '';
const VALID_PASSWORD = process.env.GMAIL_PASSWORD || '';

const emails = (testData.emails || []).map(e => ({
  to: process.env.RECIPIENT_EMAIL || e.to.replace('${RECIPIENT_EMAIL}', process.env.RECIPIENT_EMAIL || ''),
  subject: e.subject,
  body: e.body
}));

test.describe.configure({ mode: 'serial' });

// Positive Scenario 1: Login with valid credentials
test('Positive: Login with valid credentials loads Inbox', async ({ page }) => {
  test.skip(!VALID_USERNAME || !VALID_PASSWORD, 'Set GMAIL_USERNAME and GMAIL_PASSWORD in env to run');
  const login = new LoginPage(page);
  await login.login(VALID_USERNAME, VALID_PASSWORD);
  await expect(page.getByRole('button', { name: 'Compose' })).toBeVisible();
});

// Positive Scenario 2: Compose, verify in Sent, repeat x3
test('Positive: Compose, verify in Sent, repeat x3', async ({ page }) => {
  test.skip(!VALID_USERNAME || !VALID_PASSWORD, 'Set GMAIL_USERNAME and GMAIL_PASSWORD in env to run');
  const login = new LoginPage(page);
  await login.login(VALID_USERNAME, VALID_PASSWORD);

  const inbox = new InboxPage(page);
  const compose = new ComposeDialog(page);

  const sendSet = emails.length ? emails : [
    { to: process.env.RECIPIENT_EMAIL || VALID_USERNAME, subject: 'Playwright Test A', body: 'Test body A' },
    { to: process.env.RECIPIENT_EMAIL || VALID_USERNAME, subject: 'Playwright Test B', body: 'Test body B' },
    { to: process.env.RECIPIENT_EMAIL || VALID_USERNAME, subject: 'Playwright Test C', body: 'Test body C' }
  ];

  for (const mail of sendSet) {
    await compose.open();
    await compose.fillTo(mail.to);
    await compose.fillSubject(mail.subject);
    await compose.fillBody(mail.body);
    const result = await compose.send();
    expect(result.sent).toBeTruthy();

    await inbox.verifyInSent(mail.subject, mail.to);
    await inbox.goToInbox();
  }

  await inbox.logout();
});

// Negative Scenario 1: Invalid login shows error
test('Negative: Login with invalid credentials shows error', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.fillEmailAndNext(testData.invalidCredentials?.username || 'invalid.user@example.com');
  await login.maybeDismissPasskey();
  await login.maybeDismissRecovery();
  // Do not proceed to a successful inbox
  const errorHeading = page.getByRole('heading', { level: 1, name: /Couldn[’']t sign you in/i });
  await expect(errorHeading).toBeVisible({ timeout: 20000 });
});

// Negative Scenario 2: Compose without recipient shows warning
test('Negative: Compose email without recipient triggers validation', async ({ page }) => {
  test.skip(!VALID_USERNAME || !VALID_PASSWORD, 'Set GMAIL_USERNAME and GMAIL_PASSWORD in env to run');
  const login = new LoginPage(page);
  await login.login(VALID_USERNAME, VALID_PASSWORD);

  const compose = new ComposeDialog(page);
  await compose.open();
  await compose.fillSubject('Missing recipient');
  await compose.fillBody('This should not send');
  const result = await compose.send();
  expect(result.sent).toBeFalsy();
  expect(['missing-recipient', 'unknown']).toContain(result.reason);

  const inbox = new InboxPage(page);
  await inbox.logout();
});
