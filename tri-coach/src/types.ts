export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = יום שני … 6 = יום ראשון
export type Discipline = 'swim' | 'bike' | 'run' | 'race' | 'rest';
export type Phase = 'base' | 'build' | 'peak' | 'taper';
export type Intensity = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'mixed';
export type Experience = 'new' | 'some' | 'experienced';
export const DEFAULT_USER = 'me';

export interface Injury {
  area: string;
  severity: 0 | 1 | 2 | 3;
  active: boolean;
}

export interface Profile {
  userId: string;
  raceDate: string; // YYYY-MM-DD
  swimPace1k: number; // שניות ל-100 מ׳
  poolLength: 25 | 50;
  bikeLongestKm: number;
  bikeAvgKmh: number;
  run5kSec?: number;
  run10kSec?: number;
  maxHr?: number;
  currentWeeklyHours?: number;
  weeklyHours: number;
  availableDays: Record<Weekday, { minutes: number }>;
  longDay: Weekday;
  injuries: Injury[];
  experience: Experience;
  source: 'manual' | 'fit-import';
}

export interface Zones {
  cssPer100: number; // שנ׳/100מ׳
  runThreshPace: number; // שנ׳/ק״מ
  runEasyPace: number;
  runRacePace: number;
  bikeEasyKmh: number;
  bikeTempoKmh: number;
  bikeRaceKmh: number;
  hrZones?: [number, number][]; // Z1..Z5 בפעימות לדקה
}

// יעדי קצב: swim = שנ׳/100מ׳, run = שנ׳/ק״מ (low = מהיר יותר); hr = פעימות; bike = קמ״ש
export interface StepTarget {
  type: 'pace' | 'hr' | 'rpe' | 'open';
  low?: number;
  high?: number;
}
export interface WorkoutStep {
  kind: 'warmup' | 'work' | 'recover' | 'cooldown' | 'repeat';
  label?: string;
  durationSec?: number;
  distanceM?: number;
  target?: StepTarget;
  speedKmh?: number; // הערכה לאופניים, לחישוב מרחק
  repeat?: number;
  children?: WorkoutStep[];
}

export interface Session {
  id: string;
  userId: string;
  date: string;
  discipline: Discipline;
  title: string;
  targetMin: number;
  targetKm?: number;
  intensity: Intensity;
  plannedRpe: number;
  hard: boolean;
  brick?: boolean;
  steps: WorkoutStep[];
}

export interface Week {
  userId: string;
  index: number;
  start: string; // יום שני
  end: string; // יום ראשון, או יום המרוץ בשבוע האחרון
  phase: Phase;
  isRecovery: boolean;
  baseTargetMin: number;
  adjust: number; // מכפיל שנקבע ע״י ההתאמה
  targetMin: number;
  sessions: Session[];
}

export interface Log {
  id: string;
  userId: string;
  sessionId: string;
  completed: boolean;
  actualMin?: number;
  actualKm?: number;
  avgHr?: number;
  rpe?: number;
  pain?: { area: string; level: 0 | 1 | 2 | 3 };
  source: 'manual' | 'fit' | 'intervals';
  activityId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdaptNote {
  id: string;
  userId: string;
  date: string;
  weekIndex: number;
  key: string;
  text: string;
  pain?: { area: string; level: 2 | 3; from: string; until: string; restUntil?: string };
}

export interface DailyMetrics {
  date: string;
  restingHr?: number;
  hrv?: number;
  sleepHours?: number;
  readiness?: number;
}

export interface SyncReport {
  at: string;
  pulled: { activities: number; autoLogged: number; metrics: number };
  pushed: { created: number; updated: number; deleted: number; unchanged: number };
  errors: string[];
  pushErrors: { name: string; date: string; message: string }[];
}

export interface IntervalsSettings {
  athleteId: string;
  apiKey: string; // נשמר מקומית בלבד (IndexedDB) ואינו נכלל בייצוא JSON
  known: Record<string, string>; // external_id → hash של מה שנדחף
  lastSyncAt?: string;
  lastReport?: SyncReport;
  error?: string;
  /** external_id לא חוזר מ-Intervals: כל דחיפה נחסמת עד ניתוק וחיבור מחדש (למניעת כפילויות) */
  idLost?: boolean;
}

export interface Settings {
  autoSync: boolean;
  intervals?: IntervalsSettings;
}

export interface PlanState {
  userId: string;
  profile?: Profile;
  zones?: Zones;
  weeks: Week[];
  logs: Record<string, Log>; // לפי sessionId
  adaptNotes: AdaptNote[];
  metrics: Record<string, DailyMetrics>; // לפי תאריך
  settings: Settings;
}
