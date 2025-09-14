// @ts-check
import { expect } from '@playwright/test';

export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('https://mail.google.com/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async fillEmailAndNext(email) {
    await this.page.getByLabel('Email or phone').fill(email);
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  async maybeDismissPasskey() {
    const passkeyHeading = this.page.getByRole('heading', { name: 'Sign in faster' });
    const notNowBtn = this.page.getByRole('button', { name: /^Not now$/i });
    try {
      await passkeyHeading.waitFor({ state: 'visible', timeout: 2000 });
      if (await notNowBtn.isVisible()) {
        await notNowBtn.click();
        await this.page.waitForLoadState('domcontentloaded');
      }
    } catch {}
  }

  async maybeDismissRecovery() {
    const heading = this.page.getByRole('heading', { name: /Make sure you can always sign in/i });
    const cancel = this.page.getByRole('button', { name: /^Cancel$/i });
    try {
      await heading.waitFor({ state: 'visible', timeout: 2000 });
      if (await cancel.isVisible()) {
        await cancel.click();
        await this.page.waitForLoadState('domcontentloaded');
      }
    } catch {}
  }

  async fillPasswordAndSubmit(password) {
    const blocked = this.page.getByRole('heading', { level: 1, name: /Couldn[’']t sign you in/i });
    if (await blocked.isVisible()) {
      throw new Error('Google blocked automated sign-in. Try --project=chrome or storageState.');
    }
    const passwordField = this.page.getByLabel('Enter your password');
    await expect(passwordField).toBeVisible({ timeout: 15000 });
    await passwordField.fill(password);
    await this.page.getByRole('button', { name: 'Next' }).click();
  }

  async waitForInboxOrBlock() {
    const compose = this.page.getByRole('button', { name: 'Compose' });
    const blocked = this.page.getByRole('heading', { level: 1, name: /Couldn[’']t sign you in/i });
    await Promise.race([
      compose.waitFor({ state: 'visible', timeout: 30000 }),
      blocked.waitFor({ timeout: 30000 }),
    ]);
    if (await blocked.isVisible()) {
      throw new Error('Google blocked automated sign-in after password.');
    }
    await expect(compose).toBeVisible({ timeout: 30000 });
  }

  async login(username, password) {
    await this.goto();
    await this.fillEmailAndNext(username);
    await this.maybeDismissPasskey();
    await this.maybeDismissRecovery();
    await this.fillPasswordAndSubmit(password);
    await this.maybeDismissPasskey();
    await this.maybeDismissRecovery();
    await this.waitForInboxOrBlock();
  }
}
