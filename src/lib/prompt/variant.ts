import { getGenericPrompt } from './GenericPrompt';
import { getPetCompanionPromptV2, getGenericOpeningInstructionV2 } from './PetCompanionPromptV2';
import { getGenericOpeningInstruction } from './GenericPrompt';

export type PromptVariant = 'generic' | 'pet-companion-v2';

function readUrlPromptParam(): PromptVariant | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('prompt');
    if (value === 'generic' || value === 'pet-companion-v2') return value;
    return null;
  } catch {
    return null;
  }
}

function readLocalStoragePrompt(): PromptVariant | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem('promptVariant');
    if (value === 'generic' || value === 'pet-companion-v2') return value;
    return null;
  } catch {
    return null;
  }
}

export function getPromptVariant(): PromptVariant {
  // Priority: URL param -> localStorage -> env -> default
  const fromUrl = readUrlPromptParam();
  if (fromUrl) return fromUrl;

  const fromLocal = readLocalStoragePrompt();
  if (fromLocal) return fromLocal;

  const envDefault = (import.meta as any)?.env?.VITE_DEFAULT_PROMPT_VARIANT as string | undefined;
  if (envDefault === 'generic' || envDefault === 'pet-companion-v2') return envDefault;

  // Default ON for V2 as requested
  return 'pet-companion-v2';
}

export function getGenericPromptByVariant(
  petTypeDescription: string,
  petName?: string,
  userData?: any
): string {
  const variant = getPromptVariant();
  if (variant === 'pet-companion-v2') {
    return getPetCompanionPromptV2(petTypeDescription, petName, userData);
  }
  return getGenericPrompt(petTypeDescription, petName, userData);
}

export function getGenericOpeningInstructionByVariant(
  petTypeDescription: string,
  petName?: string,
  userData?: any
): string {
  const variant = getPromptVariant();
  if (variant === 'pet-companion-v2') {
    return getGenericOpeningInstructionV2(petTypeDescription, petName, userData);
  }
  return getGenericOpeningInstruction(petTypeDescription, petName, userData);
}


