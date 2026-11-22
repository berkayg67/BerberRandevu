"use server";

import { BookingError } from "@/server/booking/errors";
import { getDb } from "@/server/db/client";
import { submitContentReport } from "./content";

export type ReportState = {
  error?: string;
  done?: boolean;
  values?: { target?: string; reason?: string; details?: string; contact?: string };
};

export async function reportAction(_prev: ReportState, fd: FormData): Promise<ReportState> {
  const text = (k: string) => String(fd.get(k) ?? "");
  const values = { target: text("target"), reason: text("reason"), details: text("details"), contact: text("contact") };
  // Gizli alan: botlar doldurur, insanlar görmez.
  if (text("website")) return { done: true };
  const slugMatch = values.target.match(/^\s*(?:https?:\/\/[^/\s]+)?\/?([a-z0-9][a-z0-9-]{1,38}[a-z0-9])(?:[/?#\s]|$)/i);
  try {
    await submitContentReport(getDb(), {
      shopSlug: slugMatch?.[1]?.toLowerCase(),
      ...values,
    });
    return { done: true };
  } catch (e) {
    if (e instanceof BookingError) return { error: e.message, values };
    throw e;
  }
}

