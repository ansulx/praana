import { Bed, Footprints, HandHeart, Leaf, PersonStanding, Sparkles, Wind } from "lucide-react";
import type { GuidedCategory } from "@/content/guided";

export const CATEGORY_ICON: Record<GuidedCategory, React.ComponentType<{ className?: string }>> = {
  breathing: Wind,
  meditation: Sparkles,
  yoga: Leaf,
  physio: PersonStanding,
  prehab: Footprints,
  sleep: Bed,
  caregiver: HandHeart,
};

/** Soft tinted backgrounds so categories are recognisable at a glance. */
export const CATEGORY_TINT: Record<GuidedCategory, string> = {
  breathing: "bg-mint text-primary",
  meditation: "bg-secondary text-secondary-foreground",
  yoga: "bg-mint text-primary",
  physio: "bg-accent text-accent-foreground",
  prehab: "bg-amber-soft text-navy",
  sleep: "bg-secondary text-secondary-foreground",
  caregiver: "bg-coral-soft text-coral",
};
