import { pgTable, serial, timestamp, varchar, integer, text, foreignKey, check, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const patients = pgTable("patients", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	phone: varchar({ length: 20 }).default(''),
	gender: varchar({ length: 10 }).default(''),
	age: integer().default(0),
	notes: text().default(''),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const followupSteps = pgTable("followup_steps", {
	id: serial().primaryKey().notNull(),
	patientId: integer("patient_id").notNull(),
	stepNumber: integer("step_number").notNull(),
	stepType: varchar("step_type", { length: 50 }).notNull(),
	scheduledDate: date("scheduled_date").notNull(),
	completedDate: date("completed_date"),
	notes: text().default(''),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.patientId],
			foreignColumns: [patients.id],
			name: "followup_steps_patient_id_fkey"
		}).onDelete("cascade"),
	check("followup_steps_step_number_check", sql`(step_number >= 1) AND (step_number <= 4)`),
	check("followup_steps_step_type_check", sql`(step_type)::text = ANY ((ARRAY['treatment_1'::character varying, 'treatment_2'::character varying, 'treatment_3'::character varying, 'photo'::character varying])::text[])`),
]);
