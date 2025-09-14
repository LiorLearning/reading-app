import React from 'react';
import { VoiceAgent } from './VoiceAgent';
import { useVoiceAgent } from './VoiceAgent';

/**
 * Example component demonstrating how to use the VoiceAgent
 * This shows both direct usage and the hook-based approach
 */
export function VoiceAgentExample() {
  const { triggerVoiceFeedback, VoiceAgentComponent } = useVoiceAgent();

  const handleTriggerFeedback = () => {
    triggerVoiceFeedback("The user answered 'VGL' but the correct answer is 'can'. The question was: 'We ___ peek through the marshmallow flap together if you're ready.' Please provide encouraging feedback and help them understand the correct answer.");
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-4">
        ElevenLabs Voice Agent Integration
      </h1>
      
      <div className="bg-white rounded-lg shadow-lg p-6 w-full">
        <h2 className="text-xl font-semibold mb-4">Direct Voice Agent Usage</h2>
        <VoiceAgent
          onConnect={() => console.log('Voice agent connected!')}
          onDisconnect={() => console.log('Voice agent disconnected!')}
          onMessage={(message) => console.log('Received message:', message)}
          onError={(error) => console.error('Voice agent error:', error)}
        />
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6 w-full">
        <h2 className="text-xl font-semibold mb-4">Hook-based Voice Agent</h2>
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleTriggerFeedback}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Trigger Voice Feedback (Incorrect Answer)
          </button>
          {VoiceAgentComponent}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 w-full">
        <h3 className="font-semibold mb-2">How it works:</h3>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• The voice agent connects to ElevenLabs using the hardcoded agent ID</li>
          <li>• When a user selects an incorrect answer in MCQ components, voice feedback is automatically triggered</li>
          <li>• The agent provides encouraging feedback and helps explain the correct answer</li>
          <li>• Visual indicators show when voice feedback is active</li>
          <li>• Microphone permission is requested automatically when needed</li>
        </ul>
      </div>
    </div>
  );
}

export default VoiceAgentExample;
