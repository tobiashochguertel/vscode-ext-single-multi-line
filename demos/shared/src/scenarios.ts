/**
 * Shared scenario definitions — used by all demo solutions.
 * Each scenario describes a sequence of steps with before/after text states.
 */

import { toggleLineLayout, compactBlocks } from "./transformer";

export interface ScenarioStep {
  label: string;
  code: string;
  subtitle: string;
  highlight: "all" | null;
}

export interface Scenario {
  name: string;
  title: string;
  steps: ScenarioStep[];
}

export function getScenarios(filter: string = "all"): Scenario[] {
  const all: Scenario[] = [];

  if (filter === "all" || filter === "toggle") {
    const singleLine =
      '{ "name": "Alice", "age": 30, "city": "Berlin", "role": "Developer" }';
    const multiLine = toggleLineLayout(singleLine);

    all.push({
      name: "toggle",
      title: "example.json",
      steps: [
        {
          label: "single-line-before",
          code: singleLine,
          subtitle: "▸ Single-line object — ready to expand",
          highlight: null,
        },
        {
          label: "selected",
          code: singleLine,
          subtitle: "▸ Select all → Ctrl+Cmd+S to toggle",
          highlight: "all",
        },
        {
          label: "multi-line-after",
          code: multiLine,
          subtitle: "✓ Expanded to multi-line",
          highlight: null,
        },
        {
          label: "selected-again",
          code: multiLine,
          subtitle: "▸ Select all → Ctrl+Cmd+S to toggle back",
          highlight: "all",
        },
        {
          label: "single-line-restored",
          code: singleLine,
          subtitle: "✓ Collapsed back to single-line",
          highlight: null,
        },
      ],
    });
  }

  if (filter === "all" || filter === "compact") {
    const multiBlocks = `{
  "name": "content",
  "regexp": "*"
},
{
  "name": "filename",
  "regexp": "*"
},
{
  "name": "path",
  "regexp": "/src/**"
}`;
    const compacted = compactBlocks(multiBlocks);

    all.push({
      name: "compact",
      title: "settings.json",
      steps: [
        {
          label: "multiline-blocks",
          code: multiBlocks,
          subtitle: "▸ Multiple multiline objects — ready to compact",
          highlight: null,
        },
        {
          label: "selected",
          code: multiBlocks,
          subtitle: "▸ Select all → Ctrl+Cmd+B to compact blocks",
          highlight: "all",
        },
        {
          label: "compacted",
          code: compacted,
          subtitle: "✓ Each object compacted to one line",
          highlight: null,
        },
      ],
    });
  }

  if (filter === "all" || filter === "toggle-from-multi") {
    const multiLine = `{
  "name": "Alice",
  "age": 30,
  "city": "Berlin",
  "role": "Developer"
}`;
    const singleLine = toggleLineLayout(multiLine);

    all.push({
      name: "toggle-from-multi",
      title: "example.json",
      steps: [
        {
          label: "multi-line-before",
          code: multiLine,
          subtitle: "▸ Multi-line object — ready to collapse",
          highlight: null,
        },
        {
          label: "selected",
          code: multiLine,
          subtitle: "▸ Select all → Ctrl+Cmd+S to toggle",
          highlight: "all",
        },
        {
          label: "single-line-after",
          code: singleLine,
          subtitle: "✓ Collapsed to single-line",
          highlight: null,
        },
      ],
    });
  }

  return all;
}
