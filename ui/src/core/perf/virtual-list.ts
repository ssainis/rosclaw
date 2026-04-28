import { computed, type ComputedRef, ref, type Ref } from "vue";
import { estimateWindowRows } from "./list-utils";

export interface VirtualListOptions {
  /** Reactive array of all items to virtualize. */
  items: ComputedRef<unknown[]> | Ref<unknown[]>;
  /** Approximate height of each rendered row in pixels (default 32). */
  rowHeightPx?: number;
  /** Visible container height in pixels (default 480). */
  containerHeightPx?: number;
}

export interface VirtualListState<T> {
  /** The subset of items to render for the current scroll position. */
  renderedItems: ComputedRef<T[]>;
  /** The scroll offset in list rows (0-based). */
  scrollTopRow: Ref<number>;
  /** Height of the top spacer element in px (for scrollbar positioning). */
  topSpacerPx: ComputedRef<number>;
  /** Height of the bottom spacer element in px (for scrollbar positioning). */
  bottomSpacerPx: ComputedRef<number>;
  /** Total virtual height of the list in px. */
  totalHeightPx: ComputedRef<number>;
  /** Called when the scroll container fires a scroll event. */
  onScroll: (event: Event) => void;
}

/**
 * Minimal virtual-list composable.
 *
 * Wire up in a component using two zero-height spacer divs:
 *  <div :style="{ height: virtualList.topSpacerPx.value + 'px' }" />
 *  <tr v-for="item in virtualList.renderedItems.value" .../>
 *  <div :style="{ height: virtualList.bottomSpacerPx.value + 'px' }" />
 *
 * Bind the wrapping scrollable container's `scroll` event to `virtualList.onScroll`.
 */
export function useVirtualList<T>(options: VirtualListOptions): VirtualListState<T> {
  const rowHeightPx = options.rowHeightPx ?? 32;
  const containerHeightPx = options.containerHeightPx ?? 480;
  const windowSize = estimateWindowRows(containerHeightPx, rowHeightPx);

  const scrollTopRow = ref(0);

  const items = options.items as ComputedRef<T[]> | Ref<T[]>;

  const renderedItems = computed<T[]>(() => {
    const all = items.value;
    const start = Math.max(0, scrollTopRow.value - 1);
    const end = Math.min(all.length, start + windowSize);
    return all.slice(start, end);
  });

  const topSpacerPx = computed(() => {
    const start = Math.max(0, scrollTopRow.value - 1);
    return start * rowHeightPx;
  });

  const bottomSpacerPx = computed(() => {
    const all = items.value;
    const start = Math.max(0, scrollTopRow.value - 1);
    const end = Math.min(all.length, start + windowSize);
    const remaining = Math.max(0, all.length - end);
    return remaining * rowHeightPx;
  });

  const totalHeightPx = computed(() => items.value.length * rowHeightPx);

  function onScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    scrollTopRow.value = Math.floor(target.scrollTop / rowHeightPx);
  }

  return {
    renderedItems,
    scrollTopRow,
    topSpacerPx,
    bottomSpacerPx,
    totalHeightPx,
    onScroll,
  };
}
