export type Inline =
  | { t: 'text'; text: string }
  | { t: 'code'; text: string }
  | { t: 'strong'; text: string }
  | { t: 'em'; text: string }
  | { t: 'link'; href: string; children: Exclude<Inline, { t: 'link' | 'image' }>[] } // href raw, resolved at render
  | { t: 'image'; src: string; alt: string };                                         // src raw; never an <img>
export interface ListBlock { t: 'list'; ordered: boolean; items: { children: Inline[]; sub: ListBlock | null }[] }
export type Block =
  | { t: 'heading'; level: 1 | 2 | 3; children: Inline[] }   // # → 1, ## → 2, ###..###### → 3
  | { t: 'para'; children: Inline[] }
  | ListBlock                                                 // sub is set only on top-level items
  | { t: 'code'; lang: string; text: string }                 // fenced; verbatim
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { t: 'quote'; children: Block[] }
  | { t: 'hr' };
export const LIMITS = { quoteDepth: 3, listDepth: 2 } as const;
// a ">" beyond quoteDepth stays literal text; an item indented beyond listDepth joins the level-2 item list
