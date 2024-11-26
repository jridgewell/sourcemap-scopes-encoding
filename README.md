# Source Map "Scopes" encoding comparison

This repository implements various ideas for encoding [source map scopes](https://github.com/tc39/source-map/blob/main/proposals/scopes.md). The goal is to evaluate different encoding schemes w.r.t. complexity, size and extensibility.

## Comparing different encoding schemes

The repository includes a simple tool that compares the different encoding schemes against each other. It takes as input a list of source maps and a list of encoding schemes, and it spits out the size of the resulting source map (uncompressed, gzip, brotli). The input source maps require scope information in the format of the current proposal.

Usage:

```
deno -R src/main.ts [OPTIONS] FILES...

Options:
        --prefix       Include the "Prefix" encoding scheme (Option A)
        --remaining    Include the "Remaining" encoding scheme (Option B)
        --tag-split    Include the "Tag Split" encoding scheme (Option C)
        --tag-combined Include the "Tag Combined" encoding scheme (Option C2)
        --verify       Internal. Round-trip decode each encoding scheme and compare the result against the input codec.
```

## Source map examples

The scope information in the `./examples` directory are obtained with a customized [terser](https://github.com/terser/terser). The customized terser supports basic function and block scopes, as well as variable renaming.

The examples are:

  * *simple.min.js.map*: Two tiny scripts with two simple functions.
  * *common.min.js.map*: The `front_end/core/common` module the Chrome DevTools repository.
  * *sdk.min.js.map*: The `front_end/core/sdk` module from the Chrome DevTools repository.
  * *typescript.min.js.map*: The `lib/typescript.js` file from the tsc node module.

## Results

```
deno task all
Task all deno -R src/main.ts --prefix --remaining --tag-split --tag-combined ./examples/simple.min.js.map ./examples/common.min.js.map ./examples/sdk.min.js.map ./examples/typescript.min.js.map

Name:         Proposal
Description:  The currently proposed "Scopes" (stage 3) encoding

Name:         Prefix (Option A)
Description:  Prefix start/end items with their length

Name:         Remaining (Option B)
Description:  Add a "remaining VLQs count" to items for unknown flags

Name:         Tag-Value-Length Split (Option C)
Description:  Prefix start/end items with a tag and their length

Name:         Tag-Value-Length Combined (Option C2)
Description:  Prefix original/generated items with a tag and their length. Combine start/end items.

┌───────┬────────────────────────────────────┬─────────────────────────────────────────┬───────────────────┬───────────┬────────────────────────┬───────────┬──────────────────────────┬───────────┐
│ (idx) │ File                               │ Codec                                   │ Uncompressed size │ Δ raw     │ Compressed size (gzip) │ Δ gzip    │ Compressed size (brotli) │ Δ brotli  │
├───────┼────────────────────────────────────┼─────────────────────────────────────────┼───────────────────┼───────────┼────────────────────────┼───────────┼──────────────────────────┼───────────┤
│     0 │ "./examples/simple.min.js.map"     │                                         │                   │           │                        │           │                          │           │
│     1 │                                    │ "Proposal"                              │ "173"             │ ""        │ "137"                  │ ""        │ "103"                    │ ""        │
│     2 │                                    │ "Prefix (Option A)"                     │ "188"             │ "+8.67%"  │ "142"                  │ "+3.65%"  │ "116"                    │ "+12.62%" │
│     3 │                                    │ "Remaining (Option B)"                  │ "164"             │ "-5.2%"   │ "133"                  │ "-2.92%"  │ "106"                    │ "+2.91%"  │
│     4 │                                    │ "Tag-Value-Length Split (Option C)"     │ "172"             │ "-0.58%"  │ "119"                  │ "-13.14%" │ "95"                     │ "-7.77%"  │
│     5 │                                    │ "Tag-Value-Length Combined (Option C2)" │ "160"             │ "-7.51%"  │ "112"                  │ "-18.25%" │ "92"                     │ "-10.68%" │
│     6 │                                    │                                         │                   │           │                        │           │                          │           │
│     7 │ "./examples/common.min.js.map"     │                                         │                   │           │                        │           │                          │           │
│     8 │                                    │ "Proposal"                              │ "35,052"          │ ""        │ "10,517"               │ ""        │ "10,396"                 │ ""        │
│     9 │                                    │ "Prefix (Option A)"                     │ "38,510"          │ "+9.87%"  │ "11,940"               │ "+13.53%" │ "11,561"                 │ "+11.21%" │
│    10 │                                    │ "Remaining (Option B)"                  │ "32,699"          │ "-6.71%"  │ "10,785"               │ "+2.55%"  │ "10,652"                 │ "+2.46%"  │
│    11 │                                    │ "Tag-Value-Length Split (Option C)"     │ "42,997"          │ "+22.67%" │ "12,296"               │ "+16.92%" │ "11,906"                 │ "+14.52%" │
│    12 │                                    │ "Tag-Value-Length Combined (Option C2)" │ "39,996"          │ "+14.1%"  │ "11,728"               │ "+11.51%" │ "11,358"                 │ "+9.25%"  │
│    13 │                                    │                                         │                   │           │                        │           │                          │           │
│    14 │ "./examples/sdk.min.js.map"        │                                         │                   │           │                        │           │                          │           │
│    15 │                                    │ "Proposal"                              │ "156,978"         │ ""        │ "48,204"               │ ""        │ "47,504"                 │ ""        │
│    16 │                                    │ "Prefix (Option A)"                     │ "171,191"         │ "+9.05%"  │ "53,802"               │ "+11.61%" │ "52,406"                 │ "+10.32%" │
│    17 │                                    │ "Remaining (Option B)"                  │ "146,778"         │ "-6.5%"   │ "49,367"               │ "+2.41%"  │ "48,772"                 │ "+2.67%"  │
│    18 │                                    │ "Tag-Value-Length Split (Option C)"     │ "190,214"         │ "+21.17%" │ "55,623"               │ "+15.39%" │ "53,853"                 │ "+13.37%" │
│    19 │                                    │ "Tag-Value-Length Combined (Option C2)" │ "177,542"         │ "+13.1%"  │ "53,155"               │ "+10.27%" │ "51,862"                 │ "+9.17%"  │
│    20 │                                    │                                         │                   │           │                        │           │                          │           │
│    21 │ "./examples/typescript.min.js.map" │                                         │                   │           │                        │           │                          │           │
│    22 │                                    │ "Proposal"                              │ "1,289,803"       │ ""        │ "433,155"              │ ""        │ "405,917"                │ ""        │
│    23 │                                    │ "Prefix (Option A)"                     │ "1,390,622"       │ "+7.82%"  │ "482,406"              │ "+11.37%" │ "445,729"                │ "+9.81%"  │
│    24 │                                    │ "Remaining (Option B)"                  │ "1,226,293"       │ "-4.92%"  │ "444,176"              │ "+2.54%"  │ "419,502"                │ "+3.35%"  │
│    25 │                                    │ "Tag-Value-Length Split (Option C)"     │ "1,524,348"       │ "+18.18%" │ "496,194"              │ "+14.55%" │ "458,171"                │ "+12.87%" │
│    26 │                                    │ "Tag-Value-Length Combined (Option C2)" │ "1,435,902"       │ "+11.33%" │ "483,136"              │ "+11.54%" │ "448,209"                │ "+10.42%" │
│    27 │                                    │                                         │                   │           │                        │           │                          │           │
└───────┴────────────────────────────────────┴─────────────────────────────────────────┴───────────────────┴───────────┴────────────────────────┴───────────┴──────────────────────────┴───────────┘
```

## Goal: future-proofing "Scopes"

The current "Scopes" encoding is not ideal w.r.t. to future extension:

* Adding new fields to `OriginalScope` and `GeneratedRange` in a backwards compatible way is impossible. Any tool implementing the current proposal would break once we add new optional fields to either data structure.

* The encoding uses the `,` and `;` characters on top of base64 encoded VLQ numbers. Moving to a future binary source map format will require a different encoding for "Scopes" to account for `,` and `;`.

We should aim for an encoding that is both forwards-compatible and is purely VLQ based: So the only difference between the current JSON source map format and a potential future binary format is how VLQs are encoded.

The crux of the issue is to find the right balance between

* retaining some flexibility for future extensions without going overboard (e.g DWARF-style encoding),
* encoding/decoding complexity,
* and encoded size.

This repository proposes some potential "Scopes" encodings that keep both goals in mind while aiming for a healthy balance.

## Grammar

The encoding formats are presented in a EBNF-like grammar with:
* there is only one terminal: a VLQ. Each terminal is labelled and we denote them with uppercase (e.g. `TERMINAL` is a VLQ with the label 'TERMINAL').
* non-terminals denoted with snake case (e.g. `non_term`).
* `symbol*` means zero or more repetitions of `symbol`.
* `symbol?` means zero or one `symbol`.
* `symbol[N]` means N occurrences of `symbol`.

## Option A - Prefix items with their length

```
original_scopes = (LENGTH original_item)*

original_item = original_start_item | original_end_item

original_start_item =
    LINE
    COLUMN
    FLAGS
    NAME? // present if FLAGS<0> is set
    KIND? // present if FLAGS<1> is set
    VARIABLE_COUNT
    VARIABLE[VARIABLE_COUNT]

original_end_item =
    LINE
    COLUMN

generated_ranges = (LENGTH generated_item)*

generated_item = generated_start_item | generated_end_item

generated_start_item =
    COLUMN   // the actual value is COLUMN<1:n>.
    LINE?    // if COLUMN<0> is set.
    FLAGS
    DEFINITION_SOURCE_OFFSET?  // present if FLAGS<0> is set
    DEFINITION_ITEM_OFFSET?    // present if FLAGS<0> is set
    CALL_SITE_SOURCE?          // present if FLAGS<1> is set
    CALL_SITE_LINE?            // present if FLAGS<1> is set
    CALL_SITE_COLUMN?          // present if FLAGS<1> is set
    BINDING_COUNT
    binding[BINDING_COUNT]

binding =
    EXPR_OR_SUB_RANGE_LENGTH   // -1 = not available, >=0 offset into "names"
    EXPR_0?                    // present if EXPR_OR_SUBRANGE_LENGTH < -1.
    sub_range_binding[-EXPR_OR_SUBRANGE_LENGTH - 1]

sub_range_binding =
    LINE
    COLUMN
    EXPR

generated_end_item =
    COLUMN   // the actual value is COLUMN<1:n>.
    LINE?    // if COLUMN<0> is set.
```

This is identical to the current proposal modulo:
* Each item is prefixed with the number of VLQs in the item
* Variables in `OriginalScope` and bindings in `GeneratedRange` are prefixed with their length
* columns in the generated range encode whether a line VLQ is present or not

`original_start_item` and `original_end_item` are distinguished by their length: A "end" item always has 2 VLQs while a "start" item has at least 3.
`generated_start_item` and `generated_end_item` are distinguished by their length: A "end" item has 1 or 2 VLQs while a "start" item has at least 3.


## Option B - Add "remaining" count in the presence of unknown flags

To distinguish start/end items, we have to use an additional bit. For `original_*_item` we use a bit in `LINE` while for `generated_*_item` we use another bit in `COLUMN`.

We'll list only the changed productions w.r.t. to "Option A":

```
original_scopes = original_item*

original_start_item =
    LINE  // the actual value is LINE<1:n>. LINE<0> is always 0 for original_start_item.
    COLUMN
    FLAGS
    NAME? // present if FLAGS<0> is set
    KIND? // present if FLAGS<1> is set
    VARIABLE_COUNT
    VARIABLE[VARIABLE_COUNT]
    REMAINING?  // present if FLAGS<n:3> is not zero.
    REST[REMAINING]

original_end_item =
    LINE // the actual value is LINE<1:n>. LINE<0> is always 1 for original_end_item.
    COLUMN

generated_ranges = generated_item*

generated_start_item =
    COLUMN   // the actual value is COLUMN<2:n>. COLUMN<1> is always 0 for generated_start_item.
    LINE?    // if COLUMN<0> is set.
    FLAGS
    DEFINITION_SOURCE_OFFSET?  // present if FLAGS<0> is set
    DEFINITION_ITEM_OFFSET?    // present if FLAGS<0> is set
    CALL_SITE_SOURCE?          // present if FLAGS<1> is set
    CALL_SITE_LINE?            // present if FLAGS<1> is set
    CALL_SITE_COLUMN?          // present if FLAGS<1> is set
    BINDING_COUNT
    binding[BINDING_COUNT]
    REMAINING?  // present if FLAGS<n:4> is not zero.
    REST[REMAINING]

generated_end_item =
    COLUMN   // the actual value is COLUMN<2:n>. COLUMN<1> is always 1 for generated_end_item.
    LINE?    // if COLUMN<0> is set.
```

Advantages over Option A:
* We only pay the price of encoding the item length once we actually add new fields
* Variables/bindings are not included, so REMAINING stays small even for scopes/ranges with lots of variables

Quirks:
* Adding new marker flags to FLAGS (not new fields) requires generators to emit a `REMAINING` value of 0.


## Option C - Tag-Length-Value

Similar to Option A but we prefix each item not only with it's length but a tag as well. The advantages are:

* We can encode scopes and ranges in one blob. That is the JSON could have a single "scopes" field containing the combination of "originalScopes" and "generatedRanges".
* Start/end items can be distinguished by their tag.
* We keep the door open for not only extending `original_start_item` and `generated_start_item`, but adding new item types all-together.
* `GeneratedRange.definition` only requires one index instead of two.

Since it's similar to option A, we'll list only the changed productions:

```
scopes = items*

item =
      "0x1" LENGTH original_start_item
    | "0x2" LENGTH original_end_item
    | "0x3" LENGTH generated_start_item
    | "0x4" LENGTH generated_end_item

generated_start_item =
    COLUMN   // the actual value is COLUMN<2:n>. COLUMN<1> is always 0 for generated_start_item.
    LINE?    // if COLUMN<0> is set.
    FLAGS
    DEFINITION_ITEM_OFFSET?    // present if FLAGS<0> is set
    CALL_SITE_SOURCE?          // present if FLAGS<1> is set
    CALL_SITE_LINE?            // present if FLAGS<1> is set
    CALL_SITE_COLUMN?          // present if FLAGS<1> is set
    BINDING_COUNT
    binding[BINDING_COUNT]
    REMAINING?  // present if FLAGS<n:4> is not zero.
    REST[REMAINING]
```

### Option C2 - DWARF-style zero entries

This is a variant to Option C. Instead of using `original_start_item` and `original_end_item`, we combine both into a `original_item`. Similar to DWARF, nesting is achieved by using a special tag to denote the end of a item's children.

```
item =
      "0x0"
    | "0x1" LENGTH original_item
    | "0x2" LENGTH generated_item

original_item =
    START_LINE
    START_COLUMN
    END_LINE
    END_COLUMN
    FLAGS
    // ...

generated_item =
    START_COLUMN
    START_LINE?
    END_COLUMN
    END_LINE?
    FLAGS
    // ....
```

Example of nested scopes (tags only): `[0x1, ...<length + content>, 0x1, ...<length + content>, 0x0, 0x0]`.

This comes with some special rules if we don't want to lose the efficiency of relative line/column numbers for start and end locations:
* A scopes or ranges' start location is relative to the preceding siblings' end location, or the parents' start location if it's the first child.
* A scopes or ranges' end location is relative to it's last child's end location, or it's start location if it does not have any children.

There is also the question of `START_LINE`, and `END_LINE` in `generated_item`. We could encode it's presence in FLAGS or use the LSB of the respective `*_COLUMN`.

