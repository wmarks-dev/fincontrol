import {
  SalaryConfig,
  SalaryCalculationResult,
  SalaryTaxBracket,
  TaxTableConfig,
  SalaryItemizedEntry,
  SalaryThirteenthConfig,
  SalaryThirteenthResult,
  SalaryVacationConfig,
  SalaryVacationResult,
} from '../types';
import { parseISODateAsUTC } from './dateUtils';

/**
 * Tabelas Fiscais Oficiais por Ano
 */
export const OFFICIAL_TAX_TABLES: Record<number, TaxTableConfig> = {
  // 2026 (Portaria Interministerial MPS/MF nº 13/2026 & Lei nº 15.270/2025)
  2026: {
    year: 2026,
    inssCeiling: 988.07,
    inssBrackets: [
      { limit: 1621.0, rate: 0.075 },
      { limit: 2902.84, rate: 0.09 },
      { limit: 4354.27, rate: 0.12 },
      { limit: 8475.55, rate: 0.14 },
    ],
    irrfBrackets: [
      { limit: 2428.8, rate: 0.0, deduction: 0.0 },
      { limit: 2826.65, rate: 0.075, deduction: 182.16 },
      { limit: 3751.05, rate: 0.15, deduction: 394.16 },
      { limit: 4664.68, rate: 0.225, deduction: 675.49 },
      { limit: Infinity, rate: 0.275, deduction: 908.73 },
    ],
    dependentDeduction: 189.59,
    simplifiedDeduction: 607.2,
  },

  // 2025
  2025: {
    year: 2025,
    inssCeiling: 951.63,
    inssBrackets: [
      { limit: 1518.0, rate: 0.075 },
      { limit: 2793.88, rate: 0.09 },
      { limit: 4190.83, rate: 0.12 },
      { limit: 8157.41, rate: 0.14 },
    ],
    irrfBrackets: [
      { limit: 2259.2, rate: 0.0, deduction: 0.0 },
      { limit: 2826.65, rate: 0.075, deduction: 169.44 },
      { limit: 3751.05, rate: 0.15, deduction: 381.44 },
      { limit: 4664.68, rate: 0.225, deduction: 662.77 },
      { limit: Infinity, rate: 0.275, deduction: 896.0 },
    ],
    dependentDeduction: 189.59,
    simplifiedDeduction: 564.8,
  },

  // 2024
  2024: {
    year: 2024,
    inssCeiling: 908.85,
    inssBrackets: [
      { limit: 1412.0, rate: 0.075 },
      { limit: 2666.68, rate: 0.09 },
      { limit: 4000.03, rate: 0.12 },
      { limit: 7786.02, rate: 0.14 },
    ],
    irrfBrackets: [
      { limit: 2259.2, rate: 0.0, deduction: 0.0 },
      { limit: 2826.65, rate: 0.075, deduction: 169.44 },
      { limit: 3751.05, rate: 0.15, deduction: 381.44 },
      { limit: 4664.68, rate: 0.225, deduction: 662.77 },
      { limit: Infinity, rate: 0.275, deduction: 896.0 },
    ],
    dependentDeduction: 189.59,
    simplifiedDeduction: 564.8,
  },
};

// Aliases for backwards compatibility
export const INSS_BRACKETS_2026 = OFFICIAL_TAX_TABLES[2026].inssBrackets;
export const INSS_CEILING_DISCOUNT_2026 = OFFICIAL_TAX_TABLES[2026].inssCeiling;
export const DEDUCTION_PER_DEPENDENT_2026 = OFFICIAL_TAX_TABLES[2026].dependentDeduction;
export const SIMPLIFIED_IRRF_DISCOUNT_2026 = OFFICIAL_TAX_TABLES[2026].simplifiedDeduction;
export const IRRF_BRACKETS_2026 = OFFICIAL_TAX_TABLES[2026].irrfBrackets;

/**
 * Returns the tax table for a specific year, prioritizing user custom configuration if present.
 */
export function getTaxTableForYear(year: number, customTables?: TaxTableConfig[]): TaxTableConfig {
  if (customTables && customTables.length > 0) {
    const userTable = customTables.find((t) => t.year === year);
    if (userTable) return userTable;
  }
  if (OFFICIAL_TAX_TABLES[year]) {
    return OFFICIAL_TAX_TABLES[year];
  }
  // Fallback to latest (2026)
  return OFFICIAL_TAX_TABLES[2026];
}

/**
 * Calculates progressive INSS deduction based on selected tax table.
 */
export function calculateINSS(
  grossSalary: number,
  taxTable?: TaxTableConfig
): {
  totalINSS: number;
  brackets: SalaryTaxBracket[];
} {
  const table = taxTable || OFFICIAL_TAX_TABLES[2026];

  if (grossSalary <= 0) {
    return { totalINSS: 0, brackets: [] };
  }

  let remaining = grossSalary;
  let totalINSS = 0;
  let previousLimit = 0;
  const brackets: SalaryTaxBracket[] = [];

  for (let i = 0; i < table.inssBrackets.length; i++) {
    const { limit, rate } = table.inssBrackets[i];
    const range = limit - previousLimit;

    if (remaining <= 0) break;

    const taxableInRange = Math.min(remaining, range);
    const tax = taxableInRange * rate;
    totalINSS += tax;

    brackets.push({
      bracket: `Faixa ${i + 1} (${(rate * 100).toFixed(1)}%)`,
      rate,
      baseAmount: Math.round(taxableInRange * 100) / 100,
      deduction: Math.round(tax * 100) / 100,
    });

    remaining -= taxableInRange;
    previousLimit = limit;
  }

  // Cap at official ceiling discount
  let roundedTotal = Math.round(totalINSS * 100) / 100;
  const ceilingSalary = table.inssBrackets[table.inssBrackets.length - 1]?.limit || 8475.55;
  if (grossSalary >= ceilingSalary || roundedTotal > table.inssCeiling) {
    roundedTotal = table.inssCeiling;
  }

  return {
    totalINSS: roundedTotal,
    brackets,
  };
}

/**
 * Calculates IRRF discount comparing legal deduction vs simplified standard discount.
 */
export function calculateIRRF(
  grossSalary: number,
  inssDiscount: number,
  dependents: number,
  otherDeductions: number,
  taxTable?: TaxTableConfig
): {
  irrfDiscount: number;
  irrfBase: number;
  usedSimplified: boolean;
} {
  const table = taxTable || OFFICIAL_TAX_TABLES[2026];

  if (grossSalary <= 0) {
    return { irrfDiscount: 0, irrfBase: 0, usedSimplified: false };
  }

  // 1. Legal deduction base
  const legalDeductions =
    inssDiscount + dependents * table.dependentDeduction + (otherDeductions || 0);
  const legalBase = Math.max(0, grossSalary - legalDeductions);

  // 2. Simplified discount base
  const simplifiedBase = Math.max(0, grossSalary - table.simplifiedDeduction);

  // Function to calculate IRRF from a given base
  const computeTax = (base: number): number => {
    for (const b of table.irrfBrackets) {
      if (base <= b.limit) {
        return Math.max(0, base * b.rate - b.deduction);
      }
    }
    return 0;
  };

  const taxLegal = computeTax(legalBase);
  const taxSimplified = computeTax(simplifiedBase);

  // Choose the option that results in lower tax for the taxpayer
  if (taxSimplified < taxLegal) {
    return {
      irrfDiscount: Math.round(taxSimplified * 100) / 100,
      irrfBase: Math.round(simplifiedBase * 100) / 100,
      usedSimplified: true,
    };
  } else {
    return {
      irrfDiscount: Math.round(taxLegal * 100) / 100,
      irrfBase: Math.round(legalBase * 100) / 100,
      usedSimplified: false,
    };
  }
}

/**
 * Calculates complete salary projection and payslip breakdown.
 */
export function calculateSalary(
  config: SalaryConfig,
  taxTable?: TaxTableConfig,
  itemizedEntries?: SalaryItemizedEntry[]
): SalaryCalculationResult {
  const baseSalary = Number(config.grossSalary) || 0;
  const dependents = Number(config.dependents) || 0;
  const baseOtherDeductions = Number(config.otherDeductions) || 0;
  const advancePercentage = Number(config.advancePercentage) || 40;
  const advanceDay = Number(config.advanceDay) || 20;
  const paydayDay = Number(config.paydayDay) || 5;

  // Process itemized entries
  let additionalEarnings = 0;
  let itemizedDeductions = 0;

  if (itemizedEntries && itemizedEntries.length > 0) {
    for (const item of itemizedEntries) {
      const val = Number(item.amount) || 0;
      if (item.type === 'earning') {
        additionalEarnings += val;
      } else if (item.type === 'deduction') {
        itemizedDeductions += val;
      }
    }
  }

  const effectiveGross = baseSalary + additionalEarnings;
  const totalOtherDeductions = baseOtherDeductions + itemizedDeductions;

  const table = taxTable || getTaxTableForYear(config.taxYear || 2026);

  if (effectiveGross <= 0) {
    return {
      grossSalary: 0,
      baseSalary: 0,
      additionalEarnings: 0,
      itemizedDeductions: 0,
      effectiveGross: 0,
      inssDiscount: 0,
      inssEffectiveRate: 0,
      inssBrackets: [],
      irrfDiscount: 0,
      irrfEffectiveRate: 0,
      irrfBase: 0,
      irrfUsedSimplified: false,
      totalDeductions: 0,
      netSalary: 0,
      advanceAmount: 0,
      paydayAmount: 0,
      advanceDay,
      paydayDay,
    };
  }

  let inssDiscount = 0;
  let inssEffectiveRate = 0;
  let inssBrackets: SalaryTaxBracket[] = [];
  let irrfDiscount = 0;
  let irrfEffectiveRate = 0;
  let irrfBase = 0;
  let usedSimplified = false;

  // Custom Taxes override (if user wants to fix exact paystub values)
  if (config.useCustomTaxes) {
    inssDiscount = Number(config.customInssAmount) || 0;
    irrfDiscount = Number(config.customIrrfAmount) || 0;
    inssEffectiveRate = effectiveGross > 0 ? (inssDiscount / effectiveGross) * 100 : 0;
    irrfEffectiveRate = effectiveGross > 0 ? (irrfDiscount / effectiveGross) * 100 : 0;
    irrfBase = Math.max(0, effectiveGross - inssDiscount - dependents * table.dependentDeduction);
    inssBrackets = [
      {
        bracket: 'Valor fixado da folha',
        rate: inssEffectiveRate / 100,
        baseAmount: effectiveGross,
        deduction: inssDiscount,
      },
    ];
  } else {
    // 1. Progressive INSS calculation
    const inssResult = calculateINSS(effectiveGross, table);
    inssDiscount = inssResult.totalINSS;
    inssBrackets = inssResult.brackets;
    inssEffectiveRate = effectiveGross > 0 ? (inssDiscount / effectiveGross) * 100 : 0;

    // 2. Progressive IRRF calculation
    const irrfResult = calculateIRRF(
      effectiveGross,
      inssDiscount,
      dependents,
      totalOtherDeductions,
      table
    );
    irrfDiscount = irrfResult.irrfDiscount;
    irrfBase = irrfResult.irrfBase;
    usedSimplified = irrfResult.usedSimplified;
    irrfEffectiveRate = effectiveGross > 0 ? (irrfDiscount / effectiveGross) * 100 : 0;
  }

  // 3. Totals
  const totalDeductions = inssDiscount + irrfDiscount + totalOtherDeductions;
  const netSalary = Math.max(0, effectiveGross - totalDeductions);

  // 4. Advance & Payday
  let advanceAmount = 0;
  if (
    config.useCustomAdvance &&
    config.customAdvanceAmount !== undefined &&
    config.customAdvanceAmount > 0
  ) {
    advanceAmount = Number(config.customAdvanceAmount);
  } else {
    advanceAmount = Math.round(baseSalary * (advancePercentage / 100) * 100) / 100;
  }

  const paydayAmount = Math.max(0, Math.round((netSalary - advanceAmount) * 100) / 100);

  return {
    grossSalary: effectiveGross,
    baseSalary,
    additionalEarnings: Math.round(additionalEarnings * 100) / 100,
    itemizedDeductions: Math.round(itemizedDeductions * 100) / 100,
    effectiveGross: Math.round(effectiveGross * 100) / 100,
    inssDiscount: Math.round(inssDiscount * 100) / 100,
    inssEffectiveRate: Math.round(inssEffectiveRate * 100) / 100,
    inssBrackets,
    irrfDiscount: Math.round(irrfDiscount * 100) / 100,
    irrfEffectiveRate: Math.round(irrfEffectiveRate * 100) / 100,
    irrfBase: Math.round(irrfBase * 100) / 100,
    irrfUsedSimplified: usedSimplified,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100,
    advanceAmount,
    paydayAmount,
    advanceDay,
    paydayDay,
  };
}

/**
 * Calculates 13th Salary (Gratificação Natalina) under Brazilian CLT.
 * Accepts either:
 *  - (thirteenthConfig, salaryConfig, taxTable, itemizedEntries)
 *  - (baseGross, monthsWorked, taxTable, dependents, otherDeductions, firstInstallmentPercentage, year)
 * 1st Installment: 50% gross without INSS/IRRF deductions.
 * 2nd Installment: Exclusive taxation at source on the full annual amount, deducting 1st installment.
 */
export function calculateThirteenthSalary(
  confOrGross: Partial<SalaryThirteenthConfig> | number | null | undefined,
  configOrMonths?: Partial<SalaryConfig> | number | null,
  taxTableOrTable?: TaxTableConfig,
  itemsOrDependents?: SalaryItemizedEntry[] | number,
  otherDeductionsArg?: number,
  firstInstallmentPercentageArg?: number,
  yearArg?: number
): SalaryThirteenthResult {
  let effectiveGross = 0;
  let monthsWorked = 12;
  let firstInstallmentMonth = 10;
  let firstInstallmentPercentage = 50;
  let dependents = 0;
  let otherDeductions = 0;
  let year = 2026;
  let taxTable: TaxTableConfig | undefined;

  if (typeof confOrGross === 'object' || confOrGross === null || confOrGross === undefined) {
    const thirteenthConf: Partial<SalaryThirteenthConfig> = (typeof confOrGross === 'object' && confOrGross !== null ? confOrGross : {}) as Partial<SalaryThirteenthConfig>;
    const salaryConfig: Partial<SalaryConfig> = (typeof configOrMonths === 'object' && configOrMonths !== null ? configOrMonths : {}) as Partial<SalaryConfig>;
    const itemizedEntries: SalaryItemizedEntry[] = Array.isArray(itemsOrDependents) ? itemsOrDependents : [];

    const baseSalary = Number(salaryConfig.grossSalary) || 0;
    const additionalEarnings = itemizedEntries
      .filter((i) => i.type === 'earning')
      .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    effectiveGross = baseSalary + additionalEarnings;

    monthsWorked = Math.max(1, Math.min(12, thirteenthConf.monthsWorked !== undefined ? Number(thirteenthConf.monthsWorked) : 12));
    firstInstallmentMonth = thirteenthConf.firstInstallmentMonth !== undefined ? thirteenthConf.firstInstallmentMonth : 10;
    firstInstallmentPercentage = thirteenthConf.firstInstallmentPercentage !== undefined ? Number(thirteenthConf.firstInstallmentPercentage) : 50;
    dependents = Number(salaryConfig.dependents) || 0;
    otherDeductions = Number(salaryConfig.otherDeductions) || 0;
    year = thirteenthConf.year || salaryConfig.taxYear || 2026;
    taxTable = taxTableOrTable || getTaxTableForYear(year);
  } else {
    effectiveGross = Number(confOrGross) || 0;
    monthsWorked = typeof configOrMonths === 'number' ? configOrMonths : 12;
    taxTable = taxTableOrTable || getTaxTableForYear(yearArg || 2026);
    dependents = typeof itemsOrDependents === 'number' ? itemsOrDependents : 0;
    otherDeductions = otherDeductionsArg || 0;
    firstInstallmentPercentage = firstInstallmentPercentageArg || 50;
    year = yearArg || 2026;
    firstInstallmentMonth = 10;
  }

  const safeMonths = Math.max(1, Math.min(12, monthsWorked));
  const safeGross = Math.max(0, effectiveGross);
  const totalGross = Math.round((safeGross * (safeMonths / 12)) * 100) / 100;

  // 1ª Parcela: adiantamento proporcional sem incidência de INSS nem IRRF
  const pct = Math.max(1, Math.min(100, firstInstallmentPercentage)) / 100;
  const firstInstallmentGross = Math.round(totalGross * pct * 100) / 100;
  const firstInstallmentNet = firstInstallmentGross; // ZERO retenção fiscal

  // 2ª Parcela: apuração com tributação exclusiva na fonte
  const secondInstallmentGross = Math.max(0, Math.round((totalGross - firstInstallmentGross) * 100) / 100);

  // INSS sobre o total integral do 13º salário
  const { totalINSS } = calculateINSS(totalGross, taxTable);
  const inssDiscount = totalINSS;
  const inssEffectiveRate = totalGross > 0 ? (inssDiscount / totalGross) * 100 : 0;

  // IRRF sobre o 13º salário (tributação exclusiva na fonte)
  const { irrfDiscount, irrfBase, usedSimplified } = calculateIRRF(
    totalGross,
    inssDiscount,
    dependents,
    otherDeductions,
    taxTable
  );
  const irrfEffectiveRate = totalGross > 0 ? (irrfDiscount / totalGross) * 100 : 0;

  const totalDeductions = inssDiscount + irrfDiscount;
  // Líquido da 2ª parcela = total bruto - 1ª parcela já adiantada - INSS - IRRF
  const secondInstallmentNet = Math.max(
    0,
    Math.round((totalGross - firstInstallmentGross - totalDeductions) * 100) / 100
  );
  const totalNet = Math.round((firstInstallmentNet + secondInstallmentNet) * 100) / 100;

  return {
    year,
    baseSalary: safeGross,
    effectiveGross: totalGross,
    monthsWorked: safeMonths,
    firstInstallmentMonth,
    firstInstallmentPercentage,
    totalGross,
    firstInstallmentGross,
    firstInstallmentNet,
    secondInstallmentGross,
    inssDiscount,
    inssEffectiveRate: Math.round(inssEffectiveRate * 100) / 100,
    irrfDiscount,
    irrfEffectiveRate: Math.round(irrfEffectiveRate * 100) / 100,
    irrfBase,
    irrfUsedSimplified: usedSimplified,
    totalDeductions,
    secondInstallmentNet,
    totalNet,
  };
}

/**
 * Calculates Vacation Remuneration (+ 1/3 constitutional bonus) under Brazilian CLT.
 * Accepts either:
 *  - (vacationConfig, salaryConfig, taxTable, itemizedEntries)
 *  - (baseGross, vacationDays, sellDays, startDate, advanceThirteenth, taxTable, dependents, year)
 * Includes optional selling of up to 10 days (abono pecuniário) with full tax exemption.
 */
export function calculateVacation(
  vacOrGross: Partial<SalaryVacationConfig> | number,
  configOrDays?: Partial<SalaryConfig> | number | null,
  taxTableOrSell?: TaxTableConfig | number,
  itemsOrStart?: SalaryItemizedEntry[] | string,
  advanceThirteenthArg?: boolean,
  taxTableArg?: TaxTableConfig,
  dependentsArg?: number,
  yearArg?: number
): SalaryVacationResult {
  let effectiveGross = 0;
  let vacationDays = 30;
  let sellDays = 0;
  let startDate = '';
  let advanceThirteenth = false;
  let dependents = 0;
  let year = 2026;
  let taxTable: TaxTableConfig | undefined;

  if (typeof vacOrGross === 'object' && vacOrGross !== null) {
    const vac: Partial<SalaryVacationConfig> = vacOrGross;
    const salaryConfig: Partial<SalaryConfig> = (typeof configOrDays === 'object' ? configOrDays : null) || {};
    const itemizedEntries: SalaryItemizedEntry[] = Array.isArray(itemsOrStart) ? itemsOrStart : [];

    const baseSalary = Number(salaryConfig.grossSalary) || 0;
    const additionalEarnings = itemizedEntries
      .filter((i) => i.type === 'earning')
      .reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
    effectiveGross = baseSalary + additionalEarnings;

    vacationDays = Math.max(0, Math.min(30, vac.vacationDays !== undefined ? Number(vac.vacationDays) : 30));
    sellDays = Math.max(0, Math.min(10, vac.sellDays !== undefined ? Number(vac.sellDays) : 0));
    startDate = vac.startDate || '';
    advanceThirteenth = Boolean(vac.advanceThirteenth);
    dependents = Number(salaryConfig.dependents) || 0;
    year = vac.year || salaryConfig.taxYear || 2026;
    taxTable = (taxTableOrSell && typeof taxTableOrSell === 'object' && 'inssBrackets' in taxTableOrSell ? taxTableOrSell : undefined) || getTaxTableForYear(year);
  } else {
    effectiveGross = Number(vacOrGross) || 0;
    vacationDays = typeof configOrDays === 'number' ? configOrDays : 30;
    sellDays = typeof taxTableOrSell === 'number' ? taxTableOrSell : 0;
    startDate = typeof itemsOrStart === 'string' ? itemsOrStart : '';
    advanceThirteenth = advanceThirteenthArg || false;
    taxTable = taxTableArg || getTaxTableForYear(yearArg || 2026);
    dependents = dependentsArg || 0;
    year = yearArg || 2026;
  }

  const safeGross = Math.max(0, effectiveGross);
  const dailyRate = Math.round((safeGross / 30) * 100) / 100;

  const safeVacationDays = Math.max(0, Math.min(30, vacationDays));
  const safeSellDays = Math.max(0, Math.min(10, sellDays));

  // 1. Período gozado de férias (tributável)
  const vacationGross = Math.round(dailyRate * safeVacationDays * 100) / 100;
  const constitutionalBonus = Math.round((vacationGross / 3) * 100) / 100;
  const taxableBase = Math.round((vacationGross + constitutionalBonus) * 100) / 100;

  // INSS sobre férias
  const { totalINSS } = calculateINSS(taxableBase, taxTable);
  const inssDiscount = totalINSS;
  const inssEffectiveRate = taxableBase > 0 ? (inssDiscount / taxableBase) * 100 : 0;

  // IRRF sobre férias (tributação separada do salário mensal)
  const { irrfDiscount, irrfBase, usedSimplified } = calculateIRRF(
    taxableBase,
    inssDiscount,
    dependents,
    0,
    taxTable
  );
  const irrfEffectiveRate = taxableBase > 0 ? (irrfDiscount / taxableBase) * 100 : 0;
  const vacationNet = Math.max(0, Math.round((taxableBase - inssDiscount - irrfDiscount) * 100) / 100);

  // 2. Abono Pecuniário (venda de dias) - 100% ISENTO de INSS e IRRF (Súmula 386/STJ)
  const sellGross = Math.round(dailyRate * safeSellDays * 100) / 100;
  const sellBonus = Math.round((sellGross / 3) * 100) / 100;
  const sellTotalTaxFree = Math.round((sellGross + sellBonus) * 100) / 100;

  // 3. Adiantamento da 1ª parcela do 13º salário (opcional nas férias)
  const thirteenthAdvance = advanceThirteenth ? Math.round(safeGross * 0.5 * 100) / 100 : 0;

  // 4. Total líquido a receber antes do início das férias
  const totalNetToReceive = Math.round((vacationNet + sellTotalTaxFree + thirteenthAdvance) * 100) / 100;

  // 5. Data limite de pagamento estimada (até 2 dias antes do início)
  let payDateEstimated = '';
  if (startDate) {
    try {
      const d = parseISODateAsUTC(startDate);
      if (!isNaN(d.getTime())) {
        d.setUTCDate(d.getUTCDate() - 2);
        payDateEstimated = d.toISOString().split('T')[0];
      }
    } catch {
      payDateEstimated = startDate;
    }
  }

  // 6. Saldo de salário restante a receber na folha do mês de retorno
  const remainingWorkedDaysInMonth = Math.max(0, 30 - safeVacationDays);
  const remainingWorkedDaysSalary = Math.round(dailyRate * remainingWorkedDaysInMonth * 100) / 100;

  return {
    year,
    baseSalary: safeGross,
    vacationDays: safeVacationDays,
    sellDays: safeSellDays,
    dailyRate,
    vacationGross,
    vacationPay: vacationGross,
    constitutionalBonus,
    oneThirdPay: constitutionalBonus,
    taxableBase,
    inssDiscount,
    inssEffectiveRate: Math.round(inssEffectiveRate * 100) / 100,
    irrfDiscount,
    irrfEffectiveRate: Math.round(irrfEffectiveRate * 100) / 100,
    irrfBase,
    irrfUsedSimplified: usedSimplified,
    vacationNet,
    sellGross,
    abonoPay: sellGross,
    sellBonus,
    abonoOneThirdPay: sellBonus,
    sellTotalTaxFree,
    thirteenthAdvance,
    totalNetToReceive,
    totalVacationNet: totalNetToReceive,
    payDateEstimated,
    paymentLimitDate: payDateEstimated,
    remainingWorkedDaysInMonth,
    remainingWorkedDaysSalary,
    residualSalaryInMonth: remainingWorkedDaysSalary,
  };
}

