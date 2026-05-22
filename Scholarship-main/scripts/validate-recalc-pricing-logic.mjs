#!/usr/bin/env node
import assert from 'node:assert/strict';

const MAX_REGRESO_SCHOLARSHIP = 25;

function basePriceFromRule(rule) {
  if (!rule) return null;
  if (Number.isFinite(Number(rule.basePriceMxn))) return Number(rule.basePriceMxn);
  const discounted = Number(rule.discountedPriceMxn ?? rule.monto);
  const percent = Number(rule.scholarshipPercent ?? rule.porcentaje);
  if (!Number.isFinite(discounted) || !Number.isFinite(percent) || percent >= 100) return null;
  return discounted / (1 - percent / 100);
}

function basePriceFromRules(rules) {
  const inferred = rules.map(basePriceFromRule).filter((value) => Number.isFinite(value));
  return inferred.length ? Math.max(...inferred) : null;
}

function quote({ enrollmentType, average, basePriceMxn, scholarshipPercent, fixedScholarshipPercent = 0, additionalBenefitPercent = 0, extraChargeAmount = 0 }) {
  const usesFixedScholarship = fixedScholarshipPercent > 0;
  const sinAccessToScholarship = average < 7 && !usesFixedScholarship;
  const boundedScholarship = usesFixedScholarship
    ? fixedScholarshipPercent
    : enrollmentType === 'nuevo_ingreso'
      ? scholarshipPercent
      : Math.min(scholarshipPercent, MAX_REGRESO_SCHOLARSHIP);
  const effectiveScholarshipPercent = sinAccessToScholarship ? 0 : boundedScholarship;
  const scholarshipAmountMxn = basePriceMxn * (effectiveScholarshipPercent / 100);
  const additionalBenefitAmountMxn = basePriceMxn * (additionalBenefitPercent / 100);
  const subtotalMxn = basePriceMxn - scholarshipAmountMxn - additionalBenefitAmountMxn;
  return {
    scholarshipSource: sinAccessToScholarship ? 'none' : usesFixedScholarship ? 'fixed' : 'average',
    sinAccessToScholarship,
    effectiveScholarshipPercent,
    scholarshipAmountMxn,
    additionalBenefitAmountMxn,
    subtotalMxn,
    totalMxn: subtotalMxn + extraChargeAmount,
  };
}

assert.equal(Math.round(basePriceFromRules([
  { discountedPriceMxn: 700, scholarshipPercent: 30 },
  { discountedPriceMxn: 850, scholarshipPercent: 15 },
]) * 100) / 100, 1000);

const fixed = quote({ enrollmentType: 'reingreso', average: 6.5, basePriceMxn: 3000, scholarshipPercent: 0, fixedScholarshipPercent: 40 });
assert.equal(fixed.sinAccessToScholarship, false);
assert.equal(fixed.scholarshipSource, 'fixed');
assert.equal(fixed.scholarshipAmountMxn, 1200);
assert.equal(fixed.totalMxn, 1800);

const additional = quote({ enrollmentType: 'nuevo_ingreso', average: 9, basePriceMxn: 2000, scholarshipPercent: 30, additionalBenefitPercent: 10 });
assert.equal(additional.additionalBenefitAmountMxn, 200);
assert.equal(additional.totalMxn, 1200);

const capped = quote({ enrollmentType: 'regreso', average: 9.4, basePriceMxn: 1000, scholarshipPercent: 50 });
assert.equal(capped.effectiveScholarshipPercent, 25);
assert.equal(capped.totalMxn, 750);

console.log('OK: lógica de precio base, beca fija, beneficios adicionales y topes validada.');
