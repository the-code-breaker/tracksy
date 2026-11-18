import { useId } from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

export function BrandMark({ size = 42 }: { size?: number }) {
  const id = useId();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      accessibilityLabel="Tracksy logo"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop stopColor="#10b69a" />
          <Stop offset="1" stopColor="#005c55" />
        </LinearGradient>
      </Defs>
      <Rect x="1" y="1" width="46" height="46" rx="13" fill={`url(#${id})`} />
      <Path
        d="M15 24 27 12"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="28" cy="33" r="5" fill="#ffffff" />
    </Svg>
  );
}

export function Atmosphere({ dark = true }: { dark?: boolean }) {
  const id = useId();
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMin slice"
        viewBox="0 0 1200 1000"
      >
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop stopColor={dark ? "#302052" : "#e9dffa"} stopOpacity=".65" />
            <Stop
              offset=".55"
              stopColor={dark ? "#10132f" : "#f6f4fd"}
              stopOpacity="0"
            />
            <Stop
              offset="1"
              stopColor={dark ? "#163b45" : "#d9f2ef"}
              stopOpacity=".4"
            />
          </LinearGradient>
        </Defs>
        <Rect width="1200" height="1000" fill={`url(#${id})`} />
        {Array.from({ length: 32 }, (_, i) => (
          <Circle
            key={i}
            cx={(i * 167 + 46) % 1200}
            cy={(i * 119 + 21) % 900}
            r={i % 5 === 0 ? 2.2 : 1.2}
            fill={dark ? "#bbb2eb" : "#8d73c8"}
            opacity={i % 3 === 0 ? 0.32 : 0.14}
          />
        ))}
      </Svg>
    </View>
  );
}

export function SharedLifeArt({ height = 270 }: { height?: number }) {
  const id = useId();
  return (
    <View
      pointerEvents="none"
      style={{ height, width: "100%" }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 430 290">
        <Defs>
          <LinearGradient id={`${id}wallet`} x1="0" y1="0" x2="1" y2="1">
            <Stop stopColor="#b99afa" />
            <Stop offset="1" stopColor="#7153b6" />
          </LinearGradient>
          <LinearGradient id={`${id}coin`} x1="0" y1="0" x2="1" y2="1">
            <Stop stopColor="#ffe9a8" />
            <Stop offset="1" stopColor="#eeb442" />
          </LinearGradient>
          <LinearGradient id={`${id}card`} x1="0" y1="0" x2="1" y2="1">
            <Stop stopColor="#b6efdb" />
            <Stop offset="1" stopColor="#62bfb1" />
          </LinearGradient>
        </Defs>
        <Circle cx="224" cy="143" r="112" fill="#a78ae7" opacity=".09" />
        <Circle
          cx="224"
          cy="143"
          r="89"
          fill="none"
          stroke="#bba1f8"
          strokeOpacity=".18"
          strokeDasharray="4 8"
        />
        <Ellipse
          cx="224"
          cy="250"
          rx="118"
          ry="16"
          fill="#05071e"
          opacity=".23"
        />
        <G rotation="-12" origin="214,152">
          <Rect
            x="149"
            y="64"
            width="134"
            height="96"
            rx="17"
            fill={`url(#${id}card)`}
            stroke="#dbfff1"
            strokeWidth="2"
          />
          <Rect x="165" y="83" width="32" height="21" rx="5" fill="#e4f7b5" />
          <Path
            d="M213 92h45M165 121h44"
            stroke="#286e6a"
            strokeWidth="6"
            strokeLinecap="round"
            opacity=".5"
          />
        </G>
        <Rect
          x="125"
          y="119"
          width="195"
          height="115"
          rx="25"
          fill="#4f368e"
          stroke="#564080"
          strokeWidth="2"
        />
        <Rect
          x="121"
          y="109"
          width="195"
          height="115"
          rx="25"
          fill={`url(#${id}wallet)`}
          stroke="#d5bcff"
          strokeWidth="2"
        />
        <Path
          d="M139 126h155"
          stroke="#ead8ff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".4"
        />
        <Path
          d="M284 145h30c9 0 16 7 16 16v15c0 9-7 16-16 16h-30c-13 0-23-10-23-23s10-24 23-24Z"
          fill="#4e397e"
          stroke="#d5bcff"
          strokeWidth="2"
        />
        <Circle cx="284" cy="168" r="6" fill="#ffdf83" />
        <G rotation="13" origin="326,73">
          <Ellipse cx="326" cy="78" rx="32" ry="34" fill="#bc8535" />
          <Circle
            cx="326"
            cy="72"
            r="32"
            fill={`url(#${id}coin)`}
            stroke="#ffedb7"
            strokeWidth="2"
          />
          <Circle
            cx="326"
            cy="72"
            r="24"
            fill="none"
            stroke="#c5963b"
            strokeWidth="2"
          />
          <Path
            d="M315 66h20m-10 0v17m-7-4 7 6 11-15"
            stroke="#a27329"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </G>
        <G rotation="-18" origin="112,204">
          <Ellipse cx="112" cy="211" rx="28" ry="30" fill="#b98233" />
          <Circle
            cx="112"
            cy="204"
            r="29"
            fill={`url(#${id}coin)`}
            stroke="#ffedb7"
            strokeWidth="2"
          />
          <Circle
            cx="112"
            cy="204"
            r="21"
            fill="none"
            stroke="#c5963b"
            strokeWidth="2"
          />
          <Path
            d="M103 200h18m-9-6v20"
            stroke="#a27329"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </G>
        <Circle
          cx="102"
          cy="79"
          r="23"
          fill="#2c3459"
          stroke="#98a1d9"
          strokeWidth="1.5"
        />
        <Circle cx="102" cy="74" r="7" fill="#d8c5fb" />
        <Path d="M90 91c0-13 24-13 24 0" fill="#a58bd7" />
        <Circle
          cx="342"
          cy="219"
          r="22"
          fill="#274649"
          stroke="#8ad6c0"
          strokeWidth="1.5"
        />
        <Path
          d="m333 219 6 6 12-13"
          stroke="#a2efd1"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path d="m348 135 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#a5e8ed" />
        <Path d="m171 39 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#ffdf83" />
        <Circle cx="76" cy="144" r="3" fill="#e0c9ff" />
        <Circle cx="280" cy="30" r="3" fill="#a5e8ed" />
        <Path
          d="M73 113c-18 48 2 94 37 115M353 100c20 33 17 56 7 77"
          stroke="#bca2ee"
          strokeOpacity=".28"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          fill="none"
        />
      </Svg>
    </View>
  );
}
