"use strict";

const record = require("../routes/record");

/**
 * record controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::record.record", ({ strapi }) => ({
  async findMyRecords(ctx) {
    const params = ctx.request.body;
    const searchParams = params.searchParams;
    const sortParams = params.sortParams;
    const userId = params.userId;
    const page = params.meta.page;
    const pageSize = params.meta.pageSize;

    let searchParamsTimes = null;
    if (
      searchParams.time_min ||
      searchParams.time_max ||
      searchParams.per_time_min ||
      searchParams.per_time_max
    ) {
      searchParamsTimes = convertSearchParamsTimeToSecond(searchParams);
    }

    const filters = makeFilters(searchParams, userId, searchParamsTimes);

    const convertedSortParams = Object.fromEntries(
      sortParams.map((param) => [param.name, param.sort])
    );

    const entries = await strapi.entityService.findPage("api::record.record", {
      fields: ["id", "date", "distance", "time", "per_time", "step", "cal"],
      filters: filters,
      sort: convertedSortParams,
      page,
      pageSize,
    });

    return entries;
  },
  async findTotalRecords(ctx) {
    const params = ctx.request.body;

    const entries = await strapi.entityService.findMany("api::record.record", {
      fields: ["date", ...params?.targetColumns],
      filters: {
        user_id: { $eq: params.userId },
        date: { $between: [params.date_min, params.date_max] },
      },
    });

    let totalResult = { dataArr: [] };
    totalResult.targetRecords = entries;

    const isDistance = params?.targetColumns.includes("distance");
    const isTime = params?.targetColumns.includes("time");
    const isPerTime = params?.targetColumns.includes("per_time");
    const isStep = params?.targetColumns.includes("step");
    const isCal = params?.targetColumns.includes("cal");

    if (
      params.options.includes("total") ||
      params.options.includes("average")
    ) {
      const [totalValues, averageValues] = calculateTotalValues(
        entries,
        isDistance,
        isTime,
        isPerTime,
        isStep,
        isCal
      );
      if (params.options.includes("total"))
        totalResult.dataArr.push({ totalValues: totalValues });
      if (params.options.includes("average"))
        totalResult.dataArr.push({ averageValues: averageValues });
    }

    if (params.options.includes("min") || params.options.includes("max")) {
      const [maxValues, minValues] = selectMaxAndMinValues(
        entries,
        isDistance,
        isTime,
        isPerTime,
        isStep,
        isCal
      );
      if (params.options.includes("max"))
        totalResult.dataArr.push({ maxValues: maxValues });
      if (params.options.includes("min"))
        totalResult.dataArr.push({ minValues: minValues });
    }

    return totalResult;
  },
}));

// 各カラムの合計値、平均値を算出
const calculateTotalValues = (
  recordList,
  isDistance,
  isTime,
  isPerTime,
  isStep,
  isCal
) => {
  const recordCount = recordList.length; // レコード数

  let totalDistanceInt = 0; // 合計距離
  let totalTimeSecond = isTime ? 0 : null;
  let totalPerTimeSecond = isPerTime ? 0 : null;
  let totalStep = isStep ? 0 : null; // 合計歩数
  let totalCal = isCal ? 0 : null; // 合計カロリー

  for (const record of recordList) {
    if (isDistance) totalDistanceInt += record.distance * 100;
    if (isTime) {
      const timeSecond = timeConvertToSecond(record.time);
      totalTimeSecond += timeSecond;
    }
    if (isPerTime) {
      const perTimeSecond = timeConvertToSecond(record.per_time);
      totalPerTimeSecond += perTimeSecond;
    }
    if (isStep) totalStep += record.step;
    if (isCal) totalCal += record.cal;
  }

  const totalDistance = isDistance ? totalDistanceInt / 100 : null;
  // 合計時間
  const totalTime = isTime ? secondConvertToTime(totalTimeSecond) : null;

  // 合計 時間／km
  const totalPerTime = isPerTime
    ? secondConvertToTime(totalPerTimeSecond)
    : null;

  let totalValues = [
    totalDistance,
    totalTime,
    totalPerTime,
    totalStep,
    totalCal,
  ];
  totalValues = totalValues.filter((value) => value !== null);

  const averageDistance = isDistance
    ? Math.floor(totalDistanceInt / recordCount) / 100
    : null; // 平均距離
  const averageStep = isStep ? Math.floor(totalStep / recordCount) : null; // 平均歩数
  const averageCal = isCal ? Math.floor(totalCal / recordCount) : null; // 平均カロリー

  // 平均時間
  let averageTime = isTime
    ? secondConvertToTime(totalTimeSecond / recordCount)
    : null;

  // 平均 時間／km
  let averagePerTime = null;
  if (isPerTime) {
    const dividedPerTimeSecond = totalPerTimeSecond / recordCount;
    averagePerTime = secondConvertToTime(dividedPerTimeSecond);
  }

  let averageValues = [
    averageDistance,
    averageTime,
    averagePerTime,
    averageStep,
    averageCal,
  ];
  averageValues = averageValues.filter((value) => value !== null);

  return [totalValues, averageValues];
};

// 各カラムの最大値、最小値を抽出
const selectMaxAndMinValues = (
  recordList,
  isDistance,
  isTime,
  isPerTime,
  isStep,
  isCal
) => {
  let distanceArr = [];
  let timeArr = [];
  let perTimeArr = [];
  let stepArr = [];
  let calArr = [];

  for (const record of recordList) {
    if (isDistance) distanceArr.push(record.distance);
    if (isTime) timeArr.push(timeConvertToSecond(record.time));
    if (isPerTime) perTimeArr.push(timeConvertToSecond(record.per_time));
    if (isStep) stepArr.push(record.step);
    if (isCal) calArr.push(record.cal);
  }

  let maxValues = [
    isDistance ? Math.max(...distanceArr) : null,
    isTime ? secondConvertToTime(Math.max(...timeArr)) : null,
    isPerTime ? secondConvertToTime(Math.min(...perTimeArr)) : null,
    isStep ? Math.max(...stepArr) : null,
    isCal ? Math.max(...calArr) : null,
  ];
  maxValues = maxValues.filter((value) => value !== null);

  let minValues = [
    isDistance ? Math.min(...distanceArr) : null,
    isTime ? secondConvertToTime(Math.min(...timeArr)) : null,
    isPerTime ? secondConvertToTime(Math.max(...perTimeArr)) : null,
    isStep ? Math.min(...stepArr) : null,
    isCal ? Math.min(...calArr) : null,
  ];
  minValues = minValues.filter((value) => value !== null);

  return [maxValues, minValues];
};

// 時間から秒に変換
const timeConvertToSecond = (time) => {
  const timeArr = time.split(":");
  const convertedToSecond =
    Number(timeArr[0]) * 3600 + Number(timeArr[1]) * 60 + Number(timeArr[2]);

  return convertedToSecond;
};

// 秒から時間に変換
const secondConvertToTime = (second) => {
  // 時・分・秒をそれぞれ算出
  let hour = Math.floor(second / 3600).toString();
  let remainderMinute = second % 3600;
  let minute = Math.floor(remainderMinute / 60).toString();
  let remainderSecond = Math.floor(remainderMinute % 60).toString();

  // 時・分・秒が1桁だった場合0パディングで2桁にする
  if (hour.length === 1) hour = hour.padStart(2, "0");
  if (minute.length === 1) minute = minute.padStart(2, "0");
  if (remainderSecond.length === 1)
    remainderSecond = remainderSecond.padStart(2, "0");

  const convertedToTime = `${hour}:${minute}:${remainderSecond}`;

  return convertedToTime;
};

const convertSearchParamsTimeToSecond = (searchParams) => {
  let convertedTimeFilters = [];

  if (searchParams?.time_min) {
    const minTime = timeConvertToSecond(searchParams.time_min);
    convertedTimeFilters.minTime = minTime;
  }
  if (searchParams?.time_max) {
    const maxTime = timeConvertToSecond(searchParams.time_max);
    convertedTimeFilters.maxTime = maxTime;
  }
  if (searchParams?.time_min) {
    const minPerTime = timeConvertToSecond(searchParams.per_time_min);
    convertedTimeFilters.minPerTime = minPerTime;
  }

  if (searchParams?.time_max) {
    const maxPerTime = timeConvertToSecond(searchParams.per_time_max);
    convertedTimeFilters.maxPerTime = maxPerTime;
  }

  return convertedTimeFilters;
};

const makeFilters = (searchParams, userId, searchParamsTimes = null) => {
  let filters = {
    user_id: { $eq: userId },
  };

  if (searchParams.date_min && searchParams.date_max) {
    filters.date = {
      $between: [searchParams.date_min, searchParams.date_max],
    };
  } else if (searchParams.date_min) {
    filters.date = { $gte: searchParams.date_min };
  } else if (searchParams.date_max) {
    filters.date = { $lte: searchParams.date_max };
  }

  if (searchParams.distance_min && searchParams.distance_max) {
    filters.distance = {
      $between: [searchParams.distance_min, searchParams.distance_max],
    };
  } else if (searchParams.distance_min) {
    filters.distance = { $gte: searchParams.distance_min };
  } else if (searchParams.distance_max) {
    filters.distance = { $lte: searchParams.distance_max };
  }

  if (searchParamsTimes) {
    if (searchParamsTimes.minTime && searchParamsTimes.maxTime) {
      filters.time_second = {
        $between: [searchParamsTimes.minTime, searchParamsTimes.maxTime],
      };
    } else if (searchParamsTimes.minTime) {
      filters.time_second = { $gte: searchParamsTimes.minTime };
    } else if (searchParamsTimes.maxTime) {
      filters.time_second = { $lte: searchParamsTimes.maxTime };
    }

    if (searchParamsTimes.minPerTime && searchParamsTimes.maxPerTime) {
      filters.per_time_second = {
        $between: [searchParamsTimes.minPerTime, searchParamsTimes.maxPerTime],
      };
    } else if (searchParamsTimes.minPerTime) {
      filters.per_time_second = { $gte: searchParamsTimes.minPerTime };
    } else if (searchParamsTimes.maxPerTime) {
      filters.per_time_second = { $lte: searchParamsTimes.maxPerTime };
    }
  }

  if (searchParams.step_min && searchParams.step_max) {
    filters.step = {
      $between: [searchParams.step_min, searchParams.step_max],
    };
  } else if (searchParams.step_min) {
    filters.step = { $gte: searchParams.step_min };
  } else if (searchParams.step_max) {
    filters.step = { $lte: searchParams.step_max };
  }

  if (searchParams.cal_min && searchParams.cal_max) {
    filters.cal = {
      $between: [searchParams.cal_min, searchParams.cal_max],
    };
  } else if (searchParams.cal_min) {
    filters.cal = { $gte: searchParams.cal_min };
  } else if (searchParams.cal_max) {
    filters.cal = { $lte: searchParams.cal_max };
  }

  return filters;
};
