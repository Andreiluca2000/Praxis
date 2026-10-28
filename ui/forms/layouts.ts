// Geometrie der Vordrucke (aus der KBV-Mustersammlung abgeleitet, siehe data/forms/layout/README.md).
import muster02 from '../../data/forms/layout/muster-02.json' with { type: 'json' };
import muster04 from '../../data/forms/layout/muster-04.json' with { type: 'json' };
import muster06 from '../../data/forms/layout/muster-06.json' with { type: 'json' };
import muster10 from '../../data/forms/layout/muster-10.json' with { type: 'json' };
import muster13 from '../../data/forms/layout/muster-13.json' with { type: 'json' };
import type { FormId } from '../../src/forms/types.js';

type Rect = [number, number, number, number];

export interface FormLayout {
  width: number;
  height: number;
  tint: string | null;
  bands: Rect[];
  whites: Rect[];
  strokes: ({ rect: Rect; w: number } | { line: [number, number, number, number]; w: number })[];
  fills: Rect[];
  labels: { t: string; x: number; y: number; s: number; b: boolean; i: boolean; ghost: boolean; dark: boolean }[];
}

export const LAYOUTS: Readonly<Record<FormId, FormLayout>> = {
  'muster-06': muster06 as unknown as FormLayout,
  'muster-02': muster02 as unknown as FormLayout,
  'muster-04': muster04 as unknown as FormLayout,
  'muster-10': muster10 as unknown as FormLayout,
  'muster-13': muster13 as unknown as FormLayout,
};
