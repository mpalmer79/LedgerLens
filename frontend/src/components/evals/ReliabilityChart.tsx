"use client";

import {
  CartesianGrid,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type Point = {
  bucket: string;
  count: number;
  predicted_confidence_mean: number;
  actual_accuracy: number;
};

type Props = {
  data: Point[];
};

function pct(v: number) {
  return `${(v * 100).toFixed(0)}%`;
}

export function ReliabilityChart({ data }: Props) {
  // Filter to only populated buckets; an empty bucket plotted at (0,0) is misleading.
  const populated = data.filter((d) => d.count > 0);
  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, left: 24, bottom: 32 }}>
          <CartesianGrid stroke="var(--surface-border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="predicted_confidence_mean"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.6, 0.75, 0.9, 1]}
            tickFormatter={pct}
            stroke="var(--text-subtle)"
            fontSize={12}
          >
            <Label value="Predicted confidence" offset={-16} position="insideBottom" fontSize={12} />
          </XAxis>
          <YAxis
            type="number"
            dataKey="actual_accuracy"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={pct}
            stroke="var(--text-subtle)"
            fontSize={12}
          >
            <Label
              value="Actual accuracy"
              angle={-90}
              offset={-12}
              position="insideLeft"
              style={{ textAnchor: "middle" }}
              fontSize={12}
            />
          </YAxis>
          <ZAxis type="number" dataKey="count" range={[80, 480]} name="bucket size" />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: 1, y: 1 },
            ]}
            stroke="var(--text-subtle)"
            strokeDasharray="4 4"
            ifOverflow="extendDomain"
          />
          <ReferenceLine
            x={0.6}
            stroke="var(--accent-500)"
            strokeDasharray="2 4"
            label={{ value: "review", position: "top", fontSize: 10, fill: "var(--accent-500)" }}
          />
          <ReferenceLine
            x={0.9}
            stroke="var(--brand-700)"
            strokeDasharray="2 4"
            label={{ value: "auto-post", position: "top", fontSize: 10, fill: "var(--brand-700)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--surface-border)", strokeDasharray: "2 2" }}
            contentStyle={{
              background: "var(--surface-panel)",
              border: "1px solid var(--surface-border)",
              borderRadius: 6,
              fontSize: 13,
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = Number(value);
              const n = String(name);
              if (n === "predicted_confidence_mean") return [pct(v), "Predicted"];
              if (n === "actual_accuracy") return [pct(v), "Actual"];
              if (n === "count") return [String(v), "Predictions"];
              return [String(v), n];
            }}
          />
          <Scatter data={populated} fill="var(--brand-600)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
