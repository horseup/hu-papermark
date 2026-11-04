import type { AnchorRect } from './room-types';
// Popover position as fractions (0..1) of the rendered page. Kept free of react-pdf so pages can import it during SSR.
export type Point = { left: number; top: number };
export const anchorPoint = (rects: AnchorRect[]): Point => { const last = rects[rects.length - 1]; return { left: last.x + last.w, top: last.y + last.h }; };
