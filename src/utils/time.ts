export function getSecondsDiff(startDate: string, endDate: string) {
  return Math.round(Math.abs(Date.parse(endDate) - Date.parse(startDate)) / 1000);
}
export function elapsedTime(seconds: number) {
  if (!seconds) {
    return {};
  }

  if (seconds < 120) {
    return {
      diff: 1,
      label: `${seconds}s`,
    };
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 10) {
    return {
      diff: 1,
      label: `${minutes}m${seconds - minutes * 60}s`,
    };
  }

  const hours = Math.floor(seconds / 3600);

  if (hours < 3) {
    return {
      diff: 60,
      label: `${minutes}m`,
    };
  }

  const days = Math.floor(seconds / (3600 * 24));

  if (days > 1) {
    return {
      diff: 60,
      label: `${days}d${hours - days * 24}h`,
    };
  }

  if (hours > 7) {
    return {
      diff: 60,
      label: `${hours}h`,
    };
  }

  return {
    diff: 60,
    label: `${hours}h${minutes - hours * 60}m`,
  };
}
