/**
 * Browser-wallet ergonomics shared by every signing path.
 *
 * Both helpers exist because of the same underlying fact: a wallet extension
 * will not open a signing prompt while its tab is in the background. It
 * reports that as "Requested resource not available" / "The tab is not
 * active", which is indistinguishable from a chain error in the raw message.
 */

/**
 * A prompt can only be raised when the tab is both visible AND focused.
 * `visibilityState` alone is not enough: right after a wallet popup closes the
 * tab is visible but has not yet regained focus, which is exactly the window
 * in which a loop firing back-to-back transactions will fail.
 */
function isTabFocused(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && document.hasFocus();
}

/**
 * Block until the tab can raise a wallet prompt.
 *
 * Needed whenever more than one transaction is signed in sequence: confirming
 * the first hands focus to the wallet popup, and the next `writeContract`
 * would otherwise fire while the tab is still backgrounded and be refused.
 * Waiting converts a hard failure into a pause the user resolves by clicking
 * back into the page.
 *
 * Polls as well as listening for events, because the relevant `focus` may fire
 * between the check and the listener being attached.
 */
export function awaitTabFocus(
  onWaiting?: () => void,
  timeoutMs = 180_000
): Promise<void> {
  if (isTabFocused()) return Promise.resolve();

  onWaiting?.();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
    const check = () => {
      if (isTabFocused()) {
        cleanup();
        resolve();
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          'Timed out waiting for this tab to regain focus. Click back into the page and try again — completed steps are skipped.'
        )
      );
    }, timeoutMs);

    const poll = setInterval(check, 250);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
  });
}

/**
 * Turn a wallet's own error text into something that names the actual problem.
 * Every signing path here is idempotent, so "try again" is genuinely safe
 * advice rather than a shrug.
 */
export function friendlyError(err: unknown): string {
  const msg = (err as Error)?.message ?? String(err);

  if (
    msg.includes('tab is not active') ||
    msg.includes('Requested resource not available')
  ) {
    return 'The wallet could not open a prompt because this tab was in the background. Keep the tab focused and try again — completed steps are skipped automatically.';
  }
  if (
    msg.includes('User rejected') ||
    msg.includes('User denied') ||
    msg.includes('rejected the request')
  ) {
    return 'Rejected in the wallet.';
  }
  return msg;
}
