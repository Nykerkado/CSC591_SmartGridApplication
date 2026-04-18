import { useState } from "react";
import { Card } from "./ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, Info } from "lucide-react";
import type { FluctuationPoint } from "../lib/smartGrid";

type FluctuationChartProps = {
  data: FluctuationPoint[];
};

export function FluctuationChart({ data }: FluctuationChartProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="size-5 text-yellow-500" />
        <div>
          <h3>Voltage Fluctuation</h3>
          <p className="text-sm text-slate-600">Voltage deviation over time (%)</p>
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
              Shows how much the grid voltage is deviating from its normal level over time.
              A warning threshold is set at 5% and a critical threshold at 10%.
              Sustained high fluctuation can stress equipment and signal instability.
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis unit="%" />
          <Tooltip formatter={(value: number) => [`${value}%`, "Fluctuation"]} />
          <Legend />
          <ReferenceLine
            y={5}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: "Warn 5%", position: "right", fontSize: 11 }}
          />
          <ReferenceLine
            y={10}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: "Critical 10%", position: "right", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="voltageFluctuation"
            stroke="#f59e0b"
            strokeWidth={2}
            name="Voltage Fluctuation"
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {data.length === 0 && (
        <p className="text-center text-sm text-slate-500 mt-4">
          Start the simulation to see fluctuation data.
        </p>
      )}
    </Card>
  );
}
