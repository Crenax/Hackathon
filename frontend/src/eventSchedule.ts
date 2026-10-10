function parseDate(value: string | null): Date | undefined {
    if (!value) return undefined;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function calendarDayNumber(date: Date): number {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameLocalDay(first: Date, second: Date): boolean {
    return calendarDayNumber(first) === calendarDayNumber(second);
}

function formatDay(date: Date, referenceDate: Date): string {
    const dayDifference = Math.round(
        (calendarDayNumber(date) - calendarDayNumber(referenceDate)) / (24 * 60 * 60 * 1000),
    );

    if (dayDifference === 0) return "Today";
    if (dayDifference === 1) return "Tomorrow";
    if (dayDifference === -1) return "Yesterday";
    if (Math.abs(dayDifference) < 7) {
        return date.toLocaleDateString(undefined, { weekday: "long" });
    }

    return date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: date.getFullYear() === referenceDate.getFullYear() ? undefined : "numeric",
    });
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatEventSchedule(
    startValue: string | null,
    endValue: string | null,
    referenceDate = new Date(),
): string {
    const start = parseDate(startValue);
    const end = parseDate(endValue);

    if (!start && !end) return "Date and time to be confirmed";
    if (!start && end) return `Ends ${formatDay(end, referenceDate)} at ${formatTime(end)}`;
    if (start && !end) return `${formatDay(start, referenceDate)} at ${formatTime(start)}`;

    if (isSameLocalDay(start!, end!)) {
        return `${formatDay(start!, referenceDate)} · ${formatTime(start!)}–${formatTime(end!)}`;
    }

    return `${formatDay(start!, referenceDate)} · ${formatTime(start!)} – ${formatDay(end!, referenceDate)} · ${formatTime(end!)}`;
}
