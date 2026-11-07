"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { CARE_ROLES } from "@/lib/labels";
import { scanText } from "@/lib/safety/red-flags";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/forms/field";
import { useLocale } from "@/components/providers/locale-provider";
import { addCareContact, askCareTeam } from "@/server/actions/patient";

export function AskTeamForm() {
  const locale = useLocale();
  const hi = locale === "hi";
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  // A question box is not where urgent symptoms should wait for a reply.
  const urgent = scanText(text).some((r) => r.level === "urgent");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await askCareTeam(text);
          if (r.ok) {
            toast.success(r.message);
            setText("");
          } else toast.error(r.error);
        });
      }}
      className="grid gap-3"
    >
      <Textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={3} placeholder={hi ? "जैसे: मैं कब से नहा सकती हूँ?" : "e.g. When can I take a normal bath?"} aria-label={hi ? "आपका सवाल" : "Your question"} />
      {urgent && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {hi
            ? "यह ज़रूरी लगता है। सवाल भेजने के बजाय अभी अपनी केयर टीम को कॉल करें, या ऊपर 'अभी मदद चाहिए?' दबाएं।"
            : "This sounds urgent. Please call your care team now instead of waiting for a reply, or tap “Need help now?” at the top."}
        </p>
      )}
      <Button type="submit" disabled={pending || text.trim().length < 3} className="justify-self-end">
        {pending ? <Loader2 className="animate-spin" /> : <Send />} {hi ? "भेजें" : "Send question"}
      </Button>
    </form>
  );
}

export function AddContactDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("nurse");
  const [primary, setPrimary] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Add contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a care team contact</DialogTitle>
        </DialogHeader>
        <form
          action={(form) =>
            start(async () => {
              setError(null);
              const r = await addCareContact({
                name: String(form.get("name") ?? ""),
                phone: String(form.get("phone") ?? ""),
                availability: String(form.get("availability") ?? ""),
                role: role as (typeof CARE_ROLES)[number]["value"],
                isPrimaryContact: primary,
              });
              if (r.ok) {
                setOpen(false);
                toast.success("Contact added");
              } else setError(r.error);
            })
          }
          className="grid gap-4"
        >
          {error && <p className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <FormField id="c-name" label="Name">
            <Input id="c-name" name="name" required />
          </FormField>
          <FormField id="c-role" label="Role">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="c-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CARE_ROLES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="c-phone" label="Phone">
            <Input id="c-phone" name="phone" type="tel" inputMode="tel" />
          </FormField>
          <FormField id="c-avail" label="When to call" optional>
            <Input id="c-avail" name="availability" placeholder="e.g. 8am–8pm daily" />
          </FormField>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={primary} onCheckedChange={(v) => setPrimary(v === true)} /> Make this my first contact (shown in “Need help now?”)
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
