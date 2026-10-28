// Geometrie der Vordrucke (aus der KBV-Mustersammlung abgeleitet, siehe data/forms/layout/README.md).
import muster02 from '../../data/forms/layout/muster-02.json' with { type: 'json' };
import muster04 from '../../data/forms/layout/muster-04.json' with { type: 'json' };
import muster06 from '../../data/forms/layout/muster-06.json' with { type: 'json' };
import muster09 from '../../data/forms/layout/muster-09.json' with { type: 'json' };
import muster10 from '../../data/forms/layout/muster-10.json' with { type: 'json' };
import muster10a from '../../data/forms/layout/muster-10a.json' with { type: 'json' };
import muster12 from '../../data/forms/layout/muster-12.json' with { type: 'json' };
import muster13 from '../../data/forms/layout/muster-13.json' with { type: 'json' };
import muster19 from '../../data/forms/layout/muster-19.json' with { type: 'json' };
import muster20 from '../../data/forms/layout/muster-20.json' with { type: 'json' };
import muster21 from '../../data/forms/layout/muster-21.json' with { type: 'json' };
import muster26 from '../../data/forms/layout/muster-26.json' with { type: 'json' };
import muster27 from '../../data/forms/layout/muster-27.json' with { type: 'json' };
import muster52 from '../../data/forms/layout/muster-52.json' with { type: 'json' };
import muster55 from '../../data/forms/layout/muster-55.json' with { type: 'json' };
import muster61 from '../../data/forms/layout/muster-61.json' with { type: 'json' };
import muster63 from '../../data/forms/layout/muster-63.json' with { type: 'json' };
import muster64 from '../../data/forms/layout/muster-64.json' with { type: 'json' };
import muster65 from '../../data/forms/layout/muster-65.json' with { type: 'json' };
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
  'muster-12': muster12 as unknown as FormLayout,
  'muster-61': muster61 as unknown as Stored,
};
