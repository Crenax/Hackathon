import { useLayoutEffect, useRef } from "react";

export function localDayTimestamp(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function useScrollToToday(eventSequence: string) {
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const today = localDayTimestamp(new Date());
        let closestItem: HTMLElement | undefined;
        let closestDistance = Number.POSITIVE_INFINITY;

        container.querySelectorAll<HTMLElement>("[data-event-day]").forEach((item) => {
            const eventDay = Number(item.dataset.eventDay);
            if (!Number.isFinite(eventDay)) return;

            const distance = Math.abs(eventDay - today);
            if (distance < closestDistance) {
                closestItem = item;
                closestDistance = distance;
            }
        });

        container.scrollTop = closestItem?.offsetTop ?? 0;
    }, [eventSequence]);

    return containerRef;
}
