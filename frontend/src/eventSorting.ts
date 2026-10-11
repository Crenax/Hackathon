import type { Listing } from "./api";

// Sorted by end time; events without an end time use their start time
function endTimestamp(event: Listing): number {
    const timestamp = new Date(event.endTime ?? event.startTime ?? "").getTime();
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function compareEventsFutureToPast(first: Listing, second: Listing): number {
    return endTimestamp(second) - endTimestamp(first);
}
