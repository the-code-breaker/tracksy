import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Label, useColors } from "./ui";
import { formatMoney } from "@tracksy/finance";
import type { Currency } from "@tracksy/domain";
const palette = [
  "#169c89",
  "#5b8ee3",
  "#f2b652",
  "#9a82cd",
  "#8dcfc7",
  "#b4c0c9",
];
export function SpendingDonut({
  series,
  currency,
}: {
  series: { label: string; amount: number }[];
  currency: Currency;
}) {
  const c = useColors(),
    total = series.reduce((s, r) => s + r.amount, 0),
    circumference = 2 * Math.PI * 58;
  let offset = 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 18,
      }}
    >
      <View
        accessibilityLabel={`Total spending ${formatMoney(total, currency)}`}
        style={{
          width: 154,
          height: 154,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={154}
          height={154}
          style={{ position: "absolute" }}
          viewBox="0 0 154 154"
        >
          <Circle
            cx={77}
            cy={77}
            r={58}
            stroke={c.surfaceAlt}
            strokeWidth={20}
            fill="none"
          />
          {series
            .filter((r) => r.amount > 0)
            .map((r, i) => {
              const dash = total ? (r.amount / total) * circumference : 0,
                start = offset;
              offset += dash;
              return (
                <Circle
                  key={r.label}
                  cx={77}
                  cy={77}
                  r={58}
                  stroke={palette[i % palette.length]}
                  strokeWidth={20}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-start}
                  rotation={-90}
                  origin="77,77"
                  fill="none"
                />
              );
            })}
        </Svg>
        <View style={{ maxWidth: 110, alignItems: "center", gap: 2 }}>
          <Label
            size={total > 9999999 ? 13 : 17}
            weight="700"
            style={{ textAlign: "center" }}
          >
            {formatMoney(total, currency)}
          </Label>
          <Label size={10} muted>
            Total
          </Label>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 120, gap: 11 }}>
        {series.length ? (
          series.map((r, i) => (
            <View
              key={r.label}
              style={{ flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: palette[i % palette.length],
                }}
              />
              <Label size={11} muted style={{ flex: 1 }}>
                {r.label}
              </Label>
              <Label size={11} weight="600">
                {total ? Math.round((r.amount / total) * 100) : 0}%
              </Label>
            </View>
          ))
        ) : (
          <Label size={12} muted>
            No expenses yet
          </Label>
        )}
      </View>
    </View>
  );
}
export function MonthlyBars({
  series,
  currency,
}: {
  series: { label: string; amount: number }[];
  currency: Currency;
}) {
  const c = useColors(),
    max = Math.max(1, ...series.map((r) => r.amount));
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: "row",
          height: 125,
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        {series.map((row) => (
          <View
            key={row.label}
            accessibilityLabel={`${row.label}: ${formatMoney(row.amount, currency)}`}
            style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 7 }}
          >
            <View
              style={{
                height: 96,
                width: "100%",
                justifyContent: "flex-end",
                borderBottomWidth: 1,
                borderColor: c.border,
              }}
            >
              <View
                style={{
                  height: row.amount ? Math.max(4, (row.amount / max) * 92) : 2,
                  backgroundColor: c.primary,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  opacity: row.amount ? 0.75 : 0.15,
                }}
              />
            </View>
            <Label size={10} muted>
              {row.label}
            </Label>
          </View>
        ))}
      </View>
      <Label size={10} muted>
        Recorded expenses · {currency} · no currency conversion
      </Label>
    </View>
  );
}
