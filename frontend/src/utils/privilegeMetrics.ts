import type { PrivilegeAccount } from '../types/privilege.types';

/** Aggregate INR values in paise so floating-point residue cannot affect AUM. */
export const currencyAmount = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
};

export const sumCurrency = (values: Iterable<unknown>): number => {
  let paise = 0;
  for (const value of values) paise += Math.round(currencyAmount(value) * 100);
  return paise / 100;
};

export const privilegePortfolioMetrics = (accounts: PrivilegeAccount[]) => {
  const totalAUM = sumCurrency(accounts.map(account => account.aum));
  const totalUtilised = sumCurrency(accounts.map(account => account.utilised));
  const totalAccounts = accounts.length;
  return {
    totalAccounts,
    totalAUM,
    totalUtilised,
    availableCapital: currencyAmount(totalAUM - totalUtilised),
    avgUtilised: totalAccounts ? currencyAmount(totalUtilised / totalAccounts) : 0,
    utilisationRatio: totalAUM > 0 ? (totalUtilised / totalAUM) * 100 : 0
  };
};
