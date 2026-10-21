// Small display helpers shared by the dashboard and the tables. Plain functions, no React.

const int = new Intl.NumberFormat('en-US');
const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const formatInt = (n) => (Number.isFinite(n) ? int.format(n) : '–');

// 1,234 -> "1.2K", 1,500,000 -> "1.5M"; small numbers stay as they are.
export function compact(n) {
    if (!Number.isFinite(n)) return '–';
    const abs = Math.abs(n);
    if (abs < 1000) return int.format(Math.round(n * 10) / 10);
    const [value, suffix] = abs >= 1e9 ? [n / 1e9, 'B'] : abs >= 1e6 ? [n / 1e6, 'M'] : [n / 1e3, 'K'];
    return `${(Math.round(value * 10) / 10).toString()}${suffix}`;
}

export const usd = (n) => (Number.isFinite(n) ? usdWhole.format(n) : '–');
export const usdCompact = (n) => (Number.isFinite(n) ? `$${compact(n)}` : '–');

// 0.724 -> "72%". `digits` for the rare place that wants "72.4%".
export function pct(ratio, digits = 0) {
    return Number.isFinite(ratio) ? `${(ratio * 100).toFixed(digits)}%` : '–';
}

// "+3", "-2", "0".
export const signed = (n) => (n > 0 ? `+${int.format(n)}` : n < 0 ? `-${int.format(Math.abs(n))}` : '0');

// "5 minutes ago", "3 days ago": how long before `now`, for last-seen columns.
export function ago(value, now = new Date()) {
    const t = new Date(value).getTime();
    if (!value || Number.isNaN(t)) return 'never';
    const seconds = Math.max(0, Math.round((now.getTime() - t) / 1000));
    const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
    let amount = seconds;
    for (const [size, unit] of steps) {
        if (amount < size) {
            if (unit === 'second' && amount < 10) return 'just now';
            return `${amount} ${unit}${amount === 1 ? '' : 's'} ago`;
        }
        amount = Math.floor(amount / size);
    }
    return 'long ago';
}

export function dateTime(value, timeZone = 'America/New_York') {
    const t = new Date(value);
    if (!value || Number.isNaN(t.getTime())) return '–';
    return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(t);
}

export function shortDate(value, timeZone = 'America/New_York') {
    const t = new Date(value);
    if (!value || Number.isNaN(t.getTime())) return '–';
    return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(t);
}
