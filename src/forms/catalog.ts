// Vordrucke werden beim Bauen eingebunden; die Form prüft tests/forms-data.test.ts gegen das Schema.
import muster02 from '../../data/forms/muster-02.json' with { type: 'json' };
import muster03 from '../../data/forms/muster-03.json' with { type: 'json' };
import muster04 from '../../data/forms/muster-04.json' with { type: 'json' };
import muster05 from '../../data/forms/muster-05.json' with { type: 'json' };
import muster06 from '../../data/forms/muster-06.json' with { type: 'json' };
import muster07 from '../../data/forms/muster-07.json' with { type: 'json' };
import muster08 from '../../data/forms/muster-08.json' with { type: 'json' };
import muster08a from '../../data/forms/muster-08a.json' with { type: 'json' };
import muster09 from '../../data/forms/muster-09.json' with { type: 'json' };
import muster10 from '../../data/forms/muster-10.json' with { type: 'json' };
import muster10a from '../../data/forms/muster-10a.json' with { type: 'json' };
import muster11 from '../../data/forms/muster-11.json' with { type: 'json' };
import muster12 from '../../data/forms/muster-12.json' with { type: 'json' };
import muster13 from '../../data/forms/muster-13.json' with { type: 'json' };
import muster15 from '../../data/forms/muster-15.json' with { type: 'json' };
import muster16 from '../../data/forms/muster-16.json' with { type: 'json' };
import muster19 from '../../data/forms/muster-19.json' with { type: 'json' };
import muster20 from '../../data/forms/muster-20.json' with { type: 'json' };
import muster21 from '../../data/forms/muster-21.json' with { type: 'json' };
import muster22 from '../../data/forms/muster-22.json' with { type: 'json' };
import muster25 from '../../data/forms/muster-25.json' with { type: 'json' };
import muster26 from '../../data/forms/muster-26.json' with { type: 'json' };
import muster27 from '../../data/forms/muster-27.json' with { type: 'json' };
import muster28 from '../../data/forms/muster-28.json' with { type: 'json' };
import muster36 from '../../data/forms/muster-36.json' with { type: 'json' };
import muster39 from '../../data/forms/muster-39.json' with { type: 'json' };
import muster50 from '../../data/forms/muster-50.json' with { type: 'json' };
import muster51 from '../../data/forms/muster-51.json' with { type: 'json' };
import muster52 from '../../data/forms/muster-52.json' with { type: 'json' };
import muster53 from '../../data/forms/muster-53.json' with { type: 'json' };
import muster55 from '../../data/forms/muster-55.json' with { type: 'json' };
import muster56 from '../../data/forms/muster-56.json' with { type: 'json' };
import muster61 from '../../data/forms/muster-61.json' with { type: 'json' };
import muster62a from '../../data/forms/muster-62a.json' with { type: 'json' };
import muster62b from '../../data/forms/muster-62b.json' with { type: 'json' };
import muster62c from '../../data/forms/muster-62c.json' with { type: 'json' };
import muster63 from '../../data/forms/muster-63.json' with { type: 'json' };
import muster64 from '../../data/forms/muster-64.json' with { type: 'json' };
import muster65 from '../../data/forms/muster-65.json' with { type: 'json' };
import muster70 from '../../data/forms/muster-70.json' with { type: 'json' };
import muster70a from '../../data/forms/muster-70a.json' with { type: 'json' };
import muster85 from '../../data/forms/muster-85.json' with { type: 'json' };
import muster86 from '../../data/forms/muster-86.json' with { type: 'json' };
import type { FormDefinition, FormField, FormId, FormRule } from './types.js';

export const FORMS: Readonly<Record<FormId, FormDefinition>> = {
  'muster-06': muster06 as unknown as FormDefinition,
  'muster-02': muster02 as unknown as FormDefinition,
  'muster-04': muster04 as unknown as FormDefinition,
  'muster-10': muster10 as unknown as FormDefinition,
  'muster-10a': muster10a as unknown as FormDefinition,
  'muster-13': muster13 as unknown as FormDefinition,
  'muster-12': muster12 as unknown as FormDefinition,
  'muster-61': muster61 as unknown as FormDefinition,
  'muster-21': muster21 as unknown as FormDefinition,
  'muster-20': muster20 as unknown as FormDefinition,
  'muster-55': muster55 as unknown as FormDefinition,
  'muster-19': muster19 as unknown as FormDefinition,
  'muster-52': muster52 as unknown as FormDefinition,
  'muster-63': muster63 as unknown as FormDefinition,
  'muster-09': muster09 as unknown as FormDefinition,
  'muster-26': muster26 as unknown as FormDefinition,
  'muster-27': muster27 as unknown as FormDefinition,
  'muster-64': muster64 as unknown as FormDefinition,
  'muster-65': muster65 as unknown as FormDefinition,
  'muster-03': muster03 as unknown as FormDefinition,
  'muster-05': muster05 as unknown as FormDefinition,
  'muster-07': muster07 as unknown as FormDefinition,
  'muster-08': muster08 as unknown as FormDefinition,
  'muster-08a': muster08a as unknown as FormDefinition,
  'muster-11': muster11 as unknown as FormDefinition,
  'muster-15': muster15 as unknown as FormDefinition,
  'muster-16': muster16 as unknown as FormDefinition,
  'muster-22': muster22 as unknown as FormDefinition,
  'muster-25': muster25 as unknown as FormDefinition,
  'muster-28': muster28 as unknown as FormDefinition,
  'muster-36': muster36 as unknown as FormDefinition,
  'muster-39': muster39 as unknown as FormDefinition,
  'muster-50': muster50 as unknown as FormDefinition,
  'muster-51': muster51 as unknown as FormDefinition,
  'muster-53': muster53 as unknown as FormDefinition,
  'muster-56': muster56 as unknown as FormDefinition,
  'muster-62a': muster62a as unknown as FormDefinition,
  'muster-62b': muster62b as unknown as FormDefinition,
  'muster-62c': muster62c as unknown as FormDefinition,
  'muster-70': muster70 as unknown as FormDefinition,
  'muster-70a': muster70a as unknown as FormDefinition,
  'muster-85': muster85 as unknown as FormDefinition,
  'muster-86': muster86 as unknown as FormDefinition,
};

export const FORM_IDS: readonly FormId[] = ['muster-06', 'muster-02', 'muster-04', 'muster-10', 'muster-10a', 'muster-13', 'muster-12', 'muster-61', 'muster-21', 'muster-20', 'muster-55', 'muster-19', 'muster-52', 'muster-63', 'muster-09', 'muster-26', 'muster-27', 'muster-64', 'muster-65',
  'muster-03', 'muster-05', 'muster-07', 'muster-08', 'muster-08a', 'muster-11', 'muster-15', 'muster-16', 'muster-22', 'muster-25', 'muster-28', 'muster-36', 'muster-39', 'muster-50', 'muster-51', 'muster-53', 'muster-56', 'muster-62a', 'muster-62b', 'muster-62c', 'muster-70', 'muster-70a', 'muster-85', 'muster-86'];

export function getForm(id: FormId): FormDefinition {
  return FORMS[id];
}

export function getField(form: FormDefinition, id: string): FormField {
  const f = form.fields.find((x) => x.id === id);
  if (!f) throw new Error(`${form.id}: Feld ${id} fehlt in den Formulardaten.`);
  return f;
}

/** Alle Regeln eines Vordrucks (allgemeine Hinweise, Ankreuzgruppen, Felder). */
export function allRules(form: FormDefinition): FormRule[] {
  return [...form.notes, ...form.groups.map((g) => g.rule), ...form.fields.flatMap((f) => f.rules)];
}

/** Regel nach Kennung; fehlt sie, ist das ein Programmierfehler (Tests prüfen alle verwendeten Kennungen). */
export function rule(form: FormDefinition, id: string): FormRule {
  const r = allRules(form).find((x) => x.id === id);
  if (!r) throw new Error(`${form.id}: Regel ${id} fehlt in den Formulardaten.`);
  return r;
}
