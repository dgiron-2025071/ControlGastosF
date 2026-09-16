import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { testDatabaseConnection } from "./config/database";

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await testDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`Control-Gastos backend running on port ${PORT}`);
    });
  } catch (error) {
    console.error("[server] Failed to connect to PostgreSQL:", error);
    process.exit(1);
  }
}

start();
