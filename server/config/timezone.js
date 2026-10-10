// Vercel's servers run on UTC time. This app works out "today", the daily bill number
// and every report range in the server's local time, so pin it to Pakistan time.
// Import this file first, before anything that creates dates.
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Karachi";
