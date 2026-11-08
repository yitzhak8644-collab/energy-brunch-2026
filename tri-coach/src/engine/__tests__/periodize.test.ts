import { describe, expect, it } from 'vitest';
import { periodize } from '../periodize';
import { weekday, diffDays } from '../../lib/dates';

describe('dates', () => {
  it('2026-11-08 הוא יום ראשון (6) ו-2027-04-09 הוא יום שישי (4)', () => {
    expect(weekday('2026-11-08')).toBe(6);
    expect(weekday('2027-04-09')).toBe(4);
  });
});

describe('periodize', () => {
  const sk = periodize('2026-11-08', '2027-04-09');
  const count = (p: string) => sk.filter((w) => w.phase === p).length;

  it('22 שבועות מ-9.11.2026, שבוע המרוץ מתחיל ב-5.4.2027', () => {
    expect(sk).toHaveLength(22);
    expect(sk[0].start).toBe('2026-11-09');
    expect(sk[21].start).toBe('2027-04-05');
  });
  it('חלוקה 9/8/3/2 ושבוע אחרון נחתך ביום המרוץ', () => {
    expect([count('base'), count('build'), count('peak'), count('taper')]).toEqual([9, 8, 3, 2]);
    expect(sk[21].end).toBe('2027-04-09');
    expect(sk[21].phase).toBe('taper');
  });
  it('סכום השלבים = שבועות עד המרוץ, בכל תאריך התחלה', () => {
    for (let d = 0; d < 200; d += 3) {
      const today = new Date(Date.UTC(2026, 10, 8 + d)).toISOString().slice(0, 10);
      const s = periodize(today, '2027-04-09');
      if (!s.length) continue;
      expect(s[s.length - 1].end).toBe('2027-04-09');
      expect(diffDays(s[s.length - 1].start, s[0].start)).toBe((s.length - 1) * 7);
      expect(s[s.length - 1].phase).toBe('taper');
    }
  });
  it('תאריך מרוץ שונה מחושב מחדש', () => {
    expect(periodize('2026-11-08', '2027-03-01').length).toBeLessThan(22);
    expect(periodize('2027-05-01', '2027-04-09')).toEqual([]);
  });
  it('שבוע התאוששות כל רביעי רק ב-Base/Build', () => {
    sk.filter((w) => w.isRecovery).forEach((w) => expect(['base', 'build']).toContain(w.phase));
    expect(sk[3].isRecovery).toBe(true);
  });
});
