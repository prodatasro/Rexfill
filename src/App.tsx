import { FC, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { FileProcessingProvider } from "./contexts/FileProcessingContext";
import { ProcessorProvider } from "./contexts/ProcessorContext";
import { SearchProvider } from "./contexts/SearchContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { UserProfileProvider } from "./contexts/UserProfileContext";
import { Toaster } from "sonner";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import LoadingSpinner from "./components/ui/LoadingSpinner";

// Lazy load layouts
const PublicLayout = lazy(() => import("./components/layouts/PublicLayout"));
const AppLayout = lazy(() => import("./components/layouts/AppLayout"));

// Lazy load public pages
const LandingPage = lazy(() => import("./pages/public/LandingPage"));
const PricingPage = lazy(() => import("./pages/public/PricingPage"));
const GuidesPage = lazy(() => import("./pages/public/GuidesPage"));
const ContactPage = lazy(() => import("./pages/public/ContactPage"));
const PrivacyPage = lazy(() => import("./pages/public/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/public/TermsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Configure QueryClient with sensible defaults for Juno
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - data considered fresh
      gcTime: 1000 * 60 * 10, // 10 minutes - cache garbage collection
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    },
    mutations: {
      retry: 2, // Retry failed mutations 2 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

const App: FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <UserProfileProvider>
                <SubscriptionProvider>
                  <FileProcessingProvider>
                    <ProcessorProvider>
                      <ConfirmProvider>
                        <SearchProvider>
                      <Suspense
                        fallback={
                          <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                            <LoadingSpinner />
                          </div>
                        }
                      >
                        <Routes>
                          {/* Public routes */}
                          <Route element={<PublicLayout />}>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/pricing" element={<PricingPage />} />
                            <Route path="/guides" element={<GuidesPage />} />
                            <Route path="/contact" element={<ContactPage />} />
                            <Route path="/privacy" element={<PrivacyPage />} />
                            <Route path="/terms" element={<TermsPage />} />
                          </Route>

                          {/* Authenticated app routes */}
                          <Route path="/app/*" element={<AppLayout />} />

                          {/* 404 fallback */}
                          <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                      </Suspense>
                    </SearchProvider>
                      <Toaster
                        position="bottom-right"
                        richColors
                        closeButton
                        duration={5000}
                      />
                    </ConfirmProvider>
                  </ProcessorProvider>
                </FileProcessingProvider>
              </SubscriptionProvider>
              </UserProfileProvider>
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
