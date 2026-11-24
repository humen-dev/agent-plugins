// Ambient type for the generated catalog; tsc never resolves the JSON file (Vite alias, vite.config.ts).
declare module '@generated/catalog' {
  const catalog: import('./types.ts').Catalog;
  export default catalog;
}
