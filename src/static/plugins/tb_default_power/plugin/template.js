if (!batteries.length) {
  return Icon({ name: "TbPlugConnected" });
}

const averagePercentage = batteries.reduce((total, battery) => total + battery.percentage, 0) / batteries.length;

// `power.acLineStatus === 1` only means the adapter is plugged in: a laptop in a charge-limit or
// care mode reports "full"/"discharging" while still plugged, so it must not be shown as charging.
const isCharging = batteries.some((battery) => {
  return battery.state === "charging";
});
const isSmartChargeActive = batteries.some((battery) => battery.smartCharging);

let group = [];

if (powerMode === "BetterBattery" || powerMode === "BatterySaver") {
  group.push(Icon({ name: "IoLeaf" }));
  group.push(" ");
} else if (powerMode === "HighPerformance" || powerMode === "MaxPerformance") {
  group.push(Icon({ name: "IoSpeedometer" }));
  group.push(" ");
} else if (powerMode === "GameMode") {
  group.push(Icon({ name: "IoGameController" }));
  group.push(" ");
} else if (powerMode === "MixedReality") {
  group.push(Icon({ name: "TbCardboardsFilled" }));
  group.push(" ");
}

if (isSmartChargeActive) {
  group.push(Icon({ name: "IoHeart" }));
  group.push(" ");
}

// The charging state lives inside the battery icon (bolt), with no extra bolt next to it: that way
// "plugged in but not charging" can not be read as charging. Charging uses the dedicated charging
// icon, the level is still readable from the percentage next to it.
if (isCharging) {
  group.push(Icon({ name: "BsBatteryCharging" }));
} else if (averagePercentage > 90) {
  group.push(Icon({ name: "PiBatteryFullFill" }));
} else if (averagePercentage > 66) {
  group.push(Icon({ name: "PiBatteryHighFill" }));
} else if (averagePercentage > 33) {
  group.push(Icon({ name: "PiBatteryMediumFill" }));
} else if (averagePercentage > 5) {
  group.push(Icon({ name: "PiBatteryLowFill" }));
} else {
  group.push(Icon({ name: "PiBatteryWarning" }));
}

group.push(" ");
group.push(averagePercentage);
group.push("%");

return group;
