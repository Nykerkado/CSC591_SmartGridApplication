import { Card } from "./ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const data = [
  { date: "Mon", solar: 850, wind: 420, hydro: 300 },
  { date: "Tue", solar: 920, wind: 380, hydro: 300 },
  { date: "Wed", solar: 880, wind: 450, hydro: 310 },
  { date: "Thu", solar: 950, wind: 410, hydro: 295 },
  { date: "Fri", solar: 900, wind: 480, hydro: 305 },
  { date: "Sat", solar: 870, wind: 520, hydro: 300 },
  { date: "Sun", solar: 930, wind: 490, hydro: 310 },
];

export function RenewableEnergyChart() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="size-5 text-green-600" />
        <div>
          <h3>Renewable Energy Sources</h3>
          <p className="text-sm text-slate-600">Weekly generation by type (MW)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="solar" stackId="1" stroke="#f59e0b" fill="#fbbf24" name="Solar" />
          <Area type="monotone" dataKey="wind" stackId="1" stroke="#06b6d4" fill="#22d3ee" name="Wind" />
          <Area type="monotone" dataKey="hydro" stackId="1" stroke="#3b82f6" fill="#60a5fa" name="Hydro" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}