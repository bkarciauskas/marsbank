import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewerCivilHour } from "./use-viewer-civil-hour";

describe("useViewerCivilHour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 4, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null on the first render", () => {
    const seen: Array<number | null> = [];

    renderHook(() => {
      const hour = useViewerCivilHour();
      seen.push(hour);
      return hour;
    });

    expect(seen[0]).toBe(null);
  });

  it("samples the local civil hour after mount", () => {
    const { result } = renderHook(() => useViewerCivilHour());

    expect(result.current).toBe(12);
  });

  it("resamples at the next hour boundary", () => {
    const { result } = renderHook(() => useViewerCivilHour());

    expect(result.current).toBe(12);

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });

    expect(result.current).toBe(13);
  });

  it("resamples on window focus", () => {
    const { result } = renderHook(() => useViewerCivilHour());

    vi.setSystemTime(new Date(2026, 8, 4, 17, 0, 0));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current).toBe(17);
  });

  it("cleans up the boundary timeout and focus listener", () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useViewerCivilHour());

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith("focus", expect.any(Function));

    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1000);
      window.dispatchEvent(new Event("focus"));
    });

    expect(result.current).toBe(12);
  });
});
