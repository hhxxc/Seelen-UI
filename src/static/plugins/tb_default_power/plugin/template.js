if (!batteries.length) {
  return Icon({ name: "TbPlugConnected" });
}

const averagePercentage = batteries.reduce((total, battery) => total + battery.percentage, 0) / batteries.length;

// The bolt means "the machine is on AC power": a laptop in a care/charge-limit mode reports
// "full" while plugged in, and hiding the bolt there looks like the charger was lost.
const isCharging = power.acLineStatus === 1 ||
  batteries.some((battery) => {
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
