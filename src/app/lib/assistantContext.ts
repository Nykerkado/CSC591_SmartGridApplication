import type { AssistantContext } from "../../shared/chat";
import {
  buildEnergyDistributionData,
  buildGridLoadData,
  buildPowerConsumptionData,
  buildRenewableEnergyData,
  getSimulationStats,
  type SimulationStatus,
  type SmartGridRecord,
} from "./smartGrid";

type BuildAssistantContextOptions = {
  fileName: string;
  processedRows: SmartGridRecord[];
  status: SimulationStatus;
  totalRows: number;
};

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function buildEmptyPoint() {
  return {
    value: 0,
    timestamp: null as string | null,
  };
}

export function buildAssistantContext({
  fileName,
  processedRows,
  status,
  totalRows,
}: BuildAssistantContextOptions): AssistantContext {
  const stats = getSimulationStats(processedRows);
  const powerConsumption = buildPowerConsumptionData(processedRows);
  const renewableEnergy = buildRenewableEnergyData(processedRows);
  const gridLoad = buildGridLoadData(processedRows);
  const energyDistribution = buildEnergyDistributionData(processedRows);

  if (processedRows.length === 0) {
    return {
      meta: {
        fileName,
        status,
        processedCount: 0,
        totalRows,
        progress: 0,
        startTimestamp: null,
        endTimestamp: null,
        latestTimestamp: null,
      },
      kpis: stats,
      power: {
        minConsumption: buildEmptyPoint(),
        maxConsumption: buildEmptyPoint(),
        averageConsumption: 0,
        peakDemand: buildEmptyPoint(),
        forecastGap: {
          averageAbsoluteGap: 0,
          averageSignedGap: 0,
          maximumAbsoluteGap: buildEmptyPoint(),
        },
      },
      price: {
        min: 0,
        max: 0,
        average: 0,
        latest: 0,
      },
      renewables: {
        solarTotal: 0,
        windTotal: 0,
        bestSolarPeriod: buildEmptyPoint(),
        bestWindPeriod: buildEmptyPoint(),
      },
      grid: {
        averageLoad: 0,
        averageCapacity: 0,
        minimumHeadroom: buildEmptyPoint(),
        peakDemandWindow: {
          timestamp: null,
          load: 0,
          capacity: 0,
          headroom: 0,
        },
      },
      faults: {
        recentOverloadTimestamps: [],
        recentTransformerFaultTimestamps: [],
      },
      series: {
        powerConsumption,
        renewableEnergy,
        gridLoad,
        energyDistribution,
      },
    };
  }

  const summary = processedRows.reduce(
    (accumulator, record) => {
      const load = record.powerConsumption;
      const capacity = record.solarPower + record.windPower + record.gridSupply;
      const headroom = capacity - load;
      const signedGap = record.predictedLoad - record.powerConsumption;
      const absoluteGap = Math.abs(signedGap);

      accumulator.totalConsumption += load;
      accumulator.totalPrice += record.electricityPrice;
      accumulator.totalSolar += record.solarPower;
      accumulator.totalWind += record.windPower;
      accumulator.totalCapacity += capacity;
      accumulator.totalLoad += load;
      accumulator.totalSignedGap += signedGap;
      accumulator.totalAbsoluteGap += absoluteGap;

      if (load < accumulator.minConsumption.value) {
        accumulator.minConsumption = { value: load, timestamp: record.timestamp };
      }

      if (load > accumulator.maxConsumption.value) {
        accumulator.maxConsumption = { value: load, timestamp: record.timestamp };
      }

      if (load > accumulator.peakDemand.value) {
        accumulator.peakDemand = { value: load, timestamp: record.timestamp };
        accumulator.peakDemandCapacity = capacity;
      }

      if (record.electricityPrice < accumulator.minPrice) {
        accumulator.minPrice = record.electricityPrice;
      }

      if (record.electricityPrice > accumulator.maxPrice) {
        accumulator.maxPrice = record.electricityPrice;
      }

      if (record.solarPower > accumulator.bestSolarPeriod.value) {
        accumulator.bestSolarPeriod = { value: record.solarPower, timestamp: record.timestamp };
      }

      if (record.windPower > accumulator.bestWindPeriod.value) {
        accumulator.bestWindPeriod = { value: record.windPower, timestamp: record.timestamp };
      }

      if (headroom < accumulator.minimumHeadroom.value) {
        accumulator.minimumHeadroom = { value: headroom, timestamp: record.timestamp };
      }

      if (absoluteGap > accumulator.maximumAbsoluteGap.value) {
        accumulator.maximumAbsoluteGap = { value: absoluteGap, timestamp: record.timestamp };
      }

      return accumulator;
    },
    {
      totalConsumption: 0,
      totalPrice: 0,
      totalSolar: 0,
      totalWind: 0,
      totalCapacity: 0,
      totalLoad: 0,
      totalSignedGap: 0,
      totalAbsoluteGap: 0,
      minConsumption: { value: Number.POSITIVE_INFINITY, timestamp: null as string | null },
      maxConsumption: buildEmptyPoint(),
      peakDemand: buildEmptyPoint(),
      peakDemandCapacity: 0,
      minPrice: Number.POSITIVE_INFINITY,
      maxPrice: Number.NEGATIVE_INFINITY,
      bestSolarPeriod: buildEmptyPoint(),
      bestWindPeriod: buildEmptyPoint(),
      minimumHeadroom: { value: Number.POSITIVE_INFINITY, timestamp: null as string | null },
      maximumAbsoluteGap: buildEmptyPoint(),
    }
  );

  const processedCount = processedRows.length;
  const latestRow = processedRows[processedCount - 1];

  return {
    meta: {
      fileName,
      status,
      processedCount,
      totalRows,
      progress: totalRows === 0 ? 0 : Math.round((processedCount / totalRows) * 100),
      startTimestamp: processedRows[0]?.timestamp ?? null,
      endTimestamp: latestRow?.timestamp ?? null,
      latestTimestamp: latestRow?.timestamp ?? null,
    },
    kpis: stats,
    power: {
      minConsumption: {
        value: round(summary.minConsumption.value),
        timestamp: summary.minConsumption.timestamp,
      },
      maxConsumption: {
        value: round(summary.maxConsumption.value),
        timestamp: summary.maxConsumption.timestamp,
      },
      averageConsumption: round(summary.totalConsumption / processedCount),
      peakDemand: {
        value: round(summary.peakDemand.value),
        timestamp: summary.peakDemand.timestamp,
      },
      forecastGap: {
        averageAbsoluteGap: round(summary.totalAbsoluteGap / processedCount),
        averageSignedGap: round(summary.totalSignedGap / processedCount),
        maximumAbsoluteGap: {
          value: round(summary.maximumAbsoluteGap.value),
          timestamp: summary.maximumAbsoluteGap.timestamp,
        },
      },
    },
    price: {
      min: round(summary.minPrice, 3),
      max: round(summary.maxPrice, 3),
      average: round(summary.totalPrice / processedCount, 3),
      latest: round(latestRow.electricityPrice, 3),
    },
    renewables: {
      solarTotal: round(summary.totalSolar),
      windTotal: round(summary.totalWind),
      bestSolarPeriod: {
        value: round(summary.bestSolarPeriod.value),
        timestamp: summary.bestSolarPeriod.timestamp,
      },
      bestWindPeriod: {
        value: round(summary.bestWindPeriod.value),
        timestamp: summary.bestWindPeriod.timestamp,
      },
    },
    grid: {
      averageLoad: round(summary.totalLoad / processedCount),
      averageCapacity: round(summary.totalCapacity / processedCount),
      minimumHeadroom: {
        value: round(summary.minimumHeadroom.value),
        timestamp: summary.minimumHeadroom.timestamp,
      },
      peakDemandWindow: {
        timestamp: summary.peakDemand.timestamp,
        load: round(summary.peakDemand.value),
        capacity: round(summary.peakDemandCapacity),
        headroom: round(summary.peakDemandCapacity - summary.peakDemand.value),
      },
    },
    faults: {
      recentOverloadTimestamps: stats.overloadTimestamps.slice(-5),
      recentTransformerFaultTimestamps: stats.transformerFaultTimestamps.slice(-5),
    },
    series: {
      powerConsumption,
      renewableEnergy,
      gridLoad,
      energyDistribution,
    },
  };
}
