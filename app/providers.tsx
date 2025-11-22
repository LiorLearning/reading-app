'use client'

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/use-auth";
import { useEffect } from "react";
import analytics from '@/lib/analytics'

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    analytics.init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="h-full w-full overflow-y-auto">
            <Toaster />
            <Sonner position="top-left" />
            {children}
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
