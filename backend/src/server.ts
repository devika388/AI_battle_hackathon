import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`FoodBridge API listening on http://localhost:${env.port}`);
});

if (env.demoMode) {
  console.info(
    "Read-only demo mode is enabled; authenticated API routes are disabled.",
  );
} else {
  let rescueScanRunning = false;
  const runRescueScan = async () => {
    if (rescueScanRunning) return;
    rescueScanRunning = true;
    try {
      const { scanCommunityRescue } = await import("./services/adminService.js");
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
}
