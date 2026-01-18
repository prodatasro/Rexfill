import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithTimeout, withTimeout, TimeoutError } from "./fetchWithTimeout";

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("TimeoutError", () => {
    it("creates error with default message", () => {
      const error = new TimeoutError();
      expect(error.message).toBe("Request timed out");
      expect(error.name).toBe("TimeoutError");
    });

    it("creates error with custom message", () => {
      const error = new TimeoutError("Custom timeout message");
      expect(error.message).toBe("Custom timeout message");
      expect(error.name).toBe("TimeoutError");
    });

    it("is instanceof Error", () => {
      const error = new TimeoutError();
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("fetchWithTimeout", () => {
    it("returns response on successful fetch", async () => {
      const mockResponse = new Response("OK", { status: 200 });
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const responsePromise = fetchWithTimeout("https://example.com");
      await vi.runAllTimersAsync();
      const response = await responsePromise;

      expect(response).toBe(mockResponse);
      expect(fetch).toHaveBeenCalledWith("https://example.com", {
        signal: expect.any(AbortSignal),
      });
    });

    it("throws TimeoutError when request times out", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            const signal = options?.signal as AbortSignal;
            signal.addEventListener("abort", () => {
              const error = new Error("Aborted");
              error.name = "AbortError";
              reject(error);
            });
          })
      );

      const promise = fetchWithTimeout("https://example.com", { timeout: 1000 });

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow(TimeoutError);
    });

    it("passes through fetch options", async () => {
      const mockResponse = new Response("OK");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

      const responsePromise = fetchWithTimeout("https://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "test" }),
      });
      await vi.runAllTimersAsync();
      await responsePromise;

      expect(fetch).toHaveBeenCalledWith("https://example.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "test" }),
        signal: expect.any(AbortSignal),
      });
    });

    it("rethrows non-abort errors", async () => {
      const networkError = new Error("Network error");
      vi.spyOn(globalThis, "fetch").mockRejectedValue(networkError);

      await expect(fetchWithTimeout("https://example.com")).rejects.toThrow(
        "Network error"
      );
    });
  });

  describe("withTimeout", () => {
    it("resolves when promise completes before timeout", async () => {
      const promise = Promise.resolve("success");
      const result = await withTimeout(promise, 1000);
      expect(result).toBe("success");
    });

    it("throws TimeoutError when promise takes too long", async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve("too late"), 2000);
      });

      const promise = withTimeout(slowPromise, 1000);

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow(TimeoutError);
    });

    it("uses custom error message", async () => {
      const slowPromise = new Promise((resolve) => {
        setTimeout(() => resolve("too late"), 2000);
      });

      const promise = withTimeout(slowPromise, 1000, "Custom timeout");

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow("Custom timeout");
    });

    it("propagates original promise rejection", async () => {
      const failingPromise = Promise.reject(new Error("Original error"));

      await expect(withTimeout(failingPromise, 1000)).rejects.toThrow(
        "Original error"
      );
    });
  });
});
