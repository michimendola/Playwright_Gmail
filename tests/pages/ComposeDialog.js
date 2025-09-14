// @ts-check
import { expect } from '@playwright/test';

export class ComposeDialog {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.dialog = page.getByRole('dialog', { name: /New Message|Compose/i });
  }

  async open() {
    await this.page.getByRole('button', { name: 'Compose' }).click();
    await this.dialog.waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillTo(to) {
    const toCombo = this.dialog.getByRole('combobox', { name: /To recipients/i }).first();
    try {
      await toCombo.click();
      try { await toCombo.fill(to); } catch { await this.page.keyboard.type(to); }
      await this.page.keyboard.press('Enter');
    } catch {
      const toFieldFallback = this.dialog
        .locator('textarea[name="to"], textarea[aria-label="To"], input[aria-label="To"]').first();
      await toFieldFallback.click();
      await toFieldFallback.type(to);
      await this.page.keyboard.press('Enter');
    }
  }

  async fillSubject(subject) {
    const subjectField = this.dialog.locator('input[name="subjectbox"]').first();
    await subjectField.fill(subject);
  }

  async fillBody(body) {
    const bodyField = this.dialog.locator('div[aria-label="Message Body"]').first();
    await bodyField.click();
    await bodyField.type(body);
  }

  async send() {
    const sendButton = this.dialog.getByRole('button', { name: /^Send/ }).first();
    await sendButton.click();

    const successToast = this.page
      .locator('[role="alert"], [aria-live="assertive"], [aria-live="polite"]')
      .filter({ hasText: /Message sent/i })
      .first();
    const missingRecipientDialog = this.page
      .getByRole('alertdialog')
      .filter({ hasText: /Missing recipient|Please specify at least one recipient/i })
      .first();

    await Promise.race([
      successToast.waitFor({ timeout: 10000 }).catch(() => {}),
      missingRecipientDialog.waitFor({ timeout: 8000 }).catch(() => {}),
    ]);

    if (await successToast.isVisible()) {
      return { sent: true };
    }

    if (await missingRecipientDialog.isVisible()) {
      try { await this.page.getByRole('button', { name: /^OK$/i }).click(); } catch {}
      try {
        const discardBtn = this.dialog.getByRole('button', { name: /Discard draft/i }).first();
        if (await discardBtn.isVisible()) {
          await discardBtn.click();
        } else {
          const closeIcon = this.dialog.locator('img[alt="Save & close"]').first();
          if (await closeIcon.isVisible()) await closeIcon.click(); else await this.page.keyboard.press('Escape');
        }
      } catch {}
      return { sent: false, reason: 'missing-recipient' };
    }

    const textFallback = this.page.getByText(/Message sent/i).first();
    if (await textFallback.isVisible()) return { sent: true };
    return { sent: false, reason: 'unknown' };
  }
}
