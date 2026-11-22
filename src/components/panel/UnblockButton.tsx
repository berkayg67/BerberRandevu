"use client";

import { useTransition } from "react";
import { unblockAction } from "@/app/panel/actions";

export function UnblockButton({ blockId, className }: { blockId: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} disabled={pending} onClick={() => start(() => unblockAction(blockId))}>
      {pending ? "Kaldırılıyor…" : "Engeli kaldır"}
    </button>
  );
}
