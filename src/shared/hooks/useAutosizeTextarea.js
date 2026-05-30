import { useLayoutEffect } from 'react';

const clampHeight = (height, minHeight, maxHeight) => Math.max(minHeight, Math.min(height, maxHeight));

export default function useAutosizeTextarea(ref, value, { maxHeight = 520, minHeight = 0 } = {}) {
  useLayoutEffect(() => {
    const textarea = ref.current;

    if (!textarea) {
      return;
    }

    const computedStyle = window.getComputedStyle(textarea);
    const borderHeight = Number.parseFloat(computedStyle.borderTopWidth) + Number.parseFloat(computedStyle.borderBottomWidth);
    const computedMinHeight = Number.parseFloat(computedStyle.minHeight) || 0;
    const viewportMaxHeight = Math.max(180, Math.floor(window.innerHeight * 0.58));
    const resolvedMinHeight = Math.max(minHeight, computedMinHeight);
    const resolvedMaxHeight = Math.max(resolvedMinHeight, Math.min(maxHeight, viewportMaxHeight));

    textarea.style.height = 'auto';

    const fullHeight = textarea.scrollHeight + borderHeight;
    const nextHeight = clampHeight(fullHeight, resolvedMinHeight, resolvedMaxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = fullHeight > resolvedMaxHeight ? 'auto' : 'hidden';
  }, [maxHeight, minHeight, ref, value]);
}
