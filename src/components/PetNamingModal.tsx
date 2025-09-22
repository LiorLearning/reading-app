import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PetNamingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  petId: string;
  petEmoji: string;
  petSpeciesName: string; // e.g., "Dog", "Cat"
  defaultNames?: string[];
  onSubmit: (name: string) => void;
};

export function PetNamingModal({ isOpen, onClose, petId, petEmoji, petSpeciesName, defaultNames = [], onSubmit }: PetNamingModalProps) {
  const [petName, setPetName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPetName(defaultNames[0] || '');
    }
  }, [isOpen, defaultNames]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="text-center">
          <div className="text-6xl mb-3">{petEmoji}</div>
          <CardTitle className="text-xl font-bold text-purple-600">
            Name Your {petSpeciesName}!
          </CardTitle>
          <CardDescription>
            What would you like to call your new companion?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Enter pet name..."
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              className="text-center text-lg font-medium"
              maxLength={20}
            />
          </div>

          {defaultNames.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-2">Or choose from these suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {defaultNames.map((name) => (
                  <Button
                    key={name}
                    variant="outline"
                    size="sm"
                    onClick={() => setPetName(name)}
                    className={`${petName === name ? 'bg-purple-100 border-purple-300' : ''}`}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => petName.trim() && onSubmit(petName.trim())}
              disabled={!petName.trim()}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              Save name
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PetNamingModal;


