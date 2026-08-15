import * as React from "react";
import { Badge, Button, Code, Heading, Inline, Progress, Stack, Table, Tabs, Text } from "../index";
import "./dashboard-examples.css";

type Range = "1h" | "6h" | "24h";
const series: Record<Range, number[]> = {
  "1h": [26, 29, 25, 34, 32, 40, 37, 45, 43, 47, 42, 49],
  "6h": [18, 24, 23, 28, 36, 31, 42, 38, 44, 41, 48, 46],
  "24h": [12, 19, 17, 25, 22, 30, 29, 39, 35, 43, 41, 46],
};

function linePath(values: readonly number[], width = 680, height = 180): string {
  const min = Math.min(...values); const max = Math.max(...values); const span = Math.max(1, max - min);
  return values.map((value, index) => `${index ? "L" : "M"}${(index / (values.length - 1) * width).toFixed(1)},${(height - (value - min) / span * height).toFixed(1)}`).join(" ");
}

function LineChart({ values, label }: { values: readonly number[]; label: string }): React.ReactElement {
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  return <figure className="z-example-chart"><figcaption><span>{label}</span><strong>{average} tok/s avg</strong></figcaption><svg role="img" aria-label={`${label}, average ${average} tokens per second`} viewBox="0 0 744 230" preserveAspectRatio="none"><g className="z-example-chart__grid"><line x1="64" x2="744" y1="20" y2="20" /><line x1="64" x2="744" y1="110" y2="110" /><line x1="64" x2="744" y1="200" y2="200" /></g><g className="z-example-chart__axis"><text x="4" y="24">50</text><text x="4" y="114">30</text><text x="4" y="204">10</text><text x="64" y="224">start</text><text x="714" y="224">now</text></g><path className="z-example-chart__line" d={linePath(values)} transform="translate(64 20) scale(1 .9)" vectorEffect="non-scaling-stroke" />{values.map((value, index) => <circle key={`${index}-${value}`} className="z-example-chart__point" cx={64 + index / (values.length - 1) * 680} cy={20 + (180 - (value - Math.min(...values)) / Math.max(1, Math.max(...values) - Math.min(...values)) * 180) * .9} r="3" />)}</svg></figure>;
}

export function RuntimeDashboard(): React.ReactElement {
  const [range, setRange] = React.useState<Range>("6h");
  return <div className="z-example-shell" data-z-theme="dark" data-z-density="compact" role="region" aria-label="Dashboard example"><header className="z-example-header"><div><Text muted>Workspace / openvibe</Text><Heading>Agent runtime</Heading></div><Inline><Badge>local</Badge><Button size="sm">Export trace</Button></Inline></header><section className="z-example-metrics" aria-label="Runtime summary"><div><span>Active runs</span><strong>3</strong><small>2 tool calls</small></div><div><span>Queue depth</span><strong>7</strong><small>−4 in 10 min</small></div><div><span>P95 latency</span><strong>842 ms</strong><small>within 1.2 s limit</small></div><div><span>Context used</span><strong>61%</strong><small>78k / 128k</small></div></section><section className="z-example-section"><Inline className="z-example-section__head"><div><Heading level={3}>Generation throughput</Heading><Text muted>Streaming output across active sessions</Text></div><div role="group" aria-label="Chart range" className="z-example-range">{(["1h", "6h", "24h"] as const).map((item) => <button key={item} type="button" aria-pressed={range === item} onClick={() => setRange(item)}>{item}</button>)}</div></Inline><LineChart values={series[range]} label={`${range} throughput`} /></section><section className="z-example-runs"><Heading level={3}>Live runs</Heading><Table caption="Live agent runs" rows={[{ id: "a4f2", task: "Refactor Select", phase: "Testing", elapsed: "04:18", tokens: "18.4k" }, { id: "81bd", task: "Index workspace", phase: "Reading", elapsed: "01:42", tokens: "6.1k" }, { id: "4c09", task: "Build tarball", phase: "Queued", elapsed: "00:00", tokens: "—" }]} rowKey={(row) => row.id} columns={[{ id: "id", header: "Run", cell: (row) => <Code>{row.id}</Code> }, { id: "task", header: "Task", cell: (row) => row.task }, { id: "phase", header: "Phase", cell: (row) => <Badge>{row.phase}</Badge> }, { id: "elapsed", header: "Elapsed", align: "end", cell: (row) => row.elapsed }, { id: "tokens", header: "Tokens", align: "end", cell: (row) => row.tokens }]} /></section></div>;
}

const modules = [
  { name: "agent", coverage: 84, churn: 64, issues: 2 },
  { name: "editor", coverage: 72, churn: 38, issues: 5 },
  { name: "git", coverage: 91, churn: 24, issues: 1 },
  { name: "settings", coverage: 88, churn: 18, issues: 0 },
  { name: "terminal", coverage: 67, churn: 42, issues: 3 },
];

export function RepositoryDashboard(): React.ReactElement {
  return <div className="z-example-shell" data-z-theme="dark" data-z-density="compact" role="region" aria-label="Dashboard example"><header className="z-example-header"><div><Text muted>Repository signal</Text><Heading>Change risk inspector</Heading></div><Badge>main · clean</Badge></header><div className="z-example-two-column"><section className="z-example-section"><Heading level={3}>Coverage versus churn</Heading><Text muted>Modules with low coverage and high recent churn need attention first.</Text><div className="z-example-bars" role="img" aria-label="Coverage and churn by module">{modules.map((module) => <div key={module.name} className="z-example-bar-row"><Code>{module.name}</Code><div><span style={{ width: `${module.coverage}%` }} /><i style={{ left: `${module.churn}%` }} /></div><strong>{module.coverage}%</strong></div>)}</div><Inline className="z-example-legend"><span><i className="z-example-legend__coverage" />coverage</span><span><i className="z-example-legend__churn" />churn marker</span></Inline></section><section className="z-example-section"><Heading level={3}>Review pressure</Heading><Text muted>Open findings weighted by changed lines.</Text><Stack gap="6">{modules.map((module) => <div key={module.name} className="z-example-pressure"><Inline><Code>{module.name}</Code><span>{module.issues} findings</span></Inline><Progress label={`${module.name} review pressure`} value={module.issues * 14 + module.churn} max={100} /></div>)}</Stack></section></div><section className="z-example-section"><Tabs items={[{ value: "hotspots", label: "Hotspots", content: <Table caption="Repository hotspots" rows={modules.filter((module) => module.issues > 0)} rowKey={(row) => row.name} columns={[{ id: "module", header: "Module", cell: (row) => <Code>{row.name}</Code> }, { id: "coverage", header: "Coverage", align: "end", cell: (row) => `${row.coverage}%` }, { id: "churn", header: "7d churn", align: "end", cell: (row) => `${row.churn}%` }, { id: "issues", header: "Findings", align: "end", cell: (row) => row.issues }]} /> }, { value: "stable", label: "Stable areas", content: <Text muted>Settings has no open findings and low churn.</Text> }]} /></section></div>;
}

const pipeline = [
  { name: "Typecheck", start: 0, duration: 38, state: "done" },
  { name: "Unit tests", start: 18, duration: 66, state: "done" },
  { name: "Build package", start: 42, duration: 41, state: "done" },
  { name: "Visual tests", start: 76, duration: 78, state: "active" },
  { name: "Tarball smoke", start: 142, duration: 32, state: "queued" },
];

export function PipelineDashboard(): React.ReactElement {
  return <div className="z-example-shell" data-z-theme="dark" data-z-density="compact" role="region" aria-label="Dashboard example"><header className="z-example-header"><div><Text muted>Build #1842</Text><Heading>Release verification</Heading></div><Inline><Badge>03:14 elapsed</Badge><Button size="sm" variant="outline">Cancel</Button></Inline></header><section className="z-example-section"><Inline className="z-example-section__head"><div><Heading level={3}>Parallel execution</Heading><Text muted>Time in seconds from workflow start</Text></div><Badge>4 / 5 running</Badge></Inline><div className="z-example-timeline" role="img" aria-label="Release pipeline timeline"><div className="z-example-timeline__ticks"><span>0s</span><span>45s</span><span>90s</span><span>135s</span><span>180s</span></div>{pipeline.map((job) => <div key={job.name} className="z-example-lane"><span>{job.name}</span><div><i data-state={job.state} style={{ left: `${job.start / 1.8}%`, width: `${job.duration / 1.8}%` }}><b>{job.duration}s</b></i></div><Code>{job.state}</Code></div>)}</div></section><div className="z-example-two-column"><section className="z-example-section"><Heading level={3}>Checks</Heading><Stack gap="4"><Inline className="z-example-check"><span>TypeScript declarations</span><Badge>pass</Badge></Inline><Inline className="z-example-check"><span>CSS token namespace</span><Badge>pass</Badge></Inline><Inline className="z-example-check"><span>Independent install</span><Badge>waiting</Badge></Inline><Inline className="z-example-check"><span>Runtime audit</span><Badge>pass</Badge></Inline></Stack></section><section className="z-example-section"><Heading level={3}>Artifact</Heading><dl className="z-example-artifact"><div><dt>Package</dt><dd><Code>@zazaru/ui@0.1.0</Code></dd></div><div><dt>Archive</dt><dd>50.8 kB</dd></div><div><dt>Files</dt><dd>15</dd></div><div><dt>Integrity</dt><dd><Code>sha512-5m4k…</Code></dd></div></dl></section></div></div>;
}
