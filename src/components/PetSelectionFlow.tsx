import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PetOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
  defaultNames: string[];
}

interface PetSelectionFlowProps {
  onPetSelected: (petId: string, petName: string) => void;
}

const PET_OPTIONS: PetOption[] = [
  {
    id: 'dog',
    name: 'Dog',
    emoji: '🐕',
    description: '',
    defaultNames: ['Buddy', 'Max', 'Luna', 'Charlie', 'Bella']
  },
  {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    description: '',
    defaultNames: ['Whiskers', 'Shadow', 'Mittens', 'Felix', 'Cleo']
  },
  {
    id: 'hamster',
    name: 'Hamster',
    emoji: '🐹',
    description: '',
    defaultNames: ['Peanut', 'Nibbles', 'Squeaky', 'Hazel', 'Pip']
  }
];

export function PetSelectionFlow({ onPetSelected }: PetSelectionFlowProps) {
  const [step, setStep] = useState<'selection' | 'naming'>('selection');
  const [selectedPet, setSelectedPet] = useState<PetOption | null>(null);
  const [petName, setPetName] = useState('');

  const handlePetChoice = (pet: PetOption) => {
    setSelectedPet(pet);
    setPetName(pet.defaultNames[0]); // Set first default name
    setStep('naming');
  };

  const handleNameSubmit = () => {
    if (selectedPet && petName.trim()) {
      onPetSelected(selectedPet.id, petName.trim());
    }
  };

  const handleSampleNameClick = (name: string) => {
    setPetName(name);
  };

  if (step === 'selection') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-2xl bg-white">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-purple-600">
              Choose your pet! 🎉 
            </CardTitle>
            <CardDescription className="text-lg">
              
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {PET_OPTIONS.map((pet) => (
                <Card 
                  key={pet.id}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-purple-300 h-64"
                  onClick={() => handlePetChoice(pet)}
                >
                  <CardContent className="p-6 text-center h-full flex flex-col justify-center">
                    <div className="text-6xl mb-3">{pet.emoji}</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{pet.name}</h3>
                    <p className="text-sm text-gray-600">{pet.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'naming' && selectedPet) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md bg-white">
          <CardHeader className="text-center">
            <div className="text-6xl mb-3">{selectedPet.emoji}</div>
            <CardTitle className="text-xl font-bold text-purple-600">
              Name Your {selectedPet.name}!
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
            
            <div>
              <p className="text-sm text-gray-600 mb-2">Or choose from these suggestions:</p>
              <div className="flex flex-wrap gap-2">
                {selectedPet.defaultNames.map((name) => (
                  <Button
                    key={name}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSampleNameClick(name)}
                    className={`${petName === name ? 'bg-purple-100 border-purple-300' : ''}`}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('selection')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleNameSubmit}
                disabled={!petName.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                Choose {petName || 'Pet'}!
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
