"use client";

import { useEffect, useState } from "react";
import { cleanReferralCode, referralCodeToSend, type ReferralLookup } from "./referral";
import { lookupReferralCode } from "./referral.api";

/**
 * How long a page waits on the lookup before carrying on without it.
 *
 * The customer's chat buttons hold until it answers, because a tap before then
 * would open the chat without the code, and that first message is the only way
 * the code reaches the backend. So this is far shorter than the API client's own
 * deadline: a slow network must not leave someone looking at dead buttons.
 */
const LOOKUP_PATIENCE_MS = 4_000;

export interface ReferralLink {
  /** The lookup has not answered yet. */
  pending: boolean;
  /** Confirmed by the API, so its chat links carry the code. `null` means an ordinary visit. */
  confirmed: ReferralLookup | null;
  /** What a registration form sends as `referral_code`. */
  codeToSend: string | null;
}

/**
 * What `?ref=` is worth on this page.
 *
 * ⚠ A failure is deliberately silent everywhere: an unknown code, a suspended
 * partner, a switched-off program and an unreachable API are all an ordinary
 * visit, with no error shown.
 */
export function useReferralLink(raw: string | null): ReferralLink {
  const cleaned = cleanReferralCode(raw);
  const [settled, setSettled] = useState<{ code: string; lookup: ReferralLookup | null } | null>(null);

  useEffect(() => {
    if (!cleaned) return;
    let done = false;
    const settle = (lookup: ReferralLookup | null) => {
      if (done) return;
      done = true;
      setSettled({ code: cleaned, lookup });
    };

    const timer = setTimeout(() => settle(null), LOOKUP_PATIENCE_MS);
    lookupReferralCode(cleaned)
      .then(settle)
      .catch(() => settle(null));

    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [cleaned]);

  const answer = settled && settled.code === cleaned ? settled : null;
  const lookup = answer?.lookup ?? null;

  return {
    pending: !!cleaned && !answer,
    confirmed: lookup?.valid ? lookup : null,
    codeToSend: referralCodeToSend(cleaned, lookup),
  };
}
