const MAX_EVENT_TITLE_LENGTH = 80;

export function getEventTitle(courses: readonly string[]): string {
    const title = courses.join(", ") || "Study session";
    const characters = Array.from(title);

    return characters.length > MAX_EVENT_TITLE_LENGTH
        ? `${characters.slice(0, MAX_EVENT_TITLE_LENGTH - 1).join("").trimEnd()}…`
        : title;
}
