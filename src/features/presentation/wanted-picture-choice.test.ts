import { afterEach, expect, test, vi } from "vitest";
import { choiceAsPicture, saveWantedPicture } from "./wanted-picture-choice";

afterEach(() => vi.unstubAllGlobals());

const objectKey = "40000000-0000-4000-8000-000000000001/50000000-0000-4000-8000-000000000001.png";

test("an upload goes to its signed slot first, then is attached to the Wanted", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ ok: true, data: { signedUrl: "https://storage.test/slot", objectKey } }),
    })
    .mockResolvedValueOnce({ ok: true })
    .mockResolvedValueOnce({ json: async () => ({ ok: true, data: { done: true } }) });
  vi.stubGlobal("fetch", fetchMock);
  const blob = new Blob(["png"], { type: "image/png" });

  const result = await saveWantedPicture("w1", { kind: "upload", blob, previewUrl: "blob:x" });

  expect(result.ok).toBe(true);
  expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
    "/api/marketplace/wanted/picture-upload",
    "https://storage.test/slot",
    "/api/marketplace/wanted/w1/picture",
  ]);
  expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: "PUT", body: blob });
  expect(JSON.parse(String(fetchMock.mock.calls[2]![1].body))).toEqual({
    preset: null,
    objectKey,
  });
});

test("a failed upload never attaches a missing file", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      json: async () => ({ ok: true, data: { signedUrl: "https://storage.test/slot", objectKey } }),
    })
    .mockResolvedValueOnce({ ok: false });
  vi.stubGlobal("fetch", fetchMock);

  const result = await saveWantedPicture("w1", {
    kind: "upload",
    blob: new Blob(["png"]),
    previewUrl: "blob:x",
  });

  expect(result).toMatchObject({ ok: false, code: "PICTURE_UNAVAILABLE" });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("a drawing is saved by its number", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ json: async () => ({ ok: true, data: { done: true } }) });
  vi.stubGlobal("fetch", fetchMock);
  await saveWantedPicture("w1", { kind: "preset", preset: 12 });
  expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual({
    preset: 12,
    objectKey: null,
  });
});

test("previews a choice as the poster would show it", () => {
  expect(choiceAsPicture({ kind: "auto" })).toBeNull();
  expect(choiceAsPicture({ kind: "preset", preset: 3 })).toEqual({ kind: "preset", preset: 3 });
  expect(choiceAsPicture({ kind: "upload", blob: new Blob([]), previewUrl: "blob:x" })).toEqual({
    kind: "upload",
    url: "blob:x",
  });
});
