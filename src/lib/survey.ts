export type SurveyStatusFilter = "not_surveyed" | "partial" | "done";

export type SurveyAnswerValue = boolean | null;

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

export type SurveyOption = {
  id: string;
  label: string;
  filterLabel?: string;
  summaryLabel?: string;
};

export type SurveyBooleanQuestion = {
  id: string;
  type: "boolean";
  attributeId: string;
  prompt: string;
  description: string;
  progressLabel: string;
  filterLabel?: string;
  summaryLabel?: string;
  contributesToCoverage?: boolean;
  completion?: "implicit" | "explicit";
  trueLabel?: string;
  falseLabel?: string;
};

export type SurveyBooleanValue = "unset" | "true" | "false";

export type SurveySingleChoiceQuestion = {
  id: string;
  type: "single-choice";
  prompt: string;
  description: string;
  progressLabel: string;
  options: SurveyOption[];
};

export type SurveyQuestion = SurveyBooleanQuestion | SurveySingleChoiceQuestion;

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
  seating?: unknown;
  shelter?: unknown;
  shade?: unknown;
  environmentBusBay?: unknown;
  environmentStreet?: unknown;
  environmentParkingLot?: unknown;
};

// Replace `surveySections` with your own prompts and answer ids.
// Swap in another `stops.json`, adjust the question config below, and the app UI will follow.
export const surveySections: SurveySection[] = [
  {
    id: "signage",
    questions: [
      {
        id: "sign_location",
        type: "single-choice",
        prompt: "Where is the stop sign?",
        description: "Pick the closest match.",
        progressLabel: "Sign location",
        options: [
          { id: "sign_pole", label: "On pole", filterLabel: "Sign on pole" },
          {
            id: "sign_shelter",
            label: "On shelter",
            filterLabel: "Sign on shelter",
          },
          { id: "sign_stand", label: "On stand", filterLabel: "Sign on stand" },
          { id: "sign_none", label: "None", filterLabel: "No sign" },
        ],
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
        prompt: "Is there seating or a bench?",
        description: "Choose Yes, Unsure, or No.",
        progressLabel: "Seating",
        filterLabel: "Seating",
        summaryLabel: "Seating",
        contributesToCoverage: true,
        completion: "explicit",
      },
      {
        id: "shelter",
        type: "boolean",
        attributeId: "shelter",
        prompt: "Is there a shelter?",
        description: "Choose Yes, Unsure, or No.",
        progressLabel: "Shelter",
        filterLabel: "Shelter",
        summaryLabel: "Shelter",
        contributesToCoverage: true,
        completion: "explicit",
      },
      {
        id: "shade",
        type: "boolean",
        attributeId: "shade",
        prompt: "Is there shade or other cover?",
        description: "Choose Yes, Unsure, or No.",
        progressLabel: "Shade",
        filterLabel: "Shade",
        summaryLabel: "Shade",
        contributesToCoverage: true,
        completion: "explicit",
      },
    ],
  },
  {
    id: "environment",
    questions: [
      {
        id: "stop_environment",
        type: "single-choice",
        prompt: "Where is the stop?",
        description: "Pick the setting the bus pulls into.",
        progressLabel: "Stop setting",
        options: [
          {
            id: "environment_bus_bay",
            label: "Bus bay",
            filterLabel: "Bus bay",
          },
          {
            id: "environment_street",
            label: "On street",
            filterLabel: "On street",
          },
          {
            id: "environment_parking_lot",
            label: "Parking lot",
            filterLabel: "Parking lot",
          },
        ],
      },
    ],
  },
];

export const surveyQuestions = surveySections.flatMap((section) => section.questions);

export const surveyAttributeDefinitions: SurveyAttributeDefinition[] =
  surveyQuestions.flatMap((question) => {
    if (question.type === "boolean") {
      return [
        {
          id: question.attributeId,
          label: question.prompt,
          filterLabel: question.filterLabel ?? question.prompt,
          summaryLabel: question.summaryLabel ?? question.prompt,
          questionId: question.id,
          contributesToCoverage: Boolean(question.contributesToCoverage),
        },
      ];
    }

    return question.options.map((option) => ({
      id: option.id,
      label: option.label,
      filterLabel: option.filterLabel ?? option.label,
      summaryLabel: option.summaryLabel ?? option.label,
      questionId: question.id,
      contributesToCoverage: false,
    }));
  });

export const surveyFilterDefinitions = surveyAttributeDefinitions.map((attribute) => ({
  id: attribute.id,
  label: attribute.filterLabel,
}));

const surveyAttributeMap = new Map(
  surveyAttributeDefinitions.map((attribute) => [attribute.id, attribute]),
);

const surveyQuestionMap = new Map(
  surveyQuestions.map((question) => [question.id, question]),
);

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

  for (const attribute of surveyAttributeDefinitions) {
    const rawValue = rawAnswers[attribute.id];
    answers[attribute.id] =
      rawValue === true ? true : rawValue === false ? false : null;
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

  if (candidate.answers && typeof candidate.answers === "object") {
    return {
      id: candidate.id,
      stopId: candidate.stopId,
      contributor,
      visitedOn,
      notes,
      answers: mergeSurveyAnswers(candidate.answers),
      createdAt,
    };
  }

  const legacyAmenities = candidate.amenities ?? {};

  return {
    id: candidate.id,
    stopId: candidate.stopId,
    contributor,
    visitedOn,
    notes,
    answers: mergeSurveyAnswers({
      sign_pole: candidate.signPole ?? legacyAmenities.signage === "yes",
      sign_shelter: candidate.signShelter,
      sign_stand: candidate.signStand,
      sign_none: candidate.signNone ?? legacyAmenities.signage === "no",
      seating: candidate.seating ?? legacyAmenities.bench === "yes",
      shelter: candidate.shelter ?? legacyAmenities.shelter === "yes",
      shade: candidate.shade ?? legacyAmenities.shelter === "yes",
      environment_bus_bay: candidate.environmentBusBay,
      environment_street: candidate.environmentStreet,
      environment_parking_lot: candidate.environmentParkingLot,
    }),
    createdAt,
  };
}

export function isQuestionAnswered(
  question: SurveyQuestion,
  answers: SurveyAnswers,
): boolean {
  if (question.type === "boolean") {
    return answers[question.attributeId] !== null;
  }

  return question.options.some((option) => answers[option.id]);
}

export function getSingleChoiceValue(
  question: SurveySingleChoiceQuestion,
  answers: SurveyAnswers,
): string {
  return question.options.find((option) => answers[option.id])?.id ?? "";
}

export function setSingleChoiceAnswer(
  currentAnswers: SurveyAnswers,
  question: SurveySingleChoiceQuestion,
  nextOptionId: string,
): SurveyAnswers {
  const nextAnswers = { ...currentAnswers };

  for (const option of question.options) {
    nextAnswers[option.id] = option.id === nextOptionId;
  }

  return nextAnswers;
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
  return surveyQuestions.reduce(
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
  if (answeredQuestionCount === surveyQuestions.length) return "done";

  return "partial";
}

export function activeSurveyFilters(answers: SurveyAnswers): Set<string> {
  return new Set(
    surveyAttributeDefinitions
      .filter((attribute) => answers[attribute.id])
      .map((attribute) => attribute.id),
  );
}

export function surveyQuestionStates(answers: SurveyAnswers) {
  return surveyQuestions.map((question) => ({
    label: question.progressLabel,
    done: isQuestionAnswered(question, answers),
  }));
}

export function describeQuestionAnswer(
  question: SurveyQuestion,
  answers: SurveyAnswers,
): string {
  if (question.type === "boolean") {
    const attribute = surveyAttributeMap.get(question.attributeId);
    const value = answers[question.attributeId];
    return `${attribute?.summaryLabel ?? question.prompt}: ${
      value === null
        ? "Unsure"
        : value
        ? question.trueLabel ?? "Yes"
        : question.falseLabel ?? "No"
    }`;
  }

  const selectedOption = question.options.find((option) => answers[option.id]);
  return `${question.progressLabel}: ${selectedOption?.summaryLabel ?? selectedOption?.label ?? "Not answered"}`;
}

export function findQuestion(questionId: string): SurveyQuestion | undefined {
  return surveyQuestionMap.get(questionId);
}
