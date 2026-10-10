import mongoose from "mongoose";
import dns from "node:dns";

const onVercel = Boolean(process.env.VERCEL);

// Some ISPs/routers/Windows setups fail to resolve the SRV DNS records that
// "mongodb+srv://" connection strings rely on. Forcing Node to use public
// DNS resolvers here fixes it regardless of the machine's network settings.
// Not needed (and not wanted) on Vercel, whose own DNS works fine.
if (!onVercel) dns.setServers(["8.8.8.8", "1.1.1.1"]);

// On Vercel the API runs as a serverless function that is reused between requests,
// so the connection is created once and shared instead of reconnecting every time.
let connection = null;

export const connectDB = async () => {
  if (connection) return connection;

  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/chief-rice-trader";
  connection = mongoose
    .connect(uri, onVercel ? { serverSelectionTimeoutMS: 10000 } : {})
    .then((m) => {
      console.log(`MongoDB connected: ${m.connection.host}/${m.connection.name}`);
      return m;
    });

  try {
    return await connection;
  } catch (err) {
    connection = null; // let the next request try again
    console.error("MongoDB connection error:", err.message);
    if (!onVercel) process.exit(1);
    throw err;
  }
};
