"use client";

import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useRef } from "react";
import { Icon } from "@/components/shop/ds";
import { selectionFeedback } from "@/lib/native/haptics";
import { dayKeyOf, follows, runFrom } from "@/lib/shop/booking-slots";
import type { Slot } from "@/lib/shop/bookings.api";
import "./BookingCalendar.css";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` → its calendar fields. */
function parts(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

/** Midday UTC on that date — inside the same calendar day in any zone within ±11h. */
function middayOf(key: string): Date {
  const { y, m, d } = parts(key);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function addDays(key: string, n: number): string {
  const { y, m, d } = parts(key);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6. */
function weekdayIndex(key: string): number {
  const { y, m, d } = parts(key);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export interface BookingCalendarProps {
  /** Every slot in the window, any day. */
  byDay: ReadonlyMap<string, Slot[]>;
  /** The window shown, inclusive of both days. */
  range: { from: Date; to: Date };
  day: string | null;
  onDayChange: (day: string | null) => void;
  /** The chosen run of slot ids, in order. */
  run: readonly string[];
  onTap: (slot: Slot) => void;
  /** Longest run allowed — later contiguous slots inside it are drawn as reachable. */
  maxSlots: number;
  /** A fixed run length (a move keeps the appointment's length), or none. */
  count?: number;
  busy?: boolean;
}

/**
 * Pick a date, then a time on it.
 *
 * ── Two steps on a phone, one view where there is room ───────────────────────
 *
 * On a phone the month comes first; choosing a day folds it into a one-line
 * "Tue 28 Oct · Change" and opens that day's timeline. Once the panel itself is
 * 540px wide (a container query on the panel, not the viewport — at `lg` the
 * product page puts it in a half-width column, so a 768 tablet's panel is wider
 * than a 1024 laptop's) the month and the timeline sit side by side, so
 * changing day is one tap rather than two.
 *
 * ── The timeline is the day, slot by slot ────────────────────────────────────
 *
 * One row per slot, with gaps in the grid drawn as gaps. The chosen run is one
 * continuous block; the slots that would extend it are outlined, so "tap a later
 * time to make it longer" can be seen rather than read. Times the shop cannot
 * take stay on the timeline as "Taken", because a day that silently loses its
 * 11:00 reads as a shop that opens late.
 */
export function BookingCalendar({
  byDay,
  range,
  day,
  onDayChange,
  run,
  onTap,
  maxSlots,
  count,
  busy,
}: BookingCalendarProps) {
  const t = useTranslations("shop.product.booking");
  const format = useFormatter();
  const timeZone = useTimeZone() ?? "Africa/Douala";

  const firstDay = useMemo(() => dayKeyOf(range.from, timeZone), [range.from, timeZone]);
  const lastDay = useMemo(() => dayKeyOf(range.to, timeZone), [range.to, timeZone]);

  /** Whole weeks, Monday first, from the week holding the first day to the one holding the last. */
  const weeks = useMemo(() => {
    const start = addDays(firstDay, -weekdayIndex(firstDay));
    const rows: string[][] = [];
    for (let key = start; key <= lastDay; ) {
      const row: string[] = [];
      for (let i = 0; i < 7; i++, key = addDays(key, 1)) row.push(key);
      rows.push(row);
    }
    return rows;
  }, [firstDay, lastDay]);

  const bookable = (key: string) => (byDay.get(key) ?? []).some((s) => s.available);

  const daySlots = useMemo(() => (day ? (byDay.get(day) ?? []) : []), [byDay, day]);
  const chosen = useMemo(() => new Set(run), [run]);

  /** Slots a tap would extend the run to — outlined, so extending is discoverable. */
  const reachable = useMemo(() => {
    const out = new Set<string>();
    if (count !== undefined || run.length === 0 || run.length >= maxSlots) return out;
    for (let n = run.length + 1; n <= maxSlots; n++) {
      const next = runFrom(daySlots, run[0], n);
      if (!next) break;
      out.add(next[next.length - 1].id);
    }
    return out;
  }, [daySlots, run, maxSlots, count]);

  // Bring the run, or the first bookable time, into view when the day changes.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list || !day) return;
    const target =
      list.querySelector<HTMLElement>('[data-state^="run"]') ??
      list.querySelector<HTMLElement>('[data-state="free"]');
    if (target) list.scrollTop = Math.max(0, target.offsetTop - list.offsetTop - 8);
    // Only on a new day: following every tap would yank the list under the thumb.
  }, [day]);

  const time = (iso: string) =>
    format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bk-cal" data-has-day={day ? "true" : "false"}>
      <div className="bk-cal-grid">
        <section className="bk-dates" aria-label={t("chooseDate")}>
          <div className="bk-month">
            <div className="bk-head">
              <span className="ds-overline">{t("chooseDate")}</span>
              <span className="bk-month-label">
                {format.dateTimeRange(middayOf(firstDay), middayOf(lastDay), {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="bk-weekdays" aria-hidden="true">
              {weeks[0]?.map((key) => (
                <span key={key}>{format.dateTime(middayOf(key), { weekday: "short" })}</span>
              ))}
            </div>
            <div className="bk-days">
              {weeks.flat().map((key) => {
                if (key < firstDay || key > lastDay) return <span key={key} aria-hidden="true" />;
                const open = bookable(key);
                const { d } = parts(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className="bk-day"
                    data-selected={key === day ? "true" : undefined}
                    data-today={key === firstDay ? "true" : undefined}
                    disabled={!open}
                    aria-pressed={key === day}
                    aria-label={
                      open
                        ? format.dateTime(middayOf(key), { weekday: "long", day: "numeric", month: "long" })
                        : t("dayClosedAria", {
                            date: format.dateTime(middayOf(key), {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            }),
                          })
                    }
                    onClick={() => {
                      void selectionFeedback();
                      onDayChange(key);
                    }}
                  >
                    {/* The 1st carries its month, so a window that crosses
                        months still reads as dates rather than bare numbers. */}
                    {d === 1 && (
                      <span className="bk-day-month">
                        {format.dateTime(middayOf(key), { month: "short" })}
                      </span>
                    )}
                    <span className="bk-day-num">
                      {format.dateTime(middayOf(key), { day: "numeric" })}
                    </span>
                    {open && <span className="bk-day-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>

          {day && (
            <button type="button" className="bk-day-summary" onClick={() => onDayChange(null)}>
              <Icon name="calendar-days" size={18} />
              <span className="bk-day-summary-date">
                {format.dateTime(middayOf(day), { weekday: "long", day: "numeric", month: "long" })}
              </span>
              <span className="bk-day-summary-change">{t("changeDate")}</span>
            </button>
          )}
        </section>

        <section className="bk-times" aria-label={t("chooseTime")}>
          {!day ? (
            <div className="bk-times-empty">
              <Icon name="calendar-clock" size={22} />
              <span>{t("pickDateFirst")}</span>
            </div>
          ) : (
            <>
              <div className="bk-head">
                <span className="ds-overline">{t("chooseTime")}</span>
              </div>
              <p className="bk-hint">
                {count !== undefined ? t("hintFixedLength") : maxSlots > 1 ? t("hintExtend") : t("hintOne")}
              </p>
              <div className="bk-timeline" ref={listRef}>
                {daySlots.map((slot, i) => {
                  const prev = daySlots[i - 1];
                  const next = daySlots[i + 1];
                  const inRun = chosen.has(slot.id);
                  const runBefore = inRun && prev !== undefined && chosen.has(prev.id);
                  const runAfter = inRun && next !== undefined && chosen.has(next.id);
                  const state = inRun
                    ? runBefore
                      ? runAfter
                        ? "run-mid"
                        : "run-last"
                      : runAfter
                        ? "run-first"
                        : "run-one"
                    : !slot.available
                      ? "taken"
                      : reachable.has(slot.id)
                        ? "reach"
                        : "free";
                  const at = time(slot.start);
                  const seats =
                    slot.spotsRemaining === undefined
                      ? null
                      : slot.available
                        ? t("spotsLeft", { n: slot.spotsRemaining })
                        : t("full");

                  return (
                    <Fragment key={slot.id}>
                      {prev && !follows(prev, slot) && <div className="bk-gap" aria-hidden="true" />}
                      <div className="bk-row" data-state={state}>
                        <span className="bk-time">{at}</span>
                        <button
                          type="button"
                          className="bk-block"
                          data-state={state}
                          disabled={busy || (!slot.available && !inRun)}
                          aria-pressed={inRun}
                          aria-label={
                            inRun
                              ? t("slotAriaChosen", { time: at })
                              : !slot.available
                                ? t("slotAriaTaken", { time: at })
                                : seats
                                  ? t("slotAriaSeats", { time: at, seats })
                                  : t("slotAriaFree", { time: at })
                          }
                          onClick={() => {
                            void selectionFeedback();
                            onTap(slot);
                          }}
                        >
                          {(state === "run-first" || state === "run-one") && (
                            <span className="bk-block-range">
                              {format.dateTimeRange(
                                new Date(slot.start),
                                new Date(
                                  daySlots.find((s) => s.id === run[run.length - 1])?.end ?? slot.end,
                                ),
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          )}
                          {state === "taken" && <span>{seats ?? t("taken")}</span>}
                          {(state === "free" || state === "reach") && seats && <span>{seats}</span>}
                          {state === "reach" && !seats && (
                            <span className="bk-block-reach">
                              <Icon name="plus" size={14} />
                              {t("untilTime", { time: time(slot.end) })}
                            </span>
                          )}
                        </button>
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
