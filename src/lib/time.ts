const WITA_TIMEZONE = "Asia/Makassar";
const WITA_UTC_OFFSET = "+08:00";

function toWitaDateObject(dateInput: Date | string) {
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }

  if (!dateInput || typeof dateInput !== "string" || dateInput.trim().length < 10) {
    return new Date();
  }

  const d = new Date(`${dateInput.trim().slice(0, 10)}T00:00:00${WITA_UTC_OFFSET}`);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function getWitaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WITA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function formatWitaDate(date: string) {
  if (!date || typeof date !== "string" || date.trim() === "") {
    return "";
  }
  try {
    const d = toWitaDateObject(date);
    if (isNaN(d.getTime())) return date;
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: WITA_TIMEZONE,
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return date || "";
  }
}

export function formatWitaDateTime(dateTime: string) {
  if (!dateTime) return "";
  try {
    const d = new Date(dateTime);
    if (isNaN(d.getTime())) return dateTime;
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: WITA_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateTime || "";
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function getWitaDisplayDateUppercase(date: Date | string = new Date()) {
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: WITA_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .formatToParts(toWitaDateObject(date))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`.toUpperCase();
}

export function isWitaFriday(date: Date | string = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: WITA_TIMEZONE,
    weekday: "short",
  }).format(toWitaDateObject(date));

  return weekday === "Fri";
}
