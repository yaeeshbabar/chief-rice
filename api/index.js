// Vercel entry point for the backend. Every request to /api/... is sent here
// (see vercel.json) and handed to the same Express app used in local development.
import "../server/config/timezone.js";
import app from "../server/app.js";
import { connectDB } from "../server/config/db.js";

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        message: "Can't reach the database right now. Check MONGO_URI and MongoDB Atlas Network Access.",
      })
    );
  }
  // Resolve only once Express has finished sending the response.
  return new Promise((resolve) => {
    res.on("finish", resolve);
    res.on("close", resolve);
    app(req, res);
  });
}
