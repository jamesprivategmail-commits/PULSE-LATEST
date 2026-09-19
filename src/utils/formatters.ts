/**
 * Standard number & metric formatters for Pulse
 * Formats numbers into clean compact notations:
 * - K: Thousands (e.g. 100K, 300K, 4.2K)
 * - M: Millions (e.g. 100M, 500M, 1.5M)
 * - B: Billions (e.g. 500B, 1B)
 * - T: Trillions (e.g. 500T, 1T)
 */
export function formatCount(n: number | string | undefined | null): string {
  if (n === undefined || n === null) return '0';
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num) || num <= 0) return '0';

  const abs = Math.abs(num);

  if (abs >= 1_000_000_000_000) {
    const val = abs / 1_000_000_000_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')) + 'T';
  }
  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')) + 'B';
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')) + 'M';
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')) + 'K';
  }
  return Math.round(abs).toString();
}

/**
 * Format timestamp into human-readable relative time
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 604800)}w ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
