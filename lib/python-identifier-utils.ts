/**
 * Utilities for validating and formatting Python identifiers
 * Used for schema names and field names that will be used in generated DSPy code
 */

// Python keywords that cannot be used as identifiers
const PYTHON_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
  'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
  'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
  'raise', 'return', 'try', 'while', 'with', 'yield'
]);

// Common Python built-ins that should be avoided
const PYTHON_BUILTINS = new Set([
  'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'callable', 'chr',
  'classmethod', 'compile', 'complex', 'delattr', 'dict', 'dir', 'divmod',
  'enumerate', 'eval', 'exec', 'filter', 'float', 'format', 'frozenset',
  'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input',
  'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals',
  'map', 'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open',
  'ord', 'pow', 'print', 'property', 'range', 'repr', 'reversed', 'round',
  'set', 'setattr', 'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super',
  'tuple', 'type', 'vars', 'zip'
]);

/**
 * Checks if a character is valid for a Python identifier
 * Valid characters: letters, digits, underscore
 * First character cannot be a digit
 */
export function isValidPythonIdentifierChar(char: string, isFirstChar: boolean = false): boolean {
  if (char.length !== 1) return false;
  
  const code = char.charCodeAt(0);
  
  // Underscore is always valid
  if (code === 95) return true; // _
  
  // Letters (A-Z, a-z)
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return true;
  
  // Digits (0-9) - not valid as first character
  if (code >= 48 && code <= 57) return !isFirstChar;
  
  return false;
}

/**
 * Filters input to only allow valid Python identifier characters
 */
export function filterPythonIdentifier(value: string): string {
  if (!value) return '';
  
  let filtered = '';
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (isValidPythonIdentifierChar(char, i === 0)) {
      filtered += char;
    }
  }
  
  return filtered;
}

/**
 * Validates if a string is a valid Python identifier
 */
export function isValidPythonIdentifier(identifier: string): boolean {
  if (!identifier) return false;
  
  // Check basic format
  if (!identifier.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) return false;
  
  // Check if it's a keyword or builtin
  if (PYTHON_KEYWORDS.has(identifier) || PYTHON_BUILTINS.has(identifier)) {
    return false;
  }
  
  return true;
}

/**
 * Gets validation error message for invalid Python identifier
 */
export function getPythonIdentifierError(identifier: string): string | null {
  if (!identifier) return 'Name is required';
  
  if (!identifier.match(/^[a-zA-Z_]/)) {
    return 'Must start with a letter or underscore';
  }
  
  if (!identifier.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
    return 'Can only contain letters, numbers, and underscores';
  }
  
  if (PYTHON_KEYWORDS.has(identifier)) {
    return `"${identifier}" is a Python keyword and cannot be used`;
  }
  
  if (PYTHON_BUILTINS.has(identifier)) {
    return `"${identifier}" is a Python builtin and should be avoided`;
  }
  
  return null;
}

/**
 * Suggests a valid alternative for an invalid identifier
 */
export function suggestValidPythonIdentifier(invalid: string): string {
  if (!invalid) return 'field_name';
  
  // Remove invalid characters and convert to snake_case
  let suggestion = invalid
    .replace(/[^a-zA-Z0-9_]/g, '_') // Replace invalid chars with underscore
    .replace(/^[0-9]+/, '') // Remove leading digits
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .toLowerCase();
  
  // Ensure it starts with a letter or underscore
  if (suggestion && !suggestion.match(/^[a-zA-Z_]/)) {
    suggestion = 'field_' + suggestion;
  }
  
  // Handle empty result
  if (!suggestion) {
    suggestion = 'field_name';
  }
  
  // Handle keywords and builtins
  if (PYTHON_KEYWORDS.has(suggestion) || PYTHON_BUILTINS.has(suggestion)) {
    suggestion = suggestion + '_field';
  }
  
  return suggestion;
}

/**
 * Converts a string to PascalCase for schema names
 * Only converts if the string contains spaces or special characters
 */
export function toPascalCase(str: string): string {
  // If it's already a valid Python identifier, don't change it unless it has spaces/special chars
  if (isValidPythonIdentifier(str)) {
    return str;
  }
  
  return str
    .replace(/[^a-zA-Z0-9_]/g, ' ') // Replace non-alphanumeric (except underscore) with spaces
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Converts a string to snake_case for field names
 * Only converts if needed, preserves existing valid snake_case
 */
export function toSnakeCase(str: string): string {
  // If it's already a valid Python identifier with only lowercase, numbers, and underscores, keep it
  if (isValidPythonIdentifier(str) && str === str.toLowerCase() && !str.match(/[A-Z]/)) {
    return str;
  }
  
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2') // Convert camelCase to snake_case
    .replace(/[^a-zA-Z0-9_]/g, '_') // Replace non-alphanumeric (except underscore) with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .toLowerCase();
}
