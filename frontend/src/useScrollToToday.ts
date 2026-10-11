import { useLayoutEffect, useRef } from "react";

export function useScrollToToday(eventSequence: string) {
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const now = Date.now();
        let nearestNonEndedItem: HTMLElement | undefined;

        container.querySelectorAll<HTMLElement>("[data-event-end]").forEach((item) => {
            const eventEnd = Number(item.dataset.eventEnd);
            if (!Number.isFinite(eventEnd) || eventEnd < now) return;

            // Events are ordered from future to past, so the final non-ended
            // item is the event closest to the present.
            nearestNonEndedItem = item;
        });

        if (!nearestNonEndedItem) {
            container.scrollTop = 0;
            return;
        }

        // Put the active/ended boundary at the bottom of the viewport. This
        // keeps ended events out of the initial view whenever enough upcoming
        // content exists, while retaining access to them by scrolling down.
        const nonEndedBoundary = nearestNonEndedItem.offsetTop + nearestNonEndedItem.offsetHeight;
        container.scrollTop = Math.max(0, nonEndedBoundary - container.clientHeight);
    }, [eventSequence]);

    return containerRef;
}
