export interface ArbitrageCalculationInput { sourcePrice:number; fxRate:number; shippingKrw:number; platformFeeRate:number; taxKrw:number; otherCostKrw:number; sellingPriceKrw:number; }
export interface ArbitrageCalculationResult { sourceCostKrw:number; platformFeeKrw:number; totalCostKrw:number; netProfitKrw:number; roiPercent:number; }
export function calculateArbitrage(input:ArbitrageCalculationInput):ArbitrageCalculationResult {
  const sourceCostKrw=input.sourcePrice*input.fxRate;
  const platformFeeKrw=input.sellingPriceKrw*input.platformFeeRate;
  const totalCostKrw=sourceCostKrw+input.shippingKrw+platformFeeKrw+input.taxKrw+input.otherCostKrw;
  const netProfitKrw=input.sellingPriceKrw-totalCostKrw;
  const roiPercent=sourceCostKrw>0?(netProfitKrw/sourceCostKrw)*100:0;
  return {sourceCostKrw,platformFeeKrw,totalCostKrw,netProfitKrw,roiPercent};
}
