// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  BindingRange,
  GeneratedRange,
  OriginalScope,
  ScopeInfo,
  SourceMapJson,
} from "../types.ts";
import { encodeVlq, encodeMixedVlqList } from "../vlq.ts";

function octets(n: number, signed: boolean = false) {
  if (signed) n = n < 0 ? (-n << 1) | 1 : n << 1;
  const bits = 32 - Math.clz32(n);
  if (bits === 0) return 0;
  if (bits <= 5) return 1;
  if (bits <= 10) return 2;
  if (bits <= 15) return 3;
  if (bits <= 20) return 4;
  if (bits <= 25) return 5;
  if (bits <= 30) return 6;
  return 7;
}

/**
 * Takes a SourceMap with "current proposal" scopes and re-encodes them using the "prefix" method.
 */
export function encode(
  info: ScopeInfo,
  initialMap: SourceMapJson,
): SourceMapJson {
  const map = { ...initialMap };
  const names = map.names ?? [];
  if (!map.names) {
    map.names = names;
  }

  let sourceIdx = 0;
  const encodedScopes = info.scopes.map((scope) => {
    const builder = new OriginalScopeBuilder(names);
    encodeOriginalScope(scope, builder, sourceIdx++);
    builder.octets();
    return builder.build();
  });

  const builder = new GeneratedRangeBuilder(names);
  info.ranges.forEach((range) => encodeGeneratedRange(range, builder));
  const encodedRanges = builder.build();
  builder.octets()

  map.originalScopes = encodedScopes;
  map.generatedRanges = encodedRanges;
  return map;
}

const DEFINITION_SYMBOL = Symbol("definition");

function encodeOriginalScope(
  scope: OriginalScope,
  builder: OriginalScopeBuilder,
  sourceIdx: number,
) {
  builder.start(scope.start.line, scope.start.column, {
    kind: scope.kind,
    name: scope.name,
    variables: scope.variables,
    isStackFrame: scope.isStackFrame,
  });
  (scope as any)[DEFINITION_SYMBOL] = {
    sourceIdx,
    scopeIdx: builder.lastWrittenScopeIdx,
  };

  for (const child of scope.children) {
    encodeOriginalScope(child, builder, sourceIdx);
  }
  builder.end(scope.end.line, scope.end.column);
}

function encodeGeneratedRange(
  range: GeneratedRange,
  builder: GeneratedRangeBuilder,
) {
  const scope = range.originalScope as undefined | any;
  builder.start(range.start.line, range.start.column, {
    definition: scope?.[DEFINITION_SYMBOL],
    bindings: range.values as (string | undefined)[],
    isStackFrame: range.isStackFrame,
  });

  for (const child of range.children) {
    encodeGeneratedRange(child, builder);
  }

  builder.end(range.end.line, range.end.column);
}

export class OriginalScopeBuilder {
  #encodedScope = "";
  #lastLine = 0;
  #lastKind = 0;
  #scopeCounter = 0;

  #bits: {
    startLine: Uint32Array,
    startCol: Uint32Array,
    endLine: Uint32Array,
    endCol: Uint32Array,
    flags: Uint32Array,
    names: Uint32Array,
    kind: Uint32Array,
    variableLength: Uint32Array,
    variable: Uint32Array,
  } = {
    startLine: new Uint32Array(8),
    startCol: new Uint32Array(8),
    endLine: new Uint32Array(8),
    endCol: new Uint32Array(8),
    flags: new Uint32Array(8),
    names: new Uint32Array(8),
    kind: new Uint32Array(8),
    variableLength: new Uint32Array(8),
    variable: new Uint32Array(8),
  };

  readonly #names: string[];

  /** The 'names' field of the SourceMap. The builder will modify it. */
  constructor(names: string[]) {
    this.#names = names;
  }

  get lastWrittenScopeIdx() {
    return this.#scopeCounter - 1;
  }

  start(
    line: number,
    column: number,
    options?: {
      name?: string;
      kind?: string;
      isStackFrame?: boolean;
      variables?: string[];
    },
  ): this {
    if (this.#encodedScope !== "") {
      this.#encodedScope += ",";
    }

    const lineDiff = line - this.#lastLine;
    this.#lastLine = line;
    let flags = 0;
    const nameIdxAndKindIdx: number[] = [];

    if (options?.name) {
      flags |= 0x1;
      const n = this.#nameIdx(options.name);
      this.#bits.names[octets(n)]++;
      nameIdxAndKindIdx.push(n);
    }
    if (options?.kind) {
      flags |= 0x2;
      const k = this.#encodeKind(options?.kind);
      this.#bits.kind[octets(k, true)]++;
      nameIdxAndKindIdx.push(k);
    }
    if (options?.isStackFrame) {
      flags |= 0x4;
    }
    this.#bits.flags[octets(flags)]++;
    this.#bits.startLine[octets(lineDiff)]++;
    this.#bits.startCol[octets(column)]++;

    this.#encodedScope += encodeMixedVlqList([
      [lineDiff, "unsigned"],
      [column, "unsigned"],
      [flags, "unsigned"],
      ...nameIdxAndKindIdx,
    ]);

    this.#bits.variableLength[octets(options?.variables?.length ?? 0)]++;
    if (options?.variables) {
      this.#encodedScope += encodeMixedVlqList(
        options.variables.map((variable) => {
          const n = this.#nameIdx(variable)
          this.#bits.variable[octets(n)]++;
          return n;
        }),
      );
    }

    this.#scopeCounter++;

    return this;
  }

  end(line: number, column: number): this {
    if (this.#encodedScope !== "") {
      this.#encodedScope += ",";
    }

    const lineDiff = line - this.#lastLine;
    this.#lastLine = line;
    this.#bits.endLine[octets(lineDiff)]++;
    this.#bits.endCol[octets(column)]++;
    this.#encodedScope += encodeMixedVlqList([
      [lineDiff, "unsigned"],
      [column, "unsigned"],
    ]);
    this.#scopeCounter++;

    return this;
  }

  octets() {
    console.log(Object.fromEntries(Object.entries(this.#bits).map(e => {
      return [e[0], Object.fromEntries(e[1].entries().filter(e => e[1] > 0))]
    })));
  }

  build(): string {
    const result = this.#encodedScope;
    this.#lastLine = 0;
    this.#encodedScope = "";
    return result;
  }

  #encodeKind(kind: string): number {
    const kindIdx = this.#nameIdx(kind);
    const encodedIdx = kindIdx - this.#lastKind;
    this.#lastKind = kindIdx;
    return encodedIdx;
  }

  #nameIdx(name: string): number {
    let idx = this.#names.indexOf(name);
    if (idx < 0) {
      idx = this.#names.length;
      this.#names.push(name);
    }
    return idx;
  }
}

export class GeneratedRangeBuilder {
  #encodedRange = "";
  #state = {
    line: 0,
    column: 0,
    defSourceIdx: 0,
    defScopeIdx: 0,
    callsiteSourceIdx: 0,
    callsiteLine: 0,
    callsiteColumn: 0,
  };

  #bits: {
    startLine: Uint32Array,
    startCol: Uint32Array,
    endLine: Uint32Array,
    endCol: Uint32Array,
    flags: Uint32Array,
    names: Uint32Array,
    kind: Uint32Array,
    variableLength: Uint32Array,
    variable: Uint32Array,
  } = {
    startLine: new Uint32Array(8),
    startCol: new Uint32Array(8),
    endLine: new Uint32Array(8),
    endCol: new Uint32Array(8),
    flags: new Uint32Array(8),
    defSourceIdx: new Uint32Array(8),
    defScopeIdx: new Uint32Array(8),
    callSourceIdx: new Uint32Array(8),
    callLine: new Uint32Array(8),
    callCol: new Uint32Array(8),
    bindingsLength: new Uint32Array(8),
    binding: new Uint32Array(8),
    bindingLength: new Uint32Array(8),
    bindingLine: new Uint32Array(8),
    bindingCol: new Uint32Array(8),
  };

  readonly #names: string[];

  /** The 'names' field of the SourceMap. The builder will modify it. */
  constructor(names: string[]) {
    this.#names = names;
  }

  start(line: number, column: number, options?: {
    isStackFrame?: boolean;
    isHidden?: boolean;
    definition?: { sourceIdx: number; scopeIdx: number };
    callsite?: { sourceIdx: number; line: number; column: number };
    bindings?: (string | undefined | BindingRange[])[];
  }): this {
    this.#emitLineSeparator(line);
    this.#emitItemSepratorIfRequired();

    const emittedColumn = column -
      (this.#state.line === line ? this.#state.column : 0);
    this.#encodedRange += encodeMixedVlqList([
      [emittedColumn, "unsigned"],
    ]);


    const diff = line - this.#state.line;
    this.#bits.startLine[octets(diff)]++;
    this.#bits.startCol[octets(emittedColumn)]++;

    this.#state.line = line;
    this.#state.column = column;

    let flags = 0;
    if (options?.definition) {
      flags |= 0x1;
    }
    if (options?.callsite) {
      flags |= 0x2;
    }
    if (options?.isStackFrame) {
      flags |= 0x4;
    }
    if (options?.isHidden) {
      flags |= 0x8;
    }
    this.#encodedRange += encodeMixedVlqList([
      [flags, "unsigned"],
    ]);
    this.#bits.flags[octets(flags)]++;

    if (options?.definition) {
      const { sourceIdx, scopeIdx } = options.definition;
      this.#encodedRange += encodeVlq(sourceIdx - this.#state.defSourceIdx);

      const emittedScopeIdx = scopeIdx -
        (this.#state.defSourceIdx === sourceIdx ? this.#state.defScopeIdx : 0);
      this.#encodedRange += encodeVlq(emittedScopeIdx);

      this.#bits.defSourceIdx[octets(sourceIdx, true)]++;
      this.#bits.defScopeIdx[octets(scopeIdx, true)]++;
      this.#state.defSourceIdx = sourceIdx;
      this.#state.defScopeIdx = scopeIdx;
    }

    if (options?.callsite) {
      const { sourceIdx, line, column } = options.callsite;
      this.#encodedRange += encodeVlq(
        sourceIdx - this.#state.callsiteSourceIdx,
      );

      const emittedLine = line -
        (this.#state.callsiteSourceIdx === sourceIdx
          ? this.#state.callsiteLine
          : 0);
      this.#encodedRange += encodeVlq(emittedLine);

      const emittedColumn = column -
        (this.#state.callsiteLine === line ? this.#state.callsiteColumn : 0);
      this.#encodedRange += encodeVlq(emittedColumn);

      this.#bits.callSourceIdx[octets(sourceIdx, true)]++;
      this.#bits.callLine[octets(line, true)]++;
      this.#bits.callCol[octets(column, true)]++;
      this.#state.callsiteSourceIdx = sourceIdx;
      this.#state.callsiteLine = line;
      this.#state.callsiteColumn = column;
    }

    this.#bits.bindingsLength[octets(options?.bindings?.length ?? 0)]++;
    for (const bindings of options?.bindings ?? []) {
      if (bindings === undefined || typeof bindings === "string") {
        const n = this.#nameIdx(bindings);
        this.#bits.binding[octets(n, true)]++;
        this.#encodedRange += encodeVlq(n);
        continue;
      }

      this.#bits.bindingLength[octets(-bindings.length, true)]++;
      this.#encodedRange += encodeVlq(-bindings.length);
      const n = this.#nameIdx(bindings[0].value);
      this.#bits.binding[octets(n, true)]++;
      this.#encodedRange += encodeVlq(n);
      if (
        bindings[0].from.line !== line || bindings[0].from.column !== column
      ) {
        throw new Error(
          "First binding line/column must match the range start line/column",
        );
      }

      for (let i = 1; i < bindings.length; ++i) {
        const { from: { line, column }, value } = bindings[i];
        const emittedLine = line - bindings[i - 1].from.line;
        const emittedColumn = column -
          (line === bindings[i - 1].from.line
            ? bindings[i - 1].from.column
            : 0);
        this.#encodedRange += encodeVlq(emittedLine);
        this.#encodedRange += encodeVlq(emittedColumn);
        const n = this.#nameIdx(value);
        this.#encodedRange += encodeVlq(n);
        this.#bits.binding[octets(n, true)]++;
        this.#bits.bindingLine[octets(emittedLine, true)]++;
        this.#bits.bindingCol[octets(emittedColumn, true)]++;
      }
    }

    return this;
  }

  end(line: number, column: number): this {
    this.#emitLineSeparator(line);
    this.#emitItemSepratorIfRequired();

    const emittedColumn = column -
      (this.#state.line === line ? this.#state.column : 0);
    this.#encodedRange += encodeMixedVlqList([
      [emittedColumn, "unsigned"],
    ]);

    const diff = line - this.#state.line;
    this.#bits.endLine[octets(diff)]++;
    this.#bits.endCol[octets(emittedColumn)]++;

    this.#state.line = line;
    this.#state.column = column;

    return this;
  }

  #emitLineSeparator(line: number): void {
    for (let i = this.#state.line; i < line; ++i) {
      this.#encodedRange += ";";
    }
  }

  #emitItemSepratorIfRequired(): void {
    if (
      this.#encodedRange !== "" &&
      this.#encodedRange[this.#encodedRange.length - 1] !== ";"
    ) {
      this.#encodedRange += ",";
    }
  }

  #nameIdx(name?: string): number {
    if (name === undefined) {
      return -1;
    }

    let idx = this.#names.indexOf(name);
    if (idx < 0) {
      idx = this.#names.length;
      this.#names.push(name);
    }
    return idx;
  }

  octets() {
    console.log(Object.fromEntries(Object.entries(this.#bits).map(e => {
      return [e[0], Object.fromEntries(e[1].entries().filter(e => e[1] > 0))]
    })));
  }

  build(): string {
    const result = this.#encodedRange;
    this.#state = {
      line: 0,
      column: 0,
      defSourceIdx: 0,
      defScopeIdx: 0,
      callsiteSourceIdx: 0,
      callsiteLine: 0,
      callsiteColumn: 0,
    };
    this.#encodedRange = "";
    return result;
  }
}
