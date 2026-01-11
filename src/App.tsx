import { initSatellite } from "@junobuild/core";
import { FC, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { FileProcessingProvider } from "./contexts/FileProcessingContext";
import { ProcessorProvider } from "./contexts/ProcessorContext";
import Layout from "./components/Layout.tsx";
import { Toaster } from "sonner";
import { ConfirmProvider } from "./contexts/ConfirmContext";

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
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <FileProcessingProvider>
            <ProcessorProvider>
              <ConfirmProvider>
                <Layout />
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
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
