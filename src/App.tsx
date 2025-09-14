import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CameraWidget } from "@/components/CameraWidget";
import { VoiceAgentTest } from "@/components/VoiceAgentTest";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <div className="h-full w-full overflow-hidden">
          <Toaster />
          <Sonner />
          <CameraWidget />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={
                <AuthGuard>
                  <Index />
                </AuthGuard>
              } />
              <Route path="/voice-test" element={
                <AuthGuard>
                  <VoiceAgentTest />
                </AuthGuard>
              } />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
