import ru from './ru.json';

/** Interface text by key. Unknown keys are returned as-is so they are easy to spot. */
export function t(key) {
  return ru[key] ?? key;
}
