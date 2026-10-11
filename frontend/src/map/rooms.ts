import locationsTsv from "./locations.tsv?raw";

export const locationRooms = [...new Set(
    locationsTsv
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((row) => row.split("\t")[0].trim())
        .filter(Boolean),
)];

function roomKey(value: string): string {
    return value
        .trim()
        .toLocaleUpperCase()
        .replace(/^ETH[. ]/, "")
        .replace(/\s/g, "");
}

export function findLocationRoom(value: string | null | undefined): string | undefined {
    if (!value?.trim()) return undefined;

    const key = roomKey(value);
    return locationRooms.find((room) => roomKey(room) === key);
}
