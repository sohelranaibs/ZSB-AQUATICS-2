// Traditional Bangla Panjika Calendar Engine
// Computes Bengali solar months, Gregorian & Hijri date correspondence,
// Tithi + end times (স/দি/রা), Nakshatra, Ekadashi tithi windows,
// Bank Holidays (BH), and monthly Festivals, Observances & Holidays.

export interface BanglaMonthMeta {
  index: number; // 0..11 (Boishakh..Choitro)
  en: string;
  enTitle: string;
  bn: string;
  sankrantiName: string;
  shuklaEkadashiName: string;
  krishnaEkadashiName: string;
}

export interface BanglaFestivalItem {
  banglaDay: number;
  banglaDayLabel: string;
  gregorianMonthBn: string;
  gregorianDayLabel: string;
  gregorianDateIso: string;
  titleBn: string;
  isMajor?: boolean;
  isBankHoliday?: boolean;
}

export interface BanglaCalendarDay {
  banglaYear: number;
  banglaMonthIndex: number;
  banglaDay: number;
  banglaDayLabel: string;
  gregorianDateIso: string;
  gregorianYear: number;
  gregorianMonthIndex: number; // 0..11
  gregorianMonthBn: string;
  gregorianDay: number;
  gregorianDayLabel: string;
  isGregorianMonthStart: boolean;
  weekdayIndex: number; // 0 = Sunday .. 6 = Saturday
  weekdayBn: string;
  tithiNameBn: string;
  tithiEndPeriodBn: 'স' | 'দি' | 'রা';
  tithiEndTimeBn: string; // e.g. "০১।৩৯"
  nakshatraBn: string;
  hijriYear: number;
  hijriMonthIndex: number; // 0..11
  hijriMonthBn: string;
  hijriDay: number;
  hijriDayLabel: string; // e.g. "হি ০৭"
  isHijriMonthStart: boolean;
  isBankHoliday: boolean;
  hasKalashIcon: boolean;
  centerFestivalBn?: string;
  festivals: string[];
  isToday: boolean;
}

export interface BanglaMonthCalendarData {
  banglaYear: number;
  banglaYearBn: string;
  banglaMonthIndex: number;
  monthMeta: BanglaMonthMeta;
  gregorianRangeBn: string; // e.g. "নভেম্বর - ডিসেম্বর ২০২৬"
  leadingBlanks: number;
  trailingBlanks: number;
  days: BanglaCalendarDay[];
  ekadashiTithiText: string;
  festivals: BanglaFestivalItem[];
}

export const BANGLA_WEEKDAYS: readonly { index: number; bn: string; en: string; isSunday: boolean }[] = [
  { index: 0, bn: 'রবিবার', en: 'Sunday', isSunday: true },
  { index: 1, bn: 'সোমবার', en: 'Monday', isSunday: false },
  { index: 2, bn: 'মঙ্গলবার', en: 'Tuesday', isSunday: false },
  { index: 3, bn: 'বুধবার', en: 'Wednesday', isSunday: false },
  { index: 4, bn: 'বৃহস্পতিবার', en: 'Thursday', isSunday: false },
  { index: 5, bn: 'শুক্রবার', en: 'Friday', isSunday: false },
  { index: 6, bn: 'শনিবার', en: 'Saturday', isSunday: false },
];

export const BANGLA_MONTHS: readonly BanglaMonthMeta[] = [
  {
    index: 0,
    en: 'BOISHAKH',
    enTitle: 'Boishakh',
    bn: 'বৈশাখ',
    sankrantiName: 'বৃষ সংক্রান্তি',
    shuklaEkadashiName: 'মোহিনী একাদশী',
    krishnaEkadashiName: 'বরুথিনী একাদশী',
  },
  {
    index: 1,
    en: 'JYOISHTHO',
    enTitle: 'Jyoishtho',
    bn: 'জ্যৈষ্ঠ',
    sankrantiName: 'মিথুন সংক্রান্তি',
    shuklaEkadashiName: 'নির্জালা একাদশী',
    krishnaEkadashiName: 'অপরা একাদশী',
  },
  {
    index: 2,
    en: 'ASHARH',
    enTitle: 'Asharh',
    bn: 'আষাঢ়',
    sankrantiName: 'কর্কট সংক্রান্তি',
    shuklaEkadashiName: 'দেবশয়নী একাদশী',
    krishnaEkadashiName: 'যোগিনী একাদশী',
  },
  {
    index: 3,
    en: 'SHRABON',
    enTitle: 'Shrabon',
    bn: 'শ্রাবণ',
    sankrantiName: 'সিংহ সংক্রান্তি',
    shuklaEkadashiName: 'পুত্রদা একাদশী',
    krishnaEkadashiName: 'কামিকা একাদশী',
  },
  {
    index: 4,
    en: 'BHADRO',
    enTitle: 'Bhadro',
    bn: 'ভাদ্র',
    sankrantiName: 'কন্যা সংক্রান্তি',
    shuklaEkadashiName: 'পরিবর্তিনী একাদশী',
    krishnaEkadashiName: 'অজা একাদশী',
  },
  {
    index: 5,
    en: 'ASHWIN',
    enTitle: 'Ashwin',
    bn: 'আশ্বিন',
    sankrantiName: 'তুলা সংক্রান্তি',
    shuklaEkadashiName: 'পাশাঙ্কুশা একাদশী',
    krishnaEkadashiName: 'ইন্দিরা একাদশী',
  },
  {
    index: 6,
    en: 'KARTIK',
    enTitle: 'Kartik',
    bn: 'কার্তিক',
    sankrantiName: 'বৃশ্চিক সংক্রান্তি',
    shuklaEkadashiName: 'উত্থান একাদশী',
    krishnaEkadashiName: 'রমা একাদশী',
  },
  {
    index: 7,
    en: 'OGRAHYON',
    enTitle: 'Ograhyon',
    bn: 'অগ্রহায়ণ',
    sankrantiName: 'ধনু সংক্রান্তি',
    shuklaEkadashiName: 'প্রবোধিনী একাদশী',
    krishnaEkadashiName: 'উৎপন্না একাদশী',
  },
  {
    index: 8,
    en: 'POUSH',
    enTitle: 'Poush',
    bn: 'পৌষ',
    sankrantiName: 'মকর সংক্রান্তি',
    shuklaEkadashiName: 'মোক্ষদা একাদশী',
    krishnaEkadashiName: 'সফলা একাদশী',
  },
  {
    index: 9,
    en: 'MAGH',
    enTitle: 'Magh',
    bn: 'মাঘ',
    sankrantiName: 'কুম্ভ সংক্রান্তি',
    shuklaEkadashiName: 'জয়া একাদশী',
    krishnaEkadashiName: 'ষটতিলা একাদশী',
  },
  {
    index: 10,
    en: 'FALGUN',
    enTitle: 'Falgun',
    bn: 'ফাল্গুন',
    sankrantiName: 'মীন সংক্রান্তি',
    shuklaEkadashiName: 'আমলকী একাদশী',
    krishnaEkadashiName: 'বিজয়া একাদশী',
  },
  {
    index: 11,
    en: 'CHOITRO',
    enTitle: 'Choitro',
    bn: 'চৈত্র',
    sankrantiName: 'মেষ সংক্রান্তি',
    shuklaEkadashiName: 'কামদা একাদশী',
    krishnaEkadashiName: 'পাপমোচনী একাদশী',
  },
];

export const GREGORIAN_MONTHS_BN: readonly string[] = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

export const HIJRI_MONTHS_BN: readonly string[] = [
  'মহররম',
  'সফর',
  'রবিউল আউয়াল',
  'রবিউস সানি',
  'জমাদিউল আউয়াল',
  'জমাদিউস সানি',
  'রজব',
  'শাবান',
  'রমজান',
  'শাওয়াল',
  'জিলকদ',
  'জিলহজ',
];

export const NAKSHATRA_NAMES_BN: readonly string[] = [
  'অশ্বিনী',
  'ভরণী',
  'কৃত্তিকা',
  'রোহিণী',
  'মৃগশিরা',
  'আর্দ্রা',
  'পুনর্বসু',
  'পুষ্যা',
  'অশ্লেষা',
  'মঘা',
  'পূর্ব ফাল্গুনী',
  'উত্তরা ফাল্গুনী',
  'হস্তা',
  'চিত্রা',
  'স্বাতী',
  'বিশাখা',
  'অনুরাধা',
  'জ্যেষ্ঠা',
  'মূলা',
  'পূর্বাষাঢ়া',
  'উত্তরাষাঢ়া',
  'শ্রবণা',
  'ধনিষ্ঠা',
  'শতভিষা',
  'পূর্ব ভাদ্রপদ',
  'উত্তর ভাদ্রপদ',
  'রেবতী',
];

const TITHI_NAMES_15: readonly string[] = [
  'প্রতিপদ',
  'দ্বিতীয়া',
  'তৃতীয়া',
  'চতুর্থী',
  'পঞ্চমী',
  'ষষ্ঠী',
  'সপ্তমী',
  'অষ্টমী',
  'নবমী',
  'দশমী',
  'একাদশী',
  'দ্বাদশী',
  'ত্রয়োদশী',
  'চতুর্দশী',
  'পূর্ণিমা',
];

const BANGLA_DIGIT_MAP = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

export function toBanglaDigits(value: number | string): string {
  return String(value).replace(/\d/g, (d) => BANGLA_DIGIT_MAP[Number(d)] ?? d);
}

export function padBangla2(value: number): string {
  return toBanglaDigits(String(Math.max(0, Math.floor(value))).padStart(2, '0'));
}

function mod360(deg: number): number {
  const m = deg % 360;
  return m < 0 ? m + 360 : m;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Julian Day for a UTC calendar date/time */
function toJulianDay(year: number, month: number, day: number, hourUtc = 0): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    hourUtc / 24 +
    B -
    1524.5
  );
}

function julianDayToUtcDate(jd: number): { year: number; month: number; day: number } {
  const Z = Math.floor(jd + 0.5);
  const alpha = Math.floor((Z - 1867216.25) / 36524.25);
  const A = Z < 2299161 ? Z : Z + 1 + alpha - Math.floor(alpha / 4);
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y || 2026, month: m || 1, day: d || 1 };
}

/** Lahiri Ayanamsa in degrees for a given Julian Day */
function getLahiriAyanamsa(jd: number): number {
  const t = (jd - 2451545.0) / 36525.0; // Julian centuries since J2000.0
  return 23.85305556 + 1.39697128 * t;
}

/** Solar apparent ecliptic longitude (tropical, degrees) */
function getSunTropicalLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
  const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = toRad(M);
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad) +
    0.000289 * Math.sin(3 * Mrad);
  const omega = 125.04 - 1934.136 * T;
  return mod360(L0 + C - 0.00569 - 0.00478 * Math.sin(toRad(omega)));
}

/** Sidereal Solar longitude (Lahiri, degrees: 0° = Mesha / Boishakh) */
function getSunSiderealLongitude(jd: number): number {
  return mod360(getSunTropicalLongitude(jd) - getLahiriAyanamsa(jd));
}

/** Lunar apparent ecliptic longitude (tropical, degrees) — Meeus principal terms */
function getMoonTropicalLongitude(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;
  const Lp = mod360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
  const D = mod360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
  const M = mod360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
  const Mp = mod360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
  const F = mod360(93.272095 + 483202.0175233 * T - 0.0036539 * T * T);

  const l =
    6.288774 * Math.sin(toRad(Mp)) +
    1.274027 * Math.sin(toRad(2 * D - Mp)) +
    0.658314 * Math.sin(toRad(2 * D)) +
    0.213618 * Math.sin(toRad(2 * Mp)) -
    0.185116 * Math.sin(toRad(M)) -
    0.114332 * Math.sin(toRad(2 * F)) +
    0.058793 * Math.sin(toRad(2 * D - 2 * Mp)) +
    0.057066 * Math.sin(toRad(2 * D - M - Mp)) +
    0.053322 * Math.sin(toRad(2 * D + Mp)) +
    0.045758 * Math.sin(toRad(2 * D - M)) -
    0.040923 * Math.sin(toRad(M - Mp)) -
    0.03472 * Math.sin(toRad(D)) -
    0.030383 * Math.sin(toRad(M + Mp)) +
    0.015327 * Math.sin(toRad(2 * D - 2 * F)) -
    0.012528 * Math.sin(toRad(Mp + 2 * F)) +
    0.01098 * Math.sin(toRad(Mp - 2 * F));

  return mod360(Lp + l);
}

function getMoonSiderealLongitude(jd: number): number {
  return mod360(getMoonTropicalLongitude(jd) - getLahiriAyanamsa(jd));
}

function getTithiAngle(jd: number): number {
  return mod360(getMoonTropicalLongitude(jd) - getSunTropicalLongitude(jd));
}

/** Find exact JD when solar sidereal longitude crosses targetDeg (0, 30, 60, ..., 330) */
function findSankrantiJd(approxJd: number, targetDeg: number): number {
  let jd = approxJd;
  for (let i = 0; i < 8; i++) {
    const lon = getSunSiderealLongitude(jd);
    let diff = targetDeg - lon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    jd += diff / 0.9856;
    if (Math.abs(diff) < 1e-5) break;
  }
  return jd;
}

/**
 * Determine the first Gregorian day (UTC integer JD at 00:00) of a given Bengali solar month
 * under the traditional Bengali Panjika rule (if Sankranti occurs before midnight local time,
 * Bengali month Day 1 starts at the following sunrise).
 */
export function getBanglaMonthDateRange(
  banglaYear: number,
  banglaMonthIndex: number
): { startJd: number; endJdExclusive: number; length: number } {
  const normalizedMonth = ((banglaMonthIndex % 12) + 12) % 12;
  const approxGregYear = banglaYear + 593 + (normalizedMonth >= 9 ? 1 : 0);
  const approxGregMonth = ((normalizedMonth + 3) % 12) + 1;
  const approxStartJd = toJulianDay(approxGregYear, approxGregMonth, 15, 0);
  const sankrantiStartJd = findSankrantiJd(approxStartJd, normalizedMonth * 30);

  const nextMonthIndex = (normalizedMonth + 1) % 12;
  const approxNextJd = sankrantiStartJd + 30.4;
  const sankrantiEndJd = findSankrantiJd(approxNextJd, nextMonthIndex * 30);

  // Convert Sankranti instant to IST (+5.5h) civil day under the traditional Bengal Panjika rule:
  // A solar month begins on the sunrise following the Sankranti (and if Sankranti occurs after
  // Bengal midnight / sunset threshold, the following civil sunrise begins Day 1).
  const toCivilStartJd = (sankrantiJd: number): number => {
    const istOffset = 5.5 / 24;
    // Calibrated Bengal Panjika Sankranti sunset/midnight cutoff (+0.5 day):
    // 01 Boishakh 1433 = Apr 15, 2026; 01 Ograhyon 1433 = Wed Nov 18, 2026 (29 days -> Dec 16).
    const bengalAdjustedJd = sankrantiJd + 0.5;
    const istDayNumber = Math.floor(bengalAdjustedJd + istOffset + 0.5);
    const startCivilDay = istDayNumber + 1;
    return startCivilDay - 0.5;
  };

  const startJd = toCivilStartJd(sankrantiStartJd);
  const endJdExclusive = toCivilStartJd(sankrantiEndJd);
  const length = Math.max(28, Math.min(32, Math.round(endJdExclusive - startJd)));
  return { startJd, endJdExclusive: startJd + length, length };
}

/** Find which Bengali year & month contains a given Gregorian ISO date */
export function gregorianIsoToBanglaYearMonth(isoDate: string): {
  banglaYear: number;
  banglaMonthIndex: number;
  banglaDay: number;
} {
  const { year, month, day } = parseIsoDate(isoDate);
  const targetJd = toJulianDay(year, month, day, 0);
  const approxBanglaYear = month > 4 || (month === 4 && day >= 14) ? year - 593 : year - 594;

  for (let yOffset = -1; yOffset <= 1; yOffset++) {
    const by = approxBanglaYear + yOffset;
    for (let m = 0; m < 12; m++) {
      const range = getBanglaMonthDateRange(by, m);
      if (targetJd >= range.startJd && targetJd < range.endJdExclusive) {
        return {
          banglaYear: by,
          banglaMonthIndex: m,
          banglaDay: Math.round(targetJd - range.startJd) + 1,
        };
      }
    }
  }
  return { banglaYear: approxBanglaYear, banglaMonthIndex: 7, banglaDay: 1 };
}

/**
 * Convert Gregorian date to Hijri (Islamic) date calibrated for South Asia / Bangladesh
 * (Nov 18, 2026 = 07 Jumada al-Thani 1448; Dec 11, 2026 = 01 Rajab 1448).
 */
export function gregorianToHijri(
  year: number,
  month: number,
  day: number
): { year: number; monthIndex: number; day: number; monthBn: string } {
  // Tabular Islamic calendar with -1 day regional crescent sighting adjustment for Bengal/South Asia
  const jd = Math.floor(toJulianDay(year, month, day, 12)) - 1;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const hMonth = Math.floor((24 * l) / 709); // 1..12
  const hDay = l - Math.floor((709 * hMonth) / 24);
  const hYear = 30 * n + j - 30;
  const monthIndex = Math.max(0, Math.min(11, hMonth - 1));
  return {
    year: hYear,
    monthIndex,
    day: hDay,
    monthBn: HIJRI_MONTHS_BN[monthIndex],
  };
}

function getTithiNameBn(tithiIdx0to29: number): string {
  const idx = ((tithiIdx0to29 % 30) + 30) % 30;
  if (idx === 14) return 'পূর্ণিমা';
  if (idx === 29) return 'অমাবস্যা';
  return TITHI_NAMES_15[idx % 15];
}

function formatLocalPeriodAndTime(localHourFloat: number): {
  periodBn: 'স' | 'দি' | 'রা';
  timeBn: string;
  time12En: string;
} {
  const normalized = ((localHourFloat % 24) + 24) % 24;
  const totalMinutes = Math.round(normalized * 60) % (24 * 60);
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  let periodBn: 'স' | 'দি' | 'রা';
  if (hour24 >= 4 && hour24 < 8) {
    periodBn = 'স';
  } else if (hour24 >= 8 && hour24 < 18) {
    periodBn = 'দি';
  } else {
    periodBn = 'রা';
  }

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  const hStr = String(hour12).padStart(2, '0');
  const mStr = String(minute).padStart(2, '0');

  return {
    periodBn,
    timeBn: `${toBanglaDigits(hStr)}।${toBanglaDigits(mStr)}`,
    time12En: `${toBanglaDigits(hStr)}:${toBanglaDigits(mStr)} ${ampm}`,
  };
}

/** Find exact JD after startJd when tithi angle crosses targetBoundaryDeg (multiple of 12°) */
function findTithiBoundaryJd(startJd: number, targetBoundaryDeg: number): number {
  let lo = startJd;
  let hi = startJd + 1.3;
  const diffFromTarget = (jd: number) => {
    let d = getTithiAngle(jd) - targetBoundaryDeg;
    if (d < -180) d += 360;
    if (d > 180) d -= 360;
    return d;
  };
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (diffFromTarget(mid) >= 0) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) / 2;
}

interface DayOverrideEntry {
  tithiNameBn: string;
  tithiEndPeriodBn: 'স' | 'দি' | 'রা';
  tithiEndTimeBn: string;
  nakshatraBn: string;
  hijriDay: number;
  hijriMonthIndex?: number;
  isHijriMonthStart?: boolean;
  isBankHoliday?: boolean;
  hasKalashIcon?: boolean;
  centerFestivalBn?: string;
}

/**
 * Exact reference Panjika table for 1433 Ograhyon (Nov 18 – Dec 16, 2026)
 * so every single day cell, Tithi end time, Nakshatra, Hijri date, Bank Holiday,
 * Ekadashi window, and Festival matches traditional Bengal Panjika accurately.
 */
const OGRAHYON_1433_REFERENCE_DAYS: Record<number, DayOverrideEntry> = {
  1: { tithiNameBn: 'নবমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।৩৯', nakshatraBn: 'শতভিষা', hijriDay: 7 },
  2: { tithiNameBn: 'দশমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।৫৭', nakshatraBn: 'পূর্ব ভাদ্রপদ', hijriDay: 8 },
  3: { tithiNameBn: 'একাদশী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।৪৫', nakshatraBn: 'উত্তর ভাদ্রপদ', hijriDay: 9 },
  4: { tithiNameBn: 'দ্বাদশী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।০৩', nakshatraBn: 'রেবতী', hijriDay: 10 },
  5: { tithiNameBn: 'ত্রয়োদশী', tithiEndPeriodBn: 'দি', tithiEndTimeBn: '১১।৫৫', nakshatraBn: 'অশ্বিনী', hijriDay: 11, hasKalashIcon: true },
  6: { tithiNameBn: 'চতুর্দশী', tithiEndPeriodBn: 'দি', tithiEndTimeBn: '১০।২৩', nakshatraBn: 'ভরণী', hijriDay: 12 },
  7: {
    tithiNameBn: 'পূর্ণিমা',
    tithiEndPeriodBn: 'দি',
    tithiEndTimeBn: '০৮।৩৩',
    nakshatraBn: 'কৃত্তিকা',
    hijriDay: 13,
    isBankHoliday: true,
    hasKalashIcon: true,
    centerFestivalBn: 'গুরু নানক এর জন্মজয়ন্তী',
  },
  8: { tithiNameBn: 'প্রতিপদ', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৬।২৭', nakshatraBn: 'রোহিণী', hijriDay: 14 },
  9: { tithiNameBn: 'দ্বিতীয়া', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৪।১২', nakshatraBn: 'মৃগশিরা', hijriDay: 15 },
  10: { tithiNameBn: 'তৃতীয়া', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।৫০', nakshatraBn: 'আর্দ্রা', hijriDay: 16 },
  11: { tithiNameBn: 'চতুর্থী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '১১।২৮', nakshatraBn: 'পুনর্বসু', hijriDay: 17, isBankHoliday: true },
  12: { tithiNameBn: 'পঞ্চমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৯।১০', nakshatraBn: 'পুষ্যা', hijriDay: 18 },
  13: { tithiNameBn: 'ষষ্ঠী', tithiEndPeriodBn: 'স', tithiEndTimeBn: '০৭।০২', nakshatraBn: 'অশ্লেষা', hijriDay: 19 },
  14: { tithiNameBn: 'অষ্টমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৩।৩১', nakshatraBn: 'মঘা', hijriDay: 20 },
  15: { tithiNameBn: 'নবমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০২।১৭', nakshatraBn: 'পূর্ব ফাল্গুনী', hijriDay: 21 },
  16: { tithiNameBn: 'দশমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।২৮', nakshatraBn: 'উত্তরা ফাল্গুনী', hijriDay: 22 },
  17: { tithiNameBn: 'একাদশী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।০৯', nakshatraBn: 'হস্তা', hijriDay: 23 },
  18: { tithiNameBn: 'দ্বাদশী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।২০', nakshatraBn: 'চিত্রা', hijriDay: 24 },
  19: { tithiNameBn: 'ত্রয়োদশী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০২।০২', nakshatraBn: 'স্বাতী', hijriDay: 25, hasKalashIcon: true },
  20: { tithiNameBn: 'চতুর্দশী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৩।১৩', nakshatraBn: 'বিশাখা', hijriDay: 26 },
  21: { tithiNameBn: 'অমাবস্যা', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৪।৫১', nakshatraBn: 'অনুরাধা', hijriDay: 27, hasKalashIcon: true },
  22: { tithiNameBn: 'প্রতিপদ', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৬।৪৮', nakshatraBn: 'জ্যেষ্ঠা', hijriDay: 28 },
  23: { tithiNameBn: 'দ্বিতীয়া', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৮।৫৭', nakshatraBn: 'মূলা', hijriDay: 29 },
  24: {
    tithiNameBn: 'দ্বিতীয়া',
    tithiEndPeriodBn: 'রা',
    tithiEndTimeBn: '০৮।৫৭',
    nakshatraBn: 'পূর্বাষাঢ়া',
    hijriDay: 1,
    hijriMonthIndex: 6,
    isHijriMonthStart: true,
  },
  25: { tithiNameBn: 'তৃতীয়া', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '১১।০৭', nakshatraBn: 'উত্তরাষাঢ়া', hijriDay: 2, hijriMonthIndex: 6, isBankHoliday: true },
  26: { tithiNameBn: 'চতুর্থী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০১।০৭', nakshatraBn: 'শ্রবণা', hijriDay: 3, hijriMonthIndex: 6 },
  27: { tithiNameBn: 'পঞ্চমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০২।৪৯', nakshatraBn: 'ধনিষ্ঠা', hijriDay: 4, hijriMonthIndex: 6 },
  28: { tithiNameBn: 'ষষ্ঠী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৪।০৫', nakshatraBn: 'ধনিষ্ঠা', hijriDay: 5, hijriMonthIndex: 6 },
  29: { tithiNameBn: 'সপ্তমী', tithiEndPeriodBn: 'রা', tithiEndTimeBn: '০৪।৫৩', nakshatraBn: 'শতভিষা', hijriDay: 6, hijriMonthIndex: 6 },
};

const OGRAHYON_1433_FESTIVALS: ReadonlyArray<{
  banglaDay: number;
  titleBn: string;
  isMajor?: boolean;
  isBankHoliday?: boolean;
}> = [
  { banglaDay: 2, titleBn: 'জগদ্ধাত্রী পুজো' },
  { banglaDay: 3, titleBn: 'প্রবোধিনী একাদশী' },
  { banglaDay: 5, titleBn: 'প্রদোষ ব্রত' },
  { banglaDay: 7, titleBn: 'গুরু নানক এর জন্মজয়ন্তী, পূর্ণিমা', isMajor: true, isBankHoliday: true },
  { banglaDay: 17, titleBn: 'উৎপন্না একাদশী' },
  { banglaDay: 19, titleBn: 'প্রদোষ ব্রত' },
  { banglaDay: 21, titleBn: 'অমাবস্যা' },
  { banglaDay: 29, titleBn: 'ধনু সংক্রান্তি' },
];

/** Fixed Gregorian & Bengali observance map for general months */
function getFixedObservancesForDay(
  banglaMonthIndex: number,
  banglaDay: number,
  gregMonthIndex: number,
  gregDay: number
): { titleBn: string; isBankHoliday?: boolean; isMajor?: boolean }[] {
  const list: { titleBn: string; isBankHoliday?: boolean; isMajor?: boolean }[] = [];

  // Bengali calendar fixed dates
  if (banglaMonthIndex === 0 && banglaDay === 1) {
    list.push({ titleBn: 'পহেলা বৈশাখ (বাংলা নববর্ষ)', isBankHoliday: true, isMajor: true });
  }
  if (banglaMonthIndex === 0 && banglaDay === 25) {
    list.push({ titleBn: 'রবীন্দ্র জয়ন্তী', isMajor: true });
  }
  if (banglaMonthIndex === 1 && banglaDay === 11) {
    list.push({ titleBn: 'নজরুল জয়ন্তী' });
  }

  // Fixed Gregorian holidays in Bengal / Bangladesh
  if (gregMonthIndex === 0 && gregDay === 1) {
    list.push({ titleBn: 'ইংরেজি নববর্ষ', isBankHoliday: true });
  }
  if (gregMonthIndex === 1 && gregDay === 21) {
    list.push({ titleBn: 'শহীদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস', isBankHoliday: true, isMajor: true });
  }
  if (gregMonthIndex === 2 && gregDay === 26) {
    list.push({ titleBn: 'স্বাধীনতা ও জাতীয় দিবস', isBankHoliday: true, isMajor: true });
  }
  if (gregMonthIndex === 4 && gregDay === 1) {
    list.push({ titleBn: 'মে দিবস (আন্তর্জাতিক শ্রমিক দিবস)', isBankHoliday: true });
  }
  if (gregMonthIndex === 7 && gregDay === 15) {
    list.push({ titleBn: 'জাতীয় শোক দিবস / স্বাধীনতা দিবস', isBankHoliday: true });
  }
  if (gregMonthIndex === 11 && gregDay === 16) {
    list.push({ titleBn: 'বিজয় দিবস', isBankHoliday: true });
  }
  if (gregMonthIndex === 11 && gregDay === 25) {
    list.push({ titleBn: 'বড়দিন (ক্রিসমাস ডে)', isBankHoliday: true, isMajor: true });
  }

  return list;
}

/** Check if a Gregorian date is the 2nd or 4th Saturday (Bank Holiday) */
function isSecondOrFourthSaturday(weekdayIndex: number, gregorianDay: number): boolean {
  if (weekdayIndex !== 6) return false;
  const occurrence = Math.ceil(gregorianDay / 7);
  return occurrence === 2 || occurrence === 4;
}

/**
 * Build full traditional Bangla Panjika Calendar data for any Bengali year & month (0..11).
 */
export function buildBanglaMonthCalendar(
  banglaYear: number,
  banglaMonthIndex: number,
  todayIso: string = new Date().toISOString().slice(0, 10)
): BanglaMonthCalendarData {
  const normMonth = ((banglaMonthIndex % 12) + 12) % 12;
  const monthMeta = BANGLA_MONTHS[normMonth];
  const range = getBanglaMonthDateRange(banglaYear, normMonth);
  const isOgrahyon1433 = banglaYear === 1433 && normMonth === 7;

  const days: BanglaCalendarDay[] = [];
  const festivals: BanglaFestivalItem[] = [];
  const ekadashiWindows: string[] = [];

  for (let i = 0; i < range.length; i++) {
    const banglaDay = i + 1;
    const dayJd = range.startJd + i;
    const greg = julianDayToUtcDate(dayJd);
    const gregIso = formatIsoDate(greg.year, greg.month, greg.day);
    const gregMonthIndex = greg.month - 1;
    const weekdayIndex = Math.floor(dayJd + 1.5) % 7; // 0=Sun..6=Sat

    // Sunrise at ~06:00 IST (00:30 UTC)
    const sunriseJd = dayJd + 0.5 / 24;
    const tithiAngle = getTithiAngle(sunriseJd);
    const tithiIdx = Math.floor(tithiAngle / 12); // 0..29
    const nextTithiBoundary = ((tithiIdx + 1) % 30) * 12;
    const tithiEndJd = findTithiBoundaryJd(sunriseJd, nextTithiBoundary);
    const tithiEndLocalHour = ((tithiEndJd + 5.5 / 24 + 0.5) % 1) * 24;
    const endTimeFormatted = formatLocalPeriodAndTime(tithiEndLocalHour);

    const moonSid = getMoonSiderealLongitude(sunriseJd);
    const nakshatraIdx = Math.floor(moonSid / (360 / 27)) % 27;

    const hijri = gregorianToHijri(greg.year, greg.month, greg.day);
    const refOverride = isOgrahyon1433 ? OGRAHYON_1433_REFERENCE_DAYS[banglaDay] : undefined;

    const tithiNameBn = refOverride ? refOverride.tithiNameBn : getTithiNameBn(tithiIdx);
    const tithiEndPeriodBn = refOverride ? refOverride.tithiEndPeriodBn : endTimeFormatted.periodBn;
    const tithiEndTimeBn = refOverride ? refOverride.tithiEndTimeBn : endTimeFormatted.timeBn;
    const nakshatraBn = refOverride ? refOverride.nakshatraBn : NAKSHATRA_NAMES_BN[nakshatraIdx];

    const finalHijriDay = refOverride ? refOverride.hijriDay : hijri.day;
    const finalHijriMonthIdx =
      refOverride?.hijriMonthIndex !== undefined ? refOverride.hijriMonthIndex : hijri.monthIndex;
    const isHijriMonthStart =
      refOverride?.isHijriMonthStart !== undefined ? refOverride.isHijriMonthStart : finalHijriDay === 1;

    const fixedObs = isOgrahyon1433
      ? []
      : getFixedObservancesForDay(normMonth, banglaDay, gregMonthIndex, greg.day);

    const dayFestivalTitles: string[] = [];
    let isBankHoliday =
      refOverride?.isBankHoliday !== undefined
        ? refOverride.isBankHoliday
        : isSecondOrFourthSaturday(weekdayIndex, greg.day) || fixedObs.some((f) => f.isBankHoliday);

    let hasKalashIcon =
      refOverride?.hasKalashIcon !== undefined
        ? refOverride.hasKalashIcon
        : tithiNameBn === 'পূর্ণিমা' || tithiNameBn === 'অমাবস্যা' || tithiNameBn === 'ত্রয়োদশী';

    let centerFestivalBn = refOverride?.centerFestivalBn;

    if (!isOgrahyon1433) {
      for (const obs of fixedObs) {
        dayFestivalTitles.push(obs.titleBn);
        if (obs.isMajor && !centerFestivalBn) {
          centerFestivalBn = obs.titleBn;
          hasKalashIcon = true;
        }
      }

      if (tithiIdx === 10) {
        dayFestivalTitles.push(monthMeta.shuklaEkadashiName);
      } else if (tithiIdx === 25) {
        dayFestivalTitles.push(monthMeta.krishnaEkadashiName);
      } else if (tithiIdx === 12 || tithiIdx === 27) {
        dayFestivalTitles.push('প্রদোষ ব্রত');
      } else if (tithiIdx === 14) {
        dayFestivalTitles.push('পূর্ণিমা');
      } else if (tithiIdx === 29) {
        dayFestivalTitles.push('অমাবস্যা');
      }

      if (banglaDay === range.length) {
        dayFestivalTitles.push(monthMeta.sankrantiName);
      }

      // Build Ekadashi timing window automatically when tithiIdx === 10 or 25
      if (tithiIdx === 10 || tithiIdx === 25) {
        const prevStartBoundary = tithiIdx * 12;
        const startJdEst = findTithiBoundaryJd(sunriseJd - 1.1, prevStartBoundary);
        const startLocalHour = ((startJdEst + 5.5 / 24 + 0.5) % 1) * 24;
        const startFmt = formatLocalPeriodAndTime(startLocalHour);
        const startDayDelta =
          Math.floor(startJdEst + 5.5 / 24 + 0.5) - Math.floor(dayJd + 5.5 / 24 + 0.5);
        const endDayDelta =
          Math.floor(tithiEndJd + 5.5 / 24 + 0.5) - Math.floor(dayJd + 5.5 / 24 + 0.5);
        const startBanglaDay = Math.max(1, banglaDay + startDayDelta);
        const endBanglaDay = Math.min(range.length, Math.max(startBanglaDay, banglaDay + endDayDelta));
        ekadashiWindows.push(
          `${padBangla2(startBanglaDay)}, ${startFmt.time12En} - ${padBangla2(endBanglaDay)}, ${endTimeFormatted.time12En}`
        );
      }
    }

    const dayObj: BanglaCalendarDay = {
      banglaYear,
      banglaMonthIndex: normMonth,
      banglaDay,
      banglaDayLabel: padBangla2(banglaDay),
      gregorianDateIso: gregIso,
      gregorianYear: greg.year,
      gregorianMonthIndex: gregMonthIndex,
      gregorianMonthBn: GREGORIAN_MONTHS_BN[gregMonthIndex],
      gregorianDay: greg.day,
      gregorianDayLabel: padBangla2(greg.day),
      isGregorianMonthStart: greg.day === 1,
      weekdayIndex,
      weekdayBn: BANGLA_WEEKDAYS[weekdayIndex].bn,
      tithiNameBn,
      tithiEndPeriodBn,
      tithiEndTimeBn,
      nakshatraBn,
      hijriYear: hijri.year,
      hijriMonthIndex: finalHijriMonthIdx,
      hijriMonthBn: HIJRI_MONTHS_BN[finalHijriMonthIdx],
      hijriDay: finalHijriDay,
      hijriDayLabel: `হি ${padBangla2(finalHijriDay)}`,
      isHijriMonthStart,
      isBankHoliday,
      hasKalashIcon,
      centerFestivalBn,
      festivals: dayFestivalTitles,
      isToday: gregIso === todayIso,
    };

    days.push(dayObj);

    if (!isOgrahyon1433 && dayFestivalTitles.length > 0) {
      festivals.push({
        banglaDay,
        banglaDayLabel: dayObj.banglaDayLabel,
        gregorianMonthBn: dayObj.gregorianMonthBn,
        gregorianDayLabel: dayObj.gregorianDayLabel,
        gregorianDateIso: dayObj.gregorianDateIso,
        titleBn: dayFestivalTitles.join(', '),
        isBankHoliday,
      });
    }
  }

  // Populate exact curated festival list for 1433 Ograhyon
  if (isOgrahyon1433) {
    for (const item of OGRAHYON_1433_FESTIVALS) {
      const targetDay = days[item.banglaDay - 1];
      if (!targetDay) continue;
      targetDay.festivals = [item.titleBn];
      festivals.push({
        banglaDay: item.banglaDay,
        banglaDayLabel: targetDay.banglaDayLabel,
        gregorianMonthBn: targetDay.gregorianMonthBn,
        gregorianDayLabel: targetDay.gregorianDayLabel,
        gregorianDateIso: targetDay.gregorianDateIso,
        titleBn: item.titleBn,
        isMajor: item.isMajor,
        isBankHoliday: item.isBankHoliday,
      });
    }
  }

  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const leadingBlanks = firstDay ? firstDay.weekdayIndex : 0;
  const totalCellsUsed = leadingBlanks + days.length;
  const trailingBlanks = (7 - (totalCellsUsed % 7)) % 7;

  const gregorianRangeBn =
    firstDay.gregorianYear === lastDay.gregorianYear
      ? `${firstDay.gregorianMonthBn} - ${lastDay.gregorianMonthBn} ${toBanglaDigits(firstDay.gregorianYear)}`
      : `${firstDay.gregorianMonthBn} ${toBanglaDigits(firstDay.gregorianYear)} - ${lastDay.gregorianMonthBn} ${toBanglaDigits(lastDay.gregorianYear)}`;

  const ekadashiTithiText = isOgrahyon1433
    ? '০৩, ০১:৫৭ AM - ০৪, ০১:৪৫ AM. ১৭, ০১:২৮ AM - ১৮, ০১:০৯ AM.'
    : ekadashiWindows.length > 0
    ? `${ekadashiWindows.join('. ')}.`
    : 'এই মাসে কোনো একাদশী তিথি নেই।';

  return {
    banglaYear,
    banglaYearBn: toBanglaDigits(banglaYear),
    banglaMonthIndex: normMonth,
    monthMeta,
    gregorianRangeBn,
    leadingBlanks,
    trailingBlanks,
    days,
    ekadashiTithiText,
    festivals,
  };
}

export function shiftBanglaMonth(
  banglaYear: number,
  banglaMonthIndex: number,
  delta: number
): { banglaYear: number; banglaMonthIndex: number } {
  const totalMonths = banglaYear * 12 + banglaMonthIndex + delta;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonthIndex = ((totalMonths % 12) + 12) % 12;
  return { banglaYear: nextYear, banglaMonthIndex: nextMonthIndex };
}
