import { Card } from "./ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

const data = [
  { time: "00:00", consumption: 2400, forecast: 2300 },
  { time: "04:00", consumption: 2100, forecast: 2000 },
  { time: "08:00", consumption: 3200, forecast: 3100 },
  { time: "12:00", consumption: 3800, forecast: 3900 },
  { time: "16:00", consumption: 3500, forecast: 3600 },
  { time: "20:00", consumption: 4200, forecast: 4100 },
  { time: "23:59", consumption: 3000, forecast: 3100 },
];

export function PowerConsumptionChart() {
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
          <Line type="monotone" dataKey="consumption" stroke="#2563eb" strokeWidth={2} name="Actual" />
          <Line type="monotone" dataKey="forecast" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="Forecast" />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}