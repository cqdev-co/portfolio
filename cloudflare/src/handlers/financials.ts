/**
 * Financials Handler
 * 
 * Endpoint for deep financial data (income, balance, cash flow)
 */

import { jsonResponse } from '../utils/response';
import { withRetry } from '../utils/retry';
import { getYahooAuth, fetchYahooAPI } from '../auth/crumb';
import { fetchQuote } from '../fetchers';
import type { YahooFinancialsResponse, FinancialsData } from '../types';

/**
 * Handle /financials/:ticker endpoint
 */
export async function handleFinancials(ticker: string): Promise<Response> {
  const symbol = ticker.toUpperCase();
  
  try {
    const auth = await getYahooAuth();
    
    // Fetch quote for PE/EPS
    const quote = await fetchQuote(symbol, auth);
    
    // Fetch detailed financials
    const modules = [
      'incomeStatementHistory',
      'balanceSheetHistory',
      'cashflowStatementHistory',
      'financialData',
      'defaultKeyStatistics',
    ].join(',');
    
    const data = await withRetry(
      () => fetchYahooAPI<YahooFinancialsResponse>(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/` +
        `${symbol}?modules=${modules}`,
        auth
      ),
      `financials/${symbol}`
    );
    
    const summary = data.quoteSummary?.result?.[0];
    if (!summary) {
      return jsonResponse({ error: 'Financial data not found' }, 404);
    }
    
    const income = summary.incomeStatementHistory
      ?.incomeStatementHistory?.[0];
    const balance = summary.balanceSheetHistory
      ?.balanceSheetStatements?.[0];
    const cashflow = summary.cashflowStatementHistory
      ?.cashflowStatements?.[0];
    const fd = summary.financialData;
    const ks = summary.defaultKeyStatistics;
    
    // Build income statement
    const totalRevenue = income?.totalRevenue?.raw ?? 0;
    const grossProfit = income?.grossProfit?.raw ?? 0;
    const operatingIncome = income?.operatingIncome?.raw ?? 0;
    const netIncome = income?.netIncome?.raw ?? 0;
    
    const incomeStatement = {
      revenue: totalRevenue,
      revenueGrowth: fd?.revenueGrowth?.raw 
        ? Math.round(fd.revenueGrowth.raw * 1000) / 10 
        : null,
      grossProfit,
      grossMargin: totalRevenue > 0 
        ? Math.round((grossProfit / totalRevenue) * 1000) / 10 
        : 0,
      operatingIncome,
      operatingMargin: totalRevenue > 0 
        ? Math.round((operatingIncome / totalRevenue) * 1000) / 10 
        : 0,
      netIncome,
      netMargin: totalRevenue > 0 
        ? Math.round((netIncome / totalRevenue) * 1000) / 10 
        : 0,
      eps: quote?.eps ?? 0,
      epsGrowth: fd?.earningsGrowth?.raw 
        ? Math.round(fd.earningsGrowth.raw * 1000) / 10 
        : null,
    };
    
    // Build balance sheet
    const totalAssets = balance?.totalAssets?.raw ?? 0;
    const totalLiabilities = balance?.totalLiab?.raw ?? 0;
    const totalEquity = balance?.totalStockholderEquity?.raw ?? 0;
    const cash = balance?.cash?.raw ?? 0;
    const totalDebt = balance?.longTermDebt?.raw ?? 0;
    const currentAssets = balance?.totalCurrentAssets?.raw ?? 0;
    const currentLiabilities = balance?.totalCurrentLiabilities?.raw ?? 1;
    
    const balanceSheet = {
      totalAssets,
      totalLiabilities,
      totalEquity,
      cash,
      totalDebt,
      debtToEquity: totalEquity > 0 
        ? Math.round((totalDebt / totalEquity) * 100) / 100 
        : 0,
      currentRatio: currentLiabilities > 0 
        ? Math.round((currentAssets / currentLiabilities) * 100) / 100 
        : 0,
    };
    
    // Build cash flow
    const operatingCashFlow = cashflow
      ?.totalCashFromOperatingActivities?.raw ?? 0;
    const capex = Math.abs(cashflow?.capitalExpenditures?.raw ?? 0);
    const fcf = operatingCashFlow - capex;
    const marketCap = quote?.marketCap ?? 1;
    
    const cashFlowData = {
      operatingCashFlow,
      capitalExpenditure: capex,
      freeCashFlow: fcf,
      fcfYield: marketCap > 0 
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

