// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Codec } from "../types.ts";
import { withUnsignedSupportEnabled } from "../vlq.ts";
import { decode } from "../tag_combined/decode.ts";
import { encode } from "../tag_combined/encode.ts";

export const CODEC: Codec = {
  name: "Tag-Value-Length Combined (Option D, unsigned)",
  description:
    "Prefix original/generated items with a tag and their length. Combine start/end items. Use unsigned VLQ where appropriate.",
  encode: withUnsignedSupportEnabled(encode),
  decode: withUnsignedSupportEnabled(decode),
};
