// Copyright 2024 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { Codec } from "../types.ts";
import { decode } from "../remaining/decode.ts";
import { encode } from "../remaining/encode.ts";
import { withUnsignedSupportEnabled } from "../vlq.ts";

export const CODEC: Codec = {
  name: "Remaining (Option B, unsigned)",
  description:
    'Add a "remaining VLQs count" to items for unknown flags. Use unsigned VLQ where appropriate.',
  encode: withUnsignedSupportEnabled(encode),
  decode: withUnsignedSupportEnabled(decode),
};
