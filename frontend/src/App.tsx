import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { SavedPlacesProvider } from "@/contexts/SavedPlacesContext";
import AIChatOverlay from "@/components/AIChatOverlay";
import Index from "./pages/Index";
import Explore from "./pages/Explore";
import Chat from "./pages/Chat";
import Recommendations from "./pages/Recommendations";
import MapExplorer from "./pages/MapExplorer";
import PlaceDetail from "./pages/PlaceDetail";
import Saved from "./pages/Saved";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import MerchantDashboard from "./pages/MerchantDashboard";
import MerchantSettings from "./pages/MerchantSettings";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import DebugTraceWrapper from "@/components/DebugTraceWrapper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <SavedPlacesProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/merchant" element={<MerchantDashboard />} />
              <Route path="/merchant/settings" element={<MerchantSettings />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/map" element={<MapExplorer />} />
              <Route path="/place/:id" element={<PlaceDetail />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AIChatOverlay />
            <DebugTraceWrapper />
          </BrowserRouter>
        </TooltipProvider>
        </SavedPlacesProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
