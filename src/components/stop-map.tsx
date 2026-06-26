"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Flag,
  Clock3,
  Info,
  NotebookPen,
  SlidersHorizontal,
  MapPin,
  Minus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { stopBounds, stopCenter, stops, type NormalizedStop } from "@/lib/stops";
import {
  activeSurveyFilters,
  countAnsweredQuestions,
  createEmptySurveyAnswers,
  describeQuestionAnswer,
  findQuestion,
  getBooleanValue,
  getMultiChoiceValues,
  getSingleChoiceValue,
  normalizeStoredReport,
  mergeSurveyAnswers,
  setBooleanAnswer,
  setSingleChoiceAnswer,
  setMultiChoiceAnswer,
  surveyFilterDefinitions,
  surveyQuestionStates,
  surveyQuestions,
  surveySections,
  surveyStatusBand,
  surveyIcons,
  type SurveyIconName,
  type StopReport,
  type SurveyAnswers,
  type SurveyBooleanValue,
  type SurveyMultiChoiceQuestion,
  type SurveyStatusFilter,
} from "@/lib/survey";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Drawer,
  DrawerContent,
  DrawerHandle,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  Map as BaseMap,
  MapControls,
  MapMarker,
  MarkerContent,
  type MapRef,
} from "@/components/ui/map";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MOBILE_SNAP_POINTS = [0.34, 0.9] as const;
const QUESTION_CARD_CLASS =
  "grid grid-cols-[minmax(0,1.45fr)_minmax(9.5rem,11.5rem)] items-center gap-2 rounded-2xl border border-border/90 bg-gradient-to-b from-background to-secondary/40 px-3 py-2.5 transition-[border-color,background-color] duration-150 ease-out hover:border-primary/20 hover:bg-background sm:px-4";
const QUESTION_PROMPT_CLASS = "flex min-w-0 items-start gap-2";
const QUESTION_TABS_LIST_CLASS =
  "!grid !h-auto !w-full items-stretch justify-stretch gap-1 rounded-xl bg-secondary/70 p-1";
const QUESTION_TABS_TRIGGER_CLASS =
  "h-9 rounded-lg border border-transparent bg-transparent px-2 text-[12px] text-foreground/72 shadow-none transition-[color,background-color,border-color] duration-150 ease-out hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-none";
const QUESTION_ICON_PILL_CLASS =
  "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-primary";

const STOP_DRAWER_TABS = [
  { value: "summary", label: "Summary", icon: Sparkles },
  { value: "log", label: "Log", icon: NotebookPen },
  { value: "details", label: "Details", icon: Info },
  { value: "visits", label: "Visits", icon: Clock3 },
] as const;

const BOOLEAN_TAB_OPTIONS = [
  {
    value: "false",
    label: "No",
    pillClassName: "bg-rose-100 text-rose-800",
    activeClassName:
      "border-rose-300 bg-rose-50 text-rose-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
    icon: X,
  },
  {
    value: "unset",
    label: "Unsure",
    pillClassName: "bg-amber-100 text-amber-900",
    activeClassName:
      "border-amber-300 bg-amber-50 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
    icon: Minus,
  },
  {
    value: "true",
    label: "Yes",
    pillClassName: "bg-emerald-100 text-emerald-800",
    activeClassName:
      "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    icon: Check,
  },
] as const satisfies ReadonlyArray<{
  value: SurveyBooleanValue;
  label: string;
  pillClassName: string;
  activeClassName: string;
  icon: typeof Check;
}>;

type ReportDraft = {
  contributor: string;
  visitedOn: string;
  notes: string;
  answers: SurveyAnswers;
};

type StopSurveySummary = {
  latestReport: StopReport | null;
  reportCount: number;
  answeredQuestionCount: number;
  activeFilters: Set<string>;
  statusBand: SurveyStatusFilter;
};

function createDraftFromReport(report: StopReport | null = null): ReportDraft {
  return {
    contributor: "",
    visitedOn: new Date().toISOString().slice(0, 10),
    notes: "",
    answers: report ? mergeSurveyAnswers(report.answers) : createEmptySurveyAnswers(),
  };
}

function getQuestionIcon(icon?: SurveyIconName) {
  if (!icon) return null;
  return surveyIcons[icon] ?? null;
}

function QuestionIcon({
  icon,
  className,
}: {
  icon?: SurveyIconName;
  className?: string;
}) {
  const Icon = getQuestionIcon(icon);
  if (!Icon) return null;

  return (
    <span className={cn(QUESTION_ICON_PILL_CLASS, className)}>
      <Icon className="size-3.5" />
    </span>
  );
}

function getSnapshotTone(
  question: (typeof surveyQuestions)[number],
  answers: SurveyAnswers,
) {
  if (question.type === "boolean") {
    const value = getBooleanValue(question, answers);

    if (value === true) {
      return {
        wrapperClassName: "border-emerald-200 bg-emerald-50/75",
        iconClassName: "bg-emerald-100 text-emerald-700",
        valueClassName: "text-emerald-900",
      };
    }

    if (value === false) {
      return {
        wrapperClassName: "border-rose-200 bg-rose-50/75",
        iconClassName: "bg-rose-100 text-rose-700",
        valueClassName: "text-rose-900",
      };
    }

    return {
      wrapperClassName: "border-amber-200 bg-amber-50/75",
      iconClassName: "bg-amber-100 text-amber-800",
      valueClassName: "text-amber-900",
    };
  }

  const selectedCount =
    question.type === "single-choice"
      ? getSingleChoiceValue(question, answers)
        ? 1
        : 0
      : getMultiChoiceValues(question, answers).length;

  return {
    wrapperClassName:
      selectedCount > 0
        ? "border-border/70 bg-background/90"
        : "border-amber-200 bg-amber-50/75",
    iconClassName:
      selectedCount > 0
        ? "bg-primary/10 text-primary"
        : "bg-amber-100 text-amber-800",
    valueClassName: selectedCount > 0 ? "text-foreground" : "text-amber-900",
  };
}

const agencyToneClasses: Record<
  NonNullable<NonNullable<SurveyMultiChoiceQuestion["options"][number]["tone"]>>,
  string
> = {
  samtrans: "border-sky-200 bg-sky-50 text-sky-800",
  caltrain: "border-rose-200 bg-rose-50 text-rose-800",
  sfmta: "border-red-200 bg-red-50 text-red-800",
  other: "border-border bg-muted/70 text-muted-foreground",
};

function AgencyMultiSelectField({
  question,
  value,
  seed,
  onChange,
}: {
  question: SurveyMultiChoiceQuestion;
  value: string[];
  seed: number;
  onChange: (nextValues: string[]) => void;
}) {
  const anchorRef = useComboboxAnchor();

  return (
    <Combobox
      key={`${question.id}:${seed}`}
      multiple
      autoHighlight
      items={question.options.map((option) => option.id)}
      defaultValue={value}
      onValueChange={(nextValues) => onChange(nextValues)}
      itemToStringLabel={(optionId) =>
        question.options.find((option) => option.id === optionId)?.label ?? optionId
      }
      itemToStringValue={(optionId) => optionId}
    >
      <ComboboxChips ref={anchorRef} className="w-full">
        <ComboboxValue>
          {(values) => (
            <>
              {values.map((optionId: string) => {
                const option =
                  question.options.find((item) => item.id === optionId) ??
                  ({ id: optionId, label: optionId } as (typeof question.options)[number]);
                const OptionIcon = getQuestionIcon(option.icon);

                return (
                  <ComboboxChip
                    key={option.id}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px] font-medium shadow-none",
                      option.tone
                        ? agencyToneClasses[option.tone]
                        : "border-border bg-muted text-foreground",
                    )}
                  >
                    {OptionIcon ? <OptionIcon className="size-3.5" /> : null}
                    <span>{option.label}</span>
                  </ComboboxChip>
                );
              })}
              <ComboboxChipsInput />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchorRef}>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(item) => {
            const option = question.options.find((candidate) => candidate.id === item);
            const OptionIcon = option ? getQuestionIcon(option.icon) : null;

            return (
              <ComboboxItem
                key={item}
                value={item}
                className={cn(
                  "rounded-full border px-3 py-2 text-[12px] font-medium transition-colors",
                  option?.tone
                    ? agencyToneClasses[option.tone]
                    : "border-border bg-background text-foreground",
                )}
              >
                {OptionIcon ? <OptionIcon className="size-3.5" /> : null}
                <span>{option?.label ?? item}</span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function getQuestionSummaryValue(
  question: (typeof surveyQuestions)[number],
  answers: SurveyAnswers,
) {
  const value = describeQuestionAnswer(question, answers);
  const prefix = `${question.prompt}: `;

  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function createStatusFilters(): Record<SurveyStatusFilter, boolean> {
  return {
    not_surveyed: true,
    partial: true,
    done: true,
  };
}

function createAttributeFilters(): Record<string, boolean> {
  return Object.fromEntries(
    surveyFilterDefinitions.map((filter) => [filter.id, false]),
  ) as Record<string, boolean>;
}

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    // Fall back to the generic error below.
  }

  return `Request failed (${response.status}).`;
}

async function fetchReports(signal?: AbortSignal) {
  const response = await fetch("/api/reports", { signal });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const payload = (await response.json()) as { reports?: unknown[] };
  if (!Array.isArray(payload.reports)) return [];

  return payload.reports
    .map((item) => normalizeStoredReport(item))
    .filter((item): item is StopReport => Boolean(item));
}

async function createReport(
  payload: Pick<StopReport, "stopId" | "contributor" | "visitedOn" | "notes" | "answers">,
) {
  const response = await fetch("/api/reports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = (await response.json()) as { report?: unknown };
  const report = normalizeStoredReport(data.report);
  if (!report) {
    throw new Error("Saved report could not be read back from the server.");
  }

  return report;
}

function isSurveyBooleanValue(value: string): value is SurveyBooleanValue {
  return value === "unset" || value === "true" || value === "false";
}

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 960px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}
function formatReportDate(value: string) {
  if (!value) return "Date not provided";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function locationSummary(stop: NormalizedStop) {
  return [stop.parentName, stop.stopDomain, stop.levelName]
    .filter(Boolean)
    .join(" • ");
}

function dataSignalLabel(stop: NormalizedStop) {
  if (stop.wheelchairBoarding === 1) return "Boarding flagged";
  if (stop.parentName) return "Hub-linked";
  if (stop.stopUrl) return "Reference-linked";
  return "Needs field visit";
}

function signalTone(stop: NormalizedStop) {
  if (stop.wheelchairBoarding === 1) return "bg-primary/12 text-primary";
  if (stop.parentName) return "bg-accent text-accent-foreground";
  return "bg-muted text-muted-foreground";
}

function statusTone(statusBand: SurveyStatusFilter | null | undefined) {
  if (statusBand === "done") {
    return "border-emerald-200 bg-emerald-50/70";
  }

  if (statusBand === "partial") {
    return "border-amber-200 bg-amber-50/70";
  }

  if (statusBand === "not_surveyed") {
    return "border-rose-200 bg-rose-50/70";
  }

  return "border-border/80 bg-linear-to-r from-primary/7 via-background to-secondary/70";
}

function crowdCoverage(reports: StopReport[]) {
  const distinctStops = new Set(reports.map((report) => report.stopId));
  return {
    totalReports: reports.length,
    totalStops: distinctStops.size,
  };
}

function boundsForStops(stopList: NormalizedStop[]) {
  if (!stopList.length) return stopBounds;

  const longitudes = stopList.map((stop) => stop.coordinates[0]);
  const latitudes = stopList.map((stop) => stop.coordinates[1]);

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ] as [[number, number], [number, number]];
}

function StopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
    >
      <path fill="currentColor" d="M19 5H5v9h14z" />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 20v-6m0-9h14v9H5m0-9v9m0-9V4"
      />
    </svg>
  );
}

function StopMarker({
  selected,
  statusBand,
  reportCount,
}: {
  selected: boolean;
  statusBand: SurveyStatusFilter;
  reportCount: number;
}) {
  const markerTone =
    statusBand === "not_surveyed"
      ? "border-rose-300 bg-rose-500"
      : statusBand === "partial"
        ? "border-amber-300 bg-amber-100"
        : "border-emerald-400 bg-emerald-500";

  return (
    <div className="relative grid place-items-center">
      {selected ? (
        <>
          <span className="absolute size-7 rounded-full bg-primary/10" />
          <span className="relative size-3 rounded-full border-2 border-white bg-primary" />
        </>
      ) : (
        <span
          className={cn(
            "relative size-3 rounded-full border-2 border-white shadow-[0_2px_10px_rgba(25,49,83,0.18)]",
            markerTone,
          )}
        />
      )}
      {!selected && reportCount > 0 ? (
        <span className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-foreground px-1 text-[9px] font-medium text-background">
          {reportCount}
        </span>
      ) : null}
    </div>
  );
}

export function StopMap() {
  const mapRef = useRef<MapRef>(null);
  const reportFormRef = useRef<HTMLFormElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const focusSurveyOnSelectRef = useRef(false);
  const defaultViewportAppliedRef = useRef<"desktop" | "mobile" | null>(null);
  const isDesktop = useDesktopLayout();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeSnapPoint, setActiveSnapPoint] = useState<number | string | null>(
    MOBILE_SNAP_POINTS[0],
  );
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedStopTab, setSelectedStopTab] = useState("summary");
  const [searchValue, setSearchValue] = useState("");
  const deferredSearch = useDeferredValue(searchValue.trim().toLowerCase());
  const [reports, setReports] = useState<StopReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [multiChoiceDraftSeed, setMultiChoiceDraftSeed] = useState(0);
  const [mapFiltersOpen, setMapFiltersOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState(createStatusFilters);
  const [attributeFilters, setAttributeFilters] = useState(createAttributeFilters);
  const [draft, setDraft] = useState<ReportDraft>(() => createDraftFromReport());

  async function loadReports() {
    setIsLoadingReports(true);
    setLoadError(null);

    try {
      setReports(await fetchReports());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load field visits.";
      setLoadError(message);
    } finally {
      setIsLoadingReports(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    setIsLoadingReports(true);
    setLoadError(null);

    void fetchReports(controller.signal)
      .then((nextReports) => setReports(nextReports))
      .catch((error) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Failed to load field visits.";
        setLoadError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingReports(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mapFiltersOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!filterPopoverRef.current?.contains(event.target as Node)) {
        setMapFiltersOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [mapFiltersOpen]);

  useEffect(() => {
    if (isDesktop) {
      setDrawerOpen(true);
      setActiveSnapPoint(null);
      return;
    }

    setActiveSnapPoint((current) => current ?? MOBILE_SNAP_POINTS[0]);
  }, [isDesktop]);

  const reportCoverage = useMemo(() => crowdCoverage(reports), [reports]);

  const reportSummaryByStop = useMemo(() => {
    const grouped = new Map<string, StopReport[]>();

    for (const report of reports) {
      const bucket = grouped.get(report.stopId);
      if (bucket) bucket.push(report);
      else grouped.set(report.stopId, [report]);
    }

    const summary = new Map<string, StopSurveySummary>();

    for (const stop of stops) {
      const stopReports = (grouped.get(stop.id) ?? []).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      );
      const latestReport = stopReports[0] ?? null;
      const answeredQuestionCount = latestReport
        ? countAnsweredQuestions(latestReport.answers)
        : 0;

      summary.set(stop.id, {
        latestReport,
        reportCount: stopReports.length,
        answeredQuestionCount,
        activeFilters: latestReport
          ? activeSurveyFilters(latestReport.answers)
          : new Set<string>(),
        statusBand: latestReport
          ? surveyStatusBand(latestReport.answers, stopReports.length)
          : surveyStatusBand(createEmptySurveyAnswers(), stopReports.length),
      });
    }

    return summary;
  }, [reports]);

  const statusCounts = useMemo(() => {
    const counts: Record<SurveyStatusFilter, number> = {
      not_surveyed: 0,
      partial: 0,
      done: 0,
    };

    for (const summary of reportSummaryByStop.values()) {
      counts[summary.statusBand] += 1;
    }

    return counts;
  }, [reportSummaryByStop]);

  const activeStatusFilters = useMemo(
    () =>
      Object.entries(statusFilters)
        .filter(([, enabled]) => enabled)
        .map(([filter]) => filter as SurveyStatusFilter),
    [statusFilters],
  );

  const activeAttributeFilters = useMemo(
    () =>
      Object.entries(attributeFilters)
        .filter(([, enabled]) => enabled)
        .map(([filter]) => filter),
    [attributeFilters],
  );

  const activeMapFilterCount = useMemo(() => {
    const disabledStatusCount = Object.values(statusFilters).filter(
      (enabled) => !enabled,
    ).length;

    return disabledStatusCount + activeAttributeFilters.length;
  }, [activeAttributeFilters.length, statusFilters]);

  const filteredStops = useMemo(() => {
    return stops.filter((stop) => {
      const summary = reportSummaryByStop.get(stop.id);
      if (!summary) return false;

      if (deferredSearch && !stop.searchText.includes(deferredSearch)) {
        return false;
      }

      if (
        activeStatusFilters.length > 0 &&
        !activeStatusFilters.includes(summary.statusBand)
      ) {
        return false;
      }

      if (
        activeAttributeFilters.length > 0 &&
        !activeAttributeFilters.every((filter) => summary.activeFilters.has(filter))
      ) {
        return false;
      }

      return true;
    });
  }, [
    activeAttributeFilters,
    activeStatusFilters,
    deferredSearch,
    reportSummaryByStop,
  ]);

  const selectedStop = useMemo(() => {
    if (!selectedStopId) return null;
    return stops.find((stop) => stop.id === selectedStopId) ?? null;
  }, [selectedStopId]);

  const selectedReports = useMemo(() => {
    if (!selectedStop) return [];

    return reports
      .filter((report) => report.stopId === selectedStop.id)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [reports, selectedStop]);

  const selectedSummary = selectedStop
    ? reportSummaryByStop.get(selectedStop.id) ?? null
    : null;
  const latestSelectedReport = selectedSummary?.latestReport ?? null;
  const hasLoggedVisit = Boolean(latestSelectedReport);
  const draftQuestionStates = useMemo(
    () => surveyQuestionStates(draft.answers),
    [draft.answers],
  );
  const completedDraftQuestions = draftQuestionStates.filter(
    (question) => question.done,
  ).length;

  useEffect(() => {
    setDraft(createDraftFromReport());
    setReportNotice(null);
    setSaveError(null);
    setSelectedStopTab("summary");
    setMultiChoiceDraftSeed((current) => current + 1);
  }, [selectedStopId]);

  useEffect(() => {
    if (isDesktop) return;
    if (!drawerOpen) return;

    setActiveSnapPoint(
      selectedStop ? MOBILE_SNAP_POINTS[1] : MOBILE_SNAP_POINTS[0],
    );
  }, [drawerOpen, isDesktop, selectedStop]);

  useEffect(() => {
    if (!mapRef.current || selectedStop) return;

    const layout = isDesktop ? "desktop" : "mobile";
    const nextBounds = boundsForStops(filteredStops);

    mapRef.current.fitBounds(nextBounds, {
      duration: defaultViewportAppliedRef.current === null ? 0 : 450,
      padding: isDesktop
        ? { top: 64, right: 48, bottom: 64, left: 500 }
        : { top: 72, right: 24, bottom: 360, left: 24 },
      maxZoom: 13,
    });
    defaultViewportAppliedRef.current = layout;
  }, [filteredStops, isDesktop, selectedStop]);

  useEffect(() => {
    if (!selectedStop || !mapRef.current) return;

    mapRef.current.easeTo({
      center: selectedStop.coordinates,
      zoom: 14.5,
      duration: 500,
    });
    setDrawerOpen(true);
    if (!isDesktop) {
      setActiveSnapPoint(MOBILE_SNAP_POINTS[1]);
    }

    if (focusSurveyOnSelectRef.current) {
      const delay = isDesktop ? 120 : 260;
      window.setTimeout(() => {
        reportFormRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, delay);
      focusSurveyOnSelectRef.current = false;
    }
  }, [isDesktop, selectedStop]);

  function selectStop(stopId: string, options?: { focusSurvey?: boolean }) {
    focusSurveyOnSelectRef.current = Boolean(options?.focusSurvey);
    setSelectedStopTab("summary");
    setSelectedStopId(stopId);
  }

  function toggleStatusFilter(filter: SurveyStatusFilter) {
    setStatusFilters((current) => ({
      ...current,
      [filter]: !current[filter],
    }));
  }

  function toggleAttributeFilter(filter: string) {
    setAttributeFilters((current) => ({
      ...current,
      [filter]: !current[filter],
    }));
  }

  function resetMapFilters() {
    setStatusFilters(createStatusFilters());
    setAttributeFilters(createAttributeFilters());
  }

  function updateSingleChoiceQuestion(questionId: string, optionId: string) {
    const question = findQuestion(questionId);
    if (!question || question.type !== "single-choice") return;

    setDraft((current) => ({
      ...current,
      answers: setSingleChoiceAnswer(current.answers, question, optionId),
    }));
  }

  function updateBooleanQuestion(questionId: string, nextValue: SurveyBooleanValue) {
    const question = findQuestion(questionId);
    if (!question || question.type !== "boolean") return;

    setDraft((current) => ({
      ...current,
      answers: setBooleanAnswer(current.answers, question, nextValue),
    }));
  }

  function focusSurveyForm() {
    setSelectedStopTab("log");
    setDraft(createDraftFromReport(selectedSummary?.latestReport));
    setMultiChoiceDraftSeed((current) => current + 1);
    if (!isDesktop) {
      setDrawerOpen(true);
      setActiveSnapPoint(MOBILE_SNAP_POINTS[1]);
    }
    reportFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStop || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setReportNotice(null);

    try {
      const nextReport = await createReport({
        stopId: selectedStop.id,
        contributor: draft.contributor,
        visitedOn: draft.visitedOn,
        notes: draft.notes,
        answers: draft.answers,
      });

      setReports((current) => [nextReport, ...current]);
      setReportNotice("Field visit saved to D1.");
      setSelectedStopTab("summary");
      if (!isDesktop) {
        setActiveSnapPoint(MOBILE_SNAP_POINTS[1]);
      }
      setDraft(createDraftFromReport(nextReport));
      setMultiChoiceDraftSeed((current) => current + 1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save field visit.";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground">
      <BaseMap
        ref={mapRef}
        center={stopCenter}
        zoom={10}
        minZoom={8}
        maxZoom={17}
        theme="light"
        className="h-full w-full"
      >
        <MapControls />
        {filteredStops.map((stop) => {
          const summary = reportSummaryByStop.get(stop.id);
          if (!summary) return null;

          return (
            <MapMarker
              key={stop.id}
              longitude={stop.coordinates[0]}
              latitude={stop.coordinates[1]}
            >
              <MarkerContent>
                <button
                  type="button"
                  onClick={() => selectStop(stop.id)}
                  className="cursor-pointer"
                  aria-label={`Survey ${stop.name}`}
                >
                  <StopMarker
                    selected={stop.id === selectedStopId}
                    statusBand={summary.statusBand}
                    reportCount={summary.reportCount}
                  />
                </button>
              </MarkerContent>
            </MapMarker>
          );
        })}
      </BaseMap>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-background/72 to-transparent" />
      <div className="absolute right-4 top-4 z-30" ref={filterPopoverRef}>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <Button
            type="button"
            variant="outline"
            aria-haspopup="dialog"
            aria-expanded={mapFiltersOpen}
            aria-label="Open map filters"
            onClick={() => setMapFiltersOpen((current) => !current)}
            className={cn(
              "h-11 rounded-xl border-border/80 bg-card/96 px-3 shadow-[0_6px_18px_rgba(32,42,57,0.12)] backdrop-blur-sm transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card",
              mapFiltersOpen || activeMapFilterCount > 0
                ? "border-primary/30 shadow-[0_8px_20px_rgba(38,127,138,0.18)]"
                : "",
            )}
          >
            <SlidersHorizontal className="size-4" />
            <span className="text-[12px] font-medium">Map filters</span>
            {activeMapFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {activeMapFilterCount}
              </span>
            ) : null}
          </Button>

          {mapFiltersOpen ? (
            <div className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border/90 bg-card/98 p-3 shadow-[0_14px_34px_rgba(32,42,57,0.16)] backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Map filters</p>
                  <p className="text-[12px] text-muted-foreground">
                    {filteredStops.length} stops visible on the map.
                  </p>
                </div>
                {activeMapFilterCount > 0 ? (
                  <button
                    type="button"
                    onClick={resetMapFilters}
                    className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-[12px] font-medium text-foreground">
                    Survey status
                  </p>
                  <div className="grid gap-2">
                    {([
                      ["not_surveyed", "Not surveyed", "bg-rose-500 border-rose-300"],
                      ["partial", "Partially", "bg-amber-100 border-amber-300"],
                      ["done", "Done", "bg-emerald-500 border-emerald-500"],
                    ] as const).map(([filter, label, dotClassName]) => (
                      <label
                        key={filter}
                        className="flex items-center gap-2 rounded-xl border border-border bg-background/90 px-3 py-2 text-[12px]"
                      >
                        <Checkbox
                          checked={statusFilters[filter]}
                          onCheckedChange={() => toggleStatusFilter(filter)}
                        />
                        <span
                          className={cn(
                            "size-2.5 rounded-full border border-white/70",
                            dotClassName,
                          )}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[12px] font-medium text-foreground">
                    Stop features
                  </p>
                  <div className="grid max-h-60 gap-2 overflow-y-auto pr-1">
                    {surveyFilterDefinitions.map((filter) => (
                      <label
                        key={filter.id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-background/90 px-3 py-2 text-[12px]"
                      >
                        <Checkbox
                          checked={attributeFilters[filter.id]}
                          onCheckedChange={() => toggleAttributeFilter(filter.id)}
                        />
                        {filter.icon ? (
                          <span className="grid size-5 place-items-center rounded-full bg-primary/10 text-primary">
                            {(() => {
                              const Icon = getQuestionIcon(filter.icon);
                              return Icon ? <Icon className="size-3" /> : null;
                            })()}
                          </span>
                        ) : null}
                        <span>{filter.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        modal={false}
        dismissible={!isDesktop}
        direction={isDesktop ? "left" : "bottom"}
        snapPoints={isDesktop ? undefined : [...MOBILE_SNAP_POINTS]}
        activeSnapPoint={isDesktop ? null : activeSnapPoint}
        setActiveSnapPoint={isDesktop ? undefined : setActiveSnapPoint}
        fadeFromIndex={1}
        snapToSequentialPoint
      >
        <DrawerContent
          showOverlay={!isDesktop}
          className={cn(
            "overflow-y-clip border border-border bg-card shadow-[0_6px_18px_rgba(32,42,57,0.06)] data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=bottom]:border-x-0 data-[vaul-drawer-direction=bottom]:border-b-0 data-[vaul-drawer-direction=bottom]:max-h-[88dvh] data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-[460px] data-[vaul-drawer-direction=left]:max-w-[calc(100vw-2rem)] data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=left]:border-y-0 data-[vaul-drawer-direction=left]:border-l-0 data-[vaul-drawer-direction=left]:sm:max-w-none",
          )}
        >
          {!isDesktop ? (
            <div className="px-4 pb-1 pt-1">
              <div className="flex flex-col items-center gap-2">
                <DrawerHandle className="mt-0" />
              </div>
            </div>
          ) : null}
          <DrawerHeader className="border-b border-border bg-card p-3.5 !text-left md:p-5">
            {!selectedStop ? (
                <div className="w-full">
                  <div className="min-w-0 space-y-2.5">
                    <div className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-primary/16 to-primary/8 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <StopIcon />
                  </span>
                      <div className="min-w-0">
                        <DrawerTitle className="text-[14px] font-semibold text-foreground">
                          Poles
                        </DrawerTitle>
                        <DrawerDescription className="text-[11px] leading-relaxed text-muted-foreground">
                          Drop in GTFS stop data, tap the map, save a fast field visit.
                        </DrawerDescription>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 rounded-xl border border-border/80 bg-linear-to-r from-secondary/80 via-background to-primary/6">
                      <div className="px-3 py-2">
                        <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Not Surveyed
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {statusCounts.not_surveyed}
                        </p>
                      </div>
                      <div className="border-x border-border/80 px-3 py-2">
                        <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Partially
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {statusCounts.partial}
                        </p>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          Done
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-foreground">
                          {statusCounts.done}
                        </p>
                      </div>
                    </div>

                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                          value={searchValue}
                          onChange={(event) => setSearchValue(event.target.value)}
                          placeholder="Search a stop, code, or hub"
                          className="h-10 rounded-xl border-border bg-background pl-9 text-[12px]"
                      />
                    </label>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-h-5 text-[11px] text-muted-foreground">
                        {isLoadingReports
                            ? "Loading saved field visits…"
                            : loadError
                                ? loadError
                                : `${reportCoverage.totalReports} cloud-synced visits loaded.`}
                      </div>
                      <div className="flex items-center gap-2">
                        {loadError ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void loadReports()}
                            >
                              Retry
                            </Button>
                        ) : null}
                        <a
                            href="/api/reports?format=csv"
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "rounded-xl",
                            )}
                        >
                          <Download className="size-3.5" />
                          Export CSV
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
            ): (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[1.2rem] font-semibold leading-tight text-foreground">
                          {selectedStop.name}
                        </p>
                        {selectedStop.code ? (
                            <Badge variant="outline">Stop {selectedStop.code}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 max-w-[48ch] text-[12px] leading-relaxed text-muted-foreground">
                        {locationSummary(selectedStop) || selectedStop.placeName}
                      </p>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStopId(null)}
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className={signalTone(selectedStop)}>
                      {dataSignalLabel(selectedStop)}
                    </Badge>
                    {selectedSummary ? (
                        <Badge variant="outline">
                          {selectedSummary.reportCount} saved visits
                        </Badge>
                    ) : null}
                    {selectedStop.stopDomain ? (
                        <Badge variant="outline">{selectedStop.stopDomain}</Badge>
                    ) : null}
                  </div>
                </div>
            )}


          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {selectedStop ? (
              <section className="border-b border-border px-3 py-3 md:px-5 md:py-4">
                <Tabs
                  value={selectedStopTab}
                  onValueChange={setSelectedStopTab}
                  className="space-y-3"
                >
                  <TabsList
                    variant="default"
                    className="grid h-10 w-full grid-cols-4 gap-1 rounded-full border border-border/70 bg-secondary/40 p-1"
                  >
                    {STOP_DRAWER_TABS.map((tab) => {
                      const TabIcon = tab.icon;

                      return (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          aria-label={tab.label}
                          title={tab.label}
                        >
                          <TabIcon className="size-4" />
                          <span className="sr-only">{tab.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  <TabsContent value="summary" className="space-y-3 pt-2">
                    <div className="rounded-2xl border border-border/80 bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-foreground">
                            {hasLoggedVisit ? "Latest log" : "No log yet"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          onClick={focusSurveyForm}
                        >
                          {hasLoggedVisit ? "Update log" : "Start log"}
                        </Button>
                      </div>

                      {latestSelectedReport ? (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-2 text-[12px] font-medium text-foreground">
                              <Clock3 className="size-3.5 shrink-0 text-primary" />
                              <span className="truncate">
                                {formatReportDate(latestSelectedReport.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-2 text-[12px] font-medium text-foreground">
                              <Info className="size-3.5 shrink-0 text-primary" />
                              <span className="truncate">
                                {latestSelectedReport.contributor || "Anonymous"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-2 text-[12px] font-medium text-foreground">
                              <Sparkles className="size-3.5 shrink-0 text-primary" />
                              <span>{selectedSummary?.reportCount ?? 0} visits</span>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {surveyQuestions.map((question) => (
                              <div
                                key={question.id}
                                className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-2"
                                aria-label={`${question.prompt}: ${getQuestionSummaryValue(question, latestSelectedReport.answers)}`}
                              >
                                {getQuestionIcon(question.icon) ? (
                                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                                    {(() => {
                                      const Icon = getQuestionIcon(question.icon);
                                      return Icon ? <Icon className="size-4" /> : null;
                                    })()}
                                  </span>
                                ) : null}
                                <p className="sr-only">{question.prompt}</p>
                                <p className="truncate text-[12px] font-medium leading-relaxed text-foreground">
                                  {getQuestionSummaryValue(question, latestSelectedReport.answers)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-xl border border-dashed border-border bg-background/80 p-4 text-[12px] leading-relaxed text-muted-foreground">
                          Save a log to fill this panel.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="log" className="pt-2">
                    <form
                      id="field-visit-form"
                      ref={reportFormRef}
                      className="space-y-4"
                      onSubmit={submitReport}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {hasLoggedVisit ? "Update log" : "Save a log"}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            The answer fields preload from the latest stop log. Notes, name, and date stay fresh.
                          </p>
                        </div>
                        <span
                          aria-live="polite"
                          className={cn(
                            "inline-flex min-h-5 items-center gap-1.5 text-[11px] font-medium",
                            saveError
                              ? "text-destructive"
                              : reportNotice
                                ? "text-primary"
                                : "text-muted-foreground",
                          )}
                        >
                          {isSaving
                            ? "Saving…"
                            : saveError
                              ? saveError
                              : reportNotice ? (
                                <>
                                  <Check className="size-3.5" />
                                  Saved
                                </>
                              ) : (
                                "Cloud-backed"
                              )}
                        </span>
                      </div>

                      {surveySections.map((section) => (
                        <div key={section.id} className="grid gap-3">
                          {section.title ? (
                            <div className="space-y-1">
                              <p className="text-[12px] font-medium text-foreground">
                                {section.title}
                              </p>
                              {section.description ? (
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                  {section.description}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {section.questions.map((question) => {
                            const QuestionLeadIcon = getQuestionIcon(question.icon);

                            if (question.type === "single-choice") {
                              const currentValue = getSingleChoiceValue(question, draft.answers);

                              return (
                                <div key={question.id} className={QUESTION_CARD_CLASS}>
                                  <div className={QUESTION_PROMPT_CLASS}>
                                    {QuestionLeadIcon ? (
                                      <QuestionLeadIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                                    ) : null}
                                    <span className="block min-w-0 text-[13px] font-semibold leading-snug text-foreground">
                                      {question.prompt}
                                    </span>
                                  </div>
                                  <select
                                    value={currentValue}
                                    onChange={(event) =>
                                      updateSingleChoiceQuestion(
                                        question.id,
                                        event.target.value,
                                      )
                                    }
                                    className="h-9 w-full rounded-xl border border-border bg-background/88 px-3 text-[12px] font-medium text-foreground outline-none transition-colors focus:border-ring"
                                  >
                                    <option value="" disabled>
                                      Select one
                                    </option>
                                    {question.options.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              );
                            }

                            if (question.type === "multi-choice") {
                              const currentValues = getMultiChoiceValues(question, draft.answers);

                              return (
                                <div key={question.id} className={QUESTION_CARD_CLASS}>
                                  <div className={QUESTION_PROMPT_CLASS}>
                                    {QuestionLeadIcon ? (
                                      <QuestionLeadIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                                    ) : null}
                                    <span className="block min-w-0 text-[13px] font-semibold leading-snug text-foreground">
                                      {question.prompt}
                                    </span>
                                  </div>
                                  <AgencyMultiSelectField
                                    question={question}
                                    value={currentValues}
                                    seed={multiChoiceDraftSeed}
                                    onChange={(nextValues) =>
                                      setDraft((current) => ({
                                        ...current,
                                        answers: setMultiChoiceAnswer(
                                          current.answers,
                                          question,
                                          nextValues,
                                        ),
                                      }))
                                    }
                                  />
                                </div>
                              );
                            }

                            const currentValue = getBooleanValue(question, draft.answers);

                            return (
                              <div key={question.id} className={QUESTION_CARD_CLASS}>
                                <div className={QUESTION_PROMPT_CLASS}>
                                  {QuestionLeadIcon ? (
                                    <QuestionLeadIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                                  ) : null}
                                  <span className="block min-w-0 text-[13px] font-semibold leading-snug text-foreground">
                                    {question.prompt}
                                  </span>
                                </div>
                                <Tabs
                                  value={currentValue}
                                  onValueChange={(value) => {
                                    if (!isSurveyBooleanValue(value)) return;
                                    updateBooleanQuestion(question.id, value);
                                  }}
                                  className="w-full"
                                >
                                  <TabsList
                                    className={cn(QUESTION_TABS_LIST_CLASS, "grid-cols-3")}
                                  >
                                    {BOOLEAN_TAB_OPTIONS.map((option) => {
                                      const isActive = currentValue === option.value;
                                      const Icon = option.icon;

                                      return (
                                        <TabsTrigger
                                          key={option.value}
                                          value={option.value}
                                          className={cn(
                                            QUESTION_TABS_TRIGGER_CLASS,
                                            "px-0",
                                            isActive
                                              ? option.activeClassName
                                              : "hover:text-foreground",
                                          )}
                                          aria-label={option.label}
                                          title={option.label}
                                        >
                                          <Icon className="size-3.5" />
                                        </TabsTrigger>
                                      );
                                    })}
                                  </TabsList>
                                </Tabs>
                              </div>
                            );
                          })}
                        </div>
                      ))}

                      <div className="space-y-3 border-t border-border pt-4">
                        <p className="text-[12px] font-medium text-foreground">
                          Optional context
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input
                            value={draft.contributor}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                contributor: event.target.value,
                              }))
                            }
                            placeholder="Name or handle"
                          />
                          <Input
                            type="date"
                            value={draft.visitedOn}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                visitedOn: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <Textarea
                          value={draft.notes}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Notes: blocked curb, broken bench, temporary sign, or anything worth flagging."
                          className="min-h-20 rounded-lg"
                        />
                      </div>

                      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-border bg-card/96 px-4 py-3 backdrop-blur-sm md:-mx-5 md:px-5">
                        <div className="space-y-3">
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            {completedDraftQuestions} of {draftQuestionStates.length} prompts answered.
                          </p>
                          <Button
                            type="submit"
                            form="field-visit-form"
                            disabled={isSaving || isLoadingReports}
                            className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-[0_10px_22px_rgba(38,127,138,0.24)] transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[0_12px_26px_rgba(38,127,138,0.28)] active:translate-y-0 active:scale-[0.99]"
                          >
                            {isSaving
                              ? "Saving log…"
                              : hasLoggedVisit
                                ? "Save update"
                                : "Save log"}
                          </Button>
                        </div>
                      </div>
                    </form>
                  </TabsContent>

                  <TabsContent value="details" className="space-y-3 pt-4">
                    <div className="rounded-xl border border-border bg-secondary/45 p-4">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Official signals
                      </p>
                      <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-foreground">
                        <div className="flex items-center gap-2">
                          <Flag className="size-3.5 text-primary" />
                          <span>{selectedStop.wheelchairLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="size-3.5 text-primary" />
                          <span>
                            {selectedStop.parentName
                              ? `Parent hub: ${selectedStop.parentName}`
                              : "Standalone stop in the dataset"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CircleHelp className="size-3.5 text-primary" />
                          <span>
                            {selectedStop.stopUrl
                              ? "Feed reference link available"
                              : "No detail link in the dataset"}
                          </span>
                        </div>
                      </div>
                      {selectedStop.stopUrl ? (
                        <a
                          className="mt-4 inline-flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary/80"
                          href={selectedStop.stopUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open stop reference
                          <ArrowUpRight className="size-3.5" />
                        </a>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Snapshot
                      </p>
                      {selectedSummary?.latestReport ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {surveyQuestions.map((question) => {
                            const snapshotTone = getSnapshotTone(
                              question,
                              selectedSummary.latestReport.answers,
                            );
                            const Icon = getQuestionIcon(question.icon);
                            const valueLabel = getQuestionSummaryValue(
                              question,
                              selectedSummary.latestReport.answers,
                            );

                            return (
                              <div
                                key={question.id}
                                className={cn(
                                  "flex items-center gap-2 rounded-xl border px-3 py-2",
                                  snapshotTone.wrapperClassName,
                                )}
                                aria-label={`${question.prompt}: ${valueLabel}`}
                              >
                                {Icon ? (
                                  <span
                                    className={cn(
                                      "grid size-7 shrink-0 place-items-center rounded-full",
                                      snapshotTone.iconClassName,
                                    )}
                                  >
                                    <Icon className="size-3.5" />
                                  </span>
                                ) : null}
                                <p className="sr-only">{question.prompt}</p>
                                <p
                                  className={cn(
                                    "truncate text-[12px] font-medium leading-relaxed",
                                    snapshotTone.valueClassName,
                                  )}
                                >
                                  {valueLabel}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                          No field visit saved yet for this stop.
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="visits" className="space-y-2 pt-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-3.5 text-primary" />
                      <p className="text-sm font-semibold text-foreground">
                        Recent visits
                      </p>
                    </div>
                    {selectedReports.length ? (
                      <div className="grid gap-2">
                        {selectedReports.slice(0, 5).map((report) => (
                          <article
                            key={report.id}
                            className="rounded-xl border border-border bg-background p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[12px] font-medium text-foreground">
                                {report.contributor || "Anonymous rider"}
                              </p>
                              <span className="text-[11px] text-muted-foreground">
                                {formatReportDate(report.visitedOn || report.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2 text-[12px] text-muted-foreground">
                              {surveyQuestions
                                .map((question) =>
                                  describeQuestionAnswer(question, report.answers),
                                )
                                .join(" • ")}
                            </p>
                            {report.notes ? (
                              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                                {report.notes}
                              </p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-4 text-[12px] leading-relaxed text-muted-foreground">
                        No field visits saved yet for this stop.
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </section>
            ) : (
              <section className="border-b border-border p-4 md:p-5">
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">
                    Tap any stop to start the survey
                  </p>
                  <p className="mt-2 max-w-[36ch] text-[12px] leading-relaxed text-muted-foreground">
                    Replace `stops.json`, tweak the survey config, and this same
                    flow works for another agency without rebuilding the form by hand.
                  </p>
                </div>
              </section>
            )}

            <section className="p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {deferredSearch ? "Matching stops" : "Visible stops"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {filteredStops.length} stops match the current filters.
                  </p>
                </div>
                <Badge variant="outline">{reportCoverage.totalReports} visits</Badge>
              </div>

              <div className="grid gap-2">
                {filteredStops.map((stop) => {
                  const summary = reportSummaryByStop.get(stop.id);
                  if (!summary) return null;
                  const isSelected = stop.id === selectedStopId;

                  return (
                    <button
                      key={stop.id}
                      type="button"
                      onClick={() => selectStop(stop.id)}
                      className={cn(
                        "group w-full rounded-xl border p-3 text-left transition-colors duration-150 ease-out",
                        isSelected
                          ? "border-primary/25 bg-primary/6"
                          : "border-border/80 bg-background hover:border-primary/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] font-medium text-foreground">
                              {stop.name}
                            </p>
                            {stop.code ? (
                              <span className="text-[11px] text-muted-foreground">
                                {stop.code}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {locationSummary(stop) || stop.wheelchairLabel}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-medium",
                              summary.statusBand === "not_surveyed"
                                ? "bg-muted text-muted-foreground"
                                : summary.statusBand === "done"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700",
                            )}
                          >
                            {summary.statusBand === "not_surveyed"
                              ? "Not surveyed"
                              : summary.statusBand === "partial"
                                ? "Partially"
                                : "Done"}
                          </span>
                          {summary.reportCount ? (
                            <span className="rounded-md bg-background px-2 py-1 text-[11px] font-medium text-foreground">
                              {summary.reportCount}
                            </span>
                          ) : null}
                          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </DrawerContent>
      </Drawer>

      {!isDesktop && !drawerOpen ? (
        <Button
          type="button"
          size="sm"
          onClick={() => setDrawerOpen(true)}
          className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-lg shadow-[0_8px_20px_rgba(25,49,83,0.14)]"
        >
          Open stop panel
        </Button>
      ) : null}
    </div>
  );
}
