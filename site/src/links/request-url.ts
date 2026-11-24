export function requestUrl(repoUrl: string, query: string): string {
  const e = encodeURIComponent(query.trim().slice(0, 200));
  return `${repoUrl}/issues/new?template=plugin-request.yml&title=${e}&what=${e}`;
}
