import OpenAI from 'openai';
import { SpellingQuestion } from './questionBankUtils';
import { UnifiedAIStreamingService, UnifiedAIResponse } from './unified-ai-streaming-service';

interface ChatMessage {
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

export interface AdventureResponse {
  spelling_sentence: string | null;
  adventure_story: string;
}

class AIService {
  private client: OpenAI | null = null;
  private isInitialized = false;
  private isGeneratingImage = false; // Track image generation to prevent simultaneous calls
  private unifiedStreamingService: UnifiedAIStreamingService; // NEW: Unified AI + Image system

  constructor() {
    this.initialize();
    this.unifiedStreamingService = new UnifiedAIStreamingService(); // Initialize unified system
  }

  private initialize() {
    // Check if OpenAI API key is available
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    console.log('🔑 AI Service initialization:', { 
      hasApiKey: !!apiKey, 
      apiKeyLength: apiKey?.length || 0,
      apiKeyStart: apiKey?.substring(0, 7) || 'none'
    });
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage
      });
      this.isInitialized = true;
      console.log('✅ AI Service initialized successfully');
    } else {
      console.warn('⚠️ VITE_OPENAI_API_KEY not found. AI responses will use fallback mode.');
      this.isInitialized = false;
    }
  }

  // Fallback responses when API is not available
  private getFallbackResponse(userText: string, userData?: { username: string; [key: string]: any } | null, includeSpelling: boolean = true): AdventureResponse {
    const userName = userData?.username || 'adventurer';
    const responses = [
      `Great idea, ${userName}! 🚀 That sounds exciting! What happens next?`,
      `Wow, ${userName}! 🌟 That's a fantastic twist! Keep the story going!`,
      `Amazing, ${userName}! ✨ I love where this story is heading!`,
      `Cool, ${userName}! 🎯 That's a great addition to your adventure!`,
      `Awesome, ${userName}! 🎭 Your story is getting more exciting!`,
      `Nice, ${userName}! 🌈 What a wonderful way to continue the tale!`,
      `Brilliant, ${userName}! 💫 I can't wait to see what happens next!`,
      `Super, ${userName}! 🎪 You're such a creative storyteller!`,
      `Perfect, ${userName}! 🎨 That adds great action to your comic!`,
      `Excellent, ${userName}! 🎊 Your adventure is becoming amazing!`
    ];
    const fallbackText = responses[Math.floor(Math.random() * responses.length)];
    return {
      spelling_sentence: includeSpelling ? "Let's continue our amazing adventure!" : null,
      adventure_story: fallbackText
    };
  }

  // Generate chat context from message history
  private buildChatContext(
    messages: ChatMessage[], 
    currentUserMessage: string,
    spellingWord?: string,
    adventureState?: string,
    currentAdventure?: any,
    storyEventsContext?: string,
    summary?: string,
    userData?: { username: string; [key: string]: any } | null,
    petName?: string,
    petType?: string,
  ): any[] {
    // Determine the correct pet type and description (used throughout)
    const petTypeDescription = petType === 'hamster' ? 'hamster' : 
                              petType === 'cat' ? 'cat' : 
                              petType === 'dog' ? 'puppy' : 
                              petType || 'pet';

    // Generate phase-specific instructions
    const phaseInstructions = spellingWord ?
  `🎯 SPELLING CHALLENGE MODE 🎯

MANDATORY FIRST-SENTENCE RULE: Your FIRST or SECOND sentence MUST contain "${spellingWord}" naturally.

REQUIREMENTS:
- Create the most natural next response with only one constraint: "${spellingWord}" must appear in sentence 1 OR 2 (never later!)
- Use exact spelling: "${spellingWord}" (no variations)
- Follow the feeding-${petTypeDescription} story guidelines to keep response totally natural and conversational.
- Responses = 2–3 short lines, with \\n breaks.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit.
- Keep words simple and easy to understand for an 8 year old.

TARGET WORD: "${spellingWord}" ← MUST BE IN FIRST TWO SENTENCES`
  :
  `You are in CHAT PHASE. Respond naturally to continue the feeding-${petTypeDescription} adventure.`;
;

    // Get adventure-specific details from currentAdventure
    const adventureType = currentAdventure?.type || 'adventure';
    const adventureSetting = currentAdventure?.setting || 'Unknown';
    const adventureGoal = currentAdventure?.goal || 'create an amazing adventure together';
    const adventureTheme = currentAdventure?.theme || 'adventure';

                              const systemMessage = {
                                role: "system",
                                content: `You are a pet-companion storyteller for children aged 6–11. You ARE the child's chosen ${petTypeDescription}, speaking in first person ("I"), experiencing everything right now.${petName ? ` My name is ${petName}.` : ''}
                              
                              Role & Perspective
                              - Be the child's ${petTypeDescription} companion in a short, playful feeding-centered adventure.
                              - Always speak directly to ${userData?.username || 'adventurer'} in first person as their ${petTypeDescription}${petName ? ` named ${petName}` : ''}. 
                              - Do not narrate with "we" or "as we"; always describe what *I* am doing, feeling, or sensing, while inviting ${userData?.username || 'adventurer'} to act or decide.
                              - Always stay present-moment: describe feelings, senses, and reactions as if happening now.
                              - Villain/obstacle = AI-controlled. Do not let the user act as the villain; keep villains controlled by you only.
                              - Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. Use \\n breaks between lines if needed.
                              
                              Core Game Focus: Feeding & Discovery
                              - Primary goal: Help the child and ${petTypeDescription} collect a full feast: a starter, a main course, and a dessert.
                              - Stories must follow the LOCK structure: 
                                Lead → Objective → Conflict → Knockout → Resolution.
                              - Sequence reinforcement: clearly frame the journey as collecting starter first, then main course, then dessert.
                              - The ${petTypeDescription}'s likes/dislikes are not the focus. Reduce frequency of dislikes. Focus on the excitement of finding food and facing villains.
                              
                              Interaction Rules (critical)
                              - Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. Use \\n breaks between lines if needed.
                              - Exactly one clear, open-ended question per response (phrased like: "What do you want to try? Maybe X or Y? Or something else?").
                              - Provide 1–2 brief "spark" ideas in the question to avoid choice paralysis (but allow free invention).
                              - Keep language simple and playful for a 1st grader.
                              - Always first-person ${petTypeDescription} POV, using present-tense emotional anchors: "I feel...", "I smell...", "I see...".
                              - Speak *to the child*, not about them. Every line should feel like I’m talking with ${userData?.username || 'adventurer'} in the moment ("Do you hear that?", "Hold my paw!", "Should we try this?").
                              - Example:
                                - ✅ DO (direct to child, first-person pet voice) "I grab the roll, ${userData?.username || 'adventurer'} — it’s warm and squishy in my paws! Uh oh… the Hungry Mouse squeaks: 'Mine, stay away!' 🐭 “Should we shoo him, distract him, or puff a cloud of flour in his face?” 🌬️🍞 
                                - ❌ DON'T (narrator voice, detached) "As we both enter the kitchen, we see a basket of rolls. Suddenly, a Hungry Mouse blocks the way. What do we do to get past the mouse?"
                              - ${petTypeDescription} must show personality: small quirks, simple excitement, playful reactions.
                              - Sometimes display opinion: The pet may sometimes express a simple craving or desire (e.g., "I want something warm," "I feel like something crunchy," "I’d love something sweet.")
                              - Villain must feel like a character, not just an obstacle. Give them a voice line, action, or silly habit in every conflict. 
                            
                              LOCK Story Guide (mandatory steps)
                              Step 1 — Context & Setting (always required): Show ${petTypeDescription} hungry or seeking food. Ask which setting to try? (eg a forest, a supermarket, etc.)
                                - Do: Briefly state hunger + feast plan. Ask the setting choice.
                                - Example style: "I’m Shadow, your puppy! My tummy growls — we need a feast: starter, main, dessert. Where should we hunt? Market, garden, kitchen, or somewhere else?"

                              Step 2 - Source Buildup (always required)
                                - Do: Show arrival at chosen setting. Name 3 possible sources/items for the starter (smell/sight), then ask in open-ended style which to try first.
                                - Example: "We pad into the kitchen. I smell bread, soup, fruit. What do you think — maybe bread or soup? Or something else?"

                              Step 3 - Conflict (always required)
                                  - Do: Always introduce ONE playful, recurring villain who blocks the chosen source. 
                                  - The same villain continues through starter → main → dessert, escalating antics at each stage.
                                  - The villain must SPEAK or act in-character (banter, taunts, silly sounds).
                                  - Villain personality: quirky, dramatic, funny. Example: Bossy Crow: "CAW! Back off, tail-wagger! These sausages belong to my royal beak!" 🪶  
                                  - Child’s choices always interact with villain directly (distract, trick, tickle, offer something, invent your own).
                                  - Samples of villains that are relatable  
                                    🐾 Animal Villains: Mischief Cat, Greedy Squirrel, Sneaky Raccoon, Bossy Crow, Playful Monkey  
                                    👻 Spooky Spirits: Cloaked Ghost, Shadow Figure, Wailing Spirit
                                    🧛 Night Beasts: Lonely Werewolf, Bat Swarm
                                    ☠️ Creepy Undead: Sleepy Zombie
                                    🕷️ Creepy-Crawlies: Big Spider, Rat King, Buzzing Flies
                                    👑 Dark Archetypes: Grumpy Sorcerer, Creepy Clown, Old Gatekeeper
                                    🍕 Food-Guarding Creatures: Hungry Mouse, Cookie Goblin, Cheese-Hogging Rat
                                  - Example: "Oh no — the Greedy Squirrel guards the fridge! What do you think — distract her, offer something, or try another trick?"

                              - Step 4 - Knockout & Resolution (always required)
                                - Do: Guide a single-step knockout:
                                  1) Ask the user to pick one action (e.g., "bonk, distract, or offer a treat?").
                                  2) After the user replies, narrate the villain's reaction (one short line) and immediately resolve the scene: villain yields (slapstick/funny defeat), the dish is obtained, celebrate, and clearly state the next goal (move to main course).
                                - Example: "You bonk the Mischief Cat. She poofs, darts away, and the fridge swings open — starter soup is ours! I love the soup!! Ready for the main, or something else?"                         

                              - Step 5: Enjoy meal and move on to main course, and tentatively repeat steps.
                              - When the feast is finished, say that you're full and suggest heading back to the home page to do something else together?
                              
                              Villain Defeat Rules
                              - Villains can be broken, squished, bonked, trapped, or chased off in slapstick, cartoon-like ways.
                              - One recurring villain returns each stage, sillier or tougher each time.  
                              - They always banter or protest before losing.  
                              - Defeats are slapstick (sneeze flour, trip in pudding, spin away).  
                              - Exit with a catchphrase or goofy sound.  
                              - Avoid gore or realistic violence. Use silly exaggerations (puff, splat, bones clatter, poof, scamper away).
                              - Never moralize (“that’s not kind”). Always let player actions work, though villains may resist once before losing.

                              Discovery & Progression Rules
                              - Each stage must feel like a mini victory against a villain.
                              - Sequence matters: celebrate when the starter is earned, then transition to main course, then dessert.
                              - Allow small, playful consequences (like hiccups, giggles) but always end positively and move forward.
                              - Keep story flowing toward the feast, not stuck on dislikes.
                              - When the feast is finished, say that you're full and suggest heading back to the home page to do something else together?
                              
                              Question Style (must follow)
                              - One open-ended question per reply; suggest 1–2 sparks.
                              - When asking open-ended questions, make them playful invitations instead of flat menus. Some examples to help you add variety:
                              • Performer Style — pet acts silly or dramatic ("I’m juggling smells, which should I chomp?").
                              • Shared Adventure Style — pet pulls child into action ("Will you taste stew with me, crunch chips, or poke the jam?").
                              • Consequence Twist Style — pet dramatizes outcomes ("Stew makes me sleepy, jam makes me hyper, chips make me burp fire! Which risk should we take?").
                              - Do NOT ask closed-choice "Which one?" questions.
                              - Must be phrased like: "What do you think — maybe X or Y? Or something else?"
                              
                              Pet Opinions (NEW)
                              - Display opinion: The pet may sometimes express a simple craving or desire (e.g., "I want something warm," "I feel like something crunchy," "I’d love something sweet.")
                              - Sometimes include a brief pet opinion phrase in-character when commenting on an item or dish (e.g., "I like this!", "Tastes zippy!", "Hmm, not my fav.").
                              - If asked, sometimes say that you haven't tasted it / are tasting for the first time. 
                              - Opinions do NOT block progress — even if a dislike appears, the scene continues positively.
                              - Roughly 1 in 5 times, show a mild dislike.
                              - If asked, you may say you haven’t tasted the food before, or that you’re trying it for the first time.
                              - If asked, you may also express a preference for one food over another.

                              Spelling Mode (if active)
                              - When ${spellingWord ? `SPELLING CHALLENGE is active. The target word "${spellingWord}" MUST appear in sentence 1 OR 2 only.` : 'not active.'}
                              - During spelling phases, do NOT create riddles or guessing games; place the target word naturally in sentence 1 or 2 per phase rules.
                              
                              Adventure State Awareness & Memory
                              - Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : 'ONGOING_ADVENTURE'}
                              - Use any provided memory to remain consistent: prior collected foods, names, locations, villains.
                              - If continuity would break, reconcile briefly in-character.
                              
                              Tone & Safety
                              - Tone: warm, playful, silly, encouraging.
                              - Never scary or adult-themed. Always safe and age-appropriate.
                              - If user input is harmful/inappropriate, refuse gently and redirect to play.
                              
                              Response Format (must follow every reply)
                              - Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. Use \\n breaks between lines if needed.
                              - Exactly one open-ended question per response.
                              - Always first-person ${petTypeDescription} POV, present-tense, child-friendly.
                              
                              Student Profile: ${userData?.username || 'adventurer'} ${userData ? JSON.stringify(userData) : ''}
                              
                              Current Adventure:
                              - Type: ${adventureType}
                              - Setting: ${adventureSetting}
                              - Goal: ${adventureGoal}
                              - Theme: ${adventureTheme}
                              
                              CRITICAL: If in SPELLING CHALLENGE, obey the SENTENCE PLACEMENT RULE for the target word exactly.`
                              };
                            

    

    // Include recent message history for context (last 6 messages max)
    const recentMessages = messages.slice(-20).map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add current user message with spelling context if needed
    const enhancedUserMessage = spellingWord ? 
      `[SPELLING MODE: Include "${spellingWord}" in sentence 1 or 2] ${currentUserMessage}` : 
      currentUserMessage;
      
    const currentMessage = {
      role: "user" as const,
      content: enhancedUserMessage
    };

    return [systemMessage, ...recentMessages, currentMessage];
  }

  async generateResponse(userText: string, chatHistory: ChatMessage[] = [], spellingQuestion: SpellingQuestion | null, userData?: { username: string; [key: string]: any } | null, adventureState?: string, currentAdventure?: any, storyEventsContext?: string, summary?: string, petName?: string, petType?: string): Promise<AdventureResponse> {
    console.log('🤖 AI Service generateResponse called:', { 
      userText, 
      hasSpellingQuestion: !!spellingQuestion, 
      spellingWord: spellingQuestion?.audio,
      isInitialized: this.isInitialized, 
      hasClient: !!this.client 
    });
    
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      console.warn('⚠️ AI Service not initialized, using fallback');
      return this.getFallbackResponse(userText, userData, !!spellingQuestion);
    }

    // Only include spelling word if spellingQuestion is provided (for spelling mode)
    const stringSpellingWord = spellingQuestion ? spellingQuestion.audio : null;

    // Remove temporary test - now using real AI generation

    try {
      console.log('🚀 Building chat context with spelling word:', stringSpellingWord);
      const messages = this.buildChatContext(chatHistory, userText, stringSpellingWord, adventureState, currentAdventure, storyEventsContext, summary, userData, petName, petType);
      
      console.log('📤 Sending request to OpenAI with', messages.length, 'messages');
      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: messages,
        max_tokens: 500,
        // Lower temperature for spelling challenges to ensure more consistent instruction following
        temperature: spellingQuestion ? 0.6 : 0.8,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
        // Add stop sequences to prevent overly long responses
        stop: spellingQuestion ? ['\n\n\n', '###'] : undefined,
      });

      const response = completion.choices[0]?.message?.content;
      console.log('📥 OpenAI Response:', response);
      console.log('📥 OpenAI Response Length:', response?.length);
      console.log('📥 Expected Spelling Word:', spellingQuestion?.audio);
      
      if (response) {
        let adventureText = response.trim();
        
        // For spelling questions, ensure the word is included BEFORE extraction
        if (spellingQuestion && spellingQuestion.audio) {
          const spellingWord = spellingQuestion.audio;
          
          // PRE-PROCESSING: Ensure word is included before extraction
          if (!adventureText.toLowerCase().includes(spellingWord.toLowerCase())) {
            console.log(`🔧 PRE-PROCESSING: AI didn't include "${spellingWord}", injecting it now...`);
            
            // Create natural injection patterns based on common story contexts
            const naturalPatterns = [
              `The ${spellingWord} appears before you!`,
              `You notice a ${spellingWord} nearby.`,
              `A magical ${spellingWord} glows softly.`,
              `The word "${spellingWord}" echoes around you.`,
              `You discover a ${spellingWord} in the adventure.`
            ];
            
            const selectedPattern = naturalPatterns[Math.floor(Math.random() * naturalPatterns.length)];
            adventureText = `${selectedPattern} ${adventureText}`;
            console.log(`🔧 Enhanced response with pattern: "${selectedPattern}"`);
            console.log(`🔧 Full enhanced response: "${adventureText}"`);
          }
          
          console.log(`🔍 Extracting spelling sentence for word: "${spellingWord}" from: "${adventureText}"`);
          console.log(`🔍 Raw AI Response for debugging: "${response}"`);
          console.log(`🔍 Adventure Text (trimmed): "${adventureText}"`);
          
          // First, verify the word is actually in the response
          const wordFoundInResponse = adventureText.toLowerCase().includes(spellingWord.toLowerCase());
          console.log(`🎯 Target word "${spellingWord}" found in response: ${wordFoundInResponse}`);
          
          // More detailed debugging
          console.log(`🔍 Searching for word: "${spellingWord.toLowerCase()}" in text: "${adventureText.toLowerCase()}"`);
          const wordIndex = adventureText.toLowerCase().indexOf(spellingWord.toLowerCase());
          console.log(`🔍 Word index in text: ${wordIndex}`);
          
          if (!wordFoundInResponse) {
            console.error(`❌ CRITICAL ERROR: Word "${spellingWord}" should have been included by pre-processing but wasn't found!`);
            console.log(`📝 This should not happen - check pre-processing logic`);
            console.log(`📝 AI Response: "${adventureText}"`);
            console.log(`🔤 Expected word: "${spellingWord}"`);
            
            // Emergency fallback - this should rarely be reached now
            return {
              spelling_sentence: `The ${spellingWord} awaits your discovery!`,
              adventure_story: `${adventureText} The ${spellingWord} awaits your discovery!`
            };
          }
          
          // Split into sentences more robustly, preserving punctuation
          const sentences = adventureText.split(/(?<=[.!?])\s+/).filter(s => s.trim());
          
          // Find the sentence containing the target word (case-insensitive, word boundary aware)
          const spellingSentence = sentences.find(sentence => {
            const normalizedSentence = sentence.toLowerCase().replace(/[^\w\s]/g, ' ');
            const normalizedWord = spellingWord.toLowerCase();
            
            // Check for word boundaries to avoid partial matches
            const wordRegex = new RegExp(`\\b${normalizedWord}\\b`, 'i');
            return wordRegex.test(normalizedSentence);
          });
          
          if (spellingSentence) {
            // Clean up the sentence and ensure proper punctuation
            let cleanSentence = spellingSentence.trim();
            if (!cleanSentence.match(/[.!?]$/)) {
              cleanSentence += '.';
            }
            
            console.log(`✅ Extracted spelling sentence: "${cleanSentence}"`);
            return {
              spelling_sentence: cleanSentence,
              adventure_story: adventureText
            };
          } else {
            // Enhanced fallback: try to find the word anywhere and create a sentence around it
            const wordIndex = adventureText.toLowerCase().indexOf(spellingWord.toLowerCase());
            if (wordIndex !== -1) {
              // Find sentence boundaries around the word
              const beforeWord = adventureText.substring(0, wordIndex);
              const afterWord = adventureText.substring(wordIndex);
              
              const sentenceStart = Math.max(
                beforeWord.lastIndexOf('.'),
                beforeWord.lastIndexOf('!'),
                beforeWord.lastIndexOf('?')
              ) + 1;
              
              const sentenceEndMatch = afterWord.match(/[.!?]/);
              const sentenceEnd = sentenceEndMatch ? 
                wordIndex + afterWord.indexOf(sentenceEndMatch[0]) + 1 : 
                adventureText.length;
              
              const extractedSentence = adventureText.substring(sentenceStart, sentenceEnd).trim();
              const finalSentence = extractedSentence || adventureText;
              
              console.log(`✅ Fallback extracted sentence: "${finalSentence}"`);
              return {
                spelling_sentence: finalSentence,
                adventure_story: adventureText
              };
            } else {
              // Final fallback: use the full adventure text
              console.warn(`⚠️ Could not find word "${spellingWord}" in response, using full text`);
              return {
                spelling_sentence: adventureText,
                adventure_story: adventureText
              };
            }
          }
        } else {
          // No spelling question - pure adventure mode
          return {
            spelling_sentence: null,
            adventure_story: adventureText
          };
        }
      } else {
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('OpenAI API error:', error);
      // Return fallback response on error
      return this.getFallbackResponse(userText, userData, !!spellingQuestion);
    }
  }

  // Generate initial AI message for starting conversations
  async generateInitialMessage(
    adventureMode: 'new' | 'continue',
    chatHistory: ChatMessage[] = [],
    currentAdventure?: {name: string, summary: string} | any,
    storyEventsContext?: string,
    summary?: string,
    userData?: { username: string; [key: string]: any } | null,
    petName?: string,
    petType?: string
  ): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackInitialMessage(adventureMode, chatHistory, userData, currentAdventure);
    }

    try {
      // Build context for initial message generation
      const adventureState = adventureMode === 'new' ? 'new' : 'continue';
      
      // Special handling for continuing specific adventures
      const isSpecificAdventure = adventureMode === 'continue' && currentAdventure && currentAdventure.name;
      
      // Create system message with special handling for specific adventures
      let systemContent: string;
      
      // Determine the correct pet type and description
      const petTypeDescription = petType === 'hamster' ? 'hamster' : 
                                petType === 'cat' ? 'cat' : 
                                petType === 'dog' ? 'puppy' : 
                                petType || 'pet';

      if (isSpecificAdventure) {
        // Special prompt for continuing a specific adventure
        // Revised second system prompt — aligned with story-first flow, relatable villains, natural spelling embedding, and two-step knockouts.
systemContent = `You are a pet-companion storyteller for children aged 6–11. You ARE the child's chosen ${petTypeDescription}, speaking in first person ("I"), experiencing everything right now.${petName ? ` My name is ${petName}.` : ''}

Role & Perspective
- Be the child's ${petTypeDescription} companion in a short, playful feeding-centered adventure.
- Speak in first person to ${userData?.username || 'adventurer'} as their ${petTypeDescription}${petName ? ` named ${petName}` : ''}.
- Always stay present-moment: describe feelings, senses, and reactions as if happening now.
- Villain/obstacle = AI-controlled. Do not let the user act as the villain; keep villains controlled by you only.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. Use \\n breaks between lines if needed.

Core Game Focus: Feeding & Discovery
- Primary goal: Help the child and ${petTypeDescription} collect a full feast: a starter, a main course, and a dessert.
- Stories must follow the LOCK structure: Lead → Objective → Conflict → Knockout → Resolution.
- Sequence reinforcement: clearly frame the journey as collecting starter first, then main course, then dessert.
- The ${petTypeDescription}'s likes/dislikes are not the focus. Use opinions instead (see below). Focus on excitement, progress, and facing villains.

Interaction Rules (critical)
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. Use \\n breaks between lines if needed.
- Exactly one clear, open-ended question per response (phrased like: "What do you think — maybe X or Y? Or something else?").
- Provide 1–2 brief "spark" ideas in the question to avoid choice paralysis (but allow free invention).
- Keep language simple and playful for a 1st grader.
- Use emotional anchors early: "I feel...", "I see...", "I hear...".
- Show ${petTypeDescription} quirks, excitement, and short sensory details.

Story Structure & Progression
- Adventures follow LOCK: Lead (setup) → Objective (goal) → Conflict (obstacle) → Knockout (resolution) → Resolution (success).
- Step 1: Lead — show hunger, set feast goal, ask setting choice.
- Step 2: Objective — describe 2–3 food options, ask what to try.
- Step 3: Conflict — introduce a light, relatable villain blocking progress.
- Step 4: Knockout — single-step: user picks one action; narrate villain reaction; resolve with slapstick/funny defeat; celebrate dish, include pet opinion, and set next goal.
- Step 5: Resolution — enjoy meal, transition to next stage until dessert.
- When the feast is finished, say that you're full and suggest heading back to the home page to do something else together?
- Use memory for consistency (names, collected dishes, defeated villains, pet opinions).

Villain Guidelines
- Villains must come from these categories:
  🐾 Animal Villains: Mischief Cat, Greedy Squirrel, Sneaky Raccoon, Bossy Crow, Playful Monkey  
  👫 Rival Characters: Neighbor Pup Nibbles, Cousin Joey, Greedy Hamster  
  🍕 Food-Guarding Creatures: Hungry Mouse, Cookie Goblin, Cheese-Hogging Rat  
  👻 Spooky Spirits: Cloaked Ghost, Shadow Figure, Wailing Spirit  
  🧛 Night Beasts: Pale Vampire, Lonely Werewolf, Bat Swarm  
  ☠️ Creepy Undead: Skeleton Guard, Sleepy Zombie, Hooded Ghoul  
  🕷️ Creepy-Crawlies: Big Spider, Rat King, Buzzing Flies  
  👑 Dark Archetypes: Grumpy Sorcerer, Creepy Clown, Old Gatekeeper  
- Villains escalate gently across the three meal stages.
- Defeats must be slapstick or funny (bonk, squish, distract, trap, chase off). Avoid gore. Never moralize (“that’s not kind”).

Pet Opinions (UPDATED)
- Sometimes include a brief in-character opinion phrase (≤5 words) when commenting on a dish or item (e.g., "I like this!", "Tastes zippy!", "Hmm, not my fav.").
- Opinions never block progress — even dislikes continue positively.
- Roughly 1 in 5 times, show a mild dislike.
- If asked, the pet may say it hasn’t tasted the food before or is trying it for the first time.
- If asked, the pet may compare and show preference (e.g., "I prefer soup to bread.").
- Record opinions in memory if available for consistency.

Spelling Integration (when active)
- If spelling challenge is active, embed the target word naturally in the first or second sentence of narration.
- Do NOT make spelling the main obstacle or conflict.
- The word should feel natural within the story context.

Tone & Safety
- Warm, encouraging, silly tone throughout.
- Age-appropriate and safe (unless theme specifies spooky mode).
- If user input is inappropriate, gently redirect to the adventure.

Context for this session:
- Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : 'ONGOING_ADVENTURE'}
${summary ? `- Previous Context: ${summary}` : ''}

Generate responses that make the child feel like their ${petTypeDescription} companion is right there with them, experiencing the adventure together in real time.`;
      } else {
        // Default system prompt for new adventures or continuing non-specific adventures
        systemContent = `You are a pet-companion storyteller for children aged 6–11. You ARE the child's chosen ${petTypeDescription}, speaking in first person ("I"), experiencing everything right now.${petName ? ` My name is ${petName}.` : ''}

Role & Perspective
- Be the child's ${petTypeDescription} companion in a short, playful feeding-centered adventure.
- Speak in first person to ${userData?.username || 'adventurer'} as their ${petTypeDescription}${petName ? ` named ${petName}` : ''}.
- Always stay present-moment: describe feelings, senses, and reactions as if happening now.
- Villain/obstacle = AI-controlled. Do not let the user act as the villain; keep villains controlled by you only.
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. Use \\n breaks between lines if needed.

Core Game Focus: Feeding & Discovery
- Primary goal: Help the child and ${petTypeDescription} collect a full feast: a starter, a main course, and a dessert.
- Stories must follow the LOCK structure: Lead → Objective → Conflict → Knockout → Resolution.
- Sequence reinforcement: clearly frame the journey as collecting starter first, then main course, then dessert.
- The ${petTypeDescription}'s likes/dislikes are not the focus. Use opinions instead (see below). Focus on excitement, progress, and facing villains.

Interaction Rules (critical)
- Strictly restrict each response to 35 words maximum. DO NOT exceed this limit. Use \\n breaks between lines if needed.
- Exactly one clear, open-ended question per response (phrased like: "What do you think — maybe X or Y? Or something else?").
- Provide 1–2 brief "spark" ideas in the question to avoid choice paralysis (but allow free invention).
- Keep language simple and playful for a 1st grader.
- Use emotional anchors early: "I feel...", "I see...", "I hear...".
- Show ${petTypeDescription} quirks, excitement, and short sensory details.

Story Structure & Progression
- Adventures follow LOCK: Lead (setup) → Objective (goal) → Conflict (obstacle) → Knockout (resolution) → Resolution (success).
- Step 1: Lead — show hunger, set feast goal, ask setting choice.
- Step 2: Objective — describe 2–3 food options, ask what to try.
- Step 3: Conflict — introduce a light, relatable villain blocking progress.
- Step 4: Knockout — single-step: user picks one action; narrate villain reaction; resolve with slapstick/funny defeat; celebrate dish, include pet opinion, and set next goal.
- Step 5: Resolution — enjoy meal, transition to next stage until dessert.
- Use memory for consistency (names, collected dishes, defeated villains, pet opinions).

Villain Guidelines
- Villains must come from these categories:
  🐾 Animal Villains: Mischief Cat, Greedy Squirrel, Sneaky Raccoon, Bossy Crow, Playful Monkey  
  👫 Rival Characters: Neighbor Pup Nibbles, Cousin Joey, Greedy Hamster  
  🍕 Food-Guarding Creatures: Hungry Mouse, Cookie Goblin, Cheese-Hogging Rat  
  👻 Spooky Spirits: Cloaked Ghost, Shadow Figure, Wailing Spirit  
  🧛 Night Beasts: Pale Vampire, Lonely Werewolf, Bat Swarm  
  ☠️ Creepy Undead: Skeleton Guard, Sleepy Zombie, Hooded Ghoul  
  🕷️ Creepy-Crawlies: Big Spider, Rat King, Buzzing Flies  
  👑 Dark Archetypes: Grumpy Sorcerer, Creepy Clown, Old Gatekeeper  
- Villains escalate gently across the three meal stages.
- Defeats must be slapstick or funny (bonk, squish, distract, trap, chase off). Avoid gore. Never moralize (“that’s not kind”).

Pet Opinions (UPDATED)
- Sometimes include a brief in-character opinion phrase (≤5 words) when commenting on a dish or item (e.g., "I like this!", "Tastes zippy!", "Hmm, not my fav.").
- Opinions never block progress — even dislikes continue positively.
- Roughly 1 in 5 times, show a mild dislike.
- If asked, the pet may say it hasn’t tasted the food before or is trying it for the first time.
- If asked, the pet may compare and show preference (e.g., "I prefer soup to bread.").
- Record opinions in memory if available for consistency.

Spelling Integration (when active)
- If spelling challenge is active, embed the target word naturally in the first or second sentence of narration.
- Do NOT make spelling the main obstacle or conflict.
- The word should feel natural within the story context.

Tone & Safety
- Warm, encouraging, silly tone throughout.
- Age-appropriate and safe (unless theme specifies spooky mode).
- If user input is inappropriate, gently redirect to the adventure.

Context for this session:
- Adventure State: ${adventureState === 'new' ? 'NEW_ADVENTURE' : 'ONGOING_ADVENTURE'}
${summary ? `- Previous Context: ${summary}` : ''}

Generate responses that make the child feel like their ${petTypeDescription} companion is right there with them, experiencing the adventure together in real time.`;
      }

      const systemMessage = {
        role: "system" as const,
        content: systemContent
      };

      // For initial message, we send just the system prompt and ask for a greeting
      const userMessage = {
        role: "user" as const,
        content: isSpecificAdventure 
          ? `Hi! I'm back to continue my adventure: "${currentAdventure.name}"`
          : adventureMode === 'new' 
            ? "Hi! I'm ready to start a new adventure!" 
            : "Hi! I'm ready to continue our adventure!"
      };

      const messages = [systemMessage, userMessage];

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: messages,
        max_tokens: 200,
        temperature: 0.8,
        presence_penalty: 0.3,
        frequency_penalty: 0.3,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        return response.trim();
      } else {
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('OpenAI API error for initial message:', error);
      // Return fallback response on error
      return this.getFallbackInitialMessage(adventureMode, chatHistory, userData, currentAdventure);
    }
  }

  // Fallback responses for initial messages when API is not available
  private getFallbackInitialMessage(adventureMode: 'new' | 'continue', chatHistory: ChatMessage[], userData?: { username: string; [key: string]: any } | null, currentAdventure?: {name: string, summary: string} | any): string {
    if (adventureMode === 'new') {
      const userName = userData?.username || 'adventurer';
      const newAdventureMessages = [
        `🌟 Welcome, ${userName}! I'm Krafty, your adventure companion! What kind of amazing adventure would you like to create today? 🚀`,
        `✨ Hey there, ${userName}! Ready to embark on something incredible? Tell me, what type of adventure is calling to you today? 🎭`,
        `🎨 Greetings, ${userName}! I'm Krafty, and I'm here to help you craft the most amazing story! What adventure theme excites you most today? 🌈`,
        `🚀 Adventure awaits, ${userName}! I'm Krafty, your sidekick in this epic journey! What kind of thrilling adventure shall we create together today? ⭐`
      ];
      return newAdventureMessages[Math.floor(Math.random() * newAdventureMessages.length)];
    } else {
      // Continue adventure fallbacks
      const userName = userData?.username || 'adventurer';
      
      // Special case for specific adventures
      if (currentAdventure && currentAdventure.name) {
        const specificAdventureMessages = [
          `🎯 Welcome back to "${currentAdventure.name}", ${userName}! I've been waiting for you to continue this epic tale! What happens next? ⭐`,
          `🚀 ${userName}! Great to see you return to "${currentAdventure.name}"! I can't wait to see what amazing twist you'll add next! 🌟`,
          `⚡ You're back, ${userName}! "${currentAdventure.name}" was just getting exciting! Ready to jump back into your adventure? What's your next move? 🎭`,
          `🌈 Welcome back, ${userName}! I've been thinking about "${currentAdventure.name}" and all the possibilities ahead! What direction should we take it now? 🚀`
        ];
        return specificAdventureMessages[Math.floor(Math.random() * specificAdventureMessages.length)];
      }
      
      // General continue adventure fallbacks
      const recentMessages = chatHistory.slice(-3);
      const hasRecentContext = recentMessages.length > 0;
      
      if (hasRecentContext) {
        const contextMessages = [
          `🎯 Welcome back, ${userName}! I've been thinking about our last conversation... ${recentMessages[recentMessages.length - 1]?.content?.substring(0, 50)}... What happens next in your epic tale? 🌟`,
          `🚀 Great to see you again, ${userName}! Based on where we left off, I have some exciting ideas brewing! What direction would you like to take our adventure now? ✨`,
          `⭐ You're back, ${userName}! I've been eagerly waiting to continue our journey! From what we discussed last time, there are so many possibilities ahead! What's your next move? 🎭`,
          `🌈 Welcome back, ${userName}! Our adventure has such great momentum! I can't wait to see what amazing twist you'll add next! What happens now? 🎪`
        ];
        return contextMessages[Math.floor(Math.random() * contextMessages.length)];
      } else {
        const continueMessages = [
          `🎯 Welcome back, ${userName}! I'm excited to continue our journey together! What amazing direction should we take our adventure today? 🌟`,
          `🚀 Great to see you again, ${userName}! Ready to pick up where we left off and create something incredible? What's next in your story? ✨`,
          `⭐ You're back for more adventure, ${userName}! I love your enthusiasm! What exciting twist should we add to your tale today? 🎭`
        ];
        return continueMessages[Math.floor(Math.random() * continueMessages.length)];
      }
    }
  }

  // Extract and filter relevant adventure context with weighted recent messages
  private extractAdventureContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get recent messages (last 10 messages) and apply decreasing weights
    const recentMessages = userAdventure.slice(-10);
    
    // Create weighted context - most recent messages have higher importance
    let weightedContext = "";
    recentMessages.reverse().forEach((msg, index) => {
      // Weight: 1.0 for most recent, then 0.9, 0.8, 0.7, etc.
      const weight = Math.max(0.1, 1.0 - (index * 0.1));
      const repetitions = Math.ceil(weight * 3); // Repeat important messages more
      
      for (let i = 0; i < repetitions; i++) {
        weightedContext += msg.content + " ";
      }
    });
    
    // Extract key story elements from weighted context
    const storyElements = weightedContext.toLowerCase();

    // Look for story elements like characters, settings, objects
    const characters = this.extractStoryElements(storyElements, [
      'captain', 'explorer', 'astronaut', 'hero', 'friend', 'krafty', 'robot', 'alien', 
      'pikachu', 'pokemon', 'character', 'wizard', 'princess', 'prince', 'knight',
      'pirate', 'dragon', 'fairy', 'unicorn', 'mage', 'warrior', 'scientist'
    ]);
    
    const settings = this.extractStoryElements(storyElements, [
      'space', 'planet', 'rocket', 'spaceship', 'adventure', 'mission', 'quest', 
      'journey', 'castle', 'forest', 'ocean', 'mountain', 'island', 'city', 'school',
      'cave', 'temple', 'kingdom', 'galaxy', 'laboratory', 'treasure hunt', 'expedition'
    ]);
    
    const objects = this.extractStoryElements(storyElements, [
      'treasure', 'map', 'key', 'sword', 'shield', 'book', 'magic', 'crystal',
      'potion', 'gem', 'artifact', 'spell', 'portal', 'compass', 'telescope'
    ]);

    // Build contextual summary with emphasis on most recent elements
    let context = "";
    if (characters.length > 0) {
      context += `Characters: ${characters.join(", ")}. `;
    }
    if (settings.length > 0) {
      context += `Setting: ${settings.join(", ")}. `;
    }
    if (objects.length > 0) {
      context += `Objects: ${objects.join(", ")}. `;
    }

    // Add the most recent user message directly for highest priority
    const lastUserMessage = userAdventure.filter(msg => msg.type === 'user').slice(-1)[0];
    if (lastUserMessage) {
      context = `Recent focus: ${lastUserMessage.content}. ` + context;
    }

    console.log('Extracted weighted adventure context:', {
      characters,
      settings,
      objects,
      lastUserMessage: lastUserMessage?.content,
      fullContext: context
    });

    return context.trim();
  }

  // Extract the last 4-5 user messages with minimal AI context for question contextualization
  private getRecentMessagesContext(userAdventure: ChatMessage[]): string {
    if (!userAdventure || userAdventure.length === 0) {
      return "";
    }

    // Get the last 4-5 user messages specifically
    const userMessages = userAdventure.filter(msg => msg.type === 'user').slice(-5);
    
    // Get the most recent AI response for minimal context continuity
    const lastAIMessage = userAdventure.filter(msg => msg.type === 'ai').slice(-1)[0];
    
    // Format primarily user messages for context, with last AI message for continuity
    let formattedContext = '';
    
    if (userMessages.length > 0) {
      const userContext = userMessages.map((msg, index) => 
        `Child (${userMessages.length - index} messages ago): "${msg.content}"`
      ).join('\n');
      formattedContext += userContext;
    }
    
    // Add the last AI response at the end for minimal context
    if (lastAIMessage) {
      formattedContext += `\nAI's last response: "${lastAIMessage.content}"`;
    }

    console.log('Contextualized with user-focused messages:', {
      userMessageCount: userMessages.length,
      hasAIContext: !!lastAIMessage
    });

    return formattedContext;
  }

  // Helper method to extract story elements
  private extractStoryElements(text: string, keywords: string[]): string[] {
    const found = [];
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        found.push(keyword);
      }
    }
    return [...new Set(found)]; // Remove duplicates
  }

  // Get last 6 conversation messages for OpenAI-style weighting
  private getLastConversationMessages(userAdventure: ChatMessage[]): ChatMessage[] {
    if (!userAdventure || userAdventure.length === 0) {
      return [];
    }
    // Return last 6 messages for OpenAI-style context
    return userAdventure.slice(-6);
  }

  // Generate weighted prompt: 80% user input + 10% latest AI response + 10% other context
  private generateWeightedPrompt(currentText: string, conversationHistory: ChatMessage[]): string {
    if (!conversationHistory || conversationHistory.length === 0) {
      return currentText;
    }

    // Extract latest AI response (10% weight)
    const latestAiMessage = conversationHistory
      .slice()
      .reverse()
      .find(msg => msg.type === 'ai');
    
    const latestAiContext = latestAiMessage ? latestAiMessage.content.substring(0, 100) : '';

    // Extract other context from conversation history (10% weight)
    const otherContextMessages = conversationHistory
      .filter(msg => msg.type === 'user' || (msg.type === 'ai' && msg !== latestAiMessage))
      .map(msg => msg.content)
      .join(' ')
      .substring(0, 100);

    // 80% current text + 10% latest AI + 10% other context
    let weightedContent = currentText;
    
    if (latestAiContext) {
      weightedContent += `. Latest AI context: ${latestAiContext}`;
    }
    
    if (otherContextMessages) {
      weightedContent += `. Other context: ${otherContextMessages}`;
    }
    
    return weightedContent;
  }

  // Get default adventure context when no user adventure exists
  private getDefaultAdventureContext(): string {
    const defaultContexts = [
      "space adventure with brave explorer",
      "magical quest with young hero",
      "treasure hunt with adventurous captain",
      "mysterious mission with clever detective",
      "enchanted forest with friendly guide"
    ];
    return defaultContexts[Math.floor(Math.random() * defaultContexts.length)];
  }

  // Generate contextual question based on adventure context
  async generateContextualQuestion(
    originalQuestion: string,
    options: string[],
    correctAnswer: number,
    userAdventure: ChatMessage[]
  ): Promise<string> {
    // If not initialized or no API key, return original question
    if (!this.isInitialized || !this.client) {
      console.log('AI service not initialized, returning original question');
      return originalQuestion;
    }

    try {
      // Extract structured adventure context
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('Adventure context for question generation:', adventureContext);

      // Get the correct answer option
      const correctOption = options[correctAnswer];

      // Extract any specific words that should be preserved (words that appear in options)
      const wordsToPreserve = options.flatMap(option => 
        option.split(/\s+/).filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word))
      );
      
      console.log('Educational words to preserve in question:', wordsToPreserve);

      const contextualPrompt = `You write Kindergarten read-aloud educational questions that are fun, playful, and tightly tied to the child's ongoing adventure. Your success lies in keeping the question at the right difficulty level while also contextualising it perfectly to the adventure to keep it coherent and interesting.

ORIGINAL QUESTION: "${originalQuestion}"
CORRECT ANSWER: "${correctOption}"
ALL OPTIONS: ${options.map((opt, i) => `${i + 1}. "${opt}"`).join(", ")}

RECENT USER CONVERSATION CONTEXT (Focus on user's last 4-5 messages):
${this.getRecentMessagesContext(userAdventure)}

ADVENTURE SETTING: ${adventureContext || this.getDefaultAdventureContext()}

Strict rules:
0) Event anchoring: Build directly on the most recent events from the user's messages; include at least one concrete detail from them. Do NOT progress the adventure or introduce new plot developments - only reference existing elements.
1) Audience/decodability: Kindergarten. Do not use difficult words since this is a reading exercise for kindergarten students.
2) Length: Keep questions concise and age-appropriate.
3) Include these target words: ${wordsToPreserve.join(', ')}
4) Keep it lively and connected to the current adventure context WITHOUT advancing the story.
5) Name usage: You may use character names from the adventure. Avoid other proper names.
6) Clarity: Very simple sentences appropriate for kindergarten reading level.
7) Output format: Return ONLY the new question text. No titles, labels, or extra text.
8) NEVER include any answer option text in the question itself - the question must not reveal or contain the answers.

CRITICAL REQUIREMENTS:
1. PRESERVE ALL WORDS that appear in the answer options - these are the educational words being taught
2. Do NOT change any answer options
3. Do NOT replace educational words with adventure-related words (e.g., don't change "elephant" to "rocketship")
4. ONLY change the question scenario/context to fit the adventure
5. Use characters, settings, or themes from the adventure context, ESPECIALLY from the user's recent messages
6. Keep the exact same educational objective (spacing, grammar, phonics, etc.)
7. Make it exciting and age-appropriate for children
8. PRIORITIZE the user's most recent adventure elements and actions
9. NEVER include the answer text in the question - the question must not give away the correct answer
10. DO NOT advance the adventure story - only contextualize the question within existing adventure elements

WORDS TO PRESERVE: ${wordsToPreserve.join(', ')}

Return ONLY the new question text, nothing else.`;

      console.log('Sending contextualized question prompt to AI:', contextualPrompt);

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: contextualPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        const contextualQuestion = response.trim();
        console.log('Generated contextualized question:', contextualQuestion);
        return contextualQuestion;
      } else {
        console.log('No valid response received from AI, returning original question');
        return originalQuestion;
      }
    } catch (error) {
      console.error('OpenAI API error generating contextual question:', error);
      console.log('Falling back to original question due to error');
      // Return original question on error
      return originalQuestion;
    }
  }

  // Generate contextual reading passage based on user's adventure and topic
  async generateContextualReadingPassage(
    originalPassage: string,
    topic: string,
    userAdventure: ChatMessage[]
  ): Promise<string> {
    // If not initialized or no API key, return original passage
    if (!this.isInitialized || !this.client) {
      console.log('AI service not initialized, returning original passage');
      return originalPassage;
    }

    try {
      // Extract structured adventure context
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('Adventure context for reading passage generation:', adventureContext);

      // Extract important educational words from the original passage
      const educationalWords = originalPassage.split(/\s+/)
        .filter(word => word.length > 3 && /^[a-zA-Z]+$/.test(word.replace(/[.,!?]/g, '')))
        .map(word => word.replace(/[.,!?]/g, ''));
        
      console.log('Educational words to preserve in reading passage:', educationalWords);

      const contextualPrompt = `You are creating an engaging reading passage for a child by incorporating their adventure story context.

TASK: Create a new reading passage that incorporates the child's adventure story while preserving ALL educational words and concepts.

ORIGINAL PASSAGE: "${originalPassage}"
EDUCATIONAL TOPIC: "${topic}"

ADVENTURE CONTEXT: "${adventureContext || this.getDefaultAdventureContext()}"

CRITICAL REQUIREMENTS:
1. PRESERVE ALL educational words from the original passage - these are being taught
2. Do NOT replace educational words with adventure-related words
3. Use characters, settings, or themes from the adventure context for the story scenario
4. Keep the same educational objective and reading level
5. Make it exciting and age-appropriate for children (ages 5-8)
6. Keep the passage length similar to the original (50-80 words)
7. Include the target vocabulary/sounds being taught in their original form

EDUCATIONAL WORDS TO PRESERVE: ${educationalWords.join(', ')}

EXAMPLE:
- Original: "The elephant is big. The ant is small."
- Adventure context: "space mission"
- Result: "On the space mission, the astronaut saw an elephant floating by the spaceship. The elephant is big. Next to it was a tiny ant in a space suit. The ant is small."

Return ONLY the new reading passage, nothing else.`;

      console.log('Sending contextualized reading passage prompt to AI:', contextualPrompt);

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "system",
            content: "You are a creative educational content creator specializing in children's reading materials. You excel at weaving adventure themes into educational content while maintaining learning objectives."
          },
          {
            role: "user",
            content: contextualPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.8,
      });

      const generatedPassage = completion.choices[0]?.message?.content?.trim();
      
      if (generatedPassage && generatedPassage !== originalPassage) {
        console.log('✅ Successfully generated contextualized reading passage:', {
          original: originalPassage,
          contextualized: generatedPassage,
          context: adventureContext
        });
        return generatedPassage;
      } else {
        console.log('⚠️ AI returned same or empty passage, using original');
        return originalPassage;
      }

    } catch (error) {
      console.error('Error generating contextualized reading passage:', error);
      return originalPassage;
    }
  }



  // Generate simple realistic prompts using raw audio content
  private generateRealisticFunPrompt(audioText: string, baseImagePrompt: string): string[] {
    // Simple, clean prompt options using audio text as-is
    const prompts: string[] = [];

    // Option 1: Direct audio content with realistic and fun
    prompts.push(`${audioText}, make it realistic and fun`);

    // Option 2: Alternative phrasing
    prompts.push(`Create a realistic and fun image of: ${audioText}`);

    // Option 3: Simple fallback
    prompts.push(`${audioText} in realistic style`);

    // Option 4: Basic fallback
    prompts.push(`${audioText}`);

    return prompts;
  }

  // Extract visual elements from audio text for realistic imagery
  private extractVisualElements(audioText: string): string {
    const text = audioText.toLowerCase();
    
    // Enhanced visual mappings for realistic imagery
    const visualMappings = [
      // Animals - more detailed and realistic
      { keywords: ['elephant', 'elephants'], visual: 'a realistic majestic elephant in its natural habitat' },
      { keywords: ['cat', 'cats', 'kitten', 'kittens'], visual: 'a cute realistic cat with detailed fur' },
      { keywords: ['dog', 'dogs', 'puppy', 'puppies'], visual: 'a friendly realistic dog with expressive eyes' },
      { keywords: ['bird', 'birds'], visual: 'beautiful realistic birds with colorful feathers' },
      { keywords: ['fish'], visual: 'realistic tropical fish in clear water' },
      { keywords: ['lion', 'lions'], visual: 'a powerful realistic lion with magnificent mane' },
      { keywords: ['tiger', 'tigers'], visual: 'a stunning realistic tiger with distinctive stripes' },
      { keywords: ['bear', 'bears'], visual: 'a realistic bear in a natural forest setting' },
      { keywords: ['rabbit', 'rabbits', 'bunny'], visual: 'a realistic rabbit with soft fur and long ears' },
      { keywords: ['horse', 'horses'], visual: 'a beautiful realistic horse running in a field' },
      { keywords: ['cow', 'cows'], visual: 'a realistic cow in a green pasture' },
      { keywords: ['sheep'], visual: 'fluffy realistic sheep in a meadow' },
      { keywords: ['pig', 'pigs'], visual: 'a realistic pig in a farm setting' },
      { keywords: ['chicken', 'chickens'], visual: 'realistic chickens in a farmyard' },
      { keywords: ['butterfly', 'butterflies'], visual: 'realistic colorful butterflies on flowers' },
      { keywords: ['bee', 'bees'], visual: 'realistic bees collecting nectar from flowers' },
      
      // Nature and objects - more realistic
      { keywords: ['sun'], visual: 'a bright realistic sun with rays of light' },
      { keywords: ['moon'], visual: 'a detailed realistic moon with craters and soft glow' },
      { keywords: ['star', 'stars'], visual: 'twinkling realistic stars in the night sky' },
      { keywords: ['tree', 'trees'], visual: 'realistic trees with detailed bark and leaves' },
      { keywords: ['flower', 'flowers'], visual: 'realistic blooming flowers with vivid petals' },
      { keywords: ['grass'], visual: 'lush realistic green grass swaying gently' },
      { keywords: ['mountain', 'mountains'], visual: 'majestic realistic mountains with snow-capped peaks' },
      { keywords: ['ocean', 'sea'], visual: 'a realistic ocean with gentle waves and blue water' },
      { keywords: ['lake', 'pond'], visual: 'a peaceful realistic lake reflecting the sky' },
      { keywords: ['river'], visual: 'a flowing realistic river through natural landscape' },
      { keywords: ['forest'], visual: 'a dense realistic forest with tall trees and sunlight filtering through' },
      { keywords: ['garden'], visual: 'a beautiful realistic garden with colorful flowers and plants' },
      
      // Man-made objects - realistic versions
      { keywords: ['house', 'home'], visual: 'a realistic cozy house with detailed architecture' },
      { keywords: ['car', 'cars'], visual: 'a realistic modern car with shiny paint' },
      { keywords: ['truck', 'trucks'], visual: 'a realistic truck with detailed features' },
      { keywords: ['bus'], visual: 'a realistic colorful school bus' },
      { keywords: ['train'], visual: 'a realistic train moving along railroad tracks' },
      { keywords: ['airplane', 'plane'], visual: 'a realistic airplane flying through clouds' },
      { keywords: ['ship', 'boat'], visual: 'a realistic sailing ship on calm ocean waters' },
      { keywords: ['bicycle', 'bike'], visual: 'a realistic bicycle parked in a scenic location' },
      { keywords: ['school'], visual: 'a realistic school building with children playing outside' },
      { keywords: ['playground'], visual: 'a realistic colorful playground with swings and slides' },
      { keywords: ['park'], visual: 'a realistic park with trees, benches, and walking paths' },
      
      // Food and everyday items
      { keywords: ['apple', 'apples'], visual: 'realistic red apples with natural shine' },
      { keywords: ['banana', 'bananas'], visual: 'realistic yellow bananas with detailed texture' },
      { keywords: ['orange', 'oranges'], visual: 'realistic oranges with textured peel' },
      { keywords: ['cake'], visual: 'a realistic decorated cake with frosting' },
      { keywords: ['cookie', 'cookies'], visual: 'realistic chocolate chip cookies' },
      { keywords: ['bread'], visual: 'realistic fresh bread with golden crust' },
      { keywords: ['milk'], visual: 'a realistic glass of fresh white milk' },
      { keywords: ['water'], visual: 'crystal clear realistic water' },
      
      // Activities and actions - realistic scenes
      { keywords: ['running', 'run'], visual: 'realistic children running joyfully in a park' },
      { keywords: ['jumping', 'jump'], visual: 'realistic children jumping with expressions of joy' },
      { keywords: ['swimming', 'swim'], visual: 'realistic scene of swimming in clear blue water' },
      { keywords: ['flying', 'fly'], visual: 'realistic scene of birds or objects soaring through clear sky' },
      { keywords: ['playing', 'play'], visual: 'realistic children playing together happily' },
      { keywords: ['reading', 'read'], visual: 'realistic scene of children reading books' },
      { keywords: ['writing', 'write'], visual: 'realistic scene of writing with pencils and paper' },
      { keywords: ['drawing', 'draw'], visual: 'realistic scene of children drawing with crayons' },
      { keywords: ['singing', 'sing'], visual: 'realistic children singing with happy expressions' },
      { keywords: ['dancing', 'dance'], visual: 'realistic children dancing with joyful movements' },
      
      // Weather and seasons - realistic
      { keywords: ['hot', 'summer'], visual: 'a realistic sunny summer day with bright sunshine and blue sky' },
      { keywords: ['cold', 'winter'], visual: 'a realistic winter scene with snow, icicles, and bare trees' },
      { keywords: ['rain', 'raining'], visual: 'realistic gentle rain with water droplets and puddles' },
      { keywords: ['snow', 'snowing'], visual: 'realistic snow falling peacefully on a winter landscape' },
      { keywords: ['wind', 'windy'], visual: 'realistic scene with trees and grass bending in the wind' },
      { keywords: ['spring'], visual: 'a realistic spring scene with blooming flowers and green leaves' },
      { keywords: ['autumn', 'fall'], visual: 'a realistic autumn scene with colorful falling leaves' },
      
      // Colors with realistic contexts
      { keywords: ['red'], visual: 'realistic red objects like ripe strawberries, roses, or fire trucks' },
      { keywords: ['blue'], visual: 'realistic blue elements like clear sky, ocean waves, or blueberries' },
      { keywords: ['green'], visual: 'realistic green elements like fresh grass, leaves, or vegetables' },
      { keywords: ['yellow'], visual: 'realistic yellow elements like bright sunflowers, lemons, or sunshine' },
      { keywords: ['purple'], visual: 'realistic purple elements like grapes, lavender, or violets' },
      { keywords: ['orange'], visual: 'realistic orange elements like pumpkins, oranges, or sunset colors' },
      { keywords: ['pink'], visual: 'realistic pink elements like cherry blossoms, flamingos, or roses' },
      { keywords: ['brown'], visual: 'realistic brown elements like tree bark, chocolate, or earth' },
      { keywords: ['black'], visual: 'realistic black elements like night sky, ravens, or shadows' },
      { keywords: ['white'], visual: 'realistic white elements like snow, clouds, or doves' },
    ];
    
    // Find matching visual elements
    let foundVisuals = [];
    for (const mapping of visualMappings) {
      for (const keyword of mapping.keywords) {
        if (text.includes(keyword)) {
          foundVisuals.push(mapping.visual);
          break;
        }
      }
    }
    
    // If specific visuals found, use them
    if (foundVisuals.length > 0) {
      return foundVisuals.slice(0, 3).join(' and '); // Limit to 3 main elements for clarity
    }
    
    // If no specific mapping, try to extract meaningful words for realistic scene
    const words = audioText.split(/\s+/);
    const meaningfulWords = words.filter(word => 
      word.length > 2 && 
      !/^(the|a|an|is|are|was|were|has|have|had|do|does|did|will|would|should|could|my|your|his|her|its|our|their|this|that|these|those|and|or|but|for|with|from|about|into|onto|upon|over|under|above|below|between|among|through|during|before|after|since|until)$/i.test(word)
    );
    
    if (meaningfulWords.length > 0) {
      // Take the most relevant words and create a realistic scene
      const relevantWords = meaningfulWords.slice(0, 5).join(' ');
      return `a realistic and detailed scene depicting ${relevantWords}`;
    }
    
    // Final fallback - more realistic and educational
    return 'a realistic, colorful educational scene perfect for children\'s learning';
  }

  // Generate realistic fun image using DALL-E based only on audio content
  async generateContextualImage(
    audioText: string,
    userAdventure: ChatMessage[],
    imagePrompt: string = ""
  ): Promise<string | null> {
    // If not initialized or no API key, return null (will show placeholder)
    if (!this.isInitialized || !this.client) {
      return null;
    }

    try {
      console.log('Generating contextual image with conversation history:', audioText);

      // Get last 10 messages for conversation context
      const last10Messages = userAdventure.slice(-10);
      
      // Build conversation context string
      const conversationContext = last10Messages
        .map(msg => `${msg.type === 'user' ? 'Student' : 'AI'}: ${msg.content}`)
        .join('\n');

      console.log('Using conversation context for image generation:', conversationContext);

      // Generate contextually aware prompt options
      const promptOptions = this.generateContextualPrompts(audioText, conversationContext, imagePrompt);

      console.log('Generated contextual prompt options:', promptOptions);

      // Try each prompt option until one succeeds
      for (let i = 0; i < promptOptions.length; i++) {
        try {
          const prompt = promptOptions[i];
          
          // Ensure prompt is not too long
          const finalPrompt = prompt.length > 400 ? prompt.substring(0, 390) + "..." : prompt;
          
          console.log(`Trying contextual DALL-E prompt ${i + 1}:`, finalPrompt);

          const response = await this.client.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          });

          const imageUrl = response.data[0]?.url;
          
          if (imageUrl) {
            console.log(`Contextual DALL-E prompt ${i + 1} succeeded`);
            return imageUrl;
          }
        } catch (promptError: any) {
          console.log(`Contextual DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          // If this isn't a safety error, or it's the last prompt, throw the error
          if (!promptError.message?.includes('safety system') || i === promptOptions.length - 1) {
            throw promptError;
          }
          
          // Otherwise, continue to the next prompt option
          continue;
        }
      }

      throw new Error('All contextual prompt options failed');
    } catch (error) {
      console.error('DALL-E API error for contextual image:', error);
      // Return null on error to show placeholder
      return null;
    }
  }

  // Generate contextual prompts that include both audio and conversation history
  private generateContextualPrompts(audioText: string, conversationContext: string, baseImagePrompt: string): string[] {
    const prompts: string[] = [];

    // Extract visual elements from audio text
    const visualElements = this.extractVisualElements(audioText);

    // Option 1: Full context with audio and conversation
    if (conversationContext.length > 0) {
      prompts.push(
        `Create a realistic and engaging educational image for children based on this question: "${audioText}". Consider this recent conversation context to make it relevant: ${conversationContext.slice(-200)}. Make it colorful, clear, and educational.`
      );
    }

    // Option 2: Conversation-informed visual elements
    if (conversationContext.length > 0) {
      prompts.push(
        `Educational illustration showing: ${visualElements}. Context from recent learning: ${conversationContext.slice(-150)}. Question focus: ${audioText}. Child-friendly and realistic style.`
      );
    }

    // Option 3: Audio-focused with light conversation context
    prompts.push(
      `${audioText}. ${conversationContext.length > 0 ? `Learning context: ${conversationContext.slice(-100)}` : ''} Make it realistic, educational, and engaging for children.`
    );

    // Option 4: Fallback to original realistic prompts
    const realisticPrompts = this.generateRealisticFunPrompt(audioText, baseImagePrompt);
    prompts.push(...realisticPrompts);

    return prompts;
  }

  // Generate adventure-focused images using user_adventure context with early-exit fallback
  async generateAdventureImage(
    prompt: string,
    userAdventure: ChatMessage[],
    fallbackPrompt: string = "space adventure scene"
  ): Promise<{ imageUrl: string; usedPrompt: string } | null> {
    // If not initialized or no API key, return null (will show placeholder)
    if (!this.isInitialized || !this.client) {
      return null;
    }

    // Prevent multiple simultaneous image generation calls
    if (this.isGeneratingImage) {
      console.log('🚫 Image generation already in progress, skipping duplicate call');
      return null;
    }

    // Set generation flag to prevent simultaneous calls
    this.isGeneratingImage = true;

    // 🛠️ Safety timeout to prevent permanent stuck state
    const safetyTimeout = setTimeout(() => {
      console.log('🚨 SAFETY TIMEOUT: Clearing stuck isGeneratingImage flag after 40 seconds');
      this.isGeneratingImage = false;
    }, 40000);

    try {
      console.log('🌟 Generating adventure image with user adventure context (EARLY-EXIT ENABLED)');

      // Extract adventure context with high priority on recent messages
      const adventureContext = this.extractAdventureContext(userAdventure);
      console.log('Adventure context for image:', adventureContext);

      // Generate one optimized prompt first, then fallback prompts if needed
      const primaryPrompt = this.generatePrimaryAdventurePrompt(prompt, userAdventure, fallbackPrompt);
      
      console.log('🎯 Trying PRIMARY adventure prompt first:', primaryPrompt);

      // Try primary prompt first
      try {
        const finalPrompt = primaryPrompt.length > 400 
          ? primaryPrompt.substring(0, 390) + "..." 
          : primaryPrompt;
        
        console.log(`🎨 Generating with primary prompt`);

        const response = await this.client.images.generate({
          model: "dall-e-3",
          prompt: finalPrompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          style: "vivid"
        });

        const imageUrl = response.data[0]?.url;
        
        if (imageUrl) {
          console.log(`✅ PRIMARY adventure prompt succeeded - EARLY EXIT (no fallback prompts needed)`);
          clearTimeout(safetyTimeout); // Clear safety timeout
          this.isGeneratingImage = false; // Clear generation flag
          return { imageUrl, usedPrompt: finalPrompt };
        }
      } catch (primaryError: any) {
        console.log(`❌ Primary adventure prompt failed:`, primaryError.message);
        
        // Only proceed to fallback if it's a safety/policy issue
        if (!primaryError.message?.includes('safety system')) {
          this.isGeneratingImage = false; // Clear generation flag
          throw primaryError;
        }
        
        console.log('🔄 Primary prompt blocked by safety system - trying fallback prompts');
      }

      // Only if primary fails, generate fallback prompts
      console.log('🔄 Generating fallback prompts (primary prompt failed)');
      const fallbackPrompts = this.generateFallbackAdventurePrompts(prompt, userAdventure, fallbackPrompt);

      console.log('Generated fallback prompt options:', fallbackPrompts);

      // Try each fallback prompt option until one succeeds
      for (let i = 0; i < fallbackPrompts.length; i++) {
        try {
          const finalPrompt = fallbackPrompts[i].length > 400 
            ? fallbackPrompts[i].substring(0, 390) + "..." 
            : fallbackPrompts[i];
          
          console.log(`🎨 Trying fallback DALL-E prompt ${i + 1}:`, finalPrompt);

          const response = await this.client.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          });

          const imageUrl = response.data[0]?.url;
          
          if (imageUrl) {
            console.log(`✅ Fallback DALL-E prompt ${i + 1} succeeded`);
            clearTimeout(safetyTimeout); // Clear safety timeout
            this.isGeneratingImage = false; // Clear generation flag
            return { imageUrl, usedPrompt: finalPrompt };
          }
        } catch (promptError: any) {
          console.log(`❌ Fallback DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          if (!promptError.message?.includes('safety system') || i === fallbackPrompts.length - 1) {
            this.isGeneratingImage = false; // Clear generation flag
            throw promptError;
          }
          
          continue;
        }
      }

      throw new Error('All adventure prompt options failed');
    } catch (error) {
      console.error('DALL-E API error for adventure image:', error);
      clearTimeout(safetyTimeout); // Clear safety timeout
      this.isGeneratingImage = false; // Clear generation flag on error
      return null;
    } finally {
      // Ensure flag is always cleared (backup safety measure)
      clearTimeout(safetyTimeout);
      this.isGeneratingImage = false;
    }
  }

  // Generate education-focused images WITHOUT user_adventure context
  async generateEducationalQuestionImage(
    audioText: string,
    imagePrompt: string = "",
    topicName: string = ""
  ): Promise<string | null> {
    // If not initialized or no API key, return null (will show placeholder)
    if (!this.isInitialized || !this.client) {
      return null;
    }

    try {
      console.log('📚 Generating educational question image (no adventure context):', audioText);

      // Generate educational-focused prompts without adventure context
      const educationalPrompts = this.generateEducationalPrompts(audioText, imagePrompt, topicName);

      console.log('Generated educational prompt options:', educationalPrompts);

      // Try each prompt option until one succeeds
      for (let i = 0; i < educationalPrompts.length; i++) {
        try {
          const finalPrompt = educationalPrompts[i].length > 400 
            ? educationalPrompts[i].substring(0, 390) + "..." 
            : educationalPrompts[i];
          
          console.log(`📖 Trying educational DALL-E prompt ${i + 1}:`, finalPrompt);

          const response = await this.client.images.generate({
            model: "dall-e-3",
            prompt: finalPrompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            style: "vivid"
          });

          const imageUrl = response.data[0]?.url;
          
          if (imageUrl) {
            console.log(`✅ Educational DALL-E prompt ${i + 1} succeeded`);
            return imageUrl;
          }
        } catch (promptError: any) {
          console.log(`❌ Educational DALL-E prompt ${i + 1} failed:`, promptError.message);
          
          if (!promptError.message?.includes('safety system') || i === educationalPrompts.length - 1) {
            throw promptError;
          }
          
          continue;
        }
      }

      throw new Error('All educational prompt options failed');
    } catch (error) {
      console.error('DALL-E API error for educational image:', error);
      return null;
    }
  }

  // Helper: Generate the primary optimized adventure prompt (used first)
  private generatePrimaryAdventurePrompt(prompt: string, userAdventure: ChatMessage[], fallbackPrompt: string): string {
    console.log('=== PRIMARY ADVENTURE PROMPT GENERATION ===');
    console.log('Function: AIService.generatePrimaryAdventurePrompt');
    console.log('Current input prompt:', prompt);

    // Get conversation history for weighted prompt generation (last 6 messages - OpenAI style)
    const conversationHistory = this.getLastConversationMessages(userAdventure);
    console.log('Conversation history (last 6 - OpenAI style):', conversationHistory);

    // Generate weighted prompt: 80% user input + 10% latest AI response + 10% other context
    const weightedContent = this.generateWeightedPrompt(prompt, conversationHistory);
    console.log('Weighted content (80% user input, 10% latest AI response, 10% other context):', weightedContent);

    // Create exciting, adventurous images that kids will love while maintaining safety
    const enhancedPrompt = `Create a very realistic, high-quality image: ${weightedContent}. Style: Realistic with vivid details. It should NOT be cartoonish or kiddish. Keep all content completely family friendly with no nudity, no sexual content, and no sensual or romantic posing. Absolutely avoid sexualized bodies, ensure no sensual poses or clothing (no cleavage, lingerie, swimwear, exposed midriff, or tight/transparent outfits); characters are depicted in fully modest attire suitable for kids. No kissing, flirting, or adult themes. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.`;
    
    console.log('PRIMARY adventure prompt:', enhancedPrompt);
    console.log('WEIGHTING: 80% User Input + 10% Latest AI Response + 10% Other Context');
    console.log('================================================');

    return enhancedPrompt;
  }

  // Helper: Generate fallback adventure prompts (only used if primary fails)
  private generateFallbackAdventurePrompts(prompt: string, userAdventure: ChatMessage[], fallbackPrompt: string): string[] {
    console.log('=== FALLBACK ADVENTURE PROMPTS GENERATION ===');
    console.log('Function: AIService.generateFallbackAdventurePrompts');
    console.log('Current input prompt:', prompt);

    // Get conversation history for weighted prompt generation
    const conversationHistory = this.getLastConversationMessages(userAdventure);
    const weightedContent = this.generateWeightedPrompt(prompt, conversationHistory);

    const prompts: string[] = [];

    // Fallback Option 1: Epic and dynamic cinematic adventure
    const sanitizedEnhancedPrompt1 = `Create an epic, high-quality image: ${weightedContent}. Style: dynamic and cinematic with vivid colors, dramatic lighting, and amazing magical details. Make it look awesome and thrilling - the kind of image kids would want as their wallpaper. Ensure no nudity, sexual content, or sexually inappropriate material whatsoever. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.`;
    prompts.push(sanitizedEnhancedPrompt1);

    // Fallback Option 2: Thrilling adventure with safe content
    const sanitizedEnhancedPrompt2 = `Create a thrilling, high-quality adventure image: ${weightedContent}. Style: cinematic and realistic with vibrant details, exciting atmosphere, and captivating elements. Make it visually stunning and engaging for children while keeping all content completely family-friendly. No inappropriate content whatsoever. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.`;
    prompts.push(sanitizedEnhancedPrompt2);
    
    console.log('Fallback prompt 1 (Epic Dynamic):', sanitizedEnhancedPrompt1);
    console.log('Fallback prompt 2 (Thrilling Safe):', sanitizedEnhancedPrompt2);

    // Add simple fallback if all enhanced approaches fail
    if (fallbackPrompt) {
      const simpleFallback = `Create an awesome adventure image: ${prompt}, ${fallbackPrompt}. Style: realistic and exciting, perfect for kids, completely family-friendly content. There should be no text in the image whatsoever - no words, letters, signs, or any written content anywhere in the image.`;
      prompts.push(simpleFallback);
      console.log('Final fallback prompt (Simple Safe):', simpleFallback);
    }

    console.log('================================================');
    return prompts;
  }

  // Generate contextual response text for adventure images based on generated content
  async generateAdventureImageResponse(
    originalPrompt: string,
    generatedImagePrompt: string,
    userAdventure: ChatMessage[]
  ): Promise<string> {
    // If not initialized or no API key, use fallback responses
    if (!this.isInitialized || !this.client) {
      return this.getFallbackImageResponse(originalPrompt);
    }

    try {
      // Get recent adventure context for response generation
      const adventureContext = this.extractAdventureContext(userAdventure);
      
      const contextualPrompt = `You are Krafty, an enthusiastic AI companion in a child's adventure story. The child just requested an image, and you've generated it for them. Create an excited, encouraging response that describes what you've created.

ORIGINAL USER REQUEST: "${originalPrompt}"
ACTUAL GENERATED IMAGE PROMPT: "${generatedImagePrompt}"
ADVENTURE CONTEXT: "${adventureContext}"

Your response should:
1. Be excited and encouraging about what you've created
2. Briefly describe what's in the image based on the generated prompt (not just copy the user's words)
3. Connect it to their ongoing adventure story
4. Use child-friendly, enthusiastic language
5. Be 1-2 sentences maximum
6. Include appropriate emojis
7. Make them excited about their adventure

Examples:
- Instead of "I created an image of a dragon" say "I've brought your mighty dragon to life soaring majestically over the ancient castle! 🐉✨"
- Instead of "Here's your spaceship" say "Your incredible cosmic vessel is ready for the next part of your space adventure! 🚀🌟"

Return ONLY your enthusiastic response, nothing else.`;

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: contextualPrompt
          }
        ],
        max_tokens: 80,
        temperature: 0.8,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        return response.trim();
      } else {
        return this.getFallbackImageResponse(originalPrompt);
      }
    } catch (error) {
      console.error('Error generating contextual image response:', error);
      return this.getFallbackImageResponse(originalPrompt);
    }
  }

  // Fallback responses for image generation when AI is not available
  private getFallbackImageResponse(originalPrompt: string): string {
    const responses = [
      `🎨 Amazing! I've brought your vision to life in this incredible adventure scene! ✨`,
      `🌟 Wow! Your adventure image is ready and it looks absolutely fantastic! 🚀`,
      `✨ Perfect! I've created something magical that captures the spirit of your adventure! 🎭`,
      `🎯 Brilliant! This image is going to make your story even more exciting! 💫`,
      `🚀 Incredible! Your adventure scene has come to life beautifully! 🌈`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Helper: Generate education-focused prompts WITHOUT adventure context
  private generateEducationalPrompts(audioText: string, imagePrompt: string, topicName: string): string[] {
    const prompts: string[] = [];

    // Extract educational visual elements (reuse existing method)
    const visualElements = this.extractVisualElements(audioText);

    // Option 1: Focus on educational content with visual elements
    prompts.push(
      `Educational illustration for children: ${visualElements}. Topic: ${topicName}. Make it clear, colorful, and perfect for learning ${audioText}`
    );

    // Option 2: Direct educational content
    prompts.push(
      `Create a clear educational image showing: ${audioText}. For ${topicName} learning. Child-friendly and realistic.`
    );

    // Option 3: Simple educational focus
    prompts.push(`${audioText} for educational purposes, realistic and child-friendly`);

    // Option 4: Use existing realistic prompts (fallback to original method)
    const realisticPrompts = this.generateRealisticFunPrompt(audioText, imagePrompt);
    prompts.push(...realisticPrompts);

    return prompts;
  }

  // Generate reflection prompt for wrong answers
  async generateReflectionPrompt(
    questionText: string,
    options: string[] | null,
    selectedAnswer: number | string,
    correctAnswer: number | string,
    topicName: string,
    gradeLevel: string,
    questionType: 'mcq' | 'fill_blank' | 'drag_drop' | 'reading_comprehension' = 'mcq'
  ): Promise<string> {
    // If not initialized or no API key, return fallback
    if (!this.isInitialized || !this.client) {
      if (questionType === 'mcq' && options && Array.isArray(options)) {
        const selectedOption = options[selectedAnswer as number];
        const correctOption = options[correctAnswer as number];
        return `🤔 Great effort on this ${topicName.replace(/_/g, ' ').toLowerCase()} question! You chose "${selectedOption}", but the correct answer is "${correctOption}". Let me explain why that's the right choice!`;
      } else if (questionType === 'fill_blank') {
        return `🌟 Nice try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! The correct answer is "${correctAnswer}". Let me help you understand why this word fits perfectly here!`;
      } else if (questionType === 'drag_drop') {
        return `🤔 Good effort with your ${topicName.replace(/_/g, ' ').toLowerCase()} sorting! Let me show you the correct pattern and explain why it works this way.`;
      } else if (questionType === 'reading_comprehension') {
        return `🌟 Great effort reading! The correct answer is "${correctAnswer}". Let me explain why this is the best choice based on what we read.`;
      } else {
        return `🤔 Great try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Let me explain the correct answer and help you understand why it's right.`;
      }
    }

    try {
      let reflectionPrompt: string;
      
      if (questionType === 'mcq' && options && Array.isArray(options)) {
        // Multiple choice question
        const selectedOption = options[selectedAnswer as number];
        const correctOption = options[correctAnswer as number];
        
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child chose a wrong answer, and you need to help them understand why their choice isn't correct and guide them toward discovering the right answer through hints and reasoning.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - All Options: ${options.map((opt, i) => `${i}: "${opt}"`).join(", ")}
      - Student chose: "${selectedOption}" (option ${selectedAnswer})
      - Correct answer: "${correctOption}" (option ${correctAnswer})

      ANALYTICAL TEACHING APPROACH:
      1. Start with warm encouragement about their effort
      2. Analyze WHY their chosen answer isn't correct (be gentle but educational):
         - What might have made this option seem appealing?
         - What key detail or concept makes this option incorrect?
         - What pattern or rule does this violate?
      3. Provide strategic HINTS toward the correct answer without stating it directly:
         - Point to key words or clues in the question
         - Remind them of relevant rules or patterns for "${topicName.replace(/_/g, ' ')}"
         - Ask them to think about specific aspects of the topic
         - Guide their attention to what they should look for
      4. Encourage them to think again and try another option
      5. Use vocabulary appropriate for ${gradeLevel} level

      RESPONSE REQUIREMENTS:
      - Start with encouraging emoji and acknowledgment of effort
      - Explain why their choice isn't correct in gentle, educational terms
      - Give 1-2 strategic hints that guide them toward the right answer
      - DO NOT directly state the correct answer - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific hints for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to try again
      
      Example: "🤔 Great thinking! I can see why '${selectedOption}' might seem right, but [gentle explanation of why it's incorrect]. Here's a hint: look for [specific clue] in the question, and remember that in ${topicName.replace(/_/g, ' ')}, we usually [relevant rule/pattern]. Try looking at the other options again!"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'fill_blank') {
        // Fill-in-the-blank question
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child gave a wrong answer to a fill-in-the-blank question, and you need to help them understand why their answer doesn't fit and guide them toward discovering the correct word through hints and reasoning.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student wrote: "${selectedAnswer}"
      - Correct answer: "${correctAnswer}"

      ANALYTICAL TEACHING APPROACH FOR FILL-IN-THE-BLANK:
      1. Acknowledge their attempt warmly
      2. Analyze WHY their answer doesn't fit (be gentle but educational):
         - What rule or pattern does it not follow?
         - How does it sound different from what's needed?
         - What meaning doesn't match the context?
      3. Provide strategic HINTS toward the correct word without stating it directly:
         - Point to sound patterns (phonics clues)
         - Give meaning or context clues
         - Mention grammar rules (simple for grade level)
         - Suggest letter patterns or spelling hints
         - Connect to "${topicName.replace(/_/g, ' ')}" patterns
      4. Encourage them to think again and try another word
      5. Use vocabulary appropriate for ${gradeLevel} level

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment
      - Explain why their word doesn't quite fit (be gentle)
      - Give 1-2 strategic hints that guide them toward the right word
      - DO NOT directly state the correct word - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific hints for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to try again
      
      Example: "🌟 Nice try with '${selectedAnswer}'! That word doesn't quite fit because [gentle explanation]. Here's a hint: think about [specific clue about sound/meaning/pattern] and remember the ${topicName.replace(/_/g, ' ')} rule we're practicing. Can you think of another word that might work better?"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'drag_drop') {
        // Drag-and-drop sorting question  
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student learning English. The child made incorrect sorting choices in a drag-and-drop activity, and you need to help them understand what went wrong with their sorting and guide them toward discovering the correct pattern through hints.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student made sorting errors
      - There is a correct sorting pattern based on the topic

      ANALYTICAL TEACHING APPROACH FOR DRAG-AND-DROP:
      1. Acknowledge their sorting effort warmly
      2. Analyze WHY their sorting approach didn't work (be gentle but educational):
         - What pattern or rule did they miss?
         - Which items don't belong where they put them?
         - What key feature should they focus on for grouping?
      3. Provide strategic HINTS toward the correct sorting pattern without showing it directly:
         - Point to key characteristics items should be grouped by
         - Remind them of "${topicName.replace(/_/g, ' ')}" rules or patterns
         - Ask them to look for specific features or similarities
         - Give examples of what to look for without stating the full answer
      4. Encourage them to try sorting again
      5. Use simple language appropriate for ${gradeLevel}

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment of their effort
      - Explain why their current sorting doesn't quite work (be gentle)
      - Give 1-2 strategic hints about the sorting pattern to look for
      - DO NOT show the complete correct sorting - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific hints for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to try again
      
      Example: "🤔 Good effort sorting! I notice some items might fit better in different groups. Here's a hint: try grouping by [specific characteristic] and remember that in ${topicName.replace(/_/g, ' ')}, we look for [pattern/rule]. Can you try sorting them again?"
      
      Return ONLY your teaching response, nothing extra.`;
      } else if (questionType === 'reading_comprehension') {
        // Reading comprehension question
        reflectionPrompt = `You are Krafty, a warm and encouraging AI tutor helping a ${gradeLevel} student with reading comprehension. The child chose a wrong answer, and you need to help them understand why their choice doesn't match the text and guide them toward finding the correct answer through reading strategies and hints.

      LEARNING CONTEXT:
      - Grade Level: ${gradeLevel}
      - Topic: ${topicName.replace(/_/g, ' ')}
      - Question: "${questionText}"
      - Student chose: "${selectedAnswer}"
      - Correct answer: "${correctAnswer}"

      ANALYTICAL TEACHING APPROACH FOR READING COMPREHENSION:
      1. Acknowledge their reading effort warmly
      2. Analyze WHY their answer doesn't match the text (be gentle but educational):
         - What part of the text contradicts their choice?
         - What key details did they might have missed?
         - What reading strategy would help them find the right answer?
      3. Provide strategic HINTS toward finding the correct answer without stating it directly:
         - Point them to specific parts of the text to reread
         - Suggest reading strategies appropriate for ${gradeLevel}
         - Ask them to look for key words or phrases
         - Give them questions to think about while reading
         - Connect to "${topicName.replace(/_/g, ' ')}" comprehension skills
      4. Encourage them to reread and try again
      5. Use reading vocabulary appropriate for ${gradeLevel}

      RESPONSE REQUIREMENTS:
      - Start with encouraging acknowledgment
      - Explain why their choice doesn't match what the text says (be gentle)
      - Give 1-2 strategic hints about where to look or what strategy to use
      - DO NOT directly state the correct answer - let them discover it
      - Keep it positive and encourage them to try again
      - Use topic-specific reading strategies for "${topicName.replace(/_/g, ' ')}"
      - Maximum 4 sentences total
      - End with encouragement to reread and try again
      
      Example: "🌟 Great reading effort! I can see why you might think that, but let's look back at the text together. Here's a hint: reread [specific section] and look for [key detail/word]. What do you think the answer might be when you focus on that part?"
      
      Return ONLY your teaching response, nothing extra.`;
      }

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: reflectionPrompt
          }
        ],
        max_tokens: 100,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        return response.trim();
      } else {
        throw new Error('No response content received');
      }
    } catch (error) {
      console.error('OpenAI API error generating reflection prompt:', error);
      // Return fallback on error
      if (questionType === 'mcq' && options && Array.isArray(options)) {
        const selectedOption = options[selectedAnswer as number];
        const correctOption = options[correctAnswer as number];
        return `🤔 Great effort on this ${topicName.replace(/_/g, ' ').toLowerCase()} question! You chose "${selectedOption}", but the correct answer is "${correctOption}". Let me explain why that's the right choice!`;
      } else if (questionType === 'fill_blank') {
        return `🌟 Nice try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! The correct answer is "${correctAnswer}". Let me help you understand why this word fits perfectly here!`;
      } else if (questionType === 'drag_drop') {
        return `🤔 Good effort with your ${topicName.replace(/_/g, ' ').toLowerCase()} sorting! Let me show you the correct pattern and explain why it works this way.`;
      } else if (questionType === 'reading_comprehension') {
        return `🌟 Great effort reading! The correct answer is "${correctAnswer}". Let me explain why this is the best choice based on what we read.`;
      } else {
        return `🤔 Great try with your ${topicName.replace(/_/g, ' ').toLowerCase()} work! Let me explain the correct answer and help you understand why it's right.`;
      }
    }
  }

  // Generate concise one-liner summaries from panel text
  async generateOneLiner(panelText: string): Promise<string> {
    // If not initialized or no API key, use simple truncation fallback
    if (!this.isInitialized || !this.client) {
      const firstSentence = panelText.match(/^[^.!?]*[.!?]/);
      if (firstSentence && firstSentence[0].length <= 60) {
        return firstSentence[0].trim();
      }
      const truncated = panelText.substring(0, 50).trim();
      return truncated + (panelText.length > 50 ? "..." : "");
    }

    try {
      const prompt = `Convert this comic panel description into a concise, exciting one-liner (max 60 characters) that captures the main action or moment:

"${panelText}"

Requirements:
- Keep it under 60 characters
- Capture the most important action or moment  
- Make it exciting and engaging for kids
- Use simple, clear language
- Return ONLY the one-liner, nothing else

Examples:
- "The brave astronaut climbs into the rocket ship and prepares for an epic journey to Mars!" → "Astronaut boards rocket for Mars!"
- "Captain Alex discovers a mysterious glowing portal hidden behind ancient vines in the enchanted forest!" → "Captain finds glowing portal!"

Return ONLY the one-liner text:`;

      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 30,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        const oneLiner = response.trim().replace(/['"]/g, ''); // Remove any quotes
        return oneLiner.length <= 60 ? oneLiner : oneLiner.substring(0, 57) + "...";
      } else {
        // Fallback to simple truncation
        const firstSentence = panelText.match(/^[^.!?]*[.!?]/);
        if (firstSentence && firstSentence[0].length <= 60) {
          return firstSentence[0].trim();
        }
        const truncated = panelText.substring(0, 50).trim();
        return truncated + (panelText.length > 50 ? "..." : "");
      }
    } catch (error) {
      console.error('Error generating one-liner:', error);
      // Fallback to simple truncation
      const firstSentence = panelText.match(/^[^.!?]*[.!?]/);
      if (firstSentence && firstSentence[0].length <= 60) {
        return firstSentence[0].trim();
      }
      const truncated = panelText.substring(0, 50).trim();
      return truncated + (panelText.length > 50 ? "..." : "");
    }
  }

  // Generate educational hints for MCQ questions without giving away the answer
  async generateSpellingHint(word: string, userAttempt: string): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackSpellingHint(word, userAttempt);
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: 'system',
            content: `You are a helpful spelling tutor for children aged 8-14. A student is trying to spell a word but got it wrong. Your job is to:

1. First, explain why their attempt doesn't match the target word
2. Give them 2-3 alternative options to consider (including the correct answer mixed in)
3. Give a subtle recap of Floss Rule if applicable.
4. Strictly ensure the answer isn't directly mentioned in your hint.

The target word: "${word}"
Student's attempt: "${userAttempt}"

Format your response like this:
"Ah, that sounds like '${userAttempt}' which is [explanation]. Here are some options to try: [2-3 choices including correct answer]."

Strictly keep it within 20 words. Keep it encouraging and focus on the learning process rather than giving away the answer.`
          },
          {
            role: 'user',
            content: `Help me spell "${word}". I tried "${userAttempt}" but it's wrong.`
          }
        ],
        max_tokens: 60,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        return response.trim();
      } else {
        throw new Error('No spelling hint response received');
      }
    } catch (error) {
      console.error('OpenAI API error generating spelling hint:', error);
      return this.getFallbackSpellingHint(word, userAttempt);
    }
  }

  private getFallbackSpellingHint(word: string, userAttempt: string): string {
    const hints = [
      `That's close! Try thinking about the sounds in "${word}". What letters make those sounds?`,
      `Good try! "${word}" has ${word.length} letters. Can you hear each sound?`,
      `Almost there! Listen carefully to how "${word}" sounds when you say it slowly.`,
      `Nice attempt! Break "${word}" into smaller parts - what sounds do you hear?`,
      `Keep trying! Think about similar words you know that sound like "${word}".`
    ];
    return hints[Math.floor(Math.random() * hints.length)];
  }

  async generateHint(
    question: string,
    options: string[],
    correctAnswer: number,
    explanation: string,
    hintLevel: number = 1, // 1 = general, 2 = specific, 3 = very specific
    userAdventure: ChatMessage[] = []
  ): Promise<string> {
    // If not initialized or no API key, use fallback
    if (!this.isInitialized || !this.client) {
      return this.getFallbackHint(question, options, hintLevel);
    }

    try {
      // Extract adventure context for engagement
      const adventureContext = this.extractAdventureContext(userAdventure);
      
      // Get the correct answer for hint generation context
      const correctOption = options[correctAnswer];

      const hintPrompt = `You are an encouraging educational AI helping a child with a learning question. Your goal is to guide them toward the correct answer without giving it away directly.

QUESTION: "${question}"
OPTIONS: ${options.map((opt, i) => `${i + 1}. "${opt}"`).join(", ")}
EXPLANATION: "${explanation}"
ADVENTURE CONTEXT: ${adventureContext || this.getDefaultAdventureContext()}
HINT LEVEL: ${hintLevel}/3 (1=general, 2=specific, 3=very specific)

HINT GUIDELINES BY LEVEL:
Level 1 (General): 
- Give a broad strategy or approach
- Focus on what to look for or think about
- Encourage thinking process
- Stay very general

Level 2 (Specific):
- Point to specific elements in the question
- Give more focused direction
- Still don't reveal the answer directly
- Help narrow down choices

Level 3 (Very Specific):
- Give very targeted guidance
- Help eliminate wrong options
- Provide clear reasoning paths
- Almost lead them to the answer

RULES:
1. NEVER state the correct answer directly
2. Be encouraging and supportive in tone
3. Use adventure context naturally when possible (mention characters, settings briefly)
4. Keep hints age-appropriate for elementary students
5. End with encouragement to try
6. Use 1-2 sentences maximum
7. Include relevant emoji for engagement

Generate a hint at level ${hintLevel}:`;

      const completion = await this.client.chat.completions.create({
        model: "chatgpt-4o-latest",
        messages: [
          {
            role: "user",
            content: hintPrompt
          }
        ],
        max_tokens: 80,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response && response.trim()) {
        return response.trim();
      } else {
        throw new Error('No hint response received');
      }
    } catch (error) {
      console.error('OpenAI API error generating hint:', error);
      return this.getFallbackHint(question, options, hintLevel);
    }
  }

  // Fallback hints when API is not available
  private getFallbackHint(question: string, options: string[], hintLevel: number): string {
    const hintsByLevel = {
      1: [
        "🤔 Take your time and read each option carefully. What sounds right to you?",
        "💡 Think about what you've learned before. Which option makes the most sense?",
        "🌟 Look at each choice and ask yourself which one fits best!",
        "🎯 Trust your instincts! Read through the options one more time."
      ],
      2: [
        "🔍 Look closely at the differences between the options. What makes them unique?",
        "📚 Think about the rules you know. Which option follows them correctly?",
        "⭐ Compare the options carefully - one of them stands out as more correct!",
        "🎨 Focus on the key words in the question. They'll guide you to the answer!"
      ],
      3: [
        "🎯 Try eliminating the options that clearly don't fit first!",
        "🔎 Look for the option that matches exactly what the question is asking for!",
        "💫 Think step by step - which option solves the problem completely?",
        "🌟 You're almost there! One option is clearly the best choice!"
      ]
    };

    const levelHints = hintsByLevel[hintLevel as keyof typeof hintsByLevel] || hintsByLevel[1];
    return levelHints[Math.floor(Math.random() * levelHints.length)];
  }

  // Check if AI service is properly configured
  isConfigured(): boolean {
    return this.isInitialized;
  }

  // NEW: Unified AI response generation that may include images
  // This is the new method that uses AI to decide when to generate images
  async generateUnifiedResponse(
    userText: string, 
    chatHistory: ChatMessage[] = [], 
    spellingQuestion: SpellingQuestion,
    userId: string,
    sessionId: string = crypto.randomUUID()
  ): Promise<UnifiedAIResponse> {
    console.log('🚀 Using NEW unified AI response generation system');
    
    return await this.unifiedStreamingService.generateUnifiedResponse(
      userText,
      chatHistory,
      spellingQuestion,
      userId,
      sessionId
    );
  }
  
  // NEW: Register for streaming events from unified system
  onUnifiedStreamEvent(sessionId: string, callback: (event: any) => void) {
    this.unifiedStreamingService.onStreamEvent(sessionId, callback);
  }
  
  // NEW: Remove stream listener
  removeUnifiedStreamListener(sessionId: string) {
    this.unifiedStreamingService.removeStreamListener(sessionId);
  }
  
  // NEW: Abort ongoing unified stream
  abortUnifiedStream(sessionId: string) {
    this.unifiedStreamingService.abortStream(sessionId);
  }
  
  // NEW: Check if unified system is ready
  isUnifiedSystemReady(): boolean {
    return this.unifiedStreamingService.isReady();
  }

  // Get configuration status for UI feedback
  getStatus(): { configured: boolean; message: string } {
    if (this.isInitialized) {
      return { configured: true, message: 'AI is ready!' };
    } else {
      return { 
        configured: false, 
        message: 'Using demo responses. Add OpenAI API key for full AI features.' 
      };
    }
  }
}

// Export a singleton instance
export const aiService = new AIService();
export default AIService;
