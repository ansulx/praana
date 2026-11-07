"use client";

import { createContext, useCallback, useContext } from "react";
import { t as translate, type Locale, type MessageKey } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return useCallback((key: MessageKey) => translate(locale, key), [locale]);
}
