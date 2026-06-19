'use client';

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  FileWarning,
  Filter,
  Search,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type FitScore = 'High' | 'Medium' | 'Low';
type MatchType = 'Primary Match' | 'Alternative Match' | 'Mismatch';

type EvaluationReport = {
  summary: Summary;
  by_industry: IndustrySummary[];
  service_match_breakdown: ServiceMatchBreakdown[];
  fit_score_failures: EvaluationRow[];
  service_mismatches: EvaluationRow[];
  negative_example_summary: NegativeExampleSummary;
  evaluations: EvaluationRow[];
};

type Summary = {
  total: number;
  fit_score_accuracy: number;
  primary_service_accuracy: number;
  acceptable_service_accuracy: number;
  primary_matches: number;
  alternative_matches: number;
  mismatches: number;
  missing_labels: number;
};

type IndustrySummary = {
  industry: string;
  total: number;
  fit_score_accuracy: number;
  primary_service_accuracy: number;
  acceptable_service_accuracy: number;
  primary_matches: number;
  alternative_matches: number;
  mismatches: number;
  missing_labels: number;
};

type ServiceMatchBreakdown = {
  match_type: MatchType;
  count: number;
  percentage: number;
};

type NegativeExampleSummary = {
  total: number;
  correct_not_good_fit: number;
  accuracy: number;
  failures: EvaluationRow[];
};

type EvaluationRow = {
  company_name: string;
  industry: string;
  company_file: string;
  fit_score_expected: FitScore;
  fit_score_predicted: FitScore;
  fit_score_match: boolean;
  recommended_service_expected: string;
  alternative_services: string[];
  recommended_service_predicted: string;
  service_match_type: MatchType;
  service_primary_match: boolean;
  service_acceptable_match: boolean;
};

type ModelResult = {
  company_file: string;
  provider_response: ProviderResponse | null;
  raw_response: string;
  attempts?: number;
  error?: string;
};

type ProviderResponse = {
  company_name: string;
  fit_score: FitScore;
  recommended_service: string;
  confidence: number;
  reasoning: string[];
  supporting_evidence: string[];
  sales_angle: string;
  next_action: string;
};

type Approach = {
  id: string;
  label: string;
  evaluationFile: string;
  resultsFile: string;
};

type ApproachData = {
  approach: Approach;
  evaluation: EvaluationReport | null;
  results: ModelResult[];
  missing: boolean;
  error?: string;
};

const approaches: Approach[] = [
  {
    id: 'vanilla_slm',
    label: 'Vanilla SLM',
    evaluationFile: '/data/vanilla_slm_evaluation.json',
    resultsFile: '/data/vanilla_slm_results.json'
  },
  {
    id: 'slm_rag',
    label: 'SLM + RAG',
    evaluationFile: '/data/slm_rag_evaluation.json',
    resultsFile: '/data/slm_rag_results.json'
  },
  {
    id: 'gpt',
    label: 'GPT Benchmark',
    evaluationFile: '/data/gpt_evaluation.json',
    resultsFile: '/data/gpt_results.json'
  },
  {
    id: 'slm_rag_finetuned',
    label: 'SLM + RAG + Fine-tuning',
    evaluationFile: '/data/slm_rag_finetuned_evaluation.json',
    resultsFile: '/data/slm_rag_finetuned_results.json'
  }
];

const matchColors: Record<MatchType, string> = {
  'Primary Match': '#16a34a',
  'Alternative Match': '#d97706',
  Mismatch: '#dc2626'
};

function percent(value: number | undefined) {
  return `${(((value ?? 0) as number) * 100).toFixed(2)}%`;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export default function BenchmarkDashboard() {
  const [selectedApproachId, setSelectedApproachId] = useState(approaches[0].id);
  const [approachData, setApproachData] = useState<Record<string, ApproachData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<EvaluationRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      const loadedEntries = await Promise.all(
        approaches.map(async (approach) => {
          try {
            const [evaluation, results] = await Promise.all([
              fetchJson<EvaluationReport>(approach.evaluationFile),
              fetchJson<ModelResult[]>(approach.resultsFile)
            ]);

            return [
              approach.id,
              {
                approach,
                evaluation,
                results: results ?? [],
                missing: !evaluation,
                error: undefined
              }
            ] as const;
          } catch (error) {
            return [
              approach.id,
              {
                approach,
                evaluation: null,
                results: [],
                missing: true,
                error: error instanceof Error ? error.message : 'Unable to load data'
              }
            ] as const;
          }
        })
      );

      if (!cancelled) {
        setApproachData(Object.fromEntries(loadedEntries));
        setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedData = approachData[selectedApproachId];
  const evaluation = selectedData?.evaluation ?? null;
  const resultsByFile = useMemo(() => {
    return new Map((selectedData?.results ?? []).map((result) => [result.company_file, result]));
  }, [selectedData?.results]);

  const comparisonRows = useMemo(() => {
    return approaches
      .map((approach) => approachData[approach.id])
      .filter((data): data is ApproachData => Boolean(data?.evaluation));
  }, [approachData]);

  return (
    <main className="min-h-screen bg-[#f6f7f9]">
      <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <BarChart3 className="h-4 w-4" />
              AI lead-qualification benchmark
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink">
              Model Output Evaluation
            </h1>
          </div>
          <ApproachSelector
            selectedApproachId={selectedApproachId}
            onSelect={(id) => {
              setSelectedApproachId(id);
              setSelectedCompany(null);
            }}
            dataByApproach={approachData}
          />
        </header>

        {loading ? (
          <div className="rounded-md border border-border bg-white p-6 text-sm text-slate-600 shadow-panel">
            Loading benchmark files...
          </div>
        ) : !evaluation ? (
          <EmptyApproachState selectedData={selectedData} />
        ) : (
          <>
            <OverviewMetrics summary={evaluation.summary} />

            <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <ServiceMatchChart data={evaluation.service_match_breakdown} />
              <IndustryPerformanceTable industries={evaluation.by_industry} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <NegativeExampleCard summary={evaluation.negative_example_summary} />
              <MismatchReview
                serviceMismatches={evaluation.service_mismatches}
                fitScoreFailures={evaluation.fit_score_failures}
              />
            </section>

            <ApproachComparison rows={comparisonRows} />

            <EvaluationTable
              evaluations={evaluation.evaluations}
              onSelect={setSelectedCompany}
            />
          </>
        )}
      </div>

      <CompanyDetailDrawer
        row={selectedCompany}
        modelResult={selectedCompany ? resultsByFile.get(selectedCompany.company_file) : undefined}
        onClose={() => setSelectedCompany(null)}
      />
    </main>
  );
}

function ApproachSelector({
  selectedApproachId,
  onSelect,
  dataByApproach
}: {
  selectedApproachId: string;
  onSelect: (id: string) => void;
  dataByApproach: Record<string, ApproachData>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {approaches.map((approach) => {
        const data = dataByApproach[approach.id];
        const active = selectedApproachId === approach.id;
        const hasData = Boolean(data?.evaluation);
        return (
          <button
            key={approach.id}
            type="button"
            onClick={() => onSelect(approach.id)}
            className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
              active
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-border bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            <span>{approach.label}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                hasData ? 'bg-emerald-500' : active ? 'bg-slate-400' : 'bg-slate-300'
              }`}
              aria-label={hasData ? 'Data loaded' : 'No data'}
            />
          </button>
        );
      })}
    </div>
  );
}

function EmptyApproachState({ selectedData }: { selectedData?: ApproachData }) {
  return (
    <div className="rounded-md border border-border bg-white p-8 shadow-panel">
      <div className="flex max-w-2xl gap-4">
        <FileWarning className="mt-1 h-6 w-6 flex-none text-amber-600" />
        <div>
          <h2 className="text-lg font-semibold text-ink">No evaluation data available</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Add the expected JSON files to <span className="font-mono">public/data/</span> for this
            approach. Missing future approach files are treated as empty states.
          </p>
          {selectedData?.error ? (
            <p className="mt-2 text-sm text-red-700">Load error: {selectedData.error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OverviewMetrics({ summary }: { summary: Summary }) {
  const cards = [
    { label: 'Total companies', value: summary.total.toLocaleString() },
    { label: 'Fit score accuracy', value: percent(summary.fit_score_accuracy) },
    { label: 'Primary service accuracy', value: percent(summary.primary_service_accuracy) },
    { label: 'Acceptable service accuracy', value: percent(summary.acceptable_service_accuracy) },
    { label: 'Primary matches', value: summary.primary_matches.toLocaleString() },
    { label: 'Alternative matches', value: summary.alternative_matches.toLocaleString() },
    { label: 'Mismatches', value: summary.mismatches.toLocaleString() },
    { label: 'Missing labels', value: summary.missing_labels.toLocaleString() }
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {cards.map((card) => (
        <div key={card.label} className="rounded-md border border-border bg-white p-4 shadow-panel">
          <div className="text-xs font-medium uppercase tracking-normal text-slate-500">
            {card.label}
          </div>
          <div className="mt-2 text-2xl font-semibold text-ink">{card.value}</div>
        </div>
      ))}
    </section>
  );
}

function ServiceMatchChart({ data }: { data: ServiceMatchBreakdown[] }) {
  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <SectionHeader title="Service Match Breakdown" />
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 8 }}>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="match_type" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value, name, item) => {
                const row = item.payload as ServiceMatchBreakdown;
                return [`${value} (${row.percentage.toFixed(2)}%)`, 'Count'];
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.match_type} fill={matchColors[entry.match_type]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {data.map((entry) => (
          <div key={entry.match_type} className="rounded-md border border-border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <MatchTypeBadge matchType={entry.match_type} />
              <span className="text-sm font-semibold">{entry.count.toLocaleString()}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{entry.percentage.toFixed(2)}%</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function IndustryPerformanceTable({ industries }: { industries: IndustrySummary[] }) {
  const sorted = useMemo(
    () => [...industries].sort((a, b) => a.acceptable_service_accuracy - b.acceptable_service_accuracy),
    [industries]
  );

  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <SectionHeader title="By-Industry Performance" />
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} margin={{ left: 0, right: 8, top: 10, bottom: 8 }}>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="industry" tick={{ fontSize: 11 }} interval={0} angle={-20} height={52} />
            <YAxis tickFormatter={(value) => `${Number(value) * 100}%`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => percent(Number(value))} />
            <Legend />
            <Bar dataKey="fit_score_accuracy" name="Fit score" fill="#2563eb" radius={[3, 3, 0, 0]} />
            <Bar dataKey="primary_service_accuracy" name="Primary service" fill="#7c3aed" radius={[3, 3, 0, 0]} />
            <Bar dataKey="acceptable_service_accuracy" name="Acceptable service" fill="#16a34a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-slate-600">
            <tr>
              {[
                'Industry',
                'Total',
                'Fit Score Accuracy',
                'Primary Service Accuracy',
                'Acceptable Service Accuracy',
                'Primary Matches',
                'Alternative Matches',
                'Mismatches'
              ].map((header) => (
                <th key={header} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((industry) => (
              <tr key={industry.industry} className="border-b border-border last:border-b-0">
                <td className="whitespace-nowrap px-3 py-2 font-medium">{industry.industry}</td>
                <td className="px-3 py-2">{industry.total}</td>
                <td className="px-3 py-2">{percent(industry.fit_score_accuracy)}</td>
                <td className="px-3 py-2">{percent(industry.primary_service_accuracy)}</td>
                <td className="px-3 py-2">{percent(industry.acceptable_service_accuracy)}</td>
                <td className="px-3 py-2">{industry.primary_matches}</td>
                <td className="px-3 py-2">{industry.alternative_matches}</td>
                <td className="px-3 py-2">{industry.mismatches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NegativeExampleCard({ summary }: { summary: NegativeExampleSummary }) {
  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <SectionHeader title="Negative Examples" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Total" value={summary.total.toLocaleString()} />
        <MiniMetric label="Correctly rejected" value={summary.correct_not_good_fit.toLocaleString()} />
        <MiniMetric label="Accuracy" value={percent(summary.accuracy)} />
      </div>
      <div className="mt-4 rounded-md border border-border bg-muted p-3 text-sm">
        {summary.failures.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            All negative examples were correctly rejected.
          </div>
        ) : (
          <div className="space-y-2">
            {summary.failures.map((failure) => (
              <div key={failure.company_file} className="flex items-start gap-2 text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <span>
                  {failure.company_name} was predicted as {failure.fit_score_predicted}.
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MismatchReview({
  serviceMismatches,
  fitScoreFailures
}: {
  serviceMismatches: EvaluationRow[];
  fitScoreFailures: EvaluationRow[];
}) {
  const [tab, setTab] = useState<'service' | 'fit'>('service');
  const rows = tab === 'service' ? serviceMismatches : fitScoreFailures;

  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader title="Mismatch Review" />
        <div className="inline-flex rounded-md border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab('service')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === 'service' ? 'bg-white text-ink shadow-panel' : 'text-slate-600'
            }`}
          >
            Service Mismatches
          </button>
          <button
            type="button"
            onClick={() => setTab('fit')}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              tab === 'fit' ? 'bg-white text-ink shadow-panel' : 'text-slate-600'
            }`}
          >
            Fit Score Failures
          </button>
        </div>
      </div>
      <div className="mt-4 max-h-80 overflow-auto">
        {rows.length === 0 ? (
          <div className="rounded-md border border-border bg-muted p-4 text-sm text-slate-600">
            No records in this review queue.
          </div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted text-xs uppercase text-slate-600">
              <tr>
                {(tab === 'service'
                  ? ['Company', 'Industry', 'Expected service', 'Alternative services', 'Predicted service']
                  : ['Company', 'Industry', 'Expected fit score', 'Predicted fit score', 'Expected service', 'Predicted service']
                ).map((header) => (
                  <th key={header} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.company_file} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{row.company_name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.industry}</td>
                  {tab === 'fit' ? (
                    <>
                      <td className="px-3 py-2"><FitScoreBadge score={row.fit_score_expected} /></td>
                      <td className="px-3 py-2"><FitScoreBadge score={row.fit_score_predicted} /></td>
                    </>
                  ) : null}
                  <td className="px-3 py-2">{row.recommended_service_expected}</td>
                  {tab === 'service' ? (
                    <td className="px-3 py-2">{row.alternative_services.join(', ') || 'None'}</td>
                  ) : null}
                  <td className="px-3 py-2">{row.recommended_service_predicted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function ApproachComparison({ rows }: { rows: ApproachData[] }) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <SectionHeader title="Approach Comparison" />
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-slate-600">
            <tr>
              {[
                'Approach',
                'Total',
                'Fit Score Accuracy',
                'Primary Service Accuracy',
                'Acceptable Service Accuracy',
                'Primary Matches',
                'Alternative Matches',
                'Mismatches',
                'Missing Labels'
              ].map((header) => (
                <th key={header} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ approach, evaluation }) => {
              const summary = evaluation!.summary;
              return (
                <tr key={approach.id} className="border-b border-border last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{approach.label}</td>
                  <td className="px-3 py-2">{summary.total}</td>
                  <td className="px-3 py-2">{percent(summary.fit_score_accuracy)}</td>
                  <td className="px-3 py-2">{percent(summary.primary_service_accuracy)}</td>
                  <td className="px-3 py-2">{percent(summary.acceptable_service_accuracy)}</td>
                  <td className="px-3 py-2">{summary.primary_matches}</td>
                  <td className="px-3 py-2">{summary.alternative_matches}</td>
                  <td className="px-3 py-2">{summary.mismatches}</td>
                  <td className="px-3 py-2">{summary.missing_labels}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EvaluationTable({
  evaluations,
  onSelect
}: {
  evaluations: EvaluationRow[];
  onSelect: (row: EvaluationRow) => void;
}) {
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('all');
  const [matchType, setMatchType] = useState('all');
  const [fitMatch, setFitMatch] = useState('all');
  const [expectedService, setExpectedService] = useState('all');
  const [predictedService, setPredictedService] = useState('all');

  const filters = useMemo(() => {
    return {
      industries: unique(evaluations.map((row) => row.industry)),
      expectedServices: unique(evaluations.map((row) => row.recommended_service_expected)),
      predictedServices: unique(evaluations.map((row) => row.recommended_service_predicted))
    };
  }, [evaluations]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return evaluations.filter((row) => {
      return (
        (!query || row.company_name.toLowerCase().includes(query)) &&
        (industry === 'all' || row.industry === industry) &&
        (matchType === 'all' || row.service_match_type === matchType) &&
        (fitMatch === 'all' || String(row.fit_score_match) === fitMatch) &&
        (expectedService === 'all' || row.recommended_service_expected === expectedService) &&
        (predictedService === 'all' || row.recommended_service_predicted === predictedService)
      );
    });
  }, [evaluations, expectedService, fitMatch, industry, matchType, predictedService, search]);

  return (
    <section className="rounded-md border border-border bg-white p-4 shadow-panel">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SectionHeader title="Company Evaluations" />
        <div className="text-sm text-slate-600">
          Showing {filtered.length.toLocaleString()} of {evaluations.length.toLocaleString()}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative md:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search company"
            className="h-10 w-full rounded-md border border-border bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-500"
          />
        </label>
        <SelectFilter icon label="Industry" value={industry} onChange={setIndustry} options={filters.industries} />
        <SelectFilter label="Match type" value={matchType} onChange={setMatchType} options={['Primary Match', 'Alternative Match', 'Mismatch']} />
        <SelectFilter label="Fit match" value={fitMatch} onChange={setFitMatch} options={[{ label: 'Matched', value: 'true' }, { label: 'Failed', value: 'false' }]} />
        <SelectFilter label="Expected service" value={expectedService} onChange={setExpectedService} options={filters.expectedServices} />
        <SelectFilter label="Predicted service" value={predictedService} onChange={setPredictedService} options={filters.predictedServices} />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[1280px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-slate-600">
            <tr>
              {[
                'Company',
                'Industry',
                'Fit Expected',
                'Fit Predicted',
                'Fit Match',
                'Expected Service',
                'Predicted Service',
                'Alternative Services',
                'Match Type',
                'Company File'
              ].map((header) => (
                <th key={header} className="whitespace-nowrap border-b border-border px-3 py-2 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.company_file}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-border transition last:border-b-0 hover:bg-slate-100 ${rowTint(row.service_match_type)}`}
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium">{row.company_name}</td>
                <td className="whitespace-nowrap px-3 py-2">{row.industry}</td>
                <td className="px-3 py-2"><FitScoreBadge score={row.fit_score_expected} /></td>
                <td className="px-3 py-2"><FitScoreBadge score={row.fit_score_predicted} /></td>
                <td className="px-3 py-2">
                  {row.fit_score_match ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <div className="inline-flex items-center gap-1 font-medium text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Failed
                    </div>
                  )}
                </td>
                <td className="px-3 py-2"><ServiceBadge service={row.recommended_service_expected} /></td>
                <td className="px-3 py-2"><ServiceBadge service={row.recommended_service_predicted} /></td>
                <td className="max-w-[280px] px-3 py-2 text-slate-700">
                  {row.alternative_services.join(', ') || 'None'}
                </td>
                <td className="px-3 py-2"><MatchTypeBadge matchType={row.service_match_type} /></td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">
                  {row.company_file}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CompanyDetailDrawer({
  row,
  modelResult,
  onClose
}: {
  row: EvaluationRow | null;
  modelResult?: ModelResult;
  onClose: () => void;
}) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${row ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!row}
    >
      <div
        className={`absolute inset-0 bg-slate-950/30 transition-opacity ${row ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-white shadow-xl transition-transform duration-200 ${
          row ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {row ? (
          <div className="flex min-h-full flex-col">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-white p-5">
              <div>
                <div className="text-xs font-medium uppercase text-slate-500">{row.industry}</div>
                <h2 className="mt-1 text-xl font-semibold text-ink">{row.company_name}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <FitScoreBadge score={row.fit_score_predicted} />
                  <MatchTypeBadge matchType={row.service_match_type} />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-600 hover:bg-muted"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-5 p-5">
              <DetailSection title="Evaluation">
                <DetailGrid
                  items={[
                    ['Fit expected', row.fit_score_expected],
                    ['Fit predicted', row.fit_score_predicted],
                    ['Fit match', row.fit_score_match ? 'Yes' : 'No'],
                    ['Expected service', row.recommended_service_expected],
                    ['Predicted service', row.recommended_service_predicted],
                    ['Match type', row.service_match_type],
                    ['Alternative services', row.alternative_services.join(', ') || 'None'],
                    ['Company file', row.company_file]
                  ]}
                />
              </DetailSection>

              {!modelResult ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  No raw model result was found for this company file.
                </div>
              ) : modelResult.provider_response === null ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  Provider response is null.
                  {modelResult.error ? <div className="mt-2">Error: {modelResult.error}</div> : null}
                </div>
              ) : (
                <ProviderResponseView response={modelResult.provider_response} />
              )}

              {modelResult ? (
                <DetailSection title="Raw Result">
                  <DetailGrid
                    items={[
                      ['Attempts', modelResult.attempts?.toString() ?? 'Not recorded'],
                      ['Error', modelResult.error ?? 'None']
                    ]}
                  />
                  <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                    {modelResult.raw_response || 'No raw response text.'}
                  </pre>
                </DetailSection>
              ) : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function ProviderResponseView({ response }: { response: ProviderResponse }) {
  return (
    <DetailSection title="Provider Response">
      <DetailGrid
        items={[
          ['Company', response.company_name],
          ['Fit score', response.fit_score],
          ['Recommended service', response.recommended_service],
          ['Confidence', `${(response.confidence * 100).toFixed(2)}%`],
          ['Sales angle', response.sales_angle],
          ['Next action', response.next_action]
        ]}
      />
      <ListBlock title="Reasoning" items={response.reasoning} />
      <ListBlock title="Supporting evidence" items={response.supporting_evidence} />
    </DetailSection>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border p-4">
      <h3 className="text-sm font-semibold uppercase text-slate-600">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium uppercase text-slate-500">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">None recorded.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-ink">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-md bg-muted px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  icon
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | { label: string; value: string })[];
  icon?: boolean;
}) {
  return (
    <label className="relative">
      {icon ? <Filter className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-10 w-full appearance-none rounded-md border border-border bg-white py-0 pr-9 text-sm outline-none focus:border-slate-500 ${
          icon ? 'pl-9' : 'pl-3'
        }`}
        aria-label={label}
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
    </label>
  );
}

function MatchTypeBadge({ matchType }: { matchType: MatchType }) {
  const className =
    matchType === 'Primary Match'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : matchType === 'Alternative Match'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-red-200 bg-red-50 text-red-700';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {matchType}
    </span>
  );
}

function FitScoreBadge({ score }: { score: FitScore }) {
  const className =
    score === 'High'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : score === 'Medium'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {score}
    </span>
  );
}

function ServiceBadge({ service }: { service: string }) {
  return (
    <span className="inline-flex max-w-[260px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700">
      {service}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted px-3 py-2">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-base font-semibold text-ink">{title}</h2>;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function rowTint(matchType: MatchType) {
  if (matchType === 'Primary Match') return 'bg-emerald-50/55';
  if (matchType === 'Alternative Match') return 'bg-amber-50/55';
  return 'bg-red-50/60';
}
