import type { Epubier, EpubierFormat } from "../epubier.js";
export type * from "../epubier.js";

/** Makes an `epubier()` function that reads books in the given formats. */
export function createEpubier(formats: EpubierFormat[]): Epubier;
