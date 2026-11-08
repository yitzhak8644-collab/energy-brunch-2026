import type { Discipline, Phase, Weekday } from '../types';

export const WEEKDAYS: Record<Weekday, string> = { 0: 'שני', 1: 'שלישי', 2: 'רביעי', 3: 'חמישי', 4: 'שישי', 5: 'שבת', 6: 'ראשון' };
export const DISCIPLINE: Record<Discipline, string> = { swim: 'שחייה', bike: 'אופניים', run: 'ריצה', race: 'מרוץ', rest: 'מנוחה' };
export const DISC_COLOR: Record<Discipline, string> = { swim: 'bg-swim', bike: 'bg-bike', run: 'bg-run', race: 'bg-accent', rest: 'bg-line' };
export const DISC_TEXT: Record<Discipline, string> = { swim: 'text-swim', bike: 'text-bike', run: 'text-run', race: 'text-accent-ink', rest: 'text-muted' };
export const PHASE: Record<Phase, string> = { base: 'בסיס', build: 'בנייה', peak: 'שיא', taper: 'התקררות' };
export const PHASE_DESC: Record<Phase, string> = {
  base: 'בונים סיבולת אירובית וטכניקה',
  build: 'מוסיפים עצימות: סף, CSS וברייקים',
  peak: 'קצב מרוץ ונפח מקסימלי',
  taper: 'פחות נפח, אותה חדות — מגיעים רעננים',
};
export const PHASE_BAR: Record<Phase, string> = { base: 'bg-swim/70', build: 'bg-bike/80', peak: 'bg-run/80', taper: 'bg-accent' };
export const AREAS = ['ברך', 'שוק', 'אכילס', 'כף רגל', 'ירך', 'גב', 'כתף'];
export const DISCLAIMER = 'הנחיות כלליות בלבד ואינן ייעוץ רפואי. כאב מתמשך — עצור והיוועץ ברופא.';
