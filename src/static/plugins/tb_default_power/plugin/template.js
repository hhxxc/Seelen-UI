if (!batteries.length) {
  return icon("TbPlugConnected");
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
  group.push(icon("IoLeaf"));
  group.push(" ");
} else if (powerMode === "HighPerformance" || powerMode === "MaxPerformance") {
  group.push(icon("IoSpeedometer"));
  group.push(" ");
} else if (powerMode === "GameMode") {
  group.push(icon("IoGameController"));
  group.push(" ");
} else if (powerMode === "MixedReality") {
  group.push(icon("TbCardboardsFilled"));
  group.push(" ");
}

if (isSmartChargeActive) {
  group.push(icon("IoHeart"));
  group.push(" ");
}

// The charging state lives inside the battery icon (bolt), with no extra bolt next to it: that way
// "plugged in but not charging" can not be read as charging. Charging uses the dedicated charging
// icon, the level is still readable from the percentage next to it.
if (isCharging) {
  group.push(icon("BsBatteryCharging"));
} else if (averagePercentage > 90) {
  group.push(icon("PiBatteryFullFill"));
} else if (averagePercentage > 66) {
  group.push(icon("PiBatteryHighFill"));
} else if (averagePercentage > 33) {
  group.push(icon("PiBatteryMediumFill"));
} else if (averagePercentage > 5) {
  group.push(icon("PiBatteryLowFill"));
} else {
  group.push(icon("PiBatteryWarning"));
}

group.push(" ");
group.push(averagePercentage);
group.push("%");

return group;
