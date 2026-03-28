/**
 * CSS selector generation from DOM elements.
 */

const MAX_DEPTH = 5;
const MAX_LENGTH = 200;

/**
 * Generate a CSS selector for an element.
 * Priority: #id > [data-testid] > tag.class:nth-child chain (max 5 levels).
 */
export function generateSelector(element: Element): string {
  // Prefer id
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Prefer data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // Build path up the DOM
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < MAX_DEPTH) {
    // Check for shortcuts at each level
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    const currentTestId = current.getAttribute('data-testid');
    if (currentTestId) {
      parts.unshift(`[data-testid="${CSS.escape(currentTestId)}"]`);
      break;
    }

    let part = current.tagName.toLowerCase();

    // Add first class name if available
    if (current.classList.length > 0) {
      part += `.${CSS.escape(current.classList[0])}`;
    }

    // Add nth-child for disambiguation
    const parent: Element | null = current.parentElement;
    if (parent) {
      const currentTag = current.tagName;
      const siblings = Array.from(parent.children).filter(
        (s: Element) => s.tagName === currentTag
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-child(${index})`;
      }
    }

    parts.unshift(part);
    current = parent;
    depth++;
  }

  const selector = parts.join(' > ');
  if (selector.length > MAX_LENGTH) {
    return selector.substring(0, MAX_LENGTH - 3) + '...';
  }
  return selector;
}
