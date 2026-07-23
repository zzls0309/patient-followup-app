import { query } from './postgres-client';

export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...');

  // Create patients table
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
    );
  `);

  // Create followup_steps table
  await query(`
    CREATE TABLE IF NOT EXISTS followup_steps (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      step_type VARCHAR(50) NOT NULL,
      scheduled_date DATE NOT NULL,
      completed_date DATE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Create device_push_tokens table
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
    );
  `);

  // Create indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_followup_steps_patient_id ON followup_steps(patient_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_followup_steps_scheduled_date ON followup_steps(scheduled_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_followup_steps_completed_date ON followup_steps(completed_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_device_push_tokens_token ON device_push_tokens(token);`);

  console.log('Migrations completed successfully');
}
