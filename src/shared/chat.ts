export const DASHBOARD_ROLE_LABELS = {
  "grid-operator": "Grid Operator",
  "energy-analyst": "Energy Analyst",
  "system-admin": "System Administrator",
} as const;

export type DashboardRole = keyof typeof DASHBOARD_ROLE_LABELS;

export type SimulationStatus = "idle" | "running" | "paused" | "completed";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantContext = {
  meta: {
    fileName: string;
    status: SimulationStatus;
    processedCount: number;
    totalRows: number;
    progress: number;
    startTimestamp: string | null;
    endTimestamp: string | null;
    latestTimestamp: string | null;
  };
  kpis: {
    renewableShare: number;
    latestPrice: number;
    overloadEvents: number;
    transformerFaults: number;
  };
  power: {
    minConsumption: {
      value: number;
      timestamp: string | null;
    };
    maxConsumption: {
      value: number;
      timestamp: string | null;
    };
    averageConsumption: number;
    peakDemand: {
      value: number;
      timestamp: string | null;
    };
    forecastGap: {
      averageAbsoluteGap: number;
      averageSignedGap: number;
      maximumAbsoluteGap: {
        value: number;
        timestamp: string | null;
      };
    };
  };
  price: {
    min: number;
    max: number;
    average: number;
    latest: number;
  };
  renewables: {
    solarTotal: number;
    windTotal: number;
    bestSolarPeriod: {
      timestamp: string | null;
      value: number;
    };
    bestWindPeriod: {
      timestamp: string | null;
      value: number;
    };
  };
  grid: {
    averageLoad: number;
    averageCapacity: number;
    minimumHeadroom: {
      value: number;
      timestamp: string | null;
    };
    peakDemandWindow: {
      timestamp: string | null;
      load: number;
      capacity: number;
      headroom: number;
    };
  };
  faults: {
    recentOverloadTimestamps: string[];
    recentTransformerFaultTimestamps: string[];
  };
  series: {
    powerConsumption: Array<{
      time: string;
      timestamp: string;
      consumption: number;
      forecast: number;
      overloadCondition: number;
      transformerFault: number;
    }>;
    renewableEnergy: Array<{
      date: string;
      solar: number;
      wind: number;
    }>;
    gridLoad: Array<{
      hour: string;
      timestamp: string;
      load: number;
      capacity: number;
    }>;
    energyDistribution: Array<{
      name: string;
      value: number;
      color: string;
    }>;
  };
};

export type ChatQueryRequest = {
  role: DashboardRole;
  question: string;
  history: ChatHistoryMessage[];
  context: AssistantContext;
};

export type ChatQueryResponse = {
  answer: string;
  supported: boolean;
  grounding: string[];
  followUps: string[];
  unsupportedReason?: string | null;
};
