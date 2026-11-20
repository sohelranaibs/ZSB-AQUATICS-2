import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBanglaMonthCalendar,
  gregorianIsoToBanglaYearMonth,
  gregorianToHijri,
  padBangla2,
  shiftBanglaMonth,
  toBanglaDigits,
} from './banglaCalendar';

test('toBanglaDigits and padBangla2 convert digits accurately', () => {
  assert.equal(toBanglaDigits(1433), '১৪৩৩');
  assert.equal(toBanglaDigits('2026'), '২০২৬');
  assert.equal(padBangla2(1), '০১');
  assert.equal(padBangla2(29), '২৯');
});

test('1433 Ograhyon (Nov-Dec 2026) matches traditional Panjika calendar accurately', () => {
  const cal = buildBanglaMonthCalendar(1433, 7, '2026-11-20');

  assert.equal(cal.banglaYear, 1433);
  assert.equal(cal.banglaYearBn, '১৪৩৩');
  assert.equal(cal.monthMeta.en, 'OGRAHYON');
  assert.equal(cal.monthMeta.bn, 'অগ্রহায়ণ');
  assert.equal(cal.gregorianRangeBn, 'নভেম্বর - ডিসেম্বর ২০২৬');
  assert.equal(cal.leadingBlanks, 3); // Starts on Wednesday (বুধবার)
  assert.equal(cal.days.length, 29);

  // Day 1: Wed, Nov 18, 2026
  const day1 = cal.days[0];
  assert.equal(day1.banglaDayLabel, '০১');
  assert.equal(day1.gregorianDateIso, '2026-11-18');
  assert.equal(day1.gregorianDayLabel, '১৮');
  assert.equal(day1.weekdayBn, 'বুধবার');
  assert.equal(day1.tithiNameBn, 'নবমী');
  assert.equal(day1.nakshatraBn, 'শতভিষা');
  assert.equal(day1.hijriDayLabel, 'হি ০৭');

  // Day 3: Today (Nov 20, 2026)
  const day3 = cal.days[2];
  assert.equal(day3.isToday, true);
  assert.equal(day3.tithiNameBn, 'একাদশী');

  // Day 7: Guru Nanak Jayanti, Purnima, BH
  const day7 = cal.days[6];
  assert.equal(day7.tithiNameBn, 'পূর্ণিমা');
  assert.equal(day7.isBankHoliday, true);
  assert.equal(day7.hasKalashIcon, true);
  assert.equal(day7.centerFestivalBn, 'গুরু নানক এর জন্মজয়ন্তী');

  // Day 14: Dec 1 Gregorian month start
  const day14 = cal.days[13];
  assert.equal(day14.gregorianDateIso, '2026-12-01');
  assert.equal(day14.isGregorianMonthStart, true);
  assert.equal(day14.gregorianMonthBn, 'ডিসেম্বর');

  // Day 24: 1st of Rajab (Hijri month start)
  const day24 = cal.days[23];
  assert.equal(day24.isHijriMonthStart, true);
  assert.equal(day24.hijriMonthBn, 'রজব');
  assert.equal(day24.hijriDayLabel, 'হি ০১');

  // Ekadashi & Festivals
  assert.equal(
    cal.ekadashiTithiText,
    '০৩, ০১:৫৭ AM - ০৪, ০১:৪৫ AM. ১৭, ০১:২৮ AM - ১৮, ০১:০৯ AM.'
  );
  assert.equal(cal.festivals.length, 8);
  assert.equal(cal.festivals[0].titleBn, 'জগদ্ধাত্রী পুজো');
  assert.equal(cal.festivals[7].titleBn, 'ধনু সংক্রান্তি');
});

test('gregorianIsoToBanglaYearMonth maps Nov 20, 2026 to 1433 Ograhyon Day 3', () => {
  const mapped = gregorianIsoToBanglaYearMonth('2026-11-20');
  assert.equal(mapped.banglaYear, 1433);
  assert.equal(mapped.banglaMonthIndex, 7);
  assert.equal(mapped.banglaDay, 3);
});

test('all 12 Bengali months of 1433 compute continuously without gaps or overlaps', () => {
  let prevEndIso = '';
  for (let m = 0; m < 12; m++) {
    const cal = buildBanglaMonthCalendar(1433, m, '2026-11-20');
    assert.ok(cal.days.length >= 29 && cal.days.length <= 32, `Month ${m} length ${cal.days.length}`);
    assert.ok(cal.festivals.length >= 3, `Month ${m} should list monthly observances`);
    assert.ok(cal.days.every((d) => d.tithiNameBn.length > 0 && d.nakshatraBn.length > 0));
    if (prevEndIso) {
      const prevMs = Date.parse(`${prevEndIso}T00:00:00Z`);
      const nextMs = Date.parse(`${cal.days[0].gregorianDateIso}T00:00:00Z`);
      assert.equal(Math.round((nextMs - prevMs) / 86400000), 1, `Month ${m} must follow previous month by 1 day`);
    }
    prevEndIso = cal.days[cal.days.length - 1].gregorianDateIso;
  }
});

test('shiftBanglaMonth wraps cleanly across year boundaries', () => {
  assert.deepEqual(shiftBanglaMonth(1433, 11, 1), { banglaYear: 1434, banglaMonthIndex: 0 });
  assert.deepEqual(shiftBanglaMonth(1433, 0, -1), { banglaYear: 1432, banglaMonthIndex: 11 });
});

test('gregorianToHijri produces valid Hijri dates', () => {
  const h = gregorianToHijri(2026, 11, 18);
  assert.equal(h.year, 1448);
  assert.ok(h.day >= 6 && h.day <= 8);
});
