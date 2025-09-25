import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PetOption {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

interface OwnedPetSelectionFlowProps {
  ownedPets: string[];
  onPetSelected: (petId: string) => void;
  onClose?: () => void;
}

const PET_OPTIONS_MAP: Record<string, PetOption> = {
  dog: {
    id: 'dog',
    name: 'Dog',
    emoji: '🐕',
    description: 'Your loyal companion'
  },
  cat: {
    id: 'cat',
    name: 'Cat',
    emoji: '🐱',
    description: 'Your independent friend'
  },
  hamster: {
    id: 'hamster',
    name: 'Hamster',
    emoji: '🐹',
    description: 'Your tiny buddy'
  },
  dragon: {
    id: 'dragon',
    name: 'Dragon',
    emoji: '🐉',
    description: 'Your magical companion'
  },
  unicorn: {
    id: 'unicorn',
    name: 'Unicorn',
    emoji: '🦄',
    description: 'Your enchanted friend'
  }
};

export function OwnedPetSelectionFlow({ ownedPets, onPetSelected, onClose }: OwnedPetSelectionFlowProps) {
  const ownedPetOptions = ownedPets
    .map(petId => PET_OPTIONS_MAP[petId])
    .filter(Boolean);

  if (ownedPetOptions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md bg-white">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-purple-600">
              No Pets Found
            </CardTitle>
            <CardDescription>
              You don't seem to have any pets yet. Contact support if this seems wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {onClose && (
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-purple-600">
            Choose Your Pet! 🐾
          </CardTitle>
          <CardDescription className="text-lg">
            Select one of your pets to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {ownedPetOptions.map((pet) => (
              <Card 
                key={pet.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-purple-300 h-64"
                onClick={() => onPetSelected(pet.id)}
              >
                <CardContent className="p-6 text-center h-full flex flex-col justify-center">
                  <div className="text-6xl mb-3">{pet.emoji}</div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{pet.name}</h3>
                  <p className="text-sm text-gray-600">{pet.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {onClose && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={onClose}
                className="px-6"
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
