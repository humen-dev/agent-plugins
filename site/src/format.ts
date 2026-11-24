/** UTC YYYY-MM-DD of an ISO 8601 date; independent of the viewer's time zone (AC-51). */
export const utcDay = (iso: string): string => new Date(iso).toISOString().slice(0, 10);

export const shortSha = (sha: string): string => sha.slice(0, 7);
