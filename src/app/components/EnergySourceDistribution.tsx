import { Card } from "./ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

const data = [
  { name: "Solar", value: 28, color: "#fbbf24" },
  { name: "Wind", value: 14, color: "#22d3ee" },
  { name: "Hydro", value: 8, color: "#60a5fa" },
  { name: "Natural Gas", value: 35, color: "#94a3b8" },
  { name: "Coal", value: 15, color: "#64748b" },
];

const COLORS = data.map(d => d.color);

export function EnergySourceDistribution() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <PieChartIcon className="size-5 text-orange-600" />
        <div>
          <h3>Energy Source Distribution</h3>
          <p className="text-sm text-slate-600">Current generation mix (%)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <p className="text-sm text-slate-600">Renewable</p>
          <p className="text-2xl text-green-600">50%</p>
        </div>
        <div className="bg-slate-100 p-3 rounded-lg">
          <p className="text-sm text-slate-600">Fossil Fuels</p>
          <p className="text-2xl text-slate-600">50%</p>
        </div>
      </div>
    </Card>
  );
}
