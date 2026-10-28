// Geometrie der Vordrucke (aus der KBV-Mustersammlung abgeleitet, siehe data/forms/layout/README.md).
import muster02 from '../../data/forms/layout/muster-02.json' with { type: 'json' };
import muster03 from '../../data/forms/layout/muster-03.json' with { type: 'json' };
import muster04 from '../../data/forms/layout/muster-04.json' with { type: 'json' };
import muster05 from '../../data/forms/layout/muster-05.json' with { type: 'json' };
import muster06 from '../../data/forms/layout/muster-06.json' with { type: 'json' };
import muster07 from '../../data/forms/layout/muster-07.json' with { type: 'json' };
import muster08 from '../../data/forms/layout/muster-08.json' with { type: 'json' };
import muster08a from '../../data/forms/layout/muster-08a.json' with { type: 'json' };
import muster09 from '../../data/forms/layout/muster-09.json' with { type: 'json' };
import muster10 from '../../data/forms/layout/muster-10.json' with { type: 'json' };
import muster10a from '../../data/forms/layout/muster-10a.json' with { type: 'json' };
import muster11 from '../../data/forms/layout/muster-11.json' with { type: 'json' };
import muster12 from '../../data/forms/layout/muster-12.json' with { type: 'json' };
import muster13 from '../../data/forms/layout/muster-13.json' with { type: 'json' };
import muster15 from '../../data/forms/layout/muster-15.json' with { type: 'json' };
import muster16 from '../../data/forms/layout/muster-16.json' with { type: 'json' };
import muster19 from '../../data/forms/layout/muster-19.json' with { type: 'json' };
import muster20 from '../../data/forms/layout/muster-20.json' with { type: 'json' };
import muster21 from '../../data/forms/layout/muster-21.json' with { type: 'json' };
import muster22 from '../../data/forms/layout/muster-22.json' with { type: 'json' };
import muster25 from '../../data/forms/layout/muster-25.json' with { type: 'json' };
import muster26 from '../../data/forms/layout/muster-26.json' with { type: 'json' };
import muster27 from '../../data/forms/layout/muster-27.json' with { type: 'json' };
import muster28 from '../../data/forms/layout/muster-28.json' with { type: 'json' };
import muster36 from '../../data/forms/layout/muster-36.json' with { type: 'json' };
import muster39 from '../../data/forms/layout/muster-39.json' with { type: 'json' };
import muster50 from '../../data/forms/layout/muster-50.json' with { type: 'json' };
import muster51 from '../../data/forms/layout/muster-51.json' with { type: 'json' };
import muster52 from '../../data/forms/layout/muster-52.json' with { type: 'json' };
import muster53 from '../../data/forms/layout/muster-53.json' with { type: 'json' };
import muster55 from '../../data/forms/layout/muster-55.json' with { type: 'json' };
import muster56 from '../../data/forms/layout/muster-56.json' with { type: 'json' };
import muster61 from '../../data/forms/layout/muster-61.json' with { type: 'json' };
import muster62a from '../../data/forms/layout/muster-62a.json' with { type: 'json' };
import muster62b from '../../data/forms/layout/muster-62b.json' with { type: 'json' };
import muster62c from '../../data/forms/layout/muster-62c.json' with { type: 'json' };
import muster63 from '../../data/forms/layout/muster-63.json' with { type: 'json' };
import muster64 from '../../data/forms/layout/muster-64.json' with { type: 'json' };
import muster65 from '../../data/forms/layout/muster-65.json' with { type: 'json' };
import muster70 from '../../data/forms/layout/muster-70.json' with { type: 'json' };
import muster70a from '../../data/forms/layout/muster-70a.json' with { type: 'json' };
import muster85 from '../../data/forms/layout/muster-85.json' with { type: 'json' };
import muster86 from '../../data/forms/layout/muster-86.json' with { type: 'json' };
import type { FormId } from '../../src/forms/types.js';

type Rect = [number, number, number, number];

export interface FormLayout {
  width: number;
  height: number;
  tint: string | null;
  bands: Rect[];
  whites: Rect[];
  strokes: ({ rect: Rect; w: number; /** Eckenradius (Ankreuz-Ovale) */ r?: number } | { line: [number, number, number, number]; w: number })[];
  fills: (Rect | [number, number, number, number, string])[];
  labels: { t: string; x: number; y: number; s: number; b: boolean; i: boolean; ghost: boolean; dark: boolean; white?: boolean }[];
}

type Stored = FormLayout | { pages: FormLayout[] };

/** Seiten eines Vordrucks (einseitige Vordrucke haben genau eine). */
export function pagesOf(id: FormId): FormLayout[] {
  const l = LAYOUTS[id];
  return 'pages' in l ? l.pages : [l];
}

const LAYOUTS: Readonly<Record<FormId, Stored>> = {
  'muster-06': muster06 as unknown as FormLayout,
  'muster-02': muster02 as unknown as FormLayout,
  'muster-04': muster04 as unknown as FormLayout,
  'muster-10': muster10 as unknown as FormLayout,
  'muster-10a': muster10a as unknown as FormLayout,
  'muster-13': muster13 as unknown as FormLayout,
  'muster-21': muster21 as unknown as FormLayout,
  'muster-20': muster20 as unknown as FormLayout,
  'muster-55': muster55 as unknown as FormLayout,
  'muster-19': muster19 as unknown as FormLayout,
  'muster-52': muster52 as unknown as FormLayout,
  'muster-63': muster63 as unknown as FormLayout,
  'muster-09': muster09 as unknown as Stored,
  'muster-26': muster26 as unknown as FormLayout,
  'muster-27': muster27 as unknown as FormLayout,
  'muster-64': muster64 as unknown as Stored,
  'muster-65': muster65 as unknown as FormLayout,
  'muster-03': muster03 as unknown as Stored,
  'muster-05': muster05 as unknown as FormLayout,
  'muster-07': muster07 as unknown as FormLayout,
  'muster-08': muster08 as unknown as Stored,
  'muster-08a': muster08a as unknown as Stored,
  'muster-11': muster11 as unknown as FormLayout,
  'muster-15': muster15 as unknown as Stored,
  'muster-16': muster16 as unknown as FormLayout,
  'muster-22': muster22 as unknown as FormLayout,
  'muster-25': muster25 as unknown as FormLayout,
  'muster-28': muster28 as unknown as FormLayout,
  'muster-36': muster36 as unknown as FormLayout,
  'muster-39': muster39 as unknown as FormLayout,
  'muster-50': muster50 as unknown as Stored,
  'muster-51': muster51 as unknown as Stored,
  'muster-53': muster53 as unknown as Stored,
  'muster-56': muster56 as unknown as Stored,
  'muster-62a': muster62a as unknown as FormLayout,
  'muster-62b': muster62b as unknown as Stored,
  'muster-62c': muster62c as unknown as FormLayout,
  'muster-70': muster70 as unknown as FormLayout,
  'muster-70a': muster70a as unknown as FormLayout,
  'muster-85': muster85 as unknown as FormLayout,
  'muster-86': muster86 as unknown as FormLayout,
  'muster-12': muster12 as unknown as FormLayout,
  'muster-61': muster61 as unknown as Stored,
};
