import { describe, expect, it } from "vitest";
import { computed, ref } from "vue";
import { useVirtualList } from "./virtual-list";

describe("useVirtualList", () => {
  it("renders the initial window of items", () => {
    const items = computed(() => Array.from({ length: 100 }, (_, i) => i));
    const list = useVirtualList<number>({
      items,
      rowHeightPx: 32,
      containerHeightPx: 128,
    });

    expect(list.renderedItems.value.length).toBeGreaterThan(0);
    expect(list.renderedItems.value.length).toBeLessThanOrEqual(7);
  });

  it("updates rendered window when scrollTopRow changes", () => {
    const items = ref(Array.from({ length: 200 }, (_, i) => i));
    const list = useVirtualList<number>({
      items,
      rowHeightPx: 32,
      containerHeightPx: 128,
    });

    list.scrollTopRow.value = 50;
    expect(list.renderedItems.value[0]).toBeGreaterThan(45);
  });

  it("computes top and bottom spacer heights correctly", () => {
    const items = ref(Array.from({ length: 100 }, (_, i) => i));
    const list = useVirtualList<number>({
      items,
      rowHeightPx: 32,
      containerHeightPx: 128,
    });

    list.scrollTopRow.value = 20;
    expect(list.topSpacerPx.value).toBe(19 * 32);
    expect(list.bottomSpacerPx.value).toBeGreaterThan(0);
    expect(list.totalHeightPx.value).toBe(100 * 32);
  });

  it("handles empty data without error", () => {
    const items = ref<number[]>([]);
    const list = useVirtualList<number>({ items });

    expect(list.renderedItems.value).toEqual([]);
    expect(list.topSpacerPx.value).toBe(0);
    expect(list.bottomSpacerPx.value).toBe(0);
  });
});
