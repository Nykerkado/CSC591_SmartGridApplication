import { Card } from "./ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";

const data = [
  { hour: "6am", load: 2100, capacity: 5000 },
  { hour: "9am", load: 3200, capacity: 5000 },
  { hour: "12pm", load: 3800, capacity: 5000 },
  { hour: "3pm", load: 3500, capacity: 5000 },
  { hour: "6pm", load: 4200, capacity: 5000 },
  { hour: "9pm", load: 3900, capacity: 5000 },
  { hour: "12am", load: 2400, capacity: 5000 },
];

export function GridLoadChart() {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="size-5 text-purple-600" />
        <div>
          <h3>Grid Load Analysis</h3>
          <p className="text-sm text-slate-600">Current load vs. capacity (MW)</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="hour" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="load" fill="#8b5cf6" name="Current Load" />
          <Bar dataKey="capacity" fill="#e9d5ff" name="Total Capacity" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}