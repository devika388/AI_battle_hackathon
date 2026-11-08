import { app } from "./app.js";
import { env } from "./config/env.js";
import { scanCommunityRescue } from "./services/adminService.js";

app.listen(env.port, () => {
  console.log(`FoodBridge API listening on http://localhost:${env.port}`);
});

let rescueScanRunning = false;
const runRescueScan = async () => {
  if (rescueScanRunning) return;
  rescueScanRunning = true;
  try {
    const result = await scanCommunityRescue();
    if (result.examined) console.info("Community rescue scan completed:", result);
  } catch (error) {
    console.error("Automatic community rescue scan failed:", error);
  } finally {
    rescueScanRunning = false;
  }
};

void runRescueScan();
setInterval(() => void runRescueScan(), 5 * 60_000);
