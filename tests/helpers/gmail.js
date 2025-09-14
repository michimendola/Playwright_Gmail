// @ts-check

import { expect } from '@playwright/test';

function shouldHandleInterstitials() {
  const v = (process.env.GMAIL_HANDLE_INTERSTITIALS ?? 'true').toString().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'no';
}

/**
 * Dismiss Google's passkey interstitial if it appears.
 * Safe to call opportunistically; no-op when not shown.
 * @param {import('@playwright/test').Page} page
 */
async function maybeDismissPasskeyInterstitial(page) {
  const passkeyHeading = page.getByRole('heading', { name: 'Sign in faster' });
  const notNowBtn = page.getByRole('button', { name: /^Not now$/i });
  try {
    await passkeyHeading.waitFor({ state: 'visible', timeout: 2000 });
    if (await notNowBtn.isVisible()) {
      await notNowBtn.click();
      await page.waitForLoadState('domcontentloaded');
    }
  } catch {
    // Not shown; continue
  }
}

/**
 * Dismiss the recovery info prompt by clicking Cancel if shown.
 * @param {import('@playwright/test').Page} page
 */
async function maybeDismissRecoveryPrompt(page) {
  const heading = page.getByRole('heading', { name: /Make sure you can always sign in/i });
  const cancel = page.getByRole('button', { name: /^Cancel$/i });
  try {
    await heading.waitFor({ state: 'visible', timeout: 2000 });
    if (await cancel.isVisible()) {
      await cancel.click();
      await page.waitForLoadState('domcontentloaded');
    }
  } catch {
    // Not shown; continue
  }
}

/**
 * Login and expect inbox to appear.
 * @param {import('@playwright/test').Page} page
 * @param {{ username: string, password: string }} creds
 */
export async function loginExpectSuccess(page, creds) {
  await page.goto('https://mail.google.com/');
  await page.waitForLoadState('domcontentloaded');

  await page.getByLabel('Email or phone').fill(creds.username);
  await page.getByRole('button', { name: 'Next' }).click();

  // Dismiss optional interstitials
  if (shouldHandleInterstitials()) {
    await maybeDismissPasskeyInterstitial(page);
    await maybeDismissRecoveryPrompt(page);
  }

  // If Google blocks sign-in, fail fast
  const blocked = page.getByRole('heading', { level: 1, name: /Couldn[’']t sign you in/i });
  if (await blocked.isVisible()) {
    throw new Error('Google blocked automated sign-in. Try --project=chrome or a saved storageState.');
  }

  // Target the visible password field by label (avoids hidden inputs)
  const password = page.getByLabel('Enter your password');
  await expect(password).toBeVisible({ timeout: 15000 });
  await password.fill(creds.password);

  await page.getByRole('button', { name: 'Next' }).click();

  // Ditch networkidle; Gmail long-polls. Wait for Inbox or block page.
  const compose = page.getByRole('button', { name: 'Compose' });
  const blockedAfter = page.getByRole('heading', { level: 1, name: /Couldn[’']t sign you in/i });

  if (shouldHandleInterstitials()) {
    await maybeDismissPasskeyInterstitial(page);
    await maybeDismissRecoveryPrompt(page);
  }

  await Promise.race([
    compose.waitFor({ state: 'visible', timeout: 30000 }),
    blockedAfter.waitFor({ timeout: 30000 })
  ]);

  if (await blockedAfter.isVisible()) {
    throw new Error('Google blocked automated sign-in after password. Use --project=chrome or storageState.');
  }

  await expect(compose).toBeVisible({ timeout: 30000 });
}

/**
 * Attempt login and expect an error message.
 * @param {import('@playwright/test').Page} page
 * @param {{ username: string, password: string }} creds
 */
export async function loginExpectFailure(page, creds) {
  await page.goto('https://mail.google.com/');
  await page.waitForLoadState('domcontentloaded');

  await page.fill('input[type="email"]', creds.username);
  await page.click('#identifierNext');

  // Dismiss optional interstitials
  if (shouldHandleInterstitials()) {
    await maybeDismissPasskeyInterstitial(page);
    await maybeDismissRecoveryPrompt(page);
  }

  // Either we get password page or immediate error (invalid user)
  const passwordVisible = await page.locator('input[type="password"]').isVisible();
  if (passwordVisible) {
    await page.fill('input[type="password"]', creds.password);
    await page.click('#passwordNext');
    if (shouldHandleInterstitials()) {
      await maybeDismissPasskeyInterstitial(page);
      await maybeDismissRecoveryPrompt(page);
    }
  }

  // assert a single, unique element
  const errorHeading = page.getByRole('heading', { level: 1, name: /Couldn[’']t sign you in/i });
  await expect(errorHeading).toBeVisible({ timeout: 20_000 });
}

/**
 * Compose an email and attempt to send. Returns true if Gmail shows "Message sent".
 * @param {import('@playwright/test').Page} page
 * @param {{ to?: string, subject?: string, body?: string }} mail
 */
export async function composeAndSendEmail(page, mail) {
  // Open compose
  const composeBtn = page.locator('div[role="button"][gh="cm"], div[aria-label^="Compose"]');
  await composeBtn.first().click();

  // Scope to the compose dialog
  const dialog = page.getByRole('dialog', { name: /New Message|Compose/i });

  // Fill recipients (Gmail uses a combobox token field)
  if (typeof mail.to === 'string') {
    // Try ARIA combobox first
    const toCombo = dialog.getByRole('combobox', { name: /To recipients/i }).first();
    try {
      await toCombo.click();
      try {
        await toCombo.fill(mail.to);
      } catch {
        await page.keyboard.type(mail.to);
      }
      await page.keyboard.press('Enter'); // commit token
    } catch {
      // Fallback to older textarea/selectors
      const toFieldFallback = dialog.locator('textarea[name="to"], textarea[aria-label="To"], input[aria-label="To"]').first();
      await toFieldFallback.click();
      await toFieldFallback.type(mail.to);
      await page.keyboard.press('Enter');
    }
  }

  // Fill subject/body
  const subjectField = dialog.locator('input[name="subjectbox"]').first();
  if (typeof mail.subject === 'string') {
    await subjectField.fill(mail.subject);
  }
  const bodyField = dialog.locator('div[aria-label="Message Body"]').first();
  if (typeof mail.body === 'string') {
    await bodyField.click();
    await bodyField.type(mail.body);
  }

  // Click Send
  const sendButton = dialog.getByRole('button', { name: /^Send/ }).first();
  await sendButton.click();

  // Either success toast or validation error
  const successToast = page
    .locator('[role="alert"], [aria-live="assertive"], [aria-live="polite"]')
    .filter({ hasText: /Message sent/i })
    .first();
  const missingRecipientDialog = page.getByRole('alertdialog').filter({
    hasText: /Missing recipient|Please specify at least one recipient/i,
  }).first();

  // Race: success vs error dialog
  await Promise.race([
    successToast.waitFor({ timeout: 10000 }).catch(() => {}),
    missingRecipientDialog.waitFor({ timeout: 8000 }).catch(() => {}),
  ]);

  if (await successToast.isVisible()) {
    return { sent: true };
  }

  // Not sent; handle missing recipient
  if (await missingRecipientDialog.isVisible()) {
    // Dismiss the dialog
    try { await page.getByRole('button', { name: /^OK$/i }).click(); } catch {}

    // Try to discard the draft to keep the session clean
    try {
      const discardBtn = dialog.getByRole('button', { name: /Discard draft/i }).first();
      if (await discardBtn.isVisible()) {
        await discardBtn.click();
      } else {
        // Close composer as fallback
        const closeIcon = dialog.locator('img[alt="Save & close"]').first();
        if (await closeIcon.isVisible()) {
          await closeIcon.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    } catch {}

    return { sent: false, reason: 'missing-recipient' };
  }

  // Last-chance fallback in case the toast lacks role/aria-live in this skin
  const textFallback = page.getByText(/Message sent/i).first();
  if (await textFallback.isVisible()) {
    return { sent: true };
  }

  return { sent: false, reason: 'unknown' };
}

/**
 * Open the first email in inbox, then navigate back to inbox.
 * @param {import('@playwright/test').Page} page
 */
export async function openFirstEmailAndBack(page) {
  // Ensure we are in inbox
  await page.waitForSelector('div[role="button"][gh="cm"], div[aria-label^="Compose"]');

  // Click on the first conversation row
  const firstRow = page.locator('tr.zA').first();
  await firstRow.waitFor({ state: 'visible' });
  await firstRow.click();

  // Wait for message view by waiting for the thread toolbar
  await page.waitForSelector('div[aria-label^="Back to Inbox"], div[aria-label="More"]');

  // Navigate back to inbox
  const backButton = page.locator('div[aria-label^="Back to Inbox"]');
  if (await backButton.isVisible()) {
    await backButton.click();
  } else {
    await page.goto('https://mail.google.com/mail/u/0/#inbox');
  }

  // Verify inbox loaded again
  await page.waitForSelector('div[role="button"][gh="cm"], div[aria-label^="Compose"]');
}

/**
 * Verify an email exists in Sent by subject (and optionally recipient).
 * @param {import('@playwright/test').Page} page
 * @param {{ subject: string, to?: string, timeoutMs?: number }} opts
 */
export async function verifyEmailInSent(page, { subject, to, timeoutMs = 20000 }) {
  // Navigate to Sent from the left navigation
  await page.getByRole('link', { name: /^Sent$/ }).click();

  // Gmail rows use tr.zA; subject text commonly inside span.bog
  const rowBySubject = page.locator('tr.zA').filter({ has: page.locator('span.bog', { hasText: subject }) });

  try {
    await expect(rowBySubject.first()).toBeVisible({ timeout: timeoutMs });
  } catch {
    // Fallback to any subject text within the main region
    const anyMatch = page.getByRole('main').getByText(subject, { exact: false }).first();
    await expect(anyMatch).toBeVisible({ timeout: timeoutMs });
  }

  if (to) {
    const firstRecipient = to.split(',')[0].trim();
    const softRecipient = rowBySubject.first().getByText(firstRecipient, { exact: false });
    try { await softRecipient.isVisible({ timeout: 1000 }); } catch {}
  }
}

/**
 * Sign out from Gmail.
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  // Open account menu (avatar button)
  const avatarBtn = page.getByRole('button', { name: /Google Account/i }).first();
  if (await avatarBtn.isVisible()) {
    await avatarBtn.click();
  } else {
    const fallbackAvatar = page.locator('a[aria-label^="Google Account"], img[alt^="Google Account"]').first();
    await fallbackAvatar.click();
  }

  // Click Sign out from the account card; prefer role=button, fallback to link
  const signOutBtn = page
    .getByRole('button', { name: /^Sign out$/i })
    .or(page.getByRole('link', { name: /^Sign out$/i }))
    .first();

  try {
    await signOutBtn.waitFor({ state: 'visible', timeout: 5000 });
    await signOutBtn.scrollIntoViewIfNeeded();
    await signOutBtn.click();
  } catch {
    // Fallback to direct logout endpoint if UI click fails
    await page.goto('https://accounts.google.com/Logout');
  }

  // Wait for Google sign-in page to appear
  await Promise.race([
    page.waitForURL(/accounts\.google\.com\/.+(ServiceLogin|signin)/i, { timeout: 30000 }),
    page.getByLabel('Email or phone').waitFor({ timeout: 30000 }).catch(() => {})
  ]);
}
