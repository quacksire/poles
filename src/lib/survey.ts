import {
  Accessibility,
  Armchair,
  BusFront,
  Check,
  CircleHelp,
  Flag,
  MapPinned,
  Minus,
  ParkingCircle,
  Sparkles,
  TreeDeciduous,
  Umbrella,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { gtfsAgencies } from "@/lib/gtfs";

export type SurveyStatusFilter = "not_surveyed" | "partial" | "done";

export type SurveyAnswerValue = boolean | string | null;

export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export type StopReport = {
  id: string;
  stopId: string;
  contributor: string;
  visitedOn: string;
  notes: string;
  answers: SurveyAnswers;
  createdAt: string;
};

export type SurveyIconName = keyof typeof surveyIcons;

export const surveyIcons = {
  accessibility: Accessibility,
  armchair: Armchair,
  bus_front: BusFront,
  check: Check,
  help: CircleHelp,
  flag: Flag,
  map_pinned: MapPinned,
  minus: Minus,
  parking: ParkingCircle,
  sparkles: Sparkles,
  tree: TreeDeciduous,
  umbrella: Umbrella,
  users: Users,
  users_round: UsersRound,
  x: X,
} as const satisfies Record<string, LucideIcon>;

export type SurveyOption = {
  id: string;
  label: string;
  icon?: SurveyIconName;
  tone?: "samtrans" | "caltrain" | "sfmta" | "other";
  filterLabel?: string;
  summaryLabel?: string;
};

type SurveyQuestionBase = {
  id: string;
  attributeId: string;
  icon?: SurveyIconName;
  prompt: string;
  description: string;
  progressLabel: string;
  filterLabel?: string;
  summaryLabel?: string;
  contributesToCoverage?: boolean;
};

export type SurveyBooleanQuestion = SurveyQuestionBase & {
  type: "boolean";
  trueLabel?: string;
  falseLabel?: string;
};

export type SurveyBooleanValue = "unset" | "true" | "false";

export type SurveySingleChoiceQuestion = SurveyQuestionBase & {
  type: "single-choice";
  options: SurveyOption[];
};

export type SurveyMultiChoiceQuestion = SurveyQuestionBase & {
  type: "multi-choice";
  options: SurveyOption[];
  separator?: string;
};

export type SurveyQuestion =
  | SurveyBooleanQuestion
  | SurveySingleChoiceQuestion
  | SurveyMultiChoiceQuestion;

export type SurveySection = {
  id: string;
  title?: string;
  description?: string;
  questions: SurveyQuestion[];
};

export type SurveyAttributeDefinition = {
  id: string;
  label: string;
  filterLabel: string;
  summaryLabel: string;
  questionId: string;
  contributesToCoverage: boolean;
  icon?: SurveyIconName;
  type: SurveyQuestion["type"];
};

type LegacyStoredReport = {
  id: string;
  stopId: string;
  contributor?: string;
  visitedOn?: string;
  notes?: string;
  createdAt?: string;
  answers?: Partial<Record<string, unknown>>;
  amenities?: Partial<Record<string, string>>;
  signPole?: unknown;
  signShelter?: unknown;
  signStand?: unknown;
  signNone?: unknown;
  sign_location?: unknown;
  wheelchairAccessible?: unknown;
  wheelchair_accessible?: unknown;
  seating?: unknown;
  shelter?: unknown;
  shade?: unknown;
  sharedBy?: unknown;
  shared_by?: unknown;
  stopEnvironment?: unknown;
  stop_environment?: unknown;
  environmentBusBay?: unknown;
  environmentStreet?: unknown;
  environmentParkingLot?: unknown;
};

function questionIcon(icon?: SurveyIconName) {
  return icon;
}

const sharedAgencyOptions: SurveyOption[] = [
  ...gtfsAgencies.map((agency) => ({
    id: agency.name,
    label: agency.name,
    icon: "bus_front" as const,
  })),
  { id: "Other", label: "Other", icon: "help" },
];

// Replace `surveySections` with your own prompts and answer ids.
// Swap the contents of `/gtfs`, adjust the survey config below, and the app UI will follow.
export const surveySections: SurveySection[] = [
  {
    id: "signage",
    questions: [
      {
        id: "sign_location",
        type: "single-choice",
        attributeId: "sign_location",
        icon: questionIcon("flag"),
        prompt: "Where is the stop sign?",
        description: "Pick the closest match.",
        progressLabel: "Sign location",
        contributesToCoverage: true,
        options: [
          { id: "sign_pole", label: "On pole", icon: "flag" },
          { id: "sign_shelter", label: "On shelter", icon: "umbrella" },
          { id: "sign_stand", label: "On stand", icon: "map_pinned" },
          { id: "sign_none", label: "None", icon: "help" },
        ],
      },
      {
        id: "wheelchair_accessible",
        type: "boolean",
        attributeId: "wheelchair_accessible",
        icon: questionIcon("accessibility"),
        prompt: "Is the stop wheelchair accessible?",
        description: "Choose Yes, Unsure, or No.",
        progressLabel: "Wheelchair access",
        filterLabel: "Wheelchair access",
        summaryLabel: "Wheelchair access",
        contributesToCoverage: true,
        trueLabel: "Accessible",
        falseLabel: "Not accessible",
      },
    ],
  },
  {
    id: "amenities",
    questions: [
      {
        id: "seating",
        type: "boolean",
        attributeId: "seating",
        icon: questionIcon("armchair"),
        prompt: "Is there seating or a bench?",
        description: "Choose Yes, Unsure, or No.",
        progressLabel: "Seating",
        filterLabel: "Seating",
        summaryLabel: "Seating",
        contributesToCoverage: true,
      },
      {
        id: "shelter",
        type: "boolean",
        attributeId: "shelter",
        icon: questionIcon("umbrella"),
        prompt: "Is there a shelter?",
        description: "Choose Yes, Unsure, or No.",
        progressLabel: "Shelter",
        filterLabel: "Shelter",
        summaryLabel: "Shelter",
        contributesToCoverage: true,
      },
      {
        id: "shade",
        type: "boolean",
        attributeId: "shade",
        icon: questionIcon("tree"),
        prompt: "Is there shade or other cover?",
        description: "Choose Yes, Unsure, or No.",
        progressLabel: "Shade",
        filterLabel: "Shade",
        summaryLabel: "Shade",
        contributesToCoverage: true,
      },
    ],
  },
  {
    id: "ownership",
    questions: [
      {
        id: "shared_by",
        type: "multi-choice",
        attributeId: "shared_by",
        icon: questionIcon("users_round"),
        prompt: "Which agencies share this stop?",
        description: "Select every agency that applies.",
        progressLabel: "Shared by",
        filterLabel: "Shared by",
        summaryLabel: "Shared by",
        contributesToCoverage: true,
        options: sharedAgencyOptions,
      },
    ],
  },
  {
    id: "environment",
    questions: [
      {
        id: "stop_environment",
        type: "single-choice",
        attributeId: "stop_environment",
        icon: questionIcon("parking"),
        prompt: "Where is the stop?",
        description: "Pick the setting the bus actually pulls into.",
        progressLabel: "Stop setting",
        filterLabel: "Stop setting",
        summaryLabel: "Stop setting",
        contributesToCoverage: true,
        options: [
          {
            id: "environment_bus_bay",
            label: "Bus bay",
            icon: "bus_front",
          },
          {
            id: "environment_street",
            label: "On street",
            icon: "map_pinned",
          },
          {
            id: "environment_parking_lot",
            label: "Parking lot",
            icon: "parking",
          },
        ],
      },
    ],
  },
];

export const surveyQuestions = surveySections.flatMap((section) => section.questions);
const coverageQuestions = surveyQuestions.filter(
  (question) => question.contributesToCoverage !== false,
);

export const surveyAttributeDefinitions: SurveyAttributeDefinition[] =
  surveyQuestions.map((question) => ({
    id: question.attributeId,
    label: question.prompt,
    filterLabel: question.filterLabel ?? question.prompt,
    summaryLabel: question.summaryLabel ?? question.prompt,
    questionId: question.id,
    contributesToCoverage: question.contributesToCoverage !== false,
    icon: question.icon,
    type: question.type,
  }));

export const surveyFilterDefinitions = surveyAttributeDefinitions.map((attribute) => ({
  id: attribute.id,
  label: attribute.filterLabel,
  icon: attribute.icon,
}));

const surveyAttributeMap = new Map(
  surveyAttributeDefinitions.map((attribute) => [attribute.id, attribute]),
);

const surveyQuestionMap = new Map(
  surveyQuestions.map((question) => [question.id, question]),
);

function parseBooleanValue(value: unknown): boolean | null {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  return null;
}

function parseStringValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function selectedOptionIdFromLegacyBooleans(
  rawAnswers: Partial<Record<string, unknown>>,
  question: SurveySingleChoiceQuestion | SurveyMultiChoiceQuestion,
) {
  const selected = question.options.filter((option) => parseBooleanValue(rawAnswers[option.id]) === true);
  return selected.map((option) => option.id);
}

function serializeMultiChoiceValues(
  question: SurveyMultiChoiceQuestion,
  selectedOptionIds: Iterable<string>,
) {
  const selection = new Set(selectedOptionIds);
  const orderedSelections = question.options
    .map((option) => option.id)
    .filter((optionId) => selection.has(optionId));

  return orderedSelections.length ? orderedSelections.join(question.separator ?? "; ") : null;
}

function deserializeMultiChoiceValues(
  question: SurveyMultiChoiceQuestion,
  value: unknown,
) {
  if (Array.isArray(value)) {
    return value
      .map((item) => parseStringValue(item))
      .filter((item): item is string => Boolean(item));
  }

  const text = parseStringValue(value);
  if (!text) return [];

  const separator = question.separator ?? ";";
  return text
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getQuestionAnswerValue(
  rawAnswers: Partial<Record<string, unknown>>,
  question: SurveyQuestion,
) {
  const directValue = rawAnswers[question.attributeId];

  if (question.type === "boolean") {
    const parsed = parseBooleanValue(directValue);
    if (parsed !== null) return parsed;
    return parseBooleanValue(rawAnswers[`${question.attributeId}_value`]);
  }

  if (question.type === "single-choice") {
    const parsed = parseStringValue(directValue);
    if (parsed) return parsed;

    const legacySelected = selectedOptionIdFromLegacyBooleans(rawAnswers, question);
    return legacySelected[0] ?? null;
  }

  const parsed = parseStringValue(directValue);
  if (parsed) return parsed;

  const legacySelected = selectedOptionIdFromLegacyBooleans(rawAnswers, question);
  return serializeMultiChoiceValues(question, legacySelected);
}

export function createEmptySurveyAnswers(): SurveyAnswers {
  return Object.fromEntries(
    surveyAttributeDefinitions.map((attribute) => [attribute.id, null]),
  );
}

export function mergeSurveyAnswers(
  rawAnswers?: Partial<Record<string, unknown>>,
): SurveyAnswers {
  const answers = createEmptySurveyAnswers();

  if (!rawAnswers) return answers;

  for (const question of surveyQuestions) {
    answers[question.attributeId] = getQuestionAnswerValue(rawAnswers, question);
  }

  return answers;
}

export function normalizeStoredReport(rawReport: unknown): StopReport | null {
  if (!rawReport || typeof rawReport !== "object") return null;

  const candidate = rawReport as LegacyStoredReport;
  if (!candidate.id || !candidate.stopId) return null;

  const createdAt = candidate.createdAt ?? new Date().toISOString();
  const contributor = candidate.contributor ?? "";
  const visitedOn = candidate.visitedOn ?? createdAt.slice(0, 10);
  const notes = candidate.notes ?? "";
  const rawAnswers =
    candidate.answers && typeof candidate.answers === "object"
      ? candidate.answers
      : candidate;

  return {
    id: candidate.id,
    stopId: candidate.stopId,
    contributor,
    visitedOn,
    notes,
    answers: mergeSurveyAnswers(rawAnswers),
    createdAt,
  };
}

export function isQuestionAnswered(
  question: SurveyQuestion,
  answers: SurveyAnswers,
): boolean {
  const value = answers[question.attributeId];

  if (question.type === "boolean") {
    return value !== null;
  }

  if (typeof value !== "string") return false;
  return value.trim().length > 0;
}

export function getSingleChoiceValue(
  question: SurveySingleChoiceQuestion,
  answers: SurveyAnswers,
): string {
  const value = answers[question.attributeId];
  if (typeof value !== "string") return "";
  return value;
}

export function setSingleChoiceAnswer(
  currentAnswers: SurveyAnswers,
  question: SurveySingleChoiceQuestion,
  nextOptionId: string,
): SurveyAnswers {
  return {
    ...currentAnswers,
    [question.attributeId]: nextOptionId || null,
  };
}

export function getMultiChoiceValues(
  question: SurveyMultiChoiceQuestion,
  answers: SurveyAnswers,
): string[] {
  const value = answers[question.attributeId];
  if (typeof value !== "string") return [];

  return deserializeMultiChoiceValues(question, value).filter((optionId) =>
    question.options.some((option) => option.id === optionId),
  );
}

export function setMultiChoiceAnswer(
  currentAnswers: SurveyAnswers,
  question: SurveyMultiChoiceQuestion,
  selectedOptionIds: string[],
): SurveyAnswers {
  return {
    ...currentAnswers,
    [question.attributeId]: serializeMultiChoiceValues(question, selectedOptionIds),
  };
}

export function toggleMultiChoiceAnswer(
  currentAnswers: SurveyAnswers,
  question: SurveyMultiChoiceQuestion,
  optionId: string,
): SurveyAnswers {
  const selected = new Set(getMultiChoiceValues(question, currentAnswers));

  if (selected.has(optionId)) selected.delete(optionId);
  else selected.add(optionId);

  return setMultiChoiceAnswer(currentAnswers, question, selected);
}

export function getBooleanValue(
  question: SurveyBooleanQuestion,
  answers: SurveyAnswers,
): SurveyBooleanValue {
  const value = answers[question.attributeId];
  if (value === true) return "true";
  if (value === false) return "false";
  return "unset";
}

export function setBooleanAnswer(
  currentAnswers: SurveyAnswers,
  question: SurveyBooleanQuestion,
  nextValue: SurveyBooleanValue,
): SurveyAnswers {
  return {
    ...currentAnswers,
    [question.attributeId]:
      nextValue === "true" ? true : nextValue === "false" ? false : null,
  };
}

export function countAnsweredQuestions(answers: SurveyAnswers): number {
  return coverageQuestions.reduce(
    (count, question) => count + Number(isQuestionAnswered(question, answers)),
    0,
  );
}

export function surveyStatusBand(
  answers: SurveyAnswers,
  reportCount: number,
): SurveyStatusFilter {
  if (reportCount === 0) return "not_surveyed";

  const answeredQuestionCount = countAnsweredQuestions(answers);
  if (answeredQuestionCount === 0) return "not_surveyed";
  if (answeredQuestionCount === coverageQuestions.length) return "done";

  return "partial";
}

export function activeSurveyFilters(answers: SurveyAnswers): Set<string> {
  return new Set(
    surveyQuestions
      .filter((question) => isQuestionAnswered(question, answers))
      .map((question) => question.attributeId),
  );
}

export function surveyQuestionStates(answers: SurveyAnswers) {
  return surveyQuestions.map((question) => ({
    label: question.progressLabel,
    done: isQuestionAnswered(question, answers),
  }));
}

function describeSelectedOptionLabels(
  options: SurveyOption[],
  selectedOptionIds: string[],
) {
  const selected = selectedOptionIds.map(
    (optionId) => options.find((option) => option.id === optionId)?.summaryLabel ?? options.find((option) => option.id === optionId)?.label ?? optionId,
  );
  return selected.filter(Boolean);
}

export function describeQuestionAnswer(
  question: SurveyQuestion,
  answers: SurveyAnswers,
): string {
  const attribute = surveyAttributeMap.get(question.attributeId);

  if (question.type === "boolean") {
    const value = answers[question.attributeId];
    return `${attribute?.summaryLabel ?? question.prompt}: ${
      value === null ? "Unsure" : value ? question.trueLabel ?? "Yes" : question.falseLabel ?? "No"
    }`;
  }

  if (question.type === "single-choice") {
    const selectedOption = question.options.find(
      (option) => answers[question.attributeId] === option.id,
    );
    return `${attribute?.summaryLabel ?? question.prompt}: ${
      selectedOption?.summaryLabel ?? selectedOption?.label ?? "Not answered"
    }`;
  }

  const selectedOptionIds = getMultiChoiceValues(question, answers);
  const selectedLabels = describeSelectedOptionLabels(question.options, selectedOptionIds);
  return `${attribute?.summaryLabel ?? question.prompt}: ${
    selectedLabels.length ? selectedLabels.join("; ") : "Not answered"
  }`;
}

export function findQuestion(questionId: string): SurveyQuestion | undefined {
  return surveyQuestionMap.get(questionId);
}
