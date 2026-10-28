import type { CatalogHit } from './katalog.js';

/**
 * Datenmodell der Ausfüllhilfe für KBV-Vordrucke (schemas/forms-muster.schema.json).
 * Die App schlägt nur vor; ausfüllen, unterschreiben und abgeben bleibt beim Arzt bzw. der Praxis.
 */

export type SourceArtifact = 'erlaeuterungen' | 'vordruckvereinbarung' | 'mustersammlung';

export interface FormRule {
  id: string;
  text: string;
  source: { artifact: SourceArtifact; locator: string };
}

export type FieldKind = 'checkbox' | 'text' | 'date' | 'quarter' | 'letter' | 'number' | 'personalien' | 'stempel';
export type FilledBy = 'duria' | 'praxis' | 'arzt' | 'krankenhaus' | 'leistungserbringer' | 'versicherter' | 'arbeitgeber';

export interface Box { x: number; y: number; w: number; h: number }

export interface FormField {
  id: string;
  label: string;
  kind: FieldKind;
  filled_by: FilledBy;
  format?: 'QJJ' | 'TTMMJJ' | 'MMJJ' | 'hhmm';
  group?: string;
  marker?: string;
  lines?: number;
  label_pos?: 'rechts' | 'unten';
  /** Seite bei mehrseitigen Vordrucken (0 = erste). */
  page?: number;
  only_copies?: string[];
  box: Box;
  rules: FormRule[];
}

export interface FormGroup {
  id: string;
  label: string;
  select: 'genau_eins' | 'beliebig';
  rule: FormRule;
}

export interface FormDefinition {
  schema_version: '1.0.0';
  id: FormId;
  muster: string;
  title: string;
  form_version: string;
  released: string;
  status: 'entwurf' | 'geprueft';
  paper: { format: string; width: number; height: number; tint: 'gelb' | 'rot' | 'blau' | 'ohne' };
  /** Seitennamen bei mehrseitigen Vordrucken (z. B. Teil A–E). */
  pages?: string[];
  copies: { id: string; label: string; recipient: string }[];
  notes: FormRule[];
  groups: FormGroup[];
  fields: FormField[];
}

export type FormId = 'muster-06' | 'muster-02' | 'muster-04' | 'muster-10' | 'muster-10a' | 'muster-21' | 'muster-20' | 'muster-55' | 'muster-19' | 'muster-52' | 'muster-63' | 'muster-09' | 'muster-26' | 'muster-27' | 'muster-64' | 'muster-65' | 'muster-13' | 'muster-12' | 'muster-61';

/**
 * Zustand eines Feldes im Vorschlag:
 * - vorgeschlagen: aus der Beschreibung abgeleitet, Person bestätigt
 * - unbekannt: Angabe fehlt in der Beschreibung, bitte ergänzen
 * - arzt: nur der Arzt trägt ein bzw. bestätigt (z. B. Diagnose, Unterschrift)
 * - duria: kommt aus dem PVS/der eGK (Personalien sind in diesem Fenster nicht vorhanden)
 * - leer: bleibt nach der Beschreibung leer bzw. nicht angekreuzt
 */
export type FieldState = 'vorgeschlagen' | 'unbekannt' | 'arzt' | 'duria' | 'leer';

export interface FieldProposal {
  fieldId: string;
  state: FieldState;
  /** checkbox: true = ankreuzen; sonst einzutragender Text (null = nichts vorgeschlagen). */
  value: boolean | string | null;
  /** Warum so – in einfachen Worten. */
  reason: string;
  /** Wörtliche Stelle aus der Beschreibung, auf die sich der Vorschlag stützt. */
  evidence: string | null;
  /** Ausfüllregel mit Fundstelle. */
  rule: FormRule | null;
}

export type FieldValue = boolean | string | null;
export type FormValues = Readonly<Record<string, FieldValue>>;

export interface FormProposal {
  formId: FormId;
  fields: FieldProposal[];
  generator: 'regelbasiert';
}

/**
 * Ergebnis der Prüfung eines (vorgeschlagenen oder von Hand geänderten) Vordrucks:
 * - unzulaessig: so nicht möglich (Vordruck falsch oder widersprüchlich angekreuzt)
 * - fehlt: es fehlt eine Pflichtangabe oder ein Nachweis
 * - hinweis: bitte beachten, kein Fehler
 */
export type IssueLevel = 'unzulaessig' | 'fehlt' | 'hinweis';

export interface FormIssue {
  level: IssueLevel;
  text: string;
  fieldIds: string[];
  rule: FormRule | null;
}

/** Aus der Beschreibung erkannte Tatsachen über die Lage des Patienten (immer zu bestätigen). */
export interface Fact<T> {
  value: T;
  evidence: string;
}

export interface PatientFacts {
  pflegegrad: Fact<1 | 2 | 3 | 4 | 5> | null;
  merkzeichen: Fact<('aG' | 'Bl' | 'H' | 'G')[]> | null;
  /** Pflegegrad 3 mit dauerhafter Mobilitätsbeeinträchtigung bzw. früherer Pflegestufe 2 */
  mobilitaetDauerhaft: Fact<true> | null;
  ausstattung: Fact<('rollstuhl' | 'tragestuhl' | 'liegend')[]> | null;
  hochfrequent: Fact<'dialyse' | 'chemotherapie' | 'strahlentherapie'> | null;
  notfall: Fact<true> | null;
  unfall: Fact<true> | null;
  arbeitsunfall: Fact<true> | null;
  /** Wegeunfall: ob Arbeitsunfall, klärt die Unfallversicherung – nur Hinweis */
  wegeunfall: Fact<true> | null;
  versorgungsleiden: Fact<true> | null;
  zuzahlungsbefreit: Fact<true> | null;
  eingeschraenkterAnspruch: Fact<true> | null;
  reha: Fact<true> | null;
  nurPflege: Fact<true> | null;
  kosmetisch: Fact<true> | null;
  dringend: Fact<true> | null;
  /** Fahrt ohne zwingenden medizinischen Grund oder zu einer Pflegeversicherungsleistung (Muster 4) */
  fahrtOhneGrund: Fact<true> | null;
  auBis: Fact<string | null> | null;
  /** Alter des erkrankten Kindes in Jahren (Muster 21) */
  kindAlter: Fact<number> | null;
  /** Kind mit Behinderung, auf Hilfe angewiesen (Muster 21 auch nach dem 12. Lebensjahr) */
  kindBehindert: Fact<true> | null;
  /** Mitaufnahme als Begleitperson bei stationärer Behandlung des Kindes (kein Muster 21) */
  mitaufnahme: Fact<true> | null;
  /** Unfall in Kita oder Schule bzw. auf dem Weg dorthin (Muster 21: Unfallversicherungsträger) */
  kitaUnfall: Fact<true> | null;
  /** Schwangerschaftswoche (vollendete Wochen, z. B. „18+3 SSW“ → 18) */
  ssw: Fact<number> | null;
  /** Mehrlingsgeburt (Muster 9 nicht auszustellen) */
  mehrlinge: Fact<true> | null;
}

export type Intent = 'ueberweisung' | 'einweisung' | 'befoerderung' | 'labor' | 'heilmittel' | 'hkp' | 'reha' | 'kinderkrank' | 'wiedereingliederung' | 'chroniker' | 'notfallschein' | 'au_bericht' | 'sapv' | 'mutterschaft' | 'soziotherapie' | 'betreuungsplan' | 'mutter_vater_vorsorge' | 'attest_kind';

export interface FormSuggestion {
  formId: FormId;
  /** hauptsache = ausdrücklich gewünscht; zusaetzlich = passt zur Lage, z. B. Fahrt zur Überweisung */
  role: 'hauptsache' | 'zusaetzlich' | 'alternativ';
  title: string;
  why: string;
  evidence: string | null;
  rule: FormRule | null;
}

export interface Analysis {
  facts: PatientFacts;
  suggestions: FormSuggestion[];
  /** Grundsätzliche Hindernisse unabhängig vom Vordruck (z. B. Arbeitsunfall). */
  blockers: FormIssue[];
  /** Weitere Vordrucke aus dem Gesamtkatalog, deren Stichwörter passen (nur Regeln, keine Vorschau). */
  catalog: CatalogHit[];
}
