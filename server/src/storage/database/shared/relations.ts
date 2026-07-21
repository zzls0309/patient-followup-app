import { relations } from "drizzle-orm/relations";
import { patients, followupSteps } from "./schema";

export const followupStepsRelations = relations(followupSteps, ({one}) => ({
	patient: one(patients, {
		fields: [followupSteps.patientId],
		references: [patients.id]
	}),
}));

export const patientsRelations = relations(patients, ({many}) => ({
	followupSteps: many(followupSteps),
}));