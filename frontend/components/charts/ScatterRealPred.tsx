"use client";

import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

export function ScatterRealPred({
  data,
  height = 320,
}: {
  data: { y_real: number; y_pred: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid stroke="#e2e8f0" />
        <XAxis type="number" dataKey="y_real" name="Real" tick={{ fontSize: 12 }} />
        <YAxis type="number" dataKey="y_pred" name="Predicho" tick={{ fontSize: 12 }} />
        <ZAxis range={[20, 20]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={data} fill="#2563eb" fillOpacity={0.4} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
