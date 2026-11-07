import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// ─── Enums ────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["patient", "caregiver", "clinician"]);
export const localeEnum = pgEnum("locale", ["en", "hi"]);
export const surgeryTypeEnum = pgEnum("surgery_type", [
  "breast",
  "colorectal",
  "head_neck",
  "gynaecologic",
  "thoracic",
  "upper_gi",
  "urologic",
  "other",
]);
export const careRoleEnum = pgEnum("care_role", [
  "surgeon",
  "oncologist",
  "nurse",
  "physiotherapist",
  "nutritionist",
  "psychologist",
  "anaesthesiologist",
  "coordinator",
]);
export const linkKindEnum = pgEnum("link_kind", ["caregiver", "clinician"]);
export const inputModeEnum = pgEnum("input_mode", ["text", "voice", "form"]);
export const woundEnum = pgEnum("wound_status", [
  "no_wound",
  "healing_well",
  "redness",
  "swelling",
  "discharge",
  "bleeding",
  "opening",
]);
export const medsTakenEnum = pgEnum("meds_taken", ["all", "some", "none", "not_applicable"]);
export const triageEnum = pgEnum("triage_level", ["none", "watch", "review", "urgent"]);
export const aiStatusEnum = pgEnum("ai_status", ["done", "fallback", "skipped", "failed"]);
export const alertStatusEnum = pgEnum("alert_status", ["open", "acknowledged", "resolved"]);
export const noteVisibilityEnum = pgEnum("note_visibility", ["team", "shared"]);
export const medLogStatusEnum = pgEnum("med_log_status", ["taken", "skipped"]);
export const feltEnum = pgEnum("felt_after", ["better", "same", "worse"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);
export const appointmentKindEnum = pgEnum("appointment_kind", ["in_person", "tele_physio", "video", "phone"]);

// ─── Identity ─────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    /** Null when the account signed up via Google (or another OAuth provider) only. */
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    role: roleEnum("role").notNull(),
    phone: text("phone"),
    locale: localeEnum("locale").notNull().default("en"),
    /** Clinicians: their discipline, shown to patients. */
    careRole: careRoleEnum("care_role"),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

/** Linked OAuth identities (Google today). One row per provider account. */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    email: text("email"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("oauth_provider_account_uq").on(t.provider, t.providerAccountId),
    index("oauth_user_idx").on(t.userId),
  ],
);

/** Durable session store. Redis caches it; this table is the source of truth. */
export const sessions = pgTable(
  "sessions",
  {
    /** sha256 of the cookie token — the raw token is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Patient ──────────────────────────────────────────────────────────────

export const patients = pgTable(
  "patients",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateOfBirth: date("date_of_birth"),
    surgeryType: surgeryTypeEnum("surgery_type").notNull().default("other"),
    surgeryName: text("surgery_name"),
    surgeryDate: date("surgery_date"),
    dischargeDate: date("discharge_date"),
    hospital: text("hospital"),
    /** Has a surgical drain at home. Some exercises stay locked until it is removed. */
    hasDrain: boolean("has_drain").notNull().default(false),
    allergies: text("allergies"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    consentCareTeam: boolean("consent_care_team").notNull().default(false),
    consentAi: boolean("consent_ai").notNull().default(false),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("patients_user_uq").on(t.userId)],
);

/** Caregivers and clinicians who may see a patient's record. */
export const careLinks = pgTable(
  "care_links",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: linkKindEnum("kind").notNull(),
    /** e.g. "Daughter", "Husband" */
    relationship: text("relationship"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("care_links_uq").on(t.patientId, t.userId),
    index("care_links_user_idx").on(t.userId),
  ],
);

export const inviteCodes = pgTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    kind: linkKindEnum("kind").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: uuid("used_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("invite_patient_idx").on(t.patientId)],
);

/** The people a patient can reach — may or may not have a PRAANA login. */
export const careTeamMembers = pgTable(
  "care_team_members",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    role: careRoleEnum("role").notNull(),
    phone: text("phone"),
    email: text("email"),
    availability: text("availability"),
    isPrimaryContact: boolean("is_primary_contact").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("care_team_patient_idx").on(t.patientId)],
);

// ─── Recovery record ──────────────────────────────────────────────────────

export type StructuredCheckin = {
  /** Plain-language summary for the care team, written in English. */
  summary: string;
  /** Domains the model could read from the free text, each with the phrase that supports it. */
  domains: Partial<
    Record<
      "pain" | "appetite" | "nausea" | "mobility" | "wound" | "mood" | "sleep" | "medications" | "temperature" | "other",
      { value: string | number | null; evidence: string }
    >
  >;
  concerns: string[];
  language?: string;
  model?: string;
};

export const checkins = pgTable(
  "checkins",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    submittedBy: uuid("submitted_by").references(() => users.id, { onDelete: "set null" }),
    reporterRole: roleEnum("reporter_role").notNull(),
    /** Days since surgery at submission time; negative before surgery, null if no date known. */
    dayOffset: integer("day_offset"),
    inputMode: inputModeEnum("input_mode").notNull().default("form"),
    freeText: text("free_text"),
    // Scores: 0 = best, 10 = worst for symptoms; 0 = worst, 10 = best for function. See lib/domains.
    pain: integer("pain"),
    appetite: integer("appetite"),
    nausea: integer("nausea"),
    mobility: integer("mobility"),
    sleep: integer("sleep"),
    mood: integer("mood"),
    anxiety: integer("anxiety"),
    wound: woundEnum("wound"),
    temperatureC: real("temperature_c"),
    medsTaken: medsTakenEnum("meds_taken"),
    structured: jsonb("structured").$type<StructuredCheckin>(),
    aiStatus: aiStatusEnum("ai_status").notNull().default("skipped"),
    triage: triageEnum("triage").notNull().default("none"),
    triageReasons: jsonb("triage_reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("checkins_idem_uq").on(t.idempotencyKey),
    index("checkins_patient_time_idx").on(t.patientId, t.createdAt),
  ],
);

export const photos = pgTable(
  "photos",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    checkinId: uuid("checkin_id").references(() => checkins.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    data: bytea("data").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("photos_checkin_idx").on(t.checkinId), index("photos_patient_idx").on(t.patientId)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    checkinId: uuid("checkin_id").references(() => checkins.id, { onDelete: "set null" }),
    level: triageEnum("level").notNull(),
    source: text("source").notNull().default("checkin"),
    reasons: jsonb("reasons").$type<string[]>().notNull(),
    status: alertStatusEnum("status").notNull().default("open"),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id, { onDelete: "set null" }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: createdAt(),
  },
  (t) => [index("alerts_patient_status_idx").on(t.patientId, t.status)],
);

export const notes = pgTable(
  "notes",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    visibility: noteVisibilityEnum("visibility").notNull().default("team"),
    createdAt: createdAt(),
  },
  (t) => [index("notes_patient_idx").on(t.patientId, t.createdAt)],
);

/** Questions the patient explicitly sends to the human team (not the AI). */
export const teamQuestions = pgTable(
  "team_questions",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    askedBy: uuid("asked_by").references(() => users.id, { onDelete: "set null" }),
    question: text("question").notNull(),
    answer: text("answer"),
    answeredBy: uuid("answered_by").references(() => users.id, { onDelete: "set null" }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("team_q_patient_idx").on(t.patientId, t.createdAt)],
);

// ─── Medications ──────────────────────────────────────────────────────────

export const medications = pgTable(
  "medications",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dose: text("dose"),
    /** 24h "HH:mm" local times */
    times: jsonb("times").$type<string[]>().notNull(),
    instructions: text("instructions"),
    active: boolean("active").notNull().default(true),
    startDate: date("start_date"),
    endDate: date("end_date"),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("meds_patient_idx").on(t.patientId)],
);

export const medicationLogs = pgTable(
  "medication_logs",
  {
    id: id(),
    medicationId: uuid("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    /** Local date + slot, e.g. 2026-10-13 + 08:00 */
    forDate: date("for_date").notNull(),
    slot: text("slot").notNull(),
    status: medLogStatusEnum("status").notNull(),
    loggedBy: uuid("logged_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("med_log_uq").on(t.medicationId, t.forDate, t.slot)],
);

// ─── Guided recovery & journey ────────────────────────────────────────────

export const sessionCompletions = pgTable(
  "session_completions",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    sessionSlug: text("session_slug").notNull(),
    durationSec: integer("duration_sec").notNull(),
    completedFully: boolean("completed_fully").notNull().default(true),
    feltAfter: feltEnum("felt_after"),
    loggedBy: uuid("logged_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("session_comp_patient_idx").on(t.patientId, t.createdAt)],
);

export const journeyTaskCompletions = pgTable(
  "journey_task_completions",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    taskKey: text("task_key").notNull(),
    completedBy: uuid("completed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("journey_task_uq").on(t.patientId, t.taskKey)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: appointmentKindEnum("kind").notNull().default("in_person"),
    withName: text("with_name"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull().default(30),
    location: text("location"),
    /** Video link for tele-physio / video consults. */
    joinUrl: text("join_url"),
    notes: text("notes"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("appt_patient_time_idx").on(t.patientId, t.startsAt)],
);

// ─── Companion ────────────────────────────────────────────────────────────

export const companionMessages = pgTable(
  "companion_messages",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: chatRoleEnum("role").notNull(),
    content: text("content").notNull(),
    /** The safety engine fired on this message. */
    flagged: triageEnum("flagged").notNull().default("none"),
    source: text("source"),
    createdAt: createdAt(),
  },
  (t) => [index("companion_patient_time_idx").on(t.patientId, t.createdAt)],
);

// ─── Audit ────────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_patient_idx").on(t.patientId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Checkin = typeof checkins.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type CareTeamMember = typeof careTeamMembers.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type SurgeryType = (typeof surgeryTypeEnum.enumValues)[number];
export type CareRole = (typeof careRoleEnum.enumValues)[number];
export type TriageLevel = (typeof triageEnum.enumValues)[number];
export type WoundStatus = (typeof woundEnum.enumValues)[number];
export type MedsTaken = (typeof medsTakenEnum.enumValues)[number];
export type Locale = (typeof localeEnum.enumValues)[number];
