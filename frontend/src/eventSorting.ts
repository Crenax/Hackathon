import type { Listing } from "./api";

function startTimestamp(event: Listing): number {
    const timestamp = new Date(event.startTime ?? "").getTime();
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function compareEventsFutureToPast(first: Listing, second: Listing): number {
    return startTimestamp(second) - startTimestamp(first);
}
