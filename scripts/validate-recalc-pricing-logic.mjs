#!/usr/bin/env node
import assert from "node:assert/strict";

function basePriceFromRule(rule) {
  if (!rule) return null;
  if (Number.isFinite(Number(rule.basePriceMxn))) return Number(rule.basePriceMxn);
  const discounted = Number(rule.discountedPriceMxn ?? rule.monto);
  const percent = Number(rule.scholarshipPercent ?? rule.porcentaje);
  if (!Number.isFinite(discounted) || !Number.isFinite(percent) || percent >= 100) {
    return null;
  }
  return discounted / (1 - percent / 100);
}

function basePriceFromRules(rules) {
  const inferred = rules.map(basePriceFromRule).filter((value) => Number.isFinite(value));
  return inferred.length ? Math.max(...inferred) : null;
}

function quote({
  average,
  basePriceMxn,
  scholarshipPercent,
  additionalBenefitPercent = 0,
  extraChargeAmount = 0,
}) {
  const sinAccessToScholarship = average < 7;
  const effectiveScholarshipPercent = sinAccessToScholarship ? 0 : scholarshipPercent;
  const scholarshipAmountMxn = basePriceMxn * (effectiveScholarshipPercent / 100);
  const additionalBenefitAmountMxn = basePriceMxn * (additionalBenefitPercent / 100);
  const subtotalMxn = basePriceMxn - scholarshipAmountMxn - additionalBenefitAmountMxn;
  return {
    scholarshipSource: sinAccessToScholarship ? "none" : "average",
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

const additional = quote({
  average: 9,
  basePriceMxn: 2000,
  scholarshipPercent: 30,
  additionalBenefitPercent: 10,
});
assert.equal(additional.additionalBenefitAmountMxn, 200);
assert.equal(additional.totalMxn, 1200);

const regreso = quote({
  average: 9.4,
  basePriceMxn: 1000,
  scholarshipPercent: 50,
});
assert.equal(regreso.effectiveScholarshipPercent, 50);
assert.equal(regreso.totalMxn, 500);

console.log("OK: lógica canónica de precio base, beca por promedio y beneficios validada.");
