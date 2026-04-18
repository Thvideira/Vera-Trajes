import cron from "node-cron";
import { env } from "../config/env.js";
import { processScheduledNotifications } from "../services/notificacao.service.js";

export function startNotificationCron(): void {
  if (!env.CRON_ENABLED) {
    console.log("[cron] Agendador de notificações desabilitado (CRON_ENABLED=false)");
    return;
  }
  // Diariamente às 08:00 (horário do servidor)
  cron.schedule("0 8 * * *", async () => {
    console.log("[cron] Executando notificações agendadas...");
    try {
      await processScheduledNotifications(new Date());
    } catch (e) {
      console.error("[cron] Erro:", e);
    }
  });
  console.log("[cron] Job diário de WhatsApp registrado (0 8 * * *)");
}
