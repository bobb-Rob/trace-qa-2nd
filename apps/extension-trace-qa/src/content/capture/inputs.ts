/**
 * Input/change event capture module with PII sanitization.
 */

import type { CaptureConfig, InputPayload } from '../types';
import { generateSelector } from '../utils/selectors';
import { sanitizeInputValue } from '../utils/sanitization';
import { sessionRelativeTime, generateId } from '../utils/timing';
import { debounce } from '../utils/throttle';

const DEBOUNCE_MS = 300;

type InputElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isInputElement(el: Element): el is InputElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

export function startInputCapture(config: CaptureConfig): () => void {
  const previousValues = new WeakMap<Element, string>();

  function captureInput(target: InputElement, isBlur: boolean): void {
    const now = Date.now();
    const currentValue = target.value || '';
    const prevValue = previousValues.get(target) || '';

    // Skip if value hasn't changed
    if (currentValue === prevValue && !isBlur) return;

    previousValues.set(target, currentValue);

    const payload: InputPayload = {
      id: generateId(),
      selector: generateSelector(target),
      tagName: target.tagName,
      inputType: target instanceof HTMLInputElement ? target.type : target.tagName.toLowerCase(),
      name: target.name || '',
      value: sanitizeInputValue(currentValue, target),
      previousValue: sanitizeInputValue(prevValue, target),
      ariaLabel: target.getAttribute('aria-label') ?? undefined,
      role: target.getAttribute('role') ?? undefined,
      pageUrl: location.href,
      isFocused: document.activeElement === target,
      isBlur,
    };

    config.buffer.push({
      type: 'input',
      timestamp: now,
      relativeTime: sessionRelativeTime(config.sessionStartTime),
      payload,
    });
  }

  const debouncedCapture = debounce((target: InputElement, isBlur: boolean) => {
    captureInput(target, isBlur);
  }, DEBOUNCE_MS);

  function handleChange(e: Event): void {
    const target = e.target as Element;
    if (!target || !isInputElement(target)) return;
    debouncedCapture(target, false);
  }

  function handleBlur(e: Event): void {
    const target = e.target as Element;
    if (!target || !isInputElement(target)) return;
    // Flush any pending debounced capture, then capture blur
    debouncedCapture.flush();
    captureInput(target, true);
  }

  document.addEventListener('change', handleChange, true);
  document.addEventListener('blur', handleBlur, true);

  return () => {
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('blur', handleBlur, true);
    debouncedCapture.cancel();
  };
}
