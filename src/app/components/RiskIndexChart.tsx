import { useState } from "react";
import { Card } from "./ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ShieldAlert, Info } from "lucide-react";
import type { RiskPoint } from "../lib/smartGrid";

type RiskIndexChartProps = {
  data: RiskPoint[];
};

export function RiskIndexChart({ data }: RiskIndexChartProps) {
  const [showInfo, setShowInfo] = useState(false);
  const latestRisk = data.at(-1);
  const latestRiskColor =
    latestRisk?.riskLevel === "high"
      ? "text-red-600"
      : latestRisk?.riskLevel === "medium"
      ? "text-amber-600"
      : "text-emerald-600";

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <ShieldAlert className="size-5 text-red-600" />
        <div>
          <h3>Risk Index</h3>
          <p className="text-sm text-slate-600">Backend-derived composite risk score (0-100)</p>
        </div>
        <div className="relative ml-auto">
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="text-slate-400 hover:text-slate-600"
            type="button"
            aria-label="Chart info"
          >
            <Info className="size-4" />
          </button>
          {showInfo && (
            <div className="absolute right-0 top-6 z-50 w-64 rounded-md bg-slate-800 text-white text-xs p-3 shadow-lg leading-relaxed">
              The backend computes this risk score from overload frequency, transformer fault
              frequency, and normalized fluctuation over the recent time window. The API also
              returns a risk level for each point.
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 100]} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === "Risk Index") return [value, name];
              return [`${value}`, name];
            }}
          />
          <ReferenceLine
            y={34}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: "Medium", position: "right", fontSize: 11 }}
          />
          <ReferenceLine
            y={67}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: "High", position: "right", fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="riskIndex"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#riskGradient)"
            name="Risk Index"
            dot={false}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {latestRisk ? (
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg bg-slate-100 px-3 py-2">
            <p className="text-slate-500">Latest Risk</p>
            <p>{latestRisk.riskIndex}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-2">
            <p className="text-slate-500">Risk Level</p>
            <p className={latestRiskColor}>{latestRisk.riskLevel}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-2">
            <p className="text-slate-500">Overload Freq</p>
            <p>{latestRisk.overloadFrequency}</p>
          </div>
        </div>
      ) : null}
      {data.length === 0 && (
        <p className="text-center text-sm text-slate-500 mt-4">
          Start the simulation to see backend risk analytics.
        </p>
      )}
    </Card>
  );
}
