import { useEffect, useMemo, useState } from "react";
import type { AssistantContext } from "../../shared/chat";
import {
  fetchDashboardSummary,
  fetchJob,
  ingestCsvFile,
  type BackendJob,
  type RawSensorMeasurement,
  type BackendSummary,
} from "../lib/backendClient";
import type {
  FluctuationPoint,
  GridLoadPoint,
  PowerPoint,
  RenewablePoint,
  RiskPoint,
  SimulationStatus,
  SourcePoint,
} from "../lib/smartGrid";

type SimulationStats = {
  latestPrice: number;
  overloadEvents: number;
  overloadTimestamps: string[];
  renewableShare: number;
  transformerFaultTimestamps: string[];
  transformerFaults: number;
};

function buildEmptyAssistantContext(): AssistantContext {
  return {
    meta: {
      endTimestamp: null,
      fileName: "",
      latestTimestamp: null,
      processedCount: 0,
      progress: 0,
      startTimestamp: null,
      status: "idle",
      totalRows: 0,
    },
    kpis: {
      latestPrice: 0,
      overloadEvents: 0,
      renewableShare: 0,
      transformerFaults: 0,
    },
    power: {
      averageConsumption: 0,
      forecastGap: {
        averageAbsoluteGap: 0,
        averageSignedGap: 0,
        maximumAbsoluteGap: { timestamp: null, value: 0 },
      },
      maxConsumption: { timestamp: null, value: 0 },
      minConsumption: { timestamp: null, value: 0 },
      peakDemand: { timestamp: null, value: 0 },
    },
    price: {
      average: 0,
      latest: 0,
      max: 0,
      min: 0,
    },
    renewables: {
      bestSolarPeriod: { timestamp: null, value: 0 },
      bestWindPeriod: { timestamp: null, value: 0 },
      solarTotal: 0,
      windTotal: 0,
    },
    grid: {
      averageCapacity: 0,
      averageLoad: 0,
      minimumHeadroom: { timestamp: null, value: 0 },
      peakDemandWindow: {
        capacity: 0,
        headroom: 0,
        load: 0,
        timestamp: null,
      },
    },
    faults: {
      recentOverloadTimestamps: [],
      recentTransformerFaultTimestamps: [],
    },
    series: {
      energyDistribution: [],
      gridLoad: [],
      powerConsumption: [],
      renewableEnergy: [],
    },
  };
}

function buildEmptyStats(): SimulationStats {
  return {
    latestPrice: 0,
    overloadEvents: 0,
    overloadTimestamps: [],
    renewableShare: 0,
    transformerFaultTimestamps: [],
    transformerFaults: 0,
  };
}

function buildEmptyRawSensorData(): {
  latest: RawSensorMeasurement | null;
  recentMeasurements: RawSensorMeasurement[];
} {
  return {
    latest: null,
    recentMeasurements: [],
  };
}

export function useSmartGridSimulation() {
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [chatSessionKey, setChatSessionKey] = useState(0);
  const [job, setJob] = useState<BackendJob | null>(null);
  const [assistantContext, setAssistantContext] = useState<AssistantContext>(
    buildEmptyAssistantContext()
  );
  const [stats, setStats] = useState<SimulationStats>(buildEmptyStats());
  const [powerConsumptionData, setPowerConsumptionData] = useState<PowerPoint[]>([]);
  const [renewableEnergyData, setRenewableEnergyData] = useState<RenewablePoint[]>([]);
  const [gridLoadData, setGridLoadData] = useState<GridLoadPoint[]>([]);
  const [energyDistributionData, setEnergyDistributionData] = useState<SourcePoint[]>([]);
  const [fluctuationData, setFluctuationData] = useState<FluctuationPoint[]>([]);
  const [riskIndexData, setRiskIndexData] = useState<RiskPoint[]>([]);
  const [rawSensorData, setRawSensorData] = useState(buildEmptyRawSensorData());

  useEffect(() => {
    if (!job || status !== "running") {
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const [nextJob, summary] = await Promise.all([
          fetchJob(job.id),
          fetchDashboardSummary(job.id),
        ]);

        if (cancelled) {
          return;
        }

        setJob(nextJob);
        applySummary(summary);

        if (nextJob.status === "completed") {
          setStatus("completed");
          return;
        }

        if (nextJob.status === "failed") {
          setStatus("idle");
          setError(nextJob.errorMessage ?? "Backend processing failed.");
          return;
        }
      } catch (pollError) {
        if (!cancelled) {
          const message =
            pollError instanceof Error
              ? pollError.message
              : "Unable to poll backend analytics.";
          setError(message);
          setStatus("idle");
        }
      }
    }

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [job, status]);

  async function hydrateSummary(jobId: string) {
    const summary = await fetchDashboardSummary(jobId);
    applySummary(summary);
  }

  function applySummary(summary: BackendSummary) {
    setAssistantContext(summary.assistantContext);
    setStats({
      latestPrice: summary.kpis.latestPrice,
      overloadEvents: summary.kpis.overloadEvents,
      overloadTimestamps: summary.assistantContext.faults.recentOverloadTimestamps,
      renewableShare: summary.kpis.renewableShare,
      transformerFaultTimestamps: summary.assistantContext.faults.recentTransformerFaultTimestamps,
      transformerFaults: summary.kpis.transformerFaults,
    });
    setPowerConsumptionData(summary.series.powerConsumption);
    setRenewableEnergyData(summary.series.renewableEnergy);
    setGridLoadData(summary.series.gridLoad);
    setEnergyDistributionData(summary.series.energyDistribution);
    setFluctuationData(summary.series.fluctuation);
    setRiskIndexData(summary.series.riskIndex);
    setRawSensorData(summary.rawSensorData);
  }

  async function uploadFile(file: File) {
    setIsUploading(true);
    setError("");
    setChatSessionKey((current) => current + 1);

    try {
      const ingestResult = await ingestCsvFile(file);
      const uploadedJob = await fetchJob(ingestResult.jobId);

      setFileName(file.name);
      setJob(uploadedJob);
      setStatus("idle");
      setAssistantContext(buildEmptyAssistantContext());
      setStats(buildEmptyStats());
      setPowerConsumptionData([]);
      setRenewableEnergyData([]);
      setGridLoadData([]);
      setEnergyDistributionData([]);
      setFluctuationData([]);
      setRiskIndexData([]);
      setRawSensorData(buildEmptyRawSensorData());
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unable to upload the CSV file.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function start() {
    if (!job) {
      setError("Upload a CSV file before loading backend analytics.");
      return;
    }

    setError("");
    setStatus("running");
  }

  function pause() {
    setStatus((current) => (current === "running" ? "paused" : current));
  }

  async function resume() {
    if (!job) {
      return;
    }

    setError("");
    setStatus("running");
  }

  async function reset() {
    setChatSessionKey((current) => current + 1);
    setStatus("idle");
    setError("");
    setFileName("");
    setJob(null);
    setAssistantContext(buildEmptyAssistantContext());
    setStats(buildEmptyStats());
    setPowerConsumptionData([]);
    setRenewableEnergyData([]);
    setGridLoadData([]);
    setEnergyDistributionData([]);
    setFluctuationData([]);
    setRiskIndexData([]);
    setRawSensorData(buildEmptyRawSensorData());
  }

  const processedCount = job?.rowsProcessed ?? 0;
  const totalRows = job?.rowsReceived ?? 0;
  const progress =
    totalRows === 0 ? 0 : Math.round((processedCount / totalRows) * 100);

  const hasBackendData = useMemo(
    () => powerConsumptionData.length > 0 || fluctuationData.length > 0 || riskIndexData.length > 0,
    [fluctuationData.length, powerConsumptionData.length, riskIndexData.length]
  );

  return {
    assistantContext,
    chatSessionKey,
    energyDistributionData,
    error,
    fileName,
    fluctuationData,
    gridLoadData,
    hasBackendData,
    isLoading,
    isUploading,
    pause,
    powerConsumptionData,
    processedCount,
    progress,
    rawSensorData,
    renewableEnergyData,
    reset,
    resume,
    riskIndexData,
    start,
    stats,
    status,
    totalRows,
    uploadFile,
  };
}
