/**
 * Simple synchronous field validators.
 * Each function returns a string error message or null.
 */

export const required = (label = "Field") => (value) =>
  !value?.toString().trim() ? `${label} is required` : null;

export const minLength = (min, label = "Field") => (value) =>
  value?.length < min ? `${label} must be at least ${min} characters` : null;

export const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ?? "") ? null : "Must be a valid email address";

export const isUrl = (value) => {
  if (!value) return null;
  try {
    new URL(value);
    return null;
  } catch {
    return "Must be a valid URL (include https://)";
  }
};

/**
 * Run multiple validators in sequence; return the first error.
 * @param  {...Function} validators
 * @returns {Function}
 */
export const compose = (...validators) => (value) => {
  for (const v of validators) {
    const error = v(value);
    if (error) return error;
  }
  return null;
};
