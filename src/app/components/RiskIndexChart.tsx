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

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <ShieldAlert className="size-5 text-red-600" />
        <div>
          <h3>Risk Index</h3>
          <p className="text-sm text-slate-600">Rolling fault &amp; overload risk (0–100)</p>
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
              A derived score (0–100) calculated from the frequency of overload and transformer
              fault events in the last 20 records. Higher values indicate more recent faults.
              Medium risk starts at 25; high risk starts at 50.
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
          <Tooltip formatter={(value: number) => [value, "Risk Index"]} />
          <ReferenceLine
            y={25}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: "Medium", position: "right", fontSize: 11 }}
          />
          <ReferenceLine
            y={50}
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
      {data.length === 0 && (
        <p className="text-center text-sm text-slate-500 mt-4">
          Start the simulation to see risk data.
        </p>
      )}
    </Card>
  );
}
