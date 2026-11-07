CREATE TYPE "public"."ai_status" AS ENUM('done', 'fallback', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."appointment_kind" AS ENUM('in_person', 'tele_physio', 'video', 'phone');--> statement-breakpoint
CREATE TYPE "public"."care_role" AS ENUM('surgeon', 'oncologist', 'nurse', 'physiotherapist', 'nutritionist', 'psychologist', 'anaesthesiologist', 'coordinator');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."felt_after" AS ENUM('better', 'same', 'worse');--> statement-breakpoint
CREATE TYPE "public"."input_mode" AS ENUM('text', 'voice', 'form');--> statement-breakpoint
CREATE TYPE "public"."link_kind" AS ENUM('caregiver', 'clinician');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'hi');--> statement-breakpoint
CREATE TYPE "public"."med_log_status" AS ENUM('taken', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."meds_taken" AS ENUM('all', 'some', 'none', 'not_applicable');--> statement-breakpoint
CREATE TYPE "public"."note_visibility" AS ENUM('team', 'shared');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('patient', 'caregiver', 'clinician');--> statement-breakpoint
CREATE TYPE "public"."surgery_type" AS ENUM('breast', 'colorectal', 'head_neck', 'gynaecologic', 'thoracic', 'upper_gi', 'urologic', 'other');--> statement-breakpoint
CREATE TYPE "public"."triage_level" AS ENUM('none', 'watch', 'review', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."wound_status" AS ENUM('no_wound', 'healing_well', 'redness', 'swelling', 'discharge', 'bleeding', 'opening');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"checkin_id" uuid,
	"level" "triage_level" NOT NULL,
	"source" text DEFAULT 'checkin' NOT NULL,
	"reasons" jsonb NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" "appointment_kind" DEFAULT 'in_person' NOT NULL,
	"with_name" text,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 30 NOT NULL,
	"location" text,
	"join_url" text,
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"patient_id" uuid,
	"action" text NOT NULL,
	"meta" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "link_kind" NOT NULL,
	"relationship" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"role" "care_role" NOT NULL,
	"phone" text,
	"email" text,
	"availability" text,
	"is_primary_contact" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"submitted_by" uuid,
	"reporter_role" "role" NOT NULL,
	"day_offset" integer,
	"input_mode" "input_mode" DEFAULT 'form' NOT NULL,
	"free_text" text,
	"pain" integer,
	"appetite" integer,
	"nausea" integer,
	"mobility" integer,
	"sleep" integer,
	"mood" integer,
	"anxiety" integer,
	"wound" "wound_status",
	"temperature_c" real,
	"meds_taken" "meds_taken",
	"structured" jsonb,
	"ai_status" "ai_status" DEFAULT 'skipped' NOT NULL,
	"triage" "triage_level" DEFAULT 'none' NOT NULL,
	"triage_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companion_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"flagged" "triage_level" DEFAULT 'none' NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "link_kind" NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journey_task_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"completed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"medication_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"for_date" date NOT NULL,
	"slot" text NOT NULL,
	"status" "med_log_status" NOT NULL,
	"logged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"name" text NOT NULL,
	"dose" text,
	"times" jsonb NOT NULL,
	"instructions" text,
	"active" boolean DEFAULT true NOT NULL,
	"start_date" date,
	"end_date" date,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"visibility" "note_visibility" DEFAULT 'team' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date_of_birth" date,
	"surgery_type" "surgery_type" DEFAULT 'other' NOT NULL,
	"surgery_name" text,
	"surgery_date" date,
	"discharge_date" date,
	"hospital" text,
	"has_drain" boolean DEFAULT false NOT NULL,
	"allergies" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"consent_care_team" boolean DEFAULT false NOT NULL,
	"consent_ai" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone,
	"onboarded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"checkin_id" uuid,
	"uploaded_by" uuid,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"session_slug" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"completed_fully" boolean DEFAULT true NOT NULL,
	"felt_after" "felt_after",
	"logged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "team_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"asked_by" uuid,
	"question" text NOT NULL,
	"answer" text,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"phone" text,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"care_role" "care_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_links" ADD CONSTRAINT "care_links_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_links" ADD CONSTRAINT "care_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companion_messages" ADD CONSTRAINT "companion_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_task_completions" ADD CONSTRAINT "journey_task_completions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journey_task_completions" ADD CONSTRAINT "journey_task_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_logs" ADD CONSTRAINT "medication_logs_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_completions" ADD CONSTRAINT "session_completions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_completions" ADD CONSTRAINT "session_completions_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_questions" ADD CONSTRAINT "team_questions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_questions" ADD CONSTRAINT "team_questions_asked_by_users_id_fk" FOREIGN KEY ("asked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_questions" ADD CONSTRAINT "team_questions_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_patient_status_idx" ON "alerts" USING btree ("patient_id","status");--> statement-breakpoint
CREATE INDEX "appt_patient_time_idx" ON "appointments" USING btree ("patient_id","starts_at");--> statement-breakpoint
CREATE INDEX "audit_patient_idx" ON "audit_log" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "care_links_uq" ON "care_links" USING btree ("patient_id","user_id");--> statement-breakpoint
CREATE INDEX "care_links_user_idx" ON "care_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "care_team_patient_idx" ON "care_team_members" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checkins_idem_uq" ON "checkins" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "checkins_patient_time_idx" ON "checkins" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "companion_patient_time_idx" ON "companion_messages" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "invite_patient_idx" ON "invite_codes" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journey_task_uq" ON "journey_task_completions" USING btree ("patient_id","task_key");--> statement-breakpoint
CREATE UNIQUE INDEX "med_log_uq" ON "medication_logs" USING btree ("medication_id","for_date","slot");--> statement-breakpoint
CREATE INDEX "meds_patient_idx" ON "medications" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "notes_patient_idx" ON "notes" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_user_uq" ON "patients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "photos_checkin_idx" ON "photos" USING btree ("checkin_id");--> statement-breakpoint
CREATE INDEX "photos_patient_idx" ON "photos" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "session_comp_patient_idx" ON "session_completions" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_q_patient_idx" ON "team_questions" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");