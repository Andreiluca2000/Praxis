import { Bell, ClipboardCheck, Combine, EyeOff, ShieldCheck } from 'lucide-react';
import { TYPE_LABEL, type PracticeRuleType } from '../../src/rules/model.js';

export const TYPE_ICON: Record<PracticeRuleType, typeof Bell> = { erinnerung: Bell, pflicht: ClipboardCheck, kombination: Combine, zurueck: EyeOff };
export const TYPE_HINT: Record<PracticeRuleType, string> = {
  erinnerung: 'Text beim Vorschlag oder bei „Fertig“',
  pflicht: 'Angabe fehlt → „Klärung nötig“',
  kombination: 'zusätzlicher Hinweis bei zwei Ziffern',
  zurueck: 'Vorschlag nie „bereit“, nur Hinweis',
};

export function TypePill({ t, label }: { t: PracticeRuleType; label?: string }) {
  const Icon = TYPE_ICON[t];
  return <span className={`pill rule-type ${t}`}><Icon size={13} aria-hidden="true" />{label ?? TYPE_LABEL[t]}</span>;
}

/** Grundsatz der Praxisregeln – auf Liste und Editor sichtbar. */
export function Guard() {
  return (
    <div className="guard">
      <ShieldCheck size={20} aria-hidden="true" />
      <div>
        <strong>Praxisregeln machen nur strenger – nie lockerer.</strong>
        <span>Sie erinnern, verlangen Angaben oder halten Vorschläge zurück. Einen Ausschluss aus EBM/GOÄ heben sie nicht auf, eine Höchstzahl erhöhen sie nicht.</span>
      </div>
    </div>
  );
}

export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
