// Test script to verify the cycle starting one message sooner

function testEarlierCycle() {
  console.log('Testing cycle starting one message sooner:');
  console.log('Expected: Message 0: No spelling | Messages 1,2: Spelling | Messages 3,4: No spelling | Messages 5,6: Spelling');
  console.log('');

  for (let messageCycleCount = 1; messageCycleCount <= 8; messageCycleCount++) {
    // Updated logic from Index.tsx
    let isSpellingPhase = false;
    if (messageCycleCount >= 2) {
      // After the first message (cycle count 1), use 2-2 alternating pattern
      const cyclePosition = (messageCycleCount - 2) % 4;
      isSpellingPhase = cyclePosition < 2; // First 2 of each 4-message cycle have spelling
    }

    const messageIndex = messageCycleCount - 1;
    const hasSpelling = isSpellingPhase ? 'WITH SPELLING QUESTION' : 'no spelling';
    console.log(`Message ${messageIndex} (cycle=${messageCycleCount}): ${hasSpelling}`);
  }
}

testEarlierCycle();
