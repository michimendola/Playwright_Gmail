// @ts-check
import { expect } from '@playwright/test';

export class InboxPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  composeButton() {
    return this.page.getByRole('button', { name: 'Compose' });
  }

  async goToInbox() {
    await this.page.getByRole('link', { name: /^Inbox$/ }).click();
    await expect(this.composeButton()).toBeVisible();
  }

  async goToSent() {
    await this.page.getByRole('link', { name: /^Sent$/ }).click();
  }

  async verifyInSent(subject, to, timeoutMs = 20000) {
    await this.goToSent();
    const rowBySubject = this.page
      .locator('tr.zA')
      .filter({ has: this.page.locator('span.bog', { hasText: subject }) });

    try {
      await expect(rowBySubject.first()).toBeVisible({ timeout: timeoutMs });
    } catch {
      const anyMatch = this.page.getByRole('main').getByText(subject, { exact: false }).first();
      await expect(anyMatch).toBeVisible({ timeout: timeoutMs });
    }

    if (to) {
      const firstRecipient = to.split(',')[0].trim();
      try {
        await rowBySubject.first().getByText(firstRecipient, { exact: false }).isVisible({ timeout: 1000 });
      } catch {}
    }
  }

  async logout() {
    const avatarBtn = this.page.getByRole('button', { name: /Google Account/i }).first();
    if (await avatarBtn.isVisible()) {
      await avatarBtn.click();
    } else {
      const fallbackAvatar = this.page
        .locator('a[aria-label^="Google Account"], img[alt^="Google Account"]').first();
      await fallbackAvatar.click();
    }

    const signOutBtn = this.page
      .getByRole('button', { name: /^Sign out$/i })
      .or(this.page.getByRole('link', { name: /^Sign out$/i }))
      .first();

    try {
      await signOutBtn.waitFor({ state: 'visible', timeout: 5000 });
      await signOutBtn.scrollIntoViewIfNeeded();
      await signOutBtn.click();
    } catch {
      await this.page.goto('https://accounts.google.com/Logout');
    }

    await Promise.race([
      this.page.waitForURL(/accounts\.google\.com\/.+(ServiceLogin|signin)/i, { timeout: 30000 }),
      this.page.getByLabel('Email or phone').waitFor({ timeout: 30000 }).catch(() => {}),
    ]);
  }
}
