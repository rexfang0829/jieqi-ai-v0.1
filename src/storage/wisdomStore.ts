const KEY = 'jieqi-ai-wisdom';

export function loadWisdom(): string {
  return localStorage.getItem(KEY) ?? '';
}

export function saveWisdom(text: string) {
  localStorage.setItem(KEY, text);
}
