import React, { useState } from 'react';
import { VoiceAgent } from './VoiceAgent';
import { useVoiceFeedback } from '../hooks/use-voice-feedback';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function VoiceAgentTest() {
  const [testMessage, setTestMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  
  const { triggerIncorrectAnswerFeedback, isConnected } = useVoiceFeedback({
    onConnect: () => {
      console.log('Voice feedback connected in test');
      setMessages(prev => [...prev, 'Voice feedback connected']);
    },
    onDisconnect: () => {
      console.log('Voice feedback disconnected in test');
      setMessages(prev => [...prev, 'Voice feedback disconnected']);
    },
    onMessage: (message) => {
      console.log('Voice feedback message in test:', message);
      setMessages(prev => [...prev, `Agent: ${message}`]);
    },
    onError: (error) => {
      console.error('Voice feedback error in test:', error);
      setMessages(prev => [...prev, `Error: ${error.message}`]);
    }
  });

  const handleTestIncorrectAnswer = () => {
    triggerIncorrectAnswerFeedback('VGL', 'can', 'We ___ peek through the marshmallow flap together if you\'re ready.');
  };

  const handleSendCustomMessage = () => {
    if (testMessage.trim()) {
      // This would need to be implemented in the hook
      setMessages(prev => [...prev, `User: ${testMessage}`]);
      setTestMessage('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voice Agent Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <VoiceAgent
              onConnect={() => setMessages(prev => [...prev, 'Voice agent connected'])}
              onDisconnect={() => setMessages(prev => [...prev, 'Voice agent disconnected'])}
              onMessage={(message) => setMessages(prev => [...prev, `Agent: ${message}`])}
              onError={(error) => setMessages(prev => [...prev, `Error: ${error.message}`])}
            />
            <div className="text-sm text-gray-600">
              Status: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="space-y-2">
            <Button onClick={handleTestIncorrectAnswer} variant="outline">
              Test Incorrect Answer Feedback
            </Button>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter test message..."
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <Button onClick={handleSendCustomMessage} disabled={!testMessage.trim()}>
                Send
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold">Messages:</h3>
            <div className="h-40 overflow-y-auto border rounded-md p-3 bg-gray-50">
              {messages.length === 0 ? (
                <p className="text-gray-500 text-sm">No messages yet...</p>
              ) : (
                messages.map((message, index) => (
                  <div key={index} className="text-sm mb-1">
                    {message}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
