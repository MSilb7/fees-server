import { getTimestampAtStartOfDayUTC } from "../utils/date";
import { successResponse, wrap, IResponse } from "../utils";
import { getFees, Fee, FeeType } from "../utils/data/fees";
import { protocolAdapterData } from "../utils/adapters";
import { summAllFees } from "../utils/feeCalcs";
import allSettled from 'promise.allsettled'
import { FeeHistoryItem, RevenueHistoryItem } from "./getFees";

export interface FeeItem {
  name: string
  feesHistory: FeeHistoryItem[] | null
  revenueHistory: RevenueHistoryItem[] | null
  total1dFees: number | null
  total1dRevenue: number | null
}

export interface IHandlerBodyResponse {
  fees: FeeItem[],
}

export const handler = async (): Promise<IResponse> => {

  const feeItems: any[] = await allSettled(protocolAdapterData.map(async (feeData) => {
    const fee = await getFees(feeData.id, FeeType.dailyFees, "ALL")
    const rev = await getFees(feeData.id, FeeType.dailyRevenue, "ALL")

    if (fee instanceof Fee) {
      console.log(`Wrong fee queried for ${feeData}`)
      return
    }
    if (rev instanceof Fee) {
      console.log(`Wrong rev queried for ${feeData}`)
      return
    }

    const todaysTimestamp = getTimestampAtStartOfDayUTC((Date.now() - 1000 * 60 * 60 * 24) / 1000);
    const todaysFees = fee.find(v => getTimestampAtStartOfDayUTC(v.timestamp) === todaysTimestamp)?.data
    const todaysRevenue = rev.find(v => getTimestampAtStartOfDayUTC(v.timestamp) === todaysTimestamp)?.data

    const feeItemObj: FeeItem = {
      name: feeData.adapterKey,
      feesHistory: fee.map<FeeHistoryItem>(f => ({
          dailyFees: f.data,
          timestamp: f.sk
      })),
      revenueHistory: rev.map<RevenueHistoryItem>(f => ({
          dailyRevenue: f.data,
          timestamp: f.sk
      })),
      total1dFees: todaysFees ? summAllFees(todaysFees) : 0,
      total1dRevenue: todaysRevenue ? summAllFees(todaysRevenue) : 0,
    }
    
    return feeItemObj
  })).then(result => result.filter(rar => rar.status === 'fulfilled').map(r => r.status === "fulfilled" && r.value))

  const feeDataResponse = {
    fees: feeItems
  }
  // return successResponse(feeDataResponse as IHandlerBodyResponse, 10 * 60); // 10 mins cache
  return successResponse(feeDataResponse as IHandlerBodyResponse); // no cache for testing
};

export default wrap(handler);
