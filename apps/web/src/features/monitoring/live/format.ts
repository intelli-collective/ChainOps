export const short = (value: string) =>
  value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
export const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "UTC",
        dateStyle: "medium",
        timeStyle: "medium",
      }) + " UTC"
    : "Not available";
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Unable to save. Please try again.";
