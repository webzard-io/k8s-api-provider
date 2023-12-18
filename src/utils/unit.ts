const UNITS = ['', 'K', 'M', 'G', 'T', 'P'];
const FRACTIONAL = ['', 'm', 'u', 'n', 'p', 'f']; // milli micro nano pico femto

type FormatOptions = {
  increment: number;
  suffix: string | null;
  firstSuffix: string | null;
  startingExponent: number;
  minExponent: number;
  maxPrecision: number;
  atLeastOne: boolean;
};

export function formatSi(inValue: number, options?: Partial<FormatOptions>) {
  const {
    increment = 1000,
    suffix = null,
    firstSuffix = null,
    startingExponent = 0,
    minExponent = 0,
    maxPrecision = 2,
    atLeastOne = true,
  } = options || {};

  let val = inValue;
  let exp = startingExponent;

  while ((val >= increment && exp + 1 < UNITS.length) || exp < minExponent) {
    val = val / increment;
    exp++;
  }

  let out = 0;

  if (val < 10 && maxPrecision >= 2) {
    out = Math.round(val * 100) / 100;
  } else if (val < 100 && maxPrecision >= 1) {
    out = Math.round(val * 10) / 10;
  } else {
    out = Math.round(val);
  }

  if (atLeastOne && out === 0) {
    out = 1;
  }

  let outStr = String(out);

  if (exp === 0 && firstSuffix !== null) {
    outStr += `${firstSuffix}`;
  } else {
    outStr += `${UNITS[exp]}${suffix}` || '';
  }

  return outStr;
}

export function parseSi(
  inValue: string,
  increment: number | null = null,
  allowFractional = true
) {
  if (!inValue || typeof inValue !== 'string' || !inValue.length) {
    return NaN;
  }

  inValue = inValue.replace(/,/g, '');

  // eslint-disable-next-line prefer-const
  let [, valStr, unit, incStr] =
    inValue.match(/^([0-9.-]+)\s*([^0-9.-]?)([^0-9.-]?)/) || [];

  const val = parseFloat(valStr);

  if (!unit) {
    return val;
  }

  // micro "mu" symbol -> u
  if (unit.charCodeAt(0) === 181) {
    unit = 'u';
  }

  const divide = FRACTIONAL.includes(unit);
  const multiply = UNITS.includes(unit.toUpperCase());

  if (increment === null) {
    // Automatically handle 1 KB = 1000B, 1 KiB = 1024B if no increment set
    if ((multiply || divide) && incStr === 'i') {
      increment = 1024;
    } else {
      increment = 1000;
    }
  }

  if (divide && allowFractional) {
    const exp = FRACTIONAL.indexOf(unit);

    return val / Math.pow(increment, exp);
  }

  if (multiply) {
    const exp = UNITS.indexOf(unit.toUpperCase());

    return val * Math.pow(increment, exp);
  }

  // Unrecognized unit character
  return val;
}
