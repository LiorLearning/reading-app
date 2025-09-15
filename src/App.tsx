import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CameraWidget } from "@/components/CameraWidget";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
// TEMPORARY CHANGE: Import PetPage to make it the home page
import { PetPage } from "./pages/PetPage";

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
              {/* TEMPORARY CHANGE: Make PetPage the home page instead of Index */}
              <Route path="/" element={
                <AuthGuard>
                  <PetPage />
                </AuthGuard>
              } />
              {/* COMMENTED OUT: Original Index route - uncomment to restore */}
              {/* <Route path="/" element={
                <AuthGuard>
                  <Index />
                </AuthGuard>
              } /> */}
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
