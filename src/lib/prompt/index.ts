import { getGenericPromptByVariant } from './variant';
import {
  getHouseBuildingPrompt,
  getFoodAdventurePrompt,
  getDressingCompetitionPrompt,
  getTravelAdventurePrompt,
  getFriendAdventurePrompt,
  getWhoMadeThePetsSickPrompt,
  getPetSchoolPrompt,
  getPetThemeParkPrompt,
  getPetMallPrompt,
  getPetCarePrompt,
  getPlantDreamsPrompt,
  getStoryAdventurePrompt
} from './adventures/adventurePrompts';

export function composePrompt(
  adventureType: string,
  petTypeDescription: string,
  petName?: string,
  userData?: any
): string {
  const generic = getGenericPromptByVariant(petTypeDescription, petName, userData);

  if (adventureType === 'house') {
    const specific = getHouseBuildingPrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'food') {
    const specific = getFoodAdventurePrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'dressing-competition') {
    const specific = getDressingCompetitionPrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'travel') {
    const specific = getTravelAdventurePrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'friend') {
    const specific = getFriendAdventurePrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'who-made-the-pets-sick') {
    const specific = getWhoMadeThePetsSickPrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'pet-school') {
    const specific = getPetSchoolPrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'pet-theme-park') {
    const specific = getPetThemeParkPrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'pet-mall') {
    const specific = getPetMallPrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'pet-care') {
    const specific = getPetCarePrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'plant-dreams') {
    const specific = getPlantDreamsPrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  if (adventureType === 'story') {
    const specific = getStoryAdventurePrompt(petTypeDescription, petName, userData);
    return `${generic}\n\nSpecific to each adventure:\n\n${specific}`;
  }

  return generic;
}


