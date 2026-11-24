export type Scope = 'user' | 'project';
export interface MissingDep { dep: string; version: string | null; forName: string } // AC-38b
export interface ResolvedSet {
  selected: string[];                  // input names that are catalog plugins; unique, sorted (code-unit order)
  final: string[];                     // selected ∪ transitive in-catalog dependencies; unique, sorted
  addedFor: Record<string, string[]>;  // auto-added name (not in selected) → sorted names whose dependency pulled it in
  missing: MissingDep[];               // deps with inCatalog false or not in catalog.plugins; walk order; unique per dep+forName
  dropped: string[];                   // input names not in the catalog; input order; unique
}
export interface ParsedP { names: string[]; ignored: number } // Decision 4
export const P_LIMITS = { chars: 2000, entries: 200 } as const;
export const NOTICE_LIMITS = { names: 5, nameChars: 40 } as const;
export const STORAGE_KEY = 'catalog.installSet';
