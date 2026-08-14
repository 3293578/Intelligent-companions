function dateKey(value, locale, timeZone) {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftCalendarDay(value, amount, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + amount));
}

export function formatChatTimestamp(value, options = {}) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) return '';

  const now = new Date(options.now || Date.now());
  if (!Number.isFinite(now.getTime())) return '';
  const locale = options.locale || 'zh-CN';
  const timeZone = options.timeZone;
  const time = new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(timestamp);
  const messageDay = dateKey(timestamp, locale, timeZone);

  if (messageDay === dateKey(now, locale, timeZone)) {
    return `${String(locale).startsWith('zh') ? '今天' : 'Today'} ${time}`;
  }
  if (messageDay === dateKey(shiftCalendarDay(now, -1, timeZone), locale, timeZone)) {
    return `${String(locale).startsWith('zh') ? '昨天' : 'Yesterday'} ${time}`;
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(timestamp);
}
