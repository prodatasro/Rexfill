import { initSatellite } from "@junobuild/core";
import { FC, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { FileProcessingProvider } from "./contexts/FileProcessingContext";
import { ProcessorProvider } from "./contexts/ProcessorContext";
import { SearchProvider } from "./contexts/SearchContext";
import Layout from "./components/Layout.tsx";
import { Toaster } from "sonner";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

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
  useEffect(() => {
    (async () =>
      await initSatellite({
        workers: {
          auth: true,
        },
      }))();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthProvider>
              <FileProcessingProvider>
                <ProcessorProvider>
                  <ConfirmProvider>
                    <SearchProvider>
                      <Layout />
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
            </AuthProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
