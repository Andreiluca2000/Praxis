// Vordrucke werden beim Bauen eingebunden; die Form prüft tests/forms-data.test.ts gegen das Schema.
import muster02 from '../../data/forms/muster-02.json' with { type: 'json' };
import muster04 from '../../data/forms/muster-04.json' with { type: 'json' };
import muster06 from '../../data/forms/muster-06.json' with { type: 'json' };
import muster09 from '../../data/forms/muster-09.json' with { type: 'json' };
import muster10 from '../../data/forms/muster-10.json' with { type: 'json' };
import muster10a from '../../data/forms/muster-10a.json' with { type: 'json' };
import muster12 from '../../data/forms/muster-12.json' with { type: 'json' };
import muster13 from '../../data/forms/muster-13.json' with { type: 'json' };
import muster19 from '../../data/forms/muster-19.json' with { type: 'json' };
import muster20 from '../../data/forms/muster-20.json' with { type: 'json' };
import muster21 from '../../data/forms/muster-21.json' with { type: 'json' };
import muster26 from '../../data/forms/muster-26.json' with { type: 'json' };
import muster27 from '../../data/forms/muster-27.json' with { type: 'json' };
import muster52 from '../../data/forms/muster-52.json' with { type: 'json' };
import muster55 from '../../data/forms/muster-55.json' with { type: 'json' };
import muster61 from '../../data/forms/muster-61.json' with { type: 'json' };
import muster63 from '../../data/forms/muster-63.json' with { type: 'json' };
import muster64 from '../../data/forms/muster-64.json' with { type: 'json' };
import muster65 from '../../data/forms/muster-65.json' with { type: 'json' };
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
};

export const FORM_IDS: readonly FormId[] = ['muster-06', 'muster-02', 'muster-04', 'muster-10', 'muster-10a', 'muster-13', 'muster-12', 'muster-61', 'muster-21', 'muster-20', 'muster-55', 'muster-19', 'muster-52', 'muster-63', 'muster-09', 'muster-26', 'muster-27', 'muster-64', 'muster-65'];

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
