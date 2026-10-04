import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AppShell } from "@/components/emmaus/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChatProvider } from "@/state/chat";
import { MeetupProvider } from "@/state/meetup";
import { PrayerProvider } from "@/state/prayers";
import { SettingsProvider } from "@/state/settings";

import Companion from "./pages/Companion";
import Gather from "./pages/Gather";
import NotFound from "./pages/NotFound";
import Prayers from "./pages/Prayers";
import Settings from "./pages/Settings";
import Today from "./pages/Today";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsProvider>
      <ChatProvider>
        <PrayerProvider>
          <MeetupProvider>
            <TooltipProvider>
              <Toaster
                theme="dark"
                position="top-center"
                toastOptions={{
                  classNames: {
                    toast: "!rounded-2xl !border !border-gold/25 !bg-surface-high !text-parchment !shadow-2xl",
                    title: "!font-serif !text-[16px] !font-semibold",
                    description: "!text-mist",
                  },
                }}
              />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<Today />} />
                    <Route path="/companion" element={<Companion />} />
                    <Route path="/gather" element={<Gather />} />
                    <Route path="/prayers" element={<Prayers />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </MeetupProvider>
        </PrayerProvider>
      </ChatProvider>
    </SettingsProvider>
  </QueryClientProvider>
);

export default App;
