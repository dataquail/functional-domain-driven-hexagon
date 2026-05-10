import { describe, expect, it } from "vitest";
import { computePaginationView } from "./user-list.view-model";

describe("computePaginationView — empty set", () => {
  it("returns isEmpty=true, totalPages=1, no nav, range 0..0", () => {
    const v = computePaginationView({ currentPage: 1, pageSize: 10, total: 0 });
    expect(v.isEmpty).toBe(true);
    expect(v.totalPages).toBe(1);
    expect(v.hasPrev).toBe(false);
    expect(v.hasNext).toBe(false);
    expect(v.displayedRange).toEqual({ from: 0, to: 0 });
  });
});

describe("computePaginationView — totals and range", () => {
  it("computes totalPages by ceiling division and 1-indexed inclusive range", () => {
    const v = computePaginationView({ currentPage: 1, pageSize: 10, total: 25 });
    expect(v.totalPages).toBe(3);
    expect(v.displayedRange).toEqual({ from: 1, to: 10 });
    expect(v.hasPrev).toBe(false);
    expect(v.hasNext).toBe(true);
  });

  it("clamps the displayed range's upper bound to total on the last page", () => {
    const v = computePaginationView({ currentPage: 3, pageSize: 10, total: 25 });
    expect(v.displayedRange).toEqual({ from: 21, to: 25 });
    expect(v.hasNext).toBe(false);
  });
});

describe("computePaginationView — defensive clamping", () => {
  it("clamps currentPage below 1 up to 1", () => {
    const v = computePaginationView({ currentPage: 0, pageSize: 10, total: 25 });
    expect(v.page).toBe(1);
  });

  it("clamps currentPage above totalPages down to totalPages", () => {
    const v = computePaginationView({ currentPage: 99, pageSize: 10, total: 25 });
    expect(v.page).toBe(3);
  });

  it("treats pageSize <= 0 as 1 to avoid divide-by-zero", () => {
    const v = computePaginationView({ currentPage: 1, pageSize: 0, total: 5 });
    expect(v.pageSize).toBe(1);
    expect(v.totalPages).toBe(5);
  });

  it("treats negative total as 0 (empty)", () => {
    const v = computePaginationView({ currentPage: 1, pageSize: 10, total: -3 });
    expect(v.isEmpty).toBe(true);
    expect(v.total).toBe(0);
  });
});
