export function toHalfWidth(str) {
  return str.replace(/[０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
}

export function parseTimeToSeconds(input) {
  let s = toHalfWidth(input).replace(/[^0-9]/g, '');
  if (!s) return 0;
  
  let h = 0, m = 0, sec = 0;
  if (s.length <= 2) {
    sec = parseInt(s, 10);
  } else if (s.length === 3) {
    m = parseInt(s.slice(0, 1), 10);
    sec = parseInt(s.slice(1, 3), 10);
  } else if (s.length === 4) {
    m = parseInt(s.slice(0, 2), 10);
    sec = parseInt(s.slice(2, 4), 10);
  } else if (s.length === 5) {
    h = parseInt(s.slice(0, 1), 10);
    m = parseInt(s.slice(1, 3), 10);
    sec = parseInt(s.slice(3, 5), 10);
  } else {
    h = parseInt(s.slice(0, s.length - 4), 10);
    m = parseInt(s.slice(-4, -2), 10);
    sec = parseInt(s.slice(-2), 10);
  }
  return h * 3600 + m * 60 + sec;
}

export function formatSeconds(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  
  const mStr = m.toString().padStart(2, '0');
  const sStr = s.toString().padStart(2, '0');
  
  if (h > 0) {
    const hStr = h.toString().padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}

export function parseAlarmTime(input) {
  let s = toHalfWidth(input).replace(/[^0-9]/g, '');
  if (!s) return "00:00";
  let h = 0, m = 0;
  if (s.length <= 2) {
    h = parseInt(s, 10);
  } else if (s.length === 3) {
    h = parseInt(s.slice(0, 1), 10);
    m = parseInt(s.slice(1, 3), 10);
  } else {
    h = parseInt(s.slice(0, s.length - 2), 10);
    m = parseInt(s.slice(-2), 10);
  }
  h = Math.min(23, h);
  m = Math.min(59, m);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function calculateNextAlarmTime(timeStr, days) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

  if (days && days.length > 0) {
    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(target.getTime() + i * 24 * 60 * 60 * 1000);
      if (i === 0 && checkDate.getTime() <= now.getTime()) {
        continue;
      }
      if (days.includes(checkDate.getDay())) {
        return checkDate.getTime();
      }
    }
  } else {
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }
  return null;
}

export function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}
