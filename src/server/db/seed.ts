import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { addDaysYmd, localYmd } from "@/lib/dates";
import { triage, type PreviousCheckin } from "@/lib/safety/red-flags";
import { structureWithRules } from "@/server/ai/fallback";
import { hashPassword } from "@/server/auth/password";
import { db } from "./index";
import * as s from "./schema";

/**
 * Demo data, generated relative to "now" so the story always looks current.
 * One consistent patient story (Priya), plus a small clinic list with the situations a
 * care team actually meets: someone worsening, someone pre-op, someone who went quiet.
 */

export const DEMO_PASSWORD = "praana123";
const DAY = 86_400_000;

function at(daysAgo: number, hour: number, minute = 0): Date {
  const d = new Date(Date.now() - daysAgo * DAY);
  // Approximate IST wall-clock: set UTC hour = IST hour − 5:30.
  d.setUTCHours(hour - 5, minute - 30, 0, 0);
  return d.getTime() > Date.now() ? new Date(Date.now() - 20 * 60_000) : d;
}

type DemoCheckin = {
  daysAgo: number;
  hour: number;
  text: string;
  pain?: number;
  appetite?: number;
  nausea?: number;
  mobility?: number;
  sleep?: number;
  mood?: number;
  anxiety?: number;
  wound?: s.WoundStatus;
  temperatureC?: number;
  medsTaken?: s.MedsTaken;
  by?: "caregiver";
};

export async function isEmpty(): Promise<boolean> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(s.users);
  return (row?.n ?? 0) === 0;
}

export async function seedDemo(): Promise<void> {
  const hash = await hashPassword(DEMO_PASSWORD);
  const today = localYmd();

  const mkUser = async (u: Omit<typeof s.users.$inferInsert, "passwordHash">) =>
    (await db.insert(s.users).values({ ...u, passwordHash: hash }).returning())[0];

  // ── Care team accounts ──
  const drRao = await mkUser({ email: "doctor@demo.praana.care", name: "Dr. Kavita Rao", role: "clinician", careRole: "surgeon", phone: "+91 98260 11111" });
  const nurse = await mkUser({ email: "nurse@demo.praana.care", name: "Meera Joshi", role: "clinician", careRole: "nurse", phone: "+91 98260 22222" });
  const physio = await mkUser({ email: "physio@demo.praana.care", name: "Aman Gupta", role: "clinician", careRole: "physiotherapist", phone: "+91 98260 33333" });
  const clinicians = [drRao, nurse, physio];

  // ── Patients ──
  const priyaU = await mkUser({ email: "priya@demo.praana.care", name: "Priya Sharma", role: "patient", phone: "+91 99770 12345" });
  const rameshU = await mkUser({ email: "ramesh@demo.praana.care", name: "Ramesh Verma", role: "patient" });
  const sunitaU = await mkUser({ email: "sunita@demo.praana.care", name: "Sunita Devi", role: "patient", locale: "hi" });
  const arjunU = await mkUser({ email: "arjun@demo.praana.care", name: "Arjun Mehta", role: "patient" });
  const rohanU = await mkUser({ email: "rohan@demo.praana.care", name: "Rohan Sharma", role: "caregiver", phone: "+91 99770 54321" });

  const consent = { consentCareTeam: true, consentAi: true, consentAt: new Date(), onboardedAt: new Date() };
  const [priya] = await db
    .insert(s.patients)
    .values({
      userId: priyaU.id,
      dateOfBirth: "1978-03-14",
      surgeryType: "breast",
      surgeryName: "Left mastectomy with sentinel node biopsy",
      surgeryDate: addDaysYmd(today, -6),
      dischargeDate: addDaysYmd(today, -4),
      hospital: "City Cancer Centre, Indore",
      hasDrain: true,
      allergies: "Penicillin (rash)",
      emergencyContactName: "Rohan Sharma (son)",
      emergencyContactPhone: "+91 99770 54321",
      ...consent,
    })
    .returning();
  const [ramesh] = await db
    .insert(s.patients)
    .values({
      userId: rameshU.id,
      dateOfBirth: "1961-11-02",
      surgeryType: "colorectal",
      surgeryName: "Laparoscopic anterior resection",
      surgeryDate: addDaysYmd(today, -9),
      dischargeDate: addDaysYmd(today, -5),
      hospital: "City Cancer Centre, Indore",
      emergencyContactName: "Kamla Verma (wife)",
      emergencyContactPhone: "+91 94250 00000",
      ...consent,
    })
    .returning();
  const [sunita] = await db
    .insert(s.patients)
    .values({
      userId: sunitaU.id,
      dateOfBirth: "1970-06-21",
      surgeryType: "gynaecologic",
      surgeryName: "Total abdominal hysterectomy",
      surgeryDate: addDaysYmd(today, 5),
      hospital: "City Cancer Centre, Indore",
      emergencyContactName: "Rajesh (husband)",
      emergencyContactPhone: "+91 93000 00000",
      ...consent,
    })
    .returning();
  const [arjun] = await db
    .insert(s.patients)
    .values({
      userId: arjunU.id,
      dateOfBirth: "1957-01-30",
      surgeryType: "thoracic",
      surgeryName: "Right upper lobectomy (VATS)",
      surgeryDate: addDaysYmd(today, -20),
      dischargeDate: addDaysYmd(today, -15),
      hospital: "City Cancer Centre, Indore",
      ...consent,
    })
    .returning();
  const allPatients = [priya, ramesh, sunita, arjun];

  // ── Links ──
  await db.insert(s.careLinks).values([
    { patientId: priya.id, userId: rohanU.id, kind: "caregiver", relationship: "Son" },
    ...allPatients.flatMap((p) => clinicians.map((c) => ({ patientId: p.id, userId: c.id, kind: "clinician" as const }))),
  ]);

  for (const p of allPatients) {
    await db.insert(s.careTeamMembers).values([
      { patientId: p.id, userId: drRao.id, name: drRao.name, role: "surgeon", phone: drRao.phone, availability: "OPD Mon, Wed, Fri · 10am–2pm" },
      { patientId: p.id, userId: nurse.id, name: nurse.name, role: "nurse", phone: nurse.phone, availability: "Recovery helpline · 8am–8pm daily", isPrimaryContact: true },
      { patientId: p.id, userId: physio.id, name: physio.name, role: "physiotherapist", phone: physio.phone, availability: "Tele-physio Tue & Thu" },
      { patientId: p.id, name: "Dr. Farah Khan", role: "nutritionist", phone: "+91 98260 44444", availability: "Mon–Sat · 11am–5pm" },
      { patientId: p.id, name: "Dr. Neha Bhatt", role: "psychologist", phone: "+91 98260 55555", availability: "By appointment" },
    ]);
  }

  // ── Check-ins ──
  const writeCheckins = async (patient: s.Patient, list: DemoCheckin[], surgeryDate: string) => {
    const prev: PreviousCheckin[] = [];
    for (const c of [...list].sort((a, b) => b.daysAgo - a.daysAgo)) {
      const draft = structureWithRules(c.text);
      const fields = {
        pain: c.pain ?? null,
        appetite: c.appetite ?? null,
        nausea: c.nausea ?? null,
        mobility: c.mobility ?? null,
        sleep: c.sleep ?? null,
        mood: c.mood ?? null,
        anxiety: c.anxiety ?? null,
        wound: c.wound ?? null,
        temperatureC: c.temperatureC ?? null,
        medsTaken: c.medsTaken ?? null,
      };
      const result = triage({ ...fields, freeText: c.text }, prev);
      const createdAt = at(c.daysAgo, c.hour);
      const dayOffsetVal = Math.round((Date.parse(localYmd(createdAt)) - Date.parse(surgeryDate)) / DAY);
      const [row] = await db
        .insert(s.checkins)
        .values({
          patientId: patient.id,
          submittedBy: c.by === "caregiver" ? rohanU.id : patient.userId,
          reporterRole: c.by === "caregiver" ? "caregiver" : "patient",
          dayOffset: dayOffsetVal,
          inputMode: "text",
          freeText: c.text,
          ...fields,
          structured: { summary: draft.summary, domains: {}, concerns: draft.concerns },
          aiStatus: "fallback",
          triage: result.level,
          triageReasons: result.reasons.map((r) => r.en),
          idempotencyKey: randomUUID(),
          createdAt,
        })
        .returning();
      if (result.level === "review" || result.level === "urgent") {
        const resolved = c.daysAgo >= 2;
        await db.insert(s.alerts).values({
          patientId: patient.id,
          checkinId: row.id,
          level: result.level,
          reasons: result.reasons.filter((r) => r.level !== "watch").map((r) => r.en),
          status: resolved ? "resolved" : "open",
          resolvedBy: resolved ? nurse.id : null,
          resolvedAt: resolved ? new Date(createdAt.getTime() + 3 * 3600_000) : null,
          resolutionNote: resolved ? "Called patient. Advised as per protocol; settled." : null,
          createdAt,
        });
      }
      prev.unshift(fields);
    }
  };

  await writeCheckins(
    priya,
    [
      { daysAgo: 4, hour: 19, text: "First evening at home. Pain around 6 when I move my arm. Ate a little khichdi. Drain had about 80 ml today. Feeling scared about the drain.", pain: 6, appetite: 3, nausea: 1, mobility: 2, sleep: 3, mood: 2, anxiety: 3, wound: "healing_well", medsTaken: "all" },
      { daysAgo: 3, hour: 10, text: "Slept badly, woke up many times. Pain 5. Rohan helped me walk to the balcony twice. Drain 60 ml.", pain: 5, appetite: 2, nausea: 0, mobility: 2, sleep: 3, mood: 2, anxiety: 2, wound: "healing_well", medsTaken: "all" },
      { daysAgo: 2, hour: 20, text: "Maa had a bit of fever in the evening, 37.6. Wound looks a little red near the drain. She ate half her dinner.", pain: 5, appetite: 2, mobility: 2, sleep: 2, mood: 2, anxiety: 3, wound: "redness", temperatureC: 37.6, medsTaken: "all", by: "caregiver" },
      { daysAgo: 1, hour: 9, text: "Temperature normal this morning, 36.9. Pain 4. Did the arm exercises and breathing. Ate breakfast properly.", pain: 4, appetite: 1, nausea: 0, mobility: 1, sleep: 1, mood: 1, anxiety: 2, wound: "healing_well", temperatureC: 36.9, medsTaken: "all" },
      { daysAgo: 0, hour: 9, text: "Feeling better today. Pain about 3. Walked to the gate and back. Drain only 30 ml. A bit worried about the pathology report.", pain: 3, appetite: 1, nausea: 0, mobility: 1, sleep: 1, mood: 1, anxiety: 2, wound: "healing_well", medsTaken: "all" },
    ],
    priya.surgeryDate!,
  );

  await writeCheckins(
    ramesh,
    [
      { daysAgo: 4, hour: 11, text: "Pain 3. Eating soft food. Walked in the corridor.", pain: 3, appetite: 1, nausea: 0, mobility: 1, sleep: 1, mood: 1, anxiety: 1, wound: "healing_well", medsTaken: "all" },
      { daysAgo: 3, hour: 11, text: "Pain 3, stomach feels bloated.", pain: 3, appetite: 2, nausea: 1, mobility: 1, sleep: 2, mood: 1, anxiety: 1, wound: "healing_well", medsTaken: "all" },
      { daysAgo: 2, hour: 12, text: "Pain 4. Ate very little. Feeling tired.", pain: 4, appetite: 3, nausea: 2, mobility: 2, sleep: 2, mood: 2, anxiety: 2, wound: "healing_well", medsTaken: "some" },
      { daysAgo: 1, hour: 18, text: "Pain 5 in the stomach. Ate very little again. Feel weak.", pain: 5, appetite: 3, nausea: 2, mobility: 2, sleep: 3, mood: 2, anxiety: 2, wound: "redness", medsTaken: "all" },
      { daysAgo: 0, hour: 8, text: "Pain 7 near the wound since night, area around it is red and warm to touch. Temperature 37.8. Hardly ate anything for three days.", pain: 7, appetite: 3, nausea: 2, mobility: 3, sleep: 3, mood: 3, anxiety: 3, wound: "redness", temperatureC: 37.8, medsTaken: "all" },
    ],
    ramesh.surgeryDate!,
  );

  await writeCheckins(
    arjun,
    [
      { daysAgo: 8, hour: 10, text: "Breathing exercises done. Pain 3. Walking 15 minutes twice a day.", pain: 3, appetite: 0, nausea: 0, mobility: 1, sleep: 1, mood: 1, anxiety: 1, wound: "healing_well", medsTaken: "all" },
      { daysAgo: 6, hour: 10, text: "Pain 2. Cough is less. Walked 20 minutes.", pain: 2, appetite: 0, nausea: 0, mobility: 1, sleep: 1, mood: 1, anxiety: 1, wound: "healing_well", medsTaken: "all" },
      { daysAgo: 4, hour: 10, text: "Feeling tired today, pain 3.", pain: 3, appetite: 1, nausea: 0, mobility: 1, sleep: 2, mood: 2, anxiety: 1, wound: "healing_well", medsTaken: "all" },
    ],
    arjun.surgeryDate!,
  );

  await writeCheckins(
    sunita,
    [
      { daysAgo: 1, hour: 17, text: "ऑपरेशन को लेकर थोड़ी घबराहट है। रोज़ सुबह 20 मिनट टहल रही हूँ।", appetite: 0, mobility: 0, sleep: 2, mood: 1, anxiety: 3, wound: "no_wound", medsTaken: "not_applicable" },
    ],
    sunita.surgeryDate!,
  );

  // ── Medications (Priya) ──
  const meds = await db
    .insert(s.medications)
    .values([
      { patientId: priya.id, name: "Paracetamol", dose: "650 mg", times: ["08:00", "14:00", "20:00"], instructions: "After food. Don't exceed 4 tablets in 24 hours.", addedBy: drRao.id, startDate: addDaysYmd(today, -4) },
      { patientId: priya.id, name: "Cefuroxime", dose: "500 mg", times: ["08:00", "20:00"], instructions: "Antibiotic, finish the full course.", addedBy: drRao.id, startDate: addDaysYmd(today, -4), endDate: addDaysYmd(today, 1) },
      { patientId: priya.id, name: "Pantoprazole", dose: "40 mg", times: ["07:30"], instructions: "Empty stomach, 30 minutes before breakfast.", addedBy: drRao.id, startDate: addDaysYmd(today, -4) },
      { patientId: priya.id, name: "Lactulose syrup", dose: "15 ml", times: ["21:30"], instructions: "If no bowel movement. Skip if stools are loose.", addedBy: nurse.id, startDate: addDaysYmd(today, -4) },
    ])
    .returning();
  for (let d = 4; d >= 1; d--) {
    const day = addDaysYmd(today, -d);
    for (const m of meds) {
      if (m.endDate && day > m.endDate) continue;
      for (const slot of m.times) {
        const skipped = d === 3 && slot === "21:30";
        await db.insert(s.medicationLogs).values({ medicationId: m.id, patientId: priya.id, forDate: day, slot, status: skipped ? "skipped" : "taken", loggedBy: priyaU.id });
      }
    }
  }
  for (const m of meds) {
    for (const slot of m.times.filter((t) => t < "09:00")) {
      await db.insert(s.medicationLogs).values({ medicationId: m.id, patientId: priya.id, forDate: today, slot, status: "taken", loggedBy: priyaU.id });
    }
  }

  // ── Appointments ──
  const future = (days: number, hour: number, minute = 0) => {
    const d = new Date(Date.now() + days * DAY);
    d.setUTCHours(hour - 5, minute - 30, 0, 0);
    return d;
  };
  await db.insert(s.appointments).values([
    { patientId: priya.id, title: "Live physiotherapy, shoulder mobility", kind: "tele_physio", withName: physio.name, startsAt: future(1, 11), durationMin: 30, joinUrl: "https://meet.jit.si/praana-physio-demo", createdBy: physio.id },
    { patientId: priya.id, title: "Drain review", kind: "in_person", withName: nurse.name, startsAt: future(2, 10, 30), location: "Dressing room, 2nd floor, City Cancer Centre", createdBy: nurse.id },
    { patientId: priya.id, title: "Surgical follow-up & pathology results", kind: "in_person", withName: drRao.name, startsAt: future(8, 11), location: "Surgical OPD, Room 14", createdBy: drRao.id },
    { patientId: ramesh.id, title: "Surgical follow-up", kind: "in_person", withName: drRao.name, startsAt: future(5, 12), location: "Surgical OPD, Room 14", createdBy: drRao.id },
    { patientId: sunita.id, title: "Pre-anaesthesia check", kind: "in_person", withName: "Anaesthesia team", startsAt: future(2, 9, 30), location: "PAC clinic, Ground floor", notes: "Bring all reports and your current medicines.", createdBy: nurse.id },
    { patientId: sunita.id, title: "Prehab video call", kind: "video", withName: physio.name, startsAt: future(1, 17), joinUrl: "https://meet.jit.si/praana-prehab-demo", createdBy: physio.id },
  ]);

  // ── Notes & questions ──
  await db.insert(s.notes).values([
    { patientId: priya.id, authorId: nurse.id, visibility: "shared", body: "Spoke with Priya and Rohan. The redness near the drain is settling and temperature is normal. Keep the drain site dry and keep recording drain output each evening. Call the helpline if the redness spreads or temperature is 38°C or more.", createdAt: at(1, 12) },
    { patientId: priya.id, authorId: drRao.id, visibility: "team", body: "Day 4: low-grade temp 37.6 with mild erythema at drain site. Reviewed photos, no collection. Continue oral antibiotics, review at drain clinic.", createdAt: at(2, 21) },
  ]);
  await db.insert(s.teamQuestions).values([
    { patientId: priya.id, askedBy: priyaU.id, question: "When can I take a normal bath? I'm only doing sponge baths right now.", answer: "You can shower 48 hours after the drain is removed. Until then, sponge bath and keep the drain site dry. We'll confirm at your drain review., Meera (nurse)", answeredBy: nurse.id, answeredAt: at(2, 15), createdAt: at(3, 18) },
    { patientId: priya.id, askedBy: rohanU.id, question: "Is it okay for her to sleep on the left side?", createdAt: at(0, 8) },
  ]);

  // ── Guided & journey activity ──
  await db.insert(s.sessionCompletions).values([
    { patientId: priya.id, sessionSlug: "deep-breathing-cough", durationSec: 360, feltAfter: "better", loggedBy: priyaU.id, createdAt: at(3, 11) },
    { patientId: priya.id, sessionSlug: "breast-arm-early", durationSec: 600, feltAfter: "same", loggedBy: priyaU.id, createdAt: at(1, 10) },
    { patientId: priya.id, sessionSlug: "calm-breath", durationSec: 240, feltAfter: "better", loggedBy: priyaU.id, createdAt: at(1, 22) },
    { patientId: sunita.id, sessionSlug: "prehab-walk", durationSec: 1200, feltAfter: "better", loggedBy: sunitaU.id, createdAt: at(1, 7) },
  ]);
  await db.insert(s.journeyTaskCompletions).values(
    ["meet.team", "meet.plan", "prepare.walk", "prepare.breathing", "prepare.home", "surgery.discharge", "home.drain"].map((taskKey) => ({ patientId: priya.id, taskKey, completedBy: priyaU.id })),
  );

  console.info("[seed] demo data ready, password for every demo account:", DEMO_PASSWORD);
}
