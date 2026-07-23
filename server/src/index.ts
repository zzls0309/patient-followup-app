import express from "express";
import cors from "cors";
import cron from "node-cron";
import patientsRouter from "./routes/patients.js";
import { runMigrations } from "./storage/database/migrations.js";

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/patients', patientsRouter);

// 定时任务：每天检查并发送随诊提醒
// 默认每天早上8点执行，可通过环境变量 CRON_SCHEDULE 自定义
const cronSchedule = process.env.CRON_SCHEDULE || '0 8 * * *';
cron.schedule(cronSchedule, async () => {
  console.log(`[${new Date().toISOString()}] Running daily reminder check...`);
  try {
    // 调用内部接口触发提醒检查
    const response = await fetch(`http://localhost:${port}/api/v1/patients/push/check-and-remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();
    console.log(`[${new Date().toISOString()}] Reminder check result:`, result);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Reminder check failed:`, err);
  }
}, {
  timezone: 'Asia/Shanghai'
});

console.log(`Cron job scheduled: ${cronSchedule} (Asia/Shanghai)`);

// Run migrations on startup
runMigrations().then(() => {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}/`);
  });
}).catch((err) => {
  console.error('Failed to run migrations:', err);
  process.exit(1);
});
