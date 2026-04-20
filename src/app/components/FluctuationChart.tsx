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
import { Activity, AlertTriangle, Info, TriangleAlert } from "lucide-react";
import type { FluctuationPoint } from "../lib/smartGrid";
import type { DotProps } from "recharts";

type FluctuationChartProps = {
  data: FluctuationPoint[];
};

function EventMarker({
  color,
  cx,
  cy,
  dataKey,
  payload,
}: DotProps & { color: string; dataKey: "overloadCount" | "transformerFaultCount" }) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    !payload ||
    !(payload as FluctuationPoint)[dataKey]
  ) {
    return null;
  }

  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
}

export function FluctuationChart({ data }: FluctuationChartProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="size-5 text-yellow-500" />
        <div>
          <h3>Fluctuation Score</h3>
          <p className="text-sm text-slate-600">Backend-derived grid instability score by time window</p>
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
              The backend aggregates each time window and computes a fluctuation score from
              average voltage fluctuation, reactive power, and power-factor drop. Fault and
              overload markers show windows with abnormal events.
            </div>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[0, 100]} />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === "Fluctuation Score") return [value, name];
              if (name === "Avg Voltage Fluctuation") return [`${value}%`, name];
              return [value, name];
            }}
          />
          <Legend />
          <ReferenceLine
            y={40}
            stroke="#f59e0b"
            strokeDasharray="4 4"
            label={{ value: "Watch 40", position: "right", fontSize: 11 }}
          />
          <ReferenceLine
            y={70}
            stroke="#ef4444"
            strokeDasharray="4 4"
            label={{ value: "Critical 70", position: "right", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="fluctuationScore"
            stroke="#f59e0b"
            strokeWidth={2}
            name="Fluctuation Score"
            dot={false}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="fluctuationScore"
            stroke="transparent"
            name="Overload Event"
            legendType="circle"
            dot={<EventMarker color="#dc2626" dataKey="overloadCount" />}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="fluctuationScore"
            stroke="transparent"
            name="Transformer Fault Event"
            legendType="circle"
            dot={<EventMarker color="#f97316" dataKey="transformerFaultCount" />}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avgVoltageFluctuation"
            stroke="#64748b"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Avg Voltage Fluctuation"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <AlertTriangle className="size-3 text-red-600" />
          <span>
            Overload windows: {data.reduce((sum, point) => sum + (point.overloadCount > 0 ? 1 : 0), 0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <TriangleAlert className="size-3 text-orange-500" />
          <span>
            Fault windows: {data.reduce((sum, point) => sum + (point.transformerFaultCount > 0 ? 1 : 0), 0)}
          </span>
        </div>
      </div>
      {data.length === 0 && (
        <p className="text-center text-sm text-slate-500 mt-4">
          Start the simulation to see backend fluctuation analytics.
        </p>
      )}
    </Card>
  );
}
