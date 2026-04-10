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
} from "recharts";
import { Activity, MapPin } from "lucide-react";
import type { PowerPoint } from "../lib/smartGrid";
import type { DotProps } from "recharts";

type PowerConsumptionChartProps = {
  data: PowerPoint[];
};

function EventPin({
  cx,
  cy,
  payload,
  color,
  eventKey,
}: DotProps & { color: string; eventKey: "overloadCondition" | "transformerFault" }) {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    !payload ||
    !(payload as PowerPoint)[eventKey]
  ) {
    return null;
  }

  return (
    <g transform={`translate(${cx - 8}, ${cy - 22})`}>
      <MapPin size={16} color={color} fill={color} strokeWidth={1.75} />
    </g>
  );
}

export function PowerConsumptionChart({ data }: PowerConsumptionChartProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="size-5 text-blue-600" />
        <div>
          <h3>Power Consumption</h3>
          <p className="text-sm text-slate-600">Real-time vs. Forecast (MW)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="consumption"
            stroke="#2563eb"
            strokeWidth={2}
            name="Actual"
            dot={false}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="consumption"
            stroke="transparent"
            name="Overload"
            legendType="circle"
            dot={<EventPin color="#dc2626" eventKey="overloadCondition" />}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="consumption"
            stroke="transparent"
            name="Transformer Fault"
            legendType="circle"
            dot={<EventPin color="#f97316" eventKey="transformerFault" />}
            activeDot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 5"
            name="Forecast"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Upload and start a simulation to populate power consumption data.
        </p>
      ) : null}
    </Card>
  );
}
