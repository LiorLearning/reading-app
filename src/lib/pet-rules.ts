// Central mapping for pet prompt rules used by the AI prompt sanitizer

export interface PetRule {
	// Short natural description, used to replace second-person references with the pet persona
	description: string;
	// Extra instruction appended to the sanitization system/user prompts to guide replacements
	instruction: string;
}

// Known pets across the app (from PetPage store, avatar service, legacy IDs)
// dog, cat, hamster are default; extended: monkey, parrot, dragon, unicorn, bobo, feather, pikachu
export const PET_RULES: Record<string, PetRule> = {
	dog: {
		description: 'a friendly dog pet who is loyal, playful, and brave',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a friendly dog pet who is loyal, playful, and brave" when forming visual descriptions.'
	},
	cat: {
		description: 'a curious black cat pet who is clever, agile, and gentle',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a curious cat pet who is clever, agile, and gentle" in image prompts.'
	},
	hamster: {
		description: 'a tiny hamster pet who is cute, energetic, and cuddly',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a tiny hamster pet who is cute, energetic, and cuddly" in image prompts.'
	},
	monkey: {
		description: 'a monkey pet which is brown, thin, cute, and playful',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a monkey pet which is brown, thin, cute, and playful" in image prompts.'
	},
	parrot: {
		description: 'a colorful parrot pet who is cheerful, talkative, and adventurous',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a colorful parrot pet who is cheerful, talkative, and adventurous" in image prompts.'
	},
	dragon: {
		description: 'a friendly dragon pet with shimmering scales and gentle firelight glow',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a friendly dragon pet with shimmering scales and gentle firelight glow" in image prompts.'
	},
	unicorn: {
		description: 'a magical unicorn pet with a sparkling mane and kind heart',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a magical unicorn pet with a sparkling mane and kind heart" in image prompts.'
	},
	bobo: {
		description: 'a special pet named Bobo who is gentle, round, and lovable',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a special pet named Bobo who is gentle, round, and lovable" in image prompts.'
	},
	feather: {
		description: 'a graceful pet named Feather with soft plumage and a calm spirit',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a graceful pet named Feather with soft plumage and a calm spirit" in image prompts.'
	},
	// Optional/legacy or fun pet ID used in store snippet
	pikachu: {
		description: 'a cheerful electric creature with bright yellow fur and rosy cheeks',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a cheerful electric creature with bright yellow fur and rosy cheeks" in image prompts.'
	},
	panda: {
		description: 'a cute panda pet who is cute, cuddly, and playful',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a cute panda pet who is cute, cuddly, and playful" in image prompts.'
	},
	deer: {
		description: 'a cute deer pet who is cute, cuddly, and playful',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a cute deer pet who is cute, cuddly, and playful" in image prompts.'
	},
	labubu: {
		description: 'a playful Labubu pet who is mischievous, cute, and energetic',
		instruction: 'Replace any second-person references ("you") with the pet persona: "a playful Labubu pet who is mischievous, cute, and energetic" in image prompts.'
	},
};

export function getPetRule(petId: string | undefined | null): PetRule | undefined {
	if (!petId) return undefined;
	const key = String(petId).toLowerCase();
	return PET_RULES[key];
}


