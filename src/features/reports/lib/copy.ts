export const reportsCopy = {
  rangeNote: "Trip and alert numbers cover the selected range; the links open the full lists.",
  loadingCancelled: "Loading cancelled",
  invalidRange: {
    title: "That range isn't valid",
    description: "Check the start and end time, then try again.",
    action: "Use last 7 days",
  },
  offlineEmpty: {
    title: "This range isn't available offline",
    description: "Reconnect to load the report.",
  },
  zero: {
    title: "No activity in this range",
    description: "Choose a wider range to see trips and alerts.",
  },
  alertsEmpty: {
    title: "No alerts in this range",
    description: "Nothing was raised during this period.",
  },
  breakdownUnavailable: "The alert breakdown isn't available for this range.",
} as const;
