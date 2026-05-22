"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = {
  slice: string;
  stub: number;
  haiku: number;
};

type Props = {
  data: Row[];
};

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function ComparisonChart({ data }: Props) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 16, right: 24, left: 24, bottom: 16 }}
          barGap={6}
        >
          <CartesianGrid stroke="var(--surface-border)" strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 1]}
            tickFormatter={pct}
            stroke="var(--text-subtle)"
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="slice"
            stroke="var(--text-subtle)"
            fontSize={13}
            width={120}
          />
          <Tooltip
            formatter={(value: number) => pct(value)}
            contentStyle={{
              background: "var(--surface-panel)",
              border: "1px solid var(--surface-border)",
              borderRadius: 6,
              fontSize: 13,
            }}
            cursor={{ fill: "var(--surface-sunken)" }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="stub" name="Stub baseline" fill="var(--text-subtle)" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={`stub-${i}`} />
            ))}
          </Bar>
          <Bar
            dataKey="haiku"
            name="Claude Haiku 4.5"
            fill="var(--brand-600)"
            radius={[0, 4, 4, 0]}
          >
            {data.map((_, i) => (
              <Cell key={`haiku-${i}`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
