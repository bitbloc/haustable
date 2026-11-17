// A table with a known capacity smaller than the party cannot be booked online.
// Tables with no capacity set (0 / null) are not blocked: staff seat those by hand.
export const isTableTooSmall = (table, pax) => {
    const cap = Number(table?.capacity)
    return Number.isFinite(cap) && cap > 0 && cap < Number(pax || 0)
}
