import { assertDatabaseUrl, env } from "./config/env.js";
import { createApp } from "./app.js";
import { startNotificationCron } from "./cron/notifications.cron.js";

assertDatabaseUrl();

const app = createApp();

const listenHost = env.LISTEN_HOST ?? "0.0.0.0";

app.listen(env.PORT, listenHost, () => {
  console.log(`API em http://localhost:${env.PORT} (rede local: use o IP desta máquina na porta ${env.PORT})`);
  startNotificationCron();
});
