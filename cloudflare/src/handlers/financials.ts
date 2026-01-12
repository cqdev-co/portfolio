/**
 * Financials Handler
 *
 * Endpoint for deep financial data (income, balance, cash flow)
 *
 * v4.3: Improved data extraction - tries multiple module formats
 * (Annual, Quarterly, TTM) and uses financialData as fallback
 */

import { jsonResponse } from '../utils/response';
import { withRetry } from '../utils/retry';
import { getYahooAuth, fetchYahooAPI } from '../auth/crumb';
import { fetchQuote } from '../fetchers';
import type { YahooFinancialsResponse, FinancialsData } from '../types';

// Helper to get raw value safely
function getRaw(obj: { raw?: number } | undefined | null): number {
  return obj?.raw ?? 0;
}

/**
 * Handle /financials/:ticker endpoint
 */
export async function handleFinancials(ticker: string): Promise<Response> {
  const symbol = ticker.toUpperCase();

  try {
    const auth = await getYahooAuth();

    // Fetch quote for PE/EPS
    const quote = await fetchQuote(symbol, auth);

    // v4.3: Request ALL statement variants (annual + quarterly + TTM)
    const modules = [
      'incomeStatementHistory',
      'incomeStatementHistoryQuarterly',
      'balanceSheetHistory',
      'balanceSheetHistoryQuarterly',
      'cashflowStatementHistory',
      'cashflowStatementHistoryQuarterly',
      'financialData',
      'defaultKeyStatistics',
    ].join(',');

    const data = await withRetry(
      () =>
        fetchYahooAPI<YahooFinancialsResponse>(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/` +
            `${encodeURIComponent(symbol)}?modules=${modules}`,
          auth
        ),
      `financials/${symbol}`
    );

    const summary = data.quoteSummary?.result?.[0];
    if (!summary) {
      return jsonResponse({ error: 'Financial data not found' }, 404);
    }

    // v4.3: Try annual first, fall back to quarterly
    const income =
      summary.incomeStatementHistory?.incomeStatementHistory?.[0] ||
      summary.incomeStatementHistoryQuarterly?.incomeStatementHistory?.[0];
    const balance =
      summary.balanceSheetHistory?.balanceSheetStatements?.[0] ||
      summary.balanceSheetHistoryQuarterly?.balanceSheetStatements?.[0];
    const cashflow =
      summary.cashflowStatementHistory?.cashflowStatements?.[0] ||
      summary.cashflowStatementHistoryQuarterly?.cashflowStatements?.[0];
    const fd = summary.financialData;
    const ks = summary.defaultKeyStatistics;

    // v4.3: Build income statement with fallbacks from financialData
    const totalRevenue =
      getRaw(income?.totalRevenue) || getRaw(fd?.totalRevenue);
    const grossProfit = getRaw(income?.grossProfit) || getRaw(fd?.grossProfits);
    const operatingIncome = getRaw(income?.operatingIncome);
    const netIncome = getRaw(income?.netIncome);

    // Use financialData margins if available (more reliable for some tickers)
    const grossMarginFromFD = fd?.grossMargins?.raw
      ? Math.round(fd.grossMargins.raw * 1000) / 10
      : null;
    const operatingMarginFromFD = fd?.operatingMargins?.raw
      ? Math.round(fd.operatingMargins.raw * 1000) / 10
      : null;
    const profitMarginFromFD = fd?.profitMargins?.raw
      ? Math.round(fd.profitMargins.raw * 1000) / 10
      : null;

    const incomeStatement = {
      revenue: totalRevenue,
      revenueGrowth: fd?.revenueGrowth?.raw
        ? Math.round(fd.revenueGrowth.raw * 1000) / 10
        : null,
      grossProfit,
      grossMargin:
        grossMarginFromFD ??
        (totalRevenue > 0
          ? Math.round((grossProfit / totalRevenue) * 1000) / 10
          : 0),
      operatingIncome,
      operatingMargin:
        operatingMarginFromFD ??
        (totalRevenue > 0
          ? Math.round((operatingIncome / totalRevenue) * 1000) / 10
          : 0),
      netIncome,
      netMargin:
        profitMarginFromFD ??
        (totalRevenue > 0
          ? Math.round((netIncome / totalRevenue) * 1000) / 10
          : 0),
      eps: quote?.eps ?? getRaw(ks?.trailingEps) ?? 0,
      epsGrowth: fd?.earningsGrowth?.raw
        ? Math.round(fd.earningsGrowth.raw * 1000) / 10
        : null,
    };

    // v4.3: Build balance sheet with fallbacks from financialData
    const totalAssets = getRaw(balance?.totalAssets);
    const totalLiabilities = getRaw(balance?.totalLiab);
    const totalEquity = getRaw(balance?.totalStockholderEquity);
    const cash =
      getRaw(balance?.cash) ||
      getRaw(balance?.cashAndShortTermInvestments) ||
      getRaw(fd?.totalCash);
    const totalDebt =
      getRaw(balance?.longTermDebt) ||
      getRaw(balance?.totalDebt) ||
      getRaw(fd?.totalDebt);
    const currentAssets = getRaw(balance?.totalCurrentAssets);
    const currentLiabilities = getRaw(balance?.totalCurrentLiabilities) || 1;

    // Use financialData ratios if statement data missing
    const debtToEquityFromFD = fd?.debtToEquity?.raw ?? null;
    const currentRatioFromFD = fd?.currentRatio?.raw ?? null;

    const balanceSheet = {
      totalAssets,
      totalLiabilities,
      totalEquity,
      cash,
      totalDebt,
      debtToEquity:
        debtToEquityFromFD !== null
          ? Math.round(debtToEquityFromFD * 100) / 100
          : totalEquity > 0
            ? Math.round((totalDebt / totalEquity) * 100) / 100
            : 0,
      currentRatio:
        currentRatioFromFD !== null
          ? Math.round(currentRatioFromFD * 100) / 100
          : currentLiabilities > 0
            ? Math.round((currentAssets / currentLiabilities) * 100) / 100
            : 0,
    };

    // v4.3: Build cash flow with fallbacks from financialData
    const operatingCashFlow =
      getRaw(cashflow?.totalCashFromOperatingActivities) ||
      getRaw(fd?.operatingCashflow);
    const capex = Math.abs(getRaw(cashflow?.capitalExpenditures));
    const fcf =
      getRaw(fd?.freeCashflow) ||
      (operatingCashFlow > 0 ? operatingCashFlow - capex : 0);
    const marketCap = quote?.marketCap ?? 1;

    const cashFlowData = {
      operatingCashFlow,
      capitalExpenditure: capex,
      freeCashFlow: fcf,
      fcfYield:
        marketCap > 0 && fcf > 0
          ? Math.round((fcf / marketCap) * 1000) / 10
          : null,
      dividendsPaid: cashflow?.dividendsPaid?.raw
        ? Math.abs(cashflow.dividendsPaid.raw)
        : null,
    };

    const result: FinancialsData = {
      ticker: symbol,
      currency: 'USD',
      fiscalYear: income?.endDate?.raw
        ? new Date(income.endDate.raw * 1000).getFullYear().toString()
        : 'TTM',
      income: incomeStatement,
      balance: balanceSheet,
      cashFlow: cashFlowData,
      valuationMetrics: {
        peRatio: quote?.peRatio ?? null,
        forwardPE: quote?.forwardPE ?? null,
        pegRatio: ks?.pegRatio?.raw ?? null,
        priceToBook: ks?.priceToBook?.raw ?? null,
        priceToSales: ks?.priceToSalesTrailing12Months?.raw ?? null,
        evToEbitda: ks?.enterpriseToEbitda?.raw ?? null,
      },
    };

    return jsonResponse(result);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500);
  }
}
