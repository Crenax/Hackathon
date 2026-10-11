import locationsTsv from "./locations.tsv?raw";

export const locationRooms = [...new Set(
    locationsTsv
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((row) => row.split("\t")[0].trim())
        .filter(Boolean),
)];
