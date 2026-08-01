const defaultChunkCharacters = 64 * 1024;

function safeChunkEnd(json: string, start: number, chunkCharacters: number) {
  let end = Math.min(start + chunkCharacters, json.length);

  // JavaScript strings use UTF-16. Do not split a surrogate pair between two
  // TextEncoder calls, or an emoji at a chunk boundary would become the
  // replacement character and the downloaded JSON would no longer match the
  // backup in memory.
  if (end < json.length) {
    const finalCodeUnit = json.charCodeAt(end - 1);
    const endsWithHighSurrogate = finalCodeUnit >= 0xd800 && finalCodeUnit <= 0xdbff;

    if (endsWithHighSurrogate) {
      end -= 1;
    }
  }

  return end;
}

export function createStreamingJsonResponse(
  value: unknown,
  init: ResponseInit = {},
  chunkCharacters = defaultChunkCharacters,
) {
  const json = JSON.stringify(value);

  if (json === undefined) {
    throw new TypeError("The streamed JSON value cannot be serialized.");
  }

  if (!Number.isSafeInteger(chunkCharacters) || chunkCharacters < 2) {
    throw new RangeError("The streamed JSON chunk size must be at least 2 characters.");
  }

  const encoder = new TextEncoder();
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= json.length) {
        controller.close();
        return;
      }

      const end = safeChunkEnd(json, offset, chunkCharacters);
      controller.enqueue(encoder.encode(json.slice(offset, end)));
      offset = end;
    },
  });
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(body, { ...init, headers });
}
