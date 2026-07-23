import { query } from './postgres-client.js';

export async function runMigrations(): Promise<void> {
  // 如果没有 DATABASE_URL，跳过迁移（沙箱环境使用 Supabase）
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL not set, skipping migrations (using Supabase)');
    return;
  }

  try {
    // 创建患者表
    await query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        gender VARCHAR(10),
        phone VARCHAR(50),
        first_treatment_date DATE,
        second_treatment_date DATE,
        third_treatment_date DATE,
        photo_date DATE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 创建随访步骤表
    await query(`
      CREATE TABLE IF NOT EXISTS followup_steps (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        step_type VARCHAR(50) NOT NULL,
        scheduled_date DATE NOT NULL,
        completed_date DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 创建推送令牌表
    await query(`
      CREATE TABLE IF NOT EXISTS device_push_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(500) UNIQUE NOT NULL,
        platform VARCHAR(50),
        reminder_enabled BOOLEAN DEFAULT true,
        reminder_hour INTEGER DEFAULT 9,
        reminder_minute INTEGER DEFAULT 0,
        last_notified_date DATE,
        last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // 创建索引
    await query('CREATE INDEX IF NOT EXISTS idx_followup_steps_patient_id ON followup_steps(patient_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_followup_steps_scheduled_date ON followup_steps(scheduled_date)');
    await query('CREATE INDEX IF NOT EXISTS idx_device_push_tokens_token ON device_push_tokens(token)');

    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}
